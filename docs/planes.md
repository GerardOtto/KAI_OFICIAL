# Planes: cuota de tokens, límites y precio

Qué incluye cada plan, de dónde salen los precios y cómo se aplican los límites.

- **Catálogo:** tabla `plan` — se cambia con SQL, sin tocar código.
- **Cuotas y bloqueos:** [`backend/app/conversaciones.py`](../backend/app/conversaciones.py)
- **Aplicación:** `POST /chat` en [`backend/app/main.py`](../backend/app/main.py)
- **Portada:** [`components/landing/PlanesChat.jsx`](../frontend/kai-project/src/components/landing/PlanesChat.jsx)
- **Migraciones:** [`003_planes_por_tokens.sql`](../backend/migraciones/003_planes_por_tokens.sql)
  (estructura) y [`007_recalibracion_de_precios.sql`](../backend/migraciones/007_recalibracion_de_precios.sql)
  (precios y cuotas vigentes)

---

## 1. El catálogo

| Plan | Precio / mes | Equivalente CLP | Gemini / mes | Claude / mes | Consultas / día |
|---|---:|---:|---:|---:|---:|
| **Gratuito** | US$ 0 | $ 0 | 300.000 | — no incluido | 1 cada 3 días |
| **Investigador** | US$ 29 | ≈ $ 27.400 | 5.000.000 | 600.000 | 40 |
| **Departamento** | US$ 99 | ≈ $ 93.700 | 15.000.000 | 2.000.000 | 150 |
| **Institucional** | US$ 490 | ≈ $ 463.500 | 60.000.000 | 10.000.000 | sin tope |
| *Administrador* | — | — | sin tope | sin tope | sin tope |
| *Sin límite* | — | — | sin tope | sin tope | sin tope |

Precios netos, sin IVA, convertidos a 946 CLP/USD (ver §3). Los dos últimos
son internos: existen, pero no se ofrecen en la portada (`publico = FALSE`).

**Una cuenta sin plan contratado queda en el gratuito**, que es el valor por
defecto de la columna `plan_usuario`. Puede usar Gemini con su cuota y su tope
diario; **Claude solo se incluye en los planes de pago**. El rol de
administrador tiene acceso completo a todo, sin topes.

---

## 2. Por qué la cuota es por motor y no una bolsa común

Un token de Claude cuesta unas veinte veces más que uno de Gemini. Con un único
saldo, dos usuarios que consumen la misma cifra le costarían a la plataforma
cantidades muy distintas según qué motor eligieran, y el precio dejaría de tener
relación con el costo: bastaría que todos usaran Claude para que el margen
desapareciera.

Con una cuota por motor, **el costo máximo de cada plan es una cifra cerrada y
conocida de antemano**, y el precio se fija sobre ella.

Convenio de valores en la tabla `plan`, usado en todo el código:

| Valor | Significado |
|---|---|
| `NULL` | Sin límite |
| `0` | Ese motor no está incluido en el plan |
| `> 0` | Tope mensual de tokens (entrada + salida) |

> Cuidado al añadir un plan a mano: como `NULL` significa «sin límite», una
> columna sin definir concede acceso ilimitado. La migración incluye una red de
> seguridad que rellena los nulos de los planes que no son internos, y
> `estado_de_cuota()` trata a un usuario sin plan como si no tuviera acceso a
> nada, en vez de a todo.

---

## 3. De dónde salen los precios

Los precios cubren dos cosas distintas: el **costo variable** de cada cuenta
(los tokens que consume) y el **costo fijo** de mantener la plataforma, que no
depende de cuántos clientes haya. La primera versión del catálogo (US$ 12 / 45 /
180) se calculó solo sobre el costo variable: cubría la API con margen de 4×,
pero para pagar la operación hacían falta unas veinte cuentas institucionales.
La revisión de septiembre de 2026 fija los precios sobre el costo total.

Tipo de cambio de referencia: **946 CLP por USD** (dólar observado del 23-09-2026,
$ 945,87). Todos los montos son netos, sin IVA.

### 3.1 Costos fijos mensuales

