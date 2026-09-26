# Estudio: valores reales detrás de las métricas normalizadas de THE, QS y Scimago

**Objetivo.** Recuperar los valores cuantificables reales (conteos, razones,
porcentajes) que hay detrás de los puntajes 0–100 que guarda la plataforma, al
menos para una institución (la PUCV), y decidir si el resto puede obtenerse por
regla de 3. Las métricas de encuestas de reputación quedan fuera del alcance.

**Institución de referencia:** Pontificia Universidad Católica de Valparaíso (PUCV).

**Reproducible con:** `python tools/desnormalizacion/estimar_valores_pucv.py`
(genera `tools/desnormalizacion/valores_reales_pucv.csv` e imprime las pruebas
citadas aquí).

---

## 1. Resumen

| | Resultado |
|---|---|
| **Scimago** | **Resuelto.** La BD ya guarda valores crudos para 57 universidades y 6 ventanas (p. ej. PUCV 2019–2023: 5.052 documentos, 2.837 con colaboración internacional, 616 en el 10 % más citado). No hay nada que desnormalizar. Solo falta cargar la métrica *Excellence* (id 33), que no está en la BD. |
| **THE** | **Parcial.** Hay valores **reales publicados por THE** que no estábamos usando: estudiantes FTE (18.070), estudiantes por académico (23,2), % de estudiantes internacionales (2 %). De ahí se obtiene el personal académico FTE exacto: **≈ 779**. Con Scimago/OpenAlex se estiman la productividad, el impacto de citas, la excelencia y la coautoría internacional. **No es posible invertir los puntajes de THE**: la BD solo tiene los 5 pilares, y cada pilar mezcla 3–5 métricas con una normalización no lineal. |
| **QS Latam** | **Parcial y de baja precisión.** Valor real directo: estudiantes internacionales 2 % (ya en la BD). Con fuentes públicas: personal con doctorado ≈ 64 % y rangos para faculty/student y papers per faculty. La normalización de QS es **lineal pero con intercepto**, así que invertirla requiere **dos** anclas, no una. |
| **Regla de 3** | **No sirve en general.** Solo es exacta para la normalización `valor / máximo × 100` (Scimago en KAI). En QS falla en reputación e IRN (interceptos de 36–51 puntos) y en *papers per faculty* (puntaje saturado cerca de 100). En THE no aplica. |
| **Camino realista** | Pedir a la PUCV sus envíos de datos a THE y QS, y tomar los valores reales de **todas** las universidades chilenas desde fuentes oficiales (SIES/mifuturo, estados financieros, SciVal) en vez de desnormalizar. Ver §6. |

---

## 2. Qué hay hoy en la base de datos

| Ranking | Métricas cargadas | Tipo de valor | Años |
|---|---|---|---|
| THE (id 1) | Solo los 5 pilares (`Teaching`, `Research Environment`, `Research Quality`, `Industry`, `International Outlook`, ids 1692–1696). Las 17 métricas internas (ids 1–17) están definidas pero **sin valores**. | Puntaje 0–100 del ranking **THE Latin America** | 2016–2024, 2026 |
| QS (id 2) | 8 indicadores de QS Latam (ids 18–25) + mezcla de estudiantes (1688–1689) | Puntaje 0–100 (1688–1689 son % reales) | 2025 |
| Scimago (id 3) | 19 indicadores (ids 26–43, 1690–1691) | **Valor crudo** (conteos, %, razones) | Ventanas 2014–2018 … 2019–2023, guardadas con el último año (2018 … 2023) |

Observaciones:

- La métrica Scimago **Excellence** (id 33) está definida pero no tiene filas en
  `metrica_universidad`. El valor existe en
  `KAI/Scimago/SCIMAGO-DATA/instituciones_chilenas_limpias.csv` (columna `excel`).
- Los pilares THE `Industry` e `International Outlook` son idénticos en el
  ranking mundial y en el latinoamericano (PUCV 2026: 33,8 y 51,3 en ambos).
  `Teaching`, `Research Environment` y `Research Quality` se recalibran para
  América Latina (PUCV 2026 `Research Quality`: 33,0 en el mundial, 48,1 en Latam).

---

## 3. Cómo normaliza cada ranking y si se puede invertir

### 3.1 THE: función de probabilidad acumulada sobre puntajes Z

