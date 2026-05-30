import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  Bed,
  CalendarDays,
  CheckCircle2,
  HeartPulse,
  Moon,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Zap,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { authApi } from '../api/client';

interface PeriodSummary {
  days: number;
  avg_recovery: number | null;
  avg_hrv: number | null;
  avg_rhr: number | null;
  avg_strain: number | null;
  avg_sleep_performance: number | null;
  avg_sleep_hours: number | null;
}

interface WhoopDay {
  date?: string;
  recovery_score?: number | null;
  hrv_rmssd_milli?: number | null;
  resting_heart_rate?: number | null;
  strain?: number | null;
  average_heart_rate?: number | null;
  max_heart_rate?: number | null;
  sleep_performance_percentage?: number | null;
  sleep_efficiency_percentage?: number | null;
  sleep_hours_in_bed?: number | null;
  awake_hours?: number | null;
  rem_hours?: number | null;
  light_hours?: number | null;
  deep_hours?: number | null;
  disturbance_count?: number | null;
  sleep_cycle_count?: number | null;
  respiratory_rate?: number | null;
  spo2_percentage?: number | null;
  skin_temp_celsius?: number | null;
}

interface WhoopHealth {
  connected: boolean;
  status: string;
  account?: string | null;
  last_sync?: string | null;
  updated_at?: string | null;
  sync_error?: string;
  records?: {
    cycles?: number;
    recoveries?: number;
    sleeps?: number;
  };
  latest?: WhoopDay;
  periods?: {
    day?: PeriodSummary | null;
    week?: PeriodSummary | null;
    month?: PeriodSummary | null;
  };
  trend?: WhoopDay[];
  recent_days?: WhoopDay[];
  guidance?: string[];
}

const formatNumber = (value?: number | null, suffix = '', digits = 0) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '--';
  return `${Number(value).toFixed(digits)}${suffix}`;
};

const formatDate = (value?: string | null) => {
  if (!value) return 'Not synced yet';
  return new Date(value).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatDay = (value?: string) => {
  if (!value) return '--';
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  });
};

const recoveryTone = (score?: number | null) => {
  if (score === null || score === undefined) {
    return {
      label: 'No recovery',
      chip: 'bg-gray-100 text-gray-700',
      hero: 'from-slate-700 via-slate-600 to-slate-500',
      ring: '#64748b',
    };
  }
  if (score >= 67) {
    return {
      label: 'Green recovery',
      chip: 'bg-emerald-100 text-emerald-700',
      hero: 'from-emerald-500 via-teal-500 to-sky-500',
      ring: '#10b981',
    };
  }
  if (score >= 34) {
    return {
      label: 'Yellow recovery',
      chip: 'bg-amber-100 text-amber-800',
      hero: 'from-amber-400 via-orange-500 to-rose-500',
      ring: '#f59e0b',
    };
  }
  return {
    label: 'Red recovery',
    chip: 'bg-rose-100 text-rose-700',
    hero: 'from-rose-500 via-pink-500 to-violet-500',
    ring: '#f43f5e',
  };
};

const periodCards = [
  { key: 'day', label: 'Daily', sublabel: 'Latest day', accent: 'from-sky-500 to-cyan-400', icon: Zap },
  { key: 'week', label: 'Weekly', sublabel: 'Last 7 days', accent: 'from-violet-500 to-fuchsia-500', icon: TrendingUp },
  { key: 'month', label: 'Monthly', sublabel: 'Last 30 days', accent: 'from-emerald-500 to-lime-400', icon: CalendarDays },
] as const;

const trendMetrics = [
  { key: 'recovery', label: 'Recovery', color: '#10b981', fill: 'url(#recoveryGradient)' },
  { key: 'sleep', label: 'Sleep', color: '#6366f1', fill: 'url(#sleepGradient)' },
  { key: 'strain', label: 'Strain', color: '#f97316', fill: 'url(#strainGradient)' },
] as const;

