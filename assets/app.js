function $(sel, root = document) { return root.querySelector(sel); }
function $$(sel, root = document) { return [...root.querySelectorAll(sel)]; }

function showToast(msg) {
  let t = $('#toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.className = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2000);
}

function parseFrontMatter(text) {
  // 自动清理编辑器带来的转义反斜杠（解决 \--- 导致识别失败的问题）
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
  let html = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g,
    '<img src="$2" alt="$1">');
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener">$1</a>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.split(/\n\n+/).map(p => {
    if (p.trim().startsWith('<')) return p;
    return '<p>' + p.replace(/\n/g, '<br>') + '</p>';
  }).join('');
  return html;
}

let CHARACTERS = {};
let POSTS = [];

async function loadData() {
  const [cRes, pRes] = await Promise.all([
    fetch('data/characters.json'),
    fetch('posts/posts.json')
  ]);
  CHARACTERS = await cRes.json();
  const list = (await pRes.json()).posts;
  POSTS = await Promise.all(list.map(async p => {
    const r = await fetch(p.file);
    const text = await r.text();
    const { data, content } = parseFrontMatter(text);
    return { id: p.id, ...data, content };
  }));
  POSTS.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

function avatarHTML(char, size = '') {
  const cls = 'avatar' + (size ? ' ' + size : '');
  const ch = (char && char.name) ? char.name.slice(0, 1) : '?';
  const img = char && char.avatar
    ? `<img src="${char.avatar}" alt="" onerror="this.style.display='none';this.parentNode.textContent='${ch}'">`
    : ch;
  return `<div class="${cls}">${img}</div>`;
}

function renderPostCard(post) {
  const char = CHARACTERS[post.character] || { name: post.character || '未知角色', handle: post.character || 'unknown' };
  const tags = (post.tags || []).map(t =>
    `<a class="tag" href="#">#${t}</a>`).join('');
  const verified = char.verified
    ? `<span class="verified">✓ ${char.verified}</span>` : '';
  return `
    <article class="post" data-id="${post.id}">
      <div class="post-header">
        ${avatarHTML(char)}
        <div class="post-meta">
          <div class="post-name">
            <a href="character.html?handle=${char.handle}">${char.name}</a>
            ${verified}
          </div>
          <div class="post-sub">
            @${char.handle} · ${post.date || ''}
            ${post.location ? ' · 📍' + post.location : ''}
          </div>
        </div>
      </div>
      <div class="post-body">${renderMarkdown(post.content)}</div>
      <div class="post-tags">${tags}</div>
      <div class="post-actions">
        <button class="action" data-act="like">♡ <span>0</span></button>
        <button class="action" data-act="comment">💬 <span>0</span></button>
        <button class="action" data-act="bookmark">🔖 <span>收藏</span></button>
      </div>
    </article>
  `;
}

function bindActions(root) {
  $$('.action', root).forEach(btn => {
    btn.addEventListener('click', () => {
      showToast('请先登录后再互动');
    });
  });
  $$('.post-body a', root).forEach(a => {
    a.target = '_blank';
    a.rel = 'noopener';
  });
}

async function initHome() {
  await loadData();
  const feed = $('#feed');
  if (!POSTS.length) {
    feed.innerHTML = '<div class="empty">还没有动态</div>';
    return;
  }
  feed.innerHTML = POSTS.map(renderPostCard).join('');
  bindActions(feed);

  const rec = $('#recommend');
  if (rec) {
    rec.innerHTML = Object.values(CHARACTERS).map(c => `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
        ${avatarHTML(c)}
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:14px">
            <a href="character.html?handle=${c.handle}">${c.name}</a>
          </div>
          <div style="font-size:12px;color:var(--text-muted)">@${c.handle}</div>
        </div>
      </div>
    `).join('');
  }
}

async function initCharacter() {
  await loadData();
  const handle = new URLSearchParams(location.search).get('handle') || 'daniel';
  const char = CHARACTERS[handle];
  const root = $('#profile');
  if (!char) {
    root.innerHTML = '<div class="empty">找不到这个角色</div>';
    return;
  }
  const posts = POSTS.filter(p => p.character === handle);
  const bannerStyle = char.banner
    ? `style="background-image:url('${char.banner}');background-size:cover;background-position:center"`
    : '';
  root.innerHTML = `
    <div class="profile-banner" ${bannerStyle}></div>
    <div class="profile-header">
      <div class="profile-avatar-row">
        ${avatarHTML(char, 'large')}
        <div class="profile-actions">
          <button class="btn btn-primary" onclick="alert('请先登录后再关注')">关注</button>
          <button class="btn" onclick="alert('请先登录后再私信')">私信</button>
        </div>
      </div>
      <div class="profile-name">${char.name}
        ${char.verified ? `<span class="verified">✓ ${char.verified}</span>` : ''}
      </div>
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
      <button class="active" data-tab="posts">动态</button>
      <button data-tab="follows">关注</button>
      <button data-tab="likes">点赞</button>
      <button data-tab="bookmarks">收藏</button>
    </div>
    <div id="tab-content"></div>
  `;
  const tabContent = $('#tab-content');
  const renderTab = (tab) => {
    if (tab === 'posts') {
      tabContent.innerHTML = posts.length
        ? posts.map(renderPostCard).join('')
        : '<div class="empty">还没有动态</div>';
      bindActions(tabContent);
    } else {
      tabContent.innerHTML = '<div class="empty">该角色未公开</div>';
    }
  };
  renderTab('posts');
  $$('.profile-tabs button').forEach(b => {
    b.addEventListener('click', () => {
      $$('.profile-tabs button').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      renderTab(b.dataset.tab);
    });
  });
}

async function initPost() {
  await loadData();
  const id = new URLSearchParams(location.search).get('id');
  const post = POSTS.find(p => p.id === id);
  const root = $('#post-detail');
  if (!post) {
    root.innerHTML = '<div class="empty">找不到这篇帖子</div>';
    return;
  }
  root.innerHTML = `
    <a href="index.html" style="font-size:14px">← 返回首页</a>
    <div style="margin-top:16px">${renderPostCard(post)}</div>
    <div class="card" style="margin-top:16px">
      <h3>评论</h3>
      <div class="empty">登录后可评论（每人每帖最多 3 条，每天最多 10 条）</div>
    </div>
  `;
  bindActions(root);
}
