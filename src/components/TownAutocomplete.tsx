import { useEffect, useRef, useState } from 'react'
import type { Town } from '../types'
import './TownAutocomplete.css'

interface Props {
  towns: Town[]
  value: string
  onChange: (id: string) => void
  placeholder: string
  inputClassName?: string
}

export default function TownAutocomplete({ towns, value, onChange, placeholder, inputClassName = '' }: Props) {
  const selected = towns.find((t) => String(t.id) === value)
  const [query, setQuery] = useState(selected?.name ?? '')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (selected) setQuery(selected.name)
  }, [selected?.name]) // eslint-disable-line react-hooks/exhaustive-deps

  const matches = query.trim()
    ? towns.filter((t) => t.name.toLowerCase().includes(query.toLowerCase())).slice(0, 3)
    : []

  function pick(town: Town) {
    setQuery(town.name)
    onChange(String(town.id))
    setOpen(false)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value)
    onChange('')
    setOpen(true)
  }

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  return (
    <div ref={containerRef} className="town-ac">
      <input
        className={inputClassName}
        placeholder={placeholder}
        value={query}
        onChange={handleChange}
        onFocus={() => { if (query) setOpen(true) }}
        autoComplete="off"
      />
      {open && matches.length > 0 && (
        <ul className="town-ac-list">
          {matches.map((t) => (
            <li key={t.id} className="town-ac-item" onMouseDown={() => pick(t)}>
              {t.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
