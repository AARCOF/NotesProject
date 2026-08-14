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
  private subscriptions: Subscription = new Subscription();

  // Form State for creating/editing category
  isModalOpen: boolean = false;
  categoryToEdit: Category | null = null;

  name: string = '';
  description: string = '';
  color: string = '#4B49AC';
  icon: string = 'typcn-book';

  // Preset Colors
  presetColors: string[] = [
    '#4B49AC', '#FF4747', '#FFC107', '#28A745', '#17A2B8',
    '#6f42c1', '#e83e8c', '#fd7e14', '#20c997', '#343a40'
  ];

  // Preset Icons
  presetIcons: { icon: string; label: string }[] = [
    { icon: 'typcn-book', label: 'Libro / Estudio' },
    { icon: 'typcn-home', label: 'Hogar' },
    { icon: 'typcn-briefcase', label: 'Trabajo' },
    { icon: 'typcn-user', label: 'Personal' },
    { icon: 'typcn-calculator', label: 'Finanzas' },
    { icon: 'typcn-star', label: 'Favoritos' },
    { icon: 'typcn-heart', label: 'Salud / Bienestar' },
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

  openCreateModal(): void {
    this.categoryToEdit = null;
    this.name = '';
    this.description = '';
    this.color = '#4B49AC';
    this.icon = 'typcn-book';
    this.isModalOpen = true;
  }

  openEditModal(category: Category): void {
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
      alert('Las categorías principales del sistema no se pueden eliminar.');
      return;
    }

    const count = this.getNoteCountForCategory(category.id);
    const msg = count > 0 
      ? `La categoría "${category.name}" tiene ${count} nota(s) asignada(s). ¿Estás seguro de eliminarla?`
      : `¿Estás seguro de eliminar la categoría "${category.name}"?`;

    if (confirm(msg)) {
      this.categoriesService.deleteCategory(category.id);
    }
  }
}