| Concepto | USD | CLP | Nota |
|---|---:|---:|---|
| Sueldo bruto, 2 desarrolladores | 2.114 | 2.000.000 | ~1.000.000 CLP cada uno |
| Claude Pro (Claude Code), 1 plan | 20 | 18.900 | US$ 20/mes, o US$ 17 con pago anual |
| Railway | 20 | 18.900 | hoy 7–10 USD con 2 cuentas de administración; se presupuesta el plan Pro (US$ 20 con US$ 20 de uso incluido) para cuando haya clientes |
| Plan gratuito | 10 | 9.500 | ~100 cuentas gratuitas a ~US$ 0,08 cada una (ver 3.2) |
| **Subtotal** | **2.164** | **2.047.300** | |
| Contingencia 10 % | 216 | 204.700 | dominio, correo, variación del tipo de cambio, imprevistos |
| **Total** | **≈ 2.380** | **≈ 2.252.000** | |

Los sueldos son el 89 % del costo fijo: la infraestructura y las herramientas son
marginales al lado del trabajo. Si los desarrolladores se contratan con
contrato de trabajo, hay que sumar las cotizaciones de cargo del empleador
(seguro de cesantía, SIS, mutual y el aporte de la reforma de pensiones), del
orden de un 5–8 % adicional sobre el bruto.

### 3.2 Costo variable: tokens

Precios de las APIs, por millón de tokens:

| Motor | Entrada | Salida |
|---|---:|---:|
| `gemini-3.5-flash-lite` (el que usa el motor Gemini) | US$ 0,30 | US$ 2,50 |
| `gemini-3.5-flash` (referencia, ver 3.6) | US$ 1,50 | US$ 9,00 |
| `claude-opus-5` | US$ 5,00 | US$ 25,00 |

La cuota cuenta entrada y salida juntas, así que para presupuestar hace falta un
precio único por token contabilizado:

- Gemini, **90 % entrada / 10 % salida**: `0,9 × 0,30 + 0,1 × 2,50` = **US$ 0,52** por millón.
  La entrada pesa tanto porque el ciclo de herramientas reenvía el historial en
  cada llamada.
- Claude, **85 % entrada / 15 % salida**: `0,85 × 5 + 0,15 × 25` = **US$ 8,00** por millón.
  Más salida que Gemini porque el razonamiento (`effort: "medium"`) se factura
  como salida.

Por consulta:

| Motor | Tokens por consulta | Costo por consulta |
|---|---:|---:|
| Gemini 3.5 Flash-Lite | ~15.000 (medido, promedio) | US$ 0,0078 · $ 7,4 |
| Claude Opus 5 | ~20.000 (estimado) | US$ 0,16 · $ 151 |

Una consulta con Claude cuesta unas **20 veces** lo que una con Gemini; por eso
la cuota es por motor (§2). El plan gratuito, a una consulta cada tres días,
cuesta unos US$ 0,08 al mes por cuenta y como máximo US$ 0,16 si agota su cuota.

### 3.3 Costo máximo y margen de cada plan

Costo si la cuenta agota toda su cuota en ambos motores:

| Plan | Precio | Costo máximo tokens | Margen | Precio − tokens − 4 % de cobro |
|---|---:|---:|---:|---:|
| Investigador | US$ 29 · $ 27.400 | US$ 7,40 · $ 7.000 | **3,9×** | US$ 20,4 · $ 19.300 |
| Departamento | US$ 99 · $ 93.700 | US$ 23,80 · $ 22.500 | **4,2×** | US$ 71,2 · $ 67.400 |
| Institucional | US$ 490 · $ 463.500 | US$ 111,20 · $ 105.200 | **4,4×** | US$ 359,2 · $ 339.800 |

El 4 % es una provisión para la comisión de la pasarela de pago (Flow, Stripe o
Transbank cobran entre ~3 y ~4 % por transacción).

Hay una prueba automatizada que recalcula estos márgenes desde el catálogo real y
falla si alguno baja de 3×, de modo que un cambio de precios en la tabla `plan`
no puede dejar un plan vendiéndose por debajo de su costo sin que salte. La
migración 007 hace la misma comprobación al aplicarse.

### 3.4 Punto de equilibrio

Con un costo fijo de ≈ US$ 2.380 al mes, y suponiendo el peor caso —que todas
las cuentas agotan su cuota—:

| Combinación de clientes | Aporte mensual | ¿Cubre US$ 2.380? |
|---|---:|:---:|
| 7 institucionales | US$ 2.514 · $ 2.378.000 | sí |
| 4 institucionales + 8 departamentos + 20 investigadores | US$ 2.416 · $ 2.286.000 | sí |
| 3 institucionales + 10 departamentos + 30 investigadores | US$ 2.403 · $ 2.273.000 | sí |
| Solo investigadores | harían falta 117 | — |

