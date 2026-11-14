import React, { useState } from 'react';
import { WifiOff, AlertTriangle, RefreshCw, Loader2, X } from 'lucide-react';

export interface NetworkErrorState {
  title: string;
  message: string;
  isNetworkError?: boolean;
  retryLabel?: string;
  onRetry?: () => Promise<void> | void;
}

interface NetworkErrorBannerProps {
  error: NetworkErrorState | null;
  onDismiss?: () => void;
  className?: string;
}

export const NetworkErrorBanner: React.FC<NetworkErrorBannerProps> = ({
  error,
  onDismiss,
  className = ''
}) => {
  const [isRetrying, setIsRetrying] = useState(false);

  if (!error) return null;

  const handleRetryClick = async () => {
    if (!error.onRetry || isRetrying) return;
    setIsRetrying(true);
    try {
      await error.onRetry();
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`bg-rose-50 border border-rose-300 rounded-xl p-3.5 text-rose-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${className}`}
    >
      <div className="flex items-start gap-2.5 min-w-0">
        <div className="p-2 rounded-lg bg-rose-100 text-rose-700 shrink-0 mt-0.5">
          {error.isNetworkError ? (
            <WifiOff className="w-4 h-4" />
          ) : (
            <AlertTriangle className="w-4 h-4" />
          )}
        </div>
        <div className="min-w-0 space-y-0.5">
          <div className="text-xs font-bold text-rose-950">{error.title}</div>
          <p className="text-xs text-rose-800 leading-relaxed break-words">
            {error.message}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
        {error.onRetry && (
          <button
            type="button"
            onClick={handleRetryClick}
            disabled={isRetrying}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:opacity-70 text-white text-xs font-bold transition cursor-pointer whitespace-nowrap shrink-0"
          >
            {isRetrying ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Mencoba Ulang...</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{error.retryLabel || 'Coba Lagi'}</span>
              </>
            )}
          </button>
        )}

        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            disabled={isRetrying}
            title="Tutup peringatan"
            className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg border border-rose-300 bg-white hover:bg-rose-100 text-rose-800 text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0"
          >
            <X className="w-3.5 h-3.5" />
            <span>Tutup</span>
          </button>
        )}
      </div>
    </div>
  );
};
