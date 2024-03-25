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
import {
	loadAndPlotTemporal,
	animateTemporalView,
	getXScale
} from "./temporal.js"

let speechEnabled = false;
let xrInteractionEnabled = false;
let noneEnabled = true;
let numUsers = 2;
let x ; 
let yScale ;
// var bins = 5;
let intervals;
let globalState = {
	currentTimestamp: 0,
	bins: undefined,
  unit : "minutes",
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
	lineTimeStamp1: 0,
	lineTimeStamp2: 0,
  finalData: undefined,
  movementData: undefined, 
  dynamicWidth:0,
  scene: undefined,
  camera:undefined,
  renderer:undefined,
  controls:undefined,
  sprites: [],
};
const userInterestTopic = "Emergency Management";
// const margin = 
const margin = { top: 20, right: 30, bottom: 10, left: 140 };

const hsl = {
	h: 0,
	s: 0,
	l: 0
};
const topicOfInterest = "";
// const colorScale = d3.scaleOrdinal()
// 	.domain([0, 1, 2])
// 	.range(["#1b9e77", "#d95f02", "#7570b3"]);

	const colorScale = d3.scaleOrdinal()
    .domain(["User_1", "User_2", "User_3", "0", "1", "2"]) // Added "User_3" and "2" to the domain
    .range(["#92d050", "#ffc000", "#00b0f0", "#92d050", "#ffc000", "#00b0f0"]); // Added a third color "#00b0f0"

const opacities = [0.2, 0.4, 0.6, 0.8, 1];



let isAnimating = false;
const animationStep = 100;
let roomMesh;
let meshes = [];
let avatars = []
let interactionMeshes = []
let speechMeshes = []



let avatarLoaded = false;
let roomLoaded = false;
let movementPointsMesh;

function fitCameraToObject(camera, object) {
	const boundingBox = new THREE.Box3().setFromObject(object);
	const center = boundingBox.getCenter(new THREE.Vector3());
	const size = boundingBox.getSize(new THREE.Vector3());
	const maxDim = Math.max(size.x, size.y, size.z);
	const fov = globalState.camera.fov * (Math.PI / 180);
	let cameraZ = Math.abs(maxDim / 4 * Math.tan(fov / 2));
	cameraZ *= 0.5;

	camera.position.set(center.x, center.y, center.z + cameraZ);
	camera.position.z = center.z + cameraZ;
	camera.position.y += 10;

	const aspect = window.innerWidth / window.innerHeight;
	globalState.camera.aspect = aspect;
	globalState.camera.lookAt(center);
	globalState.camera.near = cameraZ / 100;
	globalState.camera.far = cameraZ * 100;
	globalState.camera.updateProjectionMatrix();
}




async function loadAvatarModel(filename) {
	const loader = new GLTFLoader();
  // filename = ('3d_human_model/scene.gltf');
	const gltf = await loader.loadAsync(filename);
	const avatar = gltf.scene;
	avatar.scale.set(0.1, 0.1, 0.1);
	avatar.name = filename;
  avatar.visible = true ; 
	globalState.scene.add(avatar);
	avatarLoaded = true;
	return avatar;
}

async function loadRoomModel() {
	const loader = new GLTFLoader();
	try {
		const filename = 'RD_background_dense_color_fix.glb';
		const gltf = await loader.loadAsync(filename);
		roomMesh = gltf.scene;
		roomMesh.name = filename;
		roomMesh.scale.set(1, 1, 1);
		globalState.scene.add(roomMesh);
	} catch (error) {
		console.error('Error loading the room model:', error);
	}
	roomLoaded = true;
}

function changeBinSize(newBinSize) {
  const unit = document.querySelector('input[name="unit"]:checked').value;

  var event = new CustomEvent('binSizeChange', {
      detail: { size: newBinSize, unit: unit }
  });
  // Pass both the new bin size and the unit to updateIntervals
  updateIntervals(newBinSize, unit);
  createPlotTemporal();
  window.dispatchEvent(event);
}

document.getElementById('binsDropdown').addEventListener('change', function() {
  changeBinSize(this.value);
});

document.getElementById('unit-selection-container').addEventListener('change', function() {
  const unit = document.querySelector('input[name="unit"]:checked').value;
  // Get the current bin size from the dropdown
  const currentBinSize = document.getElementById('binsDropdown').value;
  // Trigger bin size change with the current size but updated unit
  changeBinSize(currentBinSize);
  console.log('Unit changed to:', unit);
});

window.addEventListener('binSizeChange', function(e) {
  // Update both bins and unit in globalState based on the event detail
  globalState.bins = e.detail.size;
  globalState.unit = e.detail.unit;
  // Assuming updateIntervals function can accept a second parameter for the unit
  updateIntervals(e.detail.size, e.detail.unit);
  console.log('Bin size changed to:', e.detail.size, 'Unit:', e.detail.unit);
});





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

d3.selectAll('#time-extent-toggle input[type="radio"]').on('change', function() {
  // When a radio button is changed, retrieve the value
  var timeExtent = d3.select(this).attr('value');
  
  // Log the current selection or do something else with it
  // console.log("Time Extent selected:", timeExtent);
  toggleInstanceRange(timeExtent);
});

function toggleInstanceRange(selectedOption){
  console.log("selected option " + selectedOption);
  const line1 = d3.select('#time-indicator-line1');
  const line2 = d3.select('#time-indicator-line2');
  const circle1 = d3.select('#time-indicator-circle1');
  const circle2 = d3.select('#time-indicator-circle2');
  if (selectedOption === 'Instance')
  {

    line2.style('display', 'none');
    circle2.style('display', 'none');
  }
  if (selectedOption === 'Range')
  {
    console.log("here?");
    line2.style('display', null);
    circle2.style('display',null);
  }
}

window.onload = function() {
	document.getElementById('toggle-user0').addEventListener('change', function() {
		globalState.show[0] = this.checked;
	});

	document.getElementById('toggle-user1').addEventListener('change', function() {
		globalState.show[1] = this.checked;
	});

	// document.getElementById('toggle-user2').addEventListener('change', function() {
	//     globalState.show[2] = this.checked;
	// });

	// const objToolbar = document.getElementById('obj-toolbar');
	// const toolbar = document.getElementById('toolbar');
	// const userToolbar = document.getElementById('user-toolbar');
	// const totalHeight = objToolbar.clientHeight + userToolbar.clientHeight + toolbar.clientHeight;
	// objToolbar.style.top = '0';
	// toolbar.style.bottom = '0';
	// userToolbar.style.top = (toolbar.offsetTop - userToolbar.clientHeight) + 'px';
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




// function animateVisualization() {
// 	const jsonDatas = globalState.jsonDatas;
// 	if (!isAnimating || jsonDatas.length === 0) return;

// 	const globalStartTime = globalState.globalStartTime;
// 	const globalEndTime = globalState.globalEndTime;
// 	const totalTime = globalEndTime - globalStartTime;

// 	const nextTimestamp = globalStartTime + globalState.currentTimestamp;
// 	if (globalState.currentTimestamp < totalTime) {
// 		const elapsedTime = globalState.currentTimestamp;
// 		const binIndex = Math.floor(elapsedTime / globalState.intervalDuration);
// 		globalState.startTimeStamp = globalStartTime + (binIndex * globalState.intervalDuration);
// 		globalState.endTimeStamp = globalState.startTimeStamp + globalState.intervalDuration;
// 		jsonDatas.forEach((data, index) => {
// 			// updateVisualization(nextTimestamp, index);
// 			// updateVisualizationOcculus(nextTimestamp);
// 		});

// 		// updateTimeDisplay(nextTimestamp, globalStartTime);
// 		// animateTemporalView(nextTimestamp);
// 		createLines(globalState.lineTimeStamp1, globalState.lineTimeStamp2);
//     // initializeShadedAreaDrag();
//     // console.log("left shading function, enetring toolbar ");
//     generateHierToolBar();

// 		const slider = document.querySelector('#slider-container input[type=range]');
// 		if (slider) {
// 			slider.value = (globalState.currentTimestamp / totalTime) * slider.max;
// 		}

// 		globalState.currentTimestamp += animationStep;
// 		requestAnimationFrame(animateVisualization);
// 	} else {
// 		isAnimating = false;
// 		globalState.currentTimestamp = 0; // Reset for restart
// 		toggleAnimation();
// 	}
// }
function createTextSprite(message, fontSize = 30, fontFace = "Arial", textColor = "black", backgroundColor = "#bfbfbf") {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  context.font = `${fontSize}px ${fontFace}`;
  const metrics = context.measureText(message);
  const textWidth = metrics.width;
  canvas.width = textWidth + 10; // Reduced padding
  canvas.height = fontSize + 10; // Reduced padding

  // Optional: Draw background
  context.fillStyle = backgroundColor;
  context.fillRect(0, 0, canvas.width, canvas.height);

  // Draw text
  context.fillStyle = textColor;
  // Adjust text position based on reduced padding
  context.fillText(message, 5, fontSize / 2 + 5);

  // Create texture from canvas
  const texture = new THREE.CanvasTexture(canvas);
  // texture.minFilter = THREE.LinearFilter; // Consider using LinearFilter for smoother text
  // texture.magFilter = THREE.LinearFilter;

  // Use texture in a sprite
  const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
  const sprite = new THREE.Sprite(spriteMaterial);

  // Calculate aspect ratio of canvas
  const aspectRatio = canvas.width / canvas.height;
  const maxSize = 5; // Adjust this value based on your scene requirements

  // Calculate scale to not exceed maxSize in either dimension
  const spriteWidth = aspectRatio >= 1 ? maxSize : maxSize * aspectRatio;
  const spriteHeight = aspectRatio < 1 ? maxSize : maxSize / aspectRatio;

  // Apply the calculated scale to the sprite
  sprite.scale.set(spriteWidth, spriteHeight, 1.0);

  return sprite;
}

function addTextOverlay(text) {
  const container = document.getElementById('text-overlay');
  const textElement = document.createElement('div');
  textElement.style.padding = '8px';
  textElement.style.margin = '4px';
  textElement.style.background = 'rgba(255, 255, 255, 0.8)';
  textElement.style.background = '#bfbfbf';
  textElement.style.color = 'black';
  textElement.style.maxWidth = '250px'; // Set a maximum width for text wrapping
  textElement.style.wordWrap = 'break-word';
  textElement.textContent = text;
  
  container.appendChild(textElement);
}

function clearTextOverlays() {
  const container = document.getElementById('text-overlay');
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }
}

