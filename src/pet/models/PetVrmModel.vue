<template>
  <div class="vrm-wrap" aria-hidden="true">
    <canvas ref="canvasRef" class="vrm-canvas" />
    <div v-if="loadError" class="vrm-fallback">乐心</div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from "vue";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRMUtils, type VRM } from "@pixiv/three-vrm";
import type { PetIdleMotion } from "../motions";
import type { PetMood } from "../types";
import {
  resolveVrmPose,
  type BoneEuler,
  type VrmBoneName,
} from "../vrmPoses";
import gimoUrl from "../vrm_mode/GimoZard_VRM.vrm?url";

const props = withDefaults(
  defineProps<{
    mood: PetMood;
    gaze: { x: number; y: number };
    motion?: PetIdleMotion;
    blinking?: boolean;
    lifting?: boolean;
    faceYaw?: number;
    orbitYaw?: number;
    orbitPitch?: number;
  }>(),
  {
    motion: "idle-float",
    blinking: false,
    lifting: false,
    faceYaw: 0,
    orbitYaw: 0,
    orbitPitch: 8,
  }
);

const canvasRef = ref<HTMLCanvasElement | null>(null);
const loadError = ref(false);

let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let vrm: VRM | null = null;
let modelRoot: THREE.Group | null = null;
let baseRootY = 0;
let modelHeight = 1.5;
let cameraDist = 3.2;
let raf = 0;
let lastTs = 0;
let disposed = false;
let clockT = 0;
let ro: ResizeObserver | null = null;

const FACE_FRONT = 0;

const BONE_NAMES: VrmBoneName[] = [
  "hips",
  "spine",
  "chest",
  "upperChest",
  "neck",
  "head",
  "leftShoulder",
  "rightShoulder",
  "leftUpperArm",
  "leftLowerArm",
  "leftHand",
  "rightUpperArm",
  "rightLowerArm",
  "rightHand",
  "leftUpperLeg",
  "leftLowerLeg",
  "rightUpperLeg",
  "rightLowerLeg",
];

const smoothedQ: Partial<Record<VrmBoneName, THREE.Quaternion>> = {};
const targetQ = new THREE.Quaternion();
const targetE = new THREE.Euler(0, 0, 0, "XYZ");

function boneNode(name: VrmBoneName) {
  // 只用 normalized：autoUpdate 会把 normalized 同步到 raw。
  // 若改 raw，下一帧 humanoid.update() 会被 T-pose 覆盖。
  return vrm?.humanoid?.getNormalizedBoneNode(name) ?? null;
}

function lerpBone(name: VrmBoneName, target: BoneEuler | undefined, alpha: number) {
  const node = boneNode(name);
  if (!node) return;

  const tx = target?.x ?? 0;
  const ty = target?.y ?? 0;
  const tz = target?.z ?? 0;

  targetE.set(tx, ty, tz, "XYZ");
  targetQ.setFromEuler(targetE);

  if (!smoothedQ[name]) {
    smoothedQ[name] = new THREE.Quaternion();
  }
  smoothedQ[name]!.slerp(targetQ, alpha);
  node.quaternion.copy(smoothedQ[name]!);
}

function fitCameraToVrm(model: VRM) {
  if (!camera || !modelRoot) return;

  modelRoot.position.set(0, 0, 0);
  modelRoot.rotation.set(0, FACE_FRONT, 0);
  modelRoot.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(model.scene);
  if (box.isEmpty()) return;
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  modelRoot.position.x = -center.x;
  modelRoot.position.z = -center.z;
  modelRoot.position.y = -box.min.y;
  modelRoot.updateMatrixWorld(true);
  baseRootY = modelRoot.position.y;

  const height = Math.max(0.2, size.y);
  const width = Math.max(0.1, size.x);
  modelHeight = height;
  cameraDist = Math.max(height * 2.05, width * 2.6);

  camera.fov = 32;
  camera.near = Math.max(0.05, cameraDist / 100);
  camera.far = cameraDist * 40;
  updateOrbitCamera();
}

function updateOrbitCamera() {
  if (!camera) return;
  const yaw = (props.orbitYaw * Math.PI) / 180;
  const pitch = (props.orbitPitch * Math.PI) / 180;
  const lookY = modelHeight * 0.48;
  const dist = cameraDist;
  const cp = Math.cos(pitch);
  camera.position.set(
    Math.sin(yaw) * cp * dist,
    lookY + Math.sin(pitch) * dist * 0.85,
    Math.cos(yaw) * cp * dist
  );
  camera.lookAt(0, lookY, 0);
  camera.updateProjectionMatrix();
}

function applyPose(dt: number) {
  if (!vrm?.humanoid || !modelRoot) return;
  clockT += dt;
  const pose = resolveVrmPose(props.motion, props.mood, clockT, {
    lifting: props.lifting,
    gaze: props.gaze,
  });
  const rate =
    props.lifting ? 14 : props.motion === "vrm-walk" ? 7.5 : 10;
  const alpha = 1 - Math.exp(-dt * rate);

  for (const name of BONE_NAMES) {
    lerpBone(name, pose.bones[name], alpha);
  }

  vrm.humanoid.update();

  const targetY = baseRootY + (pose.rootY ?? 0);
  modelRoot.position.y += (targetY - modelRoot.position.y) * alpha;
  const yaw = FACE_FRONT + (pose.rootYaw ?? 0) + props.faceYaw;
  modelRoot.rotation.y += (yaw - modelRoot.rotation.y) * Math.min(1, alpha * 1.4);
}

