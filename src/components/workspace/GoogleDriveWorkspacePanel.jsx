// src/components/workspace/GoogleDriveWorkspacePanel.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  TextField,
  Paper,
  Chip,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  Snackbar,
  Alert,
  InputAdornment,
  ToggleButtonGroup,
  ToggleButton,
  CircularProgress,
  Breadcrumbs,
  Link
} from '@mui/material';
import {
  Folder,
  FileText,
  FileSpreadsheet,
  Presentation,
  File,
  Plus,
  Search,
  Star,
  ExternalLink,
  Eye,
  Trash2,
  Edit3,
  Send,
  X,
  HardDrive,
  Check,
  LayoutGrid,
  List as ListIcon,
  FolderOpen,
  Lock,
  ShieldCheck,
  ShieldAlert,
  Users,
  Hash,
  ChevronRight,
  RefreshCw
} from 'lucide-react';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import {
  obtenerTokenGoogleDriveActivo,
  solicitarTokenGoogleDrive,
  limpiarTokenGoogleDrive,
  extraerIdRecursoDrive,
  sincronizarPermisosDriveConCanal
} from '../../context/AuthContext';
import GoogleDriveSelectorBrowser, {
  detectarTipoPorMimeType,
  construirUrlDrive
} from './GoogleDriveSelectorBrowser';

export const TIPOS_DRIVE = {
  carpeta: {
    id: 'carpeta',
    label: 'Carpeta de Drive',
    color: '#b45309',
    bg: '#fffbeb',
    border: '#fde68a',
    icon: Folder
  },
  doc: {
    id: 'doc',
    label: 'Google Docs',
    color: '#1d4ed8',
    bg: '#eff6ff',
    border: '#bfdbfe',
    icon: FileText
  },
  sheet: {
    id: 'sheet',
    label: 'Google Sheets',
    color: '#047857',
    bg: '#ecfdf5',
    border: '#a7f3d0',
    icon: FileSpreadsheet
  },
  slide: {
    id: 'slide',
    label: 'Google Slides',
    color: '#c2410c',
    bg: '#fff7ed',
    border: '#fed7aa',
    icon: Presentation
  },
  pdf: {
    id: 'pdf',
    label: 'Documento PDF / Archivo',
    color: '#be123c',
    bg: '#fff1f2',
    border: '#fecdd3',
    icon: File
  }
};

// Detecta automáticamente el tipo de recurso a partir de la URL de Google Drive / Workspace
export function detectarTipoDrivePorUrl(url = '') {
  const lower = url.toLowerCase();
  if (lower.includes('/folders/') || lower.includes('embeddedfolderview')) return 'carpeta';
  if (lower.includes('docs.google.com/document')) return 'doc';
  if (lower.includes('docs.google.com/spreadsheets')) return 'sheet';
  if (lower.includes('docs.google.com/presentation')) return 'slide';
  return 'pdf';
}

// Transforma enlaces de documentos individuales de Google Drive/Docs en URL embebible
export function convertirUrlDriveAEmbed(url = '', modo = 'preview') {
  if (!url) return '';
  try {
    // 1. Google Docs / Sheets / Slides: https://docs.google.com/(document|spreadsheets|presentation)/d/FILE_ID/...
    const docsMatch = url.match(/docs\.google\.com\/(document|spreadsheets|presentation)\/d\/([a-zA-Z0-9_-]+)/);
    if (docsMatch && docsMatch[2]) {
      const tipoDoc = docsMatch[1];
      const fileId = docsMatch[2];
      return modo === 'edit'
        ? `https://docs.google.com/${tipoDoc}/d/${fileId}/edit?usp=embedded`
        : `https://docs.google.com/${tipoDoc}/d/${fileId}/preview`;
    }

    // 2. Archivo individual de Drive: https://drive.google.com/file/d/FILE_ID/view
    const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (fileMatch && fileMatch[1]) {
      return `https://drive.google.com/file/d/${fileMatch[1]}/preview`;
    }

    // 3. Parámetro ?id=FILE_ID
    const idParamMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (idParamMatch && idParamMatch[1]) {
      return `https://drive.google.com/file/d/${idParamMatch[1]}/preview`;
    }

    return url;
  } catch {
    return url;
  }
}

/**
 * Visor autenticado para carpetas privadas de Google Drive.
 * A diferencia de embeddedfolderview (que exigía "Cualquiera con el vínculo"),
 * este visor usa el token OAuth institucional del miembro del canal para explorar
 * carpetas 100% privadas sin abrirlas nunca al público.
 */
