/**
 * Main entry point for the DSA Visualizer frontend
 * 
 * Sets up React 18 with createRoot and enables StrictMode
 * for additional development checks.
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Create root and render the application
const root = createRoot(document.getElementById('root')!)
root.render(
  <StrictMode>
    <App />
  </StrictMode>,
)
