import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import * as THREE from "https://cdn.skypack.dev/three@0.132.2";
import {GLTFLoader} from "https://cdn.skypack.dev/three@0.132.2/examples/jsm/loaders/GLTFLoader.js";
import {OBJLoader} from "https://cdn.skypack.dev/three@0.132.2/examples/jsm/loaders/OBJLoader.js";
import {OrbitControls} from "https://cdn.skypack.dev/three@0.132.2/examples/jsm/controls/OrbitControls.js";
import {LineGeometry} from 'https://cdn.skypack.dev/three@0.132.2/examples/jsm/lines/LineGeometry.js';
import {LineMaterial} from 'https://cdn.skypack.dev/three@0.132.2/examples/jsm/lines/LineMaterial.js';
import {Line2} from 'https://cdn.skypack.dev/three@0.132.2/examples/jsm/lines/Line2.js';
import {loadAndPlotTemporal,animateTemporalView,getXScale} from "./temporal.js"

let speechEnabled = false;
let xrInteractionEnabled = false;
let noneEnabled = true;
let numUsers = 3;
let globalState = {
    currentTimestamp: 0,
    bins: 5,
    jsonDatas: [],
    avatars: [],
    meshes: [],
    interactionMeshes: [],
    speechMeshes: [],
    intervals: undefined,
    intervalDuration: 0,
    globalStartTime: 0,
    globalEndTime: 0,
    startTimeStamp: 0,
    endTimeStamp: 0,
    currentDataIndex: -1,
    show: [],
};
const hsl = {
    h: 0,
    s: 0,
    l: 0
};
let occulusData = {
  occulusFile : undefined, 
  occulusAvatar : undefined,
  occulusLeftController : undefined, 
  occulusRightController : undefined
} 

const colorScale = d3.scaleOrdinal()
  .domain([0,1,2])
  .range(["#1b9e77", "#d95f02", "#7570b3"]);


const opacities = [0.2, 0.4, 0.6, 0.8, 1];

window.addEventListener('binSizeChange', function(e) {
    globalState.bins = e.detail;
    updateIntervals();
    console.log('Bin size changed to:', e.detail);
});
let isAnimating = false;
const animationStep = 500; // Animation speed
let roomMesh;
let meshes = [];
let avatars = []
let interactionMeshes = []
let speechMeshes = []

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffffff);
const spatialView = document.getElementById('spatial-view');
const camera = new THREE.PerspectiveCamera(45, spatialView.innerWidth / spatialView.innerHeight, 0.1, 1000);
camera.position.set(0, 10, 10);
camera.updateProjectionMatrix();

const renderer = new THREE.WebGLRenderer({
    antialias: true
});

renderer.setSize(spatialView.width, spatialView.height);
document.getElementById('spatial-view').appendChild(renderer.domElement);


const controls = new OrbitControls(camera, renderer.domElement);
controls.enableZoom = true;

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


async function loadAvatarModel(filename) {
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync(filename);
    const avatar = gltf.scene;
    avatar.scale.set(1, 1, 1);
    avatar.name = filename;
    console.log(avatar.name);
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
    return dataString ? dataString.split(',').map(Number) : [];
}


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

document.getElementById('toggle-none').addEventListener('change', function() {
    noneEnabled = this.checked;
    if (this.checked) {
        speechEnabled = false;
        xrInteractionEnabled = false;
        console.log({
            noneEnabled,
            speechEnabled,
            xrInteractionEnabled
        });
        updateLineThickness();
    } else {
        console.log(' ')

    }
});

document.getElementById('toggle-speech').addEventListener('change', function() {
    speechEnabled = this.checked;
    if (this.checked) {
        noneEnabled = false;
        xrInteractionEnabled = false;
        console.log({
            noneEnabled,
            speechEnabled,
            xrInteractionEnabled
        });
        updateLineThickness();
    } else {
        console.log(' ');
    }
});

document.getElementById('toggle-xr-interaction').addEventListener('change', function() {
    xrInteractionEnabled = this.checked;
    if (this.checked) {
        noneEnabled = false;
        speechEnabled = false;
        console.log({
            noneEnabled,
            speechEnabled,
            xrInteractionEnabled
        });
        updateLineThickness();
    } else {
        console.log(' ');
    }
});

