/**
 * App Component
 * 
 * Root application component that composes all main components
 * and handles initial setup including error boundaries.
 */

import { useEffect, useState } from 'react'
import { MainLayout } from './components/Layout/MainLayout.js'

/**
 * Error boundary fallback component
 */
function ErrorFallback({ error }: { error: Error }) {
  return (
    <div className="h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-lg">
        <h1 className="text-2xl font-bold text-red-600 mb-4">Something went wrong</h1>
        <p className="text-gray-600 mb-4">
          The application encountered an unexpected error. Please refresh the page to try again.
        </p>
        <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto max-h-40">
          {error.message}
        </pre>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          Refresh Page
        </button>
      </div>
    </div>
  )
}

/**
 * Simple error boundary wrapper using hooks
 */
function ErrorBoundary({ children }: { children: React.ReactNode }) {
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      setError(event.error)
      event.preventDefault()
    }

    window.addEventListener('error', handleError)
    return () => window.removeEventListener('error', handleError)
  }, [])

  if (error) {
    return <ErrorFallback error={error} />
  }

  return <>{children}</>
}

/**
 * Main App component
 * 
 * Composes the MainLayout and wraps it with error handling.
 */
function App() {
  const [hasError, setHasError] = useState<Error | null>(null)
  
  useEffect(() => {
    // Catch unhandled promise rejections
    const handleRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled promise rejection:', event.reason)
      setHasError(new Error(event.reason?.message || String(event.reason)))
    }
    
    window.addEventListener('unhandledrejection', handleRejection)
    return () => window.removeEventListener('unhandledrejection', handleRejection)
  }, [])
  
  if (hasError) {
    return <ErrorFallback error={hasError} />
  }
  
  return (
    <ErrorBoundary>
      <MainLayout />
    </ErrorBoundary>
  )
}

export default App
