import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { Note, PriorityLevel, NoteStatus, ChecklistItem, RecurrenceFrequency } from '../../models/note.model';
import { Category } from '../../models/category.model';
import { User } from '../../core/models/user.model';
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

  isFilterModalOpen: boolean = false;

  get activeFiltersCount(): number {
    let count = 0;
    if (this.selectedCategory !== 'all') count++;
    if (this.selectedPriority !== 'all') count++;
    if (this.selectedStatus !== 'all') count++;
    if (this.selectedSort !== 'priority-desc') count++;
    return count;
  }

  get hasActiveFilters(): boolean {
    return this.activeFiltersCount > 0 || !!this.searchTerm.trim();
  }

  isModalVisible: boolean = false;
  currentUser: User | null = null;
  page: number = 1;
  pageSize: number = 6;
  noteToEdit: Note | null = null;
  initialModalStatus: NoteStatus = 'pendiente';
  viewMode: 'grid' | 'kanban' = 'kanban';

  // Drag & Drop State
  draggedNote: Note | null = null;
  activeDropZone: NoteStatus | null = null;

  // View Details Modal State
  selectedViewNote: Note | null = null;

  constructor(
    private notesService: NotesService,
    private categoriesService: CategoriesService,
    private verificationKeyService: VerificationKeyService,
    private authService: AuthService
  ) {}

  mobileKanbanTab: 'pendiente' | 'en_progreso' | 'completada' = 'pendiente';

  ngOnInit(): void {
    this.subscriptions.add(
      this.notesService.openModalRequest$.subscribe(req => {
        if (req && req.open) {
          if (req.note) {
            this.openEditModal(req.note);
          } else {
            this.openCreateModal('pendiente');
          }
        }
      })
    );

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

  get paginatedNotes(): Note[] {
    const startIndex = (this.page - 1) * this.pageSize;
    return this.filteredNotes.slice(startIndex, startIndex + this.pageSize);
  }

  applyFilters(): void {
    this.page = 1;
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

  getSortLabel(sortValue: string): string {
    switch (sortValue) {
      case 'priority-desc': return 'Prioridad Alta primero';
      case 'priority-asc': return 'Prioridad Baja primero';
      case 'date-desc': return 'Fecha más reciente';
      case 'date-asc': return 'Fecha más antigua';
      case 'dueDate-asc': return 'Próxima entrega';
      default: return 'Ordenar por';
    }
  }

  setSort(sort: string): void {
    this.selectedSort = sort;
    this.applyFilters();
  }

  setPriority(prio: string): void {
    this.selectedPriority = prio;
    this.applyFilters();
  }

  setCategory(catId: string): void {
    this.selectedCategory = catId;
    this.applyFilters();
  }

  setStatus(status: string): void {
    this.selectedStatus = status;
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

  openCreateModal(initialStatus: NoteStatus = 'pendiente'): void {
    this.noteToEdit = null;
    this.initialModalStatus = initialStatus;
    this.isModalVisible = true;
  }

  getNotesByStatus(status: NoteStatus): Note[] {
    const priorityWeight: { [key in PriorityLevel]: number } = {
      'alta': 3,
      'media': 2,
      'baja': 1
    };

    return this.filteredNotes
      .filter(n => n.status === status)
      .sort((a, b) => {
        // Pinned first
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        // High priority first
        return priorityWeight[b.priority] - priorityWeight[a.priority];
      });
  }

  // --- Paginación para Vista Cuadrícula (Grid) ---
  get gridTotalPages(): number {
    return Math.max(1, Math.ceil(this.filteredNotes.length / this.pageSize));
  }

  get gridPageNumbers(): number[] {
    const total = this.gridTotalPages;
    const current = this.page;
    const pages: number[] = [];
    
    let start = Math.max(1, current - 2);
    let end = Math.min(total, start + 4);
    if (end - start < 4) {
      start = Math.max(1, end - 4);
    }
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  }

  setGridPage(p: number, event?: Event): void {
    if (event) event.preventDefault();
    if (p >= 1 && p <= this.gridTotalPages) {
      this.page = p;
    }
  }

  nextGridPage(event?: Event): void {
    if (event) event.preventDefault();
    if (this.page < this.gridTotalPages) {
      this.page++;
    }
  }

  prevGridPage(event?: Event): void {
    if (event) event.preventDefault();
    if (this.page > 1) {
      this.page--;
    }
  }

  setPageSize(size: number): void {
    this.pageSize = size;
    this.page = 1;
  }

  getGridStartIndex(): number {
    if (this.filteredNotes.length === 0) return 0;
    const page = Math.min(Math.max(1, this.page || 1), this.gridTotalPages);
    return (page - 1) * this.pageSize + 1;
  }

  getGridEndIndex(): number {
    if (this.filteredNotes.length === 0) return 0;
    const page = Math.min(Math.max(1, this.page || 1), this.gridTotalPages);
    return Math.min(page * this.pageSize, this.filteredNotes.length);
  }

  // --- Paginación y Redimensionamiento para Tablero Kanban ---
  kanbanPage: { [key in NoteStatus]: number } = {
    pendiente: 1,
    en_progreso: 1,
    completada: 1
  };
  kanbanPageSize: number = 3;

  getKanbanNotes(status: NoteStatus): Note[] {
    const allColNotes = this.getNotesByStatus(status);
    const totalPages = this.getKanbanTotalPages(status);
    if (this.kanbanPage[status] > totalPages) {
      this.kanbanPage[status] = totalPages;
    }
    const page = Math.max(1, this.kanbanPage[status] || 1);
    const start = (page - 1) * this.kanbanPageSize;
    return allColNotes.slice(start, start + this.kanbanPageSize);
  }

  getKanbanTotalPages(status: NoteStatus): number {
    const total = this.getNotesByStatus(status).length;
    return Math.max(1, Math.ceil(total / this.kanbanPageSize));
  }

  getKanbanRangeText(status: NoteStatus): string {
    const total = this.getNotesByStatus(status).length;
    if (total === 0) return '0 de 0';
    const totalPages = this.getKanbanTotalPages(status);
    const page = Math.min(Math.max(1, this.kanbanPage[status] || 1), totalPages);
    const start = (page - 1) * this.kanbanPageSize + 1;
    const end = Math.min(page * this.kanbanPageSize, total);
    return `${start}-${end} de ${total}`;
  }

  getKanbanPageNumbers(status: NoteStatus): number[] {
    const total = this.getKanbanTotalPages(status);
    const pages: number[] = [];
    for (let i = 1; i <= total; i++) {
      pages.push(i);
    }
    return pages;
  }

  setKanbanPage(status: NoteStatus, p: number, event?: Event): void {
    if (event) event.stopPropagation();
    if (p >= 1 && p <= this.getKanbanTotalPages(status)) {
      this.kanbanPage[status] = p;
    }
  }

  nextKanbanPage(status: NoteStatus, event?: Event): void {
    if (event) event.stopPropagation();
    if (this.kanbanPage[status] < this.getKanbanTotalPages(status)) {
      this.kanbanPage[status]++;
    }
  }

  prevKanbanPage(status: NoteStatus, event?: Event): void {
    if (event) event.stopPropagation();
    if (this.kanbanPage[status] > 1) {
      this.kanbanPage[status]--;
    }
  }

  changeTaskStatus(note: Note, newStatus: NoteStatus): void {
    this.notesService.updateNote(note.id, { status: newStatus });
  }

  // --- Drag and Drop Handlers for Kanban ---

  onDragStart(event: DragEvent, note: Note): void {
    this.draggedNote = note;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', note.id);
    }
  }

  onDragOver(event: DragEvent, status: NoteStatus): void {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
    this.activeDropZone = status;
  }

  onDragLeave(event: DragEvent, status: NoteStatus): void {
    if (this.activeDropZone === status) {
      this.activeDropZone = null;
    }
  }

  onDrop(event: DragEvent, targetStatus: NoteStatus): void {
    event.preventDefault();
    if (this.draggedNote && this.draggedNote.status !== targetStatus) {
      this.changeTaskStatus(this.draggedNote, targetStatus);
    }
    this.draggedNote = null;
    this.activeDropZone = null;
  }

  onTabDrop(event: DragEvent, targetStatus: NoteStatus): void {
    event.preventDefault();
    if (this.draggedNote) {
      if (this.draggedNote.status !== targetStatus) {
        this.changeTaskStatus(this.draggedNote, targetStatus);
      }
      this.mobileKanbanTab = targetStatus;
    }
    this.draggedNote = null;
    this.activeDropZone = null;
  }

  onDragEnd(): void {
    this.draggedNote = null;
    this.activeDropZone = null;
  }

  openViewModal(note: Note, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.selectedViewNote = note;
  }

  closeViewModal(): void {
    this.selectedViewNote = null;
  }

  toggleStatusFromViewModal(): void {
    if (!this.selectedViewNote) return;
    const updated = this.notesService.toggleStatus(this.selectedViewNote.id);
    if (updated) {
      this.selectedViewNote = updated;
    }
  }

  togglePinFromViewModal(): void {
    if (!this.selectedViewNote) return;
    const updated = this.notesService.togglePin(this.selectedViewNote.id);
    if (updated) {
      this.selectedViewNote = updated;
    }
  }

  editFromViewModal(): void {
    if (!this.selectedViewNote) return;
    const note = this.selectedViewNote;
    this.closeViewModal();
    this.openEditModal(note);
  }

  deleteFromViewModal(): void {
    if (!this.selectedViewNote) return;
    const note = this.selectedViewNote;
    this.closeViewModal();
    this.deleteNote(note);
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

  getPriorityBadgeClass(priority: PriorityLevel | string): string {
    switch (priority) {
      case 'alta': return 'badge-priority-high';
      case 'media': return 'badge-priority-medium';
      case 'baja': return 'badge-priority-low';
      default: return 'badge-secondary';
    }
  }

  getPriorityLabel(priority: PriorityLevel | string): string {
    switch (priority) {
      case 'alta': return 'Alta Prioridad';
      case 'media': return 'Prioridad Media';
      case 'baja': return 'Prioridad Baja';
      default: return priority === 'all' ? 'Prioridades: Todas' : priority;
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

  toggleChecklistItem(note: Note, item: ChecklistItem, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    const updated = this.notesService.toggleChecklistItem(note.id, item.id);
    if (this.selectedViewNote && this.selectedViewNote.id === note.id && updated) {
      this.selectedViewNote = updated;
    }
  }

  getCompletedChecklistCount(note: Note): number {
    return note.checklist ? note.checklist.filter(i => i.completed).length : 0;
  }

  getChecklistProgressPercent(note: Note): number {
    if (!note.checklist || note.checklist.length === 0) return 0;
    const completed = this.getCompletedChecklistCount(note);
    return Math.round((completed / note.checklist.length) * 100);
  }

  getCompletedDaysRemaining(note: Note): number {
    return this.notesService.getCompletedDaysRemaining(note);
  }

  getRecurrenceLabel(frequency?: RecurrenceFrequency): string {
    return this.notesService.getRecurrenceLabel(frequency);
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
