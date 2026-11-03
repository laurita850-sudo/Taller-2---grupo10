import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import { anonymizeRouter } from './routes/anonymize.js';
import { deanonymizeRouter } from './routes/deanonymize.js';

const app = express();
const port = Number(process.env.PORT) || 3001;

app.use(express.json({ limit: '32kb' }));
app.use(anonymizeRouter);
app.use(deanonymizeRouter);

app.use((err, _req, res, _next) => {
  // Do not log request bodies: they may contain PII.
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

try {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB Atlas');
} catch (error) {
  console.error('MongoDB connection error:', error);
  process.exit(1);
}

app.listen(port, () => {
  console.log(`Privacy vault listening on ${port}`);
});