export default function HealthTracking() {
  const [health, setHealth] = useState<WhoopHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visibleTrendMetrics, setVisibleTrendMetrics] = useState<string[]>(['recovery', 'sleep', 'strain']);

  const loadHealth = async () => {
    setError(null);
    try {
      const response = await authApi.getWhoopHealth();
      setHealth(response.data);
    } catch (err) {
      setError('Could not load WHOOP health data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHealth();
  }, []);

  const syncWhoop = async () => {
    setSyncing(true);
    setError(null);
    try {
      await authApi.syncWhoop();
      await loadHealth();
    } catch {
      setError('WHOOP sync failed. Check the integration status.');
    } finally {
      setSyncing(false);
    }
  };

  const latest = health?.latest || {};
  const tone = recoveryTone(latest.recovery_score);
  const recoveryScore = Math.max(0, Math.min(100, Number(latest.recovery_score || 0)));
  const sleepScore = Math.max(0, Math.min(100, Number(latest.sleep_performance_percentage || 0)));
  const strainScore = Math.max(0, Math.min(100, Number(((latest.strain || 0) / 21) * 100)));
  const recoveryRing = `conic-gradient(${tone.ring} ${recoveryScore * 3.6}deg, rgba(255,255,255,0.22) 0deg)`;
  const trend = useMemo(
    () => (health?.trend || []).map((day) => ({
      ...day,
      label: formatDay(day.date),
      recovery: day.recovery_score ?? undefined,
      sleep: day.sleep_performance_percentage ?? undefined,
      strain: day.strain ?? undefined,
    })),
    [health]
  );

  const sleepStages = [
    { name: 'REM', hours: latest.rem_hours || 0, fill: '#0ea5e9' },
    { name: 'Light', hours: latest.light_hours || 0, fill: '#6366f1' },
    { name: 'Deep', hours: latest.deep_hours || 0, fill: '#10b981' },
    { name: 'Awake', hours: latest.awake_hours || 0, fill: '#f97316' },
  ].filter((stage) => stage.hours > 0);

  const toggleTrendMetric = (metric: string) => {
    setVisibleTrendMetrics((current) => {
      if (current.includes(metric) && current.length > 1) {
        return current.filter((item) => item !== metric);
      }
      if (current.includes(metric)) return current;
      return [...current, metric];
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-[360px] items-center justify-center">
        <RefreshCw className="animate-spin text-primary-600" size={28} />
      </div>
    );
  }

  if (!health?.connected) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Health</h1>
          <p className="text-gray-600">WHOOP health dashboard</p>
        </div>
        <section className="card border-amber-200 bg-amber-50">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-1 text-amber-600" size={22} />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">WHOOP is not connected</h2>
              <p className="mt-1 text-sm text-gray-700">
                Connect WHOOP from Integrations, then sync to populate daily, weekly, and monthly stats.
              </p>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-rose-500 to-violet-600 shadow-lg shadow-rose-200">
              <HeartPulse className="text-white" size={23} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Health</h1>
              <p className="text-gray-600">
                WHOOP daily, weekly, and monthly recovery signals
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="rounded-lg border border-indigo-100 bg-white px-4 py-2 text-sm text-gray-600 shadow-sm">
            Last sync: <span className="font-medium text-gray-900">{formatDate(health.last_sync)}</span>
          </div>
          <button
            onClick={syncWhoop}
            disabled={syncing}
            className="btn btn-primary"
          >
            <RefreshCw size={18} className={syncing ? 'animate-spin' : ''} />
            Sync
          </button>
        </div>
      </div>

      {(error || health.sync_error) && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error || health.sync_error}
        </div>
      )}

      <section className={`overflow-hidden rounded-2xl bg-gradient-to-br ${tone.hero} p-6 text-white shadow-xl shadow-gray-200`}>
        <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-col gap-5 md:flex-row md:items-center">
            <div
              className="flex h-32 w-32 shrink-0 items-center justify-center rounded-full p-2 shadow-2xl shadow-black/10"
              style={{ background: recoveryRing }}
            >
              <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-white/95 text-gray-950">
                <span className="text-4xl font-black">{formatNumber(latest.recovery_score, '%')}</span>
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Recovery</span>
              </div>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
                  {formatDay(latest.date)}
                </span>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tone.chip}`}>
                  {tone.label}
                </span>
              </div>
              <h2 className="mt-3 text-3xl font-black text-white md:text-4xl">
                Ready score: {formatNumber(latest.recovery_score, '%')}
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-white/90">
                {(health.guidance || ['Keep routines steady today.'])[0]}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:min-w-[500px]">
            <MiniMetric icon={Zap} label="Strain" value={formatNumber(latest.strain, '', 1)} progress={strainScore} color="bg-orange-400" />
            <MiniMetric icon={Bed} label="Sleep" value={formatNumber(latest.sleep_performance_percentage, '%')} progress={sleepScore} color="bg-indigo-400" />
            <MiniMetric icon={HeartPulse} label="HRV" value={formatNumber(latest.hrv_rmssd_milli, ' ms')} progress={Math.min(100, Number(latest.hrv_rmssd_milli || 0) * 2)} color="bg-rose-400" />
            <MiniMetric icon={Activity} label="RHR" value={formatNumber(latest.resting_heart_rate, ' bpm')} progress={Math.max(12, 100 - Number(latest.resting_heart_rate || 70))} color="bg-cyan-400" />
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {periodCards.map((card) => {
          const period = health.periods?.[card.key];
          const Icon = card.icon;
          return (
            <section key={card.key} className="group overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-xl">
              <div className={`h-1.5 bg-gradient-to-r ${card.accent}`} />
              <div className="p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{card.label}</h2>
                  <p className="text-sm text-gray-500">{card.sublabel}</p>
                </div>
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${card.accent} text-white shadow-sm transition-transform group-hover:scale-105`}>
                  <Icon size={20} />
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Stat label="Recovery" value={formatNumber(period?.avg_recovery, '%')} tone="emerald" />
                <Stat label="Sleep" value={formatNumber(period?.avg_sleep_performance, '%')} tone="indigo" />
                <Stat label="Sleep time" value={formatNumber(period?.avg_sleep_hours, 'h', 1)} tone="sky" />
                <Stat label="Strain" value={formatNumber(period?.avg_strain, '', 1)} tone="orange" />
                <Stat label="HRV" value={formatNumber(period?.avg_hrv, ' ms')} tone="rose" />
                <Stat label="RHR" value={formatNumber(period?.avg_rhr, ' bpm')} tone="cyan" />
              </div>
              </div>
            </section>
          );
        })}
      </div>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_0.8fr]">
        <div className="card">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">30-Day Trend</h2>
              <p className="text-sm text-gray-500">Recovery, sleep performance, and strain</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {trendMetrics.map((metric) => {
                const active = visibleTrendMetrics.includes(metric.key);
                return (
                  <button
                    key={metric.key}
                    type="button"
                    onClick={() => toggleTrendMetric(metric.key)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
                      active
                        ? 'border-transparent text-white shadow-sm'
                        : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                    }`}
                    style={active ? { backgroundColor: metric.color } : undefined}
                  >
                    {metric.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend}>
                <defs>
                  <linearGradient id="recoveryGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.04} />
                  </linearGradient>
                  <linearGradient id="sleepGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.34} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.04} />
                  </linearGradient>
                  <linearGradient id="strainGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.32} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ borderRadius: 12, borderColor: '#e5e7eb' }} />
                {trendMetrics.map((metric) => (
                  visibleTrendMetrics.includes(metric.key) && (
                    <Area
                      key={metric.key}
                      type="monotone"
                      dataKey={metric.key}
                      name={metric.label}
                      stroke={metric.color}
                      fill={metric.fill}
                      strokeWidth={3}
                      activeDot={{ r: 6 }}
                    />
                  )
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card bg-gradient-to-br from-indigo-50 via-white to-sky-50">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600 text-white">
              <Moon size={20} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Latest Sleep</h2>
              <p className="text-sm text-gray-500">Stage composition</p>
            </div>
          </div>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sleepStages}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ borderRadius: 12, borderColor: '#e5e7eb' }} />
                <Bar dataKey="hours" name="Hours" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[0.9fr_1.2fr]">
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <Sparkles size={20} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Morning Guidance</h2>
              <p className="text-sm text-gray-500">Generated from latest WHOOP signals</p>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {(health.guidance || []).map((item) => (
              <div key={item} className="flex items-start gap-3 rounded-lg border border-emerald-100 bg-emerald-50/60 p-3 transition-colors hover:bg-emerald-50">
                <CheckCircle2 className="mt-0.5 text-emerald-600" size={16} />
                <p className="text-sm leading-6 text-gray-700">{item}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Recent Days</h2>
              <p className="text-sm text-gray-500">
                {health.records?.cycles || 0} cycles, {health.records?.sleeps || 0} sleeps, {health.records?.recoveries || 0} recoveries stored
              </p>
            </div>
            <ShieldCheck className="text-gray-400" size={20} />
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left">
                  <th className="py-3 pr-4 font-medium text-gray-500">Day</th>
                  <th className="px-4 py-3 font-medium text-gray-500">Recovery</th>
                  <th className="px-4 py-3 font-medium text-gray-500">Sleep</th>
                  <th className="px-4 py-3 font-medium text-gray-500">Strain</th>
                  <th className="px-4 py-3 font-medium text-gray-500">HRV</th>
                  <th className="py-3 pl-4 font-medium text-gray-500">RHR</th>
                </tr>
              </thead>
              <tbody>
                {(health.recent_days || []).slice(0, 10).map((day) => (
                  <tr key={day.date} className="border-b border-gray-100 transition-colors last:border-0 hover:bg-gray-50">
                    <td className="py-3 pr-4 font-medium text-gray-900">{formatDay(day.date)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${recoveryTone(day.recovery_score).chip}`}>
                        {formatNumber(day.recovery_score, '%')}
                      </span>
                    </td>
                    <td className="px-4 py-3">{formatNumber(day.sleep_performance_percentage, '%')}</td>
                    <td className="px-4 py-3">{formatNumber(day.strain, '', 1)}</td>
                    <td className="px-4 py-3">{formatNumber(day.hrv_rmssd_milli, ' ms')}</td>
                    <td className="py-3 pl-4">{formatNumber(day.resting_heart_rate, ' bpm')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

function MiniMetric({
  icon: Icon,
  label,
  value,
  progress,
  color,
}: {
  icon: typeof Zap;
  label: string;
  value: string;
  progress: number;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-white/30 bg-white/20 p-3 text-white shadow-sm backdrop-blur transition-all hover:-translate-y-0.5 hover:bg-white/25">
      <div className="flex items-center gap-2 text-white/80">
        <Icon size={15} />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="mt-1 text-xl font-bold text-white">{value}</p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/20">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(8, Math.min(100, progress))}%` }} />
      </div>
    </div>
  );
}

const statTone = {
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  indigo: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  sky: 'bg-sky-50 text-sky-700 border-sky-100',
  orange: 'bg-orange-50 text-orange-700 border-orange-100',
  rose: 'bg-rose-50 text-rose-700 border-rose-100',
  cyan: 'bg-cyan-50 text-cyan-700 border-cyan-100',
};

function Stat({ label, value, tone }: { label: string; value: string; tone: keyof typeof statTone }) {
  return (
    <div className={`rounded-lg border p-3 transition-transform hover:-translate-y-0.5 ${statTone[tone]}`}>
      <p className="text-xs font-medium opacity-75">{label}</p>
      <p className="mt-1 text-lg font-bold text-gray-900">{value}</p>
    </div>
  );
}
