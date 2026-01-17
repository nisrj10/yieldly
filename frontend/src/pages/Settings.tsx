import { useEffect, useState } from 'react';
import { financeApi, authApi } from '../api/client';
import type { Account, Category, Household, HouseholdInvitation } from '../types';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../utils/format';
import {
  Plus,
  X,
  Wallet,
  Tag,
  Users,
  Mail,
  Check,
  Clock,
  Copy,
  UserPlus,
  LogOut,
} from 'lucide-react';

const ACCOUNT_TYPES = [
  { value: 'checking', label: 'Checking' },
  { value: 'savings', label: 'Savings' },
  { value: 'credit', label: 'Credit Card' },
  { value: 'cash', label: 'Cash' },
  { value: 'investment', label: 'Investment' },
];

export default function Settings() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [households, setHouseholds] = useState<Household[]>([]);
  const [invitations, setInvitations] = useState<HouseholdInvitation[]>([]);
  const [pendingInvites, setPendingInvites] = useState<HouseholdInvitation[]>([]);
  const [activeTab, setActiveTab] = useState<'accounts' | 'categories' | 'household'>('accounts');
  const [loading, setLoading] = useState(true);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [_showInviteModal, _setShowInviteModal] = useState(false);
  void _showInviteModal; void _setShowInviteModal; // Reserved for invite modal
  const [showCreateHouseholdModal, setShowCreateHouseholdModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [householdName, setHouseholdName] = useState('');
  const [inviteResult, setInviteResult] = useState<{ token: string; email: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const [accountForm, setAccountForm] = useState({
    name: '',
    type: 'checking',
    balance: '',
    currency: 'GBP',
  });

  const [categoryForm, setCategoryForm] = useState({
    name: '',
    type: 'expense',
    color: '#6366f1',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [accRes, catRes, householdRes, pendingRes] = await Promise.all([
        financeApi.getAccounts(),
        financeApi.getCategories(),
        authApi.getHouseholds(),
        authApi.getPendingInvitations(),
      ]);
      setAccounts(accRes.data);
      setCategories(catRes.data.filter((c: Category) => !c.is_default));
      setHouseholds(householdRes.data);
      setPendingInvites(pendingRes.data);

      // Load invitations for the first household
      if (householdRes.data.length > 0) {
        const invRes = await authApi.getHouseholdInvitations(householdRes.data[0].id);
        setInvitations(invRes.data);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await financeApi.createAccount({
        name: accountForm.name,
        type: accountForm.type,
        balance: parseFloat(accountForm.balance) || 0,
        currency: accountForm.currency,
      });
      setShowAccountModal(false);
      setAccountForm({ name: '', type: 'checking', balance: '', currency: 'GBP' });
      loadData();
    } catch (error) {
      console.error('Error creating account:', error);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await financeApi.createCategory({
        name: categoryForm.name,
        type: categoryForm.type,
        color: categoryForm.color,
      });
      setShowCategoryModal(false);
      setCategoryForm({ name: '', type: 'expense', color: '#6366f1' });
      loadData();
    } catch (error) {
      console.error('Error creating category:', error);
    }
  };

  const handleDeleteAccount = async (id: number) => {
    if (confirm('Are you sure? All transactions for this account will be deleted.')) {
      try {
        await financeApi.deleteAccount(id);
        loadData();
      } catch (error) {
        console.error('Error deleting account:', error);
      }
    }
  };

  const handleCreateHousehold = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await authApi.createHousehold(householdName);
      setShowCreateHouseholdModal(false);
      setHouseholdName('');
      loadData();
    } catch (error) {
      console.error('Error creating household:', error);
    }
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (households.length === 0) return;

    try {
      const res = await authApi.inviteToHousehold(households[0].id, inviteEmail);
      setInviteResult({ token: res.data.token, email: inviteEmail });
      setInviteEmail('');
      loadData();
    } catch (error) {
      console.error('Error sending invite:', error);
    }
  };

  const handleAcceptInvite = async (token: string) => {
    try {
      await authApi.acceptInvitation(token);
      loadData();
    } catch (error) {
      console.error('Error accepting invite:', error);
    }
  };

  const handleLeaveHousehold = async () => {
    if (households.length === 0) return;
    if (confirm('Are you sure you want to leave this household?')) {
      try {
        await authApi.leaveHousehold(households[0].id);
        loadData();
      } catch (error) {
        console.error('Error leaving household:', error);
      }
    }
  };

  const copyInviteLink = () => {
    if (inviteResult) {
      const link = `${window.location.origin}/accept-invite?token=${inviteResult.token}`;
      navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const currentHousehold = households[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600">Manage your accounts, categories, and household</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('accounts')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'accounts'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          <span className="flex items-center gap-2">
            <Wallet size={18} />
            Accounts
          </span>
        </button>
        <button
          onClick={() => setActiveTab('categories')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'categories'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          <span className="flex items-center gap-2">
            <Tag size={18} />
            Categories
          </span>
        </button>
        <button
          onClick={() => setActiveTab('household')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'household'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          <span className="flex items-center gap-2">
            <Users size={18} />
            Household
          </span>
        </button>
      </div>

      {/* Accounts Tab */}
      {activeTab === 'accounts' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Your Accounts</h2>
            <button onClick={() => setShowAccountModal(true)} className="btn-primary flex items-center gap-2">
              <Plus size={18} />
              Add Account
            </button>
          </div>

          {accounts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {accounts.map((account) => (
                <div key={account.id} className="card flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900">{account.name}</h3>
                    <p className="text-sm text-gray-500">
                      {ACCOUNT_TYPES.find((t) => t.value === account.type)?.label} • {account.currency}
                    </p>
                    <p className="text-lg font-semibold text-gray-900 mt-1">
                      {formatCurrency(account.balance)}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteAccount(account.id)}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="card text-center py-8">
              <p className="text-gray-500 mb-4">No accounts added yet</p>
              <button onClick={() => setShowAccountModal(true)} className="btn-primary">
                Add your first account
              </button>
            </div>
          )}
        </div>
      )}

      {/* Categories Tab */}
      {activeTab === 'categories' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Custom Categories</h2>
            <button onClick={() => setShowCategoryModal(true)} className="btn-primary flex items-center gap-2">
              <Plus size={18} />
              Add Category
            </button>
          </div>

          {categories.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {categories.map((category) => (
                <div key={category.id} className="card flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full"
                    style={{ backgroundColor: category.color }}
                  />
                  <div>
                    <h3 className="font-medium text-gray-900">{category.name}</h3>
                    <p className="text-sm text-gray-500 capitalize">{category.type}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="card text-center py-8">
              <p className="text-gray-500 mb-4">No custom categories yet</p>
              <button onClick={() => setShowCategoryModal(true)} className="btn-primary">
                Add a category
              </button>
            </div>
          )}
        </div>
      )}

      {/* Household Tab */}
      {activeTab === 'household' && (
        <div className="space-y-6">
          {/* Pending Invitations */}
          {pendingInvites.length > 0 && (
            <div className="card bg-yellow-50 border-yellow-200">
              <h3 className="font-semibold text-yellow-800 mb-3">Pending Invitations</h3>
              <div className="space-y-3">
                {pendingInvites.map((invite) => (
                  <div key={invite.id} className="flex items-center justify-between bg-white p-3 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{invite.household_name}</p>
                      <p className="text-sm text-gray-500">
                        Invited by {invite.invited_by_name} ({invite.invited_by_email})
                      </p>
                    </div>
                    <button
                      onClick={() => handleAcceptInvite(invite.token)}
                      className="btn-primary text-sm flex items-center gap-1"
                    >
                      <Check size={16} />
                      Accept
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Current Household */}
          {currentHousehold ? (
            <div className="card">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold">{currentHousehold.name}</h2>
                  <p className="text-sm text-gray-500">
                    Created by {currentHousehold.created_by.first_name}
                  </p>
                </div>
                <button
                  onClick={handleLeaveHousehold}
                  className="text-red-600 hover:text-red-700 text-sm flex items-center gap-1"
                >
                  <LogOut size={16} />
                  Leave
                </button>
              </div>

              {/* Members */}
              <div className="mb-6">
                <h3 className="font-medium text-gray-900 mb-3">Members</h3>
                <div className="space-y-2">
                  {currentHousehold.members.map((member) => (
                    <div key={member.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                        <span className="text-primary-600 font-bold">
                          {member.first_name?.[0] || member.email[0].toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {member.first_name} {member.last_name}
                          {member.id === user?.id && (
                            <span className="text-xs text-gray-500 ml-2">(You)</span>
                          )}
                        </p>
                        <p className="text-sm text-gray-500">{member.email}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pending Invitations */}
              {invitations.filter((i) => i.status === 'pending').length > 0 && (
                <div className="mb-6">
                  <h3 className="font-medium text-gray-900 mb-3">Pending Invitations</h3>
                  <div className="space-y-2">
                    {invitations
                      .filter((i) => i.status === 'pending')
                      .map((invite) => (
                        <div key={invite.id} className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg">
                          <Clock className="text-yellow-600" size={20} />
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{invite.email}</p>
                            <p className="text-sm text-gray-500">
                              Expires {new Date(invite.expires_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Invite Form */}
              <div className="border-t border-gray-200 pt-6">
                <h3 className="font-medium text-gray-900 mb-3">Invite Family Member</h3>
                <form onSubmit={handleSendInvite} className="flex gap-2">
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="Enter their email address"
                    className="input flex-1"
                    required
                  />
                  <button type="submit" className="btn-primary flex items-center gap-2">
                    <Mail size={18} />
                    Send Invite
                  </button>
                </form>

                {/* Invite Result */}
                {inviteResult && (
                  <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-green-800 mb-2">
                      Invitation sent to <strong>{inviteResult.email}</strong>
                    </p>
                    <p className="text-sm text-green-700 mb-3">
                      Share this link with them to join your household:
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={`${window.location.origin}/accept-invite?token=${inviteResult.token}`}
                        readOnly
                        className="input flex-1 text-sm bg-white"
                      />
                      <button
                        onClick={copyInviteLink}
                        className="btn-secondary flex items-center gap-1"
                      >
                        {copied ? <Check size={16} /> : <Copy size={16} />}
                        {copied ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="card text-center py-12">
              <Users className="mx-auto text-gray-400 mb-4" size={48} />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Household Yet</h3>
              <p className="text-gray-500 mb-6">
                Create a household to share finances with your partner or family members.
              </p>
              <button
                onClick={() => setShowCreateHouseholdModal(true)}
                className="btn-primary flex items-center gap-2 mx-auto"
              >
                <UserPlus size={18} />
                Create Household
              </button>
            </div>
          )}
        </div>
      )}

      {/* Add Account Modal */}
      {showAccountModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Add Account</h2>
                <button onClick={() => setShowAccountModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleCreateAccount} className="space-y-4">
                <div>
                  <label className="label">Account Name</label>
                  <input
                    type="text"
                    value={accountForm.name}
                    onChange={(e) => setAccountForm((p) => ({ ...p, name: e.target.value }))}
                    className="input"
                    placeholder="e.g., Barclays Current"
                    required
                  />
                </div>

                <div>
                  <label className="label">Account Type</label>
                  <select
                    value={accountForm.type}
                    onChange={(e) => setAccountForm((p) => ({ ...p, type: e.target.value }))}
                    className="input"
                  >
                    {ACCOUNT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label">Starting Balance</label>
                  <input
                    type="number"
                    step="0.01"
                    value={accountForm.balance}
                    onChange={(e) => setAccountForm((p) => ({ ...p, balance: e.target.value }))}
                    className="input"
                    placeholder="0.00"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setShowAccountModal(false)} className="flex-1 btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" className="flex-1 btn-primary">
                    Add Account
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Add Category Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Add Category</h2>
                <button onClick={() => setShowCategoryModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleCreateCategory} className="space-y-4">
                <div>
                  <label className="label">Category Name</label>
                  <input
                    type="text"
                    value={categoryForm.name}
                    onChange={(e) => setCategoryForm((p) => ({ ...p, name: e.target.value }))}
                    className="input"
                    placeholder="e.g., Subscriptions"
                    required
                  />
                </div>

                <div>
                  <label className="label">Type</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setCategoryForm((p) => ({ ...p, type: 'expense' }))}
                      className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                        categoryForm.type === 'expense'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      Expense
                    </button>
                    <button
                      type="button"
                      onClick={() => setCategoryForm((p) => ({ ...p, type: 'income' }))}
                      className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                        categoryForm.type === 'income'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      Income
                    </button>
                  </div>
                </div>

                <div>
                  <label className="label">Color</label>
                  <input
                    type="color"
                    value={categoryForm.color}
                    onChange={(e) => setCategoryForm((p) => ({ ...p, color: e.target.value }))}
                    className="w-full h-10 rounded-lg cursor-pointer"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setShowCategoryModal(false)} className="flex-1 btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" className="flex-1 btn-primary">
                    Add Category
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Create Household Modal */}
      {showCreateHouseholdModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Create Household</h2>
                <button onClick={() => setShowCreateHouseholdModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleCreateHousehold} className="space-y-4">
                <div>
                  <label className="label">Household Name</label>
                  <input
                    type="text"
                    value={householdName}
                    onChange={(e) => setHouseholdName(e.target.value)}
                    className="input"
                    placeholder="e.g., The Raj Family"
                    required
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setShowCreateHouseholdModal(false)} className="flex-1 btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" className="flex-1 btn-primary">
                    Create Household
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
