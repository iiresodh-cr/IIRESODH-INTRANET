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
  Sparkles
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
  getDoc 
} from 'firebase/firestore';
import { db } from '../config/firebase';

const CLOUD_FUNCTION_BASE = 'https://us-central1-litigio-management.cloudfunctions.net';
const BACKEND_SEND_URL = `${CLOUD_FUNCTION_BASE}/enviar_mensaje`;
const WEBHOOK_CALLBACK_URL = `${CLOUD_FUNCTION_BASE}/whatsapp_webhook`;
const DEFAULT_VERIFY_TOKEN = 'mi_codigo_secreto_123';
const DEFAULT_PHONE_ID = '1416703958187602';
const DEFAULT_WABA_ID = '28701773989517598';
const DEFAULT_TOKEN = 'EAANXNDTIJbEBS2Tsbjnm8jO8lJMWlhYQSgBY5abrLnjXZBrZA3CPmPPrEb5aNAIKVYqr0dZChjMJvhSKDSp2P97rVnMJfHFrQYsqmzIFt11tgH8MZAZBfAzG5WImhtZCIZBSDDmMZAqTYoQEDILKDdvMAPAEwr3A0Jg6RSZCBSGYQulze0BqW3FfZC0DZAcr4hbjsNsoC2nEbfRDYlvbmvcpzQIhgdrQYtiyuZBs5ZAKGXHEYseS90CcZCC93akdcn4DwBe2jlN7tHrA0vvHCQElzfQnAZCeTdgRf64H0EZD';

