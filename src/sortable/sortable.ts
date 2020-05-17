import { Context } from '../context'
import { SORTABLE_KEY } from '../constants'
import { setInlineStyles } from '../utils'

type SortableHTMLElement = HTMLElement & {
  [SORTABLE_KEY]: Sortable
}

export class Sortable {
  static of(el: HTMLElement) {
    if (this.isAttachedTo(el)) return el[SORTABLE_KEY]
  }

  static isAttachedTo(el: HTMLElement): el is SortableHTMLElement {
    return (el as SortableHTMLElement)[SORTABLE_KEY] !== undefined
  }

  get boundingRect() {
    return this.element.getBoundingClientRect()
  }

  constructor(public element: HTMLElement, public index: number, public disabled = false, public context?: Context) {
    ;(element as SortableHTMLElement)[SORTABLE_KEY] = this
  }

  includes(point: { x: number; y: number }, directions: { horizontal: boolean; vertical: boolean }) {
    const { left, right, top, bottom } = this.boundingRect
    const horizontally = left < point.x && point.x < right
    const vertically = top < point.y && point.y < bottom

    if (directions.vertical && directions.horizontal) return horizontally && vertically
    else if (directions.vertical) return vertically
    else if (directions.horizontal) return horizontally
    return false
  }

  hide() {
    setInlineStyles(this.element, { opacity: 0, visibility: 'hidden' })
  }

  show() {
    setInlineStyles(this.element, { opacity: '', visibility: '' })
  }
}
