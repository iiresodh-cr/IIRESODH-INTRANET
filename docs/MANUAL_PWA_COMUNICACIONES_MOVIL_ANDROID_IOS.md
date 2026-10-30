# Manual de Instalación y Uso — PWA Móvil de Comunicaciones IIRESODH (Android e iPhone)

**Plataforma:** IIRESODH Comunicaciones (WhatsApp Business Oficial + IIRESODH Workspace)  
**Acceso restringido:** Exclusivo para cuentas institucionales pre-autorizadas (`@iiresodh.org`)  
**URL Oficial:** `https://intra.iiresodh.org` / `https://litigio-management.web.app`

---

## 1. ¿Qué es la App Móvil de Comunicaciones IIRESODH?

La **PWA (Progressive Web App) de Comunicaciones IIRESODH** es la aplicación móvil oficial del Instituto que unifica en una sola interfaz nativa a pantalla completa los dos canales de comunicación operativa del equipo:

1. **🟢 WhatsApp Business Oficial (`+506 4081-6188`)**: Atención multi-operador de usuarios, clientes y contrapartes externas en tiempo real.
2. **💬 IIRESODH Workspace (Mensajería Interna tipo Slack)**: Comunicación interna del equipo jurídico y administrativo mediante Canales Institucionales (`#general`, `#costa-rica`, etc.) y Mensajes Directos (1 a 1).

Al instalarse en **Android** o **iPhone (iOS)**, la aplicación se agrega a la pantalla de inicio con el **isotipo oficial de IIRESODH**, funciona a pantalla completa (sin barras de navegador), muestra globos numéricos de mensajes no leídos y recibe **notificaciones Push en tiempo real** incluso cuando el teléfono está bloqueado.

---

## 2. Guía Paso a Paso de Instalación

### 🍎 A. Instalación en iPhone y iPad (iOS 16.4 o superior)

> **Importante en iPhone:** Por políticas de seguridad de Apple, las notificaciones Push solo se habilitan cuando la aplicación ha sido agregada a la **Pantalla de Inicio** desde el navegador **Safari**.

1. Abre el navegador **Safari** en tu iPhone e ingresa a:  
   👉 **`https://intra.iiresodh.org`** *(o `https://litigio-management.web.app`)*
2. Toca el botón **Compartir** (el ícono de un cuadrado con una flecha hacia arriba ⬆️ situado en la barra inferior de Safari).
3. Desliza el menú hacia abajo y selecciona la opción **"Agregar a pantalla de inicio"** (*Add to Home Screen*).
4. Verás el **isotipo de IIRESODH** y el nombre **IIRESODH**. Toca **"Agregar"** en la esquina superior derecha.
5. Cierra Safari y **abre la aplicación tocando el nuevo ícono de IIRESODH** en la pantalla de inicio de tu iPhone.
6. Inicia sesión con tu cuenta institucional **`@iiresodh.org`**.
7. Una vez dentro de la aplicación, toca el banner verde superior **"Activar"** (o el ícono de campana 🔔 en la esquina superior derecha $\rightarrow$ **"Activar Notificaciones Push"**) y acepta el permiso de notificaciones de iOS.

---

### 🤖 B. Instalación en Teléfonos Android (Chrome / Edge)

1. Abre el navegador **Google Chrome** en tu teléfono Android e ingresa a:  
   👉 **`https://intra.iiresodh.org`** *(o `https://litigio-management.web.app`)*
2. Inicia sesión con tu cuenta institucional **`@iiresodh.org`**.
3. Toca el menú de tres puntos **`⋮`** en la esquina superior derecha de Chrome.
4. Selecciona **"Instalar aplicación"** (o *"Agregar a la pantalla principal"*).
5. Confirma tocando **"Instalar"**. El ícono con el **isotipo de IIRESODH** aparecerá en tu cajón de aplicaciones y pantalla principal.
6. Abre la aplicación desde el ícono instalado y toca el banner verde **"Activar"** (o la campana 🔔 arriba a la derecha) y concede el permiso de notificaciones cuando Android lo solicite.

---

