# Verificación de KAI

Las baterías de verificación viven aquí, en el repositorio, y se ejecutan con una
orden. Antes estaban en carpetas de trabajo de una máquina concreta, que es la
razón por la que no podían integrarse en un sistema de integración continua.

Hay dos grupos, con requisitos distintos:

| Grupo | Dónde | Qué necesita |
|---|---|---|
| Backend | `backend/pruebas/*.py` | PostgreSQL con los datos académicos |
| Navegador | `frontend/kai-project/pruebas/*.mjs` | La aplicación compilada y servida, y un navegador con depuración remota |

Ninguna batería del grupo por omisión llama a un proveedor de lenguaje ni
consume créditos: la llamada al proveedor se sustituye por un doble, mientras que
la interfaz de programación, la base de datos y la autenticación son las reales.

---

## Backend

```bash
pip install -r tools/rankings/requirements.txt   # el backend más openpyxl, que usa la batería `rankings`
cd backend
python pruebas/ejecutar.py                     # las que no gastan dinero
python pruebas/ejecutar.py --detalle           # con la salida completa
python pruebas/ejecutar.py --solo herramientas concurrencia
python pruebas/ejecutar.py --en-vivo           # incluye las que llaman al proveedor
python pruebas/ejecutar.py --con-servidor      # incluye las que exigen un backend en marcha
```

Requiere `DATABASE_URL` apuntando a una base con el esquema y los datos
académicos cargados. Para una base vacía:

```bash
psql "$DATABASE_URL" -f pruebas/datos_de_prueba.sql
psql "$DATABASE_URL" -f migraciones/018_catalogo_de_universidades.sql
psql "$DATABASE_URL" -f migraciones/019_rol_del_asistente.sql   # los roles no viajan en el volcado
psql "$DATABASE_URL" -f migraciones/020_puntaje_total.sql        # tampoco está en el volcado
psql "$DATABASE_URL" -f migraciones/021_gras_por_edicion.sql
psql "$DATABASE_URL" -f migraciones/022_grupos_de_comparacion.sql
psql "$DATABASE_URL" -f migraciones/023_posicion_y_actualizacion.sql
psql "$DATABASE_URL" -f migraciones/024_the_world.sql
```

