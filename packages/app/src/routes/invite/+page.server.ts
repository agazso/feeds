import { mkdir } from 'node:fs/promises'
import { dataDir, userExists } from '$lib/paths'
import { createKey, requireRootScope } from '$lib/server/auth'
import { isValidUserName } from '$lib/user'
import { fail, redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals }) => {
  await requireRootScope(locals)
  return {}
}

export const actions: Actions = {
  default: async ({ request, locals }) => {
    await requireRootScope(locals)

    // The url may capitalize a user; the name on disk never does.
    const name = String((await request.formData()).get('name') ?? '')
      .trim()
      .toLowerCase()

    if (!isValidUserName(name)) {
      return fail(400, {
        message: 'Use lowercase letters, digits and underscore only.',
        existing: '',
      })
    }
    if (await userExists(name)) {
      return fail(409, { message: `@${name} already exists.`, existing: name })
    }

    // This is the one place the app creates a user. Its data files are written
    // lazily on first save — the directory is what makes /@name resolve.
    await mkdir(dataDir(name), { recursive: true })
    await createKey(name)

    redirect(303, `/invite/${name}`)
  },
}
