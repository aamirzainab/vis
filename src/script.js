import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import * as THREE from "https://cdn.skypack.dev/three@0.132.2";
import { GLTFLoader } from "https://cdn.skypack.dev/three@0.132.2/examples/jsm/loaders/GLTFLoader.js";
import { OBJLoader } from  "https://cdn.skypack.dev/three@0.132.2/examples/jsm/loaders/OBJLoader.js";
import { OrbitControls } from "https://cdn.skypack.dev/three@0.132.2/examples/jsm/controls/OrbitControls.js";
import { LineGeometry } from 'https://cdn.skypack.dev/three@0.132.2/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'https://cdn.skypack.dev/three@0.132.2/examples/jsm/lines/LineMaterial.js';
import { Line2 } from 'https://cdn.skypack.dev/three@0.132.2/examples/jsm/lines/Line2.js';
// import { loadAndPlotTemporal, updateTemporalView, updateTemporalPlotSize } from "./temporal.js"
import {loadAndPlotTemporal, animateTemporalView} from "./temporal.js"


// let bins = 5; 

let speechEnabled = false  ; 
let xrInteractionEnabled = false ;
let noneEnabled = true ; 
let globalState = {
  currentTimestamp: 0,
  bins: 5,
  jsonDatas: [],
  avatars: [],
  meshes: [],
  interactionMeshes: [],
  speechMeshes: [],
  intervals :undefined,  
  intervalDuration: 0,
  globalStartTime: 0,
  globalEndTime: 0,
  startTimeStamp: 0,
  endTimeStamp: 0,
  currentDataIndex: -1, 
};
window.addEventListener('binSizeChange', function(e) {
  globalState.bins = e.detail; 
  console.log('Bin size changed to:', e.detail);
});
let isAnimating = false;
// let currentTimestamp = 0; // Start Timestamp, global..scared 
const animationStep = 50; // Animation speed 
// let jsonDatas = null;
let roomMesh;
let meshes = [];
let avatars = []
let interactionMeshes = []
let speechMeshes = []

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffffff); // Set the background to white
const spatialView = document.getElementById('spatial-view');
// const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
const camera = new THREE.PerspectiveCamera(45, spatialView.innerWidth / spatialView.innerHeight, 0.1, 1000);
camera.position.set(0, 10, 10);
camera.updateProjectionMatrix();

const renderer = new THREE.WebGLRenderer({ antialias: true });

renderer.setSize(spatialView.width, spatialView.height);
// renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('spatial-view').appendChild(renderer.domElement);


const controls = new OrbitControls(camera, renderer.domElement);
controls.enableZoom = true; 

// To re-enable zoom when the mouse is over the canvas 
renderer.domElement.addEventListener('mouseenter', function() {
  controls.enableZoom = true; 
});

renderer.domElement.addEventListener('mouseleave', function() {
  controls.enableZoom = false; 
}); 
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(0, 1, 0);
scene.add(directionalLight);

let avatarLoaded = false;
let roomLoaded = false;
let movementPointsMesh; 

function fitCameraToObject(camera, object) {
  const boundingBox = new THREE.Box3().setFromObject(object);
  const center = boundingBox.getCenter(new THREE.Vector3());
  const size = boundingBox.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const fov = camera.fov * (Math.PI / 180);
  let cameraZ = Math.abs(maxDim / 4 * Math.tan(fov / 2));
  cameraZ *= 0.5; 

  camera.position.set(center.x, center.y, center.z + cameraZ);
  camera.position.z = center.z + cameraZ;
  camera.position.y += 10; 

  const aspect = window.innerWidth / window.innerHeight;
  camera.aspect = aspect;
  camera.lookAt(center);
  camera.near = cameraZ / 100;
  camera.far = cameraZ * 100;
  camera.updateProjectionMatrix();
}

controls.update();

const gridHelper = new THREE.GridHelper(10, 10);
gridHelper.position.y = -1; 
scene.add(gridHelper);

// const baseColor = new THREE.Color(0x0000ff); 

// let pointsMesh;
// let avatar;


async function loadAvatarModel(filename) {
  // const loader = new OBJLoader();
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(filename); 
  // const avatar = await loader.loadAsync(filename);
  const avatar = gltf.scene;
  avatar.scale.set(1, 1, 1); 
  // avatar.scale.set(0.01,0.01,0.01);
  scene.add(avatar);
  avatarLoaded = true;
  return avatar;
}

