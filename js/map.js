export const TILE = 1;

export const MAP = [
  "########################",
  "#..........#...........#",
  "#..####....#....####...#",
  "#..#..#....#....#..#...#",
  "#..####....#....####.A.#",
  "#..........#...........#",
  "#....#######...........#",
  "#....#.....#....####...#",
  "#....#.....#....#..#...#",
  "#....#######....####...#",
  "#......................#",
  "#.........######.......#",
  "#.........#....#.......#",
  "#...B.....#....#.......#",
  "#.........######.......#",
  "#......................#",
  "########################",
];

export const MAP_H = MAP.length;
export const MAP_W = MAP[0].length;

export const SPAWNS = {
  t: { x: 3.5, y: 15.5 },
  ct: [
    { x: 20.5, y: 2.5 },
    { x: 18.5, y: 2.5 },
    { x: 16.5, y: 2.5 },
    { x: 14.5, y: 4.5 },
    { x: 20.5, y: 5.5 },
  ],
};

export const BOMB_SITES = {
  A: { x: 21.5, y: 4.5, label: "A" },
  B: { x: 5.5, y: 14.5, label: "B" },
};

export function getTile(x, y) {
  const col = Math.floor(x);
  const row = Math.floor(y);
  if (row < 0 || row >= MAP_H || col < 0 || col >= MAP_W) return "#";
  return MAP[row][col];
}

export function isWall(x, y) {
  return getTile(x, y) === "#";
}

export function isWalkable(x, y, radius = 0.2) {
  const points = [
    [x - radius, y - radius],
    [x + radius, y - radius],
    [x - radius, y + radius],
    [x + radius, y + radius],
  ];
  return points.every(([px, py]) => !isWall(px, py));
}

export function lineOfSight(x0, y0, x1, y1) {
  const dist = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.ceil(dist * 4);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (isWall(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return false;
  }
  return true;
}
