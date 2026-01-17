import { FileText, Calendar, Bot, TrendingUp, PiggyBank, AlertCircle, CheckCircle2, Car } from 'lucide-react';

interface Report {
  id: string;
  title: string;
  date: string;
  author: string;
  type: 'budget-analysis' | 'monthly-review' | 'investment-report';
}

const reports: Report[] = [
  {
    id: 'budget-analysis-2026-01-17',
    title: 'Budget & Financial Health Analysis',
    date: '2026-01-17',
    author: 'Claude (AI Assistant)',
    type: 'budget-analysis',
  },
];

export default function Reports() {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-500 mt-1">AI-generated financial insights and analysis</p>
        </div>
      </div>

      {/* Reports Grid */}
      <div className="grid gap-4">
        {reports.map((report) => (
          <a
            key={report.id}
            href={`#${report.id}`}
            className="card hover:shadow-lg transition-shadow cursor-pointer"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
                <FileText className="text-white" size={24} />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">{report.title}</h3>
                <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <Calendar size={14} />
                    {formatDate(report.date)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Bot size={14} />
                    {report.author}
                  </span>
                </div>
              </div>
              <span className="text-xs bg-violet-100 text-violet-700 px-2 py-1 rounded-full">
                Budget Analysis
              </span>
            </div>
          </a>
        ))}
      </div>

      {/* Budget Analysis Report Content */}
      <div id="budget-analysis-2026-01-17" className="space-y-6">
        {/* Report Header */}
        <div className="card bg-gradient-to-r from-violet-500 to-purple-600 text-white">
          <div className="flex items-center gap-3 mb-2">
            <Bot size={24} />
            <span className="text-violet-200 text-sm">AI-Generated Report</span>
          </div>
          <h2 className="text-2xl font-bold">Budget & Financial Health Analysis</h2>
          <p className="text-violet-200 mt-2">
            Generated on {formatDate('2026-01-17')} by Claude (AI Assistant)
          </p>
        </div>

        {/* Income Summary */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp className="text-green-500" size={20} />
            Income Summary
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 text-gray-500 font-medium">Source</th>
                  <th className="text-right py-2 text-gray-500 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="py-3">Nishant's Salary</td>
                  <td className="py-3 text-right font-medium">£4,600/month</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-3">Krati's Contribution</td>
                  <td className="py-3 text-right font-medium">£1,300/month</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="py-3 font-semibold">Total Available</td>
                  <td className="py-3 text-right font-bold text-green-600">£5,900/month</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Expense Breakdown */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Expense Breakdown</h3>

          {/* Fixed Essentials */}
          <div className="mb-6">
            <h4 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
              <span className="w-3 h-3 bg-red-500 rounded-full"></span>
              Fixed Essentials: £2,556
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Mortgage', amount: '£1,205' },
                { label: 'Life Insurance', amount: '£157' },
                { label: 'Council Tax', amount: '£274' },
                { label: 'Gas & Electric', amount: '£161' },
                { label: 'Water', amount: '£44' },
                { label: 'House Work', amount: '£200' },
                { label: 'India Property', amount: '£450' },
                { label: 'Grocery', amount: '£350' },
              ].map((item) => (
                <div key={item.label} className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">{item.label}</p>
                  <p className="font-semibold text-gray-900">{item.amount}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Transport */}
          <div className="mb-6">
            <h4 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
              <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
              Transport: £425
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full ml-2">
                <Car size={12} className="inline mr-1" />
                Work Benefit
              </span>
            </h4>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Car Lease', amount: '£305' },
                { label: 'Car Insurance', amount: '£60' },
                { label: 'Car Fuel', amount: '£60' },
              ].map((item) => (
                <div key={item.label} className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">{item.label}</p>
                  <p className="font-semibold text-gray-900">{item.amount}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2 italic">
              * Car costs are added to salary by employer - effectively cost-neutral
            </p>
          </div>

          {/* Childcare */}
          <div className="mb-6">
            <h4 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
              <span className="w-3 h-3 bg-purple-500 rounded-full"></span>
              Childcare/Kiaan: £200
            </h4>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Monthly Misc', amount: '£72.50' },
                { label: 'Swimming', amount: '£27.50' },
                { label: 'After School Club', amount: '£100' },
              ].map((item) => (
                <div key={item.label} className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">{item.label}</p>
                  <p className="font-semibold text-gray-900">{item.amount}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Subscriptions */}
          <div className="mb-6">
            <h4 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
              <span className="w-3 h-3 bg-orange-500 rounded-full"></span>
              Subscriptions: £90
            </h4>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              {[
                { label: 'Sky', amount: '£49' },
                { label: 'Netflix', amount: '£13' },
                { label: 'Amazon Prime', amount: '£9' },
                { label: 'Prime Video', amount: '£3' },
                { label: 'Disney+', amount: '£6' },
                { label: 'Crunchyroll', amount: '£5' },
              ].map((item) => (
                <div key={item.label} className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">{item.label}</p>
                  <p className="font-semibold text-gray-900">{item.amount}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Personal */}
          <div>
            <h4 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
              <span className="w-3 h-3 bg-cyan-500 rounded-full"></span>
              Personal (Nishant): £190
            </h4>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Personal Allowance', amount: '£129' },
                { label: 'Village Gym', amount: '£61' },
              ].map((item) => (
                <div key={item.label} className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">{item.label}</p>
                  <p className="font-semibold text-gray-900">{item.amount}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Savings & Investments */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <PiggyBank className="text-green-500" size={20} />
            Savings & Investments: £2,150/month
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 text-gray-500 font-medium">Category</th>
                  <th className="text-right py-2 text-gray-500 font-medium">Amount</th>
                  <th className="text-left py-2 text-gray-500 font-medium pl-4">Purpose</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { category: 'Moneyfarm (Us)', amount: '£700', purpose: 'Long-term wealth' },
                  { category: "Nishant's Personal Savings", amount: '£500', purpose: 'Your buffer' },
                  { category: 'Annual Holiday', amount: '£400', purpose: 'Family holidays' },
                  { category: 'Moneyfarm Kiaan JISA', amount: '£300', purpose: "Kiaan's future" },
                  { category: 'Emergency Fund Top-up', amount: '£250', purpose: 'Safety net' },
                ].map((item) => (
                  <tr key={item.category} className="border-b border-gray-100">
                    <td className="py-3">{item.category}</td>
                    <td className="py-3 text-right font-medium text-green-600">{item.amount}</td>
                    <td className="py-3 pl-4 text-gray-500">{item.purpose}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Assessment */}
        <div className="card border-2 border-green-200 bg-green-50">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <CheckCircle2 className="text-green-500" size={20} />
            Assessment: You're Doing Better Than You Think
          </h3>

          <div className="space-y-4">
            <div className="bg-white rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-700">Savings Rate</span>
                <span className="text-2xl font-bold text-green-600">~36%</span>
              </div>
              <p className="text-sm text-gray-500">
                You're saving £2,150 of £5,900. The commonly recommended target is 15-20%.
                You're nearly double that.
              </p>
              <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full" style={{ width: '36%' }}></div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-700">Emergency Fund Progress</span>
                <span className="text-2xl font-bold text-green-600">94%</span>
              </div>
              <p className="text-sm text-gray-500">
                You have £22,500 of your £24,000 target. You're essentially there -
                that's ~4-5 months of expenses covered.
              </p>
              <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full" style={{ width: '94%' }}></div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-700">Personal Spending</span>
                <span className="text-2xl font-bold text-blue-600">~3.2%</span>
              </div>
              <p className="text-sm text-gray-500">
                Your £190/month personal allowance (including gym) is roughly 3.2% of household income.
                Most financial planners suggest 5-10% is healthy.
              </p>
            </div>
          </div>
        </div>

        {/* Personal Allowance Section */}
        <div className="card border-2 border-blue-200 bg-blue-50">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <AlertCircle className="text-blue-500" size={20} />
            About Your Personal Allowance
          </h3>
          <p className="text-gray-700 mb-4">
            You've budgeted <strong>£129/month</strong> for personal spending (eating out, driving range, activities)
            plus £61 for gym = <strong>£190/month total</strong>.
          </p>
          <div className="bg-white rounded-lg p-4">
            <p className="text-gray-700">
              <strong>You should NOT feel guilty about this.</strong> You're:
            </p>
            <ul className="mt-3 space-y-2 text-gray-600">
              <li className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-green-500" />
                Supporting a family
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-green-500" />
                Paying a mortgage
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-green-500" />
                Investing in India property
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-green-500" />
                Saving for Kiaan's future
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-green-500" />
                Building emergency reserves
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-green-500" />
                Investing for retirement
              </li>
            </ul>
            <p className="mt-4 text-gray-700 font-medium">
              Taking £129 to enjoy life is not excessive - it's necessary for mental health.
            </p>
          </div>
        </div>

        {/* Split Analysis */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Are Your Splits Correct?</h3>
          <p className="text-gray-700 mb-4">Looking at your split configuration:</p>
          <ul className="space-y-2 text-gray-600 mb-4">
            <li className="flex items-start gap-2">
              <span className="text-primary-600 mt-1">•</span>
              Most fixed costs (mortgage, council tax, car) = 100% on you
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-600 mt-1">•</span>
              Utilities, Netflix, childcare activities = 50/50 shared
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-600 mt-1">•</span>
              Krati contributes £1,300 + handles her own India investment (£300)
            </li>
          </ul>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-gray-700">
              This seems like a <strong>reasonable arrangement</strong> where you carry the larger fixed obligations
              and share variable costs. The split appears proportionate if your income is significantly higher
              than Krati's take-home.
            </p>
          </div>
        </div>

        {/* Bottom Line */}
        <div className="card bg-gradient-to-r from-green-500 to-emerald-600 text-white">
          <h3 className="text-xl font-bold mb-4">Bottom Line</h3>
          <p className="text-green-100 mb-4">
            <strong className="text-white">You are doing enough.</strong> In fact, you're doing more than most.
          </p>
          <p className="text-green-100 mb-4">
            The anxiety you're feeling isn't warranted by the numbers - it's likely driven by:
          </p>
          <ul className="space-y-2 text-green-100 mb-4">
            <li>• The visible outflow of money each month (even if it's going to good places like investments)</li>
            <li>• Managing multiple financial commitments (UK + India)</li>
            <li>• The responsibility of providing for a family</li>
          </ul>
          <p className="text-white font-medium">
            Your budget shows someone who is methodical, disciplined, and forward-thinking.
            The personal allowance of £129 is not indulgent - it's modest.
            If anything, you could justify slightly more without impacting your financial trajectory.
          </p>
          <p className="mt-4 text-xl font-bold">
            Take a breath. The numbers say you're on track.
          </p>
        </div>
      </div>
    </div>
  );
}
