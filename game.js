// Run Jump Duck

const GW = 960;
const GH = 550;
const CMDS = ['run', 'jump', 'duck'];
const CMD_LABELS = { run: 'RUN', jump: 'JUMP', duck: 'DUCK' };
const CMD_COLORS = { run: 0x44cc44, jump: 0x4488ff, duck: 0xffcc00 };
const KEYS_INIT = ['a', 's', 'd'];
const KEYS_EXT  = ['f', 'j', 'k', 'l', ';'];
const KEYS_FULL = [
    'q','w','e','r','t','y','u','i','o','p','[',']','\\',
    'a','s','d','f','g','h','j','k','l',';',"'",
    'z','x','c','v','b','n','m',',','.','/'
];
const ROUND_SIZE = 5;
const INIT_MS    = 4000;

// Frame layout helpers: [x, y, w, h]
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

// ─── Level Manager ────────────────────────────────────────────────────────────
class LevelManager {
    constructor() {
        this.level        = 1;
        this.pool         = [...KEYS_INIT];
        this.assignments  = {};   // { run, jump, duck } -> key string
        this.prevAssign   = {};
        this.changed      = [];   // which commands changed this round
        this.showImg      = true;
        this.showTxt      = true;
        this.showCtrl     = true;
        this.colorMech    = false;
        this.timerMs      = INIT_MS;
        this.extraCycles  = 0;
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

        this.showTxt  = lvl !== 9;
        this.showImg  = lvl !== 10;
        this.showCtrl = lvl < 11;
        this.colorMech = lvl >= 12;
    }

    assignAll() {
        const keys = [...this.pool].sort(() => Math.random() - 0.5);
        CMDS.forEach((c, i) => { this.assignments[c] = keys[i]; this.changed.push(c); });
    }

    reassignOne() {
        const cmd     = CMDS[Math.floor(Math.random() * 3)];
        const others  = CMDS.filter(c => c !== cmd).map(c => this.assignments[c]);
        const curKey  = this.assignments[cmd];
        const pool    = this.pool.filter(k => !others.includes(k) && k !== curKey);

        if (pool.length === 0) {
            // Fall back: swap with a random other command
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

// ─── Utility ──────────────────────────────────────────────────────────────────
function border(gfx, f, color = 0xffffff, lw = 2) {
    gfx.clear();
    gfx.lineStyle(lw, color, 1);
    gfx.strokeRect(f[0], f[1], f[2], f[3]);
}

function hexStr(n) { return '#' + n.toString(16).padStart(6, '0'); }

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

        this.input.keyboard.once('keydown-ONE', () => this.scene.start('IntroScene'));
        this.input.keyboard.once('keydown-TWO', () => this.scene.start('CreditsScene'));
    }
}

// ─── Intro Scene ──────────────────────────────────────────────────────────────
class IntroScene extends Phaser.Scene {
    constructor() { super('IntroScene'); }

