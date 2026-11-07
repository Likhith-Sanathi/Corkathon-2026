import { clickAt, expect, openExplorer, test } from "./fixtures"

test.describe("landing page", () => {
  test("renders and links to the scorer", async ({ page, errors }) => {
    await page.goto("/")
    await expect(page.locator('a[href="/explore"]').first()).toBeVisible()
    await page.locator('a[href="/explore"]').first().click()
    await expect(page).toHaveURL(/\/explore$/)
    await expect(page.locator(".leaflet-container")).toBeVisible()
    expect(errors).toEqual([])
  })
})

test.describe("site scorer", () => {
  test("loads the map, heatmap legend and layers", async ({ page, errors }) => {
    await openExplorer(page)
    await expect(page.getByText("Data centre site scorer")).toBeVisible()
    await expect(page.getByText("Site score heatmap")).toBeVisible()
    await expect(page.getByText("Plots for sale", { exact: true })).toBeVisible()
    expect(errors).toEqual([])
  })

  test("drops a pin and shows the score with evidence", async ({ page, errors }) => {
    await openExplorer(page)
    await clickAt(page, 52.3545, 4.956) // Amsterdam Science Park
    const panel = page.locator("aside").first()
    await expect(panel.getByText("/ 100")).toBeVisible()
    await expect(panel).toContainText("Amsterdam · Noord-Holland")
    await expect(panel.getByText("Factors", { exact: true })).toBeVisible()
    await expect(panel.getByText("Power grid").first()).toBeVisible()
    await expect(panel.getByText("Plot", { exact: true })).toBeVisible()
    await expect(page.locator(".site-pin")).toBeVisible()
    await panel.getByLabel("Remove pin").click()
    await expect(page.locator(".site-pin")).toHaveCount(0)
    expect(errors).toEqual([])
  })

  test("rejects a pin outside the Netherlands", async ({ page }) => {
    await openExplorer(page)
    await clickAt(page, 52.21, 7.05, 11) // Gronau, Germany
    await expect(page.getByText(/outside the Netherlands/)).toBeVisible()
  })

  test("re-scores live when a weight changes", async ({ page }) => {
    await openExplorer(page)
    await clickAt(page, 52.13, 5.85) // Veluwe
    const share = page.getByText(/· 35% weight/)
    await expect(share).toBeVisible()
    const slider = page.getByRole("slider").first()
    await slider.focus()
    await page.keyboard.press("Home") // power weight → 0
    await expect(page.getByText(/· 0% weight/)).toBeVisible()
  })

  test("switches to OLED and remembers it across a reload", async ({ page }) => {
    await openExplorer(page)
    await page.getByRole("radio", { name: "OLED" }).click()
    await expect(page.locator("html")).toHaveClass(/\boled\b/)
    await page.reload()
    await expect(page.locator("html")).toHaveClass(/\boled\b/)
    await expect(page.getByRole("radio", { name: "OLED" })).toHaveAttribute("aria-checked", "true")
  })

  test("hides and restores both side panels, resizing the map", async ({ page }) => {
    await openExplorer(page)
    await page.getByLabel("Hide side panel").click()
    await expect(page.getByText("Data centre site scorer")).toHaveCount(0)
    await page.getByLabel("Hide panel").click()
    await page.getByRole("button", { name: "Show panel" }).click()
    await expect(page.getByText("Data centre site scorer")).toBeVisible()
    await page.getByRole("button", { name: "Featured listings", exact: true }).click()
    await expect(page.getByRole("button", { name: "Listings" })).toBeVisible()
  })

  test("featured listings open a plot's listing card", async ({ page, errors }) => {
    await openExplorer(page)
    await expect(page.getByText("Top rated")).toBeVisible()
    await page.getByRole("button").filter({ hasText: /Listed/ }).first().click()
    await expect(page.getByText("Plot size")).toBeVisible()
    await expect(page.getByText("Simulated").first()).toBeVisible()
    expect(errors).toEqual([])
  })

  test("plot search renders ranked plots with prices (search API mocked)", async ({ page }) => {
    await openExplorer(page)
    const listing = { id: "Test A 1", parkId: "p1", parkName: "Test Park", municipality: "Testdam", areaM2: 25_000, status: "for_sale", seller: "municipality", listedOn: "2026-10-01", perM2: 200, total: 5_000_000, lat: 52.3545, lon: 4.956, synthetic: true }
    await page.route("**/api/rank-sites", (route) =>
      route.fulfill({
        json: {
          query: "Testdam",
          resolved: { lat: 52.37, lon: 4.89, displayName: "Testdam, Nederland" },
          radiusKm: 30,
          maxPrice: null,
          plotsInRange: 42,
          sites: [
            { lat: listing.lat, lon: listing.lon, municipality: "Amsterdam", province: "Noord-Holland", score: 81.5, suitability: 0.815, risk: 1, factors: ["power", "isolation", "telecom", "water", "roads"].map((key) => ({ key, score: 0.8, weight: 0.2, evidence: ["x"] })), risks: [], points: [], plot: { parcel: null, businessPark: null, listing } },
          ],
        },
      }),
    )
    await page.getByPlaceholder("Near a place, e.g. Groningen").fill("Testdam")
    await page.getByRole("button", { name: "Search", exact: true }).click()
    await expect(page.getByText(/Best 1 of 42 plots for sale/)).toBeVisible()
    const row = page.locator("tbody tr").first()
    await expect(row).toContainText("Test Park")
    await expect(row).toContainText("€5M")
    await row.click()
    await expect(page.getByText("/ 100")).toBeVisible()
  })
})

test.describe("responsive @responsive", () => {
  test("on a laptop the featured bar starts closed and opens on demand", async ({ page }) => {
    await openExplorer(page)
    await expect(page.getByText("Top rated")).toHaveCount(0)
    await page.getByRole("button", { name: "Featured listings", exact: true }).click()
    await expect(page.getByText("Top rated")).toBeVisible()
  })
})
