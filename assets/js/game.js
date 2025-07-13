// Canvas setup
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// UI elements
const populationSlider = document.getElementById('populationSlider');
const populationValue = document.getElementById('populationValue');
const speedSlider = document.getElementById('speedSlider');
const speedValue = document.getElementById('speedValue');
const startBtn = document.getElementById('startBtn');
const nextGenBtn = document.getElementById('nextGenBtn');
const resetBtn = document.getElementById('resetBtn');
const generationNumberEl = document.getElementById('generationNumber');
const bestTimeEl = document.getElementById('bestTime');
const completionRateEl = document.getElementById('completionRate');
const progressFillEl = document.getElementById('progressFill');
const leaderboardListEl = document.getElementById('leaderboardList');

// Track configuration
const track = {
    width: 60,
    checkpoints: [
        { x: 160, y: 300, passed: false },
        { x: 200, y: 200, passed: false },
        { x: 400, y: 150, passed: false },
        { x: 600, y: 200, passed: false },
        { x: 640, y: 300, passed: false },
        { x: 600, y: 400, passed: false },
        { x: 400, y: 450, passed: false },
        { x: 200, y: 400, passed: false }
    ],
    startX: 160,
    startY: 300,
    startAngle: 0
};

// Neural Network class
class NeuralNetwork {
    constructor(inputNodes, hiddenNodes, outputNodes, activationFunction = 'sigmoid') {
        this.inputNodes = inputNodes;
        this.hiddenNodes = hiddenNodes;
        this.outputNodes = outputNodes;
        this.activationFunction = activationFunction;
        
        // Initialize weights with random values
        this.weightsIH = this.createMatrix(this.hiddenNodes, this.inputNodes);
        this.weightsHO = this.createMatrix(this.outputNodes, this.hiddenNodes);
        
        // Initialize bias
        this.biasH = this.createMatrix(this.hiddenNodes, 1);
        this.biasO = this.createMatrix(this.outputNodes, 1);
        
        this.randomizeWeights();
    }
    
    createMatrix(rows, cols) {
        const matrix = new Array(rows);
        for (let i = 0; i < rows; i++) {
            matrix[i] = new Array(cols).fill(0);
        }
        return matrix;
    }
    
    randomizeWeights() {
        this.weightsIH = this.weightsIH.map(row => row.map(() => Math.random() * 2 - 1));
        this.weightsHO = this.weightsHO.map(row => row.map(() => Math.random() * 2 - 1));
        this.biasH = this.biasH.map(row => row.map(() => Math.random() * 2 - 1));
        this.biasO = this.biasO.map(row => row.map(() => Math.random() * 2 - 1));
    }
    
    mutate(mutationRate) {
        this.weightsIH = this.mutateMatrix(this.weightsIH, mutationRate);
        this.weightsHO = this.mutateMatrix(this.weightsHO, mutationRate);
        this.biasH = this.mutateMatrix(this.biasH, mutationRate);
        this.biasO = this.mutateMatrix(this.biasO, mutationRate);
    }
    
    mutateMatrix(matrix, mutationRate) {
        return matrix.map(row => 
            row.map(val => {
                if (Math.random() < mutationRate) {
                    return val + (Math.random() * 0.4 - 0.2); // Small random adjustment
                }
                return val;
            })
        );
    }
    
    predict(inputArray) {
        let inputs = this.createMatrix(this.inputNodes, 1);
        for (let i = 0; i < this.inputNodes; i++) {
            inputs[i][0] = inputArray[i];
        }
        
        // Calculate hidden layer
        let hidden = this.matrixMultiply(this.weightsIH, inputs);
        hidden = this.matrixAdd(hidden, this.biasH);
        hidden = this.activate(hidden);
        
        // Calculate output layer
        let outputs = this.matrixMultiply(this.weightsHO, hidden);
        outputs = this.matrixAdd(outputs, this.biasO);
        outputs = this.activate(outputs);
        
        return outputs.flat();
    }
    
    matrixMultiply(a, b) {
        const result = this.createMatrix(a.length, b[0].length);
        for (let i = 0; i < a.length; i++) {
            for (let j = 0; j < b[0].length; j++) {
                let sum = 0;
                for (let k = 0; k < a[0].length; k++) {
                    sum += a[i][k] * b[k][j];
                }
                result[i][j] = sum;
            }
        }
        return result;
    }
    
