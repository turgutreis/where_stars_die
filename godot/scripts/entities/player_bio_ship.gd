@tool
extends CharacterBody3D
class_name PlayerBioShip

## Najmafar Living Bio-Ship Controller (Godot 4.6)
## Organic Wave-Like Swimming Locomotion (Manta / Leviathan Traveling Sine-Wave Undulation)
## + Procedural Multi-Part Bio-Anatomy + Gravitational Slingshot Physics + Camera Zoom.

@export_category("Flight Physics")
@export var thrust_strength: float = 28.0
@export var retro_thrust_strength: float = 22.0
@export var turn_speed: float = 2.85
@export var max_speed: float = 55.0
@export var gravity_influence_multiplier: float = 1.0
@export var wave_swim_amplitude: float = 0.42
@export var wave_swim_frequency: float = 4.2

@export_category("Camera Settings")
@export_range(20.0, 400.0, 1.0) var default_camera_height: float = 95.0:
	set(value):
		default_camera_height = value
		camera_height = value
		target_camera_height = value
		_update_camera_transform()
@export_range(30.0, 75.0, 1.0) var camera_fov: float = 46.0:
	set(value):
		camera_fov = value
		if is_inside_tree() and camera_3d:
			camera_3d.fov = camera_fov
@export_range(15.0, 100.0, 1.0) var min_camera_height: float = 24.0
@export_range(100.0, 600.0, 5.0) var max_camera_height: float = 380.0
@export_range(0.01, 0.5, 0.01) var camera_tilt_ratio: float = 0.05:
	set(value):
		camera_tilt_ratio = value
		_update_camera_transform()
@export var use_orthogonal_isometric: bool = false:
	set(value):
		use_orthogonal_isometric = value
		_update_camera_transform()

var ship_heading: float = 0.0
var angular_velocity: float = 0.0
var camera_height: float = 95.0
var target_camera_height: float = 95.0
var anim_time: float = 0.0
var swim_phase: float = 0.0
var external_gravity_accel: Vector3 = Vector3.ZERO

@onready var visual_root: Node3D = $VisualRoot
@onready var body_mesh: MeshInstance3D = $VisualRoot/BodyMesh
@onready var left_wing: Node3D = $VisualRoot/LeftWing
@onready var right_wing: Node3D = $VisualRoot/RightWing
@onready var nucleus_core: MeshInstance3D = $VisualRoot/NucleusCore
@onready var camera_3d: Camera3D = $CameraRig/Camera3D
@onready var bio_light: OmniLight3D = $VisualRoot/BioLight

var left_mandible: Node3D = null
var right_mandible: Node3D = null
var tendrils: Array[Node3D] = []
var dorsal_plates: Array[MeshInstance3D] = []

func _ready() -> void:
	add_to_group("player_ship")
	camera_height = default_camera_height
	target_camera_height = default_camera_height
	_build_detailed_bio_anatomy()
	_update_camera_transform()
	if not Engine.is_editor_hint():
		velocity = Vector3(1.5, 0.0, 0.0)

func trigger_warp_arrival_zoom() -> void:
	camera_height = min(max_camera_height, default_camera_height * 1.85)
	target_camera_height = default_camera_height
	_update_camera_transform()

func _update_camera_transform() -> void:
	if not is_inside_tree() or not camera_3d:
		return
	camera_3d.projection = Camera3D.PROJECTION_PERSPECTIVE
	if use_orthogonal_isometric:
		camera_3d.fov = 22.0
		var iso_h: float = camera_height * 2.05
		var iso_z: float = iso_h * 0.38
		camera_3d.global_position = Vector3(global_position.x, iso_h, global_position.z + iso_z)
	else:
		camera_3d.fov = camera_fov
		var z_off: float = max(0.5, camera_height * camera_tilt_ratio)
		camera_3d.global_position = Vector3(global_position.x, camera_height, global_position.z + z_off)
	camera_3d.look_at(global_position, Vector3.UP)

