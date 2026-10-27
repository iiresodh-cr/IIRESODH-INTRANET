// src/components/workspace/GoogleDriveSelectorBrowser.jsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  TextField,
  Paper,
  Chip,
  Tooltip,
  CircularProgress,
  InputAdornment,
  Breadcrumbs,
  Link
} from '@mui/material';
import {
  Folder,
  FolderOpen,
  FileText,
  FileSpreadsheet,
  Presentation,
  File,
  Search,
  RefreshCw,
  Check,
  ChevronRight,
  HardDrive,
  Users,
  Clock,
  Building2,
  X
} from 'lucide-react';
import {
  obtenerTokenGoogleDriveActivo,
  solicitarTokenGoogleDrive,
  limpiarTokenGoogleDrive
} from '../../context/AuthContext';

export function detectarTipoPorMimeType(mimeType = '', url = '') {
  const m = (mimeType || '').toLowerCase();
  if (m === 'application/vnd.google-apps.folder') return 'carpeta';
  if (m === 'application/vnd.google-apps.document' || m.includes('wordprocessing')) return 'doc';
  if (m === 'application/vnd.google-apps.spreadsheet' || m.includes('spreadsheet') || m.includes('excel')) return 'sheet';
  if (m === 'application/vnd.google-apps.presentation' || m.includes('presentation') || m.includes('powerpoint')) return 'slide';
  const lowerUrl = (url || '').toLowerCase();
  if (lowerUrl.includes('/folders/')) return 'carpeta';
  if (lowerUrl.includes('docs.google.com/document')) return 'doc';
  if (lowerUrl.includes('docs.google.com/spreadsheets')) return 'sheet';
  if (lowerUrl.includes('docs.google.com/presentation')) return 'slide';
  return 'pdf';
}

export function construirUrlDrive(item) {
  if (item?.webViewLink) return item.webViewLink;
  if (item?.mimeType === 'application/vnd.google-apps.folder') {
    return `https://drive.google.com/drive/folders/${item.id}`;
  }
  return `https://drive.google.com/file/d/${item.id}/view`;
}

