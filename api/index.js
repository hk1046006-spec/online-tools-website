'use strict';
// Vercel serverless entry point. server.js already exports the Express app
// and only calls app.listen() when run directly, so requiring it here is safe.
const app = require('../server.js');
module.exports = app;
