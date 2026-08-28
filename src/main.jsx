import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// NOTE: StrictMode deliberately removed — it double-invokes useEffects which
// causes the webcam stream and WebGL/TF.js context to be initialized twice,
// creating race conditions and silent failures in the MoveNet detection loop.
createRoot(document.getElementById('root')).render(<App />)

