/**
 * Apply opacity to CSS colors for surfaces without a typed alpha field
 * (e.g. GraphGroupStyle). Prefer GraphEdgeStyle.alpha / GraphNodeStyle.alpha
 * when fading nodes or edges.
 */

/**
 * @param color - `#rgb` / `#rrggbb` / `rgb()` / `rgba()`.
 * @param alpha - opacity in `[0, 1]`.
 * @returns `rgba(...)` when alpha &lt; 1, otherwise the original color when already opaque hex/rgb.
 */
export function colorWithAlpha(color: string, alpha: number): string {
  const a = Math.min(1, Math.max(0, alpha))
  if (a >= 1) return color

  const rgbaMatch = /^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)(?:\s*,\s*([0-9.]+))?\s*\)$/i
    .exec(color.trim())
  if (rgbaMatch !== null) {
    const r = Number(rgbaMatch[1])
    const g = Number(rgbaMatch[2])
    const b = Number(rgbaMatch[3])
    const prior = rgbaMatch[4] === undefined ? 1 : Number(rgbaMatch[4])
    return `rgba(${r}, ${g}, ${b}, ${prior * a})`
  }

  const hex = color.trim()
  if (hex.startsWith('#')) {
    const raw = hex.slice(1)
    const full = raw.length === 3
      ? raw.split('').map(ch => ch + ch).join('')
      : raw
    if (full.length === 6) {
      const r = Number.parseInt(full.slice(0, 2), 16)
      const g = Number.parseInt(full.slice(2, 4), 16)
      const b = Number.parseInt(full.slice(4, 6), 16)
      if (![r, g, b].some(n => Number.isNaN(n))) {
        return `rgba(${r}, ${g}, ${b}, ${a})`
      }
    }
  }

  return color
}
