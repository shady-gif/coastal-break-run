import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clamp, lerp, smoothstep } from './utils.js';

const defaultTune = {
  maxSpeed: 41,
  nitroSpeed: 55,
  acceleration: 31,
  launchBoost: 1.42,
  brake: 40,
  reverse: 11,
  grip: 2.85,
  driftGrip: 1.55,
  steering: 3.05,
  highSpeedSteerDrop: 0.72,
  turnSlide: 0.2,
  driftSlide: 0.46,
  drag: 0.5,
  offroadDrag: 3.95
};

export class CarController {
  constructor(scene, world, tune = defaultTune) {
    this.scene = scene;
    this.world = world;
    this.tune = tune;
    this.group = new THREE.Group();
    scene.add(this.group);

    this.state = {
      position: world.start.position.clone(),
      velocity: new THREE.Vector3(),
      yaw: world.start.yaw,
      steeringVisual: 0,
      nitro: 1,
      boostFlash: 0,
      driftCharge: 0,
      speed: 0,
      forwardSpeed: 0,
      onRoad: true,
      drifting: false,
      usingNitro: false
    };

    this.createModel();
    this.reset();
  }

  createModel() {
    this.wheels = [];
    this.frontWheels = [];
    this.loadCarModel();

    this.flameMaterial = new THREE.MeshBasicMaterial({ color: 0x52d8ff, transparent: true, opacity: 0 });
    this.flame = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.4, 16), this.flameMaterial);
    this.flame.rotation.x = -Math.PI / 2;
    this.flame.position.set(0, 0.42, 2.5);
    this.group.add(this.flame);

    this.streaks = [];
    for (const x of [-2.15, 2.15]) {
      const streak = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.04, 5.4),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 })
      );
      streak.position.set(x, 0.16, 2.35);
      this.group.add(streak);
      this.streaks.push(streak);
    }

    this.shadow = new THREE.Mesh(
      new THREE.CircleGeometry(1.7, 32),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22 })
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.011;
    this.scene.add(this.shadow);
  }

  loadCarModel() {
    const loader = new GLTFLoader();
    loader.load('/models/bugatti-veyron-2010.glb', (gltf) => {
      const model = gltf.scene;
      model.name = 'BugattiVeyron2010';
      this.normalizeBugattiModel(model);
      model.traverse((item) => {
        if (item.isMesh) {
          item.castShadow = true;
          item.receiveShadow = true;
          item.material = this.prepareImportedMaterial(item.material);
        }
        if (item.name.startsWith('wheel_')) {
          this.wheels.push(item);
          if (item.userData.frontWheel || item.name.includes('front')) this.frontWheels.push(item);
        }
      });
      this.group.add(model);
    }, undefined, () => {
      this.addFallbackMarker();
    });
  }

  normalizeBugattiModel(model) {
    const axisTransform = new THREE.Matrix4().set(
      0, 0, 1, 0,
      0, 1, 0, 0,
      -1, 0, 0, 0,
      0, 0, 0, 1
    );
    model.applyMatrix4(axisTransform);
    model.rotateY(Math.PI);
    model.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    box.getSize(size);

    const longestHorizontal = Math.max(size.x, size.z);
    const targetLength = 4.65;
    const scale = longestHorizontal > 0 ? targetLength / longestHorizontal : 1;
    model.scale.setScalar(scale);
    model.updateMatrixWorld(true);

    const scaledBox = new THREE.Box3().setFromObject(model);
    const scaledCenter = new THREE.Vector3();
    scaledBox.getCenter(scaledCenter);

    model.position.x -= scaledCenter.x;
    model.position.z -= scaledCenter.z;
    model.position.y += 0.08 - scaledBox.min.y;
  }

  normalizeConceptCarDetails(model) {
    this.removeOversizedConceptParts(model);
    model.rotation.y = -Math.PI / 2;
    model.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    box.getSize(size);

    const longestHorizontal = Math.max(size.x, size.z);
    const targetLength = 3.65;
    const scale = longestHorizontal > 0 ? targetLength / longestHorizontal : 1;
    model.scale.setScalar(scale);
    model.updateMatrixWorld(true);

    const scaledBox = new THREE.Box3().setFromObject(model);
    const scaledCenter = new THREE.Vector3();
    scaledBox.getCenter(scaledCenter);

    model.position.x -= scaledCenter.x;
    model.position.z -= scaledCenter.z;
    model.position.y += 0.05 - scaledBox.min.y;
  }

  removeOversizedConceptParts(model) {
    const discard = [];
    model.updateMatrixWorld(true);

    model.traverse((item) => {
      if (!item.isMesh) return;

      const box = new THREE.Box3().setFromObject(item);
      const size = box.getSize(new THREE.Vector3());
      const maxDimension = Math.max(size.x, size.y, size.z);
      const scale = item.scale;
      const maxScale = Math.max(Math.abs(scale.x), Math.abs(scale.y), Math.abs(scale.z));

      if (maxDimension > 18 || maxScale > 8) {
        discard.push(item);
      }
    });

    for (const item of discard) {
      item.parent?.remove(item);
    }
  }

  prepareImportedMaterial(material) {
    if (Array.isArray(material)) return material.map((item) => this.prepareImportedMaterial(item));

    const prepared = material.clone();
    prepared.side = THREE.DoubleSide;
    prepared.needsUpdate = true;
    return prepared;
  }

  addPlayableConceptShell() {
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xd8dad7, roughness: 0.32, metalness: 0.42 });
    const lowerMaterial = new THREE.MeshStandardMaterial({ color: 0x151820, roughness: 0.58, metalness: 0.18 });
    const glassMaterial = new THREE.MeshStandardMaterial({ color: 0x101926, roughness: 0.16, metalness: 0.12 });
    const tireMaterial = new THREE.MeshStandardMaterial({ color: 0x08090c, roughness: 0.9 });
    const rimMaterial = new THREE.MeshStandardMaterial({ color: 0xbec3c2, roughness: 0.24, metalness: 0.74 });
    const headlightMaterial = new THREE.MeshStandardMaterial({
      color: 0xfff3cf,
      emissive: 0xffd58a,
      emissiveIntensity: 0.75,
      roughness: 0.22
    });
    const tailMaterial = new THREE.MeshStandardMaterial({
      color: 0xff4e3d,
      emissive: 0xff2f22,
      emissiveIntensity: 1.15,
      roughness: 0.24
    });

    this.addShellMesh(this.createConceptWedgeGeometry(2.05, 2.6, 0.5, 0.78, 4.45), bodyMaterial, [0, 0.28, 0.02]);
    this.addShellMesh(new THREE.BoxGeometry(2.7, 0.42, 1.12), bodyMaterial, [0, 0.56, 1.12]);
    this.addShellMesh(new THREE.BoxGeometry(1.72, 0.42, 1.18), glassMaterial, [0, 0.98, -0.16], [-0.13, 0, 0]);
    this.addShellMesh(new THREE.BoxGeometry(2.18, 0.08, 0.36), lowerMaterial, [0, 0.2, -2.32]);
    this.addShellMesh(new THREE.BoxGeometry(2.78, 0.36, 0.34), lowerMaterial, [0, 0.28, 2.15], [-0.08, 0, 0]);
    this.addShellMesh(new THREE.BoxGeometry(2.72, 0.12, 0.3), lowerMaterial, [0, 0.98, 2.08]);
    this.addShellMesh(new THREE.BoxGeometry(0.13, 0.16, 2.8), lowerMaterial, [-1.28, 0.35, 0]);
    this.addShellMesh(new THREE.BoxGeometry(0.13, 0.16, 2.8), lowerMaterial, [1.28, 0.35, 0]);

    for (const x of [-0.55, 0.55]) {
      this.addShellMesh(new THREE.BoxGeometry(0.48, 0.12, 0.08), headlightMaterial, [x, 0.62, -2.23]);
    }

    for (const x of [-0.62, -0.28, 0.28, 0.62]) {
      this.addShellMesh(new THREE.BoxGeometry(0.22, 0.12, 0.08), tailMaterial, [x, 0.65, 2.32]);
    }

    for (const [x, z, front] of [
      [-1.22, -1.28, true],
      [1.22, -1.28, true],
      [-1.28, 1.26, false],
      [1.28, 1.26, false]
    ]) {
      this.addPlayableWheel(x, z, front, tireMaterial, rimMaterial);
    }
  }

  addShellMesh(geometry, material, position, rotation = [0, 0, 0]) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.rotation.set(...rotation);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.group.add(mesh);
    return mesh;
  }

  createConceptWedgeGeometry(widthFront, widthRear, heightFront, heightRear, length) {
    const zFront = -length / 2;
    const zRear = length / 2;
    const vertices = new Float32Array([
      -widthFront / 2, 0, zFront, widthFront / 2, 0, zFront, widthRear / 2, 0, zRear, -widthRear / 2, 0, zRear,
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
  }

  addPlayableWheel(x, z, front, tireMaterial, rimMaterial) {
    const wheel = new THREE.Group();
    wheel.position.set(x, 0.34, z);
    wheel.userData.frontWheel = front;

    const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.43, 0.34, 28), tireMaterial);
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;
    tire.receiveShadow = true;
    wheel.add(tire);

    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.37, 20), rimMaterial);
    rim.rotation.z = Math.PI / 2;
    rim.castShadow = true;
    wheel.add(rim);

    this.group.add(wheel);
    this.wheels.push(wheel);
    if (front) this.frontWheels.push(wheel);
  }

  addFallbackMarker() {
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(2.5, 0.5, 4),
      new THREE.MeshStandardMaterial({ color: 0xe9435f, roughness: 0.35, metalness: 0.2 })
    );
    body.position.y = 0.55;
    body.castShadow = true;
    this.group.add(body);
  }

  reset() {
    this.state.position.copy(this.world.start.position);
    this.state.velocity.set(0, 0, 0);
    this.state.yaw = this.world.start.yaw;
    this.state.nitro = 1;
    this.state.driftCharge = 0;
    this.state.boostFlash = 0;
    this.group.position.copy(this.state.position);
    this.group.rotation.set(0, this.state.yaw, 0);
  }

  update(delta, inputs) {
    let forward = new THREE.Vector3(-Math.sin(this.state.yaw), 0, -Math.cos(this.state.yaw));
    let right = new THREE.Vector3(Math.cos(this.state.yaw), 0, -Math.sin(this.state.yaw));
    let forwardSpeed = this.state.velocity.dot(forward);
    const lateralSpeed = this.state.velocity.dot(right);
    const speed = this.state.velocity.length();
    const speed01 = clamp(speed / this.tune.maxSpeed, 0, 1);
    const onRoad = this.world.isOnRoad(this.state.position);
    const drifting = inputs.handbrake && speed > 10 && Math.abs(inputs.steer) > 0.1;
    const usingNitro = inputs.nitro && this.state.nitro > 0.02 && inputs.throttle > 0;

    const maxSpeed = usingNitro ? this.tune.nitroSpeed : this.tune.maxSpeed;
    const launchPunch = lerp(this.tune.launchBoost, 0.92, smoothstep(0, this.tune.maxSpeed * 0.74, speed));
    const acceleration = inputs.throttle * this.tune.acceleration * launchPunch * (usingNitro ? 1.42 : 1);
    this.state.velocity.addScaledVector(forward, acceleration * delta);

    if (inputs.brake) {
      const brakingForce = forwardSpeed > 2 ? this.tune.brake : this.tune.reverse;
      this.state.velocity.addScaledVector(forward, -brakingForce * delta);
    }

    forwardSpeed = this.state.velocity.dot(forward);

    const steerSweetSpot = 1 + smoothstep(8, 24, speed) * 0.18 - smoothstep(34, 52, speed) * 0.2;
    const steerPower = this.tune.steering * lerp(1, this.tune.highSpeedSteerDrop, speed01) * steerSweetSpot;
    const steerDirection = forwardSpeed >= -1 ? 1 : -1;
    const driftBonus = drifting ? 1.55 : 1.14;
    this.state.yaw += inputs.steer * steerPower * driftBonus * steerDirection * delta * smoothstep(1, 10, speed);

    forward = new THREE.Vector3(-Math.sin(this.state.yaw), 0, -Math.cos(this.state.yaw));
    right = new THREE.Vector3(Math.cos(this.state.yaw), 0, -Math.sin(this.state.yaw));
    forwardSpeed = this.state.velocity.dot(forward);

    const desiredForward = clamp(forwardSpeed, -this.tune.reverse, maxSpeed);
    const grip = drifting ? this.tune.driftGrip : this.tune.grip;
    const slideAmount = drifting ? this.tune.driftSlide : this.tune.turnSlide;
    const targetLateral = inputs.steer * speed * slideAmount * smoothstep(8, 32, speed);
    const correctedLateral = lerp(lateralSpeed, targetLateral, clamp(grip * delta, 0, 1));
    this.state.velocity.copy(forward.multiplyScalar(desiredForward).add(right.multiplyScalar(correctedLateral)));

    const drag = onRoad ? this.tune.drag : this.tune.offroadDrag;
    this.state.velocity.multiplyScalar(Math.max(0, 1 - drag * delta));
    this.state.position.addScaledVector(this.state.velocity, delta);

    if (usingNitro) {
      this.state.nitro = Math.max(0, this.state.nitro - delta * 0.28);
      this.state.boostFlash = 1;
    } else {
      this.state.nitro = Math.min(1, this.state.nitro + delta * (drifting ? 0.18 : 0.07));
      this.state.boostFlash = Math.max(0, this.state.boostFlash - delta * 4);
    }

    if (drifting) {
      this.state.driftCharge = Math.min(1, this.state.driftCharge + delta * 0.7);
    } else {
      this.state.driftCharge = Math.max(0, this.state.driftCharge - delta * 1.5);
    }

    for (const pad of this.world.boostPads) {
      if (this.state.position.distanceTo(pad.position) < 5.1 && speed > 12) {
        this.state.velocity.addScaledVector(forward, 11 * delta);
        this.state.nitro = Math.min(1, this.state.nitro + delta * 0.55);
      }
    }

    if (Math.abs(this.state.position.x) > 230 || Math.abs(this.state.position.z) > 185) {
      this.reset();
    }

    this.state.speed = speed;
    this.state.forwardSpeed = forwardSpeed;
    this.state.onRoad = onRoad;
    this.state.drifting = drifting;
    this.state.usingNitro = usingNitro;
    this.updateVisuals(delta, inputs, forwardSpeed);
  }

  updateVisuals(delta, inputs, forwardSpeed) {
    const speed = this.state.speed;
    const lean = -inputs.steer * smoothstep(8, 38, speed) * (this.state.drifting ? 0.26 : 0.17);
    const pitch = 0.05 * inputs.throttle - 0.04 * inputs.brake + this.state.boostFlash * 0.04;
    this.state.steeringVisual = lerp(this.state.steeringVisual, inputs.steer, delta * 9);
    this.group.position.copy(this.state.position);
    this.group.rotation.set(pitch, this.state.yaw, lean);
    this.shadow.position.copy(this.state.position);

    for (const wheel of this.wheels) {
      wheel.rotation.x -= forwardSpeed * delta * 2.7;
      wheel.rotation.y = this.frontWheels.includes(wheel) ? this.state.steeringVisual * 0.5 : 0;
    }

    this.flameMaterial.opacity = lerp(this.flameMaterial.opacity, this.state.usingNitro ? 0.96 : 0, delta * 11);
    this.flame.scale.setScalar(0.95 + Math.sin(performance.now() * 0.034) * 0.16 + this.state.boostFlash * 0.75);

    for (const streak of this.streaks) {
      streak.material.opacity = lerp(streak.material.opacity, this.state.usingNitro || speed > 22 ? 0.5 : 0, delta * 8);
      streak.scale.z = 0.8 + smoothstep(18, 46, speed) * 1.6 + this.state.boostFlash * 0.7;
    }
  }

  getForward() {
    return new THREE.Vector3(-Math.sin(this.state.yaw), 0, -Math.cos(this.state.yaw));
  }
}
