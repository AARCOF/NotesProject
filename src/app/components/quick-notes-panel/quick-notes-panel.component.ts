import { Component, OnInit, OnDestroy, Input, OnChanges } from '@angular/core';
import { Subscription } from 'rxjs';
import { QuickNote } from '../../models/quick-note.model';
import { Note } from '../../models/note.model';
import { QuickNotesService } from '../../services/quick-notes.service';

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

  constructor(private quickNotesService: QuickNotesService) {}

  ngOnInit(): void {
    this.subscription = this.quickNotesService.quickNotes$.subscribe(() => {
      this.updateSortedNotes();
    });
  }

  ngOnChanges(): void {
    this.updateSortedNotes();
  }

  updateSortedNotes(): void {
    const notes = this.quickNotesService.getQuickNotes();
    const priorityValues: Record<string, number> = { 'alta': 3, 'media': 2, 'baja': 1 };
    
    this.quickNotes = notes.slice().sort((a, b) => {
      const aLinked = !!a.linkedTaskId;
      const bLinked = !!b.linkedTaskId;
      if (aLinked && !bLinked) return -1;
      if (!aLinked && bLinked) return 1;

      if (aLinked && bLinked) {
        const taskA = this.availableTasks.find(t => t.id === a.linkedTaskId);
        const taskB = this.availableTasks.find(t => t.id === b.linkedTaskId);
        const pA = taskA ? priorityValues[taskA.priority] || 0 : 0;
        const pB = taskB ? priorityValues[taskB.priority] || 0 : 0;
        
        if (pA !== pB) return pB - pA;
      }

      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  get paginatedQuickNotes(): QuickNote[] {
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
    this.retentionDays = 7;
  }

  deleteNote(id: string): void {
    this.quickNotesService.deleteQuickNote(id);
  }

  get selectedTaskTitle(): string {
    if (!this.selectedTaskId) return 'Sin tarea vinculada';
    const task = this.availableTasks.find(t => t.id === this.selectedTaskId);
    return task ? task.title : 'Sin tarea vinculada';
  }

  getRetentionLabel(days: number): string {
    switch (Number(days)) {
      case 1: return '1 Día';
      case 3: return '3 Días';
      case 7: return '1 Sem';
      case 14: return '2 Sem';
      case 30: return '1 Mes';
      default: return `${days} Días`;
    }
  }

  selectTask(taskId: string): void {
    this.selectedTaskId = taskId;
  }

  selectRetention(days: number): void {
    this.retentionDays = days;
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
}
