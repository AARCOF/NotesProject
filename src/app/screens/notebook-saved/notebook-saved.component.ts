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

  private modalReqSub!: Subscription;

  ngOnInit(): void {
    // Suscribirse a Notas Rápidas
    this.quickNotesSub = this.quickNotesService.quickNotes$.subscribe(notes => {
      this.quickNotes = notes;
    });

    // Suscribirse a Enlaces Guardados
    this.savedLinksSub = this.savedLinksService.savedLinks$.subscribe(links => {
      this.savedLinks = links;
    });

    // Escuchar peticiones externas de abrir modal (ej. desde FAB móvil)
    this.modalReqSub = this.savedLinksService.openAddLinkModalRequest$.subscribe(() => {
      this.openAddLinkModal();
    });
  }

  ngOnDestroy(): void {
    if (this.quickNotesSub) this.quickNotesSub.unsubscribe();
    if (this.savedLinksSub) this.savedLinksSub.unsubscribe();
    if (this.modalReqSub) this.modalReqSub.unsubscribe();
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
    try {
      let formattedUrl = url;
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        formattedUrl = 'https://' + url;
      }
      const parsed = new URL(formattedUrl);
      return parsed.hostname.replace('www.', '');
    } catch {
      return url;
    }
  }

  getLinkColor(index: number): string {
    const colors = ['#0284c7', '#059669', '#8b5cf6', '#d97706', '#e11d48', '#06b6d4'];
    return colors[index % colors.length];
  }

  getLinkBorderColor(index: number): string {
    const hex = this.getLinkColor(index);
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, 0.35)`;
  }
}