window.onload = function() {
    document.getElementById('toggle-user0').addEventListener('change', function() {
        globalState.show[0] = this.checked;
    });

    document.getElementById('toggle-user1').addEventListener('change', function() {
        globalState.show[1] = this.checked;
    });
    document.getElementById('toggle-user2').addEventListener('change', function() {
        globalState.show[2] = this.checked;
    });

    const objToolbar = document.getElementById('obj-toolbar');
    const toolbar = document.getElementById('toolbar');
    const userToolbar = document.getElementById('user-toolbar');
    const totalHeight = objToolbar.clientHeight + userToolbar.clientHeight + toolbar.clientHeight;
    objToolbar.style.top = '0';
    toolbar.style.bottom = '0';
    userToolbar.style.top = (toolbar.offsetTop - userToolbar.clientHeight) + 'px';
    const playPauseButton = document.getElementById('playPauseButton');
    const playPauseButtonHeight = playPauseButton.offsetHeight;
    const timeDisplay = document.getElementById('timeDisplay');
    timeDisplay.style.top = (playPauseButton.offsetTop - playPauseButtonHeight) + 'px';

};


function showUserData(userID) {
    if (Array.isArray(globalState.meshes[userID])) {
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
        globalState.meshes[userID].forEach(mesh => {
            if (mesh !== null) {
                scene.remove(mesh);
            }
        });
    }
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
    if (globalState.currentTimestamp < totalTime) {
        const elapsedTime = globalState.currentTimestamp;
        const binIndex = Math.floor(elapsedTime / globalState.intervalDuration);
        globalState.startTimeStamp = globalStartTime + (binIndex * globalState.intervalDuration);
        globalState.endTimeStamp = globalState.startTimeStamp + globalState.intervalDuration;
        jsonDatas.forEach((data, index) => {
            updateVisualization(nextTimestamp, index);
            updateVisualizationOcculus(nextTimestamp);
        });

        updateTimeDisplay(nextTimestamp, globalStartTime);
        animateTemporalView(nextTimestamp);

        const slider = document.querySelector('#slider-container input[type=range]');
        if (slider) {
            slider.value = (globalState.currentTimestamp / totalTime) * slider.max;
        }

        globalState.currentTimestamp += animationStep;
        requestAnimationFrame(animateVisualization);
    } else {
        isAnimating = false;
        globalState.currentTimestamp = 0; // Reset for restart
        toggleAnimation();
    }
}


function createPointsMovement(data, id, isHighlight = false) {
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const colors = [];
    let colorShade = colorScale(id);
    let baseColor = new THREE.Color(colorShade);
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
                const lightness = isHighlight ? 0.5 : 0.8;
                const color = new THREE.Color().setHSL(hsl.h, hsl.s, lightness);
                colors.push(color.r, color.g, color.b);
            }
        }
    });

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const material = new THREE.PointsMaterial({
        size: 0.1,
        vertexColors: true,
        transparent: true,
        opacity: isHighlight ? 1.0 : 0.5
    });
    const pointsMesh = new THREE.Points(geometry, material);
    return pointsMesh;
}

function createLineSegment(data, id, speechFlag, xrInteractionFlag, opacity, dashSize, gapSize ) {
    const geometry = new LineGeometry();
    const positions = [];
    const colors = [];
    let colorShade = colorScale(id);
    let baseColor = new THREE.Color(colorShade);
    let linewidth = 2;
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
        opacity: opacity,
        transparent: true,
        dashed: false,
        dashSize: dashSize,
        gapSize: gapSize,
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
    const maxOpacity = 1;
    const minOpacity = 0.1;
    const opacityDropOffRate = 0.2;
    const baseDashSize = 0.25;
    const baseGapSize = 0.01;
    const dashGapIncreaseFactor = 0.05;
    const maxGapSize = 0.5;
    for (let binIndex = 0; binIndex < globalState.bins; binIndex++) {
        const binStartTime = globalState.globalStartTime + (binIndex * globalState.intervalDuration);
        const binEndTime = binStartTime + globalState.intervalDuration;
        const binData = data.filter(entry => {
            const entryTime = new Date(entry.Timestamp).getTime();
            return entryTime >= binStartTime && entryTime < binEndTime;
        });
        const {
            validData,
            validDataInteraction,
            validDataSpeech
        } = filterDataByType(binData);
        const distance = Math.abs(currentBinIndex - binIndex);
        let opacity = Math.max(maxOpacity - distance * opacityDropOffRate, minOpacity);
        let dashSize = baseDashSize + (distance * dashGapIncreaseFactor);
        let gapSize = Math.min(baseGapSize + (distance * dashGapIncreaseFactor), maxGapSize);
        if (validData.length > 0) {
            const lineSegment = createLineSegment(validData, id, validDataSpeech.length > 0, validDataInteraction.length > 0, opacity, dashSize, gapSize);
            lines.push(lineSegment);
        }
    }
    return lines;
}



