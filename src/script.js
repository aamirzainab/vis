import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import * as THREE from "https://cdn.skypack.dev/three@0.132.2";
import { GLTFLoader } from "https://cdn.skypack.dev/three@0.132.2/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "https://cdn.skypack.dev/three@0.132.2/examples/jsm/controls/OrbitControls.js";
import { LineGeometry } from 'https://cdn.skypack.dev/three@0.132.2/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'https://cdn.skypack.dev/three@0.132.2/examples/jsm/lines/LineMaterial.js';
import { Line2 } from 'https://cdn.skypack.dev/three@0.132.2/examples/jsm/lines/Line2.js';
// import { loadAndPlotTemporal, updateTemporalView, updateTemporalPlotSize } from "./temporal.js"
import {loadAndPlotTemporal, animateTemporalView} from "./temporal.js"


let bins = 5; 
window.addEventListener('binSizeChange', function(e) {
  bins = e.detail; 
  console.log('Bin size changed to:', e.detail);
});
let intervals ; 

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
let isAnimating = false;
let currentTimestamp = 0; // Start Timestamp, global..scared 
const animationStep = 50; // Animation speed 
let jsonDatas = null;
let roomMesh;
let meshes = [];
let avatars = []
let interactionMeshes = []
let speechMeshes = []


