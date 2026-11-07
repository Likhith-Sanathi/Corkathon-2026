import { useSyncExternalStore } from "react"
import { THEME_STORAGE_KEY as KEY } from "./theme-script"

export type Theme = "light" | "dark" | "oled"
export const THEMES: Theme[] = ["light", "dark", "oled"]

export function readTheme(): Theme {
  const c = document.documentElement.classList
  return c.contains("oled") ? "oled" : c.contains("dark") ? "dark" : "light"
}

export function applyTheme(theme: Theme) {
  const c = document.documentElement.classList
  c.toggle("dark", theme !== "light")
  c.toggle("oled", theme === "oled")
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    // storage blocked: the theme still applies for this visit
  }
}

function subscribe(onChange: () => void) {
  const obs = new MutationObserver(onChange)
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
  return () => obs.disconnect()
}

/** Current theme, read from the classes on <html> (set before paint by themeInitScript). */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, readTheme, () => "light")
}
