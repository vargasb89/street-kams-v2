import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import {
  MapPin,
  CheckCircle2,
  ListOrdered,
  Send,
  Download,
  X,
  User,
  AlertTriangle,
  Loader2,
  Clock,
  Target,
  Monitor,
  Camera,
} from 'lucide-react';

// --- CONFIGURACIÓN DE FIREBASE E IMPORTACIONES ---
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, addDoc, collection, query, onSnapshot, serverTimestamp } from 'firebase/firestore';

// 🔥 FirebaseConfig (en producción muévelo a variables de entorno)
const firebaseConfig = {
  apiKey: 'AIzaSyCqHtCOeO5gSuSy5N6qMncplymxJvuoT-s',
  authDomain: 'street-kams-v2.firebaseapp.com',
  projectId: 'street-kams-v2',
  storageBucket: 'street-kams-v2.firebasestorage.app',
  messagingSenderId: '605151403398',
  appId: '1:605151403398:web:49750bda585e1130956007',
  measurementId: 'G-P16YRWECY6',
};

const APP_ID = 'street-kams-v2';

// --- COMPONENTES UI REUTILIZABLES (MEMOIZADOS) ---

const InputField = memo(({ label, name, value, onChange, required = false, placeholder = '', icon = null }) => (
  <div className="flex flex-col">
    <label htmlFor={name} className="text-sm font-medium text-gray-700 mb-1">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <div className="relative flex items-center">
      <input
        type="text"
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        placeholder={placeholder}
        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-rappi-main focus:border-rappi-main w-full pr-10"
      />
      {icon && <div className="absolute right-3 top-1/2 -translate-y-1/2">{icon}</div>}
    </div>
  </div>
));

const SelectField = memo(
  ({ label, name, value, onChange, options, required = false, placeholder = 'Selecciona una opción' }) => (
    <div className="flex flex-col">
      <label htmlFor={name} className="text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <select
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-rappi-main focus:border-rappi-main bg-white"
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  ),
);

const TextAreaField = memo(({ label, name, value, onChange, required = false, placeholder = '' }) => (
  <div className="flex flex-col">
    <label htmlFor={name} className="text-sm font-medium text-gray-700 mb-1">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <textarea
      id={name}
      name={name}
      rows="3"
      value={value}
      onChange={onChange}
      required={required}
      placeholder={placeholder}
      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-rappi-main focus:border-rappi-main resize-none"
    />
  </div>
));

const CampaignSelector = memo(({ options, selected, onToggle }) => (
  <div>
    <label className="text-sm font-medium text-gray-700 mb-2 block">
      Tipo de Campaña (Máx. 2, Obligatorio) <span className="text-red-500">*</span>
    </label>
    <div className="flex flex-wrap gap-2">
      {options.map((campaign) => {
        const isSelected = selected.includes(campaign);
        return (
          <button
            key={campaign}
            type="button"
            onClick={() => onToggle(campaign)}
            className={`px-3 py-1.5 text-sm font-medium rounded-full transition duration-150 border ${
              isSelected
                ? 'bg-rappi-main text-white border-rappi-main shadow-md hover:bg-rappi-dark'
                : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
            }`}
          >
            {campaign}
          </button>
        );
      })}
    </div>
  </div>
));

// --- COMPONENTES DE VISTA ---

const LoadingState = () => (
  <div className="flex justify-center items-center p-8 bg-white rounded-xl shadow-lg mt-8">
    <Loader2 className="w-8 h-8 text-rappi-main animate-spin mr-3" />
    <p className="text-lg text-gray-700">Cargando aplicación y autenticando usuario...</p>
  </div>
);

