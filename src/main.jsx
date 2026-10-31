import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './workbench.jsx';
import { WorkspaceWindow } from './components/workspace-window.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {new URLSearchParams(location.search).has('workspaceWindow') ? <WorkspaceWindow /> : <App />}
  </React.StrictMode>,
);
