export const WEAPONS = {
  glock: {
    name: "Glock-18",
    price: 0,
    damage: 18,
    fireRate: 0.12,
    magSize: 20,
    reserve: 120,
    spread: 0.018,
    auto: false,
    reloadTime: 1.8,
    range: 30,
  },
  ak47: {
    name: "AK-47",
    price: 2700,
    damage: 36,
    fireRate: 0.1,
    magSize: 30,
    reserve: 90,
    spread: 0.035,
    auto: true,
    reloadTime: 2.4,
    range: 50,
  },
  awp: {
    name: "AWP",
    price: 4750,
    damage: 115,
    fireRate: 1.2,
    magSize: 10,
    reserve: 30,
    spread: 0.002,
    auto: false,
    reloadTime: 3.0,
    range: 80,
  },
};

export function createWeaponState(id) {
  const w = WEAPONS[id];
  return {
    id,
    mag: w.magSize,
    reserve: w.reserve,
    fireCooldown: 0,
    reloadTimer: 0,
    reloading: false,
  };
}
