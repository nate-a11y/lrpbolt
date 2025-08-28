import { Component } from 'react';

import logError from '../utils/logError.js';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, err: null };
  }
  static getDerivedStateFromError(error) { return { hasError: true, err: error }; }
  componentDidCatch(error, info) { logError(error, 'ErrorBoundary'); console.error(info); }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 16 }}>
          <h2>Something went wrong.</h2>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{String(this.state.err?.message || this.state.err)}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}
