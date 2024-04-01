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
const userInterestTopic = "Emergency Management and Evacuation";
let buffer = 210 ;
const margin = { top: 20, right: 30, bottom: 10, left: 200 };

const hsl = {
	h: 0,
	s: 0,
	l: 0
};
const topicOfInterest = "";

	// const colorScale = d3.scaleOrdinal()
  //   .domain(["User_1", "User_2", "User_3", "0", "1", "2"]) // Added "User_3" and "2" to the domain
  //   .range(["#b3e2cd", "#fdcdac", "#f4cae4", "#b3e2cd", "#fdcdac", "#f4cae4"]); // Added a third color "#00b0f0"


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
	avatar.scale.set(0.15, 0.15, 0.15);
	avatar.name = filename;
  avatar.visible = true ;
	globalState.scene.add(avatar);
	avatar.position.y = -1 ;
	avatarLoaded = true;
	return avatar;
}

function colorAvatarModel(id){
  const avatar = globalState.avatars[id];
  avatar.traverse((child) => {
    if (child.isMesh && child.material) {
      if (Array.isArray(child.material)) {
        // If the mesh has multiple materials, change each one
        child.material.forEach((material) => {
          material.color.setHex(colorScale(id)); // Example: changing to red
        });
      } else {
        // The mesh has a single material
        child.material.color.set(colorScale(id)); // Example: changing to red
      }
    }
  });
}