const FormView = ({
  form,
  handleSubmit,
  handleChange,
  getGeoLocation,
  isCheckingIn,
  location,
  isSubmitting,
  error,
  campaignsOptions,
  brandOwnerOptions,
  handleCampaignToggle,
}) => (
  <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6 bg-white rounded-lg shadow-xl">
    <section className="border-b pb-4">
      <h2 className="text-xl font-bold text-gray-800 flex items-center mb-4">
        <MapPin className="w-5 h-5 mr-2 text-rappi-main" /> Tipo de Visita y Check-in
      </h2>

      <SelectField
        label="Tipo de Visita"
        name="visitType"
        value={form.visitType}
        onChange={handleChange}
        options={['Presencial', 'Virtual']}
        required
      />

      {form.visitType === 'Presencial' && (
        <div className="mt-4 p-4 border border-gray-200 rounded-lg space-y-3">
          <h3 className="font-semibold flex items-center text-gray-700">
            <MapPin className="w-4 h-4 mr-2" /> Check-in (Obligatorio)
          </h3>
          <div className="flex flex-col md:flex-row gap-4">
            <button
              type="button"
              onClick={getGeoLocation}
              disabled={isCheckingIn || !!location || isSubmitting}
              className={`flex-1 flex items-center justify-center px-4 py-3 text-white font-semibold rounded-lg transition duration-200 ${
                location ? 'bg-green-600 hover:bg-green-700' : 'bg-rappi-main hover:bg-rappi-dark'
              } disabled:bg-gray-400`}
            >
              {isCheckingIn && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {location ? <CheckCircle2 className="w-4 h-4 mr-2" /> : <MapPin className="w-4 h-4 mr-2" />}
              {location ? 'Ubicación Registrada' : 'Realizar Check-in'}
            </button>
            {location && (
              <div className="flex-1 bg-gray-50 p-3 rounded-lg border border-gray-200 text-sm">
                <p className="font-medium text-gray-700">Coordenadas:</p>
                <p className="text-xs text-gray-500">
                  Lat: {location.lat.toFixed(6)}, Lon: {location.lon.toFixed(6)}
                </p>
                <p
                  className={`text-xs mt-1 font-semibold ${location.isSimulated ? 'text-red-500' : 'text-green-600'}`}
                >
                  {location.isSimulated ? 'Simulada' : 'Real'} a las {location.time}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {form.visitType === 'Virtual' && (
        <div className="mt-4 p-4 border border-gray-200 rounded-lg space-y-3">
          <h3 className="font-semibold flex items-center text-gray-700">
            <Monitor className="w-4 h-4 mr-2" /> Evidencia Virtual (Obligatoria)
          </h3>
          <InputField
            label="Foto de Evidencia (Nombre del archivo o URL)"
            name="photoEvidence"
            value={form.photoEvidence}
            onChange={handleChange}
            required
            placeholder="Ej: captura-meeting-zoom.png o enlace a la foto"
            icon={<Camera className="w-4 h-4 text-gray-500" />}
          />
          <p className="text-xs text-gray-500 mt-1">
            Nota: En esta simulación, la geolocalización es opcional y se registra 'N/A' si no se realiza el
            check-in.
          </p>
        </div>
      )}

      {error && (
        <div className="mt-3 p-2 text-sm bg-red-100 text-red-700 rounded-lg flex items-center">
          <AlertTriangle className="w-4 h-4 mr-2" />
          {error}
        </div>
      )}
    </section>

    <section className="space-y-4">
      <h2 className="text-xl font-bold text-gray-800 flex items-center">
        <ListOrdered className="w-5 h-5 mr-2 text-rappi-main" /> Detalles Comerciales
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <InputField
          label="Brand ID (Obligatorio)"
          name="brandId"
          value={form.brandId}
          onChange={handleChange}
          required
          placeholder="Ej: 123456"
        />
        <InputField
          label="Nombre del Restaurante (Obligatorio)"
          name="restaurantName"
          value={form.restaurantName}
          onChange={handleChange}
          required
          placeholder="Ej: El Corral"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <InputField
          label="Decision Maker Contactado (Obligatorio)"
          name="decisionMaker"
          value={form.decisionMaker}
          onChange={handleChange}
          required
          placeholder="Ej: Juan Pérez - Gerente de Marketing"
        />
        <SelectField
          label="Brand Owner"
          name="brandOwner"
          value={form.brandOwner}
          onChange={handleChange}
          options={brandOwnerOptions}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SelectField
          label="Status Ads"
          name="seaAds"
          value={form.seaAds}
          onChange={handleChange}
          options={['New', 'Upselling', 'Blockers', 'N/A']}
          placeholder="Selecciona el estatus"
        />
        <SelectField
          label="Zona de Operación"
          name="zone"
          value={form.zone}
          onChange={handleChange}
          options={['Kennedy', 'Antonio Nariño', 'Suba', 'Engativá', 'Fontibon']}
          placeholder="Selecciona la zona"
        />
      </div>

      <CampaignSelector options={campaignsOptions} selected={form.campaigns} onToggle={handleCampaignToggle} />

      <SelectField
        label="Resultado de la Visita (Obligatorio)"
        name="outcome"
        value={form.outcome}
        onChange={handleChange}
        required
        options={['Cerrada/Exitosa', 'Seguimiento (Próx. semana)', 'Bloqueo/Rechazo', 'Cita Programada']}
        placeholder="Selecciona el resultado"
      />

      <TextAreaField
        label="Detalles y Pormenores (Obligatorio)"
        name="details"
        value={form.details}
        onChange={handleChange}
        required
        placeholder="Ej: Se acordó lanzar la promo X el día Y. El bloqueo es por falta de stock."
      />
    </section>

    <button
      type="submit"
      disabled={
        isSubmitting ||
        (form.visitType === 'Presencial' && !location) ||
        (form.visitType === 'Virtual' && !form.photoEvidence.trim()) ||
        !form.brandId ||
        !form.outcome ||
        form.campaigns.length === 0
      }
      className="w-full flex items-center justify-center px-6 py-3 bg-rappi-main text-white font-bold text-lg rounded-xl shadow-md hover:bg-rappi-dark transition duration-300 disabled:bg-gray-400 disabled:cursor-not-allowed"
    >
      {isSubmitting ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Send className="w-5 h-5 mr-2" />}
      {isSubmitting ? 'Enviando...' : 'Registrar Visita'}
    </button>

    <p className="text-xs text-gray-500 mt-4 text-center">
      *El registro se guarda de forma persistente en Firebase Firestore asociado a tu ID de usuario.
    </p>
  </form>
);

const HistoryView = ({ visits, exportToCSV }) => (
  <div className="p-6 md:p-8 bg-white rounded-lg shadow-xl">
    <div className="flex justify-between items-center mb-6 border-b pb-4">
      <h2 className="text-xl font-bold text-gray-800 flex items-center">
        <ListOrdered className="w-5 h-5 mr-2 text-rappi-main" /> Historial de Visitas ({visits.length})
      </h2>
      <button
        onClick={exportToCSV}
        disabled={visits.length === 0}
        className="flex items-center px-4 py-2 text-sm bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 transition duration-200 disabled:opacity-50"
      >
        <Download className="w-4 h-4 mr-2" />
        Exportar a CSV
      </button>
    </div>

    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
      {visits.length === 0 ? (
        <div className="text-center p-10 bg-gray-50 rounded-lg">
          <Target className="w-8 h-8 mx-auto text-gray-400 mb-3" />
          <p className="text-gray-600">Aún no has registrado ninguna visita. ¡Haz un check-in!</p>
        </div>
      ) : (
        visits.map((visit) => (
          <div
            key={visit.id}
            className="bg-gray-50 p-4 border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition duration-200"
          >
            <div className="flex justify-between items-start mb-2">
              <p className="text-lg font-semibold text-rappi-main truncate">
                {visit.restaurantName} (ID: {visit.brandId})
              </p>
              <div
                className={`px-3 py-1 text-xs font-bold rounded-full ${
                  visit.outcome?.includes('Exitosa')
                    ? 'bg-green-100 text-green-700'
                    : visit.outcome?.includes('Seguimiento')
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-red-100 text-red-700'
                }`}
              >
                {visit.outcome}
              </div>
            </div>

            <div className="text-sm text-gray-600 space-y-1">
              <p>
                <span className="font-medium">Tipo:</span> {visit.visitType || 'Presencial'}
              </p>
              <p>
                <span className="font-medium">KAM:</span> {visit.decisionMaker}
              </p>
              <p>
                <span className="font-medium">Campañas:</span> {(visit.campaigns || []).join(', ')}
              </p>
              <p className="text-xs text-gray-500 flex items-center">
                <Clock className="w-3 h-3 mr-1" />
                Registrada el:{' '}
                {visit.checkInTime?.toDate ? visit.checkInTime.toDate().toLocaleDateString() : 'Cargando...'} a las{' '}
                {visit.checkInTime?.toDate ? visit.checkInTime.toDate().toLocaleTimeString() : ''}
              </p>
              {visit.latitude && visit.latitude !== 'N/A' && (
                <p className="text-xs text-gray-500">
                  Ubicación: Lat {Number(visit.latitude).toFixed(4)}, Lon {Number(visit.longitude).toFixed(4)}
                  {visit.locationSimulated && <span className="text-red-500 font-bold ml-1">(SIMULADA)</span>}
                </p>
              )}
              {visit.photoEvidence && visit.photoEvidence !== 'N/A' && (
                <p className="text-xs text-gray-500 flex items-center">
                  <Camera className="w-3 h-3 mr-1 text-gray-500" />
                  Evidencia: {visit.photoEvidence}
                </p>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  </div>
);

const Modal = ({ message, onClose }) => (
  <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
    <div className="bg-white rounded-xl shadow-lg p-4 max-w-sm w-full flex items-start">
      <div className="flex-1 text-sm text-gray-800">{message}</div>
      <button
        type="button"
        className="ml-2 text-gray-500 hover:text-gray-800"
        onClick={onClose}
        aria-label="Cerrar"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  </div>
);

const App = () => {
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);

  // Firebase UID (se usa para rutas/ownership)
  const [userId, setUserId] = useState(null);

  // Email visible (para mostrar en UI)
  const [userEmail, setUserEmail] = useState('');

  const [isAuthReady, setIsAuthReady] = useState(false);
  const [visits, setVisits] = useState([]);

  const [currentView, setCurrentView] = useState('form');
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [location, setLocation] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [error, setError] = useState(null);

  const [form, setForm] = useState({
    visitType: 'Presencial',
    brandId: '',
    restaurantName: '',
    decisionMaker: '',
    brandOwner: '',
    seaAds: '',
    campaigns: [],
    zone: '',
    outcome: '',
    details: '',
    photoEvidence: '',
  });

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const campaignsOptions = useMemo(
    () => ['Descuento en Productos', 'Bono Adquisición de Usuarios', 'Coinversión en Markdown', 'Viral Deals'],
    [],
  );

  const brandOwnerOptions = useMemo(
    () => [
      'camilo.galeano@rappi.com',
      'melany.florez@rappi.com',
      'leidy.tibaquicha@rappi.com',
      'jorge.castillo@rappi.com',
      'michael.infante@rappi.com',
    ],
    [],
  );

  const showStatusModal = useCallback((message) => {
    setModalMessage(message);
    setShowModal(true);
    setTimeout(() => setShowModal(false), 3000);
  }, []);

  const resetForm = useCallback(() => {
    setForm({
      visitType: 'Presencial',
      brandId: '',
      restaurantName: '',
      decisionMaker: '',
      brandOwner: '',
      seaAds: '',
      campaigns: [],
      zone: '',
      outcome: '',
      details: '',
      photoEvidence: '',
    });
    setLocation(null);
    setError(null);
  }, []);

  const getGeoLocation = useCallback(() => {
    setError(null);
    setIsCheckingIn(true);
    setLocation(null);

    const simulatedLocation = { latitude: 4.629199, longitude: -74.15403 };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lon: position.coords.longitude,
            time: new Date().toLocaleTimeString(),
            isSimulated: false,
          });
          setIsCheckingIn(false);
        },
        (err) => {
          console.warn(`ERROR(${err.code}): ${err.message}. Usando ubicación simulada.`);
          setLocation({
            lat: simulatedLocation.latitude,
            lon: simulatedLocation.longitude,
            time: new Date().toLocaleTimeString(),
            isSimulated: true,
          });
          setError('No se pudo obtener la ubicación real. Se usó una ubicación simulada.');
          setIsCheckingIn(false);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
      );
    } else {
      setLocation({
        lat: simulatedLocation.latitude,
        lon: simulatedLocation.longitude,
        time: new Date().toLocaleTimeString(),
        isSimulated: true,
      });
      setError('Geolocalización no soportada por el navegador. Se usó una ubicación simulada.');
      setIsCheckingIn(false);
    }
  }, []);

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setForm((prev) => {
      const next = { ...prev, [name]: value };
      if (name === 'visitType') {
        if (value === 'Virtual') setLocation(null);
        next.photoEvidence = '';
      }
      return next;
    });
  }, []);

  const handleCampaignToggle = useCallback(
    (campaign) => {
      setForm((prevForm) => {
        const currentCampaigns = prevForm.campaigns;
        if (currentCampaigns.includes(campaign)) {
          return { ...prevForm, campaigns: currentCampaigns.filter((c) => c !== campaign) };
        }
        if (currentCampaigns.length < 2) {
          return { ...prevForm, campaigns: [...currentCampaigns, campaign] };
        }
        showStatusModal('Solo puedes seleccionar un máximo de 2 tipos de campaña.');
        return prevForm;
      });
    },
    [showStatusModal],
  );

  const handleLogin = useCallback(
    async (e) => {
      e.preventDefault();
      if (!auth) {
        setError('Auth no está inicializado.');
        return;
      }
      setIsLoggingIn(true);
      setError(null);
      try {
        await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
        showStatusModal('Sesión iniciada correctamente.');
      } catch (e) {
        console.error('Error al iniciar sesión:', e);
        setError('No se pudo iniciar sesión. Verifica tu correo y contraseña.');
      } finally {
        setIsLoggingIn(false);
      }
    },
    [auth, loginEmail, loginPassword, showStatusModal],
  );

  const handleLogout = useCallback(async () => {
    if (!auth) return;
    try {
      await signOut(auth);
      setUserId(null);
      setUserEmail('');
      setVisits([]);
      showStatusModal('Sesión cerrada.');
    } catch (e) {
      console.error('Error al cerrar sesión:', e);
      setError('No se pudo cerrar sesión.');
    }
  }, [auth, showStatusModal]);

  // --- INIT FIREBASE ---
  useEffect(() => {
    try {
      const app = initializeApp(firebaseConfig);
      const authInstance = getAuth(app);
      const dbInstance = getFirestore(app);

      setAuth(authInstance);
      setDb(dbInstance);

      const unsubscribe = onAuthStateChanged(authInstance, (user) => {
        // ✅ UID sigue existiendo (para paths), pero mostramos email en UI
        setUserId(user ? user.uid : null);
        setUserEmail(user?.email || '');
        setIsAuthReady(true);
      });

      return () => unsubscribe();
    } catch (e) {
      console.error('Error al inicializar Firebase:', e);
      setError('La configuración de Firebase no está disponible. Los datos no serán persistentes.');
      setIsAuthReady(true);
    }
  }, []);

  // --- LISTENER VISITS ---
  useEffect(() => {
    if (!db || !userId) return;

    const collectionPath = `artifacts/${APP_ID}/users/${userId}/kams_visits`;
    const q = query(collection(db, collectionPath));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        // Orden más reciente primero (si existe checkInTime)
        data.sort((a, b) => (b.checkInTime?.toDate?.() || 0) - (a.checkInTime?.toDate?.() || 0));
        setVisits(data);
      },
      (e) => {
        console.error('Error al cargar visitas:', e);
        setError('Error al cargar el historial de visitas.');
      },
    );

    return () => unsubscribe();
  }, [db, userId]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (form.visitType === 'Presencial' && !location) {
      showStatusModal('Para una visita Presencial, por favor realiza el "Check-in" de ubicación.');
      return;
    }
    if (form.visitType === 'Virtual' && !form.photoEvidence.trim()) {
      showStatusModal('Para una visita Virtual, es obligatorio adjuntar la evidencia (nombre/URL).');
      return;
    }
    if (form.campaigns.length === 0) {
      showStatusModal('Debes seleccionar al menos un Tipo de Campaña.');
      return;
    }
    if (!db || !userId) {
      setError('Debes iniciar sesión para registrar visitas.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const visitData = {
        kamId: userId,
        kamEmail: userEmail || 'N/A',
        ...form,
        latitude: location?.lat || 'N/A',
        longitude: location?.lon || 'N/A',
        locationSimulated: location?.isSimulated || false,
        checkInTime: serverTimestamp(),
      };

      const collectionPath = `artifacts/${APP_ID}/users/${userId}/kams_visits`;
      await addDoc(collection(db, collectionPath), visitData);

      showStatusModal('✅ Visita registrada con éxito en Firestore.');
      resetForm();
    } catch (e) {
      console.error('Error al guardar en Firestore:', e);
      setError('Error al guardar la visita. Inténtalo de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const exportToCSV = () => {
    if (visits.length === 0) {
      showStatusModal('No hay datos para exportar.');
      return;
    }

    const headers = [
      'ID',
      'KAM ID',
      'KAM Email',
      'Tipo Visita',
      'Marca ID',
      'Nombre Restaurante',
      'Decision Maker',
      'Brand Owner',
      'Status Ads',
      'Campañas',
      'Zona',
      'Resultado',
      'Detalles',
      'Foto Evidencia',
      'Latitud',
      'Longitud',
      'Ubicación Simulada',
      'Timestamp',
    ];

    const csvRows = [headers.join(';')];

    visits.forEach((visit) => {
      const row = [
        visit.id,
        visit.kamId || 'N/A',
        visit.kamEmail || 'N/A',
        visit.visitType || 'N/A',
        visit.brandId,
        visit.restaurantName,
        visit.decisionMaker,
        visit.brandOwner,
        visit.seaAds,
        (visit.campaigns || []).join('|'),
        visit.zone,
        visit.outcome,
        `"${(visit.details || '').replace(/"/g, '""').replace(/
?
/g, ' ')}"`,
        visit.photoEvidence || 'N/A',
        visit.latitude,
        visit.longitude,
        visit.locationSimulated ? 'Sí' : 'No',
        visit.checkInTime?.toDate ? visit.checkInTime.toDate().toISOString() : 'N/A',
      ];
      csvRows.push(row.join(';'));
    });

    const csvString = csvRows.join('
');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Visitas_KAM_Exportado_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showStatusModal('📥 Datos exportados correctamente a CSV.');
  };

  const rappiMain = '#FF5500';
  const rappiDark = '#D84800';
  const rappiAccent = '#FF7B4D';

  const userLabel = userEmail || userId || '—';

  return (
    <div
      className="min-h-screen bg-gray-100 p-4 sm:p-8 font-sans"
      style={{ '--rappi-main': rappiMain, '--rappi-dark': rappiDark }}
    >
      <style>{`
        .font-sans { font-family: 'Inter', sans-serif; }
        .bg-rappi-main { background-color: var(--rappi-main); }
        .hover\:bg-rappi-dark:hover { background-color: var(--rappi-dark); }
        .text-rappi-main { color: var(--rappi-main); }
        .focus\:ring-rappi-main:focus { --tw-ring-color: var(--rappi-main); }
        .focus\:border-rappi-main:focus { border-color: var(--rappi-main); }
        .rappi-header-bg { background: linear-gradient(135deg, var(--rappi-accent), var(--rappi-main)); }
      `}</style>

      <div className="max-w-4xl mx-auto">
        <header
          className="mb-8 p-6 rounded-xl shadow-lg border-b-4 border-rappi-dark rappi-header-bg text-white"
          style={{ '--rappi-accent': rappiAccent }}
        >
          <h1 className="text-3xl font-extrabold flex items-center drop-shadow-sm">
            Street Kams App <Target className="w-6 h-6 ml-3" />
          </h1>
          <p className="mt-1 text-gray-100 drop-shadow-sm">Registro y Monitoreo de Visitas en Campo (KAM)</p>
          <div className="mt-4 pt-3 border-t border-white border-opacity-30 flex items-center text-sm text-white">
            <User className="w-4 h-4 mr-2" />
            Usuario:{' '}
            <span className="font-mono bg-white bg-opacity-20 px-2 py-0.5 rounded ml-1 text-xs">{userLabel}</span>
          </div>
        </header>

        {!isAuthReady ? (
          <LoadingState />
        ) : !userId ? (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
              <User className="w-5 h-5 mr-2" /> Iniciar sesión
            </h2>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-700 mb-1">Correo electrónico</label>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-rappi-main focus:border-rappi-main"
                  placeholder="kam@rappi.com"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-700 mb-1">Contraseña</label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-rappi-main focus:border-rappi-main"
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <div className="p-2 text-sm bg-red-100 text-red-700 rounded-lg flex items-center">
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full flex items-center justify-center px-6 py-3 bg-rappi-main text-white font-bold text-lg rounded-xl shadow-md hover:bg-rappi-dark transition duration-300 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isLoggingIn ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <User className="w-5 h-5 mr-2" />}
                {isLoggingIn ? 'Iniciando sesión...' : 'Entrar'}
              </button>

              <p className="text-xs text-gray-500 text-center">
                * Activa Email/Password en Firebase Console → Authentication.
              </p>
            </form>
          </div>
        ) : (
          <>
            <div className="mb-4 flex justify-between items-center">
              <div className="text-sm text-gray-700">
                Sesión iniciada como <span className="font-semibold">{userLabel}</span>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-100"
              >
                Cerrar sesión
              </button>
            </div>

            <div className="mb-6 flex space-x-2 p-1 bg-white rounded-xl shadow-inner">
              <button
                onClick={() => setCurrentView('form')}
                className={`flex-1 py-3 px-4 rounded-lg font-bold transition-colors duration-200 text-sm ${
                  currentView === 'form'
                    ? 'bg-rappi-main text-white shadow-md'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                Formulario de Check-in
              </button>
              <button
                onClick={() => setCurrentView('history')}
                className={`flex-1 py-3 px-4 rounded-lg font-bold transition-colors duration-200 text-sm ${
                  currentView === 'history'
                    ? 'bg-rappi-main text-white shadow-md'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                Historial de Visitas
              </button>
            </div>

            <div className="mt-4">
              {currentView === 'form' ? (
                <FormView
                  form={form}
                  handleSubmit={handleSubmit}
                  handleChange={handleChange}
                  getGeoLocation={getGeoLocation}
                  isCheckingIn={isCheckingIn}
                  location={location}
                  isSubmitting={isSubmitting}
                  error={error}
                  campaignsOptions={campaignsOptions}
                  brandOwnerOptions={brandOwnerOptions}
                  handleCampaignToggle={handleCampaignToggle}
                />
              ) : (
                <HistoryView visits={visits} exportToCSV={exportToCSV} />
              )}
            </div>
          </>
        )}
      </div>

      {showModal && <Modal message={modalMessage} onClose={() => setShowModal(false)} />}
    </div>
  );
};

export default App;
