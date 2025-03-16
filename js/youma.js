'use strict';
const cfg = {//ゲームの設定
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
    },
    saveData: {
        name: 'saveData'
    }
}
const EMOJI = Object.freeze({//Font Awesomeの絵文字のUnicode
    GHOST: 'f6e2',
    CAT: 'f6be',
    CROW: 'f520',
    HOUSE: 'e00d',
    TREE: 'f1bb',
    DOVE: 'f4ba',
    POO: 'f2fe',
    CROWN: 'f521',
    FEATHER: 'f52d',
    STAR: 'f005',
    HEART: 'f004',
});
class Game {//ゲーム本体    
    constructor(width = 360, height = 480) {
        document.body.style.backgroundColor = 'black';
        this.screenRect = new Rect().set(0, 0, width, height);
        this.rangeRect = new Rect().set(0, 0, width, height);
        this.layers = new Layers(width, height);
        this.root = new Mono(State, Child);
        this.input = new Input();
        this.time = this.delta = 0;
        this.fpsBuffer = new Array(60).fill(0);
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
    isOutOfScreen = (rect) => !this.screenRect.isIntersect(rect);
    isWithinScreen = (rect) => !this.screenRect.isOverflow(rect);
    isOutOfRange = (rect) => !this.rangeRect.isIntersect(rect);
    isWithinRange = (rect) => !this.rangeRect.isOverflow(rect);
    setRange = (range) => this.rangeRect.set(-range, -range, this.width + range + range, this.height + range + range);
    get range() { return Math.abs(this.rangeRect.x) };
    get fps() { return Math.floor(1 / Util.average(this.fpsBuffer)); }
    get sec() { return this.time / 1000; }
    save(data, key) { Util.save(data, key); }
    load(key) { return Util.load(key); }
    deleteSave(key) { Util.deleteSave(key); }
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
    static degRotateXY(x, y, deg) {
        const rad = deg * Util.radian;
        return [Math.cos(rad) * x - Math.sin(rad) * y, Math.sin(rad) * x + Math.cos(rad) * y];
    }
    static distanse = (x, y) => Math.sqrt(x * x + y * y);
    static normalize(x, y) {
        const d = Util.distanse(x, y);
        return [x / d, y / d];
    }
    static xRotaRad = (x, y, rad) => Math.cos(rad) * x - Math.sin(rad) * y;
    static yRotaRad = (x, y, rad) => Math.sin(rad) * x + Math.cos(rad) * y;
    static spdToDeg = (speed, radius) => (speed * 180) / (Math.PI * radius);
    static dot = (x, y, x2, y2) => x * x2 + y * y2;
    static cross = (x, y, x2, y2) => x * y2 - y * x2;
    static lerp = (start, end, t) => (1 - t) * start + t * end;
    static rand = (max, min = 0) => Math.floor(Math.random() * (max + 1 - min) + min);
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
    static isIterable = (obj) => obj && typeof obj[Symbol.iterator] === 'function';
    static isImageFile = (file) => /\.(jpg|jpeg|png|gif)$/i.test(file)
    static save(item, key) { localStorage.setItem(key, JSON.stringify(item)); }
    static load(key) { return JSON.parse(localStorage.getItem(key)); }
    static deleteSave(key) { localStorage.removeItem(key); }
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
    get right() { return this.x + this.width }
    get bottom() { return this.y + this.height }
    isIntersect = (rect) => rect.right > this.x && this.right > rect.x && rect.bottom > this.y && this.bottom > rect.y;
    isOverflow = (rect) => rect.x < this.x || rect.right > this.right || rect.y < this.y || rect.bottom > this.bottom;
}
class Mono {//ゲームオブジェクト
    constructor(...args) {
        this.isExist = this.isActive = true;
        this.isRemoved = false;
        this.mixs = [];
        this.childIndex = -1;
        this.remove;
        this.addMix(args);
    }
    addMix(mixCtor, isFirst) {
        const mixCtors = Util.isIterable(mixCtor) ? mixCtor : [mixCtor];
        for (const ctor of mixCtors) {
            const requiedMixCtors = Util.isIterable(ctor?.requieds) ? ctor.requieds : [ctor?.requieds].filter(Boolean);
            for (const requiedMixCtor of requiedMixCtors) {
                this._addMix(requiedMixCtor);
            }
            this._addMix(ctor, isFirst);
        }
    }
    _addMix(mixCtor, isFirst) {
        const name = mixCtor.name.toLowerCase();
        if (name in this) return;
        const mix = new mixCtor();
        mix.owner = this;
        this[name] = mix;
        if (isFirst) {
            this.mixs.unshift(mix);
        } else {
            this.mixs.push(mix);
        }
    }
    resetMix() {
        for (const mix of this.mixs) mix.reset?.();
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
class State {//ステートコンポーネント
    constructor() {
        this.generators = new Map();
    }
    reset() {
        this.generators.clear();
    }
    isEnable(id) {
        return this.generators.has(id);
    }
    start(state, id = Util.uniqueId()) {
        this.generators.set(id, state);
        return id;
    }
    startAndWait(state, id) {
        return this.wait(this.start(state, id));
    }
    stop(id) {
        this.generators.delete(id);
    }
    stopAll(...skipids) {
        const skipset = new Set(skipids);
        for (const id of this.generators.keys()) {
            if (skipset.has(id)) continue;
            this.generators.delete(id);
        }
    }
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
    wait(...ids) {
        return waitForFrag(() => {
            return ids.every(id => !this.isEnable(id));
        });
    }
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
        this.angle = 0;
        this.align = this.valign = 0;//align&valign left top=0,center midle=1,right bottom=2
        this._rect.set(0, 0, 0, 0);
        this.parent = undefined;
    }
    set(x, y, width, height) {
        Object.assign(this, { x, y, width, height, halfWidth: width * 0.5, halfHeight: height * 0.5 });
        return this;
    }
    get linkX() { return this.x + (this.parent ? this.parent.pos.linkX : 0) }
    get linkY() { return this.y + (this.parent ? this.parent.pos.linkY : 0) }
    get alignCollect() { return this.align * this.halfWidth }
    get valignCollect() { return this.valign * this.halfHeight }
    get left() { return Math.floor(this.linkX - this.alignCollect) }
    get top() { return Math.floor(this.linkY - this.valignCollect) }
    get right() { return this.left + this.width; }
    get bottom() { return this.top + this.height; }
    get center() { return this.left + this.halfWidth; }
    get middle() { return this.top + this.halfHeight; }
    get rect() { return this._rect.set(this.left, this.top, this.width, this.height) }
}
class Move {//動作コンポーネント
    static requieds = Pos;
    constructor() {
        this.ease = new Ease();
        this.reset();
    }
    reset() {
        this.set(0, 0);
        this.setRotate(0);
        this.setRevo(0);
    }
    set(vx, vy) {
        this.vx = vx;
        this.vy = vy;
        this.setChangeSpeed();
    }
    setChangeSpeed(speedChangeTime = 0, minSpeedVias = 0, easing = Ease.sinein) {
        if (speedChangeTime === 0) {
            this.ease.reset();
            this.ease.isDelta = true;
            return;
        }
        this.ease.set(speedChangeTime, easing, false, false, minSpeedVias);
        this.ease.endToDelta = true;
    }
    _setRelativeParams(x, y, speedOrTime, isTimeBased, options) {
        const { easing = Ease.liner, isLoop = false, isfirstRand = false, min = 0 } = options;
        this.vx = x;
        this.vy = y;
        const distance = Util.distanse(x, y);
        if (isTimeBased) {
            return this.ease.set(speedOrTime, easing, isLoop, isfirstRand, min);
        } else {
            return this.ease.set(distance / speedOrTime, easing, isLoop, isfirstRand, min);
        }
    }
    relative(x, y, speed, options = {}) {
        return this._setRelativeParams(x, y, speed, false, options);
    }
    relativeForTime(x, y, time, options = {}) {
        return this._setRelativeParams(x, y, time, true, options);
    }
    relativeDeg(deg, distance, speed, options = {}) {
        const x = Util.degToX(deg) * distance;
        const y = Util.degToY(deg) * distance;
        return this._setRelativeParams(x, y, speed, false, options);
    }
    relativeDegForTime(deg, distance, time, options = {}) {
        const x = Util.degToX(deg) * distance;
        const y = Util.degToY(deg) * distance;
        return this._setRelativeParams(x, y, time, true, options);
    }
    to(x, y, speed, options = {}) {
        const pos = this.owner.pos;
        return this.relative(x - pos.x, y - pos.y, speed, options);
    }
    toForTime(x, y, time, options = {}) {
        const pos = this.owner.pos;
        return this.relativeForTime(x - pos.x, y - pos.y, time, options);
    }
    setRevo(speedDeg) {
        this.revo = speedDeg;
    }
    setRotate(speedDeg) {
        this.rotate = speedDeg;
    }
    update() {
        const delta = this.ease.getCurrent();
        const pos = this.owner.pos;
        if (this.revo !== 0) {
            const [x, y] = Util.degRotateXY(pos.x, pos.y, this.revo * delta);
            pos.x = x;
            pos.y = y;
        }
        if (this.rotate !== 0) {
            pos.angle = (pos.angle + this.rotate * delta) % 360;
        }
        pos.x += this.vx * delta;
        pos.y += this.vy * delta;
    }
    get isActive() { return this.ease.isActive; }
    get percentage() { return this.ease.percentage; }
}
class OutOfScreenToRemove {//画面外に出ると削除コンポーネント
    constructor() {
        return this;
    }
    update() {
        if (game.isOutOfScreen(this.owner.pos.rect)) this.owner.remove();
    }
}
class OutOfRangeToRemove {//範囲外に出ると削除コンポーネント
    constructor() {
        return this;
    }
    update() {
        if (game.isOutOfRange(this.owner.pos.rect)) this.owner.remove();
    }
}
class Ease {//イージング
    static liner = (t) => t;
    static sinein = (t) => 1 - Math.cos(t * Math.PI / 2);
    static sineout = (t) => Math.sin(t * Math.PI / 2);
    static sineInOut = (t) => -(Math.cos(t * Math.PI) - 1) / 2;
    constructor() {
        this.reset();
    }
    reset() {
        this.set(0, undefined, false, 0);
    }
    set(time, ease, isLoop, isfirstRand, min) {
        this.isDelta = false;
        this.endToDelta = false;
        this.time = time;
        this.ease = ease || Ease.liner;
        this.isLoop = isLoop;
        this.range = 1 - min;
        this.ofs = min;
        this.elaps = isfirstRand ? Util.rand(1000) / 1000 : 0;
        this.beforeElaps = 0;
        this.beforeEasing = 0;
        this.value = 0;
        return waitForFrag(() => this.time === 0);
    }
    getCurrent() {
        if (this.isDelta) return game.delta;
        if (this.time === 0) return 0;
        const t = game.delta / this.time;
        this.elaps += t;
        if (!this.isLoop && this.elaps >= 1) this.elaps = 1;
        const e = this.ease(this.elaps);
        const ce = e - this.beforeEasing;
        this.beforeEasing = e;
        if (!this.isLoop && this.elaps >= 1) {
            this.time = 0;
            this.isDelta = this.endToDelta;
        }
        return (ce * this.range) + (Math.sign(ce) * this.ofs * t)
    }
    get isActive() { return this.time > 0 || this.isDelta; }
    get percentage() { return this.elaps % 1; }
}
class Anime extends Move {//アニメコンポーネント
    constructor() {
        return super();
    }
}
class Guided {//ホーミングコンポーネント
    static requieds = Pos;
    constructor() {
        this.reset();
    }
    reset() {
        this.target = undefined;
        this.aimSpeed = 0
    }
    set(target, aimSpeed, firstSpeed, accelTime) {
        this.target = target;
        this.aimSpeed = aimSpeed;
        this.owner.move.setChangeSpeed(accelTime, firstSpeed, Ease.sinein);
    }
    update() {
        if (!this.target) return;
        const pos = this.owner.pos;
        const move = this.owner.move;
        const r = (Util.cross(this.target.pos.linkX - pos.linkX, this.target.pos.linkY - pos.linkY, move.vx, move.vy) > 0 ? -this.aimSpeed : this.aimSpeed);
        const [x, y] = Util.degRotateXY(move.vx, move.vy, r);
        move.vx = x;
        move.vy = y;
    }
}
class Collision {//当たり判定コンポーネント
    static requieds = Pos;
    constructor() {
        this._rect = new Rect();
        this.isEnable = true;
        this.isVisible = false;
    }
    reset = () => this.set(0, 0);
    set = (width, height) => this._rect.set(0, 0, width, height);
    get rect() {
        const pos = this.owner.pos;
        return this._rect.set(Math.floor(pos.linkX - pos.align * this._rect.width * 0.5), Math.floor(pos.linkY - pos.valign * this._rect.height * 0.5), this._rect.width, this._rect.height);
    }
    hit = (obj) => this.isEnable && this.rect.isIntersect(obj.collision.rect);//速度が矩形より大きいとすり抜けるよ
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
    addCreator(name, func) {
        this.creator[name] = func;
    }
    pool(name) {//オブジェクトプール（オブジェクトを再利用する）
        let obj;
        if (!(name in this.reserves)) this.reserves[name] = [];
        if (this.reserves[name].length === 0) {
            obj = this.createObject(name);
        } else {
            obj = this.objs[this.reserves[name].pop()];
        }
        obj.isExist = true;
        this.liveCount++;
        return obj;
    }
    createObject(name) {
        const obj = this.creator[name]();
        obj.childIndex = this.objs.length;
        obj.remove = () => {
            if (!obj.isExist) return;
            obj.isExist = false;
            obj.resetMix();
            this.reserves[name].push(obj.childIndex);
            this.liveCount--;
        }
        this.objs.push(obj);
        return obj;
    }
    add(obj) {//プールしないオブジェクト用　removeすると削除リストに登録されて、フレームの終わりにまとめて削除される
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
            if (obj.isExist) func(obj);
        }
    }
    get count() { return this.objs.length };
}
class Color {//色コンポーネント
    constructor() {
        this.reset();
    }
    reset() {
        this.setColor(cfg.theme.text);
        this.alpha = this.baseAlpha = 1;
        this.func = undefined;
    }
    setColor(color) {
        this.value = this.baseColor = color;
    }
    setAlpha(alpha) {
        this.alpha = this.baseAlpha = alpha;
    }
    restore() {
        this.value = this.baseColor;
        this.alpha = this.baseAlpha;
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
        this.basealpha = this.alpha;
        let timer = interval;
        this.func = () => {
            if (timer <= 0) {
                timer = interval;
                this.alpha = this.alpha === 1 ? 0 : 1;
                return;
            }
            timer -= game.delta;
        }
    }
    applyContext(ctx) {
        ctx.fillStyle = this.value;
        ctx.globalAlpha = this.alpha;
    }
}
class Moji {//文字表示コンポーネント
    static requieds = [Pos, Color];
    constructor() {
        this.reset();
    }
    reset() {
        this.text = '';
        this.weight = 'normal';
        this.size = cfg.fontSize.normal;
        this.font = cfg.font.default;
        this.baseLine = 'top';
    }
    set(text, { x = this.owner.pos.x, y = this.owner.pos.y, size = this.size, color = this.owner.color.value, font = this.font, weight = this.weight, align = this.owner.pos.align, valign = this.owner.pos.valign, angle = this.owner.pos.angle } = {}) {
        this.text = text;
        this.weight = weight;
        this.size = size;
        this.font = font;
        this.owner.color.setColor(color);
        const ctx = game.layers.get('main').getContext();
        ctx.font = `${this.weight} ${this.size}px '${this.font}'`;
        ctx.textBaseline = this.baseLine;
        const tm = ctx.measureText(this.getText);
        const pos = this.owner.pos;
        pos.set(x, y, tm.width, Math.abs(tm.actualBoundingBoxAscent) + Math.abs(tm.actualBoundingBoxDescent));
        pos.align = align;
        pos.valign = valign;
        pos.angle = angle;
    }
    get getText() { return typeof this.text === 'function' ? this.text() : this.text };
    draw(ctx) {
        ctx.save();
        const pos = this.owner.pos;
        ctx.translate(pos.center, pos.middle);
        ctx.rotate(pos.angle * Util.radian);
        ctx.font = `${this.weight} ${this.size}px '${this.font}'`;
        ctx.textBaseline = this.baseLine;
        this.owner.color.applyContext(ctx);
        ctx.fillText(this.getText, -pos.halfWidth, -pos.halfHeight);
        ctx.restore();
    }
}
class Label extends Mono {//文字表示
    constructor(text, x, y, { size = cfg.fontSize.normal, color = cfg.theme.text, font = cfg.font.default.name, weight = 'normal', align = 0, valign = 0 } = {}) {
        super(Moji);
        this.moji.set(text, { x, y, size, color, font, weight, align, valign });
    }
}
class Brush {//図形描画コンポーネント
    static requieds = [Pos, Color];
    static rad = Math.PI * 2;
    constructor() {
        this.reset();
    }
    reset() {
        this.rect();
    }
    rect() {
        this.drawer = (ctx, pos) => {
            ctx.fillRect(pos.left, pos.top, pos.width, pos.height);
        }
    }
    circle() {
        this.drawer = (ctx, pos) => {
            ctx.beginPath();
            ctx.arc(pos.linkX, pos.linkY, pos.width * 0.5, 0, Brush.rad);
            ctx.fill();
        }
    }
    draw(ctx) {
        ctx.save();
        this.owner.color.applyContext(ctx);
        this.drawer(ctx, this.owner.pos);
        ctx.restore();
    }
}
class Tofu extends Mono {//図形描画
    constructor() {
        super(Brush);
    }
    set(x, y, width, height, color, alpha) {
        this.pos.set(x, y, width, height);
        this.color.setColor(color);
        this.color.alpha = alpha;
        return this;
    }
}
class Gauge extends Mono {//ゲージ
    constructor() {
        super(Pos);
        this.color = '';
        this.border = 2;
        this.max = 0;
        this.watch;
        this.pos.width = 100;
        this.pos.height = 10;
    }
    draw(ctx) {
        ctx.save();
        ctx.fillStyle = this.color;
        ctx.strokeStyle = this.color;
        ctx.lineWidth = this.border;
        const pos = this.pos;
        const x = pos.left;
        const y = pos.top;
        const b = this.border + 1;
        ctx.strokeRect(x, y, pos.width, pos.height);
        ctx.fillRect(x + b, y + b, (pos.width - b * 2) * (this.watch?.() / this.max), pos.height - (b * 2));
        ctx.restore();
    }
}
class Particle extends Mono {//パーティクル
    static BrushParticleName = `${Particle.name}${Brush.name}`;
    static MojiParticleName = `${Particle.name}${Moji.name}`;
    constructor() {
        super(Child);
        this.child.addCreator(Particle.BrushParticleName, () => {
            const t = new Mono(Move, Brush);
            t.update = () => {
                if (!t.move.isActive) t.remove();
                t.color.alpha = 1 - t.move.percentage;
            }
            return t;
        });
        this.child.addCreator(Particle.MojiParticleName, () => {
            const t = new Mono(Move, Moji);
            t.update = () => {
                if (!t.move.isActive) t.remove();
                t.color.alpha = 1 - t.move.percentage;
            }
            return t;
        });
    }
    emittCircle(count, distance, time, size, color, x, y, isConverge = false, options = {}) {//拡散
        const { emoji: emoji = undefined, angle = 0, isRandomAngle = false, rotate = 0 } = options;
        const deg = 360 / count;
        const degOffset = 90;
        for (let i = 0; i < count; i++) {
            let t, cx, cy, cd = deg * i + degOffset;
            if (!isConverge) {
                cx = x;
                cy = y;
            } else {
                cx = x + Util.degToX(cd) * distance;
                cy = y + Util.degToY(cd) * distance;
                cd = (cd + 180) % 360;
            }
            if (emoji) {
                t = this.child.pool(Particle.MojiParticleName);
                t.moji.set(Util.parseUnicode(emoji), { x: cx, y: cy, size: size, color: color, font: cfg.font.emoji.name, align: 1, valign: 1 });
                t.pos.angle = angle;
                if (isRandomAngle) t.pos.angle = (t.pos.angle + Util.rand(359)) % 360;
                t.move.rotate = rotate;
            } else {
                t = this.child.pool(Particle.BrushParticleName);
                t.color.setColor(color);
                t.color.alpha = 1;
                t.pos.set(cx, cy, size, size);
                t.pos.align = 1;
                t.pos.valign = 1;
            }
            t.move.relativeDegForTime(cd, distance, time);
        }
    }
}
class Menu extends Mono {//メニュー
    constructor(x, y, size, { icon = EMOJI.CAT, align = 1, color = cfg.theme.text, highlite = cfg.theme.highlite } = {}) {
        super(Pos, Child);
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
            yield* waitForTimeOrFrag(game.input.isPress(key) ? cfg.input.repeatWaitFirst : cfg.input.repeatWait, () => game.input.isUp(key) || game.input.isPress('z') || (this.isEnableCancel && game.input.isPress('x')));
        }
        this.moveIndex(newIndex);
        while (true) {
            yield undefined;
            yield* move.bind(this)('up', length - 1);
            yield* move.bind(this)('down', 1);
            if (game.input.isPress('z')) return this.child.objs[this.index + this.indexOffset].moji.getText;
            if (this.isEnableCancel && game.input.isPress('x')) return text.cancel;
        }
    }
    moveIndex(newIndex) {
        this.child.objs[this.index + this.indexOffset].color.setColor(this.color);
        this.index = newIndex;
        const item = this.child.objs[newIndex + this.indexOffset];
        item.color.setColor(this.highlite);
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
class Watch extends Mono {//デバッグ用変数表示
    constructor() {
        super(Pos, Child);
        this.child.drawlayer = 'ui';
        this.child.addCreator('label', () => new Label());
    }
    clear() {
        this.child.removeAll();
    }
    add(watch) {
        const l = this.child.pool('label');
        l.moji.set(watch, { x: 2, y: this.pos.y + ((this.child.liveCount - 1) * l.moji.size * 1.5) });
    }
}