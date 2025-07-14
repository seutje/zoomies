// Neural Network class
if (typeof module !== 'undefined' && module.exports) {
    globalThis.Matrix = require('./Matrix');
}
class NeuralNetwork {
    constructor(inputNodes, hiddenNodes, outputNodes) {
        this.inputNodes = inputNodes;
        this.hiddenNodes = hiddenNodes;
        this.outputNodes = outputNodes;
        
        // Initialize weights
        this.weights_ih = new globalThis.Matrix(this.hiddenNodes, this.inputNodes);
        this.weights_ho = new globalThis.Matrix(this.outputNodes, this.hiddenNodes);
        
        this.weights_ih.randomize();
        this.weights_ho.randomize();
        
        // Initialize biases
        this.bias_h = new globalThis.Matrix(this.hiddenNodes, 1);
        this.bias_o = new globalThis.Matrix(this.outputNodes, 1);
        
        this.bias_h.randomize();
        this.bias_o.randomize();
    }
    
    predict(inputArray) {
        // Input -> Hidden
        let inputs = globalThis.Matrix.fromArray(inputArray);
        let hidden = globalThis.Matrix.multiply(this.weights_ih, inputs);
        hidden.add(this.bias_h);
        hidden.map(sigmoid);
        
        // Hidden -> Output
        let outputs = globalThis.Matrix.multiply(this.weights_ho, hidden);
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
// Activation function
function sigmoid(x) {
    return 1 / (1 + Math.exp(-x));
}

if (typeof module !== 'undefined' && module.exports) { module.exports = { NeuralNetwork, sigmoid }; }
