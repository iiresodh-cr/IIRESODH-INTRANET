import os
import json
import time
import base64
import requests
from firebase_admin import initialize_app, firestore, messaging
from firebase_functions import https_fn, options

# 🚀 1. Inicialización diferida (Lazy) de Firebase Admin SDK para evitar timeouts de carga
_db_instance = None

def get_db():
    global _db_instance
    if _db_instance is None:
        try:
            initialize_app()
        except Exception:
            pass
        _db_instance = firestore.client()
    return _db_instance

DEFAULT_VERIFY_TOKEN = "mi_codigo_secreto_123"
DEFAULT_TOKEN = "EAANXNDTIJbEBS28Th8KMTlVvF1rUVKVPKoCsrMaCaZAUFBRDq8DLuV4ZALBEut3wzxlc29pXqOHF0Uzem8SCJMIo9ZCV1tvPcL8XZCgKoFGrdn6bh19hqw2fCHbjK4SPPp1rQRGz2VZAoHII5V9oTQ8uA6ZBTy8KGbDCS6Fvs810D4xG3weVxh8ZAlkEsO9bwZDZD"

def obtener_credenciales_meta():
    """
    Obtiene las credenciales de la API de Meta.
    Busca primero en variables de entorno y como fallback en Firestore (whatsapp_config/credenciales).
    Esto permite configurar las llaves desde la Intranet o por variables de entorno.
    """
    db = get_db()
    token = os.environ.get("WHATSAPP_TOKEN")
    phone_id = os.environ.get("PHONE_NUMBER_ID")
    verify_token = os.environ.get("VERIFY_TOKEN", DEFAULT_VERIFY_TOKEN)
    waba_id = os.environ.get("WABA_ID")

    # Si falta alguna credencial principal, consultar en Firestore
    try:
        cfg_doc = db.collection("whatsapp_config").document("credenciales").get()
        if cfg_doc.exists:
            datos = cfg_doc.to_dict() or {}
            tok_fs = datos.get("whatsapp_token")
            # Descartar token de prueba anterior que expiró el 23 de octubre
            if tok_fs and "BSZBSCJYkmRpp" not in tok_fs:
                token = token or tok_fs
            phone_id = datos.get("phone_number_id") or phone_id
            verify_token = datos.get("verify_token") or verify_token
            waba_id = datos.get("waba_id") or waba_id
    except Exception as e:
        print("⚠️ Error leyendo credenciales de Firestore:", str(e))

    # Fallbacks predeterminados (número oficial permanente: +506 4081 6188)
    token = token or DEFAULT_TOKEN
    phone_id = phone_id or "1429140810275241"
    waba_id = waba_id or "1431176165105564"

    return {
        "whatsapp_token": token,
        "phone_number_id": phone_id,
        "verify_token": verify_token or DEFAULT_VERIFY_TOKEN,
        "waba_id": waba_id
    }


def descargar_media_meta(media_id: str, token: str, max_bytes: int = 400000):
    """
    Descarga un archivo multimedia (sticker, imagen, audio, documento) desde Meta Graph API.
    Devuelve (bytes_binarios, mime_type, data_uri_opcional).
    """
    if not media_id or not token:
        return None, None, None
    try:
        info_res = requests.get(
            f"https://graph.facebook.com/v21.0/{media_id}",
            headers={"Authorization": f"Bearer {token}"},
            timeout=8
        )
        if info_res.status_code != 200:
            return None, None, None
        info_json = info_res.json() or {}
        download_url = info_json.get("url")
        mime_type = info_json.get("mime_type") or "application/octet-stream"
        if not download_url:
            return None, None, None

        bin_res = requests.get(
            download_url,
            headers={"Authorization": f"Bearer {token}"},
            timeout=12
        )
        if bin_res.status_code != 200 or not bin_res.content:
            return None, None, None

        raw_bytes = bin_res.content
        data_uri = None
        if len(raw_bytes) <= max_bytes:
            b64_str = base64.b64encode(raw_bytes).decode("ascii")
            data_uri = f"data:{mime_type};base64,{b64_str}"
        return raw_bytes, mime_type, data_uri
    except Exception as e_med:
        print("⚠️ Error descargando media de Meta:", str(e_med))
        return None, None, None


