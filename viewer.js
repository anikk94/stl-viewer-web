import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
    
// THREE JS SETUP
const canvas = document.getElementById('viewer');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x111111);

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, 5);

// OrbitControls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
// controls.dampingFactor = 0.05;
controls.dampingFactor = 0.2;

// Add a grid to the scene
const grid = new THREE.GridHelper(200, 20, 0x888888, 0x444444); // size 20, divisions 20
// const grid = new GridHelper(20, 20, 0x888888, 0x444444); // size 20, divisions 20
scene.add(grid);

const transformControls = new TransformControls(camera, renderer.domElement);
scene.add(transformControls);

transformControls.addEventListener('dragging-changed', event => {
  controls.enabled = !event.value;
});

const axesHelper = new THREE.AxesHelper(2);
scene.add(axesHelper);

// --------------------------------- LIGHT --------------------------------- //
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(1, 1, 2);
scene.add(light);
scene.add(new THREE.AmbientLight(0x404040));

// ------------------------------ STL LOADER ------------------------------- //
const loader = new STLLoader();
const loadedMeshes = [];
const modelList = document.getElementById('modelList');


// --------------------------------- MAIN ---------------------------------- //
let selectedMesh = null;

document.getElementById('modeSelector').addEventListener('change', (e) => {
  transformControls.setMode(e.target.value);
});

function fitCameraToAllObjects() {
  if (loadedMeshes.length === 0) return;
  const box = new THREE.Box3();
  loadedMeshes.forEach(mesh => box.expandByObject(mesh));
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const fitDistance = maxDim / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
  camera.position.copy(center.clone().add(new THREE.Vector3(0, 0, fitDistance * 1.5)));
  camera.near = fitDistance / 100;
  camera.far = fitDistance * 100;
  camera.updateProjectionMatrix();
  controls.target.copy(center);
  controls.update();
}

function getRandomColor() {
  return new THREE.Color(Math.random(), Math.random(), Math.random());
}

function addModelToList(fileName, mesh) {
  const div = document.createElement('div');
  div.className = 'model-entry';

  const nameSpan = document.createElement('span');
  nameSpan.textContent = fileName;
  nameSpan.style.color = `#${mesh.material.color.getHexString()}`;
  nameSpan.addEventListener('click', () => {
    mesh.visible = !mesh.visible;
    nameSpan.style.opacity = mesh.visible ? 1 : 0.5;
  });

  const removeButton = document.createElement('button');
  removeButton.textContent = 'X';
  removeButton.addEventListener('click', () => {
    scene.remove(mesh);
    const index = loadedMeshes.indexOf(mesh);
    if (index > -1) loadedMeshes.splice(index, 1);
    div.remove();
    fitCameraToAllObjects();
  });

  div.appendChild(nameSpan);
  div.appendChild(removeButton);
  modelList.appendChild(div);
}

function loadSTL(file) {
  const reader = new FileReader();
  reader.onload = function(event) {
    const geometry = loader.parse(event.target.result);
    const material = new THREE.MeshPhongMaterial({ color: getRandomColor(), specular: 0x555555, shininess: 30 });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);
    loadedMeshes.push(mesh);
    addModelToList(file.name, mesh);
    fitCameraToAllObjects();
  };
  reader.readAsArrayBuffer(file);
}

function loadDefaultSTL(){
  loader.load(
    "bottom_screws.stl",
    function(geometry){
      const material = new THREE.MeshPhongMaterial({
        color: 0xcccccc,
        specular: 0x444444, 
        shininess:200
      });
      const mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);
      loadedMeshes.push(mesh);
      addModelToList('starter_model', mesh);
      fitCameraToAllObjects();
    })
}

document.getElementById('fileInput').addEventListener('change', (e) => {
  const files = e.target.files;
  for (let i = 0; i < files.length; i++) {
    loadSTL(files[i]);
  }
});

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function onClick(event) {
  if (transformControls.dragging) return;
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(loadedMeshes);
  
  if (intersects.length > 0) {
    if (selectedMesh) transformControls.detach(selectedMesh);
    selectedMesh = intersects[0].object;
    console.log(selectedMesh.name)
    transformControls.attach(selectedMesh);
  } else {
    transformControls.detach(selectedMesh);
    selectedMesh = null;
  }
}

// renderer.domElement.addEventListener('pointerdown', onClick);
renderer.domElement.addEventListener('pointerup', onClick);



window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

loadDefaultSTL();

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();
