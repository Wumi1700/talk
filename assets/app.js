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
    if (!profile) { openFactionModal(); } else { updateUIForLoggedIn(); }
  } else { updateUIForLoggedOut(); }
}
function updateUIForLoggedIn() {
  const actions = $('.topbar-actions');
  if (actions && currentProfile) {
    actions.innerHTML = `<span style="font-size:14px;font-weight:600;">[${currentProfile.faction}] ${currentProfile.username || '用户'}</span><button class="btn" onclick="handleLogout()">退出</button>`;
  }
}
function updateUIForLoggedOut() {
  const actions = $('.topbar-actions');
  if (actions) {
    actions.innerHTML = `<button class="btn" onclick="openAuthModal()">登录</button><button class="btn btn-primary" onclick="openAuthModal()">注册</button>`;
  }
}
function openAuthModal() { $('#auth-modal').style.display = 'flex'; }
function closeAuthModal() { $('#auth-modal').style.display = 'none'; }
function openFactionModal() { $('#faction-modal').style.display = 'flex'; }
async function handleLogin() {
  const email = $('#auth-email').value, password = $('#auth-password').value;
  if (!email || !password) return showToast('请填写邮箱和密码');
  const { error } = await db.auth.signInWithPassword({ email, password });
  if (error) return showToast('登录失败：' + error.message);
  showToast('登录成功！'); closeAuthModal(); checkUser();
}
async function handleRegister() {
  const email = $('#auth-email').value, password = $('#auth-password').value;
  if (!email || !password || password.length < 6) return showToast('密码至少6位');
  const { error } = await db.auth.signUp({ email, password });
  if (error) return showToast('注册失败：' + error.message);
  showToast('注册成功！请选择阵营'); closeAuthModal(); checkUser();
}
async function handleLogout() {
  await db.auth.signOut(); currentUser = null; currentProfile = null;
  showToast('已退出'); updateUIForLoggedOut(); location.reload();
}
async function chooseFaction(faction) {
  if (!currentUser) return;
  const username = prompt('请输入你的昵称：') || '新用户';
  const { error } = await db.from('profiles').insert({ id: currentUser.id, username: username, faction: faction });
  if (error) return showToast('选阵营失败：' + error.message);
  showToast('欢迎加入 ' + faction + ' 阵营！'); $('#faction-modal').style.display = 'none'; checkUser();
}

