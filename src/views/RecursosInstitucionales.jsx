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

  const [tabActual, setTabActual] = useState(0); // 0: Material Gráfico, 1: Reglamentos Internos
  const [recursos, setRecursos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('todas');

  // Estados del modal de subida
  const [modalSubidaOpen, setModalSubidaOpen] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [seccion, setSeccion] = useState('grafico'); // 'grafico' | 'reglamento'
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
  const seccionActualKey = tabActual === 0 ? 'grafico' : 'reglamento';
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

  return (
    <Box sx={{ maxWidth: 1300, mx: 'auto', p: { xs: 1, md: 2 } }}>
      
      {/* BARRA SUPERIOR DE NAVEGACIÓN Y ACCIONES */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<ArrowLeft size={18} />}
            onClick={onVolver}
            sx={{
              textTransform: 'none',
              borderRadius: 2,
              borderColor: '#cbd5e1',
              color: '#334155',
              fontWeight: 600,
              '&:hover': { borderColor: '#94a3b8', bgcolor: 'rgba(0,0,0,0.03)' }
            }}
          >
            Volver al Hub
          </Button>
          <Box>
            <Typography variant="h5" fontWeight="bold" color="primary.main" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <FolderArchive size={26} color="#1a365d" />
              Centro de Recursos Institucionales
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Identidad visual oficial, material de diseño y reglamentos internos de IIRESODH
            </Typography>
          </Box>
        </Box>

        {esAdmin && (
          <Button
            variant="contained"
            startIcon={<Plus size={18} />}
            onClick={() => {
              setSeccion(tabActual === 0 ? 'grafico' : 'reglamento');
              setModalSubidaOpen(true);
            }}
            sx={{
              textTransform: 'none',
              borderRadius: 2,
              bgcolor: '#1a365d',
              fontWeight: 'bold',
              boxShadow: '0 4px 12px rgba(26, 54, 93, 0.25)',
              '&:hover': { bgcolor: '#0f233c' }
            }}
          >
            Subir Recurso
          </Button>
        )}
      </Box>

      {/* PESTAÑAS (TABS) */}
      <Paper 
        elevation={0} 
        sx={{ 
          borderRadius: 3, 
          border: '1px solid #e2e8f0', 
          bgcolor: '#ffffff', 
          mb: 3, 
          overflow: 'hidden' 
        }}
      >
        <Tabs
          value={tabActual}
          onChange={(e, v) => {
            setTabActual(v);
            setCategoriaFiltro('todas');
          }}
          textColor="primary"
          indicatorColor="primary"
          sx={{
            px: 2,
            borderBottom: '1px solid #e2e8f0',
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.95rem',
              py: 2,
              minHeight: 56
            }
          }}
        >
          <Tab 
            icon={<Palette size={18} />} 
            iconPosition="start" 
            label="Material Gráfico & Identidad" 
          />
          <Tab 
            icon={<BookOpen size={18} />} 
            iconPosition="start" 
            label="Reglamentos & Normativas Internas" 
          />
        </Tabs>

        {/* BARRA DE BÚSQUEDA Y FILTRO DE CATEGORÍAS */}
        <Box sx={{ p: 2, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center', bgcolor: '#f8fafc' }}>
          <TextField
            size="small"
            placeholder="Buscar por título o descripción..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={18} color="#94a3b8" />
                </InputAdornment>
              ),
            }}
            sx={{ 
              minWidth: { xs: '100%', sm: 280 }, 
              bgcolor: '#ffffff',
              borderRadius: 2,
              '& .MuiOutlinedInput-root': { borderRadius: 2 }
            }}
          />

          {categoriasFiltro.length > 0 && (
            <FormControl size="small" sx={{ minWidth: 200, bgcolor: '#ffffff', borderRadius: 2 }}>
              <InputLabel>Categoría</InputLabel>
              <Select
                value={categoriaFiltro}
                label="Categoría"
                onChange={(e) => setCategoriaFiltro(e.target.value)}
                sx={{ borderRadius: 2 }}
              >
                <MenuItem value="todas">Todas las categorías</MenuItem>
                {categoriasFiltro.map((cat) => (
                  <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto', fontWeight: 500 }}>
            {recursosFiltrados.length} {recursosFiltrados.length === 1 ? 'recurso encontrado' : 'recursos encontrados'}
          </Typography>
        </Box>
      </Paper>

      {/* CONTENIDO: MATERIAL GRÁFICO (TAB 0) */}
      {tabActual === 0 && (
        <Box>
          {loading ? (
            <Box sx={{ py: 8, textAlign: 'center' }}>
              <LinearProgress sx={{ maxWidth: 300, mx: 'auto', borderRadius: 1 }} />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                Cargando material gráfico oficial...
              </Typography>
            </Box>
          ) : recursosFiltrados.length === 0 ? (
            <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 3, border: '1px dashed #cbd5e1', bgcolor: 'rgba(255,255,255,0.7)' }}>
              <Palette size={48} color="#94a3b8" style={{ marginBottom: 12 }} />
              <Typography variant="h6" fontWeight="bold" color="text.secondary">
                No hay recursos gráficos disponibles
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1, maxWidth: 450, mx: 'auto' }}>
                {busqueda || categoriaFiltro !== 'todas' 
                  ? 'No se encontraron resultados con los filtros actuales.' 
                  : esAdmin 
                    ? 'Comienza subiendo los logos institucionales, isotipos o material gráfico con el botón "Subir Recurso".' 
                    : 'Aún no se han publicado recursos gráficos en esta sección.'}
              </Typography>
              {esAdmin && !busqueda && categoriaFiltro === 'todas' && (
                <Button
                  variant="contained"
                  startIcon={<UploadCloud size={18} />}
                  onClick={() => {
                    setSeccion('grafico');
                    setModalSubidaOpen(true);
                  }}
                  sx={{ mt: 3, textTransform: 'none', borderRadius: 2, bgcolor: '#1a365d' }}
                >
                  Subir primer recurso gráfico
                </Button>
              )}
            </Paper>
          ) : (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, gap: 3 }}>
              {recursosFiltrados.map((rec) => {
                const esImagen = rec.tipoMime?.startsWith('image/') || ['png', 'jpg', 'jpeg', 'svg', 'webp'].includes(rec.extension);
                return (
                  <Card
                    key={rec.id}
                    sx={{
                      borderRadius: 3,
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.03)',
                      display: 'flex',
                      flexDirection: 'column',
                      transition: 'all 0.2s',
                      bgcolor: '#ffffff',
                      '&:hover': {
                        transform: 'translateY(-3px)',
                        boxShadow: '0 8px 24px rgba(26, 54, 93, 0.08)',
                        borderColor: '#cbd5e1'
                      }
                    }}
                  >
                    {/* ÁREA DE PREVIEW VISUAL */}
                    <Box
                      sx={{
                        height: 180,
                        bgcolor: '#f1f5f9',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        p: 2,
                        position: 'relative',
                        borderBottom: '1px solid #f1f5f9',
                        backgroundImage: 'radial-gradient(#e2e8f0 1px, transparent 1px)',
                        backgroundSize: '12px 12px'
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
                            display: 'block'
                          }}
                        />
                      ) : (
                        <Box sx={{ textAlign: 'center' }}>
                          <ImageIcon size={48} color="#94a3b8" />
                          <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 1, textTransform: 'uppercase', fontWeight: 'bold' }}>
                            {rec.extension || 'ARCHIVO'}
                          </Typography>
                        </Box>
                      )}

                      {/* BADGE DE CATEGORÍA */}
                      {rec.categoria && (
                        <Chip
                          label={rec.categoria}
                          size="small"
                          sx={{
                            position: 'absolute',
                            top: 10,
                            left: 10,
                            bgcolor: 'rgba(26, 54, 93, 0.85)',
                            color: '#ffffff',
                            fontWeight: 600,
                            fontSize: '0.72rem',
                            backdropFilter: 'blur(4px)'
                          }}
                        />
                      )}
                    </Box>

                    {/* DETALLES DEL RECURSO */}
                    <CardContent sx={{ p: 2.5, flexGrow: 1 }}>
                      <Typography variant="subtitle1" fontWeight="bold" color="text.primary" gutterBottom sx={{ lineHeight: 1.3 }}>
                        {rec.titulo}
                      </Typography>
                      {rec.descripcion && (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, fontSize: '0.85rem' }}>
                          {rec.descripcion}
                        </Typography>
                      )}
                      
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mt: 'auto' }}>
                        <Chip 
                          label={rec.extension?.toUpperCase() || 'FILE'} 
                          size="small" 
                          variant="outlined" 
                          sx={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#1a365d', borderColor: '#cbd5e1' }} 
                        />
                        {rec.tamanoBytes && (
                          <Typography variant="caption" color="text.secondary">
                            {formatTamano(rec.tamanoBytes)}
                          </Typography>
                        )}
                      </Box>
                    </CardContent>

                    <Divider />

                    {/* BOTONES DE ACCIÓN */}
                    <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                          size="small"
                          variant="contained"
                          component="a"
                          href={rec.archivoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          download={rec.nombreArchivo || rec.titulo}
                          startIcon={<Download size={15} />}
                          sx={{
                            textTransform: 'none',
                            bgcolor: '#1a365d',
                            fontWeight: 600,
                            fontSize: '0.8rem',
                            borderRadius: 1.5,
                            '&:hover': { bgcolor: '#0f233c' }
                          }}
                        >
                          Descargar
                        </Button>

                        <Tooltip title={copiadoId === rec.id ? '¡Enlace copiado!' : 'Copiar enlace directo'}>
                          <IconButton
                            size="small"
                            onClick={() => handleCopiarEnlace(rec.id, rec.archivoUrl)}
                            sx={{
                              border: '1px solid #e2e8f0',
                              borderRadius: 1.5,
                              color: copiadoId === rec.id ? '#16a34a' : '#64748b'
                            }}
                          >
                            {copiadoId === rec.id ? <Check size={16} /> : <Copy size={16} />}
                          </IconButton>
                        </Tooltip>
                      </Box>

                      {esAdmin && (
                        <Tooltip title="Eliminar recurso">
                          <IconButton
                            size="small"
                            onClick={() => setItemAEliminar(rec)}
                            sx={{
                              color: '#ef4444',
                              borderRadius: 1.5,
                              '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.08)' }
                            }}
                          >
                            <Trash2 size={16} />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  </Card>
                );
              })}
            </Box>
          )}
        </Box>
      )}

      {/* CONTENIDO: REGLAMENTOS Y NORMATIVAS (TAB 1) */}
      {tabActual === 1 && (
        <Box>
          {loading ? (
            <Box sx={{ py: 8, textAlign: 'center' }}>
              <LinearProgress sx={{ maxWidth: 300, mx: 'auto', borderRadius: 1 }} />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                Cargando reglamentos internos...
              </Typography>
            </Box>
          ) : recursosFiltrados.length === 0 ? (
            <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 3, border: '1px dashed #cbd5e1', bgcolor: 'rgba(255,255,255,0.7)' }}>
              <BookOpen size={48} color="#94a3b8" style={{ marginBottom: 12 }} />
              <Typography variant="h6" fontWeight="bold" color="text.secondary">
                No hay reglamentos o normativas registradas
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1, maxWidth: 450, mx: 'auto' }}>
                {busqueda || categoriaFiltro !== 'todas' 
                  ? 'No se encontraron documentos con los filtros actuales.' 
                  : esAdmin 
                    ? 'Comienza publicando los reglamentos internos, manuales y políticas institucionales con el botón "Subir Recurso".' 
                    : 'Aún no se han publicado reglamentos en esta sección.'}
              </Typography>
              {esAdmin && !busqueda && categoriaFiltro === 'todas' && (
                <Button
                  variant="contained"
                  startIcon={<UploadCloud size={18} />}
                  onClick={() => {
                    setSeccion('reglamento');
                    setModalSubidaOpen(true);
                  }}
                  sx={{ mt: 3, textTransform: 'none', borderRadius: 2, bgcolor: '#1a365d' }}
                >
                  Subir primer reglamento
                </Button>
              )}
            </Paper>
          ) : (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2.5 }}>
              {recursosFiltrados.map((rec) => {
                const esPdf = rec.extension === 'pdf' || rec.tipoMime?.includes('pdf');
                return (
                  <Card
                    key={rec.id}
                    sx={{
                      borderRadius: 3,
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.02)',
                      p: 2.5,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      bgcolor: '#ffffff',
                      transition: 'all 0.2s',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: '0 8px 20px rgba(26, 54, 93, 0.06)',
                        borderColor: '#cbd5e1'
                      }
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                      <Box
                        sx={{
                          p: 1.5,
                          borderRadius: 2,
                          bgcolor: esPdf ? 'rgba(239, 68, 68, 0.08)' : 'rgba(26, 54, 93, 0.08)',
                          color: esPdf ? '#ef4444' : '#1a365d',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <FileText size={28} />
                      </Box>

                      <Box sx={{ flexGrow: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
                          <Typography variant="subtitle1" fontWeight="bold" color="text.primary">
                            {rec.titulo}
                          </Typography>
                          {rec.categoria && (
                            <Chip 
                              label={rec.categoria} 
                              size="small" 
                              sx={{ fontSize: '0.72rem', height: 20, bgcolor: '#f1f5f9', fontWeight: 600 }} 
                            />
                          )}
                        </Box>

                        {rec.descripcion && (
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontSize: '0.875rem' }}>
                            {rec.descripcion}
                          </Typography>
                        )}

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, color: 'text.secondary', fontSize: '0.78rem', flexWrap: 'wrap' }}>
                          <span>Archivo: <strong>{rec.nombreArchivo || `${rec.titulo}.${rec.extension}`}</strong></span>
                          {rec.tamanoBytes && <span>• {formatTamano(rec.tamanoBytes)}</span>}
                        </Box>
                      </Box>
                    </Box>

                    <Divider sx={{ my: 2 }} />

                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                          size="small"
                          variant="contained"
                          component="a"
                          href={rec.archivoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          startIcon={<ExternalLink size={15} />}
                          sx={{
                            textTransform: 'none',
                            bgcolor: '#1a365d',
                            fontWeight: 600,
                            fontSize: '0.8rem',
                            borderRadius: 1.5,
                            '&:hover': { bgcolor: '#0f233c' }
                          }}
                        >
                          Ver Documento
                        </Button>

                        <Button
                          size="small"
                          variant="outlined"
                          component="a"
                          href={rec.archivoUrl}
                          download={rec.nombreArchivo || rec.titulo}
                          startIcon={<Download size={15} />}
                          sx={{
                            textTransform: 'none',
                            fontWeight: 600,
                            fontSize: '0.8rem',
                            borderRadius: 1.5,
                            borderColor: '#cbd5e1',
                            color: '#334155'
                          }}
                        >
                          Descargar
                        </Button>
                      </Box>

                      {esAdmin && (
                        <Tooltip title="Eliminar documento">
                          <IconButton
                            size="small"
                            onClick={() => setItemAEliminar(rec)}
                            sx={{
                              color: '#ef4444',
                              borderRadius: 1.5,
                              '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.08)' }
                            }}
                          >
                            <Trash2 size={16} />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  </Card>
                );
              })}
            </Box>
          )}
        </Box>
      )}

      {/* DIÁLOGO MODAL: SUBIR RECURSO (SOLO ADMINISTRADORES) */}
      <Dialog
        open={modalSubidaOpen}
        onClose={handleCerrarModalSubida}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3, p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 'bold', color: 'primary.main', pb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <UploadCloud size={24} color="#1a365d" />
          Subir Nuevo Recurso Institucional
        </DialogTitle>

        <form onSubmit={handleGuardarRecurso}>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
            {errorModal && (
              <Alert severity="error" sx={{ borderRadius: 2 }}>
                {errorModal}
              </Alert>
            )}

            {/* SELECCIÓN DE SECCIÓN */}
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
                <MenuItem value="grafico">Material Gráfico & Identidad Visual</MenuItem>
                <MenuItem value="reglamento">Reglamentos & Normativas Internas</MenuItem>
              </Select>
            </FormControl>

            {/* TÍTULO */}
            <TextField
              fullWidth
              size="small"
              label="Título del Recurso"
              placeholder={seccion === 'grafico' ? 'Ej: Logo Oficial Horizontal - Blanco' : 'Ej: Reglamento Interno de Trabajo 2026'}
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              required
              disabled={subiendo}
            />

            {/* CATEGORÍA */}
            <FormControl fullWidth size="small">
              <InputLabel>Categoría</InputLabel>
              <Select
                value={categoria}
                label="Categoría"
                onChange={(e) => setCategoria(e.target.value)}
                disabled={subiendo}
              >
                {(seccion === 'grafico' ? categoriasGraficas : categoriasReglamentos).map((cat) => (
                  <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* DESCRIPCIÓN */}
            <TextField
              fullWidth
              size="small"
              multiline
              rows={2}
              label="Descripción o Indicaciones de Uso (Opcional)"
              placeholder={seccion === 'grafico' ? 'Ej: Usar sobre fondos oscuros; formato con transparencia.' : 'Ej: Versión aprobada por Junta Directiva.'}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              disabled={subiendo}
            />

            {/* SELECTOR DE ARCHIVO */}
            <Box>
              <Typography variant="body2" fontWeight="600" color="text.secondary" gutterBottom>
                Archivo a Subir (se guardará en Firebase Storage):
              </Typography>
              <Button
                variant="outlined"
                component="label"
                fullWidth
                disabled={subiendo}
                startIcon={<UploadCloud size={20} />}
                sx={{
                  py: 2,
                  border: '2px dashed #cbd5e1',
                  borderRadius: 2.5,
                  textTransform: 'none',
                  bgcolor: '#f8fafc',
                  color: '#334155',
                  fontWeight: 600,
                  '&:hover': { bgcolor: '#f1f5f9', borderColor: '#94a3b8' }
                }}
              >
                {archivoSeleccionado ? archivoSeleccionado.name : 'Seleccionar archivo del equipo...'}
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

            {/* PREVISUALIZACIÓN DE IMAGEN */}
            {previewUrl && (
              <Box sx={{ textAlign: 'center', p: 1.5, bgcolor: '#f1f5f9', borderRadius: 2, border: '1px solid #e2e8f0' }}>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1, fontWeight: 'bold' }}>
                  Previsualización de imagen:
                </Typography>
                <img
                  src={previewUrl}
                  alt="Vista previa"
                  style={{ maxHeight: 120, maxWidth: '100%', objectFit: 'contain' }}
                />
              </Box>
            )}

            {/* PROGRESO DE SUBIDA */}
            {subiendo && (
              <Box sx={{ width: '100%', mt: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="caption" fontWeight="bold" color="primary.main">
                    Subiendo a Firebase Storage...
                  </Typography>
                  <Typography variant="caption" fontWeight="bold" color="primary.main">
                    {progresoSubida}%
                  </Typography>
                </Box>
                <LinearProgress variant="determinate" value={progresoSubida} sx={{ height: 8, borderRadius: 2 }} />
              </Box>
            )}
          </DialogContent>

          <DialogActions sx={{ p: 2.5, pt: 1 }}>
            <Button 
              onClick={handleCerrarModalSubida} 
              disabled={subiendo}
              sx={{ textTransform: 'none', color: '#64748b' }}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={subiendo || !archivoSeleccionado}
              sx={{
                textTransform: 'none',
                bgcolor: '#1a365d',
                fontWeight: 'bold',
                borderRadius: 2,
                px: 3,
                '&:hover': { bgcolor: '#0f233c' }
              }}
            >
              {subiendo ? 'Guardando...' : 'Subir Recurso'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* DIÁLOGO MODAL: CONFIRMACIÓN DE ELIMINACIÓN */}
      <Dialog
        open={Boolean(itemAEliminar)}
        onClose={() => !eliminando && setItemAEliminar(null)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3, p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 'bold', color: 'error.main', display: 'flex', alignItems: 'center', gap: 1 }}>
          <AlertCircle size={22} color="#dc2626" />
          Confirmar Eliminación
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            ¿Está seguro de que desea eliminar el recurso <strong>"{itemAEliminar?.titulo}"</strong>?
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
            Esta acción eliminará el archivo físico de Firebase Storage y su registro permanente en la Intranet.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button 
            onClick={() => setItemAEliminar(null)} 
            disabled={eliminando}
            sx={{ textTransform: 'none' }}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirmarEliminar}
            variant="contained"
            color="error"
            disabled={eliminando}
            sx={{ textTransform: 'none', borderRadius: 2, fontWeight: 'bold' }}
          >
            {eliminando ? 'Eliminando...' : 'Eliminar Definitivamente'}
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
}
