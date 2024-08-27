import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import * as THREE from "https://cdn.skypack.dev/three@0.132.2";
import { FBXLoader } from "https://cdn.skypack.dev/three@0.132.2/examples/jsm/loaders/FBXLoader.js";
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
let speechEnabled = false;
let xrInteractionEnabled = false;
let noneEnabled = true;
let numUsers = 0;
let x ;
let yScale ;
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
	show: Array(numUsers+1).fill(true),
	lineTimeStamp1: 0,
	lineTimeStamp2: 0,
  	finalData: undefined,
	dynamicWidth:0,
	scene: undefined,
	camera:undefined,
	renderer:undefined,
	controls:undefined,
	currentLineSegments : [],
	triangleMesh: [],
	raycastLines : [],
	rightControls: [],
	leftControls : [],
	lineDrawing: [],
	loadedClouds : {},
	loadedObjects : {},
};
const userInterestTopic = "Error, bugs or complaints";
// user 1 avatar, user 2 avatar, user 1 rc, user 2 rc , user 1 lc, user 2 rc

const margin = { top: 20, right: 30, bottom: 10, left: 160 };
let buffer = 167;
const hsl = {
	h: 0,
	s: 0,
	l: 0
};
const topicOfInterest = "";
const colorScale = d3.scaleOrdinal()
    .domain(["User1", "User2", "User3", "0", "1", "2"])
    .range(["#76C7C0", "#3B6978", "#264653", "#8dd3c7", "#fdcdac", "#bebada"]); //"#B0BEC5", "#455A64" | "#87CEFA", "#005F73"

const opacities = [0.2, 0.4, 0.6, 0.8, 1];

let isAnimating = true;
const animationStep = 100;
let roomMesh;
let meshes = [];
let avatars = []
let interactionMeshes = []
let speechMeshes = []


let avatarLoaded = false;
let roomLoaded = false;
let movementPointsMesh;



export function updateIntervals() {
  createSharedAxis();
  createLines(globalState.lineTimeStamp1, globalState.lineTimeStamp2);
  generateHierToolBar();
  createPlotTemporal();
  plotUserSpecificBarChart();
  plotUserSpecificDurationBarChart();
  updateObjectsBasedOnSelections();
}

function changeBinSize(newBinSize) {
	const unit = document.querySelector('input[name="unit"]:checked').value;

	var event = new CustomEvent('binSizeChange', {
		detail: { size: newBinSize, unit: unit }
	});
	updateIntervals(newBinSize, unit);
	createPlotTemporal();
	window.dispatchEvent(event);
  }

  document.getElementById('binsDropdown').addEventListener('change', function() {
	changeBinSize(this.value);
  });

  document.getElementById('unit-selection-container').addEventListener('change', function() {
	const unit = document.querySelector('input[name="unit"]:checked').value;
	const currentBinSize = document.getElementById('binsDropdown').value;
	changeBinSize(currentBinSize);
	console.log('Unit changed to:', unit);
  });

  window.addEventListener('binSizeChange', function(e) {
	globalState.bins = e.detail.size;
	globalState.unit = e.detail.unit;
	updateIntervals(e.detail.size, e.detail.unit);
	console.log('Bin size changed to:', e.detail.size, 'Unit:', e.detail.unit);
  });




async function loadAvatarModel(filename) {
	const loader = new GLTFLoader();
	const gltf = await loader.loadAsync(filename);
	const avatar = gltf.scene;
	avatar.rotation.set(0, 0, 0);
	avatar.scale.set(1, 1, 1);
	avatar.name = filename;
	globalState.scene.add(avatar);
	avatarLoaded = true;
	return avatar;
}

async function loadHand(filename) {
	const loader = new GLTFLoader();
	const gltf = await loader.loadAsync(filename);
	const avatar = gltf.scene;
	avatar.rotation.set(0, 0, 0);
	avatar.scale.set(2, 2, 2);
	avatar.name = filename;
	globalState.scene.add(avatar);
	avatarLoaded = true;
	return avatar;
}

