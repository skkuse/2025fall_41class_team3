import {
  clearAuthCookies,
  getAccessToken,
  getRefreshToken,
  setAuthCookies,
} from "./tokenClient";

interface RefreshResponse {
  token: string;
  refreshToken: string;
  expires_in: number;
}

export async function refreshAccessToken() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  const res = await fetch("/api/auth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });

  if (!res.ok) {
    clearAuthCookies();
    return null;
  }

  const data = (await res.json()) as RefreshResponse;
  setAuthCookies({ accessToken: data.token, refreshToken: data.refreshToken, expiresIn: data.expires_in });
  return data.token;
}

export async function fetchWithAuth(input: RequestInfo | URL, init: RequestInit = {}, retry = true): Promise<Response> {
  const headers = new Headers(init.headers || {});
  const accessToken = getAccessToken();
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  if (typeof window !== "undefined") {
    console.log(
      "[recommend] fetchWithAuth ->", input.toString(),
      "hasToken=", Boolean(accessToken),
    );
  }

  const response = await fetch(input, { ...init, headers, cache: "no-store" });

  if (typeof window !== "undefined") {
    console.log("[recommend] response status", response.status, input.toString());
  }

  if (response.status !== 401 || !retry) {
    return response;
  }

  // Try silent refresh once
  if (typeof window !== "undefined") {
    console.log("[recommend] 401 received, attempting silent refresh");
  }
  const newToken = await refreshAccessToken();
  if (!newToken) {
    clearAuthCookies();
    if (typeof window !== "undefined") {
      console.log("[recommend] refresh failed, redirecting to signin");
      window.location.href = "/auth/signin";
    }
    return response;
  }

  const retryHeaders = new Headers(init.headers || {});
  retryHeaders.set("Authorization", `Bearer ${newToken}`);
  if (typeof window !== "undefined") {
    console.log("[recommend] refresh success, retrying request", input.toString());
  }
  return fetch(input, { ...init, headers: retryHeaders, cache: "no-store" });
}
