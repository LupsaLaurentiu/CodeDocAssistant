export interface SourceChunk {
  filePath: string;
  language: string;
  startLine: number;
  endLine: number;
  symbol?: string;
  content: string;
}

export interface RetrievedChunk extends SourceChunk {
  id: string;
  score: number;
}

export interface SourceCitation {
  chunkId: string;
  filePath: string;
  startLine: number;
  endLine: number;
}

export interface SourceCodeExcerpt extends SourceCitation {
  language: string;
  symbol?: string;
  content: string;
}

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

export interface RepositoryAnswer {
  answer: string;
  citations: SourceCitation[];
  retrievedChunks: number;
}
