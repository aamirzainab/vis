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
            if (currentModel) {
                viewerContainer.removeChild(currentModel);
                currentModel = null;
            }
            zoomFactor = 1.0;
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

    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    obj.position.x = -center.x;
    obj.position.y = -center.y;
    obj.position.z = -center.z;

    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / 2 * Math.tan(fov / 2));
    camera.position.z = cameraZ * 1.5; 

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(0, 0, 1);
    scene.add(directionalLight);

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
        obj.rotation.y += deltaX * 0.01; 
        obj.rotation.x += deltaY * 0.01; 
        previousMouseX = e.clientX;
        previousMouseY = e.clientY;
    });

    modelContainer.addEventListener("wheel", (e) => {
        const zoomIntensity = 0.1;
        zoomFactor -= e.deltaY * zoomIntensity;
        zoomFactor = Math.max(0.1, Math.min(100, zoomFactor)); 
        
        let adjustedCameraZ = cameraZ * zoomFactor; 
        camera.position.z = Math.max(adjustedCameraZ, maxDim * 0.1); 
    });

    const animate = function () {
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
    };

    animate();

    currentModel = modelContainer;
}
