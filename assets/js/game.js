// Game canvas and context
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

// Car class
class Car {
    constructor(brain = null) {
        this.x = checkpoints.length ? checkpoints[0].x : 100;
        this.y = checkpoints.length ? checkpoints[0].y : 250;
        this.width = 20;
        this.height = 10;
        this.angle = Math.PI / 2; // start facing downward
        this.speed = 0;
        this.maxSpeed = 5;
        this.acceleration = 0.2;
        this.friction = 0.05;
        this.turnSpeed = 0.03;
        this.fitness = 0;
        this.dead = false;
        this.finished = false;
        this.checkpointIndex = 0;
        this.lap = 0;
        this.time = 0;
        this.lastFitness = 0;
        this.framesSinceFitness = 0;
        this.color = `hsl(${Math.random() * 360}, 70%, 50%)`;
        
        // Neural network
        if (brain) {
            this.brain = brain.copy();
            this.brain.mutate(0.1);
        } else {
            this.brain = new NeuralNetwork(5, 8, 4);
        }
        
        // Ray casting for vision
        this.rays = [];
        this.rayLength = 100;
        this.raySpread = Math.PI / 2;
        
        for (let i = 0; i < 5; i++) {
            this.rays.push({
                angle: this.raySpread * (i / 4 - 0.5)
            });
        }
        
        // Sensor readings
        this.readings = new Array(this.rays.length).fill(0);
    }
    
    update() {
        if (this.dead || this.finished) return;
        
        this.time++;
        
        // Get sensor readings
        this.getReadings();
        
        // Neural network decision
        const inputs = this.readings;
        const outputs = this.brain.predict(inputs);
        
        // Control the car
        const forward = outputs[0] > 0.5;
        const left = outputs[1] > 0.5;
        const right = outputs[2] > 0.5;
        const brake = outputs[3] > 0.5;
        
        if (forward) this.speed += this.acceleration;
        if (brake) this.speed -= this.acceleration * 2;
        
        if (left) this.angle -= this.turnSpeed;
        if (right) this.angle += this.turnSpeed;
        
        // Apply friction
        if (this.speed > 0) {
            this.speed -= this.friction;
            if (this.speed < 0) this.speed = 0;
        } else if (this.speed < 0) {
            this.speed += this.friction;
            if (this.speed > 0) this.speed = 0;
        }
        
        // Limit speed
        if (this.speed > this.maxSpeed) this.speed = this.maxSpeed;
        if (this.speed < -this.maxSpeed / 2) this.speed = -this.maxSpeed / 2;
        
        // Move car
        this.x += Math.cos(this.angle) * this.speed;
        this.y += Math.sin(this.angle) * this.speed;
        
        // Check for collision with track boundaries
        if (this.isOffTrack()) {
            this.dead = true;
            return;
        }
        
        // Check for checkpoint
        this.checkCheckpoint();
        
        // Update fitness
        this.calculateFitness();

        // Track fitness progress
        if (this.fitness > this.lastFitness) {
            this.lastFitness = this.fitness;
            this.framesSinceFitness = 0;
        } else {
            this.framesSinceFitness++;
            if (this.framesSinceFitness >= 60 * simulationSpeed) {
                this.dead = true;
                return;
            }
        }
    }
    
    getReadings() {
        for (let i = 0; i < this.rays.length; i++) {
            const rayAngle = this.angle + this.rays[i].angle;
            const start = { x: this.x, y: this.y };
            const end = {
                x: this.x + Math.cos(rayAngle) * this.rayLength,
                y: this.y + Math.sin(rayAngle) * this.rayLength
            };
            
            // Check intersection with track boundaries
            let minDistance = this.rayLength;
            
            for (let j = 0; j < track.length; j++) {
                const intersection = this.getIntersection(
                    start, end, 
                    { x: track[j].x1, y: track[j].y1 }, 
                    { x: track[j].x2, y: track[j].y2 }
                );
                
                if (intersection) {
                    const distance = Math.sqrt(
                        Math.pow(intersection.x - start.x, 2) + 
                        Math.pow(intersection.y - start.y, 2)
                    );
                    if (distance < minDistance) {
                        minDistance = distance;
                    }
                }
            }
            
            this.readings[i] = 1 - (minDistance / this.rayLength);
        }
    }
    