async function loadAvatarModel(filename) {
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync(filename); 
    const avatar = gltf.scene;
    avatar.scale.set(1, 1, 1); 
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


document.getElementById('toggle-speech').addEventListener('change', function() {
  if (this.checked) {
    // Speech functionality enabled
    console.log('Speech functionality enabled');
  } else {
    // Speech functionality disabled
    console.log('Speech functionality disabled');
  }
});

document.getElementById('toggle-xr-interaction').addEventListener('change', function() {
  if (this.checked) {
    // Speech functionality enabled
    console.log('XR Interaction enabled');
  } else {
    // Speech functionality disabled
    console.log('XR Interaction disabled');
  }
});


// document.getElementById('toggle-absolute-time').addEventListener('change', function() {
//   if (this.checked) {
//     // Absolute time functionality enabled
//     console.log('Absolute time functionality enabled');
//   } else {
//     // Absolute time functionality disabled
//     console.log('Absolute time functionality disabled');
//   }
// });

function animateVisualization() {
  if (!isAnimating || jsonDatas.length === 0) return;
  const startTimes = jsonDatas.map(data => Math.min(...data.map(entry => new Date(entry.Timestamp).getTime())));
  const endTimes = jsonDatas.map(data => Math.max(...data.map(entry => new Date(entry.Timestamp).getTime())));
  const startTime = Math.min(...startTimes);
  const somePadding = 5000;
  const endTime = Math.max(...endTimes) + somePadding;
  const totalDuration = endTime - startTime;
  const intervalDuration = totalDuration / bins; 

  const nextTimestamp = startTime + currentTimestamp;
  if (currentTimestamp < totalDuration) {
    const currentAbsoluteTime = startTime + currentTimestamp;
    const binIndex = Math.floor((currentAbsoluteTime) / intervalDuration);
    const startTimeStamp = startTime + (binIndex * intervalDuration);
    const endTimeStamp = startTimeStamp + intervalDuration;
    // Update visualization for each dataset
    // should be a for loop 
    jsonDatas.forEach((data, index) => {
      updateVisualization(currentAbsoluteTime,startTimeStamp,endTimeStamp, data, meshes[index],interactionMeshes[index], speechMeshes[index] ,avatars[index]);
    });
  
    updateTimeDisplay(currentAbsoluteTime, startTime);
    animateTemporalView(nextTimestamp); // This might need adjustment to handle multiple datasets

    const slider = document.querySelector('#slider-container input[type=range]');
    if (slider) {
      slider.value = (currentTimestamp / 1000 / 60).toFixed(2); // Convert to minutes and update the slider
    }
    currentTimestamp += animationStep;
    requestAnimationFrame(animateVisualization);
  } else {
    isAnimating = false;
    currentTimestamp = 0; // Reset currentTimestamp if you want to loop
    toggleAnimation();
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


// function createLineMovement(data, id, isHighlight = false) {
//   const geometry = new THREE.BufferGeometry();
//   const positions = [];
//   const colors = [];
//   const hsl = { h: 0, s: 0, l: 0 };
//   let baseColor;
//   // console.log("yo this is id " + id);
//   if (id === 1) {
//       baseColor = new THREE.Color("#69b3a2");
//   } else {
//       baseColor = new THREE.Color("#ff6347");
//   }
//   baseColor.getHSL(hsl);
//   const scaleFactor = 2;
//   const offsetX = 0;
//   const offsetY = 1;
//   const offsetZ = 1;
//   data.forEach(entry => {
//       if (entry.TrackingType === 'PhysicalDevice' && entry.FeatureType === 'Transformation') {
//           const dof = parseData(entry.Data);
//           if (dof) {
//               const x = dof[0] * scaleFactor + offsetX;
//               const y = dof[1] * scaleFactor + offsetY;
//               const z = dof[2] * scaleFactor + offsetZ;
//               positions.push(x, y, z);
//               const lightness = isHighlight ? 0.5 : 0.8;
//               const color = new THREE.Color().setHSL(hsl.h, hsl.s, lightness);
//               colors.push(color.r, color.g, color.b);
//           }
//       }
//   });

//   geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
//   geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

//   const material = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, linewidth: 100, opacity: isHighlight ? 1.0 : 0.5 });
//   const lineMesh = new THREE.Line(geometry, material);
//   return lineMesh;
// }

// function createLineMovement(data, id, isHighlight = false) {
//   // Assuming THREE.LineGeometry behaves similarly to THREE.BufferGeometry
//   const geometry = new THREE.LineGeometry(); // Use LineGeometry
//   // const geometry = new LineGeometry();
//   const positions = [];
//   const colors = [];
//   const hsl = { h: 0, s: 0, l: 0 };
//   let baseColor;
  
//   if (id === 1) {
//       baseColor = new THREE.Color("#69b3a2");
//   } else {
//       baseColor = new THREE.Color("#ff6347");
//   }
//   baseColor.getHSL(hsl);
//   const scaleFactor = 2;
//   const offsetX = 0;
//   const offsetY = 1;
//   const offsetZ = 1;
  
//   data.forEach(entry => {
//       if (entry.TrackingType === 'PhysicalDevice' && entry.FeatureType === 'Transformation') {
//           const dof = parseData(entry.Data); // Ensure this function returns an array of numbers
//           if (dof) {
//               const x = dof[0] * scaleFactor + offsetX;
//               const y = dof[1] * scaleFactor + offsetY;
//               const z = dof[2] * scaleFactor + offsetZ;
//               positions.push(x, y, z);
//               const lightness = isHighlight ? 0.5 : 0.8;
//               const color = new THREE.Color().setHSL(hsl.h, hsl.s, lightness);
//               // console.log("here");
//               colors.push(color.r, color.g, color.b);
//           }
//       }
//   });

//   // Assuming setPositions and setColors methods are available or equivalent in your LineGeometry
//   geometry.setPositions(positions); // Adjusted for LineGeometry if it has a direct method
//   geometry.setColors(colors); // Adjusted for LineGeometry if it has a direct method

//   const material = new THREE.LineBasicMaterial({ vertexColors: THREE.VertexColors, transparent: true, linewidth: 100, opacity: isHighlight ? 1.0 : 0.5 });
//   const lineMesh = new THREE.Line(geometry, material);
//   return lineMesh;
// }



function createLineMovement(data, id, speechFlag, isHighlight = false) {
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
  if (speechFlag) { linewidth = 4 ; }
  // if (speechFlag && id == 2 ) 
  // {
  //   console.log("here with speechflahAHAAA " + speechFlag );
  //   console.log("AND WITH TRANSCRIPTIOPN TEXTTTTT" + data);
  // }
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
  // await Promise.all([loadAvatarModel(), loadRoomModel()]);
  await Promise.all([loadRoomModel()]);
  // Fetch both datasets concurrently
  const responses = await Promise.all([
      fetch('file1.json').then(response => response.json()), // Load the first file
      fetch('file1Transformed_emptySpeech.json').then(response => response.json())  // Load the second file
  ]);
  const avatarArray = await Promise.all([
    loadAvatarModel('Stickman.glb'),
    loadAvatarModel('Stickman.glb') // Assuming both avatars use the same model; replace with different models if necessary
]);

  avatars = [avatarArray[0], avatarArray[1]];
  // Each dataset is sorted by Timestamp
  const jsonData1 = responses[0].sort((a, b) => new Date(a.Timestamp) - new Date(b.Timestamp));
  const jsonData2 = responses[1].sort((a, b) => new Date(a.Timestamp) - new Date(b.Timestamp));
  jsonDatas = [jsonData1, jsonData2];
  // meshes.push(createPointsMovement(jsonData1,1));
  // meshes.push(createPointsMovement(jsonData2,2));
  meshes.push(createLineMovement(jsonData1,1));
  meshes.push(createLineMovement(jsonData2,2));
  interactionMeshes.push(createSpheresInteraction(jsonData1,1));
  interactionMeshes.push(createSpheresInteraction(jsonData2,2));
  // speechMeshes.push(createSpheresSpeech(jsonData1,1));
  // speechMeshes.push(createSpheresSpeech(jsonData2,2));
    speechMeshes.push(createPointsSpeech(jsonData1,1));
  speechMeshes.push(createPointsSpeech(jsonData2,2));
  




  // Initialize the slider based on the combined range of both datasets, not done
  createTimeSlider(jsonDatas);

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

function updateVisualization(currTimeStamp, startTimeStamp, endTimeStamp, data, mesh, interactionMesh, speechMesh, avatar) {
  if (!avatar) {
      console.error('The avatar has not been loaded.');
      return;
  }
  const startTime = startTimeStamp ;
  const endTime = endTimeStamp ;
  const intervalData = data.filter(entry => {
    const entryTime = new Date(entry.Timestamp).getTime();
    return entryTime >= startTimeStamp && entryTime <= endTimeStamp;
});
// console.log(`Interval Start: ${new Date(startTimeStamp)}, Interval End: ${new Date(endTimeStamp)}`);

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
      if (jsonDatas[0] === data ) { id = 1 ;} 
      else { id = 2 };

      // Create and add new points geometry to the scene
      // const newMesh = createPointsMovement(currentData,id);
      // const newMesh = createLineMovement(currentData,id);
      const newMesh = createLineMovement(validData, id, validDataSpeech.length > 0);
      // console.log("Movement Mesh Properties:", newMesh.position, newMesh.scale, newMesh.visible);
      const newInteractionMesh = createSpheresInteraction(currentDataInteraction,id);
      // const newSpeechMesh = createSpheresSpeech(currentDataSpeech,id);
      const newSpeechMesh = createPointsSpeech(currentDataSpeech,id);
      // console.log("Interaction Mesh Properties:", newInteractionMesh.position, newInteractionMesh.scale, newInteractionMesh.visible);

      scene.add(newMesh);

      newInteractionMesh.forEach(sphere => {
        scene.add(sphere);
    });
    
  //   newSpeechMesh.forEach(sphere => {
  //     scene.add(sphere);
  // });
  // scene.add(newSpeechMesh); zainab
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


function createTimeSlider(data) {
  // const timestamps = data.map(entry => new Date(entry.Timestamp).getTime());
  // const startTime = Math.min(...timestamps);
  // const endTime = Math.max(...timestamps);
  const globalStartTimes = jsonDatas.map(data => Math.min(...data.map(entry => new Date(entry.Timestamp).getTime())));
  const globalEndTimes = jsonDatas.map(data => Math.max(...data.map(entry => new Date(entry.Timestamp).getTime())));
  const globalStartTime = Math.min(...globalStartTimes);
  const somePadding = 5000;
  const globalEndTime = Math.max(...globalEndTimes) + somePadding ; 
  // const paddedEndtime = globalEndTime + somePadding ; 
  const totalTime = globalEndTime - globalStartTime; 
  const intervalDuration = totalTime / bins; 
  // console.log("yo these are the bins " + bins );
  console.log(`this is script.js start time: ${new Date(globalStartTime)} and endtime : ${new Date(globalEndTime)} ` );
  console.log("this is interval duration from script " + intervalDuration);
  const duration = (globalEndTime - globalStartTime) / 1000 / 60;
  intervals = Array.from({ length: bins + 1 }, (v, i) => new Date(globalStartTime + i * intervalDuration));
  
  const slider = d3.select('#slider-container').append('input')
      .attr('type', 'range')
      .attr('min', 0) 
      .attr('max', duration) 
      .attr('step', 'any')
      .on('input', function() {
          const elapsedMinutes = +this.value;
          currentTimestamp = elapsedMinutes * 60 * 1000; // Convert minutes back to milliseconds
          const binIndex = Math.floor((currentTimestamp) / intervalDuration);
          const startTimeStamp = globalStartTime + (binIndex * intervalDuration);
          const endTimeStamp = startTimeStamp + intervalDuration;
         
          // console.log(`Global Start Time (UTC): ${new Date(startTimeStamp)}`);
          // console.log(`Global End Time (UTC): ${new Date(endTimeStamp)}`);
          if (isAnimating) {
            toggleAnimation(); 
            updatePlayPauseButton();
          }
          isAnimating = false; // Optionally pause animation
          const timestamp = globalStartTime + currentTimestamp;
          jsonDatas.forEach((data, index) => {
            updateVisualization(timestamp,startTimeStamp,endTimeStamp, data, meshes[index],interactionMeshes[index], speechMeshes[index] ,avatars[index]);
          });
          updateTimeDisplay(timestamp, globalStartTime);
          animateTemporalView(timestamp);
          // updateTimeDisplay(timestamp, startTime);
      });
  slider.node().value = 0;
  slider.on('input', function() {
    const elapsedMinutes = +this.value;
    currentTimestamp = elapsedMinutes * 60 * 1000; // Convert minutes back to milliseconds
    const binIndex = Math.floor((currentTimestamp) / intervalDuration);
    const startTimeStamp = globalStartTime + (binIndex * intervalDuration);
    const endTimeStamp = startTimeStamp + intervalDuration;
    if (isAnimating) {
      toggleAnimation(); 
      updatePlayPauseButton();
    }
    isAnimating = false; // Optionally pause animation
    const timestamp = globalStartTime + currentTimestamp;
    jsonDatas.forEach((data, index) => {
      updateVisualization(timestamp,startTimeStamp,endTimeStamp, data, meshes[index],interactionMeshes[index], speechMeshes[index] ,avatars[index]);
    });
    updateTimeDisplay(timestamp, globalStartTime);
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