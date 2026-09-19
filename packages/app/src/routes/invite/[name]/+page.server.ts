import type { PageServerLoad } from './$types'
import { error } from '@sveltejs/kit'
import { keyForUser, requireRootScope } from '$lib/server/auth'
import { userExists } from '$lib/paths'
import { isValidUserName } from '$lib/user'

export const load: PageServerLoad = async ({ params, url, locals }) => {
  await requireRootScope(locals)

  const name = params.name.toLowerCase()
  if (!isValidUserName(name) || !(await userExists(name))) {
    error(404, 'No such user')
  }

  const key = await keyForUser(name)
  if (!key) {
    error(404, `@${name} has no key — it was not created by an invite`)
  }

  return {
    name,
    inviteUrl: `${url.origin}/@${name}/auth?key=${encodeURIComponent(key)}`,
  }
}
