// Small toy-like scenery for the scattered interests. Coordinates are local to
// a tile, with the ground near y = 12; there are no external image dependencies.
export const LANDMARK_IDS = Object.freeze([
  'battlefield2042', 'dontstarve', 'terraria', 'battlefieldv', 'coding', 'picnic',
]);

export function createLandmark(id, element) {
  if (!LANDMARK_IDS.includes(id)) return null;
  const group = element('g', {
    class: 'cartoon-landmark', 'data-landmark': id, 'pointer-events': 'none',
    stroke: '#566746', 'stroke-width': 2.5, 'stroke-linejoin': 'round', 'stroke-linecap': 'round',
  });
  const add = (tag, attributes, text) => {
    const node = element(tag, attributes, text);
    group.append(node);
    return node;
  };
  const path = (d, fill, extra = {}) => add('path', { d, fill, ...extra });
  const rect = (x, y, width, height, fill, rx = 7, extra = {}) => add('rect', { x, y, width, height, rx, fill, ...extra });
  const circle = (cx, cy, r, fill, extra = {}) => add('circle', { cx, cy, r, fill, ...extra });
  const ellipse = (cx, cy, rx, ry, fill, extra = {}) => add('ellipse', { cx, cy, rx, ry, fill, ...extra });
  ellipse(0, 15, 101, 22, '#92ac67', { opacity: .18, stroke: 'none' });

  if (id === 'battlefield2042') {
    // Orange cargo, reinforced corners, and a friendly four-legged scout robot.
    path('M-95 -83Q-95 -91 -87 -94L-29 -108Q-22 -110 -14 -104L7 -89V-10L-12 5L-87 -2Q-95 -3 -95 -12Z', '#cc8a50', { stroke: '#906f47' });
    path('M-91 -88L-23 -103L2 -88L-68 -71Z', '#f3bd76', { stroke: '#b18a53' });
    rect(-93, -77, 79, 79, '#e5a261', 9, { stroke: '#aa7c48' });
    rect(-79, -67, 13, 59, '#edba75', 3, { stroke: 'none' });
    rect(-40, -67, 13, 59, '#edba75', 3, { stroke: 'none' });
    rect(-66, -47, 33, 22, '#f9e9bd', 4, { stroke: '#bb915b' });
    path('M-61 -39H-39M-61 -33H-47', 'none', { stroke: '#c49155', 'stroke-width': 2 });
    path('M20 -36L13 -11L19 8M62 -35L54 -8L61 10', 'none', { stroke: '#5f766a', 'stroke-width': 9 });
    path('M38 -34L42 -12L37 10M79 -35L89 -13L83 11', 'none', { stroke: '#91a691', 'stroke-width': 9 });
    rect(8, -65, 76, 35, '#b4c4a8', 12);
    rect(19, -64, 45, 9, '#d7dec5', 4, { stroke: 'none' });
    circle(25, -42, 8, '#6e8979');
    circle(66, -42, 8, '#6e8979');
    rect(70, -83, 35, 30, '#728b7e', 10);
    rect(84, -75, 17, 11, '#eec885', 4, { stroke: 'none' });
    circle(91, -70, 2.5, '#f8eed1', { stroke: 'none' });
    path('M77 -82L75 -96', 'none', { stroke: '#6c8071', 'stroke-width': 3 });
    circle(75, -98, 4, '#e6a162', { stroke: 'none' });
    for (const x of [17, 36, 60, 82]) rect(x - 7, 8, 16, 6, '#586e62', 3, { stroke: 'none' });
  }

  if (id === 'dontstarve') {
    // A bent pine and campfire evoke the game's wilderness without combat.
    path('M-67 6Q-62 -28 -56 -71Q-52 -110 -68 -147', 'none', { stroke: '#96784d', 'stroke-width': 14 });
    path('M-69 -154Q-62 -127 -39 -111Q-48 -107 -59 -111Q-39 -93 -23 -81Q-42 -76 -59 -86Q-37 -59 -19 -46Q-57 -34 -88 -54Q-74 -63 -69 -80Q-87 -73 -102 -82Q-79 -96 -73 -115Q-89 -109 -97 -115Q-78 -130 -69 -154Z', '#688f58');
    path('M-68 -141Q-60 -116 -45 -108M-66 -98Q-50 -76 -32 -70M-67 -72Q-64 -52 -44 -44', 'none', { stroke: '#90ab69', 'stroke-width': 5 });
    for (const [x, y, angle] of [[7, 17, -22], [24, 23, 13], [48, 24, -7], [69, 18, 20], [79, 7, 40], [-1, 6, -25]]) {
      ellipse(x, y, 13, 8, '#b4b69b', { transform: `rotate(${angle} ${x} ${y})`, stroke: '#929d7e' });
    }
    path('M10 11L67 -3M13 -5L64 13', 'none', { stroke: '#9e7650', 'stroke-width': 13 });
    path('M14 9Q-1 -13 18 -37Q14 -22 24 -18Q39 -48 35 -74Q60 -54 55 -28Q65 -35 66 -46Q88 -9 63 7Q42 24 14 9Z', '#eba65b', { stroke: '#c18a45' });
    path('M29 10Q14 -4 36 -34Q39 -22 43 -19Q48 -31 48 -43Q69 -12 52 9Q43 18 29 10Z', '#f7d878', { stroke: 'none' });
    ellipse(38, 8, 11, 5, '#fff0ad', { stroke: 'none' });
    circle(44, -91, 4, '#f3ca79', { stroke: 'none' });
    circle(62, -69, 2.8, '#f3ca79', { stroke: 'none' });
  }

  if (id === 'terraria') {
    rect(-95, -52, 98, 65, '#b88651', 10, { stroke: '#816741' });
    path('M-95 -48V-56Q-94 -85 -66 -85H-27Q1 -84 3 -56V-48Z', '#d3a66a', { stroke: '#8e7147' });
    path('M-91 -34H-1M-91 -11H-1', 'none', { stroke: '#9d7547', 'stroke-width': 3 });
    rect(-77, -79, 11, 86, '#e8c577', 3, { stroke: '#b59754' });
    rect(-28, -79, 11, 86, '#e8c577', 3, { stroke: '#b59754' });
    rect(-57, -52, 21, 28, '#f0d892', 5, { stroke: '#b49655' });
    circle(-46, -41, 3.5, '#8b7747', { stroke: 'none' });
    path('M-46 -40v7', 'none', { stroke: '#8b7747', 'stroke-width': 3 });
    path('M16 14Q3 -1 13 -26Q17 -51 36 -61Q60 -76 79 -54Q95 -38 94 -7Q107 11 84 19Q51 29 16 14Z', '#7eb8a1', { stroke: '#548b76' });
    path('M26 -36Q39 -59 57 -55Q73 -54 78 -43', 'none', { stroke: '#b2dcc1', 'stroke-width': 7 });
    ellipse(52, 17, 29, 6, '#62a28b', { stroke: 'none', opacity: .55 });
    ellipse(38, -13, 4, 6, '#466b57', { stroke: 'none' });
    ellipse(65, -13, 4, 6, '#466b57', { stroke: 'none' });
    path('M45 -2Q51 4 57 -2', 'none', { stroke: '#4b7a61', 'stroke-width': 2 });
    path('M4 -97L14 -111L27 -98L14 -82Z', '#8fcbb9', { stroke: '#77ac91' });
    path('M14 -108V-85M5 -97H26', 'none', { stroke: '#cae5cf', 'stroke-width': 2 });
  }

  if (id === 'battlefieldv') {
    circle(-60, 14, 20, '#5e6851'); circle(54, 14, 20, '#5e6851');
    circle(-60, 14, 10, '#a7af80'); circle(54, 14, 10, '#a7af80');
    rect(-92, -41, 14, 35, '#87966b', 6);
    path('M-85 -40V-65Q-85 -73 -75 -73H-15L8 -53H71Q87 -53 89 -37V-3Q89 6 78 6H-73Q-85 6 -85 -7Z', '#a5b17c');
    rect(-72, -102, 59, 50, '#899c7c', 7);
    rect(-66, -95, 46, 35, '#bfd4bc', 4, { stroke: '#6f8468' });
    path('M-43 -94V-60M-70 -52H-18', 'none', { stroke: '#869775', 'stroke-width': 3 });
    path('M-15 -93H31Q38 -93 42 -85L54 -55', 'none', { stroke: '#718566', 'stroke-width': 5 });
    rect(15, -65, 67, 29, '#b5be88', 8);
    rect(73, -39, 15, 29, '#7f946b', 4);
    for (let x = 77; x < 86; x += 4) path(`M${x} -33V-16`, 'none', { stroke: '#b8c391', 'stroke-width': 2 });
    circle(67, -24, 7, '#f4d99c', { stroke: '#84926a' });
    rect(67, 1, 29, 8, '#d1c6a0', 4);
    path('M-74 -35H-24V-6M-39 -27h10', 'none', { stroke: '#7c9268', 'stroke-width': 3 });
    rect(-4, -88, 38, 31, '#bf9e68', 5, { stroke: '#977d53' });
    path('M14 -84V-61M0 -73H30', 'none', { stroke: '#e2ca8f', 'stroke-width': 4 });
    circle(-89, -25, 14, '#68765a'); circle(-89, -25, 7, '#aeb987');
  }

  if (id === 'coding') {
    rect(-88, -109, 131, 91, '#c5cbb3', 10, { stroke: '#788c72' });
    rect(-78, -99, 111, 69, '#57796c', 5, { stroke: 'none' });
    circle(-24, -104, 2, '#829482', { stroke: 'none' });
    path('M-61 -81l-7 6l7 6M-47 -83l-7 17M-40 -81l7 6l-7 6', 'none', { stroke: '#e8cd8e', 'stroke-width': 3 });
    path('M-66 -55H-21M-57 -46H3M-17 -75H13M-17 -66H5', 'none', { stroke: '#a9c7ab', 'stroke-width': 4 });
    path('M-88 -21H43L62 9Q63 17 52 18H-100Q-110 17 -108 10Z', '#dadbc2', { stroke: '#869779' });
    path('M-75 -11H29M-82 -3H35', 'none', { stroke: '#9eac92', 'stroke-width': 3 });
    rect(-42, 3, 34, 9, '#b7c3a6', 3, { stroke: '#a3b494', 'stroke-width': 1 });
    ellipse(72, 2, 29, 25, '#edce75', { stroke: '#b69c57' });
    circle(77, -29, 21, '#f2d888', { stroke: '#bca563' });
    path('M95 -32L110 -25L94 -20Z', '#df9d58', { stroke: '#bd8c4c' });
    circle(83, -33, 3.3, '#716946', { stroke: 'none' });
    circle(84, -34, 1, '#fff4ce', { stroke: 'none' });
    path('M61 -1Q73 -9 83 4Q75 13 62 10', '#e4bd63', { stroke: '#c5a354', 'stroke-width': 2 });
    path('M47 2Q36 -6 44 -15Q53 -11 57 -4', '#edce75', { stroke: '#b69c57' });
  }

  if (id === 'picnic') {
    path('M-107 -7Q-113 -13 -105 -17L-23 -66Q-17 -69 -9 -65L107 -4Q114 1 106 6L23 49Q18 53 10 49Z', '#edc7a0', { stroke: '#b49970' });
    path('M-86 -29L48 35M-57 -47L77 19M-66 13L18 -49M-21 34L65 -25', 'none', { stroke: '#f8e7be', 'stroke-width': 12, opacity: .86 });
    rect(-71, -67, 76, 52, '#c99270', 12, { stroke: '#a17f58' });
    rect(-76, -76, 86, 20, '#efd7a2', 9, { stroke: '#b69b6b' });
    rect(-38, -59, 17, 26, '#d9b27a', 4, { stroke: '#b08e5d' });
    path('M-63 -67H-2', 'none', { stroke: '#faf0ca', 'stroke-width': 4 });
    rect(43, -77, 66, 56, '#dbc38b', 11, { stroke: '#a58e60' });
    path('M56 -77V-86Q56 -92 64 -92H85Q94 -92 94 -84V-77', 'none', { stroke: '#9b8860', 'stroke-width': 5 });
    circle(63, -47, 14, '#c7ac73', { stroke: '#a58e60' });
    for (const x of [57, 63, 69]) path(`M${x} -56V-38`, 'none', { stroke: '#917c55', 'stroke-width': 1.5 });
    rect(85, -63, 14, 10, '#8fa899', 3, { stroke: 'none' });
    circle(91, -38, 5, '#f2e1b5', { stroke: '#ad9769' });
    path('M99 -79L108 -110', 'none', { stroke: '#a0aa8b', 'stroke-width': 3 });
    circle(109, -112, 3, '#c2c9aa', { stroke: 'none' });
    rect(-101, -58, 21, 57, '#9bbbaa', 8, { stroke: '#759880' });
    rect(-102, -62, 23, 14, '#e6dbb0', 5, { stroke: '#a6a785' });
    ellipse(14, 8, 18, 10, '#f5e6bc', { stroke: '#c0b486' });
    circle(9, 3, 7, '#a9b67a', { stroke: 'none' });
    circle(21, 7, 6, '#d69b6e', { stroke: 'none' });
  }
  return group;
}
