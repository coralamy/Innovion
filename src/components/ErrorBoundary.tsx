'use client';
import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { logger } from '@/lib/logger';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorId: string | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  pageName?: string;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorId: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    const errorId = `err_${Date.now()}`;
    return { hasError: true, error, errorId };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    const errorId = this.state.errorId ?? `err_${Date.now()}`;
    logger.error(
      'ErrorBoundary',
      `Unhandled React error${this.props.pageName ? ` on ${this.props.pageName}` : ''}`,
      {
        errorId,
        page: this.props.pageName ?? 'unknown',
        componentStack: info.componentStack?.slice(0, 500) ?? '',
      },
      error
    );
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex flex-col items-center justify-center py-24 text-center px-4">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
            style={{ backgroundColor: 'var(--danger-bg)' }}
          >
            <AlertTriangle size={24} style={{ color: 'var(--danger)' }} />
          </div>
          <h2 className="text-lg font-700 text-foreground">Something went wrong</h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-sm">
            {this.props.pageName
              ? `The ${this.props.pageName} page encountered an error.`
              : 'This page encountered an unexpected error.'}{' '}
            Please try refreshing.
          </p>
          {this.state.error && (
            <p
              className="text-xs text-muted-foreground mt-2 font-mono px-4 py-2 rounded-lg max-w-sm truncate"
              style={{ backgroundColor: 'var(--secondary)' }}
            >
              {this.state.error.message}
            </p>
          )}
          {this.state.errorId && (
            <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)', opacity: 0.6 }}>
              Ref: {this.state.errorId}
            </p>
          )}
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null, errorId: null });
              window.location.reload();
            }}
            className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-600 text-white transition-all hover:opacity-90"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            <RefreshCw size={14} />
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
