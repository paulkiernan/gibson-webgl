// vim: set shiftwidth=2 tabstop=2 softtabstop=2:

/** Hack the Gibson
 *  A threejs exploration into the best user interface ever designed
 */

/*
 * START: Global variables and constants
 */
const BUILDING_WIDTH = 400;
const CAMERA_MASS = 100.0;
const DEFAULT_SPEED = 0;
const FLOOR_X_DIMENSION_LENGTH = 10000;
const FORWARD_SPEED = 100;
const LATERAL_MOVEMENT_SPEED = 6000.0;
const LATERAL_RESISTANCE_COEFFICIENT = 10.0;
const FRAGMENT_LATERAL_RESISTANCE_COEFFICIENT = 0.1;
const MIN_TOWER_HEIGHT = 1000;
const PERSPECTIVE_BOUNDARY = FLOOR_X_DIMENSION_LENGTH * 2;
const VERTICAL_MOVEMENT_SPEED = 2500.0;
const BUILDING_FRAGMENT_SIZE = BUILDING_WIDTH / 4;
const FRAGMENT_MASS = 200;
const MAX_ROTATION = 0.5;

const loadingManager = new THREE.LoadingManager(function() {
  $('span.loading').remove();
  $('#instructions').append('<a href="#" id="startButton">Play</a>');
  start();
  animate();
});
loadingManager.onProgress = function (item, loaded, total) {
  const percentComplete = (loaded/total * 100).toFixed(2);
  $('#instructions > #loadingBar').text(percentComplete + "%");
  console.log("Loading:", item, loaded, total);
};
const textureLoader = new THREE.TextureLoader(loadingManager);
const towerTextures = {
  dark: [
    textureLoader.load('/dist/images/towers1-1.png'),
    textureLoader.load('/dist/images/towers1-2.png'),
    textureLoader.load('/dist/images/towers1-3.png'),
    textureLoader.load('/dist/images/towers1-4.png'),
    textureLoader.load('/dist/images/towers1-5.png'),
    textureLoader.load('/dist/images/towers1-6.png'),
    textureLoader.load('/dist/images/towers1-7.png'),
    textureLoader.load('/dist/images/towers1-8.png'),
  ],
  light: [
    textureLoader.load('/dist/images/towers2-1.png'),
    textureLoader.load('/dist/images/towers2-2.png'),
    textureLoader.load('/dist/images/towers2-3.png'),
    textureLoader.load('/dist/images/towers2-4.png'),
    textureLoader.load('/dist/images/towers2-5.png'),
    textureLoader.load('/dist/images/towers2-6.png'),
    textureLoader.load('/dist/images/towers2-7.png'),
    textureLoader.load('/dist/images/towers2-8.png'),
  ]
}
const towerTypes = ["dark", "light"];
const nightSkyTexture = textureLoader.load('/dist/images/nightsky.jpg');
const floorTexture = textureLoader.load('/dist/images/room.png');

// Global Variable
var container;
var stats;
var camera;
var scene;
var raycaster;
var renderer;
var vrEffect;
var controls;
var vrControls;
var INTERSECTED;
var crosshair;
var controlsEnabled;
var supportsWebVR;
var tableData = null;
var totalTables;
var prevTime;
var cameraVelocity;
var dataPackets = [];
var textMeshes = [];
var speed = DEFAULT_SPEED;
var moveForward = false;
var moveBackward = false;
var moveLeft = false;
var moveRight = false;
var moveUp = false;
var MAX_TOWER_HEIGHT = 0;
var FARTHEST_BUILDING_X = 0;
var FARTHEST_BUILDING_Z = 0;
var BUILDING_GRID = [[]]
var BUILDINGS = [];
var TERRAIN = [];
var ambienceSfx;
var boomSfx;
var jetpackSfx;
var mouse;
var SOUND_EFFECTS_ENABLED = true;
var BUILDING_MAP = {};
var skyBox ;

/*
 * END: Global variables and constants
 */

// First things first, let's get some data about the buildings we're
// gonna draw
console.log("Pulling metadata about redshift tables...");
$.getJSON(
  "https://" + location.host + "/static/tables",
  function(data) {
    console.log("Successfully received data from redshift");
    tableData = data.data;
    totalTables = tableData.length;
  },
  function(err) {
    console.log(err);
  }
);

