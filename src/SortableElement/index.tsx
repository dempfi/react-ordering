import React from 'react';
import {findDOMNode} from 'react-dom';
import invariant from 'invariant';
import {ManagerContext, Manager} from '../Manager';

import {provideDisplayName, omit} from '../utils';
import {WrappedComponent, SortableElementProps, SortableNode} from '../types';

const omittedProps = ['index', 'collection', 'disabled'];

export default function sortableElement<P extends {isDragging: boolean}>(
  WrappedComponent: WrappedComponent<P>,
  config = {withRef: false},
) {
  return class extends React.Component<
    SortableElementProps,
    {dragging: boolean}
  > {
    static displayName = provideDisplayName(
      'sortableElement',
      WrappedComponent,
    );

    static contextType = ManagerContext;

    static defaultProps = {
      collection: 0,
    };

    node!: SortableNode;
    ref!: {node: SortableNode};

    state = {dragging: false};

    componentDidMount() {
      this.register();
    }

    componentDidUpdate(prevProps: SortableElementProps) {
      if (this.node) {
        if (prevProps.index !== this.props.index) {
          this.node.sortableInfo.index = this.props.index;
        }

        if (prevProps.disabled !== this.props.disabled) {
          this.node.sortableInfo.disabled = this.props.disabled;
        }
      }

      if (prevProps.collection !== this.props.collection) {
        this.unregister(prevProps.collection);
        this.register();
      }
    }

    componentWillUnmount() {
      this.unregister();
    }

    register() {
      const {collection, disabled, index} = this.props;
      const node = findDOMNode(this) as SortableNode;

      node.sortableInfo = {
        collection: collection!,
        disabled,
        index,
        manager: this.context.manager,
        setDragging: (dragging: boolean) => {
          if (this.state.dragging !== dragging) this.setState({dragging});
        },
      };

      this.node = node;
      this.ref = {node};

      this.context.manager.add(collection, this.ref);
    }

    unregister(collection = this.props.collection) {
      this.context.manager.remove(collection, this.ref);
    }

    getWrappedInstance() {
      invariant(
        config.withRef,
        'To access the wrapped instance, you need to pass in {withRef: true} as the second argument of the SortableElement() call',
      );
      return this.refs.wrappedInstance;
    }

    render() {
      const ref = config.withRef ? 'wrappedInstance' : null;
      return (
        <WrappedComponent
          ref={ref}
          {...omit(this.props, omittedProps)}
          isDragging={this.state.dragging}
        />
      );
    }
  };
}
