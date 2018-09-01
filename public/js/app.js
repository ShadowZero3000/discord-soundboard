function play(clip) {
    var xhttp = new XMLHttpRequest();
    xhttp.open("GET", `play/${clip}?${Math.random().toString(36).substring(7)}`);
    xhttp.send();
}

function random(clip) {
    var xhttp = new XMLHttpRequest();
    xhttp.open("GET", `random/${clip}?${Math.random().toString(36).substring(7)}`);
    xhttp.send();
}
