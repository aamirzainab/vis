import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import * as THREE from "https://cdn.skypack.dev/three@0.132.2";
import { GLTFLoader } from "https://cdn.skypack.dev/three@0.132.2/examples/jsm/loaders/GLTFLoader.js";
import { OBJLoader } from  "https://cdn.skypack.dev/three@0.132.2/examples/jsm/loaders/OBJLoader.js";
import { OrbitControls } from "https://cdn.skypack.dev/three@0.132.2/examples/jsm/controls/OrbitControls.js";
import { LineGeometry } from 'https://cdn.skypack.dev/three@0.132.2/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'https://cdn.skypack.dev/three@0.132.2/examples/jsm/lines/LineMaterial.js';
import { Line2 } from 'https://cdn.skypack.dev/three@0.132.2/examples/jsm/lines/Line2.js';
// import { loadAndPlotTemporal, updateTemporalView, updateTemporalPlotSize } from "./temporal.js"
import {loadAndPlotTemporal, animateTemporalView, getXScale} from "./temporal.js"
// import { getXScale } from './temporal.js';

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
  show: []
};


window.addEventListener('binSizeChange', function(e) {
  globalState.bins = e.detail;
  updateIntervals();
  console.log('Bin size changed to:', e.detail);
});
let isAnimating = false;
// let currentTimestamp = 0; // Start Timestamp, global..scared
const animationStep = 100; // Animation speed
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
  const avatar = gltf.scene;
  avatar.scale.set(1, 1, 1);
  avatar.name = filename;
  console.log(filename);
  scene.add(avatar);
  avatarLoaded = true;
  return avatar;
}

async function loadRoomModel() {
    const loader = new GLTFLoader();
    try {
        const filename = 'RealWorld/room132.glb';
        const gltf = await loader.loadAsync(filename);
        roomMesh = gltf.scene;
        roomMesh.name = filename;
        roomMesh.scale.set(1, 1, 1);
        scene.add(roomMesh);
    } catch (error) {
        console.error('Error loading the room model:', error);
    }
    roomLoaded = true;
}

function parseData(dataString) {
  // console.log("Data being parsed:", dataString);
    return dataString ? dataString.split(',').map(Number) : [];
}


function toggleAnimation() {
  isAnimating = !isAnimating;
  // console.log("helllo");
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

document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('toggle-user0').addEventListener('change', function() {
    globalState.show[0] = this.checked;
  });

  document.getElementById('toggle-user1').addEventListener('change', function() {
    globalState.show[1] = this.checked;
  });
});

function showUserData(userID) {
  // if (globalState.meshes[userID]) {
  //   scene.add(globalState.meshes[userID]);
  // }
  if (Array.isArray(globalState.meshes[userID])) {
    // Iterate over the array of meshes and add each one to the scene
    globalState.meshes[userID].forEach(mesh => {
      if (mesh !== null) {
        scene.add(mesh);
      }
    });
  }
  if (globalState.interactionMeshes[userID]) {
    globalState.interactionMeshes[userID].forEach(sphere => {
      if (sphere) scene.add(sphere);
    });
  }
  if (globalState.speechMeshes[userID]) {
    scene.add(globalState.speechMeshes[userID]);
  }
}

function hideUserData(userID) {
  if (Array.isArray(globalState.meshes[userID])) {
    // Iterate over the array of meshes and add each one to the scene
    globalState.meshes[userID].forEach(mesh => {
      if (mesh !== null) {
        scene.remove(mesh);
      }
    });
  }
  // if (globalState.meshes[userID]) {
  //   scene.remove(globalState.meshes[userID]);
  // }
  if (globalState.interactionMeshes[userID]) {
    globalState.interactionMeshes[userID].forEach(sphere => {
      if (sphere) scene.remove(sphere);
    });
  }
  if (globalState.speechMeshes[userID]) {
    scene.remove(globalState.speechMeshes[userID]);
  }
}





