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

let video = false ;


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
	llmInsightData: {},
	heatmaps : [],
	useCase: "",
	logFIlePath: "",
	llmInsightPath: "",
	objFilePath: "",
	viewProps: {},
	obContext: [],
    markers:{},
    isAnimating: false
};


let logMode = {
	vrGame: 0,
	immersiveAnalytics: 0,
	infoVisCollab: 0,
	sceneNavigation: 1,
	maintenance: 0
}

const configData = await Promise.all([
	fetch('config.json').then(response => response.json()),
]);

let selectedLogMode = Object.keys(logMode).find(key => logMode[key] === 1);
globalState.useCase = selectedLogMode;

if (selectedLogMode && configData[0][selectedLogMode]) {
    globalState.logFIlePath = configData[0][selectedLogMode].logFilePath;
    globalState.llmInsightPath = configData[0][selectedLogMode].llmInsightFilePath;
	globalState.objFilePath = configData[0][selectedLogMode].objFilePath;
	globalState.obContext = configData[0][selectedLogMode].obContext;

} else {
    console.log("No valid mode selected or key not found in JSON.");
}

function initializeViewProps() {
	globalState.viewProps = Object.fromEntries(
	  Array.from({ length: numUsers+1 }, (_, i) => [
		`User${i}`,
		Object.fromEntries(globalState.obContext.map(context => [context, false]))
	  ])
	);
  }

const userInterestTopic = "Error, bugs or complaints";

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
    .range(["#76C7C0", "#3B6978", "#264653", "#8dd3c7", "#fdcdac", "#bebada"]);

const opacities = [0.2, 0.4, 0.6, 0.8, 1];

const animationStep = 100;
let roomMesh;
let meshes = [];
let avatars = []
let interactionMeshes = []
let speechMeshes = []


let avatarLoaded = false;
let roomLoaded = false;
let movementPointsMesh;



function toggleAnimation() {
    if (video) {
        globalState.isAnimating = !globalState.isAnimating;
        updatePlayPauseButton();
        if (globalState.isAnimating) {
            animateVisualization();
        }
    }
}
function updatePlayPauseButton() {
    const playIcon = document.getElementById('playIcon');
    const pauseIcon = document.getElementById('pauseIcon');

    if (globalState.isAnimating) {
        playIcon.style.display = 'none';
        pauseIcon.style.display = 'block';
    } else {
        playIcon.style.display = 'block';
        pauseIcon.style.display = 'none';
    }
}
export function updateIntervals() {
  createSharedAxis();
  createLines(globalState.lineTimeStamp1, globalState.lineTimeStamp2);
  generateHierToolBar();
  createPlotTemporal();
  plotUserSpecificBarChart();
  plotUserSpecificDurationBarChart();
  updateObjectsBasedOnSelections();
  plotHeatmap();
  updateMarkersBasedOnSelections();
}

function changeBinSize(newBinSize) {
	const unit = document.querySelector('input[name="unit"]:checked').value;

	var event = new CustomEvent('binSizeChange', {
		detail: { size: newBinSize, unit: unit }
	});
	updateIntervals(newBinSize, unit);
	createPlotTemporal();
	window.dispatchEvent(event);

	callDrawBookmarks(globalState.llmInsightData);
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
async function loadIpadModel(filename) {
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
async function loadHand(filename) {
	const loader = new GLTFLoader();
	const gltf = await loader.loadAsync(filename);
	const avatar = gltf.scene;
	// avatar.rotation.set(0, 0, 0);
	avatar.scale.set(2, 2, 2);
	avatar.name = filename;
	globalState.scene.add(avatar);
	avatarLoaded = true;
	return avatar;
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

			plotHeatmap();
			updatePointCloudBasedOnSelections();
			updateObjectsBasedOnSelections();
            updateMarkersBasedOnSelections();
		});
	}


};
function updateVisualization(nextTimestamp) {
    // Update elements based on the current timestamp
    for (let i = 0; i < numUsers; i++) {
        updateUserDevice(i, nextTimestamp);
        updateLeftControl(i, nextTimestamp);
        updateRightControl(i, nextTimestamp);
    }
}

function updateUserDevice(userId, timestamp = null) {
    const userField = `User${userId + 1}`; // Adjusting userId to match "User1" for index 0
    let deviceType = '';

    // Determine the device type based on the log mode
    if (logMode.vrGame || logMode.immersiveAnalytics) {
        deviceType = 'XRHMD';
    } else if (logMode.infoVisCollab || logMode.infoVisCollab1 || logMode.sceneNavigation || logMode.maintenance) {
        deviceType = 'HandheldARInputDevice';
    } else {
        console.warn('Unsupported log mode.');
        return;
    }

    // Filter actions based on device type and user field
    const navigateActions = globalState.finalData.filter(action =>
        // action.Name === 'Navigate' &&
        action.TriggerSource === deviceType &&
        action.User === userField
    );

    const allSubActions = [];

    // If animating, filter actions by a specific timestamp
    if (globalState.isAnimating && timestamp !== null) {
        navigateActions.forEach(action => {
            action.Data.forEach(subAction => {
                const invokeTime = parseTimeToMillis(subAction.ActionInvokeTimestamp);
                if (invokeTime === timestamp) {  // Match the subAction timestamp with the provided timestamp
                    allSubActions.push({
                        parentAction: action,
                        ...subAction,
                        Timestamp: invokeTime
                    });
                }
            });
        });
    } else {
        // Otherwise, filter actions within a range of timestamps
        navigateActions.forEach(action => {
            action.Data.forEach(subAction => {
                const invokeTime = parseTimeToMillis(subAction.ActionInvokeTimestamp);
                if (invokeTime >= globalState.lineTimeStamp1 && invokeTime <= globalState.lineTimeStamp2) {
                    allSubActions.push({
                        parentAction: action,
                        ...subAction,
                        Timestamp: invokeTime
                    });
                }
            });
        });
    }

    // Sort subActions by Timestamp to process them in chronological order
    allSubActions.sort((a, b) => a.Timestamp - b.Timestamp);

    // Update avatars based on subActions
    allSubActions.forEach(subAction => {
        const location = parseLocation(subAction.ActionInvokeLocation);
        if (globalState.avatars[userId]) {
            globalState.avatars[userId].position.set(location.x, location.y, location.z);
            const euler = new THREE.Euler(
                THREE.MathUtils.degToRad(location.pitch),
                THREE.MathUtils.degToRad(location.yaw),
                THREE.MathUtils.degToRad(location.roll),
                'XYZ'
            );
            globalState.avatars[userId].rotation.set(0,0,0);
            globalState.avatars[userId].setRotationFromEuler(euler);
        }
    });

    // if (allSubActions.length === 0) {
    //     console.log('No suitable navigation actions found for user', userField, 'within the time range or at the specified timestamp.');
    // }
}


function updateLeftControl(userId, timestamp = null) {
    const userField = `User${userId + 1}`; // Adjusting userId to match "User1" for index 0
    let actionName, deviceType;

    // Determine actionName and deviceType based on the log mode
    if (logMode.immersiveAnalytics) {
        actionName = 'Move Hand';
        deviceType = 'XRHand_L';
    } else if (logMode.vrGame) {
        actionName = 'Move Controller';
        deviceType = 'XRController_L';
    } else {
        return; // For other log modes, do nothing
    }

    const navigateActions = globalState.finalData.filter(action =>
        // action.Name === actionName &&
        action.TriggerSource === deviceType &&
        action.User === userField
    );

    const allSubActions = [];

    // If animating, filter actions by a specific timestamp
    if (globalState.isAnimating && timestamp !== null) {
        navigateActions.forEach(action => {
            action.Data.forEach(subAction => {
                const invokeTime = parseTimeToMillis(subAction.ActionInvokeTimestamp);
                if (invokeTime === timestamp) {  // Match the subAction timestamp with the provided timestamp
                    allSubActions.push({
                        parentAction: action,
                        ...subAction,
                        Timestamp: invokeTime
                    });
                }
            });
        });
    } else {
        // Otherwise, filter actions within a range of timestamps
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
    }

    // Sort subActions by Timestamp to process them in chronological order
    allSubActions.sort((a, b) => a.Timestamp - b.Timestamp);

    // Update left controls based on subActions
    allSubActions.forEach(subAction => {
        const location = parseLocation(subAction.ActionInvokeLocation);
        if (globalState.leftControls[userId]) {
            globalState.leftControls[userId].position.set(location.x, location.y, location.z);
            const euler = new THREE.Euler(
                THREE.MathUtils.degToRad(location.pitch),
                THREE.MathUtils.degToRad(location.yaw),
                THREE.MathUtils.degToRad(location.roll),
                'XYZ'
            );
            globalState.leftControls[userId].rotation.set(0,0,0);

            // globalState.rightControls[userId].rotation.set(90,0,0);
            globalState.leftControls[userId].setRotationFromEuler(euler);
        }
    });
    // allSubActions.forEach(subAction => {
    //     const location = parseLocation(subAction.ActionInvokeLocation);
    //     if (globalState.leftControls[userId]) {
    //         globalState.leftControls[userId].position.set(location.x, location.y, location.z);
    //         const euler = new THREE.Euler(
    //             THREE.MathUtils.degToRad(location.pitch),
    //             THREE.MathUtils.degToRad(location.yaw),
    //             THREE.MathUtils.degToRad(location.roll),
    //             'ZXY'
    //         );
    //         globalState.leftControls[userId].setRotationFromEuler(euler);
    //     }
    // });
}

