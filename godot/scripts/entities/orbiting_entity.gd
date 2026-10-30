@tool
extends Node3D
class_name OrbitingEntity

## Reusable Component for any Planet, Moon, Space Station, or Quest Vessel in Godot 4!
## Runs with @tool so you can see and edit all planets, moons, and stations directly in the 3D Editor!

@export_category("Identity & Quest Binding")
@export var display_name: String = "Orbital Object"
@export_enum("planet", "moon", "space_station", "jamal_shuttle", "towing_drone", "voyager_probe", "asteroid", "custom") var entity_category: String = "custom"
@export var dialogue_node_id: String = ""
@export var is_harvestable: bool = false
@export var emits_radiation: bool = false

@export_category("Orbital Mechanics")
@export var parent_body: Node3D = null
@export var orbit_radius: float = 28.0:
	set(value):
		orbit_radius = value
		if is_inside_tree():
			update_orbital_position(0.0)
@export var orbit_angle_deg: float = 45.0:
	set(value):
		orbit_angle_deg = value
		_current_angle_rad = deg_to_rad(value)
		if is_inside_tree():
			update_orbital_position(0.0)
@export var orbit_speed: float = 0.04
@export var base_radius: float = 1.0
@export var axial_rotation_speed: float = 0.18
@export var dynamic_approach_expansion: bool = false
@export var animate_in_editor: bool = false

var _current_angle_rad: float = 0.0
var body_mesh: Node3D = null
var cloud_mesh: Node3D = null
var orbit_ring_mesh: Node3D = null

func _ready() -> void:
	_current_angle_rad = deg_to_rad(orbit_angle_deg)
	set_meta("display_name", display_name)
	set_meta("entity_category", entity_category)
	set_meta("dialogue_node_id", dialogue_node_id)
	set_meta("is_harvestable", is_harvestable)
	set_meta("emits_radiation", emits_radiation)
	enforce_safe_orbit_clearance()
	update_orbital_position(0.0)

func enforce_safe_orbit_clearance() -> void:
	if parent_body == null:
		return
	var parent_base_r: float = float(parent_body.get("base_radius")) if parent_body.get("base_radius") != null else 3.5
	# Guarantee clearance outside 2.85x planetary expansion + 1.35x atmosphere
	if entity_category in ["space_station", "jamal_shuttle", "towing_drone"]:
		var min_safe: float = parent_base_r * 2.85 * 1.35 + 8.0
		if orbit_radius < min_safe:
			orbit_radius = min_safe

func _process(delta: float) -> void:
	if Engine.is_editor_hint() and not animate_in_editor:
		update_orbital_position(0.0)
		return
	update_orbital_position(delta)

func update_orbital_position(delta: float) -> void:
	# 1. Planet orbiting the central star at (0, 0, 0)
	if parent_body == null and entity_category == "planet" and orbit_radius > 0.1:
		_current_angle_rad += orbit_speed * delta
		var px: float = cos(_current_angle_rad) * orbit_radius
		var pz: float = sin(_current_angle_rad) * orbit_radius
		global_position = Vector3(px, 0.0, pz)

	# 2. Moon, Space Station, or Quest Vessel orbiting a parent planet
	elif parent_body and is_instance_valid(parent_body):
		_current_angle_rad += orbit_speed * delta
		var p_pos: Vector3 = parent_body.global_position
		var p_scale: float = max(1.0, parent_body.scale.x)
		var effective_r: float = orbit_radius
		if entity_category in ["space_station", "jamal_shuttle", "towing_drone", "moon"]:
			effective_r = orbit_radius + (p_scale - 1.0) * (orbit_radius * 0.45 + 6.0)
		var nx: float = p_pos.x + cos(_current_angle_rad) * effective_r
		var nz: float = p_pos.z + sin(_current_angle_rad) * effective_r
		global_position = Vector3(nx, 0.0, nz)
		if entity_category in ["jamal_shuttle", "space_station"]:
			rotation.y = -_current_angle_rad + PI * 0.5
		if orbit_ring_mesh and is_instance_valid(orbit_ring_mesh):
			orbit_ring_mesh.global_position = Vector3(p_pos.x, -0.05, p_pos.z)
			var ring_scale: float = effective_r / max(0.1, orbit_radius)
			orbit_ring_mesh.scale = Vector3(ring_scale, 1.0, ring_scale)

	# 3. Axial rotation of planet surface & cloud layer
	if delta > 0.0:
		if body_mesh and is_instance_valid(body_mesh):
			body_mesh.rotate_y(axial_rotation_speed * delta)
		if cloud_mesh and is_instance_valid(cloud_mesh):
			cloud_mesh.rotate_y(axial_rotation_speed * 1.35 * delta)

	# 4. Smooth distance-based planetary scale expansion (1.0x -> 2.85x) when player approaches (Runtime only)
	if not Engine.is_editor_hint() and dynamic_approach_expansion and entity_category == "planet":
		var player: Node3D = get_tree().get_first_node_in_group("player_ship") as Node3D
		if player:
			var dist: float = global_position.distance_to(player.global_position)
			var raw_t: float = clamp((100.0 - dist) / (100.0 - 7.0), 0.0, 1.0)
			var smooth_t: float = raw_t * raw_t * (3.0 - 2.0 * raw_t)
			var target_scale: float = 1.0 + 1.85 * smooth_t
			var new_s: float = lerpf(scale.x, target_scale, min(1.0, delta * 5.0))
			scale = Vector3(new_s, new_s, new_s)
