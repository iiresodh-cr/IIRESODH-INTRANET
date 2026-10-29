import React, { useState, useEffect, useRef } from 'react';
import { 
  Box, 
  Typography, 
  List, 
  ListItem, 
  ListItemAvatar, 
  ListItemText, 
  Avatar, 
  Divider, 
  TextField, 
  IconButton, 
  Alert,
  AlertTitle,
  CircularProgress,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Badge,
  Tooltip,
  InputAdornment,
  Menu,
  MenuItem,
  Popover
} from '@mui/material';
import { 
  Send, 
  Search, 
  MoreVertical, 
  Settings, 
  ArrowLeft, 
  Check, 
  CheckCheck, 
  Clock, 
  Plus, 
  Phone, 
  User, 
  Copy, 
  ExternalLink, 
  ShieldCheck, 
  MessageCircle, 
  Key, 
  RefreshCw,
  Edit3,
  Sparkles,
  Trash2,
  AlertTriangle,
  AlertCircle,
  Mic,
  Square,
  PhoneCall,
  PhoneOff,
  PhoneIncoming,
  Video,
  Volume2,
  VolumeX,
  Smile,
  Upload
} from 'lucide-react';
import { 
  collection, 
  doc, 
  query, 
  orderBy, 
  onSnapshot, 
  setDoc, 
  updateDoc, 
  serverTimestamp, 
  addDoc, 
  getDoc,
  deleteDoc,
  writeBatch,
  getDocs
} from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../config/firebase';
import { crearEspacioGoogleMeet } from '../context/AuthContext';
import { registrarLogAuditoria } from '../utils/auditLogger';

const CLOUD_FUNCTION_BASE = 'https://us-central1-litigio-management.cloudfunctions.net';
const BACKEND_SEND_URL = `${CLOUD_FUNCTION_BASE}/enviar_mensaje`;
const WEBHOOK_CALLBACK_URL = `${CLOUD_FUNCTION_BASE}/whatsapp_webhook`;
const DEFAULT_VERIFY_TOKEN = 'mi_codigo_secreto_123';
const DEFAULT_PHONE_ID = '1429140810275241';
const DEFAULT_WABA_ID = '1431176165105564';
const DEFAULT_TOKEN = 'EAANXNDTIJbEBS28Th8KMTlVvF1rUVKVPKoCsrMaCaZAUFBRDq8DLuV4ZALBEut3wzxlc29pXqOHF0Uzem8SCJMIo9ZCV1tvPcL8XZCgKoFGrdn6bh19hqw2fCHbjK4SPPp1rQRGz2VZAoHII5V9oTQ8uA6ZBTy8KGbDCS6Fvs810D4xG3weVxh8ZAlkEsO9bwZDZD';

const EMOJIS_RAPIDOS = [
  '👋', '😊', '🙏', '👍', '🤝', '❤️', '✅', '✨',
  '📄', '⚖️', '🏛️', '📅', '📞', '📍', '📌', '⚠️',
  '🚨', '⏳', '🔍', '📝', '📬', '🌎', '🛡️', '🎉',
  '👏', '🙌', '💬', '📎', '🔒', 'ℹ️', '🟢', '🔵'
];

const STICKERS_INSTITUCIONALES = [
  { id: 'recibido', emoji: '✅', titulo: 'RECIBIDO', subtitulo: 'IIRESODH', bg1: '#10b981', bg2: '#047857' },
  { id: 'gracias', emoji: '🙏', titulo: 'MUCHAS GRACIAS', subtitulo: 'Equipo IIRESODH', bg1: '#2563eb', bg2: '#1d4ed8' },
  { id: 'saludo', emoji: '👋', titulo: '¡HOLA!', subtitulo: 'Atención IIRESODH', bg1: '#0d9488', bg2: '#0f766e' },
  { id: 'revision', emoji: '⚖️', titulo: 'EN REVISIÓN', subtitulo: 'Equipo Jurídico', bg1: '#1e293b', bg2: '#0f172a' },
  { id: 'documento_ok', emoji: '📄', titulo: 'DOCUMENTO OK', subtitulo: 'Integrado al Caso', bg1: '#4f46e5', bg2: '#3730a3' },
  { id: 'llamada', emoji: '📞', titulo: 'TE LLAMAMOS', subtitulo: 'En unos minutos', bg1: '#0284c7', bg2: '#0369a1' },
  { id: 'cita', emoji: '📅', titulo: 'CONFIRMADO', subtitulo: 'Agenda IIRESODH', bg1: '#7c3aed', bg2: '#5b21b6' },
  { id: 'acuerdo', emoji: '👍', titulo: 'DE ACUERDO', subtitulo: 'Enterado', bg1: '#f59e0b', bg2: '#d97706' }
];

// Genera un Sticker oficial 512x512 en formato image/webp compatible con Meta WhatsApp Cloud API
async function generarStickerWebp512(stickerCfg) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, 512, 512);

  // Sombra suave exterior
  ctx.save();
  ctx.shadowColor = 'rgba(15, 23, 42, 0.28)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 10;

  // Fondo circular/escudo con gradiente
  const grad = ctx.createLinearGradient(60, 40, 452, 472);
  grad.addColorStop(0, stickerCfg.bg1);
  grad.addColorStop(1, stickerCfg.bg2);

  ctx.beginPath();
  ctx.roundRect(44, 44, 424, 424, 96);
  ctx.fillStyle = grad;
  ctx.fill();

  // Borde blanco tipo sticker de WhatsApp
  ctx.lineWidth = 14;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
  ctx.restore();

  // Emoji central grande
  ctx.font = '170px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(stickerCfg.emoji, 256, 200);

  // Etiqueta principal
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 40px "Inter", "Segoe UI", Arial, sans-serif';
  ctx.fillText(stickerCfg.titulo, 256, 355);

  // Subtítulo institucional
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.font = '700 24px "Inter", "Segoe UI", Arial, sans-serif';
  ctx.fillText(stickerCfg.subtitulo, 256, 405);

  const dataUrl = canvas.toDataURL('image/webp', 0.92);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.92));
  return { dataUrl, blob };
}