function updateSceneBasedOnSelections() {
  const data = globalState.finalData.topics_dict; 
  const selectedTopics = getSelectedTopics(); 
  const selectedKeywords = getSelectedKeywords(); 
  const movementData = globalState.movementData.actions;
    // globalState.sprites.forEach(sprite => {
    //   globalState.scene.remove(sprite);
    // });
    // globalState.sprites = []; // Clear the
    clearTextOverlays();
  selectedTopics.forEach(topic => {
    // console.log(topic);
      if (data[topic]) {
          data[topic].actions.forEach(action => {
            if (action.action_type === "RawCapture") { return ; }
              const actionStartTime = parseTimeToMillis(action.start_time);
              const actionEndTime = parseTimeToMillis(action.end_time);
              const isInTimeRange = actionEndTime >= globalState.lineTimeStamp1 && actionStartTime <= globalState.lineTimeStamp2;
              const matchesSelectedKeywords = selectedKeywords.some(keyword => action.data.keywords.includes(keyword));

              if (matchesSelectedKeywords && isInTimeRange) {
                  const actorName = action.actor_name;
                  let closestData = null;
                  let minimumTimeDifference = Infinity;
                  movementData.forEach(data => {
                      if (data.actor_name === actorName) {
                          const movementStartTime = parseTimeToMillis(data.start_time);
                          const timeDifference = Math.abs(actionStartTime - movementStartTime);
                          if (timeDifference < minimumTimeDifference) {
                              closestData = data;
                              minimumTimeDifference = timeDifference;
                          }
                      }
                  });

                  if (closestData) {
                    // console.log(" did ya come here?");
                    addTextOverlay(action.data.raw_text);

                      // const spatial_extent = closestData.spatial_extent; 
                      // const textSprite = createTextSprite(action.data.raw_text);
                      // textSprite.position.set(spatial_extent[0][0], spatial_extent[0][1]+ 1, spatial_extent[0][2]);
                      // globalState.scene.add(textSprite);
                      // globalState.sprites.push(textSprite);

                     
                  }
              }
          });
      }
  });
}

function createAvatarSegment(id){
const userID = "User_" + (id + 1 ) ;
const avatar = globalState.avatars[id];
const linewidth = 7; 
const data = globalState.movementData.actions ; 
  const filteredData = data.filter(action => {
      const actionStartTime = parseTimeToMillis(action.start_time);
      const actionEndTime = parseTimeToMillis(action.end_time);
      // console.log(userID);
      return action.action_type === "Transformation" &&
             action.formatted_data.action_property_specific_action === "XRCamera Transformation" &&
       action.actor_name == userID && 
             actionEndTime >= globalState.lineTimeStamp1 && actionStartTime <= globalState.lineTimeStamp2;
  });

if (filteredData.length !== 0) {
  // console.log("setting to true x");
  // globalState.scene.add(avatar);
  // console.log(avatar.visible);
  // avatar.visible = true ; 
  filteredData.forEach(entry => {
    const spatialExent = entry.spatial_extent;

    const x = spatialExent[0][0];
    const y = spatialExent[0][1];
    const z = spatialExent[0][2];
    avatar.position.x = x ; 
    avatar.position.z = z ; 
    const euler = new THREE.Euler(0, THREE.MathUtils.degToRad(spatialExent[1][1]), THREE.MathUtils.degToRad(spatialExent[1][2]), 'XYZ');

    avatar.rotation.set(0, 0, 0);
    avatar.setRotationFromEuler(euler);
  });
  }
  // avatar.visible = false ; 
  // globalState.scene.remove(avatar);
  // console.log("setting to false ");
}



async function initializeScene() {
  globalState.scene = new THREE.Scene();
  globalState.scene.background = new THREE.Color(0xffffff);
  const spatialView = document.getElementById('spatial-view');
  globalState.camera = new THREE.PerspectiveCamera(60, spatialView.innerWidth / spatialView.innerHeight, 0.1, 1000);
  // globalState.camera.position.set(0, 10, 10);
	globalState.camera.position.set(0, 2, 5);

  globalState.camera.updateProjectionMatrix();
  
  globalState.renderer = new THREE.WebGLRenderer({
    antialias: true
  });
  
  globalState.renderer.setSize(spatialView.width, spatialView.height);
  document.getElementById('spatial-view').appendChild(globalState.renderer.domElement);
  
  
  globalState.controls = new OrbitControls(globalState.camera, globalState.renderer.domElement);
  globalState.controls.enableZoom = true;
  
  globalState.renderer.domElement.addEventListener('mouseenter', function() {
    globalState.controls.enableZoom = true;
  });
  
  globalState.renderer.domElement.addEventListener('mouseleave', function() {
    globalState.controls.enableZoom = false;
  });
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  globalState.scene.add(ambientLight);
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(0, 1, 0);
  globalState.scene.add(directionalLight);
  
  globalState.controls.update();

  const gridHelper = new THREE.GridHelper(10, 10);
  gridHelper.position.y = -1;
  globalState.scene.add(gridHelper);

	await Promise.all([loadRoomModel()]); // new glb has to be created for the reality deck
  
  const jsonFiles = await Promise.all([
    fetch('file1Transformed_emptySpeech.json').then(response => response.json()),
    fetch('file1.json').then(response => response.json()),
    // fetch('file1TransformedUser3.json').then(response => response.json()),
]);

jsonFiles.forEach((jsonData, index) => {
  const sortedData = jsonData.sort((a, b) => new Date(a.Timestamp) - new Date(b.Timestamp));
  globalState.jsonDatas[index] = sortedData;
});

	const avatarArray = await Promise.all([
    loadAvatarModel('3d_human_model/scene_1.gltf'),
    loadAvatarModel('3d_human_model/scene_2.gltf'), 
    loadAvatarModel('3d_human_model/scene_2.gltf'), 

    // loadAvatarModel('RD_background_dense.glb')
	]);
  const finalData = await Promise.all([

		fetch('new_topic_oriented_analysis_full_data_with_user_transform.json').then(response => response.json()),
		// fetch('topic_oriented_analysis_full_data.json').then(response => response.json()),
  ]);
  globalState.finalData = finalData[0];
  // console.log(globalState.finalData.topics_dict["User Transformation"]);
  globalState.movementData = globalState.finalData.topics_dict["User Transformation"]; 
  delete globalState.finalData.topics_dict["User Transformation"];
	globalState.avatars = [avatarArray[0], avatarArray[1], avatarArray[2]];


	setTimes(globalState.finalData);
  // setTimes(globalState.jsonDatas);

	// fitCameraToObject(globalState.camera, globalState.scene, 1.2, globalState.controls);

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

	// const {
	// 	users,
	// 	links
	// } = processMovementData();
	// plotTwoNetworkChart(users, links);
}


// initializeScene(); // zainab 

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
	// const occulusMeshes = createFullLineOcculus(intervalData, 0);
	// occulusMeshes.forEach(datasetLines => {
	//     datasetLines.forEach(line => {
	//         scene.add(line);
	//     });
	// });
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

