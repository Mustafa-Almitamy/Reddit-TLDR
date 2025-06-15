import { RedditAuthState, RedditTokenResponse } from '../types';

const getRedditClientId = () => {
  return import.meta.env.VITE_REDDIT_CLIENT_ID || import.meta.env.VITE_PUBLIC_REDDIT_CLIENT_ID;
};

const getRedirectUri = () => {
  return `${window.location.origin}/auth/callback`;
};

// Reddit OAuth2 endpoints
const REDDIT_AUTH_URL = 'https://www.reddit.com/api/v1/authorize';
const REDDIT_TOKEN_URL = 'https://www.reddit.com/api/v1/access_token';

export class RedditAuth {
  private static instance: RedditAuth;
  private authState: RedditAuthState = {
    isAuthenticated: false,
    accessToken: null,
    refreshToken: null,
    expiresAt: null,
    username: null
  };

  private constructor() {
    this.loadAuthState();
  }

  static getInstance(): RedditAuth {
    if (!RedditAuth.instance) {
      RedditAuth.instance = new RedditAuth();
    }
    return RedditAuth.instance;
  }

  private loadAuthState(): void {
    try {
      const stored = localStorage.getItem('reddit_auth_state');
      if (stored) {
        const parsed = JSON.parse(stored);
        this.authState = { ...this.authState, ...parsed };
        
        // Check if token is expired
        if (this.authState.expiresAt && Date.now() >= this.authState.expiresAt) {
          this.clearAuthState();
        }
      }
    } catch (error) {
      console.error('Error loading auth state:', error);
      this.clearAuthState();
    }
  }

  private saveAuthState(): void {
    try {
      localStorage.setItem('reddit_auth_state', JSON.stringify(this.authState));
    } catch (error) {
      console.error('Error saving auth state:', error);
    }
  }

  private clearAuthState(): void {
    this.authState = {
      isAuthenticated: false,
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
      username: null
    };
    localStorage.removeItem('reddit_auth_state');
  }

  generateAuthUrl(): string {
    const REDDIT_CLIENT_ID = getRedditClientId();
    const REDDIT_REDIRECT_URI = getRedirectUri();

    if (!REDDIT_CLIENT_ID) {
      throw new Error('Reddit Client ID is not configured. Please set VITE_REDDIT_CLIENT_ID in your environment variables.');
    }

    const state = Math.random().toString(36).substring(2, 15);
    localStorage.setItem('reddit_auth_state_param', state);

    const params = new URLSearchParams({
      client_id: REDDIT_CLIENT_ID,
      response_type: 'code',
      state: state,
      redirect_uri: REDDIT_REDIRECT_URI,
      duration: 'permanent',
      scope: 'read'
    });

    return `${REDDIT_AUTH_URL}?${params.toString()}`;
  }

  async handleCallback(code: string, state: string): Promise<boolean> {
    try {
      // Verify state parameter
      const storedState = localStorage.getItem('reddit_auth_state_param');
      if (!storedState || storedState !== state) {
        throw new Error('Invalid state parameter');
      }
      localStorage.removeItem('reddit_auth_state_param');

      // Exchange code for tokens
      const tokenResponse = await this.exchangeCodeForTokens(code);
      
      // Update auth state
      this.authState = {
        isAuthenticated: true,
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token || null,
        expiresAt: Date.now() + (tokenResponse.expires_in * 1000),
        username: null // Will be fetched separately if needed
      };

      this.saveAuthState();
      return true;
    } catch (error) {
      console.error('Error handling OAuth callback:', error);
      this.clearAuthState();
      return false;
    }
  }

  private async exchangeCodeForTokens(code: string): Promise<RedditTokenResponse> {
    const REDDIT_REDIRECT_URI = getRedirectUri();
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const response = await fetch(`${supabaseUrl}/functions/v1/reddit-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        code,
        redirect_uri: REDDIT_REDIRECT_URI
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token exchange failed: ${errorText}`);
    }

    return await response.json();
  }

  async refreshAccessToken(): Promise<boolean> {
    if (!this.authState.refreshToken) {
      this.clearAuthState();
      return false;
    }

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/reddit-refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          refresh_token: this.authState.refreshToken
        })
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const tokenResponse: RedditTokenResponse = await response.json();
      
      this.authState.accessToken = tokenResponse.access_token;
      this.authState.expiresAt = Date.now() + (tokenResponse.expires_in * 1000);
      
      this.saveAuthState();
      return true;
    } catch (error) {
      console.error('Error refreshing token:', error);
      this.clearAuthState();
      return false;
    }
  }

  async getValidAccessToken(): Promise<string | null> {
    // Check if we have a valid token
    if (this.authState.accessToken && this.authState.expiresAt && Date.now() < this.authState.expiresAt - 60000) {
      return this.authState.accessToken;
    }

    // Try to refresh the token
    if (this.authState.refreshToken) {
      const refreshed = await this.refreshAccessToken();
      if (refreshed) {
        return this.authState.accessToken;
      }
    }

    return null;
  }

  getAuthState(): RedditAuthState {
    return { ...this.authState };
  }

  logout(): void {
    this.clearAuthState();
  }

  isAuthenticated(): boolean {
    return this.authState.isAuthenticated && 
           this.authState.accessToken !== null && 
           this.authState.expiresAt !== null && 
           Date.now() < this.authState.expiresAt;
  }
}