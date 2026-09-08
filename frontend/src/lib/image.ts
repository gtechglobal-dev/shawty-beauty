export function resizeImageBase64(dataUrl: string, maxDim: number = 1600): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const { width, height } = img
      if (width <= maxDim && height <= maxDim) {
        resolve(dataUrl)
        return
      }
      const scale = Math.min(maxDim / width, maxDim / height, 1)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(width * scale)
      canvas.height = Math.round(height * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(dataUrl)
        return
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      const isPng = dataUrl.startsWith('data:image/png')
      // WebP keeps alpha and gives far better quality per byte than JPEG/PNG.
      const webp = canvas.toDataURL('image/webp', 0.9)
      if (webp.startsWith('data:image/webp')) {
        resolve(webp)
        return
      }
      resolve(isPng ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.9))
    }
    img.onerror = () => reject(new Error('Could not read image'))
    img.src = dataUrl
  })
}

/**
 * Download an image (data URL, hosted URL, or blob URL) to the user's machine.
 * Falls back to opening in a new tab when the fetch is blocked (e.g. CORS).
 */
export async function downloadImage(src: string, filename: string): Promise<void> {
  try {
    const res = await fetch(src)
    if (!res.ok) throw new Error('fetch failed')
    const blob = await res.blob()
    const objectUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = objectUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(objectUrl)
  } catch {
    window.open(src, '_blank', 'noopener')
  }
}

/** Accurate byte size of a data URL's payload (decoded from base64). */
export function base64ByteLength(dataUrl: string): number {
  const comma = dataUrl.indexOf(',')
  const b64 = comma === -1 ? dataUrl : dataUrl.slice(comma + 1)
  const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0
  return Math.floor((b64.length * 3) / 4) - pad
}

/**
 * Optimize a logo image so the payload stays within a byte budget (default
 * 300 KB) while keeping as much quality as possible. WebP is used whenever the
 * browser can encode it (it preserves transparency AND quality far better than
 * JPEG at the same size); otherwise progressive JPEG/PNG steps are tried so
 * logos with transparency don't get flattened into a black/white JPEG.
 */
export function optimizeLogoBase64(
  dataUrl: string,
  opts: { maxBytes?: number; maxDim?: number } = {},
): Promise<string> {
  const maxBytes = opts.maxBytes ?? 300 * 1024
  const maxDim = opts.maxDim ?? 900
  const isPng = dataUrl.startsWith('data:image/png')

  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onerror = () => reject(new Error('Could not read the selected image'))
    img.onload = () => {
      try {
        let webpOK = false
        try {
          const probe = document.createElement('canvas')
          webpOK = probe.toDataURL('image/webp').startsWith('data:image/webp')
        } catch {
          webpOK = false
        }

        // Small enough already (no re-encode needed), unless it's a PNG that
        // can shrink dramatically by re-encoding to WebP.
        if (img.width <= maxDim && img.height <= maxDim && base64ByteLength(dataUrl) <= maxBytes) {
          if (!isPng || !webpOK) {
            resolve(dataUrl)
            return
          }
        }

        let best = dataUrl
        let bestBytes = base64ByteLength(dataUrl)

        const render = (dim: number, quality?: number, png = false): { url: string; bytes: number } => {
          const scale = Math.min(dim / img.width, dim / img.height, 1)
          const canvas = document.createElement('canvas')
          canvas.width = Math.max(1, Math.round(img.width * scale))
          canvas.height = Math.max(1, Math.round(img.height * scale))
          const ctx = canvas.getContext('2d')
          if (!ctx) throw new Error('Could not process the image')
          // Flatten transparency to white only when forced down to JPEG.
          if (quality !== undefined && !png && !webpOK && isPng) {
            ctx.fillStyle = '#ffffff'
            ctx.fillRect(0, 0, canvas.width, canvas.height)
          }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
          const mime = png ? 'image/png' : webpOK ? 'image/webp' : 'image/jpeg'
          const url = quality === undefined ? canvas.toDataURL(mime) : canvas.toDataURL(mime, quality)
          const bytes = base64ByteLength(url)
          if (bytes < bestBytes) {
            best = url
            bestBytes = bytes
          }
          return { url, bytes }
        }

        const dims = [maxDim, 768, 640, 512, 400, 320, 256, 192]
        const qualities = webpOK ? [0.92, 0.82, 0.72, 0.62, 0.52] : [0.85, 0.72, 0.62, 0.52, 0.42]

        for (const dim of dims) {
          for (const q of qualities) {
            const { bytes, url } = render(dim, q)
            if (bytes <= maxBytes) {
              resolve(url)
              return
            }
          }
        }

        // Transparency-friendly PNG fallback only when WebP isn't available.
        if (!webpOK) {
          for (const dim of [...dims].reverse()) {
            const { bytes, url } = render(dim, undefined, true)
            if (bytes <= maxBytes) {
              resolve(url)
              return
            }
          }
        }

        // Best effort — the smallest thing we managed to produce.
        resolve(best)
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Could not optimize the image'))
      }
    }
    img.src = dataUrl
  })
}