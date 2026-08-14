import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

export interface EmailLog {
  toEmail: string;
  subject: string;
  securityKey: string;
  expiresAt: number;
  sentAt: string;
  status: 'enviado' | 'error';
}

@Injectable({
  providedIn: 'root'
})
export class VerificationKeyService {
  private lastSentEmailSubject = new BehaviorSubject<EmailLog | null>(null);
  public lastSentEmail$: Observable<EmailLog | null> = this.lastSentEmailSubject.asObservable();

  public readonly KEY_DURATION_MS = 60 * 60 * 1000;

  constructor(private http: HttpClient) {}

  public generateSecurityKey(): string {
    const min = 100000;
    const max = 999999;
    return Math.floor(Math.random() * (max - min + 1) + min).toString();
  }

  public calculateExpirationTime(): number {
    return Date.now() + this.KEY_DURATION_MS;
  }

  public sendVerificationEmail(toEmail: string, securityKey: string, expiresAt: number): Observable<boolean> {
    const subject = 'Llave de Seguridad para Activar tu Cuenta StarNotes';
    const emailData: EmailLog = {
      toEmail,
      subject,
      securityKey,
      expiresAt,
      sentAt: new Date().toLocaleTimeString(),
      status: 'enviado'
    };
    this.lastSentEmailSubject.next(emailData);

    const emailjsServiceId = 'service_starnotes';
    const emailjsTemplateId = 'template_starnotes';
    const emailjsUserId = 'user_starnotes_public';

    const payload = {
      service_id: emailjsServiceId,
      template_id: emailjsTemplateId,
      user_id: emailjsUserId,
      template_params: {
        to_email: toEmail,
        security_key: securityKey,
        expire_time: '1 hora'
      }
    };

    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });

    return this.http.post('https://api.emailjs.com/api/v1.0/email/send', payload, { headers, responseType: 'text' }).pipe(
      catchError(() => {
        return of(true);
      })
    ) as Observable<any>;
  }

  public validateKey(inputKey: string, actualKey?: string, expiresAt?: number): { isValid: boolean; message: string } {
    if (!actualKey || !expiresAt) {
      return { isValid: false, message: 'No se encontró una llave de seguridad registrada.' };
    }

    const now = Date.now();
    if (now > expiresAt) {
      return { 
        isValid: false, 
        message: 'La llave de seguridad ha superado el límite de 1 hora de validez. Por favor solicita un nuevo código.' 
      };
    }

    if (inputKey.trim() !== actualKey.trim()) {
      return { isValid: false, message: 'La llave de seguridad ingresada es incorrecta.' };
    }

    return { isValid: true, message: 'Llave verificada con éxito.' };
  }

  public getRemainingTimeFormatted(expiresAt: number): string {
    const diffMs = expiresAt - Date.now();
    if (diffMs <= 0) return '00:00 - Expirado';
    const totalSec = Math.floor(diffMs / 1000);
    const minutes = Math.floor(totalSec / 60);
    const seconds = totalSec % 60;
    const mStr = minutes < 10 ? '0' + minutes : minutes;
    const sStr = seconds < 10 ? '0' + seconds : seconds;
    return `${mStr}:${sStr} min restantes`;
  }
}
