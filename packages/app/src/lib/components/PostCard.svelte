<script lang="ts">
import type { Post } from '@feeds/core'
import { getHumanHostname } from '@feeds/core'
import { postTitle, postText, commentLink, formatTimestamp, thumbnailSrc, resolvedImageSrc } from '$lib/text'
import PostCardMenu, { type MenuItem } from './PostCardMenu.svelte'
import BlurhashImage from './BlurhashImage.svelte'
import { preloadOnScroll } from '$lib/actions/preloadOnScroll'
import { auth } from '$lib/stores/auth.svelte'

interface Props {
  post: Post
  onfilter?: (term: string) => void
  onremove?: (postId: string) => void
  feedUrlToPageUrl?: Record<string, string>
}

let { post, onfilter, onremove, feedUrlToPageUrl }: Props = $props()

const title = $derived(postTitle(post))
const text = $derived(postText(post))
const comment = $derived(commentLink(post))
const timestamp = $derived(post.updatedAt || post.createdAt)
const printableTime = $derived(timestamp ? formatTimestamp(timestamp) : '')
const hostname = $derived(post.link ? getHumanHostname(post.link) : '')
const thumbnail = $derived(thumbnailSrc(post))
const cachedThumbnail = $derived(post.images?.[0] ? resolvedImageSrc(post.images[0]) : undefined)
const thumbnailBlurhash = $derived(post.images?.[0]?.blurhash)
const thumbnailAspectRatio = $derived(post.images?.[0]?.aspectRatio)
const postLink = $derived(post.link || '')
const authorImage = $derived(post.author?.image ? resolvedImageSrc(post.author.image) : undefined)
let avatarError = $state(false)

async function removeFromMyFeed() {
  const postId = post._id
  if (!postId) return

  try {
    const response = await fetch('/api/myfeed', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: postId }),
    })
    if (response.ok) {
      onremove?.(String(postId))
    } else {
      console.error('Failed to remove from my feed')
    }
  } catch (e) {
    console.error('Failed to remove from my feed:', e)
  }
}

const menuItems = $derived.by(() => {
  const items: MenuItem[] = []

  // Share button (when Web Share API is available)
  if (typeof navigator !== 'undefined' && navigator.share && post.link) {
    items.push({
      label: 'Share',
      onclick: async () => {
        try {
          await navigator.share({
            title: postTitle(post),
            url: post.link!,
          })
        } catch (e) {
          // User cancelled or share failed - ignore
        }
      },
    })
  }

  // Copy Link (serves as fallback when Share unavailable)
  items.push({
    label: 'Copy Link',
    onclick: () => {
      if (post.link) {
        navigator.clipboard.writeText(post.link)
      }
    },
  })

  // Edit Tags (only when in "my feed" context)
  if (auth.canWrite && onremove && post._id) {
    items.push({
      label: 'Edit Tags',
      href: `/edit-tags/${encodeURIComponent(post._id)}`,
    })
  }

  // Add to my feed (when not in "my feed" context)
  if (auth.canWrite && !onremove && post.link) {
    const shareUrl = post.feedUrl
      ? `/share/${encodeURIComponent(post.link)}?feedUrl=${encodeURIComponent(post.feedUrl)}`
      : `/share/${encodeURIComponent(post.link)}`
    items.push({
      label: 'Add to my feed',
      href: shareUrl,
    })
  }

  // Feed-related items
  if (post.feedUrl) {
    const isFollowed = !!feedUrlToPageUrl && post.feedUrl in feedUrlToPageUrl
    if (isFollowed) {
      // Feed is already followed - show "View feed" only.
      // Route by feedUrl (unique) — url collides across YouTube channels.
      items.push({
        label: 'View feed',
        href: `/feeds/${encodeURIComponent(post.feedUrl)}`,
      })
    } else if (auth.canWrite) {
      // Feed is not followed - show "Discover Feed" only (entry to the add-feed flow)
      items.push({
        label: 'Discover Feed',
        href: `/discover/${encodeURIComponent(post.feedUrl)}`,
      })
    }
  }

  // Remove (always last, only in "my feed" context)
  if (auth.canWrite && onremove) {
    items.push({
      label: 'Remove',
      onclick: removeFromMyFeed,
    })
  }

  return items
})

function handleCardClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  // Don't trigger if clicking on interactive elements
  if (target.closest('a, button, .tag, .avatar, .menu-container')) {
    return
  }
  // Don't trigger if text is selected
  if (window.getSelection()?.toString()) {
    return
  }
  if (postLink) {
    window.open(postLink, '_blank', 'noopener,noreferrer')
  }
}

function handleFilterClick(e: MouseEvent, term: string) {
  e.stopPropagation()
  onfilter?.(term)
}

function handleImageLoad(e: Event) {
  const img = e.target as HTMLImageElement
  // Fix YouTube thumbnail fallback - YouTube returns a 120x90 placeholder for missing thumbnails
  if (img.src.includes('ytimg.com') && img.naturalWidth === 120 && img.naturalHeight === 90) {
    img.src = img.src.replace(/\/\w+.jpg$/, '/mqdefault.jpg')
  }
}
</script>

