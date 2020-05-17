import React from 'react'
import { Motion } from './backend'

export type Axis = 'x' | 'y' | 'xy'

export interface SortEvent {
  from: number
  to: number
  motion: Motion
  helper: HTMLElement
}

export type HelperContainerGetter = () => HTMLElement

export interface Dimensions {
  width: number
  height: number
}

export interface SortableContainerProps {
  axis?: Axis
  disableAutoScroll?: boolean
  dropAnimationDuration?: number
  dropAnimationEasing?: string
  helperClass?: string
  helperStyle?: React.CSSProperties
  outOfTheWayAnimationDuration?: number
  outOfTheWayAnimationEasing?: string
  keyboardSortingTransitionDuration?: number
  keyCodes?: {
    lift?: number[]
    drop?: number[]
    cancel?: number[]
    up?: number[]
    down?: number[]
  }
  pressDelay?: number
  pressThreshold?: number
  distance?: number
  shouldCancelStart?: (element: HTMLElement) => boolean
  updateBeforeSortStart?: (event: SortEvent) => void
  onSortStart?: (event: SortEvent) => void
  onSortMove?: (event: SortEvent) => void
  onSortEnd: (event: SortEvent) => void
  onSortOver?: (event: SortEvent) => void
  useDragHandle?: boolean
  hideSortableGhost?: boolean
  lockToContainerEdges?: boolean
  getHelperDimensions?: (event: SortEvent) => Dimensions
  helperContainer?: HTMLElement | HelperContainerGetter
}

export interface Config {
  withRef: boolean
}

export type WrappedComponentFactory<P> = (props: P) => JSX.Element

export type WrappedComponent<P> = React.ComponentClass<P> | React.SFC<P> | WrappedComponentFactory<P>

export function arrayMove<T>(collection: T[], previousIndex: number, newIndex: number): T[]
