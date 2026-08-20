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
      const tomorrow = new Date(now.getTime() + 24 * 3600 * 1000);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];
      
      notes.forEach(note => {
        if (note.dueDate && note.status !== 'completada') {
          const dueDate = new Date(`${note.dueDate}T00:00:00`);
          const timeDiff = dueDate.getTime() - now.getTime();
          const hoursDiff = timeDiff / (1000 * 3600);
          
          // Se activa cuando la tarea está a 1 día (24 horas o menos) de cumplir su fecha de vencimiento
          const isOneDayBefore = (hoursDiff <= 24 && hoursDiff > 0) || note.dueDate === tomorrowStr;

          if (isOneDayBefore) {
            // 1. Notificación emergente en el celular / web
            const notifTitle = `⏰ Recordatorio de Tarea: ${note.title}`;
            const notifBody = `Tu tarea con prioridad ${note.priority.toUpperCase()} vence mañana (${note.dueDate}). ¡No la olvides!`;
            this.triggerDeviceNotification(notifTitle, notifBody, `task_${note.id}`);

            // 2. Notificación vía Gmail (EmailJS)
            if (!note.reminderSent && user.email) {
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
                console.log(`Email de recordatorio enviado para tarea: ${note.title}`);
              }, err => {
                console.error('Error al enviar email de recordatorio de tarea', err);
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

      // 1. Recordatorio de Pagos y Gastos a 1 DÍA de vencer (Mañana)
      expenses.forEach(exp => {
        const expDate = new Date(`${exp.date}T00:00:00`);
        const timeDiff = expDate.getTime() - now.getTime();
        const hoursDiff = timeDiff / (1000 * 3600);

        const isOneDayBefore = (hoursDiff <= 24 && hoursDiff > 0) || exp.date === tomorrowStr;

        if (isOneDayBefore) {
          const cat = categories.find(c => c.id === exp.categoryId);
          const catName = cat ? cat.name : 'Finanzas';

          // Notificación en el dispositivo (celular / APK / web)
          const notifTitle = `💳 Recordatorio de Pago: ${exp.title}`;
          const notifBody = `Tienes un pago programado por $${exp.amount.toLocaleString()} que vence mañana (${exp.date}).`;
          this.triggerDeviceNotification(notifTitle, notifBody, `exp_${exp.id}_tomorrow`);

          // Notificación por Gmail
          const emailTrackingKey = `expense_email_sent_${exp.id}_${exp.date}`;
          if (!localStorage.getItem(emailTrackingKey) && user.email) {
            this.verificationKeyService.sendPaymentReminderEmail(
              user.email,
              exp.title,
              exp.amount,
              '$',
              catName,
              exp.date,
              exp.notes
            ).subscribe(() => {
              localStorage.setItem(emailTrackingKey, 'true');
              console.log(`Email de recordatorio enviado para pago: ${exp.title}`);
            }, err => {
              console.error('Error al enviar email de recordatorio de pago', err);
            });
          }
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
