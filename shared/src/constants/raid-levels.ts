export interface RaidLevel {
  type: string;
  label: string;
  description: string;
  minDisks: number;
  parityDisks: number;
  supportsExpansion: boolean;
}

export const RAID_LEVELS: RaidLevel[] = [
  {
    type: 'stripe',
    label: 'Stripe (RAID 0)',
    description: 'No redundancy. Maximum performance and capacity.',
    minDisks: 1,
    parityDisks: 0,
    supportsExpansion: true,
  },
  {
    type: 'mirror',
    label: 'Mirror (RAID 1)',
    description: 'Full redundancy. Survives N-1 disk failures per vdev.',
    minDisks: 2,
    parityDisks: 0,
    supportsExpansion: true,
  },
  {
    type: 'raidz1',
    label: 'RAID-Z1 (RAID 5)',
    description: 'Single parity. Survives 1 disk failure per vdev.',
    minDisks: 3,
    parityDisks: 1,
    supportsExpansion: false,
  },
  {
    type: 'raidz2',
    label: 'RAID-Z2 (RAID 6)',
    description: 'Double parity. Survives 2 disk failures per vdev.',
    minDisks: 4,
    parityDisks: 2,
    supportsExpansion: false,
  },
  {
    type: 'raidz3',
    label: 'RAID-Z3',
    description: 'Triple parity. Survives 3 disk failures per vdev.',
    minDisks: 5,
    parityDisks: 3,
    supportsExpansion: false,
  },
  {
    type: 'draid1',
    label: 'dRAID1',
    description: 'Distributed single-parity RAID. Faster resilver.',
    minDisks: 4,
    parityDisks: 1,
    supportsExpansion: false,
  },
  {
    type: 'draid2',
    label: 'dRAID2',
    description: 'Distributed double-parity RAID. Faster resilver.',
    minDisks: 5,
    parityDisks: 2,
    supportsExpansion: false,
  },
];

export function calculateUsableCapacity(
  diskSizeBytes: number,
  diskCount: number,
  raidType: string,
  mirrorsPerVdev: number = 2,
): number {
  switch (raidType) {
    case 'stripe':
      return diskSizeBytes * diskCount;
    case 'mirror':
      return diskSizeBytes * Math.floor(diskCount / mirrorsPerVdev);
    case 'raidz1':
      return diskSizeBytes * (diskCount - 1);
    case 'raidz2':
      return diskSizeBytes * (diskCount - 2);
    case 'raidz3':
      return diskSizeBytes * (diskCount - 3);
    case 'draid1':
      return diskSizeBytes * (diskCount - 1 - Math.ceil(diskCount / 4));
    case 'draid2':
      return diskSizeBytes * (diskCount - 2 - Math.ceil(diskCount / 4));
    default:
      return 0;
  }
}
