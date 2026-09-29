// The same little game world sits behind the portraits on the map and in the album.
const NS = 'http://www.w3.org/2000/svg';
const node = (tag, attrs = {}, text) => {
  const element = document.createElementNS(NS, tag);
  for (const [name, value] of Object.entries(attrs)) element.setAttribute(name, value);
  if (text !== undefined) element.textContent = text;
  return element;
};
const path = (d, fill, attrs = {}) => node('path', { d, fill, ...attrs });
const group = (parent, attrs = {}) => {
  const result = node('g', attrs); parent.append(result); return result;
};

function pine(parent, x, y, scale = 1) {
  const tree = group(parent, { transform: `translate(${x} ${y}) scale(${scale})` });
  tree.append(path('M0 0V-24', 'none', { stroke: '#776c4b', 'stroke-width': 3 }),
    path('M-13 -9Q-6 -16 -8 -20L-15 -18Q-3 -29 0 -39Q5 -28 14 -22L8 -23Q10 -15 17 -10L9 -11L12 -4Q4 -7 0 -5Q-8 -5 -13 -9Z', '#879968', { stroke: '#697c52', 'stroke-width': 1.4 }),
    path('M-3 -11L0 -29M0 -15L8 -13', 'none', { stroke: '#b7c18b', 'stroke-width': 1.4 }));
}

function flag(parent, x, y, color, mark) {
  const banner = group(parent, { transform: `translate(${x} ${y})` });
  banner.append(path('M0 0L0 -53', 'none', { stroke: '#8e7650', 'stroke-width': 2.4 }),
    node('circle', { cx: 0, cy: -54, r: 2.8, fill: '#c8a568' }),
    path('M1 -49Q13 -55 28 -46L28 -21Q14 -29 1 -23Z', color, { stroke: '#8c7854', 'stroke-width': 1.2 }),
    node('text', { x: 14, y: -32, 'text-anchor': 'middle', 'font-size': 12, fill: '#fff5d7', stroke: 'none', 'font-family': 'serif' }, mark));
}

function qinCity(parent) {
  const city = group(parent, { transform: 'translate(117 131)', 'data-scenery': 'qin-city' });
  // A wall climbing the hills leads into the tiled gatehouse.
  city.append(path('M-98 0L-78 -14L-58 -8L-36 -22L-13 -17L-9 0L-35 -5L-58 9L-78 3L-98 17Z', '#d3c18f', { stroke: '#98845d', 'stroke-width': 1.5 }),
    path('M-98 0L-98 -7L-91 -11L-91 -5L-83 -10L-83 -16L-76 -20L-70 -18L-70 -11L-61 -8L-61 -16L-54 -20L-48 -18L-48 -13L-40 -18L-40 -24L-33 -28L-26 -26L-26 -20L-13 -17', 'none', { stroke: '#a48c60', 'stroke-width': 3 }),
    path('M-91 8L-84 4M-76 -3L-68 0M-52 0L-43 -6', 'none', { stroke: '#b1a074', 'stroke-width': 1.5 }),
    path('M-34 -31L32 -29L34 18Q0 27 -36 17Z', '#d2bd91', { stroke: '#8e7854', 'stroke-width': 1.7 }),
    path('M-13 22L-13 -1Q0 -20 13 -1L13 22', '#867250', { stroke: '#8e7854', 'stroke-width': 1.4 }),
    path('M-30 -52L27 -52L29 -28L-30 -28Z', '#a46949', { stroke: '#805c44', 'stroke-width': 1.6 }),
    path('M-43 -28Q-32 -32 -30 -42L29 -42Q33 -31 43 -28Q1 -18 -43 -28Z', '#788575', { stroke: '#5c6b5d', 'stroke-width': 1.8 }),
    path('M-39 -52Q-20 -55 -8 -68L9 -68Q21 -57 37 -53Q7 -44 -39 -52Z', '#84927c', { stroke: '#5c6b5d', 'stroke-width': 1.8 }),
    path('M-23 -37L-22 -31M-9 -38L-8 -29M7 -38L8 -29M22 -37L24 -30M-14 -54L-7 -61M1 -53L1 -61M15 -54L8 -61', 'none', { stroke: '#b9bea0', 'stroke-width': 1.3 }),
    path('M-19 -46V-41M0 -47V-42M19 -46V-41', 'none', { stroke: '#efcb91', 'stroke-width': 3 }));
  flag(city, -34, -24, '#b88164', '秦');
}

