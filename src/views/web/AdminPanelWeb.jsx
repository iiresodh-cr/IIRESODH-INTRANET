import React, { useState, useEffect, useRef } from "react";
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged 
} from "firebase/auth";
import { 
  webAuth as auth, 
  webDb as db, 
  webStorage as storage, 
  webFunctions as functions 
} from "../../config/firebaseWeb";
import { 
  collection, 
  addDoc, 
  updateDoc, 
  serverTimestamp, 
  doc, 
  deleteDoc, 
  getDocs, 
  query, 
  orderBy, 
  Timestamp, 
  limit, 
  startAfter, 
  where, 
  setDoc, 
  getDoc 
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { httpsCallable } from "firebase/functions";

import AdminTextField from "./components/AdminTextField";
import ConfirmDialog from "./components/ConfirmDialog";
import ToastAlert from "./components/ToastAlert";
import RichTextEditor from "./components/RichTextEditor";
import "./webAdmin.css";

import { 
  Button, 
  Checkbox, 
  FormControlLabel, 
  Box, 
  Chip, 
  Select, 
  MenuItem, 
  FormControl, 
  InputLabel, 
  CircularProgress,
  Typography,
  Paper,
  Alert
} from "@mui/material";
import { 
  ArrowLeft, 
  Globe, 
  LogIn, 
  LogOut, 
  ShieldCheck, 
  ExternalLink,
  Sparkles,
  Image as ImageIcon,
  Search,
  BarChart3
} from "lucide-react";

const generarSlug = (texto) => {
  if (!texto) return `item-${Math.random().toString(36).substring(2, 6)}`;
  
  const baseSlug = texto
    .toString()
    .normalize('NFD') 
    .replace(/[\u0300-\u036f]/g, '') 
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') 
    .replace(/[\s_-]+/g, '-') 
    .replace(/^-+|-+$/g, ''); 
  
  const randomCode = Math.random().toString(36).substring(2, 6);
  return baseSlug ? `${baseSlug}-${randomCode}` : `item-${randomCode}`;
};

export const formatearTextoConLinksYHashtags = (texto, idiomaActual = 'es') => {
  if (!texto) return "";

  const lang = (idiomaActual || 'es').substring(0, 2).toLowerCase();
  const labelClic = lang === 'en' ? 'Click here' : (lang === 'fr' ? 'Cliquez ici' : 'Clic aquí');

  // Decodificar entidades de comillas y apóstrofes generadas por traductores automáticos o editores
  let procesado = String(texto)
    .replace(/&(?:#39|#039|#x27|apos);/gi, "'")
    .replace(/&(?:quot|#34|#034);/gi, '"')
    .replace(/&amp;#39;/gi, "'")
    .replace(/&amp;apos;/gi, "'")
    .replace(/&amp;quot;/gi, '"');

  const esHtml = /<\/?(p|div|h[1-6]|strong|b|em|i|blockquote|ul|ol|li|br|span|a|iframe|video|img|font)[^>]*>/i.test(procesado);

  if (!esHtml) {
    procesado = procesado.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  } else {
    procesado = procesado
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/\bon\w+\s*=\s*(['"]).*?\1/gi, "")
      .replace(/\bon\w+\s*=\s*[^>\s]+/gi, "")
      .replace(/javascript:/gi, "");
  }

  const tokens = [];

  // 1. Procesar y proteger enlaces <a> existentes completos
  procesado = procesado.replace(/<a\s+([^>]*?)>([\s\S]*?)<\/a>/gi, (match, attrs, innerText) => {
    const textOnly = innerText.replace(/<[^>]+>/g, '').trim().toLowerCase();
    const isUrl = /^https?:\/\//i.test(textOnly);
    const isClicGeneric = ['clic aquí', 'clic aqui', 'click here', 'cliquez ici'].includes(textOnly);

    let newInner = innerText;
    if (isUrl || isClicGeneric) {
      newInner = labelClic;
    }

    const hrefMatch = attrs.match(/href=(["'])(.*?)\1/i);
    const href = hrefMatch ? hrefMatch[2] : '#';

    const formatted = `<a href="${href}" target="_blank" rel="noopener noreferrer" class="text-main-red font-bold underline wrap-break-words">${newInner}</a>`;
    tokens.push(formatted);
    return `\uE000${tokens.length - 1}\uE001`;
  });

  // 2. Proteger todas las demás etiquetas HTML (img, div, b, span, etc.)
  procesado = procesado.replace(/<[^>]+>/g, (match) => {
    tokens.push(match);
    return `\uE000${tokens.length - 1}\uE001`;
  });

  // 3. Procesar Markdown: [Texto visible](URL)
  procesado = procesado.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (match, label, url) => {
    const link = `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-main-red font-bold underline wrap-break-words">${label}</a>`;
    tokens.push(link);
    return `\uE000${tokens.length - 1}\uE001`;
  });

  // 4. Procesar URLs crudas pegadas en el texto
  procesado = procesado.replace(/(https?:\/\/[^\s<>"'`\uE000\uE001]+)/g, (match, url) => {
    let cleanUrl = url;
    let suffix = '';
    const trailingPunct = /[.,;:)!]+$/;
    const punctMatch = cleanUrl.match(trailingPunct);
    if (punctMatch) {
      suffix = punctMatch[0];
      cleanUrl = cleanUrl.slice(0, -punctMatch[0].length);
    }
    const link = `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer" class="text-main-red font-bold underline wrap-break-words">${labelClic}</a>${suffix}`;
    tokens.push(link);
    return `\uE000${tokens.length - 1}\uE001`;
  });

  // 5. Procesar Hashtags (debe comenzar con letra y nunca estar precedido por & ni letras/números)
  procesado = procesado.replace(/(^|[^\w&])#([a-zA-ZáéíóúÁÉÍÓÚñÑ][a-zA-Z0-9_áéíóúÁÉÍÓÚñÑ]*)/g, (match, prefix, term) => {
    const link = `<a href="https://iiresodh.org/buscar?q=${term}" target="_blank" rel="noopener noreferrer" class="text-light-blue hover:text-main-red font-bold">#${term}</a>`;
    tokens.push(link);
    return `${prefix}\uE000${tokens.length - 1}\uE001`;
  });

  // 6. Restaurar todos los tokens protegidos
  procesado = procesado.replace(/\uE000(\d+)\uE001/g, (_, index) => tokens[Number(index)]);

  // 7. Si no era HTML originalmente, convertir saltos de línea a párrafos
  if (!esHtml) {
    const parrafos = procesado.split(/\n\s*\n/);
    return parrafos.map(p => `<p>${p.replace(/\n/g, '<br />')}</p>`).join('');
  }

  return procesado;
};

const convertirAWebp = (file, calidad = 0.8) => {
  return new Promise((resolve, reject) => {
    if (file.type === 'image/webp' || file.type === 'image/gif' || file.type === 'image/svg+xml') {
      resolve(file);
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((blob) => {
          if (blob) {
            const nuevoNombre = file.name.replace(/\.[^/.]+$/, "") + ".webp";
            const webpFile = new File([blob], nuevoNombre, { type: 'image/webp' });
            resolve(webpFile);
          } else {
            reject(new Error("Error al convertir la imagen a WebP"));
          }
        }, 'image/webp', calidad);
      };
      img.onerror = () => reject(new Error("Error al cargar la imagen"));
      img.src = event.target.result;
    };
    reader.onerror = () => reject(new Error("Error al leer el archivo"));
    reader.readAsDataURL(file);
  });
};

const TAGS_DISPONIBLES = [
  "IIRESODH", "Noticia", "Comunicado", "Anuncio", "Artículo", "Canadá", "Colombia", "Costa Rica", 
  "Guatemala", "México", "Institucional", "Evento"
];

export default function AdminPanelWeb({ onVolver, currentUserEmail, userRole }) {
  // Estado de autenticación para la app secundaria (iiresodh-web)
  const [userWeb, setUserWeb] = useState(auth.currentUser);
  const [verificandoAuthWeb, setVerificandoAuthWeb] = useState(true);
  const [errorAuthWeb, setErrorAuthWeb] = useState("");
  const [conectandoWeb, setConectandoWeb] = useState(false);

  const [vistaActiva, setVistaActiva] = useState("inicio");

  const [misPermisos, setMisPermisos] = useState({
    comunicaciones: false,
    articulos: false,
    cursos: false,
    libros: false,
    equipo: false,
    informes: false,
    incidencia: false,
    estadisticas: false,
    adminWeb: false,
    auditoria: false
  });

  // Gestión de usuarios
  const [usuariosAdmins, setUsuariosAdmins] = useState([]);
  const [nuevoEmailAdmin, setNuevoEmailAdmin] = useState("");
  const [nuevoPermisos, setNuevoPermisos] = useState({
    comunicaciones: false,
    articulos: false,
    cursos: false,
    libros: false,
    equipo: false,
    informes: false,
    incidencia: false,
    estadisticas: false,
    adminWeb: false,
    auditoria: false
  });
  const [cargandoAdmins, setCargandoAdmins] = useState(false);

  const [titulo, setTitulo] = useState("");
  const [subtitulo, setSubtitulo] = useState("");
  const [resumen, setResumen] = useState("");
  const [contenido, setContenido] = useState("");
  const [fechaPersonalizada, setFechaPersonalizada] = useState(""); 
  const [videoUrl, setVideoUrl] = useState("");
  const [slugOriginal, setSlugOriginal] = useState("");
  const [slugsAnterioresOriginal, setSlugsAnterioresOriginal] = useState([]);

  // ESTADOS PARA EQUIPO
  const [nombre, setNombre] = useState("");
  const [cargo, setCargo] = useState("");
  const [bio, setBio] = useState("");
  const [destacado, setDestacado] = useState(false);
  const [orden, setOrden] = useState(0);
  const [pais, setPais] = useState("Costa Rica");

  // ESTADOS PARA LIBROS
  const [precio, setPrecio] = useState("");
  const [precioMXN, setPrecioMXN] = useState("");
  const [autor, setAutor] = useState(""); 
  const [archivoLibro, setArchivoLibro] = useState(null);
  const [archivoLibroNombre, setArchivoLibroNombre] = useState("");
  const [archivoLibroAnterior, setArchivoLibroAnterior] = useState(null);
  const [rutaStorageAnterior, setRutaStorageAnterior] = useState(null);

  // ESTADOS PARA INFORMES ANUALES
  const [año, setAño] = useState("");
  const [archivoInforme, setArchivoInforme] = useState(null);
  const [archivoInformeNombre, setArchivoInformeNombre] = useState("");
  const [archivoInformeAnterior, setArchivoInformeAnterior] = useState(null);

  // ESTADOS PARA INCIDENCIA
  const [archivoIncidencia, setArchivoIncidencia] = useState(null);
  const [archivoIncidenciaNombre, setArchivoIncidenciaNombre] = useState("");
  const [archivoIncidenciaAnterior, setArchivoIncidenciaAnterior] = useState(null);
  
  const [imagenPrincipal, setImagenPrincipal] = useState(null);
  const [mainImagePreviewUrl, setMainImagePreviewUrl] = useState(null);
  const [errorPortada, setErrorPortada] = useState(false);
  const [imagenesCarrusel, setImagenesCarrusel] = useState([]);
  
  const [editandoId, setEditandoId] = useState(null);
  const [imagenPrincipalAnterior, setImagenPrincipalAnterior] = useState(null); 
  const [carruselExistente, setCarruselExistente] = useState([]); 

  const [archivosAdjuntos, setArchivosAdjuntos] = useState([]);
  const [subiendoArchivo, setSubiendoArchivo] = useState(false);

  const [loading, setLoading] = useState(false);
  const [generandoResumen, setGenerandoResumen] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [listaItems, setListaItems] = useState([]);
  
  // ESTADOS PARA SCROLL INFINITO Y BÚSQUEDA
  const ITEMS_POR_PAGINA = 10;
  const [ultimoDoc, setUltimoDoc] = useState(null);
  const [hayMas, setHayMas] = useState(true);
  const [cargandoLista, setCargandoLista] = useState(false);
  const isFetching = useRef(false);
  const [busquedaTexto, setBusquedaTexto] = useState("");
  const [busquedaFecha, setBusquedaFecha] = useState("");

  // NUEVOS ESTADOS PARA CURSOS
  const [enlaceInscripcion, setEnlaceInscripcion] = useState("");
  const [cursoActivo, setCursoActivo] = useState(true);
  const [estadoInscripcion, setEstadoInscripcion] = useState("abierta");
  
  // ESTADOS PARA COMUNICACIONES
  const [tagsSeleccionados, setTagsSeleccionados] = useState([]);
  const [persistente, setPersistente] = useState(false);

  // ESTADOS PARA ADMINISTRACIÓN WEB
  const [actividades, setActividades] = useState([]);
  const [cargandoActividades, setCargandoActividades] = useState(false);
  const [usuariosUnicos, setUsuariosUnicos] = useState([]);
  const [filtroUsuario, setFiltroUsuario] = useState("todos");
  const [ordenActividad, setOrdenActividad] = useState("desc");

  // ESTADOS PARA PAGINACIÓN DE ACTIVIDADES
  const [ultimoDocActividad, setUltimoDocActividad] = useState(null);
  const [hayMasActividades, setHayMasActividades] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);
  const ACTIVIDADES_POR_PAGINA = 50;

  // ESTADOS PARA CONFIGURACIÓN VISUAL
  const [tituloHome, setTituloHome] = useState({
    tituloPrincipal: "",
    tituloPrincipal_en: "",
    tituloPrincipal_fr: ""
  });
  const [cargandoConfig, setCargandoConfig] = useState(false);
  const [guardandoConfig, setGuardandoConfig] = useState(false);

  const [modalBorrar, setModalBorrar] = useState({ isOpen: false, id: null, titulo: "" });

  // 1. Monitoreo de autenticación en la app secundaria de Firebase
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUserWeb(user);
      if (user) {
        await verificarYResolverPermisos(user);
      } else {
        setVerificandoAuthWeb(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const verificarYResolverPermisos = async (user) => {
    setVerificandoAuthWeb(true);
    setErrorAuthWeb("");
    const email = user.email.toLowerCase().trim();

    if (email === "webmaster@iiresodh.org") {
      setMisPermisos({
        comunicaciones: true,
        articulos: true,
        cursos: true,
        libros: true,
        equipo: true,
        informes: true,
        incidencia: true,
        estadisticas: true,
        adminWeb: true,
        auditoria: true
      });
      setVerificandoAuthWeb(false);
      return;
    }

    try {
      const docRef = doc(db, "admins", email);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.activo === true || data.active === true) {
          setMisPermisos({
            comunicaciones: data.permisos?.comunicaciones ?? false,
            articulos: data.permisos?.articulos ?? false,
            cursos: data.permisos?.cursos ?? false,
            libros: data.permisos?.libros ?? false,
            equipo: data.permisos?.equipo ?? false,
            informes: data.permisos?.informes ?? false,
            incidencia: data.permisos?.incidencia ?? false,
            estadisticas: data.permisos?.estadisticas ?? false,
            adminWeb: data.permisos?.adminWeb ?? false,
            auditoria: data.permisos?.auditoria ?? false,
          });
          setErrorAuthWeb("");
        } else {
          setErrorAuthWeb(`Tu cuenta (${email}) se encuentra suspendida en el panel del sitio web.`);
        }
      } else {
        setErrorAuthWeb(`El correo ${email} pertenece a la institución, pero aún no tiene permisos asignados en el administrador de la web. Solicita al Webmaster que autorice tu acceso.`);
      }
    } catch (err) {
      console.error("Error al verificar permisos en base de datos web:", err);
      setErrorAuthWeb("No se pudo conectar con la base de datos de la web para validar credenciales.");
    } finally {
      setVerificandoAuthWeb(false);
    }
  };

  const handleConectarWeb = async () => {
    setConectandoWeb(true);
    setErrorAuthWeb("");
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    try {
      const result = await signInWithPopup(auth, provider);
      const email = result.user.email.toLowerCase().trim();

      if (!email.endsWith("@iiresodh.org")) {
        await signOut(auth);
        setErrorAuthWeb("Acceso restringido: Solo se permiten cuentas institucionales de @iiresodh.org.");
        return;
      }

      await verificarYResolverPermisos(result.user);
    } catch (err) {
      console.error("Error al conectar credencial con iiresodh-web:", err);
      if (err.code !== 'auth/popup-closed-by-user') {
        setErrorAuthWeb("Hubo un problema al conectar con Google. Por favor reintente.");
      }
    } finally {
      setConectandoWeb(false);
    }
  };

  const handleDesconectarWeb = async () => {
    try {
      await signOut(auth);
      setUserWeb(null);
      setVistaActiva("inicio");
    } catch (e) {
      console.error("Error al desconectar de la web:", e);
    }
  };

  const logActividad = async (accion, detalles = null) => {
    const usuario = auth.currentUser;
    if (!usuario) return;

    try {
      const logData = {
        usuarioEmail: usuario.email,
        accion: accion,
        timestamp: serverTimestamp(),
      };
      if (detalles) {
        logData.detalles = detalles;
      }
      await addDoc(collection(db, "auditoria_actividad"), logData);
    } catch (error) {
      console.error("Error al registrar actividad:", error);
    }
  };

  const extraerNombreDesdeUrl = (url) => {
    if (!url) return "";
    try {
      const decodedUrl = decodeURIComponent(url);
      const urlParts = decodedUrl.split('?')[0].split('/');
      const fileNameWithTimestamp = urlParts[urlParts.length - 1];
      const nameParts = fileNameWithTimestamp.split('_');
      if (nameParts.length > 1) {
        return nameParts.slice(1).join('_');
      }
      return fileNameWithTimestamp;
    } catch (error) {
      return "Archivo existente";
    }
  };

  const cargarUsuariosUnicos = async () => {
    if (usuariosUnicos.length > 0) return;
    try {
      const q = query(collection(db, "auditoria_actividad"));
      const snapshot = await getDocs(q);
      const emails = new Set(snapshot.docs.map(doc => doc.data().usuarioEmail));
      setUsuariosUnicos(Array.from(emails).sort());
    } catch (error) {
      console.error("Error cargando lista de usuarios:", error);
    }
  };

  const cargarActividades = async (isLoadMore = false) => {
    if (!isLoadMore) {
      setCargandoActividades(true);
      setActividades([]); 
    } else {
      setCargandoMas(true);
    }
    setMensaje("Cargando registros de actividad...");

    try {
      const constraints = [orderBy("timestamp", ordenActividad)];
      if (filtroUsuario !== "todos") {
        constraints.push(where("usuarioEmail", "==", filtroUsuario));
      }
      if (isLoadMore && ultimoDocActividad) {
        constraints.push(startAfter(ultimoDocActividad));
      }
      constraints.push(limit(ACTIVIDADES_POR_PAGINA));

      const q = query(collection(db, "auditoria_actividad"), ...constraints);
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        setHayMasActividades(false);
        setMensaje(isLoadMore ? "No hay más registros." : "No se encontraron registros con los filtros aplicados.");
      } else {
        const acts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setActividades(prev => isLoadMore ? [...prev, ...acts] : acts);
        setUltimoDocActividad(snapshot.docs[snapshot.docs.length - 1]);
        setHayMasActividades(snapshot.docs.length === ACTIVIDADES_POR_PAGINA);
        setMensaje(`Se cargaron ${acts.length} registros.`);
      }
    } catch (error) {
      console.error("Error cargando actividades:", error);
      setMensaje("Error al cargar las actividades.");
    } finally {
      setCargandoActividades(false);
      setCargandoMas(false);
      setTimeout(() => setMensaje(""), 4000);
    }
  };

  const cargarUsuariosAdmins = async () => {
    if (auth.currentUser?.email !== "webmaster@iiresodh.org") return;
    setCargandoAdmins(true);
    try {
      const q = query(collection(db, "admins"));
      const snapshot = await getDocs(q);
      const lista = snapshot.docs
        .map(doc => ({ email: doc.id, ...doc.data() }))
        .filter(u => u.email !== "webmaster@iiresodh.org");
      setUsuariosAdmins(lista);
    } catch (error) {
      console.error("Error cargando administradores:", error);
    } finally {
      setCargandoAdmins(false);
    }
  };

  const handleAgregarAdmin = async (e) => {
    e.preventDefault();
    const emailLimpio = nuevoEmailAdmin.trim().toLowerCase();
    if (!emailLimpio.endsWith("@iiresodh.org")) {
      setMensaje("Error: Solo se permiten correos del dominio iiresodh.org");
      setTimeout(() => setMensaje(""), 4000);
      return;
    }
    if (emailLimpio === "webmaster@iiresodh.org") {
      setMensaje("Error: El superadministrador ya está registrado.");
      setTimeout(() => setMensaje(""), 4000);
      return;
    }

    setLoading(true);
    try {
      const docRef = doc(db, "admins", emailLimpio);
      await setDoc(docRef, {
        activo: true,
        active: true,
        permisos: nuevoPermisos,
        creadoEn: serverTimestamp()
      });
      await logActividad(`Autorizó un nuevo usuario: ${emailLimpio}`);
      setMensaje(`¡Usuario ${emailLimpio} autorizado con éxito!`);
      setNuevoEmailAdmin("");
      setNuevoPermisos({
        comunicaciones: false,
        articulos: false,
        cursos: false,
        libros: false,
        equipo: false,
        informes: false,
        incidencia: false,
        estadisticas: false,
        adminWeb: false,
        auditoria: false
      });
      cargarUsuariosAdmins();
    } catch (error) {
      console.error("Error agregando administrador:", error);
      setMensaje("Error al autorizar el usuario.");
    } finally {
      setLoading(false);
      setTimeout(() => setMensaje(""), 4000);
    }
  };

  const handleTogglePermisoAdmin = async (email, moduloKey, valorActual) => {
    try {
      const docRef = doc(db, "admins", email);
      await updateDoc(docRef, {
        [`permisos.${moduloKey}`]: !valorActual
      });
      await logActividad(`Modificó permisos de ${email}`, `Módulo ${moduloKey} establecido en ${!valorActual}`);
      setMensaje(`Permisos actualizados para ${email}`);
      cargarUsuariosAdmins();
    } catch (error) {
      console.error("Error actualizando permisos:", error);
      setMensaje("Error al actualizar permisos.");
    } finally {
      setTimeout(() => setMensaje(""), 3000);
    }
  };

  const handleToggleActivoAdmin = async (email, activoActual) => {
    try {
      const docRef = doc(db, "admins", email);
      const nuevoValor = !activoActual;
      await updateDoc(docRef, {
        activo: nuevoValor,
        active: nuevoValor
      });
      await logActividad(`Cambió estado de cuenta de ${email}`, `Estado establecido en ${nuevoValor ? 'Activo' : 'Inactivo'}`);
      setMensaje(`Estado de cuenta actualizado para ${email}`);
      cargarUsuariosAdmins();
    } catch (error) {
      console.error("Error actualizando estado del usuario:", error);
      setMensaje("Error al cambiar el estado del usuario.");
    } finally {
      setTimeout(() => setMensaje(""), 3000);
    }
  };

  const handleEliminarAdmin = async (email) => {
    try {
      await deleteDoc(doc(db, "admins", email));
      await logActividad(`Eliminó al usuario administrador: ${email}`);
      setMensaje(`Se revocó el acceso para ${email}`);
      cargarUsuariosAdmins();
    } catch (error) {
      console.error("Error eliminando administrador:", error);
      setMensaje("Error al revocar acceso.");
    } finally {
      setTimeout(() => setMensaje(""), 3000);
    }
  };

  useEffect(() => {
    if (vistaActiva === "adminWeb") {
      cargarUsuariosUnicos();
      cargarUsuariosAdmins();
      if (misPermisos.auditoria) {
        cargarUsuariosUnicos();
      }
    }
  }, [vistaActiva, misPermisos.auditoria]);

  useEffect(() => {
    if (vistaActiva === 'adminWeb') {
      setActividades([]);
      setUltimoDocActividad(null);
      setHayMasActividades(true);
    }
  }, [filtroUsuario, ordenActividad]);

  const obtenerColeccionActiva = () => {
    if (vistaActiva === "articulos") return "articulos_academicos";
    if (vistaActiva === "libros") return "libros";
    if (vistaActiva === "equipo") return "equipo";
    if (vistaActiva === "informes") return "informes";
    if (vistaActiva === "cursos") return "cursos";
    if (vistaActiva === "incidencia") return "incidencia";
    return "noticias";
  };

  const ordenarItemsLocales = (data) => {
    if (vistaActiva === "comunicaciones") {
      data.sort((a, b) => {
        if (a.persistente && !b.persistente) return -1;
        if (!a.persistente && b.persistente) return 1;
        return (b.fechaPublicacion?.seconds || 0) - (a.fechaPublicacion?.seconds || 0);
      });
    } else if (vistaActiva === "equipo") {
      data.sort((a, b) => {
        if (a.destacado && !b.destacado) return -1;
        if (!a.destacado && b.destacado) return 1;
        return (a.nombre || "").localeCompare(b.nombre || "");
      });
    } else if (vistaActiva === "informes") {
      data.sort((a, b) => (b.año || 0) - (a.año || 0));
    }
    return data;
  };

  const cargarItems = async () => {
    setCargandoLista(true);
    const coleccion = obtenerColeccionActiva();
    const orderByField = vistaActiva === 'equipo' ? 'orden' : (vistaActiva === 'informes' ? 'año' : 'fechaPublicacion');
    const orderByDirection = vistaActiva === 'equipo' ? 'asc' : 'desc';

    const q = query(collection(db, coleccion), orderBy(orderByField, orderByDirection), limit(ITEMS_POR_PAGINA));

    try {
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        setUltimoDoc(querySnapshot.docs[querySnapshot.docs.length - 1]);
        let data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setListaItems(ordenarItemsLocales(data));
        setHayMas(querySnapshot.docs.length === ITEMS_POR_PAGINA);
      } else {
        setListaItems([]);
        setHayMas(false);
      }
    } catch (error) {
      console.error("Error al cargar datos:", error);
    } finally {
      setCargandoLista(false);
    }
  };

  const cargarMasItems = async () => {
    if (!hayMas || isFetching.current || !ultimoDoc || busquedaTexto || busquedaFecha) return;
    
    isFetching.current = true;
    setCargandoLista(true);
    
    const coleccion = obtenerColeccionActiva();
    const orderByField = vistaActiva === 'equipo' ? 'orden' : (vistaActiva === 'informes' ? 'año' : 'fechaPublicacion');
    const orderByDirection = vistaActiva === 'equipo' ? 'asc' : 'desc';

    const q = query(collection(db, coleccion), orderBy(orderByField, orderByDirection), startAfter(ultimoDoc), limit(ITEMS_POR_PAGINA));

    try {
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        setUltimoDoc(querySnapshot.docs[querySnapshot.docs.length - 1]);
        let data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setListaItems(prev => ordenarItemsLocales([...prev, ...data]));
        setHayMas(querySnapshot.docs.length === ITEMS_POR_PAGINA);
      } else {
        setHayMas(false);
      }
    } catch (error) {
      console.error("Error al cargar más datos:", error);
    } finally {
      isFetching.current = false;
      setCargandoLista(false);
    }
  };

  const handleBuscar = async () => {
    setCargandoLista(true);
    const coleccion = obtenerColeccionActiva();
    const orderByField = vistaActiva === 'equipo' ? 'orden' : (vistaActiva === 'informes' ? 'año' : 'fechaPublicacion');
    const orderByDirection = vistaActiva === 'equipo' ? 'asc' : 'desc';

    const q = query(collection(db, coleccion), orderBy(orderByField, orderByDirection));

    try {
      const querySnapshot = await getDocs(q);
      let data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      if (busquedaTexto) {
        const txt = busquedaTexto.toLowerCase();
        data = data.filter(item => 
          (item.titulo && item.titulo.toLowerCase().includes(txt)) ||
          (item.nombre && item.nombre.toLowerCase().includes(txt)) ||
          (item.resumen && item.resumen.toLowerCase().includes(txt))
        );
      }

      if (busquedaFecha) {
        data = data.filter(item => {
          if (!item.fechaPublicacion) return false;
          return item.fechaPublicacion.toDate().toISOString().startsWith(busquedaFecha);
        });
      }

      setListaItems(ordenarItemsLocales(data));
      setHayMas(false); 
    } catch (error) {
      console.error("Error en búsqueda:", error);
    } finally {
      setCargandoLista(false);
    }
  };

  const handleScrollLista = (e) => {
    const { scrollTop, clientHeight, scrollHeight } = e.currentTarget;
    if (scrollHeight - Math.ceil(scrollTop) <= clientHeight + 20) {
      cargarMasItems();
    }
  };

  useEffect(() => {
    setBusquedaTexto("");
    setBusquedaFecha("");
    setListaItems([]);
    setUltimoDoc(null);
    setHayMas(true);
  }, [vistaActiva]);

  useEffect(() => {
    if (vistaActiva === "inicio" || vistaActiva === "adminWeb" || vistaActiva === "estadisticas") return;

    if (!busquedaTexto && !busquedaFecha) {
      cargarItems();
      return; 
    }

    const timeoutId = setTimeout(() => {
      handleBuscar();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [busquedaTexto, busquedaFecha, vistaActiva]);

  const handleAutoResumen = async () => {
    if (vistaActiva === "incidencia") {
      if (!archivoIncidencia) {
        setMensaje("Para resumir un documento, primero debes seleccionarlo (Subir PDF) desde tu computadora.");
        setTimeout(() => setMensaje(""), 4000);
        return;
      }
    } else {
      if (!contenido || contenido.trim().length < 20) {
        setMensaje("Escribe el contenido antes de generar un resumen.");
        setTimeout(() => setMensaje(""), 3000);
        return;
      }
    }
  
    setGenerandoResumen(true);
    setMensaje("PIDA está leyendo el documento...");
  
    try {
      const generarResumenFn = httpsCallable(functions, 'generarResumenGemini');
      let payload = {};
  
      if (vistaActiva === "incidencia" && archivoIncidencia) {
        if (archivoIncidencia.size > 5 * 1024 * 1024) { 
           setMensaje("El archivo PDF es demasiado grande para ser leído automáticamente por la IA (límite 5MB).");
           setGenerandoResumen(false);
           setTimeout(() => setMensaje(""), 4000);
           return;
        }
  
        const base64String = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(archivoIncidencia);
          reader.onload = () => {
             const resultBase64 = reader.result.split(',')[1];
             resolve(resultBase64);
          };
          reader.onerror = (error) => reject(error);
        });
        
        payload = { archivoBase64: base64String, mimeType: archivoIncidencia.type || "application/pdf" };
      } else {
        payload = { contenido };
      }

      if (vistaActiva === "comunicaciones") {
        payload.tipo = "titulo_noticia";
      }

      const resultado = await generarResumenFn(payload);
      if (resultado.data && (resultado.data.resumen || resultado.data.titulo)) {
        const texto = (resultado.data.titulo || resultado.data.resumen).trim();
        if (vistaActiva === "comunicaciones") {
          const palabras = texto.split(/\s+/).filter(Boolean);
          let tituloCorto = palabras.length > 10 ? palabras.slice(0, 9).join(" ") : texto;
          tituloCorto = tituloCorto.replace(/\.$/, "").trim();
          setTitulo(tituloCorto);
          setMensaje("✨ Título conciso generado por PIDA.");
        } else {
          setResumen(resultado.data.resumen);
          setMensaje("✨ Resumen inteligente generado por PIDA.");
        }
      } else {
        throw new Error("Respuesta de IA no válida.");
      }
    } catch (error) {
      console.error("Error:", error);
      setMensaje("Error al conectar con PIDA o archivo ilegible.");
    } finally {
      setGenerandoResumen(false);
      setTimeout(() => setMensaje(""), 4000);
    }
  };

  const handleEditarItem = (item) => {
    setEditandoId(item.id);

    if (vistaActiva === 'equipo') {
      setNombre(item.nombre || "");
      setCargo(item.cargo || "");
      setBio(item.bio || "");
      setDestacado(item.destacado || false);
      setOrden(item.orden || 0);
      setPais(item.pais || "Costa Rica");
      setMainImagePreviewUrl(item.fotoUrl || null);
      setImagenPrincipalAnterior(item.fotoUrl || null);
    } else {
      setTitulo(item.titulo || "");
      setSubtitulo(item.subtitulo || "");
      setResumen(item.resumen || "");
      setContenido(item.contenido || "");
      setSlugOriginal(item.slug || "");
      setSlugsAnterioresOriginal(item.slugsAnteriores || []);

      if (vistaActiva === "articulos") {
        setAutor(item.autor || "");
      }

      if (vistaActiva === "comunicaciones") {
        setTagsSeleccionados(item.tags || []);
        setPersistente(item.persistente || false);
        setCarruselExistente(item.imagenesCarruselUrls || []);
        setVideoUrl(item.videoUrl || "");
      }

      if (item.fechaPublicacion) {
        const date = item.fechaPublicacion.toDate();
        const localISOTime = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        setFechaPersonalizada(localISOTime);
      }

      if (vistaActiva === "libros") {
        setPrecio(item.precio || "");
        setPrecioMXN(item.precioMXN || "");
        setAutor(item.autor || "");
        setArchivoLibroAnterior(item.archivoLibroUrl || null);
        setRutaStorageAnterior(item.rutaStorage || null);
      }

      if (vistaActiva === "informes") {
        setAño(item.año || "");
        setArchivoInformeAnterior(item.archivoInformeUrl || null);
      }

      if (vistaActiva === "incidencia") {
        setArchivoIncidenciaAnterior(item.archivoIncidenciaUrl || null);
      }

      if (vistaActiva === "cursos") {
        setEnlaceInscripcion(item.enlaceInscripcion || "");
        setCursoActivo(item.cursoActivo !== undefined ? item.cursoActivo : true);
        setEstadoInscripcion(item.estadoInscripcion || (item.cursoActivo ? "abierta" : "cerrada"));
        setCarruselExistente(item.imagenesCarruselUrls || []);
      }
      
      setImagenPrincipalAnterior(item.imagenPrincipalUrl || null);
      setMainImagePreviewUrl(item.imagenPrincipalUrl || null);
    }

    setImagenesCarrusel([]); 
    setArchivosAdjuntos([]);
    setImagenPrincipal(null);
    setArchivoLibro(null);
    setArchivoLibroNombre("");
    setArchivoInforme(null);
    setArchivoInformeNombre("");
    setArchivoIncidencia(null);
    setArchivoIncidenciaNombre("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const limpiarFormulario = () => {
    setEditandoId(null);
    setTitulo("");
    setSubtitulo("");
    setResumen("");
    setContenido("");
    setFechaPersonalizada("");
    setVideoUrl("");
    setSlugOriginal("");
    setSlugsAnterioresOriginal([]);

    setNombre("");
    setCargo("");
    setBio("");
    setDestacado(false);
    setOrden(0);
    setPais("Costa Rica");

    setTagsSeleccionados([]);
    setPersistente(false);
    setErrorPortada(false);
    setMainImagePreviewUrl(null);
    setImagenPrincipal(null);
    setImagenPrincipalAnterior(null);
    setCarruselExistente([]);
    setImagenesCarrusel([]);
    setArchivosAdjuntos([]);
    setPrecio("");
    setPrecioMXN(""); 
    setAutor(""); 
    
    setArchivoLibro(null);
    setArchivoLibroNombre("");
    setArchivoLibroAnterior(null);
    setRutaStorageAnterior(null);
    
    setAño("");
    setArchivoInforme(null);
    setArchivoInformeNombre("");
    setArchivoInformeAnterior(null);

    setArchivoIncidencia(null);
    setArchivoIncidenciaNombre("");
    setArchivoIncidenciaAnterior(null);

    setEnlaceInscripcion("");
    setCursoActivo(true);
    setEstadoInscripcion("abierta");
    
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCancel = () => {
    limpiarFormulario();
    setMensaje("Operación cancelada. Formulario en blanco.");
    setTimeout(() => setMensaje(""), 3000);
  };

  const pedirConfirmacionBorrado = (id, tituloItem) => {
    setModalBorrar({ isOpen: true, id, titulo: tituloItem });
  };

  const ejecutarBorrado = async () => {
    if (!modalBorrar.id) return;
    try {
      const coleccion = obtenerColeccionActiva();
      await deleteDoc(doc(db, coleccion, modalBorrar.id));
      await logActividad(`Eliminó un item de "${vistaActiva}": ${modalBorrar.titulo} (ID: ${modalBorrar.id})`);
      cargarItems(); 
      setMensaje("¡Contenido eliminado con éxito!");
    } catch (error) {
      console.error("Error al borrar:", error);
      setMensaje("Error al eliminar el contenido.");
    } finally {
      setModalBorrar({ isOpen: false, id: null, titulo: "" });
      setTimeout(() => setMensaje(""), 3000);
    }
  };

  const handleSubirDocumento = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setSubiendoArchivo(true);
    setMensaje("Subiendo documento...");
    try {
      const carpeta = vistaActiva === "articulos" ? "articulos" : (vistaActiva === "incidencia" ? "incidencia" : "noticias");
      const refDoc = ref(storage, `${carpeta}/documentos/${Date.now()}_${file.name}`);
      await uploadBytes(refDoc, file);
      const url = await getDownloadURL(refDoc);

      setArchivosAdjuntos(prev => [...prev, { nombre: file.name, url }]);
      setMensaje("¡Documento subido con éxito!");
    } catch (error) {
      console.error("Error al subir documento:", error);
      setMensaje("Error al subir el documento.");
    } finally {
      setSubiendoArchivo(false);
      e.target.value = ""; 
      setTimeout(() => setMensaje(""), 4000);
    }
  };

  const copiarEnlaceDocumento = (nombreDoc, url) => {
    const snippet = `[📄 Ver anexo: ${nombreDoc}](${url})`;
    navigator.clipboard.writeText(snippet);
    setMensaje("¡Enlace copiado! Pégalo en el contenido.");
    setTimeout(() => setMensaje(""), 4000);
  };

  const handleSeleccionPrincipal = async (e) => {
    const file = e.target.files[0];
    e.target.value = ""; 
    
    if (file) {
      try {
        setMensaje("Optimizando imagen a WebP...");
        const webpFile = await convertirAWebp(file);
        setImagenPrincipal(webpFile);
        setErrorPortada(false);
        setMainImagePreviewUrl(URL.createObjectURL(webpFile));
        setMensaje(""); 
      } catch (error) {
        console.error("Error al procesar imagen:", error);
        setMensaje("Error al optimizar la imagen.");
        setTimeout(() => setMensaje(""), 3000);
      }
    }
  };

  const handleAgregarImagenes = async (e) => {
    const files = Array.from(e.target.files).sort((a, b) => a.name.localeCompare(b.name));
    
    if (files.length > 0) {
      try {
        setMensaje("Optimizando imágenes para el carrusel...");
        const webpFiles = await Promise.all(files.map(file => convertirAWebp(file)));
        setImagenesCarrusel((prev) => [...prev, ...webpFiles]);
        e.target.value = ""; 
        setMensaje("");
      } catch (error) {
        console.error("Error al procesar imágenes:", error);
        setMensaje("Error al optimizar las imágenes.");
        setTimeout(() => setMensaje(""), 3000);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!editandoId) {
      if (vistaActiva !== "incidencia" && !imagenPrincipalAnterior && !imagenPrincipal) {
        setErrorPortada(true);
        setMensaje("Error: Por favor selecciona una imagen para la portada.");
        const elPortada = document.getElementById("seccion-portada-principal");
        if (elPortada) {
          elPortada.scrollIntoView({ behavior: "smooth", block: "center" });
        } else {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
        return;
      }
      if (vistaActiva === "libros" && !archivoLibroAnterior && !archivoLibro) {
        setMensaje("Error: Por favor selecciona el archivo PDF del libro.");
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      if (vistaActiva === "informes" && !archivoInformeAnterior && !archivoInforme) {
        setMensaje("Error: Por favor selecciona el archivo PDF del informe.");
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      if (vistaActiva === "incidencia" && !archivoIncidenciaAnterior && !archivoIncidencia) {
        setMensaje("Error: Por favor selecciona el archivo PDF del documento.");
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
    }

    if (vistaActiva === "comunicaciones") {
      const contenidoTexto = (contenido || "").replace(/<[^>]*>?/gm, '').trim();
      if (!contenidoTexto) {
        setMensaje("Error: Por favor redacta el cuerpo de la noticia.");
        const elEditor = document.getElementById("editor-cuerpo-noticia");
        if (elEditor) {
          elEditor.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        return;
      }
    }

    setLoading(true);

    if (vistaActiva === "comunicaciones" && persistente) {
      try {
        const qPersistentes = query(collection(db, "noticias"), where("persistente", "==", true));
        const snapPersistentes = await getDocs(qPersistentes);
        
        let cantidadFijas = snapPersistentes.docs.length;
        if (editandoId && snapPersistentes.docs.some(d => d.id === editandoId)) {
          cantidadFijas -= 1; 
        }

        if (cantidadFijas >= 3) {
          setMensaje("Error: Ya existen 3 noticias fijadas. Debes desmarcar alguna antes de fijar esta.");
          setLoading(false);
          return;
        }
      } catch (error) {
        console.error("Error verificando persistencia", error);
      }
    }

    setMensaje(editandoId ? "Actualizando información..." : "Publicando contenido...");

    try {
      const carpeta = vistaActiva === "articulos" ? "articulos" : 
                      (vistaActiva === "libros" ? "libros" : 
                      (vistaActiva === 'equipo' ? 'equipo' : 
                      (vistaActiva === 'informes' ? 'informes' : 
                      (vistaActiva === 'incidencia' ? 'incidencia' : "noticias"))));
      
      let finalPrincipalUrl = imagenPrincipalAnterior;
      if (imagenPrincipal) {
        const refImg = ref(storage, `${carpeta}/portadas/${Date.now()}_${imagenPrincipal.name}`);
        await uploadBytes(refImg, imagenPrincipal);
        finalPrincipalUrl = await getDownloadURL(refImg);
      }

      let finalArchivoLibroUrl = archivoLibroAnterior;
      let rutaStorageLibro = null; 

      if (vistaActiva === "libros" && archivoLibro) {
        const rutaCompleta = `${carpeta}/archivos/${Date.now()}_${archivoLibro.name}`; 
        const refLibro = ref(storage, rutaCompleta);
        await uploadBytes(refLibro, archivoLibro);
        finalArchivoLibroUrl = await getDownloadURL(refLibro);
        rutaStorageLibro = rutaCompleta; 
      }

      let finalArchivoInformeUrl = archivoInformeAnterior;
      if (vistaActiva === "informes" && archivoInforme) {
        const refInf = ref(storage, `informes/archivos/${Date.now()}_${archivoInforme.name}`);
        await uploadBytes(refInf, archivoInforme);
        finalArchivoInformeUrl = await getDownloadURL(refInf);
      }

      let finalArchivoIncidenciaUrl = archivoIncidenciaAnterior;
      if (vistaActiva === "incidencia" && archivoIncidencia) {
        const refInc = ref(storage, `incidencia/archivos/${Date.now()}_${archivoIncidencia.name}`);
        await uploadBytes(refInc, archivoIncidencia);
        finalArchivoIncidenciaUrl = await getDownloadURL(refInc);
      }

      const nuevasUrls = [];
      if (vistaActiva === "comunicaciones" || vistaActiva === "cursos") {
        for (const file of imagenesCarrusel) {
          const refCar = ref(storage, `${carpeta}/carrusel/${Date.now()}_${file.name}`);
          await uploadBytes(refCar, file);
          const url = await getDownloadURL(refCar);
          nuevasUrls.push(url);
        }
      }
      
      const coleccion = obtenerColeccionActiva();
      let datos;

      if (vistaActiva === 'equipo') {
        datos = {
          nombre,
          cargo,
          orden: Number(orden || 0),
          destacado,
          fotoUrl: finalPrincipalUrl || null,
          bio: destacado ? bio : "",
          pais
        };
      } else {
        const slugFinal = (editandoId && slugOriginal) ? slugOriginal : generarSlug(titulo);
        datos = {
          titulo, 
          resumen, 
          contenido,
          slug: slugFinal, 
          imagenPrincipalUrl: finalPrincipalUrl || null,
          fechaPublicacion: fechaPersonalizada ? Timestamp.fromDate(new Date(fechaPersonalizada)) : serverTimestamp(),
          activa: true
        };

        if (slugsAnterioresOriginal && slugsAnterioresOriginal.length > 0) {
          datos.slugsAnteriores = slugsAnterioresOriginal;
        }

        if (vistaActiva === "comunicaciones") {
          datos.imagenesCarruselUrls = [...carruselExistente, ...nuevasUrls];
          datos.tags = tagsSeleccionados;
          datos.persistente = persistente;
          datos.videoUrl = videoUrl ? videoUrl.trim() : null;
        } else if (vistaActiva === "articulos") {
          const usuarioActual = auth.currentUser?.displayName || auth.currentUser?.email?.split('@')[0] || "IIRESODH";
          datos.subtitulo = subtitulo ? subtitulo.trim() : "";
          datos.autor = autor && autor.trim() ? autor.trim() : usuarioActual;
          if (!resumen || !resumen.trim()) {
            if (subtitulo && subtitulo.trim()) {
              datos.resumen = subtitulo.trim();
            } else if (contenido) {
              const textoLimpio = contenido.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
              datos.resumen = textoLimpio.length > 200 ? textoLimpio.substring(0, 197) + '...' : textoLimpio;
            }
          }
        } else if (vistaActiva === "libros") {
          datos.precio = parseFloat(precio) || 0;
          datos.precioMXN = parseFloat(precioMXN) || 0;
          datos.autor = autor; 
          datos.archivoLibroUrl = finalArchivoLibroUrl;
          
          if (rutaStorageLibro) {
            datos.rutaStorage = rutaStorageLibro;
          } else if (rutaStorageAnterior) {
            datos.rutaStorage = rutaStorageAnterior;
          }
        } else if (vistaActiva === "informes") {
          datos.año = Number(año);
          datos.titulo = `Informe Anual ${año}`;
          datos.archivoInformeUrl = finalArchivoInformeUrl || null;
          datos.tipo = "PDF";
          delete datos.contenido; 
          delete datos.resumen;
          delete datos.fechaPublicacion;
        } else if (vistaActiva === "incidencia") {
          datos.archivoIncidenciaUrl = finalArchivoIncidenciaUrl || null;
          datos.tipo = "PDF";
          delete datos.contenido;
        } else if (vistaActiva === "cursos") {
          datos.enlaceInscripcion = enlaceInscripcion || null;
          datos.cursoActivo = estadoInscripcion === "abierta";
          datos.estadoInscripcion = estadoInscripcion;
          datos.imagenesCarruselUrls = [...carruselExistente, ...nuevasUrls];
          delete datos.contenido;
        }
      }

      if (editandoId) {
        const itemOriginal = listaItems.find(item => item.id === editandoId);
        const cambios = [];

        if (itemOriginal) {
            if (itemOriginal.titulo !== datos.titulo && datos.titulo !== undefined) cambios.push(`título`);
            if (itemOriginal.resumen !== datos.resumen && datos.resumen !== undefined) cambios.push(`resumen`);
            if (itemOriginal.contenido !== datos.contenido && datos.contenido !== undefined) cambios.push(`contenido`);
            if (itemOriginal.nombre !== datos.nombre && datos.nombre !== undefined) cambios.push(`nombre`);
            if (itemOriginal.cargo !== datos.cargo && datos.cargo !== undefined) cambios.push(`cargo`);
            if (itemOriginal.bio !== datos.bio && datos.bio !== undefined) cambios.push(`biografía`);
            if (itemOriginal.autor !== datos.autor && datos.autor !== undefined) cambios.push(`autor`);
            if (Number(itemOriginal.orden) !== datos.orden && datos.orden !== undefined) cambios.push(`orden`);
            if (Number(itemOriginal.año) !== datos.año && datos.año !== undefined) cambios.push(`año`);
            if (Number(itemOriginal.precio) !== datos.precio && datos.precio !== undefined) cambios.push(`precio USD`);
            if (Number(itemOriginal.precioMXN) !== datos.precioMXN && datos.precioMXN !== undefined) cambios.push(`precio MXN`);
            if (itemOriginal.destacado !== datos.destacado && datos.destacado !== undefined) cambios.push(`destacado`);
            if (itemOriginal.persistente !== datos.persistente && datos.persistente !== undefined) cambios.push(`fijado`);
            if (itemOriginal.enlaceInscripcion !== datos.enlaceInscripcion && datos.enlaceInscripcion !== undefined) cambios.push(`enlace de inscripción`);
            
            const tagsOriginales = itemOriginal.tags || [];
            const tagsNuevos = datos.tags || [];
            if (JSON.stringify(tagsOriginales.sort()) !== JSON.stringify(tagsNuevos.sort())) cambios.push('tags');

            if (finalPrincipalUrl !== imagenPrincipalAnterior) cambios.push('imagen principal');
            if (finalArchivoLibroUrl !== archivoLibroAnterior) cambios.push('archivo PDF libro');
            if (finalArchivoInformeUrl !== archivoInformeAnterior) cambios.push('archivo PDF informe');
            if (finalArchivoIncidenciaUrl !== archivoIncidenciaAnterior) cambios.push('archivo PDF incidencia');
            if (nuevasUrls.length > 0 || carruselExistente.length !== (itemOriginal.imagenesCarruselUrls || []).length) cambios.push('galería');
        }

        const detallesUpdate = cambios.length > 0 ? `Campos modificados: ${cambios.join(', ')}.` : 'No se detectaron cambios en los campos principales.';
        await updateDoc(doc(db, coleccion, editandoId), datos);
        await logActividad(`Actualizó un item en "${vistaActiva}": ${datos.titulo || datos.nombre}`, detallesUpdate);

        if (['comunicaciones', 'noticias', 'articulos', 'cursos', 'libros', 'incidencia', 'equipo'].includes(vistaActiva)) {
          setMensaje("¡Actualizado! Sincronizando traducciones automáticas (EN / FR)...");
          await new Promise(r => setTimeout(r, 2000));
        }

        const mensajeExito = vistaActiva === 'equipo' ? "¡Miembro del equipo actualizado y sincronizado!" : "¡Contenido actualizado y traducido con éxito!";
        setMensaje(mensajeExito);
      } else {
        let detallesCreacion = [];
        if (vistaActiva === 'comunicaciones' && datos.tags.length > 0) {
            detallesCreacion.push(`Tags: [${datos.tags.join(', ')}]`);
        }
        if (datos.persistente) {
            detallesCreacion.push('Marcado como Fijo en Portada');
        }
        if (vistaActiva === 'libros') {
            detallesCreacion.push(`Precio USD: ${datos.precio}, MXN: ${datos.precioMXN}`);
        }
        if (vistaActiva === 'informes') {
            detallesCreacion.push(`Año: ${datos.año}`);
        }
        if (vistaActiva === 'equipo') {
            detallesCreacion.push(`Cargo: ${datos.cargo}, Orden: ${datos.orden}`);
            if (datos.destacado) detallesCreacion.push('Marcado como Destacado');
        }
        if (vistaActiva === 'cursos') {
            if (datos.enlaceInscripcion) detallesCreacion.push(`Con enlace de inscripción activo`);
        }
        const detallesString = detallesCreacion.length > 0 ? detallesCreacion.join('. ') + '.' : null;
        const docRefCreado = await addDoc(collection(db, coleccion), datos);
        await logActividad(`Creó un item en "${vistaActiva}": ${datos.titulo || datos.nombre}`, detallesString);

        if (['comunicaciones', 'noticias', 'articulos', 'cursos', 'libros', 'incidencia', 'equipo'].includes(vistaActiva)) {
          setMensaje("¡Publicado! Generando traducciones automáticas (inglés y francés)...");
          for (let intento = 0; intento < 5; intento++) {
            await new Promise(r => setTimeout(r, 1200));
            try {
              const snapCheck = await getDoc(docRefCreado);
              if (snapCheck.exists() && (snapCheck.data().titulo_en || snapCheck.data().nombre_en)) {
                break;
              }
            } catch (e) { /* silencioso */ }
          }
        }

        const mensajeExito = vistaActiva === 'equipo' 
          ? "¡Miembro del equipo agregado y traducido con éxito!" 
          : "¡Contenido publicado y traducido a inglés y francés con éxito!";
        setMensaje(mensajeExito);
      }

      limpiarFormulario();
      cargarItems(); 
    } catch (err) {
      console.error("[AdminPanelWeb] Error al procesar publicación:", err);
      let errorMsg = "Error en el proceso.";
      if (err?.code === 'storage/unauthorized') {
        errorMsg = "Error de permisos en Storage: Tu cuenta no tiene autorización para subir archivos a iiresodh.org.";
      } else if (err?.code === 'permission-denied') {
        errorMsg = "Error de permisos en Firestore: Tu cuenta no tiene autorización para escribir en la base de datos de iiresodh.org.";
      } else if (err?.code === 'storage/canceled') {
        errorMsg = "Error: La carga del archivo fue cancelada.";
      } else if (err?.message) {
        errorMsg = `Error: ${err.message}`;
      }
      setMensaje(errorMsg);
    } finally {
      setLoading(false);
      setTimeout(() => {
        setMensaje(current => (current && !current.includes("Error") ? "" : current));
      }, 4000);
    }
  };

  const cargarConfiguracionVisual = async () => {
    setCargandoConfig(true);
    try {
      const docRef = doc(db, "configuracion", "home_visual");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setTituloHome(docSnap.data());
      }
    } catch (e) {
      console.error("Error al cargar configuracion:", e);
    }
    setCargandoConfig(false);
  };

  const guardarConfiguracionVisual = async (e) => {
    e.preventDefault();
    setGuardandoConfig(true);
    try {
      await setDoc(doc(db, "configuracion", "home_visual"), tituloHome);
      setMensaje("¡Configuración visual actualizada con éxito!");
    } catch (e) {
      console.error("Error al guardar configuracion:", e);
      setMensaje("Error al guardar la configuración.");
    }
    setGuardandoConfig(false);
    setTimeout(() => setMensaje(""), 3000);
  };

  useEffect(() => {
    if (vistaActiva === "adminWeb") {
      cargarConfiguracionVisual();
    }
  }, [vistaActiva]);

  // Si está verificando la autenticación
  if (verificandoAuthWeb) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '55vh',
          gap: 1.5,
          fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif'
        }}
      >
        <CircularProgress size={26} sx={{ color: '#0f172a' }} />
        <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: '#64748b' }}>
          Sincronizando sesión con el portal público (iiresodh.org)...
        </Typography>
      </Box>
    );
  }

  // Si no está autenticado en la app secundaria de la web, mostrar pantalla de conexión
  if (!userWeb) {
    return (
      <Box
        sx={{
          maxWidth: 460,
          mx: 'auto',
          mt: { xs: 3, md: 6 },
          px: 2,
          fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif'
        }}
      >
        <Box
          sx={{
            p: { xs: 3, sm: 3.5 },
            // Regla arquitectónica: barra lateral con radio cero en ese lado
            borderRadius: '0 12px 12px 0',
            border: '1px solid #e2e8f0',
            borderLeft: '3px solid #0f172a',
            bgcolor: '#ffffff',
            boxShadow: '0 4px 20px rgba(15, 23, 42, 0.04)'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.75,
                px: 1.1,
                py: 0.35,
                bgcolor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                color: '#0f172a'
              }}
            >
              <Globe size={13} color="#0f766e" />
              <Typography
                sx={{
                  fontSize: '0.66rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.07em'
                }}
              >
                CMS Público · iiresodh.org
              </Typography>
            </Box>
            <img
              src="/logo.png"
              alt="Logo IIRESODH"
              style={{ height: '28px', width: 'auto', objectFit: 'contain' }}
            />
          </Box>

          <Typography
            sx={{
              fontSize: '1.2rem',
              fontWeight: 700,
              color: '#0f172a',
              letterSpacing: '-0.02em',
              mb: 1
            }}
          >
            Consola Editorial del Sitio Público
          </Typography>

          <Typography sx={{ fontSize: '0.82rem', color: '#64748b', mb: 3, lineHeight: 1.55 }}>
            Para publicar noticias, artículos académicos, cursos, catálogo editorial e informes anuales en <strong>iiresodh.org</strong>, vincula tu credencial institucional de <strong>@iiresodh.org</strong>.
          </Typography>

          {errorAuthWeb && (
            <Box
              sx={{
                mb: 2.5,
                p: 1.5,
                bgcolor: '#fef2f2',
                border: '1px solid #fecaca',
                borderLeft: '3px solid #dc2626',
                borderRadius: '0 8px 8px 0',
                fontSize: '0.76rem',
                color: '#991b1b',
                lineHeight: 1.45
              }}
            >
              {errorAuthWeb}
            </Box>
          )}

          <Button
            variant="contained"
            fullWidth
            startIcon={<LogIn size={16} />}
            onClick={handleConectarWeb}
            disabled={conectandoWeb}
            sx={{
              py: 1.15,
              borderRadius: '8px',
              bgcolor: '#0f172a',
              color: '#ffffff',
              fontWeight: 600,
              textTransform: 'none',
              fontSize: '0.84rem',
              boxShadow: 'none',
              '&:hover': { bgcolor: '#1e293b', boxShadow: 'none' }
            }}
          >
            {conectandoWeb ? 'Autenticando...' : 'Conectar con cuenta @iiresodh.org'}
          </Button>

          <Button
            variant="outlined"
            fullWidth
            startIcon={<ArrowLeft size={15} />}
            onClick={onVolver}
            sx={{
              mt: 1.25,
              py: 1,
              borderRadius: '8px',
              borderColor: '#e2e8f0',
              color: '#475569',
              textTransform: 'none',
              fontSize: '0.8rem',
              fontWeight: 600,
              '&:hover': { borderColor: '#cbd5e1', bgcolor: '#f8fafc', color: '#0f172a' }
            }}
          >
            Volver al Hub Central
          </Button>
        </Box>
      </Box>
    );
  }

  // Si está autenticado pero no tiene ningún permiso activo y hay un error de privilegios
  if (errorAuthWeb) {
    return (
      <Box
        sx={{
          maxWidth: 460,
          mx: 'auto',
          mt: 6,
          px: 2,
          fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif'
        }}
      >
        <Box
          sx={{
            p: 3.5,
            borderRadius: '0 12px 12px 0',
            border: '1px solid #fecaca',
            borderLeft: '3px solid #dc2626',
            bgcolor: '#ffffff'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1.5 }}>
            <ShieldCheck size={22} color="#dc2626" />
            <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
              Sin permisos asignados en el CMS Web
            </Typography>
          </Box>
          <Typography sx={{ fontSize: '0.8rem', color: '#64748b', mb: 3, lineHeight: 1.55 }}>
            {errorAuthWeb}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1.25 }}>
            <Button
              variant="contained"
              onClick={onVolver}
              sx={{
                bgcolor: '#0f172a',
                textTransform: 'none',
                borderRadius: '7px',
                fontSize: '0.78rem',
                fontWeight: 600,
                boxShadow: 'none',
                '&:hover': { bgcolor: '#1e293b', boxShadow: 'none' }
              }}
            >
              Regresar al Hub
            </Button>
            <Button
              variant="outlined"
              color="error"
              onClick={handleDesconectarWeb}
              sx={{ textTransform: 'none', borderRadius: '7px', fontSize: '0.78rem', fontWeight: 600 }}
            >
              Cambiar cuenta
            </Button>
          </Box>
        </Box>
      </Box>
    );
  }

  const MODULOS_CMS = [
    {
      id: 'comunicaciones',
      tag: 'PORTADA Y PRENSA',
      titulo: 'Noticias y Comunicados',
      subtitulo: 'Publicaciones oficiales, pronunciamientos y carrusel de inicio',
      acento: 'border-l-[#0f172a]',
      habilitado: misPermisos.comunicaciones,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10l4 4v10a2 2 0 01-2 2z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M8 8h8M8 12h8M8 16h4" />
        </svg>
      )
    },
    {
      id: 'articulos',
      tag: 'DOCTRINA',
      titulo: 'Artículos Académicos',
      subtitulo: 'Ensayos jurídicos, investigaciones y análisis interamericano',
      acento: 'border-l-[#b91c1c]',
      habilitado: misPermisos.articulos,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477-4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      )
    },
    {
      id: 'cursos',
      tag: 'FORMACIÓN',
      titulo: 'Cursos y Seminarios',
      subtitulo: 'Oferta académica, talleres especializados e inscripciones',
      acento: 'border-l-[#0f766e]',
      habilitado: misPermisos.cursos,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M12 14l9-5-9-5-9 5 9 5z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
        </svg>
      )
    },
    {
      id: 'libros',
      tag: 'SELLO EDITORIAL',
      titulo: 'Tienda Editorial',
      subtitulo: 'Catálogo de obras jurídicas, libros digitales y precios USD/MXN',
      acento: 'border-l-[#0f172a]',
      habilitado: misPermisos.libros,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
        </svg>
      )
    },
    {
      id: 'equipo',
      tag: 'INSTITUCIONAL',
      titulo: 'Equipo de Trabajo',
      subtitulo: 'Directorio oficial por país, cargos y perfiles directivos',
      acento: 'border-l-[#0f766e]',
      habilitado: misPermisos.equipo,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )
    },
    {
      id: 'informes',
      tag: 'TRANSPARENCIA',
      titulo: 'Informes Anuales',
      subtitulo: 'Memorias anuales de gestión y rendición de cuentas en PDF',
      acento: 'border-l-[#0f172a]',
      habilitado: misPermisos.informes,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    },
    {
      id: 'incidencia',
      tag: 'LITIGIO Y DDHH',
      titulo: 'Incidencia Internacional',
      subtitulo: 'Amicus curiae, informes temáticos y documentos ante organismos',
      acento: 'border-l-[#b91c1c]',
      habilitado: misPermisos.incidencia,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10l4 4v10a2 2 0 01-2 2z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M12 4v16m8-8H4" />
        </svg>
      )
    },
    {
      id: 'adminWeb',
      tag: 'GOBERNANZA WEB',
      titulo: 'Configuración y Auditoría',
      subtitulo: 'Textos trilingües de portada, permisos de editores y bitácora',
      acento: 'border-l-[#0f172a]',
      habilitado: misPermisos.adminWeb || auth.currentUser?.email === 'webmaster@iiresodh.org',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )
    }
  ];

  return (
    <main className="min-h-screen font-sans relative max-w-[1320px] mx-auto px-2 sm:px-4 py-2">
      <ConfirmDialog 
        open={modalBorrar.isOpen}
        title="¿Eliminar publicación?"
        content={`Estás a punto de borrar permanentemente: "${modalBorrar.titulo}". Esta acción no se puede deshacer.`}
        onCancel={() => setModalBorrar({ isOpen: false, id: null, titulo: "" })}
        onConfirm={ejecutarBorrado}
      />

      {/* BARRA EJECUTIVA DE COMANDO DEL CMS WEB */}
      <header className="bg-white/95 backdrop-blur-md sticky top-0 z-30 px-4 py-3 border border-slate-200 border-l-[3px] border-l-slate-900 rounded-l-none rounded-r-[10px] flex flex-wrap justify-between items-center mb-6 gap-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onVolver}
            className="w-8 h-8 rounded-[7px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 flex items-center justify-center transition-colors cursor-pointer"
            title="Volver al Hub de la Intranet"
          >
            <ArrowLeft size={15} />
          </button>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-slate-500">
                CMS Público · ES / EN / FR
              </span>
              <span className="inline-flex items-center gap-1 bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold px-1.5 py-0.5 rounded-[5px] text-[10.5px]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                iiresodh.org
              </span>
            </div>
            <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-tight">
              Administración del Sitio Web
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {userWeb && (
            <span className="text-xs text-slate-500 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-[6px] font-medium hidden lg:inline-block">
              Editor: <strong className="text-slate-900 font-semibold">{userWeb.email}</strong>
            </span>
          )}

          <a 
            href="https://iiresodh.org" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-xs text-slate-700 hover:text-slate-900 flex items-center gap-1.5 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 px-2.5 py-1.5 rounded-[7px] font-semibold transition-colors"
          >
            Abrir Portal <ExternalLink size={12} />
          </a>

          <button 
            onClick={handleDesconectarWeb} 
            className="text-xs bg-white border border-slate-200 text-slate-600 hover:text-red-700 hover:border-red-200 hover:bg-red-50 px-2.5 py-1.5 rounded-[7px] font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
            title="Desconectar credencial web"
          >
            <LogOut size={13} />
            <span className="hidden sm:inline">Desconectar</span>
          </button>
        </div>
      </header>

      <div>
        <ToastAlert 
          open={!!mensaje} 
          message={mensaje} 
          isError={mensaje.includes("Error")} 
          onClose={() => setMensaje("")} 
        />

        {vistaActiva === "inicio" && (
          <section className="animate-fade-in-up" aria-labelledby="admin-title">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-[0.07em] text-slate-500">
                Módulos Editoriales del Portal ({MODULOS_CMS.filter((m) => m.habilitado).length} habilitados)
              </span>
            </div>

            <nav className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5" aria-label="Departamentos administrativos">
              {MODULOS_CMS.map((mod) => (
                <button
                  key={mod.id}
                  type="button"
                  onClick={() => setVistaActiva(mod.id)}
                  disabled={!mod.habilitado}
                  className={`bg-white border border-slate-200 border-l-[3px] ${mod.acento} rounded-l-none rounded-r-[10px] p-4 text-left transition-all duration-150 flex flex-col justify-between group ${
                    !mod.habilitado
                      ? 'opacity-40 cursor-not-allowed pointer-events-none'
                      : 'hover:border-slate-300 hover:shadow-[0_6px_20px_rgba(15,23,42,0.06)] cursor-pointer'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="text-[10px] font-bold uppercase tracking-[0.07em] text-slate-500">
                        {mod.tag}
                      </span>
                      <div className="w-8 h-8 rounded-[7px] bg-slate-50 border border-slate-200 text-slate-700 group-hover:bg-slate-900 group-hover:text-white group-hover:border-slate-900 flex items-center justify-center transition-colors">
                        {mod.icon}
                      </div>
                    </div>
                    <h2 className="text-[15px] font-bold text-slate-900 tracking-tight mb-1">
                      {mod.titulo}
                    </h2>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      {mod.subtitulo}
                    </p>
                  </div>

                  <div className="mt-4 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] font-semibold text-slate-700 group-hover:text-slate-900">
                    <span>Gestionar sección</span>
                    <span className="transition-transform group-hover:translate-x-0.5">→</span>
                  </div>
                </button>
              ))}
            </nav>
          </section>
        )}

        {(vistaActiva !== "inicio" && vistaActiva !== "adminWeb" && vistaActiva !== "estadisticas") && (
          <div className="animate-fade-in-up">
            {/* Barra de navegación rápida entre módulos */}
            <div className="mb-5 flex flex-wrap items-center justify-between gap-2 bg-slate-100/80 p-1.5 rounded-[9px] border border-slate-200/80">
              <button
                type="button"
                onClick={() => { limpiarFormulario(); setVistaActiva("inicio"); }}
                className="flex items-center gap-1.5 text-xs text-slate-700 font-semibold hover:text-slate-900 bg-white px-3 py-1.5 rounded-[6px] shadow-[0_1px_2px_rgba(15,23,42,0.05)] border border-slate-200/80 transition-colors cursor-pointer"
              >
                <ArrowLeft size={14} />
                Todos los Módulos
              </button>

              <div className="flex items-center gap-1 overflow-x-auto py-0.5">
                {MODULOS_CMS.filter((m) => m.id !== 'adminWeb' && m.habilitado).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => { limpiarFormulario(); setVistaActiva(m.id); }}
                    className={`px-2.5 py-1 rounded-[6px] text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                      vistaActiva === m.id
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                    }`}
                  >
                    {m.titulo}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-8 space-y-6">
                <section
                  className={`bg-white p-5 md:p-7 rounded-l-none rounded-r-[10px] shadow-[0_1px_3px_rgba(15,23,42,0.03)] border border-slate-200 border-l-[3px] ${
                    editandoId ? 'border-l-[#b91c1c]' : 'border-l-slate-900'
                  }`}
                  aria-labelledby="form-title"
                >
                  <header className="mb-6 pb-4 border-b border-slate-100 flex items-center justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-[0.07em] text-slate-400 block mb-0.5">
                        {vistaActiva === "comunicaciones" ? "Módulo · Noticias y Comunicados" :
                         vistaActiva === "libros" ? "Módulo · Tienda Editorial" :
                         vistaActiva === "informes" ? "Módulo · Informes Anuales" :
                         vistaActiva === "incidencia" ? "Módulo · Incidencia Internacional" :
                         vistaActiva === "cursos" ? "Módulo · Cursos y Seminarios" :
                         vistaActiva === "articulos" ? "Módulo · Artículos Académicos" :
                         "Módulo · Equipo de Trabajo"}
                      </span>
                      <h2 id="form-title" className={`text-lg md:text-xl font-bold tracking-tight ${editandoId ? 'text-[#b91c1c]' : 'text-slate-900'}`}>
                        {editandoId ? 
                          (vistaActiva === 'equipo' ? "Editando Miembro" : (vistaActiva === 'informes' ? "Editando Informe" : (vistaActiva === 'incidencia' ? "Editando Documento" : (vistaActiva === 'articulos' ? "Editando Artículo" : (vistaActiva === 'comunicaciones' ? "Editando Noticia o Comunicado" : "Editando Publicación"))))) : 
                          (vistaActiva === "articulos" ? "Redactar Nuevo Artículo" : (vistaActiva === "libros" ? "Registrar Nuevo Libro" : (vistaActiva === 'equipo' ? "Agregar Miembro" : (vistaActiva === 'informes' ? "Cargar Nuevo Informe" : (vistaActiva === 'incidencia' ? "Cargar Nuevo Documento" : (vistaActiva === 'comunicaciones' ? "Crear Noticia o Comunicado" : "Crear Nueva Publicación"))))))
                        }
                      </h2>
                    </div>
                    {editandoId && (
                      <span className="bg-red-50 text-[#b91c1c] text-[11px] font-bold px-2.5 py-1 rounded-[6px] border border-red-200">
                        MODO EDICIÓN
                      </span>
                    )}
                  </header>

                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* FORMULARIO PARA EQUIPO */}
                    {vistaActiva === 'equipo' && (<>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <AdminTextField label="Nombre Completo" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
                        <AdminTextField label="Cargo" value={cargo} onChange={(e) => setCargo(e.target.value)} required />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <AdminTextField label="Orden (número para ordenar)" type="number" value={orden} onChange={(e) => setOrden(e.target.value)} required />
                        <FormControl size="small" fullWidth>
                          <InputLabel id="pais-label">Sección (País)</InputLabel>
                          <Select
                            labelId="pais-label"
                            value={pais}
                            label="Sección (País)"
                            onChange={(e) => setPais(e.target.value)}
                          >
                            <MenuItem value="Costa Rica">Costa Rica</MenuItem>
                            <MenuItem value="Colombia">Colombia</MenuItem>
                            <MenuItem value="Guatemala">Guatemala</MenuItem>
                            <MenuItem value="México">México</MenuItem>
                            <MenuItem value="Canadá">Canadá</MenuItem>
                            <MenuItem value="Otra">Otra</MenuItem>
                          </Select>
                        </FormControl>
                      </div>
                      <FormControlLabel control={<Checkbox checked={destacado} onChange={(e) => setDestacado(e.target.checked)} />} label="Miembro Destacado (Presidente)" />
                      {destacado && (
                        <AdminTextField label="Biografía (solo para miembro destacado)" multiline rows={8} value={bio} onChange={(e) => setBio(e.target.value)} />
                      )}
                    </>)}

                    {/* FORMULARIO ESPECÍFICO PARA ARTÍCULOS */}
                    {vistaActiva === "articulos" && (
                      <div className="space-y-6">
                        <div className="bg-slate-50/60 p-5 rounded-[10px] border border-slate-200 space-y-5">
                          <AdminTextField 
                            label="Título del Artículo *"
                            value={titulo}
                            onChange={(e) => setTitulo(e.target.value)}
                            required
                            placeholder="Ej: Análisis del Sistema Interamericano de Derechos Humanos..."
                          />

                          <AdminTextField 
                            label="Subtítulo del Artículo (Opcional)"
                            value={subtitulo}
                            onChange={(e) => setSubtitulo(e.target.value)}
                            placeholder="Ej: Un estudio comparado sobre estándares jurisprudenciales..."
                          />

                          <div>
                            <AdminTextField 
                              label="Autor del Artículo (Opcional)"
                              value={autor}
                              onChange={(e) => setAutor(e.target.value)}
                              placeholder="Ej: Dr. Fabián Salvioli"
                            />
                            <p className="text-xs text-slate-500 mt-1.5 ml-1">
                              Si se deja en blanco, se usará el nombre de tu usuario.
                            </p>
                          </div>

                          <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                              Contenido del Artículo
                            </label>
                            <RichTextEditor 
                              value={contenido}
                              onChange={setContenido}
                              placeholder="Redacte aquí el contenido del artículo, utilice la barra superior para dar formato..."
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                          <div className="md:col-span-2">
                            <div className="flex justify-between items-end mb-1.5">
                              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                Resumen corto para catálogo (Opcional)
                              </label>
                              <button 
                                type="button" 
                                onClick={handleAutoResumen} 
                                disabled={generandoResumen} 
                                className="text-xs font-semibold text-slate-800 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 py-1 px-2.5 rounded-[6px] transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50"
                              >
                                {generandoResumen ? "Generando..." : "✨ Auto-completar con PIDA"}
                              </button>
                            </div>
                            <AdminTextField 
                              label="Resumen corto"
                              multiline
                              rows={2}
                              value={resumen}
                              onChange={(e) => setResumen(e.target.value)}
                              placeholder="Un párrafo breve para atraer al lector en la lista de artículos..."
                              inputProps={{ maxLength: 250 }}
                            />
                          </div>
                          <div className="md:col-span-1">
                            <AdminTextField 
                              label="Fecha (Opcional)"
                              type="datetime-local"
                              value={fechaPersonalizada}
                              onChange={(e) => setFechaPersonalizada(e.target.value)}
                              InputLabelProps={{ shrink: true }}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* FORMULARIO PARA NOTICIAS, LIBROS, INFORMES, CURSOS E INCIDENCIA */}
                    {vistaActiva !== 'equipo' && vistaActiva !== 'articulos' && (<>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                      {vistaActiva !== "informes" && (
                        <div className={(vistaActiva === "libros") ? "md:col-span-1" : "md:col-span-2"}>
                          {vistaActiva === "comunicaciones" ? (
                            <div>
                              <div className="flex justify-between items-center mb-1.5">
                                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                  Título de la Noticia / Comunicado *
                                </label>
                                <button 
                                  type="button" 
                                  onClick={handleAutoResumen} 
                                  disabled={generandoResumen} 
                                  className="text-xs font-semibold text-slate-800 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 py-1 px-2.5 rounded-[6px] transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50"
                                >
                                  {generandoResumen ? "Generando..." : "✨ Auto-título con PIDA"}
                                </button>
                              </div>
                              <AdminTextField 
                                label="Título de la Noticia o Comunicado"
                                value={titulo}
                                onChange={(e) => setTitulo(e.target.value)}
                                required
                                multiline
                                rows={2}
                                placeholder="Ej: Nueva alianza internacional por los DDHH..."
                              />
                            </div>
                          ) : (
                            <AdminTextField 
                              label={vistaActiva === "cursos" ? "Título del Curso" : (vistaActiva === "libros" ? "Título del Libro" : (vistaActiva === "incidencia" ? "Título del Documento" : "Título"))}
                              value={titulo}
                              onChange={(e) => setTitulo(e.target.value)}
                              required
                              placeholder="Ej: Curso de Actualización en Litigio Interamericano..."
                            />
                          )}
                        </div>
                      )}

                      {vistaActiva === "informes" && (
                        <div className="md:col-span-3">
                          <AdminTextField 
                            label="Año del Informe (P.ej. 2024)"
                            type="number"
                            required
                            value={año}
                            onChange={(e) => setAño(e.target.value)}
                            placeholder="Ej: 2024"
                          />
                        </div>
                      )}

                      {vistaActiva === "libros" && (
                        <div className="md:col-span-1">
                          <AdminTextField 
                            label="Precio (USD)"
                            type="number"
                            step="0.01"
                            required
                            value={precio}
                            onChange={(e) => setPrecio(e.target.value)}
                            placeholder="Ej: 25.00"
                          />
                        </div>
                      )}

                      {vistaActiva !== "informes" && (
                        <div className="md:col-span-1">
                          <AdminTextField 
                            label="Fecha (Opcional)"
                            type="datetime-local"
                            value={fechaPersonalizada}
                            onChange={(e) => setFechaPersonalizada(e.target.value)}
                            InputLabelProps={{ shrink: true }}
                          />
                        </div>
                      )}
                    </div>

                    {vistaActiva === "comunicaciones" && (
                      <div className="bg-slate-50 p-4 rounded-l-none rounded-r-[8px] border border-slate-200 border-l-[3px] border-l-slate-700">
                        <AdminTextField 
                          label="Enlace de Video (Opcional - YouTube o Vimeo)"
                          value={videoUrl}
                          onChange={(e) => setVideoUrl(e.target.value)}
                          placeholder="Ej: https://www.youtube.com/watch?v=... o https://youtu.be/..."
                        />
                        <p className="text-xs text-slate-500 mt-1.5 ml-1">
                          Si introduces un enlace de video, se mostrará en el reproductor de la noticia.
                        </p>
                      </div>
                    )}

                    {vistaActiva === "cursos" && (
                      <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-5 bg-slate-50 p-5 rounded-l-none rounded-r-[8px] border border-slate-200 border-l-[3px] border-l-[#0f766e]">
                        <AdminTextField 
                          label="Enlace de Inscripción (Opcional - Google Forms, Zoom, etc.)"
                          type="url"
                          value={enlaceInscripcion}
                          onChange={(e) => setEnlaceInscripcion(e.target.value)}
                          placeholder="https://forms.gle/..."
                        />
                        <div className="flex items-center gap-2 bg-white p-3.5 rounded-[8px] border border-slate-200">
                          <FormControl size="small" fullWidth>
                            <InputLabel id="estado-inscripcion-label">Estado de Inscripción</InputLabel>
                            <Select
                              labelId="estado-inscripcion-label"
                              value={estadoInscripcion}
                              label="Estado de Inscripción"
                              onChange={(e) => {
                                setEstadoInscripcion(e.target.value);
                                setCursoActivo(e.target.value === "abierta");
                              }}
                            >
                              <MenuItem value="abierta">Inscripciones Abiertas</MenuItem>
                              <MenuItem value="cerrada">Inscripciones Cerradas / Finalizado</MenuItem>
                              <MenuItem value="proximamente">Próximamente</MenuItem>
                            </Select>
                          </FormControl>
                        </div>
                      </div>
                    )}

                    {vistaActiva === "libros" && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                          <AdminTextField 
                            label="Autor del Libro"
                            value={autor}
                            onChange={(e) => setAutor(e.target.value)}
                            required
                            placeholder="Ej: Fabián Salvioli"
                          />
                        </div>
                        <div>
                          <AdminTextField 
                            label="Precio (MXN para México)"
                            type="number"
                            step="0.01"
                            required
                            value={precioMXN}
                            onChange={(e) => setPrecioMXN(e.target.value)}
                            placeholder="Ej: 500.00"
                          />
                        </div>
                      </div>
                    )}

                    {vistaActiva !== "informes" && vistaActiva !== "articulos" && (
                    <div>
                      <div className="flex justify-between items-end mb-2">
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                          Síntesis Editorial
                        </span>
                        {vistaActiva !== "cursos" && (
                          <button type="button" onClick={handleAutoResumen} disabled={generandoResumen} className="text-[11px] font-bold text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 py-1.5 px-3 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50">
                            <Sparkles size={13} className="text-[#b91c1c]" />
                            {generandoResumen ? "Generando con IA..." : "Auto-completar con PIDA"}
                          </button>
                        )}
                      </div>
                      <AdminTextField 
                        label={vistaActiva === "incidencia" ? "Resumen / Descripción" : "Resumen corto"}
                        required
                        multiline
                        rows={2}
                        value={resumen}
                        onChange={(e) => setResumen(e.target.value)}
                        placeholder="Un párrafo breve para atraer al lector..."
                        inputProps={{ maxLength: 250 }}
                      />
                    </div>
                    )}

                    {vistaActiva === "comunicaciones" && (
                      <div className="bg-slate-50/90 p-5 rounded-l-none rounded-r-[10px] border border-slate-200 border-l-[3px] border-l-slate-700">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-3">
                          <div>
                            <h3 className="text-[13px] font-extrabold text-slate-900 flex items-center gap-2">
                              Adjuntar Documentos Públicos (Para enlazar)
                            </h3>
                            <p className="text-xs text-slate-500">Sube un archivo al repositorio público para copiar su URL directa.</p>
                          </div>
                          <label htmlFor="input-doc-adjunto" className={`text-xs bg-white border border-slate-200 text-slate-800 hover:bg-slate-100 px-3.5 py-2 rounded-lg font-bold shadow-2xs cursor-pointer transition-colors whitespace-nowrap ${subiendoArchivo ? 'opacity-50 cursor-not-allowed' : ''}`}>
                            {subiendoArchivo ? "Subiendo..." : "+ Subir documento"}
                          </label>
                          <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx" onChange={handleSubirDocumento} className="sr-only" id="input-doc-adjunto" />
                        </div>

                        {archivosAdjuntos.length > 0 && (
                          <ul className="space-y-2 mt-3" aria-label="Documentos adjuntados">
                            {archivosAdjuntos.map((archivo, index) => (
                              <li key={index} className="flex justify-between items-center bg-white p-2.5 rounded-l-none rounded-r-lg border border-slate-200 border-l-[3px] border-l-slate-900">
                                <span className="text-xs font-semibold text-slate-700 truncate mr-3 flex items-center gap-2">
                                  📄 {archivo.nombre}
                                </span>
                                <button type="button" onClick={() => copiarEnlaceDocumento(archivo.nombre, archivo.url)} className="text-[10px] uppercase tracking-wider bg-slate-900 hover:bg-slate-800 text-white font-bold py-1 px-2.5 rounded-md transition-colors shrink-0 cursor-pointer">Copiar URL</button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}

                    {(vistaActiva === "libros" || vistaActiva === "informes" || vistaActiva === "incidencia") && (
                      <div className="bg-slate-50 p-5 rounded-l-none rounded-r-[10px] border border-slate-200 border-l-[3px] border-l-slate-900">
                        <label className="block text-[13px] font-extrabold text-slate-900 mb-1">Documento Oficial en PDF *</label>
                        <p className="text-xs text-slate-500 mb-3.5">Sube el archivo final verificado en formato PDF para descarga pública.</p>
                        
                        <input 
                          type="file" 
                          accept=".pdf" 
                          id="input-archivo-pdf"
                          className="sr-only"
                          onChange={(e) => {
                            if(e.target.files[0]) {
                              if(vistaActiva === "libros") {
                                setArchivoLibro(e.target.files[0]);
                                setArchivoLibroNombre(e.target.files[0].name);
                              } else if (vistaActiva === "informes") {
                                setArchivoInforme(e.target.files[0]);
                                setArchivoInformeNombre(e.target.files[0].name);
                              } else if (vistaActiva === "incidencia") {
                                setArchivoIncidencia(e.target.files[0]);
                                setArchivoIncidenciaNombre(e.target.files[0].name);
                              }
                              e.target.value = ""; 
                            }
                          }}
                        />
                        <div className="flex flex-wrap items-center gap-3">
                          <label htmlFor="input-archivo-pdf" className="inline-block bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-xs font-bold cursor-pointer transition-colors">
                            Seleccionar archivo PDF...
                          </label>
                          {(archivoLibroNombre || archivoLibroAnterior || archivoInformeNombre || archivoInformeAnterior || archivoIncidenciaNombre || archivoIncidenciaAnterior) && (
                            <span className="text-xs text-slate-700 font-semibold truncate max-w-50 md:max-w-xs bg-white px-3 py-1.5 rounded-md border border-slate-200">
                              {archivoLibroNombre || archivoInformeNombre || archivoIncidenciaNombre || "Archivo PDF vinculado (reemplazable)"}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {vistaActiva === "comunicaciones" && (
                      <div id="editor-cuerpo-noticia">
                        <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-600 mb-2">
                          Cuerpo Editorial de la Publicación *
                        </label>
                        <RichTextEditor 
                          value={contenido}
                          onChange={setContenido}
                          placeholder="Redacte aquí el contenido de la noticia. Puede añadir negritas, subtítulos, citas, listas, enlaces y videos..."
                        />
                      </div>
                    )}

                    {vistaActiva !== "informes" && vistaActiva !== "cursos" && vistaActiva !== "incidencia" && vistaActiva !== "articulos" && vistaActiva !== "comunicaciones" && (
                    <div>
                      <AdminTextField 
                        label={vistaActiva === "libros" ? "Descripción Larga / Sinopsis" : "Cuerpo del texto"}
                        required
                        multiline
                        rows={10}
                        value={contenido}
                        onChange={(e) => setContenido(e.target.value)}
                        placeholder={vistaActiva === "libros" ? "Índice o descripción del libro..." : "Escribe o pega el desarrollo de la publicación aquí..."}
                      />
                    </div>
                    )}
                    </>)}

                    {/* MULTIMEDIA */}
                    {vistaActiva !== "incidencia" && (
                    <div className="bg-slate-50/60 border border-slate-200 rounded-xl p-5">
                      <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-4 border-b border-slate-200 pb-2.5 flex items-center gap-2">
                        <ImageIcon size={14} className="text-slate-700" /> Activos Multimedia y Portada
                      </h3>
                      
                      <div id="seccion-portada-principal" className={`mb-5 p-4 rounded-l-none rounded-r-[10px] transition-all ${errorPortada ? 'border border-red-300 border-l-[3px] border-l-red-600 bg-red-50/60' : 'bg-white border border-slate-200 border-l-[3px] border-l-slate-900'}`}>
                        <label className={`block text-[11px] font-extrabold uppercase tracking-wider mb-3 ${errorPortada ? 'text-red-700' : 'text-slate-700'}`}>
                          {vistaActiva === "cursos" ? "Flyer o Portada del Curso *" : (vistaActiva === "libros" ? "Portada del Libro *" : (vistaActiva === "informes" ? "Portada del Informe *" : "Imagen de Portada Principal *"))}
                        </label>
                        {errorPortada && (
                          <p className="text-xs text-red-600 font-bold mb-3 flex items-center gap-1.5">
                            ⚠️ Selecciona una imagen de portada antes de publicar.
                          </p>
                        )}
                        <div className="flex flex-col sm:flex-row items-start gap-4">
                          {mainImagePreviewUrl ? (
                            <div className="flex flex-col items-center gap-1.5">
                              <div className="relative group inline-block">
                                <img src={mainImagePreviewUrl} alt="Vista previa" className="h-28 w-44 object-cover rounded-lg border border-slate-200 block mx-auto shadow-2xs" />
                                <button type="button" onClick={() => { setImagenPrincipal(null); setMainImagePreviewUrl(imagenPrincipalAnterior); }} className="absolute -top-2 -right-2 bg-slate-900 text-white rounded-full w-6 h-6 text-xs flex items-center justify-center shadow hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                  ✕
                                </button>
                              </div>
                              <span className="text-[11px] text-slate-500 font-medium truncate max-w-44 text-center" title={imagenPrincipal ? imagenPrincipal.name : extraerNombreDesdeUrl(mainImagePreviewUrl)}>
                                {imagenPrincipal ? imagenPrincipal.name : extraerNombreDesdeUrl(mainImagePreviewUrl)}
                              </span>
                            </div>
                          ) : (
                            <div className="h-28 w-44 bg-slate-50 rounded-lg border border-dashed border-slate-300 flex flex-col items-center justify-center gap-1 shrink-0">
                              <ImageIcon size={20} className="text-slate-400" />
                              <span className="text-[11px] text-slate-400 font-semibold">Sin portada</span>
                            </div>
                          )}
                          <div className="flex-1">
                            <input 
                              type="file" 
                              accept="image/*" 
                              onChange={handleSeleccionPrincipal} 
                              className="sr-only" 
                              id="input-portada-principal" 
                            />
                            <label htmlFor="input-portada-principal" className="text-xs bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-lg font-bold cursor-pointer inline-block transition-colors">
                              Seleccionar imagen de portada...
                            </label>
                            <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
                              Formatos soportados: JPG, PNG, WebP. El sistema convierte y comprime automáticamente a WebP de alta densidad.
                            </p>
                          </div>
                        </div>
                      </div>

                      {(vistaActiva === "comunicaciones" || vistaActiva === "cursos") && (
                        <div>
                          <label className="block text-[11px] font-extrabold text-slate-600 uppercase tracking-wider mb-2.5">Galería / Carrusel Secundario</label>
                          <input type="file" accept="image/*" multiple onChange={handleAgregarImagenes} className="sr-only" id="input-imagenes-carrusel" />
                          <label htmlFor="input-imagenes-carrusel" className="text-xs bg-white border border-dashed border-slate-300 text-slate-700 hover:text-slate-900 hover:border-slate-400 w-full text-center py-3.5 rounded-lg font-bold cursor-pointer block hover:bg-slate-50 transition-colors mb-4">
                            + Añadir múltiples fotografías a la galería
                          </label>
                          
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                            {carruselExistente.map((url, i) => (
                              <div key={`old-${i}`} className="flex flex-col bg-white p-2 rounded-lg border border-slate-200 gap-1.5">
                                <div className="relative group w-full h-24 rounded overflow-hidden">
                                  <img src={url} className="w-full h-full object-cover" alt="Carrusel" />
                                  <div className="absolute inset-0 bg-slate-900/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <button type="button" onClick={() => setCarruselExistente(prev => prev.filter((_, idx) => idx !== i))} className="text-white hover:text-red-300 font-bold text-[11px] bg-slate-900/80 px-2.5 py-1 rounded cursor-pointer">Eliminar</button>
                                  </div>
                                </div>
                                <span className="text-[10px] font-medium text-slate-500 truncate text-center">{extraerNombreDesdeUrl(url)}</span>
                              </div>
                            ))}

                            {imagenesCarrusel.map((f, i) => (
                              <div key={`new-${i}`} className="flex flex-col bg-emerald-50/60 p-2 rounded-lg border border-emerald-200 gap-1.5">
                                <div className="relative group w-full h-24 rounded overflow-hidden">
                                  <img src={URL.createObjectURL(f)} className="w-full h-full object-cover" alt="Nueva carrusel" />
                                  <span className="absolute top-1 left-1 bg-emerald-600 text-white text-[8px] font-bold px-1.5 py-0.5 rounded uppercase">Nueva</span>
                                  <div className="absolute inset-0 bg-slate-900/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <button type="button" onClick={() => setImagenesCarrusel(prev => prev.filter((_, idx) => idx !== i))} className="text-white hover:text-red-300 font-bold text-[11px] bg-slate-900/80 px-2.5 py-1 rounded cursor-pointer">Quitar</button>
                                  </div>
                                </div>
                                <span className="text-[10px] font-semibold text-emerald-800 truncate text-center">{f.name}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    )}

                    {/* TAGS Y PERSISTENCIA */}
                    {vistaActiva === "comunicaciones" && (
                      <div className="bg-slate-50/60 border border-slate-200 rounded-xl p-5">
                        <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-4 border-b border-slate-200 pb-2.5">
                          Taxonomía y Visibilidad en Portada
                        </h3>
                        <div className="mb-5">
                          <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-2.5">Etiquetas Temáticas (Tags)</label>
                          <div className="flex flex-wrap gap-1.5">
                            {TAGS_DISPONIBLES.map(tag => {
                              const isSelected = tagsSeleccionados.includes(tag);
                              return (
                                <button
                                  type="button"
                                  key={tag}
                                  onClick={() => {
                                    setTagsSeleccionados(prev => 
                                      isSelected ? prev.filter(t => t !== tag) : [...prev, tag]
                                    );
                                  }}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                                    isSelected
                                      ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:text-slate-900'
                                  }`}
                                >
                                  {tag}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="bg-white p-4 rounded-l-none rounded-r-[10px] border border-slate-200 border-l-[3px] border-l-[#b91c1c]">
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={persistente}
                                onChange={(e) => setPersistente(e.target.checked)}
                                sx={{ color: '#94a3b8', '&.Mui-checked': { color: '#b91c1c' } }}
                              />
                            }
                            label={
                              <Box>
                                <span className="text-xs font-extrabold text-slate-900 block">
                                  Fijar publicación en el Carrusel Principal de Inicio (Máximo 3)
                                </span>
                                <span className="text-[11px] text-slate-500 font-normal">
                                  Las publicaciones fijadas mantienen prioridad editorial en la portada de iiresodh.org.
                                </span>
                              </Box>
                            }
                            sx={{ m: 0, alignItems: 'flex-start', '& .MuiFormControlLabel-label': { mt: 0.5 } }}
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col-reverse sm:flex-row gap-3 pt-3 border-t border-slate-100">
                      <button type="button" onClick={handleCancel} className="w-full sm:w-1/3 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 text-xs font-bold py-3.5 rounded-xl transition-colors cursor-pointer">
                        Cancelar / Limpiar
                      </button>
                      <button type="submit" disabled={loading} className={`w-full sm:w-2/3 text-white text-xs font-extrabold uppercase tracking-wider py-3.5 rounded-xl transition-all shadow-xs flex justify-center items-center gap-2 cursor-pointer ${editandoId ? 'bg-[#b91c1c] hover:bg-red-800' : 'bg-slate-900 hover:bg-slate-800'} ${loading ? 'opacity-70 cursor-wait' : ''}`}>
                        {loading ? "Procesando publicación..." : (editandoId ? "Guardar Cambios Editoriales" : "Publicar en Portal Oficial")}
                      </button>
                    </div>
                  </form>
                </section>
              </div>

              {/* LISTA LATERAL DERECHA CON SCROLL INFINITO */}
              <div className="lg:col-span-4">
                <section className="bg-white p-5 rounded-l-none rounded-r-[12px] shadow-[0_1px_3px_rgba(15,23,42,0.03)] border border-slate-200 border-l-[3px] border-l-slate-900 lg:sticky lg:top-24">
                  <div className="flex items-center justify-between mb-3.5 pb-2.5 border-b border-slate-100">
                    <h2 className="text-sm font-extrabold text-slate-900 tracking-tight">
                      Repositorio Publicado
                    </h2>
                    <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md tabular-nums">
                      {listaItems.length} ítems
                    </span>
                  </div>

                  <div className="mb-3.5 flex flex-col gap-2">
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Filtrar por título o nombre..."
                        className="w-full text-xs pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-slate-900 transition-colors"
                        value={busquedaTexto}
                        onChange={(e) => setBusquedaTexto(e.target.value)}
                      />
                    </div>
                    {vistaActiva !== 'equipo' && vistaActiva !== 'informes' && vistaActiva !== 'incidencia' && (
                      <input
                        type="date"
                        className="w-full text-xs px-3 py-2 text-slate-600 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-slate-900 transition-colors tabular-nums"
                        value={busquedaFecha}
                        onChange={(e) => setBusquedaFecha(e.target.value)}
                      />
                    )}
                  </div>

                  <div 
                    className="space-y-2.5 max-h-[65vh] overflow-y-auto custom-scrollbar pr-1 relative"
                    onScroll={handleScrollLista}
                  >
                    {listaItems.length === 0 && !cargandoLista ? (
                      <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        <p className="text-xs text-slate-500 font-semibold">Sin registros en esta vista</p>
                      </div>
                    ) : (
                      listaItems.map((n) => {
                        if (vistaActiva === 'informes') {
                          return (
                            <article key={n.id} className={`group relative overflow-hidden rounded-l-none rounded-r-[10px] border border-l-[3px] transition-all duration-200 h-28 flex flex-col justify-end p-3.5 ${editandoId === n.id ? 'border-red-300 border-l-[#b91c1c] ring-2 ring-red-100' : 'border-slate-200 border-l-slate-900 hover:border-slate-400'}`}>
                              <div className="absolute inset-0 bg-cover bg-top" style={{ backgroundImage: `url(${n.imagenPrincipalUrl || 'https://via.placeholder.com/400x300?text=Sin+Portada'})` }}></div>
                              <div className="absolute inset-0 bg-linear-to-t from-slate-950 via-slate-900/75 to-transparent"></div>
                              
                              <div className="relative z-10 w-full flex justify-between items-end">
                                <div>
                                  <span className="text-[9px] font-extrabold uppercase text-slate-300 tracking-widest block mb-0.5">Memoria Anual</span>
                                  <h3 className="text-white font-extrabold text-sm leading-none tabular-nums">Ejercicio {n.año}</h3>
                                </div>
                                <div className="flex gap-1.5">
                                  <button type="button" onClick={() => handleEditarItem(n)} className="bg-white/95 hover:bg-white text-slate-900 px-2.5 py-1 rounded text-[11px] font-bold transition-colors cursor-pointer">Editar</button>
                                  <button type="button" onClick={() => pedirConfirmacionBorrado(n.id, `Informe Anual ${n.año}`)} className="bg-red-600/90 hover:bg-red-600 text-white px-2 py-1 rounded text-[11px] font-bold transition-colors cursor-pointer">✕</button>
                                </div>
                              </div>
                            </article>
                          );
                        }

                        return (
                          <article key={n.id} className={`group flex flex-col p-3 rounded-l-none rounded-r-[10px] border border-l-[3px] transition-all duration-150 ${editandoId === n.id ? 'bg-red-50/50 border-red-200 border-l-[#b91c1c]' : n.persistente ? 'bg-amber-50/30 border-slate-200 border-l-amber-600' : 'bg-white border-slate-200 border-l-slate-800 hover:border-slate-300'}`}>
                            <div className="flex gap-2.5 items-start mb-2.5">
                              <div className="relative w-10 h-10 rounded-md overflow-hidden shrink-0 bg-slate-100 border border-slate-200 flex items-center justify-center">
                                {(n.imagenPrincipalUrl || n.fotoUrl) ? (
                                  <img src={n.imagenPrincipalUrl || n.fotoUrl} className="w-full h-full object-cover" alt="Miniatura" />
                                ) : (
                                  <span className="text-[9px] font-extrabold text-slate-400">DOC</span>
                                )}
                              </div>
                              
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-col gap-0.5">
                                  <div className="flex items-center gap-1.5">
                                    {n.persistente && (
                                      <span className="text-[8px] font-extrabold text-amber-800 uppercase bg-amber-100 px-1.5 py-0.5 rounded">Fijada</span>
                                    )}
                                    <h3 className="font-bold text-xs text-slate-900 line-clamp-2 leading-snug" title={n.titulo || n.nombre}>{n.titulo || n.nombre}</h3>
                                  </div>
                                  <div className="flex items-center justify-between gap-1 mt-1">
                                    <p className="text-[10px] text-slate-400 truncate max-w-[140px] tabular-nums">
                                      {vistaActiva === 'equipo' ? `#${n.orden} · ${n.cargo}` : `/${obtenerColeccionActiva()}/${n.slug || n.id}`}
                                    </p>
                                    <div className="flex items-center gap-1 shrink-0" title="Estado de traducciones">
                                      <span className="text-[8px] font-extrabold px-1 py-0.2 rounded bg-slate-100 text-slate-700">ES</span>
                                      <span className={`text-[8px] font-extrabold px-1 py-0.2 rounded ${n.titulo_en || n.nombre_en ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-50 text-slate-300'}`} title={n.titulo_en || n.nombre_en ? "Traducido al inglés" : "Pendiente inglés"}>EN</span>
                                      <span className={`text-[8px] font-extrabold px-1 py-0.2 rounded ${n.titulo_fr || n.nombre_fr ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-slate-50 text-slate-300'}`} title={n.titulo_fr || n.nombre_fr ? "Traducido al francés" : "Pendiente francés"}>FR</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-1.5 w-full pt-1.5 border-t border-slate-100">
                              <button type="button" onClick={() => handleEditarItem(n)} className="flex-1 bg-slate-50 hover:bg-slate-900 text-slate-700 hover:text-white border border-slate-200 hover:border-slate-900 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer">Editar</button>
                              <button type="button" onClick={() => pedirConfirmacionBorrado(n.id, n.titulo || n.nombre)} className="px-2.5 bg-slate-50 hover:bg-red-50 border border-slate-200 hover:border-red-200 text-slate-400 hover:text-red-600 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer">✕</button>
                            </div>
                          </article>
                        );
                      })
                    )}
                    
                    {cargandoLista && (
                      <div className="flex justify-center py-4">
                        <CircularProgress size={20} sx={{ color: '#0f172a' }} />
                      </div>
                    )}
                  </div>
                </section>
              </div>
            </div>
          </div>
        )}

        {/* ADMINISTRACIÓN WEB (TITULOS DEL HOME, GESTIÓN DE ROLES Y AUDITORÍA) */}
        {vistaActiva === "adminWeb" && (
          <div className="animate-fade-in-up space-y-6">
            <div className="flex items-center justify-between bg-white px-4 py-3 rounded-xl border border-slate-200 shadow-2xs">
              <button onClick={() => setVistaActiva("inicio")} className="flex items-center gap-2 text-slate-700 hover:text-slate-900 font-bold text-xs transition-colors cursor-pointer">
                <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center">
                  <ArrowLeft size={14} />
                </div>
                Volver al catálogo CMS
              </button>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                Configuración Global, Permisos y Auditoría Web
              </span>
            </div>

            {/* CONFIGURACIÓN VISUAL HOME */}
            <section className="bg-white p-6 md:p-8 rounded-l-none rounded-r-[12px] shadow-[0_1px_3px_rgba(15,23,42,0.03)] border border-slate-200 border-l-[3px] border-l-slate-900">
              <header className="mb-6 pb-4 border-b border-slate-100 flex justify-between items-center">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#b91c1c] block mb-1">
                    Portada Pública · iiresodh.org
                  </span>
                  <h2 className="text-lg font-extrabold tracking-tight text-slate-900">Titulares Multilingües de Portada (Home)</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Define el lema institucional principal en español, inglés y francés.</p>
                </div>
              </header>
              {cargandoConfig ? (
                <div className="flex justify-center p-4"><CircularProgress size={24} sx={{ color: '#0f172a' }} /></div>
              ) : (
                <form onSubmit={guardarConfiguracionVisual} className="space-y-4">
                  <div className="bg-slate-50/70 p-5 rounded-xl border border-slate-200 space-y-4">
                    <AdminTextField 
                      label="Título Principal de la Portada (Español)" 
                      multiline 
                      rows={2} 
                      value={tituloHome.tituloPrincipal || ""} 
                      onChange={e => setTituloHome({...tituloHome, tituloPrincipal: e.target.value})} 
                      required 
                      placeholder="Ej: Defendiendo la dignidad y los Derechos Humanos" 
                    />
                    <AdminTextField 
                      label="Título Principal de la Portada (Inglés)" 
                      multiline 
                      rows={2} 
                      value={tituloHome.tituloPrincipal_en || ""} 
                      onChange={e => setTituloHome({...tituloHome, tituloPrincipal_en: e.target.value})} 
                      placeholder="Ej: Defending dignity and Human Rights" 
                    />
                    <AdminTextField 
                      label="Título Principal de la Portada (Francés)" 
                      multiline 
                      rows={2} 
                      value={tituloHome.tituloPrincipal_fr || ""} 
                      onChange={e => setTituloHome({...tituloHome, tituloPrincipal_fr: e.target.value})} 
                      placeholder="Ej: Défendre la dignité et les droits de l'homme" 
                    />
                  </div>
                  <div className="flex justify-end">
                    <button type="submit" disabled={guardandoConfig} className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-50">
                      {guardandoConfig ? "Guardando..." : "Guardar Titulares de Portada"}
                    </button>
                  </div>
                </form>
              )}
            </section>

            {/* GESTIÓN DE PERMISOS DE USUARIOS (SOLO WEBMASTER) */}
            {auth.currentUser?.email === "webmaster@iiresodh.org" && (
              <section className="bg-white p-6 md:p-8 rounded-l-none rounded-r-[12px] shadow-[0_1px_3px_rgba(15,23,42,0.03)] border border-slate-200 border-l-[3px] border-l-[#0f766e]">
                <header className="mb-6 pb-4 border-b border-slate-100">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#0f766e] block mb-1">
                    Control de Acceso Editorial
                  </span>
                  <h2 className="text-lg font-extrabold tracking-tight text-slate-900">
                    Permisos de Editores del Portal Web
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Habilita cuentas institucionales (@iiresodh.org) y asigna permisos granulares por colección.
                  </p>
                </header>

                <form onSubmit={handleAgregarAdmin} className="bg-slate-50/70 p-5 rounded-xl border border-slate-200 mb-6 space-y-4">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">Autorizar Nuevo Editor</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div className="md:col-span-2">
                      <AdminTextField 
                        label="Correo Institucional (@iiresodh.org)" 
                        type="email" 
                        required 
                        value={nuevoEmailAdmin} 
                        onChange={e => setNuevoEmailAdmin(e.target.value)} 
                        placeholder="ejemplo@iiresodh.org"
                      />
                    </div>
                    <div>
                      <button type="submit" disabled={loading} className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-50">
                        {loading ? "Autorizando..." : "Autorizar Editor Web"}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 pt-1">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Módulos habilitados:</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                      {Object.keys(nuevoPermisos).map(key => (
                        <FormControlLabel
                          key={key}
                          control={
                            <Checkbox 
                              size="small"
                              checked={nuevoPermisos[key]} 
                              onChange={e => setNuevoPermisos({ ...nuevoPermisos, [key]: e.target.checked })}
                              sx={{ color: '#94a3b8', '&.Mui-checked': { color: '#0f172a' } }}
                            />
                          }
                          label={
                            <span className="text-xs font-semibold text-slate-700 capitalize">
                              {key === "comunicaciones" ? "Noticias" : key === "adminWeb" ? "Admin Web" : key === "auditoria" ? "Auditoría" : key}
                            </span>
                          }
                        />
                      ))}
                    </div>
                  </div>
                </form>

                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-3">Editores Autorizados</h3>
                {cargandoAdmins ? (
                  <div className="flex justify-center p-6"><CircularProgress size={24} sx={{ color: '#0f172a' }} /></div>
                ) : usuariosAdmins.length > 0 ? (
                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                          <th className="p-3.5">Cuenta Institucional</th>
                          <th className="p-3.5">Colecciones Habilitadas</th>
                          <th className="p-3.5 text-center">Estado</th>
                          <th className="p-3.5 text-center">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                        {usuariosAdmins.map(u => (
                          <tr key={u.email} className="hover:bg-slate-50/70">
                            <td className="p-3.5 font-bold text-slate-900">{u.email}</td>
                            <td className="p-3.5">
                              <div className="flex flex-wrap gap-1">
                                {Object.keys(nuevoPermisos).map(key => {
                                  const tienePermiso = u.permisos?.[key] ?? false;
                                  return (
                                    <button
                                      type="button"
                                      key={key}
                                      onClick={() => handleTogglePermisoAdmin(u.email, key, tienePermiso)}
                                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer border ${
                                        tienePermiso
                                          ? 'bg-slate-900 text-white border-slate-900'
                                          : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
                                      }`}
                                    >
                                      {key === "comunicaciones" ? "Noticias" : key === "adminWeb" ? "Admin Web" : key === "auditoria" ? "Auditoría" : key}
                                    </button>
                                  );
                                })}
                              </div>
                            </td>
                            <td className="p-3.5 text-center">
                              <button
                                type="button"
                                onClick={() => handleToggleActivoAdmin(u.email, u.activo || u.active)}
                                className={`px-2.5 py-1 rounded-md text-[11px] font-bold border cursor-pointer ${
                                  u.activo || u.active
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-red-50 text-red-700 border-red-200'
                                }`}
                              >
                                {u.activo || u.active ? "Activo" : "Suspendido"}
                              </button>
                            </td>
                            <td className="p-3.5 text-center">
                              <button
                                type="button"
                                onClick={() => {
                                  if(window.confirm(`¿Estás seguro de que deseas revocar permanentemente el acceso para ${u.email}?`)) {
                                    handleEliminarAdmin(u.email);
                                  }
                                }}
                                className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-white hover:bg-red-50 text-red-600 border border-red-200 transition-colors cursor-pointer"
                              >
                                Revocar
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-center text-slate-400 py-6 text-xs border border-dashed border-slate-200 rounded-xl">
                    No hay editores adicionales registrados.
                  </p>
                )}
              </section>
            )}

            {/* AUDITORÍA */}
            {misPermisos.auditoria && (
              <section className="bg-white p-6 md:p-8 rounded-l-none rounded-r-[12px] shadow-[0_1px_3px_rgba(15,23,42,0.03)] border border-slate-200 border-l-[3px] border-l-slate-700">
                <header className="mb-5 pb-4 border-b border-slate-100">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 block mb-1">
                    Trazabilidad de Operaciones
                  </span>
                  <h2 className="text-lg font-extrabold tracking-tight text-slate-900">
                    Bitácora de Auditoría del Portal Público
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Registro cronológico de altas, ediciones y bajas en las colecciones de iiresodh.org.
                  </p>
                </header>

                <div className="flex flex-col sm:flex-row gap-3 mb-5 p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <FormControl size="small" fullWidth>
                    <InputLabel id="filtro-usuario-label">Editor</InputLabel>
                    <Select
                      labelId="filtro-usuario-label"
                      value={filtroUsuario}
                      label="Editor"
                      onChange={(e) => setFiltroUsuario(e.target.value)}
                      sx={{ bgcolor: '#fff', borderRadius: '8px', fontSize: '0.82rem' }}
                    >
                      <MenuItem value="todos"><em>Todos los editores</em></MenuItem>
                      {usuariosUnicos.map(em => (
                        <MenuItem key={em} value={em}>{em}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <FormControl size="small" fullWidth>
                    <InputLabel id="orden-actividad-label">Orden cronológico</InputLabel>
                    <Select
                      labelId="orden-actividad-label"
                      value={ordenActividad}
                      label="Orden cronológico"
                      onChange={(e) => setOrdenActividad(e.target.value)}
                      sx={{ bgcolor: '#fff', borderRadius: '8px', fontSize: '0.82rem' }}
                    >
                      <MenuItem value="desc">Más recientes primero</MenuItem>
                      <MenuItem value="asc">Más antiguos primero</MenuItem>
                    </Select>
                  </FormControl>

                  <button
                    type="button"
                    onClick={() => cargarActividades(false)}
                    disabled={cargandoActividades && !cargandoMas}
                    className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
                  >
                    {cargandoActividades && !cargandoMas ? 'Consultando...' : 'Consultar Bitácora'}
                  </button>
                </div>

                <div className="space-y-2.5 max-h-[50vh] overflow-y-auto custom-scrollbar pr-1">
                  {cargandoActividades && !cargandoMas ? (
                    <div className="text-center py-10"><CircularProgress size={26} sx={{ color: '#0f172a' }} /></div>
                  ) : actividades.length > 0 ? (
                    actividades.map(act => (
                      <div key={act.id} className="p-3.5 rounded-l-none rounded-r-lg bg-slate-50/80 border border-slate-200 border-l-[3px] border-l-slate-900 flex justify-between items-start">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-xs text-slate-900 wrap-break-word">{act.accion}</p>
                          {act.detalles && (
                            <p className="text-[11px] text-slate-600 mt-1 pl-2.5 border-l-2 border-slate-300 italic">{act.detalles}</p>
                          )}
                          <p className="text-[10px] font-semibold text-slate-500 mt-1">{act.usuarioEmail}</p>
                        </div>
                        <p className="text-[10px] text-slate-500 font-bold shrink-0 ml-3 tabular-nums">
                          {act.timestamp?.toDate ? act.timestamp.toDate().toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-slate-400 py-8 text-xs border border-dashed border-slate-200 rounded-xl">
                      Presiona "Consultar Bitácora" para cargar los eventos de auditoría.
                    </p>
                  )}
                </div>

                {actividades.length > 0 && hayMasActividades && (
                  <div className="mt-5 text-center">
                    <button
                      type="button"
                      onClick={() => cargarActividades(true)}
                      disabled={cargandoMas}
                      className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                    >
                      {cargandoMas ? 'Cargando...' : 'Cargar eventos anteriores'}
                    </button>
                  </div>
                )}
              </section>
            )}
          </div>
        )}

        {/* ESTADÍSTICAS */}
        {vistaActiva === "estadisticas" && (
          <div className="animate-fade-in-up space-y-6">
            <div className="flex items-center justify-between bg-white px-4 py-3 rounded-xl border border-slate-200 shadow-2xs">
              <button onClick={() => setVistaActiva("inicio")} className="flex items-center gap-2 text-slate-700 hover:text-slate-900 font-bold text-xs transition-colors cursor-pointer">
                <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center">
                  <ArrowLeft size={14} />
                </div>
                Volver al catálogo CMS
              </button>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                Analítica y Telemetría Web
              </span>
            </div>

            <section className="bg-white p-8 rounded-l-none rounded-r-[12px] shadow-[0_1px_3px_rgba(15,23,42,0.03)] border border-slate-200 border-l-[3px] border-l-slate-900 text-center py-14">
              <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-900 flex items-center justify-center mx-auto mb-3">
                <BarChart3 size={22} />
              </div>
              <h2 className="text-lg font-extrabold text-slate-900 mb-1">Telemetría y Alcance Editorial</h2>
              <p className="text-xs text-slate-500 mb-6 max-w-md mx-auto">
                Visualización de tráfico, lecturas e impacto internacional conectada a Google Analytics 4 de iiresodh.org.
              </p>
              <div className="p-6 bg-slate-50 rounded-xl border border-dashed border-slate-200 max-w-md mx-auto">
                <p className="text-xs font-semibold text-slate-500">Módulo de sincronización analítica activa.</p>
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
