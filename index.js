import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { MongoClient, ObjectId } from 'mongodb';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const app = express();
const port = Number(process.env.PORT ?? 8000);
const mongoUri = process.env.MDB_URL;
const frontendUrls = (process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',')
  .map((url) => url.trim().replace(/\/+$/, ''))
  .filter(Boolean);
const authServerUrl = frontendUrls[0];
const authJwks = createRemoteJWKSet(new URL('/api/auth/jwks', authServerUrl));

if (!mongoUri) {
  throw new Error('MDB_URL must be set in Server/.env.');
}

app.use(cors({ origin: frontendUrls, credentials: true }));
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

async function requireAuth(request, response, next) {
  const cookie = request.get('cookie');
  if (!cookie) {
    return response.status(401).json({ error: 'Please log in to continue.' });
  }

  try {
    const authResponse = await fetch(`${authServerUrl}/api/auth/get-session`, {
      headers: { cookie },
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000),
    });

    if (!authResponse.ok) {
      if (authResponse.status >= 500) {
        console.error(`Better Auth session check failed with status ${authResponse.status}.`);
        return response.status(503).json({ error: 'Could not verify your login. Please try again.' });
      }

      return response.status(401).json({ error: 'Please log in to continue.' });
    }

    const session = await authResponse.json();
    const email = session?.user?.email;
    if (typeof email !== 'string' || !email.trim()) {
      return response.status(401).json({ error: 'Please log in to continue.' });
    }

    request.authUser = {
      email: email.trim().toLowerCase(),
      name: typeof session.user.name === 'string' ? session.user.name : '',
    };
    return next();
  } catch (error) {
    console.error('Could not verify Better Auth session:', error);
    return response.status(503).json({ error: 'Could not verify your login. Please try again.' });
  }
}

async function requireJwt(request, response, next) {
  const authorization = request.get('authorization') || '';
  const [scheme, token] = authorization.split(' ', 2);

  if (scheme !== 'Bearer' || !token) {
    return response.status(401).json({ error: 'Please log in to continue.' });
  }

  try {
    const { payload } = await jwtVerify(token, authJwks, {
      issuer: authServerUrl,
      audience: authServerUrl,
    });
    const email = payload.email;

    if (typeof email !== 'string' || !email.trim()) {
      return response.status(401).json({ error: 'Please log in to continue.' });
    }

    request.authUser = {
      email: email.trim().toLowerCase(),
      name: typeof payload.name === 'string' ? payload.name : '',
    };
    return next();
  } catch {
    return response.status(401).json({ error: 'Please log in to continue.' });
  }
}

function requireAuthForUserBooks(request, response, next) {
  if (!request.query.userEmail) {
    return next();
  }

  return requireAuth(request, response, next);
}

app.get('/books', requireAuthForUserBooks, async (request, response) => {
  const filter = request.query.userEmail
    ? { userEmail: request.authUser.email }
    : {};

  try {
    const allBooks = await books.find(filter).sort({ addedAt: -1 }).toArray();
    return response.json(allBooks);
  } catch (error) {
    console.error('Could not fetch books from MongoDB:', error);
    return response.status(500).json({ error: 'Could not fetch books. Please try again.' });
  }
});

