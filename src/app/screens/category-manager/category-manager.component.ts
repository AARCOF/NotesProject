import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { Category } from '../../models/category.model';
import { Note } from '../../models/note.model';
import { CategoriesService } from '../../services/categories.service';
import { NotesService } from '../../services/notes.service';

@Component({
  selector: 'app-category-manager',
  templateUrl: './category-manager.component.html',
  styleUrls: ['./category-manager.component.scss']
})
export class CategoryManagerComponent implements OnInit, OnDestroy {
  categories: Category[] = [];
  notes: Note[] = [];
  isLoading: boolean = true;

  private subscriptions: Subscription = new Subscription();

  isModalOpen: boolean = false;
  categoryToEdit: Category | null = null;

  name: string = '';
  description: string = '';
  color: string = '#4F46E5';
  icon: string = 'typcn-book';

  presetColors: string[] = [
    '#4F46E5', '#EF4444', '#F59E0B', '#10B981', '#06B6D4',
    '#8B5CF6', '#EC4899', '#F97316', '#14B8A6', '#334155'
  ];

  presetIcons: { icon: string; label: string }[] = [
    { icon: 'typcn-book', label: 'Libro y Estudio' },
    { icon: 'typcn-home', label: 'Hogar' },
    { icon: 'typcn-briefcase', label: 'Trabajo' },
    { icon: 'typcn-user', label: 'Personal' },
    { icon: 'typcn-lightbulb', label: 'Ideas' },
    { icon: 'typcn-star', label: 'Favoritos' },
    { icon: 'typcn-heart', label: 'Salud' },
    { icon: 'typcn-shopping-cart', label: 'Compras' },
    { icon: 'typcn-code', label: 'Programación' },
    { icon: 'typcn-plane', label: 'Viajes' },
    { icon: 'typcn-chart-bar', label: 'Metas' },
    { icon: 'typcn-film', label: 'Entretenimiento' }
  ];

  constructor(
    private categoriesService: CategoriesService,
    private notesService: NotesService
  ) {}

  ngOnInit(): void {
    this.subscriptions.add(
      this.categoriesService.categories$.subscribe(cats => {
        this.categories = cats;
        setTimeout(() => {
          this.isLoading = false;
        }, 300);
      })
    );

    this.subscriptions.add(
      this.notesService.notes$.subscribe(notes => {
        this.notes = notes;
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  getNoteCountForCategory(categoryId: string): number {
    return this.notes.filter(n => n.categoryId === categoryId).length;
  }

  private savedScrollTop: number | null = null;

  private recordScrollPosition(): void {
    const container = document.querySelector('.workspace-view-container') || document.querySelector('.main-panel');
    if (container) {
      this.savedScrollTop = container.scrollTop;
    } else if (typeof window !== 'undefined') {
      this.savedScrollTop = window.scrollY || document.documentElement.scrollTop;
    }
  }

  private restoreScrollPosition(): void {
    if (typeof document !== 'undefined' && document.activeElement && typeof (document.activeElement as HTMLElement).blur === 'function') {
      (document.activeElement as HTMLElement).blur();
    }
    const saved = this.savedScrollTop;
    this.savedScrollTop = null;
    if (saved !== null && saved !== undefined) {
      setTimeout(() => {
        const container = document.querySelector('.workspace-view-container') || document.querySelector('.main-panel');
        if (container) {
          container.scrollTop = saved;
        } else if (typeof window !== 'undefined') {
          window.scrollTo(0, saved);
        }
      }, 30);
    }
  }

  openCreateModal(): void {
    this.recordScrollPosition();
    this.categoryToEdit = null;
    this.name = '';
    this.description = '';
    this.color = '#4F46E5';
    this.icon = 'typcn-book';
    this.isModalOpen = true;
  }

  openEditModal(category: Category): void {
    this.recordScrollPosition();
    this.categoryToEdit = category;
    this.name = category.name;
    this.description = category.description || '';
    this.color = category.color;
    this.icon = category.icon;
    this.isModalOpen = true;
  }

  closeModal(): void {
    this.isModalOpen = false;
    this.categoryToEdit = null;
    this.restoreScrollPosition();
  }

  saveCategory(): void {
    if (!this.name.trim()) return;

    if (this.categoryToEdit) {
      this.categoriesService.updateCategory(this.categoryToEdit.id, {
        name: this.name.trim(),
        description: this.description.trim(),
        color: this.color,
        icon: this.icon
      });
    } else {
      this.categoriesService.addCategory({
        name: this.name.trim(),
        description: this.description.trim(),
        color: this.color,
        icon: this.icon
      });
    }

    this.closeModal();
  }

  deleteCategory(category: Category): void {
    if (category.isSystem) {
      alert('Las categorías principales no se pueden eliminar.');
      return;
    }

    const count = this.getNoteCountForCategory(category.id);
    const msg = count > 0 
      ? `La categoría "${category.name}" tiene ${count} nota asignada. ¿Estás seguro de eliminarla?`
      : `¿Estás seguro de eliminar la categoría "${category.name}"?`;

    if (confirm(msg)) {
      this.categoriesService.deleteCategory(category.id);
    }
  }
}
