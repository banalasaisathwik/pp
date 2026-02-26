import { useEffect, useMemo, useState } from 'react';
import {
  analyzeArticle,
  analyzeImage,
  verifyArticle,
  type AnalyzeImageResponse,
  type AnalyzeResponse,
  type VerifyArticleResponse,
} from './api/client';

type ImageInfo = {
  url: string;
  firstAppeared?: string;
  reused?: boolean;
  sha256?: string;
  sourceId?: string;
};

type Article = {
  id: number;
  authorName: string;
  authorEmail: string;
  title: string;
  url: string;
  text: string;
  image?: ImageInfo;
};

type ArticleState = {
  loading: boolean;
  error?: string;
  analysis?: AnalyzeResponse;
  imageInfo?: ImageInfo;
};

type Toast = { type: 'success' | 'error'; message: string } | null;

const excerpt = (text: string, size = 120) => (text.length > size ? `${text.slice(0, size)}...` : text);

function trustMeta(score?: number) {
  const pct = Math.round((score ?? 0) * 100);
  if (pct >= 75) return { label: `${pct}% Trust`, tone: 'trust-good' };
  if (pct >= 50) return { label: `${pct}% Trust`, tone: 'trust-warn' };
  return { label: `${pct}% Trust`, tone: 'trust-bad' };
}

