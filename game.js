// Run Jump Duck

// ─── Animation Timings (ms) ───────────────────────────────────────────────────
const ANIM_FIRST_FADE_DUR   = 500;   // Level 1: new key fade-in duration
const ANIM_FIRST_FADE_DELAY = 200;   // Level 1: delay before fade-in starts
const ANIM_FIRST_HOLD       = 3500;  // Level 1: hold time before game begins
const ANIM_FADEOUT_DUR      = 1000;   // Other rounds: old key fade-out duration
const ANIM_FADEOUT_DELAY    = 300;   // Other rounds: delay before old key fades out
const ANIM_FADEIN_DUR       = 1000;   // Other rounds: new key fade-in duration
const ANIM_FADEIN_DELAY     = 1300;   // Other rounds: delay before new key fades in
const ANIM_HOLD             = 4000;  // Other rounds: hold time before game begins
const ANIM_PASS_FLASH       = 500;   // Duration of green score flash on correct input

// ─── Game Constants ───────────────────────────────────────────────────────────
const GW         = 960;
const GH         = 550;
const CMDS       = ['run', 'jump', 'duck'];
const CMD_LABELS = { run: 'RUN', jump: 'JUMP', duck: 'DUCK' };
const CMD_COLORS = { run: 0x44cc44, jump: 0x4488ff, duck: 0xffcc00 };
const KEYS_INIT  = ['a', 's', 'd', 'f'];
const KEYS_EXT   = ['j', 'k', 'l', ';'];
const KEYS_FULL  = [
    'q','w','e','r','t','y','u','i','o','p','[',']','\\',
    'a','s','d','f','g','h','j','k','l',';',
    'z','x','c','v','b','n','m',',','.','/'
];
const ROUND_SIZE = 5;
const INIT_MS    = 4000;

// ─── Frame Layout [x, y, w, h] ───────────────────────────────────────────────
const FR = {
    inst:  [10,  10,  530, 90],
    timer: [550, 10,  140, 90],
    img:   [10,  110, 335, 430],
    txt:   [355, 110, 335, 430],
    score: [700, 10,  250, 90],
    ctrl:  [700, 110, 250, 430],
    exp:   [10,  10,  680, 530],
};
function fc(f) { return { x: f[0], y: f[1], w: f[2], h: f[3], cx: f[0]+f[2]/2, cy: f[1]+f[3]/2 }; }

// ─── Utility ──────────────────────────────────────────────────────────────────
function border(gfx, f, color = 0xffffff, lw = 2) {
    gfx.clear();
    gfx.lineStyle(lw, color, 1);
    gfx.strokeRect(f[0], f[1], f[2], f[3]);
}

function hexStr(n) { return '#' + n.toString(16).padStart(6, '0'); }

// ─── Level Manager ────────────────────────────────────────────────────────────
class LevelManager {
    constructor() {
        this.level       = 1;
        this.pool        = [...KEYS_INIT];
        this.assignments = {};
        this.prevAssign  = {};
        this.changed     = [];
        this.showImg     = true;
        this.showTxt     = true;
        this.showCtrl    = true;
        this.colorMech   = false;
        this.timerMs     = INIT_MS;
        this.extraCycles = 0;
    }

    apply() {
        this.prevAssign = { ...this.assignments };
        this.changed    = [];
        const lvl = this.level;

        if (lvl === 3) this.pool = [...KEYS_INIT, ...KEYS_EXT];
        if (lvl === 5) this.pool = [...KEYS_FULL];

        if      (lvl === 1) { this.assignAll(); }
        else if (lvl === 8) { this.swapTwo(); this.reassignOne(); }
        else                { this.reassignOne(); }

        this.showTxt   = lvl !== 9;
        this.showImg   = lvl !== 10;
        this.showCtrl  = lvl < 11;
        this.colorMech = lvl >= 12;
    }