function updateVisualizationOcculus(currTimeStamp) {
	const validData = occulusData.occulusFile.filter(entry => entry.TrackingType === 'PhysicalXRDisplay' &&
		entry.DataType === 'Transformation');
	// console.log(validData);
	const closestData = findClosestDataEntry(validData, currTimeStamp);
	if (closestData !== null) {
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
	const validRightControllerData = occulusData.occulusFile.filter(entry => entry.TrackingType === 'PhysicalXRController_R' &&
		entry.DataType === 'Transformation' && typeof entry.Data === 'string');
	const validLeftControllerData = occulusData.occulusFile.filter(entry => entry.TrackingType === 'PhysicalXRController_L' &&
		entry.DataType === 'Transformation' && typeof entry.Data === 'string');
	// console.log(validRightControllerData);
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
		if (side === 'left') {
			occulusData.occulusLeftController.position.x = x * scaleFactor + offsetX;
			occulusData.occulusLeftController.position.y = y * scaleFactor + offsetY;
			occulusData.occulusLeftController.position.z = z * scaleFactor + offsetZ;
			occulusData.occulusLeftController.rotation.set(0, 0, 0);
			const euler = new THREE.Euler(THREE.MathUtils.degToRad(pitch), THREE.MathUtils.degToRad(yaw), THREE.MathUtils.degToRad(roll), 'XYZ');
			occulusData.occulusLeftController.setRotationFromEuler(euler);
		} else if (side === 'right') {
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
  createSharedAxis();
  createLines(globalState.lineTimeStamp1, globalState.lineTimeStamp2);
  generateHierToolBar();
  plotTreeMap();
  createPlotTemporal();
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
		users.push({
			id: i,
			path: []
		});
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
						users[userId].path.push({
							x: x,
							y: y,
							z: z
						});
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

	return {
		users,
		links
	};
}



function createPlotTemporal() {
  // Assuming globalState.finalData is set and contains the topics_dict property
  const topicsData = Object.entries(globalState.finalData.topics_dict).flatMap(([topicName, topicDetails]) => {
    return topicDetails.actions.map(action => ({
      topic: topicName,
      startTime: parseTimeToMillis(action.start_time),
      endTime: parseTimeToMillis(action.end_time),
      rawStartTime : action.start_time,
      rawEndTime: action.end_time,
      isUserInterest: topicDetails.is_user_interest,
      hasUserInterestKeyword: action.has_user_interest_keyword
    })).filter(action => action.startTime && action.endTime); // Ensuring we have valid times
  });

  const temporalViewContainer = d3.select("#temporal-view");
  const spatialViewWidth = document.getElementById('spatial-view').clientWidth;
	const temporalViewHeight = document.getElementById('temporal-view').clientHeight;

  const width = document.getElementById('spatial-view').clientWidth - margin.left - margin.right;
  // const width = document.getElementById('spatial-view').clientWidth - 1000; 
  const height = temporalViewHeight - margin.top - margin.bottom;
  const svgWidth = globalState.dynamicWidth + margin.left + margin.right ; 
  const speechPlotSvg = d3.select("#speech-plot-container");
  speechPlotSvg.html("");
  const svg = speechPlotSvg.append('svg')
  .attr('id', 'plot-svg')
  .attr("width", svgWidth) 
  // .attr("width", width + margin.left + margin.right)
  .attr("height", margin.top + margin.bottom + temporalViewHeight)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

    svg.append("text")
    .attr("y", -10) 
    .attr("x", -30) 
    .style("text-anchor", "middle") 
    .style("font-weight", "bold")
    .text("Topics"); 
  // Y scale for topics
   yScale = d3.scaleBand()
    .rangeRound([0, height])
    .padding(0.1)
    .domain(topicsData.map(d => d.topic));

    svg.append("g")
	  .attr("class", "axis axis--y")
	  .call(d3.axisLeft(yScale))
	  .selectAll(".tick text")
	  .text(d => {
		  // Prepend a star symbol for topics of user interest
		  const topic = topicsData.find(topic => topic.topic === d);
		  return topic && topic.isUserInterest ? `★ ${d}` : d;
	  })
	  .style("fill", d => {
		  const topic = topicsData.find(topic => topic.topic === d);
		  return topic && topic.isUserInterest ? "#7e4695" : "#000"; // Purple for user interest
	  })
    .style("cursor", "pointer") 
    .on("click", function(event, d) {
      // console.log("helloooo?");
      showContextMenu(event, d);
    });

  // svg.append("g")
  //   .attr("class", "axis axis--y")
  //   .call(d3.axisLeft(yScale))
  //   .selectAll(".tick text") 
  //   // .raise() 
    // .style("cursor", "pointer") 
    // .on("click", function(event, d) {
    //   // console.log("helloooo?");
    //   showContextMenu(event, d);
    // })
  //   .style("fill", function(d) { 
  //     const isUserInterest = topicsData.find(topic => topic.topic === d && topic.isUserInterest);
  //     return isUserInterest ? "#7e4695" : "#000"; 
  //   });

    svg.select(".axis--y").selectAll(".tick text")
    .style("cursor", "pointer") 
    .style("pointer-events", "all")
    .on("click", function(event, d) {
      showContextMenu(event, d);
    });

    svg.selectAll(".background-line")
    .data(yScale.domain())
    .enter().append("rect")
    .attr("class", "background-line")
    .attr("x", 0)
    .attr("y", d => yScale(d))
    .attr("width", globalState.dynamicWidth)
    .attr("height", yScale.bandwidth())
    .attr("fill", "#e8e8e8"); // Light grey color

  svg.selectAll(".bar")
  .data(topicsData)
  .enter().append("rect")
  .attr("class", "bar")
  .attr("x", d => Math.min(x(d.startTime), x(d.endTime)))
  .attr("y", d => yScale(d.topic))
  .attr("width", d => {
    let width = x(d.endTime) - x(d.startTime);
    return width;
  })
  .attr("height", yScale.bandwidth())
  .attr("fill", d => d.hasUserInterestKeyword ? "#7e4695" : "#d0d0d0");
  // .attr("fill", "#d0d0d0");
}


function showContextMenu(event, topicName) {
  let contextMenu = d3.select("#context-menu");
  if (contextMenu.empty()) {
    contextMenu = d3.select("body").append("div")
      .attr("id", "context-menu")
      .style("position", "absolute")
      .style("z-index", "10")
      .style("visibility", "hidden")
      .style("padding", "10px")
      .style("background", "white")
      .style("border", "1px solid #ccc")
      .style("border-radius", "4px")
      .style("box-shadow", "0 4px 8px rgba(0,0,0,0.1)");
  }
  contextMenu.html("");

  // Add Normal View and Split View options
  contextMenu.append("div").text("Normal View")
    .style("padding", "5px")
    .style("cursor", "pointer")
    .on("click", function() {
      // Handle Normal View click
      console.log("Normal View clicked for", topicName);
      d3.select("#plot-svg").selectAll("*").remove();
      createPlotTemporal();
      contextMenu.style("visibility", "hidden");

    });

  contextMenu.append("div").text("Split View")
    .style("padding", "5px")
    .style("cursor", "pointer")
    .on("click", function() {
      console.log("Split View clicked for", topicName);
      // d3.select("#plot-svg").selectAll("*").remove();
      createSplitBars(topicName);
      contextMenu.style("visibility", "hidden"); // Hide context menu
    });

  // Position the menu at the mouse position
  contextMenu.style("left", (event.pageX + 10) + "px")
    .style("top", (event.pageY + 10) + "px")
    .style("visibility", "visible");
}

function createSplitBars(topicName) {
  // Assuming you have a way to get user-specific actions, possibly from globalState or directly
  const topicDetails = globalState.finalData.topics_dict[topicName];
  const userActions = topicDetails.actions;
  const users = [...new Set(userActions.map(a => a.actor_name))];
  const svg = d3.select("#plot-svg > g");

  // We need to adjust the original y scale to insert new bars. Let's calculate new domain.
  const allTopics = Object.keys(globalState.finalData.topics_dict);
  let newDomain = [];
  allTopics.forEach(topic => {
      if (topic === topicName) {
          newDomain.push(topic); // Add the original topic
          users.forEach(user => newDomain.push(`${topic}-${user}`)); // Add a new entry for each user
      } else {
          newDomain.push(topic);
      }
  });

  // Recalculate the y positions based on the new domain
  yScale.domain(newDomain).padding(0.1);
  const newYHeight = yScale.bandwidth();

  // Redraw the y-axis
  svg.select(".axis--y").call(d3.axisLeft(yScale));
  const backgroundLines = svg.selectAll(".background-line").data(newDomain);
  backgroundLines.enter().append("rect")
  .attr("class", "background-line")
  .attr("x", 0)
  .attr("y", d => yScale(d))
  .attr("width", globalState.dynamicWidth)
  .attr("height", yScale.bandwidth())
  .attr("fill", "#e8e8e8");

  backgroundLines.exit().remove();

  svg.selectAll(".bar").transition().duration(500)
      .attr("y", d => yScale(d.topic))
      .attr("height", newYHeight);

      svg.selectAll(".background-line").transition().duration(500)
      .attr("y", (d) => yScale(d))
      .attr("height", newYHeight);

  // Add new bars for each user action under the selected topic
  users.forEach((user, index) => {
      userActions.filter(a => a.actor_name === user).forEach(action => {
          svg.append("rect")
              .attr("class", "detail-bar")
              .attr("x", x(parseTimeToMillis(action.start_time)))
              .attr("y", yScale(`${topicName}-${user}`))
              .attr("width", d => x(parseTimeToMillis(action.end_time)) - x(parseTimeToMillis(action.start_time)))
              .attr("height", newYHeight)
              .attr("fill", d => action.has_user_interest_keyword ? "#7e4695" : "#d0d0d0"); 
      });
  });

}


// function plotBarChart() {
// 	const plotBox1 = d3.select("#plot-box1").html("");
// 	const margin = {
// 		top: 20,
// 		right: 50,
// 		bottom: 100,
// 		left: 40
// 	};
// 	const width = plotBox1.node().getBoundingClientRect().width - margin.left - margin.right;
// 	const height = plotBox1.node().getBoundingClientRect().height - margin.top - margin.bottom;

// 	const svg = plotBox1.append("svg")
// 		.attr("width", width + margin.left + margin.right)
// 		.attr("height", height + margin.top + margin.bottom)
// 		.append("g")
// 		.attr("transform", "translate(" + margin.left + "," + margin.top + ")");
//   //   let processedData = Object.keys(globalState.finalData.topics_dict).map(topicKey => {
//   //     let topic = globalState.finalData.topics_dict[topicKey];
//   //     let count = topic.actions.filter(action => action.action_type === "VerbalInteraction").length;
//   //     return { topic: topicKey, count: count };
//   // }) .filter(item => item.count !== 0);


//   let processedData = Object.keys(globalState.finalData.topics_dict)
//   .map(topicKey => {
//       let topic = globalState.finalData.topics_dict[topicKey];
//       let verbalInteractions = topic.actions.filter(action => action.action_type === "VerbalInteraction");
//       let count = verbalInteractions.length;
//       // Check if any action has the user interest keyword flag set to true
//       let hasUserInterestKeyword = verbalInteractions.some(action => action.has_user_interest_keyword);
//       return {
//         topic: topicKey,
//         count: count,
//         hasUserInterestKeyword: hasUserInterestKeyword
//       };
//   })
//   .filter(item => item.count !== 0); 
//   const x = d3.scaleBand()
//   .range([0, width])
//   .padding(0.1)
//   .domain(processedData.map(d => d.topic));

// const y = d3.scaleLinear()
//   .domain([0, d3.max(processedData, d => d.count)])
//   .range([height, 0]);

// svg.selectAll(".bar")
//   .data(processedData)
// .enter().append("rect")
//   .attr("class", "bar")
//   .attr("x", d => x(d.topic))
//   .attr("width", x.bandwidth())
//   .attr("y", d => y(d.count))
//   .attr("height", d => height - y(d.count))
//   .attr("fill", d => d.hasUserInterestKeyword ? "#7e4695" : "#d0d0d0");
//   // .fill()

// svg.append("g")
//   .attr("transform", `translate(0,${height})`)
//   .call(d3.axisBottom(x))
//   .selectAll("text")
//     .style("text-anchor", "end")
//     .attr("dx", "-.8em")
//     .attr("dy", ".15em")
//     .attr("transform", "rotate(-65)");

// svg.append("g")
//   .call(d3.axisLeft(y));

// }

function plotBarChart() {
  const plotBox1 = d3.select("#plot-box1").html("");
  const margin = { top: 20, right: 20, bottom: 50, left: 40 };
  const width = plotBox1.node().getBoundingClientRect().width - margin.left - margin.right;
  const height = plotBox1.node().getBoundingClientRect().height - margin.top - margin.bottom;

  const svg = plotBox1.append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  // Process data to find all users and their counts per topic
  // Example data structure: globalState.finalData.topics_dict
  // This logic will vary based on your actual data structure
  let userDataByTopic = {}; // { topicName: { userName: count, userName2: count }, ... }
  let allUsers = new Set();
  
  Object.entries(globalState.finalData.topics_dict).forEach(([topic, details]) => {
    const userCounts = details.actions.reduce((acc, action) => {
        if (action.action_type === "VerbalInteraction") {
            acc[action.actor_name] = (acc[action.actor_name] || 0) + 1;
            allUsers.add(action.actor_name);
        }
        return acc;
    }, {});

    // Check if all counts for this topic are 0
    const allCountsAreZero = Object.values(userCounts).every(count => count === 0);

    if (!allCountsAreZero) {
        // Only add the topic if not all counts are zero
        userDataByTopic[topic] = userCounts;
    }
});


  const users = Array.from(allUsers);
  const processedData = Object.entries(userDataByTopic).map(([topic, counts]) => ({
      topic,
      ...counts
  }));

  // Setup scales
  const x0 = d3.scaleBand()
      .rangeRound([0, width])
      .paddingInner(0.1)
      .domain(processedData.map(d => d.topic));

      // console.log(processedData);

  const x1 = d3.scaleBand()
      .padding(0.05)
      .domain(users)
      .rangeRound([0, x0.bandwidth()]);

  const y = d3.scaleLinear()
      .domain([0, d3.max(processedData, d => Math.max(...users.map(user => d[user] || 0)))])
      .range([height, 0]);

  // Color scale for users
  const color = d3.scaleOrdinal(d3.schemeCategory10).domain(users);

  // Create the grouped bars
  const topic = svg.selectAll(".topic")
      .data(processedData)
      .enter().append("g")
      .attr("class", "g")
      .attr("transform", d => `translate(${x0(d.topic)},0)`);

  topic.selectAll("rect")
      .data(d => users.map(key => ({ key, value: d[key] || 0 })))
      .enter().append("rect")
      .attr("width", x1.bandwidth())
      .attr("x", d => x1(d.key))
      .attr("y", d => y(d.value))
      .attr("height", d => height - y(d.value))
      .attr("fill", d => color(d.key));

  // Add the axes
  svg.append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x0))
      .selectAll("text")
    .style("text-anchor", "end")
    .attr("dx", "-.8em")
    .attr("dy", ".15em")
    .attr("transform", "rotate(-65)");

  svg.append("g")
      .attr("class", "axis")
      .call(d3.axisLeft(y));

  // Legend
  const legend = svg.selectAll(".legend")
      .data(users)
      .enter().append("g")
      .attr("class", "legend")
      .attr("transform", (d, i) => "translate(0," + i * 20 + ")");

  legend.append("rect")
      .attr("x", width - 18)
      .attr("width", 18)
      .attr("height", 18)
      .style("fill", color);

  legend.append("text")
      .attr("x", width - 24)
      .attr("y", 9)
      .attr("dy", ".35em")
      .style("text-anchor", "end")
      .text(d => d);
}

