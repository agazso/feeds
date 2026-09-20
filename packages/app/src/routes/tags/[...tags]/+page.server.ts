import { parseTagsFromPath } from '$lib/tags'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ params }) => {
  const selectedTags = parseTagsFromPath(params.tags)
  return { selectedTags }
}
