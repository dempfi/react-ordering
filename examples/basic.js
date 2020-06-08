import React, { Component } from 'react'
import { render } from 'react-dom'
import { sortableContainer, useSortable } from 'react-ordering'
import arrayMove from 'array-move'

const SortableItem = ({ value, index }) => {
  const [ref] = useSortable({ index })
  return <li ref={ref}>{value}</li>
}

const SortableContainer = sortableContainer(({ children }) => {
  return <ul>{children}</ul>
})

class App extends Component {
  state = {
    items: ['Item 1', 'Item 2', 'Item 3', 'Item 4', 'Item 5', 'Item 6']
  }

  onEnd = ({ oldIndex, newIndex }) => {
    this.setState(({ items }) => ({
      items: arrayMove(items, oldIndex, newIndex)
    }))
  }

  render() {
    const { items } = this.state

    return (
      <SortableContainer onEnd={this.onEnd}>
        {items.map((value, index) => (
          <SortableItem key={`item-${value}`} index={index} value={value} />
        ))}
      </SortableContainer>
    )
  }
}

render(<App />, document.getElementById('root'))
