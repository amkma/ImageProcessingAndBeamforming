import numpy as np
from typing import List, Dict, Tuple, Optional
import json
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
    position_x: float = 0.0  # in wavelengths
    position_y: float = 0.0  # in wavelengths
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
        return cls(
            index=data['index'],
            position_x=data['position'][0],
            position_y=data['position'][1],
            phase=data['phase'],
            amplitude=data['amplitude'],
            delay=data['delay'],
            is_active=data.get('is_active', True)
        )


@dataclass
class PhasedArray:
    """Represents a phased array configuration"""
    name: str = "Array 1"
    id: int = 0
    geometry: ArrayGeometry = ArrayGeometry.LINEAR
    num_elements: int = 8
    element_spacing: float = 0.5  # in wavelengths
    curvature: float = 1.0  # for curved arrays
    frequency: float = 2400.0  # in MHz
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
            
            # Calculate position based on geometry
            if self.geometry == ArrayGeometry.LINEAR:
                pos = (i - (self.num_elements - 1) / 2) * self.element_spacing
                element.position_x = pos
                element.position_y = 0
                
            elif self.geometry == ArrayGeometry.CURVED:
                angle = (i - (self.num_elements - 1) / 2) * self.element_spacing / self.curvature
                element.position_x = self.curvature * math.sin(angle)
                element.position_y = self.curvature * (1 - math.cos(angle))
                
            elif self.geometry == ArrayGeometry.CIRCULAR:
                radius = (self.num_elements * self.element_spacing) / (2 * math.pi)
                circle_angle = (i - (self.num_elements - 1) / 2) * self.element_spacing / radius
                element.position_x = radius * math.sin(circle_angle)
                element.position_y = radius * math.cos(circle_angle)
                
            elif self.geometry == ArrayGeometry.RECTANGULAR:
                # For rectangular grid (simplified 2D for now)
                rows = int(math.sqrt(self.num_elements))
                cols = self.num_elements // rows
                row = i // cols
                col = i % cols
                element.position_x = (col - (cols - 1) / 2) * self.element_spacing
                element.position_y = (row - (rows - 1) / 2) * self.element_spacing
            
            # Apply rotation
            angle_rad = math.radians(self.rotation)
            x_rot = element.position_x * math.cos(angle_rad) - element.position_y * math.sin(angle_rad)
            y_rot = element.position_x * math.sin(angle_rad) + element.position_y * math.cos(angle_rad)
            element.position_x = x_rot
            element.position_y = y_rot
            
            # Apply array position (convert from wavelengths to meters for display)
            wavelength = 300 / self.frequency  # speed of light / frequency in MHz
            element.position_x = element.position_x * wavelength + self.position_x
            element.position_y = element.position_y * wavelength + self.position_y
            
            self.elements.append(element)
    
    def calculate_phases(self):
        """Calculate phase shifts for all elements"""
        wavelength = 300 / self.frequency  # meters
        
        for i, element in enumerate(self.elements):
            if self.phase_profile == PhaseProfile.LINEAR:
                # Linear phase progression for beam steering
                pos = (i - (self.num_elements - 1) / 2)
                element.phase = pos * self.phase_slope
                
            elif self.phase_profile == PhaseProfile.QUADRATIC:
                # Quadratic phase for focusing
                dx = element.position_x - self.position_x
                dy = element.position_y - self.position_y
                distance = math.sqrt(dx**2 + dy**2)
                # Focusing phase calculation
                element.phase = -360 * distance / self.focus_distance
                
            elif self.phase_profile == PhaseProfile.RANDOM:
                # Random phases
                element.phase = np.random.uniform(-180, 180)
            
            # Apply steering angle adjustment
            if self.steering_angle != 0:
                pos = (i - (self.num_elements - 1) / 2)
                steering_phase = pos * self.steering_angle * 2  # Simplified
                element.phase += steering_phase
            
            # Normalize phase to [-180, 180]
            while element.phase > 180:
                element.phase -= 360
            while element.phase < -180:
                element.phase += 360
    
    def calculate_beam_pattern(self, angles: np.ndarray) -> np.ndarray:
        """
        Calculate far-field beam pattern for given angles
        
        Args:
            angles: Array of angles in degrees
            
        Returns:
            Array of normalized beam pattern values
        """
        wavelength = 300 / self.frequency  # meters
        k = 2 * math.pi / wavelength
        
        pattern = np.zeros_like(angles, dtype=complex)
        
        for element in self.elements:
            if not element.is_active:
                continue
                
            for idx, angle in enumerate(angles):
                angle_rad = math.radians(angle)
                phase_shift = k * (element.position_x * math.sin(angle_rad) + 
                                 element.position_y * math.cos(angle_rad))
                total_phase = phase_shift + math.radians(element.phase)
                
                pattern[idx] += element.amplitude * complex(math.cos(total_phase), 
                                                          math.sin(total_phase))
        
        # Normalize and take magnitude
        pattern_normalized = np.abs(pattern) / len([e for e in self.elements if e.is_active])
        return pattern_normalized
    
    def calculate_field_at_point(self, x: float, y: float) -> complex:
        """
        Calculate electric field at a specific point in space
        
        Args:
            x, y: Coordinates in meters
            
        Returns:
            Complex electric field value
        """
        wavelength = 300 / self.frequency  # meters
        k = 2 * math.pi / wavelength
        
        total_field = 0 + 0j
        
        for element in self.elements:
            if not element.is_active:
                continue
                
            dx = x - element.position_x
            dy = y - element.position_y
            distance = math.sqrt(dx**2 + dy**2)
            
            if distance == 0:
                continue
                
            # Spherical wave propagation
            phase = k * distance + math.radians(element.phase)
            amplitude = element.amplitude / distance  # Inverse distance attenuation
            
            total_field += amplitude * complex(math.cos(phase), math.sin(phase))
        
        return total_field
    
    def calculate_heatmap(self, x_range: Tuple[float, float], 
                         y_range: Tuple[float, float],
                         resolution: int = 100) -> np.ndarray:
        """
        Calculate field intensity over a grid
        
        Args:
            x_range: (x_min, x_max) in meters
            y_range: (y_min, y_max) in meters
            resolution: Number of points in each dimension
            
        Returns:
            2D array of field intensities
        """
        x = np.linspace(x_range[0], x_range[1], resolution)
        y = np.linspace(y_range[0], y_range[1], resolution)
        
        heatmap = np.zeros((resolution, resolution))
        
        for i, xi in enumerate(x):
            for j, yj in enumerate(y):
                field = self.calculate_field_at_point(xi, yj)
                intensity = np.abs(field)
                heatmap[i, j] = intensity
        
        # Normalize
        if np.max(heatmap) > 0:
            heatmap = heatmap / np.max(heatmap)
        
        return heatmap
    
    def calculate_beam_metrics(self) -> Dict:
        """
        Calculate beam performance metrics
        
        Returns:
            Dictionary of beam metrics
        """
        angles = np.linspace(-180, 180, 361)
        pattern = self.calculate_beam_pattern(angles)
        
        # Find main lobe
        main_lobe_idx = np.argmax(pattern)
        main_lobe_angle = angles[main_lobe_idx]
        main_lobe_power = pattern[main_lobe_idx] ** 2
        
        # Calculate beamwidth at -3dB
        half_power = main_lobe_power / 2
        left_idx = main_lobe_idx
        right_idx = main_lobe_idx
        
        while left_idx > 0 and pattern[left_idx] ** 2 > half_power:
            left_idx -= 1
        while right_idx < len(pattern) - 1 and pattern[right_idx] ** 2 > half_power:
            right_idx += 1
        
        beamwidth = angles[right_idx] - angles[left_idx]
        
        # Calculate sidelobe level
        sidelobe_pattern = np.delete(pattern, slice(max(0, main_lobe_idx - 10), 
                                                   min(len(pattern), main_lobe_idx + 11)))
        max_sidelobe = np.max(sidelobe_pattern)
        sidelobe_level = 20 * math.log10(max_sidelobe / pattern[main_lobe_idx]) if pattern[main_lobe_idx] > 0 else -float('inf')
        
        # Calculate directivity (simplified)
        total_power = np.sum(pattern ** 2)
        directivity = 10 * math.log10(main_lobe_power / (total_power / len(pattern))) if total_power > 0 else 0
        
        return {
            'main_lobe_angle': float(main_lobe_angle),
            'beamwidth': float(beamwidth),
            'sidelobe_level': float(sidelobe_level),
            'directivity': float(directivity),
            'max_intensity': float(np.max(pattern))
        }
    
    def to_dict(self) -> Dict:
        """Convert array to dictionary for JSON serialization"""
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
        array = cls(
            name=data['name'],
            id=data['id'],
            geometry=ArrayGeometry(data['geometry']),
            num_elements=data['num_elements'],
            element_spacing=data['element_spacing'],
            curvature=data.get('curvature', 1.0),
            frequency=data['frequency'],
            position_x=data['position'][0],
            position_y=data['position'][1],
            rotation=data['rotation'],
            steering_angle=data['steering_angle'],
            focus_distance=data['focus_distance'],
            beam_width=data['beam_width'],
            phase_profile=PhaseProfile(data['phase_profile']),
            phase_slope=data.get('phase_slope', 0.0),
            apply_delays=data.get('apply_delays', False)
        )
        
        # Recreate elements from saved data
        array.elements = [ArrayElement.from_dict(element_data) 
                         for element_data in data['elements']]
        
        return array


