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

const friendshipBar = document.querySelector('#friendship-bar');

const objectsToRemove = [];

let catMesh = null;
let catHeadMesh = null;
let catBody = null;
let catColliderDebugMesh = null;

const CAT_EAT_RADIUS = 2.0;

const CAT_EAT_OFFSET = new THREE.Vector3(0, 5.5, 0);

let catThrowBody = null;
let catThrowCollider = null;

let catMode = 'walking';

let catGrabDistance = 4;
let catRagdollTimer = 0;

const CAT_THROW_CENTER_OFFSET = new THREE.Vector3(0, 3.0, 0);

const CAT_THROW_COLLIDERS = {
    torso: {
        width: 2.2,
        height: 3.2,
        depth: 1.8,
        offset: new THREE.Vector3(0, 0, 0)
    },

    head: {
        radius: 1.25,
        offset: new THREE.Vector3(0, 2.45, 0.15)
    },

    hips: {
        width: 2.0,
        height: 1.2,
        depth: 1.8,
        offset: new THREE.Vector3(0, -1.8, 0)
    },

    feet: {
        width: 2.4,
        height: 0.7,
        depth: 1.8,
        offset: new THREE.Vector3(0, -2.65, 0.1)
    }
};
const CAT_RECOVER_TIME = 4.0;

let catBones = {
    armUpperL: null,
    armUpperR: null,
    legTopL: null,
    legTopR: null,
    tail: null,
    tail001: null,
    tail002: null
};

let catBoneBaseRotations = {
    armUpperL: null,
    armUpperR: null,
    legTopL: null,
    legTopR: null,
    tail: null,
    tail001: null,
    tail002: null
};

let catMaterials = [];
let currentCatMood = '';


const catTextures = {
    sad: null,
    neutral: null,
    happy: null
};

let catReactionTime = 0;
let catReactionType = null;

let catSquishStrength = 0;

const catBaseScale = new THREE.Vector3(3, 3, 3);
const catBaseRotation = new THREE.Euler(0, 0, 0);
const catHeadBaseRotation = new THREE.Euler(0, 0, 0);

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
catTextures.sad = textureLoader.load('../assets/textures/cat_sad.png');
catTextures.neutral = textureLoader.load('../assets/textures/cat_neutral.png');
catTextures.happy = textureLoader.load('../assets/textures/cat_happy.png');

catTextures.sad.flipY = false;
catTextures.neutral.flipY = false;
catTextures.happy.flipY = false;

gltfLoader.load(
    '../models/cat/FPcat1.gltf',

    (gltf) => {

        const cat = gltf.scene;

        catMesh = cat;

        catBaseRotation.copy(cat.rotation);

        cat.traverse((child) => {

            if (child.isBone) {
                if (child.name === 'armupperL') catBones.armUpperL = child;
                if (child.name === 'armupperR') catBones.armUpperR = child;
                if (child.name === 'legtopL') catBones.legTopL = child;
                if (child.name === 'legtopR') catBones.legTopR = child;
                if (child.name === 'tail') catBones.tail = child;
                if (child.name === 'tail001') catBones.tail001 = child;
                if (child.name === 'tail002') catBones.tail002 = child;
            }
        });

        for (const key in catBones) {

            if (catBones[key]) {
                catBoneBaseRotations[key] = catBones[key].rotation.clone();
            }
        }

        cat.traverse((child) => {

            if (!child.name) return;

            const name = child.name.toLowerCase();

            if (name.includes('head')) {
                catHeadMesh = child;
                catHeadBaseRotation.copy(child.rotation);
            }
        });

        //
        // LOAD CAT TEXTURE
        //
        const catTexture = textureLoader.load(
            '../assets/textures/Cat_tex1.png'
        );
        catTexture.flipY = false;
        //
        // APPLY TEXTURE TO ALL CAT MESHES
        //
        cat.traverse((child) => {

            if (!child.isMesh) return;

            child.material = new THREE.MeshStandardMaterial({
                map: catTextures.neutral
            });

            catMaterials.push(child.material);

            child.castShadow = true;
            child.receiveShadow = true;
        });

        cat.scale.set(3, 3, 3);
        cat.position.set(0, -3, 3);

        scene.add(cat);

        //
        // CAT PHYSICS BODY
        //
        const catBodyDesc = RAPIER.RigidBodyDesc
            .fixed()
            .setTranslation(0, -3, 3);

        catBody = world.createRigidBody(catBodyDesc);

        //
        // SIMPLE CAT COLLIDER
        //
        const catCollider = RAPIER.ColliderDesc
            .ball(CAT_EAT_RADIUS)
            .setSensor(true);

        const catColliderRef = world.createCollider(catCollider, catBody);

        catColliderDebugMesh = addDebugSphere(
            CAT_EAT_RADIUS,
            cat.position.x + CAT_EAT_OFFSET.x,
            cat.position.y + CAT_EAT_OFFSET.y,
            cat.position.z + CAT_EAT_OFFSET.z,
            0xff00ff
        );

        catColliderDebugMesh.material.opacity = 0;

        //
        // SAVE REFERENCES
        //
        cat.userData.rigidBody = catBody;
        cat.userData.collider = catColliderRef;

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
    '../models/room/roomscene.glb',
    //changes

    (gltf) => {

        const room = gltf.scene;

        room.scale.set(0.1, 0.1, 0.1);
        room.position.set(0, -4.5, 3.2);

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

        waterMesh.userData.friendshipValue = -10; //GOOD obj //bad=-10
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

function addDebugSphere(radius, x, y, z, color = 0xff00ff) {

    const geometry = new THREE.SphereGeometry(radius, 32, 16);

    const material = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.35,
        wireframe: true
    });

    const mesh = new THREE.Mesh(geometry, material);

    mesh.position.set(x, y, z);

    scene.add(mesh);

    return mesh;
}

function addDebugBox(width, height, depth, x, y, z, color = 0x00ff99) {

    const geometry = new THREE.BoxGeometry(width, height, depth);

    const material = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0,
        wireframe: false
    });

    const mesh = new THREE.Mesh(geometry, material);

    mesh.position.set(x, y, z);

    scene.add(mesh);

    return mesh;
}

