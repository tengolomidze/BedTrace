const canvas = document.querySelector(".canvas");
const ctx = canvas.getContext("2d");

let bedrockImage = new Image();
bedrockImage.src = 'img/bedrock.png';
let notBedrockImage = new Image();
notBedrockImage.src = 'img/not_bedrock.png';

let zoomStrength = 1.1;

let scale = 75;
let position = { x: 35, y: -60, z: 35 };
let blocks = [];
let currentBlockType = 1;
let gridSize = 16;

let searchSeed = 0;
let searchRadius = 1000000;
let searchTiles = 4096;
let isSearching = false;

let worldI = 0
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
        this.x = x;
        this.y = y;
        this.z = z;
        this.type = type; // Bedrock - 0, Not Bedrock - 1
    }
}

//STATE SAVE LOGIC
const loadState = () => {
    const saved = localStorage.getItem('bedtraceState');
    if (saved) {
        const state = JSON.parse(saved);
        scale = state.scale || 75;
        position = {
            x: state.position?.x ?? 35,
            y: state.position?.y ?? -60,
            z: state.position?.z ?? 35,
        };
        blocks = (state.blocks || []).map((b) => new Block(b.x ?? 0, b.y ?? -60, b.z ?? 0, b.type ?? 1));
        searchSeed = state.searchSeed ?? 0;
        searchRadius = state.searchRadius ?? 1000000;
        searchTiles = state.searchTiles ?? 4096;
        worldI = state.worldI ?? 0;
    }
};
const saveState = () => {
    localStorage.setItem('bedtraceState', JSON.stringify({ blocks, scale, position, searchSeed, searchRadius, searchTiles, worldI }));
};
loadState();
setInterval(saveState, 1000);

const clearAllBlocks = () => {
    if (blocks.length === 0) return;
    if (confirm('Are you sure you want to clear all the blocks?')) 
        blocks = [];
}

//BLOCK TYPE TOGGLE LOGIC
const bedrockBtn = document.querySelector('.bedrock');
const notBedrockBtn = document.querySelector('.not-bedrock');
bedrockBtn.addEventListener('click', () => {
    currentBlockType = 0;
    updateButtonStates();
});
notBedrockBtn.addEventListener('click', () => {
    currentBlockType = 1;
    updateButtonStates();
});
const updateButtonStates = () => {
    bedrockBtn.classList.remove('active');
    notBedrockBtn.classList.remove('active');
    if (currentBlockType === 0) bedrockBtn.classList.add('active');
    else if (currentBlockType === 1) notBedrockBtn.classList.add('active');
};
updateButtonStates();
window.addEventListener("keyup", function (e) {
    console.log(e.code)
    if (e.code === "Digit1")
        currentBlockType = 0;
    if (e.code === "Digit2")
        currentBlockType = 1;
    updateButtonStates()
});


const clearAllBtn = document.querySelector('.clear-all');
clearAllBtn.addEventListener('click', clearAllBlocks);

const yLevelSpan = document.querySelector('.y-level');
yLevelSpan.textContent = position.y;
const increaseYLevel = () => {
    if(position.y >= worlds[worldI].upper-1) return
    position.y++;
    yLevelSpan.textContent = position.y;
}
const deceraseYLevel = () => {
    if(position.y <= worlds[worldI].lower+1) return
    position.y--;
    yLevelSpan.textContent = position.y;
}
const changeYLevel = (y) => {
    if(y <= worlds[worldI].lower) return
    if(y >= worlds[worldI].upper) return
    position.y = y;
    yLevelSpan.textContent = y;
}
setTimeout(() => {
    const increase = document.querySelector('.y-level-inc');
    const decrease = document.querySelector('.y-level-dec');
    if (increase) increase.addEventListener('click', increaseYLevel);
    if (decrease) decrease.addEventListener('click', deceraseYLevel);
}, 0);

const worldTypeSpan = document.querySelector('.world-type');
const worldTypeMinSpan = document.querySelector('.world-type-min');
const worldTypeMaxSpan = document.querySelector('.world-type-max');

worldTypeSpan.textContent = worlds[worldI].name
worldTypeMinSpan.textContent = worlds[worldI].lower+1
worldTypeMaxSpan.textContent =  worlds[worldI].upper-1

