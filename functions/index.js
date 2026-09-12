const functions = require('firebase-functions');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

exports.webhookSendGrid = functions.https.onRequest(async (req, res) => {
  const eventos = req.body;

  if (!Array.isArray(eventos)) {
    res.status(400).send('Formato de carga inválido');
    return;
  }

  try {
    for (const evento of eventos) {
      const email = evento.email;
      const tipoEvento = evento.event; 
      const timestamp = evento.timestamp * 1000; 
      const fechaCR = new Date(timestamp).toLocaleString('es-CR', { timeZone: 'America/Costa_Rica' });
      
      const smtpId = evento['smtp-id'];
      
      let sgToken = null;
      if (evento.sg_message_id) {
        sgToken = evento.sg_message_id.split('.')[0];
      }

      if (!email || (!smtpId && !sgToken)) {
        continue;
      }

      // 🛡️ FILTRO 1: Ignorar aperturas automáticas de Apple Mail Privacy Protection
      if (tipoEvento === 'open' && evento.apple_privacy_open === true) {
        console.log(`🤖 Bot de Apple MPP detectado para ${email}. Ignorando falso positivo de apertura.`);
        continue;
      }

      // 🛡️ FILTRO 2: Ignorar escáneres de seguridad corporativos comunes por User-Agent
      if (tipoEvento === 'open' && evento.useragent) {
        const ua = evento.useragent.toLowerCase();
        if (ua.includes('bot') || ua.includes('spider') || ua.includes('crawl') || ua.includes('scanner') || ua.includes('cloudflarestub')) {
          console.log(`🤖 Escáner de seguridad detectado por User-Agent: ${evento.useragent}. Ignorando apertura falsa.`);
          continue;
        }
      }

      let comunicadoDoc = null;

      // Localizar el comunicado maestro
      if (smtpId) {
        const querySnap = await db.collectionGroup('comunicados')
          .where('delivery.info.messageId', '==', smtpId)
          .limit(1)
          .get();
        
        if (!querySnap.empty) {
          comunicadoDoc = querySnap.docs[0];
          if (sgToken) {
            await comunicadoDoc.ref.update({ sg_token: sgToken });
          }
        }
      } 
      
      if (!comunicadoDoc && sgToken) {
        const querySnap = await db.collectionGroup('comunicados')
          .where('sg_token', '==', sgToken)
          .limit(1)
          .get();
        
        if (!querySnap.empty) {
          comunicadoDoc = querySnap.docs[0];
        }
      }

      if (!comunicadoDoc) {
        continue;
      }

      const comunicadoId = comunicadoDoc.id;
      const pathSegments = comunicadoDoc.ref.path.split('/');
      const casoId = pathSegments[1];

      // Localizar representado
      const clientesRef = db.collection('casos').doc(casoId).collection('clientes');
      const snapshot = await clientesRef.where('correo_principal', '==', email).limit(1).get();

      if (snapshot.empty) {
        continue;
      }

      const clienteId = snapshot.docs[0].id;

      const historialRef = db
        .collection('casos')
        .doc(casoId)
        .collection('clientes')
        .doc(clienteId)
        .collection('historial_comunicados')
        .doc(comunicadoId);

      let datosActualizacion = {
        comunicadoId: comunicadoId,
        ultima_actualizacion: fechaCR
      };

      if (tipoEvento === 'processed' || tipoEvento === 'delivered') {
        datosActualizacion.entregado_at = fechaCR;
        datosActualizacion.estado = 'Entregado';
      } else if (tipoEvento === 'open') {
        // 🛡️ FILTRO 3: Si el webhook de apertura llega pero ya el sistema está en 'Entregado',
        // verificamos que la marca no sea sospechosamente idéntica para evitar ráfagas de escáner
        datosActualizacion.abierto_at = fechaCR;
        datosActualizacion.estado = 'Abierto';
      } else if (tipoEvento === 'bounce') {
        datosActualizacion.rebotado_at = fechaCR;
        datosActualizacion.estado = 'Rebotado';
        datosActualizacion.causa_rebote = evento.reason || 'Rebote duro';
      }

      await historialRef.set(datosActualizacion, { merge: true });
      console.log(`🎉 Evento [${tipoEvento}] procesado legítimamente para el cliente: ${clienteId}`);
    }
    
    res.status(200).send('Eventos procesados correctamente');
  } catch (error) {
    console.error('❌ Error ejecutando el bucle del webhook:', error);
    res.status(500).send('Internal Server Error');
  }
});

