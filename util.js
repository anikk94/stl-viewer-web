
function mouse_position(){
    const now = new Date();
    console.log("[" + now.toLocaleTimeString() + "]" + " util::mouse_position()");
}



// main
const mouse_pos_x_label = document.getElementById('mouse-x');
const mouse_pos_y_label = document.getElementById('mouse-y');

document.addEventListener('mousemove', function(event){
    mouse_pos_x_label.innerHTML=event.clientX;
    mouse_pos_y_label.innerHTML=event.clientY;
    // console.log(pos.x, pos.y);
});
mouse_position();