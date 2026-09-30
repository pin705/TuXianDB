// Normalises every stored image: re-encoded to webp (drops EXIF/GPS and anything hidden in the file), two sizes.
import sharp from 'sharp'

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024 // below common serverless body limits

export type Processed = { bytes: Buffer; thumb: Buffer; width: number; height: number }

export async function processImage(input: Buffer, minSide = 300): Promise<Processed | string> {
  let meta
  try {
    meta = await sharp(input, { limitInputPixels: 40_000_000 }).metadata()
  } catch {
    return 'Không đọc được file ảnh'
  }
  if (!meta.format || !['jpeg', 'png', 'webp'].includes(meta.format)) return 'Chỉ nhận ảnh JPG, PNG hoặc WebP'
  if (!meta.width || !meta.height || Math.min(meta.width, meta.height) < minSide) return `Ảnh cần ít nhất ${minSide}px mỗi chiều`
  const base = () => sharp(input, { limitInputPixels: 40_000_000 }).rotate()
  const full = await base().resize({ width: 1200, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer({ resolveWithObject: true })
  const thumb = await base().resize({ width: 360, height: 480, fit: 'inside', withoutEnlargement: true }).webp({ quality: 78 }).toBuffer()
  return { bytes: full.data, thumb, width: full.info.width, height: full.info.height }
}
