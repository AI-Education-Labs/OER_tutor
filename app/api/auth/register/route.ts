import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { username = "", email = "", password = "" } = body || {};

    if (!username || !email || !password) {
      return NextResponse.json({ detail: "Username, email, and password are required" }, { status: 400 });
    }

    const backendUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
    const upstream = await fetch(`${backendUrl}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password }),
    });

    if (!upstream.ok) {
      let detail = "Registration failed";
      try {
        const data = await upstream.json();
        detail = data?.detail || data?.message || detail;
      } catch {
        // ignore
      }
      return NextResponse.json({ detail }, { status: upstream.status });
    }

    const data = await upstream.json();
    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ detail: error?.message || "Unexpected error" }, { status: 500 });
  }
}


