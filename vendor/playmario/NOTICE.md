# PlayMario browser remake

Source: https://github.com/PlayMario/HTML5_Client
Upstream demo: https://playmario.github.io/HTML5_Client/
Pinned revision: 51d9c404db8b6f85104c9dff36e92f940b97cce7

These game files come from the community HTML5 remake. One compatibility patch
in References/ObjectMakr-0.2.2.js replaces the empty `new Function` constructor
with an equivalent `function(){}` literal, preserving strict CSP without eval.
Other vendored game files are unchanged.
Mario, associated games and media are Nintendo property. This fan project is
not affiliated with Nintendo. Upstream provides no root license file; we do not
claim a permissive license or relicense these files. Original code comments and
notices are retained.

Pocket Pilot supplies its own direct bootstrap, controlled clock, model adapter,
inspector and canvas HUD outside this directory. Upstream index.js, offline
manifest iframe, service worker and standalone UI are not included or executed.
Only MP3 audio is included. No ROM is required.
