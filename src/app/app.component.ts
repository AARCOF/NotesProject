import { Component, OnInit } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AuthService } from './core/services/auth.service';
import { User } from './core/models/user.model';

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

  constructor(
    private router: Router,
    public authService: AuthService
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
