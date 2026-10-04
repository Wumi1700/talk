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
      openFactionModal();
    } else if (profile.is_banned) {
      showBannedScreen();
      return;
    } else {
      updateUIForLoggedIn();
    }
  } else {
    updateUIForLoggedOut();
  }
  if (typeof renderSidebar === 'function') await renderSidebar();
}

function updateUIForLoggedIn() {
  const actions = document.querySelector('.topbar-actions');
  if (actions && currentProfile) {
    actions.innerHTML = `<span style="font-size:14px;font-weight:600;">[${currentProfile.faction}] ${currentProfile.username || '用户'}</span><button class="btn" onclick="handleLogout()">退出</button>`;
  }
}

function updateUIForLoggedOut() {
  const actions = document.querySelector('.topbar-actions');
  if (actions) {
    actions.innerHTML = `<button class="btn" onclick="openAuthModal()">登录</button><button class="btn btn-primary" onclick="openAuthModal()">注册</button>`;
  }
}

function openAuthModal() {
  const m = document.getElementById('auth-modal');
  if (m) m.style.display = 'flex';
}

function closeAuthModal() {
  const m = document.getElementById('auth-modal');
  if (m) m.style.display = 'none';
}

function openFactionModal() {
  const m = document.getElementById('faction-modal');
  if (m) m.style.display = 'flex';
}

function showBannedScreen() {
  // 保留顶栏、侧边栏、页脚，只在主内容区显示封禁提示
  const main = document.querySelector('main');
  if (main) {
    main.innerHTML = `
      <div class="card" style="text-align:center;padding:48px 24px;border-color:#f5c2c7;">
        <div style="font-size:56px;margin-bottom:16px;">🚪</div>
        <h3 style="font-size:22px;font-weight:800;margin-bottom:12px;color:#b02a37;">你已被放逐</h3>
        <p style="font-size:14px;color:var(--muted);line-height:1.9;">
          你的账号因违反社区规则，已被移出这个世界。<br>
          你仍可以浏览内容，但无法进行任何互动。
        </p>
        <p style="font-size:13px;color:var(--muted);margin-top:20px;">
          如有异议，请联系管理员。
        </p>
        <button class="btn" onclick="handleLogout()" style="margin-top:24px;">退出登录</button>
      </div>
    `;
  }
  // 同时把顶栏的登录状态更新一下（显示昵称 + 退出）
  updateUIForLoggedIn();
  // 仍要渲染侧边栏（让用户能浏览其他页面，但不能互动）
  if (typeof renderSidebar === 'function') renderSidebar();
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
  if (currentProfile && currentProfile.is_banned) return showToast('你已被放逐，无法互动');
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
  if (currentProfile && currentProfile.is_banned) return showToast('你已被放逐，无法互动');
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
  if (currentProfile && currentProfile.is_banned) return showToast('你已被放逐，无法互动');
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
  const { data, error } = await db.from('comments').select('id, content, created_at, user_id, parent_id').eq('post_id', postId).eq('status', 'visible').order('created_at', { ascending: true });
  if (error) { list.innerHTML = '<div style="font-size:13px;color:var(--danger);">加载失败</div>'; return; }
  if (!data || data.length === 0) { list.innerHTML = '<div style="font-size:13px;color:var(--muted);">还没有评论</div>'; return; }

  // 查询点赞
  const commentIds = data.map(c => c.id);
  const likeCounts = {};
  const likedByMe = {};
  if (commentIds.length) {
    const { data: allLikes } = await db.from('comment_likes').select('comment_id, user_id').in('comment_id', commentIds);
    (allLikes || []).forEach(l => {
      likeCounts[l.comment_id] = (likeCounts[l.comment_id] || 0) + 1;
      if (currentUser && l.user_id === currentUser.id) likedByMe[l.comment_id] = true;
    });
  }

  // 组织树形结构：顶级评论 + 回复
  const roots = data.filter(c => !c.parent_id);
  const repliesMap = {};
  data.filter(c => c.parent_id).forEach(c => {
    if (!repliesMap[c.parent_id]) repliesMap[c.parent_id] = [];
    repliesMap[c.parent_id].push(c);
  });

  function renderOne(c, isReply) {
    const name = (currentUser && c.user_id === currentUser.id) ? (currentProfile?.username || '我') : '读者';
    const count = likeCounts[c.id] || 0;
    const liked = !!likedByMe[c.id];
    return `
      <div style="font-size:13px;margin-bottom:8px;padding:8px;background:var(--bg);border-radius:6px;${isReply ? 'margin-left:24px;border-left:2px solid var(--border);' : ''}">
        <div><b>${name}</b>：${c.content}</div>
        <div style="margin-top:6px;display:flex;gap:12px;">
          <button class="comment-like-btn" data-liked="${liked}" onclick="toggleCommentLike('${c.id}', this)" style="background:none;border:none;color:${liked ? '#E76F51' : 'var(--muted)'};cursor:pointer;font-size:12px;font-family:inherit;padding:0;">
            ♡ <span>${count}</span>
          </button>
          <button onclick="showReplyBox('${c.id}')" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:12px;font-family:inherit;padding:0;">回复</button>
          <button onclick="openReportModal('comment', '${c.id}')" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:12px;font-family:inherit;padding:0;">举报</button>
        </div>
        <div id="reply-box-${c.id}" style="display:none;margin-top:8px;">
          <div style="display:flex;gap:6px;">
            <input id="reply-input-${c.id}" type="text" maxlength="500" placeholder="回复..." style="flex:1;padding:6px;border:1px solid var(--border);border-radius:6px;font-size:13px;">
            <button class="btn btn-primary" onclick="submitReply('${postId}', '${c.id}')" style="padding:6px 12px;font-size:13px;">发送</button>
          </div>
        </div>
      </div>
    `;
  }

  let html = '';
  roots.forEach(c => {
    html += renderOne(c, false);
    (repliesMap[c.id] || []).forEach(r => {
      html += renderOne(r, true);
    });
  });
  list.innerHTML = html;
}