    assignAll() {
        const keys = [...this.pool].sort(() => Math.random() - 0.5);
        CMDS.forEach((c, i) => { this.assignments[c] = keys[i]; this.changed.push(c); });
    }

    reassignOne() {
        const cmd    = CMDS[Math.floor(Math.random() * 3)];
        const others = CMDS.filter(c => c !== cmd).map(c => this.assignments[c]);
        const curKey = this.assignments[cmd];
        const pool   = this.pool.filter(k => !others.includes(k) && k !== curKey);

        if (pool.length === 0) {
            const other = CMDS.filter(c => c !== cmd)[Math.floor(Math.random() * 2)];
            [this.assignments[cmd], this.assignments[other]] = [this.assignments[other], this.assignments[cmd]];
            this.changed.push(cmd, other);
        } else {
            this.assignments[cmd] = pool[Math.floor(Math.random() * pool.length)];
            this.changed.push(cmd);
        }
    }

    swapTwo() {
        const [a, b] = [...CMDS].sort(() => Math.random() - 0.5);
        [this.assignments[a], this.assignments[b]] = [this.assignments[b], this.assignments[a]];
        this.changed.push(a, b);
    }

    advance() {
        if (this.level < 12) {
            this.level++;
        } else {
            this.extraCycles++;
            this.timerMs = INIT_MS * Math.pow(0.9, this.extraCycles);
        }
        this.apply();
    }

    colorData() {
        const word      = Math.random() < 0.5 ? 'RED' : 'GREEN';
        const wordClr   = Math.random() < 0.5 ? 0xff3333 : 0x33cc33;
        const txtBorder = Math.random() < 0.5 ? 0xff3333 : 0x33cc33;
        const imgBorder = txtBorder === 0xff3333 ? 0x33cc33 : 0xff3333;
        return { word, wordClr, txtBorder, imgBorder };
    }
}

// ─── Music helper (starts once; survives scene switches via game.sound) ──────
let musicStarted = false;
function startMusic(scene) {
    if (musicStarted) return;
    musicStarted = true;
    const mgr  = scene.game.sound;
    const play = () => { try { mgr.add('music', { loop: true, volume: 0.5 }).play(); } catch (e) {} };
    if (mgr.locked) { mgr.once('unlocked', play); } else { play(); }
}

// ─── Preload Scene ────────────────────────────────────────────────────────────
class PreloadScene extends Phaser.Scene {
    constructor() { super('PreloadScene'); }

    preload() {
        this.load.image('run',  'assets/run.png');
        this.load.image('jump', 'assets/jump.png');
        this.load.image('duck', 'assets/duck.png');
        this.load.image('key',  'assets/key.png');
        this.load.audio('music', ['assets/music.ogg', 'assets/music.mp3']);
        this.load.audio('pass',  'assets/pass.wav');
        this.load.audio('fail',  'assets/fail.wav');
    }

    create() {
        this.scene.start('MenuScene');
    }
}

// ─── Menu Scene ───────────────────────────────────────────────────────────────
class MenuScene extends Phaser.Scene {
    constructor() { super('MenuScene'); }

    create() {
        const hs = parseInt(localStorage.getItem('rjd_hs') || '0');
        this.add.rectangle(GW/2, GH/2, GW, GH, 0x0a0a0a);

        this.add.text(GW/2, 130, 'RUN JUMP DUCK', {
            fontSize: '62px', fill: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold'
        }).setOrigin(0.5);

        this.add.text(GW/2, 270, '[1]  PLAY', {
            fontSize: '34px', fill: '#aaffaa', fontFamily: 'monospace'
        }).setOrigin(0.5);

        this.add.text(GW/2, 340, '[2]  CREDITS', {
            fontSize: '34px', fill: '#aaaaff', fontFamily: 'monospace'
        }).setOrigin(0.5);

        this.add.text(GW/2, 440, `HIGH SCORE: ${hs}`, {
            fontSize: '28px', fill: '#ffff88', fontFamily: 'monospace'
        }).setOrigin(0.5);

        // Start music immediately; if AudioContext is locked, wait for first interaction
        if (this.sound.locked) {
            this.sound.once('unlocked', () => startMusic(this));
        } else {
            startMusic(this);
        }

        this.input.keyboard.once('keydown-ONE', () => { startMusic(this); this.scene.start('IntroScene'); });
        this.input.keyboard.once('keydown-TWO', () => { startMusic(this); this.scene.start('CreditsScene'); });
    }
}

