const mongoose = require('mongoose');
module.exports = async function connectDB(){
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/fake_trust';
mongoose.connect(process.env.MONGODB_URI);
  console.log('MongoDB connected');
}
