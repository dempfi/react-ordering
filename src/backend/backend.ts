import { BackendDelegate } from './backend-delegate'

export enum Motion {
  Fluid,
  Snap
}

export abstract class Backend {
  constructor(protected delegate: BackendDelegate, protected container: HTMLElement) {}

  abstract motion: Motion

  abstract attach(): void
  abstract detach(): void
}
