import numpy as np
from typing import List, Dict, Tuple, Optional
import json
import os
from dataclasses import dataclass, field
from enum import Enum
import math


class ArrayGeometry(Enum):
    LINEAR = "linear"
    CURVED = "curved"
    CIRCULAR = "circular"
    RECTANGULAR = "rectangular"


class PhaseProfile(Enum):
    LINEAR = "linear"
    QUADRATIC = "quadratic"
    CUSTOM = "custom"
    RANDOM = "random"


@dataclass
class ArrayElement:
    """Represents a single antenna element in the array"""
    index: int
    position_x: float = 0.0  # in meters
    position_y: float = 0.0  # in meters
    phase: float = 0.0  # in degrees
    amplitude: float = 1.0
    frequency: float = 0.0  # Specific frequency for this element (0 = use array default)
    delay: float = 0.0  # in seconds
    is_active: bool = True

    def to_dict(self) -> Dict:
        return {
            'index': self.index,
            'position': [self.position_x, self.position_y],
            'phase': self.phase,
            'amplitude': self.amplitude,
            'frequency': self.frequency,
            'delay': self.delay,
            'is_active': self.is_active
        }

    @classmethod
    def from_dict(cls, data: Dict) -> 'ArrayElement':
        pos = data.get('position', [0.0, 0.0])
        return cls(
            index=data['index'],
            position_x=pos[0],
            position_y=pos[1],
            phase=data.get('phase', 0.0),
            amplitude=data.get('amplitude', 1.0),
            frequency=data.get('frequency', 0.0),
            delay=data.get('delay', 0.0),
            is_active=data.get('is_active', True)
        )


