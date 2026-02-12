// === 0. 文字特效 ===
function initTextGlow() {
    const splitText = (id) => {
        const el = document.getElementById(id);
        if (!el) return;
        const text = el.innerText;
        el.innerHTML = text.split('').map(char => {
            if (['，', '。', ' '].includes(char)) return char;
            const delay = Math.random() * 3;
            return `<span class="glow-char" style="animation-delay:-${delay}s">${char}</span>`;
        }).join('');
    };
    splitText('q-line-1');
    splitText('q-line-2');
}
initTextGlow();

// === 1. 播放器逻辑 ===
const audio = document.getElementById('bgm-player');
const allSongs = Array.from(document.querySelectorAll('.song-list li'));

const btnPlayPause = document.getElementById('btn-play-pause');
const iconPlay = document.getElementById('icon-play');
const iconPause = document.getElementById('icon-pause');
const btnPlayPauseM = document.getElementById('btn-play-pause-m');
const iconPlayM = document.getElementById('icon-play-m');
const iconPauseM = document.getElementById('icon-pause-m');
const volSlider = document.getElementById('vol-slider');
const btnOrder = document.getElementById('btn-order');
const btnOrderM = document.getElementById('btn-order-m');
const iconsOrder = [
    document.getElementById('icon-order-list'),
    document.getElementById('icon-order-single'),
    document.getElementById('icon-order-shuffle')
];

// 新进度条 DOM
const progressTrack = document.getElementById('progress-track');
const progressFill = document.getElementById('progress-fill');
const progressThumb = document.getElementById('progress-thumb');
const timeCur = document.getElementById('time-cur');
const timeDur = document.getElementById('time-dur');

// 封面 & 歌名
const discCover = document.getElementById('disc-cover');
const discCoverImg = document.getElementById('disc-cover-img');
const songNameText = document.getElementById('song-name-text');
const songNameScroll = document.getElementById('song-name-scroll');

// 上下曲按钮
const btnPrev = document.getElementById('btn-prev');
const btnNext = document.getElementById('btn-next');

let currentSongIndex = -1;
let isDraggingProgress = false;
let playMode = 0;
if (audio) audio.volume = 0.5;

// === 封面映射 ===
const coverMap = {
    'Unwavering_Startorch': 'music/Cover/星炬不熄.jpg',
    'Paper_Plane': 'music/Cover/飞行雪绒.jpg',
    'Indigo_Universe': 'music/Cover/飞行雪绒.jpg',
    'Fallen_Petals': 'music/Cover/飞行雪绒.jpg',
    'A_Small_Miracle': 'music/Cover/星轨消逝之夜.jpg',
    'Voyaging_Stars_Farewell': 'music/Cover/星轨消逝之夜.jpg',
    'Vernal_Days_Dreamed_by_the_Star': 'music/Cover/星轨消逝之夜.jpg'
};

function getCoverForSrc(src) {
    const filename = src.split('/').pop().replace('.mp3', '');
    for (const key in coverMap) {
        if (filename.startsWith(key)) return coverMap[key];
    }
    return 'music/Cover/飞行雪绒.jpg';
}

// === 歌名显示 ===
function updateSongName(li) {
    if (!songNameText || !songNameScroll) return;
    const title = li.querySelector('.song-title')?.textContent || '';
    const en = li.querySelector('.song-en')?.textContent || '';
    const display = en ? `${title} · ${en}` : title;

    // Update PC
    songNameText.textContent = display;
    setupMarquee(songNameScroll, display);

    // Update Mobile
    const mScroll = document.getElementById('mobile-song-scroll');
    if (mScroll) {
        // If the inner span is gone (replaced by marquee), we re-create stucture via setupMarquee
        // setupMarquee will clear innerHTML and create a new span.
        setupMarquee(mScroll, display);
    }
}

function setupMarquee(element, text) {
    element.classList.remove('scrolling');
    element.innerHTML = `<span>${text}</span>`;
    // Delay to ensure layout is calculated correctly
    setTimeout(() => {
        // Force Reflow
        void element.offsetWidth;
        const textW = element.scrollWidth;
        const wrapW = element.parentElement.offsetWidth;
        if (textW > wrapW) {
            element.innerHTML = `<span>${text}\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0${text}\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0</span>`;
            const duration = Math.max(6, textW / 30);
            element.style.setProperty('--scroll-duration', duration + 's');
            element.classList.add('scrolling');
        }
    }, 100);
}

