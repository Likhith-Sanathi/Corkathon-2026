import { test as base, expect, type Page } from "@playwright/test"

/**
 * Test hook: capture the Leaflet map instance (Leaflet assigns itself to window.L when it loads),
 * so tests can drop pins at exact coordinates. Also collects page errors for a final assertion.
 */
export const test = base.extend<{ errors: string[] }>({
  // auto: runs for every test (fixtures are lazy otherwise, and the map hook must always be installed)
  errors: [
    async ({ page }, provide) => {
    const errors: string[] = []
    page.on("pageerror", (e) => errors.push(String(e)))
    page.on("console", (m) => {
      // Tile and parcel fetches can fail on flaky CI networks; app code errors still surface as pageerror.
      if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text())
    })
    await page.addInitScript(() => {
      let L: unknown
      Object.defineProperty(window, "L", {
        configurable: true,
        get: () => L,
        set(v: { Map: { addInitHook: (fn: (this: unknown) => void) => void } }) {
          L = v
          v.Map.addInitHook(function (this: unknown) {
            ;(window as unknown as { __map: unknown }).__map = this
          })
        },
      })
    })
    await provide(errors)
    },
    { auto: true },
  ],
})
export { expect }

/** Open the scorer, optionally in a given theme, and wait for the map and heatmap. */
export async function openExplorer(page: Page, theme?: "light" | "dark" | "oled") {
  if (theme) await page.addInitScript((t) => localStorage.setItem("theme", t), theme)
  await page.goto("/explore")
  await expect(page.locator(".leaflet-container")).toBeVisible()
  await expect(page.getByText("updates with weights")).toBeVisible()
  await page.waitForFunction(() => !!(window as unknown as { __map?: unknown }).__map)
}

/** Click the map at a geographic point (centres the map there first). */
export async function clickAt(page: Page, lat: number, lon: number, zoom = 13) {
  const pt = await page.evaluate(
    ({ lat, lon, zoom }) => {
      const m = (window as unknown as { __map: { setView: (c: number[], z: number, o: object) => void; latLngToContainerPoint: (c: number[]) => { x: number; y: number } } }).__map
      m.setView([lat, lon], zoom, { animate: false })
      const p = m.latLngToContainerPoint([lat, lon])
      return { x: p.x, y: p.y }
    },
    { lat, lon, zoom },
  )
  const box = (await page.locator(".leaflet-container").boundingBox())!
  const [x, y] = [box.x + pt.x, box.y + pt.y]
  // The side panels float over the map: make sure the target is actually map, not a panel.
  const onMap = await page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest(".leaflet-container"), [x, y])
  if (!onMap) throw new Error(`clickAt(${lat}, ${lon}): point is covered by an overlay, not the map`)
  await page.mouse.click(x, y)
}
