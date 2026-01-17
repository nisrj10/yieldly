import { useEffect, useState } from 'react';
import { financeApi } from '../api/client';
import type { SavingsGoal } from '../types';
import { formatCurrency } from '../utils/format';
import {
  Plus,
  X,
  Target,
  CheckCircle,
  PoundSterling,
  Shield,
  Home,
  Building2,
  Sparkles,
  TrendingUp,
  Clock,
} from 'lucide-react';

// Goal type configurations with colors and icons
const getGoalConfig = (name: string) => {
  const lowerName = name.toLowerCase();
  if (lowerName.includes('emergency')) {
    return {
      icon: Shield,
      gradient: 'from-blue-500 to-cyan-500',
      bgLight: 'bg-blue-50',
      border: 'border-blue-200',
      text: 'text-blue-600',
      progress: 'bg-gradient-to-r from-blue-500 to-cyan-500',
    };
  }
  if (lowerName.includes('property') || lowerName.includes('investment property')) {
    return {
      icon: Building2,
      gradient: 'from-purple-500 to-pink-500',
      bgLight: 'bg-purple-50',
      border: 'border-purple-200',
      text: 'text-purple-600',
      progress: 'bg-gradient-to-r from-purple-500 to-pink-500',
    };
  }
  if (lowerName.includes('mortgage') || lowerName.includes('lko')) {
    return {
      icon: Home,
      gradient: 'from-amber-500 to-orange-500',
      bgLight: 'bg-amber-50',
      border: 'border-amber-200',
      text: 'text-amber-600',
      progress: 'bg-gradient-to-r from-amber-500 to-orange-500',
    };
  }
  if (lowerName.includes('uk mortgage')) {
    return {
      icon: Home,
      gradient: 'from-rose-500 to-red-500',
      bgLight: 'bg-rose-50',
      border: 'border-rose-200',
      text: 'text-rose-600',
      progress: 'bg-gradient-to-r from-rose-500 to-red-500',
    };
  }
  return {
    icon: Target,
    gradient: 'from-emerald-500 to-teal-500',
    bgLight: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-600',
    progress: 'bg-gradient-to-r from-emerald-500 to-teal-500',
  };
};

