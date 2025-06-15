export interface PostRecord {
  title: string;
  selftext: string;
  combined: string;
  comments?: string[];
  subreddit?: string;
  post_id?: string;
}

export interface SentimentResult {
  sentiment: 'positive' | 'negative' | 'mixed' | 'neutral';
  explanation: string;
  positives: string[];
  negatives: string[];
}

export interface AnalysisResult {
  post: PostRecord;
  result: SentimentResult | null;
}

export interface AggregatedResult {
  positives: string[];
  negatives: string[];
}

export interface SentimentCounts {
  positive: number;
  negative: number;
  mixed: number;
  neutral: number;
}

export interface RedditAuthState {
  isAuthenticated: boolean;
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null;
  username: string | null;
}

export interface RedditTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  refresh_token?: string;
}