function playIndex(index) {
    if (index < 0 || index >= allSongs.length) return;
    const li = allSongs[index];
    const src = li.getAttribute('data-src');

    allSongs.forEach(el => el.classList.remove('active'));
    li.classList.add('active');
    currentSongIndex = index;

    // 更新封面 (PC & Mobile)
    const coverSrc = getCoverForSrc(src);
    if (discCoverImg) discCoverImg.src = coverSrc;
    const mobileDiscImg = document.getElementById('mobile-disc-img');
    if (mobileDiscImg) mobileDiscImg.src = coverSrc;

    // 更新歌名
    updateSongName(li);

    if (audio.getAttribute('src') !== src) {
        audio.src = src;
        audio.load();
        loadLyrics(src);
        connectAudioAnalyser();
    } else {
        if (lyricsData.length === 0) loadLyrics(src);
    }

    audio.play().then(() => updatePlayState(true)).catch(() => updatePlayState(false));
}

function togglePlay() {
    if (currentSongIndex === -1) {
        playIndex(Math.floor(Math.random() * allSongs.length));
        return;
    }
    if (audio.paused) { audio.play(); updatePlayState(true); }
    else { audio.pause(); updatePlayState(false); }
}

function updatePlayState(isPlaying) {
    if (iconPlay) iconPlay.style.display = isPlaying ? 'none' : 'block';
    if (iconPause) iconPause.style.display = isPlaying ? 'block' : 'none';

    // Mobile Buttons
    const iconPlayM = document.getElementById('icon-play-m');
    const iconPauseM = document.getElementById('icon-pause-m');
    if (iconPlayM) iconPlayM.style.display = isPlaying ? 'none' : 'block';
    if (iconPauseM) iconPauseM.style.display = isPlaying ? 'block' : 'none';

    if (discCover) discCover.classList.toggle('spinning', isPlaying);
    const mobileDisc = document.getElementById('mobile-disc');
    if (mobileDisc) mobileDisc.classList.toggle('spinning', isPlaying);
}

// === 首次交互自动播放 ===
let hasTriedAutoPlay = false;

function tryAutoPlay() {
    if (hasTriedAutoPlay) return;
    hasTriedAutoPlay = true;

    // 如果没有在播放且没有选择过歌曲，随机播放一首
    if (audio && audio.paused && currentSongIndex === -1) {
        const randomIndex = Math.floor(Math.random() * allSongs.length);
        playIndex(randomIndex);
    }
}

// 监听各种交互事件来触发首次播放
['click', 'touchstart', 'keydown', 'scroll'].forEach(eventType => {
    document.addEventListener(eventType, tryAutoPlay, { once: true, passive: true });
});


if (btnOrder) {
    btnOrder.addEventListener('click', (e) => {
        e.stopPropagation();
        playMode = (playMode + 1) % 3;
        iconsOrder.forEach((icon, i) => icon.style.display = (i === playMode) ? 'block' : 'none');
    });
}

if (audio) {
    audio.addEventListener('ended', () => {
        if (playMode === 1) { audio.currentTime = 0; audio.play(); }
        else if (playMode === 2) {
            let next;
            do { next = Math.floor(Math.random() * allSongs.length); } while (next === currentSongIndex && allSongs.length > 1);
            playIndex(next);
        } else {
            let next = currentSongIndex + 1;
            if (next >= allSongs.length) next = 0;
            playIndex(next);
        }
    });


    audio.addEventListener('loadedmetadata', () => {
        if (timeCur) timeCur.textContent = formatTime(audio.currentTime);
        if (timeDur) timeDur.textContent = formatTime(audio.duration);
    });

    // Lyrics Sync + Progress Update
    audio.addEventListener('timeupdate', () => {
        if (!isDraggingProgress && audio.duration) {
            const pct = (audio.currentTime / audio.duration) * 100;
            // Only update if difference is significant to avoid jitter
            if (progressFill) progressFill.style.width = pct + '%';
            if (progressThumb) progressThumb.style.left = pct + '%';
            if (timeCur) timeCur.textContent = formatTime(audio.currentTime);
            if (timeDur) timeDur.textContent = formatTime(audio.duration);
        }
        syncLyrics(audio.currentTime);
    });
}
if (btnOrder) {
    btnOrder.addEventListener('click', (e) => {
        e.stopPropagation();
        playMode = (playMode + 1) % 3;
        iconsOrder.forEach((icon, i) => icon.style.display = (i === playMode) ? 'block' : 'none');
    });
}

