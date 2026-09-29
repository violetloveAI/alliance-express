// Fixed landmarks stay within rings 0–4. The entire outermost ring (radius 5)
// is ordinary meadow; empty cells between inner landmarks remain walkable too.
export const MAP_LAYOUT = Object.freeze(Object.fromEntries([
  // Starting school and the only three landmarks in its six-cell halo.
  ['school', 0, 0],
  ['canteen', 1, 0], ['dorm', -1, 1], ['metro', 0, -1],

  // Ring 2: familiar school memories and an early village encounter.
  ['walk', 2, -1], ['fitness', 2, 0], ['physics', 0, -2],
  ['guitar', -2, 0], ['classphoto', -2, 2], ['pe', 1, 1],
  ['village-meadow', 0, 2], ['dontstarve', -2, 1], ['love', 2, -2],

  // Ring 3: games and everyday memories in each direction.
  ['shenzhen', 3, -2], ['hainan', -3, 1], ['guangdong', 1, 2],
  ['honor', -1, 3], ['sanguosha', -3, 3], ['coding', 1, -3],
  ['reunion', -2, -1], ['village-hill', 3, 0],
  ['supply', -3, 2], ['terraria', 0, 3],
  ['village-watch', 0, -3], ['village-orchard', 2, 1],

  // Ring 4: the longer trips and places to stop for a while.
  ['foshan', -4, 1], ['fuzhou', 3, 1], ['zhangzhou', 4, -2],
  ['reunion2023', 0, 4], ['museum', -1, -3], ['hearthstone', 2, -4],
  ['alliance', 4, -4], ['badminton', -3, 4], ['picnic', 2, 2],
  ['village-river', -4, 3],
  ['battlefield2042', -3, -1], ['battlefieldv', 4, -1], ['jinggangshan', -2, 4],
].map(([id, q, r]) => [id, Object.freeze({ q, r })])));
