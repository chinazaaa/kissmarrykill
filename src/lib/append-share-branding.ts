import { appDomain } from '@/lib/site'

function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not load image'))
    }
    img.src = url
  })
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Could not create image'))
    }, 'image/png')
  })
}

/** Appends a subtle fateround.com footer below any share image. */
export async function appendShareBranding(
  contentBlob: Blob,
  {
    brand = appDomain(),
    backgroundColor,
    pixelRatio = 2,
  }: {
    brand?: string
    backgroundColor?: string
    pixelRatio?: number
  } = {}
): Promise<Blob> {
  const img = await loadImage(contentBlob)
  const bg =
    backgroundColor ||
    getComputedStyle(document.documentElement).getPropertyValue('--background').trim() ||
    '#f4f4f7'
  const faint =
    getComputedStyle(document.documentElement).getPropertyValue('--faint').trim() || '#5c5c78'

  const footerHeight = Math.round(44 * pixelRatio)
  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height + footerHeight

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported')

  ctx.fillStyle = bg
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, 0, 0)

  const centerX = canvas.width / 2
  const lineY = img.height + Math.round(14 * pixelRatio)
  const lineW = Math.round(44 * pixelRatio)

  const lineGradient = ctx.createLinearGradient(centerX - lineW / 2, lineY, centerX + lineW / 2, lineY)
  lineGradient.addColorStop(0, 'transparent')
  lineGradient.addColorStop(0.5, 'rgba(244, 63, 94, 0.45)')
  lineGradient.addColorStop(1, 'transparent')
  ctx.strokeStyle = lineGradient
  ctx.lineWidth = Math.max(1, pixelRatio)
  ctx.beginPath()
  ctx.moveTo(centerX - lineW / 2, lineY)
  ctx.lineTo(centerX + lineW / 2, lineY)
  ctx.stroke()

  const fontSize = Math.round(11 * pixelRatio)
  const fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  ctx.fillStyle = faint
  ctx.font = `500 ${fontSize}px ${fontFamily}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(brand.toLowerCase(), centerX, img.height + Math.round(28 * pixelRatio))

  return canvasToBlob(canvas)
}