function plotUserSpecificBarChart() {
  const plotBox = d3.select("#plot-box1").html("");
  const margin = { top: 60, right: 20, bottom: 180, left: 40 };
  const width = plotBox.node().getBoundingClientRect().width - margin.left - margin.right;
  const height = 500 - margin.top - margin.bottom; 

  const svg = plotBox.append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  // Assuming globalState.finalData.action_dict exists and is structured appropriately
  let allUsers = new Set();
  let userDataByAction = {};

  Object.entries(globalState.finalData.action_dict)
  .filter(([actionName, _]) => actionName !== "User Transformation" && actionName !== "Verbal Communication" && actionName !== "Raw Capture") 
  .forEach(([actionName, actionDetails]) => {
      const userCounts = actionDetails.actions.reduce((acc, action) => {
          acc[action.actor_name] = (acc[action.actor_name] || 0) + 1;
          allUsers.add(action.actor_name);
          return acc;
      }, {});

      userDataByAction[actionName] = userCounts;
  });

  const users = Array.from(allUsers);
  const processedData = Object.entries(userDataByAction).map(([actionName, counts]) => ({
      actionName,
      ...counts
  }));

  // Setup scales
  const x0 = d3.scaleBand()
      .rangeRound([0, width])
      .paddingInner(0.1)
      .domain(processedData.map(d => d.actionName));

  const x1 = d3.scaleBand()
      .padding(0.05)
      .domain(users)
      .rangeRound([0, x0.bandwidth()]);

  const y = d3.scaleLinear()
      .domain([0, d3.max(processedData, d => Math.max(...users.map(user => d[user] || 0)))])
      .range([height, 0]);

  const color = d3.scaleOrdinal(d3.schemeCategory10).domain(users);

  // Create the grouped bars
  const action = svg.selectAll(".action")
      .data(processedData)
      .enter().append("g")
      .attr("class", "g")
      .attr("transform", d => `translate(${x0(d.actionName)},0)`);

  action.selectAll("rect")
      .data(d => users.map(key => ({ key, value: d[key] || 0 })))
      .enter().append("rect")
      .attr("width", x1.bandwidth())
      .attr("x", d => x1(d.key))
      .attr("y", d => y(d.value))
      .attr("height", d => height - y(d.value))
      .attr("fill", d => color(d.key));

  // Add the axes
  svg.append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x0))
      .selectAll("text")
      .style("text-anchor", "end")
      .attr("dx", "-.8em")
      .attr("dy", ".15em")
      .attr("transform", "rotate(-65)");

  svg.append("g")
      .call(d3.axisLeft(y));

  // Legend
  const legend = svg.selectAll(".legend")
      .data(users)
      .enter().append("g")
      .attr("class", "legend")
      .attr("transform", (d, i) => "translate(0," + i * 20 + ")");

  legend.append("rect")
      .attr("x", width - 18)
      .attr("width", 18)
      .attr("height", 18)
      .style("fill", color);

  legend.append("text")
      .attr("x", width - 24)
      .attr("y", 9)
      .attr("dy", ".35em")
        .style("text-anchor", "end")
        .text(d => d);
}



function plotSpiderChart(userName) {
  const plotBox1 = d3.select("#plot-box2").html("");
  const margin = { top: 20, right: 80, bottom: 20, left: 80 };
  const width = plotBox1.node().getBoundingClientRect().width - margin.left - margin.right;
  const height = plotBox1.node().getBoundingClientRect().height - margin.top - margin.bottom;
  let processedData = Object.keys(globalState.finalData.topics_dict)
    .map(topicKey => {
        let topic = globalState.finalData.topics_dict[topicKey];
        let verbalInteractions = topic.actions.filter(action => action.action_type === "VerbalInteraction" && action.actor_name === userName);
        
        // let verbalInteractions = topic.actions.filter(action => action.action_type === "VerbalInteraction");
        let count = verbalInteractions.length;
        let hasUserInterestKeyword = verbalInteractions.some(action => action.has_user_interest_keyword);
        return {
          topic: topicKey,
          count: count,
          hasUserInterestKeyword: hasUserInterestKeyword
        };
    }).filter(item => item.count !== 0 && item.topic !== "Others" ); 
  
  
  const svg = plotBox1.append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${(width / 2) + margin.left}, ${(height / 2) + margin.top})`);

  const radius = Math.min(width / 2, height / 2);
  const angleSlice = Math.PI * 2 / processedData.length;
  const levels = 5; // Number of circular grids

  // Radar chart scale
  const rScale = d3.scaleLinear()
      .range([0, radius])
      .domain([0, d3.max(processedData, d => d.count)]);

  // Circular Grids
  const gridCircles = svg.selectAll(".gridCircle")
      .data(d3.range(1, levels + 1))
      .enter().append("circle")
      .attr("class", "gridCircle")
      .attr("r", d => radius / levels * d)
      .style("fill", "#CDCDCD")
      .style("stroke", "#CDCDCD")
      .style("fill-opacity", 0.1)
      .style("filter", "url(#glow)");

  // Radial Lines
  const radialLines = svg.selectAll(".radialLine")
      .data(processedData)
      .enter().append("line")
      .attr("class", "radialLine")
      .attr("x1", 0)
      .attr("y1", 0)
      .attr("x2", (d, i) => rScale(d3.max(processedData, d => d.count)) * Math.cos(angleSlice * i - Math.PI / 2))
      .attr("y2", (d, i) => rScale(d3.max(processedData, d => d.count)) * Math.sin(angleSlice * i - Math.PI / 2))
      .style("stroke", "white")
      .style("stroke-width", "2px");

  // Radar line generator
  const radarLine = d3.lineRadial()
      .curve(d3.curveLinearClosed)
      .radius(d => rScale(d.count))
      .angle((d, i) => i * angleSlice);

  // Drawing radar chart area
  svg.append("path")
      .datum(processedData)
      .attr("d", radarLine)
      .style("fill", "steelblue")
      .style("fill-opacity", 0.1);

  // Drawing radar chart outlines
  svg.append("path")
      .datum(processedData)
      .attr("d", radarLine)
      .style("stroke", "steelblue")
      .style("stroke-width", 2)
      .style("fill", "none");

  // Drawing circles for data points
  svg.selectAll(".radarCircle")
      .data(processedData)
      .enter().append("circle")
      .attr("class", "radarCircle")
      .attr("r", 4)
      .attr("cx", (d, i) => rScale(d.count) * Math.cos(angleSlice * i - Math.PI / 2))
      .attr("cy", (d, i) => rScale(d.count)  * Math.sin(angleSlice * i - Math.PI / 2))
      .style("fill", "steelblue")
      .style("fill-opacity", 0.8);

  // Drawing text labels for each topic
  svg.selectAll(".radarLabel")
      .data(processedData)
      .enter().append("text")
      .attr("class", "radarLabel")
      .attr("x", (d, i) => (rScale(d3.max(processedData, d => d.count)) + 10) * Math.cos(angleSlice * i - Math.PI / 2))
      .attr("y", (d, i) => (rScale(d3.max(processedData, d => d.count)) + 10) * Math.sin(angleSlice * i - Math.PI / 2))
      .text(d => d.topic)
  // .attr("fill", d => d.hasUserInterestKeyword ? "#7e4695")
      // .attr("fill", )
      .style("text-anchor", "middle")
      .style("font-size", "12px");

  svg.append("circle")
      .attr("class", "radarCenterCircle")
      .attr("r", 4)
      .attr("cx", 0)
      .attr("cy", 0)
      .style("fill", "none")
      .style("stroke", "steelblue")
      .style("stroke-width", 2);
}


function plotCombinedUsersSpiderChart() {
  // Setup SVG and dimensions
  const plotBox = d3.select("#plot-box2").html("");
  const margin = { top: 50, right: 100, bottom: 50, left: 100 };
  const width = plotBox.node().getBoundingClientRect().width - margin.left - margin.right;

	const height = plotBox.node().getBoundingClientRect().height - margin.top - margin.bottom;
  // const height = 600 - margin.top - margin.bottom;
  const svg = plotBox.append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${width / 2 + margin.left}, ${height / 2 + margin.top})`);

  // Calculate the maximum value across all topics and users
  let maxCount = 0;

  Object.values(globalState.finalData.topics_dict).forEach(topic => {
    let topicCounts = new Map();
    // || action.action_type === "XRInteraction"
    topic.actions.forEach(action => {
      if (action.action_type === "VerbalInteraction" ) {
        topicCounts.set(action.actor_name, (topicCounts.get(action.actor_name) || 0) + 1);
      }
    });
    let topicMax = Math.max(...topicCounts.values(), 0); 
    maxCount = Math.max(maxCount, topicMax); 
  });
  let topicsWithCounts = Object.keys(globalState.finalData.topics_dict)
  .filter(topicKey => topicKey !== "Others") // Exclude "Others"
  .map(topicKey => {
    const topic = globalState.finalData.topics_dict[topicKey];
    const count = topic.actions.filter(action => action.action_type === "VerbalInteraction").length;
    return { topic: topicKey, count };
  })
  .filter(topic => topic.count > 0); // Only include topics with count > 0


const rScale = d3.scaleLinear()
    .range([0, Math.min(width / 2, height / 2)])
    .domain([0, maxCount]);

  // Draw circular grids
  const levels = 5 ; 
  for (let i = 0; i <= levels; i++) {
    svg.append("circle")
      .attr("cx", 0)
      .attr("cy", 0)
      .attr("r", rScale(maxCount) / levels * i)
      .style("fill", "none")
      .style("stroke", "lightgrey")
      .style("stroke-dasharray", "2,2");
  }
  // const topics = Object.keys(globalState.finalData.topics_dict).filter(topic => topic !== "Others");
  const angleSlice = Math.PI * 2 / topicsWithCounts.length;

  // Draw radial lines and labels
  topicsWithCounts.forEach((topic, index) => {
    const angle = angleSlice * index;
    svg.append("line")
      .attr("x1", 0)
      .attr("y1", 0)
      .attr("x2", rScale(maxCount) * Math.cos(angle - Math.PI/2))
      .attr("y2", rScale(maxCount) * Math.sin(angle - Math.PI/2))
      .style("stroke", "lightgrey");

    svg.append("text")
      .attr("x", rScale(maxCount * 1.1) * Math.cos(angle - Math.PI/2))
      .attr("y", rScale(maxCount * 1.1) * Math.sin(angle - Math.PI/2))
      .text(topic.topic)
      .style("text-anchor", "middle")
      .attr("alignment-baseline", "middle");
  });

  const color = d3.scaleOrdinal(d3.schemeCategory10);
  const users = [...new Set(Object.values(globalState.finalData.topics_dict).flatMap(topic => 
    topic.actions.filter(action => action.action_type === "VerbalInteraction" ).map(action => action.actor_name)))];

  users.forEach((user, userIndex) => {
    let userData = topicsWithCounts.map(topicKey => {
      // console.log(topicKey);
      const topic = globalState.finalData.topics_dict[topicKey.topic];
      const count = topic.actions.filter(action => action.action_type === "VerbalInteraction" && action.actor_name === user).length;
      return {topic: topicKey, count};
    });
    console.log(userData);

    // Define the radar line generator
    const radarLine = d3.lineRadial()
      .curve(d3.curveLinearClosed)
      .radius(d => rScale(d.count))
      .angle((d, i) => i * angleSlice);

    // Draw the radar chart area for the user
    svg.append("path")
      .datum(userData)
      .attr("d", radarLine)
      .style("fill", color(userIndex))
      .style("fill-opacity", 0.1)
      .style("stroke", color(userIndex))
      .style("stroke-width", 2);
  });
}

