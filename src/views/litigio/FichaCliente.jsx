import React, { useState, useEffect } from 'react';
import { db, storage } from '../../config/firebase';
import {
  doc,
  updateDoc,
  collection,
  addDoc,
  query,
  orderBy,
  serverTimestamp,
  deleteDoc,
  onSnapshot
} from 'firebase/firestore';
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject
} from 'firebase/storage';
import {
  Box,
  Button,
  Typography,
  Paper,
  TextField,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Divider,
  List,
  ListItem,
  ListItemText,
  LinearProgress,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Collapse
} from '@mui/material';
import {
  ArrowLeft,
  Save,
  User,
  CreditCard,
  StickyNote,
  Upload,
  File,
  Plus,
  Trash2,
  Eye,
  CheckCircle,
  AlertTriangle,
  Mail,
  Sparkles,
  ShieldCheck,
  MessageCircle,
  Edit
} from 'lucide-react';
import { registrarLogAuditoria } from '../../utils/auditLogger';
import {
  extraerDatosIdentificacionIA,
  sintetizarExpedienteRepresentadoIA
} from '../../utils/litigioAiService';

const DOC_TYPES = [
  'Cédula de Identidad',
  'DNI',
  'Pasaporte',
  'RUT',
  'Cédula de Residencia',
  'Otro'
];

export const CALIDADES_PROCESALES = [
  'Víctima Directa / Representado Principal',
  'Víctima Directa',
  'Familiar / Derechohabiente',
  'Peticionario / Denunciante',
  'Sucesor Procesal',
  'Testigo / Perito'
];

export const CONDICIONES_VULNERABILIDAD = [
  'Ninguna',
  'Adulto Mayor',
  'Persona Adulta Mayor',
  'Discapacidad',
  'Persona con Discapacidad',
  'Pueblo Indígena / Afrodescendiente',
  'Jefa de Hogar',
  'Mujer Jefa de Hogar',
  'Defensor/a de DDHH',
  'Salud Crítica',
  'NNA (Niñez y Adolescencia)'
];

export const ESTADOS_PAGO_CLIENTE = [
  'Pendiente',
  'Abono Parcial',
  'Pagado',
  'Exonerado / Pro Bono'
];

const COUNTRIES = [
  { code: 'CR', name: 'Costa Rica', phone: '+506' },
  { code: 'US', name: 'Estados Unidos', phone: '+1' },
  { code: 'MX', name: 'México', phone: '+52' },
  { code: 'ES', name: 'España', phone: '+34' },
  { code: 'CO', name: 'Colombia', phone: '+57' },
  { code: 'AR', name: 'Argentina', phone: '+54' },
  { code: 'CL', name: 'Chile', phone: '+56' },
  { code: 'PE', name: 'Perú', phone: '+51' },
  { code: 'EC', name: 'Ecuador', phone: '+593' },
  { code: 'PA', name: 'Panamá', phone: '+507' },
  { code: 'SV', name: 'El Salvador', phone: '+503' },
  { code: 'GT', name: 'Guatemala', phone: '+502' },
  { code: 'HN', name: 'Honduras', phone: '+504' },
  { code: 'NI', name: 'Nicaragua', phone: '+505' },
  { code: 'VE', name: 'Venezuela', phone: '+58' },
  { code: 'UY', name: 'Uruguay', phone: '+598' },
  { code: 'PY', name: 'Paraguay', phone: '+595' },
  { code: 'BO', name: 'Bolivia', phone: '+591' },
  { code: 'CA', name: 'Canadá', phone: '+1' },
  { code: 'GB', name: 'Reino Unido', phone: '+44' },
  { code: 'FR', name: 'Francia', phone: '+33' },
  { code: 'DE', name: 'Alemania', phone: '+49' },
  { code: 'IT', name: 'Italia', phone: '+39' }
];

