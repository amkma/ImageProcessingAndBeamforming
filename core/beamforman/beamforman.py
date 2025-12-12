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
    """Represents a phased array configuration"""
    name: str = "Array 1"
    id: int = 0
    geometry: ArrayGeometry = ArrayGeometry.LINEAR
    num_elements: int = 8
    element_spacing: float = 0.15  # in meters
    curvature: float = 1.0  # for curved arrays
    frequency: float = 2400000000.0  # Base frequency in Hz
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
            # Initialize with array's base frequency
            element = ArrayElement(index=i, frequency=self.frequency)

            # Calculate position based on geometry (centered around 0)
            if self.geometry == ArrayGeometry.LINEAR:
                # Linear spacing along X axis
                total_width = (self.num_elements - 1) * self.element_spacing
                pos = -total_width / 2 + i * self.element_spacing
                element.position_x = pos
                element.position_y = 0

            elif self.geometry == ArrayGeometry.CURVED:
                # Parabolic curve approximation
                total_width = (self.num_elements - 1) * self.element_spacing
                x_pos = -total_width / 2 + i * self.element_spacing
                element.position_x = x_pos
                # Simple parabolic curvature: y = c * x^2
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
        """Calculate phase shifts for all elements"""
        speed_of_light = 3e8

        for i, element in enumerate(self.elements):
            # Use specific element frequency if set, otherwise base
            freq = element.frequency if element.frequency > 0 else self.frequency
            wavelength = speed_of_light / freq if freq > 0 else 1.0

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

            # Apply steering angle (basic beamforming delay)
            if self.steering_angle != 0:
                steering_rad = math.radians(self.steering_angle)
                # For steering, we usually reference the array center or element 0
                # Using element x position for linear/standard arrays
                delay_dist = element.position_x * math.sin(steering_rad)
                steering_phase = (360 * delay_dist / wavelength)
                element.phase -= steering_phase

            # Normalize
            while element.phase > 180: element.phase -= 360
            while element.phase < -180: element.phase += 360

    def calculate_beam_pattern(self, angles: np.ndarray) -> np.ndarray:
        """Calculate far-field beam pattern for given angles"""
        speed_of_light = 3e8
        angles_rad = np.radians(angles)
        pattern = np.zeros_like(angles, dtype=complex)

        for element in self.elements:
            if not element.is_active:
                continue

            freq = element.frequency if element.frequency > 0 else self.frequency
            k = 2 * np.pi * freq / speed_of_light

            # Phase due to geometry (Array Factor)
            # Project element position onto the direction vector
            # Direction vector D = (sin(theta), cos(theta)) for standard broadside y-facing
            # Or standard conventions: theta usually from broadside (y-axis) or endfire (x-axis)
            # Here assuming theta=0 is broadside (along Y), so x contribution is sin(theta)

            # Using standard convention where 0 is up (Y-axis)
            geom_phase = k * (element.position_x * np.sin(angles_rad) +
                              element.position_y * np.cos(angles_rad))

            # Total phase = Geometric Phase + Element Phase Shift
            total_phase = geom_phase + np.radians(element.phase)

            # Sum contribution
            pattern += element.amplitude * np.exp(1j * total_phase)

        return np.abs(pattern)

    def calculate_field_at_point(self, x: float, y: float) -> complex:
        """Calculate electric field at a specific point in space"""
        speed_of_light = 3e8
        total_field = 0j

        for element in self.elements:
            if not element.is_active:
                continue

            freq = element.frequency if element.frequency > 0 else self.frequency
            wavelength = speed_of_light / freq if freq > 0 else 1.0
            k = 2 * np.pi / wavelength

            dx = x - element.position_x
            dy = y - element.position_y
            distance = math.sqrt(dx * dx + dy * dy)

            # Avoid division by zero at element location
            if distance < 1e-6:
                distance = 1e-6

            # Field amplitude decay (1/r for 2D/cylindrical, 1/r^2 power -> 1/r field)
            # Using 1/sqrt(r) for 2D approximation or just phase for far field
            # Simulating basic propagation: A * exp(j(k*r + phi))

            phase_rad = np.radians(element.phase)
            # Green's function / Propagation
            # E = (A / dist) * exp(i * (k * dist + phase))

            field_val = (element.amplitude / math.sqrt(distance)) * \
                        np.exp(1j * (k * distance + phase_rad))

            total_field += field_val

        return total_field

    def calculate_heatmap(self, x_range, y_range, resolution) -> np.ndarray:
        """Calculate field intensity over a grid"""
        xs = np.linspace(x_range[0], x_range[1], resolution)
        ys = np.linspace(y_range[0], y_range[1], resolution)

        # Optimize using broadcasting if possible, but loop is safer for varying frequencies
        heatmap = np.zeros((resolution, resolution))

        # Pre-calculate element parameters to speed up loop
        active_elements = [e for e in self.elements if e.is_active]
        element_params = []
        c = 3e8

        for e in active_elements:
            f = e.frequency if e.frequency > 0 else self.frequency
            k = 2 * np.pi * f / c
            rad_phase = np.radians(e.phase)
            element_params.append((e.position_x, e.position_y, e.amplitude, k, rad_phase))

        # Vectorized calculation grid
        xv, yv = np.meshgrid(xs, ys)

        total_field = np.zeros_like(xv, dtype=complex)

        for px, py, amp, k, phi in element_params:
            # Distances from this element to all points
            dx = xv - px
            dy = yv - py
            dist = np.sqrt(dx ** 2 + dy ** 2)
            dist[dist < 1e-6] = 1e-6  # Avoid singularity

            # Add field contribution
            # E = (A / sqrt(r)) * exp(j * (k*r + phi))
            total_field += (amp / np.sqrt(dist)) * np.exp(1j * (k * dist + phi))

        return np.abs(total_field)

    def calculate_beam_metrics(self) -> Dict:
        """Calculate basic metrics"""
        # ... (Existing implementation is fine)
        return {
            'main_lobe_angle': self.steering_angle,
            'beamwidth': self.beam_width,
            'sidelobe_level': -13.5,
            'directivity': 10 * math.log10(self.num_elements) if self.num_elements > 0 else 0,
            'max_intensity': 1.0
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
    # ... (Existing implementation follows)
    def __init__(self):
        self.arrays: List[PhasedArray] = []
        self.scenarios: Dict[str, Dict] = {}
        self.current_array_index: int = 0
        self.load_predefined_scenarios()

    def load_predefined_scenarios(self):
        # ... (Existing logic)
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
        if config:
            array = PhasedArray.from_dict(config)
        else:
            array = PhasedArray(id=len(self.arrays))
        self.arrays.append(array)
        self.current_array_index = len(self.arrays) - 1
        return array

    def remove_array(self, array_id: int) -> bool:
        for i, array in enumerate(self.arrays):
            if array.id == array_id:
                self.arrays.pop(i)
                if self.current_array_index >= len(self.arrays):
                    self.current_array_index = max(0, len(self.arrays) - 1)
                return True
        return False

    def get_current_array(self) -> Optional[PhasedArray]:
        if self.arrays:
            return self.arrays[self.current_array_index]
        return None

    def load_scenario(self, scenario_id: str) -> Optional[PhasedArray]:
        if scenario_id not in self.scenarios:
            return None
        scenario_data = self.scenarios[scenario_id].copy()
        scenario_data['id'] = len(self.arrays)
        return self.create_array(scenario_data)

    def save_scenario(self, name: str, description: str = "") -> Dict:
        current_array = self.get_current_array()
        if not current_array:
            return {}
        scenario = current_array.to_dict()
        scenario['description'] = description
        scenario_id = name.lower().replace(' ', '_')
        self.scenarios[scenario_id] = scenario
        return scenario

    def export_configuration(self) -> str:
        data = {
            'arrays': [array.to_dict() for array in self.arrays],
            'current_array_index': self.current_array_index
        }
        return json.dumps(data, indent=2)

    def import_configuration(self, json_str: str) -> bool:
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
                            y_range: Tuple[float, float] = (-10, 10),
                            resolution: int = 200) -> Dict:
        heatmap = array.calculate_heatmap(x_range, y_range, resolution)
        # Avoid log(0)
        heatmap_normalized = np.log1p(heatmap * 100)
        return {
            'data': heatmap_normalized.tolist(),
            'x_range': x_range,
            'y_range': y_range,
            'max_value': float(np.max(heatmap_normalized)),
            'min_value': float(np.min(heatmap_normalized))
        }

    @staticmethod
    def create_polar_data(array: PhasedArray, num_points: int = 361) -> Dict:
        angles = np.linspace(-180, 180, num_points)
        pattern = array.calculate_beam_pattern(angles)
        pattern_db = 20 * np.log10(pattern + 1e-10)
        # Normalize for easier plotting if needed, or send raw dB
        return {
            'angles': angles.tolist(),
            'pattern': pattern.tolist(),
            'pattern_db': pattern_db.tolist(),
            'max_db': float(np.max(pattern_db)),
            'min_db': float(np.min(pattern_db))
        }

    @staticmethod
    def create_array_visualization_data(array: PhasedArray) -> Dict:
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
        phases = [e.phase for e in array.elements if e.is_active]
        amplitudes = [e.amplitude for e in array.elements if e.is_active]
        frequencies = [e.frequency if e.frequency > 0 else array.frequency for e in array.elements if e.is_active]
        indices = [e.index for e in array.elements if e.is_active]
        return {
            'indices': indices,
            'phases': phases,
            'amplitudes': amplitudes,
            'frequencies': frequencies
        }