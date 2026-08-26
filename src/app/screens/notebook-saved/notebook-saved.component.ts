import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { QuickNotesService } from '../../services/quick-notes.service';
import { SavedLinksService } from '../../services/saved-links.service';
import { QuickNote } from '../../models/quick-note.model';
import { SavedLink } from '../../models/saved-link.model';

@Component({
  selector: 'app-notebook-saved',
  templateUrl: './notebook-saved.component.html',
  styleUrls: ['./notebook-saved.component.scss']
})
export class NotebookSavedComponent implements OnInit, OnDestroy {
  // Notas Rápidas
  quickNotes: QuickNote[] = [];
  newNoteContent: string = '';
  retentionDays: number = 7;
  private quickNotesSub!: Subscription;

  // Enlaces Guardados
  savedLinks: SavedLink[] = [];
  private savedLinksSub!: Subscription;

  // Modal Enlace
  isAddModalOpen: boolean = false;
  linkTitle: string = '';
  linkUrl: string = '';
  linkDescription: string = '';
  selectedIcon: string = 'typcn-bookmark';

  // Iconos Disponibles
  availableIcons: string[] = [
    'typcn-bookmark',
    'typcn-link',
    'typcn-folder',
    'typcn-document-text',
    'typcn-star',
    'typcn-code',
    'typcn-coffee',
    'typcn-cloud',
    'typcn-chart-bar',
    'typcn-lightbulb',
    'typcn-mortar-board',
    'typcn-attachment',
    'typcn-home',
    'typcn-social-github'
  ];

  constructor(
    private quickNotesService: QuickNotesService,
    private savedLinksService: SavedLinksService
  ) {}

  ngOnInit(): void {
    // Suscribirse a Notas Rápidas
    this.quickNotesSub = this.quickNotesService.quickNotes$.subscribe(notes => {
      this.quickNotes = notes;
    });

    // Suscribirse a Enlaces Guardados
    this.savedLinksSub = this.savedLinksService.savedLinks$.subscribe(links => {
      this.savedLinks = links;
    });
  }

  ngOnDestroy(): void {
    if (this.quickNotesSub) this.quickNotesSub.unsubscribe();
    if (this.savedLinksSub) this.savedLinksSub.unsubscribe();
  }

  // --- ACCIONES DE NOTAS RÁPIDAS ---
  addQuickNote(event: Event): void {
    event.preventDefault();
    if (!this.newNoteContent.trim()) return;

    this.quickNotesService.addQuickNote(
      this.newNoteContent,
      undefined,
      this.retentionDays,
      Number(this.retentionDays) === -1
    );

    this.newNoteContent = '';
  }

  togglePermanent(id: string): void {
    this.quickNotesService.togglePermanent(id);
  }

  deleteQuickNote(id: string): void {
    this.quickNotesService.deleteQuickNote(id);
  }

  // --- ACCIONES DE ENLACES ---
  openAddLinkModal(): void {
    this.isAddModalOpen = true;
  }

  closeAddLinkModal(): void {
    this.isAddModalOpen = false;
    this.linkTitle = '';
    this.linkUrl = '';
    this.linkDescription = '';
    this.selectedIcon = 'typcn-bookmark';
  }

  saveLink(event: Event): void {
    event.preventDefault();
    if (!this.linkUrl.trim() || !this.linkTitle.trim()) return;

    this.savedLinksService.addSavedLink(
      this.linkTitle,
      this.linkUrl,
      this.selectedIcon,
      this.linkDescription
    );

    this.closeAddLinkModal();
  }

  deleteSavedLink(id: string, event: Event): void {
    event.stopPropagation(); // Evitar abrir el enlace
    if (confirm('¿Estás seguro de que deseas eliminar este enlace guardado?')) {
      this.savedLinksService.deleteSavedLink(id);
    }
  }

  openLink(url: string): void {
    window.open(url, '_blank');
  }

  getDomainName(url: string): string {
    if (!url) return '';
    try {
      let absoluteUrl = url.trim();
      if (!/^https?:\/\//i.test(absoluteUrl)) {
        absoluteUrl = 'https://' + absoluteUrl;
      }
      const parsed = new URL(absoluteUrl);
      return parsed.hostname.replace('www.', '');
    } catch {
      return url;
    }
  }
}
