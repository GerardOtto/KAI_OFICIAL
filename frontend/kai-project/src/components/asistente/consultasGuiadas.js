/** Consultas guiadas del asistente: los informes de brechas de cada ranking.
 *
 *  Cada botón del chat vacío manda un prompt ya escrito que reproduce, para su
 *  ranking, el análisis de brechas de Scimago que se probó a mano (ver
 *  `docs/asistente-consultas-guiadas.md`). El usuario ve solo la pregunta; el
 *  asistente recibe además las instrucciones y la consulta SQL completa.
 *
 *  Las dos partes viajan en un mismo mensaje, separadas por `MARCA`: la pregunta
 *  primero, para que el servidor titule la conversación con ella, y las
 *  instrucciones después. Así el historial guarda lo que de verdad leyó el
 *  modelo —una pregunta de seguimiento lo necesita— y la interfaz, al volver a
 *  abrir la conversación, sabe qué parte mostrar sin una columna nueva en la base.
 *
 *  Por qué la base arma el informe entero. Los cálculos —lugar en Chile, metas,
 *  prioridades— y también el Markdown salen de la consulta: el asistente solo
 *  copia una celda. Es lo que hizo fiable el prompt original (tres respuestas
 *  idénticas al resultado de la consulta); dejar que el modelo componga diez
 *  filas de cifras es invitarlo a redondear o a cambiar una de lugar.
 *
 *  Restricciones del texto de la consulta, impuestas por `consulta_sql` y por
 *  SQLAlchemy: nada de `;` ni de `--` (el guardián los rechaza o los lee como
 *  comentario), ni de dos puntos pegados a una letra (`text()` los toma por un
 *  parámetro), ni de las palabras de las tablas vetadas. La batería
 *  `consultas-guiadas` del backend ejecuta las cuatro contra la base.
 */

export const MARCA = "<!-- kai:instrucciones";
const PATRON_MARCA = /\s*<!-- kai:instrucciones(?: ([a-z0-9-]+))? -->[\s\S]*$/;

/** Lo que el usuario debe ver de un mensaje: sin las instrucciones ocultas. */
export function parteVisible(texto) {
  return String(texto ?? "").replace(PATRON_MARCA, "");
}

/** La consulta guiada de la que sale un mensaje, o null si lo escribió el usuario. */
export function consultaDeMensaje(texto) {
  const id = String(texto ?? "").match(PATRON_MARCA)?.[1];
  return CONSULTAS_GUIADAS.find((c) => c.id === id) || null;
}

/** Título del reporte PDF que abre con esta consulta, como el del informe original. */
export const tituloDeInforme = (c) => `Informe de brechas: PUCV y UV ${c.en}`;

// ---------------------------------------------------------------------------
// Instituciones y rankings
// ---------------------------------------------------------------------------

/** Las universidades del informe: sigla, nombre exacto en la base (sin tildes)
 *  y nombre para mostrar. Son las del informe original; el asistente está
 *  abierto, por ahora, solo a cuentas de la PUCV. */
const INSTITUCIONES = [
  ["PUCV", "Pontificia Universidad Catolica de Valparaiso", "Pontificia Universidad Católica de Valparaíso"],
  ["UV", "Universidad de Valparaiso", "Universidad de Valparaíso"],
];

/** `formato`: cómo se escribe la cifra —«conteo» entero, «decimal», «porcentaje»,
 *  «pesos» y «puntos» (puntaje de 0 a 100)—. `menor`: menos es mejor. */
