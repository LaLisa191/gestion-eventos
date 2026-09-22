Eventos — Universidad de Cartagena

Aplicación web para centralizar la inscripción a eventos universitarios: los organizadores publican eventos con cupo limitado, y los participantes se registran y reciben confirmación visual e inmediata, además de un correo de confirmación.

-------------Funcionalidades-------------
* Autenticación con roles: cuentas de organizador y participante, con JWT.
* Organizador: crear, editar y eliminar sus propios eventos (con imagen), generar y consultar el reporte de asistencia.
* Participante: ver eventos disponibles (presenciales o virtuales), buscarlos por nombre, marcarlos como favoritos, registrarse, cancelar su registro, y ver "Mis eventos".
* Cupo disponible calculado en tiempo real; el sistema bloquea el registro cuando un evento se llena.
* Confirmación de registro por correo (Gmail vía Nodemailer, enviado de forma asíncrona para no bloquear la respuesta) y opción de descargar el evento como archivo .ics para el calendario.
* Edición de perfil (nombre, correo, contraseña).


-------------Stack técnico-------------
* Backend: Node.js, Express, Mongoose (MongoDB Atlas)
* Autenticación: JSON Web Tokens (jsonwebtoken) + contraseñas encriptadas (bcryptjs)
* Subida de imágenes: Multer, almacenamiento local en public/uploads
* Correo: Nodemailer (SMTP de Gmail)
* Frontend: HTML, CSS y JavaScript sin frameworks, servido como archivos estáticos desde Express
* Pruebas: Jest + Supertest, con mongodb-memory-server para no depender de una base de datos real durante los tests
* Calidad de código: SonarQube (análisis estático de seguridad, mantenibilidad y confiabilidad)


-------------Estructura del proyecto-------------

gestion-eventos/
├── app.js                      # Configura Express (middlewares y rutas)
├── server.js                   # Levanta el servidor a partir de app.js
├── config/
│   └── db.js                    # Conexión a MongoDB
├── middleware/
│   ├── auth.js                   # Verifica el token y el rol de organizador
│   └── upload.js                 # Configuración de Multer para imágenes
├── models/
│   ├── User.js                    # Usuario (organizador o participante)
│   ├── Event.js                   # Evento
│   ├── Registration.js            # Inscripción de un usuario a un evento
│   └── Reports.js                 # Reportes de asistencia generados
├── routes/
│   ├── Users.js                    # Registro, login, perfil, favoritos
│   ├── Events.js                   # CRUD de eventos y reportes
│   └── Registrations.js            # Registro/cancelación a un evento
├── utils/
│   └── mailer.js                    # Envío del correo de confirmación
├── tests/
│   ├── users.test.js                 # Pruebas de registro, login y perfil
│   ├── events.test.js                # Pruebas del CRUD de eventos
│   └── registrations.test.js         # Pruebas del flujo de registro/cupo
├── public/                            # Frontend (HTML, CSS, JS) y uploads/
├── jest.setup.js                      # Configuración global de Jest
├── .env                                # Variables de entorno (no se sube al repo)
├── .env.test                           # Variables de entorno usadas al correr los tests
└── sonar-project.properties            # Configuración del análisis de SonarQube


-------------Requisitos previos-------------

* Node.js (v18 o superior)
* Una base de datos en MongoDB Atlas (gratuita)
* Una cuenta de Gmail con verificación en 2 pasos activa, para generar una contraseña de aplicación
* (Opcional, para el análisis de calidad) SonarQube Community corriendo localmente


-------------Instalación-------------

1. Clona el repositorio y entra a la carpeta:
   git clone <url-del-repo>
   cd gestion-eventos

2. Instala las dependencias:
   npm install

3. Crea un archivo .env en la raíz del proyecto con estas variables:

   MONGODB_URI=mongodb+srv://usuario:contraseña@cluster0.xxxxx.mongodb.net/gestion-eventos
   PORT=3000
   JWT_SECRET=un-texto-largo-y-aleatorio
   EMAIL_USER=tucorreo@dominio.com
   EMAIL_PASS=contraseña-de-aplicación-de-16-caracteres

* MONGODB_URI: cadena de conexión de tu cluster de Atlas (Database → Connect → Drivers), agregando el nombre de la base al final de la URL.
* JWT_SECRET: cualquier texto largo, es la clave con la que se firman los tokens de sesión.
* EMAIL_USER / EMAIL_PASS: la cuenta de Gmail y su contraseña de aplicación (no la contraseña normal de la cuenta).

4. Crea la carpeta donde se guardan las imágenes de los eventos (si no existe):
   mkdir -p public/uploads


-------------Uso-------------

Levantar el servidor:
npm start

Abre http://localhost:3000 en el navegador. Desde ahí puedes crear una cuenta (como organizador o como participante), publicar un evento y probar el flujo completo de registro.

-------------Pruebas-------------

El proyecto usa Jest y Supertest, con una base de datos MongoDB en memoria (no toca la base real de Atlas). Necesitas un archivo .env.test con las mismas variables que .env (puede usar un JWT_SECRET de prueba y no requiere EMAIL_USER/EMAIL_PASS reales si el envío de correo se omite en el entorno de pruebas).

Correr toda la suite:
npm test

Cubre: registro/login/perfil de usuarios, el CRUD de eventos (creación, edición, permisos de organizador), y el flujo de registro a un evento (incluyendo el control de cupo).

-------------Análisis de calidad (SonarQube)-------------

El proyecto se analiza periódicamente con SonarQube (configuración en sonar-project.properties) para revisar seguridad, mantenibilidad y confiabilidad del código. Los hallazgos se documentan y resuelven.


-------------NOTAS-------------
* Si MONGODB_URI usa mongodb+srv:// y la conexión falla con un error de DNS o SSL, revisa que tu IP esté permitida en Atlas (Network Access) o prueba con la cadena de conexión "estándar" (sin +srv) que ofrece Atlas como alternativa.
* Si el envío de correo falla, el registro del participante se guarda de todas formas — el correo no es un paso bloqueante.
* Las imágenes subidas se guardan en public/uploads/ y se sirven automáticamente como archivos estáticos; no requieren una ruta aparte.