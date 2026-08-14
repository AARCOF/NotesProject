import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss']
})
export class RegisterComponent implements OnInit {
  name: string = '';
  email: string = '';
  password: string = '';
  confirmPassword: string = '';

  errorMessage: string = '';
  successMessage: string = '';
  isLoading: boolean = false;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {}

  onRegister(): void {
    if (!this.name.trim() || !this.email.trim() || !this.password) {
      this.errorMessage = 'Por favor completa todos los campos obligatorios.';
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.errorMessage = 'Las contraseñas no coinciden.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    setTimeout(() => {
      const result = this.authService.register(this.name.trim(), this.email.trim(), this.password);
      this.isLoading = false;

      if (result.success) {
        this.successMessage = result.message;
        setTimeout(() => {
          this.router.navigate(['/verify-email'], { queryParams: { email: result.email } });
        }, 1500);
      } else {
        this.errorMessage = result.message;
      }
    }, 700);
  }
}
