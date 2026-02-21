export interface ZfsPropertyDef {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'enum';
  readonly: boolean;
  description: string;
  values?: string[];
  default?: string;
  applies: ('filesystem' | 'volume' | 'snapshot' | 'pool')[];
}

export const ZFS_DATASET_PROPERTIES: ZfsPropertyDef[] = [
  { name: 'compression', type: 'enum', readonly: false, description: 'Compression algorithm', values: ['off', 'on', 'lz4', 'gzip', 'gzip-1', 'gzip-9', 'zle', 'lzjb', 'zstd', 'zstd-fast'], default: 'off', applies: ['filesystem', 'volume'] },
  { name: 'atime', type: 'enum', readonly: false, description: 'Update access time on read', values: ['on', 'off'], default: 'on', applies: ['filesystem'] },
  { name: 'relatime', type: 'enum', readonly: false, description: 'Relative access time updates', values: ['on', 'off'], default: 'off', applies: ['filesystem'] },
  { name: 'quota', type: 'number', readonly: false, description: 'Dataset quota in bytes (0 = none)', default: '0', applies: ['filesystem'] },
  { name: 'refquota', type: 'number', readonly: false, description: 'Reference quota in bytes (0 = none)', default: '0', applies: ['filesystem'] },
  { name: 'reservation', type: 'number', readonly: false, description: 'Reserved space in bytes (0 = none)', default: '0', applies: ['filesystem', 'volume'] },
  { name: 'refreservation', type: 'number', readonly: false, description: 'Reference reservation in bytes', default: '0', applies: ['filesystem', 'volume'] },
  { name: 'recordsize', type: 'number', readonly: false, description: 'Record size in bytes', default: '131072', applies: ['filesystem'] },
  { name: 'mountpoint', type: 'string', readonly: false, description: 'Mount point path', applies: ['filesystem'] },
  { name: 'canmount', type: 'enum', readonly: false, description: 'Whether dataset can be mounted', values: ['on', 'off', 'noauto'], default: 'on', applies: ['filesystem'] },
  { name: 'dedup', type: 'enum', readonly: false, description: 'Deduplication setting', values: ['off', 'on', 'verify', 'sha256', 'sha512', 'skein', 'edonr'], default: 'off', applies: ['filesystem', 'volume'] },
  { name: 'sync', type: 'enum', readonly: false, description: 'Sync write behavior', values: ['standard', 'always', 'disabled'], default: 'standard', applies: ['filesystem', 'volume'] },
  { name: 'snapdir', type: 'enum', readonly: false, description: '.zfs directory visibility', values: ['hidden', 'visible'], default: 'hidden', applies: ['filesystem'] },
  { name: 'aclinherit', type: 'enum', readonly: false, description: 'ACL inheritance behavior', values: ['discard', 'noallow', 'restricted', 'passthrough', 'passthrough-x'], default: 'restricted', applies: ['filesystem'] },
  { name: 'acltype', type: 'enum', readonly: false, description: 'ACL type', values: ['off', 'noacl', 'posixacl'], default: 'off', applies: ['filesystem'] },
  { name: 'xattr', type: 'enum', readonly: false, description: 'Extended attribute handling', values: ['off', 'on', 'sa'], default: 'on', applies: ['filesystem'] },
  { name: 'dnodesize', type: 'enum', readonly: false, description: 'Dnode size', values: ['legacy', 'auto', '1k', '2k', '4k', '8k', '16k'], default: 'legacy', applies: ['filesystem'] },
  { name: 'special_small_blocks', type: 'number', readonly: false, description: 'Small block threshold for special vdev', default: '0', applies: ['filesystem', 'volume'] },
];

export const ZFS_READONLY_PROPERTIES: string[] = [
  'used', 'available', 'referenced', 'compressratio', 'creation',
  'logicalused', 'logicalreferenced', 'usedbysnapshots', 'usedbydataset',
  'usedbychildren', 'usedbyrefreservation', 'type', 'mounted', 'origin',
  'written', 'objsetid', 'createtxg', 'guid',
];
