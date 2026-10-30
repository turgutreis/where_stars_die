extends Node3D
class_name OrbitingEntity

## Reusable Component for any Planet, Moon, Space Station, or Quest Vessel in Godot 4!
## You can edit all properties directly in the Godot Inspector AND drag the object in the 3D Viewport.
## Includes built-in safe-orbit validation so stations never clip into expanding planets.

@export_category("Identity & Quest Binding")
@export var display_name: String = "Orbital Object"
@export_enum("planet", "moon", "space_station", "jamal_shuttle", "towing_drone", "voyager_probe", "custom") var entity_category: String = "custom"
@export var dialogue_node_id: String = ""
@export var is_harvestable: bool = false
@export var emits_radiation: bool = false

@export_category("Orbital Mechanics")
@export var parent_body: Node3D = null
@export var orbit_radius: float = 28.0
@export var orbit_angle_deg: float = 45.0
@export var orbit_speed: float = 0.04
@export var base_radius: float = 1.0
@export var dynamic_approach_expansion: bool = false

var _current_angle_rad: float = 0.0

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
	var parent_base_r: float = parent_body.get("base_radius") if parent_body.get("base_radius") != null else 3.5
	# Guarantee clearance outside 2.85x planetary expansion + 1.35x atmosphere
	if entity_category in ["space_station", "jamal_shuttle", "towing_drone"]:
		var min_safe: float = parent_base_r * 2.85 * 1.35 + 8.0
		if orbit_radius < min_safe:
			orbit_radius = min_safe

func _process(delta: float) -> void:
	update_orbital_position(delta)

func update_orbital_position(delta: float) -> void:
	if parent_body and is_instance_valid(parent_body):
		_current_angle_rad += orbit_speed * delta
		var p_pos: Vector3 = parent_body.global_position
		var p_scale: float = max(1.0, parent_body.scale.x)
		var effective_r: float = orbit_radius + (p_scale - 1.0) * (orbit_radius * 0.45 + 6.0)
		var nx: float = p_pos.x + cos(_current_angle_rad) * effective_r
		var nz: float = p_pos.z + sin(_current_angle_rad) * effective_r
		global_position = Vector3(nx, 0.0, nz)
		if entity_category in ["jamal_shuttle", "space_station"]:
			rotation.y = -_current_angle_rad + PI * 0.5

	# Smooth distance-based planetary scale expansion (1.0x -> 2.85x) when player approaches
	if dynamic_approach_expansion and entity_category == "planet":
		var player := get_tree().get_first_node_in_group("player_ship") as Node3D
		if player:
			var dist: float = global_position.distance_to(player.global_position)
			var raw_t: float = clamp((100.0 - dist) / (100.0 - 7.0), 0.0, 1.0)
			var smooth_t: float = raw_t * raw_t * (3.0 - 2.0 * raw_t)
			var target_scale: float = 1.0 + 1.85 * smooth_t
			var new_s: float = lerpf(scale.x, target_scale, min(1.0, delta * 5.0))
			scale = Vector3(new_s, new_s, new_s)
