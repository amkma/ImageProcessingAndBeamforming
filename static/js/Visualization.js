/**
 * Visualization Class - Encapsulates all Plotly visualization logic for multi-array support
 */
class Visualization {
    constructor(heatmapElementId, polarElementId) {
        // Private properties with proper encapsulation
        this._heatmapDiv = document.getElementById(heatmapElementId);
        this._polarDiv = document.getElementById(polarElementId);
        this._colormap = 'Electric';
        this._extentX = 15;
        this._extentY = 20;

        // Validate DOM elements
        this._validateElements();

        console.log('Visualization initialized with extents:', this.extents);

        this._initialize();
    }

    // ==================== PUBLIC GETTERS AND SETTERS ====================

    get colormap() {
        return this._colormap;
    }

    set colormap(value) {
        const oldValue = this._colormap;
        this._colormap = value;

        if (oldValue !== value) {
            console.log(`Colormap changed from "${oldValue}" to "${value}"`);
            this._onColormapChanged();
        }
    }

    get extents() {
        return {
            x: this._extentX,
            y: this._extentY
        };
    }

    set extents(value) {
        const oldExtents = { x: this._extentX, y: this._extentY };
        this._extentX = value.x;
        this._extentY = value.y;

        if (oldExtents.x !== value.x || oldExtents.y !== value.y) {
            console.log(`Extents updated from x=${oldExtents.x}, y=${oldExtents.y} to x=${value.x}, y=${value.y}`);
            this._onExtentsChanged();
        }
    }

    get extentX() {
        return this._extentX;
    }

    set extentX(value) {
        const oldValue = this._extentX;
        this._extentX = value;

        if (oldValue !== value) {
            console.log(`Extent X changed from ${oldValue} to ${value}`);
            this._onExtentsChanged();
        }
    }

    get extentY() {
        return this._extentY;
    }

    set extentY(value) {
        const oldValue = this._extentY;
        this._extentY = value;

        if (oldValue !== value) {
            console.log(`Extent Y changed from ${oldValue} to ${value}`);
            this._onExtentsChanged();
        }
    }

    get heatmapDiv() {
        return this._heatmapDiv;
    }

    get polarDiv() {
        return this._polarDiv;
    }

    // ==================== PRIVATE METHODS ====================

    /**
     * Initialize the visualization
     * @private
     */
    _initialize() {
        this._initializePlots();
        console.log('Visualization fully initialized');
    }

    /**
     * Validate DOM elements exist
     * @private
     */
    _validateElements() {
        if (!this._heatmapDiv) {
            throw new Error(`Heatmap element with id "${heatmapElementId}" not found`);
        }

        if (!this._polarDiv) {
            throw new Error(`Polar element with id "${polarElementId}" not found`);
        }

        console.log('DOM elements validated');
    }

    /**
     * Handle colormap change
     * @private
     */
    _onColormapChanged() {
        // Colormap changes are applied on next heatmap update
        console.log('Colormap change noted, will apply on next update');
    }

    /**
     * Handle extents change
     * @private
     */
    _onExtentsChanged() {
        // Update axis ranges on next plot update
        console.log('Extents change noted, axis ranges will be updated');
    }

    /**
     * Initialize both plots with empty data
     * @private
     */
    _initializePlots() {
        this._initializeHeatmap();
        this._initializePolar();
        console.log('Both plots initialized');
    }

    /**
     * Initialize heatmap plot
     * @private
     */
    _initializeHeatmap() {
        const layout = this._createHeatmapLayout();
        const data = this._createHeatmapEmptyData();

        Plotly.newPlot(this._heatmapDiv, data, layout, {
            responsive: true,
            displayModeBar: false
        });

        console.log('Heatmap plot initialized');
    }

    /**
     * Create heatmap layout
     * @private
     * @returns {object} Layout configuration
     */
    _createHeatmapLayout() {
        return {
            margin: { t: 30, b: 30, l: 40, r: 10 },
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            xaxis: {
                title: 'X (m)',
                color: '#ff9000',
                range: [-this.extentX, this.extentX],
                showgrid: true,
                gridcolor: '#222',
                zeroline: true,
                zerolinecolor: '#444'
            },
            yaxis: {
                title: 'Y (m)',
                color: '#ff9000',
                range: [0, this.extentY],
                showgrid: true,
                gridcolor: '#222',
                zeroline: true,
                zerolinecolor: '#444'
            },
            font: { family: 'Inter, sans-serif', size: 11 },
            showlegend: true,
            legend: {
                x: 0.02,
                y: 0.98,
                bgcolor: 'rgba(0,0,0,0.7)',
                bordercolor: '#ff9000',
                borderwidth: 1,
                font: { color: '#ff9000', size: 10 }
            },
            hovermode: 'closest'
        };
    }

