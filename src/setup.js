import * as THREE from '../build/three.module.js';

export function createScene() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1020);

    return scene;
}

export function createCamera() {
    const camera = new THREE.PerspectiveCamera(
        70,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );

    camera.position.set(0, 2, 7);

    return camera;
}

export function createRenderer(canvas) {
    const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true
    });

    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    renderer.shadowMap.enabled = true;

    return renderer;
}