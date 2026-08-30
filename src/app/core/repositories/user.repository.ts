import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { User, UserRole } from '../models/user.model';

const USERS_STORAGE_KEY = 'noteyou_users_v2';

export function formatUserName(name: string): string {
  if (!name) return '';
  return name
    .trim()
    .split(/\s+/)
    .map(word => word ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : '')
    .join(' ');
}

@Injectable({
  providedIn: 'root'
})
export class UserRepository {
  constructor(private http: HttpClient) {
    this.initDefaultUsers();
    this.ensureSuperadminRoles();
    this.normalizeAllUserNames();
  }

  private normalizeAllUserNames(): void {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    if (!raw) return;
    try {
      const users: User[] = JSON.parse(raw);
      if (Array.isArray(users)) {
        let changed = false;
        const normalized = users.map(u => {
          const formatted = formatUserName(u.name);
          if (formatted !== u.name) {
            changed = true;
            return { ...u, name: formatted };
          }
          return u;
        });
        if (changed) {
          localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(normalized));
        }
      }
    } catch {}
  }

  public getCloudUsers(): Observable<User[]> {
    return this.http.get<{ success: boolean; users: User[] }>('/api/admin/users').pipe(
      map(res => {
        if (res && res.success && Array.isArray(res.users) && res.users.length > 0) {
          const cleanUsers: User[] = res.users.map(u => ({
            id: u.id || (u as any)._id?.toString() || 'usr_' + Math.random().toString(36).substr(2, 6),
            name: formatUserName(u.name),
            email: u.email,
            passwordHash: u.passwordHash || '',
            role: u.role || 'user',
            isVerified: u.isVerified ?? true,
            isActive: u.isActive ?? true,
            createdAt: u.createdAt || new Date().toISOString(),
            hasCompletedTutorial: u.hasCompletedTutorial || false
          }));

          localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(cleanUsers));
          return cleanUsers;
        }
        return this.getAllUsers();
      }),
      catchError(() => of(this.getAllUsers()))
    );
  }

  private ensureSuperadminRoles(): void {
    let users = this.getAllUsers();
    // Eliminar cuentas por defecto no deseadas si existen en la memoria local
    users = users.filter(u => 
      u.email.toLowerCase() !== 'admin@noteyou.com' && 
      u.email.toLowerCase() !== 'usuario@noteyou.com'
    );

    let foundSuperadmin = false;
    users.forEach(u => {
      if (u.email.toLowerCase() === 'superadmin@noteyou.com') {
        u.role = 'superadmin';
        u.isVerified = true;
        u.isActive = true;
        foundSuperadmin = true;
      }
    });

    if (!foundSuperadmin) {
      users.unshift({
        id: 'usr_superadmin',
        name: 'Super Administrador',
        email: 'superadmin@noteyou.com',
        passwordHash: btoa('admin123'),
        role: 'superadmin',
        isVerified: true,
        isActive: true,
        createdAt: new Date().toISOString(),
        hasCompletedTutorial: true
      });
    }

    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  }

  private initDefaultUsers(): void {
    const users = this.getAllUsers();
    if (users.length === 0) {
      const defaultUsers: User[] = [
        {
          id: 'usr_superadmin',
          name: 'Super Administrador',
          email: 'superadmin@noteyou.com',
          passwordHash: btoa('admin123'),
          role: 'superadmin',
          isVerified: true,
          isActive: true,
          createdAt: new Date().toISOString(),
          hasCompletedTutorial: true
        }
      ];
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(defaultUsers));
    }
  }

  public cleanExpiredUnverifiedUsers(): void {
    const data = localStorage.getItem(USERS_STORAGE_KEY);
    if (!data) return;
    try {
      const users: User[] = JSON.parse(data);
      if (!Array.isArray(users)) return;

      const now = Date.now();
      const twoHoursMs = 2 * 60 * 60 * 1000;
      const filtered = users.filter(u => {
        if (u.isVerified) return true;
        if (u.role === 'superadmin') return true;
        const createdTime = u.createdAt ? new Date(u.createdAt).getTime() : 0;
        return (now - createdTime) <= twoHoursMs;
      });

      if (filtered.length !== users.length) {
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(filtered));
      }
    } catch (e) {}
  }

  public getAllUsers(): User[] {
    this.cleanExpiredUnverifiedUsers();
    const data = localStorage.getItem(USERS_STORAGE_KEY);
    if (!data) return [];
    try {
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  public findByEmail(email: string): User | undefined {
    const cleanEmail = email.trim().toLowerCase();
    return this.getAllUsers().find(u => u.email.toLowerCase() === cleanEmail);
  }

  public findById(id: string): User | undefined {
    return this.getAllUsers().find(u => u.id === id);
  }

  public saveUser(user: User): void {
    if (user && user.name) {
      user.name = formatUserName(user.name);
    }
    const users = this.getAllUsers();
    const index = users.findIndex(u => u.id === user.id);
    if (index !== -1) {
      users[index] = user;
    } else {
      users.push(user);
    }
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  }

  public updateUser(user: User): void {
    this.saveUser(user);
  }

  public updateRole(userId: string, newRole: UserRole): boolean {
    const user = this.findById(userId);
    if (!user) return false;
    user.role = newRole;
    this.saveUser(user);

    // Sincronizar actualización de rol en MongoDB Atlas
    this.http.put('/api/admin/users', { userId, role: newRole }).subscribe({ error: () => {} });
    return true;
  }

  public toggleActiveStatus(userId: string): boolean {
    const user = this.findById(userId);
    if (!user) return false;
    user.isActive = !user.isActive;
    this.saveUser(user);

    // Sincronizar estado activo en MongoDB Atlas
    this.http.put('/api/admin/users', { userId, isActive: user.isActive }).subscribe({ error: () => {} });
    return true;
  }

  public toggleVerification(userId: string): boolean {
    const user = this.findById(userId);
    if (!user) return false;
    user.isVerified = !user.isVerified;
    this.saveUser(user);

    // Sincronizar verificación en MongoDB Atlas
    this.http.put('/api/admin/users', { userId, isVerified: user.isVerified }).subscribe({ error: () => {} });
    return true;
  }
}
