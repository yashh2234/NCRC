/**
 * TMT steel (IS 1786) lab report formats.
 * Values come from "Fe steel software.xlsx" (IS 1786 Amd.4:2008, IS 1608 Part-1:2022, IS 1599:2019).
 * Keep in sync with backend/app/Services/SteelReport.php.
 */

export const STEEL_STANDARD = 'IS 1786 Amd.4 : 2008, IS 1608 Part -1:2022, IS 1599 :2019'

export interface SteelGrade {
  label: string
  /** UTS must be this many percent more than the actual 0.2% proof stress… */
  utsPercent: number
  /** …but not less than this (N/mm2) */
  utsMin: number
  /** 0.2% proof stress, not less than (MPa) */
  proofMin: number
  /** Elongation %, not less than */
  elongationMin: number
}

export const STEEL_GRADES: Record<string, SteelGrade> = {
  steel_fe415: { label: 'Fe-415', utsPercent: 10, utsMin: 485, proofMin: 415, elongationMin: 14.5 },
  steel_fe415d: { label: 'Fe-415D', utsPercent: 12, utsMin: 500, proofMin: 415, elongationMin: 18 },
  steel_fe500: { label: 'Fe-500', utsPercent: 8, utsMin: 545, proofMin: 500, elongationMin: 12 },
  steel_fe500d: { label: 'Fe-500D', utsPercent: 10, utsMin: 565, proofMin: 500, elongationMin: 16 },
  steel_fe550: { label: 'Fe-550', utsPercent: 6, utsMin: 585, proofMin: 550, elongationMin: 10 },
  steel_fe550d: { label: 'Fe-550D', utsPercent: 8, utsMin: 600, proofMin: 550, elongationMin: 14.5 },
}

/** Dia (mm) → nominal weight per metre (kg) and permissible variation (± %) */
export const STEEL_DIAS: Record<string, { weight: number; tolerance: number }> = {
  '8': { weight: 0.395, tolerance: 7 },
  '10': { weight: 0.617, tolerance: 7 },
  '12': { weight: 0.888, tolerance: 5 },
  '16': { weight: 1.58, tolerance: 5 },
  '20': { weight: 2.47, tolerance: 3 },
  '25': { weight: 3.85, tolerance: 3 },
  '32': { weight: 6.31, tolerance: 3 },
}

export const STEEL_MAX_SAMPLES = 6
export const DEFAULT_BEND = 'No transverse crack in bend portion'
export const DEFAULT_REBEND = 'No any fracture in bend portion'

export const isSteelFormat = (key: string | undefined | null): boolean => !!key && key in STEEL_GRADES

export function utsRequirementText(g: SteelGrade): string {
  return `${g.utsPercent}% more than actual 0.2% proof stress but not less than ${g.utsMin.toFixed(1)} N/mm2`
}

export type Check = 'pass' | 'fail' | null

export interface SteelEvaluation {
  nominalWeight: number | null
  tolerance: number | null
  weightDeviation: number | null
  weightCheck: Check
  requiredUts: number | null
  utsCheck: Check
  proofCheck: Check
  elongationCheck: Check
}

const num = (v: string | undefined): number | null => {
  const t = (v ?? '').trim()
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

/** IS 1786 compliance for one sample */
export function evaluateSteel(grade: SteelGrade, s: { dia?: string; weight?: string; uts?: string; proof?: string; elong?: string }): SteelEvaluation {
  const dia = STEEL_DIAS[s.dia ?? '']
  const weight = num(s.weight)
  const uts = num(s.uts)
  const proof = num(s.proof)
  const elong = num(s.elong)

  const weightDeviation = dia && weight !== null ? ((weight - dia.weight) / dia.weight) * 100 : null
  // UTS ≥ X% over the actual proof stress, and never below the grade minimum
  const requiredUts = proof !== null ? Math.max(proof * (1 + grade.utsPercent / 100), grade.utsMin) : null

  return {
    nominalWeight: dia?.weight ?? null,
    tolerance: dia?.tolerance ?? null,
    weightDeviation,
    weightCheck: weightDeviation === null || !dia ? null : Math.abs(weightDeviation) <= dia.tolerance + 1e-9 ? 'pass' : 'fail',
    requiredUts,
    utsCheck: uts === null || requiredUts === null ? null : uts >= requiredUts - 1e-9 ? 'pass' : 'fail',
    proofCheck: proof === null ? null : proof >= grade.proofMin ? 'pass' : 'fail',
    elongationCheck: elong === null ? null : elong >= grade.elongationMin ? 'pass' : 'fail',
  }
}

/** labData key for sample i (1-based) */
export const steelKey = (i: number, field: string) => `s${i}_${field}`
