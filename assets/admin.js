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
    const { data: chars } = await db.from('characters').select('*');
    CHARACTERS = {};
    (chars || []).forEach(c => {
      CHARACTERS[c.handle] = {
        handle: c.handle,
        name: c.name,
        nameEn: c.name_en || '',
        avatar: c.avatar || '',
        banner: c.banner || '',
        bio: c.bio || '',
        baseFollowers: c.base_followers || 0,
        following: c.following || 0,
        location: c.location || '',
        verified: c.verified || '',
        faction: c.faction || '',
        isNPC: c.is_npc || false,
        privacy: c.privacy || { follows: true, likes: true, bookmarks: true },
        follows: c.follows_list || [],
        likes: c.likes_list || [],
        bookmarks: c.bookmarks_list || [],
      };
    });
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
    { key: 'characters', icon: '🎭', text: '角色' },
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
  $('#admin-app').innerHTML = '<div class="empty" style="padding:40px;text-align:center;color:var(--muted);">⏳ 正在加载数据…</div>';
  if (cur === 'todo') return renderTodo();
  if (cur === 'inbox') return renderInbox();
  if (cur === 'content') return renderContent();
  if (cur === 'characters') return renderCharacters();
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

  const [inbox, reports, comments, users, roleReplies] = await Promise.all([
    db.from('messages').select('*', { count: 'exact', head: true }).eq('is_from_character', false).gte('created_at', todayISO),
    db.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    db.from('comments').select('*', { count: 'exact', head: true }).gte('created_at', todayISO),
    db.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', todayISO),
    // 查最近 50 条父评论是角色发的，且子评论是用户发的
    db.from('comments').select('id, content, parent_id, created_at')
      .not('parent_id', 'is', null)
      .eq('status', 'visible')
      .order('created_at', { ascending: false })
      .limit(50)
  ]);

  // 过滤出用户回复角色的评论（父评论的 as_character 不为空）
  let userReplyRoleCount = 0;
  if (roleReplies.data && roleReplies.data.length) {
    const parentIds = [...new Set(roleReplies.data.map(c => c.parent_id))];
    const { data: parents } = await db.from('comments').select('id, as_character').in('id', parentIds);
    const parentMap = {};
    (parents || []).forEach(p => { parentMap[p.id] = p; });
    
    // 统计有多少是用户回复了角色
    userReplyRoleCount = roleReplies.data.filter(c => parentMap[c.parent_id] && parentMap[c.parent_id].as_character).length;
  }

  const cards = [
    { icon: '✉️', label: '今日新私信', num: inbox.count || 0, href: '#inbox' },
    { icon: '🚨', label: '待处理举报', num: reports.count || 0, href: '#reports' },
    { icon: '💬', label: '今日新评论', num: comments.count || 0, href: '#content' }, // 跳转到内容管理
    { icon: '👥', label: '今日新用户', num: users.count || 0, href: '#users' },     // 跳转到用户管理
    { icon: '🎭', label: '待看：回复角色', num: userReplyRoleCount, href: '#content' }
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
    .limit(100);

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

// ===== 角色管理 =====
let _charAvatarTmp = '';
let _charFollowsTmp = [];
let _charLikesTmp = [];
let _charBookmarksTmp = [];
let _charBannerTmp = '';

let _allPostsCache = [];

async function renderCharacters() {
  const root = $('#admin-app');
  root.innerHTML = '<div class="empty" style="padding:40px;text-align:center;">加载中…</div>';

  const [charsRes, postsRes] = await Promise.all([
    db.from('characters').select('*').order('created_at'),
    db.from('posts').select('id, content, character').order('date', { ascending: false }).limit(500)
  ]);

  if (charsRes.error) { root.innerHTML = '<div class="empty">加载失败：' + esc(charsRes.error.message) + '</div>'; return; }

  const data = charsRes.data;
  _allPostsCache = postsRes.data || [];

  root.innerHTML = `
    <div class="card" style="padding:12px 16px;display:flex;justify-content:space-between;align-items:center;">
      <h3 style="margin:0;">角色管理</h3>
      <button class="btn btn-primary" onclick="openCharacterEditor(null)">+ 新建角色</button>
    </div>
    ${(data || []).length === 0 ? '<div class="card"><div class="empty">还没有角色</div></div>' :
      (data || []).map(c => {
        const initial = (c.name || '?').slice(0, 1);
        const fac = c.faction ? factionIcon(c.faction) + ' ' + c.faction : '中立';
        return `
          <div class="card" style="display:flex;align-items:center;gap:12px;">
            ${c.avatar
              ? `<img src="${esc(c.avatar)}" style="width:44px;height:44px;border-radius:50%;object-fit:cover;flex-shrink:0;">`
              : `<div style="width:44px;height:44px;border-radius:50%;background:var(--primary-light);color:var(--primary-dark);display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0;">${esc(initial)}</div>`}
            <div style="flex:1;min-width:0;">
              <div style="font-weight:600;font-size:14px;">
                ${esc(c.name)}
                ${c.verified ? `<span class="verified">✓ ${esc(c.verified)}</span>` : ''}
                ${c.is_npc ? '<span style="font-size:11px;background:var(--primary-light);color:var(--primary-dark);padding:1px 6px;border-radius:10px;margin-left:6px;">NPC</span>' : ''}
              </div>
              <div style="font-size:12px;color:var(--muted);margin-top:2px;">@${esc(c.handle)} · ${fac} · ${c.base_followers || 0} 粉丝</div>
            </div>
            <div style="display:flex;gap:6px;flex-shrink:0;">
              <button class="btn" style="font-size:12px;padding:4px 10px;" onclick='openCharacterEditor(${JSON.stringify(JSON.stringify(c))})'>编辑</button>
              <button class="btn" style="font-size:12px;padding:4px 10px;border-color:#dc3545;color:#dc3545;" onclick="deleteCharacter('${esc(c.handle)}')">删除</button>
            </div>
          </div>
        `;
      }).join('')}
  `;
}

function openCharacterEditor(jsonStr) {
  let c = null;
  if (jsonStr) {
    const raw = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
    c = typeof raw === 'string' ? JSON.parse(raw) : raw;
  }

  const isNew = !c;
  const p = c || {
    handle: '', name: '', name_en: '', avatar: '', banner: '', bio: '',
    base_followers: 0, following: 0, location: '', verified: '', faction: '',
    is_npc: false, privacy: { follows: true, likes: true, bookmarks: true }
  };

  _charAvatarTmp = p.avatar || '';
  _charBannerTmp = p.banner || '';
  _charFollowsTmp = [...(p.follows_list || [])];
  _charLikesTmp = [...(p.likes_list || [])];
  _charBookmarksTmp = [...(p.bookmarks_list || [])];
  const privacy = p.privacy || { follows: true, likes: true, bookmarks: true };

  const modal = document.createElement('div');
  modal.id = 'character-editor-modal';
  modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9999;overflow-y:auto;padding:20px;box-sizing:border-box;';
  modal.innerHTML = `
    <div style="background:#fff;padding:20px;border-radius:12px;max-width:700px;margin:0 auto;box-sizing:border-box;">
      <h3 style="margin-bottom:16px;">${isNew ? '新建角色' : '编辑角色 · ' + esc(p.name)}</h3>

      <div style="margin-bottom:12px;">
        <label style="font-size:12px;color:var(--muted);">背景图（Banner）</label>
        <div style="margin-top:6px;">
          <div id="ce-banner-box" style="width:100%;height:120px;border-radius:8px;background:${_charBannerTmp ? `url('${esc(_charBannerTmp)}') center/cover` : 'var(--bg)'};border:1px solid var(--border);"></div>
          <div style="margin-top:6px;display:flex;gap:6px;">
            <button class="btn" style="font-size:12px;padding:4px 10px;" onclick="pickCharacterImage('banner')">更换背景</button>
            <button class="btn" style="font-size:12px;padding:4px 10px;" onclick="clearCharacterImage('banner')">清除</button>
          </div>
        </div>
      </div>

      <div style="margin-bottom:12px;">
        <label style="font-size:12px;color:var(--muted);">头像</label>
        <div style="margin-top:6px;display:flex;align-items:center;gap:10px;">
          <div id="ce-avatar-box" style="width:72px;height:72px;border-radius:50%;overflow:hidden;background:var(--bg);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;">
            ${_charAvatarTmp ? `<img src="${esc(_charAvatarTmp)}" style="width:100%;height:100%;object-fit:cover;">` : '<span style="color:var(--muted);font-size:12px;">无</span>'}
          </div>
          <button class="btn" style="font-size:12px;padding:4px 10px;" onclick="pickCharacterImage('avatar')">更换头像</button>
          <button class="btn" style="font-size:12px;padding:4px 10px;" onclick="clearCharacterImage('avatar')">清除</button>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
        <div>
          <label style="font-size:12px;color:var(--muted);">handle（唯一标识，英文小写）</label>
          <input id="ce-handle" type="text" value="${esc(p.handle)}" ${isNew ? '' : 'disabled'} placeholder="如 daniel" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:8px;margin-top:4px;${isNew ? '' : 'background:#f5f5f5;'}">
        </div>
        <div>
          <label style="font-size:12px;color:var(--muted);">名字</label>
          <input id="ce-name" type="text" value="${esc(p.name)}" placeholder="如 布兰森·丹尼尔" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:8px;margin-top:4px;">
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
        <div>
          <label style="font-size:12px;color:var(--muted);">英文名</label>
          <input id="ce-name-en" type="text" value="${esc(p.name_en)}" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:8px;margin-top:4px;">
        </div>
        <div>
          <label style="font-size:12px;color:var(--muted);">认证文字（留空=不认证）</label>
          <input id="ce-verified" type="text" value="${esc(p.verified)}" placeholder="如 高级福灵" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:8px;margin-top:4px;">
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
        <div>
          <label style="font-size:12px;color:var(--muted);">阵营（留空=中立）</label>
          <select id="ce-faction" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:8px;margin-top:4px;background:#fff;">
            <option value="" ${p.faction === '' ? 'selected' : ''}>中立</option>
            <option value="精灵" ${p.faction === '精灵' ? 'selected' : ''}>🦌 精灵</option>
            <option value="矮人" ${p.faction === '矮人' ? 'selected' : ''}>⚒️ 矮人</option>
            <option value="人类" ${p.faction === '人类' ? 'selected' : ''}>⭐ 人类</option>
            <option value="异人" ${p.faction === '异人' ? 'selected' : ''}>🌲 异人</option>
            <option value="240" ${p.faction === '240' ? 'selected' : ''}>⚖️ 240</option>
            <option value="246" ${p.faction === '246' ? 'selected' : ''}>🔳 246</option>
            <option value="240-1" ${p.faction === '240-1' ? 'selected' : ''}>💥 240-1</option>
          </select>
        </div>
        <div>
          <label style="font-size:12px;color:var(--muted);">地点</label>
          <input id="ce-location" type="text" value="${esc(p.location)}" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:8px;margin-top:4px;">
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
        <div>
          <label style="font-size:12px;color:var(--muted);">基础粉丝数</label>
          <input id="ce-followers" type="number" value="${p.base_followers || 0}" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:8px;margin-top:4px;">
        </div>
        <div>
          <label style="font-size:12px;color:var(--muted);">是否 NPC</label>
          <label style="display:flex;align-items:center;gap:6px;margin-top:10px;font-size:14px;">
            <input id="ce-is-npc" type="checkbox" ${p.is_npc ? 'checked' : ''}> 是 NPC（不参与用户互动）
          </label>
        </div>
      </div>

      <div style="margin-bottom:12px;">
        <label style="font-size:12px;color:var(--muted);">简介</label>
        <textarea id="ce-bio" rows="3" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:8px;margin-top:4px;font-family:inherit;resize:vertical;">${esc(p.bio)}</textarea>
      </div>

      <div style="margin-bottom:16px;">
        <label style="font-size:12px;color:var(--muted);">隐私设置（是否公开）</label>
        <div style="display:flex;gap:16px;margin-top:8px;font-size:14px;">
          <label><input type="checkbox" id="ce-p-follows" ${privacy.follows ? 'checked' : ''}> 关注列表</label>
          <label><input type="checkbox" id="ce-p-likes" ${privacy.likes ? 'checked' : ''}> 点赞列表</label>
          <label><input type="checkbox" id="ce-p-bookmarks" ${privacy.bookmarks ? 'checked' : ''}> 收藏列表</label>
        </div>
      </div>

      <details style="margin-bottom:12px;padding:10px;border:1px solid var(--border);border-radius:8px;">
        <summary style="cursor:pointer;font-weight:600;font-size:14px;">关注列表 <span id="ce-follows-count" style="color:var(--muted);font-weight:400;">(${_charFollowsTmp.length})</span></summary>
        <input type="text" placeholder="搜索角色…" oninput="filterList('ce-follows-list', this.value)" style="width:100%;padding:6px;border:1px solid var(--border);border-radius:6px;margin:8px 0 6px;font-size:13px;box-sizing:border-box;">
        <div id="ce-follows-list" style="max-height:240px;overflow-y:auto;">
          ${Object.values(CHARACTERS).filter(c => c.handle !== p.handle).map(c => `
            <label style="display:flex;align-items:center;gap:8px;padding:4px;font-size:13px;cursor:pointer;">
              <input type="checkbox" ${_charFollowsTmp.includes(c.handle) ? 'checked' : ''} onchange="toggleFollowItem('${c.handle}', this.checked)">
              ${factionIcon(c.faction)} ${esc(c.name)} <span style="color:var(--muted);font-size:11px;">@${esc(c.handle)}</span>
            </label>
          `).join('') || '<div style="font-size:13px;color:var(--muted);">没有其他角色</div>'}
        </div>
      </details>

      <details style="margin-bottom:12px;padding:10px;border:1px solid var(--border);border-radius:8px;">
        <summary style="cursor:pointer;font-weight:600;font-size:14px;">点赞列表 <span id="ce-likes-count" style="color:var(--muted);font-weight:400;">(${_charLikesTmp.length})</span></summary>
        <input type="text" placeholder="搜索帖子…" oninput="filterList('ce-likes-list', this.value)" style="width:100%;padding:6px;border:1px solid var(--border);border-radius:6px;margin:8px 0 6px;font-size:13px;box-sizing:border-box;">
        <div id="ce-likes-list" style="max-height:240px;overflow-y:auto;">
          ${_allPostsCache.map(p2 => {
            const ch = CHARACTERS[p2.character] || { name: p2.character };
            const preview = p2.content.slice(0, 60).replace(/\n/g, ' ');
            return `
              <label style="display:flex;align-items:flex-start;gap:8px;padding:4px;font-size:13px;cursor:pointer;">
                <input type="checkbox" ${_charLikesTmp.includes(p2.id) ? 'checked' : ''} onchange="toggleLikeItem('${p2.id}', this.checked)" style="margin-top:3px;">
                <span><b>${esc(ch.name)}</b> · ${esc(preview)}</span>
              </label>
            `;
          }).join('') || '<div style="font-size:13px;color:var(--muted);">没有帖子</div>'}
        </div>
      </details>

      <details style="margin-bottom:12px;padding:10px;border:1px solid var(--border);border-radius:8px;">
        <summary style="cursor:pointer;font-weight:600;font-size:14px;">收藏列表 <span id="ce-bookmarks-count" style="color:var(--muted);font-weight:400;">(${_charBookmarksTmp.length})</span></summary>
        <input type="text" placeholder="搜索帖子…" oninput="filterList('ce-bookmarks-list', this.value)" style="width:100%;padding:6px;border:1px solid var(--border);border-radius:6px;margin:8px 0 6px;font-size:13px;box-sizing:border-box;">
        <div id="ce-bookmarks-list" style="max-height:240px;overflow-y:auto;">
          ${_allPostsCache.map(p2 => {
            const ch = CHARACTERS[p2.character] || { name: p2.character };
            const preview = p2.content.slice(0, 60).replace(/\n/g, ' ');
            return `
              <label style="display:flex;align-items:flex-start;gap:8px;padding:4px;font-size:13px;cursor:pointer;">
                <input type="checkbox" ${_charBookmarksTmp.includes(p2.id) ? 'checked' : ''} onchange="toggleBookmarkItem('${p2.id}', this.checked)" style="margin-top:3px;">
                <span><b>${esc(ch.name)}</b> · ${esc(preview)}</span>
              </label>
            `;
          }).join('') || '<div style="font-size:13px;color:var(--muted);">没有帖子</div>'}
        </div>
      </details>

      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn btn-primary" onclick="saveCharacter('${isNew ? 'new' : 'edit'}')">保存</button>
        <button class="btn" onclick="document.getElementById('character-editor-modal').remove()">取消</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function pickCharacterImage(type) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/jpeg,image/png,image/webp';
  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;
    try {
      const maxW = type === 'avatar' ? 400 : 1200;
      const maxH = type === 'avatar' ? 400 : 400;
      const blob = await compressImage(file, maxW, maxH, 0.8);
      const path = `characters/${type}s/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;
      const { error } = await db.storage.from('post-images').upload(path, blob, { contentType: 'image/webp' });
      if (error) throw error;
      const { data: { publicUrl } } = db.storage.from('post-images').getPublicUrl(path);
      if (type === 'avatar') {
        _charAvatarTmp = publicUrl;
        document.getElementById('ce-avatar-box').innerHTML = `<img src="${esc(publicUrl)}" style="width:100%;height:100%;object-fit:cover;">`;
      } else {
        _charBannerTmp = publicUrl;
        document.getElementById('ce-banner-box').style.background = `url('${publicUrl}') center/cover`;
      }
      showToast('已上传');
    } catch (e) {
      showToast('上传失败：' + (e.message || '未知错误'));
    }
  };
  input.click();
}

