extends Node3D
class_name HostileDrone

## Testable Hostile INSAN Patrol / Interceptor Drone (Godot 4.6)
## Features 3D procedural hull, top-down readable diegetic 3D HP bar,
## patrol/aggro/strafe/fire AI, directional knockback & EMP/Psi stun state.

var display_name: String = "INSAN Aufklärer-Drohne"
var variant: String = "scout"
var max_hp: float = 70.0
var hp: float = 70.0
var hit_radius: float = 1.8
var move_speed: float = 16.0
var turn_speed: float = 3.4
var aggro_range: float = 90.0
var preferred_range: float = 26.0
var fire_interval: float = 1.85
var fire_cooldown: float = 0.8
var bolt_speed: float = 34.0
var bolt_damage: float = 6.0
var stun_timer: float = 0.0
var hit_flash_timer: float = 0.0
var velocity: Vector3 = Vector3.ZERO
var heading: float = 0.0
var patrol_anchor: Vector3 = Vector3.ZERO
var patrol_angle: float = 0.0
var orbit_sign: float = 1.0

var visual_root: Node3D = null
var hull_mat: StandardMaterial3D = null
var eye_mat: StandardMaterial3D = null
var thruster_light: OmniLight3D = null
var hp_bar_root: Node3D = null
var hp_fill_mesh: MeshInstance3D = null
var hp_fill_mat: StandardMaterial3D = null

func setup_drone(p_variant: String, p_anchor: Vector3, p_initial_heading: float = 0.0) -> void:
	variant = p_variant
	patrol_anchor = Vector3(p_anchor.x, 0.0, p_anchor.z)
	heading = p_initial_heading
	patrol_angle = randf() * TAU
	orbit_sign = 1.0 if randf() > 0.5 else -1.0

	var scale_factor: float = 1.15
	if variant == "enforcer":
		display_name = "INSAN Abfangjäger-Drohne"
		max_hp = 110.0
		hit_radius = 2.15
		move_speed = 12.5
		fire_interval = 1.55
		bolt_speed = 38.0
		bolt_damage = 9.0
		scale_factor = 1.38
	else:
		display_name = "INSAN Aufklärer-Drohne"
		max_hp = 70.0
		hit_radius = 1.8
		move_speed = 16.0
		fire_interval = 1.9
		bolt_speed = 34.0
		bolt_damage = 6.0
		scale_factor = 1.15

	hp = max_hp
	fire_cooldown = randf_range(0.65, 1.35)
	stun_timer = 0.0
	hit_flash_timer = 0.0
	velocity = Vector3.ZERO

	_build_visuals(scale_factor)
	_update_hp_bar()