    /**
     * Create empty heatmap data
     * @private
     * @returns {Array} Empty data array
     */
    _createHeatmapEmptyData() {
        return [{
            z: [[0]],
            x: [0],
            y: [0],
            type: 'heatmap',
            colorscale: this.colormap,
            zsmooth: 'best',
            showscale: true,
            zauto: false,
            zmin: 0,
            zmax: 1,
            colorbar: {
                tickfont: { color: '#ff9000' },
                thickness: 10,
                title: 'Intensity'
            },
            name: 'Combined Field'
        }];
    }

    /**
     * Initialize polar plot
     * @private
     */
    _initializePolar() {
        const layout = this._createPolarLayout();
        const data = this._createPolarEmptyData();

        Plotly.newPlot(this._polarDiv, data, layout, {
            responsive: true,
            displayModeBar: false
        });

        console.log('Polar plot initialized');
    }

    /**
     * Create polar layout
     * @private
     * @returns {object} Layout configuration
     */
    _createPolarLayout() {
        return {
            margin: { t: 20, b: 20, l: 30, r: 30 },
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            font: { color: '#ff9000', family: 'Inter, sans-serif' },
            polar: {
                bgcolor: 'rgba(255, 255, 255, 0.05)',
                sector: [0, 180],
                radialaxis: {
                    visible: true,
                    showticklabels: false,
                    gridcolor: '#444',
                    range: [0, 1]
                },
                angularaxis: {
                    rotation: 0,
                    direction: "counterclockwise",
                    gridcolor: '#444',
                    tickcolor: '#ff9000',
                    tickvals: [0, 30, 60, 90, 120, 150, 180]
                }
            },
            showlegend: true,
            legend: {
                x: 1.1,
                y: 0.5,
                bgcolor: 'rgba(0,0,0,0.7)',
                bordercolor: '#ff9000',
                borderwidth: 1,
                font: { color: '#ff9000', size: 10 }
            }
        };
    }

    /**
     * Create empty polar data
     * @private
     * @returns {Array} Empty data array
     */
    _createPolarEmptyData() {
        return [{
            type: 'scatterpolar',
            mode: 'lines',
            fill: 'toself',
            r: [0],
            theta: [0],
            line: { color: '#ff9000', width: 2 },
            fillcolor: 'rgba(255, 144, 0, 0.2)',
            name: 'Combined Pattern'
        }];
    }

    // ==================== UPDATE METHODS ====================

    /**
     * Update heatmap with combined data from all arrays
     * @public
     * @param {object} heatmapData - {z, x, y} from ArrayManager
     * @param {object} antennaPositions - {x: [], y: [], colors: []} all antenna positions with colors
     */
    updateHeatmap(heatmapData, antennaPositions) {
        console.log('Updating heatmap with data:', {
            heatmapSize: `${heatmapData.z.length}x${heatmapData.z[0]?.length || 0}`,
            antennaCount: antennaPositions?.x?.length || 0
        });

        const data = this._createHeatmapData(heatmapData, antennaPositions);
        const layout = this._createHeatmapLayout();

        Plotly.react(this._heatmapDiv, data, layout);
        console.log('Heatmap updated successfully');
    }

    /**
     * Create heatmap data with antenna positions
     * @private
     * @param {object} heatmapData - Heatmap data
     * @param {object} antennaPositions - Antenna positions
     * @returns {Array} Complete data array
     */
    _createHeatmapData(heatmapData, antennaPositions) {
        const data = [{
            z: heatmapData.z,
            x: heatmapData.x,
            y: heatmapData.y,
            type: 'heatmap',
            colorscale: this.colormap,
            zsmooth: 'best',
            showscale: true,
            zauto: false,
            zmin: 0,
            zmax: 1,
            colorbar: {
                tickfont: { color: '#ff9000' },
                thickness: 10,
                title: 'Intensity'
            },
            name: 'Combined Field'
        }];

        // Add antenna markers if positions are provided
        if (antennaPositions && antennaPositions.x && antennaPositions.x.length > 0) {
            this._addAntennaMarkers(data, antennaPositions);
        }

        return data;
    }

