const fs = require('node:fs');
const path = require('node:path');
const nodemailer = require('nodemailer');
const QRCode = require('qrcode');
const juiceModule = require('juice');
const juice = juiceModule.default || juiceModule;

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

// Se lee una sola vez al arrancar el servidor. Ajusta la ruta a tu estructura.
const CSS_CORREO = fs.readFileSync(
  path.join(__dirname, '../public/emails/confirmacion-evento.css'), 'utf8'
);

const ZONA_HORARIA = 'America/Bogota';
const RUTA_LOGO = path.join(__dirname, '../public/logo-udec.png');

// Evita que el nombre o lugar del evento inyecten HTML
const esc = (s = '') => String(s)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;').replaceAll('"', '&quot;');

const fila = (icono, titulo, valor) => `
  <tr>
    <td class="fila-icono" width="32" valign="top">${icono}</td>
    <td class="fila-texto">
      <div class="fila-titulo">${titulo}</div>
      <div class="fila-valor">${valor}</div>
    </td>
  </tr>`;

async function enviarConfirmacionRegistro(destinatario, evento) {
  const fechaObj = new Date(evento.date);
  const fecha = fechaObj.toLocaleDateString('es-CO', {
    day: 'numeric', month: 'long', timeZone: ZONA_HORARIA
  });
  const hora = fechaObj.toLocaleTimeString('es-CO', {
    hour: 'numeric', minute: '2-digit', hour12: true, timeZone: ZONA_HORARIA
  });
  const modalidad = evento.modality === 'virtual' ? 'Virtual' : 'Presencial';

  const urlEvento = `${process.env.APP_URL}/index.html#eventos`;
  const urlQR = `${process.env.APP_URL}/register.html?event=${evento._id}`;

  // El QR va adjunto y se referencia por cid; si falla, el correo sale sin él
  const attachments = [];

  if (fs.existsSync(RUTA_LOGO)) {
  attachments.push({ filename: 'logo-udec.png', path: RUTA_LOGO, cid: 'logo-udec' });
}

  let bloqueQR = '';
  try {
    const buffer = await QRCode.toBuffer(urlQR, {
      width: 400, margin: 2, errorCorrectionLevel: 'H'
    });
    attachments.push({ filename: 'qr-evento.png', content: buffer, cid: 'qr-evento' });
    bloqueQR = `
      <tr><td class="qr-contenedor">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="qr-caja" bgcolor="#ffffff">
          <tr><td class="qr-imagen-td" align="center">
            <img class="qr-imagen" src="cid:qr-evento" width="180" height="180" alt="Código QR del evento">
          </td></tr>
          <tr><td class="qr-titulo">Código del evento</td></tr>
          <tr><td class="qr-texto">Escanéalo para abrir la página del evento.</td></tr>
        </table>
      </td></tr>`;
  } catch (err) {
    console.error('No se pudo generar el QR del correo:', err);
  }

  const htmlBase = `
  <body style="margin:0;padding:0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="fondo" bgcolor="#1f1b2e">
   <tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" width="480" cellpadding="0" cellspacing="0" class="tarjeta" bgcolor="#2b2640"
           style="width:100%;max-width:480px;">

      <tr><td class="cabecera" bgcolor="#43335a" align="center">
        <div class="marca">evento<span class="marca-s">s</span></div>
        <div class="universidad">UNIVERSIDAD DE CARTAGENA</div>
        <div class="logo">
       <img src="cid:logo-udec" width="90" height="86" alt="Universidad de Cartagena"
       style="display:block;margin:0 auto;">
       </div>
        <div class="titulo">¡Tu lugar está reservado!</div>
        <div class="subtitulo">Tu inscripción se ha confirmado correctamente.</div>
      </td></tr>

      <tr><td class="detalles">
        <div class="evento-nombre">${esc(evento.name)}</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${fila('📅', 'Fecha y hora', `${fecha} · ${hora}`)}
          ${fila('📍', 'Lugar', esc(evento.location))}
          ${fila('🖥️', 'Modalidad', modalidad)}
        </table>
        <hr class="separador">
      </td></tr>

      ${bloqueQR}

      <tr><td class="boton-contenedor">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td class="boton-td" bgcolor="#8b5cf6" align="center">
            <a class="boton" href="${urlEvento}" target="_blank">Ver detalles del evento</a>
          </td>
        </tr></table>
      </td></tr>

      <tr><td class="pie">Guarda este correo para el día del evento.</td></tr>
    </table>
   </td></tr>
  </table>
  </body>`;

  // juice convierte las clases del CSS en estilos en línea
  const html = juice.inlineContent(htmlBase, CSS_CORREO);

  await transporter.sendMail({
    from: `"Eventos Universidad de Cartagena" <${process.env.EMAIL_USER}>`,
    to: destinatario,
    subject: `Registro confirmado: ${evento.name}`,
    text: `¡Tu lugar está reservado!\n\n${evento.name}\nFecha: ${fecha} · ${hora}\nLugar: ${evento.location}\nModalidad: ${modalidad}\n\nMás detalles: ${urlEvento}`,
    html,
    attachments
  });
}

module.exports = { enviarConfirmacionRegistro };