import os
import json
import time
import requests
from firebase_admin import initialize_app, firestore
from firebase_functions import https_fn, options

# 🚀 1. Inicialización de Firebase Admin SDK
try:
    initialize_app()
except Exception:
    pass

db = firestore.client()

DEFAULT_VERIFY_TOKEN = "mi_codigo_secreto_123"
DEFAULT_TOKEN = "EAANXNDTIJbEBSZBSCJYkmRppLlnZClHmoNrPXv4NUZAvnrAKRbt3SHKAofljjNHHLPNxNw5dAa6nbptUVihprd0ScNCRPQZCgdn9vDtpeWfwGqZBZAa3W1q3dxZCfY8gsJbAKBMCEMQiqZCEtS78ZB9dXvmoJsuZBARg1i7DaSk5NgBay0ZCE2yvh5raFxFY0yku9alWjZBSsvZC1AP3QLqaKVnYSkeff4WWY6nSmCaYQntAewkACmq5xqYca7A6NZBQYay3mCMQbes9Gx7vFdzRcaShZCZBfAZDZD"

def obtener_credenciales_meta():
    """
    Obtiene las credenciales de la API de Meta.
    Busca primero en variables de entorno y como fallback en Firestore (whatsapp_config/credenciales).
    Esto permite configurar las llaves desde la Intranet o por variables de entorno.
    """
    token = os.environ.get("WHATSAPP_TOKEN")
    phone_id = os.environ.get("PHONE_NUMBER_ID")
    verify_token = os.environ.get("VERIFY_TOKEN", DEFAULT_VERIFY_TOKEN)
    waba_id = os.environ.get("WABA_ID")

    # Si falta alguna credencial principal, consultar en Firestore
    try:
        cfg_doc = db.collection("whatsapp_config").document("credenciales").get()
        if cfg_doc.exists:
            datos = cfg_doc.to_dict() or {}
            token = token or datos.get("whatsapp_token")
            phone_id = datos.get("phone_number_id") or phone_id
            verify_token = datos.get("verify_token") or verify_token
            waba_id = datos.get("waba_id") or waba_id
    except Exception as e:
        print("⚠️ Error leyendo credenciales de Firestore:", str(e))

    # Fallbacks predeterminados (número oficial permanente: +506 4081 6188)
    token = token or DEFAULT_TOKEN
    phone_id = phone_id or "1429140810275241"
    waba_id = waba_id or "28701773989517598"

    return {
        "whatsapp_token": token,
        "phone_number_id": phone_id,
        "verify_token": verify_token or DEFAULT_VERIFY_TOKEN,
        "waba_id": waba_id
    }


@https_fn.on_request(cors=options.CorsOptions(cors_origins="*", cors_methods=["get", "post"]))
def whatsapp_webhook(req: https_fn.Request) -> https_fn.Response:
    """
    Ruta: /whatsapp_webhook
    - GET:  Verificación y Handshake de Webhook de Meta for Developers
    - POST: Recepción de mensajes entrantes y estados de entrega (sent, delivered, read)
    """
    creds = obtener_credenciales_meta()

    # ==============================================================
    # 1. VERIFICACIÓN DEL WEBHOOK (HANDSHAKE DE META)
    # ==============================================================
    if req.method == 'GET':
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

                        # Extraer contenido según el tipo de mensaje
                        cuerpo_texto = ""
                        if msg_type == "text":
                            cuerpo_texto = msg.get("text", {}).get("body", "")
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
                        chat_ref = db.collection("whatsapp_chats").document(remitente)
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
                        msg_ref = chat_ref.collection("mensajes").document(msg_id)
                        msg_ref.set({
                            "id_meta": msg_id,
                            "texto": cuerpo_texto,
                            "tipo": msg_type,
                            "es_mio": False,
                            "remitente_nombre": nombre_contacto or f"+{remitente}",
                            "remitente_telefono": remitente,
                            "fecha": firestore.SERVER_TIMESTAMP,
                            "estado": "recibido",
                            "raw_type": msg_type
                        })

                    # C. Notificaciones de estado (enviado, entregado, leído, error)
                    statuses = value.get("statuses", [])
                    for st in statuses:
                        status_id = st.get("id")
                        status_val = st.get("status") # sent, delivered, read, failed
                        destinatario = st.get("recipient_id")

                        if destinatario and status_id and status_val:
                            try:
                                msg_doc_ref = db.collection("whatsapp_chats").document(destinatario).collection("mensajes").document(status_id)
                                if msg_doc_ref.get().exists:
                                    msg_doc_ref.update({
                                        "estado": status_val,
                                        "actualizado_en": firestore.SERVER_TIMESTAMP
                                    })
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