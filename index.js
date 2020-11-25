let updateTimeout;

let setupFunction;
let clickFunction;
let updateFunction;
let drawFunction;

let _game = {};
let _frame = 0;
let _keys = {};

let _images = {};

window.addEventListener('keydown', event => {
  if (_keys[event.key] === undefined || _keys[event.key] === -1) {
    _keys[event.key] = _frame;
  }
}, false);
window.addEventListener('keyup', event => {
  _keys[event.key] = -1;
}, false);

function download(data, filename, type) {
    var file = new Blob([data], {type: type});
    if (window.navigator.msSaveOrOpenBlob) // IE10+
        window.navigator.msSaveOrOpenBlob(file, filename);
    else { // Others
        var a = document.createElement("a"),
                url = URL.createObjectURL(file);
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(function() {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);  
        }, 0); 
    }
}

let filePicker;

function readSingleFile(e) {
  var file = e.target.files[0];
  if (!file) {
    return;
  }
  var reader = new FileReader();
  reader.onload = function(e) {
    var contents = e.target.result;
    finishImport(contents);
  };
  reader.readAsText(file);
}

function importGame() {
  filePicker = document.createElement('input');
  filePicker.type = 'file';
  filePicker.addEventListener('change', readSingleFile);
  filePicker.click();
}

function finishImport(content) {
  const json = JSON.parse(atob(content));
  Object.entries(json).forEach(([key, value]) => {
    if (key === '_images') {
      loadImages(value);
    } else {
      document.getElementById(key).value = value;
    }
  });
  saveRun();
  filePicker = null;
}

function loadImages(array) {
  if (!array) return;
  _images = array.reduce((agg, { name, src }) => {
    const img = new Image();
    img.src = src;
    return {
      ...agg,
      [name]: img,
    };
  }, {});
  window.localStorage.setItem('_images', JSON.stringify(getImages()));
}

function getImages() {
  return Object.entries(_images).map(([name, img]) => ({ name, src: img.src }));
}

function exportGame() {
  const filename = prompt('name your file', 'game');
  if (!filename) return;
  const content = {
    'setup-code': getText('setup-code'),
    'click-code': getText('click-code'),
    'update-code': getText('update-code'),
    'draw-code': getText('draw-code'),
    '_images': getImages(),
  };

  const text = btoa(JSON.stringify(content));
  download(text, filename + '.gm', 'text/plain');
}

function newGame() {
  if (window.confirm('This will delete your current game, do you want to continue?')) {
    document.getElementById('setup-code').value = '';
    document.getElementById('click-code').value = '';
    document.getElementById('update-code').value = '';
    document.getElementById('draw-code').value = '';
  
    saveRun();
  }
}

function loadImage() {
  document.getElementById('image-loader').classList.add('show');
}

let currentImage;

function readImageFile(e) {
  var file = e.target.files[0];
  if (!file) {
    return;
  }
  var reader = new FileReader();
  reader.onload = function(e) {
    var contents = e.target.result;
    currentImage = contents;
  };
  reader.readAsDataURL(file);
}

function doLoadImage() {
  const name = document.getElementById('image-name').value;

  const src = currentImage;
  const img = new Image();
  img.src = src;
  img.onload = () => {
    _images[name] = img;
    window.localStorage.setItem('_images', JSON.stringify(getImages()));
  };
  cancelLoadImage();
}

function cancelLoadImage() {
  document.getElementById('image-name').value = null;
  document.getElementById('image-filepath').value = null;
  currentImage = null;
  document.getElementById('image-loader').classList.remove('show');
}

let showCode = true;

function animateResizeCanvas(ms, last) {
  const start = new Date().getTime();
  window.setTimeout(() => {
    resizeCanvas && resizeCanvas();
    const end = new Date().getTime();
    const diff = end - start;
    const remaining = ms - diff;
    if (remaining > 0) animateResizeCanvas(remaining);
    if (remaining <= 0 && !last) animateResizeCanvas(0, last);
  }, 10);
}

function toggleCode(override) {
  if (override !== undefined) showCode = override;
  else showCode = !showCode;
  const canvasContainer = document.querySelector('#canvas-container');
  const codeToggle = document.querySelector('#code-toggle');
  if (showCode) {
    canvasContainer.style.width = 800;
    codeToggle.classList.remove('closed');
    codeToggle.innerHTML = '&#9654;';
  } else {
    canvasContainer.style.width = window.innerWidth;
    codeToggle.classList.add('closed');
    codeToggle.innerHTML = '&#9664;';
  }
  animateResizeCanvas(250);
}

const TABS = ['setup', 'update', 'draw', 'click','helpers'];

function showTab(event, key) {
  const tab = event.target;
  const parent = tab.parentElement;
  const children = Array.from(parent.children);
  children.forEach(c => c.classList.remove('active'));
  tab.classList.add('active');
  TABS.forEach(TAB => {
    document.getElementById(`${TAB}-block`).style.display = TAB === key ? 'block' : 'none';
  });
  window.localStorage.setItem('selected-tab', key);
}

function restoreText(key) {
  const text = window.localStorage.getItem(key);
  document.getElementById(key).value = text;
}

function restoreImages() {
  const images = window.localStorage.getItem('_images');
  loadImages(JSON.parse(images));
}

function getText(key) {
  const text = document.getElementById(key).value;
  window.localStorage.setItem(key, text);
  return text;
}

function addImage(src) {
  const img = new Image();
  img.src = src;
  return img;
}

function addSound(src) {
  const aud = new Audio();
  aud.src = src;
  return aud;
}

function saveRun() {
  setupFunction = new Function('game', getText('setup-code'));
  clickFunction = new Function('game', 'event', getText('click-code'));
  updateFunction = new Function('game', 'frame', 'keys', getText('update-code'));
  drawFunction = new Function('game', 'images', 'frame', 'context', 'canvas', getText('draw-code'));

  _game = {};
  _frame = 0;
  _keys = {};
  setupFunction(_game);
}

function setupCanvasClickHandler() {
  document.querySelector('canvas').addEventListener('mousedown', event => {
    const { x, y } = event;
    if (clickFunction) clickFunction(_game, { x, y });
  });
}

function update() {
  try {
    if (updateFunction) updateFunction(_game, _frame, { ..._keys });
    _frame++;
    // remove released keys
    Object.entries(_keys).forEach(([key, value]) => {
      if (value === -1) {
        delete _keys[key];
      }
    });
  } catch (ex) {}
  window.setTimeout(update, 30);
}

function draw() {
  try {
    const canvas = document.querySelector('canvas');
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (drawFunction) drawFunction(_game, _images, _frame, context, canvas);
  } catch (ex) {}

  window.requestAnimationFrame(draw);
}

window.setTimeout(update, 30);
window.requestAnimationFrame(draw);