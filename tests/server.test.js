const http = require('http');
const server = require('../server');

let port;
let listener;

beforeAll(done => {
  listener = server.listen(0, () => {
    port = listener.address().port;
    done();
  });
});

afterAll(done => {
  listener.close(done);
});

test('serves index.html at root path', done => {
  http.get({ port, path: '/' }, res => {
    expect(res.statusCode).toBe(200);
    let data = '';
    res.on('data', chunk => (data += chunk));
    res.on('end', () => {
      expect(data).toContain('AI Racing Simulator');
      done();
    });
  });
});

test('returns 404 for missing file', done => {
  http.get({ port, path: '/nonexistent' }, res => {
    expect(res.statusCode).toBe(404);
    done();
  });
});
