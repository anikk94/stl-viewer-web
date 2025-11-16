import * as THREE from 'three';

// ------------------------------ STL LOADER ------------------------------- //
// const loader = new STLLoader();
// const loadedMeshes = [];
// const modelList = document.getElementById('modelList');




// let screw_count = 0
// // read m12 screw model
// loader.load(
//     "resources/m12_screw_detailed.STL",
//     function (geometry) {
//         const material = new THREE.MeshPhongMaterial({
//             color: 0xcccccc,
//             specular: 0x444444, 
//             shininess: 200,
//         });
//         const mesh = new THREE.Mesh(geometry, material);
//         mesh.name = "screw_"+screw_count;
//         container.add(mesh);
//         loadedMeshes.push(mesh);
//         fitCameraToAllObjects();
//     })
// read list of poses of screws in bin (simulation or real bin)
let poseText = "";
const filePath = "data/screw_poses.txt";
// fetch(filePath)
//     .then(response => {
//         if (!response.ok){
//             throw new Error (`file read error. status: ${response.status}`);
//         }
//         return response.text();
//     })
//     .then(textData => {
//         poseText = textData;
//         // console.log("file content");
//         // console.log(textData);
//     })
//     .catch(error => {
//         console.error("could not read the file", error);
//     });

// console.log("PoseText: ", poseText);


async function loadText(path){
    const res = await fetch(path);
    if (!res.ok) throw new Error("failed to load "+ path);
    return res.text();
}
const text = await loadText(filePath);

function parseMatrixRow(line){
    // accepts lines like: "  -0.0314729, -0.907673, -0.418496"
    return line
        .replace(/\[/g, '')
        .replace(/\]/g, '')
        .split(/[,\s]+/)
        .filter(Boolean)
        .map(Number);
}

function parseScrewPoses(text){
    const lines = text.split(/\r?\n/);
    const items = [];
    const headerRe = /^\s*-{5,}\s*\d+\.\s*([^\-]+?)\s*-{2,}\s*$/;

    let i = 0;
    while (i < lines.length){
        // seek header
        while (i < lines.length && !headerRe.test(lines[i])) i++;
        if (i >= lines.length) break;
        const name = lines[i].match(headerRe)[1].trim();
        i++;

        // seek 'position:'
        while (i < lines.length && !/^\s*position\s*:/.test(lines[i])) i++;
        if (i >= lines.length) break;
        i++;

        // read x,y,z lines
        const pos = {x:0,y:0,z:0};
        for (const key of ['x','y','z']){
            if (i >= lines.length) break;
            const m = lines[i].match(new RegExp(`^ *${key} *: *([-+]?\\d*\\.?\\d+(?:[eE][-+]?\\d+)?)`));
            if (m) pos[key] = parseFloat(m[1]);
            i++;
        }

        // seek 'rotation'
        while (i < lines.length && !/^\s*rotation\s*$/i.test(lines[i])) i++;
        if (i < lines.length) i++;
        // optional '[' line
        if (i < lines.length && /\[/.test(lines[i])) i++;

        // read 3 rows
        const r1 = i < lines.length ? parseMatrixRow(lines[i++]) : [1,0,0];
        const r2 = i < lines.length ? parseMatrixRow(lines[i++]) : [0,1,0];
        const r3 = i < lines.length ? parseMatrixRow(lines[i++]) : [0,0,1];
        // optional ']' line
        if (i < lines.length && /\]/.test(lines[i])) i++;

        // build Matrix4 (row-major input)
        const m4 = new THREE.Matrix4();
        m4.set(
            r1[0], r1[1], r1[2], 0,
            r2[0], r2[1], r2[2], 0,
            r3[0], r3[1], r3[2], 0,
            0,     0,     0,     1
        );

        const euler = new THREE.Euler().setFromRotationMatrix(m4, 'XYZ');
        items.push({
            name,
            position: pos,
            orientation: { rx: euler.x, ry: euler.y, rz: euler.z }
        });
    }
    return items;
}



export const screwPoses = parseScrewPoses(text);

// const screwPoses = parseScrewPoses(text.slice(0, 328));
// console.log('Parsed poses:', screwPoses);
// console.log(text.slice(0, 328)); // first 2 entries


// give models unique name and add them to scene as individuals (group?)
