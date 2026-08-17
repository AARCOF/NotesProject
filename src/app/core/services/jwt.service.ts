import { Injectable } from '@angular/core';
import { UserRole } from '../models/user.model';

const TOKEN_KEY = 'star_notes_jwt_token';

export interface JwtPayload {
  sub: string;
  name: string;
  email: string;
  iat: number;
  exp: number;
}

@Injectable({
  providedIn: 'root'
})
export class JwtService {

  public generateToken(user: { id: string; name: string; email: string; role?: UserRole }, expiresInSeconds: number = 86400): string {
    const header = {
      alg: 'HS256',
      typ: 'JWT'
    };

    const nowInSec = Math.floor(Date.now() / 1000);
    const payload: JwtPayload = {
      sub: user.id,
      name: user.name,
      email: user.email,
      iat: nowInSec,
      exp: nowInSec + expiresInSeconds
    };

    const encodedHeader = this.base64url(JSON.stringify(header));
    const encodedPayload = this.base64url(JSON.stringify(payload));
    const signature = this.base64url(`sig_${user.id}_${nowInSec}`);

    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  public saveToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
  }

  public getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  public removeToken(): void {
    localStorage.removeItem(TOKEN_KEY);
  }

  public decodeToken(token: string): JwtPayload | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const payloadString = this.base64urlDecode(parts[1]);
      return JSON.parse(payloadString) as JwtPayload;
    } catch {
      return null;
    }
  }

  public isTokenExpired(token: string): boolean {
    const payload = this.decodeToken(token);
    if (!payload || !payload.exp) return true;
    const nowInSec = Math.floor(Date.now() / 1000);
    return nowInSec >= payload.exp;
  }

  private base64url(source: string): string {
    let encoded = btoa(unescape(encodeURIComponent(source)));
    encoded = encoded.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    return encoded;
  }

  private base64urlDecode(input: string): string {
    let base64 = input.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    return decodeURIComponent(escape(atob(base64)));
  }
}
