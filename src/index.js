import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import { anonymizeRouter } from './routes/anonymize.js';
import { deanonymizeRouter } from './routes/deanonymize.js';
import { secureChatGPTRouter } from './routes/secureChatGPT.js';

const app = express();
const port = Number(process.env.PORT) || 3001;

app.use(express.json({ limit: '32kb' }));
app.use(anonymizeRouter);
app.use(deanonymizeRouter);
app.use(secureChatGPTRouter);

app.use((err, _req, res, _next) => {
  // Do not log request bodies: they may contain PII.
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

if (!process.env.MONGO_URI) {
  console.error('MONGO_URI is missing: copy .env.example to .env and fill it in');
  process.exit(1);
}

try {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB Atlas');
} catch (error) {
  // Print only the message so the connection string never shows up in logs or screenshots.
  console.error('MongoDB connection error:', error.message);
  process.exit(1);
}

console.log(
  process.env.OPENAI_API_KEY ? 'OpenAI API key loaded' : 'OPENAI_API_KEY is missing: /secureChatGPT will return 503',
);

app.listen(port, () => {
  console.log(`Privacy vault listening on ${port}`);
});