export default function GoogleDriveSelectorBrowser({
  userEmail = '',
  tipoFiltroInicial = 'todos', // 'todos' | 'carpeta' | 'archivo'
  itemSeleccionadoUrl = '',
  onSelectItem
}) {
  const [token, setToken] = useState(() => obtenerTokenGoogleDriveActivo());
  const [conectando, setConectando] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Pestaña activa: 'mi_unidad' | 'compartidos' | 'unidades_compartidas' | 'recientes'
  const [origen, setOrigen] = useState('mi_unidad');

  // Filtro por tipo: 'todos' | 'carpeta' | 'archivo'
  const [filtroTipo, setFiltroTipo] = useState(
    tipoFiltroInicial === 'carpeta' ? 'carpeta' : 'todos'
  );

  // Pila de navegación de carpetas: [{ id: 'root', name: 'Mi Unidad', isSharedDrive: false }]
  const [rutaCarpetas, setRutaCarpetas] = useState([{ id: 'root', name: 'Mi Unidad' }]);

  // Búsqueda por nombre en vivo
  const [busqueda, setBusqueda] = useState('');
  const [busquedaDebounced, setBusquedaDebounced] = useState('');

  // Lista de elementos de Drive o Unidades compartidas
  const [archivos, setArchivos] = useState([]);
  const [unidadesCompartidas, setUnidadesCompartidas] = useState([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setBusquedaDebounced(busqueda.trim());
    }, 280);
    return () => clearTimeout(timer);
  }, [busqueda]);

  const handleConectarDrive = async () => {
    setConectando(true);
    setErrorMsg('');
    try {
      const nuevoToken = await solicitarTokenGoogleDrive(userEmail);
      if (nuevoToken) {
        setToken(nuevoToken);
      } else {
        setErrorMsg('No se recibió autorización de Google Drive. Intenta nuevamente.');
      }
    } catch (err) {
      console.error('Error autorizando Google Drive:', err);
      setErrorMsg('Se canceló la ventana de autorización de Google Drive.');
    } finally {
      setConectando(false);
    }
  };

  const carpetaActual = rutaCarpetas[rutaCarpetas.length - 1] || { id: 'root', name: 'Mi Unidad' };

  const cargarArchivosDrive = useCallback(async () => {
    if (!token) return;
    setCargando(true);
    setErrorMsg('');

    try {
      // Si el usuario está en la raíz de "Unidades compartidas" y no está buscando por texto
      if (origen === 'unidades_compartidas' && rutaCarpetas.length === 1 && !busquedaDebounced) {
        const resDrives = await fetch('https://www.googleapis.com/drive/v3/drives?pageSize=50', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (resDrives.status === 401) {
          limpiarTokenGoogleDrive();
          setToken(null);
          setErrorMsg('Tu sesión de lectura de Google Drive expiró. Haz clic en Conectar para renovarla.');
          setCargando(false);
          return;
        }
        const dataDrives = await resDrives.json();
        setUnidadesCompartidas(dataDrives.drives || []);
        setArchivos([]);
        setCargando(false);
        return;
      }

      setUnidadesCompartidas([]);

      const qParts = ['trashed = false'];

      if (busquedaDebounced) {
        const safeQ = busquedaDebounced.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        qParts.push(`name contains '${safeQ}'`);
      } else {
        if (origen === 'mi_unidad' || rutaCarpetas.length > 1) {
          qParts.push(`'${carpetaActual.id}' in parents`);
        } else if (origen === 'compartidos') {
          qParts.push('sharedWithMe = true');
        }
      }

      if (filtroTipo === 'carpeta') {
        // Siempre permitir ver carpetas
        qParts.push("mimeType = 'application/vnd.google-apps.folder'");
      } else if (filtroTipo === 'archivo' && busquedaDebounced) {
        qParts.push("mimeType != 'application/vnd.google-apps.folder'");
      }

      const qString = qParts.join(' and ');
      const orderBy =
        origen === 'recientes' && !busquedaDebounced
          ? 'modifiedTime desc'
          : 'folder,modifiedTime desc';

      const params = new URLSearchParams({
        q: qString,
        pageSize: '60',
        orderBy,
        supportsAllDrives: 'true',
        includeItemsFromAllDrives: 'true',
        fields:
          'files(id,name,mimeType,webViewLink,iconLink,modifiedTime,shared,owners(displayName,emailAddress))'
      });

      const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.status === 401) {
        limpiarTokenGoogleDrive();
        setToken(null);
        setErrorMsg('Tu sesión de Google Drive expiró. Haz clic en Conectar para continuar.');
        setCargando(false);
        return;
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error?.message || 'Error consultando Google Drive API');
      }

      const data = await res.json();
      setArchivos(data.files || []);
    } catch (err) {
      console.error('Error listando archivos de Drive:', err);
      setErrorMsg(
        'No se pudieron cargar los archivos de Google Drive. Verifica tu conexión o vuelve a autorizar.'
      );
    } finally {
      setCargando(false);
    }
  }, [token, origen, rutaCarpetas, carpetaActual.id, busquedaDebounced, filtroTipo]);

  useEffect(() => {
    if (token) {
      cargarArchivosDrive();
    }
  }, [token, cargarArchivosDrive]);

  const handleCambiarOrigen = (nuevoOrigen) => {
    setOrigen(nuevoOrigen);
    setBusqueda('');
    if (nuevoOrigen === 'mi_unidad') {
      setRutaCarpetas([{ id: 'root', name: 'Mi Unidad' }]);
    } else if (nuevoOrigen === 'compartidos') {
      setRutaCarpetas([{ id: 'shared', name: 'Compartidos conmigo' }]);
    } else if (nuevoOrigen === 'unidades_compartidas') {
      setRutaCarpetas([{ id: 'drives', name: 'Unidades compartidas' }]);
    } else {
      setRutaCarpetas([{ id: 'recent', name: 'Recientes' }]);
    }
  };

  const handleEntrarCarpeta = (folderItem) => {
    setBusqueda('');
    setRutaCarpetas((prev) => [
      ...prev,
      {
        id: folderItem.id,
        name: folderItem.name,
        webViewLink: construirUrlDrive({
          ...folderItem,
          mimeType: 'application/vnd.google-apps.folder'
        })
      }
    ]);
  };

  const handleIrABreadcrumb = (index) => {
    setRutaCarpetas((prev) => prev.slice(0, index + 1));
  };

  const handleSeleccionarElemento = (item) => {
    const url = construirUrlDrive(item);
    const tipo = detectarTipoPorMimeType(item.mimeType, url);
    if (onSelectItem) {
      onSelectItem({
        id: item.id,
        titulo: item.name,
        url,
        tipo,
        mimeType: item.mimeType
      });
    }
  };

  const renderIconoMime = (mimeType = '') => {
    const tipo = detectarTipoPorMimeType(mimeType);
    if (tipo === 'carpeta') return <Folder size={17} color="#b45309" fill="#fef3c7" />;
    if (tipo === 'doc') return <FileText size={17} color="#1d4ed8" />;
    if (tipo === 'sheet') return <FileSpreadsheet size={17} color="#047857" />;
    if (tipo === 'slide') return <Presentation size={17} color="#c2410c" />;
    return <File size={17} color="#be123c" />;
  };

  if (!token) {
    return (
      <Paper
        elevation={0}
        sx={{
          p: 2,
          borderRadius: '0 8px 8px 0',
          border: '1px solid #dbe3ec',
          borderLeft: '4px solid #1D3557',
          bgcolor: '#F8FAF8',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 1.5
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0, flex: 1 }}>
          <Box
            sx={{
              width: 38,
              height: 38,
              borderRadius: 2,
              bgcolor: 'rgba(29, 53, 87, 0.08)',
              color: '#1D3557',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <FolderOpen size={20} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle2" fontWeight="800" color="#1D3557">
              Seleccionar directamente desde tu Google Drive
            </Typography>
            <Typography variant="caption" color="#475569" sx={{ display: 'block' }}>
              Explora tus carpetas, unidades compartidas y documentos sin copiar ni pegar enlaces.
            </Typography>
            {errorMsg && (
              <Typography variant="caption" color="error" fontWeight="700" sx={{ display: 'block', mt: 0.4 }}>
                {errorMsg}
              </Typography>
            )}
          </Box>
        </Box>

        <Button
          variant="contained"
          size="small"
          disabled={conectando}
          onClick={handleConectarDrive}
          startIcon={conectando ? <CircularProgress size={14} color="inherit" /> : <HardDrive size={15} />}
          sx={{
            bgcolor: '#1D3557',
            textTransform: 'none',
            fontWeight: 700,
            borderRadius: 1.5,
            px: 2,
            py: 0.75,
            '&:hover': { bgcolor: '#152742' }
          }}
        >
          {conectando ? 'Conectando...' : 'Explorar mi Google Drive'}
        </Button>
      </Paper>
    );
  }

  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: '0 8px 8px 0',
        border: '1px solid #cbd5e1',
        borderLeft: '4px solid #1D3557',
        bgcolor: '#ffffff',
        overflow: 'hidden'
      }}
    >
      {/* CABECERA DEL EXPLORADOR DIRECTO DE GOOGLE DRIVE */}
      <Box
        sx={{
          px: 1.75,
          py: 1.1,
          bgcolor: '#F8FAF8',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          flexWrap: 'wrap'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <HardDrive size={16} color="#1D3557" />
          <Typography variant="caption" fontWeight="800" color="#1D3557" sx={{ letterSpacing: '0.02em' }}>
            EXPLORADOR DIRECTO DE GOOGLE DRIVE
          </Typography>
          <Chip
            label="Conectado"
            size="small"
            sx={{
              height: 18,
              fontSize: '0.65rem',
              fontWeight: 700,
              bgcolor: '#dcfce7',
              color: '#166534'
            }}
          />
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {[
            { id: 'todos', label: 'Todos' },
            { id: 'carpeta', label: 'Solo Carpetas' },
            { id: 'archivo', label: 'Archivos' }
          ].map((f) => (
            <Chip
              key={f.id}
              label={f.label}
              size="small"
              onClick={() => setFiltroTipo(f.id)}
              sx={{
                height: 22,
                fontSize: '0.68rem',
                fontWeight: 700,
                cursor: 'pointer',
                bgcolor: filtroTipo === f.id ? '#1D3557' : '#e2e8f0',
                color: filtroTipo === f.id ? '#ffffff' : '#334155',
                '&:hover': {
                  bgcolor: filtroTipo === f.id ? '#152742' : '#cbd5e1'
                }
              }}
            />
          ))}
          <Tooltip title="Actualizar lista de Google Drive">
            <IconButton size="small" onClick={cargarArchivosDrive} sx={{ p: 0.4 }}>
              <RefreshCw size={14} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* PESTAÑAS DE ORIGEN + BUSCADOR EN VIVO */}
      <Box
        sx={{
          px: 1.5,
          py: 1,
          borderBottom: '1px solid #f1f5f9',
          display: 'flex',
          flexDirection: 'column',
          gap: 1
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
          {[
            { id: 'mi_unidad', label: 'Mi Unidad', icon: Folder },
            { id: 'compartidos', label: 'Compartidos conmigo', icon: Users },
            { id: 'unidades_compartidas', label: 'Unidades compartidas', icon: Building2 },
            { id: 'recientes', label: 'Recientes', icon: Clock }
          ].map((tab) => {
            const IconComp = tab.icon;
            const activo = origen === tab.id;
            return (
              <Button
                key={tab.id}
                size="small"
                startIcon={<IconComp size={13} />}
                onClick={() => handleCambiarOrigen(tab.id)}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.72rem',
                  fontWeight: activo ? 800 : 600,
                  py: 0.35,
                  px: 1.1,
                  borderRadius: 1.5,
                  bgcolor: activo ? 'rgba(29, 53, 87, 0.1)' : 'transparent',
                  color: activo ? '#1D3557' : '#64748b',
                  '&:hover': { bgcolor: 'rgba(29, 53, 87, 0.08)' }
                }}
              >
                {tab.label}
              </Button>
            );
          })}
        </Box>

        <TextField
          size="small"
          fullWidth
          placeholder="Buscar carpeta o archivo en tu Google Drive por nombre..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search size={15} color="#64748b" />
              </InputAdornment>
            ),
            endAdornment: busqueda ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setBusqueda('')} sx={{ p: 0.25 }}>
                  <X size={14} />
                </IconButton>
              </InputAdornment>
            ) : null,
            sx: { fontSize: '0.8rem', borderRadius: 1.5, bgcolor: '#f8fafc' }
          }}
        />
      </Box>

      {/* BARRA DE RUTA (BREADCRUMBS) + BOTÓN PARA SELECCIONAR LA CARPETA ABIERTA ACTUAL */}
      {!busquedaDebounced && (
        <Box
          sx={{
            px: 1.75,
            py: 0.75,
            bgcolor: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
            flexWrap: 'wrap'
          }}
        >
          <Breadcrumbs
            separator={<ChevronRight size={13} color="#94a3b8" />}
            sx={{ '& .MuiBreadcrumbs-ol': { flexWrap: 'wrap' } }}
          >
            {rutaCarpetas.map((nodo, idx) => {
              const esUltimo = idx === rutaCarpetas.length - 1;
              return (
                <Link
                  key={`${nodo.id}_${idx}`}
                  component="button"
                  underline="hover"
                  onClick={() => handleIrABreadcrumb(idx)}
                  sx={{
                    fontSize: '0.74rem',
                    fontWeight: esUltimo ? 800 : 600,
                    color: esUltimo ? '#1D3557' : '#64748b',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.4
                  }}
                >
                  {idx === 0 ? <FolderOpen size={13} /> : null}
                  {nodo.name}
                </Link>
              );
            })}
          </Breadcrumbs>

          {/* Si el usuario entró dentro de una carpeta específica, permitirle elegir esa carpeta directamente */}
          {rutaCarpetas.length > 1 && carpetaActual.id !== 'root' && (
            <Button
              size="small"
              variant="contained"
              startIcon={<Check size={13} />}
              onClick={() =>
                handleSeleccionarElemento({
                  id: carpetaActual.id,
                  name: carpetaActual.name,
                  mimeType: 'application/vnd.google-apps.folder',
                  webViewLink: `https://drive.google.com/drive/folders/${carpetaActual.id}`
                })
              }
              sx={{
                bgcolor: '#b45309',
                color: '#ffffff',
                textTransform: 'none',
                fontSize: '0.7rem',
                fontWeight: 700,
                py: 0.25,
                px: 1.1,
                borderRadius: 1.25,
                '&:hover': { bgcolor: '#92400e' }
              }}
            >
              Elegir esta carpeta ({carpetaActual.name})
            </Button>
          )}
        </Box>
      )}

      {/* LISTA DE CARPETAS Y ARCHIVOS */}
      <Box
        sx={{
          maxHeight: 230,
          minHeight: 150,
          overflowY: 'auto',
          divideY: '1px solid #f1f5f9'
        }}
      >
        {cargando ? (
          <Box sx={{ py: 5, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={24} sx={{ color: '#1D3557' }} />
            <Typography variant="caption" color="#64748b" fontWeight="600">
              Consultando tu Google Drive...
            </Typography>
          </Box>
        ) : errorMsg ? (
          <Box sx={{ p: 2.5, textAlign: 'center' }}>
            <Typography variant="caption" color="error" sx={{ display: 'block', mb: 1, fontWeight: 600 }}>
              {errorMsg}
            </Typography>
            <Button
              size="small"
              variant="outlined"
              onClick={handleConectarDrive}
              sx={{ textTransform: 'none', fontSize: '0.75rem' }}
            >
              Volver a autorizar Google Drive
            </Button>
          </Box>
        ) : unidadesCompartidas.length > 0 ? (
          unidadesCompartidas.map((drive) => (
            <Box
              key={drive.id}
              onClick={() => handleEntrarCarpeta({ id: drive.id, name: drive.name })}
              sx={{
                px: 1.75,
                py: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1,
                borderBottom: '1px solid #f1f5f9',
                cursor: 'pointer',
                '&:hover': { bgcolor: '#f8fafc' }
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
                <Building2 size={17} color="#1D3557" />
                <Typography variant="body2" fontWeight="700" color="#1e293b" noWrap sx={{ fontSize: '0.82rem' }}>
                  {drive.name}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSeleccionarElemento({
                      id: drive.id,
                      name: drive.name,
                      mimeType: 'application/vnd.google-apps.folder',
                      webViewLink: `https://drive.google.com/drive/folders/${drive.id}`
                    });
                  }}
                  sx={{
                    textTransform: 'none',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    py: 0.2,
                    px: 1,
                    borderRadius: 1.25,
                    borderColor: '#cbd5e1',
                    color: '#1D3557'
                  }}
                >
                  Elegir unidad
                </Button>
                <Button
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEntrarCarpeta({ id: drive.id, name: drive.name });
                  }}
                  sx={{ textTransform: 'none', fontSize: '0.7rem', fontWeight: 700, color: '#457B9D' }}
                >
                  Abrir →
                </Button>
              </Box>
            </Box>
          ))
        ) : archivos.length === 0 ? (
          <Box sx={{ py: 4.5, px: 2, textAlign: 'center' }}>
            <Typography variant="body2" color="#64748b" fontWeight="600" sx={{ fontSize: '0.82rem' }}>
              No se encontraron carpetas ni archivos en esta ubicación.
            </Typography>
            <Typography variant="caption" color="#94a3b8">
              Prueba buscando por nombre arriba o cambia de pestaña (Compartidos conmigo / Recientes).
            </Typography>
          </Box>
        ) : (
          archivos.map((item) => {
            const esCarpeta = item.mimeType === 'application/vnd.google-apps.folder';
            const urlItem = construirUrlDrive(item);
            const seleccionado = itemSeleccionadoUrl && itemSeleccionadoUrl === urlItem;

            return (
              <Box
                key={item.id}
                onClick={() => {
                  if (esCarpeta) {
                    handleEntrarCarpeta(item);
                  } else {
                    handleSeleccionarElemento(item);
                  }
                }}
                sx={{
                  px: 1.75,
                  py: 0.9,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 1,
                  borderBottom: '1px solid #f1f5f9',
                  cursor: 'pointer',
                  bgcolor: seleccionado ? 'rgba(29, 53, 87, 0.08)' : 'transparent',
                  '&:hover': {
                    bgcolor: seleccionado ? 'rgba(29, 53, 87, 0.12)' : '#f8fafc'
                  }
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, minWidth: 0, flex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                    {renderIconoMime(item.mimeType)}
                  </Box>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography
                      variant="body2"
                      fontWeight={seleccionado || esCarpeta ? 700 : 600}
                      color="#1e293b"
                      noWrap
                      sx={{ fontSize: '0.81rem' }}
                    >
                      {item.name}
                    </Typography>
                    <Typography variant="caption" color="#94a3b8" sx={{ fontSize: '0.68rem', display: 'block' }} noWrap>
                      {esCarpeta ? 'Carpeta de Google Drive' : 'Documento de Google Drive'}
                      {item.owners?.[0]?.displayName ? ` • ${item.owners[0].displayName}` : ''}
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, flexShrink: 0 }}>
                  {esCarpeta && (
                    <Tooltip title="Ver el contenido dentro de esta carpeta">
                      <Button
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEntrarCarpeta(item);
                        }}
                        sx={{
                          textTransform: 'none',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          py: 0.2,
                          px: 0.9,
                          minWidth: 'auto',
                          color: '#457B9D'
                        }}
                      >
                        Abrir
                      </Button>
                    </Tooltip>
                  )}

                  <Button
                    size="small"
                    variant={seleccionado ? 'contained' : 'outlined'}
                    startIcon={seleccionado ? <Check size={12} /> : null}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSeleccionarElemento(item);
                    }}
                    sx={{
                      textTransform: 'none',
                      fontSize: '0.71rem',
                      fontWeight: 700,
                      py: 0.25,
                      px: 1.1,
                      borderRadius: 1.25,
                      ...(seleccionado
                        ? {
                            bgcolor: '#1D3557',
                            color: '#ffffff',
                            '&:hover': { bgcolor: '#152742' }
                          }
                        : {
                            borderColor: esCarpeta ? '#f59e0b' : '#cbd5e1',
                            color: esCarpeta ? '#b45309' : '#1D3557',
                            bgcolor: esCarpeta ? '#fffbeb' : '#ffffff',
                            '&:hover': {
                              bgcolor: esCarpeta ? '#fef3c7' : '#f1f5f9'
                            }
                          })
                    }}
                  >
                    {seleccionado
                      ? 'Seleccionado'
                      : esCarpeta
                      ? 'Elegir carpeta'
                      : 'Elegir'}
                  </Button>
                </Box>
              </Box>
            );
          })
        )}
      </Box>
    </Paper>
  );
}
