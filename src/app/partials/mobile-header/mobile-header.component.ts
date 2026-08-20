import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { User } from '../../core/models/user.model';
import { NotesService } from '../../services/notes.service';
import { ExpenseService } from '../../services/expense.service';

@Component({
  selector: 'app-mobile-header',
  templateUrl: './mobile-header.component.html',
  styleUrls: ['./mobile-header.component.scss']
})
export class MobileHeaderComponent implements OnInit {
  @Input() title: string = 'NoteYou';
  @Input() showCategories: boolean = false;
  @Input() categories: string[] = ['Todas'];
  @Input() selectedCategory: string = 'Todas';
  @Output() categoryChange = new EventEmitter<string>();
  @Output() openQuickNotes = new EventEmitter<void>();
  @Output() openCreateTask = new EventEmitter<void>();
  @Output() searchToggle = new EventEmitter<boolean>();

  currentUser: User | null = null;
  isSearchOpen: boolean = false;
  searchQuery: string = '';

  constructor(
    private authService: AuthService,
    private notesService: NotesService,
    private expenseService: ExpenseService,
    public router: Router
  ) {}

  ngOnInit(): void {
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
    });
  }

  get isExpensesRoute(): boolean {
    return this.router.url.includes('/expenses');
  }

  get userInitial(): string {
    if (!this.currentUser?.name) return 'U';
    return this.currentUser.name.charAt(0).toUpperCase();
  }

  get userFirstName(): string {
    if (!this.currentUser?.name) return 'Usuario';
    return this.currentUser.name.split(' ')[0];
  }

  onSelectCategory(cat: string): void {
    this.selectedCategory = cat;
    this.categoryChange.emit(cat);
  }

  toggleSearch(): void {
    this.isSearchOpen = !this.isSearchOpen;
    this.searchToggle.emit(this.isSearchOpen);
  }

  onQuickNotesClick(): void {
    this.openQuickNotes.emit();
  }

  onCreateActionClick(): void {
    if (this.isExpensesRoute) {
      this.expenseService.requestOpenAddExpenseModal();
    } else {
      if (this.router.url !== '/dashboard') {
        this.router.navigate(['/dashboard']).then(() => {
          setTimeout(() => this.notesService.requestOpenCreateModal(), 150);
        });
      } else {
        this.notesService.requestOpenCreateModal();
      }
    }
    this.openCreateTask.emit();
  }
}
