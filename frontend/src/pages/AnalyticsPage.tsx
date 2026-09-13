import { useState, useEffect } from 'react'
import { BarChart3, TrendingUp, Clock, Users, Building2, Download, FlaskConical, Loader } from 'lucide-react'
import { request } from '../lib/api'

interface AnalyticsData {
  overview: {
    total_registrations: number; total_reports: number; pending_reports: number
    total_clients: number; active_jobs: number; overdue_jobs: number
    total_billing: number; total_received: number; total_invoiced: number
  }
  revenue: {
    monthly_registrations: Array<{ month: string; total: number; total_amount: number; advance_amount: number; balance_amount: number }>
    monthly_invoices: Record<string, { month: string; invoice_count: number; net_amount: number; gst_amount: number }>
    year_total: number; year_invoiced: number
  }
  tests: {
    by_type: Array<{ type: string; total: number }>
    by_status: Record<string, number>
    total: number
  }
  turnaround: {
    by_type: Array<{ report_type: string; avg_hours: number; min_hours: number; max_hours: number; count: number }>
  }
  productivity: Array<{ name: string; is_admin: boolean; reports_generated: number; tests_completed: number }>
  clients: {
    top_by_volume: Array<{ agency_name: string; total: number; total_amount: number }>
    top_by_revenue: Array<{ agency_name: string; total_amount: number; total: number }>
  }
  delays: {
    overdue_stages: Array<{ uid: string; stage: string; overdue_hours: number }>
    long_pending_reports: Array<{ uid_no: string; report_type: string; status: string; days_pending: number }>
  }
}

function money(v: number) { return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(v) }
function pct(v: number, t: number) { return t > 0 ? ((v / t) * 100).toFixed(1) : '0' }

