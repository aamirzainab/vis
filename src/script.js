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
let speechEnabled = false;
let xrInteractionEnabled = false;
let noneEnabled = true;
let numUsers = 3;
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
	show: Array(numUsers).fill(true),
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
	scene2: undefined,
	camera2:undefined,
	renderer2:undefined,
	controls2:undefined,
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
    .domain(["User_1", "User_2", "User_3", "0", "1", "2"])
    .range(["#8dd3c7", "#fdcdac", "#bebada", "#8dd3c7", "#fdcdac", "#bebada"]);

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



export function updateIntervals() {
  createSharedAxis();
  createLines(globalState.lineTimeStamp1, globalState.lineTimeStamp2);
  generateHierToolBar();
  createPlotTemporal();
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
	avatar.scale.set(0.25, 0.25, 0.25);
	avatar.name = filename;
	globalState.scene.add(avatar);
	avatarLoaded = true;
	return avatar;
}

async function loadLine(filename,id) {
	const loader = new GLTFLoader();
	const gltf = await loader.loadAsync(filename);
	const avatar = gltf.scene;
	avatar.scale.set(1, 1, 1);
	avatar.name = filename;
	globalState.scene.add(avatar);
	avatarLoaded = true;
	globalState.lineDrawing[id].push(avatar.name);
	// console.log(globalState)
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
window.onload = function() {
	document.getElementById('toggle-user0').addEventListener('change', function() {
		const userID = 0 ;
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
			if (globalState.avatars[userID]) {
				globalState.avatars[userID].visible = true ;
			}
			if (globalState.rightControls[userID]) {
				globalState.rightControls[userID].visible = true ;
			}
			if (globalState.leftControls[userID]) {
				globalState.leftControls[userID].visible = true ;
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

			if (globalState.avatars[userID]) {
				globalState.avatars[userID].visible = false ;
			}
			if (globalState.rightControls[userID]) {
				globalState.rightControls[userID].visible = false ;
			}
			if (globalState.leftControls[userID]) {
				globalState.leftControls[userID].visible = false ;
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
	});

	document.getElementById('toggle-user1').addEventListener('change', function() {

		const userID = 1 ;
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
			if (globalState.avatars[userID]) {
				globalState.avatars[userID].visible = true ;
			}
			if (globalState.rightControls[userID]) {
				globalState.rightControls[userID].visible = true ;
			}
			if (globalState.leftControls[userID]) {
				globalState.leftControls[userID].visible = true ;
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
					// globalState.scene.add(existingObject);
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

			if (globalState.avatars[userID]) {
				globalState.avatars[userID].visible = false ;
			}
			if (globalState.rightControls[userID]) {
				globalState.rightControls[userID].visible = false ;
			}
			if (globalState.leftControls[userID]) {
				globalState.leftControls[userID].visible = false ;
			}
			if (globalState.raycastLines[userID]) {
				globalState.raycastLines[userID].forEach(mesh => {
						globalState.scene.remove(mesh);
				});
			}
			if (globalState.lineDrawing[userID]) {
				globalState.lineDrawing[0].forEach(filename => {
					const existingObject = globalState.scene.getObjectByName(filename);
					if (existingObject) {
						existingObject.visible = false ;
					  }
					// globalState.scene.remove(existingObject);
				});
			}
		}
	});


	const playPauseButton = document.getElementById('playPauseButton');
	const playPauseButtonHeight = playPauseButton.offsetHeight;
	const timeDisplay = document.getElementById('timeDisplay');
	timeDisplay.style.top = (playPauseButton.offsetTop - playPauseButtonHeight) + 'px';

};





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
			// updateVisualization(nextTimestamp, index);
			// updateVisualizationOcculus(nextTimestamp);
		});

		updateTimeDisplay(nextTimestamp, globalStartTime);
		// animateTemporalView(nextTimestamp);
		createLines(globalState.lineTimeStamp1, globalState.lineTimeStamp2);

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

function createDeviceSegment(id){
	const userID = "User_" + (id + 1 ) ;
	const avatar = globalState.avatars[id];
	console.log()
	const linewidth = 7;
	// const data = globalState.finalData;
	const data = globalState.finalData.action_dict["User Transformation"].actions;
	  const filteredData = data.filter(action => {
		  const actionStartTime = parseTimeToMillis(action.start_time);
		  const actionEndTime = parseTimeToMillis(action.end_time);
		  return action.action_type === "Transformation" &&
				 action.formatted_data.action_property_specific_action === "PhysicalXRDisplay Transformation" &&
		   action.actor_name == userID &&
				 actionEndTime >= globalState.lineTimeStamp1 && actionStartTime <= globalState.lineTimeStamp2;
	  });

	if (filteredData.length !== 0) {
	  filteredData.forEach(entry => {
		const spatialExent = entry.spatial_extent;
		const {x,y,z} = getCoordinates(spatialExent);
		avatar.position.x = x ;
		avatar.position.y = y ;
		avatar.position.z = z ;
		const euler = new THREE.Euler(THREE.MathUtils.degToRad(spatialExent[1][0]), THREE.MathUtils.degToRad(spatialExent[1][1]), THREE.MathUtils.degToRad(spatialExent[1][2]), 'XYZ');
		avatar.rotation.set(0, 0, 0);
		avatar.setRotationFromEuler(euler);
	  });
	  }
	}


function createControllerSegment(id, rightOrLeft){
	const userID = "User_" + (id + 1 ) ;
	let avatar = rightOrLeft === "right" ? globalState.rightControls[id] : globalState.leftControls[id];

	const data = globalState.finalData.action_dict["User Transformation"].actions;

	const filteredData = data.filter(action => {
		const actionStartTime = parseTimeToMillis(action.start_time);
		const actionEndTime = parseTimeToMillis(action.end_time);
		return action.action_type === "Transformation" &&
				action.formatted_data.action_property_specific_action ===  (rightOrLeft === "right" ? "PhysicalXRController_R Transformation" : "PhysicalXRController_L Transformation")
				&& action.actor_name == userID &&
				actionEndTime >= globalState.lineTimeStamp1 && actionStartTime <= globalState.lineTimeStamp2;
	});

	if (filteredData.length !== 0) {
		filteredData.forEach(entry => {
			const spatialExtent = entry.spatial_extent;
			const {x, y, z} = getCoordinates(spatialExtent);
			// console.log(spatialExtent);
			avatar.position.x = x;
			avatar.position.y = y;
			avatar.position.z = z;
			const euler = new THREE.Euler(THREE.MathUtils.degToRad(entry.spatial_extent[1][0]), THREE.MathUtils.degToRad(entry.spatial_extent[1][1]), THREE.MathUtils.degToRad(entry.spatial_extent[1][2]), 'XYZ');
			avatar.rotation.set(0, 0, 0);
			avatar.setRotationFromEuler(euler);
		});
	}
}

function createRayCastSegment(id) {
		const lineMaterial = new THREE.LineBasicMaterial({ color: 0xff0000 });
		if (!globalState.raycastLines[id]) {
			globalState.raycastLines[id] = [];
		}
		if (globalState.raycastLines[0]) {
			globalState.raycastLines[0].forEach(mesh => {
				globalState.scene.remove(mesh);
			});
			globalState.raycastLines[0] = [];
		}
		if (globalState.raycastLines[1]) {
			globalState.raycastLines[1].forEach(mesh => {
				globalState.scene.remove(mesh);
			});
			globalState.raycastLines[1] = [];
		}


		Object.values(globalState.finalData.action_dict).forEach(topic => {
			topic.actions.filter(action => {
				const actionStartTime = parseTimeToMillis(action.start_time);
				const actionEndTime = parseTimeToMillis(action.end_time);
				// Object selection
				return action.formatted_data.action_property_specific_action === "Object selection" &&
					   actionEndTime >= globalState.lineTimeStamp1 &&
					   actionStartTime <= globalState.lineTimeStamp2 ;
			}).forEach(action => {

				const raycastPosition = action.specific_action_data;
				const x = raycastPosition[2];
				const y = raycastPosition[1];
				const z = -raycastPosition[0];


				let match = action.actor_name.match(/\d+/);
				let id = match ? parseInt(match[0], 10) - 1 : null;

				const userAvatar = globalState.leftControls[id]
				if (!userAvatar) return;

				const points = [
					new THREE.Vector3(userAvatar.position.x, userAvatar.position.y, userAvatar.position.z),
					new THREE.Vector3(x, y,z)
				];
				const geometry = new THREE.BufferGeometry().setFromPoints(points);
				const line = new THREE.Line(geometry, lineMaterial);

				globalState.scene.add(line);
				globalState.raycastLines[id].push(line);

			});
		});
	}


function createLineDrawing(id) {
		if (!globalState.lineDrawing[0]) {
			globalState.lineDrawing[0] = [];
		}
		if (!globalState.lineDrawing[1]) {
			globalState.lineDrawing[1] = [];
		}
		if (globalState.lineDrawing[0]) {
			globalState.lineDrawing[0].forEach(filename => {
				const existingObject = globalState.scene.getObjectByName(filename);
				if (existingObject) {
					existingObject.visible = false ;
				  }
				globalState.scene.remove(existingObject);
			});

		}
		globalState.lineDrawing[0] = [];
		if (globalState.lineDrawing[1]) {
			globalState.lineDrawing[1].forEach(filename => {
				const existingObject = globalState.scene.getObjectByName(filename);
				if (existingObject) {
					existingObject.visible = false ;
				  }
				globalState.scene.remove(existingObject);
			});
		}
			globalState.lineDrawing[1] = [];


		Object.values(globalState.finalData.action_dict).forEach(topic => {
			topic.actions.filter(action => {
				const actionStartTime = parseTimeToMillis(action.start_time);
				const actionEndTime = parseTimeToMillis(action.end_time);
				return action.formatted_data.action_property_specific_action === "Line drawing" &&
						actionEndTime >= globalState.lineTimeStamp1 &&
						actionStartTime <= globalState.lineTimeStamp2 &&
						action.specific_action_data;
			}).forEach(action => {
				const glbPath = action.actor_name + '\\Object\\' + action.specific_action_data;
				const avatar = loadLine(glbPath,id);

			});
		});
	}

// function createLineSegment(id){
//     const geometry = new LineGeometry();
//     const positions = [];
//     const colors = [];

// 	const userID = "User_" + (id + 1 ) ;
// 	// console.log(id);
// 	// console.log(userID)
//     let colorShade = colorScale(String(id));
// 	// console.log(colorShade);
// 	// console.log(colorShade);
//     let baseColor = new THREE.Color(colorShade);
//     const linewidth = 7; // Adjust as necessary
//     baseColor.getHSL(hsl);
// 	const data = globalState.finalData.action_dict["User Transformation"].actions;
//     // Filter actions for the specific transformation and within the time range
//     const filteredData = data.filter(action => {
//         const actionStartTime = parseTimeToMillis(action.start_time);
//         const actionEndTime = parseTimeToMillis(action.end_time);
//         return action.action_type === "Transformation" &&
//                action.formatted_data.action_property_specific_action === "PhysicalXRDisplay Transformation" &&
// 			   action.actor_name == userID &&
//                actionEndTime >= globalState.lineTimeStamp1 && actionStartTime <= globalState.lineTimeStamp2;
//     });

// 	if (globalState.currentLineSegments[id]) {
//         globalState.scene.remove(globalState.currentLineSegments[id]);
//         globalState.currentLineSegments[id] = null;
//     }

//     // Assuming a method to interpret or mock spatial data from raw_log_text
// 	if (filteredData.length !== 0) {
// 		filteredData.forEach(entry => {
// 			const spatialExent = entry.spatial_extent;
// 			const {x,y,z} = getCoordinates(spatialExent);
// 			positions.push(x, y, z);
// 			const color = new THREE.Color().setHSL(hsl.h, hsl.s, 1);
// 			colors.push(color.r, color.g, color.b);
// 		});
// 		geometry.setPositions(positions.flat());
// 		geometry.setColors(colors);

// 		let material = new LineMaterial({
// 			linewidth: linewidth,
// 			color: baseColor,
// 			opacity: 1,
// 			transparent: true,
// 			linewidth: linewidth,
// 			resolution: new THREE.Vector2(window.innerWidth, window.innerHeight) // Ensure the resolution is set for proper rendering
// 		});

// 		const line = new Line2(geometry, material);
// 			globalState.scene.add(line);
// 		globalState.currentLineSegments[id] = line;

// 		return line;
// 	}
// }
function clearPreviousTriangles(id) {
if (globalState.triangleMesh[id]) {
	globalState.triangleMesh[id].forEach(mesh => {
		globalState.scene.remove(mesh);
	});
	globalState.triangleMesh[id] = []; // Reset the array for this user
}
}


function updateSceneBasedOnSelections() {
    const data = globalState.finalData; // Assuming this holds the full data
    const selectedActions = getSelectedTopics(); // Get the selected topics from the toolbar

    // Filter actions based on time range and selected actions
    const filteredActions = data.filter(action => {
        const actionStartTime = parseTimeToMillis(action.Timestamp);
        const actionEndTime = actionStartTime + parseDurationToMillis(action.Duration);
        return actionEndTime >= globalState.lineTimeStamp1 &&
               actionStartTime <= globalState.lineTimeStamp2; 
			//     &&
            //    selectedActions.includes(action.UserAction);
    });

    // Load virtual objects based on the filtered actions
    filteredActions.forEach(action => {
        if (action.ActionReferentType === "Virtual") {
            const filePath = `Context/${action.ActionReferent}`; // Path adjustment for context-related files
            const location = parseLocation(action.Location); // Extract and format location for rendering
			console.log(filePath); 
            // Load and render the virtual object at the specified location
            loadVirtualObject(filePath, location);
        }
    });
}


function updatePointCloudBasedOnSelections() {
    const data = globalState.finalData;
    const selectedActions = getSelectedTopics();

    const newFilteredActions = new Set();
    const filteredActions = data.filter(action => {
        return selectedActions.includes(action.Name) && action.Data.some(subAction => {
            const actionStartTime = parseTimeToMillis(subAction.ActionInvokeTimestamp);
            const actionEndTime = actionStartTime + parseDurationToMillis(action.Duration);
            if (actionEndTime >= globalState.lineTimeStamp1 && actionStartTime <= globalState.lineTimeStamp2) {
                newFilteredActions.add(`${action.User}/${subAction.ActionContext}`);
                return true;
            }
            return false;
        });
    });

    // Remove objects that are no longer relevant
    Object.keys(globalState.loadedClouds).forEach(key => {
        if (!newFilteredActions.has(key)) {
            const obj = globalState.loadedClouds[key];
            globalState.scene.remove(obj);
            delete globalState.loadedClouds[key];
            console.log(`Removed object: ${key}`);
        }
    });

    // Load new and keep existing relevant objects
    for (const action of filteredActions) {
        for (const subAction of action.Data) {
            if (action.ContextType === "Virtual" && subAction.ActionContext) {
                const key = `${action.User}/${subAction.ActionContext}`;
                if (!globalState.loadedClouds[key]) {  // Only load if not already loaded
                    const userNumber = action.User.match(/\d+/)[0];
                    const filePath = `user${userNumber}/Context/${subAction.ActionContext}`;
                    const location = parseLocation(subAction.ActionReferentLocation);
                    const obj = loadVirtualObject(filePath, location);
                    globalState.loadedClouds[key] = obj; // Track the loaded object
                    console.log(`Loaded new object: ${key}`);
                }
            }
        }
    }
}


function updateObjectsBasedOnSelections() {
    const data = globalState.finalData;
    const selectedActions = getSelectedTopics();

    const newFilteredActions = new Set();
    const filteredActions = data.filter(action => {
        return selectedActions.includes(action.Name) && action.Data.some(subAction => {
            const actionStartTime = parseTimeToMillis(subAction.ActionInvokeTimestamp);
            const actionEndTime = actionStartTime + parseDurationToMillis(action.Duration);
            if (actionEndTime >= globalState.lineTimeStamp1 && actionStartTime <= globalState.lineTimeStamp2) {
                newFilteredActions.add(`${action.User}/${subAction.ActionContext}`);
                return true;
            }
            return false;
        });
    });

    // Remove objects that are no longer relevant
    Object.keys(globalState.loadedObjects).forEach(key => {
        if (!newFilteredActions.has(key)) {
            const obj = globalState.loadedObjects[key];
            globalState.scene.remove(obj);
            delete globalState.loadedObjects[key];
            console.log(`Removed object: ${key}`);
        }
    });

    // Load new and keep existing relevant objects
    for (const action of filteredActions) {
        for (const subAction of action.Data) {
            if (action.ReferentType === "Virtual" && subAction.ActionReferentBody) {
                const key = `${action.User}/${subAction.ActionReferentBody}`;
                if (!globalState.loadedObjects[key]) {  // Only load if not already loaded
                    const userNumber = action.User.match(/\d+/)[0];
                    const filePath = `user${userNumber}/Object/${subAction.ActionContext}`;
                    const location = parseLocation(subAction.ActionReferentLocation);
                    const obj = loadVirtualObject(filePath, location);
                    globalState.loadedObjects[key] = obj; // Track the loaded object
                    console.log(`Loaded new object: ${key}`);
                }
            }
        }
    }
}


function parseLocation(locationString) {
    const parts = locationString.split(',');
    return {
        x: parseFloat(parts[0]),
        y: parseFloat(parts[1]),
        z: parseFloat(parts[2]),
        pitch: parseFloat(parts[3]),
        yaw: parseFloat(parts[4]),
        roll: parseFloat(parts[5])
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
	
	console.log("here zainab");

	globalState.renderer.setSize(spatialView.width, spatialView.height);
	globalState.renderer.toneMapping = THREE.LinearToneMapping;
	// globalState.renderer.toneMapping = THREE.NoToneMapping;
	globalState.renderer.toneMappingExposure = 1;
	
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
		fetch('Processed_Log_EXR_VR_Game.json').then(response => response.json()),
  ]);
  globalState.finalData = finalData[0];

//   const avatarArray = await Promise.all([
//     loadAvatarModel('oculus_quest_2.glb'),
//     loadAvatarModel('oculus_quest_2.glb'),
// 	loadAvatarModel('oculus_controller_right.glb'),
// 	loadAvatarModel('oculus_controller_right.glb'),
// 	loadAvatarModel('oculus_controller_left.glb'),
// 	loadAvatarModel('oculus_controller_left.glb'),
// 	]);

// 	globalState.avatars = [avatarArray[0], avatarArray[1]];
	// globalState.avatars[0].scale.set(0.5,0.5,0.5);
	// globalState.avatars[1].scale.set(0.5,0.5,0.5);

	// globalState.leftControls = [avatarArray[4], avatarArray[5]];
	// globalState.rightControls = [avatarArray[2], avatarArray[3]];

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

function findClosestDataEntry(data, timestamp) {
	if (data.length === 0) return null;
	return data.reduce((prev, curr) => {
		const currTimestamp = new Date(curr.Timestamp).getTime();
		const prevTimestamp = new Date(prev.Timestamp).getTime();
		return (Math.abs(currTimestamp - timestamp) < Math.abs(prevTimestamp - timestamp) ? curr : prev);
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
    const width = document.getElementById('spatial-view').clientWidth - margin.left - margin.right;
    const height = document.getElementById('temporal-view').clientHeight - margin.top - margin.bottom;
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

    // Drawing bars for each action
    svg.selectAll(".bar")
        .data(topicsData)
        .enter().append("rect")
        .attr("class", "bar")
        .attr("x", d => x(d.startTime))
        .attr("y", d => yScale(d.topic))
        .attr("width", d => x(d.endTime) - x(d.startTime))
        .attr("height", yScale.bandwidth())
        .attr("fill", d => d.hasUserInterestAction ? "#80b1d3" : "#d0d0d0"); // Conditional fill based on user interest

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
				// updateVisualization(timestamp, index);
				// updateVisualizationOcculus(timestamp);
			});
			// animateTemporalView(timestamp);
			createLines(globalState.lineTimeStamp1, globalState.lineTimeStamp2);
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
			// updateVisualization(timestamp, index);
			// updateVisualizationOcculus(timestamp);
		});
		updateTimeDisplay(timestamp, globalState.globalStartTime);
		// animateTemporalView(timestamp);
		createLines(globalState.lineTimeStamp1, globalState.lineTimeStamp2);
	});
}


