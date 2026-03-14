import { useEffect, useMemo, useState } from 'react';
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
  X,
  Eye,
  EyeOff,
  Home,
  Zap,
  Wifi,
  Heart,
  Gift,
  Music,
  Plane,
  Baby,
  PawPrint,
  Briefcase,
  GraduationCap,
  Scissors,
  Shirt,
  Tv,
  Phone,
  CreditCard,
  Tag,
  type LucideIcon,
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

interface TransactionData {
  id: number;
  description: string;
  amount: number;
  date: string;
  excluded: boolean;
}

interface CategoryData {
  total: number;
  count: number;
  budget: number;
  variance: number;
  transactions?: TransactionData[];
}

interface MonthData {
  year: number;
  month: number;
  month_name: string;
  categories: Record<string, CategoryData>;
}

// Map known category names to icons and colors, with a fallback
const ICON_MAP: Record<string, { icon: LucideIcon; color: string; bgColor: string; textColor: string }> = {
  'Groceries':        { icon: ShoppingCart, color: '#22c55e', bgColor: 'bg-green-100', textColor: 'text-green-600' },
  'Eating Out':       { icon: Utensils, color: '#f97316', bgColor: 'bg-orange-100', textColor: 'text-orange-600' },
  'Transport':        { icon: Car, color: '#3b82f6', bgColor: 'bg-blue-100', textColor: 'text-blue-600' },
  'Health & Fitness': { icon: Dumbbell, color: '#8b5cf6', bgColor: 'bg-purple-100', textColor: 'text-purple-600' },
  'Shopping':         { icon: ShoppingBag, color: '#ec4899', bgColor: 'bg-pink-100', textColor: 'text-pink-600' },
  'Housing':          { icon: Home, color: '#0ea5e9', bgColor: 'bg-sky-100', textColor: 'text-sky-600' },
  'Utilities':        { icon: Zap, color: '#eab308', bgColor: 'bg-yellow-100', textColor: 'text-yellow-600' },
  'Internet':         { icon: Wifi, color: '#06b6d4', bgColor: 'bg-cyan-100', textColor: 'text-cyan-600' },
  'Insurance':        { icon: Heart, color: '#f43f5e', bgColor: 'bg-rose-100', textColor: 'text-rose-600' },
  'Gifts':            { icon: Gift, color: '#a855f7', bgColor: 'bg-violet-100', textColor: 'text-violet-600' },
  'Entertainment':    { icon: Music, color: '#d946ef', bgColor: 'bg-fuchsia-100', textColor: 'text-fuchsia-600' },
  'Travel':           { icon: Plane, color: '#14b8a6', bgColor: 'bg-teal-100', textColor: 'text-teal-600' },
  'Childcare':        { icon: Baby, color: '#f59e0b', bgColor: 'bg-amber-100', textColor: 'text-amber-600' },
  'Children':         { icon: Baby, color: '#f59e0b', bgColor: 'bg-amber-100', textColor: 'text-amber-600' },
  'Pets':             { icon: PawPrint, color: '#84cc16', bgColor: 'bg-lime-100', textColor: 'text-lime-600' },
  'Work':             { icon: Briefcase, color: '#64748b', bgColor: 'bg-slate-100', textColor: 'text-slate-600' },
  'Education':        { icon: GraduationCap, color: '#6366f1', bgColor: 'bg-indigo-100', textColor: 'text-indigo-600' },
  'Personal Care':    { icon: Scissors, color: '#fb923c', bgColor: 'bg-orange-100', textColor: 'text-orange-600' },
  'Clothing':         { icon: Shirt, color: '#e879f9', bgColor: 'bg-fuchsia-100', textColor: 'text-fuchsia-600' },
  'Subscriptions':    { icon: Tv, color: '#818cf8', bgColor: 'bg-indigo-100', textColor: 'text-indigo-600' },
  'Phone':            { icon: Phone, color: '#2dd4bf', bgColor: 'bg-teal-100', textColor: 'text-teal-600' },
  'Bills':            { icon: CreditCard, color: '#fb7185', bgColor: 'bg-rose-100', textColor: 'text-rose-600' },
};

