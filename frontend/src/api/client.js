/**
 * API 客户端：
 * - 普通 JSON 接口封装在 api 对象中；
 * - 流式对话使用 streamMessage，手动解析 SSE。
 */

export const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';
const TOKEN_KEY = 'aido_token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function request(path, { method = 'GET', body, signal } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  });

  if (res.status === 204) return null;

  let data = null;
  try {
    data = await res.json();
  } catch {
    /* 非 JSON 响应 */
  }

  if (!res.ok) {
    if (res.status === 401) tokenStore.clear();
    throw new ApiError(data?.error || `请求失败（${res.status}）`, res.status, data?.details);
  }
  return data;
}

export const api = {
  register: (payload) => request('/auth/register', { method: 'POST', body: payload }),
  login: (payload) => request('/auth/login', { method: 'POST', body: payload }),
  me: () => request('/auth/me'),

  listConversations: () => request('/conversations'),
  createConversation: (title) => request('/conversations', { method: 'POST', body: { title } }),
  getConversation: (id) => request(`/conversations/${id}`),
  renameConversation: (id, title) =>
    request(`/conversations/${id}`, { method: 'PATCH', body: { title } }),
  deleteConversation: (id) => request(`/conversations/${id}`, { method: 'DELETE' }),

  searchQuestions: (q, page = 1) =>
    request(`/search?q=${encodeURIComponent(q)}&page=${page}&pageSize=20`),
};

/**
 * 发送消息并流式接收回复。
 *
 * @param {number} conversationId
 * @param {string} content
 * @param {{onMeta?:(d:object)=>void, onDelta?:(text:string)=>void, signal?:AbortSignal}} handlers
 */
export async function streamMessage(conversationId, content, handlers = {}) {
  const { onMeta, onDelta, signal } = handlers;

  const res = await fetch(`${API_BASE}/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenStore.get() || ''}`,
    },
    body: JSON.stringify({ content }),
    signal,
  });

  if (!res.ok) {
    let data = {};
    try {
      data = await res.json();
    } catch {
      /* ignore */
    }
    if (res.status === 401) tokenStore.clear();
    throw new ApiError(data.error || `请求失败（${res.status}）`, res.status);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  const handleEvent = (eventBlock) => {
    let event = 'message';
    const dataLines = [];
    for (const line of eventBlock.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
    }
    if (!dataLines.length) return;
    const payload = JSON.parse(dataLines.join('\n'));

    if (event === 'meta') onMeta?.(payload);
    else if (event === 'delta') onDelta?.(payload.content || '');
    else if (event === 'error') throw new ApiError(payload.error || 'AI 服务返回错误', 502);
    // done 事件由返回值处理
    return event === 'done' ? payload : null;
  };

  let donePayload = null;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const blocks = buffer.split('\n\n');
    buffer = blocks.pop() || '';
    for (const block of blocks) {
      const result = handleEvent(block.trim());
      if (result) donePayload = result;
    }
  }
  // 处理缓冲区中可能剩余的最后一个事件
  if (buffer.trim()) {
    const result = handleEvent(buffer.trim());
    if (result) donePayload = result;
  }

  return donePayload;
}
