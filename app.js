import cors from 'cors';
import express from 'express';
import { createBooksRouter } from './routes/books.js';

export function createApp(database) {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get('/', (_request, response) => {
    response.json({ message: 'BookNook API server is running' });
  });

  app.get('/health', (_request, response) => {
    response.json({ status: 'ok', database: 'connected' });
  });

  app.use('/api/books', createBooksRouter(database));

  app.use((error, _request, response, next) => {
    console.error('API request failed:', error);

    if (response.headersSent) {
      next(error);
      return;
    }

    response.status(500).json({ error: 'The request could not be completed.' });
  });

  return app;
}