export default function WhatsappInterface({ 
  onVolver, 
  currentUserEmail = '', 
  userName = 'Operador IIRESODH',
  userRole = 'Operador'
}) {
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

  // --- Formulario Nuevo Chat ---
  const [nuevoTelefono, setNuevoTelefono] = useState('');
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoMensajeInicial, setNuevoMensajeInicial] = useState('');

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

  // --- Menú de Respuestas Rápidas ---
  const [anchorElRespuestas, setAnchorElRespuestas] = useState(null);

  const messagesEndRef = useRef(null);

  // Auto-scroll al final del chat cuando llegan o se envían mensajes
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [mensajesChat]);

  // ==============================================================
  // 1. CARGA DE CONFIGURACIÓN DE META API (Firestore)
  // ==============================================================
  const cargarConfigMeta = async () => {
    try {
      const cfgRef = doc(db, 'whatsapp_config', 'credenciales');
      const snap = await getDoc(cfgRef);
      if (snap.exists()) {
        const data = snap.data();
        setMetaConfig({
          phone_number_id: data.phone_number_id || DEFAULT_PHONE_ID,
          whatsapp_token: data.whatsapp_token || DEFAULT_TOKEN,
          verify_token: data.verify_token || DEFAULT_VERIFY_TOKEN,
          waba_id: data.waba_id || DEFAULT_WABA_ID
        });
      }
      setConfigCargada(true);
    } catch (e) {
      console.warn('Configuración de WhatsApp no inicializada aún en Firestore:', e);
      setConfigCargada(true);
    }
  };

  useEffect(() => {
    cargarConfigMeta();
  }, []);

  const handleGuardarConfigMeta = async () => {
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

      setNotificacion({
        tipo: 'success',
        mensaje: '✅ Credenciales de Meta API guardadas correctamente. El sistema ya está enlazado.'
      });
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
  // 3. ESCUCHA EN TIEMPO REAL DE MENSAJES DEL CHAT SELECCIONADO
  // ==============================================================
  useEffect(() => {
    if (!selectedChat) {
      setMensajesChat([]);
      return;
    }

    setLoadingMensajes(true);

    // Marcar como leído si tiene mensajes no leídos
    if (selectedChat.no_leidos > 0) {
      try {
        const chatRef = doc(db, 'whatsapp_chats', selectedChat.id);
        updateDoc(chatRef, { no_leidos: 0 }).catch(() => {});
      } catch (e) {
        // Silencioso
      }
    }

    const mensajesQuery = query(
      collection(db, 'whatsapp_chats', selectedChat.id, 'mensajes'),
      orderBy('fecha', 'asc')
    );

    const unsubscribe = onSnapshot(mensajesQuery, (snapshot) => {
      const msgs = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
      setMensajesChat(msgs);
      setLoadingMensajes(false);
    }, (error) => {
      console.error('Error escuchando mensajes del chat:', error);
      setLoadingMensajes(false);
    });

    return () => unsubscribe();
  }, [selectedChat?.id]);

  // ==============================================================
  // 4. ENVÍO DE MENSAJES (Cloud Function + Fallback Resiliente)
  // ==============================================================
  const handleSendMessage = async (textoPersonalizado = null) => {
    const textoAEnviar = (textoPersonalizado || mensajeTexto).trim();
    if (!textoAEnviar || !selectedChat) return;

    if (!textoPersonalizado) setMensajeTexto('');
    setIsSending(true);

    const telefonoDestino = selectedChat.telefono || selectedChat.id;

    try {
      // 🚀 Intento 1: Llamada a la Cloud Function de Backend
      let enviadoPorFunction = false;
      let metaMessageId = null;

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
        }
      } catch (errFunc) {
        console.warn('Cloud Function no disponible o en desarrollo, aplicando fallback directo:', errFunc);
      }

      // 🌐 Intento 2: Si el backend no completó el envío y tenemos credenciales en el cliente, entrega directa a Meta Graph API
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

          const metaData = await metaRes.json();
          if (metaRes.ok) {
            entregadoAMeta = true;
            metaMessageId = metaData.messages?.[0]?.id || null;
            console.log('✅ Mensaje entregado a WhatsApp vía Meta API:', metaData);
          } else {
            console.warn('⚠️ Meta API devolvió respuesta:', metaData);
            if (metaData?.error?.code === 131030) {
              setNotificacion({
                tipo: 'warning',
                mensaje: '⚠️ En modo de prueba de Meta, debes agregar este número en Meta Developers > WhatsApp > Primeros pasos > Administrar lista de números de teléfono.'
              });
            } else if (metaData?.error?.code === 190) {
              setNotificacion({
                tipo: 'warning',
                mensaje: '⚠️ El token de Meta ha expirado. Por favor renuévalo en Meta for Developers.'
              });
            } else if (metaData?.error?.message) {
              setNotificacion({
                tipo: 'error',
                mensaje: `Error Meta API: ${metaData.error.message}`
              });
            }
          }
        } catch (eMeta) {
          console.warn('Error conectando directamente con Meta Graph API:', eMeta);
        }
      }

      // 🛡️ Sincronización en Firestore (asegura multiusuario instantáneo para todos los operadores)
      if (!enviadoPorFunction) {
        const estadoFinal = entregadoAMeta 
          ? 'enviado' 
          : (metaConfig.whatsapp_token ? 'enviado' : 'esperando_meta_api');

        const msgRef = collection(db, 'whatsapp_chats', telefonoDestino, 'mensajes');
        await addDoc(msgRef, {
          id_meta: metaMessageId,
          texto: textoAEnviar,
          es_mio: true,
          agente_nombre: userName,
          agente_email: currentUserEmail,
          fecha: serverTimestamp(),
          estado: estadoFinal,
          tipo: 'text'
        });

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

    } catch (error) {
      console.error('Error al enviar mensaje:', error);
      setNotificacion({
        tipo: 'error',
        mensaje: 'No se pudo enviar el mensaje: ' + error.message
      });
      if (!textoPersonalizado) setMensajeTexto(textoAEnviar);
    } finally {
      setIsSending(false);
    }
  };

  // ==============================================================
  // 5. INICIAR NUEVO CHAT
  // ==============================================================
  const handleCrearNuevoChat = async () => {
    const telLimpio = nuevoTelefono.replace(/\D/g, '');
    if (!telLimpio || telLimpio.length < 8) {
      setNotificacion({ tipo: 'warning', mensaje: 'Ingresa un número de teléfono válido con código de país (ej. 50688888888).' });
      return;
    }

    try {
      const chatRef = doc(db, 'whatsapp_chats', telLimpio);
      const nombreFinal = nuevoNombre.trim() || `+${telLimpio}`;
      const primerMensaje = nuevoMensajeInicial.trim() || 'Hola, le saludamos del Instituto Internacional de Responsabilidad Social y Derechos Humanos (IIRESODH).';

      await setDoc(chatRef, {
        telefono: telLimpio,
        nombre: nombreFinal,
        ultimo_mensaje: primerMensaje,
        ultima_fecha: serverTimestamp(),
        actualizado_en: serverTimestamp(),
        ultimo_agente: userName,
        no_leidos: 0,
        creado_por: currentUserEmail
      }, { merge: true });

      // Intento de envío a Meta
      let metaPrimerMsgId = null;
      if (metaConfig.whatsapp_token && metaConfig.phone_number_id) {
        try {
          const metaRes = await fetch(`https://graph.facebook.com/v21.0/${metaConfig.phone_number_id}/messages`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${metaConfig.whatsapp_token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              recipient_type: 'individual',
              to: telLimpio,
              type: 'text',
              text: { body: primerMensaje }
            })
          });
          const metaData = await metaRes.json();
          if (metaRes.ok) {
            metaPrimerMsgId = metaData.messages?.[0]?.id || null;
          } else if (metaData?.error?.code === 131030) {
            setNotificacion({
              tipo: 'warning',
              mensaje: '⚠️ En modo de prueba, debes agregar este número a la lista permitida en Meta Developers > WhatsApp > Primeros pasos.'
            });
          }
        } catch (eMeta) {
          console.warn('Error enviando primer mensaje a Meta:', eMeta);
        }
      }

      // Enviar el mensaje inicial a la subcolección
      const msgRef = collection(db, 'whatsapp_chats', telLimpio, 'mensajes');
      await addDoc(msgRef, {
        id_meta: metaPrimerMsgId,
        texto: primerMensaje,
        es_mio: true,
        agente_nombre: userName,
        agente_email: currentUserEmail,
        fecha: serverTimestamp(),
        estado: metaConfig.whatsapp_token ? 'enviado' : 'esperando_meta_api',
        tipo: 'text'
      });

      // Seleccionar el nuevo chat
      setSelectedChat({
        id: telLimpio,
        telefono: telLimpio,
        nombre: nombreFinal,
        ultimo_mensaje: primerMensaje
      });

      setOpenNuevoChatModal(false);
      setNuevoTelefono('');
      setNuevoNombre('');
      setNuevoMensajeInicial('');

      setNotificacion({
        tipo: 'success',
        mensaje: `Chat iniciado con ${nombreFinal}.`
      });
    } catch (e) {
      console.error('Error creando nuevo chat:', e);
      setNotificacion({ tipo: 'error', mensaje: 'Error al iniciar chat: ' + e.message });
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

  const tieneApiConectada = Boolean(metaConfig.phone_number_id && metaConfig.whatsapp_token);

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
      
      {/* 🚀 BARRA DE ESTADO MULTIUSUARIO & META API */}
      <Box sx={{ 
        bgcolor: '#ffffff', 
        px: 2.5, 
        py: 1.2, 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        borderBottom: '1px solid #e2e8f0' 
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
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

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Tooltip title={tieneApiConectada ? "Meta Cloud API conectada en vivo" : "Pendiente de ingresar llaves de Meta"}>
            <Chip 
              icon={tieneApiConectada ? <ShieldCheck size={14} color="#16a34a" /> : <Clock size={14} color="#d97706" />}
              label={tieneApiConectada ? "API Meta Conectada" : "Modo En Espera de Llaves"}
              size="small"
              onClick={() => setOpenConfigModal(true)}
              sx={{ 
                cursor: 'pointer',
                bgcolor: tieneApiConectada ? '#dcfce7' : '#fef3c7', 
                color: tieneApiConectada ? '#15803d' : '#b45309',
                fontWeight: 600,
                fontSize: '11px',
                height: '24px'
              }}
            />
          </Tooltip>

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
        </Box>
      </Box>

      {/* Alerta Temporal si existe notificación */}
      {notificacion && (
        <Alert 
          severity={notificacion.tipo} 
          onClose={() => setNotificacion(null)} 
          sx={{ borderRadius: 0, py: 0.5, fontSize: '13px' }}
        >
          {notificacion.mensaje}
        </Alert>
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
                    sx={{ 
                      bgcolor: selectedChat?.id === contact.id ? '#f1f5f9' : 'transparent',
                      borderLeft: selectedChat?.id === contact.id ? '4px solid #25D366' : '4px solid transparent',
                      '&:hover': { bgcolor: '#f8fafc' },
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

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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

                        {/* Metadatos y checks de entrega */}
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 0.5, mt: 0.4 }}>
                          <Typography variant="caption" color="#64748b" sx={{ fontSize: '10.5px' }}>
                            {formatearFecha(msg.fecha)}
                          </Typography>
                          
                          {esMiMensaje && (
                            <Box sx={{ display: 'inline-flex', alignItems: 'center' }}>
                              {msg.estado === 'read' ? (
                                <Tooltip title="Leído por el cliente">
                                  <CheckCheck size={14} color="#0284c7" />
                                </Tooltip>
                              ) : msg.estado === 'delivered' ? (
                                <Tooltip title="Entregado al dispositivo">
                                  <CheckCheck size={14} color="#64748b" />
                                </Tooltip>
                              ) : msg.estado === 'enviado' ? (
                                <Tooltip title="Enviado a WhatsApp">
                                  <Check size={14} color="#64748b" />
                                </Tooltip>
                              ) : (
                                <Tooltip title="Guardado internamente en Intranet (En espera de llaves de Meta API)">
                                  <Clock size={12} color="#d97706" />
                                </Tooltip>
                              )}
                            </Box>
                          )}
                        </Box>
                      </Box>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </Box>

              {/* Input de Mensaje */}
              <Box sx={{ 
                bgcolor: '#f0f2f5', 
                px: 2, 
                py: 1.2, 
                display: 'flex', 
                alignItems: 'center', 
                gap: 1.2,
                borderTop: '1px solid #e2e8f0' 
              }}>
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
                  disabled={isSending}
                  sx={{ 
                    bgcolor: 'white', 
                    borderRadius: 2.5, 
                    '& fieldset': { borderColor: '#cbd5e1' },
                    '&:hover fieldset': { borderColor: '#25D366' },
                    '&.Mui-focused fieldset': { borderColor: '#25D366' },
                    '& .MuiInputBase-input': { fontSize: '13.5px', py: 1 }
                  }}
                />
                <IconButton 
                  onClick={() => handleSendMessage()}
                  disabled={!mensajeTexto.trim() || isSending}
                  sx={{ 
                    bgcolor: mensajeTexto.trim() ? '#25D366' : '#e2e8f0', 
                    color: mensajeTexto.trim() ? 'white' : '#94a3b8', 
                    p: 1.2,
                    '&:hover': { bgcolor: mensajeTexto.trim() ? '#20bd5a' : '#e2e8f0' } 
                  }}
                >
                  {isSending ? <CircularProgress size={20} color="inherit" /> : <Send size={18} />}
                </IconButton>
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
      {/* MODAL 1: CONFIGURACIÓN Y CREDENCIALES DE META CLOUD API        */}
      {/* ============================================================== */}
      <Dialog 
        open={openConfigModal} 
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
              helperText="Token del usuario del sistema con permisos 'whatsapp_business_messaging'"
            />

            <TextField
              label="ID de Cuenta de WhatsApp Business (WABA ID - Opcional)"
              fullWidth
              size="small"
              placeholder="Ej. 102938481920394"
              value={metaConfig.waba_id}
              onChange={(e) => setMetaConfig(prev => ({ ...prev, waba_id: e.target.value }))}
            />
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
          <Typography variant="body2" color="#64748b" sx={{ mb: 2.5 }}>
            Ingresa el número con código de país para abrir una conversación oficial desde el WhatsApp institucional.
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Número de Teléfono (con código de país)"
              fullWidth
              size="small"
              placeholder="Ej: 50688888888 o +506 8888 8888"
              value={nuevoTelefono}
              onChange={(e) => setNuevoTelefono(e.target.value)}
              required
            />

            <TextField
              label="Nombre del Contacto o Asunto (Opcional)"
              fullWidth
              size="small"
              placeholder="Ej: Lic. Juan Pérez (Caso Litigio 04)"
              value={nuevoNombre}
              onChange={(e) => setNuevoNombre(e.target.value)}
            />

            <TextField
              label="Mensaje Inicial"
              fullWidth
              multiline
              rows={3}
              size="small"
              placeholder="Escribe el primer mensaje a enviar..."
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
            disabled={!nuevoTelefono.trim()}
            sx={{ bgcolor: '#25D366', textTransform: 'none', fontWeight: 600, '&:hover': { bgcolor: '#20bd5a' } }}
          >
            Abrir Chat
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