import { Component, OnInit, OnDestroy } from '@angular/core';
import { Note } from '../../models/note.model';
import { Category } from '../../models/category.model';
import { NotesService } from '../../services/notes.service';
import { CategoriesService } from '../../services/categories.service';
import { Subscription } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-calendar-screen',
  templateUrl: './calendar-screen.component.html',
  styleUrls: ['./calendar-screen.component.scss']
})
export class CalendarScreenComponent implements OnInit, OnDestroy {
  notes: Note[] = [];
  categories: Category[] = [];
  isLoading: boolean = true;
  private subscriptions = new Subscription();

  isModalVisible: boolean = false;
  initialDueDate: string = '';

  isDayDetailsVisible: boolean = false;
  selectedDateForDetails: string = '';

  constructor(
    private notesService: NotesService,
    private categoriesService: CategoriesService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    const userSub = this.authService.currentUser$.subscribe(user => {
      if (user) {
        this.loadNotes();
      }
    });
    this.subscriptions.add(userSub);
  }

  loadNotes(): void {
    this.isLoading = true;
    const notesSub = this.notesService.notes$.subscribe(notes => {
      this.notes = notes;
      this.isLoading = false;
    });
    this.subscriptions.add(notesSub);

    const catSub = this.categoriesService.categories$.subscribe(cats => {
      this.categories = cats;
    });
    this.subscriptions.add(catSub);
  }

  onDayClicked(date: Date): void {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    this.selectedDateForDetails = `${year}-${month}-${day}`;
    this.isDayDetailsVisible = true;
  }

  closeDayDetailsModal(): void {
    this.isDayDetailsVisible = false;
  }

  handleCreateNewTaskFromDay(date: string): void {
    this.initialDueDate = date;
    this.isModalVisible = true;
    this.isDayDetailsVisible = false;
  }

  handleSaveNote(noteData: Omit<Note, 'id' | 'createdAt'>): void {
    this.notesService.addNote(noteData);
    this.isModalVisible = false;
  }

  closeModal(): void {
    this.isModalVisible = false;
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }
}