export function getGlobalState() {
	return globalState;
}

function createLines(timestamp1, timestamp2) {
	const svg = d3.select("#temporal-view");
	// const height = parseInt(svg.style("height")) - margin.top ;
	let height = parseInt(d3.select("#speech-plot-container").style("height"));
	height = 430;
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
	// createLineSegment(0);
	// createLineSegment(1);
	// createDeviceSegment(0);
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
	// updateSceneBasedOnSelections();
	// // initializeShadedAreaDrag();


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
    generateHierToolBar();

    initializeOrUpdateSpeechBox();
	updatePointCloudBasedOnSelections();
    // updateSceneBasedOnSelections();
    // createLineSegment(0);
    // createLineSegment(1);
	// createDeviceSegment(0);
	// createDeviceSegment(1);
	// createControllerSegment(0, 'right');
	// createControllerSegment(0, 'left');
	// createControllerSegment(1, 'right');
	// createControllerSegment(1, 'left');

	// createRayCastSegment(0);
	// createRayCastSegment(1);
	// createLineDrawing(0);
	// createLineDrawing(1);
    initializeShadedAreaDrag();

    // // console.log('Dragging Event Ended');
}

//added: Mits
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
			console.log("$$$ enabled: ", actionName);
        } else {
            checkbox.disabled = true; // Disable checkboxes not in the list
            checkbox.checked = false; // Optionally uncheck them as well
			console.log("$$$ disabled : ", actionName);
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
    });
	updatePointCloudBasedOnSelections();
	// updateSceneBasedOnSelections();
}


