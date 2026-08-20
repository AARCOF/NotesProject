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

  constructor(private http: HttpClient) { }

  public generateSecurityKey(): string {
    const min = 100000;
    const max = 999999;
    return Math.floor(Math.random() * (max - min + 1) + min).toString();
  }

  public calculateExpirationTime(): number {
    return Date.now() + this.KEY_DURATION_MS;
  }

  public sendVerificationEmail(toEmail: string, securityKey: string, expiresAt: number): Observable<boolean> {
    const subject = 'Llave de Seguridad para Activar tu Cuenta NoteYou';
    const emailData: EmailLog = {
      toEmail,
      subject,
      securityKey,
      expiresAt,
      sentAt: new Date().toLocaleTimeString(),
      status: 'enviado'
    };
    this.lastSentEmailSubject.next(emailData);

    const payload = {
      service_id: 'NoteYou_er',
      template_id: 'template_01akdg7',
      user_id: 'NJyM41WnepByrp24u',
      template_params: {
        to_email: toEmail,
        security_key: securityKey,
        expire_time: '1 hora'
      }
    };

    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });

    return this.http.post('https://api.emailjs.com/api/v1.0/email/send', payload, { headers, responseType: 'text' }).pipe(
      catchError(() => of(true))
    ) as Observable<any>;
  }

  public sendTaskReminderEmail(
    toEmail: string,
    taskTitle: string,
    taskContent: string,
    categoryName: string,
    priority: string,
    dueDate?: string
  ): Observable<boolean> {
    const payload = {
      service_id: 'NoteYou_er',
      template_id: 'template_ftjjwe7',
      user_id: 'NJyM41WnepByrp24u',
      template_params: {
        to_email: toEmail,
        task_title: `⏰ Recordatorio de Tarea: ${taskTitle}`,
        task_content: taskContent || 'Tienes una tarea programada en NoteYou que vence mañana.',
        category: categoryName || 'General',
        priority: priority ? priority.toUpperCase() : 'MEDIA',
        due_date: dueDate || 'Mañana'
      }
    };

    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });

    return this.http.post('https://api.emailjs.com/api/v1.0/email/send', payload, { headers, responseType: 'text' }).pipe(
      catchError(() => of(true))
    ) as Observable<any>;
  }

  public sendPaymentReminderEmail(
    toEmail: string,
    paymentTitle: string,
    amount: number,
    currencySymbol: string,
    categoryName: string,
    dueDate: string,
    notes?: string
  ): Observable<boolean> {
    const payload = {
      service_id: 'NoteYou_er',
      template_id: 'template_ftjjwe7',
      user_id: 'NJyM41WnepByrp24u',
      template_params: {
        to_email: toEmail,
        task_title: `💳 Recordatorio de Pago: ${paymentTitle} (${currencySymbol} ${amount.toLocaleString()})`,
        task_content: notes ? `Detalles del pago: ${notes}` : `Tienes un pago programado por un monto de ${currencySymbol} ${amount.toLocaleString()} que vence mañana.`,
        category: categoryName || 'Finanzas',
        priority: 'ALTA (Pago/Finanzas)',
        due_date: dueDate
      }
    };

    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });

    return this.http.post('https://api.emailjs.com/api/v1.0/email/send', payload, { headers, responseType: 'text' }).pipe(
      catchError(() => of(true))
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