function clearCharacterImage(type) {
  if (type === 'avatar') {
    _charAvatarTmp = '';
    document.getElementById('ce-avatar-box').innerHTML = '<span style="color:var(--muted);font-size:12px;">无</span>';
  } else {
    _charBannerTmp = '';
    document.getElementById('ce-banner-box').style.background = 'var(--bg)';
  }
}

function toggleFollowItem(handle, checked) {
  if (checked) {
    if (!_charFollowsTmp.includes(handle)) _charFollowsTmp.push(handle);
  } else {
    _charFollowsTmp = _charFollowsTmp.filter(h => h !== handle);
  }
  document.getElementById('ce-follows-count').textContent = '(' + _charFollowsTmp.length + ')';
}

function toggleLikeItem(postId, checked) {
  if (checked) {
    if (!_charLikesTmp.includes(postId)) _charLikesTmp.push(postId);
  } else {
    _charLikesTmp = _charLikesTmp.filter(id => id !== postId);
  }
  document.getElementById('ce-likes-count').textContent = '(' + _charLikesTmp.length + ')';
}

function toggleBookmarkItem(postId, checked) {
  if (checked) {
    if (!_charBookmarksTmp.includes(postId)) _charBookmarksTmp.push(postId);
  } else {
    _charBookmarksTmp = _charBookmarksTmp.filter(id => id !== postId);
  }
  document.getElementById('ce-bookmarks-count').textContent = '(' + _charBookmarksTmp.length + ')';
}