def enviar_push_fcm_dispositivos(
    titulo: str,
    cuerpo: str,
    data_payload: dict,
    excluir_email: str = None,
    solo_emails: list = None
):
    """
    Envía notificaciones Web Push / FCM de alta prioridad a todos los teléfonos
    (Android e iOS 16.4+ PWA) registrados en la colección `pwa_fcm_tokens`.
    """
    try:
        db = get_db()
        docs = list(db.collection("pwa_fcm_tokens").stream())
        if not docs:
            return 0

        excluir_norm = (excluir_email or "").strip().lower()
        solo_norm = (
            {str(e).strip().lower() for e in solo_emails if e}
            if solo_emails
            else None
        )

        tokens = []
        token_doc_map = {}

        for d in docs:
            info = d.to_dict() or {}
            if not info.get("activo", True):
                continue
            tok = info.get("token")
            email = (info.get("email") or "").strip().lower()
            if not tok:
                continue
            if excluir_norm and email == excluir_norm:
                continue
            if solo_norm and email not in solo_norm:
                continue
            if tok not in token_doc_map:
                tokens.append(tok)
                token_doc_map[tok] = d.reference

        if not tokens:
            return 0

        str_data = {str(k): str(v) for k, v in (data_payload or {}).items() if v is not None}
        target_url = str_data.get("url", "/?app=comms")
        tag = str_data.get("tag", f"iiresodh-{int(time.time())}")

        multicast = messaging.MulticastMessage(
            tokens=tokens,
            notification=messaging.Notification(
                title=titulo[:100],
                body=cuerpo[:240]
            ),
            data=str_data,
            webpush=messaging.WebpushConfig(
                headers={"Urgency": "high", "TTL": "86400"},
                notification=messaging.WebpushNotification(
                    title=titulo[:100],
                    body=cuerpo[:240],
                    icon="/pwa-icon-192.png",
                    badge="/pwa-icon-192.png",
                    tag=tag,
                    renotify=True
                ),
                fcm_options=messaging.WebpushFCMOptions(link=target_url)
            ),
            android=messaging.AndroidConfig(priority="high"),
            apns=messaging.APNSConfig(
                headers={"apns-priority": "10"},
                payload=messaging.APNSPayload(
                    aps=messaging.Aps(sound="default", badge=1)
                )
            )
        )

        response = messaging.send_each_for_multicast(multicast)

        # Limpiar tokens expirados o desinstalados automáticamente
        for idx, resp in enumerate(response.responses):
            if not resp.success and resp.exception:
                err_code = getattr(resp.exception, "code", "") or str(resp.exception)
                if "UNREGISTERED" in err_code or "NOT_FOUND" in err_code or "registration-token-not-registered" in err_code:
                    bad_tok = tokens[idx]
                    ref = token_doc_map.get(bad_tok)
                    if ref:
                        try:
                            ref.delete()
                        except Exception:
                            pass

        return response.success_count
    except Exception as e_push:
        print("⚠️ Error enviando notificación Push FCM:", str(e_push))
        return 0



