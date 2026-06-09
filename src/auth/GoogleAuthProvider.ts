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

function gisAvailable(): boolean {
  return typeof google !== 'undefined' && !!google.accounts?.oauth2;
}

const GIS_SRC = 'https://accounts.google.com/gsi/client';
let gisInjection: HTMLScriptElement | null = null;

/** (Re)load the GIS script. The static tag in index.html is never retried by the
 *  browser once it errors (e.g. the PWA was launched offline), so each attempt here
 *  injects a fresh tag unless one is already in flight. */
function injectGisScript(): void {
  if (typeof document === 'undefined' || gisAvailable() || gisInjection) return;
  const script = document.createElement('script');
  script.src = GIS_SRC;
  script.async = true;
  script.onerror = () => {
    // Failed (still offline?) — drop it so the next attempt injects again.
    script.remove();
    gisInjection = null;
  };
  document.head.appendChild(script);
  gisInjection = script;
}

/**
 * The GIS script loads async/defer from accounts.google.com, so it may not have
 * arrived yet when restore or connect runs. Resolves true as soon as the script is
 * available (immediately if it already is), false after timeoutMs. When the static
 * script failed outright, retries the load so connectivity returning mid-session
 * can still bring sign-in back without an app restart.
 */
export function ensureGisLoaded(timeoutMs = 8000): Promise<boolean> {
  if (gisAvailable()) return Promise.resolve(true);
  // Page fully loaded without GIS → the static tag failed; only a re-inject can fix it.
  if (typeof document !== 'undefined' && document.readyState === 'complete') injectGisScript();
  return new Promise((resolve) => {
    const started = Date.now();
    let reinjected = false;
    const timer = setInterval(() => {
      if (gisAvailable()) {
        clearInterval(timer);
        resolve(true);
      } else {
        if (!reinjected && Date.now() - started >= 2000) {
          // Give the static tag a moment, then assume it's gone and load our own.
          reinjected = true;
          injectGisScript();
        }
        if (Date.now() - started >= timeoutMs) {
          clearInterval(timer);
          resolve(false);
        }
      }
    }, 100);
  });
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
      // Token expired: drop the token but KEEP the stored user, so hasStoredSession()
      // stays true and a silent refresh can restore the Drive session on next load.
      this.clearToken();
    }
    // Restore the user whenever one is stored, even if the access token has expired —
    // the expired-token path above relies on this to keep persistent sessions working.
    const storedUser = localStorage.getItem(USER_KEY);
    if (storedUser) {
      try {
        this.user = JSON.parse(storedUser) as User;
      } catch {
        this.clearSession();
      }
    }
  }

  /** Drop only the access token (keeps the stored user so silent refresh remains possible). */
  private clearToken(): void {
    this.accessToken = null;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
  }

  /** Drop the full session including the stored user (explicit sign-out / unrecoverable auth). */
  private clearSession(): void {
    this.clearToken();
    this.user = null;
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
      // Pin token requests to the stored account: without this, a silent refresh on a
      // multi-account device can mint a token for a DIFFERENT signed-in account, and a
      // sync against that account's (empty) Drive would strip the library.
      hint: this.user?.email,
    });
  }

  async signIn(): Promise<User> {
    if (!(await ensureGisLoaded())) {
      throw new Error('Google Identity Services not loaded');
    }
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
        // Preserve the GIS error type ('popup_failed_to_open', 'popup_closed', …) so
        // callers can surface a useful message instead of a generic failure.
        (error) => reject(new Error(error.type || error.message || 'OAuth error')),
      );
      // With a stored session the grant already exists, so prompt '' lets Google
      // re-issue the token with minimal UI — one tap on reconnect, no re-consent.
      this.tokenClient!.requestAccessToken({ prompt: this.accessToken || this.user ? '' : 'consent' });
    });
  }

  /** Silently refresh the access token (no popup). Returns true on success.
   *  Resolves false after a timeout so a hung GIS callback can never block sync. */
  async refreshToken(): Promise<boolean> {
    // Wait for the async GIS script instead of failing instantly on a slow load.
    if (!(await ensureGisLoaded())) {
      return false;
    }
    return new Promise<boolean>((resolve) => {
      let settled = false;
      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        resolve(ok);
      };
      const timer = setTimeout(() => finish(false), 10000);
      this.initClient(
        (response) => {
          clearTimeout(timer);
          if (response.error) {
            finish(false);
            return;
          }
          this.persistToken(response.access_token, response.expires_in);
          finish(true);
        },
        () => { clearTimeout(timer); finish(false); },
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

  /**
   * Sign out. By default this is a "soft" disconnect — it forgets the session locally
   * but does NOT revoke the OAuth grant, so reconnecting later is one click with no
   * re-consent. Pass `revoke: true` to fully revoke access (e.g. on a shared computer).
   */
  async signOut(revoke = false): Promise<void> {
    // Revoke is best-effort: sign-out must clear the local session even when the
    // GIS script never loaded or the revoke call fails.
    if (revoke && this.accessToken && gisAvailable()) {
      try {
        google.accounts.oauth2.revoke(this.accessToken);
      } catch {
        // Ignore — local session is cleared regardless.
      }
    }
    this.clearSession();
    this.tokenClient = null;
  }

  async getCurrentUser(): Promise<User | null> {
    return this.user;
  }

  isAuthenticated(): boolean {
    if (!this.accessToken) return false;
    const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
    if (expiry && Date.now() > Number(expiry)) {
      // Token lapsed: drop it but keep the user so a silent refresh can recover the session.
      this.clearToken();
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