const SCIMAGO = [
  ["Normalized Impact", "Impacto normalizado", "cuánto se citan sus publicaciones frente al promedio mundial (1 = igual al promedio)", "decimal"],
  ["Technological Impact", "Impacto tecnológico", "porcentaje de sus publicaciones citadas en patentes", "porcentaje"],
  ["Open Access", "Acceso abierto", "porcentaje de sus publicaciones que se leen gratis", "porcentaje"],
  ["Patents", "Patentes", "solicitudes de patente presentadas", "conteo"],
  ["Innovative Knowledge", "Conocimiento innovador", "publicaciones suyas citadas en patentes", "conteo"],
  ["Overton", "Impacto en políticas", "publicaciones citadas en documentos de políticas públicas", "conteo"],
  ["Excellence with Leadership", "Excelencia con liderazgo", "publicaciones en el 10 % más citado del mundo, lideradas por ella", "conteo"],
  ["Excellence", "Excelencia", "publicaciones en el 10 % más citado del mundo", "conteo"],
  ["SDG-related Output", "Producción en ODS", "publicaciones sobre los Objetivos de Desarrollo Sostenible", "conteo"],
  ["Scientific Output", "Producción científica", "total de publicaciones en Scopus", "conteo"],
  ["Scientific Leadership", "Liderazgo científico", "publicaciones en que es la autora principal", "conteo"],
  ["Output in External Journals", "Revistas externas", "publicaciones en revistas de otras editoriales", "conteo"],
  ["Output in Own Journals", "Revistas propias", "revistas científicas que edita", "conteo"],
  ["Female Scientific Pool", "Investigadoras", "mujeres que publican con su afiliación", "conteo"],
  ["Scientific Talent Pool", "Investigadores", "personas que publican con su afiliación", "conteo"],
  ["Plumx", "Menciones (PlumX)", "menciones de sus publicaciones en redes y medios", "conteo"],
  ["Mendeley", "Lecturas (Mendeley)", "lectores de sus publicaciones en Mendeley", "conteo"],
  ["Number of Q1 Articles", "Artículos Q1", "artículos en el cuarto de revistas de mayor impacto", "conteo"],
  ["International Collaboration", "Colaboración internacional", "publicaciones con autores de otros países", "conteo"],
];

const QS = [
  ["Academic reputation", "Reputación académica", "prestigio entre académicos de todo el mundo, según una encuesta de QS"],
  ["Employer reputation", "Reputación ante empleadores", "prestigio de sus titulados entre empleadores, según una encuesta de QS"],
  ["Staff with PhD", "Académicos con doctorado", "proporción de su cuerpo académico con doctorado"],
  ["Faculty student ratio", "Académicos por estudiante", "cuántos académicos tiene por cada estudiante"],
  ["Citations per paper", "Citas por artículo", "cuántas veces se cita, en promedio, cada artículo"],
  ["International research network", "Red internacional de investigación", "variedad de países e instituciones con que investiga"],
  ["Papers per faculty", "Artículos por académico", "cuánto publica su cuerpo académico"],
  ["Web impact", "Impacto web", "visibilidad de su sitio web"],
].map((m) => [...m, "puntos"]);

const THE = [
  ["Teaching", "Docencia", "reputación docente, doctorados, estudiantes por académico e ingresos"],
  ["Research Environment", "Entorno de investigación", "reputación investigadora, ingresos y productividad en investigación"],
  ["Research Quality", "Calidad de la investigación", "citas, influencia y excelencia de sus publicaciones"],
  ["International Outlook", "Perspectiva internacional", "estudiantes, académicos y coautorías extranjeras"],
  ["Industry", "Industria", "ingresos desde empresas y patentes"],
].map((m) => [...m, "puntos"]);