function addFurnitureCollider(
    name,
    width,
    height,
    depth,
    x,
    y,
    z,
    color = 0xffcc00,
    rotationX = 0,
    rotationY = 0,
    rotationZ = 0
) {
    const quaternion = new THREE.Quaternion();

    quaternion.setFromEuler(
        new THREE.Euler(
            rotationX,
            rotationY,
            rotationZ
        )
    );

    const body = world.createRigidBody(
        RAPIER.RigidBodyDesc
            .fixed()
            .setTranslation(x, y, z)
            .setRotation({
                x: quaternion.x,
                y: quaternion.y,
                z: quaternion.z,
                w: quaternion.w
            })
    );

    const collider = RAPIER.ColliderDesc
        .cuboid(
            width / 2,
            height / 2,
            depth / 2
        )
        .setFriction(0.8);

    world.createCollider(collider, body);

    const debugMesh = addDebugBox(
        width,
        height,
        depth,
        x,
        y,
        z,
        color
    );

    debugMesh.rotation.set(
        rotationX,
        rotationY,
        rotationZ
    );

    debugMesh.name = `${name}_debug`;

    return {
        name,
        body,
        debugMesh
    };
}

//
// INVISIBLE ROOM COLLISION BORDERS
//

const ROOM_CENTER_X = 1;
const ROOM_CENTER_Z = 4;

const ROOM_SIZE_X = 38;
const ROOM_SIZE_Z = 38;

const FLOOR_Y = -3;

const FLOOR_THICKNESS = 0.5;
const WALL_HEIGHT = 20;
const WALL_THICKNESS = 0.5;

const roomCollisionBody = world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed()
);

//
// FLOOR COLLIDER
//
const floorCollider = RAPIER.ColliderDesc
    .cuboid(
        ROOM_SIZE_X / 2,
        FLOOR_THICKNESS / 2,
        ROOM_SIZE_Z / 2
    )
    .setTranslation(
        ROOM_CENTER_X,
        FLOOR_Y - FLOOR_THICKNESS / 2,
        ROOM_CENTER_Z
    )
    .setFriction(1.0);

world.createCollider(floorCollider, roomCollisionBody);

addDebugBox(
    ROOM_SIZE_X,
    FLOOR_THICKNESS,
    ROOM_SIZE_Z,
    ROOM_CENTER_X,
    FLOOR_Y - FLOOR_THICKNESS / 2,
    ROOM_CENTER_Z,
    0x00ff99
);

//
// LEFT WALL COLLIDER
// This sits on the negative X side of the room.
//
const negativeXWallCollider = RAPIER.ColliderDesc
    .cuboid(
        WALL_THICKNESS / 2,
        WALL_HEIGHT / 2,
        ROOM_SIZE_Z / 2
    )
    .setTranslation(
        ROOM_CENTER_X - ROOM_SIZE_X / 2 - WALL_THICKNESS / 2,
        FLOOR_Y + WALL_HEIGHT / 2,
        ROOM_CENTER_Z
    )
    .setFriction(0.8);

world.createCollider(negativeXWallCollider, roomCollisionBody);

addDebugBox(
    WALL_THICKNESS,
    WALL_HEIGHT,
    ROOM_SIZE_Z,
    ROOM_CENTER_X - ROOM_SIZE_X / 2 - WALL_THICKNESS / 2,
    FLOOR_Y + WALL_HEIGHT / 2,
    ROOM_CENTER_Z,
    0xff5555
);