    create() {
        const lines = [
            'THERE ARE ONLY THREE OPTIONS:',
            'RUN, JUMP, DUCK.',
            'COMPLETE EACH COMMAND.',
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

        this.add.text(GW/2, 310, 'Nic, Claude', { fontSize: '34px', fill: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold' }).setOrigin(0.5);

        this.add.text(GW/2, 500, 'Press any key to return', { fontSize: '18px', fill: '#555555', fontFamily: 'monospace' }).setOrigin(0.5);

        this.input.keyboard.once('keydown', () => this.scene.start('MenuScene'));
    }
}

// ─── Game Scene ───────────────────────────────────────────────────────────────
class GameScene extends Phaser.Scene {
    constructor() { super('GameScene'); }

    create() {
        this.lm           = new LevelManager();
        this.score        = 0;
        this.cmdCount     = 0;
        this.state        = 'idle';
        this.curCmd       = null;
        this.timerEv      = null;
        this.timerLeft    = 0;
        this.colData      = null;

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
        // Border graphics (one per frame so we can recolor individually)
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

        // Instruction frame text (two lines for color mechanic)
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

        // Image frame placeholder
        const imgf = fc(FR.img);
        this.rImgPlaceholder = this.add.rectangle(imgf.cx, imgf.cy, FR.img[2]-40, FR.img[3]-40, 0x333333);
        this.tImgCmd = this.add.text(imgf.cx, imgf.cy, '', {
            fontSize: '56px', fill: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold'
        }).setOrigin(0.5);

        // Text frame
        const txtf = fc(FR.txt);
        this.tCmdText = this.add.text(txtf.cx, txtf.cy, '', {
            fontSize: '72px', fill: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold'
        }).setOrigin(0.5);

        // Score frame
        const sf = fc(FR.score);
        this.add.text(sf.cx, sf.y + 22, 'SCORE', { fontSize: '18px', fill: '#888888', fontFamily: 'monospace' }).setOrigin(0.5);
        this.tScore = this.add.text(sf.cx, sf.y + 58, '0', {
            fontSize: '34px', fill: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold'
        }).setOrigin(0.5);

        // Compact controls (sidebar)
        this.ctrlItems = {};
        CMDS.forEach((cmd, i) => {
            const rowY = FR.ctrl[1] + 50 + i * (FR.ctrl[3] / 3);
            const cx   = fc(FR.ctrl).cx;

            const dot = this.add.rectangle(cx - 70, rowY, 32, 32, CMD_COLORS[cmd]);
            const lbl = this.add.text(cx - 15, rowY, CMD_LABELS[cmd], {
                fontSize: '20px', fill: '#cccccc', fontFamily: 'monospace'
            }).setOrigin(0, 0.5);

            const kbg = this.add.rectangle(cx + 80, rowY, 48, 48, 0x2a2a2a);
            kbg.setStrokeStyle(2, 0x888888);
            const ktxt = this.add.text(cx + 80, rowY, '', {
                fontSize: '22px', fill: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold'
            }).setOrigin(0.5);

            this.ctrlItems[cmd] = { dot, lbl, kbg, ktxt };
        });
    }

    // ── Expanded Panel ───────────────────────────────────────────────────────

    _buildExpandedPanel() {
        const ef = fc(FR.exp);

        this.expBg     = this.add.rectangle(ef.cx, ef.cy, FR.exp[2], FR.exp[3], 0x111118).setVisible(false);
        this.expBorder = this.add.graphics();

        this.expLevel = this.add.text(ef.cx, FR.exp[1] + 36, '', {
            fontSize: '22px', fill: '#888888', fontFamily: 'monospace'
        }).setOrigin(0.5).setVisible(false);

        this.expItems = {};
        const rowH = (FR.exp[3] - 80) / 3;

        CMDS.forEach((cmd, i) => {
            const ry  = FR.exp[1] + 80 + i * rowH + rowH / 2;
            const lx  = FR.exp[0] + 80;
            const kx  = FR.exp[0] + FR.exp[2] - 130;

            // Command indicator
            const dot = this.add.rectangle(lx, ry, 44, 44, CMD_COLORS[cmd]).setVisible(false);
            const lbl = this.add.text(lx + 60, ry, CMD_LABELS[cmd], {
                fontSize: '38px', fill: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold'
            }).setOrigin(0, 0.5).setVisible(false);

            // Old key (fades out)
            const okbg  = this.add.rectangle(kx, ry, 80, 80, 0x333333).setVisible(false);
            okbg.setStrokeStyle(3, 0x666666);
            const oktxt = this.add.text(kx, ry, '', {
                fontSize: '42px', fill: '#999999', fontFamily: 'monospace', fontStyle: 'bold'
            }).setOrigin(0.5).setVisible(false);

            // New key (fades in)
            const nkbg  = this.add.rectangle(kx, ry, 80, 80, 0x1a331a).setVisible(false);
            nkbg.setStrokeStyle(3, 0x44ff44);
            const nktxt = this.add.text(kx, ry, '', {
                fontSize: '42px', fill: '#44ff44', fontFamily: 'monospace', fontStyle: 'bold'
            }).setOrigin(0.5).setVisible(false);

            this.expItems[cmd] = { dot, lbl, okbg, oktxt, nkbg, nktxt };
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
        const all = [
            this.bInst, this.bTimer, this.bImg, this.bTxt, this.bCtrl,
            this.tInstMain, this.tInstSub, this.tTimerNum, this.gTimerBar,
            this.rImgPlaceholder, this.tImgCmd, this.tCmdText,
        ];
        all.forEach(o => o.setVisible(false));
        CMDS.forEach(c => Object.values(this.ctrlItems[c]).forEach(o => o.setVisible(false)));
    }

    _showMainFrames() {
        const lm = this.lm;

        border(this.bInst,  FR.inst);
        border(this.bTimer, FR.timer);
        border(this.bScore, FR.score);

        this.bInst.setVisible(true);
        this.bTimer.setVisible(true);
        this.tInstMain.setVisible(true);
        this.tTimerNum.setVisible(true);

        if (lm.showImg) {
            border(this.bImg, FR.img);
            this.bImg.setVisible(true);
            this.rImgPlaceholder.setVisible(true);
            this.tImgCmd.setVisible(true);
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
        const ef      = fc(FR.exp);

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
                // Just fade in new key; no old key
                it.nkbg.setAlpha(0).setVisible(true);
                it.nktxt.setAlpha(0).setVisible(true);
                this.tweens.add({ targets: [it.nkbg, it.nktxt], alpha: 1, duration: 1000, delay: 200 });
            } else {
                // Show old fading out, new fading in
                it.oktxt.setText((oldKey || '').toUpperCase());
                it.okbg.setAlpha(1).setVisible(true);
                it.oktxt.setAlpha(1).setVisible(true);
                it.nkbg.setAlpha(0).setVisible(true);
                it.nktxt.setAlpha(0).setVisible(true);

                this.tweens.add({ targets: [it.okbg, it.oktxt], alpha: 0, duration: 500, delay: 300 });
                this.tweens.add({ targets: [it.nkbg, it.nktxt], alpha: 1, duration: 500, delay: 500 });
            }
        });

        const holdMs = isFirst ? 2000 : 3000;
        this.time.delayedCall(holdMs, onDone);
    }

    _hideExpandedPanel() {
        this.expBg.setVisible(false);
        this.expBorder.clear();
        this.expLevel.setVisible(false);
        CMDS.forEach(cmd => {
            const it = this.expItems[cmd];
            [it.dot, it.lbl, it.okbg, it.oktxt, it.nkbg, it.nktxt].forEach(o => o.setVisible(false));
        });
    }

    // ── Command Loop ─────────────────────────────────────────────────────────

    _nextCommand() {
        if (this.cmdCount >= ROUND_SIZE) {
            this.lm.advance();
            this._startRound();
            return;
        }

        this.state  = 'command';
        this.curCmd = CMDS[Math.floor(Math.random() * 3)];

        // Update instruction frame
        if (this.lm.colorMech) {
            this.colData = this.lm.colorData();
            const { word, wordClr, txtBorder, imgBorder } = this.colData;
            this.tInstMain.setText('INPUT THE COMMAND IN').setVisible(true);
            this.tInstSub.setText(word).setStyle({ color: hexStr(wordClr), fontSize: '22px' }).setVisible(true);
            if (this.lm.showImg) border(this.bImg, FR.img, imgBorder, 3);
            if (this.lm.showTxt) border(this.bTxt, FR.txt, txtBorder, 3);
        } else {
            this.tInstMain.setText('INPUT THE COMMAND').setVisible(true);
            this.tInstSub.setVisible(false);
            if (this.lm.showImg) border(this.bImg, FR.img, 0xffffff, 2);
            if (this.lm.showTxt) border(this.bTxt, FR.txt, 0xffffff, 2);
        }

        // Update command display
        if (this.lm.showImg) {
            this.rImgPlaceholder.setFillStyle(CMD_COLORS[this.curCmd]);
            this.tImgCmd.setText(CMD_LABELS[this.curCmd]);
        }
        if (this.lm.showTxt) {
            this.tCmdText.setText(CMD_LABELS[this.curCmd]);
        }

        this._startTimer(this.lm.timerMs);
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

                if (this.timerLeft <= 0) this._gameOver();
            }
        });
    }