const KAI = [
  ["Fondos de investigación", "Fondos de investigación", "montos adjudicados por la ANID, por académico al año", "pesos"],
  ["Fondos con la industria", "Fondos con la industria", "montos ANID de proyectos con aporte de empresas, por académico al año", "pesos"],
  ["Productividad científica", "Productividad científica", "publicaciones al año por académico de jornada completa", "decimal"],
  ["Citas por publicación", "Citas por publicación", "veces que se cita, en promedio, cada publicación", "decimal"],
  ["Colaboración internacional", "Colaboración internacional", "porcentaje de publicaciones firmadas con instituciones de otro país", "porcentaje"],
  ["Académicos con doctorado", "Académicos con doctorado", "porcentaje de la jornada académica a cargo de doctores", "porcentaje"],
  ["Académicos extranjeros", "Académicos extranjeros", "porcentaje de la jornada académica a cargo de extranjeros", "porcentaje"],
  ["Doctorados otorgados", "Doctorados otorgados", "doctores graduados al año por cada 100 académicos", "decimal"],
  ["Matrícula de posgrado", "Matrícula de posgrado", "porcentaje de sus estudiantes en magíster o doctorado", "porcentaje"],
  ["Estudiantes por académico", "Estudiantes por académico", "estudiantes por cada académico de jornada completa (menos es mejor)", "decimal", true],
];

/** Lo propio de cada ranking. El orden es el de los botones.
 *
 *  `ranking`: nombre exacto en la base. `de` y `en`: cómo se nombra en una frase
 *  («las universidades chilenas del Ranking KAI»). `cita`: la fuente, con el año
 *  en medio. `fuente`: de dónde salen las cifras —el valor medido (Scimago, KAI)
 *  o el puntaje que publica el ranking (QS y THE, cuyas encuestas de reputación
 *  no tienen cifra medida: un informe sobre lo medido dejaría fuera la mitad del
 *  peso de QS)—. */
export const CONSULTAS_GUIADAS = [
  {
    id: "brechas-qs",
    ranking: "QS Latam",
    nombre: "QS Latam",
    de: "de QS Latam",
    en: "en QS Latam",
    pregunta: "QS Latam: ¿dónde pueden mejorar la PUCV y la UV?",
    bajada: "Dónde quedan más atrás la PUCV y la UV y qué puntaje necesitan.",
    fuente: "puntajes",
    metricas: QS,
    hoy: "el puntaje de 0 a 100 que QS le asigna (100 es el máximo).",
    cita: ["QS Latin America University Rankings", ""],
  },
  {
    id: "brechas-the",
    ranking: "THE Latam",
    nombre: "THE Latam",
    de: "de THE Latam",
    en: "en THE Latam",
    pregunta: "THE Latam: ¿dónde pueden mejorar la PUCV y la UV?",
    bajada: "En qué pilares quedan más atrás la PUCV y la UV y qué puntaje necesitan.",
    fuente: "puntajes",
    metricas: THE,
    pilares: true,
    hoy: "el puntaje de 0 a 100 que THE le asigna (100 es el máximo). THE publica puntajes por pilar, no por indicador.",
    cita: ["THE Latin America University Rankings", ""],
  },
  {
    id: "brechas-scimago",
    ranking: "Scimago Latam",
    nombre: "Scimago",
    de: "de Scimago",
    en: "en Scimago",
    pregunta: "Scimago: ¿dónde pueden mejorar la PUCV y la UV?",
    bajada: "Dónde quedan más atrás la PUCV y la UV y qué cifra necesitan.",
    fuente: "medidos",
    metricas: SCIMAGO,
    hoy: "la cifra real de la universidad: un porcentaje, una cantidad o una razón, según la métrica.",
    cita: ["SCImago Institutions Rankings", " (datos de Scopus)"],
  },
  {
    id: "brechas-kai",
    ranking: "Ranking KAI",
    nombre: "Ranking KAI",
    de: "del Ranking KAI",
    en: "en el Ranking KAI",
    pregunta: "Ranking KAI: ¿dónde pueden mejorar la PUCV y la UV?",
    bajada: "Dónde quedan más atrás la PUCV y la UV y qué cifra necesitan.",
    fuente: "medidos",
    metricas: KAI,
    hoy: "la cifra real de la universidad, calculada por KAI. En este ranking las diez métricas pesan lo mismo (10 %).",
    cita: ["Ranking KAI", " (calculado por KAI con datos de SIES, ANID y OpenAlex)"],
  },
];

// ---------------------------------------------------------------------------
// Consulta SQL
// ---------------------------------------------------------------------------

