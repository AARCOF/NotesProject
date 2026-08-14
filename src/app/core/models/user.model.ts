export type UserRole = 'superadmin' | 'admin' | 'user';

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  isVerified: boolean;
  isActive: boolean;
  verificationKey?: string;
  keyExpiresAt?: number;
  createdAt: string;
  hasCompletedTutorial?: boolean;
}

export interface AuthResponse {
  token: string;
  user: User;
}
