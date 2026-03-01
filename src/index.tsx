import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Se o fundo da página estiver estranho, garanta isso aqui: */
body {
  @apply bg - slate - 50 text - slate - 900;
}