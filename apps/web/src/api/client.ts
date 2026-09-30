const API_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

export async function api<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  const contentType = response.headers.get("content-type") ?? "";

  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload
        ? String((payload as { error?: unknown }).error)
        : typeof payload === "string" && payload
          ? payload
          : `Request failed with status ${response.status}`;

    throw new Error(message);
  }

  return payload as T;
}