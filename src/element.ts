import { useRef, useEffect, useContext, useState, MutableRefObject } from 'react'
import { ManagerContext, Manager } from './manager'

import { CollectionKey } from './types'

export type SortableElement = HTMLElement & {
  sortableInfo: {
    collection: CollectionKey
    disabled?: boolean
    index: number
    manager: Manager
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
  const ref = useRef<HTMLElement>()
  const context = useContext(ManagerContext)
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    if (!ref.current || !context.manager) return
    const node = ref.current as SortableElement

    node.sortableInfo = {
      collection,
      disabled,
      index,
      manager: context.manager,
      setDragging: (dragging: boolean) => {
        setIsDragging(dragging)
      }
    }

    context.manager?.add(collection!, { node })
    return () => context.manager?.remove(collection!, { node })
  }, [collection, context.manager])

  useEffect(() => {
    if (!ref.current || !ref.current.sortableInfo) return
    const node = ref.current as SortableElement
    node.sortableInfo.index = index
    node.sortableInfo.disabled = disabled
  }, [index, disabled])

  return [ref, { isDragging }]
}

export const isSortableNode = (node: any): node is SortableElement => !!node.sortableInfo