function createFullLineOcculus(data, id, currentBinIndex) {
  const lines = [];
  const opacitySettings = { maxOpacity: 1, minOpacity: 0.1, dropOffRate: 0.2 };
  const dashGapSettings = { baseDashSize: 0.25, baseGapSize: 0.01, increaseFactor: 0.05, maxGapSize: 0.5 };

  for (let binIndex = 0; binIndex < globalState.bins; binIndex++) {
    const binStartTime = globalState.globalStartTime + binIndex * globalState.intervalDuration;
    const binEndTime = binStartTime + globalState.intervalDuration;
    const binData = data.filter(entry => {
      const entryTime = new Date(entry.Timestamp).getTime();
      return entryTime >= binStartTime && entryTime < binEndTime;
    });

    const distance = Math.abs(currentBinIndex - binIndex);
    const opacity = Math.max(opacitySettings.maxOpacity - distance * opacitySettings.dropOffRate, opacitySettings.minOpacity);
    const dashSize = dashGapSettings.baseDashSize + distance * dashGapSettings.increaseFactor;
    const gapSize = Math.min(dashGapSettings.baseGapSize + distance * dashGapSettings.increaseFactor, dashGapSettings.maxGapSize);

    const displayLines = [], leftControllerLines = [], rightControllerLines = [];
    binData.forEach(entry => {
      const lineSegment = createLineSegmentOcculus(entry, id, opacity, dashSize, gapSize, entry.TrackingType);
      if (entry.TrackingType === 'PhysicalXRDisplay') displayLines.push(lineSegment);
      else if (entry.TrackingType === 'PhysicalXRController_L') leftControllerLines.push(lineSegment);
      else if (entry.TrackingType === 'PhysicalXRController_R') rightControllerLines.push(lineSegment);
    });

    lines.push(...displayLines, ...leftControllerLines, ...rightControllerLines);
  }

  return lines;
}

function createLineSegmentOcculus(data, id, opacity, dashSize, gapSize, trackingType) {
  const geometry = new LineGeometry();
  const positions = [], colors = [];
  let colorShade = colorScale(id);
  let baseColor = new THREE.Color(colorShade);
  const linewidth = 2, scaleFactor = 2;
  const offset = { x: 0, y: 1, z: 1 };

  data.forEach(entry => {
    if (entry.TrackingType === trackingType && entry.DataType === 'Transformation') {
      const dof = parseData(entry.Data);
      if (dof) {
        positions.push(dof[0] * scaleFactor + offset.x, dof[1] * scaleFactor + offset.y, dof[2] * scaleFactor + offset.z);
        const color = new THREE.Color().setHSL(baseColor.getHSL().h, baseColor.getHSL().s, opacity);
        colors.push(color.r, color.g, color.b);
      }
    }
  });

  geometry.setPositions(positions);
  geometry.setColors(colors);

  let material = new LineMaterial({
    linewidth, color: baseColor, opacity, transparent: true, dashSize, gapSize,
  });
  material.resolution.set(window.innerWidth, window.innerHeight);

  const line = new Line2(geometry, material);
  line.computeLineDistances();

  return line;
}


