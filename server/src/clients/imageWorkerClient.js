const { createRetryCircuitHttpClient } = require('./retryCircuitHttp');

const DEFAULT_IMAGE_WORKER_URL = process.env.IMAGE_WORKER_URL || 'http://127.0.0.1:6000/';

const httpClient = createRetryCircuitHttpClient({
  timeoutMs: 3000,
  retries: 3,
  failureThreshold: 3,
  cooldownMs: 15000,
});

async function analyzeImageWithWorker({ imageUrl, payload, sourceId }) {
  const response = await httpClient.post(DEFAULT_IMAGE_WORKER_URL, {
    url: imageUrl,
    payload: payload || { sourceId },
  });

  return response.data || {};
}

function getImageWorkerCircuitStatus() {
  return httpClient.getCircuitStatus();
}

module.exports = { analyzeImageWithWorker, getImageWorkerCircuitStatus };