async function loadRoomModel() {
    const loader = new GLTFLoader();
    try {
        const gltf = await loader.loadAsync('room132.glb'); 
        roomMesh = gltf.scene;
        roomMesh.scale.set(1, 1, 1); 
        // scene.add(roomMesh);
    } catch (error) {
        console.error('Error loading the room model:', error);
    }
    roomLoaded = true;
}

function parseData(dataString) {
  // console.log("Data being parsed:", dataString);
    return dataString ? dataString.split(',').map(Number) : [];
}
// function parseDataInteraction(dataString){
//   const { x, y, z } = data.Data;

// }

function toggleAnimation() {
  isAnimating = !isAnimating;
  console.log("helllo");
  updatePlayPauseButton();
  if (isAnimating) {
    animateVisualization();
  }
}

function updatePlayPauseButton() {
  const playIcon = document.getElementById('playIcon');
  const pauseIcon = document.getElementById('pauseIcon');
  
  if (isAnimating) {
      playIcon.style.display = 'none';
      pauseIcon.style.display = 'block';
  } else {
      playIcon.style.display = 'block';
      pauseIcon.style.display = 'none';
  }
}

document.getElementById('toggle-none').addEventListener('change', function() {
  noneEnabled = this.checked;
  if (this.checked) {
    speechEnabled = false ; 
    xrInteractionEnabled = false ; 
    console.log({noneEnabled, speechEnabled, xrInteractionEnabled});
    updateLineThickness();
  } else {
    console.log(' ')
   
  }
});

document.getElementById('toggle-speech').addEventListener('change', function() {
  speechEnabled = this.checked;
  if (this.checked) { 
    noneEnabled = false ;
    xrInteractionEnabled = false ;
    console.log({noneEnabled, speechEnabled, xrInteractionEnabled});
    updateLineThickness();
  } else {
    console.log(' ');
  }
});

document.getElementById('toggle-xr-interaction').addEventListener('change', function() {
  xrInteractionEnabled = this.checked;
  if (this.checked) {
    noneEnabled = false ;
    speechEnabled = false ; 
    console.log({noneEnabled, speechEnabled, xrInteractionEnabled});
    updateLineThickness();
  } else {
    console.log(' ');
  }
});



function animateVisualization() {
  const jsonDatas = globalState.jsonDatas; 
  if (!isAnimating || jsonDatas.length === 0) return;
  
  const globalStartTime = globalState.globalStartTime;
  const globalEndTime = globalState.globalEndTime;
  const totalTime = globalEndTime - globalStartTime;

  // Ensure intervalDuration is already correctly set outside this function
  const nextTimestamp = globalStartTime + globalState.currentTimestamp;
  
  if (globalState.currentTimestamp < totalTime) {
    // const currentPlayerTime = globalStartTime + globalState.currentTimestamp;
    const elapsedTime = globalState.currentTimestamp;
    // console.log("Current Player Time: ", new Date(currentPlayerTime));
    const binIndex = Math.floor(elapsedTime / globalState.intervalDuration);
    // console.log("Bin Index: ", binIndex);
    // const binIndex = Math.floor(currentPlayerTime / globalState.intervalDuration);
    // console.log("this is bin index " + binIndex);
    globalState.startTimeStamp = globalStartTime + (binIndex * globalState.intervalDuration);
    globalState.endTimeStamp = globalState.startTimeStamp + globalState.intervalDuration;

    jsonDatas.forEach((data, index) => {
      updateVisualization(globalStartTime + elapsedTime);
    });
  
    updateTimeDisplay(globalStartTime + elapsedTime, globalStartTime);
    animateTemporalView(nextTimestamp);

    // Update the slider value to reflect the current progress
    const slider = document.querySelector('#slider-container input[type=range]');
    if (slider) {
      slider.value = (globalState.currentTimestamp / totalTime) * slider.max;
    }

    globalState.currentTimestamp += animationStep;
    requestAnimationFrame(animateVisualization);
  } else {
    isAnimating = false;
    globalState.currentTimestamp = 0; // Reset for potential restart
    toggleAnimation(); // Consider if you need to adjust the toggle here
  }
}


