import React from 'react';
import { Box, Button, Typography, Paper, Divider, Chip } from '@mui/material';
import { LogIn, ShieldCheck, Lock, Scale, Globe2, ExternalLink } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Login({ institutionalError, setInstitutionalError }) {
  const { loginWithGoogle } = useAuth();

  const handleLogin = async () => {
    try {
      if (setInstitutionalError) setInstitutionalError('');
      await loginWithGoogle();
    } catch (error) {
      console.error("Error en autenticación:", error);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        bgcolor: '#F8FAF8',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* COLUMNA IZQUIERDA: IDENTIDAD INSTITUCIONAL IIRESODH (Visible en Desktop y cabecera compacta en móvil) */}
      <Box
        sx={{
          width: { xs: '100%', md: '46%', lg: '48%' },
          bgcolor: '#1D3557',
          color: '#FFFFFF',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          p: { xs: 3.5, sm: 5, md: 6, lg: 7 },
          position: 'relative',
          overflow: 'hidden',
          borderBottom: { xs: '4px solid #B92F32', md: 'none' },
          borderRight: { xs: 'none', md: '4px solid #B92F32' }
        }}
      >
        {/* Marca de agua del isotipo oficial en el fondo */}
        <Box
          component="img"
          src="/iiresodh-isotipo-gradient.png"
          alt=""
          sx={{
            position: 'absolute',
            right: { xs: -80, md: -110 },
            bottom: { xs: -80, md: -90 },
            width: { xs: 280, md: 440 },
            height: 'auto',
            opacity: 0.06,
            filter: 'brightness(2.2) contrast(0.9)',
            pointerEvents: 'none',
            userSelect: 'none'
          }}
        />

        {/* Gradiente sutil superior */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '100%',
            background: 'radial-gradient(circle at 15% 20%, rgba(69, 123, 157, 0.22) 0%, rgba(29, 53, 87, 0) 60%)',
            pointerEvents: 'none'
          }}
        />

        {/* Cabecera Institucional */}
        <Box sx={{ position: 'relative', zIndex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.75, mb: { xs: 3, md: 5 } }}>
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: 2,
                bgcolor: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                p: 0.75,
                boxShadow: '0 4px 14px rgba(0, 0, 0, 0.2)'
              }}
            >
              <Box
                component="img"
                src="/iiresodh-isotipo-gradient.png"
                alt="Isotipo IIRESODH"
                sx={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </Box>
            <Box>
              <Typography
                sx={{
                  fontFamily: '"Plus Jakarta Sans", sans-serif',
                  fontWeight: 800,
                  fontSize: '1.15rem',
                  letterSpacing: '0.08em',
                  color: '#FFFFFF',
                  lineHeight: 1.1
                }}
              >
                IIRESODH
              </Typography>
              <Typography
                sx={{
                  fontSize: '0.72rem',
                  color: '#A8DADC',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                  mt: 0.25
                }}
              >
                Sistema Interno de Gestión Institucional
              </Typography>
            </Box>
          </Box>

          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1,
              px: 1.5,
              py: 0.6,
              borderRadius: 1.5,
              bgcolor: 'rgba(168, 218, 220, 0.12)',
              border: '1px solid rgba(168, 218, 220, 0.25)',
              mb: 2.5
            }}
          >
            <ShieldCheck size={15} color="#A8DADC" />
            <Typography
              sx={{
                fontSize: '0.73rem',
                fontWeight: 600,
                color: '#F1FAEE',
                letterSpacing: '0.03em'
              }}
            >
              ENTORNO PRIVADO Y AUDITADO
            </Typography>
          </Box>

          <Typography
            variant="h3"
            sx={{
              fontFamily: '"Plus Jakarta Sans", sans-serif',
              fontWeight: 800,
              fontSize: { xs: '1.65rem', sm: '2.1rem', lg: '2.35rem' },
              lineHeight: 1.2,
              color: '#FFFFFF',
              mb: 2
            }}
          >
            Instituto Internacional de Responsabilidad Social y Derechos Humanos
          </Typography>

          <Typography
            sx={{
              fontSize: { xs: '0.9rem', sm: '0.98rem' },
              color: 'rgba(241, 250, 238, 0.82)',
              lineHeight: 1.7,
              maxWidth: 520,
              mb: { xs: 2, md: 4 }
            }}
          >
            Plataforma centralizada para la gestión de litigios estratégicos, coordinación de proyectos institucionales, repositorio documental y comunicación interna del equipo de IIRESODH.
          </Typography>

          {/* Pilares institucionales (oculto en móviles muy pequeños para priorizar el botón de acceso) */}
          <Box
            sx={{
              display: { xs: 'none', sm: 'grid' },
              gridTemplateColumns: '1fr',
              gap: 2,
              mt: 3,
              maxWidth: 490
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.75 }}>
              <Box
                sx={{
                  mt: 0.3,
                  p: 1,
                  borderRadius: 1.5,
                  bgcolor: 'rgba(255, 255, 255, 0.07)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#A8DADC',
                  display: 'flex'
                }}
              >
                <Scale size={17} />
              </Box>
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: '0.88rem', color: '#FFFFFF' }}>
                  Litigio Estratégico y Derechos Humanos
                </Typography>
                <Typography sx={{ fontSize: '0.8rem', color: 'rgba(241, 250, 238, 0.7)', lineHeight: 1.5 }}>
                  Seguimiento riguroso de expedientes, plazos procesales, agenda híbrida y control de proyectos.
                </Typography>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.75 }}>
              <Box
                sx={{
                  mt: 0.3,
                  p: 1,
                  borderRadius: 1.5,
                  bgcolor: 'rgba(255, 255, 255, 0.07)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#A8DADC',
                  display: 'flex'
                }}
              >
                <Lock size={17} />
              </Box>
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: '0.88rem', color: '#FFFFFF' }}>
                  Seguridad Perimetral Google Workspace
                </Typography>
                <Typography sx={{ fontSize: '0.8rem', color: 'rgba(241, 250, 238, 0.7)', lineHeight: 1.5 }}>
                  Autenticación exclusiva para cuentas oficiales @iiresodh.org con bitácora de auditoría en tiempo real.
                </Typography>
              </Box>
            </Box>
          </Box>
        </Box>

        {/* Pie de columna izquierda */}
        <Box
          sx={{
            position: 'relative',
            zIndex: 1,
            mt: { xs: 3, md: 6 },
            pt: 2.5,
            borderTop: '1px solid rgba(255, 255, 255, 0.12)',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2
          }}
        >
          <Typography sx={{ fontSize: '0.76rem', color: 'rgba(241, 250, 238, 0.65)' }}>
            © {new Date().getFullYear()} IIRESODH • Todos los derechos reservados
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5 }}>
            <Box
              component="a"
              href="https://iiresodh.org"
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                color: '#A8DADC',
                fontSize: '0.76rem',
                fontWeight: 600,
                textDecoration: 'none',
                '&:hover': { color: '#FFFFFF', textDecoration: 'underline' }
              }}
            >
              <Globe2 size={13} />
              iiresodh.org
              <ExternalLink size={11} />
            </Box>
            <Box
              component="a"
              href="https://iiresodh-cursos-lms.web.app"
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                color: '#A8DADC',
                fontSize: '0.76rem',
                fontWeight: 600,
                textDecoration: 'none',
                '&:hover': { color: '#FFFFFF', textDecoration: 'underline' }
              }}
            >
              Campus Virtual
              <ExternalLink size={11} />
            </Box>
          </Box>
        </Box>
      </Box>

      {/* COLUMNA DERECHA: TARJETA DE ACCESO EJECUTIVO */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          p: { xs: 2.5, sm: 4, md: 6 },
          position: 'relative'
        }}
      >
        <Paper
          elevation={0}
          sx={{
            width: '100%',
            maxWidth: 460,
            borderRadius: '0 0 12px 12px',
            bgcolor: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderTop: 'none',
            boxShadow: '0 20px 45px -15px rgba(29, 53, 87, 0.08), 0 4px 12px -2px rgba(29, 53, 87, 0.04)',
            overflow: 'hidden'
          }}
        >
          {/* Barra superior con los colores oficiales de IIRESODH */}
          <Box
            sx={{
              height: 6,
              width: '100%',
              background: 'linear-gradient(90deg, #1D3557 0%, #1D3557 68%, #457B9D 68%, #457B9D 84%, #B92F32 84%, #B92F32 100%)'
            }}
          />

          <Box sx={{ p: { xs: 3.5, sm: 5 } }}>
            {/* LOGO OFICIAL COMPLETO IIRESODH */}
            <Box sx={{ mb: 4, display: 'flex', justifyContent: 'center' }}>
              <Box
                component="img"
                src="/iiresodh-logo-completo.png"
                alt="IIRESODH - Instituto Internacional de Responsabilidad Social y Derechos Humanos"
                sx={{
                  maxWidth: 310,
                  width: '100%',
                  height: 'auto',
                  objectFit: 'contain',
                  display: 'block'
                }}
              />
            </Box>

            <Divider sx={{ mb: 3.5, borderColor: '#F1F5F9' }}>
              <Chip
                label="PORTAL INSTITUCIONAL"
                size="small"
                sx={{
                  bgcolor: '#F8FAF8',
                  color: '#457B9D',
                  border: '1px solid #E2E8F0',
                  fontWeight: 700,
                  fontSize: '0.68rem',
                  letterSpacing: '0.08em',
                  height: 24
                }}
              />
            </Divider>

            <Box sx={{ textAlign: 'center', mb: 3.5 }}>
              <Typography
                variant="h5"
                sx={{
                  fontFamily: '"Plus Jakarta Sans", sans-serif',
                  fontWeight: 800,
                  color: '#1D3557',
                  mb: 1,
                  fontSize: { xs: '1.3rem', sm: '1.45rem' }
                }}
              >
                Iniciar Sesión en la Intranet
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: '#475569',
                  lineHeight: 1.6,
                  fontSize: '0.88rem'
                }}
              >
                Utilice su credencial institucional autorizada para acceder a las herramientas operativas y de gestión del Instituto.
              </Typography>
            </Box>

            {/* Mensaje de error perimetral */}
            {institutionalError && (
              <Box
                sx={{
                  mb: 3,
                  p: 2,
                  borderRadius: 2,
                  bgcolor: 'rgba(185, 47, 50, 0.06)',
                  border: '1px solid rgba(185, 47, 50, 0.25)',
                  borderLeft: '4px solid #B92F32',
                  textAlign: 'left'
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    display: 'block',
                    color: '#B92F32',
                    fontWeight: 700,
                    fontSize: '0.78rem',
                    lineHeight: 1.5
                  }}
                >
                  {institutionalError}
                </Typography>
              </Box>
            )}

            {/* BOTÓN DE ACCESO SEGURO */}
            <Button
              variant="contained"
              fullWidth
              startIcon={<LogIn size={18} />}
              onClick={handleLogin}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                py: 1.6,
                px: 3,
                borderRadius: 2,
                bgcolor: '#1D3557',
                color: '#FFFFFF',
                fontSize: '0.95rem',
                letterSpacing: '0.01em',
                boxShadow: '0 4px 12px rgba(29, 53, 87, 0.18)',
                transition: 'all 0.2s ease',
                '&:hover': {
                  bgcolor: '#122238',
                  boxShadow: '0 6px 18px rgba(29, 53, 87, 0.28)',
                  transform: 'translateY(-1px)'
                }
              }}
            >
              Ingresar con cuenta @iiresodh.org
            </Button>

            {/* Nota de seguridad */}
            <Box
              sx={{
                mt: 3.5,
                pt: 2.5,
                borderTop: '1px solid #F1F5F9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1,
                color: '#64748B'
              }}
            >
              <Lock size={13} color="#457B9D" />
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 500, color: '#64748B' }}>
                Acceso restringido a personal autorizado de IIRESODH
              </Typography>
            </Box>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
}
