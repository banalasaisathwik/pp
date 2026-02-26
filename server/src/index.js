require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./db/mongoose');
const fileUpload = require('express-fileupload');
const { requestIdMiddleware } = require('./middleware/requestId');
const logger = require('./utils/logger');

const app = express();
app.use(cors());
app.use(express.json());
app.use(fileUpload());
app.use(requestIdMiddleware);
connectDB();

app.get('/', (req, res) => res.json({ success: true, data: 'Server is working ✅' }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/analyze', require('./routes/analyze'));
app.use('/api/image', require('./routes/imageTrust'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/articles', require('./routes/articles'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => logger.info('server_started', { port: PORT }));
