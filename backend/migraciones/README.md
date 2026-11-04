# Migraciones de base de datos

Las migraciones se aplican **a mano y en orden**, primero en local y después en
producción (Railway). No hay herramienta de migraciones automática: el proyecto
usa SQLAlchemy Core, no el ORM, así que no hay Alembic.

| Archivo | Qué hace | Local | Railway |
|---|---|---|---|
| `001_usuarios_y_conversaciones.sql` | Autenticación, cuentas de Google, planes, conversaciones y consumo de tokens | aplicada | aplicada (07-09-2026) |
| `002_motor_por_conversacion.sql` | Motor del asistente (Claude o Gemini) fijado por conversación | aplicada | aplicada (07-09-2026) |
| `003_planes_por_tokens.sql` | Planes con cuota de tokens por motor, precio mensual y tope diario | aplicada | aplicada (07-09-2026) |
| `004_solo_google_tras_vincular.sql` | Quita la contraseña a las cuentas ya vinculadas a Google | aplicada (29-09-2026) | aplicada (29-09-2026) |
| `005_jerarquia_de_metricas.sql` | Distingue los pilares de los indicadores que agrupan, para que los pesos de un ranking sumen una sola vez | aplicada (22-09-2026) | aplicada |
| `006_acceso_por_plan.sql` | Espera entre consultas del plan gratuito (reemplazada por la 016) y tabla de descargas de informes | aplicada (24-09-2026) | aplicada (26-09-2026) |
| `007_recalibracion_de_precios.sql` | Precios y cuotas de los planes de pago calculados sobre el costo total (sueldos, alojamiento, modelos); ver `docs/planes.md` §3 | aplicada (29-09-2026) | aplicada (29-09-2026) |
| `008_valores_reales.sql` | Tabla `valor_real_universidad` para los valores medidos (razones, conteos, porcentajes), separada de los puntajes | aplicada (26-09-2026) | aplicada (26-09-2026) |
| `009_ranking_kai.sql` | Ranking KAI: diez métricas con pesos parejos y editables por el usuario; columnas `ranking.pesos_editables` y `metrica.sentido`. Requiere la 008 | aplicada (26-09-2026) | aplicada (26-09-2026) |
| `010_valores_crudos_de_la_fuente.sql` | Marca los rankings cuya fuente publica valores crudos (Scimago) y da unidad a sus métricas, para el modo numérico | aplicada (26-09-2026) | aplicada (26-09-2026) |
| `011_scimago_en_dos_modos.sql` | Scimago en dos modos: sus cifras pasan a `valor_real_universidad` y `metrica_universidad` guarda sus percentiles; columna `ranking.origen_valores`. Requiere la 010 | aplicada (26-09-2026) | aplicada (26-09-2026) |
| `012_normalizacion_por_ranking.sql` | Declara cómo sale el puntaje de la cifra en cada ranking (`percentil` o `propia`), para el switch global. Requiere la 011 | aplicada (26-09-2026) | aplicada (26-09-2026) |
| `013_dominios_institucionales.sql` | Tabla `dominio_institucion` (60 dominios de 50 universidades) y función `institucion_por_correo`: quien entra con Google con un correo institucional recibe su institución sin elegirla. **Aplicarla antes de desplegar el backend que la usa** | aplicada (29-09-2026) | aplicada (29-09-2026) |
| `014_precios_en_pesos.sql` | Columnas `plan.precio_mensual_clp` —el precio en pesos que muestra la portada: $ 27.400 / 93.700 / 463.500, netos— y `plan.precio_lista_clp`, el de referencia que se muestra tachado con «Descuento de lanzamiento» ($ 30.000 / 100.000 / 500.000; NULL lo quita). **Aplicarla antes de desplegar el backend**: `/planes` las lee | aplicada (30-09-2026) | aplicada (30-09-2026) |
| `015_solicitudes_de_contacto.sql` | Tabla `solicitud_contacto`: cada solicitud del formulario «Contratar ahora», guardada antes de enviarse por correo, con `enviado` y `error_envio`. Datos personales: vetada al asistente y sin filas en el volcado de pruebas | aplicada (30-09-2026) | aplicada (30-09-2026) |
| `016_consultas_de_prueba.sql` | El plan gratuito pasa de «una consulta cada tres días» a 3 consultas al asistente por cuenta, que no se reponen: columnas `plan.mensajes_totales` y `usuario.consultas_asistente` (arranca con las preguntas del historial). **Aplicarla antes de desplegar el backend**: la sesión y `/planes` leen las columnas nuevas | aplicada (30-09-2026) | aplicada (30-09-2026) |
| `017_scimago_por_edicion.sql` | Scimago pasa a guardarse con el año de su **edición** y no con el que cierra su ventana de publicaciones: 2018…2023 se corre a 2020…2025 (la edición 2025 usa 2019-2023), en puntajes y cifras. Solo datos, sin cambios de esquema. Requiere la 011 | aplicada (14-10-2026) | aplicada (14-10-2026) |
| `018_catalogo_de_universidades.sql` | Corrige el catálogo (ver `docs/hallazgos-recoleccion.md` §5): fusiona el duplicado de UNIACC —«Universidad de Artes, Ciencias y Comunicacion» se funde en «Universidad UNIACC», traspasando sus valores, dominios y cuentas— y agrega las dos estatales que faltaban, O'Higgins y Aysén (sin datos; se cargan con la recolección). Solo datos, sin cambios de esquema. El backend no depende de ella | **pendiente** | **pendiente** |
| `019_rol_del_asistente.sql` | Rol de base `kai_asistente`, que solo lee las tablas académicas; la consulta SQL libre del asistente corre con él y, sin él, se niega. Cierra la lectura de cuentas y mensajes por SQL dinámico. Los roles no viajan en el volcado: aplicarla también tras cargar uno. **Aplicarla antes de desplegar el backend** | **pendiente** | **pendiente** |
| `020_puntaje_total.sql` | El puntaje total de cada universidad en todos los rankings, como métrica «Puntaje total» (tipo `Puntaje`, no pondera): publicado por el ranking o calculado con su método. Corrige QS Global 2026 (cuatro columnas corridas), quita los totales en 0 de QS Global, pasa THE Latam a sus pesos latinoamericanos (35/33,5/20/4/7,5) y agrega `ranking.puntajes_ponderados` (Shanghai GRAS: el total es la suma). No está en el volcado: aplicarla también tras cargarlo. El backend funciona sin ella | **pendiente** | **pendiente** |
| `021_gras_por_edicion.sql` | Corrige el total de Shanghai GRAS 2017-2023 que dejó la 020: hasta 2023 GRAS publicaba los indicadores de 0 a 100 y pesos propios de cada materia y edición, y la 020 los sumaba como si vinieran ponderados. Reemplaza `ranking.puntajes_ponderados` por `puntajes_ponderados_desde` (2024 en GRAS) y borra esos totales; los correctos los agrega `tools/rankings/cargar.py --escribir`. Requiere la 020. El backend nuevo la necesita para no volver a multiplicar por el peso en GRAS 2024+ | **pendiente** | **pendiente** |
| `022_grupos_de_comparacion.sql` | Tabla `grupo_comparacion`: grupos de instituciones guardados por cada cuenta para Tendencias y la simulación comparada. Datos personales: el rol del asistente no la lee y el filtro de la consulta libre la veta. El backend funciona sin ella (los grupos se ven vacíos) | **pendiente** | **pendiente** |
| `023_posicion_y_actualizacion.sql` | Tablas `posicion_oficial` (el puesto de cada universidad tal como lo publica el ranking —«=6», «501-600»— con su rango numérico) y `estado_ranking` (la última edición publicada de cada ranking, según la fuente o su calendario). Las llena `tools/rankings/cargar.py --escribir`. El backend funciona sin ella (no muestra el puesto oficial ni el aviso de edición nueva) | **pendiente** | **pendiente** |
| `024_the_world.sql` | Agrega el ranking THE World (World University Rankings) con sus cinco pilares de 2024 en adelante (29,5/29/30/4/7,5) y su puntaje total. Sus ediciones 2016-2027 las carga `tools/rankings/cargar.py --escribir`. Reservado al plan de pago, como todo «THE …». El backend funciona sin ella | **pendiente** | **pendiente** |

