import type { IAuthProvider, User } from './IAuthProvider';

const TOKEN_KEY = 'google-drive:token';
const TOKEN_EXPIRY_KEY = 'google-drive:token-expiry';
const USER_KEY = 'google-drive:user';

export class AuthExpiredError extends Error {
  constructor() {
    super('Google auth token expired');
    this.name = 'AuthExpiredError';
  }
}

export class GoogleAuthProvider implements IAuthProvider {
  private tokenClient: google.accounts.oauth2.TokenClient | null = null;
  private accessToken: string | null = null;
  private user: User | null = null;
  private clientId: string;

  constructor(clientId: string) {
    this.clientId = clientId;
    this.accessToken = localStorage.getItem(TOKEN_KEY);
    const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
    if (this.accessToken && expiry && Date.now() > Number(expiry)) {
      this.clearStored();
    }
    const storedUser = localStorage.getItem(USER_KEY);
    if (storedUser && this.accessToken) {
      try {
        this.user = JSON.parse(storedUser) as User;
      } catch {
        this.clearStored();
      }
    }
  }

  private clearStored(): void {
    this.accessToken = null;
    this.user = null;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
    localStorage.removeItem(USER_KEY);
  }

  private persistToken(token: string, expiresIn: number): void {
    this.accessToken = token;
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(TOKEN_EXPIRY_KEY, String(Date.now() + expiresIn * 1000));
  }

  private persistUser(user: User): void {
    this.user = user;
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  private static readonly SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email';

  private initClient(callback: (response: google.accounts.oauth2.TokenResponse) => void, errorCallback?: (error: { type: string; message: string }) => void): void {
    if (typeof google === 'undefined' || !google.accounts?.oauth2) {
      throw new Error('Google Identity Services not loaded');
    }
    this.tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: this.clientId,
      scope: GoogleAuthProvider.SCOPES,
      callback,
      error_callback: errorCallback,
    });
  }

  async signIn(): Promise<User> {
    return new Promise<User>((resolve, reject) => {
      this.initClient(
        async (response) => {
          if (response.error) {
            reject(new Error(response.error_description || response.error));
            return;
          }
          this.persistToken(response.access_token, response.expires_in);
          try {
            const user = await this.fetchUserProfile(response.access_token);
            this.persistUser(user);
            resolve(user);
          } catch (err) {
            reject(err);
          }
        },
        (error) => reject(new Error(error.message || 'OAuth error')),
      );
      this.tokenClient!.requestAccessToken({ prompt: this.accessToken ? '' : 'consent' });
    });
  }

  /** Silently refresh the access token (no popup). Returns true on success. */
  async refreshToken(): Promise<boolean> {
    if (typeof google === 'undefined' || !google.accounts?.oauth2) {
      return false;
    }
    return new Promise<boolean>((resolve) => {
      this.initClient(
        (response) => {
          if (response.error) {
            resolve(false);
            return;
          }
          this.persistToken(response.access_token, response.expires_in);
          resolve(true);
        },
        () => resolve(false),
      );
      this.tokenClient!.requestAccessToken({ prompt: '' });
    });
  }

  private async fetchUserProfile(token: string): Promise<User> {
    const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Failed to fetch user profile');
    const data = await res.json();
    return {
      id: data.id,
      email: data.email,
      displayName: data.name || data.email,
      avatarUrl: data.picture,
    };
  }

  async signOut(): Promise<void> {
    if (this.accessToken) {
      google.accounts.oauth2.revoke(this.accessToken);
    }
    this.clearStored();
    this.tokenClient = null;
  }

  async getCurrentUser(): Promise<User | null> {
    return this.user;
  }

  isAuthenticated(): boolean {
    if (!this.accessToken) return false;
    const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
    if (expiry && Date.now() > Number(expiry)) {
      this.clearStored();
      return false;
    }
    return true;
  }

  /** Returns true if user data is stored (even if token expired — can try refresh). */
  hasStoredSession(): boolean {
    return !!localStorage.getItem(USER_KEY);
  }

  getAccessToken(): string | null {
    if (!this.isAuthenticated()) return null;
    return this.accessToken;
  }
}
