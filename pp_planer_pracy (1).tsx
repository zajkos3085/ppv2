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
  setDoc,
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

// ==========================================
// INICJALIZACJA FIREBASE (Z TRYBEM OFFLINE / LOCALSTORAGE DLA GITHUB)
// ==========================================
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

// ==========================================
// FUNKCJE POMOCNICZE DAT I URZĄDZEŃ
// ==========================================
const toLocalYMD = (dateObj) => {
  const d = dateObj instanceof Date ? dateObj : new Date(dateObj);
  if (isNaN(d.getTime())) return '2025-01-01';
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
      const install = dev.installDate || client.installDate || '2024-05-10';
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

  const install = client?.installDate || '2024-05-10';
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

  const installDate = new Date((device.installDate || '2024-01-01') + 'T12:00:00');
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
    deviceType: 'ac',
    brand: 'Daikin',
    model: 'Stylish Multi 2x2.5kW',
    defaultWarrantyMonths: 36,
    defaultIntervalMonths: 12
  },
  {
    id: 'cat_7',
    deviceType: 'ventilation',
    brand: 'Zehnder',
    model: 'ComfoAir Q350 TR',
    defaultWarrantyMonths: 24,
    defaultIntervalMonths: 12
  },
  {
    id: 'cat_8',
    deviceType: 'ventilation',
    brand: 'Thessla Green',
    model: 'AirPack4 400v Enthalpy',
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
      notes: 'Kod do bramy #1234. Pompa ciepła w kotłowni + klimatyzacja w salonie.',
      devices: [
        {
          id: 'dev_jk_1',
          deviceType: 'heat_pump',
          deviceModel: 'Panasonic Aquarea T-CAP 9kW',
          installDate: '2023-10-15',
          warrantyMonths: 60,
          lastInspectionDate: '2024-10-15',
          nextInspectionDate: fmt(11),
          inspectionIntervalMonths: 12,
          remindersCanceled: false,
          inspectionHistory: [
            { id: 'h1', date: '2024-10-15', technician: 'Marek Serwis', notes: 'Czyszczenie filtrów magnetycznych, kontrola ciśnienia.' }
          ]
        },
        {
          id: 'dev_jk_2',
          deviceType: 'ac',
          deviceModel: 'Gree Amber Prestige 3.5kW',
          installDate: '2024-05-20',
          warrantyMonths: 60,
          lastInspectionDate: '2024-05-20',
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
          installDate: '2023-04-10',
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
      notes: 'Rekuperator na poddaszu użytkowym, wymiana filtrów G4/F7.',
      devices: [
        {
          id: 'dev_pw_1',
          deviceType: 'ventilation',
          deviceModel: 'Zehnder ComfoAir Q350',
          installDate: '2023-11-01',
          warrantyMonths: 24,
          lastInspectionDate: '2024-11-01',
          nextInspectionDate: fmt(20),
          inspectionIntervalMonths: 12,
          remindersCanceled: false,
          inspectionHistory: []
        },
        {
          id: 'dev_pw_2',
          deviceType: 'heat_pump',
          deviceModel: 'Vaillant aroTHERM plus 10kW',
          installDate: '2023-11-01',
          warrantyMonths: 60,
          lastInspectionDate: '2024-11-01',
          nextInspectionDate: fmt(24),
          inspectionIntervalMonths: 12,
          remindersCanceled: false,
          inspectionHistory: []
        }
      ]
    },
    {
      name: 'Karolina Wójcik',
      phone: '+48 790 114 223',
      city: 'Tarnowo Podgórne',
      postalCode: '62-080',
      street: 'ul. Polna 3',
      lat: 52.4642,
      lng: 16.6615,
      notes: 'Duży pies na posesji.',
      devices: [
        {
          id: 'dev_kw_1',
          deviceType: 'heat_pump',
          deviceModel: 'Daikin Altherma 3 R 8kW',
          installDate: '2022-09-12',
          warrantyMonths: 60,
          lastInspectionDate: '2023-09-12',
          nextInspectionDate: fmt(-18),
          inspectionIntervalMonths: 12,
          remindersCanceled: false,
          inspectionHistory: []
        },
        {
          id: 'dev_kw_2',
          deviceType: 'ac',
          deviceModel: 'Daikin Stylish Multi 2x2.5kW',
          installDate: '2023-06-15',
          warrantyMonths: 36,
          lastInspectionDate: '2024-06-15',
          nextInspectionDate: fmt(5),
          inspectionIntervalMonths: 12,
          remindersCanceled: false,
          inspectionHistory: []
        }
      ]
    },
    {
      name: 'Marek Zieliński',
      phone: '+48 511 990 445',
      city: 'Grodzisk Wielkopolski',
      postalCode: '62-065',
      street: 'ul. Ogrodowa 19',
      lat: 52.2275,
      lng: 16.3652,
      notes: 'Układ multi-split 3 jednostki wewnętrzne.',
      devices: [
        {
          id: 'dev_mz_1',
          deviceType: 'ac',
          deviceModel: 'Mitsubishi Electric Diamond 5.0kW',
          installDate: '2024-03-01',
          warrantyMonths: 60,
          lastInspectionDate: '2024-03-01',
          nextInspectionDate: fmt(14),
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
  const [companyBaseAddress, setCompanyBaseAddress] = useState("Poznań, ul. Głogowska 10");
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  // Nawigacja ('dashboard' | 'clients' | 'devices_db' | 'map' | 'planner')
  const [activeTab, setActiveTab] = useState('dashboard');
  const [notification, setNotification] = useState(null);

  // Rozwijanie pełnej listy kończących się terminów na Pulpicie (domyślnie pokazuje 5)
  const [showAllUrgent, setShowAllUrgent] = useState(false);

  // Kalendarz na Pulpicie
  const [calMonthDate, setCalMonthDate] = useState(() => new Date());

  // Filtry w zakładce Klienci
  const [searchQuery, setSearchQuery] = useState('');
  const [deviceFilter, setDeviceFilter] = useState('all');
  const [inspectionFilter, setInspectionFilter] = useState('all');

  // Filtry i formularz w zakładce Baza Urządzeń (Katalog modeli)
  const [catalogSearchQuery, setCatalogSearchQuery] = useState('');
  const [catalogTypeFilter, setCatalogTypeFilter] = useState('all');
  const [newCatalogItemForm, setNewCatalogItemForm] = useState({
    deviceType: 'heat_pump',
    brand: '',
    model: '',
    defaultWarrantyMonths: 60,
    defaultIntervalMonths: 12
  });

  // Modal "Dodaj urządzenie" (w prawym górnym rogu) z rozwijanymi listami z wyszukiwaniem
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

  // Stan dla Mapy (Domyślnie: Mapa ulic - 'street')
  const [mapPinColorMode, setMapPinColorMode] = useState('inspection');
  const [mapTileStyle, setMapTileStyle] = useState('street');
  const [selectedMapClient, setSelectedMapClient] = useState(null);
  const [leafletReady, setLeafletReady] = useState(false);
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const tileLayerRef = useRef(null);
  const markersLayerRef = useRef(null);
  const csvInputRef = useRef(null);

  // Stan dla Planera (Dzień / Tydzień)
  const [plannerMode, setPlannerMode] = useState('day');
  const [selectedDate, setSelectedDate] = useState(() => toLocalYMD(new Date()));

  // Modale i formularze Klienta
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

  // Modal Przeglądów Urządzeń
  const [inspectionModalClientId, setInspectionModalClientId] = useState(null);
  const [selectedDeviceIdForInspection, setSelectedDeviceIdForInspection] = useState(null);
  const [newInspectionForm, setNewInspectionForm] = useState({
    date: toLocalYMD(new Date()),
    nextDate: addMonthsToYMD(toLocalYMD(new Date()), 12),
    technician: 'Serwis PP',
    notes: ''
  });

  // Modal Planowania Wizyty
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

  // Potwierdzenie usunięcia
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const showToast = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => {
      setNotification((prev) => (prev?.msg === msg ? null : prev));
    }, 3500);
  };

  // 1. Autoryzacja Firebase lub uruchomienie w trybie samodzielnym (GitHub / LocalStorage)
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
        console.error("Błąd autoryzacji Firebase, przełączam na tryb lokalny:", err);
        setUser({ uid: 'local-github-user', isLocal: true });
      }
    };
    initAuth();
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) setUser(u);
    });
    return () => unsub();
  }, []);

  // Funkcje pomocnicze do zapisu lokalnego (gdy aplikacja działa na GitHub Pages bez podpiętego Firebase)
  const saveLocalClients = (nextClients) => {
    setClients(nextClients);
    try {
      localStorage.setItem(LS_KEYS.CLIENTS, JSON.stringify(nextClients));
    } catch (e) {
      console.error("Błąd zapisu klientów w localStorage:", e);
    }
  };

  const saveLocalAppointments = (nextAppointments) => {
    setAppointments(nextAppointments);
    try {
      localStorage.setItem(LS_KEYS.APPOINTMENTS, JSON.stringify(nextAppointments));
    } catch (e) {
      console.error("Błąd zapisu wizyt w localStorage:", e);
    }
  };

  const saveLocalCatalog = (nextCatalog) => {
    setDeviceCatalog(nextCatalog);
    try {
      localStorage.setItem(LS_KEYS.CATALOG, JSON.stringify(nextCatalog));
    } catch (e) {
      console.error("Błąd zapisu katalogu w localStorage:", e);
    }
  };

  // 2. Subskrypcja danych z Firestore lub odczyt z LocalStorage (na GitHubie)
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
      } catch (err) {
        console.error("Błąd odczytu danych lokalnych:", err);
      }
      setLoading(false);
      return;
    }

    const clientsRef = collection(db, 'artifacts', appId, 'public', 'data', 'clients');
    const appointmentsRef = collection(db, 'artifacts', appId, 'public', 'data', 'appointments');
    const catalogRef = collection(db, 'artifacts', appId, 'public', 'data', 'device_catalog');
    const settingsDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'general');

    const unsubClients = onSnapshot(
      clientsRef,
      (snapshot) => {
        const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        setClients(list);
        setLoading(false);
      },
      (err) => {
        console.error("Błąd odczytu klientów:", err);
        setLoading(false);
      }
    );

    const unsubAppointments = onSnapshot(
      appointmentsRef,
      (snapshot) => {
        const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        setAppointments(list);
      },
      (err) => console.error("Błąd odczytu harmonogramu:", err)
    );

    const unsubCatalog = onSnapshot(
      catalogRef,
      async (snapshot) => {
        if (snapshot.empty) {
          try {
            const initialItems = getInitialCatalogDevices();
            for (const item of initialItems) {
              const { id, ...rest } = item;
              await addDoc(catalogRef, {
                ...rest,
                createdAt: new Date().toISOString()
              });
            }
          } catch (e) {
            console.error("Błąd inicjalizacji bazy urządzeń:", e);
          }
        } else {
          const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
          setDeviceCatalog(list);
        }
      },
      (err) => console.error("Błąd odczytu katalogu urządzeń:", err)
    );

    const unsubSettings = onSnapshot(
      settingsDocRef,
      (docSnap) => {
        if (docSnap.exists() && docSnap.data().baseAddress !== undefined) {
          setCompanyBaseAddress(docSnap.data().baseAddress);
        }
      },
      (err) => console.error("Błąd odczytu ustawień:", err)
    );

    return () => {
      unsubClients();
      unsubAppointments();
      unsubCatalog();
      unsubSettings();
    };
  }, [user]);

  // Przetworzona lista klientów z urządzeniami i obliczonymi statusami
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

  // Aktualnie otwarty klient w modalu przeglądów
  const inspectionModalClient = useMemo(() => {
    if (!inspectionModalClientId) return null;
    return clientsWithStatus.find(c => c.id === inspectionModalClientId) || null;
  }, [clientsWithStatus, inspectionModalClientId]);

  // Wszystkie urządzenia wymagające pilnego przeglądu (po terminie lub <= 30 dni)
  const urgentDeviceItems = useMemo(() => {
    const items = [];
    clientsWithStatus.forEach(client => {
      client.devices.forEach(device => {
        const st = device.statusInfo;
        if (!st.remindersCanceled && (st.isInspectionOverdue || st.isInspectionSoon)) {
          items.push({
            client,
            device,
            statusInfo: st
          });
        }
      });
    });
    return items.sort((a, b) => a.statusInfo.daysToInspection - b.statusInfo.daysToInspection);
  }, [clientsWithStatus]);

  // Filtrowana lista klientów w zakładce Klienci
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

  // Statystyki
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

  // 3. Ładowanie biblioteki Leaflet
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
        .leaflet-container img.leaflet-tile {
          max-width: none !important;
          max-height: none !important;
        }
        .leaflet-container {
          font-family: inherit;
          z-index: 10;
          background-color: #e2e8f0;
        }
      `;
      document.head.appendChild(style);
    }

    const existingScript = document.getElementById('leaflet-js');
    if (existingScript) {
      existingScript.addEventListener('load', () => setLeafletReady(true));
      return;
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
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ, USGS'
      };
    }
    if (styleKey === 'satellite') {
      return {
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, GeoEye, Earthstar Geographics'
      };
    }
    return {
      url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
    };
  };

  // 4. Inicjalizacja i aktualizacja mapy
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

    const timer1 = setTimeout(() => map.invalidateSize(), 100);
    const timer2 = setTimeout(() => map.invalidateSize(), 400);

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
        pinColor = client.anyOverdue
          ? '#e11d48'
          : client.anySoon
          ? '#d97706'
          : '#10b981';
      } else if (mapPinColorMode === 'warranty') {
        pinColor = client.anyUnderWarranty ? '#10b981' : '#ef4444';
      }

      const countBadge = client.devices.length > 1
        ? `<div style="position:absolute;top:-5px;right:-5px;background:#0f172a;color:#fff;font-size:10px;font-weight:800;width:18px;height:18px;border-radius:9999px;display:flex;align-items:center;justify-content:center;border:1.5px solid #fff;">${client.devices.length}</div>`
        : '';

      const svgHtml = `
        <div style="
          position: relative;
          background-color: ${pinColor};
          width: 34px;
          height: 34px;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          border: 3px solid #ffffff;
          box-shadow: 0 4px 10px rgba(0,0,0,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <div style="
            width: 10px;
            height: 10px;
            background: #ffffff;
            border-radius: 50%;
            transform: rotate(45deg);
          "></div>
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
      marker.on('click', () => {
        setSelectedMapClient(client);
      });

      marker.bindTooltip(
        `<strong>${client.name}</strong> (${client.devices.length} urz.)<br/>${client.city}, ${client.street}`,
        { direction: 'top', offset: [0, -28] }
      );

      markersLayer.addLayer(marker);
    });

    if (bounds.length > 0 && !selectedMapClient) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
    }

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [activeTab, leafletReady, clientsWithStatus, mapPinColorMode, mapTileStyle]);

  useEffect(() => {
    if (activeTab !== 'map') {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        tileLayerRef.current = null;
        markersLayerRef.current = null;
      }
    }
  }, [activeTab]);

  const handleRefreshAndCenterMap = () => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.invalidateSize();
    const validCoords = clientsWithStatus
      .filter(c => !isNaN(parseFloat(c.lat)) && !isNaN(parseFloat(c.lng)))
      .map(c => [parseFloat(c.lat), parseFloat(c.lng)]);
    if (validCoords.length > 0) {
      mapInstanceRef.current.fitBounds(validCoords, { padding: [50, 50], maxZoom: 12 });
    } else {
      mapInstanceRef.current.setView([52.237049, 19.017532], 6);
    }
    showToast("Mapa została odświeżona i wyśrodkowana.");
  };

  // ==========================================
  // WGRAWANIE DANYCH PRZYKŁADOWYCH
  // ==========================================
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

        if (createdClients.length >= 3) {
          const sampleVisits = [
            {
              id: `local_visit_${Date.now()}_1`,
              clientId: createdClients[0].id,
              deviceId: createdClients[0].devices[0].id,
              date: todayStr,
              time: '08:30',
              serviceType: 'Przegląd okresowy / Gwarancyjny',
              notes: 'Przegląd roczny pompy ciepła Panasonic + czyszczenie filtrów.',
              status: 'planned',
              order: 1,
              createdAt: new Date().toISOString()
            },
            {
              id: `local_visit_${Date.now()}_2`,
              clientId: createdClients[1].id,
              deviceId: createdClients[1].devices[0].id,
              date: todayStr,
              time: '11:30',
              serviceType: 'Przegląd okresowy / Gwarancyjny',
              notes: 'Odgrzybianie parownika klimatyzacji i kontrola ciśnienia.',
              status: 'planned',
              order: 2,
              createdAt: new Date().toISOString()
            },
            {
              id: `local_visit_${Date.now()}_3`,
              clientId: createdClients[2].id,
              deviceId: createdClients[2].devices[0].id,
              date: todayStr,
              time: '14:00',
              serviceType: 'Przegląd okresowy / Gwarancyjny',
              notes: 'Wymiana kompletu filtrów w rekuperatorze Zehnder.',
              status: 'planned',
              order: 3,
              createdAt: new Date().toISOString()
            }
          ];
          saveLocalAppointments(sampleVisits);
        }
        showToast("Wgrano przykładową bazę klientów oraz dzisiejszy plan!");
        return;
      }

      const clientsRef = collection(db, 'artifacts', appId, 'public', 'data', 'clients');
      const appointmentsRef = collection(db, 'artifacts', appId, 'public', 'data', 'appointments');
      const createdIds = [];

      for (const item of sampleList) {
        const docRef = await addDoc(clientsRef, {
          ...item,
          createdAt: new Date().toISOString()
        });
        createdIds.push({ id: docRef.id, ...item });
      }

      if (createdIds.length >= 3) {
        await addDoc(appointmentsRef, {
          clientId: createdIds[0].id,
          deviceId: createdIds[0].devices[0].id,
          date: todayStr,
          time: '08:30',
          serviceType: 'Przegląd okresowy / Gwarancyjny',
          notes: 'Przegląd roczny pompy ciepła Panasonic + czyszczenie filtrów.',
          status: 'planned',
          order: 1,
          createdAt: new Date().toISOString()
        });
        await addDoc(appointmentsRef, {
          clientId: createdIds[1].id,
          deviceId: createdIds[1].devices[0].id,
          date: todayStr,
          time: '11:30',
          serviceType: 'Przegląd okresowy / Gwarancyjny',
          notes: 'Odgrzybianie parownika klimatyzacji i kontrola ciśnienia.',
          status: 'planned',
          order: 2,
          createdAt: new Date().toISOString()
        });
        await addDoc(appointmentsRef, {
          clientId: createdIds[2].id,
          deviceId: createdIds[2].devices[0].id,
          date: todayStr,
          time: '14:00',
          serviceType: 'Przegląd okresowy / Gwarancyjny',
          notes: 'Wymiana kompletu filtrów w rekuperatorze Zehnder.',
          status: 'planned',
          order: 3,
          createdAt: new Date().toISOString()
        });
      }

      showToast("Wgrano przykładową bazę klientów (z wieloma urządzeniami) oraz dzisiejszy plan!");
    } catch (error) {
      console.error("Błąd wgrywania danych:", error);
      showToast("Nie udało się wgrać danych przykładowych.", "error");
    } finally {
      setSeeding(false);
    }
  };

  // ==========================================
  // GEOKODOWANIE ADRESU (OpenStreetMap Nominatim)
  // ==========================================
  const handleGeocodeAddress = async () => {
    const query = `${clientForm.street}, ${clientForm.postalCode} ${clientForm.city}, Polska`.trim();
    if (!clientForm.city && !clientForm.street) {
      showToast("Wpisz przynajmniej miasto i ulicę przed pobraniem współrzędnych.", "error");
      return;
    }

    setGeocodingLoading(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
      const res = await fetch(url, { headers: { 'Accept-Language': 'pl' } });
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setClientForm((prev) => ({
          ...prev,
          lat: parseFloat(parseFloat(data[0].lat).toFixed(5)),
          lng: parseFloat(parseFloat(data[0].lon).toFixed(5))
        }));
        showToast("Pobrano współrzędne GPS dla podanego adresu!");
      } else {
        showToast("Nie znaleziono dokładnych współrzędnych dla tego adresu.", "error");
      }
    } catch (err) {
      console.error("Błąd geokodowania:", err);
      showToast("Nie udało się połączyć z usługą geokodowania.", "error");
    } finally {
      setGeocodingLoading(false);
    }
  };

  // ==========================================
  // DODAWANIE I EDYCJA KLIENTA (ORAZ WIELE URZĄDZEŃ W FORMULARZU)
  // ==========================================
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
    const normalizedDevs = normalizeClientDevices(client).map((d) => {
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
    setClientForm((prev) => ({
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
    setClientForm((prev) => ({
      ...prev,
      devices: prev.devices.filter((d) => d.id !== devId)
    }));
  };

  const handleUpdateDeviceInForm = (devId, field, value) => {
    setClientForm((prev) => ({
      ...prev,
      devices: prev.devices.map((d) => {
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
      nextInspectionDate:
        dev.nextInspectionDate || addMonthsToYMD(dev.installDate || toLocalYMD(new Date()), 12),
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
          showToast("Dane klienta i jego urządzeń zostały zaktualizowane.");
        } else {
          const newClient = {
            id: `client_${Date.now()}`,
            ...payload,
            createdAt: new Date().toISOString()
          };
          saveLocalClients([...clients, newClient]);
          showToast("Nowy klient został dodany do bazy PP.");
        }
        setIsClientModalOpen(false);
        return;
      }

      if (editingClient) {
        const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'clients', editingClient.id);
        await updateDoc(docRef, payload);
        showToast("Dane klienta i jego urządzeń zostały zaktualizowane.");
      } else {
        const colRef = collection(db, 'artifacts', appId, 'public', 'data', 'clients');
        await addDoc(colRef, {
          ...payload,
          createdAt: new Date().toISOString()
        });
        showToast("Nowy klient został dodany do bazy PP.");
      }
      setIsClientModalOpen(false);
    } catch (error) {
      console.error("Błąd zapisu klienta:", error);
      showToast("Wystąpił błąd podczas zapisywania klienta.", "error");
    }
  };

  // ==========================================
  // OBSŁUGA PRZEGLĄDÓW URZĄDZEŃ + ANULOWANIE BIEŻĄCEGO PRZEGLĄDU / PRZYPOMNIEŃ
  // ==========================================
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
      notes: 'Przegląd okresowy gwarancyjny — czyszczenie, kontrola szczelności i parametrów pracy.'
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
          const { statusInfo, ...cleanOther } = dev;
          return cleanOther;
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
          c.id === inspectionModalClient.id
            ? { ...c, devices: updatedDevices, updatedAt: new Date().toISOString() }
            : c
        );
        saveLocalClients(next);
        showToast("Wbito nowy przegląd urządzenia i wyznaczono kolejny termin!");
        return;
      }

      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'clients', inspectionModalClient.id);
      await updateDoc(docRef, {
        devices: updatedDevices,
        updatedAt: new Date().toISOString()
      });

      showToast("Wbito nowy przegląd urządzenia i wyznaczono kolejny termin!");
    } catch (err) {
      console.error("Błąd rejestracji przeglądu:", err);
      showToast("Nie udało się zapisać przeglądu.", "error");
    }
  };

  // Przycisk 1: "Anuluj aktualny przegląd" — pomija bieżący termin i przesuwa na kolejny rok (+12 mies.)
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
              notes: `Anulowano aktualny przegląd — przesunięto kolejny termin na ${formatDatePL(shiftedNextDate)}.`
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
        showToast("Aktualny przegląd został anulowany (kolejny termin przesunięty o rok).");
        return;
      }

      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'clients', client.id);
      await updateDoc(docRef, {
        devices: updatedDevices,
        updatedAt: new Date().toISOString()
      });

      showToast("Aktualny przegląd został anulowany (kolejny termin przesunięty o rok).");
    } catch (err) {
      console.error("Błąd anulowania aktualnego przeglądu:", err);
      showToast("Nie udało się przesunąć przeglądu.", "error");
    }
  };

  // Przycisk 2: "Anuluj" — całkowicie wyłącza (lub wznawia) przypomnienia z tego urządzenia
  const handleToggleCancelDeviceReminders = async (client, deviceId, cancelState = true) => {
    if (!user || !client) return;
    try {
      const updatedDevices = client.devices.map(dev => {
        const { statusInfo, ...cleanDev } = dev;
        if (dev.id !== deviceId) return cleanDev;
        return {
          ...cleanDev,
          remindersCanceled: Boolean(cancelState)
        };
      });

      if (user.isLocal || !db) {
        const next = clients.map(c =>
          c.id === client.id ? { ...c, devices: updatedDevices, updatedAt: new Date().toISOString() } : c
        );
        saveLocalClients(next);
        showToast(
          cancelState
            ? "Wyłączono przypomnienia o przeglądach dla tego urządzenia."
            : "Przywrócono przypomnienia o przeglądach dla tego urządzenia."
        );
        return;
      }

      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'clients', client.id);
      await updateDoc(docRef, {
        devices: updatedDevices,
        updatedAt: new Date().toISOString()
      });

      showToast(
        cancelState
          ? "Wyłączono przypomnienia o przeglądach dla tego urządzenia."
          : "Przywrócono przypomnienia o przeglądach dla tego urządzenia."
      );
    } catch (err) {
      console.error("Błąd zmiany statusu przypomnień:", err);
      showToast("Nie udało się zmienić ustawień przypomnień.", "error");
    }
  };

  // ==========================================
  // EKSPORT I IMPORT BAZY KLIENTÓW (EXCEL CSV)
  // ==========================================
  const handleExportClientsToExcelCSV = () => {
    if (clientsWithStatus.length === 0) {
      showToast("Baza klientów jest pusta — brak danych do eksportu.", "error");
      return;
    }

    const headers = [
      'Imie i Nazwisko',
      'Telefon',
      'Kod pocztowy',
      'Miasto',
      'Ulica i nr',
      'Szerokosc GPS (lat)',
      'Dlugosc GPS (lng)',
      'Typ urzadzenia',
      'Model urzadzenia',
      'Data montazu',
      'Gwarancja (mies.)',
      'Ostatni przeglad',
      'Nastepny przeglad',
      'Przypomnienia aktywne',
      'Notatki'
    ];

    const escapeCell = (val) => {
      const str = String(val ?? '').replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = [];
    clientsWithStatus.forEach((client) => {
      client.devices.forEach((dev) => {
        const devLabel = getDeviceInfo(dev.deviceType).short;
        rows.push(
          [
            client.name,
            client.phone,
            client.postalCode,
            client.city,
            client.street,
            client.lat,
            client.lng,
            devLabel,
            dev.deviceModel,
            dev.installDate,
            dev.warrantyMonths,
            dev.lastInspectionDate,
            dev.nextInspectionDate,
            dev.remindersCanceled ? 'NIE (Anulowane)' : 'TAK',
            client.notes || ''
          ]
            .map(escapeCell)
            .join(';')
        );
      });
    });

    // Dodajemy BOM (\uFEFF), aby Microsoft Excel w Polsce poprawnie otwierał polskie znaki i kolumny po średniku
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

    showToast("Wyeksportowano bazę klientów do pliku Excel (.csv)!");
  };

  const handleImportClientsFromExcelCSV = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    try {
      const text = await file.text();
      const lines = text
        .replace(/^\uFEFF/, '')
        .split(/\r?\n/)
        .map(l => l.trim())
        .filter(Boolean);

      if (lines.length < 2) {
        showToast("Plik CSV jest pusty lub nie zawiera wierszy danych.", "error");
        return;
      }

      const separator = lines[0].includes(';') ? ';' : ',';
      const parseLine = (line) =>
        line
          .split(separator)
          .map(cell => cell.replace(/^"|"$/g, '').replace(/""/g, '"').trim());

      const groupedByClient = new Map();

      for (let i = 1; i < lines.length; i++) {
        const cols = parseLine(lines[i]);
        if (cols.length < 4) continue;

        const [
          name,
          phone,
          postalCode,
          city,
          street,
          latStr,
          lngStr,
          devTypeStr,
          devModel,
          installDate,
          warrantyMonths,
          lastInspectionDate,
          nextInspectionDate,
          remindersActiveStr,
          notes
        ] = cols;

        if (!name) continue;
        const key = `${name.toLowerCase()}|${(phone || '').toLowerCase()}|${(city || '').toLowerCase()}`;

        let devType = 'heat_pump';
        const lowerType = (devTypeStr || '').toLowerCase();
        if (lowerType.includes('klima') || lowerType === 'ac') devType = 'ac';
        else if (lowerType.includes('went') || lowerType.includes('reku') || lowerType === 'ventilation') devType = 'ventilation';

        const today = toLocalYMD(new Date());
        const inst = installDate && /^\d{4}-\d{2}-\d{2}$/.test(installDate) ? installDate : today;
        const nextI =
          nextInspectionDate && /^\d{4}-\d{2}-\d{2}$/.test(nextInspectionDate)
            ? nextInspectionDate
            : addMonthsToYMD(inst, 12);

        const devObj = {
          id: `dev_imp_${Date.now()}_${i}`,
          deviceType: devType,
          deviceModel: devModel || 'Urządzenie HVAC',
          installDate: inst,
          warrantyMonths: Number(warrantyMonths) || 60,
          lastInspectionDate: lastInspectionDate || inst,
          nextInspectionDate: nextI,
          inspectionIntervalMonths: 12,
          remindersCanceled: (remindersActiveStr || '').toUpperCase().includes('NIE'),
          inspectionHistory: []
        };

        if (!groupedByClient.has(key)) {
          groupedByClient.set(key, {
            name,
            phone: phone || '',
            postalCode: postalCode || '',
            city: city || 'Poznań',
            street: street || '',
            lat: !isNaN(parseFloat(latStr)) ? parseFloat(latStr) : 52.4064,
            lng: !isNaN(parseFloat(lngStr)) ? parseFloat(lngStr) : 16.9252,
            notes: notes || '',
            devices: [devObj]
          });
        } else {
          groupedByClient.get(key).devices.push(devObj);
        }
      }

      if (user.isLocal || !db) {
        const importedList = Array.from(groupedByClient.values()).map((clientData, idx) => ({
          id: `imp_client_${Date.now()}_${idx}`,
          ...clientData,
          createdAt: new Date().toISOString()
        }));
        saveLocalClients([...clients, ...importedList]);
        showToast(`Zaimportowano ${importedList.length} klientów z pliku Excel (.csv)!`);
        return;
      }

      const clientsRef = collection(db, 'artifacts', appId, 'public', 'data', 'clients');
      let importedCount = 0;
      for (const clientData of groupedByClient.values()) {
        await addDoc(clientsRef, {
          ...clientData,
          createdAt: new Date().toISOString()
        });
        importedCount++;
      }

      showToast(`Zaimportowano ${importedCount} klientów z pliku Excel (.csv)!`);
    } catch (err) {
      console.error("Błąd importu CSV:", err);
      showToast("Nie udało się wczytać pliku CSV.", "error");
    } finally {
      if (csvInputRef.current) csvInputRef.current.value = '';
    }
  };

  // ==========================================
  // USUWANIE KLIENTA / WIZYTY / MODELU KATALOGOWEGO
  // ==========================================
  const confirmDeleteAction = async () => {
    if (!deleteConfirm || !user) return;
    try {
      if (user.isLocal || !db) {
        if (deleteConfirm.type === 'client') {
          saveLocalClients(clients.filter(c => c.id !== deleteConfirm.id));
          saveLocalAppointments(appointments.filter(a => a.clientId !== deleteConfirm.id));
          if (selectedMapClient?.id === deleteConfirm.id) setSelectedMapClient(null);
          showToast("Klient został usunięty z bazy.");
        } else if (deleteConfirm.type === 'visit') {
          saveLocalAppointments(appointments.filter(a => a.id !== deleteConfirm.id));
          showToast("Wizyta została usunięta z harmonogramu.");
        } else if (deleteConfirm.type === 'catalog_device') {
          saveLocalCatalog(deviceCatalog.filter(d => d.id !== deleteConfirm.id));
          showToast("Model urządzenia został usunięty z bazy urządzeń.");
        }
        setDeleteConfirm(null);
        return;
      }

      if (deleteConfirm.type === 'client') {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'clients', deleteConfirm.id));
        const clientVisits = appointments.filter(a => a.clientId === deleteConfirm.id);
        for (const v of clientVisits) {
          await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'appointments', v.id));
        }
        if (selectedMapClient?.id === deleteConfirm.id) {
          setSelectedMapClient(null);
        }
        showToast("Klient został usunięty z bazy.");
      } else if (deleteConfirm.type === 'visit') {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'appointments', deleteConfirm.id));
        showToast("Wizyta została usunięta z harmonogramu.");
      } else if (deleteConfirm.type === 'catalog_device') {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'device_catalog', deleteConfirm.id));
        showToast("Model urządzenia został usunięty z bazy urządzeń.");
      }
    } catch (e) {
      console.error("Błąd usuwania:", e);
      showToast("Wystąpił błąd podczas usuwania.", "error");
    } finally {
      setDeleteConfirm(null);
    }
  };

  // ==========================================
  // OBSŁUGA BAZY URZĄDZEŃ I MODALA "DODAJ URZĄDZENIE"
  // ==========================================
  const openAddDeviceModal = (preselectedClientId = '', preselectedCatalogItem = null) => {
    const today = toLocalYMD(new Date());
    const targetClient = clientsWithStatus.find(c => c.id === preselectedClientId) || clientsWithStatus[0];
    const defaultCat = preselectedCatalogItem || deviceCatalog[0] || null;
    const interval = Number(defaultCat?.defaultIntervalMonths || 12);

    setClientDropdownOpen(false);
    setCatalogDropdownOpen(false);
    setClientDropdownSearch('');
    setCatalogDropdownSearch('');

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
    if (!user) return;
    if (!assignDeviceForm.clientId) {
      showToast("Wybierz klienta z listy.", "error");
      return;
    }
    if (!assignDeviceForm.deviceModel.trim()) {
      showToast("Wybierz lub wpisz model urządzenia.", "error");
      return;
    }

    const targetClient = clients.find(c => c.id === assignDeviceForm.clientId);
    if (!targetClient) {
      showToast("Nie znaleziono wybranego klienta.", "error");
      return;
    }

    try {
      const existingDevices = normalizeClientDevices(targetClient);
      const install = assignDeviceForm.installDate || toLocalYMD(new Date());
      const lastInsp = assignDeviceForm.lastInspectionDate || install;
      const interval = Number(assignDeviceForm.inspectionIntervalMonths || 12);
      const nextInsp = assignDeviceForm.nextInspectionDate || addMonthsToYMD(lastInsp, interval);

      const newDeviceObj = {
        id: `dev_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        deviceType: assignDeviceForm.deviceType || 'heat_pump',
        deviceModel: assignDeviceForm.deviceModel.trim(),
        installDate: install,
        warrantyMonths: Number(assignDeviceForm.warrantyMonths || 60),
        lastInspectionDate: lastInsp,
        nextInspectionDate: nextInsp,
        inspectionIntervalMonths: interval,
        remindersCanceled: false,
        inspectionHistory: [
          {
            id: `init_${Date.now()}`,
            date: lastInsp,
            technician: 'Serwis PP',
            notes: 'Przypisano nowe urządzenie z Bazy Urządzeń.'
          }
        ]
      };

      if (user.isLocal || !db) {
        const next = clients.map(c =>
          c.id === targetClient.id
            ? { ...c, devices: [...existingDevices, newDeviceObj], updatedAt: new Date().toISOString() }
            : c
        );
        saveLocalClients(next);
        setIsAddDeviceModalOpen(false);
        showToast(`Dodano urządzenie "${newDeviceObj.deviceModel}" do klienta ${targetClient.name}!`);
        return;
      }

      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'clients', targetClient.id);
      await updateDoc(docRef, {
        devices: [...existingDevices, newDeviceObj],
        updatedAt: new Date().toISOString()
      });

      setIsAddDeviceModalOpen(false);
      showToast(`Dodano urządzenie "${newDeviceObj.deviceModel}" do klienta ${targetClient.name}!`);
    } catch (err) {
      console.error("Błąd przypisywania urządzenia:", err);
      showToast("Nie udało się dodać urządzenia do klienta.", "error");
    }
  };

  const handleAddNewCatalogModel = async (e) => {
    e.preventDefault();
    if (!user) return;
    if (!newCatalogItemForm.brand.trim() || !newCatalogItemForm.model.trim()) {
      showToast("Podaj producenta oraz model urządzenia.", "error");
      return;
    }

    try {
      if (user.isLocal || !db) {
        const newCat = {
          id: `cat_${Date.now()}`,
          deviceType: newCatalogItemForm.deviceType,
          brand: newCatalogItemForm.brand.trim(),
          model: newCatalogItemForm.model.trim(),
          defaultWarrantyMonths: Number(newCatalogItemForm.defaultWarrantyMonths || 60),
          defaultIntervalMonths: Number(newCatalogItemForm.defaultIntervalMonths || 12),
          createdAt: new Date().toISOString()
        };
        saveLocalCatalog([...deviceCatalog, newCat]);
        setNewCatalogItemForm({
          deviceType: newCatalogItemForm.deviceType,
          brand: '',
          model: '',
          defaultWarrantyMonths: 60,
          defaultIntervalMonths: 12
        });
        showToast("Nowy model został dodany do Bazy Urządzeń!");
        return;
      }

      const catalogRef = collection(db, 'artifacts', appId, 'public', 'data', 'device_catalog');
      await addDoc(catalogRef, {
        deviceType: newCatalogItemForm.deviceType,
        brand: newCatalogItemForm.brand.trim(),
        model: newCatalogItemForm.model.trim(),
        defaultWarrantyMonths: Number(newCatalogItemForm.defaultWarrantyMonths || 60),
        defaultIntervalMonths: Number(newCatalogItemForm.defaultIntervalMonths || 12),
        createdAt: new Date().toISOString()
      });

      setNewCatalogItemForm({
        deviceType: newCatalogItemForm.deviceType,
        brand: '',
        model: '',
        defaultWarrantyMonths: 60,
        defaultIntervalMonths: 12
      });
      showToast("Nowy model został dodany do Bazy Urządzeń!");
    } catch (err) {
      console.error("Błąd dodawania modelu do bazy:", err);
      showToast("Nie udało się zapisać modelu w bazie.", "error");
    }
  };

  // Filtrowane listy do rozwijanych selectów w modalu "Dodaj urządzenie"
  const filteredClientsForDropdown = useMemo(() => {
    const q = clientDropdownSearch.trim().toLowerCase();
    if (!q) return clientsWithStatus;
    return clientsWithStatus.filter(c =>
      c.name?.toLowerCase().includes(q) ||
      c.city?.toLowerCase().includes(q) ||
      c.street?.toLowerCase().includes(q) ||
      c.phone?.toLowerCase().includes(q)
    );
  }, [clientsWithStatus, clientDropdownSearch]);

  const filteredCatalogForDropdown = useMemo(() => {
    const q = catalogDropdownSearch.trim().toLowerCase();
    return deviceCatalog.filter(item => {
      const full = `${item.brand || ''} ${item.model || ''} ${getDeviceInfo(item.deviceType).label}`.toLowerCase();
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

  // ==========================================
  // PLANOWANIE WIZYTY (Z WYSZUKIWARKĄ TEKSTOWĄ KLIENTA I WYBOREM URZĄDZENIA)
  // ==========================================
  const openScheduleModal = (preselectedClientId = '', preselectedDate = selectedDate, preselectedDeviceId = '') => {
    const targetClient = clientsWithStatus.find(c => c.id === preselectedClientId) || clientsWithStatus[0];
    const defaultClientId = targetClient?.id || '';
    const defaultDevId = preselectedDeviceId || targetClient?.mostUrgentDevice?.id || targetClient?.devices?.[0]?.id || '';

    setVisitClientSearch('');
    setVisitForm({
      clientId: defaultClientId,
      deviceId: defaultDevId,
      date: preselectedDate || toLocalYMD(new Date()),
      time: '09:00',
      serviceType: 'Przegląd okresowy / Gwarancyjny',
      notes: '',
      status: 'planned'
    });
    setIsVisitModalOpen(true);
  };

  // Klienci pasujący do wpisywanej frazy w oknie "Zaplanuj wizytę w PP"
  const searchableClientsForVisit = useMemo(() => {
    const q = visitClientSearch.trim().toLowerCase();
    if (!q) return clientsWithStatus;
    return clientsWithStatus.filter(c => {
      const devMatch = c.devices.some(
        d =>
          d.deviceModel?.toLowerCase().includes(q) ||
          getDeviceInfo(d.deviceType).label.toLowerCase().includes(q)
      );
      return (
        c.name?.toLowerCase().includes(q) ||
        c.city?.toLowerCase().includes(q) ||
        c.street?.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q) ||
        devMatch
      );
    });
  }, [clientsWithStatus, visitClientSearch]);

  const handleSaveVisit = async (e) => {
    e.preventDefault();
    if (!user) return;
    if (!visitForm.clientId || !visitForm.date) {
      showToast("Wybierz klienta oraz datę wizyty.", "error");
      return;
    }

    try {
      if (user.isLocal || !db) {
        const newVisit = {
          id: `visit_${Date.now()}`,
          ...visitForm,
          createdAt: new Date().toISOString()
        };
        const otherDays = appointments.filter(a => a.date !== visitForm.date);
        const sameDayVisits = [
          ...appointments.filter(a => a.date === visitForm.date),
          newVisit
        ]
          .sort((a, b) => (a.time || '00:00').localeCompare(b.time || '00:00'))
          .map((v, idx) => ({ ...v, order: idx + 1 }));

        saveLocalAppointments([...otherDays, ...sameDayVisits]);
        setIsVisitModalOpen(false);
        showToast(`Wizyta (${visitForm.time}) została dodana i ustawiona w trasie zgodnie z godziną!`);
        return;
      }

      const colRef = collection(db, 'artifacts', appId, 'public', 'data', 'appointments');
      const newDocRef = await addDoc(colRef, {
        ...visitForm,
        createdAt: new Date().toISOString()
      });

      // Po dodaniu wizyty automatycznie układamy kolejność wyjazdów w tym dniu według ustalonych godzin
      const sameDayVisits = [
        ...appointments.filter(a => a.date === visitForm.date),
        { id: newDocRef.id, ...visitForm }
      ].sort((a, b) => (a.time || '00:00').localeCompare(b.time || '00:00'));

      await Promise.all(
        sameDayVisits.map((v, idx) => {
          const dRef = doc(db, 'artifacts', appId, 'public', 'data', 'appointments', v.id);
          return updateDoc(dRef, { order: idx + 1 });
        })
      );

      setIsVisitModalOpen(false);
      showToast(`Wizyta (${visitForm.time}) została dodana i ustawiona w trasie zgodnie z godziną!`);
    } catch (error) {
      console.error("Błąd zapisu wizyty:", error);
      showToast("Nie udało się zaplanować wizyty.", "error");
    }
  };

  // Ręczne lub automatyczne sortowanie planu dnia dokładnie według ustalonych godzin
  const sortDayVisitsByTime = async (dayVisitsList) => {
    if (!user || !dayVisitsList || dayVisitsList.length === 0) return;
    const sorted = [...dayVisitsList].sort((a, b) =>
      (a.time || '00:00').localeCompare(b.time || '00:00')
    );
    try {
      if (user.isLocal || !db) {
        const targetDate = dayVisitsList[0].date;
        const otherDays = appointments.filter(a => a.date !== targetDate);
        const reordered = sorted.map((item, idx) => ({
          ...item,
          order: idx + 1,
          manualOrderOverride: false
        }));
        saveLocalAppointments([...otherDays, ...reordered]);
        showToast("Trasa została uporządkowana chronologicznie według ustalonych godzin!");
        return;
      }

      await Promise.all(
        sorted.map((item, idx) => {
          const dRef = doc(db, 'artifacts', appId, 'public', 'data', 'appointments', item.id);
          return updateDoc(dRef, { order: idx + 1, manualOrderOverride: false });
        })
      );
      showToast("Trasa została uporządkowana chronologicznie według ustalonych godzin!");
    } catch (err) {
      console.error("Błąd sortowania wg godzin:", err);
    }
  };

  const toggleVisitStatus = async (visit) => {
    if (!user) return;
    const nextStatus = visit.status === 'completed' ? 'planned' : 'completed';
    try {
      if (user.isLocal || !db) {
        saveLocalAppointments(
          appointments.map(a => (a.id === visit.id ? { ...a, status: nextStatus } : a))
        );
        showToast(
          nextStatus === 'completed'
            ? 'Wizyta oznaczona jako wykonana (zostanie pominięta w trasie Google Maps).'
            : 'Przywrócono status: zaplanowana.'
        );
        return;
      }

      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'appointments', visit.id);
      await updateDoc(docRef, { status: nextStatus });
      showToast(
        nextStatus === 'completed'
          ? 'Wizyta oznaczona jako wykonana (zostanie pominięta w trasie Google Maps).'
          : 'Przywrócono status: zaplanowana.'
      );
    } catch (error) {
      console.error("Błąd zmiany statusu:", error);
    }
  };

  const moveVisitOrder = async (visit, direction, dayVisits) => {
    const idx = dayVisits.findIndex(v => v.id === visit.id);
    if (idx === -1) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= dayVisits.length) return;

    const updatedList = [...dayVisits];
    const temp = updatedList[idx];
    updatedList[idx] = updatedList[targetIdx];
    updatedList[targetIdx] = temp;

    try {
      if (user.isLocal || !db) {
        const targetDate = visit.date;
        const otherDays = appointments.filter(a => a.date !== targetDate);
        const reordered = updatedList.map((item, i) => ({
          ...item,
          order: i + 1,
          manualOrderOverride: true
        }));
        saveLocalAppointments([...otherDays, ...reordered]);
        showToast("Kolejność punktów na trasie została zmieniona.");
        return;
      }

      await Promise.all(
        updatedList.map((item, i) => {
          const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'appointments', item.id);
          return updateDoc(docRef, {
            order: i + 1,
            manualOrderOverride: true
          });
        })
      );
      showToast("Kolejność punktów na trasie została zmieniona.");
    } catch (error) {
      console.error("Błąd zmiany kolejności:", error);
    }
  };

  // ==========================================
  // EKSPORT TRASY DO GOOGLE MAPS (START Z MOJEJ LOKALIZACJI + WEDŁUG USTALONYCH GODZIN + POMIJANIE WYKONANYCH)
  // ==========================================
  const getPendingVisitsForRoute = (dayVisitsList) => {
    return (dayVisitsList || [])
      .filter((v) => v.status !== 'completed')
      .sort((a, b) => {
        if (a.manualOrderOverride && b.manualOrderOverride && (a.order ?? 999) !== (b.order ?? 999)) {
          return (a.order ?? 999) - (b.order ?? 999);
        }
        const timeCmp = (a.time || '00:00').localeCompare(b.time || '00:00');
        if (timeCmp !== 0) return timeCmp;
        return (a.order ?? 999) - (b.order ?? 999);
      });
  };

  const generateGoogleMapsRouteUrl = (dayVisitsList, currentCoords = null) => {
    const pendingVisits = getPendingVisitsForRoute(dayVisitsList);
    if (pendingVisits.length === 0) return null;

    const addresses = pendingVisits
      .map(v => {
        const c = clients.find(cl => cl.id === v.clientId);
        if (!c) return null;
        return `${c.street}, ${c.postalCode || ''} ${c.city}, Polska`.trim();
      })
      .filter(Boolean);

    if (addresses.length === 0) return null;

    const destination = encodeURIComponent(addresses[addresses.length - 1]);
    const waypointsList = addresses.slice(0, -1);

    let url = `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;

    if (currentCoords && currentCoords.lat && currentCoords.lng) {
      url += `&origin=${encodeURIComponent(`${currentCoords.lat},${currentCoords.lng}`)}`;
    }

    if (waypointsList.length > 0) {
      const waypoints = waypointsList.map(a => encodeURIComponent(a)).join('|');
      url += `&waypoints=${waypoints}`;
    }

    return url;
  };

  const handleOpenGoogleMapsRoute = (dayVisitsList) => {
    const pendingVisits = getPendingVisitsForRoute(dayVisitsList);
    if (pendingVisits.length === 0) {
      showToast("Wszystkie wizyty w tym dniu są już oznaczone jako wykonane lub brak wizyt!", "error");
      return;
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const url = generateGoogleMapsRouteUrl(dayVisitsList, {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          });
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

  // ==========================================
  // DANE DLA PLANERA DZIENNEGO, TYGODNIOWEGO I KALENDARZA
  // ==========================================
  const getVisitsForDate = (dateStr) => {
    return appointments
      .filter(a => a.date === dateStr)
      .sort((a, b) => {
        if (a.manualOrderOverride && b.manualOrderOverride && (a.order ?? 999) !== (b.order ?? 999)) {
          return (a.order ?? 999) - (b.order ?? 999);
        }
        const timeDiff = (a.time || '00:00').localeCompare(b.time || '00:00');
        if (timeDiff !== 0) return timeDiff;
        return (a.order ?? 999) - (b.order ?? 999);
      });
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
    for (let i = 0; i < startDayOfWeek; i++) {
      cells.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(year, month, d);
      const ymd = toLocalYMD(dateObj);
      const dayVisits = appointments.filter(a => a.date === ymd);

      let inspectionsDueCount = 0;
      clientsWithStatus.forEach(c => {
        c.devices.forEach(dev => {
          if (!dev.statusInfo.remindersCanceled && dev.statusInfo.nextInspectionStr === ymd) {
            inspectionsDueCount += 1;
          }
        });
      });

      cells.push({
        day: d,
        ymd,
        visitsCount: dayVisits.length,
        inspectionsCount: inspectionsDueCount
      });
    }
    return cells;
  }, [calMonthDate, appointments, clientsWithStatus]);

  const shiftDate = (daysCount) => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + daysCount);
    setSelectedDate(toLocalYMD(d));
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col md:flex-row font-sans">
      {/* POWIADOMIENIA TOAST */}
      {notification && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border bg-slate-900 text-white border-slate-700 animate-bounce">
          {notification.type === 'error' ? (
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          ) : (
            <Check className="w-5 h-5 text-emerald-400 shrink-0" />
          )}
          <span className="text-sm font-medium">{notification.msg}</span>
        </div>
      )}

      {/* LEWY PANEL BOCZNY (SIDEBAR) Z LOGO "PP" I MENU NAWIGACYJNYM */}
      <aside className="w-full md:w-64 lg:w-72 bg-slate-950 text-white shadow-xl md:min-h-screen md:sticky md:top-0 md:h-screen flex flex-col justify-between border-b md:border-b-0 md:border-r border-slate-800 z-30 shrink-0">
        <div className="p-4 sm:p-5 space-y-6">
          {/* Logo PP */}
          <div className="flex items-center justify-between">
            <div
              onClick={() => setActiveTab('dashboard')}
              className="flex items-center gap-3.5 cursor-pointer group"
            >
              <div className="relative w-11 h-11 rounded-xl bg-gradient-to-br from-sky-500 to-blue-700 flex items-center justify-center shadow-md shadow-sky-500/20 border border-sky-400/30 group-hover:scale-105 transition shrink-0">
                <svg viewBox="0 0 48 48" className="w-7 h-7 fill-none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="4" y="4" width="40" height="40" rx="9" stroke="white" strokeOpacity="0.25" strokeWidth="2" />
                  <path
                    d="M13 33V15H20.5C23.5 15 25.5 16.8 25.5 19.8C25.5 22.8 23.5 24.6 20.5 24.6H16.8V33H13Z"
                    fill="white"
                  />
                  <path
                    d="M27.5 33V15H35C38 15 40 16.8 40 19.8C40 22.8 38 24.6 35 24.6H31.3V33H27.5Z"
                    fill="#38bdf8"
                  />
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-extrabold tracking-tight text-white">PP</span>
                  <span className="text-[11px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-400/20">
                    Planer Pracy
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  System Serwisowy HVAC
                </p>
              </div>
            </div>

            {/* Szybkie przyciski na telefonach */}
            <div className="flex md:hidden items-center gap-1.5">
              <button
                onClick={() => openAddDeviceModal()}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" /> Urz.
              </button>
              <button
                onClick={openAddClientModal}
                className="bg-sky-600 hover:bg-sky-500 text-white px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" /> Klient
              </button>
            </div>
          </div>

          {/* Pionowe Menu Nawigacyjne po lewej stronie */}
          <div className="space-y-1">
            <div className="hidden md:block text-[10px] font-bold uppercase tracking-widest text-slate-500 px-3 mb-2">
              Menu Główne
            </div>
            <nav className="flex md:flex-col gap-1.5 overflow-x-auto md:overflow-visible pb-1 md:pb-0">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`w-full flex items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition ${
                  activeTab === 'dashboard'
                    ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20'
                    : 'text-slate-300 hover:text-white hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center gap-3">
                  <LayoutDashboard className="w-4 h-4 shrink-0" />
                  <span>Pulpit (Start)</span>
                </div>
                {stats.urgentTotal > 0 && (
                  <span className="bg-rose-500 text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
                    {stats.urgentTotal}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('clients')}
                className={`w-full flex items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition ${
                  activeTab === 'clients'
                    ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20'
                    : 'text-slate-300 hover:text-white hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Users className="w-4 h-4 shrink-0" />
                  <span>Klienci</span>
                </div>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  activeTab === 'clients' ? 'bg-sky-800 text-sky-100' : 'bg-slate-800 text-slate-300'
                }`}>
                  {stats.totalClients}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('devices_db')}
                className={`w-full flex items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition ${
                  activeTab === 'devices_db'
                    ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20'
                    : 'text-slate-300 hover:text-white hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Wrench className="w-4 h-4 shrink-0" />
                  <span>Baza Urządzeń</span>
                </div>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  activeTab === 'devices_db' ? 'bg-sky-800 text-sky-100' : 'bg-slate-800 text-slate-300'
                }`}>
                  {deviceCatalog.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('map')}
                className={`w-full flex items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition ${
                  activeTab === 'map'
                    ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20'
                    : 'text-slate-300 hover:text-white hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center gap-3">
                  <MapIcon className="w-4 h-4 shrink-0" />
                  <span>Mapa Klientów</span>
                </div>
              </button>

              <button
                onClick={() => setActiveTab('planner')}
                className={`w-full flex items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition ${
                  activeTab === 'planner'
                    ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20'
                    : 'text-slate-300 hover:text-white hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Calendar className="w-4 h-4 shrink-0" />
                  <span>Planer i Trasa</span>
                </div>
                {stats.todayVisitsCount > 0 && (
                  <span className="bg-amber-400 text-slate-950 text-[11px] font-extrabold px-2 py-0.5 rounded-full">
                    {stats.todayVisitsCount}
                  </span>
                )}
              </button>
            </nav>
          </div>
        </div>

        {/* Dolny boks informacyjny w lewym menu */}
        <div className="hidden md:block p-4 m-4 rounded-2xl bg-slate-900 border border-slate-800 text-xs space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span>Urządzenia w bazie:</span>
            <span className="font-bold text-white">{stats.totalDevices} szt.</span>
          </div>
          <div className="flex items-center justify-between text-slate-400">
            <span>Pilne przeglądy:</span>
            <span className="font-bold text-amber-400">{stats.urgentTotal} urz.</span>
          </div>
          <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-500">
            Pompy Ciepła • Klimatyzacja • Wentylacja
          </div>
        </div>
      </aside>

      {/* PRAWA STRONA: GÓRNY PASEK AKCJI + ZAWARTOŚĆ GŁÓWNA */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Górny pasek z szybkimi przyciskami w prawym górnym rogu */}
        <header className="bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 py-3.5 sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
          <div>
            <h1 className="text-base sm:text-lg font-extrabold text-slate-900">
              {activeTab === 'dashboard' && 'Pulpit główny i podsumowanie'}
              {activeTab === 'clients' && `Baza Klientów (${stats.totalClients})`}
              {activeTab === 'devices_db' && `Baza Urządzeń HVAC (${deviceCatalog.length})`}
              {activeTab === 'map' && 'Interaktywna Mapa Klientów'}
              {activeTab === 'planner' && 'Planer Dnia, Tygodnia i Trasa Google Maps'}
            </h1>
            <p className="text-xs text-slate-500 hidden sm:block">
              Dzisiaj: {formatDatePL(todayYMD)} • Zaplanowane wyjazdy na dziś: {stats.todayVisitsCount}
            </p>
          </div>

          {/* Przyciski w prawym górnym rogu (w tym + Dodaj urządzenie) */}
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={() => openScheduleModal()}
              className="bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
            >
              <Calendar className="w-4 h-4 text-sky-600" />
              <span>Zaplanuj wizytę</span>
            </button>
            <button
              onClick={() => openAddDeviceModal()}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
              title="Przypisz nowe urządzenie do istniejącego klienta z Bazy Urządzeń"
            >
              <Wrench className="w-4 h-4" />
              <span>+ Dodaj urządzenie</span>
            </button>
            <button
              onClick={openAddClientModal}
              className="bg-sky-600 hover:bg-sky-500 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              <span>Dodaj klienta</span>
            </button>
          </div>
        </header>

        {/* ZAWARTOŚĆ GŁÓWNA */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* ==================================================== */}
        {/* WIDOK 0: PULPIT STARTOWY                             */}
        {/* ==================================================== */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {clientsWithStatus.length === 0 && !loading && (
              <div className="bg-white rounded-2xl p-8 text-center border border-slate-200 shadow-sm">
                <Wrench className="w-12 h-12 text-sky-600 mx-auto mb-3" />
                <h2 className="text-xl font-bold text-slate-900">Witaj w programie PP — Planer Pracy!</h2>
                <p className="text-sm text-slate-600 max-w-lg mx-auto mt-1 mb-5">
                  Twoja baza klientów jest jeszcze pusta. Możesz dodać pierwszego klienta ręcznie albo jednym kliknięciem wgrać przykładowych klientów (wraz z kilkoma urządzeniami i planem na dzisiaj).
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                  <button
                    onClick={handleSeedSampleData}
                    disabled={seeding}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-sm transition"
                  >
                    {seeding ? 'Wgrywanie danych...' : 'Wczytaj przykładową bazę (5 klientów + plan na dziś)'}
                  </button>
                  <button
                    onClick={openAddClientModal}
                    className="bg-sky-600 hover:bg-sky-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-sm transition"
                  >
                    + Dodaj pierwszego klienta
                  </button>
                </div>
              </div>
            )}

            {/* KAFELKI PODSUMOWUJĄCE */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div
                onClick={() => setActiveTab('planner')}
                className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between cursor-pointer hover:border-sky-400 transition"
              >
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Plan na dzisiaj</span>
                  <div className="text-2xl font-extrabold text-slate-900 mt-1">{todayVisits.length} wizyt</div>
                  <span className="text-xs text-sky-600 font-semibold">Zobacz trasę dnia →</span>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center">
                  <Calendar className="w-6 h-6" />
                </div>
              </div>

              <div
                onClick={() => {
                  setInspectionFilter('overdue');
                  setActiveTab('clients');
                }}
                className="bg-white p-4 rounded-2xl border border-rose-200 shadow-sm flex items-center justify-between cursor-pointer hover:border-rose-400 transition"
              >
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-rose-500">Przeglądy po terminie</span>
                  <div className="text-2xl font-extrabold text-rose-600 mt-1">{stats.overdueCount} urz.</div>
                  <span className="text-xs text-rose-600 font-semibold">Wymagają pilnego kontaktu</span>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
                  <AlertCircle className="w-6 h-6" />
                </div>
              </div>

              <div
                onClick={() => {
                  setInspectionFilter('soon');
                  setActiveTab('clients');
                }}
                className="bg-white p-4 rounded-2xl border border-amber-200 shadow-sm flex items-center justify-between cursor-pointer hover:border-amber-400 transition"
              >
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-600">Kończące się (30 dni)</span>
                  <div className="text-2xl font-extrabold text-amber-600 mt-1">{stats.soonCount} urz.</div>
                  <span className="text-xs text-amber-700 font-semibold">Zbliżający się przegląd</span>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Bell className="w-6 h-6" />
                </div>
              </div>

              <div
                onClick={() => {
                  setInspectionFilter('all');
                  setActiveTab('clients');
                }}
                className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between cursor-pointer hover:border-slate-400 transition"
              >
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Baza Klientów i Urządzeń</span>
                  <div className="text-2xl font-extrabold text-slate-900 mt-1">
                    {stats.totalClients} <span className="text-sm font-semibold text-slate-500">({stats.totalDevices} urz.)</span>
                  </div>
                  <span className="text-xs text-emerald-600 font-semibold">Pełna lista klientów →</span>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Users className="w-6 h-6" />
                </div>
              </div>
            </div>

            {/* GŁÓWNA SIATKA PULPITU */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* LEWA KOLUMNA (7/12): PLAN NA DZISIAJ + KOŃCZĄCE SIĘ TERMINY PRZEGLĄDÓW */}
              <div className="lg:col-span-7 space-y-6">
                {/* PLAN NA DZISIAJ */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <Clock className="w-5 h-5 text-sky-400" />
                      <div>
                        <h2 className="text-base font-bold">Plan pracy na dzisiaj ({formatDatePL(todayYMD)})</h2>
                        <p className="text-xs text-slate-400">Harmonogram wyjazdów serwisowych i montażowych (wg godzin)</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getPendingVisitsForRoute(todayVisits).length > 0 && (
                        <button
                          type="button"
                          onClick={() => handleOpenGoogleMapsRoute(todayVisits)}
                          className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs px-3 py-2 rounded-xl flex items-center gap-1.5 shadow transition"
                          title="Startuje z Twojej lokalizacji GPS i pomija wykonane już wizyty"
                        >
                          <Navigation className="w-3.5 h-3.5" />
                          <span>Trasa Google Maps ({getPendingVisitsForRoute(todayVisits).length})</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      )}
                      <button
                        onClick={() => openScheduleModal('', todayYMD)}
                        className="bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs px-3 py-2 rounded-xl flex items-center gap-1 transition"
                      >
                        <Plus className="w-3.5 h-3.5" /> Dodaj
                      </button>
                    </div>
                  </div>

                  <div className="p-4">
                    {todayVisits.length === 0 ? (
                      <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        <p className="text-sm text-slate-500 mb-3">Brak zaplanowanych wyjazdów na dzisiaj.</p>
                        <button
                          onClick={() => openScheduleModal('', todayYMD)}
                          className="text-xs font-bold text-sky-600 hover:text-sky-700 bg-sky-50 px-3.5 py-2 rounded-lg border border-sky-200"
                        >
                          + Zaplanuj pierwszą dzisiejszą wizytę
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {todayVisits.map((visit, idx) => {
                          const client = clientsWithStatus.find(c => c.id === visit.clientId);
                          const targetDev =
                            client?.devices?.find(d => d.id === visit.deviceId) ||
                            client?.mostUrgentDevice ||
                            client?.devices?.[0];
                          const devInfo = getDeviceInfo(targetDev?.deviceType);
                          return (
                            <div
                              key={visit.id}
                              className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition ${
                                visit.status === 'completed'
                                  ? 'bg-emerald-50/50 border-emerald-200 opacity-75'
                                  : 'bg-slate-50/70 hover:bg-white border-slate-200'
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <div className="w-7 h-7 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                                  {idx + 1}
                                </div>
                                <div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-xs font-extrabold text-sky-700 bg-sky-100 px-2 py-0.5 rounded">
                                      {visit.time}
                                    </span>
                                    <span className="font-bold text-sm text-slate-900">
                                      {client ? client.name : 'Usunięty klient'}
                                    </span>
                                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                                      {visit.serviceType}
                                    </span>
                                    {targetDev && (
                                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${devInfo.bg} ${devInfo.color}`}>
                                        {devInfo.short}: {targetDev.deviceModel}
                                      </span>
                                    )}
                                  </div>
                                  {client && (
                                    <div className="text-xs text-slate-600 mt-1 flex flex-wrap items-center gap-3">
                                      <span className="flex items-center gap-1">
                                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                        {client.city}, {client.street}
                                      </span>
                                      <a href={`tel:${client.phone}`} className="text-sky-600 font-semibold hover:underline">
                                        {client.phone}
                                      </a>
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 self-end sm:self-center">
                                {client && (
                                  <button
                                    onClick={() => openInspectionModal(client, targetDev?.id)}
                                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 flex items-center gap-1"
                                    title="Wbij wykonany przegląd do historii urządzenia"
                                  >
                                    <ClipboardCheck className="w-3.5 h-3.5" />
                                    <span>Wbij przegląd</span>
                                  </button>
                                )}
                                <button
                                  onClick={() => toggleVisitStatus(visit)}
                                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition ${
                                    visit.status === 'completed'
                                      ? 'bg-emerald-600 text-white'
                                      : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                                  }`}
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  {visit.status === 'completed' ? 'Wykonano' : 'Oznacz'}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* KOŃCZĄCE SIĘ TERMINY PRZEGLĄDÓW (POKAZUJE 5 OKIENEK + AUTO-ODŚWIEŻANIE + ROZWIŃ PEŁNĄ LISTĘ) */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 bg-amber-50/70">
                    <div className="flex items-center gap-2.5">
                      <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-base font-bold text-slate-900">
                            Kończące się terminy przeglądów i gwarancji
                          </h2>
                          <span className="text-xs font-extrabold px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-950">
                            {showAllUrgent
                              ? `${urgentDeviceItems.length} z ${urgentDeviceItems.length}`
                              : `${Math.min(5, urgentDeviceItems.length)} z ${urgentDeviceItems.length}`}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">
                          Wyświetla 5 najpilniejszych pozycji i automatycznie odświeża listę po edycji lub wbiciu przeglądu
                        </p>
                      </div>
                    </div>

                    {urgentDeviceItems.length > 5 && (
                      <button
                        type="button"
                        onClick={() => setShowAllUrgent(prev => !prev)}
                        className="px-3 py-1.5 rounded-xl bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold flex items-center gap-1.5 shadow-2xs transition"
                      >
                        <span>
                          {showAllUrgent
                            ? 'Zwiń do 5 najpilniejszych'
                            : `Rozwiń pełną listę (${urgentDeviceItems.length})`}
                        </span>
                      </button>
                    )}
                  </div>

                  <div className="divide-y divide-slate-100">
                    {urgentDeviceItems.length === 0 ? (
                      <div className="p-8 text-center text-sm text-slate-500">
                        Wszystkie aktywne urządzenia mają aktualne przeglądy!
                      </div>
                    ) : (
                      (showAllUrgent ? urgentDeviceItems : urgentDeviceItems.slice(0, 5)).map(({ client, device, statusInfo: st }) => {
                        const devInfo = getDeviceInfo(device.deviceType);
                        return (
                          <div key={`${client.id}_${device.id}`} className="p-4 hover:bg-slate-50 transition space-y-2.5">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-bold text-sm text-slate-900">{client.name}</span>
                                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${devInfo.bg} ${devInfo.color} ${devInfo.border}`}>
                                    {devInfo.short}: {device.deviceModel}
                                  </span>
                                  {st.isInspectionOverdue ? (
                                    <span className="text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300 px-2 py-0.5 rounded-full">
                                      ⚠️ Po terminie ({Math.abs(st.daysToInspection)} dni temu)
                                    </span>
                                  ) : (
                                    <span className="text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 rounded-full">
                                      🔔 Przegląd za {st.daysToInspection} dni ({st.nextInspectionStr})
                                    </span>
                                  )}
                                </div>

                                <div className="text-xs text-slate-600 flex flex-wrap items-center gap-3 mt-1">
                                  <span>📍 {client.city}, {client.street}</span>
                                  <a href={`tel:${client.phone}`} className="text-sky-600 font-semibold hover:underline">
                                    📞 {client.phone}
                                  </a>
                                  <span className="text-slate-400">Ostatni przegląd: {st.lastInspectionFormatted}</span>
                                </div>
                              </div>
                            </div>

                            {/* Przyciski szybkich akcji przeglądu */}
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                              <button
                                onClick={() => openInspectionModal(client, device.id)}
                                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
                              >
                                <ClipboardCheck className="w-3.5 h-3.5" />
                                Wbij przegląd
                              </button>

                              <button
                                onClick={() => openScheduleModal(client.id, todayYMD, device.id)}
                                className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
                              >
                                <Calendar className="w-3.5 h-3.5" />
                                Zaplanuj wizytę
                              </button>

                              <button
                                onClick={() => handleSkipCurrentInspection(client, device.id)}
                                className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold flex items-center gap-1.5 transition"
                                title="Pomija obecny przegląd i przesuwa termin o kolejny rok"
                              >
                                <FastForward className="w-3.5 h-3.5 text-amber-700" />
                                Anuluj aktualny przegląd (+1 rok)
                              </button>

                              <button
                                onClick={() => handleToggleCancelDeviceReminders(client, device.id, true)}
                                className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold flex items-center gap-1.5 transition"
                                title="Całkowicie wyłącza przypomnienia z tego urządzenia"
                              >
                                <Ban className="w-3.5 h-3.5" />
                                Anuluj
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {urgentDeviceItems.length > 5 && (
                    <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium">
                        {showAllUrgent
                          ? `Wyświetlono wszystkie pozycje (${urgentDeviceItems.length})`
                          : `Ukryto jeszcze ${urgentDeviceItems.length - 5} mniej pilnych przeglądów`}
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowAllUrgent(prev => !prev)}
                        className="font-bold text-sky-700 hover:underline"
                      >
                        {showAllUrgent ? 'Pokaż tylko 5 najpilniejszych ↑' : 'Rozwiń pełną listę wszystkich przeglądów ↓'}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {}
              {/* PRAWA KOLUMNA (5/12): KALENDARZ MIESIĘCZNY */}
              <div className="lg:col-span-5 space-y-6">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-base font-bold text-slate-900">Kalendarz Pracy</h2>
                      <p className="text-xs text-slate-500">Kliknij dzień, aby otworzyć jego plan</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() =>
                          setCalMonthDate(new Date(calMonthDate.getFullYear(), calMonthDate.getMonth() - 1, 1))
                        }
                        className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="text-xs font-bold uppercase tracking-wider px-2.5">
                        {calMonthDate.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' })}
                      </span>
                      <button
                        onClick={() =>
                          setCalMonthDate(new Date(calMonthDate.getFullYear(), calMonthDate.getMonth() + 1, 1))
                        }
                        className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-slate-400 pb-2 border-b border-slate-100">
                    <div>Pon</div>
                    <div>Wt</div>
                    <div>Śr</div>
                    <div>Czw</div>
                    <div>Pt</div>
                    <div>Sob</div>
                    <div>Ndz</div>
                  </div>

                  <div className="grid grid-cols-7 gap-1.5 mt-2">
                    {calendarDays.map((cell, i) => {
                      if (!cell) {
                        return <div key={`empty-${i}`} className="h-14 rounded-xl bg-slate-50/50" />;
                      }
                      const isToday = cell.ymd === todayYMD;
                      const isSelected = cell.ymd === selectedDate;
                      return (
                        <button
                          key={cell.ymd}
                          onClick={() => {
                            setSelectedDate(cell.ymd);
                            setActiveTab('planner');
                          }}
                          className={`h-14 rounded-xl p-1.5 flex flex-col justify-between items-center border text-left transition ${
                            isToday
                              ? 'bg-sky-50 border-sky-400 text-sky-900 font-bold'
                              : isSelected
                              ? 'bg-slate-900 text-white border-slate-900'
                              : 'bg-white hover:bg-slate-50 border-slate-200/80 text-slate-700'
                          }`}
                        >
                          <span className="text-xs font-bold">{cell.day}</span>
                          <div className="flex items-center gap-1">
                            {cell.visitsCount > 0 && (
                              <span
                                className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-sky-600 text-white"
                                title={`Zaplanowane wizyty: ${cell.visitsCount}`}
                              >
                                {cell.visitsCount}
                              </span>
                            )}
                            {cell.inspectionsCount > 0 && (
                              <span
                                className="w-2 h-2 rounded-full bg-amber-500"
                                title={`Wypadające przeglądy: ${cell.inspectionsCount}`}
                              />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                    <div className="flex items-center gap-2">
                      <span className="inline-block w-3 h-3 rounded-full bg-sky-600" />
                      <span>Zaplanowane wizyty</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500" />
                      <span>Termin przeglądu urządzenia</span>
                    </div>
                  </div>
                </div>

                {/* SZYBKIE SKRÓTY */}
                <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-sm space-y-3">
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-sky-400" />
                    Szybkie akcje serwisowe
                  </h3>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      onClick={openAddClientModal}
                      className="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-left transition border border-slate-700"
                    >
                      <Plus className="w-4 h-4 text-sky-400 mb-1" />
                      <div className="text-xs font-bold">Dodaj klienta</div>
                      <div className="text-[11px] text-slate-400">1, 2 lub 3+ urządzeń</div>
                    </button>
                    <button
                      onClick={() => openAddDeviceModal()}
                      className="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-left transition border border-slate-700"
                    >
                      <Wrench className="w-4 h-4 text-emerald-400 mb-1" />
                      <div className="text-xs font-bold">Dodaj urządzenie</div>
                      <div className="text-[11px] text-slate-400">Z Bazy Urządzeń</div>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {}
        {/* ==================================================== */}
        {/* WIDOK 1: KLIENCI (JEDEN KLIENT W JEDNEJ LINII + WIELE URZĄDZEŃ POD JEDNYM NAZWISKIEM) */}
        {/* ==================================================== */}
        {activeTab === 'clients' && (
          <div className="space-y-4">
            {/* PASEK FILTRÓW I EKSPORTU DO EXCELA */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col xl:flex-row gap-3 items-stretch xl:items-center justify-between">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Szukaj klienta (nazwisko, miasto, ulica, telefon, model urządzenia)..."
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={deviceFilter}
                  onChange={(e) => setDeviceFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm font-medium text-slate-700"
                >
                  <option value="all">Wszystkie urządzenia</option>
                  <option value="heat_pump">🔥 Pompy ciepła</option>
                  <option value="ac">❄️ Klimatyzacja</option>
                  <option value="ventilation">💨 Wentylacja / Rekuperacja</option>
                </select>

                <select
                  value={inspectionFilter}
                  onChange={(e) => setInspectionFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm font-medium text-slate-700"
                >
                  <option value="all">Wszystkie terminy</option>
                  <option value="overdue">⚠️ Przegląd po terminie</option>
                  <option value="soon">🔔 Kończące się (do 30 dni)</option>
                  <option value="warranty">🛡️ Aktywna gwarancja</option>
                </select>

                {/* PRZYCISK EKSPORTU BAZY KLIENTÓW DO EXCELA (CSV) */}
                <button
                  type="button"
                  onClick={handleExportClientsToExcelCSV}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-sm transition"
                  title="Eksportuj bazę klientów i urządzeń do pliku Excel (.csv)"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Eksport bazy do Excela (.csv)</span>
                  <Download className="w-3.5 h-3.5" />
                </button>

                {/* PRZYCISK IMPORTU Z EXCELA (CSV) */}
                <input
                  ref={csvInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleImportClientsFromExcelCSV}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => csvInputRef.current?.click()}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 px-3 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition"
                  title="Wczytaj klientów z pliku CSV z Excela"
                >
                  <Upload className="w-4 h-4 text-slate-600" />
                  <span>Import z Excela</span>
                </button>

                <button
                  onClick={openAddClientModal}
                  className="bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-sm"
                >
                  <Plus className="w-4 h-4" /> Dodaj klienta
                </button>
              </div>
            </div>

            {/* TABELA JEDNOLINIJNA — WSZYSTKIE URZĄDZENIA POD JEDNYM NAZWISKIEM */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-slate-200 text-[11px] uppercase tracking-wider font-bold">
                      <th className="py-3 px-4">Klient</th>
                      <th className="py-3 px-4">Adres</th>
                      <th className="py-3 px-4">Telefon</th>
                      <th className="py-3 px-4">Urządzenia przypisane do klienta (Przegląd i Gwarancja)</th>
                      <th className="py-3 px-4 text-right">Akcje</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs sm:text-sm">
                    {filteredClients.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-10 text-center text-slate-500">
                          Brak klientów spełniających wybrane kryteria wyszukiwania.
                        </td>
                      </tr>
                    ) : (
                      filteredClients.map((client) => (
                        <tr
                          key={client.id}
                          className="hover:bg-sky-50/40 transition group align-middle"
                        >
                          {/* Imię i nazwisko (1 linia) */}
                          <td className="py-3 px-4 whitespace-nowrap font-bold text-slate-900">
                            <div className="flex items-center gap-2">
                              <span>{client.name}</span>
                              {client.devices.length > 1 && (
                                <span className="text-[11px] font-extrabold bg-slate-900 text-white px-2 py-0.5 rounded-full">
                                  {client.devices.length} urz.
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Adres */}
                          <td className="py-3 px-4 whitespace-nowrap text-slate-600">
                            <span className="font-semibold text-slate-800">{client.city}</span>, {client.street}
                          </td>

                          {/* Telefon */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <a
                              href={`tel:${client.phone}`}
                              className="text-sky-600 hover:underline font-semibold inline-flex items-center gap-1"
                            >
                              <Phone className="w-3.5 h-3.5" />
                              {client.phone}
                            </a>
                          </td>

                          {/* Wszystkie urządzenia klienta pod jednym nazwiskiem */}
                          <td className="py-2.5 px-4">
                            <div className="flex flex-wrap items-center gap-2">
                              {client.devices.map((dev) => {
                                const devInfo = getDeviceInfo(dev.deviceType);
                                const DevIcon = devInfo.icon;
                                const st = dev.statusInfo;
                                return (
                                  <div
                                    key={dev.id}
                                    onClick={() => openInspectionModal(client, dev.id)}
                                    className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-xl border text-xs cursor-pointer hover:shadow-xs transition ${devInfo.bg} ${devInfo.border}`}
                                    title="Kliknij, aby otworzyć przeglądy tego urządzenia"
                                  >
                                    <DevIcon className={`w-3.5 h-3.5 shrink-0 ${devInfo.color}`} />
                                    <span className="font-bold text-slate-900">{dev.deviceModel}</span>

                                    {st.remindersCanceled ? (
                                      <span className="px-1.5 py-0.2 rounded bg-slate-200 text-slate-600 text-[10px] font-bold">
                                        Anulowano przyp.
                                      </span>
                                    ) : st.isInspectionOverdue ? (
                                      <span className="px-1.5 py-0.2 rounded bg-rose-600 text-white text-[10px] font-bold">
                                        Po terminie ({Math.abs(st.daysToInspection)}d)
                                      </span>
                                    ) : st.isInspectionSoon ? (
                                      <span className="px-1.5 py-0.2 rounded bg-amber-500 text-white text-[10px] font-bold">
                                        Za {st.daysToInspection}d ({st.nextInspectionStr})
                                      </span>
                                    ) : (
                                      <span className="px-1.5 py-0.2 rounded bg-white/90 text-emerald-800 border border-emerald-200 text-[10px] font-semibold">
                                        Przegląd: {st.nextInspectionStr}
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </td>

                          {/* Szybkie akcje w jednej linii */}
                          <td className="py-3 px-4 whitespace-nowrap text-right">
                            <div className="inline-flex items-center gap-1">
                              <button
                                onClick={() => openAddDeviceModal(client.id)}
                                className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold inline-flex items-center gap-1 transition"
                                title="Dodaj kolejne urządzenie do tego klienta"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span className="hidden xl:inline">Urządzenie</span>
                              </button>

                              <button
                                onClick={() => openInspectionModal(client)}
                                className="px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold inline-flex items-center gap-1 transition"
                                title="Przeglądy / Wbij lub anuluj przegląd"
                              >
                                <ClipboardCheck className="w-3.5 h-3.5" />
                                <span className="hidden md:inline">Przeglądy</span>
                              </button>

                              <button
                                onClick={() => openScheduleModal(client.id)}
                                className="px-2.5 py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 text-xs font-bold inline-flex items-center gap-1 transition"
                                title="Zaplanuj wyjazd do klienta"
                              >
                                <Calendar className="w-3.5 h-3.5" />
                                <span className="hidden md:inline">Wizyta</span>
                              </button>

                              <button
                                onClick={() => {
                                  setSelectedMapClient(client);
                                  setActiveTab('map');
                                }}
                                className="p-1.5 text-slate-500 hover:text-sky-600 hover:bg-slate-100 rounded-lg"
                                title="Pokaż na mapie"
                              >
                                <MapPin className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => openEditClientModal(client)}
                                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
                                title="Edytuj klienta / Dodaj 2 lub 3 urządzenie"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() =>
                                  setDeleteConfirm({
                                    type: 'client',
                                    id: client.id,
                                    title: client.name
                                  })
                                }
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                                title="Usuń klienta"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {}
        {/* ==================================================== */}
        {/* WIDOK 1B: BAZA URZĄDZEŃ (KATALOG MODELI HVAC)        */}
        {/* ==================================================== */}
        {activeTab === 'devices_db' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* LEWA KOLUMNA (4/12): DODAWANIE NOWEGO MODELU DO BAZY URZĄDZEŃ */}
            <div className="lg:col-span-4 space-y-4">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wrench className="w-5 h-5 text-emerald-400" />
                    <div>
                      <h2 className="text-sm font-bold">Dodaj model do Bazy Urządzeń</h2>
                      <p className="text-[11px] text-slate-400">Katalog urządzeń do szybkiego przypisywania</p>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleAddNewCatalogModel} className="p-5 space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Kategoria urządzenia</label>
                    <select
                      value={newCatalogItemForm.deviceType}
                      onChange={(e) => setNewCatalogItemForm({ ...newCatalogItemForm, deviceType: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white"
                    >
                      <option value="heat_pump">🔥 Pompa ciepła</option>
                      <option value="ac">❄️ Klimatyzacja</option>
                      <option value="ventilation">💨 Wentylacja / Rekuperacja</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Producent (Marka) *</label>
                    <input
                      type="text"
                      required
                      value={newCatalogItemForm.brand}
                      onChange={(e) => setNewCatalogItemForm({ ...newCatalogItemForm, brand: e.target.value })}
                      placeholder="np. Panasonic, Gree, Daikin, Zehnder..."
                      className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Model i moc urządzenia *</label>
                    <input
                      type="text"
                      required
                      value={newCatalogItemForm.model}
                      onChange={(e) => setNewCatalogItemForm({ ...newCatalogItemForm, model: e.target.value })}
                      placeholder="np. Aquarea T-CAP 9kW / Amber Prestige 3.5kW"
                      className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Domyślna gwarancja</label>
                      <select
                        value={newCatalogItemForm.defaultWarrantyMonths}
                        onChange={(e) =>
                          setNewCatalogItemForm({ ...newCatalogItemForm, defaultWarrantyMonths: Number(e.target.value) })
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm bg-white"
                      >
                        <option value={12}>12 mies. (1 rok)</option>
                        <option value={24}>24 mies. (2 lata)</option>
                        <option value={36}>36 mies. (3 lata)</option>
                        <option value={60}>60 mies. (5 lat)</option>
                        <option value={84}>84 mies. (7 lat)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Interwał przeglądu</label>
                      <select
                        value={newCatalogItemForm.defaultIntervalMonths}
                        onChange={(e) =>
                          setNewCatalogItemForm({ ...newCatalogItemForm, defaultIntervalMonths: Number(e.target.value) })
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm bg-white"
                      >
                        <option value={6}>Co 6 miesięcy</option>
                        <option value={12}>Co 12 miesięcy (rok)</option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 px-4 rounded-xl shadow-sm flex items-center justify-center gap-2 text-sm transition"
                  >
                    <Plus className="w-4 h-4" /> Dodaj do Bazy Urządzeń
                  </button>
                </form>
              </div>
            </div>

            {/* PRAWA KOLUMNA (8/12): LISTA MODELI W BAZIE URZĄDZEŃ */}
            <div className="lg:col-span-8 space-y-4">
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col sm:flex-row gap-3 items-center justify-between">
                <div className="relative w-full sm:w-80">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={catalogSearchQuery}
                    onChange={(e) => setCatalogSearchQuery(e.target.value)}
                    placeholder="Szukaj marki lub modelu w bazie..."
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <select
                    value={catalogTypeFilter}
                    onChange={(e) => setCatalogTypeFilter(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm font-medium text-slate-700"
                  >
                    <option value="all">Wszystkie kategorie ({deviceCatalog.length})</option>
                    <option value="heat_pump">🔥 Pompy ciepła</option>
                    <option value="ac">❄️ Klimatyzacja</option>
                    <option value="ventilation">💨 Wentylacja / Rekuperacja</option>
                  </select>

                  <button
                    onClick={() => openAddDeviceModal()}
                    className="bg-sky-600 hover:bg-sky-500 text-white px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-sm ml-auto"
                  >
                    <Plus className="w-4 h-4" /> Przypisz urządzenie klientowi
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-900 text-slate-200 text-[11px] uppercase tracking-wider font-bold">
                        <th className="py-3 px-4">Kategoria</th>
                        <th className="py-3 px-4">Producent i Model</th>
                        <th className="py-3 px-4">Domyślna Gwarancja / Przegląd</th>
                        <th className="py-3 px-4 text-right">Akcje</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs sm:text-sm">
                      {filteredCatalogView.map((item) => {
                        const dInfo = getDeviceInfo(item.deviceType);
                        const DevIcon = dInfo.icon;
                        return (
                          <tr key={item.id} className="hover:bg-slate-50 transition">
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg border ${dInfo.bg} ${dInfo.color} ${dInfo.border}`}>
                                <DevIcon className="w-3.5 h-3.5" />
                                {dInfo.short}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-bold text-slate-900">{item.brand}</div>
                              <div className="text-xs text-slate-600">{item.model}</div>
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap text-xs text-slate-600">
                              <div>Gwarancja: <strong>{item.defaultWarrantyMonths} mies.</strong></div>
                              <div>Przeglądy co: <strong>{item.defaultIntervalMonths} mies.</strong></div>
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap text-right">
                              <div className="inline-flex items-center gap-2">
                                <button
                                  onClick={() => openAddDeviceModal('', item)}
                                  className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold inline-flex items-center gap-1 transition"
                                >
                                  <Plus className="w-3.5 h-3.5" /> Przypisz klientowi
                                </button>
                                <button
                                  onClick={() =>
                                    setDeleteConfirm({
                                      type: 'catalog_device',
                                      id: item.id,
                                      title: `${item.brand} ${item.model}`
                                    })
                                  }
                                  className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition"
                                  title="Usuń model z katalogu"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {}
        {/* ==================================================== */}
        {/* WIDOK 2: MAPA KLIENTÓW (DOMYŚLNIE MAPA ULIC)         */}
        {/* ==================================================== */}
        {activeTab === 'map' && (
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs sm:text-sm font-bold text-slate-700">Koloruj pinezki według:</span>
                <div className="inline-flex rounded-xl bg-slate-100 p-1">
                  <button
                    onClick={() => setMapPinColorMode('inspection')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      mapPinColorMode === 'inspection' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                    }`}
                  >
                    Terminu przeglądu
                  </button>
                  <button
                    onClick={() => setMapPinColorMode('device')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      mapPinColorMode === 'device' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                    }`}
                  >
                    Typu urządzenia
                  </button>
                  <button
                    onClick={() => setMapPinColorMode('warranty')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      mapPinColorMode === 'warranty' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                    }`}
                  >
                    Gwarancji
                  </button>
                </div>

                {/* Wybór warstwy mapy (Domyślnie Mapa ulic) */}
                <div className="inline-flex items-center gap-1 rounded-xl bg-slate-100 p-1">
                  <Layers className="w-3.5 h-3.5 text-slate-500 ml-2 mr-1" />
                  <button
                    onClick={() => setMapTileStyle('street')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                      mapTileStyle === 'street' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                    }`}
                  >
                    Mapa ulic
                  </button>
                  <button
                    onClick={() => setMapTileStyle('voyager')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                      mapTileStyle === 'voyager' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                    }`}
                  >
                    Jasna (Carto)
                  </button>
                  <button
                    onClick={() => setMapTileStyle('satellite')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                      mapTileStyle === 'satellite' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                    }`}
                  >
                    Satelita
                  </button>
                </div>

                <button
                  onClick={handleRefreshAndCenterMap}
                  className="px-3 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 text-xs font-bold flex items-center gap-1.5 transition"
                >
                  <Crosshair className="w-3.5 h-3.5" />
                  <span>Wyśrodkuj mapę</span>
                </button>
              </div>

              {/* Legenda */}
              <div className="flex flex-wrap items-center gap-4 text-xs font-medium">
                {mapPinColorMode === 'inspection' && (
                  <>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-rose-600 inline-block" /> Przegląd po terminie
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-amber-600 inline-block" /> W ciągu 30 dni
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" /> Aktualny
                    </span>
                  </>
                )}
                {mapPinColorMode === 'device' && (
                  <>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-orange-600 inline-block" /> Pompa ciepła
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-sky-600 inline-block" /> Klimatyzacja
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-emerald-600 inline-block" /> Wentylacja
                    </span>
                  </>
                )}
                {mapPinColorMode === 'warranty' && (
                  <>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" /> Na gwarancji
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> Po gwarancji
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Kontener Mapy */}
              <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden relative min-h-[540px]">
                <div
                  ref={mapContainerRef}
                  style={{ height: '540px', width: '100%' }}
                  className="w-full h-[540px]"
                />
              </div>

              {/* Panel boczny wybranego klienta na mapie */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-col justify-between h-[540px] overflow-y-auto">
                {selectedMapClient ? (
                  <div className="space-y-4">
                    <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                      <div>
                        <span className="text-xs font-bold uppercase text-sky-600">Wybrany punkt na mapie</span>
                        <h3 className="text-lg font-bold text-slate-900 mt-0.5">{selectedMapClient.name}</h3>
                        <p className="text-xs text-slate-500">
                          {selectedMapClient.postalCode} {selectedMapClient.city}, {selectedMapClient.street}
                        </p>
                      </div>
                      <button
                        onClick={() => setSelectedMapClient(null)}
                        className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="space-y-2.5 text-sm">
                      <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                        <span className="text-slate-500">Telefon:</span>
                        <a href={`tel:${selectedMapClient.phone}`} className="font-bold text-sky-600 hover:underline">
                          {selectedMapClient.phone}
                        </a>
                      </div>

                      <div className="space-y-2 pt-1">
                        <span className="text-xs font-bold uppercase text-slate-400">
                          Urządzenia klienta ({selectedMapClient.devices.length}):
                        </span>
                        {selectedMapClient.devices.map((dev) => {
                          const dInfo = getDeviceInfo(dev.deviceType);
                          const st = dev.statusInfo;
                          return (
                            <div key={dev.id} className={`p-3 rounded-xl border ${dInfo.bg} ${dInfo.border} space-y-1`}>
                              <div className="font-bold text-xs text-slate-900">
                                {dInfo.short}: {dev.deviceModel}
                              </div>
                              <div className="text-[11px] text-slate-600 flex justify-between">
                                <span>Następny przegląd:</span>
                                <span className="font-bold">{st.nextInspectionFormatted}</span>
                              </div>
                              <div className="text-[11px] text-slate-600 flex justify-between">
                                <span>Gwarancja do:</span>
                                <span className="font-bold">{st.warrantyEndFormatted}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="pt-2 space-y-2">
                      <button
                        onClick={() => openInspectionModal(selectedMapClient)}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5 px-4 rounded-xl shadow-sm flex items-center justify-center gap-2 text-sm transition"
                      >
                        <ClipboardCheck className="w-4 h-4" />
                        Zarządzaj przeglądami ({selectedMapClient.devices.length})
                      </button>
                      <button
                        onClick={() => openScheduleModal(selectedMapClient.id)}
                        className="w-full bg-sky-600 hover:bg-sky-500 text-white font-semibold py-2.5 px-4 rounded-xl shadow-sm flex items-center justify-center gap-2 text-sm transition"
                      >
                        <Calendar className="w-4 h-4" />
                        Zaplanuj wizytę u tego klienta
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-slate-900">
                      Lista punktów na mapie ({clientsWithStatus.length})
                    </h3>
                    <p className="text-xs text-slate-500">
                      Kliknij klienta na liście lub pinezkę na mapie
                    </p>
                    <div className="divide-y divide-slate-100">
                      {clientsWithStatus.map(c => (
                        <button
                          key={c.id}
                          onClick={() => {
                            setSelectedMapClient(c);
                            if (mapInstanceRef.current && c.lat && c.lng) {
                              mapInstanceRef.current.setView([parseFloat(c.lat), parseFloat(c.lng)], 13);
                            }
                          }}
                          className="w-full py-2.5 px-2 text-left hover:bg-slate-50 rounded-lg transition flex items-center justify-between gap-2"
                        >
                          <div>
                            <div className="text-xs font-bold text-slate-900">
                              {c.name} <span className="text-slate-400 font-normal">({c.devices.length} urz.)</span>
                            </div>
                            <div className="text-[11px] text-slate-500">📍 {c.city}, {c.street}</div>
                          </div>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                              c.anyOverdue
                                ? 'bg-rose-100 text-rose-700'
                                : c.anySoon
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-700'
                            }`}
                          >
                            {c.anyOverdue ? 'Po terminie' : c.anySoon ? 'Wkrótce' : 'OK'}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {}
        {/* ==================================================== */}
        {/* WIDOK 3: PLANER DNIA I TYGODNIA + TRASA GOOGLE MAPS  */}
        {/* ==================================================== */}
        {activeTab === 'planner' && (
          <div className="space-y-6">
            {/* Pasek sterowania Planerem */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex rounded-xl bg-slate-100 p-1">
                  <button
                    onClick={() => setPlannerMode('day')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition ${
                      plannerMode === 'day' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                    }`}
                  >
                    Plan Dnia + Trasa
                  </button>
                  <button
                    onClick={() => setPlannerMode('week')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition ${
                      plannerMode === 'week' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                    }`}
                  >
                    Plan Tygodnia (7 dni)
                  </button>
                </div>

                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1">
                  <button
                    onClick={() => shiftDate(plannerMode === 'day' ? -1 : -7)}
                    className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-600"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="bg-transparent text-xs sm:text-sm font-bold text-slate-800 focus:outline-none px-1"
                  />
                  <button
                    onClick={() => shiftDate(plannerMode === 'day' ? 1 : 7)}
                    className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-600"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setSelectedDate(toLocalYMD(new Date()))}
                    className="text-xs font-semibold text-sky-600 hover:text-sky-700 px-2 py-1 border-l border-slate-200"
                  >
                    Dzisiaj
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => openScheduleModal('', selectedDate)}
                  className="bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 shadow-sm whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" /> Dodaj wizytę
                </button>
              </div>
            </div>

            {plannerMode === 'day' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-4">
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100">
                      <h2 className="text-base sm:text-lg font-bold text-slate-900">
                        Plan na dzień:{' '}
                        <span className="text-sky-600">
                          {new Date(selectedDate + 'T12:00:00').toLocaleDateString('pl-PL', {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                          })}
                        </span>
                      </h2>
                      <div className="flex items-center gap-2">
                        {selectedDayVisits.length > 1 && (
                          <button
                            type="button"
                            onClick={() => sortDayVisitsByTime(selectedDayVisits)}
                            className="px-3 py-1 rounded-full bg-slate-100 hover:bg-sky-50 text-slate-700 hover:text-sky-700 text-xs font-bold border border-slate-200 flex items-center gap-1 transition"
                            title="Ułóż punkty trasy dokładnie według ustalonych godzin"
                          >
                            <Clock className="w-3.5 h-3.5 text-sky-600" />
                            Ułóż wg godzin
                          </button>
                        )}
                        <span className="bg-sky-50 text-sky-700 font-bold text-xs px-3 py-1 rounded-full border border-sky-200">
                          Wizyty: {selectedDayVisits.length}
                        </span>
                      </div>
                    </div>

                    {selectedDayVisits.length === 0 ? (
                      <div className="text-center py-12">
                        <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                        <p className="text-sm font-medium text-slate-600">Brak zaplanowanych wizyt w tym dniu.</p>
                        <button
                          onClick={() => openScheduleModal('', selectedDate)}
                          className="mt-4 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold px-4 py-2 rounded-xl"
                        >
                          + Zaplanuj wizytę na ten dzień
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {selectedDayVisits.map((visit, index) => {
                          const client = clientsWithStatus.find(c => c.id === visit.clientId);
                          const targetDev =
                            client?.devices?.find(d => d.id === visit.deviceId) ||
                            client?.mostUrgentDevice ||
                            client?.devices?.[0];
                          const devInfo = getDeviceInfo(targetDev?.deviceType);

                          return (
                            <div
                              key={visit.id}
                              className={`p-4 rounded-2xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                                visit.status === 'completed'
                                  ? 'bg-emerald-50/40 border-emerald-200 opacity-80'
                                  : 'bg-white border-slate-200 hover:border-sky-300 shadow-2xs'
                              }`}
                            >
                              <div className="flex items-start gap-3.5">
                                <div className="flex flex-col items-center gap-1">
                                  <div className="w-8 h-8 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center">
                                    {index + 1}
                                  </div>
                                  <div className="flex flex-col gap-0.5">
                                    <button
                                      onClick={() => moveVisitOrder(visit, 'up', selectedDayVisits)}
                                      disabled={index === 0}
                                      className="p-0.5 text-slate-400 hover:text-slate-800 disabled:opacity-25"
                                    >
                                      <ArrowUp className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => moveVisitOrder(visit, 'down', selectedDayVisits)}
                                      disabled={index === selectedDayVisits.length - 1}
                                      className="p-0.5 text-slate-400 hover:text-slate-800 disabled:opacity-25"
                                    >
                                      <ArrowDown className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>

                                <div className="space-y-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="inline-flex items-center gap-1 text-xs font-extrabold text-sky-700 bg-sky-50 px-2.5 py-0.5 rounded-md border border-sky-200">
                                      <Clock className="w-3 h-3" /> {visit.time}
                                    </span>
                                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700">
                                      {visit.serviceType}
                                    </span>
                                    {targetDev && (
                                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${devInfo.bg} ${devInfo.color}`}>
                                        {devInfo.short}: {targetDev.deviceModel}
                                      </span>
                                    )}
                                  </div>

                                  {client ? (
                                    <>
                                      <h3 className="text-base font-bold text-slate-900">{client.name}</h3>
                                      <div className="text-xs text-slate-600 flex flex-wrap items-center gap-3">
                                        <span className="flex items-center gap-1">
                                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                          {client.postalCode} {client.city}, {client.street}
                                        </span>
                                        <a href={`tel:${client.phone}`} className="flex items-center gap-1 text-sky-600 font-semibold hover:underline">
                                          <Phone className="w-3.5 h-3.5" /> {client.phone}
                                        </a>
                                      </div>
                                    </>
                                  ) : (
                                    <p className="text-sm text-rose-500">Klient został usunięty</p>
                                  )}

                                  {visit.notes && (
                                    <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-200/70 mt-1">
                                      📝 {visit.notes}
                                    </p>
                                  )}
                                </div>
                              </div>

                              <div className="flex sm:flex-col items-center sm:items-end justify-end gap-2 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                                <button
                                  onClick={() => toggleVisitStatus(visit)}
                                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
                                    visit.status === 'completed'
                                      ? 'bg-emerald-600 text-white'
                                      : 'bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700'
                                  }`}
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  {visit.status === 'completed' ? 'Wykonana (pomijana w trasie)' : 'Oznacz jako wykonaną'}
                                </button>

                                <button
                                  onClick={() =>
                                    setDeleteConfirm({
                                      type: 'visit',
                                      id: visit.id,
                                      title: `wizytę (${visit.time}) u klienta ${client?.name || ''}`
                                    })
                                  }
                                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg"
                                  title="Usuń wizytę z planu"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Panel Eksportu Trasy do Google Maps */}
                <div className="space-y-4">
                  <div className="bg-slate-900 text-white rounded-2xl shadow-lg p-5 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-sky-500/20 text-sky-400">
                        <Navigation className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold">Nawigacja i Trasa Dnia</h3>
                        <p className="text-xs text-slate-400">Eksport punktów do Google Maps</p>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-800/90 border border-slate-700 text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-300">Punkt początkowy:</span>
                        <span className="font-bold text-sky-400 flex items-center gap-1">
                          <Crosshair className="w-3.5 h-3.5" /> Moja lokalizacja
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-300">Kolejność punktów:</span>
                        <span className="font-bold text-amber-300 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" /> Według ustalonych godzin
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-300">Wszystkie wizyty w dniu:</span>
                        <span className="font-bold text-white">{selectedDayVisits.length}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-300">Wykonane (pomijane w trasie):</span>
                        <span className="font-bold text-emerald-400">
                          {selectedDayVisits.filter(v => v.status === 'completed').length}
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-1.5 border-t border-slate-700">
                        <span className="text-slate-200 font-semibold">Adresy do przejechania:</span>
                        <span className="font-extrabold text-amber-400 text-sm">
                          {getPendingVisitsForRoute(selectedDayVisits).length} pkt.
                        </span>
                      </div>
                    </div>

                    {/* Podgląd kolejności godzinowej eksportowanej trasy */}
                    {getPendingVisitsForRoute(selectedDayVisits).length > 0 && (
                      <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5">
                        <div className="text-[11px] font-bold uppercase text-slate-400">
                          Kolejność przejazdu wg godzin:
                        </div>
                        {getPendingVisitsForRoute(selectedDayVisits).map((v, i) => {
                          const c = clientsWithStatus.find(cl => cl.id === v.clientId);
                          return (
                            <div key={v.id} className="text-xs flex items-center justify-between text-slate-300">
                              <span className="truncate">
                                <strong className="text-sky-400">{i + 1}. [{v.time}]</strong> {c ? c.name : 'Klient'}
                              </span>
                              <span className="text-[11px] text-slate-500 ml-2 shrink-0">{c?.city}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      💡 Trasa w Google Maps układana jest chronologicznie według ustalonych godzin wizyt, a wizyty oznaczone jako <strong>Wykonano</strong> są automatycznie pomijane.
                    </p>

                    {(() => {
                      const pendingCount = getPendingVisitsForRoute(selectedDayVisits).length;
                      return pendingCount > 0 ? (
                        <button
                          type="button"
                          onClick={() => handleOpenGoogleMapsRoute(selectedDayVisits)}
                          className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold py-3 px-4 rounded-xl shadow-lg flex items-center justify-center gap-2 transition"
                        >
                          <Navigation className="w-5 h-5" />
                          <span>Eksportuj trasę wg godzin ({pendingCount})</span>
                          <ExternalLink className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          disabled
                          className="w-full bg-slate-800 text-slate-500 font-semibold py-3 px-4 rounded-xl border border-slate-700 cursor-not-allowed text-xs"
                        >
                          {selectedDayVisits.length > 0
                            ? 'Wszystkie wizyty na ten dzień zostały już wykonane!'
                            : 'Dodaj wizyty, aby wyznaczyć trasę'}
                        </button>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}

            {/* PODGLĄD TYGODNIA Z MOŻLIWOŚCIĄ USUNIĘCIA WYJAZDU */}
            {plannerMode === 'week' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-3">
                {weekDays.map((day) => {
                  const isToday = day.ymd === todayYMD;
                  const pendingDayCount = getPendingVisitsForRoute(day.visits).length;
                  return (
                    <div
                      key={day.ymd}
                      className={`bg-white rounded-2xl border flex flex-col justify-between overflow-hidden ${
                        isToday ? 'border-sky-500 ring-2 ring-sky-500/20' : 'border-slate-200'
                      }`}
                    >
                      <div>
                        <div
                          onClick={() => {
                            setSelectedDate(day.ymd);
                            setPlannerMode('day');
                          }}
                          className={`p-3 border-b cursor-pointer transition ${
                            isToday ? 'bg-sky-600 text-white' : 'bg-slate-50 hover:bg-slate-100 text-slate-800'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wider">{day.label}</span>
                            <span className={`text-xs font-extrabold ${isToday ? 'text-sky-100' : 'text-slate-500'}`}>
                              {day.shortDate}
                            </span>
                          </div>
                        </div>

                        <div className="p-2.5 space-y-2 min-h-[240px]">
                          {day.visits.length === 0 ? (
                            <div className="h-36 flex items-center justify-center text-center">
                              <span className="text-[11px] text-slate-400">Brak wyjazdów</span>
                            </div>
                          ) : (
                            day.visits.map((v) => {
                              const client = clientsWithStatus.find(c => c.id === v.clientId);
                              return (
                                <div
                                  key={v.id}
                                  className={`p-2.5 rounded-xl border text-xs space-y-1.5 transition ${
                                    v.status === 'completed'
                                      ? 'bg-emerald-50 border-emerald-200 text-emerald-950 opacity-75'
                                      : 'bg-slate-50 hover:bg-white border-slate-200'
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="font-extrabold text-sky-700">{v.time}</span>
                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => toggleVisitStatus(v)}
                                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition ${
                                          v.status === 'completed'
                                            ? 'bg-emerald-600 text-white'
                                            : 'bg-slate-200 text-slate-700 hover:bg-emerald-100'
                                        }`}
                                        title="Oznacz jako wykonaną / niewykonaną"
                                      >
                                        {v.status === 'completed' ? 'Wykonano' : 'Plan'}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setDeleteConfirm({
                                            type: 'visit',
                                            id: v.id,
                                            title: `wyjazd (${day.shortDate}, godz. ${v.time}) u klienta ${client?.name || ''}`
                                          })
                                        }
                                        className="p-1 rounded hover:bg-rose-100 text-slate-400 hover:text-rose-600 transition"
                                        title="Usuń ten wyjazd"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                  <div className="font-bold text-slate-900 truncate">
                                    {client ? client.name : 'Usunięty'}
                                  </div>
                                  {client && (
                                    <div className="text-[11px] text-slate-500 truncate">
                                      📍 {client.city}
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>

                      <div className="p-2 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-1">
                        <button
                          onClick={() => openScheduleModal('', day.ymd)}
                          className="text-[11px] font-semibold text-sky-600 hover:text-sky-800 px-2 py-1"
                        >
                          + Dodaj
                        </button>
                        {pendingDayCount > 0 && (
                          <button
                            type="button"
                            onClick={() => handleOpenGoogleMapsRoute(day.visits)}
                            className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-0.5 px-2 py-1"
                            title="Eksportuj niewykonane wizyty z tego dnia do Google Maps"
                          >
                            <Navigation className="w-3 h-3" /> Trasa ({pendingDayCount})
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>
      </div>

      {/* ==================================================== */}
      {/* MODAL: PRZEGLĄDY URZĄDZEŃ KLIENTA (BEZ USUWANIA HISTORII) */}
      {/* ==================================================== */}
      {inspectionModalClient && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ClipboardCheck className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="text-base font-bold">Przeglądy Urządzeń Klienta</h3>
                  <p className="text-xs text-slate-400">
                    {inspectionModalClient.name} • {inspectionModalClient.city}, {inspectionModalClient.street}
                  </p>
                </div>
              </div>
              <button onClick={() => setInspectionModalClientId(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[82vh] overflow-y-auto">
              {/* Wybór urządzenia klienta (jeśli ma 2 lub 3 urządzenia) */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-2">
                  Wybierz urządzenie klienta ({inspectionModalClient.devices.length}):
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {inspectionModalClient.devices.map((dev) => {
                    const dInfo = getDeviceInfo(dev.deviceType);
                    const DevIcon = dInfo.icon;
                    const isSelected = dev.id === selectedDeviceIdForInspection;
                    const st = dev.statusInfo;
                    return (
                      <button
                        key={dev.id}
                        type="button"
                        onClick={() => {
                          setSelectedDeviceIdForInspection(dev.id);
                          const today = toLocalYMD(new Date());
                          setNewInspectionForm(prev => ({
                            ...prev,
                            date: today,
                            nextDate: addMonthsToYMD(today, dev.inspectionIntervalMonths || 12)
                          }));
                        }}
                        className={`p-3 rounded-xl border text-left transition flex items-start justify-between gap-2 ${
                          isSelected
                            ? 'bg-sky-50 border-sky-500 ring-2 ring-sky-500/20'
                            : 'bg-slate-50 hover:bg-white border-slate-200'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-1.5">
                            <DevIcon className={`w-4 h-4 ${dInfo.color}`} />
                            <span className="text-xs font-bold text-slate-900">{dev.deviceModel}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-1">
                            Następny przegląd: <strong>{st.nextInspectionFormatted}</strong>
                          </div>
                        </div>
                        {st.remindersCanceled ? (
                          <span className="text-[10px] font-bold bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full">
                            Wyłączone
                          </span>
                        ) : st.isInspectionOverdue ? (
                          <span className="text-[10px] font-bold bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full">
                            Po terminie
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                            Aktywne
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {(() => {
                const activeDevice =
                  inspectionModalClient.devices.find(d => d.id === selectedDeviceIdForInspection) ||
                  inspectionModalClient.devices[0];
                if (!activeDevice) return null;
                const st = activeDevice.statusInfo;

                return (
                  <>
                    {/* Podsumowanie i przyciski Anulowania dla wybranego urządzenia */}
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div>
                          <span className="text-slate-400 block">Wybrane urządzenie:</span>
                          <span className="font-bold text-slate-900 text-sm">{activeDevice.deviceModel}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Ostatni przegląd:</span>
                          <span className="font-bold text-slate-800 text-sm">{st.lastInspectionFormatted}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Termin kolejnego przeglądu:</span>
                          <span
                            className={`font-extrabold text-sm ${
                              st.remindersCanceled
                                ? 'text-slate-400 line-through'
                                : st.isInspectionOverdue
                                ? 'text-rose-600'
                                : 'text-emerald-700'
                            }`}
                          >
                            {st.nextInspectionFormatted}
                          </span>
                        </div>
                      </div>

                      {/* DWA PRZYCISKI ANULOWANIA PRZEGLĄDU */}
                      <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-600">Opcje anulowania przeglądu:</span>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleSkipCurrentInspection(inspectionModalClient, activeDevice.id)}
                            className="px-3 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 text-xs font-bold flex items-center gap-1.5 transition"
                          >
                            <FastForward className="w-3.5 h-3.5" />
                            Anuluj aktualny przegląd (+1 rok)
                          </button>

                          {st.remindersCanceled ? (
                            <button
                              type="button"
                              onClick={() => handleToggleCancelDeviceReminders(inspectionModalClient, activeDevice.id, false)}
                              className="px-3 py-1.5 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-emerald-300 text-xs font-bold flex items-center gap-1.5 transition"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              Wznów przypomnienia
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleToggleCancelDeviceReminders(inspectionModalClient, activeDevice.id, true)}
                              className="px-3 py-1.5 rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-300 text-xs font-bold flex items-center gap-1.5 transition"
                            >
                              <Ban className="w-3.5 h-3.5" />
                              Anuluj (wyłącz przypomnienia z urządzenia)
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Formularz wbicia nowego przeglądu */}
                    <form
                      onSubmit={handleRegisterInspection}
                      className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-3"
                    >
                      <h4 className="text-xs font-extrabold uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                        <Plus className="w-4 h-4" /> Wbij wykonany przegląd dla: {activeDevice.deviceModel}
                      </h4>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">Data wykonania</label>
                          <input
                            type="date"
                            required
                            value={newInspectionForm.date}
                            onChange={(e) => {
                              const val = e.target.value;
                              setNewInspectionForm(prev => ({
                                ...prev,
                                date: val,
                                nextDate: addMonthsToYMD(val, activeDevice.inspectionIntervalMonths || 12)
                              }));
                            }}
                            className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">Kolejny przegląd</label>
                          <input
                            type="date"
                            required
                            value={newInspectionForm.nextDate}
                            onChange={(e) => setNewInspectionForm(prev => ({ ...prev, nextDate: e.target.value }))}
                            className="w-full px-3 py-2 border border-emerald-400 rounded-xl text-xs bg-white font-bold text-emerald-900"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">Serwisant</label>
                          <input
                            type="text"
                            value={newInspectionForm.technician}
                            onChange={(e) => setNewInspectionForm(prev => ({ ...prev, technician: e.target.value }))}
                            className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Notatka z przeglądu / Protokół</label>
                        <input
                          type="text"
                          value={newInspectionForm.notes}
                          onChange={(e) => setNewInspectionForm(prev => ({ ...prev, notes: e.target.value }))}
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white"
                        />
                      </div>

                      <div className="flex justify-end">
                        <button
                          type="submit"
                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm flex items-center gap-1.5 transition"
                        >
                          <Check className="w-4 h-4" /> Zapisz wykonany przegląd
                        </button>
                      </div>
                    </form>

                    {/* Historia przeglądów wybranego urządzenia (TRWAŁY REJESTR - BEZ MOŻLIWOŚCI USUWANIA) */}
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                        <History className="w-4 h-4" /> Historia przeglądów urządzenia ({activeDevice.inspectionHistory?.length || 0})
                      </h4>
                      {!activeDevice.inspectionHistory || activeDevice.inspectionHistory.length === 0 ? (
                        <div className="text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-500">
                          Brak zarejestrowanych wcześniejszych przeglądów w historii tego urządzenia.
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                          {activeDevice.inspectionHistory.map((item) => (
                            <div
                              key={item.id}
                              className="p-3 rounded-xl border border-slate-200 bg-white flex items-start justify-between gap-2 text-xs"
                            >
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-900">{formatDatePL(item.date)}</span>
                                  <span className="text-slate-500">• {item.technician}</span>
                                </div>
                                <p className="text-slate-600 mt-0.5">{item.notes}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {}
      {/* ==================================================== */}
      {/* MODAL: DODAJ / EDYTUJ KLIENTA (2, 3 LUB WIĘCEJ URZĄDZEŃ POD JEDNYM NAZWISKIEM) */}
      {/* ==================================================== */}
      {isClientModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="text-base font-bold">
                {editingClient ? `Edycja klienta: ${editingClient.name}` : 'Nowy klient w bazie PP'}
              </h3>
              <button onClick={() => setIsClientModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveClient} className="p-6 space-y-5 max-h-[82vh] overflow-y-auto">
              {/* Dane kontaktowe i adresowe */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Imię i nazwisko / Firma *</label>
                  <input
                    type="text"
                    required
                    value={clientForm.name}
                    onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })}
                    placeholder="np. Jan Kowalski"
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Numer telefonu *</label>
                  <input
                    type="text"
                    required
                    value={clientForm.phone}
                    onChange={(e) => setClientForm({ ...clientForm, phone: e.target.value })}
                    placeholder="np. +48 600 100 200"
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Kod pocztowy</label>
                  <input
                    type="text"
                    value={clientForm.postalCode}
                    onChange={(e) => setClientForm({ ...clientForm, postalCode: e.target.value })}
                    placeholder="60-101"
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Miejscowość *</label>
                  <input
                    type="text"
                    required
                    value={clientForm.city}
                    onChange={(e) => setClientForm({ ...clientForm, city: e.target.value })}
                    placeholder="np. Poznań"
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Ulica i numer *</label>
                  <input
                    type="text"
                    required
                    value={clientForm.street}
                    onChange={(e) => setClientForm({ ...clientForm, street: e.target.value })}
                    placeholder="np. ul. Słoneczna 15"
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm"
                  />
                </div>
              </div>

              {/* Współrzędne GPS */}
              <div className="p-3.5 rounded-xl bg-sky-50 border border-sky-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500">Szerokość (Lat)</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={clientForm.lat}
                      onChange={(e) => setClientForm({ ...clientForm, lat: e.target.value })}
                      className="w-28 px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500">Długość (Lng)</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={clientForm.lng}
                      onChange={(e) => setClientForm({ ...clientForm, lng: e.target.value })}
                      className="w-28 px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleGeocodeAddress}
                  disabled={geocodingLoading}
                  className="bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold px-3.5 py-2 rounded-xl shadow-sm transition"
                >
                  {geocodingLoading ? 'Szukanie GPS...' : '📍 Pobierz współrzędne z adresu'}
                </button>
              </div>

              {/* LISTA URZĄDZEŃ KLIENTA (MOŻLIWOŚĆ DODANIA 2, 3 LUB WIĘCEJ URZĄDZEŃ) */}
              <div className="space-y-3 pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">
                      Urządzenia przypisane do klienta ({clientForm.devices.length})
                    </h4>
                    <p className="text-xs text-slate-500">
                      Wszystkie dodane tutaj urządzenia wyświetlą się w bazie pod jednym nazwiskiem klienta
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddDeviceInForm}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-sm transition"
                  >
                    <Plus className="w-4 h-4" /> Dodaj kolejne urządzenie
                  </button>
                </div>

                <div className="space-y-3">
                  {clientForm.devices.map((dev, index) => (
                    <div
                      key={dev.id}
                      className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold uppercase tracking-wider text-sky-700 bg-sky-100 px-2.5 py-0.5 rounded-full">
                          Urządzenie #{index + 1}
                        </span>
                        {clientForm.devices.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveDeviceInForm(dev.id)}
                            className="text-xs font-bold text-rose-600 hover:underline flex items-center gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Usuń urządzenie
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">Rodzaj instalacji</label>
                          <select
                            value={dev.deviceType}
                            onChange={(e) => handleUpdateDeviceInForm(dev.id, 'deviceType', e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white"
                          >
                            <option value="heat_pump">🔥 Pompa ciepła</option>
                            <option value="ac">❄️ Klimatyzacja</option>
                            <option value="ventilation">💨 Wentylacja / Rekuperacja</option>
                          </select>
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">Marka i model urządzenia *</label>
                          <input
                            type="text"
                            required
                            value={dev.deviceModel}
                            onChange={(e) => handleUpdateDeviceInForm(dev.id, 'deviceModel', e.target.value)}
                            placeholder="np. Panasonic Aquarea 9kW / Gree Amber 3.5kW"
                            className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">Data montażu</label>
                          <input
                            type="date"
                            value={dev.installDate}
                            onChange={(e) => handleUpdateDeviceInForm(dev.id, 'installDate', e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">Gwarancja</label>
                          <select
                            value={dev.warrantyMonths}
                            onChange={(e) => handleUpdateDeviceInForm(dev.id, 'warrantyMonths', Number(e.target.value))}
                            className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white"
                          >
                            <option value={12}>12 miesięcy (1 rok)</option>
                            <option value={24}>24 miesiące (2 lata)</option>
                            <option value={36}>36 miesięcy (3 lata)</option>
                            <option value={60}>60 miesięcy (5 lat)</option>
                            <option value={84}>84 miesiące (7 lat)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold uppercase text-emerald-700 mb-1">Następny przegląd</label>
                          <input
                            type="date"
                            value={dev.nextInspectionDate}
                            onChange={(e) => handleUpdateDeviceInForm(dev.id, 'nextInspectionDate', e.target.value)}
                            className="w-full px-3 py-2 border border-emerald-300 bg-emerald-50/40 rounded-xl text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Notatki serwisowe klienta</label>
                <textarea
                  rows={2}
                  value={clientForm.notes}
                  onChange={(e) => setClientForm({ ...clientForm, notes: e.target.value })}
                  placeholder="Dodatkowe informacje o kliencie lub instalacji..."
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsClientModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-100"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold shadow-sm"
                >
                  {editingClient ? 'Zapisz zmiany' : 'Dodaj klienta do bazy'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {}
      {/* ==================================================== */}
      {/* MODAL: ZAPLANUJ WIZYTĘ W PP (Z WYSZUKIWANIEM WPISYWANYM) */}
      {/* ==================================================== */}
      {isVisitModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden my-8">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="text-base font-bold">Zaplanuj wizytę w PP</h3>
              <button onClick={() => setIsVisitModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveVisit} className="p-6 space-y-4">
              {/* Wyszukiwarka wpisywana dla klienta */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Wyszukaj i wybierz klienta *
                </label>
                <div className="relative mb-2">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={visitClientSearch}
                    onChange={(e) => {
                      const val = e.target.value;
                      setVisitClientSearch(val);
                      const q = val.trim().toLowerCase();
                      if (q) {
                        const firstMatch = clientsWithStatus.find(
                          c =>
                            c.name?.toLowerCase().includes(q) ||
                            c.city?.toLowerCase().includes(q) ||
                            c.street?.toLowerCase().includes(q) ||
                            c.phone?.toLowerCase().includes(q) ||
                            c.devices.some(d => d.deviceModel?.toLowerCase().includes(q))
                        );
                        if (firstMatch) {
                          setVisitForm(prev => ({
                            ...prev,
                            clientId: firstMatch.id,
                            deviceId: firstMatch.devices[0]?.id || ''
                          }));
                        }
                      }
                    }}
                    placeholder="Wpisz nazwisko, miasto, ulicę, telefon lub urządzenie..."
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                {/* Lista pasujących klientów do kliknięcia */}
                <div className="max-h-36 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100 bg-white">
                  {searchableClientsForVisit.length === 0 ? (
                    <div className="p-3 text-xs text-slate-400 text-center">
                      Brak klientów pasujących do wpisanej frazy.
                    </div>
                  ) : (
                    searchableClientsForVisit.map(c => {
                      const isSelected = visitForm.clientId === c.id;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() =>
                            setVisitForm(prev => ({
                              ...prev,
                              clientId: c.id,
                              deviceId: c.devices[0]?.id || ''
                            }))
                          }
                          className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between transition ${
                            isSelected ? 'bg-sky-50 text-sky-900 font-bold' : 'hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <div>
                            <span className="font-bold">{c.name}</span> — {c.city}, {c.street}
                            <span className="text-[11px] text-slate-400 block">
                              Urządzenia: {c.devices.map(d => d.deviceModel).join(', ')}
                            </span>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-sky-600 shrink-0" />}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Wybór konkretnego urządzenia klienta (jeśli ma więcej niż 1) */}
              {(() => {
                const chosenClient = clientsWithStatus.find(c => c.id === visitForm.clientId);
                if (!chosenClient || chosenClient.devices.length <= 1) return null;
                return (
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                      Wybierz urządzenie klienta ({chosenClient.devices.length})
                    </label>
                    <select
                      value={visitForm.deviceId}
                      onChange={(e) => setVisitForm({ ...visitForm, deviceId: e.target.value })}
                      className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm bg-white"
                    >
                      {chosenClient.devices.map(d => (
                        <option key={d.id} value={d.id}>
                          {getDeviceInfo(d.deviceType).short}: {d.deviceModel}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })()}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Data wizyty *</label>
                  <input
                    type="date"
                    required
                    value={visitForm.date}
                    onChange={(e) => setVisitForm({ ...visitForm, date: e.target.value })}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Godzina (ustala kolejność w trasie)</label>
                  <input
                    type="time"
                    value={visitForm.time}
                    onChange={(e) => setVisitForm({ ...visitForm, time: e.target.value })}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Rodzaj zlecenia</label>
                <select
                  value={visitForm.serviceType}
                  onChange={(e) => setVisitForm({ ...visitForm, serviceType: e.target.value })}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm bg-white"
                >
                  <option value="Przegląd okresowy / Gwarancyjny">Przegląd okresowy / Gwarancyjny</option>
                  <option value="Serwis / Awaria">Serwis / Awaria</option>
                  <option value="Montaż nowej instalacji">Montaż nowej instalacji</option>
                  <option value="Pierwsze uruchomienie">Pierwsze uruchomienie</option>
                  <option value="Wycena / Audyt na miejscu">Wycena / Audyt na miejscu</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Notatki do wyjazdu</label>
                <textarea
                  rows={2}
                  value={visitForm.notes}
                  onChange={(e) => setVisitForm({ ...visitForm, notes: e.target.value })}
                  placeholder="Co zabrać ze sobą, jakie filtry lub części..."
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsVisitModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-100"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold shadow-sm"
                >
                  Dodaj do harmonogramu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: DODAJ URZĄDZENIE DO KLIENTA (Z ROZWIJANYMI LISTAMI I WYSZUKIWARKĄ) */}
      {/* ==================================================== */}
      {isAddDeviceModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Wrench className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="text-base font-bold">Dodaj urządzenie do klienta</h3>
                  <p className="text-xs text-slate-400">
                    Wybierz klienta oraz model z rozwijanych list z wyszukiwarką
                  </p>
                </div>
              </div>
              <button onClick={() => setIsAddDeviceModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAssignedDeviceToClient} className="p-6 space-y-4">
              {/* 1. ROZWIJANA LISTA Z WYSZUKIWANIEM KLIENTA */}
              <div className="relative">
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  1. Wybierz klienta (rozwijana lista z wyszukiwaniem) *
                </label>

                {(() => {
                  const selectedClientObj = clientsWithStatus.find(c => c.id === assignDeviceForm.clientId);
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        setClientDropdownOpen(prev => !prev);
                        setCatalogDropdownOpen(false);
                      }}
                      className="w-full px-3.5 py-2.5 bg-slate-50 hover:bg-white border border-slate-300 rounded-xl text-left text-sm flex items-center justify-between transition"
                    >
                      <div className="truncate">
                        {selectedClientObj ? (
                          <span className="font-bold text-slate-900">
                            {selectedClientObj.name} — <span className="font-normal text-slate-600">{selectedClientObj.city}, {selectedClientObj.street}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400">Kliknij, aby rozwinąć i wyszukać klienta...</span>
                        )}
                      </div>
                      <ArrowDown className="w-4 h-4 text-slate-500 shrink-0 ml-2" />
                    </button>
                  );
                })()}

                {clientDropdownOpen && (
                  <div className="mt-1 border border-slate-300 rounded-2xl bg-white shadow-xl overflow-hidden z-20">
                    <div className="p-2 bg-slate-50 border-b border-slate-200 relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        autoFocus
                        value={clientDropdownSearch}
                        onChange={(e) => setClientDropdownSearch(e.target.value)}
                        placeholder="Wpisz nazwisko, miasto, ulicę lub telefon..."
                        className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    </div>
                    <div className="max-h-48 overflow-y-auto divide-y divide-slate-100">
                      {filteredClientsForDropdown.length === 0 ? (
                        <div className="p-3 text-xs text-slate-400 text-center">Brak pasujących klientów</div>
                      ) : (
                        filteredClientsForDropdown.map(c => {
                          const isSelected = assignDeviceForm.clientId === c.id;
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                setAssignDeviceForm(prev => ({ ...prev, clientId: c.id }));
                                setClientDropdownOpen(false);
                              }}
                              className={`w-full text-left px-3.5 py-2.5 text-xs flex items-center justify-between transition ${
                                isSelected ? 'bg-sky-50 text-sky-950 font-bold' : 'hover:bg-slate-50 text-slate-700'
                              }`}
                            >
                              <div>
                                <div className="font-bold">{c.name} ({c.devices.length} urz.)</div>
                                <div className="text-[11px] text-slate-500">📍 {c.city}, {c.street} • 📞 {c.phone}</div>
                              </div>
                              {isSelected && <Check className="w-4 h-4 text-sky-600 shrink-0" />}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* 2. ROZWIJANA LISTA Z WYSZUKIWANIEM URZĄDZENIA Z BAZY URZĄDZEŃ */}
              <div className="relative">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold uppercase text-slate-600">
                    2. Wybierz urządzenie z Bazy Urządzeń (rozwijana lista z wyszukiwarką) *
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddDeviceModalOpen(false);
                      setActiveTab('devices_db');
                    }}
                    className="text-[11px] font-bold text-sky-600 hover:underline"
                  >
                    + Zarządzaj Bazą Urządzeń
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setCatalogDropdownOpen(prev => !prev);
                    setClientDropdownOpen(false);
                  }}
                  className="w-full px-3.5 py-2.5 bg-slate-50 hover:bg-white border border-slate-300 rounded-xl text-left text-sm flex items-center justify-between transition"
                >
                  <div className="truncate">
                    {assignDeviceForm.deviceModel ? (
                      <span className="font-bold text-slate-900">
                        {getDeviceInfo(assignDeviceForm.deviceType).short}: {assignDeviceForm.deviceModel}
                      </span>
                    ) : (
                      <span className="text-slate-400">Kliknij, aby rozwinąć i wyszukać model z bazy...</span>
                    )}
                  </div>
                  <ArrowDown className="w-4 h-4 text-slate-500 shrink-0 ml-2" />
                </button>

                {catalogDropdownOpen && (
                  <div className="mt-1 border border-slate-300 rounded-2xl bg-white shadow-xl overflow-hidden z-20">
                    <div className="p-2 bg-slate-50 border-b border-slate-200 relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        autoFocus
                        value={catalogDropdownSearch}
                        onChange={(e) => setCatalogDropdownSearch(e.target.value)}
                        placeholder="Wpisz markę, model lub typ (np. Panasonic, Gree, Pompa)..."
                        className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    </div>
                    <div className="max-h-52 overflow-y-auto divide-y divide-slate-100">
                      {filteredCatalogForDropdown.length === 0 ? (
                        <div className="p-3 text-xs text-slate-400 text-center">
                          Brak modelu w bazie — możesz wpisać jego nazwę ręcznie poniżej.
                        </div>
                      ) : (
                        filteredCatalogForDropdown.map(cat => {
                          const dInfo = getDeviceInfo(cat.deviceType);
                          const isSelected = assignDeviceForm.catalogDeviceId === cat.id;
                          return (
                            <button
                              key={cat.id}
                              type="button"
                              onClick={() => handleSelectCatalogModelInModal(cat)}
                              className={`w-full text-left px-3.5 py-2.5 text-xs flex items-center justify-between transition ${
                                isSelected ? 'bg-emerald-50 text-emerald-950 font-bold' : 'hover:bg-slate-50 text-slate-700'
                              }`}
                            >
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${dInfo.bg} ${dInfo.color}`}>
                                    {dInfo.short}
                                  </span>
                                  <span className="font-bold text-slate-900">{cat.brand} {cat.model}</span>
                                </div>
                                <div className="text-[11px] text-slate-500 mt-0.5">
                                  Domyślna gwarancja: {cat.defaultWarrantyMonths} mies. • Przegląd co {cat.defaultIntervalMonths} mies.
                                </div>
                              </div>
                              {isSelected && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Pola szczegółowe przypisywanego urządzenia (można też doprecyzować ręcznie) */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">Typ urządzenia</label>
                    <select
                      value={assignDeviceForm.deviceType}
                      onChange={(e) => setAssignDeviceForm({ ...assignDeviceForm, deviceType: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white"
                    >
                      <option value="heat_pump">🔥 Pompa ciepła</option>
                      <option value="ac">❄️ Klimatyzacja</option>
                      <option value="ventilation">💨 Rekuperacja</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">Nazwa / Model urządzenia *</label>
                    <input
                      type="text"
                      required
                      value={assignDeviceForm.deviceModel}
                      onChange={(e) => setAssignDeviceForm({ ...assignDeviceForm, deviceModel: e.target.value })}
                      placeholder="Wybrany z listy lub wpisany ręcznie..."
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">Data montażu</label>
                    <input
                      type="date"
                      value={assignDeviceForm.installDate}
                      onChange={(e) => {
                        const val = e.target.value;
                        setAssignDeviceForm(prev => ({
                          ...prev,
                          installDate: val,
                          lastInspectionDate: val,
                          nextInspectionDate: addMonthsToYMD(val, prev.inspectionIntervalMonths)
                        }));
                      }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">Okres gwarancji</label>
                    <select
                      value={assignDeviceForm.warrantyMonths}
                      onChange={(e) => setAssignDeviceForm({ ...assignDeviceForm, warrantyMonths: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white"
                    >
                      <option value={12}>12 miesięcy</option>
                      <option value={24}>24 miesiące</option>
                      <option value={36}>36 miesięcy</option>
                      <option value={60}>60 miesięcy</option>
                      <option value={84}>84 miesiące</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase text-emerald-700 mb-1">Następny przegląd</label>
                    <input
                      type="date"
                      value={assignDeviceForm.nextInspectionDate}
                      onChange={(e) => setAssignDeviceForm({ ...assignDeviceForm, nextInspectionDate: e.target.value })}
                      className="w-full px-3 py-2 border border-emerald-300 bg-emerald-50/40 rounded-xl text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddDeviceModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-100"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold shadow-sm flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Przypisz urządzenie do klienta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: POTWIERDZENIE USUNIĘCIA                       */}
      {/* ==================================================== */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold text-slate-900">Potwierdź usunięcie</h3>
            </div>
            <p className="text-sm text-slate-600">
              Czy na pewno chcesz usunąć <strong>{deleteConfirm.title}</strong>? Tej operacji nie można cofnąć.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-100"
              >
                Anuluj
              </button>
              <button
                onClick={confirmDeleteAction}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold shadow-sm"
              >
                Usuń
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}