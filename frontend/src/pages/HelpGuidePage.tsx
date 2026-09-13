import {
  BookOpen, ArrowRight, ClipboardList, Briefcase, Sparkles,
  FileText, Eye, Truck, IndianRupee, CheckCircle2, AlertTriangle, Users, Info
} from 'lucide-react'

const STAGES = [
  { num: 1, name: 'Registered',        role: 'Registration', icon: ClipboardList, color: '#0891b2', bg: '#ecfeff', desc: 'Job registered, UID issued. Registration team handles intake.' },
  { num: 2, name: 'Field/Site Work',    role: 'Lab',          icon: Briefcase,     color: '#2563eb', bg: '#eff6ff', desc: 'Lab team visits site, collects samples, or does field testing.' },
  { num: 3, name: 'Lab Testing',        role: 'Lab',          icon: Sparkles,      color: '#059669', bg: '#ecfdf5', desc: 'Lab team performs tests on collected samples in the laboratory.' },
  { num: 4, name: 'Report Drafting',    role: 'Report Staff', icon: FileText,      color: '#d97706', bg: '#fffbeb', desc: 'Report staff drafts the test report based on lab results.' },
  { num: 5, name: 'Report Review',      role: 'Technical',    icon: Eye,           color: '#4f46e5', bg: '#eef2ff', desc: 'Technical reviewer (senior engineer) reviews and approves the report.' },
  { num: 6, name: 'Report Dispatched',  role: 'Registration', icon: Truck,         color: '#16a34a', bg: '#f0fdf4', desc: 'Registration sends the final report to the client (email/courier).' },
  { num: 7, name: 'Payment Pending',    role: 'Manager',      icon: IndianRupee,   color: '#dc2626', bg: '#fef2f2', desc: 'Manager follows up with the client for payment collection.' },
  { num: 8, name: 'Closed',             role: '—',            icon: CheckCircle2,  color: '#475569', bg: '#f1f5f9', desc: 'Payment received, job complete. Removed from all active queues.' },
]

const RULES = [
  { icon: AlertTriangle, text: 'ALWAYS update both "Current Stage" AND "Currently With" when handing over. Both fields drive the auto-filter and queue routing.' },
  { icon: ClipboardList, text: 'ALWAYS add a Stage Log entry at every handover. This is what makes "Days at Stage" work properly. Without it, the turnaround counter shows wrong numbers.' },
  { icon: Users, text: 'If a job is paused (client delay, missing samples), set Status = "On Hold". It still appears on the role queue but stops counting as "stuck".' },
  { icon: Info, text: 'Each role has their own dashboard queue that auto-shows only the jobs currently in their stages. When you update "Current Stage", the row instantly moves from one queue to another.' },
]