    /**
     * Add antenna markers to heatmap data
     * @private
     * @param {Array} data - Data array to modify
     * @param {object} antennaPositions - Antenna positions with colors
     */
    _addAntennaMarkers(data, antennaPositions) {
        // Group antennas by color for legend
        const colorGroups = this._groupAntennasByColor(antennaPositions);

        // Add a trace for each color group
        Object.entries(colorGroups).forEach(([color, positions], index) => {
            data.push({
                x: positions.x,
                y: positions.y,
                mode: 'markers',
                type: 'scatter',
                marker: {
                    color: color,
                    size: 10,
                    symbol: 'circle',
                    line: { color: '#ffffff', width: 1.5 }
                },
                name: `Array ${index + 1} Antennas`,
                hovertemplate: '<b>Antenna</b><br>X: %{x:.3f} m<br>Y: %{y:.3f} m<extra></extra>',
                showlegend: true
            });
        });

        console.log(`Added ${Object.keys(colorGroups).length} antenna groups to heatmap`);
    }

    /**
     * Group antennas by color
     * @private
     * @param {object} antennaPositions - Antenna positions with colors
     * @returns {object} Grouped positions by color
     */
    _groupAntennasByColor(antennaPositions) {
        const colorGroups = {};

        antennaPositions.x.forEach((x, i) => {
            const color = antennaPositions.colors[i];
            if (!colorGroups[color]) {
                colorGroups[color] = { x: [], y: [] };
            }
            colorGroups[color].x.push(x);
            colorGroups[color].y.push(antennaPositions.y[i]);
        });

        return colorGroups;
    }

    /**
     * Update polar plot with combined beam pattern
     * @public
     * @param {object} beamData - {theta, r} from ArrayManager
     */
    updatePolar(beamData) {
        console.log('Updating polar plot with beam pattern data of length:', beamData.r.length);

        const data = this._createPolarData(beamData);
        const layout = this._createPolarLayout();

        Plotly.react(this._polarDiv, data, layout);
        console.log('Polar plot updated successfully');
    }

    /**
     * Create polar data from beam pattern
     * @private
     * @param {object} beamData - Beam pattern data
     * @returns {Array} Polar data array
     */
    _createPolarData(beamData) {
        return [{
            type: 'scatterpolar',
            mode: 'lines',
            r: beamData.r,
            theta: beamData.theta,
            fill: 'toself',
            fillcolor: 'rgba(255, 144, 0, 0.2)',
            line: { color: '#ff9000', width: 2 },
            name: 'Combined Pattern'
        }];
    }

    /**
     * Update both plots simultaneously
     * @public
     * @param {object} heatmapData - Heatmap data
     * @param {object} antennaPositions - Antenna positions with colors
     * @param {object} beamData - Beam pattern data
     */
    updateAll(heatmapData, antennaPositions, beamData) {
        console.log('Updating all visualizations...');
        this.updateHeatmap(heatmapData, antennaPositions);
        this.updatePolar(beamData);
        console.log('All visualizations updated successfully');
    }

    // ==================== UTILITY METHODS ====================

    /**
     * Resize plots (call on window resize)
     * @public
     */
    resize() {
        this._resizeHeatmap();
        this._resizePolar();
        console.log('Plots resized');
    }

    /**
     * Resize heatmap plot
     * @private
     */
    _resizeHeatmap() {
        Plotly.Plots.resize(this._heatmapDiv);
    }

    /**
     * Resize polar plot
     * @private
     */
    _resizePolar() {
        Plotly.Plots.resize(this._polarDiv);
    }

    // ==================== EXPORT METHODS ====================

    /**
     * Export heatmap as PNG
     * @public
     * @param {string} filename - Output filename
     */
    exportHeatmap(filename) {
        this._exportPlot(this._heatmapDiv, filename, 1200, 800);
        console.log(`Heatmap exported as: ${filename}`);
    }

    /**
     * Export polar plot as PNG
     * @public
     * @param {string} filename - Output filename
     */
    exportPolar(filename) {
        this._exportPlot(this._polarDiv, filename, 800, 800);
        console.log(`Polar plot exported as: ${filename}`);
    }

    /**
     * Export a plot as PNG
     * @private
     * @param {HTMLElement} plotDiv - Plot element
     * @param {string} filename - Output filename
     * @param {number} width - Image width
     * @param {number} height - Image height
     */
    _exportPlot(plotDiv, filename, width, height) {
        Plotly.downloadImage(plotDiv, {
            format: 'png',
            width: width,
            height: height,
            filename: filename
        });
    }

    /**
     * Export both plots
     * @public
     * @param {string} baseName - Base filename
     */
    exportBoth(baseName) {
        console.log(`Exporting both plots with base name: ${baseName}`);

        this.exportHeatmap(`${baseName}_heatmap`);

        // Delay second export to ensure first completes
        setTimeout(() => {
            this.exportPolar(`${baseName}_polar`);
        }, 500);

        console.log('Export process initiated');
    }
}