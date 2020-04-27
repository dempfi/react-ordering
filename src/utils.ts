export function arrayMove(array, from, to) {
  // Will be deprecated soon. Consumers should install 'array-move' instead
  // https://www.npmjs.com/package/array-move

  if (process.env.NODE_ENV !== 'production') {
    if (typeof console !== 'undefined') {
      // eslint-disable-next-line no-console
      console.warn(
        "Deprecation warning: arrayMove will no longer be exported by 'react-ordering' in the next major release. Please install the `array-move` package locally instead. https://www.npmjs.com/package/array-move"
      )
    }
  }

  array = array.slice()
  array.splice(to < 0 ? array.length + to : to, 0, array.splice(from, 1)[0])

  return array
}

export const omit = <T, K extends keyof T>(obj: T, keys: K | K[]): Omit<T, K> => {
  const clone = { ...obj }
  const keysToOmit = Array.isArray(keys) ? keys : [keys]
  for (const key of keysToOmit) delete clone[key]
  return clone
}

export const vendorPrefix = (function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    // Server environment
    return ''
  }

  // fix for: https://bugzilla.mozilla.org/show_bug.cgi?id=548397
  // window.getComputedStyle() returns null inside an iframe with display: none
  // in this case return an array with a fake mozilla style in it.
  const styles = window.getComputedStyle(document.documentElement, '') || ['-moz-hidden-iframe']
  const pre = (Array.prototype.slice
    .call(styles)
    .join('')
    .match(/-(moz|webkit|ms)-/) ||
    (styles.OLink === '' && ['', 'o']))[1]

  switch (pre) {
    case 'ms':
      return 'ms'
    default:
      return pre && pre.length ? pre[0].toUpperCase() + pre.substr(1) : ''
  }
})()

export function setInlineStyles(node, styles) {
  Object.keys(styles).forEach(key => {
    node.style[key] = styles[key]
  })
}

export function setTranslate3d(node, translate) {
  node.style[`${vendorPrefix}Transform`] = translate == null ? '' : `translate3d(${translate.x}px,${translate.y}px,0)`
}

export function setTransitionDuration(node, duration) {
  node.style[`${vendorPrefix}TransitionDuration`] = duration == null ? '' : `${duration}ms`
}

export function setTransition(node, transition) {
  node.style[`${vendorPrefix}Transition`] = transition
}

export function closest<T>(el: HTMLElement, fn: (el: any) => el is T): T | undefined {
  if (!el) return
  if (fn(el)) return el
  return closest<T>(el.parentNode as HTMLElement, fn)
}

export const clamp = (min: number, max: number, value: number) => Math.max(min, Math.min(value, max))

function getPixelValue(stringValue: string) {
  if (stringValue.substr(-2) === 'px') {
    return parseFloat(stringValue)
  }

  return 0
}

export function getElementMargin(element: Element) {
  const style = window.getComputedStyle(element)

  return {
    bottom: getPixelValue(style.marginBottom),
    left: getPixelValue(style.marginLeft),
    right: getPixelValue(style.marginRight),
    top: getPixelValue(style.marginTop)
  }
}

export function provideDisplayName<T>(prefix: string, Component: React.ComponentType<T>) {
  const componentName = Component.displayName || Component.name
  return componentName ? `${prefix}(${componentName})` : prefix
}

export function getScrollAdjustedBoundingClientRect(node: HTMLElement, scrollDelta: { top: number; left: number }) {
  const boundingClientRect = node.getBoundingClientRect()

  return {
    top: boundingClientRect.top + scrollDelta.top,
    left: boundingClientRect.left + scrollDelta.left
  }
}

export function getEdgeOffset(
  node: HTMLElement,
  parent?: HTMLElement,
  offset = { left: 0, top: 0 }
): { left: number; top: number } {
  if (!node) {
    return undefined
  }

  // Get the actual offsetTop / offsetLeft value, no matter how deep the node is nested
  const nodeOffset = {
    left: offset.left + node.offsetLeft,
    top: offset.top + node.offsetTop
  }

  if (node.parentNode === parent) {
    return nodeOffset
  }

  return getEdgeOffset(node.parentNode as HTMLElement, parent, nodeOffset)
}

export const isScrollableElement = (el: HTMLElement): el is HTMLElement => {
  if ((el as any) === document) return false
  const computedStyle = window.getComputedStyle(el)
  const overflowRegex = /(auto|scroll)/
  const properties = ['overflow', 'overflowX', 'overflowY'] as ['overflow', 'overflowX', 'overflowY']
  return !!properties.find(property => overflowRegex.test(computedStyle[property]))
}

export function getContainerGridGap(element: HTMLElement) {
  const style = window.getComputedStyle(element)

  if (style.display === 'grid') {
    return {
      x: getPixelValue(style.gridColumnGap),
      y: getPixelValue(style.gridRowGap)
    }
  }

  return { x: 0, y: 0 }
}

export const KEYCODE = {
  TAB: 9,
  ESC: 27,
  SPACE: 32,
  LEFT: 37,
  UP: 38,
  RIGHT: 39,
  DOWN: 40
}

export const NodeType = {
  Anchor: 'A',
  Button: 'BUTTON',
  Canvas: 'CANVAS',
  Input: 'INPUT',
  Option: 'OPTION',
  Textarea: 'TEXTAREA',
  Select: 'SELECT'
}

export function getTargetIndex(newIndex, prevIndex, oldIndex) {
  if (newIndex < oldIndex && newIndex > prevIndex) {
    return newIndex - 1
  } else if (newIndex > oldIndex && newIndex < prevIndex) {
    return newIndex + 1
  } else {
    return newIndex
  }
}