function plotTreeMap() {
	const plotBox = d3.select("#plot-box3").html("");
	const margin = { top: 10, right: 10, bottom: 10, left: 10 };
	const width = plotBox.node().getBoundingClientRect().width - margin.left - margin.right;

	const height = plotBox.node().getBoundingClientRect().height - margin.top - margin.bottom;


    let keywordCounts = {};
    Object.values(globalState.finalData.topics_dict).flatMap(topic => topic.actions).forEach(action => {
        const actionStartTime = parseTimeToMillis(action.start_time);
        const actionEndTime = parseTimeToMillis(action.end_time);
        if (actionEndTime >= globalState.lineTimeStamp1 && actionStartTime <= globalState.lineTimeStamp2 && action.action_type === "VerbalInteraction") {
            action.data.keywords.forEach(keyword => {
                keywordCounts[keyword] = (keywordCounts[keyword] || 0) + 1;
            });
        }
    });
    // Convert keywordCounts to a hierarchical structure for D3 treemap
    const hierarchicalData = {
        name: "root",
        children: Object.entries(keywordCounts).map(([keyword, count]) => ({
            name: keyword,
            value: count
        }))
    };
    // console.log(hierarchicalData);

    // const color = d3.scaleOrdinal(d3.schemeCategory10);
    // const customColors = ['#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231', '#911eb4', '#46f0f0', '#f032e6', '#bcf60c', '#fabebe'];
const color = d3.scaleOrdinal(customColors);

    // Select the body for SVG append, set dimensions, and create hierarchical data
    const svg = plotBox.append('svg')
        .attr('width', width)
        .attr('height', height)
        .style('font', '10px sans-serif');

    const root = d3.hierarchy(hierarchicalData)
        .sum(d => d.value) // Here we set the value for each leaf
        .sort((a, b) => b.value - a.value); // Sort the nodes

    d3.treemap()
        .size([width, height])
        .padding(1)
        (root);

    // Drawing the rectangles for each node
    const leaf = svg.selectAll('g')
        .data(root.leaves())
        .enter().append('g')
        .attr('transform', d => `translate(${d.x0},${d.y0})`);

    leaf.append('rect')
        .attr('id', d => (d.leafUid = `leaf-${d.data.name}`))
        .attr('fill', d => color(d.data.name))
        .attr('width', d => d.x1 - d.x0)
        .attr('height', d => d.y1 - d.y0);

    // Adding text labels to each rectangle
    leaf.append('text')
        .selectAll('tspan')
        .data(d => d.data.name.split(/(?=[A-Z][a-z])|\s+/g)) // Split camelCase and by space
        .enter().append('tspan')
        .attr('x', 5) // Positioning text inside rectangle
        .attr('y', (d, i) => 15 + i * 10) // Positioning text inside rectangle
        .text(d => d);

    // Optionally, add title for tooltip effect
    leaf.append('title')
        .text(d => `${d.data.name}\nCount: ${d.value}`);  
}







let lastSpatialExtentMesh = null;
function plotSpatialExtent() {
  const { lineTimeStamp1, lineTimeStamp2, finalData, scene } = globalState;
  const startTime = lineTimeStamp1;
  const endTime = lineTimeStamp2;

  // Remove the previous visualization if it exists
  if (lastSpatialExtentMesh) {
      scene.remove(lastSpatialExtentMesh);
      lastSpatialExtentMesh.geometry.dispose();
      lastSpatialExtentMesh.material.dispose();
      lastSpatialExtentMesh = null;
  }

  // Initialize variables to store the merged extents
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  // Loop through each topic in finalData.topics_dict
  Object.entries(finalData.topics_dict).forEach(([topicName, topicDetails]) => {
      topicDetails.actions.forEach(action => {
          const actionStartTime = parseTimeToMillis(action.start_time);
          const actionEndTime = parseTimeToMillis(action.end_time);

          if (actionStartTime >= startTime && actionEndTime <= endTime && action.spatial_extent) {
              action.spatial_extent.forEach(point => {
                  minX = Math.min(minX, point[0]);
                  minY = Math.min(minY, point[1]);
                  minZ = Math.min(minZ, point[2]);
                  maxX = Math.max(maxX, point[0]);
                  maxY = Math.max(maxY, point[1]);
                  maxZ = Math.max(maxZ, point[2]);
              });
          }
      });
  });

  // Calculate the radius as half the distance between the furthest points
  const radius = Math.sqrt(Math.pow(maxX - minX, 2) + Math.pow(maxY - minY, 2) + Math.pow(maxZ - minZ, 2)) / 2;
  const midPoint = new THREE.Vector3(
      (minX + maxX) / 2,
      (minY + maxY) / 2,
      (minZ + maxZ) / 2
  );

  // Check if we have a valid merged extent to visualize
  if (minX < Infinity && maxX > -Infinity) {
      // Create a sphere to represent the merged extent
      const geometry = new THREE.SphereGeometry(radius, 32, 32);
      const material = new THREE.MeshBasicMaterial({ color: 0xd1d1d1, transparent: true, opacity: 0.5 }); // Grey sphere with slight transparency
      const sphere = new THREE.Mesh(geometry, material);

      sphere.position.set(midPoint.x, midPoint.y, midPoint.z);
      // console.log(scene);
      scene.add(sphere);

      // Update the reference to the last added mesh
      lastSpatialExtentMesh = sphere;
  }
}

// function plotSpatialExtent() {
//   const { lineTimeStamp1, lineTimeStamp2, finalData } = globalState;
//   const startTime = lineTimeStamp1;
//   const endTime = lineTimeStamp2;

//   // Initialize variables to store the merged extents
//   let minX = Infinity, minY = Infinity, minZ = Infinity;
//   let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

//   // Loop through each topic in finalData.topics_dict
//   Object.entries(finalData.topics_dict).forEach(([topicName, topicDetails]) => {
//       topicDetails.actions.forEach(action => {
//           const actionStartTime = parseTimeToMillis(action.start_time);
//           const actionEndTime = parseTimeToMillis(action.end_time);

//           // Check if the action is within the selected time range
//           if (actionStartTime >= startTime && actionEndTime <= endTime && action.spatial_extent) {
//               action.spatial_extent.forEach(point => {
//                   minX = Math.min(minX, point[0]);
//                   minY = Math.min(minY, point[1]);
//                   minZ = Math.min(minZ, point[2]);
//                   maxX = Math.max(maxX, point[0]);
//                   maxY = Math.max(maxY, point[1]);
//                   maxZ = Math.max(maxZ, point[2]);
//               });
//           }
//       });
//   });

//   // Check if we have a valid merged extent
//   if (minX < Infinity && maxX > -Infinity) {
//       // Calculate the midpoint of the merged extent
//       const midPoint = new THREE.Vector3(
//           (minX + maxX) / 2,
//           (minY + maxY) / 2,
//           (minZ + maxZ) / 2
//       );

//       // Optionally visualize the merged extent as a sphere or a box
//       // Here, we visualize it as a box

//       const geometry = new THREE.BoxGeometry(maxX - minX, maxY - minY, maxZ - minZ);
//       const material = new THREE.MeshBasicMaterial({color: 0x00ff00, wireframe: true}); // Use wireframe to see through
//       const box = new THREE.Mesh(geometry, material);

//       box.position.set(midPoint.x, midPoint.y, midPoint.z);
//       scene.add(box); // Add box to the scene
//   }
// }


function setTimes(data) {
  // console.log(data.earliest_action_time);
  const globalStartTime = parseTimeToMillis(data.earliest_action_time);
  const globalEndTime = parseTimeToMillis(data.latest_action_time);
  // console.log("Global Start Time:", new Date(globalStartTime));
  // console.log("Global End Time:", new Date(globalEndTime).toISOString());
  globalState.globalStartTime = globalStartTime;
  globalState.globalEndTime = globalEndTime;
  const totalTime = globalEndTime - globalStartTime;
  globalState.intervalDuration = totalTime / globalState.bins;
  globalState.intervals = Array.from({
    length: globalState.bins + 1
  }, (v, i) => new Date(globalStartTime + i * globalState.intervalDuration));
  globalState.lineTimeStamp1 = globalStartTime;
  globalState.lineTimeStamp2 = globalStartTime + 5000; // adding 5 second by default
}

// function setTimes(data) {
//   const globalStartTimes = globalState.jsonDatas.map(data => Math.min(...data.map(entry => new Date(entry.Timestamp).getTime())));
//   const globalEndTimes = globalState.jsonDatas.map(data => Math.max(...data.map(entry => new Date(entry.Timestamp).getTime())));
  
//   globalState.globalStartTime = Math.min(...globalStartTimes);
//   console.log(globalState.globalStartTime);
//   console.log(new Date(globalState.globalStartTime));
//   const globalStartTime = globalState.globalStartTime;
//   const somePadding = 0;
//   globalState.globalEndTime = Math.max(...globalEndTimes) + somePadding - 5000;
//   const globalEndTime = globalState.globalEndTime;
//   const totalTime = globalEndTime - globalStartTime;
//   globalState.intervalDuration = totalTime / globalState.bins;
//   const duration = (globalEndTime - globalStartTime) / 1000 / 60;
//   globalState.intervals = Array.from({
//       length: globalState.bins + 1
//   }, (v, i) => new Date(globalStartTime + i * globalState.intervalDuration));

// }

// function createTimeSlider(data) {
// 	const globalStartTimes = globalState.jsonDatas.map(data => Math.min(...data.map(entry => new Date(entry.Timestamp).getTime())));
// 	const globalEndTimes = globalState.jsonDatas.map(data => Math.max(...data.map(entry => new Date(entry.Timestamp).getTime())));
// 	globalState.globalStartTime = Math.min(...globalStartTimes);
// 	const globalStartTime = globalState.globalStartTime;
// 	const somePadding = 0;
// 	globalState.globalEndTime = Math.max(...globalEndTimes) + somePadding - 5000;

// 	const globalEndTime = globalState.globalEndTime;
// 	const totalTime = globalEndTime - globalStartTime;
// 	globalState.intervalDuration = totalTime / globalState.bins;

// 	const duration = (globalEndTime - globalStartTime) / 1000 / 60;
// 	globalState.intervals = Array.from({
// 		length: globalState.bins + 1
// 	}, (v, i) => new Date(globalStartTime + i * globalState.intervalDuration));

// 	const slider = d3.select('#slider-container').append('input')
// 		.attr('type', 'range')
// 		.attr('min', 0)
// 		.attr('max', duration)
// 		.attr('step', 'any')
// 		.on('input', function() {
// 			const elapsedMinutes = +this.value;
// 			globalState.currentTimestamp = elapsedMinutes * 60 * 1000; // Convert minutes back to milliseconds
// 			const binIndex = Math.floor((globalState.currentTimestamp) / intervalDuration);
// 			globalState.startTimeStamp = globalState.globalStartTime + (binIndex * globalState.intervalDuration);

// 			globalState.endTimeStamp = globalState.startTimeStamp + globalState.intervalDuration;
// 			if (isAnimating) {
// 				toggleAnimation();
// 				updatePlayPauseButton();
// 			}
// 			isAnimating = false; // Optionally pause animation
// 			const timestamp = globalState.globalStartTime + currentTimestamp;
// 			jsonDatas.forEach((data, index) => {
// 				// updateVisualization(timestamp, index);
// 				// updateVisualizationOcculus(timestamp);
// 			});
//       // updateTimeDisplay(timestamp, globalStartTime);
// 			// animateTemporalView(timestamp);
// 			createLines(globalState.lineTimeStamp1, globalState.lineTimeStamp2);
//       // initializeShadedAreaDrag();
//       // console.log("left shading function, enetring toolbar ");
//       generateHierToolBar();
		
