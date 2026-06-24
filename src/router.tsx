import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import HomePage from './features/home/HomePage'
import RecipeFormPage from './features/recipe/RecipeFormPage'
import RecipeDetailPage from './features/recipe/RecipeDetailPage'
import RecipesPage from './features/recipe/RecipesPage'
import BrewPlayPage from './features/brew/BrewPlayPage'
import EspressoShotPage from './features/brew/EspressoShotPage'
import LogSessionPage from './features/recipe/LogSessionPage'
import ImportRecipePage from './features/recipe/ImportRecipePage'
import HistoryPage from './features/history/HistoryPage'
import StatsPage from './features/stats/StatsPage'
import ComparePage from './features/compare/ComparePage'
import BeansPage from './features/beans/BeansPage'
import WaterPage from './features/water/WaterPage'
import EquipmentPage from './features/equipment/EquipmentPage'
import MaintenancePage from './features/maintenance/MaintenancePage'
import LabelsPage from './features/labels/LabelsPage'
import SettingsPage from './features/settings/SettingsPage'
import ProfilePage from './features/profile/ProfilePage'
import HelpPage from './features/help/HelpPage'
import GymPage from './features/gym/GymPage'
import PracticePage from './features/gym/PracticePage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'recipes', element: <RecipesPage /> },
      { path: 'recipe/new', element: <RecipeFormPage /> },
      { path: 'import', element: <ImportRecipePage /> },
      { path: 'recipe/:id', element: <RecipeDetailPage /> },
      { path: 'recipe/:id/edit', element: <RecipeFormPage /> },
      { path: 'recipe/:id/brew', element: <BrewPlayPage /> },
      { path: 'recipe/:id/shot', element: <EspressoShotPage /> },
      { path: 'recipe/:id/practice', element: <PracticePage /> },
      { path: 'gym', element: <GymPage /> },
      { path: 'recipe/:id/log', element: <LogSessionPage /> },
      { path: 'history', element: <HistoryPage /> },
      { path: 'stats', element: <StatsPage /> },
      { path: 'compare', element: <ComparePage /> },
      { path: 'beans', element: <BeansPage /> },
      { path: 'water', element: <WaterPage /> },
      { path: 'equipment', element: <EquipmentPage /> },
      { path: 'grinders', element: <Navigate to="/equipment" replace /> },
      { path: 'gear', element: <Navigate to="/equipment" replace /> },
      { path: 'maintenance', element: <MaintenancePage /> },
      { path: 'labels', element: <LabelsPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'profile', element: <ProfilePage /> },
      { path: 'help', element: <HelpPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])
