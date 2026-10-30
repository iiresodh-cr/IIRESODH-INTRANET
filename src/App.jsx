import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import { db } from './config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Box, CircularProgress } from '@mui/material';

// Vistas Generales de la Intranet
import Login from './views/Login';
import Layout from './components/Layout';
import HubIntranet from './views/HubIntranet';
import UsuariosAutorizados from './views/UsuariosAutorizados';
import LogsAuditoria from './views/LogsAuditoria';
import WhatsappInterface from './views/WhatsappInterface';
import PwaComunicacionesMobile from './views/PwaComunicacionesMobile';
import AdminPanelWeb from './views/web/AdminPanelWeb';
import RecursosInstitucionales from './views/RecursosInstitucionales';

// Vistas del Módulo de Litigio
import Casos from './views/litigio/Casos';
import DetalleCaso from './views/litigio/DetalleCaso';
import { registrarLogAuditoria } from './utils/auditLogger';
import { detectarEntornoMovilPWA, registrarServiceWorkerPWA } from './utils/pwaNotifications';

// FILTRO DE CONSOLA: Mantiene el perímetro limpio bloqueando solo advertencias automáticas de reconexión del SDK
const originalConsoleError = console.error;

console.error = (...args) => {
  const cadenaError = args
    .map((item) => {
      if (item instanceof Error) {
        return item.message + ' ' + item.stack;
      }
      if (typeof item === 'object') {
        try {
          return JSON.stringify(item);
        } catch (e) {
          return '';
        }
      }
      return String(item);
    })
    .join(' ');

  if (
    cadenaError.includes('could not be reached') ||
    cadenaError.includes('Failed to get document because the client is offline')
  ) {
    return;
  }

  originalConsoleError(...args);
};

function leerParametrosPwaUrl() {
  if (typeof window === 'undefined') {
    return {
      esModoPwaUrl: false,
      tabInicial: 'whatsapp',
      chatIdInicial: null,
      channelIdInicial: null
    };
  }
  const params = new URLSearchParams(window.location.search);
  const appParam = (params.get('app') || params.get('mode') || '').toLowerCase();
  const tabParam = (params.get('tab') || '').toLowerCase();
  const chatId = params.get('chatId') || null;
  const channelId = params.get('channelId') || null;

  const { isStandalone, isIOS, isAndroid } = detectarEntornoMovilPWA();
  const esModoPwaUrl =
    appParam === 'comms' ||
    appParam === 'whatsapp' ||
    isStandalone ||
    isIOS ||
    isAndroid ||
    Boolean(chatId) ||
    Boolean(channelId);

  return {
    esModoPwaUrl,
    tabInicial:
      tabParam === 'workspace' || Boolean(channelId)
        ? 'workspace'
        : 'whatsapp',
    chatIdInicial: chatId,
    channelIdInicial: channelId
  };
}

