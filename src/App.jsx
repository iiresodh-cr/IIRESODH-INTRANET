import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import { db } from './config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Typography, Paper, Box, CircularProgress } from '@mui/material';

// Vistas Generales de la Intranet
import Login from './views/Login';
import Layout from './components/Layout';
import HubIntranet from './views/HubIntranet'; 
import UsuariosAutorizados from './views/UsuariosAutorizados';
import LogsAuditoria from './views/LogsAuditoria';
import WhatsappInterface from './views/WhatsappInterface';
import AdminPanelWeb from './views/web/AdminPanelWeb';
import RecursosInstitucionales from './views/RecursosInstitucionales';

// Vistas del Módulo de Litigio
import Casos from './views/litigio/Casos';
import DetalleCaso from './views/litigio/DetalleCaso';

// FILTRO DE CONSOLA: Mantiene el perímetro limpio bloqueando solo advertencias automáticas de reconexión del SDK
const originalConsoleError = console.error;

console.error = (...args) => {
  const cadenaError = args.map((item) => {
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
  }).join(' ');

  if (
    cadenaError.includes('could not be reached') || 
    cadenaError.includes('Failed to get document because the client is offline')
  ) {
    return; 
  }

  originalConsoleError(...args);
};

function App() {
  const { user, logout } = useAuth();
  
  const [view, setView] = useState('hub'); 
  const [casoSeleccionado, setCasoSeleccionado] = useState(null);
  
  const [userRole, setUserRole] = useState('Abogado/a'); 
  const [userName, setUserName] = useState('');
  const [userPermisos, setUserPermisos] = useState({ web: false, whatsapp: false });
  const [loadingRole, setLoadingRole] = useState(true);
  const [institutionalError, setInstitutionalError] = useState('');

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

      setView('hub');
      setCasoSeleccionado(null);

      const emailLimpio = user.email.toLowerCase();

      if (emailLimpio === 'webmaster@iiresodh.org') {
        setUserRole('Superadmin');
        setUserName(user.displayName || 'Webmaster IIRESODH');
        setUserPermisos({ web: true, whatsapp: true });
        setInstitutionalError('');
        setLoadingRole(false);
        return;
      }

      // 🚀 EXCLUSIÓN ABSOLUTA: Si no pertenece al dominio institucional, fuera inmediatamente
      if (!emailLimpio.endsWith('@iiresodh.org')) {
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
          const esSuper = rolAsignado === 'Superadmin';
          setUserRole(rolAsignado);
          setUserName(userDoc.nombre || user.displayName || '');
          setUserPermisos({
            web: esSuper || userDoc.acceso_web === true,
            whatsapp: esSuper || userDoc.acceso_whatsapp === true
          });
          setInstitutionalError('');
        } else {
          // 🚀 FLEXIBILIDAD ESTRUCTURAL: Es @iiresodh.org pero no está registrado en Litigios.
          setUserRole('Invitado');
          setUserName(user.displayName || '');
          setUserPermisos({ web: false, whatsapp: false });
          setInstitutionalError('');
        }
      } catch (err) {
        setUserRole('Invitado');
        setUserName(user.displayName || '');
        setUserPermisos({ web: false, whatsapp: false });
        setInstitutionalError('');
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
      if ((view === 'casos' || view === 'detalle_caso') && userRole === 'Invitado') {
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
        <DetalleCaso caso={casoSeleccionado} onVolver={handleVolverCasos} currentUserEmail={user.email} userRole={userRole} />
      )}

      {vistaSegura === 'usuarios' && (
        <UsuariosAutorizados currentUserEmail={user.email} userRole={userRole} />
      )}

      {vistaSegura === 'logs' && (
        <LogsAuditoria currentUserEmail={user.email} userRole={userRole} />
      )}

      {vistaSegura === 'whatsapp' && (
        <WhatsappInterface onVolver={() => setView('hub')} />
      )}
    </Layout>
  );
}

export default App;