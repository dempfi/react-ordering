import { Motion } from '../backend'

export type Axis = 'x' | 'y' | 'xy'

export type Animation = {
  easing: string
  duration: number
}

export type Dimensions = {
  width: number
  height: number
}

export type SortEvent = {
  from: number
  to: number
  motion: Motion
}

export type Options = {
  axis?: Axis
  dropAnimation?: Partial<Animation>
  outOfTheWayAnimation?: Partial<Animation>
  withHandle?: boolean
  withoutAutoscroll?: boolean

  pressDelay?: {
    time?: number
    distanceThreshold?: number
  }

  moveDelay?: number

  canSort?: (element: HTMLElement) => boolean

  updateBeforeStart?: (event: SortEvent) => void | Promise<void>
  onStart?: (event: SortEvent) => void
  onMove?: (event: SortEvent) => void
  onOver?: (event: SortEvent) => void
  onEnd: (event: SortEvent) => void

  hideSortableGhost?: boolean
  lockToContainerEdges?: boolean
  getHelperDimensions?: (event: SortEvent) => Dimensions
}
