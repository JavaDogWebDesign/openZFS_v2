import { useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';
import type { Disk } from '@zfs-manager/shared';
import { cn } from '@/lib/utils';
import { poolApi } from '@/api/endpoints';
import { DiskSelection } from './steps/DiskSelection';
import { RaidTypeSelect } from './steps/RaidTypeSelect';
import { VdevLayout } from './steps/VdevLayout';
import { PoolOptions } from './steps/PoolOptions';
import { DatasetSetup } from './steps/DatasetSetup';
import { ReviewConfirm } from './steps/ReviewConfirm';

export interface WizardState {
  selectedDisks: Disk[];
  raidType: string;
  vdevCount: number;
  poolName: string;
  ashift: string;
  compression: string;
  featureFlags: Record<string, boolean>;
  datasetName: string;
  datasetCompression: string;
  datasetQuota: string;
}

const initialState: WizardState = {
  selectedDisks: [],
  raidType: '',
  vdevCount: 1,
  poolName: '',
  ashift: '12',
  compression: 'lz4',
  featureFlags: {},
  datasetName: '',
  datasetCompression: 'lz4',
  datasetQuota: '',
};

interface Step {
  id: string;
  label: string;
}

const STEPS: Step[] = [
  { id: 'disks', label: 'Select Disks' },
  { id: 'raid', label: 'RAID Type' },
  { id: 'layout', label: 'VDEV Layout' },
  { id: 'options', label: 'Pool Options' },
  { id: 'dataset', label: 'Dataset Setup' },
  { id: 'review', label: 'Review' },
];

interface RaidWizardProps {
  onComplete: () => void;
  onCancel: () => void;
}

export function RaidWizard({ onComplete, onCancel }: RaidWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [state, setState] = useState<WizardState>(initialState);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateState = useCallback((updates: Partial<WizardState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  const canGoNext = (): boolean => {
    switch (currentStep) {
      case 0: return state.selectedDisks.length > 0;
      case 1: return !!state.raidType;
      case 2: return true;
      case 3: return !!state.poolName;
      case 4: return true;
      case 5: return true;
      default: return false;
    }
  };

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const disksPerVdev = Math.floor(state.selectedDisks.length / state.vdevCount);
      const vdevs: Array<{ type: string; disks: string[] }> = [];
      for (let i = 0; i < state.vdevCount; i++) {
        const start = i * disksPerVdev;
        const end = i === state.vdevCount - 1 ? state.selectedDisks.length : start + disksPerVdev;
        vdevs.push({
          type: state.raidType,
          disks: state.selectedDisks.slice(start, end).map((d) => d.name),
        });
      }

      const options: Record<string, string> = {};
      if (state.ashift) options.ashift = state.ashift;
      if (state.compression) options.compression = state.compression;

      const result = await poolApi.create({
        name: state.poolName,
        vdevs,
        options: Object.keys(options).length > 0 ? options : undefined,
      });

      if (result.success) {
        onComplete();
      }
    } catch {
      // Error handled by API client
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return <DiskSelection state={state} onUpdate={updateState} />;
      case 1:
        return <RaidTypeSelect state={state} onUpdate={updateState} />;
      case 2:
        return <VdevLayout state={state} onUpdate={updateState} />;
      case 3:
        return <PoolOptions state={state} onUpdate={updateState} />;
      case 4:
        return <DatasetSetup state={state} onUpdate={updateState} />;
      case 5:
        return <ReviewConfirm state={state} />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center justify-between">
        {STEPS.map((step, idx) => (
          <div key={step.id} className="flex items-center">
            <div className="flex items-center">
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-colors',
                  idx < currentStep
                    ? 'bg-primary text-primary-foreground'
                    : idx === currentStep
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground',
                )}
              >
                {idx < currentStep ? <Check className="h-4 w-4" /> : idx + 1}
              </div>
              <span
                className={cn(
                  'ml-2 text-xs font-medium hidden sm:inline',
                  idx <= currentStep ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {step.label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div
                className={cn(
                  'mx-2 h-0.5 w-8 sm:w-12',
                  idx < currentStep ? 'bg-primary' : 'bg-muted',
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="min-h-[300px]">{renderStep()}</div>

      {/* Navigation */}
      <div className="flex items-center justify-between border-t border-border pt-4">
        <button
          onClick={currentStep === 0 ? onCancel : handleBack}
          className="flex items-center space-x-2 rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>{currentStep === 0 ? 'Cancel' : 'Back'}</span>
        </button>

        {currentStep < STEPS.length - 1 ? (
          <button
            onClick={handleNext}
            disabled={!canGoNext()}
            className="flex items-center space-x-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            <span>Next</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex items-center space-x-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            <Check className="h-4 w-4" />
            <span>{isSubmitting ? 'Creating Pool...' : 'Create Pool'}</span>
          </button>
        )}
      </div>
    </div>
  );
}
