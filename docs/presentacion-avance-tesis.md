# Presentación de avance de tesis — KAI

**Documento de especificación para el agente de diseño.** Contiene qué debe decir cada
diapositiva, con qué recurso visual y con qué datos. Todas las cifras de este documento
están verificadas contra el código, la base de datos y el repositorio del proyecto: **no
inventes ni redondees cifras que no aparezcan aquí**. Si un dato falta, omítelo antes que
estimarlo.

---

## 1. Ficha

| Campo | Valor |
|---|---|
| Proyecto | **KAI (Key Academic Indicator)** — plataforma de análisis, simulación y pronóstico de rankings institucionales |
| Integrantes | Gerard Otto · Fernando Arellano |
| Carrera | Ingeniería Civil Informática — Pontificia Universidad Católica de Valparaíso |
| Tipo | Presentación de avance de proyecto de título |
| Audiencia | Comisión académica (profesor guía y correferente) y contraparte institucional |
| Duración estimada | 15–20 minutos · 18 diapositivas de contenido + portada y cierre |

---

## 2. Directrices de diseño

### 2.1 Regla principal

**Cada diapositiva es un recurso visual con rótulos, no un texto con una imagen de apoyo.**

- Máximo **40 palabras** por diapositiva, contando títulos y etiquetas del diagrama.
- Prohibidos los párrafos. Las viñetas, solo cuando el contenido es una enumeración real
  y nunca más de cinco, de una línea cada una.
- Toda cifra va en el diagrama o en la tabla, nunca repetida en el texto.
- El texto literal que debe aparecer está entre comillas en cada diapositiva. Si no está
  entre comillas, es una indicación para ti, no contenido de la diapositiva.

### 2.2 Sistema visual

Reutiliza el sistema visual del propio producto: la presentación debe parecerse a la
plataforma que describe.

| Token | Valor |
|---|---|
| Fondo | `#131313` |
| Superficie | `#1c1b1b` · elevada `#2a2a2a` |
| Contorno | `#474747` · suave `#919191` |
| Acento | `#60aaf3` |
| Positivo / negativo / atención | `#5ec386` / `#e66e68` / `#e8aa4e` |

Paleta de series de datos (doce colores, en este orden):
`#60aaf3` `#e8aa4e` `#5ec386` `#ab8be3` `#e66e68` `#46c6cd` `#c9c261` `#d37db8`
`#82a5e4` `#93c88c` `#ea906d` `#9a8bd7`

Tipografía por función: **serif** en titulares, **sans-serif** en texto, **monoespaciada**
en cifras y etiquetas de eje —esta última por la alineación tabular de los dígitos—.

### 2.3 Convenciones de los diagramas

- Un color de acento por diagrama; el resto en grises. El color marca lo que importa.
- Las flechas indican dirección del dato, no secuencia temporal, salvo en los diagramas
  de flujo, donde deben numerarse.
- Los componentes externos al proyecto (proveedores de IA, portales de rankings) van con
  **borde punteado**; lo construido, con borde sólido.
- Estados y límites (por ejemplo, «exige sesión») se marcan con un icono de candado, no
  con texto.

---

## 3. Diapositivas

### D1 — Portada

Texto: «**KAI — Key Academic Indicator**» / «Plataforma de análisis, simulación y
pronóstico de rankings institucionales» / «Gerard Otto · Fernando Arellano» /
«Ingeniería Civil Informática — PUCV».

Visual: composición limpia sobre fondo oscuro. Sin diagramas.

---

### D2 — El problema

Texto: «Siete rankings, siete metodologías, ninguna herramienta que los integre».

Visual — **mapa de dispersión del dato actual**, de izquierda a derecha:

1. Columna izquierda: siete tarjetas pequeñas, una por fuente (THE Latam, QS Latam,
   QS Global, QS por Disciplina, Scimago Latam, Shanghai ARWU, Shanghai GRAS), cada una
   con un formato distinto rotulado (`HTML`, `JSON`, `XLSX`, `API no documentada`).
2. Centro: un único icono de planilla, con la etiqueta «consolidación manual».
3. Derecha: un rombo de decisión con la etiqueta «decisión reactiva».

Marca en rojo (`#e66e68`) el cuello de botella central.

---

### D3 — Objetivo general y objetivos específicos

