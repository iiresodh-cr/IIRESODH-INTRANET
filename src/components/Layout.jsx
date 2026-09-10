import React from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Box, Drawer, AppBar, Toolbar, List, Typography, 
  ListItem, ListItemButton, ListItemIcon, ListItemText, 
  IconButton, Avatar, Divider, Button 
} from '@mui/material';
import { Briefcase, ShieldAlert, LogOut, UserCheck, Home, Globe, MessageCircle, FolderArchive } from 'lucide-react';

const drawerWidth = 260;

export default function Layout({ children, currentView, setView, userRole, userPermisos }) {
  const { user, logout } = useAuth();

  const esHub = currentView === 'hub';
  const menuItems = [];

  if (!esHub) {
    menuItems.push({ text: 'Menú Principal', icon: <Home size={20} />, id: 'hub' });
  }

  // Módulo de Casos
  menuItems.push({ text: 'Casos y Litigios', icon: <Briefcase size={20} />, id: 'casos' });

  // 🚀 Centro de Recursos Institucionales
  menuItems.push({ text: 'Recursos Institucionales', icon: <FolderArchive size={20} />, id: 'recursos_institucionales' });

  // 🚀 Acceso al Módulo WhatsApp en la barra lateral
  if (userRole === 'Superadmin' || userPermisos?.whatsapp === true) {
    menuItems.push({ text: 'WhatsApp', icon: <MessageCircle size={20} />, id: 'whatsapp' });
  }

  // 🚀 Acceso al Módulo Sitio Web en la barra lateral
  if (userRole === 'Superadmin' || userPermisos?.web === true) {
    menuItems.push({ text: 'Sitio Web', icon: <Globe size={20} />, id: 'sitio_web' });
  }

  if (userRole === 'Superadmin' || userRole === 'Admin') {
    menuItems.push({ text: 'Control de Usuarios', icon: <UserCheck size={20} />, id: 'usuarios' });
  }

  if (userRole === 'Superadmin') {
    menuItems.push({ text: 'Logs de Auditoría', icon: <ShieldAlert size={20} />, id: 'logs' });
  }

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
        <Toolbar sx={{ justifyContent: 'space-between' }}>
          
          {/* SECCIÓN IZQUIERDA: Alineación de activos de marca */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            
            {/* 🚀 ISOTIPO: Reducción controlada de 512px a 36px manteniendo proporción */}
            <img 
              src="/Isotipo-w.png" 
              alt="Isotipo IIRESODH" 
              style={{ 
                height: '36px', 
                width: 'auto', // Evita que el ancho se desfase de los 513px nativos
                objectFit: 'contain',
                display: 'block'
              }} 
            />
            
            {/* 🚀 LOGO TEXTUAL: Reducción de 92px de alto a 26px para que calce en el Toolbar */}
            <img 
              src="/logo.png" 
              alt="IIRESODH - Intranet" 
              style={{ 
                height: '26px', 
                width: 'auto', // Calcula el ancho proporcional a ~85px de forma automática
                objectFit: 'contain',
                display: 'block'
              }} 
            />
          </Box>
          
          {/* SECCIÓN DERECHA: Solo el email y el enlace para salir */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography 
              variant="body2" 
              color="rgba(255,255,255,0.92)" 
              sx={{ fontSize: '0.875rem', fontWeight: 500 }}
            >
              {user?.email}
            </Typography>
            
            <Divider orientation="vertical" flexItem sx={{ bgcolor: 'rgba(255,255,255,0.25)', height: 20, my: 'auto' }} />
            
            <Button
              onClick={logout}
              startIcon={<LogOut size={16} />}
              sx={{
                color: '#ff8a80',
                textTransform: 'none',
                fontSize: '0.85rem',
                fontWeight: 600,
                px: 1.5,
                py: 0.5,
                borderRadius: 2,
                bgcolor: 'rgba(255, 138, 128, 0.08)',
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

      {/* BARRA LATERAL (SIDEBAR) */}
      {!esHub && (
        <Drawer
          variant="permanent"
          sx={{
            width: drawerWidth,
            flexShrink: 0,
            [`& .MuiDrawer-paper`]: { 
              width: drawerWidth, 
              boxSizing: 'border-box', 
              borderRight: '1px solid #e2e8f0', 
              bgcolor: '#ffffff' 
            },
          }}
        >
          <Toolbar />
          <Box sx={{ overflow: 'auto', mt: 2 }}>
            <List sx={{ px: 1.5 }}>
              {menuItems.map((item, index) => (
                <React.Fragment key={item.id}>
                  {!esHub && index === 1 && <Divider sx={{ my: 1.5 }} />}
                  
                  <ListItem disablePadding sx={{ mb: 0.5 }}>
                    <ListItemButton 
                      onClick={() => setView(item.id)}
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
        </Drawer>
      )}

      {/* CONTENIDO DE LA INTRANET */}
      <Box 
        component="main" 
        sx={{ 
          flexGrow: 1, 
          p: 4, 
          bgcolor: '#f8fafc', 
          minHeight: '100vh',
          width: esHub ? '100%' : `calc(100% - ${drawerWidth}px)`,
          transition: 'width 0.15s ease-in-out'
        }}
      >
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
}