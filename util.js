import * as THREE from 'three';
import { plotAbmVectors } from './viewer.js';


function mouse_position(){
    const now = new Date();
    console.log("[" + now.toLocaleTimeString() + "]" + " util::mouse_position()");
}

export function getRelativeDistances(screwPoses){
    console.log("getRelativeDistances");
    console.log(screwPoses);
}

export function getRelativeAngles(screwPoses){
    console.log("getRelativeAngles");
}



// DEBUGGING ==================================================================
// VECTOR VISUALIZATION
function angles() {
  const o1 = new THREE.Vector3(
    0.0944*1000+30,
    -0.8289*1000+780,
    0.03*1000+0,
  );
  const p1 = new THREE.Matrix3();
  p1.set(
    -0.781123096587244, -0.5999242991332419, 0.17302468982039337,
    0.5873580872494337, -0.5999242991332419, -0.12229808919760471,
    0.21179514942661304, 0.0060975887190968595, 0.9772950598929534,
  );
  const o2 = new THREE.Vector3(
    0.1273*1000+30,
    -0.7892*1000+780,
    0.0249*1000+0,
  );
  const p2 = new THREE.Matrix3();
  p2.set(
    0.5933147727024419, 0.23531806477346495, -0.7698071114794414,
    -0.1377683570661496, 0.23531806477346495, 0.19090971775983762,
    0.7930936012125831, -0.007214494793004497, 0.6090570505137742,
  );

  const o28 = new THREE.Vector3(
    -0.015998333940071937*1000,
    -0.05014167280909813*1000,
    0.034342881529232844*1000,
  );
  const p28 = new THREE.Matrix3();
  p28.set(
    -0.7784760642316098, -0.5104953001567176, 0.36519798183501206,
    0.5887141094254402, -0.7956376485829917, 0.1427460315411212,
    0.21769408531669818, 0.3261215734587804, 0.9199206512210145,
  );
  const o30 = new THREE.Vector3(
    0.01669821841731852*1000,
    -0.010476736902347957*1000,
    0.029519794889304132*1000,
  );
  const p30 = new THREE.Matrix3();
  p30.set(
    0.5991880742669823, -0.5905410764970156, 0.540587540205998,
    -0.14464118163644174, -0.7439583298973955, -0.6523840371675966,
    0.7874341751734167, 0.31270951431963867, -0.5311875181354855,
  );

  console.log("p2-p1 angle:  ", abm([p2,o2], [p1,o1], true) * 180 / Math.PI);
  console.log("p28-p30 angle:", abm([p28, o28], [p30,o30], true)* 180/Math.PI);

}

function abq(q1, q2, print=false){
  // Step 1: convert quaternion → Matrix4
  const tmat1 = new THREE.Matrix4();
  tmat1.makeRotationFromQuaternion(q1);
  // Step 2: extract the 3×3 rotation matrix
  const rmat1 = new THREE.Matrix3();
  rmat1.setFromMatrix4(tmat1);
  // const x1 = new THREE.Vector3();
  // x1[0] = rmat1[0];
  // x1[1] = rmat1[3];
  // x1[2] = rmat1[6];
  const x1 = new THREE.Vector3(
    rmat1.elements[0],
    rmat1.elements[3],
    rmat1.elements[6],    
  );
  
  const tmat2 = new THREE.Matrix4();
  tmat2.makeRotationFromQuaternion(q2);
  const rmat2 = new THREE.Matrix3();
  rmat2.setFromMatrix4(tmat2);
  // let x2 = new THREE.Vector3();
  // x2[0] = rmat2[0];
  // x2[1] = rmat2[3];
  // x2[2] = rmat2[6];
  const x2 = new THREE.Vector3(
    rmat2.elements[0],
    rmat2.elements[3],
    rmat2.elements[6],    
  );
  // rot3.elements is a 9-element array
  if (print==true){
    console.log(x1)
    console.log(x2);
    console.log(rmat1.elements);
  }

  return x1.angleTo(x2);
  // return 2*Math.acos((q1.normalize()).dot((q2.normalize())));
}

function abm(pose1, pose2, print=false){

  const r1 = pose1[0];
  const o1 = pose1[1];
  
  const r2 = pose2[0];
  const o2 = pose2[1];

  const v1 = new THREE.Vector3(
    r1.elements[0],
    r1.elements[1],
    r1.elements[2],    
  );
  
  const v2 = new THREE.Vector3(
    r2.elements[0],
    r2.elements[1],
    r2.elements[2],    
  );
  // rot3.elements is a 9-element array
  if (print==true){
    console.log("v1:", v1)
    console.log("v2:", v2);
    // console.log(r1.elements);
    // console.log(r2.elements);
    plotAbmVectors(v1, origin=o1);
    plotAbmVectors(v2, origin=o2);
  }
  
  return v1.angleTo(v2);
  // return 2*Math.acos((q1.normalize()).dot((q2.normalize())));
}
// DEBUGGING ==================================================================

// main
const mouse_pos_x_label = document.getElementById('mouse-x');
const mouse_pos_y_label = document.getElementById('mouse-y');

document.addEventListener('mousemove', function(event){
    mouse_pos_x_label.innerHTML=event.clientX;
    mouse_pos_y_label.innerHTML=event.clientY;
    // console.log(pos.x, pos.y);
});

mouse_position();


// DEBUGGING ==================================================================
// VECTOR VISUALIZATION
// angles();

