// ===== 初始化 =====
const SUPABASE_URL = 'https://nsoyywbuqpfhhrezdcly.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zb3l5d2J1cXBmaGhyZXpkY2x5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4MzMyODIsImV4cCI6MjEwNjQwOTI4Mn0.L17d0locmWHjQFykzv9bTjTyLZAk8LDyfSmpxbEnTgg';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const ADMIN_EMAILS = ['wuumii@outlook.com'];

let currentUser = null;
let currentProfile = null;
let currentChat = null;
let CHARACTERS = {};
let inboxConversations = [];

// ===== 工具 =====
function $(s, r = document) { return r.querySelector(s); }
function esc(s) { return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function showToast(msg) {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._timer); t._timer = setTimeout(() => t.classList.remove('show'), 2000);
}
function timeAgo(d) {
  if (!d) return '';
  const t = new Date(d);
  const s = Math.floor((Date.now() - t.getTime()) / 1000);
  if (s < 60) return '刚刚';
  if (s < 3600) return Math.floor(s/60) + '分前';
  if (s < 86400) return Math.floor(s/3600) + '小时前';
  if (s < 86400*7) return Math.floor(s/86400) + '天前';
  return t.toLocaleDateString('zh-CN');
}

// ===== 认证 =====
async function checkAdmin() {
  const { data: { user } } = await db.auth.getUser();
  if (!user) {
    $('#admin-app').innerHTML = '<div class="empty">请先 <a href="index.html">登录</a></div>';
    return false;
  }
  if (!ADMIN_EMAILS.map(e => e.toLowerCase()).includes((user.email || '').toLowerCase())) {
    $('#admin-app').innerHTML = '<div class="empty">无权访问</div>';
    return false;
  }
  currentUser = user;
  const { data: profile } = await db.from('profiles').select('id, username, faction').eq('id', user.id).single();
  currentProfile = profile;
  $('#admin-email').textContent = user.email;
  try {
    const r = await fetch('data/characters.json');
    CHARACTERS = await r.json();
  } catch (e) {}
  return true;
}

// ===== 导航 =====
function renderNav() {
  const nav = $('#admin-nav');
  const cur = location.hash.slice(1) || 'todo';
  const items = [
    { key: 'todo', icon: '📋', text: '待办' },
    { key: 'inbox', icon: '✉️', text: '私信' },
    { key: 'reports', icon: '🚨', text: '举报' },
    { key: 'users', icon: '👥', text: '用户' },
    { key: 'stats', icon: '📊', text: '数据' },
  ];
  nav.innerHTML = items.map(it => `
    <a href="#${it.key}" style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:8px;text-decoration:none;font-size:14px;margin-bottom:4px;${cur===it.key?'background:var(--primary-light);color:var(--primary-dark);font-weight:600;':'color:var(--text);'}">
      <span>${it.icon}</span> ${it.text}
    </a>
  `).join('');
}

// ===== 路由 =====
async function router() {
  const cur = location.hash.slice(1) || 'todo';
  renderNav();
  if (cur === 'todo') return renderTodo();
  if (cur === 'inbox') return renderInbox();
  if (cur === 'reports') return renderReports();
  if (cur === 'users') return renderUsers();
  if (cur === 'stats') return renderStats();
  $('#admin-app').innerHTML = '<div class="empty">未知页面</div>';
}

