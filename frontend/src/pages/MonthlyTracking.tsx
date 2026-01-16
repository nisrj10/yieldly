import { useEffect, useState } from 'react';
import { financeApi } from '../api/client';
import type { MonthlyTrend } from '../types';
import { formatCurrency } from '../utils/format';
import {
  TrendingUp,
  TrendingDown,
  MessageSquare,
  Target,
  ChevronLeft,
  ChevronRight,
  Save,
  X,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  AreaChart,
  Area,
} from 'recharts';

export default function MonthlyTracking() {
  const [trends, setTrends] = useState<MonthlyTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<MonthlyTrend | null>(null);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteForm, setNoteForm] = useState({
    note: '',
    income_target: '',
    expense_target: '',
    savings_target: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const res = await financeApi.getMonthlyTrends(12);
      setTrends(res.data);
    } catch (error) {
      console.error('Error loading trends:', error);
    } finally {
      setLoading(false);
    }
  };

  const openNoteModal = (month: MonthlyTrend) => {
    setSelectedMonth(month);
    setNoteForm({
      note: month.note || '',
      income_target: month.income_target?.toString() || '',
      expense_target: month.expense_target?.toString() || '',
      savings_target: month.savings_target?.toString() || '',
    });
    setShowNoteModal(true);
  };

  const handleSaveNote = async () => {
    if (!selectedMonth) return;
    setSaving(true);
    try {
      await financeApi.saveMonthlyNote({
        year: selectedMonth.year,
        month: selectedMonth.month,
        note: noteForm.note,
        income_target: noteForm.income_target ? parseFloat(noteForm.income_target) : undefined,
        expense_target: noteForm.expense_target ? parseFloat(noteForm.expense_target) : undefined,
        savings_target: noteForm.savings_target ? parseFloat(noteForm.savings_target) : undefined,
      });
      setShowNoteModal(false);
      loadData();
    } catch (error) {
      console.error('Error saving note:', error);
    } finally {
      setSaving(false);
    }
  };

  // Prepare chart data (reverse to show oldest first)
  const chartData = [...trends].reverse().map((t) => ({
    name: `${t.month_name.slice(0, 3)} ${t.year}`,
    income: Number(t.income),
    expenses: Number(t.expenses),
    savings: Number(t.savings),
    savingsRate: t.savings_rate,
  }));

  // Calculate averages
  const avgIncome = trends.reduce((sum, t) => sum + Number(t.income), 0) / (trends.length || 1);
  const avgExpenses = trends.reduce((sum, t) => sum + Number(t.expenses), 0) / (trends.length || 1);
  const avgSavings = trends.reduce((sum, t) => sum + Number(t.savings), 0) / (trends.length || 1);
  const avgSavingsRate = trends.reduce((sum, t) => sum + t.savings_rate, 0) / (trends.length || 1);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Monthly Tracking</h1>
        <p className="text-gray-600">Track your financial progress over time with notes and targets</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card">
          <p className="text-sm text-gray-600">Avg Monthly Income</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(avgIncome)}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-600">Avg Monthly Expenses</p>
          <p className="text-2xl font-bold text-red-600">{formatCurrency(avgExpenses)}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-600">Avg Monthly Savings</p>
          <p className="text-2xl font-bold text-blue-600">{formatCurrency(avgSavings)}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-600">Avg Savings Rate</p>
          <p className="text-2xl font-bold text-purple-600">{avgSavingsRate.toFixed(1)}%</p>
        </div>
      </div>

      {/* Income vs Expenses Chart */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Income vs Expenses Trend</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `£${v / 1000}k`} />
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              <Legend />
              <Area type="monotone" dataKey="income" stroke="#22c55e" fill="#22c55e" fillOpacity={0.3} name="Income" />
              <Area type="monotone" dataKey="expenses" stroke="#ef4444" fill="#ef4444" fillOpacity={0.3} name="Expenses" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Savings Rate Chart */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Savings Rate Trend</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}%`} domain={[0, 'auto']} />
              <Tooltip formatter={(value) => `${Number(value).toFixed(1)}%`} />
              <Line
                type="monotone"
                dataKey="savingsRate"
                stroke="#6366f1"
                strokeWidth={2}
                dot={{ fill: '#6366f1' }}
                name="Savings Rate"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Monthly Details Table */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Details</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-medium text-gray-600">Month</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">Income</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">Expenses</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">Savings</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">Rate</th>
                <th className="text-center py-3 px-4 font-medium text-gray-600">Note</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {trends.map((month) => (
                <tr key={`${month.year}-${month.month}`} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-4 px-4">
                    <span className="font-medium text-gray-900">
                      {month.month_name} {month.year}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <div className="flex items-center justify-end gap-1 text-green-600">
                      <TrendingUp size={16} />
                      {formatCurrency(month.income)}
                    </div>
                    {month.income_target && (
                      <div className="text-xs text-gray-500">
                        Target: {formatCurrency(month.income_target)}
                      </div>
                    )}
                  </td>
                  <td className="py-4 px-4 text-right">
                    <div className="flex items-center justify-end gap-1 text-red-600">
                      <TrendingDown size={16} />
                      {formatCurrency(month.expenses)}
                    </div>
                    {month.expense_target && (
                      <div className="text-xs text-gray-500">
                        Target: {formatCurrency(month.expense_target)}
                      </div>
                    )}
                  </td>
                  <td className="py-4 px-4 text-right">
                    <span className={Number(month.savings) >= 0 ? 'text-blue-600' : 'text-red-600'}>
                      {formatCurrency(month.savings)}
                    </span>
                    {month.savings_target && (
                      <div className="text-xs text-gray-500">
                        Target: {formatCurrency(month.savings_target)}
                      </div>
                    )}
                  </td>
                  <td className="py-4 px-4 text-right">
                    <span className={`font-medium ${month.savings_rate >= 20 ? 'text-green-600' : month.savings_rate >= 10 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {month.savings_rate.toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-4 px-4 text-center">
                    {month.note ? (
                      <div className="group relative">
                        <MessageSquare size={18} className="text-primary-600 mx-auto cursor-pointer" />
                        <div className="absolute z-10 hidden group-hover:block w-64 p-3 bg-white border border-gray-200 rounded-lg shadow-lg -left-28 top-6">
                          <p className="text-sm text-gray-700">{month.note}</p>
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                  <td className="py-4 px-4 text-right">
                    <button
                      onClick={() => openNoteModal(month)}
                      className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Note Modal */}
      {showNoteModal && selectedMonth && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">
                  {selectedMonth.month_name} {selectedMonth.year}
                </h2>
                <button onClick={() => setShowNoteModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="label">Monthly Note</label>
                  <textarea
                    value={noteForm.note}
                    onChange={(e) => setNoteForm((p) => ({ ...p, note: e.target.value }))}
                    className="input min-h-[100px]"
                    placeholder="Add notes about this month (e.g., 'Big vacation expense', 'Got a bonus')..."
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="label text-xs">Income Target</label>
                    <input
                      type="number"
                      step="0.01"
                      value={noteForm.income_target}
                      onChange={(e) => setNoteForm((p) => ({ ...p, income_target: e.target.value }))}
                      className="input text-sm"
                      placeholder="7200"
                    />
                  </div>
                  <div>
                    <label className="label text-xs">Expense Target</label>
                    <input
                      type="number"
                      step="0.01"
                      value={noteForm.expense_target}
                      onChange={(e) => setNoteForm((p) => ({ ...p, expense_target: e.target.value }))}
                      className="input text-sm"
                      placeholder="4000"
                    />
                  </div>
                  <div>
                    <label className="label text-xs">Savings Target</label>
                    <input
                      type="number"
                      step="0.01"
                      value={noteForm.savings_target}
                      onChange={(e) => setNoteForm((p) => ({ ...p, savings_target: e.target.value }))}
                      className="input text-sm"
                      placeholder="2000"
                    />
                  </div>
                </div>

                {/* Current Stats */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-2">Actual This Month</h4>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <span className="text-gray-500">Income:</span>
                      <span className="ml-1 font-medium text-green-600">
                        {formatCurrency(selectedMonth.income)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Expenses:</span>
                      <span className="ml-1 font-medium text-red-600">
                        {formatCurrency(selectedMonth.expenses)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Savings:</span>
                      <span className="ml-1 font-medium text-blue-600">
                        {formatCurrency(selectedMonth.savings)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowNoteModal(false)}
                    className="flex-1 btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveNote}
                    disabled={saving}
                    className="flex-1 btn-primary flex items-center justify-center gap-2"
                  >
                    <Save size={18} />
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
