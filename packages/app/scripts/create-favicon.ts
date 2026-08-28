import sharp from 'sharp'

const SOURCE = 'static/icon-white-transparent.png'
const PURPLE = { r: 0x62, g: 0x00, b: 0xea }

// Logo box as a fraction of the canvas. A square inscribed in Android's central
// 80% safe-zone circle is 0.8 / sqrt(2) wide, which also gives iOS the padding
// Apple's icon grid implies for a square glyph — one number covers both, and
// the artwork is then valid as a maskable icon too.
const INSET = 0.56

// Opaque icons: iOS and Android both flatten alpha to black, so the brand
// background has to be baked in.
async function opaqueIcon(file: string, size: number) {
  const box = size - Math.round((size * (1 - INSET)) / 2) * 2
  const logo = await sharp(SOURCE)
    .trim()
    .resize(box, box, { fit: 'contain', background: { ...PURPLE, alpha: 0 } })
    .png()
    .toBuffer()

  // Composite onto an opaque canvas: the padding and the logo's antialiased
  // edges both end up blended against the brand purple, with no alpha left.
  await sharp({ create: { width: size, height: size, channels: 3, background: PURPLE } })
    .composite([{ input: logo }])
    .png()
    .toFile(`static/${file}`)

  const meta = await sharp(`static/${file}`).metadata()
  console.log(`${file}: ${meta.width}x${meta.height}, ${meta.channels} channels`)
}

async function main() {
  // First, let's see what trim would give us
  const trimmed = await sharp(SOURCE).trim().toBuffer({ resolveWithObject: true })
  console.log('After trim:', trimmed.info.width, 'x', trimmed.info.height)

  // Trim, then resize to 128x128 (contain mode keeps aspect ratio)
  await sharp(SOURCE)
    .trim()
    .resize(128, 128, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toFile('static/favicon.png')

  const meta = await sharp('static/favicon.png').metadata()
  console.log('Favicon:', meta.width, 'x', meta.height)

  // iOS home screen. 180 is the modern size; the rest are for older devices.
  for (const size of [120, 152, 167, 180]) {
    await opaqueIcon(`apple-touch-icon-${size}.png`, size)
  }
  // Safari also probes /apple-touch-icon.png directly, without any <link>.
  await opaqueIcon('apple-touch-icon.png', 180)

  // Android / web manifest.
  await opaqueIcon('icon-192.png', 192)
  await opaqueIcon('icon-512.png', 512)
}

main().catch(console.error)
