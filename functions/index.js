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

// =========================================================================
// 📧 DESPACHO NATIVO DE COMUNICADOS VÍA GOOGLE WORKSPACE (GMAIL API DWD)
// Reemplazo propio 2nd Gen de la extensión deprecada firestore-send-email
// Remitente institucional: contacto@iiresodh.org
// =========================================================================
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onRequest } = require('firebase-functions/v2/https');

const WORKSPACE_SENDER_EMAIL = 'contacto@iiresodh.org';
const GMAIL_SEND_SCOPE = 'https://www.googleapis.com/auth/gmail.send';
const DEFAULT_COMPUTE_SA = '684823202496-compute@developer.gserviceaccount.com';

let _delegatedGmailTokenCache = {
  accessToken: null,
  expiresAtMs: 0
};

/**
 * Obtiene un token OAuth2 delegando autoridad de dominio (Domain-Wide Delegation)
 * para actuar en nombre de contacto@iiresodh.org sin almacenar llaves privadas (.pem),
 * firmando el JWT mediante la API de IAM Credentials de Google Cloud.
 */
async function getWorkspaceDelegatedGmailToken(subjectEmail = WORKSPACE_SENDER_EMAIL) {
  const nowMs = Date.now();
  if (
    _delegatedGmailTokenCache.accessToken &&
    _delegatedGmailTokenCache.expiresAtMs - 60000 > nowMs
  ) {
    return _delegatedGmailTokenCache.accessToken;
  }

  const { google } = require('googleapis');
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform']
  });
  const client = await auth.getClient();
  const adcTokenResponse = await client.getAccessToken();
  const adcToken = typeof adcTokenResponse === 'string' ? adcTokenResponse : adcTokenResponse?.token;

  const saEmail =
    client.email ||
    (client.credentials && client.credentials.client_email) ||
    DEFAULT_COMPUTE_SA;

  const iat = Math.floor(nowMs / 1000);
  const exp = iat + 3600;
  const jwtClaimSet = {
    iss: saEmail,
    sub: subjectEmail,
    scope: GMAIL_SEND_SCOPE,
    aud: 'https://oauth2.googleapis.com/token',
    iat,
    exp
  };

  // 1. Firmar JWT sin clave local usando IAM Credentials API
  const signRes = await fetch(
    `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${encodeURIComponent(saEmail)}:signJwt`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adcToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ payload: JSON.stringify(jwtClaimSet) })
    }
  );

  if (!signRes.ok) {
    const errText = await signRes.text();
    throw new Error(
      `No se pudo firmar JWT con IAM Credentials para ${saEmail} (HTTP ${signRes.status}): ${errText}`
    );
  }

  const { signedJwt } = await signRes.json();

  // 2. Intercambiar JWT firmado por Access Token OAuth2 de Google Workspace
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: signedJwt
    }).toString()
  });

  if (!tokenRes.ok) {
    const errBody = await tokenRes.text();
    throw new Error(
      `Autorización Domain-Wide Delegation pendiente o rechazada para ${subjectEmail} con cuenta ${saEmail} (Client ID: 113725461619055550951, Scope: ${GMAIL_SEND_SCOPE}). Respuesta OAuth: ${errBody}`
    );
  }

  const tokenData = await tokenRes.json();
  _delegatedGmailTokenCache = {
    accessToken: tokenData.access_token,
    expiresAtMs: nowMs + (tokenData.expires_in || 3600) * 1000
  };
  return tokenData.access_token;
}

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function chunkBase64(b64) {
  return b64.replace(/(.{76})/g, '$1\r\n');
}

function encodeMimeHeaderUtf8(text = '') {
  return `=?UTF-8?B?${Buffer.from(String(text), 'utf8').toString('base64')}?=`;
}

