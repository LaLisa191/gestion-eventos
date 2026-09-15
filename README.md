# Gestión de eventos — API de registro

Implementa el flujo de registro de un participante a un evento (RF3, RF4, RF5, RNF2)
sobre Node.js, Express y MongoDB (Mongoose).

## Estructura

```
config/db.js        Conexión a MongoDB
models/              Esquemas de Mongoose (Evento, Participante, Inscripcion)
routes/               Endpoints de la API (eventos, inscripciones)
public/index.html      Formulario de prueba
server.js              Arranca la app y conecta las rutas
```

## Cómo correrlo

1. `npm install`
2. Copia `.env.example` a `.env` y pon ahí tu cadena de conexión de MongoDB Atlas.
3. `npm start`
4. Abre http://localhost:3000

## Crear un evento de prueba

Antes de poder registrarte necesitas al menos un evento. Con Postman o curl:

```
POST http://localhost:3000/api/eventos
Content-Type: application/json

{ "nombre": "Semana de innovación IHC", "fecha": "2026-09-18", "lugar": "Auditorio central", "cupoMaximo": 5 }
```

El formulario en `/` toma automáticamente el primer evento creado.
