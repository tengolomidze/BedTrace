const canvas = document.getElementById("canvas")
const ctx = canvas.getContext("2d")

let bedrockImage = new Image()
bedrockImage.src = 'img/bedrock.png'
let notBedrockImage = new Image()
notBedrockImage.src = 'img/not_bedrock.png'

let ZOOM_STRENGTH = 1.1
let GRID_SIZE = 32

let scale = 75
let position = { x: 35, y: -60, z: 35 }
let blocks = []
let currentBlockType = 1

let searchSeed = "0"
let searchRadius = 1000000
let searchTiles = 4096
let isSearching = false

let worldIndex = 0
let worlds = [{
    lower: -64,
    upper: -59,
    name: "overworld_floor"
}, {
    lower: 0,
    upper: 5,
    name: "nether_floor"
}, {
    lower: 122,
    upper: 127,
    name: "nether_roof"
}]

class Block {
    constructor(x, y, z, type) {
        this.x = x
        this.y = y
        this.z = z
        this.type = type // Bedrock - 0, Not Bedrock - 1
    }
}

//STATE SAVE LOGIC
function loadState () {
    const saved = localStorage.getItem('bedtraceState')
    if (saved) {
        const state = JSON.parse(saved)

        scale = state.scale ?? 75
        position = {
            x: state.position?.x ?? 35,
            y: state.position?.y ?? -60,
            z: state.position?.z ?? 35,
        }
        blocks = (state.blocks || []).map((b) => new Block(b.x ?? 0, b.y ?? -60, b.z ?? 0, b.type ?? 1))
        searchSeed = state.searchSeed ?? "0"
        searchRadius = state.searchRadius ?? 1000000
        searchTiles = state.searchTiles ?? 4096
        worldIndex = state.worldIndex ?? 0
    }
}
const saveState = () => localStorage.setItem('bedtraceState', JSON.stringify({ blocks, scale, position, searchSeed, searchRadius, searchTiles, worldIndex }))

loadState();
setInterval(saveState, 500)

function clearAllBlocks () {
    if (blocks.length === 0) 
        return true
    if (confirm('Are you sure you want to clear all the blocks?') === true) {
        blocks = []
        return true
    }
    return false
}

//BLOCK TYPE TOGGLE LOGIC
const bedrockButton = document.getElementById('bedrock')
const notBedrockButton = document.getElementById('not-bedrock')
bedrockButton.addEventListener('click', () => {
    currentBlockType = 0
    updateButtonStates()
})
notBedrockButton.addEventListener('click', () => {
    currentBlockType = 1
    updateButtonStates()
})
const updateButtonStates = () => {
    bedrockButton.classList.remove('active')
    notBedrockButton.classList.remove('active')
    if (currentBlockType === 0) bedrockButton.classList.add('active')
    else if (currentBlockType === 1) notBedrockButton.classList.add('active')
}
updateButtonStates()
window.addEventListener("keyup", function (e) {
    if (e.code === "Digit1")
        currentBlockType = 0
    if (e.code === "Digit2")
        currentBlockType = 1
    updateButtonStates()
})


const clearAllButton = document.getElementById('clear-all')
clearAllButton.addEventListener('click', clearAllBlocks)

function updateYLevelButtonState() {
    if(position.y >= worlds[worldIndex].upper-1)
        increaseYLevelButton.disabled = true
    else
        increaseYLevelButton.disabled = false

    if(position.y <= worlds[worldIndex].lower+1)
        decreaseYLevelButton.disabled = true
    else
        decreaseYLevelButton.disabled = false
}
function increaseYLevel () {
    if(position.y >= worlds[worldIndex].upper-1) return
    position.y++
    yLevelSpan.textContent = position.y
    updateYLevelButtonState()
}
function deceraseYLevel () {
    if(position.y <= worlds[worldIndex].lower+1) return
    position.y--
    yLevelSpan.textContent = position.y
    updateYLevelButtonState()
}
function changeYLevel (y) {
    if(y <= worlds[worldIndex].lower) return
    if(y >= worlds[worldIndex].upper) return
    position.y = y
    yLevelSpan.textContent = y
    updateYLevelButtonState()
}
const yLevelSpan = document.getElementById('y-level')
yLevelSpan.textContent = position.y
const increaseYLevelButton = document.getElementById('y-level-inc')
const decreaseYLevelButton = document.getElementById('y-level-dec')
increaseYLevelButton.addEventListener('click', increaseYLevel)
decreaseYLevelButton.addEventListener('click', deceraseYLevel)
updateYLevelButtonState()