Texto del objetivo general: «Desarrollar una plataforma web que integre, estandarice,
visualice y simule el posicionamiento institucional en los rankings QS, THE, SCImago y
Shanghai, sentando las bases técnicas y de negocio para su evolución hacia un sistema
con inteligencia artificial y procesamiento de lenguaje natural».

Visual — **esquema radial**: el objetivo general al centro y cuatro ramas numeradas:

| # | Objetivo específico | Estado |
|---|---|---|
| 1 | Integrar y estandarizar los datos de los rankings en un modelo común | Cumplido |
| 2 | Visualizar la evolución histórica y simular escenarios | Cumplido |
| 3 | Incorporar un asistente conversacional que responda con trazabilidad al dato | Cumplido |
| 4 | Sentar las bases del modelo de negocio y la transferencia tecnológica | Cumplido |

El estado se representa con un anillo de progreso en cada rama, no con la palabra escrita.

---

### D4 — Qué se construyó

Texto: «Seis módulos sobre una base común».

Visual — **mapa del sitio**. Nodo raíz «Encabezado» y seis hojas:

- Resumen de rankings · Tendencias · Simulación (2 modos) · Glosario de métricas ·
  Investigadores (2 vistas) · Asistente conversacional.

El nodo «Asistente» lleva candado: es el único módulo que exige sesión iniciada, porque
es el único con costo marginal por consulta. Los demás son públicos.

---

### D5 — Arquitectura por capas

Texto: ninguno más allá de los rótulos del diagrama.

Visual — **cuatro bandas horizontales apiladas**, de arriba abajo:

| Capa | Contenido a rotular |
|---|---|
| Presentación | React SPA · enrutamiento en cliente · *hooks* por endpoint · gráficos SVG |
| Simulación | Se ejecuta **en el cliente**: suma ponderada sobre datos ya descargados |
| Servicios | API REST (FastAPI) · 31 endpoints · autenticación · asistente (2 motores) |
| Datos | PostgreSQL · 12 tablas · ETL por guiones con carga transaccional |

Destaca la capa de simulación con el acento: vive en el navegador y es la razón de que el
recálculo sea inmediato y no consuma servidor.

---

### D6 — Arquitectura física y despliegue

Visual — **diagrama de despliegue** en dos zonas:

- **Zona local (Docker Compose)**: tres contenedores conectados.
  `postgres:15` (volumen persistente, `pg_isready`) → `python:3.12-slim` (FastAPI +
  Uvicorn, puerto 8000) → `node:20-slim` (Vite, puerto 5173). La flecha
  base → API se rotula «arranca solo si la comprobación de salud pasa».
- **Zona producción**: Railway construye desde el repositorio y administra PostgreSQL.
- **Externos (borde punteado)**: Anthropic y Google, conectados solo a la capa de
  servicios.

---

### D7 — Modelo relacional

Texto: «12 tablas · dos dominios».

Visual — **diagrama entidad-relación simplificado**, en dos bloques de color distinto.

**Bloque académico (7 tablas):**

| Tabla | Clave primaria |
|---|---|
| `ranking` | `id_ranking` |
| `universidad` | `id_universidad` |
| `metrica` | `id_metrica` |
| `metrica_universidad` | `id_metrica`, `id_universidad`, `anio_metrica` |
| `cientifico` | `id_cientifico` |
| `cientifico_metrica` | `id_cientifico`, `anio_datos`, `fuente` |
| `cientifico_topico` | `id_cientifico`, `topico`, `fuente`, `anio_datos` |

**Bloque de operación (5 tablas):**

| Tabla | Clave primaria |
|---|---|
| `usuario` | `id_usuario` |
| `plan` | `codigo_plan` |
| `conversacion` | `id_conversacion` |
| `mensaje` | `id_mensaje` |
| `notificacion` | `id_notificacion` |

Relaciones a dibujar: `ranking` 1—N `metrica` 1—N `metrica_universidad` N—1 `universidad`;
`cientifico` 1—N `cientifico_metrica` y 1—N `cientifico_topico`; `plan` 1—N `usuario`
1—N `conversacion` 1—N `mensaje`.

Resalta con una nota al margen las dos claves que incluyen **`fuente`**: es lo que permite
que un mismo investigador figure en dos fuentes sin colisión —el caso real son seis
investigadores presentes en ambas—.

---

### D8 — Flujo del dato: de la fuente a la base