// === Lyrics Logic ===
let lyricsData = []; // Array of { time: seconds, text: string, trans: string }
const lyricsScroll = document.getElementById('lyrics-scroll');

async function loadLyrics(mp3Src) {
    lyricsData = [];
    if (lyricsScroll) lyricsScroll.innerHTML = '<div class="lrc-line">Loading...</div>';

    // Extract filename from path "music/filename.mp3"
    const filename = mp3Src.split('/').pop(); // "filename.mp3"

    let songData = null;
    if (window.SONG_LYRICS) {
        // Try direct match first if src is relative "music/..."
        if (window.SONG_LYRICS[mp3Src]) {
            songData = window.SONG_LYRICS[mp3Src];
        } else if (window.SONG_LYRICS[filename]) {
            songData = window.SONG_LYRICS[filename];
        } else {
            // Try decoding URI 
            const decoded = decodeURIComponent(filename);
            if (window.SONG_LYRICS[decoded]) songData = window.SONG_LYRICS[decoded];
        }
    }

    if (!songData) {
        console.warn('Lyrics not found for:', mp3Src);
        if (lyricsScroll) lyricsScroll.innerHTML = '<div class="lrc-line">Pure Music</div>';
        return;
    }

    const { lrc, trans } = songData;
    parseAndMergeLyrics(lrc || '', trans || '');
    renderLyrics();
}

function parseTime(timeStr) {
    // [mm:ss.xx]
    const parts = timeStr.split(':');
    if (parts.length < 2) return 0;
    const min = parseInt(parts[0], 10);
    const sec = parseFloat(parts[1]);
    return min * 60 + sec;
}

function parseToMap(text) {
    const map = new Map(); // time -> text
    const lines = text.split('\n');
    const timeReg = /\[(\d{2}):(\d{2}\.\d{2,3})\]/g;

    for (const line of lines) {
        let match;
        // Reset lastIndex because we might define it globally or just use matchAll
        // Simple approach: split by ]
        const parts = line.split(']');
        const content = parts[parts.length - 1].trim();

        for (let i = 0; i < parts.length - 1; i++) {
            const tStr = parts[i].substring(1); // remove [
            if (/^\d{2}:\d{2}\.\d{2,3}$/.test(tStr)) {
                const t = parseTime(tStr);
                // If multiple tags for same line, add to map
                map.set(Math.floor(t * 100) / 100, content); // Round to 2 decimals for easier key matching? 
                // Actually, just use fuzzy or direct. Let's store objects.
            }
        }
    }

    // Better parser
    const result = [];
    for (const line of lines) {
        const matches = [...line.matchAll(/\[(\d{2}):(\d{2}\.\d{2,3})\]/g)];
        if (matches.length > 0) {
            const content = line.replace(/\[(\d{2}):(\d{2}\.\d{2,3})\]/g, '').trim();
            if (!content) continue; // Skip empty lines if preferred, or keep for spacing
            matches.forEach(m => {
                const t = parseInt(m[1]) * 60 + parseFloat(m[2]);
                result.push({ t, c: content });
            });
        }
    }
    return result;
}

function parseAndMergeLyrics(lrc, trans) {
    const original = parseToMap(lrc); // Array used here actually
    const translation = parseToMap(trans);

    // Sort
    original.sort((a, b) => a.t - b.t);
    translation.sort((a, b) => a.t - b.t);

    // Merge: For each original line, find matching translation (within small delta)
    lyricsData = original.map(item => {
        // Find closest trans within 0.5s ? Or just assume sync?
        // Usually filenames match exactly so timestamps match exactly or very close.
        const match = translation.find(tr => Math.abs(tr.t - item.t) < 0.2);
        return {
            time: item.t,
            text: item.c,
            trans: match ? match.c : null
        };
    });
}

function renderLyrics() {
    if (!lyricsScroll) return;
    lyricsScroll.innerHTML = '';
    lyricsData.forEach((line, index) => {
        const div = document.createElement('div');
        div.className = 'lrc-line';
        div.dataset.index = index;
        div.innerHTML = `<span>${line.text}</span>${line.trans ? `<span class="lrc-trans">${line.trans}</span>` : ''}`;
        lyricsScroll.appendChild(div);
    });
}

