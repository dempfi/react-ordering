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

  lifted(element: HTMLElement) {}

  private handleMouseDown = (rawEvent: MouseEvent) => {
    const event = rawEvent as ElementEvent
    if (event.button === 2) return
    if (!this.delegate.canLift(event.target)) return

    /*
     * Fixes a bug in Firefox where the :active state of anchor tags
     * prevent subsequent 'mousemove' events from being fired
     * (see https://github.com/clauderic/react-ordering/issues/118)
     */
    if (event.target.tagName === NodeType.Anchor) {
      event.preventDefault()
    }

    this.start({ x: event.pageX, y: event.pageY }, event.target)
  }

  private handleMouseMove = (rawEvent: MouseEvent) => {
    const event = rawEvent as ElementEvent
    this.move({ x: event.pageX, y: event.pageY }, event.target)
  }

  private handleMouseUp = (rawEvent: MouseEvent) => {
    const event = rawEvent as ElementEvent
    this.cancel()
    this.delegate.drop({ x: event.pageX, y: event.pageY }, event.target)
    window.removeEventListener('mousemove', this.handleMouseMove, false)
  }
}