func _build_detailed_bio_anatomy() -> void:
	if not visual_root:
		return
	var existing: Node = visual_root.get_node_or_null("ProceduralAnatomy")
	if existing:
		existing.queue_free()

	var anatomy_root := Node3D.new()
	anatomy_root.name = "ProceduralAnatomy"
	visual_root.add_child(anatomy_root)

	dorsal_plates.clear()
	tendrils.clear()

	var dorsal_mat := StandardMaterial3D.new()
	dorsal_mat.albedo_color = Color(0.04, 0.25, 0.22)
	dorsal_mat.metallic = 0.78
	dorsal_mat.roughness = 0.28
	dorsal_mat.emission_enabled = true
	dorsal_mat.emission = Color(0.02, 0.35, 0.24)
	dorsal_mat.emission_energy_multiplier = 0.4

	var biolum_mat := StandardMaterial3D.new()
	biolum_mat.albedo_color = Color(0.0, 1.0, 0.55)
	biolum_mat.emission_enabled = true
	biolum_mat.emission = Color(0.0, 1.0, 0.55)
	biolum_mat.emission_energy_multiplier = 1.8

	# 1. Segmented Dorsal Carapace Plates (Trilobite spinal crests along Z)
	for i in range(5):
		var plate := MeshInstance3D.new()
		var cyl := CylinderMesh.new()
		var p_size: float = 0.72 - float(i) * 0.09
		cyl.top_radius = p_size * 0.65
		cyl.bottom_radius = p_size
		cyl.height = 0.28
		cyl.material = dorsal_mat
		plate.mesh = cyl
		plate.position = Vector3(0.0, 0.22 - float(i) * 0.02, -0.5 + float(i) * 0.42)
		plate.scale = Vector3(1.0, 0.45, 0.85)
		anatomy_root.add_child(plate)
		dorsal_plates.append(plate)

	# 2. Predatory Front Mandibles (Grasping pincers at nose -Z)
	left_mandible = Node3D.new()
	left_mandible.position = Vector3(-0.35, 0.0, -1.15)
	anatomy_root.add_child(left_mandible)

	right_mandible = Node3D.new()
	right_mandible.position = Vector3(0.35, 0.0, -1.15)
	anatomy_root.add_child(right_mandible)

	var mand_mesh := CylinderMesh.new()
	mand_mesh.top_radius = 0.02
	mand_mesh.bottom_radius = 0.18
	mand_mesh.height = 1.05
	mand_mesh.material = dorsal_mat

	var l_mand_inst := MeshInstance3D.new()
	l_mand_inst.mesh = mand_mesh
	l_mand_inst.rotation.x = PI * 0.5
	l_mand_inst.rotation.y = -0.22
	l_mand_inst.position = Vector3(0.0, 0.0, -0.45)
	left_mandible.add_child(l_mand_inst)

	var r_mand_inst := MeshInstance3D.new()
	r_mand_inst.mesh = mand_mesh
	r_mand_inst.rotation.x = PI * 0.5
	r_mand_inst.rotation.y = 0.22
	r_mand_inst.position = Vector3(0.0, 0.0, -0.45)
	right_mandible.add_child(r_mand_inst)

	# 3. Twin Bio-Whip Tendrils (Swaying tail appendages at +Z)
	for t in range(2):
		var t_root := Node3D.new()
		t_root.position = Vector3(-0.32 if t == 0 else 0.32, 0.0, 1.25)
		anatomy_root.add_child(t_root)
		var parent_joint: Node3D = t_root
		for s in range(6):
			var seg_node := Node3D.new()
			seg_node.position = Vector3(0.0, 0.0, 0.36)
			var seg_inst := MeshInstance3D.new()
			var seg_cyl := CylinderMesh.new()
			seg_cyl.top_radius = max(0.02, 0.13 - float(s) * 0.018)
			seg_cyl.bottom_radius = max(0.03, 0.15 - float(s) * 0.018)
			seg_cyl.height = 0.38
			seg_cyl.material = biolum_mat if s >= 4 else dorsal_mat
			seg_inst.mesh = seg_cyl
			seg_inst.rotation.x = PI * 0.5
			seg_node.add_child(seg_inst)
			parent_joint.add_child(seg_node)
			parent_joint = seg_node
		tendrils.append(t_root)

