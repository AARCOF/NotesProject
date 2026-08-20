import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { User, UserRole } from '../../core/models/user.model';

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent implements OnInit {
  currentUser: User | null = null;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
    });
  }

  get isAdminOrSuperAdmin(): boolean {
    return this.authService.isAdminOrSuperAdmin();
  }

  getRoleLabel(role?: UserRole): string {
    switch (role) {
      case 'superadmin': return 'Superadministrador';
      case 'admin': return 'Administrador';
      case 'user': return 'Usuario Común';
      default: return 'Usuario';
    }
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