function gaulVillage(parent) {
  const village = group(parent, { 'data-scenery': 'gaul-village' });
  for (const [x, y, scale] of [[355, 143, .85], [412, 161, .67]]) {
    const house = group(village, { transform: `translate(${x} ${y}) scale(${scale})` });
    house.append(node('ellipse', { cx: 0, cy: 4, rx: 36, ry: 9, fill: '#827958', opacity: .13, stroke: 'none' }),
      path('M-29 -23L-27 4Q0 18 28 4L30 -23Z', '#d9c89b', { stroke: '#8d7e58', 'stroke-width': 1.7 }),
      path('M-40 -22Q-23 -34 -3 -60Q18 -44 38 -23Q5 -10 -40 -22Z', '#b9a370', { stroke: '#8f7b51', 'stroke-width': 1.7 }),
      path('M-25 -23L-3 -53M-11 -20L-2 -51M3 -19L-1 -51M18 -20L1 -49M28 -23L4 -47', 'none', { stroke: '#dbc698', 'stroke-width': 1.4 }),
      path('M-8 11L-8 -6Q0 -15 8 -6L8 11Z', '#827451'),
      path('M-22 -5V2M21 -5V2', 'none', { stroke: '#a18a5d', 'stroke-width': 2 }));
  }
  const mine = group(village, { transform: 'translate(299 93)', 'data-scenery': 'mine' });
  mine.append(path('M-35 15L-21 -12L-7 -6L4 -28L17 -10L28 -5L36 17Z', '#a6ad91', { stroke: '#7c896b', 'stroke-width': 1.6 }),
    path('M-7 -6L4 -28L17 -10L7 -14L3 -8Z', '#e3e3c7', { stroke: 'none' }),
    path('M-12 17V0Q1 -15 14 0V17Z', '#6e7357', { stroke: '#9d8456', 'stroke-width': 4 }),
    path('M-6 13L-14 29M8 13L16 29M-8 20H11M-11 25H14', 'none', { stroke: '#a28d64', 'stroke-width': 2 }));
  flag(village, 385, 102, '#80936e', 'G');
}

function civilization(svg) {
  svg.append(path('M8 211Q28 125 99 110Q145 18 218 64Q306 3 378 72Q455 91 471 206L434 291Q246 341 42 290Z', '#e4e6cb', { stroke: 'none', opacity: .7 }),
    path('M19 143Q67 105 119 139Q173 88 222 125Q286 71 335 113Q404 77 467 142', 'none', { stroke: '#c6cfad', 'stroke-width': 19, opacity: .7 }));
  const fields = group(svg, { 'data-scenery': 'hex-lands', stroke: '#bbbd91', 'stroke-width': 1.2 });
  const colors = ['#c8d4a7', '#d8dcb2', '#dfd5a7', '#bdd0ac'];
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 6; col++) {
      const x = 45 + col * 70 + (row % 2) * 35, y = 139 + row * 34;
      if (x > 442 || (row === 4 && (col === 0 || col === 5))) continue;
      fields.append(path(`M${x-35} ${y}L${x-17} ${y-22}L${x+17} ${y-22}L${x+35} ${y}L${x+17} ${y+22}L${x-17} ${y+22}Z`, colors[(row * 3 + col) % colors.length]));
    }
  }
  svg.append(path('M233 103Q260 146 237 172Q215 194 252 219Q280 245 250 292', 'none', { stroke: '#96beb0', 'stroke-width': 19 }),
    path('M230 111Q256 146 234 171M243 212Q273 240 253 276', 'none', { stroke: '#d6e6ca', 'stroke-width': 3 }));
  for (const [x, y, scale] of [[29,174,.9],[54,165,.7],[444,217,1.1],[422,235,.8],[196,107,.8],[217,110,.55]]) pine(svg, x, y, scale);
  qinCity(svg); gaulVillage(svg);
  const alliance = group(svg, { transform: 'translate(238 54)', 'data-scenery': 'alliance-flags' });
  alliance.append(path('M-15 23L8 -14M15 23L-8 -14', 'none', { stroke: '#9b8157', 'stroke-width': 2.5 }),
    path('M-8 -14L-32 -10L-25 0L-30 9L-18 4Z', '#b58065', { stroke: '#957653', 'stroke-width': 1.4 }),
    path('M8 -14L31 -10L26 0L30 9L18 4Z', '#879968', { stroke: '#76815a', 'stroke-width': 1.4 }),
    node('circle', { cx: 0, cy: 17, r: 10, fill: '#f2d990', stroke: '#ac8b50', 'stroke-width': 1.5 }),
    path('M-5 17L-1 21L6 13', 'none', { stroke: '#9b7a45', 'stroke-width': 2 }));
  // Harvest marks make the hexes feel like a worked Civilization map.
  for (const [x,y] of [[86,213],[157,179],[356,217]]) {
    svg.append(path(`M${x-9} ${y+3}l8 -7m-2 11l8 -7m-2 11l8 -7`, 'none', { stroke: '#b69d62', 'stroke-width': 2 }));
  }
}

function tower(parent, x, y, team, scale = 1) {
  const tower = group(parent, { transform: `translate(${x} ${y}) scale(${scale})`, 'data-scenery': 'defense-tower' });
  const color = team === 'blue' ? '#8baeb1' : '#c69791';
  tower.append(node('ellipse', { cx: 0, cy: 3, rx: 17, ry: 6, fill: '#778763', opacity: .18, stroke: 'none' }),
    path('M-14 0L-9 -8L-7 -31L7 -31L10 -8L14 0Q0 8 -14 0Z', '#e4d7b4', { stroke: '#998763', 'stroke-width': 1.5 }),
    path('M-12 -28L-13 -37L-8 -40L-5 -36L0 -41L5 -36L9 -40L13 -36L11 -28Z', color, { stroke: '#807e66', 'stroke-width': 1.5 }),
    path('M0 -50L7 -43L0 -35L-7 -43Z', color, { stroke: '#807e66', 'stroke-width': 1.3 }),
    path('M-2 -26L-3 -12M-8 -7H8', 'none', { stroke: '#b8a37d', 'stroke-width': 2 }));
}

