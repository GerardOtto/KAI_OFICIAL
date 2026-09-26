# Migraciones de base de datos

Las migraciones se aplican **a mano y en orden**, primero en local y después en
producción (Railway). No hay herramienta de migraciones automática: el proyecto
usa SQLAlchemy Core, no el ORM, así que no hay Alembic.

| Archivo | Qué hace | Local | Railway |
|---|---|---|---|
| `001_usuarios_y_conversaciones.sql` | Autenticación, cuentas de Google, planes, conversaciones y consumo de tokens | aplicada | aplicada (07-09-2026) |
| `002_motor_por_conversacion.sql` | Motor del asistente (Claude o Gemini) fijado por conversación | aplicada | aplicada (07-09-2026) |
| `003_planes_por_tokens.sql` | Planes con cuota de tokens por motor, precio mensual y tope diario | aplicada | aplicada (07-09-2026) |
| `004_solo_google_tras_vincular.sql` | Quita la contraseña a las cuentas ya vinculadas a Google | pendiente | pendiente |
| `005_jerarquia_de_metricas.sql` | Distingue los pilares de los indicadores que agrupan, para que los pesos de un ranking sumen una sola vez | aplicada (22-09-2026) | pendiente |
| `006_acceso_por_plan.sql` | Espera entre consultas del plan gratuito y tabla de descargas de informes | aplicada (24-09-2026) | pendiente |
| `007_recalibracion_de_precios.sql` | Precios y cuotas de los planes de pago calculados sobre el costo total (sueldos, alojamiento, modelos); ver `docs/planes.md` §3 | pendiente | pendiente |
| `008_valores_reales.sql` | Tabla `valor_real_universidad` para los valores medidos (razones, conteos, porcentajes), separada de los puntajes | pendiente | pendiente |
| `009_ranking_kai.sql` | Ranking KAI: diez métricas con pesos parejos y editables por el usuario; columnas `ranking.pesos_editables` y `metrica.sentido`. Requiere la 008 | pendiente | pendiente |
| `010_valores_crudos_de_la_fuente.sql` | Marca los rankings cuya fuente publica valores crudos (Scimago) y da unidad a sus métricas, para el modo numérico | pendiente | pendiente |
| `011_scimago_en_dos_modos.sql` | Scimago en dos modos: sus cifras pasan a `valor_real_universidad` y `metrica_universidad` guarda sus percentiles; columna `ranking.origen_valores`. Requiere la 010 | pendiente | pendiente |

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