<div class="card-parent" onclick={handleCardClick} onkeydown={(e) => e.key === 'Enter' && handleCardClick(e as unknown as MouseEvent)} role="button" tabindex="0">
  <div class="card-header">
    <button
      class="avatar"
      onclick={(e) => handleFilterClick(e, post.author?.name || '')}
      aria-label="Filter by author"
    >
      {#if authorImage && !avatarError}
        <img src={authorImage} alt="" loading="lazy" onerror={() => avatarError = true} />
      {:else}
        <div class="avatar-placeholder"></div>
      {/if}
    </button>
    <div class="header-text">
      <div class="author-name">
        {post.author?.name || ''}
        {#if post.feedUrl}
          <svg class="rss-icon" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-label="Feed available">
            <circle cx="6.18" cy="17.82" r="2.18"/>
            <path d="M4 4.44v2.83c7.03 0 12.73 5.7 12.73 12.73h2.83c0-8.59-6.97-15.56-15.56-15.56zm0 5.66v2.83c3.9 0 7.07 3.17 7.07 7.07h2.83c0-5.47-4.43-9.9-9.9-9.9z"/>
          </svg>
        {/if}
      </div>
      <div class="hostname">
        <span class="tooltip" title={printableTime}>{hostname}</span>
      </div>
    </div>
    <PostCardMenu items={menuItems} />
  </div>

  {#if thumbnail}
    <a
      href={postLink}
      target="_blank"
      rel="noopener noreferrer"
      class="thumbnail-link"
      use:preloadOnScroll={cachedThumbnail?.startsWith('/cache/') ? cachedThumbnail : thumbnail}
    >
      <BlurhashImage
        src={cachedThumbnail?.startsWith('/cache/') ? cachedThumbnail : thumbnail}
        fallbackSrc={cachedThumbnail?.startsWith('/cache/') ? thumbnail : undefined}
        blurhash={thumbnailBlurhash}
        aspectRatio={thumbnailAspectRatio}
        class="thumbnail"
        onload={handleImageLoad}
      />
    </a>
  {/if}

  {#if title}
    <div class="text title-text">
      <a href={postLink} target="_blank" rel="noopener noreferrer">{title}</a>
    </div>
  {/if}

  {#if text}
    <div class="text body-text">
      <a href={postLink} target="_blank" rel="noopener noreferrer">{text}</a>
    </div>
  {/if}

  {#if comment}
    <div class="text">
      <a class="comment-link" href={comment} target="_blank" rel="noopener noreferrer">Comments</a>
    </div>
  {/if}

  {#if post.tags && post.tags.length > 0}
    <div class="tags">
      {#each post.tags as tag}
        <a href="/tags/{tag}" class="tag" onclick={(e) => e.stopPropagation()}>#{tag}</a>
      {/each}
    </div>
  {/if}
</div>

<style>
  .card-parent {
    display: flex;
    flex-direction: column;
    background-color: #88888822;
    padding-bottom: var(--half-padding);
    cursor: pointer;
    break-inside: avoid;
    margin-bottom: var(--padding);
  }

  .card-parent:hover {
    background-color: #88888844;
  }

  .card-parent:active {
    background-color: #88888822;
  }

  .card-header {
    display: flex;
    flex-direction: row;
    padding: var(--padding);
    align-items: center;
  }

  .avatar {
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    box-shadow: none;
    padding: 0;
    margin: 0;
    min-width: unset;
    cursor: pointer;
  }

  .avatar img {
    width: 30px;
    height: 30px;
  }

  .avatar-placeholder {
    width: 30px;
    height: 30px;
    background-color: var(--color-step-30);
  }

  .avatar:hover {
    opacity: 0.8;
  }

  .header-text {
    padding-left: var(--padding);
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex-grow: 1;
  }

  .author-name {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-weight: 700;
    font-size: 14px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .hostname {
    font-size: 12px;
    color: gray;
  }

  .thumbnail-link {
    display: block;
  }

  .thumbnail-link :global(.thumbnail) {
    width: 100%;
  }

  .text {
    margin: var(--padding);
    overflow: hidden;
  }

  .text a {
    display: block;
  }

  .title-text {
    font-weight: bold;
  }

  .title-text a {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .rss-icon {
    flex-shrink: 0;
    /* color: #888; */
  }

  .body-text a {
    display: -webkit-box;
    -webkit-line-clamp: 6;
    line-clamp: 6;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .comment-link {
    text-decoration: underline;
    display: inline !important;
  }

  .comment-link:hover {
    background-color: #88888866;
  }

  .tags {
    display: flex;
    flex-wrap: wrap;
    padding: 0 var(--half-padding);
  }

  .tag {
    margin: var(--half-padding);
    padding: var(--half-padding);
    font-size: 14px;
    background: transparent;
    color: var(--color);
    cursor: pointer;
    text-decoration: none;
  }

  .tag:hover {
    background-color: #88888866;
  }
</style>
