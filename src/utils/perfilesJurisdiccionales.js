// src/utils/perfilesJurisdiccionales.js

/**
 * Catálogo completo de países de Latinoamérica donde opera el IIRESODH,
 * con sus órganos constitucionales, contenciosos, laborales y requisitos de personería.
 */
export const PAISES_LATINOAMERICA = [
  {
    codigo: 'CR',
    nombre: 'Costa Rica',
    bandera: '🇨🇷',
    organoConstitucional: 'Sala Constitucional de la Corte Suprema de Justicia (Sala IV)',
    recursoConstitucional: 'Recurso de Amparo / Hábeas Corpus / Acción de Inconstitucionalidad (Ley N° 7135)',
    organoContencioso: 'Tribunal Contencioso-Administrativo y Civil de Hacienda (CPCA Ley N° 8508)',
    organoLaboral: 'Juzgados de Trabajo y Sala Segunda (Reforma Procesal Laboral)',
    requisitoPoderNacional: 'Poder Especial Judicial (Art. 20 CPC) o firma autenticada por abogado; en Amparo ante Sala IV rige informalidad (Art. 30 Ley Jurisdicción Constitucional).',
    derechosNacionalesSugeridos: [
      'Art. 33 Constitución Política (Igualdad y No Discriminación)',
      'Art. 41 Constitución Política (Justicia Pronta y Cumplida)',
      'Art. 39 Constitución Política (Debido Proceso Constitucional)',
      'Art. 48 Constitución Política (Bloque de Constitucionalidad y DDHH)',
      'Art. 50 Constitución Política (Ambiente Sano y Ecológicamente Equilibrado)',
      'Art. 56 y 57 Constitución Política (Derecho al Trabajo y Salario Mínimo)',
      'Ley de la Jurisdicción Constitucional (Ley N° 7135)',
      'Código Procesal Contencioso-Administrativo (Ley N° 8508)'
    ]
  },
  {
    codigo: 'MX',
    nombre: 'México',
    bandera: '🇲🇽',
    organoConstitucional: 'Juzgados de Distrito, Tribunales Colegiados y Suprema Corte de Justicia de la Nación (SCJN)',
    recursoConstitucional: 'Juicio de Amparo Indirecto / Directo (Arts. 103 y 107 CPEUM)',
    organoContencioso: 'Tribunal Federal de Justicia Administrativa (TFJA) / Salas Regionales',
    organoLaboral: 'Tribunales Laborales Federales y Locales / Centros de Conciliación',
    requisitoPoderNacional: 'Acreditación de personalidad mediante poder notarial, carta poder ratificada o designación de autorizados en términos amplios (Art. 12 Ley de Amparo).',
    derechosNacionalesSugeridos: [
      'Art. 1° CPEUM (Principio Pro Persona y Control de Convencionalidad)',
      'Art. 14 y 16 CPEUM (Audiencia, Legalidad y Seguridad Jurídica)',
      'Art. 17 CPEUM (Tutela Jurisdiccional Efectiva)',
      'Art. 123 CPEUM (Derechos Laborales y Seguridad Social)',
      'Ley de Amparo (Arts. 103 y 107 CPEUM)',
      'Ley General de Víctimas'
    ]
  },
  {
    codigo: 'CO',
    nombre: 'Colombia',
    bandera: '🇨🇴',
    organoConstitucional: 'Jueces Constitucionales y Corte Constitucional de Colombia',
    recursoConstitucional: 'Acción de Tutela (Art. 86 CP) / Acción Popular / Acción de Grupo',
    organoContencioso: 'Juzgados, Tribunales Administrativos y Consejo de Estado (CPACA - Ley 1437)',
    organoLaboral: 'Juzgados Laborales del Circuito y Sala de Casación Laboral CSJ',
    requisitoPoderNacional: 'Poder especial con presentación personal o conferido por mensaje de datos (Ley 2213 de 2022 / Art. 74 CGP); en Acción de Tutela se admite agencia oficiosa o poder simple.',
    derechosNacionalesSugeridos: [
      'Art. 13 Constitución Política (Derecho a la Igualdad)',
      'Art. 29 Constitución Política (Debido Proceso)',
      'Art. 53 Constitución Política (Principios Mínimos Fundamentales del Trabajo)',
      'Art. 86 Constitución Política (Acción de Tutela)',
      'Art. 90 Constitución Política (Responsabilidad Patrimonial del Estado - Reparación Directa)',
      'Art. 93 Constitución Política (Bloque de Constitucionalidad)',
      'Medio de Control de Nulidad y Restablecimiento / Reparación Directa (CPACA)'
    ]
  },
  {
    codigo: 'PE',
    nombre: 'Perú',
    bandera: '🇵🇪',
    organoConstitucional: 'Juzgados Constitucionales y Tribunal Constitucional del Perú',
    recursoConstitucional: 'Proceso de Amparo / Hábeas Corpus / Proceso de Cumplimiento (Nuevo Código Procesal Constitucional)',
    organoContencioso: 'Juzgados y Salas Contencioso-Administrativas (TUO Ley N° 27584)',
    organoLaboral: 'Juzgados Especializados de Trabajo (Nueva Ley Procesal del Trabajo N° 29497)',
    requisitoPoderNacional: 'Poder por escritura pública o por acta ante el juez (Arts. 72 y 74 CPC); en Proceso de Amparo basta representación procesal flexible con firma de letrado.',
    derechosNacionalesSugeridos: [
      'Art. 2 Constitución Política del Perú (Derechos Fundamentales de la Persona)',
      'Art. 139.3 Constitución Política (Observancia del Debido Proceso y Tutela Jurisdiccional)',
      'Art. 200 Constitución Política (Acciones de Garantía Constitucional)',
      'Cuarta Disposición Final y Transitoria (Interpretación conforme a Tratados DDHH)',
      'Nuevo Código Procesal Constitucional (Ley N° 31307)'
    ]
  },
  {
    codigo: 'CL',
    nombre: 'Chile',
    bandera: '🇨🇱',
    organoConstitucional: 'Cortes de Apelaciones, Corte Suprema y Tribunal Constitucional',
    recursoConstitucional: 'Recurso de Protección (Art. 20 CPR) / Recurso de Amparo (Art. 21 CPR)',
    organoContencioso: 'Tribunales Ordinarios de Hacienda y Cortes de Apelaciones',
    organoLaboral: 'Juzgados de Letras del Trabajo (Procedimiento de Tutela Laboral)',
    requisitoPoderNacional: 'Patrocinio de abogado habilitado y mandato judicial constituido conforme a la Ley N° 18.120 (firma electrónica avanzada o autorización ante ministro de fe).',
    derechosNacionalesSugeridos: [
      'Art. 5 inc. 2° Constitución Política (Deber de Respetar Tratados de DDHH)',
      'Art. 19 N° 2 y N° 3 CPR (Igualdad ante la Ley y Debido Proceso)',
      'Art. 20 CPR (Acción Constitucional de Protección)',
      'Procedimiento de Tutela de Derechos Fundamentales del Trabajador (Arts. 485 y ss. Código del Trabajo)'
    ]
  },
  {
    codigo: 'AR',
    nombre: 'Argentina',
    bandera: '🇦🇷',
    organoConstitucional: 'Juzgados Federales / Provinciales y Corte Suprema de Justicia de la Nación (CSJN)',
    recursoConstitucional: 'Acción de Amparo (Art. 43 CN y Ley 16.986) / Recurso Extraordinario Federal',
    organoContencioso: 'Fuero Contencioso Administrativo Federal y Provincial',
    organoLaboral: 'Justicia Nacional del Trabajo y Tribunales de Trabajo Provinciales',
    requisitoPoderNacional: 'Poder general o especial para juicios otorgado ante escribano público, o acta-poder en sede laboral (Ley 18.345), con patrocinio letrado matriculado.',
    derechosNacionalesSugeridos: [
      'Art. 14 bis Constitución Nacional (Derechos del Trabajo y Seguridad Social)',
      'Art. 18 Constitución Nacional (Garantía de Defensa en Juicio y Debido Proceso)',
      'Art. 43 Constitución Nacional (Acción de Amparo Individual y Colectivo)',
      'Art. 75 inc. 22 Constitución Nacional (Jerarquía Constitucional de Tratados de DDHH)'
    ]
  },
  {
    codigo: 'GT',
    nombre: 'Guatemala',
    bandera: '🇬🇹',
    organoConstitucional: 'Tribunales de Amparo y Corte de Constitucionalidad (CC)',
    recursoConstitucional: 'Acción Constitucional de Amparo / Exhibición Personal (Decreto 1-86)',
    organoContencioso: 'Tribunal de lo Contencioso Administrativo',
    organoLaboral: 'Juzgados de Primera Instancia de Trabajo y Previsión Social',
    requisitoPoderNacional: 'Mandato Especial Judicial con Representación inscrito en el Registro Electrónico de Poderes del Archivo General de Protocolos, o auxilio profesional directo en Amparo.',
    derechosNacionalesSugeridos: [
      'Art. 12 Constitución Política (Derecho de Defensa y Debido Proceso)',
      'Art. 44 y 46 Constitución Política (Preeminencia del Derecho Internacional en DDHH)',
      'Art. 265 Constitución Política (Procedencia del Amparo)',
      'Ley de Amparo, Exhibición Personal y de Constitucionalidad (Decreto 1-86)'
    ]
  },
  {
    codigo: 'SV',
    nombre: 'El Salvador',
    bandera: '🇸🇻',
    organoConstitucional: 'Sala de lo Constitucional de la Corte Suprema de Justicia',
    recursoConstitucional: 'Proceso de Amparo / Hábeas Corpus / Inconstitucionalidad',
    organoContencioso: 'Juzgados y Cámaras de lo Contencioso Administrativo (LJCA)',
    organoLaboral: 'Juzgados de lo Laboral',
    requisitoPoderNacional: 'Poder General Judicial con cláusula especial otorgado en escritura pública o acta notarial conforme al CPCM.',
    derechosNacionalesSugeridos: [
      'Art. 2 y 11 Constitución de la República (Garantía de Audiencia y Derechos Individuales)',
      'Art. 144 Constitución de la República (Prevalencia de Tratados Internacionales)',
      'Art. 247 Constitución de la República (Proceso de Amparo Constitucional)',
      'Ley de Procedimientos Constitucionales'
    ]
  },
  {
    codigo: 'HN',
    nombre: 'Honduras',
    bandera: '🇭🇳',
    organoConstitucional: 'Sala de lo Constitucional de la Corte Suprema de Justicia',
    recursoConstitucional: 'Recurso de Amparo / Hábeas Corpus (Ley sobre Justicia Constitucional)',
    organoContencioso: 'Juzgados de Letras de lo Contencioso Administrativo',
    organoLaboral: 'Juzgados de Letras del Trabajo',
    requisitoPoderNacional: 'Poder otorgado en escritura pública o apud acta ante el secretario del tribunal conforme al Código Procesal Civil.',
    derechosNacionalesSugeridos: [
      'Art. 82 y 90 Constitución de la República (Derecho de Defensa y Debido Proceso)',
      'Art. 183 Constitución de la República (Garantía de Amparo)',
      'Ley sobre Justicia Constitucional'
    ]
  },
  {
    codigo: 'NI',
    nombre: 'Nicaragua',
    bandera: '🇳🇮',
    organoConstitucional: 'Sala de lo Constitucional de la Corte Suprema de Justicia',
    recursoConstitucional: 'Recurso de Amparo / Exhibición Personal (Ley de Justicia Constitucional N° 983)',
    organoContencioso: 'Sala de lo Contencioso Administrativo',
    organoLaboral: 'Juzgados del Trabajo y de la Seguridad Social',
    requisitoPoderNacional: 'Poder Especial o Generalísimo Judicial otorgado en escritura pública ante notario autorizado.',
    derechosNacionalesSugeridos: [
      'Art. 34 Constitución Política (Garantías Mínimas del Debido Proceso)',
      'Art. 46 Constitución Política (Vigencia de Instrumentos Internacionales de DDHH)',
      'Ley de Justicia Constitucional (Ley N° 983)'
    ]
  },
  {
    codigo: 'PA',
    nombre: 'Panamá',
    bandera: '🇵🇦',
    organoConstitucional: 'Pleno de la Corte Suprema de Justicia y Tribunales Superiores',
    recursoConstitucional: 'Acción de Amparo de Garantías Constitucionales (Art. 54 CP)',
    organoContencioso: 'Sala Tercera de lo Contencioso-Administrativo y Laboral de la CSJ',
    organoLaboral: 'Juzgados Seccionales de Trabajo y Tribunales Superiores de Trabajo',
    requisitoPoderNacional: 'Poder especial otorgado a abogado idóneo con presentación personal o firma autenticada conforme al Código Judicial.',
    derechosNacionalesSugeridos: [
      'Art. 17 y 32 Constitución Política (Efectividad de Derechos y Debido Proceso)',
      'Art. 54 Constitución Política (Amparo de Garantías Constitucionales)',
      'Jurisdicción Contencioso-Administrativa (Sala Tercera CSJ)'
    ]
  },
  {
    codigo: 'EC',
    nombre: 'Ecuador',
    bandera: '🇪🇨',
    organoConstitucional: 'Unidades Judiciales y Corte Constitucional del Ecuador',
    recursoConstitucional: 'Acción de Protección (Art. 88 CRE) / Acción Extraordinaria de Protección (LOGJCC)',
    organoContencioso: 'Tribunales Distritales de lo Contencioso Administrativo (COGEP)',
    organoLaboral: 'Unidades Judiciales de Trabajo',
    requisitoPoderNacional: 'Procuración judicial otorgada por escritura pública o apud acta (COGEP); en garantías jurisdiccionales (Acción de Protección) rige informalidad.',
    derechosNacionalesSugeridos: [
      'Art. 11 y 424 Constitución del Ecuador (Aplicación Directa e Interpretación Pro Persona)',
      'Art. 76 y 82 Constitución del Ecuador (Debido Proceso y Seguridad Jurídica)',
      'Art. 88 y 94 Constitución del Ecuador (Acción de Protección y Extraordinaria de Protección)',
      'Ley Orgánica de Garantías Jurisdiccionales y Control Constitucional (LOGJCC)'
    ]
  },
  {
    codigo: 'DO',
    nombre: 'República Dominicana',
    bandera: '🇩🇴',
    organoConstitucional: 'Tribunal Constitucional de la República Dominicana (TCRD)',
    recursoConstitucional: 'Acción de Amparo Constitucional (Ley N° 137-11)',
    organoContencioso: 'Tribunal Superior Administrativo (TSA)',
    organoLaboral: 'Juzgados y Cortes de Trabajo',
    requisitoPoderNacional: 'Poder especial de representación judicial otorgado a abogado matriculado en el CARD.',
    derechosNacionalesSugeridos: [
      'Art. 68 y 69 Constitución Dominicana (Tutela Judicial Efectiva y Debido Proceso)',
      'Art. 72 Constitución Dominicana (Acción de Amparo)',
      'Art. 74 Constitución Dominicana (Jerarquía de Tratados de DDHH)',
      'Ley Orgánica del Tribunal Constitucional y de los Procedimientos Constitucionales (N° 137-11)'
    ]
  },
  {
    codigo: 'UY',
    nombre: 'Uruguay',
    bandera: '🇺🇾',
    organoConstitucional: 'Juzgados Letrados y Suprema Corte de Justicia',
    recursoConstitucional: 'Acción de Amparo (Ley N° 16.011) / Inconstitucionalidad de las Leyes',
    organoContencioso: 'Tribunal de lo Contencioso Administrativo (TCA)',
    organoLaboral: 'Juzgados Letrados del Trabajo (Ley N° 18.572)',
    requisitoPoderNacional: 'Poder para pleitos otorgado en escritura pública o asistencia letrada con representación procesal (Art. 44 CGP).',
    derechosNacionalesSugeridos: [
      'Art. 7, 8 y 72 Constitución de la República (Derechos Inherentes a la Personalidad Humana)',
      'Ley N° 16.011 (Acción de Amparo)',
      'Acción de Nulidad ante el Tribunal de lo Contencioso Administrativo'
    ]
  },
  {
    codigo: 'PY',
    nombre: 'Paraguay',
    bandera: '🇵🇾',
    organoConstitucional: 'Juzgados de Primera Instancia y Sala Constitucional de la CSJ',
    recursoConstitucional: 'Acción de Amparo Constitucional (Art. 134 CN) / Acción de Inconstitucionalidad',
    organoContencioso: 'Tribunal de Cuentas (Contencioso-Administrativo)',
    organoLaboral: 'Juzgados de Primera Instancia del Trabajo',
    requisitoPoderNacional: 'Poder especial o general para asuntos judiciales otorgado por escritura pública.',
    derechosNacionalesSugeridos: [
      'Art. 16 y 17 Constitución Nacional (Defensa en Juicio y Derechos Procesales)',
      'Art. 134 Constitución Nacional (Amparo Constitucional)',
      'Art. 137 Constitución Nacional (Orden de Prelación de Tratados Internacionales)'
    ]
  },
  {
    codigo: 'BO',
    nombre: 'Bolivia',
    bandera: '🇧🇴',
    organoConstitucional: 'Salas Constitucionales y Tribunal Constitucional Plurinacional (TCP)',
    recursoConstitucional: 'Acción de Amparo Constitucional / Acción de Libertad / Acción Popular (Código Procesal Constitucional)',
    organoContencioso: 'Tribunal Supremo de Justicia y Salas Contencioso-Administrativas',
    organoLaboral: 'Juzgados de Partido de Trabajo y Seguridad Social',
    requisitoPoderNacional: 'Testimonio de Poder Especial y Suficiente otorgado ante Notaría de Fe Pública.',
    derechosNacionalesSugeridos: [
      'Art. 13.IV y 256 Constitución Política del Estado (Bloque de Constitucionalidad y Aplicación Preferente)',
      'Art. 115 CPE (Tutela Judicial Efectiva y Debido Proceso)',
      'Art. 128 CPE (Acción de Amparo Constitucional)',
      'Código Procesal Constitucional (Ley N° 254)'
    ]
  },
  {
    codigo: 'VE',
    nombre: 'Venezuela',
    bandera: '🇻🇪',
    organoConstitucional: 'Tribunales Competentes y Sala Constitucional del TSJ',
    recursoConstitucional: 'Acción de Amparo Constitucional (Art. 27 CRBV)',
    organoContencioso: 'Juzgados Superiores y Sala Político-Administrativa',
    organoLaboral: 'Tribunales de Sustanciación, Mediación y Ejecución del Trabajo (LOPTRA)',
    requisitoPoderNacional: 'Poder judicial otorgado en forma pública o auténtica o apud acta ante el secretario del tribunal.',
    derechosNacionalesSugeridos: [
      'Art. 23 CRBV (Jerarquía Constitucional de Tratados de DDHH)',
      'Art. 26 y 49 CRBV (Tutela Judicial Efectiva y Debido Proceso)',
      'Art. 27 CRBV (Amparo Constitucional)'
    ]
  },
  {
    codigo: 'BR',
    nombre: 'Brasil',
    bandera: '🇧🇷',
    organoConstitucional: 'Justiça Federal / Estadual y Supremo Tribunal Federal (STF)',
    recursoConstitucional: 'Mandado de Segurança / Habeas Corpus / Ação Civil Pública (CF/88)',
    organoContencioso: 'Varas da Fazenda Pública y Tribunais Regionais Federais (TRF)',
    organoLaboral: 'Justiça do Trabalho (Varas do Trabalho y TST)',
    requisitoPoderNacional: 'Procuração ad judicia (con cláusula ad judicia et extra) firmada por el representado a favor de abogado inscrito en la OAB.',
    derechosNacionalesSugeridos: [
      'Art. 5° Constituição Federal de 1988 (Direitos e Garantias Fundamentais)',
      'Art. 5° § 3° CF/88 (Tratados Internacionais de Direitos Humanos)',
      'Mandado de Segurança (Lei n° 12.016/2009)'
    ]
  },
  {
    codigo: 'CU',
    nombre: 'Cuba',
    bandera: '🇨🇺',
    organoConstitucional: 'Tribunales Provinciales y Tribunal Supremo Popular',
    recursoConstitucional: 'Procedimiento de Amparo de Derechos Constitucionales (Ley N° 153/2022)',
    organoContencioso: 'Salas de lo Administrativo',
    organoLaboral: 'Salas de lo Laboral',
    requisitoPoderNacional: 'Contrato de servicios jurídicos o representación letrada autorizada.',
    derechosNacionalesSugeridos: [
      'Art. 94 y 99 Constitución de la República (Debido Proceso y Garantía Jurisdiccional)',
      'Ley del Proceso de Amparo de los Derechos Constitucionales (Ley N° 153)'
    ]
  },
  {
    codigo: 'PR',
    nombre: 'Puerto Rico',
    bandera: '🇵🇷',
    organoConstitucional: 'Tribunal de Primera Instancia y Tribunal Supremo de Puerto Rico',
    recursoConstitucional: 'Injunction de Derechos Civiles / Sentencia Declaratoria / Mandamus',
    organoContencioso: 'Tribunal de Apelaciones (Revisión Judicial Administrativa - LPAU)',
    organoLaboral: 'Tribunal de Primera Instancia (Procedimiento Sumario Laboral Ley N° 2)',
    requisitoPoderNacional: 'Comparecencia mediante abogado admitido al ejercicio de la abogacía por el Tribunal Supremo.',
    derechosNacionalesSugeridos: [
      'Art. II Carta de Derechos de la Constitución del ELA (Debido Proceso e Igual Protección)',
      'Ley de Procedimiento Administrativo Uniforme (LPAU)'
    ]
  }
];

