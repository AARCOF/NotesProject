import { Injectable, OnDestroy, Inject, forwardRef } from '@angular/core';
import { NotesService } from '../../services/notes.service';
import { VerificationKeyService } from './verification-key.service';
import { AuthService } from './auth.service';
import { interval, Subscription } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AutomatedReminderService implements OnDestroy {
  private subscription: Subscription;

  constructor(
    private notesService: NotesService,
    @Inject(forwardRef(() => VerificationKeyService)) private verificationKeyService: VerificationKeyService,
    @Inject(forwardRef(() => AuthService)) private authService: AuthService
  ) {
    // Verificar cada 10 minutos (10 * 60 * 1000 ms)
    this.subscription = interval(10 * 60 * 1000).subscribe(() => {
      this.checkAndSendReminders();
    });
    
    // Verificación inicial 5 segundos después de que inicie la app
    setTimeout(() => this.checkAndSendReminders(), 5000);
  }

  private checkAndSendReminders(): void {
    const user = this.authService.currentUserValue;
    if (!user || !user.email) return;

    const sub = this.notesService.notes$.subscribe(notes => {
      const now = new Date();
      
      notes.forEach(note => {
        if (note.dueDate && !note.reminderSent && note.status !== 'completada') {
          // Asumimos dueDate como YYYY-MM-DD
          const dueDate = new Date(`${note.dueDate}T00:00:00`);
          
          const timeDiff = dueDate.getTime() - now.getTime();
          const hoursDiff = timeDiff / (1000 * 3600);
          
          // Si faltan 24 horas o menos, pero aún no ha vencido (hoursDiff > 0)
          if (hoursDiff <= 24 && hoursDiff > 0) {
            
            // Enviar recordatorio
            this.verificationKeyService.sendTaskReminderEmail(
              user.email,
              note.title,
              note.content,
              note.categoryId, // Omit category translation for now or implement mapping
              note.priority,
              note.dueDate
            ).subscribe(() => {
              // Actualizar la nota para no volver a enviar el recordatorio
              const updatedNote = { reminderSent: true };
              this.notesService.updateNote(note.id, updatedNote);
              console.log(`Recordatorio automático enviado para la tarea: ${note.title}`);
            }, err => {
              console.error('Error al enviar el recordatorio automático', err);
            });

          }
        }
      });
    });
    
    sub.unsubscribe();
  }

  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }
}