// ===== 待办首页 =====
async function renderTodo() {
  const root = $('#admin-app');
  root.innerHTML = '<div class="empty" style="padding:40px;text-align:center;">加载中…</div>';

  const today = new Date(); today.setHours(0,0,0,0);
  const todayISO = today.toISOString();

  const [inbox, reports, comments, users] = await Promise.all([
    db.from('messages').select('*', { count: 'exact', head: true }).eq('is_from_character', false).gte('created_at', todayISO),
    db.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    db.from('comments').select('*', { count: 'exact', head: true }).gte('created_at', todayISO),
    db.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', todayISO),
  ]);

  const cards = [
    { icon: '✉️', label: '今日新私信', num: inbox.count || 0, href: '#inbox' },
    { icon: '🚨', label: '待处理举报', num: reports.count || 0, href: '#reports' },
    { icon: '💬', label: '今日新评论', num: comments.count || 0, href: null },
    { icon: '👥', label: '今日新用户', num: users.count || 0, href: null },
  ];

  root.innerHTML = `
    <div class="card"><h3>待办</h3><p style="font-size:13px;color:var(--muted);margin-top:6px;">今天要做的事，一屏看完。</p></div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;">
      ${cards.map(c => `
        <div class="card" style="${c.href?'cursor:pointer;':''}" ${c.href?`onclick="location.hash='${c.href}'"`:''}>
          <div style="font-size:28px;margin-bottom:8px;">${c.icon}</div>
          <div style="font-size:30px;font-weight:800;color:var(--primary-dark);">${c.num}</div>
          <div style="font-size:13px;color:var(--muted);margin-top:4px;">${c.label}</div>
        </div>
      `).join('')}
    </div>
  `;
}

// ===== 私信收件箱 =====
async function renderInbox() {
  const root = $('#admin-app');
  root.innerHTML = '<div class="empty" style="padding:40px;text-align:center;">加载中…</div>';

  const { data: msgs, error } = await db.from('messages')
    .select('id, user_id, character_id, content, created_at, is_from_character')
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) { root.innerHTML = '<div class="empty">加载失败：' + esc(error.message) + '</div>'; return; }

  const map = {};
  (msgs || []).forEach(m => {
    const key = m.user_id + '::' + m.character_id;
    if (!map[key]) {
      map[key] = {
        user_id: m.user_id,
        character_id: m.character_id,
        last_at: m.created_at,
        last_msg: m.content,
        last_from: m.is_from_character ? 'role' : 'user',
      };
    }
  });
  inboxConversations = Object.values(map).sort((a, b) => new Date(b.last_at) - new Date(a.last_at));

  const userIds = [...new Set(inboxConversations.map(c => c.user_id))];
  const profileMap = {};
  if (userIds.length) {
    const { data: profiles } = await db.from('profiles').select('id, username, avatar_url').in('id', userIds);
    (profiles || []).forEach(p => { profileMap[p.id] = p; });
  }

  root.innerHTML = `
    <div class="card" style="padding:12px 16px;"><h3>私信收件箱</h3></div>
    <div style="display:grid;grid-template-columns:280px 1fr;gap:16px;height:calc(100vh - 220px);">
      <div class="card" style="overflow-y:auto;padding:8px;" id="inbox-list">
        ${inboxConversations.length === 0 ? '<div class="empty">还没有私信</div>' : inboxConversations.map((c, i) => {
          const p = profileMap[c.user_id] || {};
          const ch = CHARACTERS[c.character_id] || {};
          const name = p.username || '匿名旅者';
          const charName = ch.name || c.character_id;
          const isActive = currentChat && currentChat.user_id === c.user_id && currentChat.character_id === c.character_id;
          return `
            <div onclick="openChat(${i})" style="cursor:pointer;padding:10px;border-radius:8px;margin-bottom:4px;${isActive?'background:var(--primary-light);':''}">
              <div style="font-size:13px;font-weight:600;">${esc(name)} → ${esc(charName)}</div>
              <div style="font-size:12px;color:var(--muted);margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                ${c.last_from === 'role' ? '我：' : ''}${esc(c.last_msg.slice(0, 30))}
              </div>
              <div style="font-size:11px;color:var(--muted);margin-top:2px;">${timeAgo(c.last_at)}</div>
            </div>
          `;
        }).join('')}
      </div>
      <div class="card" style="display:flex;flex-direction:column;padding:0;" id="chat-panel">
        <div class="empty" style="margin:auto;padding:40px;">选择左侧一个会话开始回复</div>
      </div>
    </div>
  `;

  if (currentChat) openChat(inboxConversations.findIndex(c => c.user_id === currentChat.user_id && c.character_id === currentChat.character_id));
}

