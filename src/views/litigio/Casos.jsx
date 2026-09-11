import React, { useState, useEffect } from 'react';
import { db } from '../../config/firebase';
import { 
  collection, addDoc, getDocs, query, orderBy, 
  serverTimestamp, getCountFromServer, doc, updateDoc, deleteDoc 
} from 'firebase/firestore';
import { 
  Box, Typography, Button, Card, CardContent, CardActions, 
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, 
  CircularProgress, Alert, Divider, IconButton, Chip, FormControl, 
  InputLabel, Select, MenuItem
} from '@mui/material';
import { Plus, Gavel, Calendar, Users, Edit, Trash2, AlertTriangle } from 'lucide-react';
import { registrarLogAuditoria } from '../../utils/auditLogger';

const ESTADOS_CASO = ['Activo', 'Suspendido', 'Cerrado', 'Archivado'];

export default function Casos({ onSelectCaso, userRole, currentUserEmail }) {
  const [casos, setCasos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [openModal, setOpenModal] = useState(false);
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');

  const [openEditModal, setOpenEditModal] = useState(false);
  const [casoAEditarId, setCasoAEditarId] = useState(null);
  const [editNombre, setEditNombre] = useState('');
  const [editDescripcion, setEditDescripcion] = useState('');
  const [editEstado, setEditEstado] = useState('Activo');

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

  const handleCreateCaso = async (e) => {
    e.preventDefault();
    if (!nombre.trim()) return;

    try {
      const docRef = await addDoc(collection(db, 'casos'), {
        nombre: nombre.trim(),
        descripcion: descripcion.trim(),
        fecha_creacion: serverTimestamp(),
        estado: 'Activo',
        plazos: []
      });
      
      // REGISTRO AUDITORÍA ENTERPRISE
      await registrarLogAuditoria(currentUserEmail, 'Creación de Caso', `Se creó el litigio: "${nombre.trim()}" con ID asignado: ${docRef.id}`);

      setNombre('');
      setDescripcion('');
      setOpenModal(false);
      fetchCasos();
    } catch (err) {
      setError('No se pudo crear el caso. Revisa las reglas de Firestore.');
    }
  };

  const handleOpenEdit = (caso) => {
    setCasoAEditarId(caso.id);
    setEditNombre(caso.nombre);
    setEditDescripcion(caso.descripcion || '');
    setEditEstado(caso.estado);
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
        estado: editEstado
      });

      // REGISTRO AUDITORÍA ENTERPRISE
      await registrarLogAuditoria(currentUserEmail, 'Modificación de Caso', `Se configuró el litigio ID: ${casoAEditarId}. Nombre: "${editNombre.trim()}", Estado: [${editEstado}]`);

      setOpenEditModal(false);
      setCasoAEditarId(null);
      fetchCasos();
    } catch (err) {
      setError('No se pudieron actualizar los datos del litigio.');
    }
  };

  const handleDeleteCaso = async (id, nombreCaso) => {
    if (userRole !== 'Superadmin' && userRole !== 'Admin') {
      alert('Operación restringida. No posee los privilegios requeridos.');
      return;
    }
    if (!window.confirm(`¿CRÍTICO? ¿Está completamente seguro de eliminar el caso "${nombreCaso}"? Esta acción borrará de manera irreversible el litigio y todas las configuraciones asociadas.`)) return;

    try {
      await deleteDoc(doc(db, 'casos', id));
      
      // REGISTRO AUDITORÍA ENTERPRISE
      await registrarLogAuditoria(currentUserEmail, 'Eliminación de Caso', `CRÍTICO: Se eliminó irreversiblemente el caso completo: "${nombreCaso}" (ID: ${id})`);

      fetchCasos();
    } catch (err) {
      setError('Error de permisos en Firestore al intentar eliminar el litigio.');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Activo': return 'success';
      case 'Suspendido': return 'warning';
      case 'Cerrado': return 'error';
      case 'Archivado': return 'default';
      default: return 'primary';
    }
  };

  const calcularSemaforoDePlazos = (plazos = []) => {
    const plazosActivos = plazos.filter(p => !p.completado);
    if (plazosActivos.length === 0) return null;

    const fechasEnMilisegundos = plazosActivos.map(p => new Date(p.fechaFatal + 'T00:00:00').getTime());
    const fechaMasProximaMs = Math.min(...fechasEnMilisegundos);
    
    const hoy = new Date();
    hoy.setHours(0,0,0,0);
    
    const fechaFatal = new Date(fechaMasProximaMs);
    fechaFatal.setHours(0,0,0,0);

    const diferenciaTiempo = fechaFatal.getTime() - hoy.getTime();
    const diasRestantes = Math.ceil(diferenciaTiempo / (1000 * 60 * 60 * 24));

    if (diasRestantes < 0) {
      return { label: `Vencido (${Math.abs(diasRestantes)} d)`, color: 'error', bcolor: '#fef2f2', textColor: '#b91c1c' };
    } else if (diasRestantes <= 2) {
      return { label: `URGENTE (${diasRestantes} d)`, color: 'error', bcolor: '#fef2f2', textColor: '#b91c1c' };
    } else if (diasRestantes <= 5) {
      return { label: `Advertencia (${diasRestantes} d)`, color: 'warning', bcolor: '#fffbeb', textColor: '#b45309' };
    } else {
      return { label: `${diasRestantes} días libres`, color: 'success', bcolor: '#f0fdf4', textColor: '#15803d' };
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'stretch', sm: 'center' }, gap: 2, mb: 4 }}>
        <Box>
          <Typography variant="h4" fontWeight="bold" color="text.primary" sx={{ fontSize: { xs: '1.4rem', sm: '2.125rem' } }}>Casos y Litigios</Typography>
          <Typography variant="body2" color="text.secondary">Selecciona un caso para gestionar sus clientes, documentos y pagos.</Typography>
        </Box>
        <Button 
          variant="contained" 
          startIcon={<Plus size={18} />} 
          onClick={() => setOpenModal(true)}
          sx={{ textTransform: 'none', fontWeight: 'bold', borderRadius: 2, width: { xs: '100%', sm: 'auto' } }}
        >
          Nuevo Caso
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {casos.length === 0 ? (
        <Alert severity="info" sx={{ borderRadius: 2 }}>No hay casos registrados aún. Crea el primero para comenzar.</Alert>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, gap: 3 }}>
          {casos.map((caso) => {
            const semaforo = calcularSemaforoDePlazos(caso.plazos);
            return (
              <Card key={caso.id} sx={{ height: '100%', display: 'flex', flexDirection: 'column', borderRadius: 3, boxShadow: '0px 4px 12px rgba(0,0,0,0.03)', border: '1px solid #e2e8f0' }}>
                <CardContent sx={{ flexGrow: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, color: 'primary.main' }}>
                    <Gavel size={24} />
                    <Typography variant="h6" fontWeight="bold" component="div" noWrap>{caso.nombre}</Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ minHeight: 40, mb: 2 }}>{caso.descripcion || 'Sin descripción disponible.'}</Typography>
                  <Divider sx={{ my: 1.5 }} />
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary', fontSize: '0.85rem', mb: 1.5 }}>
                    <Users size={14} />
                    <Typography variant="caption" sx={{ fontSize: '0.85rem' }}>Representados: <strong>{caso.totalClientes}</strong></Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: '0.85rem' }}>
                    <Calendar size={14} color="#94a3b8" />
                    <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>Estado del proceso:</Typography>
                    <Chip label={caso.estado} size="small" color={getStatusColor(caso.estado)} sx={{ fontWeight: 'bold', height: 20, fontSize: '0.75rem' }} />
                  </Box>
                  {semaforo && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.5, fontSize: '0.85rem' }}>
                      <AlertTriangle size={14} color={semaforo.textColor} />
                      <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>Vencimiento:</Typography>
                      <Chip label={semaforo.label} size="small" sx={{ fontWeight: 'bold', height: 20, fontSize: '0.75rem', bgcolor: semaforo.bcolor, color: semaforo.textColor }} />
                    </Box>
                  )}
                </CardContent>
                <CardActions sx={{ p: 2, pt: 0, gap: 1 }}>
                  <Button 
                    variant="outlined" 
                    size="small" 
                    onClick={() => onSelectCaso(caso)}
                    sx={{ flexGrow: 1, textTransform: 'none', fontWeight: 'bold', borderRadius: 1.5 }}
                  >
                    Expediente del Caso
                  </Button>
                  <IconButton size="small" color="primary" onClick={() => handleOpenEdit(caso)} title="Configurar Litigio" sx={{ border: '1px solid #e2e8f0', borderRadius: 1.5, p: 0.75 }}>
                    <Edit size={16} />
                  </IconButton>
                  {(userRole === 'Superadmin' || userRole === 'Admin') && (
                    <IconButton size="small" color="error" onClick={() => handleDeleteCaso(caso.id, caso.nombre)} title="Eliminar Caso Completo" sx={{ border: '1px solid #fee2e2', bgcolor: '#fef2f2', borderRadius: 1.5, p: 0.75 }}>
                      <Trash2 size={16} />
                    </IconButton>
                  )}
                </CardActions>
              </Card>
            );
          })}
        </Box>
      )}

      {/* MODAL CREAR */}
      <Dialog open={openModal} onClose={() => setOpenModal(false)} fullWidth maxWidth="xs" slotProps={{ paper: { sx: { borderRadius: 3, m: { xs: 1.5, sm: 3 } } } }}>
        <DialogTitle fontWeight="bold">Crear Nuevo Litigio</DialogTitle>
        <Box component="form" onSubmit={handleCreateCaso}>
          <DialogContent dividers>
            <TextField autoFocus margin="dense" label="Nombre del Caso / Litigio" type="text" fullWidth variant="outlined" required value={nombre} onChange={(e) => setNombre(e.target.value)} sx={{ mb: 2 }} />
            <TextField margin="dense" label="Descripción o Notas Iniciales" type="text" fullWidth multiline rows={3} variant="outlined" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
          </DialogContent>
          <DialogActions sx={{ p: 2.5 }}>
            <Button onClick={() => setOpenModal(false)} color="inherit" sx={{ textTransform: 'none' }}>Cancelar</Button>
            <Button type="submit" variant="contained" sx={{ textTransform: 'none', fontWeight: 'bold' }}>Crear Caso</Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* MODAL EDICIÓN */}
      <Dialog open={openEditModal} onClose={() => setOpenEditModal(false)} fullWidth maxWidth="xs" slotProps={{ paper: { sx: { borderRadius: 3, m: { xs: 1.5, sm: 3 } } } }}>
        <DialogTitle fontWeight="bold">Configuración del Litigio</DialogTitle>
        <Box component="form" onSubmit={handleUpdateCaso}>
          <DialogContent dividers>
            <TextField margin="dense" label="Nombre del Caso" type="text" fullWidth variant="outlined" required value={editNombre} onChange={(e) => setEditNombre(e.target.value)} sx={{ mb: 2.5 }} />
            <TextField margin="dense" label="Descripción" type="text" fullWidth multiline rows={3} variant="outlined" value={editDescripcion} onChange={(e) => setEditDescripcion(e.target.value)} sx={{ mb: 2.5 }} />
            <FormControl fullWidth>
              <InputLabel id="select-estado-caso-label">Estado Actual del Caso</InputLabel>
              <Select labelId="select-estado-caso-label" value={editEstado} label="Estado Actual del Caso" onChange={(e) => setEditEstado(e.target.value)}>
                {ESTADOS_CASO.map((status) => <MenuItem key={status} value={status}>{status}</MenuItem>)}
              </Select>
            </FormControl>
          </DialogContent>
          <DialogActions sx={{ p: 2.5 }}>
            <Button onClick={() => setOpenEditModal(false)} color="inherit" sx={{ textTransform: 'none' }}>Cancelar</Button>
            <Button type="submit" variant="contained" sx={{ textTransform: 'none', fontWeight: 'bold' }}>Guardar Cambios</Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
}