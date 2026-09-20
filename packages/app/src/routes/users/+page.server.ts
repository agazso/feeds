import { listUsers } from '$lib/paths'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async () => {
  return { users: await listUsers() }
}
