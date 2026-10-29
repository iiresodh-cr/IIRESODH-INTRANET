import React, { useState, useEffect } from 'react';
import { db, storage } from '../../config/firebase';
import { 
  collection, 
  addDoc, 
  setDoc,
  getDoc,
  getDocs, 
  serverTimestamp, 
  doc, 
  deleteDoc, 
  query, 
  orderBy,
  updateDoc,
  arrayUnion
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytesResumable, 
  getDownloadURL, 
  deleteObject 
} from 'firebase/storage';
import { 
  Box, 
  Button, 
  Typography, 
  Paper, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  TextField, 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  IconButton, 
  Chip, 
  CircularProgress, 
  Alert, 
  Divider, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  LinearProgress, 
  List, 
  TablePagination,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormLabel,
  Checkbox,
  Collapse,
  Tooltip,
  InputBase
} from '@mui/material';
import { 
  ArrowLeft, 
  Users, 
  FileText, 
  CreditCard, 
  Plus, 
  Upload, 
  File, 
  Trash2,
  Clock,
  Calendar,
  Search,
  Mail,
  Sparkles,
  Download,
  ShieldCheck,
  Globe,
  FolderOpen,
  ChevronDown,
  ChevronUp,
  ArrowUpRight,
  X
} from 'lucide-react';
import FichaCliente, {
  CALIDADES_PROCESALES,
  CONDICIONES_VULNERABILIDAD,
  ESTADOS_PAGO_CLIENTE
} from './FichaCliente';
import { ETAPAS_PROCESALES_LITIGIO } from './Casos';
import {
  obtenerPerfilJurisdiccional,
  sincronizarEtapaConPerfil,
  VIAS_INTERNACIONALES
} from '../../utils/perfilesJurisdiccionales';
import { registrarLogAuditoria } from '../../utils/auditLogger';
import {
  ejecutarConsultaJuridicaIA,
  analizarPiezaProcesalIA,
  extraerDatosIdentificacionIA,
  auditarPadronArt35IA,
  redactarComunicadoClaroIA,
  convertirMarkdownAHtmlJuridico,
  copiarDictamenConFormato,
  descargarDictamenWord,
  descargarDictamenPDF,
  guardarDictamenEnGoogleDrive
} from '../../utils/litigioAiService';

export const CATEGORIAS_DOCUMENTOS_PROCESALES = [
  'Escrito IIRESODH',
  'Resolución / Notificación Tribunal',
  'Contestación del Estado',
  'Peritaje / Amicus Curiae',
  'Anexo Probatorio'
];

const DOC_TYPES = [
  'Cédula de Identidad', 
  'DNI', 
  'Pasaporte', 
  'RUT', 
  'Cédula de Residencia', 
  'Otro'
];

const COUNTRIES = [
  { code: 'CR', name: 'Costa Rica', phone: '+506' },
  { code: 'US', name: 'Estados Unidos', phone: '+1' },
  { code: 'MX', name: 'México', phone: '+52' },
  { code: 'ES', name: 'España', phone: '+34' },
  { code: 'CO', name: 'Colombia', phone: '+57' },
  { code: 'AR', name: 'Argentina', phone: '+54' },
  { code: 'CL', name: 'Chile', phone: '+56' },
  { code: 'PE', name: 'Perú', phone: '+51' },
  { code: 'EC', name: 'Ecuador', phone: '+593' },
  { code: 'PA', name: 'Panamá', phone: '+507' },
  { code: 'SV', name: 'El Salvador', phone: '+503' },
  { code: 'GT', name: 'Guatemala', phone: '+502' },
  { code: 'HN', name: 'Honduras', phone: '+504' },
  { code: 'NI', name: 'Nicaragua', phone: '+505' },
  { code: 'VE', name: 'Venezuela', phone: '+58' },
  { code: 'UY', name: 'Uruguay', phone: '+598' },
  { code: 'PY', name: 'Paraguay', phone: '+595' },
  { code: 'BO', name: 'Bolivia', phone: '+591' },
  { code: 'CA', name: 'Canadá', phone: '+1' },
  { code: 'GB', name: 'Reino Unido', phone: '+44' },
  { code: 'FR', name: 'Francia', phone: '+33' },
  { code: 'DE', name: 'Alemania', phone: '+49' },
  { code: 'IT', name: 'Italia', phone: '+39' }
];