function syncLyrics(currentTime) {
    if (!lyricsData.length || !lyricsScroll) return;

    // Find active line
    let activeIndex = -1;
    for (let i = 0; i < lyricsData.length; i++) {
        if (currentTime >= lyricsData[i].time) {
            activeIndex = i;
        } else {
            break;
        }
    }

    // Update UI
    const lines = lyricsScroll.children;
    for (let i = 0; i < lines.length; i++) {
        lines[i].classList.toggle('active', i === activeIndex);
    }

    // Scroll
    if (activeIndex !== -1) {
        // Center the active line
        const activeLine = lines[activeIndex];
        const offset = activeLine.offsetTop + activeLine.offsetHeight / 2;
        const containerHeight = lyricsScroll.parentElement.clientHeight;
        const scrollCen = containerHeight / 2;

        lyricsScroll.style.transform = `translateY(${scrollCen - offset}px)`;
    } else {
        lyricsScroll.style.transform = `translateY(0px)`;
    }
}

const formatTime = (s) => {
    if (isNaN(s)) return "00:00";
    const min = Math.floor(s / 60) || 0;
    const sec = Math.floor(s % 60) || 0;
    return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
};

// === 自定义进度条拖拽 ===
function seekFromEvent(e, track) {
    const rect = track.getBoundingClientRect();
    const touch = e.changedTouches ? e.changedTouches[0] : (e.touches ? e.touches[0] : null);
    const clientX = touch ? touch.clientX : e.clientX;
    let pct = (clientX - rect.left) / rect.width;
    pct = Math.max(0, Math.min(0.995, pct)); // Clamp to 99.5% to avoid auto-restart/ended event conflict
    return pct;
}

if (progressTrack && audio) {
    const startDrag = (e) => {
        isDraggingProgress = true;
        progressTrack.classList.add('dragging');
        const pct = seekFromEvent(e, progressTrack);
        if (audio.duration) {
            const time = pct * audio.duration;
            progressFill.style.width = (pct * 100) + '%';
            progressThumb.style.left = (pct * 100) + '%';
            if (timeCur) timeCur.textContent = formatTime(time);
            syncLyrics(time);
        }
    };
    const moveDrag = (e) => {
        if (!isDraggingProgress) return;
        e.preventDefault();
        const pct = seekFromEvent(e, progressTrack);
        if (audio.duration) {
            const time = pct * audio.duration;
            progressFill.style.width = (pct * 100) + '%';
            progressThumb.style.left = (pct * 100) + '%';
            if (timeCur) timeCur.textContent = formatTime(time);
            syncLyrics(time);
        }
    };
    const endDrag = (e) => {
        if (!isDraggingProgress) return;
        isDraggingProgress = false;
        progressTrack.classList.remove('dragging');
        const pct = seekFromEvent(e, progressTrack);
        if (audio.duration && Number.isFinite(audio.duration) && Number.isFinite(pct)) {
            const newTime = pct * audio.duration;
            audio.currentTime = newTime;
            // Immediate UI update to prevent visual jump back
            if (progressFill) progressFill.style.width = (pct * 100) + '%';
            if (progressThumb) progressThumb.style.left = (pct * 100) + '%';
            if (timeCur) timeCur.textContent = formatTime(newTime);
        }
    };

    progressTrack.addEventListener('mousedown', startDrag);
    document.addEventListener('mousemove', moveDrag);
    document.addEventListener('mouseup', endDrag);
    progressTrack.addEventListener('touchstart', startDrag, { passive: false });
    document.addEventListener('touchmove', moveDrag, { passive: false });
    document.addEventListener('touchend', endDrag);
}

function updateVolStyle() {
    if (volSlider) {
        const val = volSlider.value * 100;
        volSlider.style.backgroundSize = `${val}% 100%`;
    }
}
// Init Volume
if (audio) { audio.volume = 1.0; updateVolStyle(); }

if (volSlider && audio) {
    volSlider.addEventListener('input', (e) => {
        audio.volume = e.target.value;
        updateVolStyle();
    });
}

// === 上一曲 / 下一曲 ===
function playPrev() {
    if (allSongs.length === 0) return;
    let idx;
    if (playMode === 2) { // Shuffle -> Random
        idx = Math.floor(Math.random() * allSongs.length);
    } else {
        idx = currentSongIndex - 1;
        if (idx < 0) idx = allSongs.length - 1;
    }
    playIndex(idx);
}

function playNext() {
    if (allSongs.length === 0) return;
    let idx;
    if (playMode === 2) { // Shuffle -> Random
        idx = Math.floor(Math.random() * allSongs.length);
    } else {
        idx = currentSongIndex + 1;
        if (idx >= allSongs.length) idx = 0;
    }
    playIndex(idx);
}

