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
    if (downloadUrl) {
      window.open(downloadUrl, '_system');
    }
  }

  public dismissUpdate(): void {
    this.updateAvailableSubject.next(null);
  }
}
