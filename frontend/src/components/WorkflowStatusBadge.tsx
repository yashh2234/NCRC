import { useState, useEffect } from 'react'
import { request } from '../lib/api'

interface JobInfo {
  id: number
  uid_no: string
  status: string
  current_stage: { name: string; slug: string; color: string } | null
}

const STAGE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  inquiry:          { bg: '#f3f4f6', text: '#374151', border: '#d1d5db' },
  quotation:        { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' },
  work_order:       { bg: '#dbeafe', text: '#1e40af', border: '#93c5fd' },
  registration:     { bg: '#e0e7ff', text: '#3730a3', border: '#a5b4fc' },
  sample_received:  { bg: '#d1fae5', text: '#065f46', border: '#6ee7b7' },
  assigned:         { bg: '#fce7f3', text: '#9d174d', border: '#f9a8d4' },
  testing:          { bg: '#ede9fe', text: '#5b21b6', border: '#c4b5fd' },
  report_draft:     { bg: '#fff7ed', text: '#9a3412', border: '#fdba74' },
  technical_review: { bg: '#fefce8', text: '#854d0e', border: '#fde047' },
  approval:         { bg: '#ecfdf5', text: '#064e3b', border: '#6ee7b7' },
  billing:          { bg: '#fdf2f8', text: '#9d174d', border: '#f9a8d4' },
  dispatch:         { bg: '#f0fdf4', text: '#166534', border: '#86efac' },
  completed:        { bg: '#dcfce7', text: '#166534', border: '#86efac' },
}

interface WorkflowStatusBadgeProps {
  uidNo: string
  compact?: boolean
}

export function WorkflowStatusBadge({ uidNo, compact = false }: WorkflowStatusBadgeProps) {
  const [job, setJob] = useState<JobInfo | null>(null)

  useEffect(() => {
    if (!uidNo) return
    let cancelled = false

    request<{ data: JobInfo[] }>(`/jobs?search=${encodeURIComponent(uidNo)}&per_page=1`)
      .then(res => {
        if (!cancelled && res.data?.length) {
          setJob(res.data[0])
        }
      })
      .catch(() => {})

    return () => { cancelled = true }
  }, [uidNo])

  if (!job) return null

  const stageSlug = job.current_stage?.slug ?? ''
  const colors = STAGE_COLORS[stageSlug] ?? { bg: '#f3f4f6', text: '#374151', border: '#d1d5db' }
  const stageName = job.current_stage?.name ?? job.status

  if (compact) {
    return (
      <span
        style={{
          display: 'inline-block',
          padding: '2px 8px',
          borderRadius: '9999px',
          fontSize: '11px',
          fontWeight: 600,
          backgroundColor: colors.bg,
          color: colors.text,
          border: `1px solid ${colors.border}`,
          lineHeight: '18px',
        }}
      >
        {stageName}
      </span>
    )
  }

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 12px',
        borderRadius: '8px',
        fontSize: '12px',
        fontWeight: 600,
        backgroundColor: colors.bg,
        color: colors.text,
        border: `1px solid ${colors.border}`,
      }}
    >
      <span
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: colors.text,
          opacity: 0.6,
        }}
      />
      {stageName}
    </div>
  )
}
