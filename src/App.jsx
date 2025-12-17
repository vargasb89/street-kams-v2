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
  Shield,
  Link as LinkIcon,
} from 'lucide-react';

// --- CONFIGURACIÓN DE FIREBASE E IMPORTACIONES ---
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  setPersistence,
  browserLocalPersistence,
} from 'firebase/auth';
import {
  getFirestore,
  addDoc,
  collection,
  query,
  onSnapshot,
  serverTimestamp,
  collectionGroup,
} from 'firebase/firestore';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';

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

// ✅ Define admins por UI (NO es seguridad). La seguridad real debe estar en Rules.
const ADMIN_EMAILS = ['bernardo.vargas@rappi.com'];

// --- COMPONENTES UI REUTILIZABLES (MEMOIZADOS) ---

const InputField = memo(
  ({
    label,
    name,
    value,
    onChange,
    required = false,
    placeholder = '',
    icon = null,
    type = 'text',
    inputMode,
  }) => (
    <div className="flex flex-col">
      <label htmlFor={name} className="text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative flex items-center">
        <input
          type={type}
          inputMode={inputMode}
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
  ),
);

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

// --- COMPONENTES DE VISTA ---

const LoadingState = () => (
  <div className="flex justify-center items-center p-8 bg-white rounded-xl shadow-lg mt-8">
    <Loader2 className="w-8 h-8 text-rappi-main animate-spin mr-3" />
    <p className="text-lg text-gray-700">Cargando aplicación y autenticando usuario...</p>
  </div>
);

const SectionTitle = memo(({ icon, title }) => (
  <h2 className="text-xl font-bold text-gray-800 flex items-center mb-4">
    {icon}
    {title}
  </h2>
));

