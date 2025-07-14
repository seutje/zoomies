// Game canvas and context
/* global Car */
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// UI elements
const populationSlider = document.getElementById('populationSlider');
const populationValue = document.getElementById('populationValue');
const speedSlider = document.getElementById('speedSlider');
const speedValue = document.getElementById('speedValue');
const lapSlider = document.getElementById('lapSlider');
const lapValue = document.getElementById('lapValue');
const nextGenBtn = document.getElementById('nextGenBtn');
const startStopBtn = document.getElementById('startStopBtn');
const generationEl = document.getElementById('generation');
const bestFitnessEl = document.getElementById('bestFitness');
const carsRunningEl = document.getElementById('carsRunning');
const leaderboardList = document.getElementById('leaderboardList');

// Game parameters
let populationSize = 50;
let simulationSpeed = 1;
let lapCount = 5;
let generation = 1;
let cars = [];
let bestCars = [];
let bestOverallCars = [];
let bestFitnessOverall = 0;
let track = [];
let checkpoints = [];
let isRunning = false;
let started = false;


// Initialize the track
function initTrack() {
    track = [];
    checkpoints = [];
    
    // Create elongated oval track boundaries
    const centerX = 400;
    const centerY = 250;
    const outerRx = 350;
    const outerRy = 200;
    const innerRx = 250;
    const innerRy = 150;
    
    // Create outer boundary
    for (let angle = 0; angle < Math.PI * 2; angle += 0.1) {
        const x1 = centerX + outerRx * Math.cos(angle);
        const y1 = centerY + outerRy * Math.sin(angle);
        const x2 = centerX + outerRx * Math.cos(angle + 0.1);
        const y2 = centerY + outerRy * Math.sin(angle + 0.1);
        
        track.push({ x1, y1, x2, y2, type: 'outer' });
    }
    
    // Create inner boundary
    for (let angle = 0; angle < Math.PI * 2; angle += 0.1) {
        const x1 = centerX + innerRx * Math.cos(angle);
        const y1 = centerY + innerRy * Math.sin(angle);
        const x2 = centerX + innerRx * Math.cos(angle + 0.1);
        const y2 = centerY + innerRy * Math.sin(angle + 0.1);
        
        track.push({ x1, y1, x2, y2, type: 'inner' });
    }
    
    // Create checkpoints along the track
    const numCheckpoints = 20;
    const trackWidth = (outerRx + innerRx) / 2;
    const trackHeight = (outerRy + innerRy) / 2;
    
    for (let i = 0; i < numCheckpoints; i++) {
        const angle = (i / numCheckpoints) * Math.PI * 2;
        const x = centerX + trackWidth * Math.cos(angle);
        const y = centerY + trackHeight * Math.sin(angle);
        
        checkpoints.push({ x, y, radius: 40 });
    }
}

// Draw the track
function drawTrack() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw track background with gradient
    const gradient = ctx.createRadialGradient(400, 250, 0, 400, 250, 350);
    gradient.addColorStop(0, '#001122');
    gradient.addColorStop(1, '#000000');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw track boundaries with glow effect
    ctx.shadowColor = '#00ff88';
    ctx.shadowBlur = 5;
    
    for (const line of track) {
        ctx.strokeStyle = line.type === 'outer' ? '#00ff88' : '#00ffff';
        ctx.lineWidth = line.type === 'outer' ? 4 : 3;
        ctx.beginPath();
        ctx.moveTo(line.x1, line.y1);
        ctx.lineTo(line.x2, line.y2);
        ctx.stroke();
    }
    
    ctx.shadowBlur = 0;
    
    // Draw checkpoints with animation
    for (let i = 0; i < checkpoints.length; i++) {
        const checkpoint = checkpoints[i];
        // Reverse the pulsating order by offsetting the phase with the
        // reversed checkpoint index.
        const reverseIndex = checkpoints.length - 1 - i;
        const pulse = Math.sin(Date.now() * 0.005 + reverseIndex) * 0.2 + 0.8;
        
        // Outer glow
        ctx.shadowColor = '#ffaa00';
        ctx.shadowBlur = 20 * pulse;
        
        ctx.fillStyle = `rgba(255, 170, 0, ${0.3 * pulse})`;
        ctx.beginPath();
        ctx.arc(checkpoint.x, checkpoint.y, checkpoint.radius * pulse, 0, Math.PI * 2);
        ctx.fill();
        
        // Inner circle
        ctx.shadowBlur = 0;
        ctx.fillStyle = `rgba(255, 170, 0, ${0.5 * pulse})`;
        ctx.beginPath();
        ctx.arc(checkpoint.x, checkpoint.y, checkpoint.radius * 0.7 * pulse, 0, Math.PI * 2);
        ctx.fill();
        
        // Checkpoint number
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px Orbitron';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText((i + 1).toString(), checkpoint.x, checkpoint.y);
    }
}