function createPointsMovement(data, id, isHighlight = false) {
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const colors = [];
    const hsl = { h: 0, s: 0, l: 0 };
    let baseColor ;
    // console.log("yo this is id " + id);
    if (id === 1 ) {baseColor = new THREE.Color("#69b3a2"); }
    else { baseColor = new THREE.Color("#ff6347") ; }
    baseColor.getHSL(hsl); 
    const scaleFactor = 2;
    const offsetX = 0; 
    const offsetY = 1;
    const offsetZ = 1;
    data.forEach(entry => {
        if (entry.TrackingType === 'PhysicalDevice' && entry.FeatureType === 'Transformation') {
            const dof = parseData(entry.Data);
            if (dof) {
              const x = dof[0] * scaleFactor + offsetX;
              const y = dof[1] * scaleFactor + offsetY;
              const z = dof[2] * scaleFactor + offsetZ;
              // console.log()
              positions.push(x,y,z);
              const lightness = isHighlight ? 0.5 : 0.8;
              const color = new THREE.Color().setHSL(hsl.h, hsl.s, lightness);
              colors.push(color.r, color.g, color.b);
            }
        }
    });
  
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    // if (id == 1 ) {geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));}
    // else { geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));}
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
     const material = new THREE.PointsMaterial({ size: 0.1, vertexColors: true, transparent: true, opacity: isHighlight ? 1.0 : 0.5 });
    //pointsMesh = new THREE.Points(geometry, material);
    const pointsMesh = new THREE.Points(geometry, material);
   
    // scene.add(pointsMesh);
    return pointsMesh;
}


function createLineMovement(data, id, speechFlag, xrInteractionFlag, isHighlight = false ) {
  const geometry = new LineGeometry(); // Use the LineGeometry for line data
  const positions = [];
  const colors = []; 
  const hsl = { h: 0, s: 0, l: 0 };
  let baseColor;
  let linewidth = 1 ; 

  if (id === 1) {
    baseColor = new THREE.Color("#69b3a2");
  } else {
    baseColor = new THREE.Color("#ff6347");
  }
  baseColor.getHSL(hsl);
  const scaleFactor = 2;
  const offsetX = 0;
  const offsetY = 1;
  const offsetZ = 1;

  data.forEach(entry => {
    if (entry.TrackingType === 'PhysicalDevice' && entry.FeatureType === 'Transformation') {
      const dof = parseData(entry.Data); // Ensure this function returns an array of numbers
      if (dof) {
        const x = dof[0] * scaleFactor + offsetX;
        const y = dof[1] * scaleFactor + offsetY;
        const z = dof[2] * scaleFactor + offsetZ;
        positions.push(x, y, z);
        const lightness = isHighlight ? 0.5 : 0.8;
        const color = new THREE.Color().setHSL(hsl.h, hsl.s, lightness);
        colors.push(color.r, color.g, color.b); // Flatten the color array
      }
    }
  });

  geometry.setPositions(positions.flat()); // Flatten the positions array for LineGeometry
  geometry.setColors(baseColor);
  if (noneEnabled) { linewidth = 1; }
  if (speechFlag && speechEnabled) { linewidth = 4 ; }
  if (xrInteractionFlag && xrInteractionEnabled) { linewidth = 4 ; }
  const material = new LineMaterial({
    // vertexColors: true,
    linewidth: linewidth, // Width of the line
    color: baseColor, // Base color, might need adjustment based on how you want to use colors
    transparent: true,
    opacity: isHighlight ? 1.0 : 0.5
  });

  // Adjust the material size to ensure it displays correctly
  material.resolution.set(window.innerWidth, window.innerHeight); // Necessary for LineMaterial

  const line = new Line2(geometry, material);
  line.computeLineDistances();

  return line;
}

