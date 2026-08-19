import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { Note } from '../../models/note.model';
import { Category } from '../../models/category.model';

interface CategoryGroup {
  category: Category | null;
  tasks: Note[];
  expanded: boolean;
}

@Component({
  selector: 'app-day-details-modal',
  templateUrl: './day-details-modal.component.html',
  styleUrls: ['./day-details-modal.component.scss']
})
export class DayDetailsModalComponent implements OnChanges {
  @Input() isVisible: boolean = false;
  @Input() date: string = ''; // Format YYYY-MM-DD
  @Input() tasks: Note[] = [];
  @Input() categories: Category[] = [];

  @Output() close = new EventEmitter<void>();
  @Output() createNewTask = new EventEmitter<string>();

  dayTasks: Note[] = [];
  categoryGroups: CategoryGroup[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['isVisible'] || changes['date'] || changes['tasks']) && this.isVisible) {
      this.processTasks();
    }
  }

  processTasks(): void {
    // Parse this.date into comparable values
    const targetDateParts = this.date.split('-');
    const targetYear = parseInt(targetDateParts[0], 10);
    const targetMonth = parseInt(targetDateParts[1], 10) - 1;
    const targetDay = parseInt(targetDateParts[2], 10);

    // Filter tasks robustly ignoring leading zeros
    this.dayTasks = this.tasks.filter(task => {
      if (!task.dueDate) return false;
      const taskDate = new Date(task.dueDate + 'T12:00:00');
      return taskDate.getFullYear() === targetYear &&
             taskDate.getMonth() === targetMonth &&
             taskDate.getDate() === targetDay;
    });

    // Group by categoryId
    const groupsMap = new Map<string, Note[]>();
    
    this.dayTasks.forEach(task => {
      const catId = task.categoryId || 'none';
      if (!groupsMap.has(catId)) {
        groupsMap.set(catId, []);
      }
      groupsMap.get(catId)!.push(task);
    });

    this.categoryGroups = [];
    
    // Sort tasks within groups and create array
    groupsMap.forEach((tasks, catId) => {
      let categoryObj: Category | null = null;
      if (catId !== 'none') {
        categoryObj = this.categories.find(c => c.id === catId) || null;
      }
      
      this.categoryGroups.push({
        category: categoryObj,
        tasks: tasks,
        expanded: true // Expand by default so the user immediately sees the list
      });
    });
  }

  getFormattedDate(): string {
    if (!this.date) return '';
    const parts = this.date.split('-');
    if (parts.length !== 3) return this.date;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const d = new Date(year, month, day);
    
    try {
      return d.toLocaleDateString('es-ES', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    } catch (e) {
      return d.toDateString();
    }
  }

  toggleGroup(group: CategoryGroup): void {
    group.expanded = !group.expanded;
  }

  closeModal(): void {
    this.close.emit();
  }

  onAddNewTask(): void {
    this.createNewTask.emit(this.date);
  }

  getRecurrenceLabel(frequency?: string): string {
    switch (frequency) {
      case 'diaria': return 'Diaria';
      case 'semanal': return 'Semanal';
      case 'mensual': return 'Mensual';
      case 'anual': return 'Anual';
      default: return '';
    }
  }
}