export default function Goals() {
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showAddFundsModal, setShowAddFundsModal] = useState<number | null>(null);
  const [addAmount, setAddAmount] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    target_amount: '',
    current_amount: '',
    target_date: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const res = await financeApi.getSavingsGoals();
      setGoals(res.data.results || res.data);
    } catch (error) {
      console.error('Error loading goals:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await financeApi.createSavingsGoal({
        name: formData.name,
        target_amount: parseFloat(formData.target_amount),
        current_amount: formData.current_amount ? parseFloat(formData.current_amount) : 0,
        target_date: formData.target_date || undefined,
      });
      setShowModal(false);
      setFormData({ name: '', target_amount: '', current_amount: '', target_date: '' });
      loadData();
    } catch (error) {
      console.error('Error creating goal:', error);
    }
  };

  const handleAddFunds = async (goalId: number) => {
    const goal = goals.find((g) => g.id === goalId);
    if (!goal || !addAmount) return;

    try {
      const newAmount = Number(goal.current_amount) + parseFloat(addAmount);
      await financeApi.updateSavingsGoal(goalId, {
        current_amount: newAmount,
        is_completed: newAmount >= Number(goal.target_amount),
      });
      setShowAddFundsModal(null);
      setAddAmount('');
      loadData();
    } catch (error) {
      console.error('Error adding funds:', error);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this goal?')) {
      try {
        await financeApi.deleteSavingsGoal(id);
        loadData();
      } catch (error) {
        console.error('Error deleting goal:', error);
      }
    }
  };

  const activeGoals = goals.filter((g) => !g.is_completed);
  const completedGoals = goals.filter((g) => g.is_completed);

  // Calculate summary stats
  const totalTarget = activeGoals.reduce((sum, g) => sum + Number(g.target_amount), 0);
  const totalSaved = activeGoals.reduce((sum, g) => sum + Number(g.current_amount), 0);
  const overallProgress = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-purple-600 rounded-xl flex items-center justify-center">
              <Sparkles className="text-white" size={20} />
            </div>
            Financial Goals
          </h1>
          <p className="text-gray-600 mt-1">Track your journey to financial freedom</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
          <Plus size={20} />
          New Goal
        </button>
      </div>

      {/* Summary Cards */}
      {activeGoals.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card bg-gradient-to-br from-slate-800 to-slate-900 text-white">
            <div className="flex items-center gap-3 mb-2">
              <Target size={20} className="text-slate-400" />
              <span className="text-sm text-slate-300">Total Target</span>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(totalTarget)}</p>
            <p className="text-sm text-slate-400 mt-1">{activeGoals.length} active goals</p>
          </div>

          <div className="card bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp size={20} className="text-emerald-200" />
              <span className="text-sm text-emerald-100">Total Saved</span>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(totalSaved)}</p>
            <p className="text-sm text-emerald-200 mt-1">{formatCurrency(totalTarget - totalSaved)} remaining</p>
          </div>

          <div className="card bg-gradient-to-br from-violet-500 to-purple-600 text-white">
            <div className="flex items-center gap-3 mb-2">
              <Sparkles size={20} className="text-violet-200" />
              <span className="text-sm text-violet-100">Overall Progress</span>
            </div>
            <p className="text-2xl font-bold">{overallProgress.toFixed(0)}%</p>
            <div className="mt-2 h-2 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Active Goals */}
      {activeGoals.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Clock size={20} className="text-gray-400" />
            Active Goals
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {activeGoals.map((goal) => {
              const config = getGoalConfig(goal.name);
              const Icon = config.icon;
              const progress = Number(goal.progress_percent);
              const remaining = Number(goal.target_amount) - Number(goal.current_amount);

              return (
                <div
                  key={goal.id}
                  className={`card border-2 ${config.border} overflow-hidden relative`}
                >
                  {/* Gradient accent bar */}
                  <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${config.gradient}`} />

                  <div className="flex items-start justify-between mb-4 pt-2">
                    <div className="flex items-center gap-4">
                      <div className={`w-14 h-14 bg-gradient-to-br ${config.gradient} rounded-2xl flex items-center justify-center shadow-lg`}>
                        <Icon className="text-white" size={28} />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-gray-900">{goal.name}</h3>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(goal.id)}
                      className="text-gray-300 hover:text-red-500 transition-colors p-1"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {/* Amount display */}
                  <div className="flex items-end justify-between mb-3">
                    <div>
                      <p className="text-sm text-gray-500">Saved</p>
                      <p className={`text-2xl font-bold ${config.text}`}>
                        {formatCurrency(goal.current_amount)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">Target</p>
                      <p className="text-xl font-semibold text-gray-700">
                        {formatCurrency(goal.target_amount)}
                      </p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="relative mb-3">
                    <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${config.progress} rounded-full transition-all duration-500 relative`}
                        style={{ width: `${progress}%` }}
                      >
                        {progress > 15 && (
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-white">
                            {progress.toFixed(0)}%
                          </span>
                        )}
                      </div>
                    </div>
                    {progress <= 15 && (
                      <span className={`absolute left-2 top-1/2 -translate-y-1/2 text-xs font-bold ${config.text}`}>
                        {progress.toFixed(0)}%
                      </span>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <div className="text-sm text-gray-500">
                      <span className="font-medium text-gray-700">{formatCurrency(remaining)}</span> to go
                    </div>
                    <button
                      onClick={() => setShowAddFundsModal(goal.id)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg ${config.bgLight} ${config.text} font-medium hover:opacity-80 transition-opacity`}
                    >
                      <PoundSterling size={16} />
                      Add Funds
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Completed Goals */}
      {completedGoals.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <CheckCircle size={20} className="text-green-500" />
            Completed Goals
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {completedGoals.map((goal) => (
              <div key={goal.id} className="card bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center">
                    <CheckCircle className="text-white" size={24} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{goal.name}</h3>
                    <p className="text-sm text-green-600 font-medium">
                      {formatCurrency(goal.target_amount)} achieved!
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(goal.id)}
                    className="text-gray-300 hover:text-red-500 transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {goals.length === 0 && (
        <div className="card text-center py-16 bg-gradient-to-br from-gray-50 to-slate-100">
          <div className="w-20 h-20 bg-gradient-to-br from-primary-500 to-purple-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <Target className="text-white" size={40} />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">No goals yet</h3>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">
            Start your journey to financial freedom by setting your first savings goal
          </p>
          <button onClick={() => setShowModal(true)} className="btn-primary">
            Create your first goal
          </button>
        </div>
      )}

      {/* Create Goal Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-gradient-to-r from-primary-500 to-purple-600 p-6 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                    <Target size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">New Goal</h2>
                    <p className="text-sm text-white/80">Set a new savings target</p>
                  </div>
                </div>
                <button onClick={() => setShowModal(false)} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                  <X size={20} />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="label">Goal Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                  className="input"
                  placeholder="e.g., Emergency Fund"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Target Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.target_amount}
                    onChange={(e) => setFormData((p) => ({ ...p, target_amount: e.target.value }))}
                    className="input"
                    placeholder="10000"
                    required
                  />
                </div>

                <div>
                  <label className="label">Starting Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.current_amount}
                    onChange={(e) => setFormData((p) => ({ ...p, current_amount: e.target.value }))}
                    className="input"
                    placeholder="0"
                  />
                </div>
              </div>

              <div>
                <label className="label">Target Date (optional)</label>
                <input
                  type="date"
                  value={formData.target_date}
                  onChange={(e) => setFormData((p) => ({ ...p, target_date: e.target.value }))}
                  className="input"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="flex-1 btn-primary">
                  Create Goal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Funds Modal */}
      {showAddFundsModal && (() => {
        const goal = goals.find(g => g.id === showAddFundsModal);
        const config = goal ? getGoalConfig(goal.name) : getGoalConfig('');

        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
              <div className={`bg-gradient-to-r ${config.gradient} p-6 text-white`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                      <PoundSterling size={20} />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold">Add Funds</h2>
                      <p className="text-sm text-white/80">{goal?.name}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShowAddFundsModal(null);
                      setAddAmount('');
                    }}
                    className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-4">
                {goal && (
                  <div className="text-center p-4 bg-gray-50 rounded-xl">
                    <p className="text-sm text-gray-500">Current Progress</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatCurrency(goal.current_amount)} / {formatCurrency(goal.target_amount)}
                    </p>
                  </div>
                )}

                <div>
                  <label className="label">Amount to Add</label>
                  <input
                    type="number"
                    step="0.01"
                    value={addAmount}
                    onChange={(e) => setAddAmount(e.target.value)}
                    className="input text-lg"
                    placeholder="0.00"
                    autoFocus
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowAddFundsModal(null);
                      setAddAmount('');
                    }}
                    className="flex-1 btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleAddFunds(showAddFundsModal)}
                    className="flex-1 btn-primary"
                  >
                    Add Funds
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