export default function WhatsappInterface({ 
  onVolver, 
  currentUserEmail = '', 
  userName = 'Operador IIRESODH',
  userRole = 'Operador'
}) {
  // --- Control de Privilegios Administrativos ---
  const esAdmin = 
    userRole === 'Admin' || 
    userRole === 'Superadmin' || 
    currentUserEmail?.toLowerCase() === 'webmaster@iiresodh.org';

  // --- Estados de Datos ---
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [mensajesChat, setMensajesChat] = useState([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMensajes, setLoadingMensajes] = useState(false);

  // --- Estados de Entrada y Envío ---
  const [mensajeTexto, setMensajeTexto] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [notificacion, setNotificacion] = useState(null);

  // --- Filtros y Búsqueda ---
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroTab, setFiltroTab] = useState('todos'); // 'todos' | 'no_leidos'

  // --- Diálogos Modales ---
  const [openConfigModal, setOpenConfigModal] = useState(false);
  const [openNuevoChatModal, setOpenNuevoChatModal] = useState(false);
  const [openEditContactoModal, setOpenEditContactoModal] = useState(false);
  const [openDeleteChatModal, setOpenDeleteChatModal] = useState(false);
  const [chatAEliminar, setChatAEliminar] = useState(null);
  const [eliminandoChat, setEliminandoChat] = useState(false);

  // --- Formulario Nuevo Chat ---
  const [nuevoTelefono, setNuevoTelefono] = useState('');
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoMensajeInicial, setNuevoMensajeInicial] = useState('');
  const [modoInicioChat, setModoInicioChat] = useState('auto'); // 'auto' | 'template_iiresodh' | 'template_hello' | 'texto_libre'
  const [estadoPlantillaIiresodh, setEstadoPlantillaIiresodh] = useState('UNKNOWN'); // 'APPROVED' | 'PENDING' | 'NOT_FOUND' | 'UNKNOWN'
  const [cargandoPlantillasMeta, setCargandoPlantillasMeta] = useState(false);

  // --- Formulario Editar Contacto ---
  const [editNombreContacto, setEditNombreContacto] = useState('');

  // --- Formulario Configuración Meta API ---
  const [metaConfig, setMetaConfig] = useState({
    phone_number_id: DEFAULT_PHONE_ID,
    whatsapp_token: DEFAULT_TOKEN,
    verify_token: DEFAULT_VERIFY_TOKEN,
    waba_id: DEFAULT_WABA_ID
  });
  const [guardandoConfig, setGuardandoConfig] = useState(false);
  const [configCargada, setConfigCargada] = useState(false);
  const [copiadoCampo, setCopiadoCampo] = useState('');
  const [probandoConexion, setProbandoConexion] = useState(false);
  const [resultadoPrueba, setResultadoPrueba] = useState(null);

  // --- Menú de Respuestas Rápidas ---
  const [anchorElRespuestas, setAnchorElRespuestas] = useState(null);

  // --- Opciones de Voz (1. Central Voz Web / Teléfono Físico, 2. Notas de Voz, 3. Sala Meet) ---
  const [recepcionVozWebActiva, setRecepcionVozWebActiva] = useState(true);
  const [cambiandoModoVoz, setCambiandoModoVoz] = useState(false);
  const [llamadaEntrante, setLlamadaEntrante] = useState(null);
  const [enLlamadaWebRTC, setEnLlamadaWebRTC] = useState(false);
  const [micSilenciado, setMicSilenciado] = useState(false);
  const [segundosLlamada, setSegundosLlamada] = useState(0);
  const peerConnectionRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const localStreamRef = useRef(null);
  const llamadaTimerRef = useRef(null);

  // Grabador de Notas de Voz
  const [grabandoVoz, setGrabandoVoz] = useState(false);
  const [enviandoNotaVoz, setEnviandoNotaVoz] = useState(false);
  const [segundosGrabacion, setSegundosGrabacion] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const grabacionTimerRef = useRef(null);
  const [audiosResueltos, setAudiosResueltos] = useState({});
  const [cargandoAudioId, setCargandoAudioId] = useState(null);

  // Sala de Voz / Meet en 1 clic
  const [creandoSalaMeet, setCreandoSalaMeet] = useState(false);

  // Selector de Emojis y Stickers Nativos de WhatsApp
  const [anchorElEmoji, setAnchorElEmoji] = useState(null);
  const [tabEmojiSticker, setTabEmojiSticker] = useState('emojis'); // 'emojis' | 'stickers'
  const [enviandoSticker, setEnviandoSticker] = useState(false);

  const messagesEndRef = useRef(null);

  // Auto-scroll al final del chat cuando llegan o se envían mensajes
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [mensajesChat]);

  // ==============================================================
  // 1. CARGA Y SINCRONIZACIÓN EN TIEMPO REAL DE CONFIGURACIÓN META API
  // ==============================================================
  const cargarConfigMeta = async () => {
    try {
      const cfgRef = doc(db, 'whatsapp_config', 'credenciales');
      const snap = await getDoc(cfgRef);
      if (snap.exists()) {
        const data = snap.data();
        const tokenGuardado = data.whatsapp_token;
        const esTokenExpirado = Boolean(tokenGuardado && tokenGuardado.includes('BSZBSCJYkmRpp'));
        const tokenActivo = (tokenGuardado && !esTokenExpirado) ? tokenGuardado : DEFAULT_TOKEN;

        const wabaActivo =
          data.waba_id && data.waba_id !== '28701773989517598' ? data.waba_id : DEFAULT_WABA_ID;

        setMetaConfig({
          phone_number_id: data.phone_number_id || DEFAULT_PHONE_ID,
          whatsapp_token: tokenActivo,
          verify_token: data.verify_token || DEFAULT_VERIFY_TOKEN,
          waba_id: wabaActivo
        });
        if (typeof data.recepcion_voz_web_activa === 'boolean') {
          setRecepcionVozWebActiva(data.recepcion_voz_web_activa);
        }

        // Si en Firestore aún estaba guardado el token viejo expirado, migrarlo automáticamente
        if (esTokenExpirado && DEFAULT_TOKEN) {
          setDoc(cfgRef, { 
            whatsapp_token: DEFAULT_TOKEN,
            actualizado_en: serverTimestamp() 
          }, { merge: true }).catch(() => {});
        }
      } else {
        setMetaConfig(prev => ({
          ...prev,
          whatsapp_token: DEFAULT_TOKEN
        }));
      }
      setConfigCargada(true);
    } catch (e) {
      console.warn('Configuración de WhatsApp no inicializada aún en Firestore:', e);
      setConfigCargada(true);
    }
  };

  useEffect(() => {
    cargarConfigMeta();
    const unsubCfg = onSnapshot(
      doc(db, 'whatsapp_config', 'credenciales'),
      (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          if (typeof d.recepcion_voz_web_activa === 'boolean') {
            setRecepcionVozWebActiva(d.recepcion_voz_web_activa);
          }
        }
      },
      () => {}
    );
    return () => unsubCfg();
  }, []);

  const handleProbarConexion = async () => {
    const token = metaConfig.whatsapp_token?.trim();
    const phoneId = metaConfig.phone_number_id?.trim();

    if (!token || !phoneId) {
      setResultadoPrueba({
        exito: false,
        mensaje: 'Por favor ingresa tanto el Phone Number ID como el Token de Acceso para realizar la prueba.'
      });
      return;
    }

    setProbandoConexion(true);
    setResultadoPrueba(null);

    try {
      const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();

      if (res.ok) {
        const displayPhone = data.display_phone_number || data.id;
        const verifiedName = data.verified_name || 'Número verificado en Meta';
        setResultadoPrueba({
          exito: true,
          mensaje: `✅ ¡Conexión Exitosa con Meta! Teléfono: ${displayPhone} (${verifiedName}). Las credenciales son válidas y están activas.`
        });
      } else {
        const code = data?.error?.code;
        const msg = data?.error?.message || 'Error de autenticación';
        if (code === 190 || res.status === 401) {
          setResultadoPrueba({
            exito: false,
            mensaje: `❌ Error de Autenticación 401 (Código 190): El token ha expirado o no es válido. En Meta Business Settings > Usuarios del sistema, genera un nuevo Token Permanente (caducidad: Nunca).`
          });
        } else {
          setResultadoPrueba({
            exito: false,
            mensaje: `❌ Error Meta API (${code || res.status}): ${msg}`
          });
        }
      }
    } catch (err) {
      setResultadoPrueba({
        exito: false,
        mensaje: `❌ Error de red al consultar Meta Graph API: ${err.message}`
      });
    } finally {
      setProbandoConexion(false);
    }
  };

  const handleGuardarConfigMeta = async () => {
    if (!esAdmin) {
      setNotificacion({
        tipo: 'error',
        mensaje: 'Acción denegada: Solo los administradores pueden modificar las credenciales de WhatsApp Meta API.'
      });
      return;
    }
    setGuardandoConfig(true);
    try {
      const cfgRef = doc(db, 'whatsapp_config', 'credenciales');
      await setDoc(cfgRef, {
        phone_number_id: metaConfig.phone_number_id.trim(),
        whatsapp_token: metaConfig.whatsapp_token.trim(),
        verify_token: metaConfig.verify_token.trim() || DEFAULT_VERIFY_TOKEN,
        waba_id: metaConfig.waba_id.trim(),
        actualizado_por: currentUserEmail,
        actualizado_en: serverTimestamp()
      }, { merge: true });

      // 🛡️ Registro de Auditoría Inmutable
      await registrarLogAuditoria(
        currentUserEmail,
        'Actualización de Credenciales Meta API',
        `El usuario [${userName}] (${currentUserEmail}) actualizó la configuración de Meta Cloud API. Phone Number ID: [${metaConfig.phone_number_id.trim()}], WABA ID: [${metaConfig.waba_id.trim() || 'No asignado'}].`
      );

      setNotificacion({
        tipo: 'success',
        mensaje: '✅ Credenciales de Meta API guardadas correctamente. El sistema ya está enlazado.'
      });
      setResultadoPrueba(null);
      setOpenConfigModal(false);
    } catch (error) {
      console.error('Error guardando configuración:', error);
      setNotificacion({
        tipo: 'error',
        mensaje: 'Error guardando las credenciales: ' + error.message
      });
    } finally {
      setGuardandoConfig(false);
    }
  };

  // ==============================================================
  // ELIMINACIÓN DE CONVERSACIÓN (SOLO ADMINISTRADORES + AUDITORÍA)
  // ==============================================================
  const handleEliminarChat = async () => {
    const chatTarget = chatAEliminar || selectedChat;
    if (!chatTarget || !esAdmin) return;
    setEliminandoChat(true);
    try {
      const chatId = chatTarget.id;
      const chatNombre = chatTarget.nombre || `+${chatTarget.telefono}`;
      const chatTelefono = chatTarget.telefono || chatTarget.id;

      // 1. Eliminar mensajes de la subcolección en lotes (batch)
      const mensajesRef = collection(db, 'whatsapp_chats', chatId, 'mensajes');
      const mensajesSnap = await getDocs(mensajesRef);
      if (!mensajesSnap.empty) {
        const batch = writeBatch(db);
        mensajesSnap.forEach((docSnap) => {
          batch.delete(docSnap.ref);
        });
        await batch.commit();
      }

      // 2. Eliminar el documento de la conversación
      await deleteDoc(doc(db, 'whatsapp_chats', chatId));

      // 3. Registrar en logs de auditoría inmutables de la institución
      await registrarLogAuditoria(
        currentUserEmail,
        'Eliminación de Conversación WhatsApp',
        `El usuario [${userName}] (${currentUserEmail}) eliminó permanentemente la conversación con [${chatNombre}] (Tel: +${chatTelefono}) y su historial de ${mensajesSnap.size} mensajes.`
      );

      if (selectedChat?.id === chatId) {
        setSelectedChat(null);
      }
      setOpenDeleteChatModal(false);
      setChatAEliminar(null);
      setNotificacion({
        tipo: 'success',
        mensaje: `Conversación con ${chatNombre} eliminada correctamente.`
      });
    } catch (error) {
      console.error('Error al eliminar conversación:', error);
      setNotificacion({
        tipo: 'error',
        mensaje: 'Error eliminando la conversación: ' + error.message
      });
    } finally {
      setEliminandoChat(false);
    }
  };

  const copiarAlPortapapeles = (texto, nombreCampo) => {
    navigator.clipboard.writeText(texto);
    setCopiadoCampo(nombreCampo);
    setTimeout(() => setCopiadoCampo(''), 2500);
  };

  // ==============================================================
  // 2. ESCUCHA EN TIEMPO REAL DE CONVERSACIONES (Firestore)
  // ==============================================================
  useEffect(() => {
    setLoadingChats(true);
    const chatsQuery = query(
      collection(db, 'whatsapp_chats'),
      orderBy('ultima_fecha', 'desc')
    );

    const unsubscribe = onSnapshot(chatsQuery, (snapshot) => {
      const lista = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
      setChats(lista);
      setLoadingChats(false);

      // Si tenemos un chat abierto, actualizar su estado en memoria
      if (selectedChat) {
        const actualizado = lista.find(c => c.id === selectedChat.id);
        if (actualizado) {
          setSelectedChat(actualizado);
        }
      }
    }, (error) => {
      console.error('Error escuchando chats de WhatsApp:', error);
      setLoadingChats(false);
    });

    return () => unsubscribe();
  }, [selectedChat?.id]);

  // ==============================================================
  // 3. ESCUCHA EN TIEMPO REAL DE MENSAJES DEL CHAT SELECCIONADO + CONFIRMACIÓN DE LECTURA (VISTO)
  // ==============================================================
  useEffect(() => {
    if (!selectedChat?.id) return;
    if ((selectedChat.no_leidos || 0) > 0) {
      const chatRef = doc(db, 'whatsapp_chats', selectedChat.id);
      updateDoc(chatRef, {
        no_leidos: 0,
        ultimo_leido_por: userName,
        ultimo_leido_en: serverTimestamp()
      }).catch(() => {});
    }
  }, [selectedChat?.id, selectedChat?.no_leidos, userName]);

  useEffect(() => {
    if (!selectedChat) {
      setMensajesChat([]);
      return;
    }

    setLoadingMensajes(true);
    const chatIdActual = selectedChat.id;

    const mensajesQuery = query(
      collection(db, 'whatsapp_chats', chatIdActual, 'mensajes'),
      orderBy('fecha', 'asc')
    );

    const unsubscribe = onSnapshot(mensajesQuery, (snapshot) => {
      const msgs = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
      setMensajesChat(msgs);
      setLoadingMensajes(false);

      // Marcar mensajes entrantes como vistos/leídos y notificar Read Receipt ("read") a Meta API
      const entrantesNoLeidos = msgs.filter(
        (m) => !m.es_mio && m.estado !== 'read' && m.estado !== 'leido'
      );
      if (entrantesNoLeidos.length > 0) {
        entrantesNoLeidos.forEach((m) => {
          const mRef = doc(db, 'whatsapp_chats', chatIdActual, 'mensajes', m.id);
          updateDoc(mRef, {
            estado: 'read',
            leido_por: userName,
            leido_en: serverTimestamp()
          }).catch(() => {});
        });

        // Enviar confirmación oficial de lectura (doble check azul para el cliente) al último wamid
        const ultimoConWamid = [...entrantesNoLeidos]
          .reverse()
          .find((m) => m.id_meta && String(m.id_meta).startsWith('wamid.'));
        if (ultimoConWamid && metaConfig.whatsapp_token && metaConfig.phone_number_id) {
          fetch(`https://graph.facebook.com/v21.0/${metaConfig.phone_number_id}/messages`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${metaConfig.whatsapp_token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              status: 'read',
              message_id: ultimoConWamid.id_meta
            })
          }).catch(() => {});
        }
      }
    }, (error) => {
      console.error('Error escuchando mensajes del chat:', error);
      setLoadingMensajes(false);
    });

    return () => unsubscribe();
  }, [selectedChat?.id, metaConfig.whatsapp_token, metaConfig.phone_number_id, userName]);

  // ==============================================================
  // 4. ENVÍO DE MENSAJES (Cloud Function + Fallback Resiliente)
  // ==============================================================
  const handleSendMessage = async (textoPersonalizado = null) => {
    const textoAEnviar = (textoPersonalizado || mensajeTexto).trim();
    if (!textoAEnviar || !selectedChat) return;

    setIsSending(true);

    const telefonoDestino = selectedChat.telefono || selectedChat.id;
    const telClean = String(telefonoDestino).replace(/\D/g, '');

    try {
      // Verificar si el cliente nos ha escrito en las últimas 24 horas (Ventana de Atención de Meta)
      const ahoraMs = Date.now();
      const tieneVentana24hAbierta = mensajesChat.some((m) => {
        if (m.es_mio) return false;
        const fMs = m.fecha?.toMillis
          ? m.fecha.toMillis()
          : m.fecha?.seconds
          ? m.fecha.seconds * 1000
          : 0;
        return fMs > 0 && ahoraMs - fMs < 24 * 60 * 60 * 1000;
      });

      // Si la ventana de 24h está CERRADA (el cliente aún no ha respondido o escribió hace >24h),
      // enviar automáticamente usando la plantilla aprobada en español "aviso_institucional_iiresodh"
      // para evitar que Meta rechace el mensaje con Error 131047 (❗).
      if (!tieneVentana24hAbierta && metaConfig.whatsapp_token && metaConfig.phone_number_id) {
        const rawNombre = (selectedChat.nombre || '').trim();
        const esSoloNumero = !rawNombre || /^\+?\d[\d\s-]*$/.test(rawNombre);
        const nombreDest = esSoloNumero ? 'usuario(a)' : rawNombre.replace(/[\r\n\t]+/g, ' ').trim();
        const textoFormateado = textoAEnviar.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
        const tplRes = await fetch(
          `https://graph.facebook.com/v21.0/${metaConfig.phone_number_id}/messages`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${metaConfig.whatsapp_token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              recipient_type: 'individual',
              to: telClean,
              type: 'template',
              template: {
                name: 'aviso_institucional_iiresodh',
                language: { code: 'es' },
                components: [
                  {
                    type: 'body',
                    parameters: [
                      { type: 'text', text: nombreDest },
                      { type: 'text', text: textoFormateado }
                    ]
                  }
                ]
              }
            })
          }
        );
        const tplData = await tplRes.json().catch(() => ({}));
        if (tplRes.ok) {
          const wamidTpl = tplData.messages?.[0]?.id || null;
          if (!textoPersonalizado) setMensajeTexto('');
          const textoBurbuja = `📋 [Plantilla Oficial IIRESODH]\nEstimado(a) ${nombreDest}, le saludamos del Instituto Internacional de Responsabilidad Social y Derechos Humanos (IIRESODH). ${textoFormateado} Por favor responda a este mensaje para continuar la atención.`;
          const msgPayload = {
            id_meta: wamidTpl,
            texto: textoBurbuja,
            es_mio: true,
            agente_nombre: userName,
            agente_email: currentUserEmail,
            fecha: serverTimestamp(),
            estado: 'sent',
            tipo: 'template'
          };
          if (wamidTpl) {
            await setDoc(doc(db, 'whatsapp_chats', telClean, 'mensajes', wamidTpl), msgPayload);
          } else {
            await addDoc(collection(db, 'whatsapp_chats', telClean, 'mensajes'), msgPayload);
          }
          await setDoc(
            doc(db, 'whatsapp_chats', telClean),
            {
              telefono: telClean,
              ultimo_mensaje: textoBurbuja,
              ultima_fecha: serverTimestamp(),
              actualizado_en: serverTimestamp(),
              ultimo_agente: userName,
              no_leidos: 0
            },
            { merge: true }
          );
          setIsSending(false);
          return;
        }
      }

      // 🚀 Intento 1: Llamada a la Cloud Function de Backend (cuando la ventana de 24h está abierta)
      let enviadoPorFunction = false;
      let metaMessageId = null;
      let errorAutenticacion = false;
      let mensajeErrorDetallado = null;

      try {
        const res = await fetch(BACKEND_SEND_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            telefono: telefonoDestino,
            mensaje: textoAEnviar,
            agente_nombre: userName,
            agente_email: currentUserEmail
          })
        });

        if (res.ok) {
          const data = await res.json();
          enviadoPorFunction = true;
          metaMessageId = data.id_mensaje;
        } else {
          const errData = await res.json().catch(() => null);
          const metaErr = errData?.detalles?.error;
          const code = metaErr?.code;

          if (res.status === 401 || code === 190) {
            errorAutenticacion = true;
            mensajeErrorDetallado = '⚠️ El token de acceso de WhatsApp Meta API ha expirado o no es válido (Error 401 / Código 190). Por favor renuévalo en "⚙️ Conexión Meta API" configurando un Token Permanente.';
          } else if (code === 131030) {
            mensajeErrorDetallado = '⚠️ En modo de prueba de Meta, debes agregar este número en Meta Developers > WhatsApp > Primeros pasos > Administrar lista de números.';
          } else {
            mensajeErrorDetallado = metaErr?.message || errData?.error || `Error del servidor (${res.status})`;
          }
        }
      } catch (errFunc) {
        console.warn('Cloud Function no disponible o fallo de red, evaluando fallback directo:', errFunc);
      }

      // Si el backend devolvió error 401 de autenticación, NO intentamos con el mismo token inválido
      if (errorAutenticacion) {
        setNotificacion({
          tipo: 'warning',
          mensaje: mensajeErrorDetallado
        });
        setIsSending(false);
        return;
      }

      // Si el backend reportó otro error explícito de Meta, notificar al usuario
      if (!enviadoPorFunction && mensajeErrorDetallado) {
        setNotificacion({
          tipo: 'error',
          mensaje: `Error al enviar mensaje vía WhatsApp: ${mensajeErrorDetallado}`
        });
        setIsSending(false);
        return;
      }

      // 🌐 Intento 2: Entrega directa a Meta Graph API si la Cloud Function estuvo inalcanzable
      let entregadoAMeta = false;
      if (!enviadoPorFunction && metaConfig.whatsapp_token && metaConfig.phone_number_id) {
        try {
          const telClean = String(telefonoDestino).replace(/\D/g, '');
          const metaRes = await fetch(`https://graph.facebook.com/v21.0/${metaConfig.phone_number_id}/messages`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${metaConfig.whatsapp_token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              recipient_type: 'individual',
              to: telClean,
              type: 'text',
              text: { body: textoAEnviar }
            })
          });

          const metaData = await metaRes.json().catch(() => ({}));
          if (metaRes.ok) {
            entregadoAMeta = true;
            metaMessageId = metaData.messages?.[0]?.id || null;
            console.log('✅ Mensaje entregado a WhatsApp vía Meta API directa:', metaData);
          } else {
            console.warn('⚠️ Meta API directa devolvió respuesta:', metaData);
            if (metaRes.status === 401 || metaData?.error?.code === 190) {
              setNotificacion({
                tipo: 'warning',
                mensaje: '⚠️ El token de Meta API ha expirado (Error 401 / Código 190). Por favor renuévalo en "⚙️ Conexión Meta API".'
              });
              setIsSending(false);
              return;
            } else if (metaData?.error?.code === 131030) {
              setNotificacion({
                tipo: 'warning',
                mensaje: '⚠️ En modo de prueba de Meta, debes agregar este número en Meta Developers > WhatsApp > Primeros pasos > Administrar lista de números de teléfono.'
              });
              setIsSending(false);
              return;
            } else if (metaData?.error?.message) {
              setNotificacion({
                tipo: 'error',
                mensaje: `Error Meta API: ${metaData.error.message}`
              });
              setIsSending(false);
              return;
            }
          }
        } catch (eMeta) {
          console.warn('Error conectando directamente con Meta Graph API:', eMeta);
        }
      }

      // Si fue exitoso por Cloud Function o por llamada directa:
      if (enviadoPorFunction || entregadoAMeta) {
        // Limpiamos el texto escrito
        if (!textoPersonalizado) setMensajeTexto('');

        // Si fue enviado por fallback directo en cliente, guardar en Firestore con el mismo ID de Meta (wamid)
        if (!enviadoPorFunction) {
          const msgPayload = {
            id_meta: metaMessageId,
            texto: textoAEnviar,
            es_mio: true,
            agente_nombre: userName,
            agente_email: currentUserEmail,
            fecha: serverTimestamp(),
            estado: 'sent',
            tipo: 'text'
          };
          if (metaMessageId) {
            await setDoc(doc(db, 'whatsapp_chats', telefonoDestino, 'mensajes', metaMessageId), msgPayload);
          } else {
            await addDoc(collection(db, 'whatsapp_chats', telefonoDestino, 'mensajes'), msgPayload);
          }

          const chatRef = doc(db, 'whatsapp_chats', telefonoDestino);
          await setDoc(chatRef, {
            telefono: telefonoDestino,
            ultimo_mensaje: textoAEnviar,
            ultima_fecha: serverTimestamp(),
            actualizado_en: serverTimestamp(),
            ultimo_agente: userName,
            no_leidos: 0
          }, { merge: true });
        }
      } else {
        setNotificacion({
          tipo: 'error',
          mensaje: 'No fue posible entregar el mensaje a WhatsApp. Verifica tu conexión a internet o las credenciales en ⚙️ Conexión Meta API.'
        });
      }

    } catch (error) {
      console.error('Error al enviar mensaje:', error);
      setNotificacion({
        tipo: 'error',
        mensaje: 'No se pudo enviar el mensaje: ' + error.message
      });
    } finally {
      setIsSending(false);
    }
  };

  // ==============================================================
  // 5. VERIFICAR PLANTILLAS EN META E INICIAR NUEVO CHAT
  // ==============================================================
  const verificarPlantillaIiresodhEnMeta = async () => {
    const wabaPrincipal = metaConfig.waba_id || DEFAULT_WABA_ID;
    const token = metaConfig.whatsapp_token || DEFAULT_TOKEN;
    if (!wabaPrincipal || !token) return 'UNKNOWN';
    setCargandoPlantillasMeta(true);
    try {
      const wabasAConsultar = Array.from(new Set([wabaPrincipal, '1431176165105564', '2324714508024659']));
      let mejorEstado = 'NOT_FOUND';
      for (const wId of wabasAConsultar) {
        const res = await fetch(
          `https://graph.facebook.com/v21.0/${wId}/message_templates?fields=name,status,language`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) continue;
        const data = await res.json().catch(() => ({}));
        const lista = data?.data || [];
        const aprobada = lista.find(
          (t) =>
            (t.name === 'aviso_institucional_iiresodh' || t.name === 'notificacion_expediente_iiresodh') &&
            t.status === 'APPROVED'
        );
        if (aprobada) {
          mejorEstado = 'APPROVED';
          break;
        }
        const pendiente = lista.find(
          (t) =>
            t.name === 'aviso_institucional_iiresodh' || t.name === 'notificacion_expediente_iiresodh'
        );
        if (pendiente && mejorEstado !== 'APPROVED') {
          mejorEstado = pendiente.status || 'PENDING';
        }
      }
      setEstadoPlantillaIiresodh(mejorEstado);
      return mejorEstado;
    } catch {
      return estadoPlantillaIiresodh;
    } finally {
      setCargandoPlantillasMeta(false);
    }
  };

  useEffect(() => {
    if (openNuevoChatModal) {
      verificarPlantillaIiresodhEnMeta();
    }
  }, [openNuevoChatModal]);

  const handleCrearNuevoChat = async () => {
    const telLimpio = nuevoTelefono.replace(/\D/g, '');
    if (!telLimpio || telLimpio.length < 8) {
      setNotificacion({
        tipo: 'warning',
        mensaje: 'Ingresa un número de teléfono válido con código de país (ej. 50688888888).'
      });
      return;
    }

    setIsSending(true);
    try {
      const chatRef = doc(db, 'whatsapp_chats', telLimpio);
      const nombreFinal = nuevoNombre.trim() || `+${telLimpio}`;
      const primerMensaje =
        nuevoMensajeInicial.trim() ||
        'Le escribimos respecto al seguimiento de su consulta o expediente institucional.';

      // Verificar estado actual de la plantilla en español en Meta
      const statusTpl = await verificarPlantillaIiresodhEnMeta();

      let metaPrimerMsgId = null;
      let textoGuardadoEnBurbuja = primerMensaje;
      let tipoMensajeGuardado = 'text';
      let errorMetaDetallado = null;

      if (metaConfig.whatsapp_token && metaConfig.phone_number_id) {
        try {
          const intentarComoPlantilla = modoInicioChat !== 'texto_libre' && statusTpl === 'APPROVED';

          if (intentarComoPlantilla) {
            tipoMensajeGuardado = 'template';
            const esSoloNum = !nuevoNombre.trim() || /^\+?\d[\d\s-]*$/.test(nuevoNombre.trim());
            const nombreParam = esSoloNum
              ? 'usuario(a)'
              : nuevoNombre.trim().replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
            const mensajeParam = primerMensaje.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
            textoGuardadoEnBurbuja = `📋 [Plantilla Oficial IIRESODH]\nEstimado(a) ${nombreParam}, le saludamos del Instituto Internacional de Responsabilidad Social y Derechos Humanos (IIRESODH). ${mensajeParam} Por favor responda a este mensaje para continuar la atención.`;
            const payloadTemplate = {
              messaging_product: 'whatsapp',
              recipient_type: 'individual',
              to: telLimpio,
              type: 'template',
              template: {
                name: 'aviso_institucional_iiresodh',
                language: { code: 'es' },
                components: [
                  {
                    type: 'body',
                    parameters: [
                      { type: 'text', text: nombreParam },
                      { type: 'text', text: mensajeParam }
                    ]
                  }
                ]
              }
            };

            const tplRes = await fetch(
              `https://graph.facebook.com/v21.0/${metaConfig.phone_number_id}/messages`,
              {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${metaConfig.whatsapp_token}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify(payloadTemplate)
              }
            );
            const tplData = await tplRes.json().catch(() => ({}));
            if (tplRes.ok) {
              metaPrimerMsgId = tplData.messages?.[0]?.id || null;
            }
          }

          // Si no se envió por plantilla (porque eligió texto libre o porque la plantilla aún está en PENDING en la cuenta +506 4081-6188),
          // enviar inmediatamente como mensaje de texto directo (sin llamar a hello_world inexistente)
          if (!metaPrimerMsgId) {
            tipoMensajeGuardado = 'text';
            textoGuardadoEnBurbuja = primerMensaje;
            const payloadTexto = {
              messaging_product: 'whatsapp',
              recipient_type: 'individual',
              to: telLimpio,
              type: 'text',
              text: { body: primerMensaje }
            };

            const txtRes = await fetch(
              `https://graph.facebook.com/v21.0/${metaConfig.phone_number_id}/messages`,
              {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${metaConfig.whatsapp_token}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify(payloadTexto)
              }
            );
            const txtData = await txtRes.json().catch(() => ({}));
            if (txtRes.ok) {
              metaPrimerMsgId = txtData.messages?.[0]?.id || null;
            } else {
              errorMetaDetallado =
                txtData?.error?.error_user_msg ||
                txtData?.error?.message ||
                `Error Meta (${txtData?.error?.code || txtRes.status})`;
            }
          }
        } catch (eMeta) {
          console.warn('Error enviando primer mensaje a Meta:', eMeta);
          errorMetaDetallado = eMeta.message;
        }
      }

      // Siempre crear y abrir la conversación en la Intranet para que el operador pueda gestionarla
      await setDoc(
        chatRef,
        {
          telefono: telLimpio,
          nombre: nombreFinal,
          ultimo_mensaje: textoGuardadoEnBurbuja,
          ultima_fecha: serverTimestamp(),
          actualizado_en: serverTimestamp(),
          ultimo_agente: userName,
          no_leidos: 0,
          creado_por: currentUserEmail
        },
        { merge: true }
      );

      // Enviar el mensaje inicial a la subcolección con ID = wamid de Meta si existe
      const primerPayload = {
        id_meta: metaPrimerMsgId,
        texto: textoGuardadoEnBurbuja,
        es_mio: true,
        agente_nombre: userName,
        agente_email: currentUserEmail,
        fecha: serverTimestamp(),
        estado: metaPrimerMsgId ? 'sent' : errorMetaDetallado ? 'failed' : 'enviado',
        error_detalle: errorMetaDetallado || null,
        tipo: tipoMensajeGuardado
      };
      if (metaPrimerMsgId) {
        await setDoc(doc(db, 'whatsapp_chats', telLimpio, 'mensajes', metaPrimerMsgId), primerPayload);
      } else {
        await addDoc(collection(db, 'whatsapp_chats', telLimpio, 'mensajes'), primerPayload);
      }

      // Seleccionar el nuevo chat
      setSelectedChat({
        id: telLimpio,
        telefono: telLimpio,
        nombre: nombreFinal,
        ultimo_mensaje: textoGuardadoEnBurbuja
      });

      setOpenNuevoChatModal(false);
      setNuevoTelefono('');
      setNuevoNombre('');
      setNuevoMensajeInicial('');

      if (metaPrimerMsgId && tipoMensajeGuardado === 'template') {
        setNotificacion({
          tipo: 'success',
          mensaje: `✅ Plantilla oficial enviada a ${nombreFinal}. En cuanto responda, se abrirá la ventana de 24h de texto libre.`
        });
      } else if (metaPrimerMsgId) {
        setNotificacion({
          tipo: statusTpl === 'APPROVED' ? 'success' : 'info',
          mensaje:
            statusTpl === 'APPROVED'
              ? `✅ Mensaje enviado a ${nombreFinal}.`
              : `💬 Chat abierto y mensaje enviado a Meta para ${nombreFinal}. Nota: la plantilla en español "aviso_institucional_iiresodh" en la cuenta principal (+506 4081-6188) está en estado PENDING de aprobación por Meta; si el contacto no ha escrito en las últimas 24h, el texto directo solo le llegará cuando nos escriba o cuando Meta pase la plantilla a APPROVED.`
        });
      } else {
        setNotificacion({
          tipo: 'warning',
          mensaje: `⚠️ Conversación abierta para ${nombreFinal}, pero Meta indicó: ${errorMetaDetallado}`
        });
      }
    } catch (e) {
      console.error('Error creando nuevo chat:', e);
      setNotificacion({ tipo: 'error', mensaje: 'Error al iniciar chat: ' + e.message });
    } finally {
      setIsSending(false);
    }
  };

  // ==============================================================
  // 6. EDITAR NOMBRE DEL CONTACTO
  // ==============================================================
  const handleGuardarNombreContacto = async () => {
    if (!selectedChat || !editNombreContacto.trim()) return;

    try {
      const chatRef = doc(db, 'whatsapp_chats', selectedChat.id);
      await updateDoc(chatRef, {
        nombre: editNombreContacto.trim()
      });

      setSelectedChat(prev => ({ ...prev, nombre: editNombreContacto.trim() }));
      setOpenEditContactoModal(false);
      setNotificacion({ tipo: 'success', mensaje: 'Nombre del contacto actualizado.' });
    } catch (e) {
      console.error('Error actualizando contacto:', e);
      setNotificacion({ tipo: 'error', mensaje: 'No se pudo actualizar el nombre.' });
    }
  };

  // ==============================================================
  // 7. RESPUESTAS RÁPIDAS INSTITUCIONALES
  // ==============================================================
  const RESPUESTAS_RAPIDAS = [
    {
      titulo: 'Saludo Institucional',
      texto: 'Estimado/a, le saludamos del Instituto Internacional de Responsabilidad Social y Derechos Humanos (IIRESODH). ¿En qué podemos colaborarle hoy?'
    },
    {
      titulo: 'Solicitud de Expediente/Caso',
      texto: 'Para brindarle una mejor atención a su consulta jurídica, ¿sería tan amable de indicarnos su nombre completo y número de expediente o trámite?'
    },
    {
      titulo: 'Confirmación de Recepción',
      texto: 'Confirmamos la recepción de sus documentos e información. Nuestro equipo legal estará revisándolo a la mayor brevedad.'
    },
    {
      titulo: 'Horario y Canales Oficiales',
      texto: 'Le recordamos que nuestro horario oficial de atención es de lunes a viernes de 8:00 AM a 5:00 PM. Cualquier consulta adicional será atendida en este orden.'
    }
  ];

  const handleSeleccionarRespuestaRapida = (texto) => {
    setMensajeTexto(texto);
    setAnchorElRespuestas(null);
  };

  // ==============================================================
  // 8. CENTRAL DE VOZ WEB (PAUSAR → TELÉFONO FÍSICO +506 4081-6188),
  //    LLAMADAS WEBRTC, NOTAS DE VOZ (🎙️) Y SALA MEET EN 1 CLIC
  // ==============================================================
  const handleToggleRecepcionVozWeb = async () => {
    const nuevoEstado = !recepcionVozWebActiva;
    setCambiandoModoVoz(true);
    try {
      const phoneId = metaConfig.phone_number_id || DEFAULT_PHONE_ID;
      const token = metaConfig.whatsapp_token || DEFAULT_TOKEN;

      // 1. Actualizar directamente en Meta Cloud API (settings.calling)
      if (phoneId && token) {
        const callingSetting = nuevoEstado
          ? { status: 'ENABLED', call_icon_visibility: 'DEFAULT', callback_permission_status: 'ENABLED' }
          : { status: 'DISABLED', call_icon_visibility: 'DISABLE_ALL' };
        await fetch(`https://graph.facebook.com/v21.0/${phoneId}/settings`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ calling: callingSetting })
        }).catch(() => {});
      }

      // 2. Guardar en Firestore para sincronizar a todos los operadores en tiempo real
      await setDoc(
        doc(db, 'whatsapp_config', 'credenciales'),
        {
          recepcion_voz_web_activa: nuevoEstado,
          voz_modificado_por: userName,
          actualizado_en: serverTimestamp()
        },
        { merge: true }
      );

      setRecepcionVozWebActiva(nuevoEstado);
      await registrarLogAuditoria(
        currentUserEmail,
        nuevoEstado ? 'Activación de Llamadas Web WhatsApp' : 'Pausa de Llamadas Web (Desvío a Teléfono Físico)',
        `El operador [${userName}] configuró la recepción de llamadas en: ${
          nuevoEstado ? 'ACTIVA EN WEB (Intranet)' : 'EN PAUSA (Suena línea física +506 4081-6188)'
        }`
      );

      setNotificacion({
        tipo: nuevoEstado ? 'success' : 'info',
        mensaje: nuevoEstado
          ? '🟢 Recepción de Llamadas Web ACTIVA: Las llamadas de WhatsApp timbrarán aquí en la Intranet.'
          : '🟠 Recepción Web EN PAUSA: Las llamadas de voz de WhatsApp están desactivadas en la web para que entren directamente al teléfono físico (+506 4081-6188).'
      });
    } catch (err) {
      setNotificacion({
        tipo: 'error',
        mensaje: 'No se pudo cambiar el estado de recepción de llamadas: ' + err.message
      });
    } finally {
      setCambiandoModoVoz(false);
    }
  };

  // Escucha en tiempo real de llamadas entrantes de WhatsApp (solo cuando recepcionVozWebActiva === true)
  useEffect(() => {
    if (!recepcionVozWebActiva) {
      setLlamadaEntrante(null);
      return;
    }
    const callsQuery = query(collection(db, 'whatsapp_calls'), orderBy('fecha', 'desc'));
    const unsubCalls = onSnapshot(
      callsQuery,
      (snap) => {
        const ahoraMs = Date.now();
        const activa = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .find((c) => {
            if (c.estado !== 'entrante') return false;
            const fechaMs = c.fecha?.toMillis ? c.fecha.toMillis() : ahoraMs;
            return ahoraMs - fechaMs < 60000; // Últimos 60 segundos
          });
        setLlamadaEntrante(activa || null);
      },
      () => {}
    );
    return () => unsubCalls();
  }, [recepcionVozWebActiva]);

  const limpiarRecursosWebRTC = () => {
    if (llamadaTimerRef.current) {
      clearInterval(llamadaTimerRef.current);
      llamadaTimerRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (peerConnectionRef.current) {
      try {
        peerConnectionRef.current.close();
      } catch {
        // Silencioso
      }
      peerConnectionRef.current = null;
    }
    setEnLlamadaWebRTC(false);
    setSegundosLlamada(0);
    setMicSilenciado(false);
  };

  const handleContestarLlamadaWebRTC = async () => {
    if (!llamadaEntrante) return;
    const phoneId = metaConfig.phone_number_id || DEFAULT_PHONE_ID;
    const token = metaConfig.whatsapp_token || DEFAULT_TOKEN;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });
      peerConnectionRef.current = pc;

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        if (remoteAudioRef.current && event.streams[0]) {
          remoteAudioRef.current.srcObject = event.streams[0];
          remoteAudioRef.current.play().catch(() => {});
        }
      };

      if (llamadaEntrante.sdp) {
        await pc.setRemoteDescription(
          new RTCSessionDescription({
            type: 'offer',
            sdp: llamadaEntrante.sdp
          })
        );
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        await fetch(`https://graph.facebook.com/v21.0/${phoneId}/calls`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            call_id: llamadaEntrante.call_id,
            action: 'accept',
            session: {
              sdp_type: 'answer',
              sdp: answer.sdp
            }
          })
        });
      }

      await updateDoc(doc(db, 'whatsapp_calls', llamadaEntrante.id), {
        estado: 'en_curso',
        atendida_por: userName
      }).catch(() => {});

      setEnLlamadaWebRTC(true);
      setSegundosLlamada(0);
      llamadaTimerRef.current = setInterval(() => {
        setSegundosLlamada((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      setNotificacion({
        tipo: 'error',
        mensaje: 'No se pudo acceder al micrófono o conectar WebRTC: ' + err.message
      });
      limpiarRecursosWebRTC();
    }
  };

  const handleRechazarODesviarLlamada = async () => {
    if (!llamadaEntrante) return;
    const phoneId = metaConfig.phone_number_id || DEFAULT_PHONE_ID;
    const token = metaConfig.whatsapp_token || DEFAULT_TOKEN;
    try {
      await fetch(`https://graph.facebook.com/v21.0/${phoneId}/calls`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          call_id: llamadaEntrante.call_id,
          action: 'reject'
        })
      }).catch(() => {});

      await updateDoc(doc(db, 'whatsapp_calls', llamadaEntrante.id), {
        estado: 'desviada_telefono_fisico',
        rechazada_por: userName
      }).catch(() => {});
    } finally {
      limpiarRecursosWebRTC();
      setLlamadaEntrante(null);
    }
  };

  const handleColgarLlamadaWebRTC = async () => {
    const phoneId = metaConfig.phone_number_id || DEFAULT_PHONE_ID;
    const token = metaConfig.whatsapp_token || DEFAULT_TOKEN;
    if (llamadaEntrante?.call_id) {
      await fetch(`https://graph.facebook.com/v21.0/${phoneId}/calls`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          call_id: llamadaEntrante.call_id,
          action: 'terminate'
        })
      }).catch(() => {});
      await updateDoc(doc(db, 'whatsapp_calls', llamadaEntrante.id), {
        estado: 'finalizada'
      }).catch(() => {});
    }
    limpiarRecursosWebRTC();
    setLlamadaEntrante(null);
  };

  const handleToggleMuteMic = () => {
    if (localStreamRef.current) {
      const nuevoMute = !micSilenciado;
      localStreamRef.current.getAudioTracks().forEach((t) => {
        t.enabled = !nuevoMute;
      });
      setMicSilenciado(nuevoMute);
    }
  };

  // Solicitar Permiso de Llamada de Voz por WhatsApp (Política de Meta para llamadas salientes)
  const handleSolicitarPermisoLlamadaWhatsApp = async () => {
    if (!selectedChat) return;
    const telClean = String(selectedChat.telefono || selectedChat.id).replace(/\D/g, '');
    const phoneId = metaConfig.phone_number_id || DEFAULT_PHONE_ID;
    const token = metaConfig.whatsapp_token || DEFAULT_TOKEN;

    setIsSending(true);
    try {
      const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: telClean,
          type: 'interactive',
          interactive: {
            type: 'call_permission_request',
            action: { name: 'call_permission_request' },
            body: {
              text: `Estimado(a) ${
                selectedChat.nombre || 'usuario'
              }, el equipo de IIRESODH solicita su autorización para comunicarse con usted mediante llamada de voz de WhatsApp.`
            }
          }
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const wamid = data.messages?.[0]?.id || null;
        const txt = '📞 [Solicitud de Permiso de Llamada de Voz de WhatsApp enviada al contacto]';
        const payload = {
          id_meta: wamid,
          texto: txt,
          es_mio: true,
          agente_nombre: userName,
          agente_email: currentUserEmail,
          fecha: serverTimestamp(),
          estado: 'sent',
          tipo: 'interactive'
        };
        if (wamid) {
          await setDoc(doc(db, 'whatsapp_chats', telClean, 'mensajes', wamid), payload);
        } else {
          await addDoc(collection(db, 'whatsapp_chats', telClean, 'mensajes'), payload);
        }
        setNotificacion({
          tipo: 'success',
          mensaje: '📞 Solicitud de llamada enviada al WhatsApp del contacto.'
        });
      } else {
        // Si la ventana de 24h está cerrada o el número aún no tiene habilitado el botón interactivo, enviamos aviso directo
        await handleSendMessage(
          `📞 Estimado(a) ${
            selectedChat.nombre || ''
          }, deseamos comunicarnos con usted por vía telefónica desde IIRESODH (+506 4081-6188). ¿Nos confirma si puede recibir nuestra llamada en este momento?`
        );
      }
    } catch (e) {
      setNotificacion({
        tipo: 'error',
        mensaje: 'Error solicitando llamada: ' + e.message
      });
    } finally {
      setIsSending(false);
    }
  };

  // Opción 2: Grabación y Envío de Notas de Voz (🎙️)
  const handleIniciarGrabacionVoz = async () => {
    if (!selectedChat) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimePreferido = MediaRecorder.isTypeSupported('audio/ogg; codecs=opus')
        ? 'audio/ogg; codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : 'audio/webm';

      const recorder = new MediaRecorder(stream, { mimeType: mimePreferido });
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setGrabandoVoz(true);
      setSegundosGrabacion(0);
      grabacionTimerRef.current = setInterval(() => {
        setSegundosGrabacion((s) => s + 1);
      }, 1000);
    } catch (err) {
      setNotificacion({
        tipo: 'error',
        mensaje: 'No se pudo acceder al micrófono del navegador: ' + err.message
      });
    }
  };

  const handleCancelarGrabacionVoz = () => {
    if (grabacionTimerRef.current) {
      clearInterval(grabacionTimerRef.current);
      grabacionTimerRef.current = null;
    }
    if (mediaRecorderRef.current) {
      try {
        mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
        mediaRecorderRef.current.stop();
      } catch {
        // Silencioso
      }
      mediaRecorderRef.current = null;
    }
    audioChunksRef.current = [];
    setGrabandoVoz(false);
    setSegundosGrabacion(0);
  };

  const handleDetenerYEnviarNotaVoz = async () => {
    if (!mediaRecorderRef.current || !selectedChat) return;
    if (grabacionTimerRef.current) {
      clearInterval(grabacionTimerRef.current);
      grabacionTimerRef.current = null;
    }

    const recorder = mediaRecorderRef.current;
    const mimeType = recorder.mimeType || 'audio/ogg';
    const duracionSegs = segundosGrabacion;

    setGrabandoVoz(false);
    setEnviandoNotaVoz(true);

    try {
      const audioBlob = await new Promise((resolve) => {
        recorder.onstop = () => {
          recorder.stream.getTracks().forEach((t) => t.stop());
          resolve(new Blob(audioChunksRef.current, { type: mimeType }));
        };
        recorder.stop();
      });
      mediaRecorderRef.current = null;

      const telClean = String(selectedChat.telefono || selectedChat.id).replace(/\D/g, '');
      const ext = mimeType.includes('mp4') ? 'm4a' : mimeType.includes('ogg') ? 'ogg' : 'webm';
      const fileName = `nota_voz_${Date.now()}.${ext}`;

      // 1. Subir a Firebase Storage para reproducción inmediata multi-operador en la Intranet
      const refStorage = storageRef(storage, `whatsapp_audios/${telClean}/${fileName}`);
      await uploadBytes(refStorage, audioBlob, { contentType: mimeType });
      const publicAudioUrl = await getDownloadURL(refStorage);

      // 2. Enviar a Meta WhatsApp API como Nota de Voz (subiendo a /media o por link)
      const phoneId = metaConfig.phone_number_id || DEFAULT_PHONE_ID;
      const token = metaConfig.whatsapp_token || DEFAULT_TOKEN;
      let wamidAudio = null;

      if (phoneId && token) {
        try {
          const form = new FormData();
          form.append('messaging_product', 'whatsapp');
          const mimeMeta = mimeType.includes('mp4') ? 'audio/mp4' : 'audio/ogg';
          form.append('file', new File([audioBlob], fileName, { type: mimeMeta }));
          form.append('type', mimeMeta);

          const uploadRes = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/media`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: form
          });
          const uploadData = await uploadRes.json().catch(() => ({}));

          let msgAudioBody = null;
          if (uploadRes.ok && uploadData.id) {
            msgAudioBody = {
              messaging_product: 'whatsapp',
              recipient_type: 'individual',
              to: telClean,
              type: 'audio',
              audio: { id: uploadData.id }
            };
          } else {
            msgAudioBody = {
              messaging_product: 'whatsapp',
              recipient_type: 'individual',
              to: telClean,
              type: 'text',
              text: { body: `🎙️ Nota de voz de IIRESODH (${duracionSegs}s): ${publicAudioUrl}` }
            };
          }

          const sendRes = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(msgAudioBody)
          });
          const sendData = await sendRes.json().catch(() => ({}));
          if (sendRes.ok) {
            wamidAudio = sendData.messages?.[0]?.id || null;
          }
        } catch (eMetaAudio) {
          console.warn('Fallback enviando link de nota de voz:', eMetaAudio);
        }
      }

      const textoResumen = `🎙️ Nota de voz (${duracionSegs}s)`;
      const msgPayload = {
        id_meta: wamidAudio,
        texto: textoResumen,
        media_url: publicAudioUrl,
        mime_type: mimeType,
        duracion_segundos: duracionSegs,
        es_mio: true,
        agente_nombre: userName,
        agente_email: currentUserEmail,
        fecha: serverTimestamp(),
        estado: wamidAudio ? 'sent' : 'enviado',
        tipo: 'audio'
      };

      if (wamidAudio) {
        await setDoc(doc(db, 'whatsapp_chats', telClean, 'mensajes', wamidAudio), msgPayload);
      } else {
        await addDoc(collection(db, 'whatsapp_chats', telClean, 'mensajes'), msgPayload);
      }

      await setDoc(
        doc(db, 'whatsapp_chats', telClean),
        {
          telefono: telClean,
          ultimo_mensaje: textoResumen,
          ultima_fecha: serverTimestamp(),
          actualizado_en: serverTimestamp(),
          ultimo_agente: userName,
          no_leidos: 0
        },
        { merge: true }
      );
    } catch (err) {
      setNotificacion({
        tipo: 'error',
        mensaje: 'Error al enviar la nota de voz: ' + err.message
      });
    } finally {
      setEnviandoNotaVoz(false);
      setSegundosGrabacion(0);
    }
  };

  // Resolver y escuchar notas de voz entrantes enviadas por el cliente desde WhatsApp
  const handleReproducirAudioMeta = async (msg) => {
    if (!msg?.media_id) return;
    if (audiosResueltos[msg.id]) return;
    setCargandoAudioId(msg.id);
    try {
      const proxyUrl = `${WEBHOOK_CALLBACK_URL}?media_id=${encodeURIComponent(msg.media_id)}`;
      setAudiosResueltos((prev) => ({ ...prev, [msg.id]: proxyUrl }));
    } catch (e) {
      setNotificacion({
        tipo: 'warning',
        mensaje: 'No se pudo cargar el audio desde Meta API: ' + e.message
      });
    } finally {
      setCargandoAudioId(null);
    }
  };

  // Enviar un Sticker Nativo 512x512 (.webp) a WhatsApp y mostrarlo en el chat
  const enviarBlobStickerAWhatsApp = async (webpBlob, dataUrlPreview, etiquetaResumen = '🏷️ Sticker') => {
    if (!selectedChat || !webpBlob) return;
    setEnviandoSticker(true);
    setAnchorElEmoji(null);
    try {
      const telClean = String(selectedChat.telefono || selectedChat.id).replace(/\D/g, '');
      const phoneId = metaConfig.phone_number_id || DEFAULT_PHONE_ID;
      const token = metaConfig.whatsapp_token || DEFAULT_TOKEN;
      let wamidSticker = null;

      if (phoneId && token) {
        const form = new FormData();
        form.append('messaging_product', 'whatsapp');
        form.append('file', new File([webpBlob], `sticker_${Date.now()}.webp`, { type: 'image/webp' }));
        form.append('type', 'image/webp');

        const uploadRes = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/media`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: form
        });
        const uploadData = await uploadRes.json().catch(() => ({}));

        if (uploadRes.ok && uploadData.id) {
          const sendRes = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              recipient_type: 'individual',
              to: telClean,
              type: 'sticker',
              sticker: { id: uploadData.id }
            })
          });
          const sendData = await sendRes.json().catch(() => ({}));
          if (sendRes.ok) {
            wamidSticker = sendData.messages?.[0]?.id || null;
          }
        }
      }

      const msgPayload = {
        id_meta: wamidSticker,
        texto: etiquetaResumen,
        media_url: dataUrlPreview,
        mime_type: 'image/webp',
        es_mio: true,
        agente_nombre: userName,
        agente_email: currentUserEmail,
        fecha: serverTimestamp(),
        estado: wamidSticker ? 'sent' : 'enviado',
        tipo: 'sticker'
      };

      if (wamidSticker) {
        await setDoc(doc(db, 'whatsapp_chats', telClean, 'mensajes', wamidSticker), msgPayload);
      } else {
        await addDoc(collection(db, 'whatsapp_chats', telClean, 'mensajes'), msgPayload);
      }

      await setDoc(
        doc(db, 'whatsapp_chats', telClean),
        {
          telefono: telClean,
          ultimo_mensaje: etiquetaResumen,
          ultima_fecha: serverTimestamp(),
          actualizado_en: serverTimestamp(),
          ultimo_agente: userName,
          no_leidos: 0
        },
        { merge: true }
      );
    } catch (err) {
      setNotificacion({
        tipo: 'error',
        mensaje: 'No se pudo enviar el sticker: ' + err.message
      });
    } finally {
      setEnviandoSticker(false);
    }
  };

  const handleEnviarStickerCatalogo = async (stickerCfg) => {
    try {
      const { dataUrl, blob } = await generarStickerWebp512(stickerCfg);
      await enviarBlobStickerAWhatsApp(blob, dataUrl, `🏷️ Sticker: ${stickerCfg.emoji} ${stickerCfg.titulo}`);
    } catch (err) {
      setNotificacion({
        tipo: 'error',
        mensaje: 'Error preparando sticker: ' + err.message
      });
    }
  };

  const handleSubirImagenComoSticker = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const imgUrl = URL.createObjectURL(file);
      const img = new window.Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = imgUrl;
      });
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, 512, 512);
      const scale = Math.min(512 / img.width, 512 / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (512 - w) / 2, (512 - h) / 2, w, h);
      URL.revokeObjectURL(imgUrl);

      const dataUrl = canvas.toDataURL('image/webp', 0.9);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.9));
      await enviarBlobStickerAWhatsApp(blob, dataUrl, '🏷️ Sticker');
    } catch (err) {
      setNotificacion({
        tipo: 'error',
        mensaje: 'No se pudo convertir la imagen en sticker: ' + err.message
      });
    } finally {
      e.target.value = null;
    }
  };

  // Opción 3: Crear y enviar Sala de Voz / Videollamada (Google Meet Nativo) en 1 Clic al WhatsApp del cliente
  const handleEnviarSalaVozMeet = async () => {
    if (!selectedChat || creandoSalaMeet) return;
    setCreandoSalaMeet(true);
    try {
      const espacio = await crearEspacioGoogleMeet(currentUserEmail);
      const meetUrl = espacio?.meetingUri;
      if (!meetUrl) {
        throw new Error('No se recibió el enlace de la sala de Google Meet.');
      }

      const urlOperador = currentUserEmail
        ? `${meetUrl}${meetUrl.includes('?') ? '&' : '?'}authuser=${encodeURIComponent(currentUserEmail)}`
        : meetUrl;
      window.open(urlOperador, '_blank', 'noopener,noreferrer');

      const rawNombre = (selectedChat.nombre || '').trim();
      const esSoloNumero = !rawNombre || /^\+?\d[\d\s-]*$/.test(rawNombre);
      const saludoNombre = esSoloNumero ? 'usuario(a)' : rawNombre;

      await handleSendMessage(
        `📹 Estimado(a) ${saludoNombre}, hemos iniciado una sala oficial de Google Meet de IIRESODH para atenderle por voz/video. Puede unirse directamente tocando este enlace:\n${meetUrl}`
      );
    } catch (e) {
      setNotificacion({
        tipo: 'error',
        mensaje: 'No se pudo iniciar la sala de Google Meet: ' + e.message
      });
    } finally {
      setCreandoSalaMeet(false);
    }
  };

  // Filtrado de chats
  const chatsFiltrados = chats.filter((c) => {
    const coincideBusqueda = 
      (c.nombre && c.nombre.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (c.telefono && c.telefono.includes(searchTerm)) ||
      (c.ultimo_mensaje && c.ultimo_mensaje.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!coincideBusqueda) return false;
    if (filtroTab === 'no_leidos') return (c.no_leidos || 0) > 0;
    return true;
  });

  const tieneApiConectada = Boolean(metaConfig.phone_number_id && metaConfig.whatsapp_token && metaConfig.whatsapp_token.trim().length > 10);

  // Formato amigable de fechas
  const formatearFecha = (fechaObj) => {
    if (!fechaObj) return '';
    try {
      const d = fechaObj.toDate ? fechaObj.toDate() : new Date(fechaObj);
      const hoy = new Date();
      if (d.toDateString() === hoy.toDateString()) {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      return d.toLocaleDateString([], { day: '2-digit', month: 'short' });
    } catch {
      return '';
    }
  };

  const totalNoLeidos = chats.reduce((acc, c) => acc + (Number(c.no_leidos) || 0), 0);
  const conteoChatsConNoLeidos = chats.filter((c) => (c.no_leidos || 0) > 0).length;

  return (
    <Box
      sx={{
        height: { xs: 'calc(100dvh - 76px)', sm: 'calc(100dvh - 88px)', md: 'calc(100vh - 104px)' },
        minHeight: { xs: 480, md: 600 },
        display: 'flex',
        flexDirection: 'column',
        bgcolor: '#ffffff',
        borderRadius: { xs: '8px', md: '12px' },
        overflow: 'hidden',
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04), 0 8px 24px rgba(15, 23, 42, 0.03)',
        fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif'
      }}
    >
      {/* Audio oculto para llamadas WebRTC en vivo */}
      <audio ref={remoteAudioRef} autoPlay style={{ display: 'none' }} />

      {/* ============================================================== */}
      {/* 1. BARRA INSTITUCIONAL SUPERIOR (OCULTA EN MÓVIL SI HAY CHAT)  */}
      {/* ============================================================== */}
      <Box
        sx={{
          bgcolor: '#ffffff',
          px: { xs: 1.5, sm: 2, md: 2.5 },
          py: { xs: 1, md: 1.15 },
          display: { xs: selectedChat ? 'none' : 'flex', md: 'flex' },
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid #e2e8f0',
          flexWrap: 'wrap',
          gap: 1
        }}
      >
        {/* Identidad y Estado Multi-Operador */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, md: 1.5 }, minWidth: 0 }}>
          {onVolver && (
            <Tooltip title="Volver">
              <IconButton
                onClick={onVolver}
                size="small"
                sx={{
                  width: 30,
                  height: 30,
                  border: '1px solid #e2e8f0',
                  borderRadius: '7px',
                  color: '#334155',
                  '&:hover': { bgcolor: '#f8fafc', borderColor: '#cbd5e1', color: '#0f172a' }
                }}
              >
                <ArrowLeft size={15} />
              </IconButton>
            </Tooltip>
          )}

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
            <Box
              sx={{
                width: 28,
                height: 28,
                borderRadius: '7px',
                bgcolor: '#0f172a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                position: 'relative'
              }}
            >
              <MessageCircle size={15} color="#10b981" />
              <Box
                sx={{
                  position: 'absolute',
                  bottom: -2,
                  right: -2,
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  bgcolor: tieneApiConectada ? '#10b981' : '#f59e0b',
                  border: '1.5px solid #ffffff'
                }}
              />
            </Box>

            <Box sx={{ minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography
                   sx={{
                    fontSize: { xs: '0.86rem', md: '0.92rem' },
                    fontWeight: 700,
                    color: '#0f172a',
                    letterSpacing: '-0.02em',
                    lineHeight: 1.2,
                    whiteSpace: 'nowrap'
                  }}
                >
                  WhatsApp Business
                </Typography>
                <Box
                  sx={{
                    display: { xs: 'none', sm: 'inline-flex' },
                    alignItems: 'center',
                    gap: 0.6,
                    px: 0.9,
                    py: 0.2,
                    borderRadius: '5px',
                    bgcolor: '#f8fafc',
                    border: '1px solid #e2e8f0'
                  }}
                >
                  <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#10b981' }} />
                  <Typography
                    sx={{
                      fontSize: '0.66rem',
                      fontWeight: 600,
                      color: '#475569',
                      letterSpacing: '0.02em'
                    }}
                  >
                    Multi-operador · {userName}
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Box>
        </Box>

        {/* Controles Operativos: Enrutamiento de Voz y Configuración Meta API */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.85, flexWrap: 'wrap' }}>
          {/* Interruptor de Recepción de Llamadas Web vs Teléfono Físico */}
          <Tooltip
            title={
              recepcionVozWebActiva
                ? 'Llamadas activas en navegador. Clic para desviar al teléfono físico (+506 4081-6188)'
                : 'Llamadas desviadas al teléfono físico (+506 4081-6188). Clic para recibir en navegador'
            }
          >
            <Button
              size="small"
              disabled={cambiandoModoVoz}
              onClick={handleToggleRecepcionVozWeb}
              startIcon={
                recepcionVozWebActiva ? (
                  <Volume2 size={14} color="#047857" />
                ) : (
                  <VolumeX size={14} color="#b45309" />
                )
              }
              sx={{
                textTransform: 'none',
                fontSize: '0.73rem',
                fontWeight: 600,
                height: 30,
                borderRadius: '7px',
                px: { xs: 1, sm: 1.35 },
                bgcolor: recepcionVozWebActiva ? '#ecfdf5' : '#fffbeb',
                border: '1px solid',
                borderColor: recepcionVozWebActiva ? '#a7f3d0' : '#fde68a',
                color: recepcionVozWebActiva ? '#065f46' : '#92400e',
                boxShadow: 'none',
                '&:hover': {
                  bgcolor: recepcionVozWebActiva ? '#d1fae5' : '#fef3c7',
                  borderColor: recepcionVozWebActiva ? '#6ee7b7' : '#fcd34d'
                }
              }}
            >
              {cambiandoModoVoz ? (
                'Actualizando...'
              ) : (
                <>
                  <Box component="span" sx={{ display: { xs: 'none', lg: 'inline' } }}>
                    {recepcionVozWebActiva
                      ? 'Llamadas Web: Activas'
                      : 'Llamadas: Teléfono Físico'}
                  </Box>
                  <Box component="span" sx={{ display: { xs: 'inline', lg: 'none' } }}>
                    {recepcionVozWebActiva ? 'Voz: Web' : 'Voz: Físico'}
                  </Box>
                </>
              )}
            </Button>
          </Tooltip>

          {/* Estado API + Acceso a Configuración Unificado */}
          <Tooltip
            title={
              esAdmin
                ? 'Configurar credenciales y webhook de Meta Cloud API'
                : tieneApiConectada
                ? 'Meta Cloud API conectada en línea'
                : 'Pendiente de llaves de Meta API'
            }
          >
            <Button
              size="small"
              onClick={esAdmin ? () => setOpenConfigModal(true) : undefined}
              startIcon={
                tieneApiConectada ? (
                  <ShieldCheck size={14} color="#10b981" />
                ) : (
                  <Clock size={14} color="#f59e0b" />
                )
              }
              endIcon={esAdmin ? <Settings size={13} color="#64748b" /> : null}
              sx={{
                textTransform: 'none',
                fontSize: '0.73rem',
                fontWeight: 600,
                height: 30,
                borderRadius: '7px',
                px: { xs: 1, sm: 1.25 },
                bgcolor: '#f8fafc',
                border: '1px solid #e2e8f0',
                color: '#334155',
                cursor: esAdmin ? 'pointer' : 'default',
                '&:hover': esAdmin
                  ? { bgcolor: '#f1f5f9', borderColor: '#cbd5e1', color: '#0f172a' }
                  : {}
              }}
            >
              <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                {tieneApiConectada ? 'Meta API' : 'En Espera'}
              </Box>
            </Button>
          </Tooltip>
        </Box>
      </Box>

      {/* Alerta Temporal si existe notificación */}
      {notificacion && (
        <Alert
          severity={notificacion.tipo}
          onClose={() => setNotificacion(null)}
          sx={{
            borderRadius: 0,
            py: 0.5,
            px: 2,
            fontSize: '0.78rem',
            alignItems: 'center',
            borderBottom: '1px solid #e2e8f0'
          }}
          action={
            esAdmin && notificacion.tipo === 'warning' ? (
              <Button
                color="inherit"
                size="small"
                onClick={() => setOpenConfigModal(true)}
                sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.74rem' }}
              >
                Configurar API
              </Button>
            ) : undefined
          }
        >
          {notificacion.mensaje}
        </Alert>
      )}

      {/* BANNER GLOBAL DE LLAMADA DE VOZ WHATSAPP ENTRANTE / EN CURSO (WebRTC) */}
      {llamadaEntrante && (
        <Box
          sx={{
            bgcolor: '#0f172a',
            color: '#f8fafc',
            px: { xs: 2, md: 3 },
            py: 1.25,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 1.5,
            borderBottom: '1px solid #1e293b',
            borderLeft: '4px solid #10b981',
            borderRadius: 0
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar sx={{ bgcolor: 'rgba(16, 185, 129, 0.15)', color: '#10b981', width: 34, height: 34 }}>
              {enLlamadaWebRTC ? <PhoneCall size={17} /> : <PhoneIncoming size={17} />}
            </Avatar>
            <Box>
              <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: '#ffffff', letterSpacing: '-0.01em' }}>
                {enLlamadaWebRTC
                  ? `Llamada en curso · +${llamadaEntrante.from || 'Contacto'}`
                  : `Llamada entrante de WhatsApp · +${llamadaEntrante.from || 'Contacto'}`}
              </Typography>
              <Typography sx={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                {enLlamadaWebRTC
                  ? `Atendida en navegador por ${llamadaEntrante.atendida_por || userName}`
                  : 'Contesta con tu micrófono o desvía a la línea física (+506 4081-6188)'}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {!enLlamadaWebRTC ? (
              <>
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<PhoneCall size={14} />}
                  onClick={() => handleContestarLlamadaWebRTC(llamadaEntrante)}
                  sx={{
                    bgcolor: '#10b981',
                    color: '#ffffff',
                    fontWeight: 600,
                    fontSize: '0.75rem',
                    height: 30,
                    borderRadius: '6px',
                    textTransform: 'none',
                    boxShadow: 'none',
                    '&:hover': { bgcolor: '#059669', boxShadow: 'none' }
                  }}
                >
                  Contestar
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<PhoneOff size={14} />}
                  onClick={() => handleRechazarODesviarLlamada(llamadaEntrante)}
                  sx={{
                    borderColor: '#475569',
                    color: '#cbd5e1',
                    fontWeight: 600,
                    fontSize: '0.75rem',
                    height: 30,
                    borderRadius: '6px',
                    textTransform: 'none',
                    '&:hover': { bgcolor: 'rgba(239,68,68,0.15)', borderColor: '#ef4444', color: '#fca5a5' }
                  }}
                >
                  Desviar / Rechazar
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={micSilenciado ? <VolumeX size={14} /> : <Volume2 size={14} />}
                  onClick={handleToggleMuteMic}
                  sx={{
                    borderColor: '#475569',
                    color: '#f8fafc',
                    textTransform: 'none',
                    fontSize: '0.75rem',
                    height: 30,
                    borderRadius: '6px',
                    fontWeight: 600
                  }}
                >
                  {micSilenciado ? 'Reactivar Mic' : 'Silenciar'}
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<PhoneOff size={14} />}
                  onClick={handleColgarLlamadaWebRTC}
                  sx={{
                    bgcolor: '#dc2626',
                    color: '#ffffff',
                    fontWeight: 600,
                    fontSize: '0.75rem',
                    height: 30,
                    borderRadius: '6px',
                    textTransform: 'none',
                    boxShadow: 'none',
                    '&:hover': { bgcolor: '#b91c1c', boxShadow: 'none' }
                  }}
                >
                  Finalizar
                </Button>
              </>
            )}
          </Box>
        </Box>
      )}

      {/* ============================================================== */}
      {/* 2. ÁREA PRINCIPAL: BANDEJA IZQUIERDA + CONVERSACIÓN DERECHA    */}
      {/* ============================================================== */}
      <Box sx={{ display: 'flex', flexGrow: 1, overflow: 'hidden', position: 'relative' }}>
        {/* ============================================================== */}
        {/* SIDEBAR DE CHATS (100% EN MÓVIL CUANDO NO HAY CHAT ACTIVO)     */}
        {/* ============================================================== */}
        <Box
          sx={{
            width: { xs: '100%', md: 340, lg: 370 },
            flexShrink: 0,
            borderRight: { xs: 'none', md: '1px solid #e2e8f0' },
            bgcolor: '#ffffff',
            display: { xs: selectedChat ? 'none' : 'flex', md: 'flex' },
            flexDirection: 'column',
            height: '100%'
          }}
        >
          {/* Cabecera del Sidebar + Buscador + Control Segmentado */}
          <Box sx={{ px: 2, pt: 1.75, pb: 1.5, borderBottom: '1px solid #f1f5f9', bgcolor: '#ffffff' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.25 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                <Typography
                  sx={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.07em',
                    color: '#64748b'
                  }}
                >
                  Bandeja de Entrada
                </Typography>
                <Box
                  sx={{
                    px: 0.75,
                    py: 0.1,
                    borderRadius: '5px',
                    bgcolor: '#f1f5f9',
                    color: '#334155',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    fontVariantNumeric: 'tabular-nums'
                  }}
                >
                  {chatsFiltrados.length}
                </Box>
              </Box>

              <Button
                size="small"
                variant="contained"
                startIcon={<Plus size={14} />}
                onClick={() => setOpenNuevoChatModal(true)}
                sx={{
                  bgcolor: '#0f172a',
                  color: '#ffffff',
                  fontSize: '0.74rem',
                  textTransform: 'none',
                  fontWeight: 600,
                  height: 28,
                  px: 1.25,
                  borderRadius: '6px',
                  boxShadow: 'none',
                  '&:hover': { bgcolor: '#1e293b', boxShadow: 'none' }
                }}
              >
                Nuevo Chat
              </Button>
            </Box>

            {/* Buscador Minimalista */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                bgcolor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                px: 1.25,
                height: 35,
                transition: 'all 0.15s ease',
                '&:focus-within': {
                  bgcolor: '#ffffff',
                  borderColor: '#0f172a',
                  boxShadow: '0 0 0 2px rgba(15, 23, 42, 0.06)'
                }
              }}
            >
              <Search size={14} color="#64748b" style={{ flexShrink: 0 }} />
              <TextField
                placeholder="Buscar contacto, número o mensaje..."
                variant="standard"
                fullWidth
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  disableUnderline: true,
                  sx: {
                    ml: 1,
                    fontSize: '0.78rem',
                    color: '#0f172a',
                    '& input::placeholder': { color: '#94a3b8', opacity: 1 }
                  }
                }}
              />
            </Box>

            {/* Selector Segmentado: Todos vs No leídos */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 0.5,
                mt: 1.15,
                p: 0.4,
                bgcolor: '#f1f5f9',
                borderRadius: '7px'
              }}
            >
              <Box
                onClick={() => setFiltroTab('todos')}
                sx={{
                  textAlign: 'center',
                  py: 0.5,
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontSize: '0.73rem',
                  fontWeight: filtroTab === 'todos' ? 600 : 500,
                  bgcolor: filtroTab === 'todos' ? '#ffffff' : 'transparent',
                  color: filtroTab === 'todos' ? '#0f172a' : '#64748b',
                  boxShadow: filtroTab === 'todos' ? '0 1px 2px rgba(15,23,42,0.06)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                Todos ({chats.length})
              </Box>
              <Box
                onClick={() => setFiltroTab('no_leidos')}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 0.6,
                  py: 0.5,
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontSize: '0.73rem',
                  fontWeight: filtroTab === 'no_leidos' ? 600 : 500,
                  bgcolor: filtroTab === 'no_leidos' ? '#ffffff' : 'transparent',
                  color: filtroTab === 'no_leidos' ? '#0f172a' : '#64748b',
                  boxShadow: filtroTab === 'no_leidos' ? '0 1px 2px rgba(15,23,42,0.06)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>No leídos</span>
                {conteoChatsConNoLeidos > 0 && (
                  <Box
                    component="span"
                    sx={{
                      px: 0.6,
                      py: 0.05,
                      borderRadius: '10px',
                      bgcolor: '#10b981',
                      color: '#ffffff',
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      fontVariantNumeric: 'tabular-nums',
                      lineHeight: 1.3
                    }}
                  >
                    {totalNoLeidos}
                  </Box>
                )}
              </Box>
            </Box>
          </Box>

          {/* Lista de Chats con Firestore en tiempo real */}
          <List sx={{ flexGrow: 1, overflowY: 'auto', px: 1, py: 0.75 }}>
            {loadingChats ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 7, gap: 1.25 }}>
                <CircularProgress size={20} sx={{ color: '#0f172a' }} />
                <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>
                  Sincronizando conversaciones...
                </Typography>
              </Box>
            ) : chatsFiltrados.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 7, px: 2.5 }}>
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: '10px',
                    bgcolor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mx: 'auto',
                    mb: 1.5
                  }}
                >
                  <MessageCircle size={18} color="#64748b" />
                </Box>
                <Typography sx={{ fontSize: '0.82rem', color: '#334155', fontWeight: 600 }}>
                  {searchTerm ? 'Sin coincidencias para tu búsqueda' : 'Bandeja sin conversaciones'}
                </Typography>
                <Typography sx={{ fontSize: '0.74rem', color: '#94a3b8', mt: 0.5, mb: 2, lineHeight: 1.45 }}>
                  Inicia una conversación desde la línea institucional de IIRESODH.
                </Typography>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => setOpenNuevoChatModal(true)}
                  sx={{
                    fontSize: '0.74rem',
                    textTransform: 'none',
                    fontWeight: 600,
                    borderRadius: '6px',
                    borderColor: '#cbd5e1',
                    color: '#0f172a'
                  }}
                >
                  + Iniciar Conversación
                </Button>
              </Box>
            ) : (
              chatsFiltrados.map((contact) => {
                const isSelected = selectedChat?.id === contact.id;
                const hasUnread = (contact.no_leidos || 0) > 0;
                const hasLeftBar = isSelected || hasUnread;

                return (
                  <ListItem
                    key={contact.id}
                    button
                    onClick={() => setSelectedChat(contact)}
                    secondaryAction={
                      esAdmin ? (
                        <Tooltip title="Eliminar conversación">
                          <IconButton
                            edge="end"
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              setChatAEliminar(contact);
                              setOpenDeleteChatModal(true);
                            }}
                            sx={{
                              color: '#94a3b8',
                              mr: -0.5,
                              opacity: { xs: 0.7, md: 0 },
                              transition: 'all 0.15s ease',
                              '&:hover': { color: '#dc2626', bgcolor: '#fef2f2', opacity: 1 }
                            }}
                          >
                            <Trash2 size={14} />
                          </IconButton>
                        </Tooltip>
                      ) : null
                    }
                    sx={{
                      mb: 0.4,
                      px: 1.25,
                      py: 1.1,
                      // Regla arquitectónica del sitio: lado con barra de color lleva radio cero
                      borderRadius: hasLeftBar ? '0 8px 8px 0' : '8px',
                      borderLeft: isSelected
                        ? '3px solid #0f172a'
                        : hasUnread
                        ? '3px solid #10b981'
                        : '3px solid transparent',
                      bgcolor: isSelected ? '#f1f5f9' : hasUnread ? 'rgba(16, 185, 129, 0.04)' : 'transparent',
                      transition: 'all 0.15s ease',
                      '&:hover': {
                        bgcolor: isSelected ? '#f1f5f9' : '#f8fafc',
                        '& .MuiIconButton-root': { opacity: 1 }
                      }
                    }}
                  >
                    <ListItemAvatar sx={{ minWidth: 48 }}>
                      <Badge
                        badgeContent={contact.no_leidos || 0}
                        invisible={!hasUnread}
                        sx={{
                          '& .MuiBadge-badge': {
                            bgcolor: '#10b981',
                            color: '#ffffff',
                            fontWeight: 700,
                            fontSize: '0.64rem',
                            minWidth: 18,
                            height: 18,
                            fontVariantNumeric: 'tabular-nums',
                            border: '1.5px solid #ffffff'
                          }
                        }}
                      >
                        <Avatar
                          sx={{
                            width: 38,
                            height: 38,
                            borderRadius: '9px',
                            bgcolor: isSelected ? '#0f172a' : hasUnread ? '#ecfdf5' : '#f1f5f9',
                            color: isSelected ? '#ffffff' : hasUnread ? '#047857' : '#334155',
                            fontWeight: 700,
                            fontSize: '0.84rem',
                            border: '1px solid',
                            borderColor: isSelected ? '#0f172a' : hasUnread ? '#a7f3d0' : '#e2e8f0'
                          }}
                        >
                          {(contact.nombre || contact.telefono || '?').charAt(0).toUpperCase()}
                        </Avatar>
                      </Badge>
                    </ListItemAvatar>

                    <ListItemText
                      sx={{ my: 0, pr: esAdmin ? 2 : 0 }}
                      primary={
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 1 }}>
                          <Typography
                            noWrap
                            sx={{
                              fontSize: '0.82rem',
                              fontWeight: hasUnread || isSelected ? 700 : 600,
                              color: '#0f172a',
                              letterSpacing: '-0.01em'
                            }}
                          >
                            {contact.nombre || `+${contact.telefono}`}
                          </Typography>
                          <Typography
                            sx={{
                              fontSize: '0.67rem',
                              fontWeight: hasUnread ? 700 : 500,
                              color: hasUnread ? '#059669' : '#94a3b8',
                              fontVariantNumeric: 'tabular-nums',
                              flexShrink: 0
                            }}
                          >
                            {formatearFecha(contact.ultima_fecha)}
                          </Typography>
                        </Box>
                      }
                      secondary={
                        <Typography
                          noWrap
                          sx={{
                            mt: 0.25,
                            fontSize: '0.75rem',
                            color: hasUnread ? '#1e293b' : '#64748b',
                            fontWeight: hasUnread ? 600 : 400,
                            lineHeight: 1.35
                          }}
                        >
                          {contact.ultimo_agente && contact.ultimo_mensaje ? (
                            <Box component="span" sx={{ color: '#0f172a', fontWeight: 600 }}>
                              {contact.ultimo_agente === userName ? 'Tú: ' : `${contact.ultimo_agente}: `}
                            </Box>
                          ) : null}
                          {contact.ultimo_mensaje || 'Conversación iniciada'}
                        </Typography>
                      }
                    />
                  </ListItem>
                );
              })
            )}
          </List>
        </Box>

        {/* ============================================================== */}
        {/* ÁREA DE CONVERSACIÓN PRINCIPAL (ADAPTATIVA DESKTOP Y CELULAR)  */}
        {/* ============================================================== */}
        <Box
          sx={{
            flexGrow: 1,
            minWidth: 0,
            display: { xs: selectedChat ? 'flex' : 'none', md: 'flex' },
            flexDirection: 'column',
            bgcolor: '#f8fafc',
            backgroundImage: 'radial-gradient(#cbd5e1 0.75px, transparent 0.75px)',
            backgroundSize: '18px 18px',
            position: 'relative',
            height: '100%'
          }}
        >
          {selectedChat ? (
            <>
              {/* Header del Chat Seleccionado (1 sola fila limpia en móvil y desktop) */}
              <Box
                sx={{
                  bgcolor: 'rgba(255, 255, 255, 0.94)',
                  backdropFilter: 'blur(8px)',
                  px: { xs: 1.25, sm: 2, md: 2.5 },
                  py: { xs: 1, md: 1.25 },
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderBottom: '1px solid #e2e8f0',
                  gap: 1,
                  zIndex: 2
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, md: 1.25 }, minWidth: 0 }}>
                  <IconButton
                    onClick={() => setSelectedChat(null)}
                    size="small"
                    sx={{
                      display: { md: 'none' },
                      width: 32,
                      height: 32,
                      border: '1px solid #e2e8f0',
                      borderRadius: '7px',
                      color: '#0f172a',
                      flexShrink: 0
                    }}
                  >
                    <ArrowLeft size={16} />
                  </IconButton>

                  <Avatar
                    sx={{
                      width: { xs: 34, md: 36 },
                      height: { xs: 34, md: 36 },
                      borderRadius: '9px',
                      bgcolor: '#0f172a',
                      color: '#ffffff',
                      fontWeight: 700,
                      fontSize: '0.84rem',
                      flexShrink: 0
                    }}
                  >
                    {(selectedChat.nombre || selectedChat.telefono || '?').charAt(0).toUpperCase()}
                  </Avatar>

                  <Box sx={{ minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography
                        noWrap
                        sx={{
                          fontSize: { xs: '0.84rem', md: '0.9rem' },
                          fontWeight: 700,
                          color: '#0f172a',
                          letterSpacing: '-0.01em'
                        }}
                      >
                        {selectedChat.nombre || `+${selectedChat.telefono}`}
                      </Typography>
                      <Tooltip title="Renombrar contacto">
                        <IconButton
                          size="small"
                          onClick={() => {
                            setEditNombreContacto(selectedChat.nombre || '');
                            setOpenEditContactoModal(true);
                          }}
                          sx={{ p: 0.3, color: '#94a3b8', '&:hover': { color: '#0f172a' } }}
                        >
                          <Edit3 size={13} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                    <Typography
                      noWrap
                      sx={{
                        fontSize: '0.7rem',
                        color: '#64748b',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5,
                        fontVariantNumeric: 'tabular-nums'
                      }}
                    >
                      <Phone size={10} /> +{selectedChat.telefono}
                      <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                        · Línea Oficial IIRESODH
                      </Box>
                    </Typography>
                  </Box>
                </Box>

                {/* Acciones de Conversación: Compactas en celular, etiquetadas en escritorio */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 0.75 }, flexShrink: 0 }}>
                  <Tooltip title="Solicitar permiso de llamada de voz de WhatsApp">
                    <Button
                      size="small"
                      disabled={isSending}
                      onClick={handleSolicitarPermisoLlamadaWhatsApp}
                      sx={{
                        minWidth: { xs: 32, sm: 'auto' },
                        height: 30,
                        px: { xs: 0.75, sm: 1.15 },
                        borderRadius: '7px',
                        fontSize: '0.73rem',
                        textTransform: 'none',
                        border: '1px solid #e2e8f0',
                        bgcolor: '#ffffff',
                        color: '#0f172a',
                        fontWeight: 600,
                        gap: 0.6,
                        '&:hover': { borderColor: '#10b981', bgcolor: '#ecfdf5', color: '#047857' }
                      }}
                    >
                      {isSending ? <CircularProgress size={13} /> : <PhoneCall size={14} color="#059669" />}
                      <Box component="span" sx={{ display: { xs: 'none', lg: 'inline' } }}>
                        Llamar
                      </Box>
                    </Button>
                  </Tooltip>

                  <Tooltip title="Crear sala Google Meet en 1 clic y enviar invitación al chat">
                    <Button
                      size="small"
                      disabled={creandoSalaMeet}
                      onClick={handleEnviarSalaVozMeet}
                      sx={{
                        minWidth: { xs: 32, sm: 'auto' },
                        height: 30,
                        px: { xs: 0.75, sm: 1.15 },
                        borderRadius: '7px',
                        fontSize: '0.73rem',
                        textTransform: 'none',
                        border: '1px solid #e2e8f0',
                        bgcolor: '#ffffff',
                        color: '#0f172a',
                        fontWeight: 600,
                        gap: 0.6,
                        '&:hover': { borderColor: '#3b82f6', bgcolor: '#eff6ff', color: '#1d4ed8' }
                      }}
                    >
                      {creandoSalaMeet ? <CircularProgress size={13} /> : <Video size={14} color="#2563eb" />}
                      <Box component="span" sx={{ display: { xs: 'none', lg: 'inline' } }}>
                        Google Meet
                      </Box>
                    </Button>
                  </Tooltip>

                  <Tooltip title="Plantillas de respuestas rápidas">
                    <Button
                      size="small"
                      onClick={(e) => setAnchorElRespuestas(e.currentTarget)}
                      sx={{
                        minWidth: { xs: 32, sm: 'auto' },
                        height: 30,
                        px: { xs: 0.75, sm: 1.15 },
                        borderRadius: '7px',
                        fontSize: '0.73rem',
                        textTransform: 'none',
                        border: '1px solid #e2e8f0',
                        bgcolor: '#ffffff',
                        color: '#334155',
                        fontWeight: 600,
                        gap: 0.6,
                        '&:hover': { borderColor: '#cbd5e1', bgcolor: '#f8fafc', color: '#0f172a' }
                      }}
                    >
                      <Sparkles size={14} color="#0f766e" />
                      <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                        Respuestas
                      </Box>
                    </Button>
                  </Tooltip>

                  {esAdmin && (
                    <Tooltip title="Eliminar conversación">
                      <IconButton
                        size="small"
                        onClick={() => {
                          setChatAEliminar(selectedChat);
                          setOpenDeleteChatModal(true);
                        }}
                        sx={{
                          width: 30,
                          height: 30,
                          borderRadius: '7px',
                          border: '1px solid #e2e8f0',
                          bgcolor: '#ffffff',
                          color: '#94a3b8',
                          '&:hover': { color: '#dc2626', bgcolor: '#fef2f2', borderColor: '#fecaca' }
                        }}
                      >
                        <Trash2 size={14} />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              </Box>

              {/* Lienzo de Mensajes en Tiempo Real */}
              <Box
                sx={{
                  flexGrow: 1,
                  overflowY: 'auto',
                  px: { xs: 1.5, sm: 2.5, md: 3.5 },
                  py: { xs: 2, md: 2.5 },
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1.15
                }}
              >
                {loadingMensajes ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
                    <CircularProgress size={22} sx={{ color: '#0f172a' }} />
                  </Box>
                ) : mensajesChat.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 6 }}>
                    <Box
                      sx={{
                        display: 'inline-block',
                        px: 2,
                        py: 0.75,
                        borderRadius: '8px',
                        bgcolor: '#ffffff',
                        border: '1px solid #e2e8f0',
                        fontSize: '0.75rem',
                        color: '#64748b',
                        fontWeight: 500
                      }}
                    >
                      Sin mensajes previos en este expediente de conversación
                    </Box>
                  </Box>
                ) : (
                  mensajesChat.map((msg) => {
                    const esMiMensaje = msg.es_mio === true;
                    const mediaSrc =
                      msg.media_url ||
                      audiosResueltos[msg.id] ||
                      (msg.media_id
                        ? `${WEBHOOK_CALLBACK_URL}?media_id=${encodeURIComponent(msg.media_id)}`
                        : null);
                    const esSticker =
                      msg.tipo === 'sticker' ||
                      msg.raw_type === 'sticker' ||
                      msg.texto === '[sticker]' ||
                      (typeof msg.texto === 'string' && msg.texto.startsWith('🏷️ Sticker'));
                    const esImagen = msg.tipo === 'image' || msg.raw_type === 'image';
                    const esAudio = msg.tipo === 'audio' || msg.raw_type === 'audio';
                    const esStickerVisualSinFondo = esSticker && Boolean(mediaSrc);

                    return (
                      <Box
                        key={msg.id}
                        sx={{
                          alignSelf: esMiMensaje ? 'flex-end' : 'flex-start',
                          bgcolor: esStickerVisualSinFondo
                            ? 'transparent'
                            : esMiMensaje
                            ? '#ecfdf5'
                            : '#ffffff',
                          px: esSticker ? 1 : { xs: 1.4, md: 1.65 },
                          py: esSticker ? 0.75 : 1.15,
                          // Regla de coherencia: burbuja entrante lleva barra lateral sutil y radio cero a la izquierda
                          borderRadius: esStickerVisualSinFondo
                            ? '12px'
                            : esMiMensaje
                            ? '12px 12px 2px 12px'
                            : '0 12px 12px 0',
                          border: esStickerVisualSinFondo
                            ? 'none'
                            : esMiMensaje
                            ? '1px solid #bbf7d0'
                            : '1px solid #e2e8f0',
                          borderLeft: esStickerVisualSinFondo
                            ? 'none'
                            : esMiMensaje
                            ? '1px solid #bbf7d0'
                            : '3px solid #0f766e',
                          maxWidth: { xs: '88%', sm: '78%', md: '66%' },
                          boxShadow: esStickerVisualSinFondo
                            ? 'none'
                            : '0 1px 2px rgba(15, 23, 42, 0.04)',
                          position: 'relative',
                          mb: msg.reaccion_cliente ? 1.25 : 0
                        }}
                      >
                        {/* Atribución Multi-Agente Minimalista */}
                        {esMiMensaje && !esStickerVisualSinFondo && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.35 }}>
                            <Typography
                              sx={{
                                fontSize: '0.66rem',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                color: '#047857'
                              }}
                            >
                              {msg.agente_nombre === userName ? 'Tú' : msg.agente_nombre || 'Operador'}
                            </Typography>
                          </Box>
                        )}

                        {/* Renderizado Visual de Stickers de WhatsApp */}
                        {esSticker ? (
                          mediaSrc ? (
                            <Box sx={{ textAlign: 'center', py: 0.25 }}>
                              <img
                                src={mediaSrc}
                                alt="Sticker de WhatsApp"
                                style={{
                                  width: 136,
                                  height: 136,
                                  objectFit: 'contain',
                                  display: 'block',
                                  margin: '0 auto',
                                  filter: 'drop-shadow(0 4px 10px rgba(15,23,42,0.14))'
                                }}
                              />
                            </Box>
                          ) : (
                            <Box
                              sx={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                px: 2,
                                py: 1,
                                borderRadius: '8px',
                                bgcolor: '#f8fafc',
                                border: '1px dashed #cbd5e1'
                              }}
                            >
                              <Typography sx={{ fontSize: '36px', lineHeight: 1.1 }}>🙌✨</Typography>
                              <Typography
                                sx={{ fontWeight: 600, color: '#475569', mt: 0.4, fontSize: '0.68rem' }}
                              >
                                Sticker de WhatsApp
                              </Typography>
                            </Box>
                          )
                        ) : esImagen && mediaSrc ? (
                          /* Renderizado Visual de Imágenes Entrantes o Salientes */
                          <Box>
                            <Box
                              component="a"
                              href={mediaSrc}
                              target="_blank"
                              rel="noopener noreferrer"
                              sx={{ display: 'block', mb: msg.texto ? 0.75 : 0 }}
                            >
                              <img
                                src={mediaSrc}
                                alt="Imagen de WhatsApp"
                                style={{
                                  maxWidth: '260px',
                                  maxHeight: '260px',
                                  width: '100%',
                                  borderRadius: 8,
                                  objectFit: 'cover',
                                  display: 'block'
                                }}
                              />
                            </Box>
                            {msg.texto && msg.texto !== '📷 [Foto adjunta]' && (
                              <Typography
                                sx={{
                                  whiteSpace: 'pre-wrap',
                                  wordBreak: 'break-word',
                                  fontSize: '0.83rem',
                                  color: '#0f172a',
                                  lineHeight: 1.5
                                }}
                              >
                                {msg.texto}
                              </Typography>
                            )}
                          </Box>
                        ) : (
                          <Typography
                            sx={{
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                              fontSize: '0.83rem',
                              color: '#0f172a',
                              lineHeight: 1.5
                            }}
                          >
                            {msg.texto}
                          </Typography>
                        )}

                        {/* Reproductor de Notas de Voz */}
                        {esAudio && (mediaSrc || msg.media_id) && (
                          <Box sx={{ mt: 0.85 }}>
                            {mediaSrc ? (
                              <audio controls src={mediaSrc} style={{ height: 34, maxWidth: '240px' }} />
                            ) : msg.media_id ? (
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={
                                  cargandoAudioId === msg.id ? <CircularProgress size={12} /> : <Volume2 size={14} />
                                }
                                disabled={cargandoAudioId === msg.id}
                                onClick={() => handleReproducirAudioMeta(msg)}
                                sx={{
                                  fontSize: '0.72rem',
                                  textTransform: 'none',
                                  borderColor: '#cbd5e1',
                                  color: '#0f172a',
                                  borderRadius: '6px',
                                  mt: 0.4
                                }}
                              >
                                {cargandoAudioId === msg.id ? 'Descargando audio...' : 'Reproducir audio'}
                              </Button>
                            ) : null}
                          </Box>
                        )}

                        {/* Insignia Flotante de Reacción con Emoji del Cliente */}
                        {msg.reaccion_cliente && (
                          <Box
                            sx={{
                              position: 'absolute',
                              bottom: -11,
                              right: 10,
                              bgcolor: '#ffffff',
                              border: '1px solid #e2e8f0',
                              borderRadius: '12px',
                              px: 0.7,
                              py: 0.1,
                              fontSize: '13px',
                              boxShadow: '0 2px 5px rgba(15,23,42,0.08)',
                              lineHeight: 1.2
                            }}
                          >
                            {msg.reaccion_cliente}
                          </Box>
                        )}

                        {/* Metadatos y Checks de Entrega */}
                        <Box
                          sx={{
                            display: 'inline-flex',
                            justifyContent: 'flex-end',
                            alignItems: 'center',
                            gap: 0.45,
                            mt: 0.35,
                            float: esStickerVisualSinFondo ? 'none' : 'right',
                            ml: esStickerVisualSinFondo ? 0 : 1.25,
                            px: esStickerVisualSinFondo ? 0.8 : 0,
                            py: esStickerVisualSinFondo ? 0.2 : 0,
                            borderRadius: esStickerVisualSinFondo ? '10px' : 0,
                            bgcolor: esStickerVisualSinFondo ? 'rgba(255,255,255,0.9)' : 'transparent',
                            boxShadow: esStickerVisualSinFondo ? '0 1px 3px rgba(15,23,42,0.08)' : 'none'
                          }}
                        >
                          <Typography
                            sx={{
                              fontSize: '0.65rem',
                              color: '#64748b',
                              fontVariantNumeric: 'tabular-nums'
                            }}
                          >
                            {formatearFecha(msg.fecha)}
                          </Typography>

                          {esMiMensaje ? (
                            <Box sx={{ display: 'inline-flex', alignItems: 'center' }}>
                              {msg.estado === 'read' || msg.estado === 'leido' ? (
                                <Tooltip title="Leído por el contacto">
                                  <CheckCheck size={14} color="#0284c7" strokeWidth={2.4} />
                                </Tooltip>
                              ) : msg.estado === 'delivered' || msg.estado === 'entregado' ? (
                                <Tooltip title="Entregado al dispositivo">
                                  <CheckCheck size={14} color="#64748b" />
                                </Tooltip>
                              ) : msg.estado === 'sent' || msg.estado === 'enviado' ? (
                                <Tooltip title="Enviado a WhatsApp">
                                  <Check size={13} color="#64748b" />
                                </Tooltip>
                              ) : msg.estado === 'failed' || msg.estado === 'error' ? (
                                <Tooltip
                                  title={
                                    msg.error_detalle
                                      ? `No entregado (${msg.error_codigo || 'Meta'}): ${msg.error_detalle}`
                                      : 'No entregado (Ventana de 24h cerrada)'
                                  }
                                >
                                  <AlertCircle size={13} color="#dc2626" />
                                </Tooltip>
                              ) : (
                                <Tooltip title="En espera de sincronización">
                                  <Clock size={12} color="#d97706" />
                                </Tooltip>
                              )}
                            </Box>
                          ) : (
                            (msg.estado === 'read' || msg.estado === 'leido') && (
                              <Tooltip
                                title={`Visto en Intranet${msg.leido_por ? ` por ${msg.leido_por}` : ''}`}
                              >
                                <Box sx={{ display: 'inline-flex', alignItems: 'center' }}>
                                  <CheckCheck size={12} color="#0284c7" />
                                </Box>
                              </Tooltip>
                            )
                          )}
                        </Box>
                      </Box>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </Box>

              {/* ============================================================== */}
              {/* COMPOSER INFERIOR: EMOJIS/STICKERS + TEXTO + VOZ + ENVIAR      */}
              {/* ============================================================== */}
              <Box
                sx={{
                  bgcolor: '#ffffff',
                  px: { xs: 1.25, sm: 2, md: 2.5 },
                  py: { xs: 1, md: 1.25 },
                  borderTop: '1px solid #e2e8f0'
                }}
              >
                {grabandoVoz ? (
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      bgcolor: '#fef2f2',
                      border: '1px solid #fecaca',
                      borderLeft: '3px solid #dc2626',
                      borderRadius: '0 8px 8px 0',
                      px: { xs: 1.25, sm: 2 },
                      py: 0.75,
                      gap: 1
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Mic size={16} color="#dc2626" />
                      <Typography
                        sx={{
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          color: '#b91c1c',
                          fontVariantNumeric: 'tabular-nums'
                        }}
                      >
                        Grabando... {Math.floor(segundosGrabacion / 60)}:
                        {String(segundosGrabacion % 60).padStart(2, '0')}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <Button
                        size="small"
                        color="error"
                        onClick={handleCancelarGrabacionVoz}
                        sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.75rem' }}
                      >
                        Cancelar
                      </Button>
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<Send size={13} />}
                        onClick={handleDetenerYEnviarNotaVoz}
                        sx={{
                          bgcolor: '#0f172a',
                          color: '#ffffff',
                          textTransform: 'none',
                          fontWeight: 600,
                          fontSize: '0.75rem',
                          borderRadius: '6px',
                          boxShadow: 'none',
                          '&:hover': { bgcolor: '#1e293b', boxShadow: 'none' }
                        }}
                      >
                        Enviar Audio
                      </Button>
                    </Box>
                  </Box>
                ) : (
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'flex-end',
                      gap: { xs: 0.65, sm: 0.85 },
                      bgcolor: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '10px',
                      px: { xs: 0.85, sm: 1.15 },
                      py: 0.55,
                      transition: 'all 0.15s ease',
                      '&:focus-within': {
                        bgcolor: '#ffffff',
                        borderColor: '#0f172a',
                        boxShadow: '0 0 0 2px rgba(15, 23, 42, 0.05)'
                      }
                    }}
                  >
                    {/* Botón Selector de Emojis y Stickers Nativos */}
                    <Tooltip title="Emojis y Stickers de WhatsApp">
                      <span>
                        <IconButton
                          size="small"
                          onClick={(e) => setAnchorElEmoji(e.currentTarget)}
                          disabled={isSending || enviandoNotaVoz || enviandoSticker}
                          sx={{
                            width: 32,
                            height: 32,
                            borderRadius: '7px',
                            bgcolor: Boolean(anchorElEmoji) ? '#0f172a' : 'transparent',
                            color: Boolean(anchorElEmoji) ? '#ffffff' : '#475569',
                            '&:hover': {
                              bgcolor: Boolean(anchorElEmoji) ? '#1e293b' : '#e2e8f0',
                              color: Boolean(anchorElEmoji) ? '#ffffff' : '#0f172a'
                            }
                          }}
                        >
                          {enviandoSticker ? (
                            <CircularProgress size={16} color="inherit" />
                          ) : (
                            <Smile size={18} />
                          )}
                        </IconButton>
                      </span>
                    </Tooltip>

                    <Popover
                      open={Boolean(anchorElEmoji)}
                      anchorEl={anchorElEmoji}
                      onClose={() => setAnchorElEmoji(null)}
                      anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
                      transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                      PaperProps={{
                        sx: {
                          width: { xs: 'calc(100vw - 24px)', sm: 336 },
                          maxWidth: 336,
                          borderRadius: '12px',
                          boxShadow: '0 12px 32px rgba(15, 23, 42, 0.14)',
                          border: '1px solid #e2e8f0',
                          overflow: 'hidden',
                          mb: 1
                        }
                      }}
                    >
                      {/* Pestañas Segmentadas: Emojis vs Stickers */}
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr',
                          bgcolor: '#f1f5f9',
                          p: 0.45,
                          gap: 0.45,
                          borderBottom: '1px solid #e2e8f0'
                        }}
                      >
                        <Button
                          fullWidth
                          size="small"
                          onClick={() => setTabEmojiSticker('emojis')}
                          sx={{
                            textTransform: 'none',
                            fontWeight: 600,
                            fontSize: '0.75rem',
                            borderRadius: '6px',
                            py: 0.45,
                            bgcolor: tabEmojiSticker === 'emojis' ? '#ffffff' : 'transparent',
                            color: tabEmojiSticker === 'emojis' ? '#0f172a' : '#64748b',
                            boxShadow:
                              tabEmojiSticker === 'emojis' ? '0 1px 2px rgba(15,23,42,0.06)' : 'none',
                            '&:hover': {
                              bgcolor: tabEmojiSticker === 'emojis' ? '#ffffff' : '#e2e8f0'
                            }
                          }}
                        >
                          😊 Emojis
                        </Button>
                        <Button
                          fullWidth
                          size="small"
                          onClick={() => setTabEmojiSticker('stickers')}
                          sx={{
                            textTransform: 'none',
                            fontWeight: 600,
                            fontSize: '0.75rem',
                            borderRadius: '6px',
                            py: 0.45,
                            bgcolor: tabEmojiSticker === 'stickers' ? '#ffffff' : 'transparent',
                            color: tabEmojiSticker === 'stickers' ? '#0f172a' : '#64748b',
                            boxShadow:
                              tabEmojiSticker === 'stickers' ? '0 1px 2px rgba(15,23,42,0.06)' : 'none',
                            '&:hover': {
                              bgcolor: tabEmojiSticker === 'stickers' ? '#ffffff' : '#e2e8f0'
                            }
                          }}
                        >
                          🏷️ Stickers (1 Clic)
                        </Button>
                      </Box>

                      {tabEmojiSticker === 'emojis' ? (
                        <Box sx={{ p: 1.5 }}>
                          <Typography
                            sx={{
                              display: 'block',
                              mb: 1,
                              color: '#64748b',
                              fontWeight: 700,
                              fontSize: '0.67rem',
                              textTransform: 'uppercase',
                              letterSpacing: '0.06em'
                            }}
                          >
                            Insertar emoji en el mensaje
                          </Typography>
                          <Box
                            sx={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(8, 1fr)',
                              gap: 0.4
                            }}
                          >
                            {EMOJIS_RAPIDOS.map((em) => (
                              <IconButton
                                key={em}
                                size="small"
                                onClick={() => setMensajeTexto((prev) => `${prev}${em}`)}
                                sx={{
                                  fontSize: '19px',
                                  borderRadius: '6px',
                                  p: 0.55,
                                  '&:hover': { bgcolor: '#f1f5f9', transform: 'scale(1.12)' },
                                  transition: 'transform 0.12s ease'
                                }}
                              >
                                {em}
                              </IconButton>
                            ))}
                          </Box>
                        </Box>
                      ) : (
                        <Box sx={{ p: 1.5 }}>
                          <Typography
                            sx={{
                              display: 'block',
                              mb: 1,
                              color: '#64748b',
                              fontWeight: 700,
                              fontSize: '0.67rem',
                              textTransform: 'uppercase',
                              letterSpacing: '0.06em'
                            }}
                          >
                            Stickers Oficiales IIRESODH (Envío Directo)
                          </Typography>
                          <Box
                            sx={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(2, 1fr)',
                              gap: 0.85,
                              mb: 1.25
                            }}
                          >
                            {STICKERS_INSTITUCIONALES.map((st) => (
                              <Box
                                key={st.id}
                                onClick={() => handleEnviarStickerCatalogo(st)}
                                sx={{
                                  p: 0.9,
                                  borderRadius: '8px',
                                  cursor: 'pointer',
                                  background: `linear-gradient(135deg, ${st.bg1}, ${st.bg2})`,
                                  color: '#ffffff',
                                  textAlign: 'center',
                                  boxShadow: '0 2px 6px rgba(15,23,42,0.1)',
                                  transition: 'transform 0.14s ease',
                                  '&:hover': { transform: 'translateY(-1px)' }
                                }}
                              >
                                <Typography sx={{ fontSize: '22px', lineHeight: 1.1 }}>{st.emoji}</Typography>
                                <Typography
                                  sx={{
                                    fontSize: '0.65rem',
                                    fontWeight: 800,
                                    letterSpacing: '0.03em',
                                    mt: 0.3
                                  }}
                                >
                                  {st.titulo}
                                </Typography>
                                <Typography sx={{ fontSize: '0.58rem', opacity: 0.9 }}>
                                  {st.subtitulo}
                                </Typography>
                              </Box>
                            ))}
                          </Box>

                          <Button
                            fullWidth
                            size="small"
                            variant="outlined"
                            component="label"
                            startIcon={<Upload size={13} />}
                            sx={{
                              textTransform: 'none',
                              fontSize: '0.73rem',
                              fontWeight: 600,
                              borderRadius: '7px',
                              borderColor: '#cbd5e1',
                              color: '#0f172a',
                              '&:hover': { borderColor: '#0f172a', bgcolor: '#f8fafc' }
                            }}
                          >
                            Subir imagen propia como Sticker
                            <input
                              type="file"
                              accept="image/webp,image/png,image/jpeg"
                              hidden
                              onChange={handleSubirImagenComoSticker}
                            />
                          </Button>
                        </Box>
                      )}
                    </Popover>

                    <TextField
                      fullWidth
                      multiline
                      maxRows={4}
                      placeholder={`Escribe un mensaje a ${selectedChat.nombre || selectedChat.telefono}...`}
                      variant="standard"
                      value={mensajeTexto}
                      onChange={(e) => setMensajeTexto(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      disabled={isSending || enviandoNotaVoz}
                      InputProps={{
                        disableUnderline: true,
                        sx: {
                          fontSize: '0.84rem',
                          color: '#0f172a',
                          py: 0.45,
                          px: 0.5,
                          lineHeight: 1.45
                        }
                      }}
                    />

                    <Tooltip title="Grabar nota de voz">
                      <span>
                        <IconButton
                          size="small"
                          onClick={handleIniciarGrabacionVoz}
                          disabled={isSending || enviandoNotaVoz}
                          sx={{
                            width: 32,
                            height: 32,
                            borderRadius: '7px',
                            color: '#475569',
                            '&:hover': { bgcolor: '#e2e8f0', color: '#0f172a' }
                          }}
                        >
                          {enviandoNotaVoz ? (
                            <CircularProgress size={16} color="inherit" />
                          ) : (
                            <Mic size={17} />
                          )}
                        </IconButton>
                      </span>
                    </Tooltip>

                    <IconButton
                      size="small"
                      onClick={() => handleSendMessage()}
                      disabled={!mensajeTexto.trim() || isSending || enviandoNotaVoz}
                      sx={{
                        width: 32,
                        height: 32,
                        borderRadius: '7px',
                        bgcolor: mensajeTexto.trim() ? '#0f172a' : '#e2e8f0',
                        color: mensajeTexto.trim() ? '#ffffff' : '#94a3b8',
                        transition: 'all 0.15s ease',
                        '&:hover': {
                          bgcolor: mensajeTexto.trim() ? '#1e293b' : '#e2e8f0'
                        }
                      }}
                    >
                      {isSending ? <CircularProgress size={15} color="inherit" /> : <Send size={15} />}
                    </IconButton>
                  </Box>
                )}
              </Box>
            </>
          ) : (
            /* Estado Inicial cuando no se ha seleccionado chat (Desktop) */
            <Box
              sx={{
                flexGrow: 1,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                p: 4,
                textAlign: 'center',
                bgcolor: '#f8fafc'
              }}
            >
              <Box
                sx={{
                  width: 56,
                  height: 56,
                  borderRadius: '14px',
                  bgcolor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 4px 12px rgba(15, 23, 42, 0.04)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mb: 2
                }}
              >
                <MessageCircle size={26} color="#10b981" />
              </Box>
              <Typography
                sx={{
                  fontSize: '1rem',
                  color: '#0f172a',
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                  mb: 0.75
                }}
              >
                Consola Multi-Operador de WhatsApp Business
              </Typography>
              <Typography
                sx={{
                  fontSize: '0.8rem',
                  color: '#64748b',
                  maxWidth: 420,
                  mb: 2.5,
                  lineHeight: 1.55
                }}
              >
                Selecciona una conversación de la bandeja izquierda o inicia un nuevo contacto oficial desde la línea institucional de IIRESODH.
              </Typography>
              <Button
                variant="contained"
                size="small"
                startIcon={<Plus size={15} />}
                onClick={() => setOpenNuevoChatModal(true)}
                sx={{
                  bgcolor: '#0f172a',
                  color: '#ffffff',
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '0.78rem',
                  px: 2,
                  py: 0.8,
                  borderRadius: '7px',
                  boxShadow: 'none',
                  '&:hover': { bgcolor: '#1e293b', boxShadow: 'none' }
                }}
              >
                Iniciar Nueva Conversación
              </Button>
            </Box>
          )}
        </Box>
      </Box>

      {/* ============================================================== */}
      {/* MODAL 0: CONFIRMAR ELIMINACIÓN DE CONVERSACIÓN (SOLO ADMINS)    */}
      {/* ============================================================== */}
      <Dialog
        open={esAdmin && openDeleteChatModal}
        onClose={() => !eliminandoChat && setOpenDeleteChatModal(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 20px 40px rgba(15, 23, 42, 0.14)',
            m: { xs: 1.5, sm: 3 }
          }
        }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.25,
            color: '#0f172a',
            fontWeight: 700,
            fontSize: '0.95rem',
            letterSpacing: '-0.01em',
            px: 2.5,
            py: 2,
            borderBottom: '1px solid #f1f5f9'
          }}
        >
          <Box
            sx={{
              width: 30,
              height: 30,
              borderRadius: '7px',
              bgcolor: '#fef2f2',
              border: '1px solid #fecaca',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <AlertTriangle size={16} color="#dc2626" />
          </Box>
          Eliminar Conversación
        </DialogTitle>
        <DialogContent sx={{ px: 2.5, py: 2.25 }}>
          <Typography sx={{ fontSize: '0.83rem', color: '#334155', mb: 1.75, lineHeight: 1.5 }}>
            ¿Confirmas eliminar permanentemente la conversación con{' '}
            <Box component="span" sx={{ fontWeight: 700, color: '#0f172a' }}>
              {(chatAEliminar || selectedChat)?.nombre || `+${(chatAEliminar || selectedChat)?.telefono}`}
            </Box>
            ?
          </Typography>
          <Box
            sx={{
              p: 1.5,
              bgcolor: '#fffbeb',
              border: '1px solid #fde68a',
              borderLeft: '3px solid #d97706',
              borderRadius: '0 8px 8px 0',
              fontSize: '0.76rem',
              color: '#92400e',
              lineHeight: 1.45
            }}
          >
            Esta acción borrará el contacto de la bandeja y todo su historial de mensajes. El movimiento quedará registrado en los <strong>Logs de Auditoría</strong>.
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 2.5, py: 1.75, bgcolor: '#f8fafc', borderTop: '1px solid #e2e8f0', gap: 0.75 }}>
          <Button
            onClick={() => {
              setOpenDeleteChatModal(false);
              setChatAEliminar(null);
            }}
            disabled={eliminandoChat}
            sx={{ textTransform: 'none', color: '#64748b', fontSize: '0.78rem', fontWeight: 600 }}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleEliminarChat}
            disabled={eliminandoChat}
            startIcon={eliminandoChat ? <CircularProgress size={14} color="inherit" /> : <Trash2 size={14} />}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.78rem',
              borderRadius: '7px',
              bgcolor: '#dc2626',
              boxShadow: 'none',
              '&:hover': { bgcolor: '#b91c1c', boxShadow: 'none' }
            }}
          >
            {eliminandoChat ? 'Eliminando...' : 'Eliminar Permanentemente'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ============================================================== */}
      {/* MODAL 1: CONFIGURACIÓN Y CREDENCIALES DE META CLOUD API        */}
      {/* ============================================================== */}
      <Dialog
        open={esAdmin && openConfigModal}
        onClose={() => setOpenConfigModal(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 20px 45px rgba(15, 23, 42, 0.14)',
            m: { xs: 1.25, sm: 3 }
          }
        }}
      >
        <DialogTitle
          sx={{
            fontWeight: 700,
            fontSize: '0.96rem',
            letterSpacing: '-0.01em',
            color: '#0f172a',
            bgcolor: '#ffffff',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            gap: 1.25,
            px: { xs: 2, sm: 3 },
            py: 2
          }}
        >
          <Box
            sx={{
              width: 30,
              height: 30,
              borderRadius: '7px',
              bgcolor: '#0f172a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <Key size={15} color="#10b981" />
          </Box>
          Configuración de WhatsApp Cloud API (Meta)
        </DialogTitle>
        <DialogContent sx={{ p: { xs: 2, sm: 3 } }}>
          <Typography sx={{ fontSize: '0.8rem', color: '#475569', mb: 2.5, lineHeight: 1.5 }}>
            Administra los parámetros de conexión directa con <strong>developers.facebook.com</strong> para el envío y recepción institucional en tiempo real:
          </Typography>

          {/* Datos de Webhook con barra lateral esmeralda y radio cero a la izquierda */}
          <Box
            sx={{
              bgcolor: '#f8fafc',
              p: 2,
              borderRadius: '0 8px 8px 0',
              border: '1px solid #e2e8f0',
              borderLeft: '3px solid #10b981',
              mb: 3
            }}
          >
            <Typography
              sx={{
                fontSize: '0.68rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
                color: '#047857',
                mb: 1.25
              }}
            >
              Parámetros del Webhook en Meta
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Box>
                <Typography sx={{ fontSize: '0.73rem', fontWeight: 600, color: '#334155', mb: 0.4 }}>
                  Callback URL:
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexDirection: { xs: 'column', sm: 'row' } }}>
                  <TextField
                    size="small"
                    fullWidth
                    value={WEBHOOK_CALLBACK_URL}
                    InputProps={{
                      readOnly: true,
                      sx: { fontSize: '0.76rem', bgcolor: '#ffffff', borderRadius: '7px' }
                    }}
                  />
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<Copy size={13} />}
                    onClick={() => copiarAlPortapapeles(WEBHOOK_CALLBACK_URL, 'url')}
                    sx={{
                      textTransform: 'none',
                      whiteSpace: 'nowrap',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      borderRadius: '7px',
                      borderColor: '#cbd5e1',
                      color: '#0f172a'
                    }}
                  >
                    {copiadoCampo === 'url' ? 'Copiado' : 'Copiar URL'}
                  </Button>
                </Box>
              </Box>

              <Box>
                <Typography sx={{ fontSize: '0.73rem', fontWeight: 600, color: '#334155', mb: 0.4 }}>
                  Verify Token:
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexDirection: { xs: 'column', sm: 'row' } }}>
                  <TextField
                    size="small"
                    fullWidth
                    value={metaConfig.verify_token || DEFAULT_VERIFY_TOKEN}
                    InputProps={{
                      readOnly: true,
                      sx: { fontSize: '0.76rem', bgcolor: '#ffffff', borderRadius: '7px' }
                    }}
                  />
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<Copy size={13} />}
                    onClick={() => copiarAlPortapapeles(metaConfig.verify_token || DEFAULT_VERIFY_TOKEN, 'token')}
                    sx={{
                      textTransform: 'none',
                      whiteSpace: 'nowrap',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      borderRadius: '7px',
                      borderColor: '#cbd5e1',
                      color: '#0f172a'
                    }}
                  >
                    {copiadoCampo === 'token' ? 'Copiado' : 'Copiar Token'}
                  </Button>
                </Box>
              </Box>
            </Box>
          </Box>

          <Typography
            sx={{
              fontSize: '0.68rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
              color: '#64748b',
              mb: 1.5
            }}
          >
            Credenciales de Meta for Developers
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Phone Number ID"
              fullWidth
              size="small"
              placeholder="Ej. 104829384729102"
              value={metaConfig.phone_number_id}
              onChange={(e) => setMetaConfig((prev) => ({ ...prev, phone_number_id: e.target.value }))}
              helperText="Identificador del número en Meta Developers > WhatsApp > Configuración de la API"
            />

            <TextField
              label="Token de Acceso Permanente (System User Access Token)"
              fullWidth
              multiline
              rows={2}
              size="small"
              placeholder="Ej. EAAQ..."
              value={metaConfig.whatsapp_token}
              onChange={(e) => setMetaConfig((prev) => ({ ...prev, whatsapp_token: e.target.value }))}
              helperText="Usa un Token de Usuario del Sistema con permisos whatsapp_business_messaging y caducidad 'Nunca'."
            />

            <TextField
              label="WhatsApp Business Account ID (WABA ID - Opcional)"
              fullWidth
              size="small"
              placeholder="Ej. 102938481920394"
              value={metaConfig.waba_id}
              onChange={(e) => setMetaConfig((prev) => ({ ...prev, waba_id: e.target.value }))}
            />

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
              <Button
                variant="outlined"
                size="small"
                onClick={handleProbarConexion}
                disabled={probandoConexion || !metaConfig.whatsapp_token?.trim()}
                startIcon={probandoConexion ? <CircularProgress size={13} /> : <RefreshCw size={13} />}
                sx={{
                  textTransform: 'none',
                  color: '#0f172a',
                  borderColor: '#cbd5e1',
                  fontWeight: 600,
                  fontSize: '0.76rem',
                  borderRadius: '7px'
                }}
              >
                {probandoConexion ? 'Verificando en Meta...' : 'Probar Conexión en Vivo'}
              </Button>
              <Typography sx={{ fontSize: '0.73rem', color: '#64748b' }}>
                Comprueba la validez del token antes de guardar cambios.
              </Typography>
            </Box>

            {resultadoPrueba && (
              <Alert
                severity={resultadoPrueba.exito ? 'success' : 'error'}
                onClose={() => setResultadoPrueba(null)}
                sx={{ fontSize: '0.76rem', borderRadius: '8px' }}
              >
                {resultadoPrueba.mensaje}
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, bgcolor: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
          <Button
            onClick={() => setOpenConfigModal(false)}
            sx={{ textTransform: 'none', color: '#64748b', fontSize: '0.78rem', fontWeight: 600 }}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleGuardarConfigMeta}
            disabled={guardandoConfig}
            sx={{
              bgcolor: '#0f172a',
              color: '#ffffff',
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.78rem',
              borderRadius: '7px',
              boxShadow: 'none',
              '&:hover': { bgcolor: '#1e293b', boxShadow: 'none' }
            }}
          >
            {guardandoConfig ? 'Guardando...' : 'Guardar Configuración'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ============================================================== */}
      {/* MODAL 2: INICIAR NUEVO CHAT                                    */}
      {/* ============================================================== */}
      <Dialog
        open={openNuevoChatModal}
        onClose={() => setOpenNuevoChatModal(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 20px 45px rgba(15, 23, 42, 0.14)',
            m: { xs: 1.25, sm: 3 }
          }
        }}
      >
        <DialogTitle
          sx={{
            fontWeight: 700,
            fontSize: '0.95rem',
            letterSpacing: '-0.01em',
            color: '#0f172a',
            bgcolor: '#ffffff',
            borderBottom: '1px solid #e2e8f0',
            px: { xs: 2, sm: 3 },
            py: 2
          }}
        >
          Iniciar Nueva Conversación
        </DialogTitle>
        <DialogContent sx={{ p: { xs: 2, sm: 3 } }}>
          <Box
            sx={{
              mb: 2.5,
              p: 1.5,
              bgcolor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderLeft: '3px solid #0f172a',
              borderRadius: '0 8px 8px 0',
              fontSize: '0.75rem',
              color: '#475569',
              lineHeight: 1.5
            }}
          >
            <strong style={{ color: '#0f172a' }}>Ventana de 24h (Meta API):</strong> Si el contacto no ha escrito primero en las últimas 24 horas, el envío automático emplea la <strong>Plantilla Oficial IIRESODH</strong> para garantizar la entrega inmediata.
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Número de Teléfono (con código de país)"
              fullWidth
              size="small"
              placeholder="Ej: 50688888888 o +503 7700 4133"
              value={nuevoTelefono}
              onChange={(e) => setNuevoTelefono(e.target.value)}
              required
            />

            <TextField
              label="Nombre del Contacto (Opcional)"
              fullWidth
              size="small"
              placeholder="Ej: Lic. Juan Pérez"
              value={nuevoNombre}
              onChange={(e) => setNuevoNombre(e.target.value)}
            />

            <TextField
              select
              label="Modo de Apertura en WhatsApp API"
              fullWidth
              size="small"
              value={modoInicioChat}
              onChange={(e) => setModoInicioChat(e.target.value)}
              helperText={
                cargandoPlantillasMeta
                  ? 'Verificando estado de plantillas en Meta...'
                  : estadoPlantillaIiresodh === 'APPROVED'
                  ? 'Plantilla oficial "aviso_institucional_iiresodh" aprobada y activa.'
                  : 'Plantilla en revisión de Meta. El modo automático garantiza la entrega.'
              }
            >
              <MenuItem value="auto">
                Plantilla Oficial de Apertura (Garantiza entrega fuera de ventana de 24h)
              </MenuItem>
              <MenuItem value="texto_libre">
                Texto Libre Directo (Si el contacto escribió en las últimas 24h)
              </MenuItem>
            </TextField>

            <TextField
              label="Mensaje o Motivo de Contacto"
              fullWidth
              multiline
              rows={3}
              size="small"
              placeholder="Escribe el motivo o mensaje inicial..."
              value={nuevoMensajeInicial}
              onChange={(e) => setNuevoMensajeInicial(e.target.value)}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, bgcolor: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
          <Button
            onClick={() => setOpenNuevoChatModal(false)}
            sx={{ textTransform: 'none', color: '#64748b', fontSize: '0.78rem', fontWeight: 600 }}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleCrearNuevoChat}
            disabled={!nuevoTelefono.trim() || isSending}
            sx={{
              bgcolor: '#0f172a',
              color: '#ffffff',
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.78rem',
              borderRadius: '7px',
              boxShadow: 'none',
              '&:hover': { bgcolor: '#1e293b', boxShadow: 'none' }
            }}
          >
            {isSending ? 'Enviando...' : 'Abrir Chat y Enviar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ============================================================== */}
      {/* MODAL 3: EDITAR NOMBRE DE CONTACTO                             */}
      {/* ============================================================== */}
      <Dialog
        open={openEditContactoModal}
        onClose={() => setOpenEditContactoModal(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 20px 40px rgba(15, 23, 42, 0.14)',
            m: { xs: 1.5, sm: 3 }
          }
        }}
      >
        <DialogTitle
          sx={{
            fontWeight: 700,
            fontSize: '0.94rem',
            color: '#0f172a',
            bgcolor: '#ffffff',
            borderBottom: '1px solid #e2e8f0',
            px: 2.5,
            py: 1.75
          }}
        >
          Renombrar Contacto
        </DialogTitle>
        <DialogContent sx={{ p: 2.5 }}>
          <Typography sx={{ fontSize: '0.76rem', color: '#64748b', display: 'block', mb: 2, lineHeight: 1.45 }}>
            Asigna un nombre identificable para todos los operadores en la bandeja institucional.
          </Typography>
          <TextField
            label="Nombre del contacto"
            fullWidth
            size="small"
            value={editNombreContacto}
            onChange={(e) => setEditNombreContacto(e.target.value)}
            autoFocus
          />
        </DialogContent>
        <DialogActions sx={{ px: 2.5, py: 1.75, bgcolor: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
          <Button
            onClick={() => setOpenEditContactoModal(false)}
            sx={{ textTransform: 'none', color: '#64748b', fontSize: '0.78rem', fontWeight: 600 }}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleGuardarNombreContacto}
            sx={{
              bgcolor: '#0f172a',
              color: '#ffffff',
              textTransform: 'none',
              fontSize: '0.78rem',
              fontWeight: 600,
              borderRadius: '7px',
              boxShadow: 'none',
              '&:hover': { bgcolor: '#1e293b', boxShadow: 'none' }
            }}
          >
            Guardar
          </Button>
        </DialogActions>
      </Dialog>

      {/* ============================================================== */}
      {/* MENÚ DE PLANTILLAS DE RESPUESTAS RÁPIDAS                       */}
      {/* ============================================================== */}
      <Menu
        anchorEl={anchorElRespuestas}
        open={Boolean(anchorElRespuestas)}
        onClose={() => setAnchorElRespuestas(null)}
        PaperProps={{
          sx: {
            width: { xs: 'calc(100vw - 24px)', sm: 340 },
            maxWidth: 340,
            maxHeight: 380,
            p: 0.5,
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 12px 28px rgba(15, 23, 42, 0.12)'
          }
        }}
      >
        <Box sx={{ px: 1.75, py: 1, borderBottom: '1px solid #f1f5f9' }}>
          <Typography
            sx={{
              fontSize: '0.66rem',
              fontWeight: 700,
              color: '#64748b',
              letterSpacing: '0.07em',
              textTransform: 'uppercase'
            }}
          >
            Respuestas Rápidas Institucionales
          </Typography>
        </Box>
        {RESPUESTAS_RAPIDAS.map((item, idx) => (
          <MenuItem
            key={idx}
            onClick={() => handleSeleccionarRespuestaRapida(item.texto)}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              py: 1,
              px: 1.75,
              borderRadius: '6px',
              whiteSpace: 'normal',
              '&:hover': { bgcolor: '#f8fafc' }
            }}
          >
            <Typography sx={{ fontWeight: 700, color: '#0f172a', fontSize: '0.76rem', mb: 0.2 }}>
              {item.titulo}
            </Typography>
            <Typography
              sx={{
                fontSize: '0.72rem',
                color: '#64748b',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                lineHeight: 1.4
              }}
            >
              {item.texto}
            </Typography>
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
}