const Modal = ({ message, onClose }) => (
  <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
    <div className="bg-white rounded-xl shadow-lg p-4 max-w-md w-full flex items-start">
      <div className="flex-1 text-sm text-gray-800 whitespace-pre-wrap">{message}</div>
      <button type="button" className="ml-2 text-gray-500 hover:text-gray-800" onClick={onClose} aria-label="Cerrar">
        <X className="w-4 h-4" />
      </button>
    </div>
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
  zoneOptions,
}) => {
  const catalogStatusOptions = useMemo(() => ['Ok', 'En proceso', 'Sin Revisión', 'Blocker'], []);
  const mdStatusOptions = useMemo(() => ['Ok', 'En proceso', 'Sin Revisión', 'Blocker'], []);
  const topOperatorLevelOptions = useMemo(() => ['Top Oro', 'Top Plata', 'Top Básico', 'Alerta'], []);
  const okImproveOptions = useMemo(() => ['Ok', 'Por Mejorar'], []);
  const yesNoOptions = useMemo(() => ['Si', 'No'], []);
  const adsOptions = useMemo(() => ['Si', 'Upselling', 'Negociando', 'No'], []);

  return (
    <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6 bg-white rounded-lg shadow-xl">
      <section className="border-b pb-4">
        <SectionTitle icon={<MapPin className="w-5 h-5 mr-2 text-rappi-main" />} title="Información General" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SelectField
            label="Tipo de Visita"
            name="visitType"
            value={form.visitType}
            onChange={handleChange}
            options={['Presencial', 'Virtual']}
            required
          />

          <SelectField
            label="Zona"
            name="zone"
            value={form.zone}
            onChange={handleChange}
            options={zoneOptions}
            required
            placeholder="Selecciona la zona"
          />
        </div>

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
              Nota: En visita virtual, el check-in es opcional y se registra 'N/A' si no se realiza.
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
        <SectionTitle icon={<ListOrdered className="w-5 h-5 mr-2 text-rappi-main" />} title="Restaurante" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InputField
            label="Brand ID (Obligatorio)"
            name="brandId"
            value={form.brandId}
            onChange={handleChange}
            required
            placeholder="Ej: 123456"
            inputMode="numeric"
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

        <InputField
          label="Decision Maker (Nombre y Rol) (Obligatorio)"
          name="decisionMaker"
          value={form.decisionMaker}
          onChange={handleChange}
          required
          placeholder="Ej: Juan Pérez - Gerente de Marketing"
        />
      </section>

      <section className="space-y-4 border-t pt-6">
        <SectionTitle icon={<Camera className="w-5 h-5 mr-2 text-rappi-main" />} title="Bloque 1: Catálogo" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SelectField label="Fotos" name="catalogPhotos" value={form.catalogPhotos} onChange={handleChange} options={catalogStatusOptions} required />
          <SelectField
            label="Descripciones"
            name="catalogDescriptions"
            value={form.catalogDescriptions}
            onChange={handleChange}
            options={catalogStatusOptions}
            required
          />
          <SelectField
            label="Estructura Menú / Toppings"
            name="catalogMenuStructure"
            value={form.catalogMenuStructure}
            onChange={handleChange}
            options={catalogStatusOptions}
            required
          />
          <InputField
            label="Price Parity (Respuesta numérica)"
            name="priceParity"
            value={form.priceParity}
            onChange={handleChange}
            required
            type="number"
            inputMode="decimal"
            placeholder="Ej: 0 / 5 / 10"
          />
        </div>
      </section>

      {/* ✅ FIX: MD significa Markdown (no “Menú Digital”) */}
      <section className="space-y-4 border-t pt-6">
        <SectionTitle icon={<Monitor className="w-5 h-5 mr-2 text-rappi-main" />} title="Bloque 2: Markdown" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SelectField
            label="MD (Markdown)"
            name="mdStandard"
            value={form.mdStandard}
            onChange={handleChange}
            options={mdStatusOptions}
            required
          />
          <SelectField
            label="MD PRO (Markdown Pro)"
            name="mdPro"
            value={form.mdPro}
            onChange={handleChange}
            options={mdStatusOptions}
            required
          />
        </div>
      </section>

      <section className="space-y-4 border-t pt-6">
        <SectionTitle icon={<Target className="w-5 h-5 mr-2 text-rappi-main" />} title="Bloque 3: Top Operator" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SelectField label="Level" name="topOperatorLevel" value={form.topOperatorLevel} onChange={handleChange} options={topOperatorLevelOptions} required />
          <SelectField label="Defect" name="topOperatorDefect" value={form.topOperatorDefect} onChange={handleChange} options={okImproveOptions} required />
          <SelectField label="Cancel" name="topOperatorCancel" value={form.topOperatorCancel} onChange={handleChange} options={okImproveOptions} required />
          <SelectField
            label="Availability (Disponibilidad)"
            name="topOperatorAvailability"
            value={form.topOperatorAvailability}
            onChange={handleChange}
            options={okImproveOptions}
            required
          />
        </div>
      </section>

      <section className="space-y-4 border-t pt-6">
        <SectionTitle icon={<Send className="w-5 h-5 mr-2 text-rappi-main" />} title="Bloque 4: Growth" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SelectField label="Viral Deals" name="growthViralDeals" value={form.growthViralDeals} onChange={handleChange} options={yesNoOptions} required />
          <SelectField label="Ads (Publicidad)" name="growthAds" value={form.growthAds} onChange={handleChange} options={adsOptions} required />
        </div>
      </section>

      <section className="space-y-4 border-t pt-6">
        <SectionTitle icon={<ListOrdered className="w-5 h-5 mr-2 text-rappi-main" />} title="Detalle y Pormenores" />

        <TextAreaField
          label="Detalles y Pormenores (Obligatorio)"
          name="details"
          value={form.details}
          onChange={handleChange}
          required
          placeholder="Ej: Observaciones, acuerdos, blockers, próximos pasos..."
        />
      </section>

      <button
        type="submit"
        disabled={
          isSubmitting ||
          !form.brandId ||
          !form.restaurantName ||
          !form.decisionMaker ||
          !form.zone ||
          !form.details ||
          (form.visitType === 'Presencial' && !location) ||
          (form.visitType === 'Virtual' && !form.photoEvidence.trim())
        }
        className="w-full flex items-center justify-center px-6 py-3 bg-rappi-main text-white font-bold text-lg rounded-xl shadow-md hover:bg-rappi-dark transition duration-300 disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        {isSubmitting ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Send className="w-5 h-5 mr-2" />}
        {isSubmitting ? 'Enviando...' : 'Registrar Visita'}
      </button>

      <p className="text-xs text-gray-500 mt-4 text-center">*El registro se guarda en Firestore asociado a tu usuario.</p>
    </form>
  );
};

