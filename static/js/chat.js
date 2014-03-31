
if (!console || !console.log) {
  var console = {
    log: function() {}
  };
}

// Ugh, globals.
var peerc;
var source = new EventSource("events");

$("#incomingCall").modal();
$("#incomingCall").modal("hide");

$("#incomingCall").on("hidden", function() {
  document.getElementById("incomingRing").pause();
});

source.addEventListener("ping", function(e) {}, false);

source.addEventListener("userjoined", function(e) {
  appendUser(e.data);
}, false);

source.addEventListener("userleft", function(e) {
  removeUser(e.data);
}, false);

source.addEventListener("offer", function(e) {
  var offer = JSON.parse(e.data);
  document.getElementById("incomingUser").innerHTML = offer.from;
  document.getElementById("incomingAccept").onclick = function() {
    $("#incomingCall").modal("hide");
    acceptCall(offer);
  };
  $("#incomingCall").modal();
  document.getElementById("incomingRing").play();
}, false);

source.addEventListener("answer", function(e) {
  var answer = JSON.parse(e.data);
  peerc.setRemoteDescription(new mozRTCSessionDescription(JSON.parse(answer.answer)), function() {
    console.log("Call established!");
  }, error);
}, false);

function error(e) {
  if (typeof e == typeof {}) {
    alert("Oh no! " + JSON.stringify(e));
  } else {
    alert("Oh no! " + e);
  }
  endCall();
}

function log(info) {
  var d = document.getElementById("debug");
  d.innerHTML += info + "\n\n";
}

function clearLog() {
  var d = document.getElementById("debug");
  d.innerHTML = "";
}

function appendUser(user) {
  // If user already exists, ignore it
  var index = users.indexOf(user);
  if (index > -1)
    return;

  users.push(user);

  var d = document.createElement("div");
  d.setAttribute("id", btoa(user));

  var a = document.createElement("a");
  a.setAttribute("class", "btn btn-block btn-inverse");
  a.setAttribute("onclick", "initiateCall('" + user + "');");
  a.innerHTML = "<i class='icon-user icon-white'></i> " + user;

  d.appendChild(a);
  d.appendChild(document.createElement("br"));
  document.getElementById("users").appendChild(d);
}

function removeUser(user) {
  // If user already exists, ignore it
  var index = users.indexOf(user);
  if (index == -1)
    return;

  users.splice(index, 1)

  var d = document.getElementById(btoa(user));
  if (d) {
    document.getElementById("users").removeChild(d);
  }
}

function changeUIState(calling) {
  if (calling) {
    // clear debugging log of previous call
    clearLog();

    document.getElementById("main").style.display = "none";
    document.getElementById("call").style.display = "block";
    document.getElementById("call-control").style.display = "block";
  }
  else {
    document.getElementById("call-control").style.display = "none";
    document.getElementById("call").style.display = "none";
    document.getElementById("main").style.display = "block";
  }
}