function placeBuildingsOnGrid(gridSizeLength, tableData) {
  /*
   * Helper function for placing a number of buildings on a grid of
   * arranged buildings
   *
   * @param gridSizeLength: int, length of the side of the cube on which
   *     buildings will be distributed
   * @param tableData: Object, redshift metadata used to draw buildings
   */

  console.log(
    "Placing buildings on " + gridSizeLength + "x" + gridSizeLength + " grid!"
 );

  // Initialize the grid on which we store all info about placed buildings
  BUILDING_GRID = new Array(gridSizeLength);
  for (var i = 0; i < gridSizeLength; i++) {
      BUILDING_GRID[i] = new Array(gridSizeLength);
  }

  // Indexes into the building grid
  var x = 1,
      y = 1;

  for (var i = 0 ; i < tableData.length; i ++) {
    var _tableMeta = tableData[i];

    // Create the building geometry
    var _buildingGeo = new THREE.CubeGeometry(1, 1, 1);
    var buildingHeight = parseInt(Math.log(_tableMeta.rows) * 200);
    // Change the pivot point of the geometry to be the bottom of the
    // building instead of its center
    _buildingGeo.applyMatrix(new THREE.Matrix4().makeTranslation(0, 0.5, 0));

    // Splice out the bottom face of the building since it's never seen
    //_buildingGeo.faces.splice(3, 1);

    // Grab a texture
    var buildingType    = _.sample(towerTypes);
    var texture         = _.sample(towerTextures[buildingType]);
    texture.anisotropy  = renderer.getMaxAnisotropy();
    texture.needsUpdate = true;

    var tableName = _tableMeta.table;
    var protectedBuilding = false;  // originally used to obfuscate special clients

    var building = new THREE.Mesh(
      _buildingGeo,
      new THREE.MeshLambertMaterial({
        map: texture,
        color: protectedBuilding ? 0x00FF00: 0x00FFFF,
        transparent: true,
        opacity: 0.9
      })
   );

    // Evenly place buildings around the map
    building.position.x = x * 1000;
    building.position.y = 0;
    building.position.z = y * 1000;
    building.scale.set(BUILDING_WIDTH, buildingHeight, BUILDING_WIDTH);
    building.castShadow =true;

    // Keep track of the tallest tower for later when we're drawing
    // sprites
    /* Keep track of a couple of metrics that will help us draw the
    *  landscape a little better. These variables are:
    *    Maximum tower height
    *    Maximum spread into the x dimension
    *    Maximum spread into the z dimension
    */
    if (buildingHeight > MAX_TOWER_HEIGHT) {
      MAX_TOWER_HEIGHT = buildingHeight;
    }
    if (building.position.x > FARTHEST_BUILDING_X) {
      FARTHEST_BUILDING_X = building.position.x + BUILDING_WIDTH/2;
    }
    if (building.position.z > FARTHEST_BUILDING_Z) {
      FARTHEST_BUILDING_Z = building.position.z + BUILDING_WIDTH/2;
    }

    var textMesh = createTextMesh(_tableMeta.table);
    textMesh.position.x = building.position.x;// + BUILDING_WIDTH/2;
    textMesh.position.y = buildingHeight + 80;
    textMesh.position.z = building.position.z;// + BUILDING_WIDTH/2;

    // Insert the building into the building state array
    var _building_status = {
      buildingObj: building,
      textMesh: textMesh,
      buildingType: buildingType,
      alive: true,
      tableName: _tableMeta.table,
      fragments: []
    }
    BUILDING_GRID[x-1][y-1] = _building_status;
    BUILDING_MAP[building.id] = _building_status;
    TERRAIN.push(building);

    // Add to the list of destroyable buildings
    if (!protectedBuilding) {
      BUILDINGS.push(building);
    }

    // Update indexes
    x = x + 1;
    if (x > gridSizeLength){
      x = 1;
      y = y + 1;
    }
  }

  // Add all the buildings and titles to the scene :)
  for (var i=0; i < BUILDING_GRID.length; i++) {
    for (var j=0; j < BUILDING_GRID[i].length; j++) {

      var _buildingMeta = BUILDING_GRID[i][j];

      if (_buildingMeta !== undefined) {

        // Shift buildings and textmeshes back across teh centerline
        _buildingMeta.buildingObj.position.x = _buildingMeta.buildingObj.position.x - FARTHEST_BUILDING_X/2;
        _buildingMeta.buildingObj.position.z = _buildingMeta.buildingObj.position.z - FARTHEST_BUILDING_Z/2;
        _buildingMeta.textMesh.position.x = _buildingMeta.textMesh.position.x - FARTHEST_BUILDING_X/2;
        _buildingMeta.textMesh.position.z = _buildingMeta.textMesh.position.z - FARTHEST_BUILDING_Z/2;

        // Add the buildings to the scene :)
        scene.add(_buildingMeta.buildingObj);
        scene.add(_buildingMeta.textMesh);
      }
    }
  }
};

