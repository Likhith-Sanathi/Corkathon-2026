/**
 * Marker glyphs, defined once as SVG.
 *
 * The map rasterises them into sprites drawn on the canvas (see GlyphMarker in site-map.tsx);
 * the panel legend renders the same SVG inline, so the two always match.
 * Every glyph sits in a 40×40 box with room around it for the drop shadow.
 */
import type { Theme } from "./theme"

export type GlyphKind = "sub380" | "sub" | "dc" | "exchange" | "junction"

type Spec = {
  shape: "circle" | "square" | "diamond"
  r: number // half-size of the badge, in the 40-unit box
  fill: string
  mark: "bolt" | "server" | "dot"
  markColor: string
  markScale: number // bolt/server: scale of the 24-unit icon; dot: radius
}

export const GLYPHS: Record<GlyphKind, Spec & { label: string }> = {
  sub380: { label: "380 kV substation", shape: "circle", r: 13, fill: "#dc2626", mark: "bolt", markColor: "#ffffff", markScale: 0.72 },
  sub: { label: "110–220 kV substation", shape: "circle", r: 11, fill: "#f59e0b", mark: "bolt", markColor: "#451a03", markScale: 0.6 },
  dc: { label: "Data centre", shape: "square", r: 13, fill: "#059669", mark: "server", markColor: "#ffffff", markScale: 0.72 },
  exchange: { label: "Telecom exchange", shape: "circle", r: 8, fill: "#10b981", mark: "dot", markColor: "#ffffff", markScale: 2.6 },
  junction: { label: "Motorway junction", shape: "diamond", r: 9, fill: "#8b5cf6", mark: "dot", markColor: "#ffffff", markScale: 2.6 },
}

const BOLT = "M13 2 3 14h9l-1 8 10-12h-9l1-8z"

function shapeSvg(s: Spec, ring: string) {
  const stroke = ring === "none" ? "" : ` stroke="${ring}" stroke-width="2"`
  if (s.shape === "circle") return `<circle cx="20" cy="20" r="${s.r}" fill="${s.fill}"${stroke}/>`
  const rect = `<rect x="${20 - s.r}" y="${20 - s.r}" width="${2 * s.r}" height="${2 * s.r}" rx="${s.shape === "square" ? s.r * 0.42 : s.r * 0.28}" fill="${s.fill}"${stroke}`
  return s.shape === "diamond" ? `${rect} transform="rotate(45 20 20)"/>` : `${rect}/>`
}

function markSvg(s: Spec) {
  const at = (k: number) => `translate(${20 - 12 * k} ${20 - 12 * k}) scale(${k})`
  if (s.mark === "dot") return `<circle cx="20" cy="20" r="${s.markScale}" fill="${s.markColor}"/>`
  if (s.mark === "bolt") return `<path d="${BOLT}" fill="${s.markColor}" transform="${at(s.markScale)}"/>`
  return (
    `<g transform="${at(s.markScale)}">` +
    `<g fill="none" stroke="${s.markColor}" stroke-width="2.4"><rect x="3" y="3.5" width="18" height="7.5" rx="2"/><rect x="3" y="13" width="18" height="7.5" rx="2"/></g>` +
    `<g fill="${s.markColor}"><circle cx="7" cy="7.25" r="1.4"/><circle cx="7" cy="16.75" r="1.4"/></g></g>`
  )
}

/** SVG markup for a glyph. `theme` controls the outline and shadow; omit it for the flat legend version. */
export function glyphSvg(kind: GlyphKind, opts: { theme?: Theme; withMark?: boolean; size?: number } = {}): string {
  const s = GLYPHS[kind]
  const { theme, withMark = true, size = 40 } = opts
  const ring = theme === undefined ? "none" : theme === "light" ? "#ffffff" : "rgba(0,0,0,0.85)"
  const shadow = theme === undefined ? "" : theme === "light" ? "0.32" : "0.7"
  const body = shapeSvg(s, ring) + (withMark ? markSvg(s) : "")
  const defs = shadow
    ? `<defs><filter id="gs" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="1.2" stdDeviation="1.4" flood-color="#000" flood-opacity="${shadow}"/></filter></defs><g filter="url(#gs)">${body}</g>`
    : body
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 40 40">${defs}</svg>`
}

export type Sprite = { full: HTMLImageElement; dot: HTMLImageElement }
export type Sprites = Record<GlyphKind, Sprite>

const spriteCache = new Map<Theme, Promise<Sprites>>()

async function toImage(svg: string): Promise<HTMLImageElement> {
  const img = new Image()
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  await img.decode()
  return img
}

/** Rasterisable images for every glyph in a theme: `full` with its icon, `dot` without (for far zoom). */
export function loadSprites(theme: Theme): Promise<Sprites> {
  if (!spriteCache.has(theme)) {
    const kinds = Object.keys(GLYPHS) as GlyphKind[]
    spriteCache.set(
      theme,
      Promise.all(
        kinds.map(async (k) => {
          const [full, dot] = await Promise.all([
            toImage(glyphSvg(k, { theme, size: 80 })),
            toImage(glyphSvg(k, { theme, withMark: false, size: 80 })),
          ])
          return [k, { full, dot }] as const
        }),
      ).then((entries) => Object.fromEntries(entries) as Sprites),
    )
  }
  return spriteCache.get(theme)!
}
