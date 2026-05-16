/**
 * Shared colour-derivation helpers.
 * Used by both the admin TripHeroSection (canvas sampling) and
 * the member-facing shared.tsx (countdown strip accentColor).
 */

/** Convert RGB to HSL, clamp L to [lMin, lMax], return hex. */
export function clampLuminance(
  r: number,
  g: number,
  b: number,
  lMin: number,
  lMax: number
): string {
  const rn = r / 255, gn = g / 255, bn = b / 255
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  const d = max - min
  let h = 0, s = 0
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1))
    switch (max) {
      case rn: h = ((gn - bn) / d + 6) % 6; break
      case gn: h = (bn - rn) / d + 2; break
      default: h = (rn - gn) / d + 4
    }
    h /= 6
  }
  const clampedL = Math.min(lMax, Math.max(lMin, Math.round(l * 100))) / 100
  return hslToHex(h, s, clampedL)
}

export function hslToHex(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h * 12) % 12
    const color = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return Math.round(255 * color).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

/**
 * Sample a region of an ImageBitmap/HTMLImageElement via canvas,
 * blend toward forest green, clamp luminance, return hex.
 * Returns null on SecurityError (cross-origin taint) or missing canvas.
 */
export function sampleImageRegion(
  img: HTMLImageElement,
  canvas: HTMLCanvasElement,
  region: 'bottom-left' | 'bottom-right' | 'center' | 'top-left' | 'top-right'
): string | null {
  try {
    const w = img.naturalWidth
    const h = img.naturalHeight
    const sw = Math.min(60, w)
    const sh = Math.min(60, h)

    let sx = 0, sy = 0
    switch (region) {
      case 'bottom-left':  sx = 0;              sy = Math.max(0, h - sh); break
      case 'bottom-right': sx = Math.max(0, w - sw); sy = Math.max(0, h - sh); break
      case 'center':       sx = Math.max(0, Math.floor(w / 2) - sw / 2); sy = Math.max(0, Math.floor(h / 2) - sh / 2); break
      case 'top-left':     sx = 0;              sy = 0; break
      case 'top-right':    sx = Math.max(0, w - sw); sy = 0; break
    }

    canvas.width = sw
    canvas.height = sh
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh)
    const data = ctx.getImageData(0, 0, sw, sh).data

    let r = 0, g = 0, b = 0, count = 0
    for (let i = 0; i < data.length; i += 4) {
      r += data[i]; g += data[i + 1]; b += data[i + 2]; count++
    }
    if (count === 0) return null

    r = Math.round(r / count)
    g = Math.round(g / count)
    b = Math.round(b / count)

    // Blend toward forest green (#2d6a4f) to stay on-brand
    const blendR = Math.round(r * 0.6 + 0x2d * 0.4)
    const blendG = Math.round(g * 0.6 + 0x6a * 0.4)
    const blendB = Math.round(b * 0.6 + 0x4f * 0.4)

    return clampLuminance(blendR, blendG, blendB, 30, 55)
  } catch (err) {
    if (err instanceof DOMException && err.name === 'SecurityError') return null
    return null
  }
}