## 3. Características Principales de la Aplicación

### 3.1. Selector Superior Dual (`🟢 WhatsApp` $\leftrightarrow$ `💬 Workspace`)
En la barra superior fija de la aplicación encontrarás el conmutador principal con contadores en vivo:
* **🟢 WhatsApp**: Muestra el número de mensajes externos pendientes de responder.
* **💬 Workspace**: Muestra cuántos canales o mensajes directos internos tienen mensajes nuevos.
* Puedes alternar entre ambos módulos con un solo toque sin perder tu posición ni recargar la aplicación.

### 3.2. Presencia "En Línea" Continua y Estado Personalizado
* **Sincronización automática de presencia**: Mientras tengas abierta la app móvil (aunque estés trabajando dentro de la pestaña de WhatsApp), el sistema te mostrará como **🟢 En línea** ante tus colegas en el Workspace de escritorio y móvil.
* **Cambio de Disponibilidad y Estado Personalizado**:
  * Toca el **isotipo de IIRESODH** con tu indicador de color (esquina superior izquierda) o tu tarjeta de perfil dentro de Workspace.
  * Podrás elegir entre los estados institucionales:
    * 🟢 **Disponible**
    * 🏛️ **En audiencia judicial**
    * 📅 **En reunión**
    * 📝 **Redactando escrito / Enfoque**
    * ✈️ **En misión oficial**
    * 🔕 **Plazo fatal / No molestar**
    * 🌴 **Ausente / Vacaciones**
  * También puedes escribir un **Estado Personalizado libre** con cualquier emoji (por ejemplo: `🚗 En camino a la Corte`) y tocar **OK**.

### 3.3. Alertas Cruzadas en Vivo (*In-App Heads-Up Banner*)
* Si estás dentro de **🟢 WhatsApp** atendiendo a un usuario y un compañero de IIRESODH te escribe por **💬 Workspace**, se desplegará una tarjeta interactiva en la parte superior de tu pantalla con un tono suave. Al tocarla, saltarás directamente a la conversación con tu compañero.
* De igual forma, si estás en **💬 Workspace** y entra un mensaje nuevo de **🟢 WhatsApp**, recibirás el aviso superior inmediato para abrir ese chat externo con un toque.

### 3.4. Notificaciones Push y Apertura Directa (*Deep Linking*)
* Cuando el teléfono está bloqueado o tienes la aplicación cerrada:
  * Los mensajes de clientes llegan identificados como **`🟢 WhatsApp · [Nombre del Contacto]`**. Al tocar la notificación, la app se abre directamente dentro de ese chat de WhatsApp.
  * Las llamadas de voz entrantes llegan como **`📞 Llamada WhatsApp · [Nombre del Contacto]`**.
  * Los mensajes internos llegan identificados como **`💬 IIRESODH · [Nombre del Colega]`** (en mensaje directo) o **`💬 #[canal] · [Nombre del Colega]`**. Al tocarlos, la app se abre directamente en ese canal o conversación privada.
* El ícono de IIRESODH en la pantalla de tu teléfono mostrará un **globo numérico** con la suma de mensajes pendientes de leer.

---

## 4. Cómo Utilizar Cada Módulo desde el Teléfono

### 4.1. Uso del Módulo 🟢 WhatsApp Business
1. **Bandeja de Entrada**:
   * Usa el buscador superior para localizar contactos por nombre, número telefónico o contenido del mensaje.
   * Filtra entre **Todos** y **No leídos** para priorizar la atención.
   * Toca el botón **`+ Nuevo Chat`** para iniciar una conversación con cualquier número internacional (utilizando plantillas oficiales de Meta si no hay ventana de 24 horas activa).