function VisorCarpetaPrivadaDrive({
  carpetaItem,
  userEmail,
  getGoogleWorkspaceUrl,
  onAbrirArchivoInterno
}) {
  const rootFolderId = extraerIdRecursoDrive(carpetaItem?.url || '');
  const [token, setToken] = useState(() => obtenerTokenGoogleDriveActivo());
  const [cargando, setCargando] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [archivosHijos, setArchivosHijos] = useState([]);
  const [rutaSubcarpetas, setRutaSubcarpetas] = useState([
    { id: rootFolderId, name: carpetaItem?.titulo || 'Carpeta Privada' }
  ]);

  useEffect(() => {
    const nuevoId = extraerIdRecursoDrive(carpetaItem?.url || '');
    setRutaSubcarpetas([{ id: nuevoId, name: carpetaItem?.titulo || 'Carpeta Privada' }]);
  }, [carpetaItem?.id, carpetaItem?.url, carpetaItem?.titulo]);

  const nodoActual = rutaSubcarpetas[rutaSubcarpetas.length - 1] || {
    id: rootFolderId,
    name: carpetaItem?.titulo || 'Carpeta'
  };

  const cargarContenidoCarpeta = useCallback(async () => {
    if (!token || !nodoActual.id) return;
    setCargando(true);
    setErrorMsg('');
    try {
      const q = `'${nodoActual.id}' in parents and trashed = false`;
      const params = new URLSearchParams({
        q,
        pageSize: '100',
        orderBy: 'folder,name',
        supportsAllDrives: 'true',
        includeItemsFromAllDrives: 'true',
        fields: 'files(id,name,mimeType,webViewLink,modifiedTime,size)'
      });
      const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.status === 401) {
        limpiarTokenGoogleDrive();
        setToken(null);
        setErrorMsg('Tu sesión de lectura de Google Drive expiró. Conecta tu cuenta para ver la carpeta privada.');
        setCargando(false);
        return;
      }

      if (!res.ok) {
        throw new Error('No tienes acceso a esta carpeta en Google Drive o requiere autorización.');
      }

      const data = await res.json();
      setArchivosHijos(data.files || []);
    } catch (e) {
      setErrorMsg(e?.message || 'No se pudo listar el contenido de la carpeta privada.');
    } finally {
      setCargando(false);
    }
  }, [token, nodoActual.id]);

  useEffect(() => {
    if (token && nodoActual.id) {
      cargarContenidoCarpeta();
    }
  }, [token, nodoActual.id, cargarContenidoCarpeta]);

  const handleAutorizar = async () => {
    try {
      const tk = await solicitarTokenGoogleDrive(userEmail, true);
      if (tk) setToken(tk);
    } catch {
      setErrorMsg('No se completó la autorización con Google Drive.');
    }
  };

  if (!token) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Lock size={34} color="#1D3557" style={{ margin: '0 auto 10px' }} />
        <Typography variant="subtitle1" fontWeight="800" color="#1D3557">
          Carpeta Privada Protegida por Canal
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 440, mx: 'auto', mt: 0.5, mb: 2 }}>
          Esta carpeta no es pública (&ldquo;Cualquiera con el vínculo&rdquo; está desactivado). Autoriza tu sesión institucional para explorar sus archivos como miembro del canal.
        </Typography>
        <Button
          variant="contained"
          onClick={handleAutorizar}
          startIcon={<ShieldCheck size={16} />}
          sx={{ bgcolor: '#1D3557', textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
        >
          Ver Contenido con mi Cuenta @iiresodh.org
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: '#ffffff' }}>
      {/* Barra de ruta dentro de la carpeta privada */}
      <Box
        sx={{
          px: 2,
          py: 1,
          bgcolor: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          flexWrap: 'wrap'
        }}
      >
        <Breadcrumbs separator={<ChevronRight size={13} color="#94a3b8" />}>
          {rutaSubcarpetas.map((nodo, idx) => {
            const esUltimo = idx === rutaSubcarpetas.length - 1;
            return (
              <Link
                key={`${nodo.id}_${idx}`}
                component="button"
                underline="hover"
                onClick={() => setRutaSubcarpetas((prev) => prev.slice(0, idx + 1))}
                sx={{
                  fontSize: '0.76rem',
                  fontWeight: esUltimo ? 800 : 600,
                  color: esUltimo ? '#1D3557' : '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5
                }}
              >
                <Folder size={13} color="#b45309" />
                {nodo.name}
              </Link>
            );
          })}
        </Breadcrumbs>

        <IconButton size="small" onClick={cargarContenidoCarpeta} title="Actualizar carpeta">
          <RefreshCw size={14} />
        </IconButton>
      </Box>

      <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 2 }}>
        {cargando ? (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <CircularProgress size={26} sx={{ color: '#1D3557' }} />
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              Cargando archivos de la carpeta privada...
            </Typography>
          </Box>
        ) : errorMsg ? (
          <Alert
            severity="warning"
            action={
              <Button color="inherit" size="small" onClick={handleAutorizar}>
                Reautorizar
              </Button>
            }
          >
            {errorMsg}
          </Alert>
        ) : archivosHijos.length === 0 ? (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <FolderOpen size={36} color="#94a3b8" style={{ margin: '0 auto 8px' }} />
            <Typography variant="body2" fontWeight="700" color="text.secondary">
              Esta carpeta está vacía actualmente.
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {archivosHijos.map((file) => {
              const esSubcarpeta = file.mimeType === 'application/vnd.google-apps.folder';
              const urlArchivo = construirUrlDrive(file);
              const tipoDetectado = detectarTipoPorMimeType(file.mimeType, urlArchivo);
              const cfg = TIPOS_DRIVE[tipoDetectado] || TIPOS_DRIVE.pdf;
              const Icono = cfg.icon;

              return (
                <Paper
                  key={file.id}
                  elevation={0}
                  sx={{
                    p: 1.25,
                    borderRadius: 2,
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 1.5,
                    '&:hover': { bgcolor: '#f8fafc', borderColor: '#cbd5e1' }
                  }}
                >
                  <Box
                    onClick={() => {
                      if (esSubcarpeta) {
                        setRutaSubcarpetas((prev) => [...prev, { id: file.id, name: file.name }]);
                      } else if (onAbrirArchivoInterno) {
                        onAbrirArchivoInterno({
                          id: file.id,
                          titulo: file.name,
                          url: urlArchivo,
                          tipo: tipoDetectado
                        });
                      }
                    }}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.25,
                      minWidth: 0,
                      flex: 1,
                      cursor: 'pointer'
                    }}
                  >
                    <Box
                      sx={{
                        p: 0.75,
                        borderRadius: 1.5,
                        bgcolor: cfg.bg,
                        color: cfg.color,
                        border: `1px solid ${cfg.border}`,
                        display: 'flex'
                      }}
                    >
                      <Icono size={16} />
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" fontWeight="700" color="#0f233c" noWrap>
                        {file.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {cfg.label}
                      </Typography>
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    {esSubcarpeta ? (
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() =>
                          setRutaSubcarpetas((prev) => [...prev, { id: file.id, name: file.name }])
                        }
                        sx={{ textTransform: 'none', fontSize: '0.72rem', borderRadius: 1.5 }}
                      >
                        Abrir carpeta
                      </Button>
                    ) : (
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<Eye size={13} />}
                        onClick={() =>
                          onAbrirArchivoInterno &&
                          onAbrirArchivoInterno({
                            id: file.id,
                            titulo: file.name,
                            url: urlArchivo,
                            tipo: tipoDetectado
                          })
                        }
                        sx={{ textTransform: 'none', fontSize: '0.72rem', borderRadius: 1.5 }}
                      >
                        Ver aquí
                      </Button>
                    )}
                    <Tooltip title="Abrir en Google Drive">
                      <IconButton
                        size="small"
                        component="a"
                        href={getGoogleWorkspaceUrl(urlArchivo)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink size={14} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Paper>
              );
            })}
          </Box>
        )}
      </Box>
    </Box>
  );
}

