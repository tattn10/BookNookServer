import 'dotenv/config';
import cors from 'cors';
import express from 'express';

const app = express();
const port = Number(process.env.PORT ?? 8000);

app.use(cors());
app.use(express.json());

app.get('/', (_request, response) => {
  response.json({ message: 'BookNook API server is running' });
});

app.get('/health', (_request, response) => {
  response.json({ status: 'ok' });
});

app.listen(port, () => {
  console.log(`BookNook API server listening on port ${port}`);
});
