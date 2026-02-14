import { CanvasTexture, RepeatWrapping } from 'three'

/**
 * Generates a 512x512 noise texture for volumetric-style cloud rendering.
 * Uses layered sine/cosine to approximate Perlin noise.
 */
export function createCloudNoiseTexture(): CanvasTexture {
  const size = 512
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

      // Layered noise approximation
      let n = 0
      n += Math.sin(u * 6.28 * 2 + v * 6.28 * 1.5) * 0.25
      n += Math.cos(u * 6.28 * 3.7 - v * 6.28 * 2.3) * 0.2
      n += Math.sin((u + v) * 6.28 * 5.1) * 0.15
      n += Math.cos(u * 6.28 * 7.3 + v * 6.28 * 4.7) * 0.1
      n += Math.sin(u * 6.28 * 11 - v * 6.28 * 8) * 0.06
      n += Math.cos((u - v) * 6.28 * 13.2) * 0.04

      // Normalize to 0-1
      n = n * 0.5 + 0.5
      // Add some hash-like detail
      const hash = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453
      n += (hash - Math.floor(hash)) * 0.08

      n = Math.max(0, Math.min(1, n))
      const idx = (y * size + x) * 4
      const v8 = Math.floor(n * 255)
      data[idx] = v8
      data[idx + 1] = v8
      data[idx + 2] = v8
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
