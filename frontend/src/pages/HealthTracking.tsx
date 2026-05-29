import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  Bed,
  Brain,
  CheckCircle2,
  Dumbbell,
  HeartPulse,
  Moon,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';
import type { ComponentType } from 'react';

interface MetricSnapshot {
  title: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  april: string;
  may: string;
  verdict: string;
  status: 'improved' | 'watch' | 'mixed';
}

const metrics: MetricSnapshot[] = [
  {
    title: 'Sleep',
    icon: Moon,
    april:
      'Roughly 7.2-7.4 hours per night on average. Sleep performance mostly 70-80%, with a few very short nights and a couple of 10+ hour catch-ups.',
    may:
      'More short nights in the 3-6 hour range and fewer full catch-up nights. Sleep performance is more often in the 50-70% range.',
    verdict:
      'More volatility and a bit more sleep debt in May than April, despite a couple of strong recent nights.',
    status: 'watch',
  },
  {
    title: 'Recovery',
    icon: HeartPulse,
    april:
      'HRV was often in the mid-20s to low-30s, with resting heart rate frequently in the 70s early in the month. Several red days, a good cluster of yellows, and some high greens after catch-up sleep.',
    may:
      'HRV is generally slightly higher and more stable, from high-20s to mid-30s with some 40+ days. Resting heart rate is overall lower, more often in the low-60s. More mid/high greens late in the month.',
    verdict:
      'Autonomic trend is better in May, but recovery still spikes into red when sleep is crushed or stress is heavy.',
    status: 'improved',
  },
  {
    title: 'Strain',
    icon: Dumbbell,
    april:
      'Lots of moderate-to-high strain, with repeated days in the 11-17 range and many days above 14 strain. Very few genuinely easy days.',
    may:
      'Overall average strain is lower. Many days sit in the 5-10 range, with periodic high days around 12-14+.',
    verdict:
      'You backed off total load in May, which is likely helping HRV and resting heart rate despite patchy sleep.',
    status: 'improved',
  },
  {
    title: 'Stress',
    icon: Brain,
    april:
      'Several very high stress days with 3-7+ hours in high stress and long blocks of medium stress, especially in the first half of April.',
    may:
      'Still some big stress days, including May 10, 12, 14-16, 18, 21, and 25, but also more lighter or moderate days.',
    verdict:
      'Stress load is still a major driver, but it is a bit less extreme than the first half of April.',
    status: 'mixed',
  },
];

const patterns = [
  {
    title: 'Short sleep costs recovery',
    detail:
      'Nights at or below 4-5 hours line up with red or low-yellow recoveries the next morning, especially when the day still includes training, heavy walking, or high work stress.',
    icon: Bed,
  },
  {
    title: 'Catch-up sleep works, but late',
    detail:
      '8.5-10+ hour nights are almost always followed by greener recoveries and better HRV. The issue is that they usually arrive after sleep debt has already built up.',
    icon: CheckCircle2,
  },
  {
    title: 'Alternating load helps',
    detail:
      'April stacked more 14+ strain days on already-stressed days. May has more alternation with easier days, which your recovery data seems to like.',
    icon: Activity,
  },
];

const statusStyles = {
  improved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  watch: 'bg-amber-50 text-amber-700 border-amber-200',
  mixed: 'bg-sky-50 text-sky-700 border-sky-200',
};

const statusLabels = {
  improved: 'Improving',
  watch: 'Watch',
  mixed: 'Mixed',
};