// ─── Intro Scene ──────────────────────────────────────────────────────────────
class IntroScene extends Phaser.Scene {
    constructor() { super('IntroScene'); }

    create() {
        const lines = [
            'THERE ARE ONLY THREE OPTIONS:',
            'RUN, JUMP, DUCK',
            'COMPLETE EACH COMMAND BEFORE TIME RUNS OUT.',
            "YOU THINK YOU'RE SO SMART?",
            'YOU SHOULD THINK AGAIN!'
        ];

        this.add.rectangle(GW/2, GH/2, GW, GH, 0x0a0a0a);

        const t = this.add.text(GW/2, GH/2, '', {
            fontSize: '36px', fill: '#ffffff', fontFamily: 'monospace',
            align: 'center', wordWrap: { width: GW - 120 }
        }).setOrigin(0.5);

        let i = 0;
        const next = () => {
            if (i >= lines.length) { this.time.delayedCall(400, () => this.scene.start('GameScene')); return; }
            t.setText(lines[i++]);
            this.time.delayedCall(1500, () => { t.setText(''); this.time.delayedCall(150, next); });
        };
        next();
    }
}

// ─── Credits Scene ────────────────────────────────────────────────────────────
class CreditsScene extends Phaser.Scene {
    constructor() { super('CreditsScene'); }

    create() {
        this.add.rectangle(GW/2, GH/2, GW, GH, 0x0a0a0a);

        this.add.text(GW/2, 150, 'CREDITS', {
            fontSize: '52px', fill: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold'
        }).setOrigin(0.5);

        this.add.text(GW/2, 310, 'Nic, Claude', {
            fontSize: '34px', fill: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold'
        }).setOrigin(0.5);

        this.add.text(GW/2, 500, 'Press any key to return', {
            fontSize: '18px', fill: '#555555', fontFamily: 'monospace'
        }).setOrigin(0.5);

        this.input.keyboard.once('keydown', () => this.scene.start('MenuScene'));
    }
}

// ─── Game Scene ───────────────────────────────────────────────────────────────
class GameScene extends Phaser.Scene {
    constructor() { super('GameScene'); }

    create() {
        this.lm         = new LevelManager();
        this.score      = 0;
        this.cmdCount   = 0;
        this.state      = 'idle';
        this.curCmd     = null;
        this.timerEv    = null;
        this.timerLeft  = 0;
        this.colData    = null;
        this.invincible = false;

        this.add.rectangle(GW/2, GH/2, GW, GH, 0x0a0a0a);

        this._buildStaticUI();
        this._buildExpandedPanel();

        this.lm.apply();
        this._startRound();

        this.input.keyboard.on('keydown', this._onKey, this);
        this.events.on('shutdown', () => this.input.keyboard.off('keydown', this._onKey, this));
    }

    // ── Static UI ────────────────────────────────────────────────────────────