async function loadRoomModel() {
	const loader = new GLTFLoader();
	try {
		const filename = 'VRGameScene.glb';
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

async function loadVirtualObject(filePath, location) {
    const loader = new GLTFLoader();
    try {
        const gltf = await loader.loadAsync(filePath);
		const obj = gltf.scene ;
		obj.scale.set(1,1,1);
		obj.name = filePath;
		// obj.position.x = location.x ;
		// obj.position.y = location.y ;
		// obj.position.z = location.z ;
        // gltf.scene.position.set(location.x, location.y, location.z);
        globalState.scene.add(obj);
        console.log(`Model loaded and placed at: ${location.x}, ${location.y}, ${location.z}`);
    } catch (error) {
        console.error('Failed to load model:', error);
    }
}

async function loadOBJModel(filename) {
    const loader = new OBJLoader();  // Using OBJLoader for OBJ files
    try {
        const obj = await loader.loadAsync(filename);
        obj.name = filename;
        globalState.scene.add(obj);  // Add the model to the scene
        console.log(`Model ${filename} loaded successfully.`);
        return obj;  // Return the loaded model
    } catch (error) {
        console.error(`Failed to load model ${filename}:`, error);  // Log any errors
    }
}

function parseData(dataString) {
	return dataString ? dataString.split(',').map(Number) : [];
}




d3.selectAll('#time-extent-toggle input[type="radio"]').on('change', function() {
  var timeExtent = d3.select(this).attr('value');
  toggleInstanceRange(timeExtent);
});

d3.selectAll('#time-extent-toggle input[type="radio"]').on('change', function() {
	var timeExtent = d3.select(this).attr('value');
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
	//   console.log("here?");
	  line2.style('display', null);
	  circle2.style('display',null);
	}
  }
  function window_onload() {
	generateUserLegends();
	for (let i = 1; i <= numUsers; i++) {
		document.getElementById(`toggle-user${i}`).addEventListener('change', function() {
			const userID = i ;
			globalState.show[userID] = this.checked;
			if (globalState.show[userID]) {
				// console.log("hellooo?")
				if (globalState.currentLineSegments[userID]) {
					globalState.scene.add(globalState.currentLineSegments[userID]);
				}
				if (globalState.triangleMesh[userID]) {
					globalState.triangleMesh[userID].forEach(mesh => {
							globalState.scene.add(mesh);
					});
				}
				if (globalState.avatars[userID-1]) {
					globalState.avatars[userID-1].visible = true ;
				}
				if (globalState.rightControls[userID-1]) {
					globalState.rightControls[userID-1].visible = true ;
				}
				if (globalState.leftControls[userID-1]) {
					globalState.leftControls[userID-1].visible = true ;
				}
				if (globalState.raycastLines[userID]) {
					globalState.raycastLines[userID].forEach(mesh => {
							globalState.scene.add(mesh);
					});
				}
				if (globalState.lineDrawing[userID]) {
					globalState.lineDrawing[0].forEach(filename => {
						const existingObject = globalState.scene.getObjectByName(filename);
						if (existingObject) {
							existingObject.visible = true ;
						  }
					});
				}

			}
			else {

				if (globalState.currentLineSegments[userID]) {

					globalState.scene.remove(globalState.currentLineSegments[userID]);

				}
				if (globalState.triangleMesh[userID]) {
					globalState.triangleMesh[userID].forEach(mesh => {
							globalState.scene.remove(mesh);
					});
				}

				if (globalState.avatars[userID-1]) {
					globalState.avatars[userID-1].visible = false ;
				}
				if (globalState.rightControls[userID-1]) {
					globalState.rightControls[userID-1].visible = false ;
				}
				if (globalState.leftControls[userID-1]) {
					globalState.leftControls[userID-1].visible = false ;
				}
				if (globalState.raycastLines[userID]) {
					globalState.raycastLines[userID].forEach(mesh => {
							globalState.scene.remove(mesh);
					});
				}
				if (globalState.lineDrawing[userID]) {
					globalState.lineDrawing[0].forEach(filename => {
						const existingObject = globalState.scene.getObjectByName(filename);
						// console.log("here?")
						if (existingObject) {
							// console.log(" and then here?");
							existingObject.visible = false ;
						  }
						globalState.scene.remove(existingObject);
					});
				}
			}

			//mits: update
			initializeOrUpdateSpeechBox();
			plotUserSpecificBarChart();
			plotUserSpecificDurationBarChart();
			updatePointCloudBasedOnSelections();
			updateObjectsBasedOnSelections();
		});
	}

	const playPauseButton = document.getElementById('playPauseButton');
	const playPauseButtonHeight = playPauseButton.offsetHeight;
	const timeDisplay = document.getElementById('timeDisplay');
	timeDisplay.style.top = (playPauseButton.offsetTop - playPauseButtonHeight) + 'px';

};


function updateUserDevice(userId) {
    // console.log("Update process initiated for user", userId);

    // User field mapping: Assuming User field in JSON like "User1", "User2"
    const userField = `User${userId + 1}`; // Adjusting userId to match "User1" for index 0

    const navigateActions = globalState.finalData.filter(action =>
        action.Name === 'Navigate' &&
        action.TriggerSource === 'HandheldARInputDevice' &&
        action.User === userField
    );
    // console.log(`Filtered ${navigateActions.length} navigate actions for user ${userField}.`);


    const allSubActions = [];
    navigateActions.forEach(action => {
        action.Data.forEach(subAction => {
            const invokeTime = parseTimeToMillis(subAction.ActionInvokeTimestamp);
            if (invokeTime >= globalState.lineTimeStamp1 && invokeTime <= globalState.lineTimeStamp2) {
                allSubActions.push({
                    parentAction: action,
                    ...subAction,
                    Timestamp: invokeTime // Converted to milliseconds
                });
            }
        });
    });

    // Sort subActions by Timestamp to process them in chronological order
    allSubActions.sort((a, b) => a.Timestamp - b.Timestamp);

    // console.log(`Processing ${allSubActions.length} sub-actions within range for user ${userField}.`);
    allSubActions.forEach(subAction => {
        const location = parseLocation(subAction.ActionInvokeLocation);
        if (globalState.avatars[userId]) {
            globalState.avatars[userId].position.set(location.x, location.y, location.z);
            const euler = new THREE.Euler(
                THREE.MathUtils.degToRad(location.pitch),
                THREE.MathUtils.degToRad(location.yaw),
                THREE.MathUtils.degToRad(location.roll),
                'ZXY'
            );
            globalState.avatars[userId].setRotationFromEuler(euler);
            // console.log(`Avatar updated for user ${userId + 1} at timestamp ${subAction.Timestamp}: Position(${location.x}, ${location.y}, ${location.z})`);
        }
    });

    if (allSubActions.length === 0) {
        // console.log('No suitable navigation actions found for user', userField, 'within the time range:', globalState.lineTimeStamp1, globalState.lineTimeStamp2);
    }
}

function updateLeftControl(userId) {

    // User field mapping: Assuming User field in JSON like "User1", "User2"
    const userField = `User${userId + 1}`; // Adjusting userId to match "User1" for index 0

    const navigateActions = globalState.finalData.filter(action =>
        action.Name === 'Move Hand' &&
        action.TriggerSource === 'XRHand_L' &&
        action.User === userField
    );

    // Filter subActions that fall within the specified time range
    const allSubActions = [];
    navigateActions.forEach(action => {
        action.Data.forEach(subAction => {
            const invokeTime = parseTimeToMillis(subAction.ActionInvokeTimestamp);
            if (invokeTime >= globalState.lineTimeStamp1 && invokeTime <= globalState.lineTimeStamp2) {
                allSubActions.push({
                    parentAction: action,
                    ...subAction,
                    Timestamp: invokeTime // Converted to milliseconds
                });
            }
        });
    });

    // Sort subActions by Timestamp to process them in chronological order
    allSubActions.sort((a, b) => a.Timestamp - b.Timestamp);


    allSubActions.forEach(subAction => {
        const location = parseLocation(subAction.ActionInvokeLocation);
        if (globalState.leftControls[userId]) {
            globalState.leftControls[userId].position.set(location.x, location.y, location.z);

            const euler = new THREE.Euler(
                THREE.MathUtils.degToRad(location.pitch),
                THREE.MathUtils.degToRad(location.yaw),
                THREE.MathUtils.degToRad(location.roll),
                'ZXY'
            );
            globalState.leftControls[userId].setRotationFromEuler(euler);
            // console.log(`Avatar updated for user ${userId + 1} at timestamp ${subAction.Timestamp}: Position(${location.x}, ${location.y}, ${location.z})`);
        }
    });

    if (allSubActions.length === 0) {
        // console.log('No suitable navigation actions found for user', userField, 'within the time range:', globalState.lineTimeStamp1, globalState.lineTimeStamp2);
    }
}

function updateRightControl(userId) {
    // console.log("Update right process initiated for user", userId);

    // User field mapping: Assuming User field in JSON like "User1", "User2"
    const userField = `User${userId + 1}`; // Adjusting userId to match "User1" for index 0

    const navigateActions = globalState.finalData.filter(action =>
        action.Name === 'Move Hand' &&
        action.TriggerSource === 'XRHand_R' &&
        action.User === userField
    );
    // console.log(`Filtered ${navigateActions.length} navigate right actions for user ${userField}.`);

    // Filter subActions that fall within the specified time range
    const allSubActions = [];
    navigateActions.forEach(action => {
        action.Data.forEach(subAction => {
            const invokeTime = parseTimeToMillis(subAction.ActionInvokeTimestamp);
            if (invokeTime >= globalState.lineTimeStamp1 && invokeTime <= globalState.lineTimeStamp2) {
                allSubActions.push({
                    parentAction: action,
                    ...subAction,
                    Timestamp: invokeTime // Converted to milliseconds
                });
            }
        });
    });

    // Sort subActions by Timestamp to process them in chronological order
    allSubActions.sort((a, b) => a.Timestamp - b.Timestamp);

    // console.log(`Processing ${allSubActions.length} sub-actions within range for user ${userField}.`);
    allSubActions.forEach(subAction => {
        const location = parseLocation(subAction.ActionInvokeLocation);
        if (globalState.rightControls[userId]) {
            globalState.rightControls[userId].position.set(location.x, location.y, location.z);
            const euler = new THREE.Euler(
                THREE.MathUtils.degToRad(location.pitch),
                THREE.MathUtils.degToRad(location.yaw),
                THREE.MathUtils.degToRad(location.roll),
                'ZXY'
            );
            globalState.rightControls[userId].setRotationFromEuler(euler);
            // console.log(`Avatar updated for user ${userId + 1} at timestamp ${subAction.Timestamp}: Position(${location.x}, ${location.y}, ${location.z})`);
        }
    });

    if (allSubActions.length === 0) {
        // console.log('No suitable navigation actions found for user', userField, 'within the time range:', globalState.lineTimeStamp1, globalState.lineTimeStamp2);
    }
}




function updatePointCloudBasedOnSelections() {
    const data = globalState.finalData;
    // const selectedActions = getSelectedTopics();

    const newFilteredActions = new Set();
    const filteredActions = data.filter(action => {
        // selectedActions.includes(action.Name) &&
        return action.Data.some(subAction => {
            const actionStartTime = parseTimeToMillis(subAction.ActionInvokeTimestamp);
            const actionEndTime = actionStartTime + parseDurationToMillis(action.Duration);
            if (actionEndTime >= globalState.lineTimeStamp1 && actionStartTime <= globalState.lineTimeStamp2 && subAction.ActionContext) {
                newFilteredActions.add(`${subAction.ActionContext}`);
                return true;
            }
            return false;
        });
    });

    // Remove objects that are no longer relevant
    Object.keys(globalState.loadedClouds).forEach(key => {
        const obj = globalState.scene.getObjectByName(key);
        if (obj && !newFilteredActions.has(key)) {
            globalState.scene.remove(obj);
            delete globalState.loadedClouds[key];
            // console.log(`Removed object: ${key}`);
        }
    });

    // Load new and keep existing relevant objects
    for (const action of filteredActions) {
        for (const subAction of action.Data) {
            if (subAction.ActionContext !== null && !globalState.loadedClouds[subAction.ActionContext]) {
                const obj = loadAvatarModel(subAction.ActionContext);
                obj.name = subAction.ActionContext; // Ensure each object has a unique name
                globalState.loadedClouds[subAction.ActionContext] = obj; // Track the loaded object
                // console.log(`Loaded new object: ${subAction.ActionContext}`);
            }
        }
    }
}

async function updateObjectsBasedOnSelections() {
    const data = globalState.finalData;

    const newFilteredActions = new Set();
    const actionsToLoad = [];
	const selectedActions = getSelectedTopics();
	// console.log(selectedActions);

    // Gather all actions that meet the time range and have not been loaded yet

	const selectedUsers = Object.keys(globalState.show)
	.filter(userID => globalState.show[userID])
	.map(userID => `User${userID}`);

    for (const action of data) {
        for (const subAction of action.Data) {
            const actionStartTime = parseTimeToMillis(subAction.ActionInvokeTimestamp);
            const actionEndTime = actionStartTime + parseDurationToMillis(action.Duration);
            if (actionEndTime >= globalState.lineTimeStamp1 && actionStartTime <= globalState.lineTimeStamp2 
				&& subAction.ActionReferentBody && action.ReferentType === "Virtual"
				&& selectedActions.includes(action.Name) && selectedUsers.includes(action.User)) {
                const key = `${subAction.ActionInvokeTimestamp}_${subAction.ActionReferentBody}`;
                if (!newFilteredActions.has(key)){ 
					// && !globalState.loadedObjects[key]) {
                    newFilteredActions.add(key);
                    actionsToLoad.push({ key, subAction }); 
                }
            }
        }
    }

    // Unload objects that are no longer needed
    for (const key of Object.keys(globalState.loadedObjects)) {
        if (!newFilteredActions.has(key) && globalState.loadedObjects[key]) {
            const obj = await globalState.loadedObjects[key];  // Ensure the object is fully loaded
            if (obj && obj.parent) { // Check if the object is still part of the scene
                if (obj.geometry) obj.geometry.dispose(); // Dispose resources
                if (obj.material) obj.material.dispose();
                globalState.scene.remove(obj);
                delete globalState.loadedObjects[key];
                // console.log(`Object removed from scene and state: ${key}`);
            }
        }
    }

    // Load new objects that are required
    for (const { key, subAction } of actionsToLoad) {
        if (!globalState.loadedObjects[key]) { // Double check to prevent race conditions
            // console.log(`Loading new object: ${key}`);
            globalState.loadedObjects[key] = loadAvatarModel(subAction.ActionReferentBody)
                .then(obj => {
                    obj.name = key;
                    const location = parseLocation(subAction.ActionReferentLocation);
                    obj.position.set(location.x, location.y, location.z);
                    // const euler = new THREE.Euler(
                    //     THREE.MathUtils.degToRad(location.eulerx),
                    //     THREE.MathUtils.degToRad(location.eulery),
                    //     THREE.MathUtils.degToRad(location.eulerz),
                    //     'ZXY'
                    // );
                    // obj.setRotationFromEuler(euler);
                    globalState.scene.add(obj);
                    // console.log(`Object loaded and added to scene: ${key}`);
                    return obj; // Return the loaded object
                })
                .catch(error => {
                    // console.error(`Failed to load object ${key}:`, error);
                    delete globalState.loadedObjects[key]; // Clean up state on failure
                });
        }
    }
}

function parseLocation(locationString) {
    const parts = locationString.split(',');
    if (parts.length !== 6) {
        console.error('Invalid location format:', locationString);
        return null;
    }
    return {
        x: -parseFloat(parts[0]),
        y: parseFloat(parts[1]),
        z: parseFloat(parts[2]),
        pitch: -parseFloat(parts[3]),  // Rotation around X-axis in degrees
        yaw: parseFloat(parts[4]),    // Rotation around Y-axis in degrees
        roll: parseFloat(parts[5])    // Rotation around Z-axis in degrees
    };
}


async function initializeScene() {
	globalState.scene = new THREE.Scene();
	// globalState.scene.background = new THREE.Color(0xffffff);
	globalState.scene.background = new THREE.Color(0x808080);
	const spatialView = document.getElementById('spatial-view');
	globalState.camera = new THREE.PerspectiveCamera(40, spatialView.innerWidth / spatialView.innerHeight, 0.1, 1000);
	globalState.camera.position.set(1, 3, 7);
	// globalState.camera.updateProjectionMatrix();

	globalState.renderer = new THREE.WebGLRenderer({
	  antialias: true
	});


	globalState.renderer.setSize(spatialView.width, spatialView.height);
	globalState.renderer.toneMapping = THREE.LinearToneMapping;
	// globalState.renderer.toneMappingExposure = 0.01;

	document.getElementById('spatial-view').appendChild(globalState.renderer.domElement);


	globalState.controls = new OrbitControls(globalState.camera, globalState.renderer.domElement);
	globalState.controls.enableZoom = true;

	const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
	globalState.scene.add(ambientLight);
	const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
	directionalLight.position.set(0, 1, 0);
	globalState.scene.add(directionalLight);

	globalState.controls.update();

	const gridHelper = new THREE.GridHelper(10, 10);
	gridHelper.position.y = -1;
	globalState.scene.add(gridHelper);
	// await Promise.all([loadRoomModel()]);

  	const finalData = await Promise.all([
		fetch('Processed_Log_EXR_InfoVisCollab.json').then(response => response.json()),
		  ]);
  globalState.finalData = finalData[0];
  updateNumUsers();
  window_onload();
  const avatarPromises = Array.from({ length: numUsers }, () => loadAvatarModel('ipad.glb'));

  // Resolve all promises to load the avatars
  globalState.avatars = await Promise.all(avatarPromises);
  
  // Assuming you only need one pair of right and left controls
//   globalState.rightControls = await Promise.all([
// 	  loadHand("hand_r.glb")
//   ]);
  
//   globalState.leftControls = await Promise.all([
// 	  loadHand("hand_l.glb")
//   ]);

	setTimes(globalState.finalData);

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

function findClosestDataEntry(data, targetTimestamp) {
    if (data.length === 0) return null;
    return data.reduce((prev, curr) => {
        const currTimestamp = parseTimeToMillis(curr.Timestamp);
        const prevTimestamp = parseTimeToMillis(prev.Timestamp);
        const targetTime = parseTimeToMillis(targetTimestamp);
        return (Math.abs(currTimestamp - targetTime) < Math.abs(prevTimestamp - targetTime) ? curr : prev);
    });
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

function createPlotTemporal() {

	const topicsData = globalState.finalData.map(action => {
        if (action.Data.length > 0) {
            const firstEvent = action.Data[0]; // Always using the first event
            const startTimeMillis = parseTimeToMillis(firstEvent.ActionInvokeTimestamp);
            const endTimeMillis = startTimeMillis + parseDurationToMillis(action.Duration);
            return {
                topic: action.Name, // Using 'Name' to identify the type of action
                startTime: startTimeMillis,
                endTime: endTimeMillis,
                isUserInterest: false, // Placeholder for now
                hasUserInterestAction: false // Placeholder for now
            };
        }
    }).filter(action => action !== undefined && action.startTime && action.endTime);


    const temporalViewContainer = d3.select("#temporal-view");
    const width = (document.getElementById('spatial-view').clientWidth - margin.left - margin.right) * 0.9;
    // const height = document.getElementById('temporal-view').clientHeight - margin.top - margin.bottom;
	const height = 220;
    const speechPlotSvg = d3.select("#speech-plot-container");
	speechPlotSvg.html("");
	const svg = speechPlotSvg.append('svg')
        .attr("width", globalState.dynamicWidth + margin.left + margin.right)
        .attr('height', margin.top + margin.bottom + height)
        .append('g')
        .attr('transform', `translate(${margin.left}, ${margin.top})`);

    // X scale for time
    const x = d3.scaleTime()
        .domain([d3.min(topicsData, d => d.startTime), d3.max(topicsData, d => d.endTime)])
        .range([0, width]);

    // Y scale for user actions
    const yScale = d3.scaleBand()
        .domain(topicsData.map(d => d.topic))
        .rangeRound([0, height])
        .padding(0.1);

    // Append the Y-axis
    svg.append("g")
        .attr("class", "axis axis--y")
        .call(d3.axisLeft(yScale));

	// Calculate density
    const densityData = topicsData.map(d => {
        const totalDuration = d.endTime - d.startTime;
        const density = totalDuration / (globalState.lineTimeStamp2 - globalState.lineTimeStamp1); // Simplified density calculation
        return { ...d, density };
    });

    // Create color scale for density
    const colorScale = d3.scaleSequential(d3.interpolateBlues) //interpolateBlues //interpolateOranges //interpolatePurples //interpolateGreys //interpolateViridis //interpolateCividis
        .domain([0, d3.max(densityData, d => d.density*0.6)]);

    // Drawing bars for each action with density-based color
    svg.selectAll(".bar")
        .data(densityData)
        .enter().append("rect")
        .attr("class", "bar")
        .attr("x", d => x(d.startTime))
        .attr("y", d => yScale(d.topic) + (yScale.bandwidth() * 0.15)) // Center the bar in the y band
        .attr("width", d => x(d.endTime) - x(d.startTime))
        .attr("height", yScale.bandwidth() * 0.7)
        .attr("fill", d => colorScale(d.density)); // Apply density color

    // Optional: Add mouse event handlers if needed for interactivity
    svg.selectAll(".bar")
        .on("click", function(event, d) {
            showContextMenu(event, d.topic);
        });
}




function showContextMenu(event, topic) {
    console.log(`Context menu for ${topic}`);
}




function setTimes(data) {
	// Assuming data is an array of action records
	let timestamps = [];

	data.forEach(action => {
	  if (action.Data && Array.isArray(action.Data)) {
		action.Data.forEach(subAction => {
		  if (subAction.ActionInvokeTimestamp) {
			timestamps.push(parseTimeToMillis(subAction.ActionInvokeTimestamp));
		  }
		});
	  }
	});
	timestamps.sort((a, b) => a - b);

	const globalStartTime = timestamps[0];
	const globalEndTime = timestamps[timestamps.length - 1];

	console.log("Global Start Time:", new Date(globalStartTime));
	console.log("Global End Time:", new Date(globalEndTime));

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





export function getGlobalState() {
	return globalState;
}

function createLines(timestamp1, timestamp2) {
	const svg = d3.select("#temporal-view");
	// const height = parseInt(svg.style("height")) - margin.top ;
	let height = parseInt(d3.select("#speech-plot-container").style("height")) * 1.1;
	// height = 300;
	// const width = parseInt(svg.style("width")) - margin.right - margin.left;
  const dynamicWidth = globalState.dynamicWidth;
  // const width = globalState.dynamicWidth;
	const y1 = 55;
  const alignX = 10 ;
	// let xPosition1 = Math.max(0, Math.min(x(new Date(timestamp1)), width)) + margin.left + alignX;
	// console.log("xpos1 " + xPosition1);
	// let xPosition2 = Math.max(0, Math.min(x(new Date(timestamp2)), width)) + margin.left + alignX ;
	// console.log("xpos2 " +  xPosition2);

  let xPosition1 = Math.max(0, x(new Date(timestamp1))) + margin.left + alignX;
  let xPosition2 = Math.max(0, x(new Date(timestamp2))) + margin.left + alignX;
//   const dragContainmentArea = { left: margin.left + alignX, right: dynamicWidth + margin.left - alignX };

	let circle1 = svg.select('#time-indicator-circle1');
	circle1.attr('class', 'interactive');
	if (circle1.empty()) {
		circle1 = svg.append('circle')
			.attr('id', 'time-indicator-circle1')
			.attr('r', 5)
			.style('fill', '#9e9e9e');
	}

	let circle2 = svg.select('#time-indicator-circle2');
	circle2.attr('class', 'interactive');
	if (circle2.empty()) {
		circle2 = svg.append('circle')
			.attr('id', 'time-indicator-circle2')
			.attr('r', 5)
			.style('fill', '#9e9e9e');
	}


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
		.style('stroke', '#9e9e9e')
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
		.style('stroke', '#9e9e9e')
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
	// updateXRSnapshot();
	for (let i = 0; i < numUsers; i++) {
        // console.log(`Updating devices for user ${i + 1}.`);
        updateUserDevice(i);
        updateLeftControl(i);
        updateRightControl(i);
    }
	// createDeviceSegment(1);
	// createControllerSegment(0, 'right');
	// createControllerSegment(0, 'left');
	// createControllerSegment(1, 'right');
	// createControllerSegment(1, 'left');
	// createRayCastSegment(0);
	// createRayCastSegment(1);
	// createLineDrawing(0);
	// createLineDrawing(1);
	updatePointCloudBasedOnSelections();
	updateObjectsBasedOnSelections();
	initializeShadedAreaDrag();


}



export function dragged(event,d) {
	const svgElement = document.querySelector("#temporal-view svg");
	const container = document.getElementById("temporal-view");
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
	// console.log("setting posoitons.." + newXPosition);

	d3.select(this).attr('x1', newXPosition + margin.left).attr('x2', newXPosition + margin.left);
	d3.select(circleId).attr('cx', newXPosition + margin.left);


    createLines(globalState.lineTimeStamp1, globalState.lineTimeStamp2);
    // updateTimeDisplay(newTimestamp, globalState.globalStartTime);
    const timeStamp1 = new Date(globalState.lineTimeStamp1);
    const timeStamp2 = globalState.lineTimeStamp2;
    updateRangeDisplay(timeStamp1, timeStamp2);
	// updateXRSnapshot();

    initializeOrUpdateSpeechBox();
	
	updatePointCloudBasedOnSelections();
	updateObjectsBasedOnSelections();
	for (let i = 0; i < numUsers; i++) {

        // Update the user's device
        updateUserDevice(i);
        updateLeftControl(i);
        updateRightControl(i);
    }
	// createRayCastSegment(0);
	// createRayCastSegment(1);
	// createLineDrawing(0);
	// createLineDrawing(1);
    initializeShadedAreaDrag();

    // // console.log('Dragging Event Ended');
}

//updates the numUsers as soon as on log read
function updateNumUsers(){
	const uniqueUsers = new Set(globalState.finalData.map(action => action.User));
	numUsers = uniqueUsers.size;
	updateGlobalShow();
}

//Update global show, 0 index is not used
function updateGlobalShow(){
	globalState.show = Array(numUsers+1).fill(true);
}

function initHierToolBar(){
	const data = globalState.finalData;
	const uniqueActions = new Set();

	const toolbar = document.getElementById('hier-toolbar');
    toolbar.innerHTML = '';

    // Process each action directly, considering nested timestamps
    data.forEach(action => {
        action.Data.forEach(subAction => {
            uniqueActions.add(action.Name); // Use 'Name' to identify the type of action
        });
    });

    // console.log(Array.from(uniqueActions)); // To see what actions are included

    // Create toolbar items for each unique action name
    uniqueActions.forEach(actionName => {
        createTopicItem(actionName, toolbar);
    });

}

//Keep only in the actionNames enabled and rest desabled and by default enabled ones will be checked
function enableCheckboxes(actionNames, shouldCheck = true) {
    // Get all checkboxes with the class 'topic-checkbox'
    const allCheckboxes = document.querySelectorAll('.topic-checkbox');

    allCheckboxes.forEach(checkbox => {
        const actionName = checkbox.value;
        if (actionNames.includes(actionName)) {
            checkbox.disabled = false; // Enable the checkbox
            checkbox.checked = shouldCheck; // Check or uncheck based on the parameter
			// console.log("$$$ enabled: ", actionName);
        } else {
            checkbox.disabled = true; // Disable checkboxes not in the list
            checkbox.checked = false; // Optionally uncheck them as well
			// console.log("$$$ disabled : ", actionName);
        }
    });
}

function generateHierToolBar() {
    const data = globalState.finalData; // Assuming this is an array of action records

    const uniqueActions = new Set();

    // Process each action directly, considering nested timestamps
    data.forEach(action => {
        action.Data.forEach(subAction => {
            const actionStartTime = parseTimeToMillis(subAction.ActionInvokeTimestamp);
            const actionEndTime = actionStartTime + parseDurationToMillis(action.Duration);
            if (actionEndTime >= globalState.lineTimeStamp1 && actionStartTime <= globalState.lineTimeStamp2) {
                uniqueActions.add(action.Name); // Use 'Name' to identify the type of action
            }
        });
    });

	enableCheckboxes([...uniqueActions], true); // enable and checked in the uniqueActions
}

// create the actual checkbox HTML elemets
function createTopicItem(actionName, toolbar,  isEnabled = false) {
    const topicItem = document.createElement('li');
    const topicCheckbox = document.createElement('input');
    topicCheckbox.type = 'checkbox';
    topicCheckbox.id = `checkbox_broadtopic_${actionName.replace(/\s+/g, '_')}`;
    topicCheckbox.className = 'topic-checkbox';
	topicCheckbox.value = actionName;

	// Set the checkbox enabled or disabled based on the `isEnabled` parameter
    topicCheckbox.disabled = !isEnabled;

    const label = document.createElement('label');
    label.htmlFor = topicCheckbox.id;
    label.textContent = actionName;
    label.style.color = '#000'; // Default color, adjust as needed

    topicItem.appendChild(topicCheckbox);
    topicItem.appendChild(label);
    toolbar.appendChild(topicItem);

    // Event listener for the checkbox
    topicCheckbox.addEventListener('change', function() {
        if (this.checked) {
            // Handle the checked state, e.g., filter actions, highlight elements, etc.
            // console.log(`${actionName} is selected`);
        } else {
            // Handle the unchecked state
            // console.log(`${actionName} is deselected`);
        }
		initializeOrUpdateSpeechBox();
		plotUserSpecificBarChart();
		plotUserSpecificDurationBarChart();
		updatePointCloudBasedOnSelections();
		updateObjectsBasedOnSelections();
    });

}

function generateUserLegends(){
	const legendContainer = document.getElementById('user-legend-container');

    for (let i = 1; i <= numUsers; i++) {
        const userLegendItem = document.createElement('div');
        userLegendItem.className = 'user-legend-item';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'legend-checkbox';
        checkbox.id = `toggle-user${i}`;
        checkbox.name = 'userVisibility';
        checkbox.checked = true;

        const legendSquare = document.createElement('div');
        legendSquare.className = 'legend-square';
        legendSquare.style.backgroundColor = colorScale(`User${i}`);

        const label = document.createElement('label');
        label.htmlFor = `toggle-user${i}`;
        label.textContent = `User ${i}`;

        userLegendItem.appendChild(checkbox);
        userLegendItem.appendChild(legendSquare);
        userLegendItem.appendChild(label);

        legendContainer.appendChild(userLegendItem);
	}
}

function plotUserSpecificBarChart() {
	const plotBox = d3.select("#plot-box1").html("");
	const margin = { top: 30, right: 20, bottom: 40, left: 70 };
	const width = plotBox.node().getBoundingClientRect().width - margin.left - margin.right;
	// const height = 500 - margin.top - margin.bottom;
	const height = plotBox.node().getBoundingClientRect().height - margin.top - margin.bottom;

	const svg = plotBox.append("svg")
		.attr("width", width + margin.left + margin.right)
		.attr("height", height + margin.top + margin.bottom)
		.append("g")
		.attr("transform", "translate(" + margin.left + "," + margin.top + ")");

	// Add plot title
    svg.append("text")
        .attr("x", width / 2)
        // .attr("y", 0 - margin.top / 2)
        .attr("y", -4)
        .attr("text-anchor", "middle")
        .style("font-size", "16px")
        .style("font-family", "Lato")
        .style("font-weight", "bold")
        .text("User-Specific Actions Bar Chart");

	// Assuming globalState.finalData.action_dict exists and is structured appropriately
	let allUsers = new Set();
	let userDataByAction = {};

	// Get selected users and actions from checkboxes
	const selectedUsers = Object.keys(globalState.show)
	.filter(userID => globalState.show[userID])
	.map(userID => `User${userID}`);
	const selectedActions = getSelectedTopics();

	// Filter and process data based on selected checkboxes
	globalState.finalData
		.filter(action => selectedActions.includes(action.Name) && selectedUsers.includes(action.User))
		.forEach(action => {
			const actorName = action.User;
			const actionName = action.Name;

			if (!userDataByAction[actionName]) {
				userDataByAction[actionName] = {};
			}

			userDataByAction[actionName][actorName] = (userDataByAction[actionName][actorName] || 0) + 1;
			allUsers.add(actorName);
		});

	const users = Array.from(allUsers).sort((a, b) => {
		// Sort by user names; this will put "User1" before "User2"
		return a.localeCompare(b);
	});
	const processedData = Object.entries(userDataByAction).map(([actionName, counts]) => ({
		actionName,
		...counts
	}));

	// Setup scales
	const maxBandwidth = 120; // Example max bandwidth; adjust as needed
	const x0 = d3.scaleBand()
		.rangeRound([0, width])
		.paddingInner(0.1)
		.domain(processedData.map(d => d.actionName))
		.paddingOuter(0.1) // Add some outer padding to visually balance the plot
		.align(0.1); // Center-align the scale

	const x1 = d3.scaleBand()
		.padding(0.05)
		.domain(users)
		.rangeRound([0, Math.min(x0.bandwidth(), maxBandwidth)]); // Cap the bandwidth

	const y = d3.scaleLinear()
		.domain([0, d3.max(processedData, d => Math.max(...users.map(user => d[user] || 0)))])
		.nice()
		.range([height, 0]);

	const color = colorScale;

	// Create the grouped bars
	const action = svg.selectAll(".action")
		.data(processedData)
		.enter().append("g")
		.attr("class", "g")
		// .attr("transform", d => `translate(${x0(d.actionName)},0)`);
		.attr("transform", d => `translate(${x0(d.actionName) + x0.bandwidth() / 2 - x1.bandwidth() * users.length / 2},0)`);

	action.selectAll("rect")
		.data(d => users.map(key => ({ key, value: d[key] || 0 })))
		.enter().append("rect")
		.attr("width", d => Math.min(x1.bandwidth(), 40))
		.attr("x", d => x1(d.key))
		.attr("y", d => y(d.value))
		.attr("height", d => height - y(d.value))
		.attr("fill", d => colorScale(d.key))
		.on("mouseover", function(event, d) {
			d3.select(this)
				.transition()
				.duration(100)
				.attr("fill", d3.rgb(colorScale(d.key)).darker(2)); // Darken the color on hover

			tooltip.style("visibility", "visible")
				.text(`${d.key}: ${d.value}`)
				.style("left", `${event.pageX + 5}px`)
				.style("top", `${event.pageY - 28}px`);
		})
		.on("mouseout", function(event, d) {
			d3.select(this)
				.transition()
				.duration(100)
				.attr("fill", colorScale(d.key)); // Revert to original color on mouse out

			tooltip.style("visibility", "hidden");
		});

	// Add the axes
	svg.append("g")
		.attr("class", "axis")
		.attr("transform", `translate(0,${height})`)
		.call(d3.axisBottom(x0))
		.selectAll("text")
		.style("text-anchor", "end")
		.attr("dx", "2em")
		.attr("dy", ".25em")
		// .attr("transform", "rotate(-30)")
		.style("font-size", "1.2em");

	svg.append("g")
		.call(d3.axisLeft(y).ticks(5))
		.selectAll(".tick text") // Select all tick texts
		.style("font-family", "Lato")
		.style("font-size", "1.2em");

		svg.append("text")
		.attr("transform", "rotate(-90)")
		.attr("y", 0 - margin.left)
		.attr("x", 0 - (height / 2))
		.attr("dy", "1em")
		.style("text-anchor", "middle")
		.text("Action Count")
		.style("font-size", "0.8em");

	// Add a legend
	const legend = svg.selectAll(".legend")
	.data(users)
	.enter().append("g")
	.attr("class", "legend")
	.attr("transform", (d, i) => `translate(0, ${i * 20})`);

	legend.append("rect")
	.attr("x", width - 18)
	.attr("width", 18)
	.attr("height", 18)
	.style("fill", colorScale);

	legend.append("text")
	.attr("x", width - 24)
	.attr("y", 9)
	.attr("dy", ".35em")
	.style("text-anchor", "end")
	.text(d => d)
	.style("font-size", "0.7em");

	// Tooltip for interactivity
	const tooltip = d3.select("body").append("div")
	.attr("class", "d3-tooltip")
	.style("position", "absolute")
	.style("z-index", "1000") // Set a high z-index to ensure visibility
	.style("text-align", "center")
	.style("width", "auto")
	.style("height", "auto")
	.style("padding", "8px")
	.style("font", "12px sans-serif")
	.style("background", "lightsteelblue")
	.style("border", "0px")
	.style("border-radius", "8px")
	.style("pointer-events", "none")
	.style("visibility", "hidden");
}

function plotUserSpecificDurationBarChart() {
    const plotBox = d3.select("#plot-box2").html("");
    const margin = { top: 30, right: 20, bottom: 40, left: 70 };
    const width = plotBox.node().getBoundingClientRect().width - margin.left - margin.right;
    const height = plotBox.node().getBoundingClientRect().height - margin.top - margin.bottom;

    const svg = plotBox.append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    // Add plot title
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", -4)
        .attr("text-anchor", "middle")
        .style("font-size", "16px")
        .style("font-family", "Lato")
        .style("font-weight", "bold")
        .text("User-Specific Action Durations");

    let allUsers = new Set();
    let userDurationByAction = {};

    // Get selected users and actions from checkboxes
    const selectedUsers = Object.keys(globalState.show)
        .filter(userID => globalState.show[userID])
        .map(userID => `User${userID}`);
    const selectedActions = getSelectedTopics();

    // Filter and process data based on selected checkboxes
    globalState.finalData
        .filter(action => selectedActions.includes(action.Name) && selectedUsers.includes(action.User))
        .forEach(action => {
            const actorName = action.User;
            const actionName = action.Name;
            const duration = parseDurationToMillis(action.Duration);

            if (!userDurationByAction[actionName]) {
                userDurationByAction[actionName] = {};
            }

            userDurationByAction[actionName][actorName] = (userDurationByAction[actionName][actorName] || 0) + duration;
            allUsers.add(actorName);
        });

	const users = Array.from(allUsers).sort((a, b) => {
		return a.localeCompare(b);
	});
    const processedData = Object.entries(userDurationByAction).map(([actionName, durations]) => ({
        actionName,
        ...durations
    }));

    // Determine the maximum duration to decide the scale
    const maxDuration = d3.max(processedData, d => Math.max(...users.map(user => d[user] || 0)));
    let yLabel = "Total Duration (ms)";
    let yScaleFactor = 1;  // Default to milliseconds

    if (maxDuration > 9000) {
        yLabel = "Total Duration (s)";
        yScaleFactor = 1000;  // Convert milliseconds to seconds
    }

    // Setup scales
    const maxBandwidth = 120; // Example max bandwidth; adjust as needed
    const x0 = d3.scaleBand()
        .rangeRound([0, width])
        .paddingInner(0.1)
        .domain(processedData.map(d => d.actionName))
        .paddingOuter(0.1) // Add some outer padding to visually balance the plot
        .align(0.1); // Center-align the scale

    const x1 = d3.scaleBand()
        .padding(0.05)
        .domain(users)
        .rangeRound([0, Math.min(x0.bandwidth(), maxBandwidth)]); // Cap the bandwidth

    const y = d3.scaleLinear()
        .domain([0, maxDuration / yScaleFactor])
        .nice()
        .range([height, 0]);

    const color = colorScale;

    // Create the grouped bars
    const action = svg.selectAll(".action")
        .data(processedData)
        .enter().append("g")
        .attr("class", "g")
        .attr("transform", d => `translate(${x0(d.actionName) + x0.bandwidth() / 2 - x1.bandwidth() * users.length / 2},0)`);

    action.selectAll("rect")
        .data(d => users.map(key => ({ key, value: d[key] || 0 })))
        .enter().append("rect")
        .attr("width", d => Math.min(x1.bandwidth(), 40))
        .attr("x", d => x1(d.key))
        .attr("y", d => y(d.value / yScaleFactor))
        .attr("height", d => height - y(d.value / yScaleFactor))
        .attr("fill", d => colorScale(d.key))
        .on("mouseover", function(event, d) {
            d3.select(this)
                .transition()
                .duration(100)
                .attr("fill", d3.rgb(colorScale(d.key)).darker(2)); // Darken the color on hover

            tooltip.style("visibility", "visible")
                .text(`${d.key}: ${(d.value / yScaleFactor).toFixed(2)} ${yScaleFactor === 1000 ? 's' : 'ms'}`)
                .style("left", `${event.pageX + 5}px`)
                .style("top", `${event.pageY - 28}px`);
        })
        .on("mouseout", function(event, d) {
            d3.select(this)
                .transition()
                .duration(100)
                .attr("fill", colorScale(d.key)); // Revert to original color on mouse out

            tooltip.style("visibility", "hidden");
        });

    // Add the axes
    svg.append("g")
        .attr("class", "axis")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x0))
        .selectAll("text")
        .style("text-anchor", "end")
        .attr("dx", "2em")
        .attr("dy", ".25em")
        .style("font-size", "1.2em");

    svg.append("g")
        .call(d3.axisLeft(y).ticks(5))
        .selectAll(".tick text") // Select all tick texts
        .style("font-family", "Lato")
        .style("font-size", "1.2em");

    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 0 - margin.left)
        .attr("x", 0 - (height / 2))
        .attr("dy", "1em")
        .style("text-anchor", "middle")
        .text(yLabel)
        .style("font-size", "0.8em");

    // Add a legend
    const legend = svg.selectAll(".legend")
        .data(users)
        .enter().append("g")
        .attr("class", "legend")
        .attr("transform", (d, i) => `translate(0, ${i * 20})`);

    legend.append("rect")
        .attr("x", width - 18)
        .attr("width", 18)
        .attr("height", 18)
        .style("fill", colorScale);

    legend.append("text")
        .attr("x", width - 24)
        .attr("y", 9)
        .attr("dy", ".35em")
        .style("text-anchor", "end")
        .text(d => d)
        .style("font-size", "0.7em");

    // Tooltip for interactivity
    const tooltip = d3.select("body").append("div")
        .attr("class", "d3-tooltip")
        .style("position", "absolute")
        .style("z-index", "1000")
        .style("text-align", "center")
        .style("width", "auto")
        .style("height", "auto")
        .style("padding", "8px")
        .style("font", "12px sans-serif")
        .style("background", "lightsteelblue")
        .style("border", "0px")
        .style("border-radius", "8px")
        .style("pointer-events", "none")
        .style("visibility", "hidden");
}

function plotLLMData(){
	d3.json('final_insight_data.json').then(function(data) {
        // Initial display and filter creation
	//const insightsData = { /* your JSON data here */ };
	createAnalysisFilter(data);
	displayInsights(data);
    }).catch(function(error) {
        console.error('Error loading JSON data:', error);
    });
}

function displayInsights(insightsData) {
    const insightsContainer = document.getElementById('insights-container'); // Updated to target insights-container
    insightsContainer.innerHTML = ''; // Clear previous insights, not filters

    Object.keys(insightsData).forEach(key => {
        const insight = insightsData[key];
        const insightBox = document.createElement('div');
        insightBox.className = 'insight-box';

        // Create topic element
        const topicElement = document.createElement('h4');
        topicElement.textContent = insight.topic;
        topicElement.className = 'insight-topic';

        // Create insight element
        const insightElement = document.createElement('p');
        insightElement.textContent = insight.insight;
        insightElement.className = 'insight-content';

        insightBox.appendChild(topicElement);
        insightBox.appendChild(insightElement);
        insightsContainer.appendChild(insightBox);
    });
}

function createAnalysisFilter(insightsData) {
    const filterContainer = document.getElementById('analysis-filter-container'); // Now targets only the filter container
    filterContainer.innerHTML = ''; // Clear any existing filters

    const analysisSet = new Set();
    Object.keys(insightsData).forEach(key => {
        insightsData[key].analyses.forEach(analysis => analysisSet.add(analysis));
    });

    analysisSet.forEach(analysis => {
        const filterTag = document.createElement('button');
        filterTag.textContent = analysis;
        filterTag.className = 'filter-tag active';
        filterTag.addEventListener('click', function() {
            this.classList.toggle('active'); // Toggle active class on click
            applyFilter(insightsData);
        });
        filterContainer.appendChild(filterTag);
    });
}

function applyFilter(insightsData) {
    const activeFilters = Array.from(document.querySelectorAll('.filter-tag.active')).map(tag => tag.textContent);

    if (activeFilters.length === 0) {
        displayInsights(insightsData);
    } else {
        const filteredData = {};
        Object.keys(insightsData).forEach(key => {
            const insight = insightsData[key];
            if (activeFilters.some(filter => insight.analyses.includes(filter))) {
                filteredData[key] = insight;
            }
        });
        displayInsights(filteredData);
    }
}

function getSelectedTopics() {
    const topicCheckboxes = document.querySelectorAll('.topic-checkbox:checked');
    // console.log(`Found ${topicCheckboxes.length} checked checkboxes.`);  // Debug how many checkboxes are found
    let selectedActions = [];

    topicCheckboxes.forEach(checkbox => {
        if (!checkbox.disabled) {  // Only include enabled checkboxes
            selectedActions.push(checkbox.value);
        }
    });

    return selectedActions;
}



function getCoordinates(spatial_extent){
	const x = spatial_extent[0][2]; // UNITY Z
    const y = spatial_extent[0][1];
    const z = -spatial_extent[0][0]; // Flippinh UNITY X
	// console.log(x,y,z);
	return {x,y,z} ;
  }



function parseTimeToMillis(customString) {
  // console.log(" here with " + customString);
  let [dateStr, timeStr, milliStr] = customString.split('_');

  // Further split into year, month, day, hours, minutes, seconds
  let year = parseInt(dateStr.slice(0, 2), 10) + 2000; // Assuming '24' is 2024
  let month = parseInt(dateStr.slice(2, 4), 10) - 1; // Month is 0-indexed in JS
  let day = parseInt(dateStr.slice(4, 6), 10);

//   let hours = parseInt(timeStr.slice(0, 2), 10);
  let hours = parseInt(timeStr.slice(0, 2), 10) + 4 ;
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

//   let milliseconds = parseInt(milliStr.slice(0, 3), 10);

//   // Create a new Date object in UTC using the parsed components
//   let date = new Date(Date.UTC(year, month, day, hours, minutes, seconds, milliseconds));

//   // Return the time in milliseconds since the Unix epoch
//   return date.getTime();
}



function parseDurationToMillis(durationString) {
    // Split the string by underscores
    const parts = durationString.split('_');

    // Extract the hours, minutes, seconds, and microseconds from the string
    const hours = parseInt(parts[1].slice(0, 2), 10);
    const minutes = parseInt(parts[1].slice(2, 4), 10);
    const seconds = parseInt(parts[1].slice(4, 6), 10);
    const microseconds = parseInt(parts[2], 10);

    // Convert the extracted time parts to milliseconds
    const totalMillis = (hours * 60 * 60 * 1000) + (minutes * 60 * 1000) + (seconds * 1000) + (microseconds / 1000);

    return totalMillis;
}



function initializeOrUpdateSpeechBox() {
    // Use selected action names from the toolbar
    const selectedActions = getSelectedTopics(); // Assumes this returns action names selected in the toolbar
    const data = globalState.finalData; // Assuming this is an array with all action records

	//mits
	const visibleUserIDs = Object.keys(globalState.show).filter(userID => globalState.show[userID]); //asuming 1->user 1 and 2-> user 2

    const container = document.getElementById("speech-box");
    const hierToolbar = document.getElementById('hier-toolbar');
    let offsetHeight = hierToolbar.offsetHeight;
    container.style.top = `${offsetHeight}px`;

    let speechBoxesContainer = document.getElementById("speech-boxes-container");
    if (!speechBoxesContainer) {
        speechBoxesContainer = document.createElement('div');
        speechBoxesContainer.id = "speech-boxes-container";
        container.appendChild(speechBoxesContainer);
    } else {
        speechBoxesContainer.innerHTML = ''; // Clear previous entries
    }

    const timeFormat = d3.timeFormat("%b %d %I:%M:%S %p");
    let rangeDisplay = document.querySelector('.time-range-display-speechbox');
    if (!rangeDisplay) {
        rangeDisplay = document.createElement('div');
        rangeDisplay.className = 'time-range-display-speechbox';
        container.appendChild(rangeDisplay);
    }
    rangeDisplay.innerHTML = `<strong>Selected Time Range: ${timeFormat(new Date(globalState.lineTimeStamp1))} - ${timeFormat(new Date(globalState.lineTimeStamp2))}</strong>`;

	// Filter data based on selected actions, time range, and visible user IDs

	//mits: added filtering on users
	let actionsToDisplay = data.filter(action => {
		// Check if the action name includes any of the visible user IDs
		const hasVisibleUserID = visibleUserIDs.some(userID => action.User.includes(userID));

		return hasVisibleUserID && selectedActions.includes(action.Name) && action.Data.some(subAction => {
			const actionStartTime = parseTimeToMillis(subAction.ActionInvokeTimestamp);
			const actionEndTime = actionStartTime + parseDurationToMillis(action.Duration);
			return actionEndTime >= globalState.lineTimeStamp1 && actionStartTime <= globalState.lineTimeStamp2;
		});
	});

    // Display each action in the speech box
    actionsToDisplay.forEach(action => {
        action.Data.forEach(subAction => {
            const speechBox = createSpeechBox(action, subAction);
            if (speechBox) {
                speechBoxesContainer.appendChild(speechBox);
            }
        });
    });
}

function formatLocation(locationString) {
    const location = parseLocation(locationString);

    if (!location) {
        return `<strong>Location:</strong><br>${formattedLocation}`;
    }

    const position = `${location.x.toFixed(3)}, ${location.y.toFixed(3)}, ${location.z.toFixed(3)}`;
    const orientation = `${location.pitch.toFixed(3)}, ${location.yaw.toFixed(3)}, ${location.roll.toFixed(3)}`;

    return `
        <strong>Position (X, Y, Z):</strong> ${position}<br>
        <strong>Orientation (Pitch, Yaw, Roll):</strong> ${orientation}
    `;
}

function createSpeechBox(action, subAction) {

	plotLLMData();
    const speechBox = document.createElement('div');
    speechBox.className = 'speech-box';


    // Create a container for title and user label
    const titleContainer = document.createElement('div');
    titleContainer.style.display = 'flex';
    titleContainer.style.justifyContent = 'space-between';
    titleContainer.style.alignItems = 'center';
    titleContainer.style.marginBottom = '10px';

    // Format the action and type string
    const title = document.createElement('h4');
    title.textContent = `Action: ${action.Name}`;// | Type: ${action.Type}`;
    title.style.margin = '0'; // Remove margin for better alignment
	title.style.marginLeft = '10px'

    // Get the background color for the user
    const userColor = colorScale(action.User); // Default to gray if user is not in the mapping

    // Create user label
    const userLabel = document.createElement('div');
    userLabel.textContent = action.User;
    userLabel.className = 'user-label';
    userLabel.style.backgroundColor = userColor;
    userLabel.style.padding = '5px 10px';
    userLabel.style.borderRadius = '5px';
    userLabel.style.color = 'white';

    // Position the user label to the right
    userLabel.style.marginLeft = 'auto'; // Pushes userLabel to the right

    // Append the title and user label to the container
    titleContainer.appendChild(title);
    titleContainer.appendChild(userLabel);

    // Append the container to the speech box
    speechBox.appendChild(titleContainer);

    // Format Location as Position (X, Y, Z) and Orientation (Roll, Pitch, Yaw)
    const locationString = subAction.ActionInvokeLocation;
    const formattedLocation = formatLocation(locationString);

	// <strong>Location:</strong> ${subAction.ActionInvokeLocation}<br>
	// <strong>Location:</strong><br>${formattedLocation}<br>

    // Adding more detailed information
    const details = document.createElement('div');
	// Highlight the Intent field
    const intentDiv = document.createElement('div');
    intentDiv.style.backgroundColor = '#8bb6d9';  // Cool Mint for highlighting
    intentDiv.style.color = 'white';
    intentDiv.style.padding = '4px';
    intentDiv.style.borderRadius = '5px';
    intentDiv.style.fontSize = '1em';
    intentDiv.style.borderRadius = '8px';
    intentDiv.innerHTML = `<strong>Intent:</strong> ${action.Intent}`;

    const otherDetails = `
        ${formattedLocation}<br>
        <strong>Timestamp:</strong> ${new Date(parseTimeToMillis(subAction.ActionInvokeTimestamp)).toLocaleString()}<br>
        <strong>Duration:</strong> ${parseDurationToMillis(action.Duration)} ms<br>
        <strong>Trigger Source:</strong> ${action.TriggerSource}<br>
        <strong>Referent Name:</strong> ${subAction.ActionReferentName || 'N/A'}<br>
    `;
	details.appendChild(intentDiv);
    details.innerHTML += otherDetails;

    speechBox.appendChild(details);

    return speechBox;
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
		.attr("fill", "#9e9e9e")
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
		const dx = event.x - dragStartX;
		const line1 = indicatorSVG.select("#time-indicator-line1");
		const line2 = indicatorSVG.select("#time-indicator-line2");
		const circle1 = indicatorSVG.select("#time-indicator-circle1");
		const circle2 = indicatorSVG.select("#time-indicator-circle2");


		let line1X = parseFloat(line1.attr("x1")) + dx;
		let line2X = parseFloat(line2.attr("x1")) + dx;

		line1.attr("x1", line1X).attr("x2", line1X);
		line2.attr("x1", line2X).attr("x2", line2X);
		circle1.attr("cx", line1X);
		circle2.attr("cx", line2X);

	  const newLine1Timestamp = x.invert(line1X - buffer).getTime();
	  const newLine2Timestamp = x.invert(line2X - buffer).getTime();
	  globalState.lineTimeStamp1 = newLine1Timestamp;
	  globalState.lineTimeStamp2 = newLine2Timestamp;

	  updateRangeDisplay(newLine1Timestamp, newLine2Timestamp);
	//   updateXRSnapshot();
	//   createLineSegment(0);
	//   createLineSegment(1);

	//   createDeviceSegment(0);

	for (let i = 0; i < numUsers; i++) {
        updateUserDevice(i);
        updateLeftControl(i);
        updateRightControl(i);
    }
	//   createControllerSegment(0, 'right');
	//   createControllerSegment(0, 'left');
	//   createControllerSegment(1, 'right');
	//   createControllerSegment(1, 'left');

	// createRayCastSegment(0);
	// createRayCastSegment(1);
	// createLineDrawing(0);
	// createLineDrawing(1);
	
	
	updatePointCloudBasedOnSelections();
	updateObjectsBasedOnSelections();


	  dragStartX = event.x;
	};

	const dragended = () => {
		generateHierToolBar();
		plotUserSpecificBarChart();
		plotUserSpecificDurationBarChart();
		updateObjectsBasedOnSelections();
	};

	const drag = d3.drag()
	  .on("start", dragstarted)
	  .on("drag", dragged)
	  .on("end", dragended);

	shadedArea.call(drag);
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

function createSharedAxis() {
	const { globalStartTime, globalEndTime, bins, unit } = globalState;
	// console.log(new Date(globalStartTime));
	// console.log(new Date(globalEndTime));

	// Container setup
	const temporalViewContainer = d3.select("#temporal-view");
	// const minWidth = document.getElementById('temporal-view').clientWidth;
	const minWidth = document.getElementById('temporal-view').clientWidth - margin.right - margin.left;
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

  function initializeInteraction() {
    var raycaster = new THREE.Raycaster();
    var mouse = new THREE.Vector2();
    var isDragging = false;

    // Set up event listeners on the renderer's DOM element
    globalState.renderer.domElement.addEventListener('mousedown', function() {
        isDragging = false;
    }, false);

    globalState.renderer.domElement.addEventListener('mousemove', function() {
        isDragging = true;
    }, false);

    globalState.renderer.domElement.addEventListener('mouseup', function(event) {
        if (!isDragging) {
            // Normalize mouse position on click
            mouse.x = (event.clientX / globalState.renderer.domElement.clientWidth) * 2 - 1;
            mouse.y = -(event.clientY / globalState.renderer.domElement.clientHeight) * 2 + 1;

            raycaster.setFromCamera(mouse, globalState.camera);

            // Ensure globalState.triangleMesh arrays are initialized and iterable
            // let interactiveObjects = (globalState.triangleMesh[0] || []).concat(globalState.triangleMesh[1] || []);
			if (globalState.triangleMesh[0] && globalState.triangleMesh[1])
			{

				let interactiveObjects = [...globalState.triangleMesh[0], ...globalState.triangleMesh[1]];
				var intersects = raycaster.intersectObjects(interactiveObjects, true);
				console.log(intersects);
				var clickableIntersects = intersects.filter(intersect => intersect.object.userData.type === 'clickableTriangle');

				if (clickableIntersects.length > 0) {
					console.log('Clicked on triangle:', clickableIntersects[0].object.userData.actorName);
					// Handle the click event here
					}
			}
		}

        isDragging = false; // Reset the flag
    }, false);
}


// camera.updateProjectionMatrix();

function onWindowResize() {
	const spatialView = document.getElementById('spatial-view');
	globalState.camera.aspect = spatialView.clientWidth / spatialView.clientHeight;
	globalState.camera.updateProjectionMatrix();
	globalState.renderer.setSize(spatialView.clientWidth, spatialView.clientHeight);
}
async function initialize() {
	await initializeScene();
	const binsDropdown = document.getElementById('binsDropdown');
	globalState.bins = binsDropdown.value;

	createSharedAxis();
	createPlotTemporal();
	initHierToolBar();
	generateHierToolBar();

	createLines(globalState.lineTimeStamp1, globalState.lineTimeStamp2);


	document.querySelectorAll('.topic-checkbox').forEach(checkbox => {
	  checkbox.checked = true;
	  checkbox.dispatchEvent(new Event('change'));
	});
	// updateInterestBox();
	initializeOrUpdateSpeechBox();
	
	updatePointCloudBasedOnSelections();
	updateObjectsBasedOnSelections();
	plotUserSpecificBarChart();
	plotUserSpecificDurationBarChart();
}
initialize();
globalState.camera.updateProjectionMatrix();
initializeInteraction();

onWindowResize();
// window.addEventListener('resize', onWindowResize, false);


function animate() {
	// console.log("hello?");
	initializeInteraction();
	// console.log("Hello again");
	requestAnimationFrame(animate);
	// console.log("BAZINGA");
	globalState.controls.update();
	// console.log(globalState.camera.position);
	globalState.renderer.render(globalState.scene, globalState.camera);
}
export function getScene() {
	return scene;
}
animate();;