import React from 'react'
import { Manager } from './manager'

export type CollectionKey = number | string

export type SortableNode = HTMLElement & {
  sortableInfo: {
    collection: CollectionKey
    disabled?: boolean
    index: number
    manager: Manager
    setDragging: (isDragging: boolean) => void
  }
}

export type Axis = 'x' | 'y' | 'xy'

export type Offset = number | string

export interface SortStart {
  node: Element
  index: number
  collection: CollectionKey
  isKeySorting: boolean
  nodes: HTMLElement[]
  helper: HTMLElement
}

export interface SortOver {
  index: number
  oldIndex: number
  newIndex: number
  collection: CollectionKey
  isKeySorting: boolean
  nodes: HTMLElement[]
  helper: HTMLElement
}

export interface SortEnd {
  oldIndex: number
  newIndex: number
  collection: CollectionKey
  isKeySorting: boolean
  nodes: HTMLElement[]
}

export type SortMouseEvent = Omit<MouseEvent, 'target'> & {
  target: HTMLElement
}

export type SortTouchEvent = Omit<TouchEvent, 'target'> & {
  target: HTMLElement
}

export type SortKeyboardEvent = Omit<KeyboardEvent, 'target'> & {
  target: HTMLElement
}

export type SortEvent = SortMouseEvent | SortTouchEvent

export type SortStartHandler = (sort: SortStart, event: SortMouseEvent | SortTouchEvent | SortKeyboardEvent) => void

export type SortMoveHandler = (event: SortMouseEvent | SortTouchEvent | SortKeyboardEvent) => void

export type SortEndHandler = (sort: SortEnd, event: SortMouseEvent | SortTouchEvent | SortKeyboardEvent) => void

export type SortOverHandler = (sort: SortOver, event: SortMouseEvent | SortTouchEvent | SortKeyboardEvent) => void

export type HelperContainerGetter = () => HTMLElement

export interface Dimensions {
  width: number
  height: number
}

export interface SortableContainerProps {
  axis?: Axis
  disableAutoscroll?: boolean
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
  updateBeforeSortStart?: SortStartHandler
  onSortStart?: SortStartHandler
  onSortMove?: SortMoveHandler
  onSortEnd?: SortEndHandler
  onSortOver?: SortOverHandler
  useDragHandle?: boolean
  hideSortableGhost?: boolean
  lockToContainerEdges?: boolean
  lockOffset?: Offset | [Offset, Offset]
  getHelperDimensions?: (sort: SortStart) => Dimensions
  helperContainer?: HTMLElement | HelperContainerGetter
}

export interface Config {
  withRef: boolean
}

export type WrappedComponentFactory<P> = (props: P) => JSX.Element

export type WrappedComponent<P> = React.ComponentClass<P> | React.SFC<P> | WrappedComponentFactory<P>

export function arrayMove<T>(collection: T[], previousIndex: number, newIndex: number): T[]
