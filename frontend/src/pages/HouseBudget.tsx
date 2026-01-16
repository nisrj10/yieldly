import { useEffect, useState } from 'react';
import { financeApi } from '../api/client';
import { formatCurrency } from '../utils/format';
import {
  Home,
  Car,
  ShoppingCart,
  Tv,
  Users,
  Building,
  PiggyBank,
  User,
  Plus,
  Edit2,
  Trash2,
  X,
  Check,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Wallet,
  TrendingUp,
  ArrowRight,
} from 'lucide-react';

interface BudgetLineItem {
  id: number;
  name: string;
  amount: number;
  category_type: 'expense' | 'saving' | 'investment';
  split_type: 'shared' | 'personal_primary' | 'personal_partner';
  primary_share_percent: number;
  group: string;
  notes: string;
  order: number;
  primary_amount: number;
  partner_amount: number;
}

interface HouseBudget {
  id: number;
  name: string;
  month: number | null;
  year: number | null;
  is_template: boolean;
  primary_salary: number;
  secondary_income: number;
  other_income: number;
  partner_name: string;
  partner_contribution: number;
  total_income: number;
  line_items: BudgetLineItem[];
  total_expenses: number;
  total_savings: number;
  total_investments: number;
  primary_total: number;
  partner_total: number;
  remaining: number;
}

const groupIcons: Record<string, React.ReactNode> = {
  Housing: <Home size={18} />,
  Transport: <Car size={18} />,
  Living: <ShoppingCart size={18} />,
  Subscriptions: <Tv size={18} />,
  Family: <Users size={18} />,
  Property: <Building size={18} />,
  Savings: <PiggyBank size={18} />,
  Personal: <User size={18} />,
  Income: <Wallet size={18} />,
};

const groupColors: Record<string, string> = {
  Housing: 'bg-blue-500',
  Transport: 'bg-orange-500',
  Living: 'bg-green-500',
  Subscriptions: 'bg-purple-500',
  Family: 'bg-pink-500',
  Property: 'bg-yellow-500',
  Savings: 'bg-cyan-500',
  Personal: 'bg-indigo-500',
  Income: 'bg-emerald-500',
};

