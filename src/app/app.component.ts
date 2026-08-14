import { Component, OnInit } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  title = 'StarNotes - Aplicación de Notas';
  showNav: boolean = true;

  constructor(
    private router: Router,
    public authService: AuthService
  ) {}

  ngOnInit(): void {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      const url = event.urlAfterRedirects || event.url;
      const isAuthPage = url.includes('/login') || url.includes('/register') || url.includes('/verify-email');
      this.showNav = !isAuthPage && this.authService.isAuthenticated();
    });

    this.authService.currentUser$.subscribe(user => {
      const currentUrl = this.router.url;
      const isAuthPage = currentUrl.includes('/login') || currentUrl.includes('/register') || currentUrl.includes('/verify-email');
      this.showNav = !isAuthPage && !!user;
    });
  }
}