// Bind PC prev/next buttons
const btnPrevPC = document.getElementById('btn-prev-pc');
const btnNextPC = document.getElementById('btn-next-pc');
if (btnPrevPC) btnPrevPC.addEventListener('click', (e) => { e.stopPropagation(); playPrev(); });
if (btnNextPC) btnNextPC.addEventListener('click', (e) => { e.stopPropagation(); playNext(); });

if (btnPrev) btnPrev.addEventListener('click', (e) => { e.stopPropagation(); playPrev(); });
if (btnNext) btnNext.addEventListener('click', (e) => { e.stopPropagation(); playNext(); });
if (btnPlayPauseM) btnPlayPauseM.addEventListener('click', (e) => { e.stopPropagation(); togglePlay(); });

// 竖屏播放顺序按钮同步
if (btnOrderM) {
    btnOrderM.addEventListener('click', (e) => {
        e.stopPropagation();
        playMode = (playMode + 1) % 3;
        iconsOrder.forEach((icon, i) => icon.style.display = (i === playMode) ? 'block' : 'none');
        // 同步竖屏按钮图标
        const svgPaths = [
            'M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z', // Standard List
            'M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4zm-4-2V9h-1l-2 1v1h1.5v4H13z', // Loop One
            'M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z' // Shuffle
        ];
        const svg = btnOrderM.querySelector('svg');
        if (svg) svg.innerHTML = `<path d="${svgPaths[playMode]}" />`;
    });
}

// 竖屏音量按钮切换静音
const btnVolToggle = document.getElementById('btn-vol-toggle');
if (btnVolToggle && audio) {
    btnVolToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        audio.muted = !audio.muted;
        btnVolToggle.style.opacity = audio.muted ? '0.4' : '1';
    });
}

allSongs.forEach((li, index) => li.addEventListener('click', (e) => { e.stopPropagation(); playIndex(index); }));
if (btnPlayPause) btnPlayPause.addEventListener('click', (e) => { e.stopPropagation(); togglePlay(); });

// === 2. 掉落物 ===

// Mobile Envelope Button Listener
const mobileEnvelopeBtn = document.getElementById('mobile-envelope-btn');
if (mobileEnvelopeBtn) {
    mobileEnvelopeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleCommentPanel();
    });
}

// 预加载图片并为每个图片维护独立的对象池
const particleSrcs = [
    'assets/icon0.png',
    'assets/icon1.png',
    'assets/icon2.png',
    'assets/icon3.png'
];

// 预加载图片
const preloadedImages = particleSrcs.map(src => {
    const img = new Image();
    img.src = src;
    return img;
});

// 为每个 src 维护独立的对象池，避免重复设置 src
const particlePools = {};
particleSrcs.forEach(src => { particlePools[src] = []; });

let activeParticles = 0;
const MAX_PARTICLES = window.innerWidth < 800 ? 8 : 40;
const rand = (min, max) => Math.random() * (max - min) + min;

function getParticle(src) {
    let img;
    const pool = particlePools[src];
    if (pool && pool.length > 0) {
        img = pool.pop();
        // 不重新设置 src，因为池中的元素已经是正确的 src
    } else {
        img = document.createElement('img');
        img.className = 'sprite';
        img.src = src;
    }
    return img;
}

function releaseParticle(img, src) {
    if (img.parentNode) img.remove();
    img.style.cssText = '';
    img.className = 'sprite';
    if (particlePools[src]) {
        particlePools[src].push(img);
    }
}

function createFaller() {
    if (activeParticles >= MAX_PARTICLES || document.hidden) return;
    const src = particleSrcs[Math.floor(Math.random() * particleSrcs.length)];
    const img = getParticle(src);

    const duration = rand(6, 14);
    img.style.left = `${rand(0, window.innerWidth)}px`;
    img.style.top = `-60px`;
    img.style.opacity = rand(0.3, 0.7);
    img.style.transition = `transform ${duration}s linear`;

    document.body.appendChild(img);
    activeParticles++;

    requestAnimationFrame(() => {
        img.style.transform = `translateY(${window.innerHeight + 160}px) translateX(${rand(-60, 60)}px) rotate(${rand(0, 360)}deg)`;
    });

    setTimeout(() => {
        releaseParticle(img, src);
        activeParticles--;
    }, duration * 1000);
}
setInterval(createFaller, window.innerWidth < 800 ? 1200 : 800);

// === 3. 点击爆散效果 ===
// 复用 particlePools 独立对象池
let burstCount = 0;
const MAX_BURST_NODES = 20;

