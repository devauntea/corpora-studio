import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./style.css";
import "./workspace-ux.css";

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <div className="fatal">
        <h1>The workspace could not start.</h1>
        <p>Reopen Form Studio. Your saved project files are unchanged.</p>
      </div>
    ) : (
      this.props.children
    );
  }
}
ReactDOM.createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
