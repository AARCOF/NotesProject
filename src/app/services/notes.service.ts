import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Note, PriorityLevel, NoteStatus } from '../models/note.model';
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

  constructor(private authService: AuthService) {
    this.authService.currentUser$.subscribe(user => {
      this.currentUserId = user ? user.id : null;
      this.refreshNotesForCurrentUser();
    });
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

  public refreshNotesForCurrentUser(): void {
    if (!this.currentUserId) {
      this.notesSubject.next([]);
      return;
    }

    const allNotes = this.getAllStorageNotes();
    const { valid, hasChanges } = this.cleanExpiredCompletedNotes(allNotes);

    if (hasChanges) {
      this.saveAllStorageNotes(valid);
    }

    // Filtrar tareas que pertenecen al usuario activo (o migrar las sin userId al primer usuario)
    const userNotes = valid.filter(n => n.userId === this.currentUserId || (!n.userId && this.currentUserId === 'usr_superadmin'));
    this.notesSubject.next(userNotes);
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
        // Al volver a aperturarse ('pendiente' o 'en_progreso'), se limpia completedAt para reiniciar los 15 días
        delete updatedNote.completedAt;
      }
    }

    allNotes[index] = updatedNote;
    this.saveAllStorageNotes(allNotes);
    this.refreshNotesForCurrentUser();
    return updatedNote;
  }

  public deleteNote(id: string): boolean {
    const allNotes = this.getAllStorageNotes();
    const filtered = allNotes.filter(n => !(n.id === id && (n.userId === this.currentUserId || !n.userId)));
    if (filtered.length === allNotes.length) return false;

    this.saveAllStorageNotes(filtered);
    this.refreshNotesForCurrentUser();
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
}
