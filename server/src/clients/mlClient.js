const { createRetryCircuitHttpClient } = require('./retryCircuitHttp');

const httpClient = createRetryCircuitHttpClient({
  timeoutMs: 3000,
  retries: 3,
  failureThreshold: 3,
  cooldownMs: 15000,
});

async function getScoresFromML(payload) {
  if (!process.env.ML_API_URL) {
    throw new Error('ML_API_URL not configured');
  }

  const response = await httpClient.post(process.env.ML_API_URL, payload);
  return response.data;
}

function getMLCircuitStatus() {
  return httpClient.getCircuitStatus();
}

module.exports = { getScoresFromML, getMLCircuitStatus };
