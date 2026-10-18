import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './app/App';
import { ApiError } from './lib/api';
import { DoorTransitionProvider } from './features/home/DoorTransition';
import './styles/global.css';
import './styles/community.css';
import './styles/interior.css';

const client = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 1,
      staleTime: 15000,
      refetchOnWindowFocus: false,
    },
  },
});
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <DoorTransitionProvider>
          <App />
        </DoorTransitionProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