| Batería | Qué verifica |
|---|---|
| `herramientas` | Las once herramientas de consulta y la contención de `consulta_sql` |
| `analisis` | Grupos de comparación (guardar, reemplazar por nombre, borrar, validar y aislar entre cuentas; el asistente no los lee) y el lugar en cada ranking (coincide con el orden del Resumen, sin los rankings por disciplina ni los que el plan no incluye). Sin la 022, comprueba que los grupos respondan vacío y 503 |
| `actualizacion` | Puesto oficial y estado de cada ranking (023) y THE World (024): el puesto publicado se traduce a rango («=6», «501–600», «151+»); el cargador guarda el de cada universidad en cada edición tal como está en las instantáneas, y en `estado_ranking` lo de `datos/rankings/estado.json`, sin cambios en una segunda pasada; `/rankings` entrega la última edición cargada y la publicada, y `/ranking-resumen` el puesto oficial; THE World reparte 100 % entre sus pilares, tiene puntaje total y queda reservado al plan de pago. Sin la 023, se omite |
| `seguridad` | Tokens manipulados (sin firma, otra clave, vencidos, sin `exp` ni `sub`, `sub` no numérico, huella ajena o ausente) → 401 y nunca 500; la sesión de quien se registró con un correo ajeno deja de valer al vincularse con Google; topes de largo y listas de identificadores validadas (400/422, no 500); cabeceras de seguridad y CORS; grupos y conversaciones aislados entre cuentas |
| `rankings` | Cargador de rankings oficiales (`tools/rankings`): cada instantánea de `datos/rankings` de una edición ya cargada coincide cifra por cifra con la base; las que faltan se cargan y releen dentro de una transacción que se deshace; las planillas de QS se leen igual; y se rechazan un total corrido de columna, una métrica desconocida y una edición cargada que difiere. Sin la 020, se omite |
| `puntaje-total` | El puntaje total de la 020: existe en todos los rankings y nunca pondera; cubre a toda universidad clasificada en THE, Scimago, GRAS, ARWU y el Ranking KAI, y en QS solo donde QS lo publica (sin ceros); los calculados siguen su método y los publicados coinciden con las fuentes de `KAI/` y la API de ShanghaiRanking; QS Global 2026 sin columnas corridas; los pesos de THE reproducen su total; y lo leen Tendencias, Simulación, el Glosario y el asistente. Sin la 020, se omite |
| `entrada` | Presupuesto del bloque fijo, tope de filas, recorte del historial y las salidas que evitan vueltas |
| `acceso` | Institución obligatoria, módulos cerrados con sesión, rankings reservados (y sus cifras fuera del glosario del plan gratuito), descargas contadas y asistente por dominio |
| `limites` | Topes de inicio de sesión (por cuenta y por conexión) y de registro, que el tope no revele qué cuentas existen, que `X-Forwarded-For` no se pueda falsificar, contraseñas de más de 72 bytes y el largo máximo de un mensaje al asistente |
| `contacto` | Formulario «Contratar ahora»: se guarda y se envía (con el correo sustituido por un doble), no se pierde si el correo falla, valida, frena robots y abusos, y el asistente no lo lee |
| `dominios` | Catálogo de dominios institucionales, institución asignada al entrar con Google y no editable, correos parecidos que no se confunden y el asistente cerrado a las cuentas con contraseña |
| `pesos` | Que cada ranking reparta su 100 % una sola vez: pilares e indicadores no se suman a la vez |
| `ranking-kai` | Ranking KAI: pesos parejos que suman 100, las diez métricas en cada universidad y año, percentiles reproducibles desde el valor medido y abierto al plan gratuito |
| `valores-reales` | Modo numérico: cobertura por componentes y no por pilares, calidades, solo ediciones publicadas y universidades clasificadas, Scimago idéntico a su tabla, THE y QS reservados, el pilar de cada indicador, el glosario con la edición más reciente de cada ranking y el resumen de GRAS por disciplina |
| `consultas-guiadas` | Los cuatro informes de brechas de los botones del chat: genera los mensajes con Node desde el módulo del frontend, ejecuta cada SQL con `consulta_sql`, comprueba el formato del informe, el plan gratuito, las cifras del informe de Scimago validado y que `/chat` entregue el informe exacto aunque el modelo lo copie con una errata. **Necesita Node** en el PATH |
| `motor-gemini` | Ciclo de herramientas, contabilidad de tokens y traducción de errores |
| `busqueda-web` | Internet como herramienta que el modelo pide, cuota agotada y cadena de modelos |
| `convivencia` | Motor fijado por conversación y aislamiento del contexto entre motores |
| `planes` | Cuotas por motor, las 3 consultas de por vida del gratuito, tope diario, margen comercial y rol de administrador |
| `chat` | Recorrido completo de `/chat` con sesión y base reales |
| `concurrencia` | El tope diario y las consultas de por vida bajo peticiones simultáneas del mismo usuario |
| `autenticacion` | Registro, sesión y propiedad de las conversaciones (necesita el backend en marcha) |
| `en-vivo` | El motor real contra la API real del proveedor |

Cada batería elimina al terminar los usuarios, planes y conversaciones que creó,
y comprueba que la eliminación fue efectiva.

### Las que llaman al proveedor

`--en-vivo` ejecuta consultas reales contra la API de Gemini. Consume cuota del
proyecto y, fuera del nivel gratuito, dinero. Es la única forma de detectar
cambios en el comportamiento del proveedor: un modelo retirado del servicio o una
funcionalidad en vista previa que deja de aceptarse no se manifiestan contra un
doble.

---

## Navegador

Necesita dos servicios en marcha, que el ejecutor no levanta a propósito para no
matar nada de lo que dependa otra cosa:

```bash
cd frontend/kai-project
npx vite build --outDir dist-prueba
npx vite preview --outDir dist-prueba --port 5199 --strictPort

# en otra terminal
msedge --headless=new --remote-debugging-port=9222 --user-data-dir=<carpeta temporal>

node pruebas/ejecutar.mjs
node pruebas/ejecutar.mjs encabezado tendencias
```

Direcciones configurables con `KAI_APP_URL` y `KAI_CDP_URL`.

| Sonda | Qué verifica |
|---|---|
| `encabezado` | Sin desborde horizontal y con navegación en catorce anchos |
| `tendencias` | Orden de las vistas y vista predeterminada |
| `glosario` | Exclusión de un ranking, agregación multidisciplinaria, jerarquía de métricas y globo informativo |
| `portada` | Página de arriba abajo, planes en pesos, botones en mayúsculas y en IBM Plex Sans, íconos en blanco y negro, «Contratar ahora» que abre el formulario de contacto, entrada que lleva al asistente y módulos que sin sesión se piden con un aviso sobre la portada |
| `motores` | Selector de motores y derivación |
| `respuestas_markdown` | Énfasis, tablas, listas y desbordamiento |
| `reporte` | Composición del PDF del reporte ejecutivo y dibujo del bloque de gráfico |
| `consultas_guiadas` | Botones de brechas: la pregunta visible sin instrucciones, las negritas del informe en el chat y su PDF (título, logotipo del ranking, sin SQL y tablas que no se parten) |
| `informes` | Informes PDF de Tendencias, Simulación, Glosario y Resumen: cifras clave y lectura, tablas acotadas, proyecciones dentro de la escala y ningún carácter fuera de la fuente del PDF |
| `revelado` | Aparición progresiva de la respuesta e indicador de espera |
| `actualizacion` | Aviso de una edición publicada y no cargada, puesto oficial en el Resumen y THE World reservado en el catálogo |
| `ux_movil` | En el teléfono (390 px): ninguna sección desborda, los nombres del Resumen se leen, el resultado de la simulación unitaria se ve (barra fija), la comparada no se pisa con el ranking simulado y el historial del asistente es un cajón que abre «Historial» y cierra Escape; un solo `h1` y título de pestaña por sección, `lang="es"`, la matriz comparada manejable con el teclado y la página 404 |

