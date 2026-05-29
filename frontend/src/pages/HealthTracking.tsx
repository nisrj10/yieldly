import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Bed,
  Brain,
  CheckCircle2,
  Clock,
  Dumbbell,
  HeartPulse,
  Moon,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
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

type PeriodKey = 'daily' | 'weekly' | 'monthly';

interface WhoopAverages {
  strain?: number | null;
  recovery_score?: number | null;
  hrv_rmssd_milli?: number | null;
  resting_heart_rate?: number | null;
  sleep_performance_percentage?: number | null;
  sleep_hours_in_bed?: number | null;
}

interface WhoopPeriod {
  records?: {
    cycles?: number;
    recoveries?: number;
    sleeps?: number;
  };
  averages?: WhoopAverages;
}

interface WhoopTrendPoint {
  date: string;
  strain?: number | null;
  recovery_score?: number | null;
  hrv_rmssd_milli?: number | null;
  resting_heart_rate?: number | null;
  sleep_performance_percentage?: number | null;
  sleep_hours_in_bed?: number | null;
}

interface WhoopScore {
  recovery_score?: number | null;
  hrv_rmssd_milli?: number | null;
  resting_heart_rate?: number | null;
  spo2_percentage?: number | null;
  skin_temp_celsius?: number | null;
  strain?: number | null;
  average_heart_rate?: number | null;
  max_heart_rate?: number | null;
  kilojoule?: number | null;
  sleep_performance_percentage?: number | null;
  sleep_efficiency_percentage?: number | null;
  sleep_consistency_percentage?: number | null;
  respiratory_rate?: number | null;
  stage_summary?: {
    total_in_bed_time_milli?: number | null;
    total_awake_time_milli?: number | null;
    total_rem_sleep_time_milli?: number | null;
    total_light_sleep_time_milli?: number | null;
    total_slow_wave_sleep_time_milli?: number | null;
    disturbance_count?: number | null;
    sleep_cycle_count?: number | null;
  };
  sleep_needed?: {
    baseline_milli?: number | null;
    need_from_sleep_debt_milli?: number | null;
    need_from_recent_strain_milli?: number | null;
    need_from_recent_nap_milli?: number | null;
  };
}

interface WhoopRecord {
  start?: string | null;
  end?: string | null;
  score?: WhoopScore;
}

interface WhoopSummary {
  updated_at?: string;
  records?: {
    cycles?: number;
    sleeps?: number;
    recoveries?: number;
  };
  averages?: WhoopAverages;
  latest?: {
    cycle?: WhoopRecord | null;
    sleep?: WhoopRecord | null;
    recovery?: WhoopRecord | null;
  };
  periods?: Partial<Record<PeriodKey, WhoopPeriod>>;
  trend?: WhoopTrendPoint[];
}

interface WhoopHealthResponse {
  status: string;
  is_configured: boolean;
  last_sync?: string | null;
  sync_error?: string;
  profile?: {
    first_name?: string;
    last_name?: string;
    email?: string;
  } | null;
  summary?: WhoopSummary | null;
  last_sync_range?: {
    start?: string;
    end?: string;
  };
}

const periodLabels: Record<PeriodKey, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
};

const formatNumber = (value?: number | null, digits = 1) =>
  typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : '-';

const formatInteger = (value?: number | null) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.round(value).toString() : '-';

const hoursFromMillis = (value?: number | null) =>
  typeof value === 'number' && Number.isFinite(value) ? value / 1000 / 60 / 60 : null;

const formatHours = (value?: number | null) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
  const totalMinutes = Math.round(value * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return '-';
  return new Date(value).toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatDate = (value?: string | null) => {
  if (!value) return '-';
  return new Date(value).toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
  });
};

function getRecoveryTone(score?: number | null) {
  if (typeof score !== 'number') return 'bg-gray-50 text-gray-700 border-gray-200';
  if (score >= 67) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (score >= 34) return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-rose-50 text-rose-700 border-rose-200';
}