function createPointsInteraction(data, id, isHighlight = false) {
    const geometry = new THREE.SphereGeometry();
    const positions = [];
    const colors = [];
    let colorShade = colorScale(id);
    let baseColor = new THREE.Color(colorShade);
    baseColor.getHSL(hsl);
    const scaleFactor = 2;
    const offsetX = 0;
    const offsetY = 1;
    const offsetZ = 1;
    data.forEach(entry => {
        if (entry.TrackingType === 'XRContent' && entry.FeatureType === 'Interaction') {
            const dof = entry.Data;
            if (dof) {
                const x = dof.x * scaleFactor + offsetX;
                const y = dof.y * scaleFactor + offsetY;
                const z = dof.z * scaleFactor + offsetZ;
                positions.push(x, y, z);
                const lightness = isHighlight ? 0.5 : 0.8;
                const color = new THREE.Color().setHSL(hsl.h, hsl.s, lightness);
                colors.push(color.r, color.g, color.b);
            }
        }
    });
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const material = new THREE.PointsMaterial({
        size: 1,
        vertexColors: true,
        transparent: true,
        opacity: isHighlight ? 1.0 : 0.5
    });
    const pointsMesh = new THREE.Points(geometry, material);
    return pointsMesh;

}

function createSpheresInteraction(data, id, isHighlight = false) {
    const spheres = [];
    let colorShade = colorScale(id);
    let baseColor = new THREE.Color(colorShade);
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
                const material = new THREE.MeshBasicMaterial({
                    color: color,
                    transparent: true,
                    opacity: isHighlight ? 1.0 : 0.5
                });
                const sphereMesh = new THREE.Mesh(geometry, material);
                sphereMesh.position.set(x, y, z);
                spheres.push(sphereMesh);
            }
        }
    });
    return spheres; // Returns array of sphere meshes
}

function createSpheresSpeech(data, id, isHighlight = false) {
    const spheres = []; // Array to hold all the sphere meshes
    let colorShade = colorScale(id);
    let baseColor = new THREE.Color(colorShade);


    baseColor.getHSL(hsl);
    const scaleFactor = 2;
    const offsetX = 0;
    const offsetY = 1;
    const offsetZ = 1;
    const sphereRadius = 0.1; 
    const segments = 2; // Number of segments; increase for smoother spheres

    data.forEach(entry => {
        if (entry.TrackingType !== "NoneType" &&
            entry.FeatureType !== "NoneType" &&
            entry.TrackingType !== 'XRContent' &&
            entry.TranscriptionText !== undefined &&
            entry.TranscriptionText !== null &&
            entry.TranscriptionText.trim() !== ''
        ) {
            if (typeof entry.Data === 'string') {
                dof = parseData(entry.Data);
                x = dof[0];
                y = dof[1];
                z = dof[2];
            } else {
                dof = entry.Data;
                x = dof.x;
                y = dof.y;
                z = dof.z
            }
            x = x * scaleFactor + offsetX;
            y = y * scaleFactor + offsetY;
            z = z * scaleFactor + offsetZ;
            const geometry = new THREE.SphereGeometry(sphereRadius, segments, segments);
            const lightness = isHighlight ? 0.5 : 0.8;
            const color = new THREE.Color().setHSL(hsl.h, hsl.s, lightness);
            const material = new THREE.MeshBasicMaterial({
                color: color,
                transparent: true,
                opacity: isHighlight ? 1.0 : 0.5
            });
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
        fetch('file1Transformed_emptySpeech.json').then(response => response.json()),
        fetch('file1.json').then(response => response.json()),
        fetch('file1TransformedUser3.json').then(response => response.json()),
    ]);
    const avatarArray = await Promise.all([
        loadAvatarModel("RealWorld/ipad_user1.glb"),
        loadAvatarModel("RealWorld/ipad_user2.glb"),
        loadAvatarModel("RealWorld/ipad_user3.glb"),
        
    ]);
    globalState.avatars = [avatarArray[0], avatarArray[1], avatarArray[2]];

    occulusData.occulusFile = await Promise.all([
      fetch('occulusFile.json').then(response => response.json()),
    ]);
    occulusData.occulusFile = Object.values(occulusData.occulusFile[0]);
    occulusData.occulusAvatar = await loadAvatarModel("oculus_quest_2.glb");
    occulusData.occulusLeftController = await  loadAvatarModel("oculus_controller_left.glb");
    occulusData.occulusRightController =  await  loadAvatarModel("oculus_controller_right.glb");

    occulusData.occulusFile = Object.values(occulusData.occulusFile ).sort((a, b) => new Date(a.Timestamp) - new Date(b.Timestamp));

    jsonFiles.forEach((jsonData, index) => {
        const sortedData = jsonData.sort((a, b) => new Date(a.Timestamp) - new Date(b.Timestamp));
        globalState.jsonDatas[index] = sortedData;
        globalState.avatars[index] = avatarArray[index];
        globalState.meshes[index] = createFullLine(sortedData, index, 0);
        globalState.interactionMeshes[index] = createSpheresInteraction(sortedData, index)
        globalState.speechMeshes[index] = undefined;
        // globalState.speechMeshes[index] = createPointsSpeech(sortedData, index);
        globalState.show[index] = true;
    });
     createFullLineOcculus(occulusData.occulusFile,0,0);

    // setTimes(globalState.jsonDatas);
    setTimes(occulusData.occulusFile);
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
        toggleAnimation();
    });

    const { users, links } = processMovementData();
    plotTwoNetworkChart(users,links);
}


