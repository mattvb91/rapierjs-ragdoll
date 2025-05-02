/**
 * Live demo: https://mavon.ie/demos/rapierjs-ragdoll
 */

import { DRACOLoader, GLTFLoader, OrbitControls, Sky, Timer } from 'three/examples/jsm/Addons.js';
import './style.css';

import { Pane } from 'tweakpane';

import RAPIER, { World } from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import { RapierDebugRenderer } from './DebugRenderer';
import { Ragdoll } from './Ragdoll';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
document.body.appendChild(renderer.domElement);

const sky = new Sky();
sky.scale.setScalar(450000);

const phi = THREE.MathUtils.degToRad(30);
const theta = THREE.MathUtils.degToRad(180);
const sunPosition = new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
sky.material.uniforms.sunPosition.value = sunPosition;

const orbitControls = new OrbitControls(camera, renderer.domElement)

const plane = new THREE.PlaneGeometry(20, 20, 1)
const planeMesh = new THREE.Mesh(plane, new THREE.MeshStandardMaterial({ color: 'lightgray' }))
planeMesh.rotateX(-Math.PI / 2)
planeMesh.receiveShadow = true

const ambient = new THREE.AmbientLight()
ambient.intensity = 2

const pointLight = new THREE.PointLight('white', 60, 30, 2);
pointLight.position.set(0, 5, -5);
pointLight.castShadow = true
pointLight.lookAt(new THREE.Vector3(0, 0, 0))

scene.add(sky, planeMesh, ambient, pointLight);
camera.position.set(0, 4, 3);

const PARAMS = {
  gravity: -9.81,
  debugPhysics: true,
  rigidBodyCount: 0,
  ragdollsCount: 0
}

await RAPIER.init()
const world = new World({ x: 0, y: PARAMS.gravity, z: 0 })
const rapierDebugRender = new RapierDebugRenderer(scene, world, PARAMS.debugPhysics)

const physicsPlane = RAPIER.ColliderDesc.cuboid(10, 0.2, 10);
const physicsPlaneDesc = RAPIER.RigidBodyDesc.fixed();
const physicsPlaneRigidBody = world.createRigidBody(physicsPlaneDesc);
physicsPlaneRigidBody.setTranslation({ x: 0, y: -.2, z: 0 }, false)
world.createCollider(physicsPlane, physicsPlaneRigidBody);

const loader = new GLTFLoader();
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://raw.githubusercontent.com/google/draco/refs/heads/main/javascript/');
loader.setDRACOLoader(dracoLoader);

const ragdolls = [new Ragdoll(world, scene, loader)]
const timer = new Timer;

const pane = new Pane();
const btn = pane.addButton({
  title: 'Add Ragdoll',
  label: '',   // optional
});

pane.addBinding(PARAMS, 'debugPhysics').on('change', (ev) => rapierDebugRender.toggleVisible(ev.value))
btn.on('click', () => {
  ragdolls.push(new Ragdoll(world, scene, loader))
});

// Add a monitor to Tweakpane
pane.addBinding(PARAMS, 'rigidBodyCount', { disabled: true, step: 1 })
pane.addBinding(PARAMS, 'ragdollsCount', { disabled: true, step: 1 })

pane.addBinding(PARAMS, 'gravity', {
  step: 0.1,
  max: 10,
  min: -10
});

var stats = new Stats();
stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom

document.body.appendChild(stats.dom);

const raycaster = new THREE.Raycaster()

const windowSize = {
  width: window.innerWidth,
  height: window.innerHeight
}

let cursor = new THREE.Vector2()

document.addEventListener('mousemove', (ev) => {
  cursor.setX(ev.clientX / windowSize.width * 2 - 1)
  cursor.setY(-(ev.clientY / windowSize.height * 2 - 1))

});

const mouseHelper = new THREE.SphereGeometry(0.1, 16, 16)
const mouseHelperMesh = new THREE.Mesh(mouseHelper, new THREE.MeshBasicMaterial({
  color: "yellow",
  opacity: 0.6,
  transparent: true
}))
mouseHelperMesh.visible = false
mouseHelperMesh.position.set(0, 0, 0)
scene.add(mouseHelperMesh)

let collision: THREE.Intersection<THREE.Object3D>
let activeRagdoll: Ragdoll | null = null
let pulling = false

window.addEventListener('mousedown', ev => {
  if (ev.button === 0 && activeRagdoll) {
    pulling = true
  }
})

window.addEventListener('mouseup', () => {
  pulling = false
  activeRagdoll?.releasePull()
  activeRagdoll = null
})

function animate() {
  timer.update()
  stats.begin()

  PARAMS.rigidBodyCount = world.bodies.len()
  PARAMS.ragdollsCount = ragdolls.length

  pane.refresh()

  world.gravity = new RAPIER.Vector3(0, PARAMS.gravity, 0);
  world.step()
  ragdolls.forEach(ragdoll => ragdoll.update(timer.getDelta()))
  rapierDebugRender.update()
  orbitControls.update()

  renderer.render(scene, camera);
  raycaster.setFromCamera(cursor, camera)

  if (collision = raycaster.intersectObjects(ragdolls.map(obj => obj?.mesh ?? new THREE.Object3D))[0]) {
    ragdolls.forEach(doll => {
      if (doll.mesh?.getObjectByProperty('uuid', collision.object?.uuid)) {
        activeRagdoll = doll
      }
    })

    mouseHelperMesh.visible = true
    mouseHelperMesh.position.set(collision.point.x, collision.point.y, collision.point.z)
    orbitControls.enableRotate = false
  } else {
    mouseHelperMesh.visible = false
    orbitControls.enableRotate = true
  }

  if(activeRagdoll && pulling) {
    activeRagdoll.mousePull(cursor, camera, collision?.point)
  }
  
  stats.end()
}

renderer.setAnimationLoop(animate);