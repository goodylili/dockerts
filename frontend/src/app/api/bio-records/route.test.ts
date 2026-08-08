import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET, POST } from "@/app/api/bio-records/route";

const KEY = "3f7c1a2e-9b1d-4c8a-8f2e-5a6b7c8d9e0f";

const PAYLOAD = {
  full_name: "Ada Lovelace",
  email: "ada@example.com",
  date_of_birth: "1990-05-02",
  sex: "female",
  height_cm: 170,
  weight_kg: 62.5,
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function postRequest(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost:3000/api/bio-records", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(PAYLOAD),
  });
}

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  process.env.BACKEND_URL = "http://backend:8000";
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.BACKEND_URL;
});

function lastCall() {
  const call = fetchMock.mock.calls.at(-1);
  if (!call) throw new Error("fetch was not called");
  const [input, init] = call;
  const url = input instanceof URL ? input.toString() : String(input);
  return { url, init };
}

describe("POST /api/bio-records", () => {
  it("forwards the Idempotency-Key header verbatim to the backend", async () => {
    fetchMock.mockImplementation(async () =>jsonResponse(201, { id: "abc" }));

    const response = await POST(postRequest({ "Idempotency-Key": KEY }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const { url, init } = lastCall();
    expect(url).toBe("http://backend:8000/api/v1/bio-records");
    expect(init?.method).toBe("POST");
    const headers = init?.headers as Record<string, string>;
    expect(headers["Idempotency-Key"]).toBe(KEY);
    expect(JSON.parse(String(init?.body))).toEqual(PAYLOAD);
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ id: "abc" });
  });

  it("sends the same key on a retry of the same fill", async () => {
    fetchMock.mockImplementation(async () =>jsonResponse(200, { id: "abc" }));

    await POST(postRequest({ "Idempotency-Key": KEY }));
    await POST(postRequest({ "Idempotency-Key": KEY }));

    const keys = fetchMock.mock.calls.map(
      (call) => (call[1]?.headers as Record<string, string>)["Idempotency-Key"],
    );
    expect(keys).toEqual([KEY, KEY]);
  });

  it("passes the backend status and body straight through", async () => {
    const conflict = {
      detail: { code: "idempotency_key_reuse", message: "nope" },
    };
    fetchMock.mockImplementation(async () =>jsonResponse(409, conflict));

    const response = await POST(postRequest({ "Idempotency-Key": KEY }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual(conflict);
  });

  it("rejects a missing or too-short idempotency key without calling the backend", async () => {
    const missing = await POST(postRequest());
    expect(missing.status).toBe(400);
    await expect(missing.json()).resolves.toMatchObject({
      detail: { code: "idempotency_key_invalid" },
    });

    const short = await POST(postRequest({ "Idempotency-Key": "abc" }));
    expect(short.status).toBe(400);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 502 with a JSON body when the backend is unreachable", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));

    const response = await POST(postRequest({ "Idempotency-Key": KEY }));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({
      detail: { code: "backend_unreachable" },
    });
  });

  it("falls back to localhost when BACKEND_URL is unset", async () => {
    delete process.env.BACKEND_URL;
    fetchMock.mockImplementation(async () =>jsonResponse(201, {}));

    await POST(postRequest({ "Idempotency-Key": KEY }));

    expect(lastCall().url).toBe("http://localhost:8000/api/v1/bio-records");
  });
});

describe("GET /api/bio-records", () => {
  it("forwards limit and offset with contract defaults", async () => {
    fetchMock.mockImplementation(async () =>
      jsonResponse(200, { items: [], total: 0, limit: 20, offset: 0 }),
    );

    const response = await GET(
      new Request("http://localhost:3000/api/bio-records"),
    );

    expect(lastCall().url).toBe(
      "http://backend:8000/api/v1/bio-records?limit=20&offset=0",
    );
    expect(response.status).toBe(200);
  });

  it("clamps out-of-range paging values", async () => {
    fetchMock.mockImplementation(async () =>jsonResponse(200, {}));

    await GET(
      new Request("http://localhost:3000/api/bio-records?limit=500&offset=-4"),
    );

    expect(lastCall().url).toBe(
      "http://backend:8000/api/v1/bio-records?limit=100&offset=0",
    );
  });

  it("returns 502 when the backend is unreachable", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));

    const response = await GET(
      new Request("http://localhost:3000/api/bio-records"),
    );

    expect(response.status).toBe(502);
  });
});