Visual — **diagrama de flujo numerado, cuatro pasos**, de izquierda a derecha:

1. **Extracción** → archivo CSV intermedio.
2. **Carga a tabla temporal** (`\copy`, sin restricciones de integridad).
3. **Inserción transaccional** (`INSERT…SELECT` dentro de `BEGIN`/`COMMIT`).
4. **Verificación** (conteos y contraste de valores contra la publicación original).

Anota bajo el paso 1: «separar extraer de cargar permite repetir la carga sin volver a
consultar la fuente». Anota bajo el 3: «si la verificación falla, se revierte sin estado
parcial».

---

### D9 — Cobertura de datos

Texto: «16.138 observaciones · 1.239 métricas · 58 instituciones · 2003–2027».

Visual — **tabla** con una columna de barras para «Filas»:

| Ranking | Métricas | Discipl. | Período | Univ. | Filas |
|---|---:|---:|---|---:|---:|
| THE Latam | 22 | 1 | 2016–2026 | 35 | 1.340 |
| QS Latam | 10 | 1 | 2024–2026 | 41 | 1.046 |
| Scimago Latam | 20 | 1 | 2018–2023 | 57 | 6.120 |
| Shanghai GRAS | 836 | 57 | 2017–2025 | 22 | 2.542 |
| QS Global | 10 | 1 | 2024–2027 | 25 | 870 |
| Shanghai ARWU | 6 | 1 | 2003–2025 | 5 | 323 |
| QS por Disciplina | 335 | 55 | 2023–2026 | 19 | 3.897 |

Añade al pie, en una línea: dominio bibliométrico de **4.245 investigadores** y **6.752**
asociaciones a tópicos.

---

### D10 — El asistente: cómo responde

Texto: «Ninguna cifra se responde de memoria».

Visual — **diagrama de secuencia horizontal**, cinco actores:
`Usuario → API → Motor (LLM) → Herramienta → PostgreSQL`, con el retorno hacia atrás.

Numera el ciclo:

1. Pregunta en lenguaje natural.
2. La API arma el turno: instrucción de sistema + resumen de cobertura + 10 herramientas.
3. El modelo **solicita** una herramienta; no la ejecuta.
4. El backend la ejecuta contra PostgreSQL y devuelve el resultado.
5. El ciclo se repite hasta que el modelo puede responder (tope de 8 iteraciones).

Marca con el acento el paso 3–4: es el punto donde el diseño garantiza que la cifra
proviene de una consulta real y auditable.

---

### D11 — El asistente: especificaciones

Visual A — **tabla comparativa de motores**:

| | Claude | Gemini |
|---|---|---|
| Modelo | `claude-opus-5` | `gemini-3.1-flash-lite` |
| Uso | Razonamiento profundo, varios pasos | Consultas directas de datos |
| Costo relativo por token | ≈ 20× | 1× |
| Herramientas de datos | Las mismas 10 | Las mismas 10 |
| Búsqueda en internet | `web_search`, `web_fetch` | `google_search`, `url_context` |

Visual B — **las diez herramientas en tres grupos** (chips, no lista larga):

- *Catálogo y metodología*: `listar_rankings`, `detalle_ranking`, `buscar_metricas`
- *Instituciones y valores*: `buscar_universidades`, `consultar_valores`,
  `consultar_tendencia`, `consultar_ranking_resumen`
- *Bibliometría*: `buscar_cientificos`, `perfil_cientifico`
- *Salida de emergencia*: `consulta_sql`

Nota de una línea: el motor queda **fijado por conversación**; para cambiarlo se *deriva*
la pregunta a una conversación nueva, porque el historial no es intercambiable entre
proveedores.

---

### D12 — Dos fuentes, una regla

Texto: «La base manda en lo que contiene; internet cubre el resto».

Visual — **diagrama de decisión** de dos ramas que convergen en una respuesta:

- Rama izquierda: «¿está en la base?» → sí → herramienta → dato auditable.
- Rama derecha: no → búsqueda web → fuentes oficiales (`timeshighereducation.com`,
  `topuniversities.com`, `scimagoir.com`, `shanghairanking.com`).
- Convergencia: la respuesta **marca la procedencia de cada cifra**; si ambas discrepan,
  muestra las dos y explica la causa probable.

Cierra con una anotación destacada: una discrepancia entre la base y el sitio oficial no
es un error que ocultar, es el hallazgo que le interesa a una unidad de análisis.