@https_fn.on_request(cors=options.CorsOptions(cors_origins="*", cors_methods=["get", "post"]))
def whatsapp_webhook(req: https_fn.Request) -> https_fn.Response:
    """
    Ruta: /whatsapp_webhook
    - GET:  Verificación Handshake de Webhook de Meta o Proxy Multimedia (?media_id=...)
    - POST: Recepción de mensajes entrantes, stickers, reacciones y estados de entrega
    """
    creds = obtener_credenciales_meta()

    # ==============================================================
    # 1. VERIFICACIÓN DEL WEBHOOK O PROXY DE MEDIA (GET)
    # ==============================================================
    if req.method == 'GET':
        media_id_param = req.args.get("media_id")
        if media_id_param:
            raw_bytes, mime_type, _ = descargar_media_meta(
                media_id_param, creds["whatsapp_token"], max_bytes=0
            )
            if raw_bytes:
                return https_fn.Response(
                    raw_bytes,
                    status=200,
                    mimetype=mime_type or "application/octet-stream",
                    headers={"Cache-Control": "public, max-age=86400"}
                )
            return https_fn.Response("Media not found", status=404)

        mode = req.args.get("hub.mode")
        token = req.args.get("hub.verify_token")
        challenge = req.args.get("hub.challenge")

        tokens_validos = {creds["verify_token"], "iiresodh_webhook_secret_2026", "mi_codigo_secreto_123"}
        if mode == "subscribe" and token in tokens_validos:
            print("✅ Webhook de WhatsApp verificado exitosamente con Meta.")
            return https_fn.Response(challenge, status=200, mimetype="text/plain")

        print("⛔ Intento de verificación no autorizado:", token)
        return https_fn.Response("Forbidden", status=403)

    # ==============================================================
    # 2. PROCESAMIENTO DE MENSAJES ENTRANTES (POST)
    # ==============================================================
    elif req.method == 'POST':
        db = get_db()
        body = req.get_json(silent=True)
        if not body:
            return https_fn.Response("Payload vacío", status=400)

        # Meta requiere una respuesta rápida 200 OK
        # Procesamos los datos capturados
        try:
            entries = body.get("entry", [])
            for entry in entries:
                changes = entry.get("changes", [])
                for change in changes:
                    value = change.get("value", {})
                    
                    # A. Mapa de nombres de contactos del remitente
                    contacts = value.get("contacts", [])
                    contact_map = {}
                    for c in contacts:
                        wa_id = c.get("wa_id")
                        prof_name = c.get("profile", {}).get("name")
                        if wa_id and prof_name:
                            contact_map[wa_id] = prof_name

                    # B. Mensajes recibidos de clientes
                    messages = value.get("messages", [])
                    for msg in messages:
                        remitente = msg.get("from")
                        msg_id = msg.get("id") or f"msg_{int(time.time()*1000)}"
                        msg_type = msg.get("type", "text")
                        nombre_contacto = contact_map.get(remitente, "")
                        chat_ref = db.collection("whatsapp_chats").document(remitente)

                        # Si es una reacción con emoji a un mensaje existente, anexarla al mensaje original
                        if msg_type == "reaction":
                            reac_obj = msg.get("reaction", {}) or {}
                            emoji_reac = reac_obj.get("emoji", "")
                            target_wamid = reac_obj.get("message_id")
                            if target_wamid:
                                try:
                                    target_ref = chat_ref.collection("mensajes").document(target_wamid)
                                    t_snap = target_ref.get()
                                    if t_snap.exists:
                                        target_ref.update({"reaccion_cliente": emoji_reac})
                                except Exception as e_reac:
                                    print("Error guardando reacción en mensaje:", str(e_reac))
                            if emoji_reac:
                                chat_ref.set({
                                    "telefono": remitente,
                                    "ultimo_mensaje": f"Reaccionó con {emoji_reac}",
                                    "ultima_fecha": firestore.SERVER_TIMESTAMP,
                                    "actualizado_en": firestore.SERVER_TIMESTAMP
                                }, merge=True)
                            continue

                        # Extraer contenido según el tipo de mensaje
                        cuerpo_texto = ""
                        if msg_type == "text":
                            cuerpo_texto = msg.get("text", {}).get("body", "")
                        elif msg_type == "sticker":
                            cuerpo_texto = "🏷️ Sticker"
                        elif msg_type == "image":
                            caption = msg.get("image", {}).get("caption", "")
                            cuerpo_texto = f"📷 Foto: {caption}".strip() if caption else "📷 [Foto adjunta]"
                        elif msg_type == "document":
                            fname = msg.get("document", {}).get("filename", "Documento")
                            cuerpo_texto = f"📄 Archivo: {fname}"
                        elif msg_type == "audio":
                            cuerpo_texto = "🎙️ [Mensaje de voz / Audio]"
                        elif msg_type == "video":
                            cuerpo_texto = "🎥 [Video]"
                        elif msg_type == "location":
                            loc = msg.get("location", {})
                            cuerpo_texto = f"📍 [Ubicación compartida: {loc.get('name', 'Coordenadas')}]"
                        elif msg_type == "interactive":
                            interactive = msg.get("interactive", {})
                            btn = interactive.get("button_reply", {}).get("title") or interactive.get("list_reply", {}).get("title")
                            cuerpo_texto = f"🔘 {btn}" if btn else "🔘 [Respuesta interactiva]"
                        else:
                            cuerpo_texto = f"[{msg_type}]"

                        # Guardar/Actualizar chat en Firestore
                        chat_snap = chat_ref.get()

                        chat_data = {
                            "telefono": remitente,
                            "ultimo_mensaje": cuerpo_texto,
                            "ultima_fecha": firestore.SERVER_TIMESTAMP,
                            "actualizado_en": firestore.SERVER_TIMESTAMP,
                            "no_leidos": firestore.Increment(1)
                        }

                        # Si el nombre viene en el payload y el chat no tenía o está vacío, actualizarlo
                        if nombre_contacto:
                            chat_data["nombre"] = nombre_contacto
                        elif not chat_snap.exists:
                            chat_data["nombre"] = f"+{remitente}"

                        chat_ref.set(chat_data, merge=True)

                        # Guardar mensaje individual en la subcolección
                        media_obj = msg.get(msg_type, {}) if msg_type in ["sticker", "audio", "image", "document", "video"] else {}
                        msg_ref = chat_ref.collection("mensajes").document(msg_id)
                        msg_payload = {
                            "id_meta": msg_id,
                            "texto": cuerpo_texto,
                            "tipo": msg_type,
                            "es_mio": False,
                            "remitente_nombre": nombre_contacto or f"+{remitente}",
                            "remitente_telefono": remitente,
                            "fecha": firestore.SERVER_TIMESTAMP,
                            "estado": "recibido",
                            "raw_type": msg_type
                        }
                        if isinstance(media_obj, dict) and media_obj.get("id"):
                            m_id = media_obj.get("id")
                            msg_payload["media_id"] = m_id
                            msg_payload["mime_type"] = media_obj.get("mime_type", "")
                            msg_payload["media_url"] = f"https://us-central1-litigio-management.cloudfunctions.net/whatsapp_webhook?media_id={m_id}"
                            # Para stickers e imágenes compactas, guardar también data URI inline para visualización instantánea
                            if msg_type in ["sticker", "image"]:
                                _, _, inline_uri = descargar_media_meta(
                                    m_id, creds["whatsapp_token"], max_bytes=350000
                                )
                                if inline_uri:
                                    msg_payload["media_url"] = inline_uri
                        msg_ref.set(msg_payload)

                        # Disparar Notificación Push FCM a dispositivos móviles registrados (Android / iOS PWA)
                        nombre_push = (
                            nombre_contacto
                            or (chat_snap.to_dict() or {}).get("nombre")
                            or f"+{remitente}"
                        )
                        enviar_push_fcm_dispositivos(
                            titulo=f"🟢 WhatsApp · {nombre_push}",
                            cuerpo=cuerpo_texto or "Nuevo mensaje recibido",
                            data_payload={
                                "tab": "whatsapp",
                                "chatId": remitente,
                                "tipo": msg_type,
                                "tag": f"wa-chat-{remitente}",
                                "url": f"/?app=comms&tab=whatsapp&chatId={remitente}"
                            }
                        )

                    # B2. Eventos de Llamadas de Voz de WhatsApp (Calling API / WebRTC)
                    calls = value.get("calls", [])
                    if calls:
                        creds_call = obtener_credenciales_meta()
                        voz_web_activa = creds_call.get("recepcion_voz_web_activa", True)
                        token_call = creds_call.get("whatsapp_token")
                        phone_id_call = creds_call.get("phone_number_id")
                        for call_ev in calls:
                            call_id = call_ev.get("id")
                            call_from = call_ev.get("from")
                            call_event_type = call_ev.get("event") # connect, terminate, etc.
                            session_data = call_ev.get("session", {})
                            if not call_id:
                                continue
                            # Si la recepción web está EN PAUSA, rechazar en WebRTC para que usen la línea física +506 4081-6188
                            if not voz_web_activa and call_event_type == "connect" and token_call and phone_id_call:
                                try:
                                    requests.post(
                                        f"https://graph.facebook.com/v21.0/{phone_id_call}/calls",
                                        headers={"Authorization": f"Bearer {token_call}", "Content-Type": "application/json"},
                                        json={"messaging_product": "whatsapp", "call_id": call_id, "action": "reject"},
                                        timeout=6
                                    )
                                except Exception as e_rej:
                                    print("Error rechazando llamada en modo pausa:", str(e_rej))
                                continue

                            # Registrar llamada en Firestore para que timbre en tiempo real en la Intranet
                            from_name_call = contact_map.get(call_from, f"+{call_from}")
                            db.collection("whatsapp_calls").document(call_id).set({
                                "call_id": call_id,
                                "from": call_from,
                                "from_name": from_name_call,
                                "event": call_event_type,
                                "sdp_type": session_data.get("sdp_type", ""),
                                "sdp": session_data.get("sdp", ""),
                                "estado": "entrante" if call_event_type == "connect" else "finalizada",
                                "fecha": firestore.SERVER_TIMESTAMP
                            }, merge=True)

                            if call_event_type == "connect":
                                enviar_push_fcm_dispositivos(
                                    titulo=f"📞 Llamada WhatsApp · {from_name_call}",
                                    cuerpo="Llamada entrante en línea oficial IIRESODH. Toca para contestar.",
                                    data_payload={
                                        "tab": "whatsapp",
                                        "chatId": call_from or "",
                                        "callId": call_id,
                                        "tipo": "call",
                                        "tag": f"wa-call-{call_id}",
                                        "url": f"/?app=comms&tab=whatsapp&chatId={call_from or ''}&callId={call_id}"
                                    }
                                )

                    # C. Notificaciones de estado (enviado, entregado, leído, error)
                    statuses = value.get("statuses", [])
                    orden_estados = {"enviado": 1, "sent": 1, "delivered": 2, "entregado": 2, "read": 3, "leido": 3}
                    for st in statuses:
                        status_id = st.get("id")
                        status_val = st.get("status") # sent, delivered, read, failed
                        destinatario = st.get("recipient_id")

                        if destinatario and status_id and status_val:
                            try:
                                msgs_col = db.collection("whatsapp_chats").document(destinatario).collection("mensajes")
                                msg_doc_ref = msgs_col.document(status_id)
                                snap = msg_doc_ref.get()
                                if not snap.exists:
                                    # Fallback para mensajes cuyo doc.id no sea el wamid pero tengan id_meta == status_id
                                    q_matches = msgs_col.where("id_meta", "==", status_id).limit(1).stream()
                                    for m_doc in q_matches:
                                        msg_doc_ref = m_doc.reference
                                        snap = m_doc
                                        break
                                if snap.exists:
                                    estado_actual = (snap.to_dict() or {}).get("estado", "")
                                    # Evitar que un evento desordenado degrade 'read' a 'delivered' o 'sent'
                                    if status_val == "failed" or orden_estados.get(status_val, 0) >= orden_estados.get(estado_actual, 0):
                                        update_fields = {
                                            "estado": status_val,
                                            "actualizado_en": firestore.SERVER_TIMESTAMP
                                        }
                                        if status_val == "failed":
                                            errs = st.get("errors", [])
                                            if errs:
                                                err0 = errs[0]
                                                update_fields["error_codigo"] = err0.get("code")
                                                update_fields["error_detalle"] = (
                                                    (err0.get("error_data") or {}).get("details")
                                                    or err0.get("message")
                                                    or err0.get("title")
                                                    or "Error de entrega en Meta API"
                                                )
                                        msg_doc_ref.update(update_fields)
                            except Exception as e_st:
                                print(f"Error actualizando estado {status_id}:", str(e_st))

        except Exception as e:
            print("⚠️ Error procesando webhook de WhatsApp:", str(e))

        return https_fn.Response("EVENT_RECEIVED", status=200)

    return https_fn.Response("Method Not Allowed", status=405)


