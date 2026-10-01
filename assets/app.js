// ===== 1. 初始化 Supabase =====
const SUPABASE_URL = 'https://nsoyywbuqpfhhrezdcly.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zb3l5d2J1cXBmaGhyZXpkY2x5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4MzMyODIsImV4cCI6MjEwNjQwOTI4Mn0.L17d0locmWHjQFykzv9bTjTyLZAk8LDyfSmpxbEnTgg';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===== 2. 全局变量 =====
let currentUser = null;
let currentProfile = null;

// ===== 3. 工具函数 =====
function $(sel, root = document) { return root.querySelector(sel); }
function $$(sel, root = document) { return [...root.querySelectorAll(sel)]; }
function showToast(msg) {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id='toast'; t.className='toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._timer); t._timer = setTimeout(()=>t.classList.remove('show'), 2000);
}
function parseFrontMatter(text) {
  const cleanText = text.replace(/\\/g, '');
  const m = cleanText.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!m) return { data: {}, content: cleanText };
  const data = {};
  m[1].split('\n').forEach(line => {
    const idx = line.indexOf(':');
    if (idx < 0) return;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if (val.startsWith('[') && val.endsWith(']')) {
      val = val.slice(1, -1).split(',').map(s => s.trim()).filter(Boolean);
    }
    data[key] = val;
  });
  return { data, content: m[2] };
}
function renderMarkdown(md) {
  let html = md.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  return html.split(/\n\n+/).map(p => '<p>'+p.replace(/\n/g,'<br>')+'</p>').join('');
}
function avatarHTML(char, size = '') {
  const cls = 'avatar' + (size ? ' ' + size : '');
  const ch = (char && char.name) ? char.name.slice(0, 1) : '?';
  const img = char && char.avatar ? `<img src="${char.avatar}" alt="" onerror="this.style.display='none';this.parentNode.textContent='${ch}'">` : ch;
  return `<div class="${cls}">${img}</div>`;
}

// ===== 4. 认证相关 =====
async function checkUser() {
  const { data: { user } } = await db.auth.getUser();
  currentUser = user;
  if (user) {
    const { data: profile } = await db.from('profiles').select('*').eq('id', user.id).single();
    currentProfile = profile;
    if (!profile) {
      // 没有profile，说明刚注册，需要选阵营
      openFactionModal();
    } else {
      updateUIForLoggedIn();
    }
  } else {
    updateUIForLoggedOut();
  }
}
function updateUIForLoggedIn() {
  const actions = $('.topbar-actions');
  if (actions && currentProfile) {
    actions.innerHTML = `
      <span style="font-size:14px;font-weight:600;">[${currentProfile.faction}] ${currentProfile.username || '用户'}</span>
      <button class="btn" onclick="handleLogout()">退出</button>
    `;
  }
}
function updateUIForLoggedOut() {
  const actions = $('.topbar-actions');
  if (actions) {
    actions.innerHTML = `
      <button class="btn" onclick="openAuthModal()">登录</button>
      <button class="btn btn-primary" onclick="openAuthModal()">注册</button>
    `;
  }
}
function openAuthModal() { $('#auth-modal').style.display = 'flex'; }
function closeAuthModal() { $('#auth-modal').style.display = 'none'; }
function openFactionModal() { $('#faction-modal').style.display = 'flex'; }

async function handleLogin() {
  const email = $('#auth-email').value;
  const password = $('#auth-password').value;
  if (!email || !password) return showToast('请填写邮箱和密码');
  const { error } = await db.auth.signInWithPassword({ email, password });
  if (error) return showToast('登录失败：' + error.message);
  showToast('登录成功！');
  closeAuthModal();
  checkUser();
}

async function handleRegister() {
  const email = $('#auth-email').value;
  const password = $('#auth-password').value;
  if (!email || !password || password.length < 6) return showToast('密码至少6位');
  const { error } = await db.auth.signUp({ email, password });
  if (error) return showToast('注册失败：' + error.message);
  showToast('注册成功！请选择阵营');
  closeAuthModal();
  checkUser();
}

async function handleLogout() {
  await db.auth.signOut();
  currentUser = null; currentProfile = null;
  showToast('已退出');
  updateUIForLoggedOut();
}

async function chooseFaction(faction) {
  if (!currentUser) return;
  const username = prompt('请输入你的昵称：') || '新用户';
  const { error } = await db.from('profiles').insert({
    id: currentUser.id,
    username: username,
    faction: faction
  });
  if (error) return showToast('选阵营失败：' + error.message);
  showToast('欢迎加入 ' + faction + ' 阵营！');
  $('#faction-modal').style.display = 'none';
  checkUser();
}

// ===== 5. 数据加载与渲染 =====
let CHARACTERS = {};
let POSTS = [];
async function loadData() {
  const [cRes, pRes] = await Promise.all([fetch('data/characters.json'), fetch('posts/posts.json')]);
  CHARACTERS = await cRes.json();
  const list = (await pRes.json()).posts;
  POSTS = await Promise.all(list.map(async p => {
    const r = await fetch(p.file);
    const text = await r.text();
    const { data, content } = parseFrontMatter(text);
    return { id: p.id, ...data, content };
  }));
  POSTS.sort((a,b) => (b.date || '').localeCompare(a.date || ''));
}

