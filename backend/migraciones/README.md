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
| `006_acceso_por_plan.sql` | Espera entre consultas del plan gratuito y tabla de descargas de informes | aplicada (24-09-2026) | aplicada (26-09-2026) |
| `007_recalibracion_de_precios.sql` | Precios y cuotas de los planes de pago calculados sobre el costo total (sueldos, alojamiento, modelos); ver `docs/planes.md` §3 | aplicada (29-09-2026) | aplicada (29-09-2026) |
| `008_valores_reales.sql` | Tabla `valor_real_universidad` para los valores medidos (razones, conteos, porcentajes), separada de los puntajes | aplicada (26-09-2026) | aplicada (26-09-2026) |
| `009_ranking_kai.sql` | Ranking KAI: diez métricas con pesos parejos y editables por el usuario; columnas `ranking.pesos_editables` y `metrica.sentido`. Requiere la 008 | aplicada (26-09-2026) | aplicada (26-09-2026) |
| `010_valores_crudos_de_la_fuente.sql` | Marca los rankings cuya fuente publica valores crudos (Scimago) y da unidad a sus métricas, para el modo numérico | aplicada (26-09-2026) | aplicada (26-09-2026) |
| `011_scimago_en_dos_modos.sql` | Scimago en dos modos: sus cifras pasan a `valor_real_universidad` y `metrica_universidad` guarda sus percentiles; columna `ranking.origen_valores`. Requiere la 010 | aplicada (26-09-2026) | aplicada (26-09-2026) |
| `012_normalizacion_por_ranking.sql` | Declara cómo sale el puntaje de la cifra en cada ranking (`percentil` o `propia`), para el switch global. Requiere la 011 | aplicada (26-09-2026) | aplicada (26-09-2026) |
| `013_dominios_institucionales.sql` | Tabla `dominio_institucion` (60 dominios de 50 universidades) y función `institucion_por_correo`: quien entra con Google con un correo institucional recibe su institución sin elegirla. **Aplicarla antes de desplegar el backend que la usa** | aplicada (29-09-2026) | aplicada (29-09-2026) |
| `014_precios_en_pesos.sql` | Columnas `plan.precio_mensual_clp` —el precio en pesos que muestra la portada: $ 27.400 / 93.700 / 463.500, netos— y `plan.precio_lista_clp`, el de referencia que se muestra tachado con «Descuento de lanzamiento» ($ 30.000 / 100.000 / 500.000; NULL lo quita). **Aplicarla antes de desplegar el backend**: `/planes` las lee | aplicada (30-09-2026) | aplicada (30-09-2026) |
| `015_solicitudes_de_contacto.sql` | Tabla `solicitud_contacto`: cada solicitud del formulario «Contratar ahora», guardada antes de enviarse por correo, con `enviado` y `error_envio`. Datos personales: vetada al asistente y sin filas en el volcado de pruebas | aplicada (30-09-2026) | aplicada (30-09-2026) |

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
