import { Shield, Zap, HardDrive, AlertTriangle } from 'lucide-react';
import { RAID_LEVELS, type RaidLevel } from '@zfs-manager/shared';
import { cn } from '@/lib/utils';
import type { WizardState } from '../RaidWizard';

interface RaidTypeSelectProps {
  state: WizardState;
  onUpdate: (updates: Partial<WizardState>) => void;
}

const raidIcons: Record<string, React.ReactNode> = {
  stripe: <Zap className="h-6 w-6" />,
  mirror: <Shield className="h-6 w-6" />,
  raidz1: <Shield className="h-6 w-6" />,
  raidz2: <Shield className="h-6 w-6" />,
  raidz3: <Shield className="h-6 w-6" />,
  draid1: <HardDrive className="h-6 w-6" />,
  draid2: <HardDrive className="h-6 w-6" />,
};

export function RaidTypeSelect({ state, onUpdate }: RaidTypeSelectProps) {
  const diskCount = state.selectedDisks.length;

  const isAvailable = (level: RaidLevel): boolean => {
    return diskCount >= level.minDisks;
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-foreground">Select RAID Type</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose the redundancy level for your pool. You have {diskCount} disk{diskCount !== 1 ? 's' : ''} selected.
        </p>
      </div>

      {diskCount < 2 && (
        <div className="flex items-center space-x-2 rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3">
          <AlertTriangle className="h-4 w-4 text-yellow-500" />
          <p className="text-sm text-yellow-500">
            Only stripe (no redundancy) is available with a single disk.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {RAID_LEVELS.map((level) => {
          const available = isAvailable(level);
          const selected = state.raidType === level.type;

          return (
            <button
              key={level.type}
              onClick={() => available && onUpdate({ raidType: level.type })}
              disabled={!available}
              className={cn(
                'flex items-start space-x-4 rounded-lg border p-4 text-left transition-all',
                selected
                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                  : available
                    ? 'border-border hover:border-primary/50 hover:bg-muted/30'
                    : 'border-border opacity-40 cursor-not-allowed',
              )}
            >
              <div className={cn('mt-0.5', selected ? 'text-primary' : 'text-muted-foreground')}>
                {raidIcons[level.type] ?? <HardDrive className="h-6 w-6" />}
              </div>
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-foreground">{level.label}</span>
                  {level.type === 'stripe' && (
                    <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
                      NO REDUNDANCY
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{level.description}</p>
                <div className="mt-2 flex items-center space-x-3 text-xs text-muted-foreground">
                  <span>Min: {level.minDisks} disks</span>
                  <span>Parity: {level.parityDisks}</span>
                  {!available && (
                    <span className="text-destructive">Need {level.minDisks - diskCount} more</span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