function animateVisualization() {
  const jsonDatas = globalState.jsonDatas;
  if (!isAnimating || jsonDatas.length === 0) return;

  const globalStartTime = globalState.globalStartTime;
  const globalEndTime = globalState.globalEndTime;
  const totalTime = globalEndTime - globalStartTime;

  const nextTimestamp = globalStartTime + globalState.currentTimestamp;
  //zainab come here smth is going wrong 
  // console.log("this is the current time stmap " + new Date(globalState.currentTimestamp));
  if (globalState.currentTimestamp < totalTime) {
    const elapsedTime = globalState.currentTimestamp;
    const binIndex = Math.floor(elapsedTime / globalState.intervalDuration);
    globalState.startTimeStamp = globalStartTime + (binIndex * globalState.intervalDuration);
    globalState.endTimeStamp = globalState.startTimeStamp + globalState.intervalDuration;
    jsonDatas.forEach((data, index) => {
      updateVisualization(nextTimestamp,index);
      // globalStartTime + elapsedTime);
    });

    updateTimeDisplay(nextTimestamp, globalStartTime);
    animateTemporalView(nextTimestamp);

    // Update the slider value to reflect the current progress
    const slider = document.querySelector('#slider-container input[type=range]');
    // console.log("this is it " + slider.offsetWidth);
    if (slider) {
      slider.value = (globalState.currentTimestamp / totalTime) * slider.max;
    }

    globalState.currentTimestamp += animationStep;
    requestAnimationFrame(animateVisualization);
  } else {
    isAnimating = false;
    globalState.currentTimestamp = 0; // Reset for restart
    toggleAnimation(); // Adjusting toggle here?
  }
}


function createPointsMovement(data, id, isHighlight = false) {
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const colors = [];
    const hsl = { h: 0, s: 0, l: 0 };
    let baseColor ;
    // console.log("yo this is id " + id);
    if (id === 0 ) {baseColor = new THREE.Color("#31a354"); }
    else { baseColor = new THREE.Color("#c51b8a") ; }
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
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
     const material = new THREE.PointsMaterial({ size: 0.1, vertexColors: true, transparent: true, opacity: isHighlight ? 1.0 : 0.5 });
    const pointsMesh = new THREE.Points(geometry, material);
    return pointsMesh;
}


function createLineSegment(data, id, speechFlag, xrInteractionFlag, opacity) {
  const geometry = new LineGeometry();
  const positions = [];
  const colors = [];
  const hsl = { h: 0, s: 0, l: 0 };
  let baseColor;
  let linewidth = 2 ;


  if (id === 0 ) {baseColor = new THREE.Color("#31a354"); }
  else { baseColor = new THREE.Color("#c51b8a") ; }
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
        positions.push(x, y, z);
        const color = new THREE.Color().setHSL(hsl.h, hsl.s, opacity);
        colors.push(color.r, color.g, color.b); // Flatten the color array
      }
    }
  });

  geometry.setPositions(positions.flat());
  geometry.setColors(colors);

  let material;
  material = new LineMaterial({
    linewidth: linewidth,
    color: baseColor, 
    opacity : opacity,
    transparent: true,
  });
  material.resolution.set(window.innerWidth, window.innerHeight);

  const line = new Line2(geometry, material);
  line.hasSpeech = speechFlag;
  line.hasInteraction = xrInteractionFlag;
  line.computeLineDistances();

  return line;
}

function createFullLine(data, id, currentBinIndex) {
  let lines = [];

  for (let binIndex = 0; binIndex < globalState.bins; binIndex++) {
      const binStartTime = globalState.globalStartTime + (binIndex * globalState.intervalDuration);
      const binEndTime = binStartTime + globalState.intervalDuration;
      const binData = data.filter(entry => {
          const entryTime = new Date(entry.Timestamp).getTime();
          return entryTime >= binStartTime && entryTime < binEndTime;
      });
      const { validData, validDataInteraction, validDataSpeech } = filterDataByType(binData);
      console.log("hey this is validDatainteraction.kength " + validDataInteraction.length);
      const opacity = binIndex === currentBinIndex ? 1 : 0.35;
      if (validData.length > 0) {
          const lineSegment = createLineSegment(validData, id, validDataSpeech.length > 0, validDataInteraction.length > 0, opacity);
          lines.push(lineSegment);
      }
  }
  return lines;
}




