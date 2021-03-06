import React from 'react'
import { SortableNode, CollectionKey } from './types'

type Ref = {
  node: SortableNode
  edgeOffset?: { left: number; top: number }
  boundingClientRect?: { left: number; top: number }
  translate?: { x: number; y: number }
}

export class Manager {
  refs: Record<CollectionKey, Ref[]> = {}
  isKeySorting: boolean = false
  private _active?: { collection: CollectionKey; index: number }

  get active() {
    return this._active
  }

  set active(newActive) {
    if (this._active) this.getActive()!.node.sortableInfo.setDragging(false)
    this._active = newActive
    if (newActive) this.getActive()!.node.sortableInfo.setDragging(true)
  }

  add(collection: CollectionKey, ref: Ref) {
    if (!this.refs[collection]) {
      this.refs[collection] = []
    }

    this.refs[collection].push(ref)
  }

  remove(collection: CollectionKey, ref: Ref) {
    const index = this.findIndex(collection, ref)

    if (index !== -1) {
      this.refs[collection].splice(index, 1)
    }
  }

  isActive() {
    return this.active
  }

  getActive() {
    return this.nodeAtIndex(this.active?.index)
  }

  nodeAtIndex(index?: number, collection = this.active?.collection!) {
    return this.refs[collection].find(
      // eslint-disable-next-line eqeqeq
      ({ node }) => node.sortableInfo.index == index
    )
  }

  findIndex(collection: CollectionKey, ref: Ref) {
    return this.refs[collection].indexOf(ref)
  }

  getOrderedRefs(collection = this.active?.collection!) {
    return this.refs[collection].sort(sortByIndex)
  }

  getRefs(collection = this.active?.collection!) {
    return this.refs[collection]
  }
}

function sortByIndex(
  {
    node: {
      sortableInfo: { index: index1 }
    }
  }: Ref,
  {
    node: {
      sortableInfo: { index: index2 }
    }
  }: Ref
) {
  return index1 - index2
}

export const ManagerContext = React.createContext<{ manager?: Manager }>({
  manager: undefined
})
