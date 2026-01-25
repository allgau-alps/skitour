
class ProfileRenderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.width = this.canvas.width;
        this.height = this.canvas.height;

        // Config
        this.margins = { top: 60, right: 180, bottom: 60, left: 60 }; // Increased right margin for tests
        this.graphWidth = this.width - this.margins.left - this.margins.right;
        this.graphHeight = this.height - this.margins.top - this.margins.bottom;

        // Scales
        this.maxDepth = 150; // Default max depth cm
    }

    render(data) {
        this.clear();
        this.drawBackground();
        this.drawAxes(data.layers);
        this.drawProfile(data.layers);
        this.drawTempProfile(data.layers);
        this.drawStabilityTests(data.tests || [], data.layers);
        this.drawMetadata(data.meta);
    }

    drawTempProfile(layers) {
        // Collect points from layers
        let currentDepth = 0;
        let points = [];

        layers.forEach(l => {
            if (l.temp !== "" && l.temp !== null && l.temp !== undefined) {
                points.push({ depth: currentDepth, temp: parseFloat(l.temp) });
            }
            currentDepth += (parseFloat(l.thickness) || 0);
        });

        // Force Ground Temp = 0 at Total Depth
        const totalHeight = layers.reduce((acc, l) => acc + (parseFloat(l.thickness) || 0), 0);
        points.push({ depth: totalHeight, temp: 0 });

        if (!points.length) return;

        // Temp Axis Config
        // Range: -20 to 0 (Standard)
        const minTemp = -20;
        const maxTemp = 0;
        const tempWidth = this.graphWidth;

        // Calculate scale
        const pxPerTemp = tempWidth / Math.abs(minTemp - maxTemp);

        // Draw Line
        this.ctx.beginPath();
        this.ctx.strokeStyle = '#ef4444';
        this.ctx.lineWidth = 2;

        const pxPerCm = this.graphHeight / this.maxHeight; // From height axis logic

        // Prepare coords for drawing
        const drawPoints = points.map(p => {
            // Height from ground = TotalHeight - DepthFromSurface
            const heightFromGround = totalHeight - p.depth;
            const x = this.margins.left + ((p.temp - minTemp) * pxPerTemp);
            const y = (this.height - this.margins.bottom) - (heightFromGround * pxPerCm);
            return { x, y, temp: p.temp };
        });

        drawPoints.forEach((p, i) => {
            if (i === 0) this.ctx.moveTo(p.x, p.y);
            else this.ctx.lineTo(p.x, p.y);
        });
        this.ctx.stroke();

        // Draw small circles and value labels
        drawPoints.forEach(p => {
            // Dot
            this.ctx.beginPath();
            this.ctx.fillStyle = '#ef4444';
            this.ctx.arc(p.x, p.y, 3, 0, 2 * Math.PI);
            this.ctx.fill();

            // Text Value
            this.ctx.fillStyle = '#ef4444';
            this.ctx.font = 'bold 10px Arial';
            this.ctx.textAlign = 'left';
            // Offset text slightly so it doesn't cover the line
            this.ctx.fillText(p.temp, p.x + 5, p.y);
        });
    }

    drawStabilityTests(tests, layers) {
        if (!tests || !tests.length) return;

        // Tests need Y coordinate.
        // Input "depth" is treated as Height (cm) from ground based on context.
        const pxPerCm = this.graphHeight / this.maxHeight;

        this.ctx.textAlign = 'left';
        this.ctx.font = '12px Arial';
        this.ctx.fillStyle = '#000';

        tests.forEach(test => {
            const h = parseFloat(test.depth) || 0; // Interpreting input 'depth' as height from ground
            const y = (this.height - this.margins.bottom) - (h * pxPerCm);
            const xRight = this.margins.left + this.graphWidth;

            // Draw Arrow Line
            this.ctx.beginPath();
            this.ctx.strokeStyle = '#000';
            this.ctx.moveTo(xRight + 5, y);
            this.ctx.lineTo(xRight + 30, y);
            this.ctx.stroke();

            // Arrow head
            this.ctx.beginPath();
            this.ctx.moveTo(xRight + 5, y);
            this.ctx.lineTo(xRight + 12, y - 3);
            this.ctx.lineTo(xRight + 12, y + 3);
            this.ctx.fill();

            // Text
            const textX = xRight + 35;
            this.ctx.font = 'bold 12px Arial';
            this.ctx.fillText(`${test.result} @ ${h}cm`, textX, y - 2);

            if (test.desc) {
                this.ctx.font = '12px Arial';
                this.ctx.fillText(test.desc, textX, y + 12);
            }
        });
    }

    drawMetadata(meta) {
        this.ctx.fillStyle = '#000';
        this.ctx.textAlign = 'left';
        this.ctx.font = 'bold 16px Arial';
        this.ctx.fillText(meta.location || 'Unknown Location', this.margins.left, 30);

        this.ctx.font = '14px Arial';
        let subText = `Date: ${meta.date || '-'}`;
        if (meta.elevation) subText += ` | Elev: ${meta.elevation}m`;
        if (meta.aspect) subText += ` | Asp: ${meta.aspect}`;

        this.ctx.fillText(subText, this.margins.left, 50);

        // Line 2
        let subText2 = '';
        if (meta.observer) subText2 += `Observer: ${meta.observer}`;
        if (meta.airTemp) subText2 += ` | Air Temp: ${meta.airTemp}°C`;

        if (subText2) {
            this.ctx.fillText(subText2, this.margins.left + 400, 50); // Right align ish?
        }
    }

    clear() {
        this.ctx.fillStyle = "white";
        this.ctx.fillRect(0, 0, this.width, this.height);
    }

    drawBackground() {
        // Optional grid lines
    }

    drawAxes(layers) {
        // AXIS LOGIC FLIP: 0 at Bottom (Ground), Max Height at Top (Surface/H.S.)
        const totalHeight = layers.reduce((acc, l) => acc + (parseFloat(l.thickness) || 0), 0);
        this.maxHeight = Math.max(100, Math.ceil(totalHeight / 50) * 50);

        this.ctx.beginPath();
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 2;

        // Left Axis (Height/Depth)
        this.ctx.moveTo(this.margins.left, this.margins.top);
        this.ctx.lineTo(this.margins.left, this.height - this.margins.bottom);

        // Bottom Axis (Hardness)
        this.ctx.moveTo(this.margins.left, this.height - this.margins.bottom);
        this.ctx.lineTo(this.width - this.margins.right, this.height - this.margins.bottom);

        this.ctx.stroke();

        // Hardness Labels
        const hardnessLevels = ['F', '4F', '1F', 'P', 'K', 'I'];
        const stepX = this.graphWidth / hardnessLevels.length;

        this.ctx.textAlign = 'center';
        this.ctx.font = '14px Arial';
        this.ctx.fillStyle = '#000';

        hardnessLevels.forEach((h, i) => {
            const x = this.margins.left + (i * stepX) + (stepX / 2);
            const y = this.height - this.margins.bottom + 25;
            this.ctx.fillText(h, x, y);

            // vertical grid line light
            this.ctx.beginPath();
            this.ctx.strokeStyle = '#eee';
            this.ctx.moveTo(this.margins.left + ((i + 1) * stepX), this.margins.top);
            this.ctx.lineTo(this.margins.left + ((i + 1) * stepX), this.height - this.margins.bottom);
            this.ctx.stroke();
        });

        // Height Labels (0 at bottom)
        this.ctx.textAlign = 'right';
        this.ctx.textBaseline = 'middle';

        const cmStep = 20;
        const pxPerCm = this.graphHeight / this.maxHeight;

        for (let h = 0; h <= this.maxHeight; h += cmStep) {
            // Y coordinate for height h. 
            // h=0 is at bottom (this.height - this.margins.bottom)
            const y = (this.height - this.margins.bottom) - (h * pxPerCm);

            this.ctx.fillText(h, this.margins.left - 10, y);

            this.ctx.beginPath();
            this.ctx.strokeStyle = '#eee';
            this.ctx.moveTo(this.margins.left, y);
            this.ctx.lineTo(this.width - this.margins.right, y);
            this.ctx.stroke();
        }

        // Label Axes
        this.ctx.save();
        this.ctx.translate(20, this.height / 2);
        this.ctx.rotate(-Math.PI / 2);
        this.ctx.textAlign = 'center';
        this.ctx.fillText("Height (cm)", 0, 0);
        this.ctx.restore();
    }

    drawProfile(layers) {
        if (!layers.length) return;

        const hardnessMap = { 'F': 1, '4F': 2, '1F': 3, 'P': 4, 'K': 5, 'I': 6 };
        const stepX = this.graphWidth / 6;
        const pxPerCm = this.graphHeight / this.maxHeight;

        // Draw from Top down (Surface is Total Height)
        // Assume Layer 0 is Top (Surface) -> Height decreases by thickness

        let currentHeight = layers.reduce((acc, l) => acc + (parseFloat(l.thickness) || 0), 0);

        this.ctx.fillStyle = '#eff6ff';
        this.ctx.strokeStyle = '#0284c7';
        this.ctx.lineWidth = 2;

        let pathPoints = [];

        layers.forEach((layer, index) => {
            const hVal = hardnessMap[layer.hardness] || 0;
            const thickness = parseFloat(layer.thickness) || 0;

            const x = this.margins.left + (hVal * stepX);

            // Y positions (Bottom is 0)
            const topY = (this.height - this.margins.bottom) - (currentHeight * pxPerCm);
            const bottomY = (this.height - this.margins.bottom) - ((currentHeight - thickness) * pxPerCm);

            // Add points
            if (index === 0) {
                pathPoints.push({ x: this.margins.left, y: topY }); // Close to axis
                pathPoints.push({ x: x, y: topY });                 // Out to hardness
            } else {
                pathPoints.push({ x: x, y: topY });
            }
            pathPoints.push({ x: x, y: bottomY });

            // Draw Grain Form Symbol
            if (layer.grainForm) {
                this.ctx.save();
                this.ctx.fillStyle = '#000';
                this.ctx.textAlign = 'left';
                this.ctx.font = '20px Segoe UI Symbol, Arial';
                // Center in layer
                const midY = topY + (bottomY - topY) / 2;
                this.ctx.fillText(layer.grainForm, x + 10, midY + 6);
                this.ctx.restore();
            }

            currentHeight -= thickness; // Go down
        });

        // Close path to bottom axis
        pathPoints.push({ x: this.margins.left, y: (this.height - this.margins.bottom) }); // Close at axis 0

        // Draw Fill
        this.ctx.beginPath();
        this.ctx.moveTo(pathPoints[0].x, pathPoints[0].y); // Start top left
        pathPoints.forEach(p => this.ctx.lineTo(p.x, p.y));
        this.ctx.lineTo(this.margins.left, pathPoints[pathPoints.length - 1].y);
        this.ctx.closePath();

        this.ctx.fillStyle = 'rgba(2, 132, 199, 0.2)';
        this.ctx.fill();

        // Draw Stroke
        this.ctx.beginPath();
        pathPoints.forEach((p, i) => {
            if (i === 0) this.ctx.moveTo(p.x, p.y);
            else this.ctx.lineTo(p.x, p.y);
        });
        this.ctx.stroke();
    }
}