function createPointsSpeech(data,id,isHighlight = false){
  const geometry = new THREE.BufferGeometry();
    const positions = [];
    const colors = [];
    const hsl = { h: 0, s: 0, l: 0 };
    let baseColor ;
    // console.log("yo this is id " + id);
    if (id === 1) {
      baseColor = new THREE.Color("#f7fcb9");
  } else {
      baseColor = new THREE.Color("#fde0dd");
  }
    baseColor.getHSL(hsl); 
    const scaleFactor = 2;
    const offsetX = 0; 
    const offsetY = 1;
    const offsetZ = 1;
    data.forEach(entry => {
      if (entry.TrackingType !== "NoneType" && 
          entry.FeatureType !== "NoneType" && 
          entry.TrackingType !== 'XRContent' &&
          entry.TranscriptionText !== undefined &&
          entry.TranscriptionText !== null &&
          entry.TranscriptionText.trim() !== ''
      ){
          let dof ; 
          let x,y,z;
          if (typeof entry.Data === 'string' ) { 
            dof = parseData( entry.Data );
            x = dof[0];
            y = dof[1];
            z = dof[2];
           }
          else {
            dof = entry.Data ; 
            x = dof.x; 
            y = dof.y ;
            z = dof.z
          }
              x = x*scaleFactor + offsetX;
              y = y * scaleFactor + offsetY;
              z = z * scaleFactor + offsetZ;
              // console.log(`creating point here at x: ${x}, y: ${y} , z:${z}`);
              positions.push(x,y,z);
              const lightness = isHighlight ? 0.5 : 0.8;
              const color = new THREE.Color().setHSL(hsl.h, hsl.s, lightness);
              colors.push(color.r, color.g, color.b);
        }
    });
  
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    // if (id == 1 ) {geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));}
    // else { geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));}
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    // isHighlight ? 1.0 : 0.5
     const material = new THREE.PointsMaterial({ size: 0.2, vertexColors: true, transparent: true, opacity: 0.5  });
    //pointsMesh = new THREE.Points(geometry, material);
    const pointsMesh = new THREE.Points(geometry, material);
    return pointsMesh;
}

function createPointsInteraction(data,id,isHighlight = false) {
  // const geometry = new THREE.BufferGeometry();
   const geometry = new THREE.SphereGeometry();
    const positions = [];
    const colors = [];
    const hsl = { h: 0, s: 0, l: 0 };
    let baseColor ;
    // console.log("yo this is id " + id);
    if (id == 1 ) {baseColor = new THREE.Color("#756bb1"); }
    else { baseColor = new THREE.Color("#dd1c77") ; }
    baseColor.getHSL(hsl); 
    const scaleFactor = 2;
    const offsetX = 0; 
    const offsetY = 1;
    const offsetZ = 1;
    data.forEach(entry => {
        if (entry.TrackingType === 'XRContent' && entry.FeatureType === 'Interaction') {
            // const dof = parseData(entry.Data);
            const dof = entry.Data;
            // console.log("this is dofx " + dof.x );

            if (dof) {
              // const x = dof.normalized.x * scaleFactor + offsetX;
              // const y = dof.normalized.y * scaleFactor + offsetY;
              // const z = dof.normalized.z * scaleFactor + offsetZ;
              const x = dof.x * scaleFactor + offsetX;
              const y = dof.y * scaleFactor + offsetY;
              const z = dof.z * scaleFactor + offsetZ;
              // console.log("This is x,y,z " + x + "," + y + "," + z);
              // console.log()
              positions.push(x,y,z);
              const lightness = isHighlight ? 0.5 : 0.8;
              const color = new THREE.Color().setHSL(hsl.h, hsl.s, lightness);
              colors.push(color.r, color.g, color.b);
            }
        }
    });
    // console.log("hey this is positions " + positions);
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    // if (id == 1 ) {geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));}
    // else { geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));}
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const material = new THREE.PointsMaterial({ size: 1, vertexColors: true, transparent: true, opacity: isHighlight ? 1.0 : 0.5 });
    //  const material = new THREE.PointsMaterial({ size: 0.1, vertexColors: true});
    //pointsMesh = new THREE.Points(geometry, material);
    const pointsMesh = new THREE.Points(geometry, material);
    return pointsMesh;

}

function createSpheresInteraction(data, id, isHighlight = false) {
  const spheres = []; // Array to hold all the sphere meshes
  const hsl = { h: 0, s: 0, l: 0 };
  let baseColor;
  if (id === 1) {
      baseColor = new THREE.Color("#756bb1");
  } else {
      baseColor = new THREE.Color("#dd1c77");
  }
  baseColor.getHSL(hsl);
  const scaleFactor = 2;
  const offsetX = 0;
  const offsetY = 1;
  const offsetZ = 1;
  const sphereRadius = 0.1; // Adjust the radius of the spheres as needed
  const segments = 16; // Number of segments; increase for smoother spheres

  data.forEach(entry => {
      if (entry.TrackingType === 'XRContent' && entry.FeatureType === 'Interaction') {
          const dof = entry.Data;
          if (dof) {
              const x = dof.x * scaleFactor + offsetX;
              const y = dof.y * scaleFactor + offsetY;
              const z = dof.z * scaleFactor + offsetZ;
              const geometry = new THREE.SphereGeometry(sphereRadius, segments, segments);
              const lightness = isHighlight ? 0.5 : 0.8;
              const color = new THREE.Color().setHSL(hsl.h, hsl.s, lightness);
              const material = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: isHighlight ? 1.0 : 0.5 });
              const sphereMesh = new THREE.Mesh(geometry, material);
              sphereMesh.position.set(x, y, z);
              // console.log(`creating sphere here at x: ${x}, y: ${y} , z:${z}`);
              spheres.push(sphereMesh); // Add the sphere mesh to the array
          }
      }
  });
  return spheres; // Return an array of sphere meshes
}