const FALLBACK_COLORS = [
  { color: '#6366f1', bgColor: 'bg-indigo-100', textColor: 'text-indigo-600' },
  { color: '#10b981', bgColor: 'bg-emerald-100', textColor: 'text-emerald-600' },
  { color: '#f59e0b', bgColor: 'bg-amber-100', textColor: 'text-amber-600' },
  { color: '#ef4444', bgColor: 'bg-red-100', textColor: 'text-red-600' },
  { color: '#8b5cf6', bgColor: 'bg-violet-100', textColor: 'text-violet-600' },
  { color: '#06b6d4', bgColor: 'bg-cyan-100', textColor: 'text-cyan-600' },
];

function getCategoryConfig(name: string, index: number) {
  if (ICON_MAP[name]) return ICON_MAP[name];
  const fallback = FALLBACK_COLORS[index % FALLBACK_COLORS.length];
  return { icon: Tag, ...fallback };
}

export default function MonthlyTracking() {
  const [data, setData] = useState<MonthData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<MonthData | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const res = await financeApi.getCategorySpending(24, false);
      setData(res.data);
    } catch (error) {
      console.error('Error loading category spending:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDetailData = async (monthIndex: number) => {
    setLoadingDetail(true);
    try {
      const month = data[monthIndex];
      const res = await financeApi.getCategorySpending(24, true);
      const monthData = res.data.find(
        (m: MonthData) => m.year === month.year && m.month === month.month
      );
      setDetailData(monthData || null);
    } catch (error) {
      console.error('Error loading transaction details:', error);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleCategoryClick = async (categoryName: string) => {
    setSelectedCategory(categoryName);
    if (!detailData || detailData.year !== data[selectedMonthIndex].year || detailData.month !== data[selectedMonthIndex].month) {
      await loadDetailData(selectedMonthIndex);
    }
  };

  const handleToggleExclusion = async (transactionId: number, category: string) => {
    try {
      await financeApi.toggleCategoryExclusion(transactionId, category);
      await loadData();
      await loadDetailData(selectedMonthIndex);
    } catch (error) {
      console.error('Error toggling exclusion:', error);
    }
  };

  const currentMonth = data[selectedMonthIndex];

  // Collect all category names across all months for consistent ordering
  const allCategoryNames = useMemo(() => {
    const names = new Set<string>();
    data.forEach((m) => Object.keys(m.categories).forEach((c) => names.add(c)));
    return Array.from(names).sort();
  }, [data]);

  // Prepare chart data
  const chartData = currentMonth
    ? Object.entries(currentMonth.categories)
        .filter(([, cat]) => cat.total > 0 || cat.budget > 0)
        .map(([name, cat]) => ({
          name: name.length > 12 ? name.slice(0, 11) + '…' : name,
          actual: cat.total,
          budget: cat.budget,
        }))
    : [];

  const monthTotal = currentMonth
    ? Object.values(currentMonth.categories).reduce((sum, cat) => sum + cat.total, 0)
    : 0;
  const monthBudget = currentMonth
    ? Object.values(currentMonth.categories).reduce((sum, cat) => sum + cat.budget, 0)
    : 0;

  const selectedTransactions = selectedCategory && detailData
    ? detailData.categories[selectedCategory]?.transactions || []
    : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const selectedConfig = selectedCategory ? getCategoryConfig(selectedCategory, allCategoryNames.indexOf(selectedCategory)) : null;

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
          {Object.entries(currentMonth.categories).map(([name, cat], idx) => {
            const config = getCategoryConfig(name, allCategoryNames.indexOf(name) ?? idx);
            const Icon = config.icon;
            const percentUsed = cat.budget > 0 ? (cat.total / cat.budget) * 100 : (cat.total > 0 ? 100 : 0);
            const isOverBudget = cat.budget > 0 ? cat.total > cat.budget : false;

            return (
              <div
                key={name}
                className="card cursor-pointer hover:shadow-md hover:border-gray-300 transition-all"
                onClick={() => handleCategoryClick(name)}
              >
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
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">Click to view</span>
                    {cat.budget > 0 && (
                      isOverBudget ? (
                        <AlertCircle className="text-red-500" size={20} />
                      ) : (
                        <CheckCircle className="text-green-500" size={20} />
                      )
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Spent</span>
                    <span className="font-medium">{formatCurrency(cat.total)}</span>
                  </div>
                  {cat.budget > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Budget</span>
                      <span className="font-medium">{formatCurrency(cat.budget)}</span>
                    </div>
                  )}

                  {/* Progress Bar */}
                  {cat.budget > 0 && (
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${isOverBudget ? 'bg-red-500' : 'bg-green-500'}`}
                        style={{ width: `${Math.min(percentUsed, 100)}%` }}
                      />
                    </div>
                  )}

                  <div className="flex justify-between text-xs">
                    {cat.budget > 0 ? (
                      <>
                        <span className={isOverBudget ? 'text-red-600 font-medium' : 'text-green-600 font-medium'}>
                          {isOverBudget ? `£${Math.abs(cat.variance).toFixed(0)} over` : `£${cat.variance.toFixed(0)} left`}
                        </span>
                        <span className="text-gray-500">{percentUsed.toFixed(0)}%</span>
                      </>
                    ) : (
                      <span className="text-gray-400">No budget set</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Budget vs Actual Chart */}
      {chartData.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Budget vs Actual</h3>
          <div style={{ height: Math.max(280, chartData.length * 40) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(v) => `£${v}`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={100} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Legend />
                <Bar dataKey="actual" name="Actual" fill="#6366f1" radius={[0, 4, 4, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.actual > entry.budget && entry.budget > 0 ? '#ef4444' : '#22c55e'}
                    />
                  ))}
                </Bar>
                <Bar dataKey="budget" name="Budget" fill="#e5e7eb" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Monthly Trend Table */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly History</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-medium text-gray-600 sticky left-0 bg-white z-10">Month</th>
                {allCategoryNames.map((cat) => (
                  <th key={cat} className="text-right py-3 px-4 font-medium text-gray-600 whitespace-nowrap">
                    {cat.length > 12 ? cat.slice(0, 11) + '…' : cat}
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
                    <td className="py-3 px-4 sticky left-0 bg-inherit z-10">
                      <span className="font-medium text-gray-900">
                        {month.month_name.slice(0, 3)} {month.year}
                      </span>
                    </td>
                    {allCategoryNames.map((name) => {
                      const cat = month.categories[name];
                      if (!cat) return <td key={name} className="py-3 px-4 text-right text-gray-300">-</td>;
                      const isOver = cat.budget > 0 && cat.total > cat.budget;
                      return (
                        <td key={name} className="py-3 px-4 text-right whitespace-nowrap">
                          <span className={isOver ? 'text-red-600 font-medium' : 'text-gray-900'}>
                            {formatCurrency(cat.total)}
                          </span>
                        </td>
                      );
                    })}
                    <td className="py-3 px-4 text-right font-medium text-gray-900 whitespace-nowrap">
                      {formatCurrency(total)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transaction Details Modal */}
      {selectedCategory && selectedConfig && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg ${selectedConfig.bgColor} flex items-center justify-center`}>
                    <selectedConfig.icon className={selectedConfig.textColor} size={20} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{selectedCategory}</h2>
                    <p className="text-sm text-gray-500">
                      {currentMonth?.month_name} {currentMonth?.year}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedCategory(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {loadingDetail ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                </div>
              ) : selectedTransactions.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <p>No transactions found for this category</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm text-gray-500 px-3 py-2">
                    <span>Click the eye icon to exclude/include a transaction</span>
                    <span>{selectedTransactions.filter(t => !t.excluded).length} included</span>
                  </div>
                  {selectedTransactions.map((transaction) => (
                    <div
                      key={transaction.id}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        transaction.excluded
                          ? 'bg-gray-50 border-gray-200 opacity-60'
                          : 'bg-white border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className={`font-medium truncate ${transaction.excluded ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                          {transaction.description}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(transaction.date).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`font-semibold ${transaction.excluded ? 'text-gray-400' : 'text-gray-900'}`}>
                          {formatCurrency(transaction.amount)}
                        </span>
                        <button
                          onClick={() => handleToggleExclusion(transaction.id, selectedCategory)}
                          className={`p-2 rounded-lg transition-colors ${
                            transaction.excluded
                              ? 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                              : 'text-green-600 hover:text-red-600 hover:bg-red-50'
                          }`}
                          title={transaction.excluded ? 'Include in calculation' : 'Exclude from calculation'}
                        >
                          {transaction.excluded ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {detailData && selectedCategory && (
              <div className="p-4 border-t border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-700">Total (included only)</span>
                  <span className="text-xl font-bold text-gray-900">
                    {formatCurrency(
                      detailData.categories[selectedCategory]?.total || 0
                    )}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
