import { Injectable } from '@angular/core';
import { User, UserRole } from '../models/user.model';

const USERS_STORAGE_KEY = 'noteyou_users_v2';

@Injectable({
  providedIn: 'root'
})
export class UserRepository {
  constructor() {
    this.initDefaultUsers();
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
        },
        {
          id: 'usr_admin',
          name: 'Administrador Sistema',
          email: 'admin@noteyou.com',
          passwordHash: btoa('admin123'),
          role: 'admin',
          isVerified: true,
          isActive: true,
          createdAt: new Date().toISOString(),
          hasCompletedTutorial: true
        },
        {
          id: 'usr_user',
          name: 'Usuario Común',
          email: 'usuario@noteyou.com',
          passwordHash: btoa('user123'),
          role: 'user',
          isVerified: true,
          isActive: true,
          createdAt: new Date().toISOString(),
          hasCompletedTutorial: false
        }
      ];
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(defaultUsers));
    }
  }

  public getAllUsers(): User[] {
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
    return true;
  }

  public toggleActiveStatus(userId: string): boolean {
    const user = this.findById(userId);
    if (!user) return false;
    user.isActive = !user.isActive;
    this.saveUser(user);
    return true;
  }

  public toggleVerification(userId: string): boolean {
    const user = this.findById(userId);
    if (!user) return false;
    user.isVerified = !user.isVerified;
    this.saveUser(user);
    return true;
  }
}