// function createSpheresSpeech(data,id,isHighlight = false){
//   const spheres = []; // Array to hold all the sphere meshes
//   const hsl = { h: 0, s: 0, l: 0 };
//   let baseColor;
//   if (id === 1) {
//       baseColor = new THREE.Color("#f7fcb9");
//   } else {
//       baseColor = new THREE.Color("#fde0dd");
//   }
//   baseColor.getHSL(hsl);
//   const scaleFactor = 2;
//   const offsetX = 0;
//   const offsetY = 1;
//   const offsetZ = 1;
//   const sphereRadius = 0.1; // Adjust the radius of the spheres as needed
//   const segments = 5; // Number of segments; increase for smoother spheres

//   data.forEach(entry => {
//       if (entry.TranscriptionText !== undefined && entry.TranscriptionText !== '') {
//           const dof = entry.Data;
//           if (dof) {
//               const x = dof.x * scaleFactor + offsetX;
//               const y = dof.y * scaleFactor + offsetY;
//               const z = dof.z * scaleFactor + offsetZ;
//               const geometry = new THREE.SphereGeometry(sphereRadius, segments, segments);
//               const lightness = isHighlight ? 0.5 : 0.8;
//               const color = new THREE.Color().setHSL(hsl.h, hsl.s, lightness);
//               const material = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: isHighlight ? 1.0 : 0.5 });
//               const sphereMesh = new THREE.Mesh(geometry, material);
//               sphereMesh.position.set(x, y, z);
//               console.log("created sphereMesh");
//               spheres.push(sphereMesh); 
//           }
//       }
//   });
//   return spheres;

// }

function createSpheresSpeech(data, id, isHighlight = false) {
    const spheres = []; // Array to hold all the sphere meshes
    let baseColor;
    if (id === 1) {
        baseColor = new THREE.Color("#f7fcb9");
    } else {
        baseColor = new THREE.Color("#fde0dd");
    }
    const hsl = { h: 0, s: 0, l: 0 };
    baseColor.getHSL(hsl);
    const scaleFactor = 2;
    const offsetX = 0;
    const offsetY = 1;
    const offsetZ = 1;
    const sphereRadius = 0.1; // Adjust the radius of the spheres as needed
    const segments = 2; // Number of segments; increase for smoother spheres

    // Assuming you want to keep a similar data structure and filtering logic
    data.forEach(entry => {
      if (entry.TrackingType !== "NoneType" && 
      entry.FeatureType !== "NoneType" && 
      entry.TrackingType !== 'XRContent' &&
      entry.TranscriptionText !== undefined &&
      entry.TranscriptionText !== null &&
      entry.TranscriptionText.trim() !== ''
  ){
            // Assuming 'Data' contains position info like in the previous function
            if (typeof entry.Data === 'string' ) { 
              dof = parseData( entry.Data );
              x = dof[0];
              y = dof[1];
              z = dof[2];
             }
            else {
              dof = entry.Data ; 
              x = dof.x; 
              y = dof.y ;
              z = dof.z
            }
            x = x*scaleFactor + offsetX;
                y = y * scaleFactor + offsetY;
                z = z * scaleFactor + offsetZ;
                const geometry = new THREE.SphereGeometry(sphereRadius, segments, segments);
                const lightness = isHighlight ? 0.5 : 0.8;
                const color = new THREE.Color().setHSL(hsl.h, hsl.s, lightness);
                const material = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: isHighlight ? 1.0 : 0.5 });
                const sphereMesh = new THREE.Mesh(geometry, material);
                sphereMesh.position.set(x, y, z);
                spheres.push(sphereMesh);
            }
    });
    return spheres;
}



