//シューティングゲーム的なもの
//by はぐれヨウマ

{//Javascriptメモ
    //動的言語だからか入力補完があまり効かなくて不便～
    //thisは.の左のオブジェクトのこと！thisを固定するにはbindやCallする　アロー関数=>のthisは変わらないよ
    //ゲッター・セッターはアロー関数=>に未対応
    //スプレッド構文[1,...配列A,2...配列B]
    //Mapは名前で読み書きできる配列
    //ジェネレーター構文*method(){}関数を中断と再開できる アロー関数=>はない
    //jsファイルを後から読み込むには、script要素を追加してonloadイベントで待つのがいい？
    //a=yield 1;→b=generator.next();でbに1が返ってきて、続けてgenerator.next(2)でaに2が返ってくる　yieldの外と変数のやり取りができる
    //非同期 new Promise((resolve){非同期にやりたいこと;resolve();}).then(){非同期が終わってから呼ばれる};
    //async関数はresolveが呼んであるPromiseオブジェクトをreturnするよ
    //webフォントの読み込み待ちはonloadイベントでできないみたいなのでWebFontLoaderを使った
    //プロパティをコンストラクタで定義するのとインスタンスに後から追加するのは、なにか違いがあるの？
}
{//仕様メモ
    //毎フレームの処理の順序　オブジェクトツリーのルートから順に、update→コンポーネントundate→postupdate　draw→コンポーネントdraw
}
{//やりたいことメモ
    //ハイスコアのローカルセーブ＆ロード
    //残像の色変更　HSV色空間とグラデーションマップがいる
}
'use strict';
console.clear();
//ゲームエンジンのクラス
class Game {//ゲーム本体    
    constructor(width = 360, height = 480) {
        document.body.style.backgroundColor = 'black';
        this.screenRect = new Rect().set(0, 0, width, height);
        this.rangeRect = new Rect().set(0, 0, width, height);
        this.layers = new Layers(width, height);
        this.root = new Mono(new State(), new Child());
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
        this.mixClasses = new Map();
        this.mixs = [];
        this.childIndex = -1;
        this.remove;

        for (const mixCtor of args) {
            this.addMixClasses(mixCtor);
        }
        for (const mixCtor of this.mixClasses.values()) {
            this.mixs.add(new mixCtor());
        }
        this.mixs.sort((a, b) => a?.priority ?? 0 - b?.priority ?? 0);
    }
    addMixClasses(mixCtor) {
        if (this.mixClasses.has(mixCtor.name)) return;
        this.mixClasses.set(mixCtor.name, mixCtor);
        for (const requiedMixCtor of mixCtor?.requied) {
            if (this.mixClasses.has(requiedMixCtor.name)) continue;
            this.mixClasses.set(requiedMixCtor.name, requiedMixCtor);
        }
    }
    addMix(mix, isBefore = false) {
        const name = mix.constructor.name.toLowerCase();
        if (name in this) return;
        mix.owner = this;
        this[name] = mix;
        if (isBefore) {
            this.mixs.unshift(mix);
        } else {
            this.mixs.push(mix);
        }
        return this;
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
    get left() { return Math.floor(this.linkX - this.align * this.halfWidth) };
    get top() { return Math.floor(this.linkY - this.valign * this.halfHeight) };
    get right() { return this.left + this.width; }
    get bottom() { return this.top + this.height; }
    get center() { return this.left + this.halfWidth; }
    get middle() { return this.top + this.halfHeight; }
    get rect() { return this._rect.set(this.left, this.top, this.width, this.height) }
}
class Move {//動作コンポーネント
    static requieds = [];
    constructor() {
        this.ease = new Ease();
        this.reset();
        return [new Pos(), this];
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
    _setRelativeParams(x, y, speedOrTime, isTimebBased, options) {
        const { easing = Ease.liner, isLoop = false, isfirstRand = false, min = 0 } = options;
        this.vx = x;
        this.vy = y;
        const distance = Util.distanse(x, y);
        if (isTimebBased) {
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
        if (game.isOutOfRange(this.owner.pos.rect)) {
            this.owner.remove();
            console.log('outofrangetoremove');
        }
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
    constructor() {
        this.reset();
        return [this, new Pos()];
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
    constructor() {
        this._rect = new Rect();
        this.isEnable = true;
        this.isVisible = false;
        return [new Pos(), this];
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
        super(new Moji());
        this.moji.set(text, { x, y, size, color, font, weight, align, valign });
    }
}
class Brush {//図形描画コンポーネント
    static rad = Math.PI * 2;
    constructor() {
        this.reset();
        return [new Pos(), new Color(), this];
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
        super(new Brush());
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
        super(new Pos());
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
        super(new Child());
        this.child.addCreator(Particle.BrushParticleName, () => {
            const t = new Mono(new Move(), new Brush());
            t.update = () => {
                if (!t.move.isActive) t.remove();
                t.color.alpha = 1 - t.move.percentage;
            }
            return t;
        });
        this.child.addCreator(Particle.MojiParticleName, () => {
            const t = new Mono(new Move(), new Moji());
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
        super(new Pos(), new Child());
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
//ここからゲーム固有のクラス
class Unit {//キャラ
    constructor() {
        this.reset();
        return [new State(), this];
    }
    reset() {
        this.hp = this.maxHp = this.point = this.kocount = 1;
        this.invincible = this.firing = false;//無敵、射撃中
        this.data = this.scene = this.onBanish = this.onDefeat = undefined;
    }
    set(data, scene) {
        this.reset();
        this.scene = scene;
        this._createRequiedState();
        if (!data) return;
        this.data = data;
        this.hp = this.maxHp = data.hp;
        this.point = data.point;
        this.owner.addMix(data.isOutOfScreenToRemove ? new OutOfScreenToRemove() : new OutOfRangeToRemove(), true);
    }
    resetHp() {
        this.hp = this.maxHp;
    }
    isBanish() {
        return !this.invincible && this.hp > 0;
    }
    banish(damage) {//ダメージを与える
        this.hp = Math.max(this.hp - damage, 0);
        this.onBanish?.();
        if (this.hp > 0) return;
        this.defeat();
    }
    _playEffect(name) {
        let { emoji, color, isRandomAngle, count, rotate, isConverge } = datas.unit.effects[name];
        if (color === '') color = this.data.color;
        const size = this.data.size;
        const particleSize = size * (emoji === '' ? 0.2 : 0.5);
        this.scene.effect.emittCircle(count, size * 1.5, size * 0.0125, particleSize, color, this.owner.pos.linkX, this.owner.pos.linkY, isConverge, { emoji: emoji, isRandomAngle: isRandomAngle, rotate: rotate });
    }
    playSpawnEffect() {
        this._playEffect(datas.unit.defaultSpawnEffect);
    }
    playDefeatEffect() {
        const name = this.data.defeatEffect;
        this._playEffect(name === '' ? datas.unit.defaultDefeatEffect : name);
    }
    spawnRequied() {//画面内で出現した際に呼ぶ
        this.playSpawnEffect();
        return this.data.size * 0.005;
    }
    defeat() {//撃破
        const state = this.owner.state;
        state.start(state.defeat(), 'defeat');
    }
    defeatRequied() {//撃破時に呼ぶ
        shared.playdata.total.point += this.point;
        shared.playdata.total.ko += this.kocount;
        this.onDefeat?.();
        this.owner.remove();
    }
    _createRequiedState() {
        const owner = this.owner;
        const unit = this;
        owner.state.defeat ??= this.stateDefeat.bind(this);
    }
    *stateDefeat() {
        this.playDefeatEffect();
        this.defeatRequied();
    }
    get isDefeat() { return this.hp <= 0; }
    get hpRatio() { return this.hp / this.maxHp };
}
class Player extends Mono {//プレイヤーキャラ
    constructor(bullets, scene) {
        super(new State(), new Move(), new Moji(), new Collision(), new Unit());
        const data = datas.player.data;
        this.state.start(this.stateDefault.call(this, bullets));
        this.moji.set(Util.parseUnicode(data.char), { x: game.width * 0.5, y: game.height - (data.size * 0.5), size: data.size, color: data.color, font: cfg.font.emoji.name, align: 1, valign: 1, angle: 180 });
        this.collision.set(this.pos.width * 0.25, this.pos.height * 0.25);
        this.unit.set(data, scene);
        this.unit.kocount = 0;
        this.unit.onBanish = () => {
            this.state.start(this.stateDamagedInvincible());
        }
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
    postUpdate() {
        const halfX = this.pos.width * 0.5;
        const halfY = this.pos.height * 0.5;
        this.pos.x = Util.clamp(halfX, this.pos.x, game.width - halfX);
        this.pos.y = Util.clamp(halfY, this.pos.y, game.height - halfY);
    }
    draw(ctx) {
        const pos = this.pos;
        const x = this.pos.left;
        const y = pos.top;
        ctx.fillStyle = 'yellow';
        ctx.fillRect(x + 31, y + 5, 10, 8);
    }
    *stateDefault(bullets) {
        yield* waitForTime(0.5);
        this.unit.firing = false;
        const point = 100;
        const shotOption = { deg: 90, count: 1, speed: datas.player.bulletSpeed, color: 'lime', point: point };
        const shotOption2 = { deg: 85, count: 1, speed: datas.player.bulletSpeed, color: 'lime', point: point };
        const shotOption3 = { deg: 95, count: 1, speed: datas.player.bulletSpeed, color: 'lime', point: point };
        while (true) {
            if (!this.unit.firing) {
                yield undefined;
                continue;
            }
            bullets.mulitWay(this.pos.x + 10, this.pos.y, shotOption);
            bullets.mulitWay(this.pos.x + 10, this.pos.y, shotOption2);
            bullets.mulitWay(this.pos.x - 10, this.pos.y, shotOption);
            bullets.mulitWay(this.pos.x - 10, this.pos.y, shotOption3);
            this.unit.firing = false;
            yield* waitForTime(0.125);
        }
    }
    *stateDamagedInvincible() {
        this.unit.invincible = true;
        yield undefined;
        this.color.blink(0.03);
        yield* waitForTime(datas.player.damagedInvincibilityTime);
        this.color.restore();
        this.unit.invincible = false;
    }
}
class Baddies extends Mono {//敵キャラのコンテナ
    static form = Object.freeze({ within: 'within', circle: 'circle', v: 'v', delta: 'delta', tri: 'tri', inverttri: 'inverttri', trail: 'trail', abrest: 'abrest', topsingle: 'topsingle', left: 'left', right: 'right', randomtop: 'randomtop', randomside: 'randomside' });
    constructor() {
        super(new Child());
        for (const data of Object.values(datas.baddies)) this.child.addCreator(data.name, () => new Baddie());
    }
    spawn(x, y, name, pattern, bullets, scene, parent) {
        return this.child.pool(name).set(x, y, name, pattern, bullets, scene, parent);
    }
    *formation(type, x, y, n, s, name, pattern, bullets, scene, parent) {
        //xまたはyは-1にするとランダムになるよ
        const poss = [];
        const size = datas.baddies[name].size;
        const space = size + size * (s > 0 ? s : 0.25);
        const baseY = -size;
        const push = (x, y) => poss.push([x, y]);
        const singleform = (isTop = false) => {
            if (x < 0) x = Util.rand(game.width - size) + size * 0.5;
            if (y < 0) y = Util.rand(game.width - size) + size * 0.5;
            if (isTop) y = baseY;
            push(x, y);
        }
        const circleform = () => {
            const d = s > 0 ? s : size * 2;
            const deg = 360 / n;
            for (let i = 0; i < n; i++) {
                push(Util.degToX(deg * i) * d, Util.degToY(deg * i) * d);
            }
        }
        const vform = (isReverse = false) => {
            const row = Math.floor(n * 0.5) + 1;
            if (x < 0) {
                const w = space * (row * 2 - 1);
                x = Util.rand(game.width - w) + w * 0.5;
            }
            for (let i = 0; i < row; i++) {
                const col = isReverse ? (row - 1) - i : i;
                if (col !== 0) push(x - (space * col), baseY - space * i);
                push(x + (space * col), baseY - space * i);
            }
        }
        const triform = (isReverse = false) => {
            const row = Math.floor(n * 0.5) + 1;
            if (x < 0) {
                const w = space * (row * 2 - 1);
                x = Util.rand(game.width - w) + w * 0.5;
            }
            for (let i = 0; i < row; i++) {
                const k = isReverse ? (row - 1) - i : i;
                const col = k * 2 + 1;
                for (let j = 0; j < col; j++) {
                    push(x - (space * k) + (space * j), baseY - space * i);
                }
            }
        }
        const trailform = () => {
            if (x < 0) x = Util.rand(game.width - size) + size * 0.5;
            for (let i = 0; i < n; i++) {
                push(x, baseY - space * i);
            }
        }
        const abrestform = () => {
            if (x < 0) {
                const w = space * n;
                x = Util.rand(game.width - w) + size * 0.5;
            }
            for (let i = 0; i < n; i++) {
                push(x + (space * i), baseY);
            }
        }
        const sideform = (isR = false) => {
            if (y < 0) {
                const h = (space) * n;
                y = Util.rand(game.width - h) + size * 0.5;
            }
            const x = isR ? game.width + size : -size;
            const w = Math.sign(x) * size * 0.5;
            for (let i = 0; i < n; i++) {
                push(x + (w * i), y + ((space) * i));
            }
        }
        const randomform = (isSide = false) => {
            const X = (isR) => isR ? game.width + size : -size;
            const max = Math.floor(isSide ? (game.height * 0.6) / space : (game.width / space) - 1);
            const ps = Util.randomArray(max, Util.rand(Math.min(n, max), 1));
            for (const p of ps) {
                if (!isSide) {
                    push(space * (p + 1), baseY + -Util.rand(size));
                } else {
                    const r = Util.rand(1);
                    push(X(Boolean(r)) + (r === 1 ? 1 : -1) * Util.rand(size), space * (p + 1))
                }
            }
        }
        switch (type) {
            case Baddies.form.within:
                singleform();
                break;
            case Baddies.form.circle:
                circleform();
                break;
            case Baddies.form.topsingle:
                singleform(true);
                break;
            case Baddies.form.v:
                vform();
                break;
            case Baddies.form.delta:
                vform(true);
                break;
            case Baddies.form.tri:
                triform();
                break;
            case Baddies.form.inverttri:
                triform(true);
                break;
            case Baddies.form.trail:
                trailform();
                break;
            case Baddies.form.abrest:
                abrestform();
                break;
            case Baddies.form.left:
                sideform();
                break;
            case Baddies.form.right:
                sideform(true);
                break;
            case Baddies.form.randomtop:
                randomform();
                break;
            case Baddies.form.randomside:
                randomform(true);
                break;
        }
        const baddies = [];
        for (const [x, y] of poss) baddies.push(this.spawn(x, y, name, pattern, bullets, scene, parent));
        switch (type) {
            case Baddies.form.within:
            case Baddies.form.circle:
                let time = 0;
                for (const baddie of baddies) {
                    time = baddie.unit.spawnRequied();
                }
                yield* waitForTime(time * 0.5);
            default:
        }
        return baddies;
    }
}
class Baddie extends Mono {//敵キャラ   
    static spawnType = { within: 0, top: 1, left: 2, right: 3 }
    constructor() {
        super(new State(), new Move(), new Anime(), new Moji(), new Collision(), new Unit());
    }
    set(x, y, name, pattern, bullets, scene, parent) {
        const data = datas.baddies[name];
        this.state.start(this.routines[data.routine](this, pattern, bullets, scene));
        this.pos.parent = parent;
        this.moji.set(Util.parseUnicode(data.char), { x: x, y: y, size: data.size, color: data.color, font: cfg.font.emoji.name, align: 1, valign: 1 });
        this.collision.set(this.pos.width, this.pos.height);
        this.unit.set(data, scene);
        return this;
    }
    setAnime(isVirtical) {
        const size = this.pos.width;
        if (isVirtical) {
            this.anime.relativeDegForTime(0, size / 5, size / 240, { easing: Ease.sineout, isLoop: true, isfirstRand: true });
        } else {
            this.anime.relativeDegForTime(90, size / 5, size / 240, { easing: Ease.sineout, isLoop: true, isfirstRand: true });
        }
    }
    whichSpawnType() {//出現した位置を得る
        let result = Baddie.spawnType.within;
        let isMoveVirtical = false;
        if (this.pos.right < 0) {
            result = Baddie.spawnType.left;
        } else if (this.pos.left >= game.width) {
            result = Baddie.spawnType.right;
        } else if (this.pos.bottom < 0) {
            result = Baddie.spawnType.top;
            isMoveVirtical = true;
        }
        return [result, isMoveVirtical];
    }
    *routineBasicShot(user, pattern, shot) {//汎用射撃ルーチン
        yield* waitForFrag(() => game.isWithinScreen(user.pos.rect));//画面内に入るまで待機
        yield* waitForTime(Util.rand(60) * game.delta);//ランダムで最大1秒まで待機
        while (true) {
            if (game.isOutOfScreen(user.pos.rect)) yield undefined;//画面外にいるなら射撃しない
            yield* shot();//射撃
        }
    }
    *routineBasic(user, pattern, moveSpeed, shot) {//汎用ルーチン
        user.state.start(user.routineBasicShot(user, pattern, shot));
        //移動
        const [spawnType, isAnimeVirtical] = user.whichSpawnType();
        switch (spawnType) {
            case Baddie.spawnType.within:
                //move test
                user.setAnime(isAnimeVirtical);
                //yield* user.move.relative(50, 0, 100, { easing: Ease.sineout, min: 0 });
                //yield* user.move.relative(-50, 0, 100, { easing: Ease.sineout, min: 0 });
                break;
            case Baddie.spawnType.top:
                user.move.set(0, moveSpeed);
                switch (pattern) {
                    case 0:
                        user.setAnime(isAnimeVirtical);
                        break;
                    case 1:
                        user.setAnime(isAnimeVirtical);
                        break;
                }
                break;
            case Baddie.spawnType.left:
                user.setAnime(isAnimeVirtical);
                user.move.set(moveSpeed, 0);
                break;
            case Baddie.spawnType.right:
                user.setAnime(isAnimeVirtical);
                user.move.set(-moveSpeed, 0);
                break;
        }
    }
    routines = {
        zako1: function* (user, pattern, bullets, scene) {
            const moveSpeed = 100;
            yield* user.routineBasic(user, pattern, moveSpeed, function* () {
                bullets.mulitWay(user.pos.linkX, user.pos.linkY, { count: 1, color: 'red' });
                yield* waitForTime(2);
            });
        },
        zako2: function* (user, pattern, bullets, scene) {
            const moveSpeed = 100;
            const shot1 = function* () {
                yield* waitForFrag(() => game.isWithinScreen(user.pos.rect));
                yield* waitForTime(Util.rand(60) * game.delta);
                bullets.mulitWay(user.pos.x, user.pos.y, { color: 'red' });
                yield* waitForTime(2);
            }
            const [spawnType, isAnimeVirtical] = user.whichSpawnType();
            user.setAnime(isAnimeVirtical);
            switch (spawnType) {
                case Baddie.spawnType.left:
                    yield* user.move.relative(0 - user.pos.x, 0, moveSpeed * 2);
                    yield* user.move.relative(game.width * 0.3, 0, moveSpeed * 2, { easing: Ease.sineout, min: 0.5 });
                    user.state.start(user.routineBasicShot(user, pattern, shot1));
                    yield* user.move.relative(game.width * 0.4, 0, moveSpeed, { easing: Ease.liner, min: 0 });
                    yield* user.move.relative(game.width * 0.3, 0, moveSpeed * 2, { easing: Ease.sinein, min: 0.5 });
                    yield* user.move.relative(game.range + user.pos.width, 0, moveSpeed * 2);
                    break;
                case Baddie.spawnType.right:
                    yield* user.move.relative(game.width - user.pos.x, 0, moveSpeed * 2);
                    yield* user.move.relative(-game.width * 0.3, 0, moveSpeed * 2, { easing: Ease.sineout, min: 0.5 });
                    user.state.start(user.routineBasicShot(user, pattern, shot1));
                    yield* user.move.relative(-game.width * 0.4, 0, moveSpeed, { easing: Ease.liner, min: 0 });
                    yield* user.move.relative(-game.width * 0.3, 0, moveSpeed * 2, { easing: Ease.sinein, min: 0.5 });
                    yield* user.move.relative(-(game.range + user.pos.width), 0, moveSpeed * 2);
                    break;
                default:
            }
        },
        zako3: function* (user, pattern, bullets, scene) {
            const moveSpeed = 50;
            yield* user.routineBasic(user, pattern, moveSpeed, function* () {
                bullets.mulitWay(user.pos.x, user.pos.y, { color: 'aqua', aim: scene.player });
                yield* waitForTime(2);
            });
        },
        boss1: function* (user, pattern, bullets, scene) {
            //取り巻き召喚
            const minionName = 'torimakicrow';
            let minions = [];
            const removeMinions = () => {
                for (const minion of minions) minion?.remove();
                minions = [];
            }
            const killMinions = () => {
                for (const minion of minions) minion?.unit.defeat();
                minions = [];
            }
            const initMinion = (minions, index) => {
                const unit = minions[index].unit;
                unit.onDefeat = () => {
                    minions[index] = undefined;
                }
            }
            const summonMinions = function* (name, count, distance) {
                if (minions.length != count) {
                    removeMinions();
                    minions = yield* scene.baddies.formation(Baddies.form.circle, -1, -1, count, distance, name, 0, bullets, scene, user);
                    for (let i = 0; i < minions.length; i++) {
                        initMinion(minions, i);
                    }
                    return;
                }
                let degOffset = 0;
                const baseDeg = 360 / count;
                for (let i = 0; i < minions.length; i++) {
                    const minion = minions[i];
                    if (!minion) continue;
                    degOffset = Util.xyToDeg(minion.pos.x, minion.pos.y) - (i * baseDeg);
                    break;
                }
                let time = 0;
                for (let i = 0; i < minions.length; i++) {
                    const minion = minions[i];
                    if (minion) continue;
                    const deg = i * baseDeg + degOffset;
                    const newMinion = minions[i] = scene.baddies.spawn(Util.degToX(deg) * distance, Util.degToY(deg) * distance, name, 0, bullets, scene, user);
                    initMinion(minions, i);
                    time = newMinion.unit.spawnRequied();
                }
                yield* waitForTime(time * 0.5);
            }
            //撃破エフェクト
            user.state.defeat = function* () {
                killMinions();
                user.state.stopAll('defeat');
                scene.baddiesbullets.child.removeAll();
                const pos = user.pos;
                for (let i = 0; i < 16; i++) {
                    scene.effect.emittCircle(8, pos.width * 1.5, pos.width * 0.0125, pos.width * 0.2, user.color.baseColor, pos.left + Util.rand(pos.width), pos.top + Util.rand(pos.height), false, { emoji: this.data.defeatEffect, isRandomAngle: true, rotate: 360 });
                    yield* waitForTime(1 / 8);
                }
                user.unit.defeatRequied();
            }
            //弾パターン
            const circleShot = function* () {
                const count = 24;
                for (let i = 0; i < 6; i++) {
                    bullets.circle(user.pos.x, user.pos.y, { count: count, offset: ((360 / count) * 0.5) * (i % 2) });
                    yield* waitForTime(0.5);
                }
            }
            const spiralShot = function* () {
                const deg = 360 / 6;
                let degOffset = 0;
                for (let i = 0; i < 16; i++) {
                    for (let j = 0; j < 6; j++) {
                        bullets.mulitWay(user.pos.x, user.pos.y, { deg: (deg * j) + degOffset, count: 1, speed: 100, color: 'lime' });
                    }
                    yield* waitForTime(0.2);
                    degOffset += 18;
                }
            }
            const ringShot = function* () {
                const speed = 500;
                const bulletlist = [
                    ...bullets.circle(user.pos.left, user.pos.y, { speed: 250, count: 12, color: 'aqua', removeOffscreen: false }),
                    ...bullets.circle(user.pos.right, user.pos.y, { speed: 250, count: 12, color: 'aqua', removeOffscreen: false })
                ];
                yield* waitForTime(0.5);
                for (const b of bulletlist) {
                    const [x, y] = Util.normalize(scene.player.pos.x - b.pos.x, scene.player.pos.y - b.pos.y);
                    b.move.set(x * speed, y * speed, 2, 0);
                }
                yield* waitForTime(1);
            }
            const ringShotRepeat = function* () {
                while (true) {
                    yield* ringShot();
                    yield* waitForTime(2);
                }
            }
            const fanShot = function* (count = 3, rangeDeg = 15, radiantSpeed = 180, bulletSpeed = 200) {
                const timeOfs = game.sec;
                for (let i = 0; i < 10; i++) {
                    bullets.mulitWay(user.pos.x, user.pos.y, { deg: 270 + (rangeDeg * Util.degToX((game.sec - timeOfs) * radiantSpeed)), count: count, speed: bulletSpeed, color: 'lime' });
                    yield* waitForTime(0.3);
                }
            }
            const fanShotParallel = function* (count = 3, rangeDeg = 15, radiantSpeed = 180, bulletSpeed = 400) {
                const timeOfs = game.sec;
                for (let i = 0; i < 18; i++) {
                    bullets.mulitWay(user.pos.left, user.pos.y, { deg: 260 + (rangeDeg * Util.degToX((game.sec - timeOfs) * radiantSpeed)), space: 7, count: count, speed: bulletSpeed, color: 'lime' });
                    bullets.mulitWay(user.pos.right, user.pos.y, { deg: 280 + (rangeDeg * Util.degToX((game.sec - timeOfs) * radiantSpeed)), space: 7, count: count, speed: bulletSpeed, color: 'lime' });
                    yield* waitForTime(0.125);
                }
            }
            const guidedShot = function* () {
                for (let j = 0; j < 3; j++) {
                    bullets.mulitWay(user.pos.x, user.pos.y, { deg: 90, space: 25, count: 4, speed: 500, firstSpeed: 0, accelTime: 3, color: 'white', guided: scene.player, guidedSpeed: 2 });
                    yield* waitForTime(1);
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
            //ボスの移動
            const resetPos = function* () {
                yield* user.move.to(game.width * 0.5, game.height * 0.3, 100, { easing: Ease.sineInOut });
            }
            const randPos = function* () {
                const x = Util.rand(game.width - user.pos.width) + (user.pos.width * 0.5);
                const y = Util.rand((game.height * 0.6) - user.pos.height) + (user.pos.height * 0.5);
                yield* user.move.to(x, y, 100, { easing: Ease.sineInOut });
            }
            //ここからボスの動作
            yield* resetPos();
            let shotList = [fanShot, ringShot, guidedShot];
            let currentShot = 0;
            while (user.unit.hpRatio > 0.5) {
                if (currentShot === 0) yield* summonMinions(minionName, 7, user.pos.width * 0.75);
                yield* user.state.startAndWait(shotList[currentShot]());
                if (!(user.unit.hpRatio > 0.5)) break;
                currentShot = (currentShot + 1) % shotList.length;
                if (Util.rand(100) > 30) {
                    yield* randPos();
                } else {
                    yield* waitForTime(1);
                }
            }
            yield* resetPos();
            shotList = [fanShotParallel, circleShot, spiralShot, ringShot];
            currentShot = 0;
            while (user.unit.hpRatio > 0.25) {
                if (currentShot === 0) yield* summonMinions(minionName, 9, user.pos.width * 0.75);
                yield* user.state.startAndWait(shotList[currentShot]());
                if (!(user.unit.hpRatio > 0.25)) break;
                currentShot = (currentShot + 1) % shotList.length;
                if (Util.rand(100) > 30) {
                    yield* randPos();
                    if (Util.rand(100) > 40) yield* randPos();
                } else {
                    yield* waitForTime(1.5);
                }
            }
            killMinions();
            yield* resetPos();
            user.state.start(ringShotRepeat());
            while (true) {
                const spiralId = user.state.start(spiralShot());
                yield* waitForTime(0.8);
                const circleId = user.state.start(circleShot());
                yield* user.state.wait(spiralId, circleId);
                yield* waitForTime(2);
            }
        },
        boss1torimaki: function* (user, pattern, bullets, scene) {
            user.move.setRevo(60);
            yield* waitForTime(Util.rand(60) * game.delta);
            while (true) {
                const r = Util.rand(100);
                if (r > 70) {
                    bullets.mulitWay(user.pos.linkX, user.pos.linkX, { count: 1, color: 'aqua', aim: scene.player });
                } else {
                    bullets.mulitWay(user.pos.linkX, user.pos.linkY, { count: 1, color: 'red' });
                }
                yield* waitForTime(3);
            }
        }
    }
}
class Bullet {//弾コンポーネント
    constructor() {
        this.reset();
    }
    reset() {
        this.set(1, 0)
    }
    set(damage, point) {
        this.damage = damage;
        this.point = point;
    }
}
class BulletBox extends Mono {//弾
    constructor() {
        super(new Child());
        this.child.drawlayer = 'effect';
        this.child.addCreator('bullet', () => new Mono(new Guided(), new Move(), new Collision(), new Brush(), new Bullet()));
    }
    firing(x, y, vx, vy, firstSpeed, accelTime, color, damage, point, removeOffscreen) {
        const bullet = this.child.pool('bullet');
        bullet.addMix(removeOffscreen ? new OutOfScreenToRemove() : new OutOfRangeToRemove(), true);
        bullet.pos.set(x, y, 8, 8);
        bullet.pos.align = 1;
        bullet.pos.valign = 1;
        bullet.move.set(vx, vy);
        bullet.move.setChangeSpeed(accelTime, firstSpeed);
        bullet.collision.set(6, 6);
        bullet.color.setColor(color);
        bullet.brush.circle();
        bullet.bullet.set(damage, point);
        return bullet;
    }
    mulitWay(x, y, { deg = 270, space = 30, count = 3, speed = 150, firstSpeed = 0, accelTime = 0, color = 'red', aim = undefined, guided = undefined, guidedSpeed = 0, damage = 1, point = 0, removeOffscreen = true } = {}) {
        let d = deg;
        if (aim) d = Util.xyToDeg(aim.pos.x - x, aim.pos.y - y);
        const offset = space * (count - 1) / 2;
        const result = [];
        for (let i = 0; i < count; i++) {
            const bullet = result[i] = this.firing(x, y, Util.degToX(((d - offset) + (space * i)) % 360) * speed, Util.degToY(((d - offset) + (space * i)) % 360) * speed, firstSpeed, accelTime, color, damage, point, removeOffscreen);
            if (guided) bullet.guided.set(guided, guidedSpeed, 0, 2);
        }
        return result;
    }
    circle(x, y, { count = 36, offset = 0, speed = 150, firstSpeed = 0, accelTime = 0, color = 'red', damage = 1, point = 0, removeOffscreen = true } = {}) {
        const d = 360 / count;
        const result = [];
        for (let i = 0; i < count; i++) {
            result[i] = this.firing(x, y, Util.degToX((d * i + offset) % 360) * speed, Util.degToY((d * i + offset) % 360) * speed, firstSpeed, accelTime, color, damage, point, removeOffscreen);
        }
        return result;
    }
}
class DialogMenu extends Mono {//ダイアログメニュー
    constructor(caption, items, isPause = false) {
        super(new Child());
        this.child.drawlayer = 'ui';
        this.child.add(new Tofu().set(0, 0, game.width, game.height, 'black', 0.5));
        this.child.add(new Label(caption, game.width * 0.5, game.height * 0.25, { size: cfg.fontSize.medium, color: cfg.theme.highlite, align: 1, valign: 1 }));
        this.child.add(this.menu = new Menu(game.width * 0.5, game.height * 0.5, cfg.fontSize.medium));
        for (const item of items) this.menu.add(item);
        this.isPause = isPause;
    }
    *stateDefault() {
        game.layers.get('effect').isPauseBlur = this.isPause;
        const result = yield* this.menu.stateSelect();
        game.layers.get('effect').isPauseBlur = false;
        return result;
    }
}
class SceneTitle extends Mono {//タイトル画面
    constructor() {
        super(new Child());
        //タイトル
        const titleY = game.height * 0.25;
        this.child.add(new Label(text.title, game.width * 0.5, titleY, { size: cfg.fontSize.large, color: cfg.theme.highlite, align: 1, valign: 1 }));
        this.child.add(new Label(text.title2, game.width * 0.5, titleY + cfg.fontSize.large * 1.5, { size: cfg.fontSize.large, align: 1, valign: 1 }));
        //ボタンを押してね
        this.child.add(this.presskey = new Label(text.presskey, game.width * 0.5, game.height * 0.5 + cfg.fontSize.medium * 1.5, { size: cfg.fontSize.medium, align: 1, valign: 1 }));
        //メニュー
        this.child.add(this.titleMenu = new Menu(game.width * 0.5, game.height * 0.5, cfg.fontSize.medium));
        this.titleMenu.add(text.start);
        this.titleMenu.add(text.highscore);
        this.titleMenu.add(text.credit);
        this.titleMenu.isEnableCancel = true;
        this.titleMenu.isExist = false;
        //操作方法
        // this.child.add(new label(text.explanation1, game.width * 0.5, game.height - (TEXT_SIZE.NORMAL * 2.5), { align: 1, valign: 1 }));
        // this.child.add(new label(text.explanation2, game.width * 0.5, game.height - TEXT_SIZE.NORMAL, { align: 1, valign: 1 }));        
        game.setState(this.statePressKey());
    }
    *statePressKey() {
        this.presskey.color.blink(0.5);
        while (true) {
            yield undefined;
            if (!game.input.isPress('z')) continue;
            this.presskey.isExist = false;
            yield* this.stateTitleMenu();
            this.presskey.isExist = true;
            this.presskey.color.blink(0.5);
        }
    }
    *stateTitleMenu() {
        this.titleMenu.isExist = true;
        while (true) {
            const result = yield* this.titleMenu.stateSelect();
            if (result === text.cancel) {
                this.titleMenu.isExist = false;
                return;
            }
            this.isExist = false;
            if (result === text.start) yield* new ScenePlay().stateDefault();
            if (result === text.highscore) yield* new SceneHighscore().stateDefault();
            if (result === text.credit) yield* new SceneCredit().stateDefault();
            this.isExist = true;
        }
    }
}
class ScenePlay extends Mono {//プレイ画面
    constructor() {
        super(new State(), new Child());
        this.elaps = 0;
        //キャラ
        this.child.add(this.playerside = new Mono(new Child()));
        this.child.add(this.baddies = new Baddies());
        //弾
        this.child.add(this.playerbullets = new BulletBox());
        this.child.add(this.baddiesbullets = new BulletBox());
        //パーティクル
        this.child.add(this.effect = new Particle());
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
        //this.child.add(this.textScore = new Bun(() => `Baddie:${this.baddies.child.liveCount} Bullets:${this.baddiesbullets.child.liveCount}`, { font: 'Impact' }));
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
        this.player.maneuver();//プレイヤーの入力受付を優先するのでここで受け付ける
    }
    postUpdate() {
        const _bulletHitcheck = (bullet, targets) => {
            targets.child.each((target) => {
                if (!bullet.collision.hit(target)) return;
                if (!target.unit.isBanish()) return;
                target.color.flash('crimson');
                shared.playdata.total.point += bullet.bullet.point;
                bullet.remove();
                target.unit.banish(bullet.bullet.damage);
            });
        }
        //キャラの当たり判定
        this.baddies.child.each((baddie) => {
            if (!this.player.collision.hit(baddie)) return;
            if (!this.player.unit.isBanish()) return;
            this.player.unit.banish(1);
        });
        //弾の当たり判定
        this.playerbullets.child.each((bullet) => _bulletHitcheck(bullet, this.baddies));
        this.baddiesbullets.child.each((bullet) => _bulletHitcheck(bullet, this.playerside));
        //経過時間
        this.elaps += game.delta;
        shared.playdata.total.time += game.delta;
    }
    * stateDefault() {
        game.pushScene(this);
        while (true) {
            yield undefined;
            if (this.isClear) {//ステージクリアした
                yield* this.showTelop(text.stageclear, 2);
                shared.playdata.total.stage++;
                yield* new SceneClear().stateDefault();
                shared.playdata.backup = new scoreData(shared.playdata.total);
                this.resetStage();
                continue;
            }
            if (this.isFailure) {//負けた
                yield* this.showTelop(text.gameover, 2);
                if (this.isNewRecord()) {
                    game.save(shared, cfg.saveData.name);//セーブ
                    yield* new SceneHighscore(shared.playdata.total).stateDefault();
                }
                switch (yield* new SceneGameOver(this.newGame).stateDefault()) {
                    case text.continue:
                        this.continueGame();
                        break;
                    case text.returntitle:
                        game.popScene();
                        return;
                }
                continue;
            }
            if (game.input.isPress('x')) {//ポーズメニューを開く
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
        const appears = ['crow', 'dove', 'bigcrow'];
        const bossName = 'greatcrow';
        const phaseLength = 30;
        this.elaps = 0;
        //道中
        while (this.elaps <= phaseLength || this.baddies.child.liveCount > 0) {
            if (this.elaps > phaseLength) {
                yield undefined;
                continue;
            }
            const baddieName = appears[Util.rand(appears.length - 1)];
            const data = datas.baddies[baddieName];
            const formation = data.forms[Util.rand(data.forms.length - 1)];
            const spawnMax = Math.floor(game.width / data.size) - 2;
            const spawnCount = Util.rand(spawnMax);
            this.state.start(this.baddies.formation.call(this.baddies, formation, -1, -1, spawnCount, -1, data.name, 0, this.baddiesbullets, this, 0));
            yield* waitForTime(Util.rand(spawnCount * 0.5, 1));
        }
        if (this.isFailure) return;
        yield* this.showTelop('WARNING!', 2, 0.25);
        if (this.isFailure) return;
        {//ステージボス登場
            const data = datas.baddies[bossName];
            const formation = data.forms[0];
            const [boss] = yield* this.baddies.formation(formation, game.width * 0.5, -1, 1, -1, data.name, 0, this.baddiesbullets, this, 0, undefined);
            let isbossDefeat = false;
            boss.unit.onDefeat = () => {
                isbossDefeat = true;
            }
            this.bossHPgauge.isExist = true;
            this.bossHPgauge.max = boss.unit.maxHp;
            this.bossHPgauge.watch = () => boss.unit.hp;
            this.ui.child.add(this.bossHPgauge);
            yield* waitForFrag(() => {
                return isbossDefeat;
            });
            this.bossHPgauge.remove();
        }
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
        //this.player.unit.invincible = true;//無敵
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
class ScenePause extends Mono {//中断メニュー画面
    constructor() {
        super(new Child());
        this.child.add(this.dialog = new DialogMenu(text.pause, [text.resume, text.restart, text.returntitle], true));
    }
    *stateDefault() {
        game.pushScene(this);
        const result = yield* this.dialog.stateDefault();
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
        this.child.add(this.dialog = new DialogMenu(text.gameover, [text.continue, text.returntitle]));
        this.dialog.menu.isEnableCancel = false;
    }
    *stateDefault() {
        game.pushScene(this);
        const result = yield* this.dialog.stateDefault();
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
                label.color.setColor(cfg.theme.highlite);
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
class SceneCredit extends Mono {//クレジット画面
    constructor() {
        super(new State(), new Child());
        this.child.drawlayer = 'ui';
        this.state.start(this.stateScroll());
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
    *stateScroll() {
        const scrolltime = 3;
        while (true) {
            const header = new Label(text.credit, game.width * 0.5, game.height + (game.height * 0.25), { size: cfg.fontSize.medium, color: cfg.theme.highlite, align: 1, valign: 1 });
            header.addMix(new Move());
            header.addMix(new OutOfScreenToRemove());
            header.move.toForTime(game.width * 0.5, -(game.height * 0.25), 3);
            this.child.add(header);
            yield waitForTime(1);
        }
    }
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
    },
    saveData: {
        name: 'saveData'
    }
}
let text = {//テキスト
    done: '決定', cancel: '取消',
    title: 'シューティングゲーム', title2: 'のようなもの', presskey: 'Zキーを押してね',
    explanation1: '操作方法：↑↓←→ 選択、移動',
    explanation2: 'Z 決定、攻撃　X 取消、中断',
    start: 'スタート', highscore: 'ハイスコア', credit: 'クレジット',
    pause: 'ポーズ', resume: 'ゲームを続ける', restart: '最初からやり直す', returntitle: 'タイトルに戻る',
    stageclear: 'ステージ　クリアー', total: '合計', stage: 'ステージ', time: 'タイム', point: 'スコア', ko: '撃破数',
    gameover: 'ゲームオーバー', continue: 'コンティニュー',
    cast: 'キャスト',
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
class CharacterData {//キャラデータ
    constructor(name, char, color, size, hp, point, routine, forms, options = {}) {
        const { defeatEffect = undefined, isOutOfScreenToRemove = false, } = options;
        this.name = name;
        this.char = char;
        this.color = color;
        this.size = size;
        this.defeatEffect = defeatEffect;
        this.hp = hp;
        this.point = point;
        this.routine = routine;
        this.forms = forms;
        this.isOutOfScreenToRemove = isOutOfScreenToRemove;
    }
}
export const datas = {//ゲームデータ
    unit: {
        defaultSpawnEffect: 'star',
        defaultDefeatEffect: 'star2',
        effects: {
            star: {
                emoji: EMOJI.STAR,
                color: '',
                isRandomAngle: false,
                count: 5,
                rotate: 0,
                isConverge: true,
            },
            star2: {
                emoji: EMOJI.STAR,
                color: 'yellow',
                isRandomAngle: false,
                count: 5,
                rotate: 0,
                isConverge: false,
            },
            feather: {
                emoji: EMOJI.FEATHER,
                color: '',
                isRandomAngle: true,
                count: 7,
                rotate: 360,
                isConverge: false,
            }
        }
    },
    baddies: {
        obake: new CharacterData('obake', EMOJI.GHOST, 'black', 40, 5, 200, 'zako1', [Baddies.form.topsingle]),
        crow: new CharacterData('crow', EMOJI.CROW, '#0B1730', 40, 5, 100, 'zako1', [Baddies.form.v, Baddies.form.delta, Baddies.form.tri, Baddies.form.inverttri, Baddies.form.trail, Baddies.form.abrest, Baddies.form.randomtop], { defeatEffect: 'feather' }),
        dove: new CharacterData('dove', EMOJI.DOVE, '#CBD8E1', 40, 5, 100, 'zako2', [Baddies.form.left, Baddies.form.right, Baddies.form.randomside], { defeatEffect: 'feather' }),
        bigcrow: new CharacterData('bigcrow', EMOJI.CROW, '#0B1730', 80, 20, 100, 'zako3', [Baddies.form.topsingle], { defeatEffect: 'feather' }),
        greatcrow: new CharacterData('greatcrow', EMOJI.CROW, '#0E252F', 120, 100, 2000, 'boss1', [Baddies.form.topsingle], { defeatEffect: 'feather' }),
        torimakicrow: new CharacterData('torimakicrow', EMOJI.CROW, '#0B1730', 40, 10, 200, 'boss1torimaki', [Baddies.form.within], { defeatEffect: 'feather' }),
    },
    player: {
        data: new CharacterData('player', EMOJI.CAT, 'black', 40, 999, 0, '', undefined, { defeatEffect: 'star2' }),
        moveSpeed: 300,
        bulletSpeed: 400,
        firelate: 1 / 20,
        damagedInvincibilityTime: 1,
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
class saveData {
    constructor() {
        this.playdata = {
            total: new scoreData(),
            backup: new scoreData()
        }
        this.highscores = [];
    }
}
export let shared//共用変数
//ゲーム実行
export const game = new Game();
game.start([cfg.font.default, cfg.font.emoji], () => {
    game.setRange(game.width * 0.25);
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

    shared = game.load(cfg.saveData.name) ?? new saveData();
    game.pushScene(new SceneTitle());
});