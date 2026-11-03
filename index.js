import 'dotenv/config';
import { MongoClient } from 'mongodb';
import { createApp } from './app.js';

const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
  throw new Error('MONGODB_URI must be set in the Server environment.');
}

const client = new MongoClient(mongoUri);
await client.connect();

const database = client.db(process.env.MONGODB_DB ?? 'booknook');
const app = createApp(database);
const port = Number(process.env.PORT ?? 8000);

app.listen(port, () => {
  console.log(`BookNook API server listening on port ${port}`);
});
