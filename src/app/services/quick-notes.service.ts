import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { QuickNote } from '../models/quick-note.model';
import { AuthService } from '../core/services/auth.service';

const QUICK_NOTES_STORAGE_KEY = 'noteyou_quick_notes_v1';

@Injectable({
  providedIn: 'root'
})
export class QuickNotesService {
  private quickNotesSubject = new BehaviorSubject<QuickNote[]>([]);
  public quickNotes$: Observable<QuickNote[]> = this.quickNotesSubject.asObservable();

  constructor(private authService: AuthService) {
    this.loadQuickNotes();
  }

  private loadQuickNotes(): void {
    const data = localStorage.getItem(QUICK_NOTES_STORAGE_KEY);
    let allNotes: QuickNote[] = [];
    if (data) {
      try {
        allNotes = JSON.parse(data);
      } catch {
        allNotes = [];
      }
    }

    const now = Date.now();
    const validNotes = allNotes.filter(n => n.expiresAt > now);

    if (validNotes.length !== allNotes.length) {
      localStorage.setItem(QUICK_NOTES_STORAGE_KEY, JSON.stringify(validNotes));
    }

    this.quickNotesSubject.next(validNotes);
  }

  private saveToStorage(notes: QuickNote[]): void {
    localStorage.setItem(QUICK_NOTES_STORAGE_KEY, JSON.stringify(notes));
    this.quickNotesSubject.next(notes);
  }

  public getQuickNotes(): QuickNote[] {
    const currentUser = this.authService.getCurrentUser();
    const all = this.quickNotesSubject.getValue();
    const now = Date.now();
    const valid = all.filter(n => n.expiresAt > now);

    if (!currentUser) return valid;
    return valid.filter(n => n.userId === currentUser.id);
  }

  public addQuickNote(content: string, linkedTaskId?: string, retentionDays: number = 7): QuickNote {
    const currentUser = this.authService.getCurrentUser();
    const userId = currentUser ? currentUser.id : 'anonymous';
    
    const now = Date.now();
    const retentionMs = retentionDays * 24 * 60 * 60 * 1000;
    const expiresAt = now + retentionMs;

    let retentionLabel = '1 Semana';
    if (retentionDays === 1) retentionLabel = '1 Día';
    else if (retentionDays === 3) retentionLabel = '3 Días';
    else if (retentionDays === 7) retentionLabel = '1 Semana';
    else if (retentionDays === 14) retentionLabel = '2 Semanas';
    else if (retentionDays === 30) retentionLabel = '1 Mes';

    const newQuickNote: QuickNote = {
      id: 'qn_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      userId,
      content: content.trim(),
      createdAt: new Date().toISOString(),
      linkedTaskId: linkedTaskId || undefined,
      expiresAt,
      retentionLabel
    };

    const all = this.quickNotesSubject.getValue();
    const updated = [newQuickNote, ...all];
    this.saveToStorage(updated);
    return newQuickNote;
  }

  public deleteQuickNote(id: string): void {
    const all = this.quickNotesSubject.getValue();
    const filtered = all.filter(n => n.id !== id);
    this.saveToStorage(filtered);
  }
}
