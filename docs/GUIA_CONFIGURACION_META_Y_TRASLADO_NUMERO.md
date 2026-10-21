# 📖 Guía Oficial: Traslado de Número y Configuración de WhatsApp Cloud API (Meta)

Esta guía detalla el procedimiento paso a paso para migrar el número telefónico institucional de **IIRESODH** desde la aplicación móvil de WhatsApp Business hacia la **Cloud API de Meta**, habilitando la gestión multi-usuario en la Intranet institucional.

---

## 📑 Tabla de Contenidos
1. [Consideraciones Previas y Reglas de Meta](#1-consideraciones-previas-y-reglas-de-meta)
2. [Fase 1: Respaldo y Liberación del Número en el Teléfono](#fase-1-respaldo-y-liberación-del-número-en-el-teléfono)
3. [Fase 2: Configuración de la App en Meta for Developers](#fase-2-configuración-de-la-app-en-meta-for-developers)
4. [Fase 3: Registro y Verificación del Número en Meta](#fase-3-registro-y-verificación-del-número-en-meta)
5. [Fase 4: Generación del Token de Acceso Permanente](#fase-4-generación-del-token-de-acceso-permanente)
6. [Fase 5: Configuración del Webhook](#fase-5-configuración-del-webhook)
7. [Fase 6: Enlace con la Intranet IIRESODH](#fase-6-enlace-con-la-intranet-iiresodh)

---

## 1. Consideraciones Previas y Reglas de Meta

> ⚠️ **REGLA DE EXCLUSIÓN DE META:**
> Un número telefónico **no puede operar simultáneamente** en la aplicación móvil de WhatsApp y en la Cloud API. Para activarlo en la API web, debe ser liberado de la app del teléfono.

* **Historial de Mensajes:** La Cloud API inicia desde cero. Las conversaciones previas que existían en el celular no se transfieren automáticamente a la API; se deben respaldar si son de interés institucional.
* **Llamadas y SMS convencionales:** Tu tarjeta SIM o línea telefónica seguirá recibiendo llamadas y mensajes SMS comunes con normalidad de parte de tu operadora de telefonía.
* **Capacidad de recepción:** Durante el proceso de registro en Meta, el teléfono físico debe tener señal para recibir un SMS o una llamada con un código de 6 dígitos.

---

## Fase 1: Respaldo y Liberación del Número en el Teléfono

Sigue este orden exacto en el teléfono móvil donde actualmente está activo el WhatsApp institucional:

### 1.1. Exportar Chats Importantes (Opcional pero Recomendado)
Si tienes conversaciones legales, litigios o expedientes que necesitas conservar:
1. Abre el chat correspondiente en WhatsApp Business.
2. Toca los **tres puntos verticales (Menú)** en la esquina superior derecha > **Más** > **Exportar chat**.
3. Elige si deseas incluir archivos multimedia o solo texto.
4. Envíatelo a tu correo electrónico institucional o guárdalo en Google Drive.

### 1.2. Desactivar la Verificación en Dos Pasos (PIN)
Para evitar que Meta bloquee el registro por conflicto de PIN:
1. En WhatsApp Business ve a: **Ajustes** (o Configuración) > **Cuenta** > **Verificación en dos pasos**.
2. Pulsa en **Desactivar**.

### 1.3. Liberar el Número (Eliminar Cuenta de WhatsApp)
> ⛔ **ADVERTENCIA:** No desinstales únicamente la app. Si la desinstalas sin borrar la cuenta, los servidores de Meta seguirán considerando el número como ocupado.

1. En WhatsApp Business ve a: **Ajustes** > **Cuenta** > **Eliminar mi cuenta**.
2. Confirma el país e introduce el número de teléfono institucional.
3. Haz clic en el botón rojo **Eliminar mi cuenta**.
4. *(A partir de este segundo, el número queda libre en los servidores de WhatsApp para ser registrado en la API).*

---

## Fase 2: Configuración de la App en Meta for Developers

1. Ingresa a [developers.facebook.com](https://developers.facebook.com) e inicia sesión con la cuenta de Meta de la institución.
2. Haz clic en **Mis Apps** (My Apps) en la barra superior.
3. Haz clic en **Crear App** (Create App):
   - **Tipo de App:** Selecciona **Otro** (Other) > Siguiente.
   - **Caso de uso / Tipo:** Selecciona **Negocio** (Business).
   - **Nombre de la App:** Ej. `IIRESODH Intranet WhatsApp`.
   - **Cuenta comercial de Meta:** Selecciona la cuenta de Business Manager de IIRESODH.
   - Haz clic en **Crear App**.
4. En el panel de control de la app, busca el cuadro de **WhatsApp** y haz clic en **Configurar** (Set Up).

---

## Fase 3: Registro y Verificación del Número en Meta

1. En el menú lateral izquierdo de tu app, despliega **WhatsApp** y entra en **Configuración de la API** (API Setup).
2. En la sección *"Paso 2: Enviar mensajes con la API"*, haz clic en el botón **Añadir número de teléfono** (Add Phone Number).
3. Completa la información del perfil público:
   - **Nombre para mostrar en WhatsApp:** Escribe el nombre institucional exacto (ej. `IIRESODH`).
   - **Zona horaria:** `(GMT-06:00) Costa Rica`.
   - **Categoría:** *Organización sin fines de lucro* o *Servicios legales*.
   - **Descripción de la empresa:** Breve resumen institucional.
4. Ingresa el número telefónico oficial con su prefijo internacional (ej. `+506 ...`).
5. **Método de verificación:** Selecciona **Mensaje de texto (SMS)** o **Llamada telefónica**.
6. Recibirás un código de 6 dígitos en tu teléfono físico. Introdúcelo en la pantalla de Meta para validar.
7. Una vez completado, Meta te asignará un **Identificador de número de teléfono** (`PHONE_NUMBER_ID`). Cópialo y guárdalo.

---

## Fase 4: Generación del Token de Acceso Permanente

> ℹ️ El token de prueba que aparece en la pantalla principal de WhatsApp expira cada 24 horas. Para producción se debe crear un **Usuario del Sistema** que provea un token permanente.

1. Ingresa a la **Configuración del Negocio** de Meta: [business.facebook.com/settings](https://business.facebook.com/settings).
2. En el menú izquierdo, ve a **Usuarios** > **Usuarios del sistema** (System Users).
3. Haz clic en **Añadir** (Add):
   - **Nombre:** `Servicio Intranet WhatsApp`.
   - **Rol:** `Administrador`.
4. Con el usuario creado seleccionado, haz clic en **Añadir activos** (Add Assets):
   - Selecciona **Apps** > Selecciona tu app `IIRESODH Intranet WhatsApp`.
   - Activa el interruptor de **Control total (Administrar app)** y guarda los cambios.
5. Haz clic en el botón **Generar nuevo token** (Generate New Token):
   - Selecciona la App de WhatsApp.
   - En **Caducidad del token**, selecciona **Nunca** (Never).
   - En la lista de permisos disponibles, marca obligatoriamente:
     - `whatsapp_business_messaging`
     - `whatsapp_business_management`
6. Haz clic en **Generar token**.
7. **Copia el token generado** inmediatamente (comienza por `EAA...`). Por seguridad, Meta no lo vuelve a mostrar.

---

## Fase 5: Configuración del Webhook

El Webhook permite que cada mensaje que un cliente escriba por WhatsApp viaje inmediatamente a la Intranet de IIRESODH:

1. En [developers.facebook.com](https://developers.facebook.com), dentro de tu App, ve a **WhatsApp** > **Configuración** (Configuration).
2. En la sección **Webhook**, haz clic en **Editar** (Edit):
   - **URL de devolución de llamada (Callback URL):**
     ```text
     https://us-central1-litigio-management.cloudfunctions.net/whatsapp_webhook
     ```
   - **Token de verificación (Verify Token):**
     ```text
     iiresodh_webhook_secret_2026
     ```
3. Haz clic en **Verificar y guardar** (Meta enviará un ping de validación y confirmará con un check verde).
4. En esa misma pantalla, en **Campos del webhook** (Webhook Fields), haz clic en **Administrar** (Manage).
5. Busca la fila llamada **`messages`** y haz clic en **Suscribirse** (Subscribe).
6. Haz clic en **Listo**.

---

## Fase 6: Enlace con la Intranet IIRESODH

Con las credenciales en mano, enlazarlas con la Intranet toma menos de 1 minuto:

1. Abre la Intranet de IIRESODH e inicia sesión como Administrador o Superadmin.
2. Ingresa al módulo **WhatsApp Business API**.
3. En la esquina superior derecha, presiona el botón **⚙️ Conexión Meta API**.
4. Pega las llaves obtenidas:
   - **Identificador de número de teléfono (`PHONE_NUMBER_ID`)**: El ID numérico obtenido en la *Fase 3*.
   - **Token de Acceso Permanente (`WHATSAPP_TOKEN`)**: El token `EAA...` generado en la *Fase 4*.
   - *(Opcional)* **ID de Cuenta de WhatsApp Business (`WABA_ID`)**: Se encuentra en la configuración de la cuenta comercial.
5. Presiona **Guardar y Activar API**.

---

## ✅ Verificación del Funcionamiento Multi-Usuario

1. Desde cualquier teléfono personal externo, envía un mensaje de prueba al número oficial de IIRESODH (ej: *"Hola, necesito asesoría jurídica"*).
2. Verás cómo entra la notificación y aparece el chat inmediatamente en la Intranet.
3. Cualquier operador de IIRESODH puede responder desde su propia cuenta.
4. El cliente recibirá el mensaje en su WhatsApp como un mensaje normal de la institución, y en la Intranet quedará registrado:
   `👤 [Nombre del Operador que respondió] • HH:MM • Entregado/Leído`.
