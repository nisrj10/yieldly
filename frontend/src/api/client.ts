import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          const response = await axios.post(`${API_BASE_URL}/auth/token/refresh/`, {
            refresh: refreshToken,
          });

          localStorage.setItem('access_token', response.data.access);
          api.defaults.headers.common['Authorization'] = `Bearer ${response.data.access}`;

          return api(originalRequest);
        } catch {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          window.location.href = '/login';
        }
      }
    }

    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login/', { email, password }),

  register: (data: {
    email: string;
    username: string;
    first_name: string;
    password: string;
    password_confirm: string;
  }) => api.post('/auth/register/', data),

  getProfile: () => api.get('/auth/profile/'),

  updateProfile: (data: Partial<{ first_name: string; last_name: string }>) =>
    api.patch('/auth/profile/', data),

  // Household
  getHouseholds: () => api.get('/auth/households/'),
  createHousehold: (name: string) => api.post('/auth/households/', { name }),
  inviteToHousehold: (householdId: number, email: string) =>
    api.post(`/auth/households/${householdId}/invite/`, { email }),
  getHouseholdInvitations: (householdId: number) =>
    api.get(`/auth/households/${householdId}/invitations/`),
  leaveHousehold: (householdId: number) =>
    api.post(`/auth/households/${householdId}/leave/`),
  acceptInvitation: (token: string) =>
    api.post('/auth/accept-invitation/', { token }),
  getPendingInvitations: () => api.get('/auth/pending-invitations/'),

  // Integrations
  getAvailableIntegrations: () => api.get('/auth/available-integrations/'),
  getIntegrations: () => api.get('/auth/integrations/'),
  createIntegration: (provider: string) =>
    api.post('/auth/integrations/', { provider }),
  disconnectIntegration: (id: number) =>
    api.post(`/auth/integrations/${id}/disconnect/`),

  // Snoop CSV Import
  importSnoopCSV: (file: File, accountId: number) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('account_id', accountId.toString());
    return api.post('/auth/snoop/import/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
};

