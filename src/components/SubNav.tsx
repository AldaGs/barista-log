import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

const tabs = [
  { to: '/beans', key: 'beans', i18n: 'beans.title' },
  { to: '/water', key: 'water', i18n: 'water.title' },
  { to: '/grinders', key: 'grinders', i18n: 'grinder.title' },
] as const

export function SubNav({ active }: { active: 'beans' | 'water' | 'grinders' }) {
  const { t } = useTranslation()
  return (
    <div className="flex gap-2">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          to={tab.to}
          className={`chip ${active === tab.key ? '!bg-brand !text-brand-fg' : ''}`}
        >
          {t(tab.i18n)}
        </Link>
      ))}
    </div>
  )
}
