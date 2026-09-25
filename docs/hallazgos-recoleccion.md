# Hallazgos de la recolección de datos reales

**25 de septiembre de 2026** · 25.620 datos, 58 universidades, seis fuentes abiertas.

Este informe no reporta el avance del plan de recolección —eso está en
[tools/recoleccion/README.md](../tools/recoleccion/README.md)— sino lo que
apareció **dentro** de los datos: discrepancias entre lo que una universidad
declara a cada organismo, variables que no miden lo que su nombre promete,
huecos en el catálogo de la propia plataforma y dos defectos de la tubería que la
auditoría destapó.

Está ordenado por lo que cambia una decisión, no por fuente.

---

## Lo que hay que decidir

| # | Hallazgo | Qué obliga a hacer |
|---|---|---|
| 1 | El 100 % del peso de THE Latam descansa en 17 métricas **vacías** en la base | Cargar lo recolectado; sin eso la simulación no puede ser accionable |
| 2 | Un 33 % de ese peso son encuestas de reputación, inobtenibles a cualquier precio | Decir en la interfaz qué parte del puntaje el modelo no explica |
| 3 | THE publica con **tres años de retraso** | Emparejar cada edición con el año del SIES que le corresponde |
| 4 | Cuatro universidades declaran a THE cifras que no cuadran con las del Estado | No usarlas como ancla de calibración |
| 5 | El catálogo de la plataforma duplica UNIACC y **le faltan dos universidades estatales** | Corregir antes de que el selector de institución obligatorio llegue a producción |
| 6 | Siete instituciones cerradas siguen en el catálogo y en las fuentes | Decidir si se muestran, se marcan o se esconden |
| 7 | El personal académico en número de personas **no es comparable** entre universidades | Usar siempre JCE como denominador |
| 8 | `montos_anid_adjudicados` no es una serie anual comparable | Separar centros plurianuales de concursos anuales |

---

## 1. La plataforma pide simular sobre métricas que no tiene

De las 1.239 métricas definidas en la base, **500 no tienen ningún valor** (40 %).
Repartidas muy desigualmente:

| Ranking | Métricas | Vacías | Con datos |
|---|---:|---:|---:|
| Shanghai GRAS | 836 | 481 | 355 |
| **THE Latam** | **22** | **17** | **5** |
| Scimago Latam | 20 | 2 | 18 |
| QS Global / Latam / Disciplina | 355 | 0 | 355 |
| Shanghai ARWU | 6 | 0 | 6 |

El caso de THE Latam no es un hueco parcial: las cinco métricas con datos son los
**pilares** (Teaching, Research Quality, Research Environment, International
Outlook, Industry), y las 17 vacías son **todos** los indicadores que los
componen. Esas 17 suman exactamente 100 puntos de peso.

La consecuencia es concreta. Un rector puede preguntarle a la plataforma qué pasa
si sube su puntaje de Teaching de 32 a 40, pero nadie puede decidir tener un
puntaje de Teaching: se decide contratar académicos, abrir doctorados, subir la
razón estudiante/profesor. Mientras los indicadores estén vacíos, la simulación
opera sobre variables que la universidad no controla.

**Lo recolectado llena 59,5 de esos 100 puntos de peso:**

| Estado | Peso | Métricas |
|---|---:|---|
| Equivalencia directa | 27,0 | Student staff ratio, Doctorate staff ratio, Research productivity, International students, International staff, International co-authorship, Doctorate bachelor ratio, Patents |
| Equivalencia aproximada | 25,0 | Citation impact, Research excellence, Research influence (los tres desde Scimago) |
| Proxy parcial | 7,5 | Research income e Industry income, desde ANID |
| Pendiente (T2.3) | 2,5 | Institutional income, de los estados financieros |
| Sin fuente abierta | 5,0 | Research strength |
| **Imposible** | **33,0** | **Research reputation (18) y Teaching reputation (15)** |

Los 33 puntos imposibles merecen su propio párrafo. THE los obtiene de una
encuesta a académicos que no publica ni vende. Ninguna recolección los va a
conseguir. Eso fija un techo duro a la capacidad predictiva de cualquier modelo
que ajuste el puntaje de THE Latam: **un tercio del resultado es reputación
declarada por terceros y no responde a ninguna palanca de gestión.** La
plataforma debería decirlo, en lugar de dejar que el usuario suponga que una
predicción cubre el ranking completo.