export default function HouseBudget() {
  const [budget, setBudget] = useState<HouseBudget | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<Partial<BudgetLineItem>>({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingIncome, setEditingIncome] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['Housing', 'Savings']));
  const [activeTab, setActiveTab] = useState<'overview' | 'details' | 'split'>('overview');

  const [newItem, setNewItem] = useState({
    name: '',
    amount: '',
    category_type: 'expense',
    split_type: 'shared',
    primary_share_percent: '50',
    group: 'Housing',
    notes: '',
  });

  useEffect(() => {
    loadBudget();
  }, []);

  const loadBudget = async () => {
    try {
      const response = await financeApi.getHouseBudgets();
      const budgets = response.data.results || response.data;

      if (budgets.length > 0) {
        const template = budgets.find((b: HouseBudget) => b.is_template) || budgets[0];
        const fullBudget = await financeApi.getHouseBudget(template.id);
        setBudget(fullBudget.data);
      } else {
        const newBudget = await financeApi.createDefaultHouseBudget();
        setBudget(newBudget.data);
      }
    } catch (error) {
      console.error('Error loading budget:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateItem = async (item: BudgetLineItem) => {
    try {
      await financeApi.updateBudgetLineItem(item.id, editValues);
      setEditingItem(null);
      setEditValues({});
      loadBudget();
    } catch (error) {
      console.error('Error updating item:', error);
    }
  };

  const handleDeleteItem = async (id: number) => {
    if (!confirm('Delete this budget item?')) return;
    try {
      await financeApi.deleteBudgetLineItem(id);
      loadBudget();
    } catch (error) {
      console.error('Error deleting item:', error);
    }
  };

  const handleAddItem = async () => {
    if (!budget || !newItem.name || !newItem.amount) return;
    try {
      await financeApi.createBudgetLineItem({
        budget: budget.id,
        name: newItem.name,
        amount: parseFloat(newItem.amount),
        category_type: newItem.category_type,
        split_type: newItem.split_type,
        primary_share_percent: parseFloat(newItem.primary_share_percent),
        group: newItem.group,
        notes: newItem.notes,
      });
      setShowAddModal(false);
      setNewItem({
        name: '',
        amount: '',
        category_type: 'expense',
        split_type: 'shared',
        primary_share_percent: '50',
        group: 'Housing',
        notes: '',
      });
      loadBudget();
    } catch (error) {
      console.error('Error adding item:', error);
    }
  };

  const handleUpdateIncome = async () => {
    if (!budget) return;
    try {
      await financeApi.updateHouseBudget(budget.id, {
        primary_salary: budget.primary_salary,
        secondary_income: budget.secondary_income,
        other_income: budget.other_income,
        partner_contribution: budget.partner_contribution,
        partner_name: budget.partner_name,
      });
      setEditingIncome(false);
      loadBudget();
    } catch (error) {
      console.error('Error updating income:', error);
    }
  };

  const toggleGroup = (group: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(group)) {
      newExpanded.delete(group);
    } else {
      newExpanded.add(group);
    }
    setExpandedGroups(newExpanded);
  };

  // Group items
  const groupedItems = budget?.line_items.reduce((acc, item) => {
    const group = item.group || 'Other';
    if (!acc[group]) acc[group] = [];
    acc[group].push(item);
    return acc;
  }, {} as Record<string, BudgetLineItem[]>) || {};

  // Calculate totals
  const expensesByGroup = Object.entries(groupedItems).map(([group, items]) => ({
    group,
    total: items.filter(i => i.category_type === 'expense').reduce((s, i) => s + Number(i.amount), 0),
    savings: items.filter(i => i.category_type === 'saving').reduce((s, i) => s + Number(i.amount), 0),
  })).filter(g => g.total > 0 || g.savings > 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!budget) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Failed to load budget</p>
      </div>
    );
  }

  const nishantSalary = Number(budget.primary_salary);
  // Calculate Krati's total contribution from her line items (personal_partner)
  const kratiContribution = budget.line_items
    .filter(item => item.split_type === 'personal_partner')
    .reduce((sum, item) => sum + Number(item.amount), 0);
  // Krati's cash contribution goes to household pot (Income group items)
  const kratiCashToHousehold = budget.line_items
    .filter(item => item.split_type === 'personal_partner' && item.group === 'Income')
    .reduce((sum, item) => sum + Number(item.amount), 0);
  const totalIncome = nishantSalary + kratiContribution;
  // Nishant's outgoing (items he pays for)
  const nishantOutgoing = budget.line_items
    .filter(item => item.split_type === 'personal_primary')
    .reduce((sum, item) => sum + Number(item.amount), 0);
  // Available pot = Nishant salary + Krati's cash contribution to household
  const availablePot = nishantSalary + kratiCashToHousehold;
  const remaining = availablePot - nishantOutgoing;
  // Calculate savings (only Nishant's savings, not Krati's direct payments)
  const nishantSavings = budget.line_items
    .filter(item => item.split_type === 'personal_primary' && item.category_type === 'saving')
    .reduce((sum, item) => sum + Number(item.amount), 0);
  const savingsRate = availablePot > 0 ? (nishantSavings / availablePot) * 100 : 0;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">House Budget</h1>
            <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded-full">
              v{budget.id}
            </span>
          </div>
          <p className="text-gray-600">Monthly household financial planning</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-2">
          <Plus size={20} />
          Add Item
        </button>
      </div>

      {/* Income Flow Visualization */}
      <div className="card bg-gradient-to-br from-slate-900 to-slate-800 text-white">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Wallet size={20} />
            Household Income
          </h2>
          {editingIncome ? (
            <div className="flex gap-2">
              <button onClick={handleUpdateIncome} className="text-green-400 hover:text-green-300">
                <Check size={20} />
              </button>
              <button onClick={() => setEditingIncome(false)} className="text-gray-400 hover:text-gray-300">
                <X size={20} />
              </button>
            </div>
          ) : (
            <button onClick={() => setEditingIncome(true)} className="text-gray-400 hover:text-white">
              <Edit2 size={18} />
            </button>
          )}
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Nishant's Income */}
          <div className="bg-white/10 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-indigo-500 rounded-full flex items-center justify-center">
                <span className="font-bold">N</span>
              </div>
              <div>
                <p className="text-sm text-gray-300">Nishant's Salary</p>
                {editingIncome ? (
                  <input
                    type="number"
                    value={budget.primary_salary}
                    onChange={(e) => setBudget({ ...budget, primary_salary: parseFloat(e.target.value) || 0 })}
                    className="bg-white/20 border-0 rounded px-2 py-1 text-white w-32"
                  />
                ) : (
                  <p className="text-2xl font-bold">{formatCurrency(nishantSalary)}</p>
                )}
              </div>
            </div>
            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-400 rounded-full"
                style={{ width: `${(nishantSalary / totalIncome) * 100}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">{((nishantSalary / totalIncome) * 100).toFixed(0)}% of household</p>
          </div>

          {/* Krati's Contribution */}
          <div className="bg-white/10 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-pink-500 rounded-full flex items-center justify-center">
                <span className="font-bold">K</span>
              </div>
              <div>
                <p className="text-sm text-gray-300">{budget.partner_name}'s Contribution</p>
                <p className="text-2xl font-bold">{formatCurrency(kratiContribution)}</p>
              </div>
            </div>
            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-pink-400 rounded-full"
                style={{ width: `${(kratiContribution / totalIncome) * 100}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">£1,300 cash + £300 India SCB</p>
          </div>

          {/* Total */}
          <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-xl p-4 border border-green-500/30">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                <TrendingUp size={20} />
              </div>
              <div>
                <p className="text-sm text-gray-300">Total Household</p>
                <p className="text-2xl font-bold text-green-400">{formatCurrency(totalIncome)}</p>
              </div>
            </div>
            <p className="text-xs text-gray-400">Combined monthly income</p>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card bg-gradient-to-br from-red-50 to-orange-50 border-red-200">
          <p className="text-sm text-gray-600 mb-1">Expenses</p>
          <p className="text-2xl font-bold text-red-600">{formatCurrency(nishantOutgoing - nishantSavings)}</p>
          <p className="text-xs text-gray-500">{(((nishantOutgoing - nishantSavings) / availablePot) * 100).toFixed(0)}% of available</p>
        </div>
        <div className="card bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
          <p className="text-sm text-gray-600 mb-1">Savings</p>
          <p className="text-2xl font-bold text-blue-600">{formatCurrency(nishantSavings)}</p>
          <p className="text-xs text-gray-500">{savingsRate.toFixed(0)}% savings rate</p>
        </div>
        <div className={`card ${remaining >= 0 ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200' : 'bg-gradient-to-br from-orange-50 to-red-50 border-orange-200'}`}>
          <p className="text-sm text-gray-600 mb-1">Remaining</p>
          <p className={`text-2xl font-bold ${remaining >= 0 ? 'text-green-600' : 'text-orange-600'}`}>{formatCurrency(remaining)}</p>
          <p className="text-xs text-gray-500">{remaining >= 0 ? 'Buffer available' : 'Over budget!'}</p>
        </div>
        <div className="card bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-200">
          <p className="text-sm text-gray-600 mb-1">Allocated</p>
          <p className="text-2xl font-bold text-purple-600">{((nishantOutgoing / availablePot) * 100).toFixed(0)}%</p>
          <div className="h-2 bg-gray-200 rounded-full mt-2 overflow-hidden">
            <div className="h-full bg-purple-500 rounded-full" style={{ width: `${Math.min((nishantOutgoing / availablePot) * 100, 100)}%` }} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'details', label: 'Budget Items' },
          { id: 'split', label: 'Split View' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-4 py-2 font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab.id
                ? 'text-primary-600 border-primary-600'
                : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Spending Breakdown */}
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Spending Breakdown</h3>
            <div className="space-y-3">
              {expensesByGroup.filter(g => g.total > 0).sort((a, b) => b.total - a.total).map(({ group, total }) => (
                <div key={group} className="group">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${groupColors[group] || 'bg-gray-500'}`} />
                      <span className="text-sm font-medium">{group}</span>
                    </div>
                    <span className="text-sm font-semibold">{formatCurrency(total)}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${groupColors[group] || 'bg-gray-500'}`}
                      style={{ width: `${(total / Number(budget.total_expenses)) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{((total / totalIncome) * 100).toFixed(1)}% of income</p>
                </div>
              ))}
            </div>
          </div>

          {/* Savings Breakdown */}
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Savings & Investments</h3>
            <div className="space-y-3">
              {budget.line_items.filter(i => i.category_type === 'saving' && i.group !== 'Income').map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{item.name}</p>
                    <p className="text-xs text-gray-500">
                      {item.split_type === 'shared'
                        ? `Nishant: ${formatCurrency(item.primary_amount)} | Krati: ${formatCurrency(item.partner_amount)}`
                        : item.split_type === 'personal_primary' ? 'Nishant only' : 'Krati only'
                      }
                    </p>
                  </div>
                  <span className="text-lg font-bold text-blue-600">{formatCurrency(item.amount)}</span>
                </div>
              ))}
              <div className="pt-3 border-t border-gray-200 flex justify-between items-center">
                <span className="font-semibold">Total Savings</span>
                <span className="text-xl font-bold text-blue-600">
                  {formatCurrency(budget.line_items.filter(i => i.category_type === 'saving' && i.group !== 'Income').reduce((s, i) => s + Number(i.amount), 0))}
                </span>
              </div>
            </div>
          </div>

          {/* Budget Health */}
          <div className="card md:col-span-2 bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200">
            <div className="flex gap-3">
              <AlertCircle className="text-amber-600 flex-shrink-0" size={24} />
              <div className="flex-1">
                <h4 className="font-semibold text-amber-900 mb-2">Budget Health Check</h4>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className={`p-3 rounded-lg ${savingsRate >= 20 ? 'bg-green-100' : 'bg-yellow-100'}`}>
                    <p className="text-sm font-medium">Savings Rate</p>
                    <p className={`text-xl font-bold ${savingsRate >= 20 ? 'text-green-700' : 'text-yellow-700'}`}>
                      {savingsRate.toFixed(1)}%
                    </p>
                    <p className="text-xs text-gray-600">{savingsRate >= 20 ? '✓ Above 20% target' : '⚠ Below 20% target'}</p>
                  </div>
                  <div className={`p-3 rounded-lg ${(Number(budget.total_expenses) - Number(budget.total_savings)) / totalIncome <= 0.5 ? 'bg-green-100' : 'bg-yellow-100'}`}>
                    <p className="text-sm font-medium">Essential Expenses</p>
                    <p className="text-xl font-bold text-gray-700">
                      {(((Number(budget.total_expenses)) / totalIncome) * 100).toFixed(0)}%
                    </p>
                    <p className="text-xs text-gray-600">of income on expenses</p>
                  </div>
                  <div className={`p-3 rounded-lg ${remaining >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                    <p className="text-sm font-medium">Monthly Buffer</p>
                    <p className={`text-xl font-bold ${remaining >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      {formatCurrency(Math.abs(remaining))}
                    </p>
                    <p className="text-xs text-gray-600">{remaining >= 0 ? '✓ Positive buffer' : '✗ Over budget'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Details Tab */}
      {activeTab === 'details' && (
        <div className="space-y-4">
          {Object.entries(groupedItems).filter(([group]) => group !== 'Income').sort(([a], [b]) => a.localeCompare(b)).map(([group, items]) => (
            <div key={group} className="card">
              <button
                onClick={() => toggleGroup(group)}
                className="w-full flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white ${groupColors[group] || 'bg-gray-500'}`}>
                    {groupIcons[group] || <ShoppingCart size={18} />}
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-gray-900">{group}</h3>
                    <p className="text-sm text-gray-500">{items.length} items</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-lg font-bold">
                    {formatCurrency(items.reduce((s, i) => s + Number(i.amount), 0))}
                  </span>
                  {expandedGroups.has(group) ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>
              </button>

              {expandedGroups.has(group) && (
                <div className="mt-4 space-y-2 border-t pt-4">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                        item.category_type === 'saving' ? 'bg-blue-50 hover:bg-blue-100' : 'bg-gray-50 hover:bg-gray-100'
                      }`}
                    >
                      {editingItem === item.id ? (
                        <div className="flex-1 flex flex-wrap items-center gap-2">
                          <input
                            type="text"
                            value={editValues.name ?? item.name}
                            onChange={(e) => setEditValues({ ...editValues, name: e.target.value })}
                            className="input flex-1 min-w-[150px]"
                            placeholder="Name"
                          />
                          <input
                            type="number"
                            value={editValues.amount ?? item.amount}
                            onChange={(e) => setEditValues({ ...editValues, amount: parseFloat(e.target.value) || 0 })}
                            className="input w-28"
                            placeholder="Amount"
                          />
                          <select
                            value={editValues.split_type ?? item.split_type}
                            onChange={(e) => setEditValues({ ...editValues, split_type: e.target.value as any })}
                            className="input w-36"
                          >
                            <option value="shared">Shared</option>
                            <option value="personal_primary">Nishant only</option>
                            <option value="personal_partner">Krati only</option>
                          </select>
                          <button onClick={() => handleUpdateItem(item)} className="p-2 text-green-600 hover:bg-green-100 rounded">
                            <Check size={18} />
                          </button>
                          <button onClick={() => { setEditingItem(null); setEditValues({}); }} className="p-2 text-gray-400 hover:bg-gray-200 rounded">
                            <X size={18} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-gray-900">{item.name}</span>
                              {item.split_type === 'personal_primary' && (
                                <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">Nishant</span>
                              )}
                              {item.split_type === 'personal_partner' && (
                                <span className="text-xs bg-pink-100 text-pink-700 px-2 py-0.5 rounded-full">Krati</span>
                              )}
                              {item.category_type === 'saving' && (
                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Saving</span>
                              )}
                              {item.notes && (
                                <span className="text-xs text-gray-400 truncate">{item.notes}</span>
                              )}
                            </div>
                            {item.split_type === 'shared' && (
                              <p className="text-xs text-gray-500 mt-0.5">
                                N: {formatCurrency(item.primary_amount)} ({Number(item.primary_share_percent).toFixed(0)}%) | K: {formatCurrency(item.partner_amount)}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`font-semibold ${item.category_type === 'saving' ? 'text-blue-600' : 'text-gray-900'}`}>
                              {formatCurrency(item.amount)}
                            </span>
                            <button onClick={() => { setEditingItem(item.id); setEditValues(item); }} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-white rounded">
                              <Edit2 size={16} />
                            </button>
                            <button onClick={() => handleDeleteItem(item.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-white rounded">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Split View Tab */}
      {activeTab === 'split' && (() => {
        // Personal savings (Nishant's personal items)
        const isPersonalSaving = (item: BudgetLineItem) => {
          const name = item.name.toLowerCase();
          return item.category_type === 'saving' &&
            item.group !== 'Income' &&
            item.split_type === 'personal_primary' &&
            (name.includes('personal') || name === 'cash saving' || item.group === 'Personal');
        };
        const personalSavings = budget.line_items.filter(isPersonalSaving);
        const personalSavingsTotal = personalSavings.reduce((s, i) => s + Number(i.amount), 0);

        // Family savings (shared/family investments - excludes personal and Krati's direct payments)
        const familySavings = budget.line_items.filter(i =>
          i.category_type === 'saving' &&
          i.group !== 'Income' &&
          i.split_type === 'personal_primary' &&
          !isPersonalSaving(i)
        );
        const familySavingsTotal = familySavings.reduce((s, i) => s + Number(i.amount), 0);

        // Essential expenses (non-savings items Nishant pays)
        const essentialExpenses = budget.line_items.filter(i =>
          i.category_type === 'expense' &&
          i.split_type === 'personal_primary'
        );
        const essentialExpensesTotal = essentialExpenses.reduce((s, i) => s + Number(i.amount), 0);

        // Nishant's personal expenses (Personal Allowance, etc.)
        const personalExpenses = budget.line_items.filter(i =>
          i.category_type === 'expense' &&
          i.split_type === 'personal_primary' &&
          i.group === 'Personal'
        );
        const personalExpensesTotal = personalExpenses.reduce((s, i) => s + Number(i.amount), 0);

        return (
          <div className="grid md:grid-cols-3 gap-6">
            {/* Nishant's Personal Allowance */}
            <div className="card border-2 border-orange-200">
              <div className="flex items-center gap-3 mb-4 pb-4 border-b">
                <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center">
                  <Wallet className="text-white" size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Personal Spend</h3>
                  <p className="text-sm text-gray-500">Nishant's monthly allowance</p>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                {personalExpenses.map(item => (
                  <div key={item.id} className="flex justify-between text-sm py-2 px-3 bg-orange-50 rounded-lg">
                    <span>{item.name}</span>
                    <span className="font-medium">{formatCurrency(item.amount)}</span>
                  </div>
                ))}
              </div>

              <div className="bg-orange-100 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Total Personal Spend</span>
                  <span className="text-xl font-bold text-orange-600">{formatCurrency(personalExpensesTotal)}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">{((personalExpensesTotal / availablePot) * 100).toFixed(1)}% of available pot</p>
              </div>
            </div>

            {/* Personal Savings */}
            <div className="card border-2 border-indigo-200">
              <div className="flex items-center gap-3 mb-4 pb-4 border-b">
                <div className="w-12 h-12 bg-indigo-500 rounded-full flex items-center justify-center">
                  <User className="text-white" size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Personal Savings</h3>
                  <p className="text-sm text-gray-500">Nishant's personal funds</p>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                {personalSavings.map(item => (
                  <div key={item.id} className="flex justify-between text-sm py-2 px-3 bg-indigo-50 rounded-lg">
                    <span>{item.name}</span>
                    <span className="font-medium">{formatCurrency(item.amount)}</span>
                  </div>
                ))}
              </div>

              <div className="bg-indigo-100 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Total Personal</span>
                  <span className="text-xl font-bold text-indigo-600">{formatCurrency(personalSavingsTotal)}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">{((personalSavingsTotal / availablePot) * 100).toFixed(1)}% of available pot</p>
              </div>
            </div>

            {/* Family Savings */}
            <div className="card border-2 border-cyan-200">
              <div className="flex items-center gap-3 mb-4 pb-4 border-b">
                <div className="w-12 h-12 bg-cyan-500 rounded-full flex items-center justify-center">
                  <Users className="text-white" size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Family Savings</h3>
                  <p className="text-sm text-gray-500">Shared family investments</p>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                {familySavings.map(item => (
                  <div key={item.id} className="flex justify-between text-sm py-2 px-3 bg-cyan-50 rounded-lg">
                    <span>{item.name}</span>
                    <span className="font-medium">{formatCurrency(item.amount)}</span>
                  </div>
                ))}
              </div>

              <div className="bg-cyan-100 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Total Family</span>
                  <span className="text-xl font-bold text-cyan-600">{formatCurrency(familySavingsTotal)}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">{((familySavingsTotal / availablePot) * 100).toFixed(1)}% of available pot</p>
              </div>
            </div>

            {/* Money Flow Summary */}
            <div className="card md:col-span-3 bg-gradient-to-r from-slate-900 to-slate-800 text-white">
              <h3 className="font-semibold mb-6 flex items-center gap-2">
                <ArrowRight size={20} />
                Monthly Money Flow
              </h3>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white/10 rounded-xl p-4 text-center">
                  <p className="text-sm text-gray-300 mb-1">Available Pot</p>
                  <p className="text-2xl font-bold text-green-400">{formatCurrency(availablePot)}</p>
                  <p className="text-xs text-gray-400 mt-1">Nishant + Krati cash</p>
                </div>

                <div className="bg-white/10 rounded-xl p-4 text-center">
                  <p className="text-sm text-gray-300 mb-1">Essential Expenses</p>
                  <p className="text-2xl font-bold text-red-400">{formatCurrency(essentialExpensesTotal)}</p>
                  <p className="text-xs text-gray-400 mt-1">{((essentialExpensesTotal / availablePot) * 100).toFixed(0)}% of pot</p>
                </div>

                <div className="bg-white/10 rounded-xl p-4 text-center">
                  <p className="text-sm text-gray-300 mb-1">Total Savings</p>
                  <p className="text-2xl font-bold text-blue-400">{formatCurrency(personalSavingsTotal + familySavingsTotal)}</p>
                  <p className="text-xs text-gray-400 mt-1">{(((personalSavingsTotal + familySavingsTotal) / availablePot) * 100).toFixed(0)}% of pot</p>
                </div>

                <div className="bg-white/10 rounded-xl p-4 text-center">
                  <p className="text-sm text-gray-300 mb-1">Remaining</p>
                  <p className={`text-2xl font-bold ${remaining >= 0 ? 'text-green-400' : 'text-orange-400'}`}>{formatCurrency(remaining)}</p>
                  <p className="text-xs text-gray-400 mt-1">{remaining >= 0 ? 'Buffer' : 'Over budget'}</p>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-white/20">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-300">Krati's contribution to pot:</span>
                  <span className="font-medium text-pink-400">{formatCurrency(kratiCashToHousehold)}</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-gray-300">Krati's direct payment (India SCB):</span>
                  <span className="font-medium text-pink-400">{formatCurrency(kratiContribution - kratiCashToHousehold)}</span>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Add Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Add Budget Item</h2>
                <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="label">Name</label>
                  <input
                    type="text"
                    value={newItem.name}
                    onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                    className="input"
                    placeholder="e.g., Netflix"
                  />
                </div>

                <div>
                  <label className="label">Amount (£)</label>
                  <input
                    type="number"
                    value={newItem.amount}
                    onChange={(e) => setNewItem({ ...newItem, amount: e.target.value })}
                    className="input"
                    placeholder="0.00"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Type</label>
                    <select
                      value={newItem.category_type}
                      onChange={(e) => setNewItem({ ...newItem, category_type: e.target.value })}
                      className="input"
                    >
                      <option value="expense">Expense</option>
                      <option value="saving">Saving</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Group</label>
                    <select
                      value={newItem.group}
                      onChange={(e) => setNewItem({ ...newItem, group: e.target.value })}
                      className="input"
                    >
                      <option value="Housing">Housing</option>
                      <option value="Transport">Transport</option>
                      <option value="Living">Living</option>
                      <option value="Subscriptions">Subscriptions</option>
                      <option value="Family">Family</option>
                      <option value="Property">Property</option>
                      <option value="Savings">Savings</option>
                      <option value="Personal">Personal</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="label">Who pays?</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: 'shared', label: 'Shared' },
                      { value: 'personal_primary', label: 'Nishant' },
                      { value: 'personal_partner', label: 'Krati' },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setNewItem({ ...newItem, split_type: opt.value })}
                        className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                          newItem.split_type === opt.value
                            ? opt.value === 'shared' ? 'bg-gray-800 text-white'
                              : opt.value === 'personal_primary' ? 'bg-indigo-500 text-white'
                              : 'bg-pink-500 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {newItem.split_type === 'shared' && (
                  <div>
                    <label className="label">Nishant's Share: {newItem.primary_share_percent}%</label>
                    <input
                      type="range"
                      value={newItem.primary_share_percent}
                      onChange={(e) => setNewItem({ ...newItem, primary_share_percent: e.target.value })}
                      className="w-full"
                      min="0"
                      max="100"
                    />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Krati pays more</span>
                      <span>Equal</span>
                      <span>Nishant pays more</span>
                    </div>
                  </div>
                )}

                <div>
                  <label className="label">Notes (optional)</label>
                  <input
                    type="text"
                    value={newItem.notes}
                    onChange={(e) => setNewItem({ ...newItem, notes: e.target.value })}
                    className="input"
                    placeholder="Any notes..."
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button onClick={() => setShowAddModal(false)} className="flex-1 btn-secondary">
                    Cancel
                  </button>
                  <button onClick={handleAddItem} className="flex-1 btn-primary">
                    Add Item
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