async function openChat(index) {
  if (index < 0 || index >= inboxConversations.length) return;
  const c = inboxConversations[index];
  currentChat = { user_id: c.user_id, character_id: c.character_id };

  // 刷新列表高亮
  document.querySelectorAll('#inbox-list > div').forEach((el, i) => {
    el.style.background = i === index ? 'var(--primary-light)' : '';
  });

  const panel = $('#chat-panel');
  panel.innerHTML = '<div class="empty" style="margin:auto;">加载中…</div>';

  const { data: msgs } = await db.from('messages')
    .select('id, content, created_at, is_from_character')
    .eq('user_id', c.user_id)
    .eq('character_id', c.character_id)
    .order('created_at', { ascending: true });

  const ch = CHARACTERS[c.character_id] || {};
  const p = (await db.from('profiles').select('username').eq('id', c.user_id).single()).data || {};
  const charName = ch.name || c.character_id;
  const userName = p.username || '匿名旅者';

  panel.innerHTML = `
    <div style="padding:12px 16px;border-bottom:1px solid var(--border);">
      <div style="font-size:14px;font-weight:600;">${esc(userName)} → ${esc(charName)}</div>
      <div style="font-size:12px;color:var(--muted);margin-top:2px;">共 ${(msgs||[]).length} 条消息</div>
    </div>
    <div id="chat-messages" style="flex:1;overflow-y:auto;padding:16px;">
      ${(msgs||[]).map(m => {
        const isRole = m.is_from_character;
        const time = new Date(m.created_at).toLocaleString('zh-CN');
        return `
          <div style="margin-bottom:10px;text-align:${isRole?'right':'left'};">
            <div style="display:inline-block;padding:8px 12px;border-radius:12px;background:${isRole?'var(--primary-light)':'var(--bg)'};max-width:70%;text-align:left;font-size:14px;">
              ${esc(m.content)}
            </div>
            <div style="font-size:11px;color:var(--muted);margin-top:4px;">${isRole?'我（'+esc(charName)+'）':esc(userName)} · ${time}</div>
          </div>
        `;
      }).join('')}
    </div>
    <div style="border-top:1px solid var(--border);padding:12px;">
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">
        ${['你好，旅者。','收到你的信，我会尽快回复。','很高兴收到你的来信。','请稍等，我需要一点时间。'].map(q => `
          <button class="btn" style="font-size:12px;padding:4px 10px;" onclick="fillQuick('${esc(q)}')">${esc(q)}</button>
        `).join('')}
      </div>
      <div style="display:flex;gap:8px;">
        <textarea id="chat-input" rows="2" placeholder="输入回复…" style="flex:1;padding:8px;border:1px solid var(--border);border-radius:8px;font-family:inherit;resize:none;font-size:14px;"></textarea>
        <button class="btn btn-primary" onclick="sendReply()">发送</button>
      </div>
      <div style="font-size:11px;color:var(--muted);margin-top:6px;">回车发送，Shift+Enter 换行</div>
    </div>
  `;

  const ta = $('#chat-input');
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendReply();
    }
  });
  ta.focus();
  $('#chat-messages').scrollTop = $('#chat-messages').scrollHeight;
}

function fillQuick(text) {
  const ta = $('#chat-input');
  if (ta) { ta.value = text; ta.focus(); }
}

async function sendReply() {
  if (!currentChat) return;
  const ta = $('#chat-input');
  const content = ta.value.trim();
  if (!content) return;
  ta.disabled = true;

  const { error } = await db.from('messages').insert({
    user_id: currentChat.user_id,
    character_id: currentChat.character_id,
    content: content,
    is_from_character: true,
    notified: false
  });

  ta.disabled = false;

  if (error) { showToast('发送失败：' + error.message); return; }
  showToast('已发送');
  ta.value = '';

  // 刷新聊天窗
  const idx = inboxConversations.findIndex(c => c.user_id === currentChat.user_id && c.character_id === currentChat.character_id);
  await renderInbox();
  if (idx >= 0) openChat(idx);
}

