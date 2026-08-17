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
  private currentUserId: string | null = null;

  constructor(private authService: AuthService) {
    this.authService.currentUser$.subscribe(user => {
      this.currentUserId = user ? user.id : null;
      this.loadQuickNotes();
    });
  }

  private getAllStorageNotes(): QuickNote[] {
    const data = localStorage.getItem(QUICK_NOTES_STORAGE_KEY);
    if (!data) return [];
    try {
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  private saveAllStorageNotes(notes: QuickNote[]): void {
    localStorage.setItem(QUICK_NOTES_STORAGE_KEY, JSON.stringify(notes));
  }

  private loadQuickNotes(): void {
    if (!this.currentUserId) {
      this.quickNotesSubject.next([]);
      return;
    }

    const allNotes = this.getAllStorageNotes();
    const now = Date.now();
    const validNotes = allNotes.filter(n => n.expiresAt > now);

    if (validNotes.length !== allNotes.length) {
      this.saveAllStorageNotes(validNotes);
    }

    const userNotes = validNotes.filter(n => n.userId === this.currentUserId);
    this.quickNotesSubject.next(userNotes);
  }

  public getQuickNotes(): QuickNote[] {
    return this.quickNotesSubject.getValue();
  }

  public addQuickNote(content: string, linkedTaskId?: string, retentionDays: number = 7): QuickNote {
    const userId = this.currentUserId || 'anonymous';
    
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

    const all = this.getAllStorageNotes();
    const updated = [newQuickNote, ...all];
    this.saveAllStorageNotes(updated);
    this.loadQuickNotes();
    return newQuickNote;
  }

  public deleteQuickNote(id: string): void {
    const all = this.getAllStorageNotes();
    const filtered = all.filter(n => !(n.id === id && (n.userId === this.currentUserId || !n.userId)));
    this.saveAllStorageNotes(filtered);
    this.loadQuickNotes();
  }
}
