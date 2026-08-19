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
    // Keep notes that are marked as permanent OR whose expiration has not elapsed
    const validNotes = allNotes.filter(n => n.isPermanent || n.expiresAt > now);

    if (validNotes.length !== allNotes.length) {
      this.saveAllStorageNotes(validNotes);
    }

    const userNotes = validNotes.filter(n => n.userId === this.currentUserId);
    this.quickNotesSubject.next(userNotes);
  }

  public getQuickNotes(): QuickNote[] {
    return this.quickNotesSubject.getValue();
  }

  public addQuickNote(content: string, linkedTaskId?: string, retentionDays: number = 7, isPermanent: boolean = false): QuickNote {
    const userId = this.currentUserId || 'anonymous';
    const now = Date.now();

    let expiresAt = 0;
    let retentionLabel = 'Permanente';
    const permanent = isPermanent || Number(retentionDays) === -1;

    if (permanent) {
      expiresAt = Number.MAX_SAFE_INTEGER;
      retentionLabel = 'Permanente';
    } else {
      const days = Number(retentionDays);
      const retentionMs = days * 24 * 60 * 60 * 1000;
      expiresAt = now + retentionMs;

      if (days === 1) retentionLabel = '1 Día';
      else if (days === 3) retentionLabel = '3 Días';
      else if (days === 7) retentionLabel = '1 Semana';
      else if (days === 14) retentionLabel = '2 Semanas';
      else if (days === 30) retentionLabel = '1 Mes';
      else retentionLabel = `${days} Días`;
    }

    const newQuickNote: QuickNote = {
      id: 'qn_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      userId,
      content: content.trim(),
      createdAt: new Date().toISOString(),
      linkedTaskId: linkedTaskId || undefined,
      expiresAt,
      retentionLabel,
      isPermanent: permanent
    };

    const all = this.getAllStorageNotes();
    const updated = [newQuickNote, ...all];
    this.saveAllStorageNotes(updated);
    this.loadQuickNotes();
    return newQuickNote;
  }

  public togglePermanent(id: string): void {
    const all = this.getAllStorageNotes();
    const note = all.find(n => n.id === id);
    if (!note) return;

    if (note.isPermanent) {
      note.isPermanent = false;
      const now = Date.now();
      note.expiresAt = now + (7 * 24 * 60 * 60 * 1000); // 7 days from now
      note.retentionLabel = '1 Semana';
    } else {
      note.isPermanent = true;
      note.expiresAt = Number.MAX_SAFE_INTEGER;
      note.retentionLabel = 'Permanente';
    }

    this.saveAllStorageNotes(all);
    this.loadQuickNotes();
  }

  public deleteQuickNote(id: string): void {
    const all = this.getAllStorageNotes();
    const filtered = all.filter(n => !(n.id === id && (n.userId === this.currentUserId || !n.userId)));
    this.saveAllStorageNotes(filtered);
    this.loadQuickNotes();
  }
}
