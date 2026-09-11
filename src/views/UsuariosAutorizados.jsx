import React, { useState, useEffect } from 'react';
import { db } from '../config/firebase';
import { collection, setDoc, getDocs, query, orderBy, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { 
  Box, Typography, Button, Paper, Table, TableBody, TableCell, 
  TableContainer, TableHead, TableRow, TextField, Dialog, 
  DialogTitle, DialogContent, DialogActions, FormControl, 
  InputLabel, Select, MenuItem, Chip, IconButton, CircularProgress,
  Checkbox, FormControlLabel, Card, CardContent, Divider, Tooltip, Alert
} from '@mui/material';
import { 
  Plus, Trash2, ShieldAlert, CheckCircle2, AlertCircle, Globe, 
  MessageCircle, Edit, ShieldCheck, Info, Check, X
} from 'lucide-react';
import { registrarLogAuditoria } from '../utils/auditLogger';

// =====================================================================================
// DEFINICIÓN CENTRALIZADA DE CAPACIDADES Y PRIVILEGIOS POR ROL INSTITUCIONAL
// =====================================================================================
export const ROLES_INFO = {
  'Superadmin': {
    titulo: 'Superadministrador',
    subtitulo: 'Control perimetral total y dirección general de sistemas',
    colorChip: 'error',
    badgeBg: '#fef2f2',
    badgeText: '#b91c1c',
    capacidades: [
      'Acceso total e irrestricto a todos los módulos y herramientas del sistema.',
      'Capacidad exclusiva de otorgar o revocar el rol de Administrador a otros usuarios.',
      'Acceso exclusivo a la Bitácora de Auditoría (Logs) y trazabilidad forense de todas las operaciones.',
      'Eliminación permanente e irreversible de casos y expedientes de litigio.',
      'Acceso directo a la Administración del Sitio Web y canal oficial de WhatsApp Business API.'
    ],
    restricciones: []
  },
  'Admin': {
    titulo: 'Administrador/a',
    subtitulo: 'Gestión ejecutiva institucional, supervisión de casos y personal',
    colorChip: 'warning',
    badgeBg: '#fffbeb',
    badgeText: '#b45309',
    capacidades: [
      'Gestión completa de Casos y Litigios (crear, configurar y eliminar litigios).',
      'Administración del Control de Usuarios Autorizados (inscribir personal y modificar roles).',
      'Habilitación o suspensión de accesos individuales a los módulos de Sitio Web y WhatsApp.',
      'Acceso pleno al Centro de Recursos Institucionales y Calendario IIRESODH.'
    ],
    restricciones: [
      'No puede crear otros Administradores (facultad reservada al Superadmin).',
      'No tiene acceso a la Bitácora de Auditoría / Logs forenses del sistema.'
    ]
  },
  'Abogado/a': {
    titulo: 'Abogado/a Litigante',
    subtitulo: 'Sustanciación y operación jurídica de litigios y representados',
    colorChip: 'primary',
    badgeBg: '#eff6ff',
    badgeText: '#1e40af',
    capacidades: [
      'Acceso operativo completo a los expedientes de Casos y Litigios asignados.',
      'Creación, edición y consulta de fichas individuales de representados/clientes.',
      'Carga y consulta de escritos judiciales, resoluciones, documentos comunes y poderes individuales.',
      'Control de plazos procesales y fechas fatales con alertas semafóricas automáticas.',
      'Redacción y emisión de comunicados masivos o selectivos por correo a los representados.',
      'Acceso al Centro de Recursos Institucionales y Calendario IIRESODH.'
    ],
    restricciones: [
      'No puede eliminar casos ni litigios completos.',
      'No puede administrar la lista de usuarios autorizados ni ver logs de auditoría.'
    ]
  },
  'Administrativo': {
    titulo: 'Personal Administrativo',
    subtitulo: 'Soporte operativo, control documental y conciliación de pagos',
    colorChip: 'info',
    badgeBg: '#f0f9ff',
    badgeText: '#0369a1',
    capacidades: [
      'Acceso a Casos y Litigios para consulta, registro de representados y control de pagos Stripe.',
      'Carga y organización de archivos y poderes en los expedientes de clientes.',
      'Acceso al Centro de Recursos Institucionales y gestión de eventos en el Calendario IIRESODH.',
      'Acceso condicional a Sitio Web y WhatsApp si un Administrador se lo autoriza expresamente.'
    ],
    restricciones: [
      'No puede eliminar litigios completos ni alterar configuraciones de usuarios.',
      'No tiene acceso a logs de auditoría del sistema.'
    ]
  }
};

export default function UsuariosAutorizados({ currentUserEmail, userRole }) {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal de Inscripción (Nuevo Usuario)
  const [openModal, setOpenModal] = useState(false);
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [rol, setRol] = useState('Abogado/a');
  const [accesoWeb, setAccesoWeb] = useState(false);
  const [accesoWhatsapp, setAccesoWhatsapp] = useState(false);

  // Modal de Edición de Usuario y Rol
  const [openEditModal, setOpenEditModal] = useState(false);
  const [usuarioAEditar, setUsuarioAEditar] = useState(null);
  const [editNombre, setEditNombre] = useState('');
  const [editRol, setEditRol] = useState('Abogado/a');
  const [editAccesoWeb, setEditAccesoWeb] = useState(false);
  const [editAccesoWhatsapp, setEditAccesoWhatsapp] = useState(false);

  // Modal Informativo de Guía de Roles y Capacidades
  const [openGuiaRoles, setOpenGuiaRoles] = useState(false);

  // Modales de Confirmación y Feedback
  const [openConfirm, setOpenConfirm] = useState(false);
  const [usuarioARevocar, setUsuarioARevocar] = useState('');
  const [feedback, setFeedback] = useState({
    open: false,
    title: '',
    message: '',
    severity: 'success' // 'success' | 'error' | 'warning'
  });

  const lanzarNotificacionModal = (title, message, severity = 'success') => {
    setFeedback({ open: true, title, message, severity });
  };

  const fetchUsuarios = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'usuarios_autorizados'), orderBy('nombre', 'asc'));
      const snapshot = await getDocs(q);
      setUsuarios(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) { 
      lanzarNotificacionModal('Error de Conexión', 'No se pudo compilar la lista blanca de usuarios.', 'error'); 
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => { 
    fetchUsuarios(); 
  }, []);

  // REGISTRO DE NUEVO USUARIO
  const handleAutorizar = async (e) => {
    e.preventDefault();
    const emailLimpio = correo.trim().toLowerCase();

    if (!nombre.trim() || !emailLimpio) return;
    
    if (rol === 'Admin' && userRole !== 'Superadmin') {
      lanzarNotificacionModal(
        'Operación Denegada', 
        'Privilegios insuficientes. Únicamente el Superadmin de la firma puede otorgar rangos de Administrador.', 
        'warning'
      );
      return;
    }

    try {
      await setDoc(doc(db, 'usuarios_autorizados', emailLimpio), {
        nombre: nombre.trim(), 
        correo: emailLimpio, 
        rol: rol, 
        acceso_web: accesoWeb,
        acceso_whatsapp: accesoWhatsapp,
        autorizado_por: currentUserEmail, 
        fecha_autorizacion: new Date().toISOString()
      });

      await registrarLogAuditoria(
        currentUserEmail, 
        'Autorización de Usuario', 
        `Se habilitó acceso perimetral al correo [${emailLimpio}] con privilegios de: ${rol} | Web: ${accesoWeb ? 'Sí' : 'No'} | WhatsApp: ${accesoWhatsapp ? 'Sí' : 'No'}`
      );

      setNombre(''); 
      setCorreo(''); 
      setRol('Abogado/a'); 
      setAccesoWeb(false);
      setAccesoWhatsapp(false);
      setOpenModal(false);
      
      lanzarNotificacionModal('Registro Exitoso', `El usuario [${emailLimpio}] ha sido pre-autorizado con rol "${rol}" correctamente.`, 'success');
      fetchUsuarios();
    } catch (err) { 
      lanzarNotificacionModal('Error en Firestore', 'El servidor rechazó la escritura de credenciales autorizadas.', 'error'); 
    }
  };

  // APERTURA DE MODAL DE EDICIÓN DE ROL Y USUARIO
  const handleOpenEdit = (u) => {
    setUsuarioAEditar(u);
    setEditNombre(u.nombre || '');
    setEditRol(u.rol || 'Abogado/a');
    setEditAccesoWeb(!!u.acceso_web);
    setEditAccesoWhatsapp(!!u.acceso_whatsapp);
    setOpenEditModal(true);
  };

  // GUARDAR MODIFICACIÓN DE ROL Y USUARIO
  const handleGuardarEdicion = async (e) => {
    e.preventDefault();
    if (!usuarioAEditar) return;

    // Validación de privilegios si se intenta ascender a Admin
    if (editRol === 'Admin' && userRole !== 'Superadmin' && usuarioAEditar.rol !== 'Admin') {
      lanzarNotificacionModal(
        'Operación Denegada',
        'Privilegios insuficientes. Únicamente el Superadmin de la firma puede promover a un usuario al rango de Administrador.',
        'warning'
      );
      return;
    }

    try {
      const emailTarget = usuarioAEditar.id;
      const rolAnterior = usuarioAEditar.rol;

      await updateDoc(doc(db, 'usuarios_autorizados', emailTarget), {
        nombre: editNombre.trim(),
        rol: editRol,
        acceso_web: editAccesoWeb,
        acceso_whatsapp: editAccesoWhatsapp
      });

      await registrarLogAuditoria(
        currentUserEmail,
        'Modificación de Usuario y Rol',
        `Se actualizó el usuario [${emailTarget}]: Rol="${editRol}" (anterior: "${rolAnterior}") | Web: ${editAccesoWeb ? 'Sí' : 'No'} | WhatsApp: ${editAccesoWhatsapp ? 'Sí' : 'No'}`
      );

      setUsuarios(prev => prev.map(u => u.id === emailTarget ? {
        ...u,
        nombre: editNombre.trim(),
        rol: editRol,
        acceso_web: editAccesoWeb,
        acceso_whatsapp: editAccesoWhatsapp
      } : u));

      setOpenEditModal(false);
      setUsuarioAEditar(null);
      lanzarNotificacionModal(
        'Modificación Guardada',
        `Los datos y el rol asignado a [${emailTarget}] se han modificado a "${editRol}" con éxito.`,
        'success'
      );
    } catch (err) {
      console.error(err);
      lanzarNotificacionModal('Error al Actualizar', 'No se pudieron registrar las modificaciones en el servidor.', 'error');
    }
  };

  const handleTogglePermiso = async (id, campo, valorActual) => {
    try {
      const nuevoValor = !valorActual;
      await updateDoc(doc(db, 'usuarios_autorizados', id), {
        [campo]: nuevoValor
      });

      const nombreModulo = campo === 'acceso_web' ? 'Sitio Web' : 'WhatsApp';
      await registrarLogAuditoria(
        currentUserEmail, 
        'Modificación de Permisos', 
        `Se ${nuevoValor ? 'habilitó' : 'deshabilitó'} el acceso a [${nombreModulo}] para el usuario: [${id}]`
      );

      setUsuarios(prev => prev.map(u => u.id === id ? { ...u, [campo]: nuevoValor } : u));
    } catch (err) { 
      console.error("Error al actualizar permiso:", err);
      lanzarNotificacionModal('Error al actualizar', 'No se pudo cambiar el estado del permiso en la base de datos.', 'error'); 
    }
  };

  const handlePreRevocar = (id) => {
    if (id === 'webmaster@iiresodh.org') return;
    setUsuarioARevocar(id);
    setOpenConfirm(true);
  };

  const ejecutarRevocacion = async () => {
    setOpenConfirm(false);
    const idTarget = usuarioARevocar;
    
    try {
      await deleteDoc(doc(db, 'usuarios_autorizados', idTarget));

      await registrarLogAuditoria(
        currentUserEmail, 
        'Revocación de Usuario', 
        `Se eliminaron e invalidaron de la lista blanca las credenciales de: [${idTarget}]`
      );

      lanzarNotificacionModal('Acceso Revocado', `Las credenciales del usuario [${idTarget}] han sido eliminadas e invalidadas del perímetro con éxito.`, 'success');
      fetchUsuarios();
    } catch (err) { 
      lanzarNotificacionModal('Error del Servidor', 'Ocurrió un error inesperado al intentar suprimir el usuario.', 'error'); 
    } finally {
      setUsuarioARevocar('');
    }
  };

  return (
    <Box>
      {/* CABECERA RESPONSIVA */}
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'stretch', sm: 'center' }, gap: 2, mb: 4 }}>
        <Box>
          <Typography variant="h4" fontWeight="bold" sx={{ fontSize: { xs: '1.4rem', sm: '2.125rem' } }}>
            Control de Usuarios Autorizados
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Administra los roles, permisos modulares y capacidades del personal institucional.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          <Button 
            variant="outlined" 
            startIcon={<ShieldCheck size={18} />} 
            onClick={() => setOpenGuiaRoles(true)} 
            sx={{ textTransform: 'none', borderRadius: 2, fontWeight: 'bold', flexGrow: { xs: 1, sm: 0 } }}
          >
            Capacidades de Roles
          </Button>
          <Button 
            variant="contained" 
            startIcon={<Plus size={18} />} 
            onClick={() => setOpenModal(true)} 
            sx={{ textTransform: 'none', borderRadius: 2, fontWeight: 'bold', flexGrow: { xs: 1, sm: 0 } }}
          >
            Autorizar Personal
          </Button>
        </Box>
      </Box>

      {/* TABLA DE USUARIOS CON DESPLAZAMIENTO HORIZONTAL EN MÓVILES */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : (
        <TableContainer component={Paper} sx={{ borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: 'none', overflowX: 'auto' }}>
          <Table sx={{ minWidth: 700 }}>
            <TableHead sx={{ bgcolor: '#f8fafc' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>Nombre Completo</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>ID Documento (Correo)</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Rol Asignado</TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold' }}>Sitio Web</TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold' }}>WhatsApp</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Autorizado Por</TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold' }}>Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {usuarios.filter(u => u.id !== 'webmaster@iiresodh.org').map((u) => {
                const infoRol = ROLES_INFO[u.rol] || ROLES_INFO['Abogado/a'];
                return (
                  <TableRow key={u.id} hover>
                    <TableCell sx={{ fontWeight: 'medium' }}>{u.nombre}</TableCell>
                    <TableCell><code>{u.id}</code></TableCell>
                    
                    {/* CHIP DE ROL INTERACTIVO CON ACCESO RÁPIDO A EDICIÓN */}
                    <TableCell>
                      <Tooltip title="Clic para modificar el rol de este usuario" arrow>
                        <Chip 
                          label={u.rol} 
                          size="small" 
                          color={infoRol.colorChip} 
                          onClick={() => handleOpenEdit(u)}
                          onDelete={() => handleOpenEdit(u)}
                          deleteIcon={<Edit size={12} />}
                          sx={{ 
                            fontWeight: 'bold', 
                            cursor: 'pointer',
                            '&:hover': { transform: 'scale(1.03)', boxShadow: '0 2px 6px rgba(0,0,0,0.1)' }
                          }} 
                        />
                      </Tooltip>
                    </TableCell>
                    
                    {/* TAG AUTORIZACIÓN SITIO WEB */}
                    <TableCell align="center">
                      <Chip 
                        icon={<Globe size={13} />}
                        label={u.acceso_web ? "Autorizado" : "Sin Acceso"} 
                        size="small" 
                        color={u.acceso_web ? "primary" : "default"} 
                        variant={u.acceso_web ? "filled" : "outlined"} 
                        onClick={() => handleTogglePermiso(u.id, 'acceso_web', !!u.acceso_web)}
                        title="Clic para cambiar autorización al Sitio Web"
                        sx={{ 
                          fontWeight: 'bold', 
                          cursor: 'pointer', 
                          fontSize: '0.75rem',
                          '&:hover': { transform: 'scale(1.02)' } 
                        }} 
                      />
                    </TableCell>

                    {/* TAG AUTORIZACIÓN WHATSAPP */}
                    <TableCell align="center">
                      <Chip 
                        icon={<MessageCircle size={13} />}
                        label={u.acceso_whatsapp ? "Autorizado" : "Sin Acceso"} 
                        size="small" 
                        color={u.acceso_whatsapp ? "success" : "default"} 
                        variant={u.acceso_whatsapp ? "filled" : "outlined"} 
                        onClick={() => handleTogglePermiso(u.id, 'acceso_whatsapp', !!u.acceso_whatsapp)}
                        title="Clic para cambiar autorización a WhatsApp"
                        sx={{ 
                          fontWeight: 'bold', 
                          cursor: 'pointer', 
                          fontSize: '0.75rem',
                          '&:hover': { transform: 'scale(1.02)' } 
                        }} 
                      />
                    </TableCell>

                    <TableCell sx={{ fontSize: '0.85rem' }}>{u.autorizado_por}</TableCell>
                    
                    {/* ACCIONES: EDITAR ROL Y REVOCAR */}
                    <TableCell align="center">
                      <Box sx={{ display: 'inline-flex', gap: 1 }}>
                        <Tooltip title="Modificar Rol y Permisos" arrow>
                          <IconButton 
                            color="primary" 
                            size="small"
                            onClick={() => handleOpenEdit(u)} 
                            sx={{ border: '1px solid #bfdbfe', bgcolor: '#eff6ff', p: 0.8 }}
                          >
                            <Edit size={16} />
                          </IconButton>
                        </Tooltip>

                        <Tooltip title="Revocar Acceso Perimetral" arrow>
                          <IconButton 
                            color="error" 
                            size="small"
                            onClick={() => handlePreRevocar(u.id)} 
                            sx={{ border: '1px solid #fee2e2', bgcolor: '#fef2f2', p: 0.8 }}
                          >
                            <Trash2 size={16} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* =====================================================================================
          MODAL 1: AUTORIZAR NUEVO USUARIO (CON ASISTENTE DE CAPACIDADES)
          ===================================================================================== */}
      <Dialog 
        open={openModal} 
        onClose={() => setOpenModal(false)} 
        fullWidth 
        maxWidth="sm" 
        slotProps={{ paper: { sx: { borderRadius: 3, m: { xs: 1.5, sm: 3 } } } }}
      >
        <DialogTitle fontWeight="bold">Autorizar Nuevo Usuario</DialogTitle>
        <Box component="form" onSubmit={handleAutorizar}>
          <DialogContent dividers>
            <TextField label="Nombre del Funcionario" required fullWidth value={nombre} onChange={(e) => setNombre(e.target.value)} sx={{ mb: 2.5 }} />
            <TextField label="Correo Electrónico Institucional" type="email" required fullWidth value={correo} onChange={(e) => setCorreo(e.target.value)} sx={{ mb: 2.5 }} />
            
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Rol y Privilegios</InputLabel>
              <Select value={rol} label="Rol y Privilegios" onChange={(e) => setRol(e.target.value)}>
                {userRole === 'Superadmin' && <MenuItem value="Admin">Administrador/a</MenuItem>}
                <MenuItem value="Abogado/a">Abogado/a</MenuItem>
                <MenuItem value="Administrativo">Administrativo</MenuItem>
              </Select>
            </FormControl>

            {/* TARJETA DINÁMICA: DETALLE EN TIEMPO REAL DE LAS CAPACIDADES DEL ROL */}
            {ROLES_INFO[rol] && (
              <Box sx={{ p: 2, mb: 2.5, bgcolor: '#f0f9ff', borderRadius: 2, border: '1px solid #bae6fd' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
                  <Info size={16} color="#0284c7" />
                  <Typography variant="subtitle2" fontWeight="bold" color="#0369a1">
                    Capacidades de: {ROLES_INFO[rol].titulo}
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  {ROLES_INFO[rol].subtitulo}
                </Typography>
                <Box component="ul" sx={{ m: 0, pl: 2, '& li': { fontSize: '0.78rem', color: '#0f172a', mb: 0.5 } }}>
                  {ROLES_INFO[rol].capacidades.map((cap, i) => (
                    <li key={i}>{cap}</li>
                  ))}
                </Box>
              </Box>
            )}

            {/* SECCIÓN DE MÓDULOS PERMITIDOS */}
            <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0' }}>
              <Typography variant="caption" fontWeight="bold" color="text.secondary" sx={{ display: 'block', mb: 1, textTransform: 'uppercase' }}>
                Módulos Habilitados Opcionales
              </Typography>
              <FormControlLabel
                control={
                  <Checkbox 
                    size="small"
                    checked={accesoWeb} 
                    onChange={(e) => setAccesoWeb(e.target.checked)} 
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <Globe size={15} color="#1a365d" />
                    <Typography variant="body2" fontWeight="medium">
                      Administrar Sitio Web (iiresodh.org)
                    </Typography>
                  </Box>
                }
                sx={{ display: 'flex', mb: 1, m: 0 }}
              />
              <FormControlLabel
                control={
                  <Checkbox 
                    size="small"
                    checked={accesoWhatsapp} 
                    onChange={(e) => setAccesoWhatsapp(e.target.checked)} 
                    color="success"
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <MessageCircle size={15} color="#25D366" />
                    <Typography variant="body2" fontWeight="medium">
                      Acceso a WhatsApp Business API
                    </Typography>
                  </Box>
                }
                sx={{ display: 'flex', m: 0 }}
              />
            </Box>
          </DialogContent>
          <DialogActions sx={{ p: 2.5 }}>
            <Button onClick={() => setOpenModal(false)} color="inherit" sx={{ textTransform: 'none' }}>Cancelar</Button>
            <Button type="submit" variant="contained" sx={{ textTransform: 'none', fontWeight: 'bold' }}>Otorgar Acceso</Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* =====================================================================================
          MODAL 2: MODIFICAR ROL Y DATOS DEL USUARIO
          ===================================================================================== */}
      <Dialog 
        open={openEditModal} 
        onClose={() => setOpenEditModal(false)} 
        fullWidth 
        maxWidth="sm" 
        slotProps={{ paper: { sx: { borderRadius: 3, m: { xs: 1.5, sm: 3 } } } }}
      >
        <DialogTitle fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Edit size={20} color="#1a365d" /> Modificar Rol y Permisos de Usuario
        </DialogTitle>
        <Box component="form" onSubmit={handleGuardarEdicion}>
          <DialogContent dividers>
            <TextField 
              label="Correo Electrónico (Identificador)" 
              fullWidth 
              disabled 
              value={usuarioAEditar?.id || ''} 
              sx={{ mb: 2.5 }} 
              helperText="El identificador de correo institucional no puede ser alterado."
            />
            <TextField 
              label="Nombre del Funcionario" 
              required 
              fullWidth 
              value={editNombre} 
              onChange={(e) => setEditNombre(e.target.value)} 
              sx={{ mb: 2.5 }} 
            />
            
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Rol Asignado en la Intranet</InputLabel>
              <Select 
                value={editRol} 
                label="Rol Asignado en la Intranet" 
                onChange={(e) => setEditRol(e.target.value)}
              >
                {(userRole === 'Superadmin' || usuarioAEditar?.rol === 'Admin') && (
                  <MenuItem value="Admin">Administrador/a</MenuItem>
                )}
                <MenuItem value="Abogado/a">Abogado/a</MenuItem>
                <MenuItem value="Administrativo">Administrativo</MenuItem>
              </Select>
            </FormControl>

            {/* TARJETA DINÁMICA DE CAPACIDADES DEL ROL SELECCIONADO EN EDICIÓN */}
            {ROLES_INFO[editRol] && (
              <Box sx={{ p: 2, mb: 2.5, bgcolor: '#f0f9ff', borderRadius: 2, border: '1px solid #bae6fd' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Info size={16} color="#0284c7" />
                    <Typography variant="subtitle2" fontWeight="bold" color="#0369a1">
                      Capacidades con: {ROLES_INFO[editRol].titulo}
                    </Typography>
                  </Box>
                  <Chip label={editRol} size="small" color={ROLES_INFO[editRol].colorChip} sx={{ fontWeight: 'bold', height: 20 }} />
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  {ROLES_INFO[editRol].subtitulo}
                </Typography>
                <Box component="ul" sx={{ m: 0, pl: 2, '& li': { fontSize: '0.78rem', color: '#0f172a', mb: 0.5 } }}>
                  {ROLES_INFO[editRol].capacidades.map((cap, i) => (
                    <li key={i}>{cap}</li>
                  ))}
                </Box>
              </Box>
            )}

            {/* SECCIÓN DE MÓDULOS PERMITIDOS */}
            <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0' }}>
              <Typography variant="caption" fontWeight="bold" color="text.secondary" sx={{ display: 'block', mb: 1, textTransform: 'uppercase' }}>
                Permisos Modulares Opcionales
              </Typography>
              <FormControlLabel
                control={
                  <Checkbox 
                    size="small"
                    checked={editAccesoWeb} 
                    onChange={(e) => setEditAccesoWeb(e.target.checked)} 
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <Globe size={15} color="#1a365d" />
                    <Typography variant="body2" fontWeight="medium">
                      Administrar Sitio Web (iiresodh.org)
                    </Typography>
                  </Box>
                }
                sx={{ display: 'flex', mb: 1, m: 0 }}
              />
              <FormControlLabel
                control={
                  <Checkbox 
                    size="small"
                    checked={editAccesoWhatsapp} 
                    onChange={(e) => setEditAccesoWhatsapp(e.target.checked)} 
                    color="success"
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <MessageCircle size={15} color="#25D366" />
                    <Typography variant="body2" fontWeight="medium">
                      Acceso a WhatsApp Business API
                    </Typography>
                  </Box>
                }
                sx={{ display: 'flex', m: 0 }}
              />
            </Box>
          </DialogContent>
          <DialogActions sx={{ p: 2.5 }}>
            <Button onClick={() => setOpenEditModal(false)} color="inherit" sx={{ textTransform: 'none' }}>Cancelar</Button>
            <Button type="submit" variant="contained" sx={{ textTransform: 'none', fontWeight: 'bold' }}>
              Guardar Modificaciones
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* =====================================================================================
          MODAL 3: MATRIZ INSTITUCIONAL DE ROLES Y CAPACIDADES
          ===================================================================================== */}
      <Dialog 
        open={openGuiaRoles} 
        onClose={() => setOpenGuiaRoles(false)} 
        fullWidth 
        maxWidth="md" 
        slotProps={{ paper: { sx: { borderRadius: 3, m: { xs: 1.5, sm: 3 } } } }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <ShieldCheck size={26} color="#1a365d" />
            <Box>
              <Typography variant="h6" fontWeight="bold" color="primary.main">
                Matriz de Roles y Capacidades del Sistema
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Especificación técnica de permisos, alcance operativo y restricciones de seguridad de la Intranet IIRESODH.
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={() => setOpenGuiaRoles(false)} size="small">
            <X size={18} />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ p: { xs: 2, sm: 3 } }}>
          <Alert severity="warning" icon={<ShieldAlert size={22} />} sx={{ mb: 3, borderRadius: 2 }}>
            <Typography variant="subtitle2" fontWeight="bold" sx={{ color: '#92400e' }}>
              Política Perimetral de Acceso Cerrado (Lista Blanca Obligatoria)
            </Typography>
            <Typography variant="body2" sx={{ display: 'block', mt: 0.5, fontSize: '0.82rem', color: '#78350f', lineHeight: 1.5 }}>
              La Intranet de IIRESODH no admite invitados sin previa autorización. Cualquier funcionario con correo <strong>@iiresodh.org</strong> debe ser expresamente autorizado y dado de alta en este panel con uno de los 3 roles operativos (<strong>Administrador/a</strong>, <strong>Abogado/a</strong> o <strong>Administrativo</strong>). Las cuentas institucionales que no estén activas en esta lista no podrán iniciar sesión bajo ninguna circunstancia.
            </Typography>
          </Alert>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            {Object.entries(ROLES_INFO).map(([claveRol, dataRol]) => (
              <Card 
                key={claveRol} 
                variant="outlined" 
                sx={{ 
                  borderRadius: 2.5, 
                  borderColor: '#e2e8f0',
                  boxShadow: 'none',
                  bgcolor: '#ffffff'
                }}
              >
                <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1, flexWrap: 'wrap', gap: 1 }}>
                    <Box>
                      <Typography variant="subtitle1" fontWeight="bold" color="text.primary">
                        {dataRol.titulo}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {dataRol.subtitulo}
                      </Typography>
                    </Box>
                    <Chip 
                      label={claveRol} 
                      size="small" 
                      color={dataRol.colorChip} 
                      sx={{ fontWeight: 'bold' }} 
                    />
                  </Box>

                  <Divider sx={{ my: 1.5 }} />

                  <Typography variant="caption" fontWeight="bold" color="text.secondary" sx={{ display: 'block', mb: 1, textTransform: 'uppercase' }}>
                    Capacidades & Alcances Operativos:
                  </Typography>
                  <Box component="ul" sx={{ m: 0, pl: 0, listStyle: 'none' }}>
                    {dataRol.capacidades.map((cap, idx) => (
                      <Box component="li" key={idx} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 0.75 }}>
                        <CheckCircle2 size={16} color="#16a34a" style={{ flexShrink: 0, marginTop: '2px' }} />
                        <Typography variant="body2" color="text.primary" sx={{ fontSize: '0.85rem' }}>
                          {cap}
                        </Typography>
                      </Box>
                    ))}
                  </Box>

                  {dataRol.restricciones && dataRol.restricciones.length > 0 && (
                    <>
                      <Typography variant="caption" fontWeight="bold" color="error.main" sx={{ display: 'block', mt: 1.5, mb: 1, textTransform: 'uppercase' }}>
                        Restricciones de Seguridad:
                      </Typography>
                      <Box component="ul" sx={{ m: 0, pl: 0, listStyle: 'none' }}>
                        {dataRol.restricciones.map((res, idx) => (
                          <Box component="li" key={idx} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 0.5 }}>
                            <AlertCircle size={15} color="#dc2626" style={{ flexShrink: 0, marginTop: '2px' }} />
                            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.82rem' }}>
                              {res}
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                    </>
                  )}
                </CardContent>
              </Card>
            ))}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setOpenGuiaRoles(false)} variant="contained" sx={{ textTransform: 'none', fontWeight: 'bold' }}>
            Entendido
          </Button>
        </DialogActions>
      </Dialog>

      {/* =====================================================================================
          MODAL 4: CONFIRMACIÓN DE REVOCACIÓN (REEMPLAZO CONTROLADO DE WINDOW.CONFIRM)
          ===================================================================================== */}
      <Dialog open={openConfirm} onClose={() => setOpenConfirm(false)} fullWidth maxWidth="xs" slotProps={{ paper: { sx: { borderRadius: 3, m: { xs: 1.5, sm: 3 } } } }}>
        <DialogTitle fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'error.main' }}>
          <ShieldAlert size={22} /> Revocar Acceso Perimetral
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.primary" sx={{ mt: 1 }}>
            ¿Está seguro de que desea retirar y desautorizar de forma permanente la cuenta institucional <strong>{usuarioARevocar}</strong> de la lista blanca del sistema?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setOpenConfirm(false)} color="inherit" sx={{ textTransform: 'none' }}>Cancelar</Button>
          <Button onClick={ejecutarRevocacion} variant="contained" color="error" sx={{ textTransform: 'none', fontWeight: 'bold' }}>
            Revocar Acceso
          </Button>
        </DialogActions>
      </Dialog>

      {/* =====================================================================================
          MODAL 5: NOTIFICACIÓN DE FEEDBACK DE OPERACIONES
          ===================================================================================== */}
      <Dialog open={feedback.open} onClose={() => setFeedback({ ...feedback, open: false })} fullWidth maxWidth="xs" slotProps={{ paper: { sx: { borderRadius: 3, m: { xs: 1.5, sm: 3 } } } }}>
        <DialogTitle fontWeight="bold" sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1.25, 
          color: feedback.severity === 'success' ? 'success.main' : feedback.severity === 'error' ? 'error.main' : 'warning.main' 
        }}>
          {feedback.severity === 'success' && <CheckCircle2 size={22} />}
          {feedback.severity === 'error' && <AlertCircle size={22} />}
          {feedback.severity === 'warning' && <ShieldAlert size={22} />}
          {feedback.title}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {feedback.message}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setFeedback({ ...feedback, open: false })} variant="outlined" color="inherit" sx={{ textTransform: 'none', fontWeight: 'bold', minWidth: 80 }}>
            Entendido
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}