function buildGuidance(summary?: WhoopSummary | null) {
  const recovery = summary?.latest?.recovery?.score?.recovery_score;
  const sleep = summary?.latest?.sleep?.score?.sleep_performance_percentage;
  const strain = summary?.latest?.cycle?.score?.strain;
  const guidance: string[] = [];

  if (typeof recovery === 'number') {
    if (recovery >= 67) {
      guidance.push('Recovery is green. Normal training and a demanding workday are reasonable.');
    } else if (recovery >= 34) {
      guidance.push('Recovery is moderate. Keep training controlled and avoid stacking stress late today.');
    } else {
      guidance.push('Recovery is low. Make today a lighter day and protect sleep tonight.');
    }
  }

  if (typeof sleep === 'number' && sleep < 70) {
    guidance.push('Sleep is under target. Aim for an earlier wind-down and reduce late work tonight.');
  }

  if (typeof strain === 'number' && strain >= 14) {
    guidance.push('Recent strain is high. Avoid another hard session unless recovery is also strong.');
  }

  if (!guidance.length) {
    guidance.push('WHOOP is connected. Sync after waking to refresh the latest morning guidance.');
  }

  return guidance;
}

function StatCard({
  label,
  value,
  detail,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof HeartPulse;
  tone: string;
}) {
  return (
    <div className={`rounded-lg border p-4 ${tone}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">{label}</span>
        <Icon size={18} />
      </div>
      <p className="mt-3 text-2xl font-bold text-gray-900">{value}</p>
      <p className="mt-1 text-sm text-gray-600">{detail}</p>
    </div>
  );
}

function PeriodMetric({
  title,
  value,
  detail,
}: {
  title: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
      <p className="mt-1 text-xs text-gray-500">{detail}</p>
    </div>
  );
}

export default function HealthTracking() {
  const [data, setData] = useState<WhoopHealthResponse | null>(null);
  const [period, setPeriod] = useState<PeriodKey>('daily');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHealth = async () => {
    try {
      setError(null);
      const response = await authApi.getWhoopHealth();
      setData(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load WHOOP health data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHealth();
  }, []);

  const syncWhoop = async () => {
    setSyncing(true);
    try {
      await authApi.syncWhoop();
      await loadHealth();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'WHOOP sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const summary = data?.summary;
  const latest = summary?.latest;
  const recovery = latest?.recovery?.score;
  const cycle = latest?.cycle?.score;
  const sleep = latest?.sleep?.score;
  const stage = sleep?.stage_summary;
  const activePeriod = summary?.periods?.[period] || {
    averages: period === 'daily' ? summary?.averages : undefined,
  };
  const periodAverages = activePeriod.averages || summary?.averages || {};
  const guidance = useMemo(() => buildGuidance(summary), [summary]);

  const sleepStages = [
    { name: 'REM', hours: hoursFromMillis(stage?.total_rem_sleep_time_milli), fill: '#6366f1' },
    { name: 'Light', hours: hoursFromMillis(stage?.total_light_sleep_time_milli), fill: '#38bdf8' },
    { name: 'Deep', hours: hoursFromMillis(stage?.total_slow_wave_sleep_time_milli), fill: '#10b981' },
    { name: 'Awake', hours: hoursFromMillis(stage?.total_awake_time_milli), fill: '#f97316' },
  ].filter((item) => item.hours !== null);

  const trend = (summary?.trend || [])
    .slice()
    .reverse()
    .map((item) => ({
      ...item,
      label: formatDate(item.date),
    }));

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <RefreshCw className="animate-spin text-primary-600" size={28} />
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="space-y-6">
        <div className="card">
          <div className="flex items-center gap-3">
            <AlertTriangle className="text-amber-600" size={24} />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Health Tracking</h1>
              <p className="text-gray-600">WHOOP is not synced yet.</p>
            </div>
          </div>
          <button onClick={syncWhoop} disabled={syncing} className="btn-primary mt-6 inline-flex items-center gap-2">
            <RefreshCw size={18} className={syncing ? 'animate-spin' : ''} />
            Sync WHOOP
          </button>
          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-600">
              <HeartPulse className="text-white" size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Health Dashboard</h1>
              <p className="text-gray-600">
                Live WHOOP recovery, sleep, strain, and readiness signals.
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <span className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600">
            Last sync: {formatDateTime(data?.last_sync)}
          </span>
          <button onClick={syncWhoop} disabled={syncing} className="btn-primary inline-flex items-center justify-center gap-2">
            <RefreshCw size={18} className={syncing ? 'animate-spin' : ''} />
            Sync now
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="card">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Today readiness</p>
              <div className="mt-2 flex items-center gap-3">
                <span className={`rounded-lg border px-3 py-2 text-3xl font-bold ${getRecoveryTone(recovery?.recovery_score)}`}>
                  {formatInteger(recovery?.recovery_score)}%
                </span>
                <div>
                  <p className="font-semibold text-gray-900">Recovery score</p>
                  <p className="text-sm text-gray-600">
                    HRV {formatNumber(recovery?.hrv_rmssd_milli)} ms · RHR {formatInteger(recovery?.resting_heart_rate)} bpm
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 lg:w-80">
              <p className="text-sm font-semibold text-gray-900">Morning guidance</p>
              <div className="mt-3 space-y-2">
                {guidance.map((item) => (
                  <div key={item} className="flex gap-2 text-sm leading-6 text-gray-700">
                    <CheckCircle2 className="mt-1 shrink-0 text-emerald-600" size={16} />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <p className="text-sm font-medium text-gray-500">Connected profile</p>
          <p className="mt-2 text-xl font-bold text-gray-900">
            {data?.profile?.first_name || 'WHOOP'} {data?.profile?.last_name || ''}
          </p>
          <p className="mt-1 text-sm text-gray-600">{data?.profile?.email || 'Connected WHOOP account'}</p>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-lg font-bold text-gray-900">{summary.records?.cycles || 0}</p>
              <p className="text-xs text-gray-500">Cycles</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-lg font-bold text-gray-900">{summary.records?.sleeps || 0}</p>
              <p className="text-xs text-gray-500">Sleeps</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-lg font-bold text-gray-900">{summary.records?.recoveries || 0}</p>
              <p className="text-xs text-gray-500">Recoveries</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Sleep performance"
          value={`${formatInteger(sleep?.sleep_performance_percentage)}%`}
          detail={`${formatHours(hoursFromMillis(stage?.total_in_bed_time_milli))} in bed`}
          icon={Moon}
          tone="border-indigo-200 bg-indigo-50 text-indigo-700"
        />
        <StatCard
          label="Daily strain"
          value={formatNumber(cycle?.strain)}
          detail={`Avg HR ${formatInteger(cycle?.average_heart_rate)} · Max ${formatInteger(cycle?.max_heart_rate)}`}
          icon={Dumbbell}
          tone="border-sky-200 bg-sky-50 text-sky-700"
        />
        <StatCard
          label="Sleep efficiency"
          value={`${formatNumber(sleep?.sleep_efficiency_percentage)}%`}
          detail={`${stage?.disturbance_count || 0} disturbances · ${stage?.sleep_cycle_count || 0} cycles`}
          icon={Bed}
          tone="border-emerald-200 bg-emerald-50 text-emerald-700"
        />
        <StatCard
          label="Respiration"
          value={formatNumber(sleep?.respiratory_rate)}
          detail={`SpO2 ${formatNumber(recovery?.spo2_percentage)}% · Temp ${formatNumber(recovery?.skin_temp_celsius)}C`}
          icon={Activity}
          tone="border-amber-200 bg-amber-50 text-amber-700"
        />
      </div>

      <section className="card">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Daily, Weekly, Monthly View</h2>
            <p className="text-sm text-gray-600">Switch periods to compare recovery, sleep, and strain.</p>
          </div>
          <div className="grid grid-cols-3 rounded-lg border border-gray-200 bg-gray-50 p-1">
            {(['daily', 'weekly', 'monthly'] as PeriodKey[]).map((key) => (
              <button
                key={key}
                onClick={() => setPeriod(key)}
                className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  period === key ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {periodLabels[key]}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <PeriodMetric
            title="Recovery"
            value={`${formatInteger(periodAverages.recovery_score)}%`}
            detail="Average recovery score"
          />
          <PeriodMetric
            title="HRV"
            value={`${formatNumber(periodAverages.hrv_rmssd_milli)} ms`}
            detail="RMSSD average"
          />
          <PeriodMetric
            title="Resting HR"
            value={`${formatInteger(periodAverages.resting_heart_rate)} bpm`}
            detail="Lower is usually better"
          />
          <PeriodMetric
            title="Sleep"
            value={formatHours(periodAverages.sleep_hours_in_bed)}
            detail={`${formatInteger(periodAverages.sleep_performance_percentage)}% performance`}
          />
          <PeriodMetric
            title="Strain"
            value={formatNumber(periodAverages.strain)}
            detail={`${activePeriod.records?.cycles || 0} cycle records`}
          />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900">30-Day Trend</h2>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Area type="monotone" dataKey="recovery_score" name="Recovery" stroke="#10b981" fill="#d1fae5" />
                <Area type="monotone" dataKey="sleep_performance_percentage" name="Sleep performance" stroke="#6366f1" fill="#e0e7ff" />
                <Area type="monotone" dataKey="strain" name="Strain" stroke="#0ea5e9" fill="#e0f2fe" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900">Latest Sleep Composition</h2>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sleepStages}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value) => `${formatHours(Number(value))}`} />
                <Bar dataKey="hours" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-5">
          <div className="flex items-center gap-3">
            <ShieldCheck className="text-emerald-700" size={22} />
            <h2 className="font-semibold text-gray-900">What looks good</h2>
          </div>
          <p className="mt-3 text-sm leading-6 text-gray-700">
            Latest recovery is {formatInteger(recovery?.recovery_score)}%, with HRV at {formatNumber(recovery?.hrv_rmssd_milli)} ms
            and resting heart rate at {formatInteger(recovery?.resting_heart_rate)} bpm.
          </p>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-center gap-3">
            <Clock className="text-amber-700" size={22} />
            <h2 className="font-semibold text-gray-900">What to watch</h2>
          </div>
          <p className="mt-3 text-sm leading-6 text-gray-700">
            60-day averages still show {formatHours(summary.averages?.sleep_hours_in_bed)} in bed and
            {formatInteger(summary.averages?.sleep_performance_percentage)}% sleep performance.
          </p>
        </div>
        <div className="rounded-lg border border-sky-200 bg-sky-50 p-5">
          <div className="flex items-center gap-3">
            <Brain className="text-sky-700" size={22} />
            <h2 className="font-semibold text-gray-900">Morning MCP use</h2>
          </div>
          <p className="mt-3 text-sm leading-6 text-gray-700">
            The Yieldly MCP now exposes <span className="font-mono">get_whoop_health_summary</span>, so I can pull these
            stats into morning check-ins and give practical guidance.
          </p>
        </div>
      </section>

      <section className="card">
        <div className="flex items-center gap-3">
          <TrendingUp className="text-primary-600" size={22} />
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Recent Daily Rows</h2>
            <p className="text-sm text-gray-600">Latest synced WHOOP points used by the charts.</p>
          </div>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left">
                <th className="py-3 pr-4 font-medium text-gray-500">Date</th>
                <th className="px-4 py-3 font-medium text-gray-500">Recovery</th>
                <th className="px-4 py-3 font-medium text-gray-500">Sleep</th>
                <th className="px-4 py-3 font-medium text-gray-500">HRV</th>
                <th className="px-4 py-3 font-medium text-gray-500">RHR</th>
                <th className="py-3 pl-4 font-medium text-gray-500">Strain</th>
              </tr>
            </thead>
            <tbody>
              {(summary.trend || []).slice(0, 8).map((row) => (
                <tr key={row.date} className="border-b border-gray-100 last:border-0">
                  <td className="py-3 pr-4 font-semibold text-gray-900">{formatDate(row.date)}</td>
                  <td className="px-4 py-3 text-gray-700">{formatInteger(row.recovery_score)}%</td>
                  <td className="px-4 py-3 text-gray-700">{formatInteger(row.sleep_performance_percentage)}%</td>
                  <td className="px-4 py-3 text-gray-700">{formatNumber(row.hrv_rmssd_milli)} ms</td>
                  <td className="px-4 py-3 text-gray-700">{formatInteger(row.resting_heart_rate)} bpm</td>
                  <td className="py-3 pl-4 text-gray-700">{formatNumber(row.strain)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
