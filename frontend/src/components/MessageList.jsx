import { useEffect, useRef } from 'react';

/**
 * 消息列表：用户/AI 气泡、发送状态、流式打字指示、错误提示。
 */
export default function MessageList({ messages }) {
  const bottomRef = useRef(null);

  // 新内容（包括流式增量）时自动滚动到底部
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="empty-chat">
        <div className="empty-logo">AIDO</div>
        <h2>有什么可以帮你的？</h2>
        <p>在下方输入问题开始对话，支持多轮上下文与历史记录查询。</p>
        <div className="suggestions">
          {['用通俗语言解释什么是 Docker', '帮我写一段 SQL 统计每日活跃用户', '如何给团队做一次代码评审？'].map(
            (s) => (
              <div className="suggestion-chip" key={s}>
                {s}
              </div>
            )
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="message-list">
      {messages.map((m) => (
        <div key={m.id} className={`message-row ${m.role}`}>
          <div className="message-avatar">{m.role === 'user' ? '我' : 'AI'}</div>
          <div className="message-body">
            <div className={`bubble status-${m.status || 'done'}`}>
              {m.content}
              {m.status === 'streaming' && <span className="caret" />}
            </div>
            {m.status === 'failed' && <div className="message-error">⚠ {m.error || '发送失败'}</div>}
            {m.status === 'aborted' && <div className="message-aborted">已停止生成</div>}
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