//
// BACK WALL COLLIDER
// This sits on the negative Z side of the room.
//
const negativeZWallCollider = RAPIER.ColliderDesc
    .cuboid(
        ROOM_SIZE_X / 2,
        WALL_HEIGHT / 2,
        WALL_THICKNESS / 2
    )
    .setTranslation(
        ROOM_CENTER_X,
        FLOOR_Y + WALL_HEIGHT / 2,
        ROOM_CENTER_Z - ROOM_SIZE_Z / 2 - WALL_THICKNESS / 2
    )
    .setFriction(0.8);

world.createCollider(negativeZWallCollider, roomCollisionBody);

addDebugBox(
    ROOM_SIZE_X,
    WALL_HEIGHT,
    WALL_THICKNESS,
    ROOM_CENTER_X,
    FLOOR_Y + WALL_HEIGHT / 2,
    ROOM_CENTER_Z - ROOM_SIZE_Z / 2 - WALL_THICKNESS / 2,
    0x5599ff
);

//
// FURNITURE COLLIDERS
//

const furnitureColliders = [];

//
// BED
//
furnitureColliders.push(
    addFurnitureCollider(
        'bed',
        22,
        1,
        13,
        7.5,
        FLOOR_Y + 2.5,
        -8,
        0xff8844
    )
);

//
// BED HEADBOARDS
//
furnitureColliders.push(
    addFurnitureCollider(
        'bed_headboard1',
        0.8,
        3,
        12,
        -4,
        FLOOR_Y + 4,
        -8,
        0xff7744
    )
);

furnitureColliders.push(
    addFurnitureCollider(
        'bed_headboard2',
        0.8,
        3,
        12,
        19,
        FLOOR_Y + 4,
        -8,
        0xff7744
    )
);

//
// BED LEGS
//
furnitureColliders.push(
    addFurnitureCollider(
        'bedleg1',
        0.8,
        3,
        0.8,
        -2,
        FLOOR_Y + 1,
        -3,
        0xff7744
    )
);


furnitureColliders.push(
    addFurnitureCollider(
        'bedleg2',
        0.8,
        3,
        0.8,
        17,
        FLOOR_Y + 1,
        -13,
        0xff7744
    )
);

furnitureColliders.push(
    addFurnitureCollider(
        'bedleg3',
        0.8,
        3,
        0.8,
        17,
        FLOOR_Y + 1,
        -3,
        0xff7744
    )
);

//
// MISC OBJECTS OMG THIS GAME IS GETTING TO MEEEEEEEEEEE
//
furnitureColliders.push(
    addFurnitureCollider(
        'cardboard_box',
        4,
        3,
        4,
        -16,
        FLOOR_Y + 18,
        -9.5,
        0x44aaff,
        0,
        THREE.MathUtils.degToRad(14)
    )
);

furnitureColliders.push(
    addFurnitureCollider(
        'books',
        4,
        3,
        4,
        1,
        FLOOR_Y + 14,
        -13.5,
        0x44aaff,
    )
);

furnitureColliders.push(
    addFurnitureCollider(
        'speaker_1',
        1,
        3,
        1,
        -12.5,
        FLOOR_Y + 7,
        17.8,
        0xdddddd,
        0,
        THREE.MathUtils.degToRad(20)
    )
);

furnitureColliders.push(
    addFurnitureCollider(
        'speaker_2',
        1,
        3,
        1,
        -12.5,
        FLOOR_Y + 7,
        8,
        0xdddddd,
        0,
        THREE.MathUtils.degToRad(-20)
    )
);

furnitureColliders.push(
    addFurnitureCollider(
        'laptop',
        0.5,
        3.5,
        7,
        -13,
        FLOOR_Y + 8,
        13,
        0xdddddd,
        0,
        0,
        THREE.MathUtils.degToRad(10)
    )
);

furnitureColliders.push(
    addFurnitureCollider(
        'PC',
        4,
        4.5,
        1.5,
        -12.7,
        FLOOR_Y + 1.5,
        8,
        0xdddddd
    )
);

//
// BOOKSHELF
//
furnitureColliders.push(
    addFurnitureCollider(
        'back_bookshelf',
        4,
        27,
        15,
        -16,
        FLOOR_Y + 3.5,
        -5.3,
        0xaa66ff
    )
);

//
// DESK
//
furnitureColliders.push(
    addFurnitureCollider(
        'desk',
        0.5,
        5,
        2.6,
        -4.5,
        FLOOR_Y + 6,
        13.5,
        0xffaa44,
        0,
        0,
        THREE.MathUtils.degToRad(-20)
    )
);

furnitureColliders.push(
    addFurnitureCollider(
        'deskleg1',
        1,
        6,
        0.7,
        -9.5,
        FLOOR_Y + 2,
        6.7,
        0xdddddd
    )
);
furnitureColliders.push(
    addFurnitureCollider(
        'deskleg2',
        1,
        6,
        0.7,
        -9.5,
        FLOOR_Y + 2,
        19.25,
        0xdddddd
    )
);
//
// DESK CHAIR
//
furnitureColliders.push(
    addFurnitureCollider(
        'desk_chair',
        3,
        8,
        2.6,
        -5.8,
        FLOOR_Y + 2,
        13.5,
        0xdddddd
    )
);

