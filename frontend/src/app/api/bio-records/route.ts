import {
  BACKEND_UNREACHABLE,
  backendUrl,
  errorBody,
} from "@/lib/backend";

/** Never prerender or cache — this proxy must run per request. */
export const dynamic = "force-dynamic";

const IDEMPOTENCY_HEADER = "Idempotency-Key";
const KEY_MIN = 8;
const KEY_MAX = 128;

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/** Forwards the upstream status and JSON body untouched. */
async function passThrough(upstream: Response): Promise<Response> {
  const text = await upstream.text();
  const contentType = upstream.headers.get("content-type") ?? "";

  if (!contentType.includes("json")) {
    // The backend answered with something we cannot hand to the client as-is.
    return Response.json(
      errorBody(
        "backend_bad_response",
        `The records service returned an unexpected response (${upstream.status}).`,
      ),
      { status: 502 },
    );
  }

  return new Response(text, {
    status: upstream.status,
    headers: { "content-type": "application/json" },
  });
}

export async function POST(request: Request): Promise<Response> {
  const key = request.headers.get(IDEMPOTENCY_HEADER)?.trim() ?? "";

  if (key.length < KEY_MIN || key.length > KEY_MAX) {
    return Response.json(
      errorBody(
        "idempotency_key_invalid",
        `${IDEMPOTENCY_HEADER} header is required and must be ${KEY_MIN}..${KEY_MAX} characters.`,
      ),
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      errorBody("invalid_json", "Request body must be valid JSON."),
      { status: 400 },
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${backendUrl()}/api/v1/bio-records`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [IDEMPOTENCY_HEADER]: key,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    return Response.json(BACKEND_UNREACHABLE, { status: 502 });
  }

  return passThrough(upstream);
}

function clampInt(
  raw: string | null,
  fallback: number,
  min: number,
  max: number,
): number {
  if (raw === null || raw.trim() === "") return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const limit = clampInt(params.get("limit"), DEFAULT_LIMIT, 1, MAX_LIMIT);
  const offset = clampInt(params.get("offset"), 0, 0, Number.MAX_SAFE_INTEGER);

  const target = new URL(`${backendUrl()}/api/v1/bio-records`);
  target.searchParams.set("limit", String(limit));
  target.searchParams.set("offset", String(offset));

  let upstream: Response;
  try {
    upstream = await fetch(target, { cache: "no-store" });
  } catch {
    return Response.json(BACKEND_UNREACHABLE, { status: 502 });
  }

  return passThrough(upstream);
}
