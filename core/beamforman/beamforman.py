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
    delay: float = 0.0  # in seconds
    is_active: bool = True

    def to_dict(self) -> Dict:
        return {
            'index': self.index,
            'position': [self.position_x, self.position_y],
            'phase': self.phase,
            'amplitude': self.amplitude,
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
    frequency: float = 2400000000.0  # in Hz
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
            element = ArrayElement(index=i)

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
        speed_of_light = 3e8  # Approximate
        wavelength = speed_of_light / self.frequency

        for i, element in enumerate(self.elements):
            if self.phase_profile == PhaseProfile.LINEAR:
                # Linear phase progression
                pos_idx = (i - (self.num_elements - 1) / 2)
                element.phase = pos_idx * self.phase_slope

            elif self.phase_profile == PhaseProfile.QUADRATIC:
                # Focusing phase
                # d = distance from element to focus point (0, focus_distance)
                # focus point is relative to array center
                dx = element.position_x - self.position_x
                dy = element.position_y - self.position_y

                # Distance to focal point (assumed at x=0, y=focus_distance relative to array)
                dist_to_focus = math.sqrt(dx ** 2 + (self.focus_distance - dy) ** 2)

                # Phase required to align arrival at focus
                # phi = k * d = (2pi/lambda) * d -> converted to degrees
                element.phase = (360 * dist_to_focus / wavelength) % 360

            elif self.phase_profile == PhaseProfile.RANDOM:
                element.phase = np.random.uniform(-180, 180)

            # Apply steering angle (basic beamforming delay)
            if self.steering_angle != 0:
                # Time delay = (x * sin(theta)) / c
                # Phase shift = 2pi * f * t
                steering_rad = math.radians(self.steering_angle)
                delay_dist = element.position_x * math.sin(steering_rad)
                steering_phase = (360 * delay_dist / wavelength)
                element.phase -= steering_phase

            # Normalize
            while element.phase > 180: element.phase -= 360
            while element.phase < -180: element.phase += 360

    def calculate_beam_metrics(self) -> Dict:
        """Calculate basic metrics for display"""
        return {
            'main_lobe_angle': self.steering_angle,
            'beamwidth': self.beam_width,
            'sidelobe_level': -13.5,  # Placeholder ideal
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
        # Handle position list
        pos = data.get('position', [0.0, 0.0])

        array = cls(
            name=data.get('name', 'Array'),
            id=data.get('id', 0),
            geometry=ArrayGeometry(data.get('geometry', 'linear')),
            num_elements=int(data.get('num_elements', 8)),
            element_spacing=float(data.get('element_spacing', 0.5)),
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

        # If elements are provided in data, load them
        if 'elements' in data:
            array.elements = [ArrayElement.from_dict(e) for e in data['elements']]
        else:
            # Otherwise initialize standard positions
            array.initialize_elements()

        return array


class BeamformingSimulator:
    """Main simulator class handling multiple arrays"""

    def __init__(self):
        self.arrays: List[PhasedArray] = []
        self.scenarios: Dict[str, Dict] = {}
        self.current_array_index: int = 0
        self.load_predefined_scenarios()

    def load_predefined_scenarios(self):
        """Load scenarios from JSON files in the 'scenarios' directory"""
        self.scenarios = {}

        # Define path to scenarios directory (relative to this file)
        current_dir = os.path.dirname(os.path.abspath(__file__))
        scenarios_dir = os.path.join(current_dir, 'scenarios')

        # Create directory if it doesn't exist
        if not os.path.exists(scenarios_dir):
            try:
                os.makedirs(scenarios_dir)
                print(f"Created scenarios directory at {scenarios_dir}. Please add JSON files.")
            except OSError as e:
                print(f"Could not create scenarios directory: {e}")

        # Load JSON files
        if os.path.exists(scenarios_dir):
            for filename in os.listdir(scenarios_dir):
                if filename.endswith('.json'):
                    try:
                        file_path = os.path.join(scenarios_dir, filename)
                        with open(file_path, 'r') as f:
                            data = json.load(f)
                            # Use filename without extension as ID (e.g., '5g', 'tumor')
                            scenario_id = filename[:-5].lower()
                            # Ensure ID is in data for consistency
                            data['id'] = 0
                            self.scenarios[scenario_id] = data
                            print(f"Loaded scenario: {scenario_id}")
                    except Exception as e:
                        print(f"Error loading scenario {filename}: {e}")

        # Fallback defaults if no files found
        if not self.scenarios:
            print("No scenario files found. Using hardcoded defaults.")
            self.scenarios = {
                '5g': {
                    'name': '5G Beam Steering',
                    'geometry': 'linear',
                    'num_elements': 8,
                    'element_spacing': 0.06,
                    'frequency': 3500000000.0
                }
            }

    def create_array(self, config: Optional[Dict] = None) -> PhasedArray:
        """Create a new phased array"""
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
        """Load a predefined scenario by ID (filename without extension)"""
        if scenario_id not in self.scenarios:
            return None

        scenario_data = self.scenarios[scenario_id].copy()
        # Set a new ID for the loaded array
        scenario_data['id'] = len(self.arrays)

        # Ensure enum strings are passed correctly (handled in from_dict)
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
            print(f"Error importing configuration: {e}")
            return False


class VisualizationEngine:
    """Handles visualization calculations"""

    @staticmethod
    def create_heatmap_data(array: PhasedArray,
                            x_range: Tuple[float, float] = (-10, 10),
                            y_range: Tuple[float, float] = (-10, 10),
                            resolution: int = 200) -> Dict:
        # Use existing logic from your previous code
        heatmap = array.calculate_heatmap(x_range, y_range, resolution)
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
            elements_data.append({
                'index': element.index,
                'x': element.position_x,
                'y': element.position_y,
                'phase': element.phase,
                'amplitude': element.amplitude,
                'is_active': element.is_active
            })
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
        indices = [e.index for e in array.elements if e.is_active]
        return {
            'indices': indices,
            'phases': phases,
            'amplitudes': amplitudes
        }