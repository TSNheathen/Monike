import { Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import LandingPage from './pages/LandingPage.jsx'
import RequireAdmin from './components/RequireAdmin.jsx'

const GalleryPage = lazy(() => import('./pages/GalleryPage.jsx'))
const BlogListPage = lazy(() => import('./pages/BlogListPage.jsx'))
const BlogPostPage = lazy(() => import('./pages/BlogPostPage.jsx'))
const AdminLoginPage = lazy(() => import('./pages/AdminLoginPage.jsx'))
const AdminBlogPage = lazy(() => import('./pages/AdminBlogPage.jsx'))
const AdminBlogEditorPage = lazy(() => import('./pages/AdminBlogEditorPage.jsx'))
const AdminGalleryPage = lazy(() => import('./pages/AdminGalleryPage.jsx'))
const AdminGalleryEditorPage = lazy(() => import('./pages/AdminGalleryEditorPage.jsx'))
const PlaceholderPage = lazy(() => import('./pages/PlaceholderPage.jsx'))

export default function App() {
  return (
    <Suspense fallback={<div className="route-loading">Načítám...</div>}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/gallery" element={<GalleryPage />} />
        <Route path="/blog" element={<BlogListPage />} />
        <Route path="/blog/:slug" element={<BlogPostPage />} />
        <Route path="/o-mne" element={<PlaceholderPage title="O mně" />} />
        <Route path="/kontakt" element={<PlaceholderPage title="Kontakt" />} />
        <Route path="/admin" element={<Navigate to="/admin/blog" replace />} />
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/admin/blog" element={<RequireAdmin><AdminBlogPage /></RequireAdmin>} />
        <Route path="/admin/blog/new" element={<RequireAdmin><AdminBlogEditorPage /></RequireAdmin>} />
        <Route path="/admin/blog/:id/edit" element={<RequireAdmin><AdminBlogEditorPage /></RequireAdmin>} />
        <Route path="/admin/gallery" element={<RequireAdmin><AdminGalleryPage /></RequireAdmin>} />
        <Route path="/admin/gallery/new" element={<RequireAdmin><AdminGalleryEditorPage /></RequireAdmin>} />
        <Route path="/admin/gallery/:id/edit" element={<RequireAdmin><AdminGalleryEditorPage /></RequireAdmin>} />
        <Route path="*" element={<PlaceholderPage title="Stránka nenalezena" />} />
      </Routes>
    </Suspense>
  )
}
