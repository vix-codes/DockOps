export interface User {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: 'ROLE_ADMIN' | 'ROLE_OPERATOR' | 'ROLE_VIEWER';
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  userId: string;
  username: string;
  email: string;
  fullName: string;
  role: 'ROLE_ADMIN' | 'ROLE_OPERATOR' | 'ROLE_VIEWER';
}

export interface ServerNode {
  id: string;
  name: string;
  host: string;
  sshPort: number;
  sshUser: string;
  authMethod: 'PASSWORD' | 'PRIVATE_KEY';
  status: 'ONLINE' | 'OFFLINE' | 'UNKNOWN' | 'ERROR';
  description?: string;
  environment?: string;
  os?: string;
  kernelVersion?: string;
  cpuUsage?: number;
  ramUsage?: number;
  diskUsage?: number;
  uptimeSeconds?: number;
  runningContainers?: number;
  dockerAvailable?: boolean;
  lastCheckedAt?: string;
  createdAt: string;
}

export interface Container {
  containerId: string;
  name: string;
  image: string;
  status: string;
  state: string;
  ports?: string;
  networkMode?: string;
  cpuPercent?: number;
  memoryUsageBytes?: number;
  memoryLimitBytes?: number;
  startedAt?: string;
  serverNodeId: string;
  serverNodeName: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  repoUrl: string;
  branch: string;
  composeFilePath?: string;
  workingDirectory?: string;
  serverNodeId: string;
  serverNodeName: string;
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  lastDeployedCommit?: string;
  lastDeployedAt?: string;
  createdAt: string;
}

export interface Deployment {
  id: string;
  projectId: string;
  projectName: string;
  triggeredBy?: string;
  triggerType: 'MANUAL' | 'WEBHOOK' | 'SCHEDULED';
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'CANCELLED' | 'ROLLING_BACK' | 'ROLLED_BACK';
  commitHash?: string;
  commitMessage?: string;
  commitAuthor?: string;
  branch?: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  failureReason?: string;
  aiAnalysis?: string;
  createdAt: string;
}

export interface DeploymentLog {
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  message: string;
  timestamp: string;
  source?: string;
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

export interface ApiError {
  error: string;
  message: string;
  status: number;
}

export type NodeStatus = ServerNode['status'];
export type DeploymentStatus = Deployment['status'];
