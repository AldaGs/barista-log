/**
 * A pragmatic subset of the SCA / World Coffee Research Coffee Taster's Flavor
 * Wheel: nine top-level categories, each with a handful of common descriptors.
 * Labels are bilingual and stored inline (not in the i18n JSON) to keep the
 * large descriptor list self-contained. The chosen-language label is what gets
 * saved as a flavor tag.
 */

export type Lang = 'en' | 'es'

export interface FlavorCategory {
  key: string
  /** accent color (hex) approximating the wheel's palette */
  color: string
  labels: Record<Lang, string>
  flavors: Record<Lang, string>[]
}

const f = (en: string, es: string): Record<Lang, string> => ({ en, es })

export const FLAVOR_WHEEL: FlavorCategory[] = [
  {
    key: 'fruity',
    color: '#C0392B',
    labels: f('Fruity', 'Frutal'),
    flavors: [
      f('Blackberry', 'Mora'),
      f('Raspberry', 'Frambuesa'),
      f('Blueberry', 'Arándano'),
      f('Strawberry', 'Fresa'),
      f('Raisin', 'Pasa'),
      f('Prune', 'Ciruela pasa'),
      f('Lemon', 'Limón'),
      f('Orange', 'Naranja'),
      f('Grapefruit', 'Toronja'),
      f('Peach', 'Durazno'),
      f('Apple', 'Manzana'),
      f('Grape', 'Uva'),
      f('Pineapple', 'Piña'),
      f('Pomegranate', 'Granada'),
    ],
  },
  {
    key: 'floral',
    color: '#D81B8C',
    labels: f('Floral', 'Floral'),
    flavors: [
      f('Black tea', 'Té negro'),
      f('Chamomile', 'Manzanilla'),
      f('Rose', 'Rosa'),
      f('Jasmine', 'Jazmín'),
    ],
  },
  {
    key: 'sweet',
    color: '#E67E22',
    labels: f('Sweet', 'Dulce'),
    flavors: [
      f('Honey', 'Miel'),
      f('Caramel', 'Caramelo'),
      f('Vanilla', 'Vainilla'),
      f('Brown sugar', 'Azúcar morena'),
      f('Maple syrup', 'Jarabe de arce'),
      f('Molasses', 'Melaza'),
    ],
  },
  {
    key: 'nutty-cocoa',
    color: '#8D6E63',
    labels: f('Nutty / Cocoa', 'Nuez / Cacao'),
    flavors: [
      f('Almond', 'Almendra'),
      f('Hazelnut', 'Avellana'),
      f('Peanut', 'Cacahuate'),
      f('Chocolate', 'Chocolate'),
      f('Dark chocolate', 'Chocolate amargo'),
      f('Cocoa', 'Cacao'),
    ],
  },
  {
    key: 'spices',
    color: '#A93226',
    labels: f('Spices', 'Especias'),
    flavors: [
      f('Cinnamon', 'Canela'),
      f('Nutmeg', 'Nuez moscada'),
      f('Clove', 'Clavo'),
      f('Pepper', 'Pimienta'),
      f('Anise', 'Anís'),
    ],
  },
  {
    key: 'roasted',
    color: '#6E4B3A',
    labels: f('Roasted', 'Tostado'),
    flavors: [
      f('Cereal', 'Cereal'),
      f('Malt', 'Malta'),
      f('Toast', 'Tostada'),
      f('Smoky', 'Ahumado'),
      f('Tobacco', 'Tabaco'),
      f('Burnt', 'Quemado'),
    ],
  },
  {
    key: 'green-vegetative',
    color: '#58A55C',
    labels: f('Green / Vegetative', 'Verde / Vegetal'),
    flavors: [
      f('Herbal', 'Herbal'),
      f('Hay', 'Heno'),
      f('Grassy', 'Pasto'),
      f('Peapod', 'Vaina de chícharo'),
      f('Raw', 'Crudo'),
    ],
  },
  {
    key: 'sour-fermented',
    color: '#C9B037',
    labels: f('Sour / Fermented', 'Ácido / Fermentado'),
    flavors: [
      f('Sour', 'Agrio'),
      f('Winey', 'Vinoso'),
      f('Fermented', 'Fermentado'),
      f('Citric acid', 'Ácido cítrico'),
      f('Malic acid', 'Ácido málico'),
      f('Boozy', 'Alcohólico'),
    ],
  },
  {
    key: 'other',
    color: '#95A5A6',
    labels: f('Other', 'Otro'),
    flavors: [
      f('Papery', 'Cartón'),
      f('Musty', 'Mohoso'),
      f('Earthy', 'Terroso'),
      f('Rubber', 'Hule'),
      f('Medicinal', 'Medicinal'),
    ],
  },
]

export const langOf = (lng: string): Lang => (lng.startsWith('es') ? 'es' : 'en')
