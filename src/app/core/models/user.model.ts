export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  isVerified: boolean;
  verificationKey?: string;
  keyExpiresAt?: number; // timestamp in ms (Date.now() + 3600000)
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    isVerified: boolean;
  };
}