Al aplicar la 018, el volcado de integración continua (`backend/pruebas/datos_de_prueba.sql`)
y la prueba `dominios` (que espera un catálogo de 58) quedan una edición por detrás:
regenera el volcado desde una base con la 018 aplicada (ver el final de este
documento) y cambia el 58 de `test_dominios.py` por 59. Hasta entonces, la 018
vive solo como archivo, igual que cualquier migración recién escrita.

Tras aplicar la 001 se verificó que el esquema de ambas bases es idéntico
(mismas tablas y mismas columnas en `usuario`), y se convirtieron a bcrypt las
contraseñas que quedaban en texto plano en producción.

Todas son idempotentes (`IF NOT EXISTS`, `DROP CONSTRAINT IF EXISTS`), así que
volver a ejecutarlas no duplica nada.

La 005 se verifica a sí misma: termina en un bloque que aborta la transacción si
el reparto de pesos de THE Latam no queda en 100 % o si algún indicador sigue
sumando junto al pilar que lo contiene. La batería `pesos` vigila lo mismo desde
integración continua. La 006 hace lo propio con la espera del plan gratuito y la
tabla de descargas; la batería `acceso` cubre el resto de sus efectos.

La 006 **no** declara obligatoria la institución en la base, aunque lo sea al
registrarse: las cuentas anteriores —y todas las creadas con Google— no la
tienen, y una restricción `NOT NULL` les impediría entrar a completarla. La
obligación se aplica en el registro y se reclama en la primera sesión.

