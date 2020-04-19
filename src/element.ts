import { useRef, useEffect, useState, MutableRefObject } from 'react'
import { Context } from './context'

import { CollectionKey } from './types'
import { closest } from './utils'
import { isSortableContainerElement } from './SortableContainer'
import { CONTEXT_KEY } from './constants'

export type SortableElement = HTMLElement & {
  sortableInfo: {
    collection: CollectionKey
    disabled?: boolean
    index: number
    manager?: Context
    setDragging: (isDragging: boolean) => void
  }
}

type Options = {
  index: number
  collection?: CollectionKey
  disabled?: boolean
}

type Result = [MutableRefObject<HTMLElement | undefined>, { isDragging: boolean }]

export const useElement = ({ index, collection = 0, disabled }: Options): Result => {
  const elementRef = useRef<SortableElement>()
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    if (!elementRef.current) return
    const element = elementRef.current as SortableElement
    const container = closest(element, isSortableContainerElement)
    const context = container?.[CONTEXT_KEY]

    element.sortableInfo = {
      collection,
      disabled,
      index,
      manager: context,
      setDragging: (dragging: boolean) => {
        setIsDragging(dragging)
      }
    }

    context?.add(collection!, { node: element })
    return () => context?.remove(collection!, { node: element })
  }, [collection])

  useEffect(() => {
    if (!elementRef.current || !elementRef.current.sortableInfo) return
    const element = elementRef.current as SortableElement
    element.sortableInfo.index = index
    element.sortableInfo.disabled = disabled
  }, [index, disabled])

  return [elementRef, { isDragging }]
}

export const isSortableElement = (el: any): el is SortableElement => !!el.sortableInfo
