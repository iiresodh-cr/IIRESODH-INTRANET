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
const GMEET_SCOPE_GRANTED_KEY = 'iiresodh_gmeet_scope_granted';
const GDRIVE_ACL_SCOPE_GRANTED_KEY = 'iiresodh_gdrive_acl_scope_granted';

export function guardarTokenGoogleDrive(accessToken, hasMeetScope = false, hasDriveAclScope = false) {
  if (!accessToken) return;
  try {
    sessionStorage.setItem(GDRIVE_TOKEN_KEY, accessToken);
    // Los tokens OAuth de Google duran 3600s; guardamos vigencia de 55 min
    sessionStorage.setItem(GDRIVE_TOKEN_EXP_KEY, String(Date.now() + 55 * 60 * 1000));
    if (hasMeetScope) {
      sessionStorage.setItem(GMEET_SCOPE_GRANTED_KEY, '1');
    }
    if (hasDriveAclScope) {
      sessionStorage.setItem(GDRIVE_ACL_SCOPE_GRANTED_KEY, '1');
    }
  } catch (e) {
    console.warn('No se pudo almacenar el token de Google en sessionStorage:', e);
  }
}

export function limpiarTokenGoogleDrive() {
  try {
    sessionStorage.removeItem(GDRIVE_TOKEN_KEY);
    sessionStorage.removeItem(GDRIVE_TOKEN_EXP_KEY);
    sessionStorage.removeItem(GMEET_SCOPE_GRANTED_KEY);
    sessionStorage.removeItem(GDRIVE_ACL_SCOPE_GRANTED_KEY);
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

export async function solicitarTokenGoogleDrive(emailHint = '', incluirMeet = true) {
  const provider = new GoogleAuthProvider();
  provider.addScope('https://www.googleapis.com/auth/drive');
  provider.addScope('https://www.googleapis.com/auth/drive.readonly');
  provider.addScope('https://www.googleapis.com/auth/drive.file');
  if (incluirMeet) {
    provider.addScope('https://www.googleapis.com/auth/meetings.space.created');
  }
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
    guardarTokenGoogleDrive(accessToken, incluirMeet, true);
  }
  return accessToken;
}

/**
 * Extrae el ID de archivo o carpeta de Google Drive a partir de una URL o ID directo.
 */
export function extraerIdRecursoDrive(urlOrId = '') {
  const raw = String(urlOrId || '').trim();
  if (!raw) return '';
  if (/^[a-zA-Z0-9_-]{15,}$/.test(raw)) return raw;

  const folderMatch = raw.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch?.[1]) return folderMatch[1];

  const docsMatch = raw.match(/\/(?:document|spreadsheets|presentation|file)\/d\/([a-zA-Z0-9_-]+)/);
  if (docsMatch?.[1]) return docsMatch[1];

  const idParamMatch = raw.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idParamMatch?.[1]) return idParamMatch[1];

  return '';
}

/**
 * Blinda un archivo o carpeta de Google Drive para que NUNCA esté en modo
 * "Cualquiera que tenga el vínculo" (type: 'anyone') ni abierto a personas ajenas,
 * otorgando acceso exclusivamente a los correos miembros del canal indicado.
 */
