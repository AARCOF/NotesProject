export interface ExpenseCategory {
  id: string;
  userId: string;
  name: string;
  icon: string;
  color: string;
  createdAt: string;
}

export interface ExpenseSubcategory {
  id: string;
  categoryId: string;
  userId: string;
  name: string;
  budget?: number;
  createdAt: string;
}

export interface ExpenseItem {
  id: string;
  subcategoryId: string;
  categoryId: string;
  userId: string;
  title: string;
  amount: number;
  date: string; // Formato YYYY-MM-DD
  notes?: string;
  createdAt: string;
}

export interface MonthlyBudget {
  userId: string;
  monthKey: string; // Formato YYYY-MM
  monthlyIncome: number;
}
