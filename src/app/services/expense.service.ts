import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, Subject, combineLatest } from 'rxjs';
import { ExpenseCategory, ExpenseSubcategory, ExpenseItem, ExtraIncomeItem, MonthlyBudget } from '../models/expense.model';
import { AuthService } from '../core/services/auth.service';
import { Preferences } from '@capacitor/preferences';

const EXPENSE_CATEGORIES_STORAGE_KEY = 'noteyou_expense_categories_v1';
const EXPENSE_SUBCATEGORIES_STORAGE_KEY = 'noteyou_expense_subcategories_v1';
const EXPENSE_ITEMS_STORAGE_KEY = 'noteyou_expense_items_v1';
const EXTRA_INCOMES_STORAGE_KEY = 'noteyou_extra_incomes_v1';
const MONTHLY_BUDGET_STORAGE_KEY = 'noteyou_monthly_budgets_v1';

@Injectable({
  providedIn: 'root'
})
export class ExpenseService {
  private categoriesSubject = new BehaviorSubject<ExpenseCategory[]>([]);
  public categories$: Observable<ExpenseCategory[]> = this.categoriesSubject.asObservable();

  private subcategoriesSubject = new BehaviorSubject<ExpenseSubcategory[]>([]);
  public subcategories$: Observable<ExpenseSubcategory[]> = this.subcategoriesSubject.asObservable();

  private expensesSubject = new BehaviorSubject<ExpenseItem[]>([]);
  public expenses$: Observable<ExpenseItem[]> = this.expensesSubject.asObservable();

  private extraIncomesSubject = new BehaviorSubject<ExtraIncomeItem[]>([]);
  public extraIncomes$: Observable<ExtraIncomeItem[]> = this.extraIncomesSubject.asObservable();

  private budgetsSubject = new BehaviorSubject<MonthlyBudget[]>([]);
  public budgets$: Observable<MonthlyBudget[]> = this.budgetsSubject.asObservable();

  private baseMonthlyIncomeSubject = new BehaviorSubject<number>(0);
  public baseMonthlyIncome$: Observable<number> = this.baseMonthlyIncomeSubject.asObservable();

  private currencySubject = new BehaviorSubject<string>('S/.');
  public currency$: Observable<string> = this.currencySubject.asObservable();

  private openAddModalRequestSubject = new Subject<{ open: boolean; subcategoryId?: string; categoryId?: string }>();
  public openAddModalRequest$: Observable<{ open: boolean; subcategoryId?: string; categoryId?: string }> = this.openAddModalRequestSubject.asObservable();

  private openAddCategoryModalRequestSubject = new Subject<void>();
  public openAddCategoryModalRequest$: Observable<void> = this.openAddCategoryModalRequestSubject.asObservable();

  private activeTabSubject = new BehaviorSubject<'gestion' | 'movimientos' | 'categorias' | 'graficas'>('gestion');
  public activeTab$: Observable<'gestion' | 'movimientos' | 'categorias' | 'graficas'> = this.activeTabSubject.asObservable();

  public setActiveTab(tab: 'gestion' | 'movimientos' | 'categorias' | 'graficas'): void {
    this.activeTabSubject.next(tab);
  }

  public getActiveTab(): 'gestion' | 'movimientos' | 'categorias' | 'graficas' {
    return this.activeTabSubject.getValue();
  }

  public requestOpenAddExpenseModal(subcategoryId?: string, categoryId?: string): void {
    this.openAddModalRequestSubject.next({ open: true, subcategoryId, categoryId });
  }

  public requestOpenAddCategoryModal(): void {
    this.openAddCategoryModalRequestSubject.next();
  }

  private currentUserId: string | null = null;
  private syncTimerSubscription: any = null;

