"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const router = useRouter();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    // AQUÍ DEFINÍS LA CONTRASEÑA
    if (password === "admin123") { // Podés cambiarla por la que vos quieras
      localStorage.setItem("dashboard_access", "true");
      router.push("/dashboard");
    } else {
      setError(true);
    }
  };

  return (
    <div className="min-h-screen bg-[#5A0014] flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-[32px] shadow-2xl w-full max-w-md">
        <h1 className="text-2xl font-bold text-[#6D0F1F] text-center mb-6">Acceso Administración</h1>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(false); }}
              className={`w-full border-2 rounded-xl px-4 py-2 outline-none transition-all ${
                error ? 'border-red-500' : 'border-[#E2C7CE] focus:border-[#6D0F1F]'
              }`}
              placeholder="Introduce la clave"
            />
            {error && <p className="text-red-500 text-xs mt-2 font-bold italic">Contraseña incorrecta</p>}
          </div>
          <button
            type="submit"
            className="w-full bg-[#6D0F1F] text-white py-3 rounded-xl font-bold hover:bg-[#A8324A] transition-colors"
          >
            Entrar al Dashboard
          </button>
        </form>
      </div>
    </div>
  );
}