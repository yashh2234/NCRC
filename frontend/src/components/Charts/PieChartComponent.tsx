import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface Props {
  data: Array<{ name: string; value: number; color: string }>
}

export function PieChartComponent({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
          {data.map((entry, index) => (
            <Cell key={index} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #dfe6ea', fontSize: 13 }} />
        <Legend verticalAlign="bottom" iconType="circle" iconSize={10} formatter={(value: string) => <span style={{ color: '#4a5b66', fontSize: 12, fontWeight: 600 }}>{value}</span>} />
      </PieChart>
    </ResponsiveContainer>
  )
}