const texto = (s) => `'${String(s).replace(/'/g, "''")}'`;
const NL = "chr(10)";

/** La cifra `v` (numeric) escrita en español según la columna `formato`. Los
 *  decimales dependen de la magnitud y no se recortan: «5,50 %» junto a
 *  «9,64 %» se lee como una columna, «5,5 %» junto a «9,64 %» no. */
const formatear = (v) => `CASE f.formato
 WHEN 'conteo' THEN translate(to_char(round(${v}), 'FM999,999,999,990'), ',', '.')
 WHEN 'puntos' THEN translate(to_char(round(${v}, 1), 'FM999,990.0'), ',.', '.,')
 WHEN 'pesos' THEN CASE WHEN ${v} = 0 THEN '$0'
  WHEN abs(${v}) >= 1000000 THEN '$' || translate(to_char(round(${v} / 1000000, 1), 'FM999,990.0'), ',.', '.,') || ' millones'
  ELSE '$' || translate(to_char(round(${v} / 1000), 'FM999,990'), ',', '.') || ' mil' END
 ELSE translate(CASE WHEN abs(${v}) >= 100 THEN to_char(round(${v}), 'FM999,999,990')
  WHEN abs(${v}) >= 10 THEN to_char(round(${v}, 1), 'FM999,990.0')
  ELSE to_char(round(${v}, 2), 'FM990.00') END, ',.', '.,')
  || CASE WHEN f.formato = 'porcentaje' THEN ' %' ELSE '' END END`;

/** La consulta que arma el informe completo, en una sola celda `informe`.
 *
 *  Pasos: la edición más reciente del ranking; el puntaje total de cada
 *  universidad chilena —su lugar en el total—; el lugar en cada métrica, que es
 *  el universo de comparación; las cinco métricas peor ubicadas de cada
 *  institución más las dos prioritarias (peso × cuán atrás está); las metas, que
 *  son la cifra de quien ocupa hoy el lugar 10 y la mitad del lugar propio; y el
 *  Markdown.
 *
 *  La meta «subir a la mitad» solo se muestra cuando no la cubre ya el top 10
 *  (lugar 21 o peor) o cuando la universidad ya está en él: del 16.º, la mitad
 *  es el 8.º, más difícil que entrar al top 10, y una tabla que pide más para
 *  la meta intermedia que para la final confunde.
 */
