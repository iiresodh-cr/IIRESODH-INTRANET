import React, { useState, useEffect } from 'react';
import { db, storage } from '../../config/firebase';
import { 
  doc, 
  updateDoc, 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  serverTimestamp, 
  deleteDoc,
  onSnapshot 
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
  TextField, 
  Card, 
  CardContent, 
  CircularProgress, 
  Alert, 
  Divider, 
  List, 
  ListItem, 
  ListItemText, 
  LinearProgress, 
  Chip, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  IconButton,
  Collapse
} from '@mui/material';
import { 
  ArrowLeft, 
  Save, 
  User, 
  CreditCard, 
  StickyNote, 
  Upload, 
  File, 
  Plus, 
  Trash2,
  Eye,
  CheckCircle,
  AlertTriangle,
  Mail
} from 'lucide-react';
import { registrarLogAuditoria } from '../../utils/auditLogger';

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

// =====================================================================================
// SUB-COMPONENTE ENCAPSULADO: Maneja el estado expandible/colapsable de forma individual
// =====================================================================================
function ItemNotificacion({ item }) {
  const [expanded, setExpanded] = useState(false);

  const cfg = (() => {
    if (item.estado === 'Abierto') return { color: 'success', icon: <Eye size={14} />, label: 'Abierto' };
    if (item.estado === 'Entregado') return { color: 'info', icon: <CheckCircle size={14} />, label: 'Entregado' };
    if (item.estado === 'Rebotado') return { color: 'error', icon: <AlertTriangle size={14} />, label: 'Rebotado' };
    return { color: 'default', icon: <Mail size={14} />, label: 'Enviado' };
  })();

  return (
    <Box sx={{ mb: 2, p: 2, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
        <Typography variant="body2" fontWeight="bold" color="text.primary" sx={{ maxWidth: '70%' }}>
          {item.asunto}
        </Typography>
        <Chip size="small" color={cfg.color} label={cfg.label} sx={{ fontWeight: 'bold', fontSize: '0.7rem', height: 20 }} />
      </Box>
      
      {/* Botón interactivo para abrir/cerrar el cuerpo del mensaje por omisión */}
      <Button
        size="small"
        variant="text"
        onClick={() => setExpanded(!expanded)}
        sx={{ textTransform: 'none', fontSize: '0.72rem', p: 0, minWidth: 0, mb: 0.5, fontWeight: 'bold', color: 'primary.main' }}
      >
        {expanded ? "Ocultar contenido del mensaje" : "Ver contenido del mensaje"}
      </Button>

      {/* Contenedor colapsable animado */}
      <Collapse in={expanded}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', my: 1, whiteSpace: 'pre-wrap', bgcolor: '#ffffff', p: 1, borderRadius: 1, border: '1px solid #e2e8f0' }}>
          {item.cuerpo}
        </Typography>
      </Collapse>

      {item.pdf_url && (
        <Box sx={{ mt: 0.5 }}>
          <Button
            component="a"
            href={item.pdf_url}
            target="_blank"
            rel="noopener"
            variant="text"
            size="small"
            startIcon={<File size={12} />}
            sx={{ textTransform: 'none', fontWeight: 'bold', fontSize: '0.7rem', p: 0, justifyContent: 'flex-start' }}
          >
            Descargar Anexo: {item.pdf_nombre || 'Documento Adjunto'}
          </Button>
        </Box>
      )}

      <Divider sx={{ my: 1, borderStyle: 'dashed' }} />

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {item.entregado_at && (
          <Typography variant="caption" color="text.secondary">
            Recibido: <strong>{item.entregado_at}</strong>
          </Typography>
        )}
        {item.abierto_at && (
          <Typography variant="caption" color="success.main">
            Abierto: <strong>{item.abierto_at}</strong>
          </Typography>
        )}
        {item.rebotado_at && (
          <Typography variant="caption" color="error.main">
            Rebote: <strong>{item.rebotado_at}</strong>
            {item.causa_rebote && <span style={{ display: 'block', fontStyle: 'italic', fontSize: '0.65rem', marginTop: '2px' }}>{item.causa_rebote}</span>}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

export default function FichaCliente({ casoId, clienteId, onVolver, currentUserEmail }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [cliente, setCliente] = useState(null);
  const [nombres, setNombres] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [tipoIdentificacion, setTipoIdentificacion] = useState('Cédula de Identidad');
  const [identificacion, setIdentificacion] = useState('');
  const [pais, setPais] = useState('Costa Rica');
  const [direccion, setDireccion] = useState('');

  const [correoPrincipal, setCorreoPrincipal] = useState('');
  const [correoSecundario, setCorreoSecundario] = useState('');
  const [codigoTelefonoPrincipal, setCodigoTelefonoPrincipal] = useState('+506');
  const [telefonoPrincipal, setTelefonoPrincipal] = useState('');
  const [codigoTelefonoSecundario, setCodigoTelefonoSecundario] = useState('+506');
  const [telefonoSecundario, setTelefonoSecundario] = useState('');

  const [notes, setNotas] = useState([]);
  const [nuevaNota, setNuevaNota] = useState('');
  const [documentos, setDocumentos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Estados reactivos en tiempo real para telemetría
  const [historialComunicados, setHistorialComunicados] = useState([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);

  const clienteRef = doc(db, 'casos', casoId, 'clientes', clienteId);

  useEffect(() => {
    setLoading(true);
    setError('');

    // 1. Escuchador Live para los datos demográficos y de contacto de la Ficha
    const unsubCliente = onSnapshot(clienteRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setCliente(data); 
        setNombres(data.nombres || ''); 
        setApellidos(data.apellidos || '');
        setTipoIdentificacion(data.tipo_identificacion || 'Cédula de Identidad');
        setIdentificacion(data.identificacion || ''); 
        setPais(data.pais || 'Costa Rica'); 
        setDireccion(data.direccion || '');
        setCorreoPrincipal(data.correo_principal || data.correo || ''); 
        setCorreoSecundario(data.correo_secundario || '');
        setCodigoTelefonoPrincipal(data.codigo_telefono_principal || data.codigo_telefono || '+506');
        setTelefonoPrincipal(data.telefono_principal || data.telefono || '');
        setCodigoTelefonoSecundario(data.codigo_telefono_secundario || '+506'); 
        setTelefonoSecundario(data.telefono_secundario || '');
      } else {
        setError('No se localizó la ficha del representado solicitado.');
      }
      setLoading(false);
    }, (err) => {
      setError('Error al sincronizar el expediente con el servidor.');
      setLoading(false);
    });

    // 2. Escuchador Live para la Bitácora de Notas Jurídicas
    const qNotas = query(collection(db, 'casos', casoId, 'clientes', clienteId, 'notas'), orderBy('fecha', 'desc'));
    const unsubNotas = onSnapshot(qNotas, (snap) => {
      setNotas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // 3. Escuchador Live para la Carga Inmutable de Documentos y Poderes
    const qDocs = query(collection(db, 'casos', casoId, 'clientes', clienteId, 'documentos'), orderBy('fecha_subida', 'desc'));
    const unsubDocs = onSnapshot(qDocs, (snap) => {
      setDocumentos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // 4. Escuchador Live para la subcolección autónoma con los DATOS COMPLETOS del comunicado
    setLoadingHistorial(true);
    const historialRef = collection(db, 'casos', casoId, 'clientes', clienteId, 'historial_comunicados');
    const unsubHistorial = onSnapshot(historialRef, (snapHistorial) => {
      const listaEventos = snapHistorial.docs.map(d => ({ id: d.id, ...d.data() }));

      const parseFechaCRAMilisegundos = (str) => {
        if (!str) return 0;
        try {
          const partes = str.split(/[\s,]+/);
          const fechaPartes = partes[0].split('/');
          const horaPartes = partes[1].split(':');
          const dia = parseInt(fechaPartes[0], 10);
          const mes = parseInt(fechaPartes[1], 10) - 1;
          const anio = parseInt(fechaPartes[2], 10);
          const hora = parseInt(horaPartes[0], 10);
          const mi = parseInt(horaPartes[1], 10);
          const se = parseInt(horaPartes[2], 10);
          return new Date(anio, mes, dia, hora, mi, se).getTime();
        } catch (e) { return 0; }
      };

      // Ordenar de más nuevo a más viejo
      listaEventos.sort((a, b) => parseFechaCRAMilisegundos(b.ultima_actualizacion) - parseFechaCRAMilisegundos(a.ultima_actualizacion));
      setHistorialComunicados(listaEventos);
      setLoadingHistorial(false);
    }, (errHist) => {
      console.error("Error en sincronización de telemetría:", errHist);
      setLoadingHistorial(false);
    });

    return () => {
      unsubCliente();
      unsubNotas();
      unsubDocs();
      unsubHistorial();
    };
  }, [casoId, clienteId]);

  const handleUpdateDatos = async (e) => {
    e.preventDefault(); 
    setError(''); 
    setSuccess('');
    try {
      await updateDoc(clienteRef, {
        nombres: nombres.trim(), 
        apellidos: apellidos.trim(), 
        tipo_identificacion: tipoIdentificacion,
        identificacion: identificacion.trim(), 
        pais: pais, 
        direccion: direccion.trim(), 
        correo_principal: correoPrincipal.trim(),
        correo_secundario: correoSecundario.trim(), 
        codigo_telefono_principal: codigoTelefonoPrincipal,
        telefono_principal: telefonoPrincipal.trim(), 
        codigo_telefono_secundario: codigoTelefonoSecundario, 
        telefono_secundario: telefonoSecundario.trim()
      });

      await registrarLogAuditoria(
        currentUserEmail, 
        'Actualización de Cliente', 
        `Se editaron los datos de contacto y demográficos del representado: ${apellidos.trim()}, ${nombres.trim()}`
      );
      
      setSuccess('Expediente de contacto actualizado correctamente.');
    } catch (err) { 
      setError('No se pudieron guardar los cambios.'); 
    }
  };

  const handleAddNota = async () => {
    if (!nuevaNota.trim()) return;
    try {
      const refNotas = collection(db, 'casos', casoId, 'clientes', clienteId, 'notas');
      await addDoc(refNotas, { 
        texto: nuevaNota.trim(), 
        fecha: serverTimestamp() 
      });

      await registrarLogAuditoria(
        currentUserEmail, 
        'Adición de Nota', 
        `Se estampó una nota jurídica interna en el expediente del cliente: ${apellidos}, ${nombres}`
      );

      setNuevaNota('');
    } catch (err) { 
      setError('Error al registrar la nota.'); 
    }
  };

  const handleUploadFile = async (e) => {
    const file = e.target.files[0]; 
    if (!file) return;
    
    setUploading(true); 
    setUploadProgress(0); 
    setError('');

    const storagePath = `casos/${casoId}/clientes/${clienteId}/${Date.now()}_${file.name}`;
    const storageRef = ref(storage, storagePath);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on('state_changed', 
      (snap) => {
        const progress = (snap.bytesTransferred / snap.totalBytes) * 100;
        setUploadProgress(Math.round(progress));
      },
      (err) => { 
        setError('Error físico al subir archivo.'); 
        setUploading(false); 
      },
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        const refDocs = collection(db, 'casos', casoId, 'clientes', clienteId, 'documentos');
        await addDoc(refDocs, { 
          nombre: file.name, 
          url: downloadURL, 
          storage_path: storagePath, 
          fecha_subida: new Date().toISOString() 
        });

        await registrarLogAuditoria(
          currentUserEmail, 
          'Carga de Poder/Doc', 
          `Se cargó el archivo individual "${file.name}" en el expediente de: ${apellidos}, ${nombres}`
        );

        setUploading(false); 
        setSuccess('Archivo enlazado con éxito.');
      }
    );
  };

  const handleDeleteFile = async (docId, storagePath) => {
    if (!window.confirm('¿Desea suprimir este documento individual?')) return;
    try {
      if (storagePath) {
        await deleteObject(ref(storage, storagePath));
      }
      await deleteDoc(doc(db, 'casos', casoId, 'clientes', clienteId, 'documentos', docId));

      await registrarLogAuditoria(
        currentUserEmail, 
        'Eliminación de Poder/Doc', 
        `Se eliminó el documento ID: ${docId} perteneciente a: ${apellidos}, ${nombres}`
      );

      setSuccess('Documento removido correctamente.');
    } catch (err) { 
      setError('Error al eliminar archivo.'); 
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>
    );
  }

  return (
    <Box>
      <Button startIcon={<ArrowLeft size={16} />} onClick={onVolver} sx={{ mb: 3, textTransform: 'none' }}>
        Volver al Expediente
      </Button>
      
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '3fr 2fr' }, gap: { xs: 2, sm: 3 } }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 2, sm: 3 } }}>
          
          <Paper component="form" onSubmit={handleUpdateDatos} sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: 'none' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5, color: 'primary.main' }}>
              <User size={20} />
              <Typography variant="h6" fontWeight="bold" sx={{ fontSize: { xs: '1.05rem', sm: '1.25rem' } }}>
                Datos del Representado & Contacto
              </Typography>
            </Box>
            
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mb: 2.5 }}>
              <TextField label="Nombres" fullWidth value={nombres} onChange={(e) => setNombres(e.target.value)} required />
              <TextField label="Apellidos" fullWidth value={apellidos} onChange={(e) => setApellidos(e.target.value)} required />
            </Box>
            
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mb: 2.5 }}>
              <FormControl fullWidth>
                <InputLabel>Tipo Identificación</InputLabel>
                <Select value={tipoIdentificacion} label="Tipo Identificación" onChange={(e) => setTipoIdentificacion(e.target.value)}>
                  {DOC_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                </Select>
              </FormControl>
              <TextField label="Número de Identificación" fullWidth value={identificacion} onChange={(e) => setIdentificacion(e.target.value)} required />
            </Box>
            
            <Box sx={{ mb: 2.5 }}>
              <FormControl fullWidth>
                <InputLabel>País de Residencia</InputLabel>
                <Select 
                  value={pais} 
                  label="País de Residencia" 
                  onChange={(e) => { 
                    setPais(e.target.value); 
                    const c = COUNTRIES.find(x => x.name === e.target.value); 
                    if (c) { 
                      setCodigoTelefonoPrincipal(c.phone); 
                      setCodigoTelefonoSecundario(c.phone); 
                    } 
                  }}
                >
                  {COUNTRIES.map(c => <MenuItem key={c.code} value={c.name}>{c.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Box>
            
            <Box sx={{ mb: 2.5 }}>
              <TextField label="Dirección Física Completa" fullWidth multiline rows={2} value={direccion} onChange={(e) => setDireccion(e.target.value)} />
            </Box>
            
            <Divider sx={{ my: 2.5 }}>Direcciones de Correo</Divider>
            
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mb: 2.5 }}>
              <TextField label="Email Principal" type="email" fullWidth value={correoPrincipal} onChange={(e) => setCorreoPrincipal(e.target.value)} required />
              <TextField label="Email Secundario" type="email" fullWidth value={correoSecundario} onChange={(e) => setCorreoSecundario(e.target.value)} />
            </Box>
            
            <Divider sx={{ my: 2.5 }}>Números Telefónicos Internacionales</Divider>
            
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '140px 1fr' }, gap: 2, mb: 2.5 }}>
              <FormControl fullWidth>
                <InputLabel>Cód. Principal</InputLabel>
                <Select value={codigoTelefonoPrincipal} label="Cód. Principal" onChange={(e) => setCodigoTelefonoPrincipal(e.target.value)}>
                  {COUNTRIES.map(c => <MenuItem key={c.code} value={c.phone}>{`${c.code} (${c.phone})`}</MenuItem>)}
                </Select>
              </FormControl>
              <TextField label="Teléfono Principal" fullWidth value={telefonoPrincipal} onChange={(e) => setTelefonoPrincipal(e.target.value)} />
            </Box>
            
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '140px 1fr' }, gap: 2, mb: 3 }}>
              <FormControl fullWidth>
                <InputLabel>Cód. Secundario</InputLabel>
                <Select value={codigoTelefonoSecundario} label="Cód. Secundario" onChange={(e) => setCodigoTelefonoSecundario(e.target.value)}>
                  {COUNTRIES.map(c => <MenuItem key={c.code} value={c.phone}>{`${c.code} (${c.phone})`}</MenuItem>)}
                </Select>
              </FormControl>
              <TextField label="Teléfono Secundario" fullWidth value={telefonoSecundario} onChange={(e) => setTelefonoSecundario(e.target.value)} />
            </Box>
            
            <Button 
              type="submit" 
              variant="contained" 
              startIcon={<Save size={16} />}
              sx={{ width: { xs: '100%', sm: 'auto' }, textTransform: 'none', borderRadius: 2, fontWeight: 'bold' }}
            >
              Guardar Cambios del Expediente
            </Button>
          </Paper>

          <Paper sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: 'none' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, color: 'primary.main' }}>
              <StickyNote size={20} />
              <Typography variant="h6" fontWeight="bold">Notas del Caso e Historial Jurídico</Typography>
            </Box>
            
            <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
              <TextField label="Escribe una actualización..." fullWidth multiline rows={2} value={nuevaNota} onChange={(e) => setNuevaNota(e.target.value)} />
              <Button variant="outlined" onClick={handleAddNota} sx={{ minWidth: 48 }}>
                <Plus size={20} />
              </Button>
            </Box>
            
            <List sx={{ maxHeight: 300, overflow: 'auto' }}>
              {notes.length === 0 ? (
                <Typography variant="body2" color="text.disabled">No hay notas.</Typography>
              ) : (
                notes.map((n) => (
                  <Card key={n.id} sx={{ mb: 1.5, boxShadow: 'none', bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <CardContent sx={{ p: '12px !important' }}>
                      <Typography variant="body2">{n.texto}</Typography>
                      <Typography variant="caption" color="text.disabled" display="block">
                        {n.fecha?.toDate ? n.fecha.toDate().toLocaleString() : 'Reciente'}
                      </Typography>
                    </CardContent>
                  </Card>
                ))
              )}
            </List>
          </Paper>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 2, sm: 3 } }}>
          <Paper sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: 'none' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, color: 'primary.main' }}>
              <CreditCard size={20} />
              <Typography variant="h6" fontWeight="bold">Control de Pago</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: '#f8fafc', p: 2, borderRadius: 2 }}>
              <Typography variant="body2" fontWeight="medium">Estado en Stripe:</Typography>
              <Chip label={cliente?.estado_pago || 'Pendiente'} color={cliente?.estado_pago === 'Pagado' ? 'success' : 'warning'} sx={{ fontWeight: 'bold' }} />
            </Box>
          </Paper>

          <Paper sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: 'none' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, color: 'primary.main' }}>
              <File size={20} />
              <Typography variant="h6" fontWeight="bold">Documentos y Poderes</Typography>
            </Box>
            
            <Button variant="outlined" component="label" fullWidth startIcon={<Upload size={16} />} disabled={uploading}>
              {uploading ? 'Subiendo...' : 'Subir Poder / Documento PDF'}
              <input type="file" accept="application/pdf,image/*" hidden onChange={handleUploadFile} />
            </Button>
            
            {uploading && (
              <Box sx={{ p: 1 }}>
                <LinearProgress variant="determinate" value={uploadProgress} />
              </Box>
            )}
            
            <Divider sx={{ my: 1.5 }} />
            
            <List>
              {documentos.map((d) => (
                <ListItem key={d.id} disablePadding sx={{ mb: 1, display: 'flex', gap: 1 }}>
                  <Button 
                    component="a" 
                    href={d.url} 
                    target="_blank" 
                    variant="text" 
                    color="inherit" 
                    startIcon={<File size={16} />} 
                    sx={{ flexGrow: 1, justifyContent: 'flex-start', p: 1, bgcolor: '#f8fafc', borderRadius: 1.5 }}
                  >
                    <ListItemText primary={d.nombre} secondary={d.fecha_subida ? new Date(d.fecha_subida).toLocaleDateString() : ''} />
                  </Button>
                  <IconButton size="small" color="error" onClick={() => handleDeleteFile(d.id, d.storage_path)} sx={{ border: '1px solid #fee2e2', bgcolor: '#fef2f2' }}>
                    <Trash2 size={16} />
                  </IconButton>
                </ListItem>
              ))}
            </List>
          </Paper>

          <Paper sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: 'none' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, color: 'primary.main' }}>
              <Mail size={20} />
              <Typography variant="h6" fontWeight="bold">Historial de Notificaciones</Typography>
            </Box>
            
            {loadingHistorial ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}><CircularProgress size={24} /></Box>
            ) : historialComunicados.length === 0 ? (
              <Typography variant="body2" color="text.disabled">No se registran notificaciones para este representado.</Typography>
            ) : (
              <List sx={{ maxHeight: 380, overflow: 'auto', p: 0 }}>
                {historialComunicados.map((item) => (
                  <ItemNotificacion key={item.id} item={item} />
                ))}
              </List>
            )}
          </Paper>

        </Box>
      </Box>
    </Box>
  );
}