initializeScene();

function filterDataByType(data) {
    const validData = data.filter(entry => entry.TrackingType === 'PhysicalDevice' && entry.FeatureType === 'Transformation' && typeof entry.Data === 'string');
    const validDataInteraction = data.filter(entry => entry.TrackingType === 'XRContent' && entry.FeatureType === 'Interaction');
    const validDataSpeech = data.filter(entry => entry.TranscriptionText !== undefined && entry.TranscriptionText !== '');
    return {
        validData,
        validDataInteraction,
        validDataSpeech
    };
}

function findClosestDataEntry(data, timestamp) {
    if (data.length === 0) return null;
    return data.reduce((prev, curr) => {
        const currTimestamp = new Date(curr.Timestamp).getTime();
        const prevTimestamp = new Date(prev.Timestamp).getTime();
        return (Math.abs(currTimestamp - timestamp) < Math.abs(prevTimestamp - timestamp) ? curr : prev);
    });
}

function updateVisualization(currTimeStamp, userID) {

    const {
        startTimeStamp,
        endTimeStamp
    } = globalState;
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
        return entryTime <= endTimeStamp;
    });

    if (intervalData.length === 0) {
        return;
    }
    const {
        validData,
        validDataInteraction,
        validDataSpeech
    } = filterDataByType(intervalData);
    const closestData = findClosestDataEntry(validData, currTimeStamp);
    const closestDataInteraction = findClosestDataEntry(validDataInteraction, currTimeStamp);
    const closestDataSpeech = findClosestDataEntry(validDataSpeech, currTimeStamp);
    const currentData = validData.filter(entry => new Date(entry.Timestamp).getTime() <= new Date(closestData.Timestamp).getTime());
    const currentDataInteraction = validDataInteraction.filter(entry => new Date(entry.Timestamp).getTime() <= new Date(closestDataInteraction.Timestamp).getTime());
    const currentDataSpeech = validDataSpeech.filter(entry => new Date(entry.Timestamp).getTime() <= new Date(closestDataSpeech.Timestamp).getTime());

    clearPreviousObjects(userID);
    const scaleFactor = 2;
    const offsetX = 0;
    const offsetY = 1;
    const offsetZ = 1;
    const newMesh = createFullLine(intervalData, userID, binIndex);
    globalState.meshes[userID] = newMesh;
    const occulusMeshes = createFullLineOcculus(intervalData, 0);
    occulusMeshes.forEach(datasetLines => {
        datasetLines.forEach(line => {
            scene.add(line);
        });
    });
    const newInteractionMesh = createSpheresInteraction(currentDataInteraction, userID);
    globalState.interactionMeshes[userID] = newInteractionMesh;
    const newSpeechMesh = undefined;
    globalState.speechMeshes[userID] = newSpeechMesh;
    updateLineThickness();
    if (globalState.show[userID]) {
        showUserData(userID);
    } else {
        hideUserData(userID);
    }
    const dof = parseData(closestData.data);
    const [x, y, z, pitch, yaw, roll] = parseData(closestData.Data);
    avatar.position.x = x * scaleFactor + offsetX;
    avatar.position.y = y * scaleFactor + offsetY;
    avatar.position.z = z * scaleFactor + offsetZ;
    avatar.rotation.set(0, 0, 0); // Reset to avoid cumulative rotations
    const euler = new THREE.Euler(THREE.MathUtils.degToRad(pitch), THREE.MathUtils.degToRad(yaw), THREE.MathUtils.degToRad(roll), 'XYZ');
    avatar.rotation.set(0, 0, 0);
    avatar.setRotationFromEuler(euler);
}

