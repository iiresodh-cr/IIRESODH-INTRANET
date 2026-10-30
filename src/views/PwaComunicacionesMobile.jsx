import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Box,
  Typography,
  Avatar,
  IconButton,
  Button,
  TextField,
  Badge,
  Popover,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Tooltip,
  Divider
} from '@mui/material';
import {
  MessageCircle,
  MessageSquare,
  Bell,
  BellRing,
  CheckCircle2,
  Hash,
  Lock,
  ArrowLeft,
  Send,
  Mic,
  Paperclip,
  Smile,
  Video,
  Search,
  Plus,
  LayoutGrid,
  Share,
  Smartphone,
  Sparkles,
  X,
  Volume2,
  FileText,
  ExternalLink
} from 'lucide-react';
import {
  collection,
  doc,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  increment
} from 'firebase/firestore';
import {
  ref as rtdbRef,
  onValue,
  onDisconnect,
  update as rtdbUpdate,
  set as rtdbSet,
  remove as rtdbRemove,
  serverTimestamp as rtdbServerTimestamp
} from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, rtdb, storage } from '../config/firebase';
import { useAuth, crearEspacioGoogleMeet } from '../context/AuthContext';
import WhatsappInterface from './WhatsappInterface';
import {
  detectarEntornoMovilPWA,
  registrarServiceWorkerPWA,
  activarNotificacionesPushDispositivo,
  desactivarNotificacionesPushDispositivo,
  actualizarBadgeApp,
  reproducirSonidoNotificacion,
  mostrarNotificacionDispositivo,
  dispararPushWorkspaceBackend
} from '../utils/pwaNotifications';

