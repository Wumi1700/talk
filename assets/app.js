// ===== 1. 初始化 Supabase =====
const SUPABASE_URL = 'https://nsoyywbuqpfhhrezdcly.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zb3l5d2J1cXBmaGhyZXpkY2x5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4MzMyODIsImV4cCI6MjEwNjQwOTI4Mn0.L17d0locmWHjQFykzv9bTjTyLZAk8LDyfSmpxbEnTgg';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===== 2. 全局变量 =====
let forumReadOnly = false;
let currentUser = null;
let POST_STATS = {}; // post_id -> { like_count, comment_count, is_liked, is_bookmarked }
let currentProfile = null;

// ===== 3. 工具函数 =====
function $(sel, root = document) { return root.querySelector(sel); }
function $$(sel, root = document) { return [...root.querySelectorAll(sel)]; }
// ===== 阵营测试题库 =====
const QUIZ_DATA = {
  '417号航线': [
    { q: '你更向往哪种环境？', options: [
      { text: '森林与远方', faction: '精灵' },
      { text: '熔炉与家园', faction: '矮人' },
      { text: '城镇与学院', faction: '人类' },
      { text: '荒野与部落', faction: '异人' },
    ]},
    { q: '面对冲突，你倾向于？', options: [
      { text: '回避观察', faction: '精灵' },
      { text: '正面硬刚', faction: '矮人' },
      { text: '谈判周旋', faction: '人类' },
      { text: '直接扑上去', faction: '异人' },
    ]},
    { q: '你认为自己最大的优势是？', options: [
      { text: '感知与敏捷', faction: '精灵' },
      { text: '力量与耐力', faction: '矮人' },
      { text: '智慧与应变', faction: '人类' },
      { text: '野性与本能', faction: '异人' },
    ]},
    { q: '周末你更可能做什么？', options: [
      { text: '独自远行', faction: '精灵' },
      { text: '打磨手艺', faction: '矮人' },
      { text: '泡图书馆', faction: '人类' },
      { text: '在野外奔跑', faction: '异人' },
    ]},
    { q: '你最看重什么？', options: [
      { text: '自由', faction: '精灵' },
      { text: '忠诚', faction: '矮人' },
      { text: '求知', faction: '人类' },
      { text: '生存', faction: '异人' },
    ]},
    { q: '对待陌生人的态度？', options: [
      { text: '观察后再接近', faction: '精灵' },
      { text: '保持警惕但可合作', faction: '矮人' },
      { text: '先交流了解', faction: '人类' },
      { text: '凭本能决定', faction: '异人' },
    ]},
  ],
  '240号航线': [
    { q: '当你看见钱，你会做什么？', options: [
      { text: '交给警察', faction: '240-1' },
      { text: '自己捡了', faction: '240' },
      { text: '无视', faction: '246' },
    ]},
    { q: '你经常违规吗？', options: [
      { text: '经常', faction: '240' },
      { text: '偶尔', faction: '240-1' },
      { text: '很少', faction: '246' },
    ]},
    { q: '你乐于尝试新事物吗？', options: [
      { text: '我喜欢创新', faction: '240' },
      { text: '一般', faction: '240-1' },
      { text: '我恐惧新事物', faction: '246' },
    ]},
    { q: '如果下一秒你会死，你会怎么做？', options: [
      { text: '我不想死', faction: '240-1' },
      { text: '哦', faction: '240' },
      { text: '再活一次', faction: '246' },
    ]},
    { q: '你更相信什么？', options: [
      { text: '自己', faction: '240' },
      { text: '规则', faction: '246' },
      { text: '同伴', faction: '240-1' },
    ]},
  ]
};

// 洗牌
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

let quizState = null;
let factionChangeMode = false;
// ===== 位置数据 =====
const LOCATIONS = {
  '417号航线': ['绿林', '荒芜地', '红叶镇', '石地', '白地', '洞穴', '山地'],
  '240号航线': ['72号老城', '圣彼得庄园', '白社区', '阿姆斯门特', '幸福泉', '下城警局', '混乱世界管理局', '中央法院', '黑皇后社区'],
  '无定所': ['流浪旅者'],
  '未知之地': ['未标记区域']
};

function parseLocation(str) {
  if (!str) return { region: '', detail: '' };
  const parts = str.split('·');
  return { region: parts[0] || '', detail: parts[1] || '' };
}
//======阵营称号========
function factionTitle(faction) {
  if (faction === '精灵') return '旅人';
  if (faction === '矮人') return '锻造学徒';
  if (faction === '人类') return '见习法师';
  if (faction === '异人') return '泥娃娃';
  if (faction === '240' || faction === '246' || faction === '240-1') return '人类';
  return '';
}
// ===== 阵营图标 =====
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

// ===== 应用阵营主题 =====
function applyFactionTheme() {
  document.body.classList.remove(
    'faction-elf', 'faction-dwarf', 'faction-human', 'faction-alien',
    'faction-240'
  );
  if (!currentProfile || !currentProfile.faction) return;
  const f = currentProfile.faction;
  if (f === '精灵') document.body.classList.add('faction-elf');
  else if (f === '矮人') document.body.classList.add('faction-dwarf');
  else if (f === '人类') document.body.classList.add('faction-human');
  else if (f === '异人') document.body.classList.add('faction-alien');
  else if (f === '240' || f === '246' || f === '240-1') document.body.classList.add('faction-240');
}
function relativeTime(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const now = new Date();
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return '刚刚';
  if (diff < 3600) return Math.floor(diff / 60) + ' 分钟前';
  if (diff < 86400) return Math.floor(diff / 3600) + ' 小时前';
  if (diff < 86400 * 7) return Math.floor(diff / 86400) + ' 天前';
  if (diff < 86400 * 30) return Math.floor(diff / 86400 / 7) + ' 周前';
  if (diff < 86400 * 365) return Math.floor(diff / 86400 / 30) + ' 个月前';
  return Math.floor(diff / 86400 / 365) + ' 年前';
}
// ===== 用户头像 HTML =====
function userAvatarHTML(profile, size = 28) {
  const ch = (profile && profile.username) ? profile.username.slice(0, 1) : '?';
  const url = profile && profile.avatar_url;
  const style = `width:${size}px;height:${size}px;border-radius:50%;background:var(--primary-light);color:var(--primary-dark);display:flex;align-items:center;justify-content:center;font-weight:700;overflow:hidden;flex-shrink:0;font-size:${Math.round(size*0.45)}px;`;
  if (url) {
    return `<div style="${style};cursor:zoom-in;" onclick="openImageViewer('${url}')"><img src="${url}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none';this.parentNode.textContent='${ch}'"></div>`;
  }
  return `<div style="${style}">${ch}</div>`;
}

// ===== 图片压缩 =====
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

// ===== 上传图片到 Storage =====
async function uploadToStorage(blob, bucket, field) {
  const path = `${currentUser.id}/${Date.now()}.webp`;
  const { error } = await db.storage.from(bucket).upload(path, blob, { upsert: true, contentType: 'image/webp' });
  if (error) throw error;
  const { data: { publicUrl } } = db.storage.from(bucket).getPublicUrl(path);

  const { error: e2 } = await db.from('profiles').update({ [field]: publicUrl }).eq('id', currentUser.id);
  if (e2) throw e2;

  currentProfile[field] = publicUrl;
  return publicUrl;
}

// ===== 选择并上传头像/背景 =====
async function pickAndUpload(bucket, maxW, maxH, maxKB, field, aspectRatio = 1) {
  if (!currentUser) return showToast('请先登录');
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/jpeg,image/png,image/webp';
  input.onchange = () => {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) return showToast('原图太大（超过 10MB），请换一张');
    openCropperDialog(file, bucket, maxW, maxH, maxKB, field, aspectRatio);
  };
  input.click();
}

function openCropperDialog(file, bucket, maxW, maxH, maxKB, field, aspectRatio) {
  if (typeof Cropper === 'undefined') {
    showToast('裁剪库未加载，请刷新重试');
    return;
  }
  const url = URL.createObjectURL(file);
  const dialog = document.createElement('div');
  dialog.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;';
  dialog.innerHTML = `
    <div style="width:100%;max-width:600px;background:#fff;border-radius:12px;padding:16px;box-sizing:border-box;">
      <h3 style="margin-bottom:12px;font-size:16px;">调整图片（拖动和缩放）</h3>
      <div style="max-height:60vh;overflow:hidden;background:#f0f0f0;border-radius:8px;">
        <img id="cropper-img" src="${url}" style="max-width:100%;display:block;">
      </div>
      <div style="display:flex;gap:8px;margin-top:16px;justify-content:flex-end;">
        <button class="btn" id="crop-cancel">取消</button>
        <button class="btn btn-primary" id="crop-confirm">确认上传</button>
      </div>
    </div>
  `;
  document.body.appendChild(dialog);

  const imgEl = dialog.querySelector('#cropper-img');
  let cropper = null;

  const cleanup = () => {
    if (cropper) { try { cropper.destroy(); } catch(e){} cropper = null; }
    URL.revokeObjectURL(url);
    dialog.remove();
  };

  imgEl.onload = () => {
    cropper = new Cropper(imgEl, {
      aspectRatio: aspectRatio,
      viewMode: 1,
      dragMode: 'move',
      autoCropArea: 0.85,
      background: false,
      responsive: true,
      guides: true,
      center: true,
      highlight: false,
      cropBoxMovable: true,
      cropBoxResizable: true,
      toggleDragModeOnDblclick: false,
    });
  };

  dialog.querySelector('#crop-cancel').onclick = cleanup;

  dialog.querySelector('#crop-confirm').onclick = () => {
    if (!cropper) return showToast('图片加载中，请稍候');
    const canvas = cropper.getCroppedCanvas({
      width: maxW,
      height: maxH,
      imageSmoothingQuality: 'high'
    });
    if (!canvas) return showToast('裁剪失败');

    // 质量从 0.9 开始，压到目标大小
    let quality = 0.9;
    const tryBlob = (q) => new Promise(r => canvas.toBlob(r, 'image/webp', q));

    (async () => {
      let blob = await tryBlob(quality);
      while (blob && blob.size > maxKB * 1024 && quality > 0.4) {
        quality -= 0.1;
        blob = await tryBlob(quality);
      }
      if (!blob) return showToast('图片处理失败');
      if (blob.size > maxKB * 1024) return showToast('图片仍超过 ' + maxKB + 'KB，请重试');

      try {
        await uploadToStorage(blob, bucket, field);
        showToast('已更新');
        updateUIForLoggedIn();
        if (document.getElementById('settings-app')) initSettings();
        if (document.getElementById('user-profile')) initProfile();
      } catch (e) {
        showToast('上传失败：' + (e.message || '未知错误'));
      }
      cleanup();
    })();
  };
}

