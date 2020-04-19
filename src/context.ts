import { CollectionKey } from './types'
import { SortableElement } from './element'

type SortableItem = {
  node: SortableElement
  edgeOffset?: { left: number; top: number }
  boundingClientRect?: { left: number; top: number }
  translate?: { x: number; y: number }
}

export class Context {
  private items: Record<CollectionKey, SortableItem[]> = {}
  private _active?: { collection: CollectionKey; index: number }

  get active() {
    return this._active
  }

  set active(newActive) {
    if (this._active) this.getActive()!.node.sortableInfo.setDragging(false)
    this._active = newActive
    if (newActive) this.getActive()!.node.sortableInfo.setDragging(true)
  }

  add(collection: CollectionKey, ref: SortableItem) {
    if (!this.items[collection]) {
      this.items[collection] = []
    }

    this.items[collection].push(ref)
  }

  remove(collection: CollectionKey, ref: SortableItem) {
    const index = this.findIndex(collection, ref)

    if (index !== -1) {
      this.items[collection].splice(index, 1)
    }
  }

  isActive() {
    return this.active
  }

  getActive() {
    return this.nodeAtIndex(this.active?.index)
  }

  nodeAtIndex(index?: number, collection = this.active?.collection!) {
    return this.items[collection].find(
      // eslint-disable-next-line eqeqeq
      ({ node }) => node.sortableInfo.index == index
    )
  }

  findIndex(collection: CollectionKey, ref: SortableItem) {
    return this.items[collection].indexOf(ref)
  }

  getOrderedRefs(collection = this.active?.collection!) {
    return this.items[collection].sort(sortByIndex)
  }

  getRefs(collection = this.active?.collection!) {
    return this.items[collection]
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
