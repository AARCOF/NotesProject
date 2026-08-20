import { Component, OnInit, HostListener } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { Router, NavigationEnd } from '@angular/router';
import { AutomatedReminderService } from './core/services/automated-reminder.service';
import { filter } from 'rxjs/operators';
import { AuthService } from './core/services/auth.service';
import { User } from './core/models/user.model';
import { NotesService } from './services/notes.service';
import { Note } from './models/note.model';
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
  globalTasks: Note[] = [];

  // Mobile App Layout State
  isMobileView: boolean = false;
  isMobileQuickNotesOpen: boolean = false;

  constructor(
    private titleService: Title,
    public router: Router,
    private authService: AuthService,
    private automatedReminderService: AutomatedReminderService,
    private notesService: NotesService
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
    });

    this.notesService.notes$.subscribe(notes => {
      this.globalTasks = notes;
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
      // Si está en gastos, navegar o abrir
      this.router.navigate(['/expenses']);
    } else {
      // Abrir modal de notas
      if (this.router.url !== '/dashboard') {
        this.router.navigate(['/dashboard']).then(() => {
          setTimeout(() => this.notesService.requestOpenCreateModal(), 150);
        });
      } else {
        this.notesService.requestOpenCreateModal();
      }
    }
  }

  public toggleMobileQuickNotes(): void {
    this.isMobileQuickNotesOpen = !this.isMobileQuickNotesOpen;
  }

  private checkTutorialState(): void {
    if (this.currentUser && this.currentUser.hasCompletedTutorial === false && this.authService.isAuthenticated()) {
      this.showTutorial = true;
    } else {
      this.showTutorial = false;
    }
  }

  onTutorialCompleted(): void {
    this.showTutorial = false;
  }
}