function updateRightControl(userId, timestamp = null) {
    const userField = `User${userId + 1}`; // Adjusting userId to match "User1" for index 0
    let actionName, deviceType;

    // Determine actionName and deviceType based on the log mode
    if (logMode.immersiveAnalytics) {
        actionName = 'Move Hand';
        deviceType = 'XRHand_R';
    } else if (logMode.vrGame) {
        actionName = 'Move Controller';
        deviceType = 'XRController_R';
    } else {
        return; // For other log modes, do nothing
    }

    const navigateActions = globalState.finalData.filter(action =>
        // action.Name === actionName &&
        action.TriggerSource === deviceType &&
        action.User === userField
    );

    const allSubActions = [];

    // If animating, filter actions by a specific timestamp
    if (globalState.isAnimating && timestamp !== null) {
        navigateActions.forEach(action => {
            action.Data.forEach(subAction => {
                const invokeTime = parseTimeToMillis(subAction.ActionInvokeTimestamp);
                if (invokeTime === timestamp) {  // Match the subAction timestamp with the provided timestamp
                    allSubActions.push({
                        parentAction: action,
                        ...subAction,
                        Timestamp: invokeTime
                    });
                }
            });
        });
    } else {
        // Otherwise, filter actions within a range of timestamps
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
    }

    // Sort subActions by Timestamp to process them in chronological order
    allSubActions.sort((a, b) => a.Timestamp - b.Timestamp);

    allSubActions.forEach(subAction => {
        const location = parseLocation(subAction.ActionInvokeLocation);
        if (globalState.rightControls[userId]) {
            globalState.rightControls[userId].position.set(location.x, location.y, location.z);
            const euler = new THREE.Euler(
                THREE.MathUtils.degToRad(location.pitch),
                THREE.MathUtils.degToRad(location.yaw),
                THREE.MathUtils.degToRad(location.roll),
                'XYZ'
            );
            globalState.rightControls[userId].rotation.set(0,0,0);

            globalState.rightControls[userId].setRotationFromEuler(euler);
        }
    });

    // Update right controls based on subActions
    // allSubActions.forEach(subAction => {
    //     const location = parseLocation(subAction.ActionInvokeLocation);
    //     if (globalState.rightControls[userId]) {
    //         globalState.rightControls[userId].position.set(location.x, location.y, location.z);
    //         const euler = new THREE.Euler(
    //             THREE.MathUtils.degToRad(location.pitch),
    //             THREE.MathUtils.degToRad(location.yaw),
    //             THREE.MathUtils.degToRad(location.roll),
    //             'ZXY'
    //         );
    //         globalState.rightControls[userId].setRotationFromEuler(euler);
    //         // globalState.rightControls[userId].setRotationFromAxisAngle(euler);
    //     }
    // });

}





function updatePointCloudBasedOnSelections() {
    const data = globalState.finalData;
    const newFilteredActions = {};
	const hasVisibleUserID = Object.keys(globalState.show)
        .filter((userID) => globalState.show[userID])
        .map((userID) => `User${userID}`);
	const visibleContextUsers = hasVisibleUserID.filter(userId => {
		return userId in globalState.viewProps && globalState.viewProps[userId]["Context"] === true;
	});

	const nonVisibleContextUsers = hasVisibleUserID.filter(userId => {
		return userId in globalState.viewProps && globalState.viewProps[userId]["Context"] === false;
	});
	//remove loadedClouds for selected user not selected context
	nonVisibleContextUsers.forEach((nvcUser) => {
		if(nvcUser in globalState.loadedClouds){
			Object.keys(globalState.loadedClouds[nvcUser]).forEach(key => {
				const obj = globalState.scene.getObjectByName(key);
				console.log('Current objects in scene:', globalState.scene.children.map(child => child.name));

				if (obj) {
					globalState.scene.remove(obj);
					delete globalState.loadedClouds[nvcUser][key];
					console.log(`Removed object: ${key}`);
				}
			});
		}
	});


	// if (hasVisibleUserID.length === 0 || visibleContextUsers.length === 0) {
	// 	return;
	// }

	visibleContextUsers.forEach((vcUser) => {
		newFilteredActions[vcUser] = new Set();
	});

	const filteredActions = data.filter(action => {
		const hasVisibleUserID = visibleContextUsers.some(userID => action.User.includes(userID));
        return hasVisibleUserID && action.Data.some(subAction => {
            const actionStartTime = parseTimeToMillis(subAction.ActionInvokeTimestamp);
            const actionEndTime = actionStartTime + parseDurationToMillis(action.Duration);

            if (actionEndTime >= globalState.lineTimeStamp1 && actionStartTime <= globalState.lineTimeStamp2 && subAction.ActionContext) {
                //const adjustedPath = `${globalState.objFilePath}${subAction.ActionContext}`;
                newFilteredActions[action.User].add(`${globalState.objFilePath}${subAction.ActionContext}`);
                return true;
            }
            return false;
        });
    });

    // Remove objects that are no longer relevant
    Object.keys(globalState.loadedClouds).forEach(userId => {
		Object.keys(globalState.loadedClouds[userId]).forEach(key => {
			const obj = globalState.scene.getObjectByName(key);
			if (obj && !newFilteredActions[userId].has(key)) {
				globalState.scene.remove(obj);
				delete globalState.loadedClouds[userId][key];
				// console.log(`Removed object: ${key}`);
			}
		});
    });
    if (hasVisibleUserID.length === 0 || visibleContextUsers.length === 0) {
		return;
	}

    // Load new and keep existing relevant objects
    for (const action of filteredActions) {
        for (const subAction of action.Data) {
            if (subAction.ActionContext !== null && globalState.loadedClouds?.[action.User]?.[subAction.ActionContext] === undefined
                && subAction.ActionInvokeLocation !== null )  {
				const adjustedPath = `${globalState.objFilePath}${subAction.ActionContext}`;

                if (globalState.loadedClouds[action.User] === undefined) {
                    globalState.loadedClouds[action.User] = {};
                }
                if (!globalState.loadedClouds[action.User].hasOwnProperty(adjustedPath))
               {

                globalState.loadedClouds[action.User][adjustedPath] = loadAvatarModel(adjustedPath)
                .then(obj => {
                    obj.name = adjustedPath;
                    globalState.scene.add(obj);
                    return obj;
                })
                .catch(error => {
                    console.error(`Failed to load object` +  error);
                    delete globalState.loadedClouds[action.User][adjustedPath];
                });
            }
            }
        }
    }
}
async function updateMarkersBasedOnSelections() {
    const data = globalState.finalData;  // The source data containing all actions
    const newFilteredActions = {};  // Object to keep track of filtered actions for each user
    const selectedActions = getSelectedTopics();  // Get the list of selected topics or actions

    // Determine which users have objects to display
    const selectedUsers = Object.keys(globalState.show)
        .filter(userID => globalState.show[userID])
        .map(userID => `User${userID}`);

    const visibleObjectUsers = selectedUsers.filter(userId => {
        return userId in globalState.viewProps && globalState.viewProps[userId]["Object"] === true;
    });

    // Initialize filtered actions for visible users
    visibleObjectUsers.forEach((vcUser) => {
        newFilteredActions[vcUser] = [];
    });

    // Filter actions based on time range and other criteria
    for (const action of data) {
        for (const subAction of action.Data) {
            const actionStartTime = parseTimeToMillis(subAction.ActionInvokeTimestamp);
            const actionEndTime = actionStartTime + parseDurationToMillis(action.Duration); // Use `action.Duration` instead of `subAction.Duration`

            if (
                actionEndTime >= globalState.lineTimeStamp1 &&
                actionStartTime <= globalState.lineTimeStamp2 &&
                selectedActions.includes(action.Name) &&
                visibleObjectUsers.includes(action.User)
            ) {
                // Add action and subAction details to the filtered actions
                newFilteredActions[action.User].push({ subAction, action });
            }
        }
    }

    // Unload markers that are no longer needed
    for (const userID of Object.keys(globalState.markers || {})) {
        for (const key of Object.keys(globalState.markers[userID] || {})) {
            const markerExists = newFilteredActions[userID]?.some(filteredAction => {
                const { subAction } = filteredAction;
                const keyForCheck = `${subAction.ActionInvokeTimestamp}_${subAction.ActionReferentLocation}`;
                return keyForCheck === key;
            });

            if (!markerExists) {
                const marker = globalState.markers[userID][key];
                if (marker) {
                    globalState.scene.remove(marker);  // Remove the marker from the scene
                    marker.geometry.dispose();  // Dispose of the geometry
                    marker.material.dispose();  // Dispose of the material
                    delete globalState.markers[userID][key];  // Remove from global state
                }
            }
        }
    }

    // Place new markers for filtered actions
    for (const userID of Object.keys(newFilteredActions)) {
        newFilteredActions[userID].forEach(({ subAction, action }) => {
            const key = `${subAction.ActionInvokeTimestamp}_${subAction.ActionReferentLocation}`;

            if (!globalState.markers) globalState.markers = {};
            if (!globalState.markers[userID]) globalState.markers[userID] = {};

            if (!globalState.markers[userID][key]) {  // Ensure the marker is not already created
                const location = parseLocation(subAction.ActionInvokeLocation);  // Use the actual data to find location

                // Create a triangular marker
                const marker = createTriangleMarker(userID);
                marker.position.set(location.x, location.y, location.z);
                marker.name = `Marker_${key}`;
                globalState.scene.add(marker);  // Add marker to the scene

                // Store marker in globalState for later management
                globalState.markers[userID][key] = marker;
            }
        });
    }
}

