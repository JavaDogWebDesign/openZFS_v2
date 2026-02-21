import { useState } from 'react';
import { X } from 'lucide-react';
import { RaidWizard } from '@/components/wizard/RaidWizard';

interface PoolCreateWizardProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function PoolCreateWizard({ open, onClose, onCreated }: PoolCreateWizardProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Dialog */}
      <div className="relative z-50 flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-border bg-card shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-card-foreground">Create New Pool</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Wizard body */}
        <div className="flex-1 overflow-y-auto p-6">
          <RaidWizard
            onComplete={() => {
              onCreated();
              onClose();
            }}
            onCancel={onClose}
          />
        </div>
      </div>
    </div>
  );
}