/**
 * Vías / Instancias disponibles según el ámbito elegido
 */
export const VIAS_INTERNACIONALES = [
  'CIDH (Comisión)',
  'Corte IDH (Tribunal)',
  'ONU (Comités / Relatorías)',
  'Solución Amistosa'
];

export const VIAS_NACIONALES = [
  'Constitucional (Amparo / Tutela / Inconstitucionalidad)',
  'Contencioso-Administrativo / Función Pública',
  'Laboral y Seguridad Social',
  'Penal / Víctimas / Querella',
  'Civil / Agrario / Pueblos Indígenas',
  'Sede Administrativa / Agotamiento Previo'
];

/**
 * Etapas procesales específicas por tipo de vía
 */
export const ETAPAS_INTERNACIONAL_SIDH = [
  '1. Preparación y Recolección',
  '2. Presentación / Admisibilidad',
  '3. Observaciones y Fondo',
  '4. Audiencia / Alegatos Finales',
  '5. Sentencia / Informe de Fondo',
  '6. Supervisión y Reparaciones'
];

export const ETAPAS_NACIONAL_CONSTITUCIONAL = [
  '1. Recolección Probatoria y Redacción del Recurso',
  '2. Interposición, Admisibilidad y Medida Cautelar',
  '3. Informe de Autoridad Recurrida y Coadyuvancias',
  '4. Prueba para Mejor Resolver / Vista Oral',
  '5. Sentencia Constitucional de Fondo',
  '6. Ejecución (o Agotamiento para Escalar a CIDH/ONU)'
];

