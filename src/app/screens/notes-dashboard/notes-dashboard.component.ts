import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { Note, PriorityLevel, NoteStatus } from '../../models/note.model';
import { Category } from '../../models/category.model';
import { NotesService } from '../../services/notes.service';
import { CategoriesService } from '../../services/categories.service';
import { VerificationKeyService } from '../../core/services/verification-key.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-notes-dashboard',
  templateUrl: './notes-dashboard.component.html',
  styleUrls: ['./notes-dashboard.component.scss']
})
export class NotesDashboardComponent implements OnInit, OnDestroy {
  allNotes: Note[] = [];
  filteredNotes: Note[] = [];
  categories: Category[] = [];

  isLoading: boolean = true;
  reminderMessage: string = '';
  private subscriptions: Subscription = new Subscription();

  searchTerm: string = '';
  selectedCategory: string = 'all';
  selectedPriority: string = 'all';
  selectedStatus: string = 'all';
  selectedSort: string = 'priority-desc';

  isModalVisible: boolean = false;
  noteToEdit: Note | null = null;
  viewMode: 'grid' | 'list' = 'grid';

  constructor(
    private notesService: NotesService,
    private categoriesService: CategoriesService,
    private verificationKeyService: VerificationKeyService,
    private authService: AuthService
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
        setTimeout(() => {
          this.isLoading = false;
        }, 300);
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

  sendEmailReminder(note: Note): void {
    const user = this.authService.getCurrentUser();
    if (!user) {
      alert('Debes estar autenticado para enviar recordatorios.');
      return;
    }

    const catName = this.getCategoryName(note.categoryId);
    const priorityLabel = this.getPriorityLabel(note.priority);

    this.verificationKeyService.sendTaskReminderEmail(
      user.email,
      note.title,
      note.content,
      catName,
      priorityLabel,
      note.dueDate
    ).subscribe();

    this.reminderMessage = `Recordatorio de la tarea "${note.title}" enviado a ${user.email}`;
    setTimeout(() => {
      this.reminderMessage = '';
    }, 4000);
  }

  getCategory(categoryId: string): Category | undefined {
    return this.categories.find(c => c.id === categoryId);
  }

  getCategoryColor(categoryId: string): string {
    const cat = this.getCategory(categoryId);
    return cat ? cat.color : '#059669';
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
      case 'alta': return 'badge-priority-high';
      case 'media': return 'badge-priority-medium';
      case 'baja': return 'badge-priority-low';
      default: return 'badge-secondary';
    }
  }

  getPriorityLabel(priority: PriorityLevel): string {
    switch (priority) {
      case 'alta': return 'Alta Prioridad';
      case 'media': return 'Prioridad Media';
      case 'baja': return 'Prioridad Baja';
      default: return priority;
    }
  }

  getStatusBadgeClass(status: NoteStatus): string {
    switch (status) {
      case 'pendiente': return 'badge-status-pending';
      case 'en_progreso': return 'badge-status-progress';
      case 'completada': return 'badge-status-completed';
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
