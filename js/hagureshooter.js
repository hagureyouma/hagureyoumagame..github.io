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
    //プロパティをコンストラクタで定義するのとインスタンスに後から追加するのは、なにか違いがあるの？
}
'use strict';
console.clear();
class Game {//ゲーム本体
    constructor(width = 360, height = 480) {
        document.body.style.backgroundColor = 'black';
        this.screenRect = new Rect().set(0, 0, width, height);
        this.layers = new Layers(width, height);
        this.root = new Mono(new State(), new Child());
        this.input = new Input();
        this.time = this.delta = 0;
        this.fpsBuffer = Array.from({ length: 60 });
    }
    get width() { return this.screenRect.width };
    get height() { return this.screenRect.height };
    start(assets, create) {
        (async () => {
            const pageLoadPromise = new Promise(resolve => addEventListener('load', resolve));
            await new Promise(resolve => {
                const wf = document.createElement('script');
                wf.src = 'https://ajax.googleapis.com/ajax/libs/webfont/1.6.26/webfont.js';
                wf.onload = resolve;
                document.head.appendChild(wf);
            })
            const fonts = [];
            for (const asset of [...assets]) {
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
                const customs = fonts.filter((f) => f.custom);
                WebFont.load({
                    google: { families: fonts.filter((f) => !f.custom).map((f) => f.name) }, custom: { families: customs.map((f) => f.name), urls: customs.map((f) => f.url) }, active: resolve
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
        this.delta = Math.min((now - this.time) / 1000.0, 1 / 60);
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
    setState = (state) => this.root.state.start(state);
    isOutOfRange = (rect) => !this.screenRect.isIntersect(rect);
    get fps() { return Math.floor(1 / Util.average(this.fpsBuffer)); }
    get sec() { return this.time / 1000; }
}
class Layers {//レイヤー管理
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
class Layer {//レイヤー
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
        ctx.globalAlpha = 0.7;
        ctx.drawImage(this.canvas, 0, 0);
    }
}
class Input {//ボタン入力
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
class Util {//便利メソッド詰め合わせ
    static naname = 0.71;
    static radian = Math.PI / 180;
    static degree = 180 / Math.PI;
    static uniqueId = () => Date.now().toString(16) + Math.floor(1000 * Math.random()).toString(16);
    static parseUnicode = (code) => String.fromCharCode(parseInt(code, 16));
    static isEven = (n) => n % 2 === 0;
    static clamp = (value, min, max) => Math.min(Math.max(value, min), max);
    static degToX = (deg) => Math.cos(deg * Util.radian);
    static degToY = (deg) => -Math.sin(deg * Util.radian);
    static xyToDeg(x, y) {
        var r = Math.atan2(-y, x);
        if (r < 0) r += 2 * Math.PI;
        return r * Util.degree;
    }
    static xRotaRad = (x, y, rad) => Math.cos(rad) * x - Math.sin(rad) * y;
    static yRotaRad = (x, y, rad) => Math.sin(rad) * x + Math.cos(rad) * y;
    static spdToDeg = (speed, radius) => (speed * 180) / (Math.PI * radius);
    static distanse = (x, y) => Math.sqrt(x * x + y * y);
    static normalize = (v, distance) => v / distance;
    static dot = (x, y, x2, y2) => x * x2 + y * y2;
    static cross = (x, y, x2, y2) => x * y2 - y * x2;
    static lerp = (start, end, t) => (1 - t) * start + t * end;
    static random = (max, min = 0) => Math.floor(Math.random() * (max + 1 - min) + min);
    static average = (arr) => arr.reduce((prev, current, i, arr) => prev + current) / arr.length;
    static serialArray = (length) => [...Array(length).keys()];
    static shiffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }
    static shiffledArray = (length) => Util.shiffle(Util.serialArray(length));
    static randomTake = (arr, num) => Util.shiffle([...arr]).slice(0, num);
    static randomArray = (range, length) => Util.shiffledArray(range).slice(0, length);
    static isGenerator = (obj) => obj && typeof obj.next === 'function' && typeof obj.throw === 'function';

    static isImageFile = (file) => /\.(jpg|jpeg|png|gif)$/i.test(file)
}
class Rect {//矩形
    constructor() {
        this.set(0, 0, 0, 0);
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
class Mono {//ゲームオブジェクト
    constructor(...args) {
        this.isExist = this.isActive = true;
        this.isRemoved = false;
        this.mixs = [];
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
class State {//ジェネレータコンポーネント
    constructor() {
        this.generators = new Map();
    }
    reset = () => this.generators.clear();
    isEnable = (id) => this.generators.get(id) !== undefined;
    start(state, id) {
        const newid = this.generators.get(id) ? id : Util.uniqueId();
        this.generators.set(newid, state);
        return newid;
    }
    startAndWait = (state, id) => this.wait(this.start(state, id));
    stop = (id) => this.generators.delete(id);
    update() {
        for (const [id, generator] of this.generators.entries()) {
            let result;
            while (generator) {
                result = generator?.next(result);
                if (result.done) this.stop(id);
                if (result.value === undefined) break;
            }
        }
    }
    wait = (...ids) => waitForFrag(() => {
        let result = true;
        for (const id of ids) {
            result &= !this.isEnable(id);
        }
        return result;
    });
}
function* waitForTime(time) {//タイマー
    time -= game.delta;
    while (time > 0) {
        time -= game.delta;
        yield undefined;
    }
    return true;
}
function* waitForFrag(func) {//trueが返ってくるまで待機
    while (!func()) yield undefined;
    return true;
}
function* waitForTimeOrFrag(time, func) {//中断付きタイマー
    time -= game.delta;
    while (time > 0 && !func()) {
        time -= game.delta;
        yield undefined;
    }
    return true;
}
class Pos {//座標コンポーネント
    constructor() {
        this._rect = new Rect();
        this.reset();
    }
    reset() {
        this.set(0, 0, 0, 0);
        this.align = this.valign = 0;//align&valign left top=0,center midle=1,right bottom=2
        this._rect.set(0, 0, 0, 0);
        this.parent = undefined;//座標リンクつける？
    }
    set(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        return this;
    }
    getScreenX = () => Math.floor(this.x - this.align * this.width * 0.5);
    getScreenY = () => Math.floor(this.y - this.valign * this.height * 0.5);
    get right() { return this.getScreenX() + this.width; }
    get bottom() { return this.getScreenY() + this.height; }
    get rect() { return this._rect.set(this.getScreenX(), this.getScreenY(), this.width, this.height) }
}
class Move {//動作コンポーネント
    constructor() {
        this.reset();
        return [new Pos(), this];
    }
    reset() {
        this.set(0, 0);
        this.setEase(0, 0, 0);
        this.setRevo(0, 0, 0);
    }
    set(vx, vy, vc = 1) {
        this.vx = vx;
        this.vy = vy;
        this.vc = vc;
    }
    setEase(x, y, time, { speed = 360, ease = (t) => -Util.degToX(t) } = {}) {
        this.ex = x;
        this.ey = y;
        this.time = time;
        this.timeOfs = game.sec;
        this.beforeEase = 0;
        this.speed = speed;
        this.ease = ease
    }
    setRevo(x, y, speedDeg) {
        this.originX = x;
        this.originY = y;
        this.revo = speedDeg;
    }
    update() {
        const pos = this.owner.pos;
        if (this.time !== 0) {
            const t = game.sec - this.timeOfs;
            const e = this.ease(t * this.speed);
            const ce = e - this.beforeEase;
            this.beforeEase = e;
            pos.x += this.ex * ce;
            pos.y += this.ey * ce;
            if (this.time > 0 && t >= this.time) this.time = 0;
        }
        if (this.revo !== 0) {
            const r = (this.revo * game.delta) * Util.radian;
            const rx = pos.x - this.originX;
            const ry = pos.y - this.originY;
            pos.x = this.originX + Util.xRotaRad(rx, ry, r);
            pos.y = this.originY + Util.yRotaRad(rx, ry, r);
        }
        pos.x += this.vx * game.delta;
        pos.y += this.vy * game.delta;
        this.vx *= this.vc;
        this.vy *= this.vc;
    }
}
class Guided {//ホーミングコンポーネント
    constructor() {
        this.reset();
        return [this, new Pos()];
    }
    reset() {
        this.target = undefined;
        this.aimSpeed = 0
    }
    update() {
        if (!this.target) return;
        const pos = this.owner.pos;
        const move = this.owner.move;
        const rad = (Util.cross(this.target.pos.x - pos.x, this.target.pos.y - pos.y, move.vx, move.vy) > 0 ? -this.aimSpeed : this.aimSpeed) * Util.radian;
        const vx = Util.xRotaRad(move.vx, move.vy, rad);
        const vy = Util.yRotaRad(move.vx, move.vy, rad);
        move.vx = vx;
        move.vy = vy;
    }
}
class Collision {//当たり判定コンポーネント
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
class Child {//コンテナコンポーネント
    static grave = new Set();
    static clean() {
        if (Child.grave.size === 0) return;
        for (const child of Child.grave) {
            child.objs = child.objs.filter((obj) => !obj.isRemoved);
        }
        Child.grave.clear();
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
        obj.remove = () => {
            if (!obj.isExist) return;
            obj.isExist = false;
            obj.isRemoved = true;
            Child.grave.add(this);
        }
        this.objs.push(obj);
    }
    pop() {
        this.objs.pop()
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
class Jumyo {//オブジェクトの寿命コンポーネント
    constructor() {
        this.reset();
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
class Color {//色コンポーネント
    constructor() {
        this.reset();
    }
    reset() {
        this.value = this.baseColor = cfg.theme.text;
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
class Moji {//文字表示コンポーネント
    constructor() {
        this.reset();
        return [new Pos(), new Color(), this];
    }
    reset() {
        this.text = '';
        this.weight = 'normal';
        this.size = cfg.fontSize.normal;
        this.font = cfg.font.default;
        this.baseLine = 'top';
    }
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
class Label extends Mono {//文字表示
    constructor(text, x, y, { size = cfg.fontSize.normal, color = cfg.theme.text, font = cfg.font.default.name, weight = 'normal', align = 0, valign = 0 } = {}) {
        super(new Moji());
        this.moji.set(text, { x, y, size, color, font, weight, align, valign });
    }
}
class Brush {//図形描画コンポーネント
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
class Tofu extends Mono {//図形描画
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
class Gauge extends Mono {//ゲージ
    constructor() {
        super(new Pos());
        this.color = '';
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
class Tsubu extends Mono {//パーティクル
    constructor() {
        super(new Child());
        this.child.addCreator(Tsubu.name, () => {
            const t = new Mono(new Jumyo(), new Move(), new Brush());
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
            t.move.set(Util.degToX(deg * i) * speed, Util.degToY(deg * i) * speed, c);
            t.jumyo.lifeSpan = lifeSpan;
            t.jumyo.lifeStage = 0;
        }
    }
}
class Menu extends Mono {//メニュー
    constructor(x, y, size, { icon = EMOJI.CAT, align = 1, color = cfg.theme.text, highlite = cfg.theme.highlite } = {}) {
        super(new Pos(), new Child());
        this.pos.x = x;
        this.pos.y = y;
        this.pos.align = align;
        this.size = size;
        this.index = 0;
        this.color = color;
        this.highlite = highlite;
        this.isEnableCancel = true;
        this.child.add(this.curL = new Label(Util.parseUnicode(icon), 0, 0, { size: this.size, color: this.highlite, font: cfg.font.emoji.name, align: 2, valign: 1 }));
        this.child.add(this.curR = new Label(Util.parseUnicode(icon), 0, 0, { size: this.size, color: this.highlite, font: cfg.font.emoji.name, valign: 1 }));
        this.indexOffset = this.child.objs.length;
    }
    add(text) {
        this.child.add(new Label(text, this.pos.x, this.pos.y + this.size * 1.5 * (this.child.objs.length - 2), { size: this.size, color: this.color, align: this.pos.align, valign: 1 }))
    }
    *stateSelect(newIndex = this.index) {
        const length = this.child.objs.length - this.indexOffset;
        function* move(key, direction) {
            if (!game.input.isDown(key)) return;
            this.moveIndex((this.index + direction) % length);
            yield* waitForTimeOrFrag(game.input.isPress(key) ? cfg.input.repeatWaitFirst : cfg.input.repeatWaitFirst, () => game.input.isUp(key) || game.input.isPress('z') || (this.isEnableCancel && game.input.isPress('x')));
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
export const cfg = {//ゲームの設定
    layer: ['effect', 'ui'],
    font: {
        default: { name: 'Kaisei Decol', url: 'https://fonts.googleapis.com/css2?family=kaisei+decol&display=swap', custom: false },
        emoji: { name: 'FontAwesome', url: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.6.0/css/all.min.css', custom: true }
    },
    fontSize: {
        normal: 20,
        medium: 30,
        large: 35,
        big: 40,
    },
    theme: {
        text: '#ffffff',
        highlite: 'yellow'
    },
    input: {
        repeatWaitFirst: 0.25,
        repeatWait: 0.125,
    }
}
let text = {//ゲームのテキスト
    title: 'シューティングゲーム', title2: 'のようなもの', presskey: 'Zキーを押してね',
    explanation1: '操作方法：↑↓←→ 選択、移動',
    explanation2: 'Z 決定、攻撃　X 取消、中断',
    start: 'スタート', highscore: 'ハイスコア', credit: 'クレジット',
    pause: 'ポーズ', resume: 'ゲームを続ける', restart: '最初からやり直す', returntitle: 'タイトルに戻る',
    stageclear: 'ステージ　クリアー', total: '合計', stage: 'ステージ', time: 'タイム', point: 'スコア', ko: '撃破数',
    gameover: 'ゲームオーバー', continue: 'コンティニュー'
}
const EMOJI = {//Font Awesomeの絵文字のUnicode
    GHOST: 'f6e2',
    CAT: 'f6be',
    CROW: 'f520',
    HOUSE: 'e00d',
    TREE: 'f1bb',
    DOVE: 'f4ba',
    POO: 'f2fe',
    CROWN: 'f521'
}
Object.freeze(EMOJI);
class BaddieData {//敵キャラデータ
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
export const datas = {//ゲームデータ
    baddies: {
        obake: new BaddieData('obake', EMOJI.GHOST, 'black', 40, 5, 200, 'zako1'),
        crow: new BaddieData('crow', EMOJI.CROW, '#0B1730', 40, 5, 100, 'zako1'),
        dove: new BaddieData('dove', EMOJI.DOVE, '#CBD8E1', 40, 5, 100, 'zako2'),
        gibcrow: new BaddieData('dove', EMOJI.DOVE, '#CBD8E1', 80, 10, 100, 'zako2'),
        greatcrow: new BaddieData('greatcrow', EMOJI.CROW, '#0E252F', 120, 100, 2000, 'boss1')
    },
    player: {
        moveSpeed: 300,
        bulletSpeed: 400,
        firelate: 1 / 20,
    },
    game: {
        highscoreListMax: 10
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
class scoreData {//成績データ
    constructor(from) {
        this.stage = from?.stage || 0;
        this.time = from?.time || 0;
        this.point = from?.point || 0;
        this.ko = from?.ko || 0;
    }
}
export const shared = {//共用変数
    playdata: {
        total: new scoreData(),
        backup: new scoreData()
    },
    highscores: []
}
class Watch extends Mono {//デバッグ用変数表示
    constructor() {
        super(new Pos(), new Child());
        this.child.drawlayer = 'ui';
        this.child.addCreator('label', () => new Label());
    }
    add(watch) {
        const l = this.child.pool('label');
        l.moji.set(watch, { x: 2, y: this.pos.y + ((this.child.liveCount - 1) * l.moji.size * 1.5) });
    }
}
class SceneTitle extends Mono {//タイトル画面
    constructor() {
        super(new Child());
        //タイトル
        const titleY = game.height * 0.25;
        this.child.add(new Label(text.title, game.width * 0.5, titleY, { size: cfg.fontSize.large, color: cfg.theme.highlite, align: 1, valign: 1 }));
        this.child.add(new Label(text.title2, game.width * 0.5, titleY + cfg.fontSize.large * 1.5, { size: cfg.fontSize.large, align: 1, valign: 1 }));
        //ボタンを押して表示
        this.child.add(this.presskey = new Label(text.presskey, game.width * 0.5, game.height * 0.5 + cfg.fontSize.medium * 1.5, { size: cfg.fontSize.medium, align: 1, valign: 1 }));
        this.presskey.color.blink(0.5);
        //メニュー
        this.child.add(this.titleMenu = new Menu(game.width * 0.5, game.height * 0.5, cfg.fontSize.medium));
        this.titleMenu.isEnableCancel = true;
        this.titleMenu.add(text.start);
        this.titleMenu.add(text.highscore);
        this.titleMenu.add(text.credit);
        this.titleMenu.isExist = false;
        //操作方法
        // this.child.add(new label(text.explanation1, game.width * 0.5, game.height - (TEXT_SIZE.NORMAL * 2.5), { align: 1, valign: 1 }));
        // this.child.add(new label(text.explanation2, game.width * 0.5, game.height - TEXT_SIZE.NORMAL, { align: 1, valign: 1 }));        
        game.setState(this.stateDefault());
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
                case text.highscore:
                    this.isExist = false;
                    yield* new SceneHighscore().stateDefault();
                    this.isExist = true;
                    break;
                default:
                    this.titleMenu.isExist = false;
                    return;
            }
        }
    }
}
class ScenePlay extends Mono {//プレイ画面
    constructor() {
        super(new State(), new Child());
        this.elaps = 0;
        //プレイヤー
        this.child.add(this.playerside = new Mono(new Child()));
        this.child.add(this.playerbullets = new BulletBox());
        //敵キャラ
        this.child.add(this.baddies = new Baddies());
        this.child.add(this.baddiesbullets = new BulletBox());
        //パーティクル
        this.child.add(this.effect = new Tsubu());
        this.effect.child.drawlayer = 'effect';
        //UI
        this.child.add(this.ui = new Mono(new Child()));
        this.ui.child.drawlayer = 'ui';
        this.ui.child.add(this.textScore = new Label(() => `SCORE ${shared.playdata.total.point} KO ${shared.playdata.total.ko}`, 2, 2));
        this.ui.child.add(this.fpsView = new Label(() => `FPS: ${game.fps}`, game.width - 2, 2));
        this.fpsView.pos.align = 2;
        //ボスのHPゲージ
        const gauge = this.bossHPgauge = new Gauge();
        gauge.pos.set(game.width * 0.5, 30, game.width * 0.9, 10);
        gauge.pos.align = 1;
        gauge.color = cfg.theme.text;
        //テロップ
        this.ui.child.add(this.telop = new Label('', game.width * 0.5, game.height * 0.5, { size: cfg.fontSize.medium, color: cfg.theme.highlite, align: 1, valign: 1 }));
        this.telop.isExist = false;

        this.child.add(this.debug = new Watch());
        this.debug.pos.y = 40;
        // this.child.add(this.textScore = new Bun(() => `Baddie:${this.baddies.child.liveCount} Bullets:${this.baddiesbullets.child.liveCount}`, { font: 'Impact' }));
        // this.textScore.pos.x = 2;
        // this.textScore.pos.y = 48;
        this.stateStageId;
        // this.fiber.add(this.stageRunner(con.stages[0]));      
        this.newGame();
    }
    get isClear() { return !this.state.isEnable(this.stateStageId); }
    get isFailure() { return this.player.unit.isDefeat }
    *showTelop(text, time, blink = 0) {
        this.telop.moji.set(text);
        this.telop.color.blink(blink);
        this.telop.isExist = true;
        yield* waitForTime(time);
        this.telop.isExist = false;
    }
    update() {
        this.player.maneuver();
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
                shared.playdata.total.point += 100;
                if (!target.unit.isBanish(1)) return;
                shared.playdata.total.point += target.unit.point;
                this.effect.emittCircle(8, 300, 0.5, target.color.baseColor, target.pos.x, target.pos.y, 0.97)
                shared.playdata.total.ko += target.unit.defeat();
            })
        }
        this.baddies.child.each((baddie) => {
            if (!baddie.unit.isEntry) {
                if (!game.isOutOfRange(baddie.collision.rect)) baddie.unit.isEntry = true;
            } else {
                if (game.isOutOfRange(baddie.collision.rect)) baddie.unit.defeat();
            }
        });
        this.playerbullets.child.each((bullet) => _bulletHitcheck(bullet, this.baddies));
        this.baddiesbullets.child.each((bullet) => _bulletHitcheck(bullet, this.playerside));
        this.elaps += game.delta;
        shared.playdata.total.time += game.delta;
    }
    * stateDefault() {
        game.pushScene(this);
        while (true) {
            yield undefined;
            if (this.isClear) {
                yield* this.showTelop(text.stageclear, 2);
                shared.playdata.total.stage++;
                yield* new SceneClear().stateDefault();
                shared.playdata.backup = new scoreData(shared.playdata.total);
                this.resetStage();
                continue;
            }
            if (this.isFailure) {
                yield* this.showTelop(text.gameover, 2);
                if (this.isNewRecord()) yield* new SceneHighscore(shared.playdata.total).stateDefault();
                switch (yield* new SceneGameOver().stateDefault()) {
                    case text.continue:
                        this.newGame();
                        break;
                    case text.returntitle:
                        game.popScene();
                        return;
                }
                continue;
            }
            if (game.input.isPress('x')) {
                this.isActive = false;
                switch (yield* new ScenePause().stateDefault()) {
                    case text.restart:
                        this.continueGame();
                        break;
                    case text.returntitle:
                        game.popScene();
                        return;
                }
                this.isActive = true;
                continue;
            }
        }
    }
    * stageDefault() {
        this.elaps = 0;
        let phaseLength = 999;
        let maxSpawn = 10;
        let spawnInterval = 1;
        const baddies = ['crow', 'dove'];
        // while (this.elaps <= phaseLength || this.baddies.child.liveCount > 0) {
        //     if (this.baddies.child.liveCount >= maxSpawn || this.elaps > phaseLength) {
        //         yield undefined;
        //         continue;
        //     }            
        //     //this.baddies.spawn(Util.random(30, game.width - 30), Util.random(30, game.height * 0.5), baddies[Util.random(0, 1)], this.baddiesbullets, this);
        // }

        while (true) {
            yield* this.baddies.formation.top.bind(this.baddies)(game.width * 0.5, 'random', 5, 'dove', undefined, this.baddiesbullets, this);

            this.state.start(this.baddies.formation.side.bind(this.baddies)(false, 4, 'dove', undefined, this.baddiesbullets, this));
            this.state.start(this.baddies.formation.side.bind(this.baddies)(true, 4, 'dove', undefined, this.baddiesbullets, this, 1));
        }
        if (this.isFailure) return;
        yield* this.showTelop('WARNING!', 2, 0.25);
        const boss = this.baddies.spawn(game.width * 0.5, game.height * 0.25, 'greatcrow', this.baddiesbullets, this);
        //boss.move.setEase(0, 10, 1, { vias: 2 });
        //boss.move.setRevo(200, 200, 200);

        this.bossHPgauge.isExist = true;
        this.bossHPgauge.max = boss.unit.maxHp;
        this.bossHPgauge.watch = () => boss.unit.hp;
        this.ui.child.add(this.bossHPgauge);

        this.debug.child.removeAll();
        this.debug.add(() => `タイム: ${boss.move.time}`);
        this.debug.add(() => `X座標: ${boss.pos.x}`);
        this.debug.add(() => `Y座標: ${boss.pos.y}`);
        this.debug.add(() => `: ${-Math.sin(this.elaps * Math.PI)}`);

        yield* waitForFrag(() => boss.unit.isDefeat);
        this.bossHPgauge.remove();
    }
    newGame() {
        shared.playdata.backup = new scoreData();
        shared.playdata.total = new scoreData();
        this.resetStage();
    }
    continueGame() {
        shared.playdata.total = new scoreData(shared.playdata.backup);
        this.resetStage();
    }
    resetStage() {
        this.player?.remove();
        this.playerside.child.add(this.player = new Player(this.playerbullets, this));
        this.player.unit.invincible = true;//無敵
        this.playerbullets.child.removeAll();
        this.baddies.child.removeAll();
        this.baddiesbullets.child.removeAll();
        this.effect.child.removeAll();
        this.state.reset();
        this.stateStageId = this.state.start(this.stageDefault(), this.stateStageId);
        game.layers.get('effect').clearBlur();
        this.telop.isExist = false;
        this.bossHPgauge.remove?.();
    }
    isNewRecord() {
        shared.highscores.push(shared.playdata.total);
        shared.highscores.sort((a, b) => b.point - a.point);
        if (shared.highscores.length < datas.game.highscoreListMax) return true;
        return shared.playdata.total != shared.highscores.pop();
    }
}
class Unit {//キャラのステータス
    constructor() {
        this.reset();
    }
    reset() {
        this.hp = this.maxHp = this.point = this.kocount = 1;
        this.isEntry = this.invincible = this.firing = false;
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
        return this.kocount;
    }
    get isDefeat() { return this.hp <= 0; }
    get hpRatio() { return this.hp / this.maxHp };
}
class Player extends Mono {//プレイヤーキャラ
    constructor(bullets, scene) {
        super(new State(), new Move(), new Moji(), new Collision(), new Unit());
        this.state.start(this.stateDefault.bind(this)(bullets, scene));
        this.moji.set(Util.parseUnicode(EMOJI.CAT), { x: game.width * 0.5, y: game.height * 40, size: 40, color: 'black', font: cfg.font.emoji.name, align: 1, valign: 1 });
        this.collision.set(this.pos.width * 0.25, this.pos.height * 0.25);
        this.unit.setHp(1);
        this.unit.kocount = 0;
    }
    maneuver() {
        if (!this.isExist) return;
        this.move.vx = this.move.vy = 0;
        if (game.input.isDown('left')) this.move.vx = -datas.player.moveSpeed;
        if (game.input.isDown('right')) this.move.vx = datas.player.moveSpeed;
        if (game.input.isDown('up')) this.move.vy = -datas.player.moveSpeed;
        if (game.input.isDown('down')) this.move.vy = datas.player.moveSpeed;
        if (this.move.vx !== 0 && this.move.vy !== 0) {
            this.move.vx *= Util.naname;
            this.move.vy *= Util.naname;
        }
        if (game.input.isDown('z')) this.unit.firing = true;
    }
    *stateDefault(bullets, scene) {
        yield* waitForTime(0.5);
        this.unit.firing = false;
        const shotOption = { deg: 90, count: 1, speed: datas.player.bulletSpeed, color: 'yellow' };
        while (true) {
            if (!this.unit.firing) {
                yield undefined;
                continue;
            }
            bullets.mulitWay(this.pos.x + 10, this.pos.y, shotOption);
            bullets.mulitWay(this.pos.x - 10, this.pos.y, shotOption);
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
class Baddies extends Mono {//敵キャラ
    constructor() {
        super(new Child());
        const creator = () => new Mono(new State(), new Move(), new Moji(), new Collision(), new Unit());
        for (const data of Object.values(datas.baddies)) this.child.addCreator(data.name, creator);
    }
    spawn(x, y, name, bullets, scene) {
        const data = datas.baddies[name];
        const baddie = this.child.pool(name);
        baddie.state.start(this.routines[data.routine](baddie, bullets, scene));
        baddie.moji.set(Util.parseUnicode(data.char), { x: x, y: y, size: data.size, color: data.color, font: cfg.font.emoji.name, name, align: 1, valign: 1 });
        baddie.collision.set(baddie.pos.width, baddie.pos.height);
        baddie.unit.setHp(data.hp);
        baddie.unit.point = data.point;
        return baddie;
    }
    formation = {
        top: function* (x, type, n, name, pattern, bullets, scene, delay = 0) {
            if (delay > 0) yield* waitForTime(delay);
            const startX = -(game.width * 0.2);
            const startY = -(game.height * 0.2);
            const space = 40;
            switch (type) {
                case 'v':
                    for (let i = 0; i < n; i++) {
                        if (i !== 0) this.spawn(x - (space * i), startY, name, bullets, scene);
                        this.spawn(x + (space * i), startY, name, bullets, scene);
                        yield* waitForTime(0.5);
                    }
                    break;
                case 'delta':
                    for (let i = n - 1; i >= 0; i--) {
                        if (i !== n) this.spawn(x - (space * i), startY, name, bullets, scene);
                        this.spawn(x + (space * i), startY, name, bullets, scene);
                        yield* waitForTime(0.5);
                    }
                    break;
                case 'trail':
                    for (let i = 0; i < n; i++) {
                        this.spawn(x, startY, name, bullets, scene);
                        yield* waitForTime(0.5);
                    }
                    break;
                case 'abrest':
                    for (let i = 0; i < n; i++) {
                        this.spawn(x + (space * i), startY, name, bullets, scene);
                    }
                    break;
                case 'random':
                    const loopMax = Util.random(n, 1);
                    for (let i = 0; i < loopMax; i++) {
                        const colMax = Math.floor((game.width / space) - 1);
                        const cols = Util.randomArray(colMax, Util.random(Math.min(n, colMax), 1));
                        for (const col of cols) {
                            this.spawn(space * (col + 1), startY, name, bullets, scene);
                            const wait = Util.random(n);
                            if (wait) yield* waitForTime(wait * 0.1);
                        }
                        yield* waitForTime(0.5 * Util.random(n, 1));
                    }
                    break;
            }
        },
        side: function* (isRight, n, name, pattern, bullets, scene, delay = 0) {

            if (delay > 0) yield* waitForTime(delay);
            let x = -(game.width * 0.2);
            if (isRight) x = -x + game.width;
            const space = 40;
            for (let i = 0; i < n; i++) {
                const baddie = this.spawn(x, game.height * 0.2 + space * i, name, bullets, scene);
                baddie.move.setEase(0, 10, -1);
                yield* waitForTime(0.25);
            }
        }
    }
    routines = {
        zako1: function* (user, bullets, scene) {
            user.move.setEase(60, 0, -1);
            user.move.set(0, 100);
            while (true) {
                yield undefined;
                bullets.mulitWay(user.pos.x, user.pos.y);
                yield* waitForTime(2);
            }
        },
        zako2: function* (user, bullets, scene) {
            const shot1 = function* () {
                while (true) {
                    yield undefined;
                    bullets.mulitWay(user.pos.x, user.pos.y);
                    yield* waitForTime(2);
                }
            }
            if (user.pos.bottom < 0) {
                user.move.set(0, 100);
                user.move.setEase(5, 0, -1, { speed: 480 });
                while (true) {
                    yield* user.state.startAndWait(shot1());
                }
            }
            if (user.pos.right < 0) {
                const vias = 0.0375;
                user.move.set(600, 0, 1 - vias);
                yield* waitForFrag(() => user.pos.x >= game.width * 0.4);
                const shot1id = user.state.start(shot1());
                user.move.vc = 1;
                yield* waitForFrag(() => user.pos.x >= game.width * 0.6);
                user.state.stop(shot1id);
                user.move.vc = 1 + vias;
            }
            if (user.pos.getScreenX() > game.width) {
                const vias = 0.0375;
                user.move.set(-600, 0, 1 - vias);
                yield* waitForFrag(() => user.pos.x < game.width * 0.6);
                user.move.vc = 1;
                yield* waitForFrag(() => user.pos.x < game.width * 0.4);
                user.move.vc = 1 + vias;
            }
            // while (true) {
            //     yield undefined;
            //     for (let i = 0; i < 3; i++) {
            //         bullets.mulitWay(user.pos.x, user.pos.y, { count: 3, isAim: true, tx: scene.player.pos.x, ty: scene.player.pos.y, color: 'yellow' });
            //         yield* waitForTime(0.2);
            //     }
            //     yield* waitForTime(2);
            // }
        },
        boss1: function* (user, bullets, scene) {
            const circleShot = function* () {
                const count = 36;
                for (let i = 0; i < 6; i++) {
                    bullets.circle(user.pos.x, user.pos.y, { count: count, offset: ((360 / count) * 0.5) * (i % 2) });
                    yield* waitForTime(0.5);
                }
            }
            const spiralShot = function* () {
                const deg = 360 / 6;
                let counter = 0;
                for (let i = 0; i < 64; i++) {
                    for (let j = 0; j < 6; j++) {
                        bullets.mulitWay(user.pos.x, user.pos.y, { deg: (deg * j) + counter, count: 1, speed: 100, color: 'aqua' });
                    }
                    yield* waitForTime(0.05);
                    counter += 11;
                }
            }
            const ringShot = function* (isOneTime) {
                do {
                    const bs = bullets.circle(user.pos.x, user.pos.y, { count: 18, color: 'lime' });
                    yield* waitForTime(0.5);
                    for (const b of bs) {
                        const vx = scene.player.pos.x - b.pos.x;
                        const vy = scene.player.pos.y - b.pos.y;
                        const d = Util.distanse(vx, vy);
                        const x = Util.normalize(vx, d) * 50;
                        const y = Util.normalize(vy, d) * 50;
                        b.move.set(x, y, 1.03);
                    }
                    yield* waitForTime(1);
                } while (!isOneTime);
            }
            const fanShot = function* () {
                const timeOfs = game.sec;
                while (true) {
                    for (let i = 0; i < 60; i++) {
                        bullets.mulitWay(user.pos.x, user.pos.y, { deg: 270 + (20 * Util.degToX((game.sec - timeOfs) * 120)), count: 1, speed: 400, color: 'aqua' });
                        yield* waitForTime(0.05);
                    }
                    yield* waitForTime(1);
                }
            }
            const guidegShot = function* () {
                yield* waitForTime(2);
                while (true) {
                    for (let j = 0; j < 3; j++) {
                        bullets.mulitWay(user.pos.x, user.pos.y, { deg: 90, count: 4, space: 25, speed: 25, color: 'white', target: scene.player, aimSpeed: 1.5 });
                        yield* waitForTime(1);
                    }
                    yield* waitForTime(3);
                }
            }
            const multiwayShot = function* () {
                while (true) {
                    yield undefined;
                    for (let i = 0; i < 8; i++) {
                        bullets.mulitWay(user.pos.x, user.pos.y, { count: 3, speed: 400, color: 'lime' });
                        yield* waitForTime(0.05);
                    }
                    yield* waitForTime(2);
                }
            }

            yield* waitForTime(0.5);
            const guidedId = user.state.start(guidegShot());
            let currentPattern = 0;

            yield* user.state.startAndWait(multiwayShot());


            while (user.unit.hpRatio > 0.5) {
                switch (currentPattern) {
                    case 0:
                        yield* user.state.startAndWait(circleShot());
                        break;
                    case 1:
                        yield* user.state.startAndWait(spiralShot());
                        break;
                    case 2:
                        yield* user.state.startAndWait(ringShot(true));
                        break;
                }
                yield* waitForTime(2);
                currentPattern = (currentPattern + 1) % 3;
            }
            user.state.start(ringShot(false));
            while (true) {
                const spiralId = user.state.start(spiralShot());
                yield* waitForTime(0.8);
                const circleId = user.state.start(circleShot());
                yield* user.state.wait(spiralId, circleId);
                yield* waitForTime(2);
            }
        }
    }
}
class BulletBox extends Mono {//弾
    constructor() {
        super(new Child());
        this.child.drawlayer = 'effect';
        this.child.addCreator('bullet', () => new Mono(new Guided(), new Move(), new Collision(), new Brush()));
    }
    firing(x, y, vx, vy, color) {
        const bullet = this.child.pool('bullet');
        bullet.pos.set(x, y, 8, 8);
        bullet.pos.align = 1;
        bullet.pos.valign = 1;
        bullet.move.set(vx, vy);
        bullet.collision.set(6, 6);
        bullet.brush.circle();
        bullet.brush.color = color;
        return bullet;
    }
    mulitWay(x, y, { deg = 270, space = 30, count = 3, speed = 150, color = 'red', isAim = false, tx = 0, ty = 0, target = undefined, aimSpeed = 0 } = {}) {
        let d = deg;
        if (isAim) d = Util.xyToDeg(tx - x, ty - y);
        const offset = space * (count - 1) / 2;
        const result = [];
        for (let i = 0; i < count; i++) {
            const bullet = result[i] = this.firing(x, y, Util.degToX(((d - offset) + (space * i)) % 360) * speed, Util.degToY(((d - offset) + (space * i)) % 360) * speed, color);
            if (target) {
                bullet.guided.target = target;
                bullet.guided.aimSpeed = aimSpeed;
                bullet.move.vc = 1.03;
            }
        }
        return result;
    }
    circle(x, y, { count = 36, offset = 0, speed = 150, color = 'red', } = {}) {
        const d = 360 / count;
        const result = [];
        for (let i = 0; i < count; i++) {
            result[i] = this.firing(x, y, Util.degToX((d * i + offset) % 360) * speed, Util.degToY((d * i + offset) % 360) * speed, color);
        }
        return result;
    }
}
class ScenePause extends Mono {//中断メニュー画面
    constructor() {
        super(new Child());
        this.child.drawlayer = 'ui';
        this.child.add(new Tofu().set(0, 0, game.width, game.height, 'black', 0.5));
        this.child.add(new Label(text.pause, game.width * 0.5, game.height * 0.25, { size: cfg.fontSize.medium, color: cfg.theme.highlite, align: 1, valign: 1 }));
        this.child.add(this.menu = new Menu(game.width * 0.5, game.height * 0.5, cfg.fontSize.medium));
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
class SceneClear extends Mono {//ステージクリア画面
    constructor() {
        super(new Child());
        this.child.drawlayer = 'ui';
        this.child.add(new Label(text.stageclear, game.width * 0.5, game.height * 0.25, { size: cfg.fontSize.medium, color: cfg.theme.highlite, align: 1, valign: 1 }));
        let x = game.width * 0.4;
        const y = game.height * 0.4;
        const line = cfg.fontSize.medium * 1.5;
        const before = shared.playdata.backup;
        const total = shared.playdata.total;
        this.child.add(new Label(text.stage, x, y, { align: 2, valign: 1 }));
        this.child.add(new Label(text.time, x, y + line, { align: 2, valign: 1 }));
        this.child.add(new Label(text.point, x, y + (line * 2), { align: 2, valign: 1 }));
        this.child.add(new Label(text.ko, x, y + (line * 3), { align: 2, valign: 1 }));
        x = game.width * 0.8;
        this.child.add(new Label(total.stage, x, y, { align: 2, valign: 1 }));
        this.child.add(new Label(Math.floor(total.time - before.time), x, y + line, { align: 2, valign: 1 }));
        this.child.add(new Label(total.point - before.point, x, y + (line * 2), { align: 2, valign: 1 }));
        this.child.add(new Label(total.ko - before.ko, x, y + (line * 3), { align: 2, valign: 1 }));
    }
    *stateDefault() {
        game.pushScene(this);
        while (true) {
            yield undefined;
            if (game.input.isPress('x')) break;
        }
        game.popScene();
        return;
    }
}
class SceneGameOver extends Mono {//ゲームオーバー画面
    constructor() {
        super(new Child());
        this.child.drawlayer = 'ui';
        this.child.add(new Tofu().set(0, 0, game.width, game.height, 'black', 0.5));
        this.child.add(new Label(text.gameover, game.width * 0.5, game.height * 0.25, { size: cfg.fontSize.medium, color: cfg.theme.highlite, align: 1, valign: 1 }));
        this.child.add(this.menu = new Menu(game.width * 0.5, game.height * 0.5, cfg.fontSize.medium));
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
class SceneHighscore extends Mono {//ハイスコア画面
    constructor(newRecord) {
        super(new Child());
        this.child.drawlayer = 'ui';
        if (newRecord) this.child.add(new Tofu().set(0, 0, game.width, game.height, 'black', 0.5));
        this.child.add(new Label(text.highscore, game.width * 0.5, game.height * 0.15, { size: cfg.fontSize.medium, color: cfg.theme.highlite, align: 1, valign: 1 }));
        const x = game.width * 0.2;
        const y = game.height * 0.25;
        for (let i = 0; i < shared.highscores.length; i++) {
            const score = shared.highscores[i];
            const label = new Label(`${(i + 1).toString().padStart(2, ' ')}:${score.point}`, x, y + i * (cfg.fontSize.medium * 1.25), { valign: 1 });
            if (score === newRecord) {
                label.color.value = cfg.theme.highlite;
                label.color.blink(0.5);
            }
            this.child.add(label);
        }
    }
    *stateDefault() {
        game.pushScene(this);
        while (true) {
            yield undefined;
            if (game.input.isPress('z') || game.input.isPress('x')) break;
        }
        game.popScene();
        return;
    }
}
export const game = new Game();
game.start([cfg.font.default, cfg.font.emoji], () => {
    game.input.keybind('z', 'z', { button: 1 });
    game.input.keybind('x', 'x', { button: 0 });

    const ctx = game.layers.get('bg').getContext();
    const grad = ctx.createLinearGradient(0, 0, 0, game.height);
    grad.addColorStop(0, "#2B4C99");
    grad.addColorStop(1, "#AFC8E4");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, game.width, game.height);

    game.layers.add(cfg.layer);
    game.layers.get('effect').enableBlur();
    game.pushScene(new SceneTitle());
});