La 013 es la primera de la que depende el backend para autenticar: cada consulta
del usuario llama a `institucion_por_correo`, así que un backend desplegado sobre
una base sin la 013 no deja entrar a nadie. El orden es base primero, código
después: el código anterior convive sin problemas con la base nueva. Al aplicarla fija la institución de las cuentas de Google ya
existentes cuyo dominio reconoce, y lo informa en un aviso. Para agregar un
dominio basta un `INSERT` en `dominio_institucion` (en minúsculas y sin `@`):
cubre sus subdominios, y la batería `dominios` vigila que un subdominio no
apunte a otra universidad que su dominio.

---

## Aplicar en local

```bash
psql -U postgres -d KAI-PROJECT -v ON_ERROR_STOP=1 -f backend/migraciones/001_usuarios_y_conversaciones.sql
```

`ON_ERROR_STOP=1` es importante: sin él, `psql` continúa tras un error y la
transacción termina revertida sin que se note.

## Aplicar en Railway

1. En el panel de Railway, abre el servicio de **PostgreSQL** → pestaña
   **Variables** → copia `DATABASE_PUBLIC_URL` (la pública, no la interna:
   `postgres.railway.internal` solo resuelve dentro de la red de Railway).

2. Ejecuta la migración contra esa URL:

   ```bash
   psql "postgresql://postgres:CLAVE@HOST.proxy.rlwy.net:PUERTO/railway" \
        -v ON_ERROR_STOP=1 \
        -f backend/migraciones/001_usuarios_y_conversaciones.sql
   ```

   En Windows, si `psql` no está en el PATH:
   `"C:\Program Files\PostgreSQL\18\bin\psql.exe"`

3. Verifica que las tablas quedaron creadas:

   ```bash
   psql "postgresql://..." -c "\dt" -c "SELECT codigo_plan, tokens_mensuales FROM plan;"
   ```

   Deben aparecer `plan`, `conversacion` y `mensaje`, y cuatro planes.

4. **Respalda antes si la base tiene datos que no quieras perder:**

   ```bash
   pg_dump "postgresql://..." -f respaldo_antes_de_001.sql
   ```

5. **Datos de la 009 en adelante.** Los cargadores (`cargar_ranking_kai.py`,
   `cargar_valores_reales.py`) insertan fila por fila: contra la URL pública de
   Railway tardan más de diez minutos y sostienen una transacción abierta todo
   ese rato. Es más rápido generar el SQL y aplicarlo con `psql`, que lo manda
   en un solo `INSERT`:

   ```bash
   python tools/recoleccion/cargar_ranking_kai.py --sql ranking_kai.sql
   psql "postgresql://..." -v ON_ERROR_STOP=1 -f ranking_kai.sql
   ```

   Orden en una base nueva: 008, 009, 010, los dos cargadores, 011 y 012. La
   011 copia las cifras de Scimago antes de convertirlas en percentiles, y la
   012 verifica que cada puntaje de un ranking por percentil tenga su cifra.

---

## Contraseñas en texto plano

