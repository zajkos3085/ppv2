import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInAnonymously,
  signInWithCustomToken,
  onAuthStateChanged
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot
} from 'firebase/firestore';
import {
  LayoutDashboard,
  Users,
  Wrench,
  Map as MapIcon,
  Calendar,
  Plus,
  Search,
  Phone,
  MapPin,
  Clock,
  Check,
  X,
  Trash2,
  Edit3,
  Navigation,
  ExternalLink,
  AlertTriangle,
  Flame,
  Snowflake,
  Wind,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  ClipboardCheck,
  History,
  Bell,
  AlertCircle,
  Crosshair,
  Ban,
  FastForward,
  RotateCcw,
  Layers,
  Download,
  Upload,
  FileSpreadsheet
} from 'lucide-react';

const hasFirebaseEnv = typeof __firebase_config !== 'undefined' && Boolean(__firebase_config);
const firebaseConfig = hasFirebaseEnv ? JSON.parse(__firebase_config) : null;
const app = firebaseConfig ? initializeApp(firebaseConfig) : null;
const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;
const appId = typeof __app_id !== 'undefined' ? __app_id : 'pp-planer-pracy-hvac';

const LS_KEYS = {
  CLIENTS: 'pp_hvac_clients_v1',
  APPOINTMENTS: 'pp_hvac_appointments_v1',
  CATALOG: 'pp_hvac_catalog_v1'
};

