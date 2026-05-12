import * as THREE from '../build/three.module.js';
import { OrbitControls } from '../jsm/controls/OrbitControls.js';
import { GLTFLoader } from '../jsm/loaders/GLTFLoader.js';

import { createScene, createCamera, createRenderer } from './setup.js';

const canvas = document.querySelector('#app');

const scene = createScene();
const camera = createCamera();
const renderer = createRenderer(canvas);

console.log("MAIN RUNNING");

const grid = new THREE.GridHelper(50, 50);
scene.add(grid);


const controls = new OrbitControls(camera, renderer.domElement);

// smooth movement
controls.enableDamping = true;
controls.dampingFactor = 0.05;

controls.minDistance = 2;
controls.maxDistance = 50;

//add room
const gltfLoader = new GLTFLoader();

gltfLoader.load(
    '../models/room/scene.gltf',

    (gltf) => {
        const room = gltf.scene;
        room.position.set(0, 0, 0);
        room.scale.set(1, 1, 1);

        scene.add(room);
        console.log("Room loaded");
    },
    undefined,
    (error) => {
        console.error("Error loading room:", error);
    }
);


//
// FLOOR
//
const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(50, 50),
    new THREE.MeshStandardMaterial({ color: 0x808080 })
);

floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;

scene.add(floor);

//
// LIGHTING
//
const ambient = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambient);

const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(5, 10, 5);
dirLight.castShadow = true;

scene.add(dirLight);

//
// TEST OBJECT
//
const cube = new THREE.Mesh(
    new THREE.BoxGeometry(),
    new THREE.MeshStandardMaterial({ color: 0x00ffcc })
);

cube.position.y = 5.5;
cube.castShadow = true;

scene.add(cube);

//
// LOOP
//
function animate() {
    requestAnimationFrame(animate);

    cube.rotation.y += 0.01;

    renderer.render(scene, camera);
}

animate();

//
// RESIZE HANDLING
//
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
});