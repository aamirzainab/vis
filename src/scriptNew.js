import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import * as THREE from "https://cdn.skypack.dev/three@0.132.2";
import {
	GLTFLoader
} from "https://cdn.skypack.dev/three@0.132.2/examples/jsm/loaders/GLTFLoader.js";
import {
	OBJLoader
} from "https://cdn.skypack.dev/three@0.132.2/examples/jsm/loaders/OBJLoader.js";
import {
	OrbitControls
} from "https://cdn.skypack.dev/three@0.132.2/examples/jsm/controls/OrbitControls.js";
import {
	LineGeometry
} from 'https://cdn.skypack.dev/three@0.132.2/examples/jsm/lines/LineGeometry.js';
import {
	LineMaterial
} from 'https://cdn.skypack.dev/three@0.132.2/examples/jsm/lines/LineMaterial.js';
import {
	Line2
} from 'https://cdn.skypack.dev/three@0.132.2/examples/jsm/lines/Line2.js';

const globalState = {}; 

async function initializeScene() {
	globalState.scene = new THREE.Scene();
	globalState.scene.background = new THREE.Color(0xffffff);
	const spatialView = document.getElementById('spatial-view');
	globalState.camera = new THREE.PerspectiveCamera(40, spatialView.innerWidth / spatialView.innerHeight, 0.1, 1000);
	globalState.camera.position.set(1, 3, 7);

	globalState.camera.updateProjectionMatrix();

	globalState.renderer = new THREE.WebGLRenderer({
		antialias: true
	});

	globalState.renderer.setSize(spatialView.width, spatialView.height);
	document.getElementById('spatial-view').appendChild(globalState.renderer.domElement);

	globalState.controls = new OrbitControls(globalState.camera, globalState.renderer.domElement);
	globalState.controls.enableZoom = true;

	const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
	globalState.scene.add(ambientLight);
	const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
	directionalLight.position.set(0, 1, 0);
	globalState.scene.add(directionalLight);

	globalState.controls.update();

	const gridHelper = new THREE.GridHelper(10, 10);
	gridHelper.position.y = -1;
	globalState.scene.add(gridHelper);

	const finalData = await Promise.all([
		fetch('Processed_Log_240812_011824.json').then(response => response.json()),
	]);
	console.log(finalData);

	const playPauseButton = document.createElement('div');
	playPauseButton.id = 'playPauseButton';
	playPauseButton.innerHTML = `<svg id="playIcon" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-play">
		<polygon points="5 3 19 12 5 21 5 3"></polygon>
		</svg>
		<svg id="pauseIcon" style="display:none;" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-pause">
		<rect x="6" y="4" width="4" height="16"></rect>
		<rect x="14" y="4" width="4" height="16"></rect>
		</svg>`;
	document.getElementById('slider-container').appendChild(playPauseButton);
	playPauseButton.addEventListener('click', function() {
		toggleAnimation();
	});
}

async function initialize() {
	await initializeScene();
}
initialize();

globalState.camera.updateProjectionMatrix();
