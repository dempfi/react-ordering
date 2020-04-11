import React from 'react'
import { useElement } from '../../../../src'

import styles from './Item.scss'

function Item({ children, ...rest }) {
  const [ref] = useElement(rest)

  return (
    <div className={styles.root} tabIndex={0} ref={ref}>
      {children}
    </div>
  )
}

export default Item
