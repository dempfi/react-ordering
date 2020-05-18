import { Context } from '../context'
import { SORTABLE_KEY } from '../constants'
import { setInlineStyles, setTranslate3d, setTransition } from '../utils'
import { number } from 'prop-types'

type State = { [SORTABLE_KEY]?: Sortable }

type SortableElement = HTMLElement & State

type SortableElementCandidate = HTMLElement & Partial<State>

export class Sortable {
  static of(el: HTMLElement) {
    if (this.isAttachedTo(el)) return el[SORTABLE_KEY]
  }

  static isAttachedTo(el: HTMLElement): el is SortableElement {
    return (el as SortableElementCandidate)[SORTABLE_KEY] !== undefined
  }

  private isAnimating = false

  private translate = { x: 0, y: 0 }

  private futurePosition?: { x: number; y: number }

  constructor(
    public element: SortableElementCandidate,
    public index: number,
    public disabled = false,
    public context?: Context
  ) {
    element[SORTABLE_KEY] = this
  }

  private get stablePosition() {
    const { x, y } = this.element.getBoundingClientRect()
    const translate = window.getComputedStyle(this.element, 'translateX')
    console.log(translate)
  }

  get position() {
    if (this.isAnimating) return this.futurePosition!
    const { x, y } = this.element.getBoundingClientRect()
    return { x, y }
  }

  includes(point: { x: number; y: number }, directions: { horizontal: boolean; vertical: boolean }) {
    if (this.isAnimating) return false
    const { left, right, top, bottom } = this.element.getBoundingClientRect()
    const horizontally = left < point.x && point.x < right
    const vertically = top < point.y && point.y < bottom

    if (directions.vertical && directions.horizontal) return horizontally && vertically
    else if (directions.vertical) return vertically
    else if (directions.horizontal) return horizontally
    return false
  }

  translateTo(translate: { x: number; y: number }) {
    // if (this.isAnimating) return
    console.log(this.stablePosition)
    // if (this.isAnimating) return
    if (this.translate.y === translate.y && this.translate.x === translate.x) return
    const { x, y } = this.position
    // this should use stable position
    // which is the position without any transforms applied
    // otherwise future position won't match the actual position
    this.futurePosition = { x: x + translate.x, y: y + translate.y }
    this.translate = translate

    setTranslate3d(this.element, this.translate)
    this.isAnimating = true
    setTransition(this.element, `transform 200ms cubic-bezier(0.2, 0, 0, 1)`)

    // setTimeout(() => { this.isAnimating = false }, 210)

    this.element.addEventListener('transitionend', event => {
      if (event.propertyName !== 'transform') return
      this.isAnimating = false
    })
  }

  hide() {
    setInlineStyles(this.element, { opacity: 0, visibility: 'hidden' })
  }

  show() {
    setInlineStyles(this.element, { opacity: '', visibility: '' })
  }
}