// function createPointsSpeech(data,id,isHighlight = false){
//   const geometry = new THREE.BufferGeometry();
//     const positions = [];
//     const colors = [];
//     const hsl = { h: 0, s: 0, l: 0 };
//     let baseColor ;
//     if (id === 0) {
//       baseColor = new THREE.Color("#f7fcb9");
//   } else {
//       baseColor = new THREE.Color("#fde0dd");
//   }
//     baseColor.getHSL(hsl);
//     const scaleFactor = 2;
//     const offsetX = 0;
//     const offsetY = 1;
//     const offsetZ = 1;
//     data.forEach(entry => {
//       if (entry.TrackingType !== "NoneType" &&
//           entry.FeatureType !== "NoneType" &&
//           entry.TrackingType !== 'XRContent' &&
//           entry.TranscriptionText !== undefined &&
//           entry.TranscriptionText !== null &&
//           entry.TranscriptionText.trim() !== ''
//       ){
//           let dof ;
//           let x,y,z;
//           if (typeof entry.Data === 'string' ) {
//             dof = parseData( entry.Data );
//             x = dof[0];
//             y = dof[1];
//             z = dof[2];
//            }
//           else {
//             dof = entry.Data ;
//             x = dof.x;
//             y = dof.y ;
//             z = dof.z
//           }
//               x = x*scaleFactor + offsetX;
//               y = y * scaleFactor + offsetY;
//               z = z * scaleFactor + offsetZ;
//               positions.push(x,y,z);
//               const lightness = isHighlight ? 0.5 : 0.8;
//               const color = new THREE.Color().setHSL(hsl.h, hsl.s, lightness);
//               colors.push(color.r, color.g, color.b);
//         }
//     });

//     geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
//     // if (id == 1 ) {geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));}
//     // else { geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));}
//     geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
//     // isHighlight ? 1.0 : 0.5
//      const material = new THREE.PointsMaterial({ size: 0.2, vertexColors: true, transparent: true, opacity: 0.5  });
//     //pointsMesh = new THREE.Points(geometry, material);
//     const pointsMesh = new THREE.Points(geometry, material);
//     return pointsMesh;
// }



function createPointsSpeech(data,id,isHighlight = false) {
  console.log();
}

function createPointsInteraction(data,id,isHighlight = false) {
  // const geometry = new THREE.BufferGeometry();
   const geometry = new THREE.SphereGeometry();
    const positions = [];
    const colors = [];
    const hsl = { h: 0, s: 0, l: 0 };
    let baseColor ;
    if (id === 0 ) {baseColor = new THREE.Color("#756bb1"); }
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
            if (dof) {
              // const x = dof.normalized.x * scaleFactor + offsetX;
              // const y = dof.normalized.y * scaleFactor + offsetY;
              // const z = dof.normalized.z * scaleFactor + offsetZ;
              const x = dof.x * scaleFactor + offsetX;
              const y = dof.y * scaleFactor + offsetY;
              const z = dof.z * scaleFactor + offsetZ;
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
  const sphereRadius = 0.1; 
  const segments = 16; 

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
      // fetch('file1.json').then(response => response.json()),
      fetch('file1Transformed_emptySpeech.json').then(response => response.json()),
      fetch('file1.json').then(response => response.json()), // Load the first file
      // fetch('file1Transformed_emptySpeech.json').then(response => response.json())  // Load the second file
  ]);
  const avatarArray = await Promise.all([
    loadAvatarModel("RealWorld/ipad_user1.glb"),
    loadAvatarModel("RealWorld/ipad_user2.glb")
  ]);


  globalState.avatars = [avatarArray[0], avatarArray[1]];

  jsonFiles.forEach((jsonData, index) => {
    const sortedData = jsonData.sort((a, b) => new Date(a.Timestamp) - new Date(b.Timestamp));
    globalState.jsonDatas[index] = sortedData;
    globalState.avatars[index] = avatarArray[index];
    globalState.meshes[index] = createFullLine(sortedData, index, 0);
    globalState.interactionMeshes[index] = createSpheresInteraction(sortedData, index)
    globalState.speechMeshes[index] = createPointsSpeech(sortedData, index);
    globalState.show[index] = true ; 
  });

  // createTimeSlider(globalState.jsonDatas);
  setTimes(globalState.jsonDatas);

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
  console.log("this is validdatainter" + validDataInteraction);
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