async function loadRoomModel() {
	const loader = new GLTFLoader();
	try {
		// const filename = 'RD_background_dense_color_fix.glb';
    const filename = "pointCloud.glb";
		const gltf = await loader.loadAsync(filename);
		roomMesh = gltf.scene;
		roomMesh.name = filename;
		roomMesh.scale.set(1, 1, 1);
    // roomMesh.traverse((object) => {
    //   if (object.isLight) {
    //     object.parent.remove(object);
    //   }
    // });
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

function createLegend() {
  const legend = d3.select("#user-legend")
      .append("svg");

  const data = ["User 1", "User 2", "User 3"];

  const legendItems = legend.selectAll(".legend-item")
      .data(data)
      .enter()
      .append("g")
      .attr("class", "legend-item")
      .attr("transform", (d, i) => `translate(0, ${i * 35})`); // Increase the vertical spacing

  legendItems.append("rect")
      .attr("width", 20) // Increase the width of the rectangles
      .attr("height", 20) // Increase the height of the rectangles
      .attr("rx", 5) // Horizontal corner radius
      .attr("ry", 5) // Vertical corner radius
      .style("fill", d => colorScale(d));

  legendItems.append("text")
      .attr("x", 30) // Increase the horizontal position of the text
      .attr("y", 14) // Increase the vertical position of the text
      .attr("dy", ".35em")
      .style("font-size", "1.1em") // Increase the font size
      .text(d => d);
}

// function createTextSprite(message, fontSize = 30, fontFace = "Arial", textColor = "black", backgroundColor = "#bfbfbf") {
//   const canvas = document.createElement('canvas');
//   const context = canvas.getContext('2d');
//   context.font = `${fontSize}px ${fontFace}`;
//   const metrics = context.measureText(message);
//   const textWidth = metrics.width;
//   canvas.width = textWidth + 10; // Reduced padding
//   canvas.height = fontSize + 10; // Reduced padding

//   // Optional: Draw background
//   context.fillStyle = backgroundColor;
//   context.fillRect(0, 0, canvas.width, canvas.height);

//   // Draw text
//   context.fillStyle = textColor;
//   // Adjust text position based on reduced padding
//   context.fillText(message, 5, fontSize / 2 + 5);

//   // Create texture from canvas
//   const texture = new THREE.CanvasTexture(canvas);
//   // texture.minFilter = THREE.LinearFilter; // Consider using LinearFilter for smoother text
//   // texture.magFilter = THREE.LinearFilter;

//   // Use texture in a sprite
//   const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
//   const sprite = new THREE.Sprite(spriteMaterial);

//   // Calculate aspect ratio of canvas
//   const aspectRatio = canvas.width / canvas.height;
//   const maxSize = 5; // Adjust this value based on your scene requirements

//   // Calculate scale to not exceed maxSize in either dimension
//   const spriteWidth = aspectRatio >= 1 ? maxSize : maxSize * aspectRatio;
//   const spriteHeight = aspectRatio < 1 ? maxSize : maxSize / aspectRatio;

//   // Apply the calculated scale to the sprite
//   sprite.scale.set(spriteWidth, spriteHeight, 1.0);

//   return sprite;
// }

function addTextOverlay(text) {
  const container = document.getElementById('text-overlay');
  const textElement = document.createElement('div');
  textElement.style.padding = '8px';
  textElement.style.margin = '4px';
  // textElement.style.background = 'rgba(255, 255, 255, 0.8)';
  // textElement.style.background ='rgba(255, 255, 255,255)';
  textElement.style.background = '#e0e0e0';
  textElement.style.color = 'black';
  textElement.style.maxWidth = '250px'; // Set a maximum width for text wrapping
  textElement.style.wordWrap = 'break-word';
  textElement.textContent = text;
  textElement.style.borderRadius = '8px';

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
  filteredData.forEach(entry => {
    const spatialExent = entry.spatial_extent;
    const {x,y,z} = getCoordinates(spatialExent);
    avatar.position.x = x ;
    // avatar.position.y = y ;
    avatar.position.z = z ;
    // const euler = new THREE.Euler(THREE.MathUtils.degToRad(spatialExent[1][0]), THREE.MathUtils.degToRad(spatialExent[1][1]), (THREE.MathUtils.degToRad(spatialExent[1][2])), 'XYZ');
    // avatar.rotation.set(0, 0, 0);
    // avatar.setRotationFromEuler(euler);
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
  globalState.camera = new THREE.PerspectiveCamera(70, spatialView.innerWidth / spatialView.innerHeight, 0.1, 1000);
	globalState.camera.position.set(9, 2, 1);
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
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  globalState.scene.add(ambientLight);
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.7);
  directionalLight.position.set(0, 1, 0);
  globalState.scene.add(directionalLight);

  globalState.controls.update();

  const gridHelper = new THREE.GridHelper(10, 10);
  gridHelper.position.y = -1;
  // globalState.scene.add(gridHelper);

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
    // loadAvatarModel('test.glb'),
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
  // const
  globalState.movementData = globalState.finalData.topics_dict["User Transformation"];
  delete globalState.finalData.topics_dict["User Transformation"];
  delete globalState.finalData.topics_dict["Emergency Preparedness and Response"];
  delete globalState.finalData.topics_dict["Disaster Recovery and Resilience"];
  delete globalState.finalData.topics_dict["Transportation Data Analysis"];
  delete globalState.finalData.topics_dict["Infrastructure Data Analysis"];
  delete globalState.finalData.topics_dict["Socioeconomics Data Analysis"];
  delete globalState.finalData.topics_dict["Demographics Data Analysis"];
  delete globalState.finalData.topics_dict["3D Visualization"];
  // globalState.finalData.topics_dict["Infrastructure Resilience"] = globalState.finalData.topics_dict["Infrastructure Resilience and Planning"];
  delete globalState.finalData.topics_dict["Infrastructure Resilience and Planning"];
  
	globalState.avatars = [avatarArray[0], avatarArray[1], avatarArray[2]];
  colorAvatarModel(0);
  colorAvatarModel(1);
  colorAvatarModel(2);


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
  const topicsData = Object.entries(globalState.finalData.topics_dict).flatMap(([topicName, topicDetails]) => {
    return topicDetails.actions.map(action => ({
      topic: topicName,
      startTime: parseTimeToMillis(action.start_time),
      endTime: parseTimeToMillis(action.end_time),
      rawStartTime : action.start_time,
      rawEndTime: action.end_time,
      isUserInterest: topicDetails.is_user_interest,
      hasUserInterestKeyword: action.has_user_interest_keyword
    })).filter(action => action.startTime && action.endTime && action.topic !== "Raw Capture"); // Ensuring we have valid times
  });

  const temporalViewContainer = d3.select("#temporal-view");
  const spatialViewWidth = document.getElementById('spatial-view').clientWidth;
	const temporalViewHeight = document.getElementById('temporal-view').clientHeight;

  const width = document.getElementById('spatial-view').clientWidth - margin.left - margin.right;
  const height = temporalViewHeight - margin.top - margin.bottom;


  const maxHeight = window.innerHeight * 0.8;
  let plotHeight = Math.min(height, maxHeight);
  plotHeight = 360;

  const svgWidth = globalState.dynamicWidth + margin.left + margin.right ;
  const speechPlotSvg = d3.select("#speech-plot-container");
  speechPlotSvg.html("");
  const svg = speechPlotSvg.append('svg')
  .attr('id', 'plot-svg')
  .attr("width", svgWidth)
  // .attr("height", margin.top + margin.bottom + temporalViewHeight)
  .attr("height", margin.top + margin.bottom + plotHeight)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

    svg.append("text")
    .attr("y", -7)
    .attr("x", -30)
    .style("text-anchor", "middle")
    .style("font-weight", "bold")
    .text("Topics");

  const sortedDomain = topicsData.map(d => d.topic).filter(t => t !== "Others");
  if (topicsData.some(d => d.topic === "Others")) {
    sortedDomain.push("Others"); // Ensure "Others" is at the end
  }
   yScale = d3.scaleBand()
    // .rangeRound([0, height])
    .rangeRound([0,plotHeight])
    .padding(0.1)
    .domain(sortedDomain);

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
		  return topic && topic.isUserInterest ? "#80b1d3" : "#000"; // Purple for user interest
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
  //     return isUserInterest ? "#80b1d3" : "#000";
  //   });

    svg.select(".axis--y").selectAll(".tick text")
    .style("cursor", "pointer")
    .style("font-size", "1.3em")
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
  .attr("fill", d => d.hasUserInterestKeyword ? "#80b1d3" : "#d0d0d0");
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
  // svg.select(".axis--y").call(d3.axisLeft(yScale));


  svg.select(".axis--y").call(d3.axisLeft(yScale))
  .selectAll("text")  // Select all text elements of the Y-axis
  .style("font-size", "1.3em");

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
              .attr("fill", d => action.has_user_interest_keyword ? "#80b1d3" : "#d0d0d0");
      });
  });

}
function wrapText(text, width) {
  text.each(function() {
    var text = d3.select(this),
        words = text.text().split(/\s+/).reverse(),
        word,
        line = [],
        lineNumber = 0,
        lineHeight = 1.1, // ems
        y = text.attr("y"),
        dy = parseFloat(text.attr("dy") || 0),
        tspan = text.text(null).append("tspan").attr("x", 0).attr("y", y).attr("dy", dy + "em");
    
    while (word = words.pop()) {
      line.push(word);
      tspan.text(line.join(" "));
      if (tspan.node().getComputedTextLength() > width) {
        line.pop(); // remove the word that was just added
        tspan.text(line.join(" "));
        line = [word]; // start a new line with the removed word
        tspan = text.append("tspan").attr("x", 0).attr("y", y).attr("dy", ++lineNumber * lineHeight + dy + "em").text(word);
      }
    }
  });
}