    getIntersection(A, B, C, D) {
        const tTop = (D.x - C.x) * (A.y - C.y) - (D.y - C.y) * (A.x - C.x);
        const uTop = (C.y - A.y) * (A.x - B.x) - (C.x - A.x) * (A.y - B.y);
        const bottom = (D.y - C.y) * (B.x - A.x) - (D.x - C.x) * (B.y - A.y);
        
        if (bottom !== 0) {
            const t = tTop / bottom;
            const u = uTop / bottom;
            if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
                return {
                    x: A.x + t * (B.x - A.x),
                    y: A.y + t * (B.y - A.y)
                };
            }
        }
        
        return null;
    }
    
    isOffTrack() {
        // Check if car is inside the track
        // Create a point in the center of the car
        const center = { x: this.x, y: this.y };
        
        // Simple check: if the car is within the track width
        if (center.x < 50 || center.x > 750 || center.y < 50 || center.y > 450) {
            return true;
        }
        
        // Check if car is in the inner part of the oval
        const centerX = 400;
        const centerY = 250;
        const outerRx = 350;
        const outerRy = 200;
        const innerRx = 250;
        const innerRy = 150;
        
        const outerEllipse = Math.pow(center.x - centerX, 2) / Math.pow(outerRx, 2) + 
                            Math.pow(center.y - centerY, 2) / Math.pow(outerRy, 2);
                            
        const innerEllipse = Math.pow(center.x - centerX, 2) / Math.pow(innerRx, 2) + 
                            Math.pow(center.y - centerY, 2) / Math.pow(innerRy, 2);
        
        // If car is outside the outer ellipse or inside the inner ellipse
        return outerEllipse > 1 || innerEllipse < 1;
    }
    
    checkCheckpoint() {
        if (this.checkpointIndex >= checkpoints.length) {
            this.lap++;
            if (this.lap >= lapCount) {
                this.finished = true;
                return;
            }
            this.checkpointIndex = 0;
        }
        
        const checkpoint = checkpoints[this.checkpointIndex];
        const distance = Math.sqrt(
            Math.pow(this.x - checkpoint.x, 2) + 
            Math.pow(this.y - checkpoint.y, 2)
        );
        
        if (distance < checkpoint.radius) {
            this.checkpointIndex++;
        }
    }
    
    calculateFitness() {
        // Fitness based on checkpoints passed and laps completed
        this.fitness = (this.lap * checkpoints.length + this.checkpointIndex) * 1000;
        
        // Add bonus for distance to next checkpoint
        if (this.checkpointIndex < checkpoints.length) {
            const checkpoint = checkpoints[this.checkpointIndex];
            const distance = Math.sqrt(
                Math.pow(this.x - checkpoint.x, 2) + 
                Math.pow(this.y - checkpoint.y, 2)
            );
            this.fitness += Math.max(0, 1000 - distance);
        } else {
            // Bonus for finishing quickly
            this.fitness += 10000 - this.time;
        }
        
        // Penalty for time
        this.fitness -= this.time * 0.1;
    }
    
    draw() {
        if (this.dead) return;
        
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        
        // Car body with gradient
        const gradient = ctx.createLinearGradient(-this.width/2, 0, this.width/2, 0);
        gradient.addColorStop(0, this.color);
        gradient.addColorStop(1, this.adjustBrightness(this.color, -30));
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.rect(-this.width/2, -this.height/2, this.width, this.height);
        ctx.fill();
        
        // Car outline
        ctx.strokeStyle = this.adjustBrightness(this.color, 50);
        ctx.lineWidth = 1;
        ctx.stroke();
        
        // Car direction indicator
        ctx.fillStyle = this.adjustBrightness(this.color, 50);
        ctx.beginPath();
        ctx.rect(this.width/2 - 5, -this.height/4, 5, this.height/2);
        ctx.fill();
        
        ctx.restore();
        
        // Draw sensor rays
        if (!this.dead && !this.finished) {
            for (let i = 0; i < this.rays.length; i++) {
                const rayAngle = this.angle + this.rays[i].angle;
                const start = { x: this.x, y: this.y };
                const end = {
                    x: this.x + Math.cos(rayAngle) * this.rayLength * (1 - this.readings[i]),
                    y: this.y + Math.sin(rayAngle) * this.rayLength * (1 - this.readings[i])
                };
                
                ctx.strokeStyle = `rgba(0, 255, 136, ${0.3 - this.readings[i] * 0.3})`;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(start.x, start.y);
                ctx.lineTo(end.x, end.y);
                ctx.stroke();
            }
        }
    }
    
    adjustBrightness(color, amount) {
        const hsl = color.match(/\d+/g);
        return `hsl(${hsl[0]}, ${hsl[1]}%, ${Math.max(0, Math.min(100, parseInt(hsl[2]) + amount))}%)`;
    }
    
    copy() {
        const copy = new Car(this.brain);
        copy.fitness = this.fitness;
        return copy;
    }
}