---

### D13 — Seguridad: la consulta libre y su contención

Texto: «El asistente escribe SQL. No puede leer datos de personas».

Visual — **embudo de cuatro capas**, de arriba (más frágil) abajo (más sólida):

1. Una sola sentencia, que empiece por `SELECT` o `WITH`.
2. Rechazo de escrituras, del catálogo interno y de la lectura de archivos.
3. Lista blanca de **7 tablas académicas**; rechazo de las **5 tablas vetadas**
   (`usuario`, `conversacion`, `mensaje`, `notificacion`, `plan`).
4. **Transacción de solo lectura** impuesta por PostgreSQL.

A la derecha del embudo, una nota: las tres primeras capas son análisis del texto y
dependen de contemplar todas las formas de escribir lo mismo; la cuarta no depende de
acertar. Añade el dato de verificación: **28 intentos de evasión**, todos rechazados.

---

### D14 — Lógica de usuarios

Visual A — **flujo de acceso**: dos entradas que convergen.

- «Correo + contraseña» (bcrypt con sal) y «Cuenta de Google» (verificación de firma,
  emisor, caducidad y **audiencia**) → ambas emiten **un testigo propio** JWT HS256, de
  12 horas.
- Nota: si el correo coincide, la cuenta de Google se **vincula** a la existente en lugar
  de duplicarla.

Visual B — **control de cuota por turno**, diagrama de compuertas en orden:

1. ¿El plan incluye el motor? → no → **403**
2. ¿Queda cuota mensual del motor y tope diario? → no → **429**
3. Cerrojo por usuario → se registra el turno → se llama al proveedor.

Anota junto al cerrojo: comprobar y consumir son dos operaciones; sin serializarlas, doce
peticiones simultáneas sobre un tope de cinco dejaban pasar ocho. Con el cerrojo, pasan
exactamente cinco.

---

### D15 — Planes basados en tokens

Texto: «El precio se deriva del costo real del modelo».

Visual — **tabla de planes** más una columna de barra para el margen:

| Plan | USD/mes | Gemini | Claude | Consultas/día | Costo máx. | Margen |
|---|---:|---:|---:|---:|---:|---:|
| Gratuito | 0 | 300 k | — | 15 | 0,11 | — |
| Investigador | 12 | 2 M | 300 k | 80 | 2,85 | 4,2× |
| Departamento | 45 | 6 M | 1,2 M | 300 | 10,65 | 4,2× |
| Institucional | 180 | 25 M | 5 M | sin tope | 44,38 | 4,1× |

Recuadro lateral con la derivación del precio, en tres líneas:

- Proporción supuesta 90 % entrada / 10 % salida.
- Precio por millón de tokens contabilizados: **7,00 USD** en Claude, **0,375 USD** en Gemini.
- La cuota es **por motor**, no una bolsa común: un token de Claude cuesta ≈ 20 veces uno
  de Gemini y un saldo único desacoplaría precio y costo.

---

### D16 — Cambios de usabilidad

Visual — **tres pares antes/después**, en miniaturas esquemáticas, no capturas:

| Cambio | Antes | Después |
|---|---|---|
| Navegación adaptable | El encabezado desbordaba la ventana entre 768 y 940 px | Navegación completa desde 1024 px y **menú compacto** por debajo, que además cubre el móvil, que nunca tuvo navegación |
| Vista de entrada de Tendencias | Comparación anual | **Evolución**: la pregunta habitual al abrir es cómo se movió la institución en el tiempo |
| Glosario multidisciplinario | Dimensión «Artículos» con 19.890 % | Cuota dentro de la disciplina, promediada: las cinco dimensiones suman **100,0 %** |

Para el tercer cambio, incluye la tabla de composición de Shanghai GRAS:
Artículos 53,2 % · Reputación 15,0 % · Académicos 13,3 % · Investigación 12,1 % ·
Internacionalización 6,4 %.

---

### D17 — Tecnologías por sección del sitio

Visual — **tabla-mapa**: filas por sección del sitio, columna de tecnología destacada y
columna de tecnologías de apoyo en punteo pequeño.

Destaca en grande **tres piezas**, una por fila resaltada:

| Sección | Pieza destacada | Por qué |
|---|---|---|
| Gráficos (Tendencias, Glosario) | **SVG construido a medida** | Las métricas conviven en escalas incompatibles; la normalización contra el *techo observado* exige control del trazado que una biblioteca genérica no da |
| Servido de datos | **FastAPI + SQLAlchemy Core** | SQL explícito con parámetros ligados; una consulta por vista, con *lateral joins* que evitan una petición por investigador |
| Disposición de elementos | **Tailwind CSS con tokens de diseño** | Color, tipografía y espaciado centralizados; es lo que permite que la navegación cambie de forma según el ancho sin reescribir vistas |

Tecnologías de apoyo, en punteo breve por zona:

- **Cliente**: React 19 · Vite 8 · React Router 7 · Framer Motion 12
- **Exportación**: jsPDF 4 · html2canvas 1.4 · SheetJS 0.18
- **Respuestas del asistente**: react-markdown 10 · remark-gfm 4 · remark-breaks 4
- **Backend**: Python 3.12 · Uvicorn 0.42 · SQLAlchemy 2.0 · psycopg2
- **Autenticación**: PyJWT 2.13 · bcrypt 5.0 · google-auth 2.57
- **Asistente**: SDK Anthropic 0.120 · SDK google-genai 2.22
- **Datos**: PostgreSQL
- **Extracción**: Selenium 4 · Chrome DevTools Protocol
- **Infraestructura**: Docker · Docker Compose · Railway · GitHub Actions

---

### D18 — Desarrollo acelerado con Claude Code

Texto: «La herramienta acelera la construcción; no sustituye la decisión».

Visual — **diagrama de ciclo de trabajo** de cuatro estaciones, con una banda que
distingue lo delegado de lo humano:

1. **Especificar** (humano): qué se construye y bajo qué restricción.
2. **Construir** (asistido): implementación, guiones de extracción, suites de verificación.
3. **Verificar** (asistido y ejecutable): el resultado se contrasta contra la base, el
   navegador o el proveedor real.
4. **Decidir** (humano): diseño, aceptación del resultado y redacción final.

Ilustra el efecto con lo que el enfoque hizo posible en este proyecto:

- Las suites de verificación —**347 comprobaciones**— se escribieron junto al código, no
  después, lo que permitió detectar defectos que la inspección no revela: el consumo de
  cuota bajo peticiones simultáneas y una vía de acceso a datos personales mediante
  identificadores entre comillas.
- El extractor de Scopus (**747 líneas**, con captura de sesión entre dominios y esquema
  productor–consumidor) recopiló **3.987** perfiles.

Cierra con la delimitación honesta: todas las decisiones de diseño y la validación de
resultados fueron humanas.

---

### D19 — Verificación y CI/CD

Texto: «Una orden, 347 comprobaciones».

Visual A — **cinta de la tubería de integración continua**:
`push` → GitHub Actions → servicio PostgreSQL → carga del volcado **sin datos personales**
→ `python pruebas/ejecutar.py` → veredicto.

Visual B — **tabla de cobertura**, agrupada:

| Grupo | Comprobaciones |
|---|---:|
| Backend (7 suites: herramientas y contención SQL, motor Gemini, planes, convivencia de motores, búsqueda web, turno completo, concurrencia) | 209 |
| Navegador (4 sondas: encabezado, glosario, portada, tendencias) | 128 |
| Contra el proveedor real | 10 |
| **Total** | **347** |

Nota breve sobre las técnicas que no son habituales: verificación **adversaria** (28
intentos de vulnerar el límite de seguridad), **concurrente** (12 peticiones simultáneas) y
**contra el proveedor real**, la única que detecta un modelo retirado del servicio o una
cuota agotada en un recurso distinto del previsto.

---

### D20 — Conclusiones y valor para la PUCV

Visual — **tres columnas**, cada una con un icono y tres líneas máximo:

| Columna | Contenido |
|---|---|
| **Lo integrado** | Siete rankings de cuatro familias y 4.245 investigadores bajo un modelo común, donde antes había siete fuentes y una planilla |
| **Lo diferenciador** | Un asistente que responde sobre todo el dominio académico y distingue el dato propio del de internet, con cada cifra trazable a una consulta |
| **Lo que habilita** | Autenticación, cuotas y precios derivados del costo: la plataforma puede ofrecerse como servicio |

Valor para la PUCV, en tres puntos rotulados sobre la tercera columna:

- La unidad de análisis institucional deja de reconstruir a mano lo que ya está consolidado.
- El simulador traduce una decisión de inversión en un efecto sobre el puntaje y la posición.
- Base para una EBCT (KAI SpA), con registro de marca y software y apoyo de la OTL y la
  Dirección de Innovación.

---

### D21 — Trabajo futuro

Visual A — **hoja de ruta** en tres horizontes, como línea temporal:

| Horizonte | Líneas |
|---|---|
| Corto | Validación cuantitativa con usuarios (SUS y tiempos de tarea) · sondas de navegador en integración continua |
| Medio | Vigencia y jerarquía en el modelo de métricas · datos a nivel de publicación · predicción por series temporales |
| Largo | **Motor de costo y retorno** |

Visual B — **esquema del motor de costo y retorno**, la línea destacada de la diapositiva.
Diagrama de cuatro bloques encadenados:

1. **Brecha por métrica**: distancia de la institución frente a una de referencia, dato que
   la plataforma ya calcula.
2. **Costo unitario**: cuánto cuesta mover un punto de esa métrica, en **dinero** y en
   **horas-hombre**.
3. **Optimización**: qué combinación de inversiones maximiza el puntaje ganado por unidad
   de costo, bajo un presupuesto dado.
4. **Resultado**: puntaje y posición proyectados, con el gasto y las horas asociadas.

Rotula la pregunta que el módulo debe responder: «¿en qué variable invierto, cuánto cuesta
y cuántas posiciones gano?».

Aclara por qué no está construido: exige un modelo del comportamiento del ranking —las
normalizaciones que aplica antes de ponderar— y no solo sus datos, que es lo que la
plataforma tiene hoy.

---

### D22 — Cierre

Texto: «KAI — Key Academic Indicator» y los nombres de los integrantes. Sin diagramas.

---

## 4. Hoja de datos verificados

Para que no haya que buscar cifras fuera de este documento.

**Datos**: 7 rankings · 1.239 métricas · 58 instituciones · 16.138 observaciones ·
período 2003–2027 · 4.245 investigadores · 4.251 registros de métricas bibliométricas ·
6.752 asociaciones a tópicos · 2.831 tópicos distintos · 12 tablas.

**API**: 31 endpoints (26 de consulta, 4 de creación, 1 de eliminación).

**Asistente**: 2 motores · 10 herramientas de datos · 4 herramientas de servidor ·
tope de 8 iteraciones por turno · historial de 20 mensajes · 16 situaciones de fallo
distinguidas en el motor Claude · 7 razones de terminación anómala en el motor Gemini.

**Seguridad**: 7 tablas en lista blanca · 5 tablas vetadas · 4 capas de contención ·
28 intentos de evasión verificados · JWT HS256 de 12 horas · bcrypt con sal.

**Planes**: 4 públicos y 2 internos · margen 4,1×–4,2× · 7,00 y 0,375 USD por millón de
tokens contabilizados · ≈ 1.300 tokens por consulta en Gemini (medido) y ≈ 3.000 en Claude
(estimado).

**Verificación**: 347 comprobaciones (209 + 128 + 10) · integración continua sobre el
conjunto de backend.

**Interfaz**: navegación completa desde 1024 px · navegación mide 672 px · el encabezado
requiere 940 px · paleta de 12 series · advertencia de proyección bajo R² 0,90 · copia de
impresión de 1400 px de ancho.

**Composición de Shanghai GRAS**: Artículos 53,2 % · Reputación 15,0 % · Académicos 13,3 %
· Investigación 12,1 % · Internacionalización 6,4 % · Total 100,0 %.

---

## 5. Qué no debe aparecer

- Capturas de pantalla como sustituto de un diagrama: si una vista debe mostrarse, que sea
  un esquema de sus zonas, no una imagen densa.
- Fragmentos de código. La única excepción admisible son nombres de herramientas o de
  tablas, en monoespaciada y dentro de un diagrama.
- Cifras de validación con usuarios: el proyecto no documenta mediciones cuantitativas de
  usabilidad ni de tiempos de tarea, y no deben inventarse.
- Comparaciones de mercado sin respaldo. Las únicas admitidas son las de la tabla de estado
  del arte del informe (SciVal, InCites, consultorías, desarrollos internos).
- Narrativa de versiones del proyecto. La presentación describe el estado actual y lo que
  viene, no la historia de cómo se llegó.
