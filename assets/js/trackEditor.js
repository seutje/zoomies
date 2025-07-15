const editorCanvas = document.getElementById('trackEditor');
if (editorCanvas) {
  const ctx = editorCanvas.getContext('2d');

  const shapes = { outer: [], inner: [] };
  let mode = 'outer';
  let currentPoint = null;
  let drawing = true;
  let lastDrawTime = 0;
  let dragging = null;
  let checkpointsEditor = [];
  let addCp = false;
  let removeCp = false;

  const toggleBtn = document.getElementById('toggleShapeBtn');
  const addBtn = document.getElementById('addCheckpointBtn');
  const removeBtn = document.getElementById('removeCheckpointBtn');
  const dataArea = document.getElementById('trackData');
  const copyBtn = document.getElementById('copyTrackBtn');
  const loadBtn = document.getElementById('loadTrackBtn');

  const formatSeg = seg => ({
    start: [seg.start.x, seg.start.y],
    cp1: [seg.cp1.x, seg.cp1.y],
    cp2: [seg.cp2.x, seg.cp2.y],
    end: [seg.end.x, seg.end.y]
  });

  const parseSeg = seg => ({
    start: { x: seg.start[0], y: seg.start[1] },
    cp1: { x: seg.cp1[0], y: seg.cp1[1] },
    cp2: { x: seg.cp2[0], y: seg.cp2[1] },
    end: { x: seg.end[0], y: seg.end[1] }
  });

  const rectFromSegs = segs => {
    if (segs.length === 0) return { x: 0, y: 0, width: 0, height: 0, radius: 0 };
    const xs = [];
    const ys = [];
    segs.forEach(s => {
      xs.push(s.start.x, s.cp1.x, s.cp2.x, s.end.x);
      ys.push(s.start.y, s.cp1.y, s.cp2.y, s.end.y);
    });
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY, radius: 0 };
  };

  const updateData = () => {
    const data = {
      curves: {
        outer: shapes.outer.map(formatSeg),
        inner: shapes.inner.map(formatSeg)
      },
      checkpoints: checkpointsEditor.map(c => ({ x: c.x, y: c.y, radius: 60 })),
      outerRect: rectFromSegs(shapes.outer),
      innerRect: rectFromSegs(shapes.inner)
    };
    if (dataArea) dataArea.value = JSON.stringify(data, null, 2);
  };

  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      if (dataArea) navigator.clipboard.writeText(dataArea.value);
    });
  }

  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  const getPos = evt => {
    const rect = editorCanvas.getBoundingClientRect();
    return { x: evt.clientX - rect.left, y: evt.clientY - rect.top };
  };

  const drawHandle = pt => {
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  };

  const draw = () => {
    ctx.clearRect(0, 0, editorCanvas.width, editorCanvas.height);

    ['outer', 'inner'].forEach(type => {
      const segs = shapes[type];
      ctx.strokeStyle = type === 'outer' ? '#00ff88' : '#00ffff';
      ctx.lineWidth = 2;
      segs.forEach(seg => {
        ctx.beginPath();
        ctx.moveTo(seg.start.x, seg.start.y);
        ctx.bezierCurveTo(seg.cp1.x, seg.cp1.y, seg.cp2.x, seg.cp2.y, seg.end.x, seg.end.y);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.beginPath();
        ctx.moveTo(seg.start.x, seg.start.y);
        ctx.lineTo(seg.cp1.x, seg.cp1.y);
        ctx.moveTo(seg.end.x, seg.end.y);
        ctx.lineTo(seg.cp2.x, seg.cp2.y);
        ctx.stroke();
        ctx.strokeStyle = type === 'outer' ? '#00ff88' : '#00ffff';
        drawHandle(seg.start);
        drawHandle(seg.end);
        drawHandle(seg.cp1);
        drawHandle(seg.cp2);
      });
    });

    checkpointsEditor.forEach(cp => {
      ctx.beginPath();
      ctx.arc(cp.x, cp.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#ff8800';
      ctx.fill();
    });
    requestAnimationFrame(draw);
  }
  updateData();
  draw();

  editorCanvas.addEventListener('mousedown', e => {
    const pos = getPos(e);

    if (addCp) {
      checkpointsEditor.push({ x: pos.x, y: pos.y });
      return;
    }
    if (removeCp) {
      checkpointsEditor = checkpointsEditor.filter(c => dist(c, pos) > 8);
      return;
    }

    if (!drawing) {
      const segs = shapes[mode];
      for (const seg of segs) {
        for (const type of ['start', 'cp1', 'cp2', 'end']) {
          if (dist(seg[type], pos) < 6) {
            dragging = { seg, type };
            return;
          }
        }
      }
    }

    if (drawing) {
      const now = Date.now();
      if (now - lastDrawTime < 200) return;
      lastDrawTime = now;
      if (!currentPoint) {
        currentPoint = { x: pos.x, y: pos.y };
      } else {
        const seg = {
          start: currentPoint,
          cp1: { ...currentPoint },
          cp2: { x: pos.x, y: pos.y },
          end: { x: pos.x, y: pos.y }
        };
        shapes[mode].push(seg);
        currentPoint = seg.end;
      }
    }
  });

  editorCanvas.addEventListener('mousemove', e => {
    if (dragging) {
      const pos = getPos(e);
      dragging.seg[dragging.type].x = pos.x;
      dragging.seg[dragging.type].y = pos.y;

      if (dragging.type === 'end') {
        const segs = shapes[mode];
        const idx = segs.indexOf(dragging.seg);
        if (idx !== -1 && segs.length > 0) {
          const nextSeg = segs[(idx + 1) % segs.length];
          nextSeg.start.x = pos.x;
          nextSeg.start.y = pos.y;
        }
      }
    }
  });

  window.addEventListener('mouseup', () => {
    dragging = null;
    updateData();
  });

  editorCanvas.addEventListener('dblclick', () => {
    drawing = false;
    currentPoint = null;
  });

  toggleBtn.addEventListener('click', () => {
    currentPoint = null;
    mode = mode === 'outer' ? 'inner' : 'outer';
    drawing = shapes[mode].length === 0;
    toggleBtn.textContent = `Editing ${mode}`;
  });

  addBtn.addEventListener('click', () => {
    addCp = !addCp;
    removeCp = false;
  });

  removeBtn.addEventListener('click', () => {
    removeCp = !removeCp;
    addCp = false;
  });

  if (loadBtn) {
    loadBtn.addEventListener('mousedown', () => {
      if (!dataArea) return;
      try {
        const data = JSON.parse(dataArea.value);
        shapes.outer = data.curves.outer.map(parseSeg);
        shapes.inner = data.curves.inner.map(parseSeg);
        checkpointsEditor = data.checkpoints.map(c => ({ x: c.x, y: c.y }));
        drawing = false;
        currentPoint = null;
        mode = 'outer';
        toggleBtn.textContent = 'Editing outer';
        draw();
      } catch {
        alert('Invalid track data');
      }
    });
  }
}
