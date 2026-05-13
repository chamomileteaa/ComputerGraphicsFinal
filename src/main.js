import * as THREE from '../build/three.module.js';
import { PointerLockControls } from 'https://esm.sh/three@0.165.0/examples/jsm/controls/PointerLockControls.js';
import { GLTFLoader } from '../jsm/loaders/GLTFLoader.js';

import RAPIER from 'https://esm.sh/@dimforge/rapier3d-compat';

import {
    createScene,
    createCamera,
    createRenderer
} from './setup.js';

await RAPIER.init();

//
// BASIC SETUP
//
const canvas = document.querySelector('#app');

const scene = createScene();
const camera = createCamera();
const renderer = createRenderer(canvas);

//pointer controls
const overlay = document.querySelector('#overlay');
const crosshair = document.querySelector('#crosshair');

const pointerControls = new PointerLockControls(camera, document.body);

scene.add(pointerControls.object);

overlay.addEventListener('click', () => {

    pointerControls.lock();

});

pointerControls.addEventListener('lock', () => {

    overlay.style.display = 'none';

    crosshair.style.display = 'block';

});

pointerControls.addEventListener('unlock', () => {

    overlay.style.display = 'flex';

    crosshair.style.display = 'none';

});

const keys = {
    w: false,
    a: false,
    s: false,
    d: false
};

const moveSpeed = 8;

document.addEventListener('keydown', (e) => {

    const key = e.key.toLowerCase();

    if (keys.hasOwnProperty(key)) {
        keys[key] = true;
    }

});

document.addEventListener('keyup', (e) => {

    const key = e.key.toLowerCase();

    if (keys.hasOwnProperty(key)) {
        keys[key] = false;
    }

});

//
// LIGHTING
//
const ambient = new THREE.AmbientLight(0xffffff, 1.5);
scene.add(ambient);

const dirLight = new THREE.DirectionalLight(0xffffff, 2);
dirLight.position.set(5, 10, 5);
dirLight.castShadow = true;

scene.add(dirLight);

//
// PHYSICS WORLD
//
const world = new RAPIER.World({
    x: 0,
    y: -9.81,
    z: 0
});

//
// PHYSICS CUBE
//
const cubeMesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({
        color: 0xff8a3d,
        roughness: 0.48,
        metalness: 0.08
    })
);

cubeMesh.castShadow = true;
scene.add(cubeMesh);

const cubeBodyDesc = RAPIER.RigidBodyDesc
    .dynamic()
    .setTranslation(0, 3, 0)
    .setLinearDamping(0.35)
    .setAngularDamping(0.6);

const cubeBody = world.createRigidBody(cubeBodyDesc);

const cubeCollider = RAPIER.ColliderDesc
    .cuboid(0.5, 0.5, 0.5)
    .setDensity(1.2)
    .setRestitution(0.25)
    .setFriction(0.8);

world.createCollider(cubeCollider, cubeBody);
//
// Add cat
//
const gltfLoader = new GLTFLoader();

gltfLoader.load(
    '../models/cat/cat.gltf',

    (gltf) => {

        const cat = gltf.scene;

        cat.scale.set(3, 3, 3);
        cat.position.set(-3, -3, -3);

        scene.add(cat);
    },

    undefined,

    (error) => {
        console.error(error);
    }
);

//
// ROOM MODEL + ROOM COLLIDERS
//
gltfLoader.load(
    '../models/room/scene.gltf',
    //changes

    (gltf) => {

        const room = gltf.scene;

        room.scale.set(20, 20, 20);
        room.position.set(0, 3, 3.2);

        scene.add(room);

        //
        // CREATE STATIC ROOM PHYSICS BODY
        //
        const roomBodyDesc = RAPIER.RigidBodyDesc.fixed();

        const roomBody = world.createRigidBody(roomBodyDesc);

        //
        // CREATE COLLIDERS FROM ROOM MESHES
        //
        room.traverse((child) => {

            if (!child.isMesh) return;

            child.castShadow = true;
            child.receiveShadow = true;

            const geometry = child.geometry;

            // ensure geometry exists
            if (!geometry.attributes.position) return;

            const vertices = geometry.attributes.position.array;

            // trimesh requires indexed geometry
            if (!geometry.index) return;

            const indices = geometry.index.array;

            //
            // CREATE TRIMESH COLLIDER
            //
            const colliderDesc = RAPIER.ColliderDesc.trimesh(
                vertices,
                indices
            );

            world.createCollider(
                colliderDesc,
                roomBody
            );
        });

        console.log('Room + colliders loaded');
    },

    undefined,

    (error) => {
        console.error(error);
    }
);

//
//FLOOR
//

const floorGeometry = new THREE.BoxGeometry(30, 0.4, 30);
const floorMaterial = new THREE.MeshLambertMaterial({
    map: new THREE.TextureLoader().load("../assets/textures/grass.jpg"),
});
const floor = new THREE.Mesh(floorGeometry, floorMaterial);

floor.position.y = -8.5;
floor.position.x = -3;

floor.receiveShadow = true;
scene.add(floor);

const floorBodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.2, 0);
const floorBody = world.createRigidBody(floorBodyDesc);
const floorCollider = RAPIER.ColliderDesc.cuboid(15, 0.2, 15).setFriction(1.0);
world.createCollider(floorCollider, floorBody);

///
//WALL
//

