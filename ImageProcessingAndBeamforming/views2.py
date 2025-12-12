from django.http import JsonResponse, HttpResponse
from django.views import View
from django.shortcuts import render
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
import json
import numpy as np
from datetime import datetime
from core.beamforman.beamforman import (
    BeamformingSimulator,
    PhasedArray,
    ArrayGeometry,
    PhaseProfile,
    VisualizationEngine
)


class BeamformingView(View):
    """Main view for the beamforming simulator"""

    def get(self, request):
        """Render the beamforming simulator page"""
        return render(request, 'beamforman.html')

    def post(self, request):
        """Handle POST requests for simulation updates"""
        try:
            if request.content_type == 'application/json':
                data = json.loads(request.body)
                action = data.get('action', '')
            else:
                action = request.POST.get('action', '')

            if action == 'update_array':
                return self.handle_array_update(request)
            elif action == 'add_array':
                return self.handle_add_array(request)
            elif action == 'remove_array':
                return self.handle_remove_array(request)
            elif action == 'load_scenario':
                return self.handle_load_scenario(request)
            elif action == 'save_scenario':
                return self.handle_save_scenario(request)
            elif action == 'get_visualization':
                return self.handle_get_visualization(request)
            elif action == 'quick_save':
                return self.handle_quick_save(request)
            elif action == 'quick_load':
                return self.handle_quick_load(request)
            elif action == 'get_presets':
                return self.handle_get_presets(request)
            elif action == 'export_config':
                return self.handle_export_config(request)
            elif action == 'import_config':
                return self.handle_import_config(request)
            elif action == 'reset_array':
                return self.handle_reset_array(request)
            elif action == 'get_status':
                return self.handle_get_status(request)
            else:
                return JsonResponse({'error': 'Invalid action'}, status=400)

        except json.JSONDecodeError as e:
            return JsonResponse({'error': 'Invalid JSON data'}, status=400)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)

    def handle_array_update(self, request):
        """Update array configuration"""
        try:
            data = json.loads(request.body)
            array_id = data.get('array_id', 0)
            simulator = self.get_simulator(request)

            array = None
            for arr in simulator.arrays:
                if arr.id == array_id:
                    array = arr
                    break

            if not array:
                return JsonResponse({'error': 'Array not found'}, status=404)

            # Update array global properties
            update_fields = [
                ('name', str),
                ('num_elements', int),
                ('geometry', str, lambda x: ArrayGeometry(x)),
                ('element_spacing', float),
                ('curvature', float),
                ('frequency', float),
                ('position_x', float),
                ('position_y', float),
                ('rotation', float),
                ('steering_angle', float),
                ('focus_distance', float),
                ('beam_width', float),
                ('phase_profile', str, lambda x: PhaseProfile(x)),
                ('phase_slope', float),
                ('apply_delays', bool)
            ]

            needs_reinitialize = False
            for field_info in update_fields:
                field_name = field_info[0]
                if field_name in data:
                    if len(field_info) == 3:  # Has converter
                        converter = field_info[2]
                        setattr(array, field_name, converter(data[field_name]))
                    else:
                        field_type = field_info[1]
                        setattr(array, field_name, field_type(data[field_name]))

                    if field_name in ['num_elements', 'geometry', 'element_spacing',
                                      'curvature', 'position_x', 'position_y', 'rotation']:
                        needs_reinitialize = True

            if needs_reinitialize:
                array.initialize_elements()

            # Update element-specific properties (Manual overrides)
            if 'elements' in data:
                for element_data in data['elements']:
                    element_idx = element_data.get('index')
                    if element_idx is not None and element_idx < len(array.elements):
                        element = array.elements[element_idx]

                        if 'phase' in element_data:
                            element.phase = float(element_data['phase'])
                        if 'amplitude' in element_data:
                            element.amplitude = float(element_data['amplitude'])
                        if 'is_active' in element_data:
                            element.is_active = bool(element_data['is_active'])
                        if 'frequency' in element_data:
                            element.frequency = float(element_data['frequency'])

                        # Handle manual position updates (override geometry)
                        if 'position_x' in element_data:
                            element.position_x = float(element_data['position_x'])
                        if 'position_y' in element_data:
                            element.position_y = float(element_data['position_y'])

            # Recalculate phases/physics
            array.calculate_phases()
            self.save_simulator(request, simulator)
            metrics = array.calculate_beam_metrics()

            return JsonResponse({
                'success': True,
                'array': array.to_dict(),
                'metrics': metrics,
                'timestamp': datetime.now().isoformat()
            })

        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)

    # ... (Rest of methods handle_add_array, handle_remove_array, etc. remain unchanged)
    # They are correctly implemented in the provided context, just ensuring handle_array_update was the critical fix.

    def handle_add_array(self, request):
        try:
            simulator = self.get_simulator(request)
            new_array = PhasedArray(id=len(simulator.arrays), name=f"Array {len(simulator.arrays) + 1}")
            simulator.arrays.append(new_array)
            simulator.current_array_index = len(simulator.arrays) - 1
            self.save_simulator(request, simulator)
            return JsonResponse(
                {'success': True, 'array': new_array.to_dict(), 'current_index': simulator.current_array_index})
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)

    def handle_remove_array(self, request):
        try:
            data = json.loads(request.body)
            array_id = data.get('array_id', 0)
            simulator = self.get_simulator(request)
            if len(simulator.arrays) <= 1: return JsonResponse({'error': 'Cannot remove the last array'}, status=400)
            success = simulator.remove_array(array_id)
            if success:
                self.save_simulator(request, simulator)
                return JsonResponse({'success': True, 'current_index': simulator.current_array_index,
                                     'total_arrays': len(simulator.arrays)})
            return JsonResponse({'error': 'Array not found'}, status=404)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)

    def handle_load_scenario(self, request):
        try:
            data = json.loads(request.body)
            scenario_id = data.get('scenario_id', '')
            simulator = self.get_simulator(request)
            new_array = simulator.load_scenario(scenario_id)
            if new_array:
                self.save_simulator(request, simulator)
                metrics = new_array.calculate_beam_metrics()
                return JsonResponse(
                    {'success': True, 'array': new_array.to_dict(), 'current_index': simulator.current_array_index,
                     'scenario_name': simulator.scenarios.get(scenario_id, {}).get('name', ''), 'metrics': metrics})
            return JsonResponse({'error': 'Scenario not found'}, status=404)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)

    def handle_save_scenario(self, request):
        try:
            data = json.loads(request.body)
            name = data.get('name', '').strip()
            description = data.get('description', '').strip()
            if not name: return JsonResponse({'error': 'Scenario name is required'}, status=400)
            simulator = self.get_simulator(request)
            current_array = simulator.get_current_array()
            if not current_array: return JsonResponse({'error': 'No active array found'}, status=400)
            scenario = simulator.save_scenario(name, description)
            if scenario:
                if 'user_scenarios' not in request.session: request.session['user_scenarios'] = []
                user_scenarios = request.session['user_scenarios']
                user_scenarios.append({'id': name.lower().replace(' ', '_'), 'name': name, 'description': description,
                                       'timestamp': datetime.now().isoformat()})
                request.session['user_scenarios'] = user_scenarios
                request.session.modified = True
                return JsonResponse(
                    {'success': True, 'scenario_id': name.lower().replace(' ', '_'), 'scenario_name': name})
            return JsonResponse({'error': 'Failed to save scenario'}, status=400)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)

    def handle_get_visualization(self, request):
        try:
            data = json.loads(request.body)
            viz_type = data.get('type', 'all')
            array_id = data.get('array_id', 0)
            resolution = data.get('resolution', 200)
            simulator = self.get_simulator(request)
            array = None
            for arr in simulator.arrays:
                if arr.id == array_id: array = arr; break
            if not array: return JsonResponse({'error': 'Array not found'}, status=404)
            response_data = {}
            if viz_type in ['heatmap', 'all']:
                x_range = data.get('x_range', (-10, 10))
                y_range = data.get('y_range', (-10, 10))
                heatmap_data = VisualizationEngine.create_heatmap_data(array, x_range=x_range, y_range=y_range,
                                                                       resolution=resolution)
                response_data['heatmap'] = heatmap_data
            if viz_type in ['polar', 'all']:
                num_points = data.get('num_points', 361)
                polar_data = VisualizationEngine.create_polar_data(array, num_points)
                response_data['polar'] = polar_data
            if viz_type in ['array', 'all']:
                array_data = VisualizationEngine.create_array_visualization_data(array)
                response_data['array'] = array_data
            if viz_type in ['phase', 'all']:
                phase_data = VisualizationEngine.create_phase_amplitude_data(array)
                response_data['phase'] = phase_data
            if viz_type in ['metrics', 'all']:
                metrics = array.calculate_beam_metrics()
                response_data['metrics'] = metrics
            response_data['array_info'] = {'name': array.name, 'id': array.id, 'num_elements': array.num_elements,
                                           'geometry': array.geometry.value, 'frequency': array.frequency}
            response_data['timestamp'] = datetime.now().isoformat()
            return JsonResponse(response_data)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)

    def handle_quick_save(self, request):
        try:
            data = json.loads(request.body)
            save_name = data.get('name', f'Quick Save {datetime.now().strftime("%H:%M:%S")}')
            simulator = self.get_simulator(request)
            current_array = simulator.get_current_array()
            if not current_array: return JsonResponse({'error': 'No active array'}, status=400)
            save_data = {'name': save_name, 'timestamp': datetime.now().isoformat(), 'array': current_array.to_dict(),
                         'array_index': simulator.current_array_index, 'arrays_count': len(simulator.arrays)}
            if 'quick_saves' not in request.session: request.session['quick_saves'] = []
            saves = request.session['quick_saves']
            saves.append(save_data)
            if len(saves) > 10: saves = saves[-10:]
            request.session['quick_saves'] = saves
            request.session.modified = True
            return JsonResponse({'success': True, 'save_name': save_name, 'saves_count': len(saves),
                                 'timestamp': save_data['timestamp']})
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)

    def handle_quick_load(self, request):
        try:
            data = json.loads(request.body)
            save_index = data.get('index', 0)
            saves = request.session.get('quick_saves', [])
            if save_index >= len(saves): return JsonResponse({'error': 'Save not found'}, status=404)
            save_data = saves[save_index]
            simulator = self.get_simulator(request)
            if save_data['array']:
                simulator.arrays = []
                array = PhasedArray.from_dict(save_data['array'])
                simulator.arrays.append(array)
                simulator.current_array_index = 0
                simulator.current_array = array
                self.save_simulator(request, simulator)
                metrics = array.calculate_beam_metrics()
                return JsonResponse(
                    {'success': True, 'array': array.to_dict(), 'save_name': save_data['name'], 'metrics': metrics,
                     'message': f'Loaded quick save "{save_data["name"]}"'})
            return JsonResponse({'error': 'Invalid save data'}, status=400)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)

    def handle_get_presets(self, request):
        presets = {
            'broadside': {'name': 'Broadside Array', 'steering_angle': 0, 'beam_width': 30, 'phase_profile': 'linear',
                          'description': 'Standard broadside configuration'},
            'endfire': {'name': 'Endfire Array', 'steering_angle': 90, 'beam_width': 40, 'phase_profile': 'linear',
                        'description': 'Endfire array configuration'},
            'focused_short': {'name': 'Short Range Focus', 'focus_distance': 2, 'phase_profile': 'quadratic',
                              'description': 'Focused beam for short range'},
            'focused_long': {'name': 'Long Range Focus', 'focus_distance': 20, 'phase_profile': 'quadratic',
                             'description': 'Focused beam for long range'},
            'narrow_beam': {'name': 'Narrow Beam', 'num_elements': 16, 'beam_width': 15,
                            'description': 'Narrow beam configuration'},
            'wide_beam': {'name': 'Wide Beam', 'num_elements': 4, 'beam_width': 60,
                          'description': 'Wide beam configuration'}}
        return JsonResponse({'success': True, 'presets': presets, 'timestamp': datetime.now().isoformat()})

    def handle_export_config(self, request):
        try:
            simulator = self.get_simulator(request)
            config_data = {'version': '1.0', 'export_date': datetime.now().isoformat(),
                           'simulator': simulator.export_configuration(),
                           'quick_saves': request.session.get('quick_saves', []),
                           'user_scenarios': request.session.get('user_scenarios', [])}
            config_json = json.dumps(config_data, indent=2)
            response = HttpResponse(config_json, content_type='application/json')
            response[
                'Content-Disposition'] = f'attachment; filename="beamforming_config_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json"'
            return response
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)

    def handle_import_config(self, request):
        try:
            if 'config_file' not in request.FILES: return JsonResponse({'error': 'No file uploaded'}, status=400)
            config_file = request.FILES['config_file']
            config_json = config_file.read().decode('utf-8')
            config_data = json.loads(config_json)
            if 'simulator' in config_data:
                simulator = BeamformingSimulator()
                success = simulator.import_configuration(config_data['simulator'])
                if success:
                    request.session['simulator'] = simulator.export_configuration()
                    if 'quick_saves' in config_data: request.session['quick_saves'] = config_data['quick_saves']
                    if 'user_scenarios' in config_data: request.session['user_scenarios'] = config_data[
                        'user_scenarios']
                    request.session.modified = True
                    return JsonResponse({'success': True, 'message': 'Configuration imported successfully',
                                         'num_arrays': len(simulator.arrays),
                                         'quick_saves': len(request.session.get('quick_saves', [])),
                                         'user_scenarios': len(request.session.get('user_scenarios', []))})
                else:
                    return JsonResponse({'error': 'Failed to import simulator configuration'}, status=400)
            else:
                return JsonResponse({'error': 'Invalid configuration file'}, status=400)
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON file'}, status=400)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)

    def handle_reset_array(self, request):
        try:
            simulator = self.get_simulator(request)
            current_array = simulator.get_current_array()
            if not current_array: return JsonResponse({'error': 'No active array'}, status=400)
            default_array = PhasedArray(id=current_array.id, name=current_array.name)
            simulator.arrays[simulator.current_array_index] = default_array
            simulator.current_array = default_array
            self.save_simulator(request, simulator)
            return JsonResponse(
                {'success': True, 'array': default_array.to_dict(), 'message': 'Array reset to default configuration'})
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)

    def handle_get_status(self, request):
        try:
            simulator = self.get_simulator(request)
            status_data = {'success': True, 'status': 'active', 'timestamp': datetime.now().isoformat(),
                           'simulator': {'total_arrays': len(simulator.arrays),
                                         'current_array_index': simulator.current_array_index,
                                         'scenarios_count': len(simulator.scenarios)},
                           'session': {'has_quick_saves': 'quick_saves' in request.session,
                                       'quick_saves_count': len(request.session.get('quick_saves', [])),
                                       'user_scenarios_count': len(request.session.get('user_scenarios', []))}}
            current_array = simulator.get_current_array()
            if current_array: status_data['current_array'] = {'name': current_array.name,
                                                              'num_elements': current_array.num_elements,
                                                              'geometry': current_array.geometry.value,
                                                              'frequency': current_array.frequency}
            return JsonResponse(status_data)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)

    def get_simulator(self, request):
        if 'simulator' not in request.session:
            simulator = BeamformingSimulator()
            simulator.create_array()
            request.session['simulator'] = simulator.export_configuration()
            request.session.modified = True
        else:
            simulator = BeamformingSimulator()
            try:
                simulator.import_configuration(request.session['simulator'])
            except:
                simulator = BeamformingSimulator()
                simulator.create_array()
                request.session['simulator'] = simulator.export_configuration()
                request.session.modified = True
        return simulator

    def save_simulator(self, request, simulator):
        request.session['simulator'] = simulator.export_configuration()
        request.session.modified = True


