import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom'
import { RecoilRoot } from 'recoil'
import Register from './pages/auth/Register'
import Login from './pages/auth/Rogin'
import Dashboard from './pages/Dashboard'
import ProjectDetail from './pages/ProjectDetail'
import ProtectedRoute from './components/ProtectedRoute'
import AuthInitializer from './components/AuthInitializer'

function App() {
  return (
    <RecoilRoot>
      <AuthInitializer>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/project/:id" 
              element={
                <ProtectedRoute>
                  <ProjectDetail />
                </ProtectedRoute>
              } 
            />
            {/* Add more protected routes here as needed */}
          </Routes>
        </BrowserRouter>
      </AuthInitializer>
    </RecoilRoot>
  )
}

export default App
