import { useRef, useEffect, useState, MutableRefObject } from 'react'

import { closest } from '../utils'
import { isSortableContainerElement } from '../SortableContainer'
import { CONTEXT_KEY } from '../constants'
import { Sortable } from './sortable'

type Options = {
  index: number
  disabled?: boolean
}

type Result = [MutableRefObject<HTMLElement | undefined>, { isDragging: boolean }]

export const useSortable = ({ index, disabled }: Options): Result => {
  const ref = useRef<HTMLElement>()
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    if (!ref.current) return
    const element = ref.current
    const container = closest(element, isSortableContainerElement)
    const context = container?.[CONTEXT_KEY]
    const sortable = new Sortable(element, index, disabled, context)
    context?.registerSortable(sortable)
    return () => context?.unregisterSortable(sortable)
  }, [])

  useEffect(() => {
    if (!ref.current || !Sortable.attachedTo(ref.current)) return
    const sortable = Sortable.of(ref.current)!
    sortable.index = index
    sortable.disabled = !!disabled
  }, [index, disabled])

  return [ref, { isDragging }]
}
