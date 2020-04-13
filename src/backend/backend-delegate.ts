import { Motion } from './backend'

export interface BackendDelegate {
  readonly pressDelay?: {
    time: number
    distanceThreshold: number
  }

  readonly moveDelay?: number
  readonly isSorting: boolean
  canLift(element: HTMLElement): boolean
  lift(position: { x: number; y: number }, element: HTMLElement): void
  move(position: { x: number; y: number }, motion: Motion, element: HTMLElement): void
  drop(position: { x: number; y: number }, element: HTMLElement): void
  cancel(): void
}
