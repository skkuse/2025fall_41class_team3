import { proxyPost } from "@/lib/server/apiProxy";

export const runtime = "nodejs";

export const POST = proxyPost("/api/auth/signup");