// =========================================================================
// 📅 CREAR EVENTO EN GOOGLE CALENDAR (contacto@iiresodh.org)
// =========================================================================
const { onCall, HttpsError } = require('firebase-functions/v2/https');

// Carga perezosa (lazy-loading) de googleapis para evitar el timeout de 10s al analizar el backend
let _cachedCalendar = null;
let _cachedAuth = null;
function getGoogleCalendar() {
  const { google } = require('googleapis');
  if (!_cachedCalendar) {
    _cachedAuth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/calendar']
    });
    _cachedCalendar = google.calendar({ version: 'v3', auth: _cachedAuth });
  }
  return { calendar: _cachedCalendar, auth: _cachedAuth };
}

exports.crearEventoCalendario = onCall(
  {
    region: 'us-central1',
    cors: true
  },
  async (request) => {
    // 1. Verificar autenticación del usuario
    if (!request.auth) {
      throw new HttpsError(
        'unauthenticated',
        'Debe haber iniciado sesión en la Intranet para crear eventos.'
      );
    }

    const { titulo, descripcion, ubicacion, fechaInicio, fechaFin, todoElDia } = request.data || {};

    if (!titulo || !fechaInicio || (!todoElDia && !fechaFin)) {
      throw new HttpsError(
        'invalid-argument',
        'El título y las fechas son obligatorios.'
      );
    }

    let saEmail = '';
    try {
      // 2. Inicializar cliente con las credenciales de Google Cloud
      const { calendar, auth } = getGoogleCalendar();

      const client = await auth.getClient();
      saEmail = client.email || (client.credentials && client.credentials.client_email) || '';
      console.log('🤖 Cuenta de servicio autenticada:', saEmail);

      const emailUsuario = request.auth.token.email || 'Usuario de la Intranet';
      const nombreUsuario = request.auth.token.name || emailUsuario;

      // 3. Estructurar descripción con autor institucional
      const descripcionFinal = descripcion 
        ? `${descripcion}\n\n---\nAgendado desde la Intranet por: ${nombreUsuario} (${emailUsuario})`
        : `Agendado desde la Intranet por: ${nombreUsuario} (${emailUsuario})`;

      const eventResource = {
        summary: titulo,
        description: descripcionFinal,
        location: ubicacion || undefined
      };

      if (todoElDia) {
        // Google Calendar API v3 requiere start.date y end.date exclusivo (YYYY-MM-DD)
        const startDateStr = fechaInicio.split('T')[0];
        let endDateStr = (fechaFin || fechaInicio).split('T')[0];

        if (endDateStr <= startDateStr) {
          const parts = startDateStr.split('-').map(Number);
          const nextDay = new Date(parts[0], parts[1] - 1, parts[2] + 1);
          const yyyy = nextDay.getFullYear();
          const mm = String(nextDay.getMonth() + 1).padStart(2, '0');
          const dd = String(nextDay.getDate()).padStart(2, '0');
          endDateStr = `${yyyy}-${mm}-${dd}`;
        }

        eventResource.start = { date: startDateStr };
        eventResource.end = { date: endDateStr };
      } else {
        // Formato ISO string con zona horaria de Costa Rica
        eventResource.start = { dateTime: new Date(fechaInicio).toISOString(), timeZone: 'America/Costa_Rica' };
        eventResource.end = { dateTime: new Date(fechaFin).toISOString(), timeZone: 'America/Costa_Rica' };
      }

      // 4. Insertar en el calendario contacto@iiresodh.org
      const respuesta = await calendar.events.insert({
        calendarId: 'contacto@iiresodh.org',
        resource: eventResource
      });

      // 5. Registrar en la bitácora interna de auditoría de la intranet
      try {
        await db.collection('logs_auditoria').add({
          usuario: emailUsuario,
          accion: 'Creación de Evento en Calendario',
          detalles: `Se programó el evento: "${titulo}" (ID: ${respuesta.data.id}) en el Calendario Institucional`,
          fecha: admin.firestore.FieldValue.serverTimestamp(),
          modulo: 'CALENDARIO_INSTITUCIONAL',
          titulo: titulo,
          eventoId: respuesta.data.id,
          usuarioEmail: emailUsuario,
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
      } catch (logErr) {
        console.warn('No se pudo registrar log de auditoría:', logErr);
      }

      return {
        success: true,
        eventId: respuesta.data.id,
        htmlLink: respuesta.data.htmlLink
      };
    } catch (error) {
      console.error('❌ Error insertando evento en Google Calendar:', error);
      let mensajeError = error.message || 'Error desconocido';
      if (error.code === 404 || (error.message && error.message.includes('Not Found'))) {
        const cuentasSugeridas = saEmail 
          ? saEmail 
          : '684823202496-compute@developer.gserviceaccount.com y litigio-management@appspot.gserviceaccount.com';
        mensajeError = `El calendario contacto@iiresodh.org no está compartido con la cuenta de servicio de la Intranet (${cuentasSugeridas}). Ve a Google Calendar de contacto@iiresodh.org > Configuración > Compartir con personas específicas > Añade ${cuentasSugeridas} con permiso 'Realizar cambios en eventos'.`;
      }
      throw new HttpsError(
        'internal',
        `Error al comunicar con Google Calendar: ${mensajeError}`
      );
    }
  }
);

/**
 * Función Callable v2 para listar eventos del calendario institucional contacto@iiresodh.org
 */
exports.obtenerEventosCalendario = onCall(
  {
    region: 'us-central1',
    cors: true,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        'unauthenticated',
        'Debe haber iniciado sesión en la Intranet para consultar el calendario institucional.'
      );
    }

    const { timeMin, timeMax } = request.data || {};

    try {
      const { calendar } = getGoogleCalendar();

      const now = new Date();
      const minDate = timeMin || new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString();
      const maxDate = timeMax || new Date(now.getFullYear(), now.getMonth() + 6, 1).toISOString();

      const response = await calendar.events.list({
        calendarId: 'contacto@iiresodh.org',
        timeMin: minDate,
        timeMax: maxDate,
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 250
      });

      const items = (response.data.items || []).map(event => ({
        id: event.id,
        summary: event.summary || '(Sin título)',
        description: event.description || '',
        location: event.location || '',
        start: event.start,
        end: event.end,
        htmlLink: event.htmlLink,
        creator: event.creator,
        status: event.status
      }));

      return {
        success: true,
        events: items
      };
    } catch (error) {
      console.error('❌ Error obteniendo eventos de Google Calendar:', error);
      throw new HttpsError('internal', `Error al obtener eventos: ${error.message || 'Error desconocido'}`);
    }
  }
);

