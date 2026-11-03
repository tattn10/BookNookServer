import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { MongoClient, ObjectId } from 'mongodb';

const app = express();
const port = Number(process.env.PORT ?? 8000);
const mongoUri = process.env.MDB_URL;

if (!mongoUri) {
  throw new Error('MDB_URL must be set in Server/.env.');
}

app.use(cors());
app.use(express.json());

const client = new MongoClient(mongoUri);
await client.connect();
console.log('Connected to MongoDB.');

const db = client.db(process.env.MONGODB_DB ?? 'booknook');
const booksCollectionExists = await db
  .listCollections({ name: 'books' }, { nameOnly: true })
  .hasNext();

if (!booksCollectionExists) {
  await db.createCollection('books');
}

const books = db.collection('books');
const borrowsCollectionExists = await db
  .listCollections({ name: 'borrows' }, { nameOnly: true })
  .hasNext();

if (!borrowsCollectionExists) {
  await db.createCollection('borrows');
}

const borrows = db.collection('borrows');
const bookCategories = new Set(['Fiction', 'Science', 'History', 'Kids', 'Others']);

app.get('/books', async (_request, response) => {
  try {
    const allBooks = await books.find().sort({ addedAt: -1 }).toArray();
    return response.json(allBooks);
  } catch (error) {
    console.error('Could not fetch books from MongoDB:', error);
    return response.status(500).json({ error: 'Could not fetch books. Please try again.' });
  }
});

app.get('/books/:id', async (request, response) => {
  if (!ObjectId.isValid(request.params.id)) {
    return response.status(400).json({ error: 'Invalid book ID.' });
  }

  try {
    const book = await books.findOne({ _id: new ObjectId(request.params.id) });
    if (!book) {
      return response.status(404).json({ error: 'Book not found.' });
    }

    return response.json(book);
  } catch (error) {
    console.error('Could not fetch book from MongoDB:', error);
    return response.status(500).json({ error: 'Could not fetch book. Please try again.' });
  }
});

app.post('/books', async (request, response) => {
  const title = request.body.bookTitle?.trim();
  const author = request.body.authorName?.trim();
  const category = request.body.category?.trim();
  const imageUrl = request.body.imageUrl?.trim();
  const description = request.body.description?.trim();
  const userName = request.body.userName?.trim();
  const userEmail = request.body.userEmail?.trim().toLowerCase();

  if (!title || !author || !category || !imageUrl || !description || !userName || !userEmail) {
    return response.status(400).json({ error: 'Complete all book, image URL, and user fields.' });
  }

  if (!bookCategories.has(category)) {
    return response.status(400).json({ error: 'Choose a valid book category.' });
  }

  let parsedImageUrl;
  try {
    parsedImageUrl = new URL(imageUrl);
  } catch {
    return response.status(400).json({ error: 'Enter a valid book image URL.' });
  }

  if (!['http:', 'https:'].includes(parsedImageUrl.protocol)) {
    return response.status(400).json({ error: 'Book image URLs must use HTTP or HTTPS.' });
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

app.post('/borrows', async (request, response) => {
  const { bookId } = request.body;
  const userName = request.body.userName?.trim();
  const userEmail = request.body.userEmail?.trim().toLowerCase();

  if (!ObjectId.isValid(bookId) || !userName || !userEmail) {
    return response.status(400).json({ error: 'A valid book and logged-in user are required.' });
  }

  try {
    const book = await books.findOne({ _id: new ObjectId(bookId) });
    if (!book) {
      return response.status(404).json({ error: 'Book not found.' });
    }

    const existingBorrow = await borrows.findOne({
      bookId: new ObjectId(bookId),
      userEmail,
    });
    if (existingBorrow) {
      return response.status(409).json({ error: 'You have already borrowed this book.' });
    }

    const borrow = {
      bookId: new ObjectId(bookId),
      bookTitle: book.title,
      userName,
      userEmail,
      borrowedAt: new Date(),
    };
    const result = await borrows.insertOne(borrow);

    return response.status(201).json({
      message: 'Book borrowed successfully.',
      borrow: { ...borrow, _id: result.insertedId },
    });
  } catch (error) {
    console.error('Could not save borrow to MongoDB:', error);
    return response.status(500).json({ error: 'Could not borrow this book. Please try again.' });
  }
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
  console.error('Request failed:', error);
  return response.status(400).json({ error: 'Could not process the request.' });
});

app.listen(port, () => {
  console.log(`BookNook API server listening on port ${port}`);
});
