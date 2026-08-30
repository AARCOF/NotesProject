import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';

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
  public readonly CURRENT_VERSION = '3.2.2';
  public readonly CURRENT_VERSION_CODE = 322;

  private updateAvailableSubject = new BehaviorSubject<AppVersionInfo | null>(null);
  public updateAvailable$: Observable<AppVersionInfo | null> = this.updateAvailableSubject.asObservable();

  constructor(private http: HttpClient) {
    this.checkForUpdates();
  }

  public checkForUpdates(): void {
    this.http.get<AppVersionInfo & { success: boolean }>('/api/version').subscribe({
      next: (info) => {
        if (info && info.success && info.versionCode > this.CURRENT_VERSION_CODE) {
          this.updateAvailableSubject.next(info);
        }
      },
      error: () => {}
    });
  }

  public downloadAndInstallUpdate(downloadUrl: string): void {
    if (!downloadUrl) return;
    
    let baseDomain = 'https://notes-project-one-iota.vercel.app';
    if (typeof window !== 'undefined' && window.location.origin && !window.location.origin.includes('localhost') && !window.location.origin.includes('capacitor')) {
      baseDomain = window.location.origin;
    }
    
    const finalUrl = downloadUrl.startsWith('http') 
      ? downloadUrl 
      : (baseDomain + (downloadUrl.startsWith('/') ? downloadUrl : '/' + downloadUrl));
    
    if (typeof window !== 'undefined') {
      try {
        const link = document.createElement('a');
        link.href = finalUrl;
        link.download = 'NoteYou-v1.0.apk';
        link.setAttribute('target', '_blank');
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
          document.body.removeChild(link);
        }, 300);
      } catch (e) {
        window.location.href = finalUrl;
      }
    }
  }

  public dismissUpdate(): void {
    this.updateAvailableSubject.next(null);
  }
}