@dataclass
class PhasedArray:
    """Represents a phased array configuration with CORRECTED physics"""
    name: str = "Array 1"
    id: int = 0
    geometry: ArrayGeometry = ArrayGeometry.LINEAR
    num_elements: int = 8
    element_spacing: float = 0.15  # in meters (NOT wavelengths!)
    curvature: float = 1.0  # for curved arrays
    frequency: float = 2400000000.0  # Base frequency in Hz
    propagation_speed: float = 3e8  # Speed of propagation (m/s) - changes per scenario
    position_x: float = 0.0  # in meters
    position_y: float = 0.0  # in meters
    rotation: float = 0.0  # in degrees
    steering_angle: float = 0.0  # in degrees
    focus_distance: float = 5.0  # in meters
    beam_width: float = 30.0  # in degrees
    phase_profile: PhaseProfile = PhaseProfile.LINEAR
    phase_slope: float = 0.0  # degrees per element
    apply_delays: bool = False
    elements: List[ArrayElement] = field(default_factory=list)

    def __post_init__(self):
        if not self.elements:
            self.initialize_elements()

    def initialize_elements(self):
        """Initialize array elements based on geometry"""
        self.elements = []

        for i in range(self.num_elements):
            element = ArrayElement(index=i, frequency=self.frequency)

            # Calculate position based on geometry (centered around 0)
            if self.geometry == ArrayGeometry.LINEAR:
                # Linear spacing along X axis in METERS
                total_width = (self.num_elements - 1) * self.element_spacing
                pos = -total_width / 2 + i * self.element_spacing
                element.position_x = pos
                element.position_y = 0

            elif self.geometry == ArrayGeometry.CURVED:
                # Curved array with parabolic curvature
                total_width = (self.num_elements - 1) * self.element_spacing
                x_pos = -total_width / 2 + i * self.element_spacing
                element.position_x = x_pos
                # Parabolic curvature: y = c * x^2
                element.position_y = self.curvature * (x_pos ** 2)

            elif self.geometry == ArrayGeometry.CIRCULAR:
                radius = (self.num_elements * self.element_spacing) / (2 * math.pi)
                circle_angle = (i / self.num_elements) * 2 * math.pi
                element.position_x = radius * math.cos(circle_angle)
                element.position_y = radius * math.sin(circle_angle)

            elif self.geometry == ArrayGeometry.RECTANGULAR:
                rows = int(math.sqrt(self.num_elements))
                cols = self.num_elements // rows
                row = i // cols
                col = i % cols
                element.position_x = (col - (cols - 1) / 2) * self.element_spacing
                element.position_y = (row - (rows - 1) / 2) * self.element_spacing

            # Apply rotation
            if self.rotation != 0:
                angle_rad = math.radians(self.rotation)
                x_rot = element.position_x * math.cos(angle_rad) - element.position_y * math.sin(angle_rad)
                y_rot = element.position_x * math.sin(angle_rad) + element.position_y * math.cos(angle_rad)
                element.position_x = x_rot
                element.position_y = y_rot

            # Apply array position offset
            element.position_x += self.position_x
            element.position_y += self.position_y

            self.elements.append(element)

    def calculate_phases(self):
        """Calculate phase shifts for all elements using CORRECTED physics"""
        for i, element in enumerate(self.elements):
            # Use specific element frequency if set, otherwise base
            freq = element.frequency if element.frequency > 0 else self.frequency
            wavelength = self.propagation_speed / freq if freq > 0 else 1.0
            k = 2 * np.pi / wavelength

            if self.phase_profile == PhaseProfile.LINEAR:
                # Linear phase progression
                pos_idx = (i - (self.num_elements - 1) / 2)
                element.phase = pos_idx * self.phase_slope

            elif self.phase_profile == PhaseProfile.QUADRATIC:
                # Focusing phase
                dx = element.position_x - self.position_x
                dy = element.position_y - self.position_y
                dist_to_focus = math.sqrt(dx ** 2 + (self.focus_distance - dy) ** 2)
                element.phase = (360 * dist_to_focus / wavelength) % 360

            elif self.phase_profile == PhaseProfile.RANDOM:
                element.phase = np.random.uniform(-180, 180)

            # Apply steering angle (beamforming delay) - CORRECTED FORMULA
            if self.steering_angle != 0:
                steering_rad = math.radians(self.steering_angle)
                # Phase shift for steering: k * position · steering_direction
                # For standard convention: steering along x-axis
                delay_phase = k * element.position_x * math.sin(steering_rad)
                element.phase -= math.degrees(delay_phase)

            # Normalize to [-180, 180]
            while element.phase > 180: element.phase -= 360
            while element.phase < -180: element.phase += 360

    def calculate_beam_pattern(self, angles: np.ndarray) -> np.ndarray:
        """Calculate far-field beam pattern - CORRECTED Array Factor"""
        angles_rad = np.radians(angles)
        pattern = np.zeros_like(angles, dtype=complex)

        max_frequency = max(e.frequency if e.frequency > 0 else self.frequency
                            for e in self.elements)

        for element in self.elements:
            if not element.is_active:
                continue

            freq = element.frequency if element.frequency > 0 else self.frequency
            k = 2 * np.pi * freq / self.propagation_speed

            # CORRECTED: Frequency normalization for multi-frequency arrays
            frequency_scaling = freq / max_frequency

            # Element position in polar coordinates
            r = np.sqrt(element.position_x ** 2 + element.position_y ** 2)
            theta_element = np.arctan2(element.position_y, element.position_x)

            # Array Factor: phase contribution from position and element phase
            # Standard convention: theta=0 is broadside (y-axis)
            phase_contribution = -k * r * np.cos(angles_rad - theta_element) + np.radians(element.phase)

            # Add contribution with frequency scaling
            pattern += frequency_scaling * element.amplitude * np.exp(1j * phase_contribution)

        return np.abs(pattern)

    def calculate_field_at_point(self, x: float, y: float) -> complex:
        """Calculate near-field at a point - CORRECTED wave propagation"""
        total_field = 0j
        max_frequency = max(e.frequency if e.frequency > 0 else self.frequency
                            for e in self.elements)

        for element in self.elements:
            if not element.is_active:
                continue

            freq = element.frequency if element.frequency > 0 else self.frequency
            k = 2 * np.pi * freq / self.propagation_speed

            dx = x - element.position_x
            dy = y - element.position_y
            distance = math.sqrt(dx * dx + dy * dy)

            # Avoid singularity
            if distance < 1e-6:
                distance = 1e-6

            # CORRECTED: Frequency-scaled contribution
            frequency_scaling = freq / max_frequency
            phase_rad = np.radians(element.phase)

            # Near-field: (A/√r) * exp(j(kr + φ)) with frequency scaling
            field_val = (frequency_scaling * element.amplitude / math.sqrt(distance)) * \
                        np.exp(1j * (k * distance + phase_rad))

            total_field += field_val

        return total_field

    def calculate_heatmap(self, x_range, y_range, resolution) -> np.ndarray:
        """Calculate field intensity heatmap - OPTIMIZED and CORRECTED"""
        xs = np.linspace(x_range[0], x_range[1], resolution)
        ys = np.linspace(y_range[0], y_range[1], resolution)

        # Pre-calculate element parameters
        active_elements = [e for e in self.elements if e.is_active]
        max_frequency = max(e.frequency if e.frequency > 0 else self.frequency
                            for e in active_elements) if active_elements else self.frequency

        element_params = []
        for e in active_elements:
            f = e.frequency if e.frequency > 0 else self.frequency
            k = 2 * np.pi * f / self.propagation_speed
            freq_scaling = f / max_frequency
            rad_phase = np.radians(e.phase)
            element_params.append((e.position_x, e.position_y, e.amplitude,
                                   k, rad_phase, freq_scaling))

        # Vectorized calculation
        xv, yv = np.meshgrid(xs, ys)
        total_field = np.zeros_like(xv, dtype=complex)

        for px, py, amp, k, phi, freq_scale in element_params:
            dx = xv - px
            dy = yv - py
            dist = np.sqrt(dx ** 2 + dy ** 2)
            dist[dist < 1e-6] = 1e-6

            # CORRECTED: Sum of waves with frequency scaling
            # E = (freq_scale * A / √r) * exp(j(kr + φ))
            total_field += (freq_scale * amp / np.sqrt(dist)) * np.exp(1j * (k * dist + phi))

        # Return absolute value (wave intensity)
        return np.abs(total_field)

    def calculate_beam_metrics(self) -> Dict:
        """Calculate beam pattern metrics"""
        # Calculate basic metrics
        angles = np.linspace(-180, 180, 360)
        pattern = self.calculate_beam_pattern(angles)
        pattern_db = 20 * np.log10(pattern / np.max(pattern) + 1e-10)

        # Find main lobe
        max_idx = np.argmax(pattern)
        main_lobe_angle = angles[max_idx]

        # Find -3dB beamwidth
        half_power = np.max(pattern_db) - 3
        above_half = pattern_db > half_power

        # Simple beamwidth calculation
        beamwidth = np.sum(above_half) * (360 / len(angles))

        # Estimate directivity (in dB)
        directivity = 10 * math.log10(self.num_elements) if self.num_elements > 0 else 0

        return {
            'main_lobe_angle': main_lobe_angle,
            'beamwidth': beamwidth,
            'sidelobe_level': -13.5,  # Typical value
            'directivity': directivity,
            'max_intensity': float(np.max(pattern))
        }

    def to_dict(self) -> Dict:
        """Convert array to dictionary"""
        return {
            'name': self.name,
            'id': self.id,
            'geometry': self.geometry.value,
            'num_elements': self.num_elements,
            'element_spacing': self.element_spacing,
            'curvature': self.curvature,
            'frequency': self.frequency,
            'propagation_speed': self.propagation_speed,
            'position': [self.position_x, self.position_y],
            'rotation': self.rotation,
            'steering_angle': self.steering_angle,
            'focus_distance': self.focus_distance,
            'beam_width': self.beam_width,
            'phase_profile': self.phase_profile.value,
            'phase_slope': self.phase_slope,
            'apply_delays': self.apply_delays,
            'elements': [element.to_dict() for element in self.elements]
        }

    @classmethod
    def from_dict(cls, data: Dict) -> 'PhasedArray':
        """Create array from dictionary"""
        pos = data.get('position', [0.0, 0.0])
        array = cls(
            name=data.get('name', 'Array'),
            id=data.get('id', 0),
            geometry=ArrayGeometry(data.get('geometry', 'linear')),
            num_elements=int(data.get('num_elements', 8)),
            element_spacing=float(data.get('element_spacing', 0.15)),
            curvature=float(data.get('curvature', 1.0)),
            frequency=float(data.get('frequency', 2.4e9)),
            propagation_speed=float(data.get('propagation_speed', 3e8)),
            position_x=pos[0],
            position_y=pos[1],
            rotation=float(data.get('rotation', 0.0)),
            steering_angle=float(data.get('steering_angle', 0.0)),
            focus_distance=float(data.get('focus_distance', 5.0)),
            beam_width=float(data.get('beam_width', 30.0)),
            phase_profile=PhaseProfile(data.get('phase_profile', 'linear')),
            phase_slope=float(data.get('phase_slope', 0.0)),
            apply_delays=bool(data.get('apply_delays', False))
        )

        if 'elements' in data:
            array.elements = [ArrayElement.from_dict(e) for e in data['elements']]
        else:
            array.initialize_elements()

        return array