function createTriangleMarker(userID) {
    const triangleShape = new THREE.Shape();
    triangleShape.moveTo(0, -0.05);  // Bottom vertex (now pointing downwards)
    triangleShape.lineTo(-0.05, 0.05);  // Top left vertex
    triangleShape.lineTo(0.05, 0.05);  // Top right vertex
    triangleShape.lineTo(0, -0.05);  // Close the triangle
    const extrudeSettings = { depth: 0.01, bevelEnabled: false };
    const triangleGeometry = new THREE.ExtrudeGeometry(triangleShape, extrudeSettings);

    // Material for the triangle marker
    const markerMaterial = new THREE.MeshBasicMaterial({ color: colorScale(userID) });  // Customize marker color here

    return new THREE.Mesh(triangleGeometry, markerMaterial);
}




async function updateObjectsBasedOnSelections() {
    const data = globalState.finalData;
	const newFilteredActions = {};
    const actionsToLoad = {};
	const selectedActions = getSelectedTopics();

    // Gather all actions that meet the time range and have not been loaded yet

	const selectedUsers = Object.keys(globalState.show)
	.filter(userID => globalState.show[userID])
	.map(userID => `User${userID}`);

	const visibleObjectUsers = selectedUsers.filter(userId => {
		return userId in globalState.viewProps && globalState.viewProps[userId]["Object"] === true;
	});

	const nonVisibleObjectUsers = selectedUsers.filter(userId => {
		return userId in globalState.viewProps && globalState.viewProps[userId]["Object"] === false;
	});

	//remove loadedObjects for selected user not selected object
	for (const nvoUser of nonVisibleObjectUsers) {
		if(nvoUser in globalState.loadedObjects){
			for (const key of Object.keys(globalState.loadedObjects[nvoUser])) {
				if (globalState.loadedObjects[nvoUser][key]) {
                    try {
                        const obj = await globalState.loadedObjects[nvoUser][key]; // Ensure the object is fully loaded

                        // Iteratively remove all instances of the object from the scene
                        while (obj && obj.parent) { // Check if the object is still part of the scene
                            if (obj.geometry) obj.geometry.dispose(); // Dispose resources
                            if (obj.material) obj.material.dispose();
                            globalState.scene.remove(obj);

                            // After removing, check if the object still has a parent (i.e., still in the scene)
                            // If yes, continue removing it
                        }

                        // Once all instances are removed, delete from loaded objects
                        delete globalState.loadedObjects[nvoUser][key];
                        // console.log(`All instances of object removed from scene and state: ${key}`);
                    } catch (error) {
                        console.error(`Error removing object ${key}:`, error);
                    }
				}
			}
		}
	}

	// if (selectedUsers.length === 0 || visibleObjectUsers.length === 0) {
	// 	return;
	// }

	visibleObjectUsers.forEach((vcUser) => {
		newFilteredActions[vcUser] = new Set();
		actionsToLoad[vcUser] = [];
	});

    for (const action of data) {
        for (const subAction of action.Data) {
            const actionStartTime = parseTimeToMillis(subAction.ActionInvokeTimestamp);
            const actionEndTime = actionStartTime + parseDurationToMillis(action.Duration);
            if (actionEndTime >= globalState.lineTimeStamp1 && actionStartTime <= globalState.lineTimeStamp2
				&& subAction.ActionReferentBody && action.ReferentType === "Virtual"
				&& selectedActions.includes(action.Name) && visibleObjectUsers.includes(action.User)) {
                const key = `${subAction.ActionInvokeTimestamp}_${subAction.ActionReferentBody}`;
                if (!newFilteredActions[action.User].has(key)){
				// if (!newFilteredActions.has(key) && !globalState.loadedObjects[key]){
                    newFilteredActions[action.User].add(key);
                    actionsToLoad[action.User].push({ key, subAction });
                }
            }
        }
    }
    //always get the fiurst data, var firstData = data[0]. actionreferentlocation, then we go into it and subtract the position of the first data, get the delta, add the delta in there.

    // Unload objects that are no longer needed
    for (const userID of Object.keys(globalState.loadedObjects)) {
		for (const key of Object.keys(globalState.loadedObjects[userID])){
			if (!newFilteredActions[userID].has(key) && globalState.loadedObjects[userID][key]) {
				const obj = await globalState.loadedObjects[userID][key];  // Ensure the object is fully loaded
				if (obj && obj.parent) { // Check if the object is still part of the scene
					if (obj.geometry) obj.geometry.dispose(); // Dispose resources
					if (obj.material) obj.material.dispose();
					globalState.scene.remove(obj);
					delete globalState.loadedObjects[userID][key];
					// console.log(`Object removed from scene and state: ${key}`);
				}
			}
		}
    }
    if (selectedUsers.length === 0 || visibleObjectUsers.length === 0) {
		return;
	}

    // Load new objects that are required
    for (const userID of Object.keys(actionsToLoad)) {
		for (const { key, subAction } of actionsToLoad[userID]) {
            if (globalState.loadedObjects[userID] === undefined) {
                globalState.loadedObjects[userID] = {};
            }
			if (!globalState.loadedObjects?.[userID]?.[key]) { // Double check to prevent race conditions
				// console.log(`Loading new object: ${key}`);
                if (!globalState.loadedObjects[userID].hasOwnProperty(key)){
                    const adjustedPath = `${globalState.objFilePath}${subAction.ActionReferentBody}`;
                    globalState.loadedObjects[userID][key] = loadAvatarModel(adjustedPath)
                        .then(obj => {
                            obj.name = key;
                            const location = parseLocation(subAction.ActionReferentLocation);

                            if (logMode.vrGame)
                            {
                                console.log("HELLO OBJ POSITION ", obj.position);
                                console.log("HELLO ACTION REFERENT LOCATION", location.x,location.y,location.z);
                                // obj.position.set(-location.x,location.y, -location.z);
                            }

                            // console.log(`Object loaded and added to scene: ${key}`);
                            return obj; // Return the loaded object
                        })
                        .catch(error => {
                            console.error(`Failed to load object ${key}:`, error);
                            delete globalState.loadedObjects[userID][key]; // Clean up state on failure
                        });
                    }
			}
		}
    }
}