const worldTypeSpan = document.getElementById('world-type')
const worldTypeMinSpan = document.getElementById('world-type-min')
const worldTypeMaxSpan = document.getElementById('world-type-max')
worldTypeSpan.textContent = worlds[worldIndex].name
worldTypeMinSpan.textContent = worlds[worldIndex].lower+1
worldTypeMaxSpan.textContent =  worlds[worldIndex].upper-1

const nextWorld = () => {
    if(isSearching) return

    if (!clearAllBlocks())
        return

    if(worldIndex == worlds.length - 1) worldIndex = 0
    else worldIndex++
    worldTypeSpan.textContent = worlds[worldIndex].name
    worldTypeMinSpan.textContent = worlds[worldIndex].lower+1
    worldTypeMaxSpan.textContent =  worlds[worldIndex].upper-1

    changeYLevel(worlds[worldIndex].upper - 1);
}
setTimeout(() => {
    const next = document.getElementById('world-type-next');
    if (next) next.addEventListener('click', nextWorld);
}, 0);

//ROTATION LOCIG
const rotateCoordinates = (x, z, angle) => {
    angle = ((angle % 360) + 360) % 360;
    if (angle === 0) return { x: x, z: z };
    if (angle === 90) return { x: -z, z: x };
    if (angle === 180) return { x: -x, z: -z };
    if (angle === 270) return { x: z, z: -x };
    return { x: x, z: z };
};
const rotateLeft = () => {
    blocks = blocks.map(block => {
        const rotated = rotateCoordinates(block.x, block.z, 270);
        return new Block(rotated.x, block.y, rotated.z, block.type);
    });
};
const rotateRight = () => {
    blocks = blocks.map(block => {
        const rotated = rotateCoordinates(block.x, block.z, 90);
        return new Block(rotated.x, block.y, rotated.z, block.type);
    });
};
setTimeout(() => {
    const rotateLeftButton = document.getElementById('rotate-left');
    const rotateRightButton = document.getElementById('rotate-right');
    if (rotateLeftButton) rotateLeftButton.addEventListener('click', rotateLeft);
    if (rotateRightButton) rotateRightButton.addEventListener('click', rotateRight);
}, 0);


//INPUT SYSTEM
setTimeout(() => {
    const searchSeedInput = document.getElementById('search-seed');
    const searchRadiusInput = document.getElementById('search-radius');
    const searchTilesInput = document.getElementById('search-tiles');

    if (searchSeedInput) {
        searchSeedInput.value = searchSeed;
        searchSeedInput.addEventListener('change', () => {
            searchSeed = searchSeedInput.value;
        });
    }
    if (searchRadiusInput) {
        searchRadiusInput.value = searchRadius;
        searchRadiusInput.addEventListener('change', () => {
            searchRadius = parseInt(searchRadiusInput.value) || 1000000;
        });
    }
    if (searchTilesInput) {
        searchTilesInput.value = searchTiles;
        searchTilesInput.addEventListener('change', () => {
            searchTiles = parseInt(searchTilesInput.value) || 4096;
        });
    }
}, 0);

//BEST RADIUS LOGIC
let bestRadiusSpan = document.getElementById("best-radius");
const calculatebestRadius = () => {
    let p = 1;
    blocks.forEach(block => {
        let _p = (block.y - worlds[worldIndex].lower) / (worlds[worldIndex].upper - worlds[worldIndex].lower)
       if (worldIndex === 2)
            p *= (block.type === 1 ? 1 - _p : _p)
        else 
            p *= (block.type === 0 ? 1 - _p : _p)
    })

    let area = 1/p;
    bestRadiusSpan.textContent = Math.round(Math.sqrt(area)/10)*10/2;
}

// SEARCH AND CONSOLE LOGIC
let socket = null;
const consoleOutput = document.getElementById('console-output');
const progressSection = document.getElementById('progress-section');
const progressFill = document.getElementById('progress-bar-fill');
const progressText = document.getElementById('progress-text');
const searchButton = document.getElementById('search-btn');
const stopButton = document.getElementById('stop-btn');

