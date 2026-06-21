import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import HomePage from './features/home/HomePage'
import RecipeFormPage from './features/recipe/RecipeFormPage'
import RecipeDetailPage from './features/recipe/RecipeDetailPage'
import HistoryPage from './features/history/HistoryPage'
import ComparePage from './features/compare/ComparePage'
import BeansPage from './features/beans/BeansPage'
import WaterPage from './features/water/WaterPage'
import GrindersPage from './features/grinder/GrindersPage'
import SettingsPage from './features/settings/SettingsPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'recipe/new', element: <RecipeFormPage /> },
      { path: 'recipe/:id', element: <RecipeDetailPage /> },
      { path: 'recipe/:id/edit', element: <RecipeFormPage /> },
      { path: 'history', element: <HistoryPage /> },
      { path: 'compare', element: <ComparePage /> },
      { path: 'beans', element: <BeansPage /> },
      { path: 'water', element: <WaterPage /> },
      { path: 'grinders', element: <GrindersPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])
