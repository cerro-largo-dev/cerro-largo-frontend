import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from '@/hooks/useAuth.jsx' // 👈 IMPORTANTE

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>        {/* 👈 ENVUELVE TODA LA APP */}
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
)
