import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { Subscription } from 'rxjs';
import { QuickNote } from '../../models/quick-note.model';
import { Note } from '../../models/note.model';
import { QuickNotesService } from '../../services/quick-notes.service';

@Component({
  selector: 'app-quick-notes-panel',
  templateUrl: './quick-notes-panel.component.html',
  styleUrls: ['./quick-notes-panel.component.scss']
})
export class QuickNotesPanelComponent implements OnInit, OnDestroy {
  @Input() availableTasks: Note[] = [];

  quickNotes: QuickNote[] = [];
  newNoteText: string = '';
  selectedTaskId: string = '';
  retentionDays: number = 7;

  private subscription: Subscription = new Subscription();

  constructor(private quickNotesService: QuickNotesService) {}

  ngOnInit(): void {
    this.subscription = this.quickNotesService.quickNotes$.subscribe(() => {
      this.quickNotes = this.quickNotesService.getQuickNotes();
    });
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