export const ETAPAS_NACIONAL_ORDINARIO = [
  '1. Personería, Prueba y Vía Administrativa Previa',
  '2. Demanda Inicial, Admisión y Medidas Cautelares',
  '3. Contestación, Excepciones y Audiencia Preliminar',
  '4. Evacuación de Prueba / Juicio Oral y Conclusiones',
  '5. Sentencia de Instancia y Recursos (Apelación/Casación)',
  '6. Firmeza y Ejecución (o Escalamiento a CIDH/ONU)'
];

export function obtenerDatosPais(nombreOCodigo = 'Costa Rica') {
  const limpio = String(nombreOCodigo || '')
    .replace(/^Estado de\s+/i, '')
    .replace(/^República de\s+/i, '')
    .trim()
    .toLowerCase();

  return (
    PAISES_LATINOAMERICA.find(
      (p) =>
        p.codigo.toLowerCase() === limpio ||
        p.nombre.toLowerCase() === limpio ||
        limpio.includes(p.nombre.toLowerCase())
    ) || PAISES_LATINOAMERICA[0]
  );
}

/**
 * Determina automáticamente si un caso es Internacional o Nacional (incluso para casos antiguos)
 */
export function esCasoInternacional(caso = {}) {
  if (caso?.ambito === 'Nacional') return false;
  if (caso?.ambito === 'Internacional') return true;
  const jur = String(caso?.jurisdiccion || '').toLowerCase();
  if (
    jur.includes('constitucional') ||
    jur.includes('contencioso') ||
    jur.includes('laboral') ||
    jur.includes('penal') ||
    jur.includes('civil') ||
    jur.includes('sede administrativa') ||
    jur.includes('amparo') ||
    jur.includes('tutela')
  ) {
    return false;
  }
  return true;
}