Si la base de producción tiene usuarios creados antes de esta migración, sus
contraseñas están guardadas **sin hashear**. El guion `hashear_claves.py` las
convierte a bcrypt sin mostrarlas por pantalla:

```bash
cd backend
venv/Scripts/python.exe migraciones/hashear_claves.py
```

Lee `DATABASE_URL` del entorno, así que para producción hay que apuntarlo a la
URL pública de Railway antes de ejecutarlo:

```bash
# PowerShell
$env:DATABASE_URL = "postgresql://..."
venv\Scripts\python.exe migraciones\hashear_claves.py
```

Reconoce los hashes bcrypt por su prefijo, de modo que ejecutarlo dos veces no
vuelve a hashear lo ya convertido.

---

## Variables de entorno del backend en Railway

Además de la migración, el servicio de backend necesita estas variables
(pestaña **Variables** del servicio, no un archivo `.env`):

| Variable | Obligatoria | Notas |
|---|---|---|
| `DATABASE_URL` | sí | La interna (`postgres.railway.internal`) funciona bien aquí |
| `ANTHROPIC_API_KEY` | sí, para el asistente | |
| `JWT_SECRET` | **sí** | Sin ella, todo `/auth/*` responde 503. Genera una distinta de la local |
| `JWT_HORAS_VALIDEZ` | no | Por defecto 12 |
| `GOOGLE_CLIENT_ID` | no | Sin ella el botón de Google no aparece |
| `GEMINI_API_KEY` | no | Sin ella el motor Gemini se muestra deshabilitado. Ver `docs/asistente-motores.md` |
| `GEMINI_MODEL` | no | Por defecto `gemini-3.5-flash-lite` |
| `CONTACTO_DESTINO` | sí, para «Contratar ahora» | A quién llegan las solicitudes del formulario de contacto |
| `SMTP_USUARIO` | sí, para «Contratar ahora» | La cuenta que envía esos correos |
| `SMTP_CLAVE` | sí, para «Contratar ahora» | Su contraseña de aplicación (en Gmail: Cuenta de Google → Seguridad → Contraseñas de aplicaciones). Nunca en el repositorio |
| `SMTP_HOST`, `SMTP_PORT` | no | Por defecto `smtp.gmail.com` y `587` |
| `KAI_PROXIES_CONFIABLES` | no | Por defecto 1, el proxy de Railway. Súbelo si se pone otro delante (una CDN): de él depende qué IP ven los topes |
| `KAI_LOGIN_FALLOS_POR_CUENTA`, `KAI_LOGIN_FALLOS_POR_IP`, `KAI_REGISTROS_POR_IP` | no | Topes de autenticación; ver `docs/acceso-y-planes.md` §6 |
| `DATABASE_URL_ASISTENTE` | recomendada | Conexión propia para la consulta SQL libre del asistente, con el usuario `kai_asistente`. Ver «019» abajo |

Sin las tres de contacto, las solicitudes se guardan igual en `solicitud_contacto`
con `enviado = FALSE` y el motivo en `error_envio`: se pueden revisar con
`SELECT * FROM solicitud_contacto WHERE NOT enviado ORDER BY fecha DESC;`.

Para generar un secreto:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```


## 008 y 009: valores medidos y Ranking KAI

La 009 define el ranking y sus métricas, pero **no trae datos**: los calcula
`tools/recoleccion/cargar_ranking_kai.py`, que es la única fuente de las fórmulas.
El orden completo, en local o en Railway:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/migraciones/008_valores_reales.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/migraciones/009_ranking_kai.sql
python tools/recoleccion/cargar_ranking_kai.py --escribir            # base de backend/.env
python tools/recoleccion/cargar_ranking_kai.py --url "$URL" --escribir  # otra base
```

El cargador reemplaza en una transacción todo lo que el Ranking KAI tenía, así
que volver a ejecutarlo tras una recolección nueva solo actualiza los datos. Con
`--sql archivo.sql` escribe el mismo contenido como SQL, para aplicarlo con `psql`
donde no se pueda correr Python.

Tres cosas que estas migraciones cuidan y que conviene no deshacer:

- **Los valores medidos van en `valor_real_universidad`, nunca en
  `metrica_universidad`.** `/ranking-resumen` suma `valor · peso / 100` sobre las
  métricas del ranking: dieciséis millones de pesos por académico en esa tabla
  llevarían el puntaje de una universidad de 46 a más de 900.000. La 008 aborta si
  encuentra valores en las hojas de THE, que es donde ese error ocurriría primero.