function App() {
  const { user, logout } = useAuth();

  const [pwaParams] = useState(() => leerParametrosPwaUrl());
  const [view, setView] = useState(() => (pwaParams.esModoPwaUrl ? 'pwa_comms' : 'hub'));
  const [casoSeleccionado, setCasoSeleccionado] = useState(null);

  const [userRole, setUserRole] = useState('Abogado/a');
  const [userName, setUserName] = useState('');
  const [userPermisos, setUserPermisos] = useState({ web: false, whatsapp: false });
  const [loadingRole, setLoadingRole] = useState(true);
  const [institutionalError, setInstitutionalError] = useState('');

  useEffect(() => {
    registrarServiceWorkerPWA();
  }, []);

  const handleSelectCaso = (caso) => {
    setView('detalle_caso');
    setCasoSeleccionado(caso);
  };

  const handleVolverCasos = () => {
    setView('casos');
    setCasoSeleccionado(null);
  };

  useEffect(() => {
    const resolverRolYPermisos = async () => {
      if (!user) {
        setLoadingRole(false);
        return;
      }

      const { esModoPwaUrl } = leerParametrosPwaUrl();
      setView(esModoPwaUrl ? 'pwa_comms' : 'hub');
      setCasoSeleccionado(null);

      const emailLimpio = user.email.toLowerCase();

      if (emailLimpio === 'webmaster@iiresodh.org') {
        setUserRole('Superadmin');
        setUserName(user.displayName || 'Webmaster IIRESODH');
        setUserPermisos({ web: true, whatsapp: true });
        setInstitutionalError('');
        setLoadingRole(false);

        const sessionKey = `audit_login_${user.uid}`;
        if (!sessionStorage.getItem(sessionKey)) {
          sessionStorage.setItem(sessionKey, 'true');
          registrarLogAuditoria(
            emailLimpio,
            'Inicio de Sesión',
            'Acceso autenticado y autorizado a la Intranet con rol [Superadmin]'
          );
        }
        return;
      }

      // 🚀 EXCLUSIÓN ABSOLUTA: Si no pertenece al dominio institucional, fuera inmediatamente
      if (!emailLimpio.endsWith('@iiresodh.org')) {
        await registrarLogAuditoria(
          emailLimpio,
          'Acceso Denegado',
          'Bloqueo perimetral: Intento de ingreso con dominio no institucional'
        );
        await logout();
        setInstitutionalError('Acceso denegado: Solo se permiten cuentas institucionales de IIRESODH.');
        setLoadingRole(false);
        return;
      }

      try {
        const userDocRef = doc(db, 'usuarios_autorizados', emailLimpio);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
          const userDoc = userDocSnap.data();
          const rolAsignado = userDoc.rol || 'Abogado/a';

          // 🚀 LISTA BLANCA ESTRICTA: Solo entran Superadmin, Admin, Abogado/a o Administrativo
          const ROLES_OPERATIVOS = ['Superadmin', 'Admin', 'Abogado/a', 'Administrativo'];
          if (!ROLES_OPERATIVOS.includes(rolAsignado)) {
            await registrarLogAuditoria(
              emailLimpio,
              'Acceso Denegado',
              `Bloqueo perimetral: Cuenta con rol inactivo o no operativo [${rolAsignado}]`
            );
            await logout();
            setInstitutionalError(
              'Acceso denegado: Su cuenta institucional no tiene un rol operativo activo (Admin, Abogado/a o Administrativo). Contacte a la administración.'
            );
            setLoadingRole(false);
            return;
          }

          const esSuper = rolAsignado === 'Superadmin';
          setUserRole(rolAsignado);
          setUserName(userDoc.nombre || user.displayName || '');
          setUserPermisos({
            web: esSuper || userDoc.acceso_web === true,
            whatsapp: esSuper || userDoc.acceso_whatsapp === true
          });
          setInstitutionalError('');

          const sessionKey = `audit_login_${user.uid}`;
          if (!sessionStorage.getItem(sessionKey)) {
            sessionStorage.setItem(sessionKey, 'true');
            registrarLogAuditoria(
              emailLimpio,
              'Inicio de Sesión',
              `Acceso autenticado y autorizado a la Intranet con rol [${rolAsignado}]`
            );
          }
        } else {
          // 🚀 BLOQUEO PERIMETRAL: Aunque sea @iiresodh.org, si no está en usuarios_autorizados NO PUEDE INGRESAR
          await registrarLogAuditoria(
            emailLimpio,
            'Acceso Denegado',
            'Bloqueo perimetral: Cuenta institucional (@iiresodh.org) no pre-autorizada en lista blanca'
          );
          await logout();
          setInstitutionalError(
            'Acceso restringido: Su cuenta institucional (@iiresodh.org) aún no ha sido autorizada en la Intranet. Contacte a un Administrador para habilitar su acceso.'
          );
          setLoadingRole(false);
          return;
        }
      } catch (err) {
        console.error('Error verificando autorización:', err);
        await logout();
        setInstitutionalError(
          'Error verificando autorización de cuenta. Intente nuevamente o contacte a la administración.'
        );
      } finally {
        setLoadingRole(false);
      }
    };

    setLoadingRole(true);
    resolverRolYPermisos();
  }, [user]);

  // Protección de seguridad perimetral para vistas administrativas e internas
  const tieneAccesoWeb = userRole === 'Superadmin' || userPermisos.web === true;
  const tieneAccesoWhatsapp = userRole === 'Superadmin' || userPermisos.whatsapp === true;

  useEffect(() => {
    if (!loadingRole) {
      if (view === 'usuarios' && userRole !== 'Superadmin' && userRole !== 'Admin') {
        setView('hub');
      }
      if (view === 'logs' && userRole !== 'Superadmin') {
        setView('hub');
      }
      // 🚀 BLINDAJE DE SEGURIDAD MODULAR
      if (view === 'sitio_web' && !tieneAccesoWeb) {
        setView('hub');
      }
      if (view === 'whatsapp' && !tieneAccesoWhatsapp) {
        setView('hub');
      }
    }
  }, [view, userRole, loadingRole, tieneAccesoWeb, tieneAccesoWhatsapp]);

  if (!user || institutionalError) {
    return (
      <Login
        institutionalError={institutionalError}
        setInstitutionalError={setInstitutionalError}
      />
    );
  }

  if (loadingRole) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  let vistaSegura = view;
  if (vistaSegura === 'usuarios' && userRole !== 'Superadmin' && userRole !== 'Admin') {
    vistaSegura = 'hub';
  }
  if (vistaSegura === 'logs' && userRole !== 'Superadmin') {
    vistaSegura = 'hub';
  }
  if (vistaSegura === 'sitio_web' && !tieneAccesoWeb) {
    vistaSegura = 'hub';
  }
  if (vistaSegura === 'whatsapp' && !tieneAccesoWhatsapp) {
    vistaSegura = 'hub';
  }
  if ((vistaSegura === 'casos' || vistaSegura === 'detalle_caso') && userRole === 'Invitado') {
    vistaSegura = 'hub';
  }

  // SHELL DEDICADO MÓVIL / PWA DE COMUNICACIONES (WHATSAPP + WORKSPACE SIN MARCO DE INTRANET)
  if (vistaSegura === 'pwa_comms') {
    const tabInicialSegura =
      !tieneAccesoWhatsapp && pwaParams.tabInicial === 'whatsapp'
        ? 'workspace'
        : pwaParams.tabInicial;

    return (
      <PwaComunicacionesMobile
        user={user}
        userRole={userRole}
        onIrAlHubIntranet={() => setView('hub')}
        initialTab={tabInicialSegura}
        initialWhatsappChatId={pwaParams.chatIdInicial}
        initialWorkspaceChannelId={pwaParams.channelIdInicial}
      />
    );
  }

  return (
    <Layout currentView={vistaSegura} setView={setView} userRole={userRole} userPermisos={userPermisos}>
      {vistaSegura === 'hub' && (
        <HubIntranet
          setView={setView}
          userRole={userRole}
          userPermisos={userPermisos}
          user={user}
          userName={userName}
        />
      )}

      {vistaSegura === 'recursos_institucionales' && (
        <RecursosInstitucionales
          onVolver={() => setView('hub')}
          currentUserEmail={user.email}
          userRole={userRole}
        />
      )}

      {vistaSegura === 'sitio_web' && (
        <AdminPanelWeb onVolver={() => setView('hub')} currentUserEmail={user.email} userRole={userRole} />
      )}

      {vistaSegura === 'casos' && (
        <Casos onSelectCaso={handleSelectCaso} userRole={userRole} currentUserEmail={user.email} />
      )}

      {vistaSegura === 'detalle_caso' && casoSeleccionado && (
        <DetalleCaso
          caso={casoSeleccionado}
          onVolver={handleVolverCasos}
          currentUserEmail={user.email}
          userRole={userRole}
        />
      )}

      {vistaSegura === 'usuarios' && (
        <UsuariosAutorizados currentUserEmail={user.email} userRole={userRole} />
      )}

      {vistaSegura === 'logs' && (
        <LogsAuditoria currentUserEmail={user.email} userRole={userRole} />
      )}

      {vistaSegura === 'whatsapp' && (
        <WhatsappInterface
          onVolver={() => setView('hub')}
          currentUserEmail={user?.email}
          userName={userName || user?.displayName || user?.email?.split('@')[0]}
          userRole={userRole}
        />
      )}
    </Layout>
  );
}

export default App;
