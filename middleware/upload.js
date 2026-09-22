const multer = require('multer');
const path = require('node:path');
const crypto = require('node:crypto');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'public', 'uploads'));
  },
  filename: (req, file, cb) => {
    const unico = Date.now() + '-' + crypto.randomBytes(8).toString('hex');
    cb(null, unico + path.extname(file.originalname).toLowerCase());
  }
});

function filtroImagen(req, file, cb) {
  const tiposPermitidos = /jpeg|jpg|png|webp/;
  const extensionValida = tiposPermitidos.test(path.extname(file.originalname).toLowerCase());
  const mimeValido = tiposPermitidos.test(file.mimetype);

  if (extensionValida && mimeValido) return cb(null, true);
  cb(new Error('Solo se permiten imágenes JPG, PNG o WEBP'));
}

const upload = multer({
  storage,
  limits: { fileSize: 3 * 1024 * 1024 }, // 3 MB
  fileFilter: filtroImagen
});

module.exports = upload;