@https_fn.on_request(cors=options.CorsOptions(cors_origins="*", cors_methods=["post"]))
def enviar_mensaje(req: https_fn.Request) -> https_fn.Response:
    """
    Ruta: /enviar_mensaje
    Invocada por la Intranet multiusuario cuando un operador responde un chat.
    Recibe: { telefono, mensaje, agente_nombre, agente_email }
    """
    data = req.get_json(silent=True)
    if not data:
        return https_fn.Response(
            json.dumps({"error": "Cuerpo JSON inválido"}),
            status=400,
            mimetype='application/json'
        )

    telefono_raw = data.get("telefono")
    mensaje = (data.get("mensaje") or "").strip()
    agente_nombre = data.get("agente_nombre") or "Operador IIRESODH"
    agente_email = data.get("agente_email") or ""

    if not telefono_raw or not mensaje:
        return https_fn.Response(
            json.dumps({"error": "Faltan datos obligatorios (teléfono o mensaje)"}),
            status=400,
            mimetype='application/json'
        )

    # Limpiar formato del teléfono (solo dígitos)
    telefono_limpio = "".join(filter(str.isdigit, str(telefono_raw)))
    if not telefono_limpio:
        return https_fn.Response(
            json.dumps({"error": "El número de teléfono proporcionado no es válido"}),
            status=400,
            mimetype='application/json'
        )

    creds = obtener_credenciales_meta()
    token = creds.get("whatsapp_token")
    phone_id = creds.get("phone_number_id")

    meta_msg_id = None
    estado_envio = "enviado"
    meta_response_data = None

    # Si las credenciales de Meta están configuradas, enviar vía Meta Cloud API
    if token and phone_id:
        url = f"https://graph.facebook.com/v21.0/{phone_id}/messages"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": telefono_limpio,
            "type": "text",
            "text": {"body": mensaje}
        }

        try:
            res = requests.post(url, headers=headers, json=payload, timeout=12)
            meta_response_data = res.json() if res.content else {}

            if res.status_code in [200, 201]:
                mensajes_meta = meta_response_data.get("messages", [])
                if mensajes_meta:
                    meta_msg_id = mensajes_meta[0].get("id")
                estado_envio = "enviado"
            else:
                print("❌ Error devuelto por Meta API:", meta_response_data)
                return https_fn.Response(
                    json.dumps({
                        "error": "Error al enviar mensaje vía Meta API",
                        "detalles": meta_response_data
                    }),
                    status=res.status_code,
                    mimetype='application/json'
                )
        except Exception as e_req:
            print("❌ Excepción conectando con Meta:", str(e_req))
            return https_fn.Response(
                json.dumps({"error": f"Fallo de conexión con Meta: {str(e_req)}"}),
                status=502,
                mimetype='application/json'
            )
    else:
        # Modo en espera de credenciales (permite probar la UI y registrar mensajes en Firestore)
        estado_envio = "guardado_esperando_meta_api"
        meta_msg_id = f"local_{int(time.time() * 1000)}"

    # Guardar en Firestore para sincronización multiusuario en tiempo real
    try:
        db = get_db()
        doc_id = meta_msg_id or f"msg_{int(time.time() * 1000)}"
        chat_ref = db.collection("whatsapp_chats").document(telefono_limpio)

        msg_doc = {
            "id_meta": meta_msg_id,
            "texto": mensaje,
            "tipo": "text",
            "es_mio": True,
            "agente_nombre": agente_nombre,
            "agente_email": agente_email,
            "fecha": firestore.SERVER_TIMESTAMP,
            "estado": estado_envio
        }

        chat_ref.collection("mensajes").document(doc_id).set(msg_doc)

        # Actualizar resumen de la conversación
        chat_ref.set({
            "telefono": telefono_limpio,
            "ultimo_mensaje": mensaje,
            "ultima_fecha": firestore.SERVER_TIMESTAMP,
            "actualizado_en": firestore.SERVER_TIMESTAMP,
            "ultimo_agente": agente_nombre,
            "no_leidos": 0
        }, merge=True)

    except Exception as e_fs:
        print("⚠️ Error guardando mensaje en Firestore:", str(e_fs))

    return https_fn.Response(
        json.dumps({
            "success": True,
            "estado": estado_envio,
            "id_mensaje": meta_msg_id,
            "telefono": telefono_limpio,
            "meta_api_conectada": bool(token and phone_id)
        }),
        status=200,
        mimetype='application/json'
    )


