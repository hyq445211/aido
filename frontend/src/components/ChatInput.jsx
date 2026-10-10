import { useEffect, useRef, useState } from 'react';

/**
 * 消息输入框：
 * - Enter 发送，Shift+Enter 换行；
 * - 发送中显示“停止”按钮（AbortController 中断流式请求）；
 * - 自动增高 + 字数上限提示。
 */
export default function ChatInput({ onSend, onStop, sending }) {
  const [value, setValue] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [value]);

  const submit = () => {
    const text = value.trim();
    if (!text || sending) return;
    onSend(text);
    setValue('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="chat-input-wrap">
      <div className="chat-input-box">
        <textarea
          ref={ref}
          rows={1}
          value={value}
          onChange={(e) => setValue(e.target.value.slice(0, 8000))}
          onKeyDown={handleKeyDown}
          placeholder="输入你的问题，Enter 发送 / Shift+Enter 换行"
          disabled={sending === 'starting'}
        />
        {sending ? (
          <button className="btn-stop" onClick={onStop} title="停止生成">
            ■ 停止
          </button>
        ) : (
          <button className="btn-send" onClick={submit} disabled={!value.trim()} title="发送">
            发送 ↑
          </button>
        )}
      </div>
      <div className="chat-input-hint">AI 生成内容仅供参考，请核实关键信息</div>
    </div>
  );
}
