import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/theme.css'
import { App } from './app/App'
import { enableFullscreenOnFirstTouch } from './lib/fullscreen'

enableFullscreenOnFirstTouch()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