function getSelectedTopics() {
    const topicCheckboxes = document.querySelectorAll('.topic-checkbox:checked');
    // console.log(`Found ${topicCheckboxes.length} checked checkboxes.`);  // Debug how many checkboxes are found
    let selectedActions = [];

    topicCheckboxes.forEach(checkbox => {
        // console.log(`Adding action: ${checkbox.value}`);  // Debug what is being added
        selectedActions.push(checkbox.value);
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

    // Filter data based on selected actions and time range
    let actionsToDisplay = data.filter(action => {
        return selectedActions.includes(action.Name) && action.Data.some(subAction => {
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

function createSpeechBox(action, subAction) {
    const speechBox = document.createElement('div');
    speechBox.className = 'speech-box';
    speechBox.style.border = '1px solid grey';
    speechBox.style.borderRadius = '8px';
    speechBox.style.padding = '15px';
    speechBox.style.marginBottom = '8px';
    speechBox.style.marginRight = '8px';
    speechBox.style.marginLeft = '8px';

    // Adding a title for each action
    const title = document.createElement('h4');
    title.textContent = `Action: ${action.Name} - Type: ${action.Type}`;
    speechBox.appendChild(title);

    // Adding more detailed information
    const details = document.createElement('div');
    details.innerHTML = `
        <strong>User:</strong> ${action.User}<br>
        <strong>Intent:</strong> ${action.Intent}<br>
        <strong>Location:</strong> ${subAction.ActionInvokeLocation}<br>
        <strong>Timestamp:</strong> ${Date(parseTimeToMillis(subAction.ActionInvokeTimestamp))}<br>
        <strong>Duration:</strong> ${parseDurationToMillis(action.Duration)}<br>
        <strong>Trigger Source:</strong> ${action.TriggerSource}<br>
        <strong>Referent Type:</strong> ${action.ReferentType}<br>
        <strong>Context Type:</strong> ${action.ContextType}<br>
        <strong>Context Description:</strong> ${action.ActionContextDescription || 'N/A'}<br>
        <strong>Referent Name:</strong> ${subAction.ActionReferentName || 'N/A'}<br>
        <strong>Referent Body:</strong> ${subAction.ActionReferentBody || 'N/A'}
    `;
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
	//   createDeviceSegment(1);
	//   createControllerSegment(0, 'right');
	//   createControllerSegment(0, 'left');
	//   createControllerSegment(1, 'right');
	//   createControllerSegment(1, 'left');

	// createRayCastSegment(0);
	// createRayCastSegment(1);
	// createLineDrawing(0);
	// createLineDrawing(1);
	updatePointCloudBasedOnSelections();
	//   updateSceneBasedOnSelections();
	

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
	initHierToolBar();////mits
	generateHierToolBar();

	createLines(globalState.lineTimeStamp1, globalState.lineTimeStamp2);

	  
	document.querySelectorAll('.topic-checkbox').forEach(checkbox => {
	  checkbox.checked = true;
	  checkbox.dispatchEvent(new Event('change'));
	});
	// updateInterestBox();
	initializeOrUpdateSpeechBox();
	updatePointCloudBasedOnSelections();
	// updateSceneBasedOnSelections();
  }
initialize();
globalState.camera.updateProjectionMatrix();
initializeInteraction();

onWindowResize();
// window.addEventListener('resize', onWindowResize, false);


function animate() {
	initializeInteraction();
	requestAnimationFrame(animate);
	globalState.controls.update();
	// console.log(globalState.camera.position);
	globalState.renderer.render(globalState.scene, globalState.camera);
}
export function getScene() {
	return scene;
}
animate();;