// ===== 随机加载提示 =====
const LOADING_TIPS = [
  '找钥匙中🔑…',
  '正在翻页…',
  '连接航线中…',
  '太五日报正在印刷📰…',
  '旅者，稍等…',
  '轨道正在对齐…',
  '世界意志正在回应…',
  '正在整理档案…',
  '航线正在接通…',
  '正在唤醒角色…',
];

function renderLoadingHTML() {
  const tip = LOADING_TIPS[Math.floor(Math.random() * LOADING_TIPS.length)];
  return `<div class="empty" style="padding:80px 20px;text-align:center;color:var(--muted);font-size:14px;letter-spacing:1px;">
    <div style="font-size:24px;margin-bottom:12px;">📡</div>
    ${tip}
  </div>`;
}

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
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" onclick="openImageViewer(\'' + '$2' + '\')">');
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  return html.split(/\n\n+/).map(p => '<p>'+p.replace(/\n/g,'<br>')+'</p>').join('');
}
function avatarHTML(char, size = '') {
  const cls = 'avatar' + (size ? ' ' + size : '');
  const ch = (char && char.name) ? char.name.slice(0, 1) : '?';
  if (char && char.avatar) {
    return `<div class="${cls}" style="cursor:zoom-in;" onclick="openImageViewer('${char.avatar}')"><img src="${char.avatar}" alt="" onerror="this.style.display='none';this.parentNode.textContent='${ch}'"></div>`;
  }
  return `<div class="${cls}">${ch}</div>`;
}

// ===== 4. 认证相关 =====
let _checkUserPromise = null;
async function checkUser() {
  if (_checkUserPromise) return _checkUserPromise;
  _checkUserPromise = (async () => {
    const { data: { user } } = await db.auth.getUser();
    currentUser = user;
    if (user) {
      const { data: profile } = await db.from('profiles').select('*').eq('id', user.id).single();
      currentProfile = profile;
      if (!profile) {
        openFactionModal();
      } else if (profile.is_banned) {
        showBannedScreen();
        applyFactionTheme();
        return;
      } else {
        updateUIForLoggedIn();
      }
    } else {
      updateUIForLoggedOut();
    }
    applyFactionTheme();
    if (typeof renderSidebar === 'function') await renderSidebar();
  })();
  const r = await _checkUserPromise;
  _checkUserPromise = null;
  return r;
}

function updateUIForLoggedIn() {
  const actions = document.querySelector('.topbar-actions');
  if (actions && currentProfile) {
    actions.style.display = 'flex';
    actions.style.alignItems = 'center';
    actions.style.gap = '10px';
    actions.innerHTML = `
      ${userAvatarHTML(currentProfile, 28)}
      <span style="font-size:14px;font-weight:600;">${currentProfile.faction ? factionIcon(currentProfile.faction) + ' [' + currentProfile.faction + '] ' : ''}${currentProfile.username || '用户'}</span>
      <button class="btn" onclick="handleLogout()">退出</button>
    `;
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

function openFactionModal(isChange = false) {
  const m = document.getElementById('faction-modal');
  if (!m) {
    showToast('页面未加载弹窗，请刷新');
    return;
  }
  factionChangeMode = !!isChange;
  m.innerHTML = '<div id="faction-modal-content" style="background:#fff;padding:24px;border-radius:12px;width:90%;max-width:520px;max-height:85vh;overflow-y:auto;box-sizing:border-box;"></div>';
  m.style.display = 'flex';
  renderRouteSelection();
}

function renderRouteSelection() {
  const c = document.getElementById('faction-modal-content');
  if (!c) return;
  c.innerHTML = `
    <h2 style="margin-bottom:10px;color:var(--primary-dark);">${factionChangeMode ? '重新选择航线' : '选择你的航线'}</h2>
    <p style="font-size:13px;color:var(--muted);margin-bottom:16px;line-height:1.7;">
      两条航线，两种人生。<br>
      选定后 3 个月内不可更改。
    </p>
    <div style="display:flex;flex-direction:column;gap:10px;">
      <button class="btn" onclick="startQuiz('417号航线')" style="padding:16px;font-size:15px;text-align:left;">
        <b>417号航线</b>
        <div style="font-size:12px;color:var(--muted);margin-top:4px;">奇幻大陆 · 精灵 / 矮人 / 人类 / 异人</div>
      </button>
      <button class="btn" onclick="startQuiz('240号航线')" style="padding:16px;font-size:15px;text-align:left;">
        <b>240号航线</b>
        <div style="font-size:12px;color:var(--muted);margin-top:4px;">现实社会 · 240 / 246 / 240-1</div>
      </button>
      <button class="btn" disabled style="padding:16px;font-size:15px;text-align:left;opacity:0.4;cursor:not-allowed;">
        <b>327号航线</b>
        <div style="font-size:12px;color:var(--muted);margin-top:4px;">未开放</div>
      </button>
      <button class="btn" disabled style="padding:16px;font-size:15px;text-align:left;opacity:0.4;cursor:not-allowed;">
        <b>493号航线</b>
        <div style="font-size:12px;color:var(--muted);margin-top:4px;">未开放</div>
      </button>
      <button class="btn" disabled style="padding:16px;font-size:15px;text-align:left;opacity:0.4;cursor:not-allowed;">
        <b>361号航线</b>
        <div style="font-size:12px;color:var(--muted);margin-top:4px;">未开放</div>
      </button>
    </div>
  `;
}

function startQuiz(route) {
  const questions = QUIZ_DATA[route];
  if (!questions) return showToast('该航线暂未开放');
  quizState = {
    route: route,
    questions: questions.map(q => ({
      q: q.q,
      options: shuffle([...q.options])
    })),
    current: 0,
    scores: {}
  };
  renderQuizQuestion();
}

function renderQuizQuestion() {
  const c = document.getElementById('faction-modal-content');
  if (!c || !quizState) return;
  const { questions, current } = quizState;
  if (current >= questions.length) {
    renderQuizResult();
    return;
  }
  const q = questions[current];
  c.innerHTML = `
    <div style="font-size:12px;color:var(--muted);margin-bottom:8px;">${quizState.route} · 第 ${current + 1} / ${questions.length} 题</div>
    <h3 style="margin-bottom:18px;font-size:17px;line-height:1.5;">${q.q}</h3>
    <div style="display:flex;flex-direction:column;gap:10px;">
      ${q.options.map((o, i) => `
        <button class="btn" onclick="answerQuestion(${i})" style="padding:14px;font-size:14px;text-align:left;">${o.text}</button>
      `).join('')}
    </div>
  `;
}

function answerQuestion(optionIndex) {
  const q = quizState.questions[quizState.current];
  const opt = q.options[optionIndex];
  quizState.scores[opt.faction] = (quizState.scores[opt.faction] || 0) + 3;
  quizState.current++;
  renderQuizQuestion();
}

function renderQuizResult() {
  const c = document.getElementById('faction-modal-content');
  if (!c) return;
  const scores = quizState.scores;
  const maxScore = Math.max(...Object.values(scores));
  const recommended = Object.keys(scores).filter(k => scores[k] === maxScore);

  c.innerHTML = `
    <h2 style="margin-bottom:10px;color:var(--primary-dark);">你的归属</h2>
    <p style="font-size:13px;color:var(--muted);margin-bottom:16px;line-height:1.7;">
      基于你的回答，我们为你推荐以下身份：
    </p>
    <div style="display:flex;flex-direction:column;gap:10px;">
      ${recommended.map(f => `
        <button class="btn btn-primary" onclick="finalizeFaction('${f}')" style="padding:16px;font-size:15px;text-align:left;">
          <span style="font-size:18px;margin-right:8px;">${factionIcon(f)}</span>
          <b>${f}</b> · ${factionTitle(f)}
        </button>
      `).join('')}
      <button class="btn" onclick="renderRouteSelection()" style="margin-top:8px;">返回重选航线</button>
    </div>
    <p style="font-size:12px;color:var(--muted);margin-top:16px;line-height:1.7;">
      如果你不想接受推荐，可以返回重做测试。
    </p>
  `;
}

async function finalizeFaction(faction) {
  if (!currentUser) return;
  let username;

  if (factionChangeMode && currentProfile) {
    const ok = confirm('重新选择身份将清空你之前阵营的全部任务进度与特殊声望，确定吗？');
    if (!ok) return;
    username = currentProfile.username || '旅者';
  } else {
    username = prompt('请输入你的昵称：') || '';
    if (!username.trim()) return showToast('昵称不能为空');
    if (username.length > 20) return showToast('昵称最多 20 字');
    if (await containsSensitiveWord(username)) return showToast('昵称包含敏感词');
    if (containsLink(username)) return showToast('昵称不允许包含外链');
  }

  if (factionChangeMode && currentProfile) {
    const { error } = await db.from('profiles').update({
      faction: faction,
      route: quizState.route,
      faction_chosen_at: new Date().toISOString()
    }).eq('id', currentUser.id);
    if (error) return showToast('保存失败：' + error.message);
    showToast('你已加入 ' + faction);
  } else {
    const { error } = await db.from('profiles').insert({
      id: currentUser.id,
      username: username.trim(),
      faction: faction,
      route: quizState.route,
      faction_chosen_at: new Date().toISOString()
    });
    if (error) return showToast('保存失败：' + error.message);
    showToast('欢迎来到 ' + faction);
  }

  quizState = null;
  factionChangeMode = false;
  await checkUser();

  // 如果是老用户改阵营，直接关；新用户，弹推荐
  if (factionChangeMode === false) {
    await showRecommendedCharacters(faction);
  } else {
    const m = document.getElementById('faction-modal');
    if (m) m.style.display = 'none';
  }
}

async function showRecommendedCharacters(myFaction) {
  const m = document.getElementById('faction-modal');
  const c = document.getElementById('faction-modal-content');
  if (!m || !c) return;

  // 同阵营优先，不够用其他补
  const all = Object.values(CHARACTERS).filter(ch => ch.faction);
  const sameFaction = all.filter(ch => ch.faction === myFaction);
  const others = all.filter(ch => ch.faction !== myFaction);
  const recommended = [...sameFaction, ...others].slice(0, 3);

  if (!recommended.length) {
    m.style.display = 'none';
    return;
  }

  c.innerHTML = `
    <h2 style="margin-bottom:10px;color:var(--primary-dark);">为你推荐</h2>
    <p style="font-size:13px;color:var(--muted);margin-bottom:16px;line-height:1.7;">
      这些角色和你在同一个世界。<br>
      关注他们，以后会在首页优先看到他们的动态。
    </p>
    <div style="display:flex;flex-direction:column;gap:10px;">
      ${recommended.map(ch => `
        <div style="display:flex;align-items:center;gap:12px;padding:12px;border:1px solid var(--border);border-radius:10px;">
          ${avatarHTML(ch)}
          <div style="flex:1;min-width:0;">
            <div style="font-weight:600;">
              ${ch.faction ? factionIcon(ch.faction) + ' ' : ''}${ch.name}
              ${ch.verified ? `<span class="verified">✓ ${ch.verified}</span>` : ''}
            </div>
            <div style="font-size:13px;color:var(--muted);">@${ch.handle} · ${ch.bio || ''}</div>
          </div>
          <button class="btn btn-primary follow-rec-btn" data-handle="${ch.handle}" onclick="followRecommended('${ch.handle}', this)">关注</button>
        </div>
      `).join('')}
    </div>
    <button class="btn" onclick="closeRecommended()" style="width:100%;margin-top:16px;">进入 TALK</button>
  `;
  m.style.display = 'flex';
}

async function followRecommended(handle, btn) {
  if (!currentUser) return;
  await db.from('follows').insert({ character_id: handle, user_id: currentUser.id });
  btn.textContent = '已关注';
  btn.classList.remove('btn-primary');
  btn.classList.add('btn');
  btn.disabled = true;
  btn.style.opacity = '0.6';
}

function closeRecommended() {
  const m = document.getElementById('faction-modal');
  if (m) m.style.display = 'none';
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

async function handleLogin() {
  const email = document.getElementById('auth-email').value;
  const password = document.getElementById('auth-password').value;
  if (!email || !password) return showToast('请填写邮箱和密码');
  const { error } = await db.auth.signInWithPassword({ email, password });
  if (error) return showToast('登录失败：' + error.message);
  showToast('欢迎回来');
  closeAuthModal();
  await checkUser();
  location.reload();
}

async function handleRegister() {
  const email = document.getElementById('auth-email').value;
  const password = document.getElementById('auth-password').value;
  if (!email || !password || password.length < 6) return showToast('密码至少6位');

  const { data, error } = await db.auth.signUp({ email, password });
  if (error) return showToast('注册失败：' + error.message);

  closeAuthModal();

  // 稍等一下，让 Supabase 建立 session
  setTimeout(async () => {
    const { data: { user } } = await db.auth.getUser();

    if (!user) {
      // 邮箱确认还开着：用户未登录，无法选阵营
      showToast('注册成功，请先到邮箱点击确认链接，再回来登录');
      return;
    }

    // 已自动登录，弹阵营窗口
    currentUser = user;
    const m = document.getElementById('faction-modal');
    if (m) m.style.display = 'flex';
  }, 600);
}
async function handleLogout() {
  await db.auth.signOut(); currentUser = null; currentProfile = null;
  showToast('你离开了 TALK'); updateUIForLoggedOut(); location.reload();
}

// ===== 5. 数据加载与渲染 =====
let CHARACTERS = {}, POSTS = [];
async function loadData() {
  // 用 sessionStorage 缓存，30 分钟有效
  const CACHE_KEY = 'talk_data_cache_v1';
  const CACHE_TTL = 30 * 60 * 1000;

  try {
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) {
      const obj = JSON.parse(cached);
      if (Date.now() - obj.t < CACHE_TTL) {
        CHARACTERS = obj.chars;
        POSTS = obj.posts;
        return;
      }
    }
  } catch (e) {}

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

  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({
      t: Date.now(),
      chars: CHARACTERS,
      posts: POSTS
    }));
  } catch (e) {}
}

