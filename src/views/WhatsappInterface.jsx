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
  MenuItem
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
  VolumeX
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
      const token = metaConfig.whatsapp_token || DEFAULT_TOKEN;
      const infoRes = await fetch(`https://graph.facebook.com/v21.0/${msg.media_id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const infoData = await infoRes.json();
      if (!infoData?.url) throw new Error('No se encontró la URL del audio en Meta');

      const binRes = await fetch(infoData.url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const blob = await binRes.blob();
      const blobUrl = URL.createObjectURL(blob);
      setAudiosResueltos((prev) => ({ ...prev, [msg.id]: blobUrl }));
    } catch (e) {
      setNotificacion({
        tipo: 'warning',
        mensaje: 'No se pudo descargar el audio desde Meta API: ' + e.message
      });
    } finally {
      setCargandoAudioId(null);
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

  return (
    <Box sx={{ 
      height: 'calc(100vh - 110px)', 
      display: 'flex', 
      flexDirection: 'column', 
      bgcolor: '#f0f2f5', 
      borderRadius: 2, 
      overflow: 'hidden', 
      border: '1px solid #e2e8f0',
      boxShadow: '0 4px 20px rgba(0,0,0,0.06)'
    }}>
      {/* Audio oculto para llamadas WebRTC en vivo */}
      <audio ref={remoteAudioRef} autoPlay style={{ display: 'none' }} />
      
      {/* 🚀 BARRA DE ESTADO MULTIUSUARIO & META API */}
      <Box sx={{ 
        bgcolor: '#ffffff', 
        px: 2.5, 
        py: 1.2, 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        borderBottom: '1px solid #e2e8f0',
        flexWrap: 'wrap',
        gap: 1
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <IconButton onClick={onVolver} size="small" sx={{ color: '#475569', '&:hover': { bgcolor: '#f1f5f9' } }}>
            <ArrowLeft size={20} />
          </IconButton>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Avatar sx={{ width: 32, height: 32, bgcolor: '#25D366' }}>
              <MessageCircle size={18} color="#fff" />
            </Avatar>
            <Typography variant="subtitle1" fontWeight="700" color="#1e293b" sx={{ fontSize: '15px' }}>
              WhatsApp Business API
            </Typography>
          </Box>
          <Chip 
            label="Multi-Usuario Activo" 
            size="small" 
            sx={{ bgcolor: '#e0f2fe', color: '#0369a1', fontWeight: 600, fontSize: '11px', height: '22px' }} 
          />
          <Chip 
            label={`Atendiendo como: ${userName}`} 
            size="small" 
            variant="outlined"
            sx={{ borderColor: '#cbd5e1', color: '#475569', fontSize: '11px', height: '22px' }} 
          />
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          {/* 🎛️ INTERRUPTOR DE RECEPCIÓN DE LLAMADAS WEB VS TELÉFONO FÍSICO (+506 4081-6188) */}
          <Tooltip
            title={
              recepcionVozWebActiva
                ? 'Haz clic para PAUSAR las llamadas en la Web y que suene únicamente el teléfono físico (+506 4081-6188)'
                : 'En Pausa: Las llamadas entran al teléfono físico (+506 4081-6188). Haz clic para volver a recibir llamadas en la Web'
            }
          >
            <Button
              size="small"
              variant="outlined"
              disabled={cambiandoModoVoz}
              onClick={handleToggleRecepcionVozWeb}
              startIcon={
                recepcionVozWebActiva ? (
                  <Volume2 size={15} color="#15803d" />
                ) : (
                  <VolumeX size={15} color="#b45309" />
                )
              }
              sx={{
                textTransform: 'none',
                fontSize: '11.5px',
                fontWeight: 700,
                borderRadius: 2,
                px: 1.4,
                py: 0.4,
                bgcolor: recepcionVozWebActiva ? '#f0fdf4' : '#fffbeb',
                borderColor: recepcionVozWebActiva ? '#86efac' : '#fde68a',
                color: recepcionVozWebActiva ? '#166534' : '#92400e',
                '&:hover': {
                  bgcolor: recepcionVozWebActiva ? '#dcfce7' : '#fef3c7',
                  borderColor: recepcionVozWebActiva ? '#4ade80' : '#fcd34d'
                }
              }}
            >
              {cambiandoModoVoz
                ? 'Cambiando...'
                : recepcionVozWebActiva
                ? '📞 Llamadas Web: Activas (Pausar)'
                : '⏸️ Llamadas Web en Pausa (Suena Teléfono Físico)'}
            </Button>
          </Tooltip>

          <Tooltip title={tieneApiConectada ? "Meta Cloud API conectada en vivo" : "Pendiente de ingresar llaves de Meta"}>
            <Chip 
              icon={tieneApiConectada ? <ShieldCheck size={14} color="#16a34a" /> : <Clock size={14} color="#d97706" />}
              label={tieneApiConectada ? "API Meta Conectada" : "Modo En Espera de Llaves"}
              size="small"
              onClick={esAdmin ? () => setOpenConfigModal(true) : undefined}
              sx={{ 
                cursor: esAdmin ? 'pointer' : 'default',
                bgcolor: tieneApiConectada ? '#dcfce7' : '#fef3c7', 
                color: tieneApiConectada ? '#15803d' : '#b45309',
                fontWeight: 600,
                fontSize: '11px',
                height: '24px'
              }}
            />
          </Tooltip>

          {esAdmin && (
            <Button 
              variant="contained" 
              size="small" 
              startIcon={<Settings size={15} />}
              onClick={() => setOpenConfigModal(true)}
              sx={{ 
                bgcolor: '#0f766e', 
                color: '#fff', 
                fontSize: '12px',
                textTransform: 'none',
                fontWeight: 600,
                boxShadow: 'none',
                '&:hover': { bgcolor: '#115e59' } 
              }}
            >
              Conexión Meta API
            </Button>
          )}
        </Box>
      </Box>

      {/* Alerta Temporal si existe notificación */}
      {notificacion && (
        <Alert 
          severity={notificacion.tipo} 
          onClose={() => setNotificacion(null)} 
          sx={{ borderRadius: 0, py: 0.8, fontSize: '13px', alignItems: 'center' }}
          action={
            esAdmin && notificacion.tipo === 'warning' ? (
              <Button 
                color="inherit" 
                size="small" 
                onClick={() => setOpenConfigModal(true)}
                sx={{ textTransform: 'none', fontWeight: 700, textDecoration: 'underline' }}
              >
                ⚙️ Conexión Meta API
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
            bgcolor: enLlamadaWebRTC ? '#065f46' : '#1e293b',
            color: 'white',
            px: 3,
            py: 1.5,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 1.5,
            borderBottom: '2px solid #10b981'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar sx={{ bgcolor: '#10b981', width: 36, height: 36 }}>
              {enLlamadaWebRTC ? <PhoneCall size={18} /> : <PhoneIncoming size={18} />}
            </Avatar>
            <Box>
              <Typography variant="subtitle2" fontWeight="700" sx={{ color: '#ecfdf5' }}>
                {enLlamadaWebRTC
                  ? `🟢 Llamada de Voz WhatsApp en Curso con +${llamadaEntrante.from || 'Cliente'}`
                  : `📲 Llamada Entrante de WhatsApp: +${llamadaEntrante.from || 'Cliente'}`}
              </Typography>
              <Typography variant="caption" sx={{ color: '#a7f3d0', display: 'block' }}>
                {enLlamadaWebRTC
                  ? `Atendida desde el navegador por ${llamadaEntrante.atendida_por || userName}`
                  : 'Puedes contestar aquí con tu micrófono o desviarla para que la atiendan en el teléfono físico (+506 4081-6188)'}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {!enLlamadaWebRTC ? (
              <>
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<PhoneCall size={15} />}
                  onClick={() => handleContestarLlamadaWebRTC(llamadaEntrante)}
                  sx={{
                    bgcolor: '#10b981',
                    color: 'white',
                    fontWeight: 700,
                    textTransform: 'none',
                    '&:hover': { bgcolor: '#059669' }
                  }}
                >
                  Contestar en Web
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<PhoneOff size={15} />}
                  onClick={() => handleRechazarODesviarLlamada(llamadaEntrante)}
                  sx={{
                    borderColor: '#fca5a5',
                    color: '#fecaca',
                    fontWeight: 700,
                    textTransform: 'none',
                    '&:hover': { bgcolor: 'rgba(239,68,68,0.2)', borderColor: '#f87171' }
                  }}
                >
                  Desviar a Teléfono Físico / Rechazar
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={micSilenciado ? <VolumeX size={15} /> : <Volume2 size={15} />}
                  onClick={handleToggleMuteMic}
                  sx={{
                    borderColor: 'rgba(255,255,255,0.5)',
                    color: 'white',
                    textTransform: 'none',
                    fontWeight: 600
                  }}
                >
                  {micSilenciado ? 'Activar Micrófono' : 'Silenciar Micrófono'}
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<PhoneOff size={15} />}
                  onClick={handleColgarLlamadaWebRTC}
                  sx={{
                    bgcolor: '#dc2626',
                    color: 'white',
                    fontWeight: 700,
                    textTransform: 'none',
                    '&:hover': { bgcolor: '#b91c1c' }
                  }}
                >
                  Colgar Llamada
                </Button>
              </>
            )}
          </Box>
        </Box>
      )}

      {/* ÁREA PRINCIPAL: BANDEJA IZQUIERDA + CONVERSACIÓN DERECHA */}
      <Box sx={{ display: 'flex', flexGrow: 1, overflow: 'hidden' }}>
        
        {/* ============================================================== */}
        {/* SIDEBAR DE CHATS                                              */}
        {/* ============================================================== */}
        <Box sx={{ 
          width: { xs: '100%', md: '380px' }, 
          borderRight: '1px solid #e2e8f0', 
          bgcolor: 'white', 
          display: { xs: selectedChat ? 'none' : 'flex', md: 'flex' }, 
          flexDirection: 'column' 
        }}>
          
          {/* Header del Sidebar */}
          <Box sx={{ bgcolor: '#f8fafc', p: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0' }}>
            <Typography variant="subtitle2" fontWeight="700" color="#334155">
              Conversaciones ({chatsFiltrados.length})
            </Typography>
            <Button
              size="small"
              variant="contained"
              startIcon={<Plus size={16} />}
              onClick={() => setOpenNuevoChatModal(true)}
              sx={{ 
                bgcolor: '#25D366', 
                color: 'white', 
                fontSize: '12px', 
                textTransform: 'none',
                fontWeight: 600,
                boxShadow: 'none',
                '&:hover': { bgcolor: '#20bd5a' } 
              }}
            >
              Nuevo Chat
            </Button>
          </Box>

          {/* Búsqueda y Filtros */}
          <Box sx={{ p: 1.5, borderBottom: '1px solid #e2e8f0', bgcolor: 'white' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', bgcolor: '#f1f5f9', borderRadius: 2, px: 1.5, py: 0.6 }}>
              <Search size={16} color="#64748b" />
              <TextField 
                placeholder="Buscar por nombre, número o texto..."
                variant="standard"
                fullWidth
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{ disableUnderline: true, sx: { ml: 1, fontSize: '13px' } }}
              />
            </Box>

            {/* Filtros Rápidos */}
            <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
              <Chip 
                label="Todos" 
                size="small" 
                clickable 
                onClick={() => setFiltroTab('todos')}
                sx={{ 
                  fontSize: '11px', 
                  bgcolor: filtroTab === 'todos' ? '#0f172a' : '#f1f5f9', 
                  color: filtroTab === 'todos' ? '#fff' : '#475569' 
                }} 
              />
              <Chip 
                label={`No leídos (${chats.filter(c => (c.no_leidos || 0) > 0).length})`} 
                size="small" 
                clickable 
                onClick={() => setFiltroTab('no_leidos')}
                sx={{ 
                  fontSize: '11px', 
                  bgcolor: filtroTab === 'no_leidos' ? '#25D366' : '#f1f5f9', 
                  color: filtroTab === 'no_leidos' ? '#fff' : '#475569' 
                }} 
              />
            </Box>
          </Box>

          {/* Lista de Chats con Firestore en tiempo real */}
          <List sx={{ flexGrow: 1, overflowY: 'auto', p: 0 }}>
            {loadingChats ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 6, gap: 1.5 }}>
                <CircularProgress size={24} sx={{ color: '#25D366' }} />
                <Typography variant="caption" color="text.secondary">Sincronizando chats...</Typography>
              </Box>
            ) : chatsFiltrados.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 8, px: 3 }}>
                <MessageCircle size={36} color="#cbd5e1" style={{ margin: '0 auto 12px' }} />
                <Typography variant="subtitle2" color="#64748b" fontWeight="600">
                  {searchTerm ? 'No se encontraron conversaciones' : 'No hay chats activos aún'}
                </Typography>
                <Typography variant="caption" color="#94a3b8" sx={{ display: 'block', mt: 0.5 }}>
                  Haz clic en "+ Nuevo Chat" para iniciar la primera conversación desde el número institucional.
                </Typography>
                <Button 
                  size="small" 
                  variant="outlined" 
                  onClick={() => setOpenNuevoChatModal(true)} 
                  sx={{ mt: 2, fontSize: '11px', textTransform: 'none' }}
                >
                  Iniciar Chat Ahora
                </Button>
              </Box>
            ) : (
              chatsFiltrados.map((contact, index) => (
                <React.Fragment key={contact.id}>
                  <ListItem 
                    button 
                    onClick={() => setSelectedChat(contact)}
                    secondaryAction={
                      esAdmin ? (
                        <Tooltip title="Eliminar conversación (Solo Administradores)">
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
                              opacity: { xs: 1, md: 0 },
                              transition: 'opacity 0.2s',
                              '&:hover': { color: '#ef4444', bgcolor: '#fee2e2' }
                            }}
                          >
                            <Trash2 size={15} />
                          </IconButton>
                        </Tooltip>
                      ) : null
                    }
                    sx={{ 
                      bgcolor: selectedChat?.id === contact.id ? '#f1f5f9' : 'transparent',
                      borderLeft: selectedChat?.id === contact.id ? '4px solid #25D366' : '4px solid transparent',
                      '&:hover': { bgcolor: '#f8fafc', '& .MuiIconButton-root': { opacity: 1 } },
                      py: 1.2
                    }}
                  >
                    <ListItemAvatar>
                      <Badge 
                        color="success" 
                        badgeContent={contact.no_leidos || 0} 
                        invisible={!contact.no_leidos}
                        sx={{ '& .MuiBadge-badge': { bgcolor: '#25D366', color: '#fff', fontWeight: 'bold' } }}
                      >
                        <Avatar sx={{ bgcolor: '#cfe9e2', color: '#0f766e', fontWeight: 700, width: 42, height: 42 }}>
                          {(contact.nombre || contact.telefono || '?').charAt(0).toUpperCase()}
                        </Avatar>
                      </Badge>
                    </ListItemAvatar>
                    <ListItemText 
                      primary={
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="subtitle2" fontWeight={contact.no_leidos ? "700" : "600"} color="#0f172a" noWrap sx={{ maxWidth: '180px' }}>
                            {contact.nombre || `+${contact.telefono}`}
                          </Typography>
                          <Typography variant="caption" color={contact.no_leidos ? "#25D366" : "text.secondary"} fontWeight={contact.no_leidos ? "700" : "normal"}>
                            {formatearFecha(contact.ultima_fecha)}
                          </Typography>
                        </Box>
                      } 
                      secondary={
                        <Box sx={{ mt: 0.3 }}>
                          <Typography variant="body2" color={contact.no_leidos ? "#0f172a" : "#64748b"} fontWeight={contact.no_leidos ? "600" : "normal"} noWrap sx={{ fontSize: '12px' }}>
                            {contact.ultimo_agente && contact.ultimo_mensaje ? (
                              <span style={{ color: '#0284c7', fontWeight: 600 }}>{contact.ultimo_agente === userName ? 'Tú: ' : `${contact.ultimo_agente}: `}</span>
                            ) : null}
                            {contact.ultimo_mensaje || 'Conversación iniciada'}
                          </Typography>
                        </Box>
                      } 
                    />
                  </ListItem>
                  {index < chatsFiltrados.length - 1 && <Divider component="li" sx={{ ml: 8 }} />}
                </React.Fragment>
              ))
            )}
          </List>
        </Box>

        {/* ============================================================== */}
        {/* ÁREA DE CONVERSACIÓN PRINCIPAL                                 */}
        {/* ============================================================== */}
        <Box sx={{ 
          flexGrow: 1, 
          display: { xs: selectedChat ? 'flex' : 'none', md: 'flex' }, 
          flexDirection: 'column', 
          bgcolor: '#efeae2', 
          backgroundImage: 'radial-gradient(circle, #e2ded5 10%, transparent 11%)', 
          backgroundSize: '20px 20px',
          position: 'relative' 
        }}>
          {selectedChat ? (
            <>
              {/* Header del Chat Seleccionado */}
              <Box sx={{ 
                bgcolor: '#ffffff', 
                px: 2.5, 
                py: 1.5, 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                borderBottom: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <IconButton onClick={() => setSelectedChat(null)} sx={{ display: { md: 'none' }, mr: 0.5 }}>
                    <ArrowLeft size={20} />
                  </IconButton>
                  <Avatar sx={{ bgcolor: '#0f766e', color: '#fff', fontWeight: 700 }}>
                    {(selectedChat.nombre || selectedChat.telefono || '?').charAt(0).toUpperCase()}
                  </Avatar>
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="subtitle1" fontWeight="700" color="#1e293b" sx={{ fontSize: '15px' }}>
                        {selectedChat.nombre || `+${selectedChat.telefono}`}
                      </Typography>
                      <Tooltip title="Editar nombre del contacto">
                        <IconButton 
                          size="small" 
                          onClick={() => {
                            setEditNombreContacto(selectedChat.nombre || '');
                            setOpenEditContactoModal(true);
                          }}
                          sx={{ p: 0.3, color: '#94a3b8', '&:hover': { color: '#0f766e' } }}
                        >
                          <Edit3 size={14} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Phone size={11} /> +{selectedChat.telefono} • Canal Oficial WhatsApp
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Tooltip title="Solicitar permiso de llamada de voz nativa de WhatsApp al contacto">
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={isSending ? <CircularProgress size={12} /> : <PhoneCall size={14} />}
                      disabled={isSending}
                      onClick={handleSolicitarPermisoLlamadaWhatsApp}
                      sx={{
                        fontSize: '11px',
                        textTransform: 'none',
                        borderColor: '#10b981',
                        color: '#047857',
                        fontWeight: 600,
                        '&:hover': { borderColor: '#059669', bgcolor: '#ecfdf5' }
                      }}
                    >
                      Solicitar Llamada
                    </Button>
                  </Tooltip>

                  <Tooltip title="Crear Sala de Voz / Google Meet en 1 clic y enviar invitación por WhatsApp">
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={creandoSalaMeet ? <CircularProgress size={12} /> : <Video size={14} />}
                      disabled={creandoSalaMeet}
                      onClick={handleEnviarSalaVozMeet}
                      sx={{
                        fontSize: '11px',
                        textTransform: 'none',
                        borderColor: '#3b82f6',
                        color: '#1d4ed8',
                        fontWeight: 600,
                        '&:hover': { borderColor: '#2563eb', bgcolor: '#eff6ff' }
                      }}
                    >
                      Sala Voz/Meet
                    </Button>
                  </Tooltip>

                  <Button 
                    size="small"
                    variant="outlined"
                    startIcon={<Sparkles size={14} />}
                    onClick={(e) => setAnchorElRespuestas(e.currentTarget)}
                    sx={{ 
                      fontSize: '11px', 
                      textTransform: 'none', 
                      borderColor: '#cbd5e1', 
                      color: '#334155',
                      '&:hover': { borderColor: '#25D366', bgcolor: '#f0fdf4' }
                    }}
                  >
                    Respuestas Rápidas
                  </Button>

                  {esAdmin && (
                    <Tooltip title="Eliminar conversación (Solo Administradores)">
                      <IconButton 
                        size="small"
                        onClick={() => {
                          setChatAEliminar(selectedChat);
                          setOpenDeleteChatModal(true);
                        }}
                        sx={{ 
                          color: '#94a3b8', 
                          p: 0.8,
                          '&:hover': { color: '#ef4444', bgcolor: '#fee2e2' } 
                        }}
                      >
                        <Trash2 size={16} />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              </Box>

              {/* Mensajes del Chat en Tiempo Real */}
              <Box sx={{ 
                flexGrow: 1, 
                overflowY: 'auto', 
                p: 3, 
                display: 'flex', 
                flexDirection: 'column', 
                gap: 1.5 
              }}>
                {loadingMensajes ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress size={24} sx={{ color: '#0f766e' }} />
                  </Box>
                ) : mensajesChat.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 6 }}>
                    <Chip label="No hay mensajes previos en esta conversación" size="small" sx={{ bgcolor: 'rgba(255,255,255,0.85)' }} />
                  </Box>
                ) : (
                  mensajesChat.map((msg) => {
                    const esMiMensaje = msg.es_mio === true;
                    const audioSrc = msg.media_url || audiosResueltos[msg.id];
                    return (
                      <Box 
                        key={msg.id} 
                        sx={{ 
                          alignSelf: esMiMensaje ? 'flex-end' : 'flex-start', 
                          bgcolor: esMiMensaje ? '#d9fdd3' : '#ffffff', 
                          p: 1.5, 
                          borderRadius: 2.5, 
                          maxWidth: { xs: '85%', md: '68%' }, 
                          boxShadow: '0 1px 1px rgba(11,20,26,.12)',
                          position: 'relative'
                        }}
                      >
                        {/* 👤 ATRIBUCIÓN MULTI-AGENTE: Muestra qué operador de IIRESODH respondió */}
                        {esMiMensaje && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                            <Chip 
                              size="small" 
                              icon={<User size={11} color="#0369a1" />}
                              label={msg.agente_nombre === userName ? 'Tú' : msg.agente_nombre || 'Operador'}
                              sx={{ 
                                height: '18px', 
                                fontSize: '10px', 
                                fontWeight: 700, 
                                bgcolor: '#e0f2fe', 
                                color: '#0369a1',
                                '& .MuiChip-icon': { ml: '4px' }
                              }}
                            />
                          </Box>
                        )}

                        <Typography variant="body2" color="#0f172a" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '13.5px', lineHeight: 1.45 }}>
                          {msg.texto}
                        </Typography>

                        {/* Reproductor de Notas de Voz (Salientes o Entrantes de WhatsApp) */}
                        {(msg.tipo === 'audio' || audioSrc || msg.media_id) && (
                          <Box sx={{ mt: 1 }}>
                            {audioSrc ? (
                              <audio controls src={audioSrc} style={{ height: 36, maxWidth: '260px' }} />
                            ) : msg.media_id ? (
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={cargandoAudioId === msg.id ? <CircularProgress size={12} /> : <Volume2 size={14} />}
                                disabled={cargandoAudioId === msg.id}
                                onClick={() => handleReproducirAudioMeta(msg)}
                                sx={{
                                  fontSize: '11px',
                                  textTransform: 'none',
                                  borderColor: '#0f766e',
                                  color: '#0f766e',
                                  mt: 0.5
                                }}
                              >
                                {cargandoAudioId === msg.id ? 'Descargando audio...' : 'Escuchar nota de voz'}
                              </Button>
                            ) : null}
                          </Box>
                        )}

                        {/* Metadatos y checks de entrega */}
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 0.5, mt: 0.4 }}>
                          <Typography variant="caption" color="#64748b" sx={{ fontSize: '10.5px' }}>
                            {formatearFecha(msg.fecha)}
                          </Typography>
                          
                          {esMiMensaje ? (
                            <Box sx={{ display: 'inline-flex', alignItems: 'center' }}>
                              {msg.estado === 'read' || msg.estado === 'leido' ? (
                                <Tooltip title="Leído / Visto por el cliente (Doble check azul)">
                                  <CheckCheck size={15} color="#0284c7" strokeWidth={2.4} />
                                </Tooltip>
                              ) : msg.estado === 'delivered' || msg.estado === 'entregado' ? (
                                <Tooltip title="Entregado al dispositivo del cliente">
                                  <CheckCheck size={15} color="#64748b" />
                                </Tooltip>
                              ) : msg.estado === 'sent' || msg.estado === 'enviado' ? (
                                <Tooltip title="Enviado a servidores de WhatsApp">
                                  <Check size={14} color="#64748b" />
                                </Tooltip>
                              ) : msg.estado === 'failed' || msg.estado === 'error' ? (
                                <Tooltip
                                  title={
                                    msg.error_detalle
                                      ? `No entregado (Código ${msg.error_codigo || 'Meta'}): ${msg.error_detalle}`
                                      : 'No pudo entregarse al destinatario (Ventana de 24h cerrada en WhatsApp; requiere Plantilla Oficial)'
                                  }
                                >
                                  <AlertCircle size={14} color="#dc2626" />
                                </Tooltip>
                              ) : (
                                <Tooltip title="Guardado internamente en Intranet (En espera de llaves de Meta API)">
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
                                  <CheckCheck size={13} color="#0284c7" />
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

              {/* Input de Mensaje o Grabador de Nota de Voz */}
              <Box sx={{ 
                bgcolor: '#f0f2f5', 
                px: 2, 
                py: 1.2, 
                display: 'flex', 
                alignItems: 'center', 
                gap: 1.2,
                borderTop: '1px solid #e2e8f0' 
              }}>
                {grabandoVoz ? (
                  <Box
                    sx={{
                      flexGrow: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      bgcolor: '#fef2f2',
                      border: '1px solid #fecaca',
                      borderRadius: 2.5,
                      px: 2,
                      py: 0.8
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Mic size={18} color="#dc2626" />
                      <Typography variant="body2" fontWeight="700" color="#dc2626">
                        Grabando nota de voz... {Math.floor(segundosGrabacion / 60)}:
                        {String(segundosGrabacion % 60).padStart(2, '0')}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Button
                        size="small"
                        color="error"
                        onClick={handleCancelarGrabacionVoz}
                        sx={{ textTransform: 'none', fontWeight: 600 }}
                      >
                        Cancelar
                      </Button>
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<Send size={14} />}
                        onClick={handleDetenerYEnviarNotaVoz}
                        sx={{
                          bgcolor: '#25D366',
                          color: 'white',
                          textTransform: 'none',
                          fontWeight: 700,
                          '&:hover': { bgcolor: '#20bd5a' }
                        }}
                      >
                        Enviar Audio
                      </Button>
                    </Box>
                  </Box>
                ) : (
                  <>
                    <TextField
                      fullWidth
                      multiline
                      maxRows={4}
                      placeholder={`Responder a ${selectedChat.nombre || selectedChat.telefono} (como ${userName})...`}
                      variant="outlined"
                      size="small"
                      value={mensajeTexto}
                      onChange={(e) => setMensajeTexto(e.target.value)}
                      onKeyDown={(e) => { 
                        if (e.key === 'Enter' && !e.shiftKey) { 
                          e.preventDefault(); 
                          handleSendMessage(); 
                        } 
                      }}
                      disabled={isSending || enviandoNotaVoz}
                      sx={{ 
                        bgcolor: 'white', 
                        borderRadius: 2.5, 
                        '& fieldset': { borderColor: '#cbd5e1' },
                        '&:hover fieldset': { borderColor: '#25D366' },
                        '&.Mui-focused fieldset': { borderColor: '#25D366' },
                        '& .MuiInputBase-input': { fontSize: '13.5px', py: 1 }
                      }}
                    />

                    <Tooltip title="Grabar y enviar Nota de Voz de WhatsApp">
                      <span>
                        <IconButton
                          onClick={handleIniciarGrabacionVoz}
                          disabled={isSending || enviandoNotaVoz}
                          sx={{
                            bgcolor: '#ffffff',
                            color: '#0f766e',
                            border: '1px solid #cbd5e1',
                            p: 1.1,
                            '&:hover': { bgcolor: '#f0fdf4', borderColor: '#25D366' }
                          }}
                        >
                          {enviandoNotaVoz ? <CircularProgress size={18} color="inherit" /> : <Mic size={18} />}
                        </IconButton>
                      </span>
                    </Tooltip>

                    <IconButton 
                      onClick={() => handleSendMessage()}
                      disabled={!mensajeTexto.trim() || isSending || enviandoNotaVoz}
                      sx={{ 
                        bgcolor: mensajeTexto.trim() ? '#25D366' : '#e2e8f0', 
                        color: mensajeTexto.trim() ? 'white' : '#94a3b8', 
                        p: 1.2,
                        '&:hover': { bgcolor: mensajeTexto.trim() ? '#20bd5a' : '#e2e8f0' } 
                      }}
                    >
                      {isSending ? <CircularProgress size={20} color="inherit" /> : <Send size={18} />}
                    </IconButton>
                  </>
                )}
              </Box>
            </>
          ) : (
            /* Estado Inicial cuando no se ha seleccionado chat */
            <Box sx={{ 
              flexGrow: 1, 
              display: 'flex', 
              flexDirection: 'column', 
              justifyContent: 'center', 
              alignItems: 'center', 
              p: 4, 
              textAlign: 'center',
              bgcolor: '#f8fafc' 
            }}>
              <Box sx={{ 
                bgcolor: '#ffffff', 
                p: 3, 
                borderRadius: '50%', 
                mb: 2.5, 
                boxShadow: '0 8px 24px rgba(37,211,102,0.15)',
                border: '1px solid #dcfce7'
              }}>
                <MessageCircle size={54} color="#25D366" />
              </Box>
              <Typography variant="h6" color="#1e293b" fontWeight="700" gutterBottom>
                Bandeja Multi-Usuario de WhatsApp Business
              </Typography>
              <Typography variant="body2" color="#64748b" sx={{ maxWidth: 460, mb: 3, lineHeight: 1.6 }}>
                Todos los operadores autorizados de IIRESODH pueden responder consultas simultáneamente desde el número institucional oficial.
              </Typography>
              <Button 
                variant="contained" 
                startIcon={<Plus size={16} />}
                onClick={() => setOpenNuevoChatModal(true)}
                sx={{ 
                  bgcolor: '#25D366', 
                  color: 'white', 
                  textTransform: 'none', 
                  fontWeight: 600,
                  boxShadow: 'none',
                  '&:hover': { bgcolor: '#20bd5a' } 
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
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#b91c1c', fontWeight: 700 }}>
          <AlertTriangle size={22} color="#dc2626" />
          Eliminar Conversación
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography variant="body2" color="#334155" sx={{ mb: 2 }}>
            ¿Estás seguro de que deseas eliminar permanentemente la conversación con{' '}
            <strong>{(chatAEliminar || selectedChat)?.nombre || `+${(chatAEliminar || selectedChat)?.telefono}`}</strong>?
          </Typography>
          <Alert severity="warning" sx={{ fontSize: '12px' }}>
            Esta acción borrará el contacto de la bandeja y todo su historial de mensajes. Este movimiento quedará registrado con tu cuenta en los <strong>Logs de Auditoría</strong>.
          </Alert>
        </DialogContent>
        <DialogActions sx={{ p: 2, bgcolor: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
          <Button 
            onClick={() => {
              setOpenDeleteChatModal(false);
              setChatAEliminar(null);
            }} 
            disabled={eliminandoChat}
            sx={{ textTransform: 'none', color: '#64748b' }}
          >
            Cancelar
          </Button>
          <Button 
            variant="contained" 
            color="error"
            onClick={handleEliminarChat}
            disabled={eliminandoChat}
            startIcon={eliminandoChat ? <CircularProgress size={14} color="inherit" /> : <Trash2 size={16} />}
            sx={{ textTransform: 'none', fontWeight: 600, bgcolor: '#dc2626', '&:hover': { bgcolor: '#b91c1c' } }}
          >
            {eliminandoChat ? 'Eliminando...' : 'Eliminar Conversación'}
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
      >
        <DialogTitle sx={{ fontWeight: 700, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 1 }}>
          <Key size={20} color="#0f766e" /> Configuración de WhatsApp Cloud API (Meta)
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <Typography variant="body2" color="#475569" sx={{ mb: 3 }}>
            Todo el código y la arquitectura están listos. En cuanto tengas los datos de tu aplicación en <strong>developers.facebook.com</strong>, pégalos aquí para habilitar los envíos en tiempo real:
          </Typography>

          {/* DATOS QUE DEBES COPIAR EN META */}
          <Box sx={{ bgcolor: '#f0fdf4', p: 2, borderRadius: 2, border: '1px solid #bbf7d0', mb: 3 }}>
            <Typography variant="subtitle2" fontWeight="700" color="#166534" gutterBottom>
              📋 Datos para registrar en tu Webhook de Meta:
            </Typography>
            
            <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Box>
                <Typography variant="caption" fontWeight="600" color="#15803d">URL de devolución de llamada (Callback URL):</Typography>
                <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                  <TextField 
                    size="small" 
                    fullWidth 
                    value={WEBHOOK_CALLBACK_URL} 
                    InputProps={{ readOnly: true, sx: { fontSize: '12px', bgcolor: 'white' } }} 
                  />
                  <Button 
                    variant="outlined" 
                    size="small" 
                    startIcon={<Copy size={14} />} 
                    onClick={() => copiarAlPortapapeles(WEBHOOK_CALLBACK_URL, 'url')}
                    sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}
                  >
                    {copiadoCampo === 'url' ? '¡Copiado!' : 'Copiar'}
                  </Button>
                </Box>
              </Box>

              <Box>
                <Typography variant="caption" fontWeight="600" color="#15803d">Token de verificación (Verify Token):</Typography>
                <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                  <TextField 
                    size="small" 
                    fullWidth 
                    value={metaConfig.verify_token || DEFAULT_VERIFY_TOKEN} 
                    InputProps={{ readOnly: true, sx: { fontSize: '12px', bgcolor: 'white' } }} 
                  />
                  <Button 
                    variant="outlined" 
                    size="small" 
                    startIcon={<Copy size={14} />} 
                    onClick={() => copiarAlPortapapeles(metaConfig.verify_token || DEFAULT_VERIFY_TOKEN, 'token')}
                    sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}
                  >
                    {copiadoCampo === 'token' ? '¡Copiado!' : 'Copiar'}
                  </Button>
                </Box>
              </Box>
            </Box>
          </Box>

          {/* DATOS QUE META TE ENTREGA */}
          <Typography variant="subtitle2" fontWeight="700" color="#1e293b" gutterBottom>
            🔑 Llaves generadas en Meta for Developers:
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1.5 }}>
            <TextField
              label="Identificador de número de teléfono (Phone Number ID)"
              fullWidth
              size="small"
              placeholder="Ej. 104829384729102"
              value={metaConfig.phone_number_id}
              onChange={(e) => setMetaConfig(prev => ({ ...prev, phone_number_id: e.target.value }))}
              helperText="Lo encuentras en Meta Developers > WhatsApp > Primeros pasos o Números de teléfono"
            />

            <TextField
              label="Token de Acceso Permanente (WhatsApp Access Token / System User)"
              fullWidth
              multiline
              rows={2}
              size="small"
              placeholder="Ej. EAAQ..."
              value={metaConfig.whatsapp_token}
              onChange={(e) => setMetaConfig(prev => ({ ...prev, whatsapp_token: e.target.value }))}
              helperText="⚠️ Para que nunca expire, debe ser un Token de Usuario del Sistema (System User) con permisos 'whatsapp_business_messaging' y caducidad 'Nunca'."
            />

            <TextField
              label="ID de Cuenta de WhatsApp Business (WABA ID - Opcional)"
              fullWidth
              size="small"
              placeholder="Ej. 102938481920394"
              value={metaConfig.waba_id}
              onChange={(e) => setMetaConfig(prev => ({ ...prev, waba_id: e.target.value }))}
            />

            {/* BOTÓN PROBAR CONEXIÓN EN VIVO */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 0.5 }}>
              <Button
                variant="outlined"
                size="small"
                onClick={handleProbarConexion}
                disabled={probandoConexion || !metaConfig.whatsapp_token?.trim()}
                startIcon={probandoConexion ? <CircularProgress size={14} /> : <RefreshCw size={14} />}
                sx={{ textTransform: 'none', color: '#0f766e', borderColor: '#0f766e', fontWeight: 600 }}
              >
                {probandoConexion ? 'Comprobando en Meta...' : '🔍 Probar Conexión con Meta'}
              </Button>
              <Typography variant="caption" color="text.secondary">
                Verifica en vivo si el token es válido o si expiró antes de guardar.
              </Typography>
            </Box>

            {resultadoPrueba && (
              <Alert 
                severity={resultadoPrueba.exito ? 'success' : 'error'}
                onClose={() => setResultadoPrueba(null)}
                sx={{ fontSize: '12px', mt: 0.5 }}
              >
                {resultadoPrueba.mensaje}
              </Alert>
            )}

            {/* GUÍA RÁPIDA DE TOKEN PERMANENTE */}
            <Box sx={{ mt: 1, p: 1.5, bgcolor: '#f8fafc', borderRadius: 1.5, border: '1px dashed #cbd5e1' }}>
              <Typography variant="caption" fontWeight="600" color="#475569" sx={{ display: 'block', mb: 0.5 }}>
                📌 ¿Dónde generar el token permanente para que no vuelva a expirar?
              </Typography>
              <Typography variant="caption" color="#64748b" sx={{ display: 'block', lineHeight: 1.5 }}>
                1. Abre <strong>Meta Business Suite</strong> &gt; Configuración del Negocio &gt; <em>Usuarios del Sistema</em>.<br />
                2. Crea un usuario con rol Administrador y añade tu App de WhatsApp con Control total.<br />
                3. Haz clic en <strong>Generar nuevo token</strong> con caducidad <strong>"Nunca"</strong> y permisos <code>whatsapp_business_messaging</code> y <code>whatsapp_business_management</code>.
              </Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, bgcolor: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
          <Button onClick={() => setOpenConfigModal(false)} sx={{ textTransform: 'none', color: '#64748b' }}>
            Cancelar
          </Button>
          <Button 
            variant="contained" 
            onClick={handleGuardarConfigMeta}
            disabled={guardandoConfig}
            sx={{ bgcolor: '#0f766e', textTransform: 'none', fontWeight: 600, '&:hover': { bgcolor: '#115e59' } }}
          >
            {guardandoConfig ? 'Guardando...' : 'Guardar y Activar API'}
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
      >
        <DialogTitle sx={{ fontWeight: 700, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
          💬 Iniciar Nueva Conversación
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <Alert severity="info" sx={{ mb: 2.5, fontSize: '12.5px', borderRadius: 2 }}>
            <strong>Regla de Ventana de 24h de Meta WhatsApp API:</strong> Si el contacto <strong>no</strong> ha escrito primero a IIRESODH en las últimas 24 horas, Meta bloquea los mensajes de texto libre (Error 131047) y exige iniciar con una <strong>Plantilla Aprobada</strong>. En cuanto la persona responda, se habilita el chat libre por 24 horas.
          </Alert>

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
                  ? '✅ Plantilla en español "aviso_institucional_iiresodh" APROBADA en Meta.'
                  : '⏳ Plantilla en español "aviso_institucional_iiresodh" en revisión automática de Meta (PENDING). Mientras se aprueba, el modo automático usa la plantilla aprobada de Meta para garantizar la entrega.'
              }
            >
              <MenuItem value="auto">
                📋 Plantilla Oficial de Apertura (Garantiza entrega fuera de ventana de 24h)
              </MenuItem>
              <MenuItem value="texto_libre">
                💬 Texto Libre Directo (Solo llega si el contacto ya escribió hace menos de 24h)
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
        <DialogActions sx={{ p: 2, bgcolor: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
          <Button onClick={() => setOpenNuevoChatModal(false)} sx={{ textTransform: 'none', color: '#64748b' }}>
            Cancelar
          </Button>
          <Button 
            variant="contained" 
            onClick={handleCrearNuevoChat}
            disabled={!nuevoTelefono.trim() || isSending}
            sx={{ bgcolor: '#25D366', textTransform: 'none', fontWeight: 600, '&:hover': { bgcolor: '#20bd5a' } }}
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
      >
        <DialogTitle sx={{ fontWeight: 700, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
          ✏️ Nombre del Contacto
        </DialogTitle>
        <DialogContent sx={{ p: 2.5 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
            Asigna un nombre descriptivo para identificar a este contacto en la bandeja de entrada multiusuario.
          </Typography>
          <TextField
            label="Nombre"
            fullWidth
            size="small"
            value={editNombreContacto}
            onChange={(e) => setEditNombreContacto(e.target.value)}
            autoFocus
          />
        </DialogContent>
        <DialogActions sx={{ p: 2, bgcolor: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
          <Button onClick={() => setOpenEditContactoModal(false)} sx={{ textTransform: 'none' }}>
            Cancelar
          </Button>
          <Button 
            variant="contained" 
            onClick={handleGuardarNombreContacto}
            sx={{ bgcolor: '#0f766e', textTransform: 'none' }}
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
        PaperProps={{ sx: { width: 340, maxHeight: 380, p: 0.5 } }}
      >
        <Box sx={{ px: 2, py: 1, borderBottom: '1px solid #f1f5f9' }}>
          <Typography variant="caption" fontWeight="700" color="#64748b">
            RESPUESTAS RÁPIDAS INSTITUCIONALES
          </Typography>
        </Box>
        {RESPUESTAS_RAPIDAS.map((item, idx) => (
          <MenuItem 
            key={idx} 
            onClick={() => handleSeleccionarRespuestaRapida(item.texto)}
            sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', py: 1, whiteSpace: 'normal' }}
          >
            <Typography variant="subtitle2" fontWeight="700" color="#0f766e" sx={{ fontSize: '12px' }}>
              {item.titulo}
            </Typography>
            <Typography variant="caption" color="#475569" sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {item.texto}
            </Typography>
          </MenuItem>
        ))}
      </Menu>

    </Box>
  );
}