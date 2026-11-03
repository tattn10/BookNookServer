import { Router } from 'express';

const NEW_ARRIVALS_LIMIT = 6;

export function createBooksRouter(database) {
  const router = Router();

  router.get('/new-arrivals', async (_request, response, next) => {
    try {
      const books = await database
        .collection('books')
        .find({})
        .sort({ createdAt: -1, _id: -1 })
        .limit(NEW_ARRIVALS_LIMIT)
        .project({
          _id: 0,
          title: 1,
          author: 1,
          note: 1,
          category: 1,
          createdAt: 1,
        })
        .toArray();

      response.json({ books });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