@https_fn.on_request(cors=options.CorsOptions(cors_origins="*", cors_methods=["post"]))
def notificar_workspace(req: https_fn.Request) -> https_fn.Response:
    """
    Ruta: /notificar_workspace
    Envía notificaciones Push FCM (Android e iOS PWA) cuando un colega envía
    un mensaje directo (DM) o publica en un canal interno de IIRESODH Workspace.
    """
    data = req.get_json(silent=True) or {}
    canal_id = (data.get("canal_id") or "general").strip()
    canal_nombre = (data.get("canal_nombre") or canal_id).strip()
    es_dm = bool(data.get("es_dm"))
    texto = (data.get("texto") or "Nuevo mensaje en IIRESODH Workspace").strip()
    autor_email = (data.get("autor_email") or "").strip().lower()
    autor_nombre = (data.get("autor_nombre") or "Colega IIRESODH").strip()
    destinatarios = data.get("destinatarios") or []

    if es_dm:
        titulo = f"💬 IIRESODH · {autor_nombre}"
    else:
        titulo = f"💬 #{canal_nombre} · {autor_nombre}"

    enviados = enviar_push_fcm_dispositivos(
        titulo=titulo,
        cuerpo=texto,
        data_payload={
            "tab": "workspace",
            "channelId": canal_id,
            "tipo": "dm" if es_dm else "canal",
            "tag": f"ws-chan-{canal_id}",
            "url": f"/?app=comms&tab=workspace&channelId={canal_id}"
        },
        excluir_email=autor_email,
        solo_emails=destinatarios if isinstance(destinatarios, list) and len(destinatarios) > 0 else None
    )

    return https_fn.Response(
        json.dumps({"success": True, "enviados": enviados}),
        status=200,
        mimetype="application/json"
    )
