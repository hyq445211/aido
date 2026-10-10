import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    // 前端即时校验（服务端仍会再次校验）
    const errs = {};
    if (form.username.trim().length < 3 || form.username.trim().length > 30)
      errs.username = '用户名需为 3-30 位';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errs.email = '邮箱格式不正确';
    if (form.password.length < 8) errs.password = '密码至少 8 位';
    if (form.confirm !== form.password) errs.confirm = '两次输入的密码不一致';
    if (Object.keys(errs).length) {
      setFieldErrors(errs);
      return;
    }

    setLoading(true);
    try {
      await register(form.username.trim(), form.email.trim(), form.password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
      if (err.details) {
        const map = {};
        err.details.forEach((d) => (map[d.field] = d.message));
        setFieldErrors(map);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit} noValidate>
        <div className="auth-logo">AIDO</div>
        <h1>创建账号</h1>
        <p className="auth-subtitle">注册后即可开始提问，历史记录自动保存</p>

        <label className="field">
          <span>用户名</span>
          <input
            type="text"
            value={form.username}
            onChange={update('username')}
            placeholder="3-30 位，支持中英文"
            autoComplete="username"
            required
          />
          {fieldErrors.username && <em className="field-error">{fieldErrors.username}</em>}
        </label>

        <label className="field">
          <span>邮箱</span>
          <input
            type="email"
            value={form.email}
            onChange={update('email')}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
          {fieldErrors.email && <em className="field-error">{fieldErrors.email}</em>}
        </label>

        <label className="field">
          <span>密码</span>
          <input
            type="password"
            value={form.password}
            onChange={update('password')}
            placeholder="至少 8 位"
            autoComplete="new-password"
            required
          />
          {fieldErrors.password && <em className="field-error">{fieldErrors.password}</em>}
        </label>

        <label className="field">
          <span>确认密码</span>
          <input
            type="password"
            value={form.confirm}
            onChange={update('confirm')}
            placeholder="再次输入密码"
            autoComplete="new-password"
            required
          />
          {fieldErrors.confirm && <em className="field-error">{fieldErrors.confirm}</em>}
        </label>

        {error && !Object.keys(fieldErrors).length && <div className="alert">{error}</div>}

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? (
            <>
              <span className="spinner spinner-sm" /> 注册中…
            </>
          ) : (
            '注册'
          )}
        </button>

        <p className="auth-switch">
          已有账号？<Link to="/login">返回登录</Link>
        </p>
      </form>
    </div>
  );
}