func _unhandled_input(event: InputEvent) -> void:
	if Engine.is_editor_hint():
		return
	if event is InputEventMouseButton:
		var mb: InputEventMouseButton = event as InputEventMouseButton
		if mb.button_index == MOUSE_BUTTON_WHEEL_UP and mb.pressed:
			target_camera_height = clamp(target_camera_height - 7.0, min_camera_height, max_camera_height)
		elif mb.button_index == MOUSE_BUTTON_WHEEL_DOWN and mb.pressed:
			target_camera_height = clamp(target_camera_height + 7.0, min_camera_height, max_camera_height)
	elif event is InputEventPanGesture:
		var pan: InputEventPanGesture = event as InputEventPanGesture
		target_camera_height = clamp(target_camera_height + pan.delta.y * 6.0, min_camera_height, max_camera_height)
	elif event is InputEventMagnifyGesture:
		var mag: InputEventMagnifyGesture = event as InputEventMagnifyGesture
		target_camera_height = clamp(target_camera_height / max(0.5, mag.factor), min_camera_height, max_camera_height)
	elif event is InputEventKey and event.pressed and not event.echo:
		var ke: InputEventKey = event as InputEventKey
		if ke.keycode in [KEY_MINUS, KEY_KP_SUBTRACT, KEY_PAGEDOWN]:
			target_camera_height = clamp(target_camera_height + 12.0, min_camera_height, max_camera_height)
		elif ke.keycode in [KEY_EQUAL, KEY_PLUS, KEY_KP_ADD, KEY_PAGEUP]:
			target_camera_height = clamp(target_camera_height - 12.0, min_camera_height, max_camera_height)
		elif ke.keycode == KEY_C:
			use_orthogonal_isometric = not use_orthogonal_isometric
			GameState.add_log("KAMERA", "🎥 Projektion: %s" % ("Tele-Isometrisch (FOV 22°)" if use_orthogonal_isometric else "Top-Down Perspektive (FOV %.0f°)" % camera_fov))

