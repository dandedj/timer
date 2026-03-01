export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
}

export interface IAuthProvider {
  getCurrentUser(): Promise<User | null>;
  signIn(): Promise<User>;
  signOut(): Promise<void>;
  isAuthenticated(): boolean;
  getAccessToken(): string | null;
}
