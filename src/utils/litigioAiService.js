import { getAI, getGenerativeModel, VertexAIBackend, GoogleAIBackend } from 'firebase/ai';
import { httpsCallable } from 'firebase/functions';
import { app, functions } from '../config/firebase';
import { obtenerTokenGoogleDriveActivo, solicitarTokenGoogleDrive } from '../context/AuthContext';

/**
 * JERARQUÍA OFICIAL DE MODELOS PIDA — IIRESODH LITIGIO INTERNACIONAL
 */
export const MODELOS_LITIGIO_IA = {
  deep: {
    id: 'gemini-4-argon',
    label: 'PIDA (Razonamiento Jurídico Avanzado)',
    badge: '🧠 PIDA · Razonamiento Jurídico Avanzado',
    descripcion: 'Estrategia jurídica interamericana/ONU, admisibilidad (Arts. 46-47 CADH), fondo, medidas cautelares y análisis complejo de sentencias.',
    fallbacks: ['gemini-3.8-flash', 'gemini-2.5-pro']
  },
  secondary: {
    id: 'gemini-3.8-flash',
    label: 'PIDA (Análisis Multimodal)',
    badge: '⚡ PIDA · Análisis Multimodal',
    descripcion: 'Lectura multimodal de resoluciones PDF, verificación OCR de poderes/cédulas, extracción de plazos fatales y síntesis de expedientes.',
    fallbacks: ['gemini-3.5-flash-lite', 'gemini-2.5-flash']
  },
  simple: {
    id: 'gemini-3.5-flash-lite',
    label: 'PIDA (Auditoría Rápida)',
    badge: '🚀 PIDA · Auditoría Rápida',
    descripcion: 'Auditoría rápida de padrón (Art. 35 Corte IDH), redacción ágil en lenguaje claro, clasificación de anexos y ajustes de tono.',
    fallbacks: ['gemini-3.8-flash', 'gemini-2.5-flash-lite']
  }
};

export const MODELO_PENSAMIENTO_AVANZADO = MODELOS_LITIGIO_IA.deep.id;
export const MODELO_SECUNDARIO_MULTIMODAL = MODELOS_LITIGIO_IA.secondary.id;
export const MODELO_TAREAS_SIMPLES = MODELOS_LITIGIO_IA.simple.id;

const SYSTEM_PROMPT_LITIGIO_INTERNACIONAL = `Eres PIDA, el sistema de Inteligencia Jurídica en Derecho Internacional de los Derechos Humanos del IIRESODH.
Dominas a la perfección:
1. La Convención Americana sobre Derechos Humanos (CADH), el Protocolo de San Salvador y demás instrumentos interamericanos.
2. El Reglamento de la Comisión Interamericana de Derechos Humanos (CIDH) — en especial admisibilidad (Arts. 31-34), excepciones al agotamiento de recursos internos (Art. 46.2 CADH), medidas cautelares (Art. 25), tramitación prioritaria (Art. 29.2) y soluciones amistosas (Art. 40).
3. El Reglamento de la Corte Interamericana de Derechos Humanos (Corte IDH) — en especial el requisito del Art. 35 (identificación precisa y padrón único de presuntas víctimas), ESAP (Art. 40), medidas provisionales (Art. 63.2 CADH) y reparaciones integrales (Art. 63.1 CADH).
4. Los Procedimientos Especiales y Órganos de Tratados de Naciones Unidas (Comité de Derechos Humanos, CEDAW, Comité contra la Tortura, etc.).

Reglas de estilo y rigor:
- Responde siempre en español jurídico riguroso, estructurado y claro.
- Nunca inventes hechos del expediente que no estén en el contexto suministrado; cuando falte un dato fáctico o probatorio, señálalo expresamente como "[Pendiente de acreditar en el expediente]".
- Cita los artículos exactos de la CADH, Reglamentos CIDH/Corte IDH y estándares jurisprudenciales reales aplicables.`;

/**
 * Convierte un objeto File/Blob o una URL remota en una parte inlineData base64 para multimodalidad.
 */
export async function fileOrUrlToInlinePart(fileOrBlob, fileUrl = null, explicitMimeType = null) {
  let blob = fileOrBlob;
  if (!blob && fileUrl) {
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`No se pudo descargar el archivo para análisis multimodal (${response.status})`);
    }
    blob = await response.blob();
  }
  if (!blob) return null;

  const mimeType = explicitMimeType || blob.type || 'application/pdf';
  const base64Data = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result || '';
      const base64 = typeof result === 'string' && result.includes(',') ? result.split(',')[1] : '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  return {
    inlineData: {
      data: base64Data,
      mimeType
    }
  };
}

/**
 * Obtiene la lista ordenada de modelos e instancias de backend Firebase AI Logic (Vertex AI primero, luego Google AI Backend).
 */
function construirCandidatosEjecucion(tier = 'deep', modelOverride = null) {
  const tierConfig = MODELOS_LITIGIO_IA[tier] || MODELOS_LITIGIO_IA.deep;
  const primario = modelOverride || tierConfig.id;
  const cadenaModelos = [primario, ...(tierConfig.fallbacks || [])].filter(
    (m, idx, arr) => Boolean(m) && arr.indexOf(m) === idx
  );

  const backends = [
    { nombre: 'Vertex AI (global)', instancia: new VertexAIBackend('global') },
    { nombre: 'Vertex AI (us-central1)', instancia: new VertexAIBackend('us-central1') },
    { nombre: 'Google GenAI (Firebase AI Logic)', instancia: new GoogleAIBackend() }
  ];

  return { cadenaModelos, backends, tierConfig };
}