window.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.player-capsule') || e.target.closest('.music-panel') || e.target.closest('button') || e.target.closest('input')) return;

    if (audio && !audio.src && audio.paused) playIndex(Math.floor(Math.random() * allSongs.length));

    const count = window.innerWidth < 800 ? 3 : 6;
    for (let i = 0; i < count; i++) {
        if (burstCount >= MAX_BURST_NODES) return;

        const src = particleSrcs[Math.floor(Math.random() * particleSrcs.length)];
        const p = getParticle(src); // 复用 getParticle 函数
        p.style.left = e.clientX + 'px'; p.style.top = e.clientY + 'px';
        p.style.transition = 'none';
        document.body.appendChild(p);
        burstCount++;

        const angle = rand(0, Math.PI * 2);
        const v = rand(3, 8);
        let vx = Math.cos(angle) * v, vy = Math.sin(angle) * v;
        let life = 1.0, rot = rand(0, 360);

        function tick() {
            if (!p.parentNode) return;
            let cx = parseFloat(p.style.left), cy = parseFloat(p.style.top);
            p.style.left = (cx + vx) + 'px';
            p.style.top = (cy + vy) + 'px';
            vx *= 0.92; vy *= 0.92; vy += 0.2;
            rot += 5; life -= 0.03;

            p.style.transform = `translate(-50%,-50%) rotate(${rot}deg)`;
            p.style.opacity = life;

            if (life > 0) { requestAnimationFrame(tick); }
            else { releaseParticle(p, src); burstCount--; }
        }
        requestAnimationFrame(tick);
    }
});


// === 4. Chibi Animations ===
const chibiAssets = [
    'assets/Aemeath/Aemeath_FLY.gif',
    'assets/Aemeath/Aemeath_GLASS.gif',
    'assets/Aemeath/Aemeath_JUMP.gif',
    'assets/Aemeath/Aemeath_UP.gif',
    'assets/Aemeath/Bao.png' // New asset
];

const MAX_CHIBIS = 3;
let currentChibiCount = 0;

class Chibi {
    constructor(type = 'random') {
        this.el = document.createElement('div');
        this.el.className = 'chibi-wrapper';
        this.img = document.createElement('img');
        this.img.className = 'chibi-display';

        let src;
        if (type === 'fly') {
            src = 'assets/Aemeath/Aemeath_FLY.gif';
        } else {
            src = chibiAssets[Math.floor(Math.random() * chibiAssets.length)];
        }
        this.img.src = src;
        this.el.appendChild(this.img);
        document.body.appendChild(this.el);

        currentChibiCount++;

        if (type === 'fly') {
            this.initFly();
        } else {
            this.initRandom();
        }
    }

    initFly() {
        const startX = -170;
        const startY = window.innerHeight;

        this.el.style.transform = `translate(${startX}px, ${startY}px)`;
        this.el.offsetHeight;

        const targetX = window.innerWidth * 0.7;
        const targetY = window.innerHeight * 0.2;

        this.el.style.transition = 'transform 5s ease-out';
        this.el.style.transform = `translate(${targetX}px, ${targetY}px)`;

        setTimeout(() => {
            this.wanderingSteps = 2;
            this.startWandering();
        }, 5000);
    }

    initRandom() {
        const side = Math.floor(Math.random() * 4);
        let x, y;
        const offset = 200;
        const w = window.innerWidth;
        const h = window.innerHeight;

        switch (side) {
            case 0: x = Math.random() * w; y = -offset; break;
            case 1: x = w + offset; y = Math.random() * h; break;
            case 2: x = Math.random() * w; y = h + offset; break;
            case 3: x = -offset; y = Math.random() * h; break;
        }

        this.el.style.transform = `translate(${x}px, ${y}px)`;
        this.el.offsetHeight;

        this.wanderingSteps = Math.floor(Math.random() * 3) + 1; // 1 to 3 steps
        this.startWandering();
    }