function showReplyBox(commentId) {
  const box = document.getElementById(`reply-box-${commentId}`);
  if (!box) return;
  if (box.style.display === 'none' || !box.style.display) {
    box.style.display = 'block';
    const input = document.getElementById(`reply-input-${commentId}`);
    if (input) input.focus();
  } else {
    box.style.display = 'none';
  }
}

async function submitReply(postId, parentId) {
  if (!currentUser) return showToast('请先登录');
  if (currentProfile && currentProfile.is_banned) return showToast('你已被放逐，无法互动');
  const input = document.getElementById(`reply-input-${parentId}`);
  const content = input.value.trim();
  if (!content) return showToast('请输入内容');
  if (await containsSensitiveWord(content)) return showToast('你的内容包含敏感词，请修改后重试');
  if (content.length > 500) return showToast('回复最多500字');

  const { count: postCount } = await db.from('comments').select('*', { count: 'exact', head: true }).eq('post_id', postId).eq('user_id', currentUser.id);
  if (postCount >= 3) return showToast('每帖最多评论3条（含回复）');

  const today = new Date().toISOString().split('T')[0];
  const { count: dayCount } = await db.from('comments').select('*', { count: 'exact', head: true }).eq('user_id', currentUser.id).gte('created_at', today);
  if (dayCount >= 10) return showToast('每天最多评论10条（含回复）');

  const { error } = await db.from('comments').insert({ post_id: postId, user_id: currentUser.id, content: content, parent_id: parentId });
  if (error) return showToast('回复失败：' + error.message);
  showToast('回复成功');
  input.value = '';
  await loadComments(postId);
  const btn = document.querySelector(`.post[data-id="${postId}"] .action:nth-child(2) span`);
  if (btn) btn.textContent = parseInt(btn.textContent) + 1;
}

async function toggleCommentLike(commentId, btn) {
  if (!currentUser) return showToast('请先登录');
  if (currentProfile && currentProfile.is_banned) return showToast('你已被放逐，无法互动');
  const span = btn.querySelector('span');
  const isLiked = btn.dataset.liked === 'true';
  if (isLiked) {
    await db.from('comment_likes').delete().eq('comment_id', commentId).eq('user_id', currentUser.id);
    btn.dataset.liked = 'false';
    btn.style.color = 'var(--muted)';
    span.textContent = Math.max(0, parseInt(span.textContent) - 1);
  } else {
    await db.from('comment_likes').insert({ comment_id: commentId, user_id: currentUser.id });
    btn.dataset.liked = 'true';
    btn.style.color = '#E76F51';
    span.textContent = parseInt(span.textContent) + 1;
  }
}

