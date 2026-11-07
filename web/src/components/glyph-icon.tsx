import { glyphSvg, type GlyphKind } from "@/lib/glyphs"

/** Flat version of a map glyph for the panel (no outline or shadow, so it renders the same in every theme). */
export function GlyphIcon({ kind, size = 16 }: { kind: GlyphKind; size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: glyphSvg(kind, { size: size * 1.35 }) }}
    />
  )
}
