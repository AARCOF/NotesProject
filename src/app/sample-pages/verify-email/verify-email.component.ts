import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, interval } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { VerificationKeyService, EmailLog } from '../../core/services/verification-key.service';
import { UserRepository } from '../../core/repositories/user.repository';

@Component({
  selector: 'app-verify-email',
  templateUrl: './verify-email.component.html',
  styleUrls: ['./verify-email.component.scss']
})
export class VerifyEmailComponent implements OnInit, OnDestroy {
  email: string = '';
  inputKey: string = '';
  errorMessage: string = '';
  successMessage: string = '';
  isLoading: boolean = false;

  timerString: string = '';
  isExpired: boolean = false;
  simulatedEmail: EmailLog | null = null;

  private subscriptions: Subscription = new Subscription();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    private verificationKeyService: VerificationKeyService,
    private userRepository: UserRepository
  ) { }

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.email = params['email'] || 'usuario@ejemplo.com';
      this.updateTimer();
    });

    // Listen to simulated email stream
    this.subscriptions.add(
      this.verificationKeyService.lastSentEmail$.subscribe(simEmail => {
        if (simEmail) {
          this.simulatedEmail = simEmail;
        }
      })
    );

    // Countdown interval every 1 second
    this.subscriptions.add(
      interval(1000).subscribe(() => {
        this.updateTimer();
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  updateTimer(): void {
    const user = this.userRepository.findByEmail(this.email);
    if (user && user.keyExpiresAt) {
      this.timerString = this.verificationKeyService.getRemainingTimeFormatted(user.keyExpiresAt);
      this.isExpired = Date.now() > user.keyExpiresAt;
    } else {
      this.timerString = 'Expirado';
      this.isExpired = true;
    }
  }

  onVerify(): void {
    if (!this.inputKey.trim()) {
      this.errorMessage = 'Por favor ingresa la llave de seguridad de 6 dígitos.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    setTimeout(() => {
      const result = this.authService.verifyAccountWithKey(this.email, this.inputKey.trim());
      this.isLoading = false;

      if (result.success) {
        this.successMessage = result.message;
        setTimeout(() => {
          this.router.navigate(['/dashboard']);
        }, 1200);
      } else {
        this.errorMessage = result.message;
      }
    }, 600);
  }

  onResendKey(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    setTimeout(() => {
      const result = this.authService.resendVerificationKey(this.email);
      this.isLoading = false;

      if (result.success) {
        this.successMessage = result.message;
        this.updateTimer();
      } else {
        this.errorMessage = result.message;
      }
    }, 600);
  }
}
