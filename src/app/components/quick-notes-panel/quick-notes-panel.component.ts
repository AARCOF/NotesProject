import { Component, OnInit, OnDestroy, Input, OnChanges } from '@angular/core';
import { Subscription } from 'rxjs';
import { QuickNote } from '../../models/quick-note.model';
import { Note } from '../../models/note.model';
import { QuickNotesService } from '../../services/quick-notes.service';
import { NotesService } from '../../services/notes.service';

@Component({
  selector: 'app-quick-notes-panel',
  templateUrl: './quick-notes-panel.component.html',
  styleUrls: ['./quick-notes-panel.component.scss']
})
export class QuickNotesPanelComponent implements OnInit, OnDestroy, OnChanges {
  @Input() availableTasks: Note[] = [];

  quickNotes: QuickNote[] = [];
  page: number = 1;
  pageSize: number = 5;
  
  newNoteText: string = '';
  selectedTaskId: string = '';
  retentionDays: number = 7;

  private subscription: Subscription = new Subscription();

  constructor(
    private quickNotesService: QuickNotesService,
    private notesService: NotesService
  ) {}

  ngOnInit(): void {
    this.subscription.add(
      this.quickNotesService.quickNotes$.subscribe(() => {
        this.updateSortedNotes();
      })
    );
    this.subscription.add(
      this.notesService.notes$.subscribe(notes => {
        this.availableTasks = notes;
      })
    );
  }

  openCreateTaskModal(): void {
    this.notesService.requestOpenCreateModal();
  }

  ngOnChanges(): void {
    this.updateSortedNotes();
  }

  updateSortedNotes(): void {
    const notes = this.quickNotesService.getQuickNotes();
    
    this.quickNotes = notes.slice().sort((a, b) => {
      const aPerm = !!a.isPermanent;
      const bPerm = !!b.isPermanent;

      // 1. Las notas permanentes encabezan la lista
      if (aPerm && !bPerm) return -1;
      if (!aPerm && bPerm) return 1;

      // Si ambas son permanentes: ordenar por más reciente (createdAt descendente)
      if (aPerm && bPerm) {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }

      // 2. Para las notas temporales: ordenar por aquellas que se eliminan antes (menor expiresAt primero)
      if (a.expiresAt !== b.expiresAt) {
        return a.expiresAt - b.expiresAt;
      }

      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  get isMobile(): boolean {
    return typeof window !== 'undefined' && window.innerWidth <= 991;
  }

  get paginatedQuickNotes(): QuickNote[] {
    if (this.isMobile) {
      return this.quickNotes;
    }
    const startIndex = (this.page - 1) * this.pageSize;
    return this.quickNotes.slice(startIndex, startIndex + this.pageSize);
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  sendQuickNote(): void {
    if (!this.newNoteText.trim()) return;

    this.quickNotesService.addQuickNote(
      this.newNoteText.trim(),
      this.selectedTaskId || undefined,
      Number(this.retentionDays)
    );

    this.newNoteText = '';
    this.selectedTaskId = '';
    // Keep user's chosen retentionDays or default
  }

  deleteNote(id: string): void {
    this.quickNotesService.deleteQuickNote(id);
  }

  togglePermanent(id: string): void {
    this.quickNotesService.togglePermanent(id);
  }

  get selectedTaskTitle(): string {
    if (!this.selectedTaskId) return 'Sin tarea vinculada';
    const task = this.availableTasks.find(t => t.id === this.selectedTaskId);
    return task ? task.title : 'Sin tarea vinculada';
  }

  getRetentionLabel(days: number): string {
    switch (Number(days)) {
      case -1: return 'Permanente';
      case 1: return '1 Día';
      case 3: return '3 Días';
      case 7: return '1 Sem (7d)';
      case 14: return '2 Sem (14d)';
      case 30: return '1 Mes (30d)';
      default: return `${days} Días`;
    }
  }

  getRemainingTimeLabel(note: QuickNote): string {
    if (note.isPermanent) return 'Permanente';
    const now = Date.now();
    const diffMs = note.expiresAt - now;
    if (diffMs <= 0) return 'Por expirar';
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHrs < 24) {
      if (diffHrs === 0) {
        const diffMin = Math.max(1, Math.floor(diffMs / (1000 * 60)));
        return `Expira en ${diffMin}m`;
      }
      return `Expira en ${diffHrs}h`;
    }
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 1) return 'Expira hoy/mañana';
    return `Expira en ${diffDays}d`;
  }

  selectTask(taskId: string): void {
    this.selectedTaskId = taskId;
  }

  selectRetention(days: number): void {
    this.retentionDays = Number(days);
  }

  getLinkedTaskTitle(taskId?: string): string | null {
    if (!taskId) return null;
    const task = this.availableTasks.find(t => t.id === taskId);
    return task ? task.title : 'Tarea Vinculada';
  }

  getTimeAgo(dateStr: string): string {
    const time = new Date(dateStr).getTime();
    const diffSec = Math.floor((Date.now() - time) / 1000);
    if (diffSec < 60) return 'Ahora';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `Hace ${diffMin} min`;
    const diffHrs = Math.floor(diffMin / 60);
    if (diffHrs < 24) return `Hace ${diffHrs} h`;
    return new Date(dateStr).toLocaleDateString();
  }

  getQuickNoteColor(note: QuickNote, index: number): string {
    if (note.isPermanent) return '#f59e0b';
    const colors = ['#06b6d4', '#6366f1', '#10b981', '#ec4899', '#8b5cf6'];
    return colors[index % colors.length];
  }

  getQuickNoteBorderColor(note: QuickNote, index: number): string {
    const hex = this.getQuickNoteColor(note, index);
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, 0.35)`;
  }
}
