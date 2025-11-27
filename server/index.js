const express = require('express');
const cors = require('cors');

const authRouter = require('./routes/auth');
const policyRouter = require('./routes/policies');
const mypageRouter = require('./routes/mypage');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  console.log(`Headers:`, req.headers);
  console.log(`Query:`, req.query);
  console.log(`Body:`, req.body);
  next();
});

app.use('/api/auth', authRouter);
app.use('/api/policies', policyRouter);
app.use('/api/mypage', mypageRouter);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server on 0.0.0.0:${PORT}`);
});

