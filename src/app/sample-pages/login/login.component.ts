import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {
  email: string = 'usuario@ejemplo.com';
  password: string = 'password123';
  errorMessage: string = '';
  successMessage: string = '';
  isLoading: boolean = false;
  returnUrl: string = '/dashboard';

  constructor(
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/dashboard';
    
    if (this.authService.isAuthenticated()) {
      this.router.navigate([this.returnUrl]);
    }
  }

  onLogin(): void {
    if (!this.email || !this.password) {
      this.errorMessage = 'Por favor ingresa tu correo y contraseña.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    setTimeout(() => {
      const result = this.authService.login(this.email, this.password);
      this.isLoading = false;

      if (result.success) {
        this.successMessage = '¡Inicio de sesión exitoso! Redirigiendo...';
        setTimeout(() => {
          this.router.navigateByUrl(this.returnUrl);
        }, 800);
      } else {
        this.errorMessage = result.message;
        if (result.requiresVerification) {
          setTimeout(() => {
            this.router.navigate(['/verify-email'], { queryParams: { email: this.email } });
          }, 1500);
        }
      }
    }, 600);
  }
}
