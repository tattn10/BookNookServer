import 'dotenv/config';
import cors from 'cors';
import express from 'express';

const app = express();
const port = Number(process.env.PORT ?? 8000);

app.use(cors());
app.use(express.json());
app.get('/books', (_request, response) => {
  response.status(501).json({ error: 'GET /books is not implemented yet.' });
});

app.get('/books/:id', (_request, response) => {
  response.status(501).json({ error: 'GET /books/:id is not implemented yet.' });
});

app.post('/books', (_request, response) => {
  response.status(501).json({ error: 'POST /books is not implemented yet.' });
});

app.patch('/books/:id', (_request, response) => {
  response.status(501).json({ error: 'PATCH /books/:id is not implemented yet.' });
});

app.delete('/books/:id', (_request, response) => {
  response.status(501).json({ error: 'DELETE /books/:id is not implemented yet.' });
});

app.post('/borrows', (_request, response) => {
  response.status(501).json({ error: 'POST /borrows is not implemented yet.' });
});

app.get('/borrows', (_request, response) => {
  response.status(501).json({ error: 'GET /borrows is not implemented yet.' });
});

app.delete('/borrows/:id', (_request, response) => {
  response.status(501).json({ error: 'DELETE /borrows/:id is not implemented yet.' });
});

app.get('/', (_request, response) => {
  response.json({ message: 'BookNook API server is running' });
});

app.get('/health', (_request, response) => {
  response.json({ status: 'ok' });
});

app.listen(port, () => {
  console.log(`BookNook API server listening on port ${port}`);
});
