// src/views/HubIntranet.jsx
import React, { useState } from 'react';
import { Box, Typography, Card, CardContent, Button, Divider, Avatar, Chip, Snackbar, Alert } from '@mui/material';
import { 
  Scale, Users, ShieldCheck, FileSpreadsheet, Activity, 
  Globe, MessageCircle, FolderArchive, Calendar, Sparkles,
  CalendarDays, Plus
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import CalendarioInstitucional from '../components/CalendarioInstitucional';

export default function HubIntranet({ setView, userRole, userPermisos, user: propUser, userName }) {
  const { user: authUser } = useAuth();
  const currentUser = propUser || authUser;

  // CONTROL PERIMETRAL: Roles autorizados para cada sección
  const tieneAccesoLitigio = userRole !== 'Invitado';
  const tieneAccesoWeb = userRole === 'Superadmin' || userPermisos?.web === true;
  const tieneAccesoWhatsapp = userRole === 'Superadmin' || userPermisos?.whatsapp === true;

  // Saludo dinámico según horario local
  const obtenerSaludo = () => {
    const hora = new Date().getHours();
    if (hora >= 5 && hora < 12) return 'Buenos días';
    if (hora >= 12 && hora < 19) return 'Buenas tardes';
    return 'Buenas noches';
  };

  // Nombre para el saludo
  const nombreAMostrar = userName || currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Colega';
  const inicial = nombreAMostrar.charAt(0).toUpperCase();

  // Fecha formateada en español
  const fechaHoy = new Intl.DateTimeFormat('es-CR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(new Date());
  const fechaCapitalizada = fechaHoy.charAt(0).toUpperCase() + fechaHoy.slice(1);



  return (
    <Box sx={{ position: 'relative', minHeight: 'calc(100vh - 120px)', py: 1 }}>
      {/* 🇨🇷 FONDO INSTITUCIONAL: Bandera de Costa Rica tenue y difuminada */}
      <Box
        sx={{
          position: 'fixed',
          top: 64,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: 'url(/bandera-cr.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center 40%',
          backgroundRepeat: 'no-repeat',
          opacity: 0.12,
          filter: 'blur(3px)',
          transform: 'scale(1.04)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* Capa de viñeta y gradiente institucional para integración suave */}
      <Box
        sx={{
          position: 'fixed',
          top: 64,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'radial-gradient(ellipse at center, rgba(248, 250, 252, 0.35) 0%, rgba(248, 250, 252, 0.85) 100%)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* CONTENIDO DEL HUB */}
      <Box sx={{ position: 'relative', zIndex: 1, maxWidth: 1200, mx: 'auto', p: 2, mt: 1 }}>
        
        {/* 🌟 BANNER DE SALUDO PERSONALIZADO CON AVATAR */}
        <Card
          sx={{
            borderRadius: 4,
            border: '1px solid rgba(226, 232, 240, 0.95)',
            boxShadow: '0 8px 28px rgba(26, 54, 93, 0.06)',
            bgcolor: 'rgba(255, 255, 255, 0.92)',
            backdropFilter: 'blur(12px)',
            p: { xs: 2.5, sm: 3.5 },
            mb: 5,
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            alignItems: { xs: 'flex-start', md: 'center' },
            justifyContent: 'space-between',
            gap: 3,
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          {/* Adorno visual sutil de fondo */}
          <Box
            sx={{
              position: 'absolute',
              right: -20,
              top: -20,
              width: 140,
              height: 140,
              borderRadius: '50%',
              bgcolor: 'rgba(26, 54, 93, 0.03)',
              pointerEvents: 'none'
            }}
          />

          {/* LADO IZQUIERDO: AVATAR Y SALUDO */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 2, sm: 2.5 } }}>
            <Avatar
              src={currentUser?.photoURL}
              alt={nombreAMostrar}
              referrerPolicy="no-referrer"
              sx={{
                width: { xs: 60, sm: 72 },
                height: { xs: 60, sm: 72 },
                bgcolor: '#1a365d',
                color: '#c5a880',
                fontSize: { xs: '1.5rem', sm: '1.85rem' },
                fontWeight: 'bold',
                boxShadow: '0 4px 14px rgba(26, 54, 93, 0.20)',
                border: '3px solid #ffffff'
              }}
            >
              {inicial}
            </Avatar>

            <Box>
              <Typography 
                variant="h5" 
                fontWeight="800" 
                color="primary.main" 
                sx={{ 
                  lineHeight: 1.2, 
                  fontSize: { xs: '1.25rem', sm: '1.55rem' } 
                }}
              >
                ¡{obtenerSaludo()}, {nombreAMostrar}!
              </Typography>
              
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <span>Sesión activa en el Hub Central de IIRESODH</span>
                <Chip
                  label={userRole || 'Colaborador'}
                  size="small"
                  sx={{
                    bgcolor: 'rgba(26, 54, 93, 0.08)',
                    color: '#1a365d',
                    fontWeight: 'bold',
                    fontSize: '0.72rem',
                    height: 22
                  }}
                />
              </Typography>
            </Box>
          </Box>

          {/* LADO DERECHO: FECHA INSTITUCIONAL */}
          <Box 
            sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 1.5,
              px: 2,
              py: 1,
              borderRadius: 2,
              bgcolor: 'rgba(248, 250, 252, 0.85)',
              border: '1px solid #e2e8f0',
              alignSelf: { xs: 'stretch', md: 'center' },
              justifyContent: { xs: 'center', md: 'flex-start' }
            }}
          >
            <Calendar size={18} color="#1a365d" />
            <Typography variant="body2" fontWeight="600" color="text.secondary" sx={{ fontSize: '0.85rem' }}>
              {fechaCapitalizada}
            </Typography>
          </Box>
        </Card>

        {/* 📅 CALENDARIO INSTITUCIONAL (contacto@iiresodh.org) */}
        <Box sx={{ mb: 5 }}>
          <CalendarioInstitucional />
        </Box>

        {/* TÍTULO DE MÓDULOS */}
        <Box sx={{ mb: 4, textAlign: 'center' }}>
          <Typography variant="h5" fontWeight="bold" color="primary.main" gutterBottom>
            Módulos Operativos Institucionales
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Seleccione el módulo al que desea ingresar para gestionar sus actividades
          </Typography>
        </Box>

        {/* REJILLA DE MÓDULOS DE NEGOCIO */}
        <Box sx={{ 
          display: 'grid', 
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, 
          gap: 3, 
          mb: 6 
        }}>
          
          {/* 🏛️ MÓDULO 1: CENTRO DE RECURSOS INSTITUCIONALES */}
          <Card sx={{ 
            borderRadius: 3, 
            border: '1px solid rgba(226, 232, 240, 0.9)', 
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)', 
            bgcolor: 'rgba(255, 255, 255, 0.90)',
            backdropFilter: 'blur(10px)',
            transition: 'all 0.2s',
            '&:hover': { 
              borderColor: 'primary.main', 
              bgcolor: '#ffffff', 
              transform: 'translateY(-2px)',
              boxShadow: '0 8px 24px rgba(26, 54, 93, 0.10)' 
            }
          }}>
            <CardContent sx={{ p: 3, textAlign: 'center' }}>
              <FolderArchive size={42} style={{ color: '#1a365d', marginBottom: '16px' }} />
              <Typography variant="h6" fontWeight="bold" gutterBottom color="text.primary">
                Centro de Recursos Institucionales
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ minHeight: 48, mb: 2 }}>
                Material gráfico oficial (logos, isotipo), identidad visual y reglamentos internos.
              </Typography>
              
              <Button 
                variant="contained" 
                fullWidth 
                onClick={() => setView('recursos_institucionales')} 
                sx={{ 
                  textTransform: 'none', 
                  fontWeight: 'bold', 
                  borderRadius: 2,
                  bgcolor: '#1a365d',
                  '&:hover': { bgcolor: '#0f233c' }
                }}
              >
                Acceder a Recursos
              </Button>
            </CardContent>
          </Card>

          {/* 🚀 MÓDULO 2: ADMINISTRACIÓN DEL SITIO WEB */}
          <Card sx={{ 
            borderRadius: 3, 
            border: '1px solid rgba(226, 232, 240, 0.9)', 
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)', 
            bgcolor: 'rgba(255, 255, 255, 0.90)',
            backdropFilter: 'blur(10px)',
            transition: 'all 0.2s',
            ...(!tieneAccesoWeb && { opacity: 0.65, bgcolor: 'rgba(248, 250, 252, 0.85)' }),
            '&:hover': tieneAccesoWeb ? { borderColor: 'primary.main', bgcolor: '#ffffff', transform: 'translateY(-2px)' } : {}
          }}>
            <CardContent sx={{ p: 3, textAlign: 'center' }}>
              <Globe size={42} style={{ color: tieneAccesoWeb ? '#1a365d' : '#94a3b8', marginBottom: '16px' }} />
              <Typography variant="h6" fontWeight="bold" gutterBottom color={tieneAccesoWeb ? 'text.primary' : 'text.secondary'}>
                Sitio Web
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ minHeight: 48, mb: 2 }}>
                Administración del sitio web, actualización de contenidos y portal público.
              </Typography>
              
              <Button 
                variant={tieneAccesoWeb ? "contained" : "outlined"} 
                fullWidth 
                disabled={!tieneAccesoWeb}
                onClick={() => setView('sitio_web')} 
                sx={{ 
                  textTransform: 'none', 
                  fontWeight: 'bold', 
                  borderRadius: 2,
                  ...(tieneAccesoWeb && { bgcolor: '#1a365d', '&:hover': { bgcolor: '#0f233c' } }),
                  ...(!tieneAccesoWeb && { color: 'error.main', borderColor: 'error.light' })
                }}
              >
                {tieneAccesoWeb ? "Administrar Sitio" : "Acceso Restringido"}
              </Button>
            </CardContent>
          </Card>

          {/* 🚀 MÓDULO 3: WHATSAPP */}
          <Card sx={{ 
            borderRadius: 3, 
            border: '1px solid rgba(226, 232, 240, 0.9)', 
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)', 
            bgcolor: 'rgba(255, 255, 255, 0.90)',
            backdropFilter: 'blur(10px)',
            transition: 'all 0.2s',
            ...(!tieneAccesoWhatsapp && { opacity: 0.65, bgcolor: 'rgba(248, 250, 252, 0.85)' }),
            '&:hover': tieneAccesoWhatsapp ? { borderColor: '#25D366', bgcolor: '#ffffff', transform: 'translateY(-2px)' } : {}
          }}>
            <CardContent sx={{ p: 3, textAlign: 'center' }}>
              <MessageCircle size={42} style={{ color: tieneAccesoWhatsapp ? '#25D366' : '#94a3b8', marginBottom: '16px' }} />
              <Typography variant="h6" fontWeight="bold" gutterBottom color={tieneAccesoWhatsapp ? 'text.primary' : 'text.secondary'}>
                WhatsApp
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ minHeight: 48, mb: 2 }}>
                Comunicación oficial vía WhatsApp Business API con clientes y prospectos.
              </Typography>
              
              <Button 
                variant={tieneAccesoWhatsapp ? "contained" : "outlined"} 
                fullWidth 
                disabled={!tieneAccesoWhatsapp}
                onClick={() => setView('whatsapp')} 
                sx={{ 
                  textTransform: 'none', 
                  fontWeight: 'bold', 
                  borderRadius: 2,
                  ...(tieneAccesoWhatsapp && { bgcolor: '#25D366', color: '#fff', '&:hover': { bgcolor: '#20bd5a' } }),
                  ...(!tieneAccesoWhatsapp && { color: 'error.main', borderColor: 'error.light' })
                }}
              >
                {tieneAccesoWhatsapp ? "Abrir WhatsApp" : "Acceso Restringido"}
              </Button>
            </CardContent>
          </Card>

          {/* MÓDULO 4: LITIGIOS */}
          <Card sx={{ 
            borderRadius: 3, 
            border: '1px solid rgba(226, 232, 240, 0.9)', 
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)', 
            bgcolor: 'rgba(255, 255, 255, 0.90)',
            backdropFilter: 'blur(10px)',
            transition: 'all 0.2s',
            ...(!tieneAccesoLitigio && { opacity: 0.65, bgcolor: 'rgba(248, 250, 252, 0.85)' }),
            '&:hover': tieneAccesoLitigio ? { borderColor: 'primary.main', bgcolor: '#ffffff', transform: 'translateY(-2px)' } : {}
          }}>
            <CardContent sx={{ p: 3, textAlign: 'center' }}>
              <Scale size={42} style={{ color: tieneAccesoLitigio ? '#1a365d' : '#94a3b8', marginBottom: '16px' }} />
              <Typography variant="h6" fontWeight="bold" gutterBottom color={tieneAccesoLitigio ? 'text.primary' : 'text.secondary'}>
                Gestión de Litigios
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ minHeight: 48, mb: 2 }}>
                Control de expedientes, registro de representados, plazos fatales y comunicados.
              </Typography>
              
              <Button 
                variant={tieneAccesoLitigio ? "contained" : "outlined"} 
                fullWidth 
                disabled={!tieneAccesoLitigio}
                onClick={() => setView('casos')} 
                sx={{ 
                  textTransform: 'none', 
                  fontWeight: 'bold', 
                  borderRadius: 2,
                  ...(tieneAccesoLitigio && { bgcolor: '#1a365d', '&:hover': { bgcolor: '#0f233c' } }),
                  ...(!tieneAccesoLitigio && { color: 'error.main', borderColor: 'error.light' })
                }}
              >
                {tieneAccesoLitigio ? "Ingresar al Módulo" : "Acceso Restringido"}
              </Button>
            </CardContent>
          </Card>

          {/* MÓDULO 5: RECURSOS HUMANOS (ESTRUCTURA DE ESPERA) */}
          <Card sx={{ 
            borderRadius: 3, 
            bgcolor: 'rgba(248, 250, 252, 0.75)', 
            backdropFilter: 'blur(8px)',
            border: '1px dashed #cbd5e1', 
            boxShadow: 'none' 
          }}>
            <CardContent sx={{ p: 3, textAlign: 'center', opacity: 0.7 }}>
              <Users size={42} style={{ color: '#64748b', marginBottom: '16px' }} />
              <Typography variant="h6" fontWeight="bold" gutterBottom>Recursos Humanos</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ minHeight: 48, mb: 2 }}>
                Gestión de personal, marcas y perfiles de usuario.
              </Typography>
              <Button variant="outlined" disabled fullWidth sx={{ textTransform: 'none', borderRadius: 2 }}>
                Próximamente
              </Button>
            </CardContent>
          </Card>

          {/* MÓDULO 6: FINANZAS (ESTRUCTURA DE ESPERA) */}
          <Card sx={{ 
            borderRadius: 3, 
            bgcolor: 'rgba(248, 250, 252, 0.75)', 
            backdropFilter: 'blur(8px)',
            border: '1px dashed #cbd5e1', 
            boxShadow: 'none' 
          }}>
            <CardContent sx={{ p: 3, textAlign: 'center', opacity: 0.7 }}>
              <FileSpreadsheet size={42} style={{ color: '#64748b', marginBottom: '16px' }} />
              <Typography variant="h6" fontWeight="bold" gutterBottom>Finanzas & Facturación</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ minHeight: 48, mb: 2 }}>
                Conciliación de pasarelas de pago Stripe, facturación institucional y reportes analíticos.
              </Typography>
              <Button variant="outlined" disabled fullWidth sx={{ textTransform: 'none', borderRadius: 2 }}>
                Próximamente
              </Button>
            </CardContent>
          </Card>
        </Box>

        {/* ACCESOS DIRECTOS ADMINISTRATIVOS */}
        {(userRole === 'Superadmin' || userRole === 'Admin') && (
          <>
            <Divider sx={{ mb: 4 }} />
            <Typography variant="subtitle2" fontWeight="bold" color="text.secondary" sx={{ mb: 2, px: 0.5 }}>
              Controles de Seguridad del Sistema
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Button 
                variant="outlined" 
                startIcon={<ShieldCheck size={16} />} 
                onClick={() => setView('usuarios')}
                sx={{ textTransform: 'none', borderRadius: 2, fontWeight: 'medium' }}
              >
                Control de Usuarios Autorizados
              </Button>
              
              {userRole === 'Superadmin' && (
                <Button 
                  variant="outlined" 
                  startIcon={<Activity size={16} />} 
                  onClick={() => setView('logs')}
                  color="inherit"
                  sx={{ textTransform: 'none', borderRadius: 2, fontWeight: 'medium' }}
                >
                  Bitácora de Auditoría (Logs)
                </Button>
              )}
            </Box>
          </>
        )}
      </Box>


    </Box>
  );
}