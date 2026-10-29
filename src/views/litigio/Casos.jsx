import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../../config/firebase';
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
  getCountFromServer,
  doc,
  updateDoc,
  deleteDoc
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  Alert,
  Divider,
  IconButton,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  Collapse,
  Tooltip,
  InputBase
} from '@mui/material';
import {
  Plus,
  Users,
  Edit,
  Trash2,
  Search,
  CreditCard,
  ChevronDown,
  ChevronUp,
  ArrowUpRight,
  SlidersHorizontal,
  LayoutGrid,
  List as ListIcon,
  X,
  Scale,
  Clock
} from 'lucide-react';
import { registrarLogAuditoria } from '../../utils/auditLogger';
import {
  PAISES_LATINOAMERICA,
  VIAS_INTERNACIONALES,
  VIAS_NACIONALES,
  ETAPAS_INTERNACIONAL_SIDH,
  obtenerPerfilJurisdiccional,
  obtenerDatosPais,
  sincronizarEtapaConPerfil
} from '../../utils/perfilesJurisdiccionales';

const ESTADOS_CASO = ['Activo', 'Suspendido', 'Cerrado', 'Archivado'];

export const JURISDICCIONES_LITIGIO = [
  ...VIAS_INTERNACIONALES,
  ...VIAS_NACIONALES,
  'Sala Constitucional / Supremo',
  'Contencioso Administrativo / Laboral'
];

export const ETAPAS_PROCESALES_LITIGIO = ETAPAS_INTERNACIONAL_SIDH;

export const DERECHOS_CADH_SUGERIDOS = [
  'Art. 1.1 CADH (Obligación de Respetar)',
  'Art. 2 CADH (Deber de Adoptar Disposiciones)',
  'Art. 5 CADH (Integridad Personal)',
  'Art. 8 CADH (Garantías Judiciales)',
  'Art. 21 CADH (Propiedad Privada)',
  'Art. 24 CADH (Igualdad ante la Ley)',
  'Art. 25 CADH (Protección Judicial)',
  'Art. 26 CADH (DESCA)'
];

