const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

async function enviarConfirmacionRegistro(destinatario, evento) {
  const fecha = new Date(evento.date).toLocaleDateString('es-CO', {
    day: 'numeric', month: 'long', year: 'numeric'
  });

  await transporter.sendMail({
    from: `"Eventos Universidad de Cartagena" <${process.env.EMAIL_USER}>`,
    to: destinatario,
    subject: `Registro confirmado: ${evento.name}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color:#8b5cf6">¡Registro confirmado!</h2>
        <p>Tu inscripción a <strong>${evento.name}</strong> quedó confirmada.</p>
        <p>
          <strong>Fecha:</strong> ${fecha}<br>
          <strong>Lugar:</strong> ${evento.location}<br>
          <strong>Modalidad:</strong> ${evento.modality === 'virtual' ? 'Virtual' : 'Presencial'}
        </p>
        <p>Nos vemos ahí.</p>
      </div>
    `
  });
}

module.exports = { enviarConfirmacionRegistro };