app.get('/books/:id', requireAuth, async (request, response) => {
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

app.post('/books', requireJwt, async (request, response) => {
  const title = request.body.bookTitle?.trim();
  const author = request.body.authorName?.trim();
  const category = request.body.category?.trim();
  const imageUrl = request.body.imageUrl?.trim();
  const description = request.body.description?.trim();
  const userName = request.authUser.name || request.authUser.email;
  const userEmail = request.authUser.email;

  if (!title || !author || !category || !imageUrl || !description) {
    return response.status(400).json({ error: 'Complete all book and image URL fields.' });
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

app.patch('/books/:id', requireJwt, async (request, response) => {
  const userEmail = request.authUser.email;
  const title = request.body.bookTitle?.trim();
  const author = request.body.authorName?.trim();
  const category = request.body.category?.trim();
  const imageUrl = request.body.imageUrl?.trim();
  const description = request.body.description?.trim();

  if (!ObjectId.isValid(request.params.id)) {
    return response.status(400).json({ error: 'Invalid book ID.' });
  }

  if (!title || !author || !category || !imageUrl || !description) {
    return response.status(400).json({ error: 'Complete all book fields before saving.' });
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

  try {
    const result = await books.updateOne(
      { _id: new ObjectId(request.params.id), userEmail },
      {
        $set: {
          title,
          author,
          category,
          imageUrl,
          description,
          updatedAt: new Date(),
        },
      },
    );

    if (!result.matchedCount) {
      return response.status(404).json({ error: 'Book not found in your books.' });
    }

    const book = await books.findOne({ _id: new ObjectId(request.params.id) });
    return response.json({ message: 'Book updated successfully.', book });
  } catch (error) {
    console.error('Could not update book in MongoDB:', error);
    return response.status(500).json({ error: 'Could not update book. Please try again.' });
  }
});

app.delete('/books/:id', requireJwt, async (request, response) => {
  const userEmail = request.authUser.email;

  if (!ObjectId.isValid(request.params.id)) {
    return response.status(400).json({ error: 'A valid book ID is required.' });
  }

  try {
    const result = await books.deleteOne({
      _id: new ObjectId(request.params.id),
      userEmail,
    });

    if (!result.deletedCount) {
      return response.status(404).json({ error: 'Book not found in your books.' });
    }

    return response.json({ message: 'Book deleted successfully.' });
  } catch (error) {
    console.error('Could not delete book from MongoDB:', error);
    return response.status(500).json({ error: 'Could not delete book. Please try again.' });
  }
});

app.post('/borrows', requireJwt, async (request, response) => {
  const { bookId } = request.body;
  const userEmail = request.authUser.email;
  const requestedReturnDate = request.body.returnDate;

  if (!ObjectId.isValid(bookId) || typeof requestedReturnDate !== 'string') {
    return response.status(400).json({ error: 'A valid book and return date are required.' });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(requestedReturnDate)) {
    return response.status(400).json({ error: 'Choose a valid return date.' });
  }

  const returnDate = new Date(`${requestedReturnDate}T23:59:59.999Z`);
  if (
    Number.isNaN(returnDate.getTime()) ||
    returnDate.toISOString().slice(0, 10) !== requestedReturnDate ||
    returnDate <= new Date()
  ) {
    return response.status(400).json({ error: 'The return date must be in the future.' });
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
      bookImage: book.imageUrl,
      userEmail,
      borrowDate: new Date(),
      returnDate,
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

app.get('/borrows', requireAuth, async (request, response) => {
  try {
    const userBorrows = await borrows
      .find({ userEmail: request.authUser.email })
      .sort({ borrowDate: -1 })
      .toArray();
    return response.json(userBorrows);
  } catch (error) {
    console.error('Could not fetch borrows from MongoDB:', error);
    return response.status(500).json({ error: 'Could not fetch borrows. Please try again.' });
  }
});

app.delete('/borrows/:id', requireJwt, async (request, response) => {
  if (!ObjectId.isValid(request.params.id)) {
    return response.status(400).json({ error: 'A valid borrow ID is required.' });
  }

  try {
    const result = await borrows.deleteOne({
      _id: new ObjectId(request.params.id),
      userEmail: request.authUser.email,
    });

    if (!result.deletedCount) {
      return response.status(404).json({ error: 'Borrow record not found.' });
    }

    return response.json({ message: 'Book returned successfully.' });
  } catch (error) {
    console.error('Could not return book in MongoDB:', error);
    return response.status(500).json({ error: 'Could not return book. Please try again.' });
  }
});


app.get('/', (_request, response) => {
  response.json({ message: 'BookNook API server is running' });
});


app.use((error, _request, response, _next) => {
  console.error('Request failed:', error);
  return response.status(400).json({ error: 'Could not process the request.' });
});

app.listen(port, () => {
  console.log(`BookNook API server listening on port ${port}`);
});
