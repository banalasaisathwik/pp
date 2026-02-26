const counters = {
  mlFailureCount: 0,
  fallbackUsageCount: 0,
  blockchainFailureCount: 0,
};

function increment(name, by = 1) {
  counters[name] = (counters[name] || 0) + by;
}

function getMetricsSnapshot() {
  return { ...counters };
}

module.exports = { increment, getMetricsSnapshot };
