import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface ConfirmDialogConfig {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info' | 'success';
  icon?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

export interface AlertDialogConfig {
  title?: string;
  message: string;
  btnText?: string;
  type?: 'info' | 'warning' | 'error' | 'success';
  icon?: string;
  onClose?: () => void;
}

export interface DialogState {
  isOpen: boolean;
  isConfirm: boolean;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  variant: 'danger' | 'warning' | 'info' | 'success';
  icon: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

@Injectable({
  providedIn: 'root'
})
export class ModalDialogService {
  private dialogSubject = new BehaviorSubject<DialogState>({
    isOpen: false,
    isConfirm: true,
    title: '',
    message: '',
    confirmText: 'Confirmar',
    cancelText: 'Cancelar',
    variant: 'danger',
    icon: 'typcn-trash'
  });

  public dialogState$: Observable<DialogState> = this.dialogSubject.asObservable();

  confirm(config: ConfirmDialogConfig): Promise<boolean> {
    return new Promise((resolve) => {
      let icon = config.icon;
      if (!icon) {
        if (config.variant === 'warning') icon = 'typcn-warning';
        else if (config.variant === 'info') icon = 'typcn-info';
        else if (config.variant === 'success') icon = 'typcn-tick';
        else icon = 'typcn-trash';
      }

      this.dialogSubject.next({
        isOpen: true,
        isConfirm: true,
        title: config.title,
        message: config.message,
        confirmText: config.confirmText || 'Sí, confirmar',
        cancelText: config.cancelText || 'Cancelar',
        variant: config.variant || 'danger',
        icon: icon,
        onConfirm: () => {
          this.close();
          if (config.onConfirm) config.onConfirm();
          resolve(true);
        },
        onCancel: () => {
          this.close();
          if (config.onCancel) config.onCancel();
          resolve(false);
        }
      });
    });
  }

  alert(config: AlertDialogConfig | string): Promise<void> {
    return new Promise((resolve) => {
      let title = 'Atención';
      let message = '';
      let type: 'info' | 'warning' | 'error' | 'success' = 'warning';
      let btnText = 'Entendido';
      let icon = 'typcn-warning';

      if (typeof config === 'string') {
        message = config;
      } else {
        title = config.title || 'Atención';
        message = config.message;
        type = config.type || 'warning';
        btnText = config.btnText || 'Entendido';
        if (config.icon) {
          icon = config.icon;
        } else {
          if (type === 'error') icon = 'typcn-times-outline';
          else if (type === 'info') icon = 'typcn-info';
          else if (type === 'success') icon = 'typcn-tick';
          else icon = 'typcn-warning';
        }
      }

      this.dialogSubject.next({
        isOpen: true,
        isConfirm: false,
        title: title,
        message: message,
        confirmText: btnText,
        cancelText: '',
        variant: type === 'error' ? 'danger' : type,
        icon: icon,
        onConfirm: () => {
          this.close();
          if (typeof config !== 'string' && config.onClose) config.onClose();
          resolve();
        }
      });
    });
  }

  close(): void {
    const current = this.dialogSubject.value;
    this.dialogSubject.next({
      ...current,
      isOpen: false
    });
  }
}
