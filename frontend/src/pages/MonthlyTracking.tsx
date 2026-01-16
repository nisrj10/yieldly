import { useEffect, useState } from 'react';
import { financeApi } from '../api/client';
import { formatCurrency } from '../utils/format';
import {
  ShoppingCart,
  Utensils,
  Car,
  Dumbbell,
  ShoppingBag,
  TrendingUp,
  TrendingDown,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts';

interface CategoryData {
  total: number;
  count: number;
  budget: number;
  variance: number;
}

interface MonthData {
  year: number;
  month: number;
  month_name: string;
  categories: {
    Groceries: CategoryData;
    'Eating Out': CategoryData;
    Transport: CategoryData;
    'Health & Fitness': CategoryData;
    Shopping: CategoryData;
  };
}

const CATEGORY_CONFIG = {
  Groceries: { icon: ShoppingCart, color: '#22c55e', bgColor: 'bg-green-100', textColor: 'text-green-600' },
  'Eating Out': { icon: Utensils, color: '#f97316', bgColor: 'bg-orange-100', textColor: 'text-orange-600' },
  Transport: { icon: Car, color: '#3b82f6', bgColor: 'bg-blue-100', textColor: 'text-blue-600' },
  'Health & Fitness': { icon: Dumbbell, color: '#8b5cf6', bgColor: 'bg-purple-100', textColor: 'text-purple-600' },
  Shopping: { icon: ShoppingBag, color: '#ec4899', bgColor: 'bg-pink-100', textColor: 'text-pink-600' },
};

export default function MonthlyTracking() {
  const [data, setData] = useState<MonthData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(0);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const res = await financeApi.getCategorySpending(6);
      setData(res.data);
    } catch (error) {
      console.error('Error loading category spending:', error);
    } finally {
      setLoading(false);
    }
  };

  const currentMonth = data[selectedMonthIndex];

  // Prepare chart data for comparison
  const chartData = currentMonth
    ? Object.entries(currentMonth.categories).map(([name, cat]) => ({
        name: name === 'Health & Fitness' ? 'Health' : name,
        actual: cat.total,
        budget: cat.budget,
      }))
    : [];

  // Calculate totals for selected month
  const monthTotal = currentMonth
    ? Object.values(currentMonth.categories).reduce((sum, cat) => sum + cat.total, 0)
    : 0;
  const monthBudget = currentMonth
    ? Object.values(currentMonth.categories).reduce((sum, cat) => sum + cat.budget, 0)
    : 0;

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
        <p className="text-gray-600">Track your spending against budget by category</p>
      </div>

      {/* Month Selector */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={() => setSelectedMonthIndex((i) => Math.min(i + 1, data.length - 1))}
          disabled={selectedMonthIndex >= data.length - 1}
          className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30"
        >
          <ChevronLeft size={24} />
        </button>
        <div className="text-center min-w-[200px]">
          <h2 className="text-xl font-bold text-gray-900">
            {currentMonth?.month_name} {currentMonth?.year}
          </h2>
        </div>
        <button
          onClick={() => setSelectedMonthIndex((i) => Math.max(i - 1, 0))}
          disabled={selectedMonthIndex <= 0}
          className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30"
        >
          <ChevronRight size={24} />
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card">
          <p className="text-sm text-gray-600">Total Spent (Categories)</p>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(monthTotal)}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-600">Total Budget</p>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(monthBudget)}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-600">Variance</p>
          <div className={`flex items-center gap-2 ${monthBudget - monthTotal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {monthBudget - monthTotal >= 0 ? <TrendingDown size={20} /> : <TrendingUp size={20} />}
            <p className="text-2xl font-bold">{formatCurrency(Math.abs(monthBudget - monthTotal))}</p>
            <span className="text-sm">{monthBudget - monthTotal >= 0 ? 'under' : 'over'}</span>
          </div>
        </div>
      </div>

      {/* Category Cards */}
      {currentMonth && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(currentMonth.categories).map(([name, cat]) => {
            const config = CATEGORY_CONFIG[name as keyof typeof CATEGORY_CONFIG];
            const Icon = config.icon;
            const percentUsed = cat.budget > 0 ? (cat.total / cat.budget) * 100 : 0;
            const isOverBudget = cat.total > cat.budget;

            return (
              <div key={name} className="card">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg ${config.bgColor} flex items-center justify-center`}>
                      <Icon className={config.textColor} size={20} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{name}</h3>
                      <p className="text-xs text-gray-500">{cat.count} transactions</p>
                    </div>
                  </div>
                  {isOverBudget ? (
                    <AlertCircle className="text-red-500" size={20} />
                  ) : (
                    <CheckCircle className="text-green-500" size={20} />
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Spent</span>
                    <span className="font-medium">{formatCurrency(cat.total)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Budget</span>
                    <span className="font-medium">{formatCurrency(cat.budget)}</span>
                  </div>

                  {/* Progress Bar */}
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${isOverBudget ? 'bg-red-500' : 'bg-green-500'}`}
                      style={{ width: `${Math.min(percentUsed, 100)}%` }}
                    />
                  </div>

                  <div className="flex justify-between text-xs">
                    <span className={isOverBudget ? 'text-red-600 font-medium' : 'text-green-600 font-medium'}>
                      {isOverBudget ? `£${Math.abs(cat.variance).toFixed(0)} over` : `£${cat.variance.toFixed(0)} left`}
                    </span>
                    <span className="text-gray-500">{percentUsed.toFixed(0)}%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Budget vs Actual Chart */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Budget vs Actual</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(v) => `£${v}`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={80} />
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              <Legend />
              <Bar dataKey="actual" name="Actual" fill="#6366f1" radius={[0, 4, 4, 0]}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.actual > entry.budget ? '#ef4444' : '#22c55e'}
                  />
                ))}
              </Bar>
              <Bar dataKey="budget" name="Budget" fill="#e5e7eb" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Monthly Trend Table */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly History</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-medium text-gray-600">Month</th>
                {Object.keys(CATEGORY_CONFIG).map((cat) => (
                  <th key={cat} className="text-right py-3 px-4 font-medium text-gray-600">
                    {cat === 'Health & Fitness' ? 'Health' : cat}
                  </th>
                ))}
                <th className="text-right py-3 px-4 font-medium text-gray-600">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.map((month, idx) => {
                const total = Object.values(month.categories).reduce((sum, cat) => sum + cat.total, 0);
                return (
                  <tr
                    key={`${month.year}-${month.month}`}
                    className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${idx === selectedMonthIndex ? 'bg-primary-50' : ''}`}
                    onClick={() => setSelectedMonthIndex(idx)}
                  >
                    <td className="py-3 px-4">
                      <span className="font-medium text-gray-900">
                        {month.month_name.slice(0, 3)} {month.year}
                      </span>
                    </td>
                    {Object.entries(month.categories).map(([name, cat]) => {
                      const isOver = cat.total > cat.budget;
                      return (
                        <td key={name} className="py-3 px-4 text-right">
                          <span className={isOver ? 'text-red-600 font-medium' : 'text-gray-900'}>
                            {formatCurrency(cat.total)}
                          </span>
                        </td>
                      );
                    })}
                    <td className="py-3 px-4 text-right font-medium text-gray-900">
                      {formatCurrency(total)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
