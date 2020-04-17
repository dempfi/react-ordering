import { Motion } from './backend'

export interface BackendDelegate {
  readonly pressDelay?: {
    time: number
    distanceThreshold: number
  }

  readonly moveDelay?: number
  readonly isSorting: boolean
  canLift(element: HTMLElement): boolean
  lift(element: HTMLElement, position: { x: number; y: number }, motion: Motion): void
  move(position: { x: number; y: number }, motion: Motion): void
  drop(): void
  cancel(): void
}
