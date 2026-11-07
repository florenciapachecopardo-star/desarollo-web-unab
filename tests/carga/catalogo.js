// Prueba de carga del catálogo (S01) para el M9.
// Escenario y umbrales definidos en docs/m9-carga.md, fijados antes de medir.
// Ejecutar desde la raíz del repo, con el stack arriba y después de scripts/reset.sh:
//   k6 run tests/carga/catalogo.js
// Para otra URL: k6 run -e BASE_URL=http://localhost:8000 tests/carga/catalogo.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.2/index.js';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000';

export const options = {
  stages: [
    { duration: '30s', target: 20 },  // carga normal
    { duration: '30s', target: 100 }, // subida al peak
    { duration: '1m', target: 100 },  // peak sostenido
    { duration: '15s', target: 0 },   // bajada
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // p95 del catálogo menor a 500 ms
    http_req_failed: ['rate<0.01'],   // menos de 1% de errores
    http_reqs: ['rate>=25'],          // al menos 25 solicitudes por segundo
  },
};

export default function () {
  const res = http.get(`${BASE_URL}/api/v1/productos`);

  check(res, {
    'responde 200': (r) => r.status === 200,
    'trae X-Request-ID': (r) => r.headers['X-Request-Id'] !== undefined,
    'trae lista de productos': (r) => {
      try {
        return Array.isArray(r.json('productos'));
      } catch (e) {
        return false;
      }
    },
  });

  sleep(1);
}

export function handleSummary(data) {
  return {
    'evidencias/u2/k6-catalogo.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}