function blowUpBuilding(buildingObj){
  /*
   * Helper for tessellating and destroying a building when hit with a
   * projectile
   *
   * @param buildingObj: THREE.Mesh
   */

  // LOUD NOISES!
  if (SOUND_EFFECTS_ENABLED) {
    boomSfx.currentTime = 0;
    boomSfx.play();
  }

  // Draw all the little cubes that make up the building
  var buildingFragmentGeometry = new THREE.CubeGeometry(1, 1, 1);
  var buildingFragmentMaterial = new THREE.MeshLambertMaterial({
    color: 0xff0000,
    transparent: true,
    opacity: 0.8
  });
  var buildingDimensions = buildingObj.scale;
  for (var x=0; x<buildingDimensions.x; x+=BUILDING_FRAGMENT_SIZE){
    for (var z=0; z<buildingDimensions.x; z+=BUILDING_FRAGMENT_SIZE){
      for (var y=0; y<buildingDimensions.y; y+=BUILDING_FRAGMENT_SIZE){
        // Only draw cubes for the outside of the building
        if (
            x==0 ||
            x==buildingDimensions.x-BUILDING_FRAGMENT_SIZE ||
            z==0 ||
            z==buildingDimensions.z-BUILDING_FRAGMENT_SIZE ||
            y==buildingDimensions.y-BUILDING_FRAGMENT_SIZE
       ){
          var buildingFragment = new THREE.Mesh(
            buildingFragmentGeometry,
            buildingFragmentMaterial
         );
          buildingFragment.scale.set(
            BUILDING_FRAGMENT_SIZE,
            BUILDING_FRAGMENT_SIZE,
            BUILDING_FRAGMENT_SIZE
         );
          buildingFragment.position.x = (buildingObj.position.x - BUILDING_WIDTH/2) + x + BUILDING_FRAGMENT_SIZE/2;
          buildingFragment.position.z = (buildingObj.position.z - BUILDING_WIDTH/2) + z + BUILDING_FRAGMENT_SIZE/2;
          buildingFragment.position.y = buildingObj.position.y + y;

          var xDistance = buildingFragment.position.x - buildingObj.position.x
          var yDistance = buildingFragment.position.y - buildingObj.position.y
          var zDistance = buildingFragment.position.z - buildingObj.position.z
          var direction = new THREE.Vector3(
            buildingFragment.position.x,
            buildingFragment.position.y,
            buildingFragment.position.z
         ).sub(buildingObj.position);
          BUILDING_MAP[buildingObj.id].fragments.push({
            direction: direction,
            fragment: buildingFragment
          });
          scene.add(buildingFragment);
        }
      }
    }
  }

  // Delete the building from the scene and scatter the fragments!
  TERRAIN = TERRAIN.filter(function(element) {
    return element.id != buildingObj.id;
  });
  BUILDINGS = BUILDINGS.filter(function(element) {
    return element.id != buildingObj.id;
  });
  scene.remove(buildingObj);
  buildingObj = null;

  // Mark the building as dead
  var buildingStatus = BUILDING_MAP[buildingObj.id];
  if (buildingStatus !== undefined) {
    buildingStatus.alive = false;
  }

}

