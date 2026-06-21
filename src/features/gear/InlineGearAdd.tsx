import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import { saveGear } from '@/db/repo'
import type { GearType } from '@/db/types'

/** Quick-add a machine/brewer to the gear library straight from the recipe
 *  form, then select it — no trip to the Gear page needed. */
export function InlineGearAdd({
  type,
  onAdded,
}: {
  type: GearType
  onAdded: (id: string) => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')

  if (!open) {
    return (
      <button type="button" className="mt-1 inline-flex items-center gap-1 text-sm text-brand" onClick={() => setOpen(true)}>
        <Plus size={14} /> {t(type === 'machine' ? 'gear.addMachine' : 'gear.addBrewer')}
      </button>
    )
  }

  const submit = async () => {
    if (!name.trim()) return
    const id = await saveGear({ name: name.trim(), type })
    onAdded(id)
    setName('')
    setOpen(false)
  }

  return (
    <div className="mt-2 flex gap-2">
      <input
        className="input"
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            void submit()
          }
        }}
        placeholder={type === 'machine' ? 'Gaggia Classic…' : 'V60, AeroPress…'}
      />
      <button type="button" className="btn-primary !px-3" onClick={submit}>
        {t('common.add')}
      </button>
      <button type="button" className="btn-ghost !px-3" onClick={() => { setOpen(false); setName('') }}>
        {t('common.cancel')}
      </button>
    </div>
  )
}
