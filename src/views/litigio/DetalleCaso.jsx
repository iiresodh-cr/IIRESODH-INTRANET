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
  Tabs, 
  Tab, 
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
  ListItem, 
  ListItemText,
  TablePagination,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormLabel,
  Checkbox,
  Collapse,
  Grid
} from '@mui/material';
import { 
  ArrowLeft, 
  Users, 
  FileText, 
  CreditCard, 
  Plus, 
  Eye, 
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
  FolderOpen
} from 'lucide-react';
import FichaCliente, {
  CALIDADES_PROCESALES,
  CONDICIONES_VULNERABILIDAD,
  ESTADOS_PAGO_CLIENTE
} from './FichaCliente';
import { ETAPAS_PROCESALES_LITIGIO } from './Casos';
import { registrarLogAuditoria } from '../../utils/auditLogger';
import {
  MODELOS_LITIGIO_IA,
  ejecutarConsultaJuridicaIA,
  analizarPiezaProcesalIA,
  extraerDatosIdentificacionIA,
  auditarPadronArt35IA,
  redactarComunicadoClaroIA
} from '../../utils/litigioAiService';

export const CATEGORIAS_DOCUMENTOS_PROCESALES = [
  'Escrito IIRESODH',
  'Resolución / Notificación Tribunal',
  'Contestación del Estado',
  'Peritaje / Amicus Curiae',
  'Anexo Probatorio'
];

