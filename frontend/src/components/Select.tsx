import { Children, Fragment, isValidElement, type CSSProperties, type ReactNode } from 'react'
import { Dropdown, type DropdownOption } from './Dropdown'

interface Props {
  value: string | number | null | undefined
  onChange: (e: { target: { value: string } }) => void
  /** <option> and <optgroup>, like in a <select> */
  children?: ReactNode
  'aria-label'?: string
  disabled?: boolean
  required?: boolean
  /** false: no search box, also above a long list */
  searchable?: boolean
  className?: string
  style?: CSSProperties
  title?: string
  id?: string
}

function textOf(node: ReactNode): string {
  return Children.toArray(node).map((n) => (typeof n === 'string' || typeof n === 'number' ? String(n) : isValidElement<{ children?: ReactNode }>(n) ? textOf(n.props.children) : '')).join('')
}

function readOptions(children: ReactNode, group?: string): DropdownOption[] {
  const list: DropdownOption[] = []
  Children.forEach(children, (child) => {
    if (!isValidElement<{ value?: string | number; label?: string; disabled?: boolean; children?: ReactNode }>(child)) return
    const { value, label, disabled, children: inner } = child.props
    if (child.type === 'option') {
      const text = textOf(inner)
      list.push({ value: value === undefined ? text : String(value), label: text, disabled, group })
    } else if (child.type === 'optgroup') list.push(...readOptions(inner, label))
    else if (child.type === Fragment) list.push(...readOptions(inner, group))
  })
  return list
}

/** In place of a <select>: the same children and onChange, in the look of the software. */
export function Select({ value, onChange, children, 'aria-label': ariaLabel, ...rest }: Props) {
  const options = readOptions(children)
  // "All statuses", "Any type": a filter, shown in blue once it is set
  const filter = options[0]?.value === '' && /^(all|any)\b/i.test(options[0].label)
  return <Dropdown {...rest} value={value === null || value === undefined ? '' : String(value)} options={options} filter={filter} ariaLabel={ariaLabel} onChange={(v) => onChange({ target: { value: v } })} />
}
