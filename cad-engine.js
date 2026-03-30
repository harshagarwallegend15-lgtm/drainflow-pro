// ========================================
// CAD Engine — Advanced Drawing System
// ========================================

const CAD = {
    canvas: null,
    ctx: null,
    elements: [],
    undoStack: [],
    redoStack: [],
    currentTool: 'select',
    zoom: 1,
    panX: 0,
    panY: 0,
    gridSize: 20,
    snapToGrid: true,
    snapToNode: true,
    snapEnd: true,
    snapMid: true,
    snapInt: true,
    orthoMode: false,
    isDrawing: false,
    isDragging: false,
    isPanning: false,
    isMarquee: false,
    marqueeStart: null,
    marqueeEnd: null,
    drawStart: null,
    selectedElement: null,
    selectedElements: [],
    clipboard: [],
    dragOffset: null,
    tempPoints: [],
    mousePos: { x: 0, y: 0 },
    worldPos: { x: 0, y: 0 },
    layers: {
        pipes: { visible: true, color: '#00f5d4' },
        nodes: { visible: true, color: '#7b61ff' },
        annotations: { visible: true, color: '#f59e0b' },
        dimensions: { visible: true, color: '#ef4444' },
    },
    elementCounters: { pipe: 0, manhole: 0, catchpit: 0, outlet: 0, junction: 0, text: 0, rect: 0, polyline: 0, arc: 0, dimension: 0, label: 0 },
    lineColor: '#00f5d4',
    lineWidth: 2,
    lineStyle: 'solid',

    init() {
        this.canvas = document.getElementById('cadCanvas');
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        this.resize();
        this.bindEvents();
        this.render();
    },

    resize() {
        const wrapper = document.getElementById('cadCanvasWrapper');
        if (!wrapper) return;
        const rect = wrapper.getBoundingClientRect();
        this.canvas.width = rect.width * window.devicePixelRatio;
        this.canvas.height = rect.height * window.devicePixelRatio;
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
        this.ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
        this.render();
    },

    bindEvents() {
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.canvas.addEventListener('wheel', (e) => this.onWheel(e));
        this.canvas.addEventListener('dblclick', (e) => this.onDblClick(e));
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        window.addEventListener('resize', () => this.resize());
        document.addEventListener('keydown', (e) => this.onKeyDown(e));
    },

    screenToWorld(sx, sy) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (sx - rect.left - this.panX) / this.zoom;
        const y = (sy - rect.top - this.panY) / this.zoom;
        return { x, y };
    },

    worldToScreen(wx, wy) {
        return {
            x: wx * this.zoom + this.panX,
            y: wy * this.zoom + this.panY,
        };
    },

    snap(pos, excludeEl = null) {
        let bestDist = 15 / this.zoom;
        let bestSnap = null;
        
        for (const el of this.elements) {
            if (el === excludeEl) continue;
            
            if (this.snapToNode && ['manhole', 'catchpit', 'outlet', 'junction'].includes(el.type)) {
                const dist = Math.hypot(el.x - pos.x, el.y - pos.y);
                if (dist < bestDist) { bestDist = dist; bestSnap = { x: el.x, y: el.y, type: 'node' }; }
            }
            if (el.type === 'pipe' || el.type === 'dimension') {
                if (this.snapEnd) {
                    let d1 = Math.hypot(el.x - pos.x, el.y - pos.y);
                    let d2 = Math.hypot(el.x2 - pos.x, el.y2 - pos.y);
                    if (d1 < bestDist) { bestDist = d1; bestSnap = { x: el.x, y: el.y, type: 'end' }; }
                    if (d2 < bestDist) { bestDist = d2; bestSnap = { x: el.x2, y: el.y2, type: 'end' }; }
                }
                if (this.snapMid) {
                    let mx = (el.x + el.x2)/2, my = (el.y + el.y2)/2;
                    let dm = Math.hypot(mx - pos.x, my - pos.y);
                    if (dm < bestDist) { bestDist = dm; bestSnap = { x: mx, y: my, type: 'mid' }; }
                }
            }
        }
        
        if (bestSnap) return bestSnap;

        if (this.snapToGrid) {
            return {
                x: Math.round(pos.x / this.gridSize) * this.gridSize,
                y: Math.round(pos.y / this.gridSize) * this.gridSize,
                type: 'grid'
            };
        }
        return { x: pos.x, y: pos.y, type: 'none' };
    },

    onMouseDown(e) {
        const world = this.screenToWorld(e.clientX, e.clientY);
        const snapped = this.snap(world);

        if (e.button === 1 || (e.button === 0 && this.currentTool === 'pan')) {
            this.isPanning = true;
            this.panStart = { x: e.clientX - this.panX, y: e.clientY - this.panY };
            this.canvas.style.cursor = 'grabbing';
            return;
        }

        if (e.button === 0) {
            switch (this.currentTool) {
                case 'select':
                case 'move':
                    this.handleSelect(world);
                    break;
                case 'rotate':
                    this.handleRotate(world);
                    break;
                case 'pipe':
                    this.handlePipeStart(snapped);
                    break;
                case 'polyline':
                    this.handlePolylineClick(snapped);
                    break;
                case 'arc':
                    this.handleArcClick(snapped);
                    break;
                case 'rectangle':
                    this.handleRectStart(snapped);
                    break;
                case 'manhole':
                case 'catchpit':
                case 'outlet':
                case 'junction':
                    this.placeNode(this.currentTool, snapped);
                    break;
                case 'text':
                    this.placeText(snapped);
                    break;
                case 'dimension':
                    this.handleDimensionClick(snapped);
                    break;
                case 'label':
                    this.placeLabel(snapped);
                    break;
                case 'measure':
                    this.handleMeasureClick(snapped);
                    break;
                case 'angle':
                    this.handleAngleClick(snapped);
                    break;
            }
        }
    },

    onMouseMove(e) {
        const world = this.screenToWorld(e.clientX, e.clientY);
        let snapped = this.snap(world);
        this.mousePos = { x: e.clientX, y: e.clientY };
        this.worldPos = world;

        const coordsEl = document.getElementById('cadCoords');
        if (coordsEl) coordsEl.textContent = `(${Math.round(world.x)}, ${Math.round(world.y)})`;

        if (this.isPanning) {
            this.panX = e.clientX - this.panStart.x;
            this.panY = e.clientY - this.panStart.y;
            this.render();
            return;
        }

        if (this.isMarquee) {
            this.marqueeEnd = world;
            this.render();
            return;
        }

        const orthoActive = this.orthoMode || e.shiftKey;

        if (this.isDragging && this.selectedElement) {
            let dx = world.x - this.dragOffset.x - this.selectedElement.x;
            let dy = world.y - this.dragOffset.y - this.selectedElement.y;
            
            if (orthoActive) {
                if (Math.abs(dx) > Math.abs(dy)) { dy = 0; } else { dx = 0; }
            }

            this.selectedElements.forEach(el => {
                el.x += dx; el.y += dy;
                if (el.x2 !== undefined) { el.x2 += dx; el.y2 += dy; }
                if (el.points) el.points.forEach(p => { p.x += dx; p.y += dy; });
            });
            
            this.updateProperties();
            this.render();
            return;
        }

        if (this.isDrawing) {
            if (orthoActive && this.drawStart) {
                const ox = snapped.x - this.drawStart.x;
                const oy = snapped.y - this.drawStart.y;
                if (Math.abs(ox) > Math.abs(oy)) { snapped.y = this.drawStart.y; } else { snapped.x = this.drawStart.x; }
            }
            this.drawEnd = snapped;
            
            if (this.drawStart) {
                const len = Math.hypot(snapped.x - this.drawStart.x, snapped.y - this.drawStart.y);
                const ang = Math.atan2(snapped.y - this.drawStart.y, snapped.x - this.drawStart.x) * (180/Math.PI);
                const hud = document.getElementById('cadHud');
                if (hud) {
                    hud.style.display = 'flex';
                    hud.style.left = (e.clientX + 15) + 'px';
                    hud.style.top = (e.clientY + 15) + 'px';
                    document.getElementById('hudLen').textContent = len.toFixed(2);
                    document.getElementById('hudAng').textContent = Math.abs(ang).toFixed(1) + '°';
                }
            }
            this.render();
        } else {
            const hud = document.getElementById('cadHud');
            if (hud) hud.style.display = 'none';
        }
    },

    onMouseUp(e) {
        if (this.isPanning) {
            this.isPanning = false;
            this.canvas.style.cursor = this.currentTool === 'pan' ? 'grab' : 'crosshair';
            return;
        }

        if (this.isDragging) {
            this.isDragging = false;
            this.canvas.style.cursor = 'crosshair';
            return;
        }

        if (this.isMarquee) {
            this.isMarquee = false;
            const minX = Math.min(this.marqueeStart.x, this.marqueeEnd.x);
            const maxX = Math.max(this.marqueeStart.x, this.marqueeEnd.x);
            const minY = Math.min(this.marqueeStart.y, this.marqueeEnd.y);
            const maxY = Math.max(this.marqueeStart.y, this.marqueeEnd.y);
            const isCrossing = this.marqueeStart.x > this.marqueeEnd.x;
            
            this.selectedElements = [];
            for (const el of this.elements) {
                const b = this.getElementBounds(el);
                const elMinX = b.x, elMaxX = b.x + b.w, elMinY = b.y, elMaxY = b.y + b.h;
                
                if (isCrossing) {
                    if (elMinX <= maxX && elMaxX >= minX && elMinY <= maxY && elMaxY >= minY) {
                        this.selectedElements.push(el);
                    }
                } else {
                    if (elMinX >= minX && elMaxX <= maxX && elMinY >= minY && elMaxY <= maxY) {
                        this.selectedElements.push(el);
                    }
                }
            }
            if (this.selectedElements.length > 0) this.selectedElement = this.selectedElements[0];
            this.updateProperties();
            this.render();
            return;
        }

        if (this.isDrawing && this.currentTool === 'pipe') {
            const world = this.screenToWorld(e.clientX, e.clientY);
            const snapped = this.snap(world);
            this.finishPipe(snapped);
        }

        if (this.isDrawing && this.currentTool === 'rectangle') {
            const world = this.screenToWorld(e.clientX, e.clientY);
            const snapped = this.snap(world);
            this.finishRect(snapped);
        }
    },

    onWheel(e) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const rect = this.canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        this.panX = mx - (mx - this.panX) * delta;
        this.panY = my - (my - this.panY) * delta;
        this.zoom *= delta;
        this.zoom = Math.max(0.1, Math.min(10, this.zoom));

        document.getElementById('cadZoomLevel').textContent = Math.round(this.zoom * 100);
        this.render();
    },

    onDblClick(e) {
        if (this.currentTool === 'polyline' && this.tempPoints.length > 1) {
            this.finishPolyline();
        }
    },

    onKeyDown(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

        if (e.ctrlKey && e.key === 'z') { e.preventDefault(); this.undo(); }
        if (e.ctrlKey && e.key === 'y') { e.preventDefault(); this.redo(); }
        if (e.key === 'Delete' || e.key === 'Backspace') { this.deleteSelected(); }
        if (e.key === 'Escape') { this.cancelDrawing(); this.selectedElement = null; this.render(); }

        // Tool shortcuts
        const shortcuts = { v: 'select', h: 'pan', p: 'pipe', l: 'polyline', a: 'arc', r: 'rectangle', m: 'manhole', c: 'catchpit', o: 'outlet', j: 'junction', t: 'text', d: 'dimension', b: 'label' };
        if (shortcuts[e.key] && !e.ctrlKey && !e.altKey) {
            setCadTool(shortcuts[e.key]);
        }

        if (e.key === '+' || e.key === '=') this.zoomIn();
        if (e.key === '-') this.zoomOut();
    },

    // --- Drawing Tools ---
    
    handleRotate(world) {
        let target = null;
        for (let i = this.elements.length - 1; i >= 0; i--) {
            if (this.hitTest(this.elements[i], world)) { target = this.elements[i]; break; }
        }
        if (target) {
            this.undoStack.push(JSON.stringify(this.elements));
            this.redoStack = [];
            // Simple 90 deg rotation around center for pipes, rects
            const b = this.getElementBounds(target);
            const cx = b.x + b.w/2, cy = b.y + b.h/2;
            const rot = (x, y) => ({ x: cx - (y - cy), y: cy + (x - cx) });
            
            const p1 = rot(target.x, target.y);
            target.x = p1.x; target.y = p1.y;
            if (target.x2 !== undefined) {
                const p2 = rot(target.x2, target.y2);
                target.x2 = p2.x; target.y2 = p2.y;
            }
            if (target.points) {
                target.points = target.points.map(pt => rot(pt.x, pt.y));
            }
            this.render();
        }
    },

    handleSelect(world) {
        this.selectedElement = null;
        this.selectedElements = [];
        let hit = false;
        for (let i = this.elements.length - 1; i >= 0; i--) {
            const el = this.elements[i];
            if (this.hitTest(el, world)) {
                this.selectedElement = el;
                this.selectedElements = [el];
                hit = true;
                this.isDragging = true;
                this.dragOffset = { x: world.x - el.x, y: world.y - el.y };
                if (el.x2 !== undefined) {
                    el._w = el.x2 - el.x;
                    el._h = el.y2 - el.y;
                }
                break;
            }
        }
        
        if (!hit) {
            this.isMarquee = true;
            this.marqueeStart = world;
            this.marqueeEnd = world;
        }

        this.updateProperties();
        this.render();
    },

    hitTest(el, pos) {
        const threshold = 10 / this.zoom;
        switch (el.type) {
            case 'pipe':
            case 'dimension':
                return this.pointToLineDistance(pos, { x: el.x, y: el.y }, { x: el.x2, y: el.y2 }) < threshold;
            case 'manhole':
            case 'junction':
                return Math.hypot(pos.x - el.x, pos.y - el.y) < 12;
            case 'catchpit':
            case 'outlet':
                return Math.abs(pos.x - el.x) < 12 && Math.abs(pos.y - el.y) < 12;
            case 'rectangle':
                const minX = Math.min(el.x, el.x2), maxX = Math.max(el.x, el.x2);
                const minY = Math.min(el.y, el.y2), maxY = Math.max(el.y, el.y2);
                return pos.x >= minX - threshold && pos.x <= maxX + threshold && pos.y >= minY - threshold && pos.y <= maxY + threshold;
            case 'polyline':
            case 'arc':
                if (el.points) {
                    for (let i = 0; i < el.points.length - 1; i++) {
                        if (this.pointToLineDistance(pos, el.points[i], el.points[i + 1]) < threshold) return true;
                    }
                }
                return false;
            case 'text':
            case 'label':
                return Math.abs(pos.x - el.x) < 40 && Math.abs(pos.y - el.y) < 12;
            default:
                return Math.hypot(pos.x - el.x, pos.y - el.y) < threshold;
        }
    },

    pointToLineDistance(p, a, b) {
        const dx = b.x - a.x, dy = b.y - a.y;
        const len2 = dx * dx + dy * dy;
        if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
        let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
        t = Math.max(0, Math.min(1, t));
        return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
    },

    handlePipeStart(pos) {
        this.isDrawing = true;
        this.drawStart = pos;
    },

    finishPipe(pos) {
        if (!this.drawStart) return;
        const dist = Math.hypot(pos.x - this.drawStart.x, pos.y - this.drawStart.y);
        if (dist > 5) {
            this.elementCounters.pipe++;
            this.pushElement({
                type: 'pipe',
                x: this.drawStart.x, y: this.drawStart.y,
                x2: pos.x, y2: pos.y,
                layer: 'pipes',
                color: this.lineColor,
                width: this.lineWidth,
                style: this.lineStyle,
                name: `Pipe ${this.elementCounters.pipe}`,
            });
        }
        this.isDrawing = false;
        this.drawStart = null;
    },

    handlePolylineClick(pos) {
        this.tempPoints.push(pos);
        this.isDrawing = true;
        this.render();
    },

    finishPolyline() {
        if (this.tempPoints.length > 1) {
            this.elementCounters.polyline++;
            this.pushElement({
                type: 'polyline',
                x: this.tempPoints[0].x, y: this.tempPoints[0].y,
                points: [...this.tempPoints],
                layer: 'pipes',
                color: this.lineColor,
                width: this.lineWidth,
                style: this.lineStyle,
                name: `Polyline ${this.elementCounters.polyline}`,
            });
        }
        this.tempPoints = [];
        this.isDrawing = false;
    },

    handleArcClick(pos) {
        this.tempPoints.push(pos);
        if (this.tempPoints.length === 3) {
            this.elementCounters.arc++;
            const pts = this.generateArcPoints(this.tempPoints[0], this.tempPoints[1], this.tempPoints[2]);
            this.pushElement({
                type: 'arc',
                x: this.tempPoints[0].x, y: this.tempPoints[0].y,
                points: pts,
                layer: 'pipes',
                color: this.lineColor,
                width: this.lineWidth,
                style: this.lineStyle,
                name: `Arc ${this.elementCounters.arc}`,
            });
            this.tempPoints = [];
            this.isDrawing = false;
        } else {
            this.isDrawing = true;
        }
        this.render();
    },

    generateArcPoints(p1, p2, p3) {
        const pts = [];
        const segments = 24;
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const x = (1 - t) * (1 - t) * p1.x + 2 * (1 - t) * t * p2.x + t * t * p3.x;
            const y = (1 - t) * (1 - t) * p1.y + 2 * (1 - t) * t * p2.y + t * t * p3.y;
            pts.push({ x, y });
        }
        return pts;
    },

    handleRectStart(pos) {
        this.isDrawing = true;
        this.drawStart = pos;
    },

    finishRect(pos) {
        if (!this.drawStart) return;
        const w = Math.abs(pos.x - this.drawStart.x);
        const h = Math.abs(pos.y - this.drawStart.y);
        if (w > 5 || h > 5) {
            this.elementCounters.rect++;
            this.pushElement({
                type: 'rectangle',
                x: Math.min(this.drawStart.x, pos.x),
                y: Math.min(this.drawStart.y, pos.y),
                x2: Math.max(this.drawStart.x, pos.x),
                y2: Math.max(this.drawStart.y, pos.y),
                layer: 'annotations',
                color: this.lineColor,
                width: this.lineWidth,
                style: this.lineStyle,
                name: `Rect ${this.elementCounters.rect}`,
            });
        }
        this.isDrawing = false;
        this.drawStart = null;
    },

    placeNode(type, pos) {
        this.elementCounters[type]++;
        const colors = { manhole: '#7b61ff', catchpit: '#f59e0b', outlet: '#3b82f6', junction: '#ec4899' };
        this.pushElement({
            type,
            x: pos.x, y: pos.y,
            layer: 'nodes',
            color: colors[type] || '#7b61ff',
            name: `${type.charAt(0).toUpperCase() + type.slice(1)} ${this.elementCounters[type]}`,
        });
    },

    placeText(pos) {
        const text = prompt('Enter text:');
        if (text) {
            this.elementCounters.text++;
            this.pushElement({
                type: 'text',
                x: pos.x, y: pos.y,
                text: text,
                layer: 'annotations',
                color: '#f59e0b',
                name: `Text ${this.elementCounters.text}`,
            });
        }
    },

    placeLabel(pos) {
        const text = prompt('Enter label text:');
        if (text) {
            this.elementCounters.label++;
            this.pushElement({
                type: 'label',
                x: pos.x, y: pos.y,
                text: text,
                layer: 'annotations',
                color: '#f59e0b',
                name: `Label ${this.elementCounters.label}`,
            });
        }
    },

    handleDimensionClick(pos) {
        if (!this.drawStart) {
            this.drawStart = pos;
            this.isDrawing = true;
        } else {
            this.elementCounters.dimension++;
            const dist = Math.hypot(pos.x - this.drawStart.x, pos.y - this.drawStart.y);
            this.pushElement({
                type: 'dimension',
                x: this.drawStart.x, y: this.drawStart.y,
                x2: pos.x, y2: pos.y,
                distance: dist,
                layer: 'dimensions',
                color: '#ef4444',
                name: `Dim ${this.elementCounters.dimension}`,
            });
            this.drawStart = null;
            this.isDrawing = false;
        }
    },

    handleMeasureClick(pos) {
        if (!this.drawStart) {
            this.drawStart = pos;
            this.isDrawing = true;
        } else {
            const dist = Math.hypot(pos.x - this.drawStart.x, pos.y - this.drawStart.y);
            alert(`Distance: ${dist.toFixed(2)} units`);
            this.drawStart = null;
            this.isDrawing = false;
            this.render();
        }
    },

    handleAngleClick(pos) {
        this.tempPoints.push(pos);
        if (this.tempPoints.length === 3) {
            const [a, vertex, c] = this.tempPoints;
            const angle1 = Math.atan2(a.y - vertex.y, a.x - vertex.x);
            const angle2 = Math.atan2(c.y - vertex.y, c.x - vertex.x);
            let angle = Math.abs(angle2 - angle1) * (180 / Math.PI);
            if (angle > 180) angle = 360 - angle;
            alert(`Angle: ${angle.toFixed(1)}°`);
            this.tempPoints = [];
            this.isDrawing = false;
            this.render();
        } else {
            this.isDrawing = true;
        }
    },

    cancelDrawing() {
        this.isDrawing = false;
        this.drawStart = null;
        this.tempPoints = [];
    },

    // --- Element Management ---

    pushElement(el) {
        this.undoStack.push(JSON.stringify(this.elements));
        this.redoStack = [];
        this.elements.push(el);
        this.updateCount();
        this.render();
    },

    deleteSelected() {
        if (this.selectedElement) {
            this.undoStack.push(JSON.stringify(this.elements));
            this.redoStack = [];
            this.elements = this.elements.filter(e => e !== this.selectedElement);
            this.selectedElement = null;
            this.updateCount();
            this.updateProperties();
            this.render();
        }
    },

    undo() {
        if (this.undoStack.length > 0) {
            this.redoStack.push(JSON.stringify(this.elements));
            this.elements = JSON.parse(this.undoStack.pop());
            this.selectedElement = null;
            this.updateCount();
            this.updateProperties();
            this.render();
        }
    },

    redo() {
        if (this.redoStack.length > 0) {
            this.undoStack.push(JSON.stringify(this.elements));
            this.elements = JSON.parse(this.redoStack.pop());
            this.selectedElement = null;
            this.updateCount();
            this.updateProperties();
            this.render();
        }
    },

    clearAll() {
        if (this.elements.length === 0) return;
        if (confirm('Clear all elements?')) {
            this.undoStack.push(JSON.stringify(this.elements));
            this.redoStack = [];
            this.elements = [];
            this.selectedElement = null;
            this.selectedElements = [];
            this.updateCount();
            this.updateProperties();
            this.render();
        }
    },
    
    copy() {
        if (this.selectedElements.length > 0) {
            this.clipboard = JSON.parse(JSON.stringify(this.selectedElements));
        }
    },

    paste() {
        if (!this.clipboard || this.clipboard.length === 0) return;
        this.undoStack.push(JSON.stringify(this.elements));
        this.redoStack = [];
        const newEls = [];
        this.clipboard.forEach(el => {
            const copy = JSON.parse(JSON.stringify(el));
            const offset = 20 / this.zoom;
            copy.x += offset; if (copy.x2 !== undefined) copy.x2 += offset;
            copy.y += offset; if (copy.y2 !== undefined) copy.y2 += offset;
            if (copy.points) copy.points.forEach(p => { p.x += offset; p.y += offset; });
            this.elements.push(copy);
            newEls.push(copy);
        });
        this.selectedElements = newEls;
        this.selectedElement = newEls[0];
        this.updateCount();
        this.updateProperties();
        this.render();
    },

    duplicate() {
        this.copy();
        this.paste();
    },

    updateCount() {
        const el = document.getElementById('cadElementCount');
        if (el) el.textContent = this.elements.length;
        const vc = document.getElementById('viewer3dCount');
        if (vc) vc.textContent = this.elements.length;
    },

    updateProperties() {
        const propType = document.getElementById('propType');
        const propX = document.getElementById('propX');
        const propY = document.getElementById('propY');
        if (!propType) return;

        if (this.selectedElement) {
            propType.textContent = this.selectedElement.name || this.selectedElement.type;
            propX.value = Math.round(this.selectedElement.x);
            propY.value = Math.round(this.selectedElement.y);
            propX.disabled = false;
            propY.disabled = false;
        } else {
            propType.textContent = 'None selected';
            propX.value = '';
            propY.value = '';
            propX.disabled = true;
            propY.disabled = true;
        }
    },

    // --- Zoom ---
    zoomIn() {
        this.zoom *= 1.2;
        this.zoom = Math.min(10, this.zoom);
        document.getElementById('cadZoomLevel').textContent = Math.round(this.zoom * 100);
        this.render();
    },

    zoomOut() {
        this.zoom *= 0.8;
        this.zoom = Math.max(0.1, this.zoom);
        document.getElementById('cadZoomLevel').textContent = Math.round(this.zoom * 100);
        this.render();
    },

    resetView() {
        this.zoom = 1;
        this.panX = 0;
        this.panY = 0;
        document.getElementById('cadZoomLevel').textContent = '100';
        this.render();
    },

    // --- Render ---

    render() {
        const ctx = this.ctx;
        if (!ctx) return;
        const w = this.canvas.width / window.devicePixelRatio;
        const h = this.canvas.height / window.devicePixelRatio;

        ctx.clearRect(0, 0, w, h);

        ctx.save();
        ctx.translate(this.panX, this.panY);
        ctx.scale(this.zoom, this.zoom);

        // Draw grid
        this.drawGrid(w, h);

        // Draw elements
        for (const el of this.elements) {
            if (!this.layers[el.layer]?.visible) continue;
            const isSelected = this.selectedElements.includes(el) || el === this.selectedElement;
            this.drawElement(el, isSelected);
        }

        // Draw selection marquee
        if (this.isMarquee && this.marqueeStart && this.marqueeEnd) {
            ctx.setLineDash([4 / this.zoom, 4 / this.zoom]);
            ctx.lineWidth = 1 / this.zoom;
            const w = this.marqueeEnd.x - this.marqueeStart.x;
            const h = this.marqueeEnd.y - this.marqueeStart.y;
            if (w < 0) {
                // Crossing (Green)
                ctx.strokeStyle = '#22c55e';
                ctx.fillStyle = 'rgba(34, 197, 94, 0.1)';
            } else {
                // Window (Blue)
                ctx.strokeStyle = '#3b82f6';
                ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
            }
            ctx.fillRect(this.marqueeStart.x, this.marqueeStart.y, w, h);
            ctx.strokeRect(this.marqueeStart.x, this.marqueeStart.y, w, h);
            ctx.setLineDash([]);
        }

        // Draw temp drawing
        if (this.isDrawing) {
            this.drawTemp();
        }

        ctx.restore();
    },

    drawGrid(w, h) {
        const ctx = this.ctx;
        const gs = this.gridSize;
        const startX = Math.floor(-this.panX / this.zoom / gs) * gs;
        const startY = Math.floor(-this.panY / this.zoom / gs) * gs;
        const endX = startX + w / this.zoom + gs * 2;
        const endY = startY + h / this.zoom + gs * 2;

        ctx.strokeStyle = 'rgba(0,245,212,0.04)';
        ctx.lineWidth = 0.5 / this.zoom;

        ctx.beginPath();
        for (let x = startX; x < endX; x += gs) {
            ctx.moveTo(x, startY);
            ctx.lineTo(x, endY);
        }
        for (let y = startY; y < endY; y += gs) {
            ctx.moveTo(startX, y);
            ctx.lineTo(endX, y);
        }
        ctx.stroke();

        // Major grid
        ctx.strokeStyle = 'rgba(0,245,212,0.08)';
        ctx.lineWidth = 1 / this.zoom;
        ctx.beginPath();
        for (let x = startX; x < endX; x += gs * 5) {
            ctx.moveTo(x, startY);
            ctx.lineTo(x, endY);
        }
        for (let y = startY; y < endY; y += gs * 5) {
            ctx.moveTo(startX, y);
            ctx.lineTo(endX, y);
        }
        ctx.stroke();
    },

    setLineStyle(ctx, style, width) {
        ctx.lineWidth = width / this.zoom;
        if (style === 'dashed') {
            ctx.setLineDash([8 / this.zoom, 4 / this.zoom]);
        } else if (style === 'dotted') {
            ctx.setLineDash([2 / this.zoom, 4 / this.zoom]);
        } else {
            ctx.setLineDash([]);
        }
    },

    drawElement(el, selected) {
        const ctx = this.ctx;
        ctx.save();

        if (selected) {
            ctx.shadowColor = '#00f5d4';
            ctx.shadowBlur = 12 / this.zoom;
        }

        switch (el.type) {
            case 'pipe':
                this.setLineStyle(ctx, el.style || 'solid', el.width || 2);
                ctx.strokeStyle = el.color || '#00f5d4';
                ctx.beginPath();
                ctx.moveTo(el.x, el.y);
                ctx.lineTo(el.x2, el.y2);
                ctx.stroke();
                ctx.setLineDash([]);
                // End dots
                ctx.fillStyle = el.color || '#00f5d4';
                ctx.beginPath();
                ctx.arc(el.x, el.y, 3 / this.zoom, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(el.x2, el.y2, 3 / this.zoom, 0, Math.PI * 2);
                ctx.fill();
                // Label
                ctx.fillStyle = 'rgba(232,234,237,0.5)';
                ctx.font = `${10 / this.zoom}px Inter`;
                ctx.textAlign = 'center';
                ctx.fillText(el.name, (el.x + el.x2) / 2, (el.y + el.y2) / 2 - 8 / this.zoom);
                break;

            case 'polyline':
                if (el.points && el.points.length > 1) {
                    this.setLineStyle(ctx, el.style || 'solid', el.width || 2);
                    ctx.strokeStyle = el.color || '#00f5d4';
                    ctx.beginPath();
                    ctx.moveTo(el.points[0].x, el.points[0].y);
                    for (let i = 1; i < el.points.length; i++) {
                        ctx.lineTo(el.points[i].x, el.points[i].y);
                    }
                    ctx.stroke();
                    ctx.setLineDash([]);
                }
                break;

            case 'arc':
                if (el.points && el.points.length > 1) {
                    this.setLineStyle(ctx, el.style || 'solid', el.width || 2);
                    ctx.strokeStyle = el.color || '#00f5d4';
                    ctx.beginPath();
                    ctx.moveTo(el.points[0].x, el.points[0].y);
                    for (let i = 1; i < el.points.length; i++) {
                        ctx.lineTo(el.points[i].x, el.points[i].y);
                    }
                    ctx.stroke();
                    ctx.setLineDash([]);
                }
                break;

            case 'rectangle':
                this.setLineStyle(ctx, el.style || 'solid', el.width || 2);
                ctx.strokeStyle = el.color || '#00f5d4';
                ctx.strokeRect(el.x, el.y, el.x2 - el.x, el.y2 - el.y);
                ctx.setLineDash([]);
                break;

            case 'manhole':
                ctx.fillStyle = el.color || '#7b61ff';
                ctx.beginPath();
                ctx.arc(el.x, el.y, 10, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = 'rgba(255,255,255,0.3)';
                ctx.lineWidth = 1.5 / this.zoom;
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(el.x, el.y, 4, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255,255,255,0.3)';
                ctx.fill();
                ctx.fillStyle = 'rgba(232,234,237,0.7)';
                ctx.font = `${10 / this.zoom}px Inter`;
                ctx.textAlign = 'center';
                ctx.fillText(el.name, el.x, el.y + 20 / this.zoom);
                break;

            case 'catchpit':
                ctx.fillStyle = el.color || '#f59e0b';
                ctx.fillRect(el.x - 10, el.y - 10, 20, 20);
                ctx.strokeStyle = 'rgba(255,255,255,0.3)';
                ctx.lineWidth = 1.5 / this.zoom;
                ctx.strokeRect(el.x - 10, el.y - 10, 20, 20);
                ctx.fillRect(el.x - 5, el.y - 5, 10, 10);
                ctx.fillStyle = 'rgba(232,234,237,0.7)';
                ctx.font = `${10 / this.zoom}px Inter`;
                ctx.textAlign = 'center';
                ctx.fillText(el.name, el.x, el.y + 22 / this.zoom);
                break;

            case 'outlet':
                ctx.fillStyle = el.color || '#3b82f6';
                ctx.fillRect(el.x - 12, el.y - 8, 24, 16);
                ctx.strokeStyle = 'rgba(255,255,255,0.3)';
                ctx.lineWidth = 1.5 / this.zoom;
                ctx.strokeRect(el.x - 12, el.y - 8, 24, 16);
                ctx.beginPath();
                ctx.moveTo(el.x, el.y - 8);
                ctx.lineTo(el.x, el.y + 8);
                ctx.moveTo(el.x - 12, el.y);
                ctx.lineTo(el.x + 12, el.y);
                ctx.strokeStyle = 'rgba(255,255,255,0.2)';
                ctx.stroke();
                ctx.fillStyle = 'rgba(232,234,237,0.7)';
                ctx.font = `${10 / this.zoom}px Inter`;
                ctx.textAlign = 'center';
                ctx.fillText(el.name, el.x, el.y + 22 / this.zoom);
                break;

            case 'junction':
                ctx.fillStyle = el.color || '#ec4899';
                ctx.beginPath();
                ctx.arc(el.x, el.y, 8, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = 'rgba(255,255,255,0.3)';
                ctx.lineWidth = 1.5 / this.zoom;
                ctx.stroke();
                // Cross lines
                ctx.beginPath();
                ctx.moveTo(el.x, el.y - 14);
                ctx.lineTo(el.x, el.y + 14);
                ctx.moveTo(el.x - 14, el.y);
                ctx.lineTo(el.x + 14, el.y);
                ctx.strokeStyle = 'rgba(236,72,153,0.4)';
                ctx.lineWidth = 1 / this.zoom;
                ctx.stroke();
                ctx.fillStyle = 'rgba(232,234,237,0.7)';
                ctx.font = `${10 / this.zoom}px Inter`;
                ctx.textAlign = 'center';
                ctx.fillText(el.name, el.x, el.y + 22 / this.zoom);
                break;

            case 'text':
                ctx.fillStyle = el.color || '#f59e0b';
                ctx.font = `${14 / this.zoom}px Inter`;
                ctx.textAlign = 'left';
                ctx.fillText(el.text, el.x, el.y);
                break;

            case 'label':
                ctx.fillStyle = 'rgba(245,158,11,0.15)';
                const tm = ctx.measureText ? ctx.measureText(el.text || 'Label') : { width: 60 };
                ctx.font = `${12 / this.zoom}px Inter`;
                const tw = ctx.measureText(el.text || 'Label').width;
                ctx.fillRect(el.x - 4 / this.zoom, el.y - 14 / this.zoom, tw + 8 / this.zoom, 18 / this.zoom);
                ctx.fillStyle = '#f59e0b';
                ctx.fillText(el.text || 'Label', el.x, el.y);
                break;

            case 'dimension':
                ctx.strokeStyle = el.color || '#ef4444';
                ctx.lineWidth = 1.5 / this.zoom;
                ctx.setLineDash([]);
                // Main line
                ctx.beginPath();
                ctx.moveTo(el.x, el.y);
                ctx.lineTo(el.x2, el.y2);
                ctx.stroke();
                // End ticks
                const angle = Math.atan2(el.y2 - el.y, el.x2 - el.x);
                const perpAngle = angle + Math.PI / 2;
                const tickLen = 8 / this.zoom;
                for (const pt of [{ x: el.x, y: el.y }, { x: el.x2, y: el.y2 }]) {
                    ctx.beginPath();
                    ctx.moveTo(pt.x + Math.cos(perpAngle) * tickLen, pt.y + Math.sin(perpAngle) * tickLen);
                    ctx.lineTo(pt.x - Math.cos(perpAngle) * tickLen, pt.y - Math.sin(perpAngle) * tickLen);
                    ctx.stroke();
                }
                // Distance label
                const dist = el.distance || Math.hypot(el.x2 - el.x, el.y2 - el.y);
                ctx.fillStyle = '#ef4444';
                ctx.font = `bold ${10 / this.zoom}px Inter`;
                ctx.textAlign = 'center';
                ctx.fillText(`${dist.toFixed(1)}`, (el.x + el.x2) / 2, (el.y + el.y2) / 2 - 8 / this.zoom);
                break;
        }

        // Selection box
        if (selected) {
            ctx.strokeStyle = '#00f5d4';
            ctx.lineWidth = 1.5 / this.zoom;
            ctx.setLineDash([4 / this.zoom, 4 / this.zoom]);
            const bounds = this.getElementBounds(el);
            const pad = 6 / this.zoom;
            ctx.strokeRect(bounds.x - pad, bounds.y - pad, bounds.w + pad * 2, bounds.h + pad * 2);
            ctx.setLineDash([]);
        }

        ctx.restore();
    },

    getElementBounds(el) {
        switch (el.type) {
            case 'pipe':
            case 'dimension':
                return { x: Math.min(el.x, el.x2), y: Math.min(el.y, el.y2), w: Math.abs(el.x2 - el.x), h: Math.abs(el.y2 - el.y) };
            case 'rectangle':
                return { x: el.x, y: el.y, w: el.x2 - el.x, h: el.y2 - el.y };
            case 'manhole':
            case 'junction':
                return { x: el.x - 10, y: el.y - 10, w: 20, h: 20 };
            case 'catchpit':
            case 'outlet':
                return { x: el.x - 12, y: el.y - 12, w: 24, h: 24 };
            default:
                return { x: el.x - 20, y: el.y - 10, w: 40, h: 20 };
        }
    },

    drawTemp() {
        const ctx = this.ctx;
        if (this.currentTool === 'pipe' && this.drawStart && this.drawEnd) {
            ctx.strokeStyle = 'rgba(0,245,212,0.5)';
            ctx.lineWidth = 2 / this.zoom;
            ctx.setLineDash([6 / this.zoom, 4 / this.zoom]);
            ctx.beginPath();
            ctx.moveTo(this.drawStart.x, this.drawStart.y);
            ctx.lineTo(this.drawEnd.x, this.drawEnd.y);
            ctx.stroke();
            ctx.setLineDash([]);
            // Distance preview
            const dist = Math.hypot(this.drawEnd.x - this.drawStart.x, this.drawEnd.y - this.drawStart.y);
            ctx.fillStyle = 'rgba(0,245,212,0.7)';
            ctx.font = `${11 / this.zoom}px Inter`;
            ctx.textAlign = 'center';
            ctx.fillText(`${dist.toFixed(1)}`, (this.drawStart.x + this.drawEnd.x) / 2, (this.drawStart.y + this.drawEnd.y) / 2 - 10 / this.zoom);
        }

        if (this.currentTool === 'rectangle' && this.drawStart && this.drawEnd) {
            ctx.strokeStyle = 'rgba(0,245,212,0.5)';
            ctx.lineWidth = 2 / this.zoom;
            ctx.setLineDash([6 / this.zoom, 4 / this.zoom]);
            ctx.strokeRect(this.drawStart.x, this.drawStart.y, this.drawEnd.x - this.drawStart.x, this.drawEnd.y - this.drawStart.y);
            ctx.setLineDash([]);
        }

        if (this.currentTool === 'dimension' && this.drawStart && this.drawEnd) {
            ctx.strokeStyle = 'rgba(239,68,68,0.5)';
            ctx.lineWidth = 1.5 / this.zoom;
            ctx.setLineDash([4 / this.zoom, 4 / this.zoom]);
            ctx.beginPath();
            ctx.moveTo(this.drawStart.x, this.drawStart.y);
            ctx.lineTo(this.drawEnd.x, this.drawEnd.y);
            ctx.stroke();
            ctx.setLineDash([]);
            const dist = Math.hypot(this.drawEnd.x - this.drawStart.x, this.drawEnd.y - this.drawStart.y);
            ctx.fillStyle = 'rgba(239,68,68,0.7)';
            ctx.font = `${11 / this.zoom}px Inter`;
            ctx.textAlign = 'center';
            ctx.fillText(`${dist.toFixed(1)}`, (this.drawStart.x + this.drawEnd.x) / 2, (this.drawStart.y + this.drawEnd.y) / 2 - 10 / this.zoom);
        }

        if (this.currentTool === 'measure' && this.drawStart && this.drawEnd) {
            ctx.strokeStyle = 'rgba(245,158,11,0.6)';
            ctx.lineWidth = 1.5 / this.zoom;
            ctx.setLineDash([4 / this.zoom, 4 / this.zoom]);
            ctx.beginPath();
            ctx.moveTo(this.drawStart.x, this.drawStart.y);
            ctx.lineTo(this.drawEnd.x, this.drawEnd.y);
            ctx.stroke();
            ctx.setLineDash([]);
            const dist = Math.hypot(this.drawEnd.x - this.drawStart.x, this.drawEnd.y - this.drawStart.y);
            ctx.fillStyle = 'rgba(245,158,11,0.8)';
            ctx.font = `bold ${12 / this.zoom}px Inter`;
            ctx.textAlign = 'center';
            ctx.fillText(`${dist.toFixed(1)} units`, (this.drawStart.x + this.drawEnd.x) / 2, (this.drawStart.y + this.drawEnd.y) / 2 - 12 / this.zoom);
        }

        if ((this.currentTool === 'polyline' || this.currentTool === 'angle') && this.tempPoints.length > 0) {
            ctx.strokeStyle = 'rgba(0,245,212,0.4)';
            ctx.lineWidth = 1.5 / this.zoom;
            ctx.setLineDash([6 / this.zoom, 4 / this.zoom]);
            ctx.beginPath();
            ctx.moveTo(this.tempPoints[0].x, this.tempPoints[0].y);
            for (let i = 1; i < this.tempPoints.length; i++) {
                ctx.lineTo(this.tempPoints[i].x, this.tempPoints[i].y);
            }
            if (this.drawEnd) {
                ctx.lineTo(this.drawEnd.x, this.drawEnd.y);
            }
            ctx.stroke();
            ctx.setLineDash([]);
            // Draw temp points
            for (const pt of this.tempPoints) {
                ctx.beginPath();
                ctx.arc(pt.x, pt.y, 4 / this.zoom, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(0,245,212,0.6)';
                ctx.fill();
            }
        }

        if (this.currentTool === 'arc' && this.tempPoints.length > 0) {
            ctx.fillStyle = 'rgba(0,245,212,0.6)';
            for (const pt of this.tempPoints) {
                ctx.beginPath();
                ctx.arc(pt.x, pt.y, 4 / this.zoom, 0, Math.PI * 2);
                ctx.fill();
            }
            if (this.tempPoints.length === 2 && this.drawEnd) {
                const pts = this.generateArcPoints(this.tempPoints[0], this.tempPoints[1], this.drawEnd);
                ctx.strokeStyle = 'rgba(0,245,212,0.4)';
                ctx.lineWidth = 1.5 / this.zoom;
                ctx.setLineDash([6 / this.zoom, 4 / this.zoom]);
                ctx.beginPath();
                ctx.moveTo(pts[0].x, pts[0].y);
                for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        }
    },

    // --- Export DXF ---
    exportDXF() {
        let dxf = '0\nSECTION\n2\nENTITIES\n';
        for (const el of this.elements) {
            if (el.type === 'pipe' || el.type === 'dimension') {
                dxf += `0\nLINE\n8\n${el.layer || '0'}\n10\n${el.x.toFixed(4)}\n20\n${el.y.toFixed(4)}\n11\n${el.x2.toFixed(4)}\n21\n${el.y2.toFixed(4)}\n`;
            } else if (el.type === 'manhole' || el.type === 'junction') {
                dxf += `0\nCIRCLE\n8\n${el.layer || '0'}\n10\n${el.x.toFixed(4)}\n20\n${el.y.toFixed(4)}\n40\n10\n`;
            } else if (el.type === 'text' || el.type === 'label') {
                dxf += `0\nTEXT\n8\n${el.layer || '0'}\n10\n${el.x.toFixed(4)}\n20\n${el.y.toFixed(4)}\n40\n10\n1\n${el.text || ''}\n`;
            } else if (el.type === 'rectangle') {
                dxf += `0\nLINE\n8\n${el.layer || '0'}\n10\n${el.x.toFixed(4)}\n20\n${el.y.toFixed(4)}\n11\n${el.x2.toFixed(4)}\n21\n${el.y.toFixed(4)}\n`;
                dxf += `0\nLINE\n8\n${el.layer || '0'}\n10\n${el.x2.toFixed(4)}\n20\n${el.y.toFixed(4)}\n11\n${el.x2.toFixed(4)}\n21\n${el.y2.toFixed(4)}\n`;
                dxf += `0\nLINE\n8\n${el.layer || '0'}\n10\n${el.x2.toFixed(4)}\n20\n${el.y2.toFixed(4)}\n11\n${el.x.toFixed(4)}\n21\n${el.y2.toFixed(4)}\n`;
                dxf += `0\nLINE\n8\n${el.layer || '0'}\n10\n${el.x.toFixed(4)}\n20\n${el.y2.toFixed(4)}\n11\n${el.x.toFixed(4)}\n21\n${el.y.toFixed(4)}\n`;
            }
        }
        dxf += '0\nENDSEC\n0\nEOF\n';

        const blob = new Blob([dxf], { type: 'application/dxf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'drainflow_design.dxf';
        a.click();
        URL.revokeObjectURL(url);
    },
};

// Global functions for buttons
function setCadTool(tool) {
    CAD.currentTool = tool;
    CAD.cancelDrawing();
    document.querySelectorAll('.cad-tool-btn[data-tool]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tool === tool);
    });
    // Update cursor
    const cursors = { select: 'default', pan: 'grab' };
    CAD.canvas.style.cursor = cursors[tool] || 'crosshair';

    // Update style inputs
    document.getElementById('propColor').value = CAD.lineColor;
    document.getElementById('propWidth').value = CAD.lineWidth;
    document.getElementById('propLineStyle').value = CAD.lineStyle;
}

function cadUndo() { CAD.undo(); }
function cadRedo() { CAD.redo(); }
function cadClearAll() { CAD.clearAll(); }
function cadCopy() { CAD.copy(); }
function cadPaste() { CAD.paste(); }
function cadDuplicate() { CAD.duplicate(); }
function cadExportDXF() { CAD.exportDXF(); }
function cadZoomIn() { CAD.zoomIn(); }
function cadZoomOut() { CAD.zoomOut(); }
function cadResetView() { CAD.resetView(); }

function toggleSnap(type) {
    if (type === 'grid') { CAD.snapToGrid = !CAD.snapToGrid; document.getElementById('btnSnapGrid').classList.toggle('active', CAD.snapToGrid); }
    if (type === 'node') { CAD.snapToNode = !CAD.snapToNode; document.getElementById('btnSnapNode').classList.toggle('active', CAD.snapToNode); }
    if (type === 'end') CAD.snapEnd = document.getElementById('snapEnd').checked;
    if (type === 'mid') CAD.snapMid = document.getElementById('snapMid').checked;
    if (type === 'int') CAD.snapInt = document.getElementById('snapInt').checked;
}

function toggleOrtho() {
    CAD.orthoMode = !CAD.orthoMode;
    document.getElementById('btnOrtho').classList.toggle('active', CAD.orthoMode);
}

function toggleLayer(name) {
    CAD.layers[name].visible = !CAD.layers[name].visible;
    const btn = document.querySelector(`.layer-item[data-layer="${name}"] .layer-toggle`);
    if (btn) {
        btn.classList.toggle('on', CAD.layers[name].visible);
        btn.textContent = CAD.layers[name].visible ? '👁' : '👁‍🗨';
    }
    CAD.render();
}

function toggleProperties() {
    const body = document.getElementById('propertiesBody');
    if (body) body.style.display = body.style.display === 'none' ? 'flex' : 'none';
}

// Listen for property changes
document.addEventListener('DOMContentLoaded', () => {
    const colorInput = document.getElementById('propColor');
    const widthInput = document.getElementById('propWidth');
    const styleInput = document.getElementById('propLineStyle');

    if (colorInput) colorInput.addEventListener('input', (e) => {
        CAD.lineColor = e.target.value;
        if (CAD.selectedElement) { CAD.selectedElement.color = e.target.value; CAD.render(); }
    });
    if (widthInput) widthInput.addEventListener('input', (e) => {
        CAD.lineWidth = parseInt(e.target.value) || 2;
        if (CAD.selectedElement && CAD.selectedElement.width !== undefined) { CAD.selectedElement.width = CAD.lineWidth; CAD.render(); }
    });
    if (styleInput) styleInput.addEventListener('change', (e) => {
        CAD.lineStyle = e.target.value;
        if (CAD.selectedElement && CAD.selectedElement.style !== undefined) { CAD.selectedElement.style = CAD.lineStyle; CAD.render(); }
    });
});