function filterList(listId, q) {
  const list = document.getElementById(listId);
  if (!list) return;
  const lower = q.toLowerCase();
  list.querySelectorAll('label').forEach(lbl => {
    lbl.style.display = lbl.textContent.toLowerCase().includes(lower) ? '' : 'none';
  });
}

async function saveCharacter(mode) {
  const handle = document.querySelector('#ce-handle').value.trim();
  const name = document.querySelector('#ce-name').value.trim();
  if (!handle) return showToast('请填写 handle');
  if (!name) return showToast('请填写名字');
  if (!/^[a-z0-9\-]+$/.test(handle)) return showToast('handle 只能用小写字母、数字、短横线');

  const payload = {
    handle,
    name,
    name_en: document.querySelector('#ce-name-en').value.trim(),
    avatar: _charAvatarTmp,
    banner: _charBannerTmp,
    bio: document.querySelector('#ce-bio').value,
    base_followers: parseInt(document.querySelector('#ce-followers').value) || 0,
    location: document.querySelector('#ce-location').value.trim(),
    verified: document.querySelector('#ce-verified').value.trim(),
    faction: document.querySelector('#ce-faction').value,
    is_npc: document.querySelector('#ce-is-npc').checked,
    privacy: {
      follows: document.querySelector('#ce-p-follows').checked,
      likes: document.querySelector('#ce-p-likes').checked,
      bookmarks: document.querySelector('#ce-p-bookmarks').checked
    },
    follows_list: _charFollowsTmp,
    likes_list: _charLikesTmp,
    bookmarks_list: _charBookmarksTmp,
  };

  let err;
  if (mode === 'new') {
    const { error } = await db.from('characters').insert(payload);
    err = error;
  } else {
    const { error } = await db.from('characters').update(payload).eq('handle', handle);
    err = error;
  }

  if (err) return showToast('保存失败：' + err.message);
  showToast('已保存');
  document.getElementById('character-editor-modal').remove();
  sessionStorage.removeItem('talk_data_cache_v2');
  localStorage.setItem('talk_data_version', Date.now().toString());
  renderCharacters();
}