@method_decorator(csrf_exempt, name='dispatch')
class QuickOperationsView(View):
    def post(self, request):
        beamforming_view = BeamformingView()
        return beamforming_view.post(request)


class ExportConfigurationView(View):
    def get(self, request):
        beamforming_view = BeamformingView()
        return beamforming_view.handle_export_config(request)

    def post(self, request):
        beamforming_view = BeamformingView()
        return beamforming_view.handle_import_config(request)


class APIDocumentationView(View):
    def get(self, request):
        api_endpoints = {'POST /api/beamforming/': {'description': 'Main endpoint for beamforming operations',
                                                    'actions': {'update_array': 'Update array configuration',
                                                                'add_array': 'Add new array',
                                                                'remove_array': 'Remove array',
                                                                'load_scenario': 'Load predefined scenario',
                                                                'save_scenario': 'Save current configuration as scenario',
                                                                'get_visualization': 'Get visualization data',
                                                                'quick_save': 'Quick save current configuration',
                                                                'quick_load': 'Load quick save',
                                                                'get_presets': 'Get configuration presets',
                                                                'reset_array': 'Reset array to default',
                                                                'get_status': 'Get simulator status'}},
                         'GET /api/beamforming/export/': {'description': 'Export current configuration as JSON'},
                         'POST /api/beamforming/import/': {'description': 'Import configuration from JSON file'}}
        return render(request, 'api_documentation.html', {'api_endpoints': api_endpoints})