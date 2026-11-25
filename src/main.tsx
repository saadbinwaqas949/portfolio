import '@fontsource/dela-gothic-one/latin-400.css';
import '@fontsource/barlow/latin-400.css';
import '@fontsource/barlow/latin-500.css';
import '@fontsource/barlow/latin-600.css';
import '@fontsource/barlow-condensed/latin-600.css';
import '@fontsource/barlow-condensed/latin-700.css';
import '@fontsource-variable/shantell-sans/full.css';
import '@fontsource/jersey-10/latin-400.css';
import './styles/base.css';
import './styles/chrome.css';
import './styles/sections.css';
import { createRoot } from 'react-dom/client';
import { App } from './App';

history.scrollRestoration = 'manual';
createRoot(document.getElementById('root')!).render(<App />);

if (import.meta.hot) {
  import.meta.hot.on('site-json', () => {
    if (!new URLSearchParams(location.search).has('studio')) location.reload();
  });
}
