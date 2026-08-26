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
  public readonly CURRENT_VERSION = '3.0.0';
  public readonly CURRENT_VERSION_CODE = 300;

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
    if (typeof window !== 'undefined' && !window.location.origin.includes('localhost') && !window.location.origin.includes('capacitor')) {
      baseDomain = window.location.origin;
    }
    
    const finalUrl = downloadUrl.startsWith('http') 
      ? downloadUrl 
      : (baseDomain + (downloadUrl.startsWith('/') ? downloadUrl : '/' + downloadUrl));
    
    const a = document.createElement('a');
    a.href = finalUrl;
    a.download = 'NoteYou.apk';
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
    }, 500);
  }

  public dismissUpdate(): void {
    this.updateAvailableSubject.next(null);
  }
}
