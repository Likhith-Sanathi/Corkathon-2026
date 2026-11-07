/**
 * Marker glyphs, defined once as SVG.
 *
 * The map rasterises them into sprites drawn on the canvas (see GlyphMarker in site-map.tsx);
 * the panel legend renders the same SVG inline, so the two always match.
 * Every glyph sits in a 40×40 box with room around it for the edge and shadow.
 */
import type { Theme } from "./theme"

export type GlyphKind = "sub380" | "sub" | "dc" | "exchange" | "junction"

type Spec = {
  label: string
  shape: "circle" | "square" | "diamond"
  color: string
}

/** Flat map dots: shape and colour alone carry the meaning, no icons. */
export const GLYPHS: Record<GlyphKind, Spec> = {
  sub380: { label: "380 kV substation", shape: "circle", color: "#e11d48" },
  sub: { label: "110–220 kV substation", shape: "circle", color: "#f59e0b" },
  dc: { label: "Data centre", shape: "square", color: "#0d9488" },
  exchange: { label: "Telecom exchange", shape: "circle", color: "#14b8a6" },
  junction: { label: "Motorway junction", shape: "diamond", color: "#7c3aed" },
}

/** The shape fills most of the 40-unit box; the map sets the on-screen size via the marker radius. */
const R = 14

function shapeSvg(s: Spec, r: number, fill: string) {
  if (s.shape === "circle") return `<circle cx="20" cy="20" r="${r}" fill="${fill}"/>`
  if (s.shape === "square") return `<rect x="${20 - r}" y="${20 - r}" width="${2 * r}" height="${2 * r}" rx="${r * 0.4}" fill="${fill}"/>`
  const d = r * 0.8 // a diamond's diagonal is longer, so shrink it to read as the same size
  return `<rect x="${20 - d}" y="${20 - d}" width="${2 * d}" height="${2 * d}" rx="${d * 0.25}" fill="${fill}" transform="rotate(45 20 20)"/>`
}

/** SVG markup for a glyph. `theme` adds the crisp edge and a faint shadow; omit it for the flat legend version. */
export function glyphSvg(kind: GlyphKind, opts: { theme?: Theme; withMark?: boolean; size?: number } = {}): string {
  const s = GLYPHS[kind]
  const { theme, size = 40 } = opts
  if (theme === undefined)
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 40 40">${shapeSvg(s, R + 2, s.color)}</svg>`
  const edge = theme === "light" ? "#ffffff" : "rgba(12,12,14,0.85)"
  const shadow = theme === "light" ? 0.22 : 0.5
  const body = shapeSvg(s, R + 2.5, edge) + shapeSvg(s, R, s.color)
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 40 40">` +
    `<defs><filter id="gs" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="0.6" stdDeviation="0.9" flood-color="#000" flood-opacity="${shadow}"/></filter></defs>` +
    `<g filter="url(#gs)">${body}</g></svg>`
  )
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