function updateVisualization(currTimeStamp,userID) {
  
  const {startTimeStamp, endTimeStamp} = globalState;
  const binIndex = Math.floor((currTimeStamp - globalState.globalStartTime) / globalState.intervalDuration);
  const avatar = globalState.avatars[userID];
  const data = globalState.jsonDatas[userID];
  const mesh = globalState.meshes[userID];
  const interactionMesh = globalState.interactionMeshes[userID];
  const speechMesh = globalState.speechMeshes[userID];

   if (!avatar) {
      console.error('The avatar has not been loaded.');
      return;
  }

  const intervalData = data.filter(entry => {
    const entryTime = new Date(entry.Timestamp).getTime();
    // return entryTime >= startTimeStamp && entryTime <= endTimeStamp;
    return entryTime <= endTimeStamp;
  });

  if (intervalData.length === 0) {
    return;
  } 
  const { validData, validDataInteraction, validDataSpeech } = filterDataByType(intervalData);
  const closestData = findClosestDataEntry(validData, currTimeStamp);
  // const binIndexClosestData = Math.floor(((closestData.Timestamp) - globalState.globalStartTime) / globalState.intervalDuration);
  const closestDataInteraction = findClosestDataEntry(validDataInteraction, currTimeStamp);
  const closestDataSpeech = findClosestDataEntry(validDataSpeech, currTimeStamp);

  // if (closestData && validData.length > 0 && closestDataInteraction && validDataInteraction.length > 0
  //   && closestDataSpeech && validDataSpeech.length > 0) {
  const currentData = validData.filter(entry => new Date(entry.Timestamp).getTime() <= new Date(closestData.Timestamp).getTime());
  const currentDataInteraction = validDataInteraction.filter(entry => new Date(entry.Timestamp).getTime() <= new Date(closestDataInteraction.Timestamp).getTime());
  const currentDataSpeech = validDataSpeech.filter(entry => new Date(entry.Timestamp).getTime() <= new Date(closestDataSpeech.Timestamp).getTime());

  clearPreviousObjects(userID);
  const scaleFactor = 2;
  const offsetX = 0; 
  const offsetY = 1;
  const offsetZ = 1;
  const newMesh = createFullLine(intervalData, userID, binIndex);
  globalState.meshes[userID] = newMesh ;
  const newInteractionMesh = createSpheresInteraction(currentDataInteraction,userID);
  globalState.interactionMeshes[userID] = newInteractionMesh ;
  const newSpeechMesh = createPointsSpeech(currentDataSpeech,userID);
  globalState.speechMeshes[userID] = newSpeechMesh;
  // console.log("Interaction Mesh Properties:", newInteractionMesh.position, newInteractionMesh.scale, newInteractionMesh.visible);
  updateLineThickness();
  if (globalState.show[userID]) {
    showUserData(userID);
    }
  else {
      hideUserData(userID);
    }
    const dof = parseData(closestData.data);
    const [x, y, z,pitch, yaw, roll] = parseData(closestData.Data);
    avatar.position.x = x * scaleFactor + offsetX;
    avatar.position.y = y * scaleFactor + offsetY;
    avatar.position.z = z * scaleFactor + offsetZ;
    avatar.rotation.set(0, 0, 0); // Reset to avoid cumulative rotations
    const euler = new THREE.Euler(THREE.MathUtils.degToRad(pitch), THREE.MathUtils.degToRad(yaw), THREE.MathUtils.degToRad(roll), 'XYZ');
    avatar.rotation.set(0, 0, 0);
    avatar.setRotationFromEuler(euler);
}

