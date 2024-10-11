//シューティングゲーム的なもの
//by はぐれヨウマ

{//Javascriptメモ
    //動的言語だからか入力補完があまり効かなくて不便～
    //thisは.の左のオブジェクトのこと！thisを固定するにはbindする　アロー関数=>のthisは変わらないよ
    //ゲッター・セッターはアロー関数=>に未対応
    //スプレッド構文[...配列]
    //Mapは名前で読み書きできる配列
    //ジェネレーター構文*method(){}関数を中断と再開できる アロー関数=>はない
    //jsファイルを後から読み込むには、script要素を追加してonloadイベントで待つのがいい？
    //a=yield 1;→b=generator.next();でbに1が返ってきて、続けてgenerator.next(2)でaに2が返ってくる　yieldの外と変数のやり取りができる
    //非同期 new Promise((resolve){非同期にやりたいこと;resolve();}).then(){非同期が終わってから呼ばれる};
    //async関数はresolveが呼んであるPromiseオブジェクトをreturnするよ
    //webフォントの読み込み待ちはonloadイベントでできないみたいなのでWebFontLoaderを使った
}
'use strict';
console.clear();

const FONT = {
    DEFAULT: { NAME: 'Kaisei Decol', URL: 'https://fonts.googleapis.com/css2?family=Kaisei+Decol&display=swap', CUSTOM: false },
    EMOJI: { NAME: 'FontAwesome', URL: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.6.0/css/all.min.css', CUSTOM: true }
}
Object.freeze(FONT);
const TEXT_SIZE = {
    NORMAL: 20,
    MEDIUM: 30,
    BIG: 40,
}
Object.freeze(TEXT_SIZE);
const THEME = {
    TEXT: '#ffffff',
    HIGHLITE: 'yellow'
}
Object.freeze(THEME)
const EMOJI = {
    GHOST: 'f6e2',
    CAT: 'f6be',
    CROW: 'f520',
    HOUSE: 'e00d',
    TREE: 'f1bb',
    DOVE: 'f4ba',
    POO: 'f2fe'
}
Object.freeze(EMOJI);

const LAYER_NAMES = ['effect', 'ui'];

let text = {
    title: 'シューティングゲーム', title2: 'のようなもの', presskey: 'Zキーを押してね',
    explanation1: '操作方法：↑↓←→ 選択、移動',
    explanation2: 'Z 決定、攻撃　X 取消、中断',
    start: 'スタート', highscore: 'ハイスコア', credit: 'クレジット',
    pause: 'ポーズ', resume: 'ゲームを続ける', restart: '最初からやり直す', returntitle: 'タイトルに戻る',
    gameover: 'ゲームオーバー', continue: 'コンティニュー'
}
const KEY_REPEAT_WAIT_FIRST = 0.25;
const KEY_REPEAT_WAIT = 0.125;

const PLAYER_MOVE_SPEED = 300;
const PLAYER_BULLET_SPEED = 400;
const PLAYER_FIRELATE = 1 / 20;
const BADDIES_BULLET_SPEED = 150;
const BADDIE_FIRELATE = 1 / 0.5;

class Game {
    constructor(width = 360, height = 480) {
        document.body.style.backgroundColor = 'black';
        this.screenRect = new Rect().set(0, 0, width, height);
        this.layers = new Layers(width, height);
        this.root = new Mono(new State(), new Child());
        this.input = new Input();
        this.time = this.delta = 0;
        this.fpsBuffer = Array.from({ length: 60 });
        this.asettsName;
    }
    get width() { return this.screenRect.width };
    get height() { return this.screenRect.height };
    preLoad() { this.asettsName = arguments; }
    start(create) {
        (async () => {
            const pageLoadPromise = new Promise(resolve => addEventListener('load', resolve));
            await new Promise(resolve => {
                const wf = document.createElement('script');
                wf.src = 'https://ajax.googleapis.com/ajax/libs/webfont/1.6.26/webfont.js';
                wf.onload = resolve;
                document.head.appendChild(wf);
            })
            const fonts = [];
            for (const asset of this.asettsName) {
                if (typeof asset === 'string') {
                    switch (true) {
                        case Util.isImageFile(asset):
                            await new Promise(resolve => {
                                const img = new Image();
                                img.src = asset;
                                img.onload(resolve());
                            });
                            break;
                        default:
                            break;
                    }
                } else {
                    fonts.push(asset);
                }
            }
            await new Promise(resolve => {
                const customs = fonts.filter((f) => f.CUSTOM);
                WebFont.load({
                    google: { families: fonts.filter((f) => !f.CUSTOM).map((f) => f.NAME) }, custom: { families: customs.map((f) => f.NAME), urls: customs.map((f) => f.URL) }, active: resolve
                });
            });
            await pageLoadPromise.then(() => {
                this.input.init();
                create?.();
                this.time = performance.now();
                this.mainloop();
            }).catch(reject => console.error(reject));
        })();
    }
    mainloop() {
        const now = performance.now();
        this.delta = Math.min((now - this.time) / 1000.0, 1 / 1.0);
        this.time = now;
        this.fpsBuffer.push(this.delta);
        this.fpsBuffer.shift();
        this.input.update();
        this.root.baseUpdate();
        Child.clean();
        this.layers.before();
        this.root.baseDraw(this.layers.get('main').getContext());
        this.layers.after();
        requestAnimationFrame(this.mainloop.bind(this));
    }
    pushScene = scene => this.root.child.add(scene);
    popScene = () => this.root.child.pop();
    setState = (name, state) => this.root.state.start(name, state);
    isOutOfRange = (rect) => !this.screenRect.isIntersect(rect);
    get fps() { return Math.floor(1 / Util.average(this.fpsBuffer)) };
}
class Layers {
    constructor(width, height) {
        this.layers = new Map();
        this.width = width;
        this.height = height;
        const div = this.div = document.createElement('div');
        div.style.position = 'relative';
        div.style.display = 'block';
        div.style.width = `${width}px`;
        div.style.height = `${height}px`;
        div.style.margin = '1rem auto';
        document.body.insertAdjacentElement('beforebegin', div);
        this.add('bg');
        this.add('main')
        const bg = this.get('bg');
        bg.isUpdate = false;
        const bgctx = bg.getContext();
        bgctx.fillStyle = 'black';
        bgctx.fillRect(0, 0, width, height);
    }
    before() { for (const layer of this.layers.values()) layer.before(); }
    after() { for (const layer of this.layers.values()) layer.after(); }
    add(names) {
        const create = (name) => {
            const layer = new Layer(this.width, this.height);
            this.div.appendChild(layer.canvas);
            this.layers.set(name, layer);
        }
        if (!Array.isArray(names)) {
            create(names);
            return;
        }
        for (const name of names) create(name)
    }
    get = (name) => this.layers.get(name);
}
class Layer {
    constructor(width, height) {
        const canvas = this.canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.style.position = 'absolute';
        this.isUpdate = true;
        this.blur;
        this.isPauseBlur = false
    }
    getContext = () => this.canvas.getContext('2d');
    getBlurContext = () => this.blur.getContext('2d');
    clear = () => this.getContext().clearRect(0, 0, this.canvas.width, this.canvas.height);
    clearBlur = () => this.getBlurContext().clearRect(0, 0, this.canvas.width, this.canvas.height);
    enableBlur() {
        if (this.blur) return;
        const blur = this.blur = document.createElement('canvas');
        blur.width = this.canvas.width;
        blur.height = this.canvas.height;
    }
    before() {
        if (!this.isUpdate) return;
        const ctx = this.getContext();
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        if (!this.blur) return;
        ctx.drawImage(this.blur, 0, 0);
    }
    after() {
        if (!this.isUpdate || !this.blur || this.isPauseBlur) return;
        const ctx = this.getBlurContext();
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.globalAlpha = 0.6;
        ctx.drawImage(this.canvas, 0, 0);
    }
}
class Input {
    constructor() {
        this.nameIndex = new Map();
        this.keyIndex = new Map();
        this.keyData = [];
        this.padIndex;
    }
    init() {
        addEventListener('keydown', this._keyEvent(true));
        addEventListener('keyup', this._keyEvent(false));
        addEventListener('gamepadconnected', e => this.padIndex = e.gamepad.index);
        addEventListener('gamepaddisconnected', e => this.padIndex = undefined);
        this.keybind('left', 'ArrowLeft', { button: 14, axes: 0 });
        this.keybind('right', 'ArrowRight', { button: 15, axes: 1 });
        this.keybind('up', 'ArrowUp', { button: 12, axes: 2 });
        this.keybind('down', 'ArrowDown', { button: 13, axes: 3 });
    }
    _keyEvent(frag) {
        return e => {
            e.preventDefault();
            const i = this.keyIndex.get(e.key);
            if (i === undefined) return;
            this.keyData[i].buffer = frag;
        }
    }
    update() {
        for (let i = 0; i < this.keyData.length; i++) {
            this.keyData[i].before = this.keyData[i].current;
            this.keyData[i].current = this.keyData[i].buffer;
        }
        if (this.padIndex !== undefined) {
            const pad = navigator.getGamepads()[this.padIndex];
            for (const key of this.keyData) {
                if (key.button > -1) key.current |= pad.buttons[key.button].pressed;
                if (key.axes > -1) {
                    const index = Math.floor(key.axes / 2);
                    if (Util.isEven(key.axes)) {
                        key.current |= pad.axes[index] < -0.5;
                    } else {
                        key.current |= pad.axes[index] > 0.5;
                    }
                }
            }
            // for (let i = 0; i < pad.buttons.length; i++) {
            //     if(!pad.buttons[i].pressed)continue;
            //     console.log(`${i}`);
            // }
        }
    }
    keybind(name, key, { button = -1, axes = -1 } = {}) {
        const index = this.nameIndex.size;
        this.nameIndex.set(name, index);
        this.keyIndex.set(key, index);
        this.keyData.push({ buffer: false, before: false, current: false, button: button, axes: axes });
    }
    isDown = (name) => this.keyData[this.nameIndex.get(name)].current;
    isPress = (name) => this.keyData[this.nameIndex.get(name)].current && !this.keyData[this.nameIndex.get(name)].before;
    isUp = (name) => !this.keyData[this.nameIndex.get(name)].current && this.keyData[this.nameIndex.get(name)].before;
}
class Util {
    static naname = 0.71;
    static radian = Math.PI / 180;
    static degree = 180 / Math.PI;
    static parseUnicode = (code) => String.fromCharCode(parseInt(code, 16));
    static clamp = (value, min, max) => Math.min(Math.max(value, min), max);
    static degToX = (deg) => Math.cos(deg * Util.radian);
    static degToY = (deg) => -Math.sin(deg * Util.radian);
    static xyToDeg(x, y) {
        var r = Math.atan2(-y, x);
        if (r < 0) r += 2 * Math.PI;
        return r * Util.degree;
    }
    static dot = (x, y, x2, y2) => x * x2 + y * y2;
    static cross = (x, y, x2, y2) => x * y2 - y * x2;
    static lerp = (start, end, t) => (1 - t) * start + t * end;
    static random = (min, max) => Math.floor(Math.random() * (max + 1 - min) + min);
    static average = (arr) => arr.reduce((prev, current, i, arr) => prev + current) / arr.length;
    static isGenerator = (obj) => obj && typeof obj.next === 'function' && typeof obj.throw === 'function';
    static isEven = (n) => n % 2 === 0;
    static hexColor = (hex, alpha) => `${hex}${alpha.toString(16).padStart(2, '0')}`;
    static isImageFile = (file) => /\.(jpg|jpeg|png|gif)$/i.test(file)
}
class Rect {
    constructor() {
        this.x = this.y = this.width = this.height = 0;
    }
    set(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        return this;
    }
    isIntersect = (rect) => rect.x + rect.width > this.x && this.x + this.width > rect.x && rect.y + rect.height > this.y && this.y + this.height > rect.y;
}
class Mono {
    constructor(...args) {
        this.isExist = this.isActive = true;
        this.mixs = [];
        this.parent;
        this.childIndex = -1;
        this.remove;
        for (const arg of args) {
            if (Array.isArray(arg)) {
                for (const mix of arg) this.addMix(mix);
            } else {
                this.addMix(arg);
            }
        }
    }
    addMix(mix) {
        const name = mix.constructor.name.toLowerCase();
        if (name in this) return;
        mix.owner = this;
        this[name] = mix;
        this.mixs.push(mix);
        return this;
    }
    resetMix() {
        for (const mix of this.mixs) mix.reset();
    }
    baseUpdate() {
        if (!this.isExist || !this.isActive) return;
        this.update();
        for (const mix of this.mixs) mix.update?.();
        this.postUpdate();
    }
    update() { }
    postUpdate() { }
    baseDraw(ctx) {
        if (!this.isExist) return;
        this.draw(ctx);
        for (const mix of this.mixs) mix.draw?.(ctx);
    }
    draw() { };
}
class State {
    constructor() {
        this.generators = new Map();
    }
    reset = () => this.generators.clear();
    isEnable(name) { return this.generators.get(name) !== undefined };
    start = (name, state) => this.generators.set(name, state);
    stop = (name) => this.generators.delete(name);
    update() {
        for (const [name, generator] of this.generators.entries()) {
            let result;
            while (generator) {
                result = generator?.next(result);
                if (result.done) this.stop(name);
                if (result.value === undefined) break;
            }
        }

    }
}
function* waitForTime(time) {
    time -= game.delta;
    while (time > 0) {
        time -= game.delta;
        yield undefined;
    }
    return true;
}
function* waitForFrag(func) {
    while (!func()) yield undefined;
    return true;
}
function* waitForTimeOrFrag(time, func) {
    time -= game.delta;
    while (time > 0 && !func()) {
        time -= game.delta;
        yield undefined;
    }
    return true;
}
class Pos {
    constructor() {
        //align&valign left top=0,center midle=1,right bottom=2
        this.x = this.y = this.width = this.height = this.align = this.valign = this.vx = this.vy = 0;
        this.vxc = this.vyc = 1;
        this._rect = new Rect();
    }
    reset = () => this.set(0, 0, 0, 0);
    set(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        return this;
    }
    update() {
        this.x += this.vx * game.delta;
        this.y += this.vy * game.delta;
        this.vx *= this.vxc;
        this.vy *= this.vyc;
    }
    getScreenX = () => Math.floor(this.x - this.align * this.width * 0.5);
    getScreenY = () => Math.floor(this.y - this.valign * this.height * 0.5);
    get rect() { return this._rect.set(this.getScreenX(), this.getScreenY(), this.width, this.height) }
}
class Collision {
    constructor() {
        this._rect = new Rect();
        this.isVisible = false;
        return [new Pos(), this];
    }
    reset = () => this.set(0, 0);
    set = (width, height) => this._rect.set(0, 0, width, height);
    get rect() {
        const pos = this.owner.pos;
        return this._rect.set(Math.floor(pos.x - pos.align * this._rect.width * 0.5), Math.floor(pos.y - pos.valign * this._rect.height * 0.5), this._rect.width, this._rect.height);
    }
    hit = (obj) => this.rect.isIntersect(obj.collision.rect);
    draw(ctx) {
        if (!this.isVisible) return;
        ctx.fillStyle = '#ff000080';
        const r = this.rect;
        ctx.fillRect(r.x, r.y, r.width, r.height);
    }
}
class Child {
    static grave = [];
    static clean() {
        if (Child.grave.length === 0) return;
        for (const obj of Child.grave) obj.parent.child.objs.splice(obj.childIndex);
        Child.grave = [];
    }
    constructor() {
        this.creator = {};
        this.objs = [];
        this.reserves = {};
        this.liveCount = 0;
        this.drawlayer = '';
    }
    reset() { }
    addCreator = (name, func) => this.creator[name] = func;
    pool(name) {
        let obj;
        if (name in this.reserves === false) this.reserves[name] = [];
        if (this.reserves[name].length === 0) {
            obj = this.creator[name]();
            obj.childIndex = this.objs.length;
            obj.parent = this.owner;
            obj.remove = () => {
                if (!obj.isExist) return;
                obj.isExist = false;
                obj.resetMix();
                this.reserves[name].push(obj.childIndex);
                this.liveCount--;
            }
            this.objs.push(obj);
        } else {
            obj = this.objs[this.reserves[name].pop()];
        }
        obj.isExist = true;
        this.liveCount++;
        return obj;
    }
    add(obj) {
        obj.childIndex = this.objs.length;
        obj.parent = this.owner;
        obj.remove = () => {
            obj.isExist = false;
            Child.grave.push(obj);
        }
        this.objs.push(obj);
    }
    pop() {
        this.objs.pop().remove();
    }
    removeAll() {
        for (const obj of this.objs) obj.remove();
    }
    update() {
        for (const obj of this.objs) obj.baseUpdate();
    }
    draw(ctx) {
        let currentCtx = this.drawlayer !== '' ? game.layers.get(this.drawlayer).getContext() : ctx;
        for (const obj of this.objs) obj.baseDraw(currentCtx);
    }
    each(func) {
        for (const obj of this.objs) {
            if (!obj.isExist) continue;
            func(obj);
        }
    }
}
class Jumyo {
    constructor() {
        this.lifeSpan = this.lifeStage = 0;
    }
    reset() {
        this.lifeSpan = this.lifeStage = 0;
    }
    update() {
        if (this.lifeStage < this.lifeSpan) {
            this.lifeStage = Math.min(this.lifeStage + game.delta, this.lifeSpan);
            return;
        }
        this.owner.remove();
    }
    get percentage() { return this.lifeStage / this.lifeSpan };
}
class Color {
    constructor() {
        this.value = this.baseColor = '';
        this.func;
    }
    reset() {
        this.value = this.baseColor = '';
        this.func = undefined;
    }
    restore() {
        this.value = this.baseColor;
        this.func = undefined;
    }
    update = () => this.func?.();
    flash(color) {
        if (this.func) this.restore();
        this.baseColor = this.value;
        this.value = color;
        let timer = 0.02;
        this.func = () => {
            if (timer <= 0) {
                this.restore();
                return;
            }
            timer -= game.delta;
        }
    }
    blink(interval) {
        if (interval <= 0) {
            this.restore();
            return;
        }
        if (this.func) this.restore();
        this.baseColor = this.value;
        let timer = interval;
        this.func = () => {
            if (timer <= 0) {
                timer = interval;
                this.value = this.value === this.baseColor ? '#00000000' : this.baseColor;
                return;
            }
            timer -= game.delta;
        }
    }
}
class Moji {
    constructor() {
        this.text = '';
        this.weight = 'normal';
        this.size = TEXT_SIZE.NORMAL;
        this.font = FONT.DEFAULT.NAME;
        this.baseLine = 'top';
        return [new Pos(), new Color(), this];
    }
    reset() { }
    set(text, { x = this.owner.pos.x, y = this.owner.pos.y, size = this.size, color = this.owner.color.value, font = this.font, weight = this.weight, align = this.owner.pos.align, valign = this.owner.pos.valign } = {}) {
        this.text = text;
        this.weight = weight;
        this.size = size;
        this.font = font;
        this.owner.color.value = color;
        const ctx = game.layers.get('main').getContext();
        ctx.font = `${this.weight} ${this.size}px '${this.font}'`;
        ctx.textBaseline = this.baseLine;
        const tm = ctx.measureText(this.getText);
        const pos = this.owner.pos;
        pos.set(x, y, tm.width, Math.abs(tm.actualBoundingBoxAscent) + Math.abs(tm.actualBoundingBoxDescent));
        pos.align = align;
        pos.valign = valign;
    }
    get getText() { return typeof this.text === 'function' ? this.text() : this.text };
    draw(ctx) {
        ctx.font = `${this.weight} ${this.size}px '${this.font}'`;
        ctx.textBaseline = this.baseLine;
        ctx.fillStyle = this.owner.color.value;
        ctx.fillText(this.getText, this.owner.pos.getScreenX(), this.owner.pos.getScreenY());
    }
}
class label extends Mono {
    constructor(text, x, y, { size = TEXT_SIZE.NORMAL, color = THEME.TEXT, font = FONT.DEFAULT.NAME, weight = 'normal', align = 0, valign = 0 } = {}) {
        super(new Moji());
        this.moji.set(text, { x, y, size, color, font, weight, align, valign });
    }
}
class Brush {
    static rad = Math.PI * 2;
    constructor() {
        this.reset();
        return [new Pos(), this];
    }
    reset() {
        this.rect();
        this.color = 'white';
        this.alpha = 1;
    }
    rect = () => this.drawer = (ctx, pos) => ctx.fillRect(pos.getScreenX(), pos.getScreenY(), pos.width, pos.height);
    circle = () => this.drawer = (ctx, pos) => {
        ctx.beginPath();
        ctx.arc(pos.getScreenX(), pos.getScreenY(), pos.width * 0.5, 0, Brush.rad);
        ctx.fill();
    }
    draw(ctx) {
        const beforeAlpha = ctx.globalAlpha;
        ctx.fillStyle = this.color;
        ctx.globalAlpha = this.alpha;
        this.drawer(ctx, this.owner.pos);
        ctx.globalAlpha = beforeAlpha;
    }
}
class Tofu extends Mono {
    constructor() {
        super(new Brush());
    }
    set(x, y, width, height, color, alpha) {
        this.pos.set(x, y, width, height);
        this.brush.color = color;
        this.brush.alpha = alpha;
        return this;
    }
}
class Gauge extends Mono {
    constructor() {
        super(new Pos());
        this.color = THEME.TEXT;
        this.border = 2;
        this.max = 0;
        this.watch;
        this.pos.width = 100;
        this.pos.height = 10;
    }
    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.strokeStyle = this.color;
        ctx.lineWidth = this.border;
        const pos = this.pos;
        const x = pos.getScreenX();
        const y = pos.getScreenY();
        const b = this.border + 1;
        ctx.strokeRect(x, y, pos.width, pos.height);
        ctx.fillRect(x + b, y + b, (pos.width - b * 2) * (this.watch?.() / this.max), pos.height - (b * 2));
    }
}
class Tsubu extends Mono {
    constructor() {
        super(new Child());
        this.child.addCreator(Tsubu.name, () => {
            const t = new Mono(new Jumyo(), new Brush());
            t.update = () => t.brush.alpha = t.jumyo.percentage;
            return t;
        });
    }
    emittCircle(count, speed, lifeSpan, color, x, y, c) {
        const deg = 360 / count;
        for (let i = 0; i < count; i++) {
            const t = this.child.pool(Tsubu.name);
            t.brush.color = color;
            t.brush.alpha = 1;
            t.pos.set(x, y, 8, 8);
            t.pos.align = 1;
            t.pos.valign = 1;
            t.pos.vx = Util.degToX(deg * i) * speed;
            t.pos.vy = Util.degToY(deg * i) * speed;
            t.pos.vxc = c;
            t.pos.vyc = c;
            t.jumyo.lifeSpan = lifeSpan;
            t.jumyo.lifeStage = 0;
        }
    }
}
class Menu extends Mono {
    constructor(x, y, size, { icon = EMOJI.CAT, align = 1, color = THEME.TEXT, highlite = THEME.HIGHLITE } = {}) {
        super(new Pos(), new Child());
        this.pos.x = x;
        this.pos.y = y;
        this.pos.align = align;
        this.size = size;
        this.index = 0;
        this.color = color;
        this.highlite = highlite;
        this.isEnableCancel = true;
        this.child.add(this.curL = new label(Util.parseUnicode(icon), 0, 0, { size: this.size, color: this.highlite, font: FONT.EMOJI.NAME, align: 2, valign: 1 }));
        this.child.add(this.curR = new label(Util.parseUnicode(icon), 0, 0, { size: this.size, color: this.highlite, font: FONT.EMOJI.NAME, valign: 1 }));
        this.indexOffset = this.child.objs.length;
    }
    add(text) {
        this.child.add(new label(text, this.pos.x, this.pos.y + this.size * 1.5 * (this.child.objs.length - 2), { size: this.size, color: this.color, align: this.pos.align, valign: 1 }))
    }
    *stateSelect(newIndex = this.index) {
        const length = this.child.objs.length - this.indexOffset;
        function* move(key, direction) {
            if (!game.input.isDown(key)) return;
            this.moveIndex((this.index + direction) % length);
            yield* waitForTimeOrFrag(game.input.isPress(key) ? KEY_REPEAT_WAIT_FIRST : KEY_REPEAT_WAIT, () => game.input.isUp(key) || game.input.isPress('z') || (this.isEnableCancel && game.input.isPress('x')));
        }
        this.moveIndex(newIndex);
        while (true) {
            yield undefined;
            yield* move.bind(this)('up', length - 1);
            yield* move.bind(this)('down', 1);
            if (game.input.isPress('z')) return this.child.objs[this.index + this.indexOffset].moji.getText;
            if (this.isEnableCancel && game.input.isPress('x')) return;
        }
    }
    moveIndex(newIndex) {
        this.child.objs[this.index + this.indexOffset].color.value = this.color;
        this.index = newIndex;
        const item = this.child.objs[newIndex + this.indexOffset];
        item.color.value = this.highlite;
        const w = item.pos.width;
        const x = (w * 0.5) * this.pos.align;
        this.curL.pos.x = item.pos.x - x;
        this.curL.pos.y = item.pos.y;
        this.curR.pos.x = item.pos.x - x + w;
        this.curR.pos.y = item.pos.y;
    }
    current = () => this.index === -1 ? Menu.cancel : this.child.objs[this.index + this.indexOffset].moji.text;
    static get cancel() { return 'cancel' };
}
class BaddieData {
    constructor(name, char, color, size, hp, point, routine) {
        this.name = name;
        this.char = char;
        this.color = color;
        this.size = size;
        this.hp = hp;
        this.point = point;
        this.routine = routine;
    }
}
export const gameData = {
    baddies: {
        obake: new BaddieData('obake', EMOJI.GHOST, 'black', 40, 5, 200, 'zako1'),
        crow: new BaddieData('crow', EMOJI.CROW, '#0B1730', 40, 5, 100, 'zako1'),
        dove: new BaddieData('dove', EMOJI.DOVE, '#CBD8E1', 40, 5, 100, 'zako2'),
        greatcrow: new BaddieData('greatcrow', EMOJI.CROW, '#0E252F', 120, 100, 2000, 'boss1')
    }
};
// class SpawnData {
//     constructor(time, x, y, name) {
//         this.time = time;
//         this.x = x;
//         this.y = y;
//         this.name = name;
//     }
// }
// gameData.stages = [];
// const stage1 = [];
// gameData.stages.push(stage1);
// stage1.push(new SpawnData(2, 160, 50, 'obake'));
// stage1.push(new SpawnData(2, 100, 50, 'obake'));
// stage1.push(new SpawnData(3, 150, 50, 'obake'));
// stage1.push(new SpawnData(4, 200, 50, 'obake'));
class scoreData {
    constructor(from) {
        this.stage = from?.stage || 0;
        this.time = from?.time || 0;
        this.score = from?.score || 0;
        this.ko = from?.ko || 0;
    }
}
export const shared = {
    playData: {
        total: new scoreData(),
        before: new scoreData()
    }
}
class Watch extends Mono {
    constructor() {
        super(new Pos(), new Child());
        this.child.drawlayer = 'ui';
        this.child.addCreator('label', () => new label());
    }
    add(watch) {
        const l = this.child.pool('label');
        l.moji.set(watch, { x: 2, y: this.pos.y + ((this.child.objs.length - 1) * l.moji.size * 1.5), font: 'Impact' })
    }
}
class SceneTitle extends Mono {
    constructor() {
        super(new Child());
        //タイトル
        const titleSize = game.width / 11;
        const titleY = game.height * 0.25;
        this.child.add(new label(text.title, game.width * 0.5, titleY, { size: titleSize, color: THEME.HIGHLITE, align: 1, valign: 1 }));
        this.child.add(new label(text.title2, game.width * 0.5, titleY + titleSize * 1.5, { size: titleSize, align: 1, valign: 1 }));
        //ボタンを押して表示
        this.child.add(this.presskey = new label(text.presskey, game.width * 0.5, game.height * 0.5 + titleSize * 1.5, { size: titleSize, align: 1, valign: 1 }));
        this.presskey.color.blink(0.5);
        //メニュー
        this.child.add(this.titleMenu = new Menu(game.width * 0.5, game.height * 0.5, titleSize));
        this.titleMenu.isEnableCancel = true;
        this.titleMenu.add(text.start);
        this.titleMenu.add(text.highscore);
        this.titleMenu.add(text.credit);
        this.titleMenu.isExist = false;
        //操作方法
        // this.child.add(new label(text.explanation1, game.width * 0.5, game.height - (TEXT_SIZE.NORMAL * 2.5), { align: 1, valign: 1 }));
        // this.child.add(new label(text.explanation2, game.width * 0.5, game.height - TEXT_SIZE.NORMAL, { align: 1, valign: 1 }));        
        game.setState('root', this.stateDefault());
    }
    *stateDefault() {
        this.presskey.color.blink(0.5);
        while (true) {
            yield undefined;
            if (!game.input.isPress('z')) continue;
            this.presskey.isExist = false;
            yield* this.stateMenu();
            this.presskey.isExist = true;
            this.presskey.color.blink(0.5);
        }
    }
    *stateMenu() {
        this.titleMenu.isExist = true;
        while (true) {
            switch (yield* this.titleMenu.stateSelect()) {
                case text.start:
                    this.isExist = false;
                    yield* new ScenePlay().stateDefault();
                    this.isExist = true;
                    break;
                default:
                    this.titleMenu.isExist = false;
                    return;
            }
        }
    }
}
class ScenePlay extends Mono {
    constructor() {
        super(new State(), new Child());
        this.elaps = 0;
        //プレイヤー
        this.child.add(this.playerside = new Mono(new Child()));
        this.playerside.child.add(this.player = new Player());
        this.child.add(this.playerbullets = new BulletBox());
        this.player.reset(this.playerbullets, this);
        //敵キャラ
        this.child.add(this.baddies = new Baddies());
        this.child.add(this.baddiesbullets = new BulletBox());
        //パーティクル
        this.child.add(this.effect = new Tsubu());
        this.effect.child.drawlayer = 'effect';
        //UI
        this.child.add(this.ui = new Mono(new Child()));
        this.ui.child.drawlayer = 'ui';
        this.ui.child.add(this.textScore = new label(() => `SCORE ${shared.playData.total.score} KO ${shared.playData.total.ko}`, 2, 2));
        this.ui.child.add(this.fpsView = new label(() => `FPS: ${game.fps}`, game.width - 2, 2));
        this.fpsView.pos.align = 2;

        const gauge = this.bossHPgauge = new Gauge();
        gauge.pos.set(game.width * 0.5, 30, game.width * 0.9, 10);
        gauge.pos.align = 1;

        this.telopText = '';
        this.ui.child.add(this.telop = new label('', game.width * 0.5, game.height * 0.5, { size: TEXT_SIZE.MEDIUM, color: THEME.HIGHLITE, align: 1, valign: 1 }));
        this.telop.isExist = false;

        // this.child.add(this.debug = new Watch());
        // this.debug.pos.y = 40;
        // this.debug.add(() => `ENEMY: ${this.baddies.child.liveCount}`);
        // this.debug.add(() => `ENEMYBULLET: ${this.baddies.bullets.child.liveCount}`);

        // this.child.add(this.textScore = new Bun(() => `Baddie:${this.baddies.child.liveCount} Bullets:${this.baddiesbullets.child.liveCount}`, { font: 'Impact' }));
        // this.textScore.pos.x = 2;
        // this.textScore.pos.y = 48;

        // this.fiber.add(this.stageRunner(con.stages[0]));      
        this.startGame();
    }
    get isClear() { return !this.state.isEnable('stage'); }
    get isFailure() { return this.player.unit.isDefeat }
    *showTelop(text, time, blink = 0) {
        this.telop.moji.set(text);
        this.telop.color.blink(blink);
        this.telop.isExist = true;
        yield* waitForTime(time);
        this.telop.isExist = false;
    }
    postUpdate() {
        const _bulletHitcheck = (bullet, targets) => {
            if (game.isOutOfRange(bullet.collision.rect)) {
                bullet.remove();
                return;
            }
            targets.child.each((target) => {
                if (!bullet.collision.hit(target)) return;
                bullet.remove();
                target.color.flash('crimson');
                shared.playData.total.score += target.unit.point;
                if (!target.unit.isBanish(1)) return;
                this.effect.emittCircle(8, 300, 0.5, target.color.baseColor, target.pos.x, target.pos.y, 0.97)
                shared.playData.total.ko += target.unit.defeat();
            })
        }
        this.playerbullets.child.each((bullet) => _bulletHitcheck(bullet, this.baddies));
        this.baddiesbullets.child.each((bullet) => _bulletHitcheck(bullet, this.playerside));
        this.elaps += game.delta;
        shared.playData.total.time += game.delta;
    }
    *stateDefault() {
        game.pushScene(this);
        while (true) {
            yield undefined;
            if (this.isClear) {
                this.clearStage();
                continue;
            }
            if (this.isFailure) {
                switch (yield* new SceneGameOver().stateDefault()) {
                    case text.continue:
                        this.startGame();
                        break;
                    case text.returntitle:
                        game.popScene();
                        return;
                }
            }
            if (game.input.isPress('x')) {
                this.isActive = false;
                switch (yield* new ScenePause().stateDefault()) {
                    case text.restart:
                        this.startGame();
                        break;
                    case text.returntitle:
                        game.popScene();
                        return;
                }
                this.isActive = true;
            }
            this.player.maneuver();
        }
    }
    * stageDefault() {
        this.elaps = 0;
        let phaseLength = 5;
        let maxSpawn = 10;
        let spawnInterval = 1;
        const baddies = ['crow', 'dove'];
        // while (this.elaps <= phaseLength || this.baddies.child.liveCount > 0) {
        //     if (this.baddies.child.liveCount >= maxSpawn || this.elaps > phaseLength) {
        //         yield undefined;
        //         continue;
        //     }
        //     yield* waitForTime(spawnInterval);
        //     this.baddies.spawn(Util.random(30, game.width - 30), Util.random(30, game.height * 0.5), baddies[Util.random(0, 1)], this.baddiesbullets, this);
        // }
        // if (this.isFailure) return;
        yield* this.showTelop('WARNING!', 2, 0.25);
        const boss = this.baddies.spawn(game.width * 0.5, game.height * 0.2, 'greatcrow', this.baddiesbullets, this);
        this.bossHPgauge.isExist = true;
        this.bossHPgauge.max = boss.unit.maxHp;
        this.bossHPgauge.watch = () => boss.unit.hp;
        this.ui.child.add(this.bossHPgauge);
        yield* waitForFrag(() => boss.unit.isDefeat);
        this.bossHPgauge.remove();
        this.player.unit.invincible = true;
        yield* this.showTelop('ステージクリア！', 2);
    }
    startGame() {
        shared.playData.before = new scoreData();
        this.continueGame();
    }
    continueGame() {
        shared.playData.total = new scoreData(shared.playData.before);
        this.resetStage();
    }
    clearStage() {
        shared.playData.total.stage++;
        shared.playData.before = new scoreData(shared.playData.total);
        this.resetStage();
    }
    resetStage() {
        this.player.reset(this.playerbullets, this);
        this.playerbullets.child.removeAll();
        this.baddies.child.removeAll();
        this.baddiesbullets.child.removeAll();
        this.effect.child.removeAll();
        this.state.start('stage', this.stageDefault());
        game.layers.get('effect').clearBlur();
        this.telop.isExist = false;
    }
}
class Unit {
    constructor() {
        this.reset();
    }
    reset() {
        this.hp = this.maxHp = this.point = 0;
        this.invincible = this.firing = false;
    }
    setHp(hp) {
        this.hp = this.maxHp = hp;
    }
    isBanish(damage) {
        if (this.invincible) return false;
        this.hp -= damage;
        return this.hp <= 0;
    }
    defeat() {
        this.owner.remove();
        return 1;
    }
    get isDefeat() { return this.hp <= 0; }
    get hpRatio() { return this.hp / this.maxHp };
}
class Player extends Mono {
    constructor() {
        super(new State(), new Moji(), new Collision(), new Unit());
        this.unit.defeat = () => {
            this.isExist = false;
            return 0;
        }
    }
    reset(bullets, scene) {
        this.resetMix();
        this.state.start('main', this.stateDefault(this, bullets, scene));
        this.isExist = true;
        this.moji.set(Util.parseUnicode(EMOJI.CAT), { x: game.width * 0.5, y: game.height * 40, size: 40, color: 'black', font: FONT.EMOJI.NAME, align: 1, valign: 1 });
        this.collision.set(this.pos.width * 0.25, this.pos.height * 0.25);
        this.unit.setHp(1);
        this.unit.invincible = true;

    }
    maneuver() {
        this.pos.vx = this.pos.vy = 0;
        if (game.input.isDown('left')) this.pos.vx = -PLAYER_MOVE_SPEED;
        if (game.input.isDown('right')) this.pos.vx = PLAYER_MOVE_SPEED;
        if (game.input.isDown('up')) this.pos.vy = -PLAYER_MOVE_SPEED;
        if (game.input.isDown('down')) this.pos.vy = PLAYER_MOVE_SPEED;
        if (this.pos.vx !== 0 && this.pos.vy !== 0) {
            this.pos.vx *= Util.naname;
            this.pos.vy *= Util.naname;
        }
        if (game.input.isDown('z')) this.unit.firing = true;
    }
    *stateDefault(user, bullets, scene) {
        yield* waitForTime(0.5);
        this.unit.firing = false;
        while (true) {
            if (!this.unit.firing) {
                yield undefined;
                continue;
            }
            Shot.mulitWay(bullets, user.pos.x + 10, user.pos.y, { deg: 90, count: 1, speed: PLAYER_BULLET_SPEED, color: 'yellow' });
            Shot.mulitWay(bullets, user.pos.x - 10, user.pos.y, { deg: 90, count: 1, speed: PLAYER_BULLET_SPEED, color: 'yellow' });
            this.unit.firing = false;
            yield* waitForTime(0.125);
        }
    }
    postUpdate() {
        const halfX = this.pos.width * 0.5;
        const halfY = this.pos.height * 0.5;
        this.pos.x = Util.clamp(halfX, this.pos.x, game.width - halfX);
        this.pos.y = Util.clamp(halfY, this.pos.y, game.height - halfY);
    }
    draw(ctx) {
        const pos = this.pos;
        const x = this.pos.getScreenX();
        const y = pos.getScreenY();
        ctx.fillStyle = 'yellow';
        ctx.fillRect(x + 31, y + 5, 10, 8);
    }
}
class Baddies extends Mono {
    constructor() {
        super(new Child());
        this.routines = this.createRoutine();
        for (const data of Object.values(gameData.baddies)) this.child.addCreator(data.name, () => new Baddie());
    }
    spawn(x, y, name, bullets, scene) {
        const data = gameData.baddies[name];
        const baddie = this.child.pool(name);
        baddie.state.start('main', this.routines[data.routine](baddie, bullets, scene));
        baddie.moji.set(Util.parseUnicode(data.char), { x: x, y: y, size: data.size, color: data.color, font: FONT.EMOJI.NAME, align: 1, valign: 1 });
        baddie.collision.set(baddie.pos.width, baddie.pos.height);
        baddie.unit.setHp(data.hp);
        baddie.unit.point = data.point;
        return baddie;
    }
    createRoutine() {
        return {
            zako1: function* (user, bullets, scene) {
                while (true) {
                    yield undefined;
                    Shot.mulitWay(bullets, user.pos.x, user.pos.y);
                    yield* waitForTime(2);
                }
            },
            zako2: function* (user, bullets, scene) {
                while (true) {
                    yield undefined;
                    for (let i = 0; i < 3; i++) {
                        Shot.mulitWay(bullets, user.pos.x, user.pos.y, { count: 3, isAim: true, tx: scene.player.pos.x, ty: scene.player.pos.y, color: 'yellow' });
                        yield* waitForTime(0.2);
                    }
                    yield* waitForTime(2);
                }
            },
            boss1: function* (user, bullets, scene) {
                const circleShot = function* () {
                    const count = 36;
                    for (let i = 0; i < 6; i++) {
                        Shot.circle(bullets, user.pos.x, user.pos.y, { count: count, offset: ((360 / count) * 0.5) * (i % 2) });
                        yield* waitForTime(0.4);
                    }
                }
                const spiralShot = function* () {
                    const deg = 360 / 6;
                    let counter = 0;
                    for (let i = 0; i < 16; i++) {
                        for (let j = 0; j < 6; j++) {
                            Shot.mulitWay(bullets, user.pos.x, user.pos.y, { deg: (deg * j) + counter, count: 1, speed: 100, color: 'aqua' });
                        }
                        yield* waitForTime(0.15);
                        counter += 10;
                    }
                }
                yield* waitForTime(0.5);
                let currentPattern = 0;
                while (user.unit.hpRatio > 0.5) {
                    if (currentPattern === 0) {
                        user.state.start('shot1', circleShot());
                        yield* waitForFrag(() => !user.state.isEnable('shot1'));
                    } else {
                        user.state.start('shot2', spiralShot());
                        yield* waitForFrag(() => !user.state.isEnable('shot2'));
                    }
                    yield* waitForTime(2);
                    currentPattern = (currentPattern + 1) % 2;
                }
                while (true) {
                    user.state.start('shot2', spiralShot());
                    yield* waitForTime(0.8);
                    user.state.start('shot1', circleShot());
                    yield* waitForFrag(() => !user.state.isEnable('shot1') && !user.state.isEnable('shot2'));
                    yield* waitForTime(2);
                }
            }
        }
    }
}
class Baddie extends Mono {
    constructor() {
        super(new State(), new Moji(), new Collision(), new Unit());
    }
}
class Shot {
    static mulitWay(bullets, x, y, { deg = 270, space = 15, count = 5, speed = 150, color = 'red', isAim = false, tx = 0, ty = 0 } = {}) {
        let d = deg;
        if (isAim) d = Util.xyToDeg(tx - x, ty - y);
        const offset = space * (count - 1) / 2;
        for (let i = 0; i < count; i++) {
            bullets.firing(x, y, Util.degToX(((d - offset) + (space * i)) % 360) * speed, Util.degToY(((d - offset) + (space * i)) % 360) * speed, color);
        }
    }
    static circle(bullets, x, y, { count = 36, offset = 0, speed = 150, color = 'red', } = {}) {
        const d = 360 / count;
        for (let i = 0; i < count; i++) {
            bullets.firing(x, y, Util.degToX((d * i + offset) % 360) * speed, Util.degToY((d * i + offset) % 360) * speed, color);
        }
    }
}
class BulletBox extends Mono {
    constructor() {
        super(new Child());
        this.child.drawlayer = 'effect';
        this.child.addCreator('bullet', () => new Mono(new Collision(), new Brush()));
    }
    firing(x, y, vx, vy, color) {
        const bullet = this.child.pool('bullet');
        bullet.pos.set(x, y, 8, 8);
        bullet.pos.align = 1;
        bullet.pos.valign = 1;
        bullet.pos.vx = vx;
        bullet.pos.vy = vy;
        bullet.collision.set(6, 6);
        bullet.brush.circle();
        bullet.brush.color = color;
        return bullet;
    }
}
class ScenePause extends Mono {
    constructor() {
        super(new Child());
        this.child.drawlayer = 'ui';
        this.child.add(new Tofu().set(0, 0, game.width, game.height, 'black', 0.5));
        const titleSize = game.width / 11;
        this.child.add(new label(text.pause, game.width * 0.5, game.height * 0.25, { size: titleSize, color: THEME.HIGHLITE, align: 1, valign: 1 }));
        this.child.add(this.menu = new Menu(game.width * 0.5, game.height * 0.5, titleSize));
        this.menu.add(text.resume);
        this.menu.add(text.restart);
        this.menu.add(text.returntitle);
    }
    *stateDefault() {
        game.pushScene(this);
        game.layers.get('effect').isPauseBlur = true;
        const result = yield* this.menu.stateSelect();
        game.layers.get('effect').isPauseBlur = false;
        game.popScene();
        return result;
    }
}
class SceneGameOver extends Mono {
    constructor() {
        super(new Child());
        this.child.drawlayer = 'ui';
        const titleSize = game.width / 11;
        this.child.add(new label(text.gameover, game.width * 0.5, game.height * 0.25, { size: titleSize, color: THEME.HIGHLITE, align: 1, valign: 1 }));
        this.child.add(this.menu = new Menu(game.width * 0.5, game.height * 0.5, titleSize));
        this.menu.isEnableCancel = false;
        this.menu.add(text.continue);
        this.menu.add(text.returntitle);
    }
    *stateDefault() {
        game.pushScene(this);
        const result = yield* this.menu.stateSelect();
        game.popScene();
        return result;
    }
}
export const game = new Game();
game.preLoad(FONT.DEFAULT, FONT.EMOJI);
game.start(() => {
    game.input.keybind('z', 'z', { button: 1 });
    game.input.keybind('x', 'x', { button: 0 });

    const ctx = game.layers.get('bg').getContext();
    const grad = ctx.createLinearGradient(0, 0, 0, game.height);
    grad.addColorStop(0, "#2B4C99");
    grad.addColorStop(1, "#AFC8E4");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, game.width, game.height);

    game.layers.add(LAYER_NAMES);
    game.layers.get('effect').enableBlur();
    game.pushScene(new SceneTitle());
});