const toLocalYMD = (dateObj) => {
  const d = dateObj instanceof Date ? dateObj : new Date(dateObj);
  if (isNaN(d.getTime())) return '2026-01-01';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const addMonthsToYMD = (ymdStr, months) => {
  const d = new Date((ymdStr || toLocalYMD(new Date())) + 'T12:00:00');
  if (isNaN(d.getTime())) return toLocalYMD(new Date());
  d.setMonth(d.getMonth() + Number(months || 12));
  return toLocalYMD(d);
};

const formatDatePL = (ymdStr) => {
  if (!ymdStr) return '—';
  const d = new Date(ymdStr + 'T12:00:00');
  if (isNaN(d.getTime())) return ymdStr;
  return d.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const getDeviceInfo = (type) => {
  switch (type) {
    case 'heat_pump':
      return {
        label: 'Pompa ciepła',
        short: 'Pompa ciepła',
        icon: Flame,
        color: 'text-orange-700',
        bg: 'bg-orange-50',
        border: 'border-orange-200',
        pinColor: '#ea580c'
      };
    case 'ac':
      return {
        label: 'Klimatyzacja',
        short: 'Klimatyzacja',
        icon: Snowflake,
        color: 'text-sky-700',
        bg: 'bg-sky-50',
        border: 'border-sky-200',
        pinColor: '#0284c7'
      };
    case 'ventilation':
      return {
        label: 'Wentylacja / Rekuperacja',
        short: 'Rekuperacja',
        icon: Wind,
        color: 'text-emerald-700',
        bg: 'bg-emerald-50',
        border: 'border-emerald-200',
        pinColor: '#059669'
      };
    default:
      return {
        label: 'Urządzenie HVAC',
        short: 'HVAC',
        icon: Wrench,
        color: 'text-slate-700',
        bg: 'bg-slate-100',
        border: 'border-slate-300',
        pinColor: '#475569'
      };
  }
};

const normalizeClientDevices = (client) => {
  if (Array.isArray(client?.devices) && client.devices.length > 0) {
    return client.devices.map((dev, idx) => {
      const install = dev.installDate || client.installDate || '2025-05-10';
      const interval = Number(dev.inspectionIntervalMonths || 12);
      const lastInsp = dev.lastInspectionDate || install;
      const nextInsp = dev.nextInspectionDate || addMonthsToYMD(lastInsp, interval);
      return {
        id: dev.id || `dev_${idx + 1}`,
        deviceType: dev.deviceType || 'heat_pump',
        deviceModel: dev.deviceModel || 'Urządzenie HVAC',
        installDate: install,
        warrantyMonths: Number(dev.warrantyMonths || 60),
        lastInspectionDate: lastInsp,
        nextInspectionDate: nextInsp,
        inspectionIntervalMonths: interval,
        remindersCanceled: Boolean(dev.remindersCanceled),
        inspectionHistory: Array.isArray(dev.inspectionHistory) ? dev.inspectionHistory : []
      };
    });
  }

  const install = client?.installDate || '2025-05-10';
  const interval = Number(client?.inspectionIntervalMonths || 12);
  const lastInsp = client?.lastInspectionDate || install;
  const nextInsp = client?.nextInspectionDate || addMonthsToYMD(lastInsp, interval);

  return [
    {
      id: 'dev_1',
      deviceType: client?.deviceType || 'heat_pump',
      deviceModel: client?.deviceModel || 'Panasonic Aquarea 9kW',
      installDate: install,
      warrantyMonths: Number(client?.warrantyMonths || 60),
      lastInspectionDate: lastInsp,
      nextInspectionDate: nextInsp,
      inspectionIntervalMonths: interval,
      remindersCanceled: Boolean(client?.remindersCanceled),
      inspectionHistory: Array.isArray(client?.inspectionHistory) ? client.inspectionHistory : []
    }
  ];
};

const calculateDeviceStatus = (device) => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const installDate = new Date((device.installDate || '2025-01-01') + 'T12:00:00');
  const warrantyEnd = new Date(installDate);
  warrantyEnd.setMonth(warrantyEnd.getMonth() + Number(device.warrantyMonths || 60));

  const daysToWarrantyEnd = Math.ceil((warrantyEnd - now) / (1000 * 60 * 60 * 24));
  const isUnderWarranty = daysToWarrantyEnd >= 0;

  const nextInspection = new Date((device.nextInspectionDate || addMonthsToYMD(device.installDate, 12)) + 'T12:00:00');
  const daysToInspection = Math.ceil((nextInspection - now) / (1000 * 60 * 60 * 24));

  const remindersCanceled = Boolean(device.remindersCanceled);
  const isInspectionOverdue = !remindersCanceled && daysToInspection < 0;
  const isInspectionSoon = !remindersCanceled && daysToInspection >= 0 && daysToInspection <= 30;

  return {
    warrantyEndStr: toLocalYMD(warrantyEnd),
    warrantyEndFormatted: formatDatePL(toLocalYMD(warrantyEnd)),
    daysToWarrantyEnd,
    isUnderWarranty,
    nextInspectionStr: toLocalYMD(nextInspection),
    nextInspectionFormatted: formatDatePL(toLocalYMD(nextInspection)),
    lastInspectionFormatted: formatDatePL(device.lastInspectionDate || device.installDate),
    daysToInspection,
    remindersCanceled,
    isInspectionOverdue,
    isInspectionSoon
  };
};

const getInitialCatalogDevices = () => [
  {
    id: 'cat_1',
    deviceType: 'heat_pump',
    brand: 'Panasonic',
    model: 'Aquarea T-CAP 9kW (Generacja H/J/K)',
    defaultWarrantyMonths: 60,
    defaultIntervalMonths: 12
  },
  {
    id: 'cat_2',
    deviceType: 'heat_pump',
    brand: 'Daikin',
    model: 'Altherma 3 R 8kW',
    defaultWarrantyMonths: 60,
    defaultIntervalMonths: 12
  },
  {
    id: 'cat_3',
    deviceType: 'heat_pump',
    brand: 'Vaillant',
    model: 'aroTHERM plus 10kW (VWL 105/6 A)',
    defaultWarrantyMonths: 60,
    defaultIntervalMonths: 12
  },
  {
    id: 'cat_4',
    deviceType: 'ac',
    brand: 'Gree',
    model: 'Amber Prestige 3.5kW',
    defaultWarrantyMonths: 60,
    defaultIntervalMonths: 12
  },
  {
    id: 'cat_5',
    deviceType: 'ac',
    brand: 'Mitsubishi Electric',
    model: 'Diamond MSZ-LN 5.0kW',
    defaultWarrantyMonths: 60,
    defaultIntervalMonths: 12
  },
  {
    id: 'cat_6',
    deviceType: 'ventilation',
    brand: 'Zehnder',
    model: 'ComfoAir Q350 TR',
    defaultWarrantyMonths: 24,
    defaultIntervalMonths: 12
  }
];

const getSampleClients = () => {
  const today = new Date();
  const fmt = (offsetDays) => {
    const d = new Date(today);
    d.setDate(d.getDate() + offsetDays);
    return toLocalYMD(d);
  };

  return [
    {
      name: 'Jan Kowalski',
      phone: '+48 601 234 567',
      city: 'Poznań',
      postalCode: '60-101',
      street: 'ul. Słoneczna 15',
      lat: 52.3942,
      lng: 16.8824,
      notes: 'Pompa ciepła w kotłowni + klimatyzacja w salonie.',
      devices: [
        {
          id: 'dev_jk_1',
          deviceType: 'heat_pump',
          deviceModel: 'Panasonic Aquarea T-CAP 9kW',
          installDate: '2024-10-15',
          warrantyMonths: 60,
          lastInspectionDate: '2025-10-15',
          nextInspectionDate: fmt(11),
          inspectionIntervalMonths: 12,
          remindersCanceled: false,
          inspectionHistory: [
            { id: 'h1', date: '2025-10-15', technician: 'Serwis PP', notes: 'Czyszczenie filtrów magnetycznych.' }
          ]
        },
        {
          id: 'dev_jk_2',
          deviceType: 'ac',
          deviceModel: 'Gree Amber Prestige 3.5kW',
          installDate: '2025-05-20',
          warrantyMonths: 60,
          lastInspectionDate: '2025-05-20',
          nextInspectionDate: fmt(65),
          inspectionIntervalMonths: 12,
          remindersCanceled: false,
          inspectionHistory: []
        }
      ]
    },
    {
      name: 'Anna Nowak',
      phone: '+48 605 889 112',
      city: 'Swarzędz',
      postalCode: '62-020',
      street: 'ul. Kwiatowa 8/4',
      lat: 52.4115,
      lng: 17.0789,
      notes: 'Prośba o telefon 30 minut przed przyjazdem.',
      devices: [
        {
          id: 'dev_an_1',
          deviceType: 'ac',
          deviceModel: 'Gree Amber Prestige 3.5kW',
          installDate: '2024-04-10',
          warrantyMonths: 60,
          lastInspectionDate: '2024-04-10',
          nextInspectionDate: fmt(-9),
          inspectionIntervalMonths: 12,
          remindersCanceled: false,
          inspectionHistory: []
        }
      ]
    },
    {
      name: 'Piotr Wiśniewski',
      phone: '+48 502 331 908',
      city: 'Luboń',
      postalCode: '62-030',
      street: 'ul. Leśna 42',
      lat: 52.3458,
      lng: 16.8891,
      notes: 'Rekuperator na poddaszu.',
      devices: [
        {
          id: 'dev_pw_1',
          deviceType: 'ventilation',
          deviceModel: 'Zehnder ComfoAir Q350',
          installDate: '2024-11-01',
          warrantyMonths: 24,
          lastInspectionDate: '2024-11-01',
          nextInspectionDate: fmt(20),
          inspectionIntervalMonths: 12,
          remindersCanceled: false,
          inspectionHistory: []
        }
      ]
    }
  ];
};

export default function App() {
  const [user, setUser] = useState(null);
  const [clients, setClients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [deviceCatalog, setDeviceCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [notification, setNotification] = useState(null);
  const [showAllUrgent, setShowAllUrgent] = useState(false);
  const [calMonthDate, setCalMonthDate] = useState(() => new Date());

  const [searchQuery, setSearchQuery] = useState('');
  const [deviceFilter, setDeviceFilter] = useState('all');
  const [inspectionFilter, setInspectionFilter] = useState('all');

  const [catalogSearchQuery, setCatalogSearchQuery] = useState('');
  const [catalogTypeFilter, setCatalogTypeFilter] = useState('all');
  const [newCatalogItemForm, setNewCatalogItemForm] = useState({
    deviceType: 'heat_pump',
    brand: '',
    model: '',
    defaultWarrantyMonths: 60,
    defaultIntervalMonths: 12
  });

  const [isAddDeviceModalOpen, setIsAddDeviceModalOpen] = useState(false);
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false);
  const [clientDropdownSearch, setClientDropdownSearch] = useState('');
  const [catalogDropdownOpen, setCatalogDropdownOpen] = useState(false);
  const [catalogDropdownSearch, setCatalogDropdownSearch] = useState('');
  const [assignDeviceForm, setAssignDeviceForm] = useState({
    clientId: '',
    catalogDeviceId: '',
    deviceType: 'heat_pump',
    deviceModel: '',
    installDate: toLocalYMD(new Date()),
    warrantyMonths: 60,
    lastInspectionDate: toLocalYMD(new Date()),
    nextInspectionDate: addMonthsToYMD(toLocalYMD(new Date()), 12),
    inspectionIntervalMonths: 12
  });

  const [mapPinColorMode, setMapPinColorMode] = useState('inspection');
  const [mapTileStyle, setMapTileStyle] = useState('voyager');
  const [selectedMapClient, setSelectedMapClient] = useState(null);
  const [leafletReady, setLeafletReady] = useState(false);
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const tileLayerRef = useRef(null);
  const markersLayerRef = useRef(null);
  const csvInputRef = useRef(null);

  const [plannerMode, setPlannerMode] = useState('day');
  const [selectedDate, setSelectedDate] = useState(() => toLocalYMD(new Date()));

  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [geocodingLoading, setGeocodingLoading] = useState(false);
  const [clientForm, setClientForm] = useState({
    name: '',
    phone: '',
    postalCode: '',
    city: 'Poznań',
    street: '',
    lat: 52.4064,
    lng: 16.9252,
    notes: '',
    devices: [
      {
        id: 'dev_1',
        deviceType: 'heat_pump',
        deviceModel: '',
        installDate: toLocalYMD(new Date()),
        warrantyMonths: 60,
        lastInspectionDate: toLocalYMD(new Date()),
        nextInspectionDate: addMonthsToYMD(toLocalYMD(new Date()), 12),
        inspectionIntervalMonths: 12,
        remindersCanceled: false,
        inspectionHistory: []
      }
    ]
  });

  const [inspectionModalClientId, setInspectionModalClientId] = useState(null);
  const [selectedDeviceIdForInspection, setSelectedDeviceIdForInspection] = useState(null);
  const [newInspectionForm, setNewInspectionForm] = useState({
    date: toLocalYMD(new Date()),
    nextDate: addMonthsToYMD(toLocalYMD(new Date()), 12),
    technician: 'Serwis PP',
    notes: 'Przegląd okresowy gwarancyjny.'
  });

  const [isVisitModalOpen, setIsVisitModalOpen] = useState(false);
  const [visitClientSearch, setVisitClientSearch] = useState('');
  const [visitForm, setVisitForm] = useState({
    clientId: '',
    deviceId: '',
    date: toLocalYMD(new Date()),
    time: '09:00',
    serviceType: 'Przegląd okresowy / Gwarancyjny',
    notes: '',
    status: 'planned'
  });

  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const showToast = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => {
      setNotification((prev) => (prev?.msg === msg ? null : prev));
    }, 3500);
  };

  useEffect(() => {
    if (!hasFirebaseEnv || !auth) {
      setUser({ uid: 'local-github-user', isLocal: true });
      return;
    }

    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        setUser({ uid: 'local-github-user', isLocal: true });
      }
    };
    initAuth();
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) setUser(u);
    });
    return () => unsub();
  }, []);

  const saveLocalClients = (nextClients) => {
    setClients(nextClients);
    try {
      localStorage.setItem(LS_KEYS.CLIENTS, JSON.stringify(nextClients));
    } catch (e) {}
  };

  const saveLocalAppointments = (nextAppointments) => {
    setAppointments(nextAppointments);
    try {
      localStorage.setItem(LS_KEYS.APPOINTMENTS, JSON.stringify(nextAppointments));
    } catch (e) {}
  };

  const saveLocalCatalog = (nextCatalog) => {
    setDeviceCatalog(nextCatalog);
    try {
      localStorage.setItem(LS_KEYS.CATALOG, JSON.stringify(nextCatalog));
    } catch (e) {}
  };

  useEffect(() => {
    if (!user) return;

    if (user.isLocal || !db) {
      try {
        const savedClients = localStorage.getItem(LS_KEYS.CLIENTS);
        const savedApps = localStorage.getItem(LS_KEYS.APPOINTMENTS);
        const savedCat = localStorage.getItem(LS_KEYS.CATALOG);

        setClients(savedClients ? JSON.parse(savedClients) : []);
        setAppointments(savedApps ? JSON.parse(savedApps) : []);
        if (savedCat) {
          setDeviceCatalog(JSON.parse(savedCat));
        } else {
          const initialCat = getInitialCatalogDevices();
          setDeviceCatalog(initialCat);
          localStorage.setItem(LS_KEYS.CATALOG, JSON.stringify(initialCat));
        }
      } catch (err) {}
      setLoading(false);
      return;
    }

    const clientsRef = collection(db, 'artifacts', appId, 'public', 'data', 'clients');
    const appointmentsRef = collection(db, 'artifacts', appId, 'public', 'data', 'appointments');
    const catalogRef = collection(db, 'artifacts', appId, 'public', 'data', 'device_catalog');

    const unsubClients = onSnapshot(
      clientsRef,
      (snapshot) => {
        const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        setClients(list);
        setLoading(false);
      },
      () => setLoading(false)
    );

    const unsubAppointments = onSnapshot(
      appointmentsRef,
      (snapshot) => {
        const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        setAppointments(list);
      },
      () => {}
    );

    const unsubCatalog = onSnapshot(
      catalogRef,
      async (snapshot) => {
        if (snapshot.empty) {
          try {
            const initialItems = getInitialCatalogDevices();
            for (const item of initialItems) {
              const { id, ...rest } = item;
              await addDoc(catalogRef, { ...rest, createdAt: new Date().toISOString() });
            }
          } catch (e) {}
        } else {
          const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
          setDeviceCatalog(list);
        }
      },
      () => {}
    );

    return () => {
      unsubClients();
      unsubAppointments();
      unsubCatalog();
    };
  }, [user]);

  const clientsWithStatus = useMemo(() => {
    return clients.map(c => {
      const normalizedDevices = normalizeClientDevices(c).map(dev => ({
        ...dev,
        statusInfo: calculateDeviceStatus(dev)
      }));

      const activeDevices = normalizedDevices.filter(d => !d.statusInfo.remindersCanceled);
      const anyOverdue = activeDevices.some(d => d.statusInfo.isInspectionOverdue);
      const anySoon = activeDevices.some(d => d.statusInfo.isInspectionSoon);
      const anyUnderWarranty = normalizedDevices.some(d => d.statusInfo.isUnderWarranty);

      let mostUrgentDevice = normalizedDevices[0];
      if (activeDevices.length > 0) {
        mostUrgentDevice = [...activeDevices].sort(
          (a, b) => a.statusInfo.daysToInspection - b.statusInfo.daysToInspection
        )[0];
      }

      return {
        ...c,
        devices: normalizedDevices,
        anyOverdue,
        anySoon,
        anyUnderWarranty,
        mostUrgentDevice
      };
    });
  }, [clients]);

  const inspectionModalClient = useMemo(() => {
    if (!inspectionModalClientId) return null;
    return clientsWithStatus.find(c => c.id === inspectionModalClientId) || null;
  }, [clientsWithStatus, inspectionModalClientId]);

  const urgentDeviceItems = useMemo(() => {
    const items = [];
    clientsWithStatus.forEach(client => {
      client.devices.forEach(device => {
        const st = device.statusInfo;
        if (!st.remindersCanceled && (st.isInspectionOverdue || st.isInspectionSoon)) {
          items.push({ client, device, statusInfo: st });
        }
      });
    });
    return items.sort((a, b) => a.statusInfo.daysToInspection - b.statusInfo.daysToInspection);
  }, [clientsWithStatus]);

  const filteredClients = useMemo(() => {
    return clientsWithStatus.filter(c => {
      const q = searchQuery.toLowerCase().trim();
      const matchesDevicesText = c.devices.some(
        d =>
          d.deviceModel?.toLowerCase().includes(q) ||
          getDeviceInfo(d.deviceType).label.toLowerCase().includes(q)
      );
      const matchesQuery =
        !q ||
        c.name?.toLowerCase().includes(q) ||
        c.city?.toLowerCase().includes(q) ||
        c.street?.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q) ||
        matchesDevicesText;

      const matchesDeviceType =
        deviceFilter === 'all' || c.devices.some(d => d.deviceType === deviceFilter);

      const matchesInspection =
        inspectionFilter === 'all' ||
        (inspectionFilter === 'overdue' && c.anyOverdue) ||
        (inspectionFilter === 'soon' && (c.anySoon || c.anyOverdue)) ||
        (inspectionFilter === 'warranty' && c.anyUnderWarranty);

      return matchesQuery && matchesDeviceType && matchesInspection;
    });
  }, [clientsWithStatus, searchQuery, deviceFilter, inspectionFilter]);

  const stats = useMemo(() => {
    const todayStr = toLocalYMD(new Date());
    let totalDevices = 0;
    let overdueCount = 0;
    let soonCount = 0;

    clientsWithStatus.forEach(c => {
      c.devices.forEach(d => {
        totalDevices += 1;
        if (d.statusInfo.isInspectionOverdue) overdueCount += 1;
        else if (d.statusInfo.isInspectionSoon) soonCount += 1;
      });
    });

    return {
      totalClients: clientsWithStatus.length,
      totalDevices,
      overdueCount,
      soonCount,
      urgentTotal: overdueCount + soonCount,
      todayVisitsCount: appointments.filter(a => a.date === todayStr).length
    };
  }, [clientsWithStatus, appointments]);

  useEffect(() => {
    if (window.L) {
      setLeafletReady(true);
      return;
    }

    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    if (!document.getElementById('leaflet-custom-fixes')) {
      const style = document.createElement('style');
      style.id = 'leaflet-custom-fixes';
      style.innerHTML = `
        .leaflet-container img.leaflet-tile { max-width: none !important; max-height: none !important; }
        .leaflet-container { font-family: inherit; z-index: 10; background-color: #e2e8f0; }
      `;
      document.head.appendChild(style);
    }

    const script = document.createElement('script');
    script.id = 'leaflet-js';
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.onload = () => setLeafletReady(true);
    document.body.appendChild(script);
  }, []);

  const getTileConfig = (styleKey) => {
    if (styleKey === 'street') {
      return {
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
        attribution: 'Tiles &copy; Esri'
      };
    }
    if (styleKey === 'satellite') {
      return {
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attribution: 'Tiles &copy; Esri'
      };
    }
    return {
      url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      attribution: '&copy; CARTO'
    };
  };

  useEffect(() => {
    if (activeTab !== 'map' || !leafletReady || !mapContainerRef.current) return;

    const L = window.L;
    if (!L) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [52.237049, 19.017532],
        zoom: 6,
        zoomControl: true
      });

      const tileCfg = getTileConfig(mapTileStyle);
      tileLayerRef.current = L.tileLayer(tileCfg.url, {
        attribution: tileCfg.attribution,
        maxZoom: 19
      }).addTo(map);

      markersLayerRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
    } else if (tileLayerRef.current) {
      const tileCfg = getTileConfig(mapTileStyle);
      tileLayerRef.current.setUrl(tileCfg.url);
    }

    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;

    setTimeout(() => map.invalidateSize(), 150);
    markersLayer.clearLayers();
    const bounds = [];

    clientsWithStatus.forEach((client) => {
      const lat = parseFloat(client.lat);
      const lng = parseFloat(client.lng);
      if (isNaN(lat) || isNaN(lng)) return;

      bounds.push([lat, lng]);

      const primaryDev = client.mostUrgentDevice || client.devices[0];
      const devInfo = getDeviceInfo(primaryDev?.deviceType);

      let pinColor = devInfo.pinColor;
      if (mapPinColorMode === 'inspection') {
        pinColor = client.anyOverdue ? '#e11d48' : client.anySoon ? '#d97706' : '#10b981';
      } else if (mapPinColorMode === 'warranty') {
        pinColor = client.anyUnderWarranty ? '#10b981' : '#ef4444';
      }

      const countBadge = client.devices.length > 1
        ? `<div style="position:absolute;top:-5px;right:-5px;background:#0f172a;color:#fff;font-size:10px;font-weight:800;width:18px;height:18px;border-radius:9999px;display:flex;align-items:center;justify-content:center;border:1.5px solid #fff;">${client.devices.length}</div>`
        : '';

      const svgHtml = `
        <div style="position:relative;background-color:${pinColor};width:34px;height:34px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 4px 10px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;">
          <div style="width:10px;height:10px;background:#fff;border-radius:50%;transform:rotate(45deg);"></div>
        </div>
        ${countBadge}
      `;

      const icon = L.divIcon({
        className: 'custom-hvac-pin',
        html: svgHtml,
        iconSize: [34, 34],
        iconAnchor: [17, 34],
        popupAnchor: [0, -34]
      });

      const marker = L.marker([lat, lng], { icon });
      marker.on('click', () => setSelectedMapClient(client));
      marker.bindTooltip(`<strong>${client.name}</strong> (${client.devices.length} urz.)`, { direction: 'top', offset: [0, -28] });
      markersLayer.addLayer(marker);
    });

    if (bounds.length > 0 && !selectedMapClient) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
    }
  }, [activeTab, leafletReady, clientsWithStatus, mapPinColorMode, mapTileStyle]);

  const handleRefreshAndCenterMap = () => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.invalidateSize();
    const validCoords = clientsWithStatus
      .filter(c => !isNaN(parseFloat(c.lat)) && !isNaN(parseFloat(c.lng)))
      .map(c => [parseFloat(c.lat), parseFloat(c.lng)]);
    if (validCoords.length > 0) {
      mapInstanceRef.current.fitBounds(validCoords, { padding: [50, 50], maxZoom: 12 });
    }
  };

  const handleSeedSampleData = async () => {
    if (!user || seeding) return;
    setSeeding(true);
    try {
      const sampleList = getSampleClients();
      const todayStr = toLocalYMD(new Date());

      if (user.isLocal || !db) {
        const createdClients = sampleList.map((item, idx) => ({
          id: `local_client_${Date.now()}_${idx}`,
          ...item,
          createdAt: new Date().toISOString()
        }));
        saveLocalClients(createdClients);
        saveLocalAppointments([
          {
            id: `local_visit_1`,
            clientId: createdClients[0].id,
            deviceId: createdClients[0].devices[0].id,
            date: todayStr,
            time: '09:00',
            serviceType: 'Przegląd okresowy / Gwarancyjny',
            notes: 'Przegląd pompy ciepła.',
            status: 'planned',
            order: 1,
            createdAt: new Date().toISOString()
          }
        ]);
        showToast("Wgrano przykładową bazę klientów!");
        setSeeding(false);
        return;
      }

      const clientsRef = collection(db, 'artifacts', appId, 'public', 'data', 'clients');
      const appointmentsRef = collection(db, 'artifacts', appId, 'public', 'data', 'appointments');
      const createdIds = [];

      for (const item of sampleList) {
        const docRef = await addDoc(clientsRef, { ...item, createdAt: new Date().toISOString() });
        createdIds.push({ id: docRef.id, ...item });
      }

      if (createdIds.length > 0) {
        await addDoc(appointmentsRef, {
          clientId: createdIds[0].id,
          deviceId: createdIds[0].devices[0].id,
          date: todayStr,
          time: '09:00',
          serviceType: 'Przegląd okresowy / Gwarancyjny',
          notes: 'Przegląd pompy ciepła.',
          status: 'planned',
          order: 1,
          createdAt: new Date().toISOString()
        });
      }

      showToast("Wgrano przykładową bazę klientów do chmury!");
    } catch (error) {
      showToast("Nie udało się wgrać danych przykładowych.", "error");
    } finally {
      setSeeding(false);
    }
  };

  const handleGeocodeAddress = async () => {
    const query = `${clientForm.street}, ${clientForm.postalCode} ${clientForm.city}, Polska`.trim();
    if (!clientForm.city && !clientForm.street) {
      showToast("Wpisz miasto i ulicę przed pobraniem współrzędnych.", "error");
      return;
    }

    setGeocodingLoading(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
      const res = await fetch(url, { headers: { 'Accept-Language': 'pl' } });
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setClientForm(prev => ({
          ...prev,
          lat: parseFloat(parseFloat(data[0].lat).toFixed(5)),
          lng: parseFloat(parseFloat(data[0].lon).toFixed(5))
        }));
        showToast("Pobrano współrzędne GPS!");
      } else {
        showToast("Nie znaleziono adresu.", "error");
      }
    } catch (err) {
      showToast("Błąd usługi geokodowania.", "error");
    } finally {
      setGeocodingLoading(false);
    }
  };

  const openAddClientModal = () => {
    const today = toLocalYMD(new Date());
    setEditingClient(null);
    setClientForm({
      name: '',
      phone: '',
      postalCode: '',
      city: 'Poznań',
      street: '',
      lat: 52.4064,
      lng: 16.9252,
      notes: '',
      devices: [
        {
          id: `dev_${Date.now()}_1`,
          deviceType: 'heat_pump',
          deviceModel: '',
          installDate: today,
          warrantyMonths: 60,
          lastInspectionDate: today,
          nextInspectionDate: addMonthsToYMD(today, 12),
          inspectionIntervalMonths: 12,
          remindersCanceled: false,
          inspectionHistory: []
        }
      ]
    });
    setIsClientModalOpen(true);
  };

  const openEditClientModal = (client) => {
    setEditingClient(client);
    const normalizedDevs = normalizeClientDevices(client).map(d => {
      const { statusInfo, ...clean } = d;
      return clean;
    });
    setClientForm({
      name: client.name || '',
      phone: client.phone || '',
      postalCode: client.postalCode || '',
      city: client.city || 'Poznań',
      street: client.street || '',
      lat: client.lat ?? 52.4064,
      lng: client.lng ?? 16.9252,
      notes: client.notes || '',
      devices: normalizedDevs
    });
    setIsClientModalOpen(true);
  };

  const handleAddDeviceInForm = () => {
    const today = toLocalYMD(new Date());
    setClientForm(prev => ({
      ...prev,
      devices: [
        ...prev.devices,
        {
          id: `dev_${Date.now()}_${prev.devices.length + 1}`,
          deviceType: 'ac',
          deviceModel: '',
          installDate: today,
          warrantyMonths: 60,
          lastInspectionDate: today,
          nextInspectionDate: addMonthsToYMD(today, 12),
          inspectionIntervalMonths: 12,
          remindersCanceled: false,
          inspectionHistory: []
        }
      ]
    }));
  };

  const handleRemoveDeviceInForm = (devId) => {
    setClientForm(prev => ({
      ...prev,
      devices: prev.devices.filter(d => d.id !== devId)
    }));
  };

  const handleUpdateDeviceInForm = (devId, field, value) => {
    setClientForm(prev => ({
      ...prev,
      devices: prev.devices.map(d => {
        if (d.id !== devId) return d;
        const updated = { ...d, [field]: value };
        if (field === 'installDate' && (!d.inspectionHistory || d.inspectionHistory.length === 0)) {
          updated.lastInspectionDate = value;
          updated.nextInspectionDate = addMonthsToYMD(value, d.inspectionIntervalMonths || 12);
        }
        return updated;
      })
    }));
  };

  const handleSaveClient = async (e) => {
    e.preventDefault();
    if (!user) return;

    const cleanedDevices = clientForm.devices.map((dev, idx) => ({
      id: dev.id || `dev_${Date.now()}_${idx}`,
      deviceType: dev.deviceType || 'heat_pump',
      deviceModel: (dev.deviceModel || 'Urządzenie HVAC').trim(),
      installDate: dev.installDate || toLocalYMD(new Date()),
      warrantyMonths: Number(dev.warrantyMonths || 60),
      lastInspectionDate: dev.lastInspectionDate || dev.installDate || toLocalYMD(new Date()),
      nextInspectionDate: dev.nextInspectionDate || addMonthsToYMD(dev.installDate || toLocalYMD(new Date()), 12),
      inspectionIntervalMonths: Number(dev.inspectionIntervalMonths || 12),
      remindersCanceled: Boolean(dev.remindersCanceled),
      inspectionHistory: Array.isArray(dev.inspectionHistory) ? dev.inspectionHistory : []
    }));

    const payload = {
      name: clientForm.name.trim(),
      phone: clientForm.phone.trim(),
      postalCode: clientForm.postalCode.trim(),
      city: clientForm.city.trim(),
      street: clientForm.street.trim(),
      lat: !isNaN(parseFloat(clientForm.lat)) ? parseFloat(clientForm.lat) : 52.4064,
      lng: !isNaN(parseFloat(clientForm.lng)) ? parseFloat(clientForm.lng) : 16.9252,
      notes: (clientForm.notes || '').trim(),
      devices: cleanedDevices,
      updatedAt: new Date().toISOString()
    };

    try {
      if (user.isLocal || !db) {
        if (editingClient) {
          const next = clients.map(c => (c.id === editingClient.id ? { ...c, ...payload } : c));
          saveLocalClients(next);
          showToast("Zaktualizowano dane klienta.");
        } else {
          const newClient = { id: `client_${Date.now()}`, ...payload, createdAt: new Date().toISOString() };
          saveLocalClients([...clients, newClient]);
          showToast("Dodano nowego klienta.");
        }
        setIsClientModalOpen(false);
        return;
      }

      if (editingClient) {
        const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'clients', editingClient.id);
        await updateDoc(docRef, payload);
        showToast("Zaktualizowano dane klienta.");
      } else {
        const colRef = collection(db, 'artifacts', appId, 'public', 'data', 'clients');
        await addDoc(colRef, { ...payload, createdAt: new Date().toISOString() });
        showToast("Dodano nowego klienta.");
      }
      setIsClientModalOpen(false);
    } catch (error) {
      showToast("Błąd podczas zapisywania klienta.", "error");
    }
  };

  const openInspectionModal = (client, preselectedDeviceId = null) => {
    const today = toLocalYMD(new Date());
    const devs = client.devices || normalizeClientDevices(client);
    const chosenDev = preselectedDeviceId
      ? devs.find(d => d.id === preselectedDeviceId) || devs[0]
      : (client.mostUrgentDevice || devs[0]);

    setInspectionModalClientId(client.id);
    setSelectedDeviceIdForInspection(chosenDev?.id || 'dev_1');
    setNewInspectionForm({
      date: today,
      nextDate: addMonthsToYMD(today, chosenDev?.inspectionIntervalMonths || 12),
      technician: 'Serwis PP',
      notes: 'Przegląd okresowy gwarancyjny.'
    });
  };

  const handleRegisterInspection = async (e) => {
    e.preventDefault();
    if (!user || !inspectionModalClient || !selectedDeviceIdForInspection) return;

    try {
      const entry = {
        id: Date.now().toString(),
        date: newInspectionForm.date,
        technician: newInspectionForm.technician || 'Serwis PP',
        notes: newInspectionForm.notes || 'Wykonano przegląd okresowy.'
      };

      const updatedDevices = inspectionModalClient.devices.map(dev => {
        if (dev.id !== selectedDeviceIdForInspection) {
          const { statusInfo, ...clean } = dev;
          return clean;
        }
        const prevHistory = Array.isArray(dev.inspectionHistory) ? dev.inspectionHistory : [];
        const { statusInfo, ...cleanDev } = dev;
        return {
          ...cleanDev,
          lastInspectionDate: newInspectionForm.date,
          nextInspectionDate: newInspectionForm.nextDate,
          remindersCanceled: false,
          inspectionHistory: [entry, ...prevHistory]
        };
      });

      if (user.isLocal || !db) {
        const next = clients.map(c =>
          c.id === inspectionModalClient.id ? { ...c, devices: updatedDevices, updatedAt: new Date().toISOString() } : c
        );
        saveLocalClients(next);
        showToast("Zarejestrowano przegląd urządzenia!");
        return;
      }

      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'clients', inspectionModalClient.id);
      await updateDoc(docRef, { devices: updatedDevices, updatedAt: new Date().toISOString() });
      showToast("Zarejestrowano przegląd urządzenia!");
    } catch (err) {
      showToast("Nie udało się zapisać przeglądu.", "error");
    }
  };

  const handleSkipCurrentInspection = async (client, deviceId) => {
    if (!user || !client) return;
    try {
      const today = toLocalYMD(new Date());
      const updatedDevices = client.devices.map(dev => {
        if (dev.id !== deviceId) {
          const { statusInfo, ...clean } = dev;
          return clean;
        }
        const interval = Number(dev.inspectionIntervalMonths || 12);
        const baseDate = dev.nextInspectionDate && dev.nextInspectionDate > today ? dev.nextInspectionDate : today;
        const shiftedNextDate = addMonthsToYMD(baseDate, interval);
        const prevHistory = Array.isArray(dev.inspectionHistory) ? dev.inspectionHistory : [];
        const { statusInfo, ...cleanDev } = dev;

        return {
          ...cleanDev,
          nextInspectionDate: shiftedNextDate,
          inspectionHistory: [
            {
              id: `skip_${Date.now()}`,
              date: today,
              technician: 'System PP',
              notes: `Anulowano aktualny przegląd — termin przesunięty na ${formatDatePL(shiftedNextDate)}.`
            },
            ...prevHistory
          ]
        };
      });

      if (user.isLocal || !db) {
        const next = clients.map(c =>
          c.id === client.id ? { ...c, devices: updatedDevices, updatedAt: new Date().toISOString() } : c
        );
        saveLocalClients(next);
        showToast("Przegląd został przesunięty o rok.");
        return;
      }

      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'clients', client.id);
      await updateDoc(docRef, { devices: updatedDevices, updatedAt: new Date().toISOString() });
      showToast("Przegląd został przesunięty o rok.");
    } catch (err) {
      showToast("Nie udało się przesunąć przeglądu.", "error");
    }
  };

  const handleToggleCancelDeviceReminders = async (client, deviceId, cancelState = true) => {
    if (!user || !client) return;
    try {
      const updatedDevices = client.devices.map(dev => {
        const { statusInfo, ...cleanDev } = dev;
        if (dev.id !== deviceId) return cleanDev;
        return { ...cleanDev, remindersCanceled: Boolean(cancelState) };
      });

      if (user.isLocal || !db) {
        const next = clients.map(c =>
          c.id === client.id ? { ...c, devices: updatedDevices, updatedAt: new Date().toISOString() } : c
        );
        saveLocalClients(next);
        showToast(cancelState ? "Wyłączono przypomnienia." : "Przywrócono przypomnienia.");
        return;
      }

      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'clients', client.id);
      await updateDoc(docRef, { devices: updatedDevices, updatedAt: new Date().toISOString() });
      showToast(cancelState ? "Wyłączono przypomnienia." : "Przywrócono przypomnienia.");
    } catch (err) {
      showToast("Nie udało się zmienić przypomnień.", "error");
    }
  };

  const handleExportClientsToExcelCSV = () => {
    if (clientsWithStatus.length === 0) {
      showToast("Brak danych do eksportu.", "error");
      return;
    }

    const headers = [
      'Imie i Nazwisko', 'Telefon', 'Kod pocztowy', 'Miasto', 'Ulica', 'Lat', 'Lng',
      'Typ urzadzenia', 'Model urzadzenia', 'Data montazu', 'Gwarancja', 'Ostatni przeglad', 'Nastepny przeglad', 'Notatki'
    ];

    const escapeCell = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;
    const rows = [];
    clientsWithStatus.forEach((client) => {
      client.devices.forEach((dev) => {
        rows.push(
          [
            client.name, client.phone, client.postalCode, client.city, client.street, client.lat, client.lng,
            getDeviceInfo(dev.deviceType).short, dev.deviceModel, dev.installDate, dev.warrantyMonths,
            dev.lastInspectionDate, dev.nextInspectionDate, client.notes || ''
          ].map(escapeCell).join(';')
        );
      });
    });

    const csvContent = '\uFEFF' + [headers.map(escapeCell).join(';'), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `PP_Baza_Klientow_${toLocalYMD(new Date())}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast("Wyeksportowano bazę klientów do pliku CSV!");
  };

  const handleImportClientsFromExcelCSV = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    try {
      const text = await file.text();
      const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) return;

      const sep = lines[0].includes(';') ? ';' : ',';
      const parseLine = (line) => line.split(sep).map(c => c.replace(/^"|"$/g, '').replace(/""/g, '"').trim());
      const grouped = new Map();

      for (let i = 1; i < lines.length; i++) {
        const cols = parseLine(lines[i]);
        if (cols.length < 4) continue;
        const [name, phone, postalCode, city, street, latStr, lngStr, devTypeStr, devModel, installDate, warrantyMonths, lastInsp, nextInsp, notes] = cols;
        if (!name) continue;

        const key = `${name.toLowerCase()}|${(phone || '').toLowerCase()}`;
        let devType = 'heat_pump';
        const lt = (devTypeStr || '').toLowerCase();
        if (lt.includes('klima') || lt === 'ac') devType = 'ac';
        else if (lt.includes('went') || lt.includes('reku')) devType = 'ventilation';

        const today = toLocalYMD(new Date());
        const inst = installDate || today;
        const devObj = {
          id: `dev_imp_${Date.now()}_${i}`,
          deviceType: devType,
          deviceModel: devModel || 'Urządzenie HVAC',
          installDate: inst,
          warrantyMonths: Number(warrantyMonths) || 60,
          lastInspectionDate: lastInsp || inst,
          nextInspectionDate: nextInsp || addMonthsToYMD(inst, 12),
          inspectionIntervalMonths: 12,
          remindersCanceled: false,
          inspectionHistory: []
        };

        if (!grouped.has(key)) {
          grouped.set(key, {
            name,
            phone: phone || '',
            postalCode: postalCode || '',
            city: city || 'Poznań',
            street: street || '',
            lat: parseFloat(latStr) || 52.4064,
            lng: parseFloat(lngStr) || 16.9252,
            notes: notes || '',
            devices: [devObj]
          });
        } else {
          grouped.get(key).devices.push(devObj);
        }
      }

      if (user.isLocal || !db) {
        const imported = Array.from(grouped.values()).map((c, idx) => ({ id: `imp_${Date.now()}_${idx}`, ...c }));
        saveLocalClients([...clients, ...imported]);
        showToast("Zaimportowano klientów z pliku CSV!");
        return;
      }

      const clientsRef = collection(db, 'artifacts', appId, 'public', 'data', 'clients');
      for (const clientData of grouped.values()) {
        await addDoc(clientsRef, { ...clientData, createdAt: new Date().toISOString() });
      }
      showToast("Zaimportowano klientów do chmury!");
    } catch (err) {
      showToast("Błąd odczytu pliku CSV.", "error");
    } finally {
      if (csvInputRef.current) csvInputRef.current.value = '';
    }
  };

  const confirmDeleteAction = async () => {
    if (!deleteConfirm || !user) return;
    try {
      if (user.isLocal || !db) {
        if (deleteConfirm.type === 'client') {
          saveLocalClients(clients.filter(c => c.id !== deleteConfirm.id));
          saveLocalAppointments(appointments.filter(a => a.clientId !== deleteConfirm.id));
        } else if (deleteConfirm.type === 'visit') {
          saveLocalAppointments(appointments.filter(a => a.id !== deleteConfirm.id));
        } else if (deleteConfirm.type === 'catalog_device') {
          saveLocalCatalog(deviceCatalog.filter(d => d.id !== deleteConfirm.id));
        }
        setDeleteConfirm(null);
        showToast("Usunięto pomyślnie.");
        return;
      }

      if (deleteConfirm.type === 'client') {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'clients', deleteConfirm.id));
      } else if (deleteConfirm.type === 'visit') {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'appointments', deleteConfirm.id));
      } else if (deleteConfirm.type === 'catalog_device') {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'device_catalog', deleteConfirm.id));
      }
      setDeleteConfirm(null);
      showToast("Usunięto pomyślnie.");
    } catch (e) {
      showToast("Błąd podczas usuwania.", "error");
    }
  };

  const openAddDeviceModal = (preselectedClientId = '', preselectedCatalogItem = null) => {
    const today = toLocalYMD(new Date());
    const targetClient = clientsWithStatus.find(c => c.id === preselectedClientId) || clientsWithStatus[0];
    const defaultCat = preselectedCatalogItem || deviceCatalog[0] || null;
    const interval = Number(defaultCat?.defaultIntervalMonths || 12);

    setClientDropdownOpen(false);
    setCatalogDropdownOpen(false);

    setAssignDeviceForm({
      clientId: targetClient?.id || '',
      catalogDeviceId: defaultCat?.id || '',
      deviceType: defaultCat?.deviceType || 'heat_pump',
      deviceModel: defaultCat ? `${defaultCat.brand} ${defaultCat.model}`.trim() : '',
      installDate: today,
      warrantyMonths: Number(defaultCat?.defaultWarrantyMonths || 60),
      lastInspectionDate: today,
      nextInspectionDate: addMonthsToYMD(today, interval),
      inspectionIntervalMonths: interval
    });
    setIsAddDeviceModalOpen(true);
  };

  const handleSelectCatalogModelInModal = (catItem) => {
    const interval = Number(catItem.defaultIntervalMonths || 12);
    const baseDate = assignDeviceForm.lastInspectionDate || assignDeviceForm.installDate || toLocalYMD(new Date());
    setAssignDeviceForm(prev => ({
      ...prev,
      catalogDeviceId: catItem.id,
      deviceType: catItem.deviceType || 'heat_pump',
      deviceModel: `${catItem.brand} ${catItem.model}`.trim(),
      warrantyMonths: Number(catItem.defaultWarrantyMonths || 60),
      inspectionIntervalMonths: interval,
      nextInspectionDate: addMonthsToYMD(baseDate, interval)
    }));
    setCatalogDropdownOpen(false);
  };

  const handleSaveAssignedDeviceToClient = async (e) => {
    e.preventDefault();
    if (!user || !assignDeviceForm.clientId) return;

    const targetClient = clients.find(c => c.id === assignDeviceForm.clientId);
    if (!targetClient) return;

    try {
      const existingDevices = normalizeClientDevices(targetClient);
      const install = assignDeviceForm.installDate || toLocalYMD(new Date());
      const lastInsp = assignDeviceForm.lastInspectionDate || install;
      const interval = Number(assignDeviceForm.inspectionIntervalMonths || 12);
      const nextInsp = assignDeviceForm.nextInspectionDate || addMonthsToYMD(lastInsp, interval);

      const newDeviceObj = {
        id: `dev_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        deviceType: assignDeviceForm.deviceType || 'heat_pump',
        deviceModel: assignDeviceForm.deviceModel.trim() || 'Urządzenie HVAC',
        installDate: install,
        warrantyMonths: Number(assignDeviceForm.warrantyMonths || 60),
        lastInspectionDate: lastInsp,
        nextInspectionDate: nextInsp,
        inspectionIntervalMonths: interval,
        remindersCanceled: false,
        inspectionHistory: []
      };

      if (user.isLocal || !db) {
        const next = clients.map(c =>
          c.id === targetClient.id ? { ...c, devices: [...existingDevices, newDeviceObj], updatedAt: new Date().toISOString() } : c
        );
        saveLocalClients(next);
        setIsAddDeviceModalOpen(false);
        showToast("Przypisano urządzenie do klienta!");
        return;
      }

      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'clients', targetClient.id);
      await updateDoc(docRef, { devices: [...existingDevices, newDeviceObj], updatedAt: new Date().toISOString() });
      setIsAddDeviceModalOpen(false);
      showToast("Przypisano urządzenie do klienta!");
    } catch (err) {
      showToast("Nie udało się przypisać urządzenia.", "error");
    }
  };

  const handleAddNewCatalogModel = async (e) => {
    e.preventDefault();
    if (!user || !newCatalogItemForm.brand.trim() || !newCatalogItemForm.model.trim()) return;

    try {
      if (user.isLocal || !db) {
        const newCat = {
          id: `cat_${Date.now()}`,
          ...newCatalogItemForm,
          createdAt: new Date().toISOString()
        };
        saveLocalCatalog([...deviceCatalog, newCat]);
        setNewCatalogItemForm({ deviceType: 'heat_pump', brand: '', model: '', defaultWarrantyMonths: 60, defaultIntervalMonths: 12 });
        showToast("Dodano model do Bazy Urządzeń!");
        return;
      }

      const catalogRef = collection(db, 'artifacts', appId, 'public', 'data', 'device_catalog');
      await addDoc(catalogRef, { ...newCatalogItemForm, createdAt: new Date().toISOString() });
      setNewCatalogItemForm({ deviceType: 'heat_pump', brand: '', model: '', defaultWarrantyMonths: 60, defaultIntervalMonths: 12 });
      showToast("Dodano model do Bazy Urządzeń!");
    } catch (err) {
      showToast("Błąd zapisu modelu.", "error");
    }
  };

  const filteredClientsForDropdown = useMemo(() => {
    const q = clientDropdownSearch.trim().toLowerCase();
    if (!q) return clientsWithStatus;
    return clientsWithStatus.filter(c => c.name?.toLowerCase().includes(q) || c.city?.toLowerCase().includes(q));
  }, [clientsWithStatus, clientDropdownSearch]);

  const filteredCatalogForDropdown = useMemo(() => {
    const q = catalogDropdownSearch.trim().toLowerCase();
    return deviceCatalog.filter(item => {
      const full = `${item.brand || ''} ${item.model || ''}`.toLowerCase();
      return !q || full.includes(q);
    });
  }, [deviceCatalog, catalogDropdownSearch]);

  const filteredCatalogView = useMemo(() => {
    const q = catalogSearchQuery.trim().toLowerCase();
    return deviceCatalog.filter(item => {
      const matchesType = catalogTypeFilter === 'all' || item.deviceType === catalogTypeFilter;
      const full = `${item.brand || ''} ${item.model || ''}`.toLowerCase();
      return matchesType && (!q || full.includes(q));
    });
  }, [deviceCatalog, catalogSearchQuery, catalogTypeFilter]);

  const openScheduleModal = (preselectedClientId = '', preselectedDate = selectedDate, preselectedDeviceId = '') => {
    const targetClient = clientsWithStatus.find(c => c.id === preselectedClientId) || clientsWithStatus[0];
    setVisitClientSearch('');
    setVisitForm({
      clientId: targetClient?.id || '',
      deviceId: preselectedDeviceId || targetClient?.devices?.[0]?.id || '',
      date: preselectedDate || toLocalYMD(new Date()),
      time: '09:00',
      serviceType: 'Przegląd okresowy / Gwarancyjny',
      notes: '',
      status: 'planned'
    });
    setIsVisitModalOpen(true);
  };

  const searchableClientsForVisit = useMemo(() => {
    const q = visitClientSearch.trim().toLowerCase();
    if (!q) return clientsWithStatus;
    return clientsWithStatus.filter(c => c.name?.toLowerCase().includes(q) || c.city?.toLowerCase().includes(q));
  }, [clientsWithStatus, visitClientSearch]);

  const handleSaveVisit = async (e) => {
    e.preventDefault();
    if (!user || !visitForm.clientId) return;

    try {
      if (user.isLocal || !db) {
        const newVisit = { id: `visit_${Date.now()}`, ...visitForm, createdAt: new Date().toISOString() };
        const otherDays = appointments.filter(a => a.date !== visitForm.date);
        const sameDay = [...appointments.filter(a => a.date === visitForm.date), newVisit]
          .sort((a, b) => (a.time || '00:00').localeCompare(b.time || '00:00'))
          .map((v, idx) => ({ ...v, order: idx + 1 }));

        saveLocalAppointments([...otherDays, ...sameDay]);
        setIsVisitModalOpen(false);
        showToast("Zaplanowano wizytę!");
        return;
      }

      const colRef = collection(db, 'artifacts', appId, 'public', 'data', 'appointments');
      const newDocRef = await addDoc(colRef, { ...visitForm, createdAt: new Date().toISOString() });
      const sameDay = [...appointments.filter(a => a.date === visitForm.date), { id: newDocRef.id, ...visitForm }]
        .sort((a, b) => (a.time || '00:00').localeCompare(b.time || '00:00'));

      await Promise.all(
        sameDay.map((v, idx) => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'appointments', v.id), { order: idx + 1 }))
      );

      setIsVisitModalOpen(false);
      showToast("Zaplanowano wizytę!");
    } catch (error) {
      showToast("Błąd planowania wizyty.", "error");
    }
  };

  const toggleVisitStatus = async (visit) => {
    if (!user) return;
    const nextStatus = visit.status === 'completed' ? 'planned' : 'completed';
    try {
      if (user.isLocal || !db) {
        saveLocalAppointments(appointments.map(a => (a.id === visit.id ? { ...a, status: nextStatus } : a)));
        return;
      }
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'appointments', visit.id), { status: nextStatus });
    } catch (e) {}
  };

  const moveVisitOrder = async (visit, direction, dayVisits) => {
    const idx = dayVisits.findIndex(v => v.id === visit.id);
    if (idx === -1) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= dayVisits.length) return;

    const updated = [...dayVisits];
    const temp = updated[idx];
    updated[idx] = updated[targetIdx];
    updated[targetIdx] = temp;

    try {
      if (user.isLocal || !db) {
        const otherDays = appointments.filter(a => a.date !== visit.date);
        const reordered = updated.map((item, i) => ({ ...item, order: i + 1, manualOrderOverride: true }));
        saveLocalAppointments([...otherDays, ...reordered]);
        return;
      }
      await Promise.all(
        updated.map((item, i) => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'appointments', item.id), { order: i + 1, manualOrderOverride: true }))
      );
    } catch (e) {}
  };

  const getPendingVisitsForRoute = (dayVisitsList) => {
    return (dayVisitsList || [])
      .filter(v => v.status !== 'completed')
      .sort((a, b) => (a.time || '00:00').localeCompare(b.time || '00:00'));
  };

  const generateGoogleMapsRouteUrl = (dayVisitsList, currentCoords = null) => {
    const pending = getPendingVisitsForRoute(dayVisitsList);
    if (pending.length === 0) return null;

    const addresses = pending.map(v => {
      const c = clients.find(cl => cl.id === v.clientId);
      if (!c) return null;
      return `${c.street}, ${c.postalCode || ''} ${c.city}, Polska`.trim();
    }).filter(Boolean);

    if (addresses.length === 0) return null;

    const destination = encodeURIComponent(addresses[addresses.length - 1]);
    const waypointsList = addresses.slice(0, -1);
    let url = `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;

    if (currentCoords?.lat && currentCoords?.lng) {
      url += `&origin=${encodeURIComponent(`${currentCoords.lat},${currentCoords.lng}`)}`;
    }
    if (waypointsList.length > 0) {
      url += `&waypoints=${waypointsList.map(a => encodeURIComponent(a)).join('|')}`;
    }
    return url;
  };

  const handleOpenGoogleMapsRoute = (dayVisitsList) => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const url = generateGoogleMapsRouteUrl(dayVisitsList, { lat: pos.coords.latitude, lng: pos.coords.longitude });
          if (url) window.open(url, '_blank', 'noopener,noreferrer');
        },
        () => {
          const url = generateGoogleMapsRouteUrl(dayVisitsList, null);
          if (url) window.open(url, '_blank', 'noopener,noreferrer');
        },
        { timeout: 2500 }
      );
    } else {
      const url = generateGoogleMapsRouteUrl(dayVisitsList, null);
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const getVisitsForDate = (dateStr) => {
    return appointments
      .filter(a => a.date === dateStr)
      .sort((a, b) => (a.time || '00:00').localeCompare(b.time || '00:00'));
  };

  const todayYMD = toLocalYMD(new Date());
  const todayVisits = useMemo(() => getVisitsForDate(todayYMD), [appointments, todayYMD]);
  const selectedDayVisits = useMemo(() => getVisitsForDate(selectedDate), [appointments, selectedDate]);

  const weekDays = useMemo(() => {
    const base = new Date(selectedDate + 'T12:00:00');
    const dayOfWeek = base.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(base);
    monday.setDate(base.getDate() + diffToMonday);

    const days = [];
    const dayNames = ['Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota', 'Niedziela'];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const ymd = toLocalYMD(d);
      days.push({
        ymd,
        label: dayNames[i],
        shortDate: d.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' }),
        visits: getVisitsForDate(ymd)
      });
    }
    return days;
  }, [selectedDate, appointments]);

  const calendarDays = useMemo(() => {
    const year = calMonthDate.getFullYear();
    const month = calMonthDate.getMonth();
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const startDayOfWeek = (firstDayOfMonth.getDay() + 6) % 7;
    const daysInMonth = lastDayOfMonth.getDate();

    const cells = [];
    for (let i = 0; i < startDayOfWeek; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(year, month, d);
      const ymd = toLocalYMD(dateObj);
      const dayVisits = appointments.filter(a => a.date === ymd);
      cells.push({ day: d, ymd, visitsCount: dayVisits.length });
    }
    return cells;
  }, [calMonthDate, appointments]);

  const shiftDate = (daysCount) => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + daysCount);
    setSelectedDate(toLocalYMD(d));
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col md:flex-row font-sans">
      {notification && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border bg-slate-900 text-white border-slate-700 animate-bounce">
          <Check className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-sm font-medium">{notification.msg}</span>
        </div>
      )}

      {/* LEFT SIDEBAR NAVIGATION */}
      <aside className="w-full md:w-64 lg:w-72 bg-slate-950 text-white shadow-xl md:min-h-screen md:sticky md:top-0 md:h-screen flex flex-col justify-between border-b md:border-b-0 md:border-r border-slate-800 z-30 shrink-0">
        <div className="p-4 sm:p-5 space-y-6">
          <div className="flex items-center justify-between">
            <div onClick={() => setActiveTab('dashboard')} className="flex items-center gap-3.5 cursor-pointer group">
              <div className="relative w-11 h-11 rounded-xl bg-gradient-to-br from-sky-500 to-blue-700 flex items-center justify-center shadow-md shadow-sky-500/20 border border-sky-400/30 shrink-0">
                <span className="text-xl font-black text-white tracking-tighter">PP</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-extrabold tracking-tight text-white">PP</span>
                  <span className="text-[11px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded bg-sky-500/20 text-sky-300">
                    Planer Pracy
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">Serwis HVAC</p>
              </div>
            </div>
          </div>

          <nav className="flex md:flex-col gap-1.5 overflow-x-auto md:overflow-visible pb-1 md:pb-0">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition ${
                activeTab === 'dashboard' ? 'bg-sky-600 text-white shadow-md' : 'text-slate-300 hover:bg-slate-900'
              }`}
            >
              <div className="flex items-center gap-3">
                <LayoutDashboard className="w-4 h-4 shrink-0" />
                <span>Pulpit (Start)</span>
              </div>
              {stats.urgentTotal > 0 && (
                <span className="bg-rose-500 text-white text-[11px] font-bold px-2 py-0.5 rounded-full">{stats.urgentTotal}</span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('clients')}
              className={`w-full flex items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition ${
                activeTab === 'clients' ? 'bg-sky-600 text-white shadow-md' : 'text-slate-300 hover:bg-slate-900'
              }`}
            >
              <div className="flex items-center gap-3">
                <Users className="w-4 h-4 shrink-0" />
                <span>Klienci</span>
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">{stats.totalClients}</span>
            </button>

            <button
              onClick={() => setActiveTab('devices_db')}
              className={`w-full flex items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition ${
                activeTab === 'devices_db' ? 'bg-sky-600 text-white shadow-md' : 'text-slate-300 hover:bg-slate-900'
              }`}
            >
              <div className="flex items-center gap-3">
                <Wrench className="w-4 h-4 shrink-0" />
                <span>Baza Urządzeń</span>
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">{deviceCatalog.length}</span>
            </button>

            <button
              onClick={() => setActiveTab('map')}
              className={`w-full flex items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition ${
                activeTab === 'map' ? 'bg-sky-600 text-white shadow-md' : 'text-slate-300 hover:bg-slate-900'
              }`}
            >
              <div className="flex items-center gap-3">
                <MapIcon className="w-4 h-4 shrink-0" />
                <span>Mapa Klientów</span>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('planner')}
              className={`w-full flex items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition ${
                activeTab === 'planner' ? 'bg-sky-600 text-white shadow-md' : 'text-slate-300 hover:bg-slate-900'
              }`}
            >
              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 shrink-0" />
                <span>Planer i Trasa</span>
              </div>
              {stats.todayVisitsCount > 0 && (
                <span className="bg-amber-400 text-slate-950 text-[11px] font-extrabold px-2 py-0.5 rounded-full">{stats.todayVisitsCount}</span>
              )}
            </button>
          </nav>
        </div>

        <div className="hidden md:block p-4 m-4 rounded-2xl bg-slate-900 border border-slate-800 text-xs space-y-2">
          <div className="flex justify-between text-slate-400">
            <span>Urządzenia:</span>
            <span className="font-bold text-white">{stats.totalDevices} szt.</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Pilne przeglądy:</span>
            <span className="font-bold text-amber-400">{stats.urgentTotal} urz.</span>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 py-3.5 sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-base sm:text-lg font-extrabold text-slate-900">
              {activeTab === 'dashboard' && 'Pulpit główny'}
              {activeTab === 'clients' && `Baza Klientów (${stats.totalClients})`}
              {activeTab === 'devices_db' && `Baza Urządzeń HVAC (${deviceCatalog.length})`}
              {activeTab === 'map' && 'Interaktywna Mapa Klientów'}
              {activeTab === 'planner' && 'Planer Dnia, Tygodnia i Trasa Google Maps'}
            </h1>
            <p className="text-xs text-slate-500">Dzisiaj: {formatDatePL(todayYMD)}</p>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={() => openScheduleModal()}
              className="bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5"
            >
              <Calendar className="w-4 h-4 text-sky-600" />
              <span>Zaplanuj wizytę</span>
            </button>
            <button
              onClick={() => openAddDeviceModal()}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm"
            >
              <Wrench className="w-4 h-4" />
              <span>+ Dodaj urządzenie</span>
            </button>
            <button
              onClick={openAddClientModal}
              className="bg-sky-600 hover:bg-sky-500 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Dodaj klienta</span>
            </button>
          </div>
        </header>

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* DASHBOARD TAB */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {clientsWithStatus.length === 0 && !loading && (
                <div className="bg-white rounded-2xl p-8 text-center border border-slate-200 shadow-sm">
                  <Wrench className="w-12 h-12 text-sky-600 mx-auto mb-3" />
                  <h2 className="text-xl font-bold text-slate-900">Witaj w PP — Planer Pracy!</h2>
                  <p className="text-sm text-slate-600 max-w-lg mx-auto mt-1 mb-5">
                    Twoja baza jest pusta. Możesz dodać pierwszego klienta lub wgrać dane przykładowe.
                  </p>
                  <button
                    onClick={handleSeedSampleData}
                    disabled={seeding}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-sm"
                  >
                    {seeding ? 'Wgrywanie...' : 'Wczytaj przykładową bazę'}
                  </button>
                </div>
              )}

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div onClick={() => setActiveTab('planner')} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm cursor-pointer hover:border-sky-400">
                  <span className="text-xs font-bold uppercase text-slate-400">Plan na dzisiaj</span>
                  <div className="text-2xl font-extrabold text-slate-900 mt-1">{todayVisits.length} wizyt</div>
                </div>
                <div onClick={() => { setInspectionFilter('overdue'); setActiveTab('clients'); }} className="bg-white p-4 rounded-2xl border border-rose-200 shadow-sm cursor-pointer">
                  <span className="text-xs font-bold uppercase text-rose-500">Przeglądy po terminie</span>
                  <div className="text-2xl font-extrabold text-rose-600 mt-1">{stats.overdueCount} urz.</div>
                </div>
                <div onClick={() => { setInspectionFilter('soon'); setActiveTab('clients'); }} className="bg-white p-4 rounded-2xl border border-amber-200 shadow-sm cursor-pointer">
                  <span className="text-xs font-bold uppercase text-amber-600">Kończące się (30 dni)</span>
                  <div className="text-2xl font-extrabold text-amber-600 mt-1">{stats.soonCount} urz.</div>
                </div>
                <div onClick={() => { setInspectionFilter('all'); setActiveTab('clients'); }} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm cursor-pointer">
                  <span className="text-xs font-bold uppercase text-slate-400">Wszyscy Klienci</span>
                  <div className="text-2xl font-extrabold text-slate-900 mt-1">{stats.totalClients}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-7 space-y-6">
                  {/* TODAY VISITS */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 bg-slate-900 text-white flex justify-between items-center">
                      <h2 className="text-base font-bold">Plan pracy na dzisiaj ({formatDatePL(todayYMD)})</h2>
                      {getPendingVisitsForRoute(todayVisits).length > 0 && (
                        <button
                          onClick={() => handleOpenGoogleMapsRoute(todayVisits)}
                          className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs px-3 py-2 rounded-xl flex items-center gap-1.5 shadow"
                        >
                          <Navigation className="w-3.5 h-3.5" /> Trasa Google Maps ({getPendingVisitsForRoute(todayVisits).length})
                        </button>
                      )}
                    </div>
                    <div className="p-4">
                      {todayVisits.length === 0 ? (
                        <p className="text-center py-6 text-sm text-slate-500">Brak zaplanowanych wyjazdów na dzisiaj.</p>
                      ) : (
                        <div className="space-y-2.5">
                          {todayVisits.map((visit, idx) => {
                            const client = clientsWithStatus.find(c => c.id === visit.clientId);
                            return (
                              <div key={visit.id} className="p-3.5 rounded-xl border bg-slate-50 flex justify-between items-center gap-3">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-extrabold text-sky-700 bg-sky-100 px-2 py-0.5 rounded">{visit.time}</span>
                                    <span className="font-bold text-sm text-slate-900">{client?.name || 'Klient'}</span>
                                    <span className="text-[11px] font-semibold bg-slate-200 px-2 py-0.5 rounded">{visit.serviceType}</span>
                                  </div>
                                  {client && <div className="text-xs text-slate-600 mt-1">📍 {client.city}, {client.street} • 📞 {client.phone}</div>}
                                </div>
                                <button
                                  onClick={() => toggleVisitStatus(visit)}
                                  className={`px-3 py-1.5 rounded-xl text-xs font-bold ${visit.status === 'completed' ? 'bg-emerald-600 text-white' : 'bg-white border text-slate-700'}`}
                                >
                                  {visit.status === 'completed' ? 'Wykonano' : 'Oznacz'}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* URGENT INSPECTIONS */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b bg-amber-50/70 flex justify-between items-center">
                      <h2 className="text-base font-bold text-slate-900">Kończące się terminy przeglądów i gwarancji</h2>
                      {urgentDeviceItems.length > 5 && (
                        <button onClick={() => setShowAllUrgent(prev => !prev)} className="px-3 py-1 bg-white border rounded-xl text-xs font-bold">
                          {showAllUrgent ? 'Zwiń do 5' : `Rozwiń pełną listę (${urgentDeviceItems.length})`}
                        </button>
                      )}
                    </div>
                    <div className="divide-y divide-slate-100">
                      {urgentDeviceItems.length === 0 ? (
                        <div className="p-6 text-center text-sm text-slate-500">Wszystkie urządzenia mają aktualne przeglądy!</div>
                      ) : (
                        (showAllUrgent ? urgentDeviceItems : urgentDeviceItems.slice(0, 5)).map(({ client, device, statusInfo: st }) => (
                          <div key={`${client.id}_${device.id}`} className="p-4 hover:bg-slate-50 space-y-2">
                            <div className="flex justify-between items-center">
                              <div>
                                <span className="font-bold text-sm text-slate-900">{client.name}</span>
                                <span className="text-xs ml-2 font-semibold text-slate-600">({device.deviceModel})</span>
                                <div className="text-xs text-rose-600 font-semibold mt-0.5">
                                  {st.isInspectionOverdue ? `Po terminie o ${Math.abs(st.daysToInspection)} dni` : `Przegląd za ${st.daysToInspection} dni`}
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <button onClick={() => openInspectionModal(client, device.id)} className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-bold">
                                  Wbij przegląd
                                </button>
                                <button onClick={() => handleSkipCurrentInspection(client, device.id)} className="px-3 py-1.5 bg-amber-100 text-amber-900 rounded-xl text-xs font-bold">
                                  Przesuń (+1 rok)
                                </button>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-5 space-y-6">
                  {/* CALENDAR */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="text-base font-bold text-slate-900">Kalendarz</h2>
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => setCalMonthDate(new Date(calMonthDate.getFullYear(), calMonthDate.getMonth() - 1, 1))} className="p-1.5 border rounded-lg"><ChevronLeft className="w-4 h-4" /></button>
                        <span className="text-xs font-bold uppercase">{calMonthDate.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' })}</span>
                        <button onClick={() => setCalMonthDate(new Date(calMonthDate.getFullYear(), calMonthDate.getMonth() + 1, 1))} className="p-1.5 border rounded-lg"><ChevronRight className="w-4 h-4" /></button>
                      </div>
                    </div>
                    <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-slate-400 pb-2">
                      <div>Pon</div><div>Wt</div><div>Śr</div><div>Czw</div><div>Pt</div><div>Sob</div><div>Ndz</div>
                    </div>
                    <div className="grid grid-cols-7 gap-1.5">
                      {calendarDays.map((cell, i) => {
                        if (!cell) return <div key={`e-${i}`} className="h-14 bg-slate-50 rounded-xl" />;
                        return (
                          <button
                            key={cell.ymd}
                            onClick={() => { setSelectedDate(cell.ymd); setActiveTab('planner'); }}
                            className={`h-14 rounded-xl p-1.5 flex flex-col justify-between items-center border text-left ${cell.ymd === todayYMD ? 'bg-sky-50 border-sky-400 font-bold' : 'bg-white border-slate-200'}`}
                          >
                            <span className="text-xs font-bold">{cell.day}</span>
                            {cell.visitsCount > 0 && <span className="px-1.5 rounded-full text-[10px] bg-sky-600 text-white font-extrabold">{cell.visitsCount}</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* CLIENTS TAB */}
          {activeTab === 'clients' && (
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col xl:flex-row gap-3 justify-between items-center">
                <div className="relative flex-1 w-full">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Szukaj klienta..."
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
                  <select value={deviceFilter} onChange={(e) => setDeviceFilter(e.target.value)} className="bg-slate-50 border rounded-xl px-3 py-2 text-xs font-medium">
                    <option value="all">Wszystkie urządzenia</option>
                    <option value="heat_pump">🔥 Pompy ciepła</option>
                    <option value="ac">❄️ Klimatyzacja</option>
                    <option value="ventilation">💨 Wentylacja</option>
                  </select>
                  <button onClick={handleExportClientsToExcelCSV} className="bg-emerald-600 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5">
                    <FileSpreadsheet className="w-4 h-4" /> Eksport CSV
                  </button>
                  <input ref={csvInputRef} type="file" accept=".csv,text/csv" onChange={handleImportClientsFromExcelCSV} className="hidden" />
                  <button onClick={() => csvInputRef.current?.click()} className="bg-slate-100 border text-slate-700 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5">
                    <Upload className="w-4 h-4" /> Import CSV
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-slate-200 text-[11px] uppercase tracking-wider font-bold">
                      <th className="py-3 px-4">Klient</th>
                      <th className="py-3 px-4">Adres</th>
                      <th className="py-3 px-4">Telefon</th>
                      <th className="py-3 px-4">Urządzenia klienta (Terminy i Gwarancje)</th>
                      <th className="py-3 px-4 text-right">Akcje</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs sm:text-sm">
                    {filteredClients.length === 0 ? (
                      <tr><td colSpan={5} className="py-10 text-center text-slate-500">Brak klientów.</td></tr>
                    ) : (
                      filteredClients.map((client) => (
                        <tr key={client.id} className="hover:bg-sky-50/40 transition">
                          <td className="py-3 px-4 font-bold text-slate-900">
                            {client.name} {client.devices.length > 1 && <span className="ml-1 text-[11px] bg-slate-900 text-white px-2 py-0.5 rounded-full">{client.devices.length} urz.</span>}
                          </td>
                          <td className="py-3 px-4 text-slate-600">{client.city}, {client.street}</td>
                          <td className="py-3 px-4"><a href={`tel:${client.phone}`} className="text-sky-600 font-semibold">{client.phone}</a></td>
                          <td className="py-2.5 px-4">
                            <div className="flex flex-wrap gap-2">
                              {client.devices.map((dev) => {
                                const dInfo = getDeviceInfo(dev.deviceType);
                                const st = dev.statusInfo;
                                return (
                                  <div
                                    key={dev.id}
                                    onClick={() => openInspectionModal(client, dev.id)}
                                    className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-xl border text-xs cursor-pointer ${dInfo.bg} ${dInfo.border}`}
                                  >
                                    <span className="font-bold text-slate-900">{dev.deviceModel}</span>
                                    {st.isInspectionOverdue ? (
                                      <span className="px-1.5 rounded bg-rose-600 text-white text-[10px] font-bold">Po terminie</span>
                                    ) : st.isInspectionSoon ? (
                                      <span className="px-1.5 rounded bg-amber-500 text-white text-[10px] font-bold">Za {st.daysToInspection}d</span>
                                    ) : (
                                      <span className="px-1.5 rounded bg-white text-emerald-800 border text-[10px]">OK</span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex items-center gap-1">
                              <button onClick={() => openAddDeviceModal(client.id)} className="px-2.5 py-1.5 bg-emerald-50 text-emerald-800 border rounded-lg text-xs font-bold">+ Urz.</button>
                              <button onClick={() => openInspectionModal(client)} className="px-2.5 py-1.5 bg-amber-50 text-amber-800 border rounded-lg text-xs font-bold">Przeglądy</button>
                              <button onClick={() => openEditClientModal(client)} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg"><Edit3 className="w-4 h-4" /></button>
                              <button onClick={() => setDeleteConfirm({ type: 'client', id: client.id, title: client.name })} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* DEVICES CATALOG TAB */}
          {activeTab === 'devices_db' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-4 bg-white rounded-2xl shadow-sm border p-5 space-y-4">
                <h2 className="text-sm font-bold text-slate-900">Dodaj model do Bazy Urządzeń</h2>
                <form onSubmit={handleAddNewCatalogModel} className="space-y-3">
                  <select value={newCatalogItemForm.deviceType} onChange={(e) => setNewCatalogItemForm({ ...newCatalogItemForm, deviceType: e.target.value })} className="w-full px-3 py-2 border rounded-xl text-sm">
                    <option value="heat_pump">🔥 Pompa ciepła</option>
                    <option value="ac">❄️ Klimatyzacja</option>
                    <option value="ventilation">💨 Wentylacja</option>
                  </select>
                  <input type="text" required placeholder="Producent (np. Panasonic)" value={newCatalogItemForm.brand} onChange={(e) => setNewCatalogItemForm({ ...newCatalogItemForm, brand: e.target.value })} className="w-full px-3 py-2 border rounded-xl text-sm" />
                  <input type="text" required placeholder="Model i moc" value={newCatalogItemForm.model} onChange={(e) => setNewCatalogItemForm({ ...newCatalogItemForm, model: e.target.value })} className="w-full px-3 py-2 border rounded-xl text-sm" />
                  <button type="submit" className="w-full bg-emerald-600 text-white font-bold py-2.5 rounded-xl text-sm">+ Dodaj model</button>
                </form>
              </div>

              <div className="lg:col-span-8 bg-white rounded-2xl shadow-sm border overflow-hidden">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-900 text-slate-200 text-[11px] uppercase font-bold">
                      <th className="py-3 px-4">Typ</th>
                      <th className="py-3 px-4">Model</th>
                      <th className="py-3 px-4 text-right">Akcje</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-xs sm:text-sm">
                    {filteredCatalogView.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-bold">{getDeviceInfo(item.deviceType).short}</td>
                        <td className="py-3 px-4">{item.brand} {item.model}</td>
                        <td className="py-3 px-4 text-right">
                          <button onClick={() => openAddDeviceModal('', item)} className="px-3 py-1.5 bg-emerald-50 text-emerald-800 border rounded-xl text-xs font-bold mr-2">+ Przypisz</button>
                          <button onClick={() => setDeleteConfirm({ type: 'catalog_device', id: item.id, title: item.model })} className="text-rose-500"><Trash2 className="w-4 h-4" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* MAP TAB */}
          {activeTab === 'map' && (
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-2xl shadow-sm border flex justify-between items-center">
                <div className="flex gap-2">
                  <button onClick={() => setMapTileStyle('voyager')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${mapTileStyle === 'voyager' ? 'bg-slate-900 text-white' : 'bg-slate-100'}`}>Jasna mapa</button>
                  <button onClick={() => setMapTileStyle('street')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${mapTileStyle === 'street' ? 'bg-slate-900 text-white' : 'bg-slate-100'}`}>Mapa ulic</button>
                  <button onClick={() => setMapTileStyle('satellite')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${mapTileStyle === 'satellite' ? 'bg-slate-900 text-white' : 'bg-slate-100'}`}>Satelita</button>
                </div>
                <button onClick={handleRefreshAndCenterMap} className="px-3 py-1.5 bg-sky-50 text-sky-700 border rounded-xl text-xs font-bold">Wyśrodkuj mapę</button>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border overflow-hidden relative min-h-[560px]">
                <div ref={mapContainerRef} style={{ height: '560px', width: '100%' }} />
              </div>
            </div>
          )}

          {/* PLANNER TAB */}
          {activeTab === 'planner' && (
            <div className="space-y-6">
              <div className="bg-white p-4 rounded-2xl shadow-sm border flex justify-between items-center">
                <div className="flex gap-2">
                  <button onClick={() => setPlannerMode('day')} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${plannerMode === 'day' ? 'bg-sky-600 text-white' : 'bg-slate-100'}`}>Plan Dnia</button>
                  <button onClick={() => setPlannerMode('week')} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${plannerMode === 'week' ? 'bg-sky-600 text-white' : 'bg-slate-100'}`}>Plan Tygodnia</button>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => shiftDate(plannerMode === 'day' ? -1 : -7)} className="p-1.5 border rounded-lg"><ChevronLeft className="w-4 h-4" /></button>
                  <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="bg-slate-50 border px-2 py-1 rounded-lg text-xs font-bold" />
                  <button onClick={() => shiftDate(plannerMode === 'day' ? 1 : 7)} className="p-1.5 border rounded-lg"><ChevronRight className="w-4 h-4" /></button>
                </div>
              </div>

              {plannerMode === 'day' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border p-5 space-y-4">
                    <h2 className="text-base font-bold text-slate-900">Wizyty w dniu {selectedDate}</h2>
                    {selectedDayVisits.length === 0 ? (
                      <p className="text-sm text-slate-500 py-6 text-center">Brak wizyt.</p>
                    ) : (
                      <div className="space-y-3">
                        {selectedDayVisits.map((visit, index) => {
                          const client = clientsWithStatus.find(c => c.id === visit.clientId);
                          return (
                            <div key={visit.id} className="p-4 rounded-xl border bg-slate-50 flex justify-between items-center">
                              <div>
                                <span className="text-xs font-extrabold text-sky-700 bg-sky-100 px-2 py-0.5 rounded">{visit.time}</span>
                                <h3 className="text-sm font-bold text-slate-900 mt-1">{client?.name || 'Klient'}</h3>
                                <p className="text-xs text-slate-600">📍 {client?.city}, {client?.street}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <button onClick={() => toggleVisitStatus(visit)} className={`px-3 py-1.5 rounded-xl text-xs font-bold ${visit.status === 'completed' ? 'bg-emerald-600 text-white' : 'bg-white border'}`}>
                                  {visit.status === 'completed' ? 'Wykonana' : 'Oznacz'}
                                </button>
                                <button onClick={() => setDeleteConfirm({ type: 'visit', id: visit.id, title: 'wizytę' })} className="text-rose-500"><Trash2 className="w-4 h-4" /></button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="bg-slate-900 text-white rounded-2xl shadow-lg p-5 space-y-4">
                    <h3 className="text-base font-bold">Trasa Google Maps</h3>
                    <p className="text-xs text-slate-400">Startuje z Twojej lokalizacji i pomija wykonane wizyty.</p>
                    {getPendingVisitsForRoute(selectedDayVisits).length > 0 ? (
                      <button onClick={() => handleOpenGoogleMapsRoute(selectedDayVisits)} className="w-full bg-emerald-500 text-slate-950 font-extrabold py-3 rounded-xl flex items-center justify-center gap-2">
                        <Navigation className="w-5 h-5" /> Eksportuj trasę ({getPendingVisitsForRoute(selectedDayVisits).length})
                      </button>
                    ) : (
                      <div className="text-xs text-slate-400 text-center py-4">Brak aktywnych punktów trasy.</div>
                    )}
                  </div>
                </div>
              )}

              {plannerMode === 'week' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-3">
                  {weekDays.map((day) => (
                    <div key={day.ymd} className="bg-white rounded-2xl border p-3 space-y-2">
                      <div className="text-xs font-bold text-slate-900 border-b pb-1">{day.label} ({day.shortDate})</div>
                      {day.visits.map(v => (
                        <div key={v.id} className="p-2 bg-slate-50 rounded-lg text-xs flex justify-between items-center">
                          <span>{v.time}</span>
                          <button onClick={() => setDeleteConfirm({ type: 'visit', id: v.id, title: 'wizytę' })} className="text-rose-500"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* INSPECTION MODAL */}
      {inspectionModalClient && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-base font-bold">Przeglądy: {inspectionModalClient.name}</h3>
              <button onClick={() => setInspectionModalClientId(null)}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              {inspectionModalClient.devices.map(dev => (
                <div key={dev.id} className="p-3 bg-slate-50 border rounded-xl space-y-2">
                  <div className="font-bold text-sm">{dev.deviceModel}</div>
                  <div className="flex gap-2">
                    <button onClick={() => { setSelectedDeviceIdForInspection(dev.id); handleRegisterInspection({ preventDefault: () => {} }); }} className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-bold">Wbij przegląd</button>
                    <button onClick={() => handleSkipCurrentInspection(inspectionModalClient, dev.id)} className="px-3 py-1.5 bg-amber-100 text-amber-900 rounded-xl text-xs font-bold">Przesuń (+1 rok)</button>
                    <button onClick={() => handleToggleCancelDeviceReminders(inspectionModalClient, dev.id, !dev.statusInfo.remindersCanceled)} className="px-3 py-1.5 bg-rose-50 text-rose-700 rounded-xl text-xs font-bold">{dev.statusInfo.remindersCanceled ? 'Wznów' : 'Anuluj przypomnienia'}</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* CLIENT MODAL */}
      {isClientModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-base font-bold">{editingClient ? 'Edycja klienta' : 'Nowy klient'}</h3>
              <button onClick={() => setIsClientModalOpen(false)}><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveClient} className="space-y-4">
              <input type="text" required placeholder="Imię i nazwisko" value={clientForm.name} onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })} className="w-full px-3 py-2 border rounded-xl text-sm" />
              <input type="text" required placeholder="Telefon" value={clientForm.phone} onChange={(e) => setClientForm({ ...clientForm, phone: e.target.value })} className="w-full px-3 py-2 border rounded-xl text-sm" />
              <div className="grid grid-cols-2 gap-2">
                <input type="text" required placeholder="Miasto" value={clientForm.city} onChange={(e) => setClientForm({ ...clientForm, city: e.target.value })} className="px-3 py-2 border rounded-xl text-sm" />
                <input type="text" required placeholder="Ulica i nr" value={clientForm.street} onChange={(e) => setClientForm({ ...clientForm, street: e.target.value })} className="px-3 py-2 border rounded-xl text-sm" />
              </div>
              <button type="button" onClick={handleGeocodeAddress} className="bg-sky-600 text-white px-3 py-1.5 rounded-xl text-xs font-bold">Pobierz współrzędne GPS</button>
              <div className="flex justify-end gap-2 pt-3 border-t">
                <button type="button" onClick={() => setIsClientModalOpen(false)} className="px-4 py-2 border rounded-xl text-sm">Anuluj</button>
                <button type="submit" className="px-5 py-2 bg-sky-600 text-white rounded-xl text-sm font-semibold">Zapisz</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SCHEDULE MODAL */}
      {isVisitModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-base font-bold">Zaplanuj wizytę</h3>
              <button onClick={() => setIsVisitModalOpen(false)}><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveVisit} className="space-y-4">
              <input type="text" placeholder="Szukaj klienta..." value={visitClientSearch} onChange={(e) => setVisitClientSearch(e.target.value)} className="w-full px-3 py-2 border rounded-xl text-sm" />
              <select value={visitForm.clientId} onChange={(e) => setVisitForm({ ...visitForm, clientId: e.target.value })} className="w-full px-3 py-2 border rounded-xl text-sm bg-white">
                {searchableClientsForVisit.map(c => <option key={c.id} value={c.id}>{c.name} ({c.city})</option>)}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input type="date" required value={visitForm.date} onChange={(e) => setVisitForm({ ...visitForm, date: e.target.value })} className="px-3 py-2 border rounded-xl text-sm" />
                <input type="time" value={visitForm.time} onChange={(e) => setVisitForm({ ...visitForm, time: e.target.value })} className="px-3 py-2 border rounded-xl text-sm" />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t">
                <button type="submit" className="px-5 py-2 bg-sky-600 text-white rounded-xl text-sm font-semibold">Zaplanuj</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD DEVICE MODAL */}
      {isAddDeviceModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-base font-bold">Przypisz urządzenie do klienta</h3>
              <button onClick={() => setIsAddDeviceModalOpen(false)}><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveAssignedDeviceToClient} className="space-y-4">
              <select value={assignDeviceForm.clientId} onChange={(e) => setAssignDeviceForm({ ...assignDeviceForm, clientId: e.target.value })} className="w-full px-3 py-2 border rounded-xl text-sm bg-white">
                {clientsWithStatus.map(c => <option key={c.id} value={c.id}>{c.name} ({c.city})</option>)}
              </select>
              <input type="text" required placeholder="Model urządzenia" value={assignDeviceForm.deviceModel} onChange={(e) => setAssignDeviceForm({ ...assignDeviceForm, deviceModel: e.target.value })} className="w-full px-3 py-2 border rounded-xl text-sm" />
              <div className="flex justify-end gap-2 pt-3 border-t">
                <button type="submit" className="px-5 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold">Przypisz</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold">Potwierdź usunięcie</h3>
            <p className="text-sm text-slate-600">Czy na pewno chcesz usunąć {deleteConfirm.title}?</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 border rounded-xl">Anuluj</button>
              <button onClick={confirmDeleteAction} className="px-4 py-2 bg-rose-600 text-white rounded-xl">Usuń</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}