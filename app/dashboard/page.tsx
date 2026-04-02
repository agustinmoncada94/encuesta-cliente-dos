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
  return date.toLocaleDateString("es-AR") + " " + date.toLocaleTimeString("es-AR", { hour: '2-digit', minute: '2-digit' });
}

function Barra({ label, value, max }: { label: string; value: number; max: number; }) {
  const porcentaje = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm md:text-base">
        <span className="font-medium text-gray-700">{label}</span>
        <span className="font-bold text-[#6D0F1F]">{value}</span>
      </div>
      <div className="w-full h-5 bg-[#F4E6E9] rounded-full overflow-hidden">
        <div
          className="h-full bg-[#A8324A] rounded-full transition-all duration-500"
          style={{ width: `${porcentaje}%` }}
        />
      </div>
    </div>
  );
}

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
    if (!isLogged) {
      router.push("/login");
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("dashboard_access");
    router.push("/login");
  };

  const cargarEncuestas = useCallback(async (manual = false) => {
    if (manual) setActualizando(true);
    try {
      const res = await fetch(`/api/encuestas?t=${Date.now()}`, { 
        cache: "no-store"
      });
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

  const listaEmpleados = useMemo(() => {
    const nombres = encuestas.map((e) => e.empleado).filter(Boolean);
    return Array.from(new Set(nombres)).sort();
  }, [encuestas]);

  const encuestasFiltradas = useMemo(() => {
    return encuestas.filter((encuesta) => {
      const fechaEncuesta = new Date(encuesta.fecha);
      let cumpleDesde = true;
      let cumpleHasta = true;
      let cumpleEmpleado = true;

      if (fechaDesde) {
        const desde = new Date(fechaDesde + "T00:00:00");
        cumpleDesde = fechaEncuesta >= desde;
      }
      if (fechaHasta) {
        const hasta = new Date(fechaHasta + "T23:59:59");
        cumpleHasta = fechaEncuesta <= hasta;
      }
      if (filtroEmpleado) {
        cumpleEmpleado = encuesta.empleado === filtroEmpleado;
      }
      return cumpleDesde && cumpleHasta && cumpleEmpleado;
    });
  }, [encuestas, fechaDesde, fechaHasta, filtroEmpleado]);

  const estadisticas = useMemo(() => {
    const total = encuestasFiltradas.length;
    const excelente = encuestasFiltradas.filter((e) => e.satisfaccion?.toLowerCase() === "excelente").length;
    const buena = encuestasFiltradas.filter((e) => e.satisfaccion?.toLowerCase() === "buena").length;
    const regular = encuestasFiltradas.filter((e) => e.satisfaccion?.toLowerCase() === "regular").length;
    const mala = encuestasFiltradas.filter((e) => e.satisfaccion?.toLowerCase() === "mala").length;

    const empleadosMap: Record<string, number> = {};

    for (const encuesta of encuestasFiltradas) {
      const nombre = encuesta.empleado || "Sin empleado";
      empleadosMap[nombre] = (empleadosMap[nombre] || 0) + 1;
    }

    return {
      total, excelente, buena, regular, mala,
      rankingEmpleados: Object.entries(empleadosMap).sort((a, b) => b[1] - a[1]).map(([nombre, cantidad]) => ({ nombre, cantidad })),
      satisfaccionData: [
        { label: "Excelente", value: excelente },
        { label: "Buena", value: buena },
        { label: "Regular", value: regular },
        { label: "Mala", value: mala },
      ],
    };
  }, [encuestasFiltradas]);

  const maxSatisfaccion = Math.max(...estadisticas.satisfaccionData.map((item) => item.value), 1);
  const maxEmpleados = Math.max(...estadisticas.rankingEmpleados.map((item) => item.cantidad), 1);

  if (cargando) {
    return (
      <div className="min-h-screen bg-[#5A0014] flex items-center justify-center p-8">
        <div className="bg-white rounded-3xl shadow-2xl p-10 text-center">
          <h1 className="text-3xl font-bold text-[#6D0F1F] mb-4">Dashboard</h1>
          <p className="text-gray-500 font-medium">Cargando datos reales...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#5A0014] p-4 md:p-8 text-black">
      <div className="max-w-7xl mx-auto bg-white rounded-[32px] shadow-2xl overflow-hidden">
        <header className="bg-[#6D0F1F] text-white px-8 py-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-center md:text-left">
            <p className="text-xs uppercase tracking-[0.25em] opacity-80">Panel de estadísticas</p>
            <h1 className="text-2xl font-bold">Gomez Benitez</h1>
          </div>
          <div className="flex gap-4 items-center">
            <a href="/" className="bg-white text-[#6D0F1F] px-6 py-2 rounded-full font-bold hover:bg-gray-100 transition-colors">
              Nueva encuesta
            </a>
            <button 
              onClick={handleLogout}
              className="bg-transparent border border-white text-white px-4 py-2 rounded-full text-sm hover:bg-white hover:text-[#6D0F1F] transition-all"
            >
              Cerrar Sesión
            </button>
          </div>
        </header>

        <main className="p-6 md:p-8 space-y-8">
          {/* SECCIÓN FILTROS */}
          <section className="rounded-3xl border-2 border-[#E2C7CE] p-6 bg-[#FBF4F6]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-[#6D0F1F]">Filtros</h2>
              <button
                onClick={() => cargarEncuestas(true)}
                disabled={actualizando}
                className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-[#6D0F1F] text-[#6D0F1F] rounded-xl font-bold hover:bg-[#6D0F1F] hover:text-white transition-all disabled:opacity-50"
              >
                {actualizando ? "⌛" : "🔄"} Actualizar datos
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-2 uppercase">Desde</label>
                <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} className="w-full border-2 border-[#E2C7CE] rounded-xl px-4 py-2 bg-white" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-2 uppercase">Hasta</label>
                <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} className="w-full border-2 border-[#E2C7CE] rounded-xl px-4 py-2 bg-white" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-2 uppercase">Empleado</label>
                <select value={filtroEmpleado} onChange={(e) => setFiltroEmpleado(e.target.value)} className="w-full border-2 border-[#E2C7CE] rounded-xl px-4 py-2 bg-white">
                  <option value="">Todos los empleados</option>
                  {listaEmpleados.map((nombre) => (
                    <option key={nombre} value={nombre}>{nombre}</option>
                  ))}
                </select>
              </div>
              <button onClick={() => {setFechaDesde(""); setFechaHasta(""); setFiltroEmpleado("");}} className="px-6 py-2.5 rounded-xl bg-[#6D0F1F] text-white font-bold">
                Limpiar filtros
              </button>
            </div>
          </section>

          {/* SECCIÓN CARDS ACTUALIZADA A 5 COLUMNAS */}
          <section className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="rounded-3xl border-2 border-[#E2C7CE] p-6 bg-white shadow-sm">
              <p className="text-xs font-bold text-gray-500 uppercase">Total encuestas</p>
              <p className="text-4xl font-black text-[#6D0F1F]">{estadisticas.total}</p>
            </div>
            <div className="rounded-3xl border-2 border-[#E2C7CE] p-6 bg-white shadow-sm text-center">
              <p className="text-xs font-bold text-gray-500 uppercase">Excelente</p>
              <p className="text-4xl font-black text-green-600">{estadisticas.excelente}</p>
            </div>
            <div className="rounded-3xl border-2 border-[#E2C7CE] p-6 bg-white shadow-sm text-center">
              <p className="text-xs font-bold text-gray-500 uppercase">Buena</p>
              <p className="text-4xl font-black text-blue-600">{estadisticas.buena}</p>
            </div>
            <div className="rounded-3xl border-2 border-[#E2C7CE] p-6 bg-white shadow-sm text-center">
              <p className="text-xs font-bold text-gray-500 uppercase">Regular</p>
              <p className="text-4xl font-black text-orange-500">{estadisticas.regular}</p>
            </div>
            <div className="rounded-3xl border-2 border-[#E2C7CE] p-6 bg-white shadow-sm text-center">
              <p className="text-xs font-bold text-gray-500 uppercase">Mala</p>
              <p className="text-4xl font-black text-red-600">{estadisticas.mala}</p>
            </div>
          </section>

          {/* SECCIÓN GRÁFICOS */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="rounded-3xl border-2 border-[#E2C7CE] p-6 bg-white shadow-sm">
              <h2 className="text-xl font-bold text-[#6D0F1F] mb-6">Satisfacción</h2>
              <div className="space-y-6">
                {estadisticas.satisfaccionData.map((item) => (
                  <Barra key={item.label} label={item.label} value={item.value} max={maxSatisfaccion} />
                ))}
              </div>
            </div>
            <div className="rounded-3xl border-2 border-[#E2C7CE] p-6 bg-white shadow-sm">
              <h2 className="text-xl font-bold text-[#6D0F1F] mb-6">Ranking de empleados</h2>
              {estadisticas.rankingEmpleados.length === 0 ? (
                <p className="text-gray-400 italic">No hay datos.</p>
              ) : (
                <div className="space-y-6">
                  {estadisticas.rankingEmpleados.map((item) => (
                    <Barra key={item.nombre} label={item.nombre} value={item.cantidad} max={maxEmpleados} />
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* SECCIÓN TABLA ACTUALIZADA */}
          <section className="rounded-3xl border-2 border-[#E2C7CE] p-6 bg-white shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-[#6D0F1F]">Historial de Encuestas</h2>
              <span className="text-xs font-bold text-gray-400 uppercase">
                Mostrando {Math.min(encuestasFiltradas.length, 100)} de {encuestasFiltradas.length}
              </span>
            </div>
            
            <div className="overflow-x-auto overflow-y-auto max-h-[500px] border border-[#F4E6E9] rounded-xl">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-white shadow-sm z-10">
                  <tr className="border-b-2 border-[#F4E6E9] text-[#6D0F1F] text-sm uppercase">
                    <th className="p-4 bg-white">Fecha</th>
                    <th className="p-4 bg-white">Satisfacción</th>
                    <th className="p-4 bg-white">Empleado</th>
                    <th className="p-4 bg-white">Motivos</th>
                    <th className="p-4 bg-white">Comentarios</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F4E6E9]">
                  {encuestasFiltradas.slice(0, 100).map((e) => (
                    <tr key={e.id} className="text-gray-700 hover:bg-[#FFF9FA] transition-colors">
                      <td className="p-4 text-sm whitespace-nowrap">{formatearFecha(e.fecha)}</td>
                      <td className="p-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          e.satisfaccion?.toLowerCase() === 'excelente' || e.satisfaccion?.toLowerCase() === 'buena'
                          ? 'bg-green-100 text-green-800'
                          : e.satisfaccion?.toLowerCase() === 'regular'
                          ? 'bg-orange-100 text-orange-800'
                          : 'bg-red-100 text-red-800'
                        }`}>
                          {e.satisfaccion}
                        </span>
                      </td>
                      <td className="p-4 font-bold">{e.empleado}</td>
                      <td className="p-4 text-sm">{e.motivos || "-"}</td>
                      <td className="p-4 text-sm italic text-gray-500 min-w-[200px]">
                        {e.comentario || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {encuestasFiltradas.length === 0 && (
                <div className="p-10 text-center text-gray-400 italic">No hay resultados para mostrar.</div>
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}