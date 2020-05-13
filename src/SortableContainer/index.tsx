import React from 'react'
import { findDOMNode } from 'react-dom'

import { isSortableHandleElement } from '../use-handle'
import { Context } from '../context'

import {
  closest,
  getContainerGridGap,
  getElementMargin,
  omit,
  provideDisplayName,
  setInlineStyles,
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
import { isSortableElement, SortableElement } from '../use-element'
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
    marginOffset?: { x: number; y: number }
    index?: number
    sortableGhost?: SortableElement
    prevIndex?: number
    backends: Backend[] = []
    helper!: Draggable
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
      this.helper?.detach()
      this.backends.forEach(b => b.detach())
      this.backends = []
    }

    nodeIsChild = (node: SortableElement) => {
      return node.sortableInfo.manager === this.manager
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
      const node = closest(element, isSortableElement)!
      backend.lifted(node)

      const { index } = node.sortableInfo
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
            helper: this.helper?.element
          })
        } finally {
          this._awaitingUpdateBeforeSortStart = false
        }
      }

      this.helper = new Draggable(node, {
        directions: this.directions,
        position,
        lockToContainer: this.props.lockToContainerEdges,
        motion: this.currentMotion,
        container: this.container,
        scrollContainer: this.scrollContainer,
        helperClass: this.props.helperClass,
        helperStyle: this.props.helperStyle
      })
      this.helper.attach(this.helperContainer)

      // Need to get the latest value for `index` in case it changes during `updateBeforeSortStart`
      const margin = getElementMargin(node)
      const gridGap = getContainerGridGap(this.container)

      this.marginOffset = {
        x: margin.left + margin.right + gridGap.x,
        y: Math.max(margin.top, margin.bottom, gridGap.y)
      }

      this.index = index
      this.newIndex = index

      this.initialScroll = {
        left: this.scrollContainer.scrollLeft,
        top: this.scrollContainer.scrollTop
      }
      if (hideSortableGhost) {
        this.sortableGhost = node

        setInlineStyles(node, {
          opacity: 0.5
          // visibility: 'hidden'
        })
      }

      this.setState({
        sorting: true,
        sortingIndex: index
      })

      this.props.onSortStart?.({
        from: this.index!,
        to: this.newIndex ?? this.index!,
        motion: this.currentMotion!,
        helper: this.helper.element
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

      this.helper.move(position)
      this.animateNodes()
      this.autoscroll()
    }

    snap(shift: number) {
      const nodes = this.manager.items
      const { index: lastIndex } = nodes[nodes.length - 1].element.sortableInfo
      const newIndex = this.newIndex! + shift
      const prevIndex = this.newIndex!

      if (newIndex < 0 || newIndex > lastIndex) {
        return
      }

      this.prevIndex = prevIndex
      this.newIndex = newIndex

      const targetIndex = getTargetIndex(this.newIndex, this.prevIndex, this.index)
      const target = nodes.find(({ element: node }) => node.sortableInfo.index === targetIndex)!
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
        x: shouldAdjustForSize && this.directions.horizontal ? targetNode.offsetWidth - this.helper.width : 0,
        y: shouldAdjustForSize && this.directions.vertical ? targetNode.offsetHeight - this.helper.height : 0
      }

      this.move({ x: targetPosition.left + sizeAdjustment.x, y: targetPosition.top + sizeAdjustment.y })
    }

    async drop() {
      const { hideSortableGhost, dropAnimationDuration } = this.props
      const nodes = this.manager.items

      if (dropAnimationDuration && this.currentMotion !== Motion.Snap) {
        const dropAfterIndex = this.newIndex! > this.index! ? this.newIndex! : this.newIndex!
        await this.helper.drop(this.manager.nodeAtIndex(dropAfterIndex)?.element!)
      }

      // Remove the helper from the DOM
      this.helper.detach()

      if (hideSortableGhost && this.sortableGhost) {
        setInlineStyles(this.sortableGhost, {
          opacity: '',
          visibility: ''
        })
      }

      for (let i = 0, len = nodes.length; i < len; i++) {
        const node = nodes[i]
        const el = node.element

        // Remove the transforms / transitions
        setTranslate3d(el, null)
        setTransitionDuration(el, null)
        node.translate = undefined
      }

      // Stop autoscroll
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
        helper: this.helper.element
      })
    }

    animateNodes = () => {
      const { outOfTheWayAnimationDuration, outOfTheWayAnimationEasing } = this.props
      const nodes = this.manager.items

      const prevIndex = this.newIndex!
      // this.newIndex = undefined

      const collidedNode = nodes.find(({ element, position }) => {
        if (this.sortableGhost === element) return false

        const { height, y } = element.getBoundingClientRect()

        const top = y
        const bottom = top + height

        if (this.directions.vertical) {
          if (top < this.helper.center.y && this.helper.center.y < bottom) {
            return true
          }
        }
        return false
      })

      if (!collidedNode) return
      const diff = collidedNode?.element.sortableInfo.index > (this.newIndex ?? this.index!) ? 0 : -1

      this.newIndex = collidedNode?.element.sortableInfo.index + diff
      this.manager.moveTo(collidedNode?.element.sortableInfo.index)
      if (prevIndex === this.newIndex) return

      this.manager.items.forEach((item, index) => {
        const height = this.helper.height + this.marginOffset!.y

        const translate = {
          x: 0,
          y: height * -(item.element.sortableInfo.index - index)
        }

        if (item.translate?.y === translate.y) return

        const { x, y } = item.element.getBoundingClientRect()
        item.position = { x, y: y + translate.y }
        item.translate = translate

        setTranslate3d(item.element, translate)
        // setTransition(item.element, `transform ${outOfTheWayAnimationDuration}ms ${outOfTheWayAnimationEasing}`)
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
        helper: this.helper.element
      })
    }

    autoscroll = () => {
      const { disableAutoscroll } = this.props

      if (disableAutoscroll) {
        this.autoScroller.clear()
        return
      }

      if (this.isSnapMotion) {
        const translate = { ...this.helper.translate }
        let scrollX = 0
        let scrollY = 0

        if (this.directions.horizontal) {
          translate.x = Math.min(
            this.helper.maxTranslate.x,
            Math.max(this.helper.minTranslate.x, this.helper.translate.x)
          )
          scrollX = this.helper.translate.x - translate.x
        }

        if (this.directions.vertical) {
          translate.y = Math.min(
            this.helper.maxTranslate.y,
            Math.max(this.helper.minTranslate.y, this.helper.translate.y)
          )
          scrollY = this.helper.translate.y - translate.y
        }

        this.helper.translate = translate
        setTranslate3d(this.helper.element, this.helper.translate)
        this.scrollContainer.scrollLeft += scrollX
        this.scrollContainer.scrollTop += scrollY

        return
      }

      this.autoScroller.update({
        height: this.helper.height,
        maxTranslate: this.helper.maxTranslate,
        minTranslate: this.helper.minTranslate,
        translate: this.helper.translate,
        width: this.helper.width
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

      const sortableElement = closest(element, isSortableElement)
      if (!sortableElement || !this.nodeIsChild(sortableElement)) return false
      if (sortableElement.sortableInfo.disabled) return false

      if (this.props.useDragHandle && !closest(element, isSortableHandleElement)) return false
      return true
    }
  }
}

export const isSortableContainerElement = (el: any): el is SortableContainerElement => !!el[CONTEXT_KEY]