/**
 * Ejecuta una consulta en Firebase AI Logic respetando la jerarquía de modelos (Gemini 4 Argon / 3.8 Flash / 3.5 Flash-Lite)
 * sin exponer llaves de API en el navegador.
 */
export async function ejecutarConsultaJuridicaIA({
  prompt,
  systemInstruction = SYSTEM_PROMPT_LITIGIO_INTERNACIONAL,
  tier = 'deep',
  modelOverride = null,
  inlineParts = [],
  temperature = 0.25
}) {
  const { cadenaModelos, backends, tierConfig } = construirCandidatosEjecucion(tier, modelOverride);
  const errores = [];
  const modeloPrimario = modelOverride || tierConfig.id;

  // 1. Si el modelo solicitado es Gemini 4 Argon (Pensamiento Avanzado), invocamos primero
  //    el endpoint seguro de Vertex AI Enterprise (Cloud Function autenticada sin exponer API keys)
  //    para garantizar la ejecución directa de gemini-4-argon en aiplatform.googleapis.com.
  if (modeloPrimario === 'gemini-4-argon') {
    try {
      const fnVertex = httpsCallable(functions, 'consultarVertexLitigioIA');
      const resCallable = await fnVertex({
        prompt,
        systemInstruction,
        model: 'gemini-4-argon',
        inlineParts,
        temperature
      });
      if (resCallable?.data?.text) {
        return {
          text: resCallable.data.text.trim(),
          modeloSolicitado: modeloPrimario,
          modeloEjecutado: resCallable.data.modeloEjecutado || 'gemini-4-argon',
          backendUtilizado: resCallable.data.backendUtilizado || 'Vertex AI Enterprise (aiplatform.googleapis.com)',
          badge: MODELOS_LITIGIO_IA.deep.badge
        };
      }
    } catch (errCallable) {
      errores.push(`[Vertex Cloud Function gemini-4-argon]: ${errCallable?.message || String(errCallable)}`);
    }
  }

  const contents = [];
  if (Array.isArray(inlineParts) && inlineParts.length > 0) {
    inlineParts.forEach((p) => {
      if (p) contents.push(p);
    });
  }
  contents.push(prompt);

  // 2. Ejecución vía Firebase AI Logic SDK (VertexAIBackend global -> GoogleAIBackend)
  for (const modeloId of cadenaModelos) {
    for (const backendObj of backends) {
      try {
        const ai = getAI(app, { backend: backendObj.instancia });
        const model = getGenerativeModel(ai, {
          model: modeloId,
          systemInstruction,
          generationConfig: {
            temperature
          }
        });

        const result = await model.generateContent(contents);
        const text = result?.response?.text ? result.response.text() : '';
        if (text && text.trim().length > 0) {
          return {
            text: text.trim(),
            modeloSolicitado: modeloPrimario,
            modeloEjecutado: modeloId,
            backendUtilizado: backendObj.nombre,
            badge:
              modeloId === 'gemini-4-argon'
                ? MODELOS_LITIGIO_IA.deep.badge
                : modeloId === 'gemini-3.8-flash'
                ? MODELOS_LITIGIO_IA.secondary.badge
                : MODELOS_LITIGIO_IA.simple.badge
          };
        }
      } catch (err) {
        errores.push(`[${modeloId} @ ${backendObj.nombre}]: ${err?.message || String(err)}`);
      }
    }
  }

  // 3. Respaldo final vía Cloud Function Vertex AI para cualquier otro modelo
  try {
    const fnVertexFallback = httpsCallable(functions, 'consultarVertexLitigioIA');
    const resFallback = await fnVertexFallback({
      prompt,
      systemInstruction,
      model: modeloPrimario,
      inlineParts,
      temperature
    });
    if (resFallback?.data?.text) {
      return {
        text: resFallback.data.text.trim(),
        modeloSolicitado: modeloPrimario,
        modeloEjecutado: resFallback.data.modeloEjecutado || modeloPrimario,
        backendUtilizado: resFallback.data.backendUtilizado || 'Vertex AI Enterprise',
        badge: tierConfig.badge
      };
    }
  } catch (errFinal) {
    errores.push(`[Vertex Fallback]: ${errFinal?.message || String(errFinal)}`);
  }

  throw new Error(
    `No fue posible completar la consulta en Firebase AI Logic / Vertex AI. Detalles técnicos: ${errores.slice(0, 2).join(' | ')}`
  );
}

/**
 * Extrae un objeto JSON limpio desde la respuesta de texto del modelo.
 */