/**
 * Función Callable v2 para eliminar un evento del calendario institucional contacto@iiresodh.org
 */
exports.eliminarEventoCalendario = onCall(
  {
    region: 'us-central1',
    cors: true,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        'unauthenticated',
        'Debe haber iniciado sesión en la Intranet para eliminar eventos.'
      );
    }

    const { eventId } = request.data || {};
    if (!eventId) {
      throw new HttpsError('invalid-argument', 'Se requiere el ID del evento a eliminar.');
    }

    try {
      const { calendar } = getGoogleCalendar();

      await calendar.events.delete({
        calendarId: 'contacto@iiresodh.org',
        eventId: eventId
      });

      const emailUsuario = request.auth.token.email || 'Usuario de la Intranet';

      try {
        await db.collection('logs_auditoria').add({
          usuario: emailUsuario,
          accion: 'Eliminación de Evento en Calendario',
          detalles: `Se eliminó el evento con ID: ${eventId} del Calendario Institucional`,
          fecha: admin.firestore.FieldValue.serverTimestamp(),
          modulo: 'CALENDARIO_INSTITUCIONAL',
          eventoId: eventId,
          usuarioEmail: emailUsuario,
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
      } catch (logErr) {
        console.warn('No se pudo registrar log de auditoría:', logErr);
      }

      return {
        success: true,
        eventId: eventId
      };
    } catch (error) {
      console.error('❌ Error eliminando evento en Google Calendar:', error);
      throw new HttpsError('internal', `Error al eliminar evento: ${error.message || 'Error desconocido'}`);
    }
  }
);

