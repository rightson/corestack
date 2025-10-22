export interface SSHAccount {
  id?: number;
  accountName: string;
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  passphrase?: string;
  basePath?: string;
  timeout: number;
}

export interface SSHOperationResult {
  success: boolean;
  stdout?: string;
  stderr?: string;
  code?: number;
  message?: string;
  executionTime?: number;
  data?: any;
}

export interface FileInfo {
  name: string;
  path: string;
  type: 'file' | 'directory' | 'symlink' | 'other';
  size: number;
  mode: number;
  owner: number;
  group: number;
  modifiedAt: Date;
  accessedAt: Date;
}

export interface AccountResolution {
  accountName?: string;
  projectId?: number;
  configAlias?: string;
}
