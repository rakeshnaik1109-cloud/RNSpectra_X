/* ═══════════════════════════════════════════════════════════
   presence.js — live "using now" counts (shared by RNBeamX,
   RNSpectraX and the homepage)

   Supabase Realtime presence over one WebSocket (Phoenix channel
   protocol, vsn 1.0.0). An app tab joins its channel with a random
   key made when the tab opens and forgotten when it closes; nothing
   else is sent, and no file or figure ever leaves the browser.
   A page that only shows the numbers (the homepage) joins without
   tracking, so it is not counted. If the service cannot be reached
   the count stays hidden: it never shows a guessed number.
═══════════════════════════════════════════════════════════ */
(function () {
'use strict';
var CFG = {
  url: 'wss://eetgrnnvkgfweoolxygq.supabase.co/realtime/v1/websocket',
  key: 'sb_publishable_HbWB2u7244OlcsNrXRCoYA_V1vt5iVA',   // publishable key: meant for public pages
};
var P = window.RNPresence = window.RNPresence || {};
P.config = CFG;

/* watch(channel, onCount, { track }) — onCount(n) with the number of open tabs,
   or onCount(null) while disconnected. Returns { stop }. */
P.watch = function (channel, onCount, opt) {
  opt = opt || {};
  if (!('WebSocket' in window) || !channel) return { stop: function () {} };
  var topic = 'realtime:' + channel, ws = null, ref = 0, joinRef = null, hb = null, retry = 0, stopped = false, members = {};
  var me = (window.crypto && crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now()).replace(/-/g, '').slice(0, 16);
  var send = function (m) { if (!ws || ws.readyState !== 1) return null; m.ref = String(++ref); ws.send(JSON.stringify(m)); return m.ref; };
  var emit = function () { onCount(Object.keys(members).length); };
  var connect = function () {
    if (stopped) return;
    try { ws = new WebSocket(CFG.url + '?apikey=' + encodeURIComponent(CFG.key) + '&vsn=1.0.0'); } catch (e) { onCount(null); return; }
    ws.onopen = function () {
      members = {};
      joinRef = send({ topic: topic, event: 'phx_join', payload: { config: { broadcast: { ack: false, self: false }, presence: { key: opt.track ? me : '', enabled: true }, private: false } } });
      clearInterval(hb);
      hb = setInterval(function () { send({ topic: 'phoenix', event: 'heartbeat', payload: {} }); }, 25000);
    };
    ws.onmessage = function (e) {
      var m; try { m = JSON.parse(e.data); } catch (err) { return; }
      if (!m || m.topic !== topic) return;
      if (m.event === 'phx_reply' && m.ref === joinRef) {
        if (!m.payload || m.payload.status !== 'ok') { stop(); return; }   // e.g. public channels switched off
        retry = 0;
        if (opt.track) send({ topic: topic, event: 'presence', payload: { type: 'presence', event: 'track', payload: { at: Date.now() } } });
        else emit();
      } else if (m.event === 'presence_state') {
        members = {}; Object.keys(m.payload || {}).forEach(function (k) { members[k] = 1; }); emit();
      } else if (m.event === 'presence_diff') {
        var d = m.payload || {};
        Object.keys(d.leaves || {}).forEach(function (k) { delete members[k]; });
        Object.keys(d.joins || {}).forEach(function (k) { members[k] = 1; });
        emit();
      } else if (m.event === 'phx_error' || m.event === 'phx_close') {
        try { ws.close(); } catch (err) { /* reconnects below */ }
      }
    };
    ws.onclose = function () {
      clearInterval(hb); onCount(null);
      if (!stopped) setTimeout(connect, Math.min(60000, 3000 * Math.pow(2, retry++)));
    };
    ws.onerror = function () { /* onclose follows */ };
  };
  var stop = function () { stopped = true; clearInterval(hb); try { if (ws) ws.close(); } catch (e) { /* closed */ } onCount(null); };
  connect();
  return { stop: stop };
};

/* fill every [data-live-count="channel"] element: hidden until a count arrives */
P.bind = function (channel, opt) {
  var els = function () { return Array.prototype.slice.call(document.querySelectorAll('[data-live-count="' + channel + '"]')); };
  return P.watch(channel, function (n) {
    els().forEach(function (el) {
      if (n == null || (!opt || !opt.track) && n < 1) { el.hidden = true; return; }
      var c = el.querySelector('[data-n]'); if (c) c.textContent = n;
      el.hidden = false;
    });
  }, opt);
};
})();
