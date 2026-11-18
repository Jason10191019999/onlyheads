import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

const root = document.getElementById('root')
if (root) createRoot(root).render(<App />)

// Offline support: only in the production build, and only over http(s).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const sw = new URL('sw.js', document.baseURI).toString()
    navigator.serviceWorker.register(sw).catch(() => {
      /* offline mode is a bonus, never a blocker */
    })
  })
}
