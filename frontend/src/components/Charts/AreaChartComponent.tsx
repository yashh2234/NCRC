import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface Props {
  data: Array<{ month: string; total: number; received: number; balance: number }>
  colors: Record<string, string>
}

export function AreaChartComponent({ data, colors }: Props) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#edf0f4" />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} />
        <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
        <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }} labelStyle={{ fontWeight: 700 }} />
        <Area type="monotone" dataKey="total" stackId="1" stroke={colors.primary} fill={colors.primary} fillOpacity={0.15} name="Total" />
        <Area type="monotone" dataKey="received" stackId="2" stroke={colors.accent} fill={colors.accent} fillOpacity={0.15} name="Received" />
        <Area type="monotone" dataKey="balance" stackId="3" stroke={colors.secondary} fill={colors.secondary} fillOpacity={0.15} name="Balance" />
      </AreaChart>
    </ResponsiveContainer>
  )
}
