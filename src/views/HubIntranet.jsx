// src/views/HubIntranet.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography, Card, CardContent, Button, Divider, Avatar, Chip, Snackbar, Alert } from '@mui/material';
import { 
  Scale, Users, ShieldCheck, FileSpreadsheet, Activity, 
  Globe, MessageCircle, FolderArchive, Calendar, ArrowRight,
  Lock, ExternalLink, Building2, GraduationCap
} from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import AcordeonHerramientas from '../components/AcordeonHerramientas';

function playWhatsappChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    osc1.type = 'sine';
    osc2.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    osc2.frequency.setValueAtTime(880, now + 0.11); // A5
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.12);
    osc2.start(now + 0.11);
    osc2.stop(now + 0.35);
  } catch (e) {
    // Ignorar si el navegador bloquea autoplay de audio antes de interacción
  }
}

export default function HubIntranet({ setView, userRole, userPermisos, user: propUser, userName }) {
  const { user: authUser } = useAuth();
  const currentUser = propUser || authUser;

  // Asegurar que la página del Hub siempre inicie en la parte superior al entrar
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, []);

  // Estado del panel activo en AcordeonHerramientas ('chat' | 'calendario' | false)
  const [activePanel, setActivePanel] = useState('chat');

  // CONTROL PERIMETRAL: Roles autorizados para cada sección
  const tieneAccesoLitigio = userRole !== 'Invitado';
  const tieneAccesoWeb = userRole === 'Superadmin' || userPermisos?.web === true;
  const tieneAccesoWhatsapp = userRole === 'Superadmin' || userPermisos?.whatsapp === true;

  // Telemetría en tiempo real de WhatsApp Institucional (solo para usuarios con permiso activo)
  const [whatsappSinLeer, setWhatsappSinLeer] = useState(0);
  const [alertaWhatsappReciente, setAlertaWhatsappReciente] = useState(null);
  const prevUnreadByChatRef = useRef(null);

  useEffect(() => {
    if (!tieneAccesoWhatsapp) {
      setWhatsappSinLeer(0);
      prevUnreadByChatRef.current = null;
      return;
    }

    const chatsRef = collection(db, 'whatsapp_chats');
    const unsubscribe = onSnapshot(
      chatsRef,
      (snapshot) => {
        let totalUnread = 0;
        const nextMap = {};
        let chatConNuevoMensaje = null;

        snapshot.docs.forEach((docSnap) => {
          const data = docSnap.data() || {};
          const count = Number(data.no_leidos) || 0;
          totalUnread += count;
          nextMap[docSnap.id] = count;

          if (prevUnreadByChatRef.current !== null) {
            const prevCount = prevUnreadByChatRef.current[docSnap.id] || 0;
            if (count > prevCount) {
              chatConNuevoMensaje = {
                id: docSnap.id,
                nombre: data.nombre || `+${data.telefono || docSnap.id}`,
                ultimo_mensaje: data.ultimo_mensaje || 'Nuevo mensaje recibido'
              };
            }
          }
        });

        prevUnreadByChatRef.current = nextMap;
        setWhatsappSinLeer(totalUnread);

        if (chatConNuevoMensaje) {
          playWhatsappChime();
          setAlertaWhatsappReciente(chatConNuevoMensaje);
        }
      },
      (err) => {
        console.warn('Error escuchando estado de WhatsApp Institucional:', err);
      }
    );

    return () => unsubscribe();
  }, [tieneAccesoWhatsapp]);

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
    <Box sx={{ position: 'relative', minHeight: 'calc(100vh - 120px)', py: 0.5 }}>
      {/* FONDO INSTITUCIONAL SOBRIO: Lienzo técnico #f8fafc con retícula sutil */}
      <Box
        sx={{
          position: 'fixed',
          top: 60,
          left: 0,
          right: 0,
          bottom: 0,
          bgcolor: '#f8fafc',
          backgroundImage: 'radial-gradient(rgba(15, 23, 42, 0.045) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
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
          width: { xs: 260, md: 420 },
          height: 'auto',
          opacity: 0.018,
          pointerEvents: 'none',
          userSelect: 'none',
          zIndex: 0
        }}
      />

      {/* CONTENIDO DEL HUB */}
      <Box sx={{ position: 'relative', zIndex: 1, maxWidth: 1280, mx: 'auto', p: { xs: 0.5, sm: 1.5, md: 1.5 }, mt: { xs: 0, md: 0.5 } }}>
        
        {/* BANNER EJECUTIVO DE COMANDO INSTITUCIONAL (CON BARRA LATERAL DE RADIO CERO) */}
        <Card
          elevation={0}
          sx={{
            borderRadius: '0 12px 12px 0',
            bgcolor: '#ffffff',
            color: '#0f172a',
            border: '1px solid #e2e8f0',
            borderLeft: '3px solid #0f172a',
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)',
            p: { xs: 2.25, sm: 3, md: 3.5 },
            mb: { xs: 3, sm: 3.5 },
            display: 'flex',
            flexDirection: { xs: 'column', lg: 'row' },
            alignItems: { xs: 'flex-start', lg: 'center' },
            justifyContent: 'space-between',
            gap: { xs: 2.5, sm: 3 },
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          {/* LADO IZQUIERDO: AVATAR E IDENTIDAD EJECUTIVA */}
          <Box sx={{ display: 'flex', alignItems: { xs: 'flex-start', sm: 'center' }, gap: { xs: 2, sm: 2.5 }, position: 'relative', zIndex: 1 }}>
            <Avatar
              src={currentUser?.photoURL}
              alt={nombreAMostrar}
              referrerPolicy="no-referrer"
              sx={{
                width: { xs: 52, sm: 60 },
                height: { xs: 52, sm: 60 },
                borderRadius: '12px',
                bgcolor: '#0f172a',
                color: '#ffffff',
                fontSize: { xs: '1.25rem', sm: '1.45rem' },
                fontFamily: '"Plus Jakarta Sans", sans-serif',
                fontWeight: 800,
                border: '1px solid #e2e8f0',
                boxShadow: '0 2px 6px rgba(15, 23, 42, 0.08)'
              }}
            >
              {inicial}
            </Avatar>

            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
                <Typography
                  sx={{
                    fontSize: '0.66rem',
                    fontWeight: 800,
                    letterSpacing: '0.09em',
                    textTransform: 'uppercase',
                    color: '#b91c1c'
                  }}
                >
                  IIRESODH · PORTAL CENTRAL DE OPERACIONES
                </Typography>
                <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: '#cbd5e1', display: { xs: 'none', sm: 'block' } }} />
                <Typography
                  sx={{
                    display: { xs: 'none', sm: 'block' },
                    fontSize: '0.66rem',
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: '#64748b'
                  }}
                >
                  Instituto Internacional de Responsabilidad Social y Derechos Humanos
                </Typography>
              </Box>

              <Typography 
                variant="h4" 
                sx={{ 
                  fontFamily: '"Plus Jakarta Sans", sans-serif',
                  fontWeight: 800,
                  color: '#0f172a',
                  letterSpacing: '-0.025em',
                  lineHeight: 1.15, 
                  fontSize: { xs: '1.25rem', sm: '1.55rem', md: '1.7rem' } 
                }}
              >
                {obtenerSaludo()}, {nombreAMostrar}
              </Typography>
              
              <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Chip
                  label={userRole || 'Colaborador'}
                  size="small"
                  sx={{
                    bgcolor: '#0f172a',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.68rem',
                    height: 22,
                    borderRadius: '6px',
                    letterSpacing: '0.02em'
                  }}
                />
                <Box
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.75,
                    px: 1.25,
                    py: 0.3,
                    borderRadius: '6px',
                    bgcolor: '#f8fafc',
                    border: '1px solid #e2e8f0'
                  }}
                >
                  <Calendar size={12} color="#64748b" />
                  <Typography sx={{ fontWeight: 600, color: '#475569', fontSize: '0.74rem', fontVariantNumeric: 'tabular-nums' }}>
                    {fechaCapitalizada}
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Box>

          {/* LADO DERECHO: TELEMETRÍA WHATSAPP Y ACCESOS RÁPIDOS AL ECOSISTEMA */}
          <Box 
            sx={{ 
              display: 'flex', 
              flexDirection: 'column',
              alignItems: { xs: 'stretch', lg: 'flex-end' }, 
              gap: 1.25,
              position: 'relative',
              zIndex: 1,
              alignSelf: { xs: 'stretch', lg: 'center' }
            }}
          >
            {/* Indicador en tiempo real de WhatsApp Institucional (exclusivo para usuarios con permiso) */}
            {tieneAccesoWhatsapp && (
              <Button
                onClick={() => setView('whatsapp')}
                size="small"
                sx={{
                  textTransform: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: { xs: 'space-between', lg: 'flex-end' },
                  gap: 1.25,
                  px: 1.75,
                  py: 0.75,
                  borderRadius: '0 8px 8px 0',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  color: '#0f172a',
                  bgcolor: whatsappSinLeer > 0 ? '#f0fdf4' : '#f8fafc',
                  border: whatsappSinLeer > 0
                    ? '1px solid #bbf7d0'
                    : '1px solid #e2e8f0',
                  borderLeft: whatsappSinLeer > 0
                    ? '3px solid #10b981'
                    : '3px solid #0f766e',
                  transition: 'all 0.15s ease',
                  '&:hover': {
                    bgcolor: whatsappSinLeer > 0 ? '#dcfce7' : '#f1f5f9',
                    borderColor: '#94a3b8'
                  }
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', color: '#0f766e' }}>
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path d="M12.031 2C6.508 2 2.023 6.484 2.023 12.006c0 1.766.461 3.49 1.337 5.011L2 22l5.122-1.343a9.969 9.969 0 0 0 4.906 1.298h.004c5.522 0 10.007-4.484 10.007-10.006C22.039 6.484 17.553 2 12.031 2zm5.847 14.28c-.244.688-1.425 1.318-1.972 1.399-.506.075-1.147.107-1.856-.118-.429-.136-.979-.318-1.682-.622-2.961-1.278-4.894-4.262-5.042-4.459-.148-.197-1.205-1.603-1.205-3.058 0-1.455.762-2.171 1.033-2.467.271-.296.591-.37.788-.37.197 0 .394.002.567.01.182.009.426-.069.667.509.246.592.838 2.047.912 2.195.074.148.123.321.025.518-.099.197-.148.321-.296.493-.148.173-.311.386-.444.518-.148.148-.302.309-.13.605.173.296.766 1.264 1.645 2.048 1.13 1.008 2.083 1.32 2.379 1.468.296.148.469.123.641-.074.173-.197.74-.863.937-1.159.197-.296.395-.247.666-.148.271.099 1.726.814 2.022.962.296.148.493.222.567.345.075.124.075.716-.169 1.404z" />
                    </svg>
                    {whatsappSinLeer > 0 && (
                      <Box
                        sx={{
                          position: 'absolute',
                          top: -2,
                          right: -2,
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          bgcolor: '#10b981',
                          boxShadow: '0 0 0 2px #ffffff'
                        }}
                      />
                    )}
                  </Box>
                  <Typography component="span" sx={{ fontSize: '0.75rem', fontWeight: 800, color: '#0f172a' }}>
                    WhatsApp Business
                  </Typography>
                </Box>
                <Chip
                  size="small"
                  label={
                    whatsappSinLeer === 1
                      ? '1 sin leer'
                      : `${whatsappSinLeer} sin leer`
                  }
                  sx={{
                    height: 20,
                    fontSize: '0.67rem',
                    fontWeight: 800,
                    fontVariantNumeric: 'tabular-nums',
                    borderRadius: '5px',
                    bgcolor: whatsappSinLeer > 0 ? '#10b981' : '#e2e8f0',
                    color: whatsappSinLeer > 0 ? '#ffffff' : '#475569',
                    '& .MuiChip-label': { px: 1 }
                  }}
                />
              </Button>
            )}

            {/* Enlaces rápidos al ecosistema oficial IIRESODH */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: { xs: 'flex-start', lg: 'flex-end' }, gap: 1, flexWrap: 'wrap' }}>
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
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: '#334155',
                  bgcolor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '7px',
                  px: 1.25,
                  py: 0.4,
                  '&:hover': { bgcolor: '#f1f5f9', color: '#0f172a', borderColor: '#cbd5e1' }
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
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: '#334155',
                  bgcolor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '7px',
                  px: 1.25,
                  py: 0.4,
                  '&:hover': { bgcolor: '#f1f5f9', color: '#0f172a', borderColor: '#cbd5e1' }
                }}
              >
                Campus Virtual
              </Button>
            </Box>
          </Box>
        </Card>

        {/* HERRAMIENTAS INSTITUCIONALES (ESPACIO DE TRABAJO SLACK, PROYECTOS, DRIVE & CALENDARIO HÍBRIDO) */}
        <Box sx={{ mb: { xs: 3.5, sm: 4.5 } }}>
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
            mb: { xs: 2.25, sm: 3 },
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: { xs: 'flex-start', sm: 'flex-end' },
            justifyContent: 'space-between',
            gap: 1.5,
            borderBottom: '1px solid #e2e8f0',
            pb: 1.75
          }}
        >
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.4 }}>
              <Box sx={{ width: 14, height: 3, bgcolor: '#b91c1c' }} />
              <Typography
                sx={{
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  letterSpacing: '0.09em',
                  color: '#b91c1c',
                  textTransform: 'uppercase'
                }}
              >
                ARQUITECTURA DE SISTEMAS
              </Typography>
            </Box>
            <Typography
              variant="h5"
              sx={{
                fontFamily: '"Plus Jakarta Sans", sans-serif',
                fontWeight: 800,
                color: '#0f172a',
                letterSpacing: '-0.02em',
                fontSize: { xs: '1.18rem', sm: '1.38rem' }
              }}
            >
              Módulos Operativos Institucionales
            </Typography>
          </Box>
          <Typography variant="body2" sx={{ color: '#64748b', fontSize: '0.8rem', fontWeight: 500 }}>
            Seleccione la consola especializada según sus credenciales de acceso
          </Typography>
        </Box>

        {/* REJILLA BENTO DE MÓDULOS DE NEGOCIO (TODOS CON BARRA LATERAL IZQUIERDA Y RADIO CERO) */}
        <Box sx={{ 
          display: 'grid', 
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: '1fr 1fr 1fr' }, 
          gap: { xs: 2, sm: 2.5 }, 
          mb: { xs: 3.5, sm: 4.5 } 
        }}>
          
          {/* MÓDULO 1: GESTIÓN DE LITIGIOS */}
          <Card
            elevation={0}
            sx={{ 
              borderRadius: '0 12px 12px 0', 
              border: '1px solid #e2e8f0',
              borderLeft: tieneAccesoLitigio ? '3px solid #0f172a' : '3px solid #cbd5e1',
              bgcolor: '#ffffff',
              boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)', 
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              transition: 'all 0.18s ease',
              ...(!tieneAccesoLitigio && { opacity: 0.72, bgcolor: '#f8fafc' }),
              '&:hover': tieneAccesoLitigio ? { 
                borderColor: '#94a3b8',
                borderLeftColor: '#0f172a',
                transform: 'translateY(-2px)',
                boxShadow: '0 10px 24px -8px rgba(15, 23, 42, 0.10)' 
              } : {}
            }}
          >
            <CardContent sx={{ p: 2.75, display: 'flex', flexDirection: 'column', height: '100%', '&:last-child': { pb: 2.75 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Box
                  sx={{
                    color: tieneAccesoLitigio ? '#0f172a' : '#94a3b8',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Scale size={28} strokeWidth={1.75} />
                </Box>
                <Chip
                  label={tieneAccesoLitigio ? 'Área Jurídica · Corte IDH / ONU' : 'Restringido'}
                  size="small"
                  sx={{
                    bgcolor: tieneAccesoLitigio ? '#f8fafc' : '#f1f5f9',
                    color: tieneAccesoLitigio ? '#334155' : '#64748b',
                    border: '1px solid #e2e8f0',
                    fontWeight: 700,
                    fontSize: '0.66rem',
                    borderRadius: '6px',
                    height: 22
                  }}
                />
              </Box>

              <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a', mb: 0.75, fontSize: '1.02rem', letterSpacing: '-0.015em' }}>
                Casos y Litigio Estratégico
              </Typography>
              <Typography variant="body2" sx={{ color: '#64748b', lineHeight: 1.55, mb: 2.5, flex: 1, fontSize: '0.8rem' }}>
                Control de expedientes nacionales e internacionales, ruta procesal, registro de representados, plazos y acervo probatorio.
              </Typography>
              
              <Button 
                variant={tieneAccesoLitigio ? "contained" : "outlined"} 
                fullWidth 
                disabled={!tieneAccesoLitigio}
                endIcon={tieneAccesoLitigio ? <ArrowRight size={15} /> : <Lock size={14} />}
                onClick={() => setView('casos')} 
                sx={{ 
                  textTransform: 'none', 
                  fontWeight: 700, 
                  fontSize: '0.8rem',
                  py: 1,
                  borderRadius: '8px',
                  boxShadow: 'none',
                  ...(tieneAccesoLitigio && { bgcolor: '#0f172a', '&:hover': { bgcolor: '#1e293b', boxShadow: 'none' } }),
                  ...(!tieneAccesoLitigio && { color: '#b91c1c', borderColor: '#fecaca' })
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
              borderRadius: '0 12px 12px 0', 
              border: '1px solid #e2e8f0',
              borderLeft: '3px solid #b91c1c',
              bgcolor: '#ffffff',
              boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)', 
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              transition: 'all 0.18s ease',
              '&:hover': { 
                borderColor: '#94a3b8', 
                borderLeftColor: '#b91c1c',
                transform: 'translateY(-2px)',
                boxShadow: '0 10px 24px -8px rgba(15, 23, 42, 0.10)' 
              }
            }}
          >
            <CardContent sx={{ p: 2.75, display: 'flex', flexDirection: 'column', height: '100%', '&:last-child': { pb: 2.75 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Box
                  sx={{
                    color: '#b91c1c',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <FolderArchive size={28} strokeWidth={1.75} />
                </Box>
                <Chip
                  label="Normativa & Identidad"
                  size="small"
                  sx={{
                    bgcolor: '#f8fafc',
                    color: '#334155',
                    border: '1px solid #e2e8f0',
                    fontWeight: 700,
                    fontSize: '0.66rem',
                    borderRadius: '6px',
                    height: 22
                  }}
                />
              </Box>

              <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a', mb: 0.75, fontSize: '1.02rem', letterSpacing: '-0.015em' }}>
                Centro de Recursos Institucionales
              </Typography>
              <Typography variant="body2" sx={{ color: '#64748b', lineHeight: 1.55, mb: 2.5, flex: 1, fontSize: '0.8rem' }}>
                Reglamentos y normativas internas vigentes, manuales operativos, logotipos oficiales y plantillas de identidad visual.
              </Typography>
              
              <Button 
                variant="contained" 
                fullWidth 
                endIcon={<ArrowRight size={15} />}
                onClick={() => setView('recursos_institucionales')} 
                sx={{ 
                  textTransform: 'none', 
                  fontWeight: 700, 
                  fontSize: '0.8rem',
                  py: 1,
                  borderRadius: '8px',
                  boxShadow: 'none',
                  bgcolor: '#0f172a',
                  '&:hover': { bgcolor: '#1e293b', boxShadow: 'none' }
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
              borderRadius: '0 12px 12px 0', 
              border: '1px solid #e2e8f0',
              borderLeft: tieneAccesoWeb ? '3px solid #0369a1' : '3px solid #cbd5e1',
              bgcolor: '#ffffff',
              boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)', 
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              transition: 'all 0.18s ease',
              ...(!tieneAccesoWeb && { opacity: 0.72, bgcolor: '#f8fafc' }),
              '&:hover': tieneAccesoWeb ? { 
                borderColor: '#94a3b8', 
                borderLeftColor: '#0369a1',
                transform: 'translateY(-2px)',
                boxShadow: '0 10px 24px -8px rgba(15, 23, 42, 0.10)' 
              } : {}
            }}
          >
            <CardContent sx={{ p: 2.75, display: 'flex', flexDirection: 'column', height: '100%', '&:last-child': { pb: 2.75 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Box
                  sx={{
                    color: tieneAccesoWeb ? '#0369a1' : '#94a3b8',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Globe size={28} strokeWidth={1.75} />
                </Box>
                <Chip
                  label={tieneAccesoWeb ? 'Portal Público · CMS' : 'Restringido'}
                  size="small"
                  sx={{
                    bgcolor: tieneAccesoWeb ? '#f8fafc' : '#f1f5f9',
                    color: tieneAccesoWeb ? '#334155' : '#64748b',
                    border: '1px solid #e2e8f0',
                    fontWeight: 700,
                    fontSize: '0.66rem',
                    borderRadius: '6px',
                    height: 22
                  }}
                />
              </Box>

              <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a', mb: 0.75, fontSize: '1.02rem', letterSpacing: '-0.015em' }}>
                Administración Sitio Web
              </Typography>
              <Typography variant="body2" sx={{ color: '#64748b', lineHeight: 1.55, mb: 2.5, flex: 1, fontSize: '0.8rem' }}>
                Consola editorial multilingüe (ES/EN/FR), comunicados, biblioteca digital, cursos y contenidos de iiresodh.org.
              </Typography>
              
              <Button 
                variant={tieneAccesoWeb ? "contained" : "outlined"} 
                fullWidth 
                disabled={!tieneAccesoWeb}
                endIcon={tieneAccesoWeb ? <ArrowRight size={15} /> : <Lock size={14} />}
                onClick={() => setView('sitio_web')} 
                sx={{ 
                  textTransform: 'none', 
                  fontWeight: 700, 
                  fontSize: '0.8rem',
                  py: 1,
                  borderRadius: '8px',
                  boxShadow: 'none',
                  ...(tieneAccesoWeb && { bgcolor: '#0f172a', '&:hover': { bgcolor: '#1e293b', boxShadow: 'none' } }),
                  ...(!tieneAccesoWeb && { color: '#b91c1c', borderColor: '#fecaca' })
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
              borderRadius: '0 12px 12px 0', 
              border: '1px solid #e2e8f0',
              borderLeft: tieneAccesoWhatsapp ? '3px solid #0f766e' : '3px solid #cbd5e1',
              bgcolor: '#ffffff',
              boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)', 
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              transition: 'all 0.18s ease',
              ...(!tieneAccesoWhatsapp && { opacity: 0.72, bgcolor: '#f8fafc' }),
              '&:hover': tieneAccesoWhatsapp ? { 
                borderColor: '#94a3b8', 
                borderLeftColor: '#0f766e',
                transform: 'translateY(-2px)',
                boxShadow: '0 10px 24px -8px rgba(15, 23, 42, 0.10)' 
              } : {}
            }}
          >
            <CardContent sx={{ p: 2.75, display: 'flex', flexDirection: 'column', height: '100%', '&:last-child': { pb: 2.75 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Box
                  sx={{
                    color: tieneAccesoWhatsapp ? '#0f766e' : '#94a3b8',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <svg
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21" />
                    <path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1a5 5 0 0 0 5 5h1a.5.5 0 0 0 0-1h-1a.5.5 0 0 0 0 1" />
                  </svg>
                </Box>
                <Chip
                  label={tieneAccesoWhatsapp ? 'Canal Oficial · Cloud API' : 'Restringido'}
                  size="small"
                  sx={{
                    bgcolor: tieneAccesoWhatsapp ? '#f8fafc' : '#f1f5f9',
                    color: tieneAccesoWhatsapp ? '#334155' : '#64748b',
                    border: '1px solid #e2e8f0',
                    fontWeight: 700,
                    fontSize: '0.66rem',
                    borderRadius: '6px',
                    height: 22
                  }}
                />
              </Box>

              <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a', mb: 0.75, fontSize: '1.02rem', letterSpacing: '-0.015em' }}>
                Atención & WhatsApp Business
              </Typography>
              <Typography variant="body2" sx={{ color: '#64748b', lineHeight: 1.55, mb: 2.5, flex: 1, fontSize: '0.8rem' }}>
                Consola multi-operador y telefonía WebRTC vía WhatsApp Business API para atención de casos y consultas.
              </Typography>
              
              <Button 
                variant={tieneAccesoWhatsapp ? "contained" : "outlined"} 
                fullWidth 
                disabled={!tieneAccesoWhatsapp}
                endIcon={tieneAccesoWhatsapp ? <ArrowRight size={15} /> : <Lock size={14} />}
                onClick={() => setView('whatsapp')} 
                sx={{ 
                  textTransform: 'none', 
                  fontWeight: 700, 
                  fontSize: '0.8rem',
                  py: 1,
                  borderRadius: '8px',
                  boxShadow: 'none',
                  ...(tieneAccesoWhatsapp && { bgcolor: '#0f172a', '&:hover': { bgcolor: '#1e293b', boxShadow: 'none' } }),
                  ...(!tieneAccesoWhatsapp && { color: '#b91c1c', borderColor: '#fecaca' })
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
              borderRadius: '0 12px 12px 0', 
              bgcolor: '#f8fafc', 
              border: '1px dashed #cbd5e1', 
              borderLeft: '3px solid #cbd5e1',
              boxShadow: 'none' 
            }}
          >
            <CardContent sx={{ p: 2.75, display: 'flex', flexDirection: 'column', height: '100%', opacity: 0.82, '&:last-child': { pb: 2.75 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Box
                  sx={{
                    color: '#64748b',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Users size={28} strokeWidth={1.75} />
                </Box>
                <Chip
                  label="Hoja de Ruta"
                  size="small"
                  sx={{
                    bgcolor: '#ffffff',
                    color: '#64748b',
                    border: '1px solid #e2e8f0',
                    fontWeight: 700,
                    fontSize: '0.66rem',
                    borderRadius: '6px',
                    height: 22
                  }}
                />
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#334155', mb: 0.75, fontSize: '1.02rem', letterSpacing: '-0.015em' }}>
                Talento & Recursos Humanos
              </Typography>
              <Typography variant="body2" sx={{ color: '#64748b', lineHeight: 1.55, mb: 2.5, flex: 1, fontSize: '0.8rem' }}>
                Gestión de expedientes de personal, directorio interno, solicitudes de vacaciones y perfiles institucionales.
              </Typography>
              <Button variant="outlined" disabled fullWidth sx={{ textTransform: 'none', borderRadius: '8px', py: 1, fontSize: '0.8rem', fontWeight: 700 }}>
                En Desarrollo
              </Button>
            </CardContent>
          </Card>

          {/* MÓDULO 6: FINANZAS (EN DESARROLLO) */}
          <Card
            elevation={0}
            sx={{ 
              borderRadius: '0 12px 12px 0', 
              bgcolor: '#f8fafc', 
              border: '1px dashed #cbd5e1', 
              borderLeft: '3px solid #cbd5e1',
              boxShadow: 'none' 
            }}
          >
            <CardContent sx={{ p: 2.75, display: 'flex', flexDirection: 'column', height: '100%', opacity: 0.82, '&:last-child': { pb: 2.75 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Box
                  sx={{
                    color: '#64748b',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <FileSpreadsheet size={28} strokeWidth={1.75} />
                </Box>
                <Chip
                  label="Hoja de Ruta"
                  size="small"
                  sx={{
                    bgcolor: '#ffffff',
                    color: '#64748b',
                    border: '1px solid #e2e8f0',
                    fontWeight: 700,
                    fontSize: '0.66rem',
                    borderRadius: '6px',
                    height: 22
                  }}
                />
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#334155', mb: 0.75, fontSize: '1.02rem', letterSpacing: '-0.015em' }}>
                Finanzas & Presupuesto
              </Typography>
              <Typography variant="body2" sx={{ color: '#64748b', lineHeight: 1.55, mb: 2.5, flex: 1, fontSize: '0.8rem' }}>
                Ejecución presupuestaria de proyectos, conciliación de pasarelas de pago y reportes financieros institucionales.
              </Typography>
              <Button variant="outlined" disabled fullWidth sx={{ textTransform: 'none', borderRadius: '8px', py: 1, fontSize: '0.8rem', fontWeight: 700 }}>
                En Desarrollo
              </Button>
            </CardContent>
          </Card>
        </Box>

        {/* ACCESOS DIRECTOS ADMINISTRATIVOS Y GOBERNANZA (CON BARRA LATERAL DE RADIO CERO) */}
        {(userRole === 'Superadmin' || userRole === 'Admin') && (
          <Card
            elevation={0}
            sx={{
              p: { xs: 2.25, sm: 3 },
              mb: 4,
              borderRadius: '0 12px 12px 0',
              bgcolor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderLeft: '3px solid #0f172a',
              boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)',
              display: 'flex',
              flexDirection: { xs: 'column', md: 'row' },
              alignItems: { xs: 'flex-start', md: 'center' },
              justifyContent: 'space-between',
              gap: 2
            }}
          >
            <Box>
              <Typography sx={{ fontSize: '0.65rem', fontWeight: 800, color: '#b91c1c', letterSpacing: '0.08em', textTransform: 'uppercase', mb: 0.3 }}>
                Administración de Seguridad
              </Typography>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a', fontSize: '0.98rem', letterSpacing: '-0.01em' }}>
                Gobernanza y Seguridad Perimetral del Sistema
              </Typography>
              <Typography variant="body2" sx={{ color: '#64748b', fontSize: '0.8rem' }}>
                Administración de cuentas institucionales autorizadas (@iiresodh.org) y auditoría de eventos de seguridad.
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', gap: 1.25, flexWrap: 'wrap' }}>
              <Button 
                variant="outlined" 
                startIcon={<ShieldCheck size={15} />} 
                onClick={() => setView('usuarios')}
                sx={{
                  textTransform: 'none',
                  borderRadius: '8px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  borderColor: '#cbd5e1',
                  color: '#0f172a',
                  bgcolor: '#f8fafc',
                  '&:hover': { bgcolor: '#f1f5f9', borderColor: '#0f172a' }
                }}
              >
                Control de Usuarios Autorizados
              </Button>
              
              {userRole === 'Superadmin' && (
                <Button 
                  variant="outlined" 
                  startIcon={<Activity size={15} />} 
                  onClick={() => setView('logs')}
                  sx={{
                    textTransform: 'none',
                    borderRadius: '8px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    borderColor: '#cbd5e1',
                    color: '#0f172a',
                    bgcolor: '#f8fafc',
                    '&:hover': { bgcolor: '#f1f5f9', borderColor: '#0f172a' }
                  }}
                >
                  Bitácora de Auditoría (Logs)
                </Button>
              )}
            </Box>
          </Card>
        )}

        {/* PIE DE PÁGINA INSTITUCIONAL */}
        <Divider sx={{ mb: 2, borderColor: '#e2e8f0' }} />
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
              sx={{ height: 20, width: 'auto', opacity: 0.85 }}
            />
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155' }}>
              IIRESODH — Instituto Internacional de Responsabilidad Social y Derechos Humanos
            </Typography>
          </Box>
          <Typography sx={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 500 }}>
            Entorno privado exclusivo para miembros acreditados
          </Typography>
        </Box>
      </Box>

      {/* NOTIFICACIÓN EN TIEMPO REAL DE NUEVO MENSAJE DE WHATSAPP */}
      {tieneAccesoWhatsapp && (
        <Snackbar
          open={Boolean(alertaWhatsappReciente)}
          autoHideDuration={7000}
          onClose={() => setAlertaWhatsappReciente(null)}
          anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
          sx={{ mt: 7 }}
        >
          <Alert
            severity="success"
            variant="filled"
            onClose={() => setAlertaWhatsappReciente(null)}
            sx={{
              bgcolor: '#0f172a',
              color: '#ffffff',
              borderRadius: '0 10px 10px 0',
              border: '1px solid #334155',
              borderLeft: '3px solid #10b981',
              boxShadow: '0 12px 28px rgba(15, 23, 42, 0.25)',
              alignItems: 'center',
              maxWidth: 380
            }}
            action={
              <Button
                color="inherit"
                size="small"
                onClick={() => {
                  setAlertaWhatsappReciente(null);
                  setView('whatsapp');
                }}
                sx={{ fontWeight: 800, textTransform: 'none', color: '#34d399', fontSize: '0.75rem' }}
              >
                Abrir
              </Button>
            }
          >
            <Typography variant="caption" sx={{ fontWeight: 800, display: 'block', color: '#34d399' }}>
              Nuevo WhatsApp · {alertaWhatsappReciente?.nombre}
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', color: '#f8fafc' }} noWrap>
              {alertaWhatsappReciente?.ultimo_mensaje}
            </Typography>
          </Alert>
        </Snackbar>
      )}
    </Box>
  );
}