    _buildStaticUI() {
        this.bInst  = this.add.graphics();
        this.bTimer = this.add.graphics();
        this.bImg   = this.add.graphics();
        this.bTxt   = this.add.graphics();
        this.bScore = this.add.graphics();
        this.bCtrl  = this.add.graphics();

        border(this.bInst,  FR.inst);
        border(this.bTimer, FR.timer);
        border(this.bImg,   FR.img);
        border(this.bTxt,   FR.txt);
        border(this.bScore, FR.score);
        border(this.bCtrl,  FR.ctrl);

        // Instruction frame
        const if_ = fc(FR.inst);
        this.tInstMain = this.add.text(if_.cx, if_.cy - 14, 'INPUT THE COMMAND', {
            fontSize: '24px', fill: '#ffffff', fontFamily: 'monospace'
        }).setOrigin(0.5);
        this.tInstSub = this.add.text(if_.cx, if_.cy + 18, '', {
            fontSize: '22px', fontFamily: 'monospace'
        }).setOrigin(0.5).setVisible(false);

        // Timer frame
        const tf = fc(FR.timer);
        this.tTimerNum = this.add.text(tf.cx, tf.cy - 16, '2.0', {
            fontSize: '34px', fill: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold'
        }).setOrigin(0.5);
        this.gTimerBar = this.add.graphics();

        // Image frame — black fill + aspect-ratio-fitted sprite
        const imgf = fc(FR.img);
        this.rImgBg = this.add.rectangle(imgf.cx, imgf.cy, FR.img[2] - 4, FR.img[3] - 4, 0x000000);
        this.imgSprite = this.add.image(imgf.cx, imgf.cy, 'run');
        this._fitSprite(this.imgSprite);

        // Text frame
        const txtf = fc(FR.txt);
        this.tCmdText = this.add.text(txtf.cx, txtf.cy, '', {
            fontSize: '72px', fill: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold'
        }).setOrigin(0.5);

        // Score frame — background rect for flash, then label + number on top
        const sf = fc(FR.score);
        this.rScoreBg = this.add.rectangle(sf.cx, sf.cy, FR.score[2] - 4, FR.score[3] - 4, 0x226622)
            .setVisible(false);

        // Invincibility indicator (top-right corner)
        this.tInvincible = this.add.text(GW - 10, 10, '*** INVINCIBLE ***', {
            fontSize: '14px', fill: '#ff44ff', fontFamily: 'monospace'
        }).setOrigin(1, 0).setVisible(false);
        this.add.text(sf.cx, sf.y + 22, 'SCORE', {
            fontSize: '18px', fill: '#888888', fontFamily: 'monospace'
        }).setOrigin(0.5);
        this.tScore = this.add.text(sf.cx, sf.y + 58, '0', {
            fontSize: '34px', fill: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold'
        }).setOrigin(0.5);

        // Compact controls (sidebar) — key image + text on top
        this.ctrlItems = {};
        CMDS.forEach((cmd, i) => {
            const rowY = FR.ctrl[1] + 50 + i * (FR.ctrl[3] / 3);
            const cx   = fc(FR.ctrl).cx;

            const dot  = this.add.image(cx - 70, rowY, cmd).setDisplaySize(32, 32);
            const lbl  = this.add.text(cx - 15, rowY, CMD_LABELS[cmd], {
                fontSize: '20px', fill: '#cccccc', fontFamily: 'monospace'
            }).setOrigin(0, 0.5);
            const kimg = this.add.image(cx + 80, rowY, 'key').setDisplaySize(48, 48);
            const ktxt = this.add.text(cx + 80, rowY, '', {
                fontSize: '20px', fill: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold'
            }).setOrigin(0.5);

            this.ctrlItems[cmd] = { dot, lbl, kimg, ktxt };
        });
    }

    // ── Expanded Panel ───────────────────────────────────────────────────────