function start() {

  supportsWebVR = !(navigator.getVRDevices === undefined);

  var havePointerLock = 'pointerLockElement' in document || 'mozPointerLockElement' in document || 'webkitPointerLockElement' in document;

  if (havePointerLock) {
    var element = document.body;
    var pointerlockchange = function (event) {
      if (document.pointerLockElement === element || document.mozPointerLockElement === element || document.webkitPointerLockElement === element) {
        controlsEnabled = true;
        controls.enabled = true;
        blocker.style.display = 'none';
      } else {
        controls.enabled = false;
        blocker.style.display = '-webkit-box';
        blocker.style.display = '-moz-box';
        blocker.style.display = 'box';
        instructions.style.display = '';
      }
    };

    var pointerlockerror = function (event) {
      instructions.style.display = '';
    };

    // Hook pointer lock state change events
    document.addEventListener('pointerlockchange', pointerlockchange, false);
    document.addEventListener('mozpointerlockchange', pointerlockchange, false);
    document.addEventListener('webkitpointerlockchange', pointerlockchange, false);

    document.addEventListener('pointerlockerror', pointerlockerror, false);
    document.addEventListener('mozpointerlockerror', pointerlockerror, false);
    document.addEventListener('webkitpointerlockerror', pointerlockerror, false);

    startButton.addEventListener('click', function (event) {

      instructions.style.display = 'none';

      // Ask the browser to lock the pointer
      element.requestPointerLock = element.requestPointerLock || element.mozRequestPointerLock || element.webkitRequestPointerLock;

      if (/Firefox/i.test(navigator.userAgent)) {

        var fullscreenchange = function (event) {
          if (document.fullscreenElement === element || document.mozFullscreenElement === element || document.mozFullScreenElement === element) {
            document.removeEventListener('fullscreenchange', fullscreenchange);
            document.removeEventListener('mozfullscreenchange', fullscreenchange);
            element.requestPointerLock();
          }
        };

        document.addEventListener('fullscreenchange', fullscreenchange, false);
        document.addEventListener('mozfullscreenchange', fullscreenchange, false);
        element.requestFullscreen = element.requestFullscreen || element.mozRequestFullscreen || element.mozRequestFullScreen || element.webkitRequestFullscreen;
        element.requestFullscreen();
    vrEffect.setFullScreen(true);

      } else {
        element.requestPointerLock();
      }
    }, false);

  } else {
    instructions.innerHTML = 'Your browser doesn\'t seem to support Pointer Lock API';
  }

  $("#enable-sound").change(function(){
    if($(this).is(":checked")) {
      console.log("enable sound");
      ambienceSfx.play();
    } else {
      console.log("disable sound");
      ambienceSfx.pause();
      ambienceSfx.currentTime = 0;
    }
  });

  $("#enable-sfx").change(function(){
    $(this).is(":checked") ? SOUND_EFFECTS_ENABLED = true: SOUND_EFFECTS_ENABLED = false;
  });

  cameraVelocity = new THREE.Vector3();
  prevTime = performance.now();

  init();
  if (supportsWebVR) {
    vrEffect.setFullScreen(true);
  }
}

function urlForTable(tableName) {
  return "http://" + location.host + "/table/" + tableName;
}

function addDirectionalLight(x, y, z) {
  var light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(x, y, z).normalize();
  scene.add(light);
}

function addPointLight(x, y, z) {
  var light = new THREE.PointLight(0xffffff, 1);
  light.position.set(x, y, z).normalize();
  scene.add(light);
}


function getTableInfoAndCreateBuilding(tableName) {
  $.getJSON(urlForTable(tableName), function(data) {
    console.log("got data for table", tableName);
  });
}