function plotHeatmap() {

    const hasVisibleUserID = Object.keys(globalState.show)
        .filter((userID) => globalState.show[userID])
        .map((userID) => `User${userID}`);

	const visibleHeatmapUsers = hasVisibleUserID.filter(userId => {
		return userId in globalState.viewProps && globalState.viewProps[userId]["Heatmap"] === true;
	});

	// const nonVisibleHeatmapUsers = hasVisibleUserID.filter(userId => {
	// 	return globalState.viewProps[userId]["Heatmap"] === false;
	// });

	//remove evrything, TODO: Not optimal, IDEA: keep the old selected heatmap
	Object.keys(globalState.heatmaps).forEach(userId => {
		const userHeatmap = globalState.heatmaps[userId];
		if (userHeatmap) {
            userHeatmap.forEach(heatmap => {
                if (heatmap.mesh){
                    globalState.scene.remove(heatmap.mesh);
                }
            });
		}
	});

	if (hasVisibleUserID.length === 0 || visibleHeatmapUsers.length === 0) {
		return;
	}

	globalState.heatmaps = {}
	visibleHeatmapUsers.forEach((vhi) => {
		globalState.heatmaps[vhi] = [];
	})

    const selectedActions = getSelectedTopics();
    const data = globalState.finalData;
    const gridSize = 50; // Adjust the size of the grid
    const voxelSize = 0.1; // was 0.1 earlier

    const gridHelper = new THREE.GridHelper(gridSize * voxelSize, gridSize, 0x888888, 0x444444);
    gridHelper.position.set((gridSize * voxelSize) / 2, 0, (gridSize * voxelSize) / 2);

    visibleHeatmapUsers.forEach((user, userIndex) => {
        // Create a 3D voxel grid for this user's heatmap
        const heatmap = new Array(gridSize)
            .fill()
            .map(() =>
                new Array(gridSize)
                    .fill()
                    .map(() => new Array(gridSize).fill(0))
            );

        // Use selected actions and time range to filter actions for the user
        const actionsToDisplay = data.filter((action) => {
            return (
                action.User === user &&
                selectedActions.includes(action.Name) &&
                action.Data.some((subAction) => {
                    const actionStartTime = parseTimeToMillis(
                        subAction.ActionInvokeTimestamp
                    );
                    const actionEndTime =
                        actionStartTime + parseDurationToMillis(action.Duration);
                    return (
                        actionEndTime >= globalState.lineTimeStamp1 &&
                        actionStartTime <= globalState.lineTimeStamp2
                    );
                })
            );
        });

        actionsToDisplay.forEach((action) => {
            action.Data.forEach((subAction) => {
                const location = parseLocation(subAction.ActionInvokeLocation);
                if (location) {
                    const gx = Math.floor(location.x / voxelSize);
                    const gy = Math.floor(location.y / voxelSize);
                    const gz = Math.floor(location.z / voxelSize);
                    if (
                        gx >= 0 &&
                        gx < gridSize &&
                        gy >= 0 &&
                        gy < gridSize &&
                        gz >= 0 &&
                        gz < gridSize
                    ) {
                        heatmap[gx][gy][gz] += 1;
                    }
                }
            });
        });
        const smoothedHeatmap = applyGaussianBlur3D(heatmap);
        renderHeatmap(heatmap, user, voxelSize);
        // console.log("here?");
    });
}

function renderHeatmap(heatmap, user, voxelSize) {
    const group = new THREE.Group();
    for (let x = 0; x < heatmap.length; x++) {
        for (let y = 0; y < heatmap[x].length; y++) {
            for (let z = 0; z < heatmap[x][y].length; z++) {
                const intensity = heatmap[x][y][z];
                if (intensity > 0) {
                    const userColor = colorScale(user); // Use the user-specific color from the scale
                    const color = new THREE.Color(userColor); // Map intensity to color
                    const material = new THREE.MeshBasicMaterial({
                        color,
                        transparent: true,
                        opacity: Math.min(1, intensity / 5),
                        // opacity: Math.min(1, intensity / 20),
                    });
                    // const cubeSizeFactor = 0.5; // Change this value to control the size reduction
                    // const cube = new THREE.Mesh(
                    //     new THREE.BoxGeometry(voxelSize * cubeSizeFactor, voxelSize * cubeSizeFactor, voxelSize * cubeSizeFactor),
                    //     material
                    // );
                    // const cube = new THREE.Mesh(
                    //     new THREE.PlaneGeometry(voxelSize, voxelSize), // 2D square for visualization
                    //     material
                    // );
                    const cube = new THREE.Mesh(
                        new THREE.SphereGeometry(voxelSize / 2),
                        material
                    );
                    // const cube = new THREE.Mesh(
                    //     new THREE.CylinderGeometry(voxelSize / 2, voxelSize / 2, voxelSize/2, 6), // Hexagonal prism
                    //     material
                    // );
                    cube.position.set(
                        x * voxelSize,
                        y * voxelSize,
                        z * voxelSize
                    );
                    group.add(cube);
                }
            }
        }
    }
    globalState.scene.add(group); // Add the heatmap to the scene
    globalState.heatmaps[user].push({
        mesh: group,
    });
}
function applyGaussianBlur3D(heatmap) {
    const kernelSize = 5;
    const sigma = 2.0;
    const kernel = createGaussianKernel(kernelSize, sigma);
    const smoothedHeatmap = JSON.parse(JSON.stringify(heatmap));
    for (let x = 0; x < heatmap.length; x++) {
        for (let y = 0; y < heatmap[x].length; y++) {
            for (let z = 0; z < heatmap[x][y].length; z++) {
                let sum = 0;
                let weightSum = 0;
                for (let i = -1; i <= 1; i++) {
                    for (let j = -1; j <= 1; j++) {
                        for (let k = -1; k <= 1; k++) {
                            const nx = x + i;
                            const ny = y + j;
                            const nz = z + k;
                            if (
                                nx >= 0 &&
                                nx < heatmap.length &&
                                ny >= 0 &&
                                ny < heatmap[x].length &&
                                nz >= 0 &&
                                nz < heatmap[x][y].length
                            ) {
                                const weight = kernel[i + 1][j + 1][k + 1];
                                sum += heatmap[nx][ny][nz] * weight;
                                weightSum += weight;
                            }
                        }
                    }
                }
                smoothedHeatmap[x][y][z] = sum / weightSum;
            }
        }
    }
    return smoothedHeatmap;
}
function createGaussianKernel(size, sigma) {
    const kernel = new Array(size).fill().map(() => new Array(size).fill().map(() => new Array(size).fill(0)));
    const mean = Math.floor(size / 2);
    let sum = 0.0;
    for (let x = 0; x < size; x++) {
        for (let y = 0; y < size; y++) {
            for (let z = 0; z < size; z++) {
                const exponent = -(
                    ((x - mean) ** 2 + (y - mean) ** 2 + (z - mean) ** 2) /
                    (2 * sigma ** 2)
                );
                kernel[x][y][z] = Math.exp(exponent);
                sum += kernel[x][y][z];
            }
        }
    }
    // Normalize the kernel
    for (let x = 0; x < size; x++) {
        for (let y = 0; y < size; y++) {
            for (let z = 0; z < size; z++) {
                kernel[x][y][z] /= sum;
            }
        }
    }
    return kernel;
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
        pitch: parseFloat(parts[3]),  // Rotation around X-axis in degrees
        yaw: parseFloat(parts[4]),    // Rotation around Y-axis in degrees
        roll: parseFloat(parts[5])    // Rotation around Z-axis in degrees
    };
    // Sep 09 06:01:05 PM - Sep 09 06:02:12 PM
    // return {
    //     x: -parseFloat(parts[0]),
    //     y: parseFloat(parts[1]),
    //     z: parseFloat(parts[2]),
    //     pitch: -parseFloat(parts[3]),  // Rotation around X-axis in degrees
    //     yaw: parseFloat(parts[4]),    // Rotation around Y-axis in degrees
    //     roll: parseFloat(parts[5])    // Rotation around Z-axis in degrees
    // };
}


