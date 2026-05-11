import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// StrictMode removed: react-sketch-canvas@6 is incompatible with React 19 StrictMode
// and throws "No stroke found!" due to double effect invocation in dev mode.
createRoot(document.getElementById('root')!).render(
  <App />,
)
