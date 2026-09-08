# Planes: cuota de tokens, límites y precio

Qué incluye cada plan, de dónde salen los precios y cómo se aplican los límites.

- **Catálogo:** tabla `plan` — se cambia con SQL, sin tocar código.
- **Cuotas y bloqueos:** [`backend/app/conversaciones.py`](../backend/app/conversaciones.py)
- **Aplicación:** `POST /chat` en [`backend/app/main.py`](../backend/app/main.py)
- **Portada:** [`components/landing/PlanesChat.jsx`](../frontend/kai-project/src/components/landing/PlanesChat.jsx)
- **Migración:** [`003_planes_por_tokens.sql`](../backend/migraciones/003_planes_por_tokens.sql)

---

## 1. El catálogo

| Plan | Precio | Gemini / mes | Claude / mes | Consultas / día |
|---|---:|---:|---:|---:|
| **Gratuito** | US$ 0 | 300.000 | — no incluido | 15 |
| **Investigador** | US$ 12 | 2.000.000 | 300.000 | 80 |
| **Departamento** | US$ 45 | 6.000.000 | 1.200.000 | 300 |
| **Institucional** | US$ 180 | 25.000.000 | 5.000.000 | sin tope |
| *Administrador* | — | sin tope | sin tope | sin tope |
| *Sin límite* | — | sin tope | sin tope | sin tope |

Los dos últimos son internos: existen, pero no se ofrecen en la portada
(`publico = FALSE`).

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

Precios de las APIs, por millón de tokens:

| Motor | Entrada | Salida |
|---|---:|---:|
| `claude-opus-5` | US$ 5,00 | US$ 25,00 |
| `gemini-3.1-flash-lite` | US$ 0,25 | US$ 1,50 |

La cuota cuenta entrada y salida juntas, así que para presupuestar hace falta un
precio único por token contabilizado. Suponiendo una proporción de **90 % entrada
y 10 % salida** —conservadora: en las consultas medidas la entrada pesa aún más,
porque el ciclo de herramientas reenvía el historial en cada llamada—:

- Claude: `0,9 × 5,00 + 0,1 × 25,00` = **US$ 7,00** por millón
- Gemini: `0,9 × 0,25 + 0,1 × 1,50` = **US$ 0,375** por millón

Con eso, el costo máximo de cada plan si el usuario agota toda su cuota:

| Plan | Costo máximo | Precio | Margen |
|---|---:|---:|---:|
| Investigador | US$ 2,85 | US$ 12 | **4,2×** |
| Departamento | US$ 10,65 | US$ 45 | **4,2×** |
| Institucional | US$ 44,38 | US$ 180 | **4,1×** |

El margen es deliberadamente uniforme, cercano a **4×**, es decir, el costo de
los modelos ocupa una cuarta parte del precio. El resto cubre alojamiento, base
de datos, comisiones de cobro, soporte y la variación entre lo previsto y lo real.

El costo del plan gratuito es de unos **US$ 0,11 al mes por usuario** si se agota
la cuota entera, y hoy es cero mientras la clave de Gemini esté en el nivel
gratuito de Google (ver [asistente-motores.md](asistente-motores.md#el-nivel-gratuito-de-gemini)).

Hay una prueba automatizada que recalcula estos márgenes desde el catálogo real y
falla si alguno baja de 3×, de modo que un cambio de precios en la tabla `plan`
no puede dejar un plan vendiéndose por debajo de su costo sin que salte.

### Traducir tokens a consultas

«Tokens» no significa nada fuera del gremio, así que la portada muestra además
una estimación de consultas. Sale de medir consultas reales que obligan al modelo
a llamar a una herramienta y leer su resultado:

| Motor | Tokens por consulta | Origen |
|---|---:|---|
| Gemini | ~1.300 | medido: 1.192 de entrada + 54 de salida |
| Claude | ~3.000 | estimado: el ciclo de herramientas reenvía el historial en cada llamada |

Es una estimación y se rotula como tal. Lo que se descuenta son los tokens
realmente consumidos.

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
UPDATE plan SET tokens_claude_mes = 400000 WHERE codigo_plan = 'investigador';

-- Cambiar un precio
UPDATE plan SET precio_mensual_usd = 15 WHERE codigo_plan = 'investigador';

-- Asignar un plan a alguien
UPDATE usuario SET plan_usuario = 'institucional' WHERE correo_usuario = 'alguien@pucv.cl';

-- Dar acceso completo (rol de administrador)
UPDATE usuario SET plan_usuario = 'admin' WHERE correo_usuario = 'alguien@pucv.cl';
```

Al cambiar un precio conviene rehacer la cuenta del margen de la sección 3.

---

## 6. Pendiente

**No hay cobro implementado.** Los botones «Contratar» de la portada llevan a
crear cuenta o al asistente; no hay pasarela de pago, ni facturación, ni cambio
de plan automático. Hoy el plan se asigna con SQL. Integrar una pasarela
(Stripe, Flow, Transbank) y registrar el estado de la suscripción es el paso
siguiente, y afecta solo a cómo se escribe `usuario.plan_usuario`: el resto del
control de cuotas ya funciona.
