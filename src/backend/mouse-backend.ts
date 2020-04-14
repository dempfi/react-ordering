import { Backend, Motion } from './backend'
import { NodeType } from '../utils'

type ElementEvent = Omit<MouseEvent, 'target'> & { target: HTMLElement }

export class MouseBackend extends Backend {
  motion = Motion.Fluid

  attach() {
    this.container.addEventListener('mousedown', this.handleMouseDown, false)
    this.container.addEventListener('mousemove', this.handleMouseMoveInContainer, false)
    this.container.addEventListener('mouseup', this.handleMouseUpInContainer, false)
  }

  detach() {
    this.container.removeEventListener('mousedown', this.handleMouseDown)
    this.container.removeEventListener('mousemove', this.handleMouseMoveInContainer)
    this.container.removeEventListener('mouseup', this.handleMouseUpInContainer)
  }

  lifted(element: HTMLElement) {
    window.addEventListener('mousemove', this.handleMouseMove, false)
    window.addEventListener('mouseup', this.handleMouseUp, false)
  }

  private handleMouseDown = (rawEvent: MouseEvent) => {
    const event = rawEvent as ElementEvent
    if (event.button === 2) return
    if (!this.delegate.canLift(event.target)) return

    /*
     * Fixes a bug in Firefox where the :active state of anchor tags
     * prevent subsequent 'mousemove' events from being fired
     * (see https://github.com/clauderic/react-ordering/issues/118)
     */
    if (event.target.tagName === NodeType.Anchor) event.preventDefault()

    this.attemptLift({ x: event.pageX, y: event.pageY }, event.target)
  }

  private handleMouseMoveInContainer = (rawEvent: MouseEvent) => {
    const event = rawEvent as ElementEvent
    this.attemptLiftAfterMove({ x: event.pageX, y: event.pageY }, event.target)
  }

  private handleMouseUpInContainer = () => {
    if (this.delegate.isSorting) return
    this.cancel()
  }

  private handleMouseMove = (event: MouseEvent) => {
    if (!this.delegate.isSorting) return
    this.delegate.move({ x: event.pageX, y: event.pageY }, this.motion)
  }

  private handleMouseUp = () => {
    this.delegate.drop()
    window.removeEventListener('mousemove', this.handleMouseMove)
    window.removeEventListener('mouseup', this.handleMouseUp)
    this.cancel()
  }
}
