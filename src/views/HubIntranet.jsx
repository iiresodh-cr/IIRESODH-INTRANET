// src/views/HubIntranet.jsx
import React, { useState } from 'react';
import { Box, Typography, Card, CardContent, Button, Divider, Avatar, Chip } from '@mui/material';
import { 
  Scale, Users, ShieldCheck, FileSpreadsheet, Activity, 
  Globe, MessageCircle, FolderArchive, Calendar, ArrowRight,
  Lock, ExternalLink, Building2, GraduationCap
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import AcordeonHerramientas from '../components/AcordeonHerramientas';

export default function HubIntranet({ setView, userRole, userPermisos, user: propUser, userName }) {
  const { user: authUser } = useAuth();
  const currentUser = propUser || authUser;

  // Estado del panel activo en AcordeonHerramientas ('chat' | 'calendario' | false)
  const [activePanel, setActivePanel] = useState('chat');

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
      {/* FONDO INSTITUCIONAL SOBRIO: Patrón arquitectónico sutil y marca de agua oficial IIRESODH */}
      <Box
        sx={{
          position: 'fixed',
          top: 64,
          left: 0,
          right: 0,
          bottom: 0,
          bgcolor: '#F8FAF8',
          backgroundImage: 'radial-gradient(rgba(29, 53, 87, 0.055) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* Marca de agua sutil del isotipo institucional */}
      <Box
        component="img"
        src="/iiresodh-isotipo-blue.png"
        alt=""
        sx={{
          position: 'fixed',
          right: -90,
          bottom: -90,
          width: { xs: 280, md: 460 },
          height: 'auto',
          opacity: 0.025,
          pointerEvents: 'none',
          userSelect: 'none',
          zIndex: 0
        }}
      />

      {/* CONTENIDO DEL HUB */}
      <Box sx={{ position: 'relative', zIndex: 1, maxWidth: 1240, mx: 'auto', p: { xs: 0.5, sm: 1.5, md: 2 }, mt: { xs: 0.5, md: 1 } }}>
        
        {/* BANNER EJECUTIVO INSTITUCIONAL IIRESODH */}
        <Card
          elevation={0}
          sx={{
            borderRadius: '14px 14px 0 0',
            bgcolor: '#1D3557',
            color: '#FFFFFF',
            border: '1px solid rgba(69, 123, 157, 0.35)',
            borderBottom: '4px solid #B92F32',
            boxShadow: '0 14px 34px -10px rgba(29, 53, 87, 0.22)',
            p: { xs: 2.5, sm: 3.5, md: 4 },
            mb: { xs: 3, sm: 4.5 },
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            alignItems: { xs: 'flex-start', md: 'center' },
            justifyContent: 'space-between',
            gap: { xs: 2.5, sm: 3 },
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          {/* Luz radial secundaria institucional */}
          <Box
            sx={{
              position: 'absolute',
              right: '10%',
              top: -80,
              width: 340,
              height: 340,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(69, 123, 157, 0.28) 0%, rgba(29, 53, 87, 0) 70%)',
              pointerEvents: 'none'
            }}
          />

          {/* Marca de agua del isotipo en el banner */}
          <Box
            component="img"
            src="/iiresodh-isotipo-gradient.png"
            alt=""
            sx={{
              position: 'absolute',
              right: { xs: -40, md: 24 },
              bottom: -55,
              width: 210,
              height: 'auto',
              opacity: 0.07,
              filter: 'brightness(2)',
              pointerEvents: 'none'
            }}
          />

          {/* LADO IZQUIERDO: AVATAR E IDENTIDAD */}
          <Box sx={{ display: 'flex', alignItems: { xs: 'flex-start', sm: 'center' }, gap: { xs: 2, sm: 2.75 }, position: 'relative', zIndex: 1 }}>
            <Avatar
              src={currentUser?.photoURL}
              alt={nombreAMostrar}
              referrerPolicy="no-referrer"
              sx={{
                width: { xs: 58, sm: 70 },
                height: { xs: 58, sm: 70 },
                bgcolor: '#457B9D',
                color: '#FFFFFF',
                fontSize: { xs: '1.4rem', sm: '1.75rem' },
                fontFamily: '"Plus Jakarta Sans", sans-serif',
                fontWeight: 800,
                boxShadow: '0 6px 18px rgba(0, 0, 0, 0.25)',
                border: '2.5px solid #A8DADC'
              }}
            >
              {inicial}
            </Avatar>

            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75, flexWrap: 'wrap' }}>
                <Typography
                  sx={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    letterSpacing: '0.09em',
                    textTransform: 'uppercase',
                    color: '#A8DADC'
                  }}
                >
                  INSTITUTO INTERNACIONAL DE RESPONSABILIDAD SOCIAL Y DERECHOS HUMANOS
                </Typography>
              </Box>

              <Typography 
                variant="h4" 
                sx={{ 
                  fontFamily: '"Plus Jakarta Sans", sans-serif',
                  fontWeight: 800,
                  color: '#FFFFFF',
                  lineHeight: 1.2, 
                  fontSize: { xs: '1.3rem', sm: '1.65rem', md: '1.8rem' } 
                }}
              >
                {obtenerSaludo()}, {nombreAMostrar}
              </Typography>
              
              <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap' }}>
                <Typography variant="body2" sx={{ color: 'rgba(241, 250, 238, 0.85)', fontSize: '0.86rem' }}>
                  Portal Central de Gestión e Intranet Institucional
                </Typography>
                <Chip
                  label={userRole || 'Colaborador'}
                  size="small"
                  sx={{
                    bgcolor: 'rgba(185, 47, 50, 0.9)',
                    color: '#FFFFFF',
                    fontWeight: 700,
                    fontSize: '0.7rem',
                    height: 22,
                    letterSpacing: '0.02em'
                  }}
                />
              </Box>
            </Box>
          </Box>

          {/* LADO DERECHO: FECHA Y ACCESOS RÁPIDOS AL ECOSISTEMA IIRESODH */}
          <Box 
            sx={{ 
              display: 'flex', 
              flexDirection: 'column',
              alignItems: { xs: 'stretch', md: 'flex-end' }, 
              gap: 1.25,
              position: 'relative',
              zIndex: 1,
              alignSelf: { xs: 'stretch', md: 'center' }
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.25,
                px: 2,
                py: 0.9,
                borderRadius: 2,
                bgcolor: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(168, 218, 220, 0.25)',
                justifyContent: { xs: 'center', md: 'flex-end' }
              }}
            >
              <Calendar size={16} color="#A8DADC" />
              <Typography variant="body2" sx={{ fontWeight: 600, color: '#F1FAEE', fontSize: '0.82rem' }}>
                {fechaCapitalizada}
              </Typography>
            </Box>

            {/* Enlaces rápidos al ecosistema oficial IIRESODH */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: { xs: 'center', md: 'flex-end' }, gap: 1 }}>
              <Button
                component="a"
                href="https://iiresodh.org"
                target="_blank"
                rel="noopener noreferrer"
                size="small"
                startIcon={<Building2 size={13} />}
                endIcon={<ExternalLink size={11} />}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.73rem',
                  fontWeight: 600,
                  color: '#A8DADC',
                  bgcolor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(168, 218, 220, 0.18)',
                  borderRadius: 1.5,
                  px: 1.25,
                  py: 0.35,
                  '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.12)', color: '#FFFFFF' }
                }}
              >
                Portal iiresodh.org
              </Button>
              <Button
                component="a"
                href="https://iiresodh-cursos-lms.web.app"
                target="_blank"
                rel="noopener noreferrer"
                size="small"
                startIcon={<GraduationCap size={14} />}
                endIcon={<ExternalLink size={11} />}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.73rem',
                  fontWeight: 600,
                  color: '#A8DADC',
                  bgcolor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(168, 218, 220, 0.18)',
                  borderRadius: 1.5,
                  px: 1.25,
                  py: 0.35,
                  '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.12)', color: '#FFFFFF' }
                }}
              >
                Campus Virtual
              </Button>
            </Box>
          </Box>
        </Card>

        {/* HERRAMIENTAS INSTITUCIONALES (ESPACIO DE TRABAJO SLACK, PROYECTOS, DRIVE & CALENDARIO HÍBRIDO) */}
        <Box sx={{ mb: { xs: 4, sm: 5.5 } }}>
          <AcordeonHerramientas
            activePanel={activePanel}
            onPanelChange={setActivePanel}
            userRole={userRole}
            userName={nombreAMostrar}
          />
        </Box>

        {/* ENCABEZADO DE MÓDULOS OPERATIVOS */}
        <Box
          sx={{
            mb: { xs: 2.5, sm: 3.5 },
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: { xs: 'flex-start', sm: 'flex-end' },
            justifyContent: 'space-between',
            gap: 1.5,
            borderBottom: '1px solid #E2E8F0',
            pb: 2
          }}
        >
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <Box sx={{ width: 18, height: 4, borderRadius: 1, bgcolor: '#B92F32' }} />
              <Typography
                sx={{
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  letterSpacing: '0.09em',
                  color: '#B92F32',
                  textTransform: 'uppercase'
                }}
              >
                ÁREAS DE GESTIÓN
              </Typography>
            </Box>
            <Typography
              variant="h5"
              sx={{
                fontFamily: '"Plus Jakarta Sans", sans-serif',
                fontWeight: 800,
                color: '#1D3557',
                fontSize: { xs: '1.25rem', sm: '1.5rem' }
              }}
            >
              Módulos Operativos Institucionales
            </Typography>
          </Box>
          <Typography variant="body2" sx={{ color: '#475569', fontSize: { xs: '0.84rem', sm: '0.9rem' } }}>
            Seleccione el área operativa a la que desea ingresar según sus permisos asignados
          </Typography>
        </Box>

        {/* REJILLA DE MÓDULOS DE NEGOCIO */}
        <Box sx={{ 
          display: 'grid', 
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, 
          gap: { xs: 2.5, sm: 3 }, 
          mb: { xs: 4, sm: 6 } 
        }}>
          
          {/* MÓDULO 1: GESTIÓN DE LITIGIOS */}
          <Card
            elevation={0}
            sx={{ 
              borderRadius: '0 0 12px 12px', 
              border: '1px solid #DCE4EE',
              borderTop: tieneAccesoLitigio ? '4px solid #1D3557' : '4px solid #CBD5E1',
              bgcolor: '#FFFFFF',
              boxShadow: '0 4px 18px rgba(29, 53, 87, 0.04)', 
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              transition: 'all 0.22s ease',
              ...(!tieneAccesoLitigio && { opacity: 0.7, bgcolor: '#F8FAFC' }),
              '&:hover': tieneAccesoLitigio ? { 
                borderColor: '#457B9D',
                borderTopColor: '#B92F32',
                transform: 'translateY(-3px)',
                boxShadow: '0 12px 28px rgba(29, 53, 87, 0.10)' 
              } : {}
            }}
          >
            <CardContent sx={{ p: 3, display: 'flex', flexDirection: 'column', height: '100%' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.25 }}>
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: 2.25,
                    bgcolor: tieneAccesoLitigio ? 'rgba(29, 53, 87, 0.07)' : '#F1F5F9',
                    color: tieneAccesoLitigio ? '#1D3557' : '#94A3B8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Scale size={24} />
                </Box>
                <Chip
                  label={tieneAccesoLitigio ? 'Área Jurídica' : 'Restringido'}
                  size="small"
                  sx={{
                    bgcolor: tieneAccesoLitigio ? 'rgba(29, 53, 87, 0.07)' : '#F1F5F9',
                    color: tieneAccesoLitigio ? '#1D3557' : '#64748B',
                    fontWeight: 700,
                    fontSize: '0.7rem',
                    height: 23
                  }}
                />
              </Box>

              <Typography variant="h6" sx={{ fontWeight: 800, color: '#1D3557', mb: 1, fontSize: '1.1rem' }}>
                Gestión de Litigios
              </Typography>
              <Typography variant="body2" sx={{ color: '#475569', lineHeight: 1.6, mb: 3, flex: 1 }}>
                Control de expedientes nacionales e internacionales, registro de representados, plazos procesales y actuaciones.
              </Typography>
              
              <Button 
                variant={tieneAccesoLitigio ? "contained" : "outlined"} 
                fullWidth 
                disabled={!tieneAccesoLitigio}
                endIcon={tieneAccesoLitigio ? <ArrowRight size={16} /> : <Lock size={15} />}
                onClick={() => setView('casos')} 
                sx={{ 
                  textTransform: 'none', 
                  fontWeight: 700, 
                  py: 1.15,
                  borderRadius: 2,
                  ...(tieneAccesoLitigio && { bgcolor: '#1D3557', '&:hover': { bgcolor: '#122238' } }),
                  ...(!tieneAccesoLitigio && { color: '#B92F32', borderColor: 'rgba(185, 47, 50, 0.35)' })
                }}
              >
                {tieneAccesoLitigio ? "Ingresar a Litigios" : "Acceso Restringido"}
              </Button>
            </CardContent>
          </Card>

          {/* MÓDULO 2: CENTRO DE RECURSOS INSTITUCIONALES */}
          <Card
            elevation={0}
            sx={{ 
              borderRadius: '0 0 12px 12px', 
              border: '1px solid #DCE4EE',
              borderTop: '4px solid #1D3557',
              bgcolor: '#FFFFFF',
              boxShadow: '0 4px 18px rgba(29, 53, 87, 0.04)', 
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              transition: 'all 0.22s ease',
              '&:hover': { 
                borderColor: '#457B9D', 
                borderTopColor: '#B92F32',
                transform: 'translateY(-3px)',
                boxShadow: '0 12px 28px rgba(29, 53, 87, 0.10)' 
              }
            }}
          >
            <CardContent sx={{ p: 3, display: 'flex', flexDirection: 'column', height: '100%' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.25 }}>
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: 2.25,
                    bgcolor: 'rgba(69, 123, 157, 0.10)',
                    color: '#1D3557',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <FolderArchive size={24} />
                </Box>
                <Chip
                  label="Normativa & Marca"
                  size="small"
                  sx={{
                    bgcolor: 'rgba(69, 123, 157, 0.10)',
                    color: '#1D3557',
                    fontWeight: 700,
                    fontSize: '0.7rem',
                    height: 23
                  }}
                />
              </Box>

              <Typography variant="h6" sx={{ fontWeight: 800, color: '#1D3557', mb: 1, fontSize: '1.1rem' }}>
                Centro de Recursos Institucionales
              </Typography>
              <Typography variant="body2" sx={{ color: '#475569', lineHeight: 1.6, mb: 3, flex: 1 }}>
                Reglamentos y normativas internas, manuales operativos, logotipos oficiales y plantillas de identidad visual.
              </Typography>
              
              <Button 
                variant="contained" 
                fullWidth 
                endIcon={<ArrowRight size={16} />}
                onClick={() => setView('recursos_institucionales')} 
                sx={{ 
                  textTransform: 'none', 
                  fontWeight: 700, 
                  py: 1.15,
                  borderRadius: 2,
                  bgcolor: '#1D3557',
                  '&:hover': { bgcolor: '#122238' }
                }}
              >
                Acceder a Recursos
              </Button>
            </CardContent>
          </Card>

          {/* MÓDULO 3: ADMINISTRACIÓN DEL SITIO WEB */}
          <Card
            elevation={0}
            sx={{ 
              borderRadius: '0 0 12px 12px', 
              border: '1px solid #DCE4EE',
              borderTop: tieneAccesoWeb ? '4px solid #457B9D' : '4px solid #CBD5E1',
              bgcolor: '#FFFFFF',
              boxShadow: '0 4px 18px rgba(29, 53, 87, 0.04)', 
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              transition: 'all 0.22s ease',
              ...(!tieneAccesoWeb && { opacity: 0.7, bgcolor: '#F8FAFC' }),
              '&:hover': tieneAccesoWeb ? { 
                borderColor: '#457B9D', 
                borderTopColor: '#B92F32',
                transform: 'translateY(-3px)',
                boxShadow: '0 12px 28px rgba(29, 53, 87, 0.10)' 
              } : {}
            }}
          >
            <CardContent sx={{ p: 3, display: 'flex', flexDirection: 'column', height: '100%' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.25 }}>
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: 2.25,
                    bgcolor: tieneAccesoWeb ? 'rgba(69, 123, 157, 0.10)' : '#F1F5F9',
                    color: tieneAccesoWeb ? '#457B9D' : '#94A3B8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Globe size={24} />
                </Box>
                <Chip
                  label={tieneAccesoWeb ? 'Portal Público' : 'Restringido'}
                  size="small"
                  sx={{
                    bgcolor: tieneAccesoWeb ? 'rgba(69, 123, 157, 0.10)' : '#F1F5F9',
                    color: tieneAccesoWeb ? '#1D3557' : '#64748B',
                    fontWeight: 700,
                    fontSize: '0.7rem',
                    height: 23
                  }}
                />
              </Box>

              <Typography variant="h6" sx={{ fontWeight: 800, color: '#1D3557', mb: 1, fontSize: '1.1rem' }}>
                Administración Sitio Web
              </Typography>
              <Typography variant="body2" sx={{ color: '#475569', lineHeight: 1.6, mb: 3, flex: 1 }}>
                Gestión editorial, actualización de publicaciones, programas académicos y contenidos del portal público.
              </Typography>
              
              <Button 
                variant={tieneAccesoWeb ? "contained" : "outlined"} 
                fullWidth 
                disabled={!tieneAccesoWeb}
                endIcon={tieneAccesoWeb ? <ArrowRight size={16} /> : <Lock size={15} />}
                onClick={() => setView('sitio_web')} 
                sx={{ 
                  textTransform: 'none', 
                  fontWeight: 700, 
                  py: 1.15,
                  borderRadius: 2,
                  ...(tieneAccesoWeb && { bgcolor: '#1D3557', '&:hover': { bgcolor: '#122238' } }),
                  ...(!tieneAccesoWeb && { color: '#B92F32', borderColor: 'rgba(185, 47, 50, 0.35)' })
                }}
              >
                {tieneAccesoWeb ? "Administrar Sitio" : "Acceso Restringido"}
              </Button>
            </CardContent>
          </Card>

          {/* MÓDULO 4: WHATSAPP INSTITUCIONAL */}
          <Card
            elevation={0}
            sx={{ 
              borderRadius: '0 0 12px 12px', 
              border: '1px solid #DCE4EE',
              borderTop: tieneAccesoWhatsapp ? '4px solid #457B9D' : '4px solid #CBD5E1',
              bgcolor: '#FFFFFF',
              boxShadow: '0 4px 18px rgba(29, 53, 87, 0.04)', 
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              transition: 'all 0.22s ease',
              ...(!tieneAccesoWhatsapp && { opacity: 0.7, bgcolor: '#F8FAFC' }),
              '&:hover': tieneAccesoWhatsapp ? { 
                borderColor: '#457B9D', 
                borderTopColor: '#B92F32',
                transform: 'translateY(-3px)',
                boxShadow: '0 12px 28px rgba(29, 53, 87, 0.10)' 
              } : {}
            }}
          >
            <CardContent sx={{ p: 3, display: 'flex', flexDirection: 'column', height: '100%' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.25 }}>
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: 2.25,
                    bgcolor: tieneAccesoWhatsapp ? 'rgba(29, 53, 87, 0.07)' : '#F1F5F9',
                    color: tieneAccesoWhatsapp ? '#1D3557' : '#94A3B8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <MessageCircle size={24} />
                </Box>
                <Chip
                  label={tieneAccesoWhatsapp ? 'Canal Oficial' : 'Restringido'}
                  size="small"
                  sx={{
                    bgcolor: tieneAccesoWhatsapp ? 'rgba(29, 53, 87, 0.07)' : '#F1F5F9',
                    color: tieneAccesoWhatsapp ? '#1D3557' : '#64748B',
                    fontWeight: 700,
                    fontSize: '0.7rem',
                    height: 23
                  }}
                />
              </Box>

              <Typography variant="h6" sx={{ fontWeight: 800, color: '#1D3557', mb: 1, fontSize: '1.1rem' }}>
                Atención & WhatsApp Business
              </Typography>
              <Typography variant="body2" sx={{ color: '#475569', lineHeight: 1.6, mb: 3, flex: 1 }}>
                Bandeja centralizada de comunicación oficial vía WhatsApp Business API para atención a usuarios y casos.
              </Typography>
              
              <Button 
                variant={tieneAccesoWhatsapp ? "contained" : "outlined"} 
                fullWidth 
                disabled={!tieneAccesoWhatsapp}
                endIcon={tieneAccesoWhatsapp ? <ArrowRight size={16} /> : <Lock size={15} />}
                onClick={() => setView('whatsapp')} 
                sx={{ 
                  textTransform: 'none', 
                  fontWeight: 700, 
                  py: 1.15,
                  borderRadius: 2,
                  ...(tieneAccesoWhatsapp && { bgcolor: '#1D3557', '&:hover': { bgcolor: '#122238' } }),
                  ...(!tieneAccesoWhatsapp && { color: '#B92F32', borderColor: 'rgba(185, 47, 50, 0.35)' })
                }}
              >
                {tieneAccesoWhatsapp ? "Abrir Bandeja" : "Acceso Restringido"}
              </Button>
            </CardContent>
          </Card>

          {/* MÓDULO 5: RECURSOS HUMANOS (EN DESARROLLO) */}
          <Card
            elevation={0}
            sx={{ 
              borderRadius: '0 0 12px 12px', 
              bgcolor: '#F8FAF8', 
              border: '1px dashed #CBD5E1', 
              borderTop: '4px solid #CBD5E1',
              boxShadow: 'none' 
            }}
          >
            <CardContent sx={{ p: 3, display: 'flex', flexDirection: 'column', height: '100%', opacity: 0.78 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.25 }}>
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: 2.25,
                    bgcolor: '#E2E8F0',
                    color: '#64748B',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Users size={24} />
                </Box>
                <Chip
                  label="Próximamente"
                  size="small"
                  sx={{
                    bgcolor: '#E2E8F0',
                    color: '#475569',
                    fontWeight: 700,
                    fontSize: '0.68rem',
                    height: 22
                  }}
                />
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#475569', mb: 1, fontSize: '1.1rem' }}>
                Talento & Recursos Humanos
              </Typography>
              <Typography variant="body2" sx={{ color: '#64748B', lineHeight: 1.6, mb: 3, flex: 1 }}>
                Gestión de expedientes de personal, directorio interno, solicitudes de vacaciones y perfiles institucionales.
              </Typography>
              <Button variant="outlined" disabled fullWidth sx={{ textTransform: 'none', borderRadius: 2, py: 1.1 }}>
                En Desarrollo
              </Button>
            </CardContent>
          </Card>

          {/* MÓDULO 6: FINANZAS (EN DESARROLLO) */}
          <Card
            elevation={0}
            sx={{ 
              borderRadius: '0 0 12px 12px', 
              bgcolor: '#F8FAF8', 
              border: '1px dashed #CBD5E1', 
              borderTop: '4px solid #CBD5E1',
              boxShadow: 'none' 
            }}
          >
            <CardContent sx={{ p: 3, display: 'flex', flexDirection: 'column', height: '100%', opacity: 0.78 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.25 }}>
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: 2.25,
                    bgcolor: '#E2E8F0',
                    color: '#64748B',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <FileSpreadsheet size={24} />
                </Box>
                <Chip
                  label="Próximamente"
                  size="small"
                  sx={{
                    bgcolor: '#E2E8F0',
                    color: '#475569',
                    fontWeight: 700,
                    fontSize: '0.68rem',
                    height: 22
                  }}
                />
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#475569', mb: 1, fontSize: '1.1rem' }}>
                Finanzas & Presupuesto
              </Typography>
              <Typography variant="body2" sx={{ color: '#64748B', lineHeight: 1.6, mb: 3, flex: 1 }}>
                Ejecución presupuestaria de proyectos, conciliación de pasarelas de pago y reportes financieros institucionales.
              </Typography>
              <Button variant="outlined" disabled fullWidth sx={{ textTransform: 'none', borderRadius: 2, py: 1.1 }}>
                En Desarrollo
              </Button>
            </CardContent>
          </Card>
        </Box>

        {/* ACCESOS DIRECTOS ADMINISTRATIVOS Y GOBERNANZA */}
        {(userRole === 'Superadmin' || userRole === 'Admin') && (
          <Card
            elevation={0}
            sx={{
              p: { xs: 2.5, sm: 3 },
              mb: 4,
              borderRadius: '0 12px 12px 0',
              bgcolor: '#FFFFFF',
              border: '1px solid #DCE4EE',
              borderLeft: '4px solid #1D3557',
              display: 'flex',
              flexDirection: { xs: 'column', md: 'row' },
              alignItems: { xs: 'flex-start', md: 'center' },
              justifyContent: 'space-between',
              gap: 2
            }}
          >
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#1D3557' }}>
                Gobernanza y Seguridad Perimetral del Sistema
              </Typography>
              <Typography variant="body2" sx={{ color: '#475569', fontSize: '0.84rem' }}>
                Administración de cuentas institucionales autorizadas (@iiresodh.org) y auditoría de eventos de seguridad.
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
              <Button 
                variant="outlined" 
                startIcon={<ShieldCheck size={16} />} 
                onClick={() => setView('usuarios')}
                sx={{
                  textTransform: 'none',
                  borderRadius: 2,
                  fontWeight: 700,
                  borderColor: '#1D3557',
                  color: '#1D3557',
                  '&:hover': { bgcolor: 'rgba(29, 53, 87, 0.05)', borderColor: '#122238' }
                }}
              >
                Control de Usuarios Autorizados
              </Button>
              
              {userRole === 'Superadmin' && (
                <Button 
                  variant="outlined" 
                  startIcon={<Activity size={16} />} 
                  onClick={() => setView('logs')}
                  sx={{
                    textTransform: 'none',
                    borderRadius: 2,
                    fontWeight: 700,
                    borderColor: '#457B9D',
                    color: '#1D3557',
                    '&:hover': { bgcolor: 'rgba(69, 123, 157, 0.08)', borderColor: '#1D3557' }
                  }}
                >
                  Bitácora de Auditoría (Logs)
                </Button>
              )}
            </Box>
          </Card>
        )}

        {/* PIE DE PÁGINA INSTITUCIONAL */}
        <Divider sx={{ mb: 2.5, borderColor: '#E2E8F0' }} />
        <Box
          sx={{
            pb: 2,
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1.5
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <Box
              component="img"
              src="/iiresodh-isotipo-blue.png"
              alt="IIRESODH"
              sx={{ height: 22, width: 'auto', opacity: 0.85 }}
            />
            <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569' }}>
              IIRESODH — Instituto Internacional de Responsabilidad Social y Derechos Humanos
            </Typography>
          </Box>
          <Typography sx={{ fontSize: '0.75rem', color: '#64748B' }}>
            Acceso confidencial exclusivo para miembros de la institución
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
