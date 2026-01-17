import { useEffect, useState } from 'react';
import { financeApi } from '../api/client';
import { formatCurrency, formatPercent } from '../utils/format';
import {
  Plus,
  X,
  TrendingUp,
  TrendingDown,
  Calendar,
  Leaf,
  PiggyBank,
  Briefcase,
  Shield,
  Wallet,
  Edit2,
  ChevronRight,
} from 'lucide-react';

interface Portfolio {
  id: number;
  name: string;
  portfolio_type: string;
  portfolio_type_display: string;
  risk_level: string;
  risk_level_display: string;
  provider: string;
  owner_name: string;
  initial_value: number;
  start_date: string;
  current_value: number;
  year_start_value: number;
  total_gain_loss: number;
  total_gain_loss_percent: number;
  ytd_gain_loss: number;
  ytd_gain_loss_percent: number;
  notes: string;
  is_active: boolean;
  updated_at: string;
}

interface PortfolioSummary {
  total_net_worth: number;
  my_net_worth: number;
  kiaan_net_worth: number;
  total_investments: number;
  total_savings: number;
  total_pots: number;
  investments: Portfolio[];
  savings: Portfolio[];
  pots: Portfolio[];
}

const PORTFOLIO_TYPES = [
  { value: 'isa', label: 'ISA', icon: Briefcase },
  { value: 'jisa', label: 'Junior ISA', icon: Leaf },
  { value: 'pension', label: 'Pension', icon: Shield },
  { value: 'gia', label: 'General Investment', icon: TrendingUp },
  { value: 'savings', label: 'Savings Account', icon: PiggyBank },
  { value: 'emergency', label: 'Emergency Fund', icon: Shield },
  { value: 'pot', label: 'Pot', icon: Wallet },
  { value: 'other', label: 'Other', icon: Wallet },
];

const RISK_LEVELS = [
  { value: '1', label: 'Level 1/5' },
  { value: '2', label: 'Level 2/5' },
  { value: '3', label: 'Level 3/5' },
  { value: '4', label: 'Level 4/5' },
  { value: '5', label: 'Level 5/5' },
  { value: 'none', label: 'N/A' },
];

function PortfolioCard({
  portfolio,
  onEdit,
  onUpdateValue,
}: {
  portfolio: Portfolio;
  onEdit: () => void;
  onUpdateValue: () => void;
}) {
  const isInvestment = ['isa', 'jisa', 'pension', 'gia'].includes(portfolio.portfolio_type);
  const startDate = new Date(portfolio.start_date);
  const startMonthYear = startDate.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });

  const typeConfig = PORTFOLIO_TYPES.find((t) => t.value === portfolio.portfolio_type);
  const Icon = typeConfig?.icon || Wallet;

  return (
    <div className="bg-gray-900 rounded-xl p-5 text-white relative group">
      {/* Type and Risk Level */}
      <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
        <span className="uppercase">{portfolio.portfolio_type_display}</span>
        {portfolio.risk_level !== 'none' && (
          <>
            <span>-</span>
            <span>{portfolio.risk_level_display}</span>
          </>
        )}
      </div>

      {/* Name */}
      <div className="flex items-start justify-between">
        <h3 className="text-xl font-semibold mb-3">{portfolio.name}</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={onUpdateValue}
            className="p-2 text-gray-400 hover:text-white transition-colors"
            title="Update value"
          >
            <Calendar size={20} />
          </button>
          {portfolio.portfolio_type === 'jisa' && (
            <Leaf size={20} className="text-green-400" />
          )}
        </div>
      </div>

      {/* Current Value */}
      <p className="text-3xl font-bold mb-4">{formatCurrency(portfolio.current_value)}</p>

      {/* Performance Stats */}
      {isInvestment ? (
        <div className="flex items-center gap-6 text-sm">
          <div>
            <span className="text-gray-400">Since {startMonthYear}</span>
            <span
              className={`ml-2 font-medium ${
                portfolio.total_gain_loss_percent >= 0 ? 'text-green-400' : 'text-red-400'
              }`}
            >
              {portfolio.total_gain_loss_percent >= 0 ? '↑' : '↓'}{' '}
              {Math.abs(portfolio.total_gain_loss_percent).toFixed(2)}%
            </span>
          </div>
          <div>
            <span className="text-gray-400">This year</span>
            <span
              className={`ml-2 font-medium ${
                portfolio.ytd_gain_loss_percent >= 0 ? 'text-green-400' : 'text-red-400'
              }`}
            >
              {portfolio.ytd_gain_loss_percent >= 0 ? '↑' : '↓'}{' '}
              {Math.abs(portfolio.ytd_gain_loss_percent).toFixed(2)}%
            </span>
          </div>
        </div>
      ) : (
        <div className="text-sm text-gray-400">
          {portfolio.owner_name && <span>{portfolio.owner_name}'s account</span>}
          {portfolio.provider && <span className="ml-2">• {portfolio.provider}</span>}
        </div>
      )}

      {/* Last Updated */}
      <div className="mt-3 pt-3 border-t border-gray-700 text-xs text-gray-500">
        Updated {new Date(portfolio.updated_at).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })}
      </div>

      {/* Edit button (shows on hover) */}
      <button
        onClick={onEdit}
        className="absolute top-3 right-3 p-2 text-gray-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <Edit2 size={16} />
      </button>
    </div>
  );
}

