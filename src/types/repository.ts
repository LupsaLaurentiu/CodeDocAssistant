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
}