export function consultaSQL(c) {
  const cosa = c.pilares ? "pilar" : "métrica";
  const esa = c.pilares ? "ese pilar" : "esa métrica";
  const instituciones = INSTITUCIONES
    .map(([sigla, nombre, titulo], i) => `(${i + 1}, ${texto(sigla)}, ${texto(nombre)}, ${texto(titulo)})`)
    .join(",\n");
  const diccionario = c.metricas
    .map(([n, es, que, formato, menor]) => `(${texto(n)}, ${texto(es)}, ${texto(que)}, ${texto(formato)}, ${menor ? "true" : "false"})`)
    .join(",\n");

  // Las cifras de cada métrica: el valor medido (Scimago, KAI) o el puntaje
  // que publica el ranking (QS, THE, cuyas encuestas no tienen cifra).
  const valores = c.fuente === "medidos"
    ? `JOIN valor_real_universidad v ON v.id_metrica = m.id_metrica AND v.anio_edicion = e.anio
JOIN general g ON g.id_universidad = v.id_universidad
WHERE v.valor IS NOT NULL`
    : `JOIN metrica_universidad v ON v.id_metrica = m.id_metrica AND v.anio_metrica = e.anio
JOIN general g ON g.id_universidad = v.id_universidad
WHERE v.valor_metrica IS NOT NULL`;
  const valor = c.fuente === "medidos" ? "v.valor" : "v.valor_metrica";

  // El recuadro «Cómo leer», en líneas seguidas, sin un «>» vacío entre ellas:
  // Gemini cambiaba esas líneas vacías por blancas y el recuadro se partía en
  // seis citas. El chat y el PDF respetan el salto de línea suelto (remark-breaks).
  // Por lo mismo, los títulos de cada universidad dicen «en Chile» y no «en THE
  // Latam»: tras el nombre inglés, Gemini escribió «in» dos veces de tres.
  const cajon = [
    "> **Cómo leer este informe**",
    `> **Hoy:** ${c.hoy}`,
    `> **Lugar:** su posición entre las ' || (SELECT max(total) FROM general) || ' universidades chilenas ${c.de} ' || (SELECT anio FROM edicion) || ' en cada ${cosa} (el 1.º es el mejor).`,
    `> **Influencia:** cuánto pesa ${c.pilares ? "el pilar" : "la métrica"} en el puntaje total del ranking: alta (10 % o más), media (5 % a 10 %) o baja.`,
    "> **Metas:** la cifra que hoy tiene la universidad ubicada en ese lugar. Alcanzarla permitiría llegar ahí. «Mitad» es subir a la mitad de su lugar actual (por ejemplo, del 28.º al 14.º) y muestra «—» cuando el top 10 queda más cerca.",
    `> **Prioridad:** ${c.pilares ? "los dos pilares" : "las dos métricas"} que más pueden subir su puntaje total, porque pesan mucho y la universidad está lejos de los primeros lugares.`,
  ].join(`' || ${NL} || '`);

  return `WITH inst AS (SELECT * FROM (VALUES
${instituciones}
) AS t(n_inst, sigla, nombre, titulo)),
dic AS (SELECT * FROM (VALUES
${diccionario}
) AS t(n, es, que, formato, menor)),
rk AS (SELECT id_ranking FROM ranking WHERE nombre_ranking = ${texto(c.ranking)}),
edicion AS (SELECT max(mu.anio_metrica) AS anio FROM rk
JOIN metrica m ON m.id_ranking = rk.id_ranking
JOIN metrica_universidad mu ON mu.id_metrica = m.id_metrica),
totales AS (SELECT mu.id_universidad, sum(mu.valor_metrica * m.peso_metrica / 100) AS puntaje
FROM rk JOIN edicion e ON true
JOIN metrica m ON m.id_ranking = rk.id_ranking AND m.pondera
JOIN metrica_universidad mu ON mu.id_metrica = m.id_metrica AND mu.anio_metrica = e.anio
JOIN universidad u ON u.id_universidad = mu.id_universidad AND u.pais_universidad = 'Chile'
GROUP BY mu.id_universidad),
general AS (SELECT id_universidad, rank() OVER (ORDER BY puntaje DESC) AS puesto, count(*) OVER () AS total FROM totales),
base AS (SELECT m.id_metrica, m.peso_metrica::numeric AS peso, d.es, d.que, d.formato, d.menor,
g.id_universidad, ${valor}::numeric AS valor
FROM rk JOIN edicion e ON true
JOIN metrica m ON m.id_ranking = rk.id_ranking AND m.pondera AND m.peso_metrica > 0
JOIN dic d ON d.n = m.nombre_metrica
${valores}),
orden AS (SELECT b.*, rank() OVER w AS puesto, row_number() OVER w AS posicion,
count(*) OVER (PARTITION BY b.id_metrica) AS total
FROM base b WINDOW w AS (PARTITION BY b.id_metrica ORDER BY CASE WHEN b.menor THEN b.valor ELSE -b.valor END)),
propias AS (SELECT i.n_inst, i.sigla, i.titulo, o.*,
row_number() OVER (PARTITION BY i.sigla ORDER BY o.puesto::numeric / o.total DESC, o.peso DESC) AS peor,
row_number() OVER (PARTITION BY i.sigla ORDER BY o.peso * (o.puesto - 1) / greatest(o.total - 1, 1) DESC, o.peso DESC) AS urgencia
FROM orden o JOIN universidad u ON u.id_universidad = o.id_universidad
JOIN inst i ON i.nombre = u.nombre_universidad),
metas AS (SELECT p.*, ceil(p.puesto / 2.0)::int AS puesto_mitad,
(SELECT o.valor FROM orden o WHERE o.id_metrica = p.id_metrica AND o.posicion = ceil(p.puesto / 2.0)) AS v_mitad,
(SELECT o.valor FROM orden o WHERE o.id_metrica = p.id_metrica AND o.posicion = 10) AS v_top10
FROM propias p WHERE p.peor <= 5 OR p.urgencia <= 2),
cifras AS (SELECT f.sigla, f.id_metrica, f.k, ${formatear("f.v")} AS txt
FROM (SELECT sigla, id_metrica, formato, 'hoy' AS k, valor AS v FROM metas
UNION ALL SELECT sigla, id_metrica, formato, 'mitad', v_mitad FROM metas
UNION ALL SELECT sigla, id_metrica, formato, 'top10', v_top10 FROM metas
UNION ALL SELECT sigla, id_metrica, formato, 'dif', abs(CASE WHEN puesto > 10 THEN v_top10 ELSE v_mitad END - valor) FROM metas) f),
textos AS (SELECT sigla, id_metrica,
max(txt) FILTER (WHERE k = 'hoy') AS hoy, max(txt) FILTER (WHERE k = 'mitad') AS mitad,
max(txt) FILTER (WHERE k = 'top10') AS top10, max(txt) FILTER (WHERE k = 'dif') AS dif
FROM cifras GROUP BY sigla, id_metrica),
filas AS (SELECT m.*, t.hoy, t.mitad, t.top10, t.dif,
CASE WHEN m.peso >= 10 THEN 'alta' WHEN m.peso >= 5 THEN 'media' ELSE 'baja' END AS nivel,
translate(trim_scale(m.peso)::text, '.', ',') AS peso_txt,
CASE WHEN m.formato = 'puntos' THEN ' puntos' ELSE '' END AS unidad,
CASE WHEN m.menor THEN ' menos' ELSE ' más' END AS sentido
FROM metas m JOIN textos t ON t.sigla = m.sigla AND t.id_metrica = m.id_metrica),
lineas AS (SELECT f.*,
'| ' || f.es || CASE WHEN f.urgencia <= 2 THEN ' · **prioridad ' || f.urgencia || '**' ELSE '' END
|| ' | ' || f.hoy || ' | ' || f.puesto || '.º de ' || f.total
|| ' | ' || initcap(f.nivel) || ' (' || f.peso_txt || ' %)'
|| ' | ' || CASE WHEN f.puesto > 1 AND (f.puesto <= 10 OR f.puesto_mitad > 10) THEN f.mitad || ' (' || f.puesto_mitad || '.º)' ELSE '—' END
|| ' | ' || CASE WHEN f.puesto <= 10 THEN 'ya está' ELSE f.top10 END || ' |' AS fila,
f.urgencia || '. **' || f.es || '** (influencia ' || f.nivel || ', ' || f.peso_txt || ' %): '
|| CASE WHEN f.puesto > 10 THEN 'pasar de ' || f.hoy || ' a **' || f.top10 || '**' || f.unidad || ' ('
|| CASE WHEN f.formato IN ('conteo', 'puntos') OR f.valor = 0 THEN f.dif || f.unidad
WHEN abs(f.v_top10 / f.valor - 1) < 0.01 THEN 'menos de un 1 %' ELSE 'un ' || round(100 * abs(f.v_top10 / f.valor - 1)) || ' %' END
|| f.sentido || ' que hoy) la dejaría en el top 10 de ${esa}.'
WHEN f.puesto > 1 THEN 'ya está en el top 10 (' || f.puesto || '.º). Llegar a **' || f.mitad || '**' || f.unidad || ' ('
|| CASE WHEN f.formato IN ('conteo', 'puntos') OR f.valor = 0 THEN f.dif || f.unidad
WHEN abs(f.v_mitad / f.valor - 1) < 0.01 THEN 'menos de un 1 %' ELSE 'un ' || round(100 * abs(f.v_mitad / f.valor - 1)) || ' %' END
|| f.sentido || ' que hoy) la subiría al lugar ' || f.puesto_mitad || '.º.'
ELSE 'es la 1.ª de Chile en ${esa}: el desafío es mantener el lugar.' END AS enfoque
FROM filas f),
bloques AS (SELECT l.n_inst,
'## ' || l.titulo || ' (' || l.sigla || '): ' || g.puesto || '.º de ' || g.total || ' en Chile'
|| ${NL} || ${NL} || '${c.pilares ? "Sus pilares, del más rezagado al menos" : "Sus métricas más bajas, de la más rezagada a la menos"}.'
|| ${NL} || ${NL} || '| ${c.pilares ? "Pilar" : "Métrica"} | Hoy | Lugar | Influencia | Meta: mitad | Meta: top 10 |'
|| ${NL} || replace('|x|x:|x:|x|x:|x:|', 'x', repeat('-', 3))
|| ${NL} || string_agg(l.fila, ${NL} ORDER BY l.puesto::numeric / l.total DESC, l.peso DESC)
|| ${NL} || ${NL} || '**Dónde enfocarse**' || ${NL} || ${NL}
|| string_agg(l.enfoque, ${NL} ORDER BY l.urgencia) FILTER (WHERE l.urgencia <= 2) AS texto
FROM lineas l JOIN general g ON g.id_universidad = l.id_universidad
GROUP BY l.n_inst, l.titulo, l.sigla, g.puesto, g.total),
glosario AS (SELECT string_agg('- **' || es || ':** ' || que || '.', ${NL} ORDER BY es) AS texto
FROM (SELECT DISTINCT es, que FROM metas) d)
SELECT '${cajon}'
|| ${NL} || ${NL} || (SELECT string_agg(b.texto, ${NL} || ${NL} ORDER BY b.n_inst) FROM bloques b)
|| ${NL} || ${NL} || '**Qué mide cada ${cosa}**' || ${NL} || ${NL} || (SELECT texto FROM glosario)
|| ${NL} || ${NL} || '*Fuente: ${c.cita[0]} ' || (SELECT anio FROM edicion)
|| '${c.cita[1]}, la edición más reciente cargada en KAI. Las metas suponen que las demás universidades no cambian: son una guía, no una predicción.*' AS informe
LIMIT 1`;
}

