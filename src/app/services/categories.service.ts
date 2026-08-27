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

  private trackDeletedCategoryId(id: string): void {
    if (!this.currentUserId) return;
    const key = 'noteyou_deleted_note_cats_' + this.currentUserId;
    const data = localStorage.getItem(key);
    let ids: string[] = [];
    try { ids = data ? JSON.parse(data) : []; } catch { ids = []; }
    if (!ids.includes(id)) {
      ids.push(id);
      localStorage.setItem(key, JSON.stringify(ids));
    }
  }

  private getDeletedCategoryIds(): Set<string> {
    if (!this.currentUserId) return new Set();
    const key = 'noteyou_deleted_note_cats_' + this.currentUserId;
    const data = localStorage.getItem(key);
    try {
      return new Set(data ? JSON.parse(data) : []);
    } catch {
      return new Set();
    }
  }

  public fetchCloudCategories(): void {
    if (!this.currentUserId) return;

    this.http.get<{ success: boolean; categories: Category[] }>('/api/categories').subscribe({
      next: (res) => {
        if (res && res.success && Array.isArray(res.categories)) {
          const cloudCats = res.categories;
          const deletedIds = this.getDeletedCategoryIds();
          let all = this.getAllCustomCategories();
          const other = all.filter(c => c.userId && c.userId !== this.currentUserId);
          const localUserCats = all.filter(c => c.userId === this.currentUserId);

          const localMap = new Map<string, Category>();
          localUserCats.forEach(c => localMap.set(c.id, c));

          const finalMap = new Map<string, Category>();

          // 1. Procesar categorías que vienen de la nube
          cloudCats.forEach(cloudCat => {
            if (deletedIds.has(cloudCat.id)) {
              this.http.delete('/api/categories?id=' + cloudCat.id).subscribe({ error: () => {} });
              return;
            }

            const localCat = localMap.get(cloudCat.id);
            if (!localCat) {
              finalMap.set(cloudCat.id, cloudCat);
            } else {
              const cloudTime = new Date(cloudCat.updatedAt || cloudCat.createdAt || 0).getTime();
              const localTime = new Date(localCat.updatedAt || localCat.createdAt || 0).getTime();

              if (localTime > cloudTime) {
                finalMap.set(localCat.id, localCat);
                this.http.put('/api/categories', localCat).subscribe({ error: () => {} });
              } else {
                finalMap.set(cloudCat.id, cloudCat);
              }
            }
          });

          // 2. Procesar categorías locales creadas recientemente que aún no están en la nube
          const now = Date.now();
          localUserCats.forEach(localCat => {
            if (deletedIds.has(localCat.id)) return;
            if (!finalMap.has(localCat.id)) {
              const localTime = new Date(localCat.updatedAt || localCat.createdAt || 0).getTime();
              if (now - localTime < 60000) {
                finalMap.set(localCat.id, localCat);
                this.http.post('/api/categories', localCat).subscribe({ error: () => {} });
              }
            }
          });

          const mergedUserCats = Array.from(finalMap.values()).filter(c => 
            c.id !== 'cat_finanzas' && c.name?.toLowerCase() !== 'finanzas'
          );
          const mergedAll = [...mergedUserCats, ...other];
          this.saveAllCustomCategories(mergedAll);

          const newCats = [...this.defaultCategories, ...mergedUserCats];
          const currentCats = this.categoriesSubject.getValue();
          if (JSON.stringify(currentCats) !== JSON.stringify(newCats)) {
            this.categoriesSubject.next(newCats);
          }
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
    const now = new Date().toISOString();
    const newCategory: Category = {
      ...catData,
      id: 'cat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      userId,
      isSystem: false,
      createdAt: now,
      updatedAt: now
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

    const now = new Date().toISOString();
    const updatedCategory: Category = { 
      ...customCats[index], 
      ...changes, 
      isSystem: false,
      updatedAt: now 
    };
    customCats[index] = updatedCategory;
    this.saveAllCustomCategories(customCats);

    this.refreshCategoriesForCurrentUser();

    // Sincronizar en MongoDB Atlas
    this.http.put('/api/categories', updatedCategory).subscribe({ error: () => {} });

    return updatedCategory;
  }

  public deleteCategory(id: string): boolean {
    this.trackDeletedCategoryId(id);

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
