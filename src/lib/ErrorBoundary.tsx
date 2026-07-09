import React from "react";
import { tr } from "@/i18n";
import { classifyError } from "./errors";
import { ErrorNotice } from "../modules/common";
import { useTheme } from "../theme/ThemeContext";

interface BoundaryState {
  error: unknown | null;
}

class Boundary extends React.Component<
  { fallback: (error: unknown, reset: () => void) => React.ReactNode; children: React.ReactNode },
  BoundaryState
> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): BoundaryState {
    return { error };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error("[geyma] module crashed:", error, info.componentStack);
  }

  render() {
    if (this.state.error !== null) {
      return this.props.fallback(this.state.error, () => this.setState({ error: null }));
    }
    return this.props.children;
  }
}

/**
 * Wraps one module so a render crash degrades to that panel showing an ErrorNotice
 * (with a "Reload panel" reset) instead of unmounting the whole app. Mounted around
 * every module by Zone.tsx.
 */
export function ModuleErrorBoundary({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return (
    <Boundary
      fallback={(error, reset) => (
        <ErrorNotice
          t={t}
          message={tr("ui.app.panel_crashed")}
          detail={classifyError(error).message}
          onRetry={reset}
          retryLabel={tr("ui.app.reload_panel")}
        />
      )}>
      {children}
    </Boundary>
  );
}
