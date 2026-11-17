// Fetih 1453 - TikTok canlı yayın sunucusu
// TikTok yayınındaki yorum, hediye, beğeni ve takipleri okuyup oyun ekranına iletir.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { WebSocketServer } from 'ws';
import * as TLC from 'tiktok-live-connector';

const Conn =
  TLC.TikTokLiveConnection || TLC.WebcastPushConnection ||
  TLC.default?.TikTokLiveConnection || TLC.default?.WebcastPushConnection;

const PORT = process.env.PORT || 3000;
const SIGN_API_KEY = process.env.SIGN_API_KEY || undefined;

let status = { state: 'idle', user: '', msg: 'Bağlı değil' };
let conn = null;
let wantUser = '';
let retryTimer = null;
let tries = 0;
const streaks = new Map();

// ---------- web sunucusu ----------
const server = http.createServer(async (req, res) => {
  const url = (req.url || '/').split('?')[0];
  if (url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, ...status }));
  }
  if (url === '/' || url === '/index.html') {
    try {
      const html = await readFile(new URL('./index.html', import.meta.url));
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' });
      return res.end(html);
    } catch {
      res.writeHead(500); return res.end('index.html bulunamadı');
    }
  }
  res.writeHead(404); res.end('Bulunamadı');
});

const wss = new WebSocketServer({ server });

function broadcast(obj) {
  const s = JSON.stringify(obj);
  for (const c of wss.clients) if (c.readyState === 1) c.send(s);
}
function setStatus(state, msg) {
  status = { state, user: wantUser, msg };
  broadcast({ type: 'status', ...status });
  console.log(`[durum] ${state}: ${msg}`);
}
function userOf(d) {
  const u = d?.user || d || {};
  const name = u.uniqueId || u.nickname || u.displayId || 'izleyici';
  return { id: String(u.userId || name), name };
}

// ---------- TikTok bağlantısı ----------
async function stop() {
  clearTimeout(retryTimer); retryTimer = null;
  if (conn) {
    const c = conn; conn = null;
    try { await c.disconnect(); } catch {}
  }
}

async function start(user) {
  user = String(user || '').trim().replace(/^@/, '');
  if (!user) return setStatus('error', 'Kullanıcı adı boş');
  await stop();
  wantUser = user; tries = 0; streaks.clear();
  connectNow();
}

function scheduleRetry(sec, msg) {
  clearTimeout(retryTimer);
  setStatus('waiting', `${msg} ${sec} sn sonra tekrar denenecek.`);
  retryTimer = setTimeout(() => { if (wantUser) connectNow(); }, sec * 1000);
}

