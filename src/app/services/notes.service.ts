import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { Note, PriorityLevel, NoteStatus, RecurrenceFrequency } from '../models/note.model';
import { AuthService } from '../core/services/auth.service';

const NOTES_STORAGE_KEY = 'noteyou_notes_v2';
export const COMPLETED_TASK_AUTO_DELETE_DAYS = 15;

@Injectable({
  providedIn: 'root'
})
export class NotesService {
  private notesSubject = new BehaviorSubject<Note[]>([]);
  public notes$: Observable<Note[]> = this.notesSubject.asObservable();
  private currentUserId: string | null = null;

  private activeViewModeSubject = new BehaviorSubject<'kanban' | 'grid' | 'categorias' | 'graficos'>('kanban');
  public activeViewMode$: Observable<'kanban' | 'grid' | 'categorias' | 'graficos'> = this.activeViewModeSubject.asObservable();

  public setViewMode(mode: 'kanban' | 'grid' | 'categorias' | 'graficos'): void {
    this.activeViewModeSubject.next(mode);
  }

  public getViewMode(): 'kanban' | 'grid' | 'categorias' | 'graficos' {
    return this.activeViewModeSubject.getValue();
  }

  private syncTimerSubscription: any = null;

  constructor(
    private authService: AuthService,
    private http: HttpClient
  ) {
    this.authService.currentUser$.subscribe(user => {
      this.currentUserId = user ? user.id : null;
      this.refreshNotesForCurrentUser();
      this.initAutoSync();
    });

    if (typeof window !== 'undefined') {
      window.addEventListener('focus', () => this.fetchCloudNotes());
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
          if (!document.hidden) this.fetchCloudNotes();
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
      // Sincronización en vivo cada 3 segundos
      this.syncTimerSubscription = setInterval(() => {
        this.fetchCloudNotes();
      }, 3000);
    }
  }

