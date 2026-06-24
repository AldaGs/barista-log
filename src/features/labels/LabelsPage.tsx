import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Trash2, Tag, X } from 'lucide-react'
import { db } from '@/db/dexie'
import { saveLabel, deleteLabel } from '@/db/repo'
import type { Label } from '@/db/types'
import { PageHeader, Field, EmptyState } from '@/components/ui'
import { BlobImage } from '@/components/PhotoInput'
import { LabelCropper } from './LabelCropper'

/** Form to name a freshly cropped label (or edit an existing one) before saving. */
function LabelForm({
  image,
  initial,
  onClose,
  onDelete,
}: {
  image: Blob
  initial?: Label
  onClose: () => void
  onDelete?: () => void
}) {
  const { t } = useTranslation()
  const beans = useLiveQuery(() => db.beans.orderBy('name').toArray(), [])
  const [name, setName] = useState(initial?.name ?? '')
  const [beanId, setBeanId] = useState(initial?.beanId ?? '')

  async function save() {
    await saveLabel({ id: initial?.id, image, name: name.trim() || undefined, beanId: beanId || undefined })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="w-full max-w-md space-y-4 rounded-t-2xl bg-surface p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{t('labels.details')}</h2>
          <button onClick={onClose} className="btn-ghost !px-2" aria-label={t('common.cancel')}>
            <X size={18} />
          </button>
        </div>
        <BlobImage blob={image} className="mx-auto max-h-64 rounded-xl object-contain" alt={name} />
        <Field label={t('labels.name')} hint={t('common.optional')}>
          <input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={t('labels.namePlaceholder')} />
        </Field>
        <Field label={t('recipe.bean')} hint={t('common.optional')}>
          <select className="input" value={beanId} onChange={(e) => setBeanId(e.target.value)}>
            <option value="">{t('common.none')}</option>
            {beans?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </Field>
        <div className="flex gap-2">
          <button className="btn-primary flex-1" onClick={save}>{t('common.save')}</button>
          {onDelete && (
            <button className="btn-ghost text-red-500" onClick={onDelete} aria-label={t('common.delete')}>
              <Trash2 size={18} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function LabelsPage() {
  const { t } = useTranslation()
  const labels = useLiveQuery(() => db.labels.orderBy('updatedAt').reverse().toArray(), [])
  const fileRef = useRef<HTMLInputElement>(null)
  const [picked, setPicked] = useState<File | null>(null) // awaiting crop
  const [cropped, setCropped] = useState<Blob | null>(null) // awaiting name/save
  const [editing, setEditing] = useState<Label | null>(null) // existing label

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (f) setPicked(f)
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('labels.title')}
        back
        action={
          <button className="btn-primary" onClick={() => fileRef.current?.click()}>
            <Plus size={18} /> {t('common.add')}
          </button>
        }
      />
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={pick} />

      {labels === undefined ? null : labels.length === 0 ? (
        <EmptyState><Tag /> {t('labels.empty')}</EmptyState>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {labels.map((l) => (
            <button
              key={l.id}
              onClick={() => setEditing(l)}
              className="card group relative aspect-square overflow-hidden p-0"
            >
              <BlobImage blob={l.image} className="h-full w-full object-cover" alt={l.name ?? ''} />
              {l.name && (
                <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-2 py-1 text-left text-xs text-white">
                  {l.name}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* pick → crop → name/save pipeline */}
      {picked && (
        <LabelCropper
          file={picked}
          onCancel={() => setPicked(null)}
          onCrop={(blob) => {
            setPicked(null)
            setCropped(blob)
          }}
        />
      )}
      {cropped && <LabelForm image={cropped} onClose={() => setCropped(null)} />}

      {/* tap existing label → edit / delete */}
      {editing && (
        <LabelForm
          image={editing.image}
          initial={editing}
          onClose={() => setEditing(null)}
          onDelete={async () => {
            await deleteLabel(editing.id)
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}
