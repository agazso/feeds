declare module 'colcade' {
  interface ColcadeOptions {
    columns: string
    items: string
  }

  export default class Colcade {
    constructor(element: HTMLElement, options: ColcadeOptions)
    layout(): void
    destroy(): void
    append(items: HTMLElement | HTMLElement[]): void
    prepend(items: HTMLElement | HTMLElement[]): void
  }
}
