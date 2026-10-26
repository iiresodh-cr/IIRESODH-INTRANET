// src/components/workspace/GoogleDriveWorkspacePanel.jsx
import React, { useState, useEffect, useMemo } from 'react';
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
  ToggleButton
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
  Sparkles,
  Check,
  LayoutGrid,
  List as ListIcon,
  FolderOpen
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

// Transforma cualquier enlace de compartir de Google Drive/Docs en una URL embebible en iframe
export function convertirUrlDriveAEmbed(url = '', modo = 'preview') {
  if (!url) return '';
  try {
    // 1. Carpetas de Google Drive: https://drive.google.com/drive/folders/FOLDER_ID
    const folderMatch = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    if (folderMatch && folderMatch[1]) {
      return `https://drive.google.com/embeddedfolderview?id=${folderMatch[1]}#list`;
    }

    // 2. Google Docs / Sheets / Slides: https://docs.google.com/(document|spreadsheets|presentation)/d/FILE_ID/...
    const docsMatch = url.match(/docs\.google\.com\/(document|spreadsheets|presentation)\/d\/([a-zA-Z0-9_-]+)/);
    if (docsMatch && docsMatch[2]) {
      const tipoDoc = docsMatch[1];
      const fileId = docsMatch[2];
      return modo === 'edit'
        ? `https://docs.google.com/${tipoDoc}/d/${fileId}/edit?usp= embedded`
        : `https://docs.google.com/${tipoDoc}/d/${fileId}/preview`;
    }

    // 3. Archivo genérico de Drive: https://drive.google.com/file/d/FILE_ID/view
    const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (fileMatch && fileMatch[1]) {
      return `https://drive.google.com/file/d/${fileMatch[1]}/preview`;
    }

    // 4. Parámetro ?id=FILE_ID
    const idParamMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (idParamMatch && idParamMatch[1]) {
      return `https://drive.google.com/file/d/${idParamMatch[1]}/preview`;
    }

    return url;
  } catch {
    return url;
  }
}

