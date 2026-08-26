import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { Subscription, combineLatest } from 'rxjs';
import { ChartOptions, ChartType } from 'chart.js';
import { Label, SingleDataSet } from 'ng2-charts';
import { ExpenseService } from '../../services/expense.service';
import { ExpenseCategory, ExpenseSubcategory, ExpenseItem, ExtraIncomeItem } from '../../models/expense.model';

@Component({
  selector: 'app-expenses-dashboard',
  templateUrl: './expenses-dashboard.component.html',
  styleUrls: ['./expenses-dashboard.component.scss']
})
export class ExpensesDashboardComponent implements OnInit, OnDestroy {
  categories: ExpenseCategory[] = [];
  subcategories: ExpenseSubcategory[] = [];
  expenses: ExpenseItem[] = [];
  extraIncomes: ExtraIncomeItem[] = [];
  
  selectedMonthKey: string = ''; // YYYY-MM
  formattedMonthLabel: string = '';
  currencySymbol: string = 'S/.'; // O '$'

  // Presupuesto, Ingresos y KPIs
  monthlyIncome: number = 0; // Sueldo o Ingreso base mensual
  totalExtraIncome: number = 0; // Total de bonos e ingresos extra
  totalIncome: number = 0; // Ingreso Total = Base + Extra
  totalExpenses: number = 0;
  balance: number = 0;
  budgetUsedPercent: number = 0;

  // Acordeón de subcategorías expandidas
  expandedSubcategories: { [subId: string]: boolean } = {};

  // Filtro de búsqueda rápida
  searchTerm: string = '';

  // Paginación de histórico de gastos
  historyPage: number = 1;
  historyPageSize: number = 10;

  // Vista Activa (Pestañas)
  // En Móvil: 'gestion' predeterminada. En Web/Desktop: 'categorias' predeterminada
  isMobile: boolean = false;
  activeTab: 'categorias' | 'graficas' | 'movimientos' | 'gestion' = 'gestion';
  private isTabInitialized: boolean = false;

  @HostListener('window:resize')
  onResize(): void {
    this.checkScreenSize();
  }

  private checkScreenSize(): void {
    this.isMobile = window.innerWidth < 992;
    if (!this.isTabInitialized) {
      this.activeTab = this.isMobile ? 'gestion' : 'categorias';
      this.isTabInitialized = true;
    }
  }

  setActiveTab(tab: 'categorias' | 'graficas' | 'movimientos' | 'gestion'): void {
    this.activeTab = tab;
  }