async function submitComment(postId) {
  if (!currentUser) return showToast('请先登录');
  if (currentProfile && currentProfile.is_banned) return showToast('你已被放逐，无法互动');
  const input = document.getElementById(`comment-input-${postId}`);
  const content = input.value.trim();
  if (await containsSensitiveWord(content)) {
    return showToast('你的内容包含敏感词，请修改后重试');
  }
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
  if (currentProfile && currentProfile.is_banned) return showToast('你已被放逐，无法互动');
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
  if (currentProfile && currentProfile.is_banned) return;
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
        const isMe = !m.is_from_character;
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
  if (currentProfile && currentProfile.is_banned) return showToast('你已被放逐，无法互动');
  const input = $('#message-input');
  const content = input.value.trim();
  if (await containsSensitiveWord(content)) {
    return showToast('你的内容包含敏感词，请修改后重试');
  }
  if (!content) return showToast('请输入内容');
  if (content.length > 1000) return showToast('私信最多1000字');

  const { data: { user } } = await db.auth.getUser();
  const hoursSince = (Date.now() - new Date(user.created_at).getTime()) / 1000 / 3600;
  if (hoursSince < 24) return showToast('注册后 24 小时内不能私信');

  const used = await getMonthlyMessageCount();
  if (used >= 4) return showToast('本月私信额度已用完（共4条）');

  const { error } = await db.from('messages').insert({ user_id: currentUser.id, character_id: charHandle, content: content });
  if (error) return showToast('发送失败：' + error.message);
  await db.from('notifications').insert({
  user_id: currentUser.id,
  type: 'message',
  target_id: '你的私信已送达，等待角色回复',
  is_read: false
});
  
  showToast('私信已发送，等待管理员回复');
  input.value = '';
  await initMessage();
}

