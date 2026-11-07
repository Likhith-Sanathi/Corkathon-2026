import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      "@": r("./src"),
      // `server-only` throws outside a React Server Components bundle; tests import server modules directly.
      "server-only": r("./test/stubs/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    restoreMocks: true,
    unstubGlobals: true,
    unstubEnvs: true,
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts", "src/app/api/**/*.ts"],
      exclude: ["src/lib/theme.ts", "src/lib/theme-script.ts", "src/lib/glyphs.ts", "src/lib/utils.ts", "src/lib/layers.ts"],
      reporter: ["text-summary", "html", "lcov"],
      // The scoring, pricing and geometry core is what the whole app rests on: keep it well covered.
      thresholds: {
        "src/lib/geo.ts": { lines: 95, functions: 100 },
        "src/lib/scoring.ts": { lines: 90, functions: 90 },
        "src/lib/pricing.ts": { lines: 90, functions: 100 },
        "src/lib/plot.ts": { lines: 90, functions: 100 },
      },
    },
  },
})
