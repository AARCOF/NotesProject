import { Injectable, OnDestroy, Inject, forwardRef } from '@angular/core';
import { NotesService } from '../../services/notes.service';
import { ExpenseService } from '../../services/expense.service';
import { VerificationKeyService } from './verification-key.service';
import { AuthService } from './auth.service';
import { interval, Subscription, combineLatest } from 'rxjs';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

@Injectable({
  providedIn: 'root'
})
export class AutomatedReminderService implements OnDestroy {
  private subscription: Subscription = new Subscription();
  private sentDeviceReminders = new Set<string>();

  constructor(
    private notesService: NotesService,
    private expenseService: ExpenseService,
    @Inject(forwardRef(() => VerificationKeyService)) private verificationKeyService: VerificationKeyService,
    @Inject(forwardRef(() => AuthService)) private authService: AuthService
  ) {
    this.initNotificationPermissions();

    // Verificar cada 5 minutos
    this.subscription.add(
      interval(5 * 60 * 1000).subscribe(() => {
        this.checkAndSendReminders();
      })
    );
    
    // Verificación inicial 3 segundos después de que inicie la app
    setTimeout(() => this.checkAndSendReminders(), 3000);
  }

  private async initNotificationPermissions(): Promise<void> {
    try {
      if (Capacitor.isNativePlatform()) {
        const permStatus = await LocalNotifications.checkPermissions();
        if (permStatus.display !== 'granted') {
          await LocalNotifications.requestPermissions();
        }
      } else if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'default') {
          await Notification.requestPermission();
        }
      }
    } catch (e) {
      console.warn('Error al solicitar permisos de notificación:', e);
    }
  }

  public async triggerDeviceNotification(title: string, body: string, idSuffix: string = ''): Promise<void> {
    const notifKey = `${title}_${body}_${new Date().toDateString()}`;
    if (this.sentDeviceReminders.has(notifKey)) {
      return;
    }
    this.sentDeviceReminders.add(notifKey);

    try {
      if (Capacitor.isNativePlatform()) {
        const notifId = Math.floor(Math.random() * 1000000);
        await LocalNotifications.schedule({
          notifications: [
            {
              title: title,
              body: body,
              id: notifId,
              schedule: { at: new Date(Date.now() + 500) },
              sound: undefined,
              actionTypeId: '',
              extra: null
            }
          ]
        });
      } else if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification(title, {
          body: body,
          icon: 'assets/images/favicon.png'
        });
      }
    } catch (err) {
      console.error('Error al emitir notificación en dispositivo:', err);
    }
  }

  private checkAndSendReminders(): void {
    const user = this.authService.currentUserValue;
    if (!user) return;

    this.checkTaskReminders(user);
    this.checkExpenseAndBudgetReminders(user);
  }

  private checkTaskReminders(user: any): void {
    const sub = this.notesService.notes$.subscribe(notes => {
      const now = new Date();
      
      notes.forEach(note => {
        if (note.dueDate && note.status !== 'completada') {
          const dueDate = new Date(`${note.dueDate}T00:00:00`);
          const timeDiff = dueDate.getTime() - now.getTime();
          const hoursDiff = timeDiff / (1000 * 3600);
          
          // Si faltan 24 horas o menos para vencer, o es el día de hoy
          if (hoursDiff <= 24 && hoursDiff >= -12) {
            // Notificación nativa en el celular
            const notifTitle = `⏰ Recordatorio de Tarea: ${note.title}`;
            const notifBody = `Tu tarea con prioridad ${note.priority.toUpperCase()} vence el ${note.dueDate}. ¡No la olvides!`;
            this.triggerDeviceNotification(notifTitle, notifBody, `task_${note.id}`);

            // Enviar por email si no se ha enviado
            if (!note.reminderSent && user.email && hoursDiff > 0) {
              this.verificationKeyService.sendTaskReminderEmail(
                user.email,
                note.title,
                note.content,
                note.categoryId,
                note.priority,
                note.dueDate
              ).subscribe(() => {
                const updatedNote = { reminderSent: true };
                this.notesService.updateNote(note.id, updatedNote);
              }, err => {
                console.error('Error al enviar el email de recordatorio', err);
              });
            }
          }
        }
      });
    });
    
    sub.unsubscribe();
  }

  private checkExpenseAndBudgetReminders(user: any): void {
    const sub = combineLatest([
      this.expenseService.expenses$,
      this.expenseService.subcategories$,
      this.expenseService.budgets$,
      this.expenseService.categories$
    ]).subscribe(([expenses, subcategories, budgets, categories]) => {
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      const tomorrow = new Date(now.getTime() + 24 * 3600 * 1000);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];
      const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      // 1. Recordatorio de Gastos y Pagos Programados para Hoy o Mañana
      expenses.forEach(exp => {
        if (exp.date === todayStr) {
          const notifTitle = `💳 Pago Registrado Hoy: ${exp.title}`;
          const notifBody = `Gasto de $${exp.amount.toLocaleString()} registrado para el día de hoy.`;
          this.triggerDeviceNotification(notifTitle, notifBody, `exp_${exp.id}_today`);
        } else if (exp.date === tomorrowStr) {
          const notifTitle = `📅 Recordatorio de Pago Mañana: ${exp.title}`;
          const notifBody = `Tienes un gasto programado de $${exp.amount.toLocaleString()} para mañana.`;
          this.triggerDeviceNotification(notifTitle, notifBody, `exp_${exp.id}_tomorrow`);
        }
      });

      // 2. Alerta de Presupuesto por Subcategoría
      subcategories.filter(s => s.budget && s.budget > 0).forEach(s => {
        const totalSpent = expenses
          .filter(e => e.subcategoryId === s.id && e.date.startsWith(currentMonthKey))
          .reduce((sum, e) => sum + (e.amount || 0), 0);

        const budgetLimit = s.budget || 0;
        const usagePercent = Math.round((totalSpent / budgetLimit) * 100);
        if (usagePercent >= 100) {
          const notifTitle = `⚠️ Presupuesto Excedido: ${s.name}`;
          const notifBody = `Has superado el presupuesto en ${s.name} ($${totalSpent.toLocaleString()} / $${budgetLimit.toLocaleString()}).`;
          this.triggerDeviceNotification(notifTitle, notifBody, `sub_budget_${s.id}_100`);
        } else if (usagePercent >= 85) {
          const notifTitle = `🔔 Alerta de Presupuesto: ${s.name}`;
          const notifBody = `Has alcanzado el ${usagePercent}% de tu presupuesto en ${s.name}.`;
          this.triggerDeviceNotification(notifTitle, notifBody, `sub_budget_${s.id}_85`);
        }
      });

      // 3. Alerta de Gastos vs Ingresos Mensuales
      const monthlyBudget = budgets.find(b => b.monthKey === currentMonthKey);
      if (monthlyBudget && monthlyBudget.monthlyIncome > 0) {
        const totalMonthExpenses = expenses
          .filter(e => e.date.startsWith(currentMonthKey))
          .reduce((sum, e) => sum + (e.amount || 0), 0);

        const incomeRatio = Math.round((totalMonthExpenses / monthlyBudget.monthlyIncome) * 100);
        if (incomeRatio >= 90) {
          const notifTitle = `⚠️ Alerta de Gastos Mensuales`;
          const notifBody = `Tus gastos del mes ($${totalMonthExpenses.toLocaleString()}) representan el ${incomeRatio}% de tus ingresos estimados.`;
          this.triggerDeviceNotification(notifTitle, notifBody, `monthly_income_alert_90`);
        }
      }
    });

    sub.unsubscribe();
  }

  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }
}
