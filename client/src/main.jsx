import { createRoot } from 'react-dom/client'
import { I18nProvider } from './i18n/index.jsx'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <I18nProvider>
    <App />
  </I18nProvider>
)