export default function GoogleDriveWorkspacePanel({
  currentUser,
  userName,
  userRole,
  usuariosEquipo = [],
  canalesDisponibles = [],
  canalActivoInicialId = 'general',
  initialPreviewItem = null,
  onClearInitialPreview,
  onIrACanal
}) {
  const [itemsDrive, setItemsDrive] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [filtroCanalId, setFiltroCanalId] = useState('todos');
  const [modoVista, setModoVista] = useState('grid'); // 'grid' | 'lista'

  // Visor embebido activo
  const [itemEnVisor, setItemEnVisor] = useState(null);
  const [modoVisor, setModoVisor] = useState('preview'); // 'preview' | 'edit'

  // Modal de agregar/editar vínculo de Google Drive
  const [modalOpen, setModalOpen] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [sincronizandoPermisos, setSincronizandoPermisos] = useState(false);
  const [form, setForm] = useState({
    titulo: '',
    url: '',
    tipo: 'doc',
    categoria: 'Litigios y Expedientes',
    descripcion: '',
    destacado: false,
    canalId: canalActivoInicialId || 'general',
    rolDriveMiembros: 'reader', // 'reader' | 'writer'
    publicarEnChat: true
  });

  // Modal para compartir/restringir un item existente a un canal específico
  const [modalCompartirItem, setModalCompartirItem] = useState(null);
  const [canalDestinoCompartir, setCanalDestinoCompartir] = useState('general');
  const [rolDestinoCompartir, setRolDestinoCompartir] = useState('reader');
  const [compartiendoEnCanal, setCompartiendoEnCanal] = useState(false);

  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });

  const userEmail = (currentUser?.email || '').toLowerCase();

  // Canales disponibles (excluyendo o incluyendo según corresponda)
  const canalesSeleccionables = useMemo(() => {
    return canalesDisponibles.filter((c) => c.tipo !== 'dm');
  }, [canalesDisponibles]);

  // Calcula la lista exacta de correos autorizados para un canal determinado
  const obtenerMiembrosDelCanal = useCallback(
    (canalIdTarget) => {
      const canal = canalesDisponibles.find((c) => c.id === canalIdTarget);
      if (!canal) {
        return userEmail ? [userEmail] : [];
      }

      if (canal.tipo === 'dm') {
        return Array.from(
          new Set(
            [...(canal.participantes || []), userEmail]
              .map((e) => (e || '').toLowerCase())
              .filter(Boolean)
          )
        );
      }

      if (canal.esPrivado) {
        return Array.from(
          new Set(
            [...(canal.miembros || []), canal.creadoPor, userEmail]
              .map((e) => (e || '').toLowerCase())
              .filter(Boolean)
          )
        );
      }

      // Canal abierto institucional: solo los miembros autorizados del equipo IIRESODH (nunca personas ajenas)
      const baseMiembros =
        Array.isArray(canal.miembros) && canal.miembros.length > 0
          ? canal.miembros
          : usuariosEquipo.map((u) => u.email);

      return Array.from(
        new Set(
          [...baseMiembros, canal.creadoPor, userEmail]
            .map((e) => (e || '').toLowerCase())
            .filter(Boolean)
        )
      );
    },
    [canalesDisponibles, usuariosEquipo, userEmail]
  );

  // Verifica si el usuario actual es miembro autorizado del canal al que pertenece el documento/carpeta
  const usuarioTieneAccesoAItemDrive = useCallback(
    (item) => {
      if (!item) return false;
      const creador = (item.creadoPorEmail || '').toLowerCase();
      if (creador && creador === userEmail) return true;

      // Si el item está vinculado a un canal específico, el usuario DEBE ser miembro de ese canal
      if (item.canalId) {
        const canal = canalesDisponibles.find((c) => c.id === item.canalId);
        if (!canal) return false;

        if (canal.esPrivado) {
          const miembrosCanal = obtenerMiembrosDelCanal(canal.id);
          return miembrosCanal.includes(userEmail);
        }

        if (Array.isArray(item.miembrosAutorizados) && item.miembrosAutorizados.length > 0) {
          return item.miembrosAutorizados.map((e) => e.toLowerCase()).includes(userEmail);
        }

        return true;
      }

      // Si tiene lista explícita de miembrosAutorizados
      if (Array.isArray(item.miembrosAutorizados) && item.miembrosAutorizados.length > 0) {
        return item.miembrosAutorizados.map((e) => e.toLowerCase()).includes(userEmail);
      }

      // Recursos antiguos sin canal asignado: visibles para quien los creó o administradores para que los asignen a un canal
      return userRole === 'Superadmin' || userRole === 'Admin';
    },
    [canalesDisponibles, obtenerMiembrosDelCanal, userEmail, userRole]
  );

  // Escuchar elementos de la biblioteca de Google Drive en Firestore
  useEffect(() => {
    const q = query(collection(db, 'workspace_drive'), orderBy('creadoEn', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setItemsDrive(docs);
      },
      (err) => console.error('Error escuchando workspace_drive:', err)
    );
    return () => unsub();
  }, []);

  // Si se solicita abrir un documento desde el Chat o desde Tareas
  useEffect(() => {
    if (initialPreviewItem) {
      setItemEnVisor(initialPreviewItem);
      if (onClearInitialPreview) onClearInitialPreview();
    }
  }, [initialPreviewItem, onClearInitialPreview]);

  // Generar enlace forzando cuenta institucional @iiresodh.org
  const getGoogleWorkspaceUrl = (targetUrl) => {
    return `https://accounts.google.com/AccountChooser?Email=${encodeURIComponent(
      userEmail
    )}&continue=${encodeURIComponent(targetUrl)}`;
  };

  const abrirModalNuevo = (tipoPredefinido = 'doc') => {
    const canalDefault =
      canalesSeleccionables.find((c) => c.id === canalActivoInicialId)?.id ||
      canalesSeleccionables[0]?.id ||
      'general';
    setEditandoId(null);
    setForm({
      titulo: '',
      url: '',
      tipo: tipoPredefinido,
      categoria: 'Litigios y Expedientes',
      descripcion: '',
      destacado: false,
      canalId: canalDefault,
      rolDriveMiembros: 'reader',
      publicarEnChat: true
    });
    setModalOpen(true);
  };

  const abrirModalEditar = (item) => {
    const canalDefault =
      item.canalId ||
      canalesSeleccionables.find((c) => c.id === canalActivoInicialId)?.id ||
      canalesSeleccionables[0]?.id ||
      'general';
    setEditandoId(item.id);
    setForm({
      titulo: item.titulo || '',
      url: item.url || '',
      tipo: item.tipo || 'doc',
      categoria: item.categoria || 'General',
      descripcion: item.descripcion || '',
      destacado: Boolean(item.destacado),
      canalId: canalDefault,
      rolDriveMiembros: item.rolDriveMiembros || 'reader',
      publicarEnChat: false
    });
    setModalOpen(true);
  };

  const handleGuardarItem = async () => {
    if (!form.titulo.trim() || !form.url.trim() || !form.canalId) return;

    setSincronizandoPermisos(true);
    const tipoDetectado = form.tipo || detectarTipoDrivePorUrl(form.url);
    const canalObj = canalesDisponibles.find((c) => c.id === form.canalId);
    const miembrosDelCanal = obtenerMiembrosDelCanal(form.canalId);

    let resultadoPermisos = null;
    let errorPermisosDrive = null;

    // 1. Blindar permisos reales en Google Drive:
    // Elimina "Cualquiera que tenga el vínculo" (anyoneWithLink) y autoriza SOLO a los miembros del canal
    try {
      resultadoPermisos = await sincronizarPermisosDriveConCanal({
        fileIdOrUrl: form.url.trim(),
        miembrosEmails: miembrosDelCanal,
        rolPermiso: form.rolDriveMiembros || 'reader',
        revocarUsuariosAjenos: true,
        emailHint: userEmail
      });
    } catch (errPerm) {
      console.warn('Aviso al sincronizar ACL en Google Drive:', errPerm);
      errorPermisosDrive = errPerm?.message || 'No se pudo modificar el ACL en Google Drive.';
    }

    const payload = {
      titulo: form.titulo.trim(),
      url: form.url.trim(),
      tipo: tipoDetectado,
      categoria: form.categoria.trim() || 'General',
      descripcion: form.descripcion.trim(),
      destacado: Boolean(form.destacado),
      canalId: form.canalId,
      canalNombre: canalObj?.nombre || form.canalId,
      esCanalPrivado: Boolean(canalObj?.esPrivado || canalObj?.tipo === 'dm'),
      miembrosAutorizados: miembrosDelCanal,
      rolDriveMiembros: form.rolDriveMiembros || 'reader',
      blindadoDrive: Boolean(resultadoPermisos),
      publicoRevocadoDrive: Boolean(resultadoPermisos?.publicoRevocado),
      actualizadoEn: serverTimestamp()
    };

    try {
      let itemIdFinal = editandoId;
      if (editandoId) {
        await updateDoc(doc(db, 'workspace_drive', editandoId), payload);
      } else {
        const ref = await addDoc(collection(db, 'workspace_drive'), {
          ...payload,
          creadoPorEmail: userEmail,
          creadoPorNombre: userName || currentUser?.displayName || userEmail,
          creadoEn: serverTimestamp()
        });
        itemIdFinal = ref.id;
      }

      // Publicar tarjeta en el canal seleccionado
      if ((!editandoId || form.publicarEnChat) && form.canalId) {
        const tipoInfo = TIPOS_DRIVE[tipoDetectado] || TIPOS_DRIVE.doc;
        const etiquetaPrivacidad = canalObj?.esPrivado
          ? `🔒 Solo miembros de #${canalObj.nombre} (${miembrosDelCanal.length})`
          : `🛡️ Miembros de #${canalObj?.nombre || form.canalId}`;

        await addDoc(collection(db, 'workspace_canales', form.canalId, 'mensajes'), {
          texto: `📁 *Recurso de Google Drive compartido en el canal:* *${form.titulo.trim()}*\n• *Tipo:* ${tipoInfo.label}\n• *Acceso:* ${etiquetaPrivacidad}${form.descripcion ? `\n• *Nota:* ${form.descripcion.trim()}` : ''}`,
          autorEmail: userEmail,
          autorNombre: userName || 'Equipo IIRESODH',
          autorAvatar: currentUser?.photoURL || '',
          autorRol: userRole || 'Colaborador',
          creadoEn: serverTimestamp(),
          creadoEnMs: Date.now(),
          reacciones: {},
          fijado: false,
          respuestasCount: 0,
          driveAdjunto: {
            id: itemIdFinal,
            titulo: form.titulo.trim(),
            url: form.url.trim(),
            tipo: tipoDetectado,
            categoria: form.categoria,
            canalId: form.canalId,
            canalNombre: canalObj?.nombre || form.canalId
          }
        });

        await updateDoc(doc(db, 'workspace_canales', form.canalId), {
          ultimoMensajeAt: serverTimestamp(),
          ultimoMensajeMs: Date.now(),
          ultimoMensajeTexto: `📁 Drive: ${form.titulo.trim()}`,
          ultimoMensajeAutor: userName || 'Equipo'
        });
      }

      setModalOpen(false);
      if (resultadoPermisos) {
        const avisoPublico = resultadoPermisos.publicoRevocado
          ? ' Se eliminó el acceso público "Cualquiera con el vínculo".'
          : '';
        setSnackbar({
          open: true,
          message: `🔒 Recurso restringido exclusivamente a los ${miembrosDelCanal.length} miembro(s) de #${
            canalObj?.nombre || form.canalId
          }.${avisoPublico}`,
          severity: 'success'
        });
      } else {
        setSnackbar({
          open: true,
          message: `Vinculado al canal #${canalObj?.nombre || form.canalId} en la Intranet. (${errorPermisosDrive})`,
          severity: 'warning'
        });
      }
    } catch (err) {
      console.error('Error guardando recurso de Drive:', err);
    } finally {
      setSincronizandoPermisos(false);
    }
  };

  const handleToggleDestacado = async (item) => {
    try {
      await updateDoc(doc(db, 'workspace_drive', item.id), {
        destacado: !item.destacado
      });
    } catch (err) {
      console.error('Error destacando item de Drive:', err);
    }
  };

  const handleEliminarItem = async (item) => {
    try {
      await deleteDoc(doc(db, 'workspace_drive', item.id));
      if (itemEnVisor?.id === item.id) setItemEnVisor(null);
      setSnackbar({
        open: true,
        message: 'Vínculo eliminado de la biblioteca del Workspace.',
        severity: 'info'
      });
    } catch (err) {
      console.error('Error eliminando item de Drive:', err);
    }
  };

  const abrirDialogoCompartirItem = (item) => {
    setModalCompartirItem(item);
    setCanalDestinoCompartir(
      item.canalId ||
        canalesSeleccionables.find((c) => c.id === canalActivoInicialId)?.id ||
        canalesSeleccionables[0]?.id ||
        'general'
    );
    setRolDestinoCompartir(item.rolDriveMiembros || 'reader');
  };

  const handleConfirmarCompartirYBlindar = async () => {
    if (!modalCompartirItem || !canalDestinoCompartir) return;
    setCompartiendoEnCanal(true);
    try {
      const canalObj = canalesDisponibles.find((c) => c.id === canalDestinoCompartir);
      const miembrosDelCanal = obtenerMiembrosDelCanal(canalDestinoCompartir);

      let resultadoPermisos = null;
      try {
        resultadoPermisos = await sincronizarPermisosDriveConCanal({
          fileIdOrUrl: modalCompartirItem.url,
          miembrosEmails: miembrosDelCanal,
          rolPermiso: rolDestinoCompartir,
          revocarUsuariosAjenos: true,
          emailHint: userEmail
        });
      } catch (e) {
        console.warn('Aviso al sincronizar permisos en Google Drive:', e);
      }

      await updateDoc(doc(db, 'workspace_drive', modalCompartirItem.id), {
        canalId: canalDestinoCompartir,
        canalNombre: canalObj?.nombre || canalDestinoCompartir,
        esCanalPrivado: Boolean(canalObj?.esPrivado || canalObj?.tipo === 'dm'),
        miembrosAutorizados: miembrosDelCanal,
        rolDriveMiembros: rolDestinoCompartir,
        blindadoDrive: Boolean(resultadoPermisos),
        publicoRevocadoDrive: Boolean(resultadoPermisos?.publicoRevocado),
        actualizadoEn: serverTimestamp()
      });

      const tipoInfo = TIPOS_DRIVE[modalCompartirItem.tipo] || TIPOS_DRIVE.doc;
      await addDoc(collection(db, 'workspace_canales', canalDestinoCompartir, 'mensajes'), {
        texto: `📁 *Recurso de Google Drive compartido (Acceso exclusivo miembros del canal):* *${modalCompartirItem.titulo}*\n• *Tipo:* ${tipoInfo.label}\n• *Miembros autorizados:* ${miembrosDelCanal.length}`,
        autorEmail: userEmail,
        autorNombre: userName || 'Equipo IIRESODH',
        autorAvatar: currentUser?.photoURL || '',
        autorRol: userRole || 'Colaborador',
        creadoEn: serverTimestamp(),
        creadoEnMs: Date.now(),
        reacciones: {},
        fijado: false,
        respuestasCount: 0,
        driveAdjunto: {
          id: modalCompartirItem.id,
          titulo: modalCompartirItem.titulo,
          url: modalCompartirItem.url,
          tipo: modalCompartirItem.tipo,
          categoria: modalCompartirItem.categoria || 'General',
          canalId: canalDestinoCompartir,
          canalNombre: canalObj?.nombre || canalDestinoCompartir
        }
      });

      await updateDoc(doc(db, 'workspace_canales', canalDestinoCompartir), {
        ultimoMensajeAt: serverTimestamp(),
        ultimoMensajeMs: Date.now(),
        ultimoMensajeTexto: `📁 Drive: ${modalCompartirItem.titulo}`,
        ultimoMensajeAutor: userName || 'Equipo'
      });

      setModalCompartirItem(null);
      setSnackbar({
        open: true,
        message: resultadoPermisos?.publicoRevocado
          ? `🔒 Vínculo público eliminado. Ahora "${modalCompartirItem.titulo}" solo es accesible para los ${miembrosDelCanal.length} miembros de #${canalObj?.nombre || canalDestinoCompartir}.`
          : `🔒 Acceso sincronizado exclusivamente para los ${miembrosDelCanal.length} miembros de #${canalObj?.nombre || canalDestinoCompartir}.`,
        severity: 'success'
      });
      if (onIrACanal) onIrACanal(canalDestinoCompartir);
    } catch (err) {
      console.error('Error compartiendo y blindando item de Drive:', err);
    } finally {
      setCompartiendoEnCanal(false);
    }
  };

  // Filtrado estricto por pertenencia al canal + tipo + búsqueda
  const itemsFiltrados = useMemo(() => {
    return itemsDrive
      .filter((item) => {
        // 1. Perímetro de seguridad: solo miembros del canal donde se compartió
        if (!usuarioTieneAccesoAItemDrive(item)) return false;

        // 2. Filtro por canal seleccionado
        if (filtroCanalId !== 'todos' && item.canalId !== filtroCanalId) return false;

        // 3. Filtro por tipo de recurso
        if (filtroTipo === 'destacados' && !item.destacado) return false;
        if (filtroTipo !== 'todos' && filtroTipo !== 'destacados' && item.tipo !== filtroTipo) {
          return false;
        }
        if (!busqueda.trim()) return true;
        const term = busqueda.toLowerCase();
        return (
          (item.titulo || '').toLowerCase().includes(term) ||
          (item.categoria || '').toLowerCase().includes(term) ||
          (item.canalNombre || '').toLowerCase().includes(term) ||
          (item.descripcion || '').toLowerCase().includes(term)
        );
      })
      .sort((a, b) => Number(Boolean(b.destacado)) - Number(Boolean(a.destacado)));
  }, [itemsDrive, usuarioTieneAccesoAItemDrive, filtroCanalId, filtroTipo, busqueda]);

  const canalSeleccionadoModal = useMemo(
    () => canalesDisponibles.find((c) => c.id === form.canalId) || null,
    [canalesDisponibles, form.canalId]
  );

  const miembrosCanalSeleccionadoModal = useMemo(
    () => (form.canalId ? obtenerMiembrosDelCanal(form.canalId) : []),
    [form.canalId, obtenerMiembrosDelCanal]
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: '#f8fafc', overflow: 'hidden' }}>
      {/* BARRA SUPERIOR DE GOOGLE DRIVE & WORKSPACE */}
      <Box
        sx={{
          px: { xs: 2, sm: 3 },
          py: 1.5,
          bgcolor: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1.5
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <Box
            sx={{
              p: 1,
              borderRadius: 2,
              bgcolor: 'rgba(37, 99, 235, 0.08)',
              color: '#1d4ed8',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <HardDrive size={20} />
          </Box>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography variant="subtitle1" fontWeight="800" color="#0f233c" sx={{ lineHeight: 1.2 }}>
                Google Drive & Documentos Colaborativos
              </Typography>
              <Chip
                icon={<ShieldCheck size={13} color="#166534" />}
                label="Acceso restringido por canal (Sin enlaces públicos)"
                size="small"
                sx={{
                  height: 20,
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  bgcolor: '#dcfce7',
                  color: '#166534'
                }}
              />
            </Box>
            <Typography variant="caption" color="text.secondary">
              Cada carpeta o archivo compartido en un canal es accesible únicamente para los miembros de ese canal
            </Typography>
          </Box>
        </Box>

        {/* ACCIONES RÁPIDAS CON GOOGLE WORKSPACE */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Button
            size="small"
            variant="outlined"
            href={getGoogleWorkspaceUrl('https://drive.google.com')}
            target="_blank"
            rel="noopener noreferrer"
            endIcon={<ExternalLink size={14} />}
            sx={{
              textTransform: 'none',
              borderRadius: 2,
              fontWeight: 600,
              fontSize: '0.78rem',
              borderColor: '#cbd5e1',
              color: '#1e293b'
            }}
          >
            Abrir Mi Google Drive
          </Button>

          <Button
            size="small"
            variant="outlined"
            href={getGoogleWorkspaceUrl('https://docs.google.com/document/create')}
            target="_blank"
            rel="noopener noreferrer"
            startIcon={<FileText size={14} color="#1d4ed8" />}
            sx={{
              textTransform: 'none',
              borderRadius: 2,
              fontWeight: 600,
              fontSize: '0.78rem',
              borderColor: '#bfdbfe',
              bgcolor: '#eff6ff',
              color: '#1d4ed8',
              display: { xs: 'none', md: 'inline-flex' }
            }}
          >
            Nuevo Doc
          </Button>

          <Button
            size="small"
            variant="outlined"
            href={getGoogleWorkspaceUrl('https://docs.google.com/spreadsheets/create')}
            target="_blank"
            rel="noopener noreferrer"
            startIcon={<FileSpreadsheet size={14} color="#047857" />}
            sx={{
              textTransform: 'none',
              borderRadius: 2,
              fontWeight: 600,
              fontSize: '0.78rem',
              borderColor: '#a7f3d0',
              bgcolor: '#ecfdf5',
              color: '#047857',
              display: { xs: 'none', md: 'inline-flex' }
            }}
          >
            Nuevo Sheet
          </Button>

          <Button
            size="small"
            variant="contained"
            startIcon={<Plus size={16} />}
            onClick={() => abrirModalNuevo('doc')}
            sx={{
              bgcolor: '#1a365d',
              color: '#ffffff',
              textTransform: 'none',
              fontWeight: 'bold',
              borderRadius: 2,
              px: 2,
              fontSize: '0.8rem',
              '&:hover': { bgcolor: '#0f233c' }
            }}
          >
            Vincular Archivo / Carpeta a un Canal
          </Button>
        </Box>
      </Box>

      {/* SUB-BARRA DE FILTROS (TIPO + CANAL) Y BUSCADOR */}
      <Box
        sx={{
          px: { xs: 2, sm: 3 },
          py: 1,
          bgcolor: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1.5
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
          {[
            { id: 'todos', label: 'Todos' },
            { id: 'destacados', label: '⭐ Fijados' },
            { id: 'carpeta', label: '📁 Carpetas' },
            { id: 'doc', label: '📄 Google Docs' },
            { id: 'sheet', label: '📊 Hojas de Cálculo' },
            { id: 'pdf', label: '📕 PDFs / Archivos' }
          ].map((tab) => (
            <Chip
              key={tab.id}
              label={tab.label}
              size="small"
              onClick={() => setFiltroTipo(tab.id)}
              sx={{
                fontWeight: 700,
                fontSize: '0.75rem',
                cursor: 'pointer',
                bgcolor: filtroTipo === tab.id ? '#1a365d' : '#f1f5f9',
                color: filtroTipo === tab.id ? '#ffffff' : '#475569',
                '&:hover': {
                  bgcolor: filtroTipo === tab.id ? '#0f233c' : '#e2e8f0'
                }
              }}
            />
          ))}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <FormControl size="small" sx={{ minWidth: 175 }}>
            <Select
              value={filtroCanalId}
              onChange={(e) => setFiltroCanalId(e.target.value)}
              sx={{ height: 32, fontSize: '0.78rem', borderRadius: 2, bgcolor: '#f8fafc', fontWeight: 700 }}
            >
              <MenuItem value="todos">Todos mis canales autorizados</MenuItem>
              {canalesSeleccionables.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.esPrivado ? `🔒 #${c.nombre}` : `#${c.nombre}`}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            size="small"
            placeholder="Buscar documento o carpeta..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            sx={{ width: { xs: 170, sm: 230 } }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={14} color="#64748b" />
                  </InputAdornment>
                ),
                sx: { height: 32, fontSize: '0.8rem', borderRadius: 2, bgcolor: '#f8fafc' }
              }
            }}
          />

          <ToggleButtonGroup
            size="small"
            value={modoVista}
            exclusive
            onChange={(_, val) => val && setModoVista(val)}
            sx={{ height: 32 }}
          >
            <ToggleButton value="grid">
              <LayoutGrid size={15} />
            </ToggleButton>
            <ToggleButton value="lista">
              <ListIcon size={15} />
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Box>

      {/* CUERPO PRINCIPAL: LISTA DE ARCHIVOS + VISOR EMBEBIDO DE DRIVE */}
      <Box sx={{ display: 'flex', flexGrow: 1, overflow: 'hidden' }}>
        {/* PANEL DE BIBLIOTECA DE DRIVE */}
        <Box
          sx={{
            width: itemEnVisor ? { xs: '0%', lg: '38%' } : '100%',
            display: itemEnVisor ? { xs: 'none', lg: 'block' } : 'block',
            p: { xs: 2, sm: 2.5 },
            overflowY: 'auto',
            borderRight: itemEnVisor ? '1px solid #e2e8f0' : 'none',
            transition: 'width 0.2s ease'
          }}
        >
          {itemsFiltrados.length === 0 ? (
            <Paper
              elevation={0}
              sx={{
                p: 5,
                textAlign: 'center',
                borderRadius: 3,
                border: '1px dashed #cbd5e1',
                bgcolor: '#ffffff',
                maxWidth: 520,
                mx: 'auto',
                mt: 2
              }}
            >
              <FolderOpen size={44} color="#94a3b8" style={{ margin: '0 auto 12px' }} />
              <Typography variant="subtitle1" fontWeight="800" color="#0f233c">
                No hay carpetas ni documentos compartidos en esta vista
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2.5 }}>
                Cuando compartas una carpeta o documento en un canal, el sistema eliminará cualquier vínculo público (&ldquo;Cualquiera que tenga el vínculo&rdquo;) y dará acceso únicamente a los miembros de ese canal.
              </Typography>
              <Button
                variant="contained"
                startIcon={<Plus size={16} />}
                onClick={() => abrirModalNuevo('carpeta')}
                sx={{ bgcolor: '#1a365d', textTransform: 'none', fontWeight: 'bold', borderRadius: 2 }}
              >
                Compartir carpeta o archivo en un canal
              </Button>
            </Paper>
          ) : (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns:
                  modoVista === 'lista' || itemEnVisor
                    ? '1fr'
                    : { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
                gap: 2
              }}
            >
              {itemsFiltrados.map((item) => {
                const tipoCfg = TIPOS_DRIVE[item.tipo] || TIPOS_DRIVE.doc;
                const IconoTipo = tipoCfg.icon;
                const seleccionado = itemEnVisor?.id === item.id;
                const canalDelItem = canalesDisponibles.find((c) => c.id === item.canalId);
                const miembrosCount = Array.isArray(item.miembrosAutorizados)
                  ? item.miembrosAutorizados.length
                  : item.canalId
                  ? obtenerMiembrosDelCanal(item.canalId).length
                  : 0;
                const tieneCanalYBlindaje = Boolean(item.canalId && item.blindadoDrive);

                return (
                  <Paper
                    key={item.id}
                    elevation={0}
                    sx={{
                      p: 2,
                      borderRadius: 3,
                      border: seleccionado ? '2px solid #2563eb' : '1px solid #e2e8f0',
                      bgcolor: '#ffffff',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: 1.5,
                      transition: 'all 0.15s',
                      '&:hover': {
                        boxShadow: '0 6px 20px rgba(15, 35, 60, 0.06)',
                        borderColor: seleccionado ? '#2563eb' : '#cbd5e1'
                      }
                    }}
                  >
                    <Box>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
                          <Box
                            sx={{
                              p: 1,
                              borderRadius: 2,
                              bgcolor: tipoCfg.bg,
                              color: tipoCfg.color,
                              border: `1px solid ${tipoCfg.border}`,
                              flexShrink: 0
                            }}
                          >
                            <IconoTipo size={20} />
                          </Box>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography
                              variant="subtitle2"
                              fontWeight="800"
                              color="#0f233c"
                              noWrap
                              title={item.titulo}
                            >
                              {item.titulo}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.2, flexWrap: 'wrap' }}>
                              <Chip
                                label={tipoCfg.label}
                                size="small"
                                sx={{
                                  height: 18,
                                  fontSize: '0.65rem',
                                  fontWeight: 700,
                                  bgcolor: tipoCfg.bg,
                                  color: tipoCfg.color
                                }}
                              />
                              {item.categoria && (
                                <Typography variant="caption" color="text.secondary" noWrap>
                                  • {item.categoria}
                                </Typography>
                              )}
                            </Box>
                          </Box>
                        </Box>

                        <IconButton
                          size="small"
                          onClick={() => handleToggleDestacado(item)}
                          sx={{ color: item.destacado ? '#f59e0b' : '#cbd5e1', p: 0.4 }}
                        >
                          <Star size={16} fill={item.destacado ? '#f59e0b' : 'none'} />
                        </IconButton>
                      </Box>

                      {/* BADGE DE PRIVACIDAD Y CANAL AUTORIZADO */}
                      <Box sx={{ mt: 1.25, display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                        {item.canalId ? (
                          <Chip
                            icon={
                              canalDelItem?.esPrivado || item.esCanalPrivado ? (
                                <Lock size={11} color="#92400e" />
                              ) : (
                                <Hash size={11} color="#1D3557" />
                              )
                            }
                            label={`Solo miembros de #${canalDelItem?.nombre || item.canalNombre || item.canalId} (${miembrosCount})`}
                            size="small"
                            onClick={() => abrirDialogoCompartirItem(item)}
                            sx={{
                              height: 21,
                              fontSize: '0.67rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              bgcolor:
                                canalDelItem?.esPrivado || item.esCanalPrivado
                                  ? '#fef3c7'
                                  : 'rgba(29, 53, 87, 0.08)',
                              color:
                                canalDelItem?.esPrivado || item.esCanalPrivado
                                  ? '#92400e'
                                  : '#1D3557'
                            }}
                          />
                        ) : (
                          <Chip
                            icon={<ShieldAlert size={12} color="#b91c1c" />}
                            label="Sin canal asignado • Haz clic para restringir a un canal"
                            size="small"
                            onClick={() => abrirDialogoCompartirItem(item)}
                            sx={{
                              height: 22,
                              fontSize: '0.67rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              bgcolor: '#fef2f2',
                              color: '#b91c1c',
                              border: '1px solid #fecaca'
                            }}
                          />
                        )}

                        {tieneCanalYBlindaje && (
                          <Tooltip title="Enlace público desactivado en Google Drive. Solo los miembros del canal tienen permiso.">
                            <Chip
                              icon={<ShieldCheck size={11} color="#166534" />}
                              label="Blindado en Drive"
                              size="small"
                              sx={{
                                height: 20,
                                fontSize: '0.65rem',
                                fontWeight: 700,
                                bgcolor: '#dcfce7',
                                color: '#166534'
                              }}
                            />
                          </Tooltip>
                        )}
                      </Box>

                      {item.descripcion && (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{
                            mt: 1,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden'
                          }}
                        >
                          {item.descripcion}
                        </Typography>
                      )}
                    </Box>

                    <Divider />

                    {/* BOTONES DE ACCIÓN DEL DOCUMENTO */}
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                      <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                        <Button
                          size="small"
                          variant={seleccionado ? 'contained' : 'outlined'}
                          startIcon={<Eye size={14} />}
                          onClick={() => setItemEnVisor(seleccionado ? null : item)}
                          sx={{
                            textTransform: 'none',
                            borderRadius: 1.5,
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            py: 0.3,
                            ...(seleccionado
                              ? { bgcolor: '#2563eb' }
                              : { borderColor: '#cbd5e1', color: '#0f233c' })
                          }}
                        >
                          {seleccionado ? 'Cerrar visor' : 'Vista Previa'}
                        </Button>

                        {!tieneCanalYBlindaje && (
                          <Tooltip title="Elimina 'Cualquiera que tenga el vínculo' en Google Drive y restringe el acceso únicamente a los miembros del canal">
                            <Button
                              size="small"
                              variant="contained"
                              startIcon={<Lock size={13} />}
                              onClick={() => abrirDialogoCompartirItem(item)}
                              sx={{
                                textTransform: 'none',
                                borderRadius: 1.5,
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                py: 0.3,
                                bgcolor: '#b45309',
                                color: '#ffffff',
                                '&:hover': { bgcolor: '#92400e' }
                              }}
                            >
                              Restringir a Canal
                            </Button>
                          </Tooltip>
                        )}

                        <Tooltip title="Abrir en Google Drive (@iiresodh.org)">
                          <IconButton
                            size="small"
                            component="a"
                            href={getGoogleWorkspaceUrl(item.url)}
                            target="_blank"
                            rel="noopener noreferrer"
                            sx={{ border: '1px solid #e2e8f0', borderRadius: 1.5 }}
                          >
                            <ExternalLink size={14} />
                          </IconButton>
                        </Tooltip>
                      </Box>

                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                        <Tooltip title="Elegir canal y sincronizar permisos exclusivos de sus miembros">
                          <IconButton
                            size="small"
                            onClick={() => abrirDialogoCompartirItem(item)}
                            sx={{ color: '#2563eb' }}
                          >
                            <Send size={14} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Editar vínculo y canal">
                          <IconButton size="small" onClick={() => abrirModalEditar(item)}>
                            <Edit3 size={14} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Eliminar vínculo">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleEliminarItem(item)}
                          >
                            <Trash2 size={14} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>
                  </Paper>
                );
              })}
            </Box>
          )}
        </Box>

        {/* VISOR INTEGRADO DE GOOGLE DRIVE / DOCS / SHEETS / CARPETAS PRIVADAS */}
        {itemEnVisor && (
          <Box
            sx={{
              flexGrow: 1,
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              bgcolor: '#ffffff'
            }}
          >
            {/* CABECERA DEL VISOR */}
            <Box
              sx={{
                px: 2,
                py: 1.25,
                bgcolor: '#f8fafc',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1.5,
                flexWrap: 'wrap'
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                <Typography variant="subtitle2" fontWeight="800" color="#0f233c" noWrap>
                  {itemEnVisor.titulo}
                </Typography>
                <Chip
                  label={TIPOS_DRIVE[itemEnVisor.tipo]?.label || 'Google Drive'}
                  size="small"
                  sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700 }}
                />
                {itemEnVisor.canalNombre && (
                  <Chip
                    icon={<Lock size={11} />}
                    label={`#${itemEnVisor.canalNombre}`}
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      bgcolor: '#dcfce7',
                      color: '#166534'
                    }}
                  />
                )}
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {(itemEnVisor.tipo === 'doc' ||
                  itemEnVisor.tipo === 'sheet' ||
                  itemEnVisor.tipo === 'slide') && (
                  <ToggleButtonGroup
                    size="small"
                    value={modoVisor}
                    exclusive
                    onChange={(_, val) => val && setModoVisor(val)}
                    sx={{ height: 28 }}
                  >
                    <ToggleButton value="preview" sx={{ textTransform: 'none', fontSize: '0.73rem', px: 1.2 }}>
                      Vista Lectura
                    </ToggleButton>
                    <ToggleButton value="edit" sx={{ textTransform: 'none', fontSize: '0.73rem', px: 1.2 }}>
                      Modo Edición
                    </ToggleButton>
                  </ToggleButtonGroup>
                )}

                <Button
                  size="small"
                  variant="outlined"
                  href={getGoogleWorkspaceUrl(itemEnVisor.url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  endIcon={<ExternalLink size={13} />}
                  sx={{ textTransform: 'none', fontSize: '0.74rem', borderRadius: 1.5, py: 0.25 }}
                >
                  Abrir en pestaña Drive
                </Button>

                <IconButton size="small" onClick={() => setItemEnVisor(null)}>
                  <X size={18} />
                </IconButton>
              </Box>
            </Box>

            {/* VISOR: SI ES CARPETA USA EL EXPLORADOR PRIVADO OAUTH; SI ES ARCHIVO USA EL PREVIEW */}
            <Box sx={{ flexGrow: 1, position: 'relative', bgcolor: '#f1f5f9', overflow: 'hidden' }}>
              {itemEnVisor.tipo === 'carpeta' ? (
                <VisorCarpetaPrivadaDrive
                  carpetaItem={itemEnVisor}
                  userEmail={userEmail}
                  getGoogleWorkspaceUrl={getGoogleWorkspaceUrl}
                  onAbrirArchivoInterno={(subItem) => setItemEnVisor(subItem)}
                />
              ) : (
                <iframe
                  title={itemEnVisor.titulo}
                  src={convertirUrlDriveAEmbed(itemEnVisor.url, modoVisor)}
                  style={{
                    width: '100%',
                    height: '100%',
                    border: 'none'
                  }}
                  allow="autoplay; clipboard-write; encrypted-media"
                />
              )}
            </Box>
          </Box>
        )}
      </Box>

      {/* MODAL PARA VINCULAR Y RESTRINGIR ARCHIVO O CARPETA A UN CANAL */}
      <Dialog
        open={modalOpen}
        onClose={() => !sincronizandoPermisos && setModalOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '0 0 12px 12px',
            borderTop: '4px solid #1D3557'
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: '800', color: '#1D3557', pb: 1.25 }}>
          {editandoId
            ? 'Editar Recurso y Permisos de Canal en Google Drive'
            : 'Vincular Archivo o Carpeta de Google Drive a un Canal'}
        </DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          {/* 1. SELECCIÓN OBLIGATORIA DEL CANAL Y PERÍMETRO DE MIEMBROS */}
          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: 2,
              bgcolor: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderLeft: '4px solid #1D3557',
              display: 'flex',
              flexDirection: 'column',
              gap: 1.5
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Lock size={16} color="#1D3557" />
                <Typography variant="subtitle2" fontWeight="800" color="#1D3557">
                  1. Canal Destino y Control de Acceso Exclusivo
                </Typography>
              </Box>
              <Chip
                icon={<ShieldCheck size={13} color="#166534" />}
                label='Bloquea "Cualquiera que tenga el vínculo"'
                size="small"
                sx={{ bgcolor: '#dcfce7', color: '#166534', fontWeight: 700, fontSize: '0.7rem' }}
              />
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1.3fr 1fr' }, gap: 1.5 }}>
              <FormControl size="small" fullWidth required>
                <InputLabel>Compartir exclusivamente con los miembros del canal</InputLabel>
                <Select
                  label="Compartir exclusivamente con los miembros del canal"
                  value={form.canalId}
                  onChange={(e) => setForm((prev) => ({ ...prev, canalId: e.target.value }))}
                >
                  {canalesSeleccionables.map((c) => (
                    <MenuItem key={c.id} value={c.id}>
                      {c.esPrivado ? `🔒 #${c.nombre} (Canal Privado)` : `#${c.nombre}`}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl size="small" fullWidth>
                <InputLabel>Permiso en Drive para miembros del canal</InputLabel>
                <Select
                  label="Permiso en Drive para miembros del canal"
                  value={form.rolDriveMiembros}
                  onChange={(e) => setForm((prev) => ({ ...prev, rolDriveMiembros: e.target.value }))}
                >
                  <MenuItem value="reader">👁️ Solo lectura (Lector)</MenuItem>
                  <MenuItem value="commenter">💬 Comentador</MenuItem>
                  <MenuItem value="writer">✏️ Editor colaborativo</MenuItem>
                </Select>
              </FormControl>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Users size={14} color="#475569" />
              <Typography variant="caption" color="#334155" fontWeight="700">
                Personas que tendrán acceso en #{canalSeleccionadoModal?.nombre || form.canalId} ({miembrosCanalSeleccionadoModal.length}):
              </Typography>
              {miembrosCanalSeleccionadoModal.slice(0, 8).map((emailM) => (
                <Chip
                  key={emailM}
                  label={emailM}
                  size="small"
                  sx={{ height: 19, fontSize: '0.66rem', bgcolor: '#e2e8f0', color: '#1e293b', fontWeight: 600 }}
                />
              ))}
              {miembrosCanalSeleccionadoModal.length > 8 && (
                <Chip
                  label={`+${miembrosCanalSeleccionadoModal.length - 8} más`}
                  size="small"
                  sx={{ height: 19, fontSize: '0.66rem', fontWeight: 700 }}
                />
              )}
            </Box>
          </Paper>

          {/* 2. EXPLORADOR DIRECTO DE GOOGLE DRIVE */}
          <GoogleDriveSelectorBrowser
            userEmail={userEmail}
            tipoFiltroInicial={form.tipo === 'carpeta' ? 'carpeta' : 'todos'}
            itemSeleccionadoUrl={form.url}
            onSelectItem={(itemElegido) => {
              setForm((prev) => ({
                ...prev,
                url: itemElegido.url,
                titulo: itemElegido.titulo,
                tipo: itemElegido.tipo
              }));
              setSnackbar({
                open: true,
                message: `Seleccionado desde Drive: "${itemElegido.titulo}"`,
                severity: 'success'
              });
            }}
          />

          <TextField
            label="Nombre o título del documento / carpeta"
            placeholder="Se completa automáticamente al elegir en Drive o escríbelo aquí..."
            size="small"
            fullWidth
            required
            value={form.titulo}
            onChange={(e) => setForm((prev) => ({ ...prev, titulo: e.target.value }))}
          />

          <TextField
            label="Enlace de Google Drive / Docs / Sheets / Carpeta"
            placeholder="Selecciona arriba desde tu Drive o pega el enlace aquí..."
            size="small"
            fullWidth
            required
            value={form.url}
            onChange={(e) => {
              const nuevaUrl = e.target.value;
              const tipoAuto = detectarTipoDrivePorUrl(nuevaUrl);
              setForm((prev) => ({
                ...prev,
                url: nuevaUrl,
                tipo: tipoAuto
              }));
            }}
          />

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            <FormControl size="small" fullWidth>
              <InputLabel>Tipo de Recurso</InputLabel>
              <Select
                label="Tipo de Recurso"
                value={form.tipo}
                onChange={(e) => setForm((prev) => ({ ...prev, tipo: e.target.value }))}
              >
                {Object.values(TIPOS_DRIVE).map((t) => (
                  <MenuItem key={t.id} value={t.id}>
                    {t.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Categoría o Proyecto"
              placeholder="Ej: Litigios, Administración, General..."
              size="small"
              fullWidth
              value={form.categoria}
              onChange={(e) => setForm((prev) => ({ ...prev, categoria: e.target.value }))}
            />
          </Box>

          <TextField
            label="Descripción o notas de uso (Opcional)"
            size="small"
            fullWidth
            multiline
            rows={2}
            value={form.descripcion}
            onChange={(e) => setForm((prev) => ({ ...prev, descripcion: e.target.value }))}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={() => setModalOpen(false)}
            disabled={sincronizandoPermisos}
            sx={{ textTransform: 'none' }}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleGuardarItem}
            disabled={!form.titulo.trim() || !form.url.trim() || !form.canalId || sincronizandoPermisos}
            startIcon={
              sincronizandoPermisos ? <CircularProgress size={15} color="inherit" /> : <Lock size={15} />
            }
            sx={{ bgcolor: '#1a365d', textTransform: 'none', fontWeight: 'bold', borderRadius: 2 }}
          >
            {sincronizandoPermisos
              ? 'Blindando permisos en Drive...'
              : editandoId
              ? 'Guardar y Blindar Acceso al Canal'
              : `Compartir Solo con #${canalSeleccionadoModal?.nombre || form.canalId}`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* MODAL PARA COMPARTIR / RESTRINGIR UN RECURSO EXISTENTE A UN CANAL */}
      <Dialog
        open={Boolean(modalCompartirItem)}
        onClose={() => !compartiendoEnCanal && setModalCompartirItem(null)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 800, color: '#1D3557' }}>
          🔒 Restringir y Compartir en Canal
        </DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Alert severity="info" sx={{ borderRadius: 2 }}>
            Al confirmar, se eliminará cualquier acceso público (&ldquo;Cualquiera que tenga el vínculo&rdquo;) en Google Drive para <strong>{modalCompartirItem?.titulo}</strong> y solo tendrán permiso los miembros del canal que elijas.
          </Alert>

          <FormControl size="small" fullWidth>
            <InputLabel>Canal autorizado</InputLabel>
            <Select
              label="Canal autorizado"
              value={canalDestinoCompartir}
              onChange={(e) => setCanalDestinoCompartir(e.target.value)}
            >
              {canalesSeleccionables.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.esPrivado ? `🔒 #${c.nombre} (Privado)` : `#${c.nombre}`}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" fullWidth>
            <InputLabel>Nivel de acceso en Google Drive</InputLabel>
            <Select
              label="Nivel de acceso en Google Drive"
              value={rolDestinoCompartir}
              onChange={(e) => setRolDestinoCompartir(e.target.value)}
            >
              <MenuItem value="reader">👁️ Solo lectura (Lector)</MenuItem>
              <MenuItem value="commenter">💬 Comentador</MenuItem>
              <MenuItem value="writer">✏️ Editor colaborativo</MenuItem>
            </Select>
          </FormControl>

          <Box>
            <Typography variant="caption" fontWeight="800" color="#1D3557" sx={{ display: 'block', mb: 0.75 }}>
              MIEMBROS QUE TENDRÁN ACCESO EXCLUSIVO ({obtenerMiembrosDelCanal(canalDestinoCompartir).length}):
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.6, flexWrap: 'wrap' }}>
              {obtenerMiembrosDelCanal(canalDestinoCompartir).map((em) => (
                <Chip
                  key={em}
                  label={em}
                  size="small"
                  sx={{ height: 20, fontSize: '0.68rem', bgcolor: '#f1f5f9', fontWeight: 600 }}
                />
              ))}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={() => setModalCompartirItem(null)}
            disabled={compartiendoEnCanal}
            sx={{ textTransform: 'none' }}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleConfirmarCompartirYBlindar}
            disabled={compartiendoEnCanal || !canalDestinoCompartir}
            startIcon={
              compartiendoEnCanal ? <CircularProgress size={14} color="inherit" /> : <ShieldCheck size={15} />
            }
            sx={{ bgcolor: '#1D3557', textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
          >
            {compartiendoEnCanal ? 'Blindando en Google Drive...' : 'Blindar Permisos y Compartir en Canal'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4500}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snackbar.severity} variant="filled" sx={{ borderRadius: 2 }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