// ===== 举报处理 =====
async function renderReports() {
  const root = $('#admin-app');
  root.innerHTML = '<div class="empty" style="padding:40px;text-align:center;">加载中…</div>';

  const { data: reports, error } = await db.from('reports')
    .select('*').eq('status', 'pending').order('created_at', { ascending: false });

  if (error) { root.innerHTML = '<div class="empty">加载失败：' + esc(error.message) + '</div>'; return; }

  if (!reports || !reports.length) {
    root.innerHTML = `
      <div class="card"><h3>举报处理</h3><div class="empty" style="margin-top:12px;">目前没有待处理举报。</div></div>
    `;
    return;
  }

  const commentIds = reports.filter(r => r.target_type === 'comment').map(r => r.target_id);
  const { data: comments } = await db.from('comments')
    .select('id, content, post_id, user_id, status').in('id', commentIds);
  const commentMap = {};
  (comments || []).forEach(c => { commentMap[c.id] = c; });

  root.innerHTML = `
    <div class="card"><h3>举报处理（${reports.length} 条待处理）</h3></div>
    ${reports.map(r => {
      const c = commentMap[r.target_id];
      const text = c ? c.content : '（评论不存在或已被删除）';
      const status = c ? c.status : 'unknown';
      const time = new Date(r.created_at).toLocaleString('zh-CN');
      return `
        <div class="card" style="border-color:#f5c2c7;">
          <div style="font-size:13px;color:var(--muted);margin-bottom:6px;">
            举报原因：<b>${esc(r.reason)}</b> · ${time}
          </div>
          <div style="background:var(--bg);padding:10px;border-radius:6px;font-size:14px;word-break:break-word;margin-bottom:10px;">
            ${esc(text)}
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            ${c && status === 'visible' ? `<button class="btn" style="border-color:#dc3545;color:#dc3545;" onclick="hideComment('${r.id}', '${c.id}', '${c.user_id}')">删除评论 + 封禁</button>` : ''}
            <button class="btn" onclick="hideCommentOnly('${r.id}', '${c ? c.id : ''}')">仅隐藏评论</button>
            <button class="btn" onclick="ignoreReport('${r.id}')">驳回举报</button>
          </div>
        </div>
      `;
    }).join('')}
  `;
}

async function hideComment(reportId, commentId, userId) {
  if (!confirm('确定删除这条评论并封禁该用户吗？')) return;
  await db.from('comments').update({ status: 'hidden' }).eq('id', commentId);
  await db.from('profiles').update({ is_banned: true }).eq('id', userId);
  await db.from('reports').update({ status: 'handled' }).eq('id', reportId);
  showToast('已删除 + 封禁');
  renderReports();
}

async function hideCommentOnly(reportId, commentId) {
  if (!commentId) return showToast('评论不存在');
  if (!confirm('仅隐藏这条评论？')) return;
  await db.from('comments').update({ status: 'hidden' }).eq('id', commentId);
  await db.from('reports').update({ status: 'handled' }).eq('id', reportId);
  showToast('已隐藏');
  renderReports();
}

async function ignoreReport(reportId) {
  if (!confirm('驳回这条举报？')) return;
  await db.from('reports').update({ status: 'rejected' }).eq('id', reportId);
  showToast('已驳回');
  renderReports();
}

// ===== 用户管理（暂占位）=====
async function renderUsers() {
  $('#admin-app').innerHTML = `
    <div class="card"><h3>用户管理</h3><div class="empty" style="margin-top:12px;">下一批做。</div></div>
  `;
}

// ===== 数据看板（暂占位）=====
async function renderStats() {
  $('#admin-app').innerHTML = `
    <div class="card"><h3>数据看板</h3><div class="empty" style="margin-top:12px;">下一批做。</div></div>
  `;
}

// ===== 启动 =====
window.addEventListener('DOMContentLoaded', async () => {
  const ok = await checkAdmin();
  if (!ok) return;
  await router();
});
window.addEventListener('hashchange', router);