function ItemNotificacion({ item }) {
  const [expanded, setExpanded] = useState(false);

  const cfg = (() => {
    if (item.estado === 'Abierto') return { color: 'success', icon: <Eye size={14} />, label: 'Abierto' };
    if (item.estado === 'Entregado') return { color: 'info', icon: <CheckCircle size={14} />, label: 'Entregado' };
    if (item.estado === 'Rebotado') return { color: 'error', icon: <AlertTriangle size={14} />, label: 'Rebotado' };
    return { color: 'default', icon: <Mail size={14} />, label: 'Enviado' };
  })();

  return (
    <Box sx={{ mb: 2, p: 2, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
        <Typography variant="body2" fontWeight="bold" color="text.primary" sx={{ maxWidth: '70%' }}>
          {item.asunto}
        </Typography>
        <Chip size="small" color={cfg.color} label={cfg.label} sx={{ fontWeight: 'bold', fontSize: '0.7rem', height: 20 }} />
      </Box>

      <Button
        size="small"
        variant="text"
        onClick={() => setExpanded(!expanded)}
        sx={{ textTransform: 'none', fontSize: '0.72rem', p: 0, minWidth: 0, mb: 0.5, fontWeight: 'bold', color: 'primary.main' }}
      >
        {expanded ? 'Ocultar contenido del mensaje' : 'Ver contenido del mensaje'}
      </Button>

      <Collapse in={expanded}>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            display: 'block',
            my: 1,
            whiteSpace: 'pre-wrap',
            bgcolor: '#ffffff',
            p: 1,
            borderRadius: 1,
            border: '1px solid #e2e8f0'
          }}
        >
          {item.cuerpo}
        </Typography>
      </Collapse>

      {item.pdf_url && (
        <Box sx={{ mt: 0.5 }}>
          <Button
            component="a"
            href={item.pdf_url}
            target="_blank"
            rel="noopener"
            variant="text"
            size="small"
            startIcon={<File size={12} />}
            sx={{ textTransform: 'none', fontWeight: 'bold', fontSize: '0.7rem', p: 0, justifyContent: 'flex-start' }}
          >
            Descargar Anexo: {item.pdf_nombre || 'Documento Adjunto'}
          </Button>
        </Box>
      )}

      <Divider sx={{ my: 1, borderStyle: 'dashed' }} />

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {item.entregado_at && (
          <Typography variant="caption" color="text.secondary">
            Recibido: <strong>{item.entregado_at}</strong>
          </Typography>
        )}
        {item.abierto_at && (
          <Typography variant="caption" color="success.main">
            Abierto: <strong>{item.abierto_at}</strong>
          </Typography>
        )}
        {item.rebotado_at && (
          <Typography variant="caption" color="error.main">
            Rebote: <strong>{item.rebotado_at}</strong>
            {item.causa_rebote && (
              <span style={{ display: 'block', fontStyle: 'italic', fontSize: '0.65rem', marginTop: '2px' }}>
                {item.causa_rebote}
              </span>
            )}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

export default function FichaCliente({ casoId, clienteId, onVolver, currentUserEmail }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [caso, setCaso] = useState(null);
  const [cliente, setCliente] = useState(null);
  const [nombres, setNombres] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [tipoIdentificacion, setTipoIdentificacion] = useState('Cédula de Identidad');
  const [identificacion, setIdentificacion] = useState('');
  const [pais, setPais] = useState('Costa Rica');
  const [direccion, setDireccion] = useState('');

  // Campos de litigio internacional (Pilar 2)
  const [calidadProcesal, setCalidadProcesal] = useState(CALIDADES_PROCESALES[0]);
  const [condicionVulnerabilidad, setCondicionVulnerabilidad] = useState('Ninguna');

  // Campos financieros (Pilar 4)
  const [estadoPago, setEstadoPago] = useState('Pendiente');
  const [montoPagado, setMontoPagado] = useState('');
  const [monedaPago, setMonedaPago] = useState('USD');
  const [metodoPago, setMetodoPago] = useState('Transferencia / SINPE');
  const [referenciaPago, setReferenciaPago] = useState('');
  const [guardandoPago, setGuardandoPago] = useState(false);

  const [correoPrincipal, setCorreoPrincipal] = useState('');
  const [correoSecundario, setCorreoSecundario] = useState('');
  const [codigoTelefonoPrincipal, setCodigoTelefonoPrincipal] = useState('+506');
  const [telefonoPrincipal, setTelefonoPrincipal] = useState('');
  const [codigoTelefonoSecundario, setCodigoTelefonoSecundario] = useState('+506');
  const [telefonoSecundario, setTelefonoSecundario] = useState('');

  const [notes, setNotas] = useState([]);
  const [nuevaNota, setNuevaNota] = useState('');
  const [documentos, setDocumentos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Estados reactivos en tiempo real para telemetría
  const [historialComunicados, setHistorialComunicados] = useState([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);

  // Estados de Inteligencia Artificial (Gemini 3.8 Flash)
  const [verificandoDocIAId, setVerificandoDocIAId] = useState(null);
  const [resultadoDocIA, setResultadoDocIA] = useState(null);
  const [generandoResumenIA, setGenerandoResumenIA] = useState(false);
  const [resumenEjecutivoIA, setResumenEjecutivoIA] = useState(null);

  const clienteRef = doc(db, 'casos', casoId, 'clientes', clienteId);

  useEffect(() => {
    setLoading(true);
    setError('');

    const unsubCaso = onSnapshot(doc(db, 'casos', casoId), (snap) => {
      if (snap.exists()) setCaso({ id: snap.id, ...snap.data() });
    });

    const unsubCliente = onSnapshot(
      clienteRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setCliente(data);
          setNombres(data.nombres || data.nombre_completo || '');
          setApellidos(data.apellidos || '');
          setTipoIdentificacion(data.tipo_identificacion || 'Cédula de Identidad');
          setIdentificacion(data.identificacion || data.documento_identidad || '');
          setPais(data.pais || 'Costa Rica');
          setDireccion(data.direccion || '');
          setCalidadProcesal(data.calidad_procesal || CALIDADES_PROCESALES[0]);
          setCondicionVulnerabilidad(data.condicion_vulnerabilidad || 'Ninguna');
          setEstadoPago(data.estado_pago || 'Pendiente');
          setMontoPagado(data.monto_pagado !== undefined ? String(data.monto_pagado) : '');
          setMonedaPago(data.moneda_pago || 'USD');
          setMetodoPago(data.metodo_pago || 'Transferencia / SINPE');
          setReferenciaPago(data.referencia_pago || '');
          setCorreoPrincipal(data.correo_principal || data.correo || '');
          setCorreoSecundario(data.correo_secundario || '');
          setCodigoTelefonoPrincipal(data.codigo_telefono_principal || data.codigo_telefono || '+506');
          setTelefonoPrincipal(data.telefono_principal || data.telefono || '');
          setCodigoTelefonoSecundario(data.codigo_telefono_secundario || '+506');
          setTelefonoSecundario(data.telefono_secundario || '');
        } else {
          setError('No se localizó la ficha del representado solicitado.');
        }
        setLoading(false);
      },
      () => {
        setError('Error al sincronizar el expediente con el servidor.');
        setLoading(false);
      }
    );

    const qNotas = query(
      collection(db, 'casos', casoId, 'clientes', clienteId, 'notas'),
      orderBy('fecha', 'desc')
    );
    const unsubNotas = onSnapshot(qNotas, (snap) => {
      setNotas(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    const qDocs = query(
      collection(db, 'casos', casoId, 'clientes', clienteId, 'documentos'),
      orderBy('fecha_subida', 'desc')
    );
    const unsubDocs = onSnapshot(qDocs, (snap) => {
      setDocumentos(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    setLoadingHistorial(true);
    const historialRef = collection(db, 'casos', casoId, 'clientes', clienteId, 'historial_comunicados');
    const unsubHistorial = onSnapshot(
      historialRef,
      (snapHistorial) => {
        const listaEventos = snapHistorial.docs.map((d) => ({ id: d.id, ...d.data() }));

        const parseFechaCRAMilisegundos = (str) => {
          if (!str) return 0;
          try {
            const partes = str.split(/[\s,]+/);
            const fechaPartes = partes[0].split('/');
            const horaPartes = partes[1].split(':');
            const dia = parseInt(fechaPartes[0], 10);
            const mes = parseInt(fechaPartes[1], 10) - 1;
            const anio = parseInt(fechaPartes[2], 10);
            const hora = parseInt(horaPartes[0], 10);
            const mi = parseInt(horaPartes[1], 10);
            const se = parseInt(horaPartes[2], 10);
            return new Date(anio, mes, dia, hora, mi, se).getTime();
          } catch {
            return 0;
          }
        };

        listaEventos.sort(
          (a, b) =>
            parseFechaCRAMilisegundos(b.ultima_actualizacion) -
            parseFechaCRAMilisegundos(a.ultima_actualizacion)
        );
        setHistorialComunicados(listaEventos);
        setLoadingHistorial(false);
      },
      (errHist) => {
        console.error('Error en sincronización de telemetría:', errHist);
        setLoadingHistorial(false);
      }
    );

    return () => {
      unsubCaso();
      unsubCliente();
      unsubNotas();
      unsubDocs();
      unsubHistorial();
    };
  }, [casoId, clienteId]);

  const handleToggleAcreditacion = async (campo) => {
    if (!cliente) return;
    try {
      await updateDoc(clienteRef, {
        [campo]: !cliente[campo]
      });
    } catch {
      setError('No se pudo actualizar el estado de acreditación.');
    }
  };

  const handleUpdateDatos = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      await updateDoc(clienteRef, {
        nombres: nombres.trim(),
        apellidos: apellidos.trim(),
        tipo_identificacion: tipoIdentificacion,
        identificacion: identificacion.trim(),
        pais: pais,
        direccion: direccion.trim(),
        calidad_procesal: calidadProcesal,
        condicion_vulnerabilidad: condicionVulnerabilidad,
        correo_principal: correoPrincipal.trim(),
        correo_secundario: correoSecundario.trim(),
        codigo_telefono_principal: codigoTelefonoPrincipal,
        telefono_principal: telefonoPrincipal.trim(),
        codigo_telefono_secundario: codigoTelefonoSecundario,
        telefono_secundario: telefonoSecundario.trim()
      });

      await registrarLogAuditoria(
        currentUserEmail,
        'Actualización de Cliente',
        `Se editaron los datos de contacto y acreditación del representado: ${apellidos.trim()}, ${nombres.trim()}`
      );

      setSuccess('Expediente de contacto y acreditación actualizado correctamente.');
    } catch {
      setError('No se pudieron guardar los cambios.');
    }
  };

  const handleGuardarPago = async () => {
    setGuardandoPago(true);
    setError('');
    setSuccess('');
    try {
      await updateDoc(clienteRef, {
        estado_pago: estadoPago,
        monto_pagado: montoPagado ? Number(montoPagado) : 0,
        moneda_pago: monedaPago,
        metodo_pago: metodoPago,
        referencia_pago: referenciaPago.trim()
      });
      await registrarLogAuditoria(
        currentUserEmail,
        'Actualización de Pago',
        `Se actualizó el estado financiero de ${apellidos}, ${nombres} a [${estadoPago}] (${monedaPago} ${montoPagado || 0})`
      );
      setSuccess('Estado financiero y aportes actualizados.');
    } catch {
      setError('No se pudo actualizar el registro financiero.');
    } finally {
      setGuardandoPago(false);
    }
  };

  const handleAddNota = async () => {
    if (!nuevaNota.trim()) return;
    try {
      const refNotas = collection(db, 'casos', casoId, 'clientes', clienteId, 'notas');
      await addDoc(refNotas, {
        texto: nuevaNota.trim(),
        autor_email: currentUserEmail || '',
        autor_nombre: currentUserEmail || 'Equipo Legal',
        fecha: serverTimestamp()
      });

      await registrarLogAuditoria(
        currentUserEmail,
        'Adición de Nota',
        `Se estampó una nota jurídica interna en el expediente del cliente: ${apellidos}, ${nombres}`
      );

      setNuevaNota('');
    } catch {
      setError('Error al registrar la nota.');
    }
  };

  const handleDeleteNota = async (notaId) => {
    if (!window.confirm('¿Desea eliminar esta nota jurídica?')) return;
    try {
      await deleteDoc(doc(db, 'casos', casoId, 'clientes', clienteId, 'notas', notaId));
    } catch {
      setError('No se pudo eliminar la nota.');
    }
  };

  const handleEditNota = async (nota) => {
    const nuevoTexto = window.prompt('Editar anotación jurídica:', nota.texto);
    if (!nuevoTexto || !nuevoTexto.trim() || nuevoTexto === nota.texto) return;
    try {
      await updateDoc(doc(db, 'casos', casoId, 'clientes', clienteId, 'notas', nota.id), {
        texto: nuevoTexto.trim()
      });
    } catch {
      setError('No se pudo editar la nota.');
    }
  };

  const handleUploadFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    setUploadProgress(0);
    setError('');

    const storagePath = `casos/${casoId}/clientes/${clienteId}/${Date.now()}_${file.name}`;
    const storageRef = ref(storage, storagePath);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
      'state_changed',
      (snap) => {
        const progress = (snap.bytesTransferred / snap.totalBytes) * 100;
        setUploadProgress(Math.round(progress));
      },
      () => {
        setError('Error físico al subir archivo.');
        setUploading(false);
      },
      async () => {
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

          // Verificación automática con IA (Gemini 3.8 Flash) al subir el archivo
          let analisisIA = null;
          let categoriaDetectada = '';
          let observacionesIA = '';
          try {
            analisisIA = await extraerDatosIdentificacionIA({
              file,
              nombreArchivo: file.name
            });
            categoriaDetectada = analisisIA?.tipo_documento_detectado || '';
            observacionesIA = analisisIA?.observaciones_verificacion || '';
          } catch (iaErr) {
            console.warn('No se pudo ejecutar la verificación automática IA al subir:', iaErr);
          }

          const refDocs = collection(db, 'casos', casoId, 'clientes', clienteId, 'documentos');
          await addDoc(refDocs, {
            nombre: file.name,
            url: downloadURL,
            storage_path: storagePath,
            tipo: file.type || '',
            categoria_ia: categoriaDetectada,
            observaciones_ia: observacionesIA,
            verificado_ia: Boolean(analisisIA),
            fecha_subida: new Date().toISOString()
          });

          // Actualizar automáticamente el Semáforo Art. 35 según lo que la IA haya verificado
          if (analisisIA) {
            const updates = {};
            const tipoLower = (categoriaDetectada || '').toLowerCase();
            const nombreLower = file.name.toLowerCase();

            if (analisisIA.es_poder_firmado || tipoLower.includes('poder') || nombreLower.includes('poder')) {
              updates.tiene_poder = true;
            }
            if (
              (analisisIA.es_identificacion_legible && tipoLower.includes('identifica')) ||
              nombreLower.includes('cedula') ||
              nombreLower.includes('cédula') ||
              nombreLower.includes('pasaporte')
            ) {
              updates.tiene_documento_id = true;
            }
            if (
              analisisIA.es_prueba_dano ||
              tipoLower.includes('prueba') ||
              nombreLower.includes('dano') ||
              nombreLower.includes('daño') ||
              nombreLower.includes('declaracion')
            ) {
              updates.tiene_prueba_dano = true;
            }
            if (analisisIA.identificacion && !identificacion) {
              updates.identificacion = analisisIA.identificacion;
            }

            if (Object.keys(updates).length > 0) {
              await updateDoc(clienteRef, updates);
            }
            setResultadoDocIA({ ...analisisIA, docNombre: file.name, aplicadoAutomaticamente: true });
          }

          await registrarLogAuditoria(
            currentUserEmail,
            'Carga de Poder/Doc',
            `Se cargó y verificó con IA el archivo "${file.name}" (${categoriaDetectada || 'Documento'}) en el expediente de: ${apellidos}, ${nombres}`
          );

          setUploading(false);
          setSuccess(
            analisisIA
              ? `Archivo subido y verificado automáticamente por IA (${categoriaDetectada}): se actualizó el Semáforo Art. 35.`
              : 'Archivo enlazado con éxito.'
          );
        } catch (err) {
          setError('Error al registrar el archivo subido.');
          setUploading(false);
        }
      }
    );
  };

  const handleDeleteFile = async (docId, storagePath) => {
    if (!window.confirm('¿Desea suprimir este documento individual?')) return;
    try {
      if (storagePath) {
        await deleteObject(ref(storage, storagePath));
      }
      await deleteDoc(doc(db, 'casos', casoId, 'clientes', clienteId, 'documentos', docId));

      // Recalcular automáticamente los indicadores del Semáforo Art. 35 según los documentos vigentes restantes
      const restantes = documentos.filter((d) => d.id !== docId);
      const tienePoderRestante = restantes.some((d) => {
        const c = (d.categoria_ia || '').toLowerCase();
        const n = (d.nombre || '').toLowerCase();
        return c.includes('poder') || n.includes('poder');
      });
      const tieneIdRestante = restantes.some((d) => {
        const c = (d.categoria_ia || '').toLowerCase();
        const n = (d.nombre || '').toLowerCase();
        return c.includes('identifica') || n.includes('cedula') || n.includes('cédula') || n.includes('pasaporte') || n.includes('identidad');
      });
      const tieneDanoRestante = restantes.some((d) => {
        const c = (d.categoria_ia || '').toLowerCase();
        const n = (d.nombre || '').toLowerCase();
        return c.includes('prueba') || n.includes('dano') || n.includes('daño') || n.includes('declaracion');
      });

      await updateDoc(clienteRef, {
        tiene_poder: tienePoderRestante,
        tiene_documento_id: tieneIdRestante,
        tiene_prueba_dano: tieneDanoRestante
      });

      await registrarLogAuditoria(
        currentUserEmail,
        'Eliminación de Poder/Doc',
        `Se eliminó el documento ID: ${docId} perteneciente a: ${apellidos}, ${nombres} y se actualizó el Semáforo Art. 35`
      );

      setSuccess('Documento removido y Semáforo Art. 35 actualizado automáticamente.');
    } catch {
      setError('Error al eliminar archivo.');
    }
  };

  // --- FUNCIONES IA MULTIMODAL (GEMINI 3.8 FLASH) ---
  const handleVerificarDocIA = async (docItem) => {
    setVerificandoDocIAId(docItem.id);
    setResultadoDocIA(null);
    setError('');
    try {
      const res = await extraerDatosIdentificacionIA({
        fileUrl: docItem.url,
        mimeType: docItem.tipo || 'application/pdf',
        nombreArchivo: docItem.nombre
      });
      setResultadoDocIA({ ...res, docNombre: docItem.nombre });
    } catch (err) {
      setError(`No se pudo analizar el documento con IA: ${err.message}`);
    } finally {
      setVerificandoDocIAId(null);
    }
  };

  const handleAplicarVerificacionIA = async () => {
    if (!resultadoDocIA) return;
    try {
      const updates = {};
      if (resultadoDocIA.identificacion && !identificacion) {
        updates.identificacion = resultadoDocIA.identificacion;
      }
      if (
        resultadoDocIA.es_identificacion_legible &&
        (resultadoDocIA.tipo_documento_detectado || '').includes('Identificación')
      ) {
        updates.tiene_documento_id = true;
      }
      if (
        resultadoDocIA.es_poder_firmado ||
        (resultadoDocIA.tipo_documento_detectado || '').includes('Poder')
      ) {
        updates.tiene_poder = true;
      }
      if (
        resultadoDocIA.condicion_vulnerabilidad_sugerida &&
        resultadoDocIA.condicion_vulnerabilidad_sugerida !== 'Ninguna'
      ) {
        updates.condicion_vulnerabilidad = resultadoDocIA.condicion_vulnerabilidad_sugerida;
      }

      await updateDoc(clienteRef, updates);
      setSuccess('Datos de acreditación verificados con IA aplicados al expediente.');
      setResultadoDocIA(null);
    } catch {
      setError('No se pudieron aplicar los datos extraídos.');
    }
  };

  const handleGenerarResumenIA = async () => {
    setGenerandoResumenIA(true);
    setError('');
    try {
      const res = await sintetizarExpedienteRepresentadoIA({
        cliente: {
          ...cliente,
          nombres,
          apellidos,
          identificacion,
          tipo_identificacion: tipoIdentificacion,
          pais,
          calidad_procesal: calidadProcesal,
          condicion_vulnerabilidad: condicionVulnerabilidad,
          estado_pago: estadoPago,
          monto_pagado: montoPagado,
          moneda_pago: monedaPago
        },
        caso: caso || {},
        notas: notes,
        documentos,
        comunicados: historialComunicados
      });
      setResumenEjecutivoIA(res);
    } catch (err) {
      setError(`Error al sintetizar expediente con IA: ${err.message}`);
    } finally {
      setGenerandoResumenIA(false);
    }
  };

  const handleGuardarResumenComoNota = async () => {
    if (!resumenEjecutivoIA?.resumen) return;
    try {
      await addDoc(collection(db, 'casos', casoId, 'clientes', clienteId, 'notas'), {
        texto: `✨ [SÍNTESIS EJECUTIVA IA - ${resumenEjecutivoIA._metaIA?.modeloEjecutado || 'Gemini 3.8 Flash'}]:\n${resumenEjecutivoIA.resumen}`,
        autor_email: currentUserEmail || 'ia@iiresodh.org',
        autor_nombre: `${currentUserEmail || 'Equipo Legal'} (Copiloto IA)`,
        fecha: serverTimestamp()
      });
      setSuccess('Síntesis ejecutiva guardada en la bitácora jurídica.');
    } catch {
      setError('No se pudo guardar la síntesis en la bitácora.');
    }
  };

  const obtenerUrlWhatsApp = () => {
    if (!telefonoPrincipal) return null;
    const cod = (codigoTelefonoPrincipal || '+506').replace(/\D/g, '');
    const num = telefonoPrincipal.replace(/\D/g, '');
    if (!num) return null;
    const msg = encodeURIComponent(
      `Estimado(a) ${nombres} ${apellidos}, le saludamos del equipo jurídico del IIRESODH respecto al caso "${caso?.nombre || ''}".`
    );
    return `https://wa.me/${cod}${num}?text=${msg}`;
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  const urlWhatsApp = obtenerUrlWhatsApp();
  const acreditacionCompleta = Boolean(cliente?.tiene_poder && cliente?.tiene_documento_id);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1.5, mb: 2.5 }}>
        <Button startIcon={<ArrowLeft size={16} />} onClick={onVolver} sx={{ textTransform: 'none', fontWeight: 'bold' }}>
          Volver al Expediente General
        </Button>

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {urlWhatsApp && (
            <Button
              component="a"
              href={urlWhatsApp}
              target="_blank"
              rel="noopener noreferrer"
              variant="outlined"
              color="success"
              size="small"
              startIcon={<MessageCircle size={16} />}
              sx={{ textTransform: 'none', fontWeight: 'bold', borderRadius: 2 }}
            >
              Contactar por WhatsApp
            </Button>
          )}
          <Button
            variant="contained"
            size="small"
            startIcon={<Sparkles size={16} />}
            disabled={generandoResumenIA}
            onClick={handleGenerarResumenIA}
            sx={{
              textTransform: 'none',
              fontWeight: 'bold',
              borderRadius: 2,
              background: 'linear-gradient(90deg, #4338ca 0%, #7e22ce 100%)'
            }}
          >
            {generandoResumenIA ? 'Analizando con Gemini 3.8 Flash...' : '✨ Síntesis Ejecutiva IA del Representado'}
          </Button>
        </Box>
      </Box>

      {/* BARRA DE ACREDITACIÓN ART. 35 REGLAMENTO CORTE IDH */}
      <Paper
        sx={{
          p: 2,
          mb: 3,
          borderRadius: 3,
          border: acreditacionCompleta ? '1px solid #86efac' : '1px solid #fde047',
          bgcolor: acreditacionCompleta ? '#f0fdf4' : '#fefce8',
          boxShadow: 'none'
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ShieldCheck size={20} color={acreditacionCompleta ? '#15803d' : '#a16207'} />
            <Box>
              <Typography variant="subtitle2" fontWeight="bold">
                Semáforo de Acreditación Individual (Art. 35 Reglamento Corte IDH)
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Estado automático verificado por IA según los archivos vigentes en &ldquo;Documentos y Poderes&rdquo; (no editable manualmente):
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
            <Chip
              label={cliente?.tiene_poder ? '✅ Poder Legal Verificado' : '⚠️ Poder Legal Pendiente'}
              color={cliente?.tiene_poder ? 'success' : 'warning'}
              variant={cliente?.tiene_poder ? 'filled' : 'outlined'}
              sx={{ fontWeight: 'bold' }}
            />
            <Chip
              label={cliente?.tiene_documento_id ? '✅ Cédula / ID Legible' : '⚠️ Cédula / ID Pendiente'}
              color={cliente?.tiene_documento_id ? 'success' : 'warning'}
              variant={cliente?.tiene_documento_id ? 'filled' : 'outlined'}
              sx={{ fontWeight: 'bold' }}
            />
            <Chip
              label={cliente?.tiene_prueba_dano ? '✅ Prueba de Daño' : '📂 Prueba de Daño en Recolección'}
              color={cliente?.tiene_prueba_dano ? 'success' : 'default'}
              variant={cliente?.tiene_prueba_dano ? 'filled' : 'outlined'}
              sx={{ fontWeight: 'bold' }}
            />
          </Box>
        </Box>
      </Paper>

      {/* PANEL DESPLEGABLE DE SÍNTESIS EJECUTIVA IA */}
      {resumenEjecutivoIA && (
        <Paper
          sx={{
            p: 2.5,
            mb: 3,
            borderRadius: 3,
            border: '1px solid #c7d2fe',
            bgcolor: '#eef2ff',
            boxShadow: 'none'
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Sparkles size={18} color="#4338ca" />
              <Typography variant="subtitle1" fontWeight="bold" color="#312e81">
                Dictamen Ejecutivo Individual (Estándar SIDH)
              </Typography>
              <Chip
                size="small"
                label={resumenEjecutivoIA._metaIA?.modeloEjecutado || 'gemini-3.8-flash'}
                sx={{ fontWeight: 'bold', fontSize: '0.7rem', bgcolor: '#ffffff' }}
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                size="small"
                variant="contained"
                onClick={handleGuardarResumenComoNota}
                sx={{ textTransform: 'none', fontWeight: 'bold', borderRadius: 1.5 }}
              >
                Guardar en Bitácora Jurídica
              </Button>
              <Button
                size="small"
                color="inherit"
                onClick={() => setResumenEjecutivoIA(null)}
                sx={{ textTransform: 'none' }}
              >
                Cerrar
              </Button>
            </Box>
          </Box>
          <Typography
            variant="body2"
            sx={{ whiteSpace: 'pre-wrap', bgcolor: '#ffffff', p: 2, borderRadius: 2, border: '1px solid #e0e7ff' }}
          >
            {resumenEjecutivoIA.resumen}
          </Typography>
        </Paper>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '3fr 2fr' }, gap: { xs: 2, sm: 3 } }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 2, sm: 3 } }}>
          <Paper
            component="form"
            onSubmit={handleUpdateDatos}
            sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: 'none' }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5, color: 'primary.main' }}>
              <User size={20} />
              <Typography variant="h6" fontWeight="bold" sx={{ fontSize: { xs: '1.05rem', sm: '1.25rem' } }}>
                Datos del Representado, Calidad Procesal & Contacto
              </Typography>
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mb: 2.5 }}>
              <TextField label="Nombres" fullWidth value={nombres} onChange={(e) => setNombres(e.target.value)} required />
              <TextField label="Apellidos" fullWidth value={apellidos} onChange={(e) => setApellidos(e.target.value)} required />
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mb: 2.5 }}>
              <FormControl fullWidth>
                <InputLabel>Tipo Identificación</InputLabel>
                <Select
                  value={tipoIdentificacion}
                  label="Tipo Identificación"
                  onChange={(e) => setTipoIdentificacion(e.target.value)}
                >
                  {DOC_TYPES.map((t) => (
                    <MenuItem key={t} value={t}>
                      {t}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Número de Identificación"
                fullWidth
                value={identificacion}
                onChange={(e) => setIdentificacion(e.target.value)}
                required
              />
            </Box>

            {/* Calidad Procesal y Vulnerabilidad (Art. 29.2 CIDH) */}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mb: 2.5 }}>
              <FormControl fullWidth>
                <InputLabel>Calidad Procesal (SIDH)</InputLabel>
                <Select
                  value={calidadProcesal}
                  label="Calidad Procesal (SIDH)"
                  onChange={(e) => setCalidadProcesal(e.target.value)}
                >
                  {CALIDADES_PROCESALES.map((cal) => (
                    <MenuItem key={cal} value={cal}>
                      {cal}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel>Vulnerabilidad (Art. 29.2 CIDH)</InputLabel>
                <Select
                  value={condicionVulnerabilidad}
                  label="Vulnerabilidad (Art. 29.2 CIDH)"
                  onChange={(e) => setCondicionVulnerabilidad(e.target.value)}
                >
                  {CONDICIONES_VULNERABILIDAD.map((cond) => (
                    <MenuItem key={cond} value={cond}>
                      {cond}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            <Box sx={{ mb: 2.5 }}>
              <FormControl fullWidth>
                <InputLabel>País de Residencia</InputLabel>
                <Select
                  value={pais}
                  label="País de Residencia"
                  onChange={(e) => {
                    setPais(e.target.value);
                    const c = COUNTRIES.find((x) => x.name === e.target.value);
                    if (c) {
                      setCodigoTelefonoPrincipal(c.phone);
                      setCodigoTelefonoSecundario(c.phone);
                    }
                  }}
                >
                  {COUNTRIES.map((c) => (
                    <MenuItem key={c.code} value={c.name}>
                      {c.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            <Box sx={{ mb: 2.5 }}>
              <TextField
                label="Dirección Física Completa"
                fullWidth
                multiline
                rows={2}
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
              />
            </Box>

            <Divider sx={{ my: 2.5 }}>Direcciones de Correo</Divider>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mb: 2.5 }}>
              <TextField
                label="Email Principal"
                type="email"
                fullWidth
                value={correoPrincipal}
                onChange={(e) => setCorreoPrincipal(e.target.value)}
                required
              />
              <TextField
                label="Email Secundario"
                type="email"
                fullWidth
                value={correoSecundario}
                onChange={(e) => setCorreoSecundario(e.target.value)}
              />
            </Box>

            <Divider sx={{ my: 2.5 }}>Números Telefónicos Internacionales</Divider>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '140px 1fr' }, gap: 2, mb: 2.5 }}>
              <FormControl fullWidth>
                <InputLabel>Cód. Principal</InputLabel>
                <Select
                  value={codigoTelefonoPrincipal}
                  label="Cód. Principal"
                  onChange={(e) => setCodigoTelefonoPrincipal(e.target.value)}
                >
                  {COUNTRIES.map((c) => (
                    <MenuItem key={c.code} value={c.phone}>{`${c.code} (${c.phone})`}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Teléfono Principal"
                fullWidth
                value={telefonoPrincipal}
                onChange={(e) => setTelefonoPrincipal(e.target.value)}
              />
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '140px 1fr' }, gap: 2, mb: 3 }}>
              <FormControl fullWidth>
                <InputLabel>Cód. Secundario</InputLabel>
                <Select
                  value={codigoTelefonoSecundario}
                  label="Cód. Secundario"
                  onChange={(e) => setCodigoTelefonoSecundario(e.target.value)}
                >
                  {COUNTRIES.map((c) => (
                    <MenuItem key={c.code} value={c.phone}>{`${c.code} (${c.phone})`}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Teléfono Secundario"
                fullWidth
                value={telefonoSecundario}
                onChange={(e) => setTelefonoSecundario(e.target.value)}
              />
            </Box>

            <Button
              type="submit"
              variant="contained"
              startIcon={<Save size={16} />}
              sx={{ width: { xs: '100%', sm: 'auto' }, textTransform: 'none', borderRadius: 2, fontWeight: 'bold' }}
            >
              Guardar Cambios del Expediente
            </Button>
          </Paper>

          {/* BITÁCORA DE NOTAS JURÍDICAS CON AUTORÍA */}
          <Paper sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: 'none' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, color: 'primary.main' }}>
              <StickyNote size={20} />
              <Typography variant="h6" fontWeight="bold">
                Notas del Caso e Historial Jurídico
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
              <TextField
                label="Escribe una actualización jurídica..."
                fullWidth
                multiline
                rows={2}
                value={nuevaNota}
                onChange={(e) => setNuevaNota(e.target.value)}
              />
              <Button variant="outlined" onClick={handleAddNota} sx={{ minWidth: 48 }}>
                <Plus size={20} />
              </Button>
            </Box>

            <List sx={{ maxHeight: 320, overflow: 'auto' }}>
              {notes.length === 0 ? (
                <Typography variant="body2" color="text.disabled">
                  No hay notas registradas.
                </Typography>
              ) : (
                notes.map((n) => (
                  <Card key={n.id} sx={{ mb: 1.5, boxShadow: 'none', bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <CardContent sx={{ p: '12px !important' }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', flexGrow: 1 }}>
                          {n.texto}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <IconButton size="small" onClick={() => handleEditNota(n)} title="Editar nota">
                            <Edit size={14} />
                          </IconButton>
                          <IconButton size="small" color="error" onClick={() => handleDeleteNota(n.id)} title="Eliminar nota">
                            <Trash2 size={14} />
                          </IconButton>
                        </Box>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                        <Typography variant="caption" color="primary.main" fontWeight="bold">
                          👤 {n.autor_nombre || n.autor_email || 'Equipo Legal'}
                        </Typography>
                        <Typography variant="caption" color="text.disabled">
                          {n.fecha?.toDate ? n.fecha.toDate().toLocaleString() : 'Reciente'}
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                ))
              )}
            </List>
          </Paper>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 2, sm: 3 } }}>
          {/* CONTROL FINANCIERO Y APORTES (PILAR 4) */}
          <Paper sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: 'none' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'primary.main' }}>
                <CreditCard size={20} />
                <Typography variant="h6" fontWeight="bold">
                  Control Financiero y Aportes
                </Typography>
              </Box>
              <Chip
                label={estadoPago}
                color={
                  estadoPago === 'Pagado'
                    ? 'success'
                    : estadoPago === 'Abono Parcial'
                    ? 'info'
                    : estadoPago === 'Exonerado / Pro Bono'
                    ? 'secondary'
                    : 'warning'
                }
                size="small"
                sx={{ fontWeight: 'bold' }}
              />
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, mb: 1.5 }}>
              <FormControl size="small" fullWidth>
                <InputLabel>Estado de Pago</InputLabel>
                <Select value={estadoPago} label="Estado de Pago" onChange={(e) => setEstadoPago(e.target.value)}>
                  {ESTADOS_PAGO_CLIENTE.map((st) => (
                    <MenuItem key={st} value={st}>
                      {st}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl size="small" fullWidth>
                <InputLabel>Vía de Pago</InputLabel>
                <Select value={metodoPago} label="Vía de Pago" onChange={(e) => setMetodoPago(e.target.value)}>
                  <MenuItem value="Transferencia / SINPE">Transferencia / SINPE</MenuItem>
                  <MenuItem value="Stripe">Stripe (Tarjeta)</MenuItem>
                  <MenuItem value="Depósito Bancario">Depósito Bancario</MenuItem>
                  <MenuItem value="Exoneración Pro Bono">Exoneración Pro Bono</MenuItem>
                </Select>
              </FormControl>
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 1.5, mb: 1.5 }}>
              <TextField
                size="small"
                label="Monto Aportado"
                type="number"
                value={montoPagado}
                onChange={(e) => setMontoPagado(e.target.value)}
              />
              <FormControl size="small" fullWidth>
                <InputLabel>Moneda</InputLabel>
                <Select value={monedaPago} label="Moneda" onChange={(e) => setMonedaPago(e.target.value)}>
                  <MenuItem value="USD">USD ($)</MenuItem>
                  <MenuItem value="CRC">CRC (₡)</MenuItem>
                </Select>
              </FormControl>
            </Box>

            <TextField
              size="small"
              fullWidth
              label="N° Comprobante / Referencia"
              value={referenciaPago}
              onChange={(e) => setReferenciaPago(e.target.value)}
              sx={{ mb: 1.5 }}
            />

            <Button
              fullWidth
              variant="outlined"
              size="small"
              disabled={guardandoPago}
              onClick={handleGuardarPago}
              sx={{ textTransform: 'none', fontWeight: 'bold', borderRadius: 2 }}
            >
              {guardandoPago ? 'Guardando...' : 'Actualizar Estado Financiero'}
            </Button>
          </Paper>

          {/* DOCUMENTOS Y PODERES + VERIFICADOR OCR IA */}
          <Paper sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: 'none' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, color: 'primary.main' }}>
              <File size={20} />
              <Typography variant="h6" fontWeight="bold">
                Documentos y Poderes
              </Typography>
            </Box>

            <Button
              variant="outlined"
              component="label"
              fullWidth
              startIcon={<Upload size={16} />}
              disabled={uploading}
              sx={{ textTransform: 'none', fontWeight: 'bold', borderRadius: 2 }}
            >
              {uploading ? 'Subiendo...' : 'Subir Poder / Cédula PDF o Imagen'}
              <input type="file" accept="application/pdf,image/*" hidden onChange={handleUploadFile} />
            </Button>

            {uploading && (
              <Box sx={{ p: 1 }}>
                <LinearProgress variant="determinate" value={uploadProgress} />
              </Box>
            )}

            {/* Resultado de Verificación OCR IA */}
            {resultadoDocIA && (
              <Box sx={{ mt: 2, p: 2, bgcolor: '#ecfdf5', border: '1px solid #6ee7b7', borderRadius: 2 }}>
                <Typography variant="caption" fontWeight="bold" color="#065f46" sx={{ display: 'block', mb: 0.5 }}>
                  ✨ Verificación OCR IA ({resultadoDocIA.tipo_documento_detectado}) — {resultadoDocIA._metaIA?.modeloEjecutado}
                </Typography>
                <Typography variant="caption" color="text.primary" sx={{ display: 'block', mb: 1 }}>
                  {resultadoDocIA.observaciones_verificacion}
                </Typography>
                {resultadoDocIA.identificacion && (
                  <Typography variant="caption" sx={{ display: 'block', fontFamily: 'monospace', mb: 1 }}>
                    ID Detectado: <strong>{resultadoDocIA.identificacion}</strong>
                  </Typography>
                )}
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    size="small"
                    variant="contained"
                    color="success"
                    onClick={handleAplicarVerificacionIA}
                    sx={{ textTransform: 'none', fontSize: '0.72rem', fontWeight: 'bold' }}
                  >
                    ✓ Aplicar Acreditación
                  </Button>
                  <Button
                    size="small"
                    color="inherit"
                    onClick={() => setResultadoDocIA(null)}
                    sx={{ textTransform: 'none', fontSize: '0.72rem' }}
                  >
                    Cerrar
                  </Button>
                </Box>
              </Box>
            )}

            <Divider sx={{ my: 1.5 }} />

            <List>
              {documentos.length === 0 ? (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', py: 1 }}>
                  Al subir un Poder, Cédula o Prueba de Daño aquí, <strong>Gemini 3.8 Flash</strong> lo verifica automáticamente y activa en verde el requisito correspondiente del Semáforo Art. 35.
                </Typography>
              ) : (
                documentos.map((d) => (
                  <ListItem
                    key={d.id}
                    disablePadding
                    sx={{
                      mb: 1,
                      p: 1,
                      bgcolor: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: 2,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'stretch',
                      gap: 0.5
                    }}
                  >
                    <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center', width: '100%' }}>
                      <Button
                        component="a"
                        href={d.url}
                        target="_blank"
                        variant="text"
                        color="inherit"
                        startIcon={<File size={16} />}
                        sx={{ flexGrow: 1, justifyContent: 'flex-start', p: 0.5, overflow: 'hidden', textTransform: 'none' }}
                      >
                        <ListItemText
                          primary={d.nombre}
                          secondary={d.fecha_subida ? new Date(d.fecha_subida).toLocaleDateString() : ''}
                          primaryTypographyProps={{ noWrap: true, fontSize: '0.82rem', fontWeight: 'bold' }}
                        />
                      </Button>
                      <IconButton
                        size="small"
                        color="primary"
                        disabled={verificandoDocIAId === d.id}
                        onClick={() => handleVerificarDocIA(d)}
                        title="Re-verificar documento con IA (OCR Gemini 3.8 Flash)"
                        sx={{ border: '1px solid #e0e7ff', bgcolor: '#eef2ff' }}
                      >
                        {verificandoDocIAId === d.id ? <CircularProgress size={14} /> : <Sparkles size={15} />}
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDeleteFile(d.id, d.storage_path)}
                        sx={{ border: '1px solid #fee2e2', bgcolor: '#fef2f2' }}
                      >
                        <Trash2 size={15} />
                      </IconButton>
                    </Box>

                    {(d.categoria_ia || d.observaciones_ia) && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', pl: 1 }}>
                        {d.categoria_ia && (
                          <Chip
                            size="small"
                            color="success"
                            label={`✓ IA: ${d.categoria_ia}`}
                            sx={{ height: 20, fontSize: '0.68rem', fontWeight: 'bold' }}
                          />
                        )}
                        {d.observaciones_ia && (
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem' }}>
                            {d.observaciones_ia}
                          </Typography>
                        )}
                      </Box>
                    )}
                  </ListItem>
                ))
              )}
            </List>
          </Paper>

          {/* HISTORIAL DE NOTIFICACIONES */}
          <Paper sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: 'none' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, color: 'primary.main' }}>
              <Mail size={20} />
              <Typography variant="h6" fontWeight="bold">
                Historial de Notificaciones
              </Typography>
            </Box>

            {loadingHistorial ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                <CircularProgress size={24} />
              </Box>
            ) : historialComunicados.length === 0 ? (
              <Typography variant="body2" color="text.disabled">
                No se registran notificaciones para este representado.
              </Typography>
            ) : (
              <List sx={{ maxHeight: 380, overflow: 'auto', p: 0 }}>
                {historialComunicados.map((item) => (
                  <ItemNotificacion key={item.id} item={item} />
                ))}
              </List>
            )}
          </Paper>
        </Box>
      </Box>
    </Box>
  );
}