function createPeerConnection(caller, obj) {
  //  Update UI accordingly
  changeUIState(true);

  navigator.mozGetUserMedia({video:true, audio:true}, function(stream) {
    //  Display local video.
    document.getElementById("localvideo").mozSrcObject = stream;
    document.getElementById("localvideo").play();

    muteVideoButton.className = (0 == stream.getVideoTracks().length) ? "btn btn-default" : "btn btn-danger";
    muteAudioButton.className = (0 == stream.getAudioTracks().length) ? "btn btn-default" : "btn btn-danger";

    // Create and setup peerConnection.
    var pc = new mozRTCPeerConnection();
    pc.addStream(stream);

    pc.onaddstream = function(obj) {
      document.getElementById("remotevideo").mozSrcObject = obj.stream;
      document.getElementById("remotevideo").play();
      //document.getElementById("dialing").style.display = "none";
      //document.getElementById("hangup").style.display = "block";
    };

    // T.T no statechnage after pc.close
    pc.onsignalingstatechange = function(obj) {
      console.log("onsignalingstatechange triggered");
    }

    // T.T no remove stream callback after pc.removeStream
    pc.onremovestream = function(obj) {
      console.log("onremovestream triggered");
    }

    // Make a call
    if (caller) {
      var user = obj;
      pc.createOffer(function(offer) {
        log("Created offer" + JSON.stringify(offer));
        pc.setLocalDescription(offer, function() {
          // Send offer to remote end.
          log("setLocalDescription, sending to remote");
          peerc = pc;
          jQuery.post(
            "offer", {
              to: user,
              from: document.getElementById("user").innerHTML,
              offer: JSON.stringify(offer)
            },
            function() { console.log("Offer sent!"); }
          ).error(error);
        }, error);
      }, error);
    }
    // Or, accept a call
    else {
      var offer = obj;
      pc.setRemoteDescription(new mozRTCSessionDescription(JSON.parse(offer.offer)), function() {
        log("setRemoteDescription, creating answer");
        pc.createAnswer(function(answer) {
          pc.setLocalDescription(answer, function() {
            // Send answer to remote end.
            log("created Answer and setLocalDescription " + JSON.stringify(answer));
            peerc = pc;
            jQuery.post(
              "answer", {
                to: offer.from,
                from: offer.to,
                answer: JSON.stringify(answer)
              },
              function() { console.log("Answer sent!"); }
            ).error(error);
          }, error);
        }, error);
      }, error);
    }
  }, error);
}

function acceptCall(offer) {
  log("Incoming call with offer " + offer);
  createPeerConnection(false, offer);
}

function initiateCall(user) {
  createPeerConnection(true, user);
}

function endCall() {
  log("Ending call");

  // Try to remove stream before close peer connection. Testing code.
  /*var localStream = document.getElementById("localvideo").mozSrcObject;
  if (localStream) {
    localStream.stop();
    peerc.removeStream(localStream);
  }*/

  document.getElementById("localvideo").mozSrcObject.stop();
  document.getElementById("localvideo").mozSrcObject = null;
  document.getElementById("remotevideo").mozSrcObject = null;

  // Close peer connection
  peerc.close();
  peerc = null;

  // Update UI.
  changeUIState(false);
}

var localView         = document.getElementById('local-view');
var remoteView        = document.getElementById('remote-view');
var muteAudioButton   = document.getElementById('btn-audio-mute');
var muteVideoButton   = document.getElementById('btn-video-mute');

// Switch focus from/to local view to/from remote view.
function switchViews() {
  if (localView.classList.contains('scaleDown')) {
    // Scale down remoteView and move it front
    remoteView.style.zIndex = 1;
    remoteView.classList.remove('scaleUp');
    remoteView.classList.add('scaleDown');

    // Scale up localview and move it back
    localView.style.zIndex = 0;
    localView.classList.remove('scaleDown');
    localView.classList.add('scaleUp');
  }
  else {
    // Scale down localView and move it front
    localView.style.zIndex = 1;
    localView.classList.remove('scaleUp');
    localView.classList.add('scaleDown');

    // Scale up remoteView and move it back
    remoteView.style.zIndex = 0;
    remoteView.classList.remove('scaleDown');
    remoteView.classList.add('scaleUp');
  }
}

localView.onclick = switchViews;
remoteView.onclick = switchViews;

muteAudioButton.onclick = function () {
  var stream = document.getElementById("localvideo").mozSrcObject;

  if (stream) {
    var audiotrack = stream.getAudioTracks()[0];
    if (audiotrack) {
      muteAudioButton.className = audiotrack.enabled ? "btn btn-default" : "btn btn-danger"
      audiotrack.enabled = audiotrack.enabled ? false : true;
    }
  }
}

muteVideoButton.onclick = function () {
  var stream = document.getElementById("localvideo").mozSrcObject;

  if (stream) {
    var videotrack = stream.getVideoTracks()[0];
    if (videotrack) {
      muteVideoButton.className = videotrack.enabled ? "btn btn-default" : "btn btn-danger"
      videotrack.enabled = videotrack.enabled ? false : true;
    }
  }
}

var users = [];
users.push(document.getElementById("user").innerHTML);