/**
 * Crea una etiqueta híbrida que puede invocarse como función `etiqueta(cumpleBoolean)`
 * en los Chips de React, o interpolarse directamente como texto `${etiqueta}` en prompts.
 */
function crearEtiquetaHibrida(textoBase, prefijoOk, prefijoPendiente, sufijoOk = '', sufijoPendiente = '') {
  const fn = (cumple) =>
    cumple
      ? `${prefijoOk}${textoBase}${sufijoOk}`
      : `${prefijoPendiente}${textoBase}${sufijoPendiente}`;
  fn.toString = () => textoBase;
  fn.valueOf = () => textoBase;
  fn.texto = textoBase;
  return fn;
}

/**
 * Devuelve todo el perfil adaptativo del caso (etapas, requisitos de acreditación,
 * etiquetas de auditoría PIDA y normas sugeridas) según sea Internacional o Nacional.
 */
export function obtenerPerfilJurisdiccional(caso = {}) {
  const internacional = esCasoInternacional(caso);
  const paisObj = obtenerDatosPais(caso?.pais_jurisdiccion || caso?.estado_demandado || 'Costa Rica');
  const jur = String(caso?.jurisdiccion || 'CIDH (Comisión)');
  const esONU = jur.toLowerCase().includes('onu') || jur.toLowerCase().includes('comité');
  const esConstitucional =
    !internacional &&
    (jur.toLowerCase().includes('constitucional') ||
      jur.toLowerCase().includes('amparo') ||
      jur.toLowerCase().includes('tutela'));

  if (internacional) {
    const normaCorto = esONU ? 'Legitimación ONU' : 'Estándar Art. 35 Corte IDH';
    const normaTitulo = esONU
      ? 'Auditoría de Legitimación y Admisibilidad (Protocolos Facultativos ONU)'
      : 'Auditoría de Cumplimiento del Padrón (Art. 35 Reglamento Corte IDH / Art. 28 CIDH)';
    const descInternacional = esONU
      ? 'Cada víctima debe contar con autorización escrita firmada, documento de identidad y prueba de afectación/agotamiento interno.'
      : 'Exigencia de la Corte IDH (Art. 35.1) y CIDH (Art. 28): cada presunta víctima debe estar debidamente identificada con documento oficial, poder de representación y prueba de afectación.';

    return {
      esInternacional: true,
      ambito: 'Internacional',
      pais: paisObj,
      jurisdiccion: jur,
      organoEspecifico: esONU
        ? 'Comités de Tratados / Procedimientos Especiales ONU'
        : jur.includes('Corte IDH')
        ? 'Corte Interamericana de Derechos Humanos'
        : 'Comisión Interamericana de Derechos Humanos (CIDH)',
      etiquetaContraparte: 'Estado Demandado',
      normaCorto,
      normaTitulo,
      normaSubtitulo: descInternacional,
      descripcionAcreditacion: descInternacional,
      requisitos: {
        poder: {
          chipLabel: crearEtiquetaHibrida('Poder Legal', '✓ ', '✗ '),
          fichaLabel: crearEtiquetaHibrida(
            'Poder de Representación Internacional (Art. 35 / Art. 28)',
            '✓ ',
            '⏳ ',
            ': Verificado',
            ': Pendiente'
          ),
          criterioIA:
            'Poder o carta de representación internacional firmada a favor de los representantes del IIRESODH.'
        },
        identidad: {
          chipLabel: crearEtiquetaHibrida('Cédula / ID', '✓ ', '✗ '),
          fichaLabel: crearEtiquetaHibrida(
            'Documento Oficial de Identidad',
            '✓ ',
            '⏳ ',
            ': Verificado',
            ': Pendiente'
          ),
          criterioIA: 'Cédula de identidad, DNI, pasaporte o partida de nacimiento legible.'
        },
        prueba: {
          chipLabel: crearEtiquetaHibrida('Prueba de Daño', '✓ ', '○ '),
          fichaLabel: crearEtiquetaHibrida(
            'Prueba de Daño / Afectación o Vínculo Familiar',
            '✓ ',
            '⏳ ',
            ': Acreditada',
            ': Pendiente'
          ),
          criterioIA:
            'Prueba documental del daño sufrido, vínculo familiar o copia de las resoluciones internas definitivas.'
        }
      },
      etapas: ETAPAS_INTERNACIONAL_SIDH,
      guiaEtapas: {
        '1. Preparación y Recolección': {
          objetivo: `Consolidación del padrón de víctimas (${normaCorto}), recolección de poderes e identificaciones, sistematización probatoria y verificación de agotamiento de recursos internos en ${paisObj.nombre}.`,
          entregables: [
            'Poderes de representación internacional firmados',
            'Copias de documentos oficiales de identidad',
            'Copia íntegra de la sentencia interna definitiva y su notificación',
            'Borrador de Petición Inicial / Escrito internacional'
          ],
          promptIA: `Evalúa si el expediente internacional contra ${paisObj.nombre} cuenta con los elementos necesarios en la Etapa 1 (Preparación y Recolección) y sugiere una lista de verificación de pruebas, poderes (${normaCorto}) y requisitos de admisibilidad.`
        },
        '2. Presentación / Admisibilidad': {
          objetivo:
            'Examen de admisibilidad (Arts. 46 y 47 CADH / Protocolos Facultativos ONU): competencia, agotamiento de recursos internos o excepciones (Art. 46.2), plazo de 6 meses y caracterización preliminar.',
          entregables: [
            'Cargo de presentación oficial ante el órgano internacional',
            'Observaciones sobre admisibilidad',
            'Solicitud de trámite prioritario o medida cautelar si aplica'
          ],
          promptIA: `Formula la estrategia jurídica para superar la Etapa 2 (Admisibilidad) en este caso contra ${paisObj.nombre}, blindando el cumplimiento de los artículos 46 y 47 de la CADH (o Protocolo ONU) y rebatiendo posibles excepciones preliminares del Estado.`
        },
        '3. Observaciones y Fondo': {
          objetivo:
            'Sustanciación del fondo de la controversia: presentación del Escrito de Solicitudes, Argumentos y Pruebas (ESAP) o alegatos de fondo sobre responsabilidad internacional del Estado.',
          entregables: [
            'Escrito de Observaciones de Fondo / ESAP',
            'Ofrecimiento de prueba pericial y declarantes',
            'Anexos probatorios numerados correlativamente'
          ],
          promptIA: `Desarrolla la estructura argumentativa de Fondo (Etapa 3) y del Escrito de Solicitudes, Argumentos y Pruebas (ESAP) contra ${paisObj.nombre}, detallando las violaciones convencionales y los estándares aplicables.`
        },
        '4. Audiencia / Alegatos Finales': {
          objetivo:
            'Comparecencia en audiencia pública o privada ante el órgano internacional, interrogatorio de declarantes/peritos y presentación de alegatos finales escritos.',
          entregables: [
            'Guion de interrogatorio a víctimas y peritos',
            'Alegatos orales de apertura y cierre',
            'Escrito de Alegatos Finales y Costas'
          ],
          promptIA:
            'Prepara el guion estratégico para Audiencia Pública y el esquema de Alegatos Finales Escritos (Etapa 4), incluyendo preguntas clave para víctimas/peritos y réplica al Estado.'
        },
        '5. Sentencia / Informe de Fondo': {
          objetivo:
            'Notificación, análisis e interpretación del Informe de Fondo (Art. 50 CADH) o Sentencia definitiva de la Corte / Dictamen del Comité Internacional.',
          entregables: [
            'Análisis ejecutivo de puntos resolutivos',
            'Circular explicativa en lenguaje claro para víctimas',
            'Cálculo de plazos de cumplimiento ordenados al Estado'
          ],
          promptIA:
            'Analiza las implicaciones procesales de la Etapa 5 (Sentencia / Informe de Fondo) para este caso y redacta los puntos clave que deben verificarse respecto de las obligaciones declaradas al Estado.'
        },
        '6. Supervisión y Reparaciones': {
          objetivo:
            'Seguimiento del cumplimiento efectivo de las medidas de reparación integral (Art. 63.1 CADH): indemnizaciones, restitución, rehabilitación, satisfacción y garantías de no repetición.',
          entregables: [
            'Observaciones a los informes estatales de cumplimiento',
            'Comprobantes de pago de indemnizaciones y costas',
            'Solicitud de audiencia de supervisión'
          ],
          promptIA:
            'Diseña una matriz de Supervisión de Cumplimiento de Sentencia y Reparaciones (Etapa 6) según el Art. 63.1 CADH para exigir al Estado el cumplimiento efectivo de cada medida.'
        }
      }
    };
  }

  // =========================================================================
  // PERFIL PARA LITIGIO NACIONAL EN LATINOAMÉRICA (CONSTITUCIONAL VS ORDINARIO)
  // =========================================================================
  if (esConstitucional) {
    const descConst = `En sede constitucional de ${paisObj.nombre} (${paisObj.recursoConstitucional}): se verifica la legitimación activa o poder/memorial, identificación de cada recurrente y prueba del acto lesivo o agravio directo.`;
    return {
      esInternacional: false,
      ambito: 'Nacional',
      pais: paisObj,
      jurisdiccion: jur,
      organoEspecifico: `${paisObj.organoConstitucional} (${paisObj.recursoConstitucional})`,
      etiquetaContraparte: 'Autoridad Recurrida / Entidad Accionada',
      normaCorto: `Legitimación Constitucional (${paisObj.codigo})`,
      normaTitulo: `Auditoría de Legitimación Activa y Requisitos Constitucionales (${paisObj.nombre})`,
      normaSubtitulo: descConst,
      descripcionAcreditacion: descConst,
      requisitos: {
        poder: {
          chipLabel: crearEtiquetaHibrida('Legitimación / Poder', '✓ ', '✗ '),
          fichaLabel: crearEtiquetaHibrida(
            `Legitimación Activa / Poder o Memorial (${paisObj.nombre})`,
            '✓ ',
            '⏳ ',
            ': Verificado',
            ': Pendiente'
          ),
          criterioIA: `En ${paisObj.nombre}: ${paisObj.requisitoPoderNacional}`
        },
        identidad: {
          chipLabel: crearEtiquetaHibrida('Cédula / ID', '✓ ', '✗ '),
          fichaLabel: crearEtiquetaHibrida(
            `Documento de Identidad (${paisObj.nombre})`,
            '✓ ',
            '⏳ ',
            ': Verificado',
            ': Pendiente'
          ),
          criterioIA: `Documento oficial de identificación vigente en ${paisObj.nombre}.`
        },
        prueba: {
          chipLabel: crearEtiquetaHibrida('Prueba del Agravio', '✓ ', '○ '),
          fichaLabel: crearEtiquetaHibrida(
            'Prueba del Acto Impugnado / Violación Constitucional',
            '✓ ',
            '⏳ ',
            ': Acreditada',
            ': Pendiente'
          ),
          criterioIA:
            'Resolución, acto administrativo, omisión o constancia documental que acredita el agravio a derechos fundamentales.'
        }
      },
      etapas: ETAPAS_NACIONAL_CONSTITUCIONAL,
      guiaEtapas: {
        '1. Recolección Probatoria y Redacción del Recurso': {
          objetivo: `Sistematización del agravio constitucional en ${paisObj.nombre}, acreditación de los recurrentes ante ${paisObj.organoConstitucional} y redacción de la acción (${paisObj.recursoConstitucional}).`,
          entregables: [
            `Escrito de ${paisObj.recursoConstitucional}`,
            'Copias de identificación y acreditación de legitimación',
            'Copia del acto administrativo, norma o actuación impugnada'
          ],
          promptIA: `Evalúa los presupuestos de admisibilidad y legitimación activa en ${paisObj.nombre} ante ${paisObj.organoConstitucional} (${paisObj.recursoConstitucional}), indicando qué pruebas y fundamentos constitucionales o de convencionalidad interna deben incorporarse en la Etapa 1.`
        },
        '2. Interposición, Admisibilidad y Medida Cautelar': {
          objetivo: `Presentación ante ${paisObj.organoConstitucional}, atención de prevenciones de admisibilidad y solicitud de suspensión del acto o medida cautelar urgente.`,
          entregables: [
            'Comprobante de radicación / recepción judicial',
            'Solicitud fundamentada de medida cautelar o suspensión del acto',
            'Escrito de cumplimiento de prevenciones (si las hubiere)'
          ],
          promptIA: `Formula los argumentos jurídicos para superar el filtro de admisibilidad y obtener la medida cautelar o suspensión provisional del acto ante ${paisObj.organoConstitucional} en ${paisObj.nombre}.`
        },
        '3. Informe de Autoridad Recurrida y Coadyuvancias': {
          objetivo:
            'Análisis del informe rendido bajo juramento o contestación de la autoridad recurrida, réplica probatoria y presentación de coadyuvancias.',
          entregables: [
            'Matriz de contradicción al informe de la autoridad recurrida',
            'Escrito de réplica o ampliación de hechos nuevos',
            'Intervenciones de coadyuvancia o amicus curiae locales'
          ],
          promptIA: `Analiza cómo rebatir el informe de la autoridad recurrida en este proceso constitucional en ${paisObj.nombre}, destacando contradicciones fácticas, violación al bloque de constitucionalidad y control de convencionalidad interno.`
        },
        '4. Prueba para Mejor Resolver / Vista Oral': {
          objetivo:
            'Evacuación de pruebas adicionales ordenadas por el tribunal constitucional o comparecencia en audiencia/vista pública.',
          entregables: [
            'Aporte de prueba documental o técnica para mejor resolver',
            'Guion de alegatos para vista oral ante el tribunal constitucional',
            'Síntesis ejecutiva de pretensiones y petitoria'
          ],
          promptIA: `Prepara los alegatos centrales y el ofrecimiento de elementos para mejor resolver ante ${paisObj.organoConstitucional} en ${paisObj.nombre}.`
        },
        '5. Sentencia Constitucional de Fondo': {
          objetivo:
            'Notificación y análisis del fallo constitucional (Con Lugar / Sin Lugar), recursos de aclaración/adición o impugnación si la ley nacional lo prevé.',
          entregables: [
            'Ficha de análisis de la sentencia constitucional',
            'Solicitud de aclaración y adición (si procede)',
            'Comunicado en lenguaje claro para los representados'
          ],
          promptIA: `Analiza los efectos jurídicos de la sentencia en esta vía constitucional de ${paisObj.nombre}. Si es favorable, detalla las órdenes de ejecución; si es desestimatoria, evalúa si con este fallo quedaron agotados los recursos de la jurisdicción interna (Art. 46.1.a CADH).`
        },
        '6. Ejecución (o Agotamiento para Escalar a CIDH/ONU)': {
          objetivo: `Ejecución forzosa de la sentencia constitucional y liquidación de costas/daños en ${paisObj.nombre}; o bien, si fue adversa y agotó la vía interna, preparación del escalamiento al SIDH / ONU dentro del plazo de 6 meses.`,
          entregables: [
            'Gestión de cumplimiento o incidente de desacato / ejecución',
            'Liquidación de daños, perjuicios y costas en sede de ejecución',
            'Dictamen de agotamiento de vía interna y cómputo del plazo de 6 meses para CIDH'
          ],
          promptIA: `Diseña la ruta de la Etapa 6 en ${paisObj.nombre}: 1) Pasos para exigir la ejecución efectiva y liquidación de sentencia si fue estimatoria, o 2) Hoja de ruta para escalar el caso a la CIDH / ONU tras haberse agotado la jurisdicción interna.`
        }
      }
    };
  }

  // Vía Nacional Ordinaria: Contencioso-Administrativo, Laboral, Penal, Civil o Sede Administrativa
  const esLaboral = jur.toLowerCase().includes('laboral');
  const organoLocal = esLaboral ? paisObj.organoLaboral : paisObj.organoContencioso;

  return {
    esInternacional: false,
    ambito: 'Nacional',
    pais: paisObj,
    jurisdiccion: jur,
    organoEspecifico: `${organoLocal} (${paisObj.nombre})`,
    etiquetaContraparte: 'Entidad Demandada / Contraparte',
    normaCorto: `Personería Judicial (${paisObj.codigo})`,
    normaTitulo: `Auditoría de Personería Judicial y Presupuestos Procesales (${paisObj.nombre} — ${jur})`,
    normaSubtitulo: `En la jurisdicción ${jur} de ${paisObj.nombre} (${organoLocal}): no aplica el Art. 35 de la Corte IDH aún, sino las reglas procesales internas de personería (${paisObj.requisitoPoderNacional}), identificación vigente y prueba documental/agotamiento administrativo.`,
    descripcionAcreditacion: `En la jurisdicción ${jur} de ${paisObj.nombre} (${organoLocal}): no aplica el Art. 35 de la Corte IDH aún, sino las reglas procesales internas de personería (${paisObj.requisitoPoderNacional}), identificación vigente y prueba documental/agotamiento administrativo.`,
    requisitos: {
      poder: {
        chipLabel: crearEtiquetaHibrida('Poder Judicial', '✓ ', '✗ '),
        fichaLabel: crearEtiquetaHibrida(`Poder Especial Judicial / Mandato (${paisObj.nombre})`, '✓ ', '⏳ ', ': Verificado', ': Pendiente'),
        criterioIA: `Verificar cumplimiento de personería en ${paisObj.nombre}: ${paisObj.requisitoPoderNacional}`
      },
      identidad: {
        chipLabel: crearEtiquetaHibrida('Cédula / ID', '✓ ', '✗ '),
        fichaLabel: crearEtiquetaHibrida(`Documento de Identidad (${paisObj.nombre})`, '✓ ', '⏳ ', ': Verificado', ': Pendiente'),
        criterioIA: `Documento oficial de identidad vigente en ${paisObj.nombre}.`
      },
      prueba: {
        chipLabel: crearEtiquetaHibrida('Prueba / Vía Previa', '✓ ', '○ '),
        fichaLabel: crearEtiquetaHibrida('Prueba Documental / Expediente Administrativo', '✓ ', '⏳ ', ': Acreditada', ': Pendiente'),
        criterioIA:
          'Prueba del derecho reclamado, relación jurídica/laboral, acto administrativo impugnado o reclamo administrativo previo.'
      }
    },
    etapas: ETAPAS_NACIONAL_ORDINARIO,
    guiaEtapas: {
      '1. Personería, Prueba y Vía Administrativa Previa': {
        objetivo: `Recolección de Poderes Especiales Judiciales conforme a la legislación de ${paisObj.nombre}, agotamiento de reclamo administrativo o conciliación previa (si aplica) y armado de prueba documental.`,
        entregables: [
          `Poderes Especiales Judiciales autenticados (${paisObj.nombre})`,
          'Constancia de agotamiento administrativo o conciliación previa',
          'Expediente administrativo y prueba documental de respaldo'
        ],
        promptIA: `Evalúa el cumplimiento de los requisitos de personería judicial, caducidad/prescripción y vía administrativa previa en ${paisObj.nombre} ante ${organoLocal} (${jur}).`
      },
      '2. Demanda Inicial, Admisión y Medidas Cautelares': {
        objetivo: `Presentación de la demanda ante ${organoLocal} en ${paisObj.nombre}, subsanación de prevenciones y solicitud de medidas cautelares.`,
        entregables: [
          'Escrito de Demanda y petitoria principal/subsidiaria',
          'Solicitud de medida cautelar (fumus boni iuris y periculum in mora)',
          'Auto de admisión y emplazamiento a la parte demandada'
        ],
        promptIA: `Estructura los fundamentos de hecho, de derecho interno y de control de convencionalidad para la Demanda y solicitud de medida cautelar ante ${organoLocal} en ${paisObj.nombre}.`
      },
      '3. Contestación, Excepciones y Audiencia Preliminar': {
        objetivo:
          'Análisis de la contestación de la demanda, oposición a excepciones previas/procesales (caducidad, prescripción, falta de legitimación) y fijación del objeto del proceso en audiencia preliminar.',
        entregables: [
          'Escrito de oposición a defensas previas / excepciones',
          'Minuta para Audiencia Preliminar y admisión de pruebas',
          'Hechos controvertidos y fijación de pretensiones'
        ],
        promptIA: `Prepara la estrategia para rebatir las excepciones previas de la contraparte y superar la Audiencia Preliminar ante ${organoLocal} en ${paisObj.nombre}.`
      },
      '4. Evacuación de Prueba / Juicio Oral y Conclusiones': {
        objetivo:
          'Práctica de prueba testimonial, pericial y documental en audiencia de juicio / complementaria y formulación de conclusiones o alegatos de bien probado.',
        entregables: [
          'Interrogatorios para testigos y peritos',
          'Alegato de conclusiones / cierre en audiencia de juicio',
          'Incorporación de prueba sobrevenida (si aplica)'
        ],
        promptIA: `Elabora el guion de interrogatorio y el alegato de conclusiones finales para la audiencia de juicio ante ${organoLocal} en ${paisObj.nombre}.`
      },
      '5. Sentencia de Instancia y Recursos (Apelación/Casación)': {
        objetivo:
          'Análisis de la sentencia de instancia y, en caso de gravamen, interposición oportuna de Recurso de Apelación o Recurso de Casación.',
        entregables: [
          'Análisis de agravios de la sentencia de instancia',
          'Escrito de Recurso de Apelación o Casación fundamentado',
          'Comunicado explicativo del fallo para los representados'
        ],
        promptIA: `Analiza la sentencia dictada en esta jurisdicción de ${paisObj.nombre} y estructura los motivos formales y sustantivos de Apelación o Casación.`
      },
      '6. Firmeza y Ejecución (o Escalamiento a CIDH/ONU)': {
        objetivo: `Ejecución de sentencia firme y liquidación en ${paisObj.nombre}; o bien, si la sentencia definitiva agotó los recursos internos sin reparar la violación, evaluación para escalar el caso ante la CIDH o la ONU.`,
        entregables: [
          'Demanda o proceso de ejecución de sentencia y liquidación',
          'Dictamen sobre agotamiento definitivo de recursos internos',
          'Cómputo del plazo de 6 meses para eventual petición ante la CIDH'
        ],
        promptIA: `Formula el plan de acción para la Etapa 6 en ${paisObj.nombre}: ejecución de sentencia firme y cobro de extremos concedidos, o dictamen de admisibilidad para escalar el caso al Sistema Interamericano (CIDH).`
      }
    }
  };
}

/**
 * Mapea por índice (1. a 6.) cualquier etapa anterior a la etapa equivalente del perfil actual
 */
export function sincronizarEtapaConPerfil(etapaActual = '', perfil) {
  const etapas = perfil?.etapas || ETAPAS_INTERNACIONAL_SIDH;
  if (etapas.includes(etapaActual)) return etapaActual;
  const matchNum = String(etapaActual || '').match(/^([1-6])\./);
  if (matchNum && matchNum[1]) {
    const idx = Number(matchNum[1]) - 1;
    if (etapas[idx]) return etapas[idx];
  }
  return etapas[0];
}
