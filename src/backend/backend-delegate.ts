export interface BackendDelegate {
  lift(position: { x: number; y: number }, target: HTMLElement): void
  move(): void
  drop(): void
}
