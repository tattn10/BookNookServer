import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import multer from 'multer';
import { MongoClient } from 'mongodb';

const app = express();
const port = Number(process.env.PORT ?? 8000);
const mongoUri = process.env.MDB_URL;

if (!mongoUri) {
  throw new Error('MDB_URL must be set in Server/.env.');
}

if (!process.env.IMGBB_API_KEY) {
  console.warn('IMGBB_API_KEY is not set; book image uploads will be unavailable.');
}

app.use(cors());
app.use(express.json());

const client = new MongoClient(mongoUri);
await client.connect();
console.log('Connected to MongoDB.');

const db = client.db(process.env.MONGODB_DB ?? 'booknook');
const books = db.collection('books');
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});
const bookCategories = new Set(['Fiction', 'Science', 'History', 'Kids', 'Others']);

app.get('/books', (_request, response) => {
  response.status(501).json({ error: 'GET /books is not implemented yet.' });
});

app.get('/books/:id', (_request, response) => {
  response.status(501).json({ error: 'GET /books/:id is not implemented yet.' });
});

app.post('/books', imageUpload.single('bookImage'), async (request, response) => {
  const title = request.body.bookTitle?.trim();
  const author = request.body.authorName?.trim();
  const category = request.body.category?.trim();
  const description = request.body.description?.trim();
  const userName = request.body.userName?.trim();
  const userEmail = request.body.userEmail?.trim().toLowerCase();
  const image = request.file;

  if (!title || !author || !category || !description || !userName || !userEmail) {
    return response.status(400).json({ error: 'Complete all book and user fields.' });
  }

  if (!bookCategories.has(category)) {
    return response.status(400).json({ error: 'Choose a valid book category.' });
  }

  if (!image || !image.mimetype.startsWith('image/')) {
    return response.status(400).json({ error: 'Choose an image file to upload.' });
  }

  const imageHostKey = process.env.IMGBB_API_KEY;
  if (!imageHostKey) {
    return response.status(503).json({
      error: 'Book image uploads are not configured. Set IMGBB_API_KEY on the server.',
    });
  }

  let imageUrl;
  try {
    const imageForm = new FormData();
    imageForm.append(
      'image',
      new Blob([new Uint8Array(image.buffer)], { type: image.mimetype }),
      image.originalname,
    );

    const imageResponse = await fetch(
      `https://api.imgbb.com/1/upload?key=${encodeURIComponent(imageHostKey)}`,
      {
        method: 'POST',
        body: imageForm,
        signal: AbortSignal.timeout(20_000),
      },
    );
    const imageResult = await imageResponse.json();

    if (!imageResponse.ok || imageResult.success !== true || !imageResult.data?.url) {
      console.error('ImgBB rejected a book image upload.');
      return response.status(502).json({ error: 'Could not upload the book image.' });
    }

    imageUrl = imageResult.data.display_url ?? imageResult.data.url;
  } catch (error) {
    console.error('Book image upload failed:', error);
    return response.status(502).json({ error: 'Could not upload the book image.' });
  }

  const book = {
    title,
    author,
    category,
    imageUrl,
    description,
    userName,
    userEmail,
    addedAt: new Date(),
  };

  try {
    const result = await books.insertOne(book);
    return response.status(201).json({
      message: 'Book added successfully.',
      book: { ...book, _id: result.insertedId },
    });
  } catch (error) {
    console.error('Could not save the book to MongoDB:', error);
    return response.status(500).json({ error: 'Could not save the book. Please try again.' });
  }
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

app.use((error, _request, response, _next) => {
  if (error instanceof multer.MulterError) {
    const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    const message = error.code === 'LIMIT_FILE_SIZE'
      ? 'Book images must be 5 MB or smaller.'
      : 'Could not process the uploaded image.';
    return response.status(status).json({ error: message });
  }

  console.error('Request failed:', error);
  return response.status(400).json({ error: 'Could not process the request.' });
});

app.listen(port, () => {
  console.log(`BookNook API server listening on port ${port}`);
});