class BeamformingSimulator:
    """Main simulator class handling multiple arrays"""
    
    def __init__(self):
        self.arrays: List[PhasedArray] = []
        self.scenarios: Dict[str, Dict] = {}
        self.current_array_index: int = 0
        self.load_predefined_scenarios()
    
    def create_array(self, config: Optional[Dict] = None) -> PhasedArray:
        """Create a new phased array"""
        if config:
            array = PhasedArray(**config)
        else:
            array = PhasedArray(id=len(self.arrays))
        
        self.arrays.append(array)
        self.current_array_index = len(self.arrays) - 1
        return array
    
    def remove_array(self, array_id: int) -> bool:
        """Remove an array by ID"""
        for i, array in enumerate(self.arrays):
            if array.id == array_id:
                self.arrays.pop(i)
                if self.current_array_index >= len(self.arrays):
                    self.current_array_index = max(0, len(self.arrays) - 1)
                return True
        return False
    
    def get_current_array(self) -> Optional[PhasedArray]:
        """Get the currently active array"""
        if self.arrays:
            return self.arrays[self.current_array_index]
        return None
    
    def set_current_array(self, array_id: int) -> bool:
        """Set current array by ID"""
        for i, array in enumerate(self.arrays):
            if array.id == array_id:
                self.current_array_index = i
                return True
        return False
    
    def calculate_combined_field(self, x: float, y: float) -> complex:
        """Calculate total field from all arrays at a point"""
        total_field = 0 + 0j
        for array in self.arrays:
            total_field += array.calculate_field_at_point(x, y)
        return total_field
    
    def calculate_combined_beam_pattern(self, angles: np.ndarray) -> np.ndarray:
        """Calculate combined beam pattern from all arrays"""
        combined_pattern = np.zeros_like(angles, dtype=float)
        
        for array in self.arrays:
            pattern = array.calculate_beam_pattern(angles)
            combined_pattern += pattern
        
        # Normalize
        if len(self.arrays) > 0:
            combined_pattern = combined_pattern / len(self.arrays)
        
        return combined_pattern
    
    def load_predefined_scenarios(self):
        """Load predefined scenarios"""
        self.scenarios = {
            '5g': {
                'name': '5G Beam Steering',
                'description': '64-element linear array for 5G beamforming at 3.5 GHz',
                'geometry': 'linear',
                'num_elements': 64,
                'element_spacing': 0.5,
                'frequency': 3500,
                'steering_angle': 30,
                'phase_profile': 'linear',
                'beam_width': 15
            },
            'ultrasound': {
                'name': 'Ultrasound Imaging',
                'description': '128-element curved array for medical ultrasound imaging',
                'geometry': 'curved',
                'num_elements': 128,
                'element_spacing': 0.25,
                'curvature': 0.3,
                'frequency': 5,  # MHz
                'focus_distance': 0.1,
                'phase_profile': 'quadratic',
                'beam_width': 5
            },
            'ablation': {
                'name': 'Tumor Ablation',
                'description': '256-element array for high-intensity focused ultrasound',
                'geometry': 'circular',
                'num_elements': 256,
                'element_spacing': 0.2,
                'frequency': 1,  # MHz
                'focus_distance': 0.05,
                'phase_profile': 'quadratic',
                'beam_width': 2
            }
        }
    
    def load_scenario(self, scenario_id: str) -> Optional[PhasedArray]:
        """Load a predefined scenario"""
        if scenario_id not in self.scenarios:
            return None
        
        scenario = self.scenarios[scenario_id].copy()
        scenario['id'] = len(self.arrays)
        scenario['name'] = self.scenarios[scenario_id]['name']
        
        # Handle geometry enum
        scenario['geometry'] = ArrayGeometry(scenario['geometry'])
        scenario['phase_profile'] = PhaseProfile(scenario['phase_profile'])
        
        return self.create_array(scenario)
    
    def save_scenario(self, name: str, description: str = "") -> Dict:
        """Save current configuration as a scenario"""
        current_array = self.get_current_array()
        if not current_array:
            return {}
        
        scenario = current_array.to_dict()
        scenario['description'] = description
        
        # Add to scenarios
        scenario_id = name.lower().replace(' ', '_')
        self.scenarios[scenario_id] = scenario
        
        return scenario
    
    def export_configuration(self) -> str:
        """Export all arrays to JSON string"""
        data = {
            'arrays': [array.to_dict() for array in self.arrays],
            'current_array_index': self.current_array_index
        }
        return json.dumps(data, indent=2)
    
    def import_configuration(self, json_str: str) -> bool:
        """Import configuration from JSON string"""
        try:
            data = json.loads(json_str)
            
            # Clear existing arrays
            self.arrays = []
            
            # Load arrays
            for array_data in data.get('arrays', []):
                array = PhasedArray.from_dict(array_data)
                self.arrays.append(array)
            
            # Set current array
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
        """Create heatmap data for visualization"""
        heatmap = array.calculate_heatmap(x_range, y_range, resolution)
        
        # Normalize for better visualization
        heatmap_normalized = np.log1p(heatmap * 100)  # Log scale for dynamic range
        
        return {
            'data': heatmap_normalized.tolist(),
            'x_range': x_range,
            'y_range': y_range,
            'max_value': float(np.max(heatmap_normalized)),
            'min_value': float(np.min(heatmap_normalized))
        }
    
    @staticmethod
    def create_polar_data(array: PhasedArray, 
                         num_points: int = 361) -> Dict:
        """Create polar pattern data"""
        angles = np.linspace(-180, 180, num_points)
        pattern = array.calculate_beam_pattern(angles)
        
        # Convert to dB scale
        pattern_db = 20 * np.log10(pattern + 1e-10)  # Add small offset to avoid log(0)
        
        return {
            'angles': angles.tolist(),
            'pattern': pattern.tolist(),
            'pattern_db': pattern_db.tolist(),
            'max_db': float(np.max(pattern_db)),
            'min_db': float(np.min(pattern_db))
        }
    
    @staticmethod
    def create_array_visualization_data(array: PhasedArray) -> Dict:
        """Create data for array visualization"""
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
        """Create phase and amplitude data for line chart"""
        phases = []
        amplitudes = []
        indices = []
        
        for element in array.elements:
            if element.is_active:
                indices.append(element.index)
                phases.append(element.phase)
                amplitudes.append(element.amplitude)
        
        return {
            'indices': indices,
            'phases': phases,
            'amplitudes': amplitudes
        }