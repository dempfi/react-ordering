import React from 'react'
import { findDOMNode } from 'react-dom'

import { isSortableHandleElement } from '../use-handle'
import { Context } from '../context'

import {
  closest,
  omit,
  provideDisplayName,
  setTransition,
  setTransitionDuration,
  setTranslate3d,
  getScrollAdjustedBoundingClientRect,
  isScrollableElement,
  getTargetIndex
} from '../utils'

import { AutoScroller } from '../auto-scroller'
import { defaultProps, orderingProps } from './props'

import { WrappedComponent, Config, SortableContainerProps } from '../types'
import { Sortable } from '../sortable'
import { BackendDelegate, Backend, Motion, MouseBackend, TouchBackend, KeyboardBackend } from '../backend'
import { Draggable } from '../draggable'
import { CONTEXT_KEY } from '../constants'

type SortableContainerElement = HTMLElement & { [CONTEXT_KEY]: Context }

export default function sortableContainer<P>(
  WrappedComponent: WrappedComponent<P>,
  config: Config = { withRef: false }
) {
  return class WithSortableContainer extends React.Component<SortableContainerProps> implements BackendDelegate {
    manager = new Context()
    container!: SortableContainerElement
    scrollContainer!: HTMLElement
    autoScroller!: AutoScroller
    _awaitingUpdateBeforeSortStart?: boolean
    state: { sorting: boolean; sortingIndex?: number } = { sorting: false }
    initialScroll?: { left: number; top: number }
    newIndex?: number
    index?: number
    active?: Sortable
    prevIndex?: number
    backends: Backend[] = []
    draggable!: Draggable
    currentMotion?: Motion

    static displayName = provideDisplayName('sortableList', WrappedComponent)
    static defaultProps = defaultProps
    private lastPosition = { x: Infinity, y: Infinity }

    get directions() {
      if (!this.props.axis) return { horizontal: false, vertical: true }
      return {
        horizontal: this.props.axis.indexOf('x') >= 0,
        vertical: this.props.axis.indexOf('y') >= 0
      }
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
        this.snap(this.index! - this.newIndex!)
        this.drop()
      }
      this.manager.active = undefined
    }

    async lift(element: HTMLElement, position: { x: number; y: number }, backend: Backend) {
      const node = closest(element, Sortable.isAttachedTo)!
      backend.lifted(node)

      const sortable = Sortable.of(node)!
      const index = sortable.index
      this.manager.active = { index, currentIndex: index }
      this.currentMotion = backend.motion

      const { hideSortableGhost, updateBeforeSortStart } = this.props

      if (typeof updateBeforeSortStart === 'function') {
        this._awaitingUpdateBeforeSortStart = true

        try {
          await updateBeforeSortStart({
            from: index,
            to: index,
            motion: this.currentMotion!,
            // FIXME, there's no helper yer
            helper: this.draggable?.element
          })
        } finally {
          this._awaitingUpdateBeforeSortStart = false
        }
      }

      this.draggable = new Draggable(node, {
        directions: this.directions,
        position,
        lockToContainer: this.props.lockToContainerEdges,
        motion: this.currentMotion,
        container: this.container,
        scrollContainer: this.scrollContainer,
        helperClass: this.props.helperClass,
        helperStyle: this.props.helperStyle
      })

      this.draggable.attachTo(this.helperContainer)

      this.index = index
      this.newIndex = index

      this.initialScroll = {
        left: this.scrollContainer.scrollLeft,
        top: this.scrollContainer.scrollTop
      }

      this.active = sortable
      this.active.hide()

      this.setState({
        sorting: true,
        sortingIndex: index
      })

      this.props.onSortStart?.({
        from: this.index!,
        to: this.newIndex ?? this.index!,
        motion: this.currentMotion!,
        helper: this.draggable.element
      })
    }

    move(position: { x: number; y: number }) {
      if (this.directions.horizontal && this.directions.vertical) {
        if (this.lastPosition.x === position.x && this.lastPosition.y === position.y) return
      } else if (this.directions.vertical) {
        if (this.lastPosition.y === position.y) return
      } else if (this.directions.horizontal) {
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
      const newIndex = this.newIndex! + shift
      const prevIndex = this.newIndex!

      if (newIndex < 0 || newIndex > lastIndex) {
        return
      }

      this.prevIndex = prevIndex
      this.newIndex = newIndex

      const targetIndex = getTargetIndex(this.newIndex, this.prevIndex, this.index)
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
        x: shouldAdjustForSize && this.directions.horizontal ? targetNode.offsetWidth - this.draggable.width : 0,
        y: shouldAdjustForSize && this.directions.vertical ? targetNode.offsetHeight - this.draggable.height : 0
      }

      this.move({ x: targetPosition.left + sizeAdjustment.x, y: targetPosition.top + sizeAdjustment.y })
    }

    async drop() {
      const { hideSortableGhost, dropAnimationDuration } = this.props

      if (dropAnimationDuration && this.currentMotion !== Motion.Snap) {
        await this.draggable.drop(this.active!.position)
      }

      // Remove the helper from the DOM
      this.draggable.detach()
      this.active?.show()

      this.manager.sortables.forEach(sortable => {
        setTranslate3d(sortable.element, null)
        setTransitionDuration(sortable.element, null)
        // sortable.translate = undefined
      })

      // Stop auto scroll
      this.autoScroller.clear()

      // Update manager state
      this.manager.active = undefined

      this.setState({
        sorting: false,
        sortingIndex: null
      })

      this.props.onSortEnd({
        from: this.index!,
        to: this.newIndex! > this.index! ? this.newIndex! : this.newIndex! + 1,
        motion: this.currentMotion!,
        helper: this.draggable.element
      })
    }

    animateNodes = () => {
      const { outOfTheWayAnimationDuration, outOfTheWayAnimationEasing } = this.props
      const prevIndex = this.newIndex!
      // this.newIndex = undefined

      const collidedNode = this.manager.sortables.find(sortable => {
        if (this.active === sortable) return false
        return sortable.includes(this.draggable.center, this.directions)
      })

      if (!collidedNode) return
      const diff = collidedNode?.index > (this.newIndex ?? this.index!) ? 0 : -1

      this.newIndex = collidedNode?.index + diff
      this.manager.moveTo(collidedNode?.index)
      if (prevIndex === this.newIndex) return

      this.manager.sortables.forEach((sortable, index) => {
        const height = this.draggable.height + this.draggable.margins.y
        const width = this.draggable.width + this.draggable.margins.x
        const translateY = this.directions.vertical ? height * -(sortable.index - index) : 0
        const translateX = this.directions.horizontal ? width * -(sortable.index - index) : 0

        const translate = {
          x: translateX,
          y: translateY
        }

        sortable.translateTo(translate)
      })

      if (this.isSnapMotion) {
        // If keyboard sorting, we want the user input to dictate index, not location of the helper
        this.newIndex = prevIndex
      }

      const oldIndex = this.isSnapMotion ? this.prevIndex : prevIndex

      if (this.newIndex === oldIndex) return
      this.props.onSortOver?.({
        from: this.index!,
        to: oldIndex!,
        motion: this.currentMotion!,
        helper: this.draggable.element
      })
    }

    autoScroll = () => {
      const { disableAutoScroll } = this.props

      if (disableAutoScroll) {
        this.autoScroller.clear()
        return
      }

      if (this.isSnapMotion) {
        const translate = { ...this.draggable.translate }
        let scrollX = 0
        let scrollY = 0

        if (this.directions.horizontal) {
          translate.x = Math.min(
            this.draggable.maxTranslate.x,
            Math.max(this.draggable.minTranslate.x, this.draggable.translate.x)
          )
          scrollX = this.draggable.translate.x - translate.x
        }

        if (this.directions.vertical) {
          translate.y = Math.min(
            this.draggable.maxTranslate.y,
            Math.max(this.draggable.minTranslate.y, this.draggable.translate.y)
          )
          scrollY = this.draggable.translate.y - translate.y
        }

        this.draggable.translate = translate
        setTranslate3d(this.draggable.element, this.draggable.translate)
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

      return <WrappedComponent ref={ref} {...omit(this.props, orderingProps)} />
    }

    get helperContainer() {
      const { helperContainer } = this.props

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
      return {
        time: this.props.pressDelay!,
        distanceThreshold: this.props.pressThreshold!
      }
    }

    get moveDelay() {
      return this.props.distance
    }

    canLift(element: HTMLElement) {
      if (this.props.shouldCancelStart!(element)) return false
      if (this.state.sorting) return false

      const sortableElement = closest(element, Sortable.isAttachedTo)
      if (!sortableElement) return false

      const sortable = Sortable.of(sortableElement)!
      if (!this.nodeIsChild(sortable) || sortable.disabled) return false

      if (this.props.useDragHandle && !closest(element, isSortableHandleElement)) return false
      return true
    }
  }
}

export const isSortableContainerElement = (el: any): el is SortableContainerElement => !!el[CONTEXT_KEY]
