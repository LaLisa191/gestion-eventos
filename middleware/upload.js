const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'public', 'uploads'));
  },
  filename: (req, file, cb) => {
    const unico = Date.now() + '-' + Math.round(Math.random() * 1e9);
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