async function deleteCharacter(handle) {
  const { count: postCount } = await db.from('posts').select('*', { count: 'exact', head: true }).eq('character', handle);
  const msg = (postCount > 0)
    ? `该角色有 ${postCount} 条帖子，删除后这些帖子的作者会显示成未知角色。\n\n确定删除「${handle}」吗？`
    : `确定删除角色「${handle}」吗？`;
  if (!confirm(msg)) return;

  const { error } = await db.from('characters').delete().eq('handle', handle);
  if (error) return showToast('删除失败：' + error.message);
  showToast('已删除');
  sessionStorage.removeItem('talk_data_cache_v2');
  localStorage.setItem('talk_data_version', Date.now().toString());
  renderCharacters();
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

  // 关键：以所有角色为准，没帖子的显示 0 条
  const allChars = Object.keys(CHARACTERS).sort();

  body.innerHTML = `
    <div class="card" style="padding:12px 16px;">
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
        <span style="font-size:13px;color:var(--muted);">角色：</span>
        <button class="btn ${contentFilter===''?'btn-primary':''}" style="padding:4px 12px;font-size:13px;" onclick="filterContent('')">全部</button>
        ${allChars.map(h => {
          const c = CHARACTERS[h] || {};
          const cnt = (grouped[h] || []).length;
          return `<button class="btn ${contentFilter===h?'btn-primary':''}" style="padding:4px 12px;font-size:13px;" onclick="filterContent('${h}')">${esc(c.name || h)} (${cnt})</button>`;
        }).join('')}
      </div>
    </div>
    <div id="content-list">
      ${renderMainPostsList(grouped, allChars)}
    </div>
  `;
}