async function initializeScene() {
  await Promise.all([loadRoomModel()]);
  const jsonFiles = await Promise.all([
      fetch('file1.json').then(response => response.json()),
      fetch('file1.json').then(response => response.json()), // Load the first file
      // fetch('file1Transformed_emptySpeech.json').then(response => response.json())  // Load the second file
  ]);
  const avatarArray = await Promise.all([
    // loadAvatarModel('Stickman.glb'),
    // loadAvatarModel('Stickman.glb') 
    loadAvatarModel("ipad_mini_2023/scene.gltf"),
    // /Users/zainabaamir/Desktop/CVCResearch/vis/ipad_mini_2023/scene.gltf
    // /Users/zainabaamir/Desktop/CVCResearch/vis/apple_ipad_pro/ipad.gltf
    loadAvatarModel("ipad_mini_2023/scene.gltf")
]);


  globalState.avatars = [avatarArray[0], avatarArray[1]];
  const jsonData1 = jsonFiles[0].sort((a, b) => new Date(a.Timestamp) - new Date(b.Timestamp));
  const jsonData2 = jsonFiles[1].sort((a, b) => new Date(a.Timestamp) - new Date(b.Timestamp));
  globalState.jsonDatas = [jsonData1, jsonData2];
  for (let i = 0; i < globalState.jsonDatas.length; i++) {
    globalState.meshes.push(createLineMovement(globalState.jsonDatas[i], i+1, false, false));
    globalState.interactionMeshes.push(createSpheresInteraction(globalState.jsonDatas[i],i+1 ));
    globalState.speechMeshes.push(createPointsSpeech(globalState.jsonDatas[i],i+1 ));
}
  // Initialize the slider based on the combined range of both datasets, not done
  createTimeSlider(globalState.jsonDatas);

  fitCameraToObject(camera, scene, 1.2, controls);

  const playPauseButton = document.createElement('div');
  playPauseButton.id = 'playPauseButton';
  playPauseButton.innerHTML = `
<svg id="playIcon" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-play">
  <polygon points="5 3 19 12 5 21 5 3"></polygon>
</svg>
<svg id="pauseIcon" style="display:none;" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-pause">
  <rect x="6" y="4" width="4" height="16"></rect>
  <rect x="14" y="4" width="4" height="16"></rect>
</svg>
`;
  document.getElementById('slider-container').appendChild(playPauseButton);
  playPauseButton.addEventListener('click', function() {
      toggleAnimation(); // Now correctly passing a function reference
  });
}

initializeScene();

function filterDataByType(data) {
  const validData = data.filter(entry => entry.TrackingType === 'PhysicalDevice' && entry.FeatureType === 'Transformation' && typeof entry.Data === 'string');
  const validDataInteraction = data.filter(entry => entry.TrackingType === 'XRContent' && entry.FeatureType === 'Interaction');
  const validDataSpeech = data.filter(entry => entry.TranscriptionText !== undefined && entry.TranscriptionText !== '');
  return { validData, validDataInteraction, validDataSpeech };
}

function findClosestDataEntry(data, timestamp) {
  if (data.length === 0) return null;
  return data.reduce((prev, curr) => {
      const currTimestamp = new Date(curr.Timestamp).getTime();
      const prevTimestamp = new Date(prev.Timestamp).getTime();
      return (Math.abs(currTimestamp - timestamp) < Math.abs(prevTimestamp - timestamp) ? curr : prev);
  });
}

