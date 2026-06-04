import * as THREE from 'three';

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export const lerp = (from, to, amount) => from + (to - from) * amount;

export const smoothstep = (edge0, edge1, value) => {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

export const yawFromDirection = (direction) => Math.atan2(-direction.x, -direction.z);

export const formatTime = (seconds) => {
  if (!Number.isFinite(seconds)) return '--:--.---';
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds - minutes * 60;
  return `${minutes}:${remainder.toFixed(3).padStart(6, '0')}`;
};

export const makeBox = (width, height, depth, material, position, rotationY = 0) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.copy(position);
  mesh.rotation.y = rotationY;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
};
