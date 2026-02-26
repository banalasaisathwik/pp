const axios = require('axios');
const logger = require('../utils/logger');

function createRetryCircuitHttpClient({
  timeoutMs = 3000,
  retries = 3,
  failureThreshold = 3,
  cooldownMs = 15000,
} = {}) {
  let consecutiveFailures = 0;
  let openUntil = 0;

  async function post(url, data, config = {}) {
    const now = Date.now();
    if (now < openUntil) {
      throw new Error(`CircuitOpen: downstream unavailable until ${new Date(openUntil).toISOString()}`);
    }

    let lastErr;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        const response = await axios.post(url, data, {
          timeout: timeoutMs,
          ...config,
        });
        consecutiveFailures = 0;
        openUntil = 0;
        return response;
      } catch (err) {
        lastErr = err;
        const status = err?.response?.status;
        const shouldRetry =
          attempt < retries && (!status || (status >= 500 && status <= 599));

        logger.warn('http_request_failed_attempt', {
          url,
          attempt,
          status,
          message: err.message,
          willRetry: shouldRetry,
        });

        if (!shouldRetry) {
          break;
        }
      }
    }

    consecutiveFailures += 1;
    if (consecutiveFailures >= failureThreshold) {
      openUntil = Date.now() + cooldownMs;
      logger.warn('circuit_opened', { url, openUntil });
    }

    throw lastErr;
  }

  function getCircuitStatus() {
    const now = Date.now();
    return {
      isOpen: now < openUntil,
      openUntil,
      consecutiveFailures,
    };
  }

  return { post, getCircuitStatus };
}

module.exports = { createRetryCircuitHttpClient };
