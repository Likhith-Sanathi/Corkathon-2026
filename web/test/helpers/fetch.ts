import { vi } from "vitest"

type Handler = (url: string, init?: RequestInit) => Response | Promise<Response>

/**
 * Replace global fetch with a router keyed on URL substrings, so API handlers never hit the network.
 * Unmatched URLs fail loudly instead of silently reaching a real service.
 */
export function mockFetch(routes: Record<string, Handler>) {
  const fn = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
    for (const [needle, handler] of Object.entries(routes)) if (url.includes(needle)) return handler(url, init)
    throw new Error(`Unexpected fetch in test: ${url}`)
  })
  vi.stubGlobal("fetch", fn)
  return fn
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })

/** Build a POST request for a route handler. */
export const post = (body: unknown, raw = false) =>
  new Request("http://localhost/api", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: raw ? (body as string) : JSON.stringify(body),
  })
