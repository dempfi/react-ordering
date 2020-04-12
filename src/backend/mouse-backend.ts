import { Backend, Motion } from './backend'
import { NodeType } from '../utils'

type ElementEvent = MouseEvent & { target: HTMLElement }

export class MouseBackend extends Backend {
  motion = Motion.Fluid

  attach() {
    this.container.addEventListener('mousedown', this.handleMouseDown, false)
    this.container.addEventListener('mousemove', this.handleMouseMove, false)
    this.container.addEventListener('mouseup', this.handleMouseUp, false)
  }

  detach() {
    this.container.removeEventListener('mousedown', this.handleMouseDown)
    this.container.removeEventListener('mousemove', this.handleMouseMove)
    this.container.removeEventListener('mouseup', this.handleMouseUp)
  }

  private handleMouseDown(rawEvent: MouseEvent) {
    const event = rawEvent as ElementEvent
    if (event.button === 2) return

    /*
     * Fixes a bug in Firefox where the :active state of anchor tags
     * prevent subsequent 'mousemove' events from being fired
     * (see https://github.com/clauderic/react-ordering/issues/118)
     */
    if (event.target.tagName === NodeType.Anchor) {
      event.preventDefault()
    }

    this.delegate.lift({ x: event.pageX, y: event.pageY }, event.target)
  }

  private handleMouseUp(rawEvent: MouseEvent) {
    const event = rawEvent as ElementEvent
  }

  private handleMouseMove(rawEvent: MouseEvent) {
    const event = rawEvent as ElementEvent
  }
}