const emailToRtdbKey = (email = '') => email.toLowerCase().replace(/[.#$[\]/]/g, '_');

const ESTADOS_USUARIO = [
  { id: 'disponible', emoji: '🟢', texto: 'Disponible', color: '#22c55e' },
  { id: 'audiencia', emoji: '🏛️', texto: 'En audiencia judicial', color: '#dc2626' },
  { id: 'reunion', emoji: '📅', texto: 'En reunión', color: '#f59e0b' },
  { id: 'enfoque', emoji: '📝', texto: 'Redactando escrito / Enfoque', color: '#3b82f6' },
  { id: 'mision', emoji: '✈️', texto: 'En misión oficial', color: '#0284c7' },
  { id: 'plazo', emoji: '🔕', texto: 'Plazo fatal / No molestar', color: '#b91c1c' },
  { id: 'ausente', emoji: '🌴', texto: 'Ausente / Vacaciones', color: '#94a3b8' }
];

const EMOJIS_REACCION = ['👍', '❤️', '⚖️', '✅', '🙏', '🔥', '👀'];

export default function PwaComunicacionesMobile({
  user,
  userRole = 'Abogado/a',
  onIrAlHubIntranet,
  initialTab = 'whatsapp',
  initialWhatsappChatId = null,
  initialWorkspaceChannelId = null
}) {
  const { logout } = useAuth();
  const currentUserEmail = (user?.email || '').toLowerCase().trim();
  const currentUserName = user?.displayName || currentUserEmail.split('@')[0] || 'Usuario';

  // Pestaña activa del Switcher Superior: 'whatsapp' | 'workspace'
  const [activeAppTab, setActiveAppTab] = useState(initialTab || 'whatsapp');
  const [deepLinkWaChatId, setDeepLinkWaChatId] = useState(initialWhatsappChatId || null);
  const [waHasActiveChat, setWaHasActiveChat] = useState(false);

  // Estado de Notificaciones Push y Entorno PWA
  const [entornoPwa, setEntornoPwa] = useState(() => detectarEntornoMovilPWA());
  const [permisoNotif, setPermisoNotif] = useState(() =>
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  );
  const [activandoPush, setActivandoPush] = useState(false);
  const [modalNotifOpen, setModalNotifOpen] = useState(false);
  const [notifFeedback, setNotifFeedback] = useState(null);
  const [ocultarBannerIos, setOcultarBannerIos] = useState(false);

  // Banner Heads-Up In-App cuando llega un mensaje del otro módulo
  const [inAppBanner, setInAppBanner] = useState(null);
  const bannerTimerRef = useRef(null);

  // =========================================================================
  // 1. ESTADO COMPARTIDO DE PRESENCIA EN TIEMPO REAL Y CONTADORES NO LEÍDOS
  // =========================================================================
  const [usuariosEquipo, setUsuariosEquipo] = useState([]);
  const [presenciaMap, setPresenciaMap] = useState({});
  const [canalesWorkspace, setCanalesWorkspace] = useState([]);
  const [whatsappChats, setWhatsappChats] = useState([]);

  // Estado para el Popover de Disponibilidad y Estado Personalizado
  const [anchorEstado, setAnchorEstado] = useState(null);
  const [customStatusEmoji, setCustomStatusEmoji] = useState('💬');
  const [customStatusTexto, setCustomStatusTexto] = useState('');

  // Estado de navegación dentro de Workspace Móvil
  const [canalWorkspaceActivoId, setCanalWorkspaceActivoId] = useState(
    initialWorkspaceChannelId || null
  );
  const [filtroWorkspace, setFiltroWorkspace] = useState('todos'); // 'todos' | 'no_leidos' | 'canales' | 'directos'
  const [busquedaWorkspace, setBusquedaWorkspace] = useState('');
  const [mensajesWorkspace, setMensajesWorkspace] = useState([]);
  const [loadingMensajesWs, setLoadingMensajesWs] = useState(false);
  const [textoMensajeWs, setTextoMensajeWs] = useState('');
  const [enviandoWs, setEnviandoWs] = useState(false);
  const [subiendoArchivoWs, setSubiendoArchivoWs] = useState(false);
  const [grabandoAudioWs, setGrabandoAudioWs] = useState(false);
  const [segundosAudioWs, setSegundosAudioWs] = useState(0);
  const [usuariosEscribiendoWs, setUsuariosEscribiendoWs] = useState([]);
  const [creandoMeetWs, setCreandoMeetWs] = useState(false);
  const [mensajeHiloPadreWs, setMensajeHiloPadreWs] = useState(null);
  const [textoRespuestaHiloWs, setTextoRespuestaHiloWs] = useState('');
  const [anchorEmojiWs, setAnchorEmojiWs] = useState(null);

  const wsMessagesEndRef = useRef(null);
  const wsMediaRecorderRef = useRef(null);
  const wsAudioChunksRef = useRef([]);
  const wsAudioIntervalRef = useRef(null);
  const prevWaSnapshotRef = useRef({});
  const prevWsSnapshotRef = useRef({});
  const initialLoadDoneRef = useRef({ wa: false, ws: false });

  // Registrar Service Worker y escuchar eventos de Deep Link al tocar notificaciones Push
  useEffect(() => {
    registrarServiceWorkerPWA();
    const handleResize = () => setEntornoPwa(detectarEntornoMovilPWA());
    window.addEventListener('resize', handleResize);

    const handleSwMessage = (event) => {
      const msg = event.data || {};
      if (msg.type === 'PWA_DEEP_LINK') {
        const d = msg.data || {};
        if (d.tab === 'workspace') {
          setActiveAppTab('workspace');
          if (d.channelId) setCanalWorkspaceActivoId(d.channelId);
        } else if (d.tab === 'whatsapp') {
          setActiveAppTab('whatsapp');
          if (d.chatId) setDeepLinkWaChatId(d.chatId);
        }
      }
    };

    navigator.serviceWorker?.addEventListener('message', handleSwMessage);
    return () => {
      window.removeEventListener('resize', handleResize);
      navigator.serviceWorker?.removeEventListener('message', handleSwMessage);
    };
  }, []);

  // Reaccionar a cambios en props de deep link iniciales
  useEffect(() => {
    if (initialTab) setActiveAppTab(initialTab);
    if (initialWhatsappChatId) setDeepLinkWaChatId(initialWhatsappChatId);
    if (initialWorkspaceChannelId) setCanalWorkspaceActivoId(initialWorkspaceChannelId);
  }, [initialTab, initialWhatsappChatId, initialWorkspaceChannelId]);

  const mostrarInAppToast = (payload) => {
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    setInAppBanner(payload);
    bannerTimerRef.current = setTimeout(() => {
      setInAppBanner(null);
    }, 5500);
  };

  // =========================================================================
  // 2. PRESENCIA ACTIVA EN REALTIME DATABASE (SIEMPRE ONLINE EN MÓVIL)
  // =========================================================================
  useEffect(() => {
    if (!currentUserEmail) return;

    const userKey = emailToRtdbKey(currentUserEmail);
    const miPresenciaRtdbRef = rtdbRef(rtdb, `presencia/${userKey}`);
    const connectedRef = rtdbRef(rtdb, '.info/connected');

    const unsubConnected = onValue(connectedRef, async (snap) => {
      if (snap.val() === true) {
        try {
          await onDisconnect(miPresenciaRtdbRef).update({
            email: currentUserEmail,
            enLinea: false,
            ultimaConexionMs: rtdbServerTimestamp()
          });

          await rtdbUpdate(miPresenciaRtdbRef, {
            email: currentUserEmail,
            nombre: currentUserName,
            avatar: user?.photoURL || '',
            rol: userRole,
            enLinea: true,
            dispositivo: 'movil_pwa',
            ultimaConexionMs: rtdbServerTimestamp()
          });
        } catch (err) {
          console.error('Error registrando presencia móvil en RTDB:', err);
        }
      }
    });

    const presenciaRootRef = rtdbRef(rtdb, 'presencia');
    const unsubPresencia = onValue(presenciaRootRef, (snap) => {
      const val = snap.val() || {};
      const mapa = {};
      Object.values(val).forEach((item) => {
        if (item && item.email) {
          mapa[item.email.toLowerCase()] = item;
        }
      });
      setPresenciaMap(mapa);
    });

    const unsubUsers = onSnapshot(collection(db, 'usuarios_autorizados'), (snap) => {
      const lista = snap.docs
        .map((d) => {
          const data = d.data();
          const email = d.id.toLowerCase();
          return {
            email,
            nombre: data.nombre || email.split('@')[0],
            rol: data.rol || 'Abogado/a'
          };
        })
        .filter((u) => u.email !== 'webmaster@iiresodh.org');
      setUsuariosEquipo(lista);
    });

    return () => {
      unsubConnected();
      unsubPresencia();
      unsubUsers();
    };
  }, [currentUserEmail, currentUserName, user?.photoURL, userRole]);

  // Escuchar WhatsApp Chats en tiempo real para el contador global y alertas cruzadas
  useEffect(() => {
    const qWa = query(collection(db, 'whatsapp_chats'), orderBy('ultima_fecha', 'desc'));
    const unsubWa = onSnapshot(qWa, (snap) => {
      const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setWhatsappChats(lista);

      // Detectar nuevos mensajes entrantes de WhatsApp para avisar si el usuario está en Workspace
      if (initialLoadDoneRef.current.wa) {
        lista.forEach((chat) => {
          const prevUnread = prevWaSnapshotRef.current[chat.id] || 0;
          const currUnread = Number(chat.no_leidos) || 0;
          if (currUnread > prevUnread) {
            reproducirSonidoNotificacion('whatsapp');
            const titulo = `🟢 WhatsApp · ${chat.nombre || `+${chat.telefono || chat.id}`}`;
            const cuerpo = chat.ultimo_mensaje || 'Nuevo mensaje recibido';

            if (activeAppTab !== 'whatsapp' || document.hidden) {
              mostrarInAppToast({
                tipo: 'whatsapp',
                titulo,
                cuerpo,
                onClick: () => {
                  setActiveAppTab('whatsapp');
                  setDeepLinkWaChatId(chat.id);
                  setInAppBanner(null);
                }
              });
              if (document.hidden) {
                mostrarNotificacionDispositivo({
                  title: titulo,
                  body: cuerpo,
                  data: {
                    tab: 'whatsapp',
                    chatId: chat.id,
                    tag: `wa-${chat.id}`,
                    url: `/?app=comms&tab=whatsapp&chatId=${chat.id}`
                  }
                });
              }
            }
          }
        });
      }

      const nextMap = {};
      lista.forEach((c) => {
        nextMap[c.id] = Number(c.no_leidos) || 0;
      });
      prevWaSnapshotRef.current = nextMap;
      initialLoadDoneRef.current.wa = true;
    });

    return () => unsubWa();
  }, [activeAppTab]);

  // Escuchar Canales y DMs de Workspace en tiempo real
  useEffect(() => {
    if (!currentUserEmail) return;
    const qWs = query(collection(db, 'workspace_canales'), orderBy('orden', 'asc'));
    const unsubWs = onSnapshot(qWs, (snap) => {
      const todos = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const visibles = todos.filter((c) => {
        if (c.tipo === 'dm') {
          return Array.isArray(c.participantes) && c.participantes.includes(currentUserEmail);
        }
        if (c.esPrivado) {
          return (
            (Array.isArray(c.miembros) && c.miembros.includes(currentUserEmail)) ||
            (c.creadoPor || '').toLowerCase() === currentUserEmail
          );
        }
        return true;
      });
      setCanalesWorkspace(visibles);

      // Detectar nuevos mensajes entrantes de Workspace para avisar si el usuario está en WhatsApp
      if (initialLoadDoneRef.current.ws) {
        visibles.forEach((canal) => {
          const prevMs = prevWsSnapshotRef.current[canal.id] || 0;
          const currMs = canal.ultimoMensajeMs || 0;
          if (
            currMs > prevMs &&
            canal.ultimoMensajeAutor &&
            canal.ultimoMensajeAutor !== currentUserName &&
            canal.ultimoMensajeAutor !== nombrePersonaConectada
          ) {
            reproducirSonidoNotificacion('workspace');
            const titulo =
              canal.tipo === 'dm'
                ? `💬 ${canal.ultimoMensajeAutor}`
                : `💬 #${canal.nombre} · ${canal.ultimoMensajeAutor}`;
            const cuerpo = canal.ultimoMensajeTexto || 'Nuevo mensaje en Workspace';

            const viendoEsteCanal =
              activeAppTab === 'workspace' && canalWorkspaceActivoId === canal.id && !document.hidden;

            if (!viendoEsteCanal) {
              mostrarInAppToast({
                tipo: 'workspace',
                titulo,
                cuerpo,
                onClick: () => {
                  setActiveAppTab('workspace');
                  setCanalWorkspaceActivoId(canal.id);
                  setInAppBanner(null);
                }
              });
              if (document.hidden) {
                mostrarNotificacionDispositivo({
                  title: titulo,
                  body: cuerpo,
                  data: {
                    tab: 'workspace',
                    channelId: canal.id,
                    tag: `ws-${canal.id}`,
                    url: `/?app=comms&tab=workspace&channelId=${canal.id}`
                  }
                });
              }
            }
          }
        });
      }

      const nextWsMap = {};
      visibles.forEach((c) => {
        nextWsMap[c.id] = c.ultimoMensajeMs || 0;
      });
      prevWsSnapshotRef.current = nextWsMap;
      initialLoadDoneRef.current.ws = true;
    });

    return () => unsubWs();
  }, [currentUserEmail, currentUserName, activeAppTab, canalWorkspaceActivoId]);

  // =========================================================================
  // 3. CÁLCULO DE IDENTIDAD, ESTADO ACTUAL Y CONTADORES DE NO LEÍDOS
  // =========================================================================
  const miPresencia = presenciaMap[currentUserEmail] || {};
  const miRegistroEquipo = useMemo(
    () => usuariosEquipo.find((u) => u.email.toLowerCase() === currentUserEmail),
    [usuariosEquipo, currentUserEmail]
  );
  const nombrePersonaConectada =
    miRegistroEquipo?.nombre || miPresencia?.nombre || currentUserName;

  const miEstadoActual = useMemo(() => {
    if (miPresencia.estadoId === 'personalizado' && miPresencia.estadoTexto) {
      return {
        id: 'personalizado',
        emoji: miPresencia.estadoEmoji || '💬',
        texto: miPresencia.estadoTexto,
        color: '#38bdf8'
      };
    }
    return ESTADOS_USUARIO.find((e) => e.id === miPresencia.estadoId) || ESTADOS_USUARIO[0];
  }, [miPresencia]);

  const estaEnLinea = (email) => {
    const p = presenciaMap[(email || '').toLowerCase()];
    return Boolean(p && p.enLinea === true && p.estadoId !== 'ausente');
  };

  const tieneNoLeidosWorkspace = (canal) => {
    if (!canal) return false;
    if (activeAppTab === 'workspace' && canal.id === canalWorkspaceActivoId) return false;
    const ultimoMs = canal.ultimoMensajeMs || 0;
    const miLecturaMs = miPresencia?.lecturasCanales?.[canal.id] || 0;
    return (
      ultimoMs > miLecturaMs &&
      canal.ultimoMensajeAutor &&
      canal.ultimoMensajeAutor !== currentUserName &&
      canal.ultimoMensajeAutor !== nombrePersonaConectada
    );
  };

  const totalNoLeidosWhatsapp = useMemo(
    () => whatsappChats.reduce((acc, c) => acc + (Number(c.no_leidos) || 0), 0),
    [whatsappChats]
  );

  const totalNoLeidosWorkspace = useMemo(
    () => canalesWorkspace.filter((c) => tieneNoLeidosWorkspace(c)).length,
    [canalesWorkspace, miPresencia, activeAppTab, canalWorkspaceActivoId]
  );

  // Actualizar el globo numérico (App Badge) en el ícono de la pantalla de inicio del teléfono
  useEffect(() => {
    actualizarBadgeApp(totalNoLeidosWhatsapp + totalNoLeidosWorkspace);
  }, [totalNoLeidosWhatsapp, totalNoLeidosWorkspace]);

  // Cambiar estado de disponibilidad en RTDB y Firestore
  const cambiarEstadoUsuario = async (estadoObj) => {
    if (!currentUserEmail) return;
    const userKey = emailToRtdbKey(currentUserEmail);
    const payload = {
      email: currentUserEmail,
      estadoId: estadoObj.id,
      estadoEmoji: estadoObj.emoji,
      estadoTexto: estadoObj.texto,
      enLinea: estadoObj.id !== 'ausente',
      ultimaConexionMs: Date.now()
    };
    try {
      await rtdbUpdate(rtdbRef(rtdb, `presencia/${userKey}`), payload);
      await setDoc(doc(db, 'workspace_presencia', currentUserEmail), payload, { merge: true });
      setAnchorEstado(null);
    } catch (e) {
      console.error('Error actualizando estado:', e);
    }
  };

  const guardarEstadoPersonalizado = async () => {
    if (!customStatusTexto.trim()) return;
    await cambiarEstadoUsuario({
      id: 'personalizado',
      emoji: customStatusEmoji || '💬',
      texto: customStatusTexto.trim()
    });
  };

  // =========================================================================
  // 4. LÓGICA DEL MÓDULO WORKSPACE MÓVIL (CANALES, DMs, HILOS Y VOZ)
  // =========================================================================
  const canalWorkspaceActivo = useMemo(
    () => canalesWorkspace.find((c) => c.id === canalWorkspaceActivoId) || null,
    [canalesWorkspace, canalWorkspaceActivoId]
  );

  const obtenerTituloCanalWs = (canal) => {
    if (!canal) return 'Canal';
    if (canal.tipo === 'dm') {
      const otroEmail =
        (canal.participantes || []).find((e) => e !== currentUserEmail) || currentUserEmail;
      const colega = usuariosEquipo.find((u) => u.email === otroEmail);
      return colega?.nombre || canal.nombresMap?.[otroEmail] || otroEmail;
    }
    return canal.nombre;
  };

  // Marcar canal como leído al abrirlo en móvil y cargar sus mensajes en tiempo real
  useEffect(() => {
    if (!canalWorkspaceActivoId || !currentUserEmail) {
      setMensajesWorkspace([]);
      return;
    }

    const userKey = emailToRtdbKey(currentUserEmail);
    const ahora = Date.now();
    rtdbUpdate(rtdbRef(rtdb, `presencia/${userKey}/lecturasCanales`), {
      [canalWorkspaceActivoId]: ahora
    }).catch(() => {});

    setLoadingMensajesWs(true);
    const qMsgs = query(
      collection(db, 'workspace_canales', canalWorkspaceActivoId, 'mensajes'),
      orderBy('creadoEnMs', 'asc')
    );

    const unsubMsgs = onSnapshot(
      qMsgs,
      (snap) => {
        const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setMensajesWorkspace(lista);
        setLoadingMensajesWs(false);
        setTimeout(() => {
          wsMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 80);
      },
      () => setLoadingMensajesWs(false)
    );

    // Escuchar quién está escribiendo en este canal
    const typingRef = rtdbRef(rtdb, `typing/${canalWorkspaceActivoId}`);
    const unsubTyping = onValue(typingRef, (snap) => {
      const val = snap.val() || {};
      const now = Date.now();
      const activos = Object.values(val).filter(
        (t) =>
          t &&
          t.email &&
          t.email.toLowerCase() !== currentUserEmail &&
          now - (t.timestamp || 0) < 7000
      );
      setUsuariosEscribiendoWs(activos);
    });

    return () => {
      unsubMsgs();
      unsubTyping();
    };
  }, [canalWorkspaceActivoId, currentUserEmail]);

  const abrirDmConColega = async (colega) => {
    if (!colega?.email || !currentUserEmail) return;
    const emailsOrd = [currentUserEmail, colega.email.toLowerCase()].sort();
    const dmId = `dm_${emailsOrd[0].replace(/[^a-z0-9]/g, '_')}_${emailsOrd[1].replace(/[^a-z0-9]/g, '_')}`;
    const existente = canalesWorkspace.find((c) => c.id === dmId);

    if (!existente) {
      await setDoc(
        doc(db, 'workspace_canales', dmId),
        {
          nombre: `${nombrePersonaConectada} & ${colega.nombre}`,
          tipo: 'dm',
          esPrivado: true,
          participantes: emailsOrd,
          nombresMap: {
            [currentUserEmail]: nombrePersonaConectada,
            [colega.email.toLowerCase()]: colega.nombre
          },
          orden: 999,
          creadoEn: serverTimestamp(),
          ultimoMensajeAt: serverTimestamp(),
          ultimoMensajeMs: Date.now(),
          ultimoMensajeTexto: 'Conversación directa iniciada'
        },
        { merge: true }
      );
    }
    setCanalWorkspaceActivoId(dmId);
  };

  const handleEscribirTextoWs = (valor) => {
    setTextoMensajeWs(valor);
    if (!canalWorkspaceActivoId || !currentUserEmail) return;
    const userKey = emailToRtdbKey(currentUserEmail);
    const miTypingRef = rtdbRef(rtdb, `typing/${canalWorkspaceActivoId}/${userKey}`);
    if (valor.trim()) {
      rtdbSet(miTypingRef, {
        email: currentUserEmail,
        nombre: nombrePersonaConectada,
        timestamp: Date.now()
      }).catch(() => {});
    } else {
      rtdbRemove(miTypingRef).catch(() => {});
    }
  };

  const handleEnviarMensajeWs = async (esHilo = false) => {
    const texto = esHilo ? textoRespuestaHiloWs.trim() : textoMensajeWs.trim();
    if (!texto || !canalWorkspaceActivoId || enviandoWs) return;

    setEnviandoWs(true);
    if (esHilo) {
      setTextoRespuestaHiloWs('');
    } else {
      setTextoMensajeWs('');
      const userKey = emailToRtdbKey(currentUserEmail);
      rtdbRemove(rtdbRef(rtdb, `typing/${canalWorkspaceActivoId}/${userKey}`)).catch(() => {});
    }

    try {
      await addDoc(collection(db, 'workspace_canales', canalWorkspaceActivoId, 'mensajes'), {
        texto,
        autorEmail: currentUserEmail,
        autorNombre: nombrePersonaConectada,
        autorAvatar: user?.photoURL || '',
        autorRol: userRole,
        creadoEn: serverTimestamp(),
        creadoEnMs: Date.now(),
        reacciones: {},
        fijado: false,
        adjuntos: [],
        parentId: esHilo && mensajeHiloPadreWs ? mensajeHiloPadreWs.id : null,
        respuestasCount: 0
      });

      if (esHilo && mensajeHiloPadreWs) {
        await updateDoc(
          doc(db, 'workspace_canales', canalWorkspaceActivoId, 'mensajes', mensajeHiloPadreWs.id),
          {
            respuestasCount: increment(1),
            ultimaRespuestaAt: serverTimestamp(),
            ultimaRespuestaAutor: nombrePersonaConectada
          }
        );
      } else {
        await updateDoc(doc(db, 'workspace_canales', canalWorkspaceActivoId), {
          ultimoMensajeAt: serverTimestamp(),
          ultimoMensajeMs: Date.now(),
          ultimoMensajeTexto: texto,
          ultimoMensajeAutor: nombrePersonaConectada
        });
      }

      dispararPushWorkspaceBackend({
        canalId: canalWorkspaceActivoId,
        canalNombre: obtenerTituloCanalWs(canalWorkspaceActivo),
        esDm: canalWorkspaceActivo?.tipo === 'dm',
        texto,
        autorEmail: currentUserEmail,
        autorNombre: nombrePersonaConectada,
        destinatarios:
          canalWorkspaceActivo?.tipo === 'dm'
            ? canalWorkspaceActivo.participantes || []
            : canalWorkspaceActivo?.esPrivado
            ? canalWorkspaceActivo.miembros || []
            : []
      });
    } catch (e) {
      console.error('Error enviando mensaje en Workspace móvil:', e);
    } finally {
      setEnviandoWs(false);
    }
  };

  // Subir foto o archivo adjunto en Workspace Móvil
  const handleSubirArchivoWs = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !canalWorkspaceActivoId) return;
    setSubiendoArchivoWs(true);
    try {
      const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const refSt = storageRef(storage, `workspace_archivos/${canalWorkspaceActivoId}/${safeName}`);
      await uploadBytes(refSt, file, { contentType: file.type || 'application/octet-stream' });
      const url = await getDownloadURL(refSt);

      const adjunto = {
        nombre: file.name,
        url,
        tipo: file.type || 'application/octet-stream',
        tamano: file.size
      };

      await addDoc(collection(db, 'workspace_canales', canalWorkspaceActivoId, 'mensajes'), {
        texto: textoMensajeWs.trim() || `📎 Archivo adjunto: ${file.name}`,
        autorEmail: currentUserEmail,
        autorNombre: nombrePersonaConectada,
        autorAvatar: user?.photoURL || '',
        autorRol: userRole,
        creadoEn: serverTimestamp(),
        creadoEnMs: Date.now(),
        reacciones: {},
        fijado: false,
        adjuntos: [adjunto],
        parentId: null,
        respuestasCount: 0
      });

      await updateDoc(doc(db, 'workspace_canales', canalWorkspaceActivoId), {
        ultimoMensajeAt: serverTimestamp(),
        ultimoMensajeMs: Date.now(),
        ultimoMensajeTexto: `📎 ${file.name}`,
        ultimoMensajeAutor: nombrePersonaConectada
      });

      dispararPushWorkspaceBackend({
        canalId: canalWorkspaceActivoId,
        canalNombre: obtenerTituloCanalWs(canalWorkspaceActivo),
        esDm: canalWorkspaceActivo?.tipo === 'dm',
        texto: `📎 Archivo: ${file.name}`,
        autorEmail: currentUserEmail,
        autorNombre: nombrePersonaConectada,
        destinatarios:
          canalWorkspaceActivo?.tipo === 'dm'
            ? canalWorkspaceActivo.participantes || []
            : canalWorkspaceActivo?.esPrivado
            ? canalWorkspaceActivo.miembros || []
            : []
      });

      setTextoMensajeWs('');
    } catch (err) {
      console.error('Error subiendo archivo a Workspace:', err);
    } finally {
      setSubiendoArchivoWs(false);
      e.target.value = null;
    }
  };

  // Grabar Nota de Voz en Workspace Móvil
  const iniciarGrabacionVozWs = async () => {
    if (!canalWorkspaceActivoId) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : '';
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      wsAudioChunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) wsAudioChunksRef.current.push(ev.data);
      };
      wsMediaRecorderRef.current = recorder;
      recorder.start();
      setGrabandoAudioWs(true);
      setSegundosAudioWs(0);
      wsAudioIntervalRef.current = setInterval(() => {
        setSegundosAudioWs((s) => s + 1);
      }, 1000);
    } catch (err) {
      console.error('Error accediendo al micrófono:', err);
    }
  };

  const cancelarGrabacionVozWs = () => {
    if (wsAudioIntervalRef.current) clearInterval(wsAudioIntervalRef.current);
    if (wsMediaRecorderRef.current) {
      try {
        wsMediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
        wsMediaRecorderRef.current.stop();
      } catch {
        // Silencioso
      }
      wsMediaRecorderRef.current = null;
    }
    wsAudioChunksRef.current = [];
    setGrabandoAudioWs(false);
    setSegundosAudioWs(0);
  };

  const enviarGrabacionVozWs = async () => {
    if (!wsMediaRecorderRef.current || !canalWorkspaceActivoId) return;
    if (wsAudioIntervalRef.current) clearInterval(wsAudioIntervalRef.current);
    const recorder = wsMediaRecorderRef.current;
    const mimeType = recorder.mimeType || 'audio/webm';
    const duracionSegs = segundosAudioWs;

    setGrabandoAudioWs(false);
    setSubiendoArchivoWs(true);

    try {
      const blob = await new Promise((resolve) => {
        recorder.onstop = () => {
          recorder.stream.getTracks().forEach((t) => t.stop());
          resolve(new Blob(wsAudioChunksRef.current, { type: mimeType }));
        };
        recorder.stop();
      });
      wsMediaRecorderRef.current = null;

      const ext = mimeType.includes('mp4') ? 'm4a' : 'webm';
      const fileName = `voz_ws_${Date.now()}.${ext}`;
      const refSt = storageRef(storage, `workspace_audios/${canalWorkspaceActivoId}/${fileName}`);
      await uploadBytes(refSt, blob, { contentType: mimeType });
      const url = await getDownloadURL(refSt);

      await addDoc(collection(db, 'workspace_canales', canalWorkspaceActivoId, 'mensajes'), {
        texto: '',
        autorEmail: currentUserEmail,
        autorNombre: nombrePersonaConectada,
        autorAvatar: user?.photoURL || '',
        autorRol: userRole,
        creadoEn: serverTimestamp(),
        creadoEnMs: Date.now(),
        reacciones: {},
        fijado: false,
        adjuntos: [],
        audioAdjunto: {
          url,
          duracionSegundos: duracionSegs,
          nombre: `Nota de voz (${Math.floor(duracionSegs / 60)}:${String(duracionSegs % 60).padStart(2, '0')})`
        },
        parentId: null,
        respuestasCount: 0
      });

      await updateDoc(doc(db, 'workspace_canales', canalWorkspaceActivoId), {
        ultimoMensajeAt: serverTimestamp(),
        ultimoMensajeMs: Date.now(),
        ultimoMensajeTexto: '🎙️ Nota de voz',
        ultimoMensajeAutor: nombrePersonaConectada
      });

      dispararPushWorkspaceBackend({
        canalId: canalWorkspaceActivoId,
        canalNombre: obtenerTituloCanalWs(canalWorkspaceActivo),
        esDm: canalWorkspaceActivo?.tipo === 'dm',
        texto: '🎙️ Nota de voz',
        autorEmail: currentUserEmail,
        autorNombre: nombrePersonaConectada,
        destinatarios:
          canalWorkspaceActivo?.tipo === 'dm'
            ? canalWorkspaceActivo.participantes || []
            : canalWorkspaceActivo?.esPrivado
            ? canalWorkspaceActivo.miembros || []
            : []
      });
    } catch (e) {
      console.error('Error enviando nota de voz Workspace:', e);
    } finally {
      setSubiendoArchivoWs(false);
      setSegundosAudioWs(0);
    }
  };

  const handleToggleReaccionWs = async (msg, emoji) => {
    if (!canalWorkspaceActivoId) return;
    try {
      const reacciones = { ...(msg.reacciones || {}) };
      const lista = Array.isArray(reacciones[emoji]) ? [...reacciones[emoji]] : [];
      const idx = lista.indexOf(currentUserEmail);
      if (idx > -1) lista.splice(idx, 1);
      else lista.push(currentUserEmail);
      if (lista.length === 0) delete reacciones[emoji];
      else reacciones[emoji] = lista;

      await updateDoc(
        doc(db, 'workspace_canales', canalWorkspaceActivoId, 'mensajes', msg.id),
        { reacciones }
      );
    } catch (e) {
      console.error('Error reaccionando:', e);
    }
  };

  const handleIniciarMeetWs = async () => {
    if (!canalWorkspaceActivoId || creandoMeetWs) return;
    setCreandoMeetWs(true);
    try {
      const espacio = await crearEspacioGoogleMeet(currentUserEmail);
      if (espacio?.meetingUri) {
        const meetObj = {
          meetingUri: espacio.meetingUri,
          meetingCode: espacio.meetingCode,
          titulo: `Sala de ${obtenerTituloCanalWs(canalWorkspaceActivo)}`,
          creadoPorNombre: nombrePersonaConectada,
          creadoEnMs: Date.now()
        };
        await addDoc(collection(db, 'workspace_canales', canalWorkspaceActivoId, 'mensajes'), {
          texto: `📹 *${nombrePersonaConectada}* inició una sala de Google Meet: ${espacio.meetingUri}`,
          autorEmail: currentUserEmail,
          autorNombre: nombrePersonaConectada,
          autorAvatar: user?.photoURL || '',
          autorRol: userRole,
          creadoEn: serverTimestamp(),
          creadoEnMs: Date.now(),
          reacciones: {},
          fijado: false,
          adjuntos: [],
          meetAdjunto: meetObj,
          parentId: null,
          respuestasCount: 0
        });
        window.open(espacio.meetingUri, '_blank', 'noopener,noreferrer');
      }
    } catch (e) {
      console.error('Error creando Meet en móvil:', e);
    } finally {
      setCreandoMeetWs(false);
    }
  };

  // Activar Notificaciones Push en el teléfono (Android e iOS 16.4+)
  const handleActivarPush = async () => {
    setActivandoPush(true);
    setNotifFeedback(null);
    try {
      const res = await activarNotificacionesPushDispositivo({
        userEmail: currentUserEmail,
        userName: nombrePersonaConectada,
        userRole
      });
      setPermisoNotif('granted');
      setNotifFeedback({
        tipo: 'success',
        texto: res.fcmToken
          ? 'Notificaciones Push activadas en este dispositivo para WhatsApp y Workspace.'
          : 'Notificaciones locales activadas en este dispositivo.'
      });
      reproducirSonidoNotificacion('whatsapp');
    } catch (err) {
      setPermisoNotif(
        typeof window !== 'undefined' && 'Notification' in window
          ? Notification.permission
          : 'denied'
      );
      setNotifFeedback({
        tipo: 'error',
        texto: err.message || 'No se pudieron activar las notificaciones.'
      });
    } finally {
      setActivandoPush(false);
    }
  };

  const handleProbarNotificacion = async () => {
    reproducirSonidoNotificacion('whatsapp');
    await mostrarNotificacionDispositivo({
      title: '🟢 IIRESODH Comunicaciones',
      body: '¡Tus notificaciones de WhatsApp y Workspace están funcionando correctamente!',
      data: { tab: activeAppTab, url: '/?app=comms' }
    });
  };

  // Listas filtradas para el Directorio de Workspace Móvil
  const canalesTematicosWs = useMemo(() => {
    const base = canalesWorkspace.filter((c) => c.tipo !== 'dm');
    return base.filter((c) => {
      if (
        busquedaWorkspace.trim() &&
        !c.nombre?.toLowerCase().includes(busquedaWorkspace.toLowerCase())
      ) {
        return false;
      }
      if (filtroWorkspace === 'no_leidos') return tieneNoLeidosWorkspace(c);
      return true;
    });
  }, [canalesWorkspace, busquedaWorkspace, filtroWorkspace, miPresencia]);

  const colegasFiltradosWs = useMemo(() => {
    const otros = usuariosEquipo.filter((u) => u.email.toLowerCase() !== currentUserEmail);
    const filtrados = otros.filter((u) => {
      if (
        busquedaWorkspace.trim() &&
        !u.nombre.toLowerCase().includes(busquedaWorkspace.toLowerCase()) &&
        !u.email.toLowerCase().includes(busquedaWorkspace.toLowerCase())
      ) {
        return false;
      }
      if (filtroWorkspace === 'no_leidos') {
        const emailsOrd = [currentUserEmail, u.email.toLowerCase()].sort();
        const dmId = `dm_${emailsOrd[0].replace(/[^a-z0-9]/g, '_')}_${emailsOrd[1].replace(/[^a-z0-9]/g, '_')}`;
        const canalDm = canalesWorkspace.find((c) => c.id === dmId);
        return canalDm ? tieneNoLeidosWorkspace(canalDm) : false;
      }
      return true;
    });

    return [...filtrados].sort((a, b) => {
      const aOnline = estaEnLinea(a.email) ? 1 : 0;
      const bOnline = estaEnLinea(b.email) ? 1 : 0;
      if (bOnline !== aOnline) return bOnline - aOnline;
      return (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' });
    });
  }, [usuariosEquipo, busquedaWorkspace, filtroWorkspace, currentUserEmail, presenciaMap, canalesWorkspace]);

  const mensajesPrincipalesWs = useMemo(
    () => mensajesWorkspace.filter((m) => !m.parentId),
    [mensajesWorkspace]
  );

  const respuestasHiloActivasWs = useMemo(() => {
    if (!mensajeHiloPadreWs) return [];
    return mensajesWorkspace.filter((m) => m.parentId === mensajeHiloPadreWs.id);
  }, [mensajesWorkspace, mensajeHiloPadreWs]);

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: '#0f172a',
        overflow: 'hidden',
        fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
        zIndex: 1200
      }}
    >
      {/* =================================================================== */}
      {/* BANNER FLOTANTE CROSS-APP (CUANDO LLEGA WHATSAPP O SLACK EN VIVO)   */}
      {/* =================================================================== */}
      {inAppBanner && (
        <Box
          onClick={inAppBanner.onClick}
          sx={{
            position: 'fixed',
            top: 'calc(env(safe-area-inset-top, 0px) + 8px)',
            left: 12,
            right: 12,
            zIndex: 2500,
            bgcolor: '#0f172a',
            color: '#ffffff',
            p: 1.35,
            borderRadius: '0 12px 12px 0',
            border: '1px solid rgba(255,255,255,0.16)',
            borderLeft:
              inAppBanner.tipo === 'whatsapp' ? '4px solid #10b981' : '4px solid #38bdf8',
            boxShadow: '0 14px 34px rgba(15, 23, 42, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1.25,
            cursor: 'pointer'
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography
              noWrap
              sx={{ fontSize: '0.78rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.01em' }}
            >
              {inAppBanner.titulo}
            </Typography>
            <Typography noWrap sx={{ fontSize: '0.74rem', color: '#cbd5e1', mt: 0.15 }}>
              {inAppBanner.cuerpo}
            </Typography>
          </Box>
          <ChipOrBadge label="Abrir" color={inAppBanner.tipo === 'whatsapp' ? '#10b981' : '#38bdf8'} />
        </Box>
      )}

      {/* =================================================================== */}
      {/* BARRA SUPERIOR UNIFICADA: ISOTIPO + SWITCHER (WHATSAPP / WORKSPACE) */}
      {/* =================================================================== */}
      <Box
        sx={{
          pt: 'env(safe-area-inset-top, 0px)',
          bgcolor: '#0f172a',
          color: '#ffffff',
          borderBottom: '1px solid rgba(255,255,255,0.09)',
          flexShrink: 0,
          zIndex: 10
        }}
      >
        <Box
          sx={{
            height: 52,
            px: 1.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1
          }}
        >
          {/* Izquierda: Isotipo IIRESODH + Estado del Usuario Conectado */}
          <Box
            onClick={(e) => setAnchorEstado(e.currentTarget)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.9,
              px: 0.85,
              py: 0.45,
              borderRadius: '8px',
              cursor: 'pointer',
              bgcolor: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              minWidth: 0,
              '&:hover': { bgcolor: 'rgba(255,255,255,0.12)' }
            }}
          >
            <Box sx={{ position: 'relative', flexShrink: 0, display: 'flex' }}>
              <img
                src="/iiresodh-isotipo-gradient.png"
                alt="IIRESODH"
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '6px',
                  backgroundColor: '#ffffff',
                  padding: 1.5,
                  objectFit: 'contain'
                }}
              />
              <Box
                sx={{
                  position: 'absolute',
                  bottom: -2,
                  right: -2,
                  width: 9,
                  height: 9,
                  borderRadius: '50%',
                  bgcolor: miEstadoActual.color,
                  border: '1.5px solid #0f172a'
                }}
              />
            </Box>
            <Box sx={{ minWidth: 0, display: { xs: 'none', sm: 'block' } }}>
              <Typography
                noWrap
                sx={{ fontSize: '0.73rem', fontWeight: 700, color: '#ffffff', lineHeight: 1.15 }}
              >
                {nombrePersonaConectada.split(' ')[0]}
              </Typography>
              <Typography
                noWrap
                sx={{ fontSize: '0.63rem', color: '#94a3b8', lineHeight: 1.1 }}
              >
                {miEstadoActual.emoji} {miEstadoActual.texto}
              </Typography>
            </Box>
          </Box>

          {/* Centro: Selector Píldora Dual (🟢 WhatsApp <-> 💬 Workspace) */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              bgcolor: 'rgba(255,255,255,0.08)',
              p: 0.4,
              borderRadius: '10px',
              border: '1px solid rgba(255,255,255,0.1)',
              flexGrow: 1,
              maxWidth: 310
            }}
          >
            <Box
              onClick={() => setActiveAppTab('whatsapp')}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 0.65,
                py: 0.6,
                px: 1,
                borderRadius: '7px',
                cursor: 'pointer',
                bgcolor: activeAppTab === 'whatsapp' ? '#10b981' : 'transparent',
                color: activeAppTab === 'whatsapp' ? '#ffffff' : '#cbd5e1',
                fontWeight: 700,
                fontSize: '0.76rem',
                transition: 'all 0.16s ease',
                boxShadow:
                  activeAppTab === 'whatsapp' ? '0 2px 8px rgba(16, 185, 129, 0.35)' : 'none'
              }}
            >
              <MessageCircle size={14} strokeWidth={2.4} />
              <span>WhatsApp</span>
              {totalNoLeidosWhatsapp > 0 && (
                <Box
                  component="span"
                  sx={{
                    px: 0.65,
                    py: 0.05,
                    borderRadius: '999px',
                    bgcolor: activeAppTab === 'whatsapp' ? '#064e3b' : '#10b981',
                    color: '#ffffff',
                    fontSize: '0.65rem',
                    fontWeight: 800,
                    fontVariantNumeric: 'tabular-nums',
                    lineHeight: 1.35
                  }}
                >
                  {totalNoLeidosWhatsapp}
                </Box>
              )}
            </Box>

            <Box
              onClick={() => setActiveAppTab('workspace')}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 0.65,
                py: 0.6,
                px: 1,
                borderRadius: '7px',
                cursor: 'pointer',
                bgcolor: activeAppTab === 'workspace' ? '#2563eb' : 'transparent',
                color: activeAppTab === 'workspace' ? '#ffffff' : '#cbd5e1',
                fontWeight: 700,
                fontSize: '0.76rem',
                transition: 'all 0.16s ease',
                boxShadow:
                  activeAppTab === 'workspace' ? '0 2px 8px rgba(37, 99, 235, 0.35)' : 'none'
              }}
            >
              <MessageSquare size={14} strokeWidth={2.4} />
              <span>Workspace</span>
              {totalNoLeidosWorkspace > 0 && (
                <Box
                  component="span"
                  sx={{
                    px: 0.65,
                    py: 0.05,
                    borderRadius: '999px',
                    bgcolor: activeAppTab === 'workspace' ? '#1e3a8a' : '#ef4444',
                    color: '#ffffff',
                    fontSize: '0.65rem',
                    fontWeight: 800,
                    fontVariantNumeric: 'tabular-nums',
                    lineHeight: 1.35
                  }}
                >
                  {totalNoLeidosWorkspace}
                </Box>
              )}
            </Box>
          </Box>

          {/* Derecha: Notificaciones Push (Android/iOS) + Acceso opcional al Hub */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <IconButton
              size="small"
              onClick={() => setModalNotifOpen(true)}
              sx={{
                width: 34,
                height: 34,
                borderRadius: '8px',
                bgcolor:
                  permisoNotif === 'granted'
                    ? 'rgba(16, 185, 129, 0.14)'
                    : 'rgba(245, 158, 11, 0.18)',
                color: permisoNotif === 'granted' ? '#34d399' : '#fbbf24',
                border: '1px solid',
                borderColor:
                  permisoNotif === 'granted'
                    ? 'rgba(16, 185, 129, 0.3)'
                    : 'rgba(245, 158, 11, 0.35)'
              }}
            >
              {permisoNotif === 'granted' ? <BellRing size={16} /> : <Bell size={16} />}
            </IconButton>

            {onIrAlHubIntranet && (
              <Tooltip title="Ir al Hub Completo de la Intranet">
                <IconButton
                  size="small"
                  onClick={onIrAlHubIntranet}
                  sx={{
                    width: 34,
                    height: 34,
                    borderRadius: '8px',
                    color: '#cbd5e1',
                    bgcolor: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)'
                  }}
                >
                  <LayoutGrid size={15} />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>

        {/* Asistente de Instalación iOS / Activación de Notificaciones en 1 Toque */}
        {entornoPwa.isIOS && !entornoPwa.isStandalone && !ocultarBannerIos ? (
          <Box
            sx={{
              bgcolor: '#1e293b',
              px: 1.5,
              py: 0.85,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1,
              borderTop: '1px solid rgba(255,255,255,0.08)'
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
              <Share size={15} color="#38bdf8" style={{ flexShrink: 0 }} />
              <Typography sx={{ fontSize: '0.72rem', color: '#e2e8f0', lineHeight: 1.35 }}>
                <strong>iPhone:</strong> Toca <strong>Compartir</strong> y{' '}
                <strong>"Agregar a inicio"</strong> para activar notificaciones Push.
              </Typography>
            </Box>
            <IconButton
              size="small"
              onClick={() => setOcultarBannerIos(true)}
              sx={{ color: '#94a3b8', p: 0.3 }}
            >
              <X size={14} />
            </IconButton>
          </Box>
        ) : permisoNotif !== 'granted' ? (
          <Box
            onClick={handleActivarPush}
            sx={{
              bgcolor: 'rgba(16, 185, 129, 0.14)',
              px: 1.5,
              py: 0.7,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1,
              cursor: 'pointer',
              borderTop: '1px solid rgba(16, 185, 129, 0.25)'
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.85 }}>
              <BellRing size={14} color="#34d399" />
              <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: '#ecfdf5' }}>
                Activa las notificaciones de WhatsApp y Workspace en tu teléfono
              </Typography>
            </Box>
            <Box
              sx={{
                px: 1,
                py: 0.25,
                borderRadius: '6px',
                bgcolor: '#10b981',
                color: '#ffffff',
                fontSize: '0.68rem',
                fontWeight: 700,
                flexShrink: 0
              }}
            >
              {activandoPush ? 'Activando...' : 'Activar'}
            </Box>
          </Box>
        ) : null}
      </Box>

      {/* =================================================================== */}
      {/* CUERPO PRINCIPAL: VISTA WHATSAPP O VISTA WORKSPACE MÓVIL            */}
      {/* =================================================================== */}
      <Box
        sx={{
          flexGrow: 1,
          minHeight: 0,
          width: '100%',
          bgcolor: '#ffffff',
          position: 'relative',
          overflow: 'hidden',
          pb: 'env(safe-area-inset-bottom, 0px)'
        }}
      >
        {/* ----------------------------------------------------------------- */}
        {/* MODO 1: WHATSAPP BUSINESS OFICIAL (100% PANTALLA COMPLETA)        */}
        {/* ----------------------------------------------------------------- */}
        <Box
          sx={{
            display: activeAppTab === 'whatsapp' ? 'flex' : 'none',
            flexDirection: 'column',
            width: '100%',
            height: '100%'
          }}
        >
          <WhatsappInterface
            currentUserEmail={currentUserEmail}
            userName={nombrePersonaConectada}
            userRole={userRole}
            isMobilePwa={true}
            initialChatId={deepLinkWaChatId}
            onActiveChatChange={setWaHasActiveChat}
          />
        </Box>

        {/* ----------------------------------------------------------------- */}
        {/* MODO 2: IIRESODH WORKSPACE MÓVIL (CANALES Y MENSAJES DIRECTOS)    */}
        {/* ----------------------------------------------------------------- */}
        <Box
          sx={{
            display: activeAppTab === 'workspace' ? 'flex' : 'none',
            flexDirection: 'column',
            width: '100%',
            height: '100%',
            bgcolor: '#ffffff'
          }}
        >
          {!canalWorkspaceActivo ? (
            /* PANTALLA A: DIRECTORIO MÓVIL DE CANALES Y MENSAJES DIRECTOS */
            <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              {/* Tarjeta superior de identidad y estado de disponibilidad */}
              <Box
                sx={{
                  px: 2,
                  pt: 1.5,
                  pb: 1.25,
                  bgcolor: '#f8fafc',
                  borderBottom: '1px solid #e2e8f0'
                }}
              >
                <Box
                  onClick={(e) => setAnchorEstado(e.currentTarget)}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    p: 1.1,
                    mb: 1.25,
                    bgcolor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderLeft: `3px solid ${miEstadoActual.color}`,
                    borderRadius: '0 8px 8px 0',
                    cursor: 'pointer'
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.15, minWidth: 0 }}>
                    <Box sx={{ position: 'relative' }}>
                      <Avatar
                        src={user?.photoURL || ''}
                        sx={{
                          width: 34,
                          height: 34,
                          bgcolor: '#1D3557',
                          fontSize: '0.85rem',
                          fontWeight: 800
                        }}
                      >
                        {nombrePersonaConectada.charAt(0).toUpperCase()}
                      </Avatar>
                      <Box
                        sx={{
                          position: 'absolute',
                          bottom: -1,
                          right: -1,
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          bgcolor: miEstadoActual.color,
                          border: '2px solid #ffffff'
                        }}
                      />
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography
                        noWrap
                        sx={{ fontSize: '0.84rem', fontWeight: 700, color: '#0f172a' }}
                      >
                        {nombrePersonaConectada}
                      </Typography>
                      <Typography
                        noWrap
                        sx={{ fontSize: '0.73rem', color: '#475569', fontWeight: 500 }}
                      >
                        {miEstadoActual.emoji} {miEstadoActual.texto} · Toca para cambiar estado
                      </Typography>
                    </Box>
                  </Box>
                </Box>

                {/* Buscador instantáneo */}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    bgcolor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    px: 1.25,
                    height: 36
                  }}
                >
                  <Search size={15} color="#64748b" />
                  <TextField
                    fullWidth
                    variant="standard"
                    placeholder="Buscar canal o compañero de equipo..."
                    value={busquedaWorkspace}
                    onChange={(e) => setBusquedaWorkspace(e.target.value)}
                    InputProps={{
                      disableUnderline: true,
                      sx: { ml: 1, fontSize: '0.8rem', color: '#0f172a' }
                    }}
                  />
                </Box>

                {/* Filtros rápidos */}
                <Box sx={{ display: 'flex', gap: 0.65, mt: 1, overflowX: 'auto', pb: 0.25 }}>
                  {[
                    { id: 'todos', label: 'Todos' },
                    {
                      id: 'no_leidos',
                      label: `No leídos${totalNoLeidosWorkspace ? ` (${totalNoLeidosWorkspace})` : ''}`
                    },
                    { id: 'canales', label: 'Canales' },
                    { id: 'directos', label: 'Mensajes Directos' }
                  ].map((tab) => (
                    <Box
                      key={tab.id}
                      onClick={() => setFiltroWorkspace(tab.id)}
                      sx={{
                        px: 1.25,
                        py: 0.45,
                        borderRadius: '999px',
                        fontSize: '0.73rem',
                        fontWeight: filtroWorkspace === tab.id ? 700 : 600,
                        bgcolor: filtroWorkspace === tab.id ? '#0f172a' : '#e2e8f0',
                        color: filtroWorkspace === tab.id ? '#ffffff' : '#475569',
                        whiteSpace: 'nowrap',
                        cursor: 'pointer'
                      }}
                    >
                      {tab.label}
                    </Box>
                  ))}
                </Box>
              </Box>

              {/* Lista desplazable de Canales y Colegas */}
              <Box sx={{ flexGrow: 1, overflowY: 'auto', px: 1.25, py: 1 }}>
                {filtroWorkspace !== 'directos' && (
                  <>
                    <Typography
                      sx={{
                        px: 1,
                        py: 0.6,
                        fontSize: '0.68rem',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        letterSpacing: '0.07em',
                        color: '#64748b'
                      }}
                    >
                      Canales Institucionales ({canalesTematicosWs.length})
                    </Typography>

                    {canalesTematicosWs.map((canal) => {
                      const noLeido = tieneNoLeidosWorkspace(canal);
                      return (
                        <Box
                          key={canal.id}
                          onClick={() => setCanalWorkspaceActivoId(canal.id)}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            p: 1.2,
                            mb: 0.5,
                            borderRadius: noLeido ? '0 10px 10px 0' : '10px',
                            borderLeft: noLeido ? '3px solid #2563eb' : '3px solid transparent',
                            bgcolor: noLeido ? 'rgba(37, 99, 235, 0.05)' : '#ffffff',
                            border: '1px solid #f1f5f9',
                            cursor: 'pointer',
                            '&:active': { bgcolor: '#f1f5f9' }
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, minWidth: 0 }}>
                            <Box
                              sx={{
                                width: 38,
                                height: 38,
                                borderRadius: '9px',
                                bgcolor: noLeido ? '#dbeafe' : '#f1f5f9',
                                color: noLeido ? '#1d4ed8' : '#334155',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                              }}
                            >
                              {canal.esPrivado ? <Lock size={16} /> : <Hash size={17} />}
                            </Box>
                            <Box sx={{ minWidth: 0 }}>
                              <Typography
                                noWrap
                                sx={{
                                  fontSize: '0.85rem',
                                  fontWeight: noLeido ? 800 : 600,
                                  color: '#0f172a'
                                }}
                              >
                                #{canal.nombre}
                              </Typography>
                              <Typography
                                noWrap
                                sx={{
                                  fontSize: '0.74rem',
                                  color: noLeido ? '#1e293b' : '#64748b',
                                  fontWeight: noLeido ? 600 : 400
                                }}
                              >
                                {canal.ultimoMensajeAutor
                                  ? `${canal.ultimoMensajeAutor}: ${canal.ultimoMensajeTexto || ''}`
                                  : canal.descripcion || 'Canal institucional'}
                              </Typography>
                            </Box>
                          </Box>

                          {noLeido && (
                            <Box
                              sx={{
                                px: 0.8,
                                py: 0.2,
                                borderRadius: '999px',
                                bgcolor: '#2563eb',
                                color: '#ffffff',
                                fontSize: '0.65rem',
                                fontWeight: 800,
                                flexShrink: 0
                              }}
                            >
                              Nuevo
                            </Box>
                          )}
                        </Box>
                      );
                    })}
                  </>
                )}

                {filtroWorkspace !== 'canales' && (
                  <>
                    <Typography
                      sx={{
                        px: 1,
                        pt: 1.5,
                        pb: 0.6,
                        fontSize: '0.68rem',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        letterSpacing: '0.07em',
                        color: '#64748b'
                      }}
                    >
                      Mensajes Directos ({colegasFiltradosWs.length})
                    </Typography>

                    {colegasFiltradosWs.map((colega) => {
                      const emailsOrd = [currentUserEmail, colega.email.toLowerCase()].sort();
                      const dmId = `dm_${emailsOrd[0].replace(/[^a-z0-9]/g, '_')}_${emailsOrd[1].replace(/[^a-z0-9]/g, '_')}`;
                      const canalDm = canalesWorkspace.find((c) => c.id === dmId);
                      const noLeido = canalDm ? tieneNoLeidosWorkspace(canalDm) : false;
                      const online = estaEnLinea(colega.email);
                      const pres = presenciaMap[colega.email.toLowerCase()] || {};

                      return (
                        <Box
                          key={colega.email}
                          onClick={() => abrirDmConColega(colega)}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            p: 1.15,
                            mb: 0.5,
                            borderRadius: noLeido ? '0 10px 10px 0' : '10px',
                            borderLeft: noLeido ? '3px solid #2563eb' : '3px solid transparent',
                            bgcolor: noLeido ? 'rgba(37, 99, 235, 0.05)' : '#ffffff',
                            border: '1px solid #f1f5f9',
                            cursor: 'pointer',
                            '&:active': { bgcolor: '#f1f5f9' }
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, minWidth: 0 }}>
                            <Box sx={{ position: 'relative', flexShrink: 0 }}>
                              <Avatar
                                src={pres.avatar || ''}
                                sx={{
                                  width: 38,
                                  height: 38,
                                  borderRadius: '10px',
                                  bgcolor: '#1e293b',
                                  fontSize: '0.85rem',
                                  fontWeight: 700
                                }}
                              >
                                {(colega.nombre || '?').charAt(0).toUpperCase()}
                              </Avatar>
                              <Box
                                sx={{
                                  position: 'absolute',
                                  bottom: -1,
                                  right: -1,
                                  width: 11,
                                  height: 11,
                                  borderRadius: '50%',
                                  bgcolor: online ? '#22c55e' : '#94a3b8',
                                  border: '2px solid #ffffff'
                                }}
                              />
                            </Box>

                            <Box sx={{ minWidth: 0 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                                <Typography
                                  noWrap
                                  sx={{
                                    fontSize: '0.85rem',
                                    fontWeight: noLeido ? 800 : 600,
                                    color: '#0f172a'
                                  }}
                                >
                                  {colega.nombre}
                                </Typography>
                                {pres.estadoEmoji && pres.estadoId !== 'disponible' && (
                                  <span style={{ fontSize: '0.76rem' }}>{pres.estadoEmoji}</span>
                                )}
                              </Box>
                              <Typography
                                noWrap
                                sx={{
                                  fontSize: '0.74rem',
                                  color: noLeido ? '#1e293b' : '#64748b',
                                  fontWeight: noLeido ? 600 : 400
                                }}
                              >
                                {canalDm?.ultimoMensajeTexto
                                  ? canalDm.ultimoMensajeTexto
                                  : pres.estadoTexto || (online ? 'En línea' : colega.rol)}
                              </Typography>
                            </Box>
                          </Box>

                          {noLeido && (
                            <Box
                              sx={{
                                px: 0.8,
                                py: 0.2,
                                borderRadius: '999px',
                                bgcolor: '#2563eb',
                                color: '#ffffff',
                                fontSize: '0.65rem',
                                fontWeight: 800,
                                flexShrink: 0
                              }}
                            >
                              Nuevo
                            </Box>
                          )}
                        </Box>
                      );
                    })}
                  </>
                )}
              </Box>
            </Box>
          ) : (
            /* PANTALLA B: CONVERSACIÓN ACTIVA DE CANAL O DM A PANTALLA COMPLETA */
            <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: '#f8fafc' }}>
              {/* Cabecera del Canal o DM */}
              <Box
                sx={{
                  px: 1.5,
                  py: 1,
                  bgcolor: '#ffffff',
                  borderBottom: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 1,
                  flexShrink: 0
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                  <IconButton
                    size="small"
                    onClick={() => {
                      setCanalWorkspaceActivoId(null);
                      setMensajeHiloPadreWs(null);
                    }}
                    sx={{
                      width: 34,
                      height: 34,
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      color: '#0f172a'
                    }}
                  >
                    <ArrowLeft size={17} />
                  </IconButton>

                  <Box sx={{ minWidth: 0 }}>
                    <Typography
                      noWrap
                      sx={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a' }}
                    >
                      {canalWorkspaceActivo.tipo === 'dm'
                        ? obtenerTituloCanalWs(canalWorkspaceActivo)
                        : `#${canalWorkspaceActivo.nombre}`}
                    </Typography>
                    <Typography noWrap sx={{ fontSize: '0.7rem', color: '#64748b' }}>
                      {canalWorkspaceActivo.tipo === 'dm'
                        ? 'Mensaje directo privado · IIRESODH'
                        : canalWorkspaceActivo.descripcion || 'Canal institucional'}
                    </Typography>
                  </Box>
                </Box>

                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<Video size={14} color="#16a34a" />}
                  disabled={creandoMeetWs}
                  onClick={handleIniciarMeetWs}
                  sx={{
                    textTransform: 'none',
                    fontSize: '0.73rem',
                    fontWeight: 700,
                    borderRadius: '7px',
                    borderColor: '#bbf7d0',
                    bgcolor: '#f0fdf4',
                    color: '#166534',
                    flexShrink: 0
                  }}
                >
                  Meet
                </Button>
              </Box>

              {/* Flujo de Mensajes del Canal / DM */}
              <Box
                sx={{
                  flexGrow: 1,
                  overflowY: 'auto',
                  px: 1.5,
                  py: 1.5,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1
                }}
              >
                {loadingMensajesWs ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                    <CircularProgress size={22} />
                  </Box>
                ) : mensajesPrincipalesWs.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 6, px: 2 }}>
                    <Typography sx={{ fontSize: '0.84rem', fontWeight: 700, color: '#334155' }}>
                      Inicia la conversación en{' '}
                      {canalWorkspaceActivo.tipo === 'dm'
                        ? obtenerTituloCanalWs(canalWorkspaceActivo)
                        : `#${canalWorkspaceActivo.nombre}`}
                    </Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.5 }}>
                      Los mensajes y notas de voz se sincronizan al instante con todo el equipo.
                    </Typography>
                  </Box>
                ) : (
                  mensajesPrincipalesWs.map((msg) => {
                    const esMio = (msg.autorEmail || '').toLowerCase() === currentUserEmail;
                    return (
                      <Box
                        key={msg.id}
                        sx={{
                          alignSelf: esMio ? 'flex-end' : 'flex-start',
                          maxWidth: '88%',
                          bgcolor: esMio ? '#eff6ff' : '#ffffff',
                          border: '1px solid',
                          borderColor: esMio ? '#bfdbfe' : '#e2e8f0',
                          borderLeft: esMio ? '1px solid #bfdbfe' : '3px solid #1D3557',
                          borderRadius: esMio ? '12px 12px 2px 12px' : '0 12px 12px 0',
                          px: 1.35,
                          py: 1,
                          boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)'
                        }}
                      >
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'baseline',
                            justifyContent: 'space-between',
                            gap: 1,
                            mb: 0.3
                          }}
                        >
                          <Typography
                            sx={{
                              fontSize: '0.72rem',
                              fontWeight: 800,
                              color: esMio ? '#1d4ed8' : '#1D3557'
                            }}
                          >
                            {esMio ? 'Tú' : msg.autorNombre || msg.autorEmail}
                          </Typography>
                          <Typography sx={{ fontSize: '0.64rem', color: '#94a3b8' }}>
                            {msg.creadoEnMs
                              ? new Date(msg.creadoEnMs).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })
                              : ''}
                          </Typography>
                        </Box>

                        {msg.texto && (
                          <Typography
                            sx={{
                              fontSize: '0.83rem',
                              color: '#0f172a',
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                              lineHeight: 1.45
                            }}
                          >
                            {msg.texto}
                          </Typography>
                        )}

                        {/* Audio Adjunto */}
                        {msg.audioAdjunto?.url && (
                          <Box sx={{ mt: 0.75 }}>
                            <audio
                              controls
                              src={msg.audioAdjunto.url}
                              style={{ height: 34, maxWidth: '235px' }}
                            />
                          </Box>
                        )}

                        {/* Archivos Adjuntos */}
                        {Array.isArray(msg.adjuntos) &&
                          msg.adjuntos.map((adj, idx) => (
                            <Box
                              key={idx}
                              component="a"
                              href={adj.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              sx={{
                                mt: 0.65,
                                p: 0.85,
                                borderRadius: '8px',
                                bgcolor: '#f8fafc',
                                border: '1px solid #cbd5e1',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.85,
                                textDecoration: 'none',
                                color: '#0f172a'
                              }}
                            >
                              <FileText size={15} color="#2563eb" />
                              <Typography
                                noWrap
                                sx={{ fontSize: '0.76rem', fontWeight: 600, color: '#1e293b' }}
                              >
                                {adj.nombre || 'Archivo adjunto'}
                              </Typography>
                            </Box>
                          ))}

                        {/* Tarjeta Google Meet si existe */}
                        {msg.meetAdjunto?.meetingUri && (
                          <Button
                            fullWidth
                            size="small"
                            variant="contained"
                            href={msg.meetAdjunto.meetingUri}
                            target="_blank"
                            rel="noopener noreferrer"
                            startIcon={<Video size={14} />}
                            sx={{
                              mt: 0.85,
                              bgcolor: '#16a34a',
                              color: '#ffffff',
                              textTransform: 'none',
                              fontWeight: 700,
                              fontSize: '0.74rem',
                              borderRadius: '7px'
                            }}
                          >
                            Unirse a Sala Google Meet
                          </Button>
                        )}

                        {/* Reacciones y Botón de Hilo */}
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: 0.5,
                            mt: 0.65
                          }}
                        >
                          {Object.entries(msg.reacciones || {}).map(([em, users]) =>
                            Array.isArray(users) && users.length > 0 ? (
                              <Box
                                key={em}
                                onClick={() => handleToggleReaccionWs(msg, em)}
                                sx={{
                                  px: 0.65,
                                  py: 0.1,
                                  borderRadius: '999px',
                                  fontSize: '0.7rem',
                                  bgcolor: users.includes(currentUserEmail) ? '#dbeafe' : '#f1f5f9',
                                  border: '1px solid',
                                  borderColor: users.includes(currentUserEmail)
                                    ? '#93c5fd'
                                    : '#e2e8f0',
                                  cursor: 'pointer'
                                }}
                              >
                                {em} {users.length}
                              </Box>
                            ) : null
                          )}

                          <Box
                            onClick={() => handleToggleReaccionWs(msg, '👍')}
                            sx={{
                              px: 0.55,
                              py: 0.1,
                              borderRadius: '6px',
                              fontSize: '0.68rem',
                              color: '#64748b',
                              cursor: 'pointer'
                            }}
                          >
                            +👍
                          </Box>

                          <Box
                            onClick={() => setMensajeHiloPadreWs(msg)}
                            sx={{
                              ml: 'auto',
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              color: '#2563eb',
                              cursor: 'pointer'
                            }}
                          >
                            {msg.respuestasCount > 0
                              ? `💬 ${msg.respuestasCount} respuesta${msg.respuestasCount === 1 ? '' : 's'}`
                              : 'Responder'}
                          </Box>
                        </Box>
                      </Box>
                    );
                  })
                )}
                <div ref={wsMessagesEndRef} />
              </Box>

              {/* Indicador "Está escribiendo..." */}
              {usuariosEscribiendoWs.length > 0 && (
                <Box sx={{ px: 2, py: 0.35, bgcolor: '#f8fafc' }}>
                  <Typography sx={{ fontSize: '0.69rem', color: '#2563eb', fontWeight: 600 }}>
                    {usuariosEscribiendoWs.map((u) => u.nombre).join(', ')} está escribiendo...
                  </Typography>
                </Box>
              )}

              {/* Composer Inferior Nativo del Canal / DM */}
              <Box
                sx={{
                  p: 1,
                  bgcolor: '#ffffff',
                  borderTop: '1px solid #e2e8f0'
                }}
              >
                {grabandoAudioWs ? (
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      bgcolor: '#fef2f2',
                      border: '1px solid #fecaca',
                      borderLeft: '3px solid #dc2626',
                      borderRadius: '0 8px 8px 0',
                      px: 1.25,
                      py: 0.65
                    }}
                  >
                    <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: '#b91c1c' }}>
                      🎙️ Grabando... {Math.floor(segundosAudioWs / 60)}:
                      {String(segundosAudioWs % 60).padStart(2, '0')}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.75 }}>
                      <Button
                        size="small"
                        color="error"
                        onClick={cancelarGrabacionVozWs}
                        sx={{ textTransform: 'none', fontSize: '0.74rem', fontWeight: 600 }}
                      >
                        Cancelar
                      </Button>
                      <Button
                        size="small"
                        variant="contained"
                        onClick={enviarGrabacionVozWs}
                        sx={{
                          bgcolor: '#0f172a',
                          textTransform: 'none',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          borderRadius: '6px'
                        }}
                      >
                        Enviar
                      </Button>
                    </Box>
                  </Box>
                ) : (
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'flex-end',
                      gap: 0.6,
                      bgcolor: '#f8fafc',
                      border: '1px solid #cbd5e1',
                      borderRadius: '10px',
                      px: 0.85,
                      py: 0.45
                    }}
                  >
                    <IconButton
                      size="small"
                      component="label"
                      disabled={subiendoArchivoWs}
                      sx={{ width: 32, height: 32, color: '#475569' }}
                    >
                      {subiendoArchivoWs ? (
                        <CircularProgress size={15} />
                      ) : (
                        <Paperclip size={17} />
                      )}
                      <input type="file" hidden onChange={handleSubirArchivoWs} />
                    </IconButton>

                    <IconButton
                      size="small"
                      onClick={(e) => setAnchorEmojiWs(e.currentTarget)}
                      sx={{ width: 32, height: 32, color: '#475569' }}
                    >
                      <Smile size={17} />
                    </IconButton>

                    <Popover
                      open={Boolean(anchorEmojiWs)}
                      anchorEl={anchorEmojiWs}
                      onClose={() => setAnchorEmojiWs(null)}
                      anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
                      transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                    >
                      <Box sx={{ p: 1, display: 'flex', gap: 0.5 }}>
                        {EMOJIS_REACCION.map((em) => (
                          <IconButton
                            key={em}
                            size="small"
                            onClick={() => {
                              setTextoMensajeWs((prev) => `${prev}${em}`);
                              setAnchorEmojiWs(null);
                            }}
                          >
                            {em}
                          </IconButton>
                        ))}
                      </Box>
                    </Popover>

                    <TextField
                      fullWidth
                      multiline
                      maxRows={4}
                      variant="standard"
                      placeholder={`Mensaje a ${
                        canalWorkspaceActivo.tipo === 'dm'
                          ? obtenerTituloCanalWs(canalWorkspaceActivo)
                          : `#${canalWorkspaceActivo.nombre}`
                      }...`}
                      value={textoMensajeWs}
                      onChange={(e) => handleEscribirTextoWs(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleEnviarMensajeWs(false);
                        }
                      }}
                      InputProps={{
                        disableUnderline: true,
                        sx: { fontSize: '0.84rem', py: 0.4, color: '#0f172a' }
                      }}
                    />

                    <IconButton
                      size="small"
                      onClick={iniciarGrabacionVozWs}
                      sx={{ width: 32, height: 32, color: '#475569' }}
                    >
                      <Mic size={17} />
                    </IconButton>

                    <IconButton
                      size="small"
                      onClick={() => handleEnviarMensajeWs(false)}
                      disabled={!textoMensajeWs.trim() || enviandoWs}
                      sx={{
                        width: 32,
                        height: 32,
                        borderRadius: '8px',
                        bgcolor: textoMensajeWs.trim() ? '#2563eb' : '#e2e8f0',
                        color: textoMensajeWs.trim() ? '#ffffff' : '#94a3b8'
                      }}
                    >
                      <Send size={15} />
                    </IconButton>
                  </Box>
                )}
              </Box>
            </Box>
          )}
        </Box>
      </Box>

      {/* =================================================================== */}
      {/* POPOVER DE DISPONIBILIDAD Y ESTADO PERSONALIZADO DEL USUARIO        */}
      {/* =================================================================== */}
      <Popover
        open={Boolean(anchorEstado)}
        anchorEl={anchorEstado}
        onClose={() => setAnchorEstado(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        PaperProps={{
          sx: {
            width: 290,
            borderRadius: '12px',
            p: 1.5,
            border: '1px solid #e2e8f0',
            boxShadow: '0 16px 36px rgba(15, 23, 42, 0.22)'
          }
        }}
      >
        <Typography sx={{ fontSize: '0.78rem', fontWeight: 800, color: '#0f172a', mb: 0.25 }}>
          {nombrePersonaConectada}
        </Typography>
        <Typography sx={{ fontSize: '0.68rem', color: '#64748b', mb: 1.25 }}>
          Estado visible en IIRESODH Workspace
        </Typography>

        <Box sx={{ display: 'flex', gap: 0.5, mb: 1.25 }}>
          <TextField
            size="small"
            value={customStatusEmoji}
            onChange={(e) => setCustomStatusEmoji(e.target.value)}
            sx={{ width: 52 }}
          />
          <TextField
            size="small"
            fullWidth
            placeholder="Estado personalizado..."
            value={customStatusTexto}
            onChange={(e) => setCustomStatusTexto(e.target.value)}
          />
          <Button
            size="small"
            variant="contained"
            onClick={guardarEstadoPersonalizado}
            sx={{ minWidth: 42, bgcolor: '#0f172a', textTransform: 'none' }}
          >
            OK
          </Button>
        </Box>

        <Divider sx={{ my: 1 }} />

        {ESTADOS_USUARIO.map((est) => (
          <Box
            key={est.id}
            onClick={() => cambiarEstadoUsuario(est)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: 1,
              py: 0.7,
              borderRadius: '7px',
              cursor: 'pointer',
              bgcolor: miEstadoActual.id === est.id ? '#f1f5f9' : 'transparent',
              '&:hover': { bgcolor: '#f8fafc' }
            }}
          >
            <span>{est.emoji}</span>
            <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, color: '#0f172a' }}>
              {est.texto}
            </Typography>
          </Box>
        ))}
      </Popover>

      {/* =================================================================== */}
      {/* MODAL DE RESPUESTA EN HILO (WORKSPACE MÓVIL)                        */}
      {/* =================================================================== */}
      <Dialog
        open={Boolean(mensajeHiloPadreWs)}
        onClose={() => setMensajeHiloPadreWs(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle sx={{ fontSize: '0.9rem', fontWeight: 800, py: 1.5 }}>
          Hilo de conversación
        </DialogTitle>
        <DialogContent dividers sx={{ p: 1.5 }}>
          {mensajeHiloPadreWs && (
            <Box
              sx={{
                p: 1.2,
                mb: 1.5,
                bgcolor: '#f8fafc',
                borderLeft: '3px solid #1D3557',
                borderRadius: '0 8px 8px 0'
              }}
            >
              <Typography sx={{ fontSize: '0.74rem', fontWeight: 800, color: '#1D3557' }}>
                {mensajeHiloPadreWs.autorNombre}
              </Typography>
              <Typography sx={{ fontSize: '0.82rem', color: '#0f172a', mt: 0.25 }}>
                {mensajeHiloPadreWs.texto}
              </Typography>
            </Box>
          )}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 1.5 }}>
            {respuestasHiloActivasWs.map((r) => (
              <Box
                key={r.id}
                sx={{
                  p: 1,
                  borderRadius: '8px',
                  bgcolor: '#ffffff',
                  border: '1px solid #e2e8f0'
                }}
              >
                <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: '#0f172a' }}>
                  {r.autorNombre}
                </Typography>
                <Typography sx={{ fontSize: '0.8rem', color: '#334155' }}>{r.texto}</Typography>
              </Box>
            ))}
          </Box>

          <Box sx={{ display: 'flex', gap: 0.75 }}>
            <TextField
              size="small"
              fullWidth
              placeholder="Responder en hilo..."
              value={textoRespuestaHiloWs}
              onChange={(e) => setTextoRespuestaHiloWs(e.target.value)}
            />
            <Button
              variant="contained"
              onClick={() => handleEnviarMensajeWs(true)}
              sx={{ bgcolor: '#2563eb', textTransform: 'none', fontWeight: 700 }}
            >
              Enviar
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMensajeHiloPadreWs(null)} sx={{ textTransform: 'none' }}>
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>

      {/* =================================================================== */}
      {/* MODAL DE CONFIGURACIÓN DE NOTIFICACIONES PUSH Y PWA MÓVIL           */}
      {/* =================================================================== */}
      <Dialog
        open={modalNotifOpen}
        onClose={() => setModalNotifOpen(false)}
        fullWidth
        maxWidth="xs"
        PaperProps={{ sx: { borderRadius: '14px', m: 1.5 } }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.1,
            fontSize: '0.94rem',
            fontWeight: 800,
            color: '#0f172a',
            borderBottom: '1px solid #f1f5f9'
          }}
        >
          <img
            src="/iiresodh-isotipo-gradient.png"
            alt="IIRESODH"
            style={{ width: 26, height: 26, objectFit: 'contain' }}
          />
          Notificaciones & App Móvil
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Box
            sx={{
              p: 1.5,
              mb: 1.75,
              bgcolor: permisoNotif === 'granted' ? '#ecfdf5' : '#fffbeb',
              border: '1px solid',
              borderColor: permisoNotif === 'granted' ? '#a7f3d0' : '#fde68a',
              borderLeft:
                permisoNotif === 'granted' ? '3px solid #10b981' : '3px solid #f59e0b',
              borderRadius: '0 8px 8px 0'
            }}
          >
            <Typography
              sx={{
                fontSize: '0.8rem',
                fontWeight: 700,
                color: permisoNotif === 'granted' ? '#065f46' : '#92400e'
              }}
            >
              {permisoNotif === 'granted'
                ? '✅ Notificaciones Push activas en este dispositivo'
                : '🔔 Notificaciones pendientes de activar'}
            </Typography>
            <Typography
              sx={{
                fontSize: '0.73rem',
                color: permisoNotif === 'granted' ? '#047857' : '#b45309',
                mt: 0.35,
                lineHeight: 1.45
              }}
            >
              Recibe alertas instantáneas cuando llegue un mensaje o llamada a{' '}
              <strong>WhatsApp Business</strong> o cuando un colega te escriba en{' '}
              <strong>IIRESODH Workspace</strong>.
            </Typography>
          </Box>

          {notifFeedback && (
            <Box
              sx={{
                p: 1.2,
                mb: 1.5,
                borderRadius: '8px',
                bgcolor: notifFeedback.tipo === 'success' ? '#f0fdf4' : '#fef2f2',
                color: notifFeedback.tipo === 'success' ? '#166534' : '#991b1b',
                fontSize: '0.75rem',
                fontWeight: 600
              }}
            >
              {notifFeedback.texto}
            </Box>
          )}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Button
              fullWidth
              variant="contained"
              disabled={activandoPush}
              onClick={handleActivarPush}
              startIcon={<BellRing size={16} />}
              sx={{
                bgcolor: '#10b981',
                color: '#ffffff',
                textTransform: 'none',
                fontWeight: 700,
                borderRadius: '8px',
                py: 1,
                '&:hover': { bgcolor: '#059669' }
              }}
            >
              {activandoPush
                ? 'Sincronizando dispositivo...'
                : permisoNotif === 'granted'
                ? 'Sincronizar / Renovar Token Push'
                : 'Activar Notificaciones Push'}
            </Button>

            {permisoNotif === 'granted' && (
              <>
                <Button
                  fullWidth
                  variant="outlined"
                  onClick={handleProbarNotificacion}
                  startIcon={<Volume2 size={15} />}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 600,
                    fontSize: '0.78rem',
                    borderRadius: '8px',
                    borderColor: '#cbd5e1',
                    color: '#0f172a'
                  }}
                >
                  Enviar Notificación de Prueba
                </Button>

                <Button
                  fullWidth
                  color="error"
                  size="small"
                  onClick={async () => {
                    await desactivarNotificacionesPushDispositivo();
                    setNotifFeedback({
                      tipo: 'success',
                      texto: 'Suscripción Push desvinculada de este teléfono.'
                    });
                  }}
                  sx={{ textTransform: 'none', fontSize: '0.73rem' }}
                >
                  Desactivar alertas en este dispositivo
                </Button>
              </>
            )}
          </Box>

          <Divider sx={{ my: 2 }} />

          <Typography sx={{ fontSize: '0.74rem', fontWeight: 700, color: '#334155', mb: 0.5 }}>
            📱 Instrucciones para iPhone (iOS) y Android:
          </Typography>
          <Typography sx={{ fontSize: '0.71rem', color: '#64748b', lineHeight: 1.5 }}>
            • <strong>En iPhone / iPad:</strong> Abre esta página en Safari, toca el botón{' '}
            <strong>Compartir ⬆️</strong> y selecciona <strong>"Agregar a pantalla de inicio"</strong>.
            Abre la app desde el ícono de IIRESODH y toca <em>Activar Notificaciones Push</em>.
            <br />• <strong>En Android:</strong> Toca el menú de Chrome (⋮) y selecciona{' '}
            <strong>"Instalar aplicación"</strong>.
          </Typography>

          {onIrAlHubIntranet && (
            <Button
              fullWidth
              variant="outlined"
              onClick={() => {
                setModalNotifOpen(false);
                onIrAlHubIntranet();
              }}
              startIcon={<LayoutGrid size={15} />}
              sx={{
                mt: 2,
                textTransform: 'none',
                fontWeight: 700,
                fontSize: '0.76rem',
                borderRadius: '8px',
                borderColor: '#cbd5e1',
                color: '#0f172a'
              }}
            >
              Ir al Hub Completo de la Intranet
            </Button>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 1.5 }}>
          <Button
            onClick={() => setModalNotifOpen(false)}
            sx={{ textTransform: 'none', fontWeight: 600, color: '#64748b' }}
          >
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function ChipOrBadge({ label, color }) {
  return (
    <Box
      sx={{
        px: 1.1,
        py: 0.35,
        borderRadius: '6px',
        bgcolor: color,
        color: '#ffffff',
        fontSize: '0.7rem',
        fontWeight: 800,
        flexShrink: 0
      }}
    >
      {label}
    </Box>
  );
}
