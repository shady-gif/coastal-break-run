import fs from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

globalThis.FileReader = class {
  async readAsArrayBuffer(blob) {
    this.result = await blob.arrayBuffer();
    this.onloadend?.({ target: this });
  }
};

const red = new THREE.MeshStandardMaterial({ color: 0xe73d46, roughness: 0.34, metalness: 0.32 });
const darkRed = new THREE.MeshStandardMaterial({ color: 0xa91f2d, roughness: 0.42, metalness: 0.22 });
const black = new THREE.MeshStandardMaterial({ color: 0x07090e, roughness: 0.56, metalness: 0.1 });
const glass = new THREE.MeshStandardMaterial({ color: 0x111d31, roughness: 0.12, metalness: 0.2 });
const tire = new THREE.MeshStandardMaterial({ color: 0x07080b, roughness: 0.92 });
const rim = new THREE.MeshStandardMaterial({ color: 0xc9c1b8, roughness: 0.28, metalness: 0.72 });
const tail = new THREE.MeshStandardMaterial({ color: 0xff4735, emissive: 0xff2a22, emissiveIntensity: 1.4, roughness: 0.28 });
const tailCore = new THREE.MeshStandardMaterial({ color: 0xffe0ba, emissive: 0xff725e, emissiveIntensity: 1.6, roughness: 0.2 });
const head = new THREE.MeshStandardMaterial({ color: 0xfff2cc, emissive: 0xffdc8b, emissiveIntensity: 0.9, roughness: 0.22 });

const car = new THREE.Group();
car.name = 'ArcadeWedgeSupercar';

const mesh = (geometry, material, name, position, rotation = [0, 0, 0]) => {
  const item = new THREE.Mesh(geometry, material);
  item.name = name;
  item.position.set(...position);
  item.rotation.set(...rotation);
  item.castShadow = true;
  item.receiveShadow = true;
  car.add(item);
  return item;
};

const wedgeGeometry = (widthFront, widthRear, heightFront, heightRear, length) => {
  const zFront = -length / 2;
  const zRear = length / 2;
  const yBottom = 0;
  const vertices = new Float32Array([
    -widthFront / 2, yBottom, zFront, widthFront / 2, yBottom, zFront, widthRear / 2, yBottom, zRear, -widthRear / 2, yBottom, zRear,
    -widthFront / 2, heightFront, zFront, widthFront / 2, heightFront, zFront, widthRear / 2, heightRear, zRear, -widthRear / 2, heightRear, zRear
  ]);
  const indices = [
    0, 1, 2, 0, 2, 3,
    4, 6, 5, 4, 7, 6,
    0, 4, 5, 0, 5, 1,
    1, 5, 6, 1, 6, 2,
    2, 6, 7, 2, 7, 3,
    3, 7, 4, 3, 4, 0
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
};

mesh(wedgeGeometry(2.25, 2.9, 0.62, 0.88, 4.45), red, 'low_wide_wedge_body', [0, 0.28, 0.05]);
mesh(new THREE.BoxGeometry(2.95, 0.48, 1.15, 2, 1, 1), red, 'wide_rear_haunches', [0, 0.55, 1.38]);
mesh(new THREE.BoxGeometry(1.85, 0.25, 1.3, 2, 1, 1), red, 'sloped_front_hood', [0, 0.83, -1.25], [-0.11, 0, 0]);
mesh(new THREE.BoxGeometry(1.52, 0.5, 1.32, 2, 1, 2), glass, 'black_fastback_cabin', [0, 1.08, 0.02], [-0.1, 0, 0]);
mesh(new THREE.BoxGeometry(1.75, 0.09, 0.78), glass, 'rear_window', [0, 1.06, 1.16], [0.18, 0, 0]);
mesh(new THREE.BoxGeometry(2.7, 0.12, 0.32), black, 'thin_rear_spoiler', [0, 1.06, 2.12]);
mesh(new THREE.BoxGeometry(2.42, 0.4, 0.08), black, 'deep_rear_grille', [0, 0.7, 2.28]);
mesh(new THREE.BoxGeometry(2.66, 0.38, 0.44), black, 'rear_diffuser', [0, 0.25, 2.14], [-0.14, 0, 0]);
mesh(new THREE.BoxGeometry(2.26, 0.08, 0.34), black, 'front_splitter', [0, 0.22, -2.36]);
mesh(new THREE.BoxGeometry(0.12, 0.18, 2.82), black, 'left_side_skirt', [-1.33, 0.34, 0.02]);
mesh(new THREE.BoxGeometry(0.12, 0.18, 2.82), black, 'right_side_skirt', [1.33, 0.34, 0.02]);

for (const x of [-0.64, 0.64]) {
  mesh(new THREE.BoxGeometry(0.5, 0.13, 0.08), head, `headlight_${x}`, [x, 0.68, -2.32]);
  mesh(new THREE.BoxGeometry(0.34, 0.15, 0.18), black, `side_mirror_${x}`, [x * 1.32, 0.9, -0.64], [0, x < 0 ? -0.35 : 0.35, 0]);
}

for (const x of [-0.92, -0.52, 0.52, 0.92]) {
  mesh(new THREE.TorusGeometry(0.145, 0.04, 10, 26), tail, `round_tail_ring_${x}`, [x, 0.73, 2.34], [Math.PI / 2, 0, 0]);
  mesh(new THREE.CircleGeometry(0.068, 20), tailCore, `round_tail_core_${x}`, [x, 0.73, 2.386]);
}

for (const x of [-0.3, 0, 0.3]) {
  mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.38, 20), black, `center_exhaust_${x}`, [x, 0.18, 2.43], [Math.PI / 2, 0, 0]);
}

for (const x of [-0.62, -0.38, -0.14, 0.14, 0.38, 0.62]) {
  mesh(new THREE.BoxGeometry(0.14, 0.055, 0.54), black, `engine_vent_${x}`, [x, 1.02, 1.62], [0.12, 0, 0]);
}

const addWheel = (name, x, z, front) => {
  const group = new THREE.Group();
  group.name = name;
  group.position.set(x, 0.31, z);
  const tireMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.36, 28), tire);
  tireMesh.name = `${name}_tire`;
  tireMesh.rotation.z = Math.PI / 2;
  tireMesh.castShadow = true;
  group.add(tireMesh);
  const rimMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.38, 18), rim);
  rimMesh.name = `${name}_rim`;
  rimMesh.rotation.z = Math.PI / 2;
  rimMesh.castShadow = true;
  group.add(rimMesh);
  group.userData.frontWheel = front;
  car.add(group);
};

addWheel('wheel_front_left', -1.28, -1.34, true);
addWheel('wheel_front_right', 1.28, -1.34, true);
addWheel('wheel_rear_left', -1.32, 1.3, false);
addWheel('wheel_rear_right', 1.32, 1.3, false);

const exporter = new GLTFExporter();
const result = await new Promise((resolve, reject) => {
  exporter.parse(car, resolve, reject, { binary: true });
});

await fs.writeFile(new URL('../public/models/wedge-supercar.glb', import.meta.url), Buffer.from(result));
console.log('Wrote public/models/wedge-supercar.glb');
