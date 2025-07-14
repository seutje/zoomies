/** @jest-environment jsdom */

beforeEach(() => {
  document.body.innerHTML = `
    <canvas id="canvas"></canvas>
    <input id="populationSlider">
    <span id="populationValue"></span>
    <input id="speedSlider">
    <span id="speedValue"></span>
    <input id="lapSlider">
    <span id="lapValue"></span>
    <button id="nextGenBtn"></button>
    <button id="startStopBtn"></button>
    <div id="generation"></div>
    <div id="bestFitness"></div>
    <div id="carsRunning"></div>
    <div id="leaderboardList"></div>
    <div id="trackProgress"></div>
  `;
  HTMLCanvasElement.prototype.getContext = jest.fn(() => ({}));
  jest.resetModules();
});

const loadGame = () => require('../assets/js/game.js');

test('Matrix fromArray and toArray round trip', () => {
  const { Matrix } = loadGame();
  const arr = [1, 2, 3];
  const m = Matrix.fromArray(arr);
  expect(m.rows).toBe(3);
  expect(m.cols).toBe(1);
  expect(m.toArray()).toEqual(arr);
});

test('Matrix multiply works correctly', () => {
  const { Matrix } = loadGame();
  const a = new Matrix(2, 2);
  a.data = [[1, 2], [3, 4]];
  const b = new Matrix(2, 2);
  b.data = [[5, 6], [7, 8]];
  const result = Matrix.multiply(a, b);
  expect(result.data).toEqual([[19, 22], [43, 50]]);
});

test('NeuralNetwork predict returns expected value', () => {
  const { NeuralNetwork } = loadGame();
  const nn = new NeuralNetwork(2, 2, 1);
  nn.weights_ih.data = [[1, 1], [1, 1]];
  nn.weights_ho.data = [[1, 1]];
  nn.bias_h.data = [[0], [0]];
  nn.bias_o.data = [[0]];
  const out = nn.predict([1, 1])[0];
  expect(out).toBeCloseTo(0.853, 2);
});

test('Car adjustBrightness adjusts value', () => {
  const { Car } = loadGame();
  const car = new Car();
  const color = 'hsl(200, 50%, 50%)';
  const adjusted = car.adjustBrightness(color, -30);
  expect(adjusted).toBe('hsl(200, 50%, 20%)');
});

test('Car isOffTrack detects boundaries', () => {
  const { Car } = loadGame();
  const car = new Car();
  car.x = 10;
  car.y = 10;
  expect(car.isOffTrack()).toBe(true);
  car.x = 100;
  car.y = 250;
  expect(car.isOffTrack()).toBe(false);
});

test('Car getIntersection returns intersection point', () => {
  const { Car } = loadGame();
  const car = new Car();
  const A = { x: 0, y: 0 };
  const B = { x: 10, y: 0 };
  const C = { x: 5, y: -5 };
  const D = { x: 5, y: 5 };
  const point = car.getIntersection(A, B, C, D);
  expect(point).toEqual({ x: 5, y: 0 });
  const no = car.getIntersection(A, B, { x: 20, y: 20 }, { x: 30, y: 30 });
  expect(no).toBeNull();
});
