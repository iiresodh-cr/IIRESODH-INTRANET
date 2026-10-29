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
  CircularProgress,
  Alert,
  Divider,
  List,
  LinearProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Collapse,
  Tooltip
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
  Mail,
  Sparkles,
  MessageCircle,
  Edit,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { registrarLogAuditoria } from '../../utils/auditLogger';
import { obtenerPerfilJurisdiccional } from '../../utils/perfilesJurisdiccionales';
import {
  extraerDatosIdentificacionIA,
  sintetizarExpedienteRepresentadoIA,
  convertirMarkdownAHtmlJuridico,
  copiarDictamenConFormato,
  descargarDictamenWord,
  descargarDictamenPDF,
  guardarDictamenEnGoogleDrive
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
    if (item.estado === 'Abierto' || item.abierto_at) {
      return { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0', label: 'Abierto' };
    }
    if (item.estado === 'Entregado' || item.entregado_at) {
      return { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe', label: 'Entregado' };
    }
    if (item.estado === 'Rebotado' || item.rebotado_at) {
      return { bg: '#fef2f2', color: '#b91c1c', border: '#fecaca', label: 'Rebotado' };
    }
    return { bg: '#f1f5f9', color: '#475569', border: '#e2e8f0', label: 'Enviado' };
  })();

  const fechaRef = item.abierto_at || item.entregado_at || item.ultima_actualizacion || '';

  return (
    <Paper
      elevation={0}
      onClick={() => setExpanded((prev) => !prev)}
      sx={{
        mb: 1,
        borderRadius: 2,
        bgcolor: '#ffffff',
        border: expanded ? '1px solid #94a3b8' : '1px solid #e2e8f0',
        cursor: 'pointer',
        overflow: 'hidden',
        transition: 'all 0.15s ease',
        '&:hover': { borderColor: '#94a3b8', bgcolor: '#fcfdfe' }
      }}
    >
      {/* Fila mínima siempre visible */}
      <Box
        sx={{
          px: 1.5,
          py: 1.1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1
        }}
      >
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            variant="body2"
            noWrap
            sx={{ fontWeight: 700, color: '#0f172a', fontSize: '0.8rem' }}
          >
            {item.asunto}
          </Typography>
          {fechaRef && (
            <Typography
              variant="caption"
              noWrap
              sx={{ color: '#64748b', fontSize: '0.68rem', display: 'block' }}
            >
              {fechaRef}
            </Typography>
          )}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexShrink: 0 }}>
          <Box
            component="span"
            sx={{
              px: 0.75,
              py: 0.15,
              borderRadius: 1,
              fontSize: '0.65rem',
              fontWeight: 700,
              bgcolor: cfg.bg,
              color: cfg.color,
              border: `1px solid ${cfg.border}`
            }}
          >
            {cfg.label}
          </Box>
          <IconButton size="small" sx={{ p: 0.25, color: '#64748b' }}>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </IconButton>
        </Box>
      </Box>

      {/* Cajón desplegable en 1 clic */}
      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <Box
          onClick={(e) => e.stopPropagation()}
          sx={{
            px: 1.5,
            py: 1.25,
            bgcolor: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
            cursor: 'default'
          }}
        >
          <Typography
            variant="caption"
            sx={{
              display: 'block',
              whiteSpace: 'pre-wrap',
              bgcolor: '#ffffff',
              p: 1.25,
              borderRadius: 1.5,
              border: '1px solid #e2e8f0',
              color: '#334155',
              fontSize: '0.76rem',
              lineHeight: 1.55,
              mb: 1
            }}
          >
            {item.cuerpo}
          </Typography>

          {item.pdf_url && (
            <Button
              component="a"
              href={item.pdf_url}
              target="_blank"
              rel="noopener"
              variant="outlined"
              size="small"
              startIcon={<File size={12} />}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.7rem',
                borderRadius: 1.25,
                py: 0.25,
                px: 1,
                mb: 1,
                bgcolor: '#ffffff',
                borderColor: '#cbd5e1',
                color: '#0f172a'
              }}
            >
              {item.pdf_nombre || 'Ver Anexo PDF'}
            </Button>
          )}

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
            {item.entregado_at && (
              <Typography variant="caption" sx={{ fontSize: '0.68rem', color: '#475569' }}>
                Recibido: <strong>{item.entregado_at}</strong>
              </Typography>
            )}
            {item.abierto_at && (
              <Typography variant="caption" sx={{ fontSize: '0.68rem', color: '#15803d' }}>
                Leído: <strong>{item.abierto_at}</strong>
              </Typography>
            )}
            {item.rebotado_at && (
              <Typography variant="caption" sx={{ fontSize: '0.68rem', color: '#b91c1c' }}>
                Rebote: <strong>{item.rebotado_at}</strong>
                {item.causa_rebote ? ` (${item.causa_rebote})` : ''}
              </Typography>
            )}
          </Box>
        </Box>
      </Collapse>
    </Paper>
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
  const [mostrarContactoSecundario, setMostrarContactoSecundario] = useState(false);
  const [mostrarPanelFinanciero, setMostrarPanelFinanciero] = useState(false);
  const [expandedNoteIds, setExpandedNoteIds] = useState({});

  const toggleExpandNota = (notaId) => {
    setExpandedNoteIds((prev) => ({ ...prev, [notaId]: !prev[notaId] }));
  };

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

          // Verificación automática con PIDA al subir el archivo
          let analisisIA = null;
          let categoriaDetectada = '';
          let observacionesIA = '';
          try {
            analisisIA = await extraerDatosIdentificacionIA({
              file,
              nombreArchivo: file.name,
              caso: caso || {}
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
              ? `Archivo subido y verificado automáticamente por PIDA (${categoriaDetectada}): se actualizó el Semáforo de Acreditación (${obtenerPerfilJurisdiccional(caso || {}).normaCorto}).`
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

      // Recalcular automáticamente los indicadores del Semáforo de Acreditación según los documentos vigentes restantes
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
        `Se eliminó el documento ID: ${docId} perteneciente a: ${apellidos}, ${nombres} y se actualizó el Semáforo de Acreditación`
      );

      setSuccess('Documento removido y Semáforo de Acreditación actualizado automáticamente.');
    } catch {
      setError('Error al eliminar archivo.');
    }
  };

  // --- FUNCIONES PIDA MULTIMODAL ---
  const handleVerificarDocIA = async (docItem) => {
    setVerificandoDocIAId(docItem.id);
    setResultadoDocIA(null);
    setError('');
    try {
      const res = await extraerDatosIdentificacionIA({
        fileUrl: docItem.url,
        mimeType: docItem.tipo || 'application/pdf',
        nombreArchivo: docItem.nombre,
        caso: caso || {}
      });
      setResultadoDocIA({ ...res, docNombre: docItem.nombre });
    } catch (err) {
      setError(`No se pudo analizar el documento con PIDA: ${err.message}`);
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
        texto: `✨ **SÍNTESIS EJECUTIVA PIDA:**\n${resumenEjecutivoIA.resumen}`,
        autor_email: currentUserEmail || 'pida@iiresodh.org',
        autor_nombre: `${currentUserEmail || 'Equipo Legal'} (Asistido por PIDA)`,
        fecha: serverTimestamp()
      });
      setSuccess('Síntesis ejecutiva de PIDA guardada en la bitácora jurídica.');
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
        <CircularProgress size={28} sx={{ color: '#0f172a' }} />
      </Box>
    );
  }

  const urlWhatsApp = obtenerUrlWhatsApp();
  const acreditacionCompleta = Boolean(cliente?.tiene_poder && cliente?.tiene_documento_id);
  const perfilJurisdiccional = obtenerPerfilJurisdiccional(caso || {});
  const nombreCompleto = `${nombres || ''} ${apellidos || ''}`.trim() || 'Representado';

  return (
    <Box sx={{ maxWidth: 1440, mx: 'auto', pb: 6 }}>
      {/* =================================================================== */}
      {/* BARRA DE NAVEGACIÓN SUPERIOR + ACCIONES EJECUTIVAS                  */}
      {/* =================================================================== */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 1.5,
          mb: 2
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Button
            size="small"
            startIcon={<ArrowLeft size={15} />}
            onClick={onVolver}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              fontSize: '0.78rem',
              color: '#475569',
              bgcolor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 1.5,
              px: 1.25,
              py: 0.4,
              '&:hover': { bgcolor: '#f1f5f9', color: '#0f172a' }
            }}
          >
            Volver al Expediente
          </Button>
          {caso?.nombre && (
            <Typography
              variant="caption"
              noWrap
              sx={{ color: '#64748b', fontSize: '0.75rem', maxWidth: { xs: 220, md: 480 } }}
            >
              / {caso.nombre}
            </Typography>
          )}
        </Box>

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          {urlWhatsApp && (
            <Button
              component="a"
              href={urlWhatsApp}
              target="_blank"
              rel="noopener noreferrer"
              variant="outlined"
              size="small"
              startIcon={<MessageCircle size={15} />}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.76rem',
                borderRadius: 1.75,
                borderColor: '#bbf7d0',
                bgcolor: '#f0fdf4',
                color: '#15803d',
                py: 0.55,
                px: 1.4,
                '&:hover': { bgcolor: '#dcfce7', borderColor: '#86efac' }
              }}
            >
              WhatsApp
            </Button>
          )}
          <Button
            variant="contained"
            size="small"
            startIcon={<Sparkles size={15} />}
            disabled={generandoResumenIA}
            onClick={handleGenerarResumenIA}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.78rem',
              borderRadius: 1.75,
              bgcolor: '#0f172a',
              color: '#ffffff',
              py: 0.6,
              px: 1.6,
              boxShadow: '0 1px 2px rgba(15, 23, 42, 0.12)',
              '&:hover': { bgcolor: '#1e293b' }
            }}
          >
            {generandoResumenIA ? 'Sintetizando...' : 'Síntesis Ejecutiva PIDA'}
          </Button>
        </Box>
      </Box>

      {/* =================================================================== */}
      {/* CABECERA EJECUTIVA UNIFICADA DEL REPRESENTADO + SEMÁFORO COMPACTO   */}
      {/* =================================================================== */}
      <Paper
        elevation={0}
        sx={{
          position: 'relative',
          p: { xs: 2, sm: 2.5 },
          pl: { xs: 2.5, sm: 3 },
          mb: 2.5,
          borderRadius: '0 10px 10px 0',
          bgcolor: '#ffffff',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 2px rgba(15, 23, 42, 0.03)',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: '4px',
            bgcolor: acreditacionCompleta ? '#10b981' : '#f59e0b'
          }
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', lg: 'row' },
            justifyContent: 'space-between',
            alignItems: { xs: 'flex-start', lg: 'center' },
            gap: 2
          }}
        >
          {/* Identidad principal */}
          <Box sx={{ minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 800,
                  color: '#0f172a',
                  letterSpacing: '-0.02em',
                  fontSize: { xs: '1.15rem', sm: '1.35rem' }
                }}
              >
                {nombreCompleto}
              </Typography>

              {identificacion && (
                <Box
                  component="span"
                  sx={{
                    px: 0.85,
                    py: 0.15,
                    borderRadius: 1,
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    fontFamily: 'monospace',
                    bgcolor: '#f1f5f9',
                    color: '#334155',
                    border: '1px solid #e2e8f0'
                  }}
                >
                  {tipoIdentificacion}: {identificacion}
                </Box>
              )}

              <Box
                component="span"
                sx={{
                  px: 0.85,
                  py: 0.15,
                  borderRadius: 1,
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  bgcolor: '#eff6ff',
                  color: '#1d4ed8'
                }}
              >
                {calidadProcesal}
              </Box>

              {condicionVulnerabilidad && condicionVulnerabilidad !== 'Ninguna' && (
                <Box
                  component="span"
                  sx={{
                    px: 0.85,
                    py: 0.15,
                    borderRadius: 1,
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    bgcolor: '#faf5ff',
                    color: '#7e22ce',
                    border: '1px solid #e9d5ff'
                  }}
                >
                  🛡️ {condicionVulnerabilidad}
                </Box>
              )}
            </Box>

            <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.76rem' }}>
              {perfilJurisdiccional.pais.bandera} Estándar de Acreditación:{' '}
              <strong style={{ color: '#334155' }}>{perfilJurisdiccional.normaTitulo}</strong> ·{' '}
              {correoPrincipal || 'Sin correo'} · {codigoTelefonoPrincipal} {telefonoPrincipal || 'Sin teléfono'}
            </Typography>
          </Box>

          {/* Cinta de Telemetría y Acreditación en 1 Clic */}
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 0.75,
              p: 0.6,
              bgcolor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 2
            }}
          >
            <Tooltip title="Clic para conmutar estado de Poder / Personería">
              <Box
                onClick={() => handleToggleAcreditacion('tiene_poder')}
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.5,
                  px: 1,
                  py: 0.35,
                  borderRadius: 1.25,
                  cursor: 'pointer',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  bgcolor: cliente?.tiene_poder ? '#f0fdf4' : '#fffbeb',
                  color: cliente?.tiene_poder ? '#15803d' : '#b45309',
                  border: cliente?.tiene_poder ? '1px solid #bbf7d0' : '1px solid #fde68a'
                }}
              >
                {perfilJurisdiccional.requisitos.poder.fichaLabel(Boolean(cliente?.tiene_poder))}
              </Box>
            </Tooltip>

            <Tooltip title="Clic para conmutar estado de Documento de Identidad">
              <Box
                onClick={() => handleToggleAcreditacion('tiene_documento_id')}
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.5,
                  px: 1,
                  py: 0.35,
                  borderRadius: 1.25,
                  cursor: 'pointer',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  bgcolor: cliente?.tiene_documento_id ? '#f0fdf4' : '#fffbeb',
                  color: cliente?.tiene_documento_id ? '#15803d' : '#b45309',
                  border: cliente?.tiene_documento_id ? '1px solid #bbf7d0' : '1px solid #fde68a'
                }}
              >
                {perfilJurisdiccional.requisitos.identidad.fichaLabel(Boolean(cliente?.tiene_documento_id))}
              </Box>
            </Tooltip>

            <Tooltip title="Clic para conmutar estado de Prueba / Daño">
              <Box
                onClick={() => handleToggleAcreditacion('tiene_prueba_dano')}
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.5,
                  px: 1,
                  py: 0.35,
                  borderRadius: 1.25,
                  cursor: 'pointer',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  bgcolor: cliente?.tiene_prueba_dano ? '#f0fdf4' : '#ffffff',
                  color: cliente?.tiene_prueba_dano ? '#15803d' : '#64748b',
                  border: cliente?.tiene_prueba_dano ? '1px solid #bbf7d0' : '1px solid #e2e8f0'
                }}
              >
                {perfilJurisdiccional.requisitos.prueba.fichaLabel(Boolean(cliente?.tiene_prueba_dano))}
              </Box>
            </Tooltip>
          </Box>
        </Box>
      </Paper>

      {/* PANEL DESPLEGABLE DE SÍNTESIS EJECUTIVA PIDA */}
      {resumenEjecutivoIA && (
        <Paper
          elevation={0}
          sx={{
            p: 2.5,
            mb: 2.5,
            borderRadius: 2.5,
            border: '1px solid #cbd5e1',
            bgcolor: '#f8fafc'
          }}
        >
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 1,
              mb: 1.5
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Sparkles size={17} color="#0f172a" />
              <Typography variant="subtitle2" fontWeight={800} color="#0f172a">
                Dictamen Ejecutivo Individual PIDA ({perfilJurisdiccional.normaCorto})
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
              <Button
                size="small"
                variant="outlined"
                onClick={async () => {
                  await copiarDictamenConFormato({
                    markdown: resumenEjecutivoIA.resumen,
                    titulo: `Ficha Ejecutiva PIDA - ${nombres} ${apellidos}`,
                    caso: caso || {}
                  });
                  alert('✅ Síntesis ejecutiva copiada con formato.');
                }}
                sx={{
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '0.74rem',
                  bgcolor: '#ffffff',
                  borderColor: '#cbd5e1',
                  color: '#0f172a',
                  borderRadius: 1.5
                }}
              >
                Copiar
              </Button>
              <Button
                size="small"
                variant="outlined"
                onClick={async () => {
                  try {
                    const docDrive = await guardarDictamenEnGoogleDrive({
                      markdown: resumenEjecutivoIA.resumen,
                      titulo: `Síntesis Representado ${nombres} ${apellidos}`,
                      caso: caso || {},
                      userEmail: currentUserEmail
                    });
                    window.open(docDrive.webViewLink, '_blank');
                  } catch (e) {
                    setError(`No se pudo guardar en Google Drive: ${e.message}`);
                  }
                }}
                sx={{
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '0.74rem',
                  bgcolor: '#ffffff',
                  borderColor: '#cbd5e1',
                  color: '#0f172a',
                  borderRadius: 1.5
                }}
              >
                Drive
              </Button>
              <Button
                size="small"
                variant="outlined"
                onClick={() =>
                  descargarDictamenWord({
                    markdown: resumenEjecutivoIA.resumen,
                    titulo: `Sintesis_PIDA_${apellidos}_${nombres}`,
                    caso: caso || {}
                  })
                }
                sx={{
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '0.74rem',
                  bgcolor: '#ffffff',
                  borderColor: '#cbd5e1',
                  color: '#0f172a',
                  borderRadius: 1.5
                }}
              >
                Word
              </Button>
              <Button
                size="small"
                variant="outlined"
                onClick={() =>
                  descargarDictamenPDF({
                    markdown: resumenEjecutivoIA.resumen,
                    titulo: `Síntesis PIDA - ${nombres} ${apellidos}`,
                    caso: caso || {}
                  })
                }
                sx={{
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '0.74rem',
                  bgcolor: '#ffffff',
                  borderColor: '#cbd5e1',
                  color: '#0f172a',
                  borderRadius: 1.5
                }}
              >
                PDF
              </Button>
              <Button
                size="small"
                variant="contained"
                onClick={handleGuardarResumenComoNota}
                sx={{
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: '0.74rem',
                  bgcolor: '#0f172a',
                  borderRadius: 1.5
                }}
              >
                Guardar en Bitácora
              </Button>
              <Button
                size="small"
                color="inherit"
                onClick={() => setResumenEjecutivoIA(null)}
                sx={{ textTransform: 'none', fontSize: '0.74rem' }}
              >
                Cerrar
              </Button>
            </Box>
          </Box>
          <Box
            sx={{
              bgcolor: '#ffffff',
              p: 2.25,
              borderRadius: 2,
              border: '1px solid #e2e8f0',
              fontFamily: '"Georgia", "Times New Roman", serif',
              fontSize: '0.92rem',
              lineHeight: 1.68
            }}
            dangerouslySetInnerHTML={{
              __html: convertirMarkdownAHtmlJuridico(resumenEjecutivoIA.resumen)
            }}
          />
        </Paper>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      {/* =================================================================== */}
      {/* CUADRÍCULA DE TRABAJO DE 2 COLUMNAS                                 */}
      {/* =================================================================== */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '7fr 5fr' },
          gap: 2.5,
          alignItems: 'start'
        }}
      >
        {/* COLUMNA IZQUIERDA: FICHA DEL REPRESENTADO + BITÁCORA JURÍDICA */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <Paper
            component="form"
            onSubmit={handleUpdateDatos}
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: 2.5,
              border: '1px solid #e2e8f0',
              bgcolor: '#ffffff'
            }}
          >
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 2,
                pb: 1.25,
                borderBottom: '1px solid #f1f5f9'
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <User size={17} color="#0f172a" />
                <Typography variant="subtitle1" fontWeight={800} color="#0f172a" sx={{ fontSize: '0.95rem' }}>
                  Ficha de Identidad, Rol Procesal y Contacto
                </Typography>
              </Box>
              <Button
                type="submit"
                size="small"
                variant="contained"
                startIcon={<Save size={14} />}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  borderRadius: 1.5,
                  bgcolor: '#0f172a',
                  py: 0.5,
                  px: 1.5,
                  '&:hover': { bgcolor: '#1e293b' }
                }}
              >
                Guardar
              </Button>
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5, mb: 1.5 }}>
              <TextField
                size="small"
                label="Nombres"
                fullWidth
                value={nombres}
                onChange={(e) => setNombres(e.target.value)}
                required
              />
              <TextField
                size="small"
                label="Apellidos"
                fullWidth
                value={apellidos}
                onChange={(e) => setApellidos(e.target.value)}
                required
              />
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5, mb: 1.5 }}>
              <FormControl size="small" fullWidth>
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
                size="small"
                label="Número de Identificación"
                fullWidth
                value={identificacion}
                onChange={(e) => setIdentificacion(e.target.value)}
                required
              />
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5, mb: 1.5 }}>
              <FormControl size="small" fullWidth>
                <InputLabel>
                  {perfilJurisdiccional.esInternacional
                    ? 'Calidad Procesal (SIDH)'
                    : 'Calidad Procesal (Actor / Accionante)'}
                </InputLabel>
                <Select
                  value={calidadProcesal}
                  label={
                    perfilJurisdiccional.esInternacional
                      ? 'Calidad Procesal (SIDH)'
                      : 'Calidad Procesal (Actor / Accionante)'
                  }
                  onChange={(e) => setCalidadProcesal(e.target.value)}
                >
                  {CALIDADES_PROCESALES.map((cal) => (
                    <MenuItem key={cal} value={cal}>
                      {cal}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl size="small" fullWidth>
                <InputLabel>
                  {perfilJurisdiccional.esInternacional
                    ? 'Vulnerabilidad (Art. 29.2 CIDH)'
                    : 'Vulnerabilidad / Trámite Preferente'}
                </InputLabel>
                <Select
                  value={condicionVulnerabilidad}
                  label={
                    perfilJurisdiccional.esInternacional
                      ? 'Vulnerabilidad (Art. 29.2 CIDH)'
                      : 'Vulnerabilidad / Trámite Preferente'
                  }
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

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5, mb: 1.5 }}>
              <FormControl size="small" fullWidth>
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

              <TextField
                size="small"
                label="Email Principal"
                type="email"
                fullWidth
                value={correoPrincipal}
                onChange={(e) => setCorreoPrincipal(e.target.value)}
                required
              />
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '130px 1fr' }, gap: 1.5, mb: 1.5 }}>
              <FormControl size="small" fullWidth>
                <InputLabel>Cód. País</InputLabel>
                <Select
                  value={codigoTelefonoPrincipal}
                  label="Cód. País"
                  onChange={(e) => setCodigoTelefonoPrincipal(e.target.value)}
                >
                  {COUNTRIES.map((c) => (
                    <MenuItem key={c.code} value={c.phone}>{`${c.code} (${c.phone})`}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                size="small"
                label="Teléfono Principal"
                fullWidth
                value={telefonoPrincipal}
                onChange={(e) => setTelefonoPrincipal(e.target.value)}
              />
            </Box>

            {/* Revelado Progresivo de Contacto Secundario y Dirección */}
            <Box sx={{ pt: 0.5 }}>
              <Button
                size="small"
                variant="text"
                onClick={() => setMostrarContactoSecundario((prev) => !prev)}
                endIcon={mostrarContactoSecundario ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: '#475569',
                  p: 0.5
                }}
              >
                {mostrarContactoSecundario
                  ? 'Ocultar dirección física y contacto secundario'
                  : 'Dirección física y contacto secundario'}
              </Button>

              <Collapse in={mostrarContactoSecundario} timeout="auto">
                <Box sx={{ pt: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  <TextField
                    size="small"
                    label="Dirección Física Completa"
                    fullWidth
                    multiline
                    rows={2}
                    value={direccion}
                    onChange={(e) => setDireccion(e.target.value)}
                  />
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 130px 1fr' }, gap: 1.5 }}>
                    <TextField
                      size="small"
                      label="Email Secundario"
                      type="email"
                      fullWidth
                      value={correoSecundario}
                      onChange={(e) => setCorreoSecundario(e.target.value)}
                    />
                    <FormControl size="small" fullWidth>
                      <InputLabel>Cód. Sec.</InputLabel>
                      <Select
                        value={codigoTelefonoSecundario}
                        label="Cód. Sec."
                        onChange={(e) => setCodigoTelefonoSecundario(e.target.value)}
                      >
                        {COUNTRIES.map((c) => (
                          <MenuItem key={c.code} value={c.phone}>{`${c.code} (${c.phone})`}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <TextField
                      size="small"
                      label="Teléfono Secundario"
                      fullWidth
                      value={telefonoSecundario}
                      onChange={(e) => setTelefonoSecundario(e.target.value)}
                    />
                  </Box>
                </Box>
              </Collapse>
            </Box>
          </Paper>

          {/* BITÁCORA DE NOTAS JURÍDICAS CON AUTORÍA */}
          <Paper
            elevation={0}
            sx={{ p: 2.5, borderRadius: 2.5, border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                mb: 1.75
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <StickyNote size={17} color="#0f172a" />
                <Typography variant="subtitle1" fontWeight={800} color="#0f172a" sx={{ fontSize: '0.95rem' }}>
                  Bitácora Jurídica Individual
                </Typography>
                <Box
                  component="span"
                  sx={{
                    px: 0.7,
                    py: 0.1,
                    borderRadius: 1,
                    bgcolor: '#f1f5f9',
                    color: '#475569',
                    fontSize: '0.68rem',
                    fontWeight: 700
                  }}
                >
                  {notes.length}
                </Box>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <TextField
                size="small"
                placeholder="Registrar anotación o seguimiento jurídico..."
                fullWidth
                multiline
                rows={2}
                value={nuevaNota}
                onChange={(e) => setNuevaNota(e.target.value)}
              />
              <Button
                variant="contained"
                onClick={handleAddNota}
                disabled={!nuevaNota.trim()}
                sx={{
                  minWidth: 44,
                  bgcolor: '#0f172a',
                  borderRadius: 1.5,
                  '&:hover': { bgcolor: '#1e293b' }
                }}
              >
                <Plus size={18} />
              </Button>
            </Box>

            <List sx={{ maxHeight: 340, overflow: 'auto', p: 0 }}>
              {notes.length === 0 ? (
                <Typography variant="caption" color="#64748b" sx={{ display: 'block', py: 1 }}>
                  No hay anotaciones registradas en este expediente individual.
                </Typography>
              ) : (
                notes.map((n) => {
                  const esNotaLarga = (n.texto || '').length > 180;
                  const isNotaExpanded = Boolean(expandedNoteIds[n.id]);
                  return (
                    <Box
                      key={n.id}
                      onClick={() => esNotaLarga && toggleExpandNota(n.id)}
                      sx={{
                        mb: 1.25,
                        p: 1.5,
                        borderRadius: 2,
                        bgcolor: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        cursor: esNotaLarga ? 'pointer' : 'default',
                        transition: 'border-color 0.15s ease',
                        '&:hover': esNotaLarga ? { borderColor: '#cbd5e1' } : {}
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
                        <Box
                          sx={{
                            flexGrow: 1,
                            fontSize: '0.82rem',
                            color: '#1e293b',
                            lineHeight: 1.55,
                            ...(esNotaLarga && !isNotaExpanded
                              ? {
                                  display: '-webkit-box',
                                  WebkitLineClamp: 3,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden'
                                }
                              : {}),
                            '& p': { margin: '0 0 6px 0' },
                            '& p:last-child': { marginBottom: 0 }
                          }}
                          dangerouslySetInnerHTML={{
                            __html: convertirMarkdownAHtmlJuridico(n.texto || '')
                          }}
                        />
                        <Box
                          sx={{ display: 'flex', gap: 0.25, flexShrink: 0 }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <IconButton size="small" onClick={() => handleEditNota(n)} sx={{ p: 0.4 }}>
                            <Edit size={13} />
                          </IconButton>
                          <IconButton size="small" color="error" onClick={() => handleDeleteNota(n.id)} sx={{ p: 0.4 }}>
                            <Trash2 size={13} />
                          </IconButton>
                        </Box>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.75 }}>
                        <Typography variant="caption" sx={{ color: '#475569', fontWeight: 700, fontSize: '0.68rem' }}>
                          {n.autor_nombre || n.autor_email || 'Equipo Legal'}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {esNotaLarga && (
                            <Typography
                              variant="caption"
                              sx={{ color: '#4338ca', fontWeight: 700, fontSize: '0.68rem' }}
                            >
                              {isNotaExpanded ? 'Contraer ▴' : 'Ver nota completa ▾'}
                            </Typography>
                          )}
                          <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.68rem' }}>
                            {n.fecha?.toDate ? n.fecha.toDate().toLocaleString() : 'Reciente'}
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                  );
                })
              )}
            </List>
          </Paper>
        </Box>

        {/* COLUMNA DERECHA: DOCUMENTOS & PODERES · FINANZAS COLAPSABLE · NOTIFICACIONES */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          {/* DOCUMENTOS Y PODERES + VERIFICADOR OCR PIDA */}
          <Paper
            elevation={0}
            sx={{ p: 2.5, borderRadius: 2.5, border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1,
                mb: 1.75
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <File size={17} color="#0f172a" />
                <Typography variant="subtitle1" fontWeight={800} color="#0f172a" sx={{ fontSize: '0.95rem' }}>
                  Documentos y Poderes
                </Typography>
                <Box
                  component="span"
                  sx={{
                    px: 0.7,
                    py: 0.1,
                    borderRadius: 1,
                    bgcolor: '#f1f5f9',
                    color: '#475569',
                    fontSize: '0.68rem',
                    fontWeight: 700
                  }}
                >
                  {documentos.length}
                </Box>
              </Box>

              <Button
                variant="contained"
                component="label"
                size="small"
                startIcon={<Upload size={14} />}
                disabled={uploading}
                sx={{
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  borderRadius: 1.5,
                  bgcolor: '#0f172a',
                  py: 0.5,
                  px: 1.4,
                  '&:hover': { bgcolor: '#1e293b' }
                }}
              >
                {uploading ? 'Subiendo...' : 'Subir Archivo'}
                <input type="file" accept="application/pdf,image/*" hidden onChange={handleUploadFile} />
              </Button>
            </Box>

            {uploading && (
              <Box sx={{ mb: 1.5 }}>
                <LinearProgress variant="determinate" value={uploadProgress} />
              </Box>
            )}

            {resultadoDocIA && (
              <Box sx={{ mb: 1.5, p: 1.5, bgcolor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 2 }}>
                <Typography variant="caption" fontWeight={700} color="#15803d" sx={{ display: 'block', mb: 0.4 }}>
                  ✨ Verificación OCR PIDA ({resultadoDocIA.tipo_documento_detectado})
                </Typography>
                <Typography variant="caption" color="#334155" sx={{ display: 'block', mb: 0.75 }}>
                  {resultadoDocIA.observaciones_verificacion}
                </Typography>
                {resultadoDocIA.identificacion && (
                  <Typography variant="caption" sx={{ display: 'block', fontFamily: 'monospace', mb: 0.75 }}>
                    ID Detectado: <strong>{resultadoDocIA.identificacion}</strong>
                  </Typography>
                )}
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    size="small"
                    variant="contained"
                    color="success"
                    onClick={handleAplicarVerificacionIA}
                    sx={{ textTransform: 'none', fontSize: '0.7rem', fontWeight: 700, py: 0.25 }}
                  >
                    Aplicar Acreditación
                  </Button>
                  <Button
                    size="small"
                    color="inherit"
                    onClick={() => setResultadoDocIA(null)}
                    sx={{ textTransform: 'none', fontSize: '0.7rem', py: 0.25 }}
                  >
                    Cerrar
                  </Button>
                </Box>
              </Box>
            )}

            <List sx={{ p: 0 }}>
              {documentos.length === 0 ? (
                <Typography variant="caption" color="#64748b" sx={{ display: 'block', py: 1 }}>
                  Sube un Poder, Cédula o Prueba para que <strong>PIDA</strong> lo verifique automáticamente bajo el estándar{' '}
                  <strong>{perfilJurisdiccional.normaCorto}</strong>.
                </Typography>
              ) : (
                documentos.map((d) => (
                  <Box
                    key={d.id}
                    sx={{
                      mb: 1,
                      p: 1.25,
                      bgcolor: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: 2,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 0.5
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                      <Box
                        component="a"
                        href={d.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.75,
                          minWidth: 0,
                          flex: 1,
                          textDecoration: 'none',
                          color: '#0f172a',
                          '&:hover': { color: '#1d4ed8' }
                        }}
                      >
                        <File size={15} />
                        <Box sx={{ minWidth: 0 }}>
                          <Typography noWrap sx={{ fontSize: '0.8rem', fontWeight: 700 }}>
                            {d.nombre}
                          </Typography>
                          <Typography sx={{ fontSize: '0.67rem', color: '#64748b' }}>
                            {d.fecha_subida ? new Date(d.fecha_subida).toLocaleDateString() : ''}
                          </Typography>
                        </Box>
                      </Box>

                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                        <Tooltip title="Re-verificar documento con PIDA">
                          <IconButton
                            size="small"
                            disabled={verificandoDocIAId === d.id}
                            onClick={() => handleVerificarDocIA(d)}
                            sx={{ p: 0.5, color: '#475569', bgcolor: '#ffffff', border: '1px solid #e2e8f0' }}
                          >
                            {verificandoDocIAId === d.id ? <CircularProgress size={13} /> : <Sparkles size={14} />}
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Eliminar documento">
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteFile(d.id, d.storage_path)}
                            sx={{
                              p: 0.5,
                              color: '#94a3b8',
                              '&:hover': { color: '#dc2626', bgcolor: '#fef2f2' }
                            }}
                          >
                            <Trash2 size={14} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>

                    {(d.categoria_ia || d.observaciones_ia) && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap', pt: 0.25 }}>
                        {d.categoria_ia && (
                          <Box
                            component="span"
                            sx={{
                              px: 0.7,
                              py: 0.1,
                              borderRadius: 0.85,
                              bgcolor: '#f0fdf4',
                              color: '#15803d',
                              border: '1px solid #bbf7d0',
                              fontSize: '0.65rem',
                              fontWeight: 700
                            }}
                          >
                            ✓ PIDA: {d.categoria_ia}
                          </Box>
                        )}
                        {d.observaciones_ia && (
                          <Typography variant="caption" sx={{ fontSize: '0.7rem', color: '#64748b' }}>
                            {d.observaciones_ia}
                          </Typography>
                        )}
                      </Box>
                    )}
                  </Box>
                ))
              )}
            </List>
          </Paper>

          {/* CONTROL FINANCIERO Y APORTES (TARJETA COMPACTA CON DESPLIEGUE EN 1 CLIC) */}
          <Paper
            elevation={0}
            sx={{ borderRadius: 2.5, border: '1px solid #e2e8f0', bgcolor: '#ffffff', overflow: 'hidden' }}
          >
            <Box
              onClick={() => setMostrarPanelFinanciero((prev) => !prev)}
              sx={{
                p: 2,
                px: 2.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                '&:hover': { bgcolor: '#f8fafc' }
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CreditCard size={17} color="#0f172a" />
                <Box>
                  <Typography variant="subtitle2" fontWeight={800} color="#0f172a" sx={{ fontSize: '0.9rem' }}>
                    Control Financiero y Aportes
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.72rem' }}>
                    {monedaPago} {Number(montoPagado || 0).toLocaleString()} · {metodoPago}
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box
                  component="span"
                  sx={{
                    px: 0.85,
                    py: 0.2,
                    borderRadius: 1,
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    bgcolor:
                      estadoPago === 'Pagado'
                        ? '#f0fdf4'
                        : estadoPago === 'Exonerado / Pro Bono'
                        ? '#faf5ff'
                        : '#fffbeb',
                    color:
                      estadoPago === 'Pagado'
                        ? '#15803d'
                        : estadoPago === 'Exonerado / Pro Bono'
                        ? '#7e22ce'
                        : '#b45309'
                  }}
                >
                  {estadoPago}
                </Box>
                <IconButton size="small" sx={{ p: 0.25, color: '#64748b' }}>
                  {mostrarPanelFinanciero ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                </IconButton>
              </Box>
            </Box>

            <Collapse in={mostrarPanelFinanciero} timeout="auto">
              <Box sx={{ p: 2, px: 2.5, bgcolor: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.25, mb: 1.25 }}>
                  <FormControl size="small" fullWidth sx={{ bgcolor: '#ffffff' }}>
                    <InputLabel>Estado de Pago</InputLabel>
                    <Select
                      value={estadoPago}
                      label="Estado de Pago"
                      onChange={(e) => setEstadoPago(e.target.value)}
                    >
                      {ESTADOS_PAGO_CLIENTE.map((st) => (
                        <MenuItem key={st} value={st}>
                          {st}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <FormControl size="small" fullWidth sx={{ bgcolor: '#ffffff' }}>
                    <InputLabel>Vía de Pago</InputLabel>
                    <Select
                      value={metodoPago}
                      label="Vía de Pago"
                      onChange={(e) => setMetodoPago(e.target.value)}
                    >
                      <MenuItem value="Transferencia / SINPE">Transferencia / SINPE</MenuItem>
                      <MenuItem value="Stripe">Stripe (Tarjeta)</MenuItem>
                      <MenuItem value="Depósito Bancario">Depósito Bancario</MenuItem>
                      <MenuItem value="Exoneración Pro Bono">Exoneración Pro Bono</MenuItem>
                    </Select>
                  </FormControl>
                </Box>

                <Box sx={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 1.25, mb: 1.25 }}>
                  <TextField
                    size="small"
                    label="Monto Aportado"
                    type="number"
                    value={montoPagado}
                    onChange={(e) => setMontoPagado(e.target.value)}
                    sx={{ bgcolor: '#ffffff' }}
                  />
                  <FormControl size="small" fullWidth sx={{ bgcolor: '#ffffff' }}>
                    <InputLabel>Moneda</InputLabel>
                    <Select
                      value={monedaPago}
                      label="Moneda"
                      onChange={(e) => setMonedaPago(e.target.value)}
                    >
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
                  sx={{ mb: 1.25, bgcolor: '#ffffff' }}
                />

                <Button
                  fullWidth
                  variant="contained"
                  size="small"
                  disabled={guardandoPago}
                  onClick={handleGuardarPago}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 700,
                    borderRadius: 1.5,
                    bgcolor: '#0f172a',
                    '&:hover': { bgcolor: '#1e293b' }
                  }}
                >
                  {guardandoPago ? 'Guardando...' : 'Actualizar Registro Financiero'}
                </Button>
              </Box>
            </Collapse>
          </Paper>

          {/* HISTORIAL DE NOTIFICACIONES (ELEMENTOS MÍNIMOS EXPANDIBLES EN 1 CLIC) */}
          <Paper
            elevation={0}
            sx={{ p: 2.5, borderRadius: 2.5, border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.75 }}>
              <Mail size={17} color="#0f172a" />
              <Typography variant="subtitle1" fontWeight={800} color="#0f172a" sx={{ fontSize: '0.95rem' }}>
                Historial de Notificaciones
              </Typography>
              <Box
                component="span"
                sx={{
                  px: 0.7,
                  py: 0.1,
                  borderRadius: 1,
                  bgcolor: '#f1f5f9',
                  color: '#475569',
                  fontSize: '0.68rem',
                  fontWeight: 700
                }}
              >
                {historialComunicados.length}
              </Box>
            </Box>

            {loadingHistorial ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                <CircularProgress size={22} />
              </Box>
            ) : historialComunicados.length === 0 ? (
              <Typography variant="caption" color="#64748b">
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
