//シューティングゲームのようなもの
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

import{cfg,EMOJI,game,Util,Mono,State,waitForFrag,waitForTime,waitForTimeOrFrag,Child,Move,Anime,Ease,Guided,Collision,Brush,Tofu,Moji,Label,Particle,Gauge,OutOfRangeToRemove,OutOfScreenToRemove,Menu,Watch}from  "./youma.js";

class Unit {//ユニットコンポーネント
    static requieds = State;
    constructor() {
        this.reset();
    }
    reset() {
        this.hp = this.maxHp = this.point = this.kocount = 1;
        this.invincible = this.firing = false; //無敵、射撃中
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
        this.owner.addMix(data.isOutOfScreenToRemove ? OutOfScreenToRemove : OutOfRangeToRemove, true);
    }
    resetHp() {
        this.hp = this.maxHp;
    }
    isBanish() {
        return !this.invincible && this.hp > 0;
    }
    banish(damage) {
        this.hp = Math.max(this.hp - damage, 0);
        this.onBanish?.();
        if (this.hp > 0) return;
        this.defeat();
    }
    playEffect(name, x, y) {
        let { emoji, color, isRandomAngle, count, rotate, isConverge } = datas.unit.effects[name] ??= DataTransfer.unit.star2;
        if (!color || color === '') color = this.data.color;
        const size = this.data.size;
        const particleSize = size * (emoji === '' ? 0.2 : 0.5);
        this.scene.effect.emittCircle(count, size * 1.5, size * 0.0125, particleSize, color, x, y, isConverge, { emoji: emoji, isRandomAngle: isRandomAngle, rotate: rotate });
    }
    playSpawnEffect() {
        this.playEffect(datas.unit.defaultSpawnEffect, this.owner.pos.linkX, this.owner.pos.linkY);
    }
    playDefeatEffect() {
        this.playEffect(this.data.defeatEffect === '' ? datas.unit.defaultDefeatEffect : this.data.defeatEffect, this.owner.pos.linkX, this.owner.pos.linkY);
    }
    spawnRequied() {
        this.playSpawnEffect();
        return this.data.size * 0.005;
    }
    defeat() {
        const state = this.owner.state;
        state.start(state.defeat(), 'defeat');
    }
    defeatRequied() {
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
    get hpRatio() { return this.hp / this.maxHp; };
}
class Player extends Mono {//自機
    constructor(bullets, scene) {
        super(State, Move, Moji, Collision, Unit);
        const data = datas.player.data;
        this.state.start(this.stateDefault.call(this, bullets));
        this.moji.set(Util.parseUnicode(data.char), { x: game.width * 0.5, y: game.height - (data.size * 0.5), size: data.size, color: data.color, font: cfg.font.emoji.name, align: 1, valign: 1 });
        this.collision.set(this.pos.width * 0.25, this.pos.height * 0.25);
        this.unit.set(data, scene);
        this.unit.kocount = 0;
        this.unit.onBanish = () => {
            this.state.start(this.stateDamagedInvincible());
        };
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
        ctx.globalAlpha = this.color.alpha;
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
class Baddies extends Mono {//敵キャラ管理
    static form = Object.freeze({ within: 'within', circle: 'circle', v: 'v', delta: 'delta', tri: 'tri', inverttri: 'inverttri', trail: 'trail', abrest: 'abrest', topsingle: 'topsingle', left: 'left', right: 'right', randomtop: 'randomtop', randomside: 'randomside' });
    constructor() {
        super(Child);
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
        };
        const circleform = () => {
            const d = s > 0 ? s : size * 2;
            const deg = 360 / n;
            for (let i = 0; i < n; i++) {
                push(Util.degToX(deg * i) * d, Util.degToY(deg * i) * d);
            }
        };
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
        };
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
        };
        const trailform = () => {
            if (x < 0) x = Util.rand(game.width - size) + size * 0.5;
            for (let i = 0; i < n; i++) {
                push(x, baseY - space * i);
            }
        };
        const abrestform = () => {
            if (x < 0) {
                const w = space * n;
                x = Util.rand(game.width - w) + size * 0.5;
            }
            for (let i = 0; i < n; i++) {
                push(x + (space * i), baseY);
            }
        };
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
        };
        const randomform = (isSide = false) => {
            const X = (isR) => isR ? game.width + size : -size;
            const max = Math.floor(isSide ? (game.height * 0.6) / space : (game.width / space) - 1);
            const ps = Util.randomArray(max, Util.rand(Math.min(n, max), 1));
            for (const p of ps) {
                if (!isSide) {
                    push(space * (p + 1), baseY + -Util.rand(size));
                } else {
                    const r = Util.rand(1);
                    push(X(Boolean(r)) + (r === 1 ? 1 : -1) * Util.rand(size), space * (p + 1));
                }
            }
        };
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
    static spawnType = { within: 0, top: 1, left: 2, right: 3 };
    constructor() {
        super(State, Move, Anime, Moji, Collision, Unit);
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
    whichSpawnType() {
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
    *routineBasicShot(user, pattern, shot) {
        yield* waitForFrag(() => game.isWithinScreen(user.pos.rect)); //画面内に入るまで待機
        yield* waitForTime(Util.rand(60) * game.delta); //ランダムで最大1秒まで待機
        while (true) {
            if (game.isOutOfScreen(user.pos.rect)) yield undefined; //画面外にいるなら射撃しない
            yield* shot(); //射撃
        }
    }
    *routineBasic(user, pattern, moveSpeed, shot) {
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
            };
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
            };
            const killMinions = () => {
                for (const minion of minions) minion?.unit.defeat();
                minions = [];
            };
            const initMinion = (minions, index) => {
                const unit = minions[index].unit;
                unit.onDefeat = () => {
                    minions[index] = undefined;
                };
            };
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
            };
            //撃破エフェクト
            user.state.defeat = function* () {
                killMinions();
                user.state.stopAll('defeat');
                scene.baddiesbullets.child.removeAll();
                const pos = user.pos;
                for (let i = 0; i < 16; i++) {
                    user.unit.playEffect(user.unit.data.defeatEffect, pos.left + Util.rand(pos.width), pos.top + Util.rand(pos.height));
                    yield* waitForTime(1 / 8);
                }
                user.unit.defeatRequied();
            };
            //弾パターン
            const circleShot = function* () {
                const count = 24;
                for (let i = 0; i < 6; i++) {
                    bullets.circle(user.pos.x, user.pos.y, { count: count, offset: ((360 / count) * 0.5) * (i % 2) });
                    yield* waitForTime(0.5);
                }
            };
            const spiralShot = function* () {
                const deg = 360 / 6;
                let degOffset = 0;
                for (let i = 0; i < 16; i++) {
                    for (let j = 0; j < 6; j++) {
                        bullets.mulitWay(user.pos.x, user.pos.y, { deg: (deg * j) + degOffset, count: 1, speed: 100, color: 'orange' });
                    }
                    yield* waitForTime(0.2);
                    degOffset += 18;
                }
            };
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
            };
            const ringShotRepeat = function* () {
                while (true) {
                    yield* ringShot();
                    yield* waitForTime(2);
                }
            };
            const fanShot = function* (count = 3, rangeDeg = 15, radiantSpeed = 180, bulletSpeed = 200) {
                const timeOfs = game.sec;
                for (let i = 0; i < 10; i++) {
                    bullets.mulitWay(user.pos.x, user.pos.y, { deg: 270 + (rangeDeg * Util.degToX((game.sec - timeOfs) * radiantSpeed)), count: count, speed: bulletSpeed, color: 'orange' });
                    yield* waitForTime(0.3);
                }
            };
            const fanShotParallel = function* (count = 3, rangeDeg = 15, radiantSpeed = 180, bulletSpeed = 400) {
                const timeOfs = game.sec;
                for (let i = 0; i < 18; i++) {
                    bullets.mulitWay(user.pos.left, user.pos.y, { deg: 260 + (rangeDeg * Util.degToX((game.sec - timeOfs) * radiantSpeed)), space: 7, count: count, speed: bulletSpeed, color: 'orange' });
                    bullets.mulitWay(user.pos.right, user.pos.y, { deg: 280 + (rangeDeg * Util.degToX((game.sec - timeOfs) * radiantSpeed)), space: 7, count: count, speed: bulletSpeed, color: 'orange' });
                    yield* waitForTime(0.125);
                }
            };
            const guidedShot = function* () {
                for (let j = 0; j < 3; j++) {
                    bullets.mulitWay(user.pos.x, user.pos.y, { deg: 90, space: 25, count: 4, speed: 500, firstSpeed: 0, accelTime: 3, color: 'white', guided: scene.player, guidedSpeed: 2 });
                    yield* waitForTime(1);
                }
            };
            const multiwayShot = function* () {
                while (true) {
                    yield undefined;
                    for (let i = 0; i < 8; i++) {
                        bullets.mulitWay(user.pos.x, user.pos.y, { count: 3, speed: 400, color: 'orange' });
                        yield* waitForTime(0.05);
                    }
                    yield* waitForTime(2);
                }
            };
            //ボスの移動
            const resetPos = function* () {
                yield* user.move.to(game.width * 0.5, game.height * 0.3, 100, { easing: Ease.sineInOut });
            };
            const randPos = function* () {
                const x = Util.rand(game.width - user.pos.width) + (user.pos.width * 0.5);
                const y = Util.rand((game.height * 0.6) - user.pos.height) + (user.pos.height * 0.5);
                yield* user.move.to(x, y, 100, { easing: Ease.sineInOut });
            };
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
    };
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
        super(Child);
        this.child.drawlayer = 'effect';
        this.child.addCreator('bullet', () => new Mono(Guided, Move, Collision, Brush, Bullet));
    }
    firing(x, y, vx, vy, firstSpeed, accelTime, color, damage, point, removeOffscreen) {
        const bullet = this.child.pool('bullet');
        bullet.addMix(removeOffscreen ? OutOfScreenToRemove : OutOfRangeToRemove, true);
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
        super(Child);
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
        super(Child);
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
        this.titleMenu.isExist = false;
        //操作方法
        this.child.add(this.explanation1 = new Label(text.explanation1, game.width * 0.5, game.height - (cfg.fontSize.normal * 2.5), { align: 1, valign: 1 }));
        this.child.add(this.explanation2 = new Label(text.explanation2, game.width * 0.5, game.height - cfg.fontSize.normal, { align: 1, valign: 1 }));
        this.explanation1.isExist = false;
        this.explanation2.isExist = false;
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
        this.explanation1.isExist = true;
        this.explanation2.isExist = true;
        while (true) {
            const result = yield* this.titleMenu.stateSelect();
            if (!result) {
                this.titleMenu.isExist = false;
                this.explanation1.isExist = false;
                this.explanation2.isExist = false;
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
        super(State, Child);
        this.elaps = 0;
        //キャラ
        this.child.add(this.playerside = new Mono(Child));
        this.child.add(this.baddies = new Baddies());
        //弾
        this.child.add(this.playerbullets = new BulletBox());
        this.child.add(this.baddiesbullets = new BulletBox());
        //パーティクル
        this.child.add(this.effect = new Particle());
        this.effect.child.drawlayer = 'effect';
        //UI
        this.child.add(this.ui = new Mono(Child));
        this.ui.child.drawlayer = 'ui';
        this.ui.child.add(this.textScore = new Label(() => `SCORE ${shared.playdata.total.point} KO ${shared.playdata.total.ko}`, 2, 2));
        //this.ui.child.add(this.fpsView = new Label(() => `FPS: ${game.fps}`, game.width - 2, 2, { align: 2 }));
        this.ui.child.add(this.fpsView = new Label(() => `STAGE: ${shared.playdata.total.stage}`, game.width - 2, 2, { align: 2 }));
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
                yield* new SceneClear().stateDefault();
                shared.playdata.total.stage++;
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
        const phaseSec = 30;
        const spawnIntervalFactor = 1 * Math.pow(0.9, shared.playdata.total.stage);
        this.elaps = 0;
        //道中
        while (this.elaps <= phaseSec || this.baddies.child.liveCount > 0) {
            if (this.elaps > phaseSec) {
                yield undefined;
                continue;
            }
            const baddieName = appears[Util.rand(appears.length - 1)];
            const data = datas.baddies[baddieName];
            const formation = data.forms[Util.rand(data.forms.length - 1)];
            const spawnMax = Math.floor(game.width / data.size) - 2;
            const spawnCount = Util.rand(spawnMax);
            this.state.start(this.baddies.formation.call(this.baddies, formation, -1, -1, spawnCount, -1, data.name, 0, this.baddiesbullets, this, 0));
            yield* waitForTime(Util.rand(spawnCount * spawnIntervalFactor * 0.5, spawnIntervalFactor));
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
        super(Child);
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
        super(Child);
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
        const nextStage = new Label(text.nextStage, game.width * 0.5, game.height - (line * 2), { size: cfg.fontSize.medium, align: 1, valign: 1 })
        nextStage.color.blink(0.5);
        this.child.add(nextStage);
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
        super(Child);
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
        super(Child);
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
        super(State, Child);
        this.child.drawlayer = 'ui';
        this.stateId = this.state.start(this.stateScroll());
    }
    *stateDefault() {
        game.pushScene(this);
        while (true) {
            yield undefined;
            if (game.input.isPress('z') || game.input.isPress('x')) break;
            if (this.state.isEnable(this.stateId)) continue;
            break;
        }
        game.popScene();
        return;
    }
    *stateScroll() {
        const header = new Label(text.credit, game.width * 0.5, 0, { size: cfg.fontSize.medium, color: cfg.theme.highlite, align: 1, valign: 1 });
        header.addMix(CreditScroll);
        header.creditscroll.set();
        this.child.add(header);
        yield* waitForTime(1);
        for (const staff of text.staff) {
            const label = new Label(staff, game.width * 0.5, 0, { size: cfg.fontSize.normal, align: 1, valign: 1 });
            label.addMix(CreditScroll);
            label.creditscroll.set();
            this.child.add(label);
            yield* waitForTime(1);
        }
        while (this.child.count > 0) yield undefined;
        yield* waitForTime(1);
    }
}
class CreditScroll {//クレジットのスクロールコンポーネント
    static requieds = Move;
    constructor() {
        return this;
    }
    set(scrolltime = 8) {
        const pos = this.owner.pos;
        pos.y = game.height + pos.valignCollect;
        this.owner.move.set(0, game.height / -scrolltime);
    }
    update() {
        if (this.owner.pos.bottom <= 0) this.owner.remove();
    }
}
const text = {//テキスト
    done: '決定', cancel: '取消',
    title: 'シューティングゲーム', title2: 'のようなもの', presskey: 'Zキーを押してね',
    explanation1: '↑↓←→:選択、移動',
    explanation2: 'Z:決定、攻撃　X:取消、中断',
    nextStage: 'Bキーで次へ',
    start: 'スタート', highscore: 'ハイスコア', credit: 'クレジット',
    pause: 'ポーズ', resume: 'ゲームを続ける', restart: '最初からやり直す', returntitle: 'タイトルに戻る',
    stageclear: 'ステージ　クリア', total: '合計', stage: 'ステージ', time: 'タイム', point: 'スコア', ko: '撃破数',
    gameover: 'ゲームオーバー', continue: 'コンティニュー',
    staff: [
        'プロデューサー　はぐれヨウマ',
        'プログラム　はぐれヨウマ',
        'グラフィック　はぐれヨウマ',
        'テストプレイ　はぐれヨウマ',
    ]
};
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
const datas = {//ゲームデータ
    unit: {
        defaultSpawnEffect: 'star',
        defaultDefeatEffect: 'star2',
        effects: {
            star: {
                emoji: EMOJI.STAR,
                color: 'Yellow',
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
class saveData {//セーブデータ
    constructor() {
        this.playdata = {
            total: new scoreData(),
            backup: new scoreData()
        };
        this.highscores = [];
    }
}
class scoreData {//スコアデータ
    constructor(from) {
        this.stage = from?.stage || 1;
        this.time = from?.time || 0;
        this.point = from?.point || 0;
        this.ko = from?.ko || 0;
    }
}
let shared//セーブデータの変数
//ゲーム実行
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