const configuredApiBase = (
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  "http://localhost:4000"
).replace(/\/$/, "");

function buildApiUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  return `${configuredApiBase}${path.startsWith("/") ? path : `/${path}`}`;
}

function extractErrorMessage(payload: unknown, status: number) {
  if (typeof payload === "string" && payload.trim()) return payload.trim();

  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;

    if (typeof record.error === "string" && record.error.trim()) {
      return record.error.trim();
    }

    if (typeof record.message === "string" && record.message.trim()) {
      return record.message.trim();
    }

    if (record.error && typeof record.error === "object") {
      try {
        return JSON.stringify(record.error);
      } catch {
        // Ignore serialization failures and fall through.
      }
    }
  }

  return `POSTURA API request failed with HTTP ${status}.`;
}

export async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers || {});
  const isFormData = typeof FormData !== "undefined" && init.body instanceof FormData;

  if (init.body && !isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  headers.set("Accept", "application/json");

  let response: Response;

  try {
    response = await fetch(buildApiUrl(path), {
      ...init,
      headers
    });
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : "Network request failed.";
    throw new Error(`POSTURA API is unreachable at ${configuredApiBase}. ${detail}`);
  }

  const raw = await response.text();
  let payload: unknown = null;

  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = raw;
    }
  }

  if (!response.ok) {
    throw new Error(extractErrorMessage(payload, response.status));
  }

  return payload as T;
}

export const POSTURA_API_BASE_URL = configuredApiBase;
