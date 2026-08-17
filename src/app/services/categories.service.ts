import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Category } from '../models/category.model';
import { AuthService } from '../core/services/auth.service';

const CATEGORIES_STORAGE_KEY = 'noteyou_categories_v2';

@Injectable({
  providedIn: 'root'
})
export class CategoriesService {
  private categoriesSubject = new BehaviorSubject<Category[]>([]);
  public categories$: Observable<Category[]> = this.categoriesSubject.asObservable();
  private currentUserId: string | null = null;

  private defaultCategories: Category[] = [
    {
      id: 'cat_estudio',
      name: 'Estudio',
      description: 'Actividades académicas, cursos y proyectos de aprendizaje',
      color: '#059669',
      icon: 'typcn-book',
      isSystem: true
    },
    {
      id: 'cat_hogar',
      name: 'Hogar',
      description: 'Tareas domésticas, compras y mantenimiento del hogar',
      color: '#0284C7',
      icon: 'typcn-home',
      isSystem: true
    },
    {
      id: 'cat_trabajo',
      name: 'Trabajo',
      description: 'Reuniones, entregables y compromisos laborales',
      color: '#06B6D4',
      icon: 'typcn-briefcase',
      isSystem: true
    },
    {
      id: 'cat_personal',
      name: 'Personal',
      description: 'Metas personales, hábitos y recordatorios',
      color: '#8B5CF6',
      icon: 'typcn-user',
      isSystem: true
    },
    {
      id: 'cat_finanzas',
      name: 'Finanzas',
      description: 'Presupuestos, pagos pendientes y control financiero',
      color: '#10B981',
      icon: 'typcn-calculator',
      isSystem: true
    }
  ];

  constructor(private authService: AuthService) {
    this.authService.currentUser$.subscribe(user => {
      this.currentUserId = user ? user.id : null;
      this.refreshCategoriesForCurrentUser();
    });
  }

  private getAllCustomCategories(): Category[] {
    const data = localStorage.getItem(CATEGORIES_STORAGE_KEY);
    if (!data) return [];
    try {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        // Filtrar categorías que no son del sistema
        return parsed.filter((c: Category) => !c.isSystem);
      }
      return [];
    } catch {
      return [];
    }
  }

  private saveAllCustomCategories(customCats: Category[]): void {
    localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(customCats));
  }

  public refreshCategoriesForCurrentUser(): void {
    const customCats = this.getAllCustomCategories();
    
    if (!this.currentUserId) {
      this.categoriesSubject.next(this.defaultCategories);
      return;
    }

    const userCustomCats = customCats.filter(c => c.userId === this.currentUserId || (!c.userId && this.currentUserId === 'usr_superadmin'));
    this.categoriesSubject.next([...this.defaultCategories, ...userCustomCats]);
  }

  public getCategories(): Category[] {
    return this.categoriesSubject.getValue();
  }

  public getCategoryById(id: string): Category | undefined {
    return this.getCategories().find(c => c.id === id);
  }

  public addCategory(catData: Omit<Category, 'id' | 'isSystem'>): Category {
    const userId = this.currentUserId || 'anonymous';
    const newCategory: Category = {
      ...catData,
      id: 'cat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      userId,
      isSystem: false
    };

    const customCats = this.getAllCustomCategories();
    const updated = [...customCats, newCategory];
    this.saveAllCustomCategories(updated);

    this.refreshCategoriesForCurrentUser();
    return newCategory;
  }

  public updateCategory(id: string, changes: Partial<Category>): Category | undefined {
    const customCats = this.getAllCustomCategories();
    const index = customCats.findIndex(c => c.id === id && (c.userId === this.currentUserId || !c.userId));
    if (index === -1) return undefined;

    const updatedCategory = { ...customCats[index], ...changes, isSystem: false };
    customCats[index] = updatedCategory;
    this.saveAllCustomCategories(customCats);

    this.refreshCategoriesForCurrentUser();
    return updatedCategory;
  }

  public deleteCategory(id: string): boolean {
    const customCats = this.getAllCustomCategories();
    const filtered = customCats.filter(c => !(c.id === id && (c.userId === this.currentUserId || !c.userId)));
    if (filtered.length === customCats.length) return false;

    this.saveAllCustomCategories(filtered);
    this.refreshCategoriesForCurrentUser();
    return true;
  }
}
