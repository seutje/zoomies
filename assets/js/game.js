// Game canvas and context
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// Cat sprite used for cats
const catImg = new Image();
catImg.src = 'assets/images/cat.png';

// Lap completion sound
const lapAudio = typeof Audio !== 'undefined' ? new Audio('assets/audio/meow.mp3') : null;
if (lapAudio) lapAudio.volume = 0.5;
let lapSoundPending = false;

// UI elements
const populationSlider = document.getElementById('populationSlider');
const populationValue = document.getElementById('populationValue');
const speedSlider = document.getElementById('speedSlider');
const speedValue = document.getElementById('speedValue');
const lapSlider = document.getElementById('lapSlider');
const lapValue = document.getElementById('lapValue');
const hiddenSlider = document.getElementById('hiddenSlider');
const hiddenValue = document.getElementById('hiddenValue');
const mutationSlider = document.getElementById('mutationSlider');
const mutationValue = document.getElementById('mutationValue');
const nextGenBtn = document.getElementById('nextGenBtn');
const startStopBtn = document.getElementById('startStopBtn');
const resetBtn = document.getElementById('resetBtn');
const generationEl = document.getElementById('generation');
const bestFitnessEl = document.getElementById('bestFitness');
const catsRunningEl = document.getElementById('catsRunning');
const leaderboardList = document.getElementById('leaderboardList');
const trackSelect = document.getElementById('trackSelect');
const titleScreen = document.getElementById('titleScreen');
const accelMinus = document.getElementById('accelMinus');
const accelPlus = document.getElementById('accelPlus');
const accelBar = document.getElementById('accelBar');
const accelValue = document.getElementById('accelValue');
const steerMinus = document.getElementById('steerMinus');
const steerPlus = document.getElementById('steerPlus');
const steerBar = document.getElementById('steerBar');
const steerValue = document.getElementById('steerValue');
const speedMinus = document.getElementById('speedMinus');
const speedPlus = document.getElementById('speedPlus');
const speedBar = document.getElementById('speedBar');
const speedAttribValue = document.getElementById('speedAttribValue');

// Game parameters
let populationSize = 50;
let simulationSpeed = 1;
let lapCount = 5;
let hiddenNodes = 8;
let mutationRate = 0.1;
let generation = 1;
let cats = [];
let bestCats = [];
let bestOverallCats = [];
let bestFitnessOverall = 0;
let bestCatId = null;
let nextCatId = 1;
let track = [];
let checkpoints = [];
let outerPolygon = [];
let innerPolygon = [];
let outerBounds = { x: 50, y: 50, width: 700, height: 700, radius: 50 };
let innerBounds = { x: 150, y: 150, width: 500, height: 500, radius: 50 };
let isRunning = false;
let started = false;
const TOTAL_POINTS = 12;
const MAX_ATTR_POINTS = 10;
const attributePoints = {
    acceleration: 4,
    steering: 4,
    speed: 4
};

function totalAttr() {
    return attributePoints.acceleration + attributePoints.steering + attributePoints.speed;
}

function updateAttributeUI() {
    if (accelBar) accelBar.style.width = `${attributePoints.acceleration * 10}%`;
    if (accelValue) accelValue.textContent = attributePoints.acceleration;
    if (steerBar) steerBar.style.width = `${attributePoints.steering * 10}%`;
    if (steerValue) steerValue.textContent = attributePoints.steering;
    if (speedBar) speedBar.style.width = `${attributePoints.speed * 10}%`;
    if (speedAttribValue) speedAttribValue.textContent = attributePoints.speed;
}

updateAttributeUI();

function changeAttribute(attr, delta) {
    const newValue = attributePoints[attr] + delta;
    if (newValue < 0 || newValue > MAX_ATTR_POINTS) return;
    attributePoints[attr] = newValue;
    if (totalAttr() > TOTAL_POINTS) {
        attributePoints[attr] -= delta;
        return;
    }
    updateAttributeUI();
}