async function loadPostStats() {
  POST_STATS = {};
  POSTS.forEach(p => {
    POST_STATS[p.id] = { like_count: 0, comment_count: 0, is_liked: false, is_bookmarked: false };
  });
  if (typeof FORUM_POSTS !== 'undefined' && Array.isArray(FORUM_POSTS)) {
    FORUM_POSTS.forEach(p => {
      if (!POST_STATS[p.id]) {
        POST_STATS[p.id] = { like_count: 0, comment_count: 0, is_liked: false, is_bookmarked: false };
      }
    });
  }
  if (!currentUser) return;
  const { data, error } = await db.rpc('get_posts_stats', { p_user_id: currentUser.id });
  if (error) { console.warn('批量查询失败', error); return; }
  (data || []).forEach(row => {
    POST_STATS[row.post_id] = {
      like_count: Number(row.like_count) || 0,
      comment_count: Number(row.comment_count) || 0,
      is_liked: row.is_liked,
      is_bookmarked: row.is_bookmarked,
    };
  });
}

function renderPostImages(images) {
  if (!images || !images.length) return '';
  const count = Math.min(images.length, 4);
  const cls = 'post-images post-images-' + count;
  return `<div class="${cls}">${images.slice(0, 4).map(img =>
    `<img src="${img}" alt="" loading="lazy" onclick="event.stopPropagation();openImageViewer('${img}')">`
  ).join('')}</div>`;
}

function openImageViewer(src) {
  const existing = document.getElementById('image-viewer');
  if (existing) existing.remove();
  const viewer = document.createElement('div');
  viewer.id = 'image-viewer';
  viewer.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.92);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:zoom-out;padding:20px;';
  viewer.innerHTML = `<img src="${src}" style="max-width:90%;max-height:90%;border-radius:8px;">`;
  viewer.addEventListener('click', () => viewer.remove());
  const onEsc = (e) => { if (e.key === 'Escape') { viewer.remove(); document.removeEventListener('keydown', onEsc); } };
  document.addEventListener('keydown', onEsc);
  document.body.appendChild(viewer);
}

async function renderPostCard(post, isDetail = false) {
  const char = CHARACTERS[post.character] || { name: post.character || '未知角色', handle: post.character || 'unknown' };
  const tags = (post.tags || []).map(t => `<span class="tag">#${t}</span>`).join('');
  const verified = char.verified ? `<span class="verified">✓ ${char.verified}</span>` : '';

  // 从缓存读，缓存没有就补一次查询
  let stats = POST_STATS[post.id];
  if (!stats) {
    const uid = currentUser ? currentUser.id : null;
    const { count: likeCount } = await db.from('likes').select('*', { count: 'exact', head: true }).eq('post_id', post.id);
    const { count: commentCount } = await db.from('comments').select('*', { count: 'exact', head: true }).eq('post_id', post.id).eq('status', 'visible');
    let isLiked = false, isBookmarked = false;
    if (uid) {
      const { data: la } = await db.from('likes').select('id').eq('post_id', post.id).eq('user_id', uid).limit(1);
      isLiked = la && la.length > 0;
      const { data: ba } = await db.from('bookmarks').select('id').eq('post_id', post.id).eq('user_id', uid).limit(1);
      isBookmarked = ba && ba.length > 0;
    }
    stats = { like_count: likeCount || 0, comment_count: commentCount || 0, is_liked: isLiked, is_bookmarked: isBookmarked };
    POST_STATS[post.id] = stats;
  }

  const { like_count: likeCount, comment_count: commentCount, is_liked: isLiked, is_bookmarked: isBookmarked } = stats;

  const guard = (call) => forumReadOnly ? `showToast('你不是这个阵营的成员')` : call;
  const cardClick = isDetail ? '' : `style="cursor:pointer;" onclick="if(event.target.closest('button') || event.target.closest('a'))return;location.href='post.html?id=${post.id}'"`;

  return `
    <article class="post" data-id="${post.id}" ${cardClick}>
      <div class="post-header">
        ${avatarHTML(char)}
        <div class="post-meta">
          <div class="post-name">${char.faction ? factionIcon(char.faction) + ' ' : ''}<a href="character.html?handle=${char.handle}">${char.name}</a>${verified}</div>
          <div class="post-sub">@${char.handle} · ${relativeTime(post.date)}${post.location ? ' · 📍'+post.location : ''}</div>
        </div>
      </div>
      <div class="post-body">${renderMarkdown(post.content)}</div>
      ${renderPostImages(post.images)}
      <div class="post-tags">${tags}</div>
      <div class="post-actions">
        <button class="action ${isLiked ? 'liked' : ''}" onclick="${guard(`toggleLike('${post.id}', this)`)}"><span class="heart-icon">${isLiked ? '♥' : '♡'}</span> <span class="like-count">${likeCount}</span></button>
        <button class="action" onclick="location.href='post.html?id=${post.id}'">💬 <span>${commentCount}</span></button>
        <button class="action ${isBookmarked ? 'bookmarked' : ''}" onclick="${guard(`toggleBookmark('${post.id}', this)`)}">🔖 <span>${isBookmarked ? '已赞同' : '赞同'}</span></button>
      </div>
    </article>
  `;
}