const lookTarget = new THREE.Vector3();

function applyLookAt() {
  if (!vrm?.lookAt || props.lifting || !modelRoot) return;
  // 仅眼球注视：目标夹在脸前方小范围内，不拧头骨
  const gx = Math.max(-1, Math.min(1, props.gaze.x / 2.2));
  const gy = Math.max(-1, Math.min(1, props.gaze.y / 2.2));
  lookTarget.set(gx * 0.55, modelHeight * 0.72 - gy * 0.35, 1.35);
  modelRoot.localToWorld(lookTarget);
  vrm.lookAt.lookAt(lookTarget);
}

function applyBlink() {
  if (!vrm?.expressionManager) return;
  const blink = props.blinking || props.mood === "sleep" ? 1 : 0;
  vrm.expressionManager.setValue("blink", blink);
  if (props.mood === "happy" || props.mood === "excited") {
    vrm.expressionManager.setValue("happy", 0.4);
  } else if (props.lifting) {
    vrm.expressionManager.setValue("happy", 0);
    try {
      vrm.expressionManager.setValue("surprised", 0.25);
    } catch {
      // expression may not exist
    }
  } else {
    vrm.expressionManager.setValue("happy", 0);
  }
}

function tick(now: number) {
  if (disposed) return;
  const dt = lastTs ? Math.min(0.05, (now - lastTs) / 1000) : 0.016;
  lastTs = now;

  updateOrbitCamera();

  if (vrm) {
    applyPose(dt);
    applyLookAt();
    applyBlink();
    vrm.update(dt);
  }
  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
  raf = requestAnimationFrame(tick);
}

function resizeToCanvas() {
  const canvas = canvasRef.value;
  if (!canvas || !renderer || !camera) return;
  const width = Math.max(1, canvas.clientWidth || 180);
  const height = Math.max(1, canvas.clientHeight || 180);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

async function boot() {
  const canvas = canvasRef.value;
  if (!canvas) return;

  const width = Math.max(1, canvas.clientWidth || 180);
  const height = Math.max(1, canvas.clientHeight || 180);

  renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    premultipliedAlpha: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height, false);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(32, width / height, 0.1, 100);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x556688, 1.05);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffffff, 1.25);
  key.position.set(1.4, 2.4, 2.2);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xaad8ff, 0.5);
  rim.position.set(-1.6, 1.2, -1.0);
  scene.add(rim);
  const fill = new THREE.DirectionalLight(0xffe8d8, 0.28);
  fill.position.set(-0.4, 1.0, 1.8);
  scene.add(fill);

  // 脚下影由预览 CSS .orbit-floor 统一绘制，此处不再加 3D 圆影

  modelRoot = new THREE.Group();
  scene.add(modelRoot);

  const loader = new GLTFLoader();
  loader.register((parser) => new VRMLoaderPlugin(parser));

  try {
    const gltf = await loader.loadAsync(gimoUrl);
    if (disposed) return;
    const loaded = gltf.userData.vrm as VRM | undefined;
    if (!loaded) {
      loadError.value = true;
      return;
    }

    // combineSkeletons 在部分 VRM0 上会弄坏蒙皮绑定，导致姿态不生效
    VRMUtils.removeUnnecessaryVertices(gltf.scene);
    VRMUtils.rotateVRM0(loaded);

    loaded.humanoid.autoUpdateHumanBones = true;

    vrm = loaded;
    modelRoot.add(vrm.scene);
    fitCameraToVrm(vrm);

    // 立刻落到休息姿势，避免首帧 T-pose
    clockT = 0;
    for (const k of Object.keys(smoothedQ)) {
      delete smoothedQ[k as VrmBoneName];
    }
    applyPose(1);
    vrm.humanoid.update();
    vrm.update(0);
  } catch {
    loadError.value = true;
  }

  resizeToCanvas();
  raf = requestAnimationFrame(tick);
}

onMounted(() => {
  void boot();
  const canvas = canvasRef.value;
  if (canvas && typeof ResizeObserver !== "undefined") {
    ro = new ResizeObserver(() => resizeToCanvas());
    ro.observe(canvas);
  }
});

onUnmounted(() => {
  disposed = true;
  ro?.disconnect();
  ro = null;
  if (raf) cancelAnimationFrame(raf);
  if (vrm) {
    modelRoot?.remove(vrm.scene);
    VRMUtils.deepDispose(vrm.scene);
    vrm = null;
  }
  renderer?.dispose();
  renderer = null;
  scene = null;
  camera = null;
  modelRoot = null;
});

watch(
  () => [props.orbitYaw, props.orbitPitch],
  () => {
    updateOrbitCamera();
  }
);

watch(
  () => props.lifting,
  (lifting) => {
    if (lifting) applyPose(0.2);
  }
);
</script>

<style scoped>
.vrm-wrap {
  position: relative;
  width: 100%;
  height: 100%;
  pointer-events: none;
  overflow: visible;
  transform: translateZ(0);
  transform-style: flat;
}

.vrm-canvas {
  width: 100%;
  height: 100%;
  display: block;
  overflow: visible;
}

.vrm-fallback {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: #9adfff;
  font-size: 14px;
  opacity: 0.8;
}
</style>
