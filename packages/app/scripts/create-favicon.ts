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
}

main().catch(console.error)