function updateVisualization(currTimeStamp) {
  const {startTimeStamp, endTimeStamp} = globalState;
  //zainab have to do the dataindex here 
  const avatar = globalState.avatars[0];
  const data = globalState.jsonDatas[0];
  const mesh = globalState.meshes[0];
  const interactionMesh = globalState.interactionMeshes[0];
  const speechMesh = globalState.speechMeshes[0];
  // console.log(`Current time: ${new Date(currTimeStamp)}, StartTime : ${new Date(startTimeStamp)} EndTime : ${new Date(endTimeStamp)}`);

   if (!avatar) {
      console.error('The avatar has not been loaded.');
      return;
  }
  // const startTime = startTimeStamp ;
  // const endTime = endTimeStamp ;
 
  const intervalData = data.filter(entry => {
    const entryTime = new Date(entry.Timestamp).getTime();
    return entryTime >= startTimeStamp && entryTime <= endTimeStamp;
});

if (intervalData.length === 0) {
  return;
}
  const { validData, validDataInteraction, validDataSpeech } = filterDataByType(intervalData);
  const hasSpeech = validDataSpeech.length > 0;
  // Find closest entry to the timestamp among the filtered valid entries
  const closestData = findClosestDataEntry(validData, currTimeStamp);
  const closestDataInteraction = findClosestDataEntry(validDataInteraction, currTimeStamp);
  const closestDataSpeech = findClosestDataEntry(validDataSpeech, currTimeStamp);

  // if (closestData && validData.length > 0 && closestDataInteraction && validDataInteraction.length > 0 
  //   && closestDataSpeech && validDataSpeech.length > 0) {
    // console.log("here?");
    // console.l
      const currentData = validData.filter(entry => new Date(entry.Timestamp).getTime() <= new Date(closestData.Timestamp).getTime());
      const currentDataInteraction = validDataInteraction.filter(entry => new Date(entry.Timestamp).getTime() <= new Date(closestDataInteraction.Timestamp).getTime());
      const currentDataSpeech = validDataSpeech.filter(entry => new Date(entry.Timestamp).getTime() <= new Date(closestDataSpeech.Timestamp).getTime());
      

      if (mesh) { scene.remove(mesh);}
      if (interactionMesh){ interactionMesh.forEach(sphere => {scene.remove(sphere);});}
     // scene.remove(interactionMesh);
    if (speechMesh){ scene.remove(speechMesh); }
      
      const scaleFactor = 2;
      const offsetX = 0; // Adjust these offsets to move points in space
      const offsetY = 1;
      const offsetZ = 1;
      let id ;
      if (globalState.jsonDatas[0] === data ) { id = 1 ;} 
      else { id = 2 };

      // Create and add new points geometry to the scene
      // const newMesh = createPointsMovement(currentData,id);
      // const newMesh = createLineMovement(currentData,id);
      const newMesh = createLineMovement(validData, id, validDataSpeech.length > 0, validDataInteraction.length > 0);
      // console.log("Movement Mesh Properties:", newMesh.position, newMesh.scale, newMesh.visible);
      const newInteractionMesh = createSpheresInteraction(currentDataInteraction,id);
      // const newSpeechMesh = createSpheresSpeech(currentDataSpeech,id);
      const newSpeechMesh = createPointsSpeech(currentDataSpeech,id);
      // console.log("Interaction Mesh Properties:", newInteractionMesh.position, newInteractionMesh.scale, newInteractionMesh.visible);

      scene.add(newMesh);

      newInteractionMesh.forEach(sphere => {
        scene.add(sphere);
    });
    
  const dof = parseData(closestData.data);
  const [x, y, z,pitch, yaw, roll] = parseData(closestData.Data);
  avatar.position.x = x * scaleFactor + offsetX;
  avatar.position.y = y * scaleFactor + offsetY;
  avatar.position.z = z * scaleFactor + offsetZ;
  avatar.rotation.set(0, 0, 0); // Reset to avoid cumulative rotations
  const euler = new THREE.Euler(THREE.MathUtils.degToRad(pitch), THREE.MathUtils.degToRad(yaw), THREE.MathUtils.degToRad(roll), 'XYZ');   
  avatar.rotation.set(0, 0, 0);
  avatar.setRotationFromEuler(euler);
  // } 
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString();
}


function updateLineThickness(){
  console.log("im heree in update line thiekcnes ");
  
}

