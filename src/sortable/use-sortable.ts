import { useRef, useEffect, useState, MutableRefObject } from 'react'

import { closest } from '../utils'
import { Sorter } from '../sorter'
import { CONTEXT_KEY } from '../constants'
import { Sortable } from './sortable'
import { Context } from '../context'

type Options = {
  index: number
  disabled?: boolean
}

type Result = [MutableRefObject<HTMLElement | undefined>, { isDragging: boolean }]

export const useSortable = ({ index, disabled }: Options): Result => {
  const ref = useRef<HTMLElement>()
  const [context, setContext] = useState<Context>()
  const [isDragging, setIsDragging] = useState(false)

  useEffect(
    () =>
      Context.subscribe(() => {
        if (!ref.current) return
        const element = ref.current
        const container = closest(element, Sorter.isAttachedTo)
        setContext(container?.[CONTEXT_KEY])
      }),
    []
  )

  useEffect(() => {
    if (!ref.current) return
    const sortable = new Sortable(ref.current, index, disabled, context)
    context?.register(sortable)
    return () => context?.unregister(sortable)
  }, [context])

  useEffect(() => {
    if (!ref.current || !Sortable.isAttachedTo(ref.current)) return
    const sortable = Sortable.of(ref.current)!
    sortable.index = index
    sortable.disabled = !!disabled
  }, [index, disabled])

  return [ref, { isDragging }]
}
