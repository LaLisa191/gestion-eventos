const mongoose = require('mongoose');
const connectDB = require('./config/db');

beforeAll(async () => {
  await connectDB();
}, 10000);

afterAll(async () => {
  await mongoose.connection.close();
});