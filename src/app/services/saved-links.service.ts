import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { SavedLink } from '../models/saved-link.model';
import { AuthService } from '../core/services/auth.service';

const SAVED_LINKS_STORAGE_KEY = 'noteyou_saved_links_v1';

@Injectable({
  providedIn: 'root'
})
export class SavedLinksService {
  private savedLinksSubject = new BehaviorSubject<SavedLink[]>([]);
  public savedLinks$: Observable<SavedLink[]> = this.savedLinksSubject.asObservable();
  
  private openAddLinkModalRequestSubject = new Subject<void>();
  public openAddLinkModalRequest$: Observable<void> = this.openAddLinkModalRequestSubject.asObservable();

  private currentUserId: string | null = null;
  private syncTimerSubscription: any = null;

  public requestOpenAddLinkModal(): void {
    this.openAddLinkModalRequestSubject.next();
  }

  constructor(
    private authService: AuthService,
    private http: HttpClient
  ) {
    this.authService.currentUser$.subscribe(user => {
      this.currentUserId = user ? user.id : null;
      this.loadSavedLinks();
      this.initAutoSync();
    });

    if (typeof window !== 'undefined') {
      window.addEventListener('focus', () => this.fetchCloudSavedLinks());
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
          if (!document.hidden) this.fetchCloudSavedLinks();
        });
      }
    }
  }

  private initAutoSync(): void {
    if (this.syncTimerSubscription) {
      clearInterval(this.syncTimerSubscription);
      this.syncTimerSubscription = null;
    }
    if (this.currentUserId) {
      this.syncTimerSubscription = setInterval(() => {
        this.fetchCloudSavedLinks();
      }, 5000);
    }
  }

  public fetchCloudSavedLinks(): void {
    if (!this.currentUserId) return;

    this.http.get<{ success: boolean; links: SavedLink[] }>('/api/saved-links').subscribe({
      next: (res) => {
        if (res && res.success && Array.isArray(res.links)) {
          const cloudLinks = res.links;
          let allLinks = this.getAllStorageLinks();

          const otherUsersLinks = allLinks.filter(l => l.userId && l.userId !== this.currentUserId);
          const mergedAll = [...cloudLinks, ...otherUsersLinks];

          this.saveAllStorageLinks(mergedAll);
          this.savedLinksSubject.next(cloudLinks);
        }
      },
      error: () => {}
    });
  }

  private getAllStorageLinks(): SavedLink[] {
    const data = localStorage.getItem(SAVED_LINKS_STORAGE_KEY);
    if (!data) return [];
    try {
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  private saveAllStorageLinks(links: SavedLink[]): void {
    localStorage.setItem(SAVED_LINKS_STORAGE_KEY, JSON.stringify(links));
  }

  private loadSavedLinks(): void {
    if (!this.currentUserId) {
      this.savedLinksSubject.next([]);
      return;
    }

    const allLinks = this.getAllStorageLinks();
    const userLinks = allLinks.filter(l => l.userId === this.currentUserId);
    this.savedLinksSubject.next(userLinks);

    this.fetchCloudSavedLinks();
  }

  public getSavedLinks(): SavedLink[] {
    return this.savedLinksSubject.getValue();
  }

  public addSavedLink(title: string, url: string, icon: string, description?: string): SavedLink {
    const userId = this.currentUserId || 'anonymous';
    
    // Auto-fix URL schema if missing
    let formattedUrl = url.trim();
    if (formattedUrl && !/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = 'https://' + formattedUrl;
    }

    const newLink: SavedLink = {
      id: 'sl_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      userId,
      title: title.trim(),
      url: formattedUrl,
      icon: icon || 'typcn-bookmark',
      description: description ? description.trim() : undefined,
      createdAt: new Date().toISOString()
    };

    const all = this.getAllStorageLinks();
    const updated = [newLink, ...all];
    this.saveAllStorageLinks(updated);
    this.savedLinksSubject.next(updated.filter(l => l.userId === userId));

    // Sync with MongoDB
    this.http.post('/api/saved-links', newLink).subscribe({ error: () => {} });

    return newLink;
  }

  public updateSavedLink(id: string, title: string, url: string, icon: string, description?: string): void {
    let formattedUrl = url.trim();
    if (formattedUrl && !/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = 'https://' + formattedUrl;
    }

    const all = this.getAllStorageLinks();
    const updated = all.map(link => {
      if (link.id === id) {
        return {
          ...link,
          title: title.trim(),
          url: formattedUrl,
          icon: icon || 'typcn-bookmark',
          description: description ? description.trim() : undefined,
          updatedAt: new Date().toISOString()
        };
      }
      return link;
    });

    this.saveAllStorageLinks(updated);
    this.savedLinksSubject.next(updated.filter(l => l.userId === this.currentUserId));

    // Sync update in MongoDB
    const updatedItem = updated.find(l => l.id === id);
    if (updatedItem) {
      const { _id, ...cleanItem } = updatedItem as any;
      this.http.put('/api/saved-links', cleanItem).subscribe({
        next: () => {
          this.fetchCloudSavedLinks();
        },
        error: (err) => {
          console.error('Error updating saved link:', err);
        }
      });
    }
  }

  public deleteSavedLink(id: string): void {
    const all = this.getAllStorageLinks();
    const filtered = all.filter(l => l.id !== id);
    this.saveAllStorageLinks(filtered);
    
    const userLinks = filtered.filter(l => l.userId === this.currentUserId);
    this.savedLinksSubject.next(userLinks);

    // Sync delete in MongoDB
    this.http.delete('/api/saved-links?id=' + id).subscribe({ error: () => {} });
  }
}
