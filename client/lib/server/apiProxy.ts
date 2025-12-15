import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL =
  process.env.API_BASE_URL;

const hopByHopHeaders = ["connection", "keep-alive", "proxy-authenticate", "proxy-authorization", "te", "trailers", "transfer-encoding", "upgrade", "host"];

function filterHeaders(headers: Headers) {
  const filtered = new Headers();

  headers.forEach((value, key) => {
    if (!hopByHopHeaders.includes(key.toLowerCase())) {
      filtered.set(key, value);
    }
  });

  // 🔥 핵심: Authorization 강제 보존
  const auth = headers.get("authorization");
  if (auth) {
    filtered.set("authorization", auth);
  }

  return filtered;
}


export async function proxyRequest(req: NextRequest, targetPath: string) {
  const search = req.nextUrl.search ? `?${req.nextUrl.searchParams.toString()}` : "";
  const url = `${API_BASE_URL}${targetPath}${search}`;

  const init: RequestInit = {
    method: req.method,
    headers: filterHeaders(req.headers),
    cache: "no-store",
  };

  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.text();
  }

  const res = await fetch(url, init);
  const body = await res.arrayBuffer();
  const headers = new Headers(res.headers);
  headers.set("Access-Control-Allow-Origin", "*");

  return new NextResponse(body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

export function proxyGet(targetPath: string) {
  return async (req: NextRequest) => proxyRequest(req, targetPath);
}

export function proxyPost(targetPath: string) {
  return async (req: NextRequest) => proxyRequest(req, targetPath);
}

export function proxyPut(targetPath: string) {
  return async (req: NextRequest) => proxyRequest(req, targetPath);
}
