import React from 'react'
import { findDOMNode } from 'react-dom'

import { isSortableHandle } from '../handle'
import { Manager, ManagerContext } from '../manager'

import {
  closest,
  getContainerGridGap,
  getEdgeOffset,
  getElementMargin,
  omit,
  provideDisplayName,
  setInlineStyles,
  setTransition,
  setTransitionDuration,
  setTranslate3d,
  getScrollAdjustedBoundingClientRect,
  isScrollable,
  getTargetIndex
} from '../utils'

import { AutoScroller } from '../auto-scroller'
import { defaultProps, orderingProps } from './props'

import { WrappedComponent, Config, SortableContainerProps, SortableNode } from '../types'
import { isSortableNode } from '../element'
import { BackendDelegate } from '../backend/backend-delegate'
import { Motion, Backend } from '../backend/backend'
import { MouseBackend } from '../backend/mouse-backend'
import { Helper } from '../helper'
import { TouchBackend } from '../backend/touch-backend'
import { KeyboardBackend } from '../backend/keyboard-backend'

export default function sortableContainer<P>(
  WrappedComponent: WrappedComponent<P>,
  config: Config = { withRef: false }
) {
  return class WithSortableContainer extends React.Component<SortableContainerProps> implements BackendDelegate {
    manager = new Manager()
    container!: HTMLElement
    scrollContainer!: HTMLElement
    autoScroller!: AutoScroller
    _awaitingUpdateBeforeSortStart?: boolean
    state: { sorting: boolean; sortingIndex?: number } = { sorting: false }
    initialScroll?: { left: number; top: number }
    initialWindowScroll?: { left: number; top: number }
    newIndex?: number
    marginOffset?: { x: number; y: number }
    containerBoundingRect?: DOMRect
    index?: number
    offsetEdge?: { left: number; top: number }
    sortableGhost?: SortableNode
    prevIndex?: number
    backends: Backend[] = []
    helper!: Helper
    currentMotion?: Motion

    static displayName = provideDisplayName('sortableList', WrappedComponent)
    static defaultProps = defaultProps

    get axis() {
      if (!this.props.axis) return { x: false, y: true }
      return {
        x: this.props.axis.indexOf('x') >= 0,
        y: this.props.axis.indexOf('y') >= 0
      }
    }

    get isSnapMotion() {
      return this.currentMotion === Motion.Snap
    }

    componentDidMount() {
      this.container = this.getContainer()
      this.scrollContainer = closest(this.container, isScrollable) || this.container
      this.autoScroller = new AutoScroller(this.scrollContainer, this.animateNodes)

      this.backends = [
        new MouseBackend(this, this.container),
        new TouchBackend(this, this.container),
        new KeyboardBackend(this, this.container)
      ]
      this.backends.forEach(b => b.attach())
    }

    componentWillUnmount() {
      this.helper?.detach()
      if (!this.container) return
      this.backends.forEach(b => b.detach())
      this.backends = []
    }

    nodeIsChild = (node: SortableNode) => {
      return node.sortableInfo.manager === this.manager
    }

    cancel = () => {
      if (this.isSnapMotion) {
        this.snap(this.index! - this.newIndex!)
        this.drop()
      }
      this.manager.active = undefined
    }

    async lift(element: HTMLElement, position: { x: number; y: number }, motion: Motion) {
      const node = closest(element, isSortableNode)!
      this.backends.forEach(b => b.lifted(node))

      const { index, collection } = node.sortableInfo
      this.manager.active = { collection, index }
      this.currentMotion = motion

      const { hideSortableGhost, updateBeforeSortStart, onSortStart } = this.props

      if (typeof updateBeforeSortStart === 'function') {
        this._awaitingUpdateBeforeSortStart = true

        try {
          await updateBeforeSortStart({ collection, index, node }, event)
        } finally {
          this._awaitingUpdateBeforeSortStart = false
        }
      }

      this.helper = new Helper(node, {
        lockAxis: this.props.lockAxis,
        axis: this.props.axis,
        position,
        lockToContainer: this.props.lockToContainerEdges,
        motion,
        container: this.container,
        scrollContainer: this.scrollContainer,
        lockOffset: this.props.lockOffset,
        helperClass: this.props.helperClass,
        helperStyle: this.props.helperStyle
      })
      this.helper.attach(this.helperContainer)

      // Need to get the latest value for `index` in case it changes during `updateBeforeSortStart`
      const margin = getElementMargin(node)
      const gridGap = getContainerGridGap(this.container)
      const containerBoundingRect = this.scrollContainer.getBoundingClientRect()

      this.marginOffset = {
        x: margin.left + margin.right + gridGap.x,
        y: Math.max(margin.top, margin.bottom, gridGap.y)
      }
      this.containerBoundingRect = containerBoundingRect
      this.index = index
      this.newIndex = index

      this.offsetEdge = getEdgeOffset(node, this.container)

      this.initialScroll = {
        left: this.scrollContainer.scrollLeft,
        top: this.scrollContainer.scrollTop
      }
      this.initialWindowScroll = {
        left: window.pageXOffset,
        top: window.pageYOffset
      }
      if (hideSortableGhost) {
        this.sortableGhost = node

        setInlineStyles(node, {
          opacity: 0,
          visibility: 'hidden'
        })
      }

      this.setState({
        sorting: true,
        sortingIndex: index
      })

      if (onSortStart) {
        onSortStart(
          {
            node,
            index,
            collection,
            nodes: this.manager.getOrderedRefs().map(r => r.node)
          },
          event
        )
      }
    }

    move(position: { x: number; y: number }) {
      this.helper.move(position)
      this.animateNodes()
      this.autoscroll()
    }

    snap(shift: number) {
      const nodes = this.manager.getOrderedRefs()
      const { index: lastIndex } = nodes[nodes.length - 1].node.sortableInfo
      const newIndex = this.newIndex! + shift
      const prevIndex = this.newIndex!

      if (newIndex < 0 || newIndex > lastIndex) {
        return
      }

      this.prevIndex = prevIndex
      this.newIndex = newIndex

      const targetIndex = getTargetIndex(this.newIndex, this.prevIndex, this.index)
      const target = nodes.find(({ node }) => node.sortableInfo.index === targetIndex)!
      const { node: targetNode } = target

      const scrollDelta = this.containerScrollDelta
      const targetBoundingClientRect =
        target.boundingClientRect || getScrollAdjustedBoundingClientRect(targetNode, scrollDelta)
      const targetTranslate = target.translate || { x: 0, y: 0 }

      const targetPosition = {
        top: targetBoundingClientRect.top + targetTranslate.y - scrollDelta.top,
        left: targetBoundingClientRect.left + targetTranslate.x - scrollDelta.left
      }

      const shouldAdjustForSize = prevIndex < newIndex
      const sizeAdjustment = {
        x: shouldAdjustForSize && this.axis.x ? targetNode.offsetWidth - this.helper.width : 0,
        y: shouldAdjustForSize && this.axis.y ? targetNode.offsetHeight - this.helper.height : 0
      }

      this.move({ x: targetPosition.left + sizeAdjustment.x, y: targetPosition.top + sizeAdjustment.y })
    }

    async drop() {
      const { hideSortableGhost, onSortEnd, dropAnimationDuration } = this.props
      const {
        active: { collection }
      } = this.manager
      const nodes = this.manager.getOrderedRefs()

      if (dropAnimationDuration && this.currentMotion !== Motion.Snap) {
        const { edgeOffset, node: newNode } = this.manager.nodeAtIndex(this.newIndex)!
        const newOffset = edgeOffset || getEdgeOffset(newNode, this.container)
        await this.helper.drop(
          newOffset,
          newNode.offsetWidth,
          newNode.offsetHeight,
          this.newIndex! > this.index! ? 'forward' : 'backward'
        )
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
        const el = node.node

        // Clear the cached offset/boundingClientRect
        node.edgeOffset = undefined
        node.boundingClientRect = undefined

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

      if (typeof onSortEnd === 'function') {
        onSortEnd({
          collection,
          newIndex: this.newIndex!,
          oldIndex: this.index!,
          nodes: nodes.map(r => r.node)
        })
      }
    }

    animateNodes() {
      const { outOfTheWayAnimationDuration, outOfTheWayAnimationEasing, hideSortableGhost, onSortOver } = this.props
      const { containerScrollDelta, windowScrollDelta } = this
      const nodes = this.manager.getOrderedRefs()
      const sortingOffset = {
        left: this.offsetEdge!.left + this.helper.translate.x + containerScrollDelta.left,
        top: this.offsetEdge!.top + this.helper.translate.y + containerScrollDelta.top
      }

      const prevIndex = this.newIndex!
      this.newIndex = undefined

      for (let i = 0, len = nodes.length; i < len; i++) {
        const { node } = nodes[i]
        const { index } = node.sortableInfo
        const width = node.offsetWidth
        const height = node.offsetHeight
        const offset = {
          height: this.helper.height > height ? height / 2 : this.helper.height / 2,
          width: this.helper.width > width ? width / 2 : this.helper.width / 2
        }

        // For keyboard sorting, we want user input to dictate the position of the nodes
        const mustShiftBackward = this.isSnapMotion && index > this.index! && index <= prevIndex
        const mustShiftForward = this.isSnapMotion && index < this.index! && index >= prevIndex

        const translate = { x: 0, y: 0 }
        let { edgeOffset } = nodes[i]

        // If we haven't cached the node's offsetTop / offsetLeft value
        if (!edgeOffset) {
          edgeOffset = getEdgeOffset(node, this.container)
          nodes[i].edgeOffset = edgeOffset
          // While we're at it, cache the boundingClientRect, used during keyboard sorting
          if (this.isSnapMotion) {
            nodes[i].boundingClientRect = getScrollAdjustedBoundingClientRect(node, containerScrollDelta)
          }
        }

        // Get a reference to the next and previous node
        const nextNode = i < nodes.length - 1 && nodes[i + 1]
        const prevNode = i > 0 && nodes[i - 1]

        // Also cache the next node's edge offset if needed.
        // We need this for calculating the animation in a grid setup
        if (nextNode && !nextNode.edgeOffset) {
          nextNode.edgeOffset = getEdgeOffset(nextNode.node, this.container)
          if (this.isSnapMotion) {
            nextNode.boundingClientRect = getScrollAdjustedBoundingClientRect(nextNode.node, containerScrollDelta)
          }
        }

        // If the node is the one we're currently animating, skip it
        if (index === this.index) {
          if (hideSortableGhost) {
            /*
             * With windowing libraries such as `react-virtualized`, the sortableGhost
             * node may change while scrolling down and then back up (or vice-versa),
             * so we need to update the reference to the new node just to be safe.
             */
            this.sortableGhost = node
            setInlineStyles(node, { opacity: 0, visibility: 'hidden' })
          }
          continue
        }

        if (outOfTheWayAnimationDuration) {
          setTransition(node, `transform ${outOfTheWayAnimationDuration}ms ${outOfTheWayAnimationEasing}`)
        }

        if (this.axis.x) {
          if (this.axis.y) {
            // Calculations for a grid setup
            if (
              mustShiftForward ||
              (index < this.index! &&
                ((sortingOffset.left + windowScrollDelta.left - offset.width <= edgeOffset.left &&
                  sortingOffset.top + windowScrollDelta.top <= edgeOffset.top + offset.height) ||
                  sortingOffset.top + windowScrollDelta.top + offset.height <= edgeOffset.top))
            ) {
              // If the current node is to the left on the same row, or above the node that's being dragged
              // then move it to the right
              translate.x = this.helper.width + this.marginOffset!.x
              if (edgeOffset.left + translate.x > this.containerBoundingRect!.width - offset.width) {
                // If it moves passed the right bounds, then animate it to the first position of the next row.
                // We just use the offset of the next node to calculate where to move, because that node's original position
                // is exactly where we want to go
                if (nextNode) {
                  translate.x = nextNode.edgeOffset!.left - edgeOffset.left
                  translate.y = nextNode.edgeOffset!.top - edgeOffset.top
                }
              }
              if (this.newIndex === undefined) {
                this.newIndex = index
              }
            } else if (
              mustShiftBackward ||
              (index > this.index! &&
                ((sortingOffset.left + windowScrollDelta.left + offset.width >= edgeOffset.left &&
                  sortingOffset.top + windowScrollDelta.top + offset.height >= edgeOffset.top) ||
                  sortingOffset.top + windowScrollDelta.top + offset.height >= edgeOffset.top + height))
            ) {
              // If the current node is to the right on the same row, or below the node that's being dragged
              // then move it to the left
              translate.x = -(this.helper.width + this.marginOffset!.x)
              if (edgeOffset.left + translate.x < this.containerBoundingRect!.left + offset.width) {
                // If it moves passed the left bounds, then animate it to the last position of the previous row.
                // We just use the offset of the previous node to calculate where to move, because that node's original position
                // is exactly where we want to go
                if (prevNode) {
                  translate.x = prevNode.edgeOffset!.left - edgeOffset.left
                  translate.y = prevNode.edgeOffset!.top - edgeOffset.top
                }
              }
              this.newIndex = index
            }
          } else {
            if (
              mustShiftBackward ||
              (index > this.index! && sortingOffset.left + windowScrollDelta.left + offset.width >= edgeOffset.left)
            ) {
              translate.x = -(this.helper.width + this.marginOffset!.x)
              this.newIndex = index
            } else if (
              mustShiftForward ||
              (index < this.index! && sortingOffset.left + windowScrollDelta.left <= edgeOffset.left + offset.width)
            ) {
              translate.x = this.helper.width + this.marginOffset!.x

              if (this.newIndex == undefined) {
                this.newIndex = index
              }
            }
          }
        } else if (this.axis.y) {
          if (
            mustShiftBackward ||
            (index > this.index! && sortingOffset.top + windowScrollDelta.top + offset.height >= edgeOffset.top)
          ) {
            translate.y = -(this.helper.height + this.marginOffset!.y)
            this.newIndex = index
          } else if (
            mustShiftForward ||
            (index < this.index! && sortingOffset.top + windowScrollDelta.top <= edgeOffset.top + offset.height)
          ) {
            translate.y = this.helper.height + this.marginOffset!.y
            if (this.newIndex == undefined) {
              this.newIndex = index
            }
          }
        }

        setTranslate3d(node, translate)
        nodes[i].translate = translate
      }

      if (this.newIndex == undefined) {
        this.newIndex = this.index
      }

      if (this.isSnapMotion) {
        // If keyboard sorting, we want the user input to dictate index, not location of the helper
        this.newIndex = prevIndex
      }

      const oldIndex = this.isSnapMotion ? this.prevIndex : prevIndex
      if (onSortOver && this.newIndex !== oldIndex) {
        onSortOver({
          collection: this.manager.active!.collection,
          index: this.index!,
          newIndex: this.newIndex!,
          oldIndex: oldIndex!,
          nodes: nodes.map(r => r.node)
        })
      }
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

        if (this.axis.x) {
          translate.x = Math.min(
            this.helper.maxTranslate.x,
            Math.max(this.helper.minTranslate.x, this.helper.translate.x)
          )
          scrollX = this.helper.translate.x - translate.x
        }

        if (this.axis.y) {
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
      return findDOMNode(this) as HTMLElement
    }

    render() {
      const ref = config.withRef ? 'wrappedInstance' : null

      return (
        <ManagerContext.Provider value={{ manager: this.manager }}>
          <WrappedComponent ref={ref} {...omit(this.props, orderingProps)} />
        </ManagerContext.Provider>
      )
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

    get windowScrollDelta() {
      return {
        left: window.pageXOffset - this.initialWindowScroll!.left,
        top: window.pageYOffset - this.initialWindowScroll!.top
      }
    }

    //  ===========
    // NEW PUBLIC API
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

      const sortableElement = closest(element, isSortableNode)
      if (!sortableElement || !this.nodeIsChild(sortableElement)) return false
      if (sortableElement.sortableInfo.disabled) return false

      if (this.props.useDragHandle && !closest(element, isSortableHandle)) return false
      return true
    }
  }
}
