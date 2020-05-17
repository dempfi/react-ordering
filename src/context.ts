import { Sortable } from './sortable'

export class Context {
  readonly sortables: Sortable[] = []

  private _active?: { index: number; currentIndex: number }

  private currentIndex?: number

  private originalIndex?: number

  get active() {
    return this._active
  }

  set active(newActive) {
    // if (this._active) this.activeItem!.element.sortableInfo.setDragging(false)
    this._active = newActive
    // if (newActive) this.activeItem!.element.sortableInfo.setDragging(true)
  }

  moveTo(targetIndex: number) {
    const targetOffset = targetIndex > this.currentIndex! ? 0 : -1
    this.currentIndex = targetIndex + targetOffset

    this.sortables.sort((left, right) => {
      const leftIndex = left.index === this.active?.index ? this.currentIndex! + 0.5 : left.index
      const rightIndex = right.index === this.active?.index ? this.currentIndex! + 0.5 : right.index
      return (leftIndex - rightIndex) * 10
    })
  }

  registerSortable(item: Sortable) {
    this.sortables.push(item)
  }

  unregisterSortable(item: Sortable) {
    const index = this.sortables.indexOf(item)
    if (index !== -1) this.sortables.splice(this.sortables.indexOf(item), 1)
  }

  private get activeItem() {
    return this.nodeAtIndex(this.active?.index)
  }

  nodeAtIndex(index?: number) {
    return this.sortables.find(s => s.index === index)
  }
}
