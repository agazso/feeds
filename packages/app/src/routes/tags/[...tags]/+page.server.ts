import type { PageServerLoad } from './$types'
import { parseTagsFromPath } from '$lib/tags'

export const load: PageServerLoad = async ({ params }) => {
  const selectedTags = parseTagsFromPath(params.tags)
  return { selectedTags }
}
