// ===== 初始化 =====
const SUPABASE_URL = 'https://nsoyywbuqpfhhrezdcly.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zb3l5d2J1cXBmaGhyZXpkY2x5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4MzMyODIsImV4cCI6MjEwNjQwOTI4Mn0.L17d0locmWHjQFykzv9bTjTyLZAk8LDyfSmpxbEnTgg';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const ADMIN_EMAILS = ['wuumii@outlook.com'];
// ===== 从 app.js 复制的工具函数 =====
function factionIcon(faction) {
  if (faction === '精灵') return '🦌';
  if (faction === '矮人') return '⚒️';
  if (faction === '人类') return '⭐';
  if (faction === '异人') return '🌲';
  if (faction === '240') return '⚖️';
  if (faction === '246') return '🔳';
  if (faction === '240-1') return '💥';
  return '';
}

function factionTitle(faction) {
  if (faction === '精灵') return '旅人';
  if (faction === '矮人') return '锻造学徒';
  if (faction === '人类') return '见习法师';
  if (faction === '异人') return '泥娃娃';
  if (faction === '240' || faction === '246' || faction === '240-1') return '人类';
  return '';
}

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
    { key: 'content', icon: '📝', text: '内容' },
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
  if (cur === 'content') return renderContent();
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

// ===== 内容管理 =====
let contentSubTab = 'main';   // main | forum | hotsearch
let contentFilter = '';        // 角色 handle 或 阵营名，空=全部

async function renderContent() {
  const root = $('#admin-app');
  root.innerHTML = `
    <div class="card" style="padding:12px 16px;">
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn ${contentSubTab==='main'?'btn-primary':''}" onclick="switchContentTab('main')">📝 主页帖子</button>
        <button class="btn ${contentSubTab==='forum'?'btn-primary':''}" onclick="switchContentTab('forum')">⚔️ 论坛帖子</button>
        <button class="btn ${contentSubTab==='hotsearch'?'btn-primary':''}" onclick="switchContentTab('hotsearch')">🔥 热搜</button>
      </div>
    </div>
    <div id="content-body"></div>
  `;
  if (contentSubTab === 'main') return renderMainPosts();
  if (contentSubTab === 'forum') return renderForumPosts();
  if (contentSubTab === 'hotsearch') return renderHotsearchEdit();
}

function switchContentTab(tab) {
  contentSubTab = tab;
  contentFilter = '';
  renderContent();
}

// ===== 主页帖子 =====
async function renderMainPosts() {
  const body = $('#content-body');
  body.innerHTML = '<div class="empty" style="padding:40px;text-align:center;">加载中…</div>';

  const { data: posts, error } = await db.from('posts')
    .select('id, character, date, content, faction, post_type')
    .eq('post_type', 'main')
    .order('date', { ascending: false });

  if (error) { body.innerHTML = '<div class="empty">加载失败：' + esc(error.message) + '</div>'; return; }

  // 按角色分组
  const grouped = {};
  (posts || []).forEach(p => {
    if (!grouped[p.character]) grouped[p.character] = [];
    grouped[p.character].push(p);
  });

  const allChars = Object.keys(grouped).sort();

  body.innerHTML = `
    <div class="card" style="padding:12px 16px;">
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
        <span style="font-size:13px;color:var(--muted);">角色：</span>
        <button class="btn ${contentFilter===''?'btn-primary':''}" style="padding:4px 12px;font-size:13px;" onclick="filterContent('')">全部</button>
        ${allChars.map(h => {
          const c = CHARACTERS[h] || {};
          return `<button class="btn ${contentFilter===h?'btn-primary':''}" style="padding:4px 12px;font-size:13px;" onclick="filterContent('${h}')">${esc(c.name || h)}</button>`;
        }).join('')}
      </div>
    </div>
    <div id="content-list">
      ${renderMainPostsList(grouped)}
    </div>
  `;
}

function filterContent(handle) {
  contentFilter = handle;
  renderContent();
}