class BeamformingSimulator:
    """Manages multiple phased arrays"""

    def __init__(self):
        self.arrays: List[PhasedArray] = []
        self.scenarios: Dict[str, Dict] = {}
        self.current_array_index: int = 0
        self.load_predefined_scenarios()

    def load_predefined_scenarios(self):
        """Load scenario JSON files"""
        current_dir = os.path.dirname(os.path.abspath(__file__))
        scenarios_dir = os.path.join(current_dir, 'scenarios')

        if not os.path.exists(scenarios_dir):
            try:
                os.makedirs(scenarios_dir)
            except OSError:
                pass

        if os.path.exists(scenarios_dir):
            for filename in os.listdir(scenarios_dir):
                if filename.endswith('.json'):
                    try:
                        file_path = os.path.join(scenarios_dir, filename)
                        with open(file_path, 'r') as f:
                            data = json.load(f)
                            scenario_id = filename[:-5].lower()
                            data['id'] = 0
                            self.scenarios[scenario_id] = data
                    except Exception as e:
                        print(f"Error loading {filename}: {e}")

    def create_array(self, config: Optional[Dict] = None) -> PhasedArray:
        """Create new array"""
        if config:
            array = PhasedArray.from_dict(config)
        else:
            array = PhasedArray(id=len(self.arrays))
        self.arrays.append(array)
        self.current_array_index = len(self.arrays) - 1
        return array

    def remove_array(self, array_id: int) -> bool:
        """Remove array by ID"""
        for i, array in enumerate(self.arrays):
            if array.id == array_id:
                self.arrays.pop(i)
                if self.current_array_index >= len(self.arrays):
                    self.current_array_index = max(0, len(self.arrays) - 1)
                return True
        return False

    def get_current_array(self) -> Optional[PhasedArray]:
        """Get currently selected array"""
        if self.arrays:
            return self.arrays[self.current_array_index]
        return None

    def load_scenario(self, scenario_id: str) -> Optional[PhasedArray]:
        """Load predefined scenario"""
        if scenario_id not in self.scenarios:
            return None
        scenario_data = self.scenarios[scenario_id].copy()
        scenario_data['id'] = len(self.arrays)
        return self.create_array(scenario_data)

    def save_scenario(self, name: str, description: str = "") -> Dict:
        """Save current array as scenario"""
        current_array = self.get_current_array()
        if not current_array:
            return {}
        scenario = current_array.to_dict()
        scenario['description'] = description
        scenario_id = name.lower().replace(' ', '_')
        self.scenarios[scenario_id] = scenario
        return scenario

    def export_configuration(self) -> str:
        """Export all arrays as JSON"""
        data = {
            'arrays': [array.to_dict() for array in self.arrays],
            'current_array_index': self.current_array_index
        }
        return json.dumps(data, indent=2)

    def import_configuration(self, json_str: str) -> bool:
        """Import arrays from JSON"""
        try:
            data = json.loads(json_str)
            self.arrays = []
            for array_data in data.get('arrays', []):
                array = PhasedArray.from_dict(array_data)
                self.arrays.append(array)
            self.current_array_index = data.get('current_array_index', 0)
            return True
        except Exception as e:
            print(f"Error importing: {e}")
            return False


