import { useTranslation } from 'react-i18next'
import { PageHeader } from '@/components/ui'

const SECTIONS = ['recipe', 'brewing', 'pressure', 'coldbrew', 'logging', 'beans', 'cupping', 'water', 'grinder', 'sync'] as const

export default function HelpPage() {
  const { t } = useTranslation()

  return (
    <div className="space-y-4">
      <PageHeader title={t('help.title')} back />
      <p className="text-muted">{t('help.intro')}</p>

      {SECTIONS.map((key) => {
        const steps = t(`help.sections.${key}.steps`, { returnObjects: true }) as string[]
        return (
          <section key={key} className="card p-4">
            <h2 className="mb-2 font-semibold">{t(`help.sections.${key}.title`)}</h2>
            <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted">
              {steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          </section>
        )
      })}
    </div>
  )
}
