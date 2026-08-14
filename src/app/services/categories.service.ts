import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Category } from '../models/category.model';

const CATEGORIES_STORAGE_KEY = 'noteyou_categories_v2';

@Injectable({
  providedIn: 'root'
})
export class CategoriesService {
  private categoriesSubject = new BehaviorSubject<Category[]>([]);
  public categories$: Observable<Category[]> = this.categoriesSubject.asObservable();

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

  constructor() {
    this.loadInitialCategories();
  }

  private loadInitialCategories(): void {
    const data = localStorage.getItem(CATEGORIES_STORAGE_KEY);
    if (data) {
      try {
        const parsed = JSON.parse(data);
        this.categoriesSubject.next(parsed);
        return;
      } catch {
        this.categoriesSubject.next(this.defaultCategories);
        this.saveToStorage(this.defaultCategories);
      }
    } else {
      this.categoriesSubject.next(this.defaultCategories);
      this.saveToStorage(this.defaultCategories);
    }
  }

  private saveToStorage(categories: Category[]): void {
    localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(categories));
    this.categoriesSubject.next(categories);
  }

  public getCategories(): Category[] {
    return this.categoriesSubject.getValue();
  }

  public getCategoryById(id: string): Category | undefined {
    return this.getCategories().find(c => c.id === id);
  }

  public addCategory(catData: Omit<Category, 'id' | 'isSystem'>): Category {
    const newCategory: Category = {
      ...catData,
      id: 'cat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      isSystem: false
    };
    const current = this.getCategories();
    const updated = [...current, newCategory];
    this.saveToStorage(updated);
    return newCategory;
  }

  public updateCategory(id: string, changes: Partial<Category>): Category | undefined {
    const current = this.getCategories();
    const index = current.findIndex(c => c.id === id);
    if (index === -1) return undefined;

    const updatedCategory = { ...current[index], ...changes };
    current[index] = updatedCategory;
    this.saveToStorage([...current]);
    return updatedCategory;
  }

  public deleteCategory(id: string): boolean {
    const current = this.getCategories();
    const cat = current.find(c => c.id === id);
    if (!cat || cat.isSystem) return false;

    const filtered = current.filter(c => c.id !== id);
    this.saveToStorage(filtered);
    return true;
  }
}