// ===== 6. 互动功能 =====
async function toggleLike(postId, btn) {
  if (!currentUser) return showToast('请先登录');
  if (currentProfile && currentProfile.is_banned) return showToast('你已被放逐，无法互动');
  const countSpan = btn.querySelector('.like-count');
  const heartSpan = btn.querySelector('.heart-icon');
  const isLiked = btn.classList.contains('liked');
  if (isLiked) {
    await db.from('likes').delete().eq('post_id', postId).eq('user_id', currentUser.id);
    btn.classList.remove('liked');
    countSpan.textContent = Math.max(0, parseInt(countSpan.textContent) - 1);
    if (heartSpan) heartSpan.textContent = '♡';
  } else {
    await db.from('likes').insert({ post_id: postId, user_id: currentUser.id });
    btn.classList.add('liked');
    btn.style.animation = 'none';
    void btn.offsetWidth;
    btn.style.animation = 'heart-pop 0.4s ease-in-out';
    countSpan.textContent = parseInt(countSpan.textContent) + 1;
    if (heartSpan) heartSpan.textContent = '♥';
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

  // 批量查所有评论者的昵称和头像
  const userIds = [...new Set(data.map(c => c.user_id).filter(Boolean))];
  const profileMap = {};
  if (userIds.length) {
    const { data: profiles } = await db.from('profiles').select('id, username, avatar_url, faction').in('id', userIds);
    (profiles || []).forEach(p => { profileMap[p.id] = p; });
  }

  // 组织树形结构
  const roots = data.filter(c => !c.parent_id);
  const repliesMap = {};
  data.filter(c => c.parent_id).forEach(c => {
    if (!repliesMap[c.parent_id]) repliesMap[c.parent_id] = [];
    repliesMap[c.parent_id].push(c);
  });

  function renderOne(c, isReply) {
    const p = profileMap[c.user_id] || {};
    const isMe = currentUser && c.user_id === currentUser.id;
    const displayName = p.username || '匿名旅者';
    const nameHTML = isMe
      ? `<b>${displayName.replace(/</g,'&lt;')}</b>`
      : `<a href="user.html?id=${c.user_id}" style="color:var(--primary-dark);font-weight:600;">${displayName.replace(/</g,'&lt;')}</a>`;
    const avatarHTMLSmall = userAvatarHTML(p, 24);
    const factionIconHTML = p.faction ? factionIcon(p.faction) + ' ' : '';

    const count = likeCounts[c.id] || 0;
    const liked = !!likedByMe[c.id];
    const canDelete = isMe;
    return `
      <div style="font-size:13px;margin-bottom:8px;padding:8px;background:var(--bg);border-radius:6px;${isReply ? 'margin-left:24px;border-left:2px solid var(--border);' : ''}">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
          ${avatarHTMLSmall}
          <span>${factionIconHTML}${nameHTML}</span>
        </div>
        <div style="word-break:break-word;line-height:1.6;">${c.content.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
        <div style="margin-top:6px;display:flex;gap:12px;flex-wrap:wrap;">
          <button class="comment-like-btn" data-liked="${liked}" onclick="toggleCommentLike('${c.id}', this)" style="background:none;border:none;color:${liked ? '#E76F51' : 'var(--muted)'};cursor:pointer;font-size:12px;font-family:inherit;padding:0;">
            <span class="heart-icon">${liked ? '♥' : '♡'}</span> <span class="like-count">${count}</span>
          </button>
          <button onclick="showReplyBox('${c.id}')" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:12px;font-family:inherit;padding:0;">回复</button>
          <button onclick="openReportModal('comment', '${c.id}')" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:12px;font-family:inherit;padding:0;">举报</button>
          ${canDelete ? `<button onclick="deleteOwnComment('${c.id}', '${postId}')" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:12px;font-family:inherit;padding:0;">删除</button>` : ''}
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

  function renderOne(c, isReply) {
    const p = profileMap[c.user_id] || {};
    const isMe = currentUser && c.user_id === currentUser.id;
    const displayName = p.username || '匿名旅者';
    const nameHTML = isMe
      ? `<b>${displayName.replace(/</g,'&lt;')}</b>`
      : `<a href="user.html?id=${c.user_id}" style="color:var(--primary-dark);font-weight:600;">${displayName.replace(/</g,'&lt;')}</a>`;
    const avatarHTMLSmall = userAvatarHTML(p, 24);
    const factionIconHTML = p.faction ? factionIcon(p.faction) + ' ' : '';

    const count = likeCounts[c.id] || 0;
    const liked = !!likedByMe[c.id];
    const canDelete = isMe;
    return `
      <div style="font-size:13px;margin-bottom:8px;padding:8px;background:var(--bg);border-radius:6px;${isReply ? 'margin-left:24px;border-left:2px solid var(--border);' : ''}">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
          ${avatarHTMLSmall}
          <span>${factionIconHTML}${nameHTML}</span>
        </div>
        <div style="word-break:break-word;line-height:1.6;">${c.content.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
        <div style="margin-top:6px;display:flex;gap:12px;flex-wrap:wrap;">
          <button class="comment-like-btn" data-liked="${liked}" onclick="toggleCommentLike('${c.id}', this)" style="background:none;border:none;color:${liked ? '#E76F51' : 'var(--muted)'};cursor:pointer;font-size:12px;font-family:inherit;padding:0;">
            <span class="heart-icon">${liked ? '♥' : '♡'}</span> <span class="like-count">${count}</span>
          </button>
          <button onclick="showReplyBox('${c.id}')" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:12px;font-family:inherit;padding:0;">回复</button>
          <button onclick="openReportModal('comment', '${c.id}')" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:12px;font-family:inherit;padding:0;">举报</button>
          ${canDelete ? `<button onclick="deleteOwnComment('${c.id}', '${postId}')" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:12px;font-family:inherit;padding:0;">删除</button>` : ''}
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
  if (containsLink(content)) return showToast('不允许发布外链或联系方式');
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
  const countSpan = btn.querySelector('.like-count');
  const heartSpan = btn.querySelector('.heart-icon');
  const isLiked = btn.dataset.liked === 'true';
  if (isLiked) {
    await db.from('comment_likes').delete().eq('comment_id', commentId).eq('user_id', currentUser.id);
    btn.dataset.liked = 'false';
    btn.style.color = 'var(--muted)';
    countSpan.textContent = Math.max(0, parseInt(countSpan.textContent) - 1);
    if (heartSpan) heartSpan.textContent = '♡';
  } else {
    await db.from('comment_likes').insert({ comment_id: commentId, user_id: currentUser.id });
    btn.dataset.liked = 'true';
    btn.style.color = '#E76F51';
    btn.classList.remove('pop');
    void btn.offsetWidth;
    btn.classList.add('pop');
    countSpan.textContent = parseInt(countSpan.textContent) + 1;
    if (heartSpan) heartSpan.textContent = '♥';
  }
}

async function submitComment(postId) {
  if (!currentUser) return showToast('请先登录');
  if (forumReadOnly) return showToast('你不是这个阵营的成员');
  if (currentProfile && currentProfile.is_banned) return showToast('你已被放逐，无法互动');
  const input = document.getElementById(`comment-input-${postId}`);
  const content = input.value.trim();
  if (await containsSensitiveWord(content)) {
    return showToast('你的内容包含敏感词，请修改后重试');
  }
  if (containsLink(content)) return showToast('不允许发布外链或联系方式');
  if (!content) return showToast('请输入评论内容');
  if (content.length > 500) return showToast('评论最多500字');

  const { count: postCount } = await db.from('comments').select('*', { count: 'exact', head: true }).eq('post_id', postId).eq('user_id', currentUser.id);
  if (postCount >= 3) return showToast('每帖最多评论3条');

  const today = new Date().toISOString().split('T')[0];
  const { count: dayCount } = await db.from('comments').select('*', { count: 'exact', head: true }).eq('user_id', currentUser.id).gte('created_at', today);
  if (dayCount >= 10) return showToast('每天最多评论10条');

  const { error } = await db.from('comments').insert({ post_id: postId, user_id: currentUser.id, content: content });
  if (error) return showToast('评论失败：' + error.message);
  showToast('你说了一句话');
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
    showToast('你暂时放下了他');
  } else {
    await db.from('follows').insert({ character_id: charHandle, user_id: currentUser.id });
    btn.classList.add('following', 'btn-primary');
    btn.classList.remove('btn');
    btn.textContent = '已关注';
    const countEl = document.getElementById('follower-count');
    if (countEl) countEl.textContent = parseInt(countEl.textContent) + 1;
    showToast('你已经记住了 ' + charHandle);
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
  if (containsLink(content)) return showToast('不允许发布外链或联系方式');
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
  
  showToast('信已经送出去了');
  input.value = '';
  await initMessage();
}

// ===== 用户统计 =====
async function getUserStats() {
  if (!currentUser) return null;
  const [follow, like, bookmark, comment, message, replied] = await Promise.all([
    db.from('follows').select('*', { count: 'exact', head: true }).eq('user_id', currentUser.id).then(r => r.count || 0),
    db.from('likes').select('*', { count: 'exact', head: true }).eq('user_id', currentUser.id).then(r => r.count || 0),
    db.from('bookmarks').select('*', { count: 'exact', head: true }).eq('user_id', currentUser.id).then(r => r.count || 0),
    db.from('comments').select('*', { count: 'exact', head: true }).eq('user_id', currentUser.id).then(r => r.count || 0),
    db.from('messages').select('*', { count: 'exact', head: true }).eq('user_id', currentUser.id).then(r => r.count || 0),
    db.from('messages').select('*', { count: 'exact', head: true }).eq('user_id', currentUser.id).eq('is_from_character', true).then(r => r.count || 0),
  ]);
  const joinedDays = Math.floor((Date.now() - new Date(currentUser.created_at).getTime()) / 86400000);
  return { follow, like, bookmark, comment, message, replied, joinedDays };
}

// ===== 成就渲染 =====
function renderAchievements(s) {
  const list = [
    { icon: '🌱', name: '初次登场', desc: '完成注册并选择阵营', unlocked: true },
    { icon: '♡', name: '第一次点赞', desc: '为任意帖子点过赞', unlocked: s.like > 0 },
    { icon: '💬', name: '第一次发言', desc: '发表过评论', unlocked: s.comment > 0 },
    { icon: '🔖', name: '第一次收藏', desc: '收藏过帖子', unlocked: s.bookmark > 0 },
    { icon: '✉️', name: '第一封信', desc: '给角色发过私信', unlocked: s.message > 0 },
    { icon: '👥', name: '关注五人', desc: '关注 5 个角色', unlocked: s.follow >= 5 },
    { icon: '💫', name: '被回应', desc: '被角色回复过私信', unlocked: s.replied > 0 },
    { icon: '📅', name: '旅者', desc: '加入满 7 天', unlocked: s.joinedDays >= 7 },
    { icon: '🌟', name: '老旅者', desc: '加入满 30 天', unlocked: s.joinedDays >= 30 },
    { icon: '🏆', name: '资深旅者', desc: '加入满 100 天', unlocked: s.joinedDays >= 100 },
  ];
  const unlockedCount = list.filter(a => a.unlocked).length;
  return `
    <div class="card">
      <h3>成就 <span style="font-size:13px;color:var(--muted);font-weight:400;">已解锁 ${unlockedCount} / ${list.length}</span></h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin-top:12px;">
        ${list.map(a => `
          <div style="text-align:center;padding:14px 8px;border-radius:10px;background:${a.unlocked ? 'var(--primary-light)' : 'var(--bg)'};border:1px solid ${a.unlocked ? 'var(--primary)' : 'var(--border)'};opacity:${a.unlocked ? 1 : 0.55};">
            <div style="font-size:28px;margin-bottom:6px;filter:${a.unlocked ? 'none' : 'grayscale(1)'};">${a.icon}</div>
            <div style="font-size:13px;font-weight:600;color:${a.unlocked ? 'var(--primary-dark)' : 'var(--text-muted)'};">${a.name}</div>
            <div style="font-size:11px;color:var(--muted);margin-top:4px;line-height:1.4;">${a.desc}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
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
  const title = factionTitle(faction);
  const createdAt = new Date(currentUser.created_at).toLocaleDateString('zh-CN');
  const bannerStyle = currentProfile.banner_url
    ? `background:url('${currentProfile.banner_url}') center/cover no-repeat;`
    : `background:linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%);`;

  // 统计：4 个数字
  const stats = await getUserStats();
  const followCount = stats.follow;
  const likeCount = stats.like;
  const bookmarkCount = stats.bookmark;
  const commentCount = stats.comment;
  const repliedCount = stats.replied;
  const joinedDays = stats.joinedDays;

  root.innerHTML = `
    <div class="card" style="padding:0;overflow:hidden;">
      <div style="height:160px;${bannerStyle}"></div>
      <div style="padding:0 20px 20px;">
        <div style="margin-top:-48px;display:flex;align-items:flex-end;gap:16px;">
          <div style="border:4px solid #fff;border-radius:50%;background:#fff;box-shadow:0 2px 12px rgba(0,0,0,0.08);">${userAvatarHTML(currentProfile, 96)}</div>
          <div style="padding-bottom:8px;flex:1;">
            <div style="font-size:22px;font-weight:800;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              ${username}
            </div>
            <div style="font-size:14px;color:var(--muted);margin-top:6px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
              <span style="display:inline-flex;align-items:center;gap:4px;background:var(--primary-light);color:var(--primary-dark);padding:2px 10px;border-radius:999px;font-weight:600;font-size:13px;">
                ${factionIcon(faction)} ${currentProfile.route ? currentProfile.route + ' · ' : ''}${faction} · ${title}
              </span>
            </div>
          </div>
          <div style="padding-bottom:8px;">
            <a href="settings.html" class="btn" style="font-size:13px;">编辑资料</a>
          </div>
        </div>

        <div style="margin-top:16px;font-size:14px;line-height:1.7;white-space:pre-wrap;word-break:break-word;">
          ${currentProfile.bio ? currentProfile.bio.replace(/</g,'&lt;').replace(/>/g,'&gt;') : '<span style="color:var(--muted);">还没有填写简介</span>'}
        </div>

        <div style="margin-top:12px;font-size:13px;color:var(--muted);display:flex;gap:20px;flex-wrap:wrap;">
          <span>📅 ${createdAt} 加入 · 已活跃 <b style="color:var(--primary-dark);">${joinedDays}</b> 天</span>
          ${currentProfile.location ? `<span>📍 ${currentProfile.location.replace(/</g,'&lt;')}</span>` : ''}
          ${repliedCount > 0 ? `<span>💬 被角色回复过 <b style="color:var(--primary-dark);">${repliedCount}</b> 次</span>` : ''}
        </div>
      </div>
    </div>

    <div class="card" style="display:flex;justify-content:space-around;text-align:center;padding:16px 8px;">
      <div>
        <div style="font-size:20px;font-weight:800;color:var(--primary-dark);">${followCount}</div>
        <div style="font-size:12px;color:var(--muted);margin-top:4px;">关注角色</div>
      </div>
      <div>
        <div style="font-size:20px;font-weight:800;color:var(--primary-dark);">${likeCount}</div>
        <div style="font-size:12px;color:var(--muted);margin-top:4px;">点赞</div>
      </div>
      <div>
        <div style="font-size:20px;font-weight:800;color:var(--primary-dark);">${bookmarkCount}</div>
        <div style="font-size:12px;color:var(--muted);margin-top:4px;">收藏</div>
      </div>
      <div>
        <div style="font-size:20px;font-weight:800;color:var(--primary-dark);">${commentCount}</div>
        <div style="font-size:12px;color:var(--muted);margin-top:4px;">评论</div>
      </div>
    </div>

    ${renderAchievements({ follow: followCount, like: likeCount, bookmark: bookmarkCount, comment: commentCount, message: 0, replied: repliedCount, joinedDays })}
    <div class="profile-tabs" id="profile-tabs">
      <button class="active" data-tab="follows">我的关注</button>
      <button data-tab="likes">我的点赞</button>
      <button data-tab="bookmarks">我的收藏</button>
      <button data-tab="comments">我的评论</button>
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
    } else if (tab === 'likes') {
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

  renderUserTab('follows');

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
  forumReadOnly = false;
  await checkUser();
  if (currentProfile && currentProfile.is_banned) return;
  await loadData();
  await loadPostStats();
  await loadAds();
  await loadHotsearch();

  let followedChars = [];
  if (currentUser) {
    const { data: follows } = await db.from('follows').select('character_id').eq('user_id', currentUser.id);
    followedChars = (follows || []).map(f => f.character_id);
  }

  const sortedPosts = [...POSTS].sort((a, b) => {
    const aF = followedChars.includes(a.character) ? 1 : 0;
    const bF = followedChars.includes(b.character) ? 1 : 0;
    if (aF !== bF) return bF - aF;
    return (b.date || '').localeCompare(a.date || '');
  });

  const feed = $('#feed');
  if (!sortedPosts.length) {
    feed.innerHTML = '<div class="empty">还没有动态</div>';
  } else {
    const parts = [];
    for (let i = 0; i < sortedPosts.length; i++) {
      parts.push(await renderPostCard(sortedPosts[i]));
      // 每 3 条帖子里插一个广告
      if ((i + 1) % 3 === 0) {
        parts.push(renderAdCard());
      }
    }
    feed.innerHTML = parts.join('');
  }

  // 右侧栏：热搜 + 推荐角色
  const sidebarRight = document.querySelector('.sidebar-right');
  if (sidebarRight) {
    sidebarRight.innerHTML = `
      ${renderHotsearchCard()}
      <div class="card">
        <h3>推荐角色</h3>
        <div id="recommend">
          ${Object.values(CHARACTERS).map(c => `
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
              ${avatarHTML(c)}
              <div style="flex:1;min-width:0">
                <div style="font-weight:600;font-size:14px"><a href="character.html?handle=${c.handle}">${c.name}</a></div>
                <div style="font-size:12px;color:var(--text-muted)">@${c.handle}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }
}

async function initCharacter() {
  forumReadOnly = false;
  await checkUser();
  if (currentProfile && currentProfile.is_banned) return;
  await loadData();
  const handle = new URLSearchParams(location.search).get('handle') || 'daniel';
  const char = CHARACTERS[handle];
  const root = $('#profile');
  if (!char) { root.innerHTML = '<div class="empty">找不到这个角色</div>'; return; }
  const posts = POSTS.filter(p => p.character === handle);
  const bannerStyle = char.banner ? `style="background-image:url('${char.banner}');background-size:cover;background-position:center"` : '';
  await loadPostStats();
  
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
        ${char.faction ? `<span>阵营：${factionIcon(char.faction)} ${char.faction}</span>` : `<span>身份：中立</span>`}
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
  await loadForumData();
  await loadPostStats();
  const id = new URLSearchParams(location.search).get('id');
  const post = POSTS.find(p => p.id === id) || FORUM_POSTS.find(p => p.id === id);
    // 论坛帖如果是别人的阵营，标记只读
  const isForumPost = FORUM_POSTS.some(p => p.id === id);
  if (isForumPost && currentProfile && post.faction && post.faction !== currentProfile.faction) {
    forumReadOnly = true;
  } else {
    forumReadOnly = false;
  }
  const root = $('#post-detail');
  if (!post) {
    root.innerHTML = '<div class="empty">找不到这篇帖子</div>';
    return;
  }

  root.innerHTML = `
    <a href="index.html" style="font-size:14px">← 返回首页</a>
    <div style="margin-top:16px">${await renderPostCard(post, true)}</div>
    <div style="margin-top:16px;padding:44px 20px;text-align:center;background:var(--bg);border:2px dashed var(--border);border-radius:12px;color:var(--muted);font-size:14px;letter-spacing:2px;">
      📢 广告位招租
    </div>
    <div class="card" style="margin-top:16px">
      <h3>评论</h3>
      <div id="comments-list-${post.id}" style="margin-top:10px;"></div>
      <div style="display:flex;gap:8px;margin-top:12px;">
        <input id="comment-input-${post.id}" type="text" maxlength="500" placeholder="${forumReadOnly ? '你不是这个阵营的成员' : '写下你的评论（最多500字）'}" ${forumReadOnly ? 'disabled' : ''} style="flex:1;padding:10px;border:1px solid var(--border);border-radius:8px;${forumReadOnly ? 'opacity:0.5;' : ''}">
        <button class="btn btn-primary" onclick="submitComment('${post.id}')" ${forumReadOnly ? 'disabled style="opacity:0.5;"' : ''}>发送</button>
      </div>
      <div style="font-size:12px;color:var(--muted);margin-top:6px;">每帖最多3条，每天最多10条。先发后审。</div>
    </div>
  `;
  await loadComments(post.id);
}

async function unfollowFromProfile(handle, btn) {
  if (!currentUser) return;
  await db.from('follows').delete().eq('character_id', handle).eq('user_id', currentUser.id);
  showToast('你暂时放下了他');
  btn.closest('.card').remove();
}

// ===== 12. 设置页 =====
async function initSettings() {
  await checkUser();
  const root = $('#settings-app');
  if (!currentUser || !currentProfile) {
    root.innerHTML = '<div class="empty">请先登录后再查看设置</div>';
    return;
  }

  const banner = currentProfile.banner_url
    ? `<div style="height:160px;border-radius:12px;background:url('${currentProfile.banner_url}') center/cover no-repeat;"></div>`
    : `<div style="height:160px;border-radius:12px;background:linear-gradient(135deg,var(--primary) 0%,var(--primary-light) 100%);"></div>`;

  root.innerHTML = `
    <div class="card">
      <h3>个人资料</h3>
      <div style="position:relative;margin-bottom:12px;">
        ${banner}
        <button class="btn" onclick="pickAndUpload('banners', 1200, 400, 300, 'banner_url', 3)" style="position:absolute;bottom:8px;right:8px;background:rgba(0,0,0,0.6);color:#fff;border:none;z-index:3;">更换背景</button>
      </div>
      <div style="display:flex;align-items:center;gap:16px;margin-top:-48px;padding-left:20px;position:relative;z-index:2;">
        <div style="position:relative;">
          <div style="border:4px solid #fff;border-radius:50%;display:inline-block;">${userAvatarHTML(currentProfile, 84)}</div>
        </div>
        <button class="btn" onclick="pickAndUpload('avatars', 400, 400, 100, 'avatar_url', 1)">更换头像</button>
      </div>
      <p style="font-size:12px;color:var(--muted);margin-top:16px;">头像建议 400×400，背景建议 1200×400，会压缩成 WebP。</p>
    </div>

    <div class="card">
      <h3>昵称</h3>
      <div style="display:flex;gap:8px;">
        <input id="new-username" type="text" value="${currentProfile.username || ''}" placeholder="输入新昵称" maxlength="20" style="flex:1;padding:10px;border:1px solid var(--border);border-radius:8px;">
        <button class="btn btn-primary" onclick="updateUsername()">保存</button>
      </div>
      <div id="name-cooldown" style="font-size:12px;color:var(--muted);margin-top:8px;"></div>
    </div>

    <div class="card">
      <h3>灵魂驻地</h3>
      <p style="font-size:12px;color:var(--muted);margin-bottom:10px;">这里只认基塔世界的驻地，与现实位置无关。30 天内只能修改一次。</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <select id="loc-region" onchange="onRegionChange()" style="flex:1;min-width:140px;padding:10px;border:1px solid var(--border);border-radius:8px;background:#fff;"></select>
        <select id="loc-detail" style="flex:1;min-width:140px;padding:10px;border:1px solid var(--border);border-radius:8px;background:#fff;"></select>
        <button class="btn btn-primary" onclick="updateLocation()" id="loc-save-btn">保存驻地</button>
      </div>
      <div id="loc-cooldown" style="font-size:12px;color:var(--muted);margin-top:8px;"></div>
    </div>

    <div class="card">
      <h3>简介</h3>
      <textarea id="new-bio" maxlength="200" placeholder="一句话介绍自己（最多 200 字）" style="width:100%;min-height:80px;padding:10px;border:1px solid var(--border);border-radius:8px;font-family:inherit;resize:vertical;">${currentProfile.bio || ''}</textarea>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;">
        <span style="font-size:12px;color:var(--muted);"><span id="bio-count">${(currentProfile.bio || '').length}</span> / 200</span>
        <button class="btn btn-primary" onclick="updateBio()">保存简介</button>
      </div>
    </div>

    <div class="card">
      <h3>修改密码</h3>
      <div style="display:flex;flex-direction:column;gap:8px;">
        <input id="old-password" type="password" placeholder="当前密码" style="padding:10px;border:1px solid var(--border);border-radius:8px;">
        <input id="new-password" type="password" placeholder="新密码（至少6位）" style="padding:10px;border:1px solid var(--border);border-radius:8px;">
        <input id="new-password2" type="password" placeholder="再次输入新密码" style="padding:10px;border:1px solid var(--border);border-radius:8px;">
        <button class="btn btn-primary" onclick="updatePassword()" style="align-self:flex-start;">修改密码</button>
      </div>
    </div>

    <div class="card">
      <h3>账号信息</h3>
      <div style="font-size:14px;color:var(--muted);line-height:2;">
        <div>邮箱：${currentUser.email}</div>
        <div>阵营：${currentProfile.faction}</div>
        <div>注册时间：${new Date(currentUser.created_at).toLocaleString('zh-CN')}</div>
      </div>
    </div>

    <div class="card">
      <h3>阵营</h3>
      <div style="font-size:14px;color:var(--muted);margin-bottom:10px;">
        当前阵营：${factionIcon(currentProfile.faction)} <b style="color:var(--primary-dark);">${currentProfile.faction}</b>
      </div>
      <button class="btn" id="change-faction-btn" onclick="changeFaction()">重新选择阵营</button>
      <div id="faction-cooldown" style="font-size:12px;color:var(--muted);margin-top:8px;"></div>
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

  // 简介字数实时更新
  const bioEl = document.getElementById('new-bio');
  if (bioEl) {
    bioEl.addEventListener('input', () => {
      document.getElementById('bio-count').textContent = bioEl.value.length;
    });
  }

  // 初始化位置下拉
  initLocationSelectors();

  // 昵称冷却显示
  showUsernameCooldown();

  // 阵营冷却检测
  showFactionCooldown();
}

function showFactionCooldown() {
  const btn = document.getElementById('change-faction-btn');
  const el = document.getElementById('faction-cooldown');
  if (!btn || !el) return;

  // 如果数据库里没记录，先补上"现在"
  if (!currentProfile.faction_chosen_at) {
    db.from('profiles').update({ faction_chosen_at: new Date().toISOString() }).eq('id', currentUser.id);
    currentProfile.faction_chosen_at = new Date().toISOString();
    btn.disabled = true;
    btn.style.opacity = '0.5';
    el.textContent = '阵营已锁定，还需 90 天才能修改。';
    return;
  }

  const last = new Date(currentProfile.faction_chosen_at).getTime();
  const days = (Date.now() - last) / 86400000;
  if (days < 90) {
    const remain = Math.ceil(90 - days);
    btn.disabled = true;
    btn.style.opacity = '0.5';
    el.textContent = `经常变动会让你找不到家（还需 ${remain} 天）`;
  } else {
    el.textContent = '已满 3 个月，可以重新选择阵营。';
  }
}

function changeFaction() {
  const ok = confirm('重新选择阵营将清空你之前阵营的全部任务进度与特殊声望，确定要离开当前阵营吗？');
  if (!ok) return;
  openFactionModal(true);
}

function initLocationSelectors() {
  const regionSel = document.getElementById('loc-region');
  const detailSel = document.getElementById('loc-detail');
  const saveBtn = document.getElementById('loc-save-btn');
  const cooldownEl = document.getElementById('loc-cooldown');
  if (!regionSel || !detailSel) return;

  const current = parseLocation(currentProfile.location);

  // 填充大区
  regionSel.innerHTML = '<option value="">选择航线 / 大区</option>' +
    Object.keys(LOCATIONS).map(k =>
      `<option value="${k}" ${k === current.region ? 'selected' : ''}>${k}</option>`
    ).join('');

  // 根据大区填二级
  const fillDetail = () => {
    const r = regionSel.value;
    if (!r) {
      detailSel.innerHTML = '<option value="">请先选择大区</option>';
      return;
    }
    detailSel.innerHTML = '<option value="">选择具体位置</option>' +
      LOCATIONS[r].map(d =>
        `<option value="${d}" ${d === current.detail ? 'selected' : ''}>${d}</option>`
      ).join('');
  };
  fillDetail();

  // 检查冷却
  if (currentProfile.location_updated_at) {
    const last = new Date(currentProfile.location_updated_at).getTime();
    const days = (Date.now() - last) / 86400000;
    if (days < 30) {
      const remain = Math.ceil(30 - days);
      regionSel.disabled = true;
      detailSel.disabled = true;
      if (saveBtn) saveBtn.disabled = true;
      if (saveBtn) saveBtn.style.opacity = '0.5';
      if (cooldownEl) cooldownEl.textContent = `驻地已锁定，还需 ${remain} 天才能修改。`;
    } else {
      if (cooldownEl) cooldownEl.textContent = '已满 30 天，可以修改驻地。';
    }
  }
}

function onRegionChange() {
  const regionSel = document.getElementById('loc-region');
  const detailSel = document.getElementById('loc-detail');
  const r = regionSel.value;
  if (!r) {
    detailSel.innerHTML = '<option value="">请先选择大区</option>';
    return;
  }
  detailSel.innerHTML = '<option value="">选择具体位置</option>' +
    LOCATIONS[r].map(d => `<option value="${d}">${d}</option>`).join('');
}

function showUsernameCooldown() {
  const el = document.getElementById('name-cooldown');
  if (!el) return;
  if (!currentProfile.username_updated_at) {
    el.textContent = '';
    return;
  }
  const last = new Date(currentProfile.username_updated_at).getTime();
  const days = (Date.now() - last) / 86400000;
  if (days < 30) {
    const remain = Math.ceil(30 - days);
    el.textContent = `改名冷却中，还需 ${remain} 天。`;
  } else {
    el.textContent = '已满 30 天，可以改名。';
  }
}

async function updateUsername() {
  const newName = document.getElementById('new-username').value.trim();
  if (!newName) return showToast('昵称不能为空');
  if (newName.length > 20) return showToast('昵称最多20个字');
  if (await containsSensitiveWord(newName)) return showToast('昵称包含敏感词，请修改后重试');
  if (containsLink(newName)) return showToast('昵称不允许包含外链');

  // 冷却检查
  if (currentProfile.username_updated_at) {
    const last = new Date(currentProfile.username_updated_at).getTime();
    if ((Date.now() - last) / 86400000 < 30) {
      return showToast('昵称已锁定，30 天内只能修改一次');
    }
  }

  const { error } = await db.from('profiles').update({
    username: newName,
    username_updated_at: new Date().toISOString()
  }).eq('id', currentUser.id);
  if (error) return showToast('修改失败：' + error.message);

  currentProfile.username = newName;
  currentProfile.username_updated_at = new Date().toISOString();
  showToast('你换了个昵称');
  updateUIForLoggedIn();
  showUsernameCooldown();
}

async function updateBio() {
  const bio = document.getElementById('new-bio').value.trim();
  if (await containsSensitiveWord(bio)) return showToast('简介包含敏感词，请修改后重试');
  if (containsLink(bio)) return showToast('简介不允许包含外链或联系方式');
  if (bio.length > 200) return showToast('简介最多 200 字');
  const { error } = await db.from('profiles').update({ bio: bio }).eq('id', currentUser.id);
  if (error) return showToast('保存失败：' + error.message);
  currentProfile.bio = bio;
  showToast('简介已保存');
}

async function updateLocation() {
  const region = document.getElementById('loc-region').value;
  const detail = document.getElementById('loc-detail').value;
  if (!region || !detail) return showToast('请先选择大区和具体位置');

  // 冷却检查
  if (currentProfile.location_updated_at) {
    const last = new Date(currentProfile.location_updated_at).getTime();
    if ((Date.now() - last) / 86400000 < 30) {
      return showToast('驻地已锁定，30 天内只能修改一次');
    }
  }

  const full = region + '·' + detail;
  const { error } = await db.from('profiles').update({
    location: full,
    location_updated_at: new Date().toISOString()
  }).eq('id', currentUser.id);
  if (error) return showToast('保存失败：' + error.message);

  currentProfile.location = full;
  currentProfile.location_updated_at = new Date().toISOString();
  showToast('驻地已保存');
  initSettings();
}

async function updatePassword() {
  const oldPwd = document.getElementById('old-password').value;
  const p1 = document.getElementById('new-password').value;
  const p2 = document.getElementById('new-password2').value;
  if (!oldPwd) return showToast('请输入当前密码');
  if (!p1 || p1.length < 6) return showToast('新密码至少6位');
  if (p1 !== p2) return showToast('两次输入的新密码不一致');
  if (p1 === oldPwd) return showToast('新密码不能与旧密码相同');

  // 用旧密码验证一次
  const { error: verifyErr } = await db.auth.signInWithPassword({
    email: currentUser.email,
    password: oldPwd
  });
  if (verifyErr) return showToast('当前密码不正确');

  const { error } = await db.auth.updateUser({ password: p1 });
  if (error) return showToast('修改失败：' + error.message);
  showToast('密码已修改');
  document.getElementById('old-password').value = '';
  document.getElementById('new-password').value = '';
  document.getElementById('new-password2').value = '';
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
let SIDEBAR_RENDERED = false;
async function renderSidebar() {
  const sidebar = document.querySelector('.sidebar-left');
  if (!sidebar) return;
  const path = location.pathname.split('/').pop() || 'index.html';

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
        <a href="${l.href}" class="${path === l.href ? 'active' : ''}">
          <span class="icon">${l.icon}</span> ${l.text}
          ${l.badge ? `<span class="unread-badge" style="margin-left:auto;background:#E76F51;color:#fff;font-size:11px;padding:1px 7px;border-radius:10px;font-weight:600;">${l.badge}</span>` : ''}
        </a>
      `).join('')}
    </nav>
  `;
  SIDEBAR_RENDERED = true;
}

// ===== 未读红点自动更新 =====
async function updateUnreadBadge() {
  if (!currentUser) return;
  const unread = await getUnreadCount();
  const link = document.querySelector('.sidebar-left a[href="notifications.html"]');
  if (!link) return;
  const oldBadge = link.querySelector('.unread-badge');
  if (unread > 0) {
    if (oldBadge) {
      oldBadge.textContent = unread;
    } else {
      const span = document.createElement('span');
      span.className = 'unread-badge';
      span.style.cssText = 'margin-left:auto;background:#E76F51;color:#fff;font-size:11px;padding:1px 7px;border-radius:10px;font-weight:600;';
      span.textContent = unread;
      link.appendChild(span);
    }
  } else if (oldBadge) {
    oldBadge.remove();
  }
}

// 启动轮询（每 30 秒）
setInterval(() => {
  if (currentUser) {
    updateUnreadBadge();
  }
}, 30000);

let CHECKING_REPLIES = false;
async function checkNewReplies() {
  if (!currentUser || CHECKING_REPLIES) return;
  CHECKING_REPLIES = true;
  try {
    const { data: newMsgs } = await db.from('messages')
      .select('id, character_id, content')
      .eq('user_id', currentUser.id)
      .eq('is_from_character', true)
      .eq('notified', false);

    if (!newMsgs || !newMsgs.length) return;

    for (const m of newMsgs) {
      await db.from('notifications').insert({
        user_id: currentUser.id,
        type: 'message',
        target_id: '角色 ' + m.character_id + ' 回复了你：' + m.content.slice(0, 30),
        is_read: false
      });
      await db.from('messages').update({ notified: true }).eq('id', m.id);
    }
  } finally {
    CHECKING_REPLIES = false;
  }
}

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

// ===== 广告系统 =====
let ADS = [];

async function loadAds() {
  if (ADS.length) return ADS;
  try {
    const res = await fetch('data/ads.json');
    const data = await res.json();
    ADS = data.ads || [];
  } catch (e) {
    ADS = [];
  }
  return ADS;
}

function renderAdCard() {
  if (!ADS.length) return '';
  const ad = ADS[Math.floor(Math.random() * ADS.length)];
  return `
    <div onclick="location.href='${ad.url}'" style="cursor:pointer;padding:16px 20px;border-bottom:1px solid var(--border);background:linear-gradient(to right, rgba(0,0,0,0.02), rgba(0,0,0,0.04));transition:background 0.15s;" onmouseover="this.style.background='rgba(0,0,0,0.06)'" onmouseout="this.style.background='linear-gradient(to right, rgba(0,0,0,0.02), rgba(0,0,0,0.04))'">
      <div style="font-size:11px;letter-spacing:2px;color:var(--muted);margin-bottom:6px;">📢 广告</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);">${ad.title}</div>
      <div style="font-size:13px;color:var(--muted);margin-top:4px;">${ad.content}</div>
    </div>
  `;
}

// ===== 热搜系统 =====
let HOTSEARCH = { byFaction: {} };

async function loadHotsearch() {
  try {
    const res = await fetch('data/hotsearch.json');
    HOTSEARCH = await res.json();
  } catch (e) {
    HOTSEARCH = { byFaction: {} };
  }
}

function getHotsearchFor(faction) {
  if (!faction || !HOTSEARCH.byFaction) return [];
  // 246 和 240-1 共享 240 的热搜
  if (faction === '246' || faction === '240-1') {
    return HOTSEARCH.byFaction['240'] || [];
  }
  return HOTSEARCH.byFaction[faction] || [];
}

function renderHotsearchCard() {
  if (!currentProfile || !currentProfile.faction) {
    return `
      <div class="card">
        <h3>🔥 热搜</h3>
        <div style="font-size:13px;color:var(--muted);margin-top:8px;">登录后查看</div>
      </div>
    `;
  }
  const list = getHotsearchFor(currentProfile.faction);
  if (!list.length) {
    return `
      <div class="card">
        <h3>🔥 热搜</h3>
        <div style="font-size:13px;color:var(--muted);margin-top:8px;">暂无热搜</div>
      </div>
    `;
  }
  return `
    <div class="card">
      <h3>🔥 热搜</h3>
      <div style="display:flex;flex-direction:column;gap:10px;margin-top:10px;">
        ${list.slice(0, 3).map((item, i) => `
          <a href="${item.url}" style="display:flex;gap:10px;text-decoration:none;color:var(--text);font-size:14px;line-height:1.5;">
            <span style="color:${i === 0 ? '#E76F51' : 'var(--muted)'};font-weight:700;flex-shrink:0;">${i + 1}</span>
            <span style="flex:1;">${item.text}</span>
          </a>
        `).join('')}
      </div>
    </div>
  `;
}

// ===== 节日系统 =====
let EVENTS = [];

async function loadEvents() {
  if (EVENTS.length) return EVENTS;
  try {
    const res = await fetch('data/events.json');
    const data = await res.json();
    EVENTS = data.events || [];
  } catch (e) {
    EVENTS = [];
  }
  return EVENTS;
}

function getActiveEvents() {
  if (!EVENTS.length) return [];
  const now = new Date();
  const year = now.getFullYear();
  const today = new Date(year, now.getMonth(), now.getDate());
  const active = [];
  for (const ev of EVENTS) {
    const [mm, dd] = ev.date.split('-').map(Number);
    const evDate = new Date(year, mm - 1, dd);
    const diffDays = Math.floor((today - evDate) / 86400000);
    if (diffDays >= 0 && diffDays < (ev.days || 3)) {
      active.push({ ...ev, daysSince: diffDays, isToday: diffDays === 0 });
    }
  }
  return active;
}

function filterEventsByFaction(events, faction) {
  if (!faction) return events;
  return events.filter(ev => (ev.factions || []).includes(faction));
}

function renderEventBanner(events) {
  if (!events.length) return '';
  return events.map(ev => `
    <div style="margin-bottom:16px;border-radius:12px;overflow:hidden;background:linear-gradient(135deg,var(--primary) 0%,var(--primary-light) 100%);padding:20px;">
      <div style="font-size:11px;letter-spacing:2px;color:var(--primary-dark);font-weight:600;margin-bottom:6px;">
        ${ev.route} · ${ev.isToday ? '今日节日' : '节日进行中'}
      </div>
      <div style="font-size:22px;font-weight:800;color:#fff;text-shadow:0 1px 4px rgba(0,0,0,0.15);margin-bottom:8px;">
        🎉 ${ev.name}
      </div>
      <div style="font-size:13px;color:rgba(255,255,255,0.95);line-height:1.6;">
        ${ev.desc}
      </div>
    </div>
  `).join('');
}

// ===== 15. 阵营论坛 =====
let FORUM_POSTS = [];

async function loadForumData() {
  try {
    await loadEvents();
    const res = await fetch('posts/forum.json');
    const data = await res.json();
    const allPosts = await Promise.all(data.posts.map(async p => {
      const r = await fetch(p.file);
      const text = await r.text();
      const { data: fm, content } = parseFrontMatter(text);
      return { id: p.id, ...fm, content };
    }));

    // 过滤：有 event 字段的帖子，只在该节日进行中才显示
    const activeEvents = getActiveEvents();
    const activeNames = activeEvents.map(e => e.name);
    FORUM_POSTS = allPosts.filter(p => {
      if (!p.event) return true;
      return activeNames.includes(p.event);
    });
  } catch (e) {
    FORUM_POSTS = [];
  }
}

async function initForum() {
  await checkUser();
  await loadData();
  await loadForumData();

  const root = $('#forum-app');
  const sidebarRight = document.querySelector('.sidebar-right');

  if (!currentUser) {
    root.innerHTML = '<div class="empty">请先登录后再进入阵营论坛</div>';
    return;
  }
  if (!currentProfile || !currentProfile.faction) {
    root.innerHTML = '<div class="empty">请先选择阵营</div>';
    return;
  }

  const myFaction = currentProfile.faction;
  const params = new URLSearchParams(location.search);
  const viewingFaction = params.get('faction') || myFaction;
  const isOwn = viewingFaction === myFaction;

  forumReadOnly = !isOwn;

  const posts = FORUM_POSTS.filter(p => p.faction === viewingFaction);

  // 节日横幅：只显示自己身份能看到的节日
  const activeEvents = getActiveEvents();
  const myEvents = filterEventsByFaction(activeEvents, myFaction);
  const eventBanner = renderEventBanner(myEvents);

  const topBanner = eventBanner + `
    <div class="card" style="background:var(--primary-light);border-color:var(--primary);">
      <h3>${factionIcon(viewingFaction)} ${viewingFaction} · 论坛 ${isOwn ? '' : '<span style="font-size:12px;color:var(--text-muted);font-weight:400;">（仅浏览）</span>'}</h3>
      <p style="margin-top:8px;font-size:13px;color:var(--text-muted);">
        ${isOwn ? '这里是你的阵营论坛。' : '你正在浏览其他阵营的论坛，只能查看，不能互动。'}
      </p>
    </div>
  `;

  const postsHTML = posts.length
    ? (await Promise.all(posts.map(p => renderPostCard(p)))).join('')
    : '<div class="empty">这个阵营还没有帖子</div>';

  root.innerHTML = topBanner + postsHTML;

  // 右侧栏：论坛列表
  if (sidebarRight) {
    const allFactions = ['精灵', '矮人', '人类', '异人', '240', '246', '240-1'];
    const others = allFactions.filter(f => f !== myFaction);
    const linkStyle = (active) =>
      `display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:8px;text-decoration:none;font-size:14px;${active ? 'background:var(--primary-light);color:var(--primary-dark);font-weight:600;' : 'color:var(--text);'}`;

    sidebarRight.innerHTML = `
      <div class="card">
        <h3>论坛列表</h3>
        <div style="display:flex;flex-direction:column;gap:4px;margin-top:10px;">
          <a href="forum.html?faction=${myFaction}" style="${linkStyle(viewingFaction === myFaction)}">
            ${factionIcon(myFaction)} ${myFaction}（我的）
          </a>
          ${others.map(f => `
            <a href="forum.html?faction=${f}" style="${linkStyle(viewingFaction === f)}">
              ${factionIcon(f)} ${f}
            </a>
          `).join('')}
        </div>
      </div>
      <div class="card">
        <h3>说明</h3>
        <p style="font-size:12px;color:var(--muted);line-height:1.7;margin-top:6px;">
          · 你的阵营论坛可以自由互动。<br>
          · 其他阵营论坛只能浏览，不能点赞、评论、收藏。
        </p>
      </div>
    `;
  }

  window.addEventListener('beforeunload', () => { forumReadOnly = false; });
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

// ===== 外链检测 =====
function containsLink(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  // http / https
  if (/https?:\/\//.test(lower)) return true;
  // www.
  if (/www\./.test(lower)) return true;
  // 常见域名后缀
  if (/\.(com|cn|net|org|io|me|xyz|top|cc|tv|info|biz|app|dev|co|gov|edu)(\b|\/|:|$)/.test(lower)) return true;
  // 变体写法：hxxp、h t t p、h-t-t-p
  if (/h[\s\-_.]*x[\s\-_.]*x[\s\-_.]*p/i.test(text)) return true;
  // 变体：w w w
  if (/w[\s\-_.]*w[\s\-_.]*w[\s\-_.]*\./i.test(text)) return true;
  // IP 地址
  if (/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/.test(text)) return true;
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
const ADMIN_EMAILS = ['wuumii@outlook.com']; // ← 改成你自己的邮箱

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

  const { error: e1 } = await db.from('comments').update({ status: 'hidden' }).eq('id', commentId);
  if (e1) return showToast('隐藏评论失败：' + e1.message);

  const { error: e2 } = await db.from('reports').update({ status: 'handled' }).eq('id', reportId);
  if (e2) return showToast('更新举报状态失败：' + e2.message);

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

// ===== 21. 密码重置 =====
async function handleForgotPassword() {
  const email = document.getElementById('auth-email').value;
  if (!email) return showToast('请先在邮箱栏填写你的注册邮箱');

  const last = localStorage.getItem('lastResetRequest');
  if (last) {
    const diff = Date.now() - parseInt(last);
    if (diff < 24 * 3600 * 1000) {
      const hours = Math.ceil((24 * 3600 * 1000 - diff) / 3600000);
      return showToast('同一邮箱 24 小时内只能申请一次，请 ' + hours + ' 小时后再试');
    }
  }

  const redirectTo = location.origin + location.pathname.replace(/[^/]*$/, '') + 'reset-password.html';
  const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) return showToast('发送失败：' + error.message);

  localStorage.setItem('lastResetRequest', Date.now().toString());
  closeAuthModal();
  showToast('重置邮件已发送，请查收邮箱');
  alert('已向 ' + email + ' 发送重置链接。\n\n请打开邮件里的链接，会跳转回本网站设置新密钥。\n如果 10 分钟没收到，请检查垃圾邮件。');
}

async function initResetPassword() {
  await checkUser();

  // Supabase 重置链接回来时，URL 里会带 access_token，SDK 会自动处理 session
  // 直接检查当前用户是否处于"重置密码"状态
  const root = $('#reset-app');
  const hash = location.hash || '';
  const isRecovery = hash.includes('type=recovery') || hash.includes('access_token');

  root.innerHTML = `
    <div class="card" style="max-width:480px;margin:40px auto;">
      <h3>重置密钥</h3>
      <p style="font-size:13px;color:var(--muted);margin-top:8px;line-height:1.8;">
        输入你的新密钥（密码）。<br>
        重置成功后，你就可以用新密钥回到 TALK。
      </p>
      <input id="reset-pwd-1" type="password" placeholder="新密钥（至少6位）" style="width:100%;padding:10px;margin-top:16px;border:1px solid var(--border);border-radius:8px;">
      <input id="reset-pwd-2" type="password" placeholder="再次输入新密钥" style="width:100%;padding:10px;margin-top:10px;border:1px solid var(--border);border-radius:8px;">
      <button class="btn btn-primary" onclick="submitNewPassword()" style="width:100%;margin-top:16px;">确认重置</button>
      <p style="font-size:12px;color:var(--muted);margin-top:16px;line-height:1.7;">
        如果这个页面没有反应，说明重置链接已失效。<br>
        请回到登录页重新点击"钥匙丢失？"。
      </p>
    </div>
  `;
}

async function submitNewPassword() {
  const p1 = document.getElementById('reset-pwd-1').value;
  const p2 = document.getElementById('reset-pwd-2').value;
  if (!p1 || p1.length < 6) return showToast('新密钥至少 6 位');
  if (p1 !== p2) return showToast('两次输入不一致');

  const { error } = await db.auth.updateUser({ password: p1 });
  if (error) return showToast('重置失败：' + error.message);

  showToast('门已经打开了，欢迎回到基塔世界，旅者。');
  setTimeout(() => { location.href = 'index.html'; }, 1800);
}

async function deleteOwnComment(commentId, postId) {
  if (!currentUser) return;
  const ok = confirm('确定删除这条评论吗？删除后无法恢复。');
  if (!ok) return;
  const { error } = await db.from('comments').delete().eq('id', commentId).eq('user_id', currentUser.id);
  if (error) return showToast('删除失败：' + error.message);
  showToast('评论已删除');
  await loadComments(postId);
  const btn = document.querySelector(`.post[data-id="${postId}"] .action:nth-child(2) span`);
  if (btn) btn.textContent = Math.max(0, parseInt(btn.textContent) - 1);
}

// ===== 22. 旅者档案（看别人的主页） =====
async function initUserProfileView() {
  await checkUser();
  await loadData();
  const root = $('#user-profile-view');
  const userId = new URLSearchParams(location.search).get('id');

  if (!userId) {
    root.innerHTML = '<div class="empty">没有指定旅者</div>';
    return;
  }

  // 自己的档案 → 跳回 profile.html
  if (currentUser && currentUser.id === userId) {
    location.href = 'profile.html';
    return;
  }

  // 查目标用户 profile
  const { data: profile, error } = await db.from('profiles').select('*').eq('id', userId).single();
  if (error || !profile) {
    root.innerHTML = '<div class="empty">找不到这位旅者</div>';
    return;
  }

  // 查 Auth 里的注册时间
  const { data: { user: targetUser } } = await db.rpc('get_user_created_at', { uid: userId }).then(
    r => ({ data: { user: r.data ? { created_at: r.data } : null } }),
    () => ({ data: { user: null } })
  ).catch(() => ({ data: { user: null } }));

  // 简化：注册时间从 profiles.created_at 取
  const registeredAt = profile.created_at || new Date().toISOString();
  const joinedDays = Math.max(0, Math.floor((Date.now() - new Date(registeredAt).getTime()) / 86400000));
  const username = profile.username || '匿名旅者';
  const faction = profile.faction || '人类';
  const title = factionTitle(faction);

  const bannerStyle = profile.banner_url
    ? `background:url('${profile.banner_url}') center/cover no-repeat;`
    : `background:linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%);`;

  root.innerHTML = `
    <div class="card" style="padding:0;overflow:hidden;">
      <div style="height:140px;${bannerStyle}"></div>
      <div style="padding:0 20px 20px;">
        <div style="margin-top:-40px;display:flex;align-items:flex-end;gap:16px;">
          <div style="border:4px solid #fff;border-radius:50%;background:#fff;">${userAvatarHTML(profile, 88)}</div>
          <div style="padding-bottom:8px;">
            <div style="font-size:20px;font-weight:800;">${username.replace(/</g,'&lt;')}</div>
            <div style="font-size:13px;color:var(--muted);margin-top:4px;">
              <span style="display:inline-flex;align-items:center;gap:4px;background:var(--primary-light);color:var(--primary-dark);padding:2px 10px;border-radius:999px;font-weight:600;font-size:12px;">
                ${factionIcon(faction)} ${profile.route ? profile.route + ' · ' : ''}${faction} · ${title}
              </span>
            </div>
          </div>
        </div>
        <div style="margin-top:14px;font-size:14px;line-height:1.7;white-space:pre-wrap;word-break:break-word;">
          ${profile.bio ? profile.bio.replace(/</g,'&lt;').replace(/>/g,'&gt;') : '<span style="color:var(--muted);">这位旅者没有留下介绍</span>'}
        </div>
        <div style="margin-top:12px;font-size:13px;color:var(--muted);display:flex;gap:20px;flex-wrap:wrap;">
          <span>📅 降临这个世界第 <b style="color:var(--primary-dark);">${joinedDays}</b> 天</span>
          ${profile.location ? `<span>📍 ${profile.location.replace(/</g,'&lt;')}</span>` : ''}
        </div>
      </div>
    </div>

    <div class="profile-tabs" id="user-profile-tabs">
      <button class="active" data-tab="comments">公开评论</button>
      <button data-tab="likes">公开点赞</button>
    </div>
    <div id="user-profile-tab-content"></div>
  `;

  const renderUserProfileTab = async (tab) => {
    const container = $('#user-profile-tab-content');
    container.innerHTML = '<div class="empty">加载中...</div>';

    if (tab === 'comments') {
      const { data: cmData } = await db.from('comments').select('content, post_id, created_at').eq('user_id', userId).eq('status', 'visible').order('created_at', { ascending: false }).limit(50);
      if (!cmData || !cmData.length) return container.innerHTML = '<div class="empty">这位旅者还没有发过评论</div>';
      container.innerHTML = cmData.map(c => {
        const post = POSTS.find(p => p.id === c.post_id);
        const postTitle = post ? post.content.slice(0, 30) + '...' : '（帖子已删除）';
        return `<div class="card" style="margin-bottom:10px;">
          <div style="font-size:13px;color:var(--muted);margin-bottom:6px;">评论了帖子：${postTitle}</div>
          <div style="font-size:14px;background:var(--bg);padding:8px;border-radius:8px;">${c.content.replace(/</g,'&lt;')}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:6px;">${new Date(c.created_at).toLocaleString('zh-CN')}</div>
        </div>`;
      }).join('');
    } else if (tab === 'likes') {
      const { data: likeData } = await db.from('likes').select('post_id').eq('user_id', userId);
      const ids = (likeData || []).map(l => l.post_id);
      const likedPosts = POSTS.filter(p => ids.includes(p.id));
      if (!likedPosts.length) return container.innerHTML = '<div class="empty">这位旅者还没有点赞过帖子</div>';
      const html = await Promise.all(likedPosts.map(renderPostCard));
      container.innerHTML = html.join('');
    }
  };

  renderUserProfileTab('comments');

  $$('#user-profile-tabs button').forEach(b => {
    b.addEventListener('click', async () => {
      $$('#user-profile-tabs button').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      await renderUserProfileTab(b.dataset.tab);
    });
  });
}

// ===== 自动注入加载提示 =====
document.addEventListener('DOMContentLoaded', () => {
  const mainEl = document.querySelector('main');
  if (mainEl) {
    const text = mainEl.textContent.trim();
    // 只有当前是"加载中…"这种占位文字时才替换
    if (!text || text.includes('加载中')) {
      mainEl.innerHTML = renderLoadingHTML();
    }
  }
});