Desde que ningún módulo es público, las sondas que abren uno crean una cuenta
desechable contra el backend y dejan su testigo en el navegador; lo hace
`pruebas/sesion.mjs`. La cuenta queda en el plan gratuito, así que esas sondas
miden la versión recortada de las vistas, que es la que verá la mayoría.

`motores` y `respuestas_markdown` ejercitan la interfaz del asistente y necesitan
además un backend con el proveedor sustituido por un doble, con la aplicación
compilada apuntando a él. Se omiten si no se define `KAI_API_URL`. Ese backend es
`pruebas/servidor_doble.py`: el real, con un proveedor que responde textos fijos
(sin gastar tokens), el asistente abierto a cualquier cuenta y las cuentas nuevas
en un plan de pago, para poder elegir entre los dos motores:

```bash
python pruebas/servidor_doble.py                      # backend de prueba en :8010
cd ../frontend/kai-project
VITE_API_URL=http://localhost:8010 npx vite build --outDir dist-doble
npx serve -s dist-doble -l 5197
KAI_APP_URL=http://localhost:5197 KAI_API_URL=http://localhost:8010 node pruebas/ejecutar.mjs motores respuestas_markdown
```

`reporte`, `informes`, `revelado` y `consultas_guiadas` son la excepción a todo lo anterior: no miran la
aplicación compilada, sino que importan los módulos de origen y montan los
componentes sueltos —para componer PDF, dibujar gráficos o cronometrar la
aparición del texto— sin atravesar la interfaz. Necesitan el servidor de
desarrollo, y se omiten si no se define `KAI_DEV_URL`:

```bash
npx vite --port 5198 --strictPort
KAI_DEV_URL=http://localhost:5198 node pruebas/ejecutar.mjs
```

### Dos trampas del control programático del navegador

- **Las métricas de dispositivo persisten entre ejecuciones.** Una sonda que
  termina emulando una pantalla estrecha deja a la siguiente midiendo con ese
  ancho. El ejecutor las restablece antes de cada sonda; una sonda lanzada a mano
  después de otra debe hacerlo por su cuenta.
- **`innerText` devuelve el texto de los elementos ocultos.** Para saber si algo
  se muestra hay que consultar la geometría o el estilo calculado, no el texto.

---

## Integración continua

`.github/workflows/pruebas.yml` ejecuta el grupo de backend en cada empuje y en
cada solicitud de incorporación, sobre un PostgreSQL de servicio cargado con
`datos_de_prueba.sql`.

`datos_de_prueba.sql` contiene el esquema completo, con las migraciones 001 a 017
aplicadas, y los datos académicos —siete rankings externos y el Ranking KAI, 58
instituciones y 60 dominios de correo de 50 de ellas, 1.249 métricas, 20.638 observaciones, 15.710 valores medidos y 4.245
investigadores— y **ninguna fila** de las tablas de cuentas, conversaciones,
mensajes, notificaciones, descargas ni solicitudes de contacto. Al regenerarlo hay que conservar esas
exclusiones, y hacerlo desde una base con **todas** las migraciones aplicadas —si
la local no las tiene, desde una copia suya—. El volcado anterior venía de una base
sin la 006 y con la 007, al revés que la local, y a ninguna de las dos le cuadraba
del todo la suite:

```bash
pg_dump -U postgres -d KAI-PROJECT --no-owner --no-privileges \
  --exclude-table-data=usuario --exclude-table-data=mensaje \
  --exclude-table-data=conversacion --exclude-table-data=notificacion \
  --exclude-table-data=descarga --exclude-table-data=solicitud_contacto \
  -f backend/pruebas/datos_de_prueba.sql
```

Las sondas de navegador no están en integración continua: requieren la aplicación
compilada y servida y un navegador con depuración remota.
