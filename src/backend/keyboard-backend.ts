import { Backend, Motion } from './backend'
import { defaultKeyCodes } from '../SortableContainer/props'

type ElementEvent = Omit<KeyboardEvent, 'target'> & { target: HTMLElement }

export class KeyboardBackend extends Backend {
  motion = Motion.Snap
  private keyCodes = defaultKeyCodes
  private initialFocusedNode?: HTMLElement

  attach() {
    this.container.addEventListener('keydown', this.handleKeyDown)
  }

  detach() {
    this.container.removeEventListener('keydown', this.handleKeyDown)
  }

  lifted(element: HTMLElement) {}

  private handleKeyDown = (rawEvent: KeyboardEvent) => {
    const event = rawEvent as ElementEvent

    if (!this.delegate.isSorting) {
      if (!this.delegate.canLift(event.target)) return
      if (!this.keyCodes.lift.includes(event.keyCode)) return
    }

    event.stopPropagation()
    event.preventDefault()

    if (this.keyCodes.lift.includes(event.keyCode) && !this.delegate.isSorting) {
      this.keyLift(event)
    } else if (this.keyCodes.drop.includes(event.keyCode)) {
      this.delegate.drop()
      this.initialFocusedNode?.focus()
    } else if (this.keyCodes.cancel.includes(event.keyCode)) {
      this.delegate.cancel()
      this.initialFocusedNode?.focus()
    } else if (this.keyCodes.up.includes(event.keyCode)) {
      this.delegate.snap(-1)
    } else if (this.keyCodes.down.includes(event.keyCode)) {
      this.delegate.snap(1)
    }
  }

  keyLift = (event: ElementEvent) => {
    this.initialFocusedNode = event.target

    this.delegate.lift(
      event.target,
      {
        x: event.target.getBoundingClientRect().left,
        y: event.target.getBoundingClientRect().top
      },
      this.motion
    )
  }
}
