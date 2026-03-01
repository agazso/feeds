import type { Author } from './models/author'
import type { Post } from './models/post'

export function mergeUpdatedPosts(updatedPosts: Post[], oldPosts: Post[]): Post[] {
  const uniqueAuthors = new Map<string, Author>()
  updatedPosts.forEach((post) => {
    if (post.author != null) {
      if (!uniqueAuthors.has(post.author.uri)) {
        uniqueAuthors.set(post.author.uri, post.author)
      }
    }
  })
  const notUpdatedPosts = oldPosts.filter(
    (post) => post.author != null && !uniqueAuthors.has(post.author.uri),
  )
  const allPosts = notUpdatedPosts.concat(updatedPosts)
  const sortedPosts = allPosts.sort((a, b) => b.createdAt - a.createdAt)
  const startId = Date.now()
  const posts = sortedPosts.map((post, index) => ({
    ...post,
    _id: post._id ? post._id : startId + index,
  }))
  return posts
}