async function initializeScene() {
	globalState.scene = new THREE.Scene();
	globalState.scene.background = new THREE.Color(0xF5F5F5);
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
	// globalState.scene.add(gridHelper);
	// await Promise.all([loadRoomModel()]);

  	const finalData = await Promise.all([
		fetch(globalState.logFIlePath).then(response => response.json()),
		  ]);
  globalState.finalData = finalData[0];

    updateNumUsers();
    initializeViewProps();
    window_onload();
    const isHeadsetMode = logMode.vrGame || logMode.immersiveAnalytics;
    const avatarModel = isHeadsetMode ? 'headset.glb' : 'ipad.glb';
    //headset scaled down, controller scaled down
    const loadModel = isHeadsetMode ? loadAvatarModel : loadIpadModel;
    const avatarPromises = Array.from({ length: numUsers }, () => loadModel(avatarModel));


	globalState.avatars = await Promise.all(avatarPromises);
	const controlModels = {
		vrGame: { right: "controller_r.glb", left: "controller_l.glb" },
		immersiveAnalytics: { right: "hand_r.glb", left: "hand_l.glb" },
	};

	// Determine right and left control models
	let rightControlModel, leftControlModel;

	if (logMode.vrGame) {
		({ right: rightControlModel, left: leftControlModel } = controlModels.vrGame);
	} else if (logMode.immersiveAnalytics) {
		({ right: rightControlModel, left: leftControlModel } = controlModels.immersiveAnalytics);
	} else {
		// Other modes do not use controls
		globalState.rightControls = [];
		globalState.leftControls = [];
	}

	// Load right and left controls for each user if models are defined
	if (rightControlModel && leftControlModel) {
		const rightControlPromises = Array.from({ length: numUsers }, () => loadHand(rightControlModel));
		const leftControlPromises = Array.from({ length: numUsers }, () => loadHand(leftControlModel));

		globalState.rightControls = await Promise.all(rightControlPromises);
		globalState.leftControls = await Promise.all(leftControlPromises);
	}

	setTimes(globalState.finalData);

    const playPauseButton = document.getElementById('playPauseButton');
    // animateVisualization();
    if(video) {
        if (playPauseButton.style.display === 'block') {
            playPauseButton.style.display = 'none';
          } else {
            playPauseButton.style.display = 'block';
          }
        playPauseButton.addEventListener('keydown', function (event) {
            if (event.code === 'Space') { // Check if space bar is pressed
              console.log("Space bar pressed on button");
              toggleAnimation(); // Toggle play/pause state
              event.preventDefault(); // Prevent default space bar behavior (scrolling down)
            }
          });
    }

}

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
        .range([0, globalState.dynamicWidth]);

    // Y scale for user actions
    const yScale = d3.scaleBand()
        .domain(topicsData.map(d => d.topic))
        .rangeRound([0, height])
        .padding(0.1);

    // Append the Y-axis
	const yAxis = svg.append("g")
	.attr("class", "axis axis--y")
	.call(d3.axisLeft(yScale));

	yAxis.selectAll("text")
	.style("font-size", "14px"); // Adjust the font size as needed

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

function drawBookmarks(llmTS) {
    const svg = d3.select(`#shared-axis-container svg`); // Target the correct SVG by container ID
	svg.selectAll(".bookmark-marker").remove(); // Clear existing bookmarks

	const xScale = d3.scaleTime()
		.domain([new Date(globalState.globalStartTime), new Date(globalState.globalEndTime)])
		.range([0, globalState.dynamicWidth]);

	// Updated bookmark path with appropriate size
	const bookmarkPath = "M15 3 L15 25.5 L7.5 15 L0 25.5 L0 3 Z";

    Object.entries(llmTS).forEach(([id, times]) => {
        times.forEach(timeStr => {
            const timestampMs = parseTimeToMillis(timeStr);
            const xPosition = xScale(timestampMs); // Use xScale to find the position

            if (timestampMs >= new Date(globalState.globalStartTime).getTime()) {
                // Append the bookmark icon (path)
				const bookmarkGroup = svg.append("g") // Group to keep path and text together
                    .attr("transform", `translate(${xPosition + margin.left + margin.right}, 10)`)
                    .attr("class", "bookmark-marker")
                    .attr("id", `bookmark-${id}`)
                    .on("mouseover", function() {
                        d3.select(this).select("path")
                            .attr("fill", "#ff5722");
                    })
                    .on("mouseout", function() {
                        d3.select(this).select("path")
                            .attr("fill", "#ff9800");
                    })
                    .on("click", function() {
                        console.log(`Focusing on entry with ID: ${id}, ${new Date(timestampMs)}`);
						highlightAndScrollToInsight(id);
                    });

                // Append bookmark path
                bookmarkGroup.append("path")
                    .attr("d", bookmarkPath)
                    .attr("fill", "#ff9800");

                // Append the key (number) inside the bookmark icon
                bookmarkGroup.append("text")
                    .attr("x", 7.5)  // Centered horizontally in the bookmark
                    .attr("y", 14)   // Vertically aligned in the bookmark
                    .attr("text-anchor", "middle")
                    .attr("fill", "#000") // White color for contrast
                    .attr("font-size", "12px") // Adjust the font size to fit inside the bookmark
                    .attr("font-weight", "bold")
                    .text(id); // Use the key as the text
            }
        });
    });
}

let currentZoomLevel = 100; // Assuming 100% is the default zoom level

// Function to update the zoom level display
function updateZoomLevelDisplay(zoomLevel) {
    const zoomDisplay = document.getElementById('zoom-level-display');
    zoomDisplay.textContent = `Zoom: ${zoomLevel}%`;
}

// Example scroll/zoom event listener
document.getElementById('spatial-view').addEventListener('wheel', function(event) {
    // Assuming that scrolling up zooms in and scrolling down zooms out
    if (event.deltaY < 0) {
        currentZoomLevel = Math.min(currentZoomLevel + 10, 200); // Max zoom 200%
    } else {
        currentZoomLevel = Math.max(currentZoomLevel - 10, 10); // Min zoom 10%
    }

    updateZoomLevelDisplay(currentZoomLevel);

    // Prevent default scrolling behavior
    event.preventDefault();
});

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
		generateHierToolBar();
		createPlotTemporal();
		plotUserSpecificBarChart();
		plotUserSpecificDurationBarChart();
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
        updateUserDevice(i);
        updateLeftControl(i);
        updateRightControl(i);
    }
	plotHeatmap();
	updatePointCloudBasedOnSelections();
	updateObjectsBasedOnSelections();
    updateMarkersBasedOnSelections();
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

	plotHeatmap();

	updatePointCloudBasedOnSelections();
	updateObjectsBasedOnSelections();
    updateMarkersBasedOnSelections();
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
            checkbox.checked = true; // Optionally uncheck them as well
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

		plotHeatmap();

		updatePointCloudBasedOnSelections();
		updateObjectsBasedOnSelections();
        updateMarkersBasedOnSelections();
    });

}

