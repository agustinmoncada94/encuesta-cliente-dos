"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

export default function Home() {
  const [pantalla, setPantalla] = useState("Secretarias");
  const [satisfaccion, setSatisfaccion] = useState("");
  const [motivos, setMotivos] = useState<string[]>([]);
  const [empleado, setEmpleado] = useState("");
  const [comentario, setComentario] = useState(""); // Nuevo estado para comentarios

  const opcionesMotivos = [
    "Amabilidad", "Rapidisimo", "Claridad", "Predisposición", "Resolución", "Buena atención", "Otro",
  ];

  const empleados = [
    { nombre: "Pilar", foto: "/empleados/Pilar.jpg" },
    { nombre: "Lourdes", foto: "/empleados/Lourdes.jpg" },
    { nombre: "Eugenia", foto: "/empleados/Eugenia.jpg" },
    { nombre: "Norma", foto: "/empleados/Norma.jpg" },
    { nombre: "Tomas", foto: "/empleados/Tomas.jpg" },
    { nombre: "Victoria", foto: "/empleados/Victoria.jpg" },
    { nombre: "Ivana", foto: "/empleados/Ivana.jpg" },
    { nombre: "Julieta", foto: "/empleados/Julieta.jpg" },
  ];

  const seleccionarEmpleado = (nombre: string) => {
    setEmpleado(nombre);
    setPantalla("satisfaccion");
  };

  const seleccionarSatisfaccion = (valor: string) => {
    setSatisfaccion(valor);
    setPantalla("motivos");
  };

  const toggleMotivo = (motivo: string) => {
    if (motivos.includes(motivo)) {
      setMotivos(motivos.filter((m) => m !== motivo));
    } else {
      setMotivos([...motivos, motivo]);
    }
  };

  const irAGracias = async () => {
    try {
      await fetch("/api/encuestas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Se envía satisfaccion, motivos, empleado y ahora también el comentario
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
        setPantalla("Secretarias");
        setSatisfaccion("");
        setMotivos([]);
        setEmpleado("");
        setComentario(""); // Limpiamos el comentario al reiniciar
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [pantalla]);

  return (
    <div className="min-h-screen bg-[#5A0014] flex items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-6xl min-h-[90vh] bg-white rounded-[32px] shadow-2xl overflow-hidden flex flex-col">
        
        {/* HEADER */}
        <header className="bg-white text-[#6D0F1F] px-8 py-6 border-b border-gray-100">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 md:gap-0">
            <div className="text-center md:text-left md:w-[30%]">
              <p className="text-sm uppercase tracking-[0.25em] opacity-70">Encuesta de satisfacción</p>
            </div>

            <div className="md:w-[40%] flex justify-center items-center py-2 md:py-0">
              <Image 
                src="/logo.png" 
                alt="Logo Gomez Benitez"
                width={280} 
                height={90} 
                className="object-contain"
                priority 
              />
            </div>

            <div className="text-center md:text-right md:w-[30%]">
              <p className="text-sm opacity-70">Pantalla actual</p>
              <p className="text-lg font-semibold capitalize">{pantalla}</p>
            </div>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center p-6 md:p-10">
          
          {/* PASO 1: SELECCIÓN DE SECRETARIAS */}
          {pantalla === "Secretarias" && (
            <div className="w-full text-center">
              <h2 className="text-4xl md:text-5xl font-bold text-[#6D0F1F] mb-4">¿Quién lo atendió hoy?</h2>
              <p className="text-lg md:text-2xl text-gray-500 mb-10">Seleccioná al colaborador para comenzar</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {empleados.map((item) => (
                  <button
                    key={item.nombre}
                    onClick={() => seleccionarEmpleado(item.nombre)}
                    className="rounded-3xl border-4 border-[#F4E6E9] p-6 hover:scale-105 transition bg-white shadow-sm hover:border-[#6D0F1F]"
                  >
                    <div className="w-24 h-24 md:w-32 md:h-32 rounded-full overflow-hidden bg-[#F4E6E9] mx-auto mb-4 relative">
                      <Image src={item.foto} alt={item.nombre} fill className="object-cover" />
                    </div>
                    <div className="text-xl md:text-2xl font-bold text-[#6D0F1F]">{item.nombre}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* PASO 2: NIVEL DE SATISFACCIÓN */}
          {pantalla === "satisfaccion" && (
            <div className="w-full text-center">
              <h2 className="text-4xl md:text-5xl font-bold text-[#6D0F1F] mb-4">
                ¿Cómo fue el nivel de atención de {empleado}?
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-12">
                <button onClick={() => seleccionarSatisfaccion("Mala")} className="rounded-3xl border-4 border-[#F4E6E9] p-8 hover:scale-105 transition bg-white shadow-sm hover:border-[#6D0F1F]">
                  <div className="text-6xl mb-4">😕</div>
                  <div className="text-xl font-bold text-[#6D0F1F]">Mala</div>
                </button>
                <button onClick={() => seleccionarSatisfaccion("Regular")} className="rounded-3xl border-4 border-[#F4E6E9] p-8 hover:scale-105 transition bg-white shadow-sm hover:border-[#6D0F1F]">
                  <div className="text-6xl mb-4">😐</div>
                  <div className="text-xl font-bold text-[#6D0F1F]">Regular</div>
                </button>
                <button onClick={() => seleccionarSatisfaccion("Buena")} className="rounded-3xl border-4 border-[#F4E6E9] p-8 hover:scale-105 transition bg-white shadow-sm hover:border-[#6D0F1F]">
                  <div className="text-6xl mb-4">🙂</div>
                  <div className="text-xl font-bold text-[#6D0F1F]">Buena</div>
                </button>
                <button onClick={() => seleccionarSatisfaccion("Excelente")} className="rounded-3xl border-4 border-[#F4E6E9] p-8 hover:scale-105 transition bg-white shadow-sm hover:border-[#6D0F1F]">
                  <div className="text-6xl mb-4">😄</div>
                  <div className="text-xl font-bold text-[#6D0F1F]">Excelente</div>
                </button>
              </div>
              <button onClick={() => setPantalla("Secretarias")} className="mt-12 text-[#6D0F1F] underline font-semibold">
                Volver a Secretarias
              </button>
            </div>
          )}

          {/* PASO 3: MOTIVOS Y COMENTARIOS */}
          {pantalla === "motivos" && (
            <div className="w-full text-center max-w-4xl">
              <h2 className="text-4xl md:text-5xl font-bold text-[#6D0F1F] mb-4">
                {satisfaccion === "Buena" || satisfaccion === "Excelente"
                  ? "¿Qué fue lo que más le gustó?" 
                  : "¿En qué puede mejorar la atención?" 
                }
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 my-8">
                {opcionesMotivos.map((motivo) => (
                  <button
                    key={motivo}
                    onClick={() => toggleMotivo(motivo)}
                    className={`rounded-2xl px-6 py-5 text-xl font-semibold border-4 transition ${
                      motivos.includes(motivo) 
                        ? "bg-[#6D0F1F] text-white border-[#6D0F1F]" 
                        : "bg-white text-[#6D0F1F] border-[#F4E6E9]"
                    }`}
                  >
                    {motivo}
                  </button>
                ))}
              </div>

              {/* CAMPO DE COMENTARIO ADICIONAL */}
              <div className="mb-8">
                <p className="text-[#6D0F1F] text-xl font-bold mb-3">¿Desea agregar algún comentario? (Opcional)</p>
                <textarea
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                  placeholder="Escriba aquí sus observaciones..."
                  className="w-full p-4 rounded-2xl border-4 border-[#F4E6E9] text-lg focus:border-[#6D0F1F] outline-none transition resize-none h-32"
                />
              </div>

              <div className="flex gap-4 justify-center">
                <button onClick={() => setPantalla("satisfaccion")} className="px-8 py-4 rounded-full bg-gray-200 text-gray-700 font-semibold">Volver</button>
                <button 
                  onClick={irAGracias} 
                  disabled={motivos.length === 0 && comentario.length === 0} 
                  className={`px-10 py-4 rounded-full font-semibold ${
                    motivos.length === 0 && comentario.length === 0 ? "bg-gray-300 text-gray-500" : "bg-[#6D0F1F] text-white"
                  }`}
                >
                  Finalizar
                </button>
              </div>
            </div>
          )}

          {/* PANTALLA FINAL */}
          {pantalla === "final" && (
            <div className="text-center">
              <div className="text-8xl mb-6">✅</div>
              <h2 className="text-5xl md:text-6xl font-bold text-[#6D0F1F] mb-4">¡Muchas gracias!</h2>
              <p className="text-2xl text-gray-500">Tu opinión es fundamental para nosotros.</p>
            </div>
          )}

        </main>
      </div>
    </div>
  );
} 
// Update para forzar deploy 1