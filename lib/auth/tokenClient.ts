const ACCESS_TOKEN_KEY = "accessToken";
const REFRESH_TOKEN_KEY = "refreshToken";

function isClient() {
  return typeof document !== "undefined";
}

function setCookie(name: string, value: string, maxAgeSeconds: number) {
  if (!isClient()) return;
  const secure = window.location.protocol === "https:" ? "Secure;" : "";
  document.cookie = `${name}=${value}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax; ${secure}`;
}

function deleteCookie(name: string) {
  if (!isClient()) return;
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax;`;
}

export function getCookie(name: string): string | null {
  if (!isClient()) return null;
  const cookies = document.cookie.split(";").map((c) => c.trim());
  for (const cookie of cookies) {
    if (cookie.startsWith(`${name}=`)) {
      return decodeURIComponent(cookie.split("=")[1]);
    }
  }
  return null;
}

export function setAuthCookies({
  accessToken,
  refreshToken,
  expiresIn,
}: {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}) {
  setCookie(ACCESS_TOKEN_KEY, accessToken, expiresIn || 3600);
  // refresh token: give a longer window (7 days) if server TTL is unknown beyond access TTL
  const refreshMaxAge = Math.max(expiresIn * 24 || 604800, 604800);
  setCookie(REFRESH_TOKEN_KEY, refreshToken, refreshMaxAge);
}

export function clearAuthCookies() {
  deleteCookie(ACCESS_TOKEN_KEY);
  deleteCookie(REFRESH_TOKEN_KEY);
}

export function getAccessToken() {
  return getCookie(ACCESS_TOKEN_KEY);
}

export function getRefreshToken() {
  return getCookie(REFRESH_TOKEN_KEY);
}