- **Las secuencias de `ranking` y `metrica` estaban atrasadas**: los datos
  originales se cargaron con identificadores explícitos. La 009 las pone al día
  antes de insertar; sin eso el primer `INSERT` choca con la clave primaria.
- **La 009 se verifica a sí misma**: aborta si el Ranking KAI no queda con diez
  métricas planas, pesos parejos que sumen 100, sentido declarado en todas y pesos
  editables.

Ambas se probaron dos veces seguidas sobre una copia de la base local, y la 009
también en el orden equivocado (sin la 008), donde se niega con un mensaje claro.
El volcado de integración continua, `backend/pruebas/datos_de_prueba.sql`, se
regeneró desde esa copia con las migraciones 006 a 009 aplicadas.


## 010 y el modo numérico

La pantalla de ranking tiene dos modos: los puntajes que publica cada ranking y
los **valores medidos** detrás de cada componente. `/valores-reales` los lee de
dos lugares según el ranking:

| Ranking | Origen | De dónde |
|---|---|---|
| THE Latam, QS Latam, QS Global | medido por KAI con la definición del ranking | `valor_real_universidad`, vía `cargar_valores_reales.py` |
| Ranking KAI | medido | `valor_real_universidad`, vía `cargar_ranking_kai.py` |
| Scimago Latam | publicado crudo por la fuente | `metrica_universidad` (`ranking.valores_son_crudos`) |
| Shanghai GRAS y ARWU, QS por Disciplina | — | solo publican puntajes: el modo numérico queda deshabilitado |