const GUIA_ETAPAS_PROCESALES = {
  '1. Preparación y Recolección': {
    objetivo: 'Consolidación del padrón de víctimas (Art. 35 Corte IDH), recolección de poderes e identificaciones, sistematización probatoria y agotamiento de recursos internos.',
    entregables: ['Poderes de representación firmados', 'Copias de documentos de identidad', 'Prueba documental de agotamiento de vía interna', 'Borrador de Petición Inicial / Demanda'],
    promptIA: 'Evalúa si el expediente cuenta con los elementos necesarios en la Etapa 1 (Preparación y Recolección) y sugiere una lista de verificación de pruebas, poderes (Art. 35) y requisitos de admisibilidad antes de presentar la petición.'
  },
  '2. Presentación / Admisibilidad': {
    objetivo: 'Examen de admisibilidad (Arts. 46 y 47 CADH / Protocolos Facultativos ONU): competencia, agotamiento de recursos internos o excepciones (Art. 46.2), plazo de 6 meses y caracterización preliminar.',
    entregables: ['Cargo de presentación oficial', 'Observaciones sobre admisibilidad', 'Solicitud de trámite prioritario (Art. 29.2 Reglamento CIDH si aplica)'],
    promptIA: 'Formula la estrategia jurídica para superar la Etapa 2 (Admisibilidad) de este caso, blindando el cumplimiento de los artículos 46 y 47 de la CADH y rebatiendo posibles excepciones preliminares del Estado.'
  },
  '3. Observaciones y Fondo': {
    objetivo: 'Sustanciación del fondo de la controversia: presentación del Escrito de Solicitudes, Argumentos y Pruebas (ESAP) o alegatos de fondo sobre responsabilidad internacional del Estado.',
    entregables: ['Escrito de Observaciones de Fondo / ESAP', 'Ofrecimiento de prueba pericial y declarantes', 'Anexos probatorios numerados correlativamente'],
    promptIA: 'Desarrolla la estructura argumentativa de Fondo (Etapa 3) y del Escrito de Solicitudes, Argumentos y Pruebas (ESAP), detallando las violaciones convencionales y los estándares aplicables.'
  },
  '4. Audiencia / Alegatos Finales': {
    objetivo: 'Comparecencia en audiencia pública o privada ante el órgano internacional, interrogatorio de declarantes/peritos y presentación de alegatos finales escritos.',
    entregables: ['Guion de interrogatorio a víctimas y peritos', 'Alegatos orales de apertura y cierre', 'Escrito de Alegatos Finales y Costas'],
    promptIA: 'Prepara el guion estratégico para Audiencia Pública y el esquema de Alegatos Finales Escritos (Etapa 4), incluyendo preguntas clave para víctimas/peritos y réplica al Estado.'
  },
  '5. Sentencia / Informe de Fondo': {
    objetivo: 'Notificación, análisis e interpretación del Informe de Fondo (Art. 50 CADH) o Sentencia definitiva de la Corte / Comité Internacional.',
    entregables: ['Análisis ejecutivo de puntos resolutivos', 'Circular explicativa en lenguaje claro para víctimas', 'Cálculo de plazos de cumplimiento ordenados al Estado'],
    promptIA: 'Analiza las implicaciones procesales de la Etapa 5 (Sentencia / Informe de Fondo) para este caso y redacta los puntos clave que deben verificarse respecto de las obligaciones declaradas al Estado.'
  },
  '6. Supervisión y Reparaciones': {
    objetivo: 'Seguimiento del cumplimiento efectivo de las medidas de reparación integral (Art. 63.1 CADH): indemnizaciones, restitución, rehabilitación, satisfacción y garantías de no repetición.',
    entregables: ['Observaciones a los informes estatales de cumplimiento', 'Comprobantes de pago de indemnizaciones y costas', 'Solicitud de audiencia de supervisión'],
    promptIA: 'Diseña una matriz de Supervisión de Cumplimiento de Sentencia y Reparaciones (Etapa 6) según el Art. 63.1 CADH para exigir al Estado el cumplimiento efectivo de cada medida.'
  }
};

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
    <ListItem disablePadding sx={{ mb: 2, p: 2, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0', display: 'block' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="subtitle1" fontWeight="bold" color="primary.main">{c.asunto}</Typography>
          <Typography variant="caption" color="text.secondary">
            {`Remitente: ${c.from || 'contacto@iiresodh.org'} | Enviado por: ${c.enviado_por} | Fecha: ${c.fecha_envio ? new Date(c.fecha_envio).toLocaleString() : ''} | Cobertura: ${c.tipo_cobertura === 'todos' ? 'Todos los representados' : 'Segmentación selectiva'} (${c.destinatarios_conteo || 0} correos)`}
          </Typography>
        </Box>
        {deliveryState && (
          <Chip
            size="small"
            label={
              deliveryState === 'SUCCESS'
                ? 'Despachado'
                : deliveryState === 'PROCESSING'
                  ? 'Procesando envío...'
                  : 'Revisión requerida'
            }
            color={
              deliveryState === 'SUCCESS'
                ? 'success'
                : deliveryState === 'PROCESSING'
                  ? 'info'
                  : 'warning'
            }
            variant="outlined"
            sx={{ fontWeight: 'bold', fontSize: '0.7rem' }}
          />
        )}
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5, flexWrap: 'wrap', mb: 0.5 }}>
        <Button
          size="small"
          variant="text"
          onClick={() => setExpanded(!expanded)}
          sx={{ textTransform: 'none', fontSize: '0.75rem', p: 0, minWidth: 0, fontWeight: 'bold', color: 'primary.main' }}
        >
          {expanded ? "Ocultar contenido del mensaje" : "Ver contenido del mensaje"}
        </Button>

        <Button
          size="small"
          variant="text"
          onClick={handleToggleTelemetry}
          sx={{ textTransform: 'none', fontSize: '0.75rem', p: 0, minWidth: 0, fontWeight: 'bold', color: '#0f766e' }}
        >
          {showTelemetry
            ? "Ocultar estado por destinatario (Entregados / Abiertos)"
            : "Ver estado por destinatario (Entregados / Abiertos)"}
        </Button>
      </Box>

      <Collapse in={expanded}>
        <Typography variant="body2" sx={{ my: 1, whiteSpace: 'pre-wrap', color: 'text.primary', bgcolor: '#ffffff', p: 1.5, borderRadius: 1, border: '1px solid #e2e8f0' }}>
          {c.cuerpo}
        </Typography>
      </Collapse>

      <Collapse in={showTelemetry}>
        <Box sx={{ my: 1.5, p: 1.5, bgcolor: '#ffffff', borderRadius: 2, border: '1px solid #e2e8f0' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
              <Typography variant="caption" fontWeight="bold" color="text.primary">
                Prueba de Entrega y Lectura:
              </Typography>
              <Chip size="small" label={`Recibidos: ${conteoEntregados}/${telemetryRows.length}`} color="info" variant="outlined" sx={{ fontWeight: 'bold', fontSize: '0.7rem', height: 22 }} />
              <Chip size="small" label={`Abiertos: ${conteoAbiertos}/${telemetryRows.length}`} color="success" variant="outlined" sx={{ fontWeight: 'bold', fontSize: '0.7rem', height: 22 }} />
              {conteoRebotados > 0 && (
                <Chip size="small" label={`Rebotes: ${conteoRebotados}`} color="error" variant="outlined" sx={{ fontWeight: 'bold', fontSize: '0.7rem', height: 22 }} />
              )}
            </Box>
            <Button
              size="small"
              variant="outlined"
              onClick={cargarTelemetriaDestinatarios}
              disabled={loadingTelemetry}
              sx={{ textTransform: 'none', fontSize: '0.7rem', py: 0.25, px: 1 }}
            >
              {loadingTelemetry ? 'Actualizando...' : 'Actualizar estado'}
            </Button>
          </Box>

          {loadingTelemetry ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <CircularProgress size={22} />
            </Box>
          ) : telemetryRows.length === 0 ? (
            <Typography variant="caption" color="text.secondary">
              No se localizaron registros individuales para este comunicado.
            </Typography>
          ) : (
            <TableContainer sx={{ maxHeight: 280 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold', fontSize: '0.75rem', bgcolor: '#f8fafc' }}>Representado</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', fontSize: '0.75rem', bgcolor: '#f8fafc' }}>Correo</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', fontSize: '0.75rem', bgcolor: '#f8fafc' }}>Estado</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', fontSize: '0.75rem', bgcolor: '#f8fafc' }}>Recibido (Entrega)</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', fontSize: '0.75rem', bgcolor: '#f8fafc' }}>Abierto (Lectura)</TableCell>
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
                        <TableCell sx={{ fontSize: '0.75rem', fontWeight: 'medium' }}>
                          {onVerCliente && row.clienteId ? (
                            <Button
                              variant="text"
                              size="small"
                              onClick={() => onVerCliente(row.clienteId)}
                              sx={{ textTransform: 'none', p: 0, minWidth: 0, fontSize: '0.75rem', fontWeight: 'bold' }}
                            >
                              {row.nombre || 'Ver ficha'}
                            </Button>
                          ) : (
                            row.nombre
                          )}
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>{row.email}</TableCell>
                        <TableCell>
                          <Chip size="small" color={chipColor} label={chipLabel} sx={{ fontWeight: 'bold', fontSize: '0.68rem', height: 20 }} />
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>
                          {row.entregado_at || '—'}
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.72rem', color: row.abierto_at ? 'success.main' : 'text.secondary', fontWeight: row.abierto_at ? 'bold' : 'normal' }}>
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

      <Divider sx={{ my: 1 }} />
      {c.pdf_url && (
        <Button
          component="a"
          href={c.pdf_url}
          target="_blank"
          rel="noopener"
          variant="text"
          size="small"
          startIcon={<File size={14} />}
          sx={{ textTransform: 'none', fontWeight: 'bold', p: 0 }}
        >
          {c.pdf_nombre || 'Ver Documento Adjunto (PDF)'}
        </Button>
      )}
    </ListItem>
  );
}

export default function DetalleCaso({ caso, onVolver, currentUserEmail, userRole }) {
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

  // Estados del formulario del representado
  const [openModal, setOpenModal] = useState(false);
  const [nombres, setNombres] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [tipoIdentificacion, setTipoIdentificacion] = useState('Cédula de Identidad');
  const [identificacion, setIdentificacion] = useState('');
  const [correoPrincipal, setCorreoPrincipal] = useState('');
  const [codigoTelefonoPrincipal, setCodigoTelefonoPrincipal] = useState('+506');
  const [telefonoPrincipal, setTelefonoPrincipal] = useState('');
  const [pais, setPais] = useState('Costa Rica');
  const [direccion, setDireccion] = useState('');
  const [notas, setNotas] = useState('');
  const [calidadProcesalInput, setCalidadProcesalInput] = useState(CALIDADES_PROCESALES[0]);
  const [vulnerabilidadInput, setVulnerabilidadInput] = useState('Ninguna');
  const [tienePoderInput, setTienePoderInput] = useState(false);
  const [tieneIdInput, setTieneIdInput] = useState(false);
  const [autocompletandoOcrCliente, setAutocompletandoOcrCliente] = useState(false);

  // Etapa procesal interactiva + Historial de Hitos por Etapa (Pilar 1)
  const [etapaActualCaso, setEtapaActualCaso] = useState(
    caso.etapa_procesal || '1. Preparación y Recolección'
  );
  const [historialEtapas, setHistorialEtapas] = useState(caso.historial_etapas || {});
  const [etapaInspeccionada, setEtapaInspeccionada] = useState(
    caso.etapa_procesal || '1. Preparación y Recolección'
  );
  const [mostrarDetalleEtapa, setMostrarDetalleEtapa] = useState(true);
  const [hitoFechaInput, setHitoFechaInput] = useState('');
  const [hitoResolucionInput, setHitoResolucionInput] = useState('');
  const [hitoResumenInput, setHitoResumenInput] = useState('');
  const [guardandoHitoEtapa, setGuardandoHitoEtapa] = useState(false);

  // Estados para padrón Art. 35 y Auditoría IA (Pilar 2 & 6)
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
  const [usarArgonEnDoc, setUsarArgonEnDoc] = useState(false);

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

  // Estados para Pestaña 6: Copiloto Jurídico Internacional IA (Gemini 4 Argon)
  const [modeloCopilotoIA, setModeloCopilotoIA] = useState('gemini-4-argon');
  const [consultaCopilotoIA, setConsultaCopilotoIA] = useState('');
  const [ejecutandoCopilotoIA, setEjecutandoCopilotoIA] = useState(false);
  const [respuestaCopilotoIA, setRespuestaCopilotoIA] = useState(null);

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
    setLocalPlazos(caso.plazos || []);
    const etapaInit = caso.etapa_procesal || '1. Preparación y Recolección';
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
  }, [caso.id, caso.plazos, caso.etapa_procesal, caso.historial_etapas]);

  const handleSeleccionarEtapaInspeccion = (etapa) => {
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
      await updateDoc(doc(db, 'casos', caso.id), {
        etapa_procesal: nuevaEtapa,
        historial_etapas: nuevoHistorial
      });
      await registrarLogAuditoria(
        currentUserEmail,
        'Cambio de Etapa Procesal',
        `Se actualizó la etapa procesal del caso "${caso.nombre}" a [${nuevaEtapa}]`
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
      await updateDoc(doc(db, 'casos', caso.id), {
        historial_etapas: nuevoHistorial
      });
    } catch (err) {
      setError('No se pudo guardar el hito de la etapa procesal.');
    } finally {
      setGuardandoHitoEtapa(false);
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
        nombreArchivo: file.name
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
      setError(`Error en autocompletado OCR IA: ${err.message}`);
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
      'Calidad Procesal (SIDH)',
      'Vulnerabilidad (Art. 29.2 CIDH)',
      'Poder Verificado',
      'ID Legible',
      'Prueba Daño',
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
    link.download = `Padron_Art35_${(caso.nombre || 'Caso').replace(/\s+/g, '_')}.csv`;
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
      const res = await auditarPadronArt35IA({ clientes, caso });
      setResultadoAuditoriaPadron(res);
    } catch (err) {
      setError(`Error en Auditoría IA del Padrón: ${err.message}`);
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
        contextoCaso: caso,
        usarPensamientoAvanzado: requiereArgon
      });
      setResultadoAnalisisDocIA({ ...res, docNombre: docItem.nombre });
    } catch (err) {
      setError(`No se pudo analizar la pieza procesal con IA: ${err.message}`);
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
        caso,
        instruccion: instruccionComunicadoIA,
        tipoPlantilla: plantillaComunicadoIA
      });
      if (res.asunto) setAsuntoComunicado(res.asunto);
      if (res.cuerpo) setCuerpoComunicado(res.cuerpo);
    } catch (err) {
      setError(`No se pudo generar el borrador con IA: ${err.message}`);
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
- Nombre del Caso: ${caso.nombre}
- Expediente Oficial: ${caso.expediente_oficial || 'En trámite'}
- Jurisdicción / Instancia: ${caso.jurisdiccion || 'CIDH (Comisión)'}
- Estado Demandado: ${caso.estado_demandado || 'Estado de Costa Rica'}
- Etapa Procesal Actual: ${etapaActualCaso}
- Derechos Invocados: ${Array.isArray(caso.derechos_invocados) ? caso.derechos_invocados.join(', ') : 'CADH Arts. 8 y 25'}
- Descripción Fáctica: ${caso.descripcion || 'Sin descripción adicional'}
- Padrón de Víctimas (Art. 35 Corte IDH): ${clientes.length} representados totales (${listosArt35} con Poder + ID completos; ${vulnerables} con condición de vulnerabilidad registrada para Art. 29.2 CIDH).
- Plazos Fatales Pendientes: ${plazosPend || 'Ninguno activo'}
- Piezas Procesales en el Expediente:
${listaDocs || 'Sin documentos comunes aún.'}

SOLICITUD JURÍDICA AL COPILOTO:
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
      setError(`Error en Copiloto Jurídico IA: ${err.message}`);
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

  return (
    <Box>
      <Button 
        startIcon={<ArrowLeft size={16} />} 
        onClick={onVolver} 
        sx={{ mb: 2, textTransform: 'none', color: 'text.secondary', fontWeight: 'bold' }}
      >
        Volver a todos los casos
      </Button>

      {/* CABECERA INTERNACIONAL + PIPELINE DE 6 ETAPAS PROCESALES (PILAR 1) */}
      <Paper sx={{ p: { xs: 2, sm: 3 }, mb: 3, borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: 'none' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 1.5, mb: 1.5 }}>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
            <Chip
              icon={<Globe size={14} />}
              label={caso.jurisdiccion || 'CIDH (Comisión)'}
              size="small"
              color="primary"
              sx={{ fontWeight: 'bold' }}
            />
            {caso.expediente_oficial && (
              <Chip
                label={`Exp: ${caso.expediente_oficial}`}
                size="small"
                sx={{ fontWeight: 'bold', fontFamily: 'monospace', bgcolor: '#1e293b', color: '#ffffff' }}
              />
            )}
            {caso.estado_demandado && (
              <Chip
                label={`🏛️ Contra: ${caso.estado_demandado}`}
                size="small"
                variant="outlined"
                sx={{ fontWeight: 'bold' }}
              />
            )}
            {caso.abogado_responsable && (
              <Chip
                label={`⚖️ ${caso.abogado_responsable}`}
                size="small"
                variant="outlined"
                sx={{ fontWeight: 'medium' }}
              />
            )}
          </Box>

          <Button
            size="small"
            variant="contained"
            startIcon={<Sparkles size={15} />}
            onClick={() => setActiveTab(5)}
            sx={{
              textTransform: 'none',
              fontWeight: 'bold',
              borderRadius: 2,
              background: 'linear-gradient(90deg, #312e81 0%, #6d28d9 100%)'
            }}
          >
            Abrir Copiloto Jurídico (Gemini 4 Argon)
          </Button>
        </Box>

        <Typography variant="h4" fontWeight="bold" color="primary.main" gutterBottom sx={{ fontSize: { xs: '1.35rem', sm: '2rem' } }}>
          {caso.nombre}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {caso.descripcion || 'Sin descripción del litigio.'}
        </Typography>

        {Array.isArray(caso.derechos_invocados) && caso.derechos_invocados.length > 0 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 2 }}>
            {caso.derechos_invocados.map((der) => (
              <Chip
                key={der}
                label={der}
                size="small"
                sx={{ bgcolor: '#eff6ff', color: '#1e40af', fontWeight: 'bold', fontSize: '0.72rem' }}
              />
            ))}
          </Box>
        )}

        <Divider sx={{ my: 1.5 }} />

        {/* Pipeline Procesal Interactivo con Historial de Hitos y Guía Internacional */}
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 1 }}>
            <Typography variant="caption" fontWeight="bold" color="text.secondary" sx={{ textTransform: 'uppercase' }}>
              Línea de Tiempo Procesal (Haz clic en cualquier etapa para ver su hito, guía o activarla):
            </Typography>
            <Button
              size="small"
              variant="text"
              onClick={() => setMostrarDetalleEtapa((prev) => !prev)}
              sx={{ textTransform: 'none', fontWeight: 'bold', fontSize: '0.75rem', p: 0 }}
            >
              {mostrarDetalleEtapa ? 'Ocultar detalle de etapa ▲' : 'Mostrar detalle de etapa ▼'}
            </Button>
          </Box>

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {ETAPAS_PROCESALES_LITIGIO.map((etapa, idx) => {
              const idxActual = ETAPAS_PROCESALES_LITIGIO.indexOf(etapaActualCaso);
              const activa = etapaActualCaso === etapa;
              const completada = idx < idxActual;
              const inspeccionada = etapaInspeccionada === etapa;
              const infoHito = historialEtapas[etapa];
              const etiquetaChip = infoHito?.fecha_hito
                ? `${completada ? '✓ ' : activa ? '● ' : ''}${etapa} (${infoHito.fecha_hito})`
                : `${completada ? '✓ ' : activa ? '● ' : ''}${etapa}`;

              return (
                <Chip
                  key={etapa}
                  label={etiquetaChip}
                  size="small"
                  color={activa ? 'primary' : completada ? 'success' : 'default'}
                  variant={activa || completada ? 'filled' : 'outlined'}
                  onClick={() => handleSeleccionarEtapaInspeccion(etapa)}
                  sx={{
                    fontWeight: activa || inspeccionada ? 'bold' : 'medium',
                    cursor: 'pointer',
                    border: inspeccionada ? '2px solid #4f46e5' : undefined,
                    boxShadow: inspeccionada ? '0 0 0 2px rgba(79,70,229,0.2)' : 'none'
                  }}
                />
              );
            })}
          </Box>

          <Collapse in={mostrarDetalleEtapa}>
            {(() => {
              const guia = GUIA_ETAPAS_PROCESALES[etapaInspeccionada] || GUIA_ETAPAS_PROCESALES['1. Preparación y Recolección'];
              const idxInsp = ETAPAS_PROCESALES_LITIGIO.indexOf(etapaInspeccionada);
              const idxAct = ETAPAS_PROCESALES_LITIGIO.indexOf(etapaActualCaso);
              const esEtapaActual = etapaInspeccionada === etapaActualCaso;
              const esEtapaCompletada = idxInsp < idxAct;
              const infoGuardada = historialEtapas[etapaInspeccionada];

              return (
                <Paper
                  variant="outlined"
                  sx={{
                    mt: 2,
                    p: 2,
                    borderRadius: 2.5,
                    bgcolor: esEtapaActual ? '#f8fafc' : esEtapaCompletada ? '#f0fdf4' : '#fafafa',
                    borderColor: esEtapaActual ? '#93c5fd' : esEtapaCompletada ? '#86efac' : '#e2e8f0'
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Typography variant="subtitle2" fontWeight="bold" color="primary.main">
                        {etapaInspeccionada}
                      </Typography>
                      <Chip
                        size="small"
                        label={
                          esEtapaActual
                            ? '● Etapa Actual en Curso'
                            : esEtapaCompletada
                            ? '✓ Etapa Superada / Completada'
                            : '○ Etapa Futura / Proyectada'
                        }
                        color={esEtapaActual ? 'primary' : esEtapaCompletada ? 'success' : 'default'}
                        sx={{ fontWeight: 'bold', height: 22, fontSize: '0.7rem' }}
                      />
                      {infoGuardada?.resolucion_referencia && (
                        <Chip
                          size="small"
                          variant="outlined"
                          label={`Ref: ${infoGuardada.resolucion_referencia}`}
                          sx={{ fontWeight: 'bold', height: 22, fontSize: '0.7rem', bgcolor: '#ffffff' }}
                        />
                      )}
                    </Box>

                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {!esEtapaActual && (
                        <Button
                          size="small"
                          variant="contained"
                          color="primary"
                          disabled={guardandoHitoEtapa}
                          onClick={() => handleCambiarEtapaProcesal(etapaInspeccionada, true)}
                          sx={{ textTransform: 'none', fontWeight: 'bold', borderRadius: 1.5 }}
                        >
                          Establecer como Etapa Actual del Caso
                        </Button>
                      )}
                      <Button
                        size="small"
                        variant="outlined"
                        color="secondary"
                        startIcon={<Sparkles size={14} />}
                        onClick={() => {
                          setActiveTab(5);
                          setConsultaCopilotoIA(guia.promptIA);
                          handleEjecutarCopilotoIA(guia.promptIA);
                        }}
                        sx={{ textTransform: 'none', fontWeight: 'bold', borderRadius: 1.5 }}
                      >
                        Generar Estrategia IA de esta Etapa
                      </Button>
                    </Box>
                  </Box>

                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                    <strong>Objetivo procesal internacional:</strong> {guia.objetivo}
                  </Typography>

                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 2 }}>
                    {guia.entregables.map((ent) => (
                      <Chip
                        key={ent}
                        size="small"
                        label={`• ${ent}`}
                        sx={{ bgcolor: '#ffffff', border: '1px solid #cbd5e1', fontSize: '0.72rem' }}
                      />
                    ))}
                  </Box>

                  <Grid container spacing={1.5} alignItems="center">
                    <Grid item xs={12} sm={3}>
                      <TextField
                        label="Fecha de Inicio / Hito"
                        type="date"
                        size="small"
                        fullWidth
                        InputLabelProps={{ shrink: true }}
                        value={hitoFechaInput}
                        onChange={(e) => setHitoFechaInput(e.target.value)}
                        sx={{ bgcolor: '#ffffff' }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <TextField
                        label="Resolución / Escrito de Referencia"
                        size="small"
                        fullWidth
                        placeholder="Ej: Informe Admisibilidad No. 48/26 o ESAP"
                        value={hitoResolucionInput}
                        onChange={(e) => setHitoResolucionInput(e.target.value)}
                        sx={{ bgcolor: '#ffffff' }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={3}>
                      <TextField
                        label="Resumen / Observación de la Etapa"
                        size="small"
                        fullWidth
                        placeholder="Nota ejecutiva del avance..."
                        value={hitoResumenInput}
                        onChange={(e) => setHitoResumenInput(e.target.value)}
                        sx={{ bgcolor: '#ffffff' }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={2}>
                      <Button
                        fullWidth
                        size="small"
                        variant="contained"
                        color="success"
                        disabled={guardandoHitoEtapa}
                        onClick={() => handleGuardarHitoEtapa(etapaInspeccionada)}
                        sx={{ textTransform: 'none', fontWeight: 'bold', py: 1 }}
                      >
                        {guardandoHitoEtapa ? 'Guardando...' : 'Guardar Hito'}
                      </Button>
                    </Grid>
                  </Grid>
                </Paper>
              );
            })()}
          </Collapse>
        </Box>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 2, fontWeight: 'medium' }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs 
          value={activeTab} 
          onChange={(e, val) => setActiveTab(val)} 
          textColor="primary" 
          indicatorColor="primary"
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={{
            '& .MuiTab-root': {
              minHeight: 48,
              fontSize: { xs: '0.82rem', sm: '0.9rem' },
              whiteSpace: 'nowrap'
            }
          }}
        >
          <Tab icon={<Users size={18} />} iconPosition="start" label={`Padrón de Víctimas (${clientes.length})`} sx={{ textTransform: 'none', fontWeight: 'bold' }} />
          <Tab icon={<FileText size={18} />} iconPosition="start" label={`Piezas y Anexos (${docsComunes.length})`} sx={{ textTransform: 'none', fontWeight: 'bold' }} />
          <Tab icon={<CreditCard size={18} />} iconPosition="start" label="Control Financiero y Aportes" sx={{ textTransform: 'none', fontWeight: 'bold' }} />
          <Tab 
            icon={<Clock size={18} style={{ color: semaforoGeneral ? semaforoGeneral.color : 'inherit' }} />} 
            iconPosition="start" 
            label={semaforoGeneral ? `Plazos Fatales (${semaforoGeneral.label})` : "Plazos Fatales"} 
            style={{ 
              textTransform: 'none', 
              fontWeight: 'bold', 
              color: semaforoGeneral ? semaforoGeneral.color : 'inherit' 
            }} 
          />
          <Tab icon={<Mail size={18} />} iconPosition="start" label="Comunicados Oficiales" sx={{ textTransform: 'none', fontWeight: 'bold' }} />
          <Tab icon={<Sparkles size={18} />} iconPosition="start" label="✨ Copiloto Jurídico IA" sx={{ textTransform: 'none', fontWeight: 'bold', color: '#4338ca' }} />
        </Tabs>
      </Box>

      {/* PESTAÑA 1: PADRÓN DE VÍCTIMAS Y ACREDITACIÓN ART. 35 CORTE IDH */}
      <TabPanel value={activeTab} index={0}>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'center' }, gap: 2, mb: 3 }}>
          <Box>
            <Typography variant="h6" fontWeight="bold">Padrón Oficial de Víctimas y Representados (Art. 35 Corte IDH)</Typography>
            <Typography variant="caption" color="text.secondary">
              Control de poderes, documentos de identidad, condiciones de vulnerabilidad (Art. 29.2 CIDH) y exportación oficial.
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<ShieldCheck size={16} />}
              disabled={auditandoPadronIA}
              onClick={handleAuditarPadronIA}
              sx={{ textTransform: 'none', borderRadius: 2, fontWeight: 'bold', color: '#4338ca', borderColor: '#c7d2fe', bgcolor: '#eef2ff' }}
            >
              {auditandoPadronIA ? 'Auditando con IA...' : '🛡️ Auditar Padrón (Art. 35)'}
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<Download size={16} />}
              onClick={handleExportarPadronCSV}
              disabled={clientes.length === 0}
              sx={{ textTransform: 'none', borderRadius: 2, fontWeight: 'bold' }}
            >
              Exportar Anexo CSV/Excel
            </Button>
            <Button
              variant="outlined"
              size="small"
              component="label"
              startIcon={<Upload size={16} />}
              disabled={importandoCSV}
              sx={{ textTransform: 'none', borderRadius: 2, fontWeight: 'bold' }}
            >
              {importandoCSV ? 'Importando...' : 'Importar CSV'}
              <input type="file" accept=".csv" hidden onChange={handleImportarPadronCSV} />
            </Button>
            <Button 
              variant="contained" 
              size="small"
              startIcon={<Plus size={18} />} 
              onClick={() => setOpenModal(true)} 
              sx={{ textTransform: 'none', borderRadius: 2, fontWeight: 'bold' }}
            >
              Agregar Representado
            </Button>
          </Box>
        </Box>

        {/* Panel de Resultado de Auditoría IA del Padrón */}
        {resultadoAuditoriaPadron && (
          <Paper sx={{ p: 2.5, mb: 3, borderRadius: 3, border: '1px solid #c7d2fe', bgcolor: '#eef2ff', boxShadow: 'none' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ShieldCheck size={18} color="#4338ca" />
                <Typography variant="subtitle1" fontWeight="bold" color="#312e81">
                  Auditoría de Cumplimiento del Padrón (Art. 35 Reglamento Corte IDH)
                </Typography>
                <Chip
                  size="small"
                  label={resultadoAuditoriaPadron._metaIA?.modeloEjecutado || 'gemini-3.5-flash-lite'}
                  sx={{ fontWeight: 'bold', fontSize: '0.7rem', bgcolor: '#ffffff' }}
                />
              </Box>
              <Button size="small" color="inherit" onClick={() => setResultadoAuditoriaPadron(null)} sx={{ textTransform: 'none' }}>
                Cerrar
              </Button>
            </Box>

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
              <Chip size="small" color="success" label={`Listos Art. 35: ${resultadoAuditoriaPadron.estadisticas.listosArt35}/${resultadoAuditoriaPadron.estadisticas.total} (${resultadoAuditoriaPadron.estadisticas.porcentajeListos}%)`} sx={{ fontWeight: 'bold' }} />
              <Chip size="small" color="warning" label={`Sin Poder: ${resultadoAuditoriaPadron.estadisticas.sinPoderCount}`} sx={{ fontWeight: 'bold' }} />
              <Chip size="small" color="warning" label={`Sin Cédula/ID: ${resultadoAuditoriaPadron.estadisticas.sinIdCount}`} sx={{ fontWeight: 'bold' }} />
              <Chip size="small" color="secondary" label={`Vulnerables (Art. 29.2): ${resultadoAuditoriaPadron.estadisticas.vulnerablesCount}`} sx={{ fontWeight: 'bold' }} />
            </Box>

            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', bgcolor: '#ffffff', p: 2, borderRadius: 2, border: '1px solid #e0e7ff' }}>
              {resultadoAuditoriaPadron.dictamenIA}
            </Typography>
          </Paper>
        )}

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' }, gap: 2, mb: 3 }}>
          <TextField
            fullWidth
            size="small"
            variant="outlined"
            placeholder="Buscar representados por nombres, apellidos, identificación, país o correo..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(0);
            }}
            InputProps={{
              startAdornment: (
                <Box sx={{ display: 'flex', alignItems: 'center', mr: 1, color: 'text.secondary' }}>
                  <Search size={18} />
                </Box>
              ),
            }}
          />

          <FormControl size="small" fullWidth>
            <InputLabel>Filtro de Acreditación Procesal</InputLabel>
            <Select
              value={filtroAcreditacion}
              label="Filtro de Acreditación Procesal"
              onChange={(e) => {
                setFiltroAcreditacion(e.target.value);
                setPage(0);
              }}
            >
              <MenuItem value="Todos">Todos los Representados ({clientes.length})</MenuItem>
              <MenuItem value="Listos Art. 35">🟢 Listos Art. 35 (Poder + ID)</MenuItem>
              <MenuItem value="Pendientes Poder/ID">🟡 Pendientes de Poder o ID</MenuItem>
              <MenuItem value="Con Vulnerabilidad">🛡️ Con Vulnerabilidad (Art. 29.2 CIDH)</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
        ) : clientesFiltrados.length === 0 ? (
          <Alert severity="info" sx={{ borderRadius: 2 }}>
            {searchQuery || filtroAcreditacion !== 'Todos'
              ? 'No se localizaron registros de representados que coincidan con los criterios de búsqueda.'
              : 'No hay clientes registrados en este litigio.'}
          </Alert>
        ) : (
          <>
            <TableContainer component={Paper} sx={{ borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: 'none', overflowX: 'auto' }}>
              <Table sx={{ minWidth: 780 }}>
                <TableHead sx={{ bgcolor: '#f8fafc' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Apellidos y Nombres</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Identificación / País</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Checklist Art. 35 (Clic para marcar)</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Contacto Principal</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Estado Pago</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Ficha</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {clientesPaginados.map((clienteItem) => (
                    <TableRow key={clienteItem.id} hover>
                      <TableCell sx={{ fontWeight: 'medium' }}>
                        <Typography variant="body2" fontWeight="bold">
                          {clienteItem.apellidos}, {clienteItem.nombres}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                          <Chip
                            label={clienteItem.calidad_procesal || 'Víctima Directa'}
                            size="small"
                            variant="outlined"
                            sx={{ height: 18, fontSize: '0.65rem' }}
                          />
                          {clienteItem.condicion_vulnerabilidad && clienteItem.condicion_vulnerabilidad !== 'Ninguna' && (
                            <Chip
                              label={`🛡️ ${clienteItem.condicion_vulnerabilidad}`}
                              size="small"
                              color="secondary"
                              sx={{ height: 18, fontSize: '0.65rem', fontWeight: 'bold' }}
                            />
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontFamily="monospace" fontWeight="bold">
                          {clienteItem.identificacion}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {clienteItem.tipo_identificacion} · {clienteItem.pais || 'CR'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                          <Chip
                            size="small"
                            label={clienteItem.tiene_poder ? '✓ Poder' : '⚠ Poder'}
                            color={clienteItem.tiene_poder ? 'success' : 'default'}
                            variant={clienteItem.tiene_poder ? 'filled' : 'outlined'}
                            sx={{ height: 22, fontSize: '0.7rem', fontWeight: 'bold' }}
                          />
                          <Chip
                            size="small"
                            label={clienteItem.tiene_documento_id ? '✓ ID' : '⚠ ID'}
                            color={clienteItem.tiene_documento_id ? 'success' : 'default'}
                            variant={clienteItem.tiene_documento_id ? 'filled' : 'outlined'}
                            sx={{ height: 22, fontSize: '0.7rem', fontWeight: 'bold' }}
                          />
                          <Chip
                            size="small"
                            label={clienteItem.tiene_prueba_dano ? '✓ Daño' : 'Daño'}
                            color={clienteItem.tiene_prueba_dano ? 'info' : 'default'}
                            variant={clienteItem.tiene_prueba_dano ? 'filled' : 'outlined'}
                            sx={{ height: 22, fontSize: '0.7rem', fontWeight: 'bold' }}
                          />
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{clienteItem.correo_principal || 'Sin correo'}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {clienteItem.telefono_principal ? `${clienteItem.codigo_telefono_principal || ''} ${clienteItem.telefono_principal}` : 'Sin teléfono'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={clienteItem.estado_pago || 'Pendiente'} 
                          size="small" 
                          color={
                            clienteItem.estado_pago === 'Pagado'
                              ? 'success'
                              : clienteItem.estado_pago === 'Abono Parcial'
                              ? 'info'
                              : clienteItem.estado_pago === 'Exonerado / Pro Bono'
                              ? 'secondary'
                              : 'warning'
                          } 
                          sx={{ fontWeight: 'bold' }} 
                        />
                      </TableCell>
                      <TableCell>
                        <IconButton 
                          size="small" 
                          color="primary" 
                          title="Ver Ficha Completa" 
                          onClick={() => setClienteSeleccionadoId(clienteItem.id)}
                        >
                          <Eye size={18} />
                        </IconButton>
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
              labelRowsPerPage="Representados por página:"
              labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`}
            />
          </>
        )}
      </TabPanel>

      {/* PESTAÑA 2: PIEZAS PROCESALES, ANEXOS, GOOGLE DRIVE Y ANALIZADOR IA */}
      <TabPanel value={activeTab} index={1}>
        <Paper 
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDropDocComun}
          sx={{ 
            p: { xs: 2, sm: 3 }, 
            borderRadius: 3, 
            border: isDragging ? '2px dashed #1a365d' : '1px solid #e2e8f0', 
            bgcolor: isDragging ? '#f0f4f8' : '#ffffff',
            boxShadow: 'none',
            transition: 'all 0.2s ease'
          }}
        >
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'center' }, gap: 2, mb: 2.5 }}>
            <Box>
              <Typography variant="h6" fontWeight="bold">Piezas Procesales, Resoluciones y Anexos del Caso</Typography>
              <Typography variant="caption" color="text.secondary">
                Clasifica escritos, resoluciones CIDH/Corte IDH, contestaciones del Estado y analiza plazos fatales con IA.
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<FolderOpen size={16} />}
                onClick={() => setOpenDriveLinkModal(true)}
                sx={{ textTransform: 'none', borderRadius: 2, fontWeight: 'bold' }}
              >
                Vincular desde Google Drive
              </Button>
              <Button 
                variant="contained" 
                size="small"
                component="label" 
                startIcon={<Upload size={16} />} 
                disabled={uploadingDoc} 
                sx={{ textTransform: 'none', borderRadius: 2, fontWeight: 'bold' }}
              >
                {uploadingDoc ? 'Subiendo...' : 'Subir Pieza / Anexo'}
                <input type="file" accept="application/pdf,image/*" hidden onChange={handleUploadDocComun} />
              </Button>
            </Box>
          </Box>

          {/* Filtro por Categoría Procesal */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 2.5 }}>
            {['Todas', ...CATEGORIAS_DOCUMENTOS_PROCESALES].map((cat) => (
              <Chip
                key={cat}
                label={cat}
                size="small"
                color={filtroCategoriaDoc === cat ? 'primary' : 'default'}
                variant={filtroCategoriaDoc === cat ? 'filled' : 'outlined'}
                onClick={() => setFiltroCategoriaDoc(cat)}
                sx={{ fontWeight: 'bold' }}
              />
            ))}
          </Box>
          
          {uploadingDoc && (
            <Box sx={{ width: '100%', mb: 3 }}>
              <LinearProgress variant="determinate" value={uploadProgressDoc} />
            </Box>
          )}

          {/* Panel de Resultado del Analizador Multimodal IA */}
          {resultadoAnalisisDocIA && (
            <Paper sx={{ p: 2.5, mb: 3, borderRadius: 3, border: '1px solid #c7d2fe', bgcolor: '#eef2ff', boxShadow: 'none' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Sparkles size={18} color="#4338ca" />
                  <Typography variant="subtitle1" fontWeight="bold" color="#312e81">
                    Análisis Multimodal de Pieza: {resultadoAnalisisDocIA.docNombre}
                  </Typography>
                  <Chip
                    size="small"
                    label={resultadoAnalisisDocIA._metaIA?.modeloEjecutado || 'gemini-3.8-flash'}
                    sx={{ fontWeight: 'bold', fontSize: '0.7rem', bgcolor: '#ffffff' }}
                  />
                  <Chip
                    size="small"
                    color={resultadoAnalisisDocIA.riesgo_procesal === 'Alto' ? 'error' : 'info'}
                    label={`Riesgo: ${resultadoAnalisisDocIA.riesgo_procesal || 'Medio'}`}
                    sx={{ fontWeight: 'bold', fontSize: '0.7rem' }}
                  />
                </Box>
                <Button size="small" color="inherit" onClick={() => setResultadoAnalisisDocIA(null)} sx={{ textTransform: 'none' }}>
                  Cerrar
                </Button>
              </Box>

              <Typography variant="body2" sx={{ mb: 1.5, bgcolor: '#ffffff', p: 1.5, borderRadius: 2, border: '1px solid #e0e7ff' }}>
                <strong>Resumen Ejecutivo:</strong> {resultadoAnalisisDocIA.resumen_ejecutivo}
              </Typography>

              {Array.isArray(resultadoAnalisisDocIA.puntos_clave) && resultadoAnalisisDocIA.puntos_clave.length > 0 && (
                <Box sx={{ mb: 1.5 }}>
                  <Typography variant="caption" fontWeight="bold" color="text.secondary">
                    Puntos Resolutivos / Argumentos Detectados:
                  </Typography>
                  {resultadoAnalisisDocIA.puntos_clave.map((pt, idx) => (
                    <Typography key={idx} variant="caption" display="block" sx={{ ml: 1 }}>
                      • {pt}
                    </Typography>
                  ))}
                </Box>
              )}

              {resultadoAnalisisDocIA.fecha_vencimiento_sugerida && (
                <Box sx={{ p: 1.5, bgcolor: '#fef2f2', border: '1px solid #fecaca', borderRadius: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                  <Box>
                    <Typography variant="caption" fontWeight="bold" color="error.main" display="block">
                      🚨 PLAZO FATAL DETECTADO EN EL DOCUMENTO: {resultadoAnalisisDocIA.fecha_vencimiento_sugerida}
                    </Typography>
                    <Typography variant="caption" color="text.primary">
                      {resultadoAnalisisDocIA.titulo_plazo_sugerido}
                    </Typography>
                  </Box>
                  <Button
                    size="small"
                    variant="contained"
                    color="error"
                    startIcon={<Calendar size={15} />}
                    onClick={handleAgendarPlazoDesdeIA}
                    sx={{ textTransform: 'none', fontWeight: 'bold' }}
                  >
                    Agendar Plazo Fatal y Sincronizar Calendario
                  </Button>
                </Box>
              )}
            </Paper>
          )}

          {loadingDocs ? (
            <CircularProgress />
          ) : docsComunesFiltrados.length === 0 ? (
            <Alert severity="info">No hay piezas procesales registradas en esta categoría.</Alert>
          ) : (
            <List>
              {docsComunesFiltrados.map((d) => (
                <ListItem key={d.id} disablePadding sx={{ mb: 1, display: 'flex', gap: 1, alignItems: 'center' }}>
                  <Button 
                    component="a" 
                    href={d.url} 
                    target="_blank" 
                    variant="text" 
                    color="inherit" 
                    startIcon={<File size={16} />} 
                    sx={{ flexGrow: 1, justifyContent: 'flex-start', p: 1.5, bgcolor: '#f8fafc', borderRadius: 1.5 }}
                  >
                    <ListItemText 
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                          <Typography variant="subtitle2" fontWeight="bold">
                            {d.nombre}
                          </Typography>
                          <Chip
                            size="small"
                            label={d.categoria_procesal || 'Escrito IIRESODH'}
                            color="primary"
                            variant="outlined"
                            sx={{ height: 20, fontSize: '0.68rem', fontWeight: 'bold' }}
                          />
                          {d.numero_anexo && (
                            <Chip
                              size="small"
                              label={`Anexo ${d.numero_anexo}`}
                              sx={{ height: 20, fontSize: '0.68rem', fontWeight: 'bold', bgcolor: '#e2e8f0' }}
                            />
                          )}
                        </Box>
                      } 
                      secondary={
                        <Box component="span" sx={{ display: 'block', mt: 0.5 }}>
                          <Typography variant="body2" component="span" color="text.primary" sx={{ display: 'block', fontWeight: 'medium' }}>
                            {d.descripcion || 'Sin descripción configurada.'}
                          </Typography>
                          <Typography variant="caption" component="span" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                            {`Fecha Doc: ${d.fecha_documento || 'No específica'} | Subido: ${d.fecha_subida ? new Date(d.fecha_subida).toLocaleString() : ''}`}
                          </Typography>
                        </Box>
                      } 
                    />
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={analizandoDocIAId === d.id ? <CircularProgress size={14} /> : <Sparkles size={15} />}
                    disabled={analizandoDocIAId === d.id}
                    onClick={() => handleAnalizarPiezaIA(d)}
                    sx={{ textTransform: 'none', fontWeight: 'bold', borderRadius: 2, whiteSpace: 'nowrap' }}
                  >
                    Analizar IA
                  </Button>
                  <IconButton 
                    size="small" 
                    color="error" 
                    onClick={() => handleDeleteDocComun(d.id, d.storage_path)} 
                    sx={{ border: '1px solid #fee2e2', bgcolor: '#fef2f2', p: 1.25 }}
                  >
                    <Trash2 size={18} />
                  </IconButton>
                </ListItem>
              ))}
            </List>
          )}
        </Paper>
      </TabPanel>

      {/* PESTAÑA 3: CONTROL FINANCIERO, APORTES Y REPARACIONES (PILAR 4) */}
      <TabPanel value={activeTab} index={2}>
        <Paper sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: 'none' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2, mb: 3 }}>
            <Box>
              <Typography variant="h6" fontWeight="bold">Control Financiero, Aportes y Conciliación Stripe / SINPE</Typography>
              <Typography variant="body2" color="text.secondary">
                Gestión en tiempo real de los aportes procesales, exoneraciones Pro Bono y referencias bancarias de cada representado.
              </Typography>
            </Box>
            <Button
              variant="outlined"
              size="small"
              startIcon={<Download size={16} />}
              onClick={handleExportarPadronCSV}
              sx={{ textTransform: 'none', fontWeight: 'bold', borderRadius: 2 }}
            >
              Exportar Reporte Financiero CSV
            </Button>
          </Box>

          {/* KPIs Financieros */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2, mb: 3 }}>
            <Paper sx={{ p: 2, borderRadius: 2, bgcolor: '#f0fdf4', border: '1px solid #bbf7d0', boxShadow: 'none' }}>
              <Typography variant="caption" fontWeight="bold" color="#15803d">TOTAL RECAUDADO (USD)</Typography>
              <Typography variant="h5" fontWeight="bold" color="#14532d">
                ${metricasFinancieras.totalUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                CRC: ₡{metricasFinancieras.totalCRC.toLocaleString('es-CR')}
              </Typography>
            </Paper>

            <Paper sx={{ p: 2, borderRadius: 2, bgcolor: '#f8fafc', border: '1px solid #e2e8f0', boxShadow: 'none' }}>
              <Typography variant="caption" fontWeight="bold" color="text.secondary">PAGADOS / AL DÍA</Typography>
              <Typography variant="h5" fontWeight="bold" color="success.main">
                {metricasFinancieras.pagados}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                De {clientes.length} representados
              </Typography>
            </Paper>

            <Paper sx={{ p: 2, borderRadius: 2, bgcolor: '#fffbeb', border: '1px solid #fde68a', boxShadow: 'none' }}>
              <Typography variant="caption" fontWeight="bold" color="#b45309">PENDIENTES / ABONO PARCIAL</Typography>
              <Typography variant="h5" fontWeight="bold" color="#92400e">
                {metricasFinancieras.pendientes + metricasFinancieras.abonos}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Abonos parciales: {metricasFinancieras.abonos}
              </Typography>
            </Paper>

            <Paper sx={{ p: 2, borderRadius: 2, bgcolor: '#faf5ff', border: '1px solid #e9d5ff', boxShadow: 'none' }}>
              <Typography variant="caption" fontWeight="bold" color="#7e22ce">EXONERADOS / PRO BONO</Typography>
              <Typography variant="h5" fontWeight="bold" color="#581c87">
                {metricasFinancieras.exonerados}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Cobertura solidaria institucional
              </Typography>
            </Paper>
          </Box>

          <TableContainer sx={{ borderRadius: 2, border: '1px solid #e2e8f0', maxHeight: 480 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f8fafc' }}>Representado</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f8fafc' }}>Estado de Pago</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f8fafc' }}>Monto Aportado</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f8fafc' }}>Moneda</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f8fafc' }}>Vía de Pago</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f8fafc' }}>Comprobante / Ref</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {clientes.map((c) => (
                  <TableRow key={c.id} hover>
                    <TableCell sx={{ fontWeight: 'bold', fontSize: '0.8rem' }}>
                      {c.apellidos}, {c.nombres}
                    </TableCell>
                    <TableCell>
                      <Select
                        size="small"
                        value={c.estado_pago || 'Pendiente'}
                        onChange={(e) => handleActualizarPagoRapido(c, { estado_pago: e.target.value })}
                        sx={{ fontSize: '0.78rem', height: 30 }}
                      >
                        {ESTADOS_PAGO_CLIENTE.map((st) => (
                          <MenuItem key={st} value={st} sx={{ fontSize: '0.78rem' }}>
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
                        onBlur={(e) => handleActualizarPagoRapido(c, { monto_pagado: Number(e.target.value) || 0 })}
                        sx={{ width: 105, '& input': { py: 0.5, fontSize: '0.8rem' } }}
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        size="small"
                        value={c.moneda_pago || 'USD'}
                        onChange={(e) => handleActualizarPagoRapido(c, { moneda_pago: e.target.value })}
                        sx={{ fontSize: '0.78rem', height: 30 }}
                      >
                        <MenuItem value="USD">USD</MenuItem>
                        <MenuItem value="CRC">CRC</MenuItem>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        size="small"
                        value={c.metodo_pago || 'Transferencia / SINPE'}
                        onChange={(e) => handleActualizarPagoRapido(c, { metodo_pago: e.target.value })}
                        sx={{ fontSize: '0.78rem', height: 30 }}
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
                        onBlur={(e) => handleActualizarPagoRapido(c, { referencia_pago: e.target.value.trim() })}
                        sx={{ width: 140, '& input': { py: 0.5, fontSize: '0.8rem' } }}
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
        <Paper sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: 'none' }}>
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, gap: 2, mb: 3 }}>
            <Box>
              <Typography variant="h6" fontWeight="bold">Fechas Fatales y Plazos Judiciales (Sincronizados con Calendario Institucional)</Typography>
              <Typography variant="body2" color="text.secondary">
                Seguimiento de términos perentorios asociados a notificaciones oficiales de la CIDH, Corte IDH, ONU o Tribunales.
              </Typography>
            </Box>
            <Button 
              variant="contained" 
              startIcon={<Calendar size={18} />} 
              onClick={() => setOpenPlazoModal(true)} 
              sx={{ textTransform: 'none', borderRadius: 2, fontWeight: 'bold', width: { xs: '100%', sm: 'auto' } }}
            >
              Cargar Fecha Fatal
            </Button>
          </Box>

          {localPlazos.length === 0 ? (
            <Alert severity="info" sx={{ borderRadius: 2 }}>No hay plazos procesales configurados para este litigio.</Alert>
          ) : (
            <TableContainer component={Paper} sx={{ borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: 'none', overflowX: 'auto' }}>
              <Table size="small" sx={{ minWidth: 700 }}>
                <TableHead sx={{ bgcolor: '#f8fafc' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Término Procesal / Responsable</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Fecha Límite</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Estatus</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Documento Probatorio</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', textAlign: 'center' }}>Acción</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {localPlazos.map((plazo) => {
                    const cfg = (() => {
                      if (plazo.completado) return { colorChip: 'success', label: 'Presentado', bgFila: '#ffffff' };
                      const hoy = new Date();
                      hoy.setHours(0,0,0,0);
                      const fatal = new Date(plazo.fechaFatal + 'T00:00:00');
                      fatal.setHours(0,0,0,0);
                      const diff = Math.ceil((fatal.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));

                      if (diff < 0) return { colorChip: 'error', label: 'Vencido', bgFila: '#fef2f2' };
                      if (diff <= 2) return { colorChip: 'error', label: 'CRÍTICO', bgFila: '#fef2f2' };
                      if (diff <= 5) return { colorChip: 'warning', label: 'Advertencia', bgFila: '#fffbeb' };
                      return { colorChip: 'info', label: 'A tiempo', bgFila: '#ffffff' };
                    })();

                    return (
                      <TableRow key={plazo.id} sx={{ bgcolor: cfg.bgFila }} hover>
                        <TableCell sx={{ fontWeight: 'medium', py: 1.5 }}>
                          <Typography variant="body2" fontWeight="bold">{plazo.descripcion}</Typography>
                          {(plazo.responsable || plazo.prorroga) && (
                            <Typography variant="caption" color="text.secondary">
                              {plazo.responsable ? `⚖️ ${plazo.responsable}` : ''}
                              {plazo.prorroga ? ` · Nota: ${plazo.prorroga}` : ''}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 'bold', color: '#b91c1c' }}>{plazo.fechaFatal}</TableCell>
                        <TableCell><Chip label={cfg.label} color={cfg.colorChip} size="small" sx={{ fontWeight: 'bold' }} /></TableCell>
                        <TableCell sx={{ fontSize: '0.8rem' }}>
                          {plazo.completado ? (
                            <Box>
                              <Button
                                component="a"
                                href={plazo.documentoProbatorioUrl}
                                target="_blank"
                                rel="noopener"
                                variant="text"
                                size="small"
                                startIcon={<File size={14} />}
                                sx={{ textTransform: 'none', p: 0, fontWeight: 'bold', justifyContent: 'flex-start' }}
                              >
                                {plazo.documentoProbatorioNombre || 'Ver Archivo'}
                              </Button>
                              <Typography variant="caption" display="block" color="text.primary" sx={{ fontWeight: 'medium', mt: 0.5 }}>
                                {plazo.documentoProbatorioDescripcion}
                              </Typography>
                              <Typography variant="caption" display="block" color="text.secondary">
                                Fecha Doc: {plazo.documentoProbatorioFechaDocumento || 'No asignada'}
                              </Typography>
                            </Box>
                          ) : (
                            <Typography variant="caption" color="text.disabled" sx={{ fontStyle: 'italic' }}>
                              Exigible ante la instancia
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell sx={{ textAlign: 'center' }}>
                          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1 }}>
                            {!plazo.completado ? (
                              <Button 
                                variant="contained" 
                                color="success" 
                                size="small" 
                                onClick={() => { setPlazoAActivar(plazo); setOpenCerrarModal(true); }}
                                sx={{ textTransform: 'none', fontWeight: 'bold', borderRadius: 1.5 }}
                              >
                                Cerrar
                              </Button>
                            ) : (
                              <Chip label="Histórico" size="small" variant="outlined" disabled />
                            )}
                            <IconButton size="small" color="error" onClick={() => handleEliminarPlazo(plazo.id)}>
                              <Trash2 size={15} />
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
        <Paper sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: 'none' }}>
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, gap: 2, mb: 3 }}>
            <Box>
              <Typography variant="h6" fontWeight="bold">Historial de Comunicados Enviados</Typography>
              <Typography variant="body2" color="text.secondary">Registro de circulares y comunicados enviados por correo a los representados.</Typography>
            </Box>
            <Button 
              variant="contained" 
              startIcon={<Plus size={18} />} 
              onClick={() => {
                setClientesSeleccionadosIds([]);
                setFiltroDestinatarios('');
                setTipoDestinatario('todos');
                setOpenComunicadoModal(true);
              }} 
              sx={{ textTransform: 'none', borderRadius: 2, fontWeight: 'bold', width: { xs: '100%', sm: 'auto' } }}
            >
              Redactar Comunicado
            </Button>
          </Box>

          {loadingComunicados ? (
            <CircularProgress />
          ) : comunicados.length === 0 ? (
            <Alert severity="info">No se registran comunicados masivos enviados para este litigio.</Alert>
          ) : (
            <List>
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

      {/* PESTAÑA 6: COPILOTO JURÍDICO INTERNACIONAL IA (GEMINI 4 ARGON / 3.8 FLASH / 3.5 FLASH-LITE) */}
      <TabPanel value={activeTab} index={5}>
        <Paper sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3, border: '1px solid #c7d2fe', bgcolor: '#f8fafc', boxShadow: 'none' }}>
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'center' }, gap: 2, mb: 3 }}>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Sparkles size={22} color="#4338ca" />
                <Typography variant="h6" fontWeight="bold" color="#1e1b4b">
                  Copiloto Jurídico Internacional IIRESODH (Vertex AI / Firebase AI Logic)
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Asistente especializado en el Sistema Interamericano (CIDH / Corte IDH) y ONU, conectado al contexto real de este expediente sin exponer API keys.
              </Typography>
            </Box>

            <Chip
              label="🧠 Enrutamiento Automático: Gemini 4 Argon (Pensamiento Avanzado)"
              color="primary"
              sx={{ fontWeight: 'bold', bgcolor: '#312e81', color: '#ffffff' }}
            />
          </Box>

          {/* Plantillas Jurídicas Interamericanas de 1 Clic */}
          <Typography variant="caption" fontWeight="bold" color="text.secondary" sx={{ display: 'block', mb: 1, textTransform: 'uppercase' }}>
            Generadores Estratégicos de 1 Clic (Contextualizados con los datos de "{caso.nombre}"):
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, gap: 1.5, mb: 3 }}>
            {[
              {
                titulo: '🌎 Test de Admisibilidad (Arts. 46-47 CADH)',
                prompt: 'Elabora un análisis exhaustivo de admisibilidad ante la CIDH (Arts. 46 y 47 CADH y Arts. 31-34 del Reglamento CIDH), evaluando agotamiento de recursos internos o las excepciones del Art. 46.2 CADH aplicables a este caso, plazo o situación continuada y caracterización (colorable claim).'
              },
              {
                titulo: '🏛️ Estándares y Jurisprudencia Corte IDH',
                prompt: 'Construye una matriz de estándares jurisprudenciales de la Corte IDH aplicables a los derechos invocados en este caso, citando casos contenciosos líderes (leading cases) y cómo subsumir los hechos del expediente en dichos estándares.'
              },
              {
                titulo: '🚨 Solicitud de Medidas Cautelares (Art. 25 CIDH)',
                prompt: 'Redacta la estructura argumentativa para una solicitud de Medidas Cautelares (Art. 25 Reglamento CIDH) o Medidas Provisionales (Art. 63.2 CADH), acreditando gravedad, urgencia e irreparabilidad del daño.'
              },
              {
                titulo: '⚡ Tramitación Prioritaria (Art. 29.2 CIDH)',
                prompt: 'Redacta un escrito fundamentado solicitando el adelanto de estudio / tramitación prioritaria conforme al Artículo 29.2 del Reglamento de la CIDH, destacando las condiciones de vulnerabilidad del padrón de víctimas.'
              },
              {
                titulo: '💰 Pretensiones y Reparaciones (Art. 63.1 CADH)',
                prompt: 'Diseña el pliego integral de reparaciones bajo el Art. 63.1 de la CADH para el ESAP o alegatos de fondo: restitución, rehabilitación, satisfacción, garantías de no repetición y criterios de daño material e inmaterial.'
              },
              {
                titulo: '🤝 Ruta de Solución Amistosa (Art. 40 CIDH)',
                prompt: 'Propón una hoja de ruta estratégica y cláusulas esenciales para negociar un Acuerdo de Solución Amistosa (Art. 40 Reglamento CIDH) con el Estado demandado garantizando supervisión internacional.'
              }
            ].map((item) => (
              <Button
                key={item.titulo}
                variant="outlined"
                disabled={ejecutandoCopilotoIA}
                onClick={() => {
                  setConsultaCopilotoIA(item.prompt);
                  handleEjecutarCopilotoIA(item.prompt);
                }}
                sx={{
                  textTransform: 'none',
                  fontWeight: 'bold',
                  justifyContent: 'flex-start',
                  textAlign: 'left',
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: '#ffffff',
                  borderColor: '#cbd5e1',
                  '&:hover': { bgcolor: '#eef2ff', borderColor: '#6366f1' }
                }}
              >
                {item.titulo}
              </Button>
            ))}
          </Box>

          {/* Caja de Consulta Libre */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 3 }}>
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Consulta jurídica libre o instrucción de redacción procesal"
              placeholder="Ej: Redacta los puntos petitorios para el Escrito de Solicitudes, Argumentos y Pruebas (ESAP) conforme al Art. 40 del Reglamento de la Corte IDH..."
              value={consultaCopilotoIA}
              onChange={(e) => setConsultaCopilotoIA(e.target.value)}
              sx={{ bgcolor: '#ffffff' }}
            />
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="contained"
                startIcon={ejecutandoCopilotoIA ? <CircularProgress size={16} color="inherit" /> : <Sparkles size={18} />}
                disabled={ejecutandoCopilotoIA || !consultaCopilotoIA.trim()}
                onClick={() => handleEjecutarCopilotoIA()}
                sx={{
                  textTransform: 'none',
                  fontWeight: 'bold',
                  borderRadius: 2,
                  px: 3,
                  background: 'linear-gradient(90deg, #312e81 0%, #6d28d9 100%)'
                }}
              >
                {ejecutandoCopilotoIA ? 'Razonando estrategia jurídica...' : 'Ejecutar Análisis con IA'}
              </Button>
            </Box>
          </Box>

          {/* Resultado del Copiloto Jurídico IA */}
          {respuestaCopilotoIA && (
            <Paper sx={{ p: 3, borderRadius: 2.5, bgcolor: '#ffffff', border: '1px solid #c7d2fe', boxShadow: 'none' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 2, pb: 1.5, borderBottom: '1px solid #e2e8f0' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Chip
                    label={respuestaCopilotoIA.badge || respuestaCopilotoIA.modeloEjecutado}
                    color="primary"
                    size="small"
                    sx={{ fontWeight: 'bold' }}
                  />
                  <Chip
                    label={`Modelo: ${respuestaCopilotoIA.modeloEjecutado}`}
                    size="small"
                    variant="outlined"
                    sx={{ fontWeight: 'bold', fontFamily: 'monospace' }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    Vía {respuestaCopilotoIA.backendUtilizado} · {respuestaCopilotoIA.fecha}
                  </Typography>
                </Box>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    navigator.clipboard.writeText(respuestaCopilotoIA.text);
                    alert('✅ Dictamen copiado al portapapeles.');
                  }}
                  sx={{ textTransform: 'none', fontWeight: 'bold' }}
                >
                  📋 Copiar Dictamen
                </Button>
              </Box>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, color: '#1e293b' }}>
                {respuestaCopilotoIA.text}
              </Typography>
            </Paper>
          )}
        </Paper>
      </TabPanel>

      {/* MODAL DE AGREGAR CLIENTE EXTENDIDO + AUTOCOMPLETADO OCR IA */}
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
            {autocompletandoOcrCliente ? 'Extrayendo con Gemini 3.8 Flash...' : '✨ Autocompletar desde Cédula/Pasaporte'}
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
              <InputLabel>Calidad Procesal (SIDH)</InputLabel>
              <Select value={calidadProcesalInput} label="Calidad Procesal (SIDH)" onChange={(e) => setCalidadProcesalInput(e.target.value)}>
                {CALIDADES_PROCESALES.map((cal) => <MenuItem key={cal} value={cal}>{cal}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Vulnerabilidad (Art. 29.2 CIDH)</InputLabel>
              <Select value={vulnerabilidadInput} label="Vulnerabilidad (Art. 29.2 CIDH)" onChange={(e) => setVulnerabilidadInput(e.target.value)}>
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
            El Semáforo Art. 35 (Poder, Cédula/ID y Prueba de Daño) se activa en verde automáticamente al subir y verificar los documentos con IA.
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
          {/* Asistente IA de Redacción en Lenguaje Claro */}
          <Box sx={{ p: 2, bgcolor: '#eef2ff', borderRadius: 2, border: '1px solid #c7d2fe' }}>
            <Typography variant="caption" fontWeight="bold" color="#312e81" sx={{ display: 'block', mb: 1 }}>
              ✨ Redactor IA de Circulares en Lenguaje Claro (Gemini 3.8 Flash / 3.5 Flash-Lite)
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
                placeholder="Instrucción opcional para la IA..."
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
              {redactandoComunicadoIA ? 'Redactando borrador...' : 'Generar Borrador con IA'}
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