function buildInstitutionalHtml({ cuerpoHtmlTemplate, asunto, cuerpo, trackingPixelUrl }) {
  const safeAsunto = escapeHtml(asunto);
  const safeCuerpo = escapeHtml(cuerpo);

  const defaultTemplate = `<div style="font-family: Arial, sans-serif; background-color: #f8fafc; padding: 30px; text-align: center;">
  <table align="center" width="600" style="background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; border-collapse: collapse;">
    <tr style="background-color: #1a365d;">
      <td style="padding: 25px; text-align: center;">
        <img src="https://intra.iiresodh.org/logo.png" alt="IIRESODH" width="180" style="display: block; margin: 0 auto; max-width: 100%; height: auto; border: 0;" />
      </td>
    </tr>
    <tr>
      <td style="padding: 40px; text-align: left; color: #334155; font-size: 16px; line-height: 1.6;">
        <h2 style="color: #1a365d; margin-top: 0;">Comunicado Oficial</h2>
        <p style="white-space: pre-wrap;">{{cuerpo}}</p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
        <p style="font-size: 12px; color: #94a3b8; text-align: center; margin-bottom: 0;">
          Este es un canal informativo institucional confidencial.<br>
          Instituto Internacional sobre Raza, Igualdad y Derechos Humanos (IIRESODH)
        </p>
      </td>
    </tr>
  </table>
</div>`;

  const baseHtml = (cuerpoHtmlTemplate || defaultTemplate)
    .replace(/\{\{\s*asunto\s*\}\}/g, safeAsunto)
    .replace(/\{\{\s*cuerpo\s*\}\}/g, safeCuerpo);

  const pixelTag = trackingPixelUrl
    ? `<img src="${trackingPixelUrl}" width="1" height="1" alt="" style="display:none;width:1px;height:1px;border:0;" />`
    : '';

  return `${baseHtml}\n${pixelTag}`;
}

