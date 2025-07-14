// Car class
/* global track lapCount ctx */
if (typeof module !== 'undefined' && module.exports) {
    globalThis.NeuralNetwork = require('./NeuralNetwork').NeuralNetwork;
}
class Car {
    constructor(brain = null) {
        const cps = globalThis.checkpoints || [];
        this.x = cps.length ? cps[0].x : 100;
        this.y = cps.length ? cps[0].y : 250;
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
            this.brain = new globalThis.NeuralNetwork(5, 8, 4);
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
            if (this.framesSinceFitness >= 180) {
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
        const cps = globalThis.checkpoints || [];
        if (this.checkpointIndex >= cps.length) {
            this.lap++;
            if (this.lap >= lapCount) {
                this.finished = true;
                return;
            }
            this.checkpointIndex = 0;
        }

        const checkpoint = cps[this.checkpointIndex];
        const distance = Math.sqrt(
            Math.pow(this.x - checkpoint.x, 2) +
            Math.pow(this.y - checkpoint.y, 2)
        );
        
        if (distance < checkpoint.radius) {
            this.checkpointIndex++;
        }
    }
    
    calculateFitness() {
        const cps = globalThis.checkpoints || [];
        // Fitness based on checkpoints passed and laps completed
        this.fitness = (this.lap * cps.length + this.checkpointIndex) * 1000;

        // Add bonus for distance to next checkpoint
        if (this.checkpointIndex < cps.length) {
            const checkpoint = cps[this.checkpointIndex];
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

if (typeof module !== 'undefined' && module.exports) { module.exports = Car; }
