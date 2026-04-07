"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

type Encuesta = {
  id: number;
  fecha: string;
  satisfaccion: string;
  motivos: string;
  empleado: string;
  comentario?: string;
};

function formatearFecha(fechaISO: string) {
  if (!fechaISO) return "";
  const date = new Date(fechaISO);
  return (
    date.toLocaleDateString("es-AR") +
    " " +
    date.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
  );
}

function Barra({ label, value, max }: { label: string; value: number; max: number }) {
  const porcentaje = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm md:text-base">
        <span className="font-medium text-neutral-700">{label}</span>
        <span className="font-bold text-black">{value}</span>
      </div>
      <div className="w-full h-4 bg-neutral-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-black rounded-full transition-all duration-500"
          style={{ width: `${porcentaje}%` }}
        />
      </div>
    </div>
  );
}

const BADGE: Record<string, string> = {
  excelente: "bg-green-100 text-green-800",
  buena:     "bg-blue-100  text-blue-800",
  regular:   "bg-orange-100 text-orange-800",
  mala:      "bg-red-100   text-red-800",
};

export default function DashboardPage() {
  const router = useRouter();
  const [encuestas, setEncuestas] = useState<Encuesta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [actualizando, setActualizando] = useState(false);
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [filtroEmpleado, setFiltroEmpleado] = useState("");

  useEffect(() => {
    const isLogged = localStorage.getItem("dashboard_access");
    if (!isLogged) router.push("/login");
  }, [router]);

  const cargarEncuestas = useCallback(async (manual = false) => {
    if (manual) setActualizando(true);
    try {
      const res = await fetch(`/api/encuestas?t=${Date.now()}`, { cache: "no-store" });
      const datos = await res.json();
      setEncuestas(Array.isArray(datos) ? datos : []);
    } catch (error) {
      console.error("Error al cargar encuestas:", error);
    } finally {
      setCargando(false);
      setActualizando(false);
    }
  }, []);

  useEffect(() => {
    cargarEncuestas();
  }, [cargarEncuestas]);

  const handleLogout = () => {
    localStorage.removeItem("dashboard_access");
    router.push("/login");
  };

  const listaEmpleados = useMemo(() => {
    const nombres = encuestas.map((e) => e.empleado).filter(Boolean);
    return Array.from(new Set(nombres)).sort();
  }, [encuestas]);

  const encuestasFiltradas = useMemo(() => {
    return encuestas.filter((encuesta) => {
      const fechaEncuesta = new Date(encuesta.fecha);
      const cumpleDesde = fechaDesde ? fechaEncuesta >= new Date(fechaDesde + "T00:00:00") : true;
      const cumpleHasta = fechaHasta ? fechaEncuesta <= new Date(fechaHasta + "T23:59:59") : true;
      const cumpleEmpleado = filtroEmpleado ? encuesta.empleado === filtroEmpleado : true;
      return cumpleDesde && cumpleHasta && cumpleEmpleado;
    });
  }, [encuestas, fechaDesde, fechaHasta, filtroEmpleado]);

  const estadisticas = useMemo(() => {
    const total     = encuestasFiltradas.length;
    const excelente = encuestasFiltradas.filter((e) => e.satisfaccion?.toLowerCase() === "excelente").length;
    const buena     = encuestasFiltradas.filter((e) => e.satisfaccion?.toLowerCase() === "buena").length;
    const regular   = encuestasFiltradas.filter((e) => e.satisfaccion?.toLowerCase() === "regular").length;
    const mala      = encuestasFiltradas.filter((e) => e.satisfaccion?.toLowerCase() === "mala").length;

    const empleadosMap: Record<string, number> = {};
    for (const e of encuestasFiltradas) {
      const nombre = e.empleado || "Sin empleado";
      empleadosMap[nombre] = (empleadosMap[nombre] || 0) + 1;
    }

    return {
      total, excelente, buena, regular, mala,
      rankingEmpleados: Object.entries(empleadosMap)
        .sort((a, b) => b[1] - a[1])
        .map(([nombre, cantidad]) => ({ nombre, cantidad })),
      satisfaccionData: [
        { label: "Excelente", value: excelente },
        { label: "Buena",     value: buena },
        { label: "Regular",   value: regular },
        { label: "Mala",      value: mala },
      ],
    };
  }, [encuestasFiltradas]);

  const maxSatisfaccion = Math.max(...estadisticas.satisfaccionData.map((i) => i.value), 1);
  const maxEmpleados    = Math.max(...estadisticas.rankingEmpleados.map((i) => i.cantidad), 1);

  if (cargando) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-8">
        <div className="bg-white rounded-3xl shadow-2xl p-10 text-center">
          <h1 className="text-2xl font-black tracking-[0.2em] uppercase mb-4">TOMATE</h1>
          <p className="text-neutral-400 font-medium">Cargando datos...</p>
        </div>
      </div>
    );
  }

  const inputBase =
    "w-full border border-neutral-200 rounded-xl px-4 py-2.5 bg-white text-sm focus:border-black outline-none transition";

  return (
    <div className="min-h-screen bg-neutral-950 p-4 md:p-8 text-black">
      <div className="max-w-7xl mx-auto bg-white rounded-[28px] shadow-2xl overflow-hidden">

        {/* ── HEADER ── */}
        <header className="bg-black text-white px-8 py-5 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-white/40 mb-0.5">Panel de estadísticas</p>
            <h1 className="text-2xl font-black tracking-[0.2em] uppercase leading-none">TOMATE</h1>
          </div>
          <div className="flex gap-3 items-center">
            <a
              href="/"
              className="bg-white text-black px-5 py-2 rounded-full text-sm font-bold hover:bg-neutral-100 transition"
            >
              Nueva encuesta
            </a>
            <button
              onClick={handleLogout}
              className="border border-white/30 text-white/70 px-4 py-2 rounded-full text-sm
                         hover:bg-white hover:text-black transition"
            >
              Cerrar sesión
            </button>
          </div>
        </header>

        <main className="p-6 md:p-8 space-y-6">

          {/* ── FILTROS ── */}
          <section className="rounded-2xl border border-neutral-100 p-6 bg-neutral-50">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-base font-bold uppercase tracking-wide">Filtros</h2>
              <button
                onClick={() => cargarEncuestas(true)}
                disabled={actualizando}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-neutral-200 rounded-xl
                           text-sm font-semibold hover:border-black transition disabled:opacity-50"
              >
                {actualizando ? "⌛" : "↻"} Actualizar
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div>
                <label className="block text-[10px] font-bold text-neutral-400 mb-1.5 uppercase tracking-wider">Desde</label>
                <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} className={inputBase} />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-neutral-400 mb-1.5 uppercase tracking-wider">Hasta</label>
                <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} className={inputBase} />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-neutral-400 mb-1.5 uppercase tracking-wider">Empleado</label>
                <select value={filtroEmpleado} onChange={(e) => setFiltroEmpleado(e.target.value)} className={inputBase}>
                  <option value="">Todos</option>
                  {listaEmpleados.map((nombre) => (
                    <option key={nombre} value={nombre}>{nombre}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => { setFechaDesde(""); setFechaHasta(""); setFiltroEmpleado(""); }}
                className="px-6 py-2.5 rounded-xl bg-black text-white text-sm font-semibold hover:bg-neutral-800 transition"
              >
                Limpiar filtros
              </button>
            </div>
          </section>

          {/* ── KPI CARDS ── */}
          <section className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: "Total", value: estadisticas.total, cls: "text-black" },
              { label: "Excelente", value: estadisticas.excelente, cls: "text-green-600" },
              { label: "Buena",     value: estadisticas.buena,     cls: "text-blue-600" },
              { label: "Regular",   value: estadisticas.regular,   cls: "text-orange-500" },
              { label: "Mala",      value: estadisticas.mala,      cls: "text-red-600" },
            ].map(({ label, value, cls }) => (
              <div key={label} className="rounded-2xl border border-neutral-100 p-5 bg-white shadow-sm">
                <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">{label}</p>
                <p className={`text-4xl font-black ${cls}`}>{value}</p>
              </div>
            ))}
          </section>

          {/* ── GRÁFICOS ── */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-neutral-100 p-6 bg-white shadow-sm">
              <h2 className="text-sm font-bold uppercase tracking-wide mb-5">Satisfacción</h2>
              <div className="space-y-5">
                {estadisticas.satisfaccionData.map((item) => (
                  <Barra key={item.label} label={item.label} value={item.value} max={maxSatisfaccion} />
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-neutral-100 p-6 bg-white shadow-sm">
              <h2 className="text-sm font-bold uppercase tracking-wide mb-5">Ranking de empleados</h2>
              {estadisticas.rankingEmpleados.length === 0 ? (
                <p className="text-neutral-400 italic text-sm">No hay datos aún.</p>
              ) : (
                <div className="space-y-5">
                  {estadisticas.rankingEmpleados.map((item) => (
                    <Barra key={item.nombre} label={item.nombre} value={item.cantidad} max={maxEmpleados} />
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* ── TABLA ── */}
          <section className="rounded-2xl border border-neutral-100 p-6 bg-white shadow-sm">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-sm font-bold uppercase tracking-wide">Historial de encuestas</h2>
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                {Math.min(encuestasFiltradas.length, 100)} de {encuestasFiltradas.length}
              </span>
            </div>

            <div className="overflow-x-auto overflow-y-auto max-h-[500px] border border-neutral-100 rounded-xl">
              <table className="w-full text-left border-collapse text-sm">
                <thead className="sticky top-0 bg-white z-10">
                  <tr className="border-b border-neutral-100 text-[10px] uppercase tracking-wider text-neutral-400">
                    <th className="p-4 bg-white">Fecha</th>
                    <th className="p-4 bg-white">Satisfacción</th>
                    <th className="p-4 bg-white">Empleado</th>
                    <th className="p-4 bg-white">Motivos</th>
                    <th className="p-4 bg-white">Comentarios</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {encuestasFiltradas.slice(0, 100).map((e) => (
                    <tr key={e.id} className="text-neutral-700 hover:bg-neutral-50 transition-colors">
                      <td className="p-4 whitespace-nowrap text-xs">{formatearFecha(e.fecha)}</td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                          BADGE[e.satisfaccion?.toLowerCase()] ?? "bg-neutral-100 text-neutral-600"
                        }`}>
                          {e.satisfaccion}
                        </span>
                      </td>
                      <td className="p-4 font-semibold">{e.empleado}</td>
                      <td className="p-4 text-xs">{e.motivos || "—"}</td>
                      <td className="p-4 text-xs italic text-neutral-400 min-w-[180px]">
                        {e.comentario || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {encuestasFiltradas.length === 0 && (
                <div className="p-10 text-center text-neutral-400 italic text-sm">
                  No hay resultados para mostrar.
                </div>
              )}
            </div>
          </section>

        </main>
      </div>
    </div>
  );
}
