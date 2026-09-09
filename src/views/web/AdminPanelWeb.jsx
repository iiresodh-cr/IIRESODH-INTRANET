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
  ExternalLink 
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

export const formatearTextoConLinksYHashtags = (texto) => {
  if (!texto) return "";
  let procesado = texto.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const linksGuardados = [];

  procesado = procesado.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (match, label, url) => {
    linksGuardados.push(`<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-main-red font-bold underline wrap-break-words">${label}</a>`);
    return `__LINK_${linksGuardados.length - 1}__`; 
  });

  procesado = procesado.replace(/(https?:\/\/[^\s]+)/g, (match, url) => {
    if (url.includes("__LINK_")) return match; 
    const textoFijo = "clic aquí";
    linksGuardados.push(`<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-main-red font-bold underline wrap-break-words">${textoFijo}</a>`);
    return `__LINK_${linksGuardados.length - 1}__`; 
  });

  procesado = procesado.replace(/(#[a-zA-Z0-9_áéíóúÁÉÍÓÚñÑ]+)/g, (match) => {
    const term = match.substring(1);
    return `<a href="https://iiresodh.org/buscar?q=${term}" target="_blank" rel="noopener noreferrer" class="text-light-blue hover:text-main-red font-bold">${match}</a>`;
  });

  procesado = procesado.replace(/__LINK_(\d+)__/g, (match, i) => linksGuardados[i]);
  const parrafos = procesado.split(/\n\s*\n/);
  return parrafos.map(p => `<p>${p.replace(/\n/g, '<br />')}</p>`).join('');
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
        setMensaje("Error: Por favor selecciona una imagen para la portada.");
        window.scrollTo({ top: 0, behavior: "smooth" });
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
        const mensajeExito = vistaActiva === 'equipo' ? "¡Miembro del equipo actualizado!" : "¡Contenido actualizado con éxito!";
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
        await addDoc(collection(db, coleccion), datos);
        await logActividad(`Creó un item en "${vistaActiva}": ${datos.titulo || datos.nombre}`, detallesString);
        const mensajeExito = vistaActiva === 'equipo' ? "¡Miembro del equipo agregado!" : "¡Contenido publicado con éxito!";
        setMensaje(mensajeExito);
      }

      limpiarFormulario();
      cargarItems(); 
    } catch (err) {
      console.error(err);
      setMensaje("Error en el proceso.");
    } finally {
      setLoading(false);
      setTimeout(() => setMensaje(""), 3000);
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
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 2 }}>
        <CircularProgress size={50} sx={{ color: '#1a365d' }} />
        <Typography variant="body1" fontWeight="bold" color="text.secondary">
          Conectando con el servidor web (iiresodh.org)...
        </Typography>
      </Box>
    );
  }

  // Si no está autenticado en la app secundaria de la web, mostrar pantalla de conexión
  if (!userWeb) {
    return (
      <Box sx={{ maxWidth: 520, mx: 'auto', mt: 6, p: 2 }}>
        <Paper 
          elevation={0} 
          sx={{ 
            p: 4, 
            borderRadius: 4, 
            textAlign: 'center', 
            border: '1px solid #e2e8f0',
            bgcolor: '#ffffff',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
          }}
        >
          <Box sx={{ mb: 3, display: 'flex', justifyContent: 'center' }}>
            <img 
              src="/logo.png" 
              alt="Logo IIRESODH" 
              style={{ maxHeight: '48px', width: 'auto', objectFit: 'contain' }} 
            />
          </Box>

          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, px: 2, py: 0.5, mb: 2, bgcolor: '#eff6ff', borderRadius: 99, color: '#1d4ed8' }}>
            <Globe size={16} />
            <Typography variant="caption" fontWeight="bold">
              Módulo de Administración Web
            </Typography>
          </Box>

          <Typography variant="h5" fontWeight="bold" color="#1a365d" gutterBottom>
            Gestión del Sitio Público (iiresodh.org)
          </Typography>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 4, lineHeight: 1.6 }}>
            Para publicar noticias, gestionar el catálogo editorial, cursos y contenidos institucionales, conecta tu credencial de administrador de <strong>@iiresodh.org</strong>.
          </Typography>

          {errorAuthWeb && (
            <Alert severity="error" sx={{ mb: 3, borderRadius: 2, textAlign: 'left' }}>
              {errorAuthWeb}
            </Alert>
          )}

          <Button
            variant="contained"
            fullWidth
            startIcon={<LogIn size={18} />}
            onClick={handleConectarWeb}
            disabled={conectandoWeb}
            sx={{
              py: 1.5,
              borderRadius: 2,
              bgcolor: '#1a365d',
              fontWeight: 'bold',
              textTransform: 'none',
              fontSize: '0.95rem',
              '&:hover': { bgcolor: '#0f233c' }
            }}
          >
            {conectandoWeb ? "Conectando..." : "Conectar con @iiresodh.org"}
          </Button>

          <Button
            variant="outlined"
            fullWidth
            startIcon={<ArrowLeft size={16} />}
            onClick={onVolver}
            sx={{
              mt: 2,
              py: 1.2,
              borderRadius: 2,
              borderColor: '#cbd5e1',
              color: 'text.secondary',
              textTransform: 'none',
              fontWeight: 'medium'
            }}
          >
            Volver al Menú Principal
          </Button>
        </Paper>
      </Box>
    );
  }

  // Si está autenticado pero no tiene ningún permiso activo y hay un error de privilegios
  if (errorAuthWeb) {
    return (
      <Box sx={{ maxWidth: 520, mx: 'auto', mt: 6, p: 2 }}>
        <Paper elevation={0} sx={{ p: 4, borderRadius: 4, textAlign: 'center', border: '1px solid #fee2e2', bgcolor: '#fff' }}>
          <ShieldCheck size={48} style={{ color: '#ef4444', margin: '0 auto 16px' }} />
          <Typography variant="h6" fontWeight="bold" color="error.main" gutterBottom>
            Acceso no autorizado al panel web
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 4, lineHeight: 1.6 }}>
            {errorAuthWeb}
          </Typography>
          <Button variant="contained" onClick={onVolver} sx={{ bgcolor: '#1a365d', textTransform: 'none', borderRadius: 2, px: 4, py: 1.2 }}>
            Regresar a la Intranet
          </Button>
          <Button variant="text" color="error" onClick={handleDesconectarWeb} sx={{ display: 'block', mx: 'auto', mt: 2, textTransform: 'none' }}>
            Desconectar cuenta web
          </Button>
        </Paper>
      </Box>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50/50 font-sans relative">
      <ConfirmDialog 
        open={modalBorrar.isOpen}
        title="¿Eliminar publicación?"
        content={`Estás a punto de borrar permanentemente: "${modalBorrar.titulo}". Esta acción no se puede deshacer.`}
        onCancel={() => setModalBorrar({ isOpen: false, id: null, titulo: "" })}
        onConfirm={ejecutarBorrado}
      />

      {/* HEADER DE INTEGRACIÓN CON LA INTRANET */}
      <header className="bg-white sticky top-0 z-30 p-4 shadow-xs border-b border-gray-200 flex flex-wrap justify-between items-center px-4 md:px-8 mb-6 rounded-2xl gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="outlined"
            size="small"
            startIcon={<ArrowLeft size={16} />}
            onClick={onVolver}
            sx={{
              textTransform: 'none',
              borderRadius: 2,
              borderColor: '#cbd5e1',
              color: '#334155',
              fontWeight: 'medium'
            }}
          >
            Volver a la Intranet
          </Button>

          <span className="hidden md:inline-block border-l border-gray-300 h-6" />

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 bg-blue-50 text-main-blue font-bold px-3 py-1 rounded-full text-xs">
              <Globe size={14} /> iiresodh.org
            </span>
            <span className="font-bold text-gray-700 text-sm hidden sm:inline">
              Panel Administrativo del Sitio Web
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {userWeb && (
            <span className="text-xs text-gray-500 font-medium hidden lg:inline">
              Sesión Web: <strong className="text-main-blue">{userWeb.email}</strong>
            </span>
          )}

          <a 
            href="https://iiresodh.org" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-xs text-gray-500 hover:text-main-blue flex items-center gap-1 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg font-medium transition-colors"
          >
            Ver Sitio Público <ExternalLink size={12} />
          </a>

          <button 
            onClick={handleDesconectarWeb} 
            className="text-xs bg-white border border-gray-200 text-gray-600 hover:text-main-red hover:border-main-red px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1 cursor-pointer"
            title="Desconectar credencial web"
          >
            <LogOut size={13} />
            Desconectar
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto">
        <ToastAlert 
          open={!!mensaje} 
          message={mensaje} 
          isError={mensaje.includes("Error")} 
          onClose={() => setMensaje("")} 
        />

        {vistaActiva === "inicio" && (
          <section className="animate-fade-in-up" aria-labelledby="admin-title">
            <div className="mb-8 text-center md:text-left">
              <h1 id="admin-title" className="text-2xl md:text-3xl font-bold text-main-blue tracking-tight mb-2">
                Administración de iiresodh.org
              </h1>
              <p className="text-gray-500 text-base">
                Selecciona el módulo del portal público que deseas gestionar.
              </p>
            </div>

            <nav className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6" aria-label="Departamentos administrativos">
              {/* NOTICIAS Y COMUNICADOS */}
              <button 
                onClick={() => setVistaActiva("comunicaciones")} 
                disabled={!misPermisos.comunicaciones}
                className={`bg-white border border-gray-200 p-8 rounded-3xl shadow-xs transition-all duration-300 flex flex-col items-center justify-center gap-4 group text-center ${
                  !misPermisos.comunicaciones ? "opacity-40 cursor-not-allowed pointer-events-none" : "hover:shadow-lg hover:-translate-y-1 hover:border-main-blue/40 cursor-pointer"
                }`}
              >
                <div className="p-4 bg-blue-50 text-main-blue rounded-2xl group-hover:bg-main-blue group-hover:text-white transition-colors duration-300">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10l4 4v10a2 2 0 01-2 2z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 8h8M8 12h8M8 16h4"></path></svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-800 mb-1">Noticias y Comunicados</h2>
                  <p className="text-xs text-gray-500">Publicaciones en portada y noticias</p>
                </div>
              </button>
              
              {/* ARTÍCULOS ACADÉMICOS */}
              <button 
                onClick={() => setVistaActiva("articulos")} 
                disabled={!misPermisos.articulos}
                className={`bg-white border border-gray-200 p-8 rounded-3xl shadow-xs transition-all duration-300 flex flex-col items-center justify-center gap-4 group text-center ${
                  !misPermisos.articulos ? "opacity-40 cursor-not-allowed pointer-events-none" : "hover:shadow-lg hover:-translate-y-1 hover:border-main-red/40 cursor-pointer"
                }`}
              >
                <div className="p-4 bg-red-50 text-main-red rounded-2xl group-hover:bg-main-red group-hover:text-white transition-colors duration-300">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477-4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-800 mb-1">Artículos Académicos</h2>
                  <p className="text-xs text-gray-500">Investigaciones y doctrina</p>
                </div>
              </button>

              {/* CURSOS */}
              <button 
                onClick={() => setVistaActiva("cursos")} 
                disabled={!misPermisos.cursos}
                className={`bg-white border border-gray-200 p-8 rounded-3xl shadow-xs transition-all duration-300 flex flex-col items-center justify-center gap-4 group text-center ${
                  !misPermisos.cursos ? "opacity-40 cursor-not-allowed pointer-events-none" : "hover:shadow-lg hover:-translate-y-1 hover:border-orange-500/40 cursor-pointer"
                }`}
              >
                <div className="p-4 bg-orange-50 text-orange-600 rounded-2xl group-hover:bg-orange-600 group-hover:text-white transition-colors duration-300">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 14l9-5-9-5-9 5 9 5z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"></path></svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-800 mb-1">Cursos</h2>
                  <p className="text-xs text-gray-500">Oferta académica y capacitaciones</p>
                </div>
              </button>

              {/* TIENDA EDITORIAL */}
              <button 
                onClick={() => setVistaActiva("libros")} 
                disabled={!misPermisos.libros}
                className={`bg-white border border-gray-200 p-8 rounded-3xl shadow-xs transition-all duration-300 flex flex-col items-center justify-center gap-4 group text-center ${
                  !misPermisos.libros ? "opacity-40 cursor-not-allowed pointer-events-none" : "hover:shadow-lg hover:-translate-y-1 hover:border-green-500/40 cursor-pointer"
                }`}
              >
                <div className="p-4 bg-green-50 text-green-600 rounded-2xl group-hover:bg-green-600 group-hover:text-white transition-colors duration-300">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-800 mb-1">Tienda Editorial</h2>
                  <p className="text-xs text-gray-500">Catálogo de libros y publicaciones</p>
                </div>
              </button>

              {/* EQUIPO DE TRABAJO */}
              <button 
                onClick={() => setVistaActiva("equipo")} 
                disabled={!misPermisos.equipo}
                className={`bg-white border border-gray-200 p-8 rounded-3xl shadow-xs transition-all duration-300 flex flex-col items-center justify-center gap-4 group text-center ${
                  !misPermisos.equipo ? "opacity-40 cursor-not-allowed pointer-events-none" : "hover:shadow-lg hover:-translate-y-1 hover:border-purple-500/40 cursor-pointer"
                }`}
              >
                <div className="p-4 bg-purple-50 text-purple-600 rounded-2xl group-hover:bg-purple-600 group-hover:text-white transition-colors duration-300">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-800 mb-1">Equipo de Trabajo</h2>
                  <p className="text-xs text-gray-500">Directorio institucional y cargos</p>
                </div>
              </button>

              {/* INFORMES ANUALES */}
              <button 
                onClick={() => setVistaActiva("informes")} 
                disabled={!misPermisos.informes}
                className={`bg-white border border-gray-200 p-8 rounded-3xl shadow-xs transition-all duration-300 flex flex-col items-center justify-center gap-4 group text-center ${
                  !misPermisos.informes ? "opacity-40 cursor-not-allowed pointer-events-none" : "hover:shadow-lg hover:-translate-y-1 hover:border-teal-500/40 cursor-pointer"
                }`}
              >
                <div className="p-4 bg-teal-50 text-teal-600 rounded-2xl group-hover:bg-teal-600 group-hover:text-white transition-colors duration-300">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-800 mb-1">Informes Anuales</h2>
                  <p className="text-xs text-gray-500">Memorias institucionales (PDF)</p>
                </div>
              </button>
              
              {/* INCIDENCIA */}
              <button 
                onClick={() => setVistaActiva("incidencia")} 
                disabled={!misPermisos.incidencia}
                className={`bg-white border border-gray-200 p-8 rounded-3xl shadow-xs transition-all duration-300 flex flex-col items-center justify-center gap-4 group text-center ${
                  !misPermisos.incidencia ? "opacity-40 cursor-not-allowed pointer-events-none" : "hover:shadow-lg hover:-translate-y-1 hover:border-rose-500/40 cursor-pointer"
                }`}
              >
                <div className="p-4 bg-rose-50 text-rose-600 rounded-2xl group-hover:bg-rose-600 group-hover:text-white transition-colors duration-300">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10l4 4v10a2 2 0 01-2 2z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 4v16m8-8H4"></path></svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-800 mb-1">Incidencia Internacional</h2>
                  <p className="text-xs text-gray-500">Documentos por país</p>
                </div>
              </button>

              {/* ADMINISTRACIÓN WEB & PERMISOS */}
              <button 
                onClick={() => setVistaActiva("adminWeb")} 
                disabled={!misPermisos.adminWeb && auth.currentUser?.email !== "webmaster@iiresodh.org"}
                className={`bg-white border border-gray-200 p-8 rounded-3xl shadow-xs transition-all duration-300 flex flex-col items-center justify-center gap-4 group text-center ${
                  (!misPermisos.adminWeb && auth.currentUser?.email !== "webmaster@iiresodh.org") ? "opacity-40 cursor-not-allowed pointer-events-none" : "hover:shadow-lg hover:-translate-y-1 hover:border-yellow-500/40 cursor-pointer"
                }`}
              >
                <div className="p-4 bg-yellow-50 text-yellow-600 rounded-2xl group-hover:bg-yellow-600 group-hover:text-white transition-colors duration-300">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-800 mb-1">Administración Web</h2>
                  <p className="text-xs text-gray-500">Permisos, auditoría y textos</p>
                </div>
              </button>
            </nav>
          </section>
        )}

        {(vistaActiva !== "inicio" && vistaActiva !== "adminWeb" && vistaActiva !== "estadisticas") && (
          <div className="animate-fade-in-up">
            <button onClick={() => { limpiarFormulario(); setVistaActiva("inicio"); }} className="mb-6 flex items-center gap-2 text-gray-500 font-medium hover:text-main-blue transition-colors cursor-pointer group">
              <div className="bg-white p-1.5 rounded-full shadow-xs group-hover:shadow border border-gray-200 transition-all">
                <ArrowLeft size={16} />
              </div>
              Regresar al menú de módulos web
            </button>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-8 space-y-8">
                <section className="bg-white p-6 md:p-8 rounded-2xl shadow-xs border border-gray-200" aria-labelledby="form-title">
                  <header className="mb-6 flex items-center justify-between">
                    <div>
                      <h2 id="form-title" className={`text-xl md:text-2xl font-bold tracking-tight ${editandoId ? 'text-main-red' : 'text-gray-800'}`}>
                        {editandoId ? 
                          (vistaActiva === 'equipo' ? "Editando Miembro" : (vistaActiva === 'informes' ? "Editando Informe" : (vistaActiva === 'incidencia' ? "Editando Documento" : (vistaActiva === 'articulos' ? "Editando Artículo" : (vistaActiva === 'comunicaciones' ? "Editando Noticia o Comunicado" : "Editando Publicación"))))) : 
                          (vistaActiva === "articulos" ? "Redactar Nuevo Artículo" : (vistaActiva === "libros" ? "Registrar Nuevo Libro" : (vistaActiva === 'equipo' ? "Agregar Miembro" : (vistaActiva === 'informes' ? "Cargar Nuevo Informe" : (vistaActiva === 'incidencia' ? "Cargar Nuevo Documento" : (vistaActiva === 'comunicaciones' ? "Crear Noticia o Comunicado" : "Crear Nueva Publicación"))))))
                        }
                      </h2>
                      <p className="text-xs text-gray-500 mt-1">
                        {vistaActiva === "articulos" ? 
                          "Utiliza el editor visual para redactar contenido académico con formato." :
                          `Módulo: ${
                            vistaActiva === "comunicaciones" ? "Noticias y Comunicados" :
                            vistaActiva === "libros" ? "Tienda Editorial" :
                            vistaActiva === "informes" ? "Informes Anuales" :
                            vistaActiva === "incidencia" ? "Incidencia Internacional" :
                            vistaActiva === "cursos" ? "Cursos y Talleres" :
                            "Equipo de Trabajo"
                          }`
                        }
                      </p>
                    </div>
                    {editandoId && <span className="bg-red-50 text-main-red text-xs font-bold px-3 py-1 rounded-full border border-red-100">MODO EDICIÓN</span>}
                  </header>

                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* FORMULARIO PARA EQUIPO */}
                    {vistaActiva === 'equipo' && (<>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <AdminTextField label="Nombre Completo" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
                        <AdminTextField label="Cargo" value={cargo} onChange={(e) => setCargo(e.target.value)} required />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs space-y-6">
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
                            <p className="text-xs text-gray-500 mt-1.5 ml-1">
                              Si se deja en blanco, se usará el nombre de tu usuario.
                            </p>
                          </div>

                          <div>
                            <label className="block text-sm font-bold text-gray-800 mb-2">
                              Contenido del Artículo
                            </label>
                            <RichTextEditor 
                              value={contenido}
                              onChange={setContenido}
                              placeholder="Redacte aquí el contenido del artículo, utilice la barra superior para dar formato..."
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div className="md:col-span-2">
                            <div className="flex justify-between items-end mb-1.5">
                              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                Resumen corto para catálogo (Opcional)
                              </label>
                              <button 
                                type="button" 
                                onClick={handleAutoResumen} 
                                disabled={generandoResumen} 
                                className="text-xs font-semibold text-main-blue hover:text-light-blue bg-blue-50 hover:bg-blue-100 py-1 px-2.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50"
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
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {vistaActiva !== "informes" && (
                        <div className={(vistaActiva === "libros") ? "md:col-span-1" : "md:col-span-2"}>
                          {vistaActiva === "comunicaciones" ? (
                            <div>
                              <div className="flex justify-between items-center mb-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                  Título de la Noticia / Comunicado *
                                </label>
                                <button 
                                  type="button" 
                                  onClick={handleAutoResumen} 
                                  disabled={generandoResumen} 
                                  className="text-xs font-semibold text-main-blue hover:text-light-blue bg-blue-50 hover:bg-blue-100 py-1 px-2.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50"
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
                      <div className="bg-gray-50/70 p-4 rounded-xl border border-gray-200">
                        <AdminTextField 
                          label="Enlace de Video (Opcional - YouTube o Vimeo)"
                          value={videoUrl}
                          onChange={(e) => setVideoUrl(e.target.value)}
                          placeholder="Ej: https://www.youtube.com/watch?v=... o https://youtu.be/..."
                        />
                        <p className="text-xs text-gray-500 mt-1.5 ml-1">
                          Si introduces un enlace de video, se mostrará en el reproductor de la noticia.
                        </p>
                      </div>
                    )}

                    {vistaActiva === "cursos" && (
                      <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6 bg-orange-50/50 p-6 rounded-2xl border border-orange-100">
                        <AdminTextField 
                          label="Enlace de Inscripción (Opcional - Google Forms, Zoom, etc.)"
                          type="url"
                          value={enlaceInscripcion}
                          onChange={(e) => setEnlaceInscripcion(e.target.value)}
                          placeholder="https://forms.gle/..."
                        />
                        <div className="flex items-center gap-2 bg-white p-4 rounded-xl shadow-xs border border-orange-100">
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
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                      <div className="flex justify-between items-end mb-1.5">
                        <div className="w-full flex justify-end">
                          {vistaActiva !== "cursos" && (
                            <button type="button" onClick={handleAutoResumen} disabled={generandoResumen} className="text-xs font-semibold text-main-blue hover:text-light-blue bg-blue-50 hover:bg-blue-100 py-1.5 px-3 rounded-lg transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50 mb-2">
                              {generandoResumen ? "Generando..." : "✨ Auto-completar con PIDA"}
                            </button>
                          )}
                        </div>
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
                      <div className="bg-gray-50/80 p-5 rounded-xl border border-dashed border-gray-300">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-3">
                          <div>
                            <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                              Adjuntar Documentos (Para enlazar)
                            </h3>
                            <p className="text-xs text-gray-500">Sube un archivo para copiar su enlace público.</p>
                          </div>
                          <label htmlFor="input-doc-adjunto" className={`text-xs bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-lg font-semibold shadow-xs cursor-pointer transition-colors whitespace-nowrap ${subiendoArchivo ? 'opacity-50 cursor-not-allowed' : ''}`}>
                            {subiendoArchivo ? "Subiendo..." : "+ Subir archivo"}
                          </label>
                          <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx" onChange={handleSubirDocumento} className="sr-only" id="input-doc-adjunto" />
                        </div>

                        {archivosAdjuntos.length > 0 && (
                          <ul className="space-y-2" aria-label="Documentos adjuntados">
                            {archivosAdjuntos.map((archivo, index) => (
                              <li key={index} className="flex justify-between items-center bg-white p-2.5 rounded-lg border border-gray-100 shadow-xs">
                                <span className="text-xs font-medium text-gray-600 truncate mr-3 flex items-center gap-2">
                                  📄 {archivo.nombre}
                                </span>
                                <button type="button" onClick={() => copiarEnlaceDocumento(archivo.nombre, archivo.url)} className="text-[10px] uppercase tracking-wider bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-1 px-2.5 rounded transition-colors shrink-0">Copiar Enlace</button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}

                    {(vistaActiva === "libros" || vistaActiva === "informes" || vistaActiva === "incidencia") && (
                      <div className="bg-blue-50/50 p-5 rounded-xl border border-dashed border-blue-200">
                        <label className="block text-sm font-semibold text-main-blue mb-2">Archivo PDF *</label>
                        <p className="text-xs text-gray-500 mb-4">Sube el documento final en formato PDF.</p>
                        
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
                        <div className="flex items-center gap-3">
                          <label htmlFor="input-archivo-pdf" className="inline-block bg-white border border-gray-300 text-main-blue px-4 py-2 rounded-lg text-sm font-medium cursor-pointer hover:bg-gray-50 transition-colors shadow-xs">
                            Seleccionar PDF...
                          </label>
                          {(archivoLibroNombre || archivoLibroAnterior || archivoInformeNombre || archivoInformeAnterior || archivoIncidenciaNombre || archivoIncidenciaAnterior) && (
                            <span className="text-xs text-gray-600 font-medium truncate max-w-50 md:max-w-xs bg-white px-3 py-2 rounded-md border border-gray-200">
                              {archivoLibroNombre || archivoInformeNombre || archivoIncidenciaNombre || "Archivo guardado (puedes reemplazarlo)"}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {vistaActiva === "comunicaciones" && (
                      <div>
                        <label className="block text-sm font-bold text-gray-800 mb-2">
                          Cuerpo de la Noticia *
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
                        label={vistaActiva === "libros" ? "Descripción Larga" : "Cuerpo del texto"}
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
                    <div className="bg-white border border-gray-200 rounded-xl p-6">
                      <h3 className="text-sm font-semibold text-gray-800 mb-4 border-b border-gray-100 pb-2">Archivos Multimedia</h3>
                      
                      <div className="mb-6">
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                          {vistaActiva === "cursos" ? "Flyer o Portada del Curso" : (vistaActiva === "libros" ? "Portada del Libro" : (vistaActiva === "informes" ? "Portada del Informe" : "Portada principal"))}
                        </label>
                        <div className="flex flex-col sm:flex-row items-start gap-4">
                          {mainImagePreviewUrl ? (
                            <div className="flex flex-col items-center gap-2">
                              <div className="relative group inline-block">
                                <img src={mainImagePreviewUrl} alt="Vista previa" className="h-28 w-40 object-cover rounded-lg shadow-xs border border-gray-200 block mx-auto" />
                                <button type="button" onClick={() => { setImagenPrincipal(null); setMainImagePreviewUrl(imagenPrincipalAnterior); }} className="absolute -top-2 -right-2 bg-white text-gray-700 rounded-full p-1 shadow hover:bg-red-50 hover:text-main-red opacity-0 group-hover:opacity-100 transition-opacity">
                                  ✕
                                </button>
                              </div>
                              <span className="text-xs text-gray-500 font-medium truncate max-w-40 text-center" title={imagenPrincipal ? imagenPrincipal.name : extraerNombreDesdeUrl(mainImagePreviewUrl)}>
                                {imagenPrincipal ? imagenPrincipal.name : extraerNombreDesdeUrl(mainImagePreviewUrl)}
                              </span>
                            </div>
                          ) : (
                            <div className="h-28 w-40 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center">
                              <span className="text-xs text-gray-400 font-medium">Sin imagen</span>
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
                            <label htmlFor="input-portada-principal" className="text-sm bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium cursor-pointer inline-block hover:bg-gray-50 transition-colors shadow-xs">Examinar archivos...</label>
                            <p className="text-xs text-gray-400 mt-2">Formatos recomendados: JPG, PNG. Se optimizará automáticamente a WebP.</p>
                          </div>
                        </div>
                      </div>

                      {(vistaActiva === "comunicaciones" || vistaActiva === "cursos") && (
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Galería / Carrusel</label>
                          <input type="file" accept="image/*" multiple onChange={handleAgregarImagenes} className="sr-only" id="input-imagenes-carrusel" />
                          <label htmlFor="input-imagenes-carrusel" className="text-sm bg-white border border-dashed border-gray-300 text-main-blue w-full text-center py-4 rounded-lg font-medium cursor-pointer block hover:bg-blue-50 transition-colors mb-4">+ Cargar múltiples imágenes</label>
                          
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                            {carruselExistente.map((url, i) => (
                              <div key={`old-${i}`} className="flex flex-col bg-white p-2 rounded-lg border border-gray-200 shadow-xs gap-2">
                                <div className="relative group w-full h-24 rounded overflow-hidden">
                                  <img src={url} className="w-full h-full object-cover" alt="Carrusel" />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <button type="button" onClick={() => setCarruselExistente(prev => prev.filter((_, idx) => idx !== i))} className="text-white hover:text-red-400 font-bold text-xs bg-black/50 px-2 py-1 rounded">Eliminar</button>
                                  </div>
                                </div>
                                <span className="text-[10px] font-medium text-gray-500 truncate text-center">{extraerNombreDesdeUrl(url)}</span>
                              </div>
                            ))}

                            {imagenesCarrusel.map((f, i) => (
                              <div key={`new-${i}`} className="flex flex-col bg-green-50 p-2 rounded-lg border border-green-200 shadow-xs gap-2">
                                <div className="relative group w-full h-24 rounded overflow-hidden">
                                  <img src={URL.createObjectURL(f)} className="w-full h-full object-cover" alt="Nueva carrusel" />
                                  <span className="absolute top-1 left-1 bg-green-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded uppercase">Nueva</span>
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <button type="button" onClick={() => setImagenesCarrusel(prev => prev.filter((_, idx) => idx !== i))} className="text-white hover:text-red-400 font-bold text-xs bg-black/50 px-2 py-1 rounded">Quitar</button>
                                  </div>
                                </div>
                                <span className="text-[10px] font-medium text-green-700 truncate text-center">{f.name}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    )}

                    {/* TAGS Y PERSISTENCIA */}
                    {vistaActiva === "comunicaciones" && (
                      <div className="bg-white border border-gray-200 rounded-xl p-6">
                        <h3 className="text-sm font-semibold text-gray-800 mb-4 border-b border-gray-100 pb-2">Clasificación y Visibilidad</h3>
                        <div className="mb-6">
                          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Etiquetas (Tags)</label>
                          <div className="flex flex-wrap gap-2">
                            {TAGS_DISPONIBLES.map(tag => {
                              const isSelected = tagsSeleccionados.includes(tag);
                              return (
                                <Chip
                                  key={tag}
                                  label={tag}
                                  onClick={() => {
                                    setTagsSeleccionados(prev => 
                                      isSelected ? prev.filter(t => t !== tag) : [...prev, tag]
                                    );
                                  }}
                                  color={isSelected ? "primary" : "default"}
                                  variant={isSelected ? "filled" : "outlined"}
                                  sx={{ 
                                    fontWeight: 'bold', 
                                    borderRadius: '8px', 
                                    transition: 'all 0.2s ease',
                                    '&:hover': { transform: 'scale(1.03)' }
                                  }}
                                />
                              );
                            })}
                          </div>
                        </div>

                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 mt-4">
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={persistente}
                                onChange={(e) => setPersistente(e.target.checked)}
                                color="secondary" 
                              />
                            }
                            label={
                              <Box>
                                <span className="text-sm font-bold text-gray-700 block">
                                  Fijar noticia en el Carrusel de Inicio (Máximo 3)
                                </span>
                                <span className="text-xs text-gray-400 font-normal">
                                  Las noticias fijadas siempre aparecerán de primeras en la portada pública.
                                </span>
                              </Box>
                            }
                            sx={{ m: 0, alignItems: 'flex-start', '& .MuiFormControlLabel-label': { mt: 0.5 } }}
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col-reverse sm:flex-row gap-4 pt-4">
                      <button type="button" onClick={handleCancel} className="w-full sm:w-1/3 text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 font-semibold py-3.5 rounded-xl transition-colors cursor-pointer">
                        Cancelar
                      </button>
                      <button type="submit" disabled={loading} className={`w-full sm:w-2/3 text-white font-bold py-3.5 rounded-xl transition-all shadow-xs flex justify-center items-center gap-2 cursor-pointer ${editandoId ? 'bg-main-red hover:bg-red-700' : 'bg-main-blue hover:bg-light-blue'} ${loading ? 'opacity-70 cursor-wait' : ''}`}>
                        {loading ? "Procesando..." : (editandoId ? "Actualizar Cambios" : "Publicar Ahora")}
                      </button>
                    </div>
                  </form>
                </section>
              </div>

              {/* LISTA LATERAL DERECHA CON SCROLL INFINITO */}
              <div className="lg:col-span-4">
                <section className="bg-white p-6 rounded-2xl shadow-xs border border-gray-200 lg:sticky lg:top-24">
                  <h2 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
                    Publicaciones Recientes
                  </h2>

                  <div className="mb-4 flex flex-col gap-2">
                    <input
                      type="text"
                      placeholder="Buscar por palabra o nombre..."
                      className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-main-blue focus:ring-1 focus:ring-main-blue transition-colors"
                      value={busquedaTexto}
                      onChange={(e) => setBusquedaTexto(e.target.value)}
                    />
                    {vistaActiva !== 'equipo' && vistaActiva !== 'informes' && vistaActiva !== 'incidencia' && (
                      <input
                        type="date"
                        className="w-full text-sm px-3 py-2 text-gray-600 border border-gray-200 rounded-lg focus:outline-none focus:border-main-blue transition-colors"
                        value={busquedaFecha}
                        onChange={(e) => setBusquedaFecha(e.target.value)}
                      />
                    )}
                  </div>

                  <div 
                    className="space-y-3 max-h-[65vh] overflow-y-auto custom-scrollbar pr-1 relative"
                    onScroll={handleScrollLista}
                  >
                    {listaItems.length === 0 && !cargandoLista ? (
                      <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                        <p className="text-xs text-gray-500 font-medium">Bandeja vacía o sin resultados</p>
                      </div>
                    ) : (
                      listaItems.map((n) => {
                        if (vistaActiva === 'informes') {
                          return (
                            <article key={n.id} className={`group relative overflow-hidden rounded-xl border transition-all duration-300 h-32 flex flex-col justify-end p-4 ${editandoId === n.id ? 'border-main-red shadow-xs ring-2 ring-red-100' : 'border-gray-200 hover:border-main-blue'}`}>
                              <div className="absolute inset-0 bg-cover bg-top" style={{ backgroundImage: `url(${n.imagenPrincipalUrl || 'https://via.placeholder.com/400x300?text=Sin+Portada'})` }}></div>
                              <div className="absolute inset-0 bg-linear-to-t from-main-blue via-main-blue/70 to-transparent opacity-90"></div>
                              
                              <div className="relative z-10 w-full flex justify-between items-end">
                                <div>
                                  <span className="text-[10px] font-black uppercase text-white/70 tracking-widest block mb-0.5">Gestión</span>
                                  <h3 className="text-white font-bold text-base leading-none">Año {n.año}</h3>
                                </div>
                                <div className="flex gap-2">
                                  <button type="button" onClick={() => handleEditarItem(n)} className="bg-white/20 hover:bg-white text-white hover:text-main-blue px-2.5 py-1 rounded text-xs font-bold transition-colors">Editar</button>
                                  <button type="button" onClick={() => pedirConfirmacionBorrado(n.id, `Informe Anual ${n.año}`)} className="bg-main-red/80 hover:bg-main-red text-white px-2 py-1 rounded text-xs transition-colors">✕</button>
                                </div>
                              </div>
                            </article>
                          );
                        }

                        return (
                          <article key={n.id} className={`group flex flex-col p-3.5 rounded-xl border transition-all duration-200 ${editandoId === n.id ? 'bg-red-50 border-main-red' : n.persistente ? 'bg-blue-50/40 border-main-blue/30' : 'bg-white border-gray-200 hover:border-main-blue/40'}`}>
                            <div className="flex gap-3 items-start mb-3">
                              <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-gray-100 border border-gray-200 flex items-center justify-center">
                                {(n.imagenPrincipalUrl || n.fotoUrl) ? (
                                  <img src={n.imagenPrincipalUrl || n.fotoUrl} className="w-full h-full object-cover" alt="Miniatura" />
                                ) : (
                                  <span className="text-[9px] font-bold text-gray-400">DOC</span>
                                )}
                              </div>
                              
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-col gap-0.5">
                                  <div className="flex items-center gap-1.5">
                                    {n.persistente && (
                                      <span className="text-[8px] font-black text-main-blue uppercase bg-white px-1 py-0.2 rounded border border-main-blue/30">Fijada</span>
                                    )}
                                    <h3 className="font-semibold text-xs text-gray-800 line-clamp-2 leading-snug" title={n.titulo || n.nombre}>{n.titulo || n.nombre}</h3>
                                  </div>
                                  <p className="text-[10px] text-gray-400 truncate">
                                    {vistaActiva === 'equipo' ? `Orden: ${n.orden} - ${n.cargo}` : `/${obtenerColeccionActiva()}/${n.slug || n.id}`}
                                  </p>
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-2 w-full">
                              <button type="button" onClick={() => handleEditarItem(n)} className="flex-1 bg-white border border-gray-200 text-gray-600 hover:text-main-blue hover:border-main-blue py-1 rounded text-xs font-semibold transition-colors">Editar</button>
                              <button type="button" onClick={() => pedirConfirmacionBorrado(n.id, n.titulo || n.nombre)} className="px-2.5 bg-white border border-gray-200 text-gray-400 hover:text-main-red hover:border-main-red py-1 rounded text-xs transition-colors">✕</button>
                            </div>
                          </article>
                        );
                      })
                    )}
                    
                    {cargandoLista && (
                      <div className="flex justify-center py-4">
                        <CircularProgress size={20} />
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
          <div className="animate-fade-in-up">
            <button onClick={() => setVistaActiva("inicio")} className="mb-6 flex items-center gap-2 text-gray-500 font-medium hover:text-main-blue transition-colors cursor-pointer group">
              <div className="bg-white p-1.5 rounded-full shadow-xs border border-gray-200 transition-all">
                <ArrowLeft size={16} />
              </div>
              Regresar al menú de módulos web
            </button>

            {/* CONFIGURACIÓN VISUAL HOME */}
            <section className="bg-white p-6 md:p-8 rounded-2xl shadow-xs border border-gray-200 mb-8">
              <header className="mb-6 flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-gray-800">Configuración Visual (Home)</h2>
                  <p className="text-xs text-gray-500 mt-1">Modifica el lema y título principal mostrado en la portada pública de iiresodh.org.</p>
                </div>
              </header>
              {cargandoConfig ? (
                <div className="flex justify-center p-4"><CircularProgress /></div>
              ) : (
                <form onSubmit={guardarConfiguracionVisual} className="space-y-4">
                  <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 space-y-4">
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
                    <Button type="submit" variant="contained" disabled={guardandoConfig} sx={{ px: 4, py: 1.2, bgcolor: '#1D3557', textTransform: 'none', borderRadius: 2 }}>
                      {guardandoConfig ? "Guardando..." : "Guardar Textos de Portada"}
                    </Button>
                  </div>
                </form>
              )}
            </section>

            {/* GESTIÓN DE PERMISOS DE USUARIOS (SOLO WEBMASTER) */}
            {auth.currentUser?.email === "webmaster@iiresodh.org" && (
              <section className="bg-white p-6 md:p-8 rounded-2xl shadow-xs border border-gray-200 mb-8">
                <header className="mb-6">
                  <h2 className="text-xl font-bold tracking-tight text-gray-800">
                    Gestión de Permisos de Usuarios Web
                  </h2>
                  <p className="text-xs text-gray-500 mt-1">
                    Autoriza a otros miembros institucionales (@iiresodh.org) y define qué secciones pueden editar en la web.
                  </p>
                </header>

                <form onSubmit={handleAgregarAdmin} className="bg-gray-50 p-6 rounded-xl border border-gray-200 mb-8 space-y-5">
                  <h3 className="text-sm font-bold text-gray-700">Autorizar Nuevo Usuario en la Web</h3>
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
                      <Button type="submit" variant="contained" disabled={loading} fullWidth sx={{ py: 1.5, bgcolor: '#1D3557', textTransform: 'none', borderRadius: 2 }}>
                        {loading ? "Autorizando..." : "Autorizar Usuario"}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-bold text-gray-600">Módulos permitidos:</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                      {Object.keys(nuevoPermisos).map(key => (
                        <FormControlLabel
                          key={key}
                          control={
                            <Checkbox 
                              size="small"
                              checked={nuevoPermisos[key]} 
                              onChange={e => setNuevoPermisos({ ...nuevoPermisos, [key]: e.target.checked })}
                            />
                          }
                          label={
                            <span className="text-xs font-medium text-gray-700 capitalize">
                              {key === "comunicaciones" ? "Noticias" : key === "adminWeb" ? "Admin Web" : key === "auditoria" ? "Auditoría" : key}
                            </span>
                          }
                        />
                      ))}
                    </div>
                  </div>
                </form>

                <h3 className="text-sm font-bold text-gray-700 mb-3">Usuarios Web Autorizados</h3>
                {cargandoAdmins ? (
                  <div className="flex justify-center p-6"><CircularProgress /></div>
                ) : usuariosAdmins.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-50 text-xs font-bold text-gray-500 uppercase">
                          <th className="p-3">Usuario</th>
                          <th className="p-3">Módulos Permitidos</th>
                          <th className="p-3 text-center">Estado</th>
                          <th className="p-3 text-center">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-xs text-gray-700">
                        {usuariosAdmins.map(u => (
                          <tr key={u.email} className="hover:bg-gray-50/50">
                            <td className="p-3 font-bold text-main-blue">{u.email}</td>
                            <td className="p-3">
                              <div className="flex flex-wrap gap-1">
                                {Object.keys(nuevoPermisos).map(key => {
                                  const tienePermiso = u.permisos?.[key] ?? false;
                                  return (
                                    <Chip 
                                      key={key}
                                      label={key === "comunicaciones" ? "Noticias" : key === "adminWeb" ? "Admin Web" : key === "auditoria" ? "Auditoría" : key}
                                      onClick={() => handleTogglePermisoAdmin(u.email, key, tienePermiso)}
                                      color={tienePermiso ? "primary" : "default"}
                                      variant={tienePermiso ? "filled" : "outlined"}
                                      size="small"
                                      sx={{ fontSize: '9px', height: '22px' }}
                                    />
                                  );
                                })}
                              </div>
                            </td>
                            <td className="p-3 text-center">
                              <Button 
                                size="small"
                                variant="outlined"
                                color={u.activo || u.active ? "success" : "error"}
                                onClick={() => handleToggleActivoAdmin(u.email, u.activo || u.active)}
                                sx={{ textTransform: 'none', borderRadius: 2, fontSize: '11px', py: 0.3 }}
                              >
                                {u.activo || u.active ? "Activo" : "Inactivo"}
                              </Button>
                            </td>
                            <td className="p-3 text-center">
                              <Button 
                                size="small" 
                                color="error" 
                                variant="contained"
                                onClick={() => {
                                  if(window.confirm(`¿Estás seguro de que deseas revocar permanentemente el acceso para ${u.email}?`)) {
                                    handleEliminarAdmin(u.email);
                                  }
                                }}
                                sx={{ textTransform: 'none', borderRadius: 2, fontSize: '11px', py: 0.3 }}
                              >
                                Revocar
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-center text-gray-400 py-6 text-xs italic border border-dashed border-gray-200 rounded-xl">
                    No hay otros usuarios administradores registrados en la web.
                  </p>
                )}
              </section>
            )}

            {/* AUDITORÍA */}
            {misPermisos.auditoria && (
              <section className="bg-white p-6 md:p-8 rounded-2xl shadow-xs border border-gray-200">
                <header className="mb-6">
                  <h2 className="text-xl font-bold tracking-tight text-gray-800">
                    Auditoría de Actividad Web
                  </h2>
                  <p className="text-xs text-gray-500 mt-1">
                    Historial de publicaciones y modificaciones realizadas en el sitio público.
                  </p>
                </header>

                <div className="flex flex-col sm:flex-row gap-3 mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <FormControl size="small" fullWidth>
                    <InputLabel id="filtro-usuario-label">Usuario</InputLabel>
                    <Select
                      labelId="filtro-usuario-label"
                      value={filtroUsuario}
                      label="Usuario"
                      onChange={(e) => setFiltroUsuario(e.target.value)}
                    >
                      <MenuItem value="todos"><em>Todos los usuarios</em></MenuItem>
                      {usuariosUnicos.map(em => (
                        <MenuItem key={em} value={em}>{em}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <FormControl size="small" fullWidth>
                    <InputLabel id="orden-actividad-label">Orden</InputLabel>
                    <Select
                      labelId="orden-actividad-label"
                      value={ordenActividad}
                      label="Orden"
                      onChange={(e) => setOrdenActividad(e.target.value)}
                    >
                      <MenuItem value="desc">Más recientes primero</MenuItem>
                      <MenuItem value="asc">Más antiguos primero</MenuItem>
                    </Select>
                  </FormControl>

                  <Button onClick={() => cargarActividades(false)} variant="contained" disabled={cargandoActividades && !cargandoMas} sx={{ py: 1, px: 3, bgcolor: '#1D3557', textTransform: 'none', borderRadius: 2, whiteSpace: 'nowrap' }}>
                    {cargandoActividades && !cargandoMas ? 'Cargando...' : 'Cargar'}
                  </Button>
                </div>

                <div className="space-y-3 max-h-[50vh] overflow-y-auto custom-scrollbar pr-2">
                  {cargandoActividades && !cargandoMas ? (
                    <div className="text-center py-10"><CircularProgress size={30} /></div>
                  ) : actividades.length > 0 ? (
                    actividades.map(act => (
                      <div key={act.id} className="p-3.5 rounded-lg bg-gray-50 border border-gray-100 flex justify-between items-start">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-xs text-main-blue wrap-break-word">{act.accion}</p>
                          {act.detalles && (
                            <p className="text-[11px] text-gray-500 mt-1 pl-2 border-l-2 border-gray-200 italic">{act.detalles}</p>
                          )}
                          <p className="text-[10px] text-gray-400 mt-1">{act.usuarioEmail}</p>
                        </div>
                        <p className="text-[10px] text-gray-400 font-medium shrink-0 ml-3">
                          {act.timestamp?.toDate ? act.timestamp.toDate().toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-gray-400 py-8 text-xs">No hay actividades para mostrar. Presiona "Cargar" para consultar la bitácora.</p>
                  )}
                </div>

                {actividades.length > 0 && hayMasActividades && (
                  <div className="mt-6 text-center">
                    <Button onClick={() => cargarActividades(true)} variant="outlined" disabled={cargandoMas} sx={{ textTransform: 'none', borderRadius: 2, fontSize: '12px' }}>
                      {cargandoMas ? 'Cargando...' : 'Cargar más actividades'}
                    </Button>
                  </div>
                )}
              </section>
            )}
          </div>
        )}

        {/* ESTADÍSTICAS */}
        {vistaActiva === "estadisticas" && (
          <div className="animate-fade-in-up">
            <button onClick={() => setVistaActiva("inicio")} className="mb-6 flex items-center gap-2 text-gray-500 font-medium hover:text-main-blue transition-colors cursor-pointer group">
              <div className="bg-white p-1.5 rounded-full shadow-xs border border-gray-200 transition-all">
                <ArrowLeft size={16} />
              </div>
              Regresar al menú
            </button>

            <section className="bg-white p-8 rounded-2xl shadow-xs border border-gray-200 text-center py-16">
              <h2 className="text-xl font-bold text-gray-800 mb-2">Estadísticas del Sitio Web</h2>
              <p className="text-sm text-gray-500 mb-6">Módulo de visualización analítica conectado a Google Analytics.</p>
              <div className="p-8 bg-gray-50 rounded-2xl border border-dashed border-gray-200 max-w-md mx-auto">
                <p className="text-xs text-gray-400">Panel en fase de integración con métricas consolidadas.</p>
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
