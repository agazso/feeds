import { error } from '@sveltejs/kit'
import { userExists } from '$lib/paths'
import { createKey, keyForUser, requireRootScope } from '$lib/server/auth'
import { isValidUserName } from '$lib/user'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ params, url, locals }) => {
  await requireRootScope(locals)

  const name = params.name.toLowerCase()
  if (!isValidUserName(name) || !(await userExists(name))) {
    error(404, 'No such user')
  }

  // A directory made by hand has no key yet — mint one on first view so it can be
  // shared. Existing keys are shown as-is, never replaced.
  // ponytail: two overlapping loads could each mint; the second read sees the first's
  // key in practice. Move to a POST action if that ever actually bites.
  const key = (await keyForUser(name)) ?? (await createKey(name))

  return {
    name,
    inviteUrl: `${url.origin}/@${name}/auth?key=${encodeURIComponent(key)}`,
  }
}
