import { Router } from 'express';

const apiRouter = Router();

apiRouter.get('/books', (_request, response) => {
  response.status(501).json({ error: 'GET /books is not implemented yet.' });
});

apiRouter.get('/books/:id', (_request, response) => {
  response.status(501).json({ error: 'GET /books/:id is not implemented yet.' });
});

apiRouter.post('/books', (_request, response) => {
  response.status(501).json({ error: 'POST /books is not implemented yet.' });
});

apiRouter.patch('/books/:id', (_request, response) => {
  response.status(501).json({ error: 'PATCH /books/:id is not implemented yet.' });
});

apiRouter.delete('/books/:id', (_request, response) => {
  response.status(501).json({ error: 'DELETE /books/:id is not implemented yet.' });
});

apiRouter.post('/borrows', (_request, response) => {
  response.status(501).json({ error: 'POST /borrows is not implemented yet.' });
});

apiRouter.get('/borrows', (_request, response) => {
  response.status(501).json({ error: 'GET /borrows is not implemented yet.' });
});

export default apiRouter;