function createTimeSlider(data) {
  // const timestamps = data.map(entry => new Date(entry.Timestamp).getTime());
  // const startTime = Math.min(...timestamps);
  // const endTime = Math.max(...timestamps);
  const globalStartTimes = globalState.jsonDatas.map(data => Math.min(...data.map(entry => new Date(entry.Timestamp).getTime())));
  const globalEndTimes = globalState.jsonDatas.map(data => Math.max(...data.map(entry => new Date(entry.Timestamp).getTime())));
  globalState.globalStartTime = Math.min(...globalStartTimes);
  const globalStartTime = globalState.globalStartTime ;
  const somePadding = 5000;
  globalState.globalEndTime = Math.max(...globalEndTimes) + somePadding ; 
  const globalEndTime = globalState.globalEndTime;
  // const paddedEndtime = globalEndTime + somePadding ; 
  const totalTime = globalEndTime - globalStartTime; 
  globalState.intervalDuration = totalTime / globalState.bins; 
  // console.log("yo these are the bins " + bins );
  // console.log(`this is script.js start time: ${new Date(globalStartTime)} and endtime : ${new Date(globalEndTime)} ` );
  // console.log("this is interval duration from script " + intervalDuration);
  // console.log(` StartTime : ${new Date(globalStartTime)} EndTime : ${new Date(globalEndTime)}`);

  const duration = (globalEndTime- globalStartTime ) / 1000 / 60;
  globalState.intervals = Array.from({ length: globalState.bins + 1 }, (v, i) => new Date(globalStartTime+ i * globalState.intervalDuration));
  
  const slider = d3.select('#slider-container').append('input')
      .attr('type', 'range')
      .attr('min', 0) 
      .attr('max', duration) 
      .attr('step', 'any')
      .on('input', function() {
          const elapsedMinutes = +this.value;
          globalState.currentTimestamp = elapsedMinutes * 60 * 1000; // Convert minutes back to milliseconds
          const binIndex = Math.floor((globalState.currentTimestamp) / intervalDuration);
          globalState.startTimeStamp = globalState.globalStartTime + (binIndex * globalState.intervalDuration);
           
          globalState.endTimeStamp = globalState.startTimeStamp + globalState.intervalDuration;
          // console.log(` Sent to function StartTime  : ${new Date(globalState.startTimeStamp )} EndTime : ${new Date(globalState.endTimeStamp )}`);
         
          // console.log(`Global Start Time (UTC): ${new Date(startTimeStamp)}`);
          // console.log(`Global End Time (UTC): ${new Date(endTimeStamp)}`);
          if (isAnimating) {
            toggleAnimation(); 
            updatePlayPauseButton();
          }
          isAnimating = false; // Optionally pause animation
          const timestamp = globalState.globalStartTime + currentTimestamp;
          jsonDatas.forEach((data, index) => {
            updateVisualization(timestamp);
          });
          updateTimeDisplay(timestamp, globalStartTime);
          animateTemporalView(timestamp);
          // updateTimeDisplay(timestamp, startTime);
      });
  slider.node().value = 0;
  slider.on('input', function() {
    const elapsedMinutes = +this.value;
    globalState.currentTimestamp = elapsedMinutes * 60 * 1000; // Convert minutes back to milliseconds
    const binIndex = Math.floor((globalState.currentTimestamp) / globalState.intervalDuration);
    globalState.startTimeStamp = globalState.globalStartTime + (binIndex * globalState.intervalDuration);
    globalState.endTimeStamp = globalState.startTimeStamp + globalState.intervalDuration;
    // console.log(` Sent to function StartTime  : ${new Date(globalState.startTimeStamp )} EndTime : ${new Date(globalState.endTimeStamp )}`);
    if (isAnimating) {
      toggleAnimation(); 
      updatePlayPauseButton();
    }
    isAnimating = false; // Optionally pause animation
    const timestamp = globalState.globalStartTime + globalState.currentTimestamp;
    globalState.jsonDatas.forEach((data, index) => {
      updateVisualization(timestamp);
    });
    updateTimeDisplay(timestamp, globalState.globalStartTime);
    animateTemporalView(timestamp); 
});
}

function updateTimeDisplay(timestamp, startTime) {
  const elapsedMs = timestamp - startTime;
  const elapsedMinutes = Math.floor(elapsedMs / 60000); // Convert to minutes
  const elapsedSeconds = Math.floor((elapsedMs % 60000) / 1000); // Remaining seconds
  const milliseconds = Math.round((elapsedMs % 1000) / 10); 
  const date = new Date(timestamp);

  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  const milliseconds2 = date.getMilliseconds().toString().padStart(3, '0');

  const timeDisplay = document.getElementById('timeDisplay');
  if (timeDisplay) {
    // Format elapsed time as MM:SS:MMM
    // timeDisplay.textContent = `${elapsedMinutes}:${elapsedSeconds.toString().padStart(2, '0')}:${milliseconds.toString().padStart(3, '0')}`;
    timeDisplay.textContent = `${hours}:${minutes}:${seconds}`;
  }
}


camera.updateProjectionMatrix();

function onWindowResize() {
  const spatialView = document.getElementById('spatial-view');
  camera.aspect = spatialView.clientWidth / spatialView.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(spatialView.clientWidth, spatialView.clientHeight);
}

// loadAndPlotTemporalInteraction();
// loadAndPlotTemporalSpeech();
loadAndPlotTemporal();

onWindowResize();
window.addEventListener('resize', onWindowResize, false);
// window.addEventListener('resize', updateTemporalPlotSize);

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

animate();;