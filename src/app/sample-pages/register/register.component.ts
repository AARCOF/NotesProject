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

  onNameInput(event: any): void {
    const input = event.target as HTMLInputElement;
    if (!input) return;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    
    const val = input.value;
    const formatted = val.replace(/(^|\s)(\S)(\S*)/g, (match, prefix, firstChar, rest) => {
      return prefix + firstChar.toUpperCase() + rest.toLowerCase();
    });

    this.name = formatted;
    input.value = formatted;
    if (start !== null && end !== null) {
      input.setSelectionRange(start, end);
    }
  }

  async onRegister(): Promise<void> {
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

    try {
      const result = await this.authService.register(this.name.trim(), this.email.trim(), this.password);
      this.isLoading = false;

      if (result.success) {
        this.successMessage = result.message;
        setTimeout(() => {
          this.router.navigate(['/verify-email'], { queryParams: { email: result.email } });
        }, 1200);
      } else {
        this.errorMessage = result.message;
      }
    } catch (err) {
      this.isLoading = false;
      this.errorMessage = 'Error al procesar el registro. Intenta nuevamente.';
    }
  }
}
