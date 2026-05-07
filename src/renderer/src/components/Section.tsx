import { useState } from 'react'

interface SectionProps {
  title: string
  subtitle?: string
  defaultOpen?: boolean
  right?: React.ReactNode
  children: React.ReactNode
}

export function Section({ title, subtitle, defaultOpen = true, right, children }: SectionProps): JSX.Element {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="panel mb-3">
      <header className="panel-header">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex flex-1 items-center gap-3 text-left"
        >
          <span className="text-slate-400 transition-transform" style={{ transform: open ? 'rotate(90deg)' : 'rotate(0)' }}>
            ▶
          </span>
          <div>
            <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
            {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
          </div>
        </button>
        {right && <div className="ml-2 shrink-0">{right}</div>}
      </header>
      {open && <div className="space-y-3 px-4 py-4">{children}</div>}
    </section>
  )
}
