import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AGULRenderer } from '@agul/react';
import petstore from './petstore.json';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AGULRenderer spec={petstore} baseUrl="https://petstore.swagger.io/v2" />
  </StrictMode>,
);
