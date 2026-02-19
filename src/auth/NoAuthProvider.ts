import type { IAuthProvider, User } from './IAuthProvider';

const ANONYMOUS_USER: User = {
  id: 'local',
  email: 'local@local',
  displayName: 'Local User',
};

export class NoAuthProvider implements IAuthProvider {
  async getCurrentUser(): Promise<User> { return ANONYMOUS_USER; }
  async signIn(): Promise<User> { return ANONYMOUS_USER; }
  async signOut(): Promise<void> {}
  isAuthenticated(): boolean { return true; }
}
