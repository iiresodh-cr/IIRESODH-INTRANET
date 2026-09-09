// src/views/HubIntranet.jsx
import React from 'react';
import { Box, Typography, Card, CardContent, Button, Divider } from '@mui/material';
import { Scale, Users, ShieldCheck, FileSpreadsheet, Activity, Globe, MessageCircle } from 'lucide-react'; // 🚀 AGREGADO: Iconos Globe y MessageCircle

export default function HubIntranet({ setView, userRole }) {
  
  // CONTROL PERIMETRAL: Roles autorizados para cada sección
  const tieneAccesoLitigio = userRole !== 'Invitado';
  // 🚀 Acceso al módulo web para Superadmin, Admin y personal autorizado (con subautorización en el panel web)
  const tieneAccesoWeb = userRole !== 'Invitado';
  const tieneAccesoWhatsapp = userRole !== 'Invitado'; // O la lógica de acceso deseada

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: 2, mt: 2 }}>
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
          border: '1px solid #e2e8f0', 
          boxShadow: 'none', 
          transition: 'all 0.2s',
          ...(!tieneAccesoWhatsapp && { opacity: 0.65, bgcolor: '#f8fafc' }),
          '&:hover': tieneAccesoWhatsapp ? { borderColor: '#25D366', bgcolor: '#f8fafc' } : {}
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
          border: '1px solid #e2e8f0', 
          boxShadow: 'none', 
          transition: 'all 0.2s',
          ...(!tieneAccesoLitigio && { opacity: 0.65, bgcolor: '#f8fafc' }),
          '&:hover': tieneAccesoLitigio ? { borderColor: 'primary.main', bgcolor: '#f8fafc' } : {}
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

        {/* 🚀 MÓDULO 2: ADMINISTRACIÓN DEL SITIO WEB (Exclusivo Superadmin) */}
        <Card sx={{ 
          borderRadius: 3, 
          border: '1px solid #e2e8f0', 
          boxShadow: 'none', 
          transition: 'all 0.2s',
          ...(!tieneAccesoWeb && { opacity: 0.65, bgcolor: '#f8fafc' }),
          '&:hover': tieneAccesoWeb ? { borderColor: 'primary.main', bgcolor: '#f8fafc' } : {}
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
        <Card sx={{ borderRadius: 3, bgcolor: '#f8fafc', border: '1px dashed #cbd5e1', boxShadow: 'none' }}>
          <CardContent sx={{ p: 3, textAlign: 'center', opacity: 0.6 }}>
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
        <Card sx={{ borderRadius: 3, bgcolor: '#f8fafc', border: '1px dashed #cbd5e1', boxShadow: 'none' }}>
          <CardContent sx={{ p: 3, textAlign: 'center', opacity: 0.6 }}>
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
  );
}