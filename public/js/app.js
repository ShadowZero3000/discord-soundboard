function parseFailure(jqXHR, status, error) {
  $("#error-message-holder").html(`<b>${status}</b>: ${jqXHR.responseText}`);
  $("#error-display").modal('show');
}

function play(clip) {
  $.ajax({
    url: `play/${clip}`,
    data: Math.random().toString(36).substring(7)
  }).fail(parseFailure);
}

function random(clip) {
  $.ajax({
    url: `random/${clip}`,
    data: Math.random().toString(36).substring(7)
  }).fail(parseFailure);
}
