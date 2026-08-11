import { join } from 'node:path'

// Runtime dirs are env-driven so the container can point them at a data volume.
// Defaults preserve dev/local behavior (static/ + cache/ next to the app).
export const DATA_DIR = process.env.FEEDS_DATA_DIR ?? join(process.cwd(), 'static')
export const CACHE_DIR = process.env.FEEDS_CACHE_DIR ?? join(process.cwd(), 'cache')
export const MODELS_DIR = process.env.FEEDS_MODELS_DIR ?? join(process.cwd(), 'models')
