import { Component, type ReactNode } from 'react'
import { exportBackup } from '@/lib/backup'

interface Props {
  children: ReactNode
}
interface State {
  error: Error | null
}

/**
 * Top-level crash guard. A render error anywhere below would otherwise leave a
 * blank white screen with no way out; instead we show a recovery panel that
 * lets the user export their data (local-first, so nothing is lost) and reload.
 * Deliberately dependency-light — no i18n, stores, or router — so the fallback
 * stays up even when those are what failed.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: unknown) {
    // Surface details in the console for debugging / bug reports.
    console.error('App crashed:', error, info)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center gap-4 px-6 py-16 text-center">
        <h1 className="text-xl font-bold">Something went wrong</h1>
        <p className="text-sm text-muted">
          The app hit an unexpected error. Your data is stored on this device and is safe — you can
          export a backup before reloading.
        </p>

        <div className="flex w-full flex-col gap-2">
          <button
            className="btn-ghost"
            onClick={() => {
              exportBackup().catch((e) => console.error('Backup failed:', e))
            }}
          >
            Export my data
          </button>
          <button className="btn-primary" onClick={() => window.location.reload()}>
            Reload app
          </button>
        </div>

        <details className="mt-2 w-full text-left">
          <summary className="cursor-pointer text-xs text-muted">Error details</summary>
          <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-surface-2 p-3 text-[11px] text-muted">
            {error.message}
            {error.stack ? '\n\n' + error.stack : ''}
          </pre>
        </details>
      </div>
    )
  }
}
