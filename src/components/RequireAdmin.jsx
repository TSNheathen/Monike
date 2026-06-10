import { Navigate, useLocation } from 'react-router-dom'
import { api } from '../lib/pocketbase.js'

export default function RequireAdmin({ children }) {
  const location = useLocation()

  if (!api.isAdmin()) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />
  }

  return children
}
