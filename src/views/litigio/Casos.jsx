import React, { useState, useEffect, useMemo } from 'react';
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
  Card,
  CardContent,
  CardActions,
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
  Paper
} from '@mui/material';
import {
  Plus,
  Gavel,
  Calendar,
  Users,
  Edit,
  Trash2,
  AlertTriangle,
  Search,
  Globe,
  CreditCard,
  ShieldCheck
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

  // Filtros de búsqueda ejecutiva
  const [busqueda, setBusqueda] = useState('');
  const [filtroAmbito, setFiltroAmbito] = useState('Todos');
  const [filtroPais, setFiltroPais] = useState('Todos');
  const [filtroJurisdiccion, setFiltroJurisdiccion] = useState('Todas');
  const [filtroEstado, setFiltroEstado] = useState('Todos');

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

  const getStatusColor = (status) => {
    switch (status) {
      case 'Activo':
        return 'success';
      case 'Suspendido':
        return 'warning';
      case 'Cerrado':
        return 'error';
      case 'Archivado':
        return 'default';
      default:
        return 'primary';
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

      return coincideTexto && coincideAmbito && coincidePais && coincideJurisdiccion && coincideEstado;
    });
  }, [casos, busqueda, filtroAmbito, filtroPais, filtroJurisdiccion, filtroEstado]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Cabecera Ejecutiva */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'stretch', md: 'center' },
          gap: 2,
          mb: 3
        }}
      >
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            <Typography
              variant="h4"
              fontWeight="bold"
              color="text.primary"
              sx={{ fontSize: { xs: '1.4rem', sm: '2.125rem' } }}
            >
              Casos y Litigios Estratégicos
            </Typography>
            <Chip
              label="Latinoamérica + SIDH / ONU · PIDA"
              size="small"
              color="primary"
              variant="outlined"
              sx={{ fontWeight: 'bold' }}
            />
          </Box>
          <Typography variant="body2" color="text.secondary">
            Gestión adaptativa de litigios nacionales en toda Latinoamérica (Constitucional, Contencioso, Laboral, Penal) e instancias internacionales (CIDH, Corte IDH, ONU) asistida por PIDA.
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          {esAdmin && (
            <Button
              variant="outlined"
              startIcon={<CreditCard size={18} />}
              disabled={sincronizandoStripe}
              onClick={handleSincronizarStripe}
              sx={{ textTransform: 'none', fontWeight: 'bold', borderRadius: 2 }}
            >
              {sincronizandoStripe ? 'Sincronizando Stripe...' : 'Sincronizar Pagos Stripe'}
            </Button>
          )}
          <Button
            variant="contained"
            startIcon={<Plus size={18} />}
            onClick={() => setOpenModal(true)}
            sx={{
              textTransform: 'none',
              fontWeight: 'bold',
              borderRadius: 2,
              width: { xs: '100%', sm: 'auto' }
            }}
          >
            Nuevo Caso
          </Button>
        </Box>
      </Box>

      {/* Tarjetas de KPIs Ejecutivos */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(4, 1fr)' },
          gap: 2,
          mb: 3
        }}
      >
        <Paper sx={{ p: 2, borderRadius: 2.5, border: '1px solid #e2e8f0', boxShadow: 'none' }}>
          <Typography variant="caption" fontWeight="bold" color="text.secondary" sx={{ textTransform: 'uppercase' }}>
            Expedientes Activos
          </Typography>
          <Typography variant="h5" fontWeight="bold" color="primary.main" sx={{ mt: 0.5 }}>
            {metricas.totalActivos}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            De {casos.length} casos totales
          </Typography>
        </Paper>

        <Paper sx={{ p: 2, borderRadius: 2.5, border: '1px solid #e0e7ff', bgcolor: '#f8fafc', boxShadow: 'none' }}>
          <Typography variant="caption" fontWeight="bold" color="#4338ca" sx={{ textTransform: 'uppercase' }}>
            Foros Int. / Nacionales (LatAm)
          </Typography>
          <Typography variant="h5" fontWeight="bold" color="#312e81" sx={{ mt: 0.5 }}>
            🌐 {metricas.totalInternacionales} · 🏛️ {metricas.totalNacionales}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            SIDH / ONU vs. Vías Internas LatAm
          </Typography>
        </Paper>

        <Paper sx={{ p: 2, borderRadius: 2.5, border: '1px solid #dcfce7', bgcolor: '#f0fdf4', boxShadow: 'none' }}>
          <Typography variant="caption" fontWeight="bold" color="#15803d" sx={{ textTransform: 'uppercase' }}>
            Víctimas / Representados
          </Typography>
          <Typography variant="h5" fontWeight="bold" color="#14532d" sx={{ mt: 0.5 }}>
            {metricas.totalRepresentados}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Padrón acumulado activo
          </Typography>
        </Paper>

        <Paper
          sx={{
            p: 2,
            borderRadius: 2.5,
            border: metricas.plazosUrgentes > 0 ? '1px solid #fecaca' : '1px solid #e2e8f0',
            bgcolor: metricas.plazosUrgentes > 0 ? '#fef2f2' : '#ffffff',
            boxShadow: 'none'
          }}
        >
          <Typography
            variant="caption"
            fontWeight="bold"
            color={metricas.plazosUrgentes > 0 ? 'error.main' : 'text.secondary'}
            sx={{ textTransform: 'uppercase' }}
          >
            Plazos Fatales Críticos
          </Typography>
          <Typography
            variant="h5"
            fontWeight="bold"
            color={metricas.plazosUrgentes > 0 ? 'error.main' : 'text.primary'}
            sx={{ mt: 0.5 }}
          >
            {metricas.plazosUrgentes}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Vencidos o próximos (≤ 5 días)
          </Typography>
        </Paper>
      </Box>

      {/* Barra de Búsqueda y Filtros Multi-Jurisdiccionales */}
      <Paper
        sx={{
          p: 2,
          mb: 3,
          borderRadius: 2.5,
          border: '1px solid #e2e8f0',
          boxShadow: 'none',
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '2fr 1fr 1fr 1fr 1fr' },
          gap: 1.5
        }}
      >
        <TextField
          size="small"
          fullWidth
          placeholder="Buscar por caso, expediente, país, Estado demandado o abogado..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          InputProps={{
            startAdornment: (
              <Box sx={{ display: 'flex', alignItems: 'center', mr: 1, color: 'text.secondary' }}>
                <Search size={18} />
              </Box>
            )
          }}
        />

        <FormControl size="small" fullWidth>
          <InputLabel>Ámbito</InputLabel>
          <Select value={filtroAmbito} label="Ámbito" onChange={(e) => setFiltroAmbito(e.target.value)}>
            <MenuItem value="Todos">Todos los Ámbitos</MenuItem>
            <MenuItem value="Internacional">🌐 Internacional (SIDH/ONU)</MenuItem>
            <MenuItem value="Nacional">🏛️ Nacional (Vía Interna)</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" fullWidth>
          <InputLabel>País (LatAm)</InputLabel>
          <Select value={filtroPais} label="País (LatAm)" onChange={(e) => setFiltroPais(e.target.value)}>
            <MenuItem value="Todos">Todos los Países</MenuItem>
            {PAISES_LATINOAMERICA.map((p) => (
              <MenuItem key={p.codigo} value={p.nombre}>
                {p.bandera} {p.nombre}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" fullWidth>
          <InputLabel>Vía / Instancia</InputLabel>
          <Select
            value={filtroJurisdiccion}
            label="Vía / Instancia"
            onChange={(e) => setFiltroJurisdiccion(e.target.value)}
          >
            <MenuItem value="Todas">Todas las Instancias</MenuItem>
            {JURISDICCIONES_LITIGIO.map((j) => (
              <MenuItem key={j} value={j}>
                {j}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" fullWidth>
          <InputLabel>Estado</InputLabel>
          <Select value={filtroEstado} label="Estado" onChange={(e) => setFiltroEstado(e.target.value)}>
            <MenuItem value="Todos">Todos</MenuItem>
            {ESTADOS_CASO.map((st) => (
              <MenuItem key={st} value={st}>
                {st}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {casosFiltrados.length === 0 ? (
        <Alert severity="info" sx={{ borderRadius: 2 }}>
          No se localizaron casos con los criterios seleccionados.
        </Alert>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, gap: 3 }}>
          {casosFiltrados.map((caso) => {
            const semaforo = calcularSemaforoDePlazos(caso.plazos);
            const derechos = Array.isArray(caso.derechos_invocados) ? caso.derechos_invocados : [];
            const perfilCaso = obtenerPerfilJurisdiccional(caso);
            const etapaMostrada = sincronizarEtapaConPerfil(caso.etapa_procesal, perfilCaso);

            return (
              <Card
                key={caso.id}
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  borderRadius: 3,
                  boxShadow: '0px 4px 12px rgba(0,0,0,0.03)',
                  border: '1px solid #e2e8f0',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    borderColor: '#93c5fd',
                    boxShadow: '0px 6px 16px rgba(30,64,175,0.08)'
                  }
                }}
              >
                <CardContent sx={{ flexGrow: 1 }}>
                  {/* Insignias superiores: Ámbito + País + Jurisdicción y Expediente Oficial */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 0.75, mb: 1.5, flexWrap: 'wrap' }}>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
                      <Chip
                        label={
                          perfilCaso.esInternacional
                            ? `🌐 Int. · ${perfilCaso.pais.bandera} ${perfilCaso.pais.codigo}`
                            : `${perfilCaso.pais.bandera} Nacional · ${perfilCaso.pais.nombre}`
                        }
                        size="small"
                        sx={{
                          fontWeight: 'bold',
                          fontSize: '0.68rem',
                          bgcolor: perfilCaso.esInternacional ? '#eff6ff' : '#ecfdf5',
                          color: perfilCaso.esInternacional ? '#1e40af' : '#065f46',
                          border: perfilCaso.esInternacional ? '1px solid #bfdbfe' : '1px solid #a7f3d0'
                        }}
                      />
                      <Chip
                        label={caso.jurisdiccion || 'CIDH (Comisión)'}
                        size="small"
                        variant="outlined"
                        sx={{
                          fontWeight: 'bold',
                          fontSize: '0.68rem'
                        }}
                      />
                    </Box>
                    {caso.expediente_oficial && (
                      <Chip
                        label={caso.expediente_oficial}
                        size="small"
                        sx={{
                          fontWeight: 'bold',
                          fontSize: '0.7rem',
                          fontFamily: 'monospace',
                          bgcolor: '#1e293b',
                          color: '#ffffff'
                        }}
                      />
                    )}
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1, color: 'primary.main' }}>
                    <Gavel size={22} />
                    <Typography variant="h6" fontWeight="bold" component="div" sx={{ lineHeight: 1.25 }}>
                      {caso.nombre}
                    </Typography>
                  </Box>

                  {caso.estado_demandado && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, fontWeight: 'bold' }}>
                      🏛️ Contra: <span style={{ color: '#334155' }}>{caso.estado_demandado}</span>
                    </Typography>
                  )}

                  <Typography variant="caption" sx={{ display: 'block', mb: 1, color: '#475569', fontSize: '0.72rem' }}>
                    📋 Estándar de Acreditación: <strong>{perfilCaso.normaCorto}</strong>
                  </Typography>

                  <Typography variant="body2" color="text.secondary" sx={{ minHeight: 40, mb: 1.5 }}>
                    {caso.descripcion || 'Sin descripción disponible.'}
                  </Typography>

                  {/* Etapa procesal */}
                  <Box
                    sx={{
                      p: 1,
                      mb: 1.5,
                      bgcolor: '#f8fafc',
                      borderRadius: 1.5,
                      border: '1px solid #e2e8f0',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 1
                    }}
                  >
                    <Typography variant="caption" color="text.secondary" fontWeight="bold">
                      Etapa:
                    </Typography>
                    <Typography variant="caption" fontWeight="bold" color="primary.main" sx={{ textAlign: 'right' }}>
                      {etapaMostrada}
                    </Typography>
                  </Box>

                  {/* Derechos invocados */}
                  {derechos.length > 0 && (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1.5 }}>
                      {derechos.slice(0, 3).map((d) => (
                        <Chip
                          key={d}
                          label={d}
                          size="small"
                          variant="outlined"
                          sx={{ height: 20, fontSize: '0.65rem', fontWeight: 'medium' }}
                        />
                      ))}
                      {derechos.length > 3 && (
                        <Chip
                          label={`+${derechos.length - 3}`}
                          size="small"
                          sx={{ height: 20, fontSize: '0.65rem', fontWeight: 'bold' }}
                        />
                      )}
                    </Box>
                  )}

                  <Divider sx={{ my: 1.5 }} />

                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'text.secondary', fontSize: '0.85rem', mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Users size={14} />
                      <Typography variant="caption" sx={{ fontSize: '0.82rem' }}>
                        Representados: <strong>{caso.totalClientes}</strong>
                      </Typography>
                    </Box>
                    {caso.abogado_responsable && (
                      <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 140 }}>
                        ⚖️ {caso.abogado_responsable}
                      </Typography>
                    )}
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: '0.85rem' }}>
                    <Calendar size={14} color="#94a3b8" />
                    <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
                      Estado del proceso:
                    </Typography>
                    <Chip
                      label={caso.estado}
                      size="small"
                      color={getStatusColor(caso.estado)}
                      sx={{ fontWeight: 'bold', height: 20, fontSize: '0.75rem' }}
                    />
                  </Box>

                  {semaforo && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.5, fontSize: '0.85rem' }}>
                      <AlertTriangle size={14} color={semaforo.textColor} />
                      <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
                        Vencimiento:
                      </Typography>
                      <Chip
                        label={semaforo.label}
                        size="small"
                        sx={{
                          fontWeight: 'bold',
                          height: 20,
                          fontSize: '0.75rem',
                          bgcolor: semaforo.bcolor,
                          color: semaforo.textColor
                        }}
                      />
                    </Box>
                  )}
                </CardContent>

                <CardActions sx={{ p: 2, pt: 0, gap: 1 }}>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={() => onSelectCaso(caso)}
                    sx={{ flexGrow: 1, textTransform: 'none', fontWeight: 'bold', borderRadius: 1.5 }}
                  >
                    Abrir Expediente
                  </Button>
                  <IconButton
                    size="small"
                    color="primary"
                    onClick={() => handleOpenEdit(caso)}
                    title="Configurar Ficha Técnica del Litigio"
                    sx={{ border: '1px solid #e2e8f0', borderRadius: 1.5, p: 0.75 }}
                  >
                    <Edit size={16} />
                  </IconButton>
                  {esAdmin && (
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleDeleteCaso(caso.id, caso.nombre)}
                      title="Eliminar Caso Completo"
                      sx={{ border: '1px solid #fee2e2', bgcolor: '#fef2f2', borderRadius: 1.5, p: 0.75 }}
                    >
                      <Trash2 size={16} />
                    </IconButton>
                  )}
                </CardActions>
              </Card>
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