export default function Casos({ onSelectCaso, userRole, currentUserEmail }) {
  const [casos, setCasos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sincronizandoStripe, setSincronizandoStripe] = useState(false);

  // Filtros de búsqueda ejecutiva y estado de visualización minimalista
  const [busqueda, setBusqueda] = useState('');
  const [filtroAmbito, setFiltroAmbito] = useState('Todos');
  const [filtroPais, setFiltroPais] = useState('Todos');
  const [filtroJurisdiccion, setFiltroJurisdiccion] = useState('Todas');
  const [filtroEstado, setFiltroEstado] = useState('Todos');
  const [filtroSoloUrgentes, setFiltroSoloUrgentes] = useState(false);
  const [mostrarFiltrosAvanzados, setMostrarFiltrosAvanzados] = useState(false);
  const [vistaModo, setVistaModo] = useState('compact'); // 'compact' (tarjetas mínimas) | 'list' (filas densas)
  const [expandedCardIds, setExpandedCardIds] = useState({});
  const searchInputRef = useRef(null);

  const toggleExpandCard = (id, e) => {
    if (e) e.stopPropagation();
    setExpandedCardIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const hayTarjetasExpandidas = useMemo(
    () => Object.values(expandedCardIds).some(Boolean),
    [expandedCardIds]
  );

  const contraerTodasLasTarjetas = () => {
    setExpandedCardIds({});
  };

  // Atajos de teclado ejecutivos: '/' para buscar, 'Escape' para contraer tarjetas o limpiar búsqueda
  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = (e.target?.tagName || '').toLowerCase();
      const isEditable =
        tag === 'input' || tag === 'textarea' || tag === 'select' || e.target?.isContentEditable;

      if (e.key === '/' && !isEditable && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'Escape') {
        if (isEditable && document.activeElement === searchInputRef.current) {
          if (busqueda) {
            setBusqueda('');
          } else {
            searchInputRef.current?.blur();
          }
        } else if (!isEditable && hayTarjetasExpandidas) {
          setExpandedCardIds({});
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [busqueda, hayTarjetasExpandidas]);

  const hayFiltrosActivos =
    Boolean(busqueda.trim()) ||
    filtroAmbito !== 'Todos' ||
    filtroPais !== 'Todos' ||
    filtroJurisdiccion !== 'Todas' ||
    filtroEstado !== 'Todos' ||
    filtroSoloUrgentes;

  const limpiarTodosLosFiltros = () => {
    setBusqueda('');
    setFiltroAmbito('Todos');
    setFiltroPais('Todos');
    setFiltroJurisdiccion('Todas');
    setFiltroEstado('Todos');
    setFiltroSoloUrgentes(false);
  };

  // Estados para crear un nuevo caso
  const [openModal, setOpenModal] = useState(false);
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [expedienteOficial, setExpedienteOficial] = useState('');
  const [ambito, setAmbito] = useState('Internacional');
  const [paisJurisdiccion, setPaisJurisdiccion] = useState('Costa Rica');
  const [jurisdiccion, setJurisdiccion] = useState('CIDH (Comisión)');
  const [estadoDemandado, setEstadoDemandado] = useState('Estado de Costa Rica');
  const [etapaProcesal, setEtapaProcesal] = useState('1. Preparación y Recolección');
  const [abogadoResponsable, setAbogadoResponsable] = useState('');
  const [derechosInvocados, setDerechosInvocados] = useState([
    'Art. 8 CADH (Garantías Judiciales)',
    'Art. 25 CADH (Protección Judicial)'
  ]);
  const [nuevaNormaInput, setNuevaNormaInput] = useState('');

  // Estados para editar un caso
  const [openEditModal, setOpenEditModal] = useState(false);
  const [casoAEditarId, setCasoAEditarId] = useState(null);
  const [editNombre, setEditNombre] = useState('');
  const [editDescripcion, setEditDescripcion] = useState('');
  const [editEstado, setEditEstado] = useState('Activo');
  const [editExpedienteOficial, setEditExpedienteOficial] = useState('');
  const [editAmbito, setEditAmbito] = useState('Internacional');
  const [editPaisJurisdiccion, setEditPaisJurisdiccion] = useState('Costa Rica');
  const [editJurisdiccion, setEditJurisdiccion] = useState('CIDH (Comisión)');
  const [editEstadoDemandado, setEditEstadoDemandado] = useState('Estado de Costa Rica');
  const [editEtapaProcesal, setEditEtapaProcesal] = useState('1. Preparación y Recolección');
  const [editAbogadoResponsable, setEditAbogadoResponsable] = useState('');
  const [editDerechosInvocados, setEditDerechosInvocados] = useState([]);
  const [editNuevaNormaInput, setEditNuevaNormaInput] = useState('');

  const esAdmin = userRole === 'Superadmin' || userRole === 'Admin';

  // Perfiles dinámicos para el modal de creación y el de edición
  const perfilCreacion = useMemo(
    () =>
      obtenerPerfilJurisdiccional({
        ambito,
        pais_jurisdiccion: paisJurisdiccion,
        jurisdiccion,
        estado_demandado: estadoDemandado
      }),
    [ambito, paisJurisdiccion, jurisdiccion, estadoDemandado]
  );

  const perfilEdicion = useMemo(
    () =>
      obtenerPerfilJurisdiccional({
        ambito: editAmbito,
        pais_jurisdiccion: editPaisJurisdiccion,
        jurisdiccion: editJurisdiccion,
        estado_demandado: editEstadoDemandado
      }),
    [editAmbito, editPaisJurisdiccion, editJurisdiccion, editEstadoDemandado]
  );

  const fetchCasos = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'casos'), orderBy('fecha_creacion', 'desc'));
      const querySnapshot = await getDocs(q);

      const listaCasos = await Promise.all(
        querySnapshot.docs.map(async (docSnapshot) => {
          const id = docSnapshot.id;
          const data = docSnapshot.data();
          const clientesRef = collection(db, 'casos', id, 'clientes');
          const countSnapshot = await getCountFromServer(clientesRef);

          return {
            id,
            ...data,
            estado: data.estado || 'Activo',
            plazos: data.plazos || [],
            totalClientes: countSnapshot.data().count
          };
        })
      );
      setCasos(listaCasos);
    } catch (err) {
      console.error(err);
      setError('Error al cargar los casos de la base de datos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCasos();
  }, []);

  const toggleDerecho = (der, actual, setter) => {
    if (actual.includes(der)) {
      setter(actual.filter((d) => d !== der));
    } else {
      setter([...actual, der]);
    }
  };

  const agregarNormaPersonalizada = (texto, actual, setter, clearInput) => {
    const limpio = (texto || '').trim();
    if (!limpio) return;
    if (!actual.includes(limpio)) {
      setter([...actual, limpio]);
    }
    clearInput('');
  };

  const handleCambiarAmbitoCreacion = (nuevoAmbito) => {
    setAmbito(nuevoAmbito);
    const datosP = obtenerDatosPais(paisJurisdiccion);
    if (nuevoAmbito === 'Internacional') {
      const nuevaVia = 'CIDH (Comisión)';
      setJurisdiccion(nuevaVia);
      const nuevoP = obtenerPerfilJurisdiccional({
        ambito: 'Internacional',
        pais_jurisdiccion: paisJurisdiccion,
        jurisdiccion: nuevaVia
      });
      setEtapaProcesal(sincronizarEtapaConPerfil(etapaProcesal, nuevoP));
      setDerechosInvocados(['Art. 8 CADH (Garantías Judiciales)', 'Art. 25 CADH (Protección Judicial)']);
    } else {
      const nuevaVia = VIAS_NACIONALES[0];
      setJurisdiccion(nuevaVia);
      const nuevoP = obtenerPerfilJurisdiccional({
        ambito: 'Nacional',
        pais_jurisdiccion: paisJurisdiccion,
        jurisdiccion: nuevaVia
      });
      setEtapaProcesal(sincronizarEtapaConPerfil(etapaProcesal, nuevoP));
      setDerechosInvocados((datosP.derechosNacionalesSugeridos || []).slice(0, 2));
    }
  };

  const handleCambiarPaisCreacion = (nuevoPais) => {
    setPaisJurisdiccion(nuevoPais);
    if (!estadoDemandado || estadoDemandado.startsWith('Estado de ')) {
      setEstadoDemandado(`Estado de ${nuevoPais}`);
    }
    if (ambito === 'Nacional') {
      const datosP = obtenerDatosPais(nuevoPais);
      setDerechosInvocados((datosP.derechosNacionalesSugeridos || []).slice(0, 2));
    }
  };

  const handleCambiarViaCreacion = (nuevaVia) => {
    setJurisdiccion(nuevaVia);
    const nuevoP = obtenerPerfilJurisdiccional({
      ambito,
      pais_jurisdiccion: paisJurisdiccion,
      jurisdiccion: nuevaVia
    });
    setEtapaProcesal(sincronizarEtapaConPerfil(etapaProcesal, nuevoP));
  };

  const handleSincronizarStripe = async () => {
    setSincronizandoStripe(true);
    try {
      const fns = getFunctions();
      const syncFn = httpsCallable(fns, 'sincronizarPagosStripe');
      const res = await syncFn();
      const d = res.data || {};
      alert(
        `✅ Sincronización con Stripe completada.\n\nPagos revisados: ${d.pagos_revisados || 0}\nRepresentados actualizados a 'Pagado': ${d.clientes_actualizados || 0}`
      );
      fetchCasos();
    } catch (err) {
      console.error('Error sincronizando con Stripe:', err);
      alert('No se pudo sincronizar con Stripe en este momento.');
    } finally {
      setSincronizandoStripe(false);
    }
  };

  const handleCreateCaso = async (e) => {
    e.preventDefault();
    if (!nombre.trim()) return;

    try {
      const docRef = await addDoc(collection(db, 'casos'), {
        nombre: nombre.trim(),
        descripcion: descripcion.trim(),
        expediente_oficial: expedienteOficial.trim(),
        ambito,
        pais_jurisdiccion: paisJurisdiccion,
        jurisdiccion,
        estado_demandado: estadoDemandado.trim() || `Estado de ${paisJurisdiccion}`,
        etapa_procesal: etapaProcesal,
        abogado_responsable: abogadoResponsable.trim() || currentUserEmail || 'Equipo Legal IIRESODH',
        derechos_invocados: derechosInvocados,
        fecha_creacion: serverTimestamp(),
        estado: 'Activo',
        plazos: []
      });

      await registrarLogAuditoria(
        currentUserEmail,
        'Creación de Caso',
        `Se creó el litigio [${ambito} - ${paisJurisdiccion}]: "${nombre.trim()}" (${jurisdiccion}) con ID asignado: ${docRef.id}`
      );

      setNombre('');
      setDescripcion('');
      setExpedienteOficial('');
      setAmbito('Internacional');
      setPaisJurisdiccion('Costa Rica');
      setJurisdiccion('CIDH (Comisión)');
      setEstadoDemandado('Estado de Costa Rica');
      setEtapaProcesal('1. Preparación y Recolección');
      setAbogadoResponsable('');
      setDerechosInvocados(['Art. 8 CADH (Garantías Judiciales)', 'Art. 25 CADH (Protección Judicial)']);
      setNuevaNormaInput('');
      setOpenModal(false);
      fetchCasos();
    } catch (err) {
      setError('No se pudo crear el caso. Revisa las reglas de Firestore.');
    }
  };

  const handleOpenEdit = (caso) => {
    const perfil = obtenerPerfilJurisdiccional(caso);
    setCasoAEditarId(caso.id);
    setEditNombre(caso.nombre || '');
    setEditDescripcion(caso.descripcion || '');
    setEditEstado(caso.estado || 'Activo');
    setEditExpedienteOficial(caso.expediente_oficial || '');
    setEditAmbito(perfil.ambito);
    setEditPaisJurisdiccion(perfil.pais.nombre);
    setEditJurisdiccion(caso.jurisdiccion || (perfil.esInternacional ? 'CIDH (Comisión)' : VIAS_NACIONALES[0]));
    setEditEstadoDemandado(caso.estado_demandado || `Estado de ${perfil.pais.nombre}`);
    setEditEtapaProcesal(sincronizarEtapaConPerfil(caso.etapa_procesal, perfil));
    setEditAbogadoResponsable(caso.abogado_responsable || '');
    setEditDerechosInvocados(Array.isArray(caso.derechos_invocados) ? caso.derechos_invocados : []);
    setEditNuevaNormaInput('');
    setOpenEditModal(true);
  };

  const handleUpdateCaso = async (e) => {
    e.preventDefault();
    if (!editNombre.trim() || !casoAEditarId) return;

    try {
      const casoDocRef = doc(db, 'casos', casoAEditarId);
      await updateDoc(casoDocRef, {
        nombre: editNombre.trim(),
        descripcion: editDescripcion.trim(),
        estado: editEstado,
        expediente_oficial: editExpedienteOficial.trim(),
        ambito: editAmbito,
        pais_jurisdiccion: editPaisJurisdiccion,
        jurisdiccion: editJurisdiccion,
        estado_demandado: editEstadoDemandado.trim(),
        etapa_procesal: editEtapaProcesal,
        abogado_responsable: editAbogadoResponsable.trim(),
        derechos_invocados: editDerechosInvocados
      });

      await registrarLogAuditoria(
        currentUserEmail,
        'Modificación de Caso',
        `Se configuró el litigio ID: ${casoAEditarId}. Nombre: "${editNombre.trim()}", Ámbito: [${editAmbito} - ${editPaisJurisdiccion}], Jurisdicción: [${editJurisdiccion}], Etapa: [${editEtapaProcesal}], Estado: [${editEstado}]`
      );

      setOpenEditModal(false);
      setCasoAEditarId(null);
      fetchCasos();
    } catch (err) {
      setError('No se pudieron actualizar los datos del litigio.');
    }
  };

  const handleDeleteCaso = async (id, nombreCaso) => {
    if (!esAdmin) {
      alert('Operación restringida. No posee los privilegios requeridos.');
      return;
    }
    if (
      !window.confirm(
        `¿CRÍTICO? ¿Está completamente seguro de eliminar el caso "${nombreCaso}"? Esta acción borrará de manera irreversible el litigio y todas las configuraciones asociadas.`
      )
    )
      return;

    try {
      await deleteDoc(doc(db, 'casos', id));

      await registrarLogAuditoria(
        currentUserEmail,
        'Eliminación de Caso',
        `CRÍTICO: Se eliminó irreversiblemente el caso completo: "${nombreCaso}" (ID: ${id})`
      );

      fetchCasos();
    } catch (err) {
      setError('Error de permisos en Firestore al intentar eliminar el litigio.');
    }
  };

  const calcularSemaforoDePlazos = (plazos = []) => {
    const plazosActivos = plazos.filter((p) => !p.completado);
    if (plazosActivos.length === 0) return null;

    const fechasEnMilisegundos = plazosActivos.map((p) => new Date(p.fechaFatal + 'T00:00:00').getTime());
    const fechaMasProximaMs = Math.min(...fechasEnMilisegundos);

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const fechaFatal = new Date(fechaMasProximaMs);
    fechaFatal.setHours(0, 0, 0, 0);

    const diferenciaTiempo = fechaFatal.getTime() - hoy.getTime();
    const diasRestantes = Math.ceil(diferenciaTiempo / (1000 * 60 * 60 * 24));

    if (diasRestantes < 0) {
      return {
        label: `Vencido (${Math.abs(diasRestantes)} d)`,
        color: 'error',
        bcolor: '#fef2f2',
        textColor: '#b91c1c',
        urgente: true
      };
    } else if (diasRestantes <= 2) {
      return {
        label: `URGENTE (${diasRestantes} d)`,
        color: 'error',
        bcolor: '#fef2f2',
        textColor: '#b91c1c',
        urgente: true
      };
    } else if (diasRestantes <= 5) {
      return {
        label: `Advertencia (${diasRestantes} d)`,
        color: 'warning',
        bcolor: '#fffbeb',
        textColor: '#b45309',
        urgente: true
      };
    } else {
      return {
        label: `${diasRestantes} días libres`,
        color: 'success',
        bcolor: '#f0fdf4',
        textColor: '#15803d',
        urgente: false
      };
    }
  };

  // KPIs ejecutivos
  const metricas = useMemo(() => {
    const activos = casos.filter((c) => c.estado !== 'Archivado');
    const internacionales = activos.filter((c) => obtenerPerfilJurisdiccional(c).esInternacional);
    const nacionales = activos.length - internacionales.length;
    const totalRepresentados = activos.reduce((acc, c) => acc + (Number(c.totalClientes) || 0), 0);
    const conPlazosUrgentes = activos.filter((c) => {
      const sem = calcularSemaforoDePlazos(c.plazos);
      return sem && sem.urgente;
    });

    return {
      totalActivos: activos.length,
      totalInternacionales: internacionales.length,
      totalNacionales: nacionales,
      totalRepresentados,
      plazosUrgentes: conPlazosUrgentes.length
    };
  }, [casos]);

  // Filtrado de casos
  const casosFiltrados = useMemo(() => {
    return casos.filter((c) => {
      const perfil = obtenerPerfilJurisdiccional(c);
      const q = busqueda.trim().toLowerCase();
      const coincideTexto =
        !q ||
        (c.nombre || '').toLowerCase().includes(q) ||
        (c.expediente_oficial || '').toLowerCase().includes(q) ||
        (c.estado_demandado || '').toLowerCase().includes(q) ||
        (perfil.pais.nombre || '').toLowerCase().includes(q) ||
        (c.descripcion || '').toLowerCase().includes(q) ||
        (c.abogado_responsable || '').toLowerCase().includes(q);

      const coincideAmbito = filtroAmbito === 'Todos' || perfil.ambito === filtroAmbito;
      const coincidePais = filtroPais === 'Todos' || perfil.pais.nombre === filtroPais;
      const coincideJurisdiccion =
        filtroJurisdiccion === 'Todas' || (c.jurisdiccion || 'CIDH (Comisión)') === filtroJurisdiccion;
      const coincideEstado = filtroEstado === 'Todos' || c.estado === filtroEstado;

      let coincideUrgente = true;
      if (filtroSoloUrgentes) {
        const sem = calcularSemaforoDePlazos(c.plazos);
        coincideUrgente = Boolean(sem && sem.urgente);
      }

      return (
        coincideTexto &&
        coincideAmbito &&
        coincidePais &&
        coincideJurisdiccion &&
        coincideEstado &&
        coincideUrgente
      );
    });
  }, [casos, busqueda, filtroAmbito, filtroPais, filtroJurisdiccion, filtroEstado, filtroSoloUrgentes]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress size={28} sx={{ color: '#0f172a' }} />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1440, mx: 'auto', pb: 6 }}>
      {/* ===================================================================== */}
      {/* CABECERA EJECUTIVA MINIMALISTA + TELEMETRÍA INTEGRADA                 */}
      {/* ===================================================================== */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', lg: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', lg: 'center' },
          gap: 2,
          pb: 2.5,
          mb: 2.5,
          borderBottom: '1px solid #e2e8f0'
        }}
      >
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap' }}>
            <Typography
              variant="h5"
              sx={{
                fontWeight: 800,
                color: '#0f172a',
                letterSpacing: '-0.025em',
                fontSize: { xs: '1.35rem', sm: '1.6rem' }
              }}
            >
              Casos y Litigios
            </Typography>
            <Box
              sx={{
                px: 1,
                py: 0.25,
                borderRadius: 1.5,
                bgcolor: '#f1f5f9',
                border: '1px solid #e2e8f0',
                fontSize: '0.7rem',
                fontWeight: 600,
                color: '#475569',
                letterSpacing: '0.01em'
              }}
            >
              LatAm · SIDH · ONU
            </Box>
          </Box>
          <Typography
            variant="body2"
            sx={{ color: '#64748b', fontSize: '0.82rem', mt: 0.4, maxWidth: 680 }}
          >
            Portafolio procesal multi-jurisdiccional asistido por PIDA. Haz clic en una tarjeta para desplegar su ficha técnica o abre el expediente directamente.
          </Typography>
        </Box>

        {/* CINTA DE TELEMETRÍA COMPACTA + ACCIONES PRIMARIAS */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            flexWrap: 'wrap',
            width: { xs: '100%', lg: 'auto' },
            justifyContent: { xs: 'space-between', lg: 'flex-end' }
          }}
        >
          {/* Píldora de Métricas Interactivas (Reemplaza los 4 bloques gigantes) */}
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              bgcolor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: 2,
              px: 0.75,
              py: 0.5,
              gap: 0.5,
              boxShadow: '0 1px 2px rgba(15, 23, 42, 0.03)',
              overflowX: 'auto'
            }}
          >
            <Tooltip title="Ver todos los expedientes activos">
              <Box
                onClick={limpiarTodosLosFiltros}
                sx={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 0.6,
                  px: 1.25,
                  py: 0.4,
                  borderRadius: 1.25,
                  cursor: 'pointer',
                  bgcolor: !hayFiltrosActivos ? '#f8fafc' : 'transparent',
                  '&:hover': { bgcolor: '#f1f5f9' }
                }}
              >
                <Typography
                  sx={{
                    fontSize: '0.88rem',
                    fontWeight: 800,
                    color: '#0f172a',
                    fontVariantNumeric: 'tabular-nums'
                  }}
                >
                  {metricas.totalActivos}
                </Typography>
                <Typography sx={{ fontSize: '0.72rem', fontWeight: 500, color: '#64748b' }}>
                  activos
                </Typography>
              </Box>
            </Tooltip>

            <Divider orientation="vertical" flexItem sx={{ my: 0.5 }} />

            <Tooltip title="Filtrar casos internacionales (SIDH / ONU)">
              <Box
                onClick={() =>
                  setFiltroAmbito((prev) => (prev === 'Internacional' ? 'Todos' : 'Internacional'))
                }
                sx={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 0.6,
                  px: 1.25,
                  py: 0.4,
                  borderRadius: 1.25,
                  cursor: 'pointer',
                  bgcolor: filtroAmbito === 'Internacional' ? '#eff6ff' : 'transparent',
                  '&:hover': { bgcolor: '#f1f5f9' }
                }}
              >
                <Typography
                  sx={{
                    fontSize: '0.88rem',
                    fontWeight: 800,
                    color: filtroAmbito === 'Internacional' ? '#1d4ed8' : '#0f172a',
                    fontVariantNumeric: 'tabular-nums'
                  }}
                >
                  {metricas.totalInternacionales}
                </Typography>
                <Typography
                  sx={{
                    fontSize: '0.72rem',
                    fontWeight: 500,
                    color: filtroAmbito === 'Internacional' ? '#1e40af' : '#64748b'
                  }}
                >
                  int.
                </Typography>
              </Box>
            </Tooltip>

            <Tooltip title="Filtrar casos en jurisdicción nacional (LatAm)">
              <Box
                onClick={() =>
                  setFiltroAmbito((prev) => (prev === 'Nacional' ? 'Todos' : 'Nacional'))
                }
                sx={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 0.6,
                  px: 1.25,
                  py: 0.4,
                  borderRadius: 1.25,
                  cursor: 'pointer',
                  bgcolor: filtroAmbito === 'Nacional' ? '#ecfdf5' : 'transparent',
                  '&:hover': { bgcolor: '#f1f5f9' }
                }}
              >
                <Typography
                  sx={{
                    fontSize: '0.88rem',
                    fontWeight: 800,
                    color: filtroAmbito === 'Nacional' ? '#047857' : '#0f172a',
                    fontVariantNumeric: 'tabular-nums'
                  }}
                >
                  {metricas.totalNacionales}
                </Typography>
                <Typography
                  sx={{
                    fontSize: '0.72rem',
                    fontWeight: 500,
                    color: filtroAmbito === 'Nacional' ? '#065f46' : '#64748b'
                  }}
                >
                  nac.
                </Typography>
              </Box>
            </Tooltip>

            <Divider orientation="vertical" flexItem sx={{ my: 0.5 }} />

            <Box
              sx={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 0.6,
                px: 1.25,
                py: 0.4
              }}
            >
              <Typography
                sx={{
                  fontSize: '0.88rem',
                  fontWeight: 800,
                  color: '#0f172a',
                  fontVariantNumeric: 'tabular-nums'
                }}
              >
                {metricas.totalRepresentados}
              </Typography>
              <Typography sx={{ fontSize: '0.72rem', fontWeight: 500, color: '#64748b' }}>
                representados
              </Typography>
            </Box>

            <Divider orientation="vertical" flexItem sx={{ my: 0.5 }} />

            <Tooltip title="Filtrar casos con plazos fatales críticos (≤ 5 días)">
              <Box
                onClick={() => setFiltroSoloUrgentes((prev) => !prev)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.6,
                  px: 1.25,
                  py: 0.4,
                  borderRadius: 1.25,
                  cursor: 'pointer',
                  bgcolor: filtroSoloUrgentes
                    ? '#fef2f2'
                    : metricas.plazosUrgentes > 0
                    ? '#fff1f2'
                    : 'transparent',
                  '&:hover': { bgcolor: '#ffe4e6' }
                }}
              >
                <Box
                  sx={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    bgcolor: metricas.plazosUrgentes > 0 ? '#dc2626' : '#94a3b8'
                  }}
                />
                <Typography
                  sx={{
                    fontSize: '0.88rem',
                    fontWeight: 800,
                    color: metricas.plazosUrgentes > 0 ? '#dc2626' : '#64748b',
                    fontVariantNumeric: 'tabular-nums'
                  }}
                >
                  {metricas.plazosUrgentes}
                </Typography>
                <Typography
                  sx={{
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    color: metricas.plazosUrgentes > 0 ? '#b91c1c' : '#64748b'
                  }}
                >
                  urgentes
                </Typography>
              </Box>
            </Tooltip>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {esAdmin && (
              <Tooltip title="Sincronizar estado de pagos con Stripe">
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<CreditCard size={15} />}
                  disabled={sincronizandoStripe}
                  onClick={handleSincronizarStripe}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 600,
                    fontSize: '0.78rem',
                    borderRadius: 1.75,
                    borderColor: '#e2e8f0',
                    color: '#334155',
                    py: 0.65,
                    px: 1.5,
                    '&:hover': { borderColor: '#cbd5e1', bgcolor: '#f8fafc' }
                  }}
                >
                  {sincronizandoStripe ? 'Sincronizando...' : 'Stripe'}
                </Button>
              </Tooltip>
            )}
            <Button
              size="small"
              variant="contained"
              startIcon={<Plus size={16} />}
              onClick={() => setOpenModal(true)}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.8rem',
                borderRadius: 1.75,
                bgcolor: '#0f172a',
                color: '#ffffff',
                py: 0.7,
                px: 1.75,
                boxShadow: '0 1px 2px rgba(15, 23, 42, 0.12)',
                '&:hover': { bgcolor: '#1e293b' }
              }}
            >
              Nuevo Caso
            </Button>
          </Box>
        </Box>
      </Box>

      {/* ===================================================================== */}
      {/* BARRA DE COMANDO Y FILTROS SLEEK (ESTILO LINEAR / HARVEY)             */}
      {/* ===================================================================== */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 1.25,
          mb: 2.5
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            alignItems: { xs: 'stretch', md: 'center' },
            justifyContent: 'space-between',
            gap: 1.25
          }}
        >
          {/* Buscador limpio + Píldoras de Ámbito */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexGrow: 1, flexWrap: 'wrap' }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                bgcolor: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: 2,
                px: 1.5,
                py: 0.5,
                flexGrow: 1,
                maxWidth: { xs: '100%', md: 420 },
                transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                '&:focus-within': {
                  borderColor: '#0f172a',
                  boxShadow: '0 0 0 3px rgba(15, 23, 42, 0.06)'
                }
              }}
            >
              <Search size={15} color="#94a3b8" />
              <InputBase
                inputRef={searchInputRef}
                fullWidth
                placeholder="Buscar por caso, rol, país, demandado o abogado..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                sx={{ ml: 1, fontSize: '0.82rem', color: '#0f172a' }}
              />
              {busqueda ? (
                <IconButton size="small" onClick={() => setBusqueda('')} sx={{ p: 0.25 }}>
                  <X size={14} />
                </IconButton>
              ) : (
                <Box
                  component="kbd"
                  sx={{
                    display: { xs: 'none', sm: 'inline-flex' },
                    alignItems: 'center',
                    justifyContent: 'center',
                    px: 0.65,
                    py: 0.1,
                    borderRadius: 0.85,
                    bgcolor: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    color: '#64748b',
                    fontSize: '0.66rem',
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    lineHeight: 1.2,
                    userSelect: 'none'
                  }}
                >
                  /
                </Box>
              )}
            </Box>

            {/* Tabs rápidos de Ámbito */}
            <Box
              sx={{
                display: 'inline-flex',
                bgcolor: '#f1f5f9',
                p: 0.35,
                borderRadius: 1.75,
                border: '1px solid #e2e8f0'
              }}
            >
              {[
                { key: 'Todos', label: 'Todos' },
                { key: 'Internacional', label: 'SIDH / ONU' },
                { key: 'Nacional', label: 'Nacional LatAm' }
              ].map((tab) => {
                const active = filtroAmbito === tab.key;
                return (
                  <Box
                    key={tab.key}
                    onClick={() => setFiltroAmbito(tab.key)}
                    sx={{
                      px: 1.25,
                      py: 0.4,
                      borderRadius: 1.35,
                      fontSize: '0.75rem',
                      fontWeight: active ? 700 : 500,
                      color: active ? '#0f172a' : '#64748b',
                      bgcolor: active ? '#ffffff' : 'transparent',
                      boxShadow: active ? '0 1px 2px rgba(15,23,42,0.06)' : 'none',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      userSelect: 'none'
                    }}
                  >
                    {tab.label}
                  </Box>
                );
              })}
            </Box>
          </Box>

          {/* Controles derechos: Filtros desplegables + Selector de Vista */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            {hayTarjetasExpandidas && (
              <Button
                size="small"
                onClick={contraerTodasLasTarjetas}
                startIcon={<ChevronUp size={13} />}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.74rem',
                  color: '#475569',
                  fontWeight: 600,
                  bgcolor: '#f1f5f9',
                  borderRadius: 1.5,
                  px: 1.1,
                  py: 0.4,
                  '&:hover': { color: '#0f172a', bgcolor: '#e2e8f0' }
                }}
              >
                Contraer abiertas
              </Button>
            )}

            {hayFiltrosActivos && (
              <Button
                size="small"
                onClick={limpiarTodosLosFiltros}
                startIcon={<X size={13} />}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.74rem',
                  color: '#64748b',
                  fontWeight: 600,
                  '&:hover': { color: '#0f172a', bgcolor: '#f1f5f9' }
                }}
              >
                Limpiar ({casosFiltrados.length})
              </Button>
            )}

            <Button
              size="small"
              variant="outlined"
              onClick={() => setMostrarFiltrosAvanzados((prev) => !prev)}
              startIcon={<SlidersHorizontal size={14} />}
              sx={{
                textTransform: 'none',
                fontSize: '0.76rem',
                fontWeight: 600,
                borderRadius: 1.75,
                borderColor:
                  filtroPais !== 'Todos' || filtroJurisdiccion !== 'Todas' || filtroEstado !== 'Todos'
                    ? '#0f172a'
                    : '#e2e8f0',
                color: '#334155',
                bgcolor: mostrarFiltrosAvanzados ? '#f8fafc' : '#ffffff',
                py: 0.55,
                px: 1.25
              }}
            >
              Filtros
              {(filtroPais !== 'Todos' ||
                filtroJurisdiccion !== 'Todas' ||
                filtroEstado !== 'Todos') && (
                <Box
                  component="span"
                  sx={{
                    ml: 0.75,
                    px: 0.6,
                    py: 0.05,
                    borderRadius: 1,
                    bgcolor: '#0f172a',
                    color: '#fff',
                    fontSize: '0.66rem',
                    fontWeight: 700
                  }}
                >
                  {[
                    filtroPais !== 'Todos',
                    filtroJurisdiccion !== 'Todas',
                    filtroEstado !== 'Todos'
                  ].filter(Boolean).length}
                </Box>
              )}
            </Button>

            {/* Conmutador Vista Tarjetas Mínimas vs Vista Lista */}
            <Box
              sx={{
                display: 'inline-flex',
                bgcolor: '#f1f5f9',
                p: 0.3,
                borderRadius: 1.75,
                border: '1px solid #e2e8f0'
              }}
            >
              <Tooltip title="Tarjetas Mínimas (Clic para expandir)">
                <IconButton
                  size="small"
                  onClick={() => setVistaModo('compact')}
                  sx={{
                    p: 0.5,
                    borderRadius: 1.25,
                    bgcolor: vistaModo === 'compact' ? '#ffffff' : 'transparent',
                    color: vistaModo === 'compact' ? '#0f172a' : '#64748b',
                    boxShadow: vistaModo === 'compact' ? '0 1px 2px rgba(15,23,42,0.06)' : 'none'
                  }}
                >
                  <LayoutGrid size={15} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Lista Ejecutiva Compacta">
                <IconButton
                  size="small"
                  onClick={() => setVistaModo('list')}
                  sx={{
                    p: 0.5,
                    borderRadius: 1.25,
                    bgcolor: vistaModo === 'list' ? '#ffffff' : 'transparent',
                    color: vistaModo === 'list' ? '#0f172a' : '#64748b',
                    boxShadow: vistaModo === 'list' ? '0 1px 2px rgba(15,23,42,0.06)' : 'none'
                  }}
                >
                  <ListIcon size={15} />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        </Box>

        {/* Cajón colapsable de filtros adicionales (País, Instancia, Estado) */}
        <Collapse in={mostrarFiltrosAvanzados}>
          <Box
            sx={{
              p: 1.5,
              bgcolor: '#f8fafc',
              borderRadius: 2,
              border: '1px solid #e2e8f0',
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
              gap: 1.5
            }}
          >
            <FormControl size="small" fullWidth sx={{ bgcolor: '#ffffff', borderRadius: 1.5 }}>
              <InputLabel sx={{ fontSize: '0.8rem' }}>País (LatAm)</InputLabel>
              <Select
                value={filtroPais}
                label="País (LatAm)"
                onChange={(e) => setFiltroPais(e.target.value)}
                sx={{ fontSize: '0.82rem' }}
              >
                <MenuItem value="Todos">Todos los Países</MenuItem>
                {PAISES_LATINOAMERICA.map((p) => (
                  <MenuItem key={p.codigo} value={p.nombre}>
                    {p.bandera} {p.nombre}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" fullWidth sx={{ bgcolor: '#ffffff', borderRadius: 1.5 }}>
              <InputLabel sx={{ fontSize: '0.8rem' }}>Vía / Instancia</InputLabel>
              <Select
                value={filtroJurisdiccion}
                label="Vía / Instancia"
                onChange={(e) => setFiltroJurisdiccion(e.target.value)}
                sx={{ fontSize: '0.82rem' }}
              >
                <MenuItem value="Todas">Todas las Instancias</MenuItem>
                {JURISDICCIONES_LITIGIO.map((j) => (
                  <MenuItem key={j} value={j}>
                    {j}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" fullWidth sx={{ bgcolor: '#ffffff', borderRadius: 1.5 }}>
              <InputLabel sx={{ fontSize: '0.8rem' }}>Estado</InputLabel>
              <Select
                value={filtroEstado}
                label="Estado"
                onChange={(e) => setFiltroEstado(e.target.value)}
                sx={{ fontSize: '0.82rem' }}
              >
                <MenuItem value="Todos">Todos</MenuItem>
                {ESTADOS_CASO.map((st) => (
                  <MenuItem key={st} value={st}>
                    {st}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </Collapse>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* ===================================================================== */}
      {/* LISTADO DE CASOS: TARJETAS MÍNIMAS CON REVELADO EN 1 CLIC             */}
      {/* ===================================================================== */}
      {casosFiltrados.length === 0 ? (
        <Box
          sx={{
            textAlign: 'center',
            py: 8,
            px: 3,
            bgcolor: '#ffffff',
            borderRadius: 3,
            border: '1px dashed #cbd5e1'
          }}
        >
          <Scale size={28} color="#94a3b8" style={{ marginBottom: 8 }} />
          <Typography variant="subtitle2" fontWeight={700} color="#334155">
            No se encontraron expedientes con estos filtros
          </Typography>
          <Typography variant="caption" color="#64748b" sx={{ display: 'block', mt: 0.5, mb: 2 }}>
            Ajusta los criterios de búsqueda o registra un nuevo litigio.
          </Typography>
          {hayFiltrosActivos && (
            <Button
              size="small"
              variant="outlined"
              onClick={limpiarTodosLosFiltros}
              sx={{ textTransform: 'none', borderRadius: 1.5, fontWeight: 600 }}
            >
              Restablecer filtros
            </Button>
          )}
        </Box>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns:
              vistaModo === 'list'
                ? '1fr'
                : { xs: '1fr', md: 'repeat(2, 1fr)', xl: 'repeat(3, 1fr)' },
            gap: vistaModo === 'list' ? 1.25 : 2,
            alignItems: 'start'
          }}
        >
          {casosFiltrados.map((caso) => {
            const semaforo = calcularSemaforoDePlazos(caso.plazos);
            const derechos = Array.isArray(caso.derechos_invocados) ? caso.derechos_invocados : [];
            const perfilCaso = obtenerPerfilJurisdiccional(caso);
            const etapaMostrada = sincronizarEtapaConPerfil(caso.etapa_procesal, perfilCaso);
            const isExpanded = Boolean(expandedCardIds[caso.id]);
            const etapaCorta = etapaMostrada.replace(/^\d+\.\s*/, '');

            const etapasList =
              Array.isArray(perfilCaso.etapas) && perfilCaso.etapas.length > 0
                ? perfilCaso.etapas
                : ETAPAS_PROCESALES_LITIGIO;
            const etapaRawIdx = etapasList.indexOf(etapaMostrada);
            const etapaIdx = etapaRawIdx >= 0 ? etapaRawIdx : 0;
            const totalEtapas = etapasList.length || 1;
            const esFilaLista = vistaModo === 'list';

            return (
              <Paper
                key={caso.id}
                elevation={0}
                onClick={(e) => toggleExpandCard(caso.id, e)}
                sx={{
                  position: 'relative',
                  borderRadius: esFilaLista ? '0 8px 8px 0' : '0 10px 10px 0',
                  bgcolor: '#ffffff',
                  border: isExpanded ? '1px solid #94a3b8' : '1px solid #e2e8f0',
                  boxShadow: isExpanded
                    ? '0 10px 25px -5px rgba(15, 23, 42, 0.08)'
                    : '0 1px 2px rgba(15, 23, 42, 0.03)',
                  transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                  cursor: 'pointer',
                  overflow: 'hidden',
                  '&:hover': {
                    borderColor: '#94a3b8',
                    boxShadow: '0 6px 16px -4px rgba(15, 23, 42, 0.07)'
                  },
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: '3.5px',
                    bgcolor: semaforo?.urgente
                      ? '#ef4444'
                      : perfilCaso.esInternacional
                      ? '#2563eb'
                      : '#0d9488'
                  }
                }}
              >
                {/* ========================================================= */}
                {/* VISTA MÍNIMA: FILA HORIZONTAL ('list') vs TARJETA ('compact') */}
                {/* ========================================================= */}
                {esFilaLista ? (
                  <Box
                    sx={{
                      px: 2.25,
                      py: 1.35,
                      pl: 2.75,
                      display: 'flex',
                      flexDirection: { xs: 'column', md: 'row' },
                      alignItems: { xs: 'flex-start', md: 'center' },
                      justifyContent: 'space-between',
                      gap: 1.5
                    }}
                  >
                    {/* Izquierda: Jurisdicción + Rol + Título + Demandado */}
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.25,
                        minWidth: 0,
                        flex: 1,
                        flexWrap: { xs: 'wrap', md: 'nowrap' }
                      }}
                    >
                      <Box
                        component="span"
                        sx={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 0.5,
                          px: 0.9,
                          py: 0.2,
                          borderRadius: 1,
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                          bgcolor: perfilCaso.esInternacional ? '#eff6ff' : '#f0fdf4',
                          color: perfilCaso.esInternacional ? '#1d4ed8' : '#0f766e'
                        }}
                      >
                        {perfilCaso.pais.bandera} {caso.jurisdiccion || 'CIDH'}
                      </Box>

                      {caso.expediente_oficial && (
                        <Box
                          component="span"
                          sx={{
                            px: 0.75,
                            py: 0.15,
                            borderRadius: 1,
                            fontSize: '0.67rem',
                            fontWeight: 600,
                            fontFamily: 'monospace',
                            bgcolor: '#f1f5f9',
                            color: '#334155',
                            border: '1px solid #e2e8f0',
                            whiteSpace: 'nowrap',
                            flexShrink: 0
                          }}
                        >
                          {caso.expediente_oficial}
                        </Box>
                      )}

                      <Typography
                        variant="subtitle2"
                        noWrap
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectCaso(caso);
                        }}
                        sx={{
                          fontWeight: 700,
                          color: '#0f172a',
                          fontSize: '0.9rem',
                          letterSpacing: '-0.01em',
                          minWidth: 0,
                          '&:hover': {
                            color: '#1d4ed8',
                            textDecoration: 'underline',
                            textUnderlineOffset: '3px'
                          }
                        }}
                      >
                        {caso.nombre}
                      </Typography>

                      {caso.estado_demandado && (
                        <Typography
                          variant="caption"
                          noWrap
                          sx={{
                            color: '#64748b',
                            fontSize: '0.74rem',
                            flexShrink: 0,
                            display: { xs: 'none', lg: 'inline' }
                          }}
                        >
                          · vs. <strong style={{ color: '#475569' }}>{caso.estado_demandado}</strong>
                        </Typography>
                      )}
                    </Box>

                    {/* Derecha: Progreso Etapa + Representados + Semáforo + Abrir + Chevron */}
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        flexShrink: 0,
                        width: { xs: '100%', md: 'auto' },
                        justifyContent: { xs: 'space-between', md: 'flex-end' }
                      }}
                    >
                      {/* Indicador de Etapa Procesal con Micro-Progreso */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        <Box
                          component="span"
                          sx={{
                            px: 0.65,
                            py: 0.1,
                            borderRadius: 0.85,
                            bgcolor: '#f1f5f9',
                            color: '#334155',
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            fontVariantNumeric: 'tabular-nums'
                          }}
                        >
                          {etapaIdx + 1}/{totalEtapas}
                        </Box>
                        <Typography
                          variant="caption"
                          noWrap
                          sx={{
                            fontSize: '0.73rem',
                            fontWeight: 600,
                            color: '#475569',
                            maxWidth: 160
                          }}
                        >
                          {etapaCorta}
                        </Typography>
                      </Box>

                      <Box
                        sx={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 0.4,
                          fontSize: '0.74rem',
                          color: '#64748b',
                          fontVariantNumeric: 'tabular-nums'
                        }}
                      >
                        <Users size={13} color="#64748b" />
                        <strong style={{ color: '#0f172a' }}>{caso.totalClientes}</strong>
                      </Box>

                      {semaforo ? (
                        <Box
                          component="span"
                          sx={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 0.5,
                            px: 0.85,
                            py: 0.2,
                            borderRadius: 1,
                            fontSize: '0.67rem',
                            fontWeight: 700,
                            bgcolor: semaforo.bcolor,
                            color: semaforo.textColor,
                            whiteSpace: 'nowrap'
                          }}
                        >
                          <Clock size={11} />
                          {semaforo.label}
                        </Box>
                      ) : (
                        <Box
                          component="span"
                          sx={{
                            px: 0.8,
                            py: 0.15,
                            borderRadius: 1,
                            fontSize: '0.67rem',
                            fontWeight: 600,
                            bgcolor: caso.estado === 'Activo' ? '#f0fdf4' : '#f1f5f9',
                            color: caso.estado === 'Activo' ? '#15803d' : '#64748b'
                          }}
                        >
                          {caso.estado}
                        </Box>
                      )}

                      <Box
                        sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          size="small"
                          onClick={() => onSelectCaso(caso)}
                          endIcon={<ArrowUpRight size={13} />}
                          sx={{
                            textTransform: 'none',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            color: '#0f172a',
                            bgcolor: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: 1.5,
                            px: 1.1,
                            py: 0.25,
                            minWidth: 'auto',
                            '&:hover': {
                              bgcolor: '#0f172a',
                              color: '#ffffff',
                              borderColor: '#0f172a'
                            }
                          }}
                        >
                          Abrir
                        </Button>

                        <Tooltip title={isExpanded ? 'Contraer ficha rápida' : 'Desplegar ficha rápida'}>
                          <IconButton
                            size="small"
                            onClick={(e) => toggleExpandCard(caso.id, e)}
                            sx={{
                              p: 0.35,
                              color: '#64748b',
                              bgcolor: isExpanded ? '#f1f5f9' : 'transparent',
                              '&:hover': { bgcolor: '#f1f5f9', color: '#0f172a' }
                            }}
                          >
                            {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>
                  </Box>
                ) : (
                  /* TARJETA MÍNIMA EN CUADRÍCULA ('compact') */
                  <Box sx={{ p: 2, pl: 2.5 }}>
                    {/* Fila Superior: Insignia Jurisdiccional + Rol Oficial + Semáforo de Plazo */}
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 1,
                        mb: 1
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                        <Box
                          component="span"
                          sx={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 0.5,
                            px: 0.9,
                            py: 0.2,
                            borderRadius: 1,
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            bgcolor: perfilCaso.esInternacional ? '#eff6ff' : '#f0fdf4',
                            color: perfilCaso.esInternacional ? '#1d4ed8' : '#0f766e'
                          }}
                        >
                          {perfilCaso.pais.bandera} {caso.jurisdiccion || 'CIDH'}
                        </Box>

                        {caso.expediente_oficial && (
                          <Box
                            component="span"
                            sx={{
                              px: 0.8,
                              py: 0.15,
                              borderRadius: 1,
                              fontSize: '0.67rem',
                              fontWeight: 600,
                              fontFamily: 'monospace',
                              bgcolor: '#f1f5f9',
                              color: '#334155',
                              border: '1px solid #e2e8f0'
                            }}
                          >
                            {caso.expediente_oficial}
                          </Box>
                        )}
                      </Box>

                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        {semaforo ? (
                          <Box
                            component="span"
                            sx={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 0.5,
                              px: 0.85,
                              py: 0.2,
                              borderRadius: 1,
                              fontSize: '0.67rem',
                              fontWeight: 700,
                              bgcolor: semaforo.bcolor,
                              color: semaforo.textColor
                            }}
                          >
                            <Clock size={11} />
                            {semaforo.label}
                          </Box>
                        ) : (
                          <Box
                            component="span"
                            sx={{
                              px: 0.8,
                              py: 0.15,
                              borderRadius: 1,
                              fontSize: '0.67rem',
                              fontWeight: 600,
                              bgcolor: caso.estado === 'Activo' ? '#f0fdf4' : '#f1f5f9',
                              color: caso.estado === 'Activo' ? '#15803d' : '#64748b'
                            }}
                          >
                            {caso.estado}
                          </Box>
                        )}

                        <Tooltip title={isExpanded ? 'Contraer ficha rápida' : 'Ver ficha rápida'}>
                          <IconButton
                            size="small"
                            onClick={(e) => toggleExpandCard(caso.id, e)}
                            sx={{
                              p: 0.35,
                              color: '#64748b',
                              bgcolor: isExpanded ? '#f1f5f9' : 'transparent',
                              '&:hover': { bgcolor: '#f1f5f9', color: '#0f172a' }
                            }}
                          >
                            {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>

                    {/* Título Principal del Caso + Contraparte */}
                    <Box sx={{ mb: 1.35 }}>
                      <Typography
                        variant="subtitle1"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectCaso(caso);
                        }}
                        sx={{
                          fontWeight: 700,
                          color: '#0f172a',
                          fontSize: '0.96rem',
                          lineHeight: 1.32,
                          letterSpacing: '-0.01em',
                          display: '-webkit-box',
                          WebkitLineClamp: isExpanded ? 'unset' : 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          '&:hover': {
                            color: '#1d4ed8',
                            textDecoration: 'underline',
                            textUnderlineOffset: '3px'
                          }
                        }}
                      >
                        {caso.nombre}
                      </Typography>

                      {caso.estado_demandado && (
                        <Typography
                          variant="caption"
                          sx={{
                            color: '#64748b',
                            fontSize: '0.75rem',
                            display: 'block',
                            mt: 0.25
                          }}
                        >
                          Contra <strong style={{ color: '#475569' }}>{caso.estado_demandado}</strong>
                        </Typography>
                      )}
                    </Box>

                    {/* Pie Compacto Mínimo: Representados · Etapa con Progreso · Acción Directa */}
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 1,
                        pt: 1,
                        borderTop: '1px solid #f1f5f9'
                      }}
                    >
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          color: '#64748b',
                          fontSize: '0.74rem',
                          overflow: 'hidden'
                        }}
                      >
                        <Tooltip title=" Personas representadas en el caso">
                          <Box
                            sx={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 0.4,
                              whiteSpace: 'nowrap',
                              fontVariantNumeric: 'tabular-nums'
                            }}
                          >
                            <Users size={13} color="#64748b" />
                            <strong style={{ color: '#0f172a' }}>{caso.totalClientes}</strong>
                          </Box>
                        </Tooltip>

                        <Box sx={{ color: '#cbd5e1' }}>·</Box>

                        {/* Píldora de Progreso de Etapa (Ej: 3/5 + Barra segmentada + Nombre) */}
                        <Box
                          sx={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 0.6,
                            minWidth: 0
                          }}
                        >
                          <Box
                            component="span"
                            sx={{
                              px: 0.55,
                              py: 0.05,
                              borderRadius: 0.75,
                              bgcolor: '#f1f5f9',
                              color: '#334155',
                              fontSize: '0.64rem',
                              fontWeight: 700,
                              fontVariantNumeric: 'tabular-nums',
                              flexShrink: 0
                            }}
                          >
                            {etapaIdx + 1}/{totalEtapas}
                          </Box>

                          <Box
                            sx={{
                              display: { xs: 'none', sm: 'inline-flex' },
                              alignItems: 'center',
                              gap: '2px',
                              flexShrink: 0
                            }}
                          >
                            {etapasList.map((stName, idx) => (
                              <Box
                                key={stName}
                                sx={{
                                  width: 6,
                                  height: 3.5,
                                  borderRadius: 0.5,
                                  bgcolor:
                                    idx <= etapaIdx
                                      ? perfilCaso.esInternacional
                                        ? '#2563eb'
                                        : '#0d9488'
                                      : '#e2e8f0'
                                }}
                              />
                            ))}
                          </Box>

                          <Typography
                            variant="caption"
                            noWrap
                            sx={{
                              fontSize: '0.73rem',
                              fontWeight: 600,
                              color: '#475569'
                            }}
                          >
                            {etapaCorta}
                          </Typography>
                        </Box>
                      </Box>

                      <Box
                        sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          size="small"
                          onClick={() => onSelectCaso(caso)}
                          endIcon={<ArrowUpRight size={13} />}
                          sx={{
                            textTransform: 'none',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            color: '#0f172a',
                            bgcolor: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: 1.5,
                            px: 1.15,
                            py: 0.25,
                            minWidth: 'auto',
                            '&:hover': {
                              bgcolor: '#0f172a',
                              color: '#ffffff',
                              borderColor: '#0f172a'
                            }
                          }}
                        >
                          Abrir
                        </Button>
                      </Box>
                    </Box>
                  </Box>
                )}

                {/* ========================================================= */}
                {/* CAJÓN DESPLEGABLE EN 1 CLIC (PROGRESSIVE DISCLOSURE)      */}
                {/* ========================================================= */}
                <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                  <Box
                    onClick={(e) => e.stopPropagation()}
                    sx={{
                      px: 2.5,
                      py: 2,
                      bgcolor: '#f8fafc',
                      borderTop: '1px solid #e2e8f0',
                      cursor: 'default'
                    }}
                  >
                    {/* Línea de Tiempo / Progreso de Etapas Procesales */}
                    <Box sx={{ mb: 1.75 }}>
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          mb: 0.6
                        }}
                      >
                        <Typography
                          sx={{
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            color: '#475569',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em'
                          }}
                        >
                          Ruta Procesal ({etapaIdx + 1} de {totalEtapas})
                        </Typography>
                        <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#0f172a' }}>
                          {etapaMostrada}
                        </Typography>
                      </Box>

                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: `repeat(${totalEtapas}, 1fr)`,
                          gap: 0.5
                        }}
                      >
                        {etapasList.map((etName, idx) => {
                          const isCompleted = idx < etapaIdx;
                          const isCurrent = idx === etapaIdx;
                          const cleanName = etName.replace(/^\d+\.\s*/, '');
                          return (
                            <Tooltip key={etName} title={etName}>
                              <Box sx={{ minWidth: 0 }}>
                                <Box
                                  sx={{
                                    height: 4,
                                    borderRadius: 1,
                                    mb: 0.4,
                                    bgcolor: isCurrent
                                      ? '#0f172a'
                                      : isCompleted
                                      ? perfilCaso.esInternacional
                                        ? '#3b82f6'
                                        : '#14b8a6'
                                      : '#e2e8f0'
                                  }}
                                />
                                <Typography
                                  noWrap
                                  sx={{
                                    fontSize: '0.62rem',
                                    fontWeight: isCurrent ? 700 : 500,
                                    color: isCurrent
                                      ? '#0f172a'
                                      : isCompleted
                                      ? '#475569'
                                      : '#94a3b8'
                                  }}
                                >
                                  {cleanName}
                                </Typography>
                              </Box>
                            </Tooltip>
                          );
                        })}
                      </Box>
                    </Box>

                    {/* Síntesis Fáctica */}
                    <Typography
                      variant="caption"
                      sx={{
                        display: 'block',
                        fontWeight: 700,
                        color: '#475569',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        fontSize: '0.65rem',
                        mb: 0.4
                      }}
                    >
                      Síntesis Fáctica y Objeto
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        color: '#334155',
                        fontSize: '0.8rem',
                        lineHeight: 1.55,
                        mb: 1.5
                      }}
                    >
                      {caso.descripcion || 'Sin descripción registrada en la ficha del expediente.'}
                    </Typography>

                    {/* Metadatos Técnicos en Cuadrícula Limpia */}
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                        gap: 1,
                        p: 1.25,
                        bgcolor: '#ffffff',
                        borderRadius: 1.75,
                        border: '1px solid #e2e8f0',
                        mb: 1.5
                      }}
                    >
                      <Box>
                        <Typography sx={{ fontSize: '0.66rem', color: '#64748b', fontWeight: 600 }}>
                          Estándar Procesal
                        </Typography>
                        <Typography sx={{ fontSize: '0.76rem', color: '#0f172a', fontWeight: 700 }}>
                          {perfilCaso.normaCorto}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: '0.66rem', color: '#64748b', fontWeight: 600 }}>
                          Responsable Legal
                        </Typography>
                        <Typography
                          noWrap
                          sx={{ fontSize: '0.76rem', color: '#0f172a', fontWeight: 600 }}
                        >
                          {caso.abogado_responsable || 'Equipo Legal IIRESODH'}
                        </Typography>
                      </Box>
                    </Box>

                    {/* Normativa / Derechos Invocados */}
                    {derechos.length > 0 && (
                      <Box sx={{ mb: 1.75 }}>
                        <Typography
                          sx={{
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            color: '#64748b',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            mb: 0.6
                          }}
                        >
                          Normativa Invocada
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {derechos.map((d) => (
                            <Box
                              key={d}
                              component="span"
                              sx={{
                                px: 0.85,
                                py: 0.25,
                                bgcolor: '#ffffff',
                                border: '1px solid #e2e8f0',
                                borderRadius: 1,
                                fontSize: '0.68rem',
                                fontWeight: 500,
                                color: '#334155'
                              }}
                            >
                              {d}
                            </Box>
                          ))}
                        </Box>
                      </Box>
                    )}

                    {/* Barra de Acciones del Cajón Expandido */}
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 1,
                        pt: 0.5
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<Edit size={13} />}
                          onClick={() => handleOpenEdit(caso)}
                          sx={{
                            textTransform: 'none',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            borderColor: '#cbd5e1',
                            color: '#334155',
                            bgcolor: '#ffffff',
                            borderRadius: 1.5,
                            '&:hover': { borderColor: '#94a3b8', bgcolor: '#f8fafc' }
                          }}
                        >
                          Editar Ficha
                        </Button>

                        {esAdmin && (
                          <Tooltip title="Eliminar litigio permanentemente">
                            <IconButton
                              size="small"
                              onClick={() => handleDeleteCaso(caso.id, caso.nombre)}
                              sx={{
                                p: 0.6,
                                color: '#94a3b8',
                                border: '1px solid transparent',
                                borderRadius: 1.5,
                                '&:hover': {
                                  color: '#dc2626',
                                  bgcolor: '#fef2f2',
                                  borderColor: '#fecaca'
                                }
                              }}
                            >
                              <Trash2 size={14} />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>

                      <Button
                        size="small"
                        variant="contained"
                        endIcon={<ArrowUpRight size={15} />}
                        onClick={() => onSelectCaso(caso)}
                        sx={{
                          textTransform: 'none',
                          fontSize: '0.76rem',
                          fontWeight: 700,
                          bgcolor: '#0f172a',
                          color: '#ffffff',
                          borderRadius: 1.5,
                          px: 2,
                          '&:hover': { bgcolor: '#1e293b' }
                        }}
                      >
                        Entrar al Expediente Completo
                      </Button>
                    </Box>
                  </Box>
                </Collapse>
              </Paper>
            );
          })}
        </Box>
      )}

      {/* MODAL CREAR NUEVO CASO (NACIONAL LATAM O INTERNACIONAL SIDH/ONU) */}
      <Dialog
        open={openModal}
        onClose={() => setOpenModal(false)}
        fullWidth
        maxWidth="md"
        slotProps={{ paper: { sx: { borderRadius: 3, m: { xs: 1.5, sm: 3 } } } }}
      >
        <DialogTitle fontWeight="bold">
          Aperturar Nuevo Caso / Litigio Estratégico (Nacional LatAm o Internacional)
        </DialogTitle>
        <Box component="form" onSubmit={handleCreateCaso}>
          <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Selector de Ámbito y País de Jurisdicción */}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
              <FormControl fullWidth>
                <InputLabel>Ámbito de Litigio</InputLabel>
                <Select
                  value={ambito}
                  label="Ámbito de Litigio"
                  onChange={(e) => handleCambiarAmbitoCreacion(e.target.value)}
                >
                  <MenuItem value="Internacional">🌐 Internacional (SIDH: CIDH / Corte IDH / ONU)</MenuItem>
                  <MenuItem value="Nacional">🏛️ Nacional / Local (Jurisdicción Interna LatAm)</MenuItem>
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel>País de Jurisdicción (Latinoamérica)</InputLabel>
                <Select
                  value={paisJurisdiccion}
                  label="País de Jurisdicción (Latinoamérica)"
                  onChange={(e) => handleCambiarPaisCreacion(e.target.value)}
                >
                  {PAISES_LATINOAMERICA.map((p) => (
                    <MenuItem key={p.codigo} value={p.nombre}>
                      {p.bandera} {p.nombre}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            {/* Resumen del Perfil Jurisdiccional Activo */}
            <Alert severity={ambito === 'Internacional' ? 'info' : 'success'} sx={{ py: 0.75, borderRadius: 2 }}>
              <Typography variant="caption" sx={{ display: 'block', fontWeight: 'bold' }}>
                {perfilCreacion.pais.bandera} Régimen Procesal Activo: {perfilCreacion.normaTitulo}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                {ambito === 'Internacional'
                  ? 'El padrón, las etapas y PIDA evaluarán el expediente bajo los estándares del Sistema Interamericano (CADH / Art. 35 Corte IDH) o Sistema Universal.'
                  : `Tribunales de referencia en ${perfilCreacion.pais.nombre}: ${perfilCreacion.pais.organoConstitucional} · ${perfilCreacion.pais.organoContencioso}. Requisito de personería: ${perfilCreacion.pais.requisitoPoderNacional}`}
              </Typography>
            </Alert>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '2fr 1fr' }, gap: 2 }}>
              <TextField
                autoFocus
                label="Nombre Oficial del Caso / Litigio"
                type="text"
                fullWidth
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder={
                  ambito === 'Internacional'
                    ? `Ej. Colectivo Docente vs. ${paisJurisdiccion}`
                    : `Ej. Acción de Amparo / Contencioso - Colectivo vs. Ministerio (${paisJurisdiccion})`
                }
              />
              <TextField
                label="N° Expediente Oficial / Rol"
                type="text"
                fullWidth
                value={expedienteOficial}
                onChange={(e) => setExpedienteOficial(e.target.value)}
                placeholder={ambito === 'Internacional' ? 'Ej. P-1452-24' : 'Ej. 24-001542-0007-CO'}
              />
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
              <FormControl fullWidth>
                <InputLabel>{ambito === 'Internacional' ? 'Órgano Internacional' : 'Vía Procesal Nacional'}</InputLabel>
                <Select
                  value={jurisdiccion}
                  label={ambito === 'Internacional' ? 'Órgano Internacional' : 'Vía Procesal Nacional'}
                  onChange={(e) => handleCambiarViaCreacion(e.target.value)}
                >
                  {(ambito === 'Internacional' ? VIAS_INTERNACIONALES : VIAS_NACIONALES).map((j) => (
                    <MenuItem key={j} value={j}>
                      {j}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                label={ambito === 'Internacional' ? 'Estado Demandado' : 'Entidad Pública / Parte Demandada'}
                type="text"
                fullWidth
                value={estadoDemandado}
                onChange={(e) => setEstadoDemandado(e.target.value)}
                placeholder={`Ej. Estado de ${paisJurisdiccion} / Ministerio / Institución`}
              />
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
              <FormControl fullWidth>
                <InputLabel>Etapa Procesal Inicial</InputLabel>
                <Select
                  value={etapaProcesal}
                  label="Etapa Procesal Inicial"
                  onChange={(e) => setEtapaProcesal(e.target.value)}
                >
                  {perfilCreacion.etapas.map((et) => (
                    <MenuItem key={et} value={et}>
                      {et}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                label="Abogado(a) Líder / Responsable"
                type="text"
                fullWidth
                value={abogadoResponsable}
                onChange={(e) => setAbogadoResponsable(e.target.value)}
                placeholder={currentUserEmail || 'Nombre del abogado líder'}
              />
            </Box>

            <Box>
              <Typography variant="caption" fontWeight="bold" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                {ambito === 'Internacional'
                  ? 'Derechos Convencionales Invocados (CADH / Protocolo de San Salvador / PIDCP):'
                  : `Normativa Constitucional, Legal y Bloque de Constitucionalidad (${paisJurisdiccion}):`}
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1.5 }}>
                {Array.from(
                  new Set([
                    ...(ambito === 'Internacional'
                      ? DERECHOS_CADH_SUGERIDOS
                      : perfilCreacion.pais.derechosNacionalesSugeridos || []),
                    ...derechosInvocados
                  ])
                ).map((der) => {
                  const sel = derechosInvocados.includes(der);
                  return (
                    <Chip
                      key={der}
                      label={der}
                      size="small"
                      color={sel ? 'primary' : 'default'}
                      variant={sel ? 'filled' : 'outlined'}
                      onClick={() => toggleDerecho(der, derechosInvocados, setDerechosInvocados)}
                      sx={{ fontWeight: 'bold', fontSize: '0.72rem' }}
                    />
                  );
                })}
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  size="small"
                  fullWidth
                  placeholder="Agregar otro artículo constitucional, ley nacional o convenio (ej. Convenio 169 OIT)..."
                  value={nuevaNormaInput}
                  onChange={(e) => setNuevaNormaInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      agregarNormaPersonalizada(
                        nuevaNormaInput,
                        derechosInvocados,
                        setDerechosInvocados,
                        setNuevaNormaInput
                      );
                    }
                  }}
                />
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() =>
                    agregarNormaPersonalizada(
                      nuevaNormaInput,
                      derechosInvocados,
                      setDerechosInvocados,
                      setNuevaNormaInput
                    )
                  }
                  sx={{ textTransform: 'none', fontWeight: 'bold', whiteSpace: 'nowrap' }}
                >
                  + Norma
                </Button>
              </Box>
            </Box>

            <TextField
              label="Síntesis Fáctica y Objeto del Litigio"
              type="text"
              fullWidth
              multiline
              rows={3}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder={
                ambito === 'Internacional'
                  ? 'Resumen de los hechos violatorios, agotamiento de recursos internos y pretensiones ante el órgano internacional...'
                  : `Resumen de los hechos, acto administrativo o norma impugnada ante los tribunales de ${paisJurisdiccion} y pretensiones...`
              }
            />
          </DialogContent>
          <DialogActions sx={{ p: 2.5 }}>
            <Button onClick={() => setOpenModal(false)} color="inherit" sx={{ textTransform: 'none' }}>
              Cancelar
            </Button>
            <Button type="submit" variant="contained" sx={{ textTransform: 'none', fontWeight: 'bold' }}>
              Crear Caso
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* MODAL EDICIÓN DE FICHA TÉCNICA MULTI-JURISDICCIONAL */}
      <Dialog
        open={openEditModal}
        onClose={() => setOpenEditModal(false)}
        fullWidth
        maxWidth="md"
        slotProps={{ paper: { sx: { borderRadius: 3, m: { xs: 1.5, sm: 3 } } } }}
      >
        <DialogTitle fontWeight="bold">Configuración Técnica y Jurisdiccional del Litigio</DialogTitle>
        <Box component="form" onSubmit={handleUpdateCaso}>
          <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
              <FormControl fullWidth>
                <InputLabel>Ámbito del Litigio</InputLabel>
                <Select
                  value={editAmbito}
                  label="Ámbito del Litigio"
                  onChange={(e) => {
                    const nuevoAmb = e.target.value;
                    setEditAmbito(nuevoAmb);
                    const nuevaVia =
                      nuevoAmb === 'Internacional' ? 'CIDH (Comisión)' : VIAS_NACIONALES[0];
                    setEditJurisdiccion(nuevaVia);
                    const nuevoP = obtenerPerfilJurisdiccional({
                      ambito: nuevoAmb,
                      pais_jurisdiccion: editPaisJurisdiccion,
                      jurisdiccion: nuevaVia
                    });
                    setEditEtapaProcesal(sincronizarEtapaConPerfil(editEtapaProcesal, nuevoP));
                  }}
                >
                  <MenuItem value="Internacional">🌐 Internacional (SIDH: CIDH / Corte IDH / ONU)</MenuItem>
                  <MenuItem value="Nacional">🏛️ Nacional / Local (Jurisdicción Interna LatAm)</MenuItem>
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel>País de Jurisdicción (Latinoamérica)</InputLabel>
                <Select
                  value={editPaisJurisdiccion}
                  label="País de Jurisdicción (Latinoamérica)"
                  onChange={(e) => setEditPaisJurisdiccion(e.target.value)}
                >
                  {PAISES_LATINOAMERICA.map((p) => (
                    <MenuItem key={p.codigo} value={p.nombre}>
                      {p.bandera} {p.nombre}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            <Alert severity={editAmbito === 'Internacional' ? 'info' : 'success'} sx={{ py: 0.5, borderRadius: 2 }}>
              <Typography variant="caption" sx={{ display: 'block', fontWeight: 'bold' }}>
                {perfilEdicion.pais.bandera} Estándar activo: {perfilEdicion.normaTitulo}
              </Typography>
            </Alert>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '2fr 1fr' }, gap: 2 }}>
              <TextField
                label="Nombre del Caso"
                type="text"
                fullWidth
                required
                value={editNombre}
                onChange={(e) => setEditNombre(e.target.value)}
              />
              <TextField
                label="N° Expediente Oficial"
                type="text"
                fullWidth
                value={editExpedienteOficial}
                onChange={(e) => setEditExpedienteOficial(e.target.value)}
                placeholder="Ej. P-1452-24 o 24-001542-0007-CO"
              />
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
              <FormControl fullWidth>
                <InputLabel>Órgano / Vía Procesal</InputLabel>
                <Select
                  value={editJurisdiccion}
                  label="Órgano / Vía Procesal"
                  onChange={(e) => {
                    const nuevaVia = e.target.value;
                    setEditJurisdiccion(nuevaVia);
                    const nuevoP = obtenerPerfilJurisdiccional({
                      ambito: editAmbito,
                      pais_jurisdiccion: editPaisJurisdiccion,
                      jurisdiccion: nuevaVia
                    });
                    setEditEtapaProcesal(sincronizarEtapaConPerfil(editEtapaProcesal, nuevoP));
                  }}
                >
                  {Array.from(
                    new Set([
                      ...(editAmbito === 'Internacional' ? VIAS_INTERNACIONALES : VIAS_NACIONALES),
                      editJurisdiccion
                    ])
                  )
                    .filter(Boolean)
                    .map((j) => (
                      <MenuItem key={j} value={j}>
                        {j}
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>

              <TextField
                label="Estado / Entidad Demandada"
                type="text"
                fullWidth
                value={editEstadoDemandado}
                onChange={(e) => setEditEstadoDemandado(e.target.value)}
              />
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
              <FormControl fullWidth>
                <InputLabel>Etapa Procesal Actual</InputLabel>
                <Select
                  value={editEtapaProcesal}
                  label="Etapa Procesal Actual"
                  onChange={(e) => setEditEtapaProcesal(e.target.value)}
                >
                  {Array.from(new Set([...perfilEdicion.etapas, editEtapaProcesal]))
                    .filter(Boolean)
                    .map((et) => (
                      <MenuItem key={et} value={et}>
                        {et}
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel>Estado Operativo del Caso</InputLabel>
                <Select
                  value={editEstado}
                  label="Estado Operativo del Caso"
                  onChange={(e) => setEditEstado(e.target.value)}
                >
                  {ESTADOS_CASO.map((status) => (
                    <MenuItem key={status} value={status}>
                      {status}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            <TextField
              label="Abogado(a) Líder / Responsable"
              type="text"
              fullWidth
              value={editAbogadoResponsable}
              onChange={(e) => setEditAbogadoResponsable(e.target.value)}
            />

            <Box>
              <Typography variant="caption" fontWeight="bold" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                {editAmbito === 'Internacional'
                  ? 'Derechos Invocados (CADH / Protocolo de San Salvador / PIDCP):'
                  : `Normas Constitucionales y Legales Invocadas (${editPaisJurisdiccion}):`}
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1.5 }}>
                {Array.from(
                  new Set([
                    ...(editAmbito === 'Internacional'
                      ? DERECHOS_CADH_SUGERIDOS
                      : perfilEdicion.pais.derechosNacionalesSugeridos || []),
                    ...editDerechosInvocados
                  ])
                ).map((der) => {
                  const sel = editDerechosInvocados.includes(der);
                  return (
                    <Chip
                      key={der}
                      label={der}
                      size="small"
                      color={sel ? 'primary' : 'default'}
                      variant={sel ? 'filled' : 'outlined'}
                      onClick={() => toggleDerecho(der, editDerechosInvocados, setEditDerechosInvocados)}
                      sx={{ fontWeight: 'bold', fontSize: '0.72rem' }}
                    />
                  );
                })}
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  size="small"
                  fullWidth
                  placeholder="Agregar otra norma o artículo..."
                  value={editNuevaNormaInput}
                  onChange={(e) => setEditNuevaNormaInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      agregarNormaPersonalizada(
                        editNuevaNormaInput,
                        editDerechosInvocados,
                        setEditDerechosInvocados,
                        setEditNuevaNormaInput
                      );
                    }
                  }}
                />
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() =>
                    agregarNormaPersonalizada(
                      editNuevaNormaInput,
                      editDerechosInvocados,
                      setEditDerechosInvocados,
                      setEditNuevaNormaInput
                    )
                  }
                  sx={{ textTransform: 'none', fontWeight: 'bold', whiteSpace: 'nowrap' }}
                >
                  + Norma
                </Button>
              </Box>
            </Box>

            <TextField
              label="Descripción y Síntesis Fáctica"
              type="text"
              fullWidth
              multiline
              rows={3}
              value={editDescripcion}
              onChange={(e) => setEditDescripcion(e.target.value)}
            />
          </DialogContent>
          <DialogActions sx={{ p: 2.5 }}>
            <Button onClick={() => setOpenEditModal(false)} color="inherit" sx={{ textTransform: 'none' }}>
              Cancelar
            </Button>
            <Button type="submit" variant="contained" sx={{ textTransform: 'none', fontWeight: 'bold' }}>
              Guardar Cambios
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
}