function clearPreviousObjects(userID) {
  if (Array.isArray(globalState.meshes[userID])) {
    globalState.meshes[userID].forEach(mesh => {
        if (mesh !== null) {
            scene.remove(mesh);
        }
    });
    globalState.meshes[userID] = [];
}

  if (globalState.interactionMeshes[userID]) {
    globalState.interactionMeshes[userID].forEach(sphere => {
      if (sphere) scene.remove(sphere);
    });
    globalState.interactionMeshes[userID] = []; 
  }

  // Clear the user-specific speech meshes
  if (globalState.speechMeshes[userID]) {
    scene.remove(globalState.speechMeshes[userID]);
    globalState.speechMeshes[userID] = null; 
  }
}


export function updateIntervals(){
  const totalTime = globalState.globalEndTime - globalState.globalStartTime;
  globalState.intervalDuration = totalTime / globalState.bins;
  globalState.intervals = [];
  globalState.intervals = Array.from({ length: globalState.bins + 1 }, (v, i) => new Date(globalState.globalStartTime+ i * globalState.intervalDuration));

}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString();
}


function updateLineThickness() {

  globalState.meshes.forEach((userMeshArray, userID) => {
      if (Array.isArray(userMeshArray)) {
          userMeshArray.forEach(lineSegment => {
              if (lineSegment !== null) {
                  let newLineWidth = 2; 
                  if (speechEnabled && lineSegment.hasSpeech) {
                      newLineWidth = 5; 
                  }
                  if (xrInteractionEnabled && lineSegment.hasInteraction) {
                    console.log("ever here?");
                      newLineWidth = 5; 
                  }
                  lineSegment.material.linewidth = newLineWidth;
                  lineSegment.material.needsUpdate = true;
              }
          });
      }
  });
}



function setTimes(data){
  const globalStartTimes = globalState.jsonDatas.map(data => Math.min(...data.map(entry => new Date(entry.Timestamp).getTime())));
  const globalEndTimes = globalState.jsonDatas.map(data => Math.max(...data.map(entry => new Date(entry.Timestamp).getTime())));
  globalState.globalStartTime = Math.min(...globalStartTimes);
  const globalStartTime = globalState.globalStartTime ;
  const somePadding = 0;
  globalState.globalEndTime = Math.max(...globalEndTimes) + somePadding - 5000;
  const globalEndTime = globalState.globalEndTime;
  // console.log("this is fgloablend time " + new Date(globalEndTime));
  const totalTime = globalEndTime - globalStartTime;
  globalState.intervalDuration = totalTime / globalState.bins;
  const duration = (globalEndTime- globalStartTime ) / 1000 / 60;
  globalState.intervals = Array.from({ length: globalState.bins + 1 }, (v, i) => new Date(globalStartTime+ i * globalState.intervalDuration));

}
function createTimeSlider(data) {
  // const timestamps = data.map(entry => new Date(entry.Timestamp).getTime());
  // const startTime = Math.min(...timestamps);
  // const endTime = Math.max(...timestamps);
  const globalStartTimes = globalState.jsonDatas.map(data => Math.min(...data.map(entry => new Date(entry.Timestamp).getTime())));
  const globalEndTimes = globalState.jsonDatas.map(data => Math.max(...data.map(entry => new Date(entry.Timestamp).getTime())));
  globalState.globalStartTime = Math.min(...globalStartTimes);
  const globalStartTime = globalState.globalStartTime ;
  const somePadding = 0;
  globalState.globalEndTime = Math.max(...globalEndTimes) + somePadding - 5000;
 
  const globalEndTime = globalState.globalEndTime;
  // const paddedEndtime = globalEndTime + somePadding ;
  const totalTime = globalEndTime - globalStartTime;
  globalState.intervalDuration = totalTime / globalState.bins;
  // console.log("yo these are the bins " + bins );
  // console.log(`this is script.js start time: ${new Date(globalStartTime)} and endtime : ${new Date(globalEndTime)} ` );
  // console.log("this is interval duration from script " + intervalDuration);
  // console.log(` StartTime : ${new Date(globalStartTime)} EndTime : ${new Date(globalEndTime)}`);
  // console.log(` this is end time script  ${new Date(globalEndTime)} `);

  const duration = (globalEndTime- globalStartTime ) / 1000 / 60;
  globalState.intervals = Array.from({ length: globalState.bins + 1 }, (v, i) => new Date(globalStartTime+ i * globalState.intervalDuration));
  // globalState.intervals = Array.from({ length: globalState.bins  }, (v, i) => new Date(globalStartTime+ i * globalState.intervalDuration));

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
          if (isAnimating) {
            toggleAnimation();
            updatePlayPauseButton();
          }
          isAnimating = false; // Optionally pause animation
          const timestamp = globalState.globalStartTime + currentTimestamp;
          jsonDatas.forEach((data, index) => {
            updateVisualization(timestamp,index);
          });
          animateTemporalView(timestamp);
          updateTimeDisplay(timestamp, globalStartTime);
          
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
    globalState.currentTimestamp = timestamp; // zainab come here 
    globalState.jsonDatas.forEach((data, index) => {
      updateVisualization(timestamp,index);
    });
    updateTimeDisplay(timestamp, globalState.globalStartTime);
    animateTemporalView(timestamp);
});
}


