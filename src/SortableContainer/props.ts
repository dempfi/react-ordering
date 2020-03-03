import {KEYCODE} from '../utils';
import defaultGetHelperDimensions from './defaultGetHelperDimensions';
import defaultShouldCancelStart from './defaultShouldCancelStart';

export const orderingProps = [
  'axis',
  'contentWindow',
  'disableAutoscroll',
  'distance',
  'dropAnimationDuration',
  'dropAnimationEasing',
  'getContainer',
  'getHelperDimensions',
  'helperClass',
  'helperStyle',
  'helperContainer',
  'hideSortableGhost',
  'keyboardSortingTransitionDuration',
  'lockAxis',
  'lockOffset',
  'lockToContainerEdges',
  'onSortEnd',
  'onSortMove',
  'onSortOver',
  'onSortStart',
  'pressDelay',
  'pressThreshold',
  'keyCodes',
  'shouldCancelStart',
  'outOfTheWayAnimationEasing',
  'outOfTheWayAnimationDuration',
  'updateBeforeSortStart',
  'useDragHandle',
  'useWindowAsScrollContainer',
];

export const defaultKeyCodes = {
  lift: [KEYCODE.SPACE],
  drop: [KEYCODE.SPACE],
  cancel: [KEYCODE.ESC],
  up: [KEYCODE.UP, KEYCODE.LEFT],
  down: [KEYCODE.DOWN, KEYCODE.RIGHT],
};

export const defaultProps = {
  axis: 'y',
  disableAutoscroll: false,
  distance: 0,
  dropAnimationDuration: 250,
  dropAnimationEasing: 'cubic-bezier(.2,1,.1,1)',
  outOfTheWayAnimationEasing: 'cubic-bezier(0.2, 0, 0, 1)',
  outOfTheWayAnimationDuration: 200,
  getHelperDimensions: defaultGetHelperDimensions,
  hideSortableGhost: true,
  lockOffset: '50%',
  lockToContainerEdges: false,
  pressDelay: 0,
  pressThreshold: 5,
  keyCodes: defaultKeyCodes,
  shouldCancelStart: defaultShouldCancelStart,
  useWindowAsScrollContainer: false,
};