// 		});
// 	slider.node().value = 0;
// 	slider.on('input', function() {
// 		const elapsedMinutes = +this.value;
// 		globalState.currentTimestamp = elapsedMinutes * 60 * 1000; // Convert minutes back to milliseconds
// 		const binIndex = Math.floor((globalState.currentTimestamp) / globalState.intervalDuration);
// 		globalState.startTimeStamp = globalState.globalStartTime + (binIndex * globalState.intervalDuration);
// 		globalState.endTimeStamp = globalState.startTimeStamp + globalState.intervalDuration;
// 		if (isAnimating) {
// 			toggleAnimation();
// 			updatePlayPauseButton();
// 		}
// 		isAnimating = false; // Optionally pause animation
// 		const timestamp = globalState.globalStartTime + globalState.currentTimestamp;
// 		globalState.currentTimestamp = timestamp;
// 		globalState.jsonDatas.forEach((data, index) => {
// 			// updateVisualization(timestamp, index);
// 			// updateVisualizationOcculus(timestamp);
// 		});
// 		// updateTimeDisplay(timestamp, globalState.globalStartTime);
// 		// animateTemporalView(timestamp);
// 		createLines(globalState.lineTimeStamp1, globalState.lineTimeStamp2);
//     // initializeShadedAreaDrag();
//     // console.log("left shading function, enetring toolbar ");
//     generateHierToolBar();
// 	});;
// }


export function getGlobalState() {
	return globalState;
}
function findXAxisStartX() {
  // Select the x-axis path element
  const xAxisPath = d3.select("#shared-axis-container svg .x-axis path").node();

  // Initialize startX as null in case the path or the match is not found
  let startX = null;

  // Parse the "d" attribute for the start x-coordinate
  if (xAxisPath) {
      const dAttribute = xAxisPath.getAttribute('d');
      // This regex looks for the 'M' command followed by numbers (the x-coordinate), ending with a comma
      const match = dAttribute.match(/M(\d+),/);
      startX = match ? parseFloat(match[1]) : null;
  }

  return startX;
}

function createLines(timestamp1, timestamp2) {
	const svg = d3.select("#temporal-view");
	const height = parseInt(d3.select("#speech-plot-container").style("height")) ;
  const dynamicWidth = globalState.dynamicWidth;
	const y1 = 55;
  const alignX = 10 ;

  let xPosition1 = Math.max(0, x(new Date(timestamp1))) + margin.left + alignX;
  let xPosition2 = Math.max(0, x(new Date(timestamp2))) + margin.left + alignX;

	let circle1 = svg.select('#time-indicator-circle1');
  circle1.attr('class', 'interactive');

	let circle2 = svg.select('#time-indicator-circle2');
  circle2.attr('class', 'interactive');



	function dragstarted(event, d) {
		d3.select(this).raise().classed("active", true);
	}

	function dragended(event, d) {
		d3.select(this).classed("active", false);
	}
	var drag = d3.drag()
		.on("start", dragstarted)
		.on("drag", dragged)
		.on("end", dragended);

	let line1 = svg.select('#time-indicator-line1');

	if (line1.empty()) {
		line1 = svg.append('line').attr('id', 'time-indicator-line1');
	}


	line1.attr('x1', xPosition1)
		.attr('x2', xPosition1)
		.attr('y1', y1)
		.attr('y2', height)
		.style('stroke', '#82caeb')
		.style('stroke-width', '3')
		.style('opacity', 1)
    .attr('class', 'interactive')
		.call(drag);

	circle1.attr('cx', xPosition1)
		.attr('cy', y1)
		.call(drag);

	let line2 = svg.select('#time-indicator-line2');

	if (line2.empty()) {
		line2 = svg.append('line').attr('id', 'time-indicator-line2');
	}


	line2.attr('x1', xPosition2)
		.attr('x2', xPosition2)
		.attr('y1', y1)
		.attr('y2', height)
		.style('stroke', '#82caeb')
		.style('stroke-width', '3')
		.style('opacity', 1)
    .attr('class', 'interactive')
		.call(drag);

	circle2.attr('cx', xPosition2)
		.attr('cy', y1)
		.call(drag);


	circle1.call(drag);
	circle2.call(drag);
  
	updateRangeDisplay(timestamp1,timestamp2);
  updateXRSnapshot();
  plotSpatialExtent();
  // initializeShadedAreaDrag();
  


}




export function dragged(event,d) {
  const svgElement = document.querySelector("#temporal-view svg");
  const container = document.getElementById("temporal-view"); 
  const svg = d3.select("#plot-svg");
  const indicatorSvg = document.getElementById('indicator-svg');
  indicatorSvg.style.overflow = "visible";


  const height = parseInt(d3.select(svgElement).style("height")) - margin.top - margin.bottom;

  let newXPosition = event.x - margin.left;
  let newTimestamp = x.invert(newXPosition);

  const id = d3.select(this).attr('id');
  const isLine1 = id === 'time-indicator-line1' || id === 'time-indicator-circle1';
  const circleId = isLine1 ? '#time-indicator-circle1' : '#time-indicator-circle2';
  const otherCircleId = isLine1 ? '#time-indicator-circle2' : '#time-indicator-circle1';
  const lineId = isLine1 ? 'time-indicator-line1' : 'time-indicator-line2';
  const otherLineId = isLine1 ? 'time-indicator-line2' : 'time-indicator-line1';
  const timestampKey = isLine1 ? 'lineTimeStamp1' : 'lineTimeStamp2';
  let otherTimestamp = globalState[isLine1 ? 'lineTimeStamp2' : 'lineTimeStamp1'];
  const minDistanceMillis = 5000;

  if (newTimestamp > new Date(globalState.globalEndTime)) {
    newTimestamp = new Date(globalState.globalEndTime);
    newXPosition = x(newTimestamp);
  }
  if (isLine1) {
      newTimestamp = Math.min(newTimestamp, otherTimestamp - minDistanceMillis);
  } else {
      newTimestamp = Math.max(newTimestamp, otherTimestamp + minDistanceMillis);
  }
  if (isLine1) {
    globalState.lineTimeStamp1 = newTimestamp;
    globalState.lineTimeStamp2 = otherTimestamp;
    globalState.currentTimestamp = newTimestamp - globalState.globalStartTime;
    const binIndex = Math.floor(globalState.currentTimestamp / globalState.intervalDuration);
    globalState.startTimeStamp = globalState.globalStartTime + (binIndex * globalState.intervalDuration);
    globalState.endTimeStamp = globalState.startTimeStamp + globalState.intervalDuration;
  } else {
    globalState.lineTimeStamp2 = newTimestamp;
    globalState.lineTimeStamp1 = otherTimestamp;
  }
  newXPosition = x(new Date(newTimestamp));

  d3.select(this).attr('x1', newXPosition + margin.left).attr('x2', newXPosition + margin.left);
  // d3.select(this).attr('x1', newXPosition).attr('x2', newXPosition);
  d3.select(circleId).attr('cx', newXPosition + margin.left);
  d3.select(circleId).attr('cx', newXPosition);


  if (isAnimating) {
      toggleAnimation();
      updatePlayPauseButton();
  }
  isAnimating = false;

  createLines(globalState.lineTimeStamp1, globalState.lineTimeStamp2);
  // updateTimeDisplay(newTimestamp, globalState.globalStartTime);
  const timeStamp1 = new Date(globalState.lineTimeStamp1);
  const timeStamp2 = globalState.lineTimeStamp2;
  updateRangeDisplay(timeStamp1, timeStamp2);
  updateXRSnapshot();
  generateHierToolBar();
  plotTreeMap();

  initializeOrUpdateSpeechBox();
  initializeShadedAreaDrag();
  plotSpatialExtent();
  createAvatarSegment(0);
  createAvatarSegment(1);
  createAvatarSegment(2);
  updateSceneBasedOnSelections();
}



function generateHierToolBar() {
  const data = globalState.finalData;
  const toolbar = document.getElementById('hier-toolbar');
  toolbar.innerHTML = '';

  let othersTopicDetails = null;

  // Process each topic and save "Others" for last
  Object.entries(data.topics_dict).forEach(([topicName, topicDetails]) => {
      const isInTimeRange = topicDetails.actions.some(action => {
        // console.log("THIS IS TOPIC NAME " + topicName);
          const actionStartTime = parseTimeToMillis(action.start_time);
          const actionEndTime = parseTimeToMillis(action.end_time);
          return actionEndTime >= globalState.lineTimeStamp1 && actionStartTime <= globalState.lineTimeStamp2;
      });

      if (isInTimeRange) {
        if (topicName !== "Others" && topicName !== "Raw Capture") { // Skip "Others" and "Raw Capture"
          createTopicItem(topicName, topicDetails, toolbar);
        } else if (topicName === "Others") { // Save "Others" details for later
          othersTopicDetails = topicDetails;
        }
      }
  });

  if (othersTopicDetails !== null) {
      createOthersItem(othersTopicDetails, toolbar);
  }
}

function createTopicItem(topicName, topicDetails, toolbar) {
  const topicItem = document.createElement('li');
  const topicCheckbox = document.createElement('input');
  topicCheckbox.type = 'checkbox';
  topicCheckbox.id = `checkbox_broadtopic_${topicName.replace(/\s+/g, '_')}`;
  topicCheckbox.className = 'topic-checkbox';

  const label = document.createElement('label');
  label.htmlFor = topicCheckbox.id;
  label.textContent = topicName;

  topicItem.appendChild(topicCheckbox);
  topicItem.appendChild(label);
  if (globalState.finalData.topics_dict[topicName].is_user_interest) { 
    label.innerHTML = `${topicName} <span style="color: #7e4695;">★</span>`;
      label.style.color = '#7e4695';}

  // Filter actions within the time range first before extracting unique keywords
  const filteredActions = topicDetails.actions.filter(action => {
    const actionStartTime = parseTimeToMillis(action.start_time);
    const actionEndTime = parseTimeToMillis(action.end_time);
    return actionEndTime >= globalState.lineTimeStamp1 && actionStartTime <= globalState.lineTimeStamp2;
  });
  

  const userInterestKeywords = new Set();
  const uniqueKeywords = new Set();
//   filteredActions.forEach(action => {
//     action.data.keywords.forEach(keyword => uniqueKeywords.add(keyword));
//     if (action.has_user_interest_keyword) {
//       action.data.keywords.forEach(userInterestKeywords.add, userInterestKeywords);
//     }
//     // else {
//     //   console.log(action.data.keywords);
//     // }
// });
filteredActions.forEach(action => {
  console.log(action);
  if (action.action_type === "RawCapture") { return ; }
  action.data.keywords.forEach((keyword, index) => {
    uniqueKeywords.add(keyword);
    // Assuming the keywords_relevance_to_user_interest array is aligned with keywords
    if (action.data.keywords_relevance_to_user_interest[index]) {
      userInterestKeywords.add(keyword);
    }
  });
});

  
  // filteredActions.forEach(action => {
  //   action.data.keywords.forEach(keyword => uniqueKeywords.add(keyword));
  //   // console.log(action.has_user_interest_keyword);
  // });

  const keywordsList = document.createElement('ul');
  uniqueKeywords.forEach(keyword => {
    const keywordItem = document.createElement('li');
    const keywordCheckbox = document.createElement('input');
    keywordCheckbox.type = 'checkbox';
    keywordCheckbox.className = 'keyword-checkbox';
    keywordCheckbox.id = `checkbox_keyword_${keyword.replace(/\s+/g, '_')}_broadtopic_${topicName.replace(/\s+/g, '_')}`;

    keywordCheckbox.addEventListener('change', function() {
      if (this.checked) {
        // If the keyword checkbox is checked, add grey background to its parent `li`
        this.parentNode.style.backgroundColor = 'd0d0d0'; // Directly applying style
        this.parentNode.classList.add('keyword-selected');
      } 
      else {
        this.parentNode.classList.remove('keyword-selected');
      }

    

    // keywordCheckbox.addEventListener('change', function() {
      if (this.checked) {
        topicCheckbox.checked = true;
        // this.parentNode.classList.add('keyword-selected');
      } else {
        // Check if all sibling keyword checkboxes are unchecked
        const allSiblingsUnchecked = [...this.parentNode.parentNode.querySelectorAll('.keyword-checkbox')].every(checkbox => !checkbox.checked);
        if (allSiblingsUnchecked) {
          topicCheckbox.checked = false;
          // this.parentNode.classList.remove('keyword-selected');
        }
        
      }
      initializeOrUpdateSpeechBox();
      updateSceneBasedOnSelections();
    });
    

    const keywordLabel = document.createElement('label');
    keywordLabel.htmlFor = keywordCheckbox.id;
    keywordLabel.textContent = keyword;
    if (userInterestKeywords.has(keyword)) {
      keywordLabel.style.color = '#7e4695'; // Purple color for text
      // Additional styling can be applied as needed
    }


    keywordItem.appendChild(keywordCheckbox);
    keywordItem.appendChild(keywordLabel);
    keywordsList.appendChild(keywordItem);
  });

  topicItem.appendChild(keywordsList);
  toolbar.appendChild(topicItem);

  // Listener for the broad topic checkbox to check/uncheck all keywords
  topicCheckbox.addEventListener('change', function() {
    const childCheckboxes = this.parentNode.querySelectorAll('.keyword-checkbox');
    childCheckboxes.forEach(childCheckbox => {
      childCheckbox.checked = this.checked;
      // if (this.checked) {  this.parentNode.classList.add('keyword-selected');}
      // else {  this.parentNode.classList.remove('keyword-selected');}
      // this.parentNode.classList.add('keyword-selected');
      childCheckbox.dispatchEvent(new Event('change'));
    });
  });
}