function renderMainPostsList(grouped) {
  const keys = contentFilter ? [contentFilter] : Object.keys(grouped);
  if (!keys.length) return '<div class="card"><div class="empty">还没有帖子</div></div>';

  return keys.map(handle => {
    const c = CHARACTERS[handle] || { name: handle };
    const list = grouped[handle] || [];
    if (!list.length) return '';
    return `
      <div class="card" style="padding:12px 16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <div style="font-weight:700;font-size:15px;">
            ${factionIcon(c.faction)} ${esc(c.name)} <span style="font-size:12px;color:var(--muted);font-weight:400;">(@${esc(handle)} · ${list.length} 条)</span>
          </div>
          <button class="btn" style="padding:4px 10px;font-size:12px;" onclick="openPostEditor('', '${handle}', 'main')">+ 新建</button>
        </div>
        ${list.map(p => `
          <div style="padding:10px;border-radius:8px;background:var(--bg);margin-bottom:6px;cursor:pointer;" onclick="openPostEditor('${p.id}', '', 'main')">
            <div style="font-size:13px;color:var(--muted);margin-bottom:4px;">${esc(p.date || '')}</div>
            <div style="font-size:14px;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${esc(p.content.slice(0, 100))}</div>
          </div>
        `).join('')}
      </div>
    `;
  }).join('');
}

// ===== 论坛帖子（先做列表，编辑功能跟主页一样）=====
async function renderForumPosts() {
  const body = $('#content-body');
  body.innerHTML = '<div class="empty" style="padding:40px;text-align:center;">加载中…</div>';

  const { data: posts, error } = await db.from('posts')
    .select('id, character, date, content, faction, post_type')
    .eq('post_type', 'forum')
    .order('date', { ascending: false });

  if (error) { body.innerHTML = '<div class="empty">加载失败：' + esc(error.message) + '</div>'; return; }

  const grouped = {};
  (posts || []).forEach(p => {
    if (!grouped[p.faction]) grouped[p.faction] = [];
    grouped[p.faction].push(p);
  });

  const allFactions = ['精灵', '矮人', '人类', '异人', '240', '246', '240-1'];

  body.innerHTML = `
    <div class="card" style="padding:12px 16px;">
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
        <span style="font-size:13px;color:var(--muted);">阵营：</span>
        <button class="btn ${contentFilter===''?'btn-primary':''}" style="padding:4px 12px;font-size:13px;" onclick="filterContent('')">全部</button>
        ${allFactions.map(f => `<button class="btn ${contentFilter===f?'btn-primary':''}" style="padding:4px 12px;font-size:13px;" onclick="filterContent('${f}')">${factionIcon(f)} ${f}</button>`).join('')}
      </div>
    </div>
    <div id="content-list">
      ${renderForumPostsList(grouped, allFactions)}
    </div>
  `;
}

function renderForumPostsList(grouped, allFactions) {
  const keys = contentFilter ? [contentFilter] : allFactions;
  return keys.map(f => {
    const list = grouped[f] || [];
    if (!list.length && contentFilter !== f) return '';
    return `
      <div class="card" style="padding:12px 16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <div style="font-weight:700;font-size:15px;">
            ${factionIcon(f)} ${esc(f)} 论坛 <span style="font-size:12px;color:var(--muted);font-weight:400;">(${list.length} 条)</span>
          </div>
          <button class="btn" style="padding:4px 10px;font-size:12px;" onclick="openPostEditor('', '', 'forum', '${f}')">+ 新建</button>
        </div>
        ${list.length === 0 ? '<div style="font-size:13px;color:var(--muted);">暂无帖子</div>' : list.map(p => `
          <div style="padding:10px;border-radius:8px;background:var(--bg);margin-bottom:6px;cursor:pointer;" onclick="openPostEditor('${p.id}', '', 'forum')">
            <div style="font-size:13px;color:var(--muted);margin-bottom:4px;">${esc(p.date || '')} · @${esc(p.character)}</div>
            <div style="font-size:14px;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${esc(p.content.slice(0, 100))}</div>
          </div>
        `).join('')}
      </div>
    `;
  }).join('');
}