function TabPanel(props) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && (
        <Box sx={{ py: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

// =====================================================================================
// SUB-COMPONENTE ENCAPSULADO: Maneja la expansión individual en el Historial de Casos
// =====================================================================================
function ItemComunicadoMasivo({ c, casoId, clientes = [], onVerCliente }) {
  const [expanded, setExpanded] = useState(false);
  const [showTelemetry, setShowTelemetry] = useState(false);
  const [loadingTelemetry, setLoadingTelemetry] = useState(false);
  const [telemetryRows, setTelemetryRows] = useState([]);
  const deliveryState = c.delivery?.state || null;

  const cargarTelemetriaDestinatarios = async () => {
    if (!casoId) return;
    setLoadingTelemetry(true);
    try {
      const listaCorreosRaw = Array.isArray(c.to) ? c.to : c.to ? [c.to] : [];
      const setCorreos = new Set(listaCorreosRaw.map(em => String(em || '').trim().toLowerCase()).filter(Boolean));

      let destinatariosBase = [];
      if (Array.isArray(c.destinatarios_detalle) && c.destinatarios_detalle.length > 0) {
        destinatariosBase = c.destinatarios_detalle.map(d => {
          const found = clientes.find(cl => cl.id === d.clienteId);
          return {
            clienteId: d.clienteId,
            nombre: d.nombre || (found ? `${found.nombres || ''} ${found.apellidos || ''}`.trim() : 'Representado'),
            email: d.email || found?.correo_principal || ''
          };
        });
      } else {
        destinatariosBase = clientes
          .filter(cl => {
            const em = String(cl.correo_principal || '').trim().toLowerCase();
            return em && (setCorreos.size === 0 || setCorreos.has(em));
          })
          .map(cl => ({
            clienteId: cl.id,
            nombre: `${cl.nombres || ''} ${cl.apellidos || ''}`.trim(),
            email: cl.correo_principal || ''
          }));
      }

      const resultados = await Promise.all(
        destinatariosBase.map(async (dest) => {
          if (!dest.clienteId) {
            return { ...dest, estado: 'Enviado', entregado_at: null, abierto_at: null, rebotado_at: null };
          }
          try {
            const histRef = doc(db, 'casos', casoId, 'clientes', dest.clienteId, 'historial_comunicados', c.id);
            const snap = await getDoc(histRef);
            if (snap.exists()) {
              const data = snap.data() || {};
              return {
                ...dest,
                estado: data.estado || 'Enviado',
                entregado_at: data.entregado_at || null,
                abierto_at: data.abierto_at || null,
                rebotado_at: data.rebotado_at || null,
                causa_rebote: data.causa_rebote || null
              };
            }
          } catch (e) {
            console.warn('Error leyendo historial de destinatario:', e);
          }
          return { ...dest, estado: 'Enviado', entregado_at: null, abierto_at: null, rebotado_at: null };
        })
      );

      setTelemetryRows(resultados);
    } finally {
      setLoadingTelemetry(false);
    }
  };

  const handleToggleTelemetry = () => {
    const next = !showTelemetry;
    setShowTelemetry(next);
    if (next && telemetryRows.length === 0) {
      cargarTelemetriaDestinatarios();
    }
  };

  const conteoAbiertos = telemetryRows.filter(r => r.estado === 'Abierto' || r.abierto_at).length;
  const conteoEntregados = telemetryRows.filter(r => r.estado === 'Entregado' || r.estado === 'Abierto' || r.entregado_at).length;
  const conteoRebotados = telemetryRows.filter(r => r.estado === 'Rebotado' || r.rebotado_at).length;

  return (
    <Paper
      elevation={0}
      onClick={() => setExpanded((prev) => !prev)}
      sx={{
        mb: 1.25,
        borderRadius: 2,
        bgcolor: '#ffffff',
        border: expanded ? '1px solid #94a3b8' : '1px solid #e2e8f0',
        cursor: 'pointer',
        overflow: 'hidden',
        transition: 'all 0.16s ease',
        '&:hover': { borderColor: '#94a3b8', bgcolor: '#fcfdfe' }
      }}
    >
      {/* Fila mínima siempre visible */}
      <Box
        sx={{
          px: 2,
          py: 1.35,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1.5,
          flexWrap: 'wrap'
        }}
      >
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            variant="subtitle2"
            noWrap
            sx={{ fontWeight: 700, color: '#0f172a', fontSize: '0.88rem' }}
          >
            {c.asunto}
          </Typography>
          <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.72rem' }}>
            {c.fecha_envio ? new Date(c.fecha_envio).toLocaleString() : ''} ·{' '}
            {c.tipo_cobertura === 'todos' ? 'Todos los representados' : 'Segmentado'} (
            <strong style={{ color: '#334155' }}>{c.destinatarios_conteo || 0}</strong> correos) · Por{' '}
            {c.enviado_por || 'IIRESODH'}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
          {deliveryState && (
            <Box
              component="span"
              sx={{
                px: 0.85,
                py: 0.2,
                borderRadius: 1,
                fontSize: '0.67rem',
                fontWeight: 700,
                bgcolor:
                  deliveryState === 'SUCCESS'
                    ? '#f0fdf4'
                    : deliveryState === 'PROCESSING'
                    ? '#eff6ff'
                    : '#fffbeb',
                color:
                  deliveryState === 'SUCCESS'
                    ? '#15803d'
                    : deliveryState === 'PROCESSING'
                    ? '#1d4ed8'
                    : '#b45309'
              }}
            >
              {deliveryState === 'SUCCESS'
                ? 'Despachado'
                : deliveryState === 'PROCESSING'
                ? 'Procesando'
                : 'Revisión'}
            </Box>
          )}

          <IconButton size="small" sx={{ p: 0.35, color: '#64748b' }}>
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </IconButton>
        </Box>
      </Box>

      {/* Cajón desplegable en 1 clic */}
      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <Box
          onClick={(e) => e.stopPropagation()}
          sx={{
            px: 2,
            py: 1.75,
            bgcolor: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
            cursor: 'default'
          }}
        >
          <Typography
            variant="body2"
            sx={{
              whiteSpace: 'pre-wrap',
              color: '#334155',
              bgcolor: '#ffffff',
              p: 1.5,
              borderRadius: 1.5,
              border: '1px solid #e2e8f0',
              fontSize: '0.8rem',
              lineHeight: 1.55,
              mb: 1.25
            }}
          >
            {c.cuerpo}
          </Typography>

          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 1
            }}
          >
            <Button
              size="small"
              variant="outlined"
              onClick={handleToggleTelemetry}
              sx={{
                textTransform: 'none',
                fontSize: '0.73rem',
                fontWeight: 700,
                borderRadius: 1.5,
                bgcolor: '#ffffff',
                borderColor: '#cbd5e1',
                color: '#0f172a'
              }}
            >
              {showTelemetry
                ? 'Ocultar telemetría de entrega y lectura'
                : 'Ver telemetría por destinatario (Entregados / Abiertos)'}
            </Button>

            {c.pdf_url && (
              <Button
                component="a"
                href={c.pdf_url}
                target="_blank"
                rel="noopener"
                variant="outlined"
                size="small"
                startIcon={<File size={13} />}
                sx={{
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: '0.73rem',
                  borderRadius: 1.5,
                  bgcolor: '#ffffff',
                  borderColor: '#cbd5e1',
                  color: '#0f172a'
                }}
              >
                {c.pdf_nombre || 'Ver Anexo PDF'}
              </Button>
            )}
          </Box>

          <Collapse in={showTelemetry}>
            <Box sx={{ mt: 1.5, p: 1.5, bgcolor: '#ffffff', borderRadius: 2, border: '1px solid #e2e8f0' }}>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 1,
                  mb: 1.25
                }}
              >
                <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', alignItems: 'center' }}>
                  <Typography variant="caption" fontWeight={700} color="#0f172a">
                    Telemetría de Entrega:
                  </Typography>
                  <Chip
                    size="small"
                    label={`Recibidos: ${conteoEntregados}/${telemetryRows.length}`}
                    color="info"
                    variant="outlined"
                    sx={{ fontWeight: 700, fontSize: '0.68rem', height: 20 }}
                  />
                  <Chip
                    size="small"
                    label={`Abiertos: ${conteoAbiertos}/${telemetryRows.length}`}
                    color="success"
                    variant="outlined"
                    sx={{ fontWeight: 700, fontSize: '0.68rem', height: 20 }}
                  />
                  {conteoRebotados > 0 && (
                    <Chip
                      size="small"
                      label={`Rebotes: ${conteoRebotados}`}
                      color="error"
                      variant="outlined"
                      sx={{ fontWeight: 700, fontSize: '0.68rem', height: 20 }}
                    />
                  )}
                </Box>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={cargarTelemetriaDestinatarios}
                  disabled={loadingTelemetry}
                  sx={{ textTransform: 'none', fontSize: '0.68rem', py: 0.2, px: 1, borderRadius: 1.25 }}
                >
                  {loadingTelemetry ? 'Actualizando...' : 'Actualizar'}
                </Button>
              </Box>

              {loadingTelemetry ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                  <CircularProgress size={20} />
                </Box>
              ) : telemetryRows.length === 0 ? (
                <Typography variant="caption" color="text.secondary">
                  No se localizaron registros individuales para este comunicado.
                </Typography>
              ) : (
                <TableContainer sx={{ maxHeight: 260 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', bgcolor: '#f8fafc' }}>
                          Representado
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', bgcolor: '#f8fafc' }}>
                          Correo
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', bgcolor: '#f8fafc' }}>
                          Estado
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', bgcolor: '#f8fafc' }}>
                          Recibido
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', bgcolor: '#f8fafc' }}>
                          Abierto
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {telemetryRows.map((row, idx) => {
                        const chipColor =
                          row.estado === 'Abierto' || row.abierto_at
                            ? 'success'
                            : row.estado === 'Entregado' || row.entregado_at
                            ? 'info'
                            : row.estado === 'Rebotado' || row.rebotado_at
                            ? 'error'
                            : 'default';
                        const chipLabel =
                          row.estado === 'Abierto' || row.abierto_at
                            ? 'Abierto'
                            : row.estado === 'Entregado' || row.entregado_at
                            ? 'Entregado'
                            : row.estado === 'Rebotado' || row.rebotado_at
                            ? 'Rebotado'
                            : 'Enviado';
                        return (
                          <TableRow key={row.clienteId || idx} hover>
                            <TableCell sx={{ fontSize: '0.74rem', fontWeight: 600 }}>
                              {onVerCliente && row.clienteId ? (
                                <Button
                                  variant="text"
                                  size="small"
                                  onClick={() => onVerCliente(row.clienteId)}
                                  sx={{
                                    textTransform: 'none',
                                    p: 0,
                                    minWidth: 0,
                                    fontSize: '0.74rem',
                                    fontWeight: 700
                                  }}
                                >
                                  {row.nombre || 'Ver ficha'}
                                </Button>
                              ) : (
                                row.nombre
                              )}
                            </TableCell>
                            <TableCell sx={{ fontSize: '0.73rem', color: 'text.secondary' }}>
                              {row.email}
                            </TableCell>
                            <TableCell>
                              <Chip
                                size="small"
                                color={chipColor}
                                label={chipLabel}
                                sx={{ fontWeight: 700, fontSize: '0.66rem', height: 19 }}
                              />
                            </TableCell>
                            <TableCell sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
                              {row.entregado_at || '—'}
                            </TableCell>
                            <TableCell
                              sx={{
                                fontSize: '0.7rem',
                                color: row.abierto_at ? 'success.main' : 'text.secondary',
                                fontWeight: row.abierto_at ? 700 : 400
                              }}
                            >
                              {row.abierto_at || (row.rebotado_at ? `Rebote: ${row.rebotado_at}` : '—')}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>
          </Collapse>
        </Box>
      </Collapse>
    </Paper>
  );
}

export default function DetalleCaso({ caso, onVolver, currentUserEmail, userRole }) {
  const [casoLocal, setCasoLocal] = useState(caso);
  const perfilJurisdiccional = obtenerPerfilJurisdiccional(casoLocal);
  const etapasActivas = perfilJurisdiccional.etapas;
  const guiaEtapasActiva = perfilJurisdiccional.guiaEtapas;

  const [activeTab, setActiveTab] = useState(0);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [clienteSeleccionadoId, setClienteSeleccionadoId] = useState(null);
  
  // Estados para documentos comunes compartidos
  const [docsComunes, setDocsComunes] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [uploadProgressDoc, setUploadProgressDoc] = useState(0);
  const [expandedDocIds, setExpandedDocIds] = useState({});

  const toggleExpandDoc = (id, e) => {
    if (e) e.stopPropagation();
    setExpandedDocIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Estados del formulario del representado
  const [openModal, setOpenModal] = useState(false);
  const [nombres, setNombres] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [tipoIdentificacion, setTipoIdentificacion] = useState('Cédula de Identidad');
  const [identificacion, setIdentificacion] = useState('');
  const [correoPrincipal, setCorreoPrincipal] = useState('');
  const [codigoTelefonoPrincipal, setCodigoTelefonoPrincipal] = useState('+506');
  const [telefonoPrincipal, setTelefonoPrincipal] = useState('');
  const [pais, setPais] = useState(perfilJurisdiccional.pais.nombre || 'Costa Rica');
  const [direccion, setDireccion] = useState('');
  const [notas, setNotas] = useState('');
  const [calidadProcesalInput, setCalidadProcesalInput] = useState(CALIDADES_PROCESALES[0]);
  const [vulnerabilidadInput, setVulnerabilidadInput] = useState('Ninguna');
  const [tienePoderInput, setTienePoderInput] = useState(false);
  const [tieneIdInput, setTieneIdInput] = useState(false);
  const [autocompletandoOcrCliente, setAutocompletandoOcrCliente] = useState(false);

  // Etapa procesal interactiva + Historial de Hitos por Etapa (Pilar 1)
  const [etapaActualCaso, setEtapaActualCaso] = useState(
    sincronizarEtapaConPerfil(caso.etapa_procesal, perfilJurisdiccional)
  );
  const [historialEtapas, setHistorialEtapas] = useState(caso.historial_etapas || {});
  const [etapaInspeccionada, setEtapaInspeccionada] = useState(
    sincronizarEtapaConPerfil(caso.etapa_procesal, perfilJurisdiccional)
  );
  const [mostrarDetalleEtapa, setMostrarDetalleEtapa] = useState(false);
  const [mostrarFichaCaso, setMostrarFichaCaso] = useState(false);
  const [hitoFechaInput, setHitoFechaInput] = useState('');
  const [hitoResolucionInput, setHitoResolucionInput] = useState('');
  const [hitoResumenInput, setHitoResumenInput] = useState('');
  const [guardandoHitoEtapa, setGuardandoHitoEtapa] = useState(false);

  // Modal de Escalamiento / Transición de Vía Interna Nacional a Instancia Internacional (CIDH / ONU)
  const [openEscalarModal, setOpenEscalarModal] = useState(false);
  const [fechaNotificacionSentenciaInterna, setFechaNotificacionSentenciaInterna] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [organoInternacionalDestino, setOrganoInternacionalDestino] = useState('CIDH (Comisión)');
  const [resolucionAgotamientoRef, setResolucionAgotamientoRef] = useState('');
  const [cambiarAmbitoAInternacional, setCambiarAmbitoAInternacional] = useState(true);
  const [procesandoEscalamiento, setProcesandoEscalamiento] = useState(false);

  // Estados para padrón y Auditoría PIDA (Pilar 2 & 6)
  const [filtroAcreditacion, setFiltroAcreditacion] = useState('Todos');
  const [auditandoPadronIA, setAuditandoPadronIA] = useState(false);
  const [resultadoAuditoriaPadron, setResultadoAuditoriaPadron] = useState(null);
  const [importandoCSV, setImportandoCSV] = useState(false);

  // Estados para control de plazos procesales fatales
  const [localPlazos, setLocalPlazos] = useState(caso.plazos || []);
  const [openPlazoModal, setOpenPlazoModal] = useState(false);
  const [descripcionPlazo, setDescripcionPlazo] = useState('');
  const [fechaFatalInput, setFechaFatalInput] = useState('');
  const [responsablePlazoInput, setResponsablePlazoInput] = useState(currentUserEmail || '');
  const [prorrogaPlazoInput, setProrrogaPlazoInput] = useState('');
  const [sincronizarCalendarioInput, setSincronizarCalendarioInput] = useState(true);
  const [openCerrarModal, setOpenCerrarModal] = useState(false);
  const [plazoAActivar, setPlazoAActivar] = useState(null);
  
  // Estados de carga para el documento probatorio del plazo
  const [fileProbatorio, setFileProbatorio] = useState(null);
  const [uploadingPlazoDoc, setUploadingPlazoDoc] = useState(false);
  const [uploadProgressPlazoDoc, setUploadProgressPlazoDoc] = useState(0);

  // Nuevos estados para metadatos del documento de plazos
  const [descripcionProbatorio, setDescripcionProbatorio] = useState('');
  const [fechaDocumentoProbatorio, setFechaDocumentoProbatorio] = useState('');

  // Estado para el área de arrastre (Drag and Drop) e inputs de documentos comunes (Pilar 3)
  const [isDragging, setIsDragging] = useState(false);
  const [openUploadModal, setOpenUploadModal] = useState(false);
  const [fileComunSeleccionado, setFileComunSeleccionado] = useState(null);
  const [descripcionComun, setDescripcionComun] = useState('');
  const [fechaDocumentoComun, setFechaDocumentoComun] = useState('');
  const [categoriaComun, setCategoriaComun] = useState('Escrito IIRESODH');
  const [anexoNumeroComun, setAnexoNumeroComun] = useState('');
  const [filtroCategoriaDoc, setFiltroCategoriaDoc] = useState('Todas');

  // Vinculación de Google Drive y Analizador Multimodal IA de Piezas (Pilar 3 & 6)
  const [openDriveLinkModal, setOpenDriveLinkModal] = useState(false);
  const [driveDocNombre, setDriveDocNombre] = useState('');
  const [driveDocUrl, setDriveDocUrl] = useState('');
  const [driveDocCategoria, setDriveDocCategoria] = useState('Anexo Probatorio');
  const [driveDocAnexo, setDriveDocAnexo] = useState('');
  const [analizandoDocIAId, setAnalizandoDocIAId] = useState(null);
  const [resultadoAnalisisDocIA, setResultadoAnalisisDocIA] = useState(null);

  // Estados locales para la caja de búsqueda y la paginación masiva de representados
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Estados locales para la sección de comunicados masivos enviados + Redactor IA (Pilar 6)
  const [comunicados, setComunicados] = useState([]);
  const [loadingComunicados, setLoadingComunicados] = useState(false);
  const [openComunicadoModal, setOpenComunicadoModal] = useState(false);
  const [asuntoComunicado, setAsuntoComunicado] = useState('');
  const [cuerpoComunicado, setCuerpoComunicado] = useState('');
  const [fileComunicado, setFileComunicado] = useState(null);
  const [uploadingComunicado, setUploadingComunicado] = useState(false);
  const [uploadProgressComunicado, setUploadProgressComunicado] = useState(0);
  const [redactandoComunicadoIA, setRedactandoComunicadoIA] = useState(false);
  const [plantillaComunicadoIA, setPlantillaComunicadoIA] = useState('actualizacion_procesal');
  const [instruccionComunicadoIA, setInstruccionComunicadoIA] = useState('');

  // Segmentación selectiva de destinatarios
  const [tipoDestinatario, setTipoDestinatario] = useState('todos'); 
  const [clientesSeleccionadosIds, setClientesSeleccionadosIds] = useState([]);
  const [filtroDestinatarios, setFiltroDestinatarios] = useState('');

  // Estados para Pestaña 6: Copiloto Jurídico PIDA
  const [consultaCopilotoIA, setConsultaCopilotoIA] = useState('');
  const [ejecutandoCopilotoIA, setEjecutandoCopilotoIA] = useState(false);
  const [respuestaCopilotoIA, setRespuestaCopilotoIA] = useState(null);
  const [guardandoEnDrivePida, setGuardandoEnDrivePida] = useState(false);
  const [enlaceDriveGuardado, setEnlaceDriveGuardado] = useState(null);

  const fetchClientes = async () => {
    setLoading(true);
    setError('');
    try {
      const clientesRef = collection(db, 'casos', caso.id, 'clientes');
      const snapshot = await getDocs(clientesRef);
      const lista = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      lista.sort((a, b) => (a.apellidos || '').localeCompare(b.apellidos || ''));
      setClientes(lista);
    } catch (err) {
      console.error(err);
      setError('Error al cargar la lista de clientes.');
    } finally { 
      setLoading(false); 
    }
  };

  const fetchDocsComunes = async () => {
    setLoadingDocs(true);
    try {
      const docsRef = collection(db, 'casos', caso.id, 'documentos_comunes');
      const snapshot = await getDocs(query(docsRef, orderBy('fecha_subida', 'desc')));
      setDocsComunes(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error(err);
    } finally { 
      setLoadingDocs(false); 
    }
  };

  const fetchComunicados = async () => {
    setLoadingComunicados(true);
    try {
      const comRef = collection(db, 'casos', caso.id, 'comunicados');
      const snapshot = await getDocs(query(comRef, orderBy('fecha_envio', 'desc')));
      setComunicados(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingComunicados(false);
    }
  };

  useEffect(() => {
    setCasoLocal(caso);
    const perf = obtenerPerfilJurisdiccional(caso);
    setLocalPlazos(caso.plazos || []);
    const etapaInit = sincronizarEtapaConPerfil(caso.etapa_procesal, perf);
    const histInit = caso.historial_etapas || {};
    setEtapaActualCaso(etapaInit);
    setHistorialEtapas(histInit);
    setEtapaInspeccionada(etapaInit);
    const infoEtapa = histInit[etapaInit] || {};
    setHitoFechaInput(infoEtapa.fecha_hito || new Date().toISOString().split('T')[0]);
    setHitoResolucionInput(infoEtapa.resolucion_referencia || '');
    setHitoResumenInput(infoEtapa.observaciones || '');
    fetchClientes();
    fetchDocsComunes();
    fetchComunicados();
  }, [caso]);

  const handleSeleccionarEtapaInspeccion = (etapa) => {
    if (etapaInspeccionada === etapa && mostrarDetalleEtapa) {
      setMostrarDetalleEtapa(false);
      return;
    }
    setEtapaInspeccionada(etapa);
    setMostrarDetalleEtapa(true);
    const info = historialEtapas[etapa] || {};
    setHitoFechaInput(info.fecha_hito || new Date().toISOString().split('T')[0]);
    setHitoResolucionInput(info.resolucion_referencia || '');
    setHitoResumenInput(info.observaciones || '');
  };

  const handleCambiarEtapaProcesal = async (nuevaEtapa, guardarHitoTambien = false) => {
    setGuardandoHitoEtapa(true);
    try {
      const nuevoHistorial = {
        ...historialEtapas,
        [nuevaEtapa]: {
          fecha_hito: hitoFechaInput || historialEtapas[nuevaEtapa]?.fecha_hito || new Date().toISOString().split('T')[0],
          resolucion_referencia: guardarHitoTambien
            ? hitoResolucionInput.trim()
            : (historialEtapas[nuevaEtapa]?.resolucion_referencia || ''),
          observaciones: guardarHitoTambien
            ? hitoResumenInput.trim()
            : (historialEtapas[nuevaEtapa]?.observaciones || `Etapa activada por ${currentUserEmail}`),
          actualizado_por: currentUserEmail,
          actualizado_at: new Date().toISOString()
        }
      };
      setEtapaActualCaso(nuevaEtapa);
      setEtapaInspeccionada(nuevaEtapa);
      setHistorialEtapas(nuevoHistorial);
      setCasoLocal((prev) => ({ ...prev, etapa_procesal: nuevaEtapa, historial_etapas: nuevoHistorial }));
      await updateDoc(doc(db, 'casos', caso.id), {
        etapa_procesal: nuevaEtapa,
        historial_etapas: nuevoHistorial
      });
      await registrarLogAuditoria(
        currentUserEmail,
        'Cambio de Etapa Procesal',
        `Se actualizó la etapa procesal del caso "${casoLocal.nombre}" a [${nuevaEtapa}]`
      );
    } catch (err) {
      setError('No se pudo actualizar la etapa procesal.');
    } finally {
      setGuardandoHitoEtapa(false);
    }
  };

  const handleGuardarHitoEtapa = async (etapaObjetivo) => {
    setGuardandoHitoEtapa(true);
    try {
      const nuevoHistorial = {
        ...historialEtapas,
        [etapaObjetivo]: {
          fecha_hito: hitoFechaInput || new Date().toISOString().split('T')[0],
          resolucion_referencia: hitoResolucionInput.trim(),
          observaciones: hitoResumenInput.trim(),
          actualizado_por: currentUserEmail,
          actualizado_at: new Date().toISOString()
        }
      };
      setHistorialEtapas(nuevoHistorial);
      setCasoLocal((prev) => ({ ...prev, historial_etapas: nuevoHistorial }));
      await updateDoc(doc(db, 'casos', caso.id), {
        historial_etapas: nuevoHistorial
      });
    } catch (err) {
      setError('No se pudo guardar el hito de la etapa procesal.');
    } finally {
      setGuardandoHitoEtapa(false);
    }
  };

  const handleEscalarACIDH = async (e) => {
    e.preventDefault();
    if (!fechaNotificacionSentenciaInterna) return;
    setProcesandoEscalamiento(true);
    setError('');
    try {
      // Calcular fecha límite convencional de 6 meses (Art. 46.1.b CADH)
      const fechaBase = new Date(fechaNotificacionSentenciaInterna + 'T00:00:00');
      const fechaSeisMeses = new Date(fechaBase);
      fechaSeisMeses.setMonth(fechaSeisMeses.getMonth() + 6);
      const fechaFatal6M = fechaSeisMeses.toISOString().split('T')[0];

      const plazoAgotamiento = {
        id: 'plazo_sidh_6m_' + Date.now(),
        descripcion: `🌐 Plazo Convencional de 6 Meses (${organoInternacionalDestino} - Art. 46.1.b CADH) desde notificación de sentencia definitiva interna (${fechaNotificacionSentenciaInterna})`,
        fechaFatal: fechaFatal6M,
        responsable: currentUserEmail || casoLocal.abogado_responsable || '',
        prorroga: resolucionAgotamientoRef.trim()
          ? `Sentencia que agotó vía interna: ${resolucionAgotamientoRef.trim()}`
          : 'Término convencional improrrogable de 6 meses',
        completado: false,
        fechaPresentacion: '',
        documentoProbatorioNombre: '',
        documentoProbatorioUrl: '',
        documentoProbatorioDescripcion: '',
        documentoProbatorioFechaDocumento: '',
        storage_path: ''
      };

      const nuevosPlazos = [...localPlazos, plazoAgotamiento];
      const etapaDestino = cambiarAmbitoAInternacional
        ? '1. Preparación y Recolección'
        : etapasActivas[5];

      const nuevoHistorial = {
        ...historialEtapas,
        [etapaDestino]: {
          fecha_hito: fechaNotificacionSentenciaInterna,
          resolucion_referencia: resolucionAgotamientoRef.trim() || 'Sentencia definitiva de última instancia interna',
          observaciones: `Agotamiento de recursos internos en ${perfilJurisdiccional.pais.nombre}. Vencimiento de 6 meses para ${organoInternacionalDestino}: ${fechaFatal6M}.`,
          actualizado_por: currentUserEmail,
          actualizado_at: new Date().toISOString()
        }
      };

      const camposUpdate = {
        plazos: nuevosPlazos,
        etapa_procesal: etapaDestino,
        historial_etapas: nuevoHistorial,
        fecha_agotamiento_interno: fechaNotificacionSentenciaInterna,
        resolucion_agotamiento_interno: resolucionAgotamientoRef.trim()
      };

      if (cambiarAmbitoAInternacional) {
        camposUpdate.ambito = 'Internacional';
        camposUpdate.jurisdiccion_nacional_origen = casoLocal.jurisdiccion || '';
        camposUpdate.jurisdiccion = organoInternacionalDestino;
      }

      await updateDoc(doc(db, 'casos', caso.id), camposUpdate);

      await addDoc(collection(db, 'workspace_eventos'), {
        titulo: `🚨 [6 MESES SIDH] ${casoLocal.nombre}: Presentación ante ${organoInternacionalDestino}`,
        fecha: fechaFatal6M,
        hora: '09:00',
        tipo: 'audiencia',
        descripcion: `Vencimiento del plazo convencional de 6 meses (Art. 46.1.b CADH) tras agotamiento de la vía interna en ${perfilJurisdiccional.pais.nombre} (notificado el ${fechaNotificacionSentenciaInterna}).`,
        creadoPor: currentUserEmail || '',
        casoId: caso.id,
        createdAt: serverTimestamp()
      });

      await registrarLogAuditoria(
        currentUserEmail,
        'Transición a Instancia Internacional',
        `Se registró agotamiento de vía interna en ${perfilJurisdiccional.pais.nombre} (${fechaNotificacionSentenciaInterna}) y se calculó el plazo fatal de 6 meses (${fechaFatal6M}) hacia [${organoInternacionalDestino}].`
      );

      setLocalPlazos(nuevosPlazos);
      setHistorialEtapas(nuevoHistorial);
      setEtapaActualCaso(etapaDestino);
      setEtapaInspeccionada(etapaDestino);
      setCasoLocal((prev) => ({
        ...prev,
        ...camposUpdate
      }));
      setOpenEscalarModal(false);
    } catch (err) {
      setError(`No se pudo completar la transición a instancia internacional: ${err.message}`);
    } finally {
      setProcesandoEscalamiento(false);
    }
  };

  const handleAutocompletarClienteConOcrIA = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAutocompletandoOcrCliente(true);
    setError('');
    try {
      const datos = await extraerDatosIdentificacionIA({
        file,
        nombreArchivo: file.name,
        caso: casoLocal
      });
      if (datos.nombres) setNombres(datos.nombres);
      if (datos.apellidos) setApellidos(datos.apellidos);
      if (datos.identificacion) setIdentificacion(datos.identificacion);
      if (datos.tipo_identificacion && DOC_TYPES.includes(datos.tipo_identificacion)) {
        setTipoIdentificacion(datos.tipo_identificacion);
      }
      if (datos.pais && COUNTRIES.some((c) => c.name === datos.pais)) {
        setPais(datos.pais);
      }
      if (datos.condicion_vulnerabilidad_sugerida) {
        setVulnerabilidadInput(datos.condicion_vulnerabilidad_sugerida);
      }
      if (datos.es_identificacion_legible) setTieneIdInput(true);
      if (datos.es_poder_firmado) setTienePoderInput(true);
    } catch (err) {
      setError(`Error en autocompletado OCR PIDA: ${err.message}`);
    } finally {
      setAutocompletandoOcrCliente(false);
      e.target.value = null;
    }
  };

  const handleCreateCliente = async (e) => {
    e.preventDefault();
    if (!nombres.trim() || !apellidos.trim() || !identificacion.trim()) return;

    try {
      const clientesRef = collection(db, 'casos', caso.id, 'clientes');
      await addDoc(clientesRef, {
        nombres: nombres.trim(),
        apellidos: apellidos.trim(),
        tipo_identificacion: tipoIdentificacion,
        identificacion: identificacion.trim(),
        correo_principal: correoPrincipal.trim(),
        correo_secundario: '',
        codigo_telefono_principal: codigoTelefonoPrincipal,
        telefono_principal: telefonoPrincipal.trim(),
        codigo_telefono_secundario: '+506',
        telefono_secundario: '',
        pais: pais,
        direccion: direccion.trim(),
        notas: notas.trim(),
        calidad_procesal: calidadProcesalInput,
        condicion_vulnerabilidad: vulnerabilidadInput,
        tiene_poder: tienePoderInput,
        tiene_documento_id: tieneIdInput,
        tiene_prueba_dano: false,
        estado_pago: 'Pendiente',
        monto_pagado: 0,
        moneda_pago: 'USD',
        metodo_pago: 'Transferencia / SINPE',
        referencia_pago: '',
        stripe_customer_id: '',
        fecha_registro: serverTimestamp()
      });

      await registrarLogAuditoria(
        currentUserEmail, 
        'Registro de Cliente', 
        `Se inscribió al representado "${apellidos.trim()}, ${nombres.trim()}" en el litigio [${caso.nombre}]`
      );

      setNombres('');
      setApellidos('');
      setIdentificacion('');
      setCorreoPrincipal('');
      setCodigoTelefonoPrincipal('+506');
      setTelefonoPrincipal('');
      setPais('Costa Rica');
      setDireccion('');
      setNotas('');
      setCalidadProcesalInput(CALIDADES_PROCESALES[0]);
      setVulnerabilidadInput('Ninguna');
      setTienePoderInput(false);
      setTieneIdInput(false);
      setOpenModal(false);
      
      fetchClientes();
    } catch (err) {
      setError('No se pudo registrar al cliente.');
    }
  };

  const handleToggleAcreditacionRapida = async (clienteItem, campo) => {
    try {
      const nuevoValor = !clienteItem[campo];
      await updateDoc(doc(db, 'casos', caso.id, 'clientes', clienteItem.id), {
        [campo]: nuevoValor
      });
      setClientes((prev) =>
        prev.map((c) => (c.id === clienteItem.id ? { ...c, [campo]: nuevoValor } : c))
      );
    } catch (err) {
      setError('No se pudo actualizar el estado de acreditación.');
    }
  };

  const handleExportarPadronCSV = () => {
    if (clientes.length === 0) return;
    const encabezados = [
      'N°',
      'Apellidos',
      'Nombres',
      'Tipo ID',
      'Número Identificación',
      'País Residencia',
      perfilJurisdiccional.esInternacional ? 'Calidad Procesal (SIDH)' : 'Calidad Procesal (Vía Interna)',
      perfilJurisdiccional.esInternacional ? 'Vulnerabilidad (Art. 29.2 CIDH)' : 'Vulnerabilidad / Trámite Preferente',
      `Poder Verificado (${perfilJurisdiccional.normaCorto})`,
      'ID Legible',
      'Prueba / Sustento',
      'Correo Principal',
      'Teléfono',
      'Estado Pago',
      'Monto Aportado',
      'Moneda'
    ];
    const escapar = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const filas = clientes.map((c, idx) =>
      [
        idx + 1,
        c.apellidos || '',
        c.nombres || '',
        c.tipo_identificacion || 'Cédula',
        c.identificacion || '',
        c.pais || '',
        c.calidad_procesal || 'Víctima Directa / Representado Principal',
        c.condicion_vulnerabilidad || 'Ninguna',
        c.tiene_poder ? 'SÍ' : 'PENDIENTE',
        c.tiene_documento_id ? 'SÍ' : 'PENDIENTE',
        c.tiene_prueba_dano ? 'SÍ' : 'PENDIENTE',
        c.correo_principal || '',
        `${c.codigo_telefono_principal || ''} ${c.telefono_principal || ''}`.trim(),
        c.estado_pago || 'Pendiente',
        c.monto_pagado || 0,
        c.moneda_pago || 'USD'
      ]
        .map(escapar)
        .join(',')
    );

    const contenido = '\uFEFF' + [encabezados.map(escapar).join(','), ...filas].join('\r\n');
    const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const prefijoArchivo = perfilJurisdiccional.esInternacional
      ? 'Padron_SIDH_'
      : `Padron_Nacional_${perfilJurisdiccional.pais.codigo}_`;
    link.download = `${prefijoArchivo}${(casoLocal.nombre || 'Caso').replace(/\s+/g, '_')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportarPadronCSV = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportandoCSV(true);
    setError('');
    try {
      const texto = await file.text();
      const lineas = texto
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      if (lineas.length < 2) {
        throw new Error('El archivo CSV debe incluir una fila de encabezados y al menos un representado.');
      }

      const clientesRef = collection(db, 'casos', caso.id, 'clientes');
      let importados = 0;
      for (let i = 1; i < lineas.length; i++) {
        const cols = lineas[i].split(',').map((col) => col.replace(/^"|"$/g, '').trim());
        const apellidosRow = cols[0] || '';
        const nombresRow = cols[1] || '';
        const idRow = cols[2] || '';
        const correoRow = cols[3] || '';
        const telRow = cols[4] || '';
        const vulnRow = cols[5] || 'Ninguna';

        if (!nombresRow && !apellidosRow) continue;
        await addDoc(clientesRef, {
          apellidos: apellidosRow,
          nombres: nombresRow,
          tipo_identificacion: 'Cédula de Identidad',
          identificacion: idRow || 'S/N',
          correo_principal: correoRow,
          correo_secundario: '',
          codigo_telefono_principal: '+506',
          telefono_principal: telRow,
          codigo_telefono_secundario: '+506',
          telefono_secundario: '',
          pais: 'Costa Rica',
          direccion: '',
          notas: 'Importado mediante carga masiva CSV',
          calidad_procesal: CALIDADES_PROCESALES[0],
          condicion_vulnerabilidad: vulnRow,
          tiene_poder: false,
          tiene_documento_id: false,
          tiene_prueba_dano: false,
          estado_pago: 'Pendiente',
          monto_pagado: 0,
          moneda_pago: 'USD',
          fecha_registro: serverTimestamp()
        });
        importados++;
      }

      alert(`✅ Importación masiva completada: ${importados} representados agregados al padrón.`);
      fetchClientes();
    } catch (err) {
      setError(`Error al importar CSV: ${err.message}`);
    } finally {
      setImportandoCSV(false);
      e.target.value = null;
    }
  };

  const handleAuditarPadronIA = async () => {
    setAuditandoPadronIA(true);
    setError('');
    try {
      const res = await auditarPadronArt35IA({ clientes, caso: casoLocal });
      setResultadoAuditoriaPadron(res);
    } catch (err) {
      setError(`Error en Auditoría PIDA del Padrón: ${err.message}`);
    } finally {
      setAuditandoPadronIA(false);
    }
  };

  const ejecutarCargaArchivoComun = async (file, desc, fechaDoc, cat = 'Escrito IIRESODH', numAnexo = '') => {
    if (!file) return;

    setUploadingDoc(true);
    setUploadProgressDoc(0);
    setError('');

    const storagePath = `casos/${caso.id}/documentos/${Date.now()}_${file.name}`;
    const storagePathRef = ref(storage, storagePath);
    const uploadTask = uploadBytesResumable(storagePathRef, file);

    uploadTask.on('state_changed', 
      (snap) => {
        const progress = (snap.bytesTransferred / snap.totalBytes) * 100;
        setUploadProgressDoc(Math.round(progress));
      },
      (err) => { 
        setError('Error al subir documento común.'); 
        setUploadingDoc(false); 
      },
      async () => {
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          await addDoc(collection(db, 'casos', caso.id, 'documentos_comunes'), {
            nombre: file.name,
            url: downloadURL,
            storage_path: storagePath,
            descripcion: desc.trim(),
            categoria_procesal: cat,
            numero_anexo: numAnexo.trim(),
            fecha_documento: fechaDoc,
            fecha_subida: new Date().toISOString()
          });

          await registrarLogAuditoria(
            currentUserEmail, 
            'Carga de Doc Común', 
            `Se subió el documento global "${file.name}" (${cat}) con descripción: "${desc.trim()}" para el caso "${caso.nombre}"`
          );
          
          fetchDocsComunes();
        } catch (ex) {
          setError(`Error en Firestore al guardar metadatos del documento: ${ex.message}`);
        } finally {
          setUploadingDoc(false);
        }
      }
    );
  };

  const handleUploadDocComun = async (e) => {
    const file = e.target.files[0];
    if (file) {
      setFileComunSeleccionado(file);
      setOpenUploadModal(true);
    }
  };

  const handleDropDocComun = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      setFileComunSeleccionado(file);
      setOpenUploadModal(true);
    }
  };

  const handleConfirmarSubidaComun = async (e) => {
    e.preventDefault();
    if (!fileComunSeleccionado || !descripcionComun.trim() || !fechaDocumentoComun) return;

    const file = fileComunSeleccionado;
    const desc = descripcionComun;
    const fecha = fechaDocumentoComun;
    const cat = categoriaComun;
    const numAnexo = anexoNumeroComun;

    setOpenUploadModal(false);
    setFileComunSeleccionado(null);
    setDescripcionComun('');
    setFechaDocumentoComun('');
    setCategoriaComun('Escrito IIRESODH');
    setAnexoNumeroComun('');

    await ejecutarCargaArchivoComun(file, desc, fecha, cat, numAnexo);
  };

  const handleVincularDriveDoc = async (e) => {
    e.preventDefault();
    if (!driveDocNombre.trim() || !driveDocUrl.trim()) return;
    try {
      await addDoc(collection(db, 'casos', caso.id, 'documentos_comunes'), {
        nombre: driveDocNombre.trim(),
        url: driveDocUrl.trim(),
        storage_path: '',
        origen: 'Google Drive',
        descripcion: `Documento vinculado desde Google Drive (${driveDocCategoria})`,
        categoria_procesal: driveDocCategoria,
        numero_anexo: driveDocAnexo.trim(),
        fecha_documento: new Date().toISOString().slice(0, 10),
        fecha_subida: new Date().toISOString()
      });
      setDriveDocNombre('');
      setDriveDocUrl('');
      setDriveDocAnexo('');
      setOpenDriveLinkModal(false);
      fetchDocsComunes();
    } catch (err) {
      setError('No se pudo vincular el documento de Google Drive.');
    }
  };

  const handleAnalizarPiezaIA = async (docItem) => {
    setAnalizandoDocIAId(docItem.id);
    setResultadoAnalisisDocIA(null);
    setError('');
    try {
      const requiereArgon =
        docItem.categoria_procesal === 'Resolución / Notificación Tribunal' ||
        docItem.categoria_procesal === 'Contestación del Estado';
      const res = await analizarPiezaProcesalIA({
        fileUrl: docItem.storage_path ? docItem.url : null,
        nombreArchivo: docItem.nombre,
        contextoCaso: casoLocal,
        usarPensamientoAvanzado: requiereArgon
      });
      setResultadoAnalisisDocIA({ ...res, docNombre: docItem.nombre });
    } catch (err) {
      setError(`No se pudo analizar la pieza procesal con PIDA: ${err.message}`);
    } finally {
      setAnalizandoDocIAId(null);
    }
  };

  const handleAgendarPlazoDesdeIA = async () => {
    if (!resultadoAnalisisDocIA?.fecha_vencimiento_sugerida) return;
    const desc =
      resultadoAnalisisDocIA.titulo_plazo_sugerido ||
      `Plazo extraído por IA: ${resultadoAnalisisDocIA.docNombre}`;
    const fecha = resultadoAnalisisDocIA.fecha_vencimiento_sugerida;
    const nuevoPlazoObj = {
      id: 'plazo_' + Date.now(),
      descripcion: desc,
      fechaFatal: fecha,
      responsable: currentUserEmail || '',
      prorroga: 'Detectado automáticamente por IA',
      completado: false,
      fechaPresentacion: '',
      documentoProbatorioNombre: '',
      documentoProbatorioUrl: '',
      documentoProbatorioDescripcion: '',
      documentoProbatorioFechaDocumento: '',
      storage_path: ''
    };
    try {
      await updateDoc(doc(db, 'casos', caso.id), {
        plazos: arrayUnion(nuevoPlazoObj)
      });
      await addDoc(collection(db, 'workspace_eventos'), {
        titulo: `🚨 [PLAZO FATAL] ${caso.nombre}: ${desc}`,
        fecha: fecha,
        hora: '09:00',
        tipo: 'audiencia',
        descripcion: `Vencimiento fatal del caso ${caso.nombre} (${caso.expediente_oficial || 'SIDH'}). Detectado por Copiloto IA.`,
        creadoPor: currentUserEmail || 'ia@iiresodh.org',
        casoId: caso.id,
        createdAt: serverTimestamp()
      });
      setLocalPlazos((prev) => [...prev, nuevoPlazoObj]);
      alert(`✅ Plazo fatal (${fecha}) registrado en el expediente y sincronizado con el Calendario Institucional.`);
    } catch (err) {
      setError('No se pudo agendar el plazo detectado.');
    }
  };

  const handleDeleteDocComun = async (docId, storagePath) => {
    if (!window.confirm('¿Desea eliminar este documento global del caso?')) return;
    try {
      if (storagePath) {
        await deleteObject(ref(storage, storagePath));
      }
      await deleteDoc(doc(db, 'casos', caso.id, 'documentos_comunes', docId));

      await registrarLogAuditoria(
        currentUserEmail, 
        'Eliminación de Doc Común', 
        `Se borró el documento global ID: ${docId} del litigio [${caso.nombre}]`
      );

      fetchDocsComunes();
    } catch (err) { 
      setError('Error al suprimir el documento común.'); 
    }
  };

  const handleBoxAgregarPlazo = async (e) => {
    e.preventDefault();
    if (!descripcionPlazo.trim() || !fechaFatalInput) return;

    setError('');
    const nuevoPlazoObj = {
      id: 'plazo_' + Date.now(),
      descripcion: descripcionPlazo.trim(),
      fechaFatal: fechaFatalInput,
      responsable: responsablePlazoInput.trim() || currentUserEmail || '',
      prorroga: prorrogaPlazoInput.trim(),
      completado: false,
      fechaPresentacion: '',
      documentoProbatorioNombre: '',
      documentoProbatorioUrl: '',
      documentoProbatorioDescripcion: '',
      documentoProbatorioFechaDocumento: '',
      storage_path: ''
    };

    try {
      const casoDocRef = doc(db, 'casos', caso.id);
      await updateDoc(casoDocRef, {
        plazos: arrayUnion(nuevoPlazoObj)
      });

      if (sincronizarCalendarioInput) {
        await addDoc(collection(db, 'workspace_eventos'), {
          titulo: `🚨 [PLAZO FATAL] ${caso.nombre}: ${descripcionPlazo.trim()}`,
          fecha: fechaFatalInput,
          hora: '09:00',
          tipo: 'audiencia',
          descripcion: `Término perentorio del litigio "${caso.nombre}" (${caso.jurisdiccion || 'SIDH'}). Responsable: ${nuevoPlazoObj.responsable}`,
          creadoPor: currentUserEmail || '',
          casoId: caso.id,
          createdAt: serverTimestamp()
        });
      }

      await registrarLogAuditoria(
        currentUserEmail,
        'Registro de Plazo',
        `Se asignó fecha fatal ${fechaFatalInput} para "${descripcionPlazo.trim()}" en el caso "${caso.nombre}"`
      );

      setLocalPlazos(prev => [...prev, nuevoPlazoObj]);
      setDescripcionPlazo('');
      setFechaFatalInput('');
      setProrrogaPlazoInput('');
      setOpenPlazoModal(false);
    } catch (err) {
      setError('No se pudo guardar el plazo procesal.');
    }
  };

  const handleEliminarPlazo = async (plazoId) => {
    if (!window.confirm('¿Desea eliminar este término procesal de la lista?')) return;
    try {
      const filtrados = localPlazos.filter((p) => p.id !== plazoId);
      await updateDoc(doc(db, 'casos', caso.id), { plazos: filtrados });
      setLocalPlazos(filtrados);
    } catch (err) {
      setError('No se pudo eliminar el plazo.');
    }
  };

  const handleActualizarPagoRapido = async (clienteItem, cambios) => {
    try {
      await updateDoc(doc(db, 'casos', caso.id, 'clientes', clienteItem.id), cambios);
      setClientes((prev) =>
        prev.map((c) => (c.id === clienteItem.id ? { ...c, ...cambios } : c))
      );
    } catch (err) {
      setError('No se pudo actualizar el registro de pago.');
    }
  };

  const handleRedactarComunicadoIA = async () => {
    setRedactandoComunicadoIA(true);
    setError('');
    try {
      const res = await redactarComunicadoClaroIA({
        caso: casoLocal,
        instruccion: instruccionComunicadoIA,
        tipoPlantilla: plantillaComunicadoIA
      });
      if (res.asunto) setAsuntoComunicado(res.asunto);
      if (res.cuerpo) setCuerpoComunicado(res.cuerpo);
    } catch (err) {
      setError(`No se pudo generar el borrador con PIDA: ${err.message}`);
    } finally {
      setRedactandoComunicadoIA(false);
    }
  };

  const handleEjecutarCopilotoIA = async (promptPredefinido = null) => {
    const promptBase = promptPredefinido || consultaCopilotoIA;
    if (!promptBase || !promptBase.trim()) return;

    setEjecutandoCopilotoIA(true);
    setError('');
    try {
      const listosArt35 = clientes.filter((c) => c.tiene_poder && c.tiene_documento_id).length;
      const vulnerables = clientes.filter(
        (c) => c.condicion_vulnerabilidad && c.condicion_vulnerabilidad !== 'Ninguna'
      ).length;
      const plazosPend = localPlazos
        .filter((p) => !p.completado)
        .map((p) => `${p.descripcion} (Vence: ${p.fechaFatal})`)
        .join('; ');
      const listaDocs = docsComunes
        .slice(0, 10)
        .map((d) => `[${d.categoria_procesal || 'Doc'}] ${d.nombre}: ${d.descripcion || ''}`)
        .join('\n');

      const promptContextualizado = `EXPEDIENTE BAJO ANÁLISIS EN EL IIRESODH:
- Nombre del Caso: ${casoLocal.nombre}
- Expediente Oficial: ${casoLocal.expediente_oficial || 'En trámite'}
- Ámbito Jurisdiccional: ${perfilJurisdiccional.esInternacional ? 'INTERNACIONAL (SIDH / ONU)' : `NACIONAL / JURISDICCIÓN INTERNA DE ${perfilJurisdiccional.pais.nombre.toUpperCase()}`}
- País de Referencia: ${perfilJurisdiccional.pais.nombre}
- Vía / Órgano Judicial: ${casoLocal.jurisdiccion || 'Por definir'}
- Tribunales Competentes en ${perfilJurisdiccional.pais.nombre}: ${perfilJurisdiccional.pais.organoConstitucional} | ${perfilJurisdiccional.pais.organoContencioso} | ${perfilJurisdiccional.pais.organoLaboral}
- Parte Demandada / Recurrida: ${casoLocal.estado_demandado || `Estado de ${perfilJurisdiccional.pais.nombre}`}
- Etapa Procesal Actual: ${etapaActualCaso}
- Normativa y Derechos Invocados: ${Array.isArray(casoLocal.derechos_invocados) ? casoLocal.derechos_invocados.join(', ') : 'Derechos fundamentales y bloque de constitucionalidad'}
- Descripción Fáctica: ${casoLocal.descripcion || 'Sin descripción adicional'}
- Padrón de Representados (${perfilJurisdiccional.normaTitulo}): ${clientes.length} representados totales (${listosArt35} con Poder + ID completos; ${vulnerables} con condición de vulnerabilidad registrada).
- Requisito de Personería Aplicable: ${perfilJurisdiccional.esInternacional ? 'Art. 35 Reglamento Corte IDH / Art. 28 Reglamento CIDH' : perfilJurisdiccional.pais.requisitoPoderNacional}
- Plazos Fatales Pendientes: ${plazosPend || 'Ninguno activo'}
- Piezas Procesales en el Expediente:
${listaDocs || 'Sin documentos comunes aún.'}

REGLA DE RIGOR JURISDICCIONAL PARA PIDA:
${
  perfilJurisdiccional.esInternacional
    ? 'Este caso se encuentra en instancia INTERNACIONAL. Aplica directamente los estándares de la CADH, Reglamentos de la CIDH y Corte IDH (incluyendo el Art. 35) o Tratados ONU.'
    : `Este caso se encuentra en sede NACIONAL (${perfilJurisdiccional.pais.nombre} — ${casoLocal.jurisdiccion}). NO evalúes la admisibilidad ni la personería como si ya estuviera en el Art. 35 de la Corte IDH; analiza la legitimación activa, personería judicial, agotamiento de vía administrativa y requisitos procesales conforme al derecho interno de ${perfilJurisdiccional.pais.nombre}, integrando la CADH y la jurisprudencia de la Corte IDH por vía de Control de Convencionalidad interno.`
}

SOLICITUD JURÍDICA AL COPILOTO PIDA:
${promptBase.trim()}`;

      const res = await ejecutarConsultaJuridicaIA({
        prompt: promptContextualizado,
        tier: 'deep',
        modelOverride: 'gemini-4-argon'
      });

      setRespuestaCopilotoIA({
        consulta: promptBase.trim(),
        ...res,
        fecha: new Date().toLocaleString('es-CR')
      });
    } catch (err) {
      setError(`Error en Copiloto Jurídico PIDA: ${err.message}`);
    } finally {
      setEjecutandoCopilotoIA(false);
    }
  };

  const handleConfirmarCierrePlazo = async (e) => {
    e.preventDefault();
    if (!plazoAActivar || !fileProbatorio || !descripcionProbatorio.trim() || !fechaDocumentoProbatorio) return;

    setUploadingPlazoDoc(true);
    setUploadProgressPlazoDoc(0);
    setError('');

    const storagePath = `casos/${caso.id}/documentos/${Date.now()}_${fileProbatorio.name}`;
    const storagePathRef = ref(storage, storagePath);
    const uploadTask = uploadBytesResumable(storagePathRef, fileProbatorio);

    uploadTask.on('state_changed', 
      (snap) => {
        const progress = (snap.bytesTransferred / snap.totalBytes) * 100;
        setUploadProgressPlazoDoc(Math.round(progress));
      },
      (err) => { 
        setError('Error al subir el documento probatorio.'); 
        setUploadingPlazoDoc(false); 
      },
      async () => {
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

          await addDoc(collection(db, 'casos', caso.id, 'documentos_comunes'), {
            nombre: fileProbatorio.name,
            url: downloadURL,
            storage_path: storagePath,
            descripcion: descripcionProbatorio.trim(),
            fecha_documento: fechaDocumentoProbatorio,
            fecha_subida: new Date().toISOString()
          });

          const plazosModificados = localPlazos.map(p => {
            if (p.id === plazoAActivar.id) {
              return {
                ...p,
                completado: true,
                fechaPresentacion: new Date().toLocaleString(),
                documentoProbatorioNombre: fileProbatorio.name,
                documentoProbatorioUrl: downloadURL,
                documentoProbatorioDescripcion: descripcionProbatorio.trim(),
                documentoProbatorioFechaDocumento: fechaDocumentoProbatorio,
                storage_path: storagePath
              };
            }
            return p;
          });

          const casoDocRef = doc(db, 'casos', caso.id);
          await updateDoc(casoDocRef, { plazos: plazosModificados });

          await registrarLogAuditoria(
            currentUserEmail,
            'Resolución de Plazo',
            `Se solventó plazo ID: ${plazoAActivar.id} subiendo documento probatorio: "${fileProbatorio.name}"`
          );

          setLocalPlazos(plazosModificados);
          setFileProbatorio(null);
          setDescripcionProbatorio('');
          setFechaDocumentoProbatorio('');
          setPlazoAActivar(null);
          setOpenCerrarModal(false);
          fetchDocsComunes(); 
        } catch (ex) {
          setError(`Error en Firestore al resolver plazo: ${ex.message}`);
        } finally {
          setUploadingPlazoDoc(false);
        }
      }
    );
  };

  const handleCreateComunicado = async (e) => {
    e.preventDefault();
    if (!asuntoComunicado.trim() || !cuerpoComunicado.trim()) return;

    setUploadingComunicado(true);
    setUploadProgressComunicado(0);
    setError('');

    let poolClientesAEnviar = [];
    if (tipoDestinatario === 'todos') {
      poolClientesAEnviar = clientes;
    } else {
      poolClientesAEnviar = clientes.filter(c => clientesSeleccionadosIds.includes(c.id));
    }

    const listaCorreos = poolClientesAEnviar
      .map(c => c.correo_principal)
      .filter(email => email && email.trim() !== '');

    if (listaCorreos.length === 0) {
      setError('Operación cancelada: No se reportan destinatarios con correos válidos para este envío.');
      setUploadingComunicado(false);
      return;
    }

    const comunicadoCollectionRef = collection(db, 'casos', caso.id, 'comunicados');
    const nuevoComunicadoDoc = doc(comunicadoCollectionRef);
    const comunicadoId = nuevoComunicadoDoc.id;

    const guardarDocumentoEnFirestore = async (pdfNombre = '', pdfUrl = '', storagePath = '') => {
      try {
        const fechaCR = new Date().toLocaleString('es-CR', { timeZone: 'America/Costa_Rica' });
        const destinatariosDetalle = poolClientesAEnviar
          .filter(c => c.correo_principal && c.correo_principal.trim() !== '')
          .map(c => ({
            clienteId: c.id,
            email: c.correo_principal.trim(),
            nombre: `${c.nombres || ''} ${c.apellidos || ''}`.trim()
          }));

        // 1. Registrar primero en historial_comunicados de cada representado antes de disparar el trigger
        for (const clienteItem of poolClientesAEnviar) {
          if (!clienteItem.correo_principal || !clienteItem.correo_principal.trim()) continue;
          const historialRef = doc(db, 'casos', caso.id, 'clientes', clienteItem.id, 'historial_comunicados', comunicadoId);
          await setDoc(historialRef, {
            comunicadoId: comunicadoId,
            asunto: asuntoComunicado.trim(),
            cuerpo: cuerpoComunicado.trim(),
            pdf_nombre: pdfNombre,
            pdf_url: pdfUrl,
            storage_path: storagePath,
            estado: 'Enviado',
            ultima_actualizacion: fechaCR
          }, { merge: true });
        }

        const modeloDocumentoMail = {
          from: 'contacto@iiresodh.org',
          to: listaCorreos,
          destinatarios_detalle: destinatariosDetalle,
          template: {
            name: 'comunicado_institucional',
            data: {
              asunto: asuntoComunicado.trim(),
              cuerpo: cuerpoComunicado.trim()
            }
          },
          headers: {
            "X-SMTPAPI": JSON.stringify({
              unique_args: {
                casoId: caso.id,
                comunicadoId: comunicadoId
              }
            })
          },
          asunto: asuntoComunicado.trim(),
          cuerpo: cuerpoComunicado.trim(),
          fecha_envio: new Date().toISOString(),
          enviado_por: currentUserEmail,
          tipo_cobertura: tipoDestinatario,
          destinatarios_conteo: listaCorreos.length
        };

        if (pdfUrl) {
          modeloDocumentoMail.pdf_nombre = pdfNombre;
          modeloDocumentoMail.pdf_url = pdfUrl;
          modeloDocumentoMail.storage_path = storagePath;
          modeloDocumentoMail.message = {
            attachments: [{ filename: pdfNombre, path: pdfUrl }]
          };
        }

        await setDoc(nuevoComunicadoDoc, modeloDocumentoMail);

        await registrarLogAuditoria(
          currentUserEmail,
          'Envío de Comunicado',
          `Se registró comunicado: "${asuntoComunicado.trim()}" con destino a ${listaCorreos.length} representados.`
        );

        setAsuntoComunicado('');
        setCuerpoComunicado('');
        setFileComunicado(null);
        setClientesSeleccionadosIds([]);
        setFiltroDestinatarios('');
        setTipoDestinatario('todos');
        setOpenComunicadoModal(false);
        fetchComunicados();
      } catch (ex) {
        setError(`Error crítico en Firestore al registrar comunicado: ${ex.message}`);
      } finally {
        setUploadingComunicado(false);
      }
    };

    if (fileComunicado) {
      const storagePath = `casos/${caso.id}/documentos/${Date.now()}_${fileComunicado.name}`;
      const storagePathRef = ref(storage, storagePath);
      const uploadTask = uploadBytesResumable(storagePathRef, fileComunicado);

      uploadTask.on('state_changed', 
        (snap) => {
          const progress = (snap.bytesTransferred / snap.totalBytes) * 100;
          setUploadProgressComunicado(Math.round(progress));
        },
        (err) => {
          setError(`Error al subir el archivo del comunicado a Storage: ${err.message}`);
          setUploadingComunicado(false);
        },
        async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            await guardarDocumentoEnFirestore(fileComunicado.name, downloadURL, storagePath);
          } catch (exURL) {
            setError(`Error obtaining the URL file: ${exURL.message}`);
            setUploadingComunicado(false);
          }
        }
      );
    } else {
      await guardarDocumentoEnFirestore();
    }
  };

  const semaforoGeneral = (() => {
    const plazosActivos = localPlazos.filter(p => !p.completado);
    if (plazosActivos.length === 0) return null;

    const fechasEnMilisegundos = plazosActivos.map(p => new Date(p.fechaFatal + 'T00:00:00').getTime());
    const fechaMasProximaMs = Math.min(...fechasEnMilisegundos);
    
    const hoy = new Date();
    hoy.setHours(0,0,0,0);
    
    const fechaFatal = new Date(fechaMasProximaMs);
    fechaFatal.setHours(0,0,0,0);

    const diferenciaTiempo = fechaFatal.getTime() - hoy.getTime();
    const diasRestantes = Math.ceil(diferenciaTiempo / (1000 * 60 * 60 * 24));

    if (diasRestantes < 0) return { label: `Vencido (${Math.abs(diasRestantes)} d)`, color: '#b91c1c' };
    if (diasRestantes <= 2) return { label: `URGENTE (${diasRestantes} d)`, color: '#b91c1c' };
    if (diasRestantes <= 5) return { label: `Advertencia (${diasRestantes} d)`, color: '#b45309' };
    return { label: `${diasRestantes} días libres`, color: '#15803d' };
  })();

  const clientesFiltrados = clientes.filter(c => {
    const queryTerm = searchQuery.toLowerCase().trim();
    const coincideTexto = !queryTerm || (
      `${c.nombres || ''} ${c.apellidos || ''}`.toLowerCase().includes(queryTerm) ||
      `${c.apellidos || ''} ${c.nombres || ''}`.toLowerCase().includes(queryTerm) ||
      (c.identificacion || '').toLowerCase().includes(queryTerm) ||
      (c.pais || '').toLowerCase().includes(queryTerm) ||
      (c.correo_principal || '').toLowerCase().includes(queryTerm)
    );

    const coincideAcreditacion =
      filtroAcreditacion === 'Todos' ||
      (filtroAcreditacion === 'Listos Art. 35' && c.tiene_poder && c.tiene_documento_id) ||
      (filtroAcreditacion === 'Pendientes Poder/ID' && (!c.tiene_poder || !c.tiene_documento_id)) ||
      (filtroAcreditacion === 'Con Vulnerabilidad' && c.condicion_vulnerabilidad && c.condicion_vulnerabilidad !== 'Ninguna');

    return coincideTexto && coincideAcreditacion;
  });

  const clientesPaginados = clientesFiltrados.slice(page * rowsPerPage, (page * rowsPerPage) + rowsPerPage);

  const docsComunesFiltrados = docsComunes.filter(d => {
    if (filtroCategoriaDoc === 'Todas') return true;
    return (d.categoria_procesal || 'Escrito IIRESODH') === filtroCategoriaDoc;
  });

  const metricasFinancieras = (() => {
    let totalUSD = 0;
    let totalCRC = 0;
    let pagados = 0;
    let abonos = 0;
    let exonerados = 0;
    let pendientes = 0;

    clientes.forEach(c => {
      const m = Number(c.monto_pagado) || 0;
      if ((c.moneda_pago || 'USD') === 'CRC') totalCRC += m;
      else totalUSD += m;

      const st = c.estado_pago || 'Pendiente';
      if (st === 'Pagado') pagados++;
      else if (st === 'Abono Parcial') abonos++;
      else if (st === 'Exonerado / Pro Bono') exonerados++;
      else pendientes++;
    });

    return { totalUSD, totalCRC, pagados, abonos, exonerados, pendientes };
  })();

  if (clienteSeleccionadoId) {
    return (
      <FichaCliente 
        casoId={caso.id} 
        clienteId={clienteSeleccionadoId} 
        onVolver={() => setClienteSeleccionadoId(null)} 
        currentUserEmail={currentUserEmail} 
      />
    );
  }

  const totalAcreditados = clientes.filter((c) => c.tiene_poder && c.tiene_documento_id).length;
  const totalVulnerables = clientes.filter(
    (c) => c.condicion_vulnerabilidad && c.condicion_vulnerabilidad !== 'Ninguna'
  ).length;
  const plazosPendientesCount = localPlazos.filter((p) => !p.completado).length;

  return (
    <Box sx={{ maxWidth: 1440, mx: 'auto', pb: 6 }}>
      {/* =================================================================== */}
      {/* BARRA SUPERIOR: BREADCRUMB + TELEMETRÍA INTEGRADA + ACCIONES        */}
      {/* =================================================================== */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', lg: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', lg: 'center' },
          gap: 1.5,
          mb: 2
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Button
            size="small"
            startIcon={<ArrowLeft size={15} />}
            onClick={onVolver}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              fontSize: '0.78rem',
              color: '#475569',
              bgcolor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 1.5,
              px: 1.25,
              py: 0.4,
              '&:hover': { bgcolor: '#f1f5f9', color: '#0f172a' }
            }}
          >
            Casos y Litigios
          </Button>

          {casoLocal.expediente_oficial && (
            <Box
              component="span"
              sx={{
                px: 0.85,
                py: 0.2,
                borderRadius: 1,
                fontSize: '0.72rem',
                fontWeight: 700,
                fontFamily: 'monospace',
                bgcolor: '#f1f5f9',
                color: '#334155',
                border: '1px solid #e2e8f0'
              }}
            >
              {casoLocal.expediente_oficial}
            </Box>
          )}
        </Box>

        {/* CINTA DE TELEMETRÍA EJECUTIVA DEL CASO + ACCIONES PRIMARIAS */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.25,
            flexWrap: 'wrap',
            width: { xs: '100%', lg: 'auto' },
            justifyContent: { xs: 'space-between', lg: 'flex-end' }
          }}
        >
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              bgcolor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: 2,
              px: 0.75,
              py: 0.45,
              gap: 0.4,
              boxShadow: '0 1px 2px rgba(15, 23, 42, 0.03)',
              overflowX: 'auto'
            }}
          >
            <Tooltip title="Ver Padrón de Representados">
              <Box
                onClick={() => setActiveTab(0)}
                sx={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 0.5,
                  px: 1.1,
                  py: 0.35,
                  borderRadius: 1.25,
                  cursor: 'pointer',
                  bgcolor: activeTab === 0 ? '#f8fafc' : 'transparent',
                  '&:hover': { bgcolor: '#f1f5f9' }
                }}
              >
                <Typography
                  sx={{
                    fontSize: '0.84rem',
                    fontWeight: 800,
                    color: '#0f172a',
                    fontVariantNumeric: 'tabular-nums'
                  }}
                >
                  {clientes.length}
                </Typography>
                <Typography sx={{ fontSize: '0.7rem', fontWeight: 500, color: '#64748b' }}>
                  representados
                </Typography>
              </Box>
            </Tooltip>

            <Divider orientation="vertical" flexItem sx={{ my: 0.4 }} />

            <Tooltip title={`Acreditación completa (${perfilJurisdiccional.normaCorto})`}>
              <Box
                onClick={() => {
                  setActiveTab(0);
                  setFiltroAcreditacion((prev) =>
                    prev === 'Listos Art. 35' ? 'Todos' : 'Listos Art. 35'
                  );
                }}
                sx={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 0.5,
                  px: 1.1,
                  py: 0.35,
                  borderRadius: 1.25,
                  cursor: 'pointer',
                  bgcolor: filtroAcreditacion === 'Listos Art. 35' ? '#f0fdf4' : 'transparent',
                  '&:hover': { bgcolor: '#f0fdf4' }
                }}
              >
                <Typography
                  sx={{
                    fontSize: '0.84rem',
                    fontWeight: 800,
                    color: '#15803d',
                    fontVariantNumeric: 'tabular-nums'
                  }}
                >
                  {totalAcreditados}/{clientes.length}
                </Typography>
                <Typography sx={{ fontSize: '0.7rem', fontWeight: 500, color: '#64748b' }}>
                  acreditados
                </Typography>
              </Box>
            </Tooltip>

            <Divider orientation="vertical" flexItem sx={{ my: 0.4 }} />

            <Tooltip title="Ver Piezas Procesales y Anexos">
              <Box
                onClick={() => setActiveTab(1)}
                sx={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 0.5,
                  px: 1.1,
                  py: 0.35,
                  borderRadius: 1.25,
                  cursor: 'pointer',
                  bgcolor: activeTab === 1 ? '#f8fafc' : 'transparent',
                  '&:hover': { bgcolor: '#f1f5f9' }
                }}
              >
                <Typography
                  sx={{
                    fontSize: '0.84rem',
                    fontWeight: 800,
                    color: '#0f172a',
                    fontVariantNumeric: 'tabular-nums'
                  }}
                >
                  {docsComunes.length}
                </Typography>
                <Typography sx={{ fontSize: '0.7rem', fontWeight: 500, color: '#64748b' }}>
                  piezas
                </Typography>
              </Box>
            </Tooltip>

            {semaforoGeneral && (
              <>
                <Divider orientation="vertical" flexItem sx={{ my: 0.4 }} />
                <Tooltip title="Ver Plazos Fatales">
                  <Box
                    onClick={() => setActiveTab(3)}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      px: 1.1,
                      py: 0.35,
                      borderRadius: 1.25,
                      cursor: 'pointer',
                      bgcolor: '#fef2f2',
                      '&:hover': { bgcolor: '#fee2e2' }
                    }}
                  >
                    <Clock size={12} color={semaforoGeneral.color} />
                    <Typography
                      sx={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        color: semaforoGeneral.color
                      }}
                    >
                      {semaforoGeneral.label}
                    </Typography>
                  </Box>
                </Tooltip>
              </>
            )}
          </Box>

          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
            {!perfilJurisdiccional.esInternacional && (
              <Button
                size="small"
                variant="outlined"
                startIcon={<Globe size={14} />}
                onClick={() => setOpenEscalarModal(true)}
                sx={{
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '0.76rem',
                  borderRadius: 1.75,
                  borderColor: '#cbd5e1',
                  color: '#334155',
                  bgcolor: '#ffffff',
                  py: 0.55,
                  px: 1.35,
                  '&:hover': { bgcolor: '#f8fafc', borderColor: '#94a3b8' }
                }}
              >
                Escalar a CIDH / ONU
              </Button>
            )}
            <Button
              size="small"
              variant="contained"
              startIcon={<Sparkles size={14} />}
              onClick={() => setActiveTab(5)}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.78rem',
                borderRadius: 1.75,
                bgcolor: '#0f172a',
                color: '#ffffff',
                py: 0.6,
                px: 1.6,
                boxShadow: '0 1px 2px rgba(15, 23, 42, 0.12)',
                '&:hover': { bgcolor: '#1e293b' }
              }}
            >
              Copiloto PIDA
            </Button>
          </Box>
        </Box>
      </Box>

      {/* =================================================================== */}
      {/* CABECERA EJECUTIVA MÍNIMA DEL EXPEDIENTE + RUTA PROCESAL EN 1 CLIC  */}
      {/* =================================================================== */}
      <Paper
        elevation={0}
        sx={{
          position: 'relative',
          p: { xs: 2, sm: 2.5 },
          pl: { xs: 2.5, sm: 3 },
          mb: 2.5,
          borderRadius: '0 10px 10px 0',
          bgcolor: '#ffffff',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 2px rgba(15, 23, 42, 0.03)',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: '4px',
            bgcolor: perfilJurisdiccional.esInternacional ? '#2563eb' : '#0d9488'
          }
        }}
      >
        {/* Fila 1: Insignias jurisdiccionales + Contraparte + Botón de Ficha Desplegable */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 1,
            mb: 0.75
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
                fontSize: '0.7rem',
                fontWeight: 700,
                bgcolor: perfilJurisdiccional.esInternacional ? '#eff6ff' : '#f0fdf4',
                color: perfilJurisdiccional.esInternacional ? '#1d4ed8' : '#0f766e'
              }}
            >
              {perfilJurisdiccional.pais.bandera}{' '}
              {perfilJurisdiccional.esInternacional ? 'Internacional' : 'Nacional'} ·{' '}
              {casoLocal.jurisdiccion || 'CIDH'}
            </Box>

            {casoLocal.estado_demandado && (
              <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.76rem' }}>
                Contra <strong style={{ color: '#334155' }}>{casoLocal.estado_demandado}</strong>
              </Typography>
            )}

            {casoLocal.abogado_responsable && (
              <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.75rem' }}>
                · Resp: <strong style={{ color: '#475569' }}>{casoLocal.abogado_responsable}</strong>
              </Typography>
            )}
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Button
              size="small"
              onClick={() => setMostrarFichaCaso((prev) => !prev)}
              endIcon={mostrarFichaCaso ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              sx={{
                textTransform: 'none',
                fontSize: '0.74rem',
                fontWeight: 600,
                color: '#475569',
                bgcolor: mostrarFichaCaso ? '#f1f5f9' : '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 1.5,
                px: 1.1,
                py: 0.25,
                '&:hover': { bgcolor: '#f1f5f9', color: '#0f172a' }
              }}
            >
              Ficha y Normativa
            </Button>
          </Box>
        </Box>

        {/* Título Principal del Caso */}
        <Typography
          variant="h5"
          sx={{
            fontWeight: 800,
            color: '#0f172a',
            letterSpacing: '-0.02em',
            fontSize: { xs: '1.2rem', sm: '1.45rem' },
            lineHeight: 1.3,
            mb: 1.5
          }}
        >
          {casoLocal.nombre}
        </Typography>

        {/* CAJÓN DESPLEGABLE 1: SÍNTESIS FÁCTICA, RÉGIMEN Y NORMATIVA INVOCADA */}
        <Collapse in={mostrarFichaCaso} timeout="auto" unmountOnExit>
          <Box
            sx={{
              p: 1.75,
              mb: 1.75,
              bgcolor: '#f8fafc',
              borderRadius: 2,
              border: '1px solid #e2e8f0'
            }}
          >
            <Typography
              variant="body2"
              sx={{ color: '#334155', fontSize: '0.82rem', lineHeight: 1.6, mb: 1.25 }}
            >
              {casoLocal.descripcion || 'Sin descripción registrada para este litigio.'}
            </Typography>

            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 1,
                pt: 1,
                borderTop: '1px solid #e2e8f0'
              }}
            >
              <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.74rem' }}>
                <strong style={{ color: '#334155' }}>Estándar Procesal:</strong>{' '}
                {perfilJurisdiccional.normaTitulo} —{' '}
                {perfilJurisdiccional.esInternacional
                  ? 'Reglamentos internacionales (CIDH / Corte IDH / ONU).'
                  : perfilJurisdiccional.pais.requisitoPoderNacional}
              </Typography>

              {casoLocal.fecha_agotamiento_interno && (
                <Box
                  component="span"
                  sx={{
                    px: 0.8,
                    py: 0.15,
                    borderRadius: 1,
                    bgcolor: '#fffbeb',
                    color: '#b45309',
                    border: '1px solid #fde68a',
                    fontSize: '0.68rem',
                    fontWeight: 700
                  }}
                >
                  Vía interna agotada: {casoLocal.fecha_agotamiento_interno}
                </Box>
              )}
            </Box>

            {Array.isArray(casoLocal.derechos_invocados) &&
              casoLocal.derechos_invocados.length > 0 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1.25 }}>
                  {casoLocal.derechos_invocados.map((der) => (
                    <Box
                      key={der}
                      component="span"
                      sx={{
                        px: 0.85,
                        py: 0.2,
                        bgcolor: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: 1,
                        fontSize: '0.68rem',
                        fontWeight: 600,
                        color: '#334155'
                      }}
                    >
                      {der}
                    </Box>
                  ))}
                </Box>
              )}
          </Box>
        </Collapse>

        {/* BARRA DE PROGRESO PROCESAL SEGMENTADA (CLIC EN UNA ETAPA DESPLIEGA SU INSPECTOR) */}
        <Box sx={{ pt: 1.25, borderTop: '1px solid #f1f5f9' }}>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 1,
              mb: 0.85
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Typography
                sx={{
                  fontSize: '0.66rem',
                  fontWeight: 700,
                  color: '#64748b',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em'
                }}
              >
                Ruta Procesal
              </Typography>
              <Typography sx={{ fontSize: '0.73rem', fontWeight: 700, color: '#0f172a' }}>
                · {etapaActualCaso}
              </Typography>
            </Box>

            <Button
              size="small"
              variant="text"
              onClick={() => setMostrarDetalleEtapa((prev) => !prev)}
              endIcon={mostrarDetalleEtapa ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.72rem',
                color: '#475569',
                p: 0.25,
                minHeight: 'auto'
              }}
            >
              {mostrarDetalleEtapa ? 'Contraer hito de etapa' : 'Inspeccionar / editar hito'}
            </Button>
          </Box>

          {/* Track segmentado de 6 etapas */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'repeat(2, 1fr)',
                sm: 'repeat(3, 1fr)',
                md: `repeat(${etapasActivas.length}, 1fr)`
              },
              gap: 0.75
            }}
          >
            {etapasActivas.map((etapa, idx) => {
              const idxActual = etapasActivas.indexOf(etapaActualCaso);
              const activa = etapaActualCaso === etapa;
              const completada = idx < idxActual;
              const inspeccionada = etapaInspeccionada === etapa && mostrarDetalleEtapa;
              const infoHito = historialEtapas[etapa];
              const cleanName = etapa.replace(/^\d+\.\s*/, '');

              return (
                <Box
                  key={etapa}
                  onClick={() => handleSeleccionarEtapaInspeccion(etapa)}
                  sx={{
                    position: 'relative',
                    px: 0.9,
                    pt: 1.15,
                    pb: 0.75,
                    borderRadius: '0 0 6px 6px',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    bgcolor: inspeccionada
                      ? '#f1f5f9'
                      : activa
                      ? '#f8fafc'
                      : '#ffffff',
                    border: inspeccionada
                      ? '1px solid #0f172a'
                      : activa
                      ? '1px solid #94a3b8'
                      : '1px solid #e2e8f0',
                    transition: 'all 0.15s ease',
                    '&:hover': { borderColor: '#64748b', bgcolor: '#f8fafc' },
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: '3.5px',
                      bgcolor: activa
                        ? '#0f172a'
                        : completada
                        ? perfilJurisdiccional.esInternacional
                          ? '#2563eb'
                          : '#0d9488'
                        : '#e2e8f0'
                    }
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 0.5 }}>
                    <Typography
                      noWrap
                      sx={{
                        fontSize: '0.7rem',
                        fontWeight: activa || inspeccionada ? 700 : 500,
                        color: activa || inspeccionada ? '#0f172a' : completada ? '#334155' : '#64748b'
                      }}
                    >
                      {idx + 1}. {cleanName}
                    </Typography>
                    {infoHito?.fecha_hito && (
                      <Typography
                        sx={{
                          fontSize: '0.6rem',
                          fontFamily: 'monospace',
                          color: '#64748b',
                          flexShrink: 0
                        }}
                      >
                        {infoHito.fecha_hito.slice(5)}
                      </Typography>
                    )}
                  </Box>
                </Box>
              );
            })}
          </Box>

          {/* CAJÓN DESPLEGABLE 2: INSPECTOR Y REGISTRO DE HITO DE ETAPA */}
          <Collapse in={mostrarDetalleEtapa} timeout="auto" unmountOnExit>
            {(() => {
              const guia = guiaEtapasActiva[etapaInspeccionada] || guiaEtapasActiva[etapasActivas[0]];
              const idxInsp = etapasActivas.indexOf(etapaInspeccionada);
              const idxAct = etapasActivas.indexOf(etapaActualCaso);
              const esEtapaActual = etapaInspeccionada === etapaActualCaso;
              const esEtapaCompletada = idxInsp < idxAct;
              const infoGuardada = historialEtapas[etapaInspeccionada];

              return (
                <Box
                  sx={{
                    mt: 1.5,
                    p: 2,
                    borderRadius: 2,
                    bgcolor: '#f8fafc',
                    border: '1px solid #cbd5e1'
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 1,
                      mb: 1
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Typography variant="subtitle2" fontWeight={800} color="#0f172a">
                        {etapaInspeccionada}
                      </Typography>
                      <Box
                        component="span"
                        sx={{
                          px: 0.8,
                          py: 0.15,
                          borderRadius: 1,
                          fontSize: '0.66rem',
                          fontWeight: 700,
                          bgcolor: esEtapaActual ? '#0f172a' : esEtapaCompletada ? '#f0fdf4' : '#e2e8f0',
                          color: esEtapaActual ? '#ffffff' : esEtapaCompletada ? '#15803d' : '#475569'
                        }}
                      >
                        {esEtapaActual
                          ? 'Etapa Actual'
                          : esEtapaCompletada
                          ? 'Completada'
                          : 'Etapa Proyectada'}
                      </Box>
                      {infoGuardada?.resolucion_referencia && (
                        <Box
                          component="span"
                          sx={{
                            px: 0.8,
                            py: 0.15,
                            borderRadius: 1,
                            fontSize: '0.66rem',
                            fontWeight: 600,
                            fontFamily: 'monospace',
                            bgcolor: '#ffffff',
                            border: '1px solid #cbd5e1',
                            color: '#334155'
                          }}
                        >
                          Ref: {infoGuardada.resolucion_referencia}
                        </Box>
                      )}
                    </Box>

                    <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                      {!esEtapaActual && (
                        <Button
                          size="small"
                          variant="contained"
                          disabled={guardandoHitoEtapa}
                          onClick={() => handleCambiarEtapaProcesal(etapaInspeccionada, true)}
                          sx={{
                            textTransform: 'none',
                            fontWeight: 700,
                            fontSize: '0.73rem',
                            borderRadius: 1.5,
                            bgcolor: '#0f172a',
                            py: 0.4
                          }}
                        >
                          Marcar como Etapa Actual
                        </Button>
                      )}
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<Sparkles size={13} />}
                        onClick={() => {
                          setActiveTab(5);
                          setConsultaCopilotoIA(guia.promptIA);
                          handleEjecutarCopilotoIA(guia.promptIA);
                        }}
                        sx={{
                          textTransform: 'none',
                          fontWeight: 600,
                          fontSize: '0.73rem',
                          borderRadius: 1.5,
                          bgcolor: '#ffffff',
                          borderColor: '#cbd5e1',
                          color: '#0f172a',
                          py: 0.4
                        }}
                      >
                        Estrategia PIDA
                      </Button>
                    </Box>
                  </Box>

                  <Typography variant="caption" sx={{ display: 'block', color: '#475569', mb: 1.25 }}>
                    <strong>Objetivo:</strong> {guia.objetivo}
                  </Typography>

                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', sm: '160px 1fr 1fr auto' },
                      gap: 1,
                      alignItems: 'center'
                    }}
                  >
                    <TextField
                      label="Fecha Hito"
                      type="date"
                      size="small"
                      fullWidth
                      slotProps={{ inputLabel: { shrink: true } }}
                      value={hitoFechaInput}
                      onChange={(e) => setHitoFechaInput(e.target.value)}
                      sx={{ bgcolor: '#ffffff' }}
                    />
                    <TextField
                      label="Resolución / Escrito Ref."
                      size="small"
                      fullWidth
                      placeholder={
                        perfilJurisdiccional.esInternacional
                          ? 'Ej: Informe Admisibilidad 48/26'
                          : 'Ej: Voto N° 2026-004120'
                      }
                      value={hitoResolucionInput}
                      onChange={(e) => setHitoResolucionInput(e.target.value)}
                      sx={{ bgcolor: '#ffffff' }}
                    />
                    <TextField
                      label="Nota Ejecutiva"
                      size="small"
                      fullWidth
                      placeholder="Observación de avance..."
                      value={hitoResumenInput}
                      onChange={(e) => setHitoResumenInput(e.target.value)}
                      sx={{ bgcolor: '#ffffff' }}
                    />
                    <Button
                      size="small"
                      variant="contained"
                      disabled={guardandoHitoEtapa}
                      onClick={() => handleGuardarHitoEtapa(etapaInspeccionada)}
                      sx={{
                        textTransform: 'none',
                        fontWeight: 700,
                        fontSize: '0.75rem',
                        bgcolor: '#0f172a',
                        borderRadius: 1.5,
                        px: 2,
                        py: 0.85,
                        whiteSpace: 'nowrap',
                        '&:hover': { bgcolor: '#1e293b' }
                      }}
                    >
                      {guardandoHitoEtapa ? 'Guardando...' : 'Guardar Hito'}
                    </Button>
                  </Box>
                </Box>
              );
            })()}
          </Collapse>
        </Box>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* =================================================================== */}
      {/* NAVEGACIÓN ARQUITECTÓNICA DE PESTAÑAS (ESTILO LINEAR / HARVEY)      */}
      {/* =================================================================== */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
          overflowX: 'auto',
          p: 0.5,
          bgcolor: '#f1f5f9',
          borderRadius: 2,
          border: '1px solid #e2e8f0',
          mb: 0.5
        }}
      >
        {[
          { idx: 0, label: 'Padrón de Representados', count: clientes.length, icon: <Users size={15} /> },
          { idx: 1, label: 'Piezas y Anexos', count: docsComunes.length, icon: <FileText size={15} /> },
          { idx: 2, label: 'Finanzas y Aportes', count: null, icon: <CreditCard size={15} /> },
          {
            idx: 3,
            label: 'Plazos Fatales',
            count: plazosPendientesCount,
            urgent: Boolean(semaforoGeneral),
            icon: <Clock size={15} />
          },
          { idx: 4, label: 'Comunicados', count: comunicados.length, icon: <Mail size={15} /> },
          { idx: 5, label: 'Copiloto Jurídico PIDA', count: null, icon: <Sparkles size={15} /> }
        ].map((tabItem) => {
          const active = activeTab === tabItem.idx;
          return (
            <Box
              key={tabItem.idx}
              onClick={() => setActiveTab(tabItem.idx)}
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.75,
                px: 1.5,
                py: 0.7,
                borderRadius: 1.5,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                userSelect: 'none',
                fontSize: '0.78rem',
                fontWeight: active ? 700 : 600,
                color: active ? '#0f172a' : tabItem.urgent ? '#b91c1c' : '#64748b',
                bgcolor: active ? '#ffffff' : 'transparent',
                boxShadow: active ? '0 1px 2px rgba(15, 23, 42, 0.06)' : 'none',
                transition: 'all 0.15s ease',
                '&:hover': {
                  color: '#0f172a',
                  bgcolor: active ? '#ffffff' : 'rgba(255,255,255,0.5)'
                }
              }}
            >
              {tabItem.icon}
              <span>{tabItem.label}</span>
              {tabItem.count !== null && (
                <Box
                  component="span"
                  sx={{
                    px: 0.65,
                    py: 0.05,
                    borderRadius: 1,
                    fontSize: '0.67rem',
                    fontWeight: 700,
                    fontVariantNumeric: 'tabular-nums',
                    bgcolor: tabItem.urgent
                      ? '#fef2f2'
                      : active
                      ? '#f1f5f9'
                      : '#e2e8f0',
                    color: tabItem.urgent ? '#b91c1c' : '#334155'
                  }}
                >
                  {tabItem.count}
                </Box>
              )}
            </Box>
          );
        })}
      </Box>

      {/* =================================================================== */}
      {/* PESTAÑA 1: PADRÓN DE REPRESENTADOS Y ACREDITACIÓN ADAPTATIVA        */}
      {/* =================================================================== */}
      <TabPanel value={activeTab} index={0}>
        {/* Barra de Comando del Padrón */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', lg: 'row' },
            justifyContent: 'space-between',
            alignItems: { xs: 'stretch', lg: 'center' },
            gap: 1.25,
            mb: 2
          }}
        >
          {/* Buscador + Píldoras de Filtro Rápido */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexGrow: 1, flexWrap: 'wrap' }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                bgcolor: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: 2,
                px: 1.5,
                py: 0.45,
                flexGrow: 1,
                maxWidth: { xs: '100%', md: 360 },
                '&:focus-within': {
                  borderColor: '#0f172a',
                  boxShadow: '0 0 0 3px rgba(15, 23, 42, 0.06)'
                }
              }}
            >
              <Search size={15} color="#94a3b8" />
              <InputBase
                fullWidth
                placeholder="Buscar por nombre, ID, país o correo..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(0);
                }}
                sx={{ ml: 1, fontSize: '0.8rem', color: '#0f172a' }}
              />
              {searchQuery && (
                <IconButton
                  size="small"
                  onClick={() => {
                    setSearchQuery('');
                    setPage(0);
                  }}
                  sx={{ p: 0.25 }}
                >
                  <X size={13} />
                </IconButton>
              )}
            </Box>

            <Box
              sx={{
                display: 'inline-flex',
                bgcolor: '#f1f5f9',
                p: 0.35,
                borderRadius: 1.75,
                border: '1px solid #e2e8f0',
                flexWrap: 'wrap'
              }}
            >
              {[
                { key: 'Todos', label: `Todos (${clientes.length})` },
                { key: 'Listos Art. 35', label: `Acreditados (${totalAcreditados})` },
                {
                  key: 'Pendientes Poder/ID',
                  label: `Pendientes (${clientes.length - totalAcreditados})`
                },
                { key: 'Con Vulnerabilidad', label: `Vulnerables (${totalVulnerables})` }
              ].map((f) => {
                const active = filtroAcreditacion === f.key;
                return (
                  <Box
                    key={f.key}
                    onClick={() => {
                      setFiltroAcreditacion(f.key);
                      setPage(0);
                    }}
                    sx={{
                      px: 1.15,
                      py: 0.35,
                      borderRadius: 1.25,
                      fontSize: '0.73rem',
                      fontWeight: active ? 700 : 500,
                      color: active ? '#0f172a' : '#64748b',
                      bgcolor: active ? '#ffffff' : 'transparent',
                      boxShadow: active ? '0 1px 2px rgba(15,23,42,0.06)' : 'none',
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                  >
                    {f.label}
                  </Box>
                );
              })}
            </Box>
          </Box>

          {/* Acciones Ejecutivas del Padrón */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, justifyContent: 'flex-end' }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<ShieldCheck size={14} />}
              disabled={auditandoPadronIA}
              onClick={handleAuditarPadronIA}
              sx={{
                textTransform: 'none',
                borderRadius: 1.75,
                fontWeight: 600,
                fontSize: '0.75rem',
                color: '#334155',
                borderColor: '#e2e8f0',
                bgcolor: '#ffffff',
                py: 0.55,
                '&:hover': { bgcolor: '#f8fafc', borderColor: '#cbd5e1' }
              }}
            >
              {auditandoPadronIA ? 'Auditando...' : `Auditar PIDA (${perfilJurisdiccional.normaCorto})`}
            </Button>

            <Button
              variant="outlined"
              size="small"
              startIcon={<Download size={14} />}
              onClick={handleExportarPadronCSV}
              disabled={clientes.length === 0}
              sx={{
                textTransform: 'none',
                borderRadius: 1.75,
                fontWeight: 600,
                fontSize: '0.75rem',
                color: '#334155',
                borderColor: '#e2e8f0',
                bgcolor: '#ffffff',
                py: 0.55
              }}
            >
              CSV
            </Button>

            <Button
              variant="outlined"
              size="small"
              component="label"
              startIcon={<Upload size={14} />}
              disabled={importandoCSV}
              sx={{
                textTransform: 'none',
                borderRadius: 1.75,
                fontWeight: 600,
                fontSize: '0.75rem',
                color: '#334155',
                borderColor: '#e2e8f0',
                bgcolor: '#ffffff',
                py: 0.55
              }}
            >
              {importandoCSV ? 'Importando...' : 'Importar'}
              <input type="file" accept=".csv" hidden onChange={handleImportarPadronCSV} />
            </Button>

            <Button
              variant="contained"
              size="small"
              startIcon={<Plus size={15} />}
              onClick={() => setOpenModal(true)}
              sx={{
                textTransform: 'none',
                borderRadius: 1.75,
                fontWeight: 700,
                fontSize: '0.76rem',
                bgcolor: '#0f172a',
                py: 0.6,
                px: 1.5,
                '&:hover': { bgcolor: '#1e293b' }
              }}
            >
              Agregar Representado
            </Button>
          </Box>
        </Box>

        {/* Panel de Resultado de Auditoría PIDA del Padrón */}
        {resultadoAuditoriaPadron && (
          <Paper
            elevation={0}
            sx={{
              p: 2.25,
              mb: 2.5,
              borderRadius: 2.5,
              border: '1px solid #cbd5e1',
              bgcolor: '#f8fafc'
            }}
          >
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 1,
                mb: 1.25
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <ShieldCheck size={17} color="#0f172a" />
                <Typography variant="subtitle2" fontWeight={800} color="#0f172a">
                  Auditoría de Cumplimiento PIDA ({perfilJurisdiccional.normaTitulo})
                </Typography>
              </Box>
              <Button
                size="small"
                color="inherit"
                onClick={() => setResultadoAuditoriaPadron(null)}
                sx={{ textTransform: 'none', fontSize: '0.74rem' }}
              >
                Cerrar
              </Button>
            </Box>

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1.5 }}>
              <Chip
                size="small"
                color="success"
                label={`Listos: ${resultadoAuditoriaPadron.estadisticas.listosArt35}/${resultadoAuditoriaPadron.estadisticas.total} (${resultadoAuditoriaPadron.estadisticas.porcentajeListos}%)`}
                sx={{ fontWeight: 700, fontSize: '0.7rem' }}
              />
              <Chip
                size="small"
                color="warning"
                label={`Sin Poder: ${resultadoAuditoriaPadron.estadisticas.sinPoderCount}`}
                sx={{ fontWeight: 700, fontSize: '0.7rem' }}
              />
              <Chip
                size="small"
                color="warning"
                label={`Sin ID: ${resultadoAuditoriaPadron.estadisticas.sinIdCount}`}
                sx={{ fontWeight: 700, fontSize: '0.7rem' }}
              />
              <Chip
                size="small"
                color="secondary"
                label={`Vulnerables: ${resultadoAuditoriaPadron.estadisticas.vulnerablesCount}`}
                sx={{ fontWeight: 700, fontSize: '0.7rem' }}
              />
            </Box>

            <Box
              sx={{
                bgcolor: '#ffffff',
                p: 2,
                borderRadius: 2,
                border: '1px solid #e2e8f0',
                fontFamily: '"Georgia", "Times New Roman", serif',
                fontSize: '0.92rem',
                lineHeight: 1.68,
                color: '#1e293b'
              }}
              dangerouslySetInnerHTML={{
                __html: convertirMarkdownAHtmlJuridico(resultadoAuditoriaPadron.dictamenIA)
              }}
            />
          </Paper>
        )}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={26} sx={{ color: '#0f172a' }} />
          </Box>
        ) : clientesFiltrados.length === 0 ? (
          <Box
            sx={{
              textAlign: 'center',
              py: 6,
              px: 3,
              bgcolor: '#ffffff',
              borderRadius: 2.5,
              border: '1px dashed #cbd5e1'
            }}
          >
            <Typography variant="subtitle2" fontWeight={700} color="#334155">
              {searchQuery || filtroAcreditacion !== 'Todos'
                ? 'No hay representados que coincidan con este filtro'
                : 'No hay representados registrados en este expediente'}
            </Typography>
          </Box>
        ) : (
          <Paper
            elevation={0}
            sx={{
              borderRadius: 2.5,
              border: '1px solid #e2e8f0',
              bgcolor: '#ffffff',
              overflow: 'hidden'
            }}
          >
            <TableContainer sx={{ overflowX: 'auto' }}>
              <Table size="small" sx={{ minWidth: 780 }}>
                <TableHead sx={{ bgcolor: '#f8fafc' }}>
                  <TableRow>
                    <TableCell
                      sx={{
                        fontWeight: 700,
                        fontSize: '0.68rem',
                        color: '#64748b',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        py: 1.25
                      }}
                    >
                      Representado y Calidad
                    </TableCell>
                    <TableCell
                      sx={{
                        fontWeight: 700,
                        fontSize: '0.68rem',
                        color: '#64748b',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em'
                      }}
                    >
                      Identificación / País
                    </TableCell>
                    <TableCell
                      sx={{
                        fontWeight: 700,
                        fontSize: '0.68rem',
                        color: '#64748b',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em'
                      }}
                    >
                      Acreditación ({perfilJurisdiccional.normaCorto})
                    </TableCell>
                    <TableCell
                      sx={{
                        fontWeight: 700,
                        fontSize: '0.68rem',
                        color: '#64748b',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em'
                      }}
                    >
                      Contacto
                    </TableCell>
                    <TableCell
                      sx={{
                        fontWeight: 700,
                        fontSize: '0.68rem',
                        color: '#64748b',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em'
                      }}
                    >
                      Finanzas
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        fontWeight: 700,
                        fontSize: '0.68rem',
                        color: '#64748b',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em'
                      }}
                    >
                      Acción
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {clientesPaginados.map((clienteItem) => (
                    <TableRow
                      key={clienteItem.id}
                      hover
                      onClick={() => setClienteSeleccionadoId(clienteItem.id)}
                      sx={{ cursor: 'pointer', '& td': { py: 1.25 } }}
                    >
                      <TableCell>
                        <Typography sx={{ fontSize: '0.84rem', fontWeight: 700, color: '#0f172a' }}>
                          {clienteItem.apellidos}, {clienteItem.nombres}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.35 }}>
                          <Box
                            component="span"
                            sx={{
                              px: 0.65,
                              py: 0.1,
                              borderRadius: 0.85,
                              bgcolor: '#f1f5f9',
                              color: '#475569',
                              fontSize: '0.64rem',
                              fontWeight: 600
                            }}
                          >
                            {clienteItem.calidad_procesal || 'Víctima Directa'}
                          </Box>
                          {clienteItem.condicion_vulnerabilidad &&
                            clienteItem.condicion_vulnerabilidad !== 'Ninguna' && (
                              <Box
                                component="span"
                                sx={{
                                  px: 0.65,
                                  py: 0.1,
                                  borderRadius: 0.85,
                                  bgcolor: '#faf5ff',
                                  color: '#7e22ce',
                                  border: '1px solid #e9d5ff',
                                  fontSize: '0.64rem',
                                  fontWeight: 700
                                }}
                              >
                                🛡️ {clienteItem.condicion_vulnerabilidad}
                              </Box>
                            )}
                        </Box>
                      </TableCell>

                      <TableCell>
                        <Typography
                          sx={{
                            fontSize: '0.78rem',
                            fontFamily: 'monospace',
                            fontWeight: 700,
                            color: '#1e293b'
                          }}
                        >
                          {clienteItem.identificacion}
                        </Typography>
                        <Typography sx={{ fontSize: '0.68rem', color: '#64748b' }}>
                          {clienteItem.tipo_identificacion} ·{' '}
                          {clienteItem.pais || perfilJurisdiccional.pais.codigo}
                        </Typography>
                      </TableCell>

                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                          <Box
                            component="span"
                            sx={{
                              px: 0.7,
                              py: 0.15,
                              borderRadius: 1,
                              fontSize: '0.66rem',
                              fontWeight: 700,
                              bgcolor: clienteItem.tiene_poder ? '#f0fdf4' : '#f8fafc',
                              color: clienteItem.tiene_poder ? '#15803d' : '#94a3b8',
                              border: clienteItem.tiene_poder
                                ? '1px solid #bbf7d0'
                                : '1px solid #e2e8f0'
                            }}
                          >
                            {perfilJurisdiccional.requisitos.poder.chipLabel(
                              Boolean(clienteItem.tiene_poder)
                            )}
                          </Box>
                          <Box
                            component="span"
                            sx={{
                              px: 0.7,
                              py: 0.15,
                              borderRadius: 1,
                              fontSize: '0.66rem',
                              fontWeight: 700,
                              bgcolor: clienteItem.tiene_documento_id ? '#f0fdf4' : '#f8fafc',
                              color: clienteItem.tiene_documento_id ? '#15803d' : '#94a3b8',
                              border: clienteItem.tiene_documento_id
                                ? '1px solid #bbf7d0'
                                : '1px solid #e2e8f0'
                            }}
                          >
                            {perfilJurisdiccional.requisitos.identidad.chipLabel(
                              Boolean(clienteItem.tiene_documento_id)
                            )}
                          </Box>
                          <Box
                            component="span"
                            sx={{
                              px: 0.7,
                              py: 0.15,
                              borderRadius: 1,
                              fontSize: '0.66rem',
                              fontWeight: 700,
                              bgcolor: clienteItem.tiene_prueba_dano ? '#eff6ff' : '#f8fafc',
                              color: clienteItem.tiene_prueba_dano ? '#1d4ed8' : '#94a3b8',
                              border: clienteItem.tiene_prueba_dano
                                ? '1px solid #bfdbfe'
                                : '1px solid #e2e8f0'
                            }}
                          >
                            {perfilJurisdiccional.requisitos.prueba.chipLabel(
                              Boolean(clienteItem.tiene_prueba_dano)
                            )}
                          </Box>
                        </Box>
                      </TableCell>

                      <TableCell>
                        <Typography sx={{ fontSize: '0.78rem', color: '#334155' }}>
                          {clienteItem.correo_principal || '—'}
                        </Typography>
                        <Typography sx={{ fontSize: '0.68rem', color: '#64748b' }}>
                          {clienteItem.telefono_principal
                            ? `${clienteItem.codigo_telefono_principal || ''} ${
                                clienteItem.telefono_principal
                              }`
                            : 'Sin teléfono'}
                        </Typography>
                      </TableCell>

                      <TableCell>
                        <Box
                          component="span"
                          sx={{
                            px: 0.8,
                            py: 0.2,
                            borderRadius: 1,
                            fontSize: '0.67rem',
                            fontWeight: 700,
                            bgcolor:
                              clienteItem.estado_pago === 'Pagado'
                                ? '#f0fdf4'
                                : clienteItem.estado_pago === 'Exonerado / Pro Bono'
                                ? '#faf5ff'
                                : '#fffbeb',
                            color:
                              clienteItem.estado_pago === 'Pagado'
                                ? '#15803d'
                                : clienteItem.estado_pago === 'Exonerado / Pro Bono'
                                ? '#7e22ce'
                                : '#b45309'
                          }}
                        >
                          {clienteItem.estado_pago || 'Pendiente'}
                        </Box>
                      </TableCell>

                      <TableCell align="right">
                        <Button
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            setClienteSeleccionadoId(clienteItem.id);
                          }}
                          endIcon={<ArrowUpRight size={13} />}
                          sx={{
                            textTransform: 'none',
                            fontSize: '0.73rem',
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
                          Ficha
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            <TablePagination
              rowsPerPageOptions={[10, 25, 50]}
              component="div"
              count={clientesFiltrados.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={(e, newPage) => setPage(newPage)}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10));
                setPage(0);
              }}
              labelRowsPerPage="Filas:"
              labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`}
            />
          </Paper>
        )}
      </TabPanel>

      {/* PESTAÑA 2: PIEZAS PROCESALES, ANEXOS, GOOGLE DRIVE Y ANALIZADOR IA */}
      <TabPanel value={activeTab} index={1}>
        <Paper
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDropDocComun}
          sx={{
            p: { xs: 2, sm: 2.5 },
            borderRadius: 3,
            border: isDragging ? '2px dashed #0f172a' : '1px solid #e2e8f0',
            bgcolor: isDragging ? '#f8fafc' : '#ffffff',
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)',
            transition: 'all 0.2s ease'
          }}
        >
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', md: 'row' },
              justifyContent: 'space-between',
              alignItems: { xs: 'flex-start', md: 'center' },
              gap: 1.5,
              mb: 2
            }}
          >
            <Box>
              <Typography sx={{ fontSize: '0.96rem', fontWeight: 800, color: '#0f172a' }}>
                Piezas Procesales, Resoluciones y Anexos del Caso
              </Typography>
              <Typography sx={{ fontSize: '0.76rem', color: '#64748b' }}>
                Clasifica escritos, resoluciones, contestaciones del Estado y analiza plazos fatales con PIDA. Haz clic en cualquier pieza para desplegar detalles.
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<FolderOpen size={14} />}
                onClick={() => setOpenDriveLinkModal(true)}
                sx={{
                  textTransform: 'none',
                  borderRadius: 1.75,
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  borderColor: '#cbd5e1',
                  color: '#334155'
                }}
              >
                Vincular desde Google Drive
              </Button>
              <Button
                variant="contained"
                size="small"
                component="label"
                startIcon={<Upload size={14} />}
                disabled={uploadingDoc}
                sx={{
                  textTransform: 'none',
                  borderRadius: 1.75,
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  bgcolor: '#0f172a',
                  boxShadow: 'none',
                  '&:hover': { bgcolor: '#1e293b', boxShadow: 'none' }
                }}
              >
                {uploadingDoc ? 'Subiendo...' : 'Subir Pieza / Anexo'}
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  hidden
                  onChange={handleUploadDocComun}
                />
              </Button>
            </Box>
          </Box>

          {/* Filtro por Categoría Procesal (Pills arquitectónicas) */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6, mb: 2 }}>
            {['Todas', ...CATEGORIAS_DOCUMENTOS_PROCESALES].map((cat) => {
              const active = filtroCategoriaDoc === cat;
              return (
                <Box
                  key={cat}
                  component="button"
                  type="button"
                  onClick={() => setFiltroCategoriaDoc(cat)}
                  sx={{
                    px: 1.25,
                    py: 0.5,
                    borderRadius: 1.5,
                    border: active ? '1px solid #0f172a' : '1px solid #e2e8f0',
                    bgcolor: active ? '#0f172a' : '#f8fafc',
                    color: active ? '#ffffff' : '#475569',
                    fontSize: '0.73rem',
                    fontWeight: active ? 700 : 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    '&:hover': {
                      bgcolor: active ? '#0f172a' : '#f1f5f9',
                      borderColor: active ? '#0f172a' : '#cbd5e1'
                    }
                  }}
                >
                  {cat}
                </Box>
              );
            })}
          </Box>

          {uploadingDoc && (
            <Box sx={{ width: '100%', mb: 2 }}>
              <LinearProgress variant="determinate" value={uploadProgressDoc} />
            </Box>
          )}

          {/* Panel de Resultado del Analizador Multimodal IA */}
          {resultadoAnalisisDocIA && (
            <Paper
              sx={{
                p: 2.25,
                mb: 2.5,
                borderRadius: 2.5,
                border: '1px solid #c7d2fe',
                bgcolor: '#f8fafc',
                boxShadow: 'none'
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 1,
                  mb: 1.5
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Sparkles size={16} color="#4338ca" />
                  <Typography sx={{ fontSize: '0.88rem', fontWeight: 800, color: '#1e1b4b' }}>
                    Análisis de Pieza con PIDA: {resultadoAnalisisDocIA.docNombre}
                  </Typography>
                  <Chip
                    size="small"
                    label="PIDA · Análisis Multimodal"
                    sx={{ fontWeight: 700, fontSize: '0.68rem', bgcolor: '#eef2ff', color: '#4338ca' }}
                  />
                  <Chip
                    size="small"
                    color={resultadoAnalisisDocIA.riesgo_procesal === 'Alto' ? 'error' : 'info'}
                    label={`Riesgo: ${resultadoAnalisisDocIA.riesgo_procesal || 'Medio'}`}
                    sx={{ fontWeight: 700, fontSize: '0.68rem' }}
                  />
                </Box>
                <Button
                  size="small"
                  color="inherit"
                  onClick={() => setResultadoAnalisisDocIA(null)}
                  sx={{ textTransform: 'none', fontSize: '0.75rem', fontWeight: 700 }}
                >
                  Cerrar
                </Button>
              </Box>

              <Box
                sx={{
                  mb: 1.5,
                  bgcolor: '#ffffff',
                  p: 1.75,
                  borderRadius: 2,
                  border: '1px solid #e2e8f0',
                  fontFamily: '"Georgia", "Times New Roman", serif',
                  fontSize: '0.9rem',
                  lineHeight: 1.65
                }}
              >
                <Typography
                  sx={{
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    color: '#4338ca',
                    display: 'block',
                    mb: 0.5,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em'
                  }}
                >
                  Resumen Ejecutivo PIDA
                </Typography>
                <Box
                  dangerouslySetInnerHTML={{
                    __html: convertirMarkdownAHtmlJuridico(resultadoAnalisisDocIA.resumen_ejecutivo)
                  }}
                />
              </Box>

              {Array.isArray(resultadoAnalisisDocIA.puntos_clave) &&
                resultadoAnalisisDocIA.puntos_clave.length > 0 && (
                  <Box
                    sx={{
                      mb: 1.5,
                      bgcolor: '#ffffff',
                      p: 1.5,
                      borderRadius: 2,
                      border: '1px solid #e2e8f0'
                    }}
                  >
                    <Typography
                      sx={{
                        fontSize: '0.68rem',
                        fontWeight: 800,
                        color: '#64748b',
                        display: 'block',
                        mb: 0.5,
                        textTransform: 'uppercase'
                      }}
                    >
                      Puntos Resolutivos / Argumentos Detectados
                    </Typography>
                    <Box
                      sx={{ fontSize: '0.85rem' }}
                      dangerouslySetInnerHTML={{
                        __html: convertirMarkdownAHtmlJuridico(
                          resultadoAnalisisDocIA.puntos_clave.map((pt) => `- ${pt}`).join('\n')
                        )
                      }}
                    />
                  </Box>
                )}

              {resultadoAnalisisDocIA.fecha_vencimiento_sugerida && (
                <Box
                  sx={{
                    p: 1.5,
                    bgcolor: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: 2,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 1
                  }}
                >
                  <Box>
                    <Typography sx={{ fontSize: '0.75rem', fontWeight: 800, color: '#b91c1c' }}>
                      PLAZO FATAL DETECTADO EN EL DOCUMENTO: {resultadoAnalisisDocIA.fecha_vencimiento_sugerida}
                    </Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: '#334155' }}>
                      {resultadoAnalisisDocIA.titulo_plazo_sugerido}
                    </Typography>
                  </Box>
                  <Button
                    size="small"
                    variant="contained"
                    color="error"
                    startIcon={<Calendar size={14} />}
                    onClick={handleAgendarPlazoDesdeIA}
                    sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.76rem', borderRadius: 1.5 }}
                  >
                    Agendar Plazo Fatal y Sincronizar
                  </Button>
                </Box>
              )}
            </Paper>
          )}

          {loadingDocs ? (
            <Box sx={{ py: 3, textAlign: 'center' }}>
              <CircularProgress size={26} />
            </Box>
          ) : docsComunesFiltrados.length === 0 ? (
            <Box
              sx={{
                py: 4,
                textAlign: 'center',
                bgcolor: '#f8fafc',
                borderRadius: 2,
                border: '1px dashed #cbd5e1'
              }}
            >
              <Typography sx={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>
                No hay piezas procesales registradas en esta categoría.
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.85 }}>
              {docsComunesFiltrados.map((d) => {
                const isDocExpanded = Boolean(expandedDocIds[d.id]);
                return (
                  <Paper
                    key={d.id}
                    elevation={0}
                    sx={{
                      borderRadius: 2,
                      border: isDocExpanded ? '1px solid #cbd5e1' : '1px solid #e2e8f0',
                      bgcolor: isDocExpanded ? '#f8fafc' : '#ffffff',
                      overflow: 'hidden',
                      transition: 'all 0.16s ease',
                      '&:hover': { borderColor: '#cbd5e1' }
                    }}
                  >
                    {/* Fila compacta 1-clic */}
                    <Box
                      onClick={() => toggleExpandDoc(d.id)}
                      sx={{
                        px: 1.75,
                        py: 1.15,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 1.5,
                        cursor: 'pointer'
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, flex: 1, flexWrap: 'wrap' }}>
                        <File size={15} color="#475569" style={{ flexShrink: 0 }} />
                        <Typography
                          sx={{
                            fontSize: '0.83rem',
                            fontWeight: 700,
                            color: '#0f172a',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {d.nombre}
                        </Typography>
                        <Box
                          component="span"
                          sx={{
                            px: 0.8,
                            py: 0.15,
                            borderRadius: 1,
                            fontSize: '0.67rem',
                            fontWeight: 700,
                            bgcolor: '#eff6ff',
                            color: '#1d4ed8',
                            border: '1px solid #bfdbfe'
                          }}
                        >
                          {d.categoria_procesal || 'Escrito IIRESODH'}
                        </Box>
                        {d.numero_anexo && (
                          <Box
                            component="span"
                            sx={{
                              px: 0.75,
                              py: 0.15,
                              borderRadius: 1,
                              fontSize: '0.66rem',
                              fontWeight: 700,
                              fontFamily: '"JetBrains Mono", monospace',
                              bgcolor: '#f1f5f9',
                              color: '#334155',
                              border: '1px solid #e2e8f0'
                            }}
                          >
                            Anexo {d.numero_anexo}
                          </Box>
                        )}
                      </Box>

                      <Box
                        sx={{ display: 'flex', alignItems: 'center', gap: 0.85, flexShrink: 0 }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {d.fecha_documento && (
                          <Typography
                            sx={{
                              display: { xs: 'none', sm: 'block' },
                              fontSize: '0.7rem',
                              fontFamily: '"JetBrains Mono", monospace',
                              color: '#64748b'
                            }}
                          >
                            {d.fecha_documento}
                          </Typography>
                        )}
                        <Button
                          size="small"
                          component="a"
                          href={d.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          endIcon={<ArrowUpRight size={13} />}
                          sx={{
                            textTransform: 'none',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            color: '#0f172a',
                            bgcolor: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: 1.5,
                            px: 1,
                            py: 0.25,
                            minWidth: 'auto',
                            '&:hover': { bgcolor: '#0f172a', color: '#ffffff' }
                          }}
                        >
                          Abrir
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={
                            analizandoDocIAId === d.id ? (
                              <CircularProgress size={12} />
                            ) : (
                              <Sparkles size={13} />
                            )
                          }
                          disabled={analizandoDocIAId === d.id}
                          onClick={() => handleAnalizarPiezaIA(d)}
                          sx={{
                            textTransform: 'none',
                            fontWeight: 700,
                            fontSize: '0.72rem',
                            borderRadius: 1.5,
                            py: 0.25,
                            px: 1,
                            borderColor: '#c7d2fe',
                            color: '#4338ca',
                            bgcolor: '#eef2ff',
                            whiteSpace: 'nowrap',
                            '&:hover': { bgcolor: '#e0e7ff', borderColor: '#818cf8' }
                          }}
                        >
                          PIDA
                        </Button>
                        <IconButton
                          size="small"
                          onClick={() => toggleExpandDoc(d.id)}
                          sx={{ p: 0.4, color: '#64748b' }}
                        >
                          {isDocExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                        </IconButton>
                      </Box>
                    </Box>

                    {/* Detalle colapsable de la pieza */}
                    <Collapse in={isDocExpanded} timeout="auto" unmountOnExit>
                      <Box
                        sx={{
                          px: 2,
                          py: 1.25,
                          borderTop: '1px solid #e2e8f0',
                          bgcolor: '#ffffff',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: 1.5
                        }}
                      >
                        <Box>
                          <Typography sx={{ fontSize: '0.78rem', color: '#334155', fontWeight: 500 }}>
                            {d.descripcion || 'Sin descripción adicional registrada.'}
                          </Typography>
                          <Typography sx={{ fontSize: '0.68rem', color: '#94a3b8', mt: 0.25 }}>
                            Fecha del documento: {d.fecha_documento || 'No especificada'} · Subido:{' '}
                            {d.fecha_subida ? new Date(d.fecha_subida).toLocaleString() : '—'}
                          </Typography>
                        </Box>
                        <Button
                          size="small"
                          color="error"
                          startIcon={<Trash2 size={13} />}
                          onClick={() => handleDeleteDocComun(d.id, d.storage_path)}
                          sx={{
                            textTransform: 'none',
                            fontSize: '0.72rem',
                            fontWeight: 700
                          }}
                        >
                          Eliminar pieza
                        </Button>
                      </Box>
                    </Collapse>
                  </Paper>
                );
              })}
            </Box>
          )}
        </Paper>
      </TabPanel>

      {/* PESTAÑA 3: CONTROL FINANCIERO, APORTES Y REPARACIONES (PILAR 4) */}
      <TabPanel value={activeTab} index={2}>
        <Paper
          sx={{
            p: { xs: 2, sm: 2.5 },
            borderRadius: 3,
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)'
          }}
        >
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 1.5,
              mb: 2
            }}
          >
            <Box>
              <Typography sx={{ fontSize: '0.96rem', fontWeight: 800, color: '#0f172a' }}>
                Control Financiero, Aportes y Conciliación Stripe / SINPE
              </Typography>
              <Typography sx={{ fontSize: '0.76rem', color: '#64748b' }}>
                Edición directa en línea de aportes procesales, exoneraciones Pro Bono y referencias bancarias.
              </Typography>
            </Box>

            {/* CINTA DE TELEMETRÍA FINANCIERA COMPACTA (Reemplaza las 4 cajas gigantes) */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 1.25,
                  px: 1.5,
                  py: 0.65,
                  borderRadius: 2,
                  bgcolor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  flexWrap: 'wrap'
                }}
              >
                <Box sx={{ display: 'inline-flex', alignItems: 'baseline', gap: 0.5 }}>
                  <Typography
                    sx={{
                      fontSize: '0.84rem',
                      fontWeight: 800,
                      color: '#15803d',
                      fontFamily: '"JetBrains Mono", monospace'
                    }}
                  >
                    ${metricasFinancieras.totalUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </Typography>
                  <Typography sx={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 600 }}>
                    USD
                  </Typography>
                </Box>

                {metricasFinancieras.totalCRC > 0 && (
                  <>
                    <Box sx={{ width: '1px', height: 12, bgcolor: '#cbd5e1' }} />
                    <Box sx={{ display: 'inline-flex', alignItems: 'baseline', gap: 0.4 }}>
                      <Typography
                        sx={{
                          fontSize: '0.8rem',
                          fontWeight: 800,
                          color: '#0f172a',
                          fontFamily: '"JetBrains Mono", monospace'
                        }}
                      >
                        ₡{metricasFinancieras.totalCRC.toLocaleString('es-CR')}
                      </Typography>
                      <Typography sx={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 600 }}>
                        CRC
                      </Typography>
                    </Box>
                  </>
                )}

                <Box sx={{ width: '1px', height: 12, bgcolor: '#cbd5e1' }} />

                <Box sx={{ display: 'inline-flex', alignItems: 'baseline', gap: 0.4 }}>
                  <Typography sx={{ fontSize: '0.8rem', fontWeight: 800, color: '#15803d' }}>
                    {metricasFinancieras.pagados}
                  </Typography>
                  <Typography sx={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 500 }}>
                    al día
                  </Typography>
                </Box>

                <Box sx={{ width: '1px', height: 12, bgcolor: '#cbd5e1' }} />

                <Box sx={{ display: 'inline-flex', alignItems: 'baseline', gap: 0.4 }}>
                  <Typography sx={{ fontSize: '0.8rem', fontWeight: 800, color: '#b45309' }}>
                    {metricasFinancieras.pendientes + metricasFinancieras.abonos}
                  </Typography>
                  <Typography sx={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 500 }}>
                    pendientes/abono
                  </Typography>
                </Box>

                <Box sx={{ width: '1px', height: 12, bgcolor: '#cbd5e1' }} />

                <Box sx={{ display: 'inline-flex', alignItems: 'baseline', gap: 0.4 }}>
                  <Typography sx={{ fontSize: '0.8rem', fontWeight: 800, color: '#7e22ce' }}>
                    {metricasFinancieras.exonerados}
                  </Typography>
                  <Typography sx={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 500 }}>
                    pro bono
                  </Typography>
                </Box>
              </Box>

              <Button
                variant="outlined"
                size="small"
                startIcon={<Download size={14} />}
                onClick={handleExportarPadronCSV}
                sx={{
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: '0.76rem',
                  borderRadius: 1.75,
                  borderColor: '#cbd5e1',
                  color: '#334155'
                }}
              >
                Exportar CSV
              </Button>
            </Box>
          </Box>

          <TableContainer sx={{ borderRadius: 2, border: '1px solid #e2e8f0', maxHeight: 500 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow
                  sx={{
                    '& th': {
                      bgcolor: '#f8fafc',
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      color: '#64748b',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      py: 1.1
                    }
                  }}
                >
                  <TableCell>Representado</TableCell>
                  <TableCell>Estado de Pago</TableCell>
                  <TableCell>Monto Aportado</TableCell>
                  <TableCell>Moneda</TableCell>
                  <TableCell>Vía de Pago</TableCell>
                  <TableCell>Comprobante / Ref</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {clientes.map((c) => (
                  <TableRow key={c.id} hover>
                    <TableCell
                      sx={{
                        fontWeight: 700,
                        fontSize: '0.81rem',
                        color: '#0f172a',
                        cursor: 'pointer',
                        '&:hover': { textDecoration: 'underline' }
                      }}
                      onClick={() => setClienteSeleccionadoId(c.id)}
                    >
                      {c.apellidos}, {c.nombres}
                    </TableCell>
                    <TableCell>
                      <Select
                        size="small"
                        value={c.estado_pago || 'Pendiente'}
                        onChange={(e) =>
                          handleActualizarPagoRapido(c, { estado_pago: e.target.value })
                        }
                        sx={{ fontSize: '0.76rem', height: 28, borderRadius: 1.5 }}
                      >
                        {ESTADOS_PAGO_CLIENTE.map((st) => (
                          <MenuItem key={st} value={st} sx={{ fontSize: '0.76rem' }}>
                            {st}
                          </MenuItem>
                        ))}
                      </Select>
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        type="number"
                        defaultValue={c.monto_pagado || 0}
                        onBlur={(e) =>
                          handleActualizarPagoRapido(c, {
                            monto_pagado: Number(e.target.value) || 0
                          })
                        }
                        sx={{
                          width: 105,
                          '& input': {
                            py: 0.45,
                            fontSize: '0.78rem',
                            fontFamily: '"JetBrains Mono", monospace'
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        size="small"
                        value={c.moneda_pago || 'USD'}
                        onChange={(e) =>
                          handleActualizarPagoRapido(c, { moneda_pago: e.target.value })
                        }
                        sx={{ fontSize: '0.76rem', height: 28, borderRadius: 1.5 }}
                      >
                        <MenuItem value="USD">USD</MenuItem>
                        <MenuItem value="CRC">CRC</MenuItem>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        size="small"
                        value={c.metodo_pago || 'Transferencia / SINPE'}
                        onChange={(e) =>
                          handleActualizarPagoRapido(c, { metodo_pago: e.target.value })
                        }
                        sx={{ fontSize: '0.76rem', height: 28, borderRadius: 1.5 }}
                      >
                        <MenuItem value="Transferencia / SINPE">Transferencia / SINPE</MenuItem>
                        <MenuItem value="Stripe">Stripe</MenuItem>
                        <MenuItem value="Depósito Bancario">Depósito Bancario</MenuItem>
                        <MenuItem value="Exoneración Pro Bono">Exoneración Pro Bono</MenuItem>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        placeholder="Ref / Recibo"
                        defaultValue={c.referencia_pago || ''}
                        onBlur={(e) =>
                          handleActualizarPagoRapido(c, {
                            referencia_pago: e.target.value.trim()
                          })
                        }
                        sx={{
                          width: 140,
                          '& input': {
                            py: 0.45,
                            fontSize: '0.76rem',
                            fontFamily: '"JetBrains Mono", monospace'
                          }
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </TabPanel>

      {/* PESTAÑA 4: CONTROL DE VENCIMIENTOS PROCESALES SINCRONIZADOS CON CALENDARIO (PILAR 5) */}
      <TabPanel value={activeTab} index={3}>
        <Paper
          sx={{
            p: { xs: 2, sm: 2.5 },
            borderRadius: 3,
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)'
          }}
        >
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              justifyContent: 'space-between',
              alignItems: { xs: 'flex-start', sm: 'center' },
              gap: 1.5,
              mb: 2
            }}
          >
            <Box>
              <Typography sx={{ fontSize: '0.96rem', fontWeight: 800, color: '#0f172a' }}>
                Fechas Fatales y Plazos Judiciales
              </Typography>
              <Typography sx={{ fontSize: '0.76rem', color: '#64748b' }}>
                Términos perentorios sincronizados con el Calendario Institucional.
              </Typography>
            </Box>
            <Button
              variant="contained"
              size="small"
              startIcon={<Calendar size={14} />}
              onClick={() => setOpenPlazoModal(true)}
              sx={{
                textTransform: 'none',
                borderRadius: 1.75,
                fontWeight: 700,
                fontSize: '0.78rem',
                bgcolor: '#0f172a',
                boxShadow: 'none',
                '&:hover': { bgcolor: '#1e293b', boxShadow: 'none' }
              }}
            >
              Cargar Fecha Fatal
            </Button>
          </Box>

          {localPlazos.length === 0 ? (
            <Box
              sx={{
                py: 4,
                textAlign: 'center',
                bgcolor: '#f8fafc',
                borderRadius: 2,
                border: '1px dashed #cbd5e1'
              }}
            >
              <Typography sx={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>
                No hay plazos procesales configurados para este litigio.
              </Typography>
            </Box>
          ) : (
            <TableContainer
              component={Paper}
              sx={{
                borderRadius: 2,
                border: '1px solid #e2e8f0',
                boxShadow: 'none',
                overflowX: 'auto'
              }}
            >
              <Table size="small" sx={{ minWidth: 680 }}>
                <TableHead>
                  <TableRow
                    sx={{
                      '& th': {
                        bgcolor: '#f8fafc',
                        fontSize: '0.68rem',
                        fontWeight: 800,
                        color: '#64748b',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        py: 1.1
                      }
                    }}
                  >
                    <TableCell>Término Procesal / Responsable</TableCell>
                    <TableCell>Fecha Límite</TableCell>
                    <TableCell>Estatus</TableCell>
                    <TableCell>Documento Probatorio</TableCell>
                    <TableCell align="right">Acción</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {localPlazos.map((plazo) => {
                    const cfg = (() => {
                      if (plazo.completado)
                        return {
                          bg: '#f0fdf4',
                          color: '#15803d',
                          border: '#bbf7d0',
                          label: 'Presentado',
                          bgFila: '#ffffff'
                        };
                      const hoy = new Date();
                      hoy.setHours(0, 0, 0, 0);
                      const fatal = new Date(plazo.fechaFatal + 'T00:00:00');
                      fatal.setHours(0, 0, 0, 0);
                      const diff = Math.ceil(
                        (fatal.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)
                      );

                      if (diff < 0)
                        return {
                          bg: '#fef2f2',
                          color: '#b91c1c',
                          border: '#fecaca',
                          label: `Vencido (${Math.abs(diff)}d)`,
                          bgFila: '#fffbfb'
                        };
                      if (diff <= 2)
                        return {
                          bg: '#fef2f2',
                          color: '#b91c1c',
                          border: '#fecaca',
                          label: `CRÍTICO (${diff}d)`,
                          bgFila: '#fffbfb'
                        };
                      if (diff <= 5)
                        return {
                          bg: '#fffbeb',
                          color: '#b45309',
                          border: '#fde68a',
                          label: `Próximo (${diff}d)`,
                          bgFila: '#ffffff'
                        };
                      return {
                        bg: '#eff6ff',
                        color: '#1d4ed8',
                        border: '#bfdbfe',
                        label: `En plazo (${diff}d)`,
                        bgFila: '#ffffff'
                      };
                    })();

                    return (
                      <TableRow key={plazo.id} sx={{ bgcolor: cfg.bgFila }} hover>
                        <TableCell sx={{ py: 1.25 }}>
                          <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a' }}>
                            {plazo.descripcion}
                          </Typography>
                          {(plazo.responsable || plazo.prorroga) && (
                            <Typography sx={{ fontSize: '0.71rem', color: '#64748b' }}>
                              {plazo.responsable ? `Responsable: ${plazo.responsable}` : ''}
                              {plazo.prorroga ? ` · Nota: ${plazo.prorroga}` : ''}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Typography
                            sx={{
                              fontSize: '0.78rem',
                              fontWeight: 800,
                              fontFamily: '"JetBrains Mono", monospace',
                              color: plazo.completado ? '#475569' : '#b91c1c'
                            }}
                          >
                            {plazo.fechaFatal}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Box
                            component="span"
                            sx={{
                              px: 0.85,
                              py: 0.2,
                              borderRadius: 1,
                              fontSize: '0.68rem',
                              fontWeight: 800,
                              bgcolor: cfg.bg,
                              color: cfg.color,
                              border: `1px solid ${cfg.border}`
                            }}
                          >
                            {cfg.label}
                          </Box>
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.78rem' }}>
                          {plazo.completado ? (
                            <Box>
                              <Button
                                component="a"
                                href={plazo.documentoProbatorioUrl}
                                target="_blank"
                                rel="noopener"
                                variant="text"
                                size="small"
                                startIcon={<File size={13} />}
                                sx={{
                                  textTransform: 'none',
                                  p: 0,
                                  fontSize: '0.76rem',
                                  fontWeight: 700,
                                  justifyContent: 'flex-start'
                                }}
                              >
                                {plazo.documentoProbatorioNombre || 'Ver Comprobante'}
                              </Button>
                              {plazo.documentoProbatorioDescripcion && (
                                <Typography sx={{ fontSize: '0.7rem', color: '#64748b' }}>
                                  {plazo.documentoProbatorioDescripcion}
                                </Typography>
                              )}
                            </Box>
                          ) : (
                            <Typography sx={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                              Pendiente de presentación
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.75 }}>
                            {!plazo.completado ? (
                              <Button
                                variant="outlined"
                                color="success"
                                size="small"
                                onClick={() => {
                                  setPlazoAActivar(plazo);
                                  setOpenCerrarModal(true);
                                }}
                                sx={{
                                  textTransform: 'none',
                                  fontWeight: 700,
                                  fontSize: '0.72rem',
                                  borderRadius: 1.5,
                                  py: 0.25
                                }}
                              >
                                Acreditar Cierre
                              </Button>
                            ) : (
                              <Typography sx={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>
                                Cumplido
                              </Typography>
                            )}
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleEliminarPlazo(plazo.id)}
                              sx={{ p: 0.4 }}
                            >
                              <Trash2 size={14} />
                            </IconButton>
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      </TabPanel>

      {/* PESTAÑA 5: COMUNICADOS ENVIADOS (BITÁCORA DE MAILING MASIVO) */}
      <TabPanel value={activeTab} index={4}>
        <Paper
          sx={{
            p: { xs: 2, sm: 2.5 },
            borderRadius: 3,
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)'
          }}
        >
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              justifyContent: 'space-between',
              alignItems: { xs: 'flex-start', sm: 'center' },
              gap: 1.5,
              mb: 2
            }}
          >
            <Box>
              <Typography sx={{ fontSize: '0.96rem', fontWeight: 800, color: '#0f172a' }}>
                Historial de Comunicados Masivos
              </Typography>
              <Typography sx={{ fontSize: '0.76rem', color: '#64748b' }}>
                Haz clic en cualquier comunicado para desplegar el cuerpo del mensaje, adjuntos y acuses de lectura.
              </Typography>
            </Box>
            <Button
              variant="contained"
              size="small"
              startIcon={<Plus size={15} />}
              onClick={() => {
                setClientesSeleccionadosIds([]);
                setFiltroDestinatarios('');
                setTipoDestinatario('todos');
                setOpenComunicadoModal(true);
              }}
              sx={{
                textTransform: 'none',
                borderRadius: 1.75,
                fontWeight: 700,
                fontSize: '0.78rem',
                bgcolor: '#0f172a',
                boxShadow: 'none',
                '&:hover': { bgcolor: '#1e293b', boxShadow: 'none' }
              }}
            >
              Redactar Comunicado
            </Button>
          </Box>

          {loadingComunicados ? (
            <Box sx={{ py: 3, textAlign: 'center' }}>
              <CircularProgress size={26} />
            </Box>
          ) : comunicados.length === 0 ? (
            <Box
              sx={{
                py: 4,
                textAlign: 'center',
                bgcolor: '#f8fafc',
                borderRadius: 2,
                border: '1px dashed #cbd5e1'
              }}
            >
              <Typography sx={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>
                No se registran comunicados masivos enviados para este litigio.
              </Typography>
            </Box>
          ) : (
            <List disablePadding>
              {comunicados.map((c) => (
                <ItemComunicadoMasivo
                  key={c.id}
                  c={c}
                  casoId={caso.id}
                  clientes={clientes}
                  onVerCliente={(id) => setClienteSeleccionadoId(id)}
                />
              ))}
            </List>
          )}
        </Paper>
      </TabPanel>

      {/* PESTAÑA 6: COPILOTO JURÍDICO PIDA ADAPTATIVO (NACIONAL LATAM / INTERNACIONAL SIDH-ONU) */}
      <TabPanel value={activeTab} index={5}>
        <Paper
          sx={{
            p: { xs: 2, sm: 2.5 },
            borderRadius: 3,
            border: '1px solid #e2e8f0',
            bgcolor: '#ffffff',
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)'
          }}
        >
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', md: 'row' },
              justifyContent: 'space-between',
              alignItems: { xs: 'flex-start', md: 'center' },
              gap: 1.5,
              mb: 2.25
            }}
          >
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25, flexWrap: 'wrap' }}>
                <Sparkles size={18} color="#4338ca" />
                <Typography sx={{ fontSize: '0.98rem', fontWeight: 800, color: '#0f172a' }}>
                  PIDA — Copiloto Jurídico{' '}
                  {perfilJurisdiccional.esInternacional
                    ? 'Internacional (SIDH / ONU)'
                    : `Nacional (${perfilJurisdiccional.pais.bandera} ${perfilJurisdiccional.pais.nombre})`}
                </Typography>
              </Box>
              <Typography sx={{ fontSize: '0.76rem', color: '#64748b' }}>
                {perfilJurisdiccional.esInternacional
                  ? 'Sistema de Inteligencia Jurídica en el Sistema Interamericano (CIDH / Corte IDH) y Sistema Universal ONU, conectado al expediente.'
                  : `Sistema de Inteligencia Jurídica adaptado a la jurisdicción interna de ${perfilJurisdiccional.pais.nombre} (${casoLocal.jurisdiccion || 'Vía Interna'}), con Control de Convencionalidad integrado.`}
              </Typography>
            </Box>

            <Box
              component="span"
              sx={{
                px: 1.25,
                py: 0.45,
                borderRadius: 1.5,
                fontSize: '0.72rem',
                fontWeight: 800,
                bgcolor: '#eef2ff',
                color: '#312e81',
                border: '1px solid #c7d2fe'
              }}
            >
              PIDA ·{' '}
              {perfilJurisdiccional.esInternacional
                ? 'Modo Internacional SIDH/ONU'
                : `Modo Nacional ${perfilJurisdiccional.pais.codigo}`}
            </Box>
          </Box>

          {/* Plantillas Jurídicas de 1 Clic Adaptativas según Jurisdicción */}
          <Typography
            sx={{
              fontSize: '0.68rem',
              fontWeight: 800,
              color: '#64748b',
              display: 'block',
              mb: 1,
              textTransform: 'uppercase',
              letterSpacing: '0.04em'
            }}
          >
            Generadores Estratégicos de 1 Clic (
            {perfilJurisdiccional.esInternacional
              ? 'Estándares SIDH / ONU'
              : `Derecho Procesal de ${perfilJurisdiccional.pais.nombre} + Control de Convencionalidad`}
            )
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' },
              gap: 1,
              mb: 2.25
            }}
          >
            {(perfilJurisdiccional.esInternacional
              ? [
                  {
                    titulo: 'Test de Admisibilidad (Arts. 46-47 CADH)',
                    sub: 'Agotamiento o excepciones Art. 46.2 CADH',
                    prompt:
                      'Elabora un análisis exhaustivo de admisibilidad ante la CIDH (Arts. 46 y 47 CADH y Arts. 31-34 del Reglamento CIDH), evaluando agotamiento de recursos internos o las excepciones del Art. 46.2 CADH aplicables a este caso, plazo o situación continuada y caracterización (colorable claim).'
                  },
                  {
                    titulo: 'Estándares y Jurisprudencia Corte IDH',
                    sub: 'Leading cases y subsunción normativa',
                    prompt:
                      'Construye una matriz de estándares jurisprudenciales de la Corte IDH aplicables a los derechos invocados en este caso, citando casos contenciosos líderes (leading cases) y cómo subsumir los hechos del expediente en dichos estándares.'
                  },
                  {
                    titulo: 'Medidas Cautelares (Art. 25 CIDH)',
                    sub: 'Gravedad, urgencia e irreparabilidad',
                    prompt:
                      'Redacta la estructura argumentativa para una solicitud de Medidas Cautelares (Art. 25 Reglamento CIDH) o Medidas Provisionales (Art. 63.2 CADH), acreditando gravedad, urgencia e irreparabilidad del daño.'
                  },
                  {
                    titulo: 'Tramitación Prioritaria (Art. 29.2 CIDH)',
                    sub: 'Adelanto de estudio por vulnerabilidad',
                    prompt:
                      'Redacta un escrito fundamentado solicitando el adelanto de estudio / tramitación prioritaria conforme al Artículo 29.2 del Reglamento de la CIDH, destacando las condiciones de vulnerabilidad del padrón de víctimas.'
                  },
                  {
                    titulo: 'Pretensiones y Reparaciones (Art. 63.1 CADH)',
                    sub: 'Restitución, rehabilitación y no repetición',
                    prompt:
                      'Diseña el pliego integral de reparaciones bajo el Art. 63.1 de la CADH para el ESAP o alegatos de fondo: restitución, rehabilitación, satisfacción, garantías de no repetición y criterios de daño material e inmaterial.'
                  },
                  {
                    titulo: 'Ruta de Solución Amistosa (Art. 40 CIDH)',
                    sub: 'Cláusulas esenciales y supervisión',
                    prompt:
                      'Propón una hoja de ruta estratégica y cláusulas esenciales para negociar un Acuerdo de Solución Amistosa (Art. 40 Reglamento CIDH) con el Estado demandado garantizando supervisión internacional.'
                  }
                ]
              : [
                  {
                    titulo: `Legitimación y Admisibilidad (${perfilJurisdiccional.pais.codigo})`,
                    sub: 'Personería, competencia y caducidad',
                    prompt: `Elabora un examen riguroso de legitimación activa, personería judicial (${perfilJurisdiccional.pais.requisitoPoderNacional}), competencia, agotamiento de vía administrativa previa (si aplica) y plazos de prescripción o caducidad conforme al derecho procesal de ${perfilJurisdiccional.pais.nombre} para la vía "${casoLocal.jurisdiccion}".`
                  },
                  {
                    titulo: `Estructura de Demanda / Acción (${perfilJurisdiccional.pais.nombre})`,
                    sub: 'Agravios principales y fundamentación',
                    prompt: `Redacta la estructura formal y los agravios principales de la demanda o acción constitucional en ${perfilJurisdiccional.pais.nombre} ante ${perfilJurisdiccional.pais.organoConstitucional} o ${perfilJurisdiccional.pais.organoContencioso}, integrando las normas nacionales invocadas.`
                  },
                  {
                    titulo: 'Medida Cautelar / Suspensión del Acto',
                    sub: 'Fumus boni iuris y periculum in mora',
                    prompt: `Redacta una solicitud fundamentada de Medida Cautelar o Suspensión Provisional del acto impugnado conforme a la legislación procesal de ${perfilJurisdiccional.pais.nombre}, acreditando apariencia de buen derecho (fumus boni iuris), peligro en la demora (periculum in mora) y ponderación del interés público.`
                  },
                  {
                    titulo: 'Control de Convencionalidad en Sede Nacional',
                    sub: 'Bloque de constitucionalidad y Corte IDH',
                    prompt: `Formula un capítulo de Control de Convencionalidad interno dirigido a los jueces nacionales de ${perfilJurisdiccional.pais.nombre}, explicando cómo el bloque de constitucionalidad y la jurisprudencia vinculante de la Corte IDH obligan a proteger los derechos reclamados en este expediente.`
                  },
                  {
                    titulo: 'Pliego de Pretensiones, Daños y Costas',
                    sub: 'Petitorio principal y subsidiario',
                    prompt: `Diseña el petitorio / pliego de pretensiones principales y subsidiarias para este litigio en ${perfilJurisdiccional.pais.nombre}, incluyendo nulidad de actuaciones, restablecimiento de derechos, liquidación de daños materiales/morales y condenatoria en costas.`
                  },
                  {
                    titulo: 'Hoja de Ruta de Agotamiento (Puente a CIDH)',
                    sub: 'Preparación del requisito Art. 46.1.a CADH',
                    prompt: `Evalúa qué recursos ordinarios y extraordinarios deben interponerse y agotarse en ${perfilJurisdiccional.pais.nombre} dentro de este proceso para dejar debidamente preparado el requisito del Art. 46.1.a de la CADH (o acreditar una excepción del Art. 46.2 CADH) en caso de que sea necesario escalar ulteriormente ante la CIDH.`
                  }
                ]
            ).map((item) => (
              <Box
                key={item.titulo}
                component="button"
                type="button"
                disabled={ejecutandoCopilotoIA}
                onClick={() => {
                  setConsultaCopilotoIA(item.prompt);
                  handleEjecutarCopilotoIA(item.prompt);
                }}
                sx={{
                  textAlign: 'left',
                  p: 1.35,
                  borderRadius: 2,
                  bgcolor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  cursor: ejecutandoCopilotoIA ? 'not-allowed' : 'pointer',
                  transition: 'all 0.16s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 0.25,
                  '&:hover': {
                    bgcolor: '#eef2ff',
                    borderColor: '#a5b4fc',
                    transform: 'translateY(-1px)'
                  }
                }}
              >
                <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: '#0f172a' }}>
                  {item.titulo}
                </Typography>
                <Typography sx={{ fontSize: '0.68rem', color: '#64748b' }}>
                  {item.sub}
                </Typography>
              </Box>
            ))}
          </Box>

          {/* Caja de Consulta Libre */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, mb: 2.5 }}>
            <TextField
              fullWidth
              multiline
              rows={2}
              size="small"
              label="Consulta jurídica libre o instrucción de redacción procesal para PIDA"
              placeholder={
                perfilJurisdiccional.esInternacional
                  ? 'Ej: Redacta los puntos petitorios para el Escrito de Solicitudes, Argumentos y Pruebas (ESAP)...'
                  : `Ej: Redacta los agravios de inconstitucionalidad / nulidad conforme a la legislación de ${perfilJurisdiccional.pais.nombre}...`
              }
              value={consultaCopilotoIA}
              onChange={(e) => setConsultaCopilotoIA(e.target.value)}
              sx={{ bgcolor: '#f8fafc' }}
            />
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="contained"
                size="small"
                startIcon={
                  ejecutandoCopilotoIA ? (
                    <CircularProgress size={14} color="inherit" />
                  ) : (
                    <Sparkles size={15} />
                  )
                }
                disabled={ejecutandoCopilotoIA || !consultaCopilotoIA.trim()}
                onClick={() => handleEjecutarCopilotoIA()}
                sx={{
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  borderRadius: 1.75,
                  px: 2.5,
                  py: 0.85,
                  color: '#ffffff',
                  bgcolor: '#0f172a',
                  boxShadow: 'none',
                  '&:hover': { bgcolor: '#1e293b', boxShadow: 'none' },
                  '&.Mui-disabled': {
                    bgcolor: '#e2e8f0',
                    color: '#64748b'
                  }
                }}
              >
                {ejecutandoCopilotoIA
                  ? 'PIDA está elaborando el dictamen jurídico...'
                  : 'Ejecutar Análisis con PIDA'}
              </Button>
            </Box>
          </Box>

          {/* Resultado del Copiloto Jurídico PIDA con Formato Editorial, Copia Rica, Drive, Word y PDF */}
          {respuestaCopilotoIA && (
            <Paper
              sx={{
                p: { xs: 2, sm: 3 },
                borderRadius: 2.5,
                bgcolor: '#ffffff',
                border: '1px solid #cbd5e1',
                boxShadow: '0 4px 20px rgba(15, 23, 42, 0.05)'
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 1.25,
                  mb: 2,
                  pb: 1.25,
                  borderBottom: '1px solid #e2e8f0'
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Box
                    component="span"
                    sx={{
                      px: 1,
                      py: 0.3,
                      borderRadius: 1,
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      bgcolor: '#0f172a',
                      color: '#ffffff'
                    }}
                  >
                    PIDA · Dictamen Jurídico ({perfilJurisdiccional.normaCorto})
                  </Box>
                  <Typography sx={{ fontSize: '0.72rem', color: '#64748b' }}>
                    Generado el {respuestaCopilotoIA.fecha}
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={async () => {
                      await copiarDictamenConFormato({
                        markdown: respuestaCopilotoIA.text,
                        titulo: 'Dictamen Jurídico PIDA',
                        caso: casoLocal
                      });
                      alert(
                        '✅ Dictamen copiado con formato enriquecido (listo para pegar en Word, Google Docs o Correo).'
                      );
                    }}
                    sx={{
                      textTransform: 'none',
                      fontWeight: 700,
                      fontSize: '0.74rem',
                      borderRadius: 1.5,
                      borderColor: '#cbd5e1',
                      color: '#334155'
                    }}
                  >
                    Copiar
                  </Button>

                  <Button
                    size="small"
                    variant="outlined"
                    disabled={guardandoEnDrivePida}
                    onClick={async () => {
                      setGuardandoEnDrivePida(true);
                      setEnlaceDriveGuardado(null);
                      try {
                        const docDrive = await guardarDictamenEnGoogleDrive({
                          markdown: respuestaCopilotoIA.text,
                          titulo: 'Dictamen Jurídico PIDA',
                          caso: casoLocal,
                          userEmail: currentUserEmail
                        });
                        setEnlaceDriveGuardado(docDrive);
                      } catch (errDrive) {
                        setError(`Error al guardar en Google Drive: ${errDrive.message}`);
                      } finally {
                        setGuardandoEnDrivePida(false);
                      }
                    }}
                    sx={{
                      textTransform: 'none',
                      fontWeight: 700,
                      fontSize: '0.74rem',
                      borderRadius: 1.5,
                      borderColor: '#cbd5e1',
                      color: '#334155'
                    }}
                  >
                    {guardandoEnDrivePida ? 'Guardando...' : 'Guardar en Drive'}
                  </Button>

                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() =>
                      descargarDictamenWord({
                        markdown: respuestaCopilotoIA.text,
                        titulo: 'Dictamen_Juridico_PIDA',
                        caso: casoLocal
                      })
                    }
                    sx={{
                      textTransform: 'none',
                      fontWeight: 700,
                      fontSize: '0.74rem',
                      borderRadius: 1.5,
                      borderColor: '#cbd5e1',
                      color: '#334155'
                    }}
                  >
                    Word (.doc)
                  </Button>

                  <Button
                    size="small"
                    variant="contained"
                    onClick={() =>
                      descargarDictamenPDF({
                        markdown: respuestaCopilotoIA.text,
                        titulo: 'Dictamen Jurídico PIDA',
                        caso: casoLocal
                      })
                    }
                    sx={{
                      textTransform: 'none',
                      fontWeight: 700,
                      fontSize: '0.74rem',
                      borderRadius: 1.5,
                      bgcolor: '#0f172a',
                      color: '#ffffff',
                      boxShadow: 'none',
                      '&:hover': { bgcolor: '#1e293b', boxShadow: 'none' }
                    }}
                  >
                    Descargar PDF
                  </Button>
                </Box>
              </Box>

              {enlaceDriveGuardado && (
                <Alert
                  severity="success"
                  sx={{ mb: 2, borderRadius: 2 }}
                  onClose={() => setEnlaceDriveGuardado(null)}
                  action={
                    <Button
                      color="inherit"
                      size="small"
                      component="a"
                      href={enlaceDriveGuardado.webViewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{ fontWeight: 'bold', textTransform: 'none' }}
                    >
                      Abrir en Google Docs ↗
                    </Button>
                  }
                >
                  Guardado en tu Google Drive como <strong>{enlaceDriveGuardado.name}</strong>.
                </Alert>
              )}

              <Box
                sx={{
                  fontFamily: '"Georgia", "Times New Roman", serif',
                  fontSize: '0.95rem',
                  lineHeight: 1.75,
                  color: '#1e293b',
                  px: { xs: 0.5, sm: 1 }
                }}
                dangerouslySetInnerHTML={{
                  __html: convertirMarkdownAHtmlJuridico(respuestaCopilotoIA.text)
                }}
              />
            </Paper>
          )}
        </Paper>
      </TabPanel>

      {/* MODAL: PUENTE DE AGOTAMIENTO DE VÍA INTERNA Y ESCALAMIENTO A INSTANCIA INTERNACIONAL (CIDH / ONU) */}
      <Dialog
        open={openEscalarModal}
        onClose={() => !procesandoEscalamiento && setOpenEscalarModal(false)}
        fullWidth
        maxWidth="sm"
        slotProps={{
          paper: {
            component: 'form',
            onSubmit: handleEscalarACIDH,
            sx: { borderRadius: 3, m: { xs: 1.5, sm: 3 } }
          }
        }}
      >
        <DialogTitle fontWeight="bold">
          🌐 Agotamiento de Vía Interna en {perfilJurisdiccional.pais.nombre} y Transición a CIDH / ONU
        </DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Alert severity="info" sx={{ borderRadius: 2 }}>
            Registra la notificación de la sentencia definitiva de última instancia en{' '}
            <strong>{perfilJurisdiccional.pais.nombre}</strong>. El sistema calculará automáticamente el{' '}
            <strong>Plazo Fatal Convencional de 6 Meses (Art. 46.1.b CADH)</strong>, lo agendará en el Calendario
            Institucional y conservará íntegro el padrón de representados y sus poderes.
          </Alert>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            <TextField
              label="Fecha Notificación Sentencia Firme"
              type="date"
              required
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
              value={fechaNotificacionSentenciaInterna}
              onChange={(e) => setFechaNotificacionSentenciaInterna(e.target.value)}
            />

            <FormControl fullWidth>
              <InputLabel>Foro Internacional de Destino</InputLabel>
              <Select
                value={organoInternacionalDestino}
                label="Foro Internacional de Destino"
                onChange={(e) => setOrganoInternacionalDestino(e.target.value)}
              >
                {VIAS_INTERNACIONALES.map((via) => (
                  <MenuItem key={via} value={via}>
                    {via}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          <TextField
            label="Resolución / Sentencia que Agotó la Jurisdicción Interna"
            fullWidth
            placeholder={`Ej: Sentencia definitiva de ${perfilJurisdiccional.pais.organoConstitucional} / Casación`}
            value={resolucionAgotamientoRef}
            onChange={(e) => setResolucionAgotamientoRef(e.target.value)}
          />

          <FormControlLabel
            control={
              <Checkbox
                checked={cambiarAmbitoAInternacional}
                onChange={(e) => setCambiarAmbitoAInternacional(e.target.checked)}
              />
            }
            label={
              <Typography variant="body2" fontWeight="medium">
                Cambiar inmediatamente el ámbito de este expediente a <strong>Internacional ({organoInternacionalDestino})</strong> y activar el estándar Art. 35 SIDH
              </Typography>
            }
          />
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button
            onClick={() => setOpenEscalarModal(false)}
            color="inherit"
            disabled={procesandoEscalamiento}
            sx={{ textTransform: 'none' }}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={procesandoEscalamiento}
            sx={{ textTransform: 'none', fontWeight: 'bold' }}
          >
            {procesandoEscalamiento ? 'Calculando y Registrando...' : 'Registrar Agotamiento y Plazo de 6 Meses'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* MODAL DE AGREGAR CLIENTE EXTENDIDO + AUTOCOMPLETADO OCR PIDA */}
      <Dialog 
        open={openModal} 
        onClose={() => setOpenModal(false)} 
        fullWidth 
        maxWidth="sm" 
        disableEnforceFocus
        disableRestoreFocus
        slotProps={{ 
          paper: { 
            component: 'form',
            onSubmit: handleCreateCliente,
            sx: { borderRadius: 3, m: { xs: 1.5, sm: 3 } } 
          } 
        }}
      >
        <DialogTitle fontWeight="bold" sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
          <span>Nueva Ficha de Representado</span>
          <Button
            size="small"
            variant="outlined"
            component="label"
            startIcon={autocompletandoOcrCliente ? <CircularProgress size={14} /> : <Sparkles size={15} />}
            disabled={autocompletandoOcrCliente}
            sx={{ textTransform: 'none', fontWeight: 'bold', borderRadius: 2 }}
          >
            {autocompletandoOcrCliente ? 'Extrayendo con PIDA...' : '✨ Autocompletar con PIDA (Cédula/Pasaporte)'}
            <input type="file" accept="application/pdf,image/*" hidden onChange={handleAutocompletarClienteConOcrIA} />
          </Button>
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mb: 2.5 }}>
            <TextField label="Nombres" autoFocus required fullWidth value={nombres} onChange={(e) => setNombres(e.target.value)} />
            <TextField label="Apellidos" required fullWidth value={apellidos} onChange={(e) => setApellidos(e.target.value)} />
          </Box>
          
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mb: 2.5 }}>
            <FormControl fullWidth>
              <InputLabel>Tipo Identificación</InputLabel>
              <Select value={tipoIdentificacion} label="Tipo Identificación" onChange={(e) => setTipoIdentificacion(e.target.value)}>
                {DOC_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField label="Número de Identificación" required fullWidth value={identificacion} onChange={(e) => setIdentificacion(e.target.value)} />
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mb: 2.5 }}>
            <FormControl fullWidth>
              <InputLabel>
                {perfilJurisdiccional.esInternacional ? 'Calidad Procesal (SIDH)' : 'Calidad Procesal (Actor / Accionante)'}
              </InputLabel>
              <Select
                value={calidadProcesalInput}
                label={perfilJurisdiccional.esInternacional ? 'Calidad Procesal (SIDH)' : 'Calidad Procesal (Actor / Accionante)'}
                onChange={(e) => setCalidadProcesalInput(e.target.value)}
              >
                {CALIDADES_PROCESALES.map((cal) => <MenuItem key={cal} value={cal}>{cal}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>
                {perfilJurisdiccional.esInternacional ? 'Vulnerabilidad (Art. 29.2 CIDH)' : 'Vulnerabilidad / Trámite Preferente'}
              </InputLabel>
              <Select
                value={vulnerabilidadInput}
                label={perfilJurisdiccional.esInternacional ? 'Vulnerabilidad (Art. 29.2 CIDH)' : 'Vulnerabilidad / Trámite Preferente'}
                onChange={(e) => setVulnerabilidadInput(e.target.value)}
              >
                {CONDICIONES_VULNERABILIDAD.map((cond) => <MenuItem key={cond} value={cond}>{cond}</MenuItem>)}
              </Select>
            </FormControl>
          </Box>
          
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mb: 2.5 }}>
            <FormControl fullWidth>
              <InputLabel>País de Residencia</InputLabel>
              <Select 
                value={pais} 
                label="País de Residencia" 
                onChange={(e) => { 
                  setPais(e.target.value); 
                  const c = COUNTRIES.find(x => x.name === e.target.value); 
                  if (c) setCodigoTelefonoPrincipal(c.phone); 
                }}
              >
                {COUNTRIES.map(c => <MenuItem key={c.code} value={c.name}>{c.name}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField label="Email Principal" type="email" required fullWidth value={correoPrincipal} onChange={(e) => setCorreoPrincipal(e.target.value)} />
          </Box>
          
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '140px 1fr' }, gap: 2, mb: 2.5 }}>
            <FormControl fullWidth>
              <InputLabel>Código</InputLabel>
              <Select value={codigoTelefonoPrincipal} label="Código" onChange={(e) => setCodigoTelefonoPrincipal(e.target.value)}>
                {COUNTRIES.map(c => <MenuItem key={c.code} value={c.phone}>{`${c.code} (${c.phone})`}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField label="Número Telefónico Principal" fullWidth value={telefonoPrincipal} onChange={(e) => setTelefonoPrincipal(e.target.value)} />
          </Box>
          
          <Box sx={{ mb: 2 }}>
            <TextField label="Dirección Física Completa" fullWidth multiline rows={2} value={direccion} onChange={(e) => setDireccion(e.target.value)} />
          </Box>

          <Alert severity="info" sx={{ mb: 2, py: 0.5, fontSize: '0.78rem' }}>
            El Semáforo de Acreditación ({perfilJurisdiccional.normaCorto}: Poder, Cédula/ID y Prueba) se activa en verde automáticamente al subir y verificar los documentos con PIDA.
          </Alert>
          
          <TextField label="Notas Jurídicas Iniciales" fullWidth multiline rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} />
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setOpenModal(false)} color="inherit">Cancelar</Button>
          <Button type="submit" variant="contained">Registrar en el Caso</Button>
        </DialogActions>
      </Dialog>

      {/* MODAL: CARGAR PLAZO + SINCRONIZACIÓN CALENDARIO */}
      <Dialog 
        open={openPlazoModal} 
        onClose={() => setOpenPlazoModal(false)} 
        fullWidth 
        maxWidth="xs" 
        disableEnforceFocus
        disableRestoreFocus
        slotProps={{ 
          paper: { 
            component: 'form',
            onSubmit: handleBoxAgregarPlazo,
            sx: { borderRadius: 3 } 
          } 
        }}
      >
        <DialogTitle fontWeight="bold">Cargar Término Procesal / Fecha Fatal</DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField label="Descripción del Término (Ej: Presentar ESAP / Observaciones)" autoFocus fullWidth required value={descripcionPlazo} onChange={e => setDescripcionPlazo(e.target.value)} />
          <TextField label="Fecha Límite Judicial (Fecha Fatal)" type="date" fullWidth required slotProps={{ inputLabel: { shrink: true } }} value={fechaFatalInput} onChange={e => setFechaFatalInput(e.target.value)} />
          <TextField label="Abogado(a) Responsable" fullWidth value={responsablePlazoInput} onChange={e => setResponsablePlazoInput(e.target.value)} />
          <TextField label="Nota de Prórroga / Observación" fullWidth value={prorrogaPlazoInput} onChange={e => setProrrogaPlazoInput(e.target.value)} />
          <FormControlLabel
            control={
              <Checkbox
                checked={sincronizarCalendarioInput}
                onChange={(e) => setSincronizarCalendarioInput(e.target.checked)}
              />
            }
            label={<Typography variant="caption" fontWeight="bold">📅 Sincronizar automáticamente con Calendario Institucional</Typography>}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setOpenPlazoModal(false)} color="inherit" sx={{ textTransform: 'none' }}>Cancelar</Button>
          <Button type="submit" variant="contained" sx={{ textTransform: 'none', fontWeight: 'bold' }}>Cargar Término</Button>
        </DialogActions>
      </Dialog>

      {/* MODAL INTERMEDIO: INGRESO DE METADATOS PARA EL DOCUMENTO COMÚN */}
      <Dialog 
        open={openUploadModal} 
        onClose={() => { if (!uploadingDoc) { setOpenUploadModal(false); setFileComunSeleccionado(null); } }} 
        fullWidth 
        maxWidth="xs" 
        disableEnforceFocus
        disableRestoreFocus
        slotProps={{ 
          paper: { 
            component: 'form',
            onSubmit: handleConfirmarSubidaComun,
            sx: { borderRadius: 3 } 
          } 
        }}
      >
        <DialogTitle fontWeight="bold">Metadatos de la Pieza Procesal</DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <Typography variant="body2" color="text.secondary">
            Archivo detectado: <strong>{fileComunSeleccionado?.name}</strong>
          </Typography>
          <FormControl fullWidth>
            <InputLabel>Categoría Procesal</InputLabel>
            <Select value={categoriaComun} label="Categoría Procesal" onChange={(e) => setCategoriaComun(e.target.value)}>
              {CATEGORIAS_DOCUMENTOS_PROCESALES.map((cat) => (
                <MenuItem key={cat} value={cat}>{cat}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField label="Número de Anexo (Opcional, ej. 1 o A-1)" fullWidth value={anexoNumeroComun} onChange={e => setAnexoNumeroComun(e.target.value)} />
          <TextField label="Descripción Material del Documento" autoFocus fullWidth required value={descripcionComun} onChange={e => setDescripcionComun(e.target.value)} />
          <TextField label="Fecha de Emisión del Documento" type="date" fullWidth required slotProps={{ inputLabel: { shrink: true } }} value={fechaDocumentoComun} onChange={e => setFechaDocumentoComun(e.target.value)} />
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => { setOpenUploadModal(false); setFileComunSeleccionado(null); }} color="inherit" sx={{ textTransform: 'none' }}>Cancelar</Button>
          <Button type="submit" variant="contained" sx={{ textTransform: 'none', fontWeight: 'bold' }}>Subir Documento</Button>
        </DialogActions>
      </Dialog>

      {/* MODAL: VINCULAR DOCUMENTO DESDE GOOGLE DRIVE */}
      <Dialog
        open={openDriveLinkModal}
        onClose={() => setOpenDriveLinkModal(false)}
        fullWidth
        maxWidth="xs"
        slotProps={{
          paper: {
            component: 'form',
            onSubmit: handleVincularDriveDoc,
            sx: { borderRadius: 3 }
          }
        }}
      >
        <DialogTitle fontWeight="bold">Vincular Pieza o Anexo desde Google Drive</DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Nombre del Documento / Pieza"
            required
            fullWidth
            value={driveDocNombre}
            onChange={(e) => setDriveDocNombre(e.target.value)}
          />
          <TextField
            label="Enlace de Google Drive (URL)"
            required
            fullWidth
            placeholder="https://drive.google.com/..."
            value={driveDocUrl}
            onChange={(e) => setDriveDocUrl(e.target.value)}
          />
          <FormControl fullWidth>
            <InputLabel>Categoría Procesal</InputLabel>
            <Select value={driveDocCategoria} label="Categoría Procesal" onChange={(e) => setDriveDocCategoria(e.target.value)}>
              {CATEGORIAS_DOCUMENTOS_PROCESALES.map((cat) => (
                <MenuItem key={cat} value={cat}>{cat}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="N° de Anexo (Opcional)"
            fullWidth
            value={driveDocAnexo}
            onChange={(e) => setDriveDocAnexo(e.target.value)}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setOpenDriveLinkModal(false)} color="inherit" sx={{ textTransform: 'none' }}>
            Cancelar
          </Button>
          <Button type="submit" variant="contained" sx={{ textTransform: 'none', fontWeight: 'bold' }}>
            Vincular al Expediente
          </Button>
        </DialogActions>
      </Dialog>

      {/* MODAL: RESOLVER PLAZO CON ARCHIVO PROBATORIO Y METADATOS OBLIGATORIOS */}
      <Dialog 
        open={openCerrarModal} 
        onClose={() => { if (!uploadingPlazoDoc) { setOpenCerrarModal(false); setFileProbatorio(null); } }} 
        fullWidth 
        maxWidth="xs" 
        disableEnforceFocus
        disableRestoreFocus
        slotProps={{ 
          paper: { 
            component: 'form',
            onSubmit: handleConfirmarCierrePlazo,
            sx: { borderRadius: 3 } 
          } 
        }}
      >
        <DialogTitle fontWeight="bold">Subsanar y Cargar Documento Probatorio</DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <Typography variant="body2" color="text.secondary">
            Para dar por solventado este plazo ante instancias internacionales, debe anexar obligatoriamente el documento sustentatorio en formato digital.
          </Typography>
          
          <Button 
            variant="outlined" 
            component="label" 
            startIcon={<Upload size={18} />} 
            disabled={uploadingPlazoDoc} 
            fullWidth
            sx={{ textTransform: 'none', borderRadius: 2, fontWeight: 'bold', py: 1.5, mb: 1 }}
          >
            {fileProbatorio ? fileProbatorio.name : 'Seleccionar Documento Probatorio'}
            <input type="file" accept="application/pdf,image/*" hidden required onChange={(e) => setFileProbatorio(e.target.files[0])} />
          </Button>

          <TextField label="Descripción Completa de la Prueba" autoFocus fullWidth required disabled={uploadingPlazoDoc} value={descripcionProbatorio} onChange={e => setDescripcionProbatorio(e.target.value)} />
          <TextField label="Fecha de Emisión de la Prueba" type="date" fullWidth required disabled={uploadingPlazoDoc} slotProps={{ inputLabel: { shrink: true } }} value={fechaDocumentoProbatorio} onChange={e => setFechaDocumentoProbatorio(e.target.value)} />

          {uploadingPlazoDoc && (
            <Box sx={{ width: '100%', mt: 1 }}>
              <LinearProgress variant="determinate" value={uploadProgressPlazoDoc} />
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 0.5 }}>
                Subiendo archivo... {uploadProgressPlazoDoc}%
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => { setOpenCerrarModal(false); setFileProbatorio(null); }} color="inherit" sx={{ textTransform: 'none' }} disabled={uploadingPlazoDoc}>Abortar</Button>
          <Button type="submit" variant="contained" color="success" sx={{ textTransform: 'none', fontWeight: 'bold' }} disabled={uploadingPlazoDoc || !fileProbatorio}>
            {uploadingPlazoDoc ? 'Procesando...' : 'Registrar Presentación'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* MODAL: REDACTAR COMUNICADO MASIVO O SELECTIVO + REDACTOR IA EN LENGUAJE CLARO */}
      <Dialog 
        open={openComunicadoModal} 
        onClose={() => { if (!uploadingComunicado) { setOpenComunicadoModal(false); setFileComunicado(null); } }} 
        fullWidth 
        maxWidth="sm" 
        disableEnforceFocus
        disableRestoreFocus
        slotProps={{ 
          paper: { 
            component: 'form',
            onSubmit: handleCreateComunicado,
            sx: { borderRadius: 3 } 
          } 
        }}
      >
        <DialogTitle fontWeight="bold">Redactar y Registrar Comunicado Oficial</DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          {/* Asistente PIDA de Redacción en Lenguaje Claro */}
          <Box sx={{ p: 2, bgcolor: '#eef2ff', borderRadius: 2, border: '1px solid #c7d2fe' }}>
            <Typography variant="caption" fontWeight="bold" color="#312e81" sx={{ display: 'block', mb: 1 }}>
              ✨ Redactor PIDA de Circulares en Lenguaje Claro
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1, mb: 1 }}>
              <FormControl size="small" fullWidth sx={{ bgcolor: '#ffffff' }}>
                <InputLabel>Tipo de Circular</InputLabel>
                <Select
                  value={plantillaComunicadoIA}
                  label="Tipo de Circular"
                  onChange={(e) => setPlantillaComunicadoIA(e.target.value)}
                >
                  <MenuItem value="actualizacion_procesal">Actualización de Etapa Procesal</MenuItem>
                  <MenuItem value="subsanacion_poder_id">Solicitud Urgente de Poder / Cédula (Art. 35)</MenuItem>
                  <MenuItem value="convocatoria_reunion">Convocatoria a Asamblea / Google Meet</MenuItem>
                  <MenuItem value="recordatorio_aporte">Recordatorio de Aporte / Conciliación</MenuItem>
                </Select>
              </FormControl>
              <TextField
                size="small"
                placeholder="Instrucción opcional para PIDA..."
                value={instruccionComunicadoIA}
                onChange={(e) => setInstruccionComunicadoIA(e.target.value)}
                sx={{ bgcolor: '#ffffff' }}
              />
            </Box>
            <Button
              size="small"
              variant="contained"
              startIcon={redactandoComunicadoIA ? <CircularProgress size={14} color="inherit" /> : <Sparkles size={14} />}
              disabled={redactandoComunicadoIA}
              onClick={handleRedactarComunicadoIA}
              sx={{ textTransform: 'none', fontWeight: 'bold', borderRadius: 1.5 }}
            >
              {redactandoComunicadoIA ? 'PIDA está redactando...' : 'Generar Borrador con PIDA'}
            </Button>
          </Box>
          
          <TextField label="Asunto del Correo / Comunicado" autoFocus fullWidth required disabled={uploadingComunicado} value={asuntoComunicado} onChange={e => setAsuntoComunicado(e.target.value)} />
          <TextField label="Cuerpo del Mensaje (Texto del Email)" fullWidth multiline rows={5} required disabled={uploadingComunicado} value={cuerpoComunicado} onChange={e => setCuerpoComunicado(e.target.value)} />
          
          {/* CONTROL DE SEGMENTACIÓN DE DESTINATARIOS */}
          <Box sx={{ bgcolor: '#f8fafc', p: 2, borderRadius: 2, border: '1px solid #e2e8f0' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 1 }}>
              <FormLabel component="legend" style={{ fontWeight: 'bold', fontSize: '0.85rem', color: '#1a365d' }}>
                Destinatarios del Mensaje
              </FormLabel>
              <Button
                size="small"
                variant="outlined"
                color="warning"
                onClick={() => {
                  setTipoDestinatario('especificos');
                  const pendientes = clientes.filter((c) => !c.tiene_poder || !c.tiene_documento_id).map((c) => c.id);
                  setClientesSeleccionadosIds(pendientes);
                }}
                sx={{ textTransform: 'none', fontSize: '0.7rem', fontWeight: 'bold', py: 0.25 }}
              >
                ⚠️ Seleccionar pendientes de Poder/ID
              </Button>
            </Box>
            <RadioGroup
              row
              value={tipoDestinatario}
              onChange={(e) => setTipoDestinatario(e.target.value)}
              disabled={uploadingComunicado}
            >
              <FormControlLabel value="todos" control={<Radio size="small" />} label={`Enviar a todos (${clientes.length})`} />
              <FormControlLabel value="especificos" control={<Radio size="small" />} label="Seleccionar específicos" />
            </RadioGroup>

            {/* PANEL DESPLEGABLE: SELECCIÓN MANUAL DE CLIENTES CON BUSCADOR DINÁMICO */}
            {tipoDestinatario === 'especificos' && (
              <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px dashed #cbd5e1' }}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Buscar destinatario por nombre o país..."
                  value={filtroDestinatarios}
                  onChange={(e) => setFiltroDestinatarios(e.target.value)}
                  disabled={uploadingComunicado}
                  InputProps={{
                    startAdornment: (
                      <Box sx={{ color: 'text.secondary', display: 'flex', mr: 1 }}><Search size={16} /></Box>
                    ),
                  }}
                  sx={{ mb: 1, bgcolor: '#ffffff' }}
                />
                
                <Box sx={{ maxHeight: 150, overflowY: 'auto', display: 'flex', flexDirection: 'column', bgcolor: '#ffffff', p: 1, borderRadius: 1.5, border: '1px solid #e2e8f0' }}>
                  {clientes
                    .filter(c => {
                      const term = filtroDestinatarios.toLowerCase().trim();
                      if (!term) return true;
                      const matchesName = `${c.nombres} ${c.apellidos}`.toLowerCase().includes(term);
                      const matchesCountry = (c.pais || '').toLowerCase().includes(term);
                      return matchesName || matchesCountry;
                    })
                    .map((c) => {
                      const isChecked = clientesSeleccionadosIds.includes(c.id);
                      return (
                        <FormControlLabel
                          key={c.id}
                          control={
                            <Checkbox 
                              size="small"
                              checked={isChecked}
                              disabled={uploadingComunicado}
                              onChange={() => {
                                if (isChecked) {
                                  setClientesSeleccionadosIds(prev => prev.filter(id => id !== c.id));
                                } else {
                                  setClientesSeleccionadosIds(prev => [...prev, c.id]);
                                }
                              }}
                            />
                          }
                          label={
                            <Typography variant="body2">
                              <strong>{c.apellidos}, {c.nombres}</strong> {c.correo_principal ? `(${c.correo_principal})` : '[Sin correo]'}
                            </Typography>
                          }
                          sx={{ my: -0.25 }}
                        />
                      );
                    })}
                </Box>
                <Typography variant="caption" color="primary.main" sx={{ display: 'block', mt: 1, fontWeight: 'bold' }}>
                  {`Seleccionados: ${clientesSeleccionadosIds.length} representados.`}
                </Typography>
              </Box>
            )}
          </Box>

          <Button 
            variant="outlined" 
            component="label" 
            startIcon={<Upload size={18} />} 
            disabled={uploadingComunicado} 
            fullWidth
            sx={{ textTransform: 'none', borderRadius: 2, fontWeight: 'bold', py: 1.5 }}
          >
            {fileComunicado ? fileComunicado.name : 'Adjuntar Documento del Comunicado (PDF) - Opcional'}
            <input type="file" accept="application/pdf" hidden onChange={(e) => setFileComunicado(e.target.files[0])} />
          </Button>

          {uploadingComunicado && (
            <Box sx={{ width: '100%', mt: 1 }}>
              <LinearProgress variant="determinate" value={uploadProgressComunicado} />
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 0.5 }}>
                Subiendo circular... {uploadProgressComunicado}%
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setOpenComunicadoModal(false)} color="inherit" sx={{ textTransform: 'none' }} disabled={uploadingComunicado}>Cancelar</Button>
          <Button type="submit" variant="contained" sx={{ textTransform: 'none', fontWeight: 'bold' }} disabled={uploadingComunicado || (tipoDestinatario === 'especificos' && clientesSeleccionadosIds.length === 0)}>
            {uploadingComunicado ? 'Procesando...' : 'Registrar Comunicado'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}