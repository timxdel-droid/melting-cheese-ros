import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App.jsx'
import { hydrateConsoleState } from './lib/consoleState.js'
import './index.css'

// HashRouter so the build works on plain static hosting (cPanel) with no
// rewrite rules.
function render() {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <HashRouter>
        <App />
      </HashRouter>
    </React.StrictMode>,
  )
}

// The console's working state lives on dev2. Pull it before the first render
// so every screen's synchronous load*() sees the shared copy, not this
// browser's cache. Bounded by a timeout inside hydrateConsoleState, and it
// never throws, so a dead server still gets you a console (from cache).
hydrateConsoleState().finally(render)
