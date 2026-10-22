const fs = require('node:fs');
const QRCode = require('qrcode');

const mockSendMail = jest.fn();
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail: mockSendMail }))
}));

let enviarConfirmacionRegistro;

beforeAll(() => {
  process.env.EMAIL_USER = 'eventos@example.com';
  process.env.APP_URL = 'http://localhost:3000';

  // jest.setup.js simula este módulo en todos los tests; aquí se prueba el real
  ({ enviarConfirmacionRegistro } = jest.requireActual('../utils/mailer'));
});

beforeEach(() => {
  mockSendMail.mockReset();
  mockSendMail.mockResolvedValue({});
});

const evento = (extra = {}) => ({
  _id: '507f1f77bcf86cd799439011',
  name: 'Feria 2027',
  date: '2026-12-15T23:00:00.000Z',
  location: 'Parque Central',
  modality: 'in-person',
  ...extra
});

const correoEnviado = () => mockSendMail.mock.calls[0][0];
const cids = (correo) => correo.attachments.map(adjunto => adjunto.cid);

describe('Correo de confirmación de registro', () => {

  test('debe enviar el correo al participante con los datos del evento', async () => {
    await enviarConfirmacionRegistro('participante@example.com', evento());

    expect(mockSendMail).toHaveBeenCalledTimes(1);
    const correo = correoEnviado();
    expect(correo.to).toBe('participante@example.com');
    expect(correo.from).toContain('eventos@example.com');
    expect(correo.subject).toBe('Registro confirmado: Feria 2027');
    expect(correo.text).toContain('Feria 2027');
    expect(correo.text).toContain('Parque Central');
    expect(correo.text).toContain('Modalidad: Presencial');
    expect(correo.html).toContain('Feria 2027');
  });

  test('debe indicar la modalidad virtual', async () => {
    await enviarConfirmacionRegistro('participante@example.com', evento({ modality: 'virtual' }));

    expect(correoEnviado().text).toContain('Modalidad: Virtual');
  });

  test('debe escapar el HTML del nombre y el lugar del evento', async () => {
    await enviarConfirmacionRegistro(
      'participante@example.com',
      evento({ name: '<script>alert(1)</script>', location: 'Sala "A" & B' })
    );

    const { html } = correoEnviado();
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('Sala &quot;A&quot; &amp; B');
  });

  test('debe adjuntar el QR con el enlace de registro del evento', async () => {
    const espia = jest.spyOn(QRCode, 'toBuffer');

    try {
      await enviarConfirmacionRegistro('participante@example.com', evento());

      expect(espia).toHaveBeenCalledWith(
        'http://localhost:3000/register.html?event=507f1f77bcf86cd799439011',
        expect.any(Object)
      );
      expect(cids(correoEnviado())).toContain('qr-evento');
    } finally {
      espia.mockRestore();
    }
  });

  test('debe adjuntar el logo de la universidad cuando el archivo existe', async () => {
    await enviarConfirmacionRegistro('participante@example.com', evento());

    expect(cids(correoEnviado())).toContain('logo-udec');
  });

  test('debe enviar el correo sin logo si el archivo no existe', async () => {
    const espia = jest.spyOn(fs, 'existsSync').mockReturnValueOnce(false);

    try {
      await enviarConfirmacionRegistro('participante@example.com', evento());

      expect(cids(correoEnviado())).not.toContain('logo-udec');
    } finally {
      espia.mockRestore();
    }
  });

  test('debe enviar el correo sin QR si falla su generación', async () => {
    const silenciarError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const espia = jest.spyOn(QRCode, 'toBuffer').mockRejectedValueOnce(new Error('fallo del QR'));

    try {
      await enviarConfirmacionRegistro('participante@example.com', evento());

      const correo = correoEnviado();
      expect(cids(correo)).not.toContain('qr-evento');
      expect(correo.html).not.toContain('qr-evento');
      expect(silenciarError).toHaveBeenCalled();
    } finally {
      espia.mockRestore();
      silenciarError.mockRestore();
    }
  });

  test('debe propagar el error si falla el envío', async () => {
    mockSendMail.mockRejectedValueOnce(new Error('SMTP caído'));

    await expect(
      enviarConfirmacionRegistro('participante@example.com', evento())
    ).rejects.toThrow('SMTP caído');
  });
});