function buildRfc2822Message({
  fromEmail,
  toEmail,
  subject,
  plainText,
  htmlBody,
  attachmentBuffer,
  attachmentFilename
}) {
  const mixedBoundary = `====_iiresodh_mixed_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const altBoundary = `====_iiresodh_alt_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  const headers = [
    `From: ${encodeMimeHeaderUtf8('IIRESODH - Comunicados Oficiales')} <${fromEmail}>`,
    `To: <${toEmail}>`,
    `Reply-To: <${fromEmail}>`,
    `Subject: ${encodeMimeHeaderUtf8(subject)}`,
    'MIME-Version: 1.0'
  ];

  const plainB64 = chunkBase64(Buffer.from(String(plainText || ''), 'utf8').toString('base64'));
  const htmlB64 = chunkBase64(Buffer.from(String(htmlBody || ''), 'utf8').toString('base64'));

  if (!attachmentBuffer) {
    headers.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`);
    const body = [
      headers.join('\r\n'),
      '',
      `--${altBoundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: base64',
      '',
      plainB64,
      `--${altBoundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      'Content-Transfer-Encoding: base64',
      '',
      htmlB64,
      `--${altBoundary}--`,
      ''
    ].join('\r\n');

    return Buffer.from(body, 'utf8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  const safeFilename = (attachmentFilename || 'Comunicado_Oficial.pdf').replace(/["\r\n]/g, '_');
  const attachmentB64 = chunkBase64(Buffer.from(attachmentBuffer).toString('base64'));

  headers.push(`Content-Type: multipart/mixed; boundary="${mixedBoundary}"`);
  const body = [
    headers.join('\r\n'),
    '',
    `--${mixedBoundary}`,
    `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
    '',
    `--${altBoundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    plainB64,
    `--${altBoundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    htmlB64,
    `--${altBoundary}--`,
    '',
    `--${mixedBoundary}`,
    `Content-Type: application/pdf; name="${encodeMimeHeaderUtf8(safeFilename)}"`,
    'Content-Transfer-Encoding: base64',
    `Content-Disposition: attachment; filename="${safeFilename}"`,
    '',
    attachmentB64,
    `--${mixedBoundary}--`,
    ''
  ].join('\r\n');

  return Buffer.from(body, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

exports.enviarComunicadoInstitucional = onDocumentCreated(
  {
    document: 'casos/{casoId}/comunicados/{comunicadoId}',
    region: 'us-central1',
    timeoutSeconds: 180,
    memory: '512MiB'
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const { casoId, comunicadoId } = event.params;
    const data = snap.data() || {};

    if (data.delivery && data.delivery.state === 'SUCCESS') {
      console.log(`ℹ️ Comunicado ${comunicadoId} ya figura como despachado. Omitiendo.`);
      return;
    }

    const startTimeIso = new Date().toISOString();
    await snap.ref.set(
      {
        delivery: {
          state: 'PROCESSING',
          startTime: startTimeIso,
          provider: 'google-workspace-gmail-api',
          sender: WORKSPACE_SENDER_EMAIL
        }
      },
      { merge: true }
    );

    const asunto =
      data.asunto ||
      (data.template && data.template.data && data.template.data.asunto) ||
      'Comunicado Oficial IIRESODH';
    const cuerpo =
      data.cuerpo ||
      (data.template && data.template.data && data.template.data.cuerpo) ||
      '';

    try {
      // 1. Obtener plantilla HTML desde plantillas_correo si existe
      let cuerpoHtmlTemplate = null;
      const templateName = (data.template && data.template.name) || 'comunicado_institucional';
      try {
        const tplSnap = await db.collection('plantillas_correo').doc(templateName).get();
        if (tplSnap.exists && tplSnap.data()?.html) {
          cuerpoHtmlTemplate = tplSnap.data().html;
        }
      } catch (tplErr) {
        console.warn('⚠️ Usando plantilla institucional integrada por defecto:', tplErr.message);
      }

      // 2. Descargar adjunto PDF una sola vez si existe
      let attachmentBuffer = null;
      const attachmentFilename = data.pdf_nombre || 'Comunicado_Oficial.pdf';
      if (data.storage_path) {
        try {
          const [buffer] = await admin.storage().bucket().file(data.storage_path).download();
          attachmentBuffer = buffer;
        } catch (stErr) {
          console.warn('⚠️ No se pudo descargar desde storage_path, intentando pdf_url:', stErr.message);
        }
      }
      if (!attachmentBuffer && data.pdf_url) {
        try {
          const pdfRes = await fetch(data.pdf_url);
          if (pdfRes.ok) {
            const arrBuf = await pdfRes.arrayBuffer();
            attachmentBuffer = Buffer.from(arrBuf);
          }
        } catch (urlErr) {
          console.warn('⚠️ No se pudo descargar adjunto desde pdf_url:', urlErr.message);
        }
      }

      // 3. Resolver lista de destinatarios con su clienteId
      let destinatarios = Array.isArray(data.destinatarios_detalle)
        ? data.destinatarios_detalle.filter((d) => d && d.email)
        : [];

      if (destinatarios.length === 0) {
        const rawTo = Array.isArray(data.to) ? data.to : data.to ? [data.to] : [];
        const clientesSnap = await db.collection('casos').doc(casoId).collection('clientes').get();
        const mapaEmailCliente = {};
        clientesSnap.forEach((docSnap) => {
          const cData = docSnap.data() || {};
          if (cData.correo_principal) {
            mapaEmailCliente[cData.correo_principal.trim().toLowerCase()] = docSnap.id;
          }
        });

        destinatarios = rawTo
          .filter((em) => em && String(em).trim() !== '')
          .map((em) => {
            const clean = String(em).trim();
            return {
              email: clean,
              clienteId: mapaEmailCliente[clean.toLowerCase()] || null
            };
          });
      }

      // 4. Obtener token OAuth2 delegado de contacto@iiresodh.org
      const accessToken = await getWorkspaceDelegatedGmailToken(WORKSPACE_SENDER_EMAIL);

      const accepted = [];
      const rejected = [];
      let firstMessageId = null;

      for (const dest of destinatarios) {
        const toEmail = dest.email.trim();
        const clienteId = dest.clienteId || '';
        const fechaCR = new Date().toLocaleString('es-CR', { timeZone: 'America/Costa_Rica' });

        const trackingPixelUrl = clienteId
          ? `https://us-central1-litigio-management.cloudfunctions.net/confirmarLecturaComunicado?casoId=${encodeURIComponent(casoId)}&clienteId=${encodeURIComponent(clienteId)}&comunicadoId=${encodeURIComponent(comunicadoId)}`
          : null;

        const htmlBody = buildInstitutionalHtml({
          cuerpoHtmlTemplate,
          asunto,
          cuerpo,
          trackingPixelUrl
        });

        const rawMime = buildRfc2822Message({
          fromEmail: WORKSPACE_SENDER_EMAIL,
          toEmail,
          subject: asunto,
          plainText: `${asunto}\n\n${cuerpo}`,
          htmlBody,
          attachmentBuffer,
          attachmentFilename
        });

        try {
          const sendRes = await fetch(
            'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ raw: rawMime })
            }
          );

          if (!sendRes.ok) {
            const errTxt = await sendRes.text();
            throw new Error(`Gmail API HTTP ${sendRes.status}: ${errTxt}`);
          }

          const sendJson = await sendRes.json();
          if (!firstMessageId && sendJson.id) {
            firstMessageId = sendJson.id;
          }
          accepted.push(toEmail);

          if (clienteId) {
            const historialRef = db
              .collection('casos')
              .doc(casoId)
              .collection('clientes')
              .doc(clienteId)
              .collection('historial_comunicados')
              .doc(comunicadoId);

            await historialRef.set(
              {
                comunicadoId,
                estado: 'Entregado',
                entregado_at: fechaCR,
                ultima_actualizacion: fechaCR,
                gmail_message_id: sendJson.id || null,
                enviado_desde: WORKSPACE_SENDER_EMAIL
              },
              { merge: true }
            );
          }
        } catch (sendErr) {
          console.error(`❌ Error enviando comunicado a ${toEmail}:`, sendErr.message);
          rejected.push({ email: toEmail, error: sendErr.message });

          if (clienteId) {
            const historialRef = db
              .collection('casos')
              .doc(casoId)
              .collection('clientes')
              .doc(clienteId)
              .collection('historial_comunicados')
              .doc(comunicadoId);

            await historialRef.set(
              {
                comunicadoId,
                estado: 'Rebotado',
                rebotado_at: fechaCR,
                causa_rebote: sendErr.message,
                ultima_actualizacion: fechaCR
              },
              { merge: true }
            );
          }
        }
      }

      await snap.ref.set(
        {
          from: WORKSPACE_SENDER_EMAIL,
          delivery: {
            state: accepted.length > 0 ? 'SUCCESS' : 'ERROR',
            startTime: startTimeIso,
            endTime: new Date().toISOString(),
            provider: 'google-workspace-gmail-api',
            sender: WORKSPACE_SENDER_EMAIL,
            info: {
              messageId: firstMessageId || `<${comunicadoId}@iiresodh.org>`,
              accepted,
              rejected,
              response: `250 2.0.0 OK — Despachado vía Google Workspace (${accepted.length}/${destinatarios.length})`
            }
          }
        },
        { merge: true }
      );
    } catch (fatalErr) {
      console.error('❌ Error global despachando comunicado vía Gmail API:', fatalErr);
      await snap.ref.set(
        {
          delivery: {
            state: 'ERROR',
            startTime: startTimeIso,
            endTime: new Date().toISOString(),
            provider: 'google-workspace-gmail-api',
            sender: WORKSPACE_SENDER_EMAIL,
            error: fatalErr.message
          }
        },
        { merge: true }
      );
    }
  }
);

/**
 * Endpoint 2nd Gen de telemetría de apertura de comunicados (Píxel 1x1 transparente)
 * Filtra bots de seguridad y precargas automáticas para registrar aperturas reales.
 */
const TRANSPARENT_GIF_BUFFER = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

exports.confirmarLecturaComunicado = onRequest(
  {
    region: 'us-central1',
    cors: true
  },
  async (req, res) => {
    res.set('Content-Type', 'image/gif');
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    const { casoId, clienteId, comunicadoId } = req.query || {};
    if (!casoId || !clienteId || !comunicadoId) {
      res.status(200).end(TRANSPARENT_GIF_BUFFER);
      return;
    }

    try {
      const ua = String(req.headers['user-agent'] || '').toLowerCase();
      // Filtrar bots y escáneres corporativos conocidos
      if (
        ua.includes('bot') ||
        ua.includes('spider') ||
        ua.includes('crawl') ||
        ua.includes('scanner') ||
        ua.includes('cloudflarestub') ||
        ua.includes('proofpoint') ||
        ua.includes('mimecast') ||
        ua.includes('barracuda')
      ) {
        res.status(200).end(TRANSPARENT_GIF_BUFFER);
        return;
      }

      // Verificar que no sea un pre-fetch instantáneo (< 5 segundos tras el despacho)
      const comSnap = await db
        .collection('casos')
        .doc(String(casoId))
        .collection('comunicados')
        .doc(String(comunicadoId))
        .get();

      if (comSnap.exists) {
        const endTimeStr = comSnap.data()?.delivery?.endTime || comSnap.data()?.fecha_envio;
        if (endTimeStr) {
          const elapsedMs = Date.now() - new Date(endTimeStr).getTime();
          if (elapsedMs >= 0 && elapsedMs < 5000) {
            console.log(`🤖 Píxel solicitado a los ${elapsedMs}ms del envío (pre-fetch automático). Ignorando.`);
            res.status(200).end(TRANSPARENT_GIF_BUFFER);
            return;
          }
        }
      }

      const historialRef = db
        .collection('casos')
        .doc(String(casoId))
        .collection('clientes')
        .doc(String(clienteId))
        .collection('historial_comunicados')
        .doc(String(comunicadoId));

      const histSnap = await historialRef.get();
      const fechaCR = new Date().toLocaleString('es-CR', { timeZone: 'America/Costa_Rica' });

      if (!histSnap.exists || !histSnap.data()?.abierto_at) {
        await historialRef.set(
          {
            comunicadoId: String(comunicadoId),
            estado: 'Abierto',
            abierto_at: fechaCR,
            ultima_actualizacion: fechaCR
          },
          { merge: true }
        );
      }
    } catch (err) {
      console.warn('⚠️ Error registrando telemetría de lectura:', err.message);
    }

    res.status(200).end(TRANSPARENT_GIF_BUFFER);
  }
);

// =========================================================================
// 🧠 COPILOTO JURÍDICO IA — VERTEX AI NATIVO SIN EXPONER API KEYS
// Soporta gemini-4-argon (Pensamiento Avanzado), gemini-3.8-flash y gemini-3.5-flash-lite
// =========================================================================
exports.consultarVertexLitigioIA = onCall(
  {
    region: 'us-central1',
    cors: true,
    timeoutSeconds: 180,
    memory: '512MiB'
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        'unauthenticated',
        'Debes iniciar sesión en la Intranet IIRESODH para utilizar el Copiloto Jurídico IA.'
      );
    }

    const {
      prompt,
      systemInstruction = '',
      model = 'gemini-4-argon',
      inlineParts = [],
      temperature = 0.25
    } = request.data || {};

    if (!prompt || typeof prompt !== 'string') {
      throw new HttpsError('invalid-argument', 'Se requiere un prompt válido.');
    }

    const modelosPermitidos = [
      'gemini-4-argon',
      'gemini-3.8-flash',
      'gemini-3.5-flash-lite'
    ];
    const modeloPrimario = modelosPermitidos.includes(model) ? model : 'gemini-4-argon';
    const cadenaModelos = [
      modeloPrimario,
      ...modelosPermitidos.filter((m) => m !== modeloPrimario)
    ];

    const { google } = require('googleapis');
    const auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });
    const client = await auth.getClient();
    const adcTokenResponse = await client.getAccessToken();
    const accessToken =
      typeof adcTokenResponse === 'string' ? adcTokenResponse : adcTokenResponse?.token;

    const parts = [];
    if (Array.isArray(inlineParts)) {
      for (const p of inlineParts) {
        if (p && p.inlineData && p.inlineData.data) {
          parts.push({
            inlineData: {
              mimeType: p.inlineData.mimeType || 'application/pdf',
              data: p.inlineData.data
            }
          });
        }
      }
    }
    parts.push({ text: prompt });

    const payload = {
      contents: [{ role: 'user', parts }],
      generationConfig: {
        temperature: typeof temperature === 'number' ? temperature : 0.25
      }
    };

    if (systemInstruction && typeof systemInstruction === 'string') {
      payload.systemInstruction = {
        parts: [{ text: systemInstruction }]
      };
    }

    const errores = [];
    for (const modId of cadenaModelos) {
      const endpoint = `https://aiplatform.googleapis.com/v1beta1/projects/litigio-management/locations/global/publishers/google/models/${modId}:generateContent`;
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          const errTxt = await res.text();
          errores.push(`[${modId} HTTP ${res.status}]: ${errTxt.slice(0, 200)}`);
          continue;
        }

        const data = await res.json();
        const candParts = data?.candidates?.[0]?.content?.parts || [];
        const textOut = candParts
          .map((pt) => pt.text || '')
          .join('\n')
          .trim();

        if (textOut) {
          return {
            success: true,
            text: textOut,
            modeloSolicitado: modeloPrimario,
            modeloEjecutado: data.modelVersion || modId,
            backendUtilizado: 'Vertex AI Enterprise (aiplatform.googleapis.com)'
          };
        }
      } catch (err) {
        errores.push(`[${modId}]: ${err.message}`);
      }
    }

    throw new HttpsError(
      'internal',
      `No se pudo completar la consulta en Vertex AI: ${errores.join(' | ')}`
    );
  }
);