    matrixAdd(a, b) {
        const result = this.createMatrix(a.length, a[0].length);
        for (let i = 0; i < a.length; i++) {
            for (let j = 0; j < a[0].length; j++) {
                result[i][j] = a[i][j] + b[i][j];
            }
        }
        return result;
    }
    
    activate(matrix) {
        const result = this.createMatrix(matrix.length, matrix[0].length);
        for (let i = 0; i < matrix.length; i++) {
            for (let j = 0; j < matrix[0].length; j++) {
                if (this.activationFunction === 'sigmoid') {
                    result[i][j] = 1 / (1 + Math.exp(-matrix[i][j]));
                } else if (this.activationFunction === 'relu') {
                    result[i][j] = Math.max(0, matrix[i][j]);
                } else {
                    result[i][j] = matrix[i][j]; // Linear
                }
            }
        }
        return result;
    }
    
    static crossover(parentA, parentB) {
        const child = new NeuralNetwork(
            parentA.inputNodes,
            parentA.hiddenNodes,
            parentA.outputNodes,
            parentA.activationFunction
        );
        
        // Perform crossover for weights and biases
        child.weightsIH = NeuralNetwork.matrixCrossover(parentA.weightsIH, parentB.weightsIH);
        child.weightsHO = NeuralNetwork.matrixCrossover(parentA.weightsHO, parentB.weightsHO);
        child.biasH = NeuralNetwork.matrixCrossover(parentA.biasH, parentB.biasH);
        child.biasO = NeuralNetwork.matrixCrossover(parentA.biasO, parentB.biasO);
        
        return child;
    }
    
    static matrixCrossover(matrixA, matrixB) {
        const rows = matrixA.length;
        const cols = matrixA[0].length;
        const result = new Array(rows);
        
        for (let i = 0; i < rows; i++) {
            result[i] = new Array(cols);
            const crossoverPoint = Math.floor(Math.random() * cols);
            
            for (let j = 0; j < cols; j++) {
                result[i][j] = j < crossoverPoint ? matrixA[i][j] : matrixB[i][j];
            }
        }
        
        return result;
    }
    
    clone() {
        const clone = new NeuralNetwork(
            this.inputNodes,
            this.hiddenNodes,
            this.outputNodes,
            this.activationFunction
        );
        
        clone.weightsIH = this.copyMatrix(this.weightsIH);
        clone.weightsHO = this.copyMatrix(this.weightsHO);
        clone.biasH = this.copyMatrix(this.biasH);
        clone.biasO = this.copyMatrix(this.biasO);
        
        return clone;
    }
    
    copyMatrix(matrix) {
        return matrix.map(row => [...row]);
    }
}

// Car class
class Car {
    constructor(x, y, angle, color, brain) {
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.speed = 0;
        this.maxSpeed = 5;
        this.acceleration = 0.2;
        this.friction = 0.05;
        this.turnSpeed = 0.03;
        this.width = 20;
        this.height = 40;
        this.color = color;
        this.brain = brain || new NeuralNetwork(7, 8, 2);
        this.fitness = 0;
        this.time = 0;
        this.distance = 0;
        this.checkpoints = [...track.checkpoints.map(c => ({ ...c, passed: false }))];
        this.crashed = false;
        this.completed = false;
        this.sensors = [];
    }
    