function addFlyingSprites() {
  // Create a bunch of boxes that fly around the place
  //
  console.log("Add some sprites to fly around the scene");
  for(var i = 0; i < 1000; i++){
    var material = new THREE.MeshLambertMaterial({
      emissive:0x008000,
      color:0x00FF00
    });

    var size = Math.random() * 15+3 * 10;

    var box = new THREE.Mesh(
      new THREE.CubeGeometry(size, size*0.1, size*0.1),
      material
   );

    box.position.set(
      _.random(-PERSPECTIVE_BOUNDARY/2, PERSPECTIVE_BOUNDARY/2),
      _.random(0, Math.max(MAX_TOWER_HEIGHT, MIN_TOWER_HEIGHT)),
      _.random(-PERSPECTIVE_BOUNDARY/2, PERSPECTIVE_BOUNDARY/2)
   );
    //box.rotation.set(Math.random() * Math.PI * 2, Math.random() * Math.PI * 2, Math.random() * Math.PI * 2);

    var speedVector;
    if(Math.random() > 0.5){
      speedVector = new THREE.Vector3(0, 0, Math.random() * 1.5 + 0.5);
      box.rotation.y = Math.PI / 2;
    } else {
      speedVector = new THREE.Vector3(Math.random() * 1.5 + 0.5, 0, 0);
    }

    // Randomly flip direction and GO FAST
    var speed = _.random(100, 300);
    if(Math.random() > 0.5) {
      speedVector.multiplyScalar(-speed);
    } else {
      speedVector.multiplyScalar(speed);
    }

    dataPackets.push({
      obj: box,
      speed: speedVector
    });
    scene.add(box);
  }
}

function init() {
  /*
   * Initialize the scene, buildings, sprite thingies and all that jazz
   */

  // Create and append the div we'll be using for rendering everything
  container = document.createElement('div');
  document.body.appendChild(container);

  // Create the 3JS scene
  scene = new THREE.Scene();

  // Create a renderer
  console.log("Loading ThreeJS Version: " + THREE.REVISION);
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setClearColor(0xf0f0f0);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.sortObjects = false;

  // Create a mouse projector tracking vector
  mouse = new THREE.Vector2();
  bulletRaycaster = new THREE.Raycaster();

  // Place all the buildings on the plane
  var squareGridSideSize = Math.ceil(Math.sqrt(tableData.length));
  console.log(
    "Placing buildings from " + totalTables + " tables in redshift!"
 );
  placeBuildingsOnGrid(squareGridSideSize , tableData);

  // Paint the floor!
  floorTexture.wrapS = THREE.RepeatWrapping;
  floorTexture.wrapT = THREE.RepeatWrapping;
  floorTexture.repeat.set(10, 10);
  var geometry = new THREE.PlaneGeometry(
    (FARTHEST_BUILDING_X || FLOOR_X_DIMENSION_LENGTH),
    (FARTHEST_BUILDING_Z || FLOOR_X_DIMENSION_LENGTH)
 );
  var floor = new THREE.Mesh(
    geometry,
    new THREE.MeshLambertMaterial({
      map: floorTexture,
      color: 0x00ffff,
      transparent: true,
      opacity: 0.65
    })
 );
  floor.position.y = -0.5;
  floor.rotation.x = - Math.PI / 2;
  floor.material.side = THREE.DoubleSide;
  scene.add(floor);
  TERRAIN.push(floor);

  // Add a crosshair to the view
  var x = 0.2, y = 0.2;
  var geometry = new THREE.Geometry();
  var material = new THREE.LineBasicMaterial({ color: 0xAAFFAA });
  geometry.vertices.push(new THREE.Vector3(0, y, 0));
  geometry.vertices.push(new THREE.Vector3(0, -y, 0));
  geometry.vertices.push(new THREE.Vector3(0, 0, 0));
  geometry.vertices.push(new THREE.Vector3(x, 0, 0));
  geometry.vertices.push(new THREE.Vector3(-x, 0, 0));
  crosshair = new THREE.Line(geometry, material);
  scene.add(crosshair);

  // skybox
  var geometry = new THREE.SphereGeometry(20000, 60, 40);
  var uniforms = {
    texture: {
      type: 't',
      value: nightSkyTexture
    }
  };
  var material = new THREE.ShaderMaterial({
    uniforms:       uniforms,
    vertexShader:   document.getElementById('sky-vertex').textContent,
    fragmentShader: document.getElementById('sky-fragment').textContent
  });

  skyBox = new THREE.Mesh(geometry, material);
  skyBox.scale.set(-1, 1, 1);
  skyBox.rotation.set(0, 0, -Math.PI*0.1);
  skyBox.eulerOrder = 'XZY';
  skyBox.renderDepth = 1000.0;
  scene.add(skyBox);

  // Add some light
  var hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.6);
  hemiLight.color.setHSL(0.6, 1, 0.6);
  hemiLight.groundColor.setHSL(0.095, 1, 0.75);
  hemiLight.position.set(0, 0, 0);
  scene.add(hemiLight);

  addFlyingSprites();

  camera = new THREE.PerspectiveCamera(
    45,                                       // Camera frustum vertical field of view
    window.innerWidth / window.innerHeight,   // Camera frustum aspect ratio.
    1,                                        // Camera frustum near plane
    100000                                    // Camera frustum far plane
 );
  camera.position.y = 10;
  camera.add(crosshair);
  raycaster = new THREE.Raycaster(
    new THREE.Vector3(),  // The origin vector where the ray casts from (we copy into this)
    new THREE.Vector3(0, - 1, 0),  // The vector that gives direction to the ray. Should be normalized.
    0,
    5000
 );

  container.appendChild(renderer.domElement);

  stats = new Stats();
  stats.domElement.style.position = 'absolute';
  stats.domElement.style.top = '0px';
  container.appendChild(stats.domElement);

  window.addEventListener('resize', onWindowResize, false);

  document.body.addEventListener('keydown', onKeyDown, false);
  document.body.addEventListener('keyup', onKeyUp, false);

  document.addEventListener('mousedown', onDocumentMouseDown, false);

  if (supportsWebVR) {
    vrControls = new THREE.VRControls(camera);
    vrEffect = new THREE.VREffect(renderer, function (error) {
    });
  } else {
    // Add mouse controls!
    controls = new THREE.PointerLockControls(camera);
    controls.getObject().position.y = 100;
    scene.add(controls.getObject());
  }

  ambienceSfx = new Audio('/dist/sfx/Telegraphy_-_04_-_Monopole.mp3');
  ambienceSfx.preload = 'auto';
  ambienceSfx.loop = true;
  ambienceSfx.play()

  boomSfx = new Audio('/dist/sfx/boom.mp3');
  boomSfx.preload = 'auto';
  boomSfx.volume = 0.5;

  jetpackSfx = new Audio('/dist/sfx/jetpack.mp3');
  jetpackSfx.preload = 'auto';
  jetpackSfx.loop = true;
  jetpackSfx.currentTime = 2;
  jetpackSfx.volume = 0.5;
}


