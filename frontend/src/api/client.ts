export type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

export type AnalyzePayload = {
  url: string;
  title: string;
  text: string;
  source: string;
  authorEmail: string;
};

export type AnalyzeResponse = {
  M?: number;
  F?: number;
  C?: number;
  f?: number;
  author?: {
    name?: string;
    email?: string;
    trustScore?: number;
    totalArticles?: number;
    fakeArticles?: number;
  };
  blockchain?: {
    txHash?: string | null;
    status?: 'success' | 'pending' | 'failed';
    timestamp?: string | null;
    hash?: string;
  };
};

export type AnalyzeImagePayload = {
  imageUrl: string;
  sourceId: string;
  payload?: Record<string, unknown>;
};

export type AnalyzeImageResponse = {
  info?: {
    url?: string;
    firstAppeared?: string;
    reused?: boolean;
    sha256?: string;
    sourceId?: string;
  };
  watermarkedImage?: string;
};

export type VerifyArticleResponse = {
  verified: boolean;
  txHash: string | null;
  blockchainTimestamp: string | null;
  blockchainStatus: 'success' | 'pending' | 'failed';
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

function buildUrl(path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

async function parseEnvelope<T>(response: Response): Promise<T> {
  const envelope = await response.json() as ApiEnvelope<T>;
  if (!response.ok || !envelope.success) {
    throw new Error(envelope?.error || 'Request failed');
  }
  return envelope.data as T;
}

async function postJson<TResponse>(path: string, body: unknown): Promise<TResponse> {
  const response = await fetch(buildUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  return parseEnvelope<TResponse>(response);
}

async function getJson<TResponse>(path: string): Promise<TResponse> {
  const response = await fetch(buildUrl(path));
  return parseEnvelope<TResponse>(response);
}

export async function analyzeArticle(payload: AnalyzePayload): Promise<AnalyzeResponse> {
  return postJson<AnalyzeResponse>('/api/analyze', payload);
}

export async function analyzeImage(payload: AnalyzeImagePayload): Promise<AnalyzeImageResponse> {
  return postJson<AnalyzeImageResponse>('/api/image', payload);
}

export async function verifyArticle(articleId: string): Promise<VerifyArticleResponse> {
  return getJson<VerifyArticleResponse>(`/api/articles/${articleId}/verify`);
}
