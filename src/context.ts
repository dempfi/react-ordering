import { Sortable } from './sortable'

type Listener = () => void

export class Context {
  private static listeners: Listener[] = []

  static subscribe(fn: () => void) {
    this.listeners.push(fn)
    return () => {
      Context.listeners = this.listeners.filter(l => l !== fn)
    }
  }

  notify() {
    Context.listeners.forEach(fn => fn())
  }

  readonly sortables: Sortable[] = []

  get active() {
    return this._active
  }

  private _active?: Sortable

  moveActiveTo(targetIndex: number) {
    const targetOffset = targetIndex > this.active!.newIndex ? 0 : -1
    this.active!.newIndex = targetIndex + targetOffset

    this.sortables.sort((left, right) => {
      const leftIndex = left.isActive ? left.newIndex + 0.5 : left.index
      const rightIndex = right.isActive ? right.newIndex + 0.5 : right.index
      return (leftIndex - rightIndex) * 10
    })
  }

  activate(sortable: Sortable) {
    this._active = sortable
    this._active.activate()
  }

  deactivate() {
    this._active!.deactivate()
    this._active = undefined
  }

  register(sortable: Sortable) {
    this.sortables.push(sortable)
  }

  unregister(sortable: Sortable) {
    const index = this.sortables.indexOf(sortable)
    if (index !== -1) this.sortables.splice(this.sortables.indexOf(sortable), 1)
  }
}
