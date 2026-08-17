import { Component, OnInit } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { NotesService } from '../../services/notes.service';
import { QuickNotesService } from '../../services/quick-notes.service';
import { CategoriesService } from '../../services/categories.service';
import { User } from '../../core/models/user.model';

@Component({
  selector: 'app-profile-settings',
  templateUrl: './profile-settings.component.html'
})
export class ProfileSettingsComponent implements OnInit {
  user: User | null = null;
  
  // Profile form
  profileName: string = '';
  profileSuccess: string = '';
  profileError: string = '';

  // Password form
  currentPass: string = '';
  newPass: string = '';
  confirmPass: string = '';
  passSuccess: string = '';
  passError: string = '';

  // Backup & Restore
  backupSuccess: string = '';
  backupError: string = '';

  constructor(
    private authService: AuthService,
    private notesService: NotesService,
    private quickNotesService: QuickNotesService,
    private categoriesService: CategoriesService
  ) {}

  ngOnInit(): void {
    this.authService.currentUser$.subscribe(user => {
      this.user = user;
      if (user) {
        this.profileName = user.name;
      }
    });
  }

  updateProfile(): void {
    this.profileError = '';
    this.profileSuccess = '';
    if (!this.profileName.trim()) {
      this.profileError = 'El nombre no puede estar vacío.';
      return;
    }

    const res = this.authService.updateProfileName(this.profileName);
    if (res.success) {
      this.profileSuccess = res.message;
    } else {
      this.profileError = res.message;
    }
  }

  updatePassword(): void {
    this.passError = '';
    this.passSuccess = '';
    
    if (!this.currentPass || !this.newPass || !this.confirmPass) {
      this.passError = 'Todos los campos son obligatorios.';
      return;
    }

    if (this.newPass !== this.confirmPass) {
      this.passError = 'La nueva contraseña y su confirmación no coinciden.';
      return;
    }

    if (this.newPass.length < 6) {
      this.passError = 'La nueva contraseña debe tener al menos 6 caracteres.';
      return;
    }

    const res = this.authService.changePassword(this.currentPass, this.newPass);
    if (res.success) {
      this.passSuccess = res.message;
      this.currentPass = '';
      this.newPass = '';
      this.confirmPass = '';
    } else {
      this.passError = res.message;
    }
  }

  exportBackup(): void {
    this.backupSuccess = '';
    this.backupError = '';

    if (!this.user) {
      this.backupError = 'Debes tener una sesión activa para exportar tus datos.';
      return;
    }

    try {
      const userNotes = this.notesService.getNotes();
      const userQuickNotes = this.quickNotesService.getQuickNotes();
      const userCategories = this.categoriesService.getCategories().filter(c => !c.isSystem);

      const backupData = {
        version: '2.0',
        exportedAt: new Date().toISOString(),
        user: {
          id: this.user.id,
          name: this.user.name,
          email: this.user.email
        },
        notes: userNotes,
        quickNotes: userQuickNotes,
        customCategories: userCategories
      };

      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      const dateSlug = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `noteyou_backup_${dateSlug}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      this.backupSuccess = `Copia de seguridad exportada con éxito (${userNotes.length} tareas, ${userQuickNotes.length} notas rápidas).`;
    } catch (err) {
      this.backupError = 'Ocurrió un error al generar la copia de seguridad.';
    }
  }

  onFileSelected(event: any): void {
    this.backupSuccess = '';
    this.backupError = '';

    const file: File = event.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      this.backupError = 'Por favor selecciona un archivo con extensión .json';
      return;
    }

    const reader = new FileReader();
    reader.onload = (e: any) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!data || (!data.notes && !data.customCategories && !data.quickNotes)) {
          this.backupError = 'El archivo seleccionado no tiene el formato válido de copia de seguridad.';
          return;
        }

        const currentUserId = this.user ? this.user.id : 'usr_imported';

        // 1. Restaurar notas
        if (Array.isArray(data.notes)) {
          const notesKey = 'noteyou_notes_v2';
          const existingRaw = localStorage.getItem(notesKey);
          let allNotes: any[] = existingRaw ? JSON.parse(existingRaw) : [];
          
          // Eliminar notas anteriores del usuario e insertar las del backup con el userId actual
          allNotes = allNotes.filter(n => n.userId !== currentUserId);
          const importedNotes = data.notes.map((n: any) => ({ ...n, userId: currentUserId }));
          allNotes = [...importedNotes, ...allNotes];
          localStorage.setItem(notesKey, JSON.stringify(allNotes));
          this.notesService.refreshNotesForCurrentUser();
        }

        // 2. Restaurar notas rápidas
        if (Array.isArray(data.quickNotes)) {
          const qnKey = 'noteyou_quick_notes_v1';
          const existingQnRaw = localStorage.getItem(qnKey);
          let allQn: any[] = existingQnRaw ? JSON.parse(existingQnRaw) : [];
          
          allQn = allQn.filter(q => q.userId !== currentUserId);
          const importedQn = data.quickNotes.map((q: any) => ({ ...q, userId: currentUserId }));
          allQn = [...importedQn, ...allQn];
          localStorage.setItem(qnKey, JSON.stringify(allQn));
          // Recargar en servicio
          (this.quickNotesService as any).loadQuickNotes?.();
        }

        // 3. Restaurar categorías personalizadas
        if (Array.isArray(data.customCategories)) {
          const catKey = 'noteyou_categories_v2';
          const existingCatRaw = localStorage.getItem(catKey);
          let allCats: any[] = existingCatRaw ? JSON.parse(existingCatRaw) : [];
          
          allCats = allCats.filter(c => c.userId !== currentUserId);
          const importedCats = data.customCategories.map((c: any) => ({ ...c, userId: currentUserId, isSystem: false }));
          allCats = [...allCats, ...importedCats];
          localStorage.setItem(catKey, JSON.stringify(allCats));
          this.categoriesService.refreshCategoriesForCurrentUser();
        }

        this.backupSuccess = 'Copia de seguridad restaurada correctamente en tu cuenta.';
        event.target.value = '';
      } catch (err) {
        this.backupError = 'No se pudo leer el archivo de respaldo. Asegúrate de que sea un JSON válido.';
      }
    };
    reader.readAsText(file);
  }
}
