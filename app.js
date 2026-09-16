require('dotenv').config();

const express = require('express');
const path = require('path');

const app = express();

app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/users', require('./routes/Users'));
app.use('/api/events/:id/registrations', require('./routes/Registrations'));
app.use('/api/events', require('./routes/Events'));

module.exports = app;