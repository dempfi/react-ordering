import { Options } from './types'
import { NodeType, closest } from '../utils'

export class Settings {
  constructor(public options: Options) {}

  get withHandle() {
    return this.options.withHandle ?? false
  }

  get withoutAutoscroll() {
    return this.options.withoutAutoscroll ?? false
  }

  get withoutSortableGhost() {
    return this.options.withoutSortableGhost ?? true
  }

  get lockToContainerEdges() {
    return this.options.lockToContainerEdges ?? false
  }

  get axis() {
    const axis = this.options.axis ?? 'y'
    return { x: axis.indexOf('x') >= 0, y: axis.indexOf('y') >= 0 }
  }

  get animations() {
    return {
      drop: {
        easing: this.options.dropAnimation?.easing ?? 'cubic-bezier(.2,1,.1,1)',
        duration: this.options.dropAnimation?.duration ?? 200
      },
      outOfTheWay: {
        easing: this.options.outOfTheWayAnimation?.easing ?? 'cubic-bezier(0.2, 0, 0, 1)',
        duration: this.options.outOfTheWayAnimation?.duration ?? 200
      }
    }
  }

  get pressDelay() {
    return {
      time: this.options.pressDelay?.time ?? 0,
      distanceThreshold: this.options.pressDelay?.distanceThreshold ?? 5
    }
  }

  get moveDelay() {
    return this.options.moveDelay ?? 0
  }

  canSort(element: HTMLElement) {
    if (this.options.canSort) return this.options.canSort(element)
    const interactiveElements = [NodeType.Input, NodeType.Textarea, NodeType.Select, NodeType.Option, NodeType.Button]
    if (interactiveElements.indexOf(element.tagName) !== -1) return false
    if (closest(element, (el): el is HTMLElement => el.contentEditable === 'true')) return false

    return true
  }

  get updateBeforeStart() {
    return this.options.updateBeforeStart ?? (() => {})
  }

  get onStart() {
    return this.options.onStart
  }
  get onMove() {
    return this.options.onMove
  }
  get onOver() {
    return this.options.onOver
  }
  get onEnd() {
    return this.options.onEnd
  }
}
