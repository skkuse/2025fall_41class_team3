import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/server/apiProxy";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  // Proxy to server-side search endpoint
  // Forward query string as-is
  return proxyRequest(req, "/api/policies/search");
}
