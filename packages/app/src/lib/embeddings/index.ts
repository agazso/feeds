export { embed, embedBatch } from './embedder'
export { cosineSimilarity, rankBySimilarity, type ScoredItem } from './similarity'
export {
  getEmbeddingBasedTags,
  getTagEmbeddings,
  buildTagContext,
  loadTagEmbeddings,
  saveTagEmbeddings,
  type TagEmbedding,
  type TagEmbeddingCache,
} from './tag-embeddings'