    _buildExpandedPanel() {
        const ef = fc(FR.exp);

        this.expBg     = this.add.rectangle(ef.cx, ef.cy, FR.exp[2], FR.exp[3], 0x111118).setVisible(false);
        this.expBorder = this.add.graphics();
        this.expLevel  = this.add.text(ef.cx, FR.exp[1] + 36, '', {
            fontSize: '22px', fill: '#888888', fontFamily: 'monospace'
        }).setOrigin(0.5).setVisible(false);

        this.expItems = {};
        const rowH = (FR.exp[3] - 80) / 3;

        CMDS.forEach((cmd, i) => {
            const ry = FR.exp[1] + 80 + i * rowH + rowH / 2;
            const lx = FR.exp[0] + 80;
            const kx = FR.exp[0] + FR.exp[2] - 130;

            const dot  = this.add.image(lx, ry, cmd).setDisplaySize(44, 44).setVisible(false);
            const lbl  = this.add.text(lx + 60, ry, CMD_LABELS[cmd], {
                fontSize: '38px', fill: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold'
            }).setOrigin(0, 0.5).setVisible(false);

            // Old key (fades out)
            const okimg = this.add.image(kx, ry, 'key').setDisplaySize(80, 80).setVisible(false);
            const oktxt = this.add.text(kx, ry, '', {
                fontSize: '38px', fill: '#999999', fontFamily: 'monospace', fontStyle: 'bold'
            }).setOrigin(0.5).setVisible(false);

            // New key (fades in)
            const nkimg = this.add.image(kx, ry, 'key').setDisplaySize(80, 80).setVisible(false);
            const nktxt = this.add.text(kx, ry, '', {
                fontSize: '38px', fill: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold'
            }).setOrigin(0.5).setVisible(false);

            this.expItems[cmd] = { dot, lbl, okimg, oktxt, nkimg, nktxt };
        });
    }

    // ── Round Flow ───────────────────────────────────────────────────────────

    _startRound() {
        this.cmdCount = 0;
        this.state    = 'idle';
        this._hideMainFrames();
        this._showExpandedPanel(() => {
            this._hideExpandedPanel();
            this._showMainFrames();
            this._updateSidebarControls();
            this._nextCommand();
        });
    }

    _hideMainFrames() {
        [
            this.bInst, this.bTimer, this.bImg, this.bTxt, this.bCtrl,
            this.tInstMain, this.tInstSub, this.tTimerNum, this.gTimerBar,
            this.rImgBg, this.imgSprite, this.tCmdText,
        ].forEach(o => o.setVisible(false));
        CMDS.forEach(c => Object.values(this.ctrlItems[c]).forEach(o => o.setVisible(false)));
    }

    _showMainFrames() {
        const lm = this.lm;

        border(this.bInst,  FR.inst);
        border(this.bTimer, FR.timer);
        border(this.bScore, FR.score);

        [this.bInst, this.bTimer, this.tInstMain, this.tTimerNum].forEach(o => o.setVisible(true));

        if (lm.showImg) {
            border(this.bImg, FR.img);
            this.bImg.setVisible(true);
            this.rImgBg.setVisible(true);
            this.imgSprite.setVisible(true);
        }
        if (lm.showTxt) {
            border(this.bTxt, FR.txt);
            this.bTxt.setVisible(true);
            this.tCmdText.setVisible(true);
        }
        if (lm.showCtrl) {
            border(this.bCtrl, FR.ctrl);
            this.bCtrl.setVisible(true);
            CMDS.forEach(c => Object.values(this.ctrlItems[c]).forEach(o => o.setVisible(true)));
        }
    }

    _updateSidebarControls() {
        CMDS.forEach(cmd => {
            this.ctrlItems[cmd].ktxt.setText(
                (this.lm.assignments[cmd] || '').toUpperCase()
            );
        });
    }

    // ── Expanded Panel Animation ──────────────────────────────────────────────