function generateUserLegends(){
	const legendContainer = document.getElementById('user-toolbar-container');
	legendContainer.style.height = `${numUsers * globalState.obContext.length *38}px`;

    for (let i = 1; i <= numUsers; i++) {
        // Create the main user checkbox
      const userDiv = document.createElement('div');
      userDiv.classList.add('checkbox-container', 'collapsed'); // Start as collapsed

      const userCheckboxLabel = document.createElement('label');
      userCheckboxLabel.classList.add('user-checkbox');

      const userCheckbox = document.createElement('input');
      userCheckbox.type = 'checkbox';
      userCheckbox.id = `toggle-user${i}`;
      userCheckbox.checked = true;
      userCheckboxLabel.appendChild(userCheckbox);

      const legendSquare = document.createElement('div');
      legendSquare.className = 'legend-square';
      legendSquare.style.backgroundColor = colorScale(`User${i}`);
      userCheckboxLabel.appendChild(legendSquare);

      userCheckboxLabel.appendChild(document.createTextNode(` User ${i}`));

      // Create the nested checkboxes container
      const nestedDiv = document.createElement('div');
      nestedDiv.classList.add('nested-checkboxes');

		globalState.obContext.forEach(context => {
			const contextLabel = document.createElement('label');
			const contextCheckbox = document.createElement('input');
			contextCheckbox.type = 'checkbox';
			contextCheckbox.id = `toggle-user${i}-${context}`;

			contextLabel.appendChild(contextCheckbox);
			contextLabel.appendChild(document.createTextNode(` ${context}`));
			nestedDiv.appendChild(contextLabel);
			nestedDiv.appendChild(document.createElement('br'));

			contextCheckbox.addEventListener('change', function () {
				handleContextChange(context, `User${i}`, this.checked);
			});
		});

		// Create horizontal dotted line
		const horizontalLine = document.createElement('div');
		horizontalLine.classList.add('horizontal-line');

		// Append elements
		userDiv.appendChild(userCheckboxLabel);
		userDiv.appendChild(nestedDiv);
		userDiv.appendChild(horizontalLine);
		legendContainer.appendChild(userDiv);

		if (userCheckbox.checked) {
			nestedDiv.classList.add('show');
			userDiv.classList.add('expanded'); // Set to expanded by default
		} else {
			userDiv.classList.add('collapsed');
		}

		// Event to handle expansion/collapse of nested checkboxes
		userCheckbox.addEventListener('change', function () {
			// Get visible users by filtering the globalState.show
			const hasVisibleUserID = Object.keys(globalState.show)
			.filter((userID) => globalState.show[userID])
			.map((userID) => `User${userID}`);

		// Calculate the height dynamically based on the number of visible users and obContext length
		const baseHeightPerUser = 49; // Base height for each expanded user (adjust based on your UI)
		const obContextHeightPerItem = 28; // Height of each obContext item

		if (this.checked) {
			// Expand the user checkbox, show the nested content
			nestedDiv.classList.add('show');
			userDiv.classList.remove('collapsed');
			userDiv.classList.add('expanded');

			// Set the height dynamically based on visible users and obContext length
			const expandHeight = 58;
			legendContainer.style.height = `${expandHeight + (numUsers * baseHeightPerUser) + ((hasVisibleUserID.length - 1) * globalState.obContext.length * obContextHeightPerItem)}px`;
		} else {
			// Collapse the user checkbox, hide the nested content
			nestedDiv.classList.remove('show');
			userDiv.classList.remove('expanded');
			userDiv.classList.add('collapsed');

			// Handle collapsed state: Adjust height dynamically based on the remaining visible users
			const collapsedHeight = 0; // Adjust this based on your collapsed state height
			legendContainer.style.height = `${(numUsers * baseHeightPerUser) + ((hasVisibleUserID.length - 2) * globalState.obContext.length * obContextHeightPerItem)}px`;
		}

		});
	}
}


function handleContextChange(context, userId, isChecked) {
	console.log(`Context ${context} for User ${userId} changed: ${isChecked}`);

	// Apply logic based on the context
	switch (context) {
	  case 'Object':
		globalState.viewProps[userId]["Object"] = isChecked;
		updateObjectsBasedOnSelections();

		break;

	  case 'Context':
		globalState.viewProps[userId]["Context"] = isChecked;
        toggleAnimation();
		updatePointCloudBasedOnSelections();
		break;

	  case 'Heatmap':
		globalState.viewProps[userId]["Heatmap"] = isChecked;
		plotHeatmap();
		break;

	  default:
		console.log("Handle other obContext here!");
		break;
	}
  }

function plotUserSpecificBarChart() {
	const plotBox = d3.select("#plot-box2").html("");
	const margin = { top: 30, right: 20, bottom: 70, left: 70 };
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
        .text("User-Specific ActionReferentName");

	// Assuming globalState.finalData.action_dict exists and is structured appropriately
	let allUsers = new Set();
	let userDataByActionReferentName = {};

	// Get selected users and actions from checkboxes
	const selectedUsers = Object.keys(globalState.show)
	.filter(userID => globalState.show[userID])
	.map(userID => `User${userID}`);
	const selectedActions = getSelectedTopics();

	// Filter and process data based on selected checkboxes
	globalState.finalData
		.filter(action => {
			// Check if the action is in the selected actions and users
			const isSelectedAction = selectedActions.includes(action.Name);
			const isSelectedUser = selectedUsers.includes(action.User);

			// Check if the action's time overlaps with the selected time range
			const hasTimeOverlap = action.Data.some(subAction => {
				const actionStartTime = parseTimeToMillis(subAction.ActionInvokeTimestamp);
				const actionEndTime = actionStartTime + parseDurationToMillis(action.Duration);
				return actionEndTime >= globalState.lineTimeStamp1 && actionStartTime <= globalState.lineTimeStamp2;
			});

			return isSelectedAction && isSelectedUser && hasTimeOverlap;
		})
		.forEach(action => {
			const actorName = action.User;

			action.Data
			.filter(ob => ob.ActionReferentName != null)
			.forEach(ob => {
				let ActionReferentName = ob.ActionReferentName;
				ActionReferentName = ActionReferentName.split('_')[0];
				if(globalState.useCase == "sceneNavigation"){
					ActionReferentName = ActionReferentName.split("(")[1].trim();
					ActionReferentName = ActionReferentName.split(",")[0].trim();
					ActionReferentName = ActionReferentName.replace(/'/g, "");
				}else if(globalState.useCase == "maintenance"){ //Past Inspection Log (1) Past Inspection Log (1) "('QR Code', 0.9)"
					ActionReferentName = ActionReferentName.match(/"([^"]+)"|([a-zA-Z\s]+)/g)?.join(' ').trim();
				}else{
					ActionReferentName = ActionReferentName.split("(")[0].trim();
				}

				if (!userDataByActionReferentName[ActionReferentName]) {
					userDataByActionReferentName[ActionReferentName] = {};
				}

				userDataByActionReferentName[ActionReferentName][actorName] = (userDataByActionReferentName[ActionReferentName][actorName] || 0) + 1;
				allUsers.add(actorName);
			})

		});

	const users = Array.from(allUsers).sort((a, b) => {
		// Sort by user names; this will put "User1" before "User2"
		return a.localeCompare(b);
	});
	const processedData = Object.entries(userDataByActionReferentName).map(([ActionReferentName, counts]) => ({
		ActionReferentName,
		...counts
	}));

	// Setup scales
	// Stack data for stacked bar chart
    const stack = d3.stack()
        .keys(users)
        .order(d3.stackOrderNone)
        .offset(d3.stackOffsetNone);

    const stackedData = stack(processedData);

    // Setup scales
    const x = d3.scaleBand()
        .rangeRound([0, width])
        .padding(0.8)
        .domain(processedData.map(d => d.ActionReferentName));

    const y = d3.scaleLinear()
        .domain([0, d3.max(stackedData, d => d3.max(d, d => d[1]))])
        .nice()
        .range([height, 0]);

	// Create the bars
    svg.append("g")
        .selectAll("g")
        .data(stackedData)
        .enter().append("g")
        .attr("fill", d => colorScale(d.key))
        .selectAll("rect")
        .data(d => d)
        .enter().append("rect")
        .attr("x", d => x(d.data.ActionReferentName))
        .attr("y", d => y(d[1]))
        .attr("height", d => y(d[0]) - y(d[1]))
        .attr("width",  d => Math.min(x.bandwidth(), 40))
        .on("mouseover", function (event, d) {
            const userKey = d3.select(this.parentNode).datum().key;
            d3.select(this)
                .transition()
                .duration(100)
                .attr("fill", d3.rgb(colorScale(userKey)).darker(2));

            tooltip.style("visibility", "visible")
                .text(`${userKey}: ${d.data[userKey]}`)
                .style("left", `${event.pageX + 5}px`)
                .style("top", `${event.pageY - 28}px`);
        })
        .on("mouseout", function (event, d) {
            const userKey = d3.select(this.parentNode).datum().key;
            d3.select(this)
                .transition()
                .duration(100)
                .attr("fill", colorScale(userKey));

            tooltip.style("visibility", "hidden");
        });

	// Add the axes
	svg.append("g")
		.attr("class", "axis")
		.attr("transform", `translate(0,${height})`)
		.call(d3.axisBottom(x))
		.selectAll("text")
		.style("text-anchor", "end")
		.attr("dx", "0.2em")
		.attr("dy", ".25em")
		.attr("transform", "rotate(0)")
		.style("font-size", "1.2em")
		.each(function(d) {
            const element = d3.select(this);
            const words = d.split(" ");  // Split label into words
            element.text("");  // Clear the current label

            words.forEach((word, i) => {
                element.append("tspan")
                    .text(word)
                    .attr("x", 0)
                    .attr("dy", ".9em")  // Offset subsequent lines
                    .attr("dx", "-1em")  // Adjust horizontal position slightly
                    .attr("text-anchor", "middle");
            });
        });

	svg.append("g")
		.call(d3.axisLeft(y).ticks(5))
		.selectAll(".tick text") // Select all tick texts
		.style("font-family", "Lato")
		.style("font-size", "1.2em");

		svg.append("text")
		.attr("transform", "rotate(-90)")
		.attr("y", 0 - margin.left)
		.attr("x", 0 - (height / 2))
		.attr("dy", "2em")
		.style("text-anchor", "middle")
		.text("Count")
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
    const plotBox = d3.select("#plot-box1").html("");
    const margin = { top: 30, right: 20, bottom: 60, left: 70 };
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
		.filter(action => {
			// Check if the action is in the selected actions and users
			const isSelectedAction = selectedActions.includes(action.Name);
			const isSelectedUser = selectedUsers.includes(action.User);

			// Check if the action's time overlaps with the selected time range
			const hasTimeOverlap = action.Data.some(subAction => {
				const actionStartTime = parseTimeToMillis(subAction.ActionInvokeTimestamp);
				const actionEndTime = actionStartTime + parseDurationToMillis(action.Duration);
				return actionEndTime >= globalState.lineTimeStamp1 && actionStartTime <= globalState.lineTimeStamp2;
			});

			return isSelectedAction && isSelectedUser && hasTimeOverlap;
		})
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
        .style("font-size", "1.2em")
		.each(function(d) {
            const element = d3.select(this);
            const words = d.split(" ");  // Split label into words
            element.text("");  // Clear the current label

            words.forEach((word, i) => {
                element.append("tspan")
                    .text(word)
                    .attr("x", 0)
                    .attr("dy", "1em")  // Offset subsequent lines
                    .attr("dx", "0.1em")  // Adjust horizontal position slightly
                    .attr("text-anchor", "middle");
            });
        });

    svg.append("g")
        .call(d3.axisLeft(y).ticks(5))
        .selectAll(".tick text") // Select all tick texts
        .style("font-family", "Lato")
        .style("font-size", "1.2em");

    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 0 - margin.left)
        .attr("x", 0 - (height / 2))
        .attr("dy", "2em")
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
	d3.json(globalState.llmInsightPath).then(function(data) {
		globalState.llmInsightData = data;
		createAnalysisFilter(data);
		displayInsights(data);
		callDrawBookmarks(data);
    }).catch(function(error) {
        console.error('Error loading JSON data:', error);
    });
}