Según la metodología WUR 2026 (`KAI/THE/the_world_university_rankings_2026_methodology.pdf`):

> "calculamos una función de probabilidad acumulada y evaluamos dónde se ubica el
> indicador de una institución dentro de esa función […] usando una versión de
> puntaje Z. Para reputación, excelencia, influencia y patentes usamos un
> componente exponencial."

Para una métrica individual esto es `s = 100 · Φ((x − μ) / σ)`, y su inversa es

```
x = μ + σ · Φ⁻¹(s / 100)
```

Hacen falta μ y σ, que THE no publica. Con **dos** universidades de valor real
conocido se podrían despejar μ y σ. **Pero el problema de fondo es otro:** la BD
solo tiene pilares, y cada pilar es una suma ponderada de varias métricas ya
normalizadas. Por ejemplo, `Teaching` = reputación (15) + ratio estudiantes/académico
(4,5) + doctorados/licenciaturas (2) + doctorados/académico (5,5) + ingresos (2,5).
Es una ecuación con cinco incógnitas, así que **no se puede invertir con los datos
publicados**. Además, THE imputa las métricas faltantes ("el promedio de las dos
métricas más bajas o el mínimo de la población"), por lo que ni siquiera el conjunto
de insumos es seguro.

**Conclusión THE:** no se desnormaliza. Los valores reales se obtienen de los
*key statistics* que publica THE (§4.1), de fuentes bibliométricas (§4.2) o de los
datos que la PUCV envía a THE (§6).

### 3.2 QS: normalización lineal (con intercepto) y techo en 100

**Prueba 1: el mismo dato en dos poblaciones.** QS World 2025 y QS Latam 2025 usan
el mismo dato de origen de cada universidad, pero lo normalizan contra poblaciones
distintas. Si la normalización es lineal, los dos puntajes de una misma universidad
quedan en una recta. Si además es proporcional (lo que exige la regla de 3), esa
recta pasa por el origen. Resultado con las 23 universidades chilenas presentes en
ambos rankings:

| Indicador | Spearman | R² si fuera proporcional | Recta ajustada (Latam = a·World + b) |
|---|---|---|---|
| Faculty student ratio | 0,95 | **0,95** | 2,55·W + 3,1 |
| Academic reputation | 0,98 | −0,84 | 0,87·W + 39,7 |
| Employer reputation | 0,98 | −0,24 | 0,90·W + 35,8 |
| International research network | 0,93 | −0,73 | 0,83·W + 51,4 |

- *Faculty student ratio* se comporta de forma casi proporcional (intercepto ≈ 3).
  Ahí la regla de 3 es una aproximación aceptable **dentro del mismo ranking**.
- En reputación e IRN la relación es lineal pero con un intercepto de 36–51 puntos.
  Una regla de 3 anclada en la PUCV daría valores muy desviados para universidades
  lejanas a ella.
- En QS World 2026 la distribución de puntajes está sesgada a la derecha (mediana
  16–24, media 26–34 en AR, ER, FSR y CPF) y hay decenas de universidades en 100
  (98 en *International Faculty*). Esto es compatible con puntajes Z escalados y un
  techo, no con percentiles.

**Prueba 2: ¿se pueden mezclar denominadores de THE y QS?** No. El número de
académicos por estudiante que publica THE se correlaciona poco con el puntaje
*Faculty student ratio* de QS Latam (Spearman 0,34, n = 31). Cada ranking cuenta el
personal de otra forma: THE usa FTE y QS usa tiempo completo + parcial/3. En
cambio, *papers per faculty* (Scimago/THE) frente a QS da 0,76, y el impacto
normalizado de Scimago frente a *citations per paper* de QS da 0,71.

**Saturación.** *Papers per faculty* de QS Latam está en 99,1 para la PUCV, y 11 de
las 41 universidades chilenas superan 90. Un puntaje en el techo no se puede
invertir: solo indica que el valor real está por encima del umbral de corte. Por lo
tanto, la PUCV **no sirve como ancla** para ese indicador.

**Inversión correcta para QS** (por indicador y edición, fuera de la zona saturada):

```
x = x₁ + (s − s₁) · (x₂ − x₁) / (s₂ − s₁)
```

con dos universidades ancla (x₁, s₁) y (x₂, s₂) de valor real conocido, medido
**con la definición de QS**.

### 3.3 Scimago: no hay nada que invertir

Los valores de la BD son los conteos crudos de SCImago. La versión "normalizada" que
se hizo en KAI
(`instituciones_chilenas_limpias_con_ranking_y_AM_NORMALIZADO.csv`) es
`valor / máximo nacional × 100`, que es lineal y pasa por el origen. En ese caso la
regla de 3 es exacta: `x = s · máx / 100`.

---

## 4. Valores reales obtenidos para la PUCV

Confianza **alta** = dato publicado por el ranking o conteo directo;
**media** = derivado de fuentes equivalentes; **baja** = rango con supuestos.

### 4.1 THE (edición WUR 2026, bibliometría 2020–2024)

| Métrica THE | Valor real PUCV | Rango | Fuente | Confianza |
|---|---|---|---|---|
| Estudiantes FTE (denominador) | **18.070** | — | THE key statistics 2026 | Alta |
| **Student staff ratio** | **23,2** estudiantes por académico FTE | — | THE key statistics 2026 | Alta |
| Personal académico FTE (derivado) | **≈ 779** | 777–781 (redondeo del ratio) | 18.070 / 23,2 | Alta |
| **International students** | **2 %** | 1,5–2,5 % | THE key statistics 2026 | Alta |
| International students (conteo) | ≈ 361 FTE | 271–452 | 18.070 × % | Media |
| Publicaciones Scopus 2020–2024 | ≈ 5.126 | 4.972–5.280 | OpenAlex escalado a Scopus + tendencia Scimago | Media |
| **Research productivity** | ≈ **6,6** documentos por académico FTE (5 años) ≈ 1,3 por año | 6,4–6,8 | publicaciones / 779 | Media. THE suma el personal de investigación al denominador, así que esto es una cota superior |
| **Citation impact** (FWCI) | ≈ **0,91** veces el promedio mundial | 0,90–1,00 | Scimago *Normalized Impact* 2019–2023 | Media. THE promedia un FWCI ajustado por país y otro sin ajustar |
| **Research excellence** | **616** documentos en el 10 % más citado (12,2 % de la producción; 0,79 por académico FTE) | — | Scimago *Excellence* 2019–2023 | Media |
| **International co-authorship** | **56,2 %** de los documentos | — | Scimago 2.837 / 5.052 (2019–2023) | Alta |
| Patents (sustituto) | 42 documentos PUCV citados en patentes (13 solicitudes propias) | — | Scimago *Innovative Knowledge* / *Patents* | Baja. THE cuenta patentes que citan a la universidad, no documentos |
| Female:male (sin peso) | 43 : 57 | — | THE key statistics | Alta |

Serie histórica de THE para la PUCV (el personal FTE se calcula como estudiantes FTE / ratio):

| Edición | Estudiantes FTE | Estudiantes/académico | Académicos FTE | % internacional |
|---|---|---|---|---|
| 2017 | 15.241 | 25,0 | 610 | 1 % |
| 2018 | 14.953 | 23,1 | 647 | 1 % |
| 2019 | 15.165 | 23,1 | 657 | 1 % |
| 2020 | 15.935 | 24,4 | 653 | 1 % |
| 2021 | 16.511 | 24,1 | 685 | 1 % |
| 2022 | 17.411 | 25,4 | 686 | 1 % |
| 2023 | 17.703 | 26,6 | 666 | 1 % |
| 2024 | 18.104 | 26,2 | 691 | 1 % |
| 2025 | 18.179 | 24,2 | 751 | 1 % |
| 2026 | 18.070 | 23,2 | 779 | 2 % |

*Validación cruzada:* la PUCV declara públicamente 651 académicos JCE en 2022, con
la meta de llegar a 800 en 2029. Las ediciones THE 2023–2024, que usan datos de
2020–2021, dan 666–691 académicos FTE: una diferencia de 2–6 %, esperable porque
THE también cuenta personal de investigación. (La edición 2016, con 10,4
estudiantes por académico, es una anomalía de THE y no se usa.)

### 4.2 QS Latinoamérica (edición 2025)

| Métrica QS | Puntaje en la BD | Valor real PUCV | Fuente | Confianza |
|---|---|---|---|---|
| Student mix international | — | **2 %** | Perfil QS (ya en la BD, id 1689) | Alta |
| **Staff with PhD** | 60,7 | **≈ 64 %** de los académicos JCE con doctorado (65,9 % en 2022) | Prensa PUCV / ranking La Tercera, sobre datos SIES | Media. QS cuenta tiempo completo + parcial/3, no JCE |
| **Faculty student ratio** | 14,8 | **19,6–23,2** estudiantes por académico | Límite inferior: definición QS con cifras públicas (18.327 estudiantes; 1.501 académicos, ~650 de tiempo completo, que dan ≈ 934). Límite superior: THE FTE | Baja |
| **Papers per faculty** | 99,1 (saturado) | **5,3–6,3** documentos por académico en 5 años (2018–2022) | Scimago 4.910 / personal QS o THE | Baja |
| **Citations per paper** | 45,4 | ≤ 13,8 (cota superior) | OpenAlex 2018–2022 con citas acumuladas hasta 2026 y autocitas incluidas. QS cuenta menos años de citas y excluye autocitas, así que el valor real es menor | Baja |
| International research network | 92,7 | No calculado | Requiere los socios con 3 o más artículos en 5 años, **por país** (ver §5) | — |
| Web impact | 50,3 | No calculado | El valor real es la posición en Webometrics | — |

### 4.3 Scimago (valores ya reales en la BD, ventana 2019–2023)

| Indicador | PUCV | | Indicador | PUCV |
|---|---|---|---|---|
| Scientific Output | 5.052 | | Q1 articles | 2.367 |
| Output in External Journals | 4.945 | | Excellence (no está en la BD) | 616 |
| Output in Own Journals | 6 | | Excellence with Leadership | 260 |
| International Collaboration | 2.837 | | Scientific Leadership | 2.535 |
| Normalized Impact | 0,91 | | Open Access | 67,8 % |
| Scientific Talent Pool | 2.539 autores | | Female Scientific Pool | 967 autoras |
| Innovative Knowledge | 42 | | Technological Impact | 0,90 % |
| Patents | 13 | | SDG-related Output | 1.538 |
| Overton | 93 | | PlumX / Mendeley | 1.035 / 4.533 |

### 4.4 Otros datos del repositorio que sirven como control

- **Perfiles de autor Scopus con afiliación PUCV** (`tools/scopus_scraper/resultados_scopus.csv`):
  3.828 perfiles, pero solo 876 con 5 o más documentos. Los perfiles de Scopus
  **no sirven como número de académicos**: incluyen estudiantes, postdocs y
  colaboradores. Sin embargo, el núcleo con 5 o más documentos (876) queda en el
  mismo orden que los 779 académicos FTE.
- **OpenAlex** (`KAI/Top 2_ Scientist Rankings/openalex_pucv_publicaciones_TODAS.csv`):
  5.909 trabajos únicos en 2019–2023, frente a 5.052 en Scopus/Scimago. Es decir,
  OpenAlex cubre alrededor de 17 % más. Sirve para estimar tendencias, pero no como
  sustituto directo de Scopus.
- **Cuenta pública PUCV 2024** (fuente web, por verificar): 906 publicaciones
  indexadas en 2023 (714 WoS, 172 Scopus no-WoS, 20 SciELO) y 260 proyectos ANID en
  ejecución. Cuadra con las ~1.000 publicaciones anuales de Scimago, que incluye
  todos los tipos de documento.

---

## 4.5 Reversión completa de las 58 universidades (T5.2 y T5.3)

Lo de arriba se hizo para una institución y sin acceso web. Con la recolección
terminada —25.944 datos de seis fuentes— la reversión se rehízo para todas, y
cambió tres de sus conclusiones. Reproducible con:

```bash
python tools/recoleccion/metricas_crudas.py   # T5.2 -> metricas_crudas_chile.csv
python tools/recoleccion/calibrar.py          # T5.3 -> calibracion.csv
python tools/recoleccion/tests/test_reversion.py
```

### 4.5.1 El desfase, que no estaba considerado

Ninguna métrica se puede recalcular sin saber de qué año son los datos que
alimentan cada edición. La metodología WUR 2026 lo dice sin ambigüedad:

> «‘WUR 2026’ (ranking year): means the World University Rankings 2026 published
> in Autumn 2025 […] Provided true and accurate information for their institution
> **for the year ending in 2023**»

Tres años. Y la bibliometría va por otra ventana en el mismo documento: «all
indexed publications **between 2020 and 2024**», los cinco años que terminan dos
antes de la edición. Son dos desfases distintos dentro del mismo ranking.

Esto coincide con lo que la comparación empírica con el SIES había encontrado por
su cuenta antes de leer el PDF —desvío mediano del 3,0 % en matrícula con desfase
3, contra 9,9 % sin desfase—, así que el dato está confirmado por dos vías.

Para QS no hay una declaración equivalente, así que se midió: se ajusta la recta
en cada desfase de 0 a 7 **sobre una muestra idéntica**, para que el R² no cambie
por la composición de la muestra. Tres de los indicadores con R² sobre 0,6 tienen
su máximo en el interior del rango, en **E−4**:

| Indicador | E−0 | E−2 | **E−4** | E−6 |
|---|---:|---:|---:|---:|
| International Faculty Ratio | 0,43 | 0,53 | **0,70** | 0,65 |
| Staff with PhD | 0,63 | 0,62 | **0,71** | 0,68 |
| Papers per faculty | 0,59 | 0,62 | **0,66** | 0,53 |

### 4.5.2 Las 17 métricas de THE, recalculadas

13 de las 17 tienen ahora valor para las universidades con insumo. La PUCV en la
**edición 2026**, que según la metodología se arma con el SIES 2023 y la ventana
bibliométrica 2020-2024:

| Métrica de THE | Fórmula aplicada | PUCV 2026 | Calidad |
|---|---|---:|---|
| Student Staff Ratio | estudiantes_total / academicos_jce | 24,76 | directa |
| Doctorate Staff Ratio | graduados_doctorado / academicos_jce | 0,084 | directa |
| Doctorate Bachelor Ratio | graduados_doctorado / titulados_pregrado_total | 0,021 | directa |
| International Staff | academicos_jce_extranjeros / academicos_jce | 9,27 % | directa |
| International Students | declarado a THE | 1 % | directa |
| International Co-authorship | pct_colaboracion_internacional (OpenAlex) | 54,62 % | aproximada |
| Research Income | montos_anid / academicos_jce | $16,5 M | parcial |
| Industry Income | montos_anid_con_industria / academicos_jce | $2,5 M | parcial |

El Student Staff Ratio recalculado, 24,76, queda a un 6,7 % del 23,2 que THE
publica para la PUCV. Es la brecha esperable entre el JCE del SIES y el FTE que
THE recibe, y es de las menores del país: la PUCV declara a THE prácticamente lo
mismo que al Estado (razón 1,04 sobre nueve ediciones).

**Las cinco métricas bibliométricas se detienen en la edición 2025.** Research
Productivity, Citation Impact, Research Excellence, Research Influence y Patents
salen todas de Scimago, y Scimago dejó de publicar indicadores crudos: de la
ventana 2020-2024 solo hay posiciones. Para la edición 2026 en adelante esas
cinco no tienen insumo abierto, y son 32 de los 100 puntos de peso.

Dos precisiones que costaron releer la metodología y que es fácil equivocar:

- **Doctorate Staff Ratio son doctorados *otorgados* por académico**, no la
  proporción de académicos que tienen doctorado. Esa segunda es *Staff with PhD*,
  y es de QS, no de THE.
- **Patents, Research Excellence y Research Influence llevan divisor.** THE dice
  «we also normalise this by the sum of academic and research staff». Sin el
  divisor, la métrica premia el tamaño y no la calidad.

### 4.5.3 La hipótesis CDF de THE, ahora verificada

La §3.1 daba la normalización de THE por supuesta. Con los datos mundiales
—3.731 instituciones, once ediciones— se puede probar. La pregunta que decide
cómo cargar los valores: ¿el puntaje sigue el **rango percentil** del valor crudo,
o la **normal ajustada** Φ((x−μ)/σ)? Para una variable sesgada las dos difieren
mucho.

| Edición | n | R² percentil | R² normal Φ(z) |
|---:|---:|---:|---:|
| 2016 | 800 | 0,742 | **0,763** |
| 2020 | 1.395 | 0,692 | **0,751** |
| 2023 | 1.798 | 0,603 | **0,699** |
| 2026 | 2.189 | 0,558 | **0,655** |

**La normal ajustada gana en las once ediciones.** Es la primera confirmación
externa de lo que THE declara, y fija cómo debe transformarse un valor real al
cargarlo: `s = 100 · Φ((x − μ) / σ)`, no un percentil.

Hay una segunda prueba, independiente. Si una métrica se normaliza con una
función acumulada, su puntaje se reparte uniforme entre 0 y 100. Los deciles de
cada pilar en el mundo, edición 2026:

| Pilar | d0 | d1 | d2 | d3 | d4 | d5 | d6 | d7 | d8 | d9 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| **Research Quality** | 2 | 9 | 12 | 12 | 12 | 13 | 13 | 12 | 11 | 5 |
| International Outlook | 0 | 1 | 19 | 21 | 17 | 13 | 9 | 8 | 7 | 6 |
| Teaching | 0 | 27 | 36 | 22 | 9 | 3 | 1 | 1 | 1 | 1 |
| Research Environment | 13 | 45 | 19 | 12 | 6 | 2 | 1 | 1 | 0 | 1 |

Research Quality es casi uniforme, y es **el único pilar sin encuesta de
reputación entre sus hojas**. Teaching y Research Environment, donde la
reputación pesa 15 de 29,5 y 18 de 29, se apilan en los deciles bajos. Encaja con
la otra mitad de lo que THE declara: función acumulada para las métricas normales
y «un componente exponencial» para reputación. Visto desde fuera, las dos mitades
se distinguen.

### 4.5.4 Las rectas de QS: cuáles sirven

Ajuste `puntaje = a + b·crudo` por indicador y edición, excluyendo los puntajes de
90 o más. El R² por sí solo engaña —hay indicadores con R² bajo y error de medio
punto, porque los puntajes se apiñan cerca del piso—, así que el veredicto mira
el error en puntos de puntaje:

| Indicador | R² | Error mediano | Veredicto |
|---|---:|---:|---|
| Citations per Faculty (Global) | 0,75 | 0,8 | **sirve** |
| Staff with PhD (Latam) | 0,72 | 6,1 | **sirve** |
| International Faculty Ratio (Global) | 0,67 | 2,0 | **sirve** |
| International Students Ratio (Global) | 0,54 | 0,7 | sirve con reparo |
| Papers per faculty (Latam) | 0,68 | 10,2 | no: 10 puntos de error |
| Citations per paper (Latam) | 0,50 | 12,3 | no |
| Faculty student ratio (Latam) | 0,14 | 5,0 | no |
| Faculty Student Ratio (Global) | 0,08 | 2,2 | no |
| International research network | 0,02–0,41 | 9–11 | no |

Cuatro de diez quedan utilizables. Los dos fracasos confirman lo que la §3.2 ya
sospechaba: **Faculty Student Ratio no se puede reproducir** porque QS cuenta
jornada completa más parcial dividida en tres, que no es el recuento de personas
ni el JCE del SIES; e **International Research Network no es el número de países
socios** —los interceptos ajustados, de −224 y −366, son la señal de que la
métrica recalculada no es la que QS mide—.

### 4.5.5 Scimago: verificado

Las 11 métricas de Scimago de la base se compararon una a una contra la descarga
nueva, 338 a 340 pares cada una. **Desvío 0,00 % en todas.** No hay nada que
desnormalizar y tampoco nada que corregir. De paso, esto valida la tubería de
recolección completa: resolución de nombres, lectura y mapeo de ventanas
reproducen la base exactamente.

---

## 5. Qué falta y por qué

Actualizado tras T5.2 y T5.3. Lo tachado quedó resuelto.

| Métrica | Ranking | Qué falta | Dónde está |
|---|---|---|---|
| Institutional income / académico | THE | Ingresos totales (PPP) | Estados financieros auditados; T2.3 en curso |
| ~~Research income / académico~~ | THE | *Resuelto en parte:* ANID por académico, 1.280 datos. Falta el resto del ingreso de investigación | Estados financieros; envío a THE |
| ~~Industry income / académico~~ | THE | *Resuelto en parte:* el aporte de industria vía ANID, 344 datos | Envío a THE para el total |
| ~~International staff~~ | THE | **Resuelto.** El SIES publica académicos extranjeros en personas y en JCE, 49 universidades | `sies:academicos_jce_extranjeros` |
| ~~Doctorate/bachelor ratio~~ | THE | **Resuelto.** 317 valores | `sies:graduados_doctorado / titulados_pregrado_total` |
| ~~Doctorate/staff ratio~~ | THE | **Resuelto** sin ponderación por área. 313 valores | `sies:graduados_doctorado / academicos_jce` |
| Research staff FTE | THE | El JCE del SIES no separa personal de investigación del docente | Envío de datos a THE |
| Research strength | THE | Percentil 75 del FWCI trabajo a trabajo | SciVal (Elsevier) |
| Research influence y FWCI exacto | THE | Sustituidos por Scimago; la equivalencia es de familia, no exacta | SciVal (Elsevier) |
| Faculty FT/PT (definición QS) | QS | Confirmado que no se puede reproducir: R² 0,08–0,14 | Envío de datos a QS (QS Hub) |
| International research network | QS | Confirmado que el número de países no es la métrica | Scopus/SciVal |
| Web impact | QS | El dominio de Webometrics no resuelve | webometrics.info |
| Puntajes de sub-métricas THE | THE | Los 17 puntajes individuales | Portal institucional de THE |
| Reputación (4 métricas) | THE y QS | Encuestas propias; no se publican ni se venden | Ninguna fuente, a ningún precio |

**Limitación del estudio original:** el contenedor donde se hizo no tenía acceso
web a SIES, QS, THE ni PUCV (bloqueo del proxy de salida), y sus cifras marcadas
como "prensa PUCV" o "fuente web" venían de resúmenes de búsqueda. **Las secciones
4.5 y siguientes no arrastran esa limitación:** se hicieron con acceso a las
fuentes y cada dato lleva su URL en `KAI/Datos reales/valores_reales_chile.csv`.

---

## 6. Enfoque realista recomendado

### 6.1 Pedir los datos a la PUCV (fuente exacta, un solo trámite)

La PUCV envía cada año sus datos institucionales a THE (portal de recolección de
datos de THE) y a QS (QS Hub). Esos envíos contienen **exactamente** los insumos que
buscamos, con las definiciones de cada ranking. Hay que pedirlos a la unidad que
coordina los rankings (típicamente Análisis Institucional o Planificación, bajo la
Vicerrectoría correspondiente), con este detalle:

- **THE (último envío y, si es posible, los tres anteriores):** estudiantes FTE
  (total, internacionales, pregrado/posgrado); personal académico FTE y de
  investigación FTE (total, internacional, por área); doctorados y licenciaturas
  otorgados; ingresos institucionales, de investigación y de la industria (en CLP y
  por área).
- **QS:** académicos de tiempo completo y parcial (total, internacionales, con
  doctorado), estudiantes de tiempo completo y parcial, estudiantes internacionales
  y de intercambio.
- **Reportes de retorno:** cualquier informe de desempeño o *benchmarking* que THE o
  QS entreguen a la PUCV (en THE incluye las 17 sub-métricas; por ejemplo, THE
  DataPoints si hay suscripción).
- **Acceso a SciVal**, si la biblioteca tiene licencia: FWCI, percentil 75, top 10 %,
  coautoría internacional y citas en patentes, con las mismas ventanas que usan THE
  y QS.

Con ese paquete, los valores de la PUCV pasan de "estimados" a **exactos** y la PUCV
se convierte en un ancla confiable.

### 6.2 Para las demás universidades: medir, no desnormalizar

La regla de 3 no es confiable (§3). La alternativa es tomar los valores reales de
todas las universidades chilenas de fuentes abiertas y homogéneas:

| Necesidad | Fuente abierta | Cubre |
|---|---|---|
| Matrícula, personal académico (JCE, jornada, grado, nacionalidad), titulados por nivel (incluye doctorados) | **SIES / mifuturo.cl** (bases descargables) | Todas las IES chilenas, series anuales |
| Indicadores consolidados | **CNED INDICES** | Todas |
| Ingresos | **Estados financieros auditados** (Superintendencia de Educación Superior / sitios de cada universidad) | Todas las universidades |
| Proyectos de investigación | **ANID** (repositorio de proyectos) | Todas |
| Bibliometría | **Scimago** (ya en la BD) y **SciVal/Scopus** | Todas |
| Estudiantes, académicos y % internacional según THE | **THE key statistics** (ya en `KAI/THE/Código y outputs/csv`) | 30 universidades chilenas rankeadas |

Así se obtienen los numeradores y denominadores reales de cada métrica cuantitativa
y se pueden **recalcular** los indicadores con la fórmula de cada ranking, que es lo
que la plataforma necesita para simular.

### 6.3 Si igual se quiere desnormalizar (como respaldo)

1. **Scimago:** no hace falta; usar los valores crudos de la BD.
2. **QS:** ajuste lineal de dos (o más) anclas por indicador y edición, con valores
   medidos según la definición de QS (§3.2), y **solo** para puntajes bajo ~90. Los
   puntajes saturados se reportan como "≥ valor del ancla". Como anclas sirven la
   PUCV (con los datos de §6.1) y una segunda universidad que comparta sus datos
   (por ejemplo, un socio regional).
3. **THE:** solo es posible si se consiguen los puntajes de las sub-métricas (portal
   institucional). Con dos anclas se resuelve `x = μ + σ·Φ⁻¹(s/100)` por métrica.
   Con los pilares de la BD no se puede.

### 6.4 Tareas inmediatas en la plataforma

- Cargar Scimago *Excellence* (id 33) desde el CSV de origen.
- Cargar como métricas de valor real los *key statistics* de THE (estudiantes FTE,
  ratio, % internacional) para las 30 universidades chilenas y todos los años. Ya
  están en el repo y son valores reales, no normalizados.
- Distinguir en el modelo de datos si un valor es **puntaje** o **valor real**. Hoy
  `metrica_universidad.valor_metrica` mezcla ambos según el ranking.

---

## 7. Fuentes

Repositorio:

- `backend/backup.sql` (tablas `metrica`, `metrica_universidad`)
- `KAI/THE/Código y outputs/csv/THE_*_key_statistics.csv`, `THE_*_rankings.csv`, `csv_latam/`
- `KAI/THE/the_world_university_rankings_2026_methodology.pdf`, `KAI/THE/Análisis metodología y fuentes de THE.docx`
- `KAI/QS/DatosQS/QS global/2025 QS World University Rankings 2.2 (For qs.com).xlsx`, `KAI/QS/QS Global/Datos QS/datos_qs_brutos.csv`
- `KAI/QS/QS Latinoamérica/Datos QS Latinoamérica/datos_qs_latam_brutos.json`
- `KAI/Reuniones KAI/Reunión 20-05-26/Normalización Faculty Area - Explicación Técnica QS.pdf`
- `KAI/Scimago/SCIMAGO-DATA/instituciones_chilenas_limpias*.csv`
- `KAI/Top 2_ Scientist Rankings/openalex_pucv_publicaciones_TODAS.csv`
- `tools/scopus_scraper/resultados_scopus.csv`

Web (resúmenes de búsqueda, por verificar en la fuente original):

- [Admisión 2025: ¿Por qué elegir la PUCV?](https://www.pucv.cl/pucv/noticias/destacadas/por-que-estudiar-en-la-pontificia-universidad-catolica-de-valparaiso): 64,3 % de los académicos JCE con doctorado
- [Universidad consolida su Modelo Educativo…](https://www.pucv.cl/pucv/noticias/destacadas/universidad-consolida-su-modelo-educativo-para-los-desafios-del-futuro): de 651 a 800 académicos JCE entre 2022 y 2029
- [Ranking La Tercera y Qué Pasa: PUCV primer lugar en calidad de los académicos](https://www.pucv.cl/uuaa/ranking-la-tercera-y-que-pasa-pucv-mantiene-el-primer-lugar-en-calidad): 65,9 % (2022)
- [Rector Nelson Vásquez rinde cuenta anual 2024](https://www.pucv.cl/pucv/rector-nelson-vasquez-rinde-cuenta-anual-ante-masiva-concurrencia-al): 906 publicaciones en 2023, 260 proyectos ANID
- [Pontifical Catholic University of Valparaíso (Wikipedia)](https://en.wikipedia.org/wiki/Pontifical_Catholic_University_of_Valpara%C3%ADso) y [perfil TopUniversities](https://www.topuniversities.com/universities/pontificia-universidad-catolica-de-valparaiso): 18.327 estudiantes; 1.501 académicos, ~650 de tiempo completo