function createOthersItem(othersData, toolbar) {
  const othersItem = document.createElement('li');
  const othersCheckbox = document.createElement('input');
  othersCheckbox.type = 'checkbox';
  othersCheckbox.id = `checkbox_broadtopic_Others`;
  // othersCheckbox.id = 'checkbox-Others';/
  othersCheckbox.className = 'topic-checkbox';
  const label = document.createElement('label');
  label.htmlFor = othersCheckbox.id;
  label.textContent = "Others";

  othersItem.appendChild(othersCheckbox);
  othersCheckbox.addEventListener('change', function() {
    // if (this.checked) {  this.parentNode.classList.add('keyword-selected'); }
    // else {  this.parentNode.classList.remove('keyword-selected');}
    initializeOrUpdateSpeechBox();
    updateSceneBasedOnSelections();
    // updateSpeechBox(globalState.finalData, globalState.lineTimeStamp1, globalState.lineTimeStamp2);
  });
  othersItem.appendChild(label);
  toolbar.appendChild(othersItem);
}






// function getSelectedTopic() {
//   const topicCheckboxes = document.querySelectorAll('.topic-checkbox:checked');
//   let selectedTopic = '';
  
//   topicCheckboxes.forEach(checkbox => {
//       if (checkbox.checked) {
//           const idParts = checkbox.id.split('_'); 
//           const topicIndex = idParts.indexOf('broadtopic') + 1; 
//           selectedTopic = idParts.slice(topicIndex).join(' '); 
//       }
//   });
  
//   return selectedTopic;
// }

function getSelectedTopics() {
  const topicCheckboxes = document.querySelectorAll('.topic-checkbox:checked');
  let selectedTopics = [];
  
  topicCheckboxes.forEach(checkbox => {
      const idParts = checkbox.id.split('_'); 
      const topicIndex = idParts.indexOf('broadtopic') + 1; 
      const topic = idParts.slice(topicIndex).join(' '); 
      selectedTopics.push(topic);
  });
  
  return selectedTopics;
}


function getSelectedKeywords() {
  const keywordCheckboxes = document.querySelectorAll('.keyword-checkbox:checked'); // Select only checked boxes
  // console.log(keywordCheckboxes);
  let selectedKeywords = [];
  
  keywordCheckboxes.forEach(checkbox => {
      // Extracts the keyword from the ID, considering 'keyword' and 'broadtopic' identifiers
      const idParts = checkbox.id.split('_'); // Splits the ID into parts
      const keywordIndexStart = idParts.indexOf('keyword') + 1; // Finds the start index of the keyword
      const keywordIndexEnd = idParts.indexOf('broadtopic'); // Finds the end index of the keyword
      const keyword = idParts.slice(keywordIndexStart, keywordIndexEnd).join(' '); // Extracts the keyword and replaces underscores with spaces
      selectedKeywords.push(keyword);
  });
  // console.log("this is whats returning from selected key words " + selectedKeywords);
  
  return selectedKeywords;
}

function parseTimeToMillis(customString) {
  // console.log(" here with " + customString);
  let [dateStr, timeStr, milliStr] = customString.split('_');
  
  // Further split into year, month, day, hours, minutes, seconds
  let year = parseInt(dateStr.slice(0, 2), 10) + 2000; // Assuming '24' is 2024
  let month = parseInt(dateStr.slice(2, 4), 10) - 1; // Month is 0-indexed in JS
  let day = parseInt(dateStr.slice(4, 6), 10);
  
  let hours = parseInt(timeStr.slice(0, 2), 10);
  let minutes = parseInt(timeStr.slice(2, 4), 10);
  let seconds = parseInt(timeStr.slice(4, 6), 10);
  
  // Milliseconds are straightforward, just need to parse
  let milliseconds = parseInt(milliStr, 10);

  // Log the parsed components
  // console.log(`Came here with ${customString} , Year: ${year}, Month: ${month}, Day: ${day}, Hours: ${hours}, Minutes: ${minutes}, Seconds: ${seconds}, Milliseconds: ${milliseconds}`);
  
  // Create the Date object
  let date = new Date(Date.UTC(year, month, day, hours, minutes, seconds));
  // console.log(`Came here with ${customString} , Year: ${year}, Month: ${month}, Day: ${day}, Hours: ${hours}, Minutes: ${minutes}, Seconds: ${seconds}, Milliseconds: ${milliseconds} and date ${date.toUTCString()}`);
  
  // Log the Date object
  // console.log(`Date object: ${date}`);
  
  // Return the time in milliseconds since Unix epoch
  let timeInMillis = date.getTime();
  // console.log(`Time in milliseconds since Unix epoch: ${timeInMillis}`);
  return timeInMillis;
}



function initializeOrUpdateSpeechBox() {
  const data = globalState.finalData.topics_dict; // Assuming this is the correct data structure
  const container = document.getElementById("speech-box");
  const hierToolbar = document.getElementById('hier-toolbar');
  let offsetHeight = hierToolbar.offsetHeight;
  const timeFormat = d3.timeFormat("%b %d %I:%M:%S %p");
  container.style.marginTop = `${offsetHeight}px`;

  let rangeDisplay = document.querySelector('.time-range-display-speechbox');
  if (!rangeDisplay) {
      rangeDisplay = document.createElement('div');
      rangeDisplay.className = 'time-range-display-speechbox';
      container.appendChild(rangeDisplay);
  }
  // rangeDisplay.textContent = `Selected Time Range: ${timeFormat(new Date(globalState.lineTimeStamp1))} - ${timeFormat(new Date(globalState.lineTimeStamp2))}`;rangeDisplay.innerHTML = `<strong>Selected Time Range: ${timeFormat(new Date(globalState.lineTimeStamp1))} - ${timeFormat(new Date(globalState.lineTimeStamp2))}</strong>`;
  rangeDisplay.innerHTML = `<strong>Selected Time Range: ${timeFormat(new Date(globalState.lineTimeStamp1))} - ${timeFormat(new Date(globalState.lineTimeStamp2))}</strong>`;

  let speechBoxesContainer = document.getElementById("speech-boxes-container");
  if (!speechBoxesContainer) {
      speechBoxesContainer = document.createElement('div');
      speechBoxesContainer.id = "speech-boxes-container";
      container.appendChild(speechBoxesContainer);
  } else {
      speechBoxesContainer.innerHTML = '';
  }

  const selectedTopics = getSelectedTopics(); // Now returns an array of selected topics
  const selectedKeywords = getSelectedKeywords(); // Assumes this function returns an array of selected keywords
  // console.log("Selected Topics: ", selectedTopics);
  // console.log("Selected Keywords: ", selectedKeywords);
  
  let actionsToDisplay = [];
  // console.log(data);
  selectedTopics.forEach(topic => {
      if (data[topic]) {
          const topicActions = data[topic].actions.filter(action => {
              const actionStartTime = parseTimeToMillis(action.start_time);
              const actionEndTime = parseTimeToMillis(action.end_time);
              return actionEndTime >= globalState.lineTimeStamp1 && actionStartTime <= globalState.lineTimeStamp2;
          });
          actionsToDisplay.push(...topicActions); // Combine actions from multiple topics
      }
  });

  actionsToDisplay.forEach(action => {
    // console.log(action); 
    if (action.action_type === "RawCapture") { return ; }
      const speechBox = getSpeechData(action, selectedKeywords);
      if (speechBox)
       { speechBoxesContainer.appendChild(speechBox);
       }
  });
}