Con un uso más realista, del orden del 40 % de la cuota, bastan **6 cuentas
institucionales**. Con los precios anteriores hacían falta 20 institucionales,
78 departamentos o 295 investigadores.

El plan **Institucional** es el que sostiene el negocio: una sola cuenta aporta
lo que 18 investigadores. Por eso conviene ofrecerlo con **contrato anual**
(US$ 5.880 · ≈ $ 5.562.000 al año), que es como compran las universidades y
da previsibilidad de caja. Un descuento anual habitual en el rubro es de dos
meses (pagar 10 de 12); si se ofrece, recalcula el punto de equilibrio.

### 3.5 Comparación con el mercado

Licencias de referencia en herramientas académicas y EdTech, a septiembre de 2026:

| Producto | Precio | En CLP (946) | Modelo de venta |
|---|---:|---:|---|
| Canva Pro | US$ 18/mes (US$ 144/año) | ≈ $ 17.000/mes | individual |
| Canva Business (ex Teams) | US$ 25/usuario/mes | ≈ $ 23.700/usuario/mes | por puesto, sin mínimo |
| Canva for Education | gratis | — | solo escolar (K-12); no aplica a universidades |
| Claude Pro / ChatGPT Plus | US$ 20/mes | ≈ $ 18.900/mes | individual |
| Grammarly for Education | ~US$ 10–15/usuario/año | ≈ $ 9.500–14.200/usuario/año | institucional, cotizado |
| Turnitin Feedback Studio | ~US$ 1–6,70 por estudiante/año | ≈ $ 950–6.300 | institucional, por FTE |
| SciVal (Elsevier) | ~£ 59.000/año (U. of East Anglia, 2025–26) | ≈ $ 70–75 millones/año | institucional, cotizado |
| Claude for Education / ChatGPT Edu | no publicado | — | institucional, cotizado |

Lectura:

- **Investigador (US$ 29)** queda por encima de una suscripción individual
  genérica (Canva Pro, Claude Pro) y se justifica porque incluye un modelo de
  gama alta (Opus 5) sobre datos de rankings ya depurados. Está en el rango de
  una herramienta profesional individual.
- **Institucional (US$ 490)** equivale a Canva Business para ~20 personas y es
  menos del 10 % de lo que cuesta SciVal, que es el referente directo en
  analítica de producción científica para oficinas de análisis institucional.
  Hay espacio para subir este precio una vez validado el producto con los
  primeros clientes; no hay espacio para bajarlo sin comprometer el punto de
  equilibrio.

### 3.6 Supuestos y sensibilidad

- **Modelo de Gemini.** Los márgenes suponen `gemini-3.5-flash-lite`, que es el
  primero de la cadena por defecto (`assistant_gemini.py`). Si se cambia a
  `gemini-3.5-flash` (US$ 1,50 / 9,00), el costo por token de Gemini se
  multiplica por 4,3 y los márgenes caen a 1,8×–2,3×: habría que reducir las
  cuotas de Gemini a la cuarta parte o subir los precios.
- **Nivel gratuito de Gemini.** Con clientes de pago hay que pasar la clave al
  nivel de pago de Google: el nivel gratuito tiene topes por minuto y por día
  que un plan institucional supera.
- **Tipo de cambio.** Los sueldos se pagan en CLP y los proveedores cobran en
  USD. Un alza del dólar de 946 a 1.000 CLP baja el costo fijo en USD (≈ −5 %)
  pero sube el de las APIs en CLP en la misma proporción; con precios en USD el
  efecto neto es favorable.
- **IVA.** A clientes en Chile que pidan factura se les suma el 19 % de IVA
  sobre los precios de esta tabla (Investigador ≈ $ 32.600, Departamento
  ≈ $ 111.400, Institucional ≈ $ 551.600 al mes con IVA).
- **Tokens por consulta.** Los ~15.000 de Gemini son un promedio medido; los
  ~20.000 de Claude, una estimación. Si el promedio real de Claude resulta mayor,
  el costo máximo no cambia (la cuota es un tope en tokens), pero sí baja el
  número de consultas que el plan permite.

### Traducir tokens a consultas

«Tokens» no significa nada fuera del gremio, así que la portada muestra además
una estimación de consultas (`TOKENS_POR_CONSULTA` en `PlanesChat.jsx`):

| Plan | Consultas Gemini / mes | Consultas Claude / mes |
|---|---:|---:|
| Gratuito | ≈ 20 (limitado a 1 cada 3 días) | — |
| Investigador | ≈ 330 | ≈ 30 |
| Departamento | ≈ 1.000 | ≈ 100 |
| Institucional | ≈ 4.000 | ≈ 500 |

