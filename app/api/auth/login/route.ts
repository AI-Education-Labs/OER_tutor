import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";

    let username = "";
    let password = "";

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const form = await req.formData();
      username = String(form.get("username") || "");
      password = String(form.get("password") || "");
    } else {
      const body = await req.json().catch(() => ({}));
      username = String(body.username || "");
      password = String(body.password || "");
    }

    if (!username || !password) {
      return NextResponse.json({ detail: "Username and password are required" }, { status: 400 });
    }

    const backendUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

    const upstream = await fetch(`${backendUrl}/auth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ username, password }),
    });

    if (!upstream.ok) {
      let detail = "Login failed";
      try {
        const data = await upstream.json();
        detail = data?.detail || data?.message || detail;
      } catch {
        // ignore
      }
      return NextResponse.json({ detail }, { status: upstream.status });
    }

    const data = await upstream.json();
    const accessToken: string | undefined = data?.access_token;
    const expiresIn: number = data?.expires_in ?? 60 * 60;

    if (!accessToken) {
      return NextResponse.json({ detail: "No access token returned" }, { status: 502 });
    }

    return NextResponse.json({ access_token: accessToken, expires_in: expiresIn, token_type: "bearer" });
  } catch (error: any) {
    return NextResponse.json({ detail: error?.message || "Unexpected error" }, { status: 500 });
  }
}


