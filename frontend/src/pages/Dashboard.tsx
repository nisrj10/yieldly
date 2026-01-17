import { useEffect, useState } from 'react';
import { financeApi } from '../api/client';
import { formatCurrency } from '../utils/format';
import {
  Shield,
  TrendingUp,
  CheckCircle,
  AlertTriangle,
  CreditCard,
  Users,
  User,
  Sparkles,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react';

interface PortfolioSummary {
  total_net_worth: number;
  my_net_worth: number;
  kiaan_net_worth: number;
  total_investments: number;
  total_savings: number;
  total_pots: number;
  investments: Array<{
    id: number;
    name: string;
    current_value: number;
    total_gain_loss_percent: number;
    ytd_gain_loss_percent: number;
  }>;
  savings: Array<{
    id: number;
    name: string;
    current_value: number;
  }>;
  pots: Array<{
    id: number;
    name: string;
    current_value: number;
  }>;
}

interface BudgetLineItem {
  id: number;
  name: string;
  amount: number;
  category_type: 'expense' | 'saving' | 'income';
  group: string;
}

interface HouseBudget {
  id: number;
  name: string;
  month: number;
  year: number;
  is_template: boolean;
  total_income: number;
  total_expenses: number;
  total_savings: number;
  remaining: number;
  line_items: BudgetLineItem[];
}

export default function Dashboard() {
  const [portfolioSummary, setPortfolioSummary] = useState<PortfolioSummary | null>(null);
  const [houseBudget, setHouseBudget] = useState<HouseBudget | null>(null);
  const [loading, setLoading] = useState(true);
  const [showExpenseBreakdown, setShowExpenseBreakdown] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [portfolioRes, budgetRes] = await Promise.all([
          financeApi.getPortfolioSummary(),
          financeApi.getHouseBudgets(),
        ]);
        setPortfolioSummary(portfolioRes.data);
        // Get the template budget which has line items defined
        const budgets = budgetRes.data.results || budgetRes.data;
        if (budgets.length > 0) {
          // The list endpoint already returns line_items, so use it directly
          const template = budgets.find((b: HouseBudget) => b.is_template) || budgets[0];
          setHouseBudget(template);
        }
      } catch (error) {
        console.error('Error loading dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // Calculate key metrics
  const emergencyFund = portfolioSummary?.savings.reduce((sum, s) =>
    s.name.toLowerCase().includes('emergency') ? sum + Number(s.current_value) : sum, 0) || 0;

  // Essential expenses for emergency fund calculation (housing, utilities, food, transport, childcare, property)
  const essentialGroups = ['Housing', 'Living', 'Transport', "Kiaan's Childcare", 'Property'];
  const essentialExpenses = (houseBudget?.line_items || []).filter(i =>
    i.category_type === 'expense' && essentialGroups.includes(i.group)
  );
  const monthlyExpenses = essentialExpenses.reduce((s, i) => s + Number(i.amount), 0) || 3000; // Fallback estimate
  const monthsOfEmergency = monthlyExpenses > 0 ? emergencyFund / monthlyExpenses : 0;
  const emergencyTarget = 6; // 6 months target
  const emergencyHealthy = monthsOfEmergency >= 3;

  // Investment performance
  const totalInvestments = portfolioSummary?.total_investments || 0;
  const mainISA = portfolioSummary?.investments.find(i => i.name.toLowerCase().includes('isa') && !i.name.toLowerCase().includes('jisa'));
  const ytdReturn = Number(mainISA?.ytd_gain_loss_percent) || 0;
  const allTimeReturn = Number(mainISA?.total_gain_loss_percent) || 0;

  // Shares total (eToro + Freetrade)
  const sharesAccounts = portfolioSummary?.investments.filter(i =>
    i.name.toLowerCase().includes('shares') || i.name.toLowerCase().includes('etoro') || i.name.toLowerCase().includes('freetrade')
  ) || [];
  const sharesTotal = sharesAccounts.reduce((sum, acc) => sum + Number(acc.current_value), 0);
  const isaValue = Number(mainISA?.current_value) || 0;

  // Overall financial health
  const healthChecks = [
    emergencyHealthy,
    totalInvestments > 30000,
  ];
  const healthScore = healthChecks.filter(Boolean).length;
  const overallHealthy = healthScore >= 1;

  // Monzo funding (fixed amounts as discussed)
  const monzoFunding = 450 + 200 + 350 + 150 + 400; // Lko + Kiaan + Grocery + Personal + Holiday
  const houseExpenses = 100; // Approximate
  const totalMonzoFunding = monzoFunding + houseExpenses;

  // Get current date info
  const now = new Date();
  const currentMonth = now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate();
  const daysRemaining = daysInMonth - dayOfMonth;

  return (
    <div className="space-y-6">
      {/* Header with Status */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Financial Command Centre</h1>
          <p className="text-gray-600">{currentMonth} • {daysRemaining} days remaining</p>
        </div>

        {/* Overall Health Indicator */}
        <div className={`flex items-center gap-3 px-6 py-3 rounded-xl ${
          overallHealthy
            ? 'bg-gradient-to-r from-green-500 to-emerald-500'
            : 'bg-gradient-to-r from-amber-500 to-orange-500'
        } text-white shadow-lg`}>
          {overallHealthy ? <CheckCircle size={24} /> : <AlertTriangle size={24} />}
          <div>
            <p className="font-bold">{overallHealthy ? 'On Track' : 'Needs Attention'}</p>
            <p className="text-sm opacity-90">{healthScore}/2 health checks passed</p>
          </div>
        </div>
      </div>

      {/* Net Worth Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card bg-gradient-to-br from-slate-900 to-slate-800 text-white">
          <div className="flex items-center gap-3 mb-2">
            <User size={20} className="text-blue-400" />
            <span className="text-sm text-gray-300">My Net Worth</span>
          </div>
          <p className="text-3xl font-bold">{formatCurrency(portfolioSummary?.my_net_worth || 0)}</p>
          <p className="text-sm text-gray-400 mt-1">Excludes Kiaan's assets</p>
        </div>

        <div className="card bg-gradient-to-br from-green-600 to-emerald-600 text-white">
          <div className="flex items-center gap-3 mb-2">
            <Sparkles size={20} className="text-green-200" />
            <span className="text-sm text-green-100">Kiaan's Net Worth</span>
          </div>
          <p className="text-3xl font-bold">{formatCurrency(portfolioSummary?.kiaan_net_worth || 0)}</p>
          <p className="text-sm text-green-200 mt-1">JISA + Monthly Account</p>
        </div>

        <div className="card bg-gradient-to-br from-purple-600 to-indigo-600 text-white">
          <div className="flex items-center gap-3 mb-2">
            <Users size={20} className="text-purple-200" />
            <span className="text-sm text-purple-100">Family Total</span>
          </div>
          <p className="text-3xl font-bold">{formatCurrency(portfolioSummary?.total_net_worth || 0)}</p>
          <p className="text-sm text-purple-200 mt-1">Combined wealth</p>
        </div>
      </div>

      {/* Key Health Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Emergency Fund */}
        <div className="card border-2 border-blue-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Shield className="text-blue-500" size={20} />
              <span className="font-medium text-gray-700">Emergency Fund</span>
            </div>
            {emergencyHealthy ? (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">Healthy</span>
            ) : (
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full">Building</span>
            )}
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(emergencyFund)}</p>
          <div className="mt-2">
            <div className="flex justify-between text-sm text-gray-500 mb-1">
              <span>{monthsOfEmergency.toFixed(1)} months covered</span>
              <span>Target: {emergencyTarget} months</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${monthsOfEmergency >= emergencyTarget ? 'bg-green-500' : monthsOfEmergency >= 3 ? 'bg-blue-500' : 'bg-amber-500'}`}
                style={{ width: `${Math.min((monthsOfEmergency / emergencyTarget) * 100, 100)}%` }}
              />
            </div>
          </div>
          <button
            onClick={() => setShowExpenseBreakdown(true)}
            className="mt-3 pt-3 border-t border-blue-100 w-full text-left hover:bg-blue-50 -mx-1 px-1 rounded transition-colors"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">Based on monthly expenses:</p>
              <ChevronDown size={14} className="text-gray-400" />
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-gray-600">Essential Expenses</span>
              <span className="font-medium text-blue-600">{formatCurrency(monthlyExpenses)}/mo</span>
            </div>
            <p className="text-xs text-blue-500 mt-1">Click to see breakdown →</p>
          </button>
        </div>

        {/* Investment Performance */}
        <div className="card border-2 border-purple-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="text-purple-500" size={20} />
              <span className="font-medium text-gray-700">Investments</span>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full ${ytdReturn >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {ytdReturn >= 0 ? '+' : ''}{ytdReturn.toFixed(1)}% YTD
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalInvestments)}</p>
          <div className="mt-3 pt-3 border-t border-purple-100 grid grid-cols-2 gap-3">
            <div className="bg-purple-50 rounded-lg p-2 text-center">
              <p className="text-xs text-gray-500">ISA</p>
              <p className="font-bold text-purple-700">{formatCurrency(isaValue)}</p>
            </div>
            <div className="bg-green-50 rounded-lg p-2 text-center">
              <p className="text-xs text-gray-500">Shares</p>
              <p className="font-bold text-green-700">{formatCurrency(sharesTotal)}</p>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1">
              <span className="text-gray-500">All-time:</span>
              <span className={allTimeReturn >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                {allTimeReturn >= 0 ? '+' : ''}{allTimeReturn.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Action Cards Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monzo Funding Required */}
        <div className="card bg-gradient-to-br from-pink-50 to-white border-2 border-pink-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-rose-500 rounded-xl flex items-center justify-center">
              <CreditCard className="text-white" size={24} />
            </div>
            <div>
              <h3 className="font-bold text-lg text-gray-900">Monthly Monzo Funding</h3>
              <p className="text-sm text-gray-500">Transfer this amount to Monzo</p>
            </div>
            <div className="ml-auto">
              <p className="text-2xl font-bold text-pink-600">{formatCurrency(totalMonzoFunding)}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-white rounded-lg p-3 border border-pink-100">
              <p className="text-xs text-gray-500">Lko Property</p>
              <p className="font-bold text-pink-600">£450</p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-pink-100">
              <p className="text-xs text-gray-500">Kiaan</p>
              <p className="font-bold text-pink-600">£200</p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-pink-100">
              <p className="text-xs text-gray-500">Grocery</p>
              <p className="font-bold text-pink-600">£350</p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-pink-100">
              <p className="text-xs text-gray-500">Personal</p>
              <p className="font-bold text-pink-600">£150</p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-pink-100">
              <p className="text-xs text-gray-500">Holiday</p>
              <p className="font-bold text-pink-600">£400</p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-pink-100">
              <p className="text-xs text-gray-500">House</p>
              <p className="font-bold text-pink-600">£{houseExpenses}</p>
            </div>
          </div>
        </div>

        {/* Quick Insights */}
        <div className="card">
          <h3 className="font-bold text-lg text-gray-900 mb-4 flex items-center gap-2">
            <Sparkles className="text-amber-500" size={20} />
            Financial Pulse
          </h3>

          <div className="space-y-3">
            {/* Insight 1: Emergency Fund */}
            <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
              <Shield className="text-blue-500 mt-0.5" size={18} />
              <div>
                <p className="font-medium text-gray-900">Emergency Fund Status</p>
                <p className="text-sm text-gray-600">
                  {monthsOfEmergency >= 6
                    ? "You're fully protected with 6+ months of expenses covered."
                    : monthsOfEmergency >= 3
                    ? `Good progress! ${(emergencyTarget - monthsOfEmergency).toFixed(1)} more months to reach your 6-month target.`
                    : `Priority: Build up to 3 months minimum. Currently at ${monthsOfEmergency.toFixed(1)} months.`}
                </p>
              </div>
            </div>

            {/* Insight 2: Investments */}
            <div className="flex items-start gap-3 p-3 bg-purple-50 rounded-lg">
              <TrendingUp className="text-purple-500 mt-0.5" size={18} />
              <div>
                <p className="font-medium text-gray-900">Investment Growth</p>
                <p className="text-sm text-gray-600">
                  {allTimeReturn >= 20
                    ? `Excellent! Your investments have grown ${allTimeReturn.toFixed(0)}% since you started.`
                    : `Your portfolio is up ${allTimeReturn.toFixed(1)}% overall. Stay the course!`}
                </p>
              </div>
            </div>

            {/* Insight 3: Kiaan's Future */}
            <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
              <Sparkles className="text-green-500 mt-0.5" size={18} />
              <div>
                <p className="font-medium text-gray-900">Kiaan's Future</p>
                <p className="text-sm text-gray-600">
                  His JISA is growing well at {formatCurrency(portfolioSummary?.kiaan_net_worth || 0)}.
                  Keep contributing for a great head start!
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Portfolio Breakdown */}
      <div className="card">
        <h3 className="font-bold text-lg text-gray-900 mb-4">Where Your Money Lives</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {portfolioSummary?.investments.map(inv => {
            const ytd = Number(inv.ytd_gain_loss_percent) || 0;
            return (
              <div key={inv.id} className="bg-purple-50 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-500 mb-1 truncate">{inv.name}</p>
                <p className="font-bold text-purple-700">{formatCurrency(inv.current_value)}</p>
                <p className={`text-xs mt-1 ${ytd >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {ytd >= 0 ? '↑' : '↓'} {Math.abs(ytd).toFixed(1)}% YTD
                </p>
              </div>
            );
          })}
          {portfolioSummary?.savings.map(sav => (
            <div key={sav.id} className="bg-blue-50 rounded-xl p-4 text-center">
              <p className="text-xs text-gray-500 mb-1 truncate">{sav.name}</p>
              <p className="font-bold text-blue-700">{formatCurrency(sav.current_value)}</p>
              <p className="text-xs text-gray-400 mt-1">Savings</p>
            </div>
          ))}
          {portfolioSummary?.pots.map(pot => (
            <div key={pot.id} className="bg-amber-50 rounded-xl p-4 text-center">
              <p className="text-xs text-gray-500 mb-1 truncate">{pot.name}</p>
              <p className="font-bold text-amber-700">{formatCurrency(pot.current_value)}</p>
              <p className="text-xs text-gray-400 mt-1">Pot</p>
            </div>
          ))}
        </div>
      </div>

      {/* Expense Breakdown Modal */}
      {showExpenseBreakdown && (() => {
        // Essential expenses for emergency fund (housing, utilities, food, transport, childcare, property)
        const essentialGroups = ['Housing', 'Living', 'Transport', "Kiaan's Childcare", 'Property'];
        const lineItems = houseBudget?.line_items || [];
        const essentialExpenses = lineItems.filter(i =>
          i.category_type === 'expense' && essentialGroups.includes(i.group)
        );
        const essentialTotal = essentialExpenses.reduce((s, i) => s + Number(i.amount), 0);

        // Non-essential expenses (excluded from emergency calculation)
        const nonEssentialExpenses = lineItems.filter(i =>
          i.category_type === 'expense' && !essentialGroups.includes(i.group)
        );
        const nonEssentialTotal = nonEssentialExpenses.reduce((s, i) => s + Number(i.amount), 0);

        // Emergency fund sources
        const emergencySources = portfolioSummary?.savings.filter(s =>
          s.name.toLowerCase().includes('emergency')
        ) || [];

        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-bold">Emergency Fund Calculation</h2>
                    <p className="text-sm text-gray-500">How your emergency coverage is calculated</p>
                  </div>
                  <button onClick={() => setShowExpenseBreakdown(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                    <X size={20} />
                  </button>
                </div>

                {/* Fund Sources */}
                <div className="mb-6 p-4 bg-blue-50 rounded-xl">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Shield className="text-blue-500" size={18} />
                    Emergency Fund Sources
                  </h3>
                  <div className="space-y-2">
                    {emergencySources.map(s => (
                      <div key={s.id} className="flex justify-between text-sm">
                        <span>{s.name}</span>
                        <span className="font-medium">{formatCurrency(Number(s.current_value))}</span>
                      </div>
                    ))}
                    <div className="flex justify-between font-bold pt-2 border-t border-blue-200">
                      <span>Total Emergency Fund</span>
                      <span className="text-blue-600">{formatCurrency(emergencyFund)}</span>
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  {/* Essential Expenses - INCLUDED */}
                  <div className="p-4 bg-green-50 rounded-xl">
                    <h3 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
                      <CheckCircle size={18} />
                      Essential (Included)
                    </h3>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {essentialExpenses.length > 0 ? essentialExpenses.map(item => (
                        <div key={item.id} className="flex justify-between text-sm">
                          <span className="text-gray-700">{item.name}</span>
                          <span className="font-medium">{formatCurrency(Number(item.amount))}</span>
                        </div>
                      )) : (
                        <p className="text-sm text-gray-500 italic">No items in essential categories</p>
                      )}
                    </div>
                    <div className="flex justify-between font-bold pt-3 mt-3 border-t border-green-200">
                      <span>Essential Total</span>
                      <span className="text-green-700">{formatCurrency(essentialTotal)}/mo</span>
                    </div>
                  </div>

                  {/* Non-Essential Expenses - EXCLUDED */}
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <h3 className="font-semibold text-gray-600 mb-3 flex items-center gap-2">
                      <X size={18} />
                      Non-Essential (Excluded)
                    </h3>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {nonEssentialExpenses.length > 0 ? nonEssentialExpenses.map(item => (
                        <div key={item.id} className="flex justify-between text-sm text-gray-500">
                          <span>{item.name}</span>
                          <span>{formatCurrency(Number(item.amount))}</span>
                        </div>
                      )) : (
                        <p className="text-sm text-gray-400 italic">No non-essential expenses</p>
                      )}
                    </div>
                    <div className="flex justify-between font-medium pt-3 mt-3 border-t border-gray-200 text-gray-500">
                      <span>Non-Essential Total</span>
                      <span>{formatCurrency(nonEssentialTotal)}/mo</span>
                    </div>
                  </div>
                </div>

                {/* Calculation Summary */}
                <div className="mt-6 p-4 bg-slate-900 rounded-xl text-white">
                  <h3 className="font-semibold mb-3">Calculation</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-300">Emergency Fund</span>
                      <span>{formatCurrency(emergencyFund)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">÷ Essential Monthly Expenses</span>
                      <span>{formatCurrency(essentialTotal)}</span>
                    </div>
                    <div className="flex justify-between font-bold pt-2 border-t border-gray-700 text-lg">
                      <span>= Months Covered</span>
                      <span className="text-green-400">{essentialTotal > 0 ? (emergencyFund / essentialTotal).toFixed(1) : '0'} months</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setShowExpenseBreakdown(false)}
                  className="w-full mt-4 btn-primary"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
