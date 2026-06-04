import './styles.css';
import * as THREE from 'three';
import { CarController } from './car.js';
import { Hud } from './hud.js';
import { InputController } from './input.js';
import { TimeTrial } from './timeTrial.js';
import { createWorld } from './world.js';
import { lerp, smoothstep } from './utils.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffc48e);
scene.fog = new THREE.Fog(0xffc48e, 110, 360);

const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 800);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const hemi = new THREE.HemisphereLight(0xfff4df, 0x236b7c, 2.1);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xfff0c4, 2.7);
sun.position.set(-35, 46, 22);
sun.castShadow = true;
sun.shadow.camera.left = -190;
sun.shadow.camera.right = 190;
sun.shadow.camera.top = 170;
sun.shadow.camera.bottom = -170;
sun.shadow.mapSize.set(2048, 2048);
scene.add(sun);

const world = createWorld(scene);
const car = new CarController(scene, world);
const input = new InputController();
const trial = new TimeTrial(world);
const hud = new Hud();
const clock = new THREE.Clock();

const restart = () => {
  input.releaseAll();
  car.reset();
  trial.reset();
  trial.startCountdown();
  hud.update(car, trial);
};

const updateCamera = (delta) => {
  const forward = car.getForward();
  const speed = car.state.speed;
  const distance = lerp(9.8, 15.8, smoothstep(8, 54, speed)) + car.state.boostFlash * 0.35;
  const height = lerp(4.6, 7.1, smoothstep(14, 56, speed));
  const target = car.state.position.clone()
    .addScaledVector(forward, -distance)
    .add(new THREE.Vector3(0, height, 0));
  const lag = 1 - Math.pow(1 - 0.1, delta * 60);
  camera.position.lerp(target, lag);
  camera.lookAt(
    car.state.position.x + forward.x * 4.2,
    car.state.position.y + 1.2,
    car.state.position.z + forward.z * 4.2
  );
  camera.fov = lerp(camera.fov, 58 + smoothstep(16, 60, speed) * 5 + car.state.boostFlash * 2.2, delta * 5.5);
  camera.updateProjectionMatrix();
};

const tick = () => {
  const delta = Math.min(clock.getDelta(), 0.033);

  if (input.consumeRestart()) restart();
  if (input.consumeStart()) trial.startCountdown();

  const controls = input.getInputs(trial.canDrive);
  car.update(delta, controls);
  trial.update(delta, car.state.position);
  hud.update(car, trial);
  updateCamera(delta);

  renderer.domElement.style.filter = `saturate(${1 + car.state.boostFlash * 0.32 + smoothstep(22, 46, car.state.speed) * 0.1}) brightness(${1 + car.state.boostFlash * 0.06})`;
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
};

window.__driveDebug = {
  restart,
  snapshot() {
    return {
      speed: Math.round(car.state.speed * 3.4),
      mode: trial.mode,
      elapsed: Number(trial.elapsed.toFixed(2)),
      progress: Number(trial.progress.toFixed(2)),
      x: Number(car.state.position.x.toFixed(2)),
      z: Number(car.state.position.z.toFixed(2))
    };
  }
};

restart();
tick();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
