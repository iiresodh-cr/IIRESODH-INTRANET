// src/views/HubIntranet.jsx
import React from 'react';
import { Box, Typography, Card, CardContent, Button, Divider } from '@mui/material';
import { Scale, Users, ShieldCheck, FileSpreadsheet, Activity, Globe, MessageCircle } from 'lucide-react'; // 🚀 AGREGADO: Iconos Globe y MessageCircle

export default function HubIntranet({ setView, userRole, userPermisos }) {
  
  // CONTROL PERIMETRAL: Roles autorizados para cada sección
  const tieneAccesoLitigio = userRole !== 'Invitado';
  // 🚀 Acceso condicionado al permiso asignado o Superadmin
  const tieneAccesoWeb = userRole === 'Superadmin' || userPermisos?.web === true;
  const tieneAccesoWhatsapp = userRole === 'Superadmin' || userPermisos?.whatsapp === true;

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
          opacity: 0.12, // Tenue para no competir con el contenido
          filter: 'blur(3px)', // Difuminado suave
          transform: 'scale(1.04)', // Evita bordes duros por el filtro blur
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
        <Box sx={{ mb: 5, textAlign: 'center' }}>
          <Typography variant="h4" fontWeight="bold" color="primary.main" gutterBottom>
            Intranet Global IIRESODH
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Seleccione el módulo operativo al que desea acceder
          </Typography>
        </Box>

        {/* REJILLA DE MÓDULOS DE NEGOCIO */}
        {/* 💡 NOTA: Mantenemos las 3 columnas en pantallas grandes; el 4to módulo bajará automáticamente de forma muy limpia */}
        <Box sx={{ 
          display: 'grid', 
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, 
          gap: 3, 
          mb: 6 
        }}>
          
          {/* 🚀 MÓDULO 0: WHATSAPP */}
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

        {/* MÓDULO 1: LITIGIOS */}
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
              Control de expedientes, registro de representados, plazos fatales y envío de comunicados.
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
                ...(!tieneAccesoLitigio && { color: 'error.main', borderColor: 'error.light' })
              }}
            >
              {tieneAccesoLitigio ? "Ingresar al Módulo" : "Acceso Restringido"}
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
              Administración del sitio web, actualización de contenidos y gestión del portal público.
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

        {/* MÓDULO 3: RECURSOS HUMANOS (ESTRUCTURA DE ESPERA) */}
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

        {/* MÓDULO 4: FINANZAS (ESTRUCTURA DE ESPERA) */}
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