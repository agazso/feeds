import { stat } from 'node:fs/promises'
import { basename } from 'node:path'
import sharp from 'sharp'

async function main() {
  const filePath = process.argv[2]

  if (!filePath) {
    console.log('Usage: npx tsx scripts/image-info.ts <image-path>')
    process.exit(1)
  }

  const [metadata, stats] = await Promise.all([sharp(filePath).metadata(), stat(filePath)])

  console.log(`File: ${basename(filePath)}`)
  console.log(`Path: ${filePath}`)
  console.log(`Dimensions: ${metadata.width}x${metadata.height}`)
  console.log(`Format: ${metadata.format}`)
  console.log(`Channels: ${metadata.channels}`)
  console.log(`Color space: ${metadata.space}`)
  console.log(`Has alpha: ${metadata.hasAlpha}`)
  console.log(`File size: ${stats.size} bytes`)
}

main().catch(console.error)
