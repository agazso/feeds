/**
 * Calculate cosine similarity between two vectors
 * Both vectors should already be normalized (as returned by embed())
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have same length')
  }

  // For normalized vectors, cosine similarity = dot product
  let dot = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
  }

  return dot
}

export interface ScoredItem<T> {
  item: T
  score: number
}

/**
 * Rank candidates by similarity to a query vector
 */
export function rankBySimilarity<T>(
  queryVector: number[],
  candidates: Array<{ item: T; vector: number[] }>,
  topK = 5,
  minScore = 0.15,
): ScoredItem<T>[] {
  const scored = candidates.map(({ item, vector }) => ({
    item,
    score: cosineSimilarity(queryVector, vector),
  }))

  return scored
    .filter((s) => s.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
}
