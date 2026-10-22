require('dotenv').config();

const express = require('express');
const path = require(`path`);
const app = express();

app.disable('x-powered-by');

app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/users', require('./routes/Users'));
app.use('/api/events/:id/registrations', require('./routes/Registrations'));
app.use('/api/events', require('./routes/Events'));
app.use('/api/events/qr', require('./routes/EventQR'));

// Debe ir después de todas las rutas para capturar sus errores
app.use(require('./middleware/errorHandler'));

module.exports = app;