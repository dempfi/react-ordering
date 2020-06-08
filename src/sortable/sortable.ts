import { Context } from '../context'
import { SORTABLE_KEY } from '../constants'
import { setInlineStyles, setTranslate, setTransition, getTranslate } from '../utils'

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

  public isActive = false

  public newIndex = this.index

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

  get position() {
    if (this.isAnimating) return this.futurePosition!
    const { x, y } = this.element.getBoundingClientRect()
    return { x, y }
  }

  private get stablePosition() {
    const { x, y } = this.element.getBoundingClientRect()
    const translate = getTranslate(this.element)
    if (!translate) return { x, y }
    return { x: x - translate.x, y: y - translate.y }
  }

  includes(point: { x: number; y: number }, axis: { x: boolean; y: boolean }) {
    if (this.isActive) return false
    if (this.isAnimating) return false
    const { left, right, top, bottom } = this.element.getBoundingClientRect()
    const horizontally = left < point.x && point.x < right
    const vertically = top < point.y && point.y < bottom

    if (axis.y && axis.x) return horizontally && vertically
    else if (axis.y) return vertically
    else if (axis.x) return horizontally
    return false
  }

  translateTo(translate: { x: number; y: number }) {
    if (this.translate.y === translate.y && this.translate.x === translate.x) return
    const { x, y } = this.stablePosition
    this.futurePosition = { x: x + translate.x, y: y + translate.y }
    this.translate = translate

    this.isAnimating = true
    setTranslate(this.element, this.translate)
    setTransition(this.element, 200, 'cubic-bezier(0.2, 0, 0, 1)')

    this.element.addEventListener('transitionend', event => {
      if (event.propertyName !== 'transform') return
      this.isAnimating = false
    })
  }

  activate() {
    this.isActive = true
    this.newIndex = this.index
    setInlineStyles(this.element, { opacity: 0.5, visibility: 'visible', zIndex: 7, backgroundColor: 'red' })
  }

  deactivate() {
    this.isActive = false
    setInlineStyles(this.element, { opacity: '', visibility: 'visible', backgroundColor: 'white' })
  }
}
