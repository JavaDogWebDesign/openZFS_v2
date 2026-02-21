export interface Snapshot {
  name: string;
  dataset: string;
  shortName: string;
  creation: string;
  used: number;
  referenced: number;
  clones?: string[];
  holds?: string[];
}
