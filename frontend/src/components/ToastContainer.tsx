import { useUIStore } from '../stores/uiStore';
import { cn } from '../lib/utils';

export function ToastContainer() {
  const { toasts, removeToast } = useUIStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            'card p-4 min-w-[300px] shadow-xl animate-slide-in',
            toast.type === 'success' && 'border-l-4 border-success',
            toast.type === 'error' && 'border-l-4 border-error',
            toast.type === 'warning' && 'border-l-4 border-warning',
            toast.type === 'info' && 'border-l-4 border-info'
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <p className="text-sm font-medium">{toast.message}</p>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-muted hover:text-foreground transition-colors"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
