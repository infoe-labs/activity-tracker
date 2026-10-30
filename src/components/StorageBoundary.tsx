import { Component, type ReactNode } from "react";
export class StorageBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <main className="storage-fallback">
          <h1>A little help getting started.</h1>
          <p>
            Still could not read local storage. Check that this browser allows
            website storage, then try again. Your saved data has not been
            cleared.
          </p>
          <button className="primary-button" onClick={() => location.reload()}>
            Try again
          </button>
        </main>
      );
    return this.props.children;
  }
}
