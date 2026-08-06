import type { IconOption } from '@input_output/shared'
import { labelBase } from '../../lib/styles'

interface IconPickerProps {
  id: string
  label: string
  options: readonly IconOption[]
  selected: IconOption
  onSelect: (option: IconOption) => void
}

export default function IconPicker({ id, label, options, selected, onSelect }: IconPickerProps) {
  return (
    <div style={{ marginBottom: 20 }}>
      <label htmlFor={id} style={labelBase}>
        {label}
      </label>
      <div id={id} className="icon-picker-grid" role="listbox" aria-label={label}>
        {options.map((opt) => {
          const isSelected = selected.icon === opt.icon
          return (
            <button
              key={opt.icon}
              type="button"
              role="option"
              aria-label={opt.label}
              aria-selected={isSelected}
              title={opt.label}
              onClick={() => onSelect(opt)}
              className="icon-picker-option"
              style={{ background: opt.bg }}
            >
              <i className={`fa-solid ${opt.icon}`} style={{ color: opt.color, fontSize: 15 }} />
            </button>
          )
        })}
      </div>
    </div>
  )
}