const wallGeometry = new THREE.BoxGeometry(30, 20, 0.4);
const wallMaterial = new THREE.MeshLambertMaterial({
    map: new THREE.TextureLoader().load("../assets/textures/field.jpg"),
});
const wall = new THREE.Mesh(wallGeometry, wallMaterial);

wall.position.y = 1.5;
wall.position.x = -3;
wall.position.z = -10.5

wall.receiveShadow = true;
scene.add(wall);

const wallBodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0, 2.3, -10);
const wallBody = world.createRigidBody(wallBodyDesc);
world.createCollider(RAPIER.ColliderDesc.cuboid(15, 2.5, 0.2).setFriction(0.8), wallBody);


//
// GRAB SYSTEM
//
const raycaster = new THREE.Raycaster();
const centre = new THREE.Vector2(0, 0);
const cameraForward = new THREE.Vector3();
const previousGrabPosition = new THREE.Vector3();
const currentGrabPosition = new THREE.Vector3();
const grabVelocity = new THREE.Vector3();
const targetPosition = new THREE.Vector3();

let isMouseDown = false;
let isGrabbing = false;
let grabDistance = 4;

const maxGrabDistance = 7;
const grabPullStrength = 14;
const throwStrength = 10;

//
// INPUT
//
document.addEventListener('mousedown', (event) => {

    if (event.button !== 0) return;

    isMouseDown = true;

    raycaster.setFromCamera(centre, camera);

    const hits = raycaster.intersectObject(cubeMesh);

    if (hits.length > 0 && hits[0].distance <= maxGrabDistance) {

        isGrabbing = true;

        grabDistance = THREE.MathUtils.clamp(
            hits[0].distance,
            2,
            maxGrabDistance
        );

        const position = cubeBody.translation();

        previousGrabPosition.set(
            position.x,
            position.y,
            position.z
        );

        currentGrabPosition.copy(previousGrabPosition);

        cubeBody.setAngvel({
            x: 0,
            y: 0,
            z: 0
        }, true);
    }
});

document.addEventListener('mouseup', (event) => {

    if (event.button !== 0) return;
    isMouseDown = false;

    if (isGrabbing) {

        camera.getWorldDirection(cameraForward);

        const releaseVelocity = {
            x: grabVelocity.x + cameraForward.x * throwStrength,
            y: grabVelocity.y + cameraForward.y * throwStrength + 1.5,
            z: grabVelocity.z + cameraForward.z * throwStrength
        };

        cubeBody.setLinvel(releaseVelocity, true);

        isGrabbing = false;
    }
});

//
// UPDATE GRAB
//
function updateGrab(delta) {

    if (!isGrabbing || !isMouseDown) return;

    camera.getWorldDirection(cameraForward);

    targetPosition
        .copy(camera.position)
        .addScaledVector(cameraForward, grabDistance);

    const cubePosition = cubeBody.translation();

    currentGrabPosition.set(
        cubePosition.x,
        cubePosition.y,
        cubePosition.z
    );

    const desiredVelocity = {
        x: (targetPosition.x - cubePosition.x) * grabPullStrength,
        y: (targetPosition.y - cubePosition.y) * grabPullStrength,
        z: (targetPosition.z - cubePosition.z) * grabPullStrength
    };

    cubeBody.setLinvel(desiredVelocity, true);

    cubeBody.setAngvel({
        x: 0,
        y: 0,
        z: 0
    }, true);

    grabVelocity
        .copy(currentGrabPosition)
        .sub(previousGrabPosition)
        .divideScalar(Math.max(delta, 0.001));

    previousGrabPosition.copy(currentGrabPosition);
}

//
// SYNC PHYSICS
//
function syncCubeMesh() {

    const position = cubeBody.translation();
    const rotation = cubeBody.rotation();

    cubeMesh.position.set(
        position.x,
        position.y,
        position.z
    );

    cubeMesh.quaternion.set(
        rotation.x,
        rotation.y,
        rotation.z,
        rotation.w
    );
}

const moveDirection = new THREE.Vector3();
const rightVector = new THREE.Vector3();

function updateMovement(delta) {

    moveDirection.set(0, 0, 0);

    camera.getWorldDirection(moveDirection);

    moveDirection.y = 0;
    moveDirection.normalize();

    rightVector.crossVectors(moveDirection, camera.up).normalize();

    if (keys.w) {
        camera.position.addScaledVector(moveDirection, moveSpeed * delta);
    }

    if (keys.s) {
        camera.position.addScaledVector(moveDirection, -moveSpeed * delta);
    }

    if (keys.d) {
        camera.position.addScaledVector(rightVector, moveSpeed * delta);
    }

    if (keys.a) {
        camera.position.addScaledVector(rightVector, -moveSpeed * delta);
    }
}

//
// ANIMATION LOOP
//
const clock = new THREE.Clock();

let physicsAccumulator = 0;
const fixedStep = 1 / 60;

function animate() {

    requestAnimationFrame(animate);

    const delta = Math.min(clock.getDelta(), 0.05);
    updateMovement(delta);

    updateGrab(delta);

    physicsAccumulator += delta;

    while (physicsAccumulator >= fixedStep) {

        world.timestep = fixedStep;
        world.step();

        physicsAccumulator -= fixedStep;
    }

    syncCubeMesh();

    renderer.render(scene, camera);
}

animate();
//
// RESIZE
//
window.addEventListener('resize', () => {

    camera.aspect = window.innerWidth / window.innerHeight;

    camera.updateProjectionMatrix();

    renderer.setSize(
        window.innerWidth,
        window.innerHeight
    );
});