import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { NotesService } from '../../services/notes.service';
import { QuickNotesService } from '../../services/quick-notes.service';
import { CategoriesService } from '../../services/categories.service';
import { ExpenseService } from '../../services/expense.service';
import { AppUpdateService, AppVersionInfo } from '../../core/services/app-update.service';
import { User } from '../../core/models/user.model';
import { ModalDialogService } from '../../services/modal-dialog.service';

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

  // App Updates
  currentAppVersion: string = '3.0.0';
  updateInfo: AppVersionInfo | null = null;
  isCheckingUpdate: boolean = false;
  updateCheckMessage: string = '';

  // Currency form
  selectedCurrency: string = 'S/.';
  customCurrency: string = '';
  currencySuccess: string = '';

  currencyPresets = [
    { code: 'PEN', symbol: 'S/.', name: 'Sol Peruano (PEN)', flag: '🇵🇪' },
    { code: 'USD', symbol: '$', name: 'Dólar Estadounidense (USD)', flag: '🇺🇸' },
    { code: 'EUR', symbol: '€', name: 'Euro (EUR)', flag: '🇪🇺' },
    { code: 'MXN', symbol: 'Mex$', name: 'Peso Mexicano (MXN)', flag: '🇲🇽' },
    { code: 'COP', symbol: 'COL$', name: 'Peso Colombiano (COP)', flag: '🇨🇴' },
    { code: 'CLP', symbol: 'CLP$', name: 'Peso Chileno (CLP)', flag: '🇨🇱' },
    { code: 'ARS', symbol: 'ARS$', name: 'Peso Argentino (ARS)', flag: '🇦🇷' },
    { code: 'VES', symbol: 'Bs.', name: 'Bolívar (VES)', flag: '🇻🇪' },
    { code: 'GBP', symbol: '£', name: 'Libra Esterlina (GBP)', flag: '🇬🇧' },
    { code: 'BRL', symbol: 'R$', name: 'Real Brasileño (BRL)', flag: '🇧🇷' }
  ];

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
    private categoriesService: CategoriesService,
    private expenseService: ExpenseService,
    public appUpdateService: AppUpdateService,
    private router: Router,
    private dialogService: ModalDialogService
  ) {
    this.currentAppVersion = this.appUpdateService.CURRENT_VERSION;
  }

  logout(): void {
    this.dialogService.confirm({
      title: '¿Cerrar sesión?',
      message: '¿Estás seguro de que deseas cerrar sesión en NoteYou?',
      confirmText: 'Cerrar sesión',
      variant: 'danger',
      icon: 'typcn-power',
      onConfirm: () => {
        this.authService.logout();
        this.router.navigate(['/login']);
      }
    });
  }

  ngOnInit(): void {
    this.authService.currentUser$.subscribe(user => {
      this.user = user;
      if (user) {
        this.profileName = user.name;
      }
    });

    this.expenseService.currency$.subscribe(curr => {
      this.selectedCurrency = curr || 'S/.';
    });

    this.appUpdateService.updateAvailable$.subscribe(info => {
      this.updateInfo = info;
    });
  }

  checkUpdatesManual(): void {
    this.isCheckingUpdate = true;
    this.updateCheckMessage = '';
    this.appUpdateService.checkForUpdates(true, (found, info, errorMsg) => {
      this.isCheckingUpdate = false;
      if (found && info) {
        this.updateInfo = info;
        this.updateCheckMessage = `¡Nueva versión encontrada (v${info.version})! Puedes actualizarla a continuación.`;
      } else if (errorMsg) {
        this.updateCheckMessage = errorMsg;
        setTimeout(() => {
          this.updateCheckMessage = '';
        }, 5000);
      } else {
        this.updateCheckMessage = `¡Tu aplicación está al día! Tienes la versión más reciente de NoteYou (v${this.currentAppVersion}).`;
        setTimeout(() => {
          this.updateCheckMessage = '';
        }, 5000);
      }
    });
  }

  downloadUpdate(url: string): void {
    this.appUpdateService.downloadAndInstallUpdate(url);
  }

  saveCurrency(symbol: string): void {
    this.selectedCurrency = symbol;
    this.expenseService.setCurrency(symbol);
    this.currencySuccess = `Tipo de moneda actualizado a "${symbol}". Se aplicará en todas las pantallas de pagos y presupuestos.`;
    setTimeout(() => {
      this.currencySuccess = '';
    }, 4000);
  }

  saveCustomCurrency(): void {
    if (!this.customCurrency.trim()) return;
    this.saveCurrency(this.customCurrency.trim());
    this.customCurrency = '';
  }

  onNameInput(event: any): void {
    const input = event.target as HTMLInputElement;
    if (!input) return;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    
    const val = input.value;
    const formatted = val.replace(/(^|\s)(\S)(\S*)/g, (match, prefix, firstChar, rest) => {
      return prefix + firstChar.toUpperCase() + rest.toLowerCase();
    });

    this.profileName = formatted;
    input.value = formatted;
    if (start !== null && end !== null) {
      input.setSelectionRange(start, end);
    }
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
