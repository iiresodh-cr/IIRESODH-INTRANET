import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  signOut,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { auth } from '../config/firebase';
import { CircularProgress, Box } from '@mui/material';

const AuthContext = createContext();

// Dominios institucionales autorizados
const ALLOWED_DOMAINS = ['iiresodh.org', 'sipdh.com'];

const GDRIVE_TOKEN_KEY = 'iiresodh_gdrive_token';
const GDRIVE_TOKEN_EXP_KEY = 'iiresodh_gdrive_token_exp';

export function guardarTokenGoogleDrive(accessToken) {
  if (!accessToken) return;
  try {
    sessionStorage.setItem(GDRIVE_TOKEN_KEY, accessToken);
    // Los tokens OAuth de Google duran 3600s; guardamos vigencia de 55 min
    sessionStorage.setItem(GDRIVE_TOKEN_EXP_KEY, String(Date.now() + 55 * 60 * 1000));
  } catch (e) {
    console.warn('No se pudo almacenar el token de Drive en sessionStorage:', e);
  }
}

export function limpiarTokenGoogleDrive() {
  try {
    sessionStorage.removeItem(GDRIVE_TOKEN_KEY);
    sessionStorage.removeItem(GDRIVE_TOKEN_EXP_KEY);
  } catch {
    // ignore
  }
}

export function obtenerTokenGoogleDriveActivo() {
  try {
    const token = sessionStorage.getItem(GDRIVE_TOKEN_KEY);
    const exp = Number(sessionStorage.getItem(GDRIVE_TOKEN_EXP_KEY) || 0);
    if (token && exp > Date.now()) {
      return token;
    }
    return null;
  } catch {
    return null;
  }
}

export async function solicitarTokenGoogleDrive(emailHint = '') {
  const provider = new GoogleAuthProvider();
  provider.addScope('https://www.googleapis.com/auth/drive.readonly');
  const customParams = {
    include_granted_scopes: 'true'
  };
  if (emailHint) {
    customParams.login_hint = emailHint;
  } else {
    customParams.prompt = 'select_account';
  }
  provider.setCustomParameters(customParams);

  const result = await signInWithPopup(auth, provider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  const accessToken = credential?.accessToken || null;
  if (accessToken) {
    guardarTokenGoogleDrive(accessToken);
  }
  return accessToken;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // 1. Iniciar sesión tradicional (Email/Password)
  const login = (email, password) => {
    return signInWithEmailAndPassword(auth, email, password);
  };

  // 2. Iniciar sesión con Google Workspace + Filtro de Dominio + Permiso de lectura de Drive
  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/drive.readonly');
    // Fuerza a Google a mostrar el selector de cuentas siempre
    provider.setCustomParameters({ prompt: 'select_account' });
    
    const result = await signInWithPopup(auth, provider);
    const email = result.user.email || '';
    const domain = email.split('@')[1];

    // Si el dominio NO está en la lista permitida, lo expulsamos inmediatamente
    if (!ALLOWED_DOMAINS.includes(domain)) {
      limpiarTokenGoogleDrive();
      await signOut(auth);
      throw new Error('auth/domain-not-allowed');
    }

    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) {
      guardarTokenGoogleDrive(credential.accessToken);
    }

    return result;
  };

  // 3. Cerrar sesión
  const logout = () => {
    limpiarTokenGoogleDrive();
    return signOut(auth);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress size={60} thickness={4} />
      </Box>
    );
  }

  return (
    <AuthContext.Provider value={{ user, login, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
