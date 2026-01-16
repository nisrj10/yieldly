export interface User {
  id: number;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  household: number | null;
}

export interface Account {
  id: number;
  name: string;
  type: 'checking' | 'savings' | 'credit' | 'cash' | 'investment';
  balance: number;
  currency: string;
  is_active: boolean;
  created_at: string;
}

export interface Category {
  id: number;
  name: string;
  type: 'income' | 'expense';
  icon: string;
  color: string;
  is_default: boolean;
}

export interface Transaction {
  id: number;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  description: string;
  category: number;
  category_name: string;
  account: number;
  account_name: string;
  date: string;
  created_at: string;
  notes: string;
}

export interface Budget {
  id: number;
  name: string;
  amount: number;
  category: number;
  category_name: string;
  period: 'monthly' | 'weekly' | 'yearly';
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  spent: number;
  remaining: number;
}

export interface Investment {
  id: number;
  name: string;
  symbol: string;
  type: 'stock' | 'etf' | 'mutual_fund' | 'bond' | 'crypto' | 'real_estate' | 'other';
  quantity: number;
  purchase_price: number;
  current_price: number | null;
  purchase_date: string;
  account: number | null;
  notes: string;
  total_invested: number;
  current_value: number;
  gain_loss: number;
  gain_loss_percent: number;
}

export interface SavingsGoal {
  id: number;
  name: string;
  target_amount: number;
  current_amount: number;
  target_date: string | null;
  is_completed: boolean;
  progress_percent: number;
  created_at: string;
}

export interface DashboardData {
  total_balance: number;
  total_income: number;
  total_expenses: number;
  net_savings: number;
  investment_value: number;
  recent_transactions: Transaction[];
  budget_status: Budget[];
  savings_goals: SavingsGoal[];
}

export interface MonthlySummary {
  month: string;
  income: number;
  expenses: number;
  savings: number;
}

export interface ExpenseByCategory {
  category__name: string;
  category__color: string;
  total: number;
}

export interface MonthlyTrend {
  year: number;
  month: number;
  month_name: string;
  income: number;
  expenses: number;
  savings: number;
  savings_rate: number;
  income_target: number | null;
  expense_target: number | null;
  savings_target: number | null;
  note: string;
}

export interface MonthlyNote {
  id: number;
  year: number;
  month: number;
  month_name: string;
  note: string;
  income_target: number | null;
  expense_target: number | null;
  savings_target: number | null;
  actual_income: number;
  actual_expenses: number;
  actual_savings: number;
  created_at: string;
  updated_at: string;
}

export interface BudgetOverview {
  total_budgeted: number;
  total_spent: number;
  remaining: number;
  percent_used: number;
  budgets: BudgetDetail[];
  unbudgeted_spending: UnbudgetedCategory[];
}

export interface BudgetDetail {
  id: number;
  name: string;
  category: string;
  category_color: string;
  budgeted: number;
  spent: number;
  remaining: number;
  percent_used: number;
}

export interface UnbudgetedCategory {
  category: string;
  category_color: string;
  spent: number;
}

export interface Household {
  id: number;
  name: string;
  created_at: string;
  created_by: User;
  members: User[];
}

export interface HouseholdInvitation {
  id: number;
  household: number;
  household_name: string;
  email: string;
  invited_by: number;
  invited_by_name: string;
  invited_by_email: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  token: string;
  created_at: string;
  expires_at: string;
}

export interface AppIntegration {
  id: number;
  provider: 'snoop' | 'plaid' | 'truelayer' | 'manual';
  provider_display: string;
  status: 'connected' | 'disconnected' | 'error' | 'pending';
  status_display: string;
  last_sync_at: string | null;
  sync_error: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AvailableIntegration {
  provider: string;
  name: string;
  description: string;
  status: string;
  logo: string;
  features: string[];
  connected: boolean;
}

export interface RecurringTransaction {
  id: number;
  name: string;
  amount: number;
  type: 'income' | 'expense';
  category: number;
  category_name: string;
  account: number;
  account_name: string;
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
  start_date: string;
  end_date: string | null;
  next_date: string;
  is_active: boolean;
  created_at: string;
}
