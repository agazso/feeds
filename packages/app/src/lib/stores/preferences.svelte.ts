import { browser } from '$app/environment'

export type Theme = 'light' | 'dark'
export type Layout = 'one-column' | 'three-column'

const THEME_COOKIE = 'feeds-theme'
const LAYOUT_COOKIE = 'feeds-layout'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 year

function setCookie(name: string, value: string) {
  if (browser) {
    document.cookie = `${name}=${value}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`
  }
}

function createPreferences() {
  let theme = $state<Theme>('dark')
  let layout = $state<Layout>('three-column')

  return {
    get theme() {
      return theme
    },
    get layout() {
      return layout
    },
    init(initialTheme: Theme, initialLayout: Layout) {
      theme = initialTheme
      layout = initialLayout
    },
    setTheme(newTheme: Theme) {
      theme = newTheme
      setCookie(THEME_COOKIE, newTheme)
      if (browser) {
        document.documentElement.dataset.theme = newTheme
      }
    },
    setLayout(newLayout: Layout) {
      layout = newLayout
      setCookie(LAYOUT_COOKIE, newLayout)
      if (browser) {
        document.documentElement.dataset.layout = newLayout
      }
    },
    toggleTheme() {
      this.setTheme(theme === 'dark' ? 'light' : 'dark')
    },
    toggleLayout() {
      this.setLayout(layout === 'three-column' ? 'one-column' : 'three-column')
    },
  }
}

export const preferences = createPreferences()
