import { Motion } from './backend'
import { setInlineStyles, setTransition, setTranslate3d } from './utils'

export class ElementsMover {
  private motion: Motion

  constructor() {}

  animate() {
    const { outOfTheWayAnimationDuration, outOfTheWayAnimationEasing, hideSortableGhost } = this.props
    const { containerScrollDelta, windowScrollDelta } = this
    const nodes = this.manager.getOrderedRefs()
    const sortingOffset = {
      left: this.offsetEdge!.left + this.helper.translate.x + containerScrollDelta.left,
      top: this.offsetEdge!.top + this.helper.translate.y + containerScrollDelta.top
    }

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

      // Grid setup
      if (this.directions.vertical && this.directions.horizontal) {
        if (
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
        } else if (
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
        }
        // horizontal list
      } else if (this.directions.horizontal) {
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
        // vertical list
      } else if (this.directions.vertical) {
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
  }
}