const resetProgress = () => {
    if (progressSection) progressSection.style.display = 'none';
    if (progressFill) progressFill.style.width = '0%';
    if (progressText) progressText.textContent = '0%';
};

const formatCompactNumber = (value) => {
    const absValue = Math.abs(value);
    if (absValue >= 1e12) return `${(value / 1e12).toFixed(absValue >= 1e13 ? 0 : 1)}T`;
    if (absValue >= 1e9) return `${(value / 1e9).toFixed(absValue >= 1e10 ? 0 : 1)}B`;
    if (absValue >= 1e6) return `${(value / 1e6).toFixed(absValue >= 1e7 ? 0 : 1)}M`;
    if (absValue >= 1e3) return `${(value / 1e3).toFixed(absValue >= 1e4 ? 0 : 1)}K`;
    return `${value}`;
};

const updateProgress = (message) => {
    const match = message.match(/progress:\s*(\d+)\s*\/\s*(\d+)/i);
    if (!match) return;

    const current = parseInt(match[1], 10);
    const total = parseInt(match[2], 10);
    if (!total) return;

    const percent = Math.min(100, Math.max(0, Math.round((current / total) * 100)));
    if (progressSection) progressSection.style.display = 'flex';
    if (progressFill) progressFill.style.width = `${percent}%`;
    if (progressText) progressText.textContent = `${percent}% (${formatCompactNumber(current)}/${formatCompactNumber(total)})`;
};

const consoleLog = (message, type = 'normal') => {
    const line = document.createElement('div');
    line.className = `log-line ${type === 'error' ? 'log-error' : type === 'success' ? 'log-success' : ''}`;
    line.textContent = message;
    consoleOutput.appendChild(line);
    consoleOutput.scrollTop = consoleOutput.scrollHeight;
};
const disableControls = () => {
    const controls = document.querySelectorAll('#bedrock, #not-bedrock, #clear-all, #rotate-left, #rotate-right, #search-seed, #search-radius, #search-tiles, #world-type-next');
    controls.forEach(ctrl => ctrl.disabled = true);
    isSearching = true;
    if (searchButton) searchButton.style.display = 'none';
    if (stopButton) stopButton.style.display = 'block';
};
const enableControls = () => {
    const controls = document.querySelectorAll('#bedrock, #not-bedrock, #clear-all, #rotate-left, #rotate-right, #search-seed, #search-radius, #search-tiles, #world-type-next');
    controls.forEach(ctrl => ctrl.disabled = false);
    isSearching = false;
    if (searchButton) searchButton.style.display = 'block';
    if (stopButton) stopButton.style.display = 'none';
};
setTimeout(() => {
    if (searchButton) 
        searchButton.addEventListener('click', performSearch);
    if (stopButton) 
        stopButton.addEventListener('click', stopSearch);
}, 0);

const connectSocket = () => {
    if (socket && socket.readyState === WebSocket.OPEN) return socket;

    socket = new WebSocket('ws://127.0.0.1:8001');
    socket.addEventListener('open', () => consoleLog('Connected to server', 'success'));
    socket.addEventListener('message', (event) => {
        const message = JSON.parse(event.data);
        if (message.type === 'output') {
            updateProgress(message.data);
            if(!message.data.includes("progress"))
                consoleLog(message.data, 'normal');
        } else if (message.type === 'started') {
            consoleLog('Process started', 'success');
        } else if (message.type === 'done') {
            consoleLog(`Process finished with exit code ${message.code}`, 'success');
            enableControls();
        } else if (message.type === 'stopped') {
            consoleLog(message.message, 'normal');
            enableControls();
        } else if (message.type === 'error') {
            consoleLog(message.message, 'error');
            enableControls();
        }
    });
    socket.addEventListener('close', () => {
        consoleLog('Disconnected from server', 'error');
        enableControls();
    });
    return socket;
};
const stopSearch = () => {
    if (!isSearching) return;
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ action: 'stop' }));
    }
};
const performSearch = () => {
    if (isSearching) return;

    const ws = connectSocket();
    disableControls();
    consoleOutput.innerHTML = '';
    resetProgress();
    const payload = {
        action: 'run',
        seed: searchSeed,
        xMin: -searchRadius,
        xMax: searchRadius,
        zMin: -searchRadius,
        zMax: searchRadius,
        tile: searchTiles,
        worldType: worlds[worldIndex].name,
        patterns: blocks.map((b) => {
            return {dx: b.x - blocks[0].x, y: b.y, dz: b.z - blocks[0].z, expected: b.type}
        }),
    };

    if (ws.readyState === WebSocket.OPEN) 
        ws.send(JSON.stringify(payload));
    else {
        ws.addEventListener('open', () => {
            ws.send(JSON.stringify(payload));
        }, { once: true });
    }
};


