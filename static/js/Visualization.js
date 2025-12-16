/**
 * Visualization Class - Encapsulates all Plotly visualization logic
 * Handles plot creation, updates, and styling
 */
class Visualization {
    constructor(heatmapElementId, polarElementId) {
        this._heatmapDiv = document.getElementById(heatmapElementId);
        this._polarDiv = document.getElementById(polarElementId);
        this._colormap = 'Electric';
        this._extentX = 10;
        this._extentY = 20;

        this._initializePlots();
    }

    // Getters/Setters
    get colormap() { return this._colormap; }
    set colormap(value) {
        this._colormap = value;
    }

    get extents() {
        return { x: this._extentX, y: this._extentY };
    }

    set extents(value) {
        this._extentX = value.x;
        this._extentY = value.y;
    }

    /**
     * Initialize both plots with empty data
     * @private
     */
    _initializePlots() {
        this._initializeHeatmap();
        this._initializePolar();
    }

    /**
     * Initialize heatmap plot
     * @private
     */
    _initializeHeatmap() {
        const layout = {
            margin: { t: 30, b: 30, l: 40, r: 10 },
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            xaxis: {
                title: 'X (m)',
                color: '#ff9000',
                range: [-this._extentX, this._extentX],
                showgrid: true,
                gridcolor: '#222',
                zeroline: true,
                zerolinecolor: '#444'
            },
            yaxis: {
                title: 'Y (m)',
                color: '#ff9000',
                range: [0, this._extentY],
                showgrid: true,
                gridcolor: '#222',
                zeroline: true,
                zerolinecolor: '#444'
            },
            font: { family: 'Inter, sans-serif', size: 11 },
            showlegend: false,
            hovermode: 'closest'
        };

        const data = [{
            z: [[0]],
            x: [0],
            y: [0],
            type: 'heatmap',
            colorscale: this._colormap,
            zsmooth: 'best',
            showscale: true,
            zauto: false,
            zmin: 0,
            zmax: 1,
            colorbar: {
                tickfont: { color: '#ff9000' },
                thickness: 10,
                title: 'Intensity'
            }
        }, {
            x: [0],
            y: [0],
            mode: 'markers',
            type: 'scatter',
            marker: {
                color: '#00ff90',
                size: 14,
                symbol: 'circle',
                line: { color: '#ffffff', width: 2 }
            },
            name: 'Antennas',
            hovertemplate: '<b>Antenna</b><br>X: %{x:.3f} m<br>Y: %{y:.3f} m<extra></extra>'
        }];

        Plotly.newPlot(this._heatmapDiv, data, layout, {
            responsive: true,
            displayModeBar: false
        });
    }

    /**
     * Initialize polar plot
     * @private
     */
    _initializePolar() {
        const layout = {
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
            }
        };

        const data = [{
            type: 'scatterpolar',
            mode: 'lines',
            fill: 'toself',
            r: [0],
            theta: [0],
            line: { color: '#ff9000', width: 2 },
            fillcolor: 'rgba(255, 144, 0, 0.2)'
        }];

        Plotly.newPlot(this._polarDiv, data, layout, {
            responsive: true,
            displayModeBar: false
        });
    }

    /**
     * Update heatmap with new data
     * @param {object} heatmapData - {z, x, y} from PhasedArray
     * @param {object} antennaPositions - {x: [], y: []} antenna positions
     */
    updateHeatmap(heatmapData, antennaPositions) {
        const data = [{
            z: heatmapData.z,
            x: heatmapData.x,
            y: heatmapData.y,
            type: 'heatmap',
            colorscale: this._colormap,
            zsmooth: 'best',
            showscale: true,
            zauto: false,
            zmin: 0,
            zmax: 1,
            colorbar: {
                tickfont: { color: '#ff9000' },
                thickness: 10,
                title: 'Intensity'
            }
        }, {
            x: antennaPositions.x,
            y: antennaPositions.y,
            mode: 'markers',
            type: 'scatter',
            marker: {
                color: '#00ff90',
                size: 14,
                symbol: 'circle',
                line: { color: '#ffffff', width: 2 }
            },
            name: 'Antennas',
            hovertemplate: '<b>Antenna</b><br>X: %{x:.3f} m<br>Y: %{y:.3f} m<extra></extra>'
        }];

        const layout = {
            margin: { t: 30, b: 30, l: 40, r: 10 },
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            xaxis: {
                title: 'X (m)',
                color: '#ff9000',
                range: [-this._extentX, this._extentX],
                showgrid: true,
                gridcolor: '#222',
                zeroline: true,
                zerolinecolor: '#444'
            },
            yaxis: {
                title: 'Y (m)',
                color: '#ff9000',
                range: [0, this._extentY],
                showgrid: true,
                gridcolor: '#222',
                zeroline: true,
                zerolinecolor: '#444'
            },
            font: { family: 'Inter, sans-serif', size: 11 },
            showlegend: false,
            hovermode: 'closest'
        };

        Plotly.react(this._heatmapDiv, data, layout);
    }

    /**
     * Update polar plot with new beam pattern
     * @param {object} beamData - {theta, r} from PhasedArray
     */
    updatePolar(beamData) {
        const data = [{
            type: 'scatterpolar',
            mode: 'lines',
            r: beamData.r,
            theta: beamData.theta,
            fill: 'toself',
            fillcolor: 'rgba(255, 144, 0, 0.2)',
            line: { color: '#ff9000', width: 2 }
        }];

        const layout = {
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
            }
        };

        Plotly.react(this._polarDiv, data, layout);
    }

    /**
     * Update both plots simultaneously
     * @param {object} heatmapData - Heatmap data
     * @param {object} antennaPositions - Antenna positions
     * @param {object} beamData - Beam pattern data
     */
    updateAll(heatmapData, antennaPositions, beamData) {
        this.updateHeatmap(heatmapData, antennaPositions);
        this.updatePolar(beamData);
    }

    /**
     * Resize plots (call on window resize)
     */
    resize() {
        Plotly.Plots.resize(this._heatmapDiv);
        Plotly.Plots.resize(this._polarDiv);
    }

    /**
     * Export heatmap as PNG
     * @param {string} filename - Output filename
     */
    exportHeatmap(filename) {
        Plotly.downloadImage(this._heatmapDiv, {
            format: 'png',
            width: 1200,
            height: 800,
            filename: filename
        });
    }

    /**
     * Export polar plot as PNG
     * @param {string} filename - Output filename
     */
    exportPolar(filename) {
        Plotly.downloadImage(this._polarDiv, {
            format: 'png',
            width: 800,
            height: 800,
            filename: filename
        });
    }

    /**
     * Export both plots
     * @param {string} baseName - Base filename
     */
    exportBoth(baseName) {
        this.exportHeatmap(baseName + '_heatmap');
        setTimeout(() => {
            this.exportPolar(baseName + '_polar');
        }, 500);
    }
}