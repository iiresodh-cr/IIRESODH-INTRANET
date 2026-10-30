import { getMessaging, getToken, isSupported } from 'firebase/messaging';
import { doc, setDoc, deleteDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { app, db } from '../config/firebase';

const CLOUD_FUNCTION_BASE = 'https://us-central1-litigio-management.cloudfunctions.net';
const STORAGE_TOKEN_KEY = 'iiresodh_pwa_fcm_token';

export function detectarEntornoMovilPWA() {
  if (typeof window === 'undefined') {
    return {
      isIOS: false,
      isAndroid: false,
      isStandalone: false,
      isMobileScreen: false,
      supportsNotifications: false
    };
  }

  const ua = window.navigator.userAgent || '';
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  const isStandalone =
    window.matchMedia?.('(display-mode: standalone)')?.matches === true ||
    window.navigator.standalone === true;
  const isMobileScreen = window.innerWidth < 900 || isIOS || isAndroid;
  const supportsNotifications = 'Notification' in window && 'serviceWorker' in navigator;

  return {
    isIOS,
    isAndroid,
    isStandalone,
    isMobileScreen,
    supportsNotifications
  };
}

export async function registrarServiceWorkerPWA() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;
  try {
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/'
    });
    await navigator.serviceWorker.ready;
    return registration;
  } catch (err) {
    console.warn('Error registrando Service Worker PWA:', err);
    return null;
  }
}

function tokenToDocId(token = '') {
  // Generar un ID seguro para Firestore a partir del token FCM
  const clean = token.replace(/[^a-zA-Z0-9_-]/g, '');
  return clean.slice(-64) || `tok_${Date.now()}`;
}

export async function activarNotificacionesPushDispositivo({
  userEmail,
  userName,
  userRole
}) {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    throw new Error(
      'Este navegador no soporta notificaciones nativas. En iPhone, agrega primero la app a la Pantalla de Inicio.'
    );
  }

  const perm = await Notification.requestPermission();
  if (perm !== 'granted') {
    throw new Error('Permiso de notificaciones denegado en el dispositivo.');
  }

  const swReg = await registrarServiceWorkerPWA();
  let fcmToken = null;

  try {
    const supported = await isSupported();
    if (supported && swReg) {
      const messaging = getMessaging(app);

      // Consultar si existe una vapidKey opcional en variables de entorno o Firestore
      let vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY || undefined;
      if (!vapidKey) {
        try {
          const cfgSnap = await getDoc(doc(db, 'whatsapp_config', 'credenciales'));
          if (cfgSnap.exists() && cfgSnap.data()?.vapid_key) {
            vapidKey = cfgSnap.data().vapid_key.trim();
          }
        } catch {
          // Continuar con certificado por defecto del proyecto Firebase
        }
      }

      const tokenOptions = { serviceWorkerRegistration: swReg };
      if (vapidKey) {
        tokenOptions.vapidKey = vapidKey;
      }

      fcmToken = await getToken(messaging, tokenOptions);
    }
  } catch (eToken) {
    console.warn('Aviso obteniendo token FCM (se activarán notificaciones locales/SW):', eToken);
  }

  const { isIOS, isAndroid, isStandalone } = detectarEntornoMovilPWA();
  const plataforma = isIOS ? 'ios' : isAndroid ? 'android' : 'desktop';
  const emailNormalizado = (userEmail || '').toLowerCase().trim();

  if (fcmToken && emailNormalizado) {
    const docId = tokenToDocId(fcmToken);
    await setDoc(
      doc(db, 'pwa_fcm_tokens', docId),
      {
        token: fcmToken,
        email: emailNormalizado,
        nombre: userName || emailNormalizado,
        rol: userRole || 'Miembro',
        plataforma,
        standalone: isStandalone,
        activo: true,
        userAgent: window.navigator.userAgent.slice(0, 180),
        actualizadoEn: serverTimestamp(),
        actualizadoEnMs: Date.now()
      },
      { merge: true }
    );
    window.localStorage.setItem(STORAGE_TOKEN_KEY, fcmToken);
  } else {
    window.localStorage.setItem(STORAGE_TOKEN_KEY, `local_granted_${Date.now()}`);
  }

  return {
    granted: true,
    fcmToken,
    plataforma
  };
}

export async function desactivarNotificacionesPushDispositivo() {
  const savedToken = window.localStorage.getItem(STORAGE_TOKEN_KEY);
  if (savedToken && !savedToken.startsWith('local_granted_')) {
    try {
      const docId = tokenToDocId(savedToken);
      await deleteDoc(doc(db, 'pwa_fcm_tokens', docId));
    } catch (e) {
      console.warn('Error eliminando token FCM:', e);
    }
  }
  window.localStorage.removeItem(STORAGE_TOKEN_KEY);
}

export function actualizarBadgeApp(conteoTotal = 0) {
  if (typeof window === 'undefined') return;
  const n = Math.max(0, Number(conteoTotal) || 0);

  if ('setAppBadge' in navigator) {
    if (n > 0) {
      navigator.setAppBadge(n).catch(() => {});
    } else if ('clearAppBadge' in navigator) {
      navigator.clearAppBadge().catch(() => {});
    }
  }

  if (navigator.serviceWorker?.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'SET_APP_BADGE',
      count: n
    });
  }
}

// Sonido cristalino sintetizado con Web Audio API (sin archivos externos)
export function reproducirSonidoNotificacion(tipo = 'whatsapp') {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (tipo === 'whatsapp') {
      // Doble nota ascendente tipo mensajería móvil
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.setValueAtTime(880, now + 0.11); // A5
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc.start(now);
      osc.stop(now + 0.3);
    } else {
      // Acorde suave tipo Slack Workspace
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.09); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.18); // G5
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.16, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
      osc.start(now);
      osc.stop(now + 0.36);
    }
  } catch {
    // Ignorar si el navegador bloquea autoplay antes de interacción
  }
}

export async function mostrarNotificacionDispositivo({ title, body, data = {} }) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg && typeof reg.showNotification === 'function') {
      await reg.showNotification(title, {
        body,
        icon: '/pwa-icon-192.png',
        badge: '/pwa-icon-192.png',
        tag: data.tag || `iiresodh-${Date.now()}`,
        renotify: true,
        vibrate: [160, 80, 160],
        data
      });
      return;
    }
    new Notification(title, {
      body,
      icon: '/pwa-icon-192.png',
      tag: data.tag || `iiresodh-${Date.now()}`,
      data
    });
  } catch (e) {
    console.warn('No se pudo mostrar notificación del sistema:', e);
  }
}

export async function dispararPushWorkspaceBackend({
  canalId,
  canalNombre,
  esDm = false,
  texto = '',
  autorEmail = '',
  autorNombre = '',
  destinatarios = []
}) {
  try {
    await fetch(`${CLOUD_FUNCTION_BASE}/notificar_workspace`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        canal_id: canalId,
        canal_nombre: canalNombre,
        es_dm: esDm,
        texto,
        autor_email: autorEmail,
        autor_nombre: autorNombre,
        destinatarios
      })
    });
  } catch {
    // Silencioso en caso de red
  }
}
