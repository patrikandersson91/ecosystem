import { CanvasTexture, RepeatWrapping } from 'three'

/**
 * Generates a 256x256 tileable normal map for water surface ripples.
 * Returns a CanvasTexture suitable for use as a normal map in shaders.
 */
export function createWaterNormalMap(): CanvasTexture {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const imageData = ctx.createImageData(size, size)
  const data = imageData.data

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size
      const v = y / size
      const tau = Math.PI * 2

      // Height field from overlapping sine waves
      const h =
        Math.sin(u * tau * 4 + v * tau * 3) * 0.3 +
        Math.sin(u * tau * 7 - v * tau * 5) * 0.2 +
        Math.cos((u + v) * tau * 6) * 0.15 +
        Math.sin(u * tau * 12 + v * tau * 9) * 0.08

      // Compute partial derivatives for normal
      const eps = 1 / size
      const hR =
        Math.sin((u + eps) * tau * 4 + v * tau * 3) * 0.3 +
        Math.sin((u + eps) * tau * 7 - v * tau * 5) * 0.2 +
        Math.cos(((u + eps) + v) * tau * 6) * 0.15 +
        Math.sin((u + eps) * tau * 12 + v * tau * 9) * 0.08

      const hU =
        Math.sin(u * tau * 4 + (v + eps) * tau * 3) * 0.3 +
        Math.sin(u * tau * 7 - (v + eps) * tau * 5) * 0.2 +
        Math.cos((u + (v + eps)) * tau * 6) * 0.15 +
        Math.sin(u * tau * 12 + (v + eps) * tau * 9) * 0.08

      const dx = (hR - h) / eps
      const dy = (hU - h) / eps

      // Normal from derivatives, packed to 0-255 (tangent space)
      const nx = -dx * 0.5 + 0.5
      const ny = -dy * 0.5 + 0.5
      const nz = 1.0

      const idx = (y * size + x) * 4
      data[idx] = Math.floor(Math.max(0, Math.min(1, nx)) * 255)
      data[idx + 1] = Math.floor(Math.max(0, Math.min(1, ny)) * 255)
      data[idx + 2] = Math.floor(Math.max(0, Math.min(1, nz)) * 255)
      data[idx + 3] = 255
    }
  }

  ctx.putImageData(imageData, 0, 0)

  const texture = new CanvasTexture(canvas)
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.needsUpdate = true
  return texture
}