  constructor(
    private authService: AuthService,
    private http: HttpClient
  ) {
    this.authService.currentUser$.subscribe(user => {
      this.currentUserId = user ? user.id : null;
      this.refreshData();
      this.initAutoSync();
    });

    combineLatest([
      this.expenses$,
      this.extraIncomes$,
      this.baseMonthlyIncome$,
      this.currency$
    ]).subscribe(() => {
      this.updateWidgetExpenses();
    });

    if (typeof window !== 'undefined') {
      window.addEventListener('focus', () => this.fetchCloudExpenses());
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
          if (!document.hidden) this.fetchCloudExpenses();
        });
      }
    }
  }

  private updateWidgetExpenses(): void {
    if (typeof window === 'undefined') return;
    try {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();
      const monthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;

      const expenses = this.expensesSubject.getValue();
      const extraIncomes = this.extraIncomesSubject.getValue();
      const baseIncome = this.getMonthlyIncome(monthKey);
      const currency = this.currencySubject.getValue() || 'S/.';

      const currentMonthExpenses = expenses
        .filter(exp => {
          if (!exp.date) return false;
          const d = new Date(exp.date);
          return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
        })
        .reduce((sum, exp) => sum + (exp.amount || 0), 0);

      const currentMonthExtra = extraIncomes
        .filter(inc => {
          if (!inc.date) return false;
          const d = new Date(inc.date);
          return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
        })
        .reduce((sum, inc) => sum + (inc.amount || 0), 0);

      const totalIncome = baseIncome + currentMonthExtra;
      const balance = totalIncome - currentMonthExpenses;

      const format = (val: number) => `${currency} ${val.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

      const widgetData = {
        balance: format(balance),
        income: format(totalIncome),
        expenses: format(currentMonthExpenses)
      };

      localStorage.setItem('widget_expenses_json', JSON.stringify(widgetData));
      localStorage.setItem('CapacitorStorage.widget_expenses_json', JSON.stringify(widgetData));

      Preferences.set({
        key: 'widget_expenses_json',
        value: JSON.stringify(widgetData)
      }).catch(() => {});

    } catch (e) {
      console.error('Error updating expenses widget:', e);
    }
  }

  private initAutoSync(): void {
    if (this.syncTimerSubscription) {
      clearInterval(this.syncTimerSubscription);
      this.syncTimerSubscription = null;
    }
    if (this.currentUserId) {
      this.syncTimerSubscription = setInterval(() => {
        this.fetchCloudExpenses();
      }, 3000);
    }
  }

  // --- LocalStorage Helpers ---

  private getStorageData<T>(key: string): T[] {
    const data = localStorage.getItem(key);
    if (!data) return [];
    try {
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  private setStorageData<T>(key: string, data: T[]): void {
    localStorage.setItem(key, JSON.stringify(data));
  }

  public refreshData(): void {
    if (!this.currentUserId) {
      this.categoriesSubject.next([]);
      this.subcategoriesSubject.next([]);
      this.expensesSubject.next([]);
      this.extraIncomesSubject.next([]);
      this.budgetsSubject.next([]);
      this.baseMonthlyIncomeSubject.next(0);
      return;
    }

    this.ensureDefaultCategoriesAndSubcategories();

    const allCategories = this.getStorageData<ExpenseCategory>(EXPENSE_CATEGORIES_STORAGE_KEY);
    const userCategories = allCategories.filter(c => c.userId === this.currentUserId);
    this.categoriesSubject.next(userCategories);

    const allSubcategories = this.getStorageData<ExpenseSubcategory>(EXPENSE_SUBCATEGORIES_STORAGE_KEY);
    const userSubcategories = allSubcategories.filter(s => s.userId === this.currentUserId);
    this.subcategoriesSubject.next(userSubcategories);

    const allExpenses = this.getStorageData<ExpenseItem>(EXPENSE_ITEMS_STORAGE_KEY);
    const userExpenses = allExpenses.filter(e => e.userId === this.currentUserId);
    this.expensesSubject.next(userExpenses);

    const allExtra = this.getStorageData<ExtraIncomeItem>(EXTRA_INCOMES_STORAGE_KEY);
    const userExtra = allExtra.filter(i => i.userId === this.currentUserId);
    this.extraIncomesSubject.next(userExtra);

    const allBudgets = this.getStorageData<MonthlyBudget>(MONTHLY_BUDGET_STORAGE_KEY);
    const userBudgets = allBudgets.filter(b => b.userId === this.currentUserId);
    this.budgetsSubject.next(userBudgets);

    const baseIncome = this.getBaseMonthlyIncome();
    this.baseMonthlyIncomeSubject.next(baseIncome);

    const currency = this.getCurrency();
    this.currencySubject.next(currency);

    this.fetchCloudExpenses();
  }

  public syncToCloud(): void {
    if (!this.currentUserId) return;
    const allExpenses = this.getStorageData<ExpenseItem>(EXPENSE_ITEMS_STORAGE_KEY).filter(e => e.userId === this.currentUserId);
    const allBudgets = this.getStorageData<MonthlyBudget>(MONTHLY_BUDGET_STORAGE_KEY).filter(b => b.userId === this.currentUserId);
    const allExtra = this.getStorageData<ExtraIncomeItem>(EXTRA_INCOMES_STORAGE_KEY).filter(i => i.userId === this.currentUserId);
    const allCats = this.getStorageData<ExpenseCategory>(EXPENSE_CATEGORIES_STORAGE_KEY).filter(c => c.userId === this.currentUserId);
    const allSubs = this.getStorageData<ExpenseSubcategory>(EXPENSE_SUBCATEGORIES_STORAGE_KEY).filter(s => s.userId === this.currentUserId);
    const baseIncome = this.getBaseMonthlyIncome();
    const currency = this.getCurrency();

    this.http.post('/api/expenses', {
      expenses: allExpenses,
      budgets: allBudgets,
      extraIncomes: allExtra,
      categories: allCats,
      subcategories: allSubs,
      baseMonthlyIncome: baseIncome,
      currency: currency
    }).subscribe({
      next: () => {
        // Al sincronizar con éxito, el servidor tiene la última versión
      },
      error: () => {}
    });
  }

  // Helper para mezclar entidades respetando updatedAt y eliminaciones
  private mergeWithCloud<T extends { id: string; createdAt?: string; updatedAt?: string; userId?: string }>(
    cloudItems: T[],
    localStorageKey: string,
    deletedIdsStorageKey: string
  ): { merged: T[]; needsPush: boolean } {
    let all = this.getStorageData<T>(localStorageKey);
    const otherUsers = all.filter(item => item.userId !== this.currentUserId);
    const localUserItems = all.filter(item => item.userId === this.currentUserId);

    const deletedIds = new Set(this.getStorageData<string>(deletedIdsStorageKey));
    const localMap = new Map<string, T>();
    localUserItems.forEach(item => localMap.set(item.id, item));

    const finalMap = new Map<string, T>();
    let needsPush = false;

    // 1. Procesar items que vienen de la nube
    cloudItems.forEach(cloudItem => {
      if (deletedIds.has(cloudItem.id)) {
        // Se eliminó localmente en este dispositivo pero la nube aún lo tenía
        needsPush = true;
        return;
      }

      const localItem = localMap.get(cloudItem.id);
      if (!localItem) {
        // Nuevo item creado en otro dispositivo
        finalMap.set(cloudItem.id, cloudItem);
      } else {
        const cloudTime = new Date(cloudItem.updatedAt || cloudItem.createdAt || 0).getTime();
        const localTime = new Date(localItem.updatedAt || localItem.createdAt || 0).getTime();

        if (localTime > cloudTime) {
          // Editado localmente más recientemente que la nube -> conservar local y enviar
          finalMap.set(localItem.id, localItem);
          needsPush = true;
        } else {
          // La nube tiene la versión más reciente o igual -> adoptar nube
          finalMap.set(cloudItem.id, cloudItem);
        }
      }
    });

    // 2. Procesar items locales creados recientemente que aún no llegaron a la nube
    const now = Date.now();
    localUserItems.forEach(localItem => {
      if (deletedIds.has(localItem.id)) return;
      if (!finalMap.has(localItem.id)) {
        const localTime = new Date(localItem.updatedAt || localItem.createdAt || 0).getTime();
        // Si se creó hace menos de 60 segundos, conservarlo para no perderlo antes del POST
        if (now - localTime < 60000) {
          finalMap.set(localItem.id, localItem);
          needsPush = true;
        }
      }
    });

    const merged = Array.from(finalMap.values());
    this.setStorageData(localStorageKey, [...merged, ...otherUsers]);
    return { merged, needsPush };
  }

  public fetchCloudExpenses(): void {
    if (!this.currentUserId) return;
    this.http.get<{
      success: boolean;
      hasCloudData?: boolean;
      expenses?: ExpenseItem[];
      budgets?: MonthlyBudget[];
      extraIncomes?: ExtraIncomeItem[];
      categories?: ExpenseCategory[];
      subcategories?: ExpenseSubcategory[];
      baseMonthlyIncome?: number;
      currency?: string;
      updatedAt?: string;
    }>('/api/expenses').subscribe({
      next: (res) => {
        if (res && res.success) {
          if (!res.hasCloudData) {
            // Primera vez: enviar datos locales a la nube
            this.syncToCloud();
            return;
          }

          // 1. Sincronizar preferencia de moneda
          if (res.currency && typeof res.currency === 'string') {
            this.setCurrency(res.currency, false);
          }

          // 2. Sincronizar sueldo base
          if (res.baseMonthlyIncome !== undefined && res.baseMonthlyIncome !== null) {
            const cloudIncome = Number(res.baseMonthlyIncome) || 0;
            this.setBaseMonthlyIncome(cloudIncome, false);
            this.baseMonthlyIncomeSubject.next(cloudIncome);
          }

          // 3. Sincronizar categorías
          if (Array.isArray(res.categories)) {
            let all = this.getStorageData<ExpenseCategory>(EXPENSE_CATEGORIES_STORAGE_KEY);
            const other = all.filter(c => c.userId !== this.currentUserId);
            this.setStorageData(EXPENSE_CATEGORIES_STORAGE_KEY, [...res.categories, ...other]);
            this.categoriesSubject.next(res.categories);
          }

          // 4. Sincronizar subcategorías
          if (Array.isArray(res.subcategories)) {
            let all = this.getStorageData<ExpenseSubcategory>(EXPENSE_SUBCATEGORIES_STORAGE_KEY);
            const other = all.filter(s => s.userId !== this.currentUserId);
            this.setStorageData(EXPENSE_SUBCATEGORIES_STORAGE_KEY, [...res.subcategories, ...other]);
            this.subcategoriesSubject.next(res.subcategories);
          }

          // 5. Sincronizar gastos
          if (Array.isArray(res.expenses)) {
            let all = this.getStorageData<ExpenseItem>(EXPENSE_ITEMS_STORAGE_KEY);
            const other = all.filter(e => e.userId !== this.currentUserId);
            this.setStorageData(EXPENSE_ITEMS_STORAGE_KEY, [...res.expenses, ...other]);
            this.expensesSubject.next(res.expenses);
          }

          // 6. Sincronizar presupuestos por mes
          if (Array.isArray(res.budgets)) {
            let all = this.getStorageData<MonthlyBudget>(MONTHLY_BUDGET_STORAGE_KEY);
            const other = all.filter(b => b.userId !== this.currentUserId);
            this.setStorageData(MONTHLY_BUDGET_STORAGE_KEY, [...res.budgets, ...other]);
            this.budgetsSubject.next(res.budgets);
          }

          // 7. Sincronizar ingresos extras / bonos
          if (Array.isArray(res.extraIncomes)) {
            let all = this.getStorageData<ExtraIncomeItem>(EXTRA_INCOMES_STORAGE_KEY);
            const other = all.filter(i => i.userId !== this.currentUserId);
            this.setStorageData(EXTRA_INCOMES_STORAGE_KEY, [...res.extraIncomes, ...other]);
            this.extraIncomesSubject.next(res.extraIncomes);
          }
        }
      },
      error: () => {}
    });
  }

  private ensureDefaultCategoriesAndSubcategories(): void {
    if (!this.currentUserId) return;

    const initKey = 'noteyou_expense_init_' + this.currentUserId;
    const isInitialized = localStorage.getItem(initKey);

    let allCategories = this.getStorageData<ExpenseCategory>(EXPENSE_CATEGORIES_STORAGE_KEY);
    const userCats = allCategories.filter(c => c.userId === this.currentUserId);

    if (!isInitialized && userCats.length === 0) {
      this.restoreDefaultCategories(false);
      localStorage.setItem(initKey, 'true');
    }
  }

  public restoreDefaultCategories(triggerRefresh: boolean = true): void {
    if (!this.currentUserId) return;

    const defaultCategories: { name: string; icon: string; color: string; subcategories: string[] }[] = [
      {
        name: 'Vivienda',
        icon: 'typcn-home',
        color: '#3b82f6',
        subcategories: ['Alquiler / Hipoteca', 'Mantenimiento & Reparaciones', 'Muebles & Hogar']
      },
      {
        name: 'Alimentación',
        icon: 'typcn-shopping-cart',
        color: '#10b981',
        subcategories: ['Supermercado & Compras', 'Restaurantes & Delivery', 'Cafetería & Snacks']
      },
      {
        name: 'Transporte',
        icon: 'typcn-plane',
        color: '#f59e0b',
        subcategories: ['Combustible', 'Transporte Público / Taxis', 'Mantenimiento Vehículo']
      },
      {
        name: 'Servicios & Suministros',
        icon: 'typcn-flash',
        color: '#8b5cf6',
        subcategories: ['Luz & Electricidad', 'Agua & Gas', 'Internet & Telefonía', 'Suscripciones & Streaming']
      },
      {
        name: 'Ocio & Estilo de Vida',
        icon: 'typcn-film',
        color: '#ec4899',
        subcategories: ['Salidas & Cine', 'Hobbies & Deportes', 'Viajes & Vacaciones']
      },
      {
        name: 'Salud & Cuidado',
        icon: 'typcn-heart',
        color: '#06b6d4',
        subcategories: ['Farmacia & Medicinas', 'Consultas Médicas', 'Gimnasio & Bienestar']
      }
    ];

    let allCategories = this.getStorageData<ExpenseCategory>(EXPENSE_CATEGORIES_STORAGE_KEY);
    let allSubs = this.getStorageData<ExpenseSubcategory>(EXPENSE_SUBCATEGORIES_STORAGE_KEY);

    const newCategories: ExpenseCategory[] = [];
    const newSubcategories: ExpenseSubcategory[] = [];

    defaultCategories.forEach((def, index) => {
      const catId = 'exp_cat_' + this.currentUserId + '_' + (index + 1);
      newCategories.push({
        id: catId,
        userId: this.currentUserId!,
        name: def.name,
        icon: def.icon,
        color: def.color,
        createdAt: new Date().toISOString()
      });

      def.subcategories.forEach((subName, sIdx) => {
        newSubcategories.push({
          id: 'exp_sub_' + catId + '_' + (sIdx + 1),
          categoryId: catId,
          userId: this.currentUserId!,
          name: subName,
          createdAt: new Date().toISOString()
        });
      });
    });

    const otherCats = allCategories.filter(c => c.userId !== this.currentUserId);
    const otherSubs = allSubs.filter(s => s.userId !== this.currentUserId);

    this.setStorageData(EXPENSE_CATEGORIES_STORAGE_KEY, [...newCategories, ...otherCats]);
    this.setStorageData(EXPENSE_SUBCATEGORIES_STORAGE_KEY, [...newSubcategories, ...otherSubs]);

    localStorage.setItem('noteyou_expense_init_' + this.currentUserId, 'true');

    if (triggerRefresh) {
      this.refreshData();
      this.syncToCloud();
    }
  }

  // Helpers para tracking de eliminaciones
  private trackDeletedId(storageKey: string, id: string): void {
    const ids = this.getStorageData<string>(storageKey);
    if (!ids.includes(id)) {
      ids.push(id);
      this.setStorageData(storageKey, ids);
    }
  }

  // --- CRUD Categorías ---

  public addCategory(name: string, icon: string, color: string): ExpenseCategory | null {
    if (!this.currentUserId) return null;
    const now = new Date().toISOString();
    const newCategory: ExpenseCategory = {
      id: 'exp_cat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      userId: this.currentUserId,
      name: name.trim(),
      icon: icon || 'typcn-folder',
      color: color || '#3b82f6',
      createdAt: now,
      updatedAt: now
    };

    const all = this.getStorageData<ExpenseCategory>(EXPENSE_CATEGORIES_STORAGE_KEY);
    all.push(newCategory);
    this.setStorageData(EXPENSE_CATEGORIES_STORAGE_KEY, all);
    this.refreshData();
    this.syncToCloud();
    return newCategory;
  }

  public updateCategory(id: string, changes: Partial<ExpenseCategory>): void {
    const all = this.getStorageData<ExpenseCategory>(EXPENSE_CATEGORIES_STORAGE_KEY);
    const index = all.findIndex(c => c.id === id && c.userId === this.currentUserId);
    if (index !== -1) {
      all[index] = { ...all[index], ...changes, updatedAt: new Date().toISOString() };
      this.setStorageData(EXPENSE_CATEGORIES_STORAGE_KEY, all);
      this.refreshData();
      this.syncToCloud();
    }
  }

  public deleteCategory(id: string): void {
    this.trackDeletedId('noteyou_deleted_expense_cats_' + this.currentUserId, id);

    let allCats = this.getStorageData<ExpenseCategory>(EXPENSE_CATEGORIES_STORAGE_KEY);
    allCats = allCats.filter(c => !(c.id === id && c.userId === this.currentUserId));
    this.setStorageData(EXPENSE_CATEGORIES_STORAGE_KEY, allCats);

    // Eliminar subcategorías y gastos hijos
    let allSubs = this.getStorageData<ExpenseSubcategory>(EXPENSE_SUBCATEGORIES_STORAGE_KEY);
    allSubs.filter(s => s.categoryId === id && s.userId === this.currentUserId).forEach(s => {
      this.trackDeletedId('noteyou_deleted_expense_subs_' + this.currentUserId, s.id);
    });
    allSubs = allSubs.filter(s => !(s.categoryId === id && s.userId === this.currentUserId));
    this.setStorageData(EXPENSE_SUBCATEGORIES_STORAGE_KEY, allSubs);

    let allExpenses = this.getStorageData<ExpenseItem>(EXPENSE_ITEMS_STORAGE_KEY);
    allExpenses.filter(e => e.categoryId === id && e.userId === this.currentUserId).forEach(e => {
      this.trackDeletedId('noteyou_deleted_expense_items_' + this.currentUserId, e.id);
    });
    allExpenses = allExpenses.filter(e => !(e.categoryId === id && e.userId === this.currentUserId));
    this.setStorageData(EXPENSE_ITEMS_STORAGE_KEY, allExpenses);

    this.refreshData();
    this.syncToCloud();
  }

  // --- CRUD Subcategorías ---

  public addSubcategory(categoryId: string, name: string): ExpenseSubcategory | null {
    if (!this.currentUserId) return null;
    const now = new Date().toISOString();
    const newSub: ExpenseSubcategory = {
      id: 'exp_sub_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      categoryId,
      userId: this.currentUserId,
      name: name.trim(),
      createdAt: now,
      updatedAt: now
    };

    const all = this.getStorageData<ExpenseSubcategory>(EXPENSE_SUBCATEGORIES_STORAGE_KEY);
    all.push(newSub);
    this.setStorageData(EXPENSE_SUBCATEGORIES_STORAGE_KEY, all);
    this.refreshData();
    this.syncToCloud();
    return newSub;
  }

  public updateSubcategory(id: string, name: string): void {
    const all = this.getStorageData<ExpenseSubcategory>(EXPENSE_SUBCATEGORIES_STORAGE_KEY);
    const index = all.findIndex(s => s.id === id && s.userId === this.currentUserId);
    if (index !== -1) {
      all[index] = { ...all[index], name: name.trim(), updatedAt: new Date().toISOString() };
      this.setStorageData(EXPENSE_SUBCATEGORIES_STORAGE_KEY, all);
      this.refreshData();
      this.syncToCloud();
    }
  }

  public deleteSubcategory(id: string): void {
    this.trackDeletedId('noteyou_deleted_expense_subs_' + this.currentUserId, id);

    let allSubs = this.getStorageData<ExpenseSubcategory>(EXPENSE_SUBCATEGORIES_STORAGE_KEY);
    allSubs = allSubs.filter(s => !(s.id === id && s.userId === this.currentUserId));
    this.setStorageData(EXPENSE_SUBCATEGORIES_STORAGE_KEY, allSubs);

    let allExpenses = this.getStorageData<ExpenseItem>(EXPENSE_ITEMS_STORAGE_KEY);
    allExpenses.filter(e => e.subcategoryId === id && e.userId === this.currentUserId).forEach(e => {
      this.trackDeletedId('noteyou_deleted_expense_items_' + this.currentUserId, e.id);
    });
    allExpenses = allExpenses.filter(e => !(e.subcategoryId === id && e.userId === this.currentUserId));
    this.setStorageData(EXPENSE_ITEMS_STORAGE_KEY, allExpenses);

    this.refreshData();
    this.syncToCloud();
  }

  // --- CRUD Gastos Individuales (Con soporte para Gastos Recurrentes) ---

  public addExpense(item: Omit<ExpenseItem, 'id' | 'createdAt' | 'userId'>): ExpenseItem | null {
    if (!this.currentUserId) return null;
    const now = new Date().toISOString();
    const expDate = item.date || now.split('T')[0];
    const expMonth = expDate.substring(0, 7);

    const newExpense: ExpenseItem = {
      ...item,
      id: 'exp_item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      userId: this.currentUserId,
      date: expDate,
      recurringSince: item.isRecurring ? expMonth : undefined,
      createdAt: now,
      updatedAt: now
    };

    const all = this.getStorageData<ExpenseItem>(EXPENSE_ITEMS_STORAGE_KEY);
    all.unshift(newExpense);
    this.setStorageData(EXPENSE_ITEMS_STORAGE_KEY, all);
    this.refreshData();
    this.syncToCloud();
    return newExpense;
  }

  public updateExpense(id: string, changes: Partial<Omit<ExpenseItem, 'id' | 'createdAt' | 'userId'>>): void {
    const all = this.getStorageData<ExpenseItem>(EXPENSE_ITEMS_STORAGE_KEY);
    const index = all.findIndex(e => e.id === id && e.userId === this.currentUserId);
    if (index !== -1) {
      const oldItem = all[index];
      const now = new Date().toISOString();
      const updatedDate = changes.date || oldItem.date || now.split('T')[0];
      const updatedMonth = updatedDate.substring(0, 7);

      // Si se activa la recurrencia o se actualiza la fecha, la recurrencia inicia desde esta fecha en adelante
      let recurringSince = oldItem.recurringSince;
      if (changes.isRecurring !== undefined) {
        recurringSince = changes.isRecurring ? (oldItem.recurringSince || updatedMonth) : undefined;
      }

      all[index] = {
        ...oldItem,
        ...changes,
        date: updatedDate,
        recurringSince,
        updatedAt: now
      };
      this.setStorageData(EXPENSE_ITEMS_STORAGE_KEY, all);
      this.refreshData();
      this.syncToCloud();
    }
  }

  public deleteExpense(id: string): void {
    this.trackDeletedId('noteyou_deleted_expense_items_' + this.currentUserId, id);

    let all = this.getStorageData<ExpenseItem>(EXPENSE_ITEMS_STORAGE_KEY);
    all = all.filter(e => !(e.id === id && e.userId === this.currentUserId));
    this.setStorageData(EXPENSE_ITEMS_STORAGE_KEY, all);
    this.refreshData();
    this.syncToCloud();
  }

  // --- CRUD Bonus o Ingresos Extra ---

  public addExtraIncome(item: Omit<ExtraIncomeItem, 'id' | 'createdAt' | 'userId'>): ExtraIncomeItem | null {
    if (!this.currentUserId) return null;
    const now = new Date().toISOString();
    const newIncome: ExtraIncomeItem = {
      ...item,
      id: 'extra_inc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      userId: this.currentUserId,
      createdAt: now,
      updatedAt: now
    };

    const all = this.getStorageData<ExtraIncomeItem>(EXTRA_INCOMES_STORAGE_KEY);
    all.unshift(newIncome);
    this.setStorageData(EXTRA_INCOMES_STORAGE_KEY, all);
    this.refreshData();
    this.syncToCloud();
    return newIncome;
  }

  public updateExtraIncome(id: string, changes: Partial<Omit<ExtraIncomeItem, 'id' | 'createdAt' | 'userId'>>): void {
    const all = this.getStorageData<ExtraIncomeItem>(EXTRA_INCOMES_STORAGE_KEY);
    const index = all.findIndex(i => i.id === id && i.userId === this.currentUserId);
    if (index !== -1) {
      all[index] = { ...all[index], ...changes, updatedAt: new Date().toISOString() };
      this.setStorageData(EXTRA_INCOMES_STORAGE_KEY, all);
      this.refreshData();
      this.syncToCloud();
    }
  }

  public deleteExtraIncome(id: string): void {
    this.trackDeletedId('noteyou_deleted_extra_incomes_' + this.currentUserId, id);

    let all = this.getStorageData<ExtraIncomeItem>(EXTRA_INCOMES_STORAGE_KEY);
    all = all.filter(i => !(i.id === id && i.userId === this.currentUserId));
    this.setStorageData(EXTRA_INCOMES_STORAGE_KEY, all);
    this.refreshData();
    this.syncToCloud();
  }

  public getExtraIncomesForMonth(monthKey: string): ExtraIncomeItem[] {
    const items = this.extraIncomesSubject.getValue();
    return items
      .filter(i => i.date && i.date.startsWith(monthKey))
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  public getTotalExtraIncomeForMonth(monthKey: string): number {
    const items = this.getExtraIncomesForMonth(monthKey);
    return items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }

  // --- Ingreso Mensual Base (Persistente durante todos los meses) ---

  private getBaseIncomeStorageKey(): string {
    return 'noteyou_base_monthly_income_' + (this.currentUserId || 'default');
  }

  public getBaseMonthlyIncome(): number {
    if (!this.currentUserId) return 0;
    const val = localStorage.getItem(this.getBaseIncomeStorageKey());
    return val ? Number(val) || 0 : 0;
  }

  public setBaseMonthlyIncome(income: number, triggerSync: boolean = true): void {
    if (!this.currentUserId) return;
    localStorage.setItem(this.getBaseIncomeStorageKey(), String(Number(income) || 0));
    if (triggerSync) {
      this.refreshData();
      this.syncToCloud();
    }
  }

  // --- Moneda / Divisa Preferida ---

  public getCurrency(): string {
    if (!this.currentUserId) return 'S/.';
    return localStorage.getItem('noteyou_currency_' + this.currentUserId) || 'S/.';
  }

  public setCurrency(currency: string, triggerSync: boolean = true): void {
    if (!this.currentUserId) return;
    const trimmed = currency ? currency.trim() : 'S/.';
    localStorage.setItem('noteyou_currency_' + this.currentUserId, trimmed);
    this.currencySubject.next(trimmed);
    if (triggerSync) {
      this.syncToCloud();
    }
  }

  public getMonthlyIncome(monthKey: string): number {
    if (!this.currentUserId) return 0;
    const all = this.getStorageData<MonthlyBudget>(MONTHLY_BUDGET_STORAGE_KEY);
    const budget = all.find(b => b.userId === this.currentUserId && b.monthKey === monthKey);
    if (budget && budget.monthlyIncome !== undefined && budget.monthlyIncome !== null) {
      return budget.monthlyIncome;
    }
    // Si no tiene registro exclusivo para ese mes, hereda el ingreso mensual base persistente
    return this.getBaseMonthlyIncome();
  }

  public setMonthlyIncome(
    monthKey: string, 
    income: number, 
    scope: 'only_this' | 'from_this_forward' | 'all_months' = 'from_this_forward'
  ): void {
    if (!this.currentUserId) return;
    const num = Number(income) || 0;
    const now = new Date().toISOString();
    let all = this.getStorageData<MonthlyBudget>(MONTHLY_BUDGET_STORAGE_KEY);

    if (scope === 'all_months') {
      this.setBaseMonthlyIncome(num, false);
      let foundCurrent = false;
      for (const b of all) {
        if (b.userId === this.currentUserId) {
          b.monthlyIncome = num;
          b.updatedAt = now;
          if (b.monthKey === monthKey) {
            foundCurrent = true;
          }
        }
      }
      if (!foundCurrent) {
        all.push({
          userId: this.currentUserId,
          monthKey,
          monthlyIncome: num,
          updatedAt: now
        });
      }
    } else if (scope === 'from_this_forward') {
      // Actualiza la base para futuros meses
      this.setBaseMonthlyIncome(num, false);
      let foundCurrent = false;
      for (const b of all) {
        if (b.userId === this.currentUserId && b.monthKey >= monthKey) {
          b.monthlyIncome = num;
          b.updatedAt = now;
          if (b.monthKey === monthKey) foundCurrent = true;
        }
      }
      if (!foundCurrent) {
        all.push({
          userId: this.currentUserId,
          monthKey,
          monthlyIncome: num,
          updatedAt: now
        });
      }
    } else {
      // only_this: solo para el mes seleccionado
      const index = all.findIndex(b => b.userId === this.currentUserId && b.monthKey === monthKey);
      if (index !== -1) {
        all[index].monthlyIncome = num;
        all[index].updatedAt = now;
      } else {
        all.push({
          userId: this.currentUserId,
          monthKey,
          monthlyIncome: num,
          updatedAt: now
        });
      }
    }

    this.setStorageData(MONTHLY_BUDGET_STORAGE_KEY, all);
    this.refreshData();
    this.syncToCloud();
  }

  public deleteMonthlyIncome(
    monthKey: string,
    scope: 'only_this' | 'from_this_forward' | 'all_months' = 'from_this_forward'
  ): void {
    if (!this.currentUserId) return;
    const now = new Date().toISOString();
    let all = this.getStorageData<MonthlyBudget>(MONTHLY_BUDGET_STORAGE_KEY);

    if (scope === 'all_months') {
      this.setBaseMonthlyIncome(0, false);
      for (const b of all) {
        if (b.userId === this.currentUserId) {
          b.monthlyIncome = 0;
          b.updatedAt = now;
        }
      }
    } else if (scope === 'from_this_forward') {
      this.setBaseMonthlyIncome(0, false);
      for (const b of all) {
        if (b.userId === this.currentUserId && b.monthKey >= monthKey) {
          b.monthlyIncome = 0;
          b.updatedAt = now;
        }
      }
      const cur = all.find(b => b.userId === this.currentUserId && b.monthKey === monthKey);
      if (!cur) {
        all.push({ userId: this.currentUserId, monthKey, monthlyIncome: 0, updatedAt: now });
      }
    } else {
      // only_this: poner en 0 el mes actual para que no herede el sueldo base
      const index = all.findIndex(b => b.userId === this.currentUserId && b.monthKey === monthKey);
      if (index !== -1) {
        all[index].monthlyIncome = 0;
        all[index].updatedAt = now;
      } else {
        all.push({ userId: this.currentUserId, monthKey, monthlyIncome: 0, updatedAt: now });
      }
    }

    this.setStorageData(MONTHLY_BUDGET_STORAGE_KEY, all);
    this.refreshData();
    this.syncToCloud();
  }

  public getTotalIncomeForMonth(monthKey: string): number {
    return this.getMonthlyIncome(monthKey) + this.getTotalExtraIncomeForMonth(monthKey);
  }

  // --- Helpers de Sumatorias y Estadísticas (Incluyendo Gastos Recurrentes) ---

  public getExpensesForMonth(monthKey: string): ExpenseItem[] {
    const expenses = this.expensesSubject.getValue();
    const result: ExpenseItem[] = [];
    const seenIds = new Set<string>();

    for (const exp of expenses) {
      if (!exp.date) continue;
      const expMonth = exp.date.substring(0, 7);
      const startMonth = exp.recurringSince || expMonth;

      if (expMonth === monthKey) {
        result.push(exp);
        seenIds.add(exp.id);
      } else if (exp.isRecurring && startMonth <= monthKey && expMonth !== monthKey && !seenIds.has(exp.id)) {
        // Gasto recurrente: proyectar para el mes actual manteniendo el día de cobro SOLO desde su fecha de creación/activación hacia el futuro
        const day = exp.date.substring(8, 10) || '01';
        const projectedDate = `${monthKey}-${day}`;
        result.push({
          ...exp,
          date: projectedDate
        });
        seenIds.add(exp.id);
      }
    }

    return result.sort((a, b) => b.date.localeCompare(a.date));
  }

  public getTotalExpensesForMonth(monthKey: string): number {
    const expenses = this.getExpensesForMonth(monthKey);
    return expenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }

  public getSubcategoryTotal(subcategoryId: string, monthKey: string): number {
    const expenses = this.getExpensesForMonth(monthKey);
    return expenses
      .filter(e => e.subcategoryId === subcategoryId)
      .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }

  public getCategoryTotal(categoryId: string, monthKey: string): number {
    const expenses = this.getExpensesForMonth(monthKey);
    return expenses
      .filter(e => e.categoryId === categoryId)
      .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }
}
