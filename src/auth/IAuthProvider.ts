export interface User {
  id: string;
  email: string;
  displayName: string;
}

export interface IAuthProvider {
  getCurrentUser(): Promise<User | null>;
  signIn(email: string, password: string): Promise<User>;
  signOut(): Promise<void>;
  isAuthenticated(): boolean;
}
