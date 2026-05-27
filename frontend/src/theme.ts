// Card Rush Arena – shared theme tokens.
export const colors = {
  bg: "#0B0914",
  surface: "#1A1528",
  surfaceHi: "#2A2342",
  border: "#392F54",
  primary: "#00E5FF",
  secondary: "#B5179E",
  gold: "#FEE440",
  text: "#FFFFFF",
  subtext: "#AFA8BA",
  success: "#06D6A0",
  danger: "#FF3366",
  suits: {
    flame: "#FF3366",
    wave: "#00B4D8",
    leaf: "#06D6A0",
    bolt: "#FFD166",
  },
};

export const radii = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 };
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const images = {
  arenaBg:
    "https://static.prod-images.emergentagent.com/jobs/fe23fa8d-3a85-4fb8-8992-bf59f5623227/images/649c9886a0d8b90c59b73f8da4fe8603f2a81aa2f1dee63bb321563ce6640557.png",
  cardBack:
    "https://static.prod-images.emergentagent.com/jobs/fe23fa8d-3a85-4fb8-8992-bf59f5623227/images/686ff222da29b4d1b3abb058615f9e10a139cf9a09b28f531d2e0debb2fef0e8.png",
  chest:
    "https://static.prod-images.emergentagent.com/jobs/fe23fa8d-3a85-4fb8-8992-bf59f5623227/images/a9c7eed738b106a336c2ef109d85c0aefef186bed8ed09e4f8589288edcf5707.png",
  avatar:
    "https://static.prod-images.emergentagent.com/jobs/fe23fa8d-3a85-4fb8-8992-bf59f5623227/images/72db34fa01a80ba7f21446b490c2ff4e5bd25fd2ef4602b31994853b20eed4f9.png",
};

export const leagues = [
  { name: "Bronze", min: 0, color: "#C77D45" },
  { name: "Silver", min: 500, color: "#B8C0CC" },
  { name: "Gold", min: 1200, color: "#FEE440" },
  { name: "Platinum", min: 2200, color: "#7BE5D8" },
  { name: "Diamond", min: 3500, color: "#7AB6FF" },
  { name: "Master", min: 5000, color: "#FF6BD6" },
];