export function dragged(event, d) {
  const svg = d3.select("#temporal-view");
  const margin = { top: 20, right: 30, bottom: 10, left: 40 };
  const height = parseInt(svg.style("height")) - margin.top - margin.bottom;
  const width = parseInt(svg.style("width")) - margin.right - margin.left;
  const x = getXScale();
  console.log("Drag event:", event.x);
  // let newXPosition = Math.max(0, Math.min(event.x, width));
  let newXPosition = Math.max(0, Math.min(event.x - margin.left, width));
  let newTimestamp = x.invert(newXPosition);
  d3.select(this).attr('x1', newXPosition + margin.left).attr('x2', newXPosition + margin.left);
    d3.select('#time-indicator-circle')
        .attr('cx', newXPosition + margin.left);
  // const newTimestamp = x.invert(newXPosition);
  // const lastTimestamp = new Date(globalState.endTimeStamp); // Assuming this is the last timestamp
  if (newTimestamp > new Date(globalState.globalEndTime)) {
    newTimestamp = new Date(globalState.globalEndTime);
    newXPosition = x(newTimestamp); // Recalculate newXPosition based on corrected timestamp
  }
 
  console.log("this is new Timestamp " + newTimestamp);

  // Update the global state's current timestamp based on the line's new position
  globalState.currentTimestamp = newTimestamp.getTime() - globalState.globalStartTime;
  const binIndex = Math.floor(globalState.currentTimestamp / globalState.intervalDuration);
  globalState.startTimeStamp = globalState.globalStartTime + (binIndex * globalState.intervalDuration);
  globalState.endTimeStamp = globalState.startTimeStamp + globalState.intervalDuration;

  // Optionally pause animation
  if (isAnimating) {
      toggleAnimation();
      updatePlayPauseButton();
  }
  isAnimating = false;
  // const timestamp = globalState.globalStartTime + currentTimestamp;
  // Update visualizations similarly to the slider's input event
  globalState.jsonDatas.forEach((data, index) => {
      updateVisualization(newTimestamp.getTime(),index);
  });
  animateTemporalView(newTimestamp.getTime());
  updateTimeDisplay(newTimestamp.getTime(), globalState.globalStartTime);
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

export function getScene() {
  return scene;
}
animate();;
