import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import * as THREE from "https://cdn.skypack.dev/three@0.132.2";
import { OrbitControls } from "https://cdn.skypack.dev/three@0.132.2/examples/jsm/controls/OrbitControls.js"


// Scene, camera, and renderer setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// OrbitControls allow the camera to orbit around a target
const controls = new OrbitControls(camera, renderer.domElement);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(0, 1, 0);
scene.add(directionalLight);

// Camera positioning
camera.position.set(0, 5, 10);
controls.update();

// Parse the data string into an array of numbers
function parseData(dataString) {
    return dataString ? dataString.split(',').map(Number) : null;
}

// Create a geometry from the 6DoF points
function createPointsGeometry(data) {
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const colors = [];

    data.forEach(entry => {
        if (entry.TrackingType === 'PhysicalDevice' && entry.FeatureType === 'Transformation') {
            const dof = parseData(entry.Data);
            if (dof) {
                positions.push(dof[0], dof[1], dof[2]);
                colors.push(Math.random(), Math.random(), Math.random());
            }
        }
    });

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const material = new THREE.PointsMaterial({ size: 0.05, vertexColors: true });
    return new THREE.Points(geometry, material);
}

// Global variable for the points mesh
let pointsMesh;

// Load JSON data, create points, and add them to the scene
async function loadJsonData() {
    const response = await fetch('file.json');
    const jsonData = await response.json();
    jsonData.sort((a, b) => a.Timestamp - b.Timestamp);
    pointsMesh = createPointsGeometry(jsonData);
    scene.add(pointsMesh);
    createTimeSlider(jsonData);
}

loadJsonData();

// Create the time slider
function createTimeSlider(data) {
    const timestamps = data.map(entry => entry.Timestamp);
    const slider = d3.select('#slider').append('input')
        .attr('type', 'range')
        .attr('min', d3.min(timestamps))
        .attr('max', d3.max(timestamps))
        .attr('step', 'any')
        .on('input', function() {
            const timestamp = +this.value;
            updateVisualization(timestamp, data);
        });
}

// Update the visualization based on the timestamp
function updateVisualization(timestamp, data) {
    const currentData = data.filter(entry => entry.Timestamp <= timestamp);
    scene.remove(pointsMesh);
    pointsMesh = createPointsGeometry(currentData);
    scene.add(pointsMesh);
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

animate();
