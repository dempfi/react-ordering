import { useRef, useEffect, useContext, useState, MutableRefObject } from 'react'
import { ManagerContext } from './manager'

import { SortableNode, CollectionKey } from './types'

export const isSortableNode = (node: any): node is SortableNode => !!node.sortableInfo

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
    if (!ref.current) return
    const node = ref.current as SortableNode

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
  }, [collection])

  useEffect(() => {
    if (!ref.current) return
    const node = ref.current as SortableNode
    node.sortableInfo.index = index
    node.sortableInfo.disabled = disabled
  }, [index, disabled])

  return [ref, { isDragging }]
}
