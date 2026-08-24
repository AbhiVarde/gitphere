export const THETA = 0.32;
export const GLOBE_RADIUS_RATIO = 0.44; // fraction of canvas width used as sphere radius
export const AUTO_ROTATE_SPEED = 0.0022;

export function project(
  lat: number,
  lng: number,
  phi: number,
  theta: number,
  radius: number,
) {
  const latRad = (lat * Math.PI) / 180;
  const lonRad = (lng * Math.PI) / 180 - Math.PI;
  const cosLat = Math.cos(latRad);

  const x0 = -cosLat * Math.cos(lonRad);
  const y0 = Math.sin(latRad);
  const z0 = cosLat * Math.sin(lonRad);

  const cx = Math.cos(theta);
  const sx = Math.sin(theta);
  const cy = Math.cos(phi);
  const sy = Math.sin(phi);

  const x = cy * x0 + sy * z0;
  const y = sy * sx * x0 + cx * y0 - cy * sx * z0;
  const z = -sy * cx * x0 + sx * y0 + cy * cx * z0;

  return { x: x * radius, y: -y * radius, z };
}
