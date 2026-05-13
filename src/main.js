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

const grabbableObjects = [];

let friendship = 0;
let friendshipComplete = false;


const friendshipBar = document.querySelector('#friendship-bar');

const objectsToRemove = [];

// AUDIO
//
const listener = new THREE.AudioListener();

camera.add(listener);

const successSound = new THREE.Audio(listener);

const audioLoader = new THREE.AudioLoader();

audioLoader.load(
    '../assets/audio/simple-and-clean-melody.mp3',

    (buffer) => {

        successSound.setBuffer(buffer);

        successSound.setVolume(0.7);
    }
);


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
// Add cat
//
const gltfLoader = new GLTFLoader();

const textureLoader = new THREE.TextureLoader();

gltfLoader.load(
    '../models/cat/cat.gltf',

    (gltf) => {

        const cat = gltf.scene;

        //
        // LOAD CAT TEXTURE
        //
        const catTexture = textureLoader.load(
            '../assets/textures/Cat tex.png'
        );

        //
        // APPLY TEXTURE TO ALL CAT MESHES
        //
        cat.traverse((child) => {

            if (!child.isMesh) return;

            child.material = new THREE.MeshStandardMaterial({
                map: catTexture
            });

            child.castShadow = true;
            child.receiveShadow = true;
        });

        cat.scale.set(3, 3, 3);
        cat.position.set(-3, -3, -3);

        scene.add(cat);

        //
        // CAT PHYSICS BODY
        //
        const catBodyDesc = RAPIER.RigidBodyDesc
            .fixed()
            .setTranslation(-3, -3, -3);

        const catBody = world.createRigidBody(catBodyDesc);

        //
        // SIMPLE CAT COLLIDER
        //
        const catCollider = RAPIER.ColliderDesc
            .cuboid(1.5, 1.5, 1.5)
            .setSensor(true);

        world.createCollider(catCollider, catBody);

        //
        // SAVE REFERENCES
        //
        cat.userData.rigidBody = catBody;
        cat.userData.collider = catCollider;

        window.catBody = catBody;
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

//add bread
let breadMesh;
let breadBody;

// add bread
gltfLoader.load(
    '../models/bread/meshy_ai_a_realistic_4hd_image_0117145710_texture.glb',

    (gltf) => {

        breadMesh = gltf.scene;

        breadMesh.scale.set(1, 1, 1);
        breadMesh.position.set(5, 3, 3.2);

        breadMesh.userData.friendshipValue = 25; //GOOD obj //bad=-10

        scene.add(breadMesh);

        //
        // BREAD PHYSICS BODY
        //
        const breadBodyDesc = RAPIER.RigidBodyDesc
            .dynamic()
            .setTranslation(-11, 0, 0)
            .setLinearDamping(0.35)
            .setAngularDamping(0.6);

        breadBody = world.createRigidBody(breadBodyDesc);

        //
        // SIMPLE COLLIDER
        //
        const breadCollider = RAPIER.ColliderDesc
            .cuboid(0.5, 0.5, 0.5)
            .setDensity(1.0)
            .setFriction(0.8);

        const breadColliderRef =
            world.createCollider(breadCollider, breadBody);

        breadMesh.userData.collider = breadColliderRef;

        grabbableObjects.push({
            mesh: breadMesh,
            body: breadBody
        });

    },

    undefined,

    (error) => {
        console.error(error);
    }
);

//add fish
let fishMesh;
let fishBody;

gltfLoader.load(
    '../models/fish/animated_low_poly_fish.glb',

    (gltf) => {

        fishMesh = gltf.scene;

        fishMesh.scale.set(2, 2, 2);
        fishMesh.position.set(2, 3, 0);

        fishMesh.userData.friendshipValue = 25; //GOOD obj //bad=-10
        scene.add(fishMesh);

        //
        // PHYSICS
        //
        const fishBodyDesc = RAPIER.RigidBodyDesc
            .dynamic()
            .setTranslation(-13, 0, -5); //change x here for location

        fishBody = world.createRigidBody(fishBodyDesc);

        const fishCollider = RAPIER.ColliderDesc
            .cuboid(0.5, 0.5, 0.5);

        const fishColliderRef =
            world.createCollider(fishCollider, fishBody);

        fishMesh.userData.collider = fishColliderRef;

        //
        // SAVE AS GRABBABLE
        //
        grabbableObjects.push({
            mesh: fishMesh,
            body: fishBody
        });
    }
);

//add milk

let milkMesh;
let milkBody;

gltfLoader.load(
    '../models/milk/cc0_milk_carton.glb',

    (gltf) => {

        milkMesh = gltf.scene;

        milkMesh.scale.set(8, 8, 8);
        milkMesh.position.set(2, 3, 0);

        milkMesh.userData.friendshipValue = 25; //GOOD obj //bad=-10
        scene.add(milkMesh);

        // PHYSICS
        const milkBodyDes = RAPIER.RigidBodyDesc
            .dynamic()
            .setTranslation(10, 0, -5); //change x here for location

        milkBody = world.createRigidBody(milkBodyDes);

        const milkCollider = RAPIER.ColliderDesc
            .cuboid(0.5, 0.5, 0.5);

        const milkColliderRef =
            world.createCollider(milkCollider, milkBody);

        milkMesh.userData.collider = milkColliderRef;

        //
        // SAVE AS GRABBABLE
        //
        grabbableObjects.push({
            mesh: milkMesh,
            body: milkBody
        });
    }
);

//ADD BIRD

let birdMesh;
let birdBody;

gltfLoader.load(
    '../models/bird/cuckoo.glb',

    (gltf) => {

        birdMesh = gltf.scene;

        birdMesh.scale.set(8, 8, 8);
        birdMesh.position.set(2, 3, 0);

        birdMesh.userData.friendshipValue = 25; //GOOD obj //bad=-10
        scene.add(birdMesh);

        // PHYSICS
        const birdBodyDes = RAPIER.RigidBodyDesc
            .dynamic()
            .setTranslation(7, 0, -5); //change x here for location

        birdBody = world.createRigidBody(birdBodyDes);

        const birdCollider = RAPIER.ColliderDesc
            .cuboid(0.5, 0.5, 0.5);

        const birdColliderRef =
            world.createCollider(birdCollider, birdBody);

        birdMesh.userData.collider = birdColliderRef;

        //
        // SAVE AS GRABBABLE
        //
        grabbableObjects.push({
            mesh: birdMesh,
            body: birdBody
        });
    }
);

//ADD CUCUMBER

let cucMesh;
let cucBody;

gltfLoader.load(
    '../models/cucumber/cucumber_tl2leafjw_mid.glb',

    (gltf) => {

        cucMesh = gltf.scene;

        cucMesh.scale.set(8, 8, 8);
        cucMesh.position.set(2, 3, 0);

        cucMesh.userData.friendshipValue = -15; //GOOD obj //bad=-10
        scene.add(cucMesh);

        // PHYSICS
        const cucBodyDes = RAPIER.RigidBodyDesc
            .dynamic()
            .setTranslation(4, 0, -5); //change x here for location

        cucBody = world.createRigidBody(cucBodyDes);

        const cucCollider = RAPIER.ColliderDesc
            .cuboid(0.5, 0.5, 0.5);

        const cucColliderRef =
            world.createCollider(cucCollider, cucBody);

        cucMesh.userData.collider = cucColliderRef;

        //
        // SAVE AS GRABBABLE
        //
        grabbableObjects.push({
            mesh: cucMesh,
            body: cucBody
        });
    }
);

//ADD HOT MEAL

let mealMesh;
let mealBody;

gltfLoader.load(
    '../models/meal/food_delicious_nasi_lemak.glb',

    (gltf) => {

        mealMesh = gltf.scene;

        mealMesh.scale.set(0.03, 0.03, 0.03);
        mealMesh.position.set(2, 3, 0);

        mealMesh.userData.friendshipValue = 25; //GOOD obj //bad=-10
        scene.add(mealMesh);

        // PHYSICS
        const mealBodyDes = RAPIER.RigidBodyDesc
            .dynamic()
            .setTranslation(-10, 1, -5); //change x here for location

        mealBody = world.createRigidBody(mealBodyDes);

        const mealCollider = RAPIER.ColliderDesc
            .cuboid(0.5, 0.5, 0.5);

        const mealColliderRef =
            world.createCollider(mealCollider, mealBody);

        mealMesh.userData.collider = mealColliderRef;

        //
        // SAVE AS GRABBABLE
        //
        grabbableObjects.push({
            mesh: mealMesh,
            body: mealBody
        });
    }
);

//ADD WATER

let waterMesh;
let waterBody;

gltfLoader.load(
    '../models/water/a_high_end_sparkling__1209160953_texture.glb',

    (gltf) => {

        waterMesh = gltf.scene;

        waterMesh.scale.set(1, 1, 1);
        waterMesh.position.set(2, 3, 0);

        waterMesh.userData.friendshipValue = -25; //GOOD obj //bad=-10
        scene.add(waterMesh);

        // PHYSICS
        const waterBodyDes = RAPIER.RigidBodyDesc
            .dynamic()
            .setTranslation(6, 0, 0); //change x here for location

        waterBody = world.createRigidBody(waterBodyDes);

        const waterCollider = RAPIER.ColliderDesc
            .cuboid(0.5, 0.5, 0.5);

        const waterColliderRef =
            world.createCollider(waterCollider, waterBody);

        waterMesh.userData.collider = waterColliderRef;

        //
        // SAVE AS GRABBABLE
        //
        grabbableObjects.push({
            mesh: waterMesh,
            body: waterBody
        });
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
let grabbedBody = null;
let grabbedMesh = null;

document.addEventListener('mousedown', (event) => {

    if (event.button !== 0) return;

    isMouseDown = true;

    raycaster.setFromCamera(centre, camera);

    const meshes = [];

    for (const obj of grabbableObjects) {
        meshes.push(obj.mesh);
    }

    const hits = raycaster.intersectObjects(
        meshes,
        true
    );

    if (hits.length === 0) return;

    if (hits[0].distance > maxGrabDistance) return;

    isGrabbing = true;

    grabDistance = THREE.MathUtils.clamp(
        hits[0].distance,
        2,
        maxGrabDistance
    );

    //
// FIND HIT OBJECT
//
    for (const obj of grabbableObjects) {

        let current = hits[0].object;

        while (current) {

            if (current === obj.mesh) {

                grabbedBody = obj.body;
                grabbedMesh = obj.mesh;

                break;
            }

            current = current.parent;
        }
    }


    if (!grabbedBody) return;

    const position = grabbedBody.translation();

    previousGrabPosition.set(
        position.x,
        position.y,
        position.z
    );

    currentGrabPosition.copy(previousGrabPosition);

    grabbedBody.setAngvel({
        x: 0,
        y: 0,
        z: 0
    }, true);
});

document.addEventListener('mouseup', (event) => {

    if (event.button !== 0) return;

    isMouseDown = false;

    if (!isGrabbing || !grabbedBody) return;

    camera.getWorldDirection(cameraForward);

    const releaseVelocity = {
        x: grabVelocity.x + cameraForward.x * throwStrength,
        y: grabVelocity.y + cameraForward.y * throwStrength + 1.5,
        z: grabVelocity.z + cameraForward.z * throwStrength
    };

    grabbedBody.setLinvel(releaseVelocity, true);

    isGrabbing = false;

    grabbedBody = null;
    grabbedMesh = null;
});

//
// UPDATE GRAB
//
function updateGrab(delta) {

    if (!grabbedBody) return;

    if (!isGrabbing || !isMouseDown) return;

    camera.getWorldDirection(cameraForward);

    targetPosition
        .copy(camera.position)
        .addScaledVector(cameraForward, grabDistance);

    const objectPosition = grabbedBody.translation();

    currentGrabPosition.set(
        objectPosition.x,
        objectPosition.y,
        objectPosition.z
    );

    const desiredVelocity = {
        x: (targetPosition.x - objectPosition.x) * grabPullStrength,
        y: (targetPosition.y - objectPosition.y) * grabPullStrength,
        z: (targetPosition.z - objectPosition.z) * grabPullStrength
    };

    grabbedBody.setLinvel(desiredVelocity, true);

    grabbedBody.setAngvel({
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
// Sync Functions
//

function syncGrabbableObjects() {

    for (const obj of grabbableObjects) {

        const position = obj.body.translation();
        const rotation = obj.body.rotation();

        obj.mesh.position.set(
            position.x,
            position.y,
            position.z
        );

        obj.mesh.quaternion.set(
            rotation.x,
            rotation.y,
            rotation.z,
            rotation.w
        );
    }
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

//friendship update

function updateFriendship(change) {

    friendship += change;

    friendship = Math.max(0, Math.min(100, friendship));

    //
    // PLAY SOUND AT MAX FRIENDSHIP
    //
    if (friendship >= 100 && !friendshipComplete) {

        friendshipComplete = true;

        successSound.play();

        console.log('Friendship MAXED');
    }

    friendshipBar.style.width = `${friendship}%`;

    // color feedback
    friendshipBar.style.background =
        'linear-gradient(to right, #cff882, #7bcf48)';
    console.log('Friendship:', friendship);
}

        const triggeredObjects = new Set();

        function checkFriendshipCollisions() {

            if (!window.catBody) return;

            const catPosition = window.catBody.translation();

            for (const obj of grabbableObjects) {

                if (obj.mesh.userData.friendshipValue === undefined) continue;

                const position = obj.body.translation();

                const dx = position.x - catPosition.x;
                const dy = position.y - catPosition.y;
                const dz = position.z - catPosition.z;

                const distance = Math.sqrt(
                    dx * dx +
                    dy * dy +
                    dz * dz
                );

                //
                // COLLISION DISTANCE
                //
                if (distance < 5) {

                    //
                    // PREVENT REPEATED TRIGGERS
                    //
                    if (triggeredObjects.has(obj.mesh)) continue;

                    triggeredObjects.add(obj.mesh);

                    updateFriendship(
                        obj.mesh.userData.friendshipValue
                    );

                    //
                    // delete obj when collide
                    //
                    objectsToRemove.push(obj);

                    console.log(
                        'Friendship changed:',
                        obj.mesh.userData.friendshipValue
                    );
                }
            }
        }

function animate() {

    requestAnimationFrame(animate);

    const delta = Math.min(clock.getDelta(), 0.05);
    updateMovement(delta);

    updateGrab(delta);

    physicsAccumulator += delta;

    while (physicsAccumulator >= fixedStep) {

        world.step();

        physicsAccumulator -= fixedStep;
    }

    //
// SAFE OBJECT REMOVAL
//
    for (const obj of objectsToRemove) {

        scene.remove(obj.mesh);

        world.removeRigidBody(obj.body);

        if (obj.mesh === fishMesh) {
            fishMesh = null;
            fishBody = null;
        }

        if (obj.mesh === breadMesh) {
            breadMesh = null;
            breadBody = null;
        }

        if (obj.mesh === milkMesh) {
            milkMesh = null;
            milkBody = null;
        }

        const index = grabbableObjects.indexOf(obj);

        if (index > -1) {
            grabbableObjects.splice(index, 1);
        }
    }

    objectsToRemove.length = 0;

    checkFriendshipCollisions();

    syncGrabbableObjects();




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