function plotBarChart() {
  const plotBox1 = d3.select("#plot-box1").html("");
  const margin = { top: 20, right: 20, bottom: 100, left: 40 };
  const width = plotBox1.node().getBoundingClientRect().width - margin.left - margin.right;
  const height = plotBox1.node().getBoundingClientRect().height - margin.top - margin.bottom;

  const svg = plotBox1.append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  let userDataByTopic = {};
  let allUsers = new Set();
  const data = globalState.finalData.topics_dict ;
  delete data["Others"];
  const threshold = 15;

  Object.entries(data).forEach(([topic, details]) => {
    const userCounts = details.actions.reduce((acc, action) => {
        if (action.action_type === "VerbalInteraction") {

          let currentCount = acc[action.actor_name] || 0;
          currentCount = Math.min(currentCount + 1, threshold); // Apply threshold here
          acc[action.actor_name] = currentCount;
          allUsers.add(action.actor_name);
            // acc[action.actor_name] = (acc[action.actor_name] || 0) + 1;
            // allUsers.add(action.actor_name);
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

  console.log(processedData);

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
      .attr("fill", d => colorScale(d.key));

  // Add the axes
  svg.append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x0))
      .selectAll("text")
    .style("text-anchor", "end")
    .attr("dx", "-.8em")
    .attr("dy", ".15em")
    .call(wrapText, x1.bandwidth()+50)
    .attr("transform", "rotate(-65)")
    .style("font-size", "1.2em")
    .style("font-family", "Lato");
    // .style("word-wrap", "break-word")
    // .style("white-space", "normal");

  svg.append("g")
      .attr("class", "axis")
      .call(d3.axisLeft(y));

      svg.append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", 0 - margin.left)
      .attr("x", 0 - (height / 2))
      .attr("dy", "1em")
      .style("text-anchor", "middle")
      .text("Count")
      .style("font-size", "0.8em");
  // Legend
  // const legend = svg.selectAll(".legend")
  //     .data(users)
  //     .enter().append("g")
  //     .attr("class", "legend")
  //     .attr("transform", (d, i) => "translate(0," + i * 20 + ")");

  // legend.append("rect")
  //     .attr("x", width - 18)
  //     .attr("width", 18)
  //     .attr("height", 18)
  //     .style("fill", color);

  // legend.append("text")
  //     .attr("x", width - 24)
  //     .attr("y", 9)
  //     .attr("dy", ".35em")
  //     .style("text-anchor", "end")
  //     .text(d => d);
}


function plotCombinedUsersSpiderChart() {
  const plotBox = d3.select("#plot-box2").html("");
  const margin = { top: 50, right: 140, bottom: 40, left: 140 };
  const width = plotBox.node().getBoundingClientRect().width - margin.left - margin.right - 20 ;
	const height = plotBox.node().getBoundingClientRect().height - margin.top - margin.bottom;
  const svg = plotBox.append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${width / 2 + margin.left}, ${height / 2 + margin.top})`);


  const withoutOther = globalState.finalData.topics_dict ;
  delete withoutOther["Others"];
  const data = Object.values(withoutOther) ;
  let maxCount = 0;
  const threshold = 10;
  let maxCountsPerUser = {};

  data.forEach(topic => {
    topic.actions.forEach(action => {
      if (action.action_type === "VerbalInteraction") {
        if (!maxCountsPerUser[action.actor_name]) {
          maxCountsPerUser[action.actor_name] = {};
        }
        let currentCount = (maxCountsPerUser[action.actor_name][topic.broad_topic_name] || 0) + 1;
        maxCountsPerUser[action.actor_name][topic.broad_topic_name] = Math.min(currentCount, threshold);
        maxCount = Math.max(maxCount, maxCountsPerUser[action.actor_name][topic.broad_topic_name]);
      }
    });
  });

  // console.log(maxCount); // This now reflects the highest count for any user in any single topic

  // Prepare topicsWithCounts array for visualization
  let topicsWithCounts = Object.entries(maxCountsPerUser).flatMap(([user, topics]) =>
    Object.entries(topics).map(([topic, count]) => ({
      user,
      topic,
      count
    }))
  ).filter(entry => entry.count > 0);

  // Filtering unique topics after considering user-specific counts
  const topics = [...new Set(topicsWithCounts.map(entry => entry.topic))];
  const users = Object.keys(maxCountsPerUser);

console.log(topicsWithCounts);
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

  const angleSlice = Math.PI * 2 / topics.length;

  // Draw radial lines and labels
  topics.forEach((topic, index) => {
    const angle = angleSlice * index;
    svg.append("line")
      .attr("x1", 0)
      .attr("y1", 0)
      .attr("x2", rScale(maxCount) * Math.cos(angle - Math.PI/2))
      .attr("y2", rScale(maxCount) * Math.sin(angle - Math.PI/2))
      .style("stroke", "lightgrey");

    const label = svg.append("text")
      .attr("x", rScale(maxCount * 1.43) * Math.cos(angle - Math.PI/2))
      .attr("y", rScale(maxCount * 1.1) * Math.sin(angle - Math.PI/2))
      .text(topic)
      .style("text-anchor", "middle")
      .style("font-size", "0.75em")
      // .call(wrapText, -200)
      .attr("alignment-baseline", "middle");
      if (topic === "Healthcare and Public Services") {
        label.attr("y", rScale(maxCount * 1) * Math.sin(angle - Math.PI/2)); 
    }
    if (topic === "Education and Youth Services") {
      label.attr("x", -200);
    }
    if (topic === "Urban and Housing Development") {
      label.attr("y", rScale(maxCount * 1.3) * Math.sin(angle - Math.PI/2)); 
    }
    if (topic === "Transportation and Commute") {
      label.attr("x",180); 
    }

  });

  const color =colorScale ;

  users.forEach((user, userIndex) => {
    let userData = topics.map(topicKey => {
      const topic = withoutOther[topicKey];
      const actions = topic.actions.filter(action => action.actor_name === user && action.action_type === "VerbalInteraction");
      let count = actions.length;
      count = Math.min(count, threshold); // Apply threshold
      return {topic: topicKey, count};
      });
      // console.log(userData);

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






// function plotTreeMap() {
// 	const plotBox = d3.select("#plot-box3").html("");
// 	const margin = { top: 0, right: 0, bottom: 0, left: 0 };
// 	const width = plotBox.node().getBoundingClientRect().width - margin.left - margin.right;
// 	const height = plotBox.node().getBoundingClientRect().height - margin.top - margin.bottom;


//     let keywordCounts = {};
//     Object.values(globalState.finalData.topics_dict).flatMap(topic => topic.actions).forEach(action => {
//         const actionStartTime = parseTimeToMillis(action.start_time);
//         const actionEndTime = parseTimeToMillis(action.end_time);
//         if (actionEndTime >= globalState.lineTimeStamp1 && actionStartTime <= globalState.lineTimeStamp2 && action.action_type === "VerbalInteraction") {
//             action.data.keywords.forEach(keyword => {
//                 keywordCounts[keyword] = (keywordCounts[keyword] || 0) + 1;
//             });
//         }
//     });
//     const hierarchicalData = {
//         name: "root",
//         children: Object.entries(keywordCounts).map(([keyword, count]) => ({
//             name: keyword,
//             value: count
//         }))
//     };


//     // Select the body for SVG append, set dimensions, and create hierarchical data
//     const svg = plotBox.append('svg')
//         .attr('width', width)
//         .attr('height', height)
//         .style('font', '10px sans-serif');

//     const root = d3.hierarchy(hierarchicalData)
//         .sum(d => d.value) // Here we set the value for each leaf
//         .sort((a, b) => b.value - a.value); // Sort the nodes

//     d3.treemap()
//         .size([width, height])
//         .padding(1)
//         (root);


//         const maxValue = d3.max(root.leaves(), d => d.value);
//         const minValue = 0; // Starting from 0 to ensure the full range of the color scale is used
//         const interpolatePink = d3.interpolateRgb("lightpink", "deeppink");
//         const color = d3.scaleSequential()
//                         .domain([minValue, Math.max(maxValue, minValue )]) // Ensuring there's at least a range of 1
//                         .interpolator(d3.interpolateBlues);


//     // Drawing the rectangles for each node
//     const leaf = svg.selectAll('g')
//         .data(root.leaves())
//         .enter().append('g')
//         .attr('transform', d => `translate(${d.x0},${d.y0})`);

//     leaf.append('rect')
//         .attr('id', d => (d.leafUid = `leaf-${d.data.name}`))
//         // .attr('fill', d => color(d.data.name))
//         .attr('fill', d => color(d.value))
//         .attr('width', d => d.x1 - d.x0)
//         .attr('height', d => d.y1 - d.y0);

//     // Adding text labels to each rectangle
//     leaf.append('text')
//         .selectAll('tspan')
//         .data(d => d.data.name.split(/(?=[A-Z][a-z])|\s+/g)) // Split camelCase and by space
//         .enter().append('tspan')
//         .attr('x', 5) // Positioning text inside rectangle
//         .attr('y', (d, i) => 15 + i * 10) // Positioning text inside rectangle
//         .style('fill', '#fff')
//         .style('font-size', '1.4em')
//         .text(d => d);

//     leaf.append('title')
//         .text(d => `${d.data.name}\nCount: ${d.value}`)
//         .style('font-size', '1.4em');
// }

function plotTreeMap() {
  const plotBox = d3.select("#plot-box3").html("");
  const margin = { top: 20, right: 20, bottom: 60, left: 200 };
  const width = plotBox.node().getBoundingClientRect().width - margin.left - margin.right;
  const height = plotBox.node().getBoundingClientRect().height - margin.top - margin.bottom;

  const svg = plotBox.append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

  let allUsers = new Set();
  const data = globalState.finalData.topics_dict;
  delete data["Others"];

  let userDataByTopic = {};

  Object.entries(data).forEach(([topic, details]) => {
    const userCounts = details.actions.reduce((acc, action) => {
      const actionStartTime = parseTimeToMillis(action.start_time);
      const actionEndTime = parseTimeToMillis(action.end_time);
      if (actionEndTime >= globalState.lineTimeStamp1 && actionStartTime <= globalState.lineTimeStamp2 && action.action_type === "VerbalInteraction") {
        acc[action.actor_name] = (acc[action.actor_name] || 0) + 1;
        allUsers.add(action.actor_name);
      }
      return acc;
    }, {});

    if (Object.keys(userCounts).length > 0) {
      userDataByTopic[topic] = userCounts;
    }
  });

  // Aggregate counts for top 5 topics
  let topicCounts = Object.entries(userDataByTopic).map(([topic, counts]) => ({
    topic,
    total: Object.values(counts).reduce((sum, count) => sum + count, 0)
  })).sort((a, b) => b.total - a.total).slice(0, 5);

  let structuredData = [];
  topicCounts.forEach(({topic}) => {
    Object.entries(userDataByTopic[topic]).forEach(([user, count]) => {
      if (allUsers.has(user)) {
        structuredData.push({topic, user, count});
      }
    });
  });

  const selectedUsers = Array.from(allUsers).slice(0, 3); // Select specific users if needed
  structuredData = structuredData.filter(d => selectedUsers.includes(d.user));

  const y0 = d3.scaleBand()
      .rangeRound([0, height])
      .paddingInner(0.1)
      .domain(topicCounts.map(d => d.topic));

  const y1 = d3.scaleBand()
      .padding(0.05)
      .domain(selectedUsers)
      .rangeRound([0, y0.bandwidth()]);

  const x = d3.scaleLinear()
      .domain([0, d3.max(structuredData, d => d.count)])
      .range([0, width]);


  structuredData.forEach(d => {
    svg.append("rect")
      .attr("x", 0)
      .attr("y", y0(d.topic) + y1(d.user))
      .attr("width", x(d.count))
      .attr("height", y1.bandwidth())
      .attr("fill", colorScale(d.user)); // Use the user's name to determine color
  });

  svg.append("g")
      .call(d3.axisLeft(y0))
      .selectAll(".tick text") // Select all tick texts
      .style("font-family", "Lato")
      .style("font-size", "1.2em");

  svg.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x));

      svg.append("text")
      .attr("transform", `translate(${width / 2}, ${height + margin.bottom - 20})`) // Center at the end of the x-axis
      .style("text-anchor", "middle")
      .text("Count")
      .style("font-size", "0.8em");
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
	let height = parseInt(d3.select("#speech-plot-container").style("height")) ;
  height = 430;
  // console.log(height);
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
  function dragged(event,d) {
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
    // plotSpatialExtent();
    createAvatarSegment(0);
    createAvatarSegment(1);
    createAvatarSegment(2);
    updateSceneBasedOnSelections();
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
  updateXRSnapshot();
  // plotSpatialExtent();
  // initializeShadedAreaDrag();



}

function initializeShadedAreaDrag() {
  const indicatorSVG = d3.select("#indicator-svg");
  const shadedArea = indicatorSVG.select(".shading");

  let dragStartX = null;

  const dragstarted = (event) => {
    dragStartX = event.x;
    // console.log("Pre-Drag - x scale domain:", x.domain(), "x scale range:", x.range());
  };

  function dragged(event,d) {
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
  updateXRSnapshot();
  generateHierToolBar();
  plotTreeMap();
  createAvatarSegment(0);
  createAvatarSegment(1);
  createAvatarSegment(2);
  updateSceneBasedOnSelections();

  dragStartX = event.x;

}

function dragended(event, d) {
  // let finalXPosition = event.x - margin.left;
  // let correctedTimestamp = x.invert(finalXPosition);
  // let expectedXPosition = x(correctedTimestamp);
  // buffer = Math.abs(finalXPosition - expectedXPosition)
  // console.log(finalXPosition  + " , " + expectedXPosition + ", " + "ended drag");


  // d3.select(this).classed("active", false);
}

  const drag = d3.drag()
    .on("start", dragstarted)
    .on("drag", dragged)
    .on("end", dragended);


  shadedArea.call(drag);

}








function generateHierToolBar() {

	const data = globalState.finalData.topics_dict ;
	const {"Raw Capture": omitted, ...newData} = data;

  const toolbar = document.getElementById('hier-toolbar');
  toolbar.innerHTML = '';

  let othersTopicDetails = null;

  Object.entries(newData).forEach(([topicName, topicDetails]) => {
      const isInTimeRange = topicDetails.actions.some(action => {
          const actionStartTime = parseTimeToMillis(action.start_time);
          const actionEndTime = parseTimeToMillis(action.end_time);
          return actionEndTime >= globalState.lineTimeStamp1 && actionStartTime <= globalState.lineTimeStamp2;
      });

      if (isInTimeRange) {
        if (topicName !== "Others") {
          createTopicItem(topicName, topicDetails, toolbar);
        }
        else {

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
    label.innerHTML = `${topicName} <span style="color: #80b1d3;">★</span>`;
      label.style.color = '#80b1d3';}

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
  // console.log(action);
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
      keywordLabel.style.color = '#80b1d3'; // Purple color for text
    }


    keywordItem.appendChild(keywordCheckbox);
    keywordItem.appendChild(keywordLabel);
    keywordsList.appendChild(keywordItem);
  });

  topicItem.appendChild(keywordsList);
  toolbar.appendChild(topicItem);
  topicCheckbox.addEventListener('change', function() {
    const childCheckboxes = this.parentNode.querySelectorAll('.keyword-checkbox');
    childCheckboxes.forEach(childCheckbox => {
      childCheckbox.checked = this.checked;
      childCheckbox.dispatchEvent(new Event('change'));
    });
  });
}


function createOthersItem(othersData, toolbar) {
  // console.log("here?");
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
}



function initializeOrUpdateSpeechBox() {
  const data = globalState.finalData.topics_dict; // Assuming this is the correct data structure
  const container = document.getElementById("speech-box");
  const hierToolbar = document.getElementById('hier-toolbar');
  let offsetHeight = hierToolbar.offsetHeight;
  const timeFormat = d3.timeFormat("%b %d %I:%M:%S %p");
  // container.style.marginTop = `${offsetHeight}px`;
  container.style.top = `${offsetHeight}px`;

  let rangeDisplay = document.querySelector('.time-range-display-speechbox');
  if (!rangeDisplay) {
      rangeDisplay = document.createElement('div');
      rangeDisplay.className = 'time-range-display-speechbox';
      container.appendChild(rangeDisplay);
  }
  rangeDisplay.style.marginTop = "10px";
  rangeDisplay.style.marginBottom = "10px";
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
  // speechBox.style.borderRadius = '8px'; // Rounded corners
  speechBox.style.padding = '15px';
  speechBox.style.marginBottom = '8px';
	speechBox.style.marginRight = '8px';
	speechBox.style.marginLeft = '8px';

  const hasRelevantKeyword = selectedKeywords.some(keyword => action.data.keywords.includes(keyword));
  if (!hasRelevantKeyword) {
		return null;
	  }

  // Speaker Element
  const speakerEl = document.createElement('div');
  speakerEl.className = 'speaker';
  speakerEl.textContent = `[${action.actor_name}]`;

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
      const highlightedText = `<span style="background-color: #80b1d3; color: white;">${text}</span>`;
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
  topicInterestSpan.style.fontWeight = "bold";

  // Create "Next user interest topic" span
  const nextInterestSpan = document.createElement("span");
  nextInterestSpan.textContent = userInterestTopic;
  // nextInterestSpan.style.color = "#ffc000";
  nextInterestSpan.style.color = "#333333";
  nextInterestSpan.style.fontWeight = "bold";

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


function updateXRSnapshot() {

const rawCaptureData = globalState.finalData.topics_dict["Raw Capture"];
  const container = document.getElementById('user-xr-snapshot');
  container.innerHTML = '';
  const titleElement = document.createElement('div');
  titleElement.style.textAlign = 'center';
  titleElement.style.marginBottom = '5px';
  titleElement.style.marginTop = '5px';
  titleElement.id = 'imageTitle';
  container.appendChild(titleElement);

  if (rawCaptureData && rawCaptureData.actions && rawCaptureData.actions.length > 0) {
    const filteredActions = rawCaptureData.actions.filter(action => {
      const actionStartTime = parseTimeToMillis(action.start_time);
      const actionEndTime = parseTimeToMillis(action.end_time);
      return actionEndTime >= globalState.lineTimeStamp1 && actionStartTime <= globalState.lineTimeStamp2;
    });

    if (filteredActions.length >= 1) {
      const imageWrapper = document.createElement('div');
      imageWrapper.style.position = 'relative';


      filteredActions.forEach((action, index) => {
        const imagePath = action.actor_name + '\\' + action.specific_action_data;
        const img = document.createElement('img');
        img.src = imagePath;
        img.alt = "Raw Capture Image";
        img.style.width = '360px';
        img.style.height = '240px';
        img.style.display = index === 0 ? 'block' : 'none';
        imageWrapper.appendChild(img);
      });

      updateTitle(filteredActions[0].actor_name);

      container.appendChild(imageWrapper);

      // Navigation arrows functionality
      addNavigationArrows(imageWrapper, filteredActions);
    } else {
      titleElement.innerHTML = 'No images available';
    }
  } else {
    titleElement.innerHTML = 'No raw capture data available';
  }
}

function addNavigationArrows(imageWrapper, filteredActions) {
  const prevArrow = document.createElement('button');
  prevArrow.innerHTML = '&#10094;';
  prevArrow.style.position = 'absolute';
  prevArrow.style.top = '50%';
  prevArrow.style.left = '10px';
  prevArrow.style.zIndex = '10';
  prevArrow.style.cursor = 'pointer';

  const nextArrow = document.createElement('button');
  nextArrow.innerHTML = '&#10095;';
  nextArrow.style.position = 'absolute';
  nextArrow.style.top = '50%';
  nextArrow.style.right = '10px';
  nextArrow.style.zIndex = '10';
  nextArrow.style.cursor = 'pointer';

  let currentIndex = 0;
  prevArrow.onclick = () => {
    currentIndex = (currentIndex - 1 + filteredActions.length) % filteredActions.length;
    changeImage(currentIndex, imageWrapper, filteredActions);
  };

  nextArrow.onclick = () => {
    currentIndex = (currentIndex + 1) % filteredActions.length;
    changeImage(currentIndex, imageWrapper, filteredActions);
  };

  imageWrapper.appendChild(prevArrow);
  imageWrapper.appendChild(nextArrow);
}

function changeImage(index, imageWrapper, filteredActions) {
  Array.from(imageWrapper.getElementsByTagName('img')).forEach((img, imgIndex) => {
    img.style.display = imgIndex === index ? 'block' : 'none';
  });
  // Update the title with the actor name of the current image
  updateTitle(filteredActions[index].actor_name);
}

function updateTitle(actorName) {
  const titleElement = document.getElementById('imageTitle');
  if (titleElement) {
    titleElement.innerHTML = `${actorName} XR Snapshot`;
  }
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
		// .attr('class', 'interactive')
      .attr("fill-opacity", 0.5);

  const timeFormat = d3.timeFormat("%b %d %I:%M:%S %p");
  const rangeDisplay = document.getElementById("range-display");
  if (rangeDisplay) {
    rangeDisplay.textContent = `Selected Time Range: ${timeFormat(new Date(time1))} - ${timeFormat(new Date(time2))}`;
  }
}

// function initializeShadedAreaDrag() {
//   const indicatorSVG = d3.select("#indicator-svg");
//   const shadedArea = indicatorSVG.select(".shading");

//   let dragStartX = null;

//   const dragstarted = (event) => {
//     dragStartX = event.x;
//     console.log("Pre-Drag - x scale domain:", x.domain(), "x scale range:", x.range());
//   };

//   const dragged = (event) => {
//     const dx = event.x - dragStartX;
//     // console.log("Dragging - Raw dx:", dx);
//     const line1 = indicatorSVG.select("#time-indicator-line1");
//     const line2 = indicatorSVG.select("#time-indicator-line2");
//     const circle1 = indicatorSVG.select("#time-indicator-circle1");
//     const circle2 = indicatorSVG.select("#time-indicator-circle2");
//     let line1X = parseFloat(line1.attr("x1"));
//     let line2X = parseFloat(line2.attr("x1"));
//     // console.log("Dragging - New line positions:", line1X + dx, line2X + dx);

//     // Update positions based on drag
//     line1.attr("x1", line1X + dx).attr("x2", line1X + dx);
//     line2.attr("x1", line2X + dx).attr("x2", line2X + dx);
//     circle1.attr("cx", line1X + dx);
//     circle2.attr("cx", line2X + dx);

//   const newLine1Timestamp = x.invert(line1X + dx);
//   const newLine2Timestamp = x.invert(line2X + dx);

//   globalState.lineTimeStamp1 = newLine1Timestamp.getTime();
//   globalState.lineTimeStamp2 = newLine2Timestamp.getTime();

//     console.log("INITIALIZE Line 1 At this timestamp" + new Date(globalState.lineTimeStamp1) + " have this position " + line1X + dx);
//     console.log("INITIALIZE Line 1 At this timestamp" + new Date(globalState.lineTimeStamp2) + " have this position " + line2X + dx);


//   updateRangeDisplay(newLine1Timestamp, newLine2Timestamp);
//   updateXRSnapshot();
//   generateHierToolBar();
//   plotTreeMap();
//   createAvatarSegment(0);
//   createAvatarSegment(1);
//   createAvatarSegment(2);
//   updateSceneBasedOnSelections();

//   dragStartX = event.x;

// };

//   const dragended = () => {
//     console.log("Drag ended - x scale domain:", x.domain(), "range:", x.range());
//   };

//   const drag = d3.drag()
//     .on("start", dragstarted)
//     .on("drag", dragged)
//     .on("end", dragended);


//   shadedArea.call(drag);

// }



function createSharedAxis() {
  const { globalStartTime, globalEndTime, bins, unit } = globalState;
  const temporalViewContainer = d3.select("#temporal-view");
  const minWidth = document.getElementById('temporal-view').clientWidth - margin.left - margin.right;
  let sharedAxisContainer = temporalViewContainer.select("#shared-axis-container");
  if (sharedAxisContainer.empty()) {
    sharedAxisContainer = temporalViewContainer.append("div").attr("id", "shared-axis-container");
  }

  sharedAxisContainer.html("");
  const timeFormat = d3.timeFormat("%I:%M:%S");
  const totalDuration = globalEndTime - globalStartTime;
  let intervalSizeMillis;
  if (unit === 'minutes') {
    intervalSizeMillis = bins * 60 * 1000;
  } else {
    intervalSizeMillis = bins * 1000;
  }

  const totalDurationMillis = globalEndTime - globalStartTime;
  const numberOfIntervals = Math.ceil(totalDurationMillis / intervalSizeMillis);
  const widthPerInterval = 80; // Fixed width for each interval

  const intervalDuration = totalDuration * (bins / 100);
  globalState.dynamicWidth = numberOfIntervals * widthPerInterval;
  globalState.dynamicWidth = Math.max(globalState.dynamicWidth, minWidth);

  x = d3.scaleTime()
      .domain([new Date(globalStartTime), new Date(globalEndTime)])
      .range([0, globalState.dynamicWidth]);


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
  globalState.bins = binsDropdown.value;
  createLegend();
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
  // plotSpatialExtent();
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