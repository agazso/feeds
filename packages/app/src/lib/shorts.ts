import type { Post } from '@feeds/core'

export const SHORT_TAG = 'short'

/** YouTube channel Atom feeds emit Shorts as /shorts/<id> links (regular videos are /watch?v=). */
export function isShortLink(link?: string): boolean {
  return !!link && link.includes('/shorts/')
}

/** Tag YouTube Shorts among `posts` with the 'short' tag. Mutates and returns `posts`. */
export function tagShorts(posts: Post[]): Post[] {
  for (const post of posts) {
    if (isShortLink(post.link) && !post.tags?.includes(SHORT_TAG)) {
      post.tags = [...(post.tags ?? []), SHORT_TAG]
    }
  }
  return posts
}
