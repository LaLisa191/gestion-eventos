const multer = require('multer');

// Último middleware de Express: convierte cualquier error en una respuesta JSON.
// Debe declarar los 4 parámetros para que Express lo reconozca como manejador de errores.
function manejarErrores(err, req, res, next) {
  // Si la respuesta ya empezó a enviarse, Express debe cerrarla él mismo
  if (res.headersSent) return next(err);

  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? 'La imagen no puede pesar más de 3 MB'
      : 'No se pudo subir la imagen';
    return res.status(400).json({ message });
  }

  // JSON mal formado en el cuerpo de la petición
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'El cuerpo de la petición no es un JSON válido' });
  }

  // Errores con código de cliente (por ejemplo, el filtro de imágenes): se muestra su mensaje
  if (err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({ message: err.message });
  }

  // Cualquier otro error: el detalle técnico queda en el servidor, no se envía al usuario
  console.error('Error no controlado:', err);
  res.status(500).json({ message: 'Error interno del servidor' });
}

module.exports = manejarErrores;
