require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./db/mongoose');

const app = express();
app.use(cors());
app.use(express.json());

connectDB();
app.get('/', (req, res) => res.send('Server is working ✅'));

app.use('/api/analyze', require('./routes/analyze'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, ()=> console.log(`Server running on ${PORT}`));
