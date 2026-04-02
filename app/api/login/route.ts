import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json();
  const password = body.password;

  console.log("PASSWORD INGRESADA:", password);
  console.log("PASSWORD CONFIGURADA:", process.env.DASHBOARD_PASSWORD);

  if (password === process.env.DASHBOARD_PASSWORD) {
    const response = NextResponse.json({ ok: true });

    response.cookies.set("dashboard_auth", "ok", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8,
    });

    return response;
  }

  return NextResponse.json(
    { ok: false, message: "Contraseña incorrecta" },
    { status: 401 }
  );
}