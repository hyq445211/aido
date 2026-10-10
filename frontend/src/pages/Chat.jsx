import { useCallback, useEffect, useRef, useState } from 'react';
import { api, streamMessage } from '../api/client';
import Sidebar from '../components/Sidebar.jsx';
import SearchPanel from '../components/SearchPanel.jsx';
import MessageList from '../components/MessageList.jsx';
import ChatInput from '../components/ChatInput.jsx';

let tempSeq = 0;
const tempId = (prefix) => `${prefix}-temp-${Date.now()}-${tempSeq++}`;

export default function ChatPage() {
  const [conversations, setConversations] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [currentId, setCurrentId] = useState(null); // null = 尚未落库的新对话
  const [messages, setMessages] = useState([]);
  const [loadingConv, setLoadingConv] = useState(false);
  const [sending, setSending] = useState(false);
  const [searchMode, setSearchMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [banner, setBanner] = useState('');
  const abortRef = useRef(null);

  const loadConversations = useCallback(async () => {
    try {
      const data = await api.listConversations();
      setConversations(data.conversations);
    } catch (err) {
      setBanner(`会话列表加载失败：${err.message}`);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const selectConversation = useCallback(async (id) => {
    if (abortRef.current) abortRef.current.abort();
    setCurrentId(id);
    setSearchMode(false);
    setSidebarOpen(false);
    setMessages([]);
    setLoadingConv(true);
    setBanner('');
    try {
      const data = await api.getConversation(id);
      setMessages(
        data.messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          status: 'done',
        }))
      );
    } catch (err) {
      setBanner(`历史记录加载失败：${err.message}`);
    } finally {
      setLoadingConv(false);
    }
  }, []);

  const startNewChat = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    setCurrentId(null);
    setMessages([]);
    setSearchMode(false);
    setSidebarOpen(false);
    setBanner('');
  }, []);

  const deleteConversation = useCallback(
    async (id) => {
      try {
        await api.deleteConversation(id);
        if (id === currentId) startNewChat();
        await loadConversations();
      } catch (err) {
        setBanner(`删除失败：${err.message}`);
      }
    },
    [currentId, startNewChat, loadConversations]
  );

  /** 发送消息：乐观插入用户气泡 + AI 占位气泡，随后流式回填 */
  const handleSend = useCallback(
    async (content) => {
      let convId = currentId;
      setSending(true);
      setBanner('');

      // 第一条消息时先创建会话
      if (!convId) {
        try {
          const { conversation } = await api.createConversation();
          convId = conversation.id;
          setCurrentId(convId);
        } catch (err) {
          setBanner(`创建会话失败：${err.message}`);
          setSending(false);
          return;
        }
      }

      const userMsgId = tempId('u');
      const aiMsgId = tempId('a');
      setMessages((prev) => [
        ...prev,
        { id: userMsgId, role: 'user', content, status: 'sending' },
        { id: aiMsgId, role: 'assistant', content: '', status: 'streaming' },
      ]);

      const controller = new AbortController();
      abortRef.current = controller;

      const patch = (id, patchObj) =>
        setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patchObj } : m)));
      const replaceId = (oldId, newId) =>
        setMessages((prev) => prev.map((m) => (m.id === oldId ? { ...m, id: newId } : m)));

      try {
        const done = await streamMessage(convId, content, {
          signal: controller.signal,
          onMeta: (meta) => {
            patch(userMsgId, { status: 'done' });
            if (meta.userMessageId) replaceId(userMsgId, meta.userMessageId);
          },
          onDelta: (text) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === aiMsgId ? { ...m, content: m.content + text, status: 'streaming' } : m
              )
            );
          },
        });
        patch(aiMsgId, { status: 'done' });
        if (done?.assistantMessageId) replaceId(aiMsgId, done.assistantMessageId);
      } catch (err) {
        if (err.name === 'AbortError') {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiMsgId
                ? { ...m, status: 'aborted', content: m.content || '（已停止生成）' }
                : m
            )
          );
        } else {
          patch(userMsgId, { status: 'failed' });
          patch(aiMsgId, {
            status: 'failed',
            error: err.message,
            content: '',
          });
        }
      } finally {
        abortRef.current = null;
        setSending(false);
        await loadConversations(); // 刷新会话标题/排序
      }
    },
    [currentId, loadConversations]
  );

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const jumpToConversation = useCallback(
    (id) => {
      selectConversation(id);
    },
    [selectConversation]
  );

  const currentTitle =
    conversations.find((c) => c.id === currentId)?.title || (currentId ? '对话' : '新对话');

  return (
    <div className={`app-shell ${sidebarOpen ? 'sidebar-open' : ''}`}>
      <Sidebar
        conversations={conversations}
        currentId={currentId}
        loadingList={loadingList}
        onSelect={selectConversation}
        onNew={startNewChat}
        onDelete={deleteConversation}
        onOpenSearch={() => {
          setSearchMode(true);
          setSidebarOpen(true);
        }}
        searchMode={searchMode}
        onCloseSidebar={() => setSidebarOpen(false)}
      />

      <main className="chat-main">
        <header className="chat-header">
          <button
            className="icon-btn menu-btn"
            title="打开侧栏"
            onClick={() => setSidebarOpen(true)}
          >
            ☰
          </button>
          <h1 className="chat-title">{currentTitle}</h1>
        </header>

        {banner && (
          <div className="banner">
            {banner}
            <button className="icon-btn" onClick={() => setBanner('')} title="关闭">
              ✕
            </button>
          </div>
        )}

        {searchMode ? (
          <SearchPanel onClose={() => setSearchMode(false)} onJump={jumpToConversation} />
        ) : (
          <>
            <div className="chat-content">
              {loadingConv ? (
                <div className="fullscreen-loading">
                  <div className="spinner" />
                  <p>正在加载历史消息…</p>
                </div>
              ) : (
                <MessageList messages={messages} />
              )}
            </div>
            <ChatInput onSend={handleSend} onStop={handleStop} sending={sending} />
          </>
        )}
      </main>
    </div>
  );
}
