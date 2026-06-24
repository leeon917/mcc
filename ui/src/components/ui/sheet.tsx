import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

/**
 * Headless modal primitive — centered card with frosted overlay. Closes on
 * overlay click or Escape. We avoid Radix Dialog here on purpose: this app
 * already ships a focused-input bias inside the form, and a portal-only
 * approach keeps bundle size predictable.
 */
interface SheetProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Aria label for the dialog */
  label?: string;
  /** Maximum width override */
  className?: string;
}

export function Sheet({ open, onClose, children, label, className }: SheetProps) {
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <>
      <div className="sheet-overlay" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={cn('sheet-panel sheet-panel-center', className)}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </>,
    document.body
  );
}

export function SheetHeader({
  children,
  onClose,
  accent,
}: {
  children: React.ReactNode;
  onClose?: () => void;
  accent?: string;
}) {
  return (
    <div className="relative px-6 pt-6 pb-4">
      {accent && (
        <div
          className="absolute left-0 right-0 top-0 h-1.5 rounded-t-[26px]"
          style={{ background: accent }}
          aria-hidden
        />
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">{children}</div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-ink-400 transition-colors hover:bg-paper-200 hover:text-ink-900"
          >
            <svg viewBox="0 0 16 16" width="16" height="16" shapeRendering="crispEdges">
              <path d="M4 2 2 4l4 4-4 4 2 2 4-4 4 4 2-2-4-4 4-4-2-2-4 4-4-4Z" fill="currentColor" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

export function SheetBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('px-6 py-3', className)}>{children}</div>;
}

export function SheetFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-center justify-end gap-2 border-t border-paper-300 px-6 py-4', className)}>
      {children}
    </div>
  );
}
