// juice v11+ es solo ESM y Jest (CommonJS) no puede cargarlo: se sustituye por una versión que no procesa estilos
const juice = (html) => html;
juice.inlineContent = (html) => html;
juice.default = juice;

module.exports = juice;