function callDrawBookmarks(llmInsightData){
	let entryTS = {}
	Object.keys(llmInsightData).forEach(key => {
        const insight = llmInsightData[key];
		if(insight.timestamps.length != 0){
			entryTS[key] = insight.timestamps;
		}
	});
	drawBookmarks(entryTS);
}

function displayInsights(insightsData) {
    const insightsContainer = document.getElementById('insights-container'); // Updated to target insights-container
    insightsContainer.innerHTML = ''; // Clear previous insights, not filters

    Object.keys(insightsData).forEach(key => {
        const insight = insightsData[key];
        const insightBox = document.createElement('div');
        insightBox.className = 'insight-box';
        insightBox.id = `insight-${key}`; // Assign a unique ID to each insight

        // Create topic element
        const topicElement = document.createElement('h4');
        topicElement.className = 'insight-topic';

        // Create a key span (the number)
        const keySpan = document.createElement('span');
        keySpan.className = 'insight-key';
        keySpan.textContent = `#${key}`; // The insight number

        // Create the topic text
        const topicText = document.createElement('span');
        topicText.textContent = insight.topic;

        // Append key and topic to the topicElement
        topicElement.appendChild(keySpan);
        topicElement.appendChild(topicText);

        // Create insight element
        const insightElement = document.createElement('p');
        insightElement.textContent = insight.insight;
        insightElement.className = 'insight-content';

        insightBox.appendChild(topicElement);
        insightBox.appendChild(insightElement);
        insightsContainer.appendChild(insightBox);

		// Add click event listener for highlighting corresponding bookmark
        insightBox.addEventListener('click', function() {
			const bookmark = d3.selectAll(`#bookmark-${key} path`); // Target the path inside the bookmark group
			if (!bookmark.empty()) {
				const bookmarkDOM = document.getElementById(`bookmark-${key}`);
				bookmarkDOM.scrollIntoView({ behavior: 'smooth', block: 'center' });

				bookmark.transition()
					.duration(500)
					.attr("fill", "green")
					.transition()
					.delay(1000)  // Increased delay to show the color change for a while
					.duration(500)
					.attr("fill", "#ff9800"); // Return to original color
			}
		});
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
        displayInsights({}); // If no filters are active, display nothing
		callDrawBookmarks({});
    } else {
        const filteredData = {};
        Object.keys(insightsData).forEach(key => {
            const insight = insightsData[key];
            if (activeFilters.some(filter => insight.analyses.includes(filter))) {
                filteredData[key] = insight;
            }
        });
        displayInsights(filteredData);
		callDrawBookmarks(filteredData);
    }
}

function highlightAndScrollToInsight(id) {
    const insightElement = document.getElementById(`insight-${id}`);
    if (insightElement) {
        // Scroll into view
        insightElement.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Highlight the element
        insightElement.classList.add('highlight-insight');

        // Remove highlight after animation
        setTimeout(() => {
            insightElement.classList.remove('highlight-insight');
        }, 2000); // Keep it highlighted for 2 seconds
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

// function updateSpatialView(nextTimestamp){

// }

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

	// **Add this block to display the total number of results**
    const totalResults = actionsToDisplay.reduce((count, action) => count + action.Data.length, 0);
    let totalResultsDisplay = document.createElement('div');
    totalResultsDisplay.className = 'total-results-display';
    totalResultsDisplay.innerHTML = `<strong>About ${totalResults} results...</strong>`;
    speechBoxesContainer.appendChild(totalResultsDisplay); // Add the total results before speech boxes

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
	let otherDetails ;
	if (action.TriggerSource === "Audio") // zainab add all the navigates and discuss operations here
	{
        // ${formattedLocation}<br>
		otherDetails = `
        <strong>Timestamp:</strong> ${new Date(parseTimeToMillis(subAction.ActionInvokeTimestamp)).toLocaleString()}<br>
        <strong>Duration:</strong> ${parseDurationToMillis(action.Duration)} ms<br>
        <strong>Trigger Source:</strong> ${action.TriggerSource}<br>
        <strong>Transcribed Text:</strong> ${subAction.ActionReferentBody}<br>

    `;
	}
	else{
        // ${formattedLocation}<br>
    	otherDetails = `
        <strong>Timestamp:</strong> ${new Date(parseTimeToMillis(subAction.ActionInvokeTimestamp)).toLocaleString()}<br>
        <strong>Duration:</strong> ${parseDurationToMillis(action.Duration)} ms<br>
        <strong>Trigger Source:</strong> ${action.TriggerSource}<br>
        <strong>Referent Name:</strong> ${subAction.ActionReferentName || 'N/A'}<br>
    `;
	}
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
	const yStart = parseFloat(d3.select('#time-indicator-line1').attr('y1'));
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
	initializeShadedAreaDrag();
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

        // Update positions of line1 and line2
        let line1X = parseFloat(line1.attr("x1")) + dx;
        let line2X = parseFloat(line2.attr("x1")) + dx;

        line1.attr("x1", line1X).attr("x2", line1X);
        line2.attr("x1", line2X).attr("x2", line2X);
        circle1.attr("cx", line1X);
        circle2.attr("cx", line2X);

        // Update shaded area between line1 and line2
        updateShadedArea(line1X, line2X);

        // Update timestamps
        const newLine1Timestamp = x.invert(line1X - buffer).getTime();
        const newLine2Timestamp = x.invert(line2X - buffer).getTime();
        globalState.lineTimeStamp1 = newLine1Timestamp;
        globalState.lineTimeStamp2 = newLine2Timestamp;

        updateRangeDisplay(newLine1Timestamp, newLine2Timestamp);

        // Update visual elements based on new positions
        for (let i = 0; i < numUsers; i++) {
            updateUserDevice(i);
            updateLeftControl(i);
            updateRightControl(i);
        }

        plotHeatmap();
        updatePointCloudBasedOnSelections();
        updateObjectsBasedOnSelections();
        updateMarkersBasedOnSelections();

        dragStartX = event.x;
    };

    const dragended = () => {
        generateHierToolBar();
        plotUserSpecificBarChart();
        plotUserSpecificDurationBarChart();
        plotHeatmap();
        updateObjectsBasedOnSelections();
        updatePointCloudBasedOnSelections();
        updateMarkersBasedOnSelections();
    };

    const drag = d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended);

    shadedArea.call(drag);
}