// ---------------------------------------------------------------------------
// Mensaje completo
// ---------------------------------------------------------------------------

/** El mensaje que se envía: la pregunta visible, la marca y las instrucciones.
 *
 *  La consulta no trae ninguna frase que sirva de respuesta —ni siquiera un
 *  aviso de «no hay datos»—: Gemini, puesto a prueba, respondió una vez con ese
 *  aviso sin ejecutar la consulta, porque lo encontró escrito en el SQL. Por lo
 *  mismo el paso 1 dice que el resultado no se puede deducir leyéndola.
 */
export function construirMensaje(c) {
  return `${c.pregunta}

${MARCA} ${c.id} -->
Instrucciones para el asistente. El usuario pulsó un botón y solo ve la pregunta de arriba.

Paso 1. Llama a la herramienta consulta_sql con exactamente esta consulta, sin modificarla ni dividirla. Hazlo siempre: el resultado depende de los datos cargados hoy y no se puede deducir leyendo la consulta. No uses otras herramientas, salvo que la consulta falle.

${consultaSQL(c)}

Paso 2. La herramienta devuelve una sola celda, informe, con el informe completo en Markdown. Responde únicamente con ese texto, copiado tal cual: los mismos títulos, tablas, listas y cifras, en el mismo orden. No lo pongas dentro de un bloque de código, no redondees ni cambies ninguna cifra y no agregues introducción, comentarios ni conclusiones.

Si la consulta falla o la celda viene vacía, dilo en una frase y no inventes cifras.`;
}