export default function GoogleDriveWorkspacePanel({
  currentUser,
  userName,
  userRole,
  canalesDisponibles = [],
  initialPreviewItem = null,
  onClearInitialPreview,
  onIrACanal
}) {
  const [itemsDrive, setItemsDrive] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [modoVista, setModoVista] = useState('grid'); // 'grid' | 'lista'

  // Visor embebido activo
  const [itemEnVisor, setItemEnVisor] = useState(null);
  const [modoVisor, setModoVisor] = useState('preview'); // 'preview' | 'edit'

  // Modal de agregar/editar vínculo de Google Drive
  const [modalOpen, setModalOpen] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState({
    titulo: '',
    url: '',
    tipo: 'doc',
    categoria: 'General',
    descripcion: '',
    destacado: false,
    notificarCanalId: ''
  });

  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });

  const userEmail = (currentUser?.email || '').toLowerCase();

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
    setEditandoId(null);
    setForm({
      titulo: '',
      url: '',
      tipo: tipoPredefinido,
      categoria: 'Litigios y Expedientes',
      descripcion: '',
      destacado: false,
      notificarCanalId: ''
    });
    setModalOpen(true);
  };

  const abrirModalEditar = (item) => {
    setEditandoId(item.id);
    setForm({
      titulo: item.titulo || '',
      url: item.url || '',
      tipo: item.tipo || 'doc',
      categoria: item.categoria || 'General',
      descripcion: item.descripcion || '',
      destacado: Boolean(item.destacado),
      notificarCanalId: ''
    });
    setModalOpen(true);
  };

  const handleGuardarItem = async () => {
    if (!form.titulo.trim() || !form.url.trim()) return;

    const tipoDetectado = form.tipo || detectarTipoDrivePorUrl(form.url);
    const payload = {
      titulo: form.titulo.trim(),
      url: form.url.trim(),
      tipo: tipoDetectado,
      categoria: form.categoria.trim() || 'General',
      descripcion: form.descripcion.trim(),
      destacado: Boolean(form.destacado),
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

      // Publicar tarjeta en canal de Slack si se eligió notificar
      if (!editandoId && form.notificarCanalId) {
        const tipoInfo = TIPOS_DRIVE[tipoDetectado] || TIPOS_DRIVE.doc;
        await addDoc(collection(db, 'workspace_canales', form.notificarCanalId, 'mensajes'), {
          texto: `📁 *Recurso de Google Drive vinculado:* *${form.titulo.trim()}*\n• *Tipo:* ${tipoInfo.label}\n• *Categoría:* ${form.categoria}${form.descripcion ? `\n• *Nota:* ${form.descripcion.trim()}` : ''}`,
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
            categoria: form.categoria
          }
        });

        await updateDoc(doc(db, 'workspace_canales', form.notificarCanalId), {
          ultimoMensajeAt: serverTimestamp(),
          ultimoMensajeMs: Date.now(),
          ultimoMensajeTexto: `📁 Drive: ${form.titulo.trim()}`,
          ultimoMensajeAutor: userName || 'Equipo'
        });
      }

      setModalOpen(false);
      setSnackbar({
        open: true,
        message: editandoId
          ? 'Recurso de Drive actualizado.'
          : 'Archivo/Carpeta de Google Drive vinculado al Workspace.',
        severity: 'success'
      });
    } catch (err) {
      console.error('Error guardando recurso de Drive:', err);
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

  const handleCompartirEnCanal = async (item, canalId) => {
    if (!item || !canalId) return;
    try {
      const tipoInfo = TIPOS_DRIVE[item.tipo] || TIPOS_DRIVE.doc;
      await addDoc(collection(db, 'workspace_canales', canalId, 'mensajes'), {
        texto: `📁 *Documento compartido desde Google Drive:* *${item.titulo}*\n• *Tipo:* ${tipoInfo.label}`,
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
          id: item.id,
          titulo: item.titulo,
          url: item.url,
          tipo: item.tipo,
          categoria: item.categoria || 'General'
        }
      });

      await updateDoc(doc(db, 'workspace_canales', canalId), {
        ultimoMensajeAt: serverTimestamp(),
        ultimoMensajeMs: Date.now(),
        ultimoMensajeTexto: `📁 Drive: ${item.titulo}`,
        ultimoMensajeAutor: userName || 'Equipo'
      });

      setSnackbar({
        open: true,
        message: 'Recurso de Google Drive compartido en el canal.',
        severity: 'success'
      });
      if (onIrACanal) onIrACanal(canalId);
    } catch (err) {
      console.error('Error compartiendo item de Drive:', err);
    }
  };

  // Filtrado y ordenamiento (destacados primero)
  const itemsFiltrados = useMemo(() => {
    return itemsDrive
      .filter((item) => {
        if (filtroTipo === 'destacados' && !item.destacado) return false;
        if (filtroTipo !== 'todos' && filtroTipo !== 'destacados' && item.tipo !== filtroTipo) {
          return false;
        }
        if (!busqueda.trim()) return true;
        const term = busqueda.toLowerCase();
        return (
          (item.titulo || '').toLowerCase().includes(term) ||
          (item.categoria || '').toLowerCase().includes(term) ||
          (item.descripcion || '').toLowerCase().includes(term)
        );
      })
      .sort((a, b) => Number(Boolean(b.destacado)) - Number(Boolean(a.destacado)));
  }, [itemsDrive, filtroTipo, busqueda]);

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
            <Typography variant="subtitle1" fontWeight="800" color="#0f233c" sx={{ lineHeight: 1.2 }}>
              Google Drive & Documentos Colaborativos
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Biblioteca institucional sincronizada y visor integrado para cuentas @iiresodh.org
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
            Vincular Archivo / Carpeta de Drive
          </Button>
        </Box>
      </Box>

      {/* SUB-BARRA DE FILTROS Y BUSCADOR */}
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

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TextField
            size="small"
            placeholder="Buscar documento o carpeta..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            sx={{ width: { xs: 180, sm: 250 } }}
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
                Tu biblioteca de Google Drive en el Workspace está lista
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2.5 }}>
                Vincula carpetas compartidas de Drive, escritos en Google Docs, hojas de control en Sheets o PDFs para que todo el equipo pueda consultarlos y editarlos sin salir de la Intranet.
              </Typography>
              <Button
                variant="contained"
                startIcon={<Plus size={16} />}
                onClick={() => abrirModalNuevo('carpeta')}
                sx={{ bgcolor: '#1a365d', textTransform: 'none', fontWeight: 'bold', borderRadius: 2 }}
              >
                Vincular primer archivo o carpeta de Drive
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
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.2 }}>
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
                      <Box sx={{ display: 'flex', gap: 0.75 }}>
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
                          {seleccionado ? 'Cerrando visor' : 'Vista Previa'}
                        </Button>

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
                        {canalesDisponibles.filter((c) => c.tipo !== 'dm').length > 0 && (
                          <Tooltip title="Compartir en #general">
                            <IconButton
                              size="small"
                              onClick={() => handleCompartirEnCanal(item, 'general')}
                              sx={{ color: '#2563eb' }}
                            >
                              <Send size={14} />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title="Editar vínculo">
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

        {/* VISOR INTEGRADO DE GOOGLE DRIVE / DOCS / SHEETS */}
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

            {/* IFRAME EMBEBIDO DE GOOGLE WORKSPACE */}
            <Box sx={{ flexGrow: 1, position: 'relative', bgcolor: '#f1f5f9' }}>
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
            </Box>
          </Box>
        )}
      </Box>

      {/* MODAL PARA VINCULAR NUEVO ARCHIVO O CARPETA DE GOOGLE DRIVE */}
      <Dialog open={modalOpen} onClose={() => setModalOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: '800', color: '#1a365d' }}>
          {editandoId ? 'Editar Recurso de Google Drive' : 'Vincular Archivo o Carpeta de Google Drive'}
        </DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField
            label="Enlace de Google Drive / Docs / Sheets / Carpeta"
            placeholder="Pega aquí el enlace (ej: https://drive.google.com/... o https://docs.google.com/...)"
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

          <TextField
            label="Nombre o título del documento / carpeta"
            placeholder="Ej: Carpeta Maestra Casos CIDH 2026, Matriz de Plazos..."
            size="small"
            fullWidth
            required
            value={form.titulo}
            onChange={(e) => setForm((prev) => ({ ...prev, titulo: e.target.value }))}
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

          {!editandoId && (
            <FormControl size="small" fullWidth>
              <InputLabel>Notificar y compartir tarjeta en canal de Slack (Opcional)</InputLabel>
              <Select
                label="Notificar y compartir tarjeta en canal de Slack (Opcional)"
                value={form.notificarCanalId}
                onChange={(e) => setForm((prev) => ({ ...prev, notificarCanalId: e.target.value }))}
              >
                <MenuItem value="">
                  <em>No publicar en canal ahora</em>
                </MenuItem>
                {canalesDisponibles
                  .filter((c) => c.tipo !== 'dm')
                  .map((c) => (
                    <MenuItem key={c.id} value={c.id}>
                      #{c.nombre}
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setModalOpen(false)} sx={{ textTransform: 'none' }}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleGuardarItem}
            disabled={!form.titulo.trim() || !form.url.trim()}
            sx={{ bgcolor: '#1a365d', textTransform: 'none', fontWeight: 'bold', borderRadius: 2 }}
          >
            {editandoId ? 'Guardar Cambios' : 'Vincular a Workspace'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3500}
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