const nextWorld = () => {
    if(isSearching) return
    if(worldI == worlds.length - 1) worldI = 0
    else worldI++
    worldTypeSpan.textContent = worlds[worldI].name
    worldTypeMinSpan.textContent = worlds[worldI].lower+1
    worldTypeMaxSpan.textContent =  worlds[worldI].upper-1

    changeYLevel(worlds[worldI].upper - 1);
    clearAllBlocks();
}
setTimeout(() => {
    const next = document.querySelector('.world-type-next');
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
    const rotateLeftBtn = document.querySelector('.rotate-left');
    const rotateRightBtn = document.querySelector('.rotate-right');
    if (rotateLeftBtn) rotateLeftBtn.addEventListener('click', rotateLeft);
    if (rotateRightBtn) rotateRightBtn.addEventListener('click', rotateRight);
}, 0);


//INPUT SYSTEM
setTimeout(() => {
    const searchSeedInput = document.querySelector('.search-seed');
    const searchRadiusInput = document.querySelector('.search-radius');
    const searchTilesInput = document.querySelector('.search-tiles');

    if (searchSeedInput) {
        searchSeedInput.value = searchSeed;
        searchSeedInput.addEventListener('change', () => {
            searchSeed = parseInt(searchSeedInput.value) || 0;
            saveState();
        });
    }
    if (searchRadiusInput) {
        searchRadiusInput.value = searchRadius;
        searchRadiusInput.addEventListener('change', () => {
            searchRadius = parseInt(searchRadiusInput.value) || 1000000;
            saveState();
        });
    }
    if (searchTilesInput) {
        searchTilesInput.value = searchTiles;
        searchTilesInput.addEventListener('change', () => {
            searchTiles = parseInt(searchTilesInput.value) || 4096;
            saveState();
        });
    }
}, 0);

//BEST RADIUS LOGIC
let bestRadiusSpan = document.querySelector(".best-radius");
const calculatebestRadius = () => {
    let p = 1;
    blocks.forEach(block => {
        let _p = (block.y - worlds[worldI].lower) / (worlds[worldI].upper - worlds[worldI].lower)
       if (worldI === 2)
            p *= (block.type === 1 ? 1 - _p : _p)
        else 
            p *= (block.type === 0 ? 1 - _p : _p)
    })

    let area = 1/p;
    bestRadiusSpan.textContent = Math.round(Math.sqrt(area)/10)*10/2;
}

// SEARCH AND CONSOLE LOGIC
let socket = null;
const consoleOutput = document.querySelector('.console-output');
const progressSection = document.querySelector('.progress-section');
const progressFill = document.querySelector('.progress-bar-fill');
const progressText = document.querySelector('.progress-text');
const searchBtn = document.querySelector('.search-btn');
const stopBtn = document.querySelector('.stop-btn');

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
    const controls = document.querySelectorAll('.bedrock, .not-bedrock, .air, .clear-all, .rotate-left, .rotate-right, .search-radius, .search-tiles');
    controls.forEach(ctrl => ctrl.disabled = true);
    isSearching = true;
    if (searchBtn) searchBtn.style.display = 'none';
    if (stopBtn) stopBtn.style.display = 'block';
};
const enableControls = () => {
    const controls = document.querySelectorAll('.bedrock, .not-bedrock, .air, .clear-all, .rotate-left, .rotate-right, .search-radius, .search-tiles');
    controls.forEach(ctrl => ctrl.disabled = false);
    isSearching = false;
    if (searchBtn) searchBtn.style.display = 'block';
    if (stopBtn) stopBtn.style.display = 'none';
};
setTimeout(() => {
    if (searchBtn) 
        searchBtn.addEventListener('click', performSearch);
    if (stopBtn) 
        stopBtn.addEventListener('click', stopSearch);
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
        worldType: worlds[worldI].name,
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
            else if (x < gridSize && z < gridSize && x >= -gridSize && z >= -gridSize)
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
        scale *= zoomStrength;
    else
        if (scale > 20)
            scale /= zoomStrength;
})

const drawGrid = () => {
    for (let z = -gridSize; z < gridSize; z++) {
        for (let x = -gridSize; x < gridSize; x++) {
            ctx.strokeStyle = "#888888";
            ctx.lineWidth = 1;
            ctx.strokeRect(x*scale + position.x, z*scale + position.z, scale, scale);
        }
    }   
    
    let opacity = Math.min(0.3*scale / 40, 0.33);
    ctx.fillStyle = `rgba(0, 3, 15, ${1-opacity})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
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

const step = (timestamp) => {
    canvas.width = window.innerWidth - 400;
    canvas.height = window.innerHeight;
    ctx.canvas.width = window.innerWidth - 400; 
    ctx.canvas.height = window.innerHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBlocks(position.y-1);
    drawGrid();
    drawBlocks(position.y);
    requestAnimationFrame(step);        
}

requestAnimationFrame(step);