"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const satisfaccionOpciones = [
  { valor: "Mala",      emoji: "😞" },
  { valor: "Regular",   emoji: "😐" },
  { valor: "Buena",     emoji: "🙂" },
  { valor: "Excelente", emoji: "😄" },
];

const opcionesMotivoPositivo = [
  "Rapidez", "Amabilidad", "Sabor", "Limpieza", "Presentación", "Otro",
];

const opcionesMotivoExcelente = [
  "Atención", "Rapidez", "Calidad", "Todo perfecto", "Muy amable", "Otro",
];

const opcionesMotivoNegativo = [
  "Lentitud", "Mala atención", "Pedido incorrecto", "Limpieza", "Presentación", "Otro",
];

const opcionesMotivoRegular = [
  "Lentitud", "Atención", "Calidad", "Limpieza", "Presentación", "Otro",
];

export default function Home() {
  const [pantalla, setPantalla] = useState<"empleados" | "satisfaccion" | "motivos" | "final">("empleados");
  const [satisfaccion, setSatisfaccion] = useState("");
  const [motivos, setMotivos] = useState<string[]>([]);
  const [empleado, setEmpleado] = useState("");
  const [comentario, setComentario] = useState("");

  const empleados = [
    { nombre: "Lucas",    foto: "/empleados/Lucas.jpg" },
    { nombre: "Lourdes",  foto: "/empleados/Lourdes.jpg" },
    { nombre: "Eugenia",  foto: "/empleados/Eugenia.jpg" },
    { nombre: "Norma",    foto: "/empleados/Norma.jpg" },
    { nombre: "Tomas",    foto: "/empleados/Tomas.jpg" },
    { nombre: "Victoria", foto: "/empleados/Victoria.jpg" },
    { nombre: "Ivana",    foto: "/empleados/Ivana.jpg" },
    { nombre: "Julieta",  foto: "/empleados/Julieta.jpg" },
  ];

  const esPositivo = satisfaccion === "Buena" || satisfaccion === "Excelente";
  const opcionesMotivos =
    satisfaccion === "Excelente" ? opcionesMotivoExcelente
    : satisfaccion === "Buena"     ? opcionesMotivoPositivo
    : satisfaccion === "Regular"   ? opcionesMotivoRegular
    : opcionesMotivoNegativo;

  const seleccionarEmpleado = (nombre: string) => {
    setEmpleado(nombre);
    setPantalla("satisfaccion");
  };

  const seleccionarSatisfaccion = (valor: string) => {
    setSatisfaccion(valor);
    setMotivos([]);
    setPantalla("motivos");
  };

  const toggleMotivo = (motivo: string) => {
    setMotivos((prev) =>
      prev.includes(motivo) ? prev.filter((m) => m !== motivo) : [...prev, motivo]
    );
  };

  const irAGracias = async () => {
    try {
      await fetch("/api/encuestas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ satisfaccion, motivos, empleado, comentario }),
      });
    } catch (error) {
      console.error("Error al guardar la encuesta:", error);
    }
    setPantalla("final");
  };

  useEffect(() => {
    if (pantalla === "final") {
      const timer = setTimeout(() => {
        setPantalla("empleados");
        setSatisfaccion("");
        setMotivos([]);
        setEmpleado("");
        setComentario("");
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [pantalla]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 md:p-8 relative">
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at center, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.75) 100%)" }} />
      <div className="relative z-10 w-full max-w-6xl min-h-[90vh] bg-white rounded-[28px] shadow-2xl overflow-hidden flex flex-col">

        {/* ── HEADER ── */}
        <header className="bg-black text-white px-8 py-5 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-black tracking-[0.22em] uppercase leading-none">TOMATE</h1>
            <p className="text-white/40 text-[10px] tracking-[0.3em] uppercase mt-1">Experiencia gastronómica</p>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center p-6 md:p-10">

          {/* ── PASO 1: EMPLEADOS ── */}
          {pantalla === "empleados" && (
            <div className="w-full text-center">
              <h2 className="text-4xl md:text-5xl font-bold text-black mb-3">
                ¿Quién te atendió hoy?
              </h2>
              <p className="text-neutral-400 text-lg mb-10">
                Tocá la persona que te brindó el servicio
              </p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                {empleados.map((item) => (
                  <button
                    key={item.nombre}
                    onClick={() => seleccionarEmpleado(item.nombre)}
                    className="group rounded-2xl border border-neutral-100 p-5 bg-white
                               hover:border-black hover:shadow-xl hover:-translate-y-1
                               transition-all duration-200 cursor-pointer"
                  >
                    <div className="w-24 h-24 md:w-28 md:h-28 rounded-full overflow-hidden bg-neutral-100 mx-auto mb-4 relative ring-2 ring-transparent group-hover:ring-black transition-all duration-200">
                      <Image
                        src={item.foto}
                        alt={item.nombre}
                        fill
                        className="object-cover transition duration-300"
                      />
                    </div>
                    <div className="text-lg md:text-xl font-bold text-black">{item.nombre}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── PASO 2: SATISFACCIÓN ── */}
          {pantalla === "satisfaccion" && (
            <div className="w-full text-center">
              <h2 className="text-4xl md:text-5xl font-bold text-black mb-3">
                ¿Cómo fue la atención de {empleado}?
              </h2>
              <p className="text-neutral-400 text-lg mb-12">
                Contanos tu experiencia
              </p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-5 max-w-3xl mx-auto">
                {satisfaccionOpciones.map(({ valor, emoji }) => (
                  <button
                    key={valor}
                    onClick={() => seleccionarSatisfaccion(valor)}
                    className="group rounded-2xl border-2 border-neutral-100 p-8 bg-white
                               hover:border-black hover:bg-black hover:text-white
                               hover:shadow-xl hover:-translate-y-1
                               transition-all duration-200 cursor-pointer"
                  >
                    <div className="text-5xl mb-4">{emoji}</div>
                    <div className="text-lg font-bold">{valor}</div>
                  </button>
                ))}
              </div>

              <button
                onClick={() => setPantalla("empleados")}
                className="mt-10 text-neutral-400 hover:text-black underline font-medium transition text-sm"
              >
                ← Volver
              </button>
            </div>
          )}

          {/* ── PASO 3: MOTIVOS + COMENTARIO ── */}
          {pantalla === "motivos" && (
            <div className="w-full text-center max-w-4xl">
              <h2 className="text-4xl md:text-5xl font-bold text-black mb-3">
                {satisfaccion === "Mala"      ? "¿Qué salió mal?"
                  : satisfaccion === "Regular"  ? "¿Qué podríamos mejorar?"
                  : satisfaccion === "Buena"    ? "¿Qué te gustó?"
                  : "¿Qué fue lo mejor?"}
              </h2>
              <p className="text-neutral-400 text-lg mb-8">
                Podés elegir más de una opción
              </p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {opcionesMotivos.map((motivo) => (
                  <button
                    key={motivo}
                    onClick={() => toggleMotivo(motivo)}
                    className={`rounded-xl px-5 py-4 text-base font-semibold border-2 transition-all duration-150 cursor-pointer ${
                      motivos.includes(motivo)
                        ? "bg-black text-white border-black"
                        : "bg-white text-black border-neutral-200 hover:border-black"
                    }`}
                  >
                    {motivo}
                  </button>
                ))}
              </div>

              <div className="mb-8 text-left">
                <p className="text-black font-semibold mb-2 text-sm uppercase tracking-wide">
                  Comentario adicional{" "}
                  <span className="text-neutral-400 font-normal normal-case tracking-normal">
                    (opcional)
                  </span>
                </p>
                <textarea
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                  placeholder={
                    satisfaccion === "Mala"     ? "Contanos qué pasó..."
                    : satisfaccion === "Regular" ? "Tu comentario (opcional)"
                    : satisfaccion === "Buena"  ? "Tu comentario (opcional)"
                    : "Dejanos un comentario si querés"
                  }
                  className="w-full p-4 rounded-xl border-2 border-neutral-200 text-base
                             focus:border-black outline-none transition resize-none h-28"
                />
              </div>

              <div className="flex gap-4 justify-center">
                <button
                  onClick={() => setPantalla("satisfaccion")}
                  className="px-8 py-3.5 rounded-full border-2 border-neutral-200 text-neutral-600
                             font-semibold hover:border-black hover:text-black transition cursor-pointer"
                >
                  ← Volver
                </button>
                <button
                  onClick={irAGracias}
                  disabled={motivos.length === 0 && comentario.length === 0}
                  className={`px-10 py-3.5 rounded-full font-semibold transition ${
                    motivos.length === 0 && comentario.length === 0
                      ? "bg-neutral-200 text-neutral-400 cursor-not-allowed"
                      : "bg-black text-white hover:bg-neutral-800 cursor-pointer"
                  }`}
                >
                  Finalizar →
                </button>
              </div>
            </div>
          )}

          {/* ── PANTALLA FINAL ── */}
          {pantalla === "final" && (
            <div className="text-center">
              <div className="w-20 h-20 rounded-full bg-black flex items-center justify-center mx-auto mb-8">
                <span className="text-white text-3xl">✓</span>
              </div>
              <h2 className="text-5xl md:text-6xl font-bold text-black mb-4">
                ¡Gracias por tu opinión!
              </h2>
              <p className="text-xl text-neutral-400">
                Tu respuesta nos ayuda a mejorar.
              </p>
            </div>
          )}

        </main>

        {/* ── FOOTER ── */}
        <footer className="border-t border-neutral-100 px-8 py-4 flex justify-between items-center">
          <p className="text-xs text-neutral-300 uppercase tracking-[0.25em] font-medium">Tomate</p>
          <p className="text-xs text-neutral-300">Gracias por visitarnos</p>
        </footer>

      </div>
    </div>
  );
}