Tras la 010, para cargar los valores de THE y QS:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/migraciones/010_valores_crudos_de_la_fuente.sql
python tools/recoleccion/cargar_valores_reales.py --escribir
```

El cargador solo escribe ediciones que el ranking ya tiene en la base —los
insumos de la edición 2027 de THE existen, pero esa edición no— y no toca las
filas del Ranking KAI.

## 011: una sola regla para todos los rankings

Desde la 011, sin excepciones:

| Tabla | Qué guarda | Modo |
|---|---|---|
| `metrica_universidad` | el **puntaje normalizado**, de 0 a 100 | «Puntajes» |
| `valor_real_universidad` | el **valor cuantificable** detrás, con unidad, calidad y fuentes | «Valores medidos» |

Scimago era la excepción: guardaba sus cifras crudas como si fueran puntajes, y el
total de su pantalla sumaba documentos con índices cercanos a 1, así que ordenaba
por tamaño (la U. de Chile con 3.934,9 «puntos»). La 011 copia cada cifra a
`valor_real_universidad` y la reemplaza en `metrica_universidad` por su percentil
entre las universidades del año —el mismo método del Ranking KAI—, redondeado a
dos decimales.

No se pierde nada: la verificación del final aborta si algún puntaje queda sin su
cifra, y `calibrar.py --parte scimago` compara las 6.120 cifras migradas con una
descarga independiente de SCImago (desvío 0,00 %). La transformación solo corre
mientras `ranking.valores_son_crudos` esté activo y lo apaga al terminar, de modo
que una segunda ejecución no trata percentiles como cifras.

Efectos fuera de la pantalla de ranking: Tendencias, Simulación y el Glosario
muestran ahora los percentiles de Scimago, como los puntajes de los demás. El
asistente recibe, junto a cada puntaje, la cifra medida con su unidad y calidad
(`valor_medido`), y puede consultar `valor_real_universidad` con la herramienta
de SQL.

## 012 y el switch global de valores

El header tiene un switch **Puntajes / Valores** que fija el modo de toda la
plataforma: Resumen, Tendencias, Simulación y Glosario lo leen de un estado único
(`src/estado/ModoValores.jsx`), y cada hook de datos lo pasa al backend como
`modo=puntajes|numerico`. Los endpoints `/anios`, `/trends`,
`/tendencias-comparacion`, `/metricas-con-datos`, `/simulacion` y
`/valores-metrica-universidad` leen de una tabla derivada con la forma de
`metrica_universidad` (`_fuente_valores` en `main.py`), así que no se duplicó
ninguna consulta.

La 012 agrega `ranking.normalizacion`, que decide qué puede hacer Simulación con
las cifras:

| normalizacion | Rankings | En «Valores» |
|---|---|---|
| `percentil` | Ranking KAI, Scimago | se simula sobre la cifra real y el percentil se recalcula contra todas las universidades del año |
| `propia` | THE, QS, Shanghai | la cifra se muestra, pero no se puede convertir en puntaje: la simulación usa puntajes y lo dice |

Un ranking sin cifras (Shanghai, QS por Disciplina) muestra sus puntajes en
cualquier modo, con un aviso.

## 017: el año de Scimago es el de su edición

SCImago Institutions Rankings arma cada edición con los cinco años de
publicaciones que terminan dos antes: la edición 2025 usa 2019-2023, y la
descarga de la 2026 (`year=2026`) trae la ventana 2020-2024. La base guardaba
cada ventana con su último año, así que la plataforma mostraba «Scimago 2023»
como lo más reciente cuando era la edición 2025. THE y QS ya se guardaban por
edición.

La 017 corre dos años las dos tablas que guardan el año de Scimago
(`metrica_universidad.anio_metrica` y `valor_real_universidad.anio_edicion`); las
cifras, los percentiles y `anios_origen` —que ya decía la ventana correcta— no
cambian. Reconoce una base sin corregir porque sus cifras tienen una ventana que
cierra en su propio año de edición, de modo que una segunda ejecución no mueve
nada, y aborta si alguna cifra queda con otra ventana que «cinco años que
terminan dos antes» o si algún percentil queda sin su cifra del mismo año.

Se probó dos veces seguidas sobre una base cargada con `datos_de_prueba.sql`, y
`calibrar.py` empareja ahora cada ventana descargada con la edición E = ventana + 2
(coinciden las 6.120 cifras, desvío 0,00 %). El volcado de integración continua
se regeneró con la 017 aplicada.

Para Railway, sin pasos adicionales:

```bash
psql "postgresql://..." -v ON_ERROR_STOP=1 -f backend/migraciones/017_scimago_por_edicion.sql
```

Debe terminar con `NOTICE: Edición más reciente de Scimago Latam: 2025`. El
backend no necesita desplegarse antes ni después: todas las pantallas y las
consultas guiadas leen el año más reciente desde la base.

## 019: el rol del asistente

La consulta SQL libre del asistente (`consulta_sql`) se protegía solo con un
filtro de texto, y se demostró que no bastaba: con funciones que ejecutan SQL
escrito como texto (`ts_stat`, `query_to_xml`) el nombre de la tabla se arma por
partes al ejecutar, el filtro no lo ve, y se leyeron correos y mensajes de otras
cuentas; con un esquema escrito con escapes (`U&"..."`), el plan gratuito leía
los puntajes de THE. El filtro rechaza ahora esas formas, y la 019 agrega la
garantía que no depende de él: la consulta corre con el rol `kai_asistente`,
que solo puede leer las ocho tablas académicas.

```bash
psql "postgresql://..." -v ON_ERROR_STOP=1 -f backend/migraciones/019_rol_del_asistente.sql
```

Debe terminar con `NOTICE: kai_asistente lee solo las 8 tablas académicas`. Si
aborta diciendo que el rol puede leer otra tabla, hay un permiso concedido a
`PUBLIC` que conviene revocar.

**Recomendado en Railway: una conexión propia.** El backend entra a la base como
superusuario, y desde una sesión de superusuario el rol se puede deshacer con
`set_config('role', ...)`. Hoy lo impide el filtro; para que no dependa de él, el
asistente debe conectarse con un usuario que *sea* `kai_asistente`:

1. Dale contraseña al rol desde `psql`, con `\password` para que la clave no
   quede en el historial:
   ```
   ALTER ROLE kai_asistente LOGIN;
   \password kai_asistente
   ```
2. En las variables del backend, agrega `DATABASE_URL_ASISTENTE` con la misma
   dirección que `DATABASE_URL` pero con ese usuario:
   `postgresql://kai_asistente:CLAVE@postgres.railway.internal:5432/railway`.

Con eso, `set_config('role', 'postgres')` responde «permiso denegado» aunque el
filtro fallara. Sin la variable, la consulta usa la conexión común y asume el rol
con `SET LOCAL ROLE`.

## 020: el puntaje total

