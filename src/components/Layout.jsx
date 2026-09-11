import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Box, Drawer, AppBar, Toolbar, List, Typography, 
  ListItem, ListItemButton, ListItemIcon, ListItemText, 
  IconButton, Divider, Button, useTheme, useMediaQuery,
  Tooltip
} from '@mui/material';
import { 
  Briefcase, ShieldAlert, LogOut, UserCheck, Home, 
  Globe, MessageCircle, FolderArchive, Menu, X 
} from 'lucide-react';

const drawerWidth = 260;

export default function Layout({ children, currentView, setView, userRole, userPermisos }) {
  const { user, logout } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);

  const esHub = currentView === 'hub';
  const menuItems = [];

  if (!esHub) {
    menuItems.push({ text: 'Menú Principal', icon: <Home size={20} />, id: 'hub' });
  }

  // 🚀 1. Centro de Recursos Institucionales
  menuItems.push({ text: 'Recursos Institucionales', icon: <FolderArchive size={20} />, id: 'recursos_institucionales' });

  // 🚀 2. Acceso al Módulo Sitio Web en la barra lateral
  if (userRole === 'Superadmin' || userPermisos?.web === true) {
    menuItems.push({ text: 'Sitio Web', icon: <Globe size={20} />, id: 'sitio_web' });
  }

  // 🚀 3. Acceso al Módulo WhatsApp en la barra lateral
  if (userRole === 'Superadmin' || userPermisos?.whatsapp === true) {
    menuItems.push({ text: 'WhatsApp', icon: <MessageCircle size={20} />, id: 'whatsapp' });
  }

  // 🚀 4. Módulo de Casos (Gestión de Litigios)
  menuItems.push({ text: 'Casos y Litigios', icon: <Briefcase size={20} />, id: 'casos' });

  if (userRole === 'Superadmin' || userRole === 'Admin') {
    menuItems.push({ text: 'Control de Usuarios', icon: <UserCheck size={20} />, id: 'usuarios' });
  }

  if (userRole === 'Superadmin') {
    menuItems.push({ text: 'Logs de Auditoría', icon: <ShieldAlert size={20} />, id: 'logs' });
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
    <Box sx={{ overflow: 'auto', mt: { xs: 1, md: 2 } }}>
      {isMobile && (
        <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="subtitle2" fontWeight="bold" color="#1a365d">
            Navegación Institucional
          </Typography>
          <IconButton size="small" onClick={handleDrawerToggle}>
            <X size={18} />
          </IconButton>
        </Box>
      )}
      <List sx={{ px: 1.5 }}>
        {menuItems.map((item, index) => (
          <React.Fragment key={item.id}>
            {!esHub && index === 1 && <Divider sx={{ my: 1.5 }} />}
            
            <ListItem disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton 
                onClick={() => handleSelectView(item.id)}
                selected={currentView === item.id}
                sx={{
                  borderRadius: 2,
                  color: currentView === item.id ? 'primary.main' : 'text.secondary',
                  bgcolor: currentView === item.id ? 'rgba(26, 54, 93, 0.04)' : 'transparent',
                  '&.Mui-selected': {
                    bgcolor: 'rgba(26, 54, 93, 0.08)',
                    color: 'primary.main',
                    fontWeight: 'bold',
                    '&:hover': { bgcolor: 'rgba(26, 54, 93, 0.12)' }
                  }
                }}
              >
                <ListItemIcon sx={{ color: currentView === item.id ? 'primary.main' : 'text.disabled', minWidth: 40 }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText 
                  primary={item.text} 
                  primaryTypographyProps={{ 
                    fontSize: '0.9rem', 
                    fontWeight: currentView === item.id ? 600 : 500 
                  }} 
                />
              </ListItemButton>
            </ListItem>
          </React.Fragment>
        ))}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      {/* BARRA SUPERIOR BRANDING */}
      <AppBar 
        position="fixed" 
        sx={{ 
          zIndex: (theme) => theme.zIndex.drawer + 1, 
          bgcolor: '#1a365d', 
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)' 
        }}
      >
        <Toolbar sx={{ justifyContent: 'space-between', px: { xs: 1.5, sm: 2.5 } }}>
          
          {/* SECCIÓN IZQUIERDA: Menú hamburguesa (en móviles) + Logos */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 2 } }}>
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

            {/* ISOTIPO */}
            <img 
              src="/Isotipo-w.png" 
              alt="Isotipo IIRESODH" 
              style={{ 
                height: '32px', 
                width: 'auto',
                objectFit: 'contain',
                display: 'block'
              }} 
            />
            
            {/* LOGO TEXTUAL: visible en sm+, oculto en pantallas ultra estrechas */}
            <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
              <img 
                src="/logo.png" 
                alt="IIRESODH - Intranet" 
                style={{ 
                  height: '24px', 
                  width: 'auto',
                  objectFit: 'contain',
                  display: 'block'
                }} 
              />
            </Box>
          </Box>
          
          {/* SECCIÓN DERECHA: Email y botón para salir */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 1.5 } }}>
            <Tooltip title={user?.email || ''}>
              <Typography 
                variant="body2" 
                color="rgba(255,255,255,0.92)" 
                noWrap
                sx={{ 
                  fontSize: { xs: '0.78rem', sm: '0.875rem' }, 
                  fontWeight: 500,
                  maxWidth: { xs: 130, sm: 240 }
                }}
              >
                {user?.email}
              </Typography>
            </Tooltip>
            
            <Divider orientation="vertical" flexItem sx={{ bgcolor: 'rgba(255,255,255,0.25)', height: 20, my: 'auto' }} />
            
            <Button
              onClick={logout}
              startIcon={<LogOut size={15} />}
              sx={{
                color: '#ff8a80',
                textTransform: 'none',
                fontSize: { xs: '0.8rem', sm: '0.85rem' },
                fontWeight: 600,
                px: { xs: 1, sm: 1.5 },
                py: 0.4,
                borderRadius: 2,
                bgcolor: 'rgba(255, 138, 128, 0.08)',
                minWidth: 'auto',
                '&:hover': {
                  bgcolor: 'rgba(255, 138, 128, 0.20)',
                  color: '#ff5252'
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
          {/* Versión móvil: Drawer temporal deslizante */}
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
              <Toolbar />
              {drawerContent}
            </Drawer>
          ) : (
            /* Versión escritorio: Drawer permanente */
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
          p: { xs: 1.5, sm: 2.5, md: 4 }, 
          bgcolor: '#f8fafc', 
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