function crystal(parent, x, y, team) {
  const color = team === 'blue' ? '#88b9c0' : '#d4a0aa', light = team === 'blue' ? '#cae2d8' : '#f2c8c6';
  const base = group(parent, { transform: `translate(${x} ${y})`, 'data-scenery': 'base-crystal' });
  base.append(node('ellipse', { cx: 0, cy: 5, rx: 28, ry: 11, fill: '#dad4b1', stroke: '#9f9670', 'stroke-width': 1.7 }),
    node('ellipse', { cx: 0, cy: 0, rx: 22, ry: 8, fill: '#ede5c7', stroke: '#b2a780', 'stroke-width': 1.2 }),
    path('M0 -48L16 -27L11 -3L0 4L-12 -3L-17 -28Z', color, { stroke: '#868e7c', 'stroke-width': 1.7 }),
    path('M0 -47L2 -20L0 3L-12 -3L-17 -28Z', light, { stroke: 'none' }),
    path('M-16 -27L2 -20L16 -27M2 -20L0 3', 'none', { stroke: '#f2edce', 'stroke-width': 1.3 }));
}

function brush(parent, x, y, scale = 1) {
  parent.append(path('M-19 0L-21 -8L-15 -5L-13 -17L-7 -9L-2 -20L2 -9L8 -17L10 -5L17 -13L16 -3L21 0Q0 8 -19 0Z', '#819b6e', { transform: `translate(${x} ${y}) scale(${scale})`, stroke: '#6e895e', 'stroke-width': 1.3 }));
}

function kingsCanyon(svg) {
  svg.append(path('M27 175Q19 98 79 68Q151 26 239 49Q329 22 407 75Q464 115 455 220Q431 304 247 312Q80 320 35 259Z', '#d4ddbd', { stroke: '#b2c399', 'stroke-width': 2 }),
    path('M61 248Q33 158 78 100Q151 58 228 77L407 84Q445 164 416 249Q322 289 240 273L61 248Z', '#b6c899', { stroke: '#a8bb8f', 'stroke-width': 1.5 }));
  const lanes = group(svg, { fill: 'none', stroke: '#e9ddbb', 'stroke-width': 17, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'data-scenery': 'three-lanes' });
  lanes.append(path('M69 256L79 111Q85 90 111 89L407 89', 'none'),
    path('M70 258L238 178L407 88', 'none'),
    path('M70 258L371 265Q402 266 410 235L408 90', 'none'));
  svg.append(path('M57 135Q136 135 181 176Q229 217 290 214Q356 211 423 243', 'none', { stroke: '#8fbfb8', 'stroke-width': 29, 'stroke-linecap': 'round' }),
    path('M64 129Q132 131 176 168M200 193Q239 215 280 208M324 213Q370 215 411 237', 'none', { stroke: '#d0e4cf', 'stroke-width': 3, 'stroke-linecap': 'round' }),
    path('M210 185L232 167L256 187L232 206Z', '#ddc99f', { stroke: '#a3926c', 'stroke-width': 1.6 }),
    path('M218 183L241 197M225 177L249 190', 'none', { stroke: '#baa77d', 'stroke-width': 2 }));
  for (const [x,y,scale] of [[136,119,1],[189,133,.9],[299,157,1.1],[346,186,.9],[116,225,.7],[363,229,.8]]) brush(svg,x,y,scale);
  for (const [x,y,scale] of [[31,119,.8],[446,151,1.1],[458,179,.75],[276,80,.7]]) pine(svg,x,y,scale);
  // Towers on all three lanes, with the two crystals at opposing ends.
  for (const [x,y,team,scale] of [[104,106,'blue',.9],[304,94,'red',1],[153,219,'blue',.75],[327,141,'red',.9],[189,260,'blue',.7],[400,198,'red',.8]]) tower(svg,x,y,team,scale);
  crystal(svg,73,254,'blue'); crystal(svg,408,85,'red');
  const camp = group(svg, { transform:'translate(300 251)', 'data-scenery':'jungle-camp' });
  camp.append(path('M-15 0Q-20 -18 -6 -21L4 -32L14 -19Q23 -6 14 3Z','#a9b69a',{stroke:'#879275','stroke-width':1.5}),
    path('M-5 -19L1 -23L6 -17M-5 -8L-1 -7M8 -8L12 -9','none',{stroke:'#eee3bd','stroke-width':2}));
}

export function createGameScenery(id) {
  const svg = node('svg', { viewBox: '0 0 480 330', class: 'game-scenery', 'aria-hidden': 'true', focusable: 'false', 'data-game-scenery': id, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
  if (id === 'alliance') civilization(svg);
  else if (id === 'honor') kingsCanyon(svg);
  return svg;
}