function connectNow() {
  if (!Conn) return setStatus('error', 'tiktok-live-connector paketi yüklenemedi (npm install çalıştı mı?)');
  const opts = { enableExtendedGiftInfo: true };
  if (SIGN_API_KEY) opts.signApiKey = SIGN_API_KEY;

  let c;
  try { c = new Conn(wantUser, opts); } catch (e) { return setStatus('error', 'Bağlantı kurulamadı: ' + e.message); }
  conn = c;
  setStatus('connecting', `@${wantUser} yayınına bağlanılıyor...`);

  c.on('chat', d => {
    if (c !== conn) return;
    broadcast({ type: 'chat', user: userOf(d).name, text: String(d.comment || '') });
  });

  c.on('gift', d => {
    if (c !== conn) return;
    const u = userOf(d);
    const info = d.extendedGiftInfo || {};
    const det = d.giftDetails || d.gift || {};
    const name = d.giftName || det.giftName || det.name || info.name || 'Hediye';
    const diamonds = Number(d.diamondCount ?? det.diamondCount ?? det.diamond_count ?? info.diamond_count ?? 1) || 1;
    const type = Number(d.giftType ?? det.giftType ?? det.type ?? info.type ?? 0);
    const rc = Number(d.repeatCount || 1);
    let count = rc;
    // Seri (combo) hediyelerde her olayda sadece yeni gelen adedi gönder
    if (type === 1) {
      const key = u.id + ':' + d.giftId;
      const prev = streaks.get(key) || 0;
      count = rc - prev;
      if (d.repeatEnd) streaks.delete(key); else streaks.set(key, rc);
    }
    const img = d.giftPictureUrl || det.giftPictureUrl || det.giftImage?.giftPictureUrl ||
      det.image?.url_list?.[0] || det.image?.urlList?.[0] || info.image?.url_list?.[0] || info.icon?.url_list?.[0] || '';
    if (count > 0) broadcast({ type: 'gift', user: u.name, gift: name, diamonds, count, img });
  });

  c.on('like', d => {
    if (c !== conn) return;
    broadcast({ type: 'like', user: userOf(d).name, count: Number(d.likeCount || 1) });
  });
  c.on('follow', d => { if (c === conn) broadcast({ type: 'follow', user: userOf(d).name }); });
  c.on('share', d => { if (c === conn) broadcast({ type: 'share', user: userOf(d).name }); });

  c.on('streamEnd', () => {
    if (c !== conn) return;
    scheduleRetry(30, 'Yayın bitti.');
  });
  c.on('disconnected', () => {
    if (c !== conn) return;
    tries++;
    scheduleRetry(Math.min(30, 5 * tries), 'Bağlantı koptu.');
  });
  c.on('error', e => console.log('[hata]', e?.message || e));

  c.connect()
    .then(state => {
      if (c !== conn) return;
      tries = 0;
      setStatus('connected', `@${wantUser} yayınına bağlandı${state?.roomId ? ' (oda ' + state.roomId + ')' : ''}`);
      loadGiftList(c);
    })
    .catch(e => {
      if (c !== conn) return;
      console.log('[bağlantı hatası]', e?.message || e);
      // Yayın henüz açık değilse sürekli tekrar dene: yayını açınca kendiliğinden bağlanır
      scheduleRetry(15, `@${wantUser} şu an canlı yayında görünmüyor.`);
    });
}

// ---------- hediye resimleri ----------
let giftList = [];
function loadGiftList(c) {
  const fn = c.fetchAvailableGifts || c.getAvailableGifts;
  if (!fn) return;
  Promise.resolve(fn.call(c)).then(list => {
    const arr = (Array.isArray(list) ? list : list?.gifts || []).map(g => ({
      name: g.name,
      diamonds: g.diamond_count ?? g.diamondCount,
      img: g.image?.url_list?.[0] || g.image?.urlList?.[0] || g.icon?.url_list?.[0] || ''
    })).filter(g => g.name && g.img);
    if (arr.length) { giftList = arr; broadcast({ type: 'gifts', list: arr }); console.log(`[hediyeler] ${arr.length} hediye resmi yüklendi`); }
  }).catch(e => console.log('[hediye listesi alınamadı]', e?.message || e));
}

// ---------- test olayları ----------
function sendTest() {
  const names = ['test_ahmet', 'test_zeynep', 'test_mert', 'test_elif', 'test_can'];
  const ev = [
    ...names.map(n => ({ type: 'chat', user: n, text: 'saldır' })),
    { type: 'gift', user: 'test_zeynep', gift: 'Rose', diamonds: 1, count: 3 },
    { type: 'gift', user: 'test_mert', gift: 'Doughnut', diamonds: 30, count: 1 },
    { type: 'like', user: 'test_elif', count: 15 },
    { type: 'follow', user: 'test_yeni' },
    { type: 'gift', user: 'test_can', gift: 'Hand Hearts', diamonds: 100, count: 1 },
  ];
  ev.forEach((e, i) => setTimeout(() => broadcast(e), i * 400));
}

// ---------- ekrandan gelen komutlar ----------
wss.on('connection', ws => {
  ws.send(JSON.stringify({ type: 'status', ...status }));
  if (giftList.length) ws.send(JSON.stringify({ type: 'gifts', list: giftList }));
  ws.on('message', raw => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (m.type === 'connect') start(m.username);
    if (m.type === 'disconnect') { wantUser = ''; stop().then(() => setStatus('idle', 'Bağlı değil')); }
    if (m.type === 'test') sendTest();
  });
});

server.listen(PORT, () => {
  console.log(`Fetih 1453 çalışıyor: http://localhost:${PORT}`);
  if (process.env.TIKTOK_USERNAME) start(process.env.TIKTOK_USERNAME);
});
