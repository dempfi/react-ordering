import React from 'react'
import { findDOMNode } from 'react-dom'

import { isSortableHandle } from '../handle'
import { Manager, ManagerContext } from '../manager'

import {
  cloneNode,
  closest,
  getScrollingParent,
  getContainerGridGap,
  getEdgeOffset,
  getElementMargin,
  getLockPixelOffsets,
  limit,
  omit,
  provideDisplayName,
  setInlineStyles,
  setTransition,
  setTransitionDuration,
  setTranslate3d,
  getScrollAdjustedBoundingClientRect
} from '../utils'

import { AutoScroller } from '../auto-scroller'
import { defaultProps, orderingProps } from './props'

import { WrappedComponent, Config, SortableContainerProps, SortableNode } from '../types'
import { isSortableNode } from '../element'
import { BackendDelegate } from '../backend/backend-delegate'
import { Motion, Backend } from '../backend/backend'
import { MouseBackend } from '../backend/mouse-backend'

export default function sortableContainer<P>(
  WrappedComponent: WrappedComponent<P>,
  config: Config = { withRef: false }
) {
  return class WithSortableContainer extends React.Component<SortableContainerProps> implements BackendDelegate {
    manager = new Manager()
    container!: HTMLElement
    contentWindow!: Window
    scrollContainer!: HTMLElement
    autoScroller!: AutoScroller
    helper!: HTMLElement
    _awaitingUpdateBeforeSortStart?: boolean
    state: { sorting: boolean; sortingIndex?: number } = { sorting: false }
    translate?: { x: number; y: number }
    initialOffset?: { x: number; y: number }
    initialScroll?: { left: number; top: number }
    initialWindowScroll?: { left: number; top: number }
    newIndex?: number
    helperWidth?: number
    helperHeight?: number
    marginOffset?: { x: number; y: number }
    containerBoundingRect?: DOMRect
    index?: number
    offsetEdge?: { left: number; top: number }
    sortableGhost?: SortableNode
    prevIndex?: number
    minTranslate = { x: 0, y: 0 }
    maxTranslate = { x: 0, y: 0 }

    backend!: Backend

    static displayName = provideDisplayName('sortableList', WrappedComponent)
    static defaultProps = defaultProps

    get axis() {
      if (!this.props.axis) return { x: false, y: true }
      return {
        x: this.props.axis.indexOf('x') >= 0,
        y: this.props.axis.indexOf('y') >= 0
      }
    }

    componentDidMount() {
      const { useWindowAsScrollContainer } = this.props
      this.container = this.getContainer()

      this.scrollContainer = useWindowAsScrollContainer
        ? document.scrollingElement || document.documentElement
        : getScrollingParent(this.container) || this.container

      this.autoScroller = new AutoScroller(this.scrollContainer, this.onAutoScroll)

      this.backend = new MouseBackend(this, this.container)
      this.backend.attach()
    }

    componentWillUnmount() {
      this.helper?.parentNode?.removeChild(this.helper)
      if (!this.container) return
      this.backend.detach()
    }

    nodeIsChild = (node: SortableNode) => {
      return node.sortableInfo.manager === this.manager
    }

    cancel = () => {
      this.manager.active = undefined
    }

    async lift(position: { x: number; y: number }, element: HTMLElement) {
      const node = closest(element, isSortableNode)!
      this.backend.lifted(node)

      const { index, collection } = node.sortableInfo
      this.manager.active = { collection, index }

      const {
        getHelperDimensions,
        helperClass,
        helperStyle,
        hideSortableGhost,
        updateBeforeSortStart,
        onSortStart,
        useWindowAsScrollContainer
      } = this.props
      const { isKeySorting } = this.manager

      if (typeof updateBeforeSortStart === 'function') {
        this._awaitingUpdateBeforeSortStart = true

        try {
          await updateBeforeSortStart({ collection, index, node, isKeySorting }, event)
        } finally {
          this._awaitingUpdateBeforeSortStart = false
        }
      }

      // Need to get the latest value for `index` in case it changes during `updateBeforeSortStart`
      const margin = getElementMargin(node)
      const gridGap = getContainerGridGap(this.container)
      const containerBoundingRect = this.scrollContainer.getBoundingClientRect()
      const dimensions = getHelperDimensions!({ index, node, collection })

      this.helperWidth = dimensions.width
      this.helperHeight = dimensions.height
      this.marginOffset = {
        x: margin.left + margin.right + gridGap.x,
        y: Math.max(margin.top, margin.bottom, gridGap.y)
      }
      const boundingClientRect = node.getBoundingClientRect()
      this.containerBoundingRect = containerBoundingRect
      this.index = index
      this.newIndex = index

      this.offsetEdge = getEdgeOffset(node, this.container)
      this.initialOffset = position

      this.initialScroll = {
        left: this.scrollContainer.scrollLeft,
        top: this.scrollContainer.scrollTop
      }
      this.initialWindowScroll = {
        left: window.pageXOffset,
        top: window.pageYOffset
      }

      this.helper = this.helperContainer.appendChild(cloneNode(node))

      setInlineStyles(this.helper, {
        boxSizing: 'border-box',
        height: `${this.helperHeight}px`,
        left: `${boundingClientRect.left - margin.left}px`,
        pointerEvents: 'none',
        position: 'fixed',
        top: `${boundingClientRect.top - margin.top}px`,
        width: `${this.helperWidth}px`
      })

      if (isKeySorting) {
        this.helper.focus()
      }

      if (hideSortableGhost) {
        this.sortableGhost = node

        setInlineStyles(node, {
          opacity: 0,
          visibility: 'hidden'
        })
      }

      this.minTranslate = { x: 0, y: 0 }
      this.maxTranslate = { x: 0, y: 0 }

      if (isKeySorting) {
        const {
          top: containerTop,
          left: containerLeft,
          width: containerWidth,
          height: containerHeight
        } = useWindowAsScrollContainer
          ? {
              top: 0,
              left: 0,
              width: window.innerWidth,
              height: window.innerHeight
            }
          : this.containerBoundingRect
        const containerBottom = containerTop + containerHeight
        const containerRight = containerLeft + containerWidth

        if (this.axis.x) {
          this.minTranslate.x = containerLeft - boundingClientRect.left
          this.maxTranslate.x = containerRight - (boundingClientRect.left + this.helperWidth)
        }

        if (this.axis.y) {
          this.minTranslate.y = containerTop - boundingClientRect.top
          this.maxTranslate.y = containerBottom - (boundingClientRect.top + this.helperHeight)
        }
      } else {
        if (this.axis.x) {
          this.minTranslate.x =
            (useWindowAsScrollContainer ? 0 : containerBoundingRect.left) -
            boundingClientRect.left -
            this.helperWidth! / 2
          this.maxTranslate.x =
            (useWindowAsScrollContainer
              ? window.innerWidth
              : containerBoundingRect.left + containerBoundingRect.width) -
            boundingClientRect.left -
            this.helperWidth! / 2
        }

        if (this.axis.y) {
          this.minTranslate.y =
            (useWindowAsScrollContainer ? 0 : containerBoundingRect.top) -
            boundingClientRect.top -
            this.helperHeight! / 2
          this.maxTranslate.y =
            (useWindowAsScrollContainer
              ? window.innerHeight
              : containerBoundingRect.top + containerBoundingRect.height) -
            boundingClientRect.top -
            this.helperHeight! / 2
        }
      }

      if (helperClass) {
        helperClass.split(' ').forEach(className => this.helper.classList.add(className))
      }

      if (helperStyle) {
        setInlineStyles(this.helper, helperStyle)
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
            isKeySorting,
            nodes: this.manager.getOrderedRefs().map(r => r.node),
            helper: this.helper
          },
          event
        )
      }
    }

    move(position: { x: number; y: number }, motion: Motion) {
      this.updateHelperPosition(position, motion === Motion.Snap)
      this.animateNodes()
      this.autoscroll()
    }

    async drop() {
      const { hideSortableGhost, onSortEnd, dropAnimationDuration } = this.props
      const {
        active: { collection },
        isKeySorting
      } = this.manager
      const nodes = this.manager.getOrderedRefs()

      if (dropAnimationDuration && !isKeySorting) {
        await this.dropAnimation()
      }

      // Remove the helper from the DOM
      this.helper.parentNode?.removeChild(this.helper)

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
      this.manager.isKeySorting = false

      this.setState({
        sorting: false,
        sortingIndex: null
      })

      if (typeof onSortEnd === 'function') {
        onSortEnd({
          collection,
          newIndex: this.newIndex!,
          oldIndex: this.index!,
          isKeySorting,
          nodes: nodes.map(r => r.node)
        })
      }
    }

    updateHelperPosition(offset: { x: number; y: number }, ignoreTransition: boolean) {
      const {
        lockAxis,
        lockOffset,
        lockToContainerEdges,
        outOfTheWayAnimationDuration,
        keyboardSortingTransitionDuration = outOfTheWayAnimationDuration
      } = this.props
      const { isKeySorting } = this.manager

      const translate = {
        x: offset.x - this.initialOffset!.x,
        y: offset.y - this.initialOffset!.y
      }

      // Adjust for window scroll
      translate.y -= window.pageYOffset - this.initialWindowScroll!.top
      translate.x -= window.pageXOffset - this.initialWindowScroll!.left

      this.translate = translate

      if (lockToContainerEdges) {
        const [minLockOffset, maxLockOffset] = getLockPixelOffsets({
          height: this.helperHeight,
          lockOffset,
          width: this.helperWidth
        })
        const minOffset = {
          x: this.helperWidth! / 2 - minLockOffset.x,
          y: this.helperHeight! / 2 - minLockOffset.y
        }
        const maxOffset = {
          x: this.helperWidth! / 2 - maxLockOffset.x,
          y: this.helperHeight! / 2 - maxLockOffset.y
        }

        translate.x = limit(this.minTranslate!.x + minOffset.x, this.maxTranslate!.x - maxOffset.x, translate.x)
        translate.y = limit(this.minTranslate!.y + minOffset.y, this.maxTranslate!.y - maxOffset.y, translate.y)
      }

      if (lockAxis === 'x') {
        translate.y = 0
      } else if (lockAxis === 'y') {
        translate.x = 0
      }

      if (isKeySorting && keyboardSortingTransitionDuration && !ignoreTransition) {
        setTransitionDuration(this.helper, keyboardSortingTransitionDuration)
      }

      setTranslate3d(this.helper, translate)
    }

    animateNodes() {
      const { outOfTheWayAnimationDuration, outOfTheWayAnimationEasing, hideSortableGhost, onSortOver } = this.props
      const { containerScrollDelta, windowScrollDelta } = this
      const nodes = this.manager.getOrderedRefs()
      const sortingOffset = {
        left: this.offsetEdge!.left + this.translate!.x + containerScrollDelta.left,
        top: this.offsetEdge!.top + this.translate!.y + containerScrollDelta.top
      }
      const { isKeySorting } = this.manager

      const prevIndex = this.newIndex!
      this.newIndex = undefined

      for (let i = 0, len = nodes.length; i < len; i++) {
        const { node } = nodes[i]
        const { index } = node.sortableInfo
        const width = node.offsetWidth
        const height = node.offsetHeight
        const offset = {
          height: this.helperHeight! > height ? height / 2 : this.helperHeight! / 2,
          width: this.helperWidth! > width ? width / 2 : this.helperWidth! / 2
        }

        // For keyboard sorting, we want user input to dictate the position of the nodes
        const mustShiftBackward = isKeySorting && index > this.index! && index <= prevIndex
        const mustShiftForward = isKeySorting && index < this.index! && index >= prevIndex

        const translate = { x: 0, y: 0 }
        let { edgeOffset } = nodes[i]

        // If we haven't cached the node's offsetTop / offsetLeft value
        if (!edgeOffset) {
          edgeOffset = getEdgeOffset(node, this.container)
          nodes[i].edgeOffset = edgeOffset
          // While we're at it, cache the boundingClientRect, used during keyboard sorting
          if (isKeySorting) {
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
          if (isKeySorting) {
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
              translate.x = this.helperWidth! + this.marginOffset!.x
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
              translate.x = -(this.helperWidth! + this.marginOffset!.x)
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
              translate.x = -(this.helperWidth! + this.marginOffset!.x)
              this.newIndex = index
            } else if (
              mustShiftForward ||
              (index < this.index! && sortingOffset.left + windowScrollDelta.left <= edgeOffset.left + offset.width)
            ) {
              translate.x = this.helperWidth! + this.marginOffset!.x

              if (this.newIndex == undefined) {
                this.newIndex = index
              }
            }
          }
        } else if (this.axis!.y) {
          if (
            mustShiftBackward ||
            (index > this.index! && sortingOffset.top + windowScrollDelta.top + offset.height >= edgeOffset.top)
          ) {
            translate.y = -(this.helperHeight! + this.marginOffset!.y)
            this.newIndex = index
          } else if (
            mustShiftForward ||
            (index < this.index! && sortingOffset.top + windowScrollDelta.top <= edgeOffset.top + offset.height)
          ) {
            translate.y = this.helperHeight! + this.marginOffset!.y
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

      if (isKeySorting) {
        // If keyboard sorting, we want the user input to dictate index, not location of the helper
        this.newIndex = prevIndex
      }

      const oldIndex = isKeySorting ? this.prevIndex : prevIndex
      if (onSortOver && this.newIndex !== oldIndex) {
        onSortOver({
          collection: this.manager.active!.collection,
          index: this.index!,
          newIndex: this.newIndex!,
          oldIndex: oldIndex!,
          isKeySorting,
          nodes: nodes.map(r => r.node),
          helper: this.helper
        })
      }
    }

    dropAnimation() {
      return new Promise(resolve => {
        const { dropAnimationDuration, dropAnimationEasing } = this.props
        const { containerScrollDelta, windowScrollDelta } = this
        const oldOffset = this.offsetEdge!
        const { edgeOffset, node: newNode } = this.manager.nodeAtIndex(this.newIndex)!

        const newOffset = edgeOffset || getEdgeOffset(newNode, this.container)

        const deltaX =
          this.newIndex! > this.index!
            ? newOffset.left - this.helperWidth! + newNode.offsetWidth - oldOffset.left
            : newOffset.left - oldOffset.left
        const deltaY =
          this.newIndex! > this.index!
            ? newOffset.top - this.helperHeight! + newNode.offsetHeight - oldOffset.top
            : newOffset.top - oldOffset.top

        setTranslate3d(this.helper, {
          x: deltaX - containerScrollDelta.left - windowScrollDelta.left,
          y: deltaY - containerScrollDelta.top - windowScrollDelta.top
        })
        setTransition(this.helper, `transform ${dropAnimationDuration}ms ${dropAnimationEasing}`)

        this.helper.addEventListener('transitionend', event => {
          // We only want to know when the transform transition ends, there
          // could be other animated properties, such as opacity
          if (event.propertyName !== 'transform') {
            return
          }

          resolve()
        })
      })
    }

    autoscroll = () => {
      const { disableAutoscroll } = this.props
      const { isKeySorting } = this.manager

      if (disableAutoscroll) {
        this.autoScroller.clear()
        return
      }

      if (isKeySorting) {
        const translate = { ...this.translate! }
        let scrollX = 0
        let scrollY = 0

        if (this.axis!.x) {
          translate.x = Math.min(this.maxTranslate.x, Math.max(this.minTranslate.x, this.translate!.x))
          scrollX = this.translate!.x - translate.x
        }

        if (this.axis!.y) {
          translate.y = Math.min(this.maxTranslate.y, Math.max(this.minTranslate.y, this.translate!.y))
          scrollY = this.translate!.y - translate.y
        }

        this.translate = translate
        setTranslate3d(this.helper, this.translate)
        this.scrollContainer.scrollLeft += scrollX
        this.scrollContainer.scrollTop += scrollY

        return
      }

      this.autoScroller.update({
        height: this.helperHeight,
        maxTranslate: this.maxTranslate,
        minTranslate: this.minTranslate,
        translate: this.translate,
        width: this.helperWidth
      })
    }

    onAutoScroll = (offset: { left: number; top: number }) => {
      this.translate!.x += offset.left
      this.translate!.y += offset.top

      this.animateNodes()
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
      const { useWindowAsScrollContainer } = this.props

      if (useWindowAsScrollContainer) {
        return { left: 0, top: 0 }
      }

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
      if (this.state.sorting) return false

      const sortableElement = closest(element, isSortableNode)
      if (!sortableElement || !this.nodeIsChild(sortableElement)) return false
      if (sortableElement.sortableInfo.disabled) return false

      if (this.props.useDragHandle && !closest(element, isSortableHandle)) return false
      return true
    }
  }
}