// ===== 10. 用户个人主页 =====
async function initProfile() {
  await checkUser();
  if (currentProfile && currentProfile.is_banned) return;
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
      <button data-tab="follows">我的关注</button>
    </div>
    <div id="user-tab-content"></div>
  `;

  const renderUserTab = async (tab) => {
    const container = $('#user-tab-content');
    container.innerHTML = '<div class="empty">加载中...</div>';

    if (tab === 'follows') {
  const { data: followData } = await db.from('follows').select('character_id').eq('user_id', currentUser.id);
  const ids = (followData || []).map(f => f.character_id);
  const followedChars = ids.map(id => CHARACTERS[id]).filter(Boolean);
  if (!followedChars.length) return container.innerHTML = '<div class="empty">你还没有关注任何角色</div>';
  container.innerHTML = followedChars.map(c => `
    <div class="card" style="display:flex;align-items:center;gap:12px;">
      ${avatarHTML(c)}
      <div style="flex:1;">
        <div style="font-weight:600;"><a href="character.html?handle=${c.handle}">${c.name}</a></div>
        <div style="font-size:13px;color:var(--muted);">@${c.handle} · ${c.bio || ''}</div>
      </div>
      <button class="btn btn-primary" onclick="unfollowFromProfile('${c.handle}', this)">已关注</button>
    </div>
  `).join('');
  return;
}
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
  if (currentProfile && currentProfile.is_banned) return;
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
  if (currentProfile && currentProfile.is_banned) return;
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
  if (currentProfile && currentProfile.is_banned) return;
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

async function unfollowFromProfile(handle, btn) {
  if (!currentUser) return;
  await db.from('follows').delete().eq('character_id', handle).eq('user_id', currentUser.id);
  showToast('已取消关注');
  btn.closest('.card').remove();
}

// ===== 12. 设置页 =====
async function initSettings() {
  await checkUser();
  if (currentProfile && currentProfile.is_banned) return;
  const root = $('#settings-app');
  if (!currentUser || !currentProfile) {
    root.innerHTML = '<div class="empty">请先登录后再查看设置</div>';
    return;
  }

  root.innerHTML = `
    <div class="card">
      <h3>账号信息</h3>
      <div style="font-size:14px;color:var(--muted);line-height:2;">
        <div>邮箱：${currentUser.email}</div>
        <div>阵营：${currentProfile.faction}（选定后 3 个月内不可更改）</div>
        <div>注册时间：${new Date(currentUser.created_at).toLocaleString('zh-CN')}</div>
      </div>
    </div>

    <div class="card">
      <h3>修改昵称</h3>
      <div style="display:flex;gap:8px;">
        <input id="new-username" type="text" value="${currentProfile.username || ''}" placeholder="输入新昵称" style="flex:1;padding:10px;border:1px solid var(--border);border-radius:8px;">
        <button class="btn btn-primary" onclick="updateUsername()">保存</button>
      </div>
    </div>

    <div class="card">
      <h3>修改密码</h3>
      <div style="display:flex;flex-direction:column;gap:8px;">
        <input id="new-password" type="password" placeholder="输入新密码（至少6位）" style="padding:10px;border:1px solid var(--border);border-radius:8px;">
        <input id="new-password2" type="password" placeholder="再次输入新密码" style="padding:10px;border:1px solid var(--border);border-radius:8px;">
        <button class="btn btn-primary" onclick="updatePassword()" style="align-self:flex-start;">修改密码</button>
      </div>
    </div>

    <div class="card">
      <h3>退出登录</h3>
      <button class="btn" onclick="handleLogout()">退出当前账号</button>
    </div>

    <div class="card" style="border-color:#f5c2c7;">
      <h3 style="color:#b02a37;">危险操作</h3>
      <p style="font-size:13px;color:var(--muted);margin-bottom:10px;">删除账号会清空你的点赞、收藏、评论、关注、私信记录，操作不可恢复。</p>
      <button class="btn" onclick="deleteAccount()" style="border-color:#dc3545;color:#dc3545;">删除我的账号</button>
    </div>
  `;
}

async function updateUsername() {
  const newName = $('#new-username').value.trim();
  if (!newName) return showToast('昵称不能为空');
  if (newName.length > 20) return showToast('昵称最多20个字');
  const { error } = await db.from('profiles').update({ username: newName }).eq('id', currentUser.id);
  if (error) return showToast('修改失败：' + error.message);
  currentProfile.username = newName;
  showToast('昵称已更新');
  updateUIForLoggedIn();
}

async function updatePassword() {
  const p1 = $('#new-password').value;
  const p2 = $('#new-password2').value;
  if (!p1 || p1.length < 6) return showToast('密码至少6位');
  if (p1 !== p2) return showToast('两次输入的密码不一致');
  const { error } = await db.auth.updateUser({ password: p1 });
  if (error) return showToast('修改失败：' + error.message);
  showToast('密码已修改');
  $('#new-password').value = '';
  $('#new-password2').value = '';
}

async function deleteAccount() {
  const ok = confirm('确定要删除账号吗？所有点赞、收藏、评论、关注、私信都会清空，且不可恢复。');
  if (!ok) return;
  const ok2 = confirm('再确认一次：真的要删除吗？');
  if (!ok2) return;

  try {
    await db.from('likes').delete().eq('user_id', currentUser.id);
    await db.from('bookmarks').delete().eq('user_id', currentUser.id);
    await db.from('comments').delete().eq('user_id', currentUser.id);
    await db.from('follows').delete().eq('user_id', currentUser.id);
    await db.from('messages').delete().eq('user_id', currentUser.id);
    await db.from('profiles').delete().eq('id', currentUser.id);
    await db.auth.signOut();
    showToast('账号数据已清除');
    setTimeout(() => { location.href = 'index.html'; }, 1500);
  } catch (e) {
    showToast('删除失败，请联系管理员');
  }
}

// ===== 13. 全站侧边栏自动生成 =====
async function renderSidebar() {
  const sidebar = document.querySelector('.sidebar-left');
  if (!sidebar) return;

  // 【新增】打开任何页面时，检测角色新回复，自动生成通知
  if (currentUser) {
    await checkNewReplies();
  }

  const path = location.pathname.split('/').pop() || 'index.html';

  // 查询未读数
  let unread = 0;
  if (currentUser) {
    unread = await getUnreadCount();
  }

  const links = [
    { href: 'index.html', icon: '🏠', text: '首页' },
    { href: 'forum.html', icon: '⚔️', text: '阵营论坛' },
    { href: 'notifications.html', icon: '🔔', text: '通知', badge: unread },
    { href: 'message.html', icon: '✉️', text: '私信' },
    { href: 'profile.html', icon: '👤', text: '我的主页' },
    { href: 'settings.html', icon: '⚙️', text: '设置' }
  ];

  sidebar.innerHTML = `
    <nav>
      ${links.map(l => `
        <a href="${l.href}" 
           ${l.alert ? `onclick="showToast('${l.alert}');return false;"` : ''} 
           class="${path === l.href ? 'active' : ''}">
          <span class="icon">${l.icon}</span> ${l.text}
          ${l.badge ? `<span style="margin-left:auto;background:#E76F51;color:#fff;font-size:11px;padding:1px 7px;border-radius:10px;font-weight:600;">${l.badge}</span>` : ''}
        </a>
      `).join('')}
    </nav>
  `;
}

// 【新增】检测角色新回复，自动生成通知
async function checkNewReplies() {
  if (!currentUser) return;
  // 找出所有“角色发来的、还没通知过的”消息
  const { data: newMsgs } = await db.from('messages')
    .select('id, character_id, content')
    .eq('user_id', currentUser.id)
    .eq('is_from_character', true)
    .eq('notified', false);

  if (!newMsgs || !newMsgs.length) return;

  // 对每条消息，生成一条通知
  for (const m of newMsgs) {
    await db.from('notifications').insert({
      user_id: currentUser.id,
      type: 'message',
      target_id: '角色 ' + m.character_id + ' 回复了你：' + m.content.slice(0, 30),
      is_read: false
    });
    await db.from('messages').update({ notified: true }).eq('id', m.id);
  }
}

// 页面加载时自动执行
document.addEventListener('DOMContentLoaded', async () => {
  await checkUser();
  await renderSidebar();
  bindSearchBox();
});

// ===== 14. 通知中心 =====
function notifyText(type) {
  switch (type) {
    case 'like': return '有人点赞了你的评论';
    case 'comment': return '有人回复了你';
    case 'message': return '角色给你发了一条私信';
    case 'follow': return '有人关注了你';
    case 'system': return '系统通知';
    default: return '新通知';
  }
}

async function getUnreadCount() {
  if (!currentUser) return 0;
  const { count } = await db.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', currentUser.id).eq('is_read', false);
  return count || 0;
}

async function initNotifications() {
  await checkUser();
  if (currentProfile && currentProfile.is_banned) return;
  await loadData();
  const root = $('#notifications-app');
  if (!currentUser) {
    root.innerHTML = '<div class="empty">请先登录后再查看通知</div>';
    return;
  }

  const { data: list, error } = await db.from('notifications').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false }).limit(100);

  if (error) { root.innerHTML = '<div class="empty">加载失败：' + error.message + '</div>'; return; }

  if (!list || !list.length) {
    root.innerHTML = `
      <div class="card">
        <h3>通知</h3>
        <div class="empty">还没有任何通知</div>
      </div>
    `;
    return;
  }

  root.innerHTML = `
    <div class="card"><h3>通知（共 ${list.length} 条）</h3></div>
    ${list.map(n => {
      const unread = !n.is_read;
      const time = new Date(n.created_at).toLocaleString('zh-CN');
      return `
        <div class="card" style="background:${unread ? 'var(--primary-light)' : 'var(--card)'};border-color:${unread ? 'var(--primary)' : 'var(--border)'};">
          <div style="display:flex;align-items:flex-start;gap:10px;">
            ${unread ? '<span style="width:8px;height:8px;border-radius:50%;background:var(--primary);flex-shrink:0;margin-top:8px;"></span>' : ''}
            <div style="flex:1;">
              <div style="font-weight:600;font-size:14px;">${notifyText(n.type)}</div>
              ${n.target_id ? `<div style="font-size:13px;color:var(--muted);margin-top:4px;">${n.target_id}</div>` : ''}
              <div style="font-size:11px;color:var(--muted);margin-top:6px;">${time}</div>
            </div>
            ${unread ? `<button class="btn" onclick="markRead('${n.id}')">标记已读</button>` : ''}
          </div>
        </div>
      `;
    }).join('')}
  `;
}

async function markRead(id) {
  await db.from('notifications').update({ is_read: true }).eq('id', id);
  await initNotifications();
  await renderSidebar();
}

// ===== 15. 阵营论坛 =====
let FORUM_POSTS = [];

async function loadForumData() {
  try {
    const res = await fetch('posts/forum.json');
    const data = await res.json();
    FORUM_POSTS = await Promise.all(data.posts.map(async p => {
      const r = await fetch(p.file);
      const text = await r.text();
      const { data: fm, content } = parseFrontMatter(text);
      return { id: p.id, ...fm, content };
    }));
  } catch (e) {
    FORUM_POSTS = [];
  }
}

async function initForum() {
  await checkUser();
  if (currentProfile && currentProfile.is_banned) return;
  await loadData();
  await loadForumData();
  const root = $('#forum-app');
  if (!currentUser) {
    root.innerHTML = '<div class="empty">请先登录后再进入阵营论坛</div>';
    return;
  }
  if (!currentProfile || !currentProfile.faction) {
    root.innerHTML = '<div class="empty">请先选择阵营</div>';
    return;
  }
  const myFaction = currentProfile.faction;
  const myPosts = FORUM_POSTS.filter(p => p.faction === myFaction);

  root.innerHTML = `
    <div class="card" style="background:var(--primary-light);border-color:var(--primary);">
      <h3>${myFaction} · 阵营论坛</h3>
      <p style="margin-top:8px;font-size:13px;color:var(--text-muted);">
        这里只有 ${myFaction} 阵营的成员能看到。
      </p>
    </div>
    ${myPosts.length
      ? (await Promise.all(myPosts.map(renderPostCard))).join('')
      : '<div class="empty">这个阵营还没有帖子</div>'}
  `;
}

// ===== 16. 顶部搜索框全局绑定 =====
function bindSearchBox() {
  const inputs = document.querySelectorAll('.search-box input');
  inputs.forEach(input => {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const q = input.value.trim();
        if (!q) return;
        location.href = 'search.html?q=' + encodeURIComponent(q);
      }
    });
  });
}

// ===== 17. 搜索页 =====
function escapeText(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function initSearch() {
  await checkUser();
  if (currentProfile && currentProfile.is_banned) return;
  await loadData();

  const root = $('#search-app');
  const q = new URLSearchParams(location.search).get('q') || '';

  // 把关键词填回搜索框
  const searchInput = document.querySelector('.search-box input');
  if (searchInput && q) searchInput.value = q;

  if (!q) {
    root.innerHTML = `
      <div class="card"><h3>搜索</h3></div>
      <div class="empty">输入关键词，搜索角色、帖子、标签</div>
    `;
    return;
  }

  const lowerQ = q.toLowerCase();

  // 搜角色
  const matchedChars = Object.values(CHARACTERS).filter(c =>
    (c.name && c.name.toLowerCase().includes(lowerQ)) ||
    (c.nameEn && c.nameEn.toLowerCase().includes(lowerQ)) ||
    (c.handle && c.handle.toLowerCase().includes(lowerQ)) ||
    (c.bio && c.bio.toLowerCase().includes(lowerQ)) ||
    (c.location && c.location.toLowerCase().includes(lowerQ))
  );

  // 搜帖子
  const matchedPosts = POSTS.filter(p => {
    const char = CHARACTERS[p.character] || {};
    return (p.content && p.content.toLowerCase().includes(lowerQ)) ||
           (p.location && p.location.toLowerCase().includes(lowerQ)) ||
           (char.name && char.name.toLowerCase().includes(lowerQ)) ||
           (p.tags && p.tags.some(t => t.toLowerCase().includes(lowerQ)));
  });

  if (!matchedChars.length && !matchedPosts.length) {
    root.innerHTML = `
      <div class="card"><h3>搜索：${escapeText(q)}</h3></div>
      <div class="empty">没有找到相关内容</div>
    `;
    return;
  }

  let html = `
    <div class="card">
      <h3>搜索：${escapeText(q)}</h3>
      <div style="font-size:13px;color:var(--muted);margin-top:6px;">
        找到 ${matchedChars.length} 个角色 · ${matchedPosts.length} 篇帖子
      </div>
    </div>
  `;

  if (matchedChars.length) {
    html += `<div class="card"><h3>角色（${matchedChars.length}）</h3></div>`;
    html += matchedChars.map(c => `
      <div class="card" style="display:flex;align-items:center;gap:12px;">
        ${avatarHTML(c)}
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;">
            <a href="character.html?handle=${c.handle}">${escapeText(c.name)}</a>
            ${c.verified ? `<span class="verified">✓ ${escapeText(c.verified)}</span>` : ''}
          </div>
          <div style="font-size:13px;color:var(--muted);">@${escapeText(c.handle)} · ${escapeText(c.bio || '')}</div>
        </div>
      </div>
    `).join('');
  }

  if (matchedPosts.length) {
    html += `<div class="card" style="margin-top:16px;"><h3>帖子（${matchedPosts.length}）</h3></div>`;
    const postCards = await Promise.all(matchedPosts.map(renderPostCard));
    html += postCards.join('');
  }

  root.innerHTML = html;
}

// ===== 18. 敏感词过滤 =====
let sensitiveWords = [];
let sensitiveLoaded = false;

async function loadSensitiveWords() {
  if (sensitiveLoaded) return;
  const files = ['广告.txt', '政治类.txt', '色情类.txt', '涉枪涉爆违法信息关键词.txt'];
  const words = [];
  for (const file of files) {
    try {
      const res = await fetch('words/' + encodeURIComponent(file));
      if (!res.ok) { console.warn('词库加载失败：' + file); continue; }
      const text = await res.text();
      text.split(/[,\n]/).forEach(w => {
        const t = w.trim();
        if (t && t.length >= 2) words.push(t);
      });
    } catch (e) {
      console.warn('词库文件读取失败：' + file, e);
    }
  }
  sensitiveWords = words;
  sensitiveLoaded = true;
  console.log('敏感词库加载完成，共 ' + words.length + ' 条');
}

async function containsSensitiveWord(text) {
  await loadSensitiveWords();
  if (!sensitiveWords.length) return false;
  const lower = text.toLowerCase();
  for (const w of sensitiveWords) {
    if (lower.includes(w.toLowerCase())) return true;
  }
  return false;
}

// ===== 19. 举报功能 =====
function openReportModal(targetType, targetId) {
  if (!currentUser) return showToast('请先登录');
  if (currentProfile && currentProfile.is_banned) return showToast('你已被放逐，无法互动');
  if (document.getElementById('report-modal')) document.getElementById('report-modal').remove();

  const modal = document.createElement('div');
  modal.id = 'report-modal';
  modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:2000;display:flex;align-items:center;justify-content:center;';
  modal.innerHTML = `
    <div style="background:#fff;padding:24px;border-radius:12px;width:90%;max-width:400px;">
      <h3 style="margin-bottom:14px;color:var(--primary-dark);">举报内容</h3>
      <div style="font-size:13px;color:var(--muted);margin-bottom:12px;">请选择举报原因：</div>
      <div style="display:flex;flex-direction:column;gap:8px;">
        <label style="font-size:14px;"><input type="radio" name="report-reason" value="广告、外链、诈骗"> 广告、外链、诈骗</label>
        <label style="font-size:14px;"><input type="radio" name="report-reason" value="辱骂、人身攻击"> 辱骂、人身攻击</label>
        <label style="font-size:14px;"><input type="radio" name="report-reason" value="歧视"> 歧视</label>
        <label style="font-size:14px;"><input type="radio" name="report-reason" value="恶意剧透"> 恶意剧透</label>
        <label style="font-size:14px;"><input type="radio" name="report-reason" value="刷屏、重复内容"> 刷屏、重复内容</label>
        <label style="font-size:14px;"><input type="radio" name="report-reason" value="其他"> 其他</label>
      </div>
      <div style="display:flex;gap:8px;margin-top:20px;">
        <button class="btn btn-primary" onclick="submitReport('${targetType}', '${targetId}')" style="flex:1;">提交举报</button>
        <button class="btn" onclick="closeReportModal()" style="flex:1;">取消</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function closeReportModal() {
  const m = document.getElementById('report-modal');
  if (m) m.remove();
}

async function submitReport(targetType, targetId) {
  if (!currentUser) return showToast('请先登录');
  const selected = document.querySelector('input[name="report-reason"]:checked');
  if (!selected) return showToast('请选择举报原因');

  // 检查是否已举报过同一内容
  const { data: existing } = await db.from('reports')
    .select('id').eq('reporter_id', currentUser.id)
    .eq('target_type', targetType).eq('target_id', targetId).limit(1);
  if (existing && existing.length) {
    closeReportModal();
    return showToast('你已经举报过这条内容');
  }

  const { error } = await db.from('reports').insert({
    reporter_id: currentUser.id,
    target_type: targetType,
    target_id: targetId,
    reason: selected.value
  });
  if (error) return showToast('举报失败：' + error.message);
  closeReportModal();
  showToast('举报已提交，管理员会尽快处理');
}

// ===== 20. 管理后台 =====
const ADMIN_EMAILS = ['wuumiii@outlook.com']; // ← 改成你自己的邮箱

function isAdmin() {
  return currentUser && ADMIN_EMAILS.includes(currentUser.email);
}

async function initAdmin() {
  await checkUser();
  const root = $('#admin-app');
  if (!currentUser) {
    root.innerHTML = '<div class="empty">请先登录</div>';
    return;
  }
  if (!isAdmin()) {
    root.innerHTML = '<div class="empty">无权访问</div>';
    return;
  }

  // 加载待处理举报
  const { data: reports, error } = await db.from('reports').select('*').eq('status', 'pending').order('created_at', { ascending: false });
  if (error) { root.innerHTML = '<div class="empty">加载失败：' + error.message + '</div>'; return; }

  if (!reports || !reports.length) {
    root.innerHTML = `
      <div class="card" style="background:var(--primary-light);border-color:var(--primary);">
        <h3>管理后台</h3>
        <p style="margin-top:8px;font-size:13px;color:var(--text-muted);">当前没有待处理举报。</p>
      </div>
    `;
    return;
  }

  // 一次性把涉及到的评论查出来
  const commentIds = reports.filter(r => r.target_type === 'comment').map(r => r.target_id);
  const { data: comments } = await db.from('comments').select('id, content, post_id, user_id, status').in('id', commentIds);
  const commentMap = {};
  (comments || []).forEach(c => { commentMap[c.id] = c; });

  root.innerHTML = `
    <div class="card" style="background:var(--primary-light);border-color:var(--primary);">
      <h3>管理后台</h3>
      <p style="margin-top:8px;font-size:13px;color:var(--text-muted);">待处理举报：${reports.length} 条</p>
    </div>
    ${reports.map(r => {
      const c = commentMap[r.target_id];
      const commentText = c ? c.content : '（评论不存在或已被删除）';
      const commentStatus = c ? c.status : 'unknown';
      const time = new Date(r.created_at).toLocaleString('zh-CN');
      return `
        <div class="card" style="border-color:#f5c2c7;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;">
            <div style="flex:1;min-width:0;">
              <div style="font-size:13px;color:var(--muted);margin-bottom:6px;">
                举报原因：<b>${r.reason}</b> · ${time}
              </div>
              <div style="font-size:12px;color:var(--muted);margin-bottom:4px;">被举报内容：</div>
              <div style="background:var(--bg);padding:10px;border-radius:6px;font-size:14px;word-break:break-word;">${commentText}</div>
              <div style="font-size:12px;color:var(--muted);margin-top:6px;">
                帖子 ID：${c ? c.post_id : '未知'} · 当前状态：${commentStatus}
              </div>
            </div>
            <div style="display:flex;flex-direction:column;gap:8px;flex-shrink:0;">
              ${c && commentStatus === 'visible'
                ? `<button class="btn" style="border-color:#dc3545;color:#dc3545;" onclick="adminHideComment('${r.id}', '${c.id}')">隐藏评论</button>`
                : '<span style="font-size:12px;color:var(--muted);">评论已隐藏</span>'}
              <button class="btn" onclick="adminIgnoreReport('${r.id}')">忽略举报</button>
            </div>
          </div>
        </div>
      `;
    }).join('')}
  `;
}

async function adminHideComment(reportId, commentId) {
  const ok = confirm('确定隐藏这条评论吗？隐藏后用户将看不到它。');
  if (!ok) return;
  await db.from('comments').update({ status: 'hidden' }).eq('id', commentId);
  await db.from('reports').update({ status: 'handled' }).eq('id', reportId);
  showToast('评论已隐藏');
  await initAdmin();
}

async function adminIgnoreReport(reportId) {
  const ok = confirm('确定忽略这条举报吗？');
  if (!ok) return;
  await db.from('reports').update({ status: 'rejected' }).eq('id', reportId);
  showToast('举报已忽略');
  await initAdmin();
}
