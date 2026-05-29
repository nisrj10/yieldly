import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  Bed,
  CalendarDays,
  CheckCircle2,
  Clock,
  HeartPulse,
  RefreshCw,
  ShieldCheck,
  Sparkles,
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
  if (score === null || score === undefined) return 'border-gray-200 bg-gray-50 text-gray-700';
  if (score >= 67) return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (score >= 34) return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-rose-200 bg-rose-50 text-rose-700';
};

const periodCards = [
  { key: 'day', label: 'Daily', sublabel: 'Latest day' },
  { key: 'week', label: 'Weekly', sublabel: 'Last 7 days' },
  { key: 'month', label: 'Monthly', sublabel: 'Last 30 days' },
] as const;

export default function HealthTracking() {
  const [health, setHealth] = useState<WhoopHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-rose-600">
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
          <div className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600">
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

      <section className={`card border ${recoveryTone(latest.recovery_score)}`}>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-sm font-medium opacity-80">{formatDay(latest.date)}</p>
            <h2 className="mt-1 text-3xl font-bold text-gray-900">
              Recovery {formatNumber(latest.recovery_score, '%')}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-700">
              {(health.guidance || ['Keep routines steady today.'])[0]}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MiniMetric icon={Zap} label="Strain" value={formatNumber(latest.strain, '', 1)} />
            <MiniMetric icon={Bed} label="Sleep" value={formatNumber(latest.sleep_performance_percentage, '%')} />
            <MiniMetric icon={HeartPulse} label="HRV" value={formatNumber(latest.hrv_rmssd_milli, ' ms')} />
            <MiniMetric icon={Activity} label="RHR" value={formatNumber(latest.resting_heart_rate, ' bpm')} />
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {periodCards.map((card) => {
          const period = health.periods?.[card.key];
          return (
            <section key={card.key} className="card">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{card.label}</h2>
                  <p className="text-sm text-gray-500">{card.sublabel}</p>
                </div>
                <CalendarDays className="text-gray-400" size={20} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Stat label="Recovery" value={formatNumber(period?.avg_recovery, '%')} />
                <Stat label="Sleep" value={formatNumber(period?.avg_sleep_performance, '%')} />
                <Stat label="Sleep time" value={formatNumber(period?.avg_sleep_hours, 'h', 1)} />
                <Stat label="Strain" value={formatNumber(period?.avg_strain, '', 1)} />
                <Stat label="HRV" value={formatNumber(period?.avg_hrv, ' ms')} />
                <Stat label="RHR" value={formatNumber(period?.avg_rhr, ' bpm')} />
              </div>
            </section>
          );
        })}
      </div>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_0.8fr]">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">30-Day Trend</h2>
              <p className="text-sm text-gray-500">Recovery, sleep performance, and strain</p>
            </div>
            <Clock className="text-gray-400" size={20} />
          </div>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Area type="monotone" dataKey="recovery" name="Recovery" stroke="#10b981" fill="#d1fae5" />
                <Area type="monotone" dataKey="sleep" name="Sleep" stroke="#6366f1" fill="#e0e7ff" />
                <Area type="monotone" dataKey="strain" name="Strain" stroke="#f97316" fill="#ffedd5" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900">Latest Sleep</h2>
          <p className="text-sm text-gray-500">Stage composition</p>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sleepStages}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
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
              <div key={item} className="flex items-start gap-3 rounded-lg border border-gray-200 p-3">
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
                  <tr key={day.date} className="border-b border-gray-100 last:border-0">
                    <td className="py-3 pr-4 font-medium text-gray-900">{formatDay(day.date)}</td>
                    <td className="px-4 py-3">{formatNumber(day.recovery_score, '%')}</td>
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
}: {
  icon: typeof Zap;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-white/70 bg-white/70 p-3">
      <div className="flex items-center gap-2 text-gray-500">
        <Icon size={15} />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="mt-1 text-xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-gray-900">{value}</p>
    </div>
  );
}
