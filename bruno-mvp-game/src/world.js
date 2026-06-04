import * as THREE from 'three';
import { clamp, makeBox, yawFromDirection } from './utils.js';

const palette = {
  road: 0x262b33,
  lane: 0xe9dbc1,
  kerbRed: 0xe94b63,
  kerbWhite: 0xfff3df,
  sand: 0xf0d48a,
  grass: 0x48b872,
  ocean: 0x1aaed0,
  sidewalk: 0xd9b48f,
  palm: 0x35a85d,
  trunk: 0x8d5a38
};

const routePoints = [
  [-6, 0, 118],
  [-78, 0, 102],
  [-124, 0, 46],
  [-112, 0, -34],
  [-60, 0, -96],
  [28, 0, -118],
  [108, 0, -82],
  [142, 0, -12],
  [118, 0, 62],
  [62, 0, 112]
].map(([x, y, z]) => new THREE.Vector3(x, y, z));

export const createWorld = (scene) => {
  const world = new THREE.Group();
  scene.add(world);

  const roadWidth = 18;
  const paintHeight = 0.018;
  const paintY = 0.07;
  const curve = new THREE.CatmullRomCurve3(routePoints, true, 'catmullrom', 0.35);
  const samples = curve.getSpacedPoints(300);
  const tangents = samples.map((_, index) => curve.getTangent(index / (samples.length - 1)).normalize());
  const cumulative = [0];
  for (let i = 1; i < samples.length; i += 1) {
    cumulative[i] = cumulative[i - 1] + samples[i].distanceTo(samples[i - 1]);
  }
  const length = cumulative[cumulative.length - 1] + samples[0].distanceTo(samples[samples.length - 1]);

  const roadTexture = createAsphaltTexture();
  const roadMaterial = new THREE.MeshStandardMaterial({
    color: palette.road,
    roughness: 0.88,
    map: roadTexture
  });
  const laneMaterial = new THREE.MeshStandardMaterial({ color: palette.lane, roughness: 0.72 });
  const kerbMaterials = [
    new THREE.MeshStandardMaterial({ color: palette.kerbRed, roughness: 0.76 }),
    new THREE.MeshStandardMaterial({ color: palette.kerbWhite, roughness: 0.76 })
  ];
  const sidewalkMaterial = new THREE.MeshStandardMaterial({ color: palette.sidewalk, roughness: 0.9 });

  const ground = new THREE.Mesh(
    new THREE.BoxGeometry(430, 0.35, 360),
    new THREE.MeshStandardMaterial({ color: palette.grass, roughness: 0.95 })
  );
  ground.position.set(20, -0.28, 0);
  ground.receiveShadow = true;
  world.add(ground);

  const ocean = new THREE.Mesh(
    new THREE.BoxGeometry(180, 0.18, 380),
    new THREE.MeshStandardMaterial({ color: palette.ocean, roughness: 0.62, metalness: 0.08 })
  );
  ocean.position.set(-205, -0.18, 0);
  ocean.receiveShadow = true;
  world.add(ocean);

  const beach = new THREE.Mesh(
    new THREE.BoxGeometry(38, 0.08, 365),
    new THREE.MeshStandardMaterial({ color: palette.sand, roughness: 0.9 })
  );
  beach.position.set(-118, -0.07, 0);
  beach.receiveShadow = true;
  world.add(beach);

  for (let i = 0; i < samples.length; i += 1) {
    const current = samples[i];
    const next = samples[(i + 1) % samples.length];
    const center = current.clone().lerp(next, 0.5);
    const segmentLength = current.distanceTo(next) + 0.5;
    const tangent = next.clone().sub(current).normalize();
    const angle = yawFromDirection(tangent);

    const road = makeBox(roadWidth, 0.08, segmentLength, roadMaterial, new THREE.Vector3(center.x, 0.02, center.z), angle);
    road.castShadow = false;
    world.add(road);

    if (i % 6 === 0) {
      const lane = makeBox(0.55, paintHeight, 5, laneMaterial, new THREE.Vector3(center.x, paintY, center.z), angle);
      lane.castShadow = false;
      world.add(lane);
    }

    if (i % 12 === 0) {
      const normal = new THREE.Vector3(tangent.z, 0, -tangent.x);
      for (const side of [-1, 1]) {
        const edgeStripePosition = center.clone().addScaledVector(normal, side * (roadWidth / 2 - 1.15));
        const edgeStripe = makeBox(0.28, paintHeight, 6.5, laneMaterial, new THREE.Vector3(edgeStripePosition.x, paintY, edgeStripePosition.z), angle);
        edgeStripe.castShadow = false;
        world.add(edgeStripe);
      }
    }

    if (i % 4 === 0) {
      const normal = new THREE.Vector3(tangent.z, 0, -tangent.x);
      for (const side of [-1, 1]) {
        const edge = center.clone().addScaledVector(normal, side * (roadWidth / 2 + 0.65));
        const kerb = makeBox(1.25, 0.18, 3.7, kerbMaterials[(i + (side > 0 ? 1 : 0)) % 2], new THREE.Vector3(edge.x, 0.15, edge.z), angle);
        world.add(kerb);
      }
    }

    if (i % 11 === 0) {
      const normal = new THREE.Vector3(tangent.z, 0, -tangent.x);
      for (const side of [-1, 1]) {
        const walk = center.clone().addScaledVector(normal, side * (roadWidth / 2 + 4.2));
        const sidewalk = makeBox(5.5, 0.1, 7.8, sidewalkMaterial, new THREE.Vector3(walk.x, 0.045, walk.z), angle);
        sidewalk.castShadow = false;
        world.add(sidewalk);
      }
    }
  }

  const finishPosition = samples[0].clone();
  const finishAngle = yawFromDirection(tangents[0]);
  const finishLine = makeBox(roadWidth + 1, paintHeight, 1.1, laneMaterial, new THREE.Vector3(finishPosition.x, paintY, finishPosition.z), finishAngle + Math.PI / 2);
  finishLine.castShadow = false;
  world.add(finishLine);

  const boostPads = [0.18, 0.46, 0.72].map((t) => {
    const point = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t).normalize();
    const material = new THREE.MeshStandardMaterial({
      color: 0x14d8ff,
      emissive: 0x0c87ff,
      emissiveIntensity: 0.9,
      roughness: 0.34
    });
    const pad = makeBox(5.4, 0.13, 8.5, material, new THREE.Vector3(point.x, 0.14, point.z), yawFromDirection(tangent));
    world.add(pad);
    return pad;
  });

  addScenery(world, curve, samples, roadWidth);

  const getNearest = (position) => {
    let bestIndex = 0;
    let bestDistance = Infinity;
    for (let i = 0; i < samples.length; i += 1) {
      const distance = position.distanceTo(samples[i]);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = i;
      }
    }
    return {
      index: bestIndex,
      distance: bestDistance,
      progress: cumulative[bestIndex] / length,
      point: samples[bestIndex],
      tangent: tangents[bestIndex]
    };
  };

  return {
    world,
    boostPads,
    length,
    roadWidth,
    start: {
      position: samples[0].clone().add(new THREE.Vector3(0, 0, 0)),
      yaw: yawFromDirection(tangents[0])
    },
    isOnRoad(position) {
      return getNearest(position).distance <= roadWidth / 2 + 2.5;
    },
    getProgress(position) {
      return getNearest(position).progress;
    },
    clampProgress(position) {
      return clamp(getNearest(position).progress, 0, 1);
    }
  };
};

