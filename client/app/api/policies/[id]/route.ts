import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/server/apiProxy";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyRequest(req, `/api/policies/${id}`);
}
