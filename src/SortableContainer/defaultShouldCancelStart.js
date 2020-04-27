import { NodeType, closest } from '../utils'

export default function defaultShouldCancelStart(element) {
  // Cancel sorting if the event target is an `input`, `textarea`, `select` or `option`
  const interactiveElements = [NodeType.Input, NodeType.Textarea, NodeType.Select, NodeType.Option, NodeType.Button]

  if (interactiveElements.indexOf(element.tagName) !== -1) {
    // Return true to cancel sorting
    return true
  }

  if (closest(element, el => el.contentEditable === 'true')) {
    return true
  }

  return false
}
