import { Backend } from './backend'

export interface BackendDelegate {
  readonly pressDelay?: {
    time: number
    distanceThreshold: number
  }

  readonly moveDelay?: number
  readonly isSorting: boolean
  canLift(element: HTMLElement): boolean
  lift(element: HTMLElement, position: { x: number; y: number }, backend: Backend): void
  move(position: { x: number; y: number }): void
  snap(by: number): void
  drop(): void
  cancel(): void
}