async function renderPostCard(post) {
  const char = CHARACTERS[post.character] || { name: post.character || '未知角色', handle: post.character || 'unknown' };
  const tags = (post.tags || []).map(t => `<a class="tag" href="#">#${t}</a>`).join('');
  const verified = char.verified ? `<span class="verified">✓ ${char.verified}</span>` : '';
  // 获取点赞数
  const { count: likeCount } = await db.from('likes').select('*', { count: 'exact', head: true }).eq('post_id', post.id);
  // 获取评论数
  const { count: commentCount } = await db.from('comments').select('*', { count: 'exact', head: true }).eq('post_id', post.id).eq('status', 'visible');
  // 是否已点赞
  let isLiked = false;
  if (currentUser) {
    const { data: likeData } = await db.from('likes').select('id').eq('post_id', post.id).eq('user_id', currentUser.id).single();
    isLiked = !!likeData;
  }
  return `
    <article class="post" data-id="${post.id}">
      <div class="post-header">
        ${avatarHTML(char)}
        <div class="post-meta">
          <div class="post-name"><a href="character.html?handle=${char.handle}">${char.name}</a>${verified}</div>
          <div class="post-sub">@${char.handle} · ${post.date || ''}${post.location ? ' · 📍'+post.location : ''}</div>
        </div>
      </div>
      <div class="post-body">${renderMarkdown(post.content)}</div>
      <div class="post-tags">${tags}</div>
      <div class="post-actions">
        <button class="action ${isLiked ? 'liked' : ''}" onclick="toggleLike('${post.id}', this)">♡ <span>${likeCount || 0}</span></button>
        <button class="action" onclick="showToast('评论功能在下一版上线')">💬 <span>${commentCount || 0}</span></button>
        <button class="action" onclick="showToast('请先登录')">🔖 <span>收藏</span></button>
      </div>
    </article>
  `;
}

async function toggleLike(postId, btn) {
  if (!currentUser) return showToast('请先登录');
  const span = btn.querySelector('span');
  const isLiked = btn.classList.contains('liked');
  if (isLiked) {
    await db.from('likes').delete().eq('post_id', postId).eq('user_id', currentUser.id);
    btn.classList.remove('liked');
    span.textContent = Math.max(0, parseInt(span.textContent) - 1);
  } else {
    await db.from('likes').insert({ post_id: postId, user_id: currentUser.id });
    btn.classList.add('liked');
    span.textContent = parseInt(span.textContent) + 1;
  }
}

// ===== 6. 页面入口 =====
async function initHome() {
  await checkUser();
  await loadData();
  const feed = $('#feed');
  if (!POSTS.length) { feed.innerHTML = '<div class="empty">还没有动态</div>'; return; }
  const html = await Promise.all(POSTS.map(renderPostCard));
  feed.innerHTML = html.join('');
  const rec = $('#recommend');
  if (rec) {
    rec.innerHTML = Object.values(CHARACTERS).map(c => `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
        ${avatarHTML(c)}
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:14px"><a href="character.html?handle=${c.handle}">${c.name}</a></div>
          <div style="font-size:12px;color:var(--text-muted)">@${c.handle}</div>
        </div>
      </div>`).join('');
  }
}

async function initCharacter() {
  await checkUser();
  await loadData();
  const handle = new URLSearchParams(location.search).get('handle') || 'daniel';
  const char = CHARACTERS[handle];
  const root = $('#profile');
  if (!char) { root.innerHTML = '<div class="empty">找不到这个角色</div>'; return; }
  const posts = POSTS.filter(p => p.character === handle);
  const bannerStyle = char.banner ? `style="background-image:url('${char.banner}');background-size:cover;background-position:center"` : '';
  root.innerHTML = `
    <div class="profile-banner" ${bannerStyle}></div>
    <div class="profile-header">
      <div class="profile-avatar-row">
        ${avatarHTML(char, 'large')}
        <div class="profile-actions">
          <button class="btn btn-primary" onclick="showToast('关注功能即将上线')">关注</button>
          <button class="btn" onclick="showToast('私信功能即将上线')">私信</button>
        </div>
      </div>
      <div class="profile-name">${char.name} ${char.verified ? `<span class="verified">✓ ${char.verified}</span>` : ''}</div>
      <div class="profile-handle">@${char.handle}</div>
      <div class="profile-bio">${char.bio || ''}</div>
      <div class="profile-info">
        <span>📍 ${char.location || ''}</span>
        <span>阵营：${char.faction || '中立'}</span>
        <span><b>${char.baseFollowers}</b> 粉丝</span>
        <span><b>${char.following}</b> 关注</span>
      </div>
    </div>
    <div class="profile-tabs">
      <button class="active">动态</button>
    </div>
    <div id="tab-content"></div>
  `;
  const tabContent = $('#tab-content');
  if (posts.length) {
    const html = await Promise.all(posts.map(renderPostCard));
    tabContent.innerHTML = html.join('');
  } else {
    tabContent.innerHTML = '<div class="empty">还没有动态</div>';
  }
}

async function initPost() {
  await checkUser();
  await loadData();
  const id = new URLSearchParams(location.search).get('id');
  const post = POSTS.find(p => p.id === id);
  const root = $('#post-detail');
  if (!post) { root.innerHTML = '<div class="empty">找不到这篇帖子</div>'; return; }
  root.innerHTML = `
    <a href="index.html" style="font-size:14px">← 返回首页</a>
    <div style="margin-top:16px">${await renderPostCard(post)}</div>
    <div class="card" style="margin-top:16px">
      <h3>评论</h3>
      <div class="empty">评论功能即将上线</div>
    </div>
  `;
}
