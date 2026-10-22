const multer = require('multer');
const request = require('supertest');
const app = require('../app');
const manejarErrores = require('../middleware/errorHandler');

function crearRes(headersSent = false) {
  const res = { headersSent, status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
}

describe('Manejador de errores', () => {

  test('debe responder 400 si el archivo supera el tamaño permitido', () => {
    const res = crearRes();

    manejarErrores(new multer.MulterError('LIMIT_FILE_SIZE'), {}, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'La imagen no puede pesar más de 3 MB' });
  });

  test('debe responder 400 ante otros errores de subida', () => {
    const res = crearRes();

    manejarErrores(new multer.MulterError('LIMIT_UNEXPECTED_FILE'), {}, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'No se pudo subir la imagen' });
  });

  test('debe mostrar el mensaje de los errores con código de cliente', () => {
    const res = crearRes();
    const error = Object.assign(new Error('Dato no permitido'), { status: 422 });

    manejarErrores(error, {}, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith({ message: 'Dato no permitido' });
  });

  test('debe responder 500 sin exponer el detalle del error', () => {
    const res = crearRes();
    const silenciarError = jest.spyOn(console, 'error').mockImplementation(() => {});

    try {
      manejarErrores(new Error('detalle interno secreto'), {}, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Error interno del servidor' });
      expect(silenciarError).toHaveBeenCalled();
    } finally {
      silenciarError.mockRestore();
    }
  });

  test('debe delegar en Express si la respuesta ya empezó a enviarse', () => {
    const res = crearRes(true);
    const next = jest.fn();
    const error = new Error('tarde');

    manejarErrores(error, {}, res, next);

    expect(next).toHaveBeenCalledWith(error);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('debe responder 400 si el cuerpo de la petición no es un JSON válido', async () => {
    const response = await request(app)
      .post('/api/users/login')
      .set('Content-Type', 'application/json')
      .send('{"email": ');

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe('El cuerpo de la petición no es un JSON válido');
  });
});