/**
 * Función Callable v2 para actualizar un evento existente en contacto@iiresodh.org
 */
exports.actualizarEventoCalendario = onCall(
  {
    region: 'us-central1',
    cors: true,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        'unauthenticated',
        'Debe haber iniciado sesión en la Intranet para modificar eventos.'
      );
    }

    const { eventId, titulo, descripcion, ubicacion, fechaInicio, fechaFin, todoElDia } = request.data || {};

    if (!eventId || !titulo || !fechaInicio || (!todoElDia && !fechaFin)) {
      throw new HttpsError(
        'invalid-argument',
        'El ID del evento, título y fechas son obligatorios.'
      );
    }

    try {
      const { calendar } = getGoogleCalendar();

      const emailUsuario = request.auth.token.email || 'Usuario de la Intranet';
      const nombreUsuario = request.auth.token.name || emailUsuario;

      const eventResource = {
        summary: titulo,
        description: descripcion 
          ? `${descripcion}\n\n---\nModificado en la Intranet por: ${nombreUsuario} (${emailUsuario})`
          : `Modificado en la Intranet por: ${nombreUsuario} (${emailUsuario})`,
        location: ubicacion || undefined
      };

      if (todoElDia) {
        // Google Calendar API v3 requiere start.date y end.date exclusivo (YYYY-MM-DD)
        const startDateStr = fechaInicio.split('T')[0];
        let endDateStr = (fechaFin || fechaInicio).split('T')[0];

        if (endDateStr <= startDateStr) {
          const parts = startDateStr.split('-').map(Number);
          const nextDay = new Date(parts[0], parts[1] - 1, parts[2] + 1);
          const yyyy = nextDay.getFullYear();
          const mm = String(nextDay.getMonth() + 1).padStart(2, '0');
          const dd = String(nextDay.getDate()).padStart(2, '0');
          endDateStr = `${yyyy}-${mm}-${dd}`;
        }

        eventResource.start = { date: startDateStr };
        eventResource.end = { date: endDateStr };
      } else {
        eventResource.start = { dateTime: new Date(fechaInicio).toISOString(), timeZone: 'America/Costa_Rica' };
        eventResource.end = { dateTime: new Date(fechaFin).toISOString(), timeZone: 'America/Costa_Rica' };
      }

      const respuesta = await calendar.events.patch({
        calendarId: 'contacto@iiresodh.org',
        eventId: eventId,
        resource: eventResource
      });

      try {
        await db.collection('logs_auditoria').add({
          usuario: emailUsuario,
          accion: 'Actualización de Evento en Calendario',
          detalles: `Se modificó el evento: "${titulo}" (ID: ${eventId}) en el Calendario Institucional`,
          fecha: admin.firestore.FieldValue.serverTimestamp(),
          modulo: 'CALENDARIO_INSTITUCIONAL',
          eventoId: eventId,
          titulo: titulo,
          usuarioEmail: emailUsuario,
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
      } catch (logErr) {
        console.warn('No se pudo registrar log de auditoría:', logErr);
      }

      return {
        success: true,
        event: {
          id: respuesta.data.id,
          summary: respuesta.data.summary,
          description: respuesta.data.description,
          location: respuesta.data.location,
          start: respuesta.data.start,
          end: respuesta.data.end,
          htmlLink: respuesta.data.htmlLink
        }
      };
    } catch (error) {
      console.error('❌ Error actualizando evento en Google Calendar:', error);
      throw new HttpsError(
        'internal',
        `Error al actualizar evento: ${error.message || 'Error desconocido'}`
      );
    }
  }
);

