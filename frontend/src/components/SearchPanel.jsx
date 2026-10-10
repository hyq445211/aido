import { useState } from 'react';
import { api } from '../api/client';

/**
 * 问题查询面板：检索当前用户历史提问（role=user）。
 * 点击命中结果可跳转到对应会话。
 */
export default function SearchPanel({ onClose, onJump }) {
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const doSearch = async (e) => {
    e.preventDefault();
    const q = keyword.trim();
    if (!q) return;
    setLoading(true);
    setError('');
    try {
      const data = await api.searchQuestions(q);
      setResults(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="search-panel">
      <div className="search-header">
        <form className="search-form" onSubmit={doSearch}>
          <input
            type="search"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="输入关键词查询历史问题，回车搜索"
            maxLength={100}
            autoFocus
          />
          <button type="submit" className="btn-primary" disabled={loading || !keyword.trim()}>
            {loading ? '搜索中…' : '搜索'}
          </button>
        </form>
        <button className="icon-btn" onClick={onClose} title="返回会话列表">
          ✕
        </button>
      </div>

      <div className="search-results">
        {error && <div className="alert">{error}</div>}
        {!results && !loading && (
          <div className="sidebar-hint">输入关键词，从全部历史提问中查找</div>
        )}
        {results && results.total === 0 && (
          <div className="sidebar-hint">没有找到包含“{results.query}”的问题</div>
        )}
        {results && results.total > 0 && (
          <>
            <div className="search-count">共找到 {results.total} 条相关问题</div>
            {results.results.map((r) => (
              <button
                key={r.id}
                className="search-item"
                onClick={() => onJump(r.conversationId)}
              >
                <div className="search-item-title" title={r.conversationTitle}>
                  💬 {r.conversationTitle}
                </div>
                <div
                  className="search-item-snippet"
                  dangerouslySetInnerHTML={{
                    __html: highlight(r.snippet, results.query),
                  }}
                />
                <time>{formatTime(r.createdAt)}</time>
              </button>
            ))}
          </>
        )}
      </div>
    </section>
  );
}

function highlight(snippet, keyword) {
  const esc = snippet.replace(/[&<>"]/g, (m) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
  })[m]);
  const safeKw = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return esc.replace(new RegExp(safeKw, 'gi'), (m) => `<mark>${m}</mark>`);
}

function formatTime(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}
