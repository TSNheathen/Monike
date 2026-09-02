import { Suspense, lazy, useEffect, useRef } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import LandingPage from './pages/LandingPage.jsx'
import RequireAdmin from './components/RequireAdmin.jsx'

const GalleryPage = lazy(() => import('./pages/GalleryPage.jsx'))
const BlogListPage = lazy(() => import('./pages/BlogListPage.jsx'))
const BlogPostPage = lazy(() => import('./pages/BlogPostPage.jsx'))
const AboutPage = lazy(() => import('./pages/AboutPage.jsx'))
const ContactPage = lazy(() => import('./pages/ContactPage.jsx'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage.jsx'))
const AdminLoginPage = lazy(() => import('./pages/AdminLoginPage.jsx'))
const AdminBlogPage = lazy(() => import('./pages/AdminBlogPage.jsx'))
const AdminBlogEditorPage = lazy(() => import('./pages/AdminBlogEditorPage.jsx'))
const AdminLabelsPage = lazy(() => import('./pages/AdminLabelsPage.jsx'))
const AdminGalleryPage = lazy(() => import('./pages/AdminGalleryPage.jsx'))
const AdminGalleryEditorPage = lazy(() => import('./pages/AdminGalleryEditorPage.jsx'))
const AdminLandingPage = lazy(() => import('./pages/AdminLandingPage.jsx'))
const AdminAboutPage = lazy(() => import('./pages/AdminAboutPage.jsx'))
const AdminContactPage = lazy(() => import('./pages/AdminContactPage.jsx'))

function RouteFocusManager() {
  const location = useLocation()
  const previousRoute = useRef(null)

  useEffect(() => {
    const route = `${location.pathname}${location.search}`
    const changed = previousRoute.current !== null && previousRoute.current !== route
    previousRoute.current = route
    if (!changed) return undefined

    let frame
    let attempts = 0
    function focusRoute() {
      const target = document.querySelector('#main-content h1') || document.querySelector('#main-content[tabindex="-1"]')
      if (target) {
        target.focus({ preventScroll: true })
        target.scrollIntoView?.({ block: 'start' })
        return
      }
      attempts += 1
      if (attempts < 60) frame = requestAnimationFrame(focusRoute)
    }
    frame = requestAnimationFrame(focusRoute)
    return () => cancelAnimationFrame(frame)
  }, [location.pathname, location.search])

  return null
}

export default function App() {
  return (
    <Suspense fallback={<div className="route-loading">Načítám...</div>}>
      <RouteFocusManager />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/gallery" element={<GalleryPage />} />
        <Route path="/blog" element={<BlogListPage />} />
        <Route path="/blog/:slug" element={<BlogPostPage />} />
        <Route path="/o-mne" element={<AboutPage />} />
        <Route path="/kontakt" element={<ContactPage />} />
        <Route path="/admin" element={<Navigate to="/admin/blog" replace />} />
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/admin/blog" element={<RequireAdmin><AdminBlogPage /></RequireAdmin>} />
        <Route path="/admin/blog/new" element={<RequireAdmin><AdminBlogEditorPage /></RequireAdmin>} />
        <Route path="/admin/blog/:id/edit" element={<RequireAdmin><AdminBlogEditorPage /></RequireAdmin>} />
        <Route path="/admin/labels" element={<RequireAdmin><AdminLabelsPage /></RequireAdmin>} />
        <Route path="/admin/gallery" element={<RequireAdmin><AdminGalleryPage /></RequireAdmin>} />
        <Route path="/admin/gallery/new" element={<RequireAdmin><AdminGalleryEditorPage /></RequireAdmin>} />
        <Route path="/admin/gallery/:id/edit" element={<RequireAdmin><AdminGalleryEditorPage /></RequireAdmin>} />
        <Route path="/admin/web/landing" element={<RequireAdmin><AdminLandingPage /></RequireAdmin>} />
        <Route path="/admin/web/o-mne" element={<RequireAdmin><AdminAboutPage /></RequireAdmin>} />
        <Route path="/admin/web/kontakt" element={<RequireAdmin><AdminContactPage /></RequireAdmin>} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  )
}
