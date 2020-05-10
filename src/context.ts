import { SortableElement } from './use-element'

type SortableItem = {
  element: SortableElement
  position?: { x: number; y: number }
  translate?: { x: number; y: number }
}

export class Context {
  private items: SortableItem[] = []
  private _active?: { index: number; currentIndex: number }

  get active() {
    return this._active
  }

  set active(newActive) {
    if (this._active) this.activeItem!.element.sortableInfo.setDragging(false)
    this._active = newActive
    if (newActive) this.activeItem!.element.sortableInfo.setDragging(true)
  }

  add(ref: SortableItem) {
    this.items.push(ref)
  }

  remove(ref: SortableItem) {
    const index = this.findIndex(ref)

    if (index !== -1) {
      this.items.splice(index, 1)
    }
  }

  private get activeItem() {
    return this.nodeAtIndex(this.active?.index)
  }

  nodeAtIndex(index?: number) {
    return this.items.find(
      // eslint-disable-next-line eqeqeq
      ({ element: node }) => node.sortableInfo.index == index
    )
  }

  findIndex(ref: SortableItem) {
    return this.items.indexOf(ref)
  }

  getOrderedRefs() {
    return this.items.sort(sortByIndex)
  }
}

function sortByIndex(
  {
    element: {
      sortableInfo: { index: index1 }
    }
  }: SortableItem,
  {
    element: {
      sortableInfo: { index: index2 }
    }
  }: SortableItem
) {
  return index1 - index2
}
