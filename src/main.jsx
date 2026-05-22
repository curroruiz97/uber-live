import ReactDOM from 'react-dom/client'
import 'leaflet/dist/leaflet.css'
import './index.css'
import App from './App.jsx'

// Sin StrictMode: en dev, su doble-montaje rompe la inicialización del mapa Leaflet
// ("Map container is already initialized").
ReactDOM.createRoot(document.getElementById('root')).render(<App />)