function updateVisualizationOcculus(currTimeStamp){
  const validData = occulusData.occulusFile.filter(entry => entry.TrackingType === 'PhysicalXRDisplay' 
  && entry.DataType === 'Transformation');
  // console.log(validData);
  const closestData = findClosestDataEntry(validData, currTimeStamp);
    if (closestData !== null )
    {
      const [x, y, z, pitch, yaw, roll] = parseData(closestData.Data);
      const scaleFactor = 2;
      const offsetX = 0;
      const offsetY = 1;
      const offsetZ = 1;
      occulusData.occulusAvatar.position.x = x * scaleFactor + offsetX;
      occulusData.occulusAvatar.position.y = y * scaleFactor + offsetY;
      occulusData.occulusAvatar.position.z = z * scaleFactor + offsetZ;
      occulusData.occulusAvatar.rotation.set(0, 0, 0); 
      const euler = new THREE.Euler(THREE.MathUtils.degToRad(pitch), THREE.MathUtils.degToRad(yaw), THREE.MathUtils.degToRad(roll), 'XYZ');
      occulusData.occulusAvatar.setRotationFromEuler(euler);
    }
    const validRightControllerData = occulusData.occulusFile.filter(entry => entry.TrackingType === 'PhysicalXRController_R'
    && entry.DataType === 'Transformation' && typeof entry.Data === 'string');
    const validLeftControllerData = occulusData.occulusFile.filter(entry => entry.TrackingType === 'PhysicalXRController_L'
    && entry.DataType === 'Transformation' && typeof entry.Data === 'string');
    console.log(validRightControllerData);
    updateControllerVisualization(validRightControllerData, currTimeStamp, 'right');
    updateControllerVisualization(validLeftControllerData, currTimeStamp, 'left');

}


function updateControllerVisualization(controllerData, currTimeStamp, side) {
  const closestData = findClosestDataEntry(controllerData, currTimeStamp);
  if (closestData !== null) {
      const [x, y, z, pitch, yaw, roll] = parseData(closestData.Data);
      const scaleFactor = 2;
      const offsetX = 0;
      const offsetY = 1;
      const offsetZ = 1;
      if ( side === 'left' ) {
        occulusData.occulusLeftController.position.x = x * scaleFactor + offsetX;
        occulusData.occulusLeftController.position.y = y * scaleFactor + offsetY;
        occulusData.occulusLeftController.position.z = z * scaleFactor + offsetZ;
        occulusData.occulusLeftController.rotation.set(0, 0, 0); 
        const euler = new THREE.Euler(THREE.MathUtils.degToRad(pitch), THREE.MathUtils.degToRad(yaw), THREE.MathUtils.degToRad(roll), 'XYZ');
        occulusData.occulusLeftController.setRotationFromEuler(euler);
      }
      else if (side === 'right')
      {
        occulusData.occulusRightController.position.x = x * scaleFactor + offsetX;
        occulusData.occulusRightController.position.y = y * scaleFactor + offsetY;
        occulusData.occulusRightController.position.z = z * scaleFactor + offsetZ;
        occulusData.occulusRightController.rotation.set(0, 0, 0); 
        const euler = new THREE.Euler(THREE.MathUtils.degToRad(pitch), THREE.MathUtils.degToRad(yaw), THREE.MathUtils.degToRad(roll), 'XYZ');
        occulusData.occulusRightController.setRotationFromEuler(euler);
      }
  }
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

    if (globalState.speechMeshes[userID]) {
        scene.remove(globalState.speechMeshes[userID]);
        globalState.speechMeshes[userID] = null;
    }
}


export function updateIntervals() {
    const totalTime = globalState.globalEndTime - globalState.globalStartTime;
    globalState.intervalDuration = totalTime / globalState.bins;
    globalState.intervals = [];
    globalState.intervals = Array.from({
        length: globalState.bins + 1
    }, (v, i) => new Date(globalState.globalStartTime + i * globalState.intervalDuration));

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
                        newLineWidth = 5;
                    }
                    lineSegment.material.linewidth = newLineWidth;
                    lineSegment.material.needsUpdate = true;
                }
            });
        }
    });
}