const HistoryView = ({ visits, exportToCSV, lastExportUrl }) => (
  <div className="p-6 md:p-8 bg-white rounded-lg shadow-xl">
    <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3 mb-6 border-b pb-4">
      <h2 className="text-xl font-bold text-gray-800 flex items-center">
        <ListOrdered className="w-5 h-5 mr-2 text-rappi-main" /> Historial de Visitas ({visits.length})
      </h2>

      <div className="flex items-center gap-2">
        {lastExportUrl && (
          <a
            href={lastExportUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            title="Abrir CSV en Storage"
          >
            <LinkIcon className="w-4 h-4 mr-2" />
            Abrir CSV
          </a>
        )}
        <button
          onClick={exportToCSV}
          disabled={visits.length === 0}
          className="flex items-center px-4 py-2 text-sm bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 transition duration-200 disabled:opacity-50"
        >
          <Download className="w-4 h-4 mr-2" />
          Exportar a CSV
        </button>
      </div>
    </div>

    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
      {visits.length === 0 ? (
        <div className="text-center p-10 bg-gray-50 rounded-lg">
          <Target className="w-8 h-8 mx-auto text-gray-400 mb-3" />
          <p className="text-gray-600">Aún no has registrado ninguna visita. ¡Haz un check-in!</p>
        </div>
      ) : (
        visits.map((visit) => (
          <div key={visit.id} className="bg-gray-50 p-4 border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition duration-200">
            <div className="flex justify-between items-start mb-2">
              <p className="text-lg font-semibold text-rappi-main truncate">
                {visit.restaurantName} (ID: {visit.brandId})
              </p>
              <div className="px-3 py-1 text-xs font-bold rounded-full bg-white border border-gray-200 text-gray-700">
                {visit.topOperatorLevel || '—'}
              </div>
            </div>

            <div className="text-sm text-gray-600 space-y-1">
              <p>
                <span className="font-medium">Tipo:</span> {visit.visitType || 'Presencial'}
              </p>
              <p>
                <span className="font-medium">Zona:</span> {visit.zone || '—'}
              </p>
              <p>
                <span className="font-medium">Decision Maker:</span> {visit.decisionMaker || '—'}
              </p>
              <p>
                <span className="font-medium">Growth:</span> Viral Deals {visit.growthViralDeals || '—'} · Ads {visit.growthAds || '—'}
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

              <details className="mt-2">
                <summary className="cursor-pointer text-xs font-semibold text-gray-700">Ver bloques</summary>
                <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-gray-600">
                  <div className="bg-white border border-gray-200 rounded-lg p-2">
                    <div className="font-semibold text-gray-800 mb-1">Catálogo</div>
                    <div>Fotos: {visit.catalogPhotos || '—'}</div>
                    <div>Descripciones: {visit.catalogDescriptions || '—'}</div>
                    <div>Menú/Toppings: {visit.catalogMenuStructure || '—'}</div>
                    <div>Price Parity: {visit.priceParity ?? '—'}</div>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-lg p-2">
                    <div className="font-semibold text-gray-800 mb-1">Markdown</div>
                    <div>MD: {visit.mdStandard || '—'}</div>
                    <div>MD PRO: {visit.mdPro || '—'}</div>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-lg p-2">
                    <div className="font-semibold text-gray-800 mb-1">Top Operator</div>
                    <div>Level: {visit.topOperatorLevel || '—'}</div>
                    <div>Defect: {visit.topOperatorDefect || '—'}</div>
                    <div>Cancel: {visit.topOperatorCancel || '—'}</div>
                    <div>Availability: {visit.topOperatorAvailability || '—'}</div>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-lg p-2">
                    <div className="font-semibold text-gray-800 mb-1">Detalle</div>
                    <div className="whitespace-pre-wrap">{visit.details || '—'}</div>
                  </div>
                </div>
              </details>
            </div>
          </div>
        ))
      )}
    </div>
  </div>
);

const AdminView = ({ rows }) => (
  <div className="p-6 md:p-8 bg-white rounded-lg shadow-xl">
    <div className="flex justify-between items-center mb-6 border-b pb-4">
      <h2 className="text-xl font-bold text-gray-800 flex items-center">
        <Shield className="w-5 h-5 mr-2 text-rappi-main" /> Admin · Todas las visitas ({rows.length})
      </h2>
    </div>

    <div className="overflow-auto border border-gray-200 rounded-lg">
      <table className="min-w-full text-xs">
        <thead className="bg-gray-50">
          <tr>
            {['Fecha', 'KAM', 'Zona', 'Brand ID', 'Restaurante', 'MD', 'MD PRO', 'Top Level'].map((h) => (
              <th key={h} className="text-left px-3 py-2 font-semibold text-gray-700 border-b">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="odd:bg-white even:bg-gray-50">
              <td className="px-3 py-2 border-b">
                {r.checkInTime?.toDate ? r.checkInTime.toDate().toLocaleString() : '—'}
              </td>
              <td className="px-3 py-2 border-b">{r.kamEmail || r.kamId || '—'}</td>
              <td className="px-3 py-2 border-b">{r.zone || '—'}</td>
              <td className="px-3 py-2 border-b">{r.brandId || '—'}</td>
              <td className="px-3 py-2 border-b">{r.restaurantName || '—'}</td>
              <td className="px-3 py-2 border-b">{r.mdStandard || '—'}</td>
              <td className="px-3 py-2 border-b">{r.mdPro || '—'}</td>
              <td className="px-3 py-2 border-b">{r.topOperatorLevel || '—'}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td className="px-3 py-6 text-center text-gray-500" colSpan={8}>
                No hay registros.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>

    <p className="text-xs text-gray-500 mt-3">
      Nota: para que esto sea seguro, la lectura global debe estar limitada por Rules (idealmente con custom claims).
    </p>
  </div>
);

const App = () => {
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [storage, setStorage] = useState(null);

  // Firebase UID
  const [userId, setUserId] = useState(null);

  // Email visible
  const [userEmail, setUserEmail] = useState('');

  const [isAuthReady, setIsAuthReady] = useState(false);
  const [visits, setVisits] = useState([]);

  const [currentView, setCurrentView] = useState('form'); // form | history | admin
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [location, setLocation] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [error, setError] = useState(null);

  const [adminRows, setAdminRows] = useState([]);
  const [lastExportUrl, setLastExportUrl] = useState('');

  const [form, setForm] = useState({
    // Info general
    visitType: 'Presencial',
    zone: '',

    // Restaurante
    brandId: '',
    restaurantName: '',
    decisionMaker: '',

    // Evidencia (solo virtual)
    photoEvidence: '',

    // Bloque 1: Catálogo
    catalogPhotos: '',
    catalogDescriptions: '',
    catalogMenuStructure: '',
    priceParity: '',

    // Bloque 2: Markdown
    mdStandard: '',
    mdPro: '',

    // Bloque 3: Top Operator
    topOperatorLevel: '',
    topOperatorDefect: '',
    topOperatorCancel: '',
    topOperatorAvailability: '',

    // Bloque 4: Growth
    growthViralDeals: '',
    growthAds: '',

    // Detalle
    details: '',
  });

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const zoneOptions = useMemo(() => ['Kennedy', 'Antonio Nariño', 'Suba', 'Engativá', 'Fontibon'], []);

  // ✅ Logo (tu archivo real en /public)
  const [logoSrc, setLogoSrc] = useState('/rappi-logo-512.png');

  const showStatusModal = useCallback((message) => {
    setModalMessage(message);
    setShowModal(true);
    setTimeout(() => setShowModal(false), 3500);
  }, []);

  const resetForm = useCallback(() => {
    setForm({
      visitType: 'Presencial',
      zone: '',
      brandId: '',
      restaurantName: '',
      decisionMaker: '',
      photoEvidence: '',
      catalogPhotos: '',
      catalogDescriptions: '',
      catalogMenuStructure: '',
      priceParity: '',
      mdStandard: '',
      mdPro: '',
      topOperatorLevel: '',
      topOperatorDefect: '',
      topOperatorCancel: '',
      topOperatorAvailability: '',
      growthViralDeals: '',
      growthAds: '',
      details: '',
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
      setAdminRows([]);
      setLastExportUrl('');
      setCurrentView('form');
      showStatusModal('Sesión cerrada.');
    } catch (e) {
      console.error('Error al cerrar sesión:', e);
      setError('No se pudo cerrar sesión.');
    }
  }, [auth, showStatusModal]);

  const isAdmin = useMemo(() => {
    if (!userEmail) return false;
    return ADMIN_EMAILS.includes(userEmail.toLowerCase());
  }, [userEmail]);

  // --- INIT FIREBASE ---
  useEffect(() => {
    (async () => {
      try {
        const app = initializeApp(firebaseConfig);
        const authInstance = getAuth(app);
        const dbInstance = getFirestore(app);
        const storageInstance = getStorage(app);

        // ✅ Persistencia: evita que se "pierda" sesión al refresh
        await setPersistence(authInstance, browserLocalPersistence);

        setAuth(authInstance);
        setDb(dbInstance);
        setStorage(storageInstance);

        const unsubscribe = onAuthStateChanged(authInstance, (user) => {
          setUserId(user ? user.uid : null);
          setUserEmail(user?.email || '');
          setIsAuthReady(true);
        });

        return () => unsubscribe();
      } catch (e) {
        console.error('Error al inicializar Firebase:', e);
        setError('La configuración de Firebase no está disponible.');
        setIsAuthReady(true);
      }
    })();
  }, []);

  // --- LISTENER VISITS (por usuario) ---
  useEffect(() => {
    if (!db || !userId) return;

    const collectionPath = `artifacts/${APP_ID}/users/${userId}/kams_visits`;
    const q = query(collection(db, collectionPath));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        data.sort((a, b) => (b.checkInTime?.toDate?.() || 0) - (a.checkInTime?.toDate?.() || 0));
        setVisits(data);
      },
      (e) => {
        console.error('Error al cargar visitas:', e);
        setError('Error al cargar el historial de visitas. Revisa tus Rules.');
      },
    );

    return () => unsubscribe();
  }, [db, userId]);

  // --- ADMIN LISTENER (collectionGroup) ---
  useEffect(() => {
    if (!db || !userId || !isAdmin) return;

    const q = query(collectionGroup(db, 'kams_visits'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const rows = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        rows.sort((a, b) => (b.checkInTime?.toDate?.() || 0) - (a.checkInTime?.toDate?.() || 0));
        setAdminRows(rows);
      },
      (e) => {
        console.error('Error admin collectionGroup:', e);
        // Si tus Rules ya bloquearon collectionGroup (recomendado), esto puede fallar hasta que pongas custom claims.
      },
    );

    return () => unsubscribe();
  }, [db, userId, isAdmin]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.brandId || !form.restaurantName || !form.decisionMaker || !form.zone || !form.details) {
      showStatusModal('Completa los campos obligatorios (Info General + Restaurante + Detalle).');
      return;
    }

    if (form.visitType === 'Presencial' && !location) {
      showStatusModal('Para una visita Presencial, por favor realiza el "Check-in" de ubicación.');
      return;
    }
    if (form.visitType === 'Virtual' && !form.photoEvidence.trim()) {
      showStatusModal('Para una visita Virtual, es obligatorio adjuntar la evidencia (nombre/URL).');
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
      setError('Error al guardar la visita. Revisa tus Rules de Firestore.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ✅ CSV export + subida a Firebase Storage
  const exportToCSV = useCallback(async () => {
    if (visits.length === 0) {
      showStatusModal('No hay datos para exportar.');
      return;
    }

    const headers = [
      'ID',
      'KAM ID',
      'KAM Email',
      'Tipo Visita',
      'Zona',
      'Brand ID',
      'Nombre Restaurante',
      'Decision Maker',
      'Evidencia',
      'Latitud',
      'Longitud',
      'Ubicación Simulada',
      'Catálogo Fotos',
      'Catálogo Descripciones',
      'Catálogo Menú/Toppings',
      'Price Parity',
      'MD',
      'MD PRO',
      'Top Operator Level',
      'Defect',
      'Cancel',
      'Availability',
      'Viral Deals',
      'Ads',
      'Detalles',
      'Timestamp',
    ];

    const csvEscape = (value) => {
      const s = (value ?? '').toString();
      const CR = String.fromCharCode(13);
      const LF = String.fromCharCode(10);
      const noCR = s.replaceAll(CR, '');
      const oneLine = noCR.replaceAll(LF, ' ');
      return '"' + oneLine.replaceAll('"', '""') + '"';
    };

    const csvRows = [headers.join(';')];

    visits.forEach((visit) => {
      const row = [
        visit.id,
        visit.kamId || 'N/A',
        visit.kamEmail || 'N/A',
        visit.visitType || 'N/A',
        visit.zone || 'N/A',
        visit.brandId || 'N/A',
        visit.restaurantName || 'N/A',
        visit.decisionMaker || 'N/A',
        visit.photoEvidence || 'N/A',
        visit.latitude ?? 'N/A',
        visit.longitude ?? 'N/A',
        visit.locationSimulated ? 'Sí' : 'No',
        visit.catalogPhotos || 'N/A',
        visit.catalogDescriptions || 'N/A',
        visit.catalogMenuStructure || 'N/A',
        visit.priceParity ?? 'N/A',
        visit.mdStandard || 'N/A',
        visit.mdPro || 'N/A',
        visit.topOperatorLevel || 'N/A',
        visit.topOperatorDefect || 'N/A',
        visit.topOperatorCancel || 'N/A',
        visit.topOperatorAvailability || 'N/A',
        visit.growthViralDeals || 'N/A',
        visit.growthAds || 'N/A',
        csvEscape(visit.details || ''),
        visit.checkInTime?.toDate ? visit.checkInTime.toDate().toISOString() : 'N/A',
      ];
      csvRows.push(row.join(';'));
    });

    const LF = String.fromCharCode(10);
    const csvString = csvRows.join(LF);

    // 1) Descarga local
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const fileName = `Visitas_KAM_Exportado_${new Date().toISOString().slice(0, 10)}_${new Date()
      .toISOString()
      .slice(11, 19)
      .replaceAll(':', '-')}.csv`;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // 2) Subida a Storage
    try {
      if (!storage || !userId) throw new Error('Storage o userId no disponibles');

      const path = `artifacts/${APP_ID}/exports/${userId}/${fileName}`;
      const fileRef = storageRef(storage, path);
      await uploadBytes(fileRef, blob, { contentType: 'text/csv' });
      const url = await getDownloadURL(fileRef);
      setLastExportUrl(url);

      showStatusModal(`📥 CSV descargado y guardado en Firebase Storage.\n\nRuta: ${path}`);
    } catch (e) {
      console.error('Error subiendo CSV a Storage:', e);
      showStatusModal('📥 CSV descargado.\n⚠️ No se pudo guardar en Storage (revisa Rules de Storage).');
    }
  }, [visits, storage, userId, showStatusModal]);

  const rappiMain = '#FF5500';
  const rappiDark = '#D84800';
  const rappiAccent = '#FF7B4D';

  const userLabel = userEmail || userId || '—';

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-8 font-sans" style={{ '--rappi-main': rappiMain, '--rappi-dark': rappiDark }}>
      <style>{`
        .font-sans { font-family: 'Inter', sans-serif; }
        .bg-rappi-main { background-color: var(--rappi-main); }
        .hover\\:bg-rappi-dark:hover { background-color: var(--rappi-dark); }
        .text-rappi-main { color: var(--rappi-main); }
        .focus\\:ring-rappi-main:focus { --tw-ring-color: var(--rappi-main); }
        .focus\\:border-rappi-main:focus { border-color: var(--rappi-main); }
        .rappi-header-bg { background: linear-gradient(135deg, var(--rappi-accent), var(--rappi-main)); }
      `}</style>

      <div className="max-w-4xl mx-auto">
        <header className="mb-8 p-6 rounded-xl shadow-lg border-b-4 border-rappi-dark rappi-header-bg text-white" style={{ '--rappi-accent': rappiAccent }}>
          <div className="flex items-center gap-4">
            <div className="w-24 h-24 flex items-center justify-center rounded-3xl bg-white/20 backdrop-blur shadow-inner overflow-hidden">
              <img
                src={logoSrc}
                alt="Rappi"
                className="w-full h-full object-contain p-4 select-none"
                draggable={false}
                onError={() => {
                  if (logoSrc !== '/rappi-logo.png') setLogoSrc('/rappi-logo.png');
                }}
              />
            </div>

            <div>
              <h1 className="text-3xl font-extrabold flex items-center drop-shadow-sm">
                Street Kams App <Target className="w-6 h-6 ml-3" />
              </h1>
              <p className="mt-1 text-gray-100 drop-shadow-sm">Reporte de Visita de Restaurante (KAM)</p>
            </div>
          </div>

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

              <p className="text-xs text-gray-500 text-center">* Activa Email/Password en Firebase Console → Authentication.</p>
            </form>
          </div>
        ) : (
          <>
            <div className="mb-4 flex justify-between items-center">
              <div className="text-sm text-gray-700">
                Sesión iniciada como <span className="font-semibold">{userLabel}</span>
              </div>
              <button type="button" onClick={handleLogout} className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-100">
                Cerrar sesión
              </button>
            </div>

            <div className="mb-6 flex space-x-2 p-1 bg-white rounded-xl shadow-inner">
              <button
                onClick={() => setCurrentView('form')}
                className={`flex-1 py-3 px-4 rounded-lg font-bold transition-colors duration-200 text-sm ${
                  currentView === 'form' ? 'bg-rappi-main text-white shadow-md' : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                Formulario
              </button>
              <button
                onClick={() => setCurrentView('history')}
                className={`flex-1 py-3 px-4 rounded-lg font-bold transition-colors duration-200 text-sm ${
                  currentView === 'history' ? 'bg-rappi-main text-white shadow-md' : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                Historial
              </button>
              {isAdmin && (
                <button
                  onClick={() => setCurrentView('admin')}
                  className={`flex-1 py-3 px-4 rounded-lg font-bold transition-colors duration-200 text-sm ${
                    currentView === 'admin' ? 'bg-rappi-main text-white shadow-md' : 'bg-white text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Admin
                </button>
              )}
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
                  zoneOptions={zoneOptions}
                />
              ) : currentView === 'history' ? (
                <HistoryView visits={visits} exportToCSV={exportToCSV} lastExportUrl={lastExportUrl} />
              ) : (
                <AdminView rows={adminRows} />
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