func _build_visuals(scale_factor: float) -> void:
	for child in get_children():
		child.queue_free()

	visual_root = Node3D.new()
	visual_root.name = "VisualRoot"
	visual_root.scale = Vector3(scale_factor, scale_factor, scale_factor)
	visual_root.rotation.y = heading - PI * 0.5
	add_child(visual_root)

	hull_mat = StandardMaterial3D.new()
	hull_mat.albedo_color = Color(0.16, 0.19, 0.25)
	hull_mat.metallic = 0.85
	hull_mat.roughness = 0.28
	hull_mat.emission_enabled = true
	hull_mat.emission = Color(0.12, 0.04, 0.06)
	hull_mat.emission_energy_multiplier = 0.4

	eye_mat = StandardMaterial3D.new()
	eye_mat.albedo_color = Color(1.0, 0.16, 0.14)
	eye_mat.emission_enabled = true
	eye_mat.emission = Color(1.0, 0.16, 0.14)
	eye_mat.emission_energy_multiplier = 2.2

	var accent_mat := StandardMaterial3D.new()
	accent_mat.albedo_color = Color(0.85, 0.18, 0.16)
	accent_mat.metallic = 0.65
	accent_mat.roughness = 0.35
	accent_mat.emission_enabled = true
	accent_mat.emission = Color(0.75, 0.12, 0.12)
	accent_mat.emission_energy_multiplier = 0.65

	# Central octagonal core
	var core_inst := MeshInstance3D.new()
	var core_cyl := CylinderMesh.new()
	core_cyl.top_radius = 0.68
	core_cyl.bottom_radius = 0.88
	core_cyl.height = 0.52
	core_cyl.radial_segments = 8
	core_cyl.material = hull_mat
	core_inst.mesh = core_cyl
	visual_root.add_child(core_inst)

	# Swept interceptor wings
	for side_idx in range(2):
		var side_sign: float = -1.0 if side_idx == 0 else 1.0
		var wing := MeshInstance3D.new()
		var w_box := BoxMesh.new()
		w_box.size = Vector3(1.15, 0.14, 0.92)
		w_box.material = hull_mat
		wing.mesh = w_box
		wing.position = Vector3(side_sign * 1.05, 0.0, 0.22)
		wing.rotation.y = side_sign * 0.38
		visual_root.add_child(wing)

		var trim := MeshInstance3D.new()
		var t_box := BoxMesh.new()
		t_box.size = Vector3(0.95, 0.16, 0.14)
		t_box.material = accent_mat
		trim.mesh = t_box
		trim.position = Vector3(side_sign * 1.08, 0.02, -0.18)
		trim.rotation.y = side_sign * 0.38
		visual_root.add_child(trim)

	# Forward red sensor eye / plasma emitter (-Z)
	var eye_inst := MeshInstance3D.new()
	var eye_sph := SphereMesh.new()
	eye_sph.radius = 0.32
	eye_sph.height = 0.64
	eye_sph.material = eye_mat
	eye_inst.mesh = eye_sph
	eye_inst.position = Vector3(0.0, 0.12, -0.78)
	visual_root.add_child(eye_inst)

	thruster_light = OmniLight3D.new()
	thruster_light.light_color = Color(1.0, 0.22, 0.18)
	thruster_light.light_energy = 1.4
	thruster_light.omni_range = 10.0
	thruster_light.position = Vector3(0.0, 0.6, -0.5)
	visual_root.add_child(thruster_light)

	# Diegetic 3D HP bar above drone (kept on self so it stays screen-aligned in top-down view)
	hp_bar_root = Node3D.new()
	hp_bar_root.name = "HPBarRoot"
	hp_bar_root.position = Vector3(0.0, 2.3 * scale_factor * 0.88, -1.65)
	add_child(hp_bar_root)

	var bg_mat := StandardMaterial3D.new()
	bg_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	bg_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	bg_mat.albedo_color = Color(0.05, 0.08, 0.12, 0.85)
	var bg_inst := MeshInstance3D.new()
	var bg_box := BoxMesh.new()
	bg_box.size = Vector3(3.0, 0.06, 0.42)
	bg_box.material = bg_mat
	bg_inst.mesh = bg_box
	hp_bar_root.add_child(bg_inst)

	hp_fill_mat = StandardMaterial3D.new()
	hp_fill_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	hp_fill_mat.albedo_color = Color(0.95, 0.25, 0.22)
	hp_fill_mesh = MeshInstance3D.new()
	var fill_box := BoxMesh.new()
	fill_box.size = Vector3(2.86, 0.09, 0.30)
	fill_box.material = hp_fill_mat
	hp_fill_mesh.mesh = fill_box
	hp_fill_mesh.position = Vector3(0.0, 0.02, 0.0)
	hp_bar_root.add_child(hp_fill_mesh)

func is_stunned() -> bool:
	return stun_timer > 0.0

func apply_psi_hit(damage: float, stun_sec: float, knockback_vel: Vector3) -> bool:
	hp = max(0.0, hp - damage)
	stun_timer = max(stun_timer, stun_sec)
	hit_flash_timer = 0.24
	var kb: Vector3 = Vector3(knockback_vel.x, 0.0, knockback_vel.z)
	velocity += kb
	_update_hp_bar()
	return hp <= 0.0

func _update_hp_bar() -> void:
	if not hp_fill_mesh or not hp_fill_mat:
		return
	var ratio: float = clamp(hp / max(1.0, max_hp), 0.0, 1.0)
	hp_fill_mesh.visible = ratio > 0.005
	hp_fill_mesh.scale.x = max(0.01, ratio)
	hp_fill_mesh.position.x = -1.43 * (1.0 - ratio)
	if stun_timer > 0.0:
		hp_fill_mat.albedo_color = Color(0.55, 0.48, 1.0)
	elif ratio > 0.55:
		hp_fill_mat.albedo_color = Color(0.95, 0.25, 0.22)
	elif ratio > 0.28:
		hp_fill_mat.albedo_color = Color(1.0, 0.62, 0.16)
	else:
		hp_fill_mat.albedo_color = Color(1.0, 0.9, 0.28)