// Initialize cars
function initCars() {
    cars = [];
    
    if (bestCars.length > 0) {
        // Create new generation from best cars
        for (let i = 0; i < populationSize; i++) {
            const parentIndex = i % bestCars.length;
            const parent = bestCars[parentIndex];
            cars.push(new Car(parent.brain));
        }
    } else {
        // Create random cars
        for (let i = 0; i < populationSize; i++) {
            cars.push(new Car());
        }
    }
}

// Calculate the next generation
function nextGeneration() {
    // Sort cars by fitness
    cars.sort((a, b) => b.fitness - a.fitness);

    const currentBestFitness = cars[0].fitness;

    if (currentBestFitness > bestFitnessOverall || bestOverallCars.length === 0) {
        // Current generation has a new best performer
        bestFitnessOverall = currentBestFitness;
        bestOverallCars = cars.slice(0, 5);
        bestCars = bestOverallCars;
    } else {
        // Use best overall performers if current gen is worse
        bestCars = bestOverallCars;
    }

    // Update UI
    generation++;
    generationEl.textContent = generation;
    bestFitnessEl.textContent = Math.round(bestFitnessOverall);
    
    // Create new generation
    initCars();
}

// Update the simulation
function update() {
    if (!isRunning) return;
    
    // Update cars multiple times based on simulation speed
    for (let s = 0; s < simulationSpeed; s++) {
        let activeCars = 0;
        
        for (const car of cars) {
            car.update();
            if (!car.dead && !car.finished) {
                activeCars++;
            }
        }
        
        carsRunningEl.textContent = activeCars;
        
        // Calculate track progress
        const maxProgress = Math.max(
            ...cars.map(c => c.lap * checkpoints.length + c.checkpointIndex)
        );
        const progress = (maxProgress / (checkpoints.length * lapCount)) * 100;
        document.getElementById('trackProgress').textContent = Math.round(progress) + '%';
        
        // Update leaderboard
        updateLeaderboard();
        
        if (activeCars === 0) {
            nextGeneration();
        }
    }
    
    // Draw everything
    drawTrack();
    
    for (const car of cars) {
        car.draw();
    }
    
    requestAnimationFrame(update);
}

// Update leaderboard
function updateLeaderboard() {
    const sortedCars = [...cars].sort((a, b) => b.fitness - a.fitness).slice(0, 10);
    
    leaderboardList.innerHTML = '';
    sortedCars.forEach((car, index) => {
        const item = document.createElement('div');
        item.className = 'leaderboard-item';
        
        let status = 'active';
        if (car.dead) status = 'crashed';
        else if (car.finished) status = 'finished';
        
        item.innerHTML = `
            <span><span class="rank">#${index + 1}</span> Car ${car.color.match(/\d+/)[0]}</span>
            <span class="fitness">${Math.round(car.fitness)}</span>
            <span class="status ${status}">${status}</span>
        `;
        leaderboardList.appendChild(item);
    });
}

// Start the simulation
function start() {
    initTrack();
    initCars();
    isRunning = true;
    bestFitnessEl.textContent = Math.round(bestFitnessOverall);
    update();
}

// Event listeners
populationSlider.addEventListener('input', () => {
    populationSize = parseInt(populationSlider.value);
    populationValue.textContent = populationSize;
});

speedSlider.addEventListener('input', () => {
    simulationSpeed = parseInt(speedSlider.value);
    speedValue.textContent = simulationSpeed + 'x';
});

lapSlider.addEventListener('input', () => {
    lapCount = parseInt(lapSlider.value);
    lapValue.textContent = lapCount;
});

nextGenBtn.addEventListener('click', () => {
    nextGeneration();
});

startStopBtn.addEventListener('click', () => {
    if (!started) {
        start();
        startStopBtn.textContent = 'Stop';
        started = true;
    } else if (isRunning) {
        isRunning = false;
        startStopBtn.textContent = 'Start';
    } else {
        isRunning = true;
        startStopBtn.textContent = 'Stop';
        update();
    }
});

// Export classes for testing in Node environment
if (typeof module !== 'undefined' && module.exports) {
    const Car = require('./Car');
    const { NeuralNetwork, sigmoid } = require('./NeuralNetwork');
    const Matrix = require('./Matrix');
    module.exports = { Car, NeuralNetwork, Matrix, sigmoid };
}
