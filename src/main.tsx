import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { StoreProvider } from './store';
import { AIProvider } from './aiRunner';
import 'remixicon/fonts/remixicon.css';
import './styles.css';
import './theme151.css';
createRoot(document.getElementById('root')!).render(<StoreProvider><AIProvider><App /></AIProvider></StoreProvider>);
