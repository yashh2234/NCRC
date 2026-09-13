import type { LucideIcon } from 'lucide-react'

interface MetricCardProps {
  label: string
  value: string | number
  detail: string
  icon: LucideIcon
}

export function MetricCard({ label, value, detail, icon: Icon }: MetricCardProps) {
  return (
    <article className="metric-tile">
      <Icon size={22} />
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  )
}
