import { CSSProperties } from 'react'
import {
  NodeType,
  setTranslate3d,
  setTransitionDuration,
  clamp,
  setInlineStyles,
  getElementMargin,
  getEdgeOffset,
  setTransition
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

export class Helper {
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
  translate!: { x: number; y: number }
  minTranslate: { x: number; y: number }
  maxTranslate: { x: number; y: number }
  readonly element: HTMLElement
  private dropAnimation = {
    duration: 250,
    easing: 'cubic-bezier(.2,1,.1,1)'
  }
  private directions: { horizontal: boolean; vertical: boolean }
  private initialPosition: { x: number; y: number }
  private initialWindowScroll: { left: number; top: number }
  private motion: Motion
  private lockToContainer: boolean
  private container: HTMLElement
  private scrollContainer: HTMLElement

  private get containerScrollDelta() {
    return {
      left: this.scrollContainer.scrollLeft - this.initialScroll!.left,
      top: this.scrollContainer.scrollTop - this.initialScroll!.top
    }
  }

  private get windowScrollDelta() {
    return {
      left: window.pageXOffset - this.initialWindowScroll!.left,
      top: window.pageYOffset - this.initialWindowScroll!.top
    }
  }

  initialScroll: { left: number; top: number }
  offsetEdge: { left: number; top: number }

  constructor(element: HTMLElement, options: Options) {
    this.element = Helper.clone(element)
    this.initialPosition = options.position
    this.motion = options.motion
    this.lockToContainer = options.lockToContainer ?? false
    this.container = options.container
    this.scrollContainer = options.scrollContainer
    this.directions = options.directions

    this.initialWindowScroll = {
      left: window.pageXOffset,
      top: window.pageYOffset
    }

    // Need to get the latest value for `index` in case it changes during `updateBeforeSortStart`
    const margin = getElementMargin(element)

    this.width = element.offsetWidth
    this.height = element.offsetHeight

    const boundingClientRect = element.getBoundingClientRect()

    this.offsetEdge = getEdgeOffset(element, this.container)

    this.initialScroll = {
      left: this.scrollContainer.scrollLeft,
      top: this.scrollContainer.scrollTop
    }

    setInlineStyles(this.element, {
      boxSizing: 'border-box',
      height: `${this.height}px`,
      left: `${boundingClientRect.left - margin.left}px`,
      pointerEvents: 'none',
      position: 'fixed',
      top: `${boundingClientRect.top - margin.top}px`,
      width: `${this.width}px`
    })

    if (this.motion === Motion.Snap) {
      this.element.focus()
    }

    this.minTranslate = { x: 0, y: 0 }
    this.maxTranslate = { x: 0, y: 0 }

    const containerBoundingRect = this.scrollContainer.getBoundingClientRect()

    if (this.directions.horizontal) {
      this.minTranslate.x = containerBoundingRect.left - boundingClientRect.left
      this.maxTranslate.x = containerBoundingRect.right - (boundingClientRect.left + this.width)
    }

    if (this.directions.vertical) {
      this.minTranslate.y = containerBoundingRect.top - boundingClientRect.top
      this.maxTranslate.y = containerBoundingRect.bottom - (boundingClientRect.top + this.height)
    }

    if (options.helperClass) {
      options.helperClass.split(' ').forEach(className => this.element.classList.add(className))
    }

    if (options.helperStyle) {
      setInlineStyles(this.element, options.helperStyle)
    }
  }

  attach(container: HTMLElement) {
    container.append(this.element)
  }

  detach() {
    this.element.parentElement?.removeChild(this.element)
  }

  move(offset: { x: number; y: number }) {
    const translate = {
      x: offset.x - this.initialPosition.x,
      y: offset.y - this.initialPosition.y
    }

    if (this.lockToContainer) {
      translate.x = clamp(this.minTranslate.x, this.maxTranslate.x, translate.x)
      translate.y = clamp(this.minTranslate.y, this.maxTranslate.y, translate.y)
    }

    if (this.motion === Motion.Snap) setTransitionDuration(this.element, 250)

    this.translate = translate
    setTranslate3d(this.element, translate)
  }

  drop(
    newOffset: { left: number; top: number },
    offsetWidth: number,
    offsetHeight: number,
    direction: 'forward' | 'backward'
  ) {
    const oldOffset = this.offsetEdge

    const deltaX =
      direction === 'forward'
        ? newOffset.left - this.width + offsetWidth - oldOffset.left
        : newOffset.left - oldOffset.left
    const deltaY =
      direction === 'forward'
        ? newOffset.top - this.height + offsetHeight - oldOffset.top
        : newOffset.top - oldOffset.top

    setTranslate3d(this.element, {
      x: deltaX - this.containerScrollDelta.left - this.windowScrollDelta.left,
      y: deltaY - this.containerScrollDelta.top - this.windowScrollDelta.top
    })
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
}
