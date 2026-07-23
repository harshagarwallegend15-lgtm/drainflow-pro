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
        roads: { visible: true, color: '#94a3b8' },
        pipes: { visible: true, color: '#00f5d4' },
        nodes: { visible: true, color: '#7b61ff' },
        annotations: { visible: true, color: '#f59e0b' },
        dimensions: { visible: true, color: '#ef4444' },
    },
    elementCounters: { road: 0, pipe: 0, manhole: 0, catchpit: 0, outlet: 0, junction: 0, text: 0, rect: 0, polyline: 0, arc: 0, dimension: 0, label: 0 },
    designParams: {
        pipeDiaMm: 225,
        material: 'PVC',
        slopePct: 2,
        manning: 0.013,
        flowRate: 0,
        velocity: 0,
        roadWidth: 12,
        catchmentArea: 5000,
        location: '',
        soil: '',
        elev: 0
    },
    roadWidth: 12,
    lineColor: '#00f5d4',
    lineWidth: 2,
    lineStyle: 'solid',

    init() {
        this.canvas = document.getElementById('cadCanvas');
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        this.resize();
        this.bindEvents();
        this.syncDesignParams();
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
                case 'road':
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
        if ((this.currentTool === 'polyline' || this.currentTool === 'road') && this.tempPoints.length > 1) {
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
        const shortcuts = { v: 'select', h: 'pan', p: 'pipe', w: 'road', l: 'polyline', a: 'arc', r: 'rectangle', m: 'manhole', c: 'catchpit', o: 'outlet', j: 'junction', t: 'text', d: 'dimension', b: 'label' };
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
            case 'road':
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
            this.pushElement(this.createPipeElement(
                this.drawStart.x, this.drawStart.y, pos.x, pos.y,
                `Pipe ${this.elementCounters.pipe}`
            ));
        }
        this.isDrawing = false;
        this.drawStart = null;
    },

    createPipeElement(x, y, x2, y2, name, overrides = {}) {
        const p = this.designParams;
        return {
            type: 'pipe',
            x, y, x2, y2,
            layer: 'pipes',
            color: overrides.color || this.lineColor,
            width: overrides.width || this.lineWidth,
            style: overrides.style || this.lineStyle,
            name,
            diameterMm: overrides.diameterMm ?? p.pipeDiaMm,
            material: overrides.material ?? p.material,
            slopePct: overrides.slopePct ?? p.slopePct,
            manning: overrides.manning ?? p.manning,
            flowRate: overrides.flowRate ?? p.flowRate,
            velocity: overrides.velocity ?? p.velocity,
            autoGenerated: overrides.autoGenerated ?? false,
            ...overrides
        };
    },

    handlePolylineClick(pos) {
        this.tempPoints.push(pos);
        this.isDrawing = true;
        this.render();
    },

    finishPolyline() {
        if (this.tempPoints.length > 1) {
            if (this.currentTool === 'road') {
                this.elementCounters.road++;
                this.pushElement({
                    type: 'road',
                    x: this.tempPoints[0].x, y: this.tempPoints[0].y,
                    points: [...this.tempPoints],
                    roadWidth: this.roadWidth,
                    layer: 'roads',
                    color: '#94a3b8',
                    width: 2,
                    style: 'solid',
                    name: `Road ${this.elementCounters.road}`,
                    autoGenerated: false
                });
            } else {
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
        const ec = document.getElementById('cadElementCountCenter');
        if (ec) ec.textContent = this.elements.length;
        const vc = document.getElementById('viewer3dCount');
        if (vc) vc.textContent = this.elements.length;
        // Update status info
        const statusInfo = document.getElementById('cadStatusInfo');
        if (statusInfo) {
            const pipes = this.elements.filter(e => e.type === 'pipe').length;
            const nodes = this.elements.filter(e => ['manhole', 'catchpit', 'outlet', 'junction'].includes(e.type)).length;
            const roads = this.elements.filter(e => e.type === 'road').length;
            if (this.elements.length === 0) {
                statusInfo.textContent = 'Ready — select a tool to begin';
            } else {
                statusInfo.textContent = `${roads} road${roads !== 1 ? 's' : ''} · ${pipes} pipe${pipes !== 1 ? 's' : ''} · ${nodes} node${nodes !== 1 ? 's' : ''}`;
            }
        }
    },

    updateProperties() {
        const propType = document.getElementById('propType');
        const propX = document.getElementById('propX');
        const propY = document.getElementById('propY');
        const propHydraulic = document.getElementById('propHydraulic');
        if (!propType) return;

        if (this.selectedElement) {
            const el = this.selectedElement;
            propType.textContent = el.name || el.type;
            propX.value = Math.round(el.x);
            propY.value = Math.round(el.y);
            propX.disabled = false;
            propY.disabled = false;
            if (propHydraulic) {
                if (el.type === 'pipe') {
                    propHydraulic.innerHTML = `<div class="hyd-row"><span>Ø</span><strong>${el.diameterMm || '—'} mm</strong></div>
                        <div class="hyd-row"><span>Material</span><strong>${el.material || '—'}</strong></div>
                        <div class="hyd-row"><span>Slope</span><strong>${el.slopePct ?? '—'}%</strong></div>
                        <div class="hyd-row"><span>Q</span><strong>${el.flowRate != null ? el.flowRate.toFixed(4) + ' m³/s' : '—'}</strong></div>`;
                } else if (el.type === 'road') {
                    propHydraulic.innerHTML = `<div class="hyd-row"><span>Width</span><strong>${el.roadWidth || this.roadWidth} m</strong></div>
                        <div class="hyd-row"><span>Length</span><strong>${this.polylineLength(el.points).toFixed(1)} m</strong></div>`;
                } else {
                    propHydraulic.innerHTML = '<span class="prop-muted">Select a pipe or road for hydraulic data</span>';
                }
            }
        } else {
            propType.textContent = 'None selected';
            propX.value = '';
            propY.value = '';
            propX.disabled = true;
            propY.disabled = true;
            if (propHydraulic) propHydraulic.innerHTML = '<span class="prop-muted">Select an element</span>';
        }
    },

    polylineLength(points) {
        if (!points || points.length < 2) return 0;
        let len = 0;
        for (let i = 1; i < points.length; i++) {
            len += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
        }
        return len;
    },

    syncDesignParams() {
        const calc = window._calcResults;
        const map = window._mapData;
        if (calc) {
            this.designParams.pipeDiaMm = calc.pipeDia;
            this.designParams.material = calc.material;
            this.designParams.slopePct = calc.slopePct ?? calc.slope * 100;
            this.designParams.manning = calc.manning;
            this.designParams.flowRate = calc.Q;
            this.designParams.velocity = calc.V;
            this.designParams.catchmentArea = calc.area;
        }
        if (map) {
            this.designParams.location = map.address || `${map.lat?.toFixed(4)}, ${map.lng?.toFixed(4)}`;
            this.designParams.soil = map.soil || '—';
            this.designParams.elev = map.elev || 0;
            if (!calc) this.designParams.slopePct = parseFloat(map.slope) || this.designParams.slopePct;
        }
        const area = this.designParams.catchmentArea || 5000;
        this.designParams.roadWidth = area > 15000 ? 22 : area > 8000 ? 18 : area > 3000 ? 16 : 14;
        this.roadWidth = this.designParams.roadWidth;
        const rwInput = document.getElementById('cadRoadWidthInput');
        if (rwInput) rwInput.value = this.roadWidth;
        this.updateDesignPanel();
        return this.designParams;
    },

    updateDesignPanel() {
        const p = this.designParams;
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        set('cadDesignLocation', p.location || 'No map location');
        set('cadDesignSoil', p.soil || '—');
        set('cadDesignElev', p.elev ? `${p.elev.toFixed(1)} m` : '—');
        set('cadDesignFlow', p.flowRate ? `${p.flowRate.toFixed(4)} m³/s` : '—');
        set('cadDesignVelocity', p.velocity ? `${p.velocity.toFixed(2)} m/s` : '—');
        set('cadDesignPipe', p.pipeDiaMm ? `${p.pipeDiaMm} mm ${p.material}` : '—');
        set('cadDesignSlope', p.slopePct ? `${p.slopePct}%` : '—');
        set('cadDesignRoadWidth', `${p.roadWidth} m`);
        const status = document.getElementById('cadDesignStatus');
        if (status) {
            status.textContent = window._calcResults
                ? 'Calculator data linked — ready for auto-design'
                : (window._mapData ? 'Map data only — run Calculator for full auto-design' : 'Select map location & run Calculator first');
            status.className = 'cad-design-status ' + (window._calcResults ? 'ready' : 'pending');
        }
    },

    buildRoadCenterline(roadLength, stations) {
        const profile = window._mapProfileData;
        const map = window._mapData;
        const slopePct = this.designParams.slopePct || 2;
        const startX = -roadLength / 2;
        const points = [];
        const vertScale = 0.4;

        for (let i = 0; i < stations; i++) {
            const t = i / (stations - 1);
            const x = startX + t * roadLength;
            let elev;
            if (profile && profile.length >= 3) {
                const idx = Math.round(t * (profile.length - 1));
                elev = profile[idx];
            } else {
                const base = map?.elev || 100;
                elev = base - t * roadLength * (slopePct / 100);
            }
            const y = -(elev - (profile?.[0] ?? map?.elev ?? 100)) * vertScale;
            points.push({ x, y });
        }
        return points;
    },

    offsetPolyline(points, offset) {
        if (!points || points.length < 2) return [];
        const left = [];
        const right = [];
        for (let i = 0; i < points.length; i++) {
            const prev = points[Math.max(0, i - 1)];
            const next = points[Math.min(points.length - 1, i + 1)];
            const dx = next.x - prev.x;
            const dy = next.y - prev.y;
            const len = Math.hypot(dx, dy) || 1;
            const nx = -dy / len;
            const ny = dx / len;
            left.push({ x: points[i].x + nx * offset, y: points[i].y + ny * offset });
            right.push({ x: points[i].x - nx * offset, y: points[i].y - ny * offset });
        }
        return { left, right };
    },

    createNodeElement(type, x, y, name, autoGenerated = false, meta = {}) {
        const colors = { manhole: '#7b61ff', catchpit: '#f59e0b', outlet: '#3b82f6', junction: '#ec4899' };
        return {
            type, x, y,
            layer: 'nodes',
            color: colors[type] || '#7b61ff',
            name,
            autoGenerated,
            ...meta
        };
    },

    computeEngineeringLayout(calc, centerline, drainLine) {
        const p = this.designParams;
        const slopeFrac = p.slopePct / 100;
        const pipeRadiusM = (p.pipeDiaMm || 225) / 2000;
        const minCover = Math.max(0.9, pipeRadiusM * 2 + 0.4);
        const profile = window._mapProfileData;
        const baseElev = window._mapData?.elev || 100;
        const vertScale = 0.4;
        const catchSpacing = Math.max(40, Math.min(80, Math.sqrt(calc.area) / 6));
        const mhSpacing = Math.max(80, Math.min(150, 80 + (p.pipeDiaMm || 225) / 6));
        const pitCount = Math.max(3, Math.ceil(this.polylineLength(drainLine) / catchSpacing) + 1);

        const stationData = [];
        let cumulativeDist = 0;
        for (let i = 0; i < drainLine.length; i++) {
            if (i > 0) {
                cumulativeDist += Math.hypot(drainLine[i].x - drainLine[i - 1].x, drainLine[i].y - drainLine[i - 1].y);
            }
            const t = centerline.length > 1 ? i / (drainLine.length - 1) : 0;
            let groundElev;
            if (profile && profile.length >= 3) {
                const idx = Math.round(t * (profile.length - 1));
                groundElev = profile[idx];
            } else {
                groundElev = baseElev - cumulativeDist * slopeFrac;
            }
            const invertElev = groundElev - minCover - pipeRadiusM;
            stationData.push({
                x: drainLine[i].x,
                y: drainLine[i].y,
                stationM: cumulativeDist,
                groundElev,
                invertElev,
                coverDepth: minCover,
                depthM: minCover + pipeRadiusM
            });
        }
        return { catchSpacing, mhSpacing, pitCount, minCover, pipeRadiusM, slopeFrac, stationData, vertScale };
    },

    // Build a fully connected gravity-drainage trunk in downstream order.
    // Uses two-pass placement (catch pits, then manholes) merged by distance,
    // with hydraulically consistent invert grades. Returns { nodes, pipes }.
    buildDrainageNetwork(calc, drainLine, layout) {
        const p = this.designParams;
        const diaMm = calc.pipeDia || p.pipeDiaMm || 225;
        const pipeRadiusM = diaMm / 2000;
        const minCover = layout.minCover;
        const slopeFrac = layout.slopeFrac;
        const sd = layout.stationData;
        const baseElev = window._mapData?.elev || 100;

        // Collect structures of a given type at spacing intervals along drainLine
        function collectStructures(spacing, type) {
            const list = [];
            let acc = spacing + 0.01, dist = 0, prev = null;
            for (let i = 0; i < drainLine.length; i++) {
                const pt = drainLine[i];
                if (prev) dist += Math.hypot(pt.x - prev.x, pt.y - prev.y);
                if (i === 0 || acc >= spacing) {
                    const s = sd[Math.min(i, sd.length - 1)];
                    list.push({ type, x: pt.x, y: pt.y, dist, sd: s });
                    acc = 0;
                }
                acc += prev ? Math.hypot(pt.x - prev.x, pt.y - prev.y) : 0;
                prev = pt;
            }
            return list;
        }

        // Separate passes for catchpits and manholes (different spacing)
        const catchpits = collectStructures(layout.catchSpacing, 'catchpit');
        const manholes = collectStructures(layout.mhSpacing, 'manhole');

        // Merge & sort, dedup entries closer than 5m
        let all = [...catchpits, ...manholes];
        all.sort((a, b) => a.dist - b.dist);
        const merged = [all[0]];
        for (let k = 1; k < all.length; k++) {
            if (all[k].dist - merged[merged.length - 1].dist > 5) {
                merged.push(all[k]);
            }
        }

        // Always append the outlet at the absolute drain line end (no dedup applied)
        const lastPt = drainLine[drainLine.length - 1];
        let outletDist = 0;
        for (let i = 1; i < drainLine.length; i++) {
            outletDist += Math.hypot(drainLine[i].x - drainLine[i - 1].x, drainLine[i].y - drainLine[i - 1].y);
        }
        const lastSd = sd[sd.length - 1];
        merged.push({ type: 'outlet', x: lastPt.x, y: lastPt.y, dist: outletDist, sd: lastSd });

        // --- Initial inverts from cover, then enforce continuous downstream fall ---
        const n = merged.length;
        const inverts = new Array(n);
        for (let k = 0; k < n; k++) {
            const g = merged[k].sd?.groundElev ?? baseElev;
            inverts[k] = g - minCover - pipeRadiusM;
        }
        for (let k = 1; k < n; k++) {
            const segLen = Math.hypot(merged[k].x - merged[k - 1].x, merged[k].y - merged[k - 1].y);
            const requiredDrop = slopeFrac * segLen;
            if (inverts[k] > inverts[k - 1] - requiredDrop) {
                inverts[k] = inverts[k - 1] - requiredDrop;
            }
        }

        // --- Build node elements ---
        const nodes = [];
        for (let k = 0; k < n; k++) {
            const pos = merged[k];
            const g = pos.sd?.groundElev ?? baseElev;
            const inv = inverts[k];
            const depthM = g - inv;
            const coverDepth = depthM - pipeRadiusM;
            let name;
            if (pos.type === 'outlet') { this.elementCounters.outlet++; name = `Outlet ${this.elementCounters.outlet}`; }
            else if (pos.type === 'manhole') { this.elementCounters.manhole++; name = `Manhole ${this.elementCounters.manhole}`; }
            else { this.elementCounters.catchpit++; name = `Catch Pit ${this.elementCounters.catchpit}`; }
            nodes.push(this.createNodeElement(pos.type, pos.x, pos.y, name, true, {
                stationM: pos.dist,
                groundElev: g,
                invertElev: inv,
                depthM,
                coverDepth,
                diameterMm: diaMm
            }));
        }

        // --- Build connecting pipes (consecutive nodes in flow order) ---
        const pipes = [];
        for (let k = 1; k < n; k++) {
            const a = nodes[k - 1], b = nodes[k];
            const segLen = Math.hypot(b.x - a.x, b.y - a.y);
            const slopePct = segLen > 0 ? ((a.invertElev - b.invertElev) / segLen) * 100 : slopeFrac * 100;
            this.elementCounters.pipe++;
            pipes.push(this.createPipeElement(a.x, a.y, b.x, b.y, `Pipe ${this.elementCounters.pipe}`, {
                autoGenerated: true,
                color: '#00f5d4',
                width: 3,
                stationM: a.stationM,
                lengthM: segLen,
                invertStart: a.invertElev,
                invertEnd: b.invertElev,
                groundElev: (a.groundElev + b.groundElev) / 2,
                groundElevStart: a.groundElev,
                groundElevEnd: b.groundElev,
                slopePct: +slopePct.toFixed(3),
                diameterMm: diaMm,
                material: calc.material,
                flowRate: calc.Q,
                Vfull: calc.Vfull
            }));
        }

        return { nodes, pipes };
    },

    drawFlowArrow(ctx, x1, y1, x2, y2, color, size) {
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2;
        const angle = Math.atan2(y2 - y1, x2 - x1);
        ctx.save();
        ctx.translate(mx, my);
        ctx.rotate(angle);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(size, 0);
        ctx.lineTo(-size * 0.6, size * 0.5);
        ctx.lineTo(-size * 0.6, -size * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    },

    // Get realistic symbol size from pipe diameter or default
    getSymbolScale(el) {
        const diaMm = el.diameterMm || this.designParams.pipeDiaMm || 225;
        // Map pipe diameter to pixel scale at zoom=1: Ø225mm → 2.0 scale (even bigger)
        return Math.max(1.2, Math.min(6, diaMm / 110));
    },

    // ---- Shared symbol helpers ----
    isSel(el) {
        return this.selectedElements.includes(el) || el === this.selectedElement;
    },

    // Lighten (amt>0) / darken (amt<0) a hex color. amt in [-1,1]
    shade(hex, amt) {
        let c = (hex || '#00f5d4').replace('#', '');
        if (c.length === 3) c = c.split('').map(x => x + x).join('');
        let r = parseInt(c.substr(0, 2), 16) || 0;
        let g = parseInt(c.substr(2, 2), 16) || 0;
        let b = parseInt(c.substr(4, 2), 16) || 0;
        if (amt >= 0) {
            r = Math.round(r + (255 - r) * amt);
            g = Math.round(g + (255 - g) * amt);
            b = Math.round(b + (255 - b) * amt);
        } else {
            const f = 1 + amt;
            r = Math.round(r * f); g = Math.round(g * f); b = Math.round(b * f);
        }
        return `rgb(${r},${g},${b})`;
    },

    // Rounded tag chip with centered text
    drawChip(ctx, cx, cy, text, accent, opts = {}) {
        const z = this.zoom;
        const size = opts.size || 9;
        ctx.font = `bold ${size / z}px Inter`;
        const tw = ctx.measureText(text).width + 10 / z;
        const th = size * 1.35 / z;
        const x = cx - tw / 2, y = cy - th / 2;
        ctx.fillStyle = opts.fill || 'rgba(8,12,22,0.92)';
        ctx.strokeStyle = accent;
        ctx.lineWidth = (opts.lw || 1) / z;
        if (ctx.roundRect) {
            ctx.beginPath();
            ctx.roundRect(x, y, tw, th, 3 / z);
        } else {
            ctx.beginPath();
            ctx.rect(x, y, tw, th);
        }
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = opts.text || accent;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, cx, cy);
        ctx.textBaseline = 'alphabetic';
    },

    // Stacked engineering annotation lines below a point
    drawLabelBlock(ctx, cx, topY, lines) {
        const z = this.zoom;
        ctx.textAlign = 'center';
        let y = topY;
        for (const ln of lines) {
            if (ln.text == null || ln.text === '') { y += 9 / z; continue; }
            ctx.font = `${ln.bold ? 'bold ' : ''}${(ln.size || 8) / z}px Inter`;
            ctx.fillStyle = ln.color || 'rgba(232,234,237,0.72)';
            ctx.fillText(ln.text, cx, y);
            y += ((ln.size || 8) + 3) / z;
        }
    },

    // Selection halo + corner handles around a bounding box
    drawSelectionFrame(ctx, minX, minY, maxX, maxY, color) {
        const z = this.zoom;
        const pad = 6 / z;
        const x = minX - pad, y = minY - pad, w = (maxX - minX) + pad * 2, h = (maxY - minY) + pad * 2;
        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = 10 / z;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.2 / z;
        ctx.setLineDash([5 / z, 3 / z]);
        if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, w, h, 4 / z); }
        else { ctx.beginPath(); ctx.rect(x, y, w, h); }
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.shadowBlur = 0;
        const hs = 3.2 / z;
        ctx.fillStyle = color;
        for (const [hx, hy] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]) {
            ctx.fillRect(hx - hs, hy - hs, hs * 2, hs * 2);
        }
        ctx.restore();
    },


    drawSymbolPipe(ctx, el, selected) {
        const z = this.zoom;
        const diaMm = el.diameterMm || this.designParams.pipeDiaMm || 225;
        const color = el.color || '#00f5d4';
        const dx = el.x2 - el.x, dy = el.y2 - el.y;
        const len = Math.hypot(dx, dy) || 1;
        // Half-width of barrel proportional to real diameter (Ø225mm → 5px half-width at zoom=1)
        const halfW = Math.max(4, Math.min(22, (diaMm / 225) * 5)) / z;
        const nx = -dy / len * halfW, ny = dx / len * halfW;
        const sel = selected || this.isSel(el);
        const arrowCol = sel ? '#ffffff' : this.shade(color, 0.5);

        // --- Barrel fill (linear gradient gives a cylindrical look) ---
        const grad = ctx.createLinearGradient(el.x + nx, el.y + ny, el.x - nx, el.y - ny);
        grad.addColorStop(0, this.shade(color, -0.35));
        grad.addColorStop(0.5, this.shade(color, 0.15));
        grad.addColorStop(1, this.shade(color, -0.35));
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(el.x + nx, el.y + ny);
        ctx.lineTo(el.x2 + nx, el.y2 + ny);
        ctx.lineTo(el.x2 - nx, el.y2 - ny);
        ctx.lineTo(el.x - nx, el.y - ny);
        ctx.closePath();
        ctx.fill();

        // --- Casing walls ---
        ctx.strokeStyle = sel ? '#ffffff' : this.shade(color, 0.35);
        ctx.lineWidth = Math.max(0.6, halfW * 0.16);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(el.x + nx, el.y + ny);
        ctx.lineTo(el.x2 + nx, el.y2 + ny);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(el.x - nx, el.y - ny);
        ctx.lineTo(el.x2 - nx, el.y2 - ny);
        ctx.stroke();

        // --- Joint ticks along the barrel (every ~1m, max ~24) ---
        const joints = Math.max(1, Math.min(24, Math.round(len / Math.max(40, halfW * 8))));
        ctx.strokeStyle = this.shade(color, -0.1);
        ctx.lineWidth = Math.max(0.5, halfW * 0.12);
        for (let i = 1; i < joints; i++) {
            const t = i / joints;
            const jx = el.x + dx * t, jy = el.y + dy * t;
            ctx.beginPath();
            ctx.moveTo(jx + nx, jy + ny);
            ctx.lineTo(jx - nx, jy - ny);
            ctx.stroke();
        }

        // --- Centerline (dashed construction line) ---
        ctx.setLineDash([5 / z, 3 / z]);
        ctx.lineWidth = 0.8 / z;
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.beginPath();
        ctx.moveTo(el.x, el.y);
        ctx.lineTo(el.x2, el.y2);
        ctx.stroke();
        ctx.setLineDash([]);

        // --- Flow-direction arrow at midpoint ---
        const arrowSize = Math.max(6, Math.min(16, 8 + diaMm / 120)) / z;
        this.drawFlowArrow(ctx, el.x, el.y, el.x2, el.y2, arrowCol, arrowSize);

        // --- Midpoint chip: diameter + slope ---
        const mx = (el.x + el.x2) / 2, my = (el.y + el.y2) / 2;
        const tag = `Ø${diaMm}mm${el.slopePct != null ? `  ${el.slopePct}%` : ''}`;
        this.drawChip(ctx, mx, my, tag, sel ? '#ffffff' : color, { size: 9 });

        // --- Engineering annotation block below midpoint ---
        const lines = [];
        if (el.material) lines.push({ text: el.material, color: 'rgba(232,234,237,0.6)', size: 7.5 });
        if (el.lengthM != null) lines.push({ text: `L = ${el.lengthM.toFixed(1)} m`, color: 'rgba(232,234,237,0.6)', size: 7.5 });
        if (el.stationM != null) lines.push({ text: `Ch ${el.stationM.toFixed(0)} m`, color: 'rgba(232,234,237,0.6)', size: 7.5 });
        if (el.flowRate != null) lines.push({ text: `Q = ${el.flowRate.toFixed(3)} m³/s`, color: this.shade(color, 0.2), size: 7.5, bold: true });
        this.drawLabelBlock(ctx, mx, my + 14 / z, lines);

        // --- Invert levels at the two ends ---
        ctx.textAlign = 'center';
        ctx.font = `${7 / z}px Inter`;
        if (el.invertStart != null) {
            ctx.fillStyle = this.shade(color, 0.1);
            ctx.fillText(`IL ${el.invertStart.toFixed(2)}`, el.x, el.y - halfW - 5 / z);
        }
        if (el.invertEnd != null) {
            ctx.fillStyle = this.shade(color, 0.1);
            ctx.fillText(`IL ${el.invertEnd.toFixed(2)}`, el.x2, el.y2 - halfW - 5 / z);
        }

        // --- Selection frame ---
        if (sel) {
            this.drawSelectionFrame(ctx, Math.min(el.x, el.x2) - halfW, Math.min(el.y, el.y2) - halfW,
                Math.max(el.x, el.x2) + halfW, Math.max(el.y, el.y2) + halfW, color);
        }
    },

    drawSymbolManhole(ctx, el) {
        const z = this.zoom;
        const scale = this.getSymbolScale(el);
        // Real manhole ~1500mm dia → r ~22 at scale=2.0
        const r = Math.max(16, Math.min(40, 18 + scale * 6)) / z;
        const color = el.color || '#7b61ff';
        const sel = this.isSel(el);

        // --- Soft drop shadow ---
        if (sel) {
            ctx.save();
            ctx.shadowColor = color;
            ctx.shadowBlur = 10 / z;
        }

        // --- Structure outer wall (concrete barrel) ---
        ctx.fillStyle = 'rgba(10,14,26,0.55)';
        ctx.beginPath();
        ctx.arc(el.x, el.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 2.4 / z;
        ctx.strokeStyle = sel ? '#ffffff' : color;
        ctx.beginPath();
        ctx.arc(el.x, el.y, r, 0, Math.PI * 2);
        ctx.stroke();

        // --- Frame ring (inner concentric circle = cover frame) ---
        ctx.lineWidth = 1.4 / z;
        ctx.strokeStyle = this.shade(color, 0.25);
        ctx.beginPath();
        ctx.arc(el.x, el.y, r * 0.82, 0, Math.PI * 2);
        ctx.stroke();

        // --- Bolt ring (8 cover bolts) ---
        ctx.fillStyle = this.shade(color, 0.4);
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            ctx.beginPath();
            ctx.arc(el.x + Math.cos(a) * (r * 0.6), el.y + Math.sin(a) * (r * 0.6), 1.4 / z, 0, Math.PI * 2);
            ctx.fill();
        }

        // --- Hydraulic center cross-hair (ODOT standard) ---
        ctx.strokeStyle = this.shade(color, 0.5);
        ctx.lineWidth = 1 / z;
        const ch = r * 0.32;
        ctx.beginPath();
        ctx.moveTo(el.x - ch, el.y); ctx.lineTo(el.x + ch, el.y);
        ctx.moveTo(el.x, el.y - ch); ctx.lineTo(el.x, el.y + ch);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(el.x, el.y, ch * 0.5, 0, Math.PI * 2);
        ctx.stroke();

        if (sel) ctx.restore();

        // --- MH label centered ---
        ctx.fillStyle = sel ? '#ffffff' : color;
        ctx.font = `bold ${Math.min(13, Math.max(9, r * 0.7)) / z}px Inter`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('MH', el.x, el.y);
        ctx.textBaseline = 'alphabetic';

        // --- Diameter tag above ---
        const mhDia = Math.round(1200 + scale * 150);
        this.drawChip(ctx, el.x, el.y - r - 9 / z, `Ø${mhDia}mm`, color, { size: 7.5, text: color });

        // --- Station above diameter ---
        if (el.stationM != null) {
            ctx.fillStyle = 'rgba(232,234,237,0.7)';
            ctx.font = `${8 / z}px Inter`;
            ctx.textAlign = 'center';
            ctx.fillText(`Ch ${el.stationM.toFixed(0)} m`, el.x, el.y - r - 20 / z);
        }

        // --- Name + engineering data below ---
        ctx.fillStyle = 'rgba(232,234,237,0.9)';
        ctx.font = `bold ${9 / z}px Inter`;
        ctx.textAlign = 'center';
        ctx.fillText(el.name, el.x, el.y + r + 15 / z);

        const lines = [];
        if (el.invertElev != null) lines.push({ text: `IL ${el.invertElev.toFixed(2)} m`, color: this.shade(color, 0.2), bold: true, size: 8 });
        if (el.groundElev != null) lines.push({ text: `GL ${el.groundElev.toFixed(2)} m`, color: 'rgba(232,234,237,0.6)', size: 7.5 });
        if (el.depthM != null) lines.push({ text: `Depth ${el.depthM.toFixed(2)} m`, color: this.shade(color, 0.1), size: 7.5 });
        if (el.coverDepth != null) lines.push({ text: `Cover ${el.coverDepth.toFixed(2)} m`, color: 'rgba(232,234,237,0.5)', size: 7.5 });
        this.drawLabelBlock(ctx, el.x, el.y + r + 26 / z, lines);

        if (sel) this.drawSelectionFrame(ctx, el.x - r, el.y - r, el.x + r, el.y + r, color);
    },

    drawSymbolCatchpit(ctx, el) {
        const z = this.zoom;
        const scale = this.getSymbolScale(el);
        // Real catch basin ~1200mm → s ~20 at scale=2.0
        const s = Math.max(14, Math.min(34, 16 + scale * 4)) / z;
        const color = el.color || '#f59e0b';
        const sel = this.isSel(el);
        const x0 = el.x - s, y0 = el.y - s, side = s * 2;

        if (sel) { ctx.save(); ctx.shadowColor = color; ctx.shadowBlur = 10 / z; }

        // --- Structure body ---
        ctx.fillStyle = 'rgba(10,14,26,0.6)';
        ctx.fillRect(x0, y0, side, side);
        ctx.lineWidth = 2.4 / z;
        ctx.strokeStyle = sel ? '#ffffff' : color;
        ctx.strokeRect(x0, y0, side, side);

        if (sel) ctx.restore();

        // --- Grate: grid pattern (bars + slots) ---
        ctx.save();
        ctx.beginPath();
        ctx.rect(x0 + 2 / z, y0 + 2 / z, side - 4 / z, side - 4 / z);
        ctx.clip();
        ctx.strokeStyle = 'rgba(255,255,255,0.28)';
        ctx.lineWidth = 1.2 / z;
        const step = Math.max(3, s / 4);
        for (let i = -s; i <= s; i += step) {
            ctx.beginPath();
            ctx.moveTo(el.x + i, el.y - s); ctx.lineTo(el.x + i, el.y + s);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(el.x - s, el.y + i); ctx.lineTo(el.x + s, el.y + i);
            ctx.stroke();
        }
        ctx.restore();

        // --- Frame inner border ---
        ctx.lineWidth = 1 / z;
        ctx.strokeStyle = this.shade(color, 0.3);
        ctx.strokeRect(x0 + 2.5 / z, y0 + 2.5 / z, side - 5 / z, side - 5 / z);

        // --- Inlet arrow (surface flow into basin) ---
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 1.5 / z;
        const ay = el.y - s - 7 / z;
        ctx.beginPath();
        ctx.moveTo(el.x, ay - 4 / z); ctx.lineTo(el.x, y0);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(el.x - 3.5 / z, ay - 1 / z); ctx.lineTo(el.x, ay - 5 / z); ctx.lineTo(el.x + 3.5 / z, ay - 1 / z);
        ctx.closePath();
        ctx.fill();

        // --- Sump indicator (small triangle at bottom-center) ---
        ctx.fillStyle = this.shade(color, 0.2);
        ctx.beginPath();
        ctx.moveTo(el.x - 3 / z, el.y + s - 3 / z);
        ctx.lineTo(el.x + 3 / z, el.y + s - 3 / z);
        ctx.lineTo(el.x, el.y + s - 7 / z);
        ctx.closePath();
        ctx.fill();

        // --- CP label ---
        ctx.fillStyle = sel ? '#ffffff' : color;
        ctx.font = `bold ${Math.min(12, Math.max(8, s * 0.62)) / z}px Inter`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('CP', el.x, el.y);
        ctx.textBaseline = 'alphabetic';

        // --- Size tag above ---
        const cbSize = Math.round(900 + scale * 100);
        this.drawChip(ctx, el.x, el.y - s - 18 / z, `${cbSize}×${cbSize}mm`, color, { size: 7.5, text: color });

        // --- Name + data below ---
        ctx.fillStyle = 'rgba(232,234,237,0.9)';
        ctx.font = `bold ${9 / z}px Inter`;
        ctx.textAlign = 'center';
        ctx.fillText(el.name, el.x, el.y + s + 15 / z);

        const lines = [];
        if (el.stationM != null) lines.push({ text: `Ch ${el.stationM.toFixed(0)} m`, color: 'rgba(232,234,237,0.7)', size: 8 });
        if (el.invertElev != null) lines.push({ text: `IL ${el.invertElev.toFixed(2)} m`, color: this.shade(color, 0.2), bold: true, size: 8 });
        if (el.depthM != null) lines.push({ text: `Depth ${el.depthM.toFixed(2)} m`, color: 'rgba(232,234,237,0.6)', size: 7.5 });
        if (el.coverDepth != null) lines.push({ text: `Cover ${el.coverDepth.toFixed(2)} m`, color: 'rgba(232,234,237,0.5)', size: 7.5 });
        this.drawLabelBlock(ctx, el.x, el.y + s + 26 / z, lines);

        if (sel) this.drawSelectionFrame(ctx, x0, y0, x0 + side, y0 + side, color);
    },

    drawSymbolOutlet(ctx, el) {
        const z = this.zoom;
        const scale = this.getSymbolScale(el);
        const diaMm = el.diameterMm || this.designParams.pipeDiaMm || 225;
        const color = el.color || '#3b82f6';
        const sel = this.isSel(el);
        const hw = Math.max(20, Math.min(50, 20 + scale * 10)) / z;
        const hh = Math.max(14, Math.min(32, 14 + scale * 6)) / z;
        const openingR = Math.max(3, Math.min(12, diaMm / 40)) / z;
        const topW = hw, botW = hw * 0.7;
        const x0 = el.x - topW, y0 = el.y - hh, x1 = el.x + topW, y1 = el.y - hh;
        const x2 = el.x + botW, y2 = el.y + hh, x3 = el.x - botW, y3 = el.y + hh;

        if (sel) { ctx.save(); ctx.shadowColor = color; ctx.shadowBlur = 10 / z; }

        // --- Headwall body ---
        ctx.fillStyle = 'rgba(10,14,26,0.6)';
        ctx.beginPath();
        ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3);
        ctx.closePath();
        ctx.fill();
        ctx.lineWidth = 2.4 / z;
        ctx.strokeStyle = sel ? '#ffffff' : color;
        ctx.stroke();

        if (sel) ctx.restore();

        // --- Pipe opening (dark bore) ---
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.beginPath();
        ctx.arc(el.x, el.y, openingR, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 1.6 / z;
        ctx.strokeStyle = this.shade(color, 0.35);
        ctx.beginPath();
        ctx.arc(el.x, el.y, openingR, 0, Math.PI * 2);
        ctx.stroke();

        // --- OUT label ---
        ctx.fillStyle = sel ? '#ffffff' : color;
        ctx.font = `bold ${Math.min(12, Math.max(8, openingR * 0.9)) / z}px Inter`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('OUT', el.x, el.y);
        ctx.textBaseline = 'alphabetic';

        // --- Riprap (scour protection) — scattered stones around base ---
        ctx.fillStyle = 'rgba(148,163,184,0.5)';
        ctx.strokeStyle = 'rgba(148,163,184,0.35)';
        ctx.lineWidth = 0.6 / z;
        const rng = (n) => { const a = Math.sin(n * 127.1) * 43758.5; return a - Math.floor(a); };
        for (let i = 0; i < 14; i++) {
            const ang = (i / 14) * Math.PI * 2;
            const rad = botW + 4 / z + rng(i) * 10 / z;
            const sx = el.x + Math.cos(ang) * rad;
            const sy = el.y + hh * 0.4 + Math.sin(ang) * rad * 0.5;
            const rs = (1.4 + rng(i + 50) * 1.8) / z;
            ctx.beginPath();
            ctx.arc(sx, sy, rs, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }

        // --- Discharge flow arrows (downstream) ---
        for (let i = 0; i < 3; i++) {
            const ax = el.x + botW + 6 / z + i * (hw * 0.32);
            const col = `rgba(59,130,246,${0.7 - i * 0.18})`;
            this.drawFlowArrow(ctx, ax, el.y, ax + hw * 0.22, el.y, col, (7 - i) / z);
        }

        // --- Name + data ---
        ctx.fillStyle = 'rgba(232,234,237,0.9)';
        ctx.font = `bold ${9 / z}px Inter`;
        ctx.textAlign = 'center';
        ctx.fillText(el.name, el.x, el.y + hh + 14 / z);

        const lines = [];
        if (el.stationM != null) lines.push({ text: `Ch ${el.stationM.toFixed(0)} m`, color: 'rgba(232,234,237,0.7)', size: 8 });
        if (el.invertElev != null) lines.push({ text: `IL ${el.invertElev.toFixed(2)} m`, color: this.shade(color, 0.2), bold: true, size: 8 });
        if (el.designFlow != null) lines.push({ text: `Q ${el.designFlow.toFixed(3)} m³/s`, color: 'rgba(232,234,237,0.6)', size: 7.5 });
        lines.push({ text: `Ø${diaMm}mm`, color: 'rgba(232,234,237,0.5)', size: 7.5 });
        this.drawLabelBlock(ctx, el.x, el.y + hh + 25 / z, lines);

        if (sel) this.drawSelectionFrame(ctx, x0, y0, x2, y2, color);
    },

    drawSymbolJunction(ctx, el) {
        const z = this.zoom;
        const scale = this.getSymbolScale(el);
        const color = el.color || '#ec4899';
        const sel = this.isSel(el);
        // Junction box ~ arm proportional to pipe diameter
        const arm = Math.max(18, Math.min(44, 24 + scale * 6)) / z;
        const box = arm * 0.5;
        const bx0 = el.x - box, by0 = el.y - box, bside = box * 2;

        if (sel) { ctx.save(); ctx.shadowColor = color; ctx.shadowBlur = 10 / z; }

        // --- Connecting pipe stubs (4 sides) ---
        ctx.strokeStyle = sel ? '#ffffff' : this.shade(color, 0.2);
        ctx.lineWidth = Math.max(3, box * 0.42);
        ctx.lineCap = 'butt';
        ctx.beginPath();
        ctx.moveTo(el.x - arm, el.y); ctx.lineTo(el.x + arm, el.y);
        ctx.moveTo(el.x, el.y - arm); ctx.lineTo(el.x, el.y + arm);
        ctx.stroke();

        // --- Flow direction arrows on each stub ---
        this.drawFlowArrow(ctx, el.x - arm, el.y, el.x - box, el.y, color, 6 / z);
        this.drawFlowArrow(ctx, el.x + arm, el.y, el.x + box, el.y, color, 6 / z);
        this.drawFlowArrow(ctx, el.x, el.y - arm, el.x, el.y - box, color, 6 / z);
        this.drawFlowArrow(ctx, el.x, el.y + arm, el.x, el.y + box, color, 6 / z);

        // --- Junction box body ---
        ctx.fillStyle = 'rgba(10,14,26,0.62)';
        ctx.fillRect(bx0, by0, bside, bside);
        ctx.lineWidth = 2.4 / z;
        ctx.strokeStyle = sel ? '#ffffff' : color;
        ctx.strokeRect(bx0, by0, bside, bside);

        if (sel) ctx.restore();

        // --- Inner detail lines (chamber walls) ---
        ctx.strokeStyle = this.shade(color, 0.3);
        ctx.lineWidth = 1 / z;
        ctx.strokeRect(bx0 + 3 / z, by0 + 3 / z, bside - 6 / z, bside - 6 / z);

        // --- Center hub ---
        ctx.fillStyle = sel ? '#ffffff' : color;
        ctx.beginPath();
        ctx.arc(el.x, el.y, 4 / z, 0, Math.PI * 2);
        ctx.fill();

        // --- J label ---
        ctx.fillStyle = sel ? '#0a0e1a' : '#ffffff';
        ctx.font = `bold ${Math.min(11, box * 0.8) / z}px Inter`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('J', el.x, el.y - box - 8 / z);
        ctx.textBaseline = 'alphabetic';

        // --- Name + data ---
        ctx.fillStyle = 'rgba(232,234,237,0.9)';
        ctx.font = `bold ${9 / z}px Inter`;
        ctx.textAlign = 'center';
        ctx.fillText(el.name, el.x, el.y + arm + 15 / z);

        const lines = [];
        if (el.stationM != null) lines.push({ text: `Ch ${el.stationM.toFixed(0)} m`, color: 'rgba(232,234,237,0.7)', size: 8 });
        if (el.invertElev != null) lines.push({ text: `IL ${el.invertElev.toFixed(2)} m`, color: this.shade(color, 0.2), bold: true, size: 8 });
        if (el.depthM != null) lines.push({ text: `Depth ${el.depthM.toFixed(2)} m`, color: 'rgba(232,234,237,0.6)', size: 7.5 });
        this.drawLabelBlock(ctx, el.x, el.y + arm + 26 / z, lines);

        if (sel) this.drawSelectionFrame(ctx, el.x - arm, el.y - arm, el.x + arm, el.y + arm, color);
    },

    drawSymbolRoad(ctx, el) {
        if (!el.points || el.points.length < 2) return;
        const z = this.zoom;
        const rw = el.roadWidth || this.roadWidth || 8;
        const sel = this.isSel(el);
        const off = this.offsetPolyline(el.points, rw / 2);
        const laneLine = this.offsetPolyline(el.points, rw / 4);
        const edgePad = Math.max(0.6, rw * 0.12);
        const curbOff = this.offsetPolyline(el.points, rw / 2 + edgePad);
        const roadColor = el.color || '#94a3b8';

        if (sel) { ctx.save(); ctx.shadowColor = roadColor; ctx.shadowBlur = 10 / z; }

        // --- Road surface (asphalt fill) ---
        const grad = ctx.createLinearGradient(0, off.left[0].y, 0, off.right[0].y);
        grad.addColorStop(0, 'rgba(46, 51, 61, 0.55)');
        grad.addColorStop(0.5, 'rgba(58, 64, 74, 0.68)');
        grad.addColorStop(1, 'rgba(46, 51, 61, 0.55)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        off.left.forEach((pt, i) => i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y));
        for (let i = off.right.length - 1; i >= 0; i--) ctx.lineTo(off.right[i].x, off.right[i].y);
        ctx.closePath();
        ctx.fill();

        if (sel) ctx.restore();

        // --- Outer casing edges (curb) ---
        ctx.strokeStyle = sel ? '#ffffff' : 'rgba(255,255,255,0.55)';
        ctx.lineWidth = 2 / z;
        ctx.setLineDash([]);
        [curbOff.left, curbOff.right].forEach(edge => {
            ctx.beginPath();
            edge.forEach((pt, i) => i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y));
            ctx.stroke();
        });

        // --- Lane divider line (dashed centre) ---
        ctx.setLineDash([10 / z, 6 / z]);
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 1.5 / z;
        ctx.beginPath();
        el.points.forEach((pt, i) => i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y));
        ctx.stroke();
        ctx.setLineDash([]);

        // --- Inner edge lines (solid) ---
        ctx.strokeStyle = 'rgba(255,255,255,0.22)';
        ctx.lineWidth = 1 / z;
        [laneLine.left, laneLine.right].forEach(edge => {
            ctx.beginPath();
            edge.forEach((pt, i) => i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y));
            ctx.stroke();
        });

        // --- Direction arrows along road ---
        for (let i = 1; i < el.points.length - 1; i += 2) {
            const p1 = el.points[i];
            const p2 = el.points[i + 1] || el.points[i];
            this.drawFlowArrow(ctx, p1.x, p1.y, p2.x, p2.y, 'rgba(255,255,255,0.45)', 5 / z);
        }

        // --- Name + width chip at midpoint ---
        const mid = el.points[Math.floor(el.points.length / 2)];
        this.drawChip(ctx, mid.x, mid.y - rw / 2 - 12 / z, `${el.name}  ·  ${rw}m`, roadColor, { size: 9, fill: 'rgba(8,12,22,0.9)' });

        // --- Engineering data below ---
        const lines = [];
        if (el.designSlope != null) lines.push({ text: `Long. slope ${el.designSlope}%`, color: 'rgba(232,234,237,0.5)', size: 8 });
        if (el.designLength != null) lines.push({ text: `Length ${el.designLength.toFixed(0)} m`, color: 'rgba(232,234,237,0.5)', size: 8 });
        this.drawLabelBlock(ctx, mid.x, mid.y + rw / 2 + 14 / z, lines);
    },

    exportDesignFor3D() {
        return {
            elements: this.elements,
            params: { ...this.designParams },
            profile: window._mapProfileData || null,
            mapElev: window._mapData?.elev || 100
        };
    },

    generateAutomatedDesign(clearExisting = true, silent = false) {
        const calc = window._calcResults;
        if (!calc) {
            if (!silent) alert('Run the Hydraulic Calculator first — auto-design needs flow rate, pipe size, slope, and material.');
            return false;
        }
        this.syncDesignParams();

        if (this.elements.length > 0 && !silent && !confirm('Generate automated road + drainage layout from your calculation data?')) {
            return false;
        }

        this.undoStack.push(JSON.stringify(this.elements));
        this.redoStack = [];
        this.elements = this.elements.filter(e => !e.autoGenerated);

        const p = this.designParams;
        const roadLength = Math.max(Math.sqrt(calc.area) * 4, 250);
        const roadWidth = p.roadWidth;
        const stations = Math.max(18, Math.min(36, Math.round(roadLength / 14)));
        const centerline = this.buildRoadCenterline(roadLength, stations);
        const offsets = this.offsetPolyline(centerline, roadWidth / 2 + 3);
        const drainLine = offsets.right;
        const layout = this.computeEngineeringLayout(calc, centerline, drainLine);
        const newElements = [];

        this.elementCounters.road++;
        newElements.push({
            type: 'road',
            x: centerline[0].x, y: centerline[0].y,
            points: centerline,
            roadWidth,
            layer: 'roads',
            color: '#94a3b8',
            width: 2,
            style: 'solid',
            name: `Road ${this.elementCounters.road}`,
            autoGenerated: true,
            designSlope: p.slopePct,
            designLength: roadLength
        });

        // Build a single connected, graded drainage trunk (catch pits + manholes + outlet)
        const network = this.buildDrainageNetwork(calc, drainLine, layout);
        newElements.push(...network.nodes, ...network.pipes);

        const halfW = roadLength / 2;
        const halfArea = Math.sqrt(calc.area) / 2;
        this.elementCounters.rect++;
        newElements.push({
            type: 'rectangle',
            x: -halfW - 10, y: centerline[0].y - halfArea - 20,
            x2: halfW + 10, y2: centerline[centerline.length - 1].y + halfArea + 20,
            layer: 'annotations',
            color: 'rgba(0,245,212,0.35)',
            width: 1,
            style: 'dashed',
            name: 'Catchment Boundary',
            autoGenerated: true
        });

        this.elementCounters.text++;
        newElements.push({
            type: 'text',
            x: -halfW, y: centerline[0].y - halfArea - 35,
            text: `AUTO DESIGN — Q=${calc.Q.toFixed(4)} m³/s | Ø${calc.pipeDia}mm ${calc.material} | Slope ${p.slopePct}% | V=${calc.V.toFixed(2)} m/s`,
            layer: 'annotations',
            color: '#00f5d4',
            name: 'Design Title',
            autoGenerated: true,
            fontSize: 16
        });

        if (p.location) {
            this.elementCounters.label++;
            newElements.push({
                type: 'label',
                x: -halfW, y: centerline[0].y - halfArea - 50,
                text: `${p.location} · ${p.soil}`,
                layer: 'annotations',
                color: '#f59e0b',
                name: 'Site Label',
                autoGenerated: true
            });
        }

        // --- Road shoulders (wider zone markings) ---
        const shoulderOff = this.offsetPolyline(centerline, roadWidth * 0.7);
        this.elementCounters.road++;
        newElements.push({
            type: 'road',
            x: shoulderOff.left[0].x, y: shoulderOff.left[0].y,
            points: shoulderOff.left,
            roadWidth: roadWidth * 0.15,
            layer: 'roads',
            color: 'rgba(200,200,200,0.3)',
            width: 1,
            style: 'dashed',
            name: `Shoulder L`,
            autoGenerated: true,
            designSlope: p.slopePct,
            designLength: roadLength
        });
        newElements.push({
            type: 'road',
            x: shoulderOff.right[0].x, y: shoulderOff.right[0].y,
            points: shoulderOff.right,
            roadWidth: roadWidth * 0.15,
            layer: 'roads',
            color: 'rgba(200,200,200,0.3)',
            width: 1,
            style: 'dashed',
            name: `Shoulder R`,
            autoGenerated: true,
            designSlope: p.slopePct,
            designLength: roadLength
        });

        // --- Drainage ditch V-markers along road edges ---
        const ditchSpacing = Math.max(3, Math.floor(centerline.length / 5));
        for (let i = 0; i < centerline.length; i += ditchSpacing) {
            const pt = centerline[i];
            const ditchSize = 5;
            for (const side of [-1, 1]) {
                const nx = side * (roadWidth * 0.5 + 5);
                const dx = pt.x + nx;
                const dy = pt.y;
                this.elementCounters.polyline++;
                newElements.push({
                    type: 'polyline',
                    x: dx - ditchSize, y: dy - ditchSize,
                    points: [{ x: dx - ditchSize, y: dy - ditchSize }, { x: dx, y: dy }, { x: dx + ditchSize, y: dy - ditchSize }],
                    layer: 'annotations',
                    color: 'rgba(0,245,212,0.4)',
                    width: 1,
                    style: 'solid',
                    name: `Ditch ${i}${side>0?'R':'L'}`,
                    autoGenerated: true
                });
            }
        }

        // --- Construction specification annotations ---
        this.elementCounters.text++;
        const specLines = [
            `PAVEMENT: ${roadWidth}m wide | Shoulder: ${(roadWidth*0.15).toFixed(1)}m each | Ditch: V-shape`,
            `MATERIALS: Base 300mm GSB | Sub-base 200mm GSB | Surfacing 50mm BC | Pipe Ø${calc.pipeDia}mm ${calc.material}`,
            `COMPACTION: 95% Std Proctor (base) | 97% (sub-base) | 98% (bitumen) | Cover min ${layout.minCover.toFixed(1)}m`
        ];
        specLines.forEach((line, li) => {
            newElements.push({
                type: 'text',
                x: -halfW, y: centerline[centerline.length-1].y + halfArea/2 + li * 14,
                text: line,
                layer: 'annotations',
                color: 'rgba(232,234,237,0.5)',
                name: `Construction Spec ${li+1}`,
                autoGenerated: true,
                fontSize: 8
            });
        });

        // --- Chainage (station) markers along road ---
        const chainageInterval = Math.max(3, Math.floor(centerline.length / 6));
        let chainDist = 0;
        for (let i = 0; i < centerline.length; i += chainageInterval) {
            const pt = centerline[i];
            const sd = layout.stationData[Math.min(i, layout.stationData.length-1)];
            const chainText = `CH ${chainDist.toFixed(0)}m${sd ? ` | RL ${sd.groundElev?.toFixed(2) ?? '?'}m` : ''}`;
            this.elementCounters.label++;
            newElements.push({
                type: 'label',
                x: pt.x, y: pt.y + roadWidth * 0.6 + 12,
                text: chainText,
                layer: 'annotations',
                color: 'rgba(245,158,11,0.6)',
                name: `Chainage ${i}`,
                autoGenerated: true
            });
            chainDist += roadLength / (Math.floor(centerline.length / chainageInterval) || 1);
        }

        // --- Cross-section indicator lines ---
        for (let i = 1; i < centerline.length - 1; i += chainageInterval) {
            const pt = centerline[i];
            const prev = centerline[Math.max(0, i-1)];
            const next = centerline[Math.min(centerline.length-1, i+1)];
            const dx = next.x - prev.x;
            const dy = next.y - prev.y;
            const len = Math.hypot(dx, dy) || 1;
            const perpX = -(dy/len) * roadWidth * 0.8;
            const perpY = (dx/len) * roadWidth * 0.8;
            this.elementCounters.polyline++;
            newElements.push({
                type: 'polyline',
                x: pt.x - perpX, y: pt.y - perpY,
                points: [{ x: pt.x - perpX, y: pt.y - perpY }, { x: pt.x + perpX, y: pt.y + perpY }],
                layer: 'dimensions',
                color: 'rgba(239,68,68,0.3)',
                width: 1,
                style: 'dashed',
                name: `XSect ${i}`,
                autoGenerated: true
            });
        }

        // --- Material legend box ---
        this.elementCounters.rect++;
        newElements.push({
            type: 'rectangle',
            x: -halfW, y: centerline[centerline.length-1].y + halfArea/2 - 20,
            x2: -halfW + 380, y2: centerline[centerline.length-1].y + halfArea/2 + 30,
            layer: 'annotations',
            color: 'rgba(255,255,255,0.08)',
            width: 0.5,
            style: 'solid',
            name: 'Spec Legend Box',
            autoGenerated: true
        });

        this.elements.push(...newElements);
        this.selectedElement = null;
        this.updateCount();
        this.fitToView();
        this.render();
        return true;
    },

    fitToView() {
        if (!this.elements.length) return;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        const expand = (x, y) => {
            minX = Math.min(minX, x); maxX = Math.max(maxX, x);
            minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        };
        for (const el of this.elements) {
            expand(el.x, el.y);
            if (el.x2 != null) expand(el.x2, el.y2);
            if (el.points) el.points.forEach(pt => expand(pt.x, pt.y));
        }
        const w = this.canvas.width / window.devicePixelRatio;
        const h = this.canvas.height / window.devicePixelRatio;
        const pad = 60;
        const bw = maxX - minX || 1;
        const bh = maxY - minY || 1;
        this.zoom = Math.min((w - pad * 2) / bw, (h - pad * 2) / bh, 5);
        this.panX = (w - (minX + maxX) * this.zoom) / 2;
        this.panY = (h - (minY + maxY) * this.zoom) / 2;
        const zl = document.getElementById('cadZoomLevel');
        if (zl) zl.textContent = Math.round(this.zoom * 100);
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
        if (this.elements.length > 0) {
            this.fitToView();
        } else {
            this.zoom = 1;
            this.panX = 0;
            this.panY = 0;
            document.getElementById('cadZoomLevel').textContent = '100';
        }
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
            const mw = this.marqueeEnd.x - this.marqueeStart.x;
            const mh = this.marqueeEnd.y - this.marqueeStart.y;
            if (mw < 0) {
                ctx.strokeStyle = '#22c55e';
                ctx.fillStyle = 'rgba(34, 197, 94, 0.1)';
            } else {
                ctx.strokeStyle = '#3b82f6';
                ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
            }
            ctx.fillRect(this.marqueeStart.x, this.marqueeStart.y, mw, mh);
            ctx.strokeRect(this.marqueeStart.x, this.marqueeStart.y, mw, mh);
            ctx.setLineDash([]);
        }

        // Draw temp drawing
        if (this.isDrawing) {
            this.drawTemp();
        }

        // Draw snap indicator
        this.drawSnapIndicator(ctx);

        ctx.restore();
    },

    drawSnapIndicator(ctx) {
        if (!this.drawEnd && !this.isDrawing) return;
        const pos = this.drawEnd || this.mousePos;
        if (!pos) return;
        const world = this.screenToWorld(this.mousePos.x, this.mousePos.y);
        const snapped = this.snap(world);

        if (snapped.type !== 'none') {
            const colors = { node: '#7b61ff', end: '#00f5d4', mid: '#f59e0b', grid: 'rgba(0,245,212,0.5)' };
            const labels = { node: 'Node', end: 'End', mid: 'Mid', grid: 'Grid' };
            const color = colors[snapped.type] || '#00f5d4';
            const label = labels[snapped.type] || '';

            // Snap crosshair
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.5 / this.zoom;
            ctx.setLineDash([4 / this.zoom, 4 / this.zoom]);
            ctx.beginPath();
            ctx.moveTo(snapped.x - 12 / this.zoom, snapped.y);
            ctx.lineTo(snapped.x + 12 / this.zoom, snapped.y);
            ctx.moveTo(snapped.x, snapped.y - 12 / this.zoom);
            ctx.lineTo(snapped.x, snapped.y + 12 / this.zoom);
            ctx.stroke();
            ctx.setLineDash([]);

            // Snap circle
            ctx.beginPath();
            ctx.arc(snapped.x, snapped.y, 5 / this.zoom, 0, Math.PI * 2);
            ctx.strokeStyle = color;
            ctx.lineWidth = 2 / this.zoom;
            ctx.stroke();

            // Snap label
            ctx.fillStyle = 'rgba(10,14,26,0.85)';
            ctx.strokeStyle = color;
            ctx.lineWidth = 1 / this.zoom;
            ctx.font = `bold ${8 / this.zoom}px Inter`;
            ctx.textAlign = 'center';
            const textW = ctx.measureText(label).width + 8 / this.zoom;
            ctx.fillRect(snapped.x - textW / 2, snapped.y - 20 / this.zoom, textW, 12 / this.zoom);
            ctx.strokeRect(snapped.x - textW / 2, snapped.y - 20 / this.zoom, textW, 12 / this.zoom);
            ctx.fillStyle = color;
            ctx.fillText(label, snapped.x, snapped.y - 12 / this.zoom);
        }
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
                this.drawSymbolPipe(ctx, el, selected);
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

            case 'road':
                this.drawSymbolRoad(ctx, el);
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
                this.drawSymbolManhole(ctx, el);
                break;

            case 'catchpit':
                this.drawSymbolCatchpit(ctx, el);
                break;

            case 'outlet':
                this.drawSymbolOutlet(ctx, el);
                break;

            case 'junction':
                this.drawSymbolJunction(ctx, el);
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

        if ((this.currentTool === 'polyline' || this.currentTool === 'road' || this.currentTool === 'angle') && this.tempPoints.length > 0) {
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
            } else if (el.type === 'polyline' || el.type === 'road') {
                if (el.points) {
                    for (let i = 0; i < el.points.length - 1; i++) {
                        dxf += `0\nLINE\n8\n${el.layer || '0'}\n10\n${el.points[i].x.toFixed(4)}\n20\n${el.points[i].y.toFixed(4)}\n11\n${el.points[i+1].x.toFixed(4)}\n21\n${el.points[i+1].y.toFixed(4)}\n`;
                    }
                }
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
    const cursors = { select: 'default', pan: 'grab', move: 'move', rotate: 'crosshair' };
    CAD.canvas.style.cursor = cursors[tool] || 'crosshair';

    // Update style inputs
    document.getElementById('propColor').value = CAD.lineColor;
    document.getElementById('propWidth').value = CAD.lineWidth;
    document.getElementById('propLineStyle').value = CAD.lineStyle;

    // Update active tool indicator
    const toolNames = {
        select: 'Select', pan: 'Pan', road: 'Road', pipe: 'Pipe', polyline: 'Polyline',
        arc: 'Arc', rectangle: 'Rectangle', manhole: 'Manhole', catchpit: 'Catch Pit',
        outlet: 'Outlet', junction: 'Junction', move: 'Move', rotate: 'Rotate',
        text: 'Text', dimension: 'Dimension', label: 'Label', measure: 'Measure', angle: 'Angle'
    };
    const toolHints = {
        select: 'Click to select, drag for marquee',
        pan: 'Drag to pan the canvas',
        road: 'Click points to draw, double-click to finish',
        pipe: 'Click start point, then end point',
        polyline: 'Click points to draw, double-click to finish',
        arc: 'Click 3 points to define arc',
        rectangle: 'Click corner, drag to opposite corner',
        manhole: 'Click to place manhole',
        catchpit: 'Click to place catch pit',
        outlet: 'Click to place outlet',
        junction: 'Click to place junction',
        move: 'Click element and drag to move',
        rotate: 'Click element to rotate 90°',
        text: 'Click to place text',
        dimension: 'Click two points to measure',
        label: 'Click to place label',
        measure: 'Click two points to measure distance',
        angle: 'Click 3 points to measure angle'
    };
    const nameEl = document.getElementById('cadActiveToolName');
    const hintEl = document.getElementById('cadActiveToolHint');
    const iconEl = document.getElementById('cadActiveToolIcon');
    if (nameEl) nameEl.textContent = toolNames[tool] || tool;
    if (hintEl) hintEl.textContent = toolHints[tool] || '';
    if (iconEl) iconEl.textContent = '▸';
}

function cadAutoGenerate() { CAD.generateAutomatedDesign(); }
function cadSyncDesignData() { CAD.syncDesignParams(); }
function cadSetRoadWidth(val) { CAD.roadWidth = Math.max(4, Math.min(20, parseFloat(val) || 8)); CAD.designParams.roadWidth = CAD.roadWidth; }

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