export function HelpGuidePage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 48 }}>

      {/* Header */}
      <section className="surface" style={{ background: 'linear-gradient(135deg, var(--gray-50) 0%, var(--color-surface) 100%)' }}>
        <div className="dash-section-header" style={{ marginBottom: 0 }}>
          <div>
            <p className="section-label"><BookOpen size={13} /> User Guide</p>
            <h2 style={{ fontSize: '1.4rem' }}>How the Namotech Job Tracker Works</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--gray-500)', marginTop: 4, maxWidth: 600 }}>
              One row = one job. Each role has its own personal queue that auto-shows only the jobs in their stages.
              When you update "Current Stage", the row instantly moves from one queue to another. No manual copying.
            </p>
          </div>
          <BookOpen size={28} style={{ color: 'var(--color-primary)', opacity: 0.4 }} />
        </div>
      </section>

      {/* The Big Idea */}
      <section className="surface">
        <div className="dash-section-header">
          <div>
            <p className="dash-section-label" style={{ color: 'var(--color-primary)' }}>The Big Idea</p>
            <h2 className="dash-section-title">8 Stages → 5 Roles → Automatic Routing</h2>
          </div>
        </div>
        <p style={{ fontSize: '0.88rem', color: 'var(--gray-600)', lineHeight: 1.7, maxWidth: 800 }}>
          Every job moves through 8 sequential stages. Each stage is owned by a specific role.
          When you change the "Current Stage" field on a job, it automatically appears in the new role's queue
          and disappears from the old one. The <strong>Stage Log</strong> tracks every handover with who, when, and why.
        </p>
      </section>

      {/* 8-Stage Workflow Visual */}
      <section className="surface">
        <div className="dash-section-header">
          <div>
            <p className="dash-section-label" style={{ color: '#7c3aed' }}>The Workflow</p>
            <h2 className="dash-section-title">8-Stage Pipeline</h2>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {STAGES.map((st, i) => (
            <div
              key={st.num}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                padding: '16px 20px',
                borderRadius: 'var(--radius-sm)',
                border: `1px solid ${st.color}22`,
                background: st.bg,
                transition: 'all 0.15s ease',
              }}
            >
              {/* Stage number */}
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: st.color, color: '#fff',
                display: 'grid', placeItems: 'center',
                fontWeight: 800, fontSize: '0.9rem', flexShrink: 0,
              }}>
                {st.num}
              </div>

              {/* Icon */}
              <st.icon size={18} style={{ color: st.color, flexShrink: 0 }} />

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, color: st.color, fontSize: '0.9rem' }}>
                  Stage {st.num}: {st.name}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--gray-600)', marginTop: 2 }}>
                  {st.desc}
                </div>
              </div>

              {/* Role badge */}
              <span className="badge" style={{ background: `${st.color}15`, color: st.color, flexShrink: 0 }}>
                <Users size={11} /> {st.role}
              </span>

              {/* Arrow (not on last) */}
              {i < STAGES.length - 1 && (
                <ArrowRight size={16} style={{ color: 'var(--gray-300)', flexShrink: 0 }} />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* How a Job Moves — Step by Step */}
      <section className="surface">
        <div className="dash-section-header">
          <div>
            <p className="dash-section-label" style={{ color: '#059669' }}>Step-by-Step</p>
            <h2 className="dash-section-title">How a Job Moves Through the Pipeline</h2>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: '0.85rem', color: 'var(--gray-700)', lineHeight: 1.7 }}>
          <div className="attention-item">
            <div className="attention-item__info">
              <strong style={{ color: '#0891b2', minWidth: 20 }}>1.</strong>
              <span><strong>Registration</strong> receives a new request → opens Registration page → fills in details → UID auto-generates → sets Current Stage = "1. Registered". The row immediately appears on the Registration queue.</span>
            </div>
          </div>
          <div className="attention-item">
            <div className="attention-item__info">
              <strong style={{ color: '#2563eb', minWidth: 20 }}>2.</strong>
              <span>After registration, change Current Stage to "2. Field/Site Work" AND update Currently With = (lab person's name). The row vanishes from Registration queue and appears on Lab queue. <strong>Add a Stage Log entry.</strong></span>
            </div>
          </div>
          <div className="attention-item">
            <div className="attention-item__info">
              <strong style={{ color: '#059669', minWidth: 20 }}>3.</strong>
              <span>Lab does field/lab work, then changes Current Stage to "4. Report Drafting" and Currently With = (report staff). Adds Stage Log entry. The row moves to Report Staff queue.</span>
            </div>
          </div>
          <div className="attention-item">
            <div className="attention-item__info">
              <strong style={{ color: '#d97706', minWidth: 20 }}>4.</strong>
              <span>Report Staff drafts the report, changes Current Stage to "5. Report Review" and Currently With = (reviewer). Adds Stage Log. The row appears on Technical queue.</span>
            </div>
          </div>
          <div className="attention-item">
            <div className="attention-item__info">
              <strong style={{ color: '#4f46e5', minWidth: 20 }}>5.</strong>
              <span>After review, set Current Stage to "6. Report Dispatched" (back to Registration for sending) — or back to "4. Report Drafting" if revision needed. Add Stage Log.</span>
            </div>
          </div>
          <div className="attention-item">
            <div className="attention-item__info">
              <strong style={{ color: '#16a34a', minWidth: 20 }}>6.</strong>
              <span>Registration emails/couriers the report, fills dispatch date, sets Current Stage to "7. Payment Pending". Row moves to Manager queue.</span>
            </div>
          </div>
          <div className="attention-item">
            <div className="attention-item__info">
              <strong style={{ color: '#dc2626', minWidth: 20 }}>7.</strong>
              <span>Manager follows up with client. When payment lands, sets Payment Status = "Fully Received", fills Amount Received, changes Current Stage to "8. Closed" and Status to "Closed".</span>
            </div>
          </div>
          <div className="attention-item">
            <div className="attention-item__info">
              <strong style={{ color: '#475569', minWidth: 20 }}>8.</strong>
              <span>The job disappears from all active queues but stays in the register for permanent records and audit trail.</span>
            </div>
          </div>
        </div>
      </section>

      {/* Team Rules */}
      <section className="surface">
        <div className="dash-section-header">
          <div>
            <p className="dash-section-label" style={{ color: '#dc2626' }}>Important Rules</p>
            <h2 className="dash-section-title">Rules Your Team Must Follow</h2>
          </div>
          <AlertTriangle size={20} style={{ color: '#dc2626' }} />
        </div>
        <div className="attention-stack">
          {RULES.map((rule, i) => (
            <div key={i} className="attention-item attention-item--alert">
              <div className="attention-item__info">
                <rule.icon size={16} style={{ color: '#dc2626', flexShrink: 0 }} />
                <span className="attention-item__label">{rule.text}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Role Summary */}
      <section className="surface">
        <div className="dash-section-header">
          <div>
            <p className="dash-section-label" style={{ color: '#7c3aed' }}>Quick Reference</p>
            <h2 className="dash-section-title">Role → Stage Mapping</h2>
          </div>
        </div>
        <div className="table-card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Owned Stages</th>
                  <th>Responsibility</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><span className="badge" style={{ color: '#0891b2', background: '#ecfeff' }}>Registration</span></td>
                  <td>1. Registered, 6. Report Dispatched</td>
                  <td>Job intake, UID generation, report dispatch to client</td>
                </tr>
                <tr>
                  <td><span className="badge" style={{ color: '#059669', background: '#ecfdf5' }}>Lab / Field</span></td>
                  <td>2. Field/Site Work, 3. Lab Testing</td>
                  <td>Field visits, sample collection, laboratory testing</td>
                </tr>
                <tr>
                  <td><span className="badge" style={{ color: '#d97706', background: '#fffbeb' }}>Report Staff</span></td>
                  <td>4. Report Drafting</td>
                  <td>Draft test reports from lab results</td>
                </tr>
                <tr>
                  <td><span className="badge" style={{ color: '#4f46e5', background: '#eef2ff' }}>Technical</span></td>
                  <td>5. Report Review</td>
                  <td>Review, approve, or request corrections on reports</td>
                </tr>
                <tr>
                  <td><span className="badge" style={{ color: '#dc2626', background: '#fef2f2' }}>Manager</span></td>
                  <td>7. Payment Pending</td>
                  <td>Payment follow-up, financial oversight, job closure</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  )
}
