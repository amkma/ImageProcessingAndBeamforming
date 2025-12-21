/**
 * Visualization Class - Encapsulates all Plotly visualization logic for multi-array support
 */
class Visualization {
    constructor(heatmapElementId, polarElementId) {
        this._heatmapDiv = document.getElementById(heatmapElementId);
        this._polarDiv = document.getElementById(polarElementId);
        this._colormap = 'Electric';
        this._extentX = 15; // Increased for multiple arrays
        this._extentY = 20;
        
        console.log('Visualization initialized with extents:', this.extents);

        this._initializePlots();
    }

    // Getters/Setters
    get colormap() { return this._colormap; }
    set colormap(value) {
        this._colormap = value;
        console.log(`Colormap set to: ${value}`);
    }

    get extents() {
        return { x: this._extentX, y: this._extentY };
    }

    set extents(value) {
        this._extentX = value.x;
        this._extentY = value.y;
        console.log(`Extents updated to: x=${this._extentX}, y=${this._extentY}`);
    }

    /**
     * Initialize both plots with empty data
     * @private
     */
    _initializePlots() {
        this._initializeHeatmap();
        this._initializePolar();
        console.log('Plots initialized');
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

        // Empty traces will be populated in update
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
            },
            name: 'Combined Field'
        }];

        Plotly.newPlot(this._heatmapDiv, data, layout, {
            responsive: true,
            displayModeBar: false
        });
        
        console.log('Heatmap plot initialized');
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

        const data = [{
            type: 'scatterpolar',
            mode: 'lines',
            fill: 'toself',
            r: [0],
            theta: [0],
            line: { color: '#ff9000', width: 2 },
            fillcolor: 'rgba(255, 144, 0, 0.2)',
            name: 'Combined Pattern'
        }];

        Plotly.newPlot(this._polarDiv, data, layout, {
            responsive: true,
            displayModeBar: false
        });
        
        console.log('Polar plot initialized');
    }

    /**
     * Update heatmap with combined data from all arrays
     * @param {object} heatmapData - {z, x, y} from ArrayManager
     * @param {object} antennaPositions - {x: [], y: [], colors: []} all antenna positions with colors
     */
    updateHeatmap(heatmapData, antennaPositions) {
        console.log('Updating heatmap with data:', {
            heatmapSize: `${heatmapData.z.length}x${heatmapData.z[0]?.length || 0}`,
            antennaCount: antennaPositions?.x?.length || 0
        });
        
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
            },
            name: 'Combined Field'
        }];

        // Add antenna markers with colors
        if (antennaPositions && antennaPositions.x && antennaPositions.x.length > 0) {
            // Group antennas by color for legend
            const colorGroups = {};
            antennaPositions.x.forEach((x, i) => {
                const color = antennaPositions.colors[i];
                if (!colorGroups[color]) {
                    colorGroups[color] = { x: [], y: [], names: [] };
                }
                colorGroups[color].x.push(x);
                colorGroups[color].y.push(antennaPositions.y[i]);
                colorGroups[color].names.push(`Antenna ${i}`);
            });

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

        Plotly.react(this._heatmapDiv, data, layout);
        console.log('Heatmap updated');
    }

    /**
     * Update polar plot with combined beam pattern
     * @param {object} beamData - {theta, r} from ArrayManager
     */
    updatePolar(beamData) {
        console.log('Updating polar plot with beam pattern data of length:', beamData.r.length);
        
        const data = [{
            type: 'scatterpolar',
            mode: 'lines',
            r: beamData.r,
            theta: beamData.theta,
            fill: 'toself',
            fillcolor: 'rgba(255, 144, 0, 0.2)',
            line: { color: '#ff9000', width: 2 },
            name: 'Combined Pattern'
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

        Plotly.react(this._polarDiv, data, layout);
        console.log('Polar plot updated');
    }

    /**
     * Update both plots simultaneously
     * @param {object} heatmapData - Heatmap data
     * @param {object} antennaPositions - Antenna positions with colors
     * @param {object} beamData - Beam pattern data
     */
    updateAll(heatmapData, antennaPositions, beamData) {
        console.log('Updating all visualizations...');
        this.updateHeatmap(heatmapData, antennaPositions);
        this.updatePolar(beamData);
        console.log('All visualizations updated');
    }

    /**
     * Resize plots (call on window resize)
     */
    resize() {
        Plotly.Plots.resize(this._heatmapDiv);
        Plotly.Plots.resize(this._polarDiv);
        console.log('Plots resized');
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
        console.log(`Heatmap exported as: ${filename}`);
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
        console.log(`Polar plot exported as: ${filename}`);
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
        console.log(`Both plots exported with base name: ${baseName}`);
    }
}