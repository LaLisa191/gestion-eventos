const express = require('express');
const QRCode = require('qrcode');
const mongoose = require('mongoose');
const Event = require('../models/Event');

// IMPORTANTE: Si usas un logger personalizado (como Winston o Pino), debes importarlo:
// const logger = require('../utils/logger'); 

const router = express.Router();

router.get('/:id/qr', async (req, res) => {
    try {
        const { id } = req.params;

        // 1. Validación de ObjectId (Muy buena práctica)
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                message: 'Id de evento inválido'
            });
        }

        const event = await Event.findById(id);

        // 2. Excelente uso del optional chaining (?.)
        // Cubre tanto si el evento no existe (null) como si existe pero no está activo.
        if (event?.status !== 'active') {
            return res.status(404).json({
                message: 'Evento no disponible'
            });
        }

        const url = `${process.env.APP_URL}/register.html?event=${event._id}`;

        const qr = await QRCode.toDataURL(url, {
            width: 400,
            margin: 2,
            errorCorrectionLevel: 'H'
        });

        res.json({
            eventId: event._id,
            url,
            qr
        });

    } catch (err) {
        // Solución si no tienes un logger importado: usar console.error
        console.error('Error generando QR', err);
        
        return res.status(500).json({
            message: 'No se pudo generar el QR'
        });
    }
}); 

module.exports = router;