    startWandering() {
        if (this.wanderingSteps < 0) {
            this.exitScreen();
            return;
        }

        const pad = 120;
        const x = pad + Math.random() * (window.innerWidth - pad * 2);
        const y = pad + Math.random() * (window.innerHeight - pad * 2);

        const currentTransform = new WebKitCSSMatrix(window.getComputedStyle(this.el).transform);
        const curX = currentTransform.m41;
        const curY = currentTransform.m42;
        const dist = Math.hypot(x - curX, y - curY);

        // Varying speed
        const baseSpeed = 40;
        const speed = baseSpeed * (0.8 + Math.random() * 0.6); // 80% to 140% speed
        const duration = Math.max(3, dist / speed);

        // Random easing
        const easings = ['ease-in-out', 'ease-in', 'ease-out', 'linear', 'cubic-bezier(0.68, -0.55, 0.27, 1.55)'];
        const easing = easings[Math.floor(Math.random() * easings.length)];

        this.el.style.transition = `transform ${duration}s ${easing}`;
        this.el.style.transform = `translate(${x}px, ${y}px)`;

        this.wanderingSteps--;

        setTimeout(() => this.startWandering(), duration * 1000);
    }

    exitScreen() {
        const side = Math.floor(Math.random() * 4);
        let x, y;
        const offset = 250;
        const w = window.innerWidth;
        const h = window.innerHeight;

        switch (side) {
            case 0: x = Math.random() * w; y = -offset; break;
            case 1: x = w + offset; y = Math.random() * h; break;
            case 2: x = Math.random() * w; y = h + offset; break;
            case 3: x = -offset; y = Math.random() * h; break;
        }

        const currentTransform = new WebKitCSSMatrix(window.getComputedStyle(this.el).transform);
        const curX = currentTransform.m41;
        const curY = currentTransform.m42;
        const dist = Math.hypot(x - curX, y - curY);
        const speed = 70;
        const duration = Math.max(3, dist / speed);

        this.el.style.transition = `transform ${duration}s ease-in`;
        this.el.style.transform = `translate(${x}px, ${y}px)`;

        setTimeout(() => {
            if (this.el.parentNode) {
                this.el.parentNode.removeChild(this.el);
                currentChibiCount--;
            }
        }, duration * 1000);
    }
}

// === 5. Web Audio API Visualizer ===
const vizCanvas = document.getElementById('visualizer-canvas');
let audioCtx = null;
let analyser = null;
let audioSource = null;
let vizAnimId = null;
const FFT_SIZE = 128;

function connectAudioAnalyser() {
    if (!audio || !vizCanvas) return;
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = FFT_SIZE;
        analyser.smoothingTimeConstant = 0.75;
        audioSource = audioCtx.createMediaElementSource(audio);
        audioSource.connect(analyser);
        analyser.connect(audioCtx.destination);
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

function drawPixelVisualizer() {
    if (!vizCanvas || !analyser) {
        vizAnimId = requestAnimationFrame(drawPixelVisualizer);
        return;
    }

    const ctx = vizCanvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = vizCanvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    if (vizCanvas.width !== w * dpr || vizCanvas.height !== h * dpr) {
        vizCanvas.width = w * dpr;
        vizCanvas.height = h * dpr;
        ctx.scale(dpr, dpr);
    }

    if (audio.paused) {
        // Keep 'active' class so opacity stays 1.
        // Don't clear rect -> freezes the last frame.
        // Just loop to check when it plays again.
        vizAnimId = requestAnimationFrame(drawPixelVisualizer);
        return;
    }

    ctx.clearRect(0, 0, w, h);

    vizCanvas.classList.add('active');

    const bufLen = analyser.frequencyBinCount;
    const dataArr = new Uint8Array(bufLen);
    analyser.getByteFrequencyData(dataArr);

    // 像素风方块参数
    const barCount = Math.min(64, bufLen);
    const pixelSize = 3;
    const gap = 2;
    const totalBarW = pixelSize;
    // Calculate space to determine if we can fit more or justify
    const totalW = barCount * (totalBarW + gap) - gap;
    const startX = (w - totalW) / 2;

    // 粉蓝渐变配色
    const pink = [255, 183, 197];
    const blue = [160, 196, 255];

    for (let i = 0; i < barCount; i++) {
        const dataIndex = Math.floor(i * (bufLen / barCount));
        const val = dataArr[dataIndex] / 255;
        const barH = Math.max(pixelSize, val * h * 0.9);
        const blocks = Math.ceil(barH / (pixelSize + 1));
        const x = startX + i * (totalBarW + gap);

        for (let b = 0; b < blocks; b++) {
            const y = h - (b + 1) * (pixelSize + 1);
            if (y < 0) break;
            const t = b / Math.max(1, blocks - 1);
            const r = Math.round(pink[0] + (blue[0] - pink[0]) * t);
            const g = Math.round(pink[1] + (blue[1] - pink[1]) * t);
            const bv = Math.round(pink[2] + (blue[2] - pink[2]) * t);
            const alpha = 0.6 + val * 0.4;
            ctx.fillStyle = `rgba(${r},${g},${bv},${alpha})`;
            ctx.fillRect(x, y, pixelSize, pixelSize);
        }

        // 底部辉光
        if (val > 0.1) {
            const glowAlpha = val * 0.15;
            ctx.fillStyle = `rgba(255,183,197,${glowAlpha})`;
            ctx.fillRect(x - 1, h - 2, pixelSize + 2, 2);
        }
    }

    vizAnimId = requestAnimationFrame(drawPixelVisualizer);
}

// 页面可见性控制
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        if (vizAnimId) { cancelAnimationFrame(vizAnimId); vizAnimId = null; }
    } else {
        if (!vizAnimId) vizAnimId = requestAnimationFrame(drawPixelVisualizer);
    }
});

