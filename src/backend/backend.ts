import { BackendDelegate } from './backend-delegate'

export enum Motion {
  Fluid,
  Snap
}

export abstract class Backend {
  private positionAtStart?: { x: number; y: number }
  private pressDelayTimer?: number
  private cancelTimer?: number

  constructor(protected delegate: BackendDelegate, protected container: HTMLElement) {}

  abstract motion: Motion

  abstract attach(): void

  abstract detach(): void

  abstract lifted(element: HTMLElement): void

  protected attemptLift(position: { x: number; y: number }, element: HTMLElement) {
    this.positionAtStart = position
    if (this.delegate.moveDelay) return

    if (!this.delegate.pressDelay || this.delegate.pressDelay.time === 0) {
      this.delegate.lift(position, element)
    } else {
      this.pressDelayTimer = window.setTimeout(() => {
        this.delegate.lift(position, element)
      }, this.delegate.pressDelay?.time)
    }
  }

  protected attemptLiftAfterMove(position: { x: number; y: number }, element: HTMLElement) {
    if (this.delegate.isSorting || !this.positionAtStart) return

    const x = this.positionAtStart!.x - position.x
    const y = this.positionAtStart!.y - position.y

    const combinedDelta = Math.abs(x) + Math.abs(y)

    if (
      !this.delegate.moveDelay &&
      (!this.delegate.pressDelay?.distanceThreshold || combinedDelta >= this.delegate.pressDelay?.distanceThreshold)
    ) {
      clearTimeout(this.cancelTimer)
      this.cancelTimer = window.setTimeout(this.cancel, 0)
    } else if (this.delegate.moveDelay && combinedDelta >= this.delegate.moveDelay) {
      this.delegate.lift(position, element)
    }
  }

  protected cancel() {
    if (this.pressDelayTimer) clearTimeout(this.pressDelayTimer)
    this.pressDelayTimer = undefined
    this.positionAtStart = undefined
  }
}