Hasta ahora solo QS Global y QS por Disciplina guardaban su puntaje total
(«Overall»), y en las demás pantallas la plataforma mostraba una suma ponderada
propia que en varios rankings no coincidía con la de la fuente. La 020 guarda el
total de cada ranking como una métrica más, «Puntaje total», que Tendencias,
Simulación y el Glosario muestran, y que **no pondera** (peso 0): nunca entra en
la suma que ordena el Resumen.

| Ranking | De dónde sale el total | Cobertura |
|---|---|---|
| THE Latam | El Overall publicado (CSV de `KAI/THE`). Donde THE solo publica una banda, calculado con los pesos de su metodología latinoamericana, que reproducen los publicados con ±0,08; cada calculado cae en su banda | todas las universidades clasificadas |
| QS Latam, QS Global | El Overall publicado (planillas de `KAI/QS/DatosQS`) | solo las mejor clasificadas: QS no publica el resto, y su reescalado no se reconstruye sin errores de hasta 1,2 puntos |
| QS por Disciplina | El Overall publicado, ya cargado | solo las mejor clasificadas de cada disciplina |
| Shanghai GRAS | La suma de los indicadores, que GRAS publica ya ponderados (coincide con el publicado para el top 50, ±0,2) | todas, por disciplina |
| Shanghai ARWU | 100 × suma ponderada / la de la primera del mundo, tomada de la API de ShanghaiRanking (reproduce el top 100 publicado, ±0,1) | todas desde 2004; 2003 usó otra metodología |
| Scimago Latam | La suma ponderada: SCImago no publica total | todas |
| Ranking KAI | La suma ponderada, por definición | todas |

Además corrige tres errores que encontró la verificación:

- **QS Global 2026 tenía cuatro columnas corridas.** Esa edición agregó «International
  Students Diversity», y lo guardado como International Research Network,
  Employment Outcomes, Sustainability y Overall era, en cada caso, la columna
  anterior. Se reescriben desde la planilla oficial; las otras ediciones ya
  coincidían celda por celda.
- **QS Global guardaba 0 como total** donde QS no lo publica. Esas filas se borran.
- **THE Latam ponderaba 30/30/30/0/10**, los pesos del ranking mundial. Los del
  latinoamericano, deducidos de los totales publicados, son 35/33,5/20/4/7,5 desde
  2024 (36/34/20/2,5/7,5 hasta 2023). Con los anteriores, el Resumen se alejaba
  hasta 8 puntos del total oficial; ahora, menos de 0,1 desde 2024 y menos de
  0,8 en las ediciones anteriores, porque la base guarda un solo peso por métrica.
  El total guardado no tiene ese error: el de cada banda se calculó con los pesos
  de su edición.

Y agrega `ranking.puntajes_ponderados`, verdadero solo en Shanghai GRAS: el puntaje
de cada indicador ya incluye su peso, y el total es la suma. El Resumen, la
Simulación y el asistente lo multiplicaban otra vez por el peso.

```bash
psql "postgresql://..." -v ON_ERROR_STOP=1 -f backend/migraciones/020_puntaje_total.sql
```

Debe terminar con `NOTICE: puntajes totales cargados: THE Latam: 268, QS Latam: 65,
Scimago Latam: 342, Shanghai GRAS: 600, QS Global: 18, Shanghai ARWU: 53, QS por
Disciplina: 217, Ranking KAI: 450`. El backend se puede desplegar antes o después:
lee la columna nueva con `to_jsonb` y, sin la 020, todo sigue como antes. Quien
recargue los puntajes del Ranking KAI o de Scimago debe recalcular su total:
`cargar_ranking_kai.py` ya lo hace, y la batería `puntaje-total` lo comprueba.

**Corregida por la 021** en lo que toca a Shanghai GRAS anterior a 2024: ver abajo.

Los totales publicados de THE y QS van escritos en la migración. Cada fila de la
fuente se emparejó con la de la base por los valores de sus componentes —los cinco
pilares en THE, los indicadores en QS—, no por el nombre de la universidad, que
cambia entre fuentes; las 268 filas de THE y todas las de QS con total encontraron
pareja única. Una edición nueva de THE o QS necesita agregar sus totales de la
misma forma; las de GRAS, ARWU (con la suma de la primera del mundo, que da su
API), Scimago y el Ranking KAI se calculan en la base.

## 021: el total de GRAS antes de 2024

