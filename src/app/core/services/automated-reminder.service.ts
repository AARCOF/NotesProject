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

  constructor(
    private notesService: NotesService,
    private expenseService: ExpenseService,
    @Inject(forwardRef(() => VerificationKeyService)) private verificationKeyService: VerificationKeyService,
    @Inject(forwardRef(() => AuthService)) private authService: AuthService
  ) {
    this.initNotificationPermissions();

    // Verificar periódicamente cada 5 minutos
    this.subscription.add(
      interval(5 * 60 * 1000).subscribe(() => {
        this.checkAndSendReminders();
      })
    );
    
    // Verificación inicial diferida para no saturar el arranque
    setTimeout(() => this.checkAndSendReminders(), 4000);
  }

  private async initNotificationPermissions(): Promise<void> {
    try {
      if (Capacitor.isNativePlatform()) {
        await LocalNotifications.checkPermissions().catch(() => {});
      } else if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'default') {
          await Notification.requestPermission().catch(() => {});
        }
      }
    } catch (e) {
      console.warn('Error al verificar permisos de notificación:', e);
    }
  }

  public async triggerDeviceNotification(title: string, body: string, idSuffix: string = ''): Promise<void> {
    const todayStr = new Date().toISOString().split('T')[0];
    const trackingKey = `noteyou_device_notif_${idSuffix || (title + '_' + body)}_${todayStr}`;
    
    // Anti-Spam: Si ya se emitió hoy esta notificación exacta, no repetirla
    if (localStorage.getItem(trackingKey)) {
      return;
    }
    localStorage.setItem(trackingKey, 'true');

    try {
      if (Capacitor.isNativePlatform()) {
        const permStatus = await LocalNotifications.checkPermissions().catch(() => ({ display: 'denied' }));
        if (permStatus.display === 'granted') {
          const notifId = Math.floor(Math.random() * 1000000);
          await LocalNotifications.schedule({
            notifications: [
              {
                title: title,
                body: body,
                id: notifId,
                schedule: { at: new Date(Date.now() + 600) },
                sound: undefined,
                actionTypeId: '',
                extra: null
              }
            ]
          }).catch(() => {});
        }
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
      const currentYear = now.getFullYear();
      const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
      const currentDay = String(now.getDate()).padStart(2, '0');
      const todayStr = `${currentYear}-${currentMonth}-${currentDay}`;

      const tomorrowDate = new Date(now.getTime() + 24 * 3600 * 1000);
      const tomYear = tomorrowDate.getFullYear();
      const tomMonth = String(tomorrowDate.getMonth() + 1).padStart(2, '0');
      const tomDay = String(tomorrowDate.getDate()).padStart(2, '0');
      const tomorrowStr = `${tomYear}-${tomMonth}-${tomDay}`;

      notes.forEach(note => {
        if (!note.dueDate || note.status === 'completada') return;

        if (note.dueTime && note.dueTime.trim()) {
          // =========================================================================
          // CASO 1: CON HORA DE CUMPLIMIENTO REGISTRADA
          // 1) 1 día de anticipación (24h) | 2) 4 horas antes | 3) 1 hora antes
          // =========================================================================
          const [dYear, dMonth, dDay] = note.dueDate.split('-').map(Number);
          const [tHour, tMin] = note.dueTime.split(':').map(Number);
          const targetDateTime = new Date(dYear, dMonth - 1, dDay, tHour || 0, tMin || 0, 0);

          const diffMs = targetDateTime.getTime() - now.getTime();
          const diffHours = diffMs / (1000 * 3600);
          const diffMinutes = diffMs / (1000 * 60);

          // 1. Recordatorio 1 día antes (entre 4h y 24h antes)
          if (diffHours > 4 && diffHours <= 24) {
            const key = `task_rem_${note.id}_24h_${note.dueDate}`;
            if (!localStorage.getItem(key)) {
              localStorage.setItem(key, 'true');
              const notifTitle = `⏰ Recordatorio (1 día antes): ${note.title}`;
              const notifBody = `Tu tarea vence mañana ${note.dueDate} a las ${note.dueTime}. ¡Prepárate!`;
              this.triggerDeviceNotification(notifTitle, notifBody, `task_${note.id}_24h`);

              if (user.email) {
                this.verificationKeyService.sendTaskReminderEmail(
                  user.email,
                  `[1 Día Antes] ${note.title}`,
                  note.content,
                  note.categoryId,
                  note.priority,
                  `${note.dueDate} a las ${note.dueTime}`
                ).subscribe(() => {}, () => {});
              }
            }
          }

          // 2. Recordatorio 4 horas antes (entre 1h y 4h antes)
          if (diffHours > 1 && diffHours <= 4) {
            const key = `task_rem_${note.id}_4h_${note.dueDate}`;
            if (!localStorage.getItem(key)) {
              localStorage.setItem(key, 'true');
              const notifTitle = `⏳ Recordatorio (Faltan 4 horas): ${note.title}`;
              const notifBody = `Tu tarea vence hoy a las ${note.dueTime}. ¡Últimas horas para completarla!`;
              this.triggerDeviceNotification(notifTitle, notifBody, `task_${note.id}_4h`);

              if (user.email) {
                this.verificationKeyService.sendTaskReminderEmail(
                  user.email,
                  `[Faltan 4 Horas] ${note.title}`,
                  note.content,
                  note.categoryId,
                  note.priority,
                  `Hoy a las ${note.dueTime}`
                ).subscribe(() => {}, () => {});
              }
            }
          }

          // 3. Recordatorio 1 hora antes (entre 0 y 60 minutos antes)
          if (diffMinutes > 0 && diffMinutes <= 60) {
            const key = `task_rem_${note.id}_1h_${note.dueDate}`;
            if (!localStorage.getItem(key)) {
              localStorage.setItem(key, 'true');
              const notifTitle = `🚨 ¡Atención! Falta 1 hora: ${note.title}`;
              const notifBody = `Tu tarea con prioridad ${note.priority.toUpperCase()} vence a las ${note.dueTime}.`;
              this.triggerDeviceNotification(notifTitle, notifBody, `task_${note.id}_1h`);

              if (user.email) {
                this.verificationKeyService.sendTaskReminderEmail(
                  user.email,
                  `[Falta 1 Hora] ${note.title}`,
                  note.content,
                  note.categoryId,
                  note.priority,
                  `Hoy a las ${note.dueTime}`
                ).subscribe(() => {}, () => {});
              }
            }
          }

        } else {
          // =========================================================================
          // CASO 2: SIN HORA DE CUMPLIMIENTO (1 DÍA ANTES Y EL MISMO DÍA)
          // =========================================================================

          // 1. Un día antes
          if (note.dueDate === tomorrowStr) {
            const key = `task_rem_${note.id}_day_before_${note.dueDate}`;
            if (!localStorage.getItem(key)) {
              localStorage.setItem(key, 'true');
              const notifTitle = `⏰ Recordatorio (1 día antes): ${note.title}`;
              const notifBody = `Tu tarea con prioridad ${note.priority.toUpperCase()} vence mañana (${note.dueDate}). ¡No la olvides!`;
              this.triggerDeviceNotification(notifTitle, notifBody, `task_${note.id}_day_before`);

              if (user.email) {
                this.verificationKeyService.sendTaskReminderEmail(
                  user.email,
                  `[1 Día Antes] ${note.title}`,
                  note.content,
                  note.categoryId,
                  note.priority,
                  note.dueDate
                ).subscribe(() => {}, () => {});
              }
            }
          }

          // 2. El mismo día de cumplimiento
          if (note.dueDate === todayStr) {
            const key = `task_rem_${note.id}_same_day_${note.dueDate}`;
            if (!localStorage.getItem(key)) {
              localStorage.setItem(key, 'true');
              const notifTitle = `📅 Tarea para hoy: ${note.title}`;
              const notifBody = `Tienes una tarea programada para cumplirse hoy (${note.dueDate}).`;
              this.triggerDeviceNotification(notifTitle, notifBody, `task_${note.id}_same_day`);

              if (user.email) {
                this.verificationKeyService.sendTaskReminderEmail(
                  user.email,
                  `[Hoy] ${note.title}`,
                  note.content,
                  note.categoryId,
                  note.priority,
                  `Hoy (${note.dueDate})`
                ).subscribe(() => {}, () => {});
              }
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
          const key = `sub_budget_${s.id}_${currentMonthKey}_100`;
          if (!localStorage.getItem(key)) {
            localStorage.setItem(key, 'true');
            const notifTitle = `⚠️ Presupuesto Excedido: ${s.name}`;
            const notifBody = `Has superado el presupuesto en ${s.name} ($${totalSpent.toLocaleString()} / $${budgetLimit.toLocaleString()}).`;
            this.triggerDeviceNotification(notifTitle, notifBody, key);
          }
        } else if (usagePercent >= 85) {
          const key = `sub_budget_${s.id}_${currentMonthKey}_85`;
          if (!localStorage.getItem(key)) {
            localStorage.setItem(key, 'true');
            const notifTitle = `🔔 Alerta de Presupuesto: ${s.name}`;
            const notifBody = `Has alcanzado el ${usagePercent}% de tu presupuesto en ${s.name}.`;
            this.triggerDeviceNotification(notifTitle, notifBody, key);
          }
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
          const key = `monthly_income_alert_${currentMonthKey}_90`;
          if (!localStorage.getItem(key)) {
            localStorage.setItem(key, 'true');
            const notifTitle = `⚠️ Alerta de Gastos Mensuales`;
            const notifBody = `Tus gastos del mes ($${totalMonthExpenses.toLocaleString()}) representan el ${incomeRatio}% de tus ingresos estimados.`;
            this.triggerDeviceNotification(notifTitle, notifBody, key);
          }
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
