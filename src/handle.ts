import { useRef, useEffect, MutableRefObject } from 'react'

export type SortableHandleElement = HTMLElement & {
  sortableHandle: true
}

export const useHandle = (): MutableRefObject<HTMLElement | undefined> => {
  const ref = useRef<HTMLElement>()

  useEffect(() => {
    if (!ref.current) return
    const node = ref.current as SortableHandleElement
    node.sortableHandle = true
  }, [])

  return ref
}

export const isSortableHandle = (node: any): node is SortableHandleElement => !!node.sortableHandle
