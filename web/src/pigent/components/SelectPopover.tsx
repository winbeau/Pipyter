import { Check, ChevronDown } from 'lucide-react'
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'

export type SelectPopoverOption<T extends string> = {
  value: T
  label: string
  disabled?: boolean
}

export function SelectPopover<T extends string>({ ariaLabel, value, options, onChange, onOpen, disabled = false, compact = false, className = '', leading }: {
  ariaLabel: string
  value: T
  options: readonly SelectPopoverOption<T>[]
  onChange(value: T): void
  onOpen?(): Promise<void> | void
  disabled?: boolean
  compact?: boolean
  className?: string
  leading?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const listboxId = useId()
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value))
  const selected = options[selectedIndex]

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  useEffect(() => {
    if (!open) return
    optionRefs.current[activeIndex]?.focus()
  }, [activeIndex, open])

  const openList = (preferredIndex = selectedIndex) => {
    if (disabled || options.length === 0) return
    const next = options[preferredIndex]?.disabled ? options.findIndex((option) => !option.disabled) : preferredIndex
    setActiveIndex(Math.max(0, next))
    setOpen(true)
    void onOpen?.()
  }
  const choose = (index: number) => {
    const option = options[index]
    if (!option || option.disabled) return
    onChange(option.value)
    setOpen(false)
    queueMicrotask(() => root.current?.querySelector<HTMLButtonElement>('.pigent-combobox-trigger')?.focus())
  }
  const move = (direction: 1 | -1) => {
    if (!options.length) return
    let next = activeIndex
    for (let count = 0; count < options.length; count++) {
      next = (next + direction + options.length) % options.length
      if (!options[next]?.disabled) { setActiveIndex(next); return }
    }
  }
  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) openList(selectedIndex)
      else move(event.key === 'ArrowDown' ? 1 : -1)
    } else if (event.key === 'Enter' || event.key === ' ') {
      if (!open) { event.preventDefault(); openList(selectedIndex) }
    } else if (event.key === 'Escape' && open) {
      event.preventDefault(); setOpen(false)
    }
  }
  const onOptionKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault(); move(event.key === 'ArrowDown' ? 1 : -1)
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault(); choose(index)
    } else if (event.key === 'Escape' || event.key === 'Tab') {
      if (event.key === 'Escape') event.preventDefault()
      setOpen(false)
      if (event.key === 'Escape') queueMicrotask(() => root.current?.querySelector<HTMLButtonElement>('.pigent-combobox-trigger')?.focus())
    }
  }

  return <div ref={root} className={`pigent-combobox ${className}${compact ? ' is-compact' : ''}${open ? ' is-open' : ''}${disabled ? ' is-disabled' : ''}`}>
    <button type="button" className="pigent-combobox-trigger" role="combobox" aria-label={ariaLabel} aria-haspopup="listbox" aria-controls={listboxId} aria-expanded={open} disabled={disabled} onClick={() => open ? setOpen(false) : openList()} onKeyDown={onTriggerKeyDown}>
      {leading}<span>{selected?.label ?? 'Unavailable'}</span><ChevronDown aria-hidden="true" />
    </button>
    {open && <div id={listboxId} className="pigent-combobox-menu" role="listbox" aria-label={`${ariaLabel} options`}>
      {options.map((option, index) => <button ref={(node) => { optionRefs.current[index] = node }} key={option.value} type="button" role="option" aria-selected={option.value === value} disabled={option.disabled} tabIndex={activeIndex === index ? 0 : -1} className={`${option.value === value ? 'is-selected' : ''}${activeIndex === index ? ' is-active' : ''}`} onMouseEnter={() => { if (!option.disabled) setActiveIndex(index) }} onClick={() => choose(index)} onKeyDown={(event) => onOptionKeyDown(event, index)}><span>{option.label}</span>{option.value === value && <Check aria-hidden="true" />}</button>)}
    </div>}
  </div>
}