//
// SMALL LEFT TABLE
//
furnitureColliders.push(
    addFurnitureCollider(
        'small_left_table',
        9,
        1,
        15,
        -13,
        FLOOR_Y + 5.5,
        13,
        0x996633
    )
);

//
// LEFT BIN
//
furnitureColliders.push(
    addFurnitureCollider(
        'bin',
        2,
        3,
        2,
        -9.5,
        FLOOR_Y + 1,
        21.2,
        0x999999
    )
);

//
// WALL SHELF
//
furnitureColliders.push(
    addFurnitureCollider(
        'wall_shelf',
        21,
        0.6,
        5,
        8,
        FLOOR_Y + 11.5,
        -13,
        0x996633
    )
);
//HERE IS WHERE THE FUN BEGINS AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
function createCatThrowBody() {



    if (!catMesh) return;

    if (catThrowBody) {
        world.removeRigidBody(catThrowBody);
        catThrowBody = null;
        catThrowCollider = null;
    }

    const worldOffset = CAT_THROW_CENTER_OFFSET
        .clone()
        .applyQuaternion(catMesh.quaternion);

    const bodyDesc = RAPIER.RigidBodyDesc
        .dynamic()
        .setTranslation(
            catMesh.position.x + worldOffset.x,
            catMesh.position.y + worldOffset.y,
            catMesh.position.z + worldOffset.z
        )
        .setRotation({
            x: catMesh.quaternion.x,
            y: catMesh.quaternion.y,
            z: catMesh.quaternion.z,
            w: catMesh.quaternion.w
        })
        .setLinearDamping(0.18)
        .setAngularDamping(0.12);

    catThrowBody = world.createRigidBody(bodyDesc);

    //
    // TORSO COLLIDER
    //
    world.createCollider(
        RAPIER.ColliderDesc
            .cuboid(
                CAT_THROW_COLLIDERS.torso.width / 2,
                CAT_THROW_COLLIDERS.torso.height / 2,
                CAT_THROW_COLLIDERS.torso.depth / 2
            )
            .setTranslation(
                CAT_THROW_COLLIDERS.torso.offset.x,
                CAT_THROW_COLLIDERS.torso.offset.y,
                CAT_THROW_COLLIDERS.torso.offset.z
            )
            .setDensity(1.0)
            .setFriction(0.8)
            .setRestitution(0.08),
        catThrowBody
    );

    //
    // HEAD COLLIDER
    //
    world.createCollider(
        RAPIER.ColliderDesc
            .ball(CAT_THROW_COLLIDERS.head.radius)
            .setTranslation(
                CAT_THROW_COLLIDERS.head.offset.x,
                CAT_THROW_COLLIDERS.head.offset.y,
                CAT_THROW_COLLIDERS.head.offset.z
            )
            .setDensity(0.8)
            .setFriction(0.8)
            .setRestitution(0.08),
        catThrowBody
    );

    //
    // HIPS COLLIDER
    //
    world.createCollider(
        RAPIER.ColliderDesc
            .cuboid(
                CAT_THROW_COLLIDERS.hips.width / 2,
                CAT_THROW_COLLIDERS.hips.height / 2,
                CAT_THROW_COLLIDERS.hips.depth / 2
            )
            .setTranslation(
                CAT_THROW_COLLIDERS.hips.offset.x,
                CAT_THROW_COLLIDERS.hips.offset.y,
                CAT_THROW_COLLIDERS.hips.offset.z
            )
            .setDensity(1.1)
            .setFriction(0.8)
            .setRestitution(0.08),
        catThrowBody
    );

    //
    // FEET COLLIDER
    //
    world.createCollider(
        RAPIER.ColliderDesc
            .cuboid(
                CAT_THROW_COLLIDERS.feet.width / 2,
                CAT_THROW_COLLIDERS.feet.height / 2,
                CAT_THROW_COLLIDERS.feet.depth / 2
            )
            .setTranslation(
                CAT_THROW_COLLIDERS.feet.offset.x,
                CAT_THROW_COLLIDERS.feet.offset.y,
                CAT_THROW_COLLIDERS.feet.offset.z
            )
            .setDensity(0.7)
            .setFriction(0.9)
            .setRestitution(0.05),
        catThrowBody
    );
}

