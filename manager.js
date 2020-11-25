let LOCKED_FILES = ['setup', 'update', 'draw', 'click'];
let allFiles = getAllFiles() || [...LOCKED_FILES];
let openTabs = getTabState() || LOCKED_FILES.map((name, i) => ({
  name,
  selection: [0, 0],
  active: i === 0,
}));

function download(data, filename, type) {
  var file = new Blob([data], { type: type });
  if (window.navigator.msSaveOrOpenBlob) // IE10+
    window.navigator.msSaveOrOpenBlob(file, filename);
  else { // Others
    var a = document.createElement("a"),
      url = URL.createObjectURL(file);
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
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
  reader.onload = function (e) {
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
  allFiles = [];
  openTabs = LOCKED_FILES.map((name, i) => ({
    name,
    selection: [0, 0],
    active: i === 0,
  }));
  Object.entries(json).forEach(([key, value]) => {
    if (key === '_images') {
      loadImages(value);
    } else {
      window.localStorage.setItem(`${key}`, value);
      allFiles.push(key.substr(0, key.length - 5));
    }
  });
  const newlySelectedTab = openTabs[0];
  codeEditor.value = window.localStorage.getItem(`${newlySelectedTab.name}-code`) || '';
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
  // THIS IS NOT WORKING...
  const filename = prompt('name your file', 'game');
  if (!filename) return;
  const content = {
    ...allFiles.reduce((res, file) => ({
      ...res,
      [`${file}-code`]: window.localStorage.getItem(`${file}-code`),
    }, {})),
    '_images': getImages(),
  };

  const text = btoa(JSON.stringify(content));
  download(text, filename + '.gm', 'text/plain');
}

function newGame() {
  if (window.confirm('This will delete your current game, do you want to continue?')) {
    // go through and delete all local storage for any files
    allFiles.forEach(file => window.localStorage.removeItem(`${file}-code`));

    // reset to default state
    allFiles = [...LOCKED_FILES];
    openTabs = LOCKED_FILES.map((name, i) => ({
      name,
      selection: [0, 0],
      active: i === 0,
    }));
    
    document.querySelector('#code-editor').value = '';
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
  reader.onload = function (e) {
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

function getTabState() {
  return JSON.parse(window.localStorage.getItem('tab-state'));
}

function getAllFiles() {
  return JSON.parse(window.localStorage.getItem('all-files'));
}


function initializeTabs() {
  const tabContainer = document.querySelector('.tabs');
  openTabs.forEach(tab => {
    const el = document.createElement('div');
    el.addEventListener('click', (event) => showTab(event, tab.name));
    el.innerText = `${tab.name}.js`;
    if (tab.active) el.classList.add('active');
    tabContainer.appendChild(el);
  });
}

function showTab(event, key) {
  const tab = event.target;
  const parent = tab.parentElement;
  const children = Array.from(parent.children);
  children.forEach(c => c.classList.remove('active'));
  tab.classList.add('active');

  const codeEditor = document.querySelector('#code-editor');
  const currentSelectedTab = openTabs.find(t => t.active);
  const newlySelectedTab = openTabs.find(t => t.name === key);

  window.localStorage.setItem(`${currentSelectedTab.name}-code`, codeEditor.value);
  currentSelectedTab.active = false;
  currentSelectedTab.selection = [codeEditor.selectionStart, codeEditor.selectionEnd];

  newlySelectedTab.active = true;
  codeEditor.value = window.localStorage.getItem(`${newlySelectedTab.name}-code`) || '';
  [codeEditor.selectionStart, codeEditor.selectionEnd] = newlySelectedTab.selection;
  codeEditor.focus();
}

function restoreImages() {
  const images = window.localStorage.getItem('_images');
  loadImages(JSON.parse(images));
}
