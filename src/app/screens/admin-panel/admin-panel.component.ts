import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { UserRepository } from '../../core/repositories/user.repository';
import { AuthService } from '../../core/services/auth.service';
import { User, UserRole } from '../../core/models/user.model';

@Component({
  selector: 'app-admin-panel',
  templateUrl: './admin-panel.component.html',
  styleUrls: ['./admin-panel.component.scss']
})
export class AdminPanelComponent implements OnInit {
  users: User[] = [];
  currentUser: User | null = null;
  searchTerm: string = '';
  roleFilter: string = 'all';

  constructor(
    private userRepository: UserRepository,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();

    if (!this.authService.isAdminOrSuperAdmin()) {
      this.router.navigate(['/dashboard']);
      return;
    }

    this.loadUsers();
  }

  loadUsers(): void {
    this.userRepository.getCloudUsers().subscribe(users => {
      this.users = users;
    });
  }

  get filteredUsers(): User[] {
    return this.users.filter(u => {
      const matchSearch = !this.searchTerm.trim() || 
        u.name.toLowerCase().includes(this.searchTerm.toLowerCase()) || 
        u.email.toLowerCase().includes(this.searchTerm.toLowerCase());
      
      const matchRole = this.roleFilter === 'all' || u.role === this.roleFilter;
      return matchSearch && matchRole;
    });
  }

  get isSuperAdmin(): boolean {
    return this.authService.isSuperAdmin();
  }

  changeRole(user: User, newRole: UserRole): void {
    if (!this.isSuperAdmin) {
      alert('Solo el Superadministrador puede modificar roles de usuario.');
      return;
    }

    if (user.role === 'superadmin' && user.id !== this.currentUser?.id && !this.isSuperAdmin) {
      alert('No puedes modificar el rol de un Superadministrador.');
      return;
    }

    if (user.id === this.currentUser?.id && newRole !== 'superadmin') {
      alert('No puedes degradar tu propio rol de Superadministrador.');
      return;
    }

    this.userRepository.updateRole(user.id, newRole);
    this.loadUsers();
  }

  toggleActive(user: User): void {
    if (!this.isSuperAdmin) {
      alert('Solo el Superadministrador puede activar o desactivar cuentas.');
      return;
    }

    if (user.id === this.currentUser?.id) {
      alert('No puedes desactivar tu propia cuenta activa.');
      return;
    }

    if (user.role === 'superadmin' && user.id !== this.currentUser?.id && !this.isSuperAdmin) {
      alert('No puedes modificar el estado de un Superadministrador.');
      return;
    }

    this.userRepository.toggleActiveStatus(user.id);
    this.loadUsers();
  }

  toggleVerification(user: User): void {
    if (user.role === 'superadmin' && !this.isSuperAdmin) {
      alert('Los administradores no pueden modificar el estado de un Superadministrador.');
      return;
    }

    this.userRepository.toggleVerification(user.id);
    this.loadUsers();
  }

  get totalUsers(): number {
    return this.users.length;
  }

  get superAdminCount(): number {
    return this.users.filter(u => u.role === 'superadmin').length;
  }

  get adminCount(): number {
    return this.users.filter(u => u.role === 'admin').length;
  }

  get verifiedCount(): number {
    return this.users.filter(u => u.isVerified).length;
  }

  getRoleBadgeClass(role: UserRole): string {
    switch (role) {
      case 'superadmin': return 'badge-role-superadmin';
      case 'admin': return 'badge-role-admin';
      case 'user': return 'badge-role-user';
      default: return 'badge-secondary';
    }
  }

  getRoleLabel(role: UserRole): string {
    switch (role) {
      case 'superadmin': return 'Superadministrador';
      case 'admin': return 'Administrador';
      case 'user': return 'Usuario Común';
      default: return role;
    }
  }
}
