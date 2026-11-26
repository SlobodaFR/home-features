import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';

type Tone = 'info' | 'error';
interface ToastItem {
  id: number;
  message: string;
  tone: Tone;
}

interface ToastApi {
  notify: (message: string, tone?: Tone) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const notify = useCallback((message: string, tone: Tone = 'info') => {
    const id = nextId.current++;
    setToasts((current) => [...current, { id, message, tone }]);
    window.setTimeout(
      () => setToasts((current) => current.filter((t) => t.id !== id)),
      tone === 'error' ? 8000 : 4000,
    );
  }, []);

  const api = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-sm p-gutter pb-[max(16px,env(safe-area-inset-bottom))]"
      >
        {toasts.map((toast) => (
          <p
            key={toast.id}
            className={`pointer-events-auto max-w-md rounded-full bg-ink px-xl py-md font-body-sm text-body-sm text-on-primary shadow-[0_0_0_1px_var(--color-hairline)] ${
              toast.tone === 'error' ? 'border-2 border-error' : ''
            }`}
          >
            {toast.message}
          </p>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