2. **Dentro de una Conversación de WhatsApp**:
   * **Texto y Emojis/Stickers**: Toca el ícono `😊` para insertar emojis o enviar con un solo toque los **Stickers Oficiales de IIRESODH** (*Recibido, Muchas Gracias, En Revisión, Documento OK, Confirmado*, etc.) o convertir cualquier imagen en sticker.
   * **Cámara, Galería y Documentos PDF (`📎`)**: Toca el clip `📎` junto al campo de texto para:
     * 📷 **Tomar foto (Cámara)**: Abre directamente la cámara trasera de tu celular y envía la fotografía por WhatsApp.
     * 🖼️ **Foto de galería**: Envía una imagen almacenada en tu teléfono.
     * 📄 **Documento (PDF / Word)**: Adjunta y envía escritos, resoluciones o documentos PDF directamente al WhatsApp del contacto.
   * **Notas de Voz (`🎤`)**: Toca el ícono del micrófono `🎤` para grabar un mensaje de voz desde el micrófono de tu teléfono; verás el cronómetro en vivo con opción de **Cancelar** o **Enviar Audio**.
   * **Sala Google Meet en 1 Toque (`📹`)**: En la barra superior del chat puedes generar y enviar automáticamente al contacto un enlace oficial de videollamada de Google Meet.
   * **Llamadas de Voz WebRTC (`📞`)**: Cuando entre una llamada a la línea oficial de WhatsApp, aparecerá el banner superior oscuro con los botones **Contestar** (usando el micrófono de tu teléfono) o **Desviar / Rechazar** (para que la llamada pase al teléfono físico de la oficina).

---

### 4.2. Uso del Módulo 💬 IIRESODH Workspace (Mensajes Internos)
1. **Directorio de Canales y Compañeros**:
   * Utiliza las píldoras superiores para filtrar entre **Todos**, **No leídos**, **Canales** y **Mensajes Directos**.
   * En **Canales Institucionales** verás todos los canales públicos (`#general`, `#costa-rica`, etc.) y los canales privados (`🔒`) a los que perteneces.
   * En **Mensajes Directos** verás a todos los miembros del equipo ordenados automáticamente con los **colegas En línea primero** (punto verde), junto con su emoji y texto de estado personalizado.
2. **Dentro de un Canal o Mensaje Directo**:
   * **Enviar Mensajes**: Escribe en la barra inferior y toca el botón azul de enviar. El sistema notificará en tiempo real que estás escribiendo y enviará una notificación Push al celular de tus compañeros.
   * **Notas de Voz Internas (`🎤`)**: Toca el micrófono `🎤` para grabar y enviar un clip de audio al canal o mensaje directo.
   * **Adjuntar Archivos (`📎`)**: Toca el clip `📎` para subir fotos o documentos desde tu teléfono al canal o chat privado.
   * **Reacciones y Hilos (`💬 Responder`)**:
     * Toca `+👍` o cualquier emoji debajo de un mensaje para reaccionar rápidamente.
     * Toca **`Responder`** (o `💬 X respuestas`) en cualquier mensaje para abrir el **Hilo de conversación** organizado sin saturar el canal principal.
   * **Videollamada Google Meet (`📹 Meet`)**: Toca el botón **Meet** en la esquina superior derecha del canal o DM para abrir una sala de videollamada instantánea y publicar el botón de acceso para tus compañeros.

---

## 5. Centro de Diagnóstico de Notificaciones y Acceso al Hub Completo

En la esquina superior derecha de la PWA móvil encontrarás dos botones de control:
1. **Campana de Notificaciones (`🔔`)**:
   * Permite verificar si las notificaciones Push están activas en tu teléfono (indicador verde).
   * Incluye el botón **"Enviar Notificación de Prueba"** para comprobar al instante el sonido, la vibración y el banner en tu dispositivo.
   * Permite renovar el token Push o desvincular las alertas de ese teléfono si cambias de dispositivo.
2. **Acceso al Hub Completo de la Intranet (`⊞`)**:
   * Si en algún momento necesitas consultar desde tu teléfono otro módulo de la Intranet (*Expedientes de Litigio, Recursos Institucionales o Panel Web*), toca el ícono de cuadrícula `⊞` (o el botón *"Ir al Hub Completo de la Intranet"* dentro del menú de la campana).
   * Para regresar a la interfaz móvil dedicada de mensajería desde el Hub, basta con tocar el botón verde **"📱 App Móvil"** en la barra superior.