export async function sincronizarPermisosDriveConCanal({
  fileIdOrUrl = '',
  miembrosEmails = [],
  rolPermiso = 'reader', // 'reader' | 'writer' | 'commenter'
  revocarUsuariosAjenos = true,
  emailHint = ''
}) {
  const fileId = extraerIdRecursoDrive(fileIdOrUrl);
  if (!fileId) {
    throw new Error('No se pudo identificar el ID del archivo o carpeta de Google Drive.');
  }

  let token = obtenerTokenGoogleDriveActivo();
  const tieneScopeAcl = sessionStorage.getItem(GDRIVE_ACL_SCOPE_GRANTED_KEY) === '1';

  if (!token || !tieneScopeAcl) {
    token = await solicitarTokenGoogleDrive(emailHint, true);
  }
  if (!token) {
    throw new Error('Se requiere autorización de Google Drive para configurar la privacidad del recurso.');
  }

  const listarPermisos = async (tk) =>
    fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
        fileId
      )}/permissions?supportsAllDrives=true&fields=permissions(id,type,role,emailAddress,domain,displayName,deleted)`,
      {
        headers: { Authorization: `Bearer ${tk}` }
      }
    );

  let resList = await listarPermisos(token);
  if (resList.status === 401 || resList.status === 403) {
    token = await solicitarTokenGoogleDrive(emailHint, true);
    if (!token) {
      throw new Error('No se pudo autorizar el ajuste de permisos en Google Drive.');
    }
    resList = await listarPermisos(token);
  }

  if (!resList.ok) {
    const errData = await resList.json().catch(() => ({}));
    throw new Error(
      errData?.error?.message ||
        'No tienes permisos de propietario/editor en Google Drive para modificar el acceso de esta carpeta o archivo.'
    );
  }

  const dataList = await resList.json();
  const permisosActuales = dataList.permissions || [];

  const miembrosNormalizados = Array.from(
    new Set(
      (miembrosEmails || [])
        .map((e) => String(e || '').trim().toLowerCase())
        .filter((e) => e && e.includes('@'))
    )
  );

  let publicoRevocado = false;
  let dominioRevocado = false;
  let usuariosAjenosRevocados = 0;

  // 1. Revocar de inmediato cualquier acceso "anyone" ("Cualquiera que tenga el vínculo")
  // y cualquier vínculo general de dominio, así como usuarios que no pertenezcan al canal
  for (const perm of permisosActuales) {
    if (perm.role === 'owner' || perm.role === 'organizer') continue;

    const esPublicoAnyone = perm.type === 'anyone' || perm.id === 'anyoneWithLink' || perm.id === 'anyone';
    const esDominioGeneral = perm.type === 'domain';
    const emailPerm = (perm.emailAddress || '').toLowerCase();
    const esUsuarioAjeno =
      revocarUsuariosAjenos &&
      perm.type === 'user' &&
      emailPerm &&
      !miembrosNormalizados.includes(emailPerm);

    if (esPublicoAnyone || esDominioGeneral || esUsuarioAjeno) {
      const delRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
          fileId
        )}/permissions/${encodeURIComponent(perm.id)}?supportsAllDrives=true`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      if (delRes.ok || delRes.status === 204) {
        if (esPublicoAnyone) publicoRevocado = true;
        if (esDominioGeneral) dominioRevocado = true;
        if (esUsuarioAjeno) usuariosAjenosRevocados += 1;
      }
    }
  }

  // 2. Otorgar permiso nominal (type: 'user') únicamente a los miembros del canal
  const emailsYaConAcceso = new Set(
    permisosActuales
      .filter((p) => p.type === 'user' && p.emailAddress)
      .map((p) => p.emailAddress.toLowerCase())
  );

  let miembrosAgregados = 0;
  const rolSeguro = ['reader', 'writer', 'commenter'].includes(rolPermiso) ? rolPermiso : 'reader';

  for (const emailMiembro of miembrosNormalizados) {
    if (emailsYaConAcceso.has(emailMiembro)) continue;

    const addRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
        fileId
      )}/permissions?supportsAllDrives=true&sendNotificationEmail=false`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          role: rolSeguro,
          type: 'user',
          emailAddress: emailMiembro
        })
      }
    );
    if (addRes.ok) {
      miembrosAgregados += 1;
    }
  }

  return {
    fileId,
    publicoRevocado,
    dominioRevocado,
    usuariosAjenosRevocados,
    miembrosAutorizadosCount: miembrosNormalizados.length,
    miembrosAgregados
  };
}

/**
 * Crea un espacio real de Google Meet (https://meet.google.com/xxx-xxxx-xxx)
 * usando Google Meet REST API v2 bajo la cuenta institucional del usuario autenticado.
 */
export async function crearEspacioGoogleMeet(emailHint = '') {
  let token = obtenerTokenGoogleDriveActivo();
  const tieneScopeMeet = sessionStorage.getItem(GMEET_SCOPE_GRANTED_KEY) === '1';

  if (!token || !tieneScopeMeet) {
    token = await solicitarTokenGoogleDrive(emailHint, true);
  }
  if (!token) {
    throw new Error('No se pudo obtener autorización de Google Workspace para crear la sala de Meet.');
  }

  let response = await fetch('https://meet.googleapis.com/v2/spaces', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({})
  });

  // Si el token expiró o aún no tenía el scope de Meet autorizado, re-solicitamos con popup
  if (response.status === 401 || response.status === 403) {
    token = await solicitarTokenGoogleDrive(emailHint, true);
    if (!token) {
      throw new Error('Autorización de Google Meet cancelada.');
    }
    response = await fetch('https://meet.googleapis.com/v2/spaces', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });
  }

  if (!response.ok) {
    let detalle = '';
    try {
      const errJson = await response.json();
      detalle = errJson?.error?.message || '';
    } catch {
      // ignore
    }
    throw new Error(detalle || `Error al crear sala en Google Meet (HTTP ${response.status}).`);
  }

  const data = await response.json();
  return {
    spaceName: data.name || '',
    meetingUri: data.meetingUri || (data.meetingCode ? `https://meet.google.com/${data.meetingCode}` : ''),
    meetingCode: data.meetingCode || ''
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // 1. Iniciar sesión tradicional (Email/Password)
  const login = (email, password) => {
    return signInWithEmailAndPassword(auth, email, password);
  };

  // 2. Iniciar sesión con Google Workspace + Filtro de Dominio + Permisos de Drive y Google Meet
  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/drive');
    provider.addScope('https://www.googleapis.com/auth/drive.readonly');
    provider.addScope('https://www.googleapis.com/auth/drive.file');
    provider.addScope('https://www.googleapis.com/auth/meetings.space.created');
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
      guardarTokenGoogleDrive(credential.accessToken, true, true);
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
