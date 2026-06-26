import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="bg-rowan-bg min-h-screen px-4 pt-6 pb-24">
          <h1 className="text-rowan-text font-semibold text-lg mb-2">{this.props.title || 'Something went wrong'}</h1>
          <p className="text-rowan-red text-sm mb-4">
            {this.state.error?.message || 'This screen failed to load.'}
          </p>
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="text-rowan-yellow text-sm underline"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
