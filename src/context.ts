import { SortableElement } from './element'

type SortableItem = {
  node: SortableElement
  edgeOffset?: { left: number; top: number }
  boundingClientRect?: { left: number; top: number }
  translate?: { x: number; y: number }
}

export class Context {
  private items: SortableItem[] = []
  private _active?: { index: number }

  get active() {
    return this._active
  }

  set active(newActive) {
    if (this._active) this.getActive()!.node.sortableInfo.setDragging(false)
    this._active = newActive
    if (newActive) this.getActive()!.node.sortableInfo.setDragging(true)
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

  isActive() {
    return this.active
  }

  getActive() {
    return this.nodeAtIndex(this.active?.index)
  }

  nodeAtIndex(index?: number) {
    return this.items.find(
      // eslint-disable-next-line eqeqeq
      ({ node }) => node.sortableInfo.index == index
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
    node: {
      sortableInfo: { index: index1 }
    }
  }: SortableItem,
  {
    node: {
      sortableInfo: { index: index2 }
    }
  }: SortableItem
) {
  return index1 - index2
}
