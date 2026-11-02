// SPDX-License-Identifier: MIT-0
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './tokens.css';
import './styles.css';

document.documentElement.classList.add('js');

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element');
createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
