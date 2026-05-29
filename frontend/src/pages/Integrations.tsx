import { useEffect, useState, useRef } from 'react';
import { authApi, financeApi } from '../api/client';
import type { Account } from '../types';
import {
  Upload,
  FileSpreadsheet,
  Check,
  AlertCircle,
  Clock,
  Smartphone,
  X,
  HeartPulse,
  ExternalLink,
  RefreshCw,
  Info,
} from 'lucide-react';

interface SnoopIntegration {
  provider: string;
  name: string;
  description: string;
  features: string[];
  type: string;
  status?: string;
  connection_mode?: string;
  api_available?: boolean;
  api_configured?: boolean;
  api_note?: string;
  export_help_url?: string;
  setup_instructions?: string[];
  last_import: string | null;
  last_sync?: string | null;
  import_count: number;
  last_import_count?: number;
  last_import_skipped?: number;
  is_configured?: boolean;
  sync_error?: string;
  summary?: {
    records?: {
      cycles?: number;
      recoveries?: number;
      sleeps?: number;
    };
    averages?: {
      recovery_score?: number | null;
      hrv_rmssd_milli?: number | null;
      resting_heart_rate?: number | null;
      strain?: number | null;
      sleep_performance_percentage?: number | null;
      sleep_hours_in_bed?: number | null;
    };
  } | null;
}

interface ImportResult {
  transactions_created: number;
  transactions_skipped: number;
  errors: string[];
  total_errors: number;
}

export default function Integrations() {
  const [integrations, setIntegrations] = useState<SnoopIntegration[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [whoopLoading, setWhoopLoading] = useState(false);
  const [whoopError, setWhoopError] = useState<string | null>(null);
  const [snoopLoading, setSnoopLoading] = useState(false);
  const [snoopError, setSnoopError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [integrationsRes, accountsRes] = await Promise.all([
        authApi.getAvailableIntegrations(),
        financeApi.getAccounts(),
      ]);
      setIntegrations(integrationsRes.data);
      setAccounts(accountsRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setImportError(null);
      setImportResult(null);
    }
  };

  const handleImport = async () => {
    if (!selectedFile || !selectedAccountId) {
      setImportError('Please select a file and account');
      return;
    }

    setImporting(true);
    setImportError(null);
    setImportResult(null);

    try {
      const response = await authApi.importSnoopCSV(selectedFile, selectedAccountId);
      setImportResult(response.data);
      loadData(); // Refresh data
    } catch (error: unknown) {
      const apiError = error as { response?: { data?: { error?: string } } };
      setImportError(apiError.response?.data?.error || 'Failed to import file');
    } finally {
      setImporting(false);
    }
  };

  const handleWhoopConnect = async () => {
    setWhoopLoading(true);
    setWhoopError(null);
    try {
      const response = await authApi.connectWhoop();
      window.location.href = response.data.auth_url;
    } catch (error: unknown) {
      const apiError = error as { response?: { data?: { error?: string } } };
      setWhoopError(apiError.response?.data?.error || 'Failed to start WHOOP connection');
    } finally {
      setWhoopLoading(false);
    }
  };

  const handleWhoopSync = async () => {
    setWhoopLoading(true);
    setWhoopError(null);
    try {
      await authApi.syncWhoop();
      await loadData();
    } catch (error: unknown) {
      const apiError = error as { response?: { data?: { error?: string } } };
      setWhoopError(apiError.response?.data?.error || 'Failed to sync WHOOP data');
    } finally {
      setWhoopLoading(false);
    }
  };

  const handleSnoopConnect = async () => {
    setSnoopLoading(true);
    setSnoopError(null);
    try {
      await authApi.connectSnoop();
      await loadData();
      openImportModal();
    } catch (error: unknown) {
      const apiError = error as { response?: { data?: { error?: string } } };
      setSnoopError(apiError.response?.data?.error || 'Failed to set up Snoop connector');
    } finally {
      setSnoopLoading(false);
    }
  };

  const openImportModal = () => {
    setShowImportModal(true);
    setSelectedFile(null);
    setSelectedAccountId(accounts[0]?.id || null);
    setImportResult(null);
    setImportError(null);
  };

  const closeModal = () => {
    setShowImportModal(false);
    setSelectedFile(null);
    setImportResult(null);
    setImportError(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const snoopIntegration = integrations.find(i => i.provider === 'snoop');
  const whoopIntegration = integrations.find(i => i.provider === 'whoop');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Integrations</h1>
        <p className="text-gray-600">Connect health data and import bank transactions</p>
      </div>

      {/* Whoop OAuth Card */}
      <div className="card bg-gradient-to-r from-rose-50 to-orange-50 border-rose-200">
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          <div className="flex-shrink-0">
            <div className="w-20 h-20 bg-white rounded-2xl shadow-sm flex items-center justify-center">
              <HeartPulse className="text-rose-600" size={40} />
            </div>
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <h3 className="text-xl font-bold text-gray-900">Whoop</h3>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                whoopIntegration?.status === 'connected'
                  ? 'bg-green-100 text-green-700'
                  : whoopIntegration?.is_configured
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-gray-100 text-gray-700'
              }`}>
                {whoopIntegration?.status === 'connected'
                  ? 'Connected'
                  : whoopIntegration?.is_configured
                    ? 'Ready to connect'
                    : 'API credentials needed'}
              </span>
            </div>
            <p className="text-gray-600 mb-3">
              Sync recovery, HRV, resting heart rate, sleep performance, strain, and workout
              records from the WHOOP API.
            </p>
            <ul className="flex flex-wrap gap-3 text-sm text-gray-600">
              {whoopIntegration?.features.map((feature, idx) => (
                <li key={idx} className="flex items-center gap-1">
                  <Check size={14} className="text-green-500" />
                  {feature}
                </li>
              ))}
            </ul>
            {whoopIntegration?.last_sync && (
              <p className="text-sm text-gray-500 mt-3 flex items-center gap-1">
                <Clock size={14} />
                Last sync: {new Date(whoopIntegration.last_sync).toLocaleString()}
              </p>
            )}
            {whoopIntegration?.summary?.averages && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
                {[
                  ['Recovery', whoopIntegration.summary.averages.recovery_score],
                  ['HRV', whoopIntegration.summary.averages.hrv_rmssd_milli],
                  ['RHR', whoopIntegration.summary.averages.resting_heart_rate],
                  ['Strain', whoopIntegration.summary.averages.strain],
                ].map(([label, value]) => (
                  <div key={label} className="bg-white/70 rounded-lg p-2">
                    <p className="text-xs text-gray-500">{label}</p>
                    <p className="font-semibold text-gray-900">{value ?? '-'}</p>
                  </div>
                ))}
              </div>
            )}
            {whoopError && (
              <p className="text-sm text-red-600 mt-3">{whoopError}</p>
            )}
            {whoopIntegration?.sync_error && (
              <p className="text-sm text-red-600 mt-3">{whoopIntegration.sync_error}</p>
            )}
          </div>
          <div className="flex flex-col gap-2 flex-shrink-0">
            {whoopIntegration?.status === 'connected' ? (
              <button
                onClick={handleWhoopSync}
                disabled={whoopLoading}
                className="btn-primary flex items-center justify-center gap-2"
              >
                <RefreshCw size={18} className={whoopLoading ? 'animate-spin' : ''} />
                Sync Whoop
              </button>
            ) : (
              <button
                onClick={handleWhoopConnect}
                disabled={whoopLoading || !whoopIntegration?.is_configured}
                className="btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <ExternalLink size={18} />
                Connect Whoop
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Snoop Import Card */}
      <div className="card bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-200">
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          <div className="flex-shrink-0">
            <div className="w-20 h-20 bg-white rounded-2xl shadow-sm flex items-center justify-center">
              <Smartphone className="text-purple-600" size={40} />
            </div>
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <h3 className="text-xl font-bold text-gray-900">Snoop</h3>
              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                CSV export connector
              </span>
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                Public API unavailable
              </span>
            </div>
            <p className="text-gray-600 mb-3">
              Snoop does not currently publish a consumer OAuth/API connection for third-party
              apps, so Yieldly uses the official Snoop CSV export path and tracks import status
              through its own API.
            </p>
            <ul className="flex flex-wrap gap-3 text-sm text-gray-600">
              {snoopIntegration?.features.map((feature, idx) => (
                <li key={idx} className="flex items-center gap-1">
                  <Check size={14} className="text-green-500" />
                  {feature}
                </li>
              ))}
            </ul>
            {snoopIntegration?.last_import && (
              <p className="text-sm text-gray-500 mt-3 flex items-center gap-1">
                <Clock size={14} />
                Last import: {new Date(snoopIntegration.last_import).toLocaleDateString()}
                ({snoopIntegration.import_count} transactions total)
              </p>
            )}
            {snoopIntegration?.last_import_count !== undefined && snoopIntegration.last_import_count > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-4">
                <div className="bg-white/70 rounded-lg p-2">
                  <p className="text-xs text-gray-500">Last import</p>
                  <p className="font-semibold text-gray-900">{snoopIntegration.last_import_count}</p>
                </div>
                <div className="bg-white/70 rounded-lg p-2">
                  <p className="text-xs text-gray-500">Skipped</p>
                  <p className="font-semibold text-gray-900">{snoopIntegration.last_import_skipped ?? 0}</p>
                </div>
                <div className="bg-white/70 rounded-lg p-2">
                  <p className="text-xs text-gray-500">Mode</p>
                  <p className="font-semibold text-gray-900">CSV</p>
                </div>
              </div>
            )}
            {snoopIntegration?.api_note && (
              <p className="text-sm text-purple-800 mt-3 flex items-start gap-2">
                <Info size={15} className="mt-0.5 flex-shrink-0" />
                {snoopIntegration.api_note}
              </p>
            )}
            {snoopError && (
              <p className="text-sm text-red-600 mt-3">{snoopError}</p>
            )}
          </div>
          <div className="flex flex-col gap-2 flex-shrink-0">
            <button
              onClick={handleSnoopConnect}
              disabled={snoopLoading}
              className="btn-primary flex items-center gap-2"
            >
              <ExternalLink size={18} />
              Set up Snoop
            </button>
            <button
              onClick={openImportModal}
              className="btn-secondary flex items-center justify-center gap-2"
            >
              <Upload size={18} />
              Import Export
            </button>
          </div>
        </div>
      </div>

      {/* Manual CSV Import Card */}
      <div className="card">
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          <div className="flex-shrink-0">
            <div className="w-16 h-16 bg-gray-100 rounded-xl flex items-center justify-center">
              <FileSpreadsheet className="text-gray-600" size={32} />
            </div>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900">Manual CSV Import</h3>
            <p className="text-gray-600 mt-1">
              Import transactions from any bank's CSV export. Supports common formats with Date, Description, and Amount columns.
            </p>
            <ul className="flex flex-wrap gap-3 text-sm text-gray-600 mt-2">
              <li className="flex items-center gap-1">
                <Check size={14} className="text-green-500" />
                Any bank format
              </li>
              <li className="flex items-center gap-1">
                <Check size={14} className="text-green-500" />
                Auto-detect columns
              </li>
              <li className="flex items-center gap-1">
                <Check size={14} className="text-green-500" />
                Multiple date formats
              </li>
            </ul>
          </div>
          <div className="flex-shrink-0">
            <button
              onClick={openImportModal}
              className="btn-secondary flex items-center gap-2"
            >
              <Upload size={18} />
              Import CSV
            </button>
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="card bg-blue-50 border-blue-200">
        <div className="flex gap-3">
          <AlertCircle className="text-blue-600 flex-shrink-0" size={24} />
          <div>
            <h4 className="font-medium text-blue-900">How to export from Snoop</h4>
            <ol className="text-sm text-blue-800 mt-2 space-y-1 list-decimal list-inside">
              <li>Open the Snoop app on your phone</li>
              <li>Go to All transactions</li>
              <li>Tap Export</li>
              <li>Select the date range (monthly recommended)</li>
              <li>Download the CSV file</li>
              <li>Upload it here and select the account</li>
            </ol>
            {snoopIntegration?.export_help_url && (
              <a
                href={snoopIntegration.export_help_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sm font-medium text-blue-900 mt-3"
              >
                Open Snoop export help <ExternalLink size={14} />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Import Transactions</h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>

            {!importResult ? (
              <>
                {/* File Upload */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    CSV File
                  </label>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                      selectedFile
                        ? 'border-green-300 bg-green-50'
                        : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    {selectedFile ? (
                      <div className="flex items-center justify-center gap-2 text-green-700">
                        <FileSpreadsheet size={24} />
                        <span className="font-medium">{selectedFile.name}</span>
                      </div>
                    ) : (
                      <div className="text-gray-500">
                        <Upload size={32} className="mx-auto mb-2" />
                        <p>Click to select a CSV file</p>
                        <p className="text-xs mt-1">or drag and drop</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Account Selection */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Import to Account
                  </label>
                  {accounts.length === 0 ? (
                    <p className="text-sm text-red-600">
                      No accounts found. Please create an account first in Settings.
                    </p>
                  ) : (
                    <select
                      value={selectedAccountId || ''}
                      onChange={(e) => setSelectedAccountId(Number(e.target.value))}
                      className="input"
                    >
                      {accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name} ({account.type})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Error Message */}
                {importError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    {importError}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                  <button onClick={closeModal} className="btn-secondary flex-1">
                    Cancel
                  </button>
                  <button
                    onClick={handleImport}
                    disabled={!selectedFile || !selectedAccountId || importing}
                    className="btn-primary flex-1 flex items-center justify-center gap-2"
                  >
                    {importing ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Importing...
                      </>
                    ) : (
                      <>
                        <Upload size={18} />
                        Import
                      </>
                    )}
                  </button>
                </div>
              </>
            ) : (
              /* Import Results */
              <div>
                <div className={`p-4 rounded-lg mb-4 ${
                  importResult.transactions_created > 0
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-yellow-50 border border-yellow-200'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    {importResult.transactions_created > 0 ? (
                      <Check className="text-green-600" size={24} />
                    ) : (
                      <AlertCircle className="text-yellow-600" size={24} />
                    )}
                    <span className="font-semibold">
                      {importResult.transactions_created > 0 ? 'Import Successful!' : 'Import Complete'}
                    </span>
                  </div>
                  <ul className="text-sm space-y-1">
                    <li>✓ {importResult.transactions_created} transactions imported</li>
                    {importResult.transactions_skipped > 0 && (
                      <li className="text-yellow-700">
                        ⚠ {importResult.transactions_skipped} rows skipped
                      </li>
                    )}
                  </ul>
                </div>

                {importResult.errors.length > 0 && (
                  <div className="mb-4">
                    <p className="text-sm font-medium text-gray-700 mb-2">
                      Errors ({importResult.total_errors}):
                    </p>
                    <div className="bg-red-50 p-3 rounded-lg text-xs text-red-700 max-h-32 overflow-y-auto">
                      {importResult.errors.map((error, idx) => (
                        <p key={idx}>{error}</p>
                      ))}
                    </div>
                  </div>
                )}

                <button onClick={closeModal} className="btn-primary w-full">
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
