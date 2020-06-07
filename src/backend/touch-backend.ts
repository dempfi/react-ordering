import { Backend, Motion } from './backend'

type ElementEvent = Omit<TouchEvent, 'target'> & { target: HTMLElement }

export class TouchBackend extends Backend {
  motion = Motion.Fluid
  private listenerElement?: HTMLElement

  attach() {
    this.container.addEventListener('touchstart', this.handleTouchStart, false)
    this.container.addEventListener('touchmove', this.handleTouchMoveInContainer, false)
    this.container.addEventListener('touchend', this.handleTouchEndInContainer, false)
    this.container.addEventListener('touchcancel', this.handleTouchEndInContainer, false)
  }

  detach() {
    this.container.removeEventListener('touchstart', this.handleTouchStart)
    this.container.removeEventListener('touchmove', this.handleTouchMoveInContainer)
    this.container.removeEventListener('touchend', this.handleTouchEndInContainer)
    this.container.removeEventListener('touchcancel', this.handleTouchEndInContainer)
  }

  lifted(element: HTMLElement) {
    this.listenerElement = element
    this.listenerElement!.addEventListener('touchmove', this.handleTouchMove, false)
    this.listenerElement!.addEventListener('touchend', this.handleTouchEnd, false)
    this.listenerElement!.addEventListener('touchcancel', this.handleTouchEnd, false)
  }

  private handleTouchStart = (rawEvent: TouchEvent) => {
    const event = rawEvent as ElementEvent
    if (!this.delegate.canLift(event.target)) return
    this.attemptLift(this.position(event), event.target)
  }

  private handleTouchMoveInContainer = (rawEvent: TouchEvent) => {
    const event = rawEvent as ElementEvent
    this.attemptLiftAfterMove(this.position(event), event.target)
  }

  private handleTouchEndInContainer = () => {
    if (this.delegate.isSorting) return
    this.cancel()
  }

  private handleTouchMove = (rawEvent: TouchEvent) => {
    const event = rawEvent as ElementEvent
    if (!this.delegate.isSorting) return
    this.delegate.move(this.position(event))
  }

  private handleTouchEnd = () => {
    this.delegate.drop()
    this.listenerElement?.removeEventListener('touchmove', this.handleTouchMove)
    this.listenerElement?.removeEventListener('touchend', this.handleTouchEnd)
    this.listenerElement?.removeEventListener('touchcancel', this.handleTouchEnd)
    this.cancel()
  }

  private position(event: ElementEvent) {
    if (event.touches && event.touches.length) {
      return {
        x: event.touches[0].pageX,
        y: event.touches[0].pageY
      }
    } else {
      return {
        x: event.changedTouches[0].pageX,
        y: event.changedTouches[0].pageY
      }
    }
  }
}
