'use client'

import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  name?: string
}

interface State {
  hasError: boolean
}

export class DashboardWidgetBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: unknown, info: { componentStack?: string | null }) {
    const name = this.props.name ?? 'widget'
    console.error(
      `[Dashboard] ${name} crashed:`,
      error instanceof Error ? error.message : error,
      info?.componentStack?.slice(0, 300),
    )
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          dir="rtl"
          className="flex min-h-[140px] items-center justify-center rounded-2xl border border-dashed border-[var(--border)] bg-[var(--bg-card)] p-4 text-center text-sm text-[var(--text-muted)]"
        >
          این بخش موقتاً بارگذاری نشد
        </div>
      )
    }
    return this.props.children
  }
}
