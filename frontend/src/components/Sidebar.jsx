import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

/**
 * 左侧边栏：新建会话、关键词查询入口、会话列表、用户菜单。
 */
export default function Sidebar({
  conversations,
  currentId,
  loadingList,
  onSelect,
  onNew,
  onDelete,
  onOpenSearch,
  searchMode,
  onCloseSidebar,
}) {
  const { user, logout } = useAuth();
  const [confirmId, setConfirmId] = useState(null);

  const handleDelete = async (id) => {
    await onDelete(id);
    setConfirmId(null);
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <span className="brand">AIDO</span>
        <button className="icon-btn sidebar-close" title="收起侧栏" onClick={onCloseSidebar}>
          ✕
        </button>
      </div>

      <button className="btn-new-chat" onClick={onNew}>
        <span className="plus">＋</span> 新建对话
      </button>

      <button className={`btn-search-entry ${searchMode ? 'active' : ''}`} onClick={onOpenSearch}>
        <span>🔍</span> 查询历史问题
      </button>

      <div className="conversation-list">
        {loadingList && <div className="sidebar-hint">加载会话中…</div>}
        {!loadingList && conversations.length === 0 && (
          <div className="sidebar-hint">还没有对话，点击上方按钮开始提问</div>
        )}
        {conversations.map((c) => (
          <div
            key={c.id}
            className={`conv-item ${currentId === c.id ? 'active' : ''}`}
            onClick={() => onSelect(c.id)}
          >
            <span className="conv-title" title={c.title}>
              {c.title}
            </span>
            {confirmId === c.id ? (
              <span className="conv-confirm">
                <button
                  className="link-danger"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(c.id);
                  }}
                >
                  确认删除
                </button>
                <button
                  className="link-muted"
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmId(null);
                  }}
                >
                  取消
                </button>
              </span>
            ) : (
              <button
                className="conv-del"
                title="删除会话"
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmId(c.id);
                }}
              >
                🗑
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="sidebar-user">
        <div className="user-meta">
          <div className="avatar">{(user?.username || '?').slice(0, 1).toUpperCase()}</div>
          <div className="user-name" title={user?.email}>
            {user?.username}
          </div>
        </div>
        <button className="btn-logout" onClick={logout} title="退出登录">
          退出
        </button>
      </div>
    </aside>
  );
}