  private getAllStorageNotes(): Note[] {
    const data = localStorage.getItem(NOTES_STORAGE_KEY);
    if (!data) return [];
    try {
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  private saveAllStorageNotes(allNotes: Note[]): void {
    localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(allNotes));
  }

  /**
   * Elimina automáticamente las tareas que han permanecido en estado "completada" durante 15 días continuos.
   * Si la tarea fue reabierta antes de los 15 días, su contador se reinició.
   */
  /**
   * Elimina automáticamente las tareas que han permanecido en estado "completada" durante 15 días continuos.
   * Si la tarea fue reabierta antes de los 15 días, su contador se reinició.
   */
  private cleanExpiredCompletedNotes(notes: Note[]): { valid: Note[]; hasChanges: boolean } {
    const now = Date.now();
    const maxAgeMs = COMPLETED_TASK_AUTO_DELETE_DAYS * 24 * 60 * 60 * 1000;

    let hasChanges = false;
    const valid = notes.filter(note => {
      if (note.status === 'completada') {
        if (!note.completedAt) {
          note.completedAt = note.createdAt || new Date().toISOString();
          hasChanges = true;
        }

        const completedTime = new Date(note.completedAt).getTime();
        if (!isNaN(completedTime) && (now - completedTime) >= maxAgeMs) {
          hasChanges = true;
          return false; // Auto-eliminar tras 15 días seguidos completada
        }
      }
      return true;
    });

    return { valid, hasChanges };
  }

  /**
   * Calcula la siguiente fecha límite según la periodicidad.
   */
  public calculateNextDueDate(baseDateStr: string, frequency: RecurrenceFrequency): string {
    const base = baseDateStr ? new Date(baseDateStr + 'T12:00:00') : new Date();
    if (isNaN(base.getTime())) {
      const today = new Date();
      base.setFullYear(today.getFullYear(), today.getMonth(), today.getDate());
    }

    const next = new Date(base);
    switch (frequency) {
      case 'diaria':
        next.setDate(next.getDate() + 1);
        break;
      case 'semanal':
        next.setDate(next.getDate() + 7);
        break;
      case 'mensual':
        next.setMonth(next.getMonth() + 1);
        break;
      case 'anual':
        next.setFullYear(next.getFullYear() + 1);
        break;
      default:
        break;
    }

    const year = next.getFullYear();
    const month = String(next.getMonth() + 1).padStart(2, '0');
    const day = String(next.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Determina cuántos días antes de la fecha límite debe crearse automáticamente la siguiente tarea.
   * Mensual: 7 días (1 semana) antes.
   * Semanal: 3 días antes.
   * Diaria: 1 día antes.
   * Anual: 14 días (2 semanas) antes.
   */
  public getAdvanceSpawnDays(frequency: RecurrenceFrequency): number {
    switch (frequency) {
      case 'diaria': return 1;
      case 'semanal': return 3;
      case 'mensual': return 7;
      case 'anual': return 14;
      default: return 0;
    }
  }

  public getRecurrenceLabel(frequency?: RecurrenceFrequency): string {
    switch (frequency) {
      case 'diaria': return 'Diaria';
      case 'semanal': return 'Semanal';
      case 'mensual': return 'Mensual';
      case 'anual': return 'Anual';
      default: return 'Sin repetición';
    }
  }

  /**
   * Procesa la regeneración anticipada de tareas recurrentes vinculadas al usuario activo.
   */
  private processRecurringTasks(notes: Note[]): { updatedNotes: Note[]; hasChanges: boolean } {
    if (!this.currentUserId) return { updatedNotes: notes, hasChanges: false };

    let hasChanges = false;
    const now = Date.now();
    const updatedNotes = [...notes];
    const newlySpawned: Note[] = [];

    for (const note of updatedNotes) {
      if (note.userId !== this.currentUserId) continue;
      if (!note.recurrence || note.recurrence === 'ninguna') continue;

      const baseDate = note.dueDate || (note.createdAt ? note.createdAt.split('T')[0] : '');
      if (!baseDate) continue;

      const nextTargetDate = this.calculateNextDueDate(baseDate, note.recurrence);
      
      // Verificar si ya fue generada previamente para esta fecha
      if (note.recurrenceGeneratedFor === nextTargetDate) {
        continue;
      }

      // Verificar si ya existe una tarea activa con esta misma fecha y raíz
      const rootId = note.parentRecurringId || note.id;
      const alreadyExists = updatedNotes.some(n => 
        n.userId === this.currentUserId &&
        (n.id === rootId || n.parentRecurringId === rootId) &&
        n.dueDate === nextTargetDate
      );

      if (alreadyExists) {
        note.recurrenceGeneratedFor = nextTargetDate;
        hasChanges = true;
        continue;
      }

      // Evaluar si estamos dentro de la ventana de anticipación o si la tarea actual ya fue completada
      const advanceDays = this.getAdvanceSpawnDays(note.recurrence);
      const targetTime = new Date(nextTargetDate + 'T00:00:00').getTime();
      const advanceMs = advanceDays * 24 * 60 * 60 * 1000;
      const shouldSpawn = note.status === 'completada' || (targetTime - now) <= advanceMs;

      if (shouldSpawn) {
        const spawnedNote: Note = {
          id: 'note_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
          userId: this.currentUserId,
          title: note.title,
          content: note.content,
          priority: note.priority,
          categoryId: note.categoryId,
          createdAt: new Date().toISOString(),
          dueDate: nextTargetDate,
          status: 'pendiente',
          isPinned: false,
          recurrence: note.recurrence,
          parentRecurringId: rootId,
          checklist: note.checklist ? note.checklist.map(item => ({
            id: 'chk_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            text: item.text,
            completed: false
          })) : undefined
        };

        newlySpawned.push(spawnedNote);
        note.recurrenceGeneratedFor = nextTargetDate;
        note.nextRecurrenceDate = nextTargetDate;
        hasChanges = true;
      }
    }

    if (newlySpawned.length > 0) {
      updatedNotes.unshift(...newlySpawned);
    }

    return { updatedNotes, hasChanges };
  }

  public refreshNotesForCurrentUser(): void {
    if (!this.currentUserId) {
      this.notesSubject.next([]);
      return;
    }

    let allNotes = this.getAllStorageNotes();
    
    // 1. Limpieza de completadas de más de 15 días
    const cleanResult = this.cleanExpiredCompletedNotes(allNotes);
    allNotes = cleanResult.valid;
    let hasChanges = cleanResult.hasChanges;

    // 2. Procesamiento de recurrencia periódica con anticipación
    const recurringResult = this.processRecurringTasks(allNotes);
    allNotes = recurringResult.updatedNotes;
    if (recurringResult.hasChanges) {
      hasChanges = true;
    }

    if (hasChanges) {
      this.saveAllStorageNotes(allNotes);
    }

    // Filtrar tareas que pertenecen al usuario activo
    const userNotes = allNotes.filter(n => n.userId === this.currentUserId || (!n.userId && this.currentUserId === 'usr_superadmin'));
    this.notesSubject.next(userNotes);

    // 3. Sincronización en tiempo real con MongoDB Atlas en la nube
    this.fetchCloudNotes();
  }

  public fetchCloudNotes(): void {
    if (!this.currentUserId) return;

    this.http.get<{ success: boolean; notes: Note[] }>('/api/notes').subscribe({
      next: (res) => {
        if (res && res.success && Array.isArray(res.notes)) {
          const cloudNotes = res.notes;
          let allNotes = this.getAllStorageNotes();

          // Mantener notas de otras cuentas si las hay y actualizar las del usuario activo con MongoDB
          const otherUsersNotes = allNotes.filter(n => n.userId && n.userId !== this.currentUserId);
          const mergedAll = [...cloudNotes, ...otherUsersNotes];

          this.saveAllStorageNotes(mergedAll);
          this.notesSubject.next(cloudNotes);
        }
      },
      error: () => {}
    });
  }

  public getNotes(): Note[] {
    return this.notesSubject.getValue();
  }

  public getNoteById(id: string): Note | undefined {
    return this.getNotes().find(n => n.id === id);
  }

  public addNote(noteData: Omit<Note, 'id' | 'createdAt'>): Note {
    const userId = this.currentUserId || 'anonymous';
    const isCompleted = noteData.status === 'completada';

    const newNote: Note = {
      ...noteData,
      id: 'note_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      userId,
      createdAt: new Date().toISOString(),
      completedAt: isCompleted ? new Date().toISOString() : undefined
    };

    const allNotes = this.getAllStorageNotes();
    const updatedAll = [newNote, ...allNotes];
    this.saveAllStorageNotes(updatedAll);

    this.refreshNotesForCurrentUser();

    // Sincronizar creación en MongoDB Atlas
    this.http.post('/api/notes', newNote).subscribe({ error: () => {} });

    return newNote;
  }

  public updateNote(id: string, changes: Partial<Note>): Note | undefined {
    const allNotes = this.getAllStorageNotes();
    const index = allNotes.findIndex(n => n.id === id && (n.userId === this.currentUserId || !n.userId));
    if (index === -1) return undefined;

    const oldNote = allNotes[index];
    const updatedNote: Note = { ...oldNote, ...changes };

    // Manejo de fecha de completada y reinicio si se reabre
    if (changes.status) {
      if (changes.status === 'completada') {
        if (!updatedNote.completedAt) {
          updatedNote.completedAt = new Date().toISOString();
        }
      } else {
        delete updatedNote.completedAt;
      }
    }

    allNotes[index] = updatedNote;
    this.saveAllStorageNotes(allNotes);
    this.refreshNotesForCurrentUser();

    // Sincronizar actualización en MongoDB Atlas
    this.http.put('/api/notes', updatedNote).subscribe({ error: () => {} });

    return updatedNote;
  }

  public deleteNote(id: string): boolean {
    const allNotes = this.getAllStorageNotes();
    const filtered = allNotes.filter(n => n.id !== id);
    this.saveAllStorageNotes(filtered);

    const currentUserNotes = filtered.filter(n => n.userId === this.currentUserId);
    this.notesSubject.next(currentUserNotes);

    // Sincronizar eliminación en MongoDB Atlas
    this.http.delete('/api/notes?id=' + id).subscribe({ error: () => {} });

    return true;
  }

  public toggleStatus(id: string): Note | undefined {
    const note = this.getNoteById(id);
    if (!note) return undefined;
    const newStatus: NoteStatus = note.status === 'completada' ? 'pendiente' : 'completada';
    return this.updateNote(id, { 
      status: newStatus,
      completedAt: newStatus === 'completada' ? new Date().toISOString() : undefined
    });
  }

  public getCompletedDaysRemaining(note: Note): number {
    if (note.status !== 'completada') {
      return COMPLETED_TASK_AUTO_DELETE_DAYS;
    }
    const completedAtStr = note.completedAt || note.createdAt;
    if (!completedAtStr) return COMPLETED_TASK_AUTO_DELETE_DAYS;

    const completedTime = new Date(completedAtStr).getTime();
    if (isNaN(completedTime)) return COMPLETED_TASK_AUTO_DELETE_DAYS;

    const elapsedDays = (Date.now() - completedTime) / (24 * 60 * 60 * 1000);
    const remaining = Math.ceil(COMPLETED_TASK_AUTO_DELETE_DAYS - elapsedDays);
    return Math.max(0, Math.min(COMPLETED_TASK_AUTO_DELETE_DAYS, remaining));
  }

  public togglePin(id: string): Note | undefined {
    const note = this.getNoteById(id);
    if (!note) return undefined;
    return this.updateNote(id, { isPinned: !note.isPinned });
  }

  public toggleChecklistItem(noteId: string, itemId: string): Note | undefined {
    const note = this.getNoteById(noteId);
    if (!note || !note.checklist) return undefined;
    const updatedChecklist = note.checklist.map(item =>
      item.id === itemId ? { ...item, completed: !item.completed } : item
    );
    return this.updateNote(noteId, { checklist: updatedChecklist });
  }

  public filterAndSortNotes(
    notes: Note[],
    searchTerm: string = '',
    categoryId: string = 'all',
    priority: string = 'all',
    status: string = 'all',
    sortBy: string = 'priority-desc'
  ): Note[] {
    let result = notes.slice();

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      result = result.filter(n =>
        n.title.toLowerCase().includes(term) ||
        n.content.toLowerCase().includes(term)
      );
    }

    if (categoryId && categoryId !== 'all') {
      result = result.filter(n => n.categoryId === categoryId);
    }

    if (priority && priority !== 'all') {
      result = result.filter(n => n.priority === priority);
    }

    if (status && status !== 'all') {
      result = result.filter(n => n.status === status);
    }

    result.sort((a, b) => {
      if (a.isPinned !== b.isPinned) {
        return a.isPinned ? -1 : 1;
      }

      const priorityOrder: Record<PriorityLevel, number> = {
        alta: 3,
        media: 2,
        baja: 1
      };

      if (sortBy === 'priority-desc') {
        const diff = priorityOrder[b.priority] - priorityOrder[a.priority];
        if (diff !== 0) { return diff; }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }

      if (sortBy === 'priority-asc') {
        const diff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (diff !== 0) { return diff; }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }

      if (sortBy === 'date-desc') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }

      if (sortBy === 'date-asc') {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }

      if (sortBy === 'dueDate-asc') {
        if (!a.dueDate) { return 1; }
        if (!b.dueDate) { return -1; }
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }

      return 0;
    });

    return result;
  }

  private openModalRequestSubject = new Subject<{ open: boolean; note?: Note | null }>();
  public openModalRequest$ = this.openModalRequestSubject.asObservable();

  public requestOpenCreateModal(note: Note | null = null): void {
    this.openModalRequestSubject.next({ open: true, note });
  }

  public closeCreateModal(): void {
    this.openModalRequestSubject.next({ open: false, note: null });
  }
}