function syncCatMeshToThrowBody() {

    if (!catMesh || !catThrowBody) return;

    const position = catThrowBody.translation();
    const rotation = catThrowBody.rotation();

    const bodyQuaternion = new THREE.Quaternion(
        rotation.x,
        rotation.y,
        rotation.z,
        rotation.w
    );

    const rotatedOffset = CAT_THROW_CENTER_OFFSET
        .clone()
        .applyQuaternion(bodyQuaternion);

    catMesh.position.set(
        position.x - rotatedOffset.x,
        position.y - rotatedOffset.y,
        position.z - rotatedOffset.z
    );

    catMesh.quaternion.copy(bodyQuaternion);
}

function recoverCatFromRagdoll() {

    if (!catMesh || !catThrowBody) return;

    const position = catThrowBody.translation();

    world.removeRigidBody(catThrowBody);

    catThrowBody = null;
    catThrowCollider = null;

    catMesh.position.set(
        position.x,
        FLOOR_Y,
        position.z
    );

    catMesh.rotation.set(
        catBaseRotation.x,
        catBaseRotation.y,
        catBaseRotation.z
    );

    catMesh.scale.copy(catBaseScale);

    catWander.center.set(
        catMesh.position.x,
        catMesh.position.y,
        catMesh.position.z
    );

    catWander.waitTimer = 1.5;
    catWander.moving = false;

    resetCatBonesToBase();

    catMode = 'walking';
    isCatGrabbed = false;
}

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
let isCatGrabbed = false;

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

    if (catMesh && catMode === 'walking') {
        meshes.push(catMesh);
    }

    const hits = raycaster.intersectObjects(
        meshes,
        true
    );

    if (hits.length === 0) return;

    if (hits[0].distance > maxGrabDistance) return;

    let hitCat = false;
    let currentHit = hits[0].object;

    while (currentHit) {

        if (currentHit === catMesh) {
            hitCat = true;
            break;
        }

        currentHit = currentHit.parent;
    }

    if (hitCat) {

        isGrabbing = true;
        isCatGrabbed = true;
        catMode = 'grabbed';

        catGrabDistance = THREE.MathUtils.clamp(
            hits[0].distance,
            2,
            maxGrabDistance
        );

        previousGrabPosition.copy(catMesh.position);
        currentGrabPosition.copy(catMesh.position);

        catWander.moving = false;

        return;
    }

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

    if (isCatGrabbed && catMode === 'grabbed' && catMesh) {

        if (badSound.isPlaying) {
            badSound.stop();
        }

        badSound.play();

        updateFriendship(-10);

        camera.getWorldDirection(cameraForward);

        createCatThrowBody();

        if (catThrowBody) {

            catThrowBody.setLinvel(
                {
                    x: grabVelocity.x + cameraForward.x * throwStrength,
                    y: grabVelocity.y + cameraForward.y * throwStrength + 2.5,
                    z: grabVelocity.z + cameraForward.z * throwStrength
                },
                true
            );

            catThrowBody.setAngvel(
                {
                    x: THREE.MathUtils.randFloatSpread(8),
                    y: THREE.MathUtils.randFloatSpread(8),
                    z: THREE.MathUtils.randFloatSpread(8)
                },
                true
            );
        }

        catRagdollTimer = 0;
        catMode = 'ragdoll';
        isCatGrabbed = false;
        isGrabbing = false;

        return;
    }

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

    if (isCatGrabbed && catMode === 'grabbed') {

        if (!isMouseDown || !catMesh) return;

        camera.getWorldDirection(cameraForward);

        targetPosition
            .copy(camera.position)
            .addScaledVector(cameraForward, catGrabDistance);

        currentGrabPosition.copy(catMesh.position);

        catMesh.position.lerp(targetPosition, 0.35);

        grabVelocity
            .copy(currentGrabPosition)
            .sub(previousGrabPosition)
            .divideScalar(Math.max(delta, 0.001));

        previousGrabPosition.copy(currentGrabPosition);

        syncCatColliderToCat();

        return;
    }

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

    //
    // GOOD / BAD AUDIO
    //
    if (change > 0) {

        if (goodSound.isPlaying) {
            goodSound.stop();
        }

        goodSound.play();

    } else if (change < 0) {

        if (badSound.isPlaying) {
            badSound.stop();
        }

        badSound.play();
    }

    friendship = Math.max(0, Math.min(100, friendship));

    //
    // WIN AUDIO
    //
    if (friendship >= 100 && !friendshipComplete) {

        friendshipComplete = true;

        successSound.play();

        console.log('Friendship MAXED');
    }

    friendshipBar.style.width = `${friendship}%`;

    friendshipBar.style.background =
        'linear-gradient(to right, #cff882, #7bcf48)';

    updateCatMoodTexture();

    console.log('Friendship:', friendship);
}

function updateCatMoodTexture() {

    if (!catMesh) return;

    let mood = 'neutral';

    if (friendship < 20) {
        mood = 'sad';
    } else if (friendship >= 65) {
        mood = 'happy';
    }

    if (mood === currentCatMood) return;

    currentCatMood = mood;

    for (const material of catMaterials) {
        material.map = catTextures[mood];
        material.needsUpdate = true;
    }
}

