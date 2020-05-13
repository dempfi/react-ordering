import { SortableElement } from './use-element'

type SortableItem = {
  element: SortableElement
  position?: { x: number; y: number }
  translate?: { x: number; y: number }
}

export class Context {
  readonly items: SortableItem[] = []

  private _active?: { index: number; currentIndex: number }
  private currentIndex?: number
  private originalIndex?: number

  get active() {
    return this._active
  }

  set active(newActive) {
    if (this._active) this.activeItem!.element.sortableInfo.setDragging(false)
    this._active = newActive
    if (newActive) this.activeItem!.element.sortableInfo.setDragging(true)
  }

  moveTo(targetIndex: number) {
    const targetOffset = targetIndex > this.currentIndex! ? 0 : -1
    this.currentIndex = targetIndex + targetOffset

    this.items.sort((left, right) => {
      const trueLeftIndex = left.element.sortableInfo.index
      const trueRightIndex = right.element.sortableInfo.index

      const leftIndex = trueLeftIndex === this.active?.index ? this.currentIndex! + 0.5 : trueLeftIndex
      const rightIndex = trueRightIndex === this.active?.index ? this.currentIndex! + 0.5 : trueRightIndex
      return (leftIndex - rightIndex) * 10
    })
  }

  registerItem(item: SortableItem) {
    this.items.push(item)
  }

  unregisterItem(item: SortableItem) {
    const index = this.items.indexOf(item)
    if (index !== -1) this.items.splice(this.items.indexOf(item), 1)
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
}
