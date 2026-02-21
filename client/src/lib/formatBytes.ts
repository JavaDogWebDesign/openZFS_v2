const UNITS = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB'] as const;

/**
 * Format a byte count to a human-readable string using binary units.
 * @param bytes - Number of bytes
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string like "1.50 GiB"
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 B';
  if (!Number.isFinite(bytes)) return '-';

  const isNegative = bytes < 0;
  const absBytes = Math.abs(bytes);

  const k = 1024;
  const dm = Math.max(0, decimals);
  const i = Math.min(Math.floor(Math.log(absBytes) / Math.log(k)), UNITS.length - 1);

  const value = absBytes / Math.pow(k, i);
  const formatted = value.toFixed(dm);

  return `${isNegative ? '-' : ''}${formatted} ${UNITS[i]}`;
}

/**
 * Parse a human-readable byte string back to bytes.
 * @param str - A string like "1.5 GiB" or "500 MiB"
 * @returns Number of bytes, or NaN if parsing fails
 */
export function parseBytes(str: string): number {
  const match = str.trim().match(/^(-?\d+(?:\.\d+)?)\s*(B|KiB|MiB|GiB|TiB|PiB|EiB)$/i);
  if (!match) return NaN;

  const value = parseFloat(match[1]);
  const unit = match[2].toLowerCase();

  const unitMap: Record<string, number> = {
    b: 0,
    kib: 1,
    mib: 2,
    gib: 3,
    tib: 4,
    pib: 5,
    eib: 6,
  };

  const power = unitMap[unit];
  if (power === undefined) return NaN;

  return value * Math.pow(1024, power);
}
