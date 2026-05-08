import type { NextRequest } from "next/server";

const ARASAAC_API_BASE = "https://api.arasaac.org/api";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  const upstream = new URL(`${ARASAAC_API_BASE}/${path.join("/")}`);

  request.nextUrl.searchParams.forEach((value, key) => {
    upstream.searchParams.set(key, value);
  });

  const response = await fetch(upstream, {
    headers: {
      Accept: request.headers.get("accept") ?? "*/*",
      "User-Agent": "Amaretea/1.0 (+https://amaretea.es/)",
    },
    next: { revalidate: 3600 },
  });

  const headers = new Headers();
  const contentType = response.headers.get("content-type");

  if (contentType) {
    headers.set("content-type", contentType);
  }

  headers.set("cache-control", "public, max-age=3600, stale-while-revalidate=86400");

  if (!response.ok) {
    const message = await response.text();

    return Response.json(
      {
        error: "Provider request failed",
        status: response.status,
        detail: message.slice(0, 500),
      },
      { status: response.status },
    );
  }

  return new Response(await response.arrayBuffer(), {
    status: response.status,
    headers,
  });
}