## 2. THE trabaja con tres años de retraso, y eso es verificable

No está documentado en ninguna parte de THE. Se descubrió comparando la razón
estudiantes/académico que publica THE con la que se reconstruye del SIES,
probando todos los desfases de cero a cinco años:

| Desfase | Pares | Coinciden dentro del 1 % | Desvío mediano |
|---:|---:|---:|---:|
| 0 | 188 | 7 (4 %) | 13,2 % |
| 1 | 218 | 11 (5 %) | 11,5 % |
| 2 | 213 | 12 (6 %) | 9,4 % |
| **3** | **204** | **28 (14 %)** | **8,4 %** |
| 4 | 192 | 13 (7 %) | 9,6 % |
| 5 | 177 | 10 (6 %) | 12,5 % |

La prueba más limpia es con el número de estudiantes, que no arrastra el error de
dos variables:

| Desfase | Coinciden dentro del 1 % | Desvío mediano |
|---:|---:|---:|
| 0 | 14 (6 %) | 9,9 % |
| 2 | 25 (12 %) | 5,1 % |
| **3** | **48 de 204 (24 %)** | **3,0 %** |
| 4 | 20 (10 %) | 5,5 % |

Un cuarto de los pares coincide dentro del 1 % y el desvío mediano baja al 3 %.
La lectura razonable es que muchas universidades chilenas **no producen cifras
especiales para THE**: envían su reporte al Estado, y THE lo publica tres
ediciones después. Eso convierte el desfase en algo mejor que una curiosidad: es
un puente entre una base pública completa y un ranking que solo publica puntajes.

**Implicación para la fase 5:** cada edición de THE debe emparejarse con el año
del SIES que le corresponde, no con el suyo. Hacerlo con el mismo año introduce
un error mediano del 13 % antes de calcular nada.

## 3. Cuatro universidades declaran a THE cifras que no cuadran

Mediana país de la razón «académicos que implica THE» / «JCE reportados al
Estado»: **1,00** sobre 204 pares. La mayoría calza. Pero:

| Universidad | Razón (mediana) | Ediciones |
|---|---:|---:|
| Universidad Finis Terrae | **×2,38** | 4 |
| Universidad Mayor | **×2,13** | 5 |
| Universidad Católica de Temuco | ×1,72 | 5 |
| Universidad Diego Portales | ×1,62 | 9 |
| …17 universidades entre ×0,93 y ×1,12… | | |
| Pontificia Universidad Católica de Chile | ×0,86 | 9 |
| Universidad Adolfo Ibáñez | ×0,82 | 6 |
| Universidad de Los Lagos | ×0,73 | 5 |
| U. Católica de la Santísima Concepción | ×0,70 | 4 |

Finis Terrae y Mayor le atribuyen a THE más del doble de los académicos que
reportan al Estado, de forma sostenida a lo largo de cuatro y cinco ediciones. No
es un error de agregación: la mediana general es 1,00 y 17 universidades están
dentro del ±12 %.

Hay una explicación inocente y no la descarto: THE pide *headcount* de académicos
y el JCE del SIES son jornadas completas equivalentes, así que una universidad con
mucho profesor por horas puede legítimamente declarar más personas que JCE. Pero
entonces la pregunta se invierte: **¿por qué la mayoría declara exactamente su
JCE?** Los que calzan en 1,00 están usando la cifra del Estado; los que declaran
×2,4 están usando otra. La comparación entre universidades en el pilar Teaching
—donde la razón estudiante/profesor pesa 4,5 de 100— no está midiendo lo mismo en
cada caso.

En el otro extremo, la PUC de Chile declara sistemáticamente **menos** de lo que
reporta al Estado: ×0,86 en académicos y ×0,77 en estudiantes, nueve ediciones
seguidas. Probablemente excluye programas que el SIES sí cuenta.

**Ninguna de estas siete universidades debería usarse como ancla de calibración.**

## 4. El personal académico en personas no es comparable

El SIES publica académicos en dos unidades: personas y JCE. La razón entre ambas
va de **1,05 a 3,41**, con mediana 2,11:

| Universidad | Personas | JCE implícitos | Personas por JCE |
|---|---:|---:|---:|
| Universidad Gabriela Mistral | 657 | 193 | **3,41** |
| Universidad del Desarrollo | 3.262 | 1.076 | 3,03 |
| U. Academia de Humanismo Cristiano | 597 | 208 | 2,87 |
| … | | | |
| Universidad del Bío-Bío | 596 | 501 | 1,19 |
| Universidad Austral de Chile | 901 | 783 | 1,15 |
| Universidad de Atacama | 350 | 333 | **1,05** |

Esto invalida cualquier métrica «por académico» calculada con el número de
personas. El ejemplo más visible es el porcentaje del cuerpo académico con
doctorado, donde el orden resultante es contraintuitivo:

| Universidad | % con doctorado (sobre personas) | Personas/JCE |
|---|---:|---:|
| Universidad del Bío-Bío | 53,7 % | 1,19 |
| Universidad de Concepción | 52,0 % | — |
| Universidad de Chile | 41,5 % | — |
| PUC de Chile | 37,7 % | — |
| Universidad del Desarrollo | **9,8 %** | 3,03 |

La UDD no tiene un cuerpo académico diez veces menos doctorado que la del
Bío-Bío. Tiene 3.262 personas contratadas, muchas de ellas clínicos por horas,
contra 596 del Bío-Bío. El numerador cuenta doctores y el denominador cuenta
contratos.

**Regla para la fase 5: todo denominador de académicos es JCE.** Sin excepción.

## 5. El catálogo de la plataforma tiene tres problemas

Esto no salió de las fuentes externas, salió de auditar la tabla `universidad`
contra los nombres del SIES. Importa ahora porque el registro con **selector de
institución obligatorio** ya está implementado: lo que esté mal en el catálogo lo
va a ver cada persona que se registre.

**UNIACC está dos veces.** Son dos filas distintas para la misma institución:

| id | Nombre | Datos de ranking |
|---:|---|---:|
| 20 | Universidad de Artes, Ciencias y Comunicacion | 108 |
| 58 | Universidad UNIACC | 15 |

Quien se registre verá su universidad duplicada, y lo que vea después depende de
cuál elija.

**Faltan dos universidades estatales.** Ni la **Universidad de O'Higgins** ni la
**Universidad de Aysén** están en el catálogo. Ambas fueron creadas por ley en
2015, ambas son del CRUCH y ambas tienen datos en el SIES. Con el selector
obligatorio, nadie de esas dos instituciones puede registrarse. Tampoco está la
**Universidad del Alba**, que es el nombre actual de la Universidad Pedro de
Valdivia —presente en el catálogo bajo el nombre viejo—.

**Hay nombres históricos como entidades separadas.** «Universidad Ucinf» (id 23) y
«Universidad Los Leones» (id 47) son la misma institución antes y después de su
cambio de nombre. Para la serie histórica puede tener sentido; para un selector de
registro, no.

## 6. Siete instituciones cerradas siguen siendo medidas

| Institución | Situación | Aparece en |
|---|---|---|
| Universidad del Mar | cierre decretado 2012-2013 | openalex, scimago, sies |
| Universidad del Pacífico | cierre decretado 2019 | anid, openalex, scimago, sies |
| Universidad Iberoamericana (UNICIT) | cierre decretado 2021 | openalex, scimago |
| Universidad La República | en cierre desde 2021 | openalex, scimago, sies |
| Universidad Pedro de Valdivia | en cierre desde 2021 | openalex, scimago |
| Universidad ARCIS | cierre decretado 2023 | openalex, scimago |
| Universidad Ucinf | absorbida | scimago, sies |

En el SIES el rastro es coherente y hasta elocuente —del Mar pasa de 400
estudiantes en 2015 a 6 en 2018, titulando 936 personas en 2015 mientras cerraba—,
pero produce indicadores sin sentido: Los Leones registra 76 titulados sobre 39
matriculados en 2023, una «tasa de titulación» del 195 %.

Scimago y OpenAlex, en cambio, siguen publicando indicadores de investigación de
instituciones que ya no existen, porque los artículos con esa filiación siguen
citándose. La Universidad del Mar aparece con el **impacto normalizado más alto de
Chile** (1,51 en 2019-2023) sobre nueve documentos. Es cierto y es inútil.

**Decisión pendiente:** si la plataforma las muestra, hay que marcarlas; si no,
hay que sacarlas del selector sin perder su serie histórica.

