import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class RecaptchaService {
  private isCaptchaVerifiedSubject = new BehaviorSubject<boolean>(false);
  public isCaptchaVerified$: Observable<boolean> = this.isCaptchaVerifiedSubject.asObservable();

  public setVerified(verified: boolean): void {
    this.isCaptchaVerifiedSubject.next(verified);
  }

  public isVerified(): boolean {
    return this.isCaptchaVerifiedSubject.getValue();
  }

  public reset(): void {
    this.isCaptchaVerifiedSubject.next(false);
  }
}
