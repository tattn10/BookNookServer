import { Router } from 'express';

const apiRouter = Router();

apiRouter.get('/books', (_request, response) => {
  response.status(501).json({ error: 'GET /books is not implemented yet.' });
});

export default apiRouter;
