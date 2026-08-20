import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { ExpenseCategory, ExpenseSubcategory, ExpenseItem, MonthlyBudget } from '../models/expense.model';
import { AuthService } from '../core/services/auth.service';

const EXPENSE_CATEGORIES_STORAGE_KEY = 'noteyou_expense_categories_v1';
const EXPENSE_SUBCATEGORIES_STORAGE_KEY = 'noteyou_expense_subcategories_v1';
const EXPENSE_ITEMS_STORAGE_KEY = 'noteyou_expense_items_v1';
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

  private budgetsSubject = new BehaviorSubject<MonthlyBudget[]>([]);
  public budgets$: Observable<MonthlyBudget[]> = this.budgetsSubject.asObservable();

  private openAddModalRequestSubject = new BehaviorSubject<{ open: boolean; subcategoryId?: string; categoryId?: string } | null>(null);
  public openAddModalRequest$: Observable<{ open: boolean; subcategoryId?: string; categoryId?: string } | null> = this.openAddModalRequestSubject.asObservable();

  public requestOpenAddExpenseModal(subcategoryId?: string, categoryId?: string): void {
    this.openAddModalRequestSubject.next({ open: true, subcategoryId, categoryId });
  }

  private currentUserId: string | null = null;

  constructor(private authService: AuthService) {
    this.authService.currentUser$.subscribe(user => {
      this.currentUserId = user ? user.id : null;
      this.refreshData();
    });
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
      this.budgetsSubject.next([]);
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

    const allBudgets = this.getStorageData<MonthlyBudget>(MONTHLY_BUDGET_STORAGE_KEY);
    const userBudgets = allBudgets.filter(b => b.userId === this.currentUserId);
    this.budgetsSubject.next(userBudgets);
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
      const catId = 'exp_cat_' + this.currentUserId + '_' + Date.now() + '_' + (index + 1);
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

    allCategories = [...allCategories, ...newCategories];
    this.setStorageData(EXPENSE_CATEGORIES_STORAGE_KEY, allCategories);

    allSubs = [...allSubs, ...newSubcategories];
    this.setStorageData(EXPENSE_SUBCATEGORIES_STORAGE_KEY, allSubs);

    localStorage.setItem('noteyou_expense_init_' + this.currentUserId, 'true');

    if (triggerRefresh) {
      this.refreshData();
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
    return newCategory;
  }

  public updateCategory(id: string, changes: Partial<ExpenseCategory>): void {
    const all = this.getStorageData<ExpenseCategory>(EXPENSE_CATEGORIES_STORAGE_KEY);
    const index = all.findIndex(c => c.id === id && c.userId === this.currentUserId);
    if (index !== -1) {
      all[index] = { ...all[index], ...changes };
      this.setStorageData(EXPENSE_CATEGORIES_STORAGE_KEY, all);
      this.refreshData();
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
    return newSub;
  }

  public updateSubcategory(id: string, name: string): void {
    const all = this.getStorageData<ExpenseSubcategory>(EXPENSE_SUBCATEGORIES_STORAGE_KEY);
    const index = all.findIndex(s => s.id === id && s.userId === this.currentUserId);
    if (index !== -1) {
      all[index].name = name.trim();
      this.setStorageData(EXPENSE_SUBCATEGORIES_STORAGE_KEY, all);
      this.refreshData();
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
  }

  // --- CRUD Gastos Individuales ---

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
    return newExpense;
  }

  public updateExpense(id: string, changes: Partial<Omit<ExpenseItem, 'id' | 'createdAt' | 'userId'>>): void {
    const all = this.getStorageData<ExpenseItem>(EXPENSE_ITEMS_STORAGE_KEY);
    const index = all.findIndex(e => e.id === id && e.userId === this.currentUserId);
    if (index !== -1) {
      all[index] = { ...all[index], ...changes };
      this.setStorageData(EXPENSE_ITEMS_STORAGE_KEY, all);
      this.refreshData();
    }
  }

  public deleteExpense(id: string): void {
    let all = this.getStorageData<ExpenseItem>(EXPENSE_ITEMS_STORAGE_KEY);
    all = all.filter(e => !(e.id === id && e.userId === this.currentUserId));
    this.setStorageData(EXPENSE_ITEMS_STORAGE_KEY, all);
    this.refreshData();
  }

  // --- Ingreso Mensual / Presupuesto ---

  public getMonthlyIncome(monthKey: string): number {
    if (!this.currentUserId) return 0;
    const all = this.getStorageData<MonthlyBudget>(MONTHLY_BUDGET_STORAGE_KEY);
    const budget = all.find(b => b.userId === this.currentUserId && b.monthKey === monthKey);
    return budget ? budget.monthlyIncome : 0;
  }

  public setMonthlyIncome(monthKey: string, income: number): void {
    if (!this.currentUserId) return;
    const all = this.getStorageData<MonthlyBudget>(MONTHLY_BUDGET_STORAGE_KEY);
    const index = all.findIndex(b => b.userId === this.currentUserId && b.monthKey === monthKey);

    if (index !== -1) {
      all[index].monthlyIncome = Number(income) || 0;
    } else {
      all.push({
        userId: this.currentUserId,
        monthKey,
        monthlyIncome: Number(income) || 0
      });
    }

    this.setStorageData(MONTHLY_BUDGET_STORAGE_KEY, all);
    this.refreshData();
  }

  // --- Helpers de Sumatorias y Estadísticas ---

  public getExpensesForMonth(monthKey: string): ExpenseItem[] {
    const expenses = this.expensesSubject.getValue();
    return expenses.filter(e => e.date && e.date.startsWith(monthKey));
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
