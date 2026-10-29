// src/views/RecursosInstitucionales.jsx
import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, Button, Paper, Tabs, Tab, Card, CardContent, 
  Chip, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, 
  TextField, MenuItem, Select, FormControl, InputLabel, 
  LinearProgress, Alert, Tooltip, Divider, InputAdornment 
} from '@mui/material';
import { 
  ArrowLeft, UploadCloud, Download, Trash2, Copy, Check, 
  ExternalLink, FileText, Image as ImageIcon, Search, Plus, 
  AlertCircle, FolderArchive, BookOpen, Palette 
} from 'lucide-react';
import { db, storage } from '../config/firebase';
import { 
  collection, addDoc, getDocs, deleteDoc, doc, 
  query, orderBy, serverTimestamp 
} from 'firebase/firestore';
import { 
  ref, uploadBytesResumable, getDownloadURL, deleteObject 
} from 'firebase/storage';
import { registrarLogAuditoria } from '../utils/auditLogger';

export default function RecursosInstitucionales({ onVolver, currentUserEmail, userRole }) {
  const esAdmin = userRole === 'Superadmin' || userRole === 'Admin';

  const [tabActual, setTabActual] = useState(0); // 0: Reglamentos & Normativas Internas, 1: Material Gráfico & Identidad
  const [recursos, setRecursos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('todas');

  // Estados del modal de subida
  const [modalSubidaOpen, setModalSubidaOpen] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [seccion, setSeccion] = useState('reglamento'); // 'reglamento' | 'grafico'
  const [categoria, setCategoria] = useState('');
  const [archivoSeleccionado, setArchivoSeleccionado] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [subiendo, setSubiendo] = useState(false);
  const [progresoSubida, setProgresoSubida] = useState(0);
  const [errorModal, setErrorModal] = useState('');

  // Estados para diálogo de confirmación de eliminación
  const [itemAEliminar, setItemAEliminar] = useState(null);
  const [eliminando, setEliminando] = useState(false);

  // Estado para feedback de copiado al portapapeles
  const [copiadoId, setCopiadoId] = useState(null);

  // Categorías predeterminadas según la sección
  const categoriasGraficas = ['Logos', 'Isotipos', 'Identidad Visual', 'Banners', 'Papelería & Plantillas'];
  const categoriasReglamentos = ['Reglamentos Internos', 'Políticas & Códigos', 'Manuales Operativos', 'Protocolos Jurídicos'];

  // Cargar recursos desde Firestore
  const cargarRecursos = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'recursos_institucionales'), orderBy('creadoEn', 'desc'));
      const snapshot = await getDocs(q);
      const items = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setRecursos(items);
    } catch (err) {
      console.error('Error al cargar recursos institucionales:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarRecursos();
  }, []);

  // Manejar selección de archivo local
  const handleSeleccionarArchivo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validación de peso máximo (ej: 40MB)
    if (file.size > 40 * 1024 * 1024) {
      setErrorModal('El archivo supera el límite permitido de 40 MB.');
      return;
    }

    setArchivoSeleccionado(file);
    setErrorModal('');

    // Previsualización si es imagen
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      setPreviewUrl('');
    }

    // Autocompletar título si está vacío
    if (!titulo) {
      const nombreLimpio = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      setTitulo(nombreLimpio);
    }
  };

  const handleCerrarModalSubida = () => {
    if (subiendo) return;
    setModalSubidaOpen(false);
    setTitulo('');
    setDescripcion('');
    setCategoria('');
    setArchivoSeleccionado(null);
    setPreviewUrl('');
    setProgresoSubida(0);
    setErrorModal('');
  };

  // Subir archivo a Firebase Storage y registrar en Firestore
  const handleGuardarRecurso = async (e) => {
    e.preventDefault();
    if (!archivoSeleccionado) {
      setErrorModal('Por favor selecciona un archivo para subir.');
      return;
    }
    if (!titulo.trim()) {
      setErrorModal('El título del recurso es obligatorio.');
      return;
    }

    setSubiendo(true);
    setProgresoSubida(0);
    setErrorModal('');

    const extension = archivoSeleccionado.name.split('.').pop() || '';
    const safeName = archivoSeleccionado.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `recursos_institucionales/${seccion}/${Date.now()}_${safeName}`;
    const storageRef = ref(storage, storagePath);
    const uploadTask = uploadBytesResumable(storageRef, archivoSeleccionado);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setProgresoSubida(Math.round(progress));
      },
      (error) => {
        console.error('Error al subir a Firebase Storage:', error);
        setErrorModal('Error al subir el archivo físico a Storage: ' + error.message);
        setSubiendo(false);
      },
      async () => {
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

          const categoriaFinal = categoria || (seccion === 'grafico' ? 'Identidad Visual' : 'Reglamentos Internos');

          await addDoc(collection(db, 'recursos_institucionales'), {
            titulo: titulo.trim(),
            descripcion: descripcion.trim(),
            seccion: seccion, // 'grafico' | 'reglamento'
            categoria: categoriaFinal,
            archivoUrl: downloadURL,
            archivoPath: storagePath,
            nombreArchivo: archivoSeleccionado.name,
            extension: extension.toLowerCase(),
            tamanoBytes: archivoSeleccionado.size,
            tipoMime: archivoSeleccionado.type,
            creadoPor: currentUserEmail,
            creadoEn: serverTimestamp(),
          });

          await registrarLogAuditoria(
            currentUserEmail,
            'Subida de Recurso Institucional',
            `Se subió el recurso "${titulo.trim()}" en la sección ${seccion.toUpperCase()} (${categoriaFinal}).`
          );

          handleCerrarModalSubida();
          await cargarRecursos();
        } catch (err) {
          console.error('Error al registrar metadatos en Firestore:', err);
          setErrorModal('El archivo se subió a Storage pero ocurrió un error al registrarlo: ' + err.message);
        } finally {
          setSubiendo(false);
        }
      }
    );
  };

  // Eliminar recurso de Storage y Firestore
  const handleConfirmarEliminar = async () => {
    if (!itemAEliminar) return;
    setEliminando(true);
    try {
      // 1. Intentar borrar de Storage si tiene path
      if (itemAEliminar.archivoPath) {
        try {
          const fileRef = ref(storage, itemAEliminar.archivoPath);
          await deleteObject(fileRef);
        } catch (storageErr) {
          console.warn('No se pudo borrar el archivo físico de Storage (puede que ya no exista):', storageErr);
        }
      }

      // 2. Borrar documento de Firestore
      await deleteDoc(doc(db, 'recursos_institucionales', itemAEliminar.id));

      await registrarLogAuditoria(
        currentUserEmail,
        'Eliminación de Recurso Institucional',
        `Se eliminó el recurso "${itemAEliminar.titulo}" (ID: ${itemAEliminar.id}).`
      );

      setItemAEliminar(null);
      await cargarRecursos();
    } catch (err) {
      console.error('Error al eliminar recurso institucional:', err);
    } finally {
      setEliminando(false);
    }
  };

  // Copiar URL al portapapeles
  const handleCopiarEnlace = (id, url) => {
    navigator.clipboard.writeText(url);
    setCopiadoId(id);
    setTimeout(() => setCopiadoId(null), 2200);
  };

  // Formatear bytes a KB / MB
  const formatTamano = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // Filtrado de recursos
  const seccionActualKey = tabActual === 0 ? 'reglamento' : 'grafico';
  const recursosFiltrados = recursos.filter((rec) => {
    const coincideSeccion = (rec.seccion || 'grafico') === seccionActualKey;
    const coincideBusqueda = 
      !busqueda || 
      rec.titulo?.toLowerCase().includes(busqueda.toLowerCase()) ||
      rec.descripcion?.toLowerCase().includes(busqueda.toLowerCase()) ||
      rec.categoria?.toLowerCase().includes(busqueda.toLowerCase());
    const coincideCategoria = 
      categoriaFiltro === 'todas' || rec.categoria === categoriaFiltro;

    return coincideSeccion && coincideBusqueda && coincideCategoria;
  });

  // Categorías disponibles para filtro según tab
  const categoriasFiltro = Array.from(
    new Set(
      recursos
        .filter((r) => (r.seccion || 'grafico') === seccionActualKey && r.categoria)
        .map((r) => r.categoria)
    )
  );

  const totalReglamentos = recursos.filter((r) => (r.seccion || 'grafico') === 'reglamento').length;
  const totalGraficos = recursos.filter((r) => (r.seccion || 'grafico') === 'grafico').length;

  return (
    <Box
      sx={{
        maxWidth: 1320,
        mx: 'auto',
        px: { xs: 1, sm: 2, md: 3 },
        py: { xs: 1.5, md: 2.5 },
        fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif'
      }}
    >
      {/* ============================================================== */}
      {/* 1. CABECERA EJECUTIVA + STRIP DE MÉTRICAS EN LÍNEA             */}
      {/* ============================================================== */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', md: 'center' },
          gap: 2,
          pb: 2.5,
          mb: 2.5,
          borderBottom: '1px solid #e2e8f0'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.75 }}>
          <Tooltip title="Volver al Hub">
            <IconButton
              onClick={onVolver}
              size="small"
              sx={{
                width: 34,
                height: 34,
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                bgcolor: '#ffffff',
                color: '#334155',
                flexShrink: 0,
                '&:hover': { bgcolor: '#f8fafc', borderColor: '#cbd5e1', color: '#0f172a' }
              }}
            >
              <ArrowLeft size={16} />
            </IconButton>
          </Tooltip>

          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.3 }}>
              <Typography
                sx={{
                  fontSize: '0.66rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: '#64748b'
                }}
              >
                Repositorio Oficial · IIRESODH
              </Typography>
              <Box sx={{ width: 3, height: 3, borderRadius: '50%', bgcolor: '#cbd5e1' }} />
              <Typography
                sx={{
                  fontSize: '0.66rem',
                  fontWeight: 600,
                  color: '#0f766e',
                  fontVariantNumeric: 'tabular-nums'
                }}
              >
                {recursos.length} activos publicados
              </Typography>
            </Box>

            <Typography
              sx={{
                fontSize: { xs: '1.2rem', sm: '1.4rem' },
                fontWeight: 700,
                color: '#0f172a',
                letterSpacing: '-0.025em',
                lineHeight: 1.2
              }}
            >
              Centro de Recursos Institucionales
            </Typography>
          </Box>
        </Box>

        {/* Strip compacto de contadores + Acción Principal */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.25,
            flexWrap: 'wrap',
            width: { xs: '100%', md: 'auto' },
            justifyContent: { xs: 'space-between', md: 'flex-end' }
          }}
        >
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              bgcolor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              px: 1.5,
              py: 0.6,
              gap: 1.75
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.6 }}>
              <Typography
                sx={{
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: '#64748b'
                }}
              >
                Normativas
              </Typography>
              <Typography
                sx={{
                  fontSize: '0.84rem',
                  fontWeight: 700,
                  color: '#0f172a',
                  fontVariantNumeric: 'tabular-nums'
                }}
              >
                {totalReglamentos}
              </Typography>
            </Box>

            <Box sx={{ width: '1px', height: 14, bgcolor: '#e2e8f0' }} />

            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.6 }}>
              <Typography
                sx={{
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: '#64748b'
                }}
              >
                Identidad
              </Typography>
              <Typography
                sx={{
                  fontSize: '0.84rem',
                  fontWeight: 700,
                  color: '#0f172a',
                  fontVariantNumeric: 'tabular-nums'
                }}
              >
                {totalGraficos}
              </Typography>
            </Box>
          </Box>

          {esAdmin && (
            <Button
              variant="contained"
              size="small"
              startIcon={<Plus size={15} />}
              onClick={() => {
                setSeccion(tabActual === 0 ? 'reglamento' : 'grafico');
                setModalSubidaOpen(true);
              }}
              sx={{
                textTransform: 'none',
                borderRadius: '8px',
                bgcolor: '#0f172a',
                color: '#ffffff',
                fontWeight: 600,
                fontSize: '0.78rem',
                px: 1.75,
                height: 34,
                boxShadow: 'none',
                '&:hover': { bgcolor: '#1e293b', boxShadow: 'none' }
              }}
            >
              Subir Recurso
            </Button>
          )}
        </Box>
      </Box>

      {/* ============================================================== */}
      {/* 2. BARRA DE COMANDO: CONTROL SEGMENTADO + BÚSQUEDA + FILTROS   */}
      {/* ============================================================== */}
      <Box
        sx={{
          bgcolor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          p: { xs: 1.25, sm: 1.5 },
          mb: 3,
          boxShadow: '0 1px 2px rgba(15, 23, 42, 0.03)'
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            alignItems: { xs: 'stretch', md: 'center' },
            justifyContent: 'space-between',
            gap: 1.5
          }}
        >
          {/* Selector Segmentado Estilo Linear */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              bgcolor: '#f1f5f9',
              p: 0.45,
              borderRadius: '8px',
              gap: 0.45,
              minWidth: { md: 420 }
            }}
          >
            <Box
              onClick={() => {
                setTabActual(0);
                setCategoriaFiltro('todas');
              }}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 0.8,
                py: 0.65,
                px: 1.25,
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.77rem',
                fontWeight: tabActual === 0 ? 600 : 500,
                bgcolor: tabActual === 0 ? '#ffffff' : 'transparent',
                color: tabActual === 0 ? '#0f172a' : '#64748b',
                boxShadow: tabActual === 0 ? '0 1px 2px rgba(15, 23, 42, 0.06)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <BookOpen size={14} />
              <span>Reglamentos y Normativas</span>
              <Box
                component="span"
                sx={{
                  px: 0.65,
                  py: 0.05,
                  borderRadius: '5px',
                  bgcolor: tabActual === 0 ? '#f1f5f9' : 'rgba(148,163,184,0.2)',
                  color: tabActual === 0 ? '#0f172a' : '#64748b',
                  fontSize: '0.67rem',
                  fontWeight: 700,
                  fontVariantNumeric: 'tabular-nums'
                }}
              >
                {totalReglamentos}
              </Box>
            </Box>

            <Box
              onClick={() => {
                setTabActual(1);
                setCategoriaFiltro('todas');
              }}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 0.8,
                py: 0.65,
                px: 1.25,
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.77rem',
                fontWeight: tabActual === 1 ? 600 : 500,
                bgcolor: tabActual === 1 ? '#ffffff' : 'transparent',
                color: tabActual === 1 ? '#0f172a' : '#64748b',
                boxShadow: tabActual === 1 ? '0 1px 2px rgba(15, 23, 42, 0.06)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <Palette size={14} />
              <span>Identidad y Material Gráfico</span>
              <Box
                component="span"
                sx={{
                  px: 0.65,
                  py: 0.05,
                  borderRadius: '5px',
                  bgcolor: tabActual === 1 ? '#f1f5f9' : 'rgba(148,163,184,0.2)',
                  color: tabActual === 1 ? '#0f172a' : '#64748b',
                  fontSize: '0.67rem',
                  fontWeight: 700,
                  fontVariantNumeric: 'tabular-nums'
                }}
              >
                {totalGraficos}
              </Box>
            </Box>
          </Box>

          {/* Buscador de Precisión */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              bgcolor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              px: 1.25,
              height: 36,
              minWidth: { xs: '100%', md: 280 },
              flexGrow: 1,
              maxWidth: { md: 360 },
              transition: 'all 0.15s ease',
              '&:focus-within': {
                bgcolor: '#ffffff',
                borderColor: '#0f172a',
                boxShadow: '0 0 0 2px rgba(15, 23, 42, 0.05)'
              }
            }}
          >
            <Search size={14} color="#64748b" style={{ flexShrink: 0 }} />
            <TextField
              variant="standard"
              fullWidth
              placeholder="Filtrar por título, categoría o descripción..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              InputProps={{
                disableUnderline: true,
                sx: {
                  ml: 1,
                  fontSize: '0.79rem',
                  color: '#0f172a',
                  '& input::placeholder': { color: '#94a3b8', opacity: 1 }
                }
              }}
            />
          </Box>
        </Box>

        {/* Píldoras de Categoría si existen categorías */}
        {categoriasFiltro.length > 0 && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              flexWrap: 'wrap',
              mt: 1.25,
              pt: 1.25,
              borderTop: '1px solid #f1f5f9'
            }}
          >
            <Typography
              sx={{
                fontSize: '0.65rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
                color: '#94a3b8',
                mr: 0.5
              }}
            >
              Categoría:
            </Typography>
            <Box
              onClick={() => setCategoriaFiltro('todas')}
              sx={{
                px: 1.1,
                py: 0.35,
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.72rem',
                fontWeight: 600,
                bgcolor: categoriaFiltro === 'todas' ? '#0f172a' : '#f8fafc',
                color: categoriaFiltro === 'todas' ? '#ffffff' : '#475569',
                border: '1px solid',
                borderColor: categoriaFiltro === 'todas' ? '#0f172a' : '#e2e8f0',
                transition: 'all 0.15s ease'
              }}
            >
              Todas ({recursosFiltrados.length})
            </Box>
            {categoriasFiltro.map((cat) => {
              const active = categoriaFiltro === cat;
              return (
                <Box
                  key={cat}
                  onClick={() => setCategoriaFiltro(cat)}
                  sx={{
                    px: 1.1,
                    py: 0.35,
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    bgcolor: active ? '#0f172a' : '#f8fafc',
                    color: active ? '#ffffff' : '#475569',
                    border: '1px solid',
                    borderColor: active ? '#0f172a' : '#e2e8f0',
                    transition: 'all 0.15s ease',
                    '&:hover': {
                      borderColor: active ? '#0f172a' : '#cbd5e1',
                      bgcolor: active ? '#0f172a' : '#f1f5f9'
                    }
                  }}
                >
                  {cat}
                </Box>
              );
            })}
          </Box>
        )}
      </Box>

      {/* ============================================================== */}
      {/* 3. CONTENIDO: MATERIAL GRÁFICO & IDENTIDAD (TAB 1)             */}
      {/* ============================================================== */}
      {tabActual === 1 && (
        <Box>
          {loading ? (
            <Box sx={{ py: 8, textAlign: 'center' }}>
              <LinearProgress sx={{ maxWidth: 260, mx: 'auto', borderRadius: 1, bgcolor: '#e2e8f0', '& .MuiLinearProgress-bar': { bgcolor: '#0f172a' } }} />
              <Typography sx={{ mt: 1.5, fontSize: '0.78rem', color: '#64748b' }}>
                Sincronizando catálogo de identidad visual...
              </Typography>
            </Box>
          ) : recursosFiltrados.length === 0 ? (
            <Box
              sx={{
                p: 6,
                textAlign: 'center',
                borderRadius: '10px',
                border: '1px dashed #cbd5e1',
                bgcolor: '#ffffff'
              }}
            >
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: '10px',
                  bgcolor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mx: 'auto',
                  mb: 1.5
                }}
              >
                <Palette size={20} color="#64748b" />
              </Box>
              <Typography sx={{ fontSize: '0.92rem', fontWeight: 700, color: '#0f172a' }}>
                Sin recursos gráficos en esta vista
              </Typography>
              <Typography sx={{ fontSize: '0.78rem', color: '#64748b', mt: 0.5, maxWidth: 420, mx: 'auto' }}>
                {busqueda || categoriaFiltro !== 'todas'
                  ? 'No se encontraron coincidencias para los filtros seleccionados.'
                  : esAdmin
                  ? 'Publica logotipos oficiales, isotipos y plantillas institucionales con el botón superior.'
                  : 'Aún no se han publicado activos gráficos en esta categoría.'}
              </Typography>
              {esAdmin && !busqueda && categoriaFiltro === 'todas' && (
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<UploadCloud size={15} />}
                  onClick={() => {
                    setSeccion('grafico');
                    setModalSubidaOpen(true);
                  }}
                  sx={{
                    mt: 2.5,
                    textTransform: 'none',
                    borderRadius: '7px',
                    bgcolor: '#0f172a',
                    fontSize: '0.76rem',
                    fontWeight: 600,
                    boxShadow: 'none',
                    '&:hover': { bgcolor: '#1e293b', boxShadow: 'none' }
                  }}
                >
                  Subir primer recurso gráfico
                </Button>
              )}
            </Box>
          ) : (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
                gap: 2.25
              }}
            >
              {recursosFiltrados.map((rec) => {
                const esImagen =
                  rec.tipoMime?.startsWith('image/') ||
                  ['png', 'jpg', 'jpeg', 'svg', 'webp'].includes(rec.extension);
                return (
                  <Box
                    key={rec.id}
                    sx={{
                      // Coherencia arquitectónica: barra lateral sutil con radio cero a la izquierda
                      borderRadius: '0 10px 10px 0',
                      border: '1px solid #e2e8f0',
                      borderLeft: '3px solid #0f766e',
                      bgcolor: '#ffffff',
                      display: 'flex',
                      flexDirection: 'column',
                      overflow: 'hidden',
                      transition: 'all 0.18s ease',
                      '&:hover': {
                        borderColor: '#cbd5e1',
                        borderLeftColor: '#0f172a',
                        boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)'
                      }
                    }}
                  >
                    {/* Lienzo de Previsualización con Retícula de Transparencia */}
                    <Box
                      sx={{
                        height: 164,
                        bgcolor: '#f8fafc',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        p: 2.5,
                        position: 'relative',
                        borderBottom: '1px solid #f1f5f9',
                        backgroundImage: 'radial-gradient(#cbd5e1 0.75px, transparent 0.75px)',
                        backgroundSize: '14px 14px'
                      }}
                    >
                      {esImagen ? (
                        <img
                          src={rec.archivoUrl}
                          alt={rec.titulo}
                          style={{
                            maxHeight: '100%',
                            maxWidth: '100%',
                            objectFit: 'contain',
                            display: 'block',
                            filter: 'drop-shadow(0 2px 6px rgba(15,23,42,0.08))'
                          }}
                        />
                      ) : (
                        <Box sx={{ textAlign: 'center' }}>
                          <ImageIcon size={36} color="#94a3b8" />
                          <Typography
                            sx={{
                              mt: 0.75,
                              fontSize: '0.68rem',
                              textTransform: 'uppercase',
                              fontWeight: 700,
                              letterSpacing: '0.06em',
                              color: '#64748b'
                            }}
                          >
                            {rec.extension || 'ARCHIVO'}
                          </Typography>
                        </Box>
                      )}

                      {rec.categoria && (
                        <Box
                          sx={{
                            position: 'absolute',
                            top: 10,
                            left: 10,
                            px: 1,
                            py: 0.25,
                            borderRadius: '5px',
                            bgcolor: 'rgba(15, 23, 42, 0.82)',
                            color: '#ffffff',
                            fontWeight: 600,
                            fontSize: '0.66rem',
                            letterSpacing: '0.03em',
                            backdropFilter: 'blur(4px)'
                          }}
                        >
                          {rec.categoria}
                        </Box>
                      )}

                      <Box
                        sx={{
                          position: 'absolute',
                          bottom: 8,
                          right: 10,
                          px: 0.75,
                          py: 0.15,
                          borderRadius: '4px',
                          bgcolor: 'rgba(255,255,255,0.9)',
                          border: '1px solid #e2e8f0',
                          fontSize: '0.64rem',
                          fontWeight: 700,
                          color: '#334155',
                          textTransform: 'uppercase',
                          fontVariantNumeric: 'tabular-nums'
                        }}
                      >
                        {rec.extension || 'FILE'}
                        {rec.tamanoBytes ? ` · ${formatTamano(rec.tamanoBytes)}` : ''}
                      </Box>
                    </Box>

                    {/* Metadatos del Activo */}
                    <Box sx={{ p: 2, flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                      <Typography
                        sx={{
                          fontSize: '0.88rem',
                          fontWeight: 700,
                          color: '#0f172a',
                          letterSpacing: '-0.01em',
                          lineHeight: 1.3,
                          mb: 0.5
                        }}
                      >
                        {rec.titulo}
                      </Typography>
                      {rec.descripcion && (
                        <Typography
                          sx={{
                            fontSize: '0.76rem',
                            color: '#64748b',
                            lineHeight: 1.45,
                            mb: 1
                          }}
                        >
                          {rec.descripcion}
                        </Typography>
                      )}
                    </Box>

                    {/* Barra Inferior de Acciones */}
                    <Box
                      sx={{
                        px: 2,
                        py: 1.15,
                        bgcolor: '#f8fafc',
                        borderTop: '1px solid #f1f5f9',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        <Button
                          size="small"
                          variant="contained"
                          component="a"
                          href={rec.archivoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          download={rec.nombreArchivo || rec.titulo}
                          startIcon={<Download size={13} />}
                          sx={{
                            textTransform: 'none',
                            bgcolor: '#0f172a',
                            color: '#ffffff',
                            fontWeight: 600,
                            fontSize: '0.73rem',
                            height: 28,
                            px: 1.25,
                            borderRadius: '6px',
                            boxShadow: 'none',
                            '&:hover': { bgcolor: '#1e293b', boxShadow: 'none' }
                          }}
                        >
                          Descargar
                        </Button>

                        <Tooltip title={copiadoId === rec.id ? 'Enlace copiado' : 'Copiar URL directa'}>
                          <IconButton
                            size="small"
                            onClick={() => handleCopiarEnlace(rec.id, rec.archivoUrl)}
                            sx={{
                              width: 28,
                              height: 28,
                              border: '1px solid #e2e8f0',
                              borderRadius: '6px',
                              bgcolor: '#ffffff',
                              color: copiadoId === rec.id ? '#059669' : '#475569',
                              '&:hover': { bgcolor: '#f1f5f9', color: '#0f172a' }
                            }}
                          >
                            {copiadoId === rec.id ? <Check size={13} /> : <Copy size={13} />}
                          </IconButton>
                        </Tooltip>
                      </Box>

                      {esAdmin && (
                        <Tooltip title="Eliminar activo">
                          <IconButton
                            size="small"
                            onClick={() => setItemAEliminar(rec)}
                            sx={{
                              width: 28,
                              height: 28,
                              color: '#94a3b8',
                              borderRadius: '6px',
                              '&:hover': { color: '#dc2626', bgcolor: '#fef2f2' }
                            }}
                          >
                            <Trash2 size={14} />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  </Box>
                );
              })}
            </Box>
          )}
        </Box>
      )}

      {/* ============================================================== */}
      {/* 4. CONTENIDO: REGLAMENTOS Y NORMATIVAS (TAB 0)                 */}
      {/* ============================================================== */}
      {tabActual === 0 && (
        <Box>
          {loading ? (
            <Box sx={{ py: 8, textAlign: 'center' }}>
              <LinearProgress sx={{ maxWidth: 260, mx: 'auto', borderRadius: 1, bgcolor: '#e2e8f0', '& .MuiLinearProgress-bar': { bgcolor: '#0f172a' } }} />
              <Typography sx={{ mt: 1.5, fontSize: '0.78rem', color: '#64748b' }}>
                Sincronizando repositorio normativo...
              </Typography>
            </Box>
          ) : recursosFiltrados.length === 0 ? (
            <Box
              sx={{
                p: 6,
                textAlign: 'center',
                borderRadius: '10px',
                border: '1px dashed #cbd5e1',
                bgcolor: '#ffffff'
              }}
            >
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: '10px',
                  bgcolor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mx: 'auto',
                  mb: 1.5
                }}
              >
                <BookOpen size={20} color="#64748b" />
              </Box>
              <Typography sx={{ fontSize: '0.92rem', fontWeight: 700, color: '#0f172a' }}>
                No hay reglamentos o normativas en esta vista
              </Typography>
              <Typography sx={{ fontSize: '0.78rem', color: '#64748b', mt: 0.5, maxWidth: 420, mx: 'auto' }}>
                {busqueda || categoriaFiltro !== 'todas'
                  ? 'No se encontraron documentos con los filtros actuales.'
                  : esAdmin
                  ? 'Publica reglamentos internos, manuales operativos y protocolos institucionales.'
                  : 'Aún no se han publicado documentos normativos en esta sección.'}
              </Typography>
              {esAdmin && !busqueda && categoriaFiltro === 'todas' && (
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<UploadCloud size={15} />}
                  onClick={() => {
                    setSeccion('reglamento');
                    setModalSubidaOpen(true);
                  }}
                  sx={{
                    mt: 2.5,
                    textTransform: 'none',
                    borderRadius: '7px',
                    bgcolor: '#0f172a',
                    fontSize: '0.76rem',
                    fontWeight: 600,
                    boxShadow: 'none',
                    '&:hover': { bgcolor: '#1e293b', boxShadow: 'none' }
                  }}
                >
                  Subir primer reglamento
                </Button>
              )}
            </Box>
          ) : (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
              {recursosFiltrados.map((rec) => {
                const esPdf = rec.extension === 'pdf' || rec.tipoMime?.includes('pdf');
                return (
                  <Box
                    key={rec.id}
                    sx={{
                      // Coherencia arquitectónica: barra lateral izquierda con radio cero
                      borderRadius: '0 10px 10px 0',
                      border: '1px solid #e2e8f0',
                      borderLeft: esPdf ? '3px solid #b91c1c' : '3px solid #0f172a',
                      bgcolor: '#ffffff',
                      p: 2.25,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      transition: 'all 0.18s ease',
                      '&:hover': {
                        borderColor: '#cbd5e1',
                        boxShadow: '0 6px 20px rgba(15, 23, 42, 0.05)'
                      }
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.75 }}>
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: '8px',
                          bgcolor: esPdf ? '#fef2f2' : '#f8fafc',
                          border: '1px solid',
                          borderColor: esPdf ? '#fecaca' : '#e2e8f0',
                          color: esPdf ? '#dc2626' : '#0f172a',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}
                      >
                        <FileText size={19} />
                      </Box>

                      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.4, flexWrap: 'wrap' }}>
                          <Typography
                            sx={{
                              fontSize: '0.9rem',
                              fontWeight: 700,
                              color: '#0f172a',
                              letterSpacing: '-0.01em'
                            }}
                          >
                            {rec.titulo}
                          </Typography>
                          {rec.categoria && (
                            <Box
                              sx={{
                                px: 0.85,
                                py: 0.15,
                                borderRadius: '5px',
                                fontSize: '0.66rem',
                                fontWeight: 600,
                                bgcolor: '#f1f5f9',
                                color: '#475569'
                              }}
                            >
                              {rec.categoria}
                            </Box>
                          )}
                        </Box>

                        {rec.descripcion && (
                          <Typography
                            sx={{
                              fontSize: '0.78rem',
                              color: '#475569',
                              mb: 1,
                              lineHeight: 1.45
                            }}
                          >
                            {rec.descripcion}
                          </Typography>
                        )}

                        <Typography
                          sx={{
                            fontSize: '0.7rem',
                            color: '#94a3b8',
                            fontVariantNumeric: 'tabular-nums'
                          }}
                        >
                          {rec.nombreArchivo || `${rec.titulo}.${rec.extension || 'pdf'}`}
                          {rec.tamanoBytes ? ` · ${formatTamano(rec.tamanoBytes)}` : ''}
                        </Typography>
                      </Box>
                    </Box>

                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        mt: 2,
                        pt: 1.5,
                        borderTop: '1px solid #f1f5f9'
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.85, flexWrap: 'wrap' }}>
                        <Button
                          size="small"
                          variant="contained"
                          component="a"
                          href={rec.archivoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          startIcon={<ExternalLink size={13} />}
                          sx={{
                            textTransform: 'none',
                            bgcolor: '#0f172a',
                            color: '#ffffff',
                            fontWeight: 600,
                            fontSize: '0.73rem',
                            height: 28,
                            px: 1.25,
                            borderRadius: '6px',
                            boxShadow: 'none',
                            '&:hover': { bgcolor: '#1e293b', boxShadow: 'none' }
                          }}
                        >
                          Abrir Documento
                        </Button>

                        <Button
                          size="small"
                          variant="outlined"
                          component="a"
                          href={rec.archivoUrl}
                          download={rec.nombreArchivo || rec.titulo}
                          startIcon={<Download size={13} />}
                          sx={{
                            textTransform: 'none',
                            fontWeight: 600,
                            fontSize: '0.73rem',
                            height: 28,
                            px: 1.25,
                            borderRadius: '6px',
                            borderColor: '#e2e8f0',
                            color: '#334155',
                            '&:hover': { borderColor: '#cbd5e1', bgcolor: '#f8fafc', color: '#0f172a' }
                          }}
                        >
                          Descargar
                        </Button>

                        <Tooltip title={copiadoId === rec.id ? 'Enlace copiado' : 'Copiar enlace'}>
                          <IconButton
                            size="small"
                            onClick={() => handleCopiarEnlace(rec.id, rec.archivoUrl)}
                            sx={{
                              width: 28,
                              height: 28,
                              border: '1px solid #e2e8f0',
                              borderRadius: '6px',
                              color: copiadoId === rec.id ? '#059669' : '#64748b'
                            }}
                          >
                            {copiadoId === rec.id ? <Check size={13} /> : <Copy size={13} />}
                          </IconButton>
                        </Tooltip>
                      </Box>

                      {esAdmin && (
                        <Tooltip title="Eliminar documento">
                          <IconButton
                            size="small"
                            onClick={() => setItemAEliminar(rec)}
                            sx={{
                              width: 28,
                              height: 28,
                              color: '#94a3b8',
                              borderRadius: '6px',
                              '&:hover': { color: '#dc2626', bgcolor: '#fef2f2' }
                            }}
                          >
                            <Trash2 size={14} />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  </Box>
                );
              })}
            </Box>
          )}
        </Box>
      )}

      {/* ============================================================== */}
      {/* DIÁLOGO MODAL: SUBIR RECURSO (SOLO ADMINISTRADORES)            */}
      {/* ============================================================== */}
      <Dialog
        open={modalSubidaOpen}
        onClose={handleCerrarModalSubida}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 20px 45px rgba(15, 23, 42, 0.14)',
            m: { xs: 1.5, sm: 3 }
          }
        }}
      >
        <DialogTitle
          sx={{
            fontWeight: 700,
            fontSize: '0.96rem',
            color: '#0f172a',
            borderBottom: '1px solid #e2e8f0',
            px: 3,
            py: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 1.25
          }}
        >
          <Box
            sx={{
              width: 30,
              height: 30,
              borderRadius: '7px',
              bgcolor: '#0f172a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <UploadCloud size={15} color="#ffffff" />
          </Box>
          Publicar Recurso Institucional
        </DialogTitle>

        <form onSubmit={handleGuardarRecurso}>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.25, p: 3 }}>
            {errorModal && (
              <Alert severity="error" sx={{ borderRadius: '8px', fontSize: '0.78rem' }}>
                {errorModal}
              </Alert>
            )}

            <FormControl fullWidth size="small">
              <InputLabel>Sección Destino</InputLabel>
              <Select
                value={seccion}
                label="Sección Destino"
                onChange={(e) => {
                  setSeccion(e.target.value);
                  setCategoria('');
                }}
                disabled={subiendo}
              >
                <MenuItem value="reglamento">Reglamentos y Normativas Internas</MenuItem>
                <MenuItem value="grafico">Identidad y Material Gráfico</MenuItem>
              </Select>
            </FormControl>

            <TextField
              fullWidth
              size="small"
              label="Título del Recurso"
              placeholder={
                seccion === 'grafico'
                  ? 'Ej: Logotipo Oficial Horizontal (Blanco)'
                  : 'Ej: Reglamento Interno de Trabajo 2026'
              }
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              required
              disabled={subiendo}
            />

            <FormControl fullWidth size="small">
              <InputLabel>Categoría</InputLabel>
              <Select
                value={categoria}
                label="Categoría"
                onChange={(e) => setCategoria(e.target.value)}
                disabled={subiendo}
              >
                {(seccion === 'grafico' ? categoriasGraficas : categoriasReglamentos).map((cat) => (
                  <MenuItem key={cat} value={cat}>
                    {cat}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              fullWidth
              size="small"
              multiline
              rows={2}
              label="Descripción o Indicaciones de Uso (Opcional)"
              placeholder={
                seccion === 'grafico'
                  ? 'Ej: Versión vectorial con fondo transparente para fondos oscuros.'
                  : 'Ej: Documento vigente aprobado por Junta Directiva.'
              }
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              disabled={subiendo}
            />

            <Box>
              <Typography
                sx={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: '#64748b',
                  mb: 0.75
                }}
              >
                Archivo fuente (máx. 40 MB)
              </Typography>
              <Button
                variant="outlined"
                component="label"
                fullWidth
                disabled={subiendo}
                startIcon={<UploadCloud size={17} />}
                sx={{
                  py: 1.75,
                  border: '1px dashed #cbd5e1',
                  borderRadius: '8px',
                  textTransform: 'none',
                  bgcolor: '#f8fafc',
                  color: '#0f172a',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  '&:hover': { bgcolor: '#f1f5f9', borderColor: '#0f172a' }
                }}
              >
                {archivoSeleccionado ? archivoSeleccionado.name : 'Seleccionar archivo del dispositivo...'}
                <input
                  type="file"
                  hidden
                  onChange={handleSeleccionarArchivo}
                  accept={
                    seccion === 'grafico'
                      ? 'image/*,.svg,.ai,.eps,.pdf,.webp'
                      : '.pdf,.doc,.docx,.odt,.rtf'
                  }
                />
              </Button>
            </Box>

            {previewUrl && (
              <Box
                sx={{
                  textAlign: 'center',
                  p: 1.5,
                  bgcolor: '#f8fafc',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0'
                }}
              >
                <img
                  src={previewUrl}
                  alt="Vista previa"
                  style={{ maxHeight: 110, maxWidth: '100%', objectFit: 'contain' }}
                />
              </Box>
            )}

            {subiendo && (
              <Box sx={{ width: '100%' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography sx={{ fontSize: '0.73rem', fontWeight: 600, color: '#0f172a' }}>
                    Subiendo archivo...
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: '0.73rem',
                      fontWeight: 700,
                      color: '#0f172a',
                      fontVariantNumeric: 'tabular-nums'
                    }}
                  >
                    {progresoSubida}%
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={progresoSubida}
                  sx={{
                    height: 6,
                    borderRadius: 1,
                    bgcolor: '#e2e8f0',
                    '& .MuiLinearProgress-bar': { bgcolor: '#0f172a' }
                  }}
                />
              </Box>
            )}
          </DialogContent>

          <DialogActions sx={{ px: 3, py: 2, bgcolor: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
            <Button
              onClick={handleCerrarModalSubida}
              disabled={subiendo}
              sx={{ textTransform: 'none', color: '#64748b', fontSize: '0.78rem', fontWeight: 600 }}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={subiendo || !archivoSeleccionado}
              sx={{
                textTransform: 'none',
                bgcolor: '#0f172a',
                color: '#ffffff',
                fontWeight: 600,
                fontSize: '0.78rem',
                borderRadius: '7px',
                px: 2.25,
                boxShadow: 'none',
                '&:hover': { bgcolor: '#1e293b', boxShadow: 'none' }
              }}
            >
              {subiendo ? 'Publicando...' : 'Publicar Recurso'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* ============================================================== */}
      {/* DIÁLOGO MODAL: CONFIRMACIÓN DE ELIMINACIÓN                     */}
      {/* ============================================================== */}
      <Dialog
        open={Boolean(itemAEliminar)}
        onClose={() => !eliminando && setItemAEliminar(null)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 20px 40px rgba(15, 23, 42, 0.14)',
            m: { xs: 1.5, sm: 3 }
          }
        }}
      >
        <DialogTitle
          sx={{
            fontWeight: 700,
            fontSize: '0.95rem',
            color: '#0f172a',
            borderBottom: '1px solid #f1f5f9',
            px: 2.5,
            py: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 1.25
          }}
        >
          <Box
            sx={{
              width: 30,
              height: 30,
              borderRadius: '7px',
              bgcolor: '#fef2f2',
              border: '1px solid #fecaca',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <AlertCircle size={16} color="#dc2626" />
          </Box>
          Confirmar Eliminación
        </DialogTitle>
        <DialogContent sx={{ px: 2.5, py: 2.25 }}>
          <Typography sx={{ fontSize: '0.83rem', color: '#334155', mb: 1.5, lineHeight: 1.5 }}>
            ¿Confirmas eliminar el recurso <strong>"{itemAEliminar?.titulo}"</strong>?
          </Typography>
          <Box
            sx={{
              p: 1.5,
              bgcolor: '#fffbeb',
              border: '1px solid #fde68a',
              borderLeft: '3px solid #d97706',
              borderRadius: '0 8px 8px 0',
              fontSize: '0.75rem',
              color: '#92400e',
              lineHeight: 1.45
            }}
          >
            Esta acción eliminará el archivo de Firebase Storage y dejará registro en los <strong>Logs de Auditoría</strong>.
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 2.5, py: 1.75, bgcolor: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
          <Button
            onClick={() => setItemAEliminar(null)}
            disabled={eliminando}
            sx={{ textTransform: 'none', color: '#64748b', fontSize: '0.78rem', fontWeight: 600 }}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirmarEliminar}
            variant="contained"
            color="error"
            disabled={eliminando}
            sx={{
              textTransform: 'none',
              borderRadius: '7px',
              fontWeight: 600,
              fontSize: '0.78rem',
              bgcolor: '#dc2626',
              boxShadow: 'none',
              '&:hover': { bgcolor: '#b91c1c', boxShadow: 'none' }
            }}
          >
            {eliminando ? 'Eliminando...' : 'Eliminar Definitivamente'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