    update(track) {
        if (this.crashed || this.completed) return;
        
        this.time += 0.1;
        
        // Get sensor readings
        this.sensors = this.getSensorReadings(track);
        
        // Use neural network to decide actions
        const inputs = [
            this.sensors[0] / 100, // Forward
            this.sensors[1] / 100, // Left
            this.sensors[2] / 100, // Right
            this.sensors[3] / 100, // Forward-left
            this.sensors[4] / 100, // Forward-right
            this.speed / this.maxSpeed, // Normalized speed
            this.angle / (2 * Math.PI) // Normalized angle
        ];
        
        const outputs = this.brain.predict(inputs);
        
        // Control the car based on neural network output
        const acceleration = outputs[0] * 2 - 1; // Convert from 0-1 to -1-1
        const steering = outputs[1] * 2 - 1; // Convert from 0-1 to -1-1
        
        // Update speed
        this.speed += acceleration * this.acceleration;
        this.speed = Math.max(-this.maxSpeed/2, Math.min(this.maxSpeed, this.speed));
        
        // Apply friction
        this.speed *= (1 - this.friction);
        
        // Update angle based on steering
        if (Math.abs(this.speed) > 0.1) {
            this.angle += steering * this.turnSpeed * (this.speed / this.maxSpeed);
        }
        
        // Update position
        this.x += Math.sin(this.angle) * this.speed;
        this.y -= Math.cos(this.angle) * this.speed;
        
        // Calculate fitness based on distance to next checkpoint
        let nextCheckpointIndex = this.checkpoints.findIndex(c => !c.passed);
        if (nextCheckpointIndex === -1) nextCheckpointIndex = 0;
        
        const nextCheckpoint = this.checkpoints[nextCheckpointIndex];
        const dx = nextCheckpoint.x - this.x;
        const dy = nextCheckpoint.y - this.y;
        const distanceToNext = Math.sqrt(dx * dx + dy * dy);
        
        // Update fitness
        this.fitness = this.distance + (8 - nextCheckpointIndex) * 1000 - distanceToNext;
        
        // Check for checkpoint passing
        this.checkpoints.forEach((checkpoint, index) => {
            if (!checkpoint.passed) {
                const dx = checkpoint.x - this.x;
                const dy = checkpoint.y - this.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < 30) {
                    checkpoint.passed = true;
                    this.distance += 1000;
                }
            }
        });
        
        // Check for completion
        if (this.checkpoints.every(c => c.passed)) {
            this.completed = true;
            this.fitness += 10000; // Bonus for completing the track
            this.fitness -= this.time * 10; // Penalty for time taken
        }
        
        // Check for collision with track boundaries
        const leftSensor = this.sensors[1];
        const rightSensor = this.sensors[2];
        const frontSensor = this.sensors[0];
        