function createTextMesh(text) {
  /**
   * Create text mesh that will hover above a building
   *
   * @param text: str, the text to display
   * @return: THREE.Mesh
   */

  var c = document.createElement('canvas');
  var ctx = c.getContext('2d');
  ctx.font = "Bold 40px hackerregular";
  ctx.fillStyle = "rgba(255,255,255, 0.9)";
  var w = ctx.measureText(text).width;
  c.width = 1024;
  c.height = 64;
  var ctx = c.getContext('2d');
  ctx.font = "Bold 40px hackerregular";
  ctx.fillStyle = "rgba(255,255,255, 0.9)";
  ctx.fillText(text, 0, 50);
  var texture = new THREE.Texture(c);
  texture.needsUpdate = true;
  var material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.1
  });

  var texture = new THREE.Texture(c);
  texture.needsUpdate = true;

  var mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(
      c.width,
      c.height
   ),
    material
 );
  return mesh;
}


// Move around
var onKeyDown = function (event) {
  switch (event.keyCode) {
    case 38: // up
    case 87: // w
      moveForward = true;
      break;
    case 40: // down
    case 83: // s
      moveBackward = true;
      break;
    case 37: // left
    case 65: // a
      moveLeft = true;
      break;
    case 39: // right
    case 68: // d
      moveRight = true;
      break;
    case 32: // space
      moveUp = true;
      if (SOUND_EFFECTS_ENABLED) {
        jetpackSfx.play();
      }
      break;
  }
};

var onKeyUp = function (event) {
  switch(event.keyCode) {
    case 38: // up
    case 87: // w
      moveForward = false;
      break;
    case 40: // down
    case 83: // s
      moveBackward = false;
      break;
    case 37: // left
    case 65: // a
      moveLeft = false;
      break;
    case 39: // right
    case 68: // d
      moveRight = false;
      break;
    case 32: // space
      moveUp = false;
      jetpackSfx.pause();
      jetpackSfx.currentTime = 2;
      break;
  }
};