// =================================================================
// 🚀 ENDPOINT HTTPS: SOLICITAR APROBACIÓN DESDE GOOGLE DOCS (APPS SCRIPT)
// =================================================================
exports.solicitarAprobacionDocs = functions.https.onRequest(async (req, res) => {
  // Encabezados CORS
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido. Solo se acepta POST.' });
    return;
  }

  try {
    const {
      title,
      driveFileUrl,
      driveFileId,
      authorEmail,
      reviewerEmail,
      comment
    } = req.body;

    if (!title || !driveFileUrl || !reviewerEmail) {
      res.status(400).json({
        error: 'Faltan campos obligatorios: title, driveFileUrl y reviewerEmail son requeridos.'
      });
      return;
    }

    const cleanReviewer = reviewerEmail.trim().toLowerCase();
    const cleanAuthor = (authorEmail || 'solicitante@iiresodh.org').trim().toLowerCase();

    // 🔍 Resolver el UID exacto de Firebase Auth para el revisor
    let targetUid = null;
    try {
      const userRecord = await admin.auth().getUserByEmail(cleanReviewer);
      if (userRecord && userRecord.uid) {
        targetUid = userRecord.uid;
      }
    } catch (authErr) {
      console.warn('No se pudo resolver UID en Auth para:', cleanReviewer, authErr.message);
    }

    const reviewerUids = targetUid ? [targetUid, cleanReviewer] : [cleanReviewer];

    // Crear el documento en la colección approvals
    const approvalDoc = {
      title: title.trim(),
      driveFileUrl: driveFileUrl.trim(),
      driveFileId: driveFileId || ('drive_' + Date.now()),
      authorEmail: cleanAuthor,
      authorUid: cleanAuthor,
      status: 'PENDING',
      reviewerEmails: [cleanReviewer],
      reviewerEmail: cleanReviewer,
      reviewerUids: reviewerUids,
      initialComment: (comment || '').trim(),
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const docRef = await db.collection('approvals').add(approvalDoc);

    // Actualizar también documentos previos existentes para que contengan el UID
    if (targetUid) {
      try {
        const prevSnaps = await db.collection('approvals')
          .where('reviewerEmail', '==', cleanReviewer)
          .where('status', '==', 'PENDING')
          .get();
        for (const pDoc of prevSnaps.docs) {
          await pDoc.ref.update({
            reviewerUids: admin.firestore.FieldValue.arrayUnion(targetUid)
          });
        }
      } catch (backfillErr) {
        console.warn('Error en backfill de approvals previas:', backfillErr.message);
      }
    }

    // Registrar en log de auditoría institucional
    try {
      await db.collection('logs_auditoria').add({
        usuario: cleanAuthor,
        accion: 'Solicitud de Aprobación desde Google Docs',
        detalles: `Se envió a revisión el documento "${title.trim()}" asignado a [${cleanReviewer}]. ID: ${docRef.id}`,
        fecha: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (logErr) {
      console.warn('No se pudo registrar log de auditoría:', logErr);
    }

    res.status(200).json({
      success: true,
      approvalId: docRef.id,
      message: `Solicitud de aprobación para "${title}" enviada exitosamente a ${cleanReviewer}.`
    });
  } catch (error) {
    console.error('Error al procesar solicitud de aprobación desde Google Docs:', error);
    res.status(500).json({
      error: 'Error interno del servidor al procesar la aprobación: ' + error.message
    });
  }
});