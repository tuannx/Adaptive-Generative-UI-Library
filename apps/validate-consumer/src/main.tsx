import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { AGULRenderer } from '@ai-kit/agul-react';
import petstore from './petstore.json';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Link to="/admin">Open admin</Link>} />
        <Route
          path="/admin/*"
          element={<AGULRenderer spec={petstore} baseUrl="https://petstore.swagger.io/v2" />}
        />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
