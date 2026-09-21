import sharp from 'sharp'

const SOURCE = 'static/icon-white-transparent.png'

// The app's own palette, so the home screen icon matches the header the logo sits on
// in the app: --white on --color-step-10. The purple these used to carry came from a
// previous version of the project and appears nowhere in the UI any more.
const MARK = { r: 0xed, g: 0xed, b: 0xed }
const PLATE = { r: 0x27, g: 0x27, b: 0x27 }

// Logo box as a fraction of the canvas. A square inscribed in Android's central
// 80% safe-zone circle is 0.8 / sqrt(2) wide, which also gives iOS the padding
// Apple's icon grid implies for a square glyph — one number covers both, and
// the artwork is then valid as a maskable icon too.
const INSET = 0.56

// The favicon gets a bigger mark than that. Nothing masks a favicon, and it renders
// at 16px, so the safe-zone padding above would just throw away pixels it needs.
const FAVICON_INSET = 0.74

// Opaque icons: iOS and Android both flatten alpha to black, so the background
// has to be baked in.
async function opaqueIcon(file: string, size: number, inset: number = INSET) {
  const box = size - Math.round((size * (1 - inset)) / 2) * 2

  // The source mark is near-white. Keep only its alpha and fill through that, so it
  // takes the palette colour with its antialiased edges intact — and so the faint
  // purple fringe still in the source's antialiasing is dropped rather than blended in.
  const alpha = await sharp(SOURCE)
    .trim()
    .resize(box, box, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extractChannel('alpha')
    .toBuffer()
  const logo = await sharp({ create: { width: box, height: box, channels: 3, background: MARK } })
    .joinChannel(alpha)
    .png()
    .toBuffer()

  await sharp({ create: { width: size, height: size, channels: 3, background: PLATE } })
    .composite([{ input: logo }])
    // Apple asks for no alpha channel, and every pixel here is opaque anyway.
    .removeAlpha()
    .png()
    .toFile(`static/${file}`)

  const meta = await sharp(`static/${file}`).metadata()
  console.log(`${file}: ${meta.width}x${meta.height}, ${meta.channels} channels`)
}

async function main() {
  // First, let's see what trim would give us
  const trimmed = await sharp(SOURCE).trim().toBuffer({ resolveWithObject: true })
  console.log('After trim:', trimmed.info.width, 'x', trimmed.info.height)

  // On the same plate as the rest. It used to be light-on-transparent, which is
  // invisible against a light tab strip; carrying its own background means it reads
  // the same whatever the browser puts behind it.
  await opaqueIcon('favicon.png', 128, FAVICON_INSET)

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
