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

    const upstream = await fetch(`${backendUrl}/api/v1/auth/token`, {
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

    // Try to derive cookie maxAge from the JWT exp claim to match backend token lifetime
    const getJwtExp = (token: string): number | null => {
      try {
        const parts = token.split(".");
        if (parts.length < 2) return null;
        const payloadB64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        const padded = payloadB64.padEnd(Math.ceil(payloadB64.length / 4) * 4, "=");
        const json = Buffer.from(padded, "base64").toString("utf-8");
        const obj = JSON.parse(json);
        return typeof obj?.exp === "number" ? obj.exp : null;
      } catch {
        return null;
      }
    };
    const nowSec = Math.floor(Date.now() / 1000);
    const expSec = accessToken ? getJwtExp(accessToken) : null;
    const derivedExpiresIn = expSec && expSec > nowSec ? expSec - nowSec : undefined;
    const expiresIn: number = (typeof data?.expires_in === "number" && data.expires_in > 0)
      ? data.expires_in
      : (typeof derivedExpiresIn === "number" ? derivedExpiresIn : 60 * 60);

    if (!accessToken) {
      return NextResponse.json({ detail: "No access token returned" }, { status: 502 });
    }

    const res = NextResponse.json({ access_token: accessToken, expires_in: expiresIn, token_type: "bearer" });
    // Set HttpOnly cookie for server-side API routes to forward Authorization
    res.cookies.set("access_token", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: expiresIn,
    });
    return res;
  } catch (error: any) {
    return NextResponse.json({ detail: error?.message || "Unexpected error" }, { status: 500 });
  }
}


