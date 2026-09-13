import { useState, useEffect, type ReactNode } from 'react'
import { Briefcase, Clock, User, Filter } from 'lucide-react'
import { DataTable } from '../components/DataTable'
import { request } from '../lib/api'
import type { Job } from '../lib/types'
import { JobDetailPage } from './JobDetailPage'
import { StatusBadge } from '../components/ui'

export function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null)

  useEffect(() => { loadJobs() }, [])

  const loadJobs = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      if (priorityFilter) params.set('priority', priorityFilter)
      if (searchQuery) params.set('search', searchQuery)
      params.set('per_page', '50')
      const data = await request<{ data: Job[] }>(`/jobs?${params.toString()}`)
      setJobs(data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load jobs')
    } finally { setLoading(false) }
  }

  useEffect(() => { void loadJobs() }, [statusFilter, priorityFilter, searchQuery])

  const columns = [
    { key: 'uid_no', label: 'UID' },
    { key: 'title', label: 'Title' },
    { key: 'stage', label: 'Current Stage' },
    { key: 'status', label: 'Status' },
    { key: 'priority', label: 'Priority' },
    { key: 'assigned', label: 'Assigned To' },
    { key: 'sla', label: 'SLA' },
    { key: 'age', label: 'Age' },
  ]

  const rows: Array<Record<string, ReactNode>> = jobs.map((job) => ({
    uid_no: <strong>{job.uid_no}</strong>,
    title: job.title ?? '-',
    stage: job.current_stage ? (
      <StatusBadge color={job.current_stage.color}>{job.current_stage.name}</StatusBadge>
    ) : <span style={{ color: '#65737d' }}>Not started</span>,
    status: <StatusBadge status={job.status} />,
    priority: <StatusBadge priority={job.priority} />,
    assigned: job.assigned_user ? <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><User size={13} /> {job.assigned_user.name}</span> : <span style={{ color: '#65737d' }}>Unassigned</span>,
    sla: job.active_stage_tracking?.sla_deadline ? (
      <span style={{ color: job.active_stage_tracking.is_overdue ? '#ef4444' : '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}>
        <Clock size={13} />
        {job.active_stage_tracking.is_overdue ? `${Math.floor(job.active_stage_tracking.overdue_minutes / 60)}h overdue` : 'On track'}
      </span>
    ) : <span style={{ color: '#65737d' }}>No SLA</span>,
    age: job.created_at ? (
      <span style={{ fontSize: '0.82rem', color: '#65737d' }}>
        {Math.floor((Date.now() - new Date(job.created_at).getTime()) / (1000 * 60 * 60 * 24))}d
      </span>
    ) : '-',
    _id: job.id,
  }))

  const handleRowClick = (row: Record<string, ReactNode>) => {
    const id = row._id as number
    if (id) setSelectedJobId(id)
  }

  // Show detail page when a job is selected
  if (selectedJobId) {
    return <JobDetailPage jobId={selectedJobId} onBack={() => { setSelectedJobId(null); void loadJobs() }} />
  }

  return (
    <div className="surface">
      <div className="surface-heading">
        <div>
          <p className="section-label">Workflow</p>
          <h2>All Jobs</h2>
        </div>
        <Briefcase size={20} />
      </div>

      {/* Filters */}
      <div className="user-toolbar">
        <div className="search-field" style={{ width: 200 }}>
          <input placeholder="Search UID or title..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
        <select className="form-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="on_hold">On Hold</option>
        </select>
        <select className="form-select" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
          <option value="">All Priority</option>
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
        <span className="sync-pill">{jobs.length} jobs</span>
        <button className="ghost-button" onClick={() => void loadJobs()} type="button"><Filter size={16} /> Refresh</button>
      </div>

      {error ? <div className="error-banner">{error}</div> : null}

      {loading ? (
        <p style={{ padding: 32, textAlign: 'center', color: '#65737d' }}>Loading jobs...</p>
      ) : (
        <DataTable columns={columns} rows={rows} pageSize={20} filename="jobs-export" onRowClick={handleRowClick} />
      )}
    </div>
  )
}