function processMovementData() {
  const jsonDatas = globalState.jsonDatas;
  let users = []; 

  for (let i = 0; i < 2; i++) {
    users.push({ id: i, path: [] });
  }
  jsonDatas.forEach((userDatas, userId) => {
    if (userId < 2) { 
      userDatas.forEach(entry => {
        if (entry.TrackingType === 'PhysicalDevice' && entry.FeatureType === 'Transformation') {
          const dof = parseData(entry.Data);
          if (dof) {
            const x = dof[0]
            const y = dof[1]
            const z = dof[2] 
            users[userId].path.push({ x: x, y: y, z: z });
          }
        }
      });
    }
  });

  let links = [{
    source: 0, // Assuming user 0 is the source
    target: 1, // Assuming user 1 is the target
    type: 'relationship'
  }];

  return { users, links };
}


function plotTwoNetworkChart(users, links) {
  const plotBox1 = d3.select("#plot-box1").html(""); 
  const margin = { top: 20, right: 50, bottom: 20, left: 100 };
  const width =  plotBox1.node().getBoundingClientRect().width - margin.left - margin.right; 
  const height = plotBox1.node().getBoundingClientRect().height - margin.top - margin.bottom; 
  
  const svg = plotBox1.append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  const xScale = d3.scaleLinear()
    .domain([d3.min(users.flatMap(u => u.path.map(p => p.x))), d3.max(users.flatMap(u => u.path.map(p => p.x)))])
    .range([0, width]);
  const yScale = d3.scaleLinear()
    .domain([d3.min(users.flatMap(u => u.path.map(p => p.y))), d3.max(users.flatMap(u => u.path.map(p => p.y)))])
    .range([height, 0]);

  users.forEach(user => {
    let pathData = "M" + user.path.map(p => `${xScale(p.x)},${yScale(p.y)}`).join("L");
    svg.append("path")
      .attr("d", pathData)
      .attr("fill", "none")
      .attr("stroke", user.id === 0 ? "#ff0000" : "#0000ff")
      .attr("stroke-width", 2); 
  });

  const link = svg.append("line")
    .attr("class", "link")
    .style("stroke-width", 2) 
    .style("stroke", "#999");

  function updateLink() {
    const lastPosUser0 = users[0].path[users[0].path.length - 1];
    const lastPosUser1 = users[1].path[users[1].path.length - 1];

    link
      .attr("x1", xScale(lastPosUser0.x))
      .attr("y1", yScale(lastPosUser0.y))
      .attr("x2", xScale(lastPosUser1.x))
      .attr("y2", yScale(lastPosUser1.y));
  }

  updateLink();
  let i = 0;
  function animateLink() {
    if (i < users[0].path.length && i < users[1].path.length) {
      const posUser0 = users[0].path[i];
      const posUser1 = users[1].path[i];

      link
        .transition()
        .duration(10) // Adjust duration for faster animation
        .attr("x1", xScale(posUser0.x))
        .attr("y1", yScale(posUser0.y))
        .attr("x2", xScale(posUser1.x))
        .attr("y2", yScale(posUser1.y))
        .on("end", animateLink); // Loop the animation

      i++;
    }
  }

  animateLink(); 
}



// function setTimes(data) {
//     const globalStartTimes = globalState.jsonDatas.map(data => Math.min(...data.map(entry => new Date(entry.Timestamp).getTime())));
//     const globalEndTimes = globalState.jsonDatas.map(data => Math.max(...data.map(entry => new Date(entry.Timestamp).getTime())));
//     globalState.globalStartTime = Math.min(...globalStartTimes);
//     const globalStartTime = globalState.globalStartTime;
//     const somePadding = 0;
//     globalState.globalEndTime = Math.max(...globalEndTimes) + somePadding - 5000;
//     const globalEndTime = globalState.globalEndTime;
//     const totalTime = globalEndTime - globalStartTime;
//     globalState.intervalDuration = totalTime / globalState.bins;
//     const duration = (globalEndTime - globalStartTime) / 1000 / 60;
//     globalState.intervals = Array.from({
//         length: globalState.bins + 1
//     }, (v, i) => new Date(globalStartTime + i * globalState.intervalDuration));

// }

