import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

// Esta línea es CLAVE: le dice a Vercel que NO guarde una copia vieja de los datos
export const revalidate = 0; 

export async function POST(request: Request) {
  try {
    // 1. Agregamos "comentario" a la desestructuración
    const { satisfaccion, motivos, empleado, comentario } = await request.json();
    
    const motivosTexto = Array.isArray(motivos) ? motivos.join(', ') : motivos;

    // 2. Modificamos el INSERT para incluir la columna comentario
    await sql`
      INSERT INTO encuestas (satisfaccion, motivos, empleado, comentario)
      VALUES (${satisfaccion}, ${motivosTexto}, ${empleado}, ${comentario || ''});
    `;

    return NextResponse.json({ message: "Encuesta guardada con éxito" }, { status: 200 });
  } catch (error) {
    console.error("Error en la base de datos:", error);
    return NextResponse.json({ error: "Error al guardar encuesta" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const { rows } = await sql`SELECT * FROM encuestas ORDER BY fecha DESC`;
    return NextResponse.json(rows);
  } catch (error) {
    console.error("Error al obtener datos:", error);
    return NextResponse.json({ error: "Error al obtener datos" }, { status: 500 });
  }
}