function parsearJsonSeguro(texto) {
  if (!texto) return null;
  const limpio = texto
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();
  const inicio = limpio.indexOf('{');
  const fin = limpio.lastIndexOf('}');
  if (inicio !== -1 && fin !== -1 && fin > inicio) {
    try {
      return JSON.parse(limpio.slice(inicio, fin + 1));
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * 1. ANALIZADOR MULTIMODAL DE PIEZAS PROCESALES Y DETECTOR DE PLAZOS FATALES
 * Utiliza Gemini 3.8 Flash por defecto (o Gemini 4 Argon si el usuario elige análisis profundo).
 */
export async function analizarPiezaProcesalIA({
  file = null,
  fileUrl = null,
  mimeType = null,
  nombreArchivo = 'Documento Procesal',
  contextoCaso = {},
  usarPensamientoAvanzado = false
}) {
  const inlinePart = await fileOrUrlToInlinePart(file, fileUrl, mimeType);
  const tier = usarPensamientoAvanzado ? 'deep' : 'secondary';

  const prompt = `Analiza la pieza procesal adjunta ("${nombreArchivo}") correspondiente al caso "${contextoCaso.nombre || 'Litigio Internacional'}" (Jurisdicción: ${contextoCaso.jurisdiccion || 'Por definir'}, Expediente: ${contextoCaso.expediente_oficial || 'S/N'}, Estado demandado: ${contextoCaso.estado_demandado || 'No especificado'}).

Devuelve EXCLUSIVAMENTE un objeto JSON válido con la siguiente estructura exacta (sin texto adicional fuera del JSON):
{
  "categoria_sugerida": "Una de: Escrito IIRESODH | Resolución / Notificación Tribunal | Contestación del Estado | Peritaje / Amicus Curiae | Anexo Probatorio",
  "resumen_ejecutivo": "Síntesis jurídica clara de 3 a 5 líneas sobre el contenido y alcance procesal del documento.",
  "puntos_clave": [
    "Punto resolutivo o argumento central 1",
    "Punto resolutivo o argumento central 2",
    "Punto resolutivo o argumento central 3"
  ],
  "tiene_plazo_fatal": true,
  "fecha_vencimiento_sugerida": "YYYY-MM-DD (si el documento menciona o permite deducir una fecha límite o plazo en días/meses a partir de su notificación; si no existe plazo, devuelve cadena vacía \"\")",
  "titulo_plazo_sugerido": "Ej: Presentar observaciones de fondo / Cumplir prevención CIDH (o vacío si no aplica)",
  "riesgo_procesal": "Alto | Medio | Informativo",
  "recomendacion_estrategica": "Acción inmediata recomendada al equipo legal del IIRESODH."
}`;

  const respuesta = await ejecutarConsultaJuridicaIA({
    prompt,
    tier,
    inlineParts: inlinePart ? [inlinePart] : [],
    temperature: 0.15
  });

  const parsed = parsearJsonSeguro(respuesta.text);
  return {
    ...(parsed || {
      categoria_sugerida: 'Resolución / Notificación Tribunal',
      resumen_ejecutivo: respuesta.text,
      puntos_clave: [],
      tiene_plazo_fatal: false,
      fecha_vencimiento_sugerida: '',
      titulo_plazo_sugerido: '',
      riesgo_procesal: 'Medio',
      recomendacion_estrategica: 'Verificar manualmente los plazos de notificación.'
    }),
    _metaIA: {
      modeloSolicitado: respuesta.modeloSolicitado,
      modeloEjecutado: respuesta.modeloEjecutado,
      backendUtilizado: respuesta.backendUtilizado,
      badge: respuesta.badge
    }
  };
}

/**
 * 2. VERIFICADOR MULTIMODAL OCR DE CÉDULA / PASAPORTE / PODER DE REPRESENTACIÓN
 * Utiliza Gemini 3.8 Flash (modelo secundario multimodal).
 */
export async function extraerDatosIdentificacionIA({
  file = null,
  fileUrl = null,
  mimeType = null,
  nombreArchivo = 'Documento'
}) {
  const inlinePart = await fileOrUrlToInlinePart(file, fileUrl, mimeType);
  if (!inlinePart) {
    throw new Error('Debes adjuntar una imagen o PDF legible de la identificación o poder.');
  }

  const prompt = `Examina multimodalmente este documento ("${nombreArchivo}") subido al expediente de un representado ante el IIRESODH.
Identifica si se trata de un documento de identidad (cédula, DNI, pasaporte), un poder de representación legal / carta de autorización, o prueba documental, y extrae sus datos con precisión.

Devuelve EXCLUSIVAMENTE un objeto JSON válido con esta estructura exacta:
{
  "tipo_documento_detectado": "Identificación Oficial | Poder de Representación | Prueba Documental | Otro",
  "nombres": "Nombres de pila extraídos (o vacío si no aparece)",
  "apellidos": "Apellidos extraídos (o vacío si no aparece)",
  "nombre_completo": "Nombre y apellidos completos extraídos (o vacío si no aparece)",
  "tipo_identificacion": "Cédula de Identidad | DNI | Pasaporte | Cédula de Residencia | Otro",
  "identificacion": "Número de cédula, DNI o pasaporte extraído sin espacios innecesarios (o vacío si no aparece)",
  "pais": "País emisor o de residencia detectado (ej. Costa Rica, Colombia, etc.)",
  "es_identificacion_legible": true,
  "es_poder_firmado": false,
  "es_prueba_dano": false,
  "condicion_vulnerabilidad_sugerida": "Una de: Ninguna | Adulto Mayor | Discapacidad | Pueblo Indígena / Afrodescendiente | Jefa de Hogar | Salud Crítica | NNA (según fecha de nacimiento o datos del documento)",
  "observaciones_verificacion": "Breve dictamen de verificación (ej. Cédula vigente y legible, Poder cuenta con firma visible de la víctima, o Prueba documental de daño/afectación)."
}`;

  const respuesta = await ejecutarConsultaJuridicaIA({
    prompt,
    tier: 'secondary',
    inlineParts: [inlinePart],
    temperature: 0.1
  });

  const parsed = parsearJsonSeguro(respuesta.text);
  return {
    ...(parsed || {
      tipo_documento_detectado: 'Identificación Oficial',
      nombre_completo: '',
      documento_identidad: '',
      pais_nacionalidad: '',
      es_identificacion_legible: true,
      es_poder_firmado: false,
      condicion_vulnerabilidad_sugerida: 'Ninguna',
      observaciones_verificacion: respuesta.text
    }),
    _metaIA: {
      modeloSolicitado: respuesta.modeloSolicitado,
      modeloEjecutado: respuesta.modeloEjecutado,
      backendUtilizado: respuesta.backendUtilizado,
      badge: respuesta.badge
    }
  };
}

/**
 * 3. AUDITOR IA DEL PADRÓN DE VÍCTIMAS (ART. 35 REGLAMENTO CORTE IDH)
 * Utiliza Gemini 3.5 Flash-Lite (tareas simples y rápidas) combinado con validación determinista.
 */
export async function auditarPadronArt35IA({ clientes = [], caso = {} }) {
  const total = clientes.length;
  const sinPoder = clientes.filter((c) => !c.tiene_poder);
  const sinId = clientes.filter((c) => !c.tiene_documento_id);
  const sinPruebaDano = clientes.filter((c) => !c.tiene_prueba_dano);
  const sinCorreo = clientes.filter((c) => !c.correo_principal || !c.correo_principal.includes('@'));
  const conVulnerabilidad = clientes.filter(
    (c) => c.condicion_vulnerabilidad && c.condicion_vulnerabilidad !== 'Ninguna'
  );

  const conteoCedulas = {};
  clientes.forEach((c) => {
    const idNorm = (c.identificacion || c.documento_identidad || '').trim().toUpperCase();
    if (idNorm) conteoCedulas[idNorm] = (conteoCedulas[idNorm] || 0) + 1;
  });
  const cedulasDuplicadas = Object.entries(conteoCedulas)
    .filter(([, count]) => count > 1)
    .map(([id]) => id);

  const porcentajeListos =
    total > 0
      ? Math.round(
          (clientes.filter((c) => c.tiene_poder && c.tiene_documento_id).length / total) * 100
        )
      : 0;

  const estadisticas = {
    total,
    listosArt35: clientes.filter((c) => c.tiene_poder && c.tiene_documento_id).length,
    porcentajeListos,
    sinPoderCount: sinPoder.length,
    sinIdCount: sinId.length,
    sinPruebaDanoCount: sinPruebaDano.length,
    sinCorreoCount: sinCorreo.length,
    vulnerablesCount: conVulnerabilidad.length,
    cedulasDuplicadas
  };

  const prompt = `Realiza una auditoría ejecutiva de cumplimiento del Artículo 35 del Reglamento de la Corte IDH y del Artículo 29.2 del Reglamento de la CIDH para el padrón del caso "${caso.nombre || 'Caso Colectivo'}" (Jurisdicción: ${caso.jurisdiccion || 'SIDH'}, Etapa: ${caso.etapa_procesal || 'En trámite'}).

Datos estadísticos del padrón actual:
- Total de personas registradas en el padrón: ${estadisticas.total}
- Víctimas con acreditación completa (Poder + Documento de Identidad): ${estadisticas.listosArt35} (${estadisticas.porcentajeListos}%)
- Sin poder de representación verificado: ${estadisticas.sinPoderCount}
- Sin documento de identidad verificado: ${estadisticas.sinIdCount}
- Sin soporte de daño/afectación marcado: ${estadisticas.sinPruebaDanoCount}
- Sin correo electrónico válido para notificaciones: ${estadisticas.sinCorreoCount}
- Víctimas con condición de vulnerabilidad registrada (Adulto mayor, salud crítica, discapacidad, etc.): ${estadisticas.vulnerablesCount}
- Documentos de identidad duplicados detectados: ${cedulasDuplicadas.length > 0 ? cedulasDuplicadas.join(', ') : 'Ninguno'}

Redacta un dictamen ejecutivo breve (máximo 180 palabras) con:
1. Nivel de preparación del Anexo Único de Víctimas (Art. 35 Corte IDH).
2. Riesgos procesales urgentes que deben subsanarse antes de presentar el escrito o ESAP.
3. Viabilidad de invocar tramitación prioritaria (Art. 29.2 CIDH) según las personas en situación de vulnerabilidad.`;

  const respuesta = await ejecutarConsultaJuridicaIA({
    prompt,
    tier: 'simple',
    temperature: 0.2
  });

  return {
    estadisticas,
    dictamenIA: respuesta.text,
    _metaIA: {
      modeloSolicitado: respuesta.modeloSolicitado,
      modeloEjecutado: respuesta.modeloEjecutado,
      backendUtilizado: respuesta.backendUtilizado,
      badge: respuesta.badge
    }
  };
}

/**
 * 4. REDACTOR IA DE COMUNICADOS EN LENGUAJE CLARO Y EMPÁTICO
 * Usa Gemini 3.8 Flash para circulares completas y Gemini 3.5 Flash-Lite para recordatorios rápidos.
 */
export async function redactarComunicadoClaroIA({
  caso = {},
  instruccion = '',
  tipoPlantilla = 'actualizacion_procesal'
}) {
  const esSimple = tipoPlantilla === 'subsanacion_poder_id' || tipoPlantilla === 'recordatorio_aporte';
  const tier = esSimple ? 'simple' : 'secondary';

  const prompt = `Redacta un comunicado oficial por correo electrónico dirigido a las personas representadas del caso "${caso.nombre || 'Litigio Estratégico'}" (Expediente: ${caso.expediente_oficial || 'En trámite'}, Jurisdicción: ${caso.jurisdiccion || 'Internacional'}, Etapa procesal actual: ${caso.etapa_procesal || 'Sustanciación'}).

Tipo de comunicado solicitado: ${tipoPlantilla}
Instrucciones adicionales del abogado responsable: ${instruccion || 'Explicar el estado actual del caso con lenguaje claro, empático, accesible para personas no abogadas y riguroso.'}

Devuelve EXCLUSIVAMENTE un objeto JSON válido con esta estructura exacta:
{
  "asunto": "Asunto claro y profesional para el correo electrónico",
  "cuerpo": "Texto completo del comunicado en párrafos bien estructurados, empáticos y claros, con saludo institucional del equipo jurídico del IIRESODH y despedida formal."
}`;

  const respuesta = await ejecutarConsultaJuridicaIA({
    prompt,
    tier,
    temperature: 0.35
  });

  const parsed = parsearJsonSeguro(respuesta.text);
  return {
    asunto: limpiarMarkdownATextoPlano(
      parsed?.asunto ||
        `Actualización Oficial del Caso: ${caso.nombre || 'IIRESODH'} (${caso.expediente_oficial || 'Informe Procesal'})`
    ),
    cuerpo: limpiarMarkdownATextoPlano(parsed?.cuerpo || respuesta.text),
    _metaIA: {
      modeloSolicitado: respuesta.modeloSolicitado,
      modeloEjecutado: respuesta.modeloEjecutado,
      backendUtilizado: respuesta.backendUtilizado,
      badge: respuesta.badge
    }
  };
}

/**
 * 5. SÍNTESIS EJECUTIVA DEL EXPEDIENTE INDIVIDUAL DEL REPRESENTADO (FichaCliente)
 * Usa Gemini 3.8 Flash.
 */
export async function sintetizarExpedienteRepresentadoIA({
  cliente = {},
  caso = {},
  notas = [],
  documentos = [],
  comunicados = []
}) {
  const resumenNotas = notas
    .slice(0, 12)
    .map((n, i) => `${i + 1}. [${n.autor_nombre || 'Abogado'}]: ${n.texto}`)
    .join('\n');
  const resumenDocs = documentos
    .map((d) => `- ${d.nombre} (${d.tipo || 'Archivo'})`)
    .join('\n');
  const resumenComs = comunicados
    .slice(0, 8)
    .map((c) => `- ${c.asunto} -> Estado: ${c.estado} (${c.ultima_actualizacion || ''})`)
    .join('\n');

  const nombreRep =
    `${cliente.nombres || ''} ${cliente.apellidos || ''}`.trim() ||
    cliente.nombre_completo ||
    'Sin nombre';
  const idRep = cliente.identificacion || cliente.documento_identidad || 'Sin registrar';

  const prompt = `Elabora una Ficha Ejecutiva de Situación Jurídica e Individualización (estándar SIDH) para la persona representada:
- Nombre: ${nombreRep}
- Identificación: ${idRep} (${cliente.tipo_identificacion || 'ID'})
- País de residencia: ${cliente.pais || 'No especificado'}
- Calidad procesal: ${cliente.calidad_procesal || 'Víctima Directa / Representado Principal'}
- Condición de vulnerabilidad: ${cliente.condicion_vulnerabilidad || 'Ninguna registrada'}
- Acreditación documental: Poder (${cliente.tiene_poder ? 'SÍ' : 'PENDIENTE'}), ID (${cliente.tiene_documento_id ? 'SÍ' : 'PENDIENTE'}), Prueba de daño (${cliente.tiene_prueba_dano ? 'SÍ' : 'PENDIENTE'})
- Estado de aportes/pagos: ${cliente.estado_pago || 'Pendiente'} (${cliente.monto_pagado ? `${cliente.moneda_pago || 'USD'} ${cliente.monto_pagado}` : 'Sin monto registrado'})
- Caso principal: ${caso.nombre || 'Litigio IIRESODH'} (${caso.jurisdiccion || 'SIDH'} - Etapa: ${caso.etapa_procesal || 'En trámite'})

Documentos cargados en su carpeta individual (${documentos.length}):
${resumenDocs || 'Ningún archivo cargado aún.'}

Bitácora de notas jurídicas (${notas.length}):
${resumenNotas || 'Sin notas registradas.'}

Historial de notificaciones enviadas (${comunicados.length}):
${resumenComs || 'Sin comunicados registrados.'}

Estructura tu respuesta en 3 bloques breves y accionables:
1. **Estado de Acreditación Individual (Art. 35 Corte IDH)**: Qué está completo y qué documento falta recabar.
2. **Síntesis Fáctica y de Vulnerabilidad**: Resumen de las notas jurídicas y posibles afectaciones diferenciadas.
3. **Próximos Pasos Recomendados con el Representado**: Acciones concretas de seguimiento.`;

  const respuesta = await ejecutarConsultaJuridicaIA({
    prompt,
    tier: 'secondary',
    temperature: 0.25
  });

  return {
    resumen: respuesta.text,
    _metaIA: {
      modeloSolicitado: respuesta.modeloSolicitado,
      modeloEjecutado: respuesta.modeloEjecutado,
      backendUtilizado: respuesta.backendUtilizado,
      badge: respuesta.badge
    }
  };
}

/**
 * 6. FORMATEADOR EDITORIAL JURÍDICO Y EXPORTADOR (COPIADO RICO, WORD, PDF Y GOOGLE DRIVE) — PIDA
 */
function escaparHtmlBasico(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function aplicarFormatoInline(linea = '') {
  let s = escaparHtmlBasico(linea);
  // Negrita + cursiva ***texto***
  s = s.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  // Negrita **texto**
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong style="color:#0f172a;">$1</strong>');
  // Cursiva *texto*
  s = s.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, '$1<em>$2</em>');
  // Código inline `texto`
  s = s.replace(/`([^`]+)`/g, '<code style="background:#f1f5f9;padding:1px 5px;border-radius:4px;font-family:monospace;font-size:0.9em;">$1</code>');
  return s;
}

/**
 * Convierte un texto Markdown jurídico de PIDA en HTML editorial limpio y elegante
 * listo para renderizar en pantalla, copiar con formato a Word/Docs o exportar.
 */
export function convertirMarkdownAHtmlJuridico(markdown = '') {
  if (!markdown) return '';
  const lineas = String(markdown).replace(/\r\n/g, '\n').split('\n');
  const htmlParts = [];
  let enListaUl = false;
  let enListaOl = false;
  let enTabla = false;
  let filasTabla = [];

  const cerrarListas = () => {
    if (enListaUl) {
      htmlParts.push('</ul>');
      enListaUl = false;
    }
    if (enListaOl) {
      htmlParts.push('</ol>');
      enListaOl = false;
    }
  };

  const cerrarTabla = () => {
    if (enTabla && filasTabla.length > 0) {
      let tbl = '<table style="width:100%;border-collapse:collapse;margin:14px 0;font-size:10.5pt;">';
      filasTabla.forEach((celdas, idx) => {
        const esHeader = idx === 0;
        tbl += '<tr>';
        celdas.forEach((c) => {
          const tag = esHeader ? 'th' : 'td';
          const bg = esHeader ? 'background:#1e3a8a;color:#ffffff;font-weight:bold;' : 'background:#ffffff;color:#1e293b;';
          tbl += `<${tag} style="${bg}border:1px solid #cbd5e1;padding:8px 10px;text-align:left;vertical-align:top;">${aplicarFormatoInline(c)}</${tag}>`;
        });
        tbl += '</tr>';
      });
      tbl += '</table>';
      htmlParts.push(tbl);
    }
    enTabla = false;
    filasTabla = [];
  };

  for (let i = 0; i < lineas.length; i++) {
    const raw = lineas[i];
    const trimmed = raw.trim();

    // Detectar tabla Markdown | col1 | col2 |
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      cerrarListas();
      const celdas = trimmed
        .slice(1, -1)
        .split('|')
        .map((c) => c.trim());
      // Ignorar fila separadora |---|---|
      if (celdas.every((c) => /^[-:]+$/.test(c))) {
        enTabla = true;
        continue;
      }
      enTabla = true;
      filasTabla.push(celdas);
      continue;
    } else if (enTabla) {
      cerrarTabla();
    }

    if (!trimmed) {
      cerrarListas();
      continue;
    }

    // Línea divisoria --- o ***
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      cerrarListas();
      htmlParts.push('<hr style="border:none;border-top:1px solid #cbd5e1;margin:16px 0;" />');
      continue;
    }

    // Encabezados #, ##, ###, ####
    const matchHeader = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (matchHeader) {
      cerrarListas();
      const nivel = matchHeader[1].length;
      const contenido = aplicarFormatoInline(matchHeader[2].replace(/#+$/, '').trim());
      if (nivel === 1) {
        htmlParts.push(
          `<h1 style="color:#1e3a8a;font-size:15pt;font-weight:bold;margin:18px 0 8px 0;padding-bottom:6px;border-bottom:2px solid #1e3a8a;">${contenido}</h1>`
        );
      } else if (nivel === 2) {
        htmlParts.push(
          `<h2 style="color:#1e3a8a;font-size:13pt;font-weight:bold;margin:16px 0 6px 0;padding-bottom:4px;border-bottom:1px solid #cbd5e1;">${contenido}</h2>`
        );
      } else if (nivel === 3) {
        htmlParts.push(
          `<h3 style="color:#1e3a8a;font-size:11.5pt;font-weight:bold;margin:14px 0 6px 0;text-transform:uppercase;letter-spacing:0.3px;">${contenido}</h3>`
        );
      } else {
        htmlParts.push(
          `<h4 style="color:#334155;font-size:11pt;font-weight:bold;margin:12px 0 4px 0;">${contenido}</h4>`
        );
      }
      continue;
    }

    // Citas >
    if (trimmed.startsWith('>')) {
      cerrarListas();
      const textoCita = aplicarFormatoInline(trimmed.replace(/^>\s*/, ''));
      htmlParts.push(
        `<blockquote style="margin:10px 0;padding:10px 14px;border-left:4px solid #1e3a8a;background:#f8fafc;color:#334155;font-style:italic;">${textoCita}</blockquote>`
      );
      continue;
    }

    // Lista numerada 1. ...
    const matchOl = trimmed.match(/^(\d+)[.)]\s+(.+)$/);
    if (matchOl) {
      if (enListaUl) {
        htmlParts.push('</ul>');
        enListaUl = false;
      }
      if (!enListaOl) {
        htmlParts.push('<ol style="margin:8px 0 12px 22px;padding:0;line-height:1.65;">');
        enListaOl = true;
      }
      htmlParts.push(`<li style="margin-bottom:6px;">${aplicarFormatoInline(matchOl[2])}</li>`);
      continue;
    }

    // Lista con viñetas - o *
    const matchUl = trimmed.match(/^[-*•]\s+(.+)$/);
    if (matchUl) {
      if (enListaOl) {
        htmlParts.push('</ol>');
        enListaOl = false;
      }
      if (!enListaUl) {
        htmlParts.push('<ul style="margin:8px 0 12px 22px;padding:0;line-height:1.65;">');
        enListaUl = true;
      }
      htmlParts.push(`<li style="margin-bottom:6px;">${aplicarFormatoInline(matchUl[1])}</li>`);
      continue;
    }

    // Encabezado en negrita pura en una sola línea (ej. **DICTAMEN EJECUTIVO** o **1. Subtítulo:**)
    const matchBoldHeading = trimmed.match(/^\*\*([^*]+)\*\*:?$/);
    if (matchBoldHeading) {
      cerrarListas();
      const tituloLimpio = escaparHtmlBasico(matchBoldHeading[1].trim());
      htmlParts.push(
        `<h4 style="color:#1e3a8a;font-size:11pt;font-weight:bold;margin:14px 0 6px 0;padding-bottom:3px;border-bottom:1px solid #e2e8f0;">${tituloLimpio}</h4>`
      );
      continue;
    }

    // Párrafo estándar
    cerrarListas();
    htmlParts.push(
      `<p style="margin:0 0 10px 0;line-height:1.7;text-align:justify;color:#1e293b;">${aplicarFormatoInline(trimmed)}</p>`
    );
  }

  cerrarListas();
  cerrarTabla();
  return htmlParts.join('\n');
}

/**
 * Limpia la sintaxis cruda de Markdown para obtener texto plano limpio al copiar.
 */
export function limpiarMarkdownATextoPlano(markdown = '') {
  return String(markdown || '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*\*(.+?)\*\*\*/g, '$1')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, '$1$2')
    .replace(/^---$/gm, '────────────────────────────────────────────────────────')
    .trim();
}

/**
 * Construye un documento HTML completo con membrete jurídico institucional del IIRESODH — PIDA.
 */
export function construirDocumentoEditorialHtml({ markdown = '', titulo = 'Dictamen Jurídico PIDA', caso = {} }) {
  const fechaHoy = new Date().toLocaleDateString('es-CR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
  const cuerpoHtml = convertirMarkdownAHtmlJuridico(markdown);

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${escaparHtmlBasico(titulo)} — IIRESODH (PIDA)</title>
  <style>
    @page { size: A4; margin: 2.2cm; }
    body {
      font-family: 'Georgia', 'Times New Roman', serif;
      font-size: 11pt;
      line-height: 1.65;
      color: #1e293b;
      margin: 0;
      padding: 0;
    }
    .membrete {
      border-bottom: 2px solid #1e3a8a;
      padding-bottom: 12px;
      margin-bottom: 18px;
    }
    .institucion {
      font-family: 'Arial', sans-serif;
      font-size: 13pt;
      font-weight: bold;
      color: #1e3a8a;
      letter-spacing: 0.5px;
    }
    .subtitulo-pida {
      font-family: 'Arial', sans-serif;
      font-size: 9.5pt;
      color: #475569;
      margin-top: 2px;
    }
    .ficha-expediente {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
      font-family: 'Arial', sans-serif;
      font-size: 9.5pt;
      background: #f8fafc;
    }
    .ficha-expediente td {
      border: 1px solid #cbd5e1;
      padding: 6px 10px;
    }
    .pie {
      margin-top: 28px;
      padding-top: 10px;
      border-top: 1px solid #cbd5e1;
      font-family: 'Arial', sans-serif;
      font-size: 8.5pt;
      color: #64748b;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="membrete">
    <div class="institucion">IIRESODH · SISTEMA DE INTELIGENCIA JURÍDICA PIDA</div>
    <div class="subtitulo-pida">Dictamen Técnico-Jurídico en Derecho Internacional de los Derechos Humanos · ${escaparHtmlBasico(fechaHoy)}</div>
  </div>
  <table class="ficha-expediente">
    <tr>
      <td><strong>Caso / Litigio:</strong> ${escaparHtmlBasico(caso.nombre || 'Expediente Institucional')}</td>
      <td><strong>Expediente Oficial:</strong> ${escaparHtmlBasico(caso.expediente_oficial || 'En trámite')}</td>
    </tr>
    <tr>
      <td><strong>Jurisdicción / Instancia:</strong> ${escaparHtmlBasico(caso.jurisdiccion || 'Sistema Interamericano / ONU')}</td>
      <td><strong>Etapa Procesal:</strong> ${escaparHtmlBasico(caso.etapa_procesal || 'En curso')}</td>
    </tr>
  </table>
  <div class="contenido-dictamen">
    ${cuerpoHtml}
  </div>
  <div class="pie">
    Documento generado con asistencia de PIDA (IIRESODH) · Confidencial — Uso exclusivo del equipo jurídico.
  </div>
</body>
</html>`;
}

/**
 * 1) Copiar Dictamen con Formato Rico (HTML + Texto Plano limpio) para pegar en Word, Google Docs o Correo.
 */
export async function copiarDictamenConFormato({ markdown = '', titulo = 'Dictamen Jurídico PIDA', caso = {} }) {
  const htmlDoc = construirDocumentoEditorialHtml({ markdown, titulo, caso });
  const plainText = limpiarMarkdownATextoPlano(markdown);

  if (navigator.clipboard && window.ClipboardItem) {
    try {
      const item = new window.ClipboardItem({
        'text/html': new Blob([htmlDoc], { type: 'text/html' }),
        'text/plain': new Blob([plainText], { type: 'text/plain' })
      });
      await navigator.clipboard.write([item]);
      return true;
    } catch (e) {
      console.warn('Fallback a writeText plano:', e);
    }
  }
  await navigator.clipboard.writeText(plainText);
  return true;
}

/**
 * 2) Descargar Dictamen en formato Microsoft Word (.doc compatible con Word con estilos editoriales).
 */
export function descargarDictamenWord({ markdown = '', titulo = 'Dictamen_PIDA', caso = {} }) {
  const htmlDoc = construirDocumentoEditorialHtml({ markdown, titulo, caso });
  const wordHtml = `\ufeff<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
${htmlDoc.replace('<!DOCTYPE html>\n<html lang="es">', '')}`;

  const blob = new Blob([wordHtml], { type: 'application/msword;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const nombreLimpio = `${titulo}_${caso.expediente_oficial || caso.nombre || 'IIRESODH'}`
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .slice(0, 65);
  link.href = url;
  link.download = `${nombreLimpio}.doc`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * 3) Descargar / Imprimir Dictamen en formato PDF limpio con membrete institucional.
 */
export function descargarDictamenPDF({ markdown = '', titulo = 'Dictamen Jurídico PIDA', caso = {} }) {
  const htmlDoc = construirDocumentoEditorialHtml({ markdown, titulo, caso });
  const printWin = window.open('', '_blank', 'width=900,height=800');
  if (!printWin) {
    throw new Error('Permite las ventanas emergentes en tu navegador para generar el PDF.');
  }
  printWin.document.open();
  printWin.document.write(htmlDoc);
  printWin.document.close();
  printWin.focus();
  setTimeout(() => {
    printWin.print();
  }, 350);
}

/**
 * 4) Guardar el Dictamen directamente en el Google Drive del abogado como un Google Doc editable.
 */
export async function guardarDictamenEnGoogleDrive({
  markdown = '',
  titulo = 'Dictamen Jurídico PIDA',
  caso = {},
  userEmail = ''
}) {
  let token = obtenerTokenGoogleDriveActivo();
  if (!token) {
    token = await solicitarTokenGoogleDrive(userEmail, false);
  }
  if (!token) {
    throw new Error('No se pudo autorizar la conexión con tu cuenta de Google Drive.');
  }

  const htmlDoc = construirDocumentoEditorialHtml({ markdown, titulo, caso });
  const fechaCorta = new Date().toISOString().slice(0, 10);
  const nombreDoc = `[PIDA] ${titulo} - ${caso.expediente_oficial || caso.nombre || 'IIRESODH'} (${fechaCorta})`;

  const construirMultipart = () => {
    const boundary = '-------314159265358979323846';
    const metadata = {
      name: nombreDoc,
      mimeType: 'application/vnd.google-apps.document'
    };
    const multipartBody =
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: text/html; charset=UTF-8\r\n\r\n` +
      `${htmlDoc}\r\n` +
      `--${boundary}--`;
    return { boundary, multipartBody };
  };

  let { boundary, multipartBody } = construirMultipart();
  let response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body: multipartBody
    }
  );

  // Si el token anterior solo tenía drive.readonly y falta drive.file, solicitamos permiso con popup
  if (response.status === 401 || response.status === 403) {
    token = await solicitarTokenGoogleDrive(userEmail, false);
    if (!token) {
      throw new Error('Autorización de Google Drive cancelada.');
    }
    ({ boundary, multipartBody } = construirMultipart());
    response = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`
        },
        body: multipartBody
      }
    );
  }

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`No se pudo crear el documento en Google Drive (${response.status}): ${errText}`);
  }

  const data = await response.json();
  return {
    id: data.id,
    name: data.name,
    webViewLink: data.webViewLink || `https://docs.google.com/document/d/${data.id}/edit`
  };
}