function setTimes(occulusData) {
  console.log(occulusData);
  const globalStartTimes = occulusData.map(entry => new Date(entry.Timestamp).getTime());
  const globalEndTimes = occulusData.map(entry => new Date(entry.Timestamp).getTime());
  
  globalState.globalStartTime = Math.min(...globalStartTimes);
  const globalStartTime = globalState.globalStartTime;
  const somePadding = 0;
  globalState.globalEndTime = Math.max(...globalEndTimes) + somePadding - 5000;
  // console.log(" this is start time " + new Date(globalState.globalStartTime));
  // console.log(" this is end time " + new Date(globalState.globalEndTime));
  const globalEndTime = globalState.globalEndTime;
  const totalTime = globalEndTime - globalStartTime;
  globalState.intervalDuration = totalTime / globalState.bins;
  const duration = (globalEndTime - globalStartTime) / 1000 / 60;
  globalState.intervals = Array.from({
      length: globalState.bins + 1
  }, (v, i) => new Date(globalStartTime + i * globalState.intervalDuration));
}


function createTimeSlider(data) {
    const globalStartTimes = globalState.jsonDatas.map(data => Math.min(...data.map(entry => new Date(entry.Timestamp).getTime())));
    const globalEndTimes = globalState.jsonDatas.map(data => Math.max(...data.map(entry => new Date(entry.Timestamp).getTime())));
    globalState.globalStartTime = Math.min(...globalStartTimes);
    const globalStartTime = globalState.globalStartTime;
    const somePadding = 0;
    globalState.globalEndTime = Math.max(...globalEndTimes) + somePadding - 5000;

    const globalEndTime = globalState.globalEndTime;
    const totalTime = globalEndTime - globalStartTime;
    globalState.intervalDuration = totalTime / globalState.bins;

    const duration = (globalEndTime - globalStartTime) / 1000 / 60;
    globalState.intervals = Array.from({
        length: globalState.bins + 1
    }, (v, i) => new Date(globalStartTime + i * globalState.intervalDuration));

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
                updateVisualization(timestamp, index);
                updateVisualizationOcculus(timestamp);
            });
            animateTemporalView(timestamp);
            updateTimeDisplay(timestamp, globalStartTime);
        });
    slider.node().value = 0;
    slider.on('input', function() {
        const elapsedMinutes = +this.value;
        globalState.currentTimestamp = elapsedMinutes * 60 * 1000; // Convert minutes back to milliseconds
        const binIndex = Math.floor((globalState.currentTimestamp) / globalState.intervalDuration);
        globalState.startTimeStamp = globalState.globalStartTime + (binIndex * globalState.intervalDuration);
        globalState.endTimeStamp = globalState.startTimeStamp + globalState.intervalDuration;
        if (isAnimating) {
            toggleAnimation();
            updatePlayPauseButton();
        }
        isAnimating = false; // Optionally pause animation
        const timestamp = globalState.globalStartTime + globalState.currentTimestamp;
        globalState.currentTimestamp = timestamp; 
        globalState.jsonDatas.forEach((data, index) => {
            updateVisualization(timestamp, index);
            updateVisualizationOcculus(timestamp);
        });
        updateTimeDisplay(timestamp, globalState.globalStartTime);
        animateTemporalView(timestamp);
    });
}


export function dragged(event, d) {
    const svg = d3.select("#temporal-view");
    const margin = {
        top: 20,
        right: 30,
        bottom: 10,
        left: 40
    };
    const height = parseInt(svg.style("height")) - margin.top - margin.bottom;
    const width = parseInt(svg.style("width")) - margin.right - margin.left;
    const x = getXScale();
    let newXPosition = Math.max(0, Math.min(event.x - margin.left, width));
    let newTimestamp = x.invert(newXPosition);
    d3.select(this).attr('x1', newXPosition + margin.left).attr('x2', newXPosition + margin.left);
    d3.select('#time-indicator-circle')
        .attr('cx', newXPosition + margin.left);
    if (newTimestamp > new Date(globalState.globalEndTime)) {
        newTimestamp = new Date(globalState.globalEndTime);
        newXPosition = x(newTimestamp); 
    }

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
    globalState.jsonDatas.forEach((data, index) => {
        updateVisualization(newTimestamp.getTime(), index);
        updateVisualizationOcculus(newTimestamp.getTime());
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