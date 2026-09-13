import { lazy, Suspense } from 'react'

const COLORS = {
  primary: '#327268',
  secondary: '#b65f3c',
  accent: '#5b8a7c',
  pending: '#e8a838',
  complete: '#327268',
  cancel: '#c44a5a',
  muted: '#94a3b8',
}

interface MonthlyData {
  month: string
  total: number
  total_amount: number
  received_amount: number
  balance_amount: number
}

interface ChartProps {
  data: MonthlyData[]
}

interface ReportStatusData {
  total: number
  pending: number
  complete: number
  cancel: number
}

interface ReportStatusProps {
  data: ReportStatusData
}

function formatMonth(m: string) {
  const [y, mo] = m.split('-')
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[parseInt(mo, 10) - 1]} ${y}`
}

const LazyBarChart = lazy(() => import('./Charts/BarChartComponent').then((m) => ({ default: m.BarChartComponent })))
const LazyAreaChart = lazy(() => import('./Charts/AreaChartComponent').then((m) => ({ default: m.AreaChartComponent })))
const LazyPieChart = lazy(() => import('./Charts/PieChartComponent').then((m) => ({ default: m.PieChartComponent })))

export function RegistrationTrendChart({ data }: ChartProps) {
  const chartData = data.map((d) => ({ month: formatMonth(d.month), count: d.total }))
  return (
    <div className="chart-container">
      <p className="section-label">Trends</p>
      <h3>Monthly registrations</h3>
      <Suspense fallback={<div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#65737d' }}>Loading chart...</div>}>
        <LazyBarChart data={chartData} color={COLORS.primary} />
      </Suspense>
    </div>
  )
}

export function MonthlyRevenueChart({ data }: ChartProps) {
  const chartData = data.map((d) => ({
    month: formatMonth(d.month),
    total: Number(d.total_amount),
    received: Number(d.received_amount),
    balance: Number(d.balance_amount),
  }))
  return (
    <div className="chart-container">
      <p className="section-label">Revenue</p>
      <h3>Monthly payment overview</h3>
      <Suspense fallback={<div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#65737d' }}>Loading chart...</div>}>
        <LazyAreaChart data={chartData} colors={COLORS} />
      </Suspense>
    </div>
  )
}

export function ReportStatusChart({ data }: ReportStatusProps) {
  const pieData = [
    { name: 'Complete', value: data.complete, color: COLORS.complete },
    { name: 'Pending', value: data.pending, color: COLORS.pending },
    { name: 'Cancel', value: data.cancel, color: COLORS.cancel },
  ].filter((d) => d.value > 0)
  return (
    <div className="chart-container">
      <p className="section-label">Reports</p>
      <h3>Status distribution</h3>
      <Suspense fallback={<div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#65737d' }}>Loading chart...</div>}>
        <LazyPieChart data={pieData} />
      </Suspense>
    </div>
  )
}

interface ExpenseData {
  category: string
  total: number
}

interface ExpenseChartProps {
  data: ExpenseData[]
}

export function ExpenseCategoryChart({ data }: ExpenseChartProps) {
  const chartData = data.map((d) => ({ category: d.category.length > 18 ? d.category.slice(0, 18) + '...' : d.category, amount: Number(d.total) }))
  return (
    <div className="chart-container">
      <p className="section-label">Expenses</p>
      <h3>Monthly expenses by category</h3>
      {chartData.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#65737d', padding: '2rem 0', fontSize: '0.85rem' }}>No expenses this month</p>
      ) : (
        <Suspense fallback={<div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#65737d' }}>Loading chart...</div>}>
          <LazyBarChart data={chartData} color={COLORS.secondary} dataKey="amount" labelKey="category" />
        </Suspense>
      )}
    </div>
  )
}