// Neural Network class
class NeuralNetwork {
    constructor(inputNodes, hiddenNodes, outputNodes) {
        this.inputNodes = inputNodes;
        this.hiddenNodes = hiddenNodes;
        this.outputNodes = outputNodes;
        
        // Initialize weights
        this.weights_ih = new Matrix(this.hiddenNodes, this.inputNodes);
        this.weights_ho = new Matrix(this.outputNodes, this.hiddenNodes);
        
        this.weights_ih.randomize();
        this.weights_ho.randomize();
        
        // Initialize biases
        this.bias_h = new Matrix(this.hiddenNodes, 1);
        this.bias_o = new Matrix(this.outputNodes, 1);
        
        this.bias_h.randomize();
        this.bias_o.randomize();
    }
    
    predict(inputArray) {
        // Input -> Hidden
        let inputs = Matrix.fromArray(inputArray);
        let hidden = Matrix.multiply(this.weights_ih, inputs);
        hidden.add(this.bias_h);
        hidden.map(sigmoid);
        
        // Hidden -> Output
        let outputs = Matrix.multiply(this.weights_ho, hidden);
        outputs.add(this.bias_o);
        outputs.map(sigmoid);
        
        return outputs.toArray();
    }
    
    copy() {
        let result = new NeuralNetwork(this.inputNodes, this.hiddenNodes, this.outputNodes);
        result.weights_ih = this.weights_ih.copy();
        result.weights_ho = this.weights_ho.copy();
        result.bias_h = this.bias_h.copy();
        result.bias_o = this.bias_o.copy();
        return result;
    }
    
    mutate(rate) {
        function mutate(val) {
            if (Math.random() < rate) {
                return val + Math.random() * 0.4 - 0.2;
            }
            return val;
        }
        
        this.weights_ih.map(mutate);
        this.weights_ho.map(mutate);
        this.bias_h.map(mutate);
        this.bias_o.map(mutate);
    }
}

// Matrix class for neural network calculations
class Matrix {
    constructor(rows, cols) {
        this.rows = rows;
        this.cols = cols;
        this.data = [];
        
        for (let i = 0; i < this.rows; i++) {
            this.data[i] = [];
            for (let j = 0; j < this.cols; j++) {
                this.data[i][j] = 0;
            }
        }
    }
    
    static fromArray(arr) {
        let m = new Matrix(arr.length, 1);
        for (let i = 0; i < arr.length; i++) {
            m.data[i][0] = arr[i];
        }
        return m;
    }
    
    toArray() {
        let arr = [];
        for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.cols; j++) {
                arr.push(this.data[i][j]);
            }
        }
        return arr;
    }
    
    randomize() {
        for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.cols; j++) {
                this.data[i][j] = Math.random() * 2 - 1;
            }
        }
    }
    
    static multiply(a, b) {
        if (a.cols !== b.rows) {
            console.error("Columns of A must match rows of B");
            return undefined;
        }
        
        let result = new Matrix(a.rows, b.cols);
        
        for (let i = 0; i < result.rows; i++) {
            for (let j = 0; j < result.cols; j++) {
                let sum = 0;
                for (let k = 0; k < a.cols; k++) {
                    sum += a.data[i][k] * b.data[k][j];
                }
                result.data[i][j] = sum;
            }
        }
        
        return result;
    }
    
    add(n) {
        if (n instanceof Matrix) {
            for (let i = 0; i < this.rows; i++) {
                for (let j = 0; j < this.cols; j++) {
                    this.data[i][j] += n.data[i][j];
                }
            }
        } else {
            for (let i = 0; i < this.rows; i++) {
                for (let j = 0; j < this.cols; j++) {
                    this.data[i][j] += n;
                }
            }
        }
    }
    
    map(func) {
        for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.cols; j++) {
                this.data[i][j] = func(this.data[i][j]);
            }
        }
    }
    
    copy() {
        let result = new Matrix(this.rows, this.cols);
        for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.cols; j++) {
                result.data[i][j] = this.data[i][j];
            }
        }
        return result;
    }
}

// Activation function
function sigmoid(x) {
    return 1 / (1 + Math.exp(-x));
}

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
        
        checkpoints.push({ x, y, radius: 20 });
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
        const pulse = Math.sin(Date.now() * 0.005 + i) * 0.2 + 0.8;
        
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

// Start the simulation
start();
