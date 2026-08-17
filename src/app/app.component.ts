import { Component, OnInit } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { Router, NavigationEnd } from '@angular/router';
import { AutomatedReminderService } from './core/services/automated-reminder.service';
import { filter } from 'rxjs/operators';
import { AuthService } from './core/services/auth.service';
import { User } from './core/models/user.model';
import { NotesService } from './services/notes.service';
import { Note } from './models/note.model';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  title = 'NoteYou - Tu Espacio de Notas';
  showNav: boolean = true;
  currentUser: User | null = null;
  showTutorial: boolean = false;
  globalTasks: Note[] = [];

  constructor(
    private titleService: Title,
    private router: Router,
    private authService: AuthService,
    private automatedReminderService: AutomatedReminderService,
    private notesService: NotesService
  ) {}

  ngOnInit(): void {
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

