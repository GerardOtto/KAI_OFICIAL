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
```

| Batería | Qué verifica |
|---|---|
| `herramientas` | Las diez herramientas de consulta y la contención de `consulta_sql` |
| `motor-gemini` | Ciclo de herramientas, contabilidad de tokens y traducción de errores |
| `busqueda-web` | Declaración conjunta de búsqueda y herramientas, recuento y repliegue |
| `convivencia` | Motor fijado por conversación y aislamiento del contexto entre motores |
| `planes` | Cuotas por motor, tope diario, margen comercial y rol de administrador |
| `chat` | Recorrido completo de `/chat` con sesión y base reales |
| `concurrencia` | El tope diario bajo peticiones simultáneas del mismo usuario |
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
| `glosario` | Exclusión de un ranking, agregación multidisciplinaria y globo informativo |
| `portada` | Estructura, planes y orden de los turnos |
| `motores` | Selector de motores y derivación |
| `respuestas_markdown` | Énfasis, tablas, listas y desbordamiento |

Las dos últimas ejercitan la interfaz del asistente y necesitan además un backend
con el proveedor sustituido por un doble, con la aplicación compilada apuntando a
él. Se omiten si no se define `KAI_API_URL`.

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

`datos_de_prueba.sql` contiene el esquema completo y los datos académicos —siete
rankings, 58 instituciones, 1.239 métricas, 16.138 observaciones y 4.245
investigadores— y **ninguna fila** de las tablas de cuentas, conversaciones,
mensajes ni notificaciones. Al regenerarlo hay que conservar esas exclusiones:

```bash
pg_dump -U postgres -d KAI-PROJECT --no-owner --no-privileges \
  --exclude-table-data=usuario --exclude-table-data=mensaje \
  --exclude-table-data=conversacion --exclude-table-data=notificacion \
  -f backend/pruebas/datos_de_prueba.sql
```

Las sondas de navegador no están en integración continua: requieren la aplicación
compilada y servida y un navegador con depuración remota.
