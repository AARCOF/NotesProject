import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { RecaptchaService } from '../../core/services/recaptcha.service';

@Component({
  selector: 'app-recaptcha',
  templateUrl: './recaptcha.component.html',
  styleUrls: ['./recaptcha.component.scss']
})
export class RecaptchaComponent implements OnInit, OnDestroy {
  isChecked: boolean = false;
  isVerifying: boolean = false;
  isVerified: boolean = false;
  private sub: Subscription = new Subscription();

  constructor(private recaptchaService: RecaptchaService) {}

  ngOnInit(): void {
    this.sub = this.recaptchaService.isCaptchaVerified$.subscribe(verified => {
      this.isVerified = verified;
      this.isChecked = verified;
      if (!verified) {
        this.isVerifying = false;
      }
    });
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  onCheckboxClick(): void {
    if (this.isVerified) return;

    this.isVerifying = true;
    this.isChecked = true;

    // Simulate verification delay (800ms)
    setTimeout(() => {
      this.isVerifying = false;
      this.isVerified = true;
      this.recaptchaService.setVerified(true);
    }, 800);
  }
}