function getSpeechData(action, selectedKeywords) {
  const speechBox = document.createElement('div');
  speechBox.className = 'speech-box';
  speechBox.style.border = '1px solid grey'; // Grey border
  speechBox.style.borderRadius = '8px'; // Rounded corners
  speechBox.style.padding = '15px';

  const hasRelevantKeyword = selectedKeywords.some(keyword => action.data.keywords.includes(keyword));
  if (!hasRelevantKeyword) {
		return null;
	  }

  // Speaker Element
  const speakerEl = document.createElement('div');
  speakerEl.className = 'speaker';
  speakerEl.textContent = `[SPEAKER: ${action.actor_name}]`;
  
  // // Audience Element
  // // if (action.action_type === "Verbal Communication ") {
  //   const audienceEl = document.createElement('div');
  //   audienceEl.className = 'audience';
  //   audienceEl.textContent = `[AUDIENCE: ${action.audience}]`;
  // // }

  // Original Transcribed Text
  const originalTextEl = document.createElement('div');
  originalTextEl.className = 'original-transcribed';
  const rawTextTitle = document.createElement('strong');
  rawTextTitle.textContent = 'Original Transcribed Text: ';

  const rawTextContent = document.createElement('span');
  rawTextContent.textContent = action.data.raw_text;

  originalTextEl.appendChild(rawTextTitle);
  let processedText = action.data.raw_text;
  if (action.data.highlighted_texts && action.data.highlighted_texts.length > 0) {
    action.data.highlighted_texts.forEach(text => {
      const highlightedText = `<span style="background-color: #7e4695; color: white;">${text}</span>`; 
      processedText = processedText.replace(text, highlightedText);
    });
  }
  rawTextContent.innerHTML = processedText;
  originalTextEl.appendChild(document.createElement('br'));
  originalTextEl.appendChild(rawTextContent);

 

  // Summary
  const summaryEl = document.createElement('div');
  summaryEl.className = 'summary';
  const summaryTitle = document.createElement('strong');
  summaryTitle.textContent = 'Summary: ';

  const summaryContent = document.createElement('span');
  if (action.data.summary) {
    summaryContent.textContent = action.data.summary ;
    summaryEl.appendChild(summaryTitle);
    summaryEl.appendChild(document.createElement('br'));
    summaryEl.appendChild(summaryContent);
  }

  // Keywords
  const keywordsEl = document.createElement('div');
  keywordsEl.className = 'keywords';
  const keywordsTitle = document.createElement('strong');
  keywordsTitle.textContent = 'Keywords: ';

  const keywordsContent = document.createElement('span');
  keywordsContent.innerHTML = action.data.keywords.map(keyword => {
    if (selectedKeywords.includes(keyword)) {
      return `<span style="background-color: #d0d0d0;">${keyword}</span>`; 
    } else {
      return keyword;
    }
  }).join(', ');

  keywordsEl.appendChild(keywordsTitle);
  keywordsEl.appendChild(document.createElement('br'));
  keywordsEl.appendChild(keywordsContent);

  // Append all elements to the speech box
  speechBox.appendChild(speakerEl);
  // if (action.action_type === "VerbalInteraction") {  speechBox.appendChild(audienceEl);  }
  speechBox.appendChild(originalTextEl);
  if (action.data.summary) {
    speechBox.appendChild(summaryEl);
  }
  speechBox.appendChild(keywordsEl);

  return speechBox;
}
function updateInterestBox() {
  const container = document.getElementById("user-interest-topic");

  // Clear existing content
  container.innerHTML = '';

  // Create "Topic of your interest" span
  const topicInterestSpan = document.createElement("span");
  topicInterestSpan.textContent = "Topic of your interest: ";
  topicInterestSpan.style.color = "white";

  // Create "Next user interest topic" span
  const nextInterestSpan = document.createElement("span");
  nextInterestSpan.textContent = userInterestTopic;
  nextInterestSpan.style.color = "#ffc000";

  // Append both spans to the container
  container.appendChild(topicInterestSpan);
  container.appendChild(nextInterestSpan);

  // Style the container for text wrapping
  container.style.display = "inline-block";
  container.style.maxWidth = "100%";
  container.style.whiteSpace = "normal";
  container.style.overflowWrap = "break-word";
  container.contentEditable = "true"; // Make it editable
}
function updateXRSnapshot(){
  // const actionDictEntries = Object.entries(globalState.finalData.action_dict);

  // // Filtering for Raw Capture actions and ensuring they are within the time range
  // const rawCaptureEntries = actionDictEntries
  //   .filter(([actionName, _]) => actionName === "Raw Capture")
  //   .flatMap(([_, actionDetails]) => actionDetails.actions)
  //   .filter(action => {
  //     return action.start_time >= globalState.lineTimeStamp1 && action.end_time <= globalState.lineTimeStamp2;
  //   });
  //   if (rawCaptureEntries.length > 0) {
  //   const imagePath = rawCaptureEntries[0].data.image_path; // Adjust based on actual structure if needed
  //   document.getElementById("user-xr-snapshot").innerHTML = `<img src="${imagePath}" alt="XR Snapshot"/>`;
  // } else {
  //   console.log("No matching Raw Capture events found in the specified time range.");
  // } 

  
}

function updateRangeDisplay(time1, time2) {
  const indicatorSVG = d3.select("#indicator-svg");
  indicatorSVG.selectAll("rect.shading").remove();
  const svg = d3.select("#temporal-view");

  const line1X = parseFloat(d3.select('#time-indicator-line1').attr('x1'));
  const line2X = parseFloat(d3.select('#time-indicator-line2').attr('x1'));
  const yStart = parseFloat(d3.select('#time-indicator-line1').attr('y1')); // Assuming both lines have the same y1
  const yEnd = parseFloat(d3.select('#time-indicator-line1').attr('y2'));
  const height = yEnd - yStart;
  const xStart = Math.min(line1X, line2X);
  const xEnd = Math.max(line1X, line2X);
  const shadingWidth = xEnd - xStart;

  indicatorSVG.append("rect")
      .attr("class", "shading") 
      .attr("x", xStart)
      .attr("y", yStart) 
      .attr("width", shadingWidth)
      .attr("height", height) 
      .attr("fill", "#43afe2")
		// .attr('class', 'interactive')
      .attr("fill-opacity", 0.5); 

  const timeFormat = d3.timeFormat("%b %d %I:%M:%S %p");
  const rangeDisplay = document.getElementById("range-display");
  if (rangeDisplay) {
    rangeDisplay.textContent = `Selected Time Range: ${timeFormat(new Date(time1))} - ${timeFormat(new Date(time2))}`;
  }
}

function initializeShadedAreaDrag() {
  const indicatorSVG = d3.select("#indicator-svg");
  const shadedArea = indicatorSVG.select(".shading"); // Assuming .shading is the class for your shaded area

  let dragStartX = null;

  const dragstarted = (event) => {
    dragStartX = event.x;
  };

  const dragged = (event) => {
    // console.log(" r u here?");
    const dx = event.x - dragStartX; // Change in x
    const line1 = indicatorSVG.select("#time-indicator-line1");
    const line2 = indicatorSVG.select("#time-indicator-line2");
    const circle1 = indicatorSVG.select("#time-indicator-circle1");
    const circle2 = indicatorSVG.select("#time-indicator-circle2");
    let line1X = parseFloat(line1.attr("x1"));
    let line2X = parseFloat(line2.attr("x1"));

    // Update positions based on drag
    line1.attr("x1", line1X + dx).attr("x2", line1X + dx);
    line2.attr("x1", line2X + dx).attr("x2", line2X + dx);
    circle1.attr("cx", line1X + dx);
    circle2.attr("cx", line2X + dx);

  // Update globalState timestamps based on new line positions
  const newLine1Timestamp = x.invert(line1X + dx);
  const newLine2Timestamp = x.invert(line2X + dx);
  globalState.lineTimeStamp1 = newLine1Timestamp.getTime();
  globalState.lineTimeStamp2 = newLine2Timestamp.getTime();

  updateRangeDisplay(newLine1Timestamp, newLine2Timestamp);
  updateXRSnapshot();
  generateHierToolBar();
  plotTreeMap();
  createAvatarSegment(0);
  createAvatarSegment(1);
  createAvatarSegment(2);
  updateSceneBasedOnSelections();
  plotSpatialExtent();

  dragStartX = event.x; 

};

  const dragended = () => {
  };

  const drag = d3.drag()
    .on("start", dragstarted)
    .on("drag", dragged)
    .on("end", dragended);

  
  shadedArea.call(drag);
 
}




function createSharedAxis() {
  const { globalStartTime, globalEndTime, bins, unit } = globalState;
  // console.log(new Date(globalStartTime));
  // console.log(new Date(globalEndTime));
   
  // Container setup
  const temporalViewContainer = d3.select("#temporal-view");
  const minWidth = document.getElementById('temporal-view').clientWidth;
  // const minWidth = temporalViewContainer.width
  let sharedAxisContainer = temporalViewContainer.select("#shared-axis-container");
  if (sharedAxisContainer.empty()) {
    sharedAxisContainer = temporalViewContainer.append("div").attr("id", "shared-axis-container");
  }

  sharedAxisContainer.html("");

  // Margin setup
  // const margin = { top: 20, right: 30, bottom: 10, left: 80 };

  // Time format for ticks
  const timeFormat = d3.timeFormat("%I:%M:%S");

  // Calculate the total duration in minutes
  // const totalDurationMinutes = (globalEndTime - globalStartTime) / (1000 * 60);
  const totalDuration = globalEndTime - globalStartTime;
  let intervalSizeMillis;
  if (unit === 'minutes') {
    intervalSizeMillis = bins * 60 * 1000; // Convert minutes to milliseconds
  } else { 
    intervalSizeMillis = bins * 1000; // Convert seconds to milliseconds
  }

  const totalDurationMillis = globalEndTime - globalStartTime;
  const numberOfIntervals = Math.ceil(totalDurationMillis / intervalSizeMillis);
  const widthPerInterval = 100; // Fixed width for each interval

  const intervalDuration = totalDuration * (bins / 100);
  // console.log("interval duration " + intervalDuration/(1000 * 60));
  // const numberOfIntervals = Math.ceil(100 / bins);
  globalState.dynamicWidth = numberOfIntervals * widthPerInterval;
  // let localDynamicWidth = numberOfIntervals * widthPerInterval;
  globalState.dynamicWidth = Math.max(globalState.dynamicWidth, minWidth);

  // Adjust the scale to cover the dynamic width
  x = d3.scaleTime()
      .domain([new Date(globalStartTime), new Date(globalEndTime)])
      .range([0, globalState.dynamicWidth]);

  // Setup the axis
  // const xAxis = d3.axisTop(x)
  //     // .ticks(d3.timeMinute.every(bins))
  //     .tickFormat(timeFormat);

      const xAxis = d3.axisTop(x)
      .ticks(d3.timeMillisecond.every(intervalSizeMillis))
      .tickFormat(timeFormat);

  // Create SVG for the axis
  const svg = sharedAxisContainer.append("svg")
      .attr("width", globalState.dynamicWidth + margin.left + margin.right)
      .attr("height", 50)
      .append("g")
      .attr("transform", `translate(${margin.left}, ${margin.top})`);

  svg.append("g")
      .attr("class", "x-axis")
      .call(xAxis);

  // Enable horizontal scrolling
  // sharedAxisContainer.style("overflow-x", "auto").style("max-width", "100%");
}




function updateAxisTicks(svg, xScale, binSize) {
  const tickInterval = d3.timeMinute.every(binSize); // Dynamically set tick interval based on bin size
  const xAxis = d3.axisTop(xScale)
      .ticks(tickInterval)
      .tickFormat(d3.timeFormat("%I:%M:%S"))
      .tickPadding(5);
  
  svg.select(".x-axis").call(xAxis); // Re-call the axis to update ticks
}



function onWindowResize() {
	const spatialView = document.getElementById('spatial-view');
	globalState.camera.aspect = spatialView.clientWidth / spatialView.clientHeight;
	globalState.camera.updateProjectionMatrix();
	globalState.renderer.setSize(spatialView.clientWidth, spatialView.clientHeight);
}

async function initialize() {
  await initializeScene();
  const binsDropdown = document.getElementById('binsDropdown');
  console.log(binsDropdown);
  globalState.bins = binsDropdown.value;

  createSharedAxis();
  createPlotTemporal();
	createLines(globalState.lineTimeStamp1, globalState.lineTimeStamp2);
  // initializeShadedAreaDrag();
  // console.log("left shading function, enetring toolbar ");
	generateHierToolBar();
  // plotTreeMap();
  updateInterestBox();
  document.querySelectorAll('.topic-checkbox, .keyword-checkbox').forEach(checkbox => {
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change'));
  });
  initializeOrUpdateSpeechBox();
  plotSpatialExtent();
  d3.select("body").on("click", function() {
    const contextMenu = d3.select("#context-menu");
    if (!contextMenu.empty()) {
      contextMenu.style("visibility", "hidden");
    }
  }, true);
	createAvatarSegment(0);
	createAvatarSegment(1);
  createAvatarSegment(2);
  updateSceneBasedOnSelections();
  // plotUserSpecificBarChart();
  plotBarChart();
  plotCombinedUsersSpiderChart();
  plotTreeMap();
}

initialize();
globalState.camera.updateProjectionMatrix();

  
onWindowResize();
window.addEventListener('resize', onWindowResize, false);

function animate() {
	requestAnimationFrame(animate);
	globalState.controls.update();
	globalState.renderer.render(globalState.scene, globalState.camera);
}

export function getScene() {
	return scene;
}
animate();;