    // ── Input ────────────────────────────────────────────────────────────────

    _onKey(event) {
        if (this.state !== 'command') return;
        const key     = event.key;
        const correct = this.lm.assignments[this.curCmd];

        if (key === correct) {
            this.score++;
            this.tScore.setText(String(this.score));
            this.cmdCount++;
            if (this.timerEv) { this.timerEv.remove(false); this.timerEv = null; }
            this.gTimerBar.clear();
            this.state = 'idle';
            this._nextCommand();
        } else {
            this._gameOver();
        }
    }

    // ── Game Over ────────────────────────────────────────────────────────────

    _gameOver() {
        if (this.state === 'gameover') return;
        this.state = 'gameover';
        if (this.timerEv) { this.timerEv.remove(false); this.timerEv = null; }

        const prev = parseInt(localStorage.getItem('rjd_hs') || '0');
        if (this.score > prev) localStorage.setItem('rjd_hs', String(this.score));

        this.time.delayedCall(300, () => this.scene.start('MenuScene'));
    }
}

// ─── Phaser Config ────────────────────────────────────────────────────────────
new Phaser.Game({
    type:            Phaser.AUTO,
    width:           GW,
    height:          GH,
    backgroundColor: '#0a0a0a',
    scale: {
        mode:       Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [MenuScene, IntroScene, GameScene, CreditsScene],
});