        if (leftSensor < 5 || rightSensor < 5 || frontSensor < 5) {
            this.crashed = true;
        }
    }
    
    getSensorReadings(track) {
        const sensorLength = 100;
        const sensors = [];
        
        // Forward sensor
        sensors.push(this.castRay(0, sensorLength, track));
        
        // Left sensor
        sensors.push(this.castRay(-Math.PI/2, sensorLength, track));
        
        // Right sensor
        sensors.push(this.castRay(Math.PI/2, sensorLength, track));
        
        // Forward-left sensor
        sensors.push(this.castRay(-Math.PI/4, sensorLength, track));
        
        // Forward-right sensor
        sensors.push(this.castRay(Math.PI/4, sensorLength, track));
        
        return sensors;
    }
    
    castRay(angleOffset, length, track) {
        const rayAngle = this.angle + angleOffset;
        let distance = 0;
        const stepSize = 2;
        
        while (distance < length) {
            const checkX = this.x + Math.sin(rayAngle) * distance;
            const checkY = this.y - Math.cos(rayAngle) * distance;
            
            // Check if out of bounds
            if (checkX < 0 || checkX > canvas.width || checkY < 0 || checkY > canvas.height) {
                break;
            }
            
            // Check if on track
            const trackCenter = { x: canvas.width/2, y: canvas.height/2 };
            const dx = checkX - trackCenter.x;
            const dy = checkY - trackCenter.y;
            const distFromCenter = Math.sqrt(dx*dx + dy*dy);
            
            // Simple circular track for collision detection
            if (distFromCenter < 150 || distFromCenter > 250) {
                break;
            }
            
            distance += stepSize;
        }
        
        return distance;
    }
    
    draw() {
        ctx.save();
        
        // Draw car shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(this.x - this.width/2 + 2, this.y - this.height/2 + 2, this.width, this.height);
        
        // Draw car
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.fillStyle = this.crashed ? '#ff4444' : this.color;
        ctx.fillRect(-this.width/2, -this.height/2, this.width, this.height);
        
        // Draw car outline
        ctx.strokeStyle = this.crashed ? '#ff0000' : '#ffffff';
        ctx.lineWidth = 1;
        ctx.strokeRect(-this.width/2, -this.height/2, this.width, this.height);
        
        // Draw car direction indicator
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-2, -this.height/2 - 5, 4, 10);
        
        ctx.restore();
        
        // Draw sensors
        if (!this.crashed && !this.completed) {
            this.sensors.forEach((sensor, index) => {
                const angles = [0, -Math.PI/2, Math.PI/2, -Math.PI/4, Math.PI/4];
                const sensorAngle = this.angle + angles[index];
                
                const endX = this.x + Math.sin(sensorAngle) * sensor;
                const endY = this.y - Math.cos(sensorAngle) * sensor;
                
                ctx.beginPath();
                ctx.moveTo(this.x, this.y);
                ctx.lineTo(endX, endY);
                ctx.strokeStyle = `rgba(255, 255, 255, ${0.1 + sensor/500})`;
                ctx.lineWidth = 1;
                ctx.stroke();
                
                // Sensor endpoint
                ctx.beginPath();
                ctx.arc(endX, endY, 3, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, 255, 255, ${0.3 + sensor/500})`;
                ctx.fill();
            });
        }
    }
}

// Game state
let cars = [];
let generation = 0;
let bestTime = Infinity;
let simulationSpeed = 1;
let populationSize = 50;
let isRunning = false;
let animationId = null;

// Initialize the simulation
function initSimulation() {
    cars = [];
    generation = 0;
    bestTime = Infinity;
    
    // Create initial population
    for (let i = 0; i < populationSize; i++) {
        const hue = (i * 360 / populationSize) % 360;
        const color = `hsl(${hue}, 80%, 60%)`;
        const car = new Car(
            track.startX,
            track.startY,
            track.startAngle,
            color,
            new NeuralNetwork(7, 8, 2)
        );
        cars.push(car);
    }
    
    updateUI();
}

function drawTrack() {
    // Clear canvas with gradient
    const gradient = ctx.createRadialGradient(canvas.width/2, canvas.height/2, 0, canvas.width/2, canvas.height/2, 250);
    gradient.addColorStop(0, '#1a1a2e');
    gradient.addColorStop(1, '#0a0a0a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw track
    ctx.strokeStyle = '#666';
    ctx.fillStyle = '#222';
    ctx.lineWidth = track.width;
    
    ctx.beginPath();
    ctx.arc(canvas.width/2, canvas.height/2, 200, 0, Math.PI * 2);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.arc(canvas.width/2, canvas.height/2, 200 - track.width/2, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw inner circle
    ctx.beginPath();
    ctx.arc(canvas.width/2, canvas.height/2, 200 - track.width, 0, Math.PI * 2);
    ctx.fillStyle = '#0a0a0a';
    ctx.fill();
    
    // Draw checkpoints
    track.checkpoints.forEach((checkpoint, index) => {
        ctx.beginPath();
        ctx.arc(checkpoint.x, checkpoint.y, 8, 0, Math.PI * 2);
        ctx.fillStyle = '#444';
        ctx.fill();
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Checkpoint number
        ctx.fillStyle = '#888';
        ctx.font = '12px Orbitron';
        ctx.textAlign = 'center';
        ctx.fillText((index + 1).toString(), checkpoint.x, checkpoint.y + 4);
    });
    
    // Draw start/finish line
    ctx.beginPath();
    ctx.moveTo(track.startX - 20, track.startY - 30);
    ctx.lineTo(track.startX + 20, track.startY - 30);
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 4;
    ctx.stroke();
    
    // Start text
    ctx.fillStyle = '#00ff88';
    ctx.font = '14px Orbitron';
    ctx.textAlign = 'center';
    ctx.fillText('START', track.startX, track.startY - 40);
}

function updateSimulation() {
    if (!isRunning) return;
    
    // Update cars multiple times based on simulation speed
    for (let i = 0; i < simulationSpeed; i++) {
        let allDone = true;
        
        cars.forEach(car => {
            if (!car.crashed && !car.completed) {
                car.update(track);
                allDone = false;
            }
        });
        
        if (allDone) {
            isRunning = false;
            nextGenBtn.disabled = false;
            break;
        }
    }
    
    // Update progress
    let totalProgress = 0;
    let completedCount = 0;
    cars.forEach(car => {
        if (car.completed) completedCount++;
        totalProgress += car.checkpoints.filter(c => c.passed).length;
    });
    
    const progress = (totalProgress / (cars.length * track.checkpoints.length)) * 100;
    progressFillEl.style.width = `${progress}%`;
    completionRateEl.textContent = `${Math.round(progress)}%`;
    
    // Update leaderboard
    updateLeaderboard();
    
    // Draw everything
    drawTrack();
    cars.forEach(car => car.draw());
    
    // Continue animation
    if (isRunning) {
        animationId = requestAnimationFrame(updateSimulation);
    }
}

function updateLeaderboard() {
    const sortedCars = [...cars].sort((a, b) => b.fitness - a.fitness);
    
    leaderboardListEl.innerHTML = '';
    for (let i = 0; i < Math.min(10, sortedCars.length); i++) {
        const car = sortedCars[i];
        const entry = document.createElement('div');
        entry.className = 'car-entry';
        
        const colorIndicator = document.createElement('div');
        colorIndicator.className = 'car-color';
        colorIndicator.style.backgroundColor = car.color;
        
        const status = car.completed ? '✅' : car.crashed ? '💥' : '🏁';
        
        entry.innerHTML = `
            <div>
                ${colorIndicator.outerHTML}
                <span>#${i + 1}</span>
            </div>
            <div>
                <span>${status} ${Math.round(car.fitness)}</span>
            </div>
        `;
        
        leaderboardListEl.appendChild(entry);
    }
}

function updateUI() {
    generationNumberEl.textContent = generation;
    if (bestTime !== Infinity) {
        bestTimeEl.textContent = `${bestTime.toFixed(2)}s`;
    } else {
        bestTimeEl.textContent = 'N/A';
    }
}

function nextGeneration() {
    nextGenBtn.disabled = true;
    
    // Sort cars by fitness
    cars.sort((a, b) => b.fitness - a.fitness);
    
    // Update best time if any car completed the track
    const completedCars = cars.filter(c => c.completed);
    if (completedCars.length > 0) {
        const fastest = completedCars.reduce((prev, curr) => 
            prev.time < curr.time ? prev : curr
        );
        if (fastest.time < bestTime) {
            bestTime = fastest.time;
        }
    }
    
    // Select top 5 performers
    const topPerformers = cars.slice(0, 5);
    
    // Create new population
    const newPopulation = [];
    
    // Keep the best performer (elitism)
    const bestClone = topPerformers[0].brain.clone();
    newPopulation.push(new Car(
        track.startX,
        track.startY,
        track.startAngle,
        topPerformers[0].color,
        bestClone
    ));
    
    // Generate offspring
    for (let i = 1; i < populationSize; i++) {
        // Select parents based on fitness
        const parentA = topPerformers[Math.floor(Math.random() * topPerformers.length)];
        const parentB = topPerformers[Math.floor(Math.random() * topPerformers.length)];
        
        // Create child through crossover and mutation
        const childBrain = NeuralNetwork.crossover(parentA.brain, parentB.brain);
        childBrain.mutate(0.1); // Mutation rate
        
        const hue = (i * 360 / populationSize) % 360;
        const color = `hsl(${hue}, 80%, 60%)`;
        
        newPopulation.push(new Car(
            track.startX,
            track.startY,
            track.startAngle,
            color,
            childBrain
        ));
    }
    
    cars = newPopulation;
    generation++;
    
    // Reset track checkpoints
    track.checkpoints.forEach(cp => cp.passed = false);
    
    updateUI();
    isRunning = true;
    nextGenBtn.disabled = false;
    updateSimulation();
}

// Event listeners
populationSlider.addEventListener('input', () => {
    populationSize = parseInt(populationSlider.value);
    populationValue.textContent = populationSize;
});

speedSlider.addEventListener('input', () => {
    simulationSpeed = parseInt(speedSlider.value);
    speedValue.textContent = `${simulationSpeed}x`;
});

startBtn.addEventListener('click', () => {
    initSimulation();
    isRunning = true;
    startBtn.disabled = true;
    nextGenBtn.disabled = false;
    cancelAnimationFrame(animationId);
    updateSimulation();
});

nextGenBtn.addEventListener('click', () => {
    if (isRunning) {
        isRunning = false;
        cancelAnimationFrame(animationId);
    }
    nextGeneration();
});

resetBtn.addEventListener('click', () => {
    isRunning = false;
    cancelAnimationFrame(animationId);
    initSimulation();
    startBtn.disabled = false;
    nextGenBtn.disabled = true;
    drawTrack();
});

// Initial setup
initSimulation();
drawTrack();