func _physics_process(delta: float) -> void:
	if Engine.is_editor_hint():
		return
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

	# 2. Forward Thrust (W / Up), Retro Braking (S / Down) & Wave-Like Swimming Locomotion
	var is_thrusting := Input.is_key_pressed(KEY_W) or Input.is_key_pressed(KEY_UP)
	var is_braking := Input.is_key_pressed(KEY_S) or Input.is_key_pressed(KEY_DOWN)

	var speed_ratio: float = clamp(velocity.length() / max(1.0, max_speed), 0.0, 1.0)
	var active_freq: float = (wave_swim_frequency * 1.45) if is_thrusting else (wave_swim_frequency * (0.55 + speed_ratio * 0.45))
	swim_phase += delta * active_freq

	var forward_dir := Vector3(cos(ship_heading), 0.0, -sin(ship_heading)).normalized()
	var lateral_dir := Vector3(sin(ship_heading), 0.0, cos(ship_heading)).normalized()

	# Apply celestial body gravity acceleration
	velocity += external_gravity_accel * gravity_influence_multiplier * delta

	if is_thrusting:
		# Organic rhythmic swimming propulsion pulse (strongest on the downstroke of the wave)
		var stroke_pulse: float = 0.78 + 0.44 * pow(abs(cos(swim_phase)), 1.5)
		velocity += forward_dir * (thrust_strength * stroke_pulse) * delta
		GameState.bio_energy = max(0.0, GameState.bio_energy - 3.5 * delta)
		if GameState.flight_assist:
			var forward_speed := velocity.dot(forward_dir)
			var lateral := velocity - forward_dir * forward_speed
			velocity -= lateral * min(1.0, delta * 4.5)
	else:
		GameState.bio_energy = min(GameState.max_bio_energy, GameState.bio_energy + 2.5 * delta)

	if bio_light:
		bio_light.light_energy = 2.4 + sin(swim_phase) * 0.5 if is_thrusting else 1.6

	if is_braking:
		velocity = velocity.move_toward(Vector3.ZERO, retro_thrust_strength * delta)

	if velocity.length() > max_speed:
		velocity = velocity.normalized() * max_speed
	velocity.y = 0.0

	move_and_slide()
	global_position.y = 0.0

	# 3. Traveling Sine-Wave Body Undulation (Slithering / Manta-Swimming Motion)
	var swim_intensity: float = 1.0 if is_thrusting else (0.28 + speed_ratio * 0.55)
	var body_sway_yaw: float = sin(swim_phase) * 0.14 * swim_intensity
	var body_sway_offset: float = cos(swim_phase) * wave_swim_amplitude * swim_intensity

	if visual_root:
		# Visual hull weaves smoothly left/right perpendicular to flight heading without shaking the camera!
		visual_root.position = lateral_dir * body_sway_offset
		visual_root.rotation.y = (ship_heading - PI * 0.5) + body_sway_yaw
		visual_root.rotation.z = lerpf(visual_root.rotation.z, -turn_input * 0.28 + sin(swim_phase) * 0.08 * swim_intensity, min(1.0, delta * 8.0))
		visual_root.rotation.x = cos(swim_phase) * 0.07 * swim_intensity

	# Traveling wave along the 5 Dorsal Carapace Plates (head-to-tail phase lag)
	for i in range(dorsal_plates.size()):
		var plate: MeshInstance3D = dorsal_plates[i]
		if is_instance_valid(plate):
			var plate_phase: float = swim_phase - float(i) * 0.52
			plate.position.x = sin(plate_phase) * 0.11 * swim_intensity
			plate.position.y = (0.22 - float(i) * 0.02) + cos(plate_phase) * 0.04 * swim_intensity
			plate.rotation.y = cos(plate_phase) * 0.12 * swim_intensity

	# Fluid Manta-Wing Undulation (figure-eight pitch + roll wave)
	var flap_amp: float = 0.28 * swim_intensity
	if left_wing:
		left_wing.rotation.z = sin(swim_phase - 0.3) * flap_amp
		left_wing.rotation.x = cos(swim_phase - 0.3) * (flap_amp * 0.45)
	if right_wing:
		right_wing.rotation.z = -sin(swim_phase - 0.3) * flap_amp
		right_wing.rotation.x = cos(swim_phase - 0.3) * (flap_amp * 0.45)

	if nucleus_core:
		var pulse := 1.0 + sin(swim_phase * 1.2) * 0.11
		nucleus_core.scale = Vector3(pulse, pulse, pulse)

	if left_mandible and right_mandible:
		var pinch := sin(swim_phase * 0.8) * 0.12
		left_mandible.rotation.y = pinch
		right_mandible.rotation.y = -pinch

	# Traveling S-Wave along the Twin 6-Segment Tail Tendrils (in-phase swimming whip)
	for t_idx in range(tendrils.size()):
		var t_root: Node3D = tendrils[t_idx]
		var cur: Node3D = t_root
		var seg_i: int = 0
		while cur.get_child_count() > 0:
			var next_joint: Node3D = null
			for c in cur.get_children():
				if c is Node3D and not (c is MeshInstance3D):
					next_joint = c
					break
			if next_joint == null:
				break
			var seg_phase: float = swim_phase - 0.85 - float(seg_i) * 0.58
			next_joint.rotation.y = sin(seg_phase) * (0.16 + float(seg_i) * 0.025) * swim_intensity
			next_joint.rotation.x = cos(seg_phase) * 0.05 * swim_intensity
			cur = next_joint
			seg_i += 1

	# 4. Smooth Top-Down / Angled Camera Follow (follows center of mass so camera never wobbles)
	camera_height = lerpf(camera_height, target_camera_height, min(1.0, delta * 6.0))
	_update_camera_transform()
