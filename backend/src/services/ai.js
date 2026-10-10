'use strict';

const config = require('../config');

class AiConfigError extends Error {
  constructor(message) {
    super(message);
    this.status = 503;
  }
}

/**
 * 将数据库中的历史消息整理为模型需要的格式。
 * @param {{role:string, content:string}[]} history （含本次用户提问，按时间正序）
 */
function buildMessages(history) {
  const system = {
    role: 'system',
    content:
      '你是 AIDO 智能助手，请用与用户相同的语言（默认中文）简洁、准确地回答问题。',
  };
  return [system, ...history.map((m) => ({ role: m.role, content: m.content }))];
}

/**
 * 演示模式：不调用真实模型，逐块产出一段模拟回复，
 * 便于在没有 API Key 时体验完整的流式交互链路。
 */
async function* mockStream(history) {
  const question = history.length ? history[history.length - 1].content : '';
  const reply =
    `【演示模式】已收到你的问题：“${question.slice(0, 50)}”。\n\n` +
    '当前后端未配置真实 AI 模型密钥（AI_MOCK_MODE=true）。此回复由模拟流式接口生成，' +
    '用于验证从前端流式渲染到数据库持久化的完整链路。\n\n' +
    '配置 AI_BASE_URL 与 AI_API_KEY 后，我将接入真实大模型进行回答。';
  const chunks = reply.match(/[\s\S]{1,6}/g) || [];
  for (const chunk of chunks) {
    await new Promise((r) => setTimeout(r, 30));
    yield chunk;
  }
}

/**
 * 调用 OpenAI 兼容 Chat Completions 接口，以 async generator 形式逐块产出文本。
 * 兼容：OpenAI / DeepSeek / Moonshot / 本地 vLLM / Ollama(/v1) 等。
 *
 * @param {{role:string, content:string}[]} history
 * @param {AbortSignal} [signal]
 */
async function* streamChatCompletion(history, signal) {
  if (config.ai.mockMode) {
    yield* mockStream(history);
    return;
  }
  if (!config.ai.apiKey) {
    throw new AiConfigError(
      'AI 服务未配置：请在后端环境变量中设置 AI_API_KEY，或设置 AI_MOCK_MODE=true 使用演示模式'
    );
  }

  let response;
  try {
    response = await fetch(`${config.ai.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.ai.apiKey}`,
      },
      body: JSON.stringify({
        model: config.ai.model,
        messages: buildMessages(history),
        stream: true,
        temperature: 0.7,
      }),
      signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new Error(`无法连接 AI 服务（${config.ai.baseUrl}）：${err.message}`);
  }

  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => '');
    throw new Error(`AI 服务返回错误 ${response.status}：${text.slice(0, 500)}`);
  }

  // 解析 SSE：事件以 \n\n 分隔，每行形如 `data: {...}`
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const events = buffer.split('\n\n');
      buffer = events.pop() || '';

      for (const evt of events) {
        const line = evt.split('\n').find((l) => l.startsWith('data:'));
        if (!line) continue;
        const data = line.slice(5).trim();
        if (!data || data === '[DONE]') continue;

        try {
          const json = JSON.parse(data);
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) yield delta;
        } catch {
          // 个别服务会推送非 JSON 注释行，忽略即可
        }
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* noop */
    }
  }
}

module.exports = { streamChatCompletion, AiConfigError };