    _showExpandedPanel(onDone) {
        const lm      = this.lm;
        const isFirst = lm.level === 1 && lm.extraCycles === 0;

        this.expBg.setVisible(true);
        border(this.expBorder, FR.exp, 0xffffff, 2);
        this.expLevel.setText(`LEVEL  ${lm.level}`).setVisible(true);

        CMDS.forEach(cmd => {
            const it      = this.expItems[cmd];
            const newKey  = lm.assignments[cmd];
            const oldKey  = lm.prevAssign[cmd];
            const changed = lm.changed.includes(cmd);

            it.dot.setVisible(true);
            it.lbl.setVisible(true);
            it.nktxt.setText((newKey || '').toUpperCase());

            if (isFirst || !changed) {
                it.nkimg.setAlpha(0).setVisible(true);
                it.nktxt.setAlpha(0).setVisible(true);
                this.tweens.add({
                    targets: [it.nkimg, it.nktxt],
                    alpha: 1, duration: ANIM_FIRST_FADE_DUR, delay: ANIM_FIRST_FADE_DELAY
                });
            } else {
                it.oktxt.setText((oldKey || '').toUpperCase());
                it.okimg.setAlpha(1).setVisible(true);
                it.oktxt.setAlpha(1).setVisible(true);
                it.nkimg.setAlpha(0).setVisible(true);
                it.nktxt.setAlpha(0).setVisible(true);

                this.tweens.add({
                    targets: [it.okimg, it.oktxt],
                    alpha: 0, duration: ANIM_FADEOUT_DUR, delay: ANIM_FADEOUT_DELAY
                });
                this.tweens.add({
                    targets: [it.nkimg, it.nktxt],
                    alpha: 1, duration: ANIM_FADEIN_DUR, delay: ANIM_FADEIN_DELAY
                });
            }
        });

        this.time.delayedCall(isFirst ? ANIM_FIRST_HOLD : ANIM_HOLD, onDone);
    }

    _hideExpandedPanel() {
        this.expBg.setVisible(false);
        this.expBorder.clear();
        this.expLevel.setVisible(false);
        CMDS.forEach(cmd => {
            const it = this.expItems[cmd];
            [it.dot, it.lbl, it.okimg, it.oktxt, it.nkimg, it.nktxt].forEach(o => o.setVisible(false));
        });
    }

    // ── Command Loop ─────────────────────────────────────────────────────────

    _fitSprite(sprite) {
        const fw  = FR.img[2] - 20;
        const fh  = FR.img[3] - 20;
        const src = this.textures.get(sprite.texture.key).getSourceImage();
        const scale = Math.min(fw / src.width, fh / src.height);
        sprite.setDisplaySize(src.width * scale, src.height * scale);
    }

    _nextCommand() {
        if (this.cmdCount >= ROUND_SIZE) {
            this.lm.advance();
            this._startRound();
            return;
        }

        // Restore visibility after pass flash
        if (this.lm.showImg) this.imgSprite.setVisible(true);
        if (this.lm.showTxt) this.tCmdText.setVisible(true);
        this.tInstMain.setVisible(true);
        this.tTimerNum.setVisible(true);

        this.state  = 'command';
        this.curCmd = CMDS[Math.floor(Math.random() * 3)];

        if (this.lm.colorMech) {
            this.colData = this.lm.colorData();
            const { word, wordClr, txtBorder, imgBorder } = this.colData;
            this.tInstMain.setText('INPUT THE COMMAND IN');
            this.tInstSub.setText(word).setStyle({ color: hexStr(wordClr), fontSize: '22px' }).setVisible(true);
            if (this.lm.showImg) border(this.bImg, FR.img, imgBorder, 3);
            if (this.lm.showTxt) border(this.bTxt, FR.txt, txtBorder, 3);
        } else {
            this.tInstMain.setText('INPUT THE COMMAND');
            this.tInstSub.setVisible(false);
            if (this.lm.showImg) border(this.bImg, FR.img, 0xffffff, 2);
            if (this.lm.showTxt) border(this.bTxt, FR.txt, 0xffffff, 2);
        }

        if (this.lm.showImg) { this.imgSprite.setTexture(this.curCmd); this._fitSprite(this.imgSprite); }
        if (this.lm.showTxt) this.tCmdText.setText(CMD_LABELS[this.curCmd]);

        this._startTimer(this.lm.timerMs);
    }

