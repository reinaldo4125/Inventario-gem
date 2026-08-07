const express = require('express');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const router = express.Router();

// Load a basic OpenAPI spec (you can expand this file)
let spec;
try {
  spec = YAML.load('./docs/openapi.yaml');
} catch (e) {
  spec = {
    openapi: '3.0.0',
    info: { title: 'API Multinyectores', version: '1.0.0' },
    paths: {}
  };
}

router.use('/', swaggerUi.serve, swaggerUi.setup(spec));

module.exports = router;
