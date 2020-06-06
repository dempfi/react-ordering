import React from 'react'
import { findDOMNode } from 'react-dom'

import { isSortableHandleElement } from '../use-handle'
import { Context } from '../context'

import {
  closest,
  omit,
  provideDisplayName,
  setTransition,
  setTranslate,
  getScrollAdjustedBoundingClientRect,
  isScrollableElement,
  getTargetIndex
} from '../utils'

import { AutoScroller } from '../auto-scroller'

import { WrappedComponent, Config } from '../types'
import { Sortable } from '../sortable'
import { BackendDelegate, Backend, Motion, MouseBackend, TouchBackend, KeyboardBackend } from '../backend'
import { Draggable } from '../draggable'
import { CONTEXT_KEY } from '../constants'
import { Options, Settings } from '../settings'

type SortableContainerElement = HTMLElement & { [CONTEXT_KEY]: Context }

export default function sortableContainer<P>(
  WrappedComponent: WrappedComponent<P>,
  config: Config = { withRef: false }
) {
  return class WithSortableContainer extends React.Component<Options> implements BackendDelegate {
    manager = new Context()
    container!: SortableContainerElement
    scrollContainer!: HTMLElement
    autoScroller!: AutoScroller
    awaitingUpdateBeforeStart?: boolean
    state: { sorting: boolean; sortingIndex?: number } = { sorting: false }
    initialScroll?: { left: number; top: number }
    prevIndex?: number
    backends: Backend[] = []
    draggable!: Draggable
    currentMotion?: Motion

    static displayName = provideDisplayName('sortableList', WrappedComponent)

    private lastPosition = { x: Infinity, y: Infinity }

    settings: Settings

    constructor(props: Options) {
      super(props)
      this.settings = new Settings(props)
    }

    get isSnapMotion() {
      return this.currentMotion === Motion.Snap
    }

    componentDidMount() {
      this.container = this.getContainer()
      this.scrollContainer = closest(this.container, isScrollableElement) || this.container
      this.autoScroller = new AutoScroller(this.scrollContainer, this.animateNodes)
      this.container[CONTEXT_KEY] = this.manager

      this.backends = [
        new MouseBackend(this, this.container),
        new TouchBackend(this, this.container),
        new KeyboardBackend(this, this.container)
      ]
      this.backends.forEach(b => b.attach())
    }

    componentWillUnmount() {
      this.draggable?.detach()
      this.backends.forEach(b => b.detach())
      this.backends = []
    }

    nodeIsChild = (node: Sortable) => {
      return node.context === this.manager
    }

    cancel = () => {
      // If we
      if (this.isSnapMotion) {
        this.snap(this.manager.active!.index - this.manager.active!.newIndex)
        this.drop()
      }
      this.manager.deactivate()
    }

    async lift(element: HTMLElement, position: { x: number; y: number }, backend: Backend) {
      this.currentMotion = backend.motion

      const sortableElement = closest(element, Sortable.isAttachedTo)!
      backend.lifted(sortableElement)

      const sortable = Sortable.of(sortableElement)!
      const index = sortable.index

      try {
        this.awaitingUpdateBeforeStart = true
        await this.settings.updateBeforeStart({
          from: index,
          to: index,
          motion: this.currentMotion!
        })
      } finally {
        this.awaitingUpdateBeforeStart = false
      }

      this.draggable = new Draggable(sortableElement, {
        position,
        settings: this.settings,
        motion: this.currentMotion,
        container: this.container,
        scrollContainer: this.scrollContainer
      })

      this.draggable.attachTo(this.helperContainer)
      this.manager.activate(sortable)

      this.initialScroll = {
        left: this.scrollContainer.scrollLeft,
        top: this.scrollContainer.scrollTop
      }

      this.setState({
        sorting: true,
        sortingIndex: index
      })

      this.settings.onStart?.({
        from: this.manager.active!.index,
        to: this.manager.active!.newIndex ?? this.manager.active!.index,
        motion: this.currentMotion!
      })
    }

    move(position: { x: number; y: number }) {
      if (this.settings.directions.horizontal && this.settings.directions.vertical) {
        if (this.lastPosition.x === position.x && this.lastPosition.y === position.y) return
      } else if (this.settings.directions.vertical) {
        if (this.lastPosition.y === position.y) return
      } else if (this.settings.directions.horizontal) {
        if (this.lastPosition.x === position.x) return
      }

      this.lastPosition = position

      this.draggable.move(position)
      this.animateNodes()
      this.autoScroll()
    }

    snap(shift: number) {
      const nodes = this.manager.sortables
      const { index: lastIndex } = nodes[nodes.length - 1]
      const newIndex = this.manager.active!.newIndex + shift
      const prevIndex = this.manager.active!.newIndex

      if (newIndex < 0 || newIndex > lastIndex) {
        return
      }

      this.prevIndex = prevIndex
      this.manager.active!.newIndex = newIndex

      const targetIndex = getTargetIndex(this.manager.active!.newIndex, this.prevIndex, this.manager.active!.index)
      const target = nodes.find(({ index }) => index === targetIndex)!
      const { element: targetNode } = target

      const scrollDelta = this.containerScrollDelta
      const targetBoundingClientRect = getScrollAdjustedBoundingClientRect(targetNode, scrollDelta)
      const targetTranslate = target.translate || { x: 0, y: 0 }

      const targetPosition = {
        top: targetBoundingClientRect.top + targetTranslate.y - scrollDelta.top,
        left: targetBoundingClientRect.left + targetTranslate.x - scrollDelta.left
      }

      const shouldAdjustForSize = prevIndex < newIndex
      const sizeAdjustment = {
        x:
          shouldAdjustForSize && this.settings.directions.horizontal
            ? targetNode.offsetWidth - this.draggable.width
            : 0,
        y:
          shouldAdjustForSize && this.settings.directions.vertical ? targetNode.offsetHeight - this.draggable.height : 0
      }

      this.move({ x: targetPosition.left + sizeAdjustment.x, y: targetPosition.top + sizeAdjustment.y })
    }

    async drop() {
      if (this.currentMotion !== Motion.Snap) {
        await this.draggable.drop(this.manager.active!.position)
      }

      // Remove the helper from the DOM
      const { index, newIndex } = this.manager.active!
      this.draggable.detach()
      this.manager.deactivate()

      this.manager.sortables.forEach(sortable => {
        setTranslate(sortable.element)
        setTransition(sortable.element)
      })

      // Stop auto scroll
      this.autoScroller.clear()

      this.setState({
        sorting: false,
        sortingIndex: null
      })

      this.settings.onEnd({
        from: index,
        to: newIndex > index ? newIndex : newIndex + 1,
        motion: this.currentMotion!
      })
    }

    animateNodes = () => {
      const prevIndex = this.manager.active!.newIndex

      const collidedNode = this.manager.sortables.find(sortable =>
        sortable.includes(this.draggable.center, this.settings.directions)
      )

      if (!collidedNode) return
      this.manager.moveActiveTo(collidedNode?.index)
      if (prevIndex === this.manager.active!.newIndex) return

      this.manager.sortables.forEach((sortable, index) => {
        const height = this.draggable.height + this.draggable.margins.y
        const width = this.draggable.width + this.draggable.margins.x
        const translateY = this.settings.directions.vertical ? height * -(sortable.index - index) : 0
        const translateX = this.settings.directions.horizontal ? width * -(sortable.index - index) : 0

        sortable.translateTo({ x: translateX, y: translateY })
      })

      if (this.isSnapMotion) {
        // If keyboard sorting, we want the user input to dictate index, not location of the helper
        this.manager.active!.newIndex = prevIndex
      }

      const oldIndex = this.isSnapMotion ? this.prevIndex : prevIndex

      if (this.manager.active!.newIndex === oldIndex) return
      this.settings.onOver?.({
        from: this.manager.active!.index!,
        to: oldIndex!,
        motion: this.currentMotion!
      })
    }

    autoScroll = () => {
      if (this.settings.withoutAutoscroll) {
        this.autoScroller.clear()
        return
      }

      if (this.isSnapMotion) {
        const translate = { ...this.draggable.translate }
        let scrollX = 0
        let scrollY = 0

        if (this.settings.directions.horizontal) {
          translate.x = Math.min(
            this.draggable.maxTranslate.x,
            Math.max(this.draggable.minTranslate.x, this.draggable.translate.x)
          )
          scrollX = this.draggable.translate.x - translate.x
        }

        if (this.settings.directions.vertical) {
          translate.y = Math.min(
            this.draggable.maxTranslate.y,
            Math.max(this.draggable.minTranslate.y, this.draggable.translate.y)
          )
          scrollY = this.draggable.translate.y - translate.y
        }

        this.draggable.translate = translate
        setTranslate(this.draggable.element, this.draggable.translate)
        this.scrollContainer.scrollLeft += scrollX
        this.scrollContainer.scrollTop += scrollY

        return
      }

      this.autoScroller.update({
        height: this.draggable.height,
        maxTranslate: this.draggable.maxTranslate,
        minTranslate: this.draggable.minTranslate,
        translate: this.draggable.translate,
        width: this.draggable.width
      })
    }

    getContainer() {
      return findDOMNode(this) as SortableContainerElement
    }

    render() {
      const ref = config.withRef ? 'wrappedInstance' : null

      return <WrappedComponent ref={ref} {...this.props} />
    }

    get helperContainer() {
      const { helperContainer } = this.settings

      if (typeof helperContainer === 'function') {
        return helperContainer()
      }

      return helperContainer || document.body
    }

    get containerScrollDelta() {
      return {
        left: this.scrollContainer.scrollLeft - this.initialScroll!.left,
        top: this.scrollContainer.scrollTop - this.initialScroll!.top
      }
    }

    get isSorting() {
      return this.state.sorting
    }

    get pressDelay() {
      return this.settings.pressDelay
    }

    get moveDelay() {
      return this.settings.moveDelay
    }

    canLift(element: HTMLElement) {
      if (!this.settings.canSort(element)) return false
      if (this.state.sorting) return false

      const sortableElement = closest(element, Sortable.isAttachedTo)
      if (!sortableElement) return false

      const sortable = Sortable.of(sortableElement)!
      if (!this.nodeIsChild(sortable) || sortable.disabled) return false

      if (this.settings.withHandle && !closest(element, isSortableHandleElement)) return false
      return true
    }
  }
}

export const isSortableContainerElement = (el: any): el is SortableContainerElement => !!el[CONTEXT_KEY]
