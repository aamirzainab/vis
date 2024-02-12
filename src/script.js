// Import statements
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import * as THREE from "https://cdn.skypack.dev/three@0.132.2";
import { OrbitControls } from "https://cdn.skypack.dev/three@0.132.2/examples/jsm/controls/OrbitControls.js";

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffffff); // Set the background to white

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// OrbitControls setup
const controls = new OrbitControls(camera, renderer.domElement);

// Lighting setup
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(0, 1, 0);
scene.add(directionalLight);

// Camera positioning
camera.position.set(0, 5, 10);
controls.update();

// Grid helper for a 3D grid (size, divisions)
const gridHelper = new THREE.GridHelper(100, 100);
scene.add(gridHelper);

// Base color for all points
const baseColor = new THREE.Color(0x0000ff); // Blue color

// Parse the data string into an array of numbers
function parseData(dataString) {
  return dataString ? dataString.split(',').map(Number) : null;
}

function createPointsGeometry(data, isHighlight = false) {
  const geometry = new THREE.BufferGeometry();
  const positions = [];
  const colors = [];
  
  const hsl = { h: 0, s: 0, l: 0 };
  baseColor.getHSL(hsl); // Get HSL values from the base color

  data.forEach(entry => {
    if (entry.TrackingType === 'PhysicalDevice' && entry.FeatureType === 'Transformation') {
      const dof = parseData(entry.Data);
      if (dof) {
        positions.push(dof[0], dof[1], dof[2]);
        // Adjust the lightness based on whether the point is highlighted
        const lightness = isHighlight ? 0.5 : 0.8;
        const color = new THREE.Color().setHSL(hsl.h, hsl.s, lightness);
        colors.push(color.r, color.g, color.b);
      }
    }
  });

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({ size: 0.05, vertexColors: true, transparent: true, opacity: isHighlight ? 1.0 : 0.5 });
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

// Create the time slider and time display
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
      updateTimeDisplay(timestamp);
    });
  
  // Create a time display
  d3.select('#timeDisplay').text(new Date(d3.min(timestamps)).toUTCString());
}

// Update the visualization based on the timestamp
function updateVisualization(timestamp, data) {
  const currentData = data.filter(entry => entry.Timestamp <= timestamp);
  const highlightData = data.filter(entry => entry.Timestamp === timestamp);

  // Remove old points from the scene
  if (pointsMesh) {
    scene.remove(pointsMesh);
  }
  
  // Add the non-highlighted points
  pointsMesh = createPointsGeometry(currentData);
  scene.add(pointsMesh);

  // Add the highlighted points
  if (highlightData.length > 0) {
    const highlightMesh = createPointsGeometry(highlightData, true);
    highlightMesh.material.size = 0.1; // Make highlighted points slightly bigger
    scene.add(highlightMesh);
  }
}

// Update the time display
function updateTimeDisplay(timestamp) {
  const timeDisplay = document.getElementById('timeDisplay');
  if (timeDisplay) {
    timeDisplay.textContent = `Time: ${new Date(timestamp).toUTCString()}`;
  }
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}


animate();