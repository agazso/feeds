import type { PageServerLoad } from './$types'

export const load: PageServerLoad = ({ params }) => {
  // The rest parameter captures everything after /discover/
  // e.g., /discover/https://example.com → url = "https://example.com"
  const url = params.url || ''
  return { url }
}
