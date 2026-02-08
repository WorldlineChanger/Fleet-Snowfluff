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
const progBar = document.getElementById('prog-bar');
const timeTxt = document.getElementById('time-txt');
const volSlider = document.getElementById('vol-slider');
const btnOrder = document.getElementById('btn-order');
const iconsOrder = [
    document.getElementById('icon-order-list'),
    document.getElementById('icon-order-single'),
    document.getElementById('icon-order-shuffle')
];

let currentSongIndex = -1;
let isDraggingProgress = false;
let playMode = 0;
if (audio) audio.volume = 0.5;

function playIndex(index) {
    if (index < 0 || index >= allSongs.length) return;
    const li = allSongs[index];
    const src = li.getAttribute('data-src');

    allSongs.forEach(el => el.classList.remove('active'));
    li.classList.add('active');
    currentSongIndex = index;

    if (audio.getAttribute('src') !== src) {
        audio.src = src;
        audio.load();
        loadLyrics(src);
    } else {
        // Even if src is same, maybe reload lyrics just in case? Or if it was cleared.
        // But usually loop or replay doesn't need reload.
        // However, initial load might need it if src was set in HTML.
        // Let's just call it if we are switching songs or if it's the first play.
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
    iconPlay.style.display = isPlaying ? 'none' : 'block';
    iconPause.style.display = isPlaying ? 'block' : 'none';
}

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


    audio.addEventListener('loadedmetadata', () => timeTxt.textContent = `${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`);

    // Lyrics Sync
    audio.addEventListener('timeupdate', () => {
        if (!isDraggingProgress && audio.duration) {
            progBar.value = (audio.currentTime / audio.duration) * 100;
            timeTxt.textContent = `${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`;
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

if (progBar) {
    progBar.addEventListener('input', (e) => {
        isDraggingProgress = true;
        const time = (e.target.value / 100) * audio.duration;
        timeTxt.textContent = `${formatTime(time)} / ${formatTime(audio.duration)}`;
        // Sync lyrics while dragging? Optional.
        syncLyrics(time);
    });
    progBar.addEventListener('change', (e) => {
        isDraggingProgress = false;
        if (audio.duration) audio.currentTime = (e.target.value / 100) * audio.duration;
    });
}

if (volSlider && audio) volSlider.addEventListener('input', (e) => audio.volume = e.target.value);

// Update playIndex to load lyrics
const oldPlayIndex = playIndex; // Store ref if needed, or just rewrite
// We'll rewrite playIndex to be safe or just modify the existing block.
// Actually, I can just modify `playIndex` inside the loop logic or re-declare it if not const.
// It is `function playIndex`, so I can overwrite it or just modify the `playIndex` implementation
// Wait, replacing a function implementation in this tool might be tricky if I don't target the whole block.
// I'll target the existing specific lines in `playIndex` to insert `loadLyrics`.

// Let's just hook into the existing playIndex by redefining it or inserting the call.
// The code I am replacing above includes the end of `playIndex` so I have to be careful.
// Wait, the ReplacementContent above STARTS with `});` which is `audio.addEventListener('ended', ...)` closure?
// No, I need to check where I am replacing.
// The `StartLine` target was `audio.addEventListener('timeupdate', ...)` block in original code.
// I will target the `timeupdate` listener to replace it with one that includes `syncLyrics`,
// AND I need to inject `loadLyrics(src)` into `playIndex`.

// Let's do the `timeupdate` replacement + global function defs first (as above).
// THEN I will do a separate edit to `playIndex` to call `loadLyrics`.

/* Current Plan:
1. Replace `timeupdate` block with new one + add all lyrics functions at the end of the file (or before Chibi).
2. Modify `playIndex` to call `loadLyrics`.
*/

// Changing the ReplacementContent to only target the timeupdate block and add functions.


allSongs.forEach((li, index) => li.addEventListener('click', (e) => { e.stopPropagation(); playIndex(index); }));
if (btnPlayPause) btnPlayPause.addEventListener('click', (e) => { e.stopPropagation(); togglePlay(); });

// === 2. 掉落物 ===
const templates = [
    document.getElementById('tpl-0'), document.getElementById('tpl-1'),
    document.getElementById('tpl-2'), document.getElementById('tpl-3')
];
let activeParticles = 0;
const MAX_PARTICLES = window.innerWidth < 800 ? 12 : 40;
const rand = (min, max) => Math.random() * (max - min) + min;

function createFaller() {
    if (activeParticles >= MAX_PARTICLES || document.hidden) return;
    const tpl = templates[Math.floor(Math.random() * templates.length)];
    if (!tpl) return;
    const img = tpl.cloneNode(true);
    img.removeAttribute('id'); img.className = 'sprite';

    const duration = rand(6, 14);
    img.style.left = `${rand(0, window.innerWidth)}px`;
    img.style.top = `-60px`;
    img.style.opacity = rand(0.3, 0.7);
    img.style.transition = `transform ${duration}s linear, top ${duration}s linear`;

    document.body.appendChild(img);
    activeParticles++;

    requestAnimationFrame(() => {
        img.style.top = `${window.innerHeight + 100}px`;
        img.style.transform = `translateX(${rand(-60, 60)}px) rotate(${rand(0, 360)}deg)`;
    });

    setTimeout(() => { if (img.parentNode) { img.remove(); activeParticles--; } }, duration * 1000);
}
setInterval(createFaller, 800);

// === 3. 点击爆散效果 ===
let burstCount = 0;
const MAX_BURST_NODES = 20;

window.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.player-capsule') || e.target.closest('.music-panel') || e.target.closest('button') || e.target.closest('input')) return;

    if (audio && !audio.src && audio.paused) playIndex(Math.floor(Math.random() * allSongs.length));

    const count = 6;
    for (let i = 0; i < count; i++) {
        if (burstCount >= MAX_BURST_NODES) return;

        const tpl = templates[Math.floor(Math.random() * templates.length)];
        if (!tpl) continue;
        const p = tpl.cloneNode(true);
        p.removeAttribute('id'); p.className = 'sprite';
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
            else { p.remove(); burstCount--; }
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

// === 5. Visualizer & Progress Gradient ===
const visualizerBox = document.getElementById('visualizer');
const BAR_COUNT = 30; // 30 pixels/bars roughly
let bars = [];

function initVisualizer() {
    if (!visualizerBox) return;
    visualizerBox.innerHTML = '';
    bars = [];
    for (let i = 0; i < BAR_COUNT; i++) {
        const d = document.createElement('div');
        d.className = 'v-bar';
        visualizerBox.appendChild(d);
        bars.push(d);
    }
}
initVisualizer();

function updateVisualizer() {
    if (!audio.paused) {
        visualizerBox.classList.add('active');
        // Fake data
        bars.forEach((bar, i) => {
            // Random height between 20% and 100%
            const h = 20 + Math.random() * 80;
            // Slightly smooth random - maybe perlin noise? Nah, simple random is enough for "pixel glitch" feel
            bar.style.height = `${h}%`;
            // Random toggle for pixelated look sometimes?
        });
    } else {
        visualizerBox.classList.remove('active');
        bars.forEach(bar => bar.style.height = '10%');
    }
}
setInterval(updateVisualizer, 100);

// Update progress bar color
function updateProgressColor() {
    if (!progBar) return;
    // Calculation: value is 0-100
    const val = progBar.value;
    progBar.style.setProperty('--seek-before-width', `${val}%`);
}

if (progBar) {
    progBar.addEventListener('input', updateProgressColor);
    audio.addEventListener('timeupdate', updateProgressColor);
}

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
