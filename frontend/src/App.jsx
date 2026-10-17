import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, ArrowRight, ArrowUpFromLine, CheckCircle2, Clock3, Code2, Database, History, Info, LogOut, MessageSquare, Plus, Search, Settings2, Users, X } from 'lucide-react';
import { Avatar, AvatarFallback } from './components/ui/avatar.jsx';
import { Badge } from './components/ui/badge.jsx';
import { Button } from './components/ui/button.jsx';
import { Card } from './components/ui/card.jsx';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './components/ui/dialog.jsx';
import { Input } from './components/ui/input.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs.jsx';
import { Textarea } from './components/ui/textarea.jsx';
import { cn } from './lib/utils.js';

const API_ROOT = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/$/, '');
const tokenKey = 'api-portal-access-token';

// Thông báo lỗi dễ hiểu theo mã trạng thái khi máy chủ không gửi kèm nội dung
const STATUS_TEXT = {
  401: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
  403: 'Bạn không có quyền thực hiện thao tác này.',
  404: 'Không tìm thấy dữ liệu. Có thể dữ liệu đã bị xóa.',
  409: 'Dữ liệu vừa được người khác thay đổi. Hãy tải lại rồi thử lại.',
  413: 'Nội dung gửi lên quá lớn.',
  429: 'Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.',
};
const FIELD_LABELS = { email: 'Email', password: 'Mật khẩu', name: 'Họ và tên', description: 'Mô tả', content: 'Nội dung', commitMessage: 'Ghi chú thay đổi', role: 'Vai trò', spec: 'Nội dung API', anchor: 'Vị trí', resolved: 'Trạng thái' };
const RULE_TEXT = [
  [/^Required$/i, () => 'không được để trống'],
  [/^Invalid email/i, () => 'chưa đúng định dạng'],
  [/at least (\d+) character/i, (m) => `cần tối thiểu ${m[1]} ký tự`],
  [/at most (\d+) character/i, (m) => `chỉ được tối đa ${m[1]} ký tự`],
  [/^Invalid/i, () => 'không hợp lệ'],
];
function describeIssue({ path, message = '' }) {
  for (const [pattern, text] of RULE_TEXT) {
    const match = message.match(pattern);
    if (match) return `${FIELD_LABELS[path] || path || 'Dữ liệu'} ${text(match)}`;
  }
  return message;
}
function describeError(status, payload, hadToken) {
  if (status === 401 && hadToken) return STATUS_TEXT[401];
  const error = payload?.error;
  if (Array.isArray(error?.details) && error.details.length) {
    return `${error.message || 'Dữ liệu không hợp lệ'}: ${error.details.map(describeIssue).join('; ')}`;
  }
  if (error?.code === 'TOO_MANY_REQUESTS') return STATUS_TEXT[429];
  return error?.message || STATUS_TEXT[status] || (status >= 500 ? 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau.' : `Yêu cầu không thành công (mã ${status}).`);
}

async function request(path, { method = 'GET', body, token = localStorage.getItem(tokenKey), includeMeta = false } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${API_ROOT}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error('Không thể kết nối tới máy chủ. Hãy kiểm tra kết nối mạng hoặc xem backend đã chạy chưa.');
  }

  const payload = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && token) {
      localStorage.removeItem(tokenKey);
      window.dispatchEvent(new Event('api-portal-unauthorized'));
    }
    throw new Error(describeError(response.status, payload, Boolean(token)));
  }
  return includeMeta ? payload : payload?.data;
}

const url = (projectId, suffix = '') => `/projects/${projectId}${suffix}`;
const apiUrl = (projectId, apiId, suffix = '') => url(projectId, `/apis/${apiId}${suffix}`);
const pretty = (value) => JSON.stringify(value ?? {}, null, 2);
const dateTime = (value) => value ? new Date(value).toLocaleString('vi-VN') : '—';
const roleName = (role) => role === 'MANAGER' ? 'Quản lý' : 'Nhà phát triển';
const methodClass = (method) => `method method-${String(method || '').toLowerCase()}`;
const initials = (name = '') => name.trim().split(/\s+/).slice(-2).map((part) => part[0]).join('').toUpperCase() || '?';
const ACTION_LABELS = { IMPORT: 'Nhập tài liệu', UPDATE: 'Chỉnh sửa', RESTORE: 'Khôi phục' };
const DIFF_LABELS = { add: 'Thêm', remove: 'Xóa', replace: 'Sửa' };

function SwaggerApiViewer({ document, token }) {
  const containerRef = useRef(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    let ui;
    setError('');

    Promise.all([
      import('swagger-ui-dist/swagger-ui-es-bundle.js'),
      import('swagger-ui-dist/swagger-ui.css'),
    ]).then(([module]) => {
      if (!active || !containerRef.current) return;
      const SwaggerUIBundle = module.default;
      ui = SwaggerUIBundle({
        spec: document,
        domNode: containerRef.current,
        deepLinking: false,
        docExpansion: 'full',
        defaultModelsExpandDepth: -1,
        displayOperationId: false,
        // supportedSubmitMethods: [],
        tryItOutEnabled: true,
        supportedSubmitMethods: ['get', 'post', 'put', 'delete', 'patch', 'head', 'options', 'trace'], // Bật các HTTP method
        requestInterceptor: (req) => {
          const authToken = token || localStorage.getItem(tokenKey);
          if (authToken) {
            req.headers.Authorization = `Bearer ${authToken}`;
          }
          return req;
        },
        presets: [SwaggerUIBundle.presets.apis],
        layout: 'BaseLayout',
      });
    }).catch((err) => {
      if (active) setError(`Không thể tải tài liệu Swagger: ${err.message}`);
    });

    return () => {
      active = false;
      ui?.destroy?.();
      if (containerRef.current) containerRef.current.replaceChildren();
    };
  }, [document,token]);

  if (error) return <p className="swagger-error" role="alert">{error}</p>;
  return <div className="swagger-ui-shell"><div ref={containerRef} /></div>;
}