//CANVAS LOGIC
let mouse = {
    isDown: false,
    isDraging: false,
    lastDownTime: 0,
    lastDownPos: { x: 0, y: 0 },
}

document.addEventListener('contextmenu', event => event.preventDefault());
canvas.addEventListener('pointerdown', (e) => { 
    mouse.isDown = true; 
    mouse.isDraging = false; 
    mouse.lastDownTime = performance.now();  
    mouse.lastDownPos = { x: e.offsetX, y: e.offsetY }; 
})
window.addEventListener('pointermove', (e) => { 
    if (mouse.isDraging) {
        position.x += e.movementX;
        position.z += e.movementY;
    }

    let a = performance.now() - mouse.lastDownTime > 100;
    let b = Math.abs(e.offsetX - mouse.lastDownPos.x) > 7 || Math.abs(e.offsetY - mouse.lastDownPos.y) > 7;
    if (mouse.isDown && (a || b))
        mouse.isDraging = true; 
})
canvas.addEventListener('pointerup', (e) => {
    if (!mouse.isDraging) {
        let x = Math.floor((e.offsetX - position.x) / scale);
        let z = Math.floor((e.offsetY - position.z) / scale);
        let block = blocks.find(b => b.x === x && b.y === position.y && b.z === z);
        
        if (e.button === 0 && !isSearching) {
            if (block) 
                block.type = currentBlockType;
            else if (x < GRID_SIZE/2 && z < GRID_SIZE/2 && x >= -GRID_SIZE/2 && z >= -GRID_SIZE/2)
                blocks.push(new Block(x, position.y, z, currentBlockType));
        } else if (e.button === 2 && !isSearching) 
            blocks = blocks.filter(b => !(b.x === x && b.y === position.y && b.z === z));
    }

    mouse.isDown = false; 
    mouse.isDraging = false;

    calculatebestRadius();
})

canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (e.deltaY < 0)
        scale *= ZOOM_STRENGTH;
    else
        if (scale > 20)
            scale /= ZOOM_STRENGTH;
})

const drawGrid = () => {
    for (let z = -GRID_SIZE/2; z < GRID_SIZE/2; z++) {
        for (let x = -GRID_SIZE/2; x < GRID_SIZE/2; x++) {
            ctx.strokeStyle = "#888888";
            ctx.lineWidth = 1;
            ctx.strokeRect(x*scale + position.x, z*scale + position.z, scale, scale);
        }
    }   
};

const drawBlocks = (y) => {
    blocks.forEach(block => {
        if(block.y != y) return

        ctx.strokeStyle = "#bbbbbb";
        ctx.lineWidth = 1;

        if (block.type === 0) {
            ctx.drawImage(bedrockImage, block.x*scale + position.x, block.z*scale + position.z, scale, scale);
            ctx.strokeRect(block.x*scale + position.x, block.z*scale + position.z, scale, scale);
        } else {
            ctx.drawImage(notBedrockImage, block.x*scale + position.x, block.z*scale + position.z, scale, scale);
            ctx.strokeRect(block.x*scale + position.x, block.z*scale + position.z, scale, scale);
        }
    })
};




function step (timestamp) {
    ctx.canvas.width = window.innerWidth - 400; 
    ctx.canvas.height = window.innerHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBlocks(position.y - 1);
    drawGrid();

    ctx.fillStyle = `rgba(0, 3, 15, ${1 - Math.min(0.3*scale / 40, 0.33)})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawBlocks(position.y);
    requestAnimationFrame(step);        
}
requestAnimationFrame(step);