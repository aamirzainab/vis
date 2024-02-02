import * as THREE from "https://cdn.skypack.dev/three@0.132.2";
import { OBJLoader } from "https://cdn.skypack.dev/three@0.132.2/examples/jsm/loaders/OBJLoader.js"

const fileInput = document.getElementById("fileInput");
const viewerContainer = document.getElementById("viewer-container");
let currentModel = null; 
let zoomFactor = 1.0; 

fileInput.addEventListener("change", handleFileUpload);

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            const objData = e.target.result;

            // Remove the current 3D model, if any
            if (currentModel) {
                viewerContainer.removeChild(currentModel);
                currentModel = null;
            }

            // Reset the zoom factor
            zoomFactor = 1.0;

            // Render the new 3D model
            renderObjModel(objData);
        };
        reader.readAsText(file);
    }
}

function renderObjModel(objData) {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);

    const modelContainer = document.createElement("div");
    modelContainer.appendChild(renderer.domElement);
    viewerContainer.appendChild(modelContainer);

    const loader = new OBJLoader();
    const obj = loader.parse(objData);
    scene.add(obj);

    camera.position.z = 5;
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(0, 0, 1);
    scene.add(directionalLight);

    // Variables for handling interaction
    let isDragging = false;
    let previousMouseX = 0;
    let previousMouseY = 0;

    modelContainer.addEventListener("mousedown", (e) => {
        isDragging = true;
        previousMouseX = e.clientX;
        previousMouseY = e.clientY;
    });

    window.addEventListener("mouseup", () => {
        isDragging = false;
    });

    window.addEventListener("mousemove", (e) => {
        if (!isDragging) return;
        const deltaX = e.clientX - previousMouseX;
        const deltaY = e.clientY - previousMouseY;
        obj.rotation.x += deltaX * 0.01;
        obj.rotation.y += deltaY * 0.01;
        previousMouseX = e.clientX;
        previousMouseY = e.clientY;
    });

    // Zoom controls using mouse wheel or touchpad gestures
    modelContainer.addEventListener("wheel", (e) => {
        zoomFactor -= e.deltaY * 0.001;
        zoomFactor = Math.max(0.1, zoomFactor); // Prevent zooming in too close
        camera.position.z = 5 * zoomFactor; // Adjust camera position based on zoom factor
    });

    // Animation loop
    const animate = function () {
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
    };

    animate();

    currentModel = modelContainer;
}
