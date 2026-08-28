import sharp from 'sharp'

async function main() {
  // First, let's see what trim would give us
  const trimmed = await sharp('static/icon-white-transparent.png')
    .trim()
    .toBuffer({ resolveWithObject: true })
  console.log('After trim:', trimmed.info.width, 'x', trimmed.info.height)

  // Trim, then resize to 128x128 (contain mode keeps aspect ratio)
  await sharp('static/icon-white-transparent.png')
    .trim()
    .resize(128, 128, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toFile('static/favicon.png')

  console.log('Created favicon.png')

  // Verify
  const meta = await sharp('static/favicon.png').metadata()
  console.log('Favicon:', meta.width, 'x', meta.height)

  // iOS home-screen icon: must be opaque (iOS flattens alpha to black) and
  // inset, since iOS applies its own rounded-corner mask.
  const PURPLE = { r: 0x62, g: 0x00, b: 0xea }
  await sharp('static/icon-white-transparent.png')
    .trim()
    .resize(140, 140, { fit: 'contain', background: { ...PURPLE, alpha: 0 } })
    .extend({ top: 20, bottom: 20, left: 20, right: 20, background: PURPLE })
    .flatten({ background: PURPLE })
    .toFile('static/apple-touch-icon.png')

  const appleMeta = await sharp('static/apple-touch-icon.png').metadata()
  console.log('Apple touch icon:', appleMeta.width, 'x', appleMeta.height, appleMeta.channels, 'channels')
}

main().catch(console.error)