export function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const result = await request<AnalyticsData>('/analytics/summary')
      setData(result)
    } catch {} finally { setLoading(false) }
  }

  const exportCsv = async (type: string) => {
    const token = window.localStorage.getItem('legacy_erp_token')
    window.open(`http://localhost:8000/api/analytics/export/${type}${token ? `?token=${token}` : ''}`, '_blank')
  }

  if (loading) {
    return <div style={{ padding: 48, textAlign: 'center', color: '#65737d' }}><Loader size={32} /><p style={{ marginTop: 12 }}>Loading analytics...</p></div>
  }
  if (!data) return <div className="error-banner">Failed to load analytics</div>

  const { overview, revenue, tests, turnaround, productivity, clients } = data

  const tabs = [
    { key: 'overview', label: 'Overview', icon: BarChart3 },
    { key: 'revenue', label: 'Revenue', icon: TrendingUp },
    { key: 'tests', label: 'Tests', icon: FlaskConical },
    { key: 'turnaround', label: 'TAT', icon: Clock },
    { key: 'productivity', label: 'Productivity', icon: Users },
    { key: 'clients', label: 'Clients', icon: Building2 },
  ]

  return (
    <div>
      {/* Tab navigation */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid #e8eef1', overflow: 'auto' }}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={`ghost-button ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
            type="button"
            style={{
              borderBottom: activeTab === tab.key ? '2px solid #138a6b' : '2px solid transparent',
              borderRadius: 0, padding: '10px 16px', whiteSpace: 'nowrap',
            }}
          >
            <tab.icon size={16} /> {tab.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        {['revenue', 'tests', 'turnaround', 'clients'].includes(activeTab) ? (
          <button className="ghost-button" onClick={() => exportCsv(activeTab)} type="button" style={{ whiteSpace: 'nowrap' }}>
            <Download size={16} /> Export CSV
          </button>
        ) : null}
      </div>

      {/* === OVERVIEW === */}
      {activeTab === 'overview' ? (
        <div>
          {/* KPI strip */}
          <div className="metric-strip">
            {[
              { label: 'Registrations', value: overview.total_registrations, detail: `${overview.pending_reports} pending reports` },
              { label: 'Total Reports', value: overview.total_reports, detail: `${overview.pending_reports} pending` },
              { label: 'Clients', value: overview.total_clients, detail: 'registered' },
              { label: 'Active Jobs', value: overview.active_jobs, detail: `${overview.overdue_jobs} overdue` },
              { label: 'Total Billing', value: `₹${money(overview.total_billing)}`, detail: `₹${money(overview.total_received)} received` },
              { label: 'Invoiced', value: `₹${money(overview.total_invoiced)}`, detail: 'total invoiced' },
            ].map((m) => (
              <div key={m.label} className="metric-card">
                <div className="metric-label">{m.label}</div>
                <div className="metric-value">{m.value}</div>
                <span>{m.detail}</span>
              </div>
            ))}
          </div>

          <div className="two-column" style={{ marginTop: 20 }}>
            {/* Revenue trend mini */}
            <section className="surface">
              <div className="surface-heading">
                <strong>Monthly Revenue Trend</strong>
                <TrendingUp size={18} />
              </div>
              {revenue.monthly_registrations.length === 0 ? <p style={{ color: '#65737d', padding: 16 }}>No data</p> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
                  {revenue.monthly_registrations.slice(-6).map((m) => (
                    <div key={m.month} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem' }}>
                      <span style={{ width: 60, fontWeight: 600 }}>{m.month}</span>
                      <div style={{ flex: 1, height: 20, background: '#f3f4f6', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ width: `${pct(Number(m.total_amount), Number(revenue.monthly_registrations.map(r => r.total_amount).reduce((a, b) => a + Number(b), 0)) / revenue.monthly_registrations.length)}%`, height: '100%', background: '#10b981', borderRadius: 4, minWidth: 20 }} />
                      </div>
                      <span style={{ width: 80, textAlign: 'right' }}>₹{money(Number(m.total_amount))}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Test distribution mini */}
            <section className="surface">
              <div className="surface-heading">
                <strong>Test Distribution</strong>
                <FlaskConical size={18} />
              </div>
              {tests.by_type.length === 0 ? <p style={{ color: '#65737d', padding: 16 }}>No data</p> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
                  {tests.by_type.sort((a, b) => b.total - a.total).slice(0, 6).map((t) => (
                    <div key={t.type} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem' }}>
                      <span style={{ flex: 1 }}>{t.type.replace(/_/g, ' ')}</span>
                      <div style={{ width: 100, height: 16, background: '#f3f4f6', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ width: `${pct(t.total, tests.total)}%`, height: '100%', background: '#3b82f6', borderRadius: 4, minWidth: 16 }} />
                      </div>
                      <span style={{ width: 40, textAlign: 'right', fontWeight: 600 }}>{t.total}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      ) : null}

      {/* === REVENUE === */}
      {activeTab === 'revenue' ? (
        <div>
          <div className="metric-strip" style={{ marginBottom: 16 }}>
            <div className="metric-card"><div className="metric-label">Year Total</div><div className="metric-value">₹{money(revenue.year_total)}</div></div>
            <div className="metric-card"><div className="metric-label">Total Invoiced</div><div className="metric-value">₹{money(revenue.year_invoiced)}</div></div>
          </div>
          <section className="surface">
            <div className="surface-heading"><strong>Monthly Revenue</strong></div>
            <table className="analytics-table">
              <thead><tr><th>Month</th><th>Registrations</th><th>Total Amount</th><th>Advance</th><th>Balance</th><th>Invoiced</th></tr></thead>
              <tbody>
                {revenue.monthly_registrations.map((m) => {
                  const inv = revenue.monthly_invoices[m.month]
                  return (
                    <tr key={m.month}>
                      <td><strong>{m.month}</strong></td>
                      <td>{m.total}</td>
                      <td>₹{money(Number(m.total_amount))}</td>
                      <td>₹{money(Number(m.advance_amount))}</td>
                      <td>₹{money(Number(m.balance_amount))}</td>
                      <td>{inv ? `₹${money(Number(inv.net_amount))}` : '-'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </section>
        </div>
      ) : null}

      {/* === TESTS === */}
      {activeTab === 'tests' ? (
        <div>
          <div className="metric-strip" style={{ marginBottom: 16 }}>
            <div className="metric-card"><div className="metric-label">Total Tests</div><div className="metric-value">{tests.total}</div></div>
            {Object.entries(tests.by_status).map(([s, c]) => (
              <div key={s} className="metric-card"><div className="metric-label">{s}</div><div className="metric-value">{c}</div></div>
            ))}
          </div>
          <section className="surface">
            <div className="surface-heading"><strong>Test Volume by Type</strong></div>
            <table className="analytics-table">
              <thead><tr><th>Test Type</th><th>Total</th><th>% Share</th></tr></thead>
              <tbody>
                {tests.by_type.sort((a, b) => b.total - a.total).map((t) => (
                  <tr key={t.type}>
                    <td><strong>{t.type.replace(/_/g, ' ')}</strong></td>
                    <td>{t.total}</td>
                    <td>{pct(t.total, tests.total)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      ) : null}

      {/* === TURNAROUND === */}
      {activeTab === 'turnaround' ? (
        <section className="surface">
          <div className="surface-heading"><strong>Average Turnaround Time by Test Type</strong></div>
          <table className="analytics-table">
            <thead><tr><th>Test Type</th><th>Avg Hours</th><th>Avg Days</th><th>Min Hours</th><th>Max Hours</th><th>Count</th></tr></thead>
            <tbody>
              {turnaround.by_type.map((t) => (
                <tr key={t.report_type}>
                  <td><strong>{t.report_type.replace(/_/g, ' ')}</strong></td>
                  <td>{t.avg_hours.toFixed(1)}</td>
                  <td>{(t.avg_hours / 24).toFixed(1)}</td>
                  <td>{t.min_hours}</td>
                  <td>{t.max_hours}</td>
                  <td>{t.count}</td>
                </tr>
              ))}
              {turnaround.by_type.length === 0 ? <tr><td colSpan={6} style={{ textAlign: 'center', color: '#65737d' }}>No completed reports with timing data.</td></tr> : null}
            </tbody>
          </table>
        </section>
      ) : null}

      {/* === PRODUCTIVITY === */}
      {activeTab === 'productivity' ? (
        <section className="surface">
          <div className="surface-heading"><strong>Employee Activity</strong></div>
          <table className="analytics-table">
            <thead><tr><th>Name</th><th>Role</th><th>Reports Generated</th><th>Tests Completed</th></tr></thead>
            <tbody>
              {productivity.map((p) => (
                <tr key={p.name}>
                  <td><strong>{p.name}</strong></td>
                  <td>{p.is_admin ? 'Admin' : 'Staff'}</td>
                  <td>{p.reports_generated}</td>
                  <td>{p.tests_completed}</td>
                </tr>
              ))}
              {productivity.length === 0 ? <tr><td colSpan={4} style={{ textAlign: 'center', color: '#65737d' }}>No activity data yet.</td></tr> : null}
            </tbody>
          </table>
        </section>
      ) : null}

      {/* === CLIENTS === */}
      {activeTab === 'clients' ? (
        <div className="two-column">
          <section className="surface">
            <div className="surface-heading"><strong>Top Clients by Volume</strong></div>
            <table className="analytics-table">
              <thead><tr><th>#</th><th>Agency</th><th>Projects</th><th>Total Amount</th></tr></thead>
              <tbody>
                {clients.top_by_volume.map((c, i) => (
                  <tr key={c.agency_name}>
                    <td>{i + 1}</td>
                    <td><strong>{c.agency_name}</strong></td>
                    <td>{c.total}</td>
                    <td>₹{money(Number(c.total_amount))}</td>
                  </tr>
                ))}
                {clients.top_by_volume.length === 0 ? <tr><td colSpan={4} style={{ textAlign: 'center', color: '#65737d' }}>No data</td></tr> : null}
              </tbody>
            </table>
          </section>
          <section className="surface">
            <div className="surface-heading"><strong>Top Clients by Revenue</strong></div>
            <table className="analytics-table">
              <thead><tr><th>#</th><th>Agency</th><th>Revenue</th><th>Projects</th></tr></thead>
              <tbody>
                {clients.top_by_revenue.map((c, i) => (
                  <tr key={c.agency_name}>
                    <td>{i + 1}</td>
                    <td><strong>{c.agency_name}</strong></td>
                    <td>₹{money(Number(c.total_amount))}</td>
                    <td>{c.total}</td>
                  </tr>
                ))}
                {clients.top_by_revenue.length === 0 ? <tr><td colSpan={4} style={{ textAlign: 'center', color: '#65737d' }}>No data</td></tr> : null}
              </tbody>
            </table>
          </section>
        </div>
      ) : null}
    </div>
  )
}
