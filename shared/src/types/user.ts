export interface SystemUser {
  uid: number;
  gid: number;
  username: string;
  fullName: string;
  homeDir: string;
  shell: string;
  groups: string[];
  smbEnabled: boolean;
  locked: boolean;
}

export interface SystemGroup {
  gid: number;
  name: string;
  members: string[];
}
