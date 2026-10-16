import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Shell } from './shell/Shell';
import { ThemeProvider } from './theme/ThemeProvider';
import './theme/global.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <Shell />
    </ThemeProvider>
  </StrictMode>,
);
