import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Box, Drawer, AppBar, Toolbar, List, Typography, 
  ListItem, ListItemButton, ListItemIcon, ListItemText, 
  IconButton, Divider, Button, useTheme, useMediaQuery,
  Tooltip, Chip
} from '@mui/material';
import { 
  Briefcase, ShieldAlert, LogOut, UserCheck, Home, 
  Globe, MessageCircle, FolderArchive, Menu, X 
} from 'lucide-react';
import { ref as rtdbRef, update as rtdbUpdate, serverTimestamp as rtdbServerTimestamp } from 'firebase/database';
import { rtdb } from '../config/firebase';
import { registrarLogAuditoria } from '../utils/auditLogger';

const drawerWidth = 264;

export default function Layout({ children, currentView, setView, userRole, userPermisos }) {
  const { user, logout } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);

  const esHub = currentView === 'hub';
  const menuItems = [];

  if (!esHub) {
    menuItems.push({ text: 'Inicio / Hub Central', icon: <Home size={19} />, id: 'hub' });
  }

  // 1. Centro de Recursos Institucionales
  menuItems.push({ text: 'Recursos Institucionales', icon: <FolderArchive size={19} />, id: 'recursos_institucionales' });

  // 2. Acceso al Módulo Sitio Web en la barra lateral
  if (userRole === 'Superadmin' || userPermisos?.web === true) {
    menuItems.push({ text: 'Sitio Web', icon: <Globe size={19} />, id: 'sitio_web' });
  }

  // 3. Acceso al Módulo WhatsApp en la barra lateral
  if (userRole === 'Superadmin' || userPermisos?.whatsapp === true) {
    menuItems.push({ text: 'WhatsApp', icon: <MessageCircle size={19} />, id: 'whatsapp' });
  }

  // 4. Módulo de Casos (Gestión de Litigios)
  menuItems.push({ text: 'Casos y Litigios', icon: <Briefcase size={19} />, id: 'casos' });

  if (userRole === 'Superadmin' || userRole === 'Admin') {
    menuItems.push({ text: 'Control de Usuarios', icon: <UserCheck size={19} />, id: 'usuarios' });
  }

  if (userRole === 'Superadmin') {
    menuItems.push({ text: 'Logs de Auditoría', icon: <ShieldAlert size={19} />, id: 'logs' });
  }

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleSelectView = (viewId) => {
    setView(viewId);
    if (isMobile) {
      setMobileOpen(false);
    }
  };

  const drawerContent = (
    <Box sx={{ overflow: 'auto', mt: { xs: 1, md: 2 }, display: 'flex', flexDirection: 'column', height: '100%' }}>
      {isMobile && (
        <Box sx={{ px: 2.5, py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9' }}>
          <Typography variant="subtitle2" fontWeight="800" color="#0f172a" sx={{ letterSpacing: '0.06em', fontSize: '0.72rem' }}>
            NAVEGACIÓN IIRESODH
          </Typography>
          <IconButton size="small" onClick={handleDrawerToggle} sx={{ color: '#475569' }}>
            <X size={18} />
          </IconButton>
        </Box>
      )}
      <Box sx={{ px: 2.5, pt: 1, pb: 0.75, display: { xs: 'none', md: 'block' } }}>
        <Typography sx={{ fontSize: '0.64rem', fontWeight: 800, color: '#94a3b8', letterSpacing: '0.09em', textTransform: 'uppercase' }}>
          Módulos del Sistema
        </Typography>
      </Box>
      <List sx={{ px: 1.5, flex: 1 }}>
        {menuItems.map((item, index) => {
          const isSelected = currentView === item.id;
          return (
            <React.Fragment key={item.id}>
              {!esHub && index === 1 && <Divider sx={{ my: 1.25, borderColor: '#f1f5f9' }} />}
              
              <ListItem disablePadding sx={{ mb: 0.5 }}>
                <ListItemButton 
                  onClick={() => handleSelectView(item.id)}
                  selected={isSelected}
                  sx={{
                    borderRadius: '0 8px 8px 0',
                    py: 1,
                    px: 1.5,
                    position: 'relative',
                    color: isSelected ? '#0f172a' : '#475569',
                    bgcolor: isSelected ? '#f8fafc' : 'transparent',
                    borderLeft: isSelected ? '3px solid #b91c1c' : '3px solid transparent',
                    transition: 'all 0.15s ease',
                    '&.Mui-selected': {
                      bgcolor: '#f1f5f9',
                      color: '#0f172a',
                      fontWeight: 800,
                      '&:hover': { bgcolor: '#e2e8f0' }
                    },
                    '&:hover': {
                      bgcolor: '#f8fafc',
                      color: '#0f172a'
                    }
                  }}
                >
                  <ListItemIcon sx={{ color: isSelected ? '#0f172a' : '#64748b', minWidth: 32 }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText 
                    primary={item.text} 
                    primaryTypographyProps={{ 
                      fontSize: '0.84rem', 
                      fontWeight: isSelected ? 800 : 600,
                      letterSpacing: '-0.01em'
                    }} 
                  />
                </ListItemButton>
              </ListItem>
            </React.Fragment>
          );
        })}
      </List>

      {/* Pie institucional de la barra lateral con barra lateral de radio cero */}
      <Box
        sx={{
          p: 1.75,
          m: 1.5,
          borderRadius: '0 8px 8px 0',
          bgcolor: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderLeft: '3px solid #0f172a'
        }}
      >
        <Typography sx={{ fontSize: '0.68rem', fontWeight: 800, color: '#0f172a', letterSpacing: '0.06em' }}>
          IIRESODH · INTRANET
        </Typography>
        <Typography sx={{ fontSize: '0.68rem', color: '#64748b', mt: 0.25, fontWeight: 500 }}>
          Red Cifrada Institucional
        </Typography>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      {/* BARRA SUPERIOR EJECUTIVA IIRESODH */}
      <AppBar 
        position="fixed" 
        elevation={0}
        sx={{ 
          zIndex: (theme) => theme.zIndex.drawer + 1, 
          bgcolor: '#0f172a', 
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 1px 3px rgba(15, 23, 42, 0.14)'
        }}
      >
        <Toolbar sx={{ justifyContent: 'space-between', px: { xs: 1.5, sm: 3 }, minHeight: { xs: 56, sm: 60 } }}>
          
          {/* SECCIÓN IZQUIERDA: Menú móvil + Identidad Oficial IIRESODH */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 1.75 } }}>
            {!esHub && isMobile && (
              <IconButton
                color="inherit"
                aria-label="abrir menú"
                edge="start"
                onClick={handleDrawerToggle}
                sx={{ mr: 0.5, color: '#ffffff' }}
              >
                <Menu size={20} />
              </IconButton>
            )}

            <Box
              onClick={() => setView('hub')}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                cursor: 'pointer',
                py: 0.5,
                '&:hover': { opacity: 0.92 }
              }}
            >
              {/* Isotipo blanco oficial */}
              <img 
                src="/Isotipo-w.png" 
                alt="Isotipo IIRESODH" 
                style={{ 
                  width: '32px', 
                  height: '32px',
                  objectFit: 'contain',
                  display: 'block'
                }} 
              />
              
              {/* Tipografía Institucional IIRESODH */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography
                      sx={{
                        fontFamily: '"Plus Jakarta Sans", sans-serif',
                        fontWeight: 800,
                        fontSize: { xs: '0.98rem', sm: '1.08rem' },
                        letterSpacing: '0.07em',
                        color: '#ffffff',
                        lineHeight: 1.05
                      }}
                    >
                      IIRESODH
                    </Typography>
                    <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: '#ef4444', display: { xs: 'none', sm: 'block' } }} />
                  </Box>
                  <Typography
                    sx={{
                      display: { xs: 'none', sm: 'block' },
                      fontSize: '0.62rem',
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      color: '#94a3b8',
                      textTransform: 'uppercase',
                      mt: 0.15
                    }}
                  >
                    Intranet Institucional
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Box>
          
          {/* SECCIÓN DERECHA: Rol, Email y botón de cierre de sesión */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 1.5 } }}>
            {userRole && (
              <Chip
                label={userRole}
                size="small"
                sx={{
                  display: { xs: 'none', md: 'inline-flex' },
                  bgcolor: 'rgba(255, 255, 255, 0.07)',
                  color: '#f8fafc',
                  border: '1px solid rgba(255, 255, 255, 0.14)',
                  fontWeight: 700,
                  fontSize: '0.68rem',
                  height: 23,
                  borderRadius: '6px',
                  letterSpacing: '0.02em'
                }}
              />
            )}

            <Tooltip title={user?.email || ''}>
              <Typography 
                variant="body2" 
                color="#cbd5e1" 
                noWrap
                sx={{ 
                  fontSize: { xs: '0.74rem', sm: '0.8rem' }, 
                  fontWeight: 600,
                  maxWidth: { xs: 120, sm: 220 }
                }}
              >
                {user?.email}
              </Typography>
            </Tooltip>
            
            <Divider orientation="vertical" flexItem sx={{ bgcolor: 'rgba(255,255,255,0.12)', height: 18, my: 'auto' }} />
            
            <Button
              onClick={async () => {
                if (user?.email) {
                  try {
                    const userKey = user.email.toLowerCase().replace(/[.#$[\]/]/g, '_');
                    await rtdbUpdate(rtdbRef(rtdb, `presencia/${userKey}`), {
                      enLinea: false,
                      ultimaConexionMs: rtdbServerTimestamp()
                    });
                    await registrarLogAuditoria(
                      user.email,
                      'Cierre de Sesión',
                      'El usuario cerró sesión voluntariamente en la Intranet.'
                    );
                  } catch (e) {
                    console.error('Error registrando log de salida:', e);
                  }
                }
                logout();
              }}
              startIcon={<LogOut size={14} />}
              sx={{
                color: '#ffffff',
                textTransform: 'none',
                fontSize: { xs: '0.75rem', sm: '0.78rem' },
                fontWeight: 700,
                px: { xs: 1.2, sm: 1.5 },
                py: 0.45,
                borderRadius: '7px',
                bgcolor: 'rgba(185, 28, 28, 0.85)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                minWidth: 'auto',
                '&:hover': {
                  bgcolor: '#b91c1c',
                  borderColor: '#ef4444'
                }
              }}
            >
              Salir
            </Button>
          </Box>
        </Toolbar>
      </AppBar>

      {/* BARRA LATERAL (SIDEBAR): Adaptativa según pantalla */}
      {!esHub && (
        <>
          {isMobile ? (
            <Drawer
              variant="temporary"
              open={mobileOpen}
              onClose={handleDrawerToggle}
              ModalProps={{ keepMounted: true }}
              sx={{
                display: { xs: 'block', md: 'none' },
                '& .MuiDrawer-paper': { 
                  boxSizing: 'border-box', 
                  width: drawerWidth,
                  bgcolor: '#ffffff'
                }
              }}
            >
              <Toolbar sx={{ minHeight: { xs: 56, sm: 60 } }} />
              {drawerContent}
            </Drawer>
          ) : (
            <Drawer
              variant="permanent"
              sx={{
                display: { xs: 'none', md: 'block' },
                width: drawerWidth,
                flexShrink: 0,
                '& .MuiDrawer-paper': { 
                  width: drawerWidth, 
                  boxSizing: 'border-box', 
                  borderRight: '1px solid #e2e8f0', 
                  bgcolor: '#ffffff' 
                },
              }}
            >
              <Toolbar sx={{ minHeight: { xs: 56, sm: 60 } }} />
              {drawerContent}
            </Drawer>
          )}
        </>
      )}

      {/* CONTENIDO DE LA INTRANET */}
      <Box 
        component="main" 
        sx={{ 
          flexGrow: 1, 
          p: { xs: 1.5, sm: 2.5, md: 3 }, 
          bgcolor: '#f8fafc', 
          minHeight: '100vh',
          width: esHub || isMobile ? '100%' : `calc(100% - ${drawerWidth}px)`,
          maxWidth: '100%',
          overflowX: 'hidden',
          transition: 'width 0.15s ease-in-out'
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 56, sm: 60 } }} />
        {children}
      </Box>
    </Box>
  );
}