function updateShadedArea(line1X, line2X) {
    const indicatorSVG = d3.select("#indicator-svg");
    const shadedArea = indicatorSVG.select(".shading");

    // Set the shaded area's position and width based on line1 and line2 positions
    const startX = Math.min(line1X, line2X);
    const endX = Math.max(line1X, line2X);
    shadedArea.attr("x", startX).attr("width", endX - startX);
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
	const temporalViewContainer = d3.select("#temporal-view");
	const minWidth = document.getElementById('temporal-view').clientWidth - margin.right - margin.left;
	let sharedAxisContainer = temporalViewContainer.select("#shared-axis-container");
	if (sharedAxisContainer.empty()) {
	  sharedAxisContainer = temporalViewContainer.append("div").attr("id", "shared-axis-container");
	}

	sharedAxisContainer.html("");
	const timeFormat = d3.timeFormat("%I:%M:%S");
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
		.call(xAxis)
		.selectAll("text")
    	.style("font-size", "14px");

	// Enable horizontal scrolling
	// sharedAxisContainer.style("overflow-x", "auto").style("max-width", "100%");
  }


  function animateTemporalView(timestamp) {
    const svg = d3.select("#temporal-view");
    if (!svg.empty()) {
        let line1 = svg.select('#time-indicator-line1');
        let circle1 = svg.select('#time-indicator-circle1');
        let line2 = svg.select('#time-indicator-line2');
        let circle2 = svg.select('#time-indicator-circle2');
        const indicatorSVG = d3.select("#indicator-svg");
        const shadedArea = indicatorSVG.select(".shading");
        const sharedAxisStart = d3.select("#shared-axis-container svg g");
        const marginLeft = parseInt(sharedAxisStart.attr("transform").match(/translate\((\d+),/)[1]); // Extract margin.left from the transform attribute
        const alignX = 10; // Additional offset if needed

        // Update line1 and circle1 based on the timestamp


        if (globalState.isAnimating) {
            if (!line1.empty() && !circle1.empty()) {
                let xPosition1 = Math.max(0, x(new Date(timestamp))) + marginLeft + alignX;
                line1.attr('x1', xPosition1)
                    .attr('x2', xPosition1);
                circle1.attr('cx', xPosition1);
            }
            // During animation, hide line2, circle2, and shaded area
            if (!line2.empty()) {
                line2.style('display', 'none');
            }
            if (!circle2.empty()) {
                circle2.style('display', 'none');
            }
            if (!shadedArea.empty()) {
                shadedArea.style('display', 'none');
            }

            const rangeDisplay = document.getElementById("range-display");
            const timeFormat = d3.timeFormat("%b %d %I:%M:%S %p");
                rangeDisplay.textContent = `Selected Time: ${timeFormat(new Date(timestamp))}`;
            // else
            // {
            //     rangeDisplay.textContent = `Selected Time: ${timeFormat(new Date(time1))}`;

            // }
        } else {
            if (!line1.empty() && !circle1.empty()) {
                let xPosition1 = Math.max(0, x(new Date(timestamp))) + marginLeft + alignX;
                line1.attr('x1', xPosition1)
                    .attr('x2', xPosition1);
                circle1.attr('cx', xPosition1);
            }
            if (!line2.empty()) {
                line2.style('display', 'block');  // Make line2 visible again
                let xPosition2 = Math.max(0, x(new Date(timestamp + 5000))) + marginLeft + alignX; // Position 5 seconds ahead of line1
                line2.attr('x1', xPosition2)
                    .attr('x2', xPosition2);
            }
            if (!circle2.empty()) {
                circle2.style('display', 'block');  // Make circle2 visible again
                let xPosition2 = Math.max(0, x(new Date(timestamp + 5000))) + marginLeft + alignX; // Position 5 seconds ahead of circle1
                circle2.attr('cx', xPosition2);
            }
            if (!shadedArea.empty()) {
                shadedArea.style('display', 'block');  // Make shaded area visible again
            }
        }
    }
}


function updateAnimation(nextTimestamp) {
    // Perform all the necessary updates in one function
    animateTemporalView(nextTimestamp);
    updateTimeDisplay(nextTimestamp, globalState.globalStartTime);
    updateVisualization(nextTimestamp);
    updateSpatialView(nextTimestamp);
}

function animateVisualization() {
    const dataToVisualize = globalState.finalData;

    // Check if there's data to visualize
    if (dataToVisualize.length === 0) return;

    // If animation is paused
    if (!globalState.isAnimating) {
        const currentTimestamp = globalState.globalStartTime + globalState.currentTimestamp;
        animateTemporalView(currentTimestamp + 5000); // Update line2 with a timestamp 5 seconds ahead

        // Update shaded area between line1 and line2
        const line1X = parseFloat(d3.select("#time-indicator-line1").attr("x1"));
        const line2X = parseFloat(d3.select("#time-indicator-line2").attr("x1"));
        updateShadedArea(line1X, line2X);

        return;
    }

    // Continue animation if isAnimating is true
    const globalStartTime = globalState.globalStartTime;
    const globalEndTime = globalState.globalEndTime;
    const totalTime = globalEndTime - globalStartTime;
    const nextTimestamp = globalStartTime + globalState.currentTimestamp;

    if (globalState.currentTimestamp < totalTime) {
        const elapsedTime = globalState.currentTimestamp;
        const binIndex = Math.floor(elapsedTime / globalState.intervalDuration);
        globalState.startTimeStamp = globalStartTime + (binIndex * globalState.intervalDuration);
        globalState.endTimeStamp = globalState.startTimeStamp + globalState.intervalDuration;

        // Update visualization, time display, and temporal view
        updateAnimation(nextTimestamp);

        // Update slider position
        const slider = document.querySelector('#slider-container input[type=range]');
        if (slider) {
            slider.value = (globalState.currentTimestamp / totalTime) * slider.max;
        }

        globalState.currentTimestamp += animationStep; // Maintain the animation step for continuity
        requestAnimationFrame(animateVisualization);
    } else {
        // When animation ends
        globalState.isAnimating = false;

        // Position line2 and circle2 5 seconds ahead of line1
        const line2Timestamp = globalState.globalStartTime + globalState.currentTimestamp;
        animateTemporalView(line2Timestamp + 5000);  // Update with line2 positioned 5 seconds ahead

        // Update shaded area between line1 and line2
        const line1X = parseFloat(d3.select("#time-indicator-line1").attr("x1"));
        const line2X = parseFloat(d3.select("#time-indicator-line2").attr("x1"));
        updateShadedArea(line1X, line2X);

        // Reset current timestamp for a fresh start on next play
        globalState.currentTimestamp = 0;

        // Toggle animation state or handle any UI updates
        toggleAnimation(); // Ensure this is still the correct function to handle the animation toggle
    }
}





  function updateAxisTicks(svg, xScale, binSize) {
	const tickInterval = d3.timeMinute.every(binSize); // Dynamically set tick interval based on bin size
	const xAxis = d3.axisTop(xScale)
		.ticks(tickInterval)
		.tickFormat(d3.timeFormat("%I:%M:%S"))
		.tickPadding(5);

	svg.select(".x-axis").call(xAxis); // Re-call the axis to update ticks
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
    // const playPauseButton = document.getElementById('playPauseButton');
	// const playPauseButtonHeight = playPauseButton.offsetHeight;

	createSharedAxis();
	createPlotTemporal();
	initHierToolBar();
	generateHierToolBar();

	createLines(globalState.lineTimeStamp1, globalState.lineTimeStamp2);
    animateVisualization();


	document.querySelectorAll('.topic-checkbox').forEach(checkbox => {
	  checkbox.checked = true;
	  checkbox.dispatchEvent(new Event('change'));
	});
	// updateInterestBox();
	initializeOrUpdateSpeechBox();
    if(!logMode.infoVisCollab1){
	    plotLLMData();
    }

	plotHeatmap();

	updatePointCloudBasedOnSelections();
	updateObjectsBasedOnSelections();
    updateMarkersBasedOnSelections();
	plotUserSpecificBarChart();
	plotUserSpecificDurationBarChart();
}

initialize();
globalState.camera.updateProjectionMatrix();
// initializeInteraction();

onWindowResize();
// window.addEventListener('resize', onWindowResize, false);


function animate() {
	// initializeInteraction();
	requestAnimationFrame(animate);
	globalState.controls.update();
	globalState.renderer.render(globalState.scene, globalState.camera);
}
export function getScene() {
	return scene;
}
animate();;