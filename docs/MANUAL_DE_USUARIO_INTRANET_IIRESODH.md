# Manual de Usuario — Intranet Institucional IIRESODH

**Instituto Internacional de Responsabilidad Social y Derechos Humanos (IIRESODH)**  
**Portal Oficial:** `https://intra.iiresodh.org` / `https://litigio-management.web.app`  
**Versión del Documento:** 2.2 (Incluye *IIRESODH Workspace*, Videollamadas Nativas de Google Meet por Canal y Externas, Selector Directo de Google Drive, Comunicados vía Google Workspace con Trazabilidad por Destinatario e Indicador en Tiempo Real de WhatsApp Institucional)

---

## Índice de Contenidos

1. [Introducción General](#1-introducción-general)
2. [Acceso al Sistema, Seguridad Perimetral y Roles](#2-acceso-al-sistema-seguridad-perimetral-y-roles)
3. [Hub Central e IIRESODH Workspace (Estilo Slack)](#3-hub-central-e-iiresodh-workspace-estilo-slack)
   - [3.1. Canales y Mensajes Directos en Tiempo Real](#31-canales-y-mensajes-directos-en-tiempo-real)
   - [3.2. Indicador de Presencia y Estados de Disponibilidad](#32-indicador-de-presencia-y-estados-de-disponibilidad)
   - [3.3. Seguimiento de Proyectos y Tareas (Kanban y Lista)](#33-seguimiento-de-proyectos-y-tareas-kanban-y-lista)
   - [3.4. Calendario Privado y Agenda Propia de la Plataforma](#34-calendario-privado-y-agenda-propia-de-la-plataforma)
   - [3.5. Biblioteca y Visor Integrado de Google Drive](#35-biblioteca-y-visor-integrado-de-google-drive)
   - [3.6. Videollamadas Nativas con Google Meet (Por Canal, Mensajes Directos, Calendario y Salas Externas)](#36-videollamadas-nativas-con-google-meet-por-canal-mensajes-directos-calendario-y-salas-externas)
4. [Módulo: Centro de Recursos Institucionales](#4-módulo-centro-de-recursos-institucionales)
5. [Módulo: Gestión de Litigios y Expedientes Jurídicos](#5-módulo-gestión-de-litigios-y-expedientes-jurídicos)
   - [5.1. Creación y Administración de Casos](#51-creación-y-administración-de-casos)
   - [5.2. Gestión de Representados y Ficha Individual](#52-gestión-de-representados-y-ficha-individual)
   - [5.3. Plazos Fatales y Documentos del Expediente](#53-plazos-fatales-y-documentos-del-expediente)
   - [5.4. Comunicados Masivos y Trazabilidad de Entrega y Apertura](#54-comunicados-masivos-y-trazabilidad-de-entrega-y-apertura)
6. [Módulo: Mensajería Oficial WhatsApp Business API](#6-módulo-mensajería-oficial-whatsapp-business-api)
7. [Módulo: Administración del Sitio Web Público](#7-módulo-administración-del-sitio-web-público)
8. [Administración de Seguridad: Usuarios y Auditoría](#8-administración-de-seguridad-usuarios-y-auditoría)
9. [Atajos de Teclado y Preguntas Frecuentes (FAQ)](#9-atajos-de-teclado-y-preguntas-frecuentes-faq)

---

## 1. Introducción General

La **Intranet Institucional de IIRESODH** es la plataforma centralizada de trabajo colaborativo, gestión procesal de litigios estratégicos, comunicación oficial y administración documental del Instituto.

A través de una única sesión segura con su cuenta institucional **`@iiresodh.org`**, el sistema integra:
- Un **Espacio de Trabajo Colaborativo (*IIRESODH Workspace*)** con canales temáticos, mensajes directos, hilos de discusión, seguimiento de proyectos en tablero Kanban, calendario híbrido y visor embebido de Google Drive.
- El sistema de **Control de Expedientes y Litigios**, representados, plazos procesales y emisión de comunicados oficiales con confirmación de lectura.
- La consola multiagente de **WhatsApp Business API**.
- El **Centro de Recursos Institucionales** y el **Administrador del Portal Web Público**.

---

## 2. Acceso al Sistema, Seguridad Perimetral y Roles

### 2.1. Requisitos de Ingreso
El sistema cuenta con un **doble anillo de seguridad perimetral**:
1. **Exclusividad de Dominio**: Únicamente permite autenticar cuentas de Google Workspace terminadas en **`@iiresodh.org`**. Cualquier intento con cuentas personales (`@gmail.com`, etc.) es bloqueado y registrado automáticamente en la bitácora de seguridad.
2. **Lista Blanca Activa**: Además de pertenecer al dominio `@iiresodh.org`, el correo del colaborador debe haber sido previamente inscrito y habilitado por un Administrador en el módulo de **Usuarios Autorizados**.

### 2.2. Matriz de Roles y Privilegios

| Rol Institucional | Alcance Operativo en la Intranet |
| :--- | :--- |
| **Abogado/a** | Acceso completo al *IIRESODH Workspace* (Canales, Proyectos, Calendario, Drive), Centro de Recursos Institucionales y operación integral del módulo de **Casos y Litigios** (expedientes, representados, plazos, escritos y comunicados masivos). |
| **Administrativo** | Acceso completo al *IIRESODH Workspace*, Centro de Recursos Institucionales, consulta y soporte en **Casos y Litigios** (registro de representados, conciliación de pagos y carga documental). Puede recibir permisos adicionales para *WhatsApp* y *Sitio Web*. |
| **Admin** | Todas las capacidades anteriores + eliminación de casos, carga de normativas/material gráfico en Recursos Institucionales y gestión del **Control de Usuarios Autorizados** (inscribir personal y otorgar permisos a Sitio Web / WhatsApp). |
| **Superadmin** | Control total del sistema, designación de otros Administradores y acceso exclusivo a la **Bitácora de Auditoría Forense (Logs)**. |

---

## 3. Hub Central e IIRESODH Workspace (Estilo Slack)

Al iniciar sesión, ingresará al **Hub Central de IIRESODH**. En la parte superior encontrará su banner ejecutivo de bienvenida con su rol activo, accesos directos al ecosistema institucional (*Portal iiresodh.org* y *Campus Virtual*) y, justo debajo, el **Espacio de Trabajo & Agenda Institucional (*IIRESODH Workspace*)**.

#### Indicador en Tiempo Real de WhatsApp Institucional en el Banner:
- **Visibilidad por permisos**: Exclusivamente para los usuarios que tienen habilitado el permiso de **WhatsApp Institucional** (o rol `Superadmin`), aparece en la esquina superior derecha del banner el indicador **`WhatsApp Institucional`**.
- **Conteo en vivo y alertas instantáneas**:
  - Muestra en tiempo real el número total de mensajes pendientes de lectura (**`X sin leer`**), iluminándose en verde con un punto pulsante cuando existen mensajes sin atender.
  - Al hacer clic sobre el indicador, lleva directamente a la consola de **WhatsApp Institucional**.
  - Si entra un nuevo mensaje de WhatsApp mientras el usuario se encuentra en el Hub Central, el sistema emite un aviso sonoro suave y despliega una notificación emergente en la esquina superior derecha con el nombre o número del remitente, vista previa del mensaje y botón **`Abrir`**.

> **💡 Tip de Pantalla Completa:** En la esquina superior derecha del Workspace encontrará el botón **`Expandir`**. Al pulsarlo, el espacio de trabajo ocupa toda la pantalla para trabajar cómodamente como una aplicación de escritorio. Para volver al Hub, pulse el botón dorado **`Volver al Hub (Esc)`** o presione la tecla **`Escape`** en su teclado.

La barra superior oscura del Workspace le permite alternar en todo momento entre sus **4 herramientas integradas**:
1. **💬 Canales y Mensajes**
2. **📋 Proyectos y Tareas**
3. **📅 Calendario & Agenda**
4. **📁 Google Drive**

---

### 3.1. Canales y Mensajes Directos en Tiempo Real

El panel izquierdo del Workspace se divide en dos secciones principales:

#### A. Canales Institucionales (`#` y `🔒`)
Los canales organizan las conversaciones del equipo por tema, departamento o caso:
- **`#general`**: Avisos generales y coordinación diaria de todo el equipo.
- **`#anuncios-oficiales`**: Comunicados prioritarios de dirección y normativas.
- **`#litigios-y-casos`**: Coordinación jurídica, estrategia procesal, plazos y audiencias.
- **`#administracion`**: Logística, finanzas, soporte operativo y trámites internos.

**¿Cómo crear un nuevo canal (Abierto a todos o Privado para un grupo de miembros)?**
1. Haga clic en el botón **`+`** junto al título *CANALES INSTITUCIONALES* (o en `+ Añadir canal`).
2. Escriba el nombre del canal (ej. `caso-corte-idh-2026` o `comision-tres-miembros`) y su propósito.
3. En **Tipo de Acceso al Canal**, elija una de las dos modalidades:
   - **`🌐 Canal Abierto`**: Visible y accesible para todos los miembros autorizados del equipo IIRESODH.
   - **`🔒 Privado (Por miembros)`**: Ideal para abrir un canal exclusivo para 3 miembros (o los que desee). Usted queda incluido automáticamente como creador y marca con casilla a los colegas que integrarán el grupo cerrado. Los canales privados muestran un candado dorado (`🔒`) junto con el número exacto de integrantes y solo son visibles para sus miembros y el `Superadmin`.
4. Haga clic en **Crear Canal**.

**¿Cómo ver o editar miembros y cómo eliminar un canal?**
- En la cabecera de cada canal verá el distintivo **`🌐 Abierto a todos`** o **`🔒 Privado • X miembro(s)`**, además del botón de configuración **`⚙️`** (también disponible al pasar el cursor sobre el canal en la barra lateral izquierda).
- Al hacer clic sobre ese distintivo o sobre **`⚙️`**, se abre la ventana de **Gestión del Canal**, donde el creador del canal, un `Admin` o el `Superadmin` pueden **añadir o quitar miembros en cualquier momento**, editar la descripción o cambiar la privacidad del canal.
- **Eliminación de canales (`🗑️`)**: Los usuarios con rol **`Admin`** o **`Superadmin`** (así como el creador de un canal privado `🔒`) disponen del botón rojo **`🗑️ Eliminar canal`** tanto en la barra superior del canal como dentro de la ventana **`⚙️`**, el cual solicita confirmación antes de borrar permanentemente el canal y su historial (el canal base `#general` está protegido contra borrado).

#### B. Mensajes Directos (1 a 1)
Debajo de los canales encontrará la lista de sus colegas autorizados en la Intranet (excluyendo su propio usuario para evitar envíos accidentales a sí mismo):
- **Ordenamiento inteligente por conexión**: Los compañeros que están **conectados en línea (`🟢`) aparecen automáticamente en la parte superior** de la lista, seguidos en orden alfabético por quienes están desconectados (`⚫`).
- Haga clic sobre el nombre de cualquier colega para abrir un **chat privado 1 a 1**.
- Cuando reciba mensajes nuevos en un canal o conversación directa que no ha abierto, aparecerá un **punto celeste brillante (`🔵`)** y el nombre resaltado en negrita.

#### C. Herramientas Avanzadas de Mensajería (Hilos, Reacciones, Menciones y Adjuntos)
Al pasar el cursor sobre cualquier mensaje del chat, aparece una **barra flotante de acciones rápidas** en la esquina superior derecha del mensaje:
- **Reacciones rápidas (`👍 ❤️ ⚖️ ✅`)**: Haga clic en un emoji para reaccionar sin interrumpir el flujo del canal.
- **Responder en hilo (`💬`)**: Abre un panel lateral a la derecha exclusivo para responder a ese mensaje puntual, manteniendo ordenado el canal principal.
- **Fijar mensaje (`📌`)**: Destaca el mensaje en amarillo y lo guarda en la lista de **Mensajes Fijados** del canal (accesible desde el ícono de chincheta `📌` en la parte superior del canal).
- **Editar (`✏️`) / Eliminar (`🗑️`)**: Permite corregir errores de redacción en sus propios mensajes o eliminarlos.

**Barra de redacción de mensajes (parte inferior):**
- **Formato enriquecido**:
  - **Negrita (`*texto*`)**, **Cursiva (`_texto_`)** y **Código (`` `artículo 8` ``)**.
  - **Cita jurídica (`> texto`)**: Muestra un bloque de cita con barra lateral institucional ideal para transcribir extractos de sentencias o normativas.
  - **Lista con viñetas (`•`)**: Inserta listas estructuradas en el mensaje.
- **Mencionar a un colega (`@`)**: Haga clic en el ícono **`@`** para elegir a un compañero de la lista; su nombre aparecerá resaltado (`@NombreApellido`).
- **Adjuntar Archivos o Imágenes (`📎`)**: Haga clic en el clip para subir documentos PDF, Word, Excel o imágenes desde su computadora directamente a la conversación.
- **Notas de Voz / Clips de Audio (`🎙️`)**: Haga clic en el ícono del micrófono para grabar una nota de voz directamente desde su navegador. Verá el contador en tiempo real y podrá pulsar **Enviar nota de voz** para publicar un reproductor de audio integrado en el canal.
- **Encuestas y Votaciones Rápidas (`📊`)**: Haga clic en el ícono de gráfico de barras para lanzar una pregunta con múltiples opciones de votación en tiempo real. Cada miembro puede votar con un clic y ver las barras de porcentaje actualizadas al instante.
- **Comandos Rápidos con Barra (`/`) o botón `⚡`**: Escriba **`/`** al inicio del mensaje para desplegar la paleta de comandos rápidos:
  - `/tarea [título]` → Crea una tarea directamente en el Tablero Kanban y publica su tarjeta en el canal.
  - `/encuesta` → Abre el creador de encuestas del canal.
  - `/evento` → Abre el agendamiento rápido en el Calendario Híbrido.
  - `/canvas` → Abre el Canvas colaborativo del canal.
  - `/guardados` → Abre su bandeja personal de elementos guardados.

**Herramientas avanzadas del canal y marcadores personales:**
- **Elementos Guardados (*"Para más tarde"* `🔖`)**: A diferencia de "Fijar mensaje" (`📌`, que es público para todos en el canal), el botón **Guardar para más tarde (`🔖`)** guarda cualquier mensaje o documento en su lista personal privada accesible desde la barra lateral izquierda (**`Guardados (Para más tarde)`**).
- **Canvas Colaborativo del Canal (`📝 Canvas`)**: En la esquina superior derecha de cada canal, el botón **`Canvas`** abre un bloc de notas colaborativo sincronizado en tiempo real para registrar acuerdos del expediente, enlaces permanentes o minutas del canal.

> **📌 Ejemplo Práctico 1 — Coordinar la revisión de un escrito en un hilo:**
> 1. La abogada Laura entra al canal **`#litigios-y-casos`**, hace clic en el ícono **`📎`** para adjuntar el PDF del borrador de alegatos y escribe: *"@Carlos por favor revisa la sección de reparaciones antes de las 4:00 p.m."*
> 2. Carlos ve la mención resaltada, pasa el cursor sobre el mensaje de Laura y hace clic en **Responder en hilo (`💬`)**.
> 3. En el panel derecho del hilo, Carlos anota sus observaciones puntuales y reacciona con **`✅`** al mensaje principal cuando termina la revisión.

---

### 3.2. Indicador de Presencia, *"Está escribiendo..."* y Estados de Disponibilidad

El Workspace utiliza **Firebase Realtime Database** con detección instantánea de conexión:
- **Punto Verde (`🟢`)**: Indica que el compañero tiene la Intranet abierta y activa en este momento.
- **Punto Gris (`⚫`)**: Indica que el compañero cerró su sesión o cerró la pestaña del navegador (se actualiza automáticamente en milisegundos).
- **Indicador *"Está escribiendo..."* (`✍️`)**: Cuando uno o varios colegas están redactando un mensaje en el canal o chat directo actual, aparece en vivo encima de la caja de texto quién está escribiendo.

**¿Cómo cambiar su estado de disponibilidad o escribir un estado personalizado?**
En la esquina superior derecha de la barra superior del Workspace, haga clic sobre el botón de estado (por defecto **`🟢 Disponible`**):
1. **Estado personalizado con selector de emoji**:
   - Haga clic en el botón de emoji a la izquierda del campo de texto (por defecto `💬`) para abrir la paleta de 16 emojis institucionales (`💬`, `🏛️`, `📅`, `📝`, `⚖️`, `📚`, `🔎`, `📞`, `💻`, `✈️`, `🚗`, `🍽️`, `☕`, `🎧`, `🔕`, `🌴`).
   - Escriba su estado personalizado en el cuadro de texto (ej. `Audiencia Caso X` o `Revisión de peritaje`) y pulse **`OK`** o la tecla **`Enter`**.
2. O elegir con un clic uno de los estados predeterminados:
   - `🟢 Disponible`
   - `🏛️ En audiencia judicial`
   - `📅 En reunión`
   - `📝 Redactando escrito / Enfoque`
   - `✈️ En misión oficial`
   - `🔕 Plazo fatal / No molestar`
   - `🌴 Ausente / Vacaciones`

Su emoji de estado aparecerá junto a su nombre tanto en la lista de Mensajes Directos como en el encabezado de sus mensajes.

---

### 3.3. Seguimiento de Proyectos y Tareas (Kanban y Lista)

Al hacer clic en la pestaña **`📋 Proyectos y Tareas`** en la barra superior del Workspace, accederá al gestor de proyectos del equipo.

#### Funcionalidades principales:
1. **Conmutador de Vista (Kanban vs. Lista)**:
   - **Tablero Kanban**: Muestra las tareas organizadas visualmente en 4 columnas de flujo de trabajo:
     - `📋 Por Hacer`
     - `⚡ En Curso`
     - `🔍 En Revisión`
     - `✅ Completado`
     Puede mover cualquier tarjeta de una columna a otra con un solo clic usando las flechas **`←` / `→`** en la esquina inferior derecha de la tarjeta.
   - **Vista de Lista**: Muestra todas las tareas en una tabla ejecutiva donde puede cambiar el estado desde un menú desplegable directo.
2. **Filtros por Proyecto y Responsable**:
   - Filtre por área (*Litigios Estratégicos & CIDH*, *Gestión Operativa & Finanzas*, *Comunicación & Portal Web*, o cree proyectos nuevos con el botón **`+ Nuevo Proyecto`**).
   - Use el selector de responsables y elija **`👤 Mis tareas asignadas`** para ver únicamente sus pendientes personales.
3. **Checklist de Subtareas con Barra de Progreso**:
   - Cada tarea puede desglosarse en pasos o subtareas. Al hacer clic sobre una tarjeta y marcar las casillas completadas, la barra de porcentaje (`%`) se actualiza en tiempo real para todo el equipo.

> **📌 Ejemplo Práctico 2 — Crear una tarea con plazo fatal, subtareas y vínculo a Drive:**
> 1. En la pestaña **`Proyectos y Tareas`**, haga clic en **`+ Nueva Tarea`**.
> 2. **Título**: *"Presentación de peritaje psicológico - Caso Corte IDH"*.
> 3. **Proyecto**: *Litigios Estratégicos & CIDH* | **Prioridad**: *🚨 Urgente / Plazo Fatal*.
> 4. **Responsables**: Seleccione a los abogados encargados y defina la **Fecha límite**.
> 5. En **Subtareas**, agregue: *"1. Validar firma del perito"*, *"2. Anexar traducción oficial"*, *"3. Foliar PDF final"*.
> 6. Haga clic en **`Elegir directamente desde Google Drive`** para seleccionar el borrador o carpeta desde su unidad institucional `@iiresodh.org` (sin necesidad de copiar ni pegar enlaces), elija anunciar en el canal **`#litigios-y-casos`** y active **Agendar fecha en Calendario**.
> 7. Al pulsar **Crear Tarea**, la tarjeta aparece en el tablero Kanban, la fecha queda agendada en el Calendario Institucional y el canal `#litigios-y-casos` recibe automáticamente una tarjeta interactiva mencionando a los responsables.

---

### 3.4. Calendario Privado y Agenda Propia de la Plataforma

Al seleccionar la pestaña **`📅 Calendario & Agenda`**, accederá al calendario oficial, autónomo y 100% interno de la Intranet de IIRESODH.

#### Seguridad y Privacidad del Calendario Propio:
- **Almacenamiento 100% interno en Firestore (`workspace_eventos`)**: Todos los plazos fatales, audiencias y reuniones se almacenan exclusivamente dentro del perímetro de seguridad de la Intranet (sin exponer datos en cuentas generales de correo como `contacto@iiresodh.org`).
- **Control de Confidencialidad (`Evento Confidencial 🔒`)**: Al crear o editar un evento, puede activar la opción **"Evento Confidencial (Solo participantes convocados)"**. Cuando está activa, el evento lleva el distintivo `🔒 Confidencial` y **únicamente es visible** para quien lo creó, los miembros convocados en la lista de participantes y el Superadmin.
- **Filtro de Alcance (`Agenda del Equipo` vs. `👤 Mis convocatorias`)**: En la barra superior del calendario puede alternar entre ver toda la agenda general del equipo o filtrar únicamente las audiencias y reuniones en las que usted participa.
- **Copia opcional al calendario personal**: Dentro del detalle de cualquier evento dispone del botón **`Guardar copia en mi Google Calendar personal`**, que abre su propia cuenta `@iiresodh.org` por si desea agendar un recordatorio individual en su teléfono sin compartir información fuera de su cuenta.

#### Categorías de Eventos:
- 🟥 **Audiencia Judicial / CIDH**
- 🟧 **Plazo Fatal / Vencimiento**
- 🟦 **Reunión de Equipo**
- 🟦 **Evento Institucional**
- 🟩 **Recordatorio Interno**

> **📌 Ejemplo Práctico 3 — Agendar una audiencia confidencial con sala oficial de Google Meet y notificar en un canal:**
> 1. Haga clic sobre el día deseado en la cuadrícula del calendario (o pulse el botón **`+ Agendar Evento`**).
> 2. Escriba el título *"Audiencia Pública - Caso Empleados vs. Estado"*, seleccione la categoría **Audiencia Judicial / CIDH** y defina la hora de inicio y finalización.
> 3. Junto al campo **Ubicación**, haga clic en el botón **`📹 Generar Google Meet`**: el sistema creará al instante un enlace oficial `https://meet.google.com/xxx-xxxx-xxx` bajo su cuenta `@iiresodh.org` y lo colocará automáticamente en la ubicación. Seleccione luego a los **Participantes convocados del equipo**.
> 4. Si se trata de una reunión sensible de estrategia, active el interruptor **`Evento Confidencial (Solo participantes convocados)`**; o déjelo abierto para todo el equipo y seleccione anunciar en **`#litigios-y-casos`**.
> 5. Haga clic en **Agendar Evento**. El evento quedará resguardado inmediatamente en el calendario propio de la plataforma y al abrir su detalle cualquier participante verá el botón verde **`📹 Unirse a Google Meet`**.

---

### 3.5. Biblioteca y Visor Integrado de Google Drive

La pestaña **`📁 Google Drive`** conecta el Workspace con los documentos y carpetas de Google Workspace (`@iiresodh.org`) del equipo.

#### Capacidades principales:
1. **Creación rápida en Google Workspace**: En la esquina superior derecha dispone de botones directos para **`Abrir Mi Google Drive`**, crear un **`Nuevo Doc`** (Google Docs) o un **`Nuevo Sheet`** (Hojas de cálculo) forzando automáticamente su cuenta institucional `@iiresodh.org`.
2. **Explorador y Selector Directo de Google Drive (Sin copiar ni pegar rutas)**:
   - Haga clic en **`+ Vincular Archivo / Carpeta de Drive`**.
   - Dentro de la ventana verá el **Explorador Directo de Google Drive**, donde puede navegar por **`Mi Unidad`**, **`Compartidos conmigo`**, **`Unidades compartidas`** y **`Recientes`**, o buscar en tiempo real por nombre.
   - Puede abrir carpetas para navegar por sus subcarpetas y hacer clic en **`Elegir carpeta`** (para vincular la carpeta completa) o **`Elegir`** sobre cualquier documento individual; el sistema rellena automáticamente el nombre, el enlace oficial y el tipo de recurso.
   - Si lo prefiere, también puede pegar manualmente un enlace externo en el campo inferior.
3. **Visor y Editor Embebido (Sin salir de la Intranet)**:
   - Al hacer clic en el botón **`👁️ Vista Previa`** de cualquier documento de la biblioteca (o desde una tarjeta de Drive compartida en el chat o en una tarea), se abre un **visor integrado en pantalla dividida** dentro del mismo Workspace.
   - Si es un Google Doc, Sheet o Slide, puede alternar arriba entre **`Vista Lectura`** y **`Modo Edición`** para trabajar sobre el documento en tiempo real mientras conversa con su equipo.
4. **Fijar Favoritos (`⭐`) y Compartir en Canales (`✈️`)**:
   - Pulse la estrella **`⭐`** en las carpetas o matrices más usadas para que aparezcan siempre de primeras y bajo el filtro **`⭐ Fijados`**.
   - Pulse el ícono de enviar **`✈️`** para compartir una tarjeta de acceso directo al documento en el chat.

---

### 3.6. Videollamadas Nativas con Google Meet (Por Canal, Mensajes Directos, Calendario y Salas Externas)

El Workspace está conectado de forma nativa con **Google Meet REST API v2**, permitiendo abrir salas oficiales `https://meet.google.com/xxx-xxxx-xxx` donde el usuario autenticado `@iiresodh.org` entra automáticamente como **Anfitrión (*Host*)**:

1. **Salas en Vivo dentro de Canales y Mensajes Directos (1 a 1)**:
   - En la cabecera superior derecha de cualquier canal (`#general`, `#litigios-y-casos`, canales privados 🔒) o conversación directa, haga clic en el botón **`📹 Iniciar Meet`** (o escriba el comando rápido `/meet [tema]` en la caja de mensajes, por ejemplo: `/meet Coordinación urgente CIDH`).
   - El sistema genera un espacio real de Google Meet en menos de 1 segundo, publica automáticamente una **Tarjeta Interactiva de Videollamada** en el canal y despliega una **Barra Verde en Tiempo Real de Sala en Curso** en la parte superior del canal (además de un ícono verde `📹` junto al nombre del canal en la barra lateral izquierda).
   - Cualquier miembro del canal puede pulsar **`Unirse ahora`** (que fuerza automáticamente el uso de su cuenta institucional `@iiresodh.org`), **`Copiar enlace`** o **`Finalizar sala`** cuando concluya la llamada.
2. **Salas de Google Meet Fuera de los Canales (Para Reuniones Externas, Testigos, Peritos o Clientes)**:
   - En la barra superior oscura del Workspace dispone siempre del botón verde **`📹 Sala Meet`**.
   - Al pulsarlo se abre el generador de **Sala Instantánea de Google Meet**, ideal para reuniones con personas externas al Instituto sin necesidad de publicarlas en un canal.
   - Escriba el asunto de la reunión y haga clic en **`Generar enlace oficial de Google Meet`**: obtendrá al instante el enlace `https://meet.google.com/xxx-xxxx-xxx` con botones de un clic para **`Entrar a la Sala Meet`**, **`Copiar enlace para invitados`** (para enviarlo por WhatsApp o correo) o publicarlo opcionalmente en un canal.
3. **Generación de Sala Google Meet en Eventos del Calendario**:
   - Al crear o editar cualquier evento o audiencia en **`Calendario & Agenda`**, pulse el botón **`📹 Generar Google Meet`** situado junto al campo de ubicación para adjuntar una sala única al evento.

---

## 4. Módulo: Centro de Recursos Institucionales

Accesible desde la primera tarjeta de módulos del Hub Central o desde el menú lateral izquierdo. Está organizado en dos pestañas:

1. **📖 Reglamentos & Normativas Internas**:
   - Contiene los reglamentos internos de trabajo, políticas institucionales, códigos de ética, manuales operativos y protocolos jurídicos en formato PDF/documento.
2. **🎨 Material Gráfico & Identidad Visual**:
   - Contiene los logotipos oficiales de IIRESODH, isotipos en alta resolución, manual de identidad corporativa, banners y plantillas oficiales.

**Acciones disponibles para todos los usuarios:**
- **Buscar y filtrar** por categoría (Logos, Isotipos, Reglamentos, Protocolos, etc.).
- **Descargar (`⬇️`)** el archivo original a su equipo.
- **Copiar enlace directo (`🔗`)** al portapapeles o abrirlo en una pestaña nueva.

**Subida de nuevos recursos (Exclusivo `Admin` y `Superadmin`):**
- Haga clic en **`+ Subir Recurso Institucional`**, elija la sección (*Reglamento* o *Material Gráfico*), seleccione la categoría, asigne un título descriptivo y adjunte el archivo.

---

## 5. Módulo: Gestión de Litigios y Expedientes Jurídicos

Es el núcleo procesal de la Intranet para la administración de casos colectivos e individuales llevados por IIRESODH.

### 5.1. Creación y Administración de Casos
Al ingresar a **Gestión de Litigios**, verá las tarjetas de todos los expedientes registrados con su estado (*Activo*, *Suspendido*, *Cerrado*, *Archivado*) y el contador en tiempo real de representados inscritos.
- Para registrar un nuevo litigio, haga clic en **`+ Nuevo Caso / Litigio`**, ingrese el nombre oficial del expediente y una descripción procesal.
- Para entrar a trabajar en un expediente, haga clic en **`Ver Expediente / Representados`**.

### 5.2. Gestión de Representados y Ficha Individual
Dentro del detalle de un caso, la primera pestaña muestra el padrón completo de **Representados (Clientes)**:
- **Buscador instantáneo**: Localice a cualquier representado por nombre, apellidos, número de identificación o correo electrónico.
- **Agregar Representado (`+ Nuevo Representado`)**: Permite registrar nombre completo, tipo y número de documento de identidad, país de residencia, teléfono con prefijo internacional, correo electrónico principal y estado de pago.
- **Ficha Individual del Representado (`👁️ Ver Ficha`)**: Al abrir el expediente individual de una persona representada, podrá gestionar:
  1. **Datos Personales y de Contacto** (editables en cualquier momento).
  2. **Estado Financiero / Conciliación Stripe**: Control de estado de pago y notas de facturación.
  3. **Poderes y Documentos Individuales**: Subida de poderes especiales firmados, documentos de identidad y pruebas específicas de ese representado.
  4. **Notas Internas del Expediente**: Bitácora cronológica de seguimiento jurídico de ese cliente.
  5. **Historial de Comunicados Recibidos**: Trazabilidad exacta de todos los correos oficiales enviados al representado y su estado de lectura.

### 5.3. Plazos Fatales y Documentos del Expediente
En las pestañas superiores del caso encontrará:
- **⏳ Plazos y Fechas Fatales**: Registro de vencimientos procesales con **alertas semafóricas automáticas** (Rojo para plazos vencidos o inminentes, Amarillo para próximos a vencer, Verde para plazos holgados o cumplidos).
- **📂 Documentos y Pruebas del Caso**: Repositorio centralizado en la nube para resoluciones judiciales, escritos presentados, peritajes y anexos probatorios comunes a todo el expediente.

### 5.4. Comunicados Masivos y Trazabilidad de Entrega y Apertura
La pestaña **📧 Comunicados Enviados** permite redactar y enviar circulares y notificaciones oficiales por correo electrónico a todos los representados de un caso (o a una selección específica de ellos) directamente desde la cuenta institucional **`contacto@iiresodh.org`** mediante **Google Workspace (Gmail API)** y **Cloud Functions (2nd Gen)**:
1. **Redacción y Documento Adjunto (PDF)**:
   - Haga clic en **`+ Redactar Comunicado`**, defina el asunto, el cuerpo del mensaje y adjunte opcionalmente el documento PDF oficial de la circular (que queda almacenado de forma segura en Firebase Storage y se adjunta en el correo).
2. **Selección de Destinatarios**:
   - Puede enviar el comunicado a **Todos los representados** del caso o elegir **Selección específica** para filtrar y marcar únicamente a determinados destinatarios.
3. **Prueba de Entrega y Lectura en Tiempo Real (Dos Vistas)**:
   - **A. En la pestaña *Comunicados Enviados* (Vista Global y Tabla por Destinatario)**:
     - Cada comunicado muestra en la esquina superior derecha la insignia **`Despachado`** una vez procesado el envío.
     - Al hacer clic en el botón **`Ver estado por destinatario (Entregados / Abiertos)`**, se despliega un panel con los contadores globales (`Recibidos: X/N`, `Abiertos: Y/N` y `Rebotes`), un botón **`Actualizar estado`** y una tabla detallada con cada representado, su correo, su estado actual y las marcas exactas de fecha y hora de **Recibido (Entrega)** y **Abierto (Lectura)**.
   - **B. En la *Ficha Individual del Representado* (*Historial de Notificaciones*)**:
     - En la columna derecha de la ficha de cada cliente se listan todos los comunicados que se le han enviado con sus estados en tiempo real (incluyendo filtros contra aperturas automáticas de escáneres corporativos):
       - **`Enviado`** / **`Entregado`** (con fecha y hora exacta de recepción `Recibido: DD/MM/AAAA, HH:MM:SS`).
       - **`Abierto`** (en verde, con fecha y hora exacta de Costa Rica en que el representado abrió y leyó el comunicado).
       - **`Rebotado`** (en rojo, con el detalle técnico en caso de que la dirección de correo presente un fallo).

---

## 6. Módulo: Mensajería Oficial WhatsApp Business API

Disponible para usuarios con permiso habilitado de WhatsApp y Administradores. Conecta la Intranet directamente con el número oficial institucional de WhatsApp Business de IIRESODH a través de la API Cloud de Meta.

### Funcionalidades paso a paso:
1. **Bandeja de Entrada Multiagente en Tiempo Real**:
   - A la izquierda se listan todas las conversaciones activas ordenadas por el mensaje más reciente, con contador de mensajes no leídos.
   - Varios miembros autorizados del equipo pueden atender consultas simultáneamente desde la Intranet sin depender de un teléfono físico.
2. **Confirmaciones de Entrega y Lectura de Meta (`✓` / `✓✓`)**:
   - Cada mensaje enviado desde la Intranet muestra el reloj de envío, doble check de entregado y doble check azul cuando el ciudadano o representado lo lee en su WhatsApp.
3. **Iniciar Nueva Conversación / Editar Contacto**:
   - Use el botón **`+`** para iniciar un chat ingresando el código de país y número telefónico, y asigne o edite el nombre identificativo del contacto para reconocerlo fácilmente en la lista.

---

## 7. Módulo: Administración del Sitio Web Público

Disponible para usuarios con permiso de administración web (`acceso_web`) y Administradores. Permite actualizar en tiempo real el portal público de IIRESODH (`iiresodh-web`) sin conocimientos de programación:
- **Publicación de Noticias, Artículos y Pronunciamientos** con soporte multilingüe (Español, Inglés, Francés).
- **Editor de Texto Enriquecido (*Rich Text Editor*)**: Formato de encabezados, negritas, listas, citas, enlaces e inserción de imágenes o videos.
- **Carga automática de imágenes de portada y galerías** optimizadas en Firebase Storage.

---

## 8. Administración de Seguridad: Usuarios y Auditoría

En la parte inferior del Hub Central, los usuarios con rol **Admin** o **Superadmin** visualizan la sección **Controles de Seguridad del Sistema**:

### 8.1. Control de Usuarios Autorizados (`Admin` y `Superadmin`)
Permite gestionar quiénes tienen permiso para entrar a la Intranet:
1. Haga clic en **`+ Autorizar Nuevo Usuario`**.
2. Ingrese el **Nombre completo** del colaborador y su **Correo institucional (`@iiresodh.org`)**.
3. Seleccione su **Rol Operativo** (`Abogado/a`, `Administrativo`, o `Admin` si usted es Superadmin).
4. Active las casillas opcionales si esa persona debe tener acceso al módulo de **Sitio Web** o a la consola de **WhatsApp Business**.
5. También puede modificar permisos o revocar el acceso de un usuario existente en cualquier momento con efecto inmediato.

### 8.2. Bitácora de Auditoría Forense - Logs (Exclusivo `Superadmin`)
Registra de manera inmutable todas las operaciones sensibles realizadas dentro de la Intranet:
- Inicios y cierres de sesión exitosos.
- Intentos de acceso bloqueados (cuentas externas o cuentas `@iiresodh.org` no autorizadas).
- Creación, modificación o eliminación de casos, representados, eventos del calendario, recursos institucionales y cambios en permisos de usuarios, indicando **fecha, hora exacta, usuario ejecutor y detalle de la acción**.

---

## 9. Atajos de Teclado y Preguntas Frecuentes (FAQ)

### Atajos Rápidos en el Workspace
| Atajo / Acción | Función |
| :--- | :--- |
| **`Enter`** (en caja de mensaje) | Envía el mensaje inmediatamente al canal o hilo activo. |
| **`Shift + Enter`** | Inserta un salto de línea dentro del mensaje sin enviarlo aún. |
| **`Escape (Esc)`** | Sale del modo de Pantalla Completa del Workspace y regresa al Hub Central. |
| **`*texto*`** | Convierte el texto entre asteriscos en **negrita** al enviarlo. |
| **`` `texto` ``** | Muestra el texto resaltado como etiqueta o cita técnica. |
| **`@Nombre`** | Resalta la mención a un compañero del equipo dentro del mensaje. |

### Preguntas Frecuentes (FAQ)

**1. ¿Por qué un compañero intenta entrar con su correo `@iiresodh.org` y el sistema le dice "Acceso restringido"?**  
Porque por seguridad perimetral no basta con tener un correo del dominio; un Administrador debe ir a **Control de Usuarios Autorizados** y registrar su correo en la lista blanca asignándole un rol operativo.

**2. ¿Cómo sé si un compañero está realmente conectado en este momento?**  
En la lista de **Mensajes Directos** del Workspace, mire el círculo junto a su foto/avatar: si está en **verde (`🟢`)**, tiene la Intranet abierta en vivo; si cierra su navegador o cierra sesión, pasa a **gris (`⚫`)** de forma instantánea.

**3. ¿Puedo ver o editar un documento de Google Drive sin salir del chat de la Intranet?**  
Sí. Vaya a la pestaña **`📁 Google Drive`** dentro del Workspace (o haga clic en **`Vista Previa Drive`** sobre cualquier documento compartido en un canal o tarea) y se abrirá el visor lateral integrado donde puede leerlo o cambiar a **`Modo Edición`**.

**4. ¿Qué ocurre si agendo una audiencia en el Calendario del Workspace?**  
Queda resguardada de forma 100% privada e interna dentro del calendario propio de la plataforma (sin exponerse en cuentas externas como `contacto@iiresodh.org`). Además, puede marcarla como **`Evento Confidencial 🔒`** para que solo los participantes convocados la vean, o anunciarla automáticamente en un canal del equipo.