function filterContent(handle) {
  contentFilter = handle;
  renderContent();
}

function renderMainPostsList(grouped, allChars) {
  const keys = contentFilter ? [contentFilter] : allChars;
  if (!keys.length) return '<div class="card"><div class="empty">还没有角色</div></div>';

  return keys.map(handle => {
    const c = CHARACTERS[handle] || { name: handle };
    const list = grouped[handle] || [];
    return `
      <div class="card" style="padding:12px 16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <div style="font-weight:700;font-size:15px;">
            ${factionIcon(c.faction)} ${esc(c.name)} <span style="font-size:12px;color:var(--muted);font-weight:400;">(@${esc(handle)} · ${list.length} 条)</span>
          </div>
          <button class="btn" style="padding:4px 10px;font-size:12px;" onclick="openPostEditor('', '${handle}', 'main')">+ 新建</button>
        </div>
        ${list.length === 0
          ? '<div style="font-size:13px;color:var(--muted);padding:8px 0;">还没有帖子</div>'
          : list.map(p => `
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

async function openCommentsPanel(postId) {
  let replyToId = null;
  let filterMode = 'all';

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

    const userIds = [...new Set((comments || []).filter(c => !c.as_character && c.user_id).map(c => c.user_id))];
    const profileMap = {};
    if (userIds.length) {
      const { data: profs } = await db.from('profiles').select('id, username').in('id', userIds);
      (profs || []).forEach(p => { profileMap[p.id] = p; });
    }

    let visible = (comments || []).filter(c => c.status !== 'hidden');
    if (filterMode === 'role') visible = visible.filter(c => c.as_character);
    if (filterMode === 'user') visible = visible.filter(c => !c.as_character);

    const allVisible = (comments || []).filter(c => c.status !== 'hidden');
    const hiddenCount = (comments || []).length - allVisible.length;

    // 平铺构建
    const childrenMap = {};
    visible.forEach(c => {
      if (c.parent_id) {
        if (!childrenMap[c.parent_id]) childrenMap[c.parent_id] = [];
        childrenMap[c.parent_id].push(c);
      }
    });

    function collectDescendants(commentId, result = []) {
      if (childrenMap[commentId]) {
        childrenMap[commentId].forEach(child => {
          result.push(child);
          collectDescendants(child.id, result);
        });
      }
      return result;
    }

    function renderOne(c, isReply) {
      let name, avatar, isRole = !!c.as_character;
      if (isRole) {
        const ch = CHARACTERS[c.as_character] || { name: c.as_character };
        name = ch.name + '（角色）';
        avatar = factionIcon(ch.faction) || '🎭';
      } else {
        const p = profileMap[c.user_id] || {};
        name = p.username || '匿名';
        avatar = '👤';
      }
      const hidden = c.status === 'hidden';
      const isReplying = replyToId === c.id;

      return `
        <div style="padding:10px;border-radius:8px;background:${hidden ? '#f5c2c7' : (isRole ? '#f3eaff' : 'var(--bg)')};margin-bottom:8px;${isReply ? 'margin-left:24px;border-left:2px solid var(--border);' : ''}">
          <div style="font-size:12px;color:var(--muted);margin-bottom:4px;">
            ${avatar} ${esc(name)} · ${new Date(c.created_at).toLocaleString('zh-CN')}
            ${hidden ? ' · <span style="color:#b02a37;">已隐藏</span>' : ''}
          </div>
          <div style="font-size:13px;margin-bottom:8px;word-break:break-word;">${esc(c.content)}</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button class="btn" style="font-size:12px;padding:2px 10px;" onclick="adminStartReply('${c.id}')">回复</button>
            ${hidden
              ? `<button class="btn" style="font-size:12px;padding:2px 10px;" onclick="adminShowComment('${c.id}')">恢复显示</button>`
              : `<button class="btn" style="font-size:12px;padding:2px 10px;border-color:#dc3545;color:#dc3545;" onclick="adminHideCommentDirect('${c.id}')">隐藏</button>`}
            <button class="btn" style="font-size:12px;padding:2px 10px;border-color:#dc3545;color:#dc3545;" onclick="adminDeleteComment('${c.id}')">删除</button>
          </div>
          ${isReplying ? `
            <div style="margin-top:10px;padding:10px;background:#fff;border:1px solid var(--border);border-radius:8px;">
              <div style="font-size:12px;color:var(--muted);margin-bottom:6px;">以角色身份回复：</div>
              <div style="display:flex;gap:6px;flex-wrap:wrap;">
                <select id="reply-char-${c.id}" style="padding:6px;border:1px solid var(--border);border-radius:6px;background:#fff;font-size:13px;">
                  ${Object.values(CHARACTERS).map(ch => `<option value="${ch.handle}">${esc(ch.name)}</option>`).join('')}
                </select>
                <input id="reply-content-${c.id}" type="text" placeholder="回复内容…" maxlength="500" style="flex:1;min-width:200px;padding:6px;border:1px solid var(--border);border-radius:6px;font-size:13px;">
                <button class="btn btn-primary" style="font-size:13px;" onclick="adminSubmitReply('${postId}', '${c.id}')">发送</button>
                <button class="btn" style="font-size:13px;" onclick="adminCancelReply()">取消</button>
              </div>
            </div>
          ` : ''}
        </div>
      `;
    }

    let listHTML = '';
    const roots = visible.filter(c => !c.parent_id);
    roots.forEach(root => {
      listHTML += renderOne(root, false);
      const descendants = collectDescendants(root.id);
      descendants.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      descendants.forEach(desc => {
        listHTML += renderOne(desc, true);
      });
    });

    modal.innerHTML = `
      <div style="background:#fff;padding:20px;border-radius:12px;max-width:700px;margin:0 auto;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <h3 style="margin:0;">评论管理 · 帖子 ${esc(postId)}</h3>
          <button class="btn" onclick="document.getElementById('comments-panel-modal').remove()">关闭</button>
        </div>

        <div style="padding:12px;background:var(--primary-light);border-radius:8px;margin-bottom:16px;">
          <div style="font-size:13px;font-weight:600;margin-bottom:8px;">以角色身份发评论（顶层）</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
            <select id="cm-char-select" style="padding:8px;border:1px solid var(--border);border-radius:8px;background:#fff;">
              ${Object.values(CHARACTERS).map(c => `<option value="${c.handle}">${esc(c.name)}${c.verified ? ' ✓' : ''}</option>`).join('')}
            </select>
            <input id="cm-char-content" type="text" placeholder="以角色身份写评论…" maxlength="500" style="flex:1;min-width:200px;padding:8px;border:1px solid var(--border);border-radius:8px;">
            <button class="btn btn-primary" onclick="adminPostAsCharacter('${postId}')">发布</button>
          </div>
        </div>

        <div style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap;">
          <button class="btn ${filterMode==='all'?'btn-primary':''}" style="font-size:12px;padding:4px 12px;" onclick="adminSetCommentFilter('all')">全部</button>
          <button class="btn ${filterMode==='role'?'btn-primary':''}" style="font-size:12px;padding:4px 12px;" onclick="adminSetCommentFilter('role')">只看角色</button>
          <button class="btn ${filterMode==='user'?'btn-primary':''}" style="font-size:12px;padding:4px 12px;" onclick="adminSetCommentFilter('user')">只看用户</button>
          <span style="font-size:12px;color:var(--muted);margin-left:auto;">${allVisible.length} 条可见 · ${hiddenCount} 条已隐藏</span>
        </div>

        <div id="comments-list-container">
          ${listHTML || '<div class="empty">没有评论</div>'}
        </div>
      </div>
    `;
  }

  window._refreshCommentsPanel = refresh;
  window._setCommentFilter = (mode) => { filterMode = mode; refresh(); };
  window._startReply = (id) => { replyToId = id; refresh(); };
  window._cancelReply = () => { replyToId = null; refresh(); };

  await refresh();
}

function adminSetCommentFilter(mode) {
  if (window._setCommentFilter) window._setCommentFilter(mode);
}

function adminStartReply(commentId) {
  if (window._startReply) window._startReply(commentId);
}

function adminCancelReply() {
  if (window._cancelReply) window._cancelReply();
}

async function adminSubmitReply(postId, parentId) {
  const handle = document.querySelector(`#reply-char-${parentId}`).value;
  const content = document.querySelector(`#reply-content-${parentId}`).value.trim();
  if (!content) return showToast('请输入回复内容');

  const { data: newComment, error } = await db.from('comments').insert({
    post_id: postId,
    user_id: null,
    content: content,
    as_character: handle,
    parent_id: parentId,
    status: 'visible'
  }).select('id').single();

  if (error) return showToast('回复失败：' + error.message);

  // 通知被回复的用户
  const { data: parentComment } = await db.from('comments').select('user_id').eq('id', parentId).single();
  if (parentComment && parentComment.user_id) {
    await db.from('notifications').insert({
      user_id: parentComment.user_id,
      type: 'reply_comment',
      target_id: newComment.id,
      is_read: false
    });
  }
  showToast('已回复');
  if (window._cancelReply) window._cancelReply();
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

// ===== 图片上传到 Supabase Storage =====
async function uploadPostImage(file) {
  // 压缩到 800px 宽，质量 0.8
  const blob = await compressImage(file, 800, 1200, 0.8);
  const path = `posts/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;
  const { error } = await db.storage.from('post-images').upload(path, blob, {
    contentType: 'image/webp',
    upsert: false
  });
  if (error) throw error;
  const { data: { publicUrl } } = db.storage.from('post-images').getPublicUrl(path);
  return publicUrl;
}

// 前端压缩（Canvas → WebP）
function compressImage(file, maxW, maxH, quality) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      const ratio = Math.min(maxW / width, maxH / height, 1);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(b => b ? resolve(b) : reject(new Error('压缩失败')), 'image/webp', quality);
    };
    img.onerror = () => reject(new Error('图片读取失败'));
    img.src = URL.createObjectURL(file);
  });
}

// 触发文件选择
function pickImages(callback) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/jpeg,image/png,image/webp';
  input.multiple = true;
  input.onchange = async () => {
    const files = Array.from(input.files || []);
    if (!files.length) return;
    for (const f of files) {
      try {
        const url = await uploadPostImage(f);
        callback(url);
      } catch (e) {
        showToast('上传失败：' + (e.message || '未知错误'));
      }
    }
  };
  input.click();
}

// 图片列表渲染
function renderImageList(images) {
  if (!images.length) return '<div style="font-size:12px;color:var(--muted);">还没有图片</div>';
  return `<div style="display:flex;gap:8px;flex-wrap:wrap;">${images.map((url, i) => `
    <div style="position:relative;width:100px;height:100px;border-radius:8px;overflow:hidden;background:var(--bg);">
      <img src="${esc(url)}" style="width:100%;height:100%;object-fit:cover;">
      <button onclick="removeImage(${i})" style="position:absolute;top:2px;right:2px;width:22px;height:22px;border-radius:50%;background:rgba(0,0,0,0.6);color:#fff;border:none;cursor:pointer;font-size:14px;line-height:1;">×</button>
    </div>
  `).join('')}</div>`;
}

let _editorImages = [];

function removeImage(index) {
  _editorImages.splice(index, 1);
  const el = document.getElementById('pe-image-list');
  if (el) el.innerHTML = renderImageList(_editorImages);
}

function addImageToEditor(url) {
  _editorImages.push(url);
  const el = document.getElementById('pe-image-list');
  if (el) el.innerHTML = renderImageList(_editorImages);
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
        <label style="font-size:12px;color:var(--muted);">图片（点按钮上传，可多张）</label>
        <div id="pe-image-list" style="margin-top:6px;">${renderImageList(p.images || [])}</div>
        <button class="btn" type="button" style="margin-top:8px;font-size:13px;padding:4px 12px;" onclick="pickImages(addImageToEditor)">+ 上传图片</button>
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
  _editorImages = [...(p.images || [])];
  document.body.appendChild(modal);
}

async function savePost(mode, postType) {
  const $id = document.querySelector('#pe-id');
  const $char = document.querySelector('#pe-character');
  const $date = document.querySelector('#pe-date');
  const $loc = document.querySelector('#pe-location');
  const $tags = document.querySelector('#pe-tags');
  const $content = document.querySelector('#pe-content');
  const $faction = document.querySelector('#pe-faction');
  const $event = document.querySelector('#pe-event');

  if (!$id || !$char || !$content) return showToast('表单异常，请关闭重开');

  const id = $id.value.trim();
  const character = $char.value.trim();
  const date = $date ? $date.value.trim() : '';
  const location = $loc ? $loc.value.trim() : '';
  const tagsRaw = $tags ? $tags.value.trim() : '';
  const content = $content.value;
  const faction = $faction ? $faction.value.trim() : '';
  const event = $event ? $event.value.trim() : '';

  if (!id) return showToast('请填写帖子 ID');
  if (!character) return showToast('请填写角色 handle');
  if (!content.trim()) return showToast('正文不能为空');

  const tags = tagsRaw ? tagsRaw.split(/[,，]/).map(s => s.trim()).filter(Boolean) : [];
  const images = [..._editorImages];

  const payload = {
    id,
    character,
    date,
    location,
    tags,
    images,
    content,
    post_type: postType || 'main',
    faction,
    event,
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
  localStorage.setItem('talk_data_version', Date.now().toString());
  renderContent();
}

async function deletePost(postId) {
  if (!confirm('确定删除帖子 ' + postId + ' 吗？此操作不可恢复。')) return;
  const { error } = await db.from('posts').delete().eq('id', postId);
  if (error) return showToast('删除失败：' + error.message);
  showToast('已删除');
  document.getElementById('post-editor-modal').remove();
  sessionStorage.removeItem('talk_data_cache_v2');
  localStorage.setItem('talk_data_version', Date.now().toString());
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