export default function HealthTracking() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-600">
              <HeartPulse className="text-white" size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Health Tracking</h1>
              <p className="text-gray-600">Whoop analysis: April vs May month-to-date</p>
            </div>
          </div>
        </div>
        <div className="card border-rose-100 bg-rose-50 lg:max-w-md">
          <p className="text-sm font-semibold text-rose-900">Main lever for next month</p>
          <p className="mt-1 text-sm text-rose-800">
            Cap work-late nights at 2 per week, keep those nights at 5.5+ hours of sleep,
            and place at least one 8+ hour night within 48 hours after each.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="card border-amber-200 bg-amber-50">
          <div className="flex items-center gap-2 text-amber-700">
            <Moon size={18} />
            <span className="text-sm font-medium">Sleep</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900">More volatile</p>
          <p className="mt-1 text-sm text-gray-600">May has more 3-6 hour nights.</p>
        </div>
        <div className="card border-emerald-200 bg-emerald-50">
          <div className="flex items-center gap-2 text-emerald-700">
            <TrendingUp size={18} />
            <span className="text-sm font-medium">Recovery</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900">Better trend</p>
          <p className="mt-1 text-sm text-gray-600">HRV up a bit, RHR lower.</p>
        </div>
        <div className="card border-blue-200 bg-blue-50">
          <div className="flex items-center gap-2 text-blue-700">
            <TrendingDown size={18} />
            <span className="text-sm font-medium">Strain</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900">More controlled</p>
          <p className="mt-1 text-sm text-gray-600">Fewer stacked high-load days.</p>
        </div>
        <div className="card border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2 text-slate-700">
            <Zap size={18} />
            <span className="text-sm font-medium">Stress</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900">Still high</p>
          <p className="mt-1 text-sm text-gray-600">Less extreme, still a driver.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <section key={metric.title} className="card">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-900">
                    <Icon className="text-white" size={20} />
                  </div>
                  <h2 className="text-lg font-semibold text-gray-900">{metric.title}</h2>
                </div>
                <span className={`rounded-full border px-2 py-1 text-xs font-medium ${statusStyles[metric.status]}`}>
                  {statusLabels[metric.status]}
                </span>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-start">
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <p className="text-sm font-semibold text-gray-900">April</p>
                  <p className="mt-2 text-sm leading-6 text-gray-600">{metric.april}</p>
                </div>
                <div className="hidden pt-12 text-gray-300 md:block">
                  <ArrowRight size={22} />
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-4">
                  <p className="text-sm font-semibold text-gray-900">May so far</p>
                  <p className="mt-2 text-sm leading-6 text-gray-600">{metric.may}</p>
                </div>
              </div>

              <div className="mt-4 rounded-lg bg-gray-900 p-4 text-white">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-300">Net</p>
                <p className="mt-1 text-sm leading-6">{metric.verdict}</p>
              </div>
            </section>
          );
        })}
      </div>

      <section className="card">
        <h2 className="text-lg font-semibold text-gray-900">Behavior Patterns</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {patterns.map((pattern) => {
            const Icon = pattern.icon;
            return (
              <div key={pattern.title} className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
                    <Icon size={18} />
                  </div>
                  <h3 className="font-semibold text-gray-900">{pattern.title}</h3>
                </div>
                <p className="mt-3 text-sm leading-6 text-gray-600">{pattern.detail}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900">Bottom Line</h2>
          <div className="mt-4 space-y-3">
            <div className="rounded-lg border border-gray-200 p-4">
              <p className="font-medium text-gray-900">April</p>
              <p className="mt-1 text-sm leading-6 text-gray-600">
                Higher strain, higher non-activity stress, slightly better average sleep time,
                but worse autonomic stress early in the month with HRV down and RHR up.
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 p-4">
              <p className="font-medium text-gray-900">May month-to-date</p>
              <p className="mt-1 text-sm leading-6 text-gray-600">
                Strain is more controlled and autonomic markers have improved, but frequent
                short nights mean recovery still crashes when sleep goes off the cliff.
              </p>
            </div>
          </div>
        </div>

        <div className="card border-emerald-200 bg-emerald-50">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600 text-white">
              <CheckCircle2 size={20} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">4-Week Focus Goal</h2>
              <p className="text-sm text-gray-600">Sleep floor + controlled training load</p>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {[
              'Maximum 2 work-late nights per week.',
              'Minimum 5.5 hours sleep on work-late nights.',
              'One 8+ hour recovery night within 48 hours after each late night.',
              'Avoid 14+ strain days directly after red recovery mornings.',
            ].map((item) => (
              <div key={item} className="flex items-start gap-3 rounded-lg bg-white/70 p-3">
                <ArrowDownRight className="mt-0.5 text-emerald-600" size={16} />
                <p className="text-sm text-gray-700">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
