import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface SimulatedEmail {
  toEmail: string;
  subject: string;
  securityKey: string;
  expiresAt: number;
  sentAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class VerificationKeyService {
  private lastSentEmailSubject = new BehaviorSubject<SimulatedEmail | null>(null);
  public lastSentEmail$: Observable<SimulatedEmail | null> = this.lastSentEmailSubject.asObservable();

  public readonly KEY_DURATION_MS = 60 * 60 * 1000;

  public generateSecurityKey(): string {
    const min = 100000;
    const max = 999999;
    return Math.floor(Math.random() * (max - min + 1) + min).toString();
  }

  public calculateExpirationTime(): number {
    return Date.now() + this.KEY_DURATION_MS;
  }

  public sendVerificationEmail(toEmail: string, securityKey: string, expiresAt: number): void {
    const emailData: SimulatedEmail = {
      toEmail,
      subject: '🔑 Llave de Seguridad para Activar tu Cuenta en StarNotes (Vence en 1 Hora)',
      securityKey,
      expiresAt,
      sentAt: new Date().toLocaleTimeString()
    };
    this.lastSentEmailSubject.next(emailData);
  }

  public validateKey(inputKey: string, actualKey?: string, expiresAt?: number): { isValid: boolean; message: string } {
    if (!actualKey || !expiresAt) {
      return { isValid: false, message: 'No se encontró una llave de seguridad registrada.' };
    }

    const now = Date.now();
    if (now > expiresAt) {
      return { 
        isValid: false, 
        message: '⚠️ La llave de seguridad ha expirado (superó el tiempo límite de 1 hora). Por favor solicita una nueva llave.' 
      };
    }

    if (inputKey.trim() !== actualKey.trim()) {
      return { isValid: false, message: '❌ La llave de seguridad de 6 dígitos ingresada es incorrecta.' };
    }

    return { isValid: true, message: '✅ Llave verificada con éxito.' };
  }

  public getRemainingTimeFormatted(expiresAt: number): string {
    const diffMs = expiresAt - Date.now();
    if (diffMs <= 0) return '00:00 (Expirado)';
    const totalSec = Math.floor(diffMs / 1000);
    const minutes = Math.floor(totalSec / 60);
    const seconds = totalSec % 60;
    const mStr = minutes < 10 ? '0' + minutes : minutes;
    const sStr = seconds < 10 ? '0' + seconds : seconds;
    return `${mStr}:${sStr} min restantes`;
  }
}
