# Qué puede hacer cada plan

Este documento recoge las reglas de acceso de la plataforma: quién entra, qué ve
y qué se lleva. La implementación vive en `backend/app/acceso.py`, que es la
única fuente de la que salen todas las respuestas —el endpoint que sirve el dato,
el que autoriza una descarga y la interfaz que deshabilita un botón—.

## 1. Nadie entra sin cuenta

Solo la portada es pública. Todos los módulos —Resumen, Tendencias, Simulación,
Glosario y el Asistente— exigen sesión iniciada, y los endpoints de datos la
exigen también: un selector deshabilitado se salta escribiendo la dirección a
mano, así que la comprobación está en el servidor y la interfaz solo la refleja.

Siguen siendo públicos `/planes`, `/instituciones`, `/auth/config` y `/motores`,
porque la portada los necesita antes de que exista la cuenta.

## 2. La institución es obligatoria

El registro exige elegir una institución de un catálogo, que son **todas** las
universidades del sistema, tengan datos cargados o no. Una persona pertenece a la
suya con independencia de cuántas mediciones tengamos de ella, y una lista
recortada obligaría a quien no aparece a declarar una institución que no es la
suya. No se admite texto libre: la institución agrupa cuentas, y un campo libre
la haría inservible para eso.

El acceso con Google no pregunta nada, así que esas cuentas se crean sin
institución y se les reclama en la primera sesión, con un aviso que no se puede
posponer (`InstitucionPendiente.jsx`). La cuenta ya es válida; lo que falta es
completarla.

En la base la columna sigue admitiendo nulos, a propósito: declararla `NOT NULL`
dejaría fuera precisamente a las cuentas que tienen que entrar a rellenarla.

## 3. Qué distingue al plan gratuito

| | Gratuito | De pago | Administrador |
|---|---|---|---|
| Rankings THE y QS | los ve, no los abre | completos | completos |
| Resto de rankings | completos | completos | completos |
| Proyección en Tendencias | no | sí | sí |
| Informes por módulo | 1 PDF y 1 XLSX, una sola vez | sin tope | sin tope |
| Asistente | 1 consulta cada 3 días | según el plan | sin tope |
| Asistente fuera de la PUCV | no | no | sí |

**THE y QS se ven, pero no se abren.** El catálogo los devuelve marcados con
`restringido`, la interfaz los muestra deshabilitados con la etiqueta «plan de
pago» y el servidor responde 403 a cualquier consulta sobre ellos. En el glosario
la columna se conserva y se tapan las celdas: enseñar que el ranking existe es
justamente el propósito. Las familias se reconocen por el nombre del ranking, de
modo que un THE o un QS que se cargue mañana queda restringido sin tocar código.

**Las descargas se cuentan en el servidor.** Los informes se componen en el
navegador, así que la interfaz pide permiso antes de generarlos
(`POST /descargas`) y solo continúa si se concede. Contar en el cliente no
serviría: bastaría con borrar los datos del sitio o cambiar de equipo. El tope es
histórico, no una cuota que se reponga.

**La espera del asistente es de frecuencia, no de volumen.** El plan gratuito
admite una consulta cada tres días, medidos desde la última pregunta registrada y
no desde medianoche. Los turnos fallidos se descartan del historial, así que un
fallo del proveedor no consume la espera.

## 4. El asistente, solo para la PUCV

Por ahora el asistente atiende únicamente a las cuentas cuyo correo esté en
`@pucv.cl` o `@mail.pucv.cl`, porque cada consulta gasta un servicio de pago que
financia esa institución. Se comprueba por el dominio del correo y no por la
institución del perfil: el dominio acredita la afiliación, mientras que la
institución la elige el propio usuario. El acceso con Google sirve igual, ya que
su selector de cuentas admite las institucionales.

La lista de dominios se configura con `KAI_DOMINIOS_ASISTENTE`.

El administrador queda exento de esta regla y de todas las demás.

## 5. El módulo de investigadores

Se retiró de la plataforma web. Los datos bibliométricos siguen cargados y el
asistente los consulta con sus herramientas: lo que desaparece es la vista, no la
información. Las rutas `/cientificos` e `/investigadores-pucv` redirigen a la
portada, porque hay enlaces repartidos que aún apuntan a ellas.

Los endpoints correspondientes siguen publicados, ahora tras sesión. No se
eliminaron para no romper nada que los use; si se confirma que no los usa nadie,
retirarlos es una limpieza pendiente.

## 6. Variables de configuración

| Variable | Por defecto | Para qué |
|---|---|---|
| `KAI_DOMINIOS_ASISTENTE` | `pucv.cl,mail.pucv.cl` | Dominios con acceso al asistente |
| `GEMINI_MAX_CICLOS` | 15 | Vueltas del ciclo de herramientas por turno |
| `KAI_TOPE_FILAS` | 80 | Filas máximas de un resultado de herramienta |
| `KAI_VENTANA_MENSAJES` | 10 | Mensajes del historial que se reenvían al modelo |
| `KAI_MENSAJES_INTACTOS` | 4 | Cuántos de ellos van sin recortar |

Los límites del plan viven en la tabla `plan`, no en variables: `mensajes_por_dia`
acota el volumen de un día y `dias_entre_mensajes` la frecuencia entre consultas.
Convenio de la tabla: `NULL` significa sin límite y `0`, no incluido.

## 7. Verificación

La batería `acceso` (`backend/pruebas/test_acceso_por_plan.py`, 55
comprobaciones) cubre todo lo anterior contra la base real: el registro sin
institución y con una inventada, los endpoints cerrados, los rankings reservados
en seis rutas, el enmascarado del glosario, el tope de descargas por módulo y
formato, y el asistente según el dominio del correo, incluido el administrador
como excepción.