La 020 trató todas las ediciones de Shanghai GRAS como las de 2024 en adelante, en
que cada indicador se publica ya ponderado y el total es la suma. Hasta 2023 no
era así: GRAS publicaba cada indicador de 0 a 100, y el total era Σ indicador ×
peso, con pesos propios de cada materia y edición (Matemáticas: CNCI 100 en 2017,
20 en 2023). La suma contaba IC entero en vez de a un quinto; en 2017 se alejaba
hasta 138 puntos del total publicado. Lo detectó el cargador de rankings al
reconstruir cada edición desde la API de ShanghaiRanking.

La 021 reemplaza `ranking.puntajes_ponderados` por `ranking.puntajes_ponderados_desde`
—la primera edición en que los puntajes vienen ponderados: 2024 en GRAS, vacía en
los demás— y borra los totales de GRAS 2017-2023 que la 020 calculó como suma
simple (458). Los correctos los agrega el cargador, con los pesos deducidos de los
totales que GRAS publica para su top 50: en 2023, la única edición anterior cuya
tabla de pesos sigue publicada, coinciden con ella en las 52 materias comparables.

```bash
psql "postgresql://..." -v ON_ERROR_STOP=1 -f backend/migraciones/021_gras_por_edicion.sql
python tools/rankings/cargar.py --escribir
```

La 021 avisa cuántas universidades de GRAS 2017-2023 quedan sin total: 458 antes
del cargador y 4 después (2018, Oceanography y Mining & Mineral Engineering, cuyas
ponderaciones no se dejan deducir). Es idempotente: solo borra los totales que
coinciden con la suma simple. El backend nuevo lee `puntajes_ponderados_desde`: sin
la 021 trata a GRAS como un ranking más, que era lo de antes de la 020.

## 022: grupos de comparación

Guarda, por cuenta, conjuntos de instituciones con nombre («Regionales», «Mis
pares») para elegirlos de una vez en Tendencias y en la simulación comparada. Son de
la cuenta, no del navegador: se ven en cualquier equipo. Hasta 30 grupos de hasta
60 instituciones; un nombre repetido (sin distinguir mayúsculas) reemplaza al
anterior.

```bash
psql "postgresql://..." -v ON_ERROR_STOP=1 -f backend/migraciones/022_grupos_de_comparacion.sql
```

Debe terminar con `NOTICE: grupo_comparacion lista`. Comprueba que `kai_asistente`
no pueda leer la tabla; el filtro de `consulta_sql` la veta además por nombre. El
backend se puede desplegar antes: sin la tabla, `/grupos` responde una lista vacía y
guardar responde 503.

## 023 y 024: puesto oficial, edición nueva y THE World

La 023 crea dos tablas que llena el cargador a partir de `datos/rankings/`:

- `posicion_oficial`: el puesto que publica el ranking para cada universidad,
  edición y disciplina, en texto tal cual («=6», «501-600», «1601–1800») y como
  rango (`desde`, `hasta`; «151+» queda sin `hasta`). El Resumen lo muestra junto al
  nombre y lo agrega al CSV; «Su lugar en cada ranking» lo añade al globo.
- `estado_ranking`: la última edición publicada de cada ranking, que escribe la
  revisión mensual en `datos/rankings/estado.json`. Si es más nueva que la cargada,
  el Resumen, Tendencias y Simulación lo avisan.

La 024 agrega THE World. Sus pesos cambiaron en 2024 (antes 30/30/30/2,5/7,5); la
métrica guarda los vigentes y el cargador verifica cada edición con los de su época.
La edición 2016 no reproduce su total con ningún reparto y se carga solo con los
pilares.

```bash
psql "postgresql://..." -v ON_ERROR_STOP=1 -f backend/migraciones/023_posicion_y_actualizacion.sql
psql "postgresql://..." -v ON_ERROR_STOP=1 -f backend/migraciones/024_the_world.sql
python tools/rankings/cargar.py --escribir
```

Deben terminar con `NOTICE: posicion_oficial y estado_ranking listas…` y `NOTICE:
THE World listo…`. Requieren la 020 (por el tipo `Puntaje`) y conviene aplicarlas
después de la 021 y la 022. El rol del asistente no recibe permiso sobre las tablas
nuevas: no las necesita. El backend se puede desplegar antes que ellas.