// Cat class
class Cat {
    constructor(brain = null, mutate = true) {
        this.x = checkpoints.length ? checkpoints[0].x : 100;
        this.y = checkpoints.length ? checkpoints[0].y : 400;
        this.width = 21;
        this.height = 25;
        if (checkpoints.length > 1) {
            const target = checkpoints[1];
            const start = checkpoints[0];
            this.angle = Math.atan2(target.y - start.y, target.x - start.x);
        } else {
            this.angle = Math.PI / 2; // fallback
        }
        this.speed = 0;
        this.maxSpeed = attributePoints.speed * 1.25;
        this.acceleration = attributePoints.acceleration * 0.05;
        this.friction = 0.05;
        this.turnSpeed = attributePoints.steering * 0.0075;
        this.fitness = 0;
        this.dead = false;
        this.finished = false;
        this.checkpointIndex = 0;
        this.lap = 0;
        this.time = 0;
        this.lastFitness = 0;
        this.framesSinceFitness = 0;
        this.hue = Math.random() * 360;
        this.color = `hsl(${this.hue}, 70%, 50%)`;
        this.id = nextCatId++;
        
        // Neural network
        if (brain) {
            this.brain = brain.copy();
            if (mutate) {
                this.brain.mutate(mutationRate);
            }
        } else {
            this.brain = new NeuralNetwork(7, hiddenNodes, 4);
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
        
        // Sensor readings (5 distance sensors + 2 checkpoint directions)
        this.readings = new Array(this.rays.length + 2).fill(0);
    }
    
    update() {
        if (this.dead || this.finished) return;
        
        this.time++;
        
        // Get sensor readings
        this.getReadings();
        
        // Neural network decision
        const inputs = this.readings;
        const outputs = this.brain.predict(inputs);
        
        // Control the cat
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
            // Apply extra friction when moving backwards
            this.speed += this.friction * 2;
            if (this.speed > 0) this.speed = 0;
        }
        
        // Limit speed
        if (this.speed > this.maxSpeed) this.speed = this.maxSpeed;
        if (this.speed < -this.maxSpeed / 2) this.speed = -this.maxSpeed / 2;
        
        // Move cat
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

        // Track best performer in real time
        if (this.fitness > bestFitnessOverall) {
            bestFitnessOverall = this.fitness;
            bestCatId = this.id;
            bestFitnessEl.textContent = `#${bestCatId} ${Math.round(bestFitnessOverall)}`;
        }

        // Track fitness progress
        if (this.fitness > this.lastFitness) {
            this.lastFitness = this.fitness;
            this.framesSinceFitness = 0;
        } else {
            this.framesSinceFitness++;
            if (this.framesSinceFitness >= 300) {
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

        // Direction to upcoming checkpoints normalized between -1 and 1
        if (checkpoints.length > 0) {
            const idxNext = this.checkpointIndex < checkpoints.length ? this.checkpointIndex : 0;
            const cpNext = checkpoints[idxNext];
            let angle = Math.atan2(cpNext.y - this.y, cpNext.x - this.x);
            let diff = angle - this.angle;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            this.readings[this.rays.length] = diff / Math.PI;

            if (checkpoints.length > 1) {
                const idxAfter = (idxNext + 1) % checkpoints.length;
                const cpAfter = checkpoints[idxAfter];
                angle = Math.atan2(cpAfter.y - this.y, cpAfter.x - this.x);
                diff = angle - this.angle;
                while (diff > Math.PI) diff -= Math.PI * 2;
                while (diff < -Math.PI) diff += Math.PI * 2;
                this.readings[this.rays.length + 1] = diff / Math.PI;
            } else {
                this.readings[this.rays.length + 1] = 0;
            }
        } else {
            this.readings[this.rays.length] = 0;
            this.readings[this.rays.length + 1] = 0;
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
        const center = { x: this.x, y: this.y };

        if (outerPolygon.length && innerPolygon.length) {
            const insideOuter = pointInPolygon(center, outerPolygon);
            const insideInner = pointInPolygon(center, innerPolygon);
            return !insideOuter || insideInner;
        }

        const outer = outerBounds;
        const inner = innerBounds;

        const insideOuter = pointInRoundedRect(center, outer);
        const insideInner = pointInRoundedRect(center, inner);

        return !insideOuter || insideInner;
    }
    
    checkCheckpoint() {
        if (this.checkpointIndex >= checkpoints.length) {
            this.lap++;
            if (lapAudio) lapSoundPending = true;
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
        
        // Draw the cat sprite
        if (catImg.complete) {
            ctx.drawImage(catImg, -this.width/2, -this.height/2, this.width, this.height);
        }
        
        ctx.restore();

        if (this.id === bestCatId) {
            ctx.save();
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.moveTo(this.x - 6, this.y - this.height / 2 - 12);
            ctx.lineTo(this.x + 6, this.y - this.height / 2 - 12);
            ctx.lineTo(this.x, this.y - this.height / 2 - 2);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }
        
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

            // Lines to the next two checkpoints
            if (checkpoints.length > 0) {
                const idxNext = this.checkpointIndex < checkpoints.length ? this.checkpointIndex : 0;
                const cpNext = checkpoints[idxNext];
                ctx.strokeStyle = 'rgba(255, 170, 0, 0.5)';
                ctx.beginPath();
                ctx.moveTo(this.x, this.y);
                ctx.lineTo(cpNext.x, cpNext.y);
                ctx.stroke();

                if (checkpoints.length > 1) {
                    const idxAfter = (idxNext + 1) % checkpoints.length;
                    const cpAfter = checkpoints[idxAfter];
                    ctx.strokeStyle = 'rgba(255, 170, 0, 0.3)';
                    ctx.beginPath();
                    ctx.moveTo(this.x, this.y);
                    ctx.lineTo(cpAfter.x, cpAfter.y);
                    ctx.stroke();
                }
            }
        }
    }
    
    adjustBrightness(color, amount) {
        const hsl = color.match(/\d+/g);
        return `hsl(${hsl[0]}, ${hsl[1]}%, ${Math.max(0, Math.min(100, parseInt(hsl[2]) + amount))}%)`;
    }
    
    copy() {
        const copy = new Cat(this.brain, false);
        copy.fitness = this.fitness;
        copy.id = this.id;
        return copy;
    }
}

function pointInRoundedRect(point, rect) {
    const { x, y, width, height, radius } = rect;

    if (point.x < x || point.x > x + width || point.y < y || point.y > y + height) {
        return false;
    }

    if (point.x >= x + radius && point.x <= x + width - radius) {
        return true;
    }

    if (point.y >= y + radius && point.y <= y + height - radius) {
        return true;
    }

    const corners = [
        { cx: x + radius, cy: y + radius },
        { cx: x + width - radius, cy: y + radius },
        { cx: x + radius, cy: y + height - radius },
        { cx: x + width - radius, cy: y + height - radius },
    ];

    return corners.some(c => (point.x - c.cx) ** 2 + (point.y - c.cy) ** 2 <= radius ** 2);
}

function pointInPolygon(point, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].x, yi = polygon[i].y;
        const xj = polygon[j].x, yj = polygon[j].y;
        const intersect = (yi > point.y) !== (yj > point.y) &&
            point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
        if (intersect) inside = !inside;
    }
    return inside;
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
async function loadTrack(name = 'square') {
    let data;
    if (name === 'editor') {
        const textarea = document.getElementById('trackData');
        try {
            data = textarea ? JSON.parse(textarea.value) : null;
        } catch (e) {
            console.error('Invalid track data');
            data = null;
        }
        if (!data) return;
    } else {
        const res = await fetch(`assets/tracks/${name}.json`);
        data = await res.json();
    }
    if (!Array.isArray(data.checkpoints) || data.checkpoints.length < 2) {
        console.error('Track must have at least 2 checkpoints');
        return false;
    }
    track = [];
    checkpoints = data.checkpoints;
    outerBounds = data.outerRect;
    innerBounds = data.innerRect;
    outerPolygon = [];
    innerPolygon = [];

    function cubic(p0, p1, p2, p3, t) {
        const u = 1 - t;
        const tt = t * t;
        const uu = u * u;
        const uuu = uu * u;
        const ttt = tt * t;

        const x = uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x;
        const y = uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y;
        return { x, y };
    }

    function addCurveSegments(segment, type) {
        const steps = 20;
        const p0 = { x: segment.start[0], y: segment.start[1] };
        const p1 = { x: segment.cp1[0], y: segment.cp1[1] };
        const p2 = { x: segment.cp2[0], y: segment.cp2[1] };
        const p3 = { x: segment.end[0], y: segment.end[1] };
        for (let i = 0; i < steps; i++) {
            const t1 = i / steps;
            const t2 = (i + 1) / steps;
            const pt1 = cubic(p0, p1, p2, p3, t1);
            const pt2 = cubic(p0, p1, p2, p3, t2);
            track.push({ x1: pt1.x, y1: pt1.y, x2: pt2.x, y2: pt2.y, type });

            const poly = type === 'outer' ? outerPolygon : innerPolygon;
            if (i === 0) poly.push(pt1);
            poly.push(pt2);
        }
    }

    data.curves.outer.forEach(seg => addCurveSegments(seg, 'outer'));
    data.curves.inner.forEach(seg => addCurveSegments(seg, 'inner'));
    return true;
}

// Draw the track
function drawTrack() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw track background with gradient
    const gradient = ctx.createRadialGradient(400, 400, 0, 400, 400, 350);
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

// Initialize cats
function initCats() {
    cats = [];

    if (bestCats.length > 0) {
        // Include top performer unchanged
        const elite = new Cat(bestCats[0].brain, false);
        elite.id = bestCats[0].id;
        elite.hue = bestCats[0].hue;
        elite.color = bestCats[0].color;
        cats.push(elite);

        // Create remaining cats from best performers
        for (let i = 1; i < populationSize; i++) {
            const parentIndex = (i - 1) % bestCats.length;
            const parent = bestCats[parentIndex];
            cats.push(new Cat(parent.brain));
        }
    } else {
        // Create random cats
        for (let i = 0; i < populationSize; i++) {
            cats.push(new Cat());
        }
    }
}

// Calculate the next generation
function nextGeneration() {
    // Sort cats by fitness
    cats.sort((a, b) => b.fitness - a.fitness);

    const currentBestFitness = cats[0].fitness;

    if (currentBestFitness > bestFitnessOverall || bestOverallCats.length === 0) {
        // Current generation has a new best performer
        bestFitnessOverall = currentBestFitness;
        bestCatId = cats[0].id;
        bestOverallCats = cats.slice(0, 5);
        bestCats = bestOverallCats;
    } else {
        // Use best overall performers if current gen is worse
        bestCats = bestOverallCats;
    }

    // Update UI
    generation++;
    generationEl.textContent = generation;
    bestFitnessEl.textContent = `#${bestCatId} ${Math.round(bestFitnessOverall)}`;
    
    // Create new generation
    initCats();
}

// Update the simulation
function update() {
    if (!isRunning) return;
    
    // Update cats multiple times based on simulation speed
    for (let s = 0; s < simulationSpeed; s++) {
        let activeCats = 0;
        
        for (const cat of cats) {
            cat.update();
            if (!cat.dead && !cat.finished) {
                activeCats++;
            }
        }

        if (lapSoundPending && lapAudio) {
            lapAudio.currentTime = 0;
            lapAudio.play();
            lapSoundPending = false;
        }

        catsRunningEl.textContent = activeCats;
        
        // Calculate track progress
        const maxProgress = Math.max(
            ...cats.map(c => c.lap * checkpoints.length + c.checkpointIndex)
        );
        const progress = (maxProgress / (checkpoints.length * lapCount)) * 100;
        document.getElementById('trackProgress').textContent = Math.round(progress) + '%';
        
        // Update leaderboard
        updateLeaderboard();
        
        if (activeCats === 0) {
            nextGeneration();
        }
    }
    
    // Draw everything
    drawTrack();
    
    for (const cat of cats) {
        cat.draw();
    }
    
    requestAnimationFrame(update);
}

// Update leaderboard
function updateLeaderboard() {
    const sortedCats = [...cats].sort((a, b) => b.fitness - a.fitness).slice(0, 10);

    if (sortedCats.length > 0) {
        bestCatId = sortedCats[0].id;
    }
    
    leaderboardList.innerHTML = '';
    sortedCats.forEach((cat, index) => {
        const item = document.createElement('div');
        item.className = 'leaderboard-item';
        
        let status = 'active';
        if (cat.dead) status = 'crashed';
        else if (cat.finished) status = 'finished';
        
        item.innerHTML = `
            <span><span class="rank">#${index + 1}</span> Cat ${cat.id}</span>
            <span class="fitness">${Math.round(cat.fitness)}</span>
            <span class="status ${status}">${status}</span>
        `;
        leaderboardList.appendChild(item);
    });
}

// Start the simulation
async function start() {
    const loaded = await loadTrack(trackSelect.value);
    if (!loaded) {
        return false;
    }
    initCats();
    isRunning = true;
    if (bestCatId) {
        bestFitnessEl.textContent = `#${bestCatId} ${Math.round(bestFitnessOverall)}`;
    } else {
        bestFitnessEl.textContent = Math.round(bestFitnessOverall);
    }
    update();
    return true;
}

async function resetSimulation() {
    isRunning = false;
    bestCats = [];
    bestOverallCats = [];
    bestFitnessOverall = 0;
    bestCatId = null;
    generation = 1;
    nextCatId = 1;
    generationEl.textContent = generation;
    bestFitnessEl.textContent = 0;
    if (titleScreen) titleScreen.style.display = 'none';
    const loaded = await start();
    if (loaded) {
        startStopBtn.textContent = 'Stop';
        started = true;
    } else {
        started = false;
    }
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

hiddenSlider.addEventListener('input', () => {
    hiddenNodes = parseInt(hiddenSlider.value);
    hiddenValue.textContent = hiddenNodes;
});

mutationSlider.addEventListener('input', () => {
    mutationRate = parseFloat(mutationSlider.value);
    mutationValue.textContent = mutationRate.toFixed(2);
});

if (accelPlus) accelPlus.addEventListener('click', () => changeAttribute('acceleration', 1));
if (accelMinus) accelMinus.addEventListener('click', () => changeAttribute('acceleration', -1));
if (steerPlus) steerPlus.addEventListener('click', () => changeAttribute('steering', 1));
if (steerMinus) steerMinus.addEventListener('click', () => changeAttribute('steering', -1));
if (speedPlus) speedPlus.addEventListener('click', () => changeAttribute('speed', 1));
if (speedMinus) speedMinus.addEventListener('click', () => changeAttribute('speed', -1));

nextGenBtn.addEventListener('click', () => {
    nextGeneration();
});

if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
        await resetSimulation();
    });
}

startStopBtn.addEventListener('click', async () => {
    if (!started) {
        if (titleScreen) titleScreen.style.display = 'none';
        const loaded = await start();
        if (loaded) {
            startStopBtn.textContent = 'Stop';
            started = true;
        }
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
    module.exports = { Cat, NeuralNetwork, Matrix, sigmoid };
}