// ===== 热搜编辑 =====
async function renderHotsearchEdit() {
  const body = $('#content-body');
  body.innerHTML = '<div class="empty" style="padding:40px;text-align:center;">加载中…</div>';

  const { data, error } = await db.from('hotsearch').select('*').order('faction').order('rank');
  if (error) { body.innerHTML = '<div class="empty">加载失败：' + esc(error.message) + '</div>'; return; }

  const byFaction = {};
  (data || []).forEach(r => {
    if (!byFaction[r.faction]) byFaction[r.faction] = [];
    byFaction[r.faction].push(r);
  });

  const factions = ['精灵', '矮人', '人类', '异人', '240'];

  body.innerHTML = factions.map(f => {
    const list = byFaction[f] || [
      { id: '', rank: 1, text: '', url: '' },
      { id: '', rank: 2, text: '', url: '' },
      { id: '', rank: 3, text: '', url: '' },
    ];
    return `
      <div class="card" id="hot-card-${f}">
        <div style="font-weight:700;margin-bottom:12px;">${factionIcon(f)} ${esc(f)} 热搜</div>
        ${[1, 2, 3].map(rank => {
          const item = list.find(x => x.rank === rank) || { text: '', url: '' };
          return `
            <div style="display:flex;gap:8px;margin-bottom:8px;align-items:center;">
              <span style="width:24px;font-weight:700;color:var(--muted);">${rank}</span>
              <input class="hot-text-${f}-${rank}" type="text" value="${esc(item.text)}" placeholder="热搜文字" style="flex:2;padding:8px;border:1px solid var(--border);border-radius:8px;">
              <input class="hot-url-${f}-${rank}" type="text" value="${esc(item.url)}" placeholder="跳转链接（可选）" style="flex:2;padding:8px;border:1px solid var(--border);border-radius:8px;">
            </div>
          `;
        }).join('')}
        <button class="btn btn-primary" style="margin-top:4px;" onclick="saveHotsearch('${f}')">保存 ${esc(f)} 热搜</button>
      </div>
    `;
  }).join('');
}

async function saveHotsearch(faction) {
  const items = [];
  for (const rank of [1, 2, 3]) {
    const text = document.querySelector(`.hot-text-${faction}-${rank}`).value.trim();
    const url = document.querySelector(`.hot-url-${faction}-${rank}`).value.trim();
    if (text) items.push({ faction, rank, text, url });
  }

  await db.from('hotsearch').delete().eq('faction', faction);
  if (items.length) {
    const { error } = await db.from('hotsearch').insert(items);
    if (error) return showToast('保存失败：' + error.message);
  }
  showToast(faction + ' 热搜已保存');
}

