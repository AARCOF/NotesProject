import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { Capacitor } from '@capacitor/core';

export interface AppVersionInfo {
  version: string;
  versionCode: number;
  releasedAt: string;
  appName: string;
  downloadUrl: string;
  releaseNotes: string[];
  isMandatory?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AppUpdateService {
  public readonly CURRENT_VERSION = '3.8.0';
  public readonly CURRENT_VERSION_CODE = 380;

  private updateAvailableSubject = new BehaviorSubject<AppVersionInfo | null>(null);
  public updateAvailable$: Observable<AppVersionInfo | null> = this.updateAvailableSubject.asObservable();
  
  public isChecking$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);

  constructor(private http: HttpClient) {
    // Verificación silenciosa en segundo plano al iniciar
    setTimeout(() => {
      this.checkForUpdates();
    }, 2000);
  }

  public checkForUpdates(isManualCheck = false, onComplete?: (found: boolean, info: AppVersionInfo | null, error?: string) => void): void {
    this.isChecking$.next(true);
    const targetUrl = `https://notes-project-one-iota.vercel.app/api/version?t=${Date.now()}`;
    
    this.http.get<AppVersionInfo & { success: boolean }>(targetUrl).subscribe({
      next: (info) => {
        this.isChecking$.next(false);
        if (info && info.success && info.versionCode > this.CURRENT_VERSION_CODE) {
          this.updateAvailableSubject.next(info);
          if (onComplete) onComplete(true, info);
        } else {
          if (onComplete) onComplete(false, null);
        }
      },
      error: (err) => {
        this.isChecking$.next(false);
        console.error('Error al verificar versión de NoteYou:', err);
        if (onComplete) onComplete(false, null, 'No se pudo conectar con el servidor de actualizaciones.');
      }
    });
  }

  public downloadAndInstallUpdate(downloadUrl?: string): void {
    const url = downloadUrl || '/assets/downloads/NoteYou-v1.0.apk';
    const baseDomain = 'https://notes-project-one-iota.vercel.app';
    
    const finalUrl = url.startsWith('http') 
      ? url 
      : `${baseDomain}${url.startsWith('/') ? url : '/' + url}`;
    
    if (typeof window !== 'undefined') {
      try {
        if (Capacitor.isNativePlatform() || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)) {
          // En Android / Capacitor se abre en el navegador del sistema para iniciar la descarga del APK
          window.open(finalUrl, '_system');
        } else {
          const link = document.createElement('a');
          link.href = finalUrl;
          link.download = 'NoteYou-v1.0.apk';
          link.setAttribute('target', '_blank');
          document.body.appendChild(link);
          link.click();
          setTimeout(() => {
            document.body.removeChild(link);
          }, 300);
        }
      } catch (e) {
        window.location.href = finalUrl;
      }
    }
  }

  public dismissUpdate(): void {
    this.updateAvailableSubject.next(null);
  }
}
