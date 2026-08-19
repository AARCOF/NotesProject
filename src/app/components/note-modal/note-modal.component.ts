import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { Note, PriorityLevel, NoteStatus, ChecklistItem, RecurrenceFrequency } from '../../models/note.model';
import { Category } from '../../models/category.model';

@Component({
  selector: 'app-note-modal',
  templateUrl: './note-modal.component.html',
  styleUrls: ['./note-modal.component.scss']
})
export class NoteModalComponent implements OnChanges {
  @Input() isVisible: boolean = false;
  @Input() noteToEdit: Note | null = null;
  @Input() categories: Category[] = [];
  @Input() initialDueDate: string = '';
  @Input() initialStatus: NoteStatus = 'pendiente';

  @Output() save = new EventEmitter<Omit<Note, 'id' | 'createdAt'>>();
  @Output() update = new EventEmitter<{ id: string; changes: Partial<Note> }>();
  @Output() close = new EventEmitter<void>();

  // Form Fields
  title: string = '';
  content: string = '';
  priority: PriorityLevel = 'media';
  categoryId: string = '';
  status: NoteStatus = 'pendiente';
  dueDate: string = '';
  isPinned: boolean = false;
  recurrence: RecurrenceFrequency = 'ninguna';

  // Dynamic Checklist (Viñetas / Lista de Compras / Subtareas)
  checklist: ChecklistItem[] = [];
  newChecklistItemText: string = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['noteToEdit'] || changes['isVisible'] || changes['initialDueDate']) {
      if (this.noteToEdit) {
        this.title = this.noteToEdit.title;
        this.content = this.noteToEdit.content;
        this.priority = this.noteToEdit.priority;
        this.categoryId = this.noteToEdit.categoryId;
        this.status = this.noteToEdit.status;
        this.dueDate = this.noteToEdit.dueDate || '';
        this.isPinned = this.noteToEdit.isPinned || false;
        this.recurrence = this.noteToEdit.recurrence || 'ninguna';
        this.checklist = this.noteToEdit.checklist ? JSON.parse(JSON.stringify(this.noteToEdit.checklist)) : [];
      } else {
        this.resetForm();
      }
    }
  }

  resetForm(): void {
    this.title = '';
    this.content = '';
    this.priority = 'media';
    this.categoryId = this.categories.length > 0 ? this.categories[0].id : '';
    this.status = this.initialStatus || 'pendiente';
    this.dueDate = this.initialDueDate || '';
    this.isPinned = false;
    this.recurrence = 'ninguna';
    this.checklist = [];
    this.newChecklistItemText = '';
  }

  addChecklistItem(): void {
    const text = this.newChecklistItemText.trim();
    if (!text) return;
    this.checklist.push({
      id: 'chk_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      text,
      completed: false
    });
    this.newChecklistItemText = '';
  }

  removeChecklistItem(index: number): void {
    this.checklist.splice(index, 1);
  }

  toggleChecklistItem(index: number): void {
    this.checklist[index].completed = !this.checklist[index].completed;
  }

  get completedChecklistCount(): number {
    return this.checklist.filter(item => item.completed).length;
  }

  onClose(): void {
    this.close.emit();
  }

  onSubmit(): void {
    if (!this.title.trim()) return;

    const checklistToSave = this.checklist.length > 0 ? this.checklist : undefined;

    // Si tiene recurrencia y no tiene fecha límite, asignar hoy como fecha base
    if (this.recurrence !== 'ninguna' && !this.dueDate) {
      const today = new Date();
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, '0');
      const d = String(today.getDate()).padStart(2, '0');
      this.dueDate = `${y}-${m}-${d}`;
    }

    if (this.noteToEdit) {
      this.update.emit({
        id: this.noteToEdit.id,
        changes: {
          title: this.title.trim(),
          content: this.content.trim(),
          priority: this.priority,
          categoryId: this.categoryId,
          status: this.status,
          dueDate: this.dueDate || undefined,
          isPinned: this.isPinned,
          recurrence: this.recurrence !== 'ninguna' ? this.recurrence : undefined,
          checklist: checklistToSave
        }
      });
    } else {
      this.save.emit({
        title: this.title.trim(),
        content: this.content.trim(),
        priority: this.priority,
        categoryId: this.categoryId || (this.categories[0] ? this.categories[0].id : ''),
        status: this.status,
        dueDate: this.dueDate || undefined,
        isPinned: this.isPinned,
        recurrence: this.recurrence !== 'ninguna' ? this.recurrence : undefined,
        checklist: checklistToSave
      });
    }

    this.onClose();
  }
}

