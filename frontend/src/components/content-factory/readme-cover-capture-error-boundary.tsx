import { Component, type ErrorInfo, type ReactNode } from "react"

type Props = {
  children: ReactNode
}

type State = {
  error: Error | null
}

/** 离屏封面 Host 崩溃时兜底，避免拖垮整页 */
export class ReadmeCoverCaptureErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error("[ReadmeCoverCaptureHost]", error, info.componentStack)
    }
  }

  render() {
    if (this.state.error) {
      return null
    }
    return this.props.children
  }
}
