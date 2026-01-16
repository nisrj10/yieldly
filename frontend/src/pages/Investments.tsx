import { useEffect, useState } from 'react';
import { financeApi } from '../api/client';
import type { Investment } from '../types';
import { formatCurrency, formatPercent } from '../utils/format';
import { Plus, X, TrendingUp, TrendingDown, Edit2 } from 'lucide-react';

const INVESTMENT_TYPES = [
  { value: 'stock', label: 'Stock' },
  { value: 'etf', label: 'ETF' },
  { value: 'mutual_fund', label: 'Mutual Fund' },
  { value: 'bond', label: 'Bond' },
  { value: 'crypto', label: 'Cryptocurrency' },
  { value: 'real_estate', label: 'Real Estate' },
  { value: 'other', label: 'Other' },
];

export default function Investments() {
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    symbol: '',
    type: 'stock',
    quantity: '',
    purchase_price: '',
    current_price: '',
    purchase_date: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const res = await financeApi.getInvestments();
      // Handle paginated response
      setInvestments(res.data.results || res.data);
    } catch (error) {
      console.error('Error loading investments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await financeApi.updateInvestment(editingId, {
          current_price: parseFloat(formData.current_price) || undefined,
        });
      } else {
        await financeApi.createInvestment({
          name: formData.name,
          symbol: formData.symbol,
          type: formData.type,
          quantity: parseFloat(formData.quantity),
          purchase_price: parseFloat(formData.purchase_price),
          current_price: formData.current_price ? parseFloat(formData.current_price) : undefined,
          purchase_date: formData.purchase_date,
        });
      }
      closeModal();
      loadData();
    } catch (error) {
      console.error('Error saving investment:', error);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this investment?')) {
      try {
        await financeApi.deleteInvestment(id);
        loadData();
      } catch (error) {
        console.error('Error deleting investment:', error);
      }
    }
  };

  const openEditModal = (investment: Investment) => {
    setEditingId(investment.id);
    setFormData({
      name: investment.name,
      symbol: investment.symbol,
      type: investment.type,
      quantity: String(investment.quantity),
      purchase_price: String(investment.purchase_price),
      current_price: investment.current_price ? String(investment.current_price) : '',
      purchase_date: investment.purchase_date,
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setFormData({
      name: '',
      symbol: '',
      type: 'stock',
      quantity: '',
      purchase_price: '',
      current_price: '',
      purchase_date: new Date().toISOString().split('T')[0],
    });
  };

  // Calculate totals
  const totalInvested = investments.reduce((sum, inv) => sum + Number(inv.total_invested), 0);
  const totalValue = investments.reduce((sum, inv) => sum + Number(inv.current_value), 0);
  const totalGainLoss = totalValue - totalInvested;
  const totalGainLossPercent = totalInvested > 0 ? (totalGainLoss / totalInvested) * 100 : 0;

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
          <h1 className="text-2xl font-bold text-gray-900">Investments</h1>
          <p className="text-gray-600">Track your investment portfolio</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
          <Plus size={20} />
          Add Investment
        </button>
      </div>

      {/* Portfolio Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card">
          <p className="text-sm text-gray-600">Total Invested</p>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalInvested)}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-600">Current Value</p>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalValue)}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-600">Total Return</p>
          <div className="flex items-center gap-2">
            <p className={`text-2xl font-bold ${totalGainLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(totalGainLoss)}
            </p>
            <span className={`text-sm ${totalGainLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ({formatPercent(totalGainLossPercent)})
            </span>
          </div>
        </div>
      </div>

      {/* Investments List */}
      {investments.length > 0 ? (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Investment</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600">Quantity</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600">Avg Cost</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600">Current</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600">Value</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600">Return</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {investments.map((inv) => (
                  <tr key={inv.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-4 px-4">
                      <div>
                        <p className="font-medium text-gray-900">{inv.name}</p>
                        <p className="text-sm text-gray-500">
                          {inv.symbol && `${inv.symbol} • `}
                          {INVESTMENT_TYPES.find((t) => t.value === inv.type)?.label}
                        </p>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-right">{inv.quantity}</td>
                    <td className="py-4 px-4 text-right">{formatCurrency(inv.purchase_price)}</td>
                    <td className="py-4 px-4 text-right">
                      {inv.current_price ? formatCurrency(inv.current_price) : '-'}
                    </td>
                    <td className="py-4 px-4 text-right font-medium">
                      {formatCurrency(Number(inv.current_value))}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className={`flex items-center justify-end gap-1 ${
                        Number(inv.gain_loss) >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {Number(inv.gain_loss) >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                        <span>{formatPercent(Number(inv.gain_loss_percent))}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(inv)}
                          className="p-1 text-gray-400 hover:text-primary-600"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(inv.id)}
                          className="p-1 text-gray-400 hover:text-red-500"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card text-center py-12">
          <p className="text-gray-500 mb-4">No investments tracked yet</p>
          <button onClick={() => setShowModal(true)} className="btn-primary">
            Add your first investment
          </button>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">{editingId ? 'Update Investment' : 'Add Investment'}</h2>
                <button onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {!editingId && (
                  <>
                    <div>
                      <label className="label">Name</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                        className="input"
                        placeholder="e.g., Apple Inc."
                        required
                      />
                    </div>

                    <div>
                      <label className="label">Symbol (optional)</label>
                      <input
                        type="text"
                        value={formData.symbol}
                        onChange={(e) => setFormData((p) => ({ ...p, symbol: e.target.value.toUpperCase() }))}
                        className="input"
                        placeholder="e.g., AAPL"
                      />
                    </div>

                    <div>
                      <label className="label">Type</label>
                      <select
                        value={formData.type}
                        onChange={(e) => setFormData((p) => ({ ...p, type: e.target.value }))}
                        className="input"
                      >
                        {INVESTMENT_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="label">Quantity</label>
                      <input
                        type="number"
                        step="any"
                        value={formData.quantity}
                        onChange={(e) => setFormData((p) => ({ ...p, quantity: e.target.value }))}
                        className="input"
                        placeholder="0"
                        required
                      />
                    </div>

                    <div>
                      <label className="label">Purchase Price (per unit)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.purchase_price}
                        onChange={(e) => setFormData((p) => ({ ...p, purchase_price: e.target.value }))}
                        className="input"
                        placeholder="0.00"
                        required
                      />
                    </div>

                    <div>
                      <label className="label">Purchase Date</label>
                      <input
                        type="date"
                        value={formData.purchase_date}
                        onChange={(e) => setFormData((p) => ({ ...p, purchase_date: e.target.value }))}
                        className="input"
                        required
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="label">Current Price (per unit)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.current_price}
                    onChange={(e) => setFormData((p) => ({ ...p, current_price: e.target.value }))}
                    className="input"
                    placeholder="Leave empty to use purchase price"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={closeModal} className="flex-1 btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" className="flex-1 btn-primary">
                    {editingId ? 'Update' : 'Add Investment'}
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
