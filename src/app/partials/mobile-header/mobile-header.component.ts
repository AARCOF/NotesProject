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

  notesViewMode: 'kanban' | 'grid' | 'categorias' | 'graficos' = 'kanban';
  expensesActiveTab: 'gestion' | 'movimientos' | 'categorias' | 'graficas' = 'gestion';

  ngOnInit(): void {
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
    });

    this.notesService.activeViewMode$.subscribe(mode => {
      this.notesViewMode = mode;
    });

    this.expenseService.activeTab$.subscribe(tab => {
      this.expensesActiveTab = tab;
    });
  }

  get isNotesRoute(): boolean {
    return this.router.url.includes('/dashboard') || this.router.url === '/';
  }

  get isExpensesRoute(): boolean {
    return this.router.url.includes('/expenses');
  }

  setNotesViewMode(mode: 'kanban' | 'grid' | 'categorias' | 'graficos'): void {
    if (!this.isNotesRoute) {
      this.router.navigate(['/dashboard']).then(() => {
        this.notesService.setViewMode(mode);
      });
    } else {
      this.notesService.setViewMode(mode);
    }
  }

  setExpensesTab(tab: 'gestion' | 'movimientos' | 'categorias' | 'graficas'): void {
    if (!this.isExpensesRoute) {
      this.router.navigate(['/expenses']).then(() => {
        this.expenseService.setActiveTab(tab);
      });
    } else {
      this.expenseService.setActiveTab(tab);
    }
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

  get createButtonLabel(): string {
    if (this.isExpensesRoute) {
      return this.expensesActiveTab === 'categorias' ? 'Nueva Categoría' : 'Nuevo Gasto';
    }
    return this.notesViewMode === 'categorias' ? 'Nueva Categoría' : 'Nueva Tarea';
  }

  onCreateActionClick(): void {
    if (this.isExpensesRoute) {
      if (this.expensesActiveTab === 'categorias') {
        if (this.router.url !== '/expenses') {
          this.router.navigate(['/expenses']).then(() => {
            setTimeout(() => this.expenseService.requestOpenAddCategoryModal(), 150);
          });
        } else {
          this.expenseService.requestOpenAddCategoryModal();
        }
      } else {
        if (this.router.url !== '/expenses') {
          this.router.navigate(['/expenses']).then(() => {
            setTimeout(() => this.expenseService.requestOpenAddExpenseModal(), 150);
          });
        } else {
          this.expenseService.requestOpenAddExpenseModal();
        }
      }
    } else {
      if (this.notesViewMode === 'categorias') {
        if (this.router.url !== '/dashboard') {
          this.router.navigate(['/dashboard']).then(() => {
            setTimeout(() => this.notesService.requestOpenCreateCategoryModal(), 150);
          });
        } else {
          this.notesService.requestOpenCreateCategoryModal();
        }
      } else {
        if (this.router.url !== '/dashboard') {
          this.router.navigate(['/dashboard']).then(() => {
            setTimeout(() => this.notesService.requestOpenCreateModal(), 150);
          });
        } else {
          this.notesService.requestOpenCreateModal();
        }
      }
    }
    this.openCreateTask.emit();
  }

  onLogout(): void {
    if (confirm('¿Deseas cerrar sesión en NoteYou?')) {
      this.authService.logout();
      this.router.navigate(['/login']);
    }
  }
}