var onDocumentMouseDown = function (event) {
  event.preventDefault();

  mouse.x = 0;
  mouse.y = 0;

  bulletRaycaster.setFromCamera(mouse, camera);

  var intersects = bulletRaycaster.intersectObjects(BUILDINGS);

  if (intersects.length > 0) {
    for (var i = 0; i < intersects.length; i++) {
      blowUpBuilding(intersects[ i ].object);
    }
  }
};

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  if (vrEffect !== undefined)
    vrEffect.setSize(window.innerWidth, window.innerHeight);
}

function animate() {

  // Get timestep
  // TODO: we're also doing this in render, we should refactor so that
  // all position recalculations are done here
  var time = performance.now();
  var delta = (time - prevTime) / 1000;

  // Update the position of the flying little sprites
  var bounds = PERSPECTIVE_BOUNDARY;
  for(var i = 0; i < dataPackets.length; i++){
    dataPackets[i].obj.position.add(dataPackets[i].speed);
    if(dataPackets[i].obj.position.x < -bounds) {
      dataPackets[i].obj.position.x = bounds;
    } else if(dataPackets[i].obj.position.x > bounds){
      dataPackets[i].obj.position.x = -bounds;
    }
    if(dataPackets[i].obj.position.z < -bounds) {
      dataPackets[i].obj.position.z = bounds;
    } else if(dataPackets[i].obj.position.z > bounds){
      dataPackets[i].obj.position.z = -bounds;
    }
  }

  // Iterate over the building state container to see if anything's
  // changed
  for (var i=0; i < BUILDING_GRID.length; i++) {
    for (var j=0; j < BUILDING_GRID[i].length; j++) {

      var _buildingMeta = BUILDING_GRID[i][j];

      if (_buildingMeta !== undefined) {
        // Make all the faces of the text meshes face the camera
        if (_buildingMeta.alive){
          if (supportsWebVR) {
            _buildingMeta.textMesh.quaternion.copy(camera.quaternion);
          } else {
            _buildingMeta.textMesh.lookAt(controls.getObject().position);
          }

          // Rotate the texture of the building to make it look like
          // it's computing something
          if (Math.random() > 0.9) {
            _buildingMeta.buildingObj.material.map = _.sample(
              towerTextures[_buildingMeta.buildingType]
           );
            _buildingMeta.buildingObj.material.needsUpdate = true;
          }
        } else {
          // Kill the building textMesh
          if (_buildingMeta.textMesh !== undefined){
            var _msg = "DROP TABLE " + _buildingMeta.tableName + ";";
            $('.terminal>.terminal-content').append(_msg + "<br >");
            $('.terminal')[0].scrollTop = $('.terminal')[0].scrollHeight;
            scene.remove(_buildingMeta.textMesh);
            delete _buildingMeta.textMesh;
          }
        }

        // Rotate and decay the velocity of the exploding fragment
        for (var fragIndex=0; fragIndex<_buildingMeta.fragments.length; fragIndex++){
          var _fragContainer = _buildingMeta.fragments[fragIndex];

          if (_fragContainer.fragment !== undefined){

            _fragContainer.fragment.rotation.set(
              Math.random() * MAX_ROTATION * 2 - MAX_ROTATION,
              Math.random() * MAX_ROTATION * 2 - MAX_ROTATION,
              Math.random() * MAX_ROTATION * 2 - MAX_ROTATION
           );

            _fragContainer.direction.x -= _fragContainer.direction.x * FRAGMENT_LATERAL_RESISTANCE_COEFFICIENT * delta;
            _fragContainer.direction.z -= _fragContainer.direction.z * FRAGMENT_LATERAL_RESISTANCE_COEFFICIENT * delta;
            _fragContainer.direction.y -= 9.8 * FRAGMENT_MASS * delta;

            _fragContainer.fragment.translateX(_fragContainer.direction.x * delta);
            _fragContainer.fragment.translateY(_fragContainer.direction.y * delta);
            _fragContainer.fragment.translateZ(_fragContainer.direction.z * delta);

            if (_fragContainer.fragment.position.y < 0) {
              scene.remove(_fragContainer.fragment);
              delete _fragContainer.fragment;
              delete _fragContainer.direction;
              delete _fragContainer;
            }
          }

        }
      }
    }
  }

  requestAnimationFrame(animate);
  if (supportsWebVR) {
    renderVR();
  } else {
    render();
  }
  stats.update();
}