## 7. Variables que no miden lo que su nombre promete

**Estudiantes extranjeros de THE: entero, y a veces congelado.** Los 218 valores
recolectados son enteros sin excepción, y solo toman nueve valores distintos (0 a
7 y 9). Dos tercios (144 de 218) son 2 % o menos. Y cuatro universidades declaran
el mismo número durante media década o más:

- Universidad del Bío-Bío: 1 % en **8** ediciones seguidas
- Universidad Autónoma de Chile: 1 % en 7
- Universidad Adolfo Ibáñez: 5 % en 6
- Universidad de Los Lagos: 0 % en 5

El pilar de internacionalización de THE pesa 10 puntos, de los cuales 2,5 son
estudiantes internacionales. Para casi toda universidad chilena ese indicador es
un 1 o un 2 que no se mueve. En la simulación, **subir un punto ahí es duplicar la
cifra**, y no hay resolución para nada menor. Vale la pena que la interfaz no
ofrezca ajustes finos sobre una variable que la fuente entrega redondeada al
entero.

**ANID no es una serie anual comparable.** El total adjudicado salta de ~270 mil
millones a **453 mil millones en 2025**, un 67 % de aumento. La causa no es más
financiamiento a la investigación corriente:

| Instrumento | 2024 | 2025 |
|---|---:|---:|
| Fondecyt Regular | 113,1 MM | 113,2 MM |
| Iniciación | 32,9 MM | 35,5 MM |
| Postdoctorado | 22,8 MM | 23,5 MM |
| **Centros de investigación aplicada** | — | **75,0 MM** |
| **Institutos Milenio** | — | **26,1 MM** |
| **Centros de interés nacional** | — | **24,4 MM** |

Los concursos anuales son notablemente estables —Fondecyt Regular varía menos de
un 2 % en tres años—. Lo que salta son adjudicaciones de centros plurianuales,
registradas íntegras en el año del fallo. Usar el total anual como proxy de
«ingresos de investigación» le atribuye a 2025 un salto que no ocurrió en el
presupuesto de ese año.

Además **2026 está incompleto**: 198 MM, con Fondecyt Regular ya en su nivel
habitual (115 MM) pero sin ningún centro. No debe entrar en ninguna tendencia.

Como contexto de concentración, en 2026 dos universidades se llevan el 28 % y diez
el 65 % de los fondos: U. de Chile 14,2 %, PUC 13,6 %, U. de Concepción 7,9 %, PUCV
6,1 %.

## 8. Un hueco de datos que un modelo de tendencia leería como realidad

Los saltos interanuales mayores al 60 % en el SIES se concentran en una
transición:

| Transición | Saltos | De un total de | |
|---|---:|---:|---:|
| 2020 → 2021 | 65 | 613 | **10,6 %** |
| resto de los años | 12 a 37 | ~630 | 1,9 % a 5,9 % |

La pandemia explica buena parte. Pero un caso no es pandemia:

**Universidad Alberto Hurtado, titulados de pregrado:**

| 2018 | 2019 | **2020** | 2021 | 2022 | 2023 |
|---:|---:|---:|---:|---:|---:|
| 746 | 765 | **111** | 1.180 | 1.131 | 1.354 |

Su matrícula no se movió (7.117 → 7.043 → 7.060). La tasa de titulación cae del
10,7 % al **1,6 %** y salta al 16,7 %. Ninguna universidad tituló un séptimo de lo
habitual en 2020 y el doble en 2021: es un **reporte incompleto de esa
universidad-año** en la base del SIES.

No lo corregí. Un dato faltante mal rellenado es peor que un dato faltante
declarado. Pero queda anotado, porque un modelo de tendencia que lo tome al pie de
la letra producirá una proyección absurda para esa universidad.

---

## Dos defectos propios que la auditoría destapó

Los reporto con el mismo detalle porque afectan a datos que ya estaban
consolidados.

**El porcentaje de colaboración internacional de OpenAlex era 0,0 % en las 52
universidades.** El filtro usado era `institutions.country_code:!cl`, que parece
decir «que participe una institución de fuera de Chile». En realidad la negación
de OpenAlex sobre un campo multivaluado excluye el trabajo si *alguno* de sus
valores es `cl`; junto al filtro de una institución chilena, describe el conjunto
vacío. La API responde `count: 0` sin error, así que el guion no tenía nada que
notar y las pruebas no cubrían esa variable.