func update_combat_ai(delta: float, player_pos: Vector3, fire_callback: Callable) -> void:
	var was_stunned: bool = stun_timer > 0.0
	if hit_flash_timer > 0.0:
		hit_flash_timer = max(0.0, hit_flash_timer - delta)
	if stun_timer > 0.0:
		stun_timer = max(0.0, stun_timer - delta)
		if stun_timer <= 0.0 and was_stunned:
			_update_hp_bar()

	if stun_timer > 0.0:
		# Stunned / EMP-disrupted: spin slightly, coast to a halt, do not shoot
		velocity = velocity.move_toward(Vector3.ZERO, 8.5 * delta)
		heading += delta * 2.8 * orbit_sign
	else:
		var to_player: Vector3 = Vector3(player_pos.x - global_position.x, 0.0, player_pos.z - global_position.z)
		var dist: float = to_player.length()
		if dist <= aggro_range and dist > 0.1:
			var dir_p: Vector3 = to_player / dist
			var desired_heading: float = atan2(-dir_p.z, dir_p.x)
			heading = lerp_angle(heading, desired_heading, min(1.0, delta * turn_speed))

			var desired_vel: Vector3 = Vector3.ZERO
			var tangent: Vector3 = Vector3(-dir_p.z, 0.0, dir_p.x) * orbit_sign * 0.72
			if dist > preferred_range + 6.0:
				desired_vel = (dir_p + tangent * 0.45).normalized() * move_speed
			elif dist < 14.0:
				desired_vel = (-dir_p * 0.65 + tangent).normalized() * (move_speed * 0.85)
			else:
				desired_vel = tangent.normalized() * (move_speed * 0.82)
			velocity = velocity.move_toward(desired_vel, 18.0 * delta)

			fire_cooldown -= delta
			if fire_cooldown <= 0.0 and dist <= 62.0 and abs(angle_difference(heading, desired_heading)) < 0.52:
				var forward_dir: Vector3 = Vector3(cos(heading), 0.0, -sin(heading)).normalized()
				fire_callback.call(global_position + forward_dir * 1.8, forward_dir, bolt_speed, bolt_damage)
				fire_cooldown = fire_interval * randf_range(0.85, 1.18)
		else:
			patrol_angle += delta * 0.45 * orbit_sign
			var target_pt: Vector3 = patrol_anchor + Vector3(cos(patrol_angle), 0.0, sin(patrol_angle)) * 18.0
			var to_patrol: Vector3 = Vector3(target_pt.x - global_position.x, 0.0, target_pt.z - global_position.z)
			if to_patrol.length() > 0.5:
				var p_dir: Vector3 = to_patrol.normalized()
				var pat_head: float = atan2(-p_dir.z, p_dir.x)
				heading = lerp_angle(heading, pat_head, min(1.0, delta * (turn_speed * 0.65)))
				velocity = velocity.move_toward(p_dir * (move_speed * 0.55), 10.0 * delta)

	global_position += velocity * delta
	global_position.y = 0.0
	if visual_root:
		visual_root.rotation.y = heading - PI * 0.5

	_update_visual_feedback()

func _update_visual_feedback() -> void:
	if not hull_mat or not eye_mat or not thruster_light:
		return
	if hit_flash_timer > 0.0:
		hull_mat.emission = Color(0.65, 0.55, 1.0)
		hull_mat.emission_energy_multiplier = 2.2
		eye_mat.albedo_color = Color(0.85, 0.95, 1.0)
		eye_mat.emission = Color(0.65, 0.45, 1.0)
		thruster_light.light_color = Color(0.65, 0.45, 1.0)
		thruster_light.light_energy = 2.8
	elif stun_timer > 0.0:
		var flicker: float = 0.5 + 0.5 * sin(float(Time.get_ticks_msec()) * 0.025)
		hull_mat.emission = Color(0.32, 0.24, 0.85)
		hull_mat.emission_energy_multiplier = 0.5 + flicker * 0.7
		eye_mat.albedo_color = Color(0.55, 0.42, 1.0)
		eye_mat.emission = Color(0.45, 0.65, 1.0)
		thruster_light.light_color = Color(0.55, 0.42, 1.0)
		thruster_light.light_energy = 0.8 + flicker * 1.2
		_update_hp_bar()
	else:
		hull_mat.emission = Color(0.12, 0.04, 0.06)
		hull_mat.emission_energy_multiplier = 0.4
		eye_mat.albedo_color = Color(1.0, 0.16, 0.14)
		eye_mat.emission = Color(1.0, 0.16, 0.14)
		thruster_light.light_color = Color(1.0, 0.22, 0.18)
		thruster_light.light_energy = 1.4
