import { useEffect, useState } from 'react';
import { financeApi } from '../api/client';
import type { Budget, Category, BudgetOverview } from '../types';
import { formatCurrency } from '../utils/format';
import { Plus, X, AlertTriangle, CheckCircle, PieChart, Edit2 } from 'lucide-react';
import {
  PieChart as RechartsPie,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

export default function Budgets() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [overview, setOverview] = useState<BudgetOverview | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    category: '',
    period: 'monthly',
    start_date: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [budgetRes, catRes, overviewRes] = await Promise.all([
        financeApi.getBudgets(),
        financeApi.getCategories(),
        financeApi.getBudgetOverview(),
      ]);
      setBudgets(budgetRes.data);
      setCategories(catRes.data.filter((c: Category) => c.type === 'expense'));
      setOverview(overviewRes.data);
    } catch (error) {
      console.error('Error loading budgets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingBudget) {
        await financeApi.updateBudget(editingBudget.id, {
          amount: parseFloat(formData.amount),
        });
      } else {
        await financeApi.createBudget({
          name: formData.name,
          amount: parseFloat(formData.amount),
          category: parseInt(formData.category),
          period: formData.period,
          start_date: formData.start_date,
        });
      }
      closeModal();
      loadData();
    } catch (error) {
      console.error('Error saving budget:', error);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this budget?')) {
      try {
        await financeApi.deleteBudget(id);
        loadData();
      } catch (error) {
        console.error('Error deleting budget:', error);
      }
    }
  };

  const openEditModal = (budget: Budget) => {
    setEditingBudget(budget);
    setFormData({
      name: budget.name,
      amount: String(budget.amount),
      category: String(budget.category),
      period: budget.period,
      start_date: budget.start_date,
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingBudget(null);
    setFormData({
      name: '',
      amount: '',
      category: '',
      period: 'monthly',
      start_date: new Date().toISOString().split('T')[0],
    });
  };

  // Prepare pie chart data
  const pieData = overview?.budgets.map((b) => ({
    name: b.category,
    value: b.spent,
    color: b.category_color,
  })) || [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Budgets</h1>
          <p className="text-gray-600">Set spending limits and track your progress</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
          <Plus size={20} />
          Create Budget
        </button>
      </div>

      {/* Overview Summary */}
      {overview && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Total Budget Card */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Budget Overview</h3>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Budgeted</span>
                <span className="font-semibold">{formatCurrency(overview.total_budgeted)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total Spent</span>
                <span className="font-semibold text-red-600">{formatCurrency(overview.total_spent)}</span>
              </div>
              <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    overview.percent_used > 100 ? 'bg-red-500' : overview.percent_used > 80 ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(overview.percent_used, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-sm">
                <span className={overview.remaining >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {overview.remaining >= 0 ? `${formatCurrency(overview.remaining)} remaining` : `${formatCurrency(Math.abs(overview.remaining))} over budget`}
                </span>
                <span className="text-gray-500">{overview.percent_used.toFixed(0)}% used</span>
              </div>
            </div>
          </div>

          {/* Spending by Category Pie Chart */}
          <div className="card lg:col-span-2">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Spending by Category</h3>
            {pieData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPie>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={index} fill={entry.color || `hsl(${index * 45}, 70%, 50%)`} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  </RechartsPie>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-500">
                No spending data this month
              </div>
            )}
          </div>
        </div>
      )}

      {/* Budget Cards */}
      {budgets.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {budgets.map((budget) => {
            const percentSpent = (budget.spent / budget.amount) * 100;
            const isOverBudget = percentSpent > 100;
            const isWarning = percentSpent > 80 && !isOverBudget;

            return (
              <div key={budget.id} className="card">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-gray-900">{budget.name}</h3>
                    <p className="text-sm text-gray-500">{budget.category_name} • {budget.period}</p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEditModal(budget)}
                      className="p-1 text-gray-400 hover:text-primary-600 transition-colors"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(budget.id)}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Spent</span>
                    <span className={`font-medium ${isOverBudget ? 'text-red-600' : 'text-gray-900'}`}>
                      {formatCurrency(budget.spent)} / {formatCurrency(budget.amount)}
                    </span>
                  </div>

                  <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        isOverBudget ? 'bg-red-500' : isWarning ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(percentSpent, 100)}%` }}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    {isOverBudget ? (
                      <>
                        <AlertTriangle size={16} className="text-red-500" />
                        <span className="text-sm text-red-600">
                          Over budget by {formatCurrency(Math.abs(budget.remaining))}
                        </span>
                      </>
                    ) : isWarning ? (
                      <>
                        <AlertTriangle size={16} className="text-yellow-500" />
                        <span className="text-sm text-yellow-600">
                          {formatCurrency(budget.remaining)} remaining
                        </span>
                      </>
                    ) : (
                      <>
                        <CheckCircle size={16} className="text-green-500" />
                        <span className="text-sm text-green-600">
                          {formatCurrency(budget.remaining)} remaining
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card text-center py-12">
          <PieChart className="mx-auto text-gray-400 mb-4" size={48} />
          <p className="text-gray-500 mb-4">No budgets created yet</p>
          <button onClick={() => setShowModal(true)} className="btn-primary">
            Create your first budget
          </button>
        </div>
      )}

      {/* Unbudgeted Spending */}
      {overview && overview.unbudgeted_spending.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Unbudgeted Spending</h3>
          <p className="text-sm text-gray-500 mb-4">
            These categories have spending but no budget set. Consider creating budgets for better tracking.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {overview.unbudgeted_spending.map((cat, idx) => (
              <div key={idx} className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: cat.category_color }}
                />
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{cat.category}</p>
                  <p className="text-sm text-yellow-700">{formatCurrency(cat.spent)} spent</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create/Edit Budget Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">{editingBudget ? 'Edit Budget' : 'Create Budget'}</h2>
                <button onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {!editingBudget && (
                  <>
                    <div>
                      <label className="label">Budget Name</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                        className="input"
                        placeholder="e.g., Groceries Budget"
                        required
                      />
                    </div>

                    <div>
                      <label className="label">Category</label>
                      <select
                        value={formData.category}
                        onChange={(e) => setFormData((p) => ({ ...p, category: e.target.value }))}
                        className="input"
                        required
                      >
                        <option value="">Select category</option>
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="label">Period</label>
                      <select
                        value={formData.period}
                        onChange={(e) => setFormData((p) => ({ ...p, period: e.target.value }))}
                        className="input"
                      >
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="yearly">Yearly</option>
                      </select>
                    </div>

                    <div>
                      <label className="label">Start Date</label>
                      <input
                        type="date"
                        value={formData.start_date}
                        onChange={(e) => setFormData((p) => ({ ...p, start_date: e.target.value }))}
                        className="input"
                        required
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="label">Budget Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData((p) => ({ ...p, amount: e.target.value }))}
                    className="input"
                    placeholder="0.00"
                    required
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={closeModal} className="flex-1 btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" className="flex-1 btn-primary">
                    {editingBudget ? 'Update Budget' : 'Create Budget'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
