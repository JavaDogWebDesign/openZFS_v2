import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { createElement } from 'react';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';

interface ConfirmOptions {
  title?: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions>({
    description: '',
  });
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    setOptions(opts);
    setIsOpen(true);
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const handleConfirm = () => {
    setIsOpen(false);
    resolveRef.current?.(true);
    resolveRef.current = null;
  };

  const handleCancel = () => {
    setIsOpen(false);
    resolveRef.current?.(false);
    resolveRef.current = null;
  };

  return createElement(
    ConfirmContext.Provider,
    { value: { confirm } },
    children,
    createElement(ConfirmDialog, {
      open: isOpen,
      title: options.title || 'Confirm',
      description: options.description,
      confirmLabel: options.confirmLabel || 'Confirm',
      cancelLabel: options.cancelLabel || 'Cancel',
      destructive: options.destructive || false,
      onConfirm: handleConfirm,
      onCancel: handleCancel,
    }),
  );
}

export function useConfirm(): ConfirmContextValue {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return context;
}
