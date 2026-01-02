import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { screwPoses, getScrewPoses } from "./read_input_data.js";
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';


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
// scene.add(grid);

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

if (0){
  const light1Helper = new THREE.DirectionalLightHelper(light1);
  scene.add(light1Helper);
  const light2Helper = new THREE.DirectionalLightHelper(light2);
  scene.add(light2Helper);
  const light3Helper = new THREE.DirectionalLightHelper(light3);
  scene.add(light3Helper);
}

// ------------------------------ STL LOADER ------------------------------- //
const objLoader = new OBJLoader();
const loader = new STLLoader();
const loadedMeshes = [];
const modelList = document.getElementById('modelList');
const annotatePartButton = document.getElementById('annotatePart');
const renameModal = document.getElementById('renameModal');
const renameCurrentName = document.getElementById('renameCurrentName');
const renameInput = document.getElementById('renameInput');
const renameSubmit = document.getElementById('renameSubmit');
const renameCancel = document.getElementById('renameCancel');
const renameError = document.getElementById('renameError');

let renameMode = false;
let renameTarget = null;

const exporter = new STLExporter();


const _tmpAxes = [];
const _tmpEdge = new THREE.Vector3();
const _tmpAxis = new THREE.Vector3();
const _triANormal = new THREE.Vector3();
const _triBNormal = new THREE.Vector3();

function trianglesOverlapSAT(triA, triB) {
  _tmpAxes.length = 0;

  triA.getNormal(_triANormal);
  triB.getNormal(_triBNormal);
  _tmpAxes.push(_triANormal.clone(), _triBNormal.clone());

  const edgesA = [
    _tmpEdge.clone().subVectors(triA.b, triA.a),
    _tmpEdge.clone().subVectors(triA.c, triA.b),
    _tmpEdge.clone().subVectors(triA.a, triA.c),
  ];
  const edgesB = [
    _tmpEdge.clone().subVectors(triB.b, triB.a),
    _tmpEdge.clone().subVectors(triB.c, triB.b),
    _tmpEdge.clone().subVectors(triB.a, triB.c),
  ];

  for (const ea of edgesA) {
    for (const eb of edgesB) {
      _tmpAxis.crossVectors(ea, eb);
      if (_tmpAxis.lengthSq() > 1e-10) _tmpAxes.push(_tmpAxis.clone().normalize());
    }
  }

  const ptsA = [triA.a, triA.b, triA.c];
  const ptsB = [triB.a, triB.b, triB.c];

  for (const axis of _tmpAxes) {
    let minA = Infinity, maxA = -Infinity;
    let minB = Infinity, maxB = -Infinity;

    for (const p of ptsA) {
      const proj = p.dot(axis);
      minA = Math.min(minA, proj);
      maxA = Math.max(maxA, proj);
    }
    for (const p of ptsB) {
      const proj = p.dot(axis);
      minB = Math.min(minB, proj);
      maxB = Math.max(maxB, proj);
    }

    if (maxA < minB || maxB < minA) return false; // separating axis
  }
  return true;
}


// ------------------------------ FUNCTIONS -------------------------------- //
let selectedMesh = null;

// document.getElementById('modeSelector').addEventListener('change', (e) => {
//   transformControls.setMode(e.target.value);
// });

