import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { screwPoses } from "./bin_of_screws.js";

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

// const transformControls = new TransformControls(camera, renderer.domElement);
// scene.add(transformControls);

// transformControls.addEventListener('dragging-changed', event => {
//   controls.enabled = !event.value;
// });

const axisSize = 1000000;
const axesHelper = new THREE.AxesHelper(axisSize);
scene.add(axesHelper);

// --------------------------------- LIGHT --------------------------------- //
const light1 = new THREE.DirectionalLight(0xffffff, 1);
light1.position.set(500, 500, 500);
scene.add(light1);
const light2 = new THREE.DirectionalLight(0xffffff, 1);
light2.position.set(-500, 500, 500);
scene.add(light2);
const light3 = new THREE.DirectionalLight(0xffffff, 1);
light3.position.set(0, 500, -500);
scene.add(light3);
const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
scene.add(ambientLight);

const light1Helper = new THREE.DirectionalLightHelper(light1);
scene.add(light1Helper);
const light2Helper = new THREE.DirectionalLightHelper(light2);
scene.add(light2Helper);
const light3Helper = new THREE.DirectionalLightHelper(light3);
scene.add(light3Helper);

// ------------------------------ STL LOADER ------------------------------- //
const loader = new STLLoader();
const loadedMeshes = [];
const modelList = document.getElementById('modelList');


// --------------------------------- MAIN ---------------------------------- //
let selectedMesh = null;

// document.getElementById('modeSelector').addEventListener('change', (e) => {
//   transformControls.setMode(e.target.value);
// });

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
    mesh.name = file.name;
    scene.add(mesh);
    loadedMeshes.push(mesh);
    addModelToList(file.name, mesh);
    fitCameraToAllObjects();
  };
  reader.readAsArrayBuffer(file);
}

