import { Dropdown, type DropdownOption } from './Dropdown'

export type SearchableOption = DropdownOption

interface Props {
  value: string
  options: SearchableOption[]
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
}

/** A dropdown that always has the search box. */
export function SearchableSelect({ placeholder = 'Select...', ...rest }: Props) {
  return <Dropdown {...rest} placeholder={placeholder} searchable />
}