function exportCombinedSTL(){
  if(!loadedMeshes.length) return;
  const meshesToExport = loadedMeshes.map((mesh) =>{
    const geo = mesh.geometry.clone();
    mesh.updateMatrixWorld(true);
    geo.applyMatrix4(mesh.matrixWorld);
    return new THREE.Mesh(geo);
  });

  const exportScene = new THREE.Scene();
  meshesToExport.forEach((mesh) => exportScene.add(mesh));

  const stlData = exporter.parse(exportScene, { binary: true });
  const blob = new Blob([stlData], { type: 'application/octed-stream' });
  
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `combined_${new Date().toISOString().replace(/[:.]/g, '-')}.stl`;
  link.click();
  URL.revokeObjectURL(link.href);
}



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

  mesh.userData = mesh.userData || {};
  mesh.userData.nameSpan = nameSpan;
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
      // "resources/m12_screw_BC_v3.stl",
      function (geometry) {
        for (let i=0; i< screwPoses.length; i+=1){
          // skip the first pose if the pose is of the world or the bin
          // dont skip if the input data is only poses of screws
          // if(i===0) continue;
          // NOTE: super important to say baseMaterial.clone() otherwise the 
          // colour of all the models gets linked to baseMaterial
          const mesh = new THREE.Mesh(geometry, baseMaterial.clone());
          mesh.add(objectAxes.clone());
          // mesh.name = "screw_" + screw_count;
          mesh.name = `screw_${screw_count}`;

          mesh.position.x = screwPoses[i].position.x*1000; // m to mm
          mesh.position.y = screwPoses[i].position.y*1000; // m to mm
          mesh.position.z = screwPoses[i].position.z*1000; // m to mm
          mesh.rotation.x = screwPoses[i].orientation.rx;
          mesh.rotation.y = screwPoses[i].orientation.ry;
          mesh.rotation.z = screwPoses[i].orientation.rz;

          scene.add(mesh);
          mesh.arrow = attachVector(mesh);
          mesh.arrow.visible = false;
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
  
function loadScrewsOBJ() {
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
  objLoader.load(
    // "resources/m12_screw_detailed.stl",
    "resources/m12_screw_bounding_cylinder_vhacd.obj",
    function (obj) {
      obj.traverse((child) => {
        if (!child.isMesh) return;
        // Ensure each mesh has its own material instance.
        child.material = baseMaterial.clone();

        for (let i = 0; i < screwPoses.length; i += 1) {
          if (i === 0) continue;
          // NOTE: super important to say baseMaterial.clone() otherwise the 
          // colour of all the models gets linked to baseMaterial
          const mesh = child.clone();
          mesh.material = baseMaterial.clone();
          mesh.add(objectAxes.clone());
          // mesh.name = "screw_" + screw_count;
          mesh.name = `screw_${screw_count}`;
          
          mesh.position.x = screwPoses[i].position.x * 1000;
          mesh.position.y = screwPoses[i].position.y * 1000;
          mesh.position.z = screwPoses[i].position.z * 1000;
          mesh.rotation.x = screwPoses[i].orientation.rx;
          mesh.rotation.y = screwPoses[i].orientation.ry;
          mesh.rotation.z = screwPoses[i].orientation.rz;
          
          scene.add(mesh);
          mesh.arrow = attachVector(mesh);
          mesh.arrow.visible = false;
          loadedMeshes.push(mesh);
          addModelToList(mesh.name, mesh);
          // positionOffset += 50;
          // angleOffset += Math.PI/6;
          // angleOffset += 30;
          screw_count += 1;
        }
      });
      
      fitCameraToAllObjects();

    }
  );
}

async function loadReferenceScrews() {
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

  const filepath = "data/pybullet/final_states_20251229_6.txt";
  // const filepath = "data/pybullet/final_states_20260101_2.txt";

  const screwPoses = await getScrewPoses(filepath);
  console.log(screwPoses);

  loader.load(
    "resources/m12_screw_detailed.stl",
    // "resources/m12_screw_BC_v3.stl",
    function (geometry) {
      for (let i = 0; i < screwPoses.length; i += 1) {
        // skip the first pose if the pose is of the world or the bin
        // dont skip if the input data is only poses of screws
        // if(i===0) continue;
        // NOTE: super important to say baseMaterial.clone() otherwise the 
        // colour of all the models gets linked to baseMaterial
        const mesh = new THREE.Mesh(geometry, baseMaterial.clone());
        mesh.add(objectAxes.clone());
        // mesh.name = "screw_" + screw_count;
        mesh.name = `r_screw_${screw_count+1}`;

        mesh.position.x = screwPoses[i].position.x * 1000; // m to mm
        mesh.position.y = screwPoses[i].position.y * 1000; // m to mm
        mesh.position.z = screwPoses[i].position.z * 1000; // m to mm
        mesh.rotation.x = screwPoses[i].orientation.rx;
        mesh.rotation.y = screwPoses[i].orientation.ry;
        mesh.rotation.z = screwPoses[i].orientation.rz;

        scene.add(mesh);
        mesh.arrow = attachVector(mesh);
        mesh.arrow.visible = false;
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

async function loadMeasuredScrews(){
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

  const filepath = "data/real/scanned_states_20251231_1.txt";
  const screwPoses = await getScrewPoses(filepath);
  console.log(screwPoses);

  loader.load(
    "resources/m12_screw_detailed.stl",
    // "resources/m12_screw_BC_v3.stl",
    function (geometry) {
      for (let i = 0; i < screwPoses.length; i += 1) {
        // skip the first pose if the pose is of the world or the bin
        // dont skip if the input data is only poses of screws
        // if(i===0) continue;
        // NOTE: super important to say baseMaterial.clone() otherwise the 
        // colour of all the models gets linked to baseMaterial
        let mesh = new THREE.Mesh(geometry, baseMaterial.clone());
        mesh.add(objectAxes.clone());
        // mesh.name = "screw_" + screw_count;
        mesh.name = `m_screw_${screw_count+1}`;

        mesh.position.x = screwPoses[i].position.x * 1000; // m to mm
        mesh.position.y = screwPoses[i].position.y * 1000; // m to mm
        mesh.position.z = screwPoses[i].position.z * 1000; // m to mm
        mesh.rotation.x = screwPoses[i].orientation.rx;
        mesh.rotation.y = screwPoses[i].orientation.ry;
        mesh.rotation.z = screwPoses[i].orientation.rz;
        
        mesh = bring_part_closer_to_bin(mesh);

        scene.add(mesh);
        mesh.arrow = attachVector(mesh);
        mesh.arrow.visible = false;
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

function bring_part_closer_to_bin(mesh){
  // translate and rotate part by a defined amount

  const translation = new THREE.Vector3(
    // -100, // x
    100, // x
    790,  // y
    0     // z
  );
  mesh.position.add(translation);
  
  // rotating the scanned parts is not a good plan
  // const angle = -90*(Math.PI/180);
  // mesh.position.applyAxisAngle(new THREE.Vector3(0, 0, 1), angle);
  // const translation2 = new THREE.Vector3(200, 0, 0); // mm
  // mesh.position.add(translation2);

  // const rotation = new THREE.Euler(0, 0, 0); // radians
  // mesh.rotation.x += rotation.x;
  // mesh.rotation.y += rotation.y;
  // mesh.rotation.z += rotation.z;

  //  const rot = new THREE.Euler(0, 0, 3.14);
  //  const q = new THREE.Quaternion().setFromEuler(rot);

  //  mesh.position.applyQuaternion(q);

  
  // return the translated mesh
  return mesh
}

function loadBin(){
  const baseMaterial = new THREE.MeshPhongMaterial({
    color: 0xcccccc,
    specular: 0x444444,
    shininess: 200,
    transparent: true,
    opacity: 0.8,
  });
  const objectAxes = new THREE.AxesHelper(50);
  objectAxes.visible = false;
  loader.load(
    // "resources/rectangular_box.STL",
    // "resources/solid_ikea_bin_for_simulation_v3.STL",
    "resources/solid_ikea_bin_for_simulation_v3.1.STL",
    function (geometry){
      const mesh = new THREE.Mesh(geometry, baseMaterial.clone());
      mesh.add(objectAxes.clone());
      mesh.name = "rectangular_bin";
      mesh.position.x = 0;
      mesh.position.y = 0;
      mesh.position.z = 0;
      mesh.rotation.x = 0;
      mesh.rotation.y = 0;
      mesh.rotation.z = 0;
      scene.add(mesh);
      mesh.arrow = attachVector(mesh);
      mesh.arrow.visible = false;
      loadedMeshes.push(mesh);
      addModelToList(mesh.name, mesh);
      fitCameraToAllObjects();
    }
  )
}

document.getElementById('fileInput').addEventListener('change', (e) => {
  const files = e.target.files;
  for (let i = 0; i < files.length; i++) {
    loadSTL(files[i]);
  }
});

document.getElementById('exportCombined').addEventListener('click', exportCombinedSTL);

if (annotatePartButton) {
  annotatePartButton.addEventListener('click', () => {
    if (!renameMode) startRenameMode();
  });
}

if (renameSubmit) {
  renameSubmit.addEventListener('click', () => {
    if (!renameTarget) {
      closeRenameModal();
      endRenameMode();
      return;
    }
    const newName = renameInput.value.trim();
    if (!newName) {
      renameError.textContent = 'Name cannot be empty.';
      return;
    }
    renameTarget.name = newName;
    if (renameTarget.userData && renameTarget.userData.nameSpan) {
      renameTarget.userData.nameSpan.textContent = newName;
    }
    closeRenameModal();
    endRenameMode();
  });
}

if (renameCancel) {
  renameCancel.addEventListener('click', () => {
    closeRenameModal();
    endRenameMode();
  });
}


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
    
    // --- display pose ---
    if (0){
      const euler = new THREE.Euler();
      euler.setFromQuaternion(obj.quaternion);
      hoverLabel.innerHTML += "<br>" + "<span style='font-size: 12px;'>Pos: " + `${obj.position.x.toFixed(2)}, ${obj.position.y.toFixed(2)}, ${obj.position.z.toFixed(2)}` + "</span>";
      hoverLabel.innerHTML += "<br>" + "<span style='font-size: 12px;'>Rot: " + `${(euler.x*180/Math.PI).toFixed(2)}, ${(euler.y*180/Math.PI).toFixed(2)}, ${(euler.z*180/Math.PI).toFixed(2)}` + "</span>";
    }

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
  if (renameModal && !renameModal.classList.contains('hidden')) {
    return;
  }

  if (renameMode) {
    const rect = renderer.domElement.getBoundingClientRect();
    const coords = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    rc2.setFromCamera(coords, camera);
    const intersections = rc2.intersectObjects(loadedMeshes, true);
    const hit = intersections.find((entry) => entry.object.type === "Mesh");
    if (hit) {
      endRenameMode();
      openRenameModal(hit.object);
    }
    return;
  }

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
  
  // act only if dealing with valid mesh
  if (intersections.length > 0) {
    const selectedObject = intersections[0].object;
    if (selectedObject.type != "Mesh") return;

    let debugString = '';
    // const color = new THREE.Color(Math.random(), Math.random(), Math.random());
    // selectedObject.material.color = color;
    debugString += `${selectedObject.name} selected!\n`;
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
    debugString += 
      'position: ' + `${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)}` +
      '\norientation: ' + `${(euler.x*180/Math.PI).toFixed(2)}, ${(euler.y*180/Math.PI).toFixed(2)}, ${(euler.z*180/Math.PI).toFixed(2)}` + '\n';
    // console.log(selectedObject.position);
    // console.log(euler);

    // --- calculate relative pose difference to other screws ---
    pose_diff(selectedObject);

    if (!event.ctrlKey) {
      // console.log(debugString);
      return;
    } else {
      // const hits = findIntersections(selectedObject);
      const hits = preciseIntersections(selectedObject);
      debugString += 'intersects with: ' + hits.map(o=>o.name);
      // console.log(debugString);
    }
  }
}

function startRenameMode() {
  if (!annotatePartButton) return;
  renameMode = true;
  annotatePartButton.classList.add('active');
  renderer.domElement.style.cursor = 'crosshair';
}

function endRenameMode() {
  if (!annotatePartButton) return;
  renameMode = false;
  annotatePartButton.classList.remove('active');
  renderer.domElement.style.cursor = '';
}

function openRenameModal(mesh) {
  if (!renameModal) return;
  renameTarget = mesh;
  renameCurrentName.textContent = mesh.name || '';
  renameInput.value = mesh.name || '';
  renameError.textContent = '';
  renameModal.classList.remove('hidden');
  renameInput.focus();
  renameInput.select();
}

function closeRenameModal() {
  if (!renameModal) return;
  renameModal.classList.add('hidden');
  renameTarget = null;
}

function pose_diff(selObj){
  // console.log(loadedMeshes);
  const objIdx = loadedMeshes.findIndex(o => o.uuid === selObj.uuid);
  matPrint(selObj.matrixWorld);
}

function worldBoundingBox(mesh){
  mesh.geometry.computeBoundingBox();
  const box = mesh.geometry.boundingBox.clone();
  mesh.updateMatrixWorld(true);
  return box.applyMatrix4(mesh.matrixWorld);
}

function findIntersections(targetMesh){
  const targetBox = worldBoundingBox(targetMesh);
  const collisions = [];
  for (const mesh of loadedMeshes) {
    if(mesh === targetMesh || mesh.type !== 'Mesh' || !mesh.visible) continue;
    const otherBox = worldBoundingBox(mesh);
    if (targetBox.intersectsBox(otherBox)) collisions.push(mesh);
  }
  return collisions;
}


function trianglesIntersect(a, b) {
  const triA = new THREE.Triangle(), triB = new THREE.Triangle();
  const posA = a.attributes.position, posB = b.attributes.position;

  a.computeBoundingSphere(); b.computeBoundingSphere();
  if (!a.boundingSphere.intersectsSphere(b.boundingSphere)) return false;

  for (let i = 0; i < posA.count; i += 3) {
    triA.setFromAttributeAndIndices(posA, i, i + 1, i + 2);
    for (let j = 0; j < posB.count; j += 3) {
      triB.setFromAttributeAndIndices(posB, j, j + 1, j + 2);
      // if (triA.intersectsTriangle(triB)) return true;
      if (trianglesOverlapSAT(triA, triB)) return true;
    }
  }
  return false;
}

function preciseIntersections(targetMesh) {
  const targetGeom = targetMesh.geometry.clone().applyMatrix4(targetMesh.matrixWorld);
  const hits = [];
  for (const mesh of loadedMeshes) {
    if (mesh === targetMesh || mesh.type !== 'Mesh' || !mesh.visible) continue;
    const otherGeom = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
    if (trianglesIntersect(targetGeom, otherGeom)) hits.push(mesh);
  }
  return hits;
}


function matPrint(mat){
  const sigFigs = 2;
  const padW = 6;
  let matStr = "";
  if(mat instanceof THREE.Matrix4){
    mat = mat.elements;
  } 
  for (let i=0;i<4;i++){
    matStr += `${mat[i].toFixed(sigFigs).padStart(padW)} ${mat[i+4].toFixed(sigFigs).padStart(padW)} ${mat[i+8].toFixed(sigFigs).padStart(padW)} ${mat[i+12].toFixed(sigFigs).padStart(padW)}\n`
  }
  // console.log(matStr);
}

function attachVector(obj){
  const axis = new THREE.Vector3(-1, 0, 0);
  const direction = axis.applyQuaternion(obj.quaternion);
  const origin = obj.position;
  const length = 100;
  const colour = 0xff0000;
  const headLength = length*0.2;
  const headWidth = headLength*0.2;
  const arrowHelper = new THREE.ArrowHelper(direction, origin, length, colour, headLength, headWidth);
  scene.add(arrowHelper);
  return arrowHelper;
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

loadBin();

// loadScrews();

// loadScrewsOBJ();

loadReferenceScrews().catch((err) => {
  console.error('Failed to load reference screws', err);
});

loadMeasuredScrews();

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();

