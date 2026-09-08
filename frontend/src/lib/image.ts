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
      resolve(isPng ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = () => reject(new Error('Could not read image'))
    img.src = dataUrl
  })
}