// ===== 评论管理面板 =====
async function openCommentsPanel(postId) {
  const modal = document.createElement('div');
  modal.id = 'comments-panel-modal';
  modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9999;overflow-y:auto;padding:20px;box-sizing:border-box;';
  document.body.appendChild(modal);

  async function refresh() {
    modal.innerHTML = '<div style="background:#fff;padding:20px;border-radius:12px;max-width:700px;margin:0 auto;"><div class="empty">加载中…</div></div>';

    const { data: comments, error } = await db.from('comments')
      .select('id, content, created_at, user_id, as_character, status, parent_id')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (error) {
      modal.innerHTML = '<div style="background:#fff;padding:20px;border-radius:12px;max-width:700px;margin:0 auto;"><div class="empty">加载失败：' + esc(error.message) + '</div></div>';
      return;
    }

    const userIds = [...new Set((comments || []).filter(c => !c.as_character).map(c => c.user_id))];
    const profileMap = {};
    if (userIds.length) {
      const { data: profs } = await db.from('profiles').select('id, username').in('id', userIds);
      (profs || []).forEach(p => { profileMap[p.id] = p; });
    }

    const visible = (comments || []).filter(c => c.status !== 'hidden');

    modal.innerHTML = `
      <div style="background:#fff;padding:20px;border-radius:12px;max-width:700px;margin:0 auto;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <h3 style="margin:0;">评论管理 · 帖子 ${esc(postId)}</h3>
          <button class="btn" onclick="document.getElementById('comments-panel-modal').remove()">关闭</button>
        </div>

        <div style="padding:12px;background:var(--primary-light);border-radius:8px;margin-bottom:16px;">
          <div style="font-size:13px;font-weight:600;margin-bottom:8px;">以角色身份发评论</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
            <select id="cm-char-select" style="padding:8px;border:1px solid var(--border);border-radius:8px;background:#fff;">
              ${Object.values(CHARACTERS).map(c => `<option value="${c.handle}">${esc(c.name)}${c.verified ? ' ✓' : ''}</option>`).join('')}
            </select>
            <input id="cm-char-content" type="text" placeholder="以角色身份写评论…" maxlength="500" style="flex:1;min-width:200px;padding:8px;border:1px solid var(--border);border-radius:8px;">
            <button class="btn btn-primary" onclick="adminPostAsCharacter('${postId}')">发布</button>
          </div>
        </div>

        <div style="font-size:13px;color:var(--muted);margin-bottom:8px;">全部评论（${visible.length} 条可见，${(comments||[]).length - visible.length} 条已隐藏）</div>

        ${(comments || []).length === 0 ? '<div class="empty">还没有评论</div>' : (comments || []).map(c => {
          let name, avatar, isRole = !!c.as_character;
          if (isRole) {
            const ch = CHARACTERS[c.as_character] || { name: c.as_character };
            name = ch.name + '（角色）';
            avatar = factionIcon(ch.faction);
          } else {
            const p = profileMap[c.user_id] || {};
            name = p.username || '匿名';
            avatar = '👤';
          }
          const hidden = c.status === 'hidden';
          return `
            <div style="padding:10px;border-radius:8px;background:${hidden ? '#f5c2c7' : 'var(--bg)'};margin-bottom:8px;">
              <div style="font-size:12px;color:var(--muted);margin-bottom:4px;">
                ${avatar} ${esc(name)} · ${new Date(c.created_at).toLocaleString('zh-CN')}
                ${hidden ? ' · <span style="color:#b02a37;">已隐藏</span>' : ''}
              </div>
              <div style="font-size:13px;margin-bottom:8px;word-break:break-word;">${esc(c.content)}</div>
              <div style="display:flex;gap:6px;flex-wrap:wrap;">
                ${hidden
                  ? `<button class="btn" style="font-size:12px;padding:2px 10px;" onclick="adminShowComment('${c.id}')">恢复显示</button>`
                  : `<button class="btn" style="font-size:12px;padding:2px 10px;border-color:#dc3545;color:#dc3545;" onclick="adminHideCommentDirect('${c.id}')">隐藏</button>`}
                <button class="btn" style="font-size:12px;padding:2px 10px;border-color:#dc3545;color:#dc3545;" onclick="adminDeleteComment('${c.id}')">删除</button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  await refresh();
  window._refreshCommentsPanel = refresh;
}

async function adminPostAsCharacter(postId) {
  const handle = document.querySelector('#cm-char-select').value;
  const content = document.querySelector('#cm-char-content').value.trim();
  if (!content) return showToast('请输入内容');

  const { error } = await db.from('comments').insert({
    post_id: postId,
    user_id: null,
    content: content,
    as_character: handle,
    status: 'visible'
  });

  if (error) return showToast('发布失败：' + error.message);
  showToast('已发布');
  document.querySelector('#cm-char-content').value = '';
  if (window._refreshCommentsPanel) await window._refreshCommentsPanel();
}

async function adminHideCommentDirect(commentId) {
  await db.from('comments').update({ status: 'hidden' }).eq('id', commentId);
  showToast('已隐藏');
  if (window._refreshCommentsPanel) await window._refreshCommentsPanel();
}

async function adminShowComment(commentId) {
  await db.from('comments').update({ status: 'visible' }).eq('id', commentId);
  showToast('已恢复');
  if (window._refreshCommentsPanel) await window._refreshCommentsPanel();
}

async function adminDeleteComment(commentId) {
  if (!confirm('确定永久删除这条评论吗？')) return;
  await db.from('comments').delete().eq('id', commentId);
  showToast('已删除');
  if (window._refreshCommentsPanel) await window._refreshCommentsPanel();
}

// ===== 帖子编辑器 =====
async function openPostEditor(postId, characterHandle, postType, defaultFaction) {
  let post = null;
  if (postId) {
    const { data } = await db.from('posts').select('*').eq('id', postId).single();
    post = data;
  }

  const isNew = !post;
  const p = post || {
    id: '',
    character: characterHandle || '',
    date: new Date().toISOString().slice(0, 10),
    tags: [],
    location: '',
    images: [],
    content: '',
    post_type: postType || 'main',
    faction: defaultFaction || '',
  };

  const modal = document.createElement('div');
  modal.id = 'post-editor-modal';
  modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9999;overflow-y:auto;padding:20px;box-sizing:border-box;';
  modal.innerHTML = `
    <div style="background:#fff;padding:20px;border-radius:12px;max-width:700px;margin:0 auto;box-sizing:border-box;">
      <h3 style="margin-bottom:16px;">${isNew ? '新建' : '编辑'} ${p.post_type === 'forum' ? '论坛' : '主页'}帖子</h3>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
        <div>
          <label style="font-size:12px;color:var(--muted);">帖子 ID</label>
          <input id="pe-id" type="text" value="${esc(p.id)}" ${isNew ? '' : 'disabled'} placeholder="如 2026-10-15-001" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:8px;margin-top:4px;">
        </div>
        <div>
          <label style="font-size:12px;color:var(--muted);">角色 handle</label>
          <input id="pe-character" type="text" value="${esc(p.character)}" placeholder="如 daniel / tt" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:8px;margin-top:4px;">
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
        <div>
          <label style="font-size:12px;color:var(--muted);">日期</label>
          <input id="pe-date" type="text" value="${esc(p.date)}" placeholder="YYYY-MM-DD" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:8px;margin-top:4px;">
        </div>
        <div>
          <label style="font-size:12px;color:var(--muted);">地点</label>
          <input id="pe-location" type="text" value="${esc(p.location)}" placeholder="如 红叶镇" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:8px;margin-top:4px;">
        </div>
      </div>

      <div style="margin-bottom:10px;">
        <label style="font-size:12px;color:var(--muted);">标签（英文逗号分隔）</label>
        <input id="pe-tags" type="text" value="${esc((p.tags || []).join(','))}" placeholder="日常,公告" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:8px;margin-top:4px;">
      </div>

      <div style="margin-bottom:10px;">
        <label style="font-size:12px;color:var(--muted);">图片路径（英文逗号分隔）</label>
        <input id="pe-images" type="text" value="${esc((p.images || []).join(','))}" placeholder="images/posts/b-1.webp" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:8px;margin-top:4px;">
      </div>

      ${p.post_type === 'forum' ? `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
          <div>
            <label style="font-size:12px;color:var(--muted);">阵营</label>
            <input id="pe-faction" type="text" value="${esc(p.faction)}" placeholder="精灵/矮人/人类/异人/240/246/240-1" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:8px;margin-top:4px;">
          </div>
          <div>
            <label style="font-size:12px;color:var(--muted);">节日（可空）</label>
            <input id="pe-event" type="text" value="${esc(p.event)}" placeholder="如 月亮节" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:8px;margin-top:4px;">
          </div>
        </div>
      ` : ''}

      <div style="margin-bottom:16px;">
        <label style="font-size:12px;color:var(--muted);">正文（Markdown）</label>
        <textarea id="pe-content" rows="12" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:8px;margin-top:4px;font-family:monospace;font-size:13px;resize:vertical;">${esc(p.content)}</textarea>
      </div>

      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn btn-primary" onclick="savePost('${isNew ? 'new' : 'edit'}', '${esc(p.post_type)}')">保存</button>
        ${!isNew ? `<button class="btn" style="border-color:#dc3545;color:#dc3545;" onclick="deletePost('${esc(p.id)}')">删除帖子</button>` : ''}
        <button class="btn" onclick="document.getElementById('post-editor-modal').remove()">取消</button>${!isNew ? `<button class="btn" onclick="openCommentsPanel('${esc(p.id)}')">评论管理</button>` : ''}
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

async function savePost(mode, postType) {
  const id = document.querySelector('#pe-id').value.trim();
  const character = document.querySelector('#pe-character').value.trim();
  const date = document.querySelector('#pe-date').value.trim();
  const location = document.querySelector('#pe-location').value.trim();
  const tagsRaw = document.querySelector('#pe-tags').value.trim();
  const imagesRaw = document.querySelector('#pe-images').value.trim();
  const content = document.querySelector('#pe-content').value;
  const factionEl = document.querySelector('#pe-faction');
  const eventEl = document.querySelector('#pe-event');

  if (!id) return showToast('请填写帖子 ID');
  if (!character) return showToast('请填写角色 handle');
  if (!content.trim()) return showToast('正文不能为空');

  const tags = tagsRaw ? tagsRaw.split(/[,，]/).map(s => s.trim()).filter(Boolean) : [];
  const images = imagesRaw ? imagesRaw.split(/[,，]/).map(s => s.trim()).filter(Boolean) : [];

  const payload = {
    id,
    character,
    date,
    location,
    tags,
    images,
    content,
    post_type: postType || 'main',
    faction: factionEl ? factionEl.value.trim() : '',
    event: eventEl ? eventEl.value.trim() : '',
  };

  let err;
  if (mode === 'new') {
    const { error } = await db.from('posts').insert(payload);
    err = error;
  } else {
    const { error } = await db.from('posts').update(payload).eq('id', id);
    err = error;
  }

  if (err) return showToast('保存失败：' + err.message);
  showToast('已保存');
  document.getElementById('post-editor-modal').remove();
  sessionStorage.removeItem('talk_data_cache_v2');
  renderContent();
}

async function deletePost(postId) {
  if (!confirm('确定删除帖子 ' + postId + ' 吗？此操作不可恢复。')) return;
  const { error } = await db.from('posts').delete().eq('id', postId);
  if (error) return showToast('删除失败：' + error.message);
  showToast('已删除');
  document.getElementById('post-editor-modal').remove();
  sessionStorage.removeItem('talk_data_cache_v2');
  renderContent();
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

// ===== 用户管理 =====
async function renderUsers() {
  const root = $('#admin-app');
  root.innerHTML = `
    <div class="card">
      <h3>用户管理</h3>
      <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;">
        <input id="user-search" type="text" placeholder="搜索昵称…" style="flex:1;min-width:180px;padding:10px;border:1px solid var(--border);border-radius:8px;">
        <button class="btn btn-primary" onclick="searchUsers()">搜索</button>
        <button class="btn" onclick="loadRecentUsers()">显示最近</button>
      </div>
    </div>
    <div id="user-list"></div>
  `;
  await loadRecentUsers();
}

async function loadRecentUsers() {
  const list = $('#user-list');
  list.innerHTML = '<div class="empty" style="padding:40px;text-align:center;">加载中…</div>';
  const { data, error } = await db.from('profiles')
    .select('id, username, faction, route, is_banned, created_at')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) { list.innerHTML = '<div class="empty">加载失败：' + esc(error.message) + '</div>'; return; }
  renderUserList(data || [], '最近 50 个用户');
}

async function searchUsers() {
  const q = $('#user-search').value.trim();
  if (!q) return loadRecentUsers();
  const list = $('#user-list');
  list.innerHTML = '<div class="empty" style="padding:40px;text-align:center;">搜索中…</div>';
  const { data, error } = await db.from('profiles')
    .select('id, username, faction, route, is_banned, created_at')
    .ilike('username', '%' + q + '%')
    .limit(50);
  if (error) { list.innerHTML = '<div class="empty">搜索失败：' + esc(error.message) + '</div>'; return; }
  renderUserList(data || [], '搜索「' + q + '」找到 ' + (data || []).length + ' 个');
}

function renderUserList(users, title) {
  const list = $('#user-list');
  if (!users.length) {
    list.innerHTML = `<div class="card"><div style="font-size:13px;color:var(--muted);">${esc(title)}</div><div class="empty" style="margin-top:8px;">没有用户</div></div>`;
    return;
  }
  list.innerHTML = `
    <div class="card" style="padding:10px 16px;"><div style="font-size:13px;color:var(--muted);">${esc(title)}</div></div>
    ${users.map(u => {
      const initial = (u.username || '?').slice(0, 1);
      const fac = u.faction ? factionIcon(u.faction) + ' ' : '';
      return `
        <div class="card" style="display:flex;align-items:center;gap:12px;">
          <div style="width:40px;height:40px;border-radius:50%;background:var(--primary-light);color:var(--primary-dark);display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0;">${esc(initial)}</div>
          <div style="flex:1;min-width:0;">
            <div style="font-weight:600;font-size:14px;">
              ${esc(u.username || '未命名')}
              ${u.is_banned ? '<span style="font-size:11px;background:#f5c2c7;color:#b02a37;padding:1px 6px;border-radius:10px;margin-left:6px;">已封禁</span>' : ''}
            </div>
            <div style="font-size:12px;color:var(--muted);margin-top:2px;">
              ${fac}${esc(u.route || '')} · 注册于 ${new Date(u.created_at).toLocaleDateString('zh-CN')}
            </div>
          </div>
          <div style="display:flex;gap:6px;flex-shrink:0;">
            <button class="btn" style="font-size:12px;padding:4px 10px;" onclick="showUserDetail('${u.id}')">详情</button>
            ${u.is_banned
              ? `<button class="btn" style="font-size:12px;padding:4px 10px;" onclick="toggleUserBan('${u.id}', false)">解封</button>`
              : `<button class="btn" style="font-size:12px;padding:4px 10px;border-color:#dc3545;color:#dc3545;" onclick="toggleUserBan('${u.id}', true)">封禁</button>`}
          </div>
        </div>
      `;
    }).join('')}
  `;
}

async function toggleUserBan(userId, banned) {
  const action = banned ? '封禁' : '解封';
  if (!confirm('确定要' + action + '该用户吗？')) return;
  const { error } = await db.from('profiles').update({ is_banned: banned }).eq('id', userId);
  if (error) return showToast(action + '失败：' + error.message);
  showToast('已' + action);
  const q = $('#user-search') ? $('#user-search').value.trim() : '';
  if (q) searchUsers(); else loadRecentUsers();
}

async function showUserDetail(userId) {
  const { data: p } = await db.from('profiles').select('id, username, faction, route, bio, location, is_banned, created_at').eq('id', userId).single();
  if (!p) return showToast('用户不存在');

  const [comments, messages, follows, bookmarks] = await Promise.all([
    db.from('comments').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    db.from('messages').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    db.from('follows').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    db.from('bookmarks').select('*', { count: 'exact', head: true }).eq('user_id', userId),
  ]);

  const detail = document.createElement('div');
  detail.id = 'user-detail-modal';
  detail.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;';
  detail.innerHTML = `
    <div style="background:#fff;padding:24px;border-radius:12px;width:100%;max-width:520px;max-height:85vh;overflow-y:auto;">
      <h3 style="margin-bottom:16px;">用户详情</h3>
      <div style="font-size:14px;line-height:2;">
        <div><b>昵称：</b>${esc(p.username || '未命名')}</div>
        <div><b>阵营：</b>${p.faction ? factionIcon(p.faction) + ' ' + esc(p.faction) : '中立'}</div>
        <div><b>航线：</b>${esc(p.route || '未选')}</div>
        <div><b>驻地：</b>${esc(p.location || '未填')}</div>
        <div><b>简介：</b>${esc(p.bio || '未填')}</div>
        <div><b>注册：</b>${new Date(p.created_at).toLocaleString('zh-CN')}</div>
        <div><b>状态：</b>${p.is_banned ? '<span style="color:#dc3545;">已封禁</span>' : '正常'}</div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:16px;">
        <div class="card" style="margin:0;text-align:center;padding:10px;"><div style="font-size:20px;font-weight:800;color:var(--primary-dark);">${comments.count || 0}</div><div style="font-size:12px;color:var(--muted);">评论</div></div>
        <div class="card" style="margin:0;text-align:center;padding:10px;"><div style="font-size:20px;font-weight:800;color:var(--primary-dark);">${messages.count || 0}</div><div style="font-size:12px;color:var(--muted);">私信</div></div>
        <div class="card" style="margin:0;text-align:center;padding:10px;"><div style="font-size:20px;font-weight:800;color:var(--primary-dark);">${follows.count || 0}</div><div style="font-size:12px;color:var(--muted);">关注角色</div></div>
        <div class="card" style="margin:0;text-align:center;padding:10px;"><div style="font-size:20px;font-weight:800;color:var(--primary-dark);">${bookmarks.count || 0}</div><div style="font-size:12px;color:var(--muted);">赞同</div></div>
      </div>
      <div style="display:flex;gap:8px;margin-top:20px;">
        ${p.is_banned
          ? `<button class="btn" style="flex:1;" onclick="toggleUserBan('${p.id}', false);document.getElementById('user-detail-modal').remove();">解封</button>`
          : `<button class="btn" style="flex:1;border-color:#dc3545;color:#dc3545;" onclick="toggleUserBan('${p.id}', true);document.getElementById('user-detail-modal').remove();">封禁</button>`}
        <button class="btn" style="flex:1;" onclick="document.getElementById('user-detail-modal').remove()">关闭</button>
      </div>
    </div>
  `;
  document.body.appendChild(detail);
}

// ===== 数据看板 =====
async function renderStats() {
  const root = $('#admin-app');
  root.innerHTML = '<div class="empty" style="padding:40px;text-align:center;">加载中…</div>';

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString();

  const [
    totalUsers, totalComments, totalMessages, totalFollows,
    todayUsers, todayComments, todayMessages, todayFollows, todayLikes, todayBookmarks
  ] = await Promise.all([
    db.from('profiles').select('*', { count: 'exact', head: true }),
    db.from('comments').select('*', { count: 'exact', head: true }),
    db.from('messages').select('*', { count: 'exact', head: true }),
    db.from('follows').select('*', { count: 'exact', head: true }),
    db.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', todayISO),
    db.from('comments').select('*', { count: 'exact', head: true }).gte('created_at', todayISO),
    db.from('messages').select('*', { count: 'exact', head: true }).gte('created_at', todayISO),
    db.from('follows').select('*', { count: 'exact', head: true }).gte('created_at', todayISO),
    db.from('likes').select('*', { count: 'exact', head: true }).gte('created_at', todayISO),
    db.from('bookmarks').select('*', { count: 'exact', head: true }).gte('created_at', todayISO),
  ]);

  const big = (label, n, icon) => `
    <div class="card" style="margin:0;padding:16px;">
      <div style="font-size:22px;margin-bottom:6px;">${icon}</div>
      <div style="font-size:28px;font-weight:800;color:var(--primary-dark);">${n}</div>
      <div style="font-size:12px;color:var(--muted);margin-top:4px;">${label}</div>
    </div>
  `;

  root.innerHTML = `
    <div class="card"><h3>数据看板</h3><p style="font-size:13px;color:var(--muted);margin-top:6px;">总共</p></div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;">
      ${big('用户', totalUsers.count || 0, '👥')}
      ${big('评论', totalComments.count || 0, '💬')}
      ${big('私信', totalMessages.count || 0, '✉️')}
      ${big('关注', totalFollows.count || 0, '⭐')}
    </div>
    <div class="card" style="margin-top:16px;"><h3>今日</h3></div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;">
      ${big('新用户', todayUsers.count || 0, '🆕')}
      ${big('新评论', todayComments.count || 0, '💬')}
      ${big('新私信', todayMessages.count || 0, '✉️')}
      ${big('新关注', todayFollows.count || 0, '⭐')}
      ${big('新点赞', todayLikes.count || 0, '♥')}
      ${big('新赞同', todayBookmarks.count || 0, '🔖')}
    </div>
  `;
}

// ===== 启动 =====
window.addEventListener('DOMContentLoaded', async () => {
  const ok = await checkAdmin();
  if (!ok) return;
  await router();
});
window.addEventListener('hashchange', router);
