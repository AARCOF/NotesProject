import { Component, OnInit, HostListener } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { Router, NavigationEnd } from '@angular/router';
import { AutomatedReminderService } from './core/services/automated-reminder.service';
import { filter } from 'rxjs/operators';
import { AuthService } from './core/services/auth.service';
import { User } from './core/models/user.model';
import { NotesService } from './services/notes.service';
import { ExpenseService } from './services/expense.service';
import { Note } from './models/note.model';
import { QuickNotesService } from './services/quick-notes.service';
import { SavedLinksService } from './services/saved-links.service';
import { SharedTasksService } from './services/shared-tasks.service';
import { ModalDialogService } from './services/modal-dialog.service';
import { AppUpdateService } from './core/services/app-update.service';
import { Capacitor } from '@capacitor/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  title = 'NoteYou - Tu Espacio de Notas';
  showNav: boolean = true;
  showQuickNotes: boolean = true;
  currentUser: User | null = null;
  showTutorial: boolean = false;
  showCollaborationModal: boolean = false;
  globalTasks: Note[] = [];
  quickNotesCount: number = 0;

  // Mobile App Layout State
  isMobileView: boolean = false;
  isMobileQuickNotesOpen: boolean = false;

  constructor(
    private titleService: Title,
    public router: Router,
    private authService: AuthService,
    private automatedReminderService: AutomatedReminderService,
    private notesService: NotesService,
    private expenseService: ExpenseService,
    private quickNotesService: QuickNotesService,
    private savedLinksService: SavedLinksService,
    private sharedTasksService: SharedTasksService,
    public dialogService: ModalDialogService,
    public appUpdateService: AppUpdateService
  ) {
    this.checkScreenSize();
  }

  @HostListener('window:resize')
  onResize(): void {
    this.checkScreenSize();
  }

  private checkScreenSize(): void {
    const isMobileDevice = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    const isCapacitor = Capacitor.isNativePlatform();
    const isSmallScreen = window.innerWidth < 992;
    this.isMobileView = isCapacitor || isMobileDevice || isSmallScreen;
  }

  ngOnInit(): void {
    this.checkScreenSize();

    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      const url = event.urlAfterRedirects || event.url;
      this.updateLayoutState(url);
    });

    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      this.updateLayoutState(this.router.url);
      this.checkTutorialState();
      this.checkCollaborationPrompt();
    });

    this.notesService.notes$.subscribe(notes => {
      this.globalTasks = notes;
    });

    this.quickNotesService.quickNotes$.subscribe(notes => {
      this.quickNotesCount = notes ? notes.length : 0;
    });
  }

  private updateLayoutState(url: string): void {
    const isStandalonePage = url.includes('/landing') || url.includes('/login') || url.includes('/register') || url.includes('/verify-email') || url === '/';
    this.showNav = !isStandalonePage && this.authService.isAuthenticated();

    // En vista móvil o en Gastos no se muestra la columna fija de escritorio
    const isExpensesPage = url.includes('/expenses');
    this.showQuickNotes = this.showNav && !isExpensesPage && !this.isMobileView;
  }

  public onFabCreate(): void {
    if (this.router.url.includes('/expenses')) {
      if (this.expenseService.getActiveTab() === 'categorias') {
        this.expenseService.requestOpenAddCategoryModal();
      } else {
        this.expenseService.requestOpenAddExpenseModal();
      }
    } else if (this.router.url.includes('/saved-links')) {
      this.savedLinksService.requestOpenAddLinkModal();
    } else if (this.router.url.includes('/shared-tasks')) {
      this.sharedTasksService.requestOpenCreateTaskModal();
    } else {
      if (this.notesService.getViewMode() === 'categorias') {
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
  }

  public toggleMobileQuickNotes(): void {
    this.isMobileQuickNotesOpen = !this.isMobileQuickNotesOpen;
  }

  private checkTutorialState(): void {
    if (!this.currentUser || !this.authService.isAuthenticated()) {
      this.showTutorial = false;
      return;
    }

    // Admins y superadmins nunca ven el tutorial de bienvenida
    if (this.currentUser.role === 'superadmin' || this.currentUser.role === 'admin') {
      this.showTutorial = false;
      return;
    }

    const userId = this.currentUser.id;
    const email = (this.currentUser.email || '').toLowerCase();
    const localFlag = localStorage.getItem('noteyou_tutorial_completed_' + userId) || 
                      localStorage.getItem('noteyou_tutorial_completed_' + email) ||
                      localStorage.getItem('noteyou_tutorial_completed_global');

    // Si ya completó el tutorial previamente en la nube, en local, o si ya tiene tareas creadas
    const hasExistingData = this.globalTasks && this.globalTasks.length > 0;

    if (localFlag === 'true' || this.currentUser.hasCompletedTutorial === true || hasExistingData) {
      this.showTutorial = false;
      if (!localFlag) {
        localStorage.setItem('noteyou_tutorial_completed_' + userId, 'true');
        localStorage.setItem('noteyou_tutorial_completed_' + email, 'true');
        localStorage.setItem('noteyou_tutorial_completed_global', 'true');
      }
    } else {
      this.showTutorial = true;
    }
  }

  private checkCollaborationPrompt(): void {
    // Solo mostrar a usuarios normales (no superadmin ni admin)
    if (!this.currentUser || this.currentUser.role !== 'user') return;

    const storageKey = `noteyou_last_donation_prompt_${this.currentUser.id}`;
    const lastShown = localStorage.getItem(storageKey);
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    let shouldShow = false;

    if (!lastShown) {
      // Primera vez: calcular desde la fecha de creación de la cuenta.
      // Si han pasado >= 7 días desde que se creó la cuenta, mostrar.
      // Para usuarios existentes sin marca, mostrar ahora mismo la primera vez.
      const accountCreatedAt = this.currentUser.createdAt
        ? new Date(this.currentUser.createdAt).getTime()
        : Date.now();
      const daysSinceCreation = Date.now() - accountCreatedAt;
      // Mostrar si han pasado 7 días desde la creación O si nunca se ha mostrado
      // (para que usuarios existentes lo vean ahora y luego cada 7 días)
      shouldShow = daysSinceCreation >= sevenDaysMs || daysSinceCreation >= 0;
    } else {
      // Ya se mostró antes: esperar 7 días desde la última vez que se cerró
      shouldShow = (Date.now() - parseInt(lastShown, 10)) >= sevenDaysMs;
    }

    if (shouldShow) {
      // Delay pequeño para que primero cargue la app
      setTimeout(() => {
        this.showCollaborationModal = true;
      }, 2000);
    }
  }

  onCollaborationModalClose(): void {
    if (this.currentUser) {
      localStorage.setItem(`noteyou_last_donation_prompt_${this.currentUser.id}`, Date.now().toString());
    }
    this.showCollaborationModal = false;
  }

  onTutorialCompleted(): void {
    this.showTutorial = false;
    this.authService.markTutorialAsCompleted();
  }
}


