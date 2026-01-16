import { useEffect, useState } from 'react';
import { financeApi } from '../api/client';
import type { SavingsGoal } from '../types';
import { formatCurrency } from '../utils/format';
import { Plus, X, Target, CheckCircle, PoundSterling } from 'lucide-react';

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
      // Handle paginated response
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
          <h1 className="text-2xl font-bold text-gray-900">Savings Goals</h1>
          <p className="text-gray-600">Track progress towards your financial goals</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
          <Plus size={20} />
          New Goal
        </button>
      </div>

      {/* Active Goals */}
      {activeGoals.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Active Goals</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {activeGoals.map((goal) => (
              <div key={goal.id} className="card">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
                      <Target className="text-primary-600" size={24} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{goal.name}</h3>
                      {goal.target_date && (
                        <p className="text-sm text-gray-500">
                          Target: {new Date(goal.target_date).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(goal.id)}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Progress</span>
                    <span className="font-medium text-gray-900">
                      {formatCurrency(goal.current_amount)} / {formatCurrency(goal.target_amount)}
                    </span>
                  </div>

                  <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary-600 rounded-full transition-all"
                      style={{ width: `${Number(goal.progress_percent)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">
                      {Number(goal.progress_percent).toFixed(0)}% complete
                    </span>
                    <button
                      onClick={() => setShowAddFundsModal(goal.id)}
                      className="text-sm text-primary-600 font-medium hover:text-primary-700 flex items-center gap-1"
                    >
                      <PoundSterling size={16} />
                      Add Funds
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completed Goals */}
      {completedGoals.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Completed Goals</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {completedGoals.map((goal) => (
              <div key={goal.id} className="card bg-green-50 border-green-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="text-green-600" size={20} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">{goal.name}</h3>
                    <p className="text-sm text-green-600">{formatCurrency(goal.target_amount)} achieved!</p>
                  </div>
                  <button
                    onClick={() => handleDelete(goal.id)}
                    className="text-gray-400 hover:text-red-500 transition-colors"
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
        <div className="card text-center py-12">
          <Target className="mx-auto text-gray-400 mb-4" size={48} />
          <p className="text-gray-500 mb-4">No savings goals yet</p>
          <button onClick={() => setShowModal(true)} className="btn-primary">
            Create your first goal
          </button>
        </div>
      )}

      {/* Create Goal Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Create Savings Goal</h2>
                <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
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
                  <label className="label">Starting Amount (optional)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.current_amount}
                    onChange={(e) => setFormData((p) => ({ ...p, current_amount: e.target.value }))}
                    className="input"
                    placeholder="0"
                  />
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
        </div>
      )}

      {/* Add Funds Modal */}
      {showAddFundsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Add Funds</h2>
                <button
                  onClick={() => {
                    setShowAddFundsModal(null);
                    setAddAmount('');
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="label">Amount to Add</label>
                  <input
                    type="number"
                    step="0.01"
                    value={addAmount}
                    onChange={(e) => setAddAmount(e.target.value)}
                    className="input"
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
        </div>
      )}
    </div>
  );
}
