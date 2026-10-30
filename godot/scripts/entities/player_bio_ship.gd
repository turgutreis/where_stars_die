extends CharacterBody3D
class_name PlayerBioShip

## Najmafar Living Bio-Ship Controller (Godot 4.6)
## Newtonian 2.5D Space Flight + Flight Assist + Organic Tentacle/Wing Animation + Camera Zoom.

@export var thrust_strength: float = 28.0
@export var retro_thrust_strength: float = 22.0
@export var turn_speed: float = 2.85
@export var max_speed: float = 55.0

var ship_heading: float = 0.0
var angular_velocity: float = 0.0
var camera_height: float = 68.0
var target_camera_height: float = 68.0
var anim_time: float = 0.0

@onready var visual_root: Node3D = $VisualRoot
@onready var left_wing: Node3D = $VisualRoot/LeftWing
@onready var right_wing: Node3D = $VisualRoot/RightWing
@onready var nucleus_core: MeshInstance3D = $VisualRoot/NucleusCore
@onready var camera_3d: Camera3D = $CameraRig/Camera3D
@onready var bio_light: OmniLight3D = $VisualRoot/BioLight

func _ready() -> void:
	add_to_group("player_ship")
	global_position = Vector3(0.0, 0.0, 160.0)
	velocity = Vector3(1.5, 0.0, 0.0)

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton:
		if event.button_index == MOUSE_BUTTON_WHEEL_UP and event.pressed:
			target_camera_height = clamp(target_camera_height - 6.0, 26.0, 150.0)
		elif event.button_index == MOUSE_BUTTON_WHEEL_DOWN and event.pressed:
			target_camera_height = clamp(target_camera_height + 6.0, 26.0, 150.0)

func _physics_process(delta: float) -> void:
	if QuestManager.is_dialogue_open:
		return

	anim_time += delta

	# 1. Steering Input (A / D or Left / Right)
	var turn_input: float = 0.0
	if Input.is_key_pressed(KEY_A) or Input.is_key_pressed(KEY_LEFT):
		turn_input += 1.0
	if Input.is_key_pressed(KEY_D) or Input.is_key_pressed(KEY_RIGHT):
		turn_input -= 1.0

	if turn_input != 0.0:
		angular_velocity = turn_input * turn_speed
	else:
		angular_velocity = lerpf(angular_velocity, 0.0, min(1.0, delta * 14.0))

	ship_heading += angular_velocity * delta
	if visual_root:
		visual_root.rotation.y = ship_heading - PI * 0.5
		# Subtle organic roll when turning
		visual_root.rotation.z = lerpf(visual_root.rotation.z, -turn_input * 0.25, min(1.0, delta * 8.0))

	# 2. Forward Thrust (W / Up) & Retro Braking (S / Down)
	var is_thrusting := Input.is_key_pressed(KEY_W) or Input.is_key_pressed(KEY_UP)
	var is_braking := Input.is_key_pressed(KEY_S) or Input.is_key_pressed(KEY_DOWN)

	var forward_dir := Vector3(cos(ship_heading), 0.0, -sin(ship_heading)).normalized()

	if is_thrusting:
		velocity += forward_dir * thrust_strength * delta
		GameState.bio_energy = max(0.0, GameState.bio_energy - 3.5 * delta)
		if GameState.flight_assist:
			# Dampen lateral drift for responsive organic cornering
			var forward_speed := velocity.dot(forward_dir)
			var lateral := velocity - forward_dir * forward_speed
			velocity -= lateral * min(1.0, delta * 4.5)
	else:
		GameState.bio_energy = min(GameState.max_bio_energy, GameState.bio_energy + 2.5 * delta)

	if is_braking:
		velocity = velocity.move_toward(Vector3.ZERO, retro_thrust_strength * delta)

	# Clamp speed & lock to ecliptic plane Y=0
	if velocity.length() > max_speed:
		velocity = velocity.normalized() * max_speed
	velocity.y = 0.0

	move_and_slide()
	global_position.y = 0.0

	# 3. Organic Manta-Wing & Nucleus Animation
	var flap_speed: float = 6.5 if is_thrusting else 2.4
	var flap_amp: float = 0.22 if is_thrusting else 0.08
	if left_wing:
		left_wing.rotation.z = sin(anim_time * flap_speed) * flap_amp
	if right_wing:
		right_wing.rotation.z = -sin(anim_time * flap_speed) * flap_amp
	if nucleus_core:
		var pulse := 1.0 + sin(anim_time * 3.5) * 0.1
		nucleus_core.scale = Vector3(pulse, pulse, pulse)

	# 4. Smooth Top-Down / Angled Camera Follow
	camera_height = lerpf(camera_height, target_camera_height, min(1.0, delta * 6.0))
	if camera_3d:
		camera_3d.global_position = Vector3(global_position.x, camera_height, global_position.z + camera_height * 0.42)
		camera_3d.look_at(global_position, Vector3.UP)