function isLessThan100(element, index, array) {
  return element < 100;
}

function render() {

  // Rotate any buildings
  TWEEN.update();
  crosshair.position.set(0, 0, camera.position.z);
  crosshair.translateZ(-40);

  // Protect against falling through the map
  var pos = controls.getObject().position;
  if (pos.y < -50){
    pos.y = 100;
  }
  raycaster.ray.origin.copy(pos);
  raycaster.ray.origin.y -= 10;

  var objectsBelow = raycaster.intersectObjects(TERRAIN);
  var objectDistances = [];
  for (var i=0; i < objectsBelow.length; i++) {
    objectDistances.push(objectsBelow[i].distance);
  }
  var isOnObject = objectDistances.some(isLessThan100);

  var time = performance.now();
  var delta = (time - prevTime) / 1000;

  if (!isNaN(delta)) {
    cameraVelocity.x -= cameraVelocity.x * LATERAL_RESISTANCE_COEFFICIENT * delta;
    cameraVelocity.z -= cameraVelocity.z * LATERAL_RESISTANCE_COEFFICIENT * delta;

    cameraVelocity.y -= 9.8 * CAMERA_MASS * delta;

    // Rotate the sky
    skyBox.rotation.z -= delta / 200;
  }

  if (moveForward) cameraVelocity.z -= LATERAL_MOVEMENT_SPEED * delta;
  if (moveBackward) cameraVelocity.z += LATERAL_MOVEMENT_SPEED * delta;
  if (moveLeft) cameraVelocity.x -= LATERAL_MOVEMENT_SPEED * delta;
  if (moveRight) cameraVelocity.x += LATERAL_MOVEMENT_SPEED * delta;
  if (moveUp) cameraVelocity.y += VERTICAL_MOVEMENT_SPEED * delta;

  // Don't crash!
  if (isOnObject === true) {
    cameraVelocity.y = Math.max(0, cameraVelocity.y);
  }

  // Apply translation to the camera
  controls.getObject().translateX(cameraVelocity.x * delta);
  controls.getObject().translateY(cameraVelocity.y * delta);
  controls.getObject().translateZ(cameraVelocity.z * delta);

  prevTime = time;

  renderer.render(scene, camera);
}

function renderVR() {
  if (moveForward) {
    speed = FORWARD_SPEED;
  } else if (moveBackward) {
    speed = -FORWARD_SPEED;
  } else {
    speed = 0;
  }

  camera.translateZ(-0.3 * speed);
  raycaster.setFromCamera({ x: 0, y: 0 }, camera);

  var intersects = raycaster.intersectObjects(BUILDINGS);

  if (intersects.length > 0) {

    if (INTERSECTED != intersects[ 0 ].object) {

      if (INTERSECTED) INTERSECTED.material.emissive.setHex(INTERSECTED.currentHex)

      // "Blow up" the building by turning it red
      INTERSECTED = intersects[ 0 ].object
      INTERSECTED.currentHex = INTERSECTED.material.emissive.getHex()
      INTERSECTED.material.emissive.setHex(0xff0000)

      // Knock the buildings over!
      for (var i = 0; i < intersects.length; i++) {
        new TWEEN.Tween(intersects[ i ].object.rotation).to({
          x: Math.random() * 2 * Math.PI,
          y: Math.random() * 2 * Math.PI,
          z: Math.random() * 2 * Math.PI
        },
        2000)
        .easing(TWEEN.Easing.Elastic.Out).start()
      }

    }

  } else {

    if (INTERSECTED) INTERSECTED.material.emissive.setHex(INTERSECTED.currentHex)

    INTERSECTED = null

  }

  TWEEN.update()

  vrControls.update()

  crosshair.quaternion.copy(camera.quaternion)
  crosshair.position.set(0, 0, camera.position.z)

  if (INTERSECTED) {
    crosshair.translateZ(
      -scene.position.distanceTo(INTERSECTED.position) +
      INTERSECTED.geometry.boundingSphere.radius + 5
   )
  }
  else {
    crosshair.translateZ(-40)
  }

  vrEffect.render(scene, camera)
}