function triggerCatReaction(friendshipValue) {

    catReactionTime = 0.45;

    if (friendshipValue > 0) {

        catReactionType = 'happy';
        catSquishStrength = 0.18;

    } else {

        catReactionType = 'yuck';
        catSquishStrength = 0;
    }
}

function updateCatReaction(delta) {

    if (!catMesh) return;

    const headTarget = catHeadMesh || catMesh;

    if (catReactionTime > 0) {

        catReactionTime -= delta;

        const progress = catReactionTime / 0.45;

        if (catReactionType === 'happy') {

            const pulse = Math.sin(catReactionTime * 35) * catSquishStrength;

            catMesh.scale.set(
                catBaseScale.x + pulse,
                catBaseScale.y - pulse * 0.7,
                catBaseScale.z + pulse
            );

            catMesh.rotation.z = catBaseRotation.z + pulse * 0.08;

            if (catHeadMesh) {
                catHeadMesh.rotation.copy(catHeadBaseRotation);
            }

        }

        if (catReactionType === 'yuck') {

            const shake = Math.sin(catReactionTime * 55) * 0.25 * progress;
            const lookDown = Math.sin(progress * Math.PI) * 0.35;

            catMesh.scale.lerp(catBaseScale, 0.2);

            if (catHeadMesh) {

                catHeadMesh.rotation.x = catHeadBaseRotation.x + lookDown;
                catHeadMesh.rotation.y = catHeadBaseRotation.y + shake;
                catHeadMesh.rotation.z = catHeadBaseRotation.z;

            } else {

                catMesh.rotation.x = catBaseRotation.x + lookDown * 0.35;
                catMesh.rotation.y = catBaseRotation.y + shake;
                catMesh.rotation.z = catBaseRotation.z;
            }
        }

    } else {

        catReactionType = null;

        catMesh.scale.lerp(catBaseScale, 0.12);

        catMesh.rotation.x += (catBaseRotation.x - catMesh.rotation.x) * 0.12;
        catMesh.rotation.y += (catBaseRotation.y - catMesh.rotation.y) * 0.12;
        catMesh.rotation.z += (catBaseRotation.z - catMesh.rotation.z) * 0.12;

        if (catHeadMesh) {

            catHeadMesh.rotation.x += (catHeadBaseRotation.x - catHeadMesh.rotation.x) * 0.12;
            catHeadMesh.rotation.y += (catHeadBaseRotation.y - catHeadMesh.rotation.y) * 0.12;
            catHeadMesh.rotation.z += (catHeadBaseRotation.z - catHeadMesh.rotation.z) * 0.12;
        }
    }
}

const triggeredObjects = new Set();

function syncCatColliderToCat() {

    if (!catMesh || !catBody) return;

    const eatPosition = new THREE.Vector3()
        .copy(catMesh.position)
        .add(CAT_EAT_OFFSET);

    catBody.setTranslation(
        {
            x: eatPosition.x,
            y: eatPosition.y,
            z: eatPosition.z
        },
        true
    );

    catBody.setRotation(
        {
            x: catMesh.quaternion.x,
            y: catMesh.quaternion.y,
            z: catMesh.quaternion.z,
            w: catMesh.quaternion.w
        },
        true
    );

    if (catColliderDebugMesh) {
        catColliderDebugMesh.position.copy(eatPosition);
    }
}