function loadDefaultSTL(){
  loader.load(
    // "resources/bottom_screws.stl",
    "resources/bin_of_screws_v3ScrewModel_WObin.stl",
    function(geometry){
      const material = new THREE.MeshPhongMaterial({
        color: 0xcccccc,
        specular: 0x444444, 
        shininess:200
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = 'starter_model';
      scene.add(mesh);
      loadedMeshes.push(mesh);
      addModelToList('starter_model', mesh);
      mesh.rotation.x = -Math.PI/2;
      fitCameraToAllObjects();
    })
}

function loadScrews() {
  // console.log (screwPoses);
  let screw_count = 0;
  // let positionOffset = 0;
  // let angleOffset = 0;
  // // read m12 screw model
  const baseMaterial = new THREE.MeshPhongMaterial({
    color: 0xcccccc,
    specular: 0x444444,
    shininess: 200,
  });
  const objectAxes = new THREE.AxesHelper(50);
  objectAxes.visible = false;
  // const baseMaterial = new THREE.MeshBasicMaterial({
  //   color: 0xcccccc,
  // });
    loader.load(
      "resources/m12_screw_detailed.stl",
      function (geometry) {
        for (let i=0; i< screwPoses.length; i+=1){
          if(i===0) continue;
          // NOTE: super important to say baseMaterial.clone() otherwise the 
          // colour of all the models gets linked to baseMaterial
          const mesh = new THREE.Mesh(geometry, baseMaterial.clone());
          mesh.add(objectAxes.clone());
          // mesh.name = "screw_" + screw_count;
          mesh.name = `screw_${screw_count}`;
          mesh.position.x = screwPoses[i].position.x*1000; 
          mesh.position.y = screwPoses[i].position.y*1000; 
          mesh.position.z = screwPoses[i].position.z*1000 - 50; 
          mesh.rotation.x = screwPoses[i].orientation.rx;
          mesh.rotation.y = screwPoses[i].orientation.ry;
          mesh.rotation.z = screwPoses[i].orientation.rz;
          scene.add(mesh);
          loadedMeshes.push(mesh);
          addModelToList(mesh.name, mesh);
          // positionOffset += 50;
          // angleOffset += Math.PI/6;
          // angleOffset += 30;
          screw_count += 1;
        }
        fitCameraToAllObjects();
      }
    );

  }

document.getElementById('fileInput').addEventListener('change', (e) => {
  const files = e.target.files;
  for (let i = 0; i < files.length; i++) {
    loadSTL(files[i]);
  }
});

// const raycaster = new THREE.Raycaster();
// const mouse = new THREE.Vector2();
// let highlightedObject = null;
// let highlightedObjectColor = null;

// Hover label (top-centered, white text, no background)
const hoverLabel = document.createElement('div');
hoverLabel.id = 'hover-label';
hoverLabel.style.position = 'fixed';
hoverLabel.style.top = '16px';
hoverLabel.style.left = '50%';
hoverLabel.style.transform = 'translateX(-50%)';
hoverLabel.style.color = '#ffffff';
hoverLabel.style.fontSize = '28px';
hoverLabel.style.fontFamily = 'sans-serif';
hoverLabel.style.pointerEvents = 'none';
hoverLabel.style.userSelect = 'none';
hoverLabel.style.zIndex = '1000';
hoverLabel.style.display = 'none';
document.body.appendChild(hoverLabel);


// ----------------------------------------------------------------------------
//
// object transform controls
//
// ----------------------------------------------------------------------------
// function onClick(event) {
//   if (transformControls.dragging) return;
//   const rect = renderer.domElement.getBoundingClientRect();
//   mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
//   mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  
//   raycaster.setFromCamera(mouse, camera);
//   const intersects = raycaster.intersectObjects(loadedMeshes);
  
//   if (intersects.length > 0) {
//     if (selectedMesh) transformControls.detach(selectedMesh);
//     selectedMesh = intersects[0].object;
//     // console.log(selectedMesh.name)
//     transformControls.attach(selectedMesh);
//   } else {
//     transformControls.detach(selectedMesh);
//     selectedMesh = null;
//   }
// }

// ----------------------------------------------------------------------------
//
// object highlighting
//
// ----------------------------------------------------------------------------
function onPointerMove(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(loadedMeshes, false);
  if (intersects.length > 0) {
    const obj = intersects[0].object;
    hoverLabel.textContent = obj.name || '';
    hoverLabel.style.display = hoverLabel.textContent ? 'block' : 'none';

    // --- colour swap ---
    if (highlightedObject !== obj) {
      if (highlightedObject === null) {
        // no cached object, need to highlight current object
        // console.log("null to object change");
        highlightedObject = obj; // cache object
        highlightedObjectColor = obj.material.color; // cache object colour
        obj.material.color = new THREE.Color(0, 1, 0); // apply highlight colour
      } else {
        // cached object not same as current object, not null, 
        // => must be differnt object, need to change highlighted object
        // console.log("object to object change");
        highlightedObject.material.color = highlightedObjectColor; // apply cached colour to cached object 
        highlightedObject = obj; // cache current object
        highlightedObjectColor = obj.material.color; // cache current object colour
        obj.material.color = new THREE.Color(0, 1, 0); // apply highlight colour
      }
    } else{
      return;
      // current obj === highlightedObject -> no need to change
    }
  } else {
    hoverLabel.style.display = 'none';
    if (highlightedObject !== null) { // if not on object and cache is full
      // console.log(highlightedObject);
      highlightedObject.material.color = highlightedObjectColor;// restore colour of cached object
      highlightedObject = null;// empty the cache
    } else {}
  }
}

// ----------------------------------------------------------------------------
//
// change model colour when clicked
//
// ----------------------------------------------------------------------------
function onMouseDown(event){
  // const coords = new THREE.Vector2(
    //   -1 + 2 * (event.clientX / renderer.domElement.clientWidth),
    //   1 - 2 * (event.clientY / renderer.domElement.clientHeight),  
  // );
  const rect = renderer.domElement.getBoundingClientRect();
  const coords = new THREE.Vector2(
   ((event.clientX - rect.left) / rect.width) * 2 - 1,
  -((event.clientY - rect.top) / rect.height) * 2 + 1,
  );
  
  rc2.setFromCamera(coords, camera);
  const intersections = rc2.intersectObjects(scene.children, true);
  
  if (intersections.length > 0) {
    const selectedObject = intersections[0].object;
    if (selectedObject.type != "Mesh") return;
    // const color = new THREE.Color(Math.random(), Math.random(), Math.random());
    // selectedObject.material.color = color;
    console.log(`${selectedObject.name} selected!`);
    selectedObject.children[0].visible = !selectedObject.children[0].visible;
    // selectedObject.material.wireframe = !selectedObject.material.wireframe;
    // selectedObject.material.emissiveIntensity = 0.2;
    // selectedObject.material.emissive = new THREE.Color(0xff0000);
    // DOESNT WORK
    // selectedObject.material.transparent = true;
    // DOESNT WORK
    // selectedObject.material.opacity = 0.2;

    // selectedObject.material.opacity = 0.1;


    // console.log(selectedObject);
    const euler = new THREE.Euler();
    // const pos = new THREE.Vector3();
    const pos = selectedObject.position;
    euler.setFromQuaternion(selectedObject.quaternion);
    console.log(
      'position:\n', pos.x, pos.y, pos.z,
      '\norientation:\n', euler.x*180/Math.PI, euler.y*180/Math.PI, euler.z*180/Math.PI);
    // console.log(selectedObject.position);
    // console.log(euler);

  }
}

// %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
// %                                                                          %
// %                                   MAIN                                   %
// %                                                                          %
// %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let highlightedObject = null;
let highlightedObjectColor = null;

// event - attach transform screen controls to object
// --------------------------------------------------
// renderer.domElement.addEventListener('pointerdown', onClick); // don't use
// renderer.domElement.addEventListener('pointerup', onClick);
// event - highlight model that is being pointed with mouse
// --------------------------------------------------------
renderer.domElement.addEventListener('pointermove', onPointerMove);
const rc2 = new THREE.Raycaster();
// event - change model colour when clicked
// ----------------------------------------
document.addEventListener('mousedown', onMouseDown);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// loadDefaultSTL();
loadScrews();

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();