Corregido con `countries_distinct_count:>1` y rellenado desde los crudos en caché
(una petición por universidad-ventana, sin repetir la recolección). Los valores
ahora son verosímiles: mediana **55,3 %** sobre 55 universidades, con USM 68 %,
U. de Magallanes 67 % y PUCV 55 %, contra 20 % de la Academia de Humanismo
Cristiano. La cifra tiene sentido
para Chile y es, además, el insumo directo de *International co-authorship* (2,5
puntos de THE).

**Siete universidades se perdían por su nombre.** El SIES escribe «UNIVERSIDAD DE
PLAYA ANCHA DE CIENCIAS DE LA EDUCACIÓN» donde el catálogo dice «Universidad de
Playa Ancha», y la normalización por forma no cubre un nombre más largo. Igual
UNIACC, Bolivariana, ARCIS, UNICIT, Viña del Mar, SEK e INACAP. Además el SIES
anota los programas en convenio pegando una nota al nombre —«UNIVERSIDAD DE
SANTIAGO DE CHILE (\* CARRERA EN CONVENIO U. IBEROAMERICANA)»— y esas filas se
descartaban en silencio.

Corregido con ocho alias explícitos y una regla que quita la nota antes de
comparar. El SIES pasó de **49 a 56 universidades** y de 8.338 a **9.279 datos**;
el consolidado, de 24.558 a **25.620**, y la tabla ancha de 589 a 660 filas
universidad-año.

Quedan fuera, a propósito, cinco instituciones que no son universidades o están
cerradas (Chileno Británica, Aconcagua, Rancagua, La Araucana, Regional San
Marcos) y las tres del hallazgo 5 que faltan en el catálogo.

Un tercero, menor: OpenAlex empezó a devolver el tipo de documento como URI
(`https://openalex.org/types/article`) en vez del término suelto, y esas URI
terminaron dentro del nombre de 23 variables. Corregido; ahora se guarda el
término.

---

## Lo que ninguna fuente abierta entrega

Confirmado tras revisar las seis fuentes:

| Variable | Peso en THE | Por qué no está |
|---|---:|---|
| Research reputation | 18 | encuesta propia de THE, no se publica ni se vende |
| Teaching reputation | 15 | ídem |
| Research strength | 5 | sin definición pública replicable |
| Institutional income | 2,5 | requiere estados financieros (T2.3, en curso) |
| Estudiantes extranjeros, cifra exacta | — | el SIES no pide nacionalidad en matrícula |

El caso de los **estudiantes extranjeros** conviene matizar respecto de lo que
informé antes: la base de matrícula del SIES efectivamente no trae nacionalidad,
pero el SIES **sí publica académicos extranjeros**, en personas y en JCE, para 49
universidades. Mediana nacional 5,5 %; U. Católica del Norte 10,8 %, Gabriela
Mistral 9,3 %, Diego Portales 8,7 %. Eso cubre *International staff* (2,5 puntos)
sin pedirle nada a nadie. Lo que sigue haciendo falta de las instituciones es la
matrícula extranjera y los ingresos por investigación con la definición de THE.

---

## Propuesta de orden para lo que viene

1. **Corregir el catálogo** (hallazgo 5) antes de que el selector obligatorio
   llegue a producción: fusionar UNIACC, agregar O'Higgins y Aysén, decidir qué
   hacer con los nombres históricos y las cerradas.
2. **Cargar los indicadores de THE** con desfase de tres años (hallazgos 1 y 2),
   excluyendo de la calibración las siete universidades del hallazgo 3.
3. **Recalcular con JCE** todo denominador de académicos (hallazgo 4).
4. **Marcar los datos dudosos** en lugar de rellenarlos: el hueco de Alberto
   Hurtado 2020, las instituciones en cierre, los años incompletos de ANID.
5. **Declarar el techo** en la interfaz: un 33 % del puntaje de THE Latam es
   reputación encuestada y ningún modelo lo va a predecir desde datos de gestión.

Los guiones que produjeron cada cifra de este informe están en
[tools/recoleccion/](../tools/recoleccion/); los datos, en
`KAI/Datos reales/valores_reales_chile.csv`, con la fuente y la URL de cada dato.
