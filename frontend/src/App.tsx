import { useState, useEffect, type CSSProperties } from 'react';

type ImageInfo = {
  url: string;
  firstAppeared?: string;
  reused?: boolean;
  sha256?: string;
  sourceId?: string;
};

type AnalysisResponse = {
  M?: number;
  F?: number;
  C?: number;
  f?: number;
  error?: string;
  author?: {
    name?: string;
    email?: string;
    trustScore?: number;
    totalArticles?: number;
    fakeArticles?: number;
  };
  imageInfo?: ImageInfo;
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

export default function App() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [analysisCache, setAnalysisCache] = useState<Record<number, AnalysisResponse>>({});

  useEffect(() => {
    fetch('/articles.json')
      .then(res => res.json())
      .then((data: Article[]) => {
        setArticles(data);
        prefetchScores(data, 0, {});
      })
      .catch(err => console.error('Failed to load articles.json:', err));

    const cached = localStorage.getItem('analysisCache');
    if (cached) setAnalysisCache(JSON.parse(cached));
  }, []);

  const prefetchScores = async (
    articleList: Article[],
    startIndex: number,
    currentCache: Record<number, AnalysisResponse>
  ) => {
    const batch = articleList.slice(startIndex, startIndex + 10);
    const newCache = { ...currentCache };

    await Promise.all(batch.map(async (article) => {
      if (!newCache[article.id]) {
        let data: AnalysisResponse = {};
        try {
          const res = await fetch('http://172.16.5.182:5000', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: article.title,
              text: article.text,
            }),
          });
          data = await res.json();
        } catch (err) {
          console.error('ML API failed:', err);
          data.error = 'Failed to fetch score';
        }
if (article.image?.url) {
  try {
    const wmRes = await fetch('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageUrl: article.image.url,
        sourceId: article.authorEmail,
        payload: { authorName: article.authorName, title: article.title },
      }),
    });

    const wmData = await wmRes.json();

    if (wmData?.info) {
      data.imageInfo = {
        url: wmData.info.url ?? article.image.url,
        firstAppeared: wmData.info.firstAppeared,
        reused: wmData.info.reused,
        sha256: wmData.info.sha256,
        sourceId: wmData.info.sourceId,
      };
    } else {
      console.warn('No image info returned from DB, using fallback');
      data.imageInfo = { url: article.image.url, sourceId: article.authorEmail };
    }
  } catch (err) {
    console.error('Failed to fetch or insert image info:', err);
    data.imageInfo = { url: article.image.url, sourceId: article.authorEmail };
  }
}


        newCache[article.id] = data;
      }
    }));

    setAnalysisCache(newCache);
    localStorage.setItem('analysisCache', JSON.stringify(newCache));
  };

  useEffect(() => {
    if (articles.length === 0) return;
    const batchStart = Math.floor(currentIndex / 10) * 10;
    prefetchScores(articles, batchStart, analysisCache);
  }, [currentIndex, articles]);

  const nextArticle = () => setCurrentIndex(i => Math.min(i + 1, articles.length - 1));
  const prevArticle = () => setCurrentIndex(i => Math.max(i - 1, 0));

  const currentArticle = articles[currentIndex];
  const res = currentArticle ? analysisCache[currentArticle.id] : null;

  const container: CSSProperties = {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #f9fafb, #f3f4f6)',
    padding: '1rem',
    fontFamily: 'Arial, sans-serif',
  };

  const headerStyle: CSSProperties = {
    textAlign: 'center',
    marginBottom: '2rem',
    fontSize: '2.5rem',
    fontWeight: 'bold',
    background: 'linear-gradient(to right, #2563eb, #8b5cf6)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  };

  const articleCard: CSSProperties = {
    backgroundColor: 'white',
    borderRadius: '16px',
    padding: '1.5rem',
    marginBottom: '1.5rem',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
  };

  const articleTitle: CSSProperties = {
    fontSize: '1.5rem',
    fontWeight: 'bold',
    marginBottom: '0.5rem',
  };

  const articleText: CSSProperties = {
    color: '#4b5563',
    lineHeight: 1.6,
  };

  const imageStyle: CSSProperties = {
    width: '100%',
    height: '15rem',
    objectFit: 'cover',
    borderTopLeftRadius: '16px',
    borderTopRightRadius: '16px',
  };

  const overlayStyle: CSSProperties = {
    position: 'absolute',
    top: '0.5rem',
    left: '0.5rem',
    backgroundColor: 'rgba(0,0,0,0.7)',
    color: 'white',
    padding: '0.25rem 0.5rem',
    borderRadius: '8px',
    fontSize: '0.75rem',
  };

  const analysisCard: CSSProperties = {
    backgroundColor: '#eff6ff',
    borderRadius: '16px',
    padding: '1rem',
    marginBottom: '1rem',
    boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)',
  };

  const analysisItem: CSSProperties = {
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: '12px',
    padding: '0.75rem',
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
  };

  const navButton: CSSProperties = {
    flex: 1,
    padding: '0.75rem 1rem',
    cursor: 'pointer',
    borderRadius: '8px',
  };

  const disabledButton: CSSProperties = {
    ...navButton,
    opacity: 0.5,
    cursor: 'not-allowed',
  };

  return (
    <div style={container}>
      <header style={headerStyle}> News Trust Analysis</header>

      {currentArticle && (
        <div style={{ borderRadius: '16px', overflow: 'hidden', boxShadow: '0 6px 18px rgba(0,0,0,0.1)' }}>
          {/* Article Image */}
          {currentArticle.image && (
  <div style={{ position: 'relative' }}>
    <img src={currentArticle.image.url} alt={currentArticle.title} style={imageStyle} />
    {res?.imageInfo?.firstAppeared && (
      <div style={overlayStyle}>
        First Appeared:{' '}
        {res.imageInfo.reused
          ? `${new Date(res.imageInfo.firstAppeared).toLocaleDateString()} ⚠️ Old Image`
          : new Date(res.imageInfo.firstAppeared).toLocaleDateString()}
      </div>
    )}
  </div>
)}


          <div style={{ padding: '1.5rem' }}>
            {/* Article Card */}
            <div style={articleCard}>
              <h2 style={articleTitle}>{currentArticle.title}</h2>
              <a
                href={currentArticle.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: '0.875rem', color: '#2563eb', display: 'block', marginBottom: '0.5rem' }}
              >
                {currentArticle.url}
              </a>
              <p style={articleText}>{currentArticle.text}</p>
            </div>

            {/* Analysis & Author side by side */}
{res && !res.error && (
  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '1rem' }}>
    {/* Analysis Results */}
    <div style={{ ...analysisCard, flex: 1, minWidth: '300px' }}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>📊 Analysis Results</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        {[
          { label: 'Message Score (M)', value: res.M },
          { label: 'Fact Score (F)', value: res.F },
          { label: 'Context Score (C)', value: res.C },
          { label: 'Trust Score (f)', value: res.f },
        ].map(({ label, value }) => {
          const isTrustScore = label === 'Trust Score (f)';
          const lowScore = isTrustScore && typeof value === 'number' && value < 0.3;

          return (
            <div
              key={label}
              style={{
                ...analysisItem,
                backgroundColor: lowScore ? '#fee2e2' : 'rgba(255,255,255,0.8)',
              }}
            >
              <p style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>{label}</p>
              <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: lowScore ? '#b91c1c' : '#2563eb' }}>
                {typeof value === 'number' ? value.toFixed(3) : 'N/A'}
              </p>
            </div>
          );
        })}
      </div>
    </div>

    {/* Author Profile */}
    {res.author && (
      <div
        style={{
          ...analysisCard,
          flex: 1,
          minWidth: '300px',
          background: 'linear-gradient(135deg, #d1fae5, #a7f3d0)',
        }}
      >
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>👤 Author Profile</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div style={analysisItem}>
            <p style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>Author</p>
            <p style={{ fontWeight: 600 }}>{res.author.name ?? 'N/A'}</p>
            <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.5rem' }}>{res.author.email ?? 'N/A'}</p>
          </div>
          <div
            style={{
              ...analysisItem,
              backgroundColor:
                res.author.trustScore !== undefined && res.author.trustScore < 0.3 ? '#fee2e2' : 'rgba(255,255,255,0.8)',
            }}
          >
            <p style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>Trust Score</p>
            <p
              style={{
                fontSize: '1.5rem',
                fontWeight: 'bold',
                color:
                  res.author.trustScore !== undefined && res.author.trustScore < 0.3 ? '#b91c1c' : '#2563eb',
              }}
            >
              {res.author.trustScore?.toFixed(2) ?? 'N/A'}
            </p>
          </div>
          <div style={analysisItem}>
            <p style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>Total Articles</p>
            <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#374151' }}>{res.author.totalArticles ?? '0'}</p>
          </div>
          <div style={analysisItem}>
            <p style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>Fake Articles</p>
            <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#dc2626' }}>{res.author.fakeArticles ?? '0'}</p>
          </div>
        </div>
      </div>
    )}
  </div>
)}


            {/* Navigation */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2rem', gap: '1rem' }}>
              <button
                onClick={prevArticle}
                disabled={currentIndex === 0}
                style={currentIndex === 0 ? disabledButton : navButton}
              >
                ← Previous
              </button>
              <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                {currentIndex + 1} of {articles.length}
              </span>
              <button
                onClick={nextArticle}
                disabled={currentIndex === articles.length - 1}
                style={currentIndex === articles.length - 1 ? disabledButton : navButton}
              >
                Next →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
