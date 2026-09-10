import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './AuthContext'
import AdminLayout from './AdminLayout'
import Login from './Login'
import SetPassword from './SetPassword'
import Dashboard from './Dashboard'
import ProductsAdmin from './ProductsAdmin'
import ProductForm from './ProductForm'
import PostsAdmin from './PostsAdmin'
import PostForm from './PostForm'
import UsersAdmin from './UsersAdmin'
import AuditLog from './AuditLog'
import { Button, Card, Alert } from './ui'

const Splash = () => <div className="min-h-screen bg-background flex items-center justify-center text-sm text-muted-foreground">Loading…</div>

/* Signed in, but the backend refused the profile (inactive, or created outside the panel). */
function Blocked({ reason }) {
  const { signOut } = useAuth()
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-md p-8 space-y-4">
        <h1 className="font-serif text-2xl font-bold text-foreground">Access not enabled</h1>
        <Alert>{reason || 'Your account cannot use the admin panel yet.'}</Alert>
        <Button variant="outline" onClick={signOut}>Sign out</Button>
      </Card>
    </div>
  )
}

function RequireAuth({ children }) {
  const { session, me, loading, error } = useAuth(); const loc = useLocation()
  if (loading) return <Splash />
  if (!session) return <Navigate to="/admin/login" state={{ from: loc.pathname }} replace />
  if (!me) return <Blocked reason={error} />
  return children
}

function RequireRole({ perm, children }) {
  const { me } = useAuth()
  return me?.permissions?.[perm] ? children : <Alert>Your role doesn't have access to this section.</Alert>
}

const P = (perm, el) => <RequireRole perm={perm}>{el}</RequireRole>

export default function AdminApp() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="login" element={<Login />} />
        <Route path="set-password" element={<SetPassword />} />
        <Route element={<RequireAuth><AdminLayout /></RequireAuth>}>
          <Route index element={<Dashboard />} />
          <Route path="products" element={P('products', <ProductsAdmin />)} />
          <Route path="products/new" element={P('products', <ProductForm />)} />
          <Route path="products/:slug" element={P('products', <ProductForm />)} />
          <Route path="posts" element={P('posts', <PostsAdmin />)} />
          <Route path="posts/new" element={P('posts', <PostForm />)} />
          <Route path="posts/:slug" element={P('posts', <PostForm />)} />
          <Route path="users" element={P('users', <UsersAdmin />)} />
          <Route path="audit" element={P('audit', <AuditLog />)} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Route>
      </Routes>
    </AuthProvider>
  )
}
