export interface GitHubRepositoryReference {
  owner: string;
  name: string;
  url: string;
  cloneUrl: string;
}

export interface ScannedSourceFile {
  absolutePath: string;
  relativePath: string;
  language: string;
}

export interface RepositoryAnalysisResult {
  repositoryId: string;
  repositoryUrl: string;
  filesDiscovered: number;
  filesIndexed: number;
  filesSkipped: number;
  chunksIndexed: number;
  commitSha?: string;
  indexReused?: boolean;
}

export type RepositoryAnalysisPhase =
  | "IDLE"
  | "CLONING"
  | "SCANNING"
  | "CHUNKING"
  | "EMBEDDING"
  | "SAVING"
  | "COMPLETE"
  | "FAILED";

export interface RepositoryAnalysisProgress {
  repositoryId: string;
  status: RepositoryWorkspaceData["status"];
  phase: RepositoryAnalysisPhase;
  filesDiscovered: number;
  filesProcessed: number;
  filesSkipped: number;
  chunksTotal: number;
  chunksEmbedded: number;
  error: string | null;
  commitSha: string | null;
  indexReused: boolean;
  updatedAt: string;
}

export interface RepositoryWorkspaceData {
  id: string;
  url: string;
  owner: string;
  name: string;
  defaultBranch?: string;
  status: "PENDING" | "CLONING" | "INDEXING" | "READY" | "FAILED";
  fileCount: number;
  chunkCount: number;
  languages: string[];
  indexedAt: string;
  indexedCommitSha?: string;
}
