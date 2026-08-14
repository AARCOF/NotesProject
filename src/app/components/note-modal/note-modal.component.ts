import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { Note, PriorityLevel, NoteStatus } from '../../models/note.model';
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

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['noteToEdit'] || changes['isVisible']) {
      if (this.noteToEdit) {
        this.title = this.noteToEdit.title;
        this.content = this.noteToEdit.content;
        this.priority = this.noteToEdit.priority;
        this.categoryId = this.noteToEdit.categoryId;
        this.status = this.noteToEdit.status;
        this.dueDate = this.noteToEdit.dueDate || '';
        this.isPinned = this.noteToEdit.isPinned || false;
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
    this.status = 'pendiente';
    this.dueDate = new Date().toISOString().split('T')[0];
    this.isPinned = false;
  }

  onClose(): void {
    this.close.emit();
  }

  onSubmit(): void {
    if (!this.title.trim()) return;

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
          isPinned: this.isPinned
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
        isPinned: this.isPinned
      });
    }

    this.onClose();
  }
}
