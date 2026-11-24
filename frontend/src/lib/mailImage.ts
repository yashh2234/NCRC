/** Pictures put into the text of a mail: a phone photo is far larger than a mail shows it, and makes sending slow. */

const MAX_SIDE = 1600
/** Below this a picture is kept as it is */
const SMALL = 300 * 1024

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('The picture could not be read.'))
    reader.readAsDataURL(file)
  })
}

/** data: address of the picture, made smaller when it is big; animated GIFs stay as they are */
export async function mailImage(file: File): Promise<string> {
  if (file.type === 'image/gif' || file.size <= SMALL) return readAsDataUrl(file)
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) return readAsDataUrl(file)
    // JPEG has no transparency
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
    return readAsDataUrl(blob && blob.size < file.size ? blob : file)
  } catch {
    return readAsDataUrl(file)
  } finally {
    URL.revokeObjectURL(url)
  }
}