// Finance API
export const financeApi = {
  // Dashboard
  getDashboard: () => api.get('/dashboard/'),
  getMonthlySummary: () => api.get('/monthly-summary/'),
  getExpenseByCategory: () => api.get('/expense-by-category/'),

  // Monthly Trends & Notes
  getMonthlyTrends: (months?: number) =>
    api.get('/monthly-trends/', { params: { months } }),
  saveMonthlyNote: (data: {
    year: number;
    month: number;
    note: string;
    income_target?: number;
    expense_target?: number;
    savings_target?: number;
  }) => api.post('/save-monthly-note/', data),
  getMonthlyNotes: () => api.get('/monthly-notes/'),

  // Budget Overview
  getBudgetOverview: () => api.get('/budget-overview/'),

  // Accounts
  getAccounts: () => api.get('/accounts/'),
  createAccount: (data: { name: string; type: string; balance: number; currency?: string }) =>
    api.post('/accounts/', data),
  updateAccount: (id: number, data: Partial<{ name: string; balance: number; is_active: boolean }>) =>
    api.patch(`/accounts/${id}/`, data),
  deleteAccount: (id: number) => api.delete(`/accounts/${id}/`),

  // Categories
  getCategories: () => api.get('/categories/'),
  createCategory: (data: { name: string; type: string; color?: string }) =>
    api.post('/categories/', data),

  // Transactions
  getTransactions: (params?: {
    start_date?: string;
    end_date?: string;
    type?: string;
    category?: number;
    account?: number;
    limit?: number;
    offset?: number;
  }) => api.get('/transactions/', { params }),
  createTransaction: (data: {
    amount: number;
    type: string;
    description: string;
    category: number;
    account: number;
    date: string;
    notes?: string;
  }) => api.post('/transactions/', data),
  updateTransaction: (id: number, data: Partial<{
    amount: number;
    description: string;
    category: number;
    date: string;
    notes: string;
  }>) => api.patch(`/transactions/${id}/`, data),
  deleteTransaction: (id: number) => api.delete(`/transactions/${id}/`),

  // Recurring Transactions
  getRecurringTransactions: () => api.get('/recurring-transactions/'),
  createRecurringTransaction: (data: {
    name: string;
    amount: number;
    type: string;
    category: number;
    account: number;
    frequency: string;
    start_date: string;
    next_date: string;
    end_date?: string;
  }) => api.post('/recurring-transactions/', data),
  updateRecurringTransaction: (id: number, data: Partial<{
    amount: number;
    is_active: boolean;
    next_date: string;
  }>) => api.patch(`/recurring-transactions/${id}/`, data),
  deleteRecurringTransaction: (id: number) => api.delete(`/recurring-transactions/${id}/`),

  // Budgets
  getBudgets: () => api.get('/budgets/'),
  createBudget: (data: {
    name: string;
    amount: number;
    category: number;
    period: string;
    start_date: string;
  }) => api.post('/budgets/', data),
  updateBudget: (id: number, data: Partial<{ amount: number; is_active: boolean }>) =>
    api.patch(`/budgets/${id}/`, data),
  deleteBudget: (id: number) => api.delete(`/budgets/${id}/`),

  // Investments
  getInvestments: () => api.get('/investments/'),
  createInvestment: (data: {
    name: string;
    symbol?: string;
    type: string;
    quantity: number;
    purchase_price: number;
    current_price?: number;
    purchase_date: string;
  }) => api.post('/investments/', data),
  updateInvestment: (id: number, data: Partial<{ current_price: number; notes: string }>) =>
    api.patch(`/investments/${id}/`, data),
  deleteInvestment: (id: number) => api.delete(`/investments/${id}/`),

  // Savings Goals
  getSavingsGoals: () => api.get('/savings-goals/'),
  createSavingsGoal: (data: {
    name: string;
    target_amount: number;
    current_amount?: number;
    target_date?: string;
  }) => api.post('/savings-goals/', data),
  updateSavingsGoal: (id: number, data: Partial<{
    current_amount: number;
    is_completed: boolean;
  }>) => api.patch(`/savings-goals/${id}/`, data),
  deleteSavingsGoal: (id: number) => api.delete(`/savings-goals/${id}/`),

  // House Budget
  getHouseBudgets: () => api.get('/house-budgets/'),
  getHouseBudget: (id: number) => api.get(`/house-budgets/${id}/`),
  createHouseBudget: (data: {
    name: string;
    month?: number;
    year?: number;
    is_template?: boolean;
    primary_salary: number;
    secondary_income?: number;
    other_income?: number;
    partner_name?: string;
    partner_contribution?: number;
  }) => api.post('/house-budgets/', data),
  updateHouseBudget: (id: number, data: Partial<{
    name: string;
    primary_salary: number;
    secondary_income: number;
    other_income: number;
    partner_name: string;
    partner_contribution: number;
  }>) => api.patch(`/house-budgets/${id}/`, data),
  deleteHouseBudget: (id: number) => api.delete(`/house-budgets/${id}/`),
  createDefaultHouseBudget: () => api.post('/house-budget/create-default/'),
  duplicateHouseBudget: (id: number, data: { month: number; year: number; name?: string }) =>
    api.post(`/house-budgets/${id}/duplicate/`, data),

  // Budget Line Items
  createBudgetLineItem: (data: {
    budget: number;
    name: string;
    amount: number;
    category_type: string;
    split_type?: string;
    primary_share_percent?: number;
    group?: string;
    notes?: string;
  }) => api.post('/budget-line-items/', data),
  updateBudgetLineItem: (id: number, data: Partial<{
    name: string;
    amount: number;
    category_type: string;
    split_type: string;
    primary_share_percent: number;
    group: string;
    notes: string;
  }>) => api.patch(`/budget-line-items/${id}/`, data),
  deleteBudgetLineItem: (id: number) => api.delete(`/budget-line-items/${id}/`),
};
