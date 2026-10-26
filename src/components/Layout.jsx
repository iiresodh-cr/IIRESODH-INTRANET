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
        <Box sx={{ px: 2.5, py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="subtitle2" fontWeight="800" color="#1D3557" sx={{ letterSpacing: '0.03em' }}>
            NAVEGACIÓN IIRESODH
          </Typography>
          <IconButton size="small" onClick={handleDrawerToggle}>
            <X size={18} />
          </IconButton>
        </Box>
      )}
      <List sx={{ px: 1.5, flex: 1 }}>
        {menuItems.map((item, index) => {
          const isSelected = currentView === item.id;
          return (
            <React.Fragment key={item.id}>
              {!esHub && index === 1 && <Divider sx={{ my: 1.5, borderColor: '#E2E8F0' }} />}
              
              <ListItem disablePadding sx={{ mb: 0.6 }}>
                <ListItemButton 
                  onClick={() => handleSelectView(item.id)}
                  selected={isSelected}
                  sx={{
                    borderRadius: 2,
                    py: 1.1,
                    position: 'relative',
                    color: isSelected ? '#1D3557' : '#475569',
                    bgcolor: isSelected ? 'rgba(29, 53, 87, 0.06)' : 'transparent',
                    borderLeft: isSelected ? '3px solid #B92F32' : '3px solid transparent',
                    '&.Mui-selected': {
                      bgcolor: 'rgba(29, 53, 87, 0.08)',
                      color: '#1D3557',
                      fontWeight: 700,
                      '&:hover': { bgcolor: 'rgba(29, 53, 87, 0.12)' }
                    },
                    '&:hover': {
                      bgcolor: 'rgba(29, 53, 87, 0.04)',
                      color: '#1D3557'
                    }
                  }}
                >
                  <ListItemIcon sx={{ color: isSelected ? '#1D3557' : '#64748B', minWidth: 36 }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText 
                    primary={item.text} 
                    primaryTypographyProps={{ 
                      fontSize: '0.88rem', 
                      fontWeight: isSelected ? 700 : 500 
                    }} 
                  />
                </ListItemButton>
              </ListItem>
            </React.Fragment>
          );
        })}
      </List>

      {/* Pie institucional de la barra lateral */}
      <Box sx={{ p: 2, m: 1.5, borderRadius: 2, bgcolor: '#F8FAF8', border: '1px solid #E2E8F0' }}>
        <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#1D3557', letterSpacing: '0.04em' }}>
          IIRESODH INTRANET
        </Typography>
        <Typography sx={{ fontSize: '0.68rem', color: '#64748B', mt: 0.25 }}>
          Entorno privado institucional
        </Typography>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      {/* BARRA SUPERIOR INSTITUCIONAL IIRESODH */}
      <AppBar 
        position="fixed" 
        sx={{ 
          zIndex: (theme) => theme.zIndex.drawer + 1, 
          bgcolor: '#1D3557', 
          boxShadow: '0 2px 12px rgba(29, 53, 87, 0.16)',
          borderBottom: '3px solid #B92F32'
        }}
      >
        <Toolbar sx={{ justifyContent: 'space-between', px: { xs: 1.5, sm: 3 }, minHeight: { xs: 56, sm: 64 } }}>
          
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
                <Menu size={22} />
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
              {/* Contenedor blanco para el isotipo oficial con gradiente */}
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: 1.75,
                  bgcolor: '#FFFFFF',
                  p: 0.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.18)'
                }}
              >
                <img 
                  src="/iiresodh-isotipo-gradient.png" 
                  alt="Isotipo IIRESODH" 
                  style={{ 
                    width: '100%', 
                    height: '100%',
                    objectFit: 'contain',
                    display: 'block'
                  }} 
                />
              </Box>
              
              {/* Tipografía Institucional IIRESODH */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box>
                  <Typography
                    sx={{
                      fontFamily: '"Plus Jakarta Sans", sans-serif',
                      fontWeight: 800,
                      fontSize: { xs: '1.05rem', sm: '1.2rem' },
                      letterSpacing: '0.08em',
                      color: '#FFFFFF',
                      lineHeight: 1.05
                    }}
                  >
                    IIRESODH
                  </Typography>
                  <Typography
                    sx={{
                      display: { xs: 'none', sm: 'block' },
                      fontSize: '0.64rem',
                      fontWeight: 600,
                      letterSpacing: '0.07em',
                      color: '#A8DADC',
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 1.75 } }}>
            {userRole && (
              <Chip
                label={userRole}
                size="small"
                sx={{
                  display: { xs: 'none', md: 'inline-flex' },
                  bgcolor: 'rgba(168, 218, 220, 0.14)',
                  color: '#F1FAEE',
                  border: '1px solid rgba(168, 218, 220, 0.28)',
                  fontWeight: 700,
                  fontSize: '0.7rem',
                  height: 24,
                  letterSpacing: '0.02em'
                }}
              />
            )}

            <Tooltip title={user?.email || ''}>
              <Typography 
                variant="body2" 
                color="rgba(255,255,255,0.92)" 
                noWrap
                sx={{ 
                  fontSize: { xs: '0.76rem', sm: '0.84rem' }, 
                  fontWeight: 500,
                  maxWidth: { xs: 130, sm: 230 }
                }}
              >
                {user?.email}
              </Typography>
            </Tooltip>
            
            <Divider orientation="vertical" flexItem sx={{ bgcolor: 'rgba(255,255,255,0.2)', height: 20, my: 'auto' }} />
            
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
              startIcon={<LogOut size={15} />}
              sx={{
                color: '#FFFFFF',
                textTransform: 'none',
                fontSize: { xs: '0.78rem', sm: '0.82rem' },
                fontWeight: 600,
                px: { xs: 1.2, sm: 1.6 },
                py: 0.5,
                borderRadius: 1.75,
                bgcolor: 'rgba(185, 47, 50, 0.85)',
                border: '1px solid rgba(230, 57, 70, 0.5)',
                minWidth: 'auto',
                '&:hover': {
                  bgcolor: '#B92F32',
                  borderColor: '#E63946'
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
                  bgcolor: '#FFFFFF'
                }
              }}
            >
              <Toolbar />
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
                  borderRight: '1px solid #E2E8F0', 
                  bgcolor: '#FFFFFF' 
                },
              }}
            >
              <Toolbar />
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
          p: { xs: 1.5, sm: 2.5, md: 3.5 }, 
          bgcolor: '#F8FAF8', 
          minHeight: '100vh',
          width: esHub || isMobile ? '100%' : `calc(100% - ${drawerWidth}px)`,
          maxWidth: '100%',
          overflowX: 'hidden',
          transition: 'width 0.15s ease-in-out'
        }}
      >
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
}