const createAsphaltTexture = () => {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  context.fillStyle = '#303642';
  context.fillRect(0, 0, size, size);

  for (let i = 0; i < 1500; i += 1) {
    const shade = 38 + Math.floor(Math.random() * 46);
    context.fillStyle = `rgba(${shade}, ${shade + 4}, ${shade + 10}, ${0.18 + Math.random() * 0.18})`;
    context.fillRect(Math.random() * size, Math.random() * size, 1 + Math.random() * 1.5, 1 + Math.random() * 1.5);
  }

  context.strokeStyle = 'rgba(255,255,255,0.035)';
  for (let y = 0; y < size; y += 16) {
    context.beginPath();
    context.moveTo(0, y + Math.random() * 3);
    context.lineTo(size, y + Math.random() * 3);
    context.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1.4, 1.4);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};

const addScenery = (world, curve, samples, roadWidth) => {
  const buildingColors = [0xf0a7b5, 0xf7c46c, 0x80d3d6, 0xa8cf75, 0xf2d9a6, 0xbba5e8];
  const buildingMaterials = buildingColors.map((color) => new THREE.MeshStandardMaterial({ color, roughness: 0.78 }));
  const glassMaterial = new THREE.MeshStandardMaterial({ color: 0x365178, roughness: 0.4, metalness: 0.08 });
  const trunkMaterial = new THREE.MeshStandardMaterial({ color: palette.trunk, roughness: 0.86 });
  const palmMaterial = new THREE.MeshStandardMaterial({ color: palette.palm, roughness: 0.82 });
  const signMaterial = new THREE.MeshStandardMaterial({ color: 0xfff06a, emissive: 0x735500, emissiveIntensity: 0.12, roughness: 0.55 });

  for (let i = 0; i < samples.length; i += 14) {
    const point = samples[i];
    const tangent = samples[(i + 1) % samples.length].clone().sub(point).normalize();
    const normal = new THREE.Vector3(tangent.z, 0, -tangent.x);

    for (const side of [-1, 1]) {
      const distanceFromRoad = side < 0 && point.x < -75 ? 24 : 17 + (i % 5) * 2.2;
      const base = point.clone().addScaledVector(normal, side * (roadWidth / 2 + distanceFromRoad));

      if (side < 0 && base.x < -95) {
        addPalm(world, base, trunkMaterial, palmMaterial, 1 + (i % 4) * 0.08);
        continue;
      }

      if (i % 3 === 0) {
        const width = 8 + (i % 4) * 2;
        const height = 7 + (i % 6) * 3;
        const depth = 8 + (i % 5) * 1.5;
        const building = makeBox(width, height, depth, buildingMaterials[i % buildingMaterials.length], new THREE.Vector3(base.x, height / 2, base.z), Math.sin(i) * 0.35);
        world.add(building);

        const windowRows = Math.max(1, Math.floor(height / 4));
        for (let row = 0; row < windowRows; row += 1) {
          const windowMesh = makeBox(width * 0.62, 0.1, 0.08, glassMaterial, new THREE.Vector3(base.x, 2.2 + row * 3.1, base.z + depth / 2 + 0.06), building.rotation.y);
          windowMesh.castShadow = false;
          world.add(windowMesh);
        }
      } else {
        addPalm(world, base, trunkMaterial, palmMaterial, 0.9 + (i % 5) * 0.05);
      }
    }
  }

  for (const t of [0.08, 0.3, 0.57, 0.84]) {
    const point = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t).normalize();
    const normal = new THREE.Vector3(tangent.z, 0, -tangent.x);
    const signPosition = point.clone().addScaledVector(normal, roadWidth / 2 + 5);
    const sign = makeBox(5.8, 2.6, 0.35, signMaterial, new THREE.Vector3(signPosition.x, 2.6, signPosition.z), yawFromDirection(tangent));
    world.add(sign);
    const post = makeBox(0.28, 2.8, 0.28, new THREE.MeshStandardMaterial({ color: 0x293241, roughness: 0.75 }), new THREE.Vector3(signPosition.x, 1.25, signPosition.z), 0);
    world.add(post);
  }
};

const addPalm = (world, position, trunkMaterial, palmMaterial, scale = 1) => {
  const palm = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.34 * scale, 0.48 * scale, 5.2 * scale, 7), trunkMaterial);
  trunk.position.y = 2.6 * scale;
  trunk.rotation.z = 0.08;
  trunk.castShadow = true;
  palm.add(trunk);

  for (let i = 0; i < 6; i += 1) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.55 * scale, 4.2 * scale, 5), palmMaterial);
    leaf.position.y = 5.4 * scale;
    leaf.rotation.z = Math.PI / 2;
    leaf.rotation.y = (i / 6) * Math.PI * 2;
    leaf.castShadow = true;
    palm.add(leaf);
  }

  palm.position.copy(position);
  world.add(palm);
};
