import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, OnInit } from '@angular/core';
import { Note } from '../../models/note.model';
import { CategoriesService } from '../../services/categories.service';

export interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  tasks: Note[];
  isToday: boolean;
}

@Component({
  selector: 'app-task-calendar',
  templateUrl: './task-calendar.component.html',
  styleUrls: ['./task-calendar.component.scss']
})
export class TaskCalendarComponent implements OnChanges, OnInit {
  @Input() tasks: Note[] = [];
  @Output() dayClick = new EventEmitter<Date>();
  
  currentDate: Date = new Date();
  todayDate: Date = new Date();
  selectedDate: Date | null = null;
  weeks: CalendarDay[][] = [];
  
  weekDays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  constructor(private categoriesService: CategoriesService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['tasks']) {
      this.generateCalendar();
    }
  }

  ngOnInit(): void {
    this.generateCalendar();
  }

  onDayClick(day: CalendarDay): void {
    this.selectedDate = day.date;
    this.dayClick.emit(day.date);
  }

  generateCalendar(): void {
    this.weeks = [];
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    
    // First day of the month
    const firstDay = new Date(year, month, 1);
    // Last day of the month
    const lastDay = new Date(year, month + 1, 0);
    
    let currentWeek: CalendarDay[] = [];
    
    // Fill previous month trailing days
    const startDayOfWeek = firstDay.getDay(); // 0 is Sunday
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      currentWeek.push(this.createCalendarDay(d, false));
    }
    
    // Fill current month days
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const d = new Date(year, month, i);
      currentWeek.push(this.createCalendarDay(d, true));
      
      if (currentWeek.length === 7) {
        this.weeks.push(currentWeek);
        currentWeek = [];
      }
    }
    
    // Fill next month leading days
    if (currentWeek.length > 0) {
      let nextMonthDay = 1;
      while (currentWeek.length < 7) {
        const d = new Date(year, month + 1, nextMonthDay++);
        currentWeek.push(this.createCalendarDay(d, false));
      }
      this.weeks.push(currentWeek);
    }
  }

  createCalendarDay(date: Date, isCurrentMonth: boolean): CalendarDay {
    // Normalize date to 00:00:00 for accurate comparison
    const compareDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    // Check if is today
    const now = new Date();
    const isToday = compareDate.getFullYear() === now.getFullYear() &&
                    compareDate.getMonth() === now.getMonth() &&
                    compareDate.getDate() === now.getDate();

    // Find tasks that have a dueDate matching this day
    const dayTasks = this.tasks.filter(task => {
      if (!task.dueDate) return false;
      const taskDate = new Date(task.dueDate + 'T12:00:00'); // Prevent timezone shifts
      return taskDate.getFullYear() === compareDate.getFullYear() &&
             taskDate.getMonth() === compareDate.getMonth() &&
             taskDate.getDate() === compareDate.getDate();
    });

    return {
      date,
      isCurrentMonth,
      tasks: dayTasks,
      isToday
    };
  }

  previousMonth(): void {
    this.currentDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() - 1, 1);
    this.generateCalendar();
  }

  nextMonth(): void {
    this.currentDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 1);
    this.generateCalendar();
  }

  goToToday(): void {
    this.currentDate = new Date();
    this.selectedDate = new Date();
    this.generateCalendar();
    this.dayClick.emit(this.currentDate);
  }

  isSelected(date: Date): boolean {
    if (!this.selectedDate) return false;
    return this.selectedDate.getFullYear() === date.getFullYear() &&
           this.selectedDate.getMonth() === date.getMonth() &&
           this.selectedDate.getDate() === date.getDate();
  }

  getCategoryColor(categoryId: string): string {
    const category = this.categoriesService.getCategoryById(categoryId);
    return category ? category.color : '#3b82f6';
  }
}
