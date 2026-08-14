import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { Note, PriorityLevel, NoteStatus } from '../../models/note.model';
import { Category } from '../../models/category.model';
import { NotesService } from '../../services/notes.service';
import { CategoriesService } from '../../services/categories.service';

@Component({
  selector: 'app-notes-dashboard',
  templateUrl: './notes-dashboard.component.html',
  styleUrls: ['./notes-dashboard.component.scss']
})
export class NotesDashboardComponent implements OnInit, OnDestroy {
  allNotes: Note[] = [];
  filteredNotes: Note[] = [];
  categories: Category[] = [];

  private subscriptions: Subscription = new Subscription();

  // Filter & Sort State
  searchTerm: string = '';
  selectedCategory: string = 'all';
  selectedPriority: string = 'all';
  selectedStatus: string = 'all';
  selectedSort: string = 'priority-desc';

  // Modal Control State
  isModalVisible: boolean = false;
  noteToEdit: Note | null = null;

  // View Mode: grid or list
  viewMode: 'grid' | 'list' = 'grid';

  constructor(
    private notesService: NotesService,
    private categoriesService: CategoriesService
  ) {}

  ngOnInit(): void {
    this.subscriptions.add(
      this.categoriesService.categories$.subscribe(cats => {
        this.categories = cats;
        this.applyFilters();
      })
    );

    this.subscriptions.add(
      this.notesService.notes$.subscribe(notes => {
        this.allNotes = notes;
        this.applyFilters();
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  applyFilters(): void {
    this.filteredNotes = this.notesService.filterAndSortNotes(
      this.allNotes,
      this.searchTerm,
      this.selectedCategory,
      this.selectedPriority,
      this.selectedStatus,
      this.selectedSort
    );
  }

  onSearchChange(): void {
    this.applyFilters();
  }

  onFilterChange(): void {
    this.applyFilters();
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.selectedCategory = 'all';
    this.selectedPriority = 'all';
    this.selectedStatus = 'all';
    this.selectedSort = 'priority-desc';
    this.applyFilters();
  }

  // Modal Handlers
  openCreateModal(): void {
    this.noteToEdit = null;
    this.isModalVisible = true;
  }

  openEditModal(note: Note): void {
    this.noteToEdit = note;
    this.isModalVisible = true;
  }

  closeModal(): void {
    this.isModalVisible = false;
    this.noteToEdit = null;
  }

  handleSaveNote(newNoteData: Omit<Note, 'id' | 'createdAt'>): void {
    this.notesService.addNote(newNoteData);
    this.closeModal();
  }

  handleUpdateNote(event: { id: string; changes: Partial<Note> }): void {
    this.notesService.updateNote(event.id, event.changes);
    this.closeModal();
  }

  // Actions
  deleteNote(note: Note): void {
    if (confirm(`¿Estás seguro de eliminar la nota "${note.title}"?`)) {
      this.notesService.deleteNote(note.id);
    }
  }

  toggleStatus(note: Note): void {
    this.notesService.toggleStatus(note.id);
  }

  togglePin(note: Note): void {
    this.notesService.togglePin(note.id);
  }

  // Helper Methods for UI
  getCategory(categoryId: string): Category | undefined {
    return this.categories.find(c => c.id === categoryId);
  }

  getCategoryColor(categoryId: string): string {
    const cat = this.getCategory(categoryId);
    return cat ? cat.color : '#6c757d';
  }

  getCategoryIcon(categoryId: string): string {
    const cat = this.getCategory(categoryId);
    return cat ? cat.icon : 'typcn-folder';
  }

  getCategoryName(categoryId: string): string {
    const cat = this.getCategory(categoryId);
    return cat ? cat.name : 'Sin Categoría';
  }

  getPriorityBadgeClass(priority: PriorityLevel): string {
    switch (priority) {
      case 'alta': return 'badge-danger';
      case 'media': return 'badge-warning';
      case 'baja': return 'badge-success';
      default: return 'badge-secondary';
    }
  }

  getPriorityLabel(priority: PriorityLevel): string {
    switch (priority) {
      case 'alta': return 'Alta';
      case 'media': return 'Media';
      case 'baja': return 'Baja';
      default: return priority;
    }
  }

  getStatusBadgeClass(status: NoteStatus): string {
    switch (status) {
      case 'pendiente': return 'badge-light text-dark border';
      case 'en_progreso': return 'badge-info';
      case 'completada': return 'badge-success';
      default: return 'badge-secondary';
    }
  }

  getStatusLabel(status: NoteStatus): string {
    switch (status) {
      case 'pendiente': return 'Pendiente';
      case 'en_progreso': return 'En Progreso';
      case 'completada': return 'Completada';
      default: return status;
    }
  }

  // Statistics counters
  get totalCount(): number {
    return this.allNotes.length;
  }

  get highPriorityCount(): number {
    return this.allNotes.filter(n => n.priority === 'alta').length;
  }

  get pendingCount(): number {
    return this.allNotes.filter(n => n.status !== 'completada').length;
  }

  get completedCount(): number {
    return this.allNotes.filter(n => n.status === 'completada').length;
  }
}
