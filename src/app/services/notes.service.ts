import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Note, PriorityLevel, NoteStatus } from '../models/note.model';

const NOTES_STORAGE_KEY = 'noteyou_notes_v2';

@Injectable({
  providedIn: 'root'
})
export class NotesService {
  private notesSubject = new BehaviorSubject<Note[]>([]);
  public notes$: Observable<Note[]> = this.notesSubject.asObservable();

  constructor() {
    this.loadInitialNotes();
  }

  private loadInitialNotes(): void {
    const data = localStorage.getItem(NOTES_STORAGE_KEY);
    if (data) {
      try {
        const parsed = JSON.parse(data);
        this.notesSubject.next(parsed);
        return;
      } catch {
        this.notesSubject.next([]);
      }
    } else {
      this.notesSubject.next([]);
      this.saveToStorage([]);
    }
  }

  private saveToStorage(notes: Note[]): void {
    localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(notes));
    this.notesSubject.next(notes);
  }

  public getNotes(): Note[] {
    return this.notesSubject.getValue();
  }

  public getNoteById(id: string): Note | undefined {
    return this.getNotes().find(n => n.id === id);
  }

  public addNote(noteData: Omit<Note, 'id' | 'createdAt'>): Note {
    const newNote: Note = {
      ...noteData,
      id: 'note_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      createdAt: new Date().toISOString()
    };
    const currentNotes = this.getNotes();
    const updated = [newNote, ...currentNotes];
    this.saveToStorage(updated);
    return newNote;
  }

  public updateNote(id: string, changes: Partial<Note>): Note | undefined {
    const currentNotes = this.getNotes();
    const index = currentNotes.findIndex(n => n.id === id);
    if (index === -1) return undefined;

    const updatedNote = { ...currentNotes[index], ...changes };
    currentNotes[index] = updatedNote;
    this.saveToStorage([...currentNotes]);
    return updatedNote;
  }

  public deleteNote(id: string): boolean {
    const currentNotes = this.getNotes();
    const filtered = currentNotes.filter(n => n.id !== id);
    if (filtered.length === currentNotes.length) return false;
    this.saveToStorage(filtered);
    return true;
  }

  public toggleStatus(id: string): Note | undefined {
    const note = this.getNoteById(id);
    if (!note) return undefined;
    const newStatus: NoteStatus = note.status === 'completada' ? 'pendiente' : 'completada';
    return this.updateNote(id, { status: newStatus });
  }

  public togglePin(id: string): Note | undefined {
    const note = this.getNoteById(id);
    if (!note) return undefined;
    return this.updateNote(id, { isPinned: !note.isPinned });
  }

  public filterAndSortNotes(
    notes: Note[],
    searchTerm: string = '',
    categoryId: string = 'all',
    priority: string = 'all',
    status: string = 'all',
    sortBy: string = 'priority-desc'
  ): Note[] {
    let result = [...notes];

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
        if (diff !== 0) return diff;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }

      if (sortBy === 'priority-asc') {
        const diff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (diff !== 0) return diff;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }

      if (sortBy === 'date-desc') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }

      if (sortBy === 'date-asc') {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }

      if (sortBy === 'dueDate-asc') {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }

      return 0;
    });

    return result;
  }
}