Es una estimación y se rotula como tal. Lo que se descuenta son los tokens
realmente consumidos.

### Fuentes (consultadas el 25-09-2026)

- Precio de Claude Opus 5: tabla de modelos de la API de Anthropic.
- Claude Pro: <https://support.claude.com/en/articles/8325606-what-is-the-pro-plan>
- Gemini 3.5 Flash-Lite: <https://www.eesel.ai/blog/gemini-3-5-flash-lite-pricing>,
  <https://artificialanalysis.ai/models/gemini-3-5-flash-lite>
- Gemini 3.5 Flash: <https://devtk.ai/en/models/gemini-3-5-flash/>
- Railway: <https://docs.railway.com/pricing/plans>
- Dólar observado: <https://www.sii.cl/valores_y_fechas/dolar/dolar2026.htm>,
  <https://si3.bcentral.cl/Bdemovil/BDE/Series/MOV_SC_TC1>
- Canva: <https://socialrails.com/blog/canva-pricing>,
  <https://www.stylefactoryproductions.com/blog/canva-for-education>
- Grammarly y Turnitin: <https://www.edtick.com/en/software/alternatives/grammarly-alternatives>,
  <https://www.edusageai.com/blogs/turnitin-pricing-for-teachers-and-schools-in-2026-what-you-can-actually-buy>
- SciVal: <https://www.find-tender.service.gov.uk/Notice/034276-2025>

Los precios de proveedores cambian; conviene revisar esta sección cada semestre.

---

## 4. Cómo se aplican los límites

`POST /chat` comprueba, **antes de escribir nada** y después de saber qué motor
atiende el turno:

1. **¿El plan incluye el motor?** Si no → **403**, con un mensaje que dice que es
   cuestión de plan y ofrece el motor gratuito. Un rechazo no deja conversación
   creada ni mensaje guardado.
2. **¿Queda cuota diaria?** Si no → **429**.
3. **¿Quedan tokens mensuales de ese motor?** Si no → **429**.

La distinción entre 403 y 429 no es cosmética: son acciones distintas. El 403 se
resuelve contratando; el 429, esperando. El límite mensual se restablece el día 1;
el diario, al día siguiente.

Agotar un motor **no bloquea el otro**: un usuario que gastó toda su cuota de
Claude sigue consultando con Gemini.

### En la interfaz

- El selector de motor muestra bloqueado, con candado y el rótulo «No incluido en
  tu plan», el motor que el plan no cubre, y enlaza a los planes. Así el usuario
  lo ve antes de escribir, en vez de descubrirlo al enviar.
- El pie de la barra lateral lleva **una barra de consumo por motor**: con una
  sola no se sabría cuál se agotó.
- `GET /motores` informa de `incluido_en_plan` cuando hay sesión, y de `null`
  cuando no la hay: sin sesión el servidor no afirma nada sobre un plan que
  todavía no conoce.

---

## 5. Cambiar precios o límites

Todo está en la tabla `plan`; no hay valores repetidos en el código:

```sql
-- Subir la cuota de Claude del plan Investigador
UPDATE plan SET tokens_claude_mes = 800000 WHERE codigo_plan = 'investigador';

-- Cambiar un precio
UPDATE plan SET precio_mensual_usd = 35 WHERE codigo_plan = 'investigador';

-- Asignar un plan a alguien
UPDATE usuario SET plan_usuario = 'institucional' WHERE correo_usuario = 'alguien@pucv.cl';

-- Dar acceso completo (rol de administrador)
UPDATE usuario SET plan_usuario = 'admin' WHERE correo_usuario = 'alguien@pucv.cl';
```

Al cambiar un precio conviene rehacer la cuenta del margen y del punto de
equilibrio de la sección 3. La migración 007 termina con una verificación que
aborta si algún plan de pago queda por debajo de 3× sobre el costo de su cuota.

---

## 6. Pendiente

**No hay cobro implementado.** Los botones «Contratar» de la portada llevan a
crear cuenta o al asistente; no hay pasarela de pago, ni facturación, ni cambio
de plan automático. Hoy el plan se asigna con SQL. Integrar una pasarela
(Stripe, Flow, Transbank) y registrar el estado de la suscripción es el paso
siguiente, y afecta solo a cómo se escribe `usuario.plan_usuario`: el resto del
control de cuotas ya funciona.