class VisualizationEngine:
    """Handles visualization calculations"""

    @staticmethod
    def create_heatmap_data(array: PhasedArray,
                            x_range: Tuple[float, float] = (-10, 10),
                            y_range: Tuple[float, float] = (0, 20),
                            resolution: int = 200) -> Dict:
        """Create heatmap data with CORRECTED logarithmic scaling"""
        heatmap = array.calculate_heatmap(x_range, y_range, resolution)

        # CORRECTED: Apply logarithmic scaling like PyQt5 version
        # This matches the visualization quality of the original implementation
        heatmap_log = np.log1p(heatmap * 100)  # log1p(x) = ln(1+x)

        # Normalize to [0, 1]
        heatmap_normalized = (heatmap_log - heatmap_log.min()) / (heatmap_log.max() - heatmap_log.min() + 1e-10)

        return {
            'data': heatmap_normalized.tolist(),
            'x_range': x_range,
            'y_range': y_range,
            'max_value': float(np.max(heatmap_normalized)),
            'min_value': float(np.min(heatmap_normalized))
        }

    @staticmethod
    def create_polar_data(array: PhasedArray, num_points: int = 361) -> Dict:
        """Create polar beam pattern data"""
        angles = np.linspace(-180, 180, num_points)
        pattern = array.calculate_beam_pattern(angles)

        # Convert to dB scale
        pattern_db = 20 * np.log10(pattern / np.max(pattern) + 1e-10)

        return {
            'angles': angles.tolist(),
            'pattern': pattern.tolist(),
            'pattern_db': pattern_db.tolist(),
            'max_db': float(np.max(pattern_db)),
            'min_db': float(np.min(pattern_db))
        }

    @staticmethod
    def create_array_visualization_data(array: PhasedArray) -> Dict:
        """Create array element position data"""
        elements_data = []
        for element in array.elements:
            elements_data.append(element.to_dict())
        return {
            'elements': elements_data,
            'array_position': [array.position_x, array.position_y],
            'array_rotation': array.rotation,
            'beam_direction': array.steering_angle
        }

    @staticmethod
    def create_phase_amplitude_data(array: PhasedArray) -> Dict:
        """Create phase and amplitude data for display"""
        phases = [e.phase for e in array.elements if e.is_active]
        amplitudes = [e.amplitude for e in array.elements if e.is_active]
        frequencies = [e.frequency if e.frequency > 0 else array.frequency
                       for e in array.elements if e.is_active]
        indices = [e.index for e in array.elements if e.is_active]
        return {
            'indices': indices,
            'phases': phases,
            'amplitudes': amplitudes,
            'frequencies': frequencies
        }