function toOpenApiDocument(api) {
  const spec = api.spec && typeof api.spec === 'object' ? api.spec : {};
  const parameters = Array.isArray(spec.parameters) ? spec.parameters : [];
  const bodyParameters = parameters.filter((parameter) => parameter.in === 'body');
  const formParameters = parameters.filter((parameter) => parameter.in === 'formData');
  const normalizedParameters = parameters
    .filter((parameter) => parameter.in !== 'body' && parameter.in !== 'formData')
    .map((parameter) => {
      if (parameter.schema) return parameter;
      const { type, format, items, collectionFormat, ...rest } = parameter;
      const schema = type === 'file'
        ? { type: 'string', format: 'binary' }
        : { type, format, items };
      return { ...rest, schema: { ...schema, ...(collectionFormat && { style: 'form', explode: collectionFormat === 'multi' }) } };
    });

  let requestBody = spec.requestBody;
  if (!requestBody && bodyParameters.length) {
    requestBody = {
      required: bodyParameters[0].required,
      description: bodyParameters[0].description,
      content: Object.fromEntries((spec.consumes?.length ? spec.consumes : ['application/json'])
        .map((contentType) => [contentType, { schema: bodyParameters[0].schema || {} }])),
    };
  } else if (!requestBody && formParameters.length) {
    const properties = Object.fromEntries(formParameters.map((parameter) => {
      const { type, format, items, ...rest } = parameter;
      return [parameter.name, type === 'file'
        ? { ...rest, type: 'string', format: 'binary' }
        : { ...rest, type, format, items }];
    }));
    const schema = {
      type: 'object',
      properties,
      required: formParameters.filter((parameter) => parameter.required).map((parameter) => parameter.name),
    };
    const isMultipart = formParameters.some((parameter) => parameter.type === 'file');
    requestBody = {
      required: schema.required.length > 0,
      content: { [isMultipart ? 'multipart/form-data' : 'application/x-www-form-urlencoded']: { schema } },
    };
  }

  const responses = Object.fromEntries(Object.entries(spec.responses || {}).map(([status, response]) => {
    if (!response?.schema || response.content) return [status, response];
    const contentTypes = spec.produces?.length ? spec.produces : ['application/json'];
    return [status, {
      ...response,
      content: Object.fromEntries(contentTypes.map((contentType) => [contentType, { schema: response.schema }])),
    }];
  }));
  const operation = { ...spec, tags: spec.tags?.length ? spec.tags : api.tags, parameters: normalizedParameters, responses };
  delete operation.consumes;
  delete operation.produces;
  if (requestBody) operation.requestBody = requestBody;

  return {
    openapi: '3.0.3',
    info: { title: api.summary || `${api.method} ${api.endpoint}`, version: `v${api.version}` },
    servers: spec.servers?.length ? spec.servers : [{ url: API_ROOT }],
    // ...(spec.servers && { servers: spec.servers }),
    paths: { [api.endpoint]: { [String(api.method).toLowerCase()]: operation } },
  };
}

let toastSeq = 0;
const TOAST_ICONS = { success: CheckCircle2, error: AlertCircle, info: Info };
const TOAST_TIMEOUT = { success: 4000, info: 5000, error: 9000 };

function ToastItem({ toast, onDismiss }) {
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return undefined;
    const timer = window.setTimeout(() => onDismiss(toast.id), TOAST_TIMEOUT[toast.type]);
    return () => window.clearTimeout(timer);
  }, [paused, toast.id, toast.type, onDismiss]);
  const Icon = TOAST_ICONS[toast.type] || Info;
  return <div className={`snack snack-${toast.type}`} role={toast.type === 'error' ? 'alert' : 'status'} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
    <Icon className="snack-icon h-4 w-4" aria-hidden="true" />
    <p>{toast.message}</p>
    <button type="button" className="snack-close" aria-label="Đóng thông báo" onClick={() => onDismiss(toast.id)}><X className="h-4 w-4" /></button>
  </div>;
}

function ToastStack({ toasts, onDismiss }) {
  return <div className="snack-stack" aria-live="polite">{toasts.map((toast) => <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />)}</div>;
}

// Hộp xác nhận thay cho window.confirm: await confirmAction({ title, message, confirmLabel, danger })
let openConfirm = null;
const confirmAction = (options) => new Promise((resolve) => {
  if (openConfirm) openConfirm(options, resolve);
  else resolve(window.confirm(`${options.title}\n${options.message}`));
});

function ConfirmHost() {
  const [pending, setPending] = useState(null);
  useEffect(() => {
    openConfirm = (options, resolve) => setPending({ options, resolve });
    return () => { openConfirm = null; };
  }, []);
  if (!pending) return null;
  const { title, message, confirmLabel = 'Xác nhận', danger = false } = pending.options;
  const close = (result) => { pending.resolve(result); setPending(null); };
  return <Modal title={title} subtitle={message} onClose={() => close(false)}>
    <div className="modal-actions">
      <Button type="button" variant="ghost" className="button button-quiet" onClick={() => close(false)}>Hủy</Button>
      <Button type="button" className={`button ${danger ? 'button-danger' : 'button-primary'}`} onClick={() => close(true)}>{confirmLabel}</Button>
    </div>
  </Modal>;
}

function App() {
  const [token, setToken] = useState(() => localStorage.getItem(tokenKey));
  const [user, setUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [project, setProject] = useState(null);
  const [apis, setApis] = useState([]);
  const [api, setApi] = useState(null);
  const [activeView, setActiveView] = useState('apis');
  const [query, setQuery] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ page: 1, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState('');
  const [toasts, setToasts] = useState([]);

  const dismissToast = useCallback((id) => setToasts((items) => items.filter((item) => item.id !== id)), []);
  // notify(message) = thành công; notify(message, 'error' | 'info') cho loại khác. Cùng nội dung sẽ không hiện lặp.
  const notify = useCallback((message, type = 'success') => {
    setToasts((items) => [...items.filter((item) => item.message !== message).slice(-3), { id: ++toastSeq, message, type }]);
  }, []);
  const setError = useCallback((message) => { if (message) notify(message, 'error'); }, [notify]);

  const signOut = useCallback(() => {
    localStorage.removeItem(tokenKey);
    setToken(null);
    setUser(null);
    setProject(null);
    setProjects([]);
    setApi(null);
    setApis([]);
  }, []);

  useEffect(() => {
    const onUnauthorized = () => signOut();
    window.addEventListener('api-portal-unauthorized', onUnauthorized);
    return () => window.removeEventListener('api-portal-unauthorized', onUnauthorized);
  }, [signOut]);

  const loadProjects = useCallback(async () => {
    const [me, items] = await Promise.all([request('/users/me'), request('/users/me/projects')]);
    setUser(me);
    setProjects(items);
    setProject((selected) => items.find((item) => item.id === selected?.id) || items[0] || null);
  }, []);

  useEffect(() => {
    if (!token) return;
    loadProjects().catch((err) => {
      setError(err.message);
      signOut();
    });
  }, [token, loadProjects, signOut]);

  const loadApis = useCallback(async () => {
    if (!project) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (query.trim()) params.set('q', query.trim());
      if (methodFilter) params.set('method', methodFilter);
      const result = await request(url(project.id, `/apis?${params}`), { includeMeta: true });
      setApis(result.data);
      setMeta(result.meta);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [project, page, query, methodFilter, token]);

  useEffect(() => {
    if (token && project && activeView === 'apis') loadApis();
  }, [token, project, activeView, loadApis]);

  const openApi = async (item) => {
    const result = await handleAction(() => request(apiUrl(project.id, item.id)), null, false);
    if (result) setApi(result);
  };

  const selectProject = (item) => {
    setProject(item);
    setApi(null);
    setActiveView('apis');
    setPage(1);
  };

  const handleAction = async (action, successMessage, refresh = true) => {
    setError('');
    try {
      const value = await action();
      if (refresh) {
        await loadProjects();
        if (project) await loadApis();
      }
      if (successMessage) notify(successMessage);
      return value;
    } catch (err) {
      setError(err.message);
      return null;
    }
  };

  if (!token) {
    return <>
      <AuthScreen onAuthenticated={(data) => {
        localStorage.setItem(tokenKey, data.accessToken);
        setToken(data.accessToken);
        setUser(data.user);
        notify('Đăng nhập thành công');
      }} />
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </>;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" onClick={(event) => event.preventDefault()}>
          <span className="brand-mark">A</span>
          <span>api<span className="brand-light">portal</span></span>
        </a>
        <div className="sidebar-caption">Không gian làm việc</div>
        <div className="project-switcher">
          <span className="project-icon">{initials(project?.name || 'AP')}</span>
          <Select value={project?.id || ''} onValueChange={(id) => selectProject(projects.find((item) => item.id === id))}>
            <SelectTrigger className="project-select-trigger" aria-label="Chọn dự án"><SelectValue placeholder="Chưa có dự án" /></SelectTrigger>
            <SelectContent>{projects.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="ghost" size="icon" className="icon-button small" title="Tạo dự án mới" aria-label="Tạo dự án mới" onClick={() => setModal('project-create')}><Plus className="h-4 w-4" /></Button>
        </div>

        {project && <>
          <div className="sidebar-caption nav-caption">Dự án</div>
          <nav className="side-nav">
            <button className={activeView === 'apis' ? 'selected' : ''} onClick={() => { setActiveView('apis'); setApi(null); }}>
              <Code2 className="nav-symbol" aria-hidden="true" /> Danh sách API <span className="nav-count">{meta.total || apis.length}</span>
            </button>
            <button className={activeView === 'members' ? 'selected' : ''} onClick={() => { setActiveView('members'); setApi(null); }}>
              <Users className="nav-symbol" aria-hidden="true" /> Thành viên
            </button>
          </nav>
          <div className="sidebar-project-info">
            <span className="sidebar-info-label">Vai trò của bạn</span>
            <strong>{roleName(project.role)}</strong>
          </div>
        </>}

        <div className="sidebar-bottom">
          <div className="user-card">
            <Avatar className="avatar"><AvatarFallback>{initials(user?.name)}</AvatarFallback></Avatar>
            <span className="user-text"><strong>{user?.name || 'Tài khoản'}</strong><small>{user?.email}</small></span>
            <Button variant="ghost" size="icon" className="icon-button small" title="Đăng xuất" aria-label="Đăng xuất" onClick={signOut}><LogOut className="h-4 w-4" /></Button>
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumbs"><span>Dự án</span><b>/</b><strong>{project?.name || 'Chọn dự án'}</strong></div>
          <div className="top-actions">
            {project?.role === 'MANAGER' && <Button variant="ghost" className="button button-quiet" onClick={() => setModal('project-settings')}><Settings2 className="h-4 w-4" /><span>Cài đặt dự án</span></Button>}
            <Avatar className="avatar avatar-small"><AvatarFallback>{initials(user?.name)}</AvatarFallback></Avatar>
          </div>
        </header>

        

        {!project ? <EmptyProjects onCreate={() => setModal('project-create')} /> : activeView === 'members'
          ? <MembersView project={project} onError={setError} notify={notify} />
          : api
            ? <ApiDetails
                project={project}
                api={api}
                user={user}
                onBack={() => setApi(null)}
                onError={setError}
                notify={notify}
                onApiUpdated={(updated) => { setApi(updated); loadApis(); }}
              />
            : <section className="content">
                <div className="page-heading">
                  <div>
                    
                    <h1>{project.name}</h1>
                    <p>{project.description || 'Quản lý tài liệu, phiên bản và trao đổi về API trong một nơi.'}</p>
                  </div>
                  <div className="heading-actions">
                    {project.role === 'MANAGER' && <Button className="button button-primary" onClick={() => setModal('import')}><ArrowUpFromLine className="h-4 w-4" /><span>Nhập tài liệu OpenAPI</span></Button>}
                  </div>
                </div>

                <div className="stats-row">
                  <Card className="stat-card"><span>Số lượng API</span><strong>{meta.total ?? apis.length}</strong><small>Trong dự án này</small></Card>
                  <Card className="stat-card"><span>Vai trò của bạn</span><strong className="stat-role">{roleName(project.role)}</strong><small>Quyền truy cập dự án</small></Card>
                  <Card className="stat-card"><span>Trang hiện tại</span><strong>{meta.page || page} <small>/ {meta.totalPages || 1}</small></strong><small>Danh sách phân trang</small></Card>
                </div>

                <div className="section-heading">
                  <div><h2>Danh sách API</h2><p>Các API thuộc dự án này</p></div>
                </div>
                <div className="toolbar">
                  <label className="search-box"><Search className="h-4 w-4" /><Input value={query} aria-label="Tìm API" placeholder="Tìm theo đường dẫn hoặc mô tả..." onChange={(event) => { setPage(1); setQuery(event.target.value); }} /></label>
                  <Select value={methodFilter || 'all'} onValueChange={(value) => { setPage(1); setMethodFilter(value === 'all' ? '' : value); }}>
                    <SelectTrigger className="filter-select" aria-label="Lọc theo phương thức"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="all">Tất cả phương thức</SelectItem>{['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'TRACE'].map((method) => <SelectItem key={method} value={method}>{method}</SelectItem>)}</SelectContent>
                  </Select>
                  <span className="result-count">{meta.total ?? apis.length} kết quả</span>
                </div>
                <div className="api-table-wrap">
                  <table className="api-table">
                    <thead><tr><th>Phương thức</th><th>Đường dẫn</th><th>Mô tả</th><th>Nhãn</th><th>Phiên bản</th><th><span className="sr-only">Mở chi tiết</span></th></tr></thead>
                    <tbody>
                      {loading ? <tr><td colSpan="6" className="table-empty">Đang tải danh sách...</td></tr>
                        : apis.length ? apis.map((item) => <tr key={item.id} className="api-row" tabIndex={0} onClick={() => openApi(item)} onKeyDown={(event) => { if (event.key === 'Enter') openApi(item); }}>
                          <td><span className={methodClass(item.method)}>{item.method}</span></td>
                          <td><code className="endpoint">{item.endpoint}</code>{item.deprecated && <span className="deprecated-pill">Sắp ngừng hỗ trợ</span>}</td>
                          <td className="summary-cell">{item.summary || <span className="muted">Chưa có mô tả</span>}</td>
                          <td><div className="tag-list">{(item.tags || []).slice(0, 2).map((tag) => <span className="tag" key={tag}>{tag}</span>)}</div></td>
                          <td><Badge variant="outline" className="version-pill">v{item.version}</Badge></td>
                          <td className="row-arrow"><ArrowRight className="h-4 w-4" aria-hidden="true" /></td>
                        </tr>) : <tr><td colSpan="6" className="table-empty"><div className="empty-icon"><Database className="h-5 w-5" aria-hidden="true" /></div><strong>Chưa có API nào</strong><span>{project.role === 'MANAGER' ? 'Nhập tài liệu OpenAPI để thêm API đầu tiên vào dự án.' : 'Quản lý dự án chưa nhập tài liệu API nào.'}</span>{project.role === 'MANAGER' && <Button className="button button-primary" onClick={() => setModal('import')}>Nhập tài liệu OpenAPI</Button>}</td></tr>}
                    </tbody>
                  </table>
                  <div className="table-footer"><span>Hiển thị {apis.length} / {meta.total ?? apis.length} API</span><div className="pagination"><button disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Trang trước</button><span>{page} / {meta.totalPages || 1}</span><button disabled={page >= (meta.totalPages || 1)} onClick={() => setPage((value) => value + 1)}>Trang sau</button></div></div>
                </div>
              </section>}
      </main>

      {modal === 'project-create' && <ProjectModal onClose={() => setModal('')} onSubmit={async (body) => {
        const created = await handleAction(() => request('/projects', { method: 'POST', body }), 'Đã tạo dự án');
        if (created) { await loadProjects(); setProject(created); setModal(''); }
      }} />}
      {modal === 'project-settings' && project && <ProjectSettings project={project} onClose={() => setModal('')} onSubmit={async (body) => {
        const updated = await handleAction(() => request(url(project.id), { method: 'PATCH', body }), 'Đã cập nhật dự án');
        if (updated) { await loadProjects(); setModal(''); }
      }} onDelete={async () => {
        const confirmed = await confirmAction({ title: `Xóa dự án "${project.name}"?`, message: 'Toàn bộ API, lịch sử thay đổi, bình luận và thành viên của dự án sẽ bị xóa vĩnh viễn. Không thể hoàn tác.', confirmLabel: 'Xóa dự án', danger: true });
        if (!confirmed) return;
        await handleAction(() => request(url(project.id), { method: 'DELETE' }), 'Đã xóa dự án');
        setModal('');
      }} />}
      {modal === 'import' && project && <ImportModal project={project} onClose={() => setModal('')} onImported={async (summary) => {
        setModal('');
        await loadApis();
        notify(`Nhập tài liệu hoàn tất: ${summary.created} mới, ${summary.updated} cập nhật, ${summary.unchanged} giữ nguyên`);
      }} onError={setError} />}
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
      <ConfirmHost />
    </div>
  );
}

function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const data = await request(`/auth/${mode === 'login' ? 'login' : 'register'}`, {
        method: 'POST',
        body: mode === 'login' ? { email, password } : { name, email, password },
        token: null,
      });
      onAuthenticated(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return <div className="auth-shell">
    <div className="auth-brand"><span className="brand-mark">A</span><span>api<span className="brand-light">portal</span></span></div>
    <Card className="auth-card flex flex-col">
      <h1 className='flex items-center justify-center'>{mode === 'login' ? 'Chào mừng trở lại' : 'Tạo tài khoản'}</h1>
      {/* <p className="text-center">{mode === 'login' ? 'Đăng nhập để tiếp tục đến workspace của bạn.' : 'Đăng ký để bắt đầu quản lý API cùng nhóm.'}</p> */}
      <form onSubmit={submit}>
        {mode === 'register' && <label>Họ và tên<Input required maxLength="100" value={name} onChange={(event) => setName(event.target.value)} placeholder="Nguyễn Văn A" /></label>}
        <label>Email<Input type="email" required maxLength="254" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="ban@congty.com" /></label>
        <label>Mật khẩu<Input type="password" required minLength={mode === 'register' ? 8 : 1} maxLength="72" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" />{mode === 'register' && <small className="field-hint">Tối thiểu 8 ký tự.</small>}</label>
        {error && <div className="form-error" role="alert">{error}</div>}
        <Button className="button button-primary button-wide" disabled={busy}>{busy ? 'Đang xử lý...' : mode === 'login' ? <>Đăng nhập <ArrowRight className="h-4 w-4" /></> : <>Tạo tài khoản <ArrowRight className="h-4 w-4" /></>}</Button>
      </form>
      <div className="auth-switch">{mode === 'login' ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'} <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>{mode === 'login' ? 'Đăng ký' : 'Đăng nhập'}</button></div>
    </Card>
    <div className="auth-footer">API Portal · Quản lý tài liệu API cùng nhóm của bạn</div>
  </div>;
}

function EmptyProjects({ onCreate }) {
  return <div className="content empty-project"><div className="empty-icon"><Database className="h-5 w-5" /></div><h2>Chào mừng đến API Portal</h2><p>Bạn chưa tham gia dự án nào. Hãy tạo dự án đầu tiên để bắt đầu quản lý API.</p><Button className="button button-primary" onClick={onCreate}><Plus className="h-4 w-4" /> Tạo dự án</Button></div>;
}

function ProjectModal({ onClose, onSubmit }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  return <Modal title="Tạo dự án mới" onClose={onClose}>
    <form onSubmit={async (event) => { event.preventDefault(); setBusy(true); await onSubmit({ name, description }); setBusy(false); }}>
      <label>Tên dự án<Input required maxLength="120" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ví dụ: Nền tảng thanh toán" /></label>
      <label>Mô tả<Textarea maxLength="1000" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Mục đích của dự án..." rows="3" /></label>
      <div className="modal-actions"><Button type="button" variant="ghost" className="button button-quiet" onClick={onClose}>Hủy</Button><Button className="button button-primary" disabled={busy}>{busy ? 'Đang tạo...' : 'Tạo dự án'}</Button></div>
    </form>
  </Modal>;
}

function ProjectSettings({ project, onClose, onSubmit, onDelete }) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description || '');
  return <Modal title="Cài đặt dự án" onClose={onClose}>
    <form onSubmit={async (event) => { event.preventDefault(); await onSubmit({ name, description }); }}>
      <label>Tên dự án<Input required maxLength="120" value={name} onChange={(event) => setName(event.target.value)} /></label>
      <label>Mô tả<Textarea maxLength="1000" value={description} onChange={(event) => setDescription(event.target.value)} rows="3" /></label>
      <div className="modal-actions modal-split"><Button type="button" variant="outline" className="button button-danger-quiet" onClick={onDelete}>Xóa dự án</Button><div><Button type="button" variant="ghost" className="button button-quiet" onClick={onClose}>Hủy</Button><Button className="button button-primary">Lưu thay đổi</Button></div></div>
    </form>
  </Modal>;
}

function ImportModal({ project, onClose, onImported, onError }) {
  const [content, setContent] = useState('');
  const [commitMessage, setCommitMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const fileChanged = async (event) => {
    const file = event.target.files?.[0];
    if (file) setContent(await file.text());
  };
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      const summary = await request(url(project.id, '/apis/import'), {
        method: 'POST',
        body: { content, ...(commitMessage.trim() && { commitMessage: commitMessage.trim() }) },
      });
      await onImported(summary);
    } catch (err) {
      onError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return <Modal title="Nhập tài liệu OpenAPI" subtitle="Thêm hoặc đồng bộ API từ tài liệu OpenAPI (Swagger)." onClose={onClose} wide>
    <form onSubmit={submit}>
      <label>Chọn tệp JSON hoặc YAML<Input type="file" accept=".json,.yaml,.yml,application/json,text/yaml" onChange={fileChanged} /></label>
      <label>Hoặc dán nội dung OpenAPI<Textarea required rows="12" className="code-input" value={content} onChange={(event) => setContent(event.target.value)} placeholder={'openapi: 3.0.3\ninfo:\n  title: API của tôi\n  version: 1.0.0\npaths: {}'} /></label>
      <label>Ghi chú thay đổi (không bắt buộc)<Input maxLength="500" value={commitMessage} onChange={(event) => setCommitMessage(event.target.value)} placeholder="Ví dụ: Cập nhật tài liệu phiên bản 2" /></label>
      <div className="modal-note">Tối đa 1.000 API mỗi lần nhập. API trùng phương thức và đường dẫn sẽ được so sánh, chỉ cập nhật khi nội dung thay đổi.</div>
      <div className="modal-actions"><Button type="button" variant="ghost" className="button button-quiet" onClick={onClose}>Hủy</Button><Button className="button button-primary" disabled={busy || !content.trim()}>{busy ? 'Đang nhập...' : 'Nhập tài liệu'}</Button></div>
    </form>
  </Modal>;
}

function MembersView({ project, onError, notify }) {
  const [members, setMembers] = useState([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('DEVELOPER');
  const [busy, setBusy] = useState(false);
  const manager = project.role === 'MANAGER';
  const load = useCallback(async () => {
    if (!manager) return;
    try { setMembers(await request(url(project.id, '/members'))); } catch (err) { onError(err.message); }
  }, [project.id, manager, onError]);
  useEffect(() => { load(); }, [load]);

  const addMember = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await request(url(project.id, '/members'), { method: 'POST', body: { email, role } });
      setEmail('');
      await load();
      notify('Đã thêm thành viên');
    } catch (err) { onError(err.message); }
    finally { setBusy(false); }
  };
  const changeRole = async (member, nextRole) => {
    try { await request(url(project.id, `/members/${member.user.id}`), { method: 'PATCH', body: { role: nextRole } }); await load(); notify(`Đã đổi vai trò của ${member.user.name} thành ${roleName(nextRole)}`); }
    catch (err) { onError(err.message); }
  };
  const remove = async (member) => {
    const confirmed = await confirmAction({ title: `Xóa ${member.user.name} khỏi dự án?`, message: 'Người này sẽ không còn truy cập được dự án. Bạn có thể mời lại sau.', confirmLabel: 'Xóa thành viên', danger: true });
    if (!confirmed) return;
    try { await request(url(project.id, `/members/${member.user.id}`), { method: 'DELETE' }); await load(); notify('Đã xóa thành viên'); }
    catch (err) { onError(err.message); }
  };

  return <section className="content">
    <div className="page-heading"><div><h1>Thành viên</h1><p>Quản lý quyền truy cập của nhóm vào {project.name}.</p></div></div>
    {!manager && <div className="notice">Chỉ Quản lý của dự án mới xem và chỉnh sửa được danh sách thành viên.</div>}
    {manager && <>
      <div className="invite-card"><div><h2>Mời thành viên</h2><p>Người được mời cần có tài khoản API Portal.</p></div><form className="invite-form" onSubmit={addMember}><Input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="email@congty.com" /><Select value={role} onValueChange={setRole}><SelectTrigger className="member-role-select"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="DEVELOPER">Nhà phát triển</SelectItem><SelectItem value="MANAGER">Quản lý</SelectItem></SelectContent></Select><Button className="button button-primary" disabled={busy}>{busy ? 'Đang mời...' : <><Plus className="h-4 w-4" /> Mời thành viên</>}</Button></form></div>
      <div className="section-heading"><div><h2>Danh sách thành viên</h2><p>{members.length} thành viên trong dự án</p></div></div>
      <div className="member-list">{members.map((member) => <div className="member-row" key={member.id}><Avatar className="avatar"><AvatarFallback>{initials(member.user?.name)}</AvatarFallback></Avatar><span className="member-identity"><strong>{member.user?.name}</strong><small>{member.user?.email}</small></span><span className="muted">Tham gia {dateTime(member.createdAt)}</span><Select value={member.role} onValueChange={(value) => changeRole(member, value)}><SelectTrigger className="member-role-select"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="MANAGER">Quản lý</SelectItem><SelectItem value="DEVELOPER">Nhà phát triển</SelectItem></SelectContent></Select><Button variant="ghost" size="icon" className="icon-button" aria-label="Xóa thành viên" onClick={() => remove(member)}><X className="h-4 w-4" /></Button></div>)}</div>
    </>}
  </section>;
}

function ApiDetails({ project, api: initialApi, user, onBack, onError, notify, onApiUpdated }) {
  const [api, setApi] = useState(initialApi);
  const [tab, setTab] = useState('overview');
  const [specTab, setSpecTab] = useState('docs');
  const [specText, setSpecText] = useState(pretty(initialApi.spec));
  const [commitMessage, setCommitMessage] = useState('');
  const [revisions, setRevisions] = useState([]);
  const [comments, setComments] = useState([]);
  const [revisionDetail, setRevisionDetail] = useState(null);
  const [fromVersion, setFromVersion] = useState('');
  const [toVersion, setToVersion] = useState('');
  const [comparison, setComparison] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [anchor, setAnchor] = useState('');
  const [replyText, setReplyText] = useState({});
  const [busy, setBusy] = useState(false);
  const manager = project.role === 'MANAGER';

  useEffect(() => {
    setApi(initialApi);
    setSpecText(pretty(initialApi.spec));
    setRevisionDetail(null);
  }, [initialApi]);

  const loadRevisions = useCallback(async () => {
    try {
      const result = await request(apiUrl(project.id, api.id, '/revisions?page=1&limit=100'));
      if (!Array.isArray(result)) throw new Error('Máy chủ trả về dữ liệu lịch sử không hợp lệ');
      setRevisions(result);
      if (result.length) {
        setFromVersion((value) => value || String(result[result.length - 1].version));
        setToVersion((value) => value || String(result[0].version));
      }
    } catch (err) { onError(err.message); }
  }, [project.id, api.id, onError]);
  const loadComments = useCallback(async () => {
    try {
      const result = await request(apiUrl(project.id, api.id, '/comments?page=1&limit=100'));
      if (!Array.isArray(result)) throw new Error('Máy chủ trả về dữ liệu bình luận không hợp lệ');
      setComments(result);
    }
    catch (err) { onError(err.message); }
  }, [project.id, api.id, onError]);

  useEffect(() => { if (tab === 'history') loadRevisions(); }, [tab, loadRevisions]);
  useEffect(() => { if (tab === 'comments') loadComments(); }, [tab, loadComments]);

  const saveSpec = async (event) => {
    event.preventDefault();
    let spec;
    try { spec = JSON.parse(specText); } catch { onError('Nội dung JSON chưa hợp lệ. Hãy kiểm tra lại dấu ngoặc và dấu phẩy.'); return; }
    if (!spec || typeof spec !== 'object' || Array.isArray(spec) || !spec.responses || Array.isArray(spec.responses)) {
      onError('Nội dung API phải là một đối tượng JSON và có mục "responses".');
      return;
    }
    if (!commitMessage.trim()) { onError('Hãy nhập ghi chú thay đổi trước khi lưu.'); return; }
    setBusy(true);
    try {
      const updated = await request(apiUrl(project.id, api.id), {
        method: 'PUT',
        body: { spec, commitMessage: commitMessage.trim(), baseVersion: api.version },
      });
      setApi(updated);
      setSpecText(pretty(updated.spec));
      setCommitMessage('');
      onApiUpdated(updated);
      notify('Đã lưu thay đổi và tạo phiên bản mới');
    } catch (err) { onError(err.message); }
    finally { setBusy(false); }
  };
  const deleteApi = async () => {
    const confirmed = await confirmAction({ title: `Xóa API ${api.method} ${api.endpoint}?`, message: 'Lịch sử thay đổi và bình luận của API này cũng sẽ bị xóa. Không thể hoàn tác.', confirmLabel: 'Xóa API', danger: true });
    if (!confirmed) return;
    try { await request(apiUrl(project.id, api.id), { method: 'DELETE' }); onApiUpdated(null); onBack(); notify('Đã xóa API'); }
    catch (err) { onError(err.message); }
  };
  const showRevision = async (revision) => {
    try { setRevisionDetail(await request(apiUrl(project.id, api.id, `/revisions/${revision.id}`))); }
    catch (err) { onError(err.message); }
  };
  const compare = async () => {
    try { setComparison(await request(apiUrl(project.id, api.id, `/revisions/compare?from=${fromVersion}&to=${toVersion}`))); }
    catch (err) { onError(err.message); }
  };
  const restore = async (revision) => {
    const confirmed = await confirmAction({ title: `Khôi phục về phiên bản v${revision.version}?`, message: 'Nội dung API sẽ trở về trạng thái sau phiên bản này. Hệ thống tạo thêm một phiên bản mới và giữ nguyên lịch sử.', confirmLabel: 'Khôi phục' });
    if (!confirmed) return;
    try {
      const updated = await request(apiUrl(project.id, api.id, `/revisions/${revision.id}/restore`), { method: 'POST', body: {} });
      setApi(updated);
      onApiUpdated(updated);
      await loadRevisions();
      notify(`Đã khôi phục về phiên bản v${revision.version}`);
    } catch (err) { onError(err.message); }
  };
  const addComment = async (event) => {
    event.preventDefault();
    if (!commentText.trim()) return;
    try {
      await request(apiUrl(project.id, api.id, '/comments'), { method: 'POST', body: { content: commentText, ...(anchor.trim() && { anchor: anchor.trim() }) } });
      setCommentText('');
      setAnchor('');
      await loadComments();
      notify('Đã gửi bình luận');
    } catch (err) { onError(err.message); }
  };
  const reply = async (event, threadId) => {
    event.preventDefault();
    if (!replyText[threadId]?.trim()) return;
    try {
      await request(apiUrl(project.id, api.id, `/comments/${threadId}/replies`), { method: 'POST', body: { content: replyText[threadId] } });
      setReplyText((value) => ({ ...value, [threadId]: '' }));
      notify('Đã gửi câu trả lời');
      await loadComments();
    } catch (err) { onError(err.message); }
  };
  const setResolved = async (thread, resolved) => {
    try {
      await request(apiUrl(project.id, api.id, `/comments/${thread.id}/resolve`), { method: 'PATCH', body: { resolved } });
      notify(resolved ? 'Đã đánh dấu chủ đề là đã giải quyết' : 'Đã mở lại chủ đề');
      await loadComments();
    } catch (err) { onError(err.message); }
  };
  const deleteComment = async (comment) => {
    const confirmed = await confirmAction({ title: 'Xóa bình luận này?', message: 'Nếu đây là chủ đề thảo luận, các câu trả lời bên trong cũng sẽ bị xóa.', confirmLabel: 'Xóa bình luận', danger: true });
    if (!confirmed) return;
    try { await request(apiUrl(project.id, api.id, `/comments/${comment.id}`), { method: 'DELETE' }); await loadComments(); notify('Đã xóa bình luận'); }
    catch (err) { onError(err.message); }
  };

  const apiDocument = useMemo(() => (api ? toOpenApiDocument(api) : null), [api]);
  if (!api) return null;
  return <section className="content detail-content">
    <Button variant="ghost" className="back-link" onClick={onBack}><ArrowLeft className="h-4 w-4" /> Quay lại danh sách API</Button>
    <div className="detail-heading">
      <div><div className="eyebrow">{project.name} / Chi tiết API</div><h1><Badge variant="outline" className={cn('method', methodClass(api.method))}>{api.method}</Badge> <code>{api.endpoint}</code></h1><p>{api.summary || 'Chưa có mô tả'} {api.deprecated && <Badge variant="secondary" className="deprecated-pill">Sắp ngừng hỗ trợ</Badge>}</p></div>
      <div className="heading-actions"><Badge variant="outline" className="version-pill">v{api.version}</Badge>{manager && <Button variant="outline" className="button button-danger-quiet" onClick={deleteApi}>Xóa API</Button>}</div>
    </div>
    <Tabs value={tab} onValueChange={setTab} className="api-tabs">
      <TabsList className="detail-tabs">
        <TabsTrigger value="overview">Định nghĩa</TabsTrigger>
        <TabsTrigger value="history"><Clock3 className="h-4 w-4" /> Lịch sử{revisions.length > 0 && <span>{revisions.length}</span>}</TabsTrigger>
        <TabsTrigger value="comments"><MessageSquare className="h-4 w-4" /> Bình luận{comments.length > 0 && <span>{comments.length}</span>}</TabsTrigger>
      </TabsList>

    <TabsContent value="overview" className="api-tab-content"><div className="detail-grid">
      <div className="detail-main">
        <div className="panel spec-panel">
          <div className="panel-heading"><div><h2>Tài liệu API</h2><p>Tham số, header, nội dung gửi đi và phản hồi của API</p></div></div>
          <Tabs value={specTab} onValueChange={setSpecTab} className="spec-tabs">
            <TabsList className="spec-tabs-list">
              <TabsTrigger value="docs">Tài liệu</TabsTrigger>
              {manager && <TabsTrigger value="json">Chỉnh sửa JSON</TabsTrigger>}
            </TabsList>
            <TabsContent value="docs" className="spec-doc-content">
              <SwaggerApiViewer document={apiDocument} token={localStorage.getItem(tokenKey)} />
            </TabsContent>
            {manager && <TabsContent value="json" className="spec-json-content">
              <form onSubmit={saveSpec}><Textarea className="spec-editor" spellCheck="false" value={specText} onChange={(event) => setSpecText(event.target.value)} /><div className="editor-footer"><Input maxLength="500" required value={commitMessage} onChange={(event) => setCommitMessage(event.target.value)} placeholder="Ghi chú thay đổi (bắt buộc). Ví dụ: Thêm mã lỗi 404" /><Button className="button button-primary" disabled={busy}>{busy ? 'Đang lưu...' : 'Lưu thay đổi'}</Button></div></form>
            </TabsContent>}
          </Tabs>
        </div>
      </div>
      <aside className="detail-side">
        <div className="panel metadata-panel"><div className="panel-heading"><h2>Thông tin</h2></div>
          <Meta label="Phương thức"><Badge variant="outline" className={cn('method', methodClass(api.method))}>{api.method}</Badge></Meta>
          <Meta label="Đường dẫn"><code>{api.endpoint}</code></Meta>
          <Meta label="Phiên bản"><Badge variant="outline" className="version-pill">v{api.version}</Badge></Meta>
          <Meta label="Nhãn"><div className="tag-list">{api.tags?.length ? api.tags.map((tag) => <span className="tag" key={tag}>{tag}</span>) : <span className="muted">Chưa có nhãn</span>}</div></Meta>
          <Meta label="Cập nhật gần nhất">{dateTime(api.updatedAt)}</Meta>
        </div>
        <div className="panel"><div className="panel-heading"><h2>Trao đổi</h2></div><p className="panel-copy">Thảo luận và ghi chú trực tiếp trên API.</p><Button variant="outline" className="button button-secondary button-wide" onClick={() => setTab('comments')}>Mở bình luận <ArrowRight className="h-4 w-4" /></Button></div>
      </aside>
    </div></TabsContent>

    <TabsContent value="history" className="api-tab-content"><div className="panel history-panel">
      <div className="panel-heading"><div><h2>Lịch sử thay đổi</h2><p>Mỗi lần nhập tài liệu, chỉnh sửa hoặc khôi phục sẽ tạo một phiên bản mới.</p></div><Button variant="ghost" className="button button-quiet" onClick={loadRevisions}><History className="h-4 w-4" /> Làm mới</Button></div>
      <div className="compare-bar"><span>So sánh</span>
        <Select value={fromVersion || 'none'} onValueChange={setFromVersion}><SelectTrigger className="version-select"><SelectValue /></SelectTrigger><SelectContent>{revisions.length ? revisions.map((revision) => <SelectItem key={revision.id} value={String(revision.version)}>v{revision.version}</SelectItem>) : <SelectItem value="none">—</SelectItem>}</SelectContent></Select>
        <span>với</span>
        <Select value={toVersion || 'none'} onValueChange={setToVersion}><SelectTrigger className="version-select"><SelectValue /></SelectTrigger><SelectContent>{revisions.length ? revisions.map((revision) => <SelectItem key={revision.id} value={String(revision.version)}>v{revision.version}</SelectItem>) : <SelectItem value="none">—</SelectItem>}</SelectContent></Select>
        <Button variant="outline" className="button button-secondary" disabled={!revisions.length || fromVersion === toVersion} onClick={compare}>So sánh</Button></div>
      {comparison && <div className="compare-result"><div className="compare-title"><strong>v{comparison.from.version} → v{comparison.to.version}</strong><span>{comparison.changes.length} thay đổi</span><button className="icon-button" aria-label="Đóng kết quả so sánh" onClick={() => setComparison(null)}><X className="h-4 w-4" /></button></div><DiffList changes={comparison.changes} /></div>}
      <div className="timeline">{revisions.map((revision) => <article className="revision-item" key={revision.id}><span className={`timeline-dot action-${revision.action.toLowerCase()}`}></span><div className="revision-body"><div className="revision-title"><strong>v{revision.version}</strong><span className={`action-pill action-${revision.action.toLowerCase()}`}>{ACTION_LABELS[revision.action] || revision.action}</span><span className="revision-date">{dateTime(revision.createdAt)}</span></div><p>{revision.commitMessage}</p><div className="revision-author">Bởi {revision.changedBy?.name || revision.changedBy?.email || 'Người dùng'}{revision.restoredFromVersion && ` · Khôi phục từ v${revision.restoredFromVersion}`}</div><div className="revision-actions"><button className="text-button" onClick={() => showRevision(revision)}>Xem thay đổi</button>{manager && <button className="text-button" onClick={() => restore(revision)}>Khôi phục phiên bản</button>}</div></div></article>)}{!revisions.length && <div className="table-empty">Chưa có lịch sử thay đổi.</div>}</div>
      {revisionDetail && <div className="revision-detail"><div className="panel-heading"><div><h3>Phiên bản v{revisionDetail.version}</h3><p>{revisionDetail.commitMessage}</p></div><button className="icon-button" aria-label="Đóng chi tiết phiên bản" onClick={() => setRevisionDetail(null)}><X className="h-4 w-4" /></button></div><DiffList changes={revisionDetail.diff} /></div>}
    </div></TabsContent>

    <TabsContent value="comments" className="api-tab-content"><div className="comments-layout">
      {project.role === 'DEVELOPER' && <div className="panel comment-compose"><h2>Thêm bình luận</h2><p>Trao đổi với nhóm về nội dung API.</p><form onSubmit={addComment}><label>Vị trí trong tài liệu (không bắt buộc)<Input maxLength="200" value={anchor} onChange={(event) => setAnchor(event.target.value)} placeholder="/responses/404" /></label><Textarea required maxLength="5000" rows="4" value={commentText} onChange={(event) => setCommentText(event.target.value)} placeholder="Viết bình luận..." /><Button className="button button-primary">Gửi bình luận</Button></form></div>}
      <div className="comment-threads">{comments.map((thread) => <article className={`thread ${thread.resolved ? 'thread-resolved' : ''}`} key={thread.id}><div className="thread-head"><span className="avatar avatar-small">{initials(thread.author?.name)}</span><div className="thread-author"><strong>{thread.author?.name || thread.author?.email}</strong><small>{dateTime(thread.createdAt)}{thread.anchor && <code> · {thread.anchor}</code>}</small></div><span className={`thread-status ${thread.resolved ? 'resolved' : ''}`}>{thread.resolved ? 'Đã giải quyết' : 'Đang mở'}</span></div><p className="thread-content">{thread.content}</p>
        {(thread.replies || []).map((replyItem) => <div className="reply-item" key={replyItem.id}><span className="avatar avatar-small">{initials(replyItem.author?.name)}</span><div><strong>{replyItem.author?.name || replyItem.author?.email}</strong><small>{dateTime(replyItem.createdAt)}</small><p>{replyItem.content}</p></div></div>)}
        <form className="reply-form" onSubmit={(event) => reply(event, thread.id)}><input aria-label="Câu trả lời" value={replyText[thread.id] || ''} onChange={(event) => setReplyText((value) => ({ ...value, [thread.id]: event.target.value }))} placeholder="Viết câu trả lời..." /><button className="text-button">Trả lời</button></form>
        <div className="thread-actions">{manager && <button className="text-button" onClick={() => setResolved(thread, !thread.resolved)}>{thread.resolved ? 'Mở lại' : 'Đánh dấu đã giải quyết'}</button>}{(manager || thread.author?.id === user?.id) && <button className="text-button text-danger" onClick={() => deleteComment(thread)}>Xóa</button>}</div>
      </article>)}{!comments.length && <div className="panel table-empty">{manager ? 'Chưa có bình luận nào từ nhóm phát triển.' : 'Chưa có bình luận. Hãy bắt đầu trao đổi.'}</div>}</div>
    </div></TabsContent>
    </Tabs>
  </section>;
}

function Meta({ label, children }) {
  return <div className="meta-row"><span>{label}</span><div>{children}</div></div>;
}

function DiffList({ changes = [] }) {
  if (!changes.length) return <div className="no-changes">Không có thay đổi nào.</div>;
  return <div className="diff-list">{changes.map((change, index) => <div key={`${change.path}-${index}`} className={`diff-item diff-${change.op}`}><span className="diff-op">{DIFF_LABELS[change.op] || change.op}</span><code>{change.path || '/'}</code><div>{change.before !== undefined && <pre className="diff-before">{pretty(change.before)}</pre>}{change.after !== undefined && <pre className="diff-after">{pretty(change.after)}</pre>}</div></div>)}</div>;
}

function Modal({ title, subtitle, onClose, children, wide = false }) {
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className={cn('modal', wide && 'modal-wide')}>
      <DialogHeader className="modal-header">
        <div>
          <DialogTitle className="modal-title">{title}</DialogTitle>
          <DialogDescription className={cn('modal-description', !subtitle && 'sr-only')}>{subtitle || title}</DialogDescription>
        </div>
      </DialogHeader>
      {children}
    </DialogContent>
  </Dialog>;
}

export default App;
