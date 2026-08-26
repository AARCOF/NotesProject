import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { ExpenseCategory, ExpenseSubcategory, ExpenseItem, ExtraIncomeItem, MonthlyBudget } from '../models/expense.model';
import { AuthService } from '../core/services/auth.service';

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

  private openAddModalRequestSubject = new Subject<{ open: boolean; subcategoryId?: string; categoryId?: string }>();
  public openAddModalRequest$: Observable<{ open: boolean; subcategoryId?: string; categoryId?: string }> = this.openAddModalRequestSubject.asObservable();

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

    if (typeof window !== 'undefined') {
      window.addEventListener('focus', () => this.fetchCloudExpenses());
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
          if (!document.hidden) this.fetchCloudExpenses();
        });
      }
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

    this.http.post('/api/expenses', {
      expenses: allExpenses,
      budgets: allBudgets,
      extraIncomes: allExtra,
      categories: allCats,
      subcategories: allSubs,
      baseMonthlyIncome: baseIncome
    }).subscribe({ error: () => {} });
  }

  public fetchCloudExpenses(): void {
    if (!this.currentUserId) return;
    this.http.get<{
      success: boolean;
      expenses?: ExpenseItem[];
      budgets?: MonthlyBudget[];
      extraIncomes?: ExtraIncomeItem[];
      categories?: ExpenseCategory[];
      subcategories?: ExpenseSubcategory[];
      baseMonthlyIncome?: number;
    }>('/api/expenses').subscribe({
      next: (res) => {
        if (res && res.success) {
          // Sincronizar sueldo base de forma bidireccional
          if (res.baseMonthlyIncome !== undefined && res.baseMonthlyIncome !== null) {
            const cloudIncome = Number(res.baseMonthlyIncome) || 0;
            const localIncome = this.getBaseMonthlyIncome();
            if (cloudIncome > 0) {
              this.setBaseMonthlyIncome(cloudIncome, false);
            } else if (localIncome > 0) {
              this.syncToCloud();
            }
          }

          // Sincronizar y mergear categorías
          if (Array.isArray(res.categories) && res.categories.length > 0) {
            let all = this.getStorageData<ExpenseCategory>(EXPENSE_CATEGORIES_STORAGE_KEY);
            const other = all.filter(c => c.userId !== this.currentUserId);
            const localUser = all.filter(c => c.userId === this.currentUserId);
            const catMap = new Map<string, ExpenseCategory>();
            res.categories.forEach(c => catMap.set(c.id, c));
            localUser.forEach(c => { if (!catMap.has(c.id)) catMap.set(c.id, c); });
            const mergedCats = Array.from(catMap.values());
            this.setStorageData(EXPENSE_CATEGORIES_STORAGE_KEY, [...mergedCats, ...other]);
            this.categoriesSubject.next(mergedCats);
          }

          // Sincronizar y mergear subcategorías
          if (Array.isArray(res.subcategories) && res.subcategories.length > 0) {
            let all = this.getStorageData<ExpenseSubcategory>(EXPENSE_SUBCATEGORIES_STORAGE_KEY);
            const other = all.filter(s => s.userId !== this.currentUserId);
            const localUser = all.filter(s => s.userId === this.currentUserId);
            const subMap = new Map<string, ExpenseSubcategory>();
            res.subcategories.forEach(s => subMap.set(s.id, s));
            localUser.forEach(s => { if (!subMap.has(s.id)) subMap.set(s.id, s); });
            const mergedSubs = Array.from(subMap.values());
            this.setStorageData(EXPENSE_SUBCATEGORIES_STORAGE_KEY, [...mergedSubs, ...other]);
            this.subcategoriesSubject.next(mergedSubs);
          }

          // Sincronizar y mergear gastos
          if (Array.isArray(res.expenses)) {
            let all = this.getStorageData<ExpenseItem>(EXPENSE_ITEMS_STORAGE_KEY);
            const other = all.filter(e => e.userId !== this.currentUserId);
            const localUser = all.filter(e => e.userId === this.currentUserId);
            const expMap = new Map<string, ExpenseItem>();
            res.expenses.forEach(e => expMap.set(e.id, e));
            localUser.forEach(e => { if (!expMap.has(e.id)) expMap.set(e.id, e); });
            const mergedExpenses = Array.from(expMap.values());
            this.setStorageData(EXPENSE_ITEMS_STORAGE_KEY, [...mergedExpenses, ...other]);
            this.expensesSubject.next(mergedExpenses);
          }

          // Sincronizar y mergear presupuestos / ingresos por mes
          if (Array.isArray(res.budgets)) {
            let all = this.getStorageData<MonthlyBudget>(MONTHLY_BUDGET_STORAGE_KEY);
            const other = all.filter(b => b.userId !== this.currentUserId);
            const localUser = all.filter(b => b.userId === this.currentUserId);
            const bMap = new Map<string, MonthlyBudget>();
            res.budgets.forEach(b => bMap.set(b.monthKey, b));
            localUser.forEach(b => { if (!bMap.has(b.monthKey)) bMap.set(b.monthKey, b); });
            const mergedBudgets = Array.from(bMap.values());
            this.setStorageData(MONTHLY_BUDGET_STORAGE_KEY, [...mergedBudgets, ...other]);
            this.budgetsSubject.next(mergedBudgets);
          }

          // Sincronizar y mergear bonos / ingresos extras
          if (Array.isArray(res.extraIncomes)) {
            let all = this.getStorageData<ExtraIncomeItem>(EXTRA_INCOMES_STORAGE_KEY);
            const other = all.filter(i => i.userId !== this.currentUserId);
            const localUser = all.filter(i => i.userId === this.currentUserId);
            const incMap = new Map<string, ExtraIncomeItem>();
            res.extraIncomes.forEach(i => incMap.set(i.id, i));
            localUser.forEach(i => { if (!incMap.has(i.id)) incMap.set(i.id, i); });
            const mergedExtra = Array.from(incMap.values());
            this.setStorageData(EXTRA_INCOMES_STORAGE_KEY, [...mergedExtra, ...other]);
            this.extraIncomesSubject.next(mergedExtra);
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

  // --- CRUD Categorías ---

  public addCategory(name: string, icon: string, color: string): ExpenseCategory | null {
    if (!this.currentUserId) return null;
    const newCategory: ExpenseCategory = {
      id: 'exp_cat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      userId: this.currentUserId,
      name: name.trim(),
      icon: icon || 'typcn-folder',
      color: color || '#3b82f6',
      createdAt: new Date().toISOString()
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
      all[index] = { ...all[index], ...changes };
      this.setStorageData(EXPENSE_CATEGORIES_STORAGE_KEY, all);
      this.refreshData();
      this.syncToCloud();
    }
  }

  public deleteCategory(id: string): void {
    let allCats = this.getStorageData<ExpenseCategory>(EXPENSE_CATEGORIES_STORAGE_KEY);
    allCats = allCats.filter(c => !(c.id === id && c.userId === this.currentUserId));
    this.setStorageData(EXPENSE_CATEGORIES_STORAGE_KEY, allCats);

    // Eliminar subcategorías y gastos hijos
    let allSubs = this.getStorageData<ExpenseSubcategory>(EXPENSE_SUBCATEGORIES_STORAGE_KEY);
    allSubs = allSubs.filter(s => !(s.categoryId === id && s.userId === this.currentUserId));
    this.setStorageData(EXPENSE_SUBCATEGORIES_STORAGE_KEY, allSubs);

    let allExpenses = this.getStorageData<ExpenseItem>(EXPENSE_ITEMS_STORAGE_KEY);
    allExpenses = allExpenses.filter(e => !(e.categoryId === id && e.userId === this.currentUserId));
    this.setStorageData(EXPENSE_ITEMS_STORAGE_KEY, allExpenses);

    this.refreshData();
    this.syncToCloud();
  }

  // --- CRUD Subcategorías ---

  public addSubcategory(categoryId: string, name: string): ExpenseSubcategory | null {
    if (!this.currentUserId) return null;
    const newSub: ExpenseSubcategory = {
      id: 'exp_sub_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      categoryId,
      userId: this.currentUserId,
      name: name.trim(),
      createdAt: new Date().toISOString()
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
      all[index].name = name.trim();
      this.setStorageData(EXPENSE_SUBCATEGORIES_STORAGE_KEY, all);
      this.refreshData();
      this.syncToCloud();
    }
  }

  public deleteSubcategory(id: string): void {
    let allSubs = this.getStorageData<ExpenseSubcategory>(EXPENSE_SUBCATEGORIES_STORAGE_KEY);
    allSubs = allSubs.filter(s => !(s.id === id && s.userId === this.currentUserId));
    this.setStorageData(EXPENSE_SUBCATEGORIES_STORAGE_KEY, allSubs);

    let allExpenses = this.getStorageData<ExpenseItem>(EXPENSE_ITEMS_STORAGE_KEY);
    allExpenses = allExpenses.filter(e => !(e.subcategoryId === id && e.userId === this.currentUserId));
    this.setStorageData(EXPENSE_ITEMS_STORAGE_KEY, allExpenses);

    this.refreshData();
    this.syncToCloud();
  }

  // --- CRUD Gastos Individuales (Con soporte para Gastos Recurrentes) ---

  public addExpense(item: Omit<ExpenseItem, 'id' | 'createdAt' | 'userId'>): ExpenseItem | null {
    if (!this.currentUserId) return null;
    const newExpense: ExpenseItem = {
      ...item,
      id: 'exp_item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      userId: this.currentUserId,
      createdAt: new Date().toISOString()
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
      all[index] = { ...all[index], ...changes };
      this.setStorageData(EXPENSE_ITEMS_STORAGE_KEY, all);
      this.refreshData();
      this.syncToCloud();
    }
  }

  public deleteExpense(id: string): void {
    let all = this.getStorageData<ExpenseItem>(EXPENSE_ITEMS_STORAGE_KEY);
    all = all.filter(e => !(e.id === id && e.userId === this.currentUserId));
    this.setStorageData(EXPENSE_ITEMS_STORAGE_KEY, all);
    this.refreshData();
    this.syncToCloud();
  }

  // --- CRUD Bonus o Ingresos Extra ---

  public addExtraIncome(item: Omit<ExtraIncomeItem, 'id' | 'createdAt' | 'userId'>): ExtraIncomeItem | null {
    if (!this.currentUserId) return null;
    const newIncome: ExtraIncomeItem = {
      ...item,
      id: 'extra_inc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      userId: this.currentUserId,
      createdAt: new Date().toISOString()
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
      all[index] = { ...all[index], ...changes };
      this.setStorageData(EXTRA_INCOMES_STORAGE_KEY, all);
      this.refreshData();
      this.syncToCloud();
    }
  }

  public deleteExtraIncome(id: string): void {
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

  public getMonthlyIncome(monthKey: string): number {
    if (!this.currentUserId) return 0;
    const all = this.getStorageData<MonthlyBudget>(MONTHLY_BUDGET_STORAGE_KEY);
    const budget = all.find(b => b.userId === this.currentUserId && b.monthKey === monthKey);
    if (budget && budget.monthlyIncome !== undefined && budget.monthlyIncome !== null && budget.monthlyIncome > 0) {
      return budget.monthlyIncome;
    }
    // Si no tiene registro exclusivo para ese mes, hereda el ingreso mensual base persistente
    return this.getBaseMonthlyIncome();
  }

  public setMonthlyIncome(monthKey: string, income: number, updateBaseIncomeForAllMonths: boolean = true): void {
    if (!this.currentUserId) return;
    const num = Number(income) || 0;

    if (updateBaseIncomeForAllMonths) {
      this.setBaseMonthlyIncome(num);
    }

    const all = this.getStorageData<MonthlyBudget>(MONTHLY_BUDGET_STORAGE_KEY);
    const index = all.findIndex(b => b.userId === this.currentUserId && b.monthKey === monthKey);

    if (index !== -1) {
      all[index].monthlyIncome = num;
    } else {
      all.push({
        userId: this.currentUserId,
        monthKey,
        monthlyIncome: num
      });
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

      if (expMonth === monthKey) {
        result.push(exp);
        seenIds.add(exp.id);
      } else if (exp.isRecurring && expMonth <= monthKey && !seenIds.has(exp.id)) {
        // Gasto recurrente: proyectar para el mes actual manteniendo el día de cobro
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
