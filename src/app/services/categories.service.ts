import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Category } from '../models/category.model';

const STORAGE_KEY = 'star_notes_categories_v1';

const DEFAULT_CATEGORIES: Category[] = [
  {
    id: 'cat_estudio',
    name: 'Estudio',
    color: '#4B49AC',
    icon: 'typcn-book',
    description: 'Tareas académicas, proyectos escolares, cursos y apuntes de clases.',
    isSystem: true
  },
  {
    id: 'cat_hogar',
    name: 'Hogar',
    color: '#FF4747',
    icon: 'typcn-home',
    description: 'Mantenimiento del hogar, compras domésticas y tareas de casa.',
    isSystem: true
  },
  {
    id: 'cat_trabajo',
    name: 'Trabajo',
    color: '#FFC107',
    icon: 'typcn-briefcase',
    description: 'Proyectos laborales, reuniones, informes y entregables de oficina.',
    isSystem: true
  },
  {
    id: 'cat_personal',
    name: 'Personal',
    color: '#28A745',
    icon: 'typcn-user',
    description: 'Metas personales, pasatiempos, lecturas y bienestar.',
    isSystem: true
  },
  {
    id: 'cat_finanzas',
    name: 'Finanzas',
    color: '#17A2B8',
    icon: 'typcn-calculator',
    description: 'Presupuesto mensual, servicios por pagar, cuentas e inversiones.',
    isSystem: true
  }
];

@Injectable({
  providedIn: 'root'
})
export class CategoriesService {
  private categoriesSubject = new BehaviorSubject<Category[]>([]);
  public categories$: Observable<Category[]> = this.categoriesSubject.asObservable();

  constructor() {
    this.loadInitialCategories();
  }

  private loadInitialCategories(): void {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.categoriesSubject.next(parsed);
          return;
        }
      } catch (e) {
        console.error(e);
      }
    }
    this.categoriesSubject.next(DEFAULT_CATEGORIES);
    this.saveToStorage(DEFAULT_CATEGORIES);
  }

  private saveToStorage(categories: Category[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(categories));
  }

  public getCategories(): Category[] {
    return this.categoriesSubject.getValue();
  }

  public getCategoryById(id: string): Category | undefined {
    return this.getCategories().find(c => c.id === id);
  }

  public addCategory(categoryData: Omit<Category, 'id'>): Category {
    const newCategory: Category = {
      ...categoryData,
      id: 'cat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      isSystem: false
    };
    const current = this.getCategories();
    const updated = [...current, newCategory];
    this.categoriesSubject.next(updated);
    this.saveToStorage(updated);
    return newCategory;
  }

  public updateCategory(id: string, updatedData: Partial<Category>): void {
    const current = this.getCategories();
    const index = current.findIndex(c => c.id === id);
    if (index !== -1) {
      const updatedList = [...current];
      updatedList[index] = { ...updatedList[index], ...updatedData };
      this.categoriesSubject.next(updatedList);
      this.saveToStorage(updatedList);
    }
  }

  public deleteCategory(id: string): boolean {
    const current = this.getCategories();
    const target = current.find(c => c.id === id);
    if (!target || target.isSystem) {
      return false;
    }
    const updated = current.filter(c => c.id !== id);
    this.categoriesSubject.next(updated);
    this.saveToStorage(updated);
    return true;
  }
}
