import { Injectable } from '@angular/core';
import { User } from '../models/user.model';

const USERS_STORAGE_KEY = 'star_notes_users_v1';

@Injectable({
  providedIn: 'root'
})
export class UserRepository {
  constructor() {
    this.initDefaultUser();
  }

  private initDefaultUser(): void {
    const users = this.getAllUsers();
    if (users.length === 0) {
      const demoUser: User = {
        id: 'usr_demo_1',
        name: 'Usuario StarNotes',
        email: 'usuario@ejemplo.com',
        passwordHash: btoa('password123'),
        isVerified: true,
        createdAt: new Date().toISOString()
      };
      this.saveUser(demoUser);
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
}
