import { pipeline, type FeatureExtractionPipeline, type PipelineType } from '@huggingface/transformers'

const MODEL_NAME = 'Xenova/all-MiniLM-L6-v2'

let embedderInstance: FeatureExtractionPipeline | null = null
let initPromise: Promise<FeatureExtractionPipeline> | null = null

/**
 * Get or initialize the embedding pipeline (singleton)
 */
async function getEmbedder(): Promise<FeatureExtractionPipeline> {
  if (embedderInstance) {
    return embedderInstance
  }

  if (initPromise) {
    return initPromise
  }

  const task: PipelineType = 'feature-extraction'
  // @ts-expect-error - pipeline types are overly complex, runtime works correctly
  initPromise = pipeline(task, MODEL_NAME, { dtype: 'fp32' })

  embedderInstance = await initPromise
  return embedderInstance
}

/**
 * Generate embedding for a single text string
 * Returns a 384-dimensional vector
 */
export async function embed(text: string): Promise<number[]> {
  const embedder = await getEmbedder()

  // Truncate text to avoid token limit issues (model handles 256 tokens max)
  const truncated = text.slice(0, 1000)

  const output = await embedder(truncated, {
    pooling: 'mean',
    normalize: true
  })

  // Convert to plain array
  return Array.from(output.data as Float32Array)
}

/**
 * Generate embeddings for multiple texts in batch
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []

  const embedder = await getEmbedder()

  // Truncate all texts
  const truncated = texts.map((t) => t.slice(0, 1000))

  const output = await embedder(truncated, {
    pooling: 'mean',
    normalize: true
  })

  // Convert batched output to array of vectors
  const data = output.data as Float32Array
  const vectorSize = 384
  const result: number[][] = []

  for (let i = 0; i < texts.length; i++) {
    const start = i * vectorSize
    result.push(Array.from(data.slice(start, start + vectorSize)))
  }

  return result
}