export default function Investments() {
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPortfolio, setEditingPortfolio] = useState<Portfolio | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [selectedPortfolio, setSelectedPortfolio] = useState<Portfolio | null>(null);
  const [newValue, setNewValue] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    portfolio_type: 'isa',
    risk_level: 'none',
    provider: '',
    owner_name: '',
    initial_value: '',
    start_date: new Date().toISOString().split('T')[0],
    current_value: '',
    year_start_value: '',
    notes: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const res = await financeApi.getPortfolioSummary();
      setSummary(res.data);
    } catch (error) {
      console.error('Error loading portfolios:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingPortfolio) {
        await financeApi.updatePortfolio(editingPortfolio.id, {
          name: formData.name,
          current_value: parseFloat(formData.current_value),
          year_start_value: parseFloat(formData.year_start_value) || undefined,
          notes: formData.notes,
        });
      } else {
        await financeApi.createPortfolio({
          name: formData.name,
          portfolio_type: formData.portfolio_type,
          risk_level: formData.risk_level,
          provider: formData.provider,
          owner_name: formData.owner_name,
          initial_value: parseFloat(formData.initial_value),
          start_date: formData.start_date,
          current_value: parseFloat(formData.current_value) || parseFloat(formData.initial_value),
          year_start_value: parseFloat(formData.year_start_value) || undefined,
          notes: formData.notes,
        });
      }
      closeModal();
      loadData();
    } catch (error) {
      console.error('Error saving portfolio:', error);
    }
  };

  const handleUpdateValue = async () => {
    if (!selectedPortfolio || !newValue) return;
    try {
      await financeApi.updatePortfolioValue(selectedPortfolio.id, parseFloat(newValue));
      setShowUpdateModal(false);
      setSelectedPortfolio(null);
      setNewValue('');
      loadData();
    } catch (error) {
      console.error('Error updating value:', error);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this portfolio?')) {
      try {
        await financeApi.deletePortfolio(id);
        loadData();
      } catch (error) {
        console.error('Error deleting portfolio:', error);
      }
    }
  };

  const openEditModal = (portfolio: Portfolio) => {
    setEditingPortfolio(portfolio);
    setFormData({
      name: portfolio.name,
      portfolio_type: portfolio.portfolio_type,
      risk_level: portfolio.risk_level,
      provider: portfolio.provider,
      owner_name: portfolio.owner_name,
      initial_value: String(portfolio.initial_value),
      start_date: portfolio.start_date,
      current_value: String(portfolio.current_value),
      year_start_value: String(portfolio.year_start_value),
      notes: portfolio.notes,
    });
    setShowModal(true);
  };

  const openUpdateModal = (portfolio: Portfolio) => {
    setSelectedPortfolio(portfolio);
    setNewValue(String(portfolio.current_value));
    setShowUpdateModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingPortfolio(null);
    setFormData({
      name: '',
      portfolio_type: 'isa',
      risk_level: 'none',
      provider: '',
      owner_name: '',
      initial_value: '',
      start_date: new Date().toISOString().split('T')[0],
      current_value: '',
      year_start_value: '',
      notes: '',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Investments & Savings</h1>
          <p className="text-gray-600">Track your portfolios and savings accounts</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
          <Plus size={20} />
          Add Portfolio
        </button>
      </div>

      {/* Net Worth Summary */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="card bg-gradient-to-br from-primary-500 to-primary-700 text-white">
            <p className="text-sm opacity-80">My Net Worth</p>
            <p className="text-2xl font-bold">{formatCurrency(summary.my_net_worth)}</p>
          </div>
          <div className="card bg-gradient-to-br from-green-500 to-green-700 text-white">
            <p className="text-sm opacity-80">Kiaan's Net Worth</p>
            <p className="text-2xl font-bold">{formatCurrency(summary.kiaan_net_worth)}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-600">Investments</p>
            <p className="text-xl font-bold text-gray-900">{formatCurrency(summary.total_investments)}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-600">Savings & Pots</p>
            <p className="text-xl font-bold text-gray-900">{formatCurrency(summary.total_savings + summary.total_pots)}</p>
          </div>
        </div>
      )}

      {/* Investments Section */}
      {summary && summary.investments.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Briefcase className="text-primary-600" size={24} />
            <h2 className="text-xl font-semibold text-gray-900">My Investments</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {summary.investments.map((portfolio) => (
              <PortfolioCard
                key={portfolio.id}
                portfolio={portfolio}
                onEdit={() => openEditModal(portfolio)}
                onUpdateValue={() => openUpdateModal(portfolio)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Savings Section */}
      {summary && summary.savings.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <PiggyBank className="text-green-600" size={24} />
            <h2 className="text-xl font-semibold text-gray-900">Savings & Emergency Fund</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {summary.savings.map((portfolio) => (
              <PortfolioCard
                key={portfolio.id}
                portfolio={portfolio}
                onEdit={() => openEditModal(portfolio)}
                onUpdateValue={() => openUpdateModal(portfolio)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Pots Section */}
      {summary && summary.pots.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Wallet className="text-amber-600" size={24} />
            <h2 className="text-xl font-semibold text-gray-900">Pots</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {summary.pots.map((portfolio) => (
              <PortfolioCard
                key={portfolio.id}
                portfolio={portfolio}
                onEdit={() => openEditModal(portfolio)}
                onUpdateValue={() => openUpdateModal(portfolio)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {summary && summary.investments.length === 0 && summary.savings.length === 0 && summary.pots.length === 0 && (
        <div className="card text-center py-12">
          <Briefcase size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500 mb-4">No portfolios tracked yet</p>
          <button onClick={() => setShowModal(true)} className="btn-primary">
            Add your first portfolio
          </button>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">
                  {editingPortfolio ? 'Edit Portfolio' : 'Add Portfolio'}
                </h2>
                <button onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label">Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                    className="input"
                    placeholder="e.g., Portfolio 1 - ISA"
                    required
                  />
                </div>

                {!editingPortfolio && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="label">Type</label>
                        <select
                          value={formData.portfolio_type}
                          onChange={(e) => setFormData((p) => ({ ...p, portfolio_type: e.target.value }))}
                          className="input"
                        >
                          {PORTFOLIO_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="label">Risk Level</label>
                        <select
                          value={formData.risk_level}
                          onChange={(e) => setFormData((p) => ({ ...p, risk_level: e.target.value }))}
                          className="input"
                        >
                          {RISK_LEVELS.map((r) => (
                            <option key={r.value} value={r.value}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="label">Provider (optional)</label>
                      <input
                        type="text"
                        value={formData.provider}
                        onChange={(e) => setFormData((p) => ({ ...p, provider: e.target.value }))}
                        className="input"
                        placeholder="e.g., Nutmeg, Vanguard, Lloyds"
                      />
                    </div>

                    <div>
                      <label className="label">Owner Name (optional)</label>
                      <input
                        type="text"
                        value={formData.owner_name}
                        onChange={(e) => setFormData((p) => ({ ...p, owner_name: e.target.value }))}
                        className="input"
                        placeholder="e.g., Nishant, Kiaan, Krati"
                      />
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

                    <div>
                      <label className="label">Initial Value (£)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.initial_value}
                        onChange={(e) => setFormData((p) => ({ ...p, initial_value: e.target.value }))}
                        className="input"
                        placeholder="0.00"
                        required
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="label">Current Value (£)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.current_value}
                    onChange={(e) => setFormData((p) => ({ ...p, current_value: e.target.value }))}
                    className="input"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="label">Year Start Value (£) - for YTD calculation</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.year_start_value}
                    onChange={(e) => setFormData((p) => ({ ...p, year_start_value: e.target.value }))}
                    className="input"
                    placeholder="Value at Jan 1st"
                  />
                </div>

                <div>
                  <label className="label">Notes (optional)</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))}
                    className="input"
                    rows={2}
                    placeholder="Any additional notes..."
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={closeModal} className="flex-1 btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" className="flex-1 btn-primary">
                    {editingPortfolio ? 'Update' : 'Add Portfolio'}
                  </button>
                </div>

                {editingPortfolio && (
                  <button
                    type="button"
                    onClick={() => {
                      handleDelete(editingPortfolio.id);
                      closeModal();
                    }}
                    className="w-full text-red-600 hover:text-red-700 text-sm mt-2"
                  >
                    Delete this portfolio
                  </button>
                )}
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Quick Update Value Modal */}
      {showUpdateModal && selectedPortfolio && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Update Value</h2>
                <button
                  onClick={() => {
                    setShowUpdateModal(false);
                    setSelectedPortfolio(null);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X size={20} />
                </button>
              </div>

              <p className="text-gray-600 mb-4">{selectedPortfolio.name}</p>

              <div className="mb-6">
                <label className="label">New Value (£)</label>
                <input
                  type="number"
                  step="0.01"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  className="input text-2xl font-bold text-center"
                  autoFocus
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowUpdateModal(false);
                    setSelectedPortfolio(null);
                  }}
                  className="flex-1 btn-secondary"
                >
                  Cancel
                </button>
                <button onClick={handleUpdateValue} className="flex-1 btn-primary">
                  Update
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
