import { useRef, useEffect } from 'react'
import { Settings, Options } from '../settings'
import { Sorter } from './sorter'

export const useSorter = (options: Options) => {
  const ref = useRef<HTMLElement>()
  const sorter = useRef(new Sorter(options))

  useEffect(() => {
    if (!ref.current) return
    console.log(ref.current)
    sorter.current.attach(ref.current)
    return () => sorter.current.detach()
  }, [])

  return ref
}
