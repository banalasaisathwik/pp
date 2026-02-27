require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./db/mongoose');
const fileUpload = require('express-fileupload');


const app = express();
app.use(cors());
app.use(express.json());
app.use(fileUpload());
connectDB();

app.get('/', (req, res) => res.send('Server is working ✅'));

app.use('/api/analyze', require('./routes/analyze'));
app.use("/api/image", require("./routes/imageTrust"));
app.use("/api/verify", require("./routes/verify"));
app.use("/api/trust", require("./routes/trust"));

const PORT = process.env.PORT || 5000;
app.listen(PORT, ()=> console.log(`Server running on ${PORT}`));
