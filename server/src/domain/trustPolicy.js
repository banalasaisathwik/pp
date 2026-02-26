function computeCompositeScore({ M, F, C, alpha, beta }) {
  return alpha * M + beta * F + (1 - alpha - beta) * C;
}

function applyAuthorTrustUpdate(author, score) {
  author.totalArticles += 1;

  if (score >= 0.7) {
    author.trustScore = Math.min(author.trustScore + 0.05, 1);
    return author;
  }

  if (score < 0.3) {
    author.fakeArticles += 1;
    author.trustScore = Math.max(author.trustScore - 0.1, 0);
  }

  return author;
}

module.exports = {
  computeCompositeScore,
  applyAuthorTrustUpdate,
};