function checkFriendshipCollisions() {

    if (!catBody) return;

    const catPosition = catBody.translation();

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
        if (distance < CAT_EAT_RADIUS) {

            //
            // PREVENT REPEATED TRIGGERS
            //
            if (triggeredObjects.has(obj.mesh)) continue;

            triggeredObjects.add(obj.mesh);

            updateFriendship(
                obj.mesh.userData.friendshipValue
            );

            triggerCatReaction(
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


//Cat Movement
let catWander = {
    target: new THREE.Vector3(),
    speed: 1.8,
    waitTimer: 3,
    moving: false,
    center: new THREE.Vector3(1, -3, 5),
    radius: 7
};

function pickNewCatTarget(cat) {
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * catWander.radius;

    catWander.target.set(
        catWander.center.x + Math.cos(angle) * distance,
        cat.position.y,
        catWander.center.z + Math.sin(angle) * distance
    );

    catWander.moving = true;
}

function updateCatWander(cat, delta) {
    if (!cat) return;
    if (!catWander.moving) {
        catWander.waitTimer -= delta;

        if (catWander.waitTimer <= 0) {
            pickNewCatTarget(cat);
        }

        return;
    }

    const direction = catWander.target.clone().sub(cat.position);
    direction.y = 0;

    const distance = direction.length();

    if (distance < 0.2) {
        catWander.moving = false;
        catWander.waitTimer = THREE.MathUtils.randFloat(5, 10);
        return;
    }

    direction.normalize();

    cat.position.addScaledVector(
        direction,
        catWander.speed * delta
    );


    cat.rotation.y = Math.atan2(direction.x, direction.z);
}

function updateCatIdleAnimation(cat) {
    if (!cat) return;
    if (catWander.moving) return;
    if (isCatGrabbed) return;
    if (catReactionTime > 0) return;

    lerpCatBonesToBase(0.08);

    const time = clock.getElapsedTime();

    const breathe = Math.sin(time * 2) * 0.08;
    const sway = Math.sin(time * 1.5) * 0.05;
    const tailSwing = Math.sin(time * 2) * 0.18;

    cat.scale.set(
        catBaseScale.x,
        catBaseScale.y + breathe,
        catBaseScale.z
    );

    cat.rotation.z = catBaseRotation.z + sway;

    if (catBones.tail) catBones.tail.rotation.y = tailSwing;
    if (catBones.tail001) catBones.tail001.rotation.y = tailSwing * 0.9;
    if (catBones.tail002) catBones.tail002.rotation.y = tailSwing * 0.7;
}

let boneAnimTimer = 0;

function resetCatBonesToBase() {

    for (const key in catBones) {

        if (!catBones[key]) continue;
        if (!catBoneBaseRotations[key]) continue;

        catBones[key].rotation.copy(catBoneBaseRotations[key]);
    }
}

function lerpCatBonesToBase(amount = 0.18) {

    for (const key in catBones) {

        if (!catBones[key]) continue;
        if (!catBoneBaseRotations[key]) continue;

        catBones[key].rotation.x +=
            (catBoneBaseRotations[key].x - catBones[key].rotation.x) * amount;

        catBones[key].rotation.y +=
            (catBoneBaseRotations[key].y - catBones[key].rotation.y) * amount;

        catBones[key].rotation.z +=
            (catBoneBaseRotations[key].z - catBones[key].rotation.z) * amount;
    }
}

function updateCatBoneWalk(delta) {

    if (!catWander.moving || isCatGrabbed) return;
    if (catReactionTime > 0) return;
    if (catMode !== 'walking') return;

    boneAnimTimer += delta;

    const swingA = Math.sin(boneAnimTimer * 4) * 0.25;
    const swingB = Math.sin(boneAnimTimer * 4 + Math.PI) * 0.25;
    const tailSwing = Math.sin(boneAnimTimer * 2) * 0.12;

    //
    // Diagonal walk pairs:
    // left front + right back move together
    // right front + left back move together
    //
    if (catBones.armUpperL && catBoneBaseRotations.armUpperL) {
        catBones.armUpperL.rotation.x =
            catBoneBaseRotations.armUpperL.x + swingA;
    }

    if (catBones.legTopR && catBoneBaseRotations.legTopR) {
        catBones.legTopR.rotation.x =
            catBoneBaseRotations.legTopR.x + swingA;
    }

    if (catBones.armUpperR && catBoneBaseRotations.armUpperR) {
        catBones.armUpperR.rotation.x =
            catBoneBaseRotations.armUpperR.x + swingB;
    }

    if (catBones.legTopL && catBoneBaseRotations.legTopL) {
        catBones.legTopL.rotation.x =
            catBoneBaseRotations.legTopL.x + swingB;
    }

    if (catBones.tail && catBoneBaseRotations.tail) {
        catBones.tail.rotation.y =
            catBoneBaseRotations.tail.y + tailSwing;
    }

    if (catBones.tail001 && catBoneBaseRotations.tail001) {
        catBones.tail001.rotation.y =
            catBoneBaseRotations.tail001.y + tailSwing * 0.7;
    }

    if (catBones.tail002 && catBoneBaseRotations.tail002) {
        catBones.tail002.rotation.y =
            catBoneBaseRotations.tail002.y + tailSwing * 0.5;
    }
}

function updateCatRagdollBones(delta) {

    if (catMode !== 'ragdoll') return;
    if (!catThrowBody) return;

    const time = clock.getElapsedTime();

    const angularVelocity = catThrowBody.angvel();
    const linearVelocity = catThrowBody.linvel();

    const spinAmount = Math.min(
        1.2,
        Math.abs(angularVelocity.x) +
        Math.abs(angularVelocity.y) +
        Math.abs(angularVelocity.z)
    );

    const speedAmount = Math.min(
        1.0,
        Math.sqrt(
            linearVelocity.x * linearVelocity.x +
            linearVelocity.y * linearVelocity.y +
            linearVelocity.z * linearVelocity.z
        ) * 0.08
    );

    const ragdollAmount = Math.max(0.35, spinAmount * 0.35 + speedAmount);

    const frontLegFlop = Math.sin(time * 10.5) * 0.55 * ragdollAmount;
    const backLegFlop = Math.sin(time * 9.5 + Math.PI) * 0.5 * ragdollAmount;
    const sideFlop = Math.sin(time * 7.5) * 0.35 * ragdollAmount;
    const tailFlop = Math.sin(time * 11) * 0.75 * ragdollAmount;

    //
    // Front legs / arms.
    // These use the armUpper bones.
    //
    if (catBones.armUpperL && catBoneBaseRotations.armUpperL) {
        catBones.armUpperL.rotation.x =
            catBoneBaseRotations.armUpperL.x + frontLegFlop;

        catBones.armUpperL.rotation.z =
            catBoneBaseRotations.armUpperL.z + sideFlop;
    }

    if (catBones.armUpperR && catBoneBaseRotations.armUpperR) {
        catBones.armUpperR.rotation.x =
            catBoneBaseRotations.armUpperR.x - frontLegFlop;

        catBones.armUpperR.rotation.z =
            catBoneBaseRotations.armUpperR.z - sideFlop;
    }

    //
    // Back legs.
    // These use the legTop bones.
    //
    if (catBones.legTopL && catBoneBaseRotations.legTopL) {
        catBones.legTopL.rotation.x =
            catBoneBaseRotations.legTopL.x + backLegFlop;

        catBones.legTopL.rotation.z =
            catBoneBaseRotations.legTopL.z - sideFlop * 0.7;
    }

    if (catBones.legTopR && catBoneBaseRotations.legTopR) {
        catBones.legTopR.rotation.x =
            catBoneBaseRotations.legTopR.x - backLegFlop;

        catBones.legTopR.rotation.z =
            catBoneBaseRotations.legTopR.z + sideFlop * 0.7;
    }

    //
    // Tail chain.
    // Each tail section follows with slightly less movement.
    //
    if (catBones.tail && catBoneBaseRotations.tail) {
        catBones.tail.rotation.y =
            catBoneBaseRotations.tail.y + tailFlop;

        catBones.tail.rotation.x =
            catBoneBaseRotations.tail.x + frontLegFlop * 0.25;
    }

    if (catBones.tail001 && catBoneBaseRotations.tail001) {
        catBones.tail001.rotation.y =
            catBoneBaseRotations.tail001.y + tailFlop * 0.75;

        catBones.tail001.rotation.x =
            catBoneBaseRotations.tail001.x + frontLegFlop * 0.2;
    }

    if (catBones.tail002 && catBoneBaseRotations.tail002) {
        catBones.tail002.rotation.y =
            catBoneBaseRotations.tail002.y + tailFlop * 0.5;

        catBones.tail002.rotation.x =
            catBoneBaseRotations.tail002.x + frontLegFlop * 0.15;
    }
}

function animate() {

    requestAnimationFrame(animate);

    const delta = Math.min(clock.getDelta(), 0.05);
    updateMovement(delta);

    updateGrab(delta);

    if (catMesh) {

        if (catMode === 'walking') {

            updateCatWander(catMesh, delta);
            updateCatBoneWalk(delta);
            updateCatIdleAnimation(catMesh);
            syncCatColliderToCat();
        }

        if (catMode === 'grabbed') {

            syncCatColliderToCat();
        }

        if (catMode === 'ragdoll') {

            syncCatMeshToThrowBody();
            updateCatRagdollBones(delta);
            syncCatColliderToCat();

            catRagdollTimer += delta;

            if (catRagdollTimer > CAT_RECOVER_TIME && catThrowBody) {

                const velocity = catThrowBody.linvel();

                const speed = Math.sqrt(
                    velocity.x * velocity.x +
                    velocity.y * velocity.y +
                    velocity.z * velocity.z
                );

                if (speed < 1.2) {
                    recoverCatFromRagdoll();
                }
            }

            if (catRagdollTimer > 5) {
                recoverCatFromRagdoll();
            }
        }
    }


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

    if (catMode !== 'ragdoll') {
        updateCatReaction(delta);
    }

    syncGrabbableObjects();




    renderer.render(scene, camera);
}

animate();

//
// AUDIO
//
const listener = new THREE.AudioListener();

camera.add(listener);

const audioLoader = new THREE.AudioLoader();

//
// GOOD ITEM SOUND
//
const goodSound = new THREE.Audio(listener);

audioLoader.load(
    '../assets/audio/meow-1.mp3',

    (buffer) => {

        goodSound.setBuffer(buffer);
        goodSound.setVolume(0.6);
    }
);

//
// BAD ITEM SOUND
//
const badSound = new THREE.Audio(listener);

audioLoader.load(
    '../assets/audio/angry4.mp3',

    (buffer) => {

        badSound.setBuffer(buffer);
        badSound.setVolume(0.6);
    }
);

//
// MAX FRIENDSHIP SOUND
//
const successSound = new THREE.Audio(listener);

audioLoader.load(
    '../assets/audio/simple-and-clean-melody.mp3',

    (buffer) => {

        successSound.setBuffer(buffer);
        successSound.setVolume(0.7);
    }
);

let friendshipComplete = false;

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