(function (root) {
  "use strict";

  var I = {
    shelf:
      '<rect x="16" y="24" width="88" height="76" rx="8" fill="#fff" stroke="#0F6B50" stroke-width="5"/>' +
      '<path d="M60 24v76M16 62h88" stroke="#0F6B50" stroke-width="5"/>' +
      '<rect x="26" y="34" width="24" height="16" rx="3" fill="#F0B36A"/>' +
      '<path d="M74 86c0-10 6-16 6-16s6 6 6 16" fill="#0F6B50"/>' +
      '<rect x="76" y="84" width="8" height="8" rx="2" fill="#C65A12"/>',
    vacuum:
      '<path d="M48 18h16a8 8 0 0 1 8 8v46H40V26a8 8 0 0 1 8-8z" fill="#0F6B50"/>' +
      '<rect x="44" y="28" width="22" height="8" rx="2" fill="#F6C48A"/>' +
      '<path d="M78 30h16a8 8 0 0 1 0 16H78" fill="none" stroke="#172824" stroke-width="5" stroke-linecap="round"/>' +
      '<rect x="28" y="78" width="56" height="16" rx="8" fill="#172824"/>' +
      '<rect x="36" y="84" width="18" height="5" rx="2" fill="#F6C48A"/>',
    books:
      '<path d="M24 86V34l22-8v60z" fill="#0F6B50"/>' +
      '<path d="M48 28l24 10v52L48 80z" fill="#C65A12"/>' +
      '<path d="M74 40l22-6v52l-22 8z" fill="#1D4E89"/>' +
      '<path d="M30 42h10M54 44h12M80 46h10" stroke="#fff" stroke-width="3" stroke-linecap="round"/>',
    highchair:
      '<rect x="34" y="28" width="52" height="10" rx="4" fill="#C65A12"/>' +
      '<rect x="40" y="40" width="40" height="28" rx="6" fill="#0F6B50"/>' +
      '<path d="M44 68v28M76 68v28M36 88h16M68 88h16" stroke="#172824" stroke-width="5" stroke-linecap="round"/>' +
      '<rect x="30" y="46" width="14" height="8" rx="2" fill="#F6C48A"/>',
    plants:
      '<rect x="22" y="78" width="28" height="22" rx="4" fill="#C65A12"/>' +
      '<rect x="70" y="82" width="26" height="18" rx="4" fill="#0F6B50"/>' +
      '<path d="M36 78c0-22 16-36 8-52 18 8 20 28 8 52z" fill="#1F8A62"/>' +
      '<path d="M30 78c-2-16 8-28 2-40 12 6 16 22 12 40z" fill="#0F6B50"/>' +
      '<circle cx="84" cy="62" r="16" fill="#7DCAA8"/>' +
      '<circle cx="74" cy="50" r="12" fill="#0F6B50"/>' +
      '<circle cx="96" cy="52" r="10" fill="#147A58"/>',
    rackets:
      '<g transform="rotate(-28 46 58)">' +
      '<ellipse cx="46" cy="40" rx="16" ry="22" fill="none" stroke="#0F6B50" stroke-width="5"/>' +
      '<path d="M46 62v36" stroke="#0F6B50" stroke-width="5" stroke-linecap="round"/>' +
      '<path d="M34 40h24M40 28c6 8 6 16 0 24M52 28c-6 8-6 16 0 24" stroke="#0F6B50" stroke-width="2"/>' +
      "</g>" +
      '<g transform="rotate(24 78 58)">' +
      '<ellipse cx="78" cy="42" rx="14" ry="20" fill="none" stroke="#C65A12" stroke-width="5"/>' +
      '<path d="M78 62v34" stroke="#C65A12" stroke-width="5" stroke-linecap="round"/>' +
      "</g>" +
      '<path d="M18 30l8 4-8 4 2-4z" fill="#F0B36A"/>',
    desk:
      '<rect x="18" y="48" width="84" height="10" rx="3" fill="#C65A12"/>' +
      '<path d="M28 58v34M92 58v34" stroke="#172824" stroke-width="6" stroke-linecap="round"/>' +
      '<rect x="42" y="28" width="36" height="22" rx="3" fill="#0F6B50"/>' +
      '<rect x="54" y="50" width="12" height="6" fill="#172824"/>',
    rice:
      '<ellipse cx="60" cy="78" rx="34" ry="16" fill="#0F6B50"/>' +
      '<path d="M28 70c0-22 14-36 32-36s32 14 32 36" fill="#147A58"/>' +
      '<path d="M36 48c6-16 42-16 48 0" fill="none" stroke="#F6C48A" stroke-width="5" stroke-linecap="round"/>' +
      '<path d="M48 30c0-8 4-12 4-18M64 28c0-8 5-10 4-18" fill="none" stroke="#C65A12" stroke-width="3" stroke-linecap="round"/>' +
      '<circle cx="78" cy="66" r="4" fill="#F6C48A"/>',
    curtains:
      '<rect x="24" y="22" width="72" height="8" rx="3" fill="#172824"/>' +
      '<path d="M26 30c8 8 8 62 0 70h22c6-18 6-52 0-70z" fill="#0F6B50"/>' +
      '<path d="M72 30c8 8 8 62 0 70h22c6-18 6-52 0-70z" fill="#1D4E89"/>' +
      '<rect x="52" y="36" width="16" height="40" rx="2" fill="#D7E7F8"/>',
    games:
      '<rect x="28" y="36" width="52" height="36" rx="6" fill="#0F6B50"/>' +
      '<rect x="40" y="48" width="48" height="32" rx="6" fill="#C65A12"/>' +
      '<rect x="22" y="58" width="18" height="18" rx="4" fill="#fff" stroke="#172824" stroke-width="3"/>' +
      '<circle cx="28" cy="64" r="1.6" fill="#172824"/>' +
      '<circle cx="34" cy="70" r="1.6" fill="#172824"/>' +
      '<rect x="78" y="70" width="18" height="18" rx="4" fill="#fff" stroke="#172824" stroke-width="3"/>' +
      '<circle cx="87" cy="79" r="1.8" fill="#172824"/>',
    bicycle:
      '<circle cx="36" cy="78" r="16" fill="none" stroke="#172824" stroke-width="5"/>' +
      '<circle cx="88" cy="78" r="16" fill="none" stroke="#172824" stroke-width="5"/>' +
      '<path d="M36 78l22-32h22l8 32M58 46l14 32H36" fill="none" stroke="#0F6B50" stroke-width="5" stroke-linejoin="round"/>' +
      '<path d="M58 46h-14" stroke="#C65A12" stroke-width="5" stroke-linecap="round"/>' +
      '<circle cx="58" cy="46" r="3" fill="#C65A12"/>',
    airfryer:
      '<rect x="30" y="26" width="60" height="70" rx="16" fill="#172824"/>' +
      '<rect x="40" y="40" width="40" height="36" rx="8" fill="#F4F1EA"/>' +
      '<circle cx="60" cy="34" r="5" fill="#F0B36A"/>' +
      '<path d="M48 86h24" stroke="#0F6B50" stroke-width="5" stroke-linecap="round"/>',
    boxes:
      '<rect x="26" y="62" width="68" height="28" rx="4" fill="#0F6B50"/>' +
      '<rect x="34" y="40" width="56" height="24" rx="4" fill="#C65A12"/>' +
      '<rect x="42" y="22" width="40" height="20" rx="4" fill="#F0B36A"/>' +
      '<path d="M26 72h68M34 50h56" stroke="#fff" stroke-width="3" opacity=".7"/>',
    rack:
      '<path d="M24 30l16 68M96 30L80 98M30 48h60M36 66h48M42 84h36" stroke="#0F6B50" stroke-width="5" stroke-linecap="round"/>' +
      '<path d="M22 30h76" stroke="#C65A12" stroke-width="6" stroke-linecap="round"/>',
    fan:
      '<circle cx="60" cy="46" r="26" fill="none" stroke="#0F6B50" stroke-width="5"/>' +
      '<circle cx="60" cy="46" r="5" fill="#C65A12"/>' +
      '<path d="M60 46c10-18 22-8 16 2M60 46c18 8 8 22-4 16M60 46C42 62 32 48 42 36" fill="#7DCAA8" stroke="#0F6B50" stroke-width="2"/>' +
      '<path d="M60 72v22M44 100h32" stroke="#172824" stroke-width="5" stroke-linecap="round"/>',
    mugs:
      '<rect x="22" y="40" width="32" height="36" rx="6" fill="#0F6B50"/>' +
      '<path d="M54 50h8a10 10 0 0 1 0 20h-8" fill="none" stroke="#0F6B50" stroke-width="5"/>' +
      '<rect x="62" y="48" width="30" height="32" rx="6" fill="#C65A12"/>' +
      '<path d="M92 56h6a8 8 0 0 1 0 16h-6" fill="none" stroke="#C65A12" stroke-width="5"/>' +
      '<path d="M30 40c4-10 12-10 16 0" fill="none" stroke="#F0B36A" stroke-width="3" stroke-linecap="round"/>',
    chair:
      '<path d="M40 22h28a8 8 0 0 1 8 8v28H36V30a8 8 0 0 1 4-8z" fill="#0F6B50"/>' +
      '<rect x="32" y="58" width="56" height="12" rx="6" fill="#172824"/>' +
      '<path d="M40 70v22M80 70v22M34 92h16M74 92h16" stroke="#172824" stroke-width="5" stroke-linecap="round"/>' +
      '<rect x="46" y="32" width="16" height="16" rx="3" fill="#F6C48A"/>',
    cards:
      '<rect x="30" y="28" width="48" height="64" rx="6" fill="#fff" stroke="#0F6B50" stroke-width="4" transform="rotate(-8 54 60)"/>' +
      '<rect x="42" y="24" width="48" height="64" rx="6" fill="#fff" stroke="#C65A12" stroke-width="4"/>' +
      '<path d="M58 46h16M54 58h24M58 70h16" stroke="#0F6B50" stroke-width="3" stroke-linecap="round"/>',
    other:
      '<path d="M30 44h60l-6 52H36z" fill="#0F6B50"/>' +
      '<path d="M30 44c0-12 14-18 30-18s30 6 30 18" fill="none" stroke="#C65A12" stroke-width="5"/>' +
      '<path d="M60 62v16M52 70h16" stroke="#F6C48A" stroke-width="4" stroke-linecap="round"/>'
  };

  function svg(name) {
    var inner = I[name] || I.other;
    return (
      '<svg viewBox="0 0 120 120" aria-hidden="true" focusable="false">' +
      inner +
      "</svg>"
    );
  }

  function logo() {
    return (
      '<svg class="logo" viewBox="0 0 32 32" aria-hidden="true" focusable="false">' +
      '<rect width="32" height="32" rx="8" fill="#0F6B50"/>' +
      '<rect x="6.5" y="7" width="8" height="8" rx="1.6" fill="#F4F1EA"/>' +
      '<rect x="17.5" y="7" width="8" height="8" rx="1.6" fill="#F6C48A"/>' +
      '<rect x="6.5" y="18" width="8" height="8" rx="1.6" fill="#F6C48A"/>' +
      '<rect x="17.5" y="18" width="8" height="8" rx="1.6" fill="#F4F1EA"/>' +
      "</svg>"
    );
  }

  function hero() {
    return (
      '<svg class="hero-art" viewBox="0 0 640 460" role="img" aria-label="A small block of flats with warm windows and plants at the entrance">' +
      '<rect width="640" height="460" rx="28" fill="#E5F4EE"/>' +
      '<circle cx="520" cy="84" r="36" fill="#F6C48A"/>' +
      '<ellipse cx="320" cy="400" rx="240" ry="28" fill="#CFE3D6"/>' +
      '<rect x="150" y="120" width="340" height="250" rx="16" fill="#0F6B50"/>' +
      '<rect x="176" y="148" width="54" height="42" rx="6" fill="#F7F3EA"/>' +
      '<rect x="248" y="148" width="54" height="42" rx="6" fill="#F6C48A"/>' +
      '<rect x="320" y="148" width="54" height="42" rx="6" fill="#F7F3EA"/>' +
      '<rect x="392" y="148" width="54" height="42" rx="6" fill="#F6C48A"/>' +
      '<rect x="176" y="214" width="54" height="42" rx="6" fill="#F6C48A"/>' +
      '<rect x="248" y="214" width="54" height="42" rx="6" fill="#F7F3EA"/>' +
      '<rect x="320" y="214" width="54" height="42" rx="6" fill="#F6C48A"/>' +
      '<rect x="392" y="214" width="54" height="42" rx="6" fill="#F7F3EA"/>' +
      '<rect x="286" y="286" width="68" height="84" rx="8" fill="#F4E2C8"/>' +
      '<circle cx="338" cy="330" r="4" fill="#C65A12"/>' +
      '<rect x="118" y="300" width="28" height="70" rx="8" fill="#147A58"/>' +
      '<circle cx="132" cy="286" r="26" fill="#1F8A62"/>' +
      '<rect x="492" y="318" width="36" height="28" rx="6" fill="#C65A12"/>' +
      '<path d="M498 318c8-28 28-28 32 0" fill="#0F6B50"/>' +
      "</svg>"
    );
  }

  function icon(name) {
    var paths = {
      search: '<circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16 16l5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
      menu: '<path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
      plus: '<path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
      chat: '<path d="M5 16.5V7.5A2.5 2.5 0 0 1 7.5 5h9A2.5 2.5 0 0 1 19 7.5v6A2.5 2.5 0 0 1 16.5 16H9l-4 3z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
      user: '<circle cx="12" cy="9" r="3.2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M6 19c1.2-2.6 3.2-3.8 6-3.8S16.8 16.4 18 19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
      home: '<path d="M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-5v-5H10v5H5a1 1 0 0 1-1-1z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
      shield: '<path d="M12 3.5 19 6.5v5.2c0 4.2-2.8 6.8-7 8.8-4.2-2-7-4.6-7-8.8V6.5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
      feed: '<rect x="4" y="5" width="7" height="7" rx="1.5" fill="currentColor"/><rect x="13" y="5" width="7" height="7" rx="1.5" fill="currentColor"/><rect x="4" y="14" width="7" height="6" rx="1.5" fill="currentColor"/><rect x="13" y="14" width="7" height="6" rx="1.5" fill="currentColor"/>'
    };
    return (
      '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
      (paths[name] || "") +
      "</svg>"
    );
  }

  root.BBArt = { svg: svg, logo: logo, hero: hero, icon: icon };
})(typeof globalThis !== "undefined" ? globalThis : this);