  // Gráficos ng2-charts
  public chartOptions: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    legend: {
      position: 'bottom',
      labels: {
        fontColor: '#475569',
        fontSize: 12,
        boxWidth: 12,
        padding: 14
      }
    },
    tooltips: {
      callbacks: {
        label: (tooltipItem, data) => {
          const dataset = data.datasets![tooltipItem.datasetIndex!];
          const currentValue = dataset.data![tooltipItem.index!] as number;
          const label = data.labels![tooltipItem.index!];
          return ` ${label}: ${this.currencySymbol} ${currentValue.toFixed(2)}`;
        }
      }
    }
  };

  // Doughnut Chart (Categorías)
  public categoryChartLabels: Label[] = [];
  public categoryChartData: SingleDataSet = [];
  public categoryChartType: ChartType = 'doughnut';
  public categoryChartColors: any[] = [{ backgroundColor: [] }];

  // Bar Chart (Top Subcategorías)
  public subcategoryChartOptions: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      xAxes: [{
        gridLines: { display: false },
        ticks: { fontColor: '#64748b', fontSize: 11 }
      }],
      yAxes: [{
        gridLines: { color: '#f1f5f9' },
        ticks: {
          beginAtZero: true,
          fontColor: '#64748b',
          callback: (value) => `${this.currencySymbol} ${value}`
        }
      }]
    },
    legend: { display: false }
  };
  public subcategoryChartLabels: Label[] = [];
  public subcategoryChartData: any[] = [{ data: [], label: 'Gasto Total', backgroundColor: '#3b82f6' }];
  public subcategoryChartType: ChartType = 'bar';

  // --- Modales ---
  // Modal Gasto Individual (con soporte de Gasto Recurrente)
  isExpenseModalOpen: boolean = false;
  expenseToEdit: ExpenseItem | null = null;
  expenseForm = {
    title: '',
    amount: null as number | null,
    categoryId: '',
    subcategoryId: '',
    date: '',
    notes: '',
    isRecurring: false
  };

  // Modal Categoría
  isCategoryModalOpen: boolean = false;
  categoryToEdit: ExpenseCategory | null = null;
  categoryForm = {
    name: '',
    icon: 'typcn-folder',
    color: '#3b82f6'
  };

  // Modal Subcategoría
  isSubcategoryModalOpen: boolean = false;
  subcategoryToEdit: ExpenseSubcategory | null = null;
  subcategoryForm = {
    categoryId: '',
    name: ''
  };

  // Modal Ingreso Mensual Base
  isIncomeModalOpen: boolean = false;
  incomeFormAmount: number | null = null;
  incomeApplyToAllMonths: boolean = true;

  // Modal Bonus / Ingreso Extra
  isExtraIncomeModalOpen: boolean = false;
  extraIncomeToEdit: ExtraIncomeItem | null = null;
  extraIncomeForm = {
    title: '',
    amount: null as number | null,
    date: '',
    notes: ''
  };

  // Iconos y Colores disponibles
  availableIcons = [
    { class: 'typcn-home', label: 'Hogar' },
    { class: 'typcn-shopping-cart', label: 'Compras' },
    { class: 'typcn-plane', label: 'Viajes' },
    { class: 'typcn-flash', label: 'Servicios' },
    { class: 'typcn-film', label: 'Ocio' },
    { class: 'typcn-heart', label: 'Salud' },
    { class: 'typcn-book', label: 'Educación' },
    { class: 'typcn-coffee', label: 'Café' },
    { class: 'typcn-credit-card', label: 'Finanzas' },
    { class: 'typcn-gift', label: 'Regalos' },
    { class: 'typcn-device-phone', label: 'Tecnología' },
    { class: 'typcn-tag', label: 'Varios' }
  ];

  availableColors = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
    '#8b5cf6', '#ec4899', '#06b6d4', '#14b8a6',
    '#6366f1', '#84cc16', '#f97316', '#64748b'
  ];

  private subscriptions = new Subscription();

  constructor(private expenseService: ExpenseService) {}

  ngOnInit(): void {
    this.checkScreenSize();
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    this.selectedMonthKey = `${year}-${month}`;
    this.updateFormattedMonthLabel();

    this.subscriptions.add(
      combineLatest([
        this.expenseService.categories$,
        this.expenseService.subcategories$,
        this.expenseService.expenses$,
        this.expenseService.extraIncomes$,
        this.expenseService.budgets$,
        this.expenseService.baseMonthlyIncome$
      ]).subscribe(([cats, subs, exps, extraInc]) => {
        this.categories = cats;
        this.subcategories = subs;
        this.expenses = exps;
        this.extraIncomes = extraInc;
        this.calculateMetricsAndCharts();
      })
    );

    this.subscriptions.add(
      this.expenseService.openAddModalRequest$.subscribe(req => {
        if (req && req.open) {
          this.openAddExpenseModal(req.subcategoryId, req.categoryId);
        }
      })
    );

    this.subscriptions.add(
      this.expenseService.openAddCategoryModalRequest$.subscribe(() => {
        this.openAddCategoryModal();
      })
    );

    this.subscriptions.add(
      this.expenseService.activeTab$.subscribe(tab => {
        this.activeTab = tab;
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  // --- Navegación de Fechas ---

  updateFormattedMonthLabel(): void {
    const [year, month] = this.selectedMonthKey.split('-');
    const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
    const monthName = date.toLocaleString('es-ES', { month: 'long' });
    this.formattedMonthLabel = `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${year}`;
  }

  prevMonth(): void {
    const [yearStr, monthStr] = this.selectedMonthKey.split('-');
    let year = parseInt(yearStr, 10);
    let month = parseInt(monthStr, 10) - 1;
    if (month < 1) {
      month = 12;
      year--;
    }
    this.selectedMonthKey = `${year}-${String(month).padStart(2, '0')}`;
    this.updateFormattedMonthLabel();
    this.calculateMetricsAndCharts();
  }

  nextMonth(): void {
    const [yearStr, monthStr] = this.selectedMonthKey.split('-');
    let year = parseInt(yearStr, 10);
    let month = parseInt(monthStr, 10) + 1;
    if (month > 12) {
      month = 1;
      year++;
    }
    this.selectedMonthKey = `${year}-${String(month).padStart(2, '0')}`;
    this.updateFormattedMonthLabel();
    this.calculateMetricsAndCharts();
  }

  setTodayMonth(): void {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    this.selectedMonthKey = `${year}-${month}`;
    this.updateFormattedMonthLabel();
    this.calculateMetricsAndCharts();
  }

  // --- Cálculos y Gráficas ---

  calculateMetricsAndCharts(): void {
    this.monthlyIncome = this.expenseService.getMonthlyIncome(this.selectedMonthKey);
    this.totalExtraIncome = this.expenseService.getTotalExtraIncomeForMonth(this.selectedMonthKey);
    this.totalIncome = this.monthlyIncome + this.totalExtraIncome;
    this.totalExpenses = this.expenseService.getTotalExpensesForMonth(this.selectedMonthKey);
    this.balance = this.totalIncome - this.totalExpenses;

    this.budgetUsedPercent = this.totalIncome > 0 
      ? Math.min(100, Math.round((this.totalExpenses / this.totalIncome) * 100))
      : 0;

    this.updateCharts();
  }

  updateCharts(): void {
    // 1. Gráfico de Categorías (Doughnut)
    const catLabels: string[] = [];
    const catData: number[] = [];
    const catColors: string[] = [];

    this.categories.forEach(cat => {
      const total = this.expenseService.getCategoryTotal(cat.id, this.selectedMonthKey);
      if (total > 0) {
        catLabels.push(cat.name);
        catData.push(total);
        catColors.push(cat.color || '#3b82f6');
      }
    });

    this.categoryChartLabels = catLabels;
    this.categoryChartData = catData;
    this.categoryChartColors = [{ backgroundColor: catColors }];

    // 2. Gráfico de Subcategorías (Bar Chart Top)
    const subTotals: { name: string; amount: number }[] = [];
    this.subcategories.forEach(sub => {
      const total = this.expenseService.getSubcategoryTotal(sub.id, this.selectedMonthKey);
      if (total > 0) {
        subTotals.push({ name: sub.name, amount: total });
      }
    });

    subTotals.sort((a, b) => b.amount - a.amount);
    const topSubs = subTotals.slice(0, 6);

    this.subcategoryChartLabels = topSubs.map(s => s.name);
    this.subcategoryChartData = [{
      data: topSubs.map(s => s.amount),
      label: 'Gasto',
      backgroundColor: '#3b82f6'
    }];
  }

  // --- Getters y Filtros para la Plantilla ---

  getCategorySubcategories(categoryId: string): ExpenseSubcategory[] {
    return this.subcategories.filter(s => s.categoryId === categoryId);
  }

  getSubcategoryExpenses(subcategoryId: string): ExpenseItem[] {
    const monthExpenses = this.expenseService.getExpensesForMonth(this.selectedMonthKey);
    let items = monthExpenses.filter(e => e.subcategoryId === subcategoryId);
    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      items = items.filter(e => 
        e.title.toLowerCase().includes(term) || 
        (e.notes && e.notes.toLowerCase().includes(term))
      );
    }
    return items;
  }

  getCategoryTotal(categoryId: string): number {
    return this.expenseService.getCategoryTotal(categoryId, this.selectedMonthKey);
  }

  getSubcategoryTotal(subcategoryId: string): number {
    return this.expenseService.getSubcategoryTotal(subcategoryId, this.selectedMonthKey);
  }

  getCategoryPercentage(categoryId: string): number {
    if (this.totalExpenses === 0) return 0;
    const catTotal = this.getCategoryTotal(categoryId);
    return Math.round((catTotal / this.totalExpenses) * 100);
  }

  getAllMonthExpenses(): ExpenseItem[] {
    const monthExpenses = this.expenseService.getExpensesForMonth(this.selectedMonthKey);
    if (!this.searchTerm.trim()) return monthExpenses;
    const term = this.searchTerm.toLowerCase();
    return monthExpenses.filter(e => 
      e.title.toLowerCase().includes(term) || 
      (e.notes && e.notes.toLowerCase().includes(term))
    );
  }

  getMonthExtraIncomes(): ExtraIncomeItem[] {
    return this.expenseService.getExtraIncomesForMonth(this.selectedMonthKey);
  }

  getCategoryById(categoryId: string): ExpenseCategory | undefined {
    return this.categories.find(c => c.id === categoryId);
  }

  getSubcategoryById(subcategoryId: string): ExpenseSubcategory | undefined {
    return this.subcategories.find(s => s.id === subcategoryId);
  }

  // Acordeón
  toggleSubcategory(subId: string): void {
    this.expandedSubcategories[subId] = !this.expandedSubcategories[subId];
  }

  isSubcategoryExpanded(subId: string): boolean {
    return !!this.expandedSubcategories[subId];
  }

  expandAllSubcategories(): void {
    this.subcategories.forEach(s => {
      this.expandedSubcategories[s.id] = true;
    });
  }

  collapseAllSubcategories(): void {
    this.expandedSubcategories = {};
  }

  // --- Métodos de Modales CRUD ---

  // Gasto Modal
  // Scroll helper to prevent unwanted auto-scroll on mobile when modals open/close
  private savedScrollTop: number = 0;

  private recordScrollPosition(): void {
    const container = document.querySelector('.workspace-view-container') || document.querySelector('.main-panel');
    if (container) {
      this.savedScrollTop = container.scrollTop;
      container.classList.add('modal-open-locked');
    } else if (typeof window !== 'undefined') {
      this.savedScrollTop = window.scrollY || document.documentElement.scrollTop || 0;
    }
    if (typeof document !== 'undefined' && document.body) {
      document.body.classList.add('modal-open-locked');
    }
  }

  private restoreScrollPosition(): void {
    if (typeof document !== 'undefined') {
      if (document.body) {
        document.body.classList.remove('modal-open-locked');
      }
      const container = document.querySelector('.workspace-view-container') || document.querySelector('.main-panel');
      if (container) {
        container.classList.remove('modal-open-locked');
      }
      if (document.activeElement && typeof (document.activeElement as HTMLElement).blur === 'function') {
        (document.activeElement as HTMLElement).blur();
      }
    }
    const target = this.savedScrollTop;
    const applyScroll = () => {
      const container = document.querySelector('.workspace-view-container') || document.querySelector('.main-panel');
      if (container) {
        container.scrollTop = target;
      }
      if (typeof window !== 'undefined') {
        window.scrollTo(0, target);
      }
    };

    applyScroll();
    requestAnimationFrame(applyScroll);
    setTimeout(applyScroll, 20);
    setTimeout(applyScroll, 80);
    setTimeout(applyScroll, 180);
    setTimeout(applyScroll, 350);
  }

  trackByCat(index: number, cat: ExpenseCategory): string {
    return cat ? cat.id : String(index);
  }

  trackBySub(index: number, sub: ExpenseSubcategory): string {
    return sub ? sub.id : String(index);
  }

  trackByExp(index: number, exp: ExpenseItem): string {
    return exp ? exp.id : String(index);
  }

  trackByIncome(index: number, inc: ExtraIncomeItem): string {
    return inc ? inc.id : String(index);
  }

  openAddExpenseModal(subcategoryId?: string, categoryId?: string): void {
    this.recordScrollPosition();
    this.expenseToEdit = null;
    let targetCatId = categoryId || (this.categories.length > 0 ? this.categories[0].id : '');
    let targetSubId = subcategoryId || '';

    if (!targetSubId && targetCatId) {
      const subs = this.getCategorySubcategories(targetCatId);
      if (subs.length > 0) targetSubId = subs[0].id;
    }

    if (targetSubId && !targetCatId) {
      const foundSub = this.subcategories.find(s => s.id === targetSubId);
      if (foundSub) targetCatId = foundSub.categoryId;
    }

    const todayDate = new Date().toISOString().split('T')[0];
    const defaultDate = todayDate.startsWith(this.selectedMonthKey) 
      ? todayDate 
      : `${this.selectedMonthKey}-01`;

    this.expenseForm = {
      title: '',
      amount: null,
      categoryId: targetCatId,
      subcategoryId: targetSubId,
      date: defaultDate,
      notes: '',
      isRecurring: false
    };
    this.isExpenseModalOpen = true;
  }

  openEditExpenseModal(expense: ExpenseItem): void {
    this.recordScrollPosition();
    this.expenseToEdit = expense;
    this.expenseForm = {
      title: expense.title,
      amount: expense.amount,
      categoryId: expense.categoryId,
      subcategoryId: expense.subcategoryId,
      date: expense.date,
      notes: expense.notes || '',
      isRecurring: !!expense.isRecurring
    };
    this.isExpenseModalOpen = true;
  }

  closeExpenseModal(): void {
    this.isExpenseModalOpen = false;
    this.restoreScrollPosition();
  }

  onExpenseCategoryChange(): void {
    const subs = this.getCategorySubcategories(this.expenseForm.categoryId);
    this.expenseForm.subcategoryId = subs.length > 0 ? subs[0].id : '';
  }

  saveExpense(): void {
    if (!this.expenseForm.title.trim() || !this.expenseForm.amount || !this.expenseForm.subcategoryId) {
      return;
    }

    const sub = this.subcategories.find(s => s.id === this.expenseForm.subcategoryId);
    const catId = sub ? sub.categoryId : this.expenseForm.categoryId;

    if (this.expenseToEdit) {
      this.expenseService.updateExpense(this.expenseToEdit.id, {
        title: this.expenseForm.title.trim(),
        amount: Number(this.expenseForm.amount),
        categoryId: catId,
        subcategoryId: this.expenseForm.subcategoryId,
        date: this.expenseForm.date || new Date().toISOString().split('T')[0],
        notes: this.expenseForm.notes.trim() || undefined,
        isRecurring: !!this.expenseForm.isRecurring
      });
    } else {
      this.expenseService.addExpense({
        title: this.expenseForm.title.trim(),
        amount: Number(this.expenseForm.amount),
        categoryId: catId,
        subcategoryId: this.expenseForm.subcategoryId,
        date: this.expenseForm.date || new Date().toISOString().split('T')[0],
        notes: this.expenseForm.notes.trim() || undefined,
        isRecurring: !!this.expenseForm.isRecurring
      });
    }

    this.expandedSubcategories[this.expenseForm.subcategoryId] = true;
    this.closeExpenseModal();
  }

  deleteExpense(expense: ExpenseItem, event?: Event): void {
    if (event) event.stopPropagation();
    const recurringText = expense.isRecurring ? ' (gasto recurrente mensual)' : '';
    if (confirm(`¿Eliminar el gasto "${expense.title}" de ${this.currencySymbol} ${expense.amount}${recurringText}?`)) {
      this.expenseService.deleteExpense(expense.id);
    }
  }

  // Categoría Modal
  openAddCategoryModal(): void {
    this.recordScrollPosition();
    this.categoryToEdit = null;
    this.categoryForm = {
      name: '',
      icon: 'typcn-folder',
      color: '#3b82f6'
    };
    this.isCategoryModalOpen = true;
  }

  openEditCategoryModal(cat: ExpenseCategory, event?: Event): void {
    if (event) event.stopPropagation();
    this.recordScrollPosition();
    this.categoryToEdit = cat;
    this.categoryForm = {
      name: cat.name,
      icon: cat.icon,
      color: cat.color
    };
    this.isCategoryModalOpen = true;
  }

  closeCategoryModal(): void {
    this.isCategoryModalOpen = false;
    this.restoreScrollPosition();
  }

  saveCategory(): void {
    if (!this.categoryForm.name.trim()) return;

    if (this.categoryToEdit) {
      this.expenseService.updateCategory(this.categoryToEdit.id, {
        name: this.categoryForm.name.trim(),
        icon: this.categoryForm.icon,
        color: this.categoryForm.color
      });
    } else {
      this.expenseService.addCategory(
        this.categoryForm.name.trim(),
        this.categoryForm.icon,
        this.categoryForm.color
      );
    }
    this.closeCategoryModal();
  }

  deleteCategory(cat: ExpenseCategory | null, event?: Event): void {
    if (!cat) return;
    if (event) event.stopPropagation();
    if (confirm(`¿Eliminar la categoría "${cat.name}" y todas sus subcategorías y gastos?`)) {
      this.expenseService.deleteCategory(cat.id);
      if (this.categoryToEdit && this.categoryToEdit.id === cat.id) {
        this.closeCategoryModal();
      }
    }
  }

  deleteCategoryFromModal(): void {
    if (this.categoryToEdit) {
      this.deleteCategory(this.categoryToEdit);
    }
  }

  restoreSuggestedCategories(): void {
    if (confirm('¿Restaurar las categorías sugeridas por defecto para organizar tus finanzas?')) {
      this.expenseService.restoreDefaultCategories(true);
    }
  }

  // Subcategoría Modal
  openAddSubcategoryModal(categoryId?: string): void {
    this.recordScrollPosition();
    this.subcategoryToEdit = null;
    this.subcategoryForm = {
      categoryId: categoryId || (this.categories.length > 0 ? this.categories[0].id : ''),
      name: ''
    };
    this.isSubcategoryModalOpen = true;
  }

  openEditSubcategoryModal(sub: ExpenseSubcategory, event?: Event): void {
    if (event) event.stopPropagation();
    this.recordScrollPosition();
    this.subcategoryToEdit = sub;
    this.subcategoryForm = {
      categoryId: sub.categoryId,
      name: sub.name
    };
    this.isSubcategoryModalOpen = true;
  }

  closeSubcategoryModal(): void {
    this.isSubcategoryModalOpen = false;
    this.restoreScrollPosition();
  }

  saveSubcategory(): void {
    if (!this.subcategoryForm.name.trim() || !this.subcategoryForm.categoryId) return;

    if (this.subcategoryToEdit) {
      this.expenseService.updateSubcategory(this.subcategoryToEdit.id, this.subcategoryForm.name.trim());
    } else {
      this.expenseService.addSubcategory(this.subcategoryForm.categoryId, this.subcategoryForm.name.trim());
    }
    this.closeSubcategoryModal();
  }

  deleteSubcategory(sub: ExpenseSubcategory, event?: Event): void {
    if (event) event.stopPropagation();
    if (confirm(`¿Eliminar la subcategoría "${sub.name}" y todos sus gastos?`)) {
      this.expenseService.deleteSubcategory(sub.id);
    }
  }

  // Ingreso Mensual Base Modal
  openIncomeModal(): void {
    this.recordScrollPosition();
    this.incomeFormAmount = this.monthlyIncome > 0 ? this.monthlyIncome : null;
    this.incomeApplyToAllMonths = true;
    this.isIncomeModalOpen = true;
  }

  closeIncomeModal(): void {
    this.isIncomeModalOpen = false;
    this.restoreScrollPosition();
  }

  saveIncome(): void {
    const amount = Number(this.incomeFormAmount) || 0;
    this.expenseService.setMonthlyIncome(this.selectedMonthKey, amount, this.incomeApplyToAllMonths);
    this.closeIncomeModal();
  }

  // Bonus / Ingreso Extra Modal
  openAddExtraIncomeModal(): void {
    this.recordScrollPosition();
    this.extraIncomeToEdit = null;
    const todayDate = new Date().toISOString().split('T')[0];
    const defaultDate = todayDate.startsWith(this.selectedMonthKey) 
      ? todayDate 
      : `${this.selectedMonthKey}-01`;

    this.extraIncomeForm = {
      title: '',
      amount: null,
      date: defaultDate,
      notes: ''
    };
    this.isExtraIncomeModalOpen = true;
  }

  openEditExtraIncomeModal(item: ExtraIncomeItem, event?: Event): void {
    if (event) event.stopPropagation();
    this.recordScrollPosition();
    this.extraIncomeToEdit = item;
    this.extraIncomeForm = {
      title: item.title,
      amount: item.amount,
      date: item.date,
      notes: item.notes || ''
    };
    this.isExtraIncomeModalOpen = true;
  }

  closeExtraIncomeModal(): void {
    this.isExtraIncomeModalOpen = false;
    this.restoreScrollPosition();
  }

  saveExtraIncome(): void {
    if (!this.extraIncomeForm.title.trim() || !this.extraIncomeForm.amount) return;

    if (this.extraIncomeToEdit) {
      this.expenseService.updateExtraIncome(this.extraIncomeToEdit.id, {
        title: this.extraIncomeForm.title.trim(),
        amount: Number(this.extraIncomeForm.amount),
        date: this.extraIncomeForm.date || new Date().toISOString().split('T')[0],
        notes: this.extraIncomeForm.notes.trim() || undefined
      });
    } else {
      this.expenseService.addExtraIncome({
        title: this.extraIncomeForm.title.trim(),
        amount: Number(this.extraIncomeForm.amount),
        date: this.extraIncomeForm.date || new Date().toISOString().split('T')[0],
        notes: this.extraIncomeForm.notes.trim() || undefined
      });
    }
    this.closeExtraIncomeModal();
  }

  deleteExtraIncome(item: ExtraIncomeItem, event?: Event): void {
    if (event) event.stopPropagation();
    if (confirm(`¿Eliminar el ingreso extra / bono "${item.title}" de ${this.currencySymbol} ${item.amount}?`)) {
      this.expenseService.deleteExtraIncome(item.id);
    }
  }

  // --- Paginación y Helpers de Gastos Históricos ---

  getCategoryForExpense(catId: string): ExpenseCategory | undefined {
    return this.categories.find(c => c.id === catId);
  }

  getSubcategoryForExpense(subId: string): ExpenseSubcategory | undefined {
    return this.subcategories.find(s => s.id === subId);
  }

  getPaginatedMonthExpenses(): ExpenseItem[] {
    const all = this.getAllMonthExpenses();
    const start = (this.historyPage - 1) * this.historyPageSize;
    return all.slice(start, start + this.historyPageSize);
  }

  getHistoryTotalPages(): number {
    const all = this.getAllMonthExpenses();
    return Math.ceil(all.length / this.historyPageSize) || 1;
  }

  getHistoryRangeText(): string {
    const all = this.getAllMonthExpenses();
    if (all.length === 0) return '0 de 0';
    const start = (this.historyPage - 1) * this.historyPageSize + 1;
    const end = Math.min(this.historyPage * this.historyPageSize, all.length);
    return `${start}-${end} de ${all.length}`;
  }

  getHistoryPageNumbers(): number[] {
    const total = this.getHistoryTotalPages();
    const pages: number[] = [];
    for (let i = 1; i <= total; i++) {
      pages.push(i);
    }
    return pages;
  }

  prevHistoryPage(event?: Event): void {
    if (event) event.preventDefault();
    if (this.historyPage > 1) {
      this.historyPage--;
    }
  }

  nextHistoryPage(event?: Event): void {
    if (event) event.preventDefault();
    if (this.historyPage < this.getHistoryTotalPages()) {
      this.historyPage++;
    }
  }

  setHistoryPage(page: number, event?: Event): void {
    if (event) event.preventDefault();
    this.historyPage = page;
  }
}
