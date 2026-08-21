import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
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
  private syncTimerSubscription: any = null;

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
    }
  ];

  constructor(
    private authService: AuthService,
    private http: HttpClient
  ) {
    this.authService.currentUser$.subscribe(user => {
      this.currentUserId = user ? user.id : null;
      this.refreshCategoriesForCurrentUser();
      this.initAutoSync();
    });

    if (typeof window !== 'undefined') {
      window.addEventListener('focus', () => this.fetchCloudCategories());
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
          if (!document.hidden) this.fetchCloudCategories();
        });
      }
    }
  }

  private initAutoSync(): void {
    if (this.syncTimerSubscription) {
      clearInterval(this.syncTimerSubscription);
      this.syncTimerSubscription = null;
    }
    if (this.currentUserId) {
      this.syncTimerSubscription = setInterval(() => {
        this.fetchCloudCategories();
      }, 3000);
    }
  }

  public fetchCloudCategories(): void {
    if (!this.currentUserId) return;

    this.http.get<{ success: boolean; categories: Category[] }>('/api/categories').subscribe({
      next: (res) => {
        if (res && res.success && Array.isArray(res.categories)) {
          const cloudCats = res.categories;
          let all = this.getAllCustomCategories();
          const other = all.filter(c => c.userId && c.userId !== this.currentUserId);
          const merged = [...cloudCats, ...other];
          this.saveAllCustomCategories(merged);

          const userCustomCats = cloudCats.filter(c => 
            c.id !== 'cat_finanzas' && c.name?.toLowerCase() !== 'finanzas'
          );
          this.categoriesSubject.next([...this.defaultCategories, ...userCustomCats]);
        }
      },
      error: () => {}
    });
  }

  private getAllCustomCategories(): Category[] {
    const data = localStorage.getItem(CATEGORIES_STORAGE_KEY);
    if (!data) return [];
    try {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        return parsed.filter((c: Category) => !c.isSystem && c.id !== 'cat_finanzas' && c.name?.toLowerCase() !== 'finanzas');
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

    const userCustomCats = customCats.filter(c => 
      (c.userId === this.currentUserId || (!c.userId && this.currentUserId === 'usr_superadmin')) &&
      c.id !== 'cat_finanzas' && 
      c.name?.toLowerCase() !== 'finanzas'
    );
    this.categoriesSubject.next([...this.defaultCategories, ...userCustomCats]);

    this.fetchCloudCategories();
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

    // Sincronizar en MongoDB Atlas
    this.http.post('/api/categories', newCategory).subscribe({ error: () => {} });

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

    // Sincronizar en MongoDB Atlas
    this.http.post('/api/categories', updatedCategory).subscribe({ error: () => {} });

    return updatedCategory;
  }

  public deleteCategory(id: string): boolean {
    const customCats = this.getAllCustomCategories();
    const filtered = customCats.filter(c => !(c.id === id && (c.userId === this.currentUserId || !c.userId)));
    if (filtered.length === customCats.length) return false;

    this.saveAllCustomCategories(filtered);
    this.refreshCategoriesForCurrentUser();

    // Sincronizar en MongoDB Atlas
    this.http.delete('/api/categories?id=' + id).subscribe({ error: () => {} });

    return true;
  }
}
