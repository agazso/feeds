import type { PageServerLoad } from './$types'
import { listUsers } from '$lib/paths'

export const load: PageServerLoad = async () => {
  return { users: await listUsers() }
}
