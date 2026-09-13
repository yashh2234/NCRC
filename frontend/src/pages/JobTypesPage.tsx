import {
  Briefcase, FlaskConical, Hammer, Search, Clock, Tag
} from 'lucide-react'
import { useState } from 'react'

/*
 * Standard job types from the Namotech Job Tracker Excel.
 * In a future version these can be fetched from a backend API.
 */
const JOB_TYPES = [
  { code: 'SPT',   name: 'Standard Penetration Test (SPT)',   category: 'Lab / Investigation', stdDays: 7 },
  { code: 'SOIL',  name: 'Soil Investigation (boreholes)',    category: 'Lab / Investigation', stdDays: 10 },
  { code: 'MAT',   name: 'Material Testing — Concrete',      category: 'Lab',                  stdDays: 3 },
  { code: 'MAT-S', name: 'Material Testing — Steel/Rebar',   category: 'Lab',                  stdDays: 3 },
  { code: 'MAT-A', name: 'Material Testing — Aggregate',     category: 'Lab',                  stdDays: 3 },
  { code: 'MAT-B', name: 'Material Testing — Bricks/Blocks', category: 'Lab',                  stdDays: 3 },
  { code: 'MAT-C', name: 'Material Testing — Cement',        category: 'Lab',                  stdDays: 3 },
  { code: 'BIT',   name: 'Material Testing — Bitumen',       category: 'Lab',                  stdDays: 3 },
  { code: 'NDT-R', name: 'NDT — Rebound Hammer',             category: 'Lab / NDT',            stdDays: 2 },
  { code: 'NDT-U', name: 'NDT — Ultrasonic Pulse Velocity (UPV)', category: 'Lab / NDT',       stdDays: 2 },
  { code: 'NDT-C', name: 'NDT — Carbonation',                category: 'Lab / NDT',            stdDays: 2 },
]

const CATEGORIES = ['All', ...Array.from(new Set(JOB_TYPES.map((j) => j.category)))]

function getCategoryIcon(cat: string) {
  if (cat.includes('Investigation')) return Hammer
  if (cat.includes('NDT')) return FlaskConical
  return Briefcase
}

function getCategoryColor(cat: string) {
  if (cat.includes('Investigation')) return { color: '#4f46e5', bg: '#eef2ff' }
  if (cat.includes('NDT'))           return { color: '#d97706', bg: '#fffbeb' }
  return { color: '#059669', bg: '#ecfdf5' }
}

export function JobTypesPage() {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')

  const filtered = JOB_TYPES.filter((jt) => {
    const matchSearch = !search.trim() ||
      [jt.code, jt.name, jt.category].join(' ').toLowerCase().includes(search.toLowerCase())
    const matchCat = category === 'All' || jt.category === category
    return matchSearch && matchCat
  })

  return (
    <div className="surface">
      <div className="dash-section-header">
        <div>
          <p className="section-label">Master Data</p>
          <h2>Job Types & Services</h2>
        </div>
        <span className="sync-pill">{filtered.length} types</span>
      </div>

      {/* Filters */}
      <div className="user-toolbar" style={{ marginBottom: 20 }}>
        <div className="search-field" style={{ minWidth: 260 }}>
          <Search size={15} />
          <input
            placeholder="Search by code, name, or category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="tab-nav">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`tab-btn${category === cat ? ' active' : ''}`}
              onClick={() => setCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Job Types Table */}
      <div className="table-card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Job Type / Service Name</th>
                <th>Category</th>
                <th>Standard Days</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <div className="empty-state">No job types match your search.</div>
                  </td>
                </tr>
              ) : (
                filtered.map((jt) => {
                  const catStyle = getCategoryColor(jt.category)
                  const CatIcon = getCategoryIcon(jt.category)
                  return (
                    <tr key={jt.code}>
                      <td>
                        <span className="uid-cell">{jt.code}</span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{jt.name}</td>
                      <td>
                        <span
                          className="badge"
                          style={{ color: catStyle.color, background: catStyle.bg }}
                        >
                          <CatIcon size={12} /> {jt.category}
                        </span>
                      </td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--gray-600)', fontWeight: 600 }}>
                          <Clock size={13} /> {jt.stdDays} days
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info note */}
      <p style={{ fontSize: '0.78rem', color: 'var(--gray-400)', marginTop: 16, textAlign: 'center' }}>
        These job types match the Namotech Job Tracker standard services. Contact your administrator to add or modify entries.
      </p>
    </div>
  )
}
