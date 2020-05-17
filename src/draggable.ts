import { CSSProperties } from 'react'
import {
  NodeType,
  setTranslate3d,
  setTransitionDuration,
  clamp,
  setInlineStyles,
  setTransition,
  getElementMargin,
  getContainerGridGap
} from './utils'
import { Motion } from './backend'

type Options = {
  directions: { horizontal: boolean; vertical: boolean }
  position: { x: number; y: number }
  lockToContainer?: boolean
  motion: Motion
  container: HTMLElement
  scrollContainer: HTMLElement
  helperStyle?: CSSProperties
  helperClass?: string
}

export class Draggable {
  private static clone(element: HTMLElement) {
    const selector = 'input, textarea, select, canvas, [contenteditable]'
    const fields = element.querySelectorAll<HTMLInputElement>(selector)
    const clone = element.cloneNode(true) as HTMLElement
    const clonedFields = [...clone.querySelectorAll<HTMLInputElement>(selector)]

    clonedFields.forEach((field, i) => {
      if (field.type !== 'file') {
        field.value = fields[i].value
      }

      // Fixes an issue with original radio buttons losing their value once the
      // clone is inserted in the DOM, as radio button `name` attributes must be unique
      if (field.type === 'radio' && field.name) {
        field.name = `__sortableClone__${field.name}`
      }

      if (field.tagName === NodeType.Canvas && fields[i].width > 0 && fields[i].height > 0) {
        const destCtx = (field as any).getContext('2d')
        destCtx.drawImage(fields[i], 0, 0)
      }
    })

    return clone
  }

  width: number
  height: number
  margins: { x: any; y: number }
  translate!: { x: number; y: number }
  minTranslate: { x: number; y: number }
  maxTranslate: { x: number; y: number }

  /**
   * Get translation of element's center point
   */
  get center() {
    return {
      x: this.translate.x + this.width / 2,
      y: this.translate.y + this.height / 2
    }
  }

  readonly element: HTMLElement
  private dropAnimation = {
    duration: 250,
    easing: 'cubic-bezier(.2,1,.1,1)'
  }
  private directions: { horizontal: boolean; vertical: boolean }
  private initialPointerPositionOnElement: { x: number; y: number } = { x: 0, y: 0 }
  private motion: Motion
  private lockToContainer: boolean
  private container: HTMLElement

  constructor(element: HTMLElement, options: Options) {
    this.element = Draggable.clone(element)
    this.motion = options.motion
    this.container = options.container
    this.directions = options.directions
    this.initialPointerPositionOnElement = options.position
    this.lockToContainer = options.lockToContainer ?? false

    const margin = getElementMargin(element)
    const gridGap = getContainerGridGap(this.container)

    this.margins = {
      x: margin.left + margin.right + gridGap.x,
      y: Math.max(margin.top, margin.bottom, gridGap.y)
    }

    this.width = element.offsetWidth
    this.height = element.offsetHeight

    setInlineStyles(this.element, {
      boxSizing: 'border-box',
      height: `${this.height}px`,
      width: `${this.width}px`,
      left: '0px',
      pointerEvents: 'none',
      position: 'fixed',
      top: '0px'
    })

    const initialPosition = element.getBoundingClientRect()
    this.initialPointerPositionOnElement = {
      x: initialPosition.x - options.position.x,
      y: initialPosition.y - options.position.y
    }

    setTranslate3d(this.element, { x: initialPosition.x, y: initialPosition.y })

    if (this.motion === Motion.Snap) this.element.focus()

    const containerBounds = this.getElementContentBound(this.container)

    // Initialize with the scrollable container bounds for grid setup
    this.minTranslate = { x: containerBounds.left, y: containerBounds.top }
    this.maxTranslate = { x: containerBounds.right - this.width, y: containerBounds.bottom - this.height }

    if (this.directions.vertical && !this.directions.horizontal) {
      this.minTranslate.x = initialPosition.x
      this.maxTranslate.x = initialPosition.x
    } else if (this.directions.horizontal && !this.directions.vertical) {
      this.minTranslate.y = initialPosition.y
      this.maxTranslate.y = initialPosition.y
    }

    if (options.helperClass) {
      options.helperClass.split(' ').forEach(className => this.element.classList.add(className))
    }

    if (options.helperStyle) {
      setInlineStyles(this.element, options.helperStyle)
    }
  }

  attachTo(container: HTMLElement) {
    container.append(this.element)
  }

  detach() {
    this.element.parentElement?.removeChild(this.element)
  }

  move(position: { x: number; y: number }) {
    const translate = {
      x: position.x + this.initialPointerPositionOnElement.x,
      y: position.y + this.initialPointerPositionOnElement.y
    }

    if (this.lockToContainer) {
      translate.x = clamp(this.minTranslate.x, this.maxTranslate.x, translate.x)
      translate.y = clamp(this.minTranslate.y, this.maxTranslate.y, translate.y)
    }

    if (this.motion === Motion.Snap) setTransitionDuration(this.element, 250)

    this.translate = translate
    setTranslate3d(this.element, translate)
  }

  /**
   * Drop element at given element
   */
  drop(atElement: HTMLElement) {
    const { x, y } = atElement.getBoundingClientRect()

    setTranslate3d(this.element, { x, y })
    setTransition(this.element, `transform ${this.dropAnimation.duration}ms ${this.dropAnimation.easing}`)

    return new Promise(resolve => {
      this.element.addEventListener('transitionend', event => {
        // We only want to know when the transform transition ends, there
        // could be other animated properties, such as opacity
        if (event.propertyName !== 'transform') return
        resolve()
      })
    })
  }

  /**
   * Get element's position relative to viewport without padding and border
   * @param element html element
   */
  private getElementContentBound(element: HTMLElement) {
    const boundingBox = element.getBoundingClientRect()
    const styles = window.getComputedStyle(element)
    return {
      left: boundingBox.left + parseInt(styles.paddingLeft) + parseInt(styles.borderLeft),
      top: boundingBox.top + parseInt(styles.paddingTop) + parseInt(styles.borderTop),
      right: boundingBox.right - parseInt(styles.paddingRight) - parseInt(styles.borderRight),
      bottom: boundingBox.bottom - parseInt(styles.paddingBottom) - parseInt(styles.borderBottom)
    }
  }
}
