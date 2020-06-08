import React from 'react'
import { useSortable } from '../../../../src'

import styles from './Item.scss'

function Item({ children, ...rest }) {
  const [ref] = useSortable(rest)

  return (
    <div className={styles.root} tabIndex={0} ref={ref}>
      {children}
    </div>
  )
}

export default Item
