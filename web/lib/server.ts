import "server-only";

const SERVER_API = (process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api").replace(
  /\/$/,
  "",
);

/** Fetch from the API during server rendering. Returns null on any failure. */
export async function serverApi<T>(path: string, revalidate = 30): Promise<T | null> {
  try {
    const res = await fetch(`${SERVER_API}${path}`, { next: { revalidate } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
