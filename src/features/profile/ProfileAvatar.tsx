import { Coffee, Leaf, Flame, Droplet, Heart, Star, Sparkles, Mountain, Sun, User } from 'lucide-react'
import { BlobImage } from '@/components/PhotoInput'

/** Selectable avatar icons (coffee-themed). Keys are persisted as `avatarIcon`. */
export const AVATAR_ICONS = {
  coffee: Coffee,
  leaf: Leaf,
  flame: Flame,
  droplet: Droplet,
  heart: Heart,
  star: Star,
  sparkles: Sparkles,
  mountain: Mountain,
  sun: Sun,
} as const

export type AvatarIconId = keyof typeof AVATAR_ICONS

/** Render the user's avatar: photo if present, else chosen icon, else a default. */
export function ProfileAvatar({
  icon,
  photo,
  size = 44,
}: {
  icon?: string
  photo?: Blob
  size?: number
}) {
  const Icon = (icon && AVATAR_ICONS[icon as AvatarIconId]) || User
  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand/10 text-brand"
      style={{ width: size, height: size }}
    >
      {photo ? (
        <BlobImage blob={photo} className="h-full w-full object-cover" />
      ) : (
        <Icon size={Math.round(size * 0.5)} />
      )}
    </span>
  )
}