export default function App() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [articleState, setArticleState] = useState<Record<number, ArticleState>>({});
  const [activeId, setActiveId] = useState<number | null>(null);
  const [isDark, setIsDark] = useState(true);
  const [toast, setToast] = useState<Toast>(null);
  const [verifyResult, setVerifyResult] = useState<VerifyArticleResponse | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);

  useEffect(() => {
    fetch('/articles.json')
      .then((res) => res.json())
      .then((data: Article[]) => {
        setArticles(data);
        if (!activeId && data.length) setActiveId(data[0].id);
      })
      .catch(() => setToast({ type: 'error', message: 'Failed to load articles feed' }));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!articles.length) return;

    articles.forEach(async (article) => {
      setArticleState((prev) => ({ ...prev, [article.id]: { ...prev[article.id], loading: true } }));
      try {
        const analysis = await analyzeArticle({
          url: article.url,
          title: article.title,
          text: article.text,
          source: article.authorName,
          authorEmail: article.authorEmail,
        });

        let imageInfo: ImageInfo | undefined;
        if (article.image?.url) {
          try {
            const wmData: AnalyzeImageResponse = await analyzeImage({
              imageUrl: article.image.url,
              sourceId: article.authorEmail,
              payload: { authorName: article.authorName, title: article.title },
            });
            imageInfo = {
              url: wmData.info?.url ?? article.image.url,
              firstAppeared: wmData.info?.firstAppeared,
              reused: wmData.info?.reused,
              sha256: wmData.info?.sha256,
              sourceId: wmData.info?.sourceId,
            };
          } catch {
            imageInfo = article.image;
          }
        }

        setArticleState((prev) => ({
          ...prev,
          [article.id]: { loading: false, analysis, imageInfo },
        }));
      } catch {
        setArticleState((prev) => ({
          ...prev,
          [article.id]: { loading: false, error: 'Failed to fetch analysis' },
        }));
      }
    });
  }, [articles]);

  const activeArticle = useMemo(() => articles.find((a) => a.id === activeId) ?? null, [articles, activeId]);
  const activeState = activeArticle ? articleState[activeArticle.id] : undefined;

  const handleVerify = async () => {
    if (!activeArticle) return;
    setVerifyLoading(true);
    setVerifyResult(null);
    try {
      const result = await verifyArticle(String(activeArticle.id));
      setVerifyResult(result);
      setToast({ type: result.verified ? 'success' : 'error', message: result.verified ? 'Integrity verified' : 'Integrity mismatch' });
    } catch (err) {
      setToast({ type: 'error', message: (err as Error).message || 'Verification failed' });
    } finally {
      setVerifyLoading(false);
    }
  };

  return (
    <div className={`app ${isDark ? 'theme-dark' : 'theme-light'}`}>
      <header className="topbar">
        <h1>News Credibility Studio</h1>
        <button className="mode-btn" onClick={() => setIsDark((v) => !v)}>
          {isDark ? '☀️ Light' : '🌙 Dark'}
        </button>
      </header>

      {toast && <div className={`toast ${toast.type}`}>{toast.message}</div>}

      <main className="layout">
        <section className="feed">
          <h2>News Feed</h2>
          <div className="feed-grid">
            {articles.map((article) => {
              const state = articleState[article.id];
              const trust = trustMeta(state?.analysis?.f);
              return (
                <article
                  key={article.id}
                  className={`card news-card ${activeId === article.id ? 'active' : ''}`}
                  onClick={() => setActiveId(article.id)}
                >
                  <h3>{article.title}</h3>
                  <p>{excerpt(article.text)}</p>
                  <div className="meta-row">
                    <span>{article.authorName}</span>
                    <span className={`pill ${trust.tone}`}>{state?.loading ? '...' : trust.label}</span>
                  </div>
                  {state?.analysis?.blockchain?.status === 'success' && <span className="pill chain-ok">Blockchain Verified</span>}
                </article>
              );
            })}
          </div>
        </section>

        <section className="detail">
          <h2>Article Detail</h2>
          {!activeArticle && <div className="card">Select an article</div>}
          {activeArticle && (
            <div className="card detail-card fade-in">
              {activeState?.loading ? (
                <div className="skeleton-block" />
              ) : activeState?.error ? (
                <div className="error">{activeState.error}</div>
              ) : (
                <>
                  <h3>{activeArticle.title}</h3>
                  <a href={activeArticle.url} target="_blank" rel="noreferrer">{activeArticle.url}</a>
                  <p className="content">{activeArticle.text}</p>

                  <div className="score-hero">Trust Score: {Math.round((activeState?.analysis?.f ?? 0) * 100)}%</div>

                  <div className="bars">
                    {[
                      { label: 'Message Score (M)', val: activeState?.analysis?.M ?? 0 },
                      { label: 'Fact Score (F)', val: activeState?.analysis?.F ?? 0 },
                      { label: 'Context Score (C)', val: activeState?.analysis?.C ?? 0 },
                    ].map((item) => (
                      <div key={item.label} className="bar-row">
                        <span>{item.label}</span>
                        <div className="bar-track"><div className="bar-fill" style={{ width: `${Math.round(item.val * 100)}%` }} /></div>
                      </div>
                    ))}
                  </div>

                  <div className="author card-lite">
                    <h4>Author Profile</h4>
                    <p>Credibility: <strong>{Math.round((activeState?.analysis?.author?.trustScore ?? 0) * 100)}%</strong></p>
                    <p>Total Articles: {activeState?.analysis?.author?.totalArticles ?? 0}</p>
                    <p>Fake Articles: {activeState?.analysis?.author?.fakeArticles ?? 0}</p>
                  </div>

                  <div className="chain card-lite">
                    <h4>Blockchain Verification</h4>
                    <p>Status: {activeState?.analysis?.blockchain?.status ?? 'pending'}</p>
                    <p>Tx Hash: {activeState?.analysis?.blockchain?.txHash ?? 'N/A'}</p>
                    <p>Timestamp: {activeState?.analysis?.blockchain?.timestamp ?? 'N/A'}</p>
                    <button className="verify-btn" onClick={handleVerify} disabled={verifyLoading}>
                      {verifyLoading ? 'Verifying...' : 'Verify Integrity'}
                    </button>
                    {verifyResult && (
                      <div className="verify-result">
                        <p>Verified: {String(verifyResult.verified)}</p>
                        <p>Status: {verifyResult.blockchainStatus}</p>
                        <p>Tx: {verifyResult.txHash ?? 'N/A'}</p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
