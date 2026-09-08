import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import ChatSidebar from "../components/asistente/ChatSidebar";
import Markdown from "../components/asistente/Markdown";
import { useAuth } from "../auth/AuthContext";
import { useConversaciones, useMotores, enviarMensaje } from "../hooks/useConversaciones";

const hora = (fecha) =>
  new Date(fecha).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", hour12: false });

const PaperclipIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.44 11.05 12.5 20a5 5 0 0 1-7.07-7.07l8.94-8.94a3.5 3.5 0 0 1 4.95 4.95L10.4 17.87a2 2 0 0 1-2.83-2.83l7.78-7.78" />
  </svg>
);

const SendIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M2 21 23 12 2 3v7l15 2-15 2z" />
  </svg>
);

const SparkleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8L12 2z" />
  </svg>
);

const ForkIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="6" cy="4" r="2" /><circle cx="18" cy="4" r="2" /><circle cx="12" cy="20" r="2" />
    <path d="M6 6v4a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V6M12 12v6" />
  </svg>
);

const SUGERENCIAS = [
  "¿Qué rankings hay cargados y qué período cubre cada uno?",
  "Compara el índice de citas de la PUCV en THE Latam entre 2019 y 2024.",
  "¿Qué universidades chilenas subieron más en Shanghai GRAS?",
];