    // ── Pass Flash ───────────────────────────────────────────────────────────

    _showPassFlash(cb) {
        // Hide command content
        this.rImgBg.setVisible(false);
        this.imgSprite.setVisible(false);
        this.tCmdText.setVisible(false);
        this.tInstMain.setVisible(false);
        this.tInstSub.setVisible(false);
        this.tTimerNum.setVisible(false);
        this.gTimerBar.clear();

        // Flash score frame green
        this.rScoreBg.setVisible(true);
        border(this.bScore, FR.score, 0x44ff44, 3);

        this.time.delayedCall(ANIM_PASS_FLASH, () => {
            this.rScoreBg.setVisible(false);
            border(this.bScore, FR.score, 0xffffff, 2);
            cb();
        });
    }

    // ── Timer ────────────────────────────────────────────────────────────────

    _startTimer(ms) {
        if (this.timerEv) { this.timerEv.remove(false); this.timerEv = null; }
        this.timerLeft = ms;
        const total    = ms;
        const TICK     = 50;

        this.timerEv = this.time.addEvent({
            delay: TICK,
            repeat: Math.ceil(ms / TICK),
            callback: () => {
                if (this.state !== 'command') return;
                this.timerLeft = Math.max(0, this.timerLeft - TICK);

                const frac = this.timerLeft / total;
                this.tTimerNum.setText((this.timerLeft / 1000).toFixed(1));

                const barX = FR.timer[0] + 10;
                const barY = FR.timer[1] + FR.timer[3] - 18;
                const barW = (FR.timer[2] - 20) * frac;
                const clr  = frac > 0.5 ? 0x44ff44 : frac > 0.25 ? 0xffff00 : 0xff4444;

                this.gTimerBar.setVisible(true).clear();
                this.gTimerBar.fillStyle(clr);
                this.gTimerBar.fillRect(barX, barY, barW, 10);
                this.gTimerBar.lineStyle(1, 0x444444);
                this.gTimerBar.strokeRect(barX, barY, FR.timer[2] - 20, 10);

                if (this.timerLeft <= 0 && !this.invincible) this._gameOver();
            }
        });
    }

    // ── Input ────────────────────────────────────────────────────────────────

    _onKey(event) {
        event.preventDefault();

        // Toggle invulnerability at any time
        if (event.key === '*') {
            this.invincible = !this.invincible;
            this.tInvincible.setVisible(this.invincible);
            return;
        }

        if (this.state !== 'command') return;
        const key     = event.key;
        const correct = this.lm.assignments[this.curCmd];

        if (key === correct) {
            this.score++;
            this.tScore.setText(String(this.score));
            this.cmdCount++;
            if (this.timerEv) { this.timerEv.remove(false); this.timerEv = null; }
            this.state = 'pass';
            this.sound.play('pass');
            this._showPassFlash(() => {
                this.state = 'idle';
                this._nextCommand();
            });
        } else if (!this.invincible) {
            this._gameOver();
        }
    }

    // ── Game Over ────────────────────────────────────────────────────────────

    _gameOver() {
        if (this.state === 'gameover') return;
        this.state = 'gameover';
        if (this.timerEv) { this.timerEv.remove(false); this.timerEv = null; }

        this.sound.play('fail');

        const prev = parseInt(localStorage.getItem('rjd_hs') || '0');
        if (this.score > prev) localStorage.setItem('rjd_hs', String(this.score));

        this.time.delayedCall(800, () => this.scene.start('MenuScene'));
    }
}

// ─── Phaser Config ────────────────────────────────────────────────────────────
new Phaser.Game({
    type:            Phaser.AUTO,
    width:           GW,
    height:          GH,
    backgroundColor: '#0a0a0a',
    pauseOnBlur:     false,
    scale: {
        mode:       Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [PreloadScene, MenuScene, IntroScene, GameScene, CreditsScene],
});