// ===== 5. 数据加载与渲染 =====
let CHARACTERS = {}, POSTS = [];
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

  const { count: likeCount } = await db.from('likes').select('*', { count: 'exact', head: true }).eq('post_id', post.id);
  const { count: commentCount } = await db.from('comments').select('*', { count: 'exact', head: true }).eq('post_id', post.id).eq('status', 'visible');

  let isLiked = false;
  let isBookmarked = false;
  if (currentUser) {
    const { data: likeDataArr } = await db.from('likes').select('id').eq('post_id', post.id).eq('user_id', currentUser.id).limit(1);
    isLiked = likeDataArr && likeDataArr.length > 0;
    const { data: bkDataArr } = await db.from('bookmarks').select('id').eq('post_id', post.id).eq('user_id', currentUser.id).limit(1);
    isBookmarked = bkDataArr && bkDataArr.length > 0;
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
        <button class="action" onclick="toggleCommentArea('${post.id}')">💬 <span>${commentCount || 0}</span></button>
        <button class="action ${isBookmarked ? 'bookmarked' : ''}" onclick="toggleBookmark('${post.id}', this)">🔖 <span>${isBookmarked ? '已收藏' : '收藏'}</span></button>
      </div>
      <div id="comments-${post.id}" style="display:none; padding-top:12px; border-top:1px solid var(--border); margin-top:12px;">
        <div id="comments-list-${post.id}" style="margin-bottom:10px;"></div>
        <div style="display:flex; gap:8px;">
          <input id="comment-input-${post.id}" type="text" maxlength="500" placeholder="写下你的评论（最多500字）" style="flex:1; padding:8px; border:1px solid var(--border); border-radius:8px;">
          <button class="btn btn-primary" onclick="submitComment('${post.id}')">发送</button>
        </div>
        <div style="font-size:12px; color:var(--muted); margin-top:6px;">每帖最多3条，每天最多10条。先发后审。</div>
      </div>
    </article>
  `;
}

// ===== 6. 互动功能 =====
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

async function toggleBookmark(postId, btn) {
  if (!currentUser) return showToast('请先登录');
  const span = btn.querySelector('span');
  const isBookmarked = span.textContent === '已收藏';
  if (isBookmarked) {
    await db.from('bookmarks').delete().eq('post_id', postId).eq('user_id', currentUser.id);
    btn.classList.remove('bookmarked');
    span.textContent = '收藏';
  } else {
    await db.from('bookmarks').insert({ post_id: postId, user_id: currentUser.id });
    btn.classList.add('bookmarked');
    span.textContent = '已收藏';
  }
}

async function toggleCommentArea(postId) {
  const area = document.getElementById(`comments-${postId}`);
  if (area.style.display === 'none') {
    area.style.display = 'block';
    await loadComments(postId);
  } else {
    area.style.display = 'none';
  }
}

async function loadComments(postId) {
  const list = document.getElementById(`comments-list-${postId}`);
  list.innerHTML = '<div style="font-size:13px;color:var(--muted);">加载中...</div>';
  const { data, error } = await db.from('comments').select('content, created_at, user_id').eq('post_id', postId).eq('status', 'visible').order('created_at', { ascending: true });
  if (error) { list.innerHTML = '<div style="font-size:13px;color:var(--danger);">加载失败</div>'; return; }
  if (!data || data.length === 0) { list.innerHTML = '<div style="font-size:13px;color:var(--muted);">还没有评论</div>'; return; }
  list.innerHTML = data.map(c => {
    const name = (currentUser && c.user_id === currentUser.id) ? (currentProfile?.username || '我') : '读者';
    return `<div style="font-size:13px; margin-bottom:6px; padding:6px; background:var(--bg); border-radius:6px;"><b>${name}</b>：${c.content}</div>`;
  }).join('');
}

async function submitComment(postId) {
  if (!currentUser) return showToast('请先登录');
  const input = document.getElementById(`comment-input-${postId}`);
  const content = input.value.trim();
  if (!content) return showToast('请输入评论内容');
  if (content.length > 500) return showToast('评论最多500字');

  const { count: postCount } = await db.from('comments').select('*', { count: 'exact', head: true }).eq('post_id', postId).eq('user_id', currentUser.id);
  if (postCount >= 3) return showToast('每帖最多评论3条');

  const today = new Date().toISOString().split('T')[0];
  const { count: dayCount } = await db.from('comments').select('*', { count: 'exact', head: true }).eq('user_id', currentUser.id).gte('created_at', today);
  if (dayCount >= 10) return showToast('每天最多评论10条');

  const { error } = await db.from('comments').insert({ post_id: postId, user_id: currentUser.id, content: content });
  if (error) return showToast('评论失败：' + error.message);
  showToast('评论成功！');
  input.value = '';
  await loadComments(postId);
  const btn = document.querySelector(`.post[data-id="${postId}"] .action:nth-child(2) span`);
  if (btn) btn.textContent = parseInt(btn.textContent) + 1;
}

// ===== 7. 关注角色 =====
async function toggleFollow(charHandle, btn) {
  if (!currentUser) return showToast('请先登录');
  const isFollowing = btn.classList.contains('following');
  if (isFollowing) {
    await db.from('follows').delete().eq('character_id', charHandle).eq('user_id', currentUser.id);
    btn.classList.remove('following', 'btn-primary');
    btn.classList.add('btn');
    btn.textContent = '+ 关注';
    const countEl = document.getElementById('follower-count');
    if (countEl) countEl.textContent = Math.max(0, parseInt(countEl.textContent) - 1);
    showToast('已取消关注');
  } else {
    await db.from('follows').insert({ character_id: charHandle, user_id: currentUser.id });
    btn.classList.add('following', 'btn-primary');
    btn.classList.remove('btn');
    btn.textContent = '已关注';
    const countEl = document.getElementById('follower-count');
    if (countEl) countEl.textContent = parseInt(countEl.textContent) + 1;
    showToast('已关注 ' + charHandle);
  }
}

// ===== 8. 角色主页标签页渲染 =====
async function renderCharacterTab(tab, char, posts) {
  const tabContent = $('#tab-content');
  const privacy = char.privacy || { follows: true, likes: true, bookmarks: true };

  if (tab === 'posts') {
    if (posts.length) {
      const html = await Promise.all(posts.map(renderPostCard));
      tabContent.innerHTML = html.join('');
    } else {
      tabContent.innerHTML = '<div class="empty">还没有动态</div>';
    }
  } else if (tab === 'follows') {
    if (!privacy.follows) return tabContent.innerHTML = '<div class="empty">该角色未公开关注列表</div>';
    const list = char.follows || [];
    if (!list.length) return tabContent.innerHTML = '<div class="empty">还没有关注任何人</div>';
    tabContent.innerHTML = list.map(h => {
      const c = CHARACTERS[h];
      if (!c) return '';
      return `<div class="card" style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
        ${avatarHTML(c)}
        <div>
          <div style="font-weight:600;"><a href="character.html?handle=${c.handle}">${c.name}</a></div>
          <div style="font-size:13px;color:var(--muted);">@${c.handle}</div>
        </div>
      </div>`;
    }).join('');
  } else if (tab === 'likes') {
    if (!privacy.likes) return tabContent.innerHTML = '<div class="empty">该角色未公开点赞列表</div>';
    const likeIds = char.likes || [];
    const likedPosts = POSTS.filter(p => likeIds.includes(p.id));
    if (!likedPosts.length) return tabContent.innerHTML = '<div class="empty">还没有点赞过帖子</div>';
    const html = await Promise.all(likedPosts.map(renderPostCard));
    tabContent.innerHTML = html.join('');
  } else if (tab === 'bookmarks') {
    if (!privacy.bookmarks) return tabContent.innerHTML = '<div class="empty">该角色未公开收藏列表</div>';
    const bkIds = char.bookmarks || [];
    const bkPosts = POSTS.filter(p => bkIds.includes(p.id));
    if (!bkPosts.length) return tabContent.innerHTML = '<div class="empty">还没有收藏过帖子</div>';
    const html = await Promise.all(bkPosts.map(renderPostCard));
    tabContent.innerHTML = html.join('');
  }
}

// ===== 9. 私信功能 =====
async function getMonthlyMessageCount() {
  if (!currentUser) return 0;
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDay = new Date(year, month, 1).toISOString();
  const { count } = await db.from('messages').select('*', { count: 'exact', head: true }).eq('user_id', currentUser.id).gte('created_at', firstDay);
  return count || 0;
}

async function initMessage() {
  await checkUser();
  await loadData();
  const root = $('#message-app');
  if (!currentUser) {
    root.innerHTML = '<div class="empty">请先登录后再查看私信</div>';
    return;
  }

  const params = new URLSearchParams(location.search);
  const charHandle = params.get('character');

  const used = await getMonthlyMessageCount();
  const remaining = Math.max(0, 4 - used);
  const quotaEl = $('#quota-display');
  if (quotaEl) quotaEl.innerHTML = `本月剩余：<b>${remaining}</b> / 4 条`;

  if (!charHandle) {
    root.innerHTML = `
      <div class="card"><h3>选择一个角色私信</h3></div>
      ${Object.values(CHARACTERS).map(c => `
        <a href="message.html?character=${c.handle}" style="text-decoration:none;color:inherit;">
          <div class="card" style="display:flex;align-items:center;gap:12px;">
            ${avatarHTML(c)}
            <div>
              <div style="font-weight:600;">${c.name}</div>
              <div style="font-size:13px;color:var(--muted);">@${c.handle}</div>
            </div>
          </div>
        </a>
      `).join('')}
    `;
    return;
  }

  const char = CHARACTERS[charHandle];
  if (!char) { root.innerHTML = '<div class="empty">找不到这个角色</div>'; return; }

  const { data: { user } } = await db.auth.getUser();
  const createdAt = new Date(user.created_at);
  const hoursSince = (Date.now() - createdAt.getTime()) / 1000 / 3600;
  const isNewUser = hoursSince < 24;

  const { data: msgs } = await db.from('messages').select('*').eq('user_id', currentUser.id).eq('character_id', charHandle).order('created_at', { ascending: true });

  root.innerHTML = `
    <div class="card" style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
      ${avatarHTML(char)}
      <div style="flex:1;">
        <div style="font-weight:600;"><a href="character.html?handle=${char.handle}">${char.name}</a></div>
        <div style="font-size:13px;color:var(--muted);">@${char.handle}</div>
      </div>
      <a href="message.html" style="font-size:13px;">← 返回列表</a>
    </div>
    <div id="chat-box" style="background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:16px;max-height:500px;overflow-y:auto;margin-bottom:12px;">
      ${(!msgs || !msgs.length) ? '<div class="empty">还没有对话，发第一条私信吧</div>' : msgs.map(m => {
        const isMe = m.user_id === currentUser.id;
        const time = new Date(m.created_at).toLocaleString('zh-CN');
        return `<div style="margin-bottom:10px;text-align:${isMe?'right':'left'};">
          <div style="display:inline-block;padding:8px 12px;border-radius:12px;background:${isMe?'var(--primary-light)':'var(--bg)'};max-width:70%;text-align:left;">
            ${m.content}
          </div>
          <div style="font-size:11px;color:var(--muted);margin-top:4px;">${time}</div>
        </div>`;
      }).join('')}
    </div>
    <div style="display:flex;gap:8px;">
      <input id="message-input" type="text" maxlength="1000" placeholder="写私信（最多1000字）" ${isNewUser ? 'disabled' : ''} style="flex:1;padding:10px;border:1px solid var(--border);border-radius:8px;">
      <button class="btn btn-primary" onclick="submitMessage('${charHandle}')" ${isNewUser ? 'disabled' : ''}>发送</button>
    </div>
    <div style="font-size:12px;color:var(--muted);margin-top:6px;">
      ${isNewUser ? '⚠️ 注册后 24 小时内不能私信' : `本月剩余额度：${remaining} / 4 条（所有角色合计）`}
    </div>
  `;
}

async function submitMessage(charHandle) {
  if (!currentUser) return showToast('请先登录');
  const input = $('#message-input');
  const content = input.value.trim();
  if (!content) return showToast('请输入内容');
  if (content.length > 1000) return showToast('私信最多1000字');

  const { data: { user } } = await db.auth.getUser();
  const hoursSince = (Date.now() - new Date(user.created_at).getTime()) / 1000 / 3600;
  if (hoursSince < 24) return showToast('注册后 24 小时内不能私信');

  const used = await getMonthlyMessageCount();
  if (used >= 4) return showToast('本月私信额度已用完（共4条）');

  const { error } = await db.from('messages').insert({ user_id: currentUser.id, character_id: charHandle, content: content });
  if (error) return showToast('发送失败：' + error.message);
  showToast('私信已发送，等待管理员回复');
  input.value = '';
  await initMessage();
}

// ===== 10. 用户个人主页 =====
async function initProfile() {
  await checkUser();
  await loadData();
  const root = $('#user-profile');
  if (!currentUser || !currentProfile) {
    root.innerHTML = '<div class="empty">请先登录后再查看个人主页</div>';
    return;
  }

  const username = currentProfile.username || '新用户';
  const faction = currentProfile.faction || '人类';
  const createdAt = new Date(currentUser.created_at).toLocaleDateString('zh-CN');

  root.innerHTML = `
    <div class="card" style="text-align:center;padding:24px;">
      <div class="avatar large" style="margin:0 auto 12px;background:var(--primary-light);color:var(--primary-dark);display:flex;align-items:center;justify-content:center;font-size:32px;font-weight:700;">${username.slice(0,1)}</div>
      <div style="font-size:22px;font-weight:800;margin-bottom:6px;">${username}</div>
      <div style="font-size:14px;color:var(--muted);margin-bottom:8px;">
        <span class="verified">[${faction}]</span> · 注册于 ${createdAt}
      </div>
      <div style="font-size:13px;color:var(--muted);">TALK 旅者编号：${currentUser.id.slice(0,8)}</div>
    </div>
    <div class="profile-tabs" id="profile-tabs">
      <button class="active" data-tab="likes">我的点赞</button>
      <button data-tab="bookmarks">我的收藏</button>
      <button data-tab="comments">我的评论</button>
    </div>
    <div id="user-tab-content"></div>
  `;

  const renderUserTab = async (tab) => {
    const container = $('#user-tab-content');
    container.innerHTML = '<div class="empty">加载中...</div>';

    if (tab === 'likes') {
      const { data: likesData } = await db.from('likes').select('post_id').eq('user_id', currentUser.id);
      const ids = (likesData || []).map(l => l.post_id);
      const likedPosts = POSTS.filter(p => ids.includes(p.id));
      if (!likedPosts.length) return container.innerHTML = '<div class="empty">你还没有点赞过帖子</div>';
      const html = await Promise.all(likedPosts.map(renderPostCard));
      container.innerHTML = html.join('');
    } else if (tab === 'bookmarks') {
      const { data: bkData } = await db.from('bookmarks').select('post_id').eq('user_id', currentUser.id);
      const ids = (bkData || []).map(b => b.post_id);
      const bkPosts = POSTS.filter(p => ids.includes(p.id));
      if (!bkPosts.length) return container.innerHTML = '<div class="empty">你还没有收藏过帖子</div>';
      const html = await Promise.all(bkPosts.map(renderPostCard));
      container.innerHTML = html.join('');
    } else if (tab === 'comments') {
      const { data: cmData } = await db.from('comments').select('content, post_id, created_at').eq('user_id', currentUser.id).order('created_at', { ascending: false });
      if (!cmData || !cmData.length) return container.innerHTML = '<div class="empty">你还没有发过评论</div>';
      container.innerHTML = cmData.map(c => {
        const post = POSTS.find(p => p.id === c.post_id);
        const postTitle = post ? post.content.slice(0, 30) + '...' : '（帖子已删除）';
        return `<div class="card" style="margin-bottom:10px;">
          <div style="font-size:13px;color:var(--muted);margin-bottom:6px;">评论了帖子：${postTitle}</div>
          <div style="font-size:14px;background:var(--bg);padding:8px;border-radius:8px;">${c.content}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:6px;">${new Date(c.created_at).toLocaleString('zh-CN')}</div>
        </div>`;
      }).join('');
    }
  };

  renderUserTab('likes');

  $$('#profile-tabs button').forEach(b => {
    b.addEventListener('click', async () => {
      $$('#profile-tabs button').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      await renderUserTab(b.dataset.tab);
    });
  });
}

// ===== 11. 页面入口 =====
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

  const { count: realFollowers } = await db.from('follows').select('*', { count: 'exact', head: true }).eq('character_id', handle);
  const totalFollowers = (char.baseFollowers || 0) + (realFollowers || 0);

  let isFollowing = false;
  if (currentUser) {
    const { data: followDataArr } = await db.from('follows').select('id').eq('character_id', handle).eq('user_id', currentUser.id).limit(1);
    isFollowing = followDataArr && followDataArr.length > 0;
  }

  const followBtnClass = isFollowing ? 'btn btn-primary following' : 'btn';
  const followBtnText = isFollowing ? '已关注' : '+ 关注';

  root.innerHTML = `
    <div class="profile-banner" ${bannerStyle}></div>
    <div class="profile-header">
      <div class="profile-avatar-row">
        ${avatarHTML(char, 'large')}
        <div class="profile-actions">
          <button class="${followBtnClass}" onclick="toggleFollow('${char.handle}', this)">${followBtnText}</button>
          <button class="btn" onclick="location.href='message.html?character=${char.handle}'">私信</button>
        </div>
      </div>
      <div class="profile-name">${char.name} ${char.verified ? `<span class="verified">✓ ${char.verified}</span>` : ''}</div>
      <div class="profile-handle">@${char.handle}</div>
      <div class="profile-bio">${char.bio || ''}</div>
      <div class="profile-info">
        <span>📍 ${char.location || ''}</span>
        <span>阵营：${char.faction || '中立'}</span>
        <span><b id="follower-count">${totalFollowers}</b> 粉丝</span>
        <span><b>${char.following || 0}</b> 关注</span>
      </div>
    </div>
    <div class="profile-tabs" id="profile-tabs">
      <button class="active" data-tab="posts">动态</button>
      ${(char.privacy || {}).follows !== false ? '<button data-tab="follows">关注</button>' : ''}
      ${(char.privacy || {}).likes !== false ? '<button data-tab="likes">点赞</button>' : ''}
      ${(char.privacy || {}).bookmarks !== false ? '<button data-tab="bookmarks">收藏</button>' : ''}
    </div>
    <div id="tab-content"></div>
  `;

  renderCharacterTab('posts', char, posts);

  $$('#profile-tabs button').forEach(b => {
    b.addEventListener('click', async () => {
      $$('#profile-tabs button').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      await renderCharacterTab(b.dataset.tab, char, posts);
    });
  });
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
  `;
}