export default function Asistente() {
  const { usuario, cuota, setCuota, refrescar } = useAuth();
  const { conversaciones, recargar, eliminar, abrir } = useConversaciones(!!usuario);
  // El catálogo se vuelve a pedir cuando cambia el plan: /motores informa de si
  // el plan incluye cada motor, y esa respuesta caduca al cambiar de plan.
  const { motores, porDefecto } = useMotores(cuota?.plan);

  const [idConversacion, setIdConversacion] = useState(null);
  const [motor, setMotor] = useState(null);
  const [mensajes, setMensajes] = useState([]);
  const [input, setInput] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  // El motor queda fijado en cuanto la conversación existe en el servidor.
  const motorBloqueado = idConversacion !== null;
  // Elegibles: configurados en el servidor Y incluidos en el plan del usuario.
  // Es la lista con la que se elige motor por defecto y se ofrece derivar; un
  // motor que el plan no cubre no debe aparecer como opción y fallar al enviar.
  const disponibles = useMemo(
    () => motores.filter((m) => m.disponible && m.incluido_en_plan !== false),
    [motores],
  );
  const motorActivo = motores.find((m) => m.id === motor) || null;

  // Elección inicial: el motor por defecto del servidor y, si ese no tiene su
  // clave configurada, el primero que sí la tenga. Solo aplica mientras no haya
  // una conversación abierta, cuyo motor manda sobre cualquier preferencia.
  useEffect(() => {
    if (motorBloqueado || disponibles.length === 0) return;
    if (motor && disponibles.some((m) => m.id === motor)) return;
    setMotor(disponibles.some((m) => m.id === porDefecto) ? porDefecto : disponibles[0].id);
  }, [disponibles, porDefecto, motor, motorBloqueado]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [mensajes, cargando]);

  const seleccionar = useCallback(async (id) => {
    setError("");
    try {
      const datos = await abrir(id);
      setIdConversacion(id);
      setMotor(datos.motor);
      setMensajes(datos.mensajes.map((m) => ({
        id: m.id_mensaje,
        role: m.rol,
        content: m.contenido,
        time: hora(m.fecha_creacion),
        tokens: m.rol === "assistant" ? m.tokens_entrada + m.tokens_salida : null,
      })));
    } catch (e) {
      setError(e.message);
    }
  }, [abrir]);

  const nuevaConversacion = () => {
    setIdConversacion(null);
    setMensajes([]);
    setInput("");
    setError("");
  };

  /** Lleva un mensaje a una conversación nueva con otro motor.
   *
   * Es la única forma de cambiar de modelo: la conversación actual se conserva
   * intacta en el historial y la nueva empieza con el contexto limpio, sin
   * arrastrar turnos producidos por el otro proveedor. La conversación no se
   * crea aquí, sino al enviar: así una derivación abandonada no deja una
   * conversación vacía en el historial.
   */
  const derivar = (texto, motorDestino) => {
    setIdConversacion(null);
    setMensajes([]);
    setMotor(motorDestino);
    setInput(texto);
    setError("");
    inputRef.current?.focus();
  };

  const borrar = async (id) => {
    try {
      await eliminar(id);
      if (id === idConversacion) nuevaConversacion();
    } catch (e) {
      setError(e.message);
    }
  };

  const enviar = async (texto) => {
    const contenido = (texto ?? input).trim();
    if (!contenido || cargando) return;
    if (!motor) { setError("Todavía no hay un motor seleccionado."); return; }

    setError("");
    setInput("");
    setMensajes((prev) => [
      ...prev,
      { id: `tmp-${Date.now()}`, role: "user", content: contenido, time: hora(Date.now()) },
    ]);
    setCargando(true);

    try {
      const r = await enviarMensaje(contenido, idConversacion, motor);
      if (r.cuota) setCuota(r.cuota);

      if (!r.ok) {
        // El proveedor falló y el servidor descartó el turno. Se trata igual que
        // un error de red: se retira el mensaje optimista y se devuelve el texto,
        // para no dejar en pantalla un turno que no existe en el historial.
        setError(r.content);
        setMensajes((prev) => prev.filter((m) => !String(m.id).startsWith("tmp-")));
        setInput(contenido);
        return;
      }

      const esNueva = idConversacion === null;
      setIdConversacion(r.id_conversacion);
      setMensajes((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: r.content,
          time: hora(Date.now()),
          tokens: r.uso.tokens_entrada + r.uso.tokens_salida,
        },
      ]);
      if (esNueva) recargar();
    } catch (e) {
      // 429 es la cuota agotada: el mensaje del servidor ya explica qué hacer.
      setError(e.message);
      setMensajes((prev) => prev.filter((m) => !String(m.id).startsWith("tmp-")));
      setInput(contenido);
      if (e.status === 401) refrescar();
    } finally {
      setCargando(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); }
  };

  const sinCupo = cuota?.excedido;
  // Ningún motor tiene su clave configurada en el servidor: no hay a quién
  // preguntar, y conviene decirlo antes de que el usuario escriba.
  const sinMotor = motores.length > 0 && disponibles.length === 0;
  const bloqueado = sinCupo || sinMotor;

  return (
    <div className="flex bg-background text-white" style={{ height: "calc(100vh - 64px)" }}>
      <ChatSidebar
        conversaciones={conversaciones}
        activeId={idConversacion}
        onSelect={seleccionar}
        onNewChat={nuevaConversacion}
        onDelete={borrar}
        cuota={cuota}
        motores={motores}
        motor={motor}
        onMotor={setMotor}
        motorBloqueado={motorBloqueado}
      />

      <main className="flex-1 flex flex-col min-w-0">
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-10 py-8 flex flex-col gap-8">
          {mensajes.length === 0 && !cargando && (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-5">
              <div className="w-12 h-12 border border-outline/30 flex items-center justify-center text-outlineSoft">
                <SparkleIcon />
              </div>
              <div>
                <p className="font-body text-sm text-outlineSoft mb-1">
                  Hola{usuario ? `, ${usuario.nombre.split(" ")[0]}` : ""}. Pregúntame sobre los rankings cargados.
                </p>
                <p className="font-mono text-[10px] uppercase tracking-widest text-[#6f6f6f]">
                  Consulto la base de datos real; no invento cifras
                </p>
                {motorActivo && (
                  <p className="font-mono text-[10px] uppercase tracking-widest text-[#6f6f6f] mt-1">
                    Motor: {motorActivo.nombre} · {motorActivo.etiqueta_costo}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-2 w-full max-w-lg">
                {SUGERENCIAS.map((s) => (
                  <button
                    key={s}
                    onClick={() => enviar(s)}
                    disabled={bloqueado}
                    className="text-left px-4 py-3 border border-outline/30 text-[12px] text-[#c4c4c4] hover:border-white/40 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {mensajes.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="group flex flex-col items-end gap-2">
                <div className="max-w-3xl bg-surfaceHigh border border-outline/40 px-6 py-4">
                  <p className="text-white/90 leading-relaxed">{m.content}</p>
                </div>
                <div className="flex items-center gap-3">
                  {/* Derivar: la misma pregunta, en una conversación nueva con el
                      otro motor. Es la vía prevista para cambiar de modelo, ya
                      que dentro de una conversación el motor no cambia. */}
                  {disponibles
                    .filter((mo) => mo.id !== motor)
                    .map((mo) => (
                      <button
                        key={mo.id}
                        onClick={() => derivar(m.content, mo.id)}
                        title={`Reenviar esta consulta a ${mo.nombre} en una conversación nueva`}
                        className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-outlineSoft opacity-0 group-hover:opacity-100 hover:text-white transition-all"
                      >
                        <ForkIcon /> Derivar a {mo.nombre}
                      </button>
                    ))}
                  <span className="text-[10px] uppercase tracking-widest text-outlineSoft">{m.time}</span>
                </div>
              </div>
            ) : (
              <div key={m.id} className="flex flex-col gap-2">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 shrink-0 flex items-center justify-center border mt-1 bg-surfaceHigh border-outline/50 text-white">
                    <SparkleIcon />
                  </div>
                  {/* La respuesta del modelo viene en Markdown: negritas,
                      listas y, sobre todo, tablas comparativas. El mensaje del
                      usuario, en cambio, se muestra literal.
                      `min-w-0` permite que el contenedor se encoja por debajo de
                      su contenido, que es lo que deja a una tabla ancha
                      desplazarse dentro del mensaje en vez de estirar la página. */}
                  <Markdown className="max-w-3xl min-w-0">{m.content}</Markdown>
                </div>
                {m.tokens != null && m.tokens > 0 && (
                  <span className="pl-11 font-mono text-[9px] uppercase tracking-widest text-[#5f5f5f]">
                    {m.time} · {m.tokens.toLocaleString("es-CL")} tokens
                  </span>
                )}
              </div>
            )
          )}

          {cargando && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 shrink-0 flex items-center justify-center bg-surfaceHigh border border-outline/50 text-white mt-1">
                <SparkleIcon />
              </div>
              <p className="text-outlineSoft text-sm italic mt-1.5">Consultando la base de datos…</p>
            </div>
          )}
        </div>

        <div className="border-t border-outline/30 px-10 py-5">
          {error && (
            <p role="alert" className="mb-3 text-[11.5px] text-negative border-l-2 border-negative pl-3 leading-relaxed">
              {error}
            </p>
          )}

          <div className={`flex items-center gap-3 bg-surfaceHigh border px-4 py-3 ${
            bloqueado ? "border-negative/40" : "border-outline/50"
          }`}>
            <span className="text-[11px] font-mono text-outlineSoft shrink-0">
              {motorActivo ? `KAI_${motorActivo.nombre.toUpperCase()}_` : "KAI_PROMPT_"}
            </span>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={cargando || bloqueado}
              placeholder={
                sinMotor ? "Ningún motor configurado en el servidor"
                  : sinCupo ? "Cuota agotada"
                    : "Consultar rankings…"
              }
              className="flex-1 bg-transparent outline-none text-sm text-white placeholder:text-outlineSoft/70 disabled:cursor-not-allowed"
            />
            <button className="text-outlineSoft cursor-not-allowed" title="Adjuntar (próximamente)">
              <PaperclipIcon />
            </button>
            <button
              onClick={() => enviar()}
              className="text-white hover:text-white/70 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              disabled={!input.trim() || cargando || bloqueado}
              title="Enviar"
            >
              <SendIcon />
            </button>
          </div>

          <div className="flex items-center justify-between mt-3 text-[9px] uppercase tracking-widest text-outlineSoft flex-wrap gap-2">
            <span>
              Datos: rankings, métricas y universidades
              {motorActivo && ` · ${motorActivo.modelo}`}
            </span>
            {cuota && motorActivo && cuota.motores?.[motorActivo.id] && (
              <span className="font-mono">
                {(() => {
                  const e = cuota.motores[motorActivo.id];
                  const tokens = e.tokens_mensuales == null
                    ? `${e.tokens_total.toLocaleString("es-CL")} tokens este mes (sin límite)`
                    : `${e.tokens_total.toLocaleString("es-CL")} / ${e.tokens_mensuales.toLocaleString("es-CL")} tokens de ${motorActivo.nombre} este mes`;
                  return cuota.mensajes_restantes != null
                    ? `${tokens} · ${cuota.mensajes_restantes} consultas restantes hoy`
                    : tokens;
                })()}
              </span>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
