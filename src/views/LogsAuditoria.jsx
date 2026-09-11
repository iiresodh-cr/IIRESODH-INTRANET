import React, { useState, useEffect } from 'react';
import { db } from '../config/firebase';
import { 
  collection, 
  getDocs, 
  query, 
  orderBy, 
  deleteDoc, 
  doc 
} from 'firebase/firestore';
import { 
  Box, 
  Typography, 
  Paper, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  IconButton, 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  Button, 
  CircularProgress, 
  Alert, 
  Divider,
  Chip 
} from '@mui/material';
import { 
  Trash2, 
  ShieldAlert, 
  AlertTriangle 
} from 'lucide-react';

export default function LogsAuditoria({ currentUserEmail, userRole }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Estados para el Modal de Advertencia de Eliminación Puntual
  const [openWarningModal, setOpenWarningModal] = useState(false);
  const [logAEliminar, setLogAEliminar] = useState(null);

  const fetchLogs = async () => {
    if (userRole !== 'Superadmin') {
      return;
    }
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, 'logs_auditoria'));
      const rawLogs = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data()
      }));

      // Ordenar cronológicamente descendente soportando tanto 'fecha' como 'timestamp'
      rawLogs.sort((a, b) => {
        const timeA = (a.fecha?.toMillis ? a.fecha.toMillis() : (a.timestamp?.toMillis ? a.timestamp.toMillis() : 0));
        const timeB = (b.fecha?.toMillis ? b.fecha.toMillis() : (b.timestamp?.toMillis ? b.timestamp.toMillis() : 0));
        return timeB - timeA;
      });

      setLogs(rawLogs);
    } catch (err) {
      console.error(err);
      setError('Error de lectura al consultar los registros de auditoría institucional.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [userRole]);

  // REGLA DE PRIVILEGIOS: Bloqueo inmediato en interfaz si no es el Superadministrador raíz
  if (userRole !== 'Superadmin') {
    return (
      <Box sx={{ mt: 4 }}>
        <Alert severity="error" icon={<ShieldAlert size={22} />} sx={{ borderRadius: 3, p: 2 }}>
          <Typography variant="subtitle1" fontWeight="bold">
            Acceso Restringido - Seguridad de la Firma
          </Typography>
          <Typography variant="body2">
            El módulo de Logs de Auditoría Inmutable contiene metadatos de operaciones críticas y registros de personal. 
            Su cuenta actual de <strong>{currentUserEmail}</strong> no posee autorizaciones de Superadministrador global.
          </Typography>
        </Alert>
      </Box>
    );
  }

  const handleOpenWarning = (logItem) => {
    setLogAEliminar(logItem);
    setOpenWarningModal(true);
  };

  const handleConfirmarEliminacionPuntual = async () => {
    if (!logAEliminar) {
      return;
    }
    setError('');
    setSuccess('');
    try {
      await deleteDoc(doc(db, 'logs_auditoria', logAEliminar.id));
      
      setOpenWarningModal(false);
      setLogAEliminar(null);
      setSuccess('Registro de auditoría suprimido puntualmente de forma exitosa.');
      
      fetchLogs();
    } catch (err) {
      console.error(err);
      setError('Error en las reglas de Firestore al intentar forzar la destrucción del log.');
    }
  };

  const getAccionChipProps = (accion = '') => {
    const act = (accion || '').toLowerCase();
    if (act.includes('denegado') || act.includes('revocación') || act.includes('eliminación') || act.includes('suprim')) {
      return {
        bgcolor: '#fef2f2',
        color: '#b91c1c',
        borderColor: '#fca5a5'
      };
    }
    if (act.includes('inicio de sesión') || act.includes('autorización') || act.includes('creación') || act.includes('resolución')) {
      return {
        bgcolor: '#f0fdf4',
        color: '#15803d',
        borderColor: '#86efac'
      };
    }
    if (act.includes('modificación') || act.includes('actualización') || act.includes('cierre de sesión')) {
      return {
        bgcolor: '#fefce8',
        color: '#a16207',
        borderColor: '#fde047'
      };
    }
    return {
      bgcolor: '#eff6ff',
      color: '#1d4ed8',
      borderColor: '#93c5fd'
    };
  };

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight="bold" color="text.primary">
          Logs de Auditoría Enterprise
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Historial transaccional inmutable de operaciones ejecutadas por el staff legal y administrativo.
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 3 }}>{success}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : logs.length === 0 ? (
        <Alert severity="info" sx={{ borderRadius: 2 }}>
          No se registran transacciones de usuarios en el historial todavía.
        </Alert>
      ) : (
        <TableContainer component={Paper} sx={{ borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: 'none' }}>
          <Table>
            <TableHead sx={{ bgcolor: '#1a365d' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold', color: 'white' }}>Timestamp Servidor</TableCell>
                <TableCell sx={{ fontWeight: 'bold', color: 'white' }}>Usuario / Operador</TableCell>
                <TableCell sx={{ fontWeight: 'bold', color: 'white' }}>Acción Ejecutada</TableCell>
                <TableCell sx={{ fontWeight: 'bold', color: 'white' }}>Metadatos / Detalles</TableCell>
                <TableCell sx={{ fontWeight: 'bold', color: 'white' }}>Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {logs.map((logItem) => (
                <TableRow key={logItem.id} hover>
                  <TableCell sx={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'text.secondary', whiteSpace: 'nowrap' }}>
                    {logItem.fecha?.toDate 
                      ? logItem.fecha.toDate().toLocaleString() 
                      : (logItem.timestamp?.toDate ? logItem.timestamp.toDate().toLocaleString() : 'Reciente')}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600, color: '#1e293b' }}>
                    {logItem.usuario || logItem.usuarioEmail || 'Sistema'}
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={logItem.accion} 
                      size="small" 
                      variant="outlined" 
                      sx={{ 
                        fontWeight: 'bold', 
                        fontSize: '0.78rem',
                        ...getAccionChipProps(logItem.accion)
                      }} 
                    />
                  </TableCell>
                  <TableCell sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>
                    {logItem.detalles || logItem.titulo || 'Sin metadatos adicionales'}
                  </TableCell>
                  <TableCell>
                    <IconButton size="small" color="error" title="Eliminar Registro Puntual" onClick={() => handleOpenWarning(logItem)}>
                      <Trash2 size={16} />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* MODAL DE ADVERTENCIA CRÍTICA PARA EL SUPERADMINISTRADOR */}
      <Dialog 
        open={openWarningModal} 
        onClose={() => { setOpenWarningModal(false); setLogAEliminar(null); }} 
        fullWidth 
        maxWidth="xs"
        slotProps={{ paper: { sx: { borderRadius: 3, border: '2px solid #ef4444' } } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: '#fef2f2', color: '#b91c1c', fontWeight: 'bold' }}>
          <AlertTriangle size={22} />
          Advertencia de Modificación de Logs
        </DialogTitle>
        <DialogContent dividers sx={{ mt: 1 }}>
          <Typography variant="body2" color="text.primary" gutterBottom>
            Está a punto de eliminar un registro puntual del historial inmutable de auditoría corporativa.
          </Typography>
          <Box sx={{ bgcolor: '#f8fafc', p: 1.5, borderRadius: 2, my: 2, border: '1px solid #e2e8f0' }}>
            <Typography variant="caption" display="block" color="text.secondary">
              <strong>Acción:</strong> {logAEliminar?.accion}
            </Typography>
            <Typography variant="caption" display="block" color="text.secondary">
              <strong>Operador:</strong> {logAEliminar?.usuario}
            </Typography>
          </Box>
          <Typography variant="caption" color="error.main" fontWeight="bold">
            AVISO: La alteración destructiva de los registros de auditoría puede dificultar el rastreo de incidencias de seguridad de la firma.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, bgcolor: '#f8fafc' }}>
          <Button 
            onClick={() => { setOpenWarningModal(false); setLogAEliminar(null); }} 
            color="inherit" 
            sx={{ textTransform: 'none' }}
          >
            Cancelar Operación
          </Button>
          <Button 
            onClick={handleConfirmarEliminacionPuntual} 
            variant="contained" 
            color="error" 
            sx={{ textTransform: 'none', fontWeight: 'bold' }}
          >
            Confirmar Destrucción
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}