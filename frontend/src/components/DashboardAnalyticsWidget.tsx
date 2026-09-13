import { RegistrationTrendChart, MonthlyRevenueChart, ReportStatusChart, ExpenseCategoryChart } from './Charts'
import { Activity, ShieldCheck, CheckCircle2, Calendar } from 'lucide-react'

interface AnalyticsWidgetProps {
  trends: {
    monthly_registrations: Array<{
      month: string
      total: number
      total_amount: number
      received_amount: number
      balance_amount: number
    }>
    report_statuses: {
      total: number
      pending: number
      complete: number
      cancel: number
    }
    today_reports: number
  } | null
  monthExpenses: Array<{ category: string; total: number }>
  trackingSummary: any
  recentActivities: any[]
  period: string
  fromDate: string
  toDate: string
  onPeriodChange: (period: string, fromDate?: string, toDate?: string) => void
}

export function DashboardAnalyticsWidget({
  trends,
  monthExpenses,
  trackingSummary,
  recentActivities,
  period,
  fromDate,
  toDate,
  onPeriodChange,
}: AnalyticsWidgetProps) {
  const periods = [
    { key: 'daily', label: 'Daily' },
    { key: 'monthly', label: 'Monthly' },
    { key: 'quarterly', label: 'Quarterly' },
    { key: 'yearly', label: 'Yearly' },
    { key: 'custom', label: 'Custom Date' },
  ]

  return (
    <div className="space-y-6 mt-6">
      {/* Analytics Filter & Period Selector Bar */}
      <section className="surface p-4 rounded-xl border border-default-200 bg-content1 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Calendar size={18} className="text-primary" />
          <span className="text-sm font-bold text-default-900">Analytics Timeframe:</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
          <div className="flex items-center gap-1 bg-default-100 p-1 rounded-lg border border-default-200">
            {periods.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => onPeriodChange(p.key, fromDate, toDate)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  period === p.key
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-default-600 hover:text-default-900 hover:bg-default-200/60'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {period === 'custom' ? (
            <div className="flex items-center gap-2 mt-2 sm:mt-0">
              <input
                type="date"
                value={fromDate}
                onChange={(e) => onPeriodChange('custom', e.target.value, toDate)}
                className="px-2.5 py-1 rounded-md border border-default-300 text-xs bg-content1 text-default-900 outline-none focus:ring-1 focus:ring-primary"
              />
              <span className="text-xs text-default-400">to</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => onPeriodChange('custom', fromDate, e.target.value)}
                className="px-2.5 py-1 rounded-md border border-default-300 text-xs bg-content1 text-default-900 outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          ) : null}
        </div>
      </section>

      {/* Real-time Operational Tracking Strip */}
      {trackingSummary ? (
        <section className="surface p-5 rounded-xl border border-default-200 bg-content1 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs font-semibold text-primary uppercase tracking-wider">Real-Time Operational Activity</p>
              <h2 className="text-lg font-bold text-default-900">Active Staff & System Operations</h2>
            </div>
            <Activity className="text-primary" size={20} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-5">
            <div className="p-4 rounded-lg bg-default-50 border border-default-200">
              <span className="text-xs font-medium text-default-500 uppercase">Online Staff</span>
              <strong className="block text-2xl font-bold text-default-900 mt-1">{trackingSummary.online_count ?? 0}</strong>
              <small className="text-xs text-success font-medium truncate block mt-1">
                {trackingSummary.online_users?.map((u: any) => u.name).join(', ') || 'Staff active'}
              </small>
            </div>
            <div className="p-4 rounded-lg bg-default-50 border border-default-200">
              <span className="text-xs font-medium text-default-500 uppercase">Active Staff Today</span>
              <strong className="block text-2xl font-bold text-default-900 mt-1">{trackingSummary.today_active_users ?? 0}</strong>
              <small className="text-xs text-default-400 block mt-1">{trackingSummary.today_activities ?? 0} total operations</small>
            </div>
            <div className="p-4 rounded-lg bg-primary-50/50 border border-primary-200">
              <span className="text-xs font-medium text-primary-600 uppercase">Reports Generated</span>
              <strong className="block text-2xl font-bold text-primary-700 mt-1">{trackingSummary.today_reports_generated ?? 0}</strong>
              <small className="text-xs text-primary-600 block mt-1">Completed today</small>
            </div>
            <div className="p-4 rounded-lg bg-success-50/50 border border-success-200">
              <span className="text-xs font-medium text-success-600 uppercase">Samples Registered</span>
              <strong className="block text-2xl font-bold text-success-700 mt-1">{trackingSummary.today_samples_registered ?? 0}</strong>
              <small className="text-xs text-success-600 block mt-1">Received today</small>
            </div>
          </div>

          {recentActivities.length > 0 ? (
            <div className="border-t border-default-200 pt-4">
              <h4 className="text-xs font-bold text-default-600 uppercase mb-3 flex items-center gap-2">
                <ShieldCheck size={14} className="text-primary" /> Recent System Actions
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                {recentActivities.slice(0, 6).map((act: any) => (
                  <div key={act.id} className="flex items-center justify-between p-2.5 rounded-md bg-default-100/70 border border-default-200/60 text-xs">
                    <div className="flex items-center gap-2 truncate pr-2">
                      <CheckCircle2 size={13} className="text-primary shrink-0" />
                      <strong className="font-semibold text-default-800 shrink-0">{act.action?.replace(/_/g, ' ').toUpperCase()}:</strong>
                      <span className="text-default-600 truncate">{act.details || act.module || 'Action completed'}</span>
                    </div>
                    <span className="text-[11px] text-default-400 shrink-0">{act.time_ago || act.created_at}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* Financial & Volume Analytics Charts */}
      {trends && trends.monthly_registrations.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="surface p-5 rounded-xl border border-default-200 bg-content1 shadow-sm">
            <RegistrationTrendChart data={trends.monthly_registrations} />
          </section>
          <section className="surface p-5 rounded-xl border border-default-200 bg-content1 shadow-sm">
            <MonthlyRevenueChart data={trends.monthly_registrations} />
          </section>
        </div>
      ) : null}

      {/* Report Status Distribution & Expense Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {trends ? (
          <section className="surface p-5 rounded-xl border border-default-200 bg-content1 shadow-sm">
            <ReportStatusChart data={trends.report_statuses} />
          </section>
        ) : null}

        {monthExpenses.length > 0 ? (
          <section className="surface p-5 rounded-xl border border-default-200 bg-content1 shadow-sm">
            <ExpenseCategoryChart data={monthExpenses} />
          </section>
        ) : null}
      </div>
    </div>
  )
}