// 启动波形绘制
vizAnimId = requestAnimationFrame(drawPixelVisualizer);

// Init Chibis
setTimeout(() => {
    new Chibi('fly');

    setInterval(() => {
        if (document.hidden) return;
        if (currentChibiCount < 1) {
            new Chibi('random');
            return;
        }
        if (currentChibiCount < MAX_CHIBIS) {
            if (Math.random() < 0.4) {
                new Chibi('random');
            }
        }
    }, 3000);
}, 1000);

// === 6. 留言板逻辑 ===
const envelopeBtn = document.getElementById('envelope-btn');
const commentPanel = document.getElementById('comment-panel');
const commentOverlay = document.getElementById('comment-overlay');
const commentClose = document.getElementById('comment-close');
const centerContainer = document.querySelector('.center-container');
const centerCard = document.querySelector('.center-card');
let isCommentOpen = false;
let twikooInitialized = false;

function isMobile() {
    return window.innerWidth <= 1100;
}

function openCommentPanel() {
    if (isCommentOpen) return;
    isCommentOpen = true;

    // 初始化Twikoo（只初始化一次）
    if (!twikooInitialized && window.twikoo) {
        twikoo.init({
            envId: 'https://worldlinechanger-twikoo.hf.space',
            el: '#tcomment',
        });
        twikooInitialized = true;
    }

    commentPanel.classList.add('open');
    envelopeBtn.classList.add('active');
    if (commentOverlay) commentOverlay.classList.add('open');

    if (!isMobile()) {
        centerContainer.classList.add('shifted');
        centerCard.classList.add('compact');
        envelopeBtn.classList.add('shifted');
    } else {
        // 移动端锁定滚动 - 简化方案避免影响fixed元素
        document.documentElement.style.overflow = 'hidden';
        document.body.style.overflow = 'hidden';
    }
}

function closeCommentPanel() {
    if (!isCommentOpen) return;
    isCommentOpen = false;

    commentPanel.classList.remove('open');
    envelopeBtn.classList.remove('active');
    envelopeBtn.classList.remove('shifted');
    if (commentOverlay) commentOverlay.classList.remove('open');
    centerContainer.classList.remove('shifted');
    centerCard.classList.remove('compact');

    // 恢复滚动
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
}

function toggleCommentPanel() {
    if (isCommentOpen) {
        closeCommentPanel();
    } else {
        openCommentPanel();
    }
}

if (envelopeBtn) {
    envelopeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        tryAutoPlay(); // 触发首次播放
        toggleCommentPanel();
    });
}

if (commentClose) {
    commentClose.addEventListener('click', (e) => {
        e.stopPropagation();
        closeCommentPanel();
    });
}

if (commentOverlay) {
    commentOverlay.addEventListener('click', closeCommentPanel);
}

// Home键点击事件
const commentHome = document.getElementById('comment-home');
if (commentHome) {
    commentHome.addEventListener('click', (e) => {
        e.stopPropagation();
        closeCommentPanel();
    });
}


// 窗口大小变化时处理
window.addEventListener('resize', () => {
    if (isCommentOpen) {
        if (isMobile()) {
            centerContainer.classList.remove('shifted');
            centerCard.classList.remove('compact');
            envelopeBtn.classList.remove('shifted');
        } else {
            centerContainer.classList.add('shifted');
            centerCard.classList.add('compact');
            envelopeBtn.classList.add('shifted');
            // 恢复滚动（从移动端切换到桌面端）
            document.body.style.overflow = '';
            document.body.style.position = '';
            document.body.style.width = '';
            document.body.style.top = '';
        }
    }
});
