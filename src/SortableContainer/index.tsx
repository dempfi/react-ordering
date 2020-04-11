import React from 'react'
import { findDOMNode } from 'react-dom'
import invariant from 'invariant'

import { isSortableHandle } from '../handle'
import { Manager, ManagerContext } from '../manager'

import {
  cloneNode,
  closest,
  events,
  getScrollingParent,
  getContainerGridGap,
  getEdgeOffset,
  getElementMargin,
  getLockPixelOffsets,
  getPosition,
  isTouchEvent,
  limit,
  NodeType,
  omit,
  provideDisplayName,
  setInlineStyles,
  setTransition,
  setTransitionDuration,
  setTranslate3d,
  getTargetIndex,
  getScrollAdjustedBoundingClientRect
} from '../utils'

import { AutoScroller } from '../auto-scroller'
import { defaultProps, orderingProps, defaultKeyCodes } from './props'

import {
  WrappedComponent,
  Config,
  SortableContainerProps,
  SortableNode,
  SortEvent,
  SortTouchEvent,
  SortKeyboardEvent,
  SortMouseEvent
} from '../types'
import { isSortableNode } from '../element'

export default function sortableContainer<P>(
  WrappedComponent: WrappedComponent<P>,
  config: Config = { withRef: false }
) {
  return class WithSortableContainer extends React.Component<SortableContainerProps> {
    manager = new Manager()
    document!: Document
    container!: HTMLElement
    contentWindow!: Window
    scrollContainer!: HTMLElement
    autoScroller!: AutoScroller
    touched = false
    helper!: HTMLElement
    pressTimer?: number
    cancelTimer?: number
    _awaitingUpdateBeforeSortStart?: boolean
    state: { sorting: boolean; sortingIndex?: number } = { sorting: false }
    translate?: { x: number; y: number }
    initialOffset?: { x: number; y: number }
    initialScroll?: { left: number; top: number }
    initialWindowScroll?: { left: number; top: number }
    initialFocusedNode?: HTMLElement
    newIndex?: number
    margin?: { bottom: number; left: number; right: number; top: number }
    gridGap?: { x: number; y: number }
    width?: number
    height?: number
    marginOffset?: { x: number; y: number }
    boundingClientRect?: DOMRect
    containerBoundingRect?: DOMRect
    index?: number
    axis = { x: false, y: true }
    offsetEdge?: { left: number; top: number }
    sortableGhost?: SortableNode
    prevIndex: number | undefined
    position?: { x: number; y: number }
    listenerNode?: HTMLElement | Window
    minTranslate = { x: 0, y: 0 }
    maxTranslate = { x: 0, y: 0 }

    constructor(props: SortableContainerProps) {
      super(props)
    }

    static displayName = provideDisplayName('sortableList', WrappedComponent)
    static defaultProps = defaultProps

    componentDidMount() {
      const { useWindowAsScrollContainer } = this.props
      const container = this.getContainer()

      Promise.resolve(container).then(containerNode => {
        this.container = containerNode
        this.document = this.container.ownerDocument || document

        /*
         *  Set our own default rather than using defaultProps because Jest
         *  snapshots will serialize window, causing a RangeError
         *  https://github.com/clauderic/react-ordering/issues/249
         */
        const contentWindow = this.props.contentWindow || this.document.defaultView || window

        this.contentWindow = typeof contentWindow === 'function' ? contentWindow() : contentWindow

        this.scrollContainer = useWindowAsScrollContainer
          ? this.document.scrollingElement || this.document.documentElement
          : getScrollingParent(this.container) || this.container

        this.autoScroller = new AutoScroller(this.scrollContainer, this.onAutoScroll)

        events.start.forEach(name => this.container.addEventListener(name, this.handleStartEvent as any, false))
        events.end.forEach(name => this.container.addEventListener(name, this.handleEndEvent as any, false))
        events.move.forEach(name => this.container.addEventListener(name, this.handleMoveEvent as any, false))

        this.container.addEventListener('keydown', this.handleKeyDown as any)
      })
    }

    componentWillUnmount() {
      if (this.helper && this.helper.parentNode) {
        this.helper.parentNode.removeChild(this.helper)
      }
      if (!this.container) {
        return
      }

      events.start.forEach(name => this.container.removeEventListener(name, this.handleStartEvent as any))
      events.end.forEach(name => this.container.removeEventListener(name, this.handleEndEvent as any))
      events.move.forEach(name => this.container.removeEventListener(name, this.handleMoveEvent as any))

      this.container.removeEventListener('keydown', this.handleKeyDown as any)
    }

    handleStartEvent = (event: SortEvent) => {
      const { distance, shouldCancelStart } = this.props

      if ((!isTouchEvent(event) && event.button === 2) || shouldCancelStart!(event)) {
        return
      }

      this.touched = true
      this.position = getPosition(event)

      const node = closest(event.target, isSortableNode)

      if (node && this.nodeIsChild(node) && !this.state.sorting) {
        const { useDragHandle } = this.props
        const { index, collection, disabled } = node.sortableInfo

        if (disabled) {
          return
        }

        if (useDragHandle && !closest(event.target, isSortableHandle)) {
          return
        }

        this.manager.active = { collection, index }

        /*
         * Fixes a bug in Firefox where the :active state of anchor tags
         * prevent subsequent 'mousemove' events from being fired
         * (see https://github.com/clauderic/react-ordering/issues/118)
         */
        if (!isTouchEvent(event) && event.target.tagName === NodeType.Anchor) {
          event.preventDefault()
        }

        if (!distance) {
          if (this.props.pressDelay === 0) {
            this.handleSortStart(event)
          } else {
            this.pressTimer = setTimeout(() => this.handleSortStart(event), this.props.pressDelay)
          }
        }
      }
    }

    nodeIsChild = (node: SortableNode) => {
      return node.sortableInfo.manager === this.manager
    }

    handleMoveEvent = (event: SortMouseEvent | SortTouchEvent) => {
      const { distance, pressThreshold } = this.props

      if (!this.state.sorting && this.touched && !this._awaitingUpdateBeforeSortStart) {
        const position = getPosition(event)
        const delta = {
          x: this.position!.x - position.x,
          y: this.position!.y - position.y
        }
        const combinedDelta = Math.abs(delta.x) + Math.abs(delta.y)

        if (!distance && (!pressThreshold || combinedDelta >= pressThreshold)) {
          clearTimeout(this.cancelTimer)
          this.cancelTimer = window.setTimeout(this.cancel, 0)
        } else if (distance && combinedDelta >= distance && this.manager.isActive()) {
          this.handleSortStart(event)
        }
      }
    }

    handleEndEvent = () => {
      this.touched = false
      this.cancel()
    }

    cancel = () => {
      const { distance } = this.props
      const { sorting } = this.state

      if (!sorting) {
        if (!distance) {
          clearTimeout(this.pressTimer)
        }
        this.manager.active = undefined
      }
    }

    handleSortStart = async (event: SortTouchEvent | SortMouseEvent | SortKeyboardEvent) => {
      const active = this.manager.getActive()

      if (!active) return
      const {
        axis,
        getHelperDimensions,
        helperClass,
        helperStyle,
        hideSortableGhost,
        updateBeforeSortStart,
        onSortStart,
        useWindowAsScrollContainer
      } = this.props
      const { node, collection } = active
      const { isKeySorting } = this.manager

      if (typeof updateBeforeSortStart === 'function') {
        this._awaitingUpdateBeforeSortStart = true

        try {
          const { index } = node.sortableInfo
          await updateBeforeSortStart({ collection, index, node, isKeySorting }, event)
        } finally {
          this._awaitingUpdateBeforeSortStart = false
        }
      }

      // Need to get the latest value for `index` in case it changes during `updateBeforeSortStart`
      const { index } = node.sortableInfo
      const margin = getElementMargin(node)
      const gridGap = getContainerGridGap(this.container)
      const containerBoundingRect = this.scrollContainer.getBoundingClientRect()
      const dimensions = getHelperDimensions!({ index, node, collection })

      this.margin = margin
      this.gridGap = gridGap
      this.width = dimensions.width
      this.height = dimensions.height
      this.marginOffset = {
        x: this.margin.left + this.margin.right + this.gridGap.x,
        y: Math.max(this.margin.top, this.margin.bottom, this.gridGap.y)
      }
      this.boundingClientRect = node.getBoundingClientRect()
      this.containerBoundingRect = containerBoundingRect
      this.index = index
      this.newIndex = index

      this.axis = {
        x: axis!.indexOf('x') >= 0,
        y: axis!.indexOf('y') >= 0
      }
      this.offsetEdge = getEdgeOffset(node, this.container)

      if (isKeySorting) {
        this.initialOffset = getPosition({
          ...event,
          pageX: this.boundingClientRect.left,
          pageY: this.boundingClientRect.top
        })
      } else {
        this.initialOffset = getPosition(event as SortMouseEvent | SortTouchEvent)
      }

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
        height: `${this.height}px`,
        left: `${this.boundingClientRect.left - margin.left}px`,
        pointerEvents: 'none',
        position: 'fixed',
        top: `${this.boundingClientRect.top - margin.top}px`,
        width: `${this.width}px`
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
              width: this.contentWindow.innerWidth,
              height: this.contentWindow.innerHeight
            }
          : this.containerBoundingRect
        const containerBottom = containerTop + containerHeight
        const containerRight = containerLeft + containerWidth

        if (this.axis.x) {
          this.minTranslate.x = containerLeft - this.boundingClientRect.left
          this.maxTranslate.x = containerRight - (this.boundingClientRect.left + this.width)
        }

        if (this.axis.y) {
          this.minTranslate.y = containerTop - this.boundingClientRect.top
          this.maxTranslate.y = containerBottom - (this.boundingClientRect.top + this.height)
        }
      } else {
        if (this.axis.x) {
          this.minTranslate.x =
            (useWindowAsScrollContainer ? 0 : containerBoundingRect.left) -
            this.boundingClientRect.left -
            this.width! / 2
          this.maxTranslate.x =
            (useWindowAsScrollContainer
              ? this.contentWindow.innerWidth
              : containerBoundingRect.left + containerBoundingRect.width) -
            this.boundingClientRect.left -
            this.width! / 2
        }

        if (this.axis.y) {
          this.minTranslate.y =
            (useWindowAsScrollContainer ? 0 : containerBoundingRect.top) -
            this.boundingClientRect.top -
            this.height! / 2
          this.maxTranslate.y =
            (useWindowAsScrollContainer
              ? this.contentWindow.innerHeight
              : containerBoundingRect.top + containerBoundingRect.height) -
            this.boundingClientRect.top -
            this.height! / 2
        }
      }

      if (helperClass) {
        helperClass.split(' ').forEach(className => this.helper.classList.add(className))
      }

      if (helperStyle) {
        setInlineStyles(this.helper, helperStyle)
      }

      this.listenerNode = isTouchEvent(event) ? node : this.contentWindow

      if (isKeySorting) {
        this.listenerNode.addEventListener('wheel', this.handleKeyEnd as any, true)
        this.listenerNode.addEventListener('mousedown', this.handleKeyEnd as any, true)
        this.listenerNode.addEventListener('keydown', this.handleKeyDown as any)
      } else {
        events.move.forEach(eventName =>
          this.listenerNode!.addEventListener(eventName, this.handleSortMove as any, false)
        )
        events.end.forEach(eventName =>
          this.listenerNode!.addEventListener(eventName, this.handleSortEnd as any, false)
        )
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

      if (isKeySorting) {
        // Readjust positioning in case re-rendering occurs onSortStart
        this.keyMove(0)
      }
    }

    handleSortMove = (event: SortMouseEvent | SortTouchEvent, ignoreTransition: boolean = false) => {
      const { onSortMove } = this.props

      // Prevent scrolling on mobile
      if (typeof event.preventDefault === 'function') {
        event.preventDefault()
      }

      this.updateHelperPosition(event, ignoreTransition)
      this.animateNodes()
      this.autoscroll()

      if (onSortMove) {
        onSortMove(event)
      }
    }

    handleSortEnd = async (event: SortTouchEvent | SortMouseEvent | SortKeyboardEvent) => {
      const { hideSortableGhost, onSortEnd, dropAnimationDuration } = this.props
      const {
        active: { collection },
        isKeySorting
      } = this.manager
      const nodes = this.manager.getOrderedRefs()

      // Remove the event listeners if the node is still in the DOM
      if (this.listenerNode) {
        if (isKeySorting) {
          this.listenerNode.removeEventListener('wheel', this.handleKeyEnd as any, true)
          this.listenerNode.removeEventListener('mousedown', this.handleKeyEnd as any, true)
          this.listenerNode.removeEventListener('keydown', this.handleKeyDown as any)
        } else {
          events.move.forEach(eventName =>
            this.listenerNode!.removeEventListener(eventName, this.handleSortMove as any)
          )
          events.end.forEach(eventName => this.listenerNode!.removeEventListener(eventName, this.handleSortEnd as any))
        }
      }

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
        onSortEnd(
          {
            collection,
            newIndex: this.newIndex!,
            oldIndex: this.index!,
            isKeySorting,
            nodes: nodes.map(r => r.node)
          },
          event
        )
      }

      this.touched = false
    }

    updateHelperPosition(event: SortEvent, ignoreTransition: boolean) {
      const {
        lockAxis,
        lockOffset,
        lockToContainerEdges,
        outOfTheWayAnimationDuration,
        keyboardSortingTransitionDuration = outOfTheWayAnimationDuration
      } = this.props
      const { isKeySorting } = this.manager

      const offset = getPosition(event)
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
          height: this.height,
          lockOffset,
          width: this.width
        })
        const minOffset = {
          x: this.width! / 2 - minLockOffset.x,
          y: this.height! / 2 - minLockOffset.y
        }
        const maxOffset = {
          x: this.width! / 2 - maxLockOffset.x,
          y: this.height! / 2 - maxLockOffset.y
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
      const {
        outOfTheWayAnimationDuration,
        outOfTheWayAnimationEasing,
        hideSortableGhost,
        onSortOver,
        dropAnimationDuration,
        dropAnimationEasing
      } = this.props
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
          height: this.height! > height ? height / 2 : this.height! / 2,
          width: this.width! > width ? width / 2 : this.width! / 2
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
          setTransition(node, `transform ${dropAnimationDuration}ms ${dropAnimationEasing}`)
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
              translate.x = this.width! + this.marginOffset!.x
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
              translate.x = -(this.width! + this.marginOffset!.x)
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
              translate.x = -(this.width! + this.marginOffset!.x)
              this.newIndex = index
            } else if (
              mustShiftForward ||
              (index < this.index! && sortingOffset.left + windowScrollDelta.left <= edgeOffset.left + offset.width)
            ) {
              translate.x = this.width! + this.marginOffset!.x

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
            translate.y = -(this.height! + this.marginOffset!.y)
            this.newIndex = index
          } else if (
            mustShiftForward ||
            (index < this.index! && sortingOffset.top + windowScrollDelta.top <= edgeOffset.top + offset.height)
          ) {
            translate.y = this.height! + this.marginOffset!.y
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
            ? newOffset.left - this.width! + newNode.offsetWidth - oldOffset.left
            : newOffset.left - oldOffset.left
        const deltaY =
          this.newIndex! > this.index!
            ? newOffset.top - this.height! + newNode.offsetHeight - oldOffset.top
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
        height: this.height,
        maxTranslate: this.maxTranslate,
        minTranslate: this.minTranslate,
        translate: this.translate,
        width: this.width
      })
    }

    onAutoScroll = (offset: { left: number; top: number }) => {
      this.translate!.x += offset.left
      this.translate!.y += offset.top

      this.animateNodes()
    }

    getWrappedInstance() {
      invariant(
        config.withRef,
        'To access the wrapped instance, you need to pass in {withRef: true} as the second argument of the SortableContainer() call'
      )

      return this.refs.wrappedInstance
    }

    getContainer() {
      const { getContainer } = this.props

      if (typeof getContainer !== 'function') {
        return findDOMNode(this) as HTMLElement
      }

      return getContainer(config.withRef ? this.getWrappedInstance() : undefined)
    }

    handleKeyDown = (event: SortKeyboardEvent) => {
      const { keyCode } = event
      const { shouldCancelStart, keyCodes: customKeyCodes = {} } = this.props

      const keyCodes = {
        ...defaultKeyCodes,
        ...customKeyCodes
      }

      if (
        (this.manager.active && !this.manager.isKeySorting) ||
        (!this.manager.active &&
          (!keyCodes.lift.includes(keyCode) || shouldCancelStart!(event) || !this.isValidSortingTarget(event)))
      ) {
        return
      }

      event.stopPropagation()
      event.preventDefault()

      if (keyCodes.lift.includes(keyCode) && !this.manager.active) {
        this.keyLift(event)
      } else if (keyCodes.drop.includes(keyCode) && this.manager.active) {
        this.keyDrop(event)
      } else if (keyCodes.cancel.includes(keyCode)) {
        this.newIndex = this.manager.active!.index
        this.keyDrop(event)
      } else if (keyCodes.up.includes(keyCode)) {
        this.keyMove(-1)
      } else if (keyCodes.down.includes(keyCode)) {
        this.keyMove(1)
      }
    }

    keyLift = (event: SortKeyboardEvent) => {
      const { target } = event
      const node = closest(target, isSortableNode)!
      const { index, collection } = node.sortableInfo

      this.initialFocusedNode = target

      this.manager.isKeySorting = true
      this.manager.active = {
        index,
        collection
      }

      this.handleSortStart(event)
    }

    keyMove = (shift: number) => {
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
        x: shouldAdjustForSize && this.axis.x ? targetNode.offsetWidth - this.width! : 0,
        y: shouldAdjustForSize && this.axis.y ? targetNode.offsetHeight - this.height! : 0
      }

      this.handleSortMove(
        {
          pageX: targetPosition.left + sizeAdjustment.x,
          pageY: targetPosition.top + sizeAdjustment.y
        },
        shift === 0
      )
    }

    keyDrop = (event: SortKeyboardEvent) => {
      this.handleSortEnd(event)

      if (this.initialFocusedNode) {
        this.initialFocusedNode.focus()
      }
    }

    handleKeyEnd = (event: SortKeyboardEvent) => {
      if (this.manager.active) {
        this.keyDrop(event)
      }
    }

    isValidSortingTarget = (event: SortMouseEvent | SortTouchEvent | SortKeyboardEvent) => {
      const { useDragHandle } = this.props
      const { target } = event
      const node = closest(target, isSortableNode)

      return node && !node.sortableInfo.disabled && (useDragHandle ? isSortableHandle(target) : isSortableNode(target))
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

      return helperContainer || this.document.body
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
        left: this.contentWindow.pageXOffset - this.initialWindowScroll!.left,
        top: this.contentWindow.pageYOffset - this.initialWindowScroll!.top
      }
    }
  }
}
