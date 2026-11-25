@tool
extends Node3D

## Star System World Manager for Project Najmafar (Godot 4.6)
## Runs with @tool so the entire Star System (Sun, 8K Planets, Moons, Orbit Rings, Stations & Jamal's Ship)
## is visible and inspectable LIVE inside the Godot 3D Editor Viewport!

@export_category("3D Editor Live Preview")
@export_range(0, 15, 1) var editor_preview_system_id: int = 1:
	set(value):
		editor_preview_system_id = value
		if Engine.is_editor_hint() and is_inside_tree():
			_rebuild_in_editor()
@export var editor_live_simulation: bool = true:
	set(value):
		editor_live_simulation = value
		if procedural_container:
			for child in procedural_container.get_children():
				if child is OrbitingEntity:
					(child as OrbitingEntity).animate_in_editor = value
@export_range(40.0, 900.0, 10.0) var editor_camera_height: float = 260.0:
	set(value):
		editor_camera_height = value
		if Engine.is_editor_hint() and is_inside_tree():
			_focus_editor_viewport_camera()
@export var center_editor_camera_now: bool = false:
	set(value):
		center_editor_camera_now = false
		if Engine.is_editor_hint() and is_inside_tree():
			_focus_editor_viewport_camera()

@export_category("Navigation & Kurslinie")
@export var show_trajectory_line: bool = true
@export_range(2.0, 20.0, 0.5) var trajectory_duration_sec: float = 8.0
@export_range(16, 80, 2) var trajectory_steps: int = 44

@export_category("Kampf & Psi-Kegel")
@export_range(18.0, 80.0, 1.0) var psi_cone_range: float = 42.0
@export_range(12.0, 55.0, 1.0) var psi_cone_half_angle_deg: float = 28.0
@export_range(0.25, 3.0, 0.05) var psi_cone_cooldown: float = 0.75
@export var psi_cone_base_damage: float = 38.0
@export var psi_cone_stun_sec: float = 3.2

const HostileDroneScript: GDScript = preload("res://scripts/entities/hostile_drone.gd")

@onready var procedural_container: Node3D = $ProceduralSystemContainer
@onready var player_ship: PlayerBioShip = $PlayerBioShip
@onready var world_env: WorldEnvironment = $WorldEnvironment

var interactable_bodies: Array[Node3D] = []
var active_asteroids: Array[Node3D] = []
var active_hostiles: Array[Node3D] = []
var active_enemy_projectiles: Array[Dictionary] = []
var psi_cone_cooldown_timer: float = 0.0
var monolith_bump_cooldown: float = 0.0
var texture_cache: Dictionary = {}
var bgm_player: AudioStreamPlayer = null
var sfx_pool: Array[AudioStreamPlayer] = []
var sfx_pool_index: int = 0
var channel_sfx_player: AudioStreamPlayer = null
var sfx_cache: Dictionary = {}
var target_reticle_ring: MeshInstance3D = null
var target_reticle_mat: StandardMaterial3D = null
var trajectory_mesh_inst: MeshInstance3D = null
var trajectory_imm_mesh: ImmediateMesh = null
var current_star_size: float = 18.0
var current_star_mass: float = 160.0

# Continuous Channeling State (Scan [F], Harvest [E], Abduct [R])
var active_channel_mode: String = "" # "", "scan", "harvest", "abduct"
var active_channel_target: Node3D = null
var active_channel_progress: float = 0.0
var active_channel_beam: Node3D = null
var active_channel_ring: MeshInstance3D = null

const PLANET_TEXTURES := {
	"SUN": "res://assets/textures/planets/8k_sun.jpg",
	"MERCURY": "res://assets/textures/planets/8k_mercury.jpg",
	"VENUS_SURFACE": "res://assets/textures/planets/8k_venus_surface.jpg",
	"VENUS_ATMOSPHERE": "res://assets/textures/planets/4k_venus_atmosphere.jpg",
	"EARTH_DAY": "res://assets/textures/planets/8k_earth_daymap.jpg",
	"EARTH_NIGHT": "res://assets/textures/planets/8k_earth_nightmap.jpg",
	"EARTH_CLOUDS": "res://assets/textures/planets/8k_earth_clouds.jpg",
	"EARTH_NORMAL": "res://assets/textures/planets/8k_earth_normal_map.png",
	"EARTH_SPECULAR": "res://assets/textures/planets/8k_earth_specular_map.png",
	"MOON": "res://assets/textures/planets/8k_moon.jpg",
	"MARS": "res://assets/textures/planets/8k_mars.jpg",
	"MARS_PHOBOS": "res://assets/textures/planets/mars_phobos.jpg",
	"MARS_DEIMOS": "res://assets/textures/planets/mars_deimos.jpg",
	"JUPITER": "res://assets/textures/planets/8k_jupiter.jpg",
	"JUPITER_IO": "res://assets/textures/planets/jupiter_io.jpg",
	"JUPITER_EUROPA": "res://assets/textures/planets/jupiter_europa.jpg",
	"JUPITER_GANYMEDE": "res://assets/textures/planets/jupiter_ganymede.jpg",
	"JUPITER_CALLISTO": "res://assets/textures/planets/jupiter_callisto.jpg",
	"SATURN": "res://assets/textures/planets/8k_saturn.jpg",
	"SATURN_RINGS": "res://assets/textures/planets/8k_saturn_ring_alpha.png",
	"SATURN_TITAN": "res://assets/textures/planets/saturn_titan.jpg",
	"URANUS": "res://assets/textures/planets/2k_uranus.jpg",
	"NEPTUNE": "res://assets/textures/planets/2k_neptune.jpg",
	"MILKY_WAY": "res://assets/textures/space/8k_stars_milky_way.jpg"
}

func _ready() -> void:
	_setup_milky_way_skybox()
	if Engine.is_editor_hint():
		_rebuild_in_editor()
		return

	_setup_audio()
	GameState.system_changed.connect(_on_system_changed)
	GameState.player_emergency_revived.connect(_on_player_emergency_revived)
	QuestManager.decoy_trap_triggered.connect(_on_decoy_trap_triggered)
	QuestManager.real_ship_liberated_visual.connect(_on_real_ship_liberated_visual)
	build_star_system(GameState.get_current_system())
	# Trigger Dr. Tariq Jamal's initial telepathic greeting shortly after arrival
	get_tree().create_timer(0.8).timeout.connect(func():
		if not QuestManager.is_dialogue_open and GameState.current_system_id == 1:
			QuestManager.open_dialogue("jamal_orbit_intro")
	)

func _rebuild_in_editor() -> void:
	var sys_data: Dictionary = _load_system_from_json_for_editor(editor_preview_system_id)
	if not sys_data.is_empty():
		build_star_system(sys_data)
		_focus_editor_viewport_camera()

func _focus_editor_viewport_camera() -> void:
	if not Engine.is_editor_hint():
		return
	if Engine.has_singleton("EditorInterface"):
		var ei: Object = Engine.get_singleton("EditorInterface")
		var vp: SubViewport = ei.call("get_editor_viewport_3d", 0) as SubViewport
		if vp:
			var cam: Camera3D = vp.get_camera_3d()
			if cam:
				cam.global_position = Vector3(0.0, editor_camera_height, editor_camera_height * 0.45)
				cam.look_at(Vector3.ZERO, Vector3.UP)

func _load_system_from_json_for_editor(target_id: int) -> Dictionary:
	var path := "res://data/universe_data.json"
	if not FileAccess.file_exists(path):
		return {}
	var file := FileAccess.open(path, FileAccess.READ)
	var parsed = JSON.parse_string(file.get_as_text())
	if typeof(parsed) == TYPE_DICTIONARY and parsed.has("systems"):
		var systems_arr: Array = parsed["systems"]
		for sys in systems_arr:
			if typeof(sys) == TYPE_DICTIONARY and int(sys.get("id", -1)) == target_id:
				return sys
		if systems_arr.size() > 0:
			return systems_arr[0]
	return {}

func _load_tex(res_path: String) -> Texture2D:
	if res_path == "":
		return null
	var normalized := res_path
	if not normalized.begins_with("res://"):
		normalized = "res://" + normalized.trim_prefix("/")
	if texture_cache.has(normalized):
		return texture_cache[normalized]
	if ResourceLoader.exists(normalized):
		var tex: Texture2D = load(normalized) as Texture2D
		if tex:
			texture_cache[normalized] = tex
			return tex
	return null

func _setup_milky_way_skybox() -> void:
	if not world_env:
		world_env = get_node_or_null("WorldEnvironment") as WorldEnvironment
	if not world_env or not world_env.environment:
		return
	var mw_tex := _load_tex(PLANET_TEXTURES["MILKY_WAY"])
	if mw_tex:
		var pano := PanoramaSkyMaterial.new()
		pano.panorama = mw_tex
		pano.energy_multiplier = 0.85
		var sky := Sky.new()
		sky.sky_material = pano
		world_env.environment.background_mode = Environment.BG_SKY
		world_env.environment.sky = sky

const BGM_TRACKS: Array[String] = [
	"res://assets/music/outer_rim_solitude.wav",
	"res://assets/music/najmafar_void_theme.wav",
	"res://assets/music/psionic_resonance.wav"
]
var current_bgm_index: int = 0

func _setup_audio() -> void:
	bgm_player = AudioStreamPlayer.new()
	bgm_player.volume_db = -10.0
	add_child(bgm_player)
	bgm_player.finished.connect(_play_next_bgm_track)
	_play_next_bgm_track()

	sfx_pool.clear()
	for _i in range(8):
		var p := AudioStreamPlayer.new()
		p.volume_db = -8.0
		add_child(p)
		sfx_pool.append(p)

	channel_sfx_player = AudioStreamPlayer.new()
	channel_sfx_player.volume_db = -9.5
	add_child(channel_sfx_player)

func _play_next_bgm_track() -> void:
	if not bgm_player or BGM_TRACKS.is_empty():
		return
	var track_path: String = BGM_TRACKS[current_bgm_index % BGM_TRACKS.size()]
	current_bgm_index = (current_bgm_index + 1) % BGM_TRACKS.size()
	if ResourceLoader.exists(track_path):
		bgm_player.stream = load(track_path)
		bgm_player.play()

func _load_sfx(sfx_name: String) -> AudioStream:
	if sfx_cache.has(sfx_name):
		return sfx_cache[sfx_name] as AudioStream
	var path: String = "res://assets/sfx/" + sfx_name
	if ResourceLoader.exists(path):
		var stream: AudioStream = load(path) as AudioStream
		if stream:
			sfx_cache[sfx_name] = stream
			return stream
	return null

func _play_sfx(sfx_name: String, pitch: float = 1.0, vol_db: float = -8.0) -> void:
	if sfx_pool.is_empty():
		return
	var stream: AudioStream = _load_sfx(sfx_name)
	if not stream:
		return
	var target_player: AudioStreamPlayer = null
	for p in sfx_pool:
		if is_instance_valid(p) and not p.playing:
			target_player = p
			break
	if not target_player:
		target_player = sfx_pool[sfx_pool_index % sfx_pool.size()]
		sfx_pool_index = (sfx_pool_index + 1) % sfx_pool.size()
	target_player.stream = stream
	target_player.pitch_scale = pitch
	target_player.volume_db = vol_db
	target_player.play()

func _start_channel_sfx(sfx_name: String, pitch: float = 1.0, vol_db: float = -9.5) -> void:
	if not channel_sfx_player:
		return
	var stream: AudioStream = _load_sfx(sfx_name)
	if not stream:
		return
	channel_sfx_player.stop()
	channel_sfx_player.stream = stream
	channel_sfx_player.pitch_scale = pitch
	channel_sfx_player.volume_db = vol_db
	channel_sfx_player.play()

func _stop_channel_sfx() -> void:
	if channel_sfx_player and is_instance_valid(channel_sfx_player) and channel_sfx_player.playing:
		channel_sfx_player.stop()

func _on_system_changed(_sys_id: int, sys_data: Dictionary) -> void:
	build_star_system(sys_data)
	_play_sfx("warp_slide.wav", 1.0, -7.5)
	if player_ship:
		player_ship.trigger_warp_arrival_zoom()
	var is_depot: bool = sys_data.get("isInsanDepot", false) or String(sys_data.get("name", "")).contains("INSAN")
	if is_depot and not GameState.jamal_ship_liberated:
		QuestManager.advance_quest("prologue_jamal_ship", 3)
		QuestManager.open_dialogue("insan_depot_arrival")

func _compute_scaled_planet_distance(p_data: Dictionary, index: int) -> float:
	var raw_dist: float = float(p_data.get("distance", 20.0))
	# Match Three.js spacious orbital distance formula: 110 + (raw * 3.8) + (idx * 55)
	return 110.0 + (raw_dist * 3.8) + (float(index) * 55.0)

func build_star_system(sys_data: Dictionary) -> void:
	if not procedural_container:
		procedural_container = get_node_or_null("ProceduralSystemContainer") as Node3D
	if not procedural_container:
		return

	interactable_bodies.clear()
	active_asteroids.clear()
	active_hostiles.clear()
	active_enemy_projectiles.clear()
	psi_cone_cooldown_timer = 0.0
	_stop_channel_sfx()
	for child in procedural_container.get_children():
		child.queue_free()

	var sys_id: int = int(sys_data.get("id", 1))

	# 1. Central Star with 8K Solar Photosphere & Volumetric Corona Halo
	var star_info: Dictionary = sys_data.get("star", {"type": "Yellow Sun", "size": 14.0, "color": "0xffd700", "mass": 420.0})
	var star_size: float = max(14.0, float(star_info.get("size", 14.0)) * 1.35)
	current_star_size = star_size
	current_star_mass = float(star_info.get("mass", 420.0)) * 0.35
	var star_color := _parse_hex_color(String(star_info.get("color", "0xffd700")), Color(1.0, 0.84, 0.2))

	var star_mesh := MeshInstance3D.new()
	star_mesh.name = "CentralStar"
	var sphere := SphereMesh.new()
	sphere.radius = star_size
	sphere.height = star_size * 2.0
	sphere.radial_segments = 64
	sphere.rings = 32
	var star_mat := StandardMaterial3D.new()
	var sun_tex := _load_tex(PLANET_TEXTURES["SUN"])
	if sun_tex:
		star_mat.albedo_texture = sun_tex
		star_mat.emission_texture = sun_tex
	star_mat.albedo_color = star_color.lerp(Color.WHITE, 0.25)
	star_mat.emission_enabled = true
	star_mat.emission = star_color
	star_mat.emission_energy_multiplier = 2.4
	sphere.material = star_mat
	star_mesh.mesh = sphere
	procedural_container.add_child(star_mesh)

	# Outer Solar Corona Glow Shell
	var corona_mesh := MeshInstance3D.new()
	var corona_sphere := SphereMesh.new()
	corona_sphere.radius = star_size * 1.32
	corona_sphere.height = star_size * 2.64
	var corona_mat := StandardMaterial3D.new()
	corona_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	corona_mat.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	corona_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	corona_mat.albedo_color = Color(star_color.r, star_color.g, star_color.b, 0.22)
	corona_sphere.material = corona_mat
	corona_mesh.mesh = corona_sphere
	procedural_container.add_child(corona_mesh)

	var star_light := OmniLight3D.new()
	star_light.light_color = star_color.lerp(Color.WHITE, 0.4)
	star_light.light_energy = 4.5
	star_light.omni_range = 1800.0
	star_light.omni_attenuation = 0.12
	star_light.shadow_enabled = true
	star_light.position = Vector3(0.0, 8.0, 0.0)
	procedural_container.add_child(star_light)

	# 2. Planets, Spacious Orbit Lines & Moons
	var planets_list: Array = sys_data.get("planets", [])
	var planet_nodes: Array[OrbitingEntity] = []

	for i in range(planets_list.size()):
		var p_data: Dictionary = planets_list[i]
		var p_dist: float = _compute_scaled_planet_distance(p_data, i)
		var p_color := _parse_hex_color(String(p_data.get("color", "0x38bdf8")), Color(0.22, 0.74, 0.97))

		# Create visible Planetary Orbit Trajectory Ring around Star (0, 0, 0)
		var orbit_line := _create_orbit_ring_mesh(p_dist, Color(p_color.r, p_color.g, p_color.b, 0.18))
		procedural_container.add_child(orbit_line)

		var p_node := _create_planet_node(p_data, i, sys_id, p_dist)
		procedural_container.add_child(p_node)
		p_node.update_orbital_position(0.0)
		planet_nodes.append(p_node)
		interactable_bodies.append(p_node)

		# Spawn Moons for this planet
		var moons_list: Array = p_data.get("moons", [])
		for m_idx in range(moons_list.size()):
			var m_data: Dictionary = moons_list[m_idx]
			var m_node := _create_moon_node(m_data, p_node, m_idx)
			procedural_container.add_child(m_node)
			m_node.update_orbital_position(0.0)
			interactable_bodies.append(m_node)

	# 3. Rich Fly-Through Asteroid Belt + Local Fragments & Derelict Ship Wrecks
	var asteroids_list: Array = sys_data.get("asteroids", [])
	for ast in asteroids_list:
		if typeof(ast) == TYPE_DICTIONARY:
			var ast_node: Node3D = _create_asteroid_node(ast)
			procedural_container.add_child(ast_node)
			active_asteroids.append(ast_node)

	var belt_radius: float = _spawn_asteroid_belt(sys_id, planet_nodes)
	_spawn_derelict_wrecks(sys_id, belt_radius)

	# 4. Space Stations for Spacefaring Planets & Quest Entities
	for p_idx in range(planet_nodes.size()):
		var p_data: Dictionary = planets_list[p_idx]
		var spec = p_data.get("species", null)
		if typeof(spec) == TYPE_DICTIONARY and spec.get("techLevel", "") in ["Spacefaring", "Hyper-Advanced", "Industrial"]:
			_spawn_orbital_station(planet_nodes[p_idx], "%s Orbital-Habitat" % p_data.get("name", "Station"), false)

	var first_planet: OrbitingEntity = planet_nodes[0] if planet_nodes.size() > 0 else null
	var is_depot: bool = bool(sys_data.get("isInsanDepot", false)) or String(sys_data.get("name", "")).contains("INSAN")

	if sys_id == 1 and first_planet and not GameState.jamal_decoy_revealed:
		_spawn_jamal_shuttle(first_planet, false)
	elif is_depot and first_planet:
		_spawn_orbital_station(first_planet, "INSAN-Hauptverwaltung Zeta-9 (Schalter 7B)", true)
		if not GameState.jamal_ship_liberated:
			_spawn_jamal_shuttle(first_planet, true)
		_spawn_voyager_probe()
		if not Engine.is_editor_hint() and not GameState.jamal_ship_liberated:
			var fp_base: Vector3 = first_planet.global_position
			_spawn_hostile_drone("scout", fp_base + Vector3(-28.0, 0.0, 8.0), -0.4)
			_spawn_hostile_drone("enforcer", fp_base + Vector3(30.0, 0.0, 6.0), -2.6)

	# Position Player Ship near the first planet so the player immediately sees the planet, moons & Jamal's shuttle!
	if not player_ship:
		player_ship = get_node_or_null("PlayerBioShip") as PlayerBioShip
	if player_ship and first_planet:
		var fp_pos: Vector3 = first_planet.global_position
		player_ship.global_position = fp_pos + Vector3(0.0, 0.0, 38.0)
		if not Engine.is_editor_hint():
			player_ship.velocity = Vector3(1.2, 0.0, 0.0)

	# 5. Include any hand-placed nodes inside EditorPlacedObjects (or group "editor_placed_entities")!
	var editor_container: Node3D = get_node_or_null("EditorPlacedObjects") as Node3D
	if editor_container:
		for child in editor_container.get_children():
			if child is Node3D:
				var c_node: Node3D = child as Node3D
				var target_sys: int = int(c_node.get("spawn_in_system_id")) if c_node.get("spawn_in_system_id") != null else -1
				var should_show: bool = (target_sys == -1 or target_sys == sys_id)
				c_node.visible = should_show
				if should_show and not interactable_bodies.has(c_node):
					if c_node.get("planet_key") == "":
						c_node.set("planet_key", "%d_%s" % [sys_id, c_node.name])
					interactable_bodies.append(c_node)

	if is_inside_tree():
		for node in get_tree().get_nodes_in_group("editor_placed_entities"):
			if node is Node3D and (node as Node3D).visible and not interactable_bodies.has(node):
				interactable_bodies.append(node)

func _select_planet_template(p_data: Dictionary, seed_val: int) -> Dictionary:
	var explicit_tex: String = str(p_data.get("texture", ""))
	if explicit_tex != "":
		return {
			"map": explicit_tex,
			"cloud": str(p_data.get("cloudTexture", "")),
			"night": str(p_data.get("nightTexture", "")),
			"normal": str(p_data.get("normalTexture", "")),
			"spec": str(p_data.get("specularTexture", "")),
			"ring": str(p_data.get("ringTexture", "")),
			"authentic": true
		}

	var p_type: String = str(p_data.get("type", "Rocky"))
	var s: int = abs(seed_val)
	match p_type:
		"Habitable":
			return {
				"map": PLANET_TEXTURES["EARTH_DAY"],
				"cloud": PLANET_TEXTURES["EARTH_CLOUDS"],
				"night": PLANET_TEXTURES["EARTH_NIGHT"],
				"normal": PLANET_TEXTURES["EARTH_NORMAL"],
				"spec": PLANET_TEXTURES["EARTH_SPECULAR"],
				"authentic": false
			}
		"Gas Giant":
			return {
				"map": PLANET_TEXTURES["JUPITER"] if (s % 2 == 0) else PLANET_TEXTURES["SATURN"],
				"ring": PLANET_TEXTURES["SATURN_RINGS"] if (s % 2 == 1) else "",
				"authentic": false
			}
		"Ice", "Eismond":
			var ice_pick: int = s % 3
			return {
				"map": PLANET_TEXTURES["URANUS"] if ice_pick == 0 else (PLANET_TEXTURES["NEPTUNE"] if ice_pick == 1 else PLANET_TEXTURES["JUPITER_EUROPA"]),
				"authentic": false
			}
		"Vulkanmond":
			return {"map": PLANET_TEXTURES["JUPITER_IO"], "authentic": false}
		"Desert":
			return {"map": PLANET_TEXTURES["MARS"], "authentic": false}
		_:
			var r_pick: int = s % 4
			var r_map: String = PLANET_TEXTURES["MARS"]
			if r_pick == 1:
				r_map = PLANET_TEXTURES["MERCURY"]
			elif r_pick == 2:
				r_map = PLANET_TEXTURES["VENUS_SURFACE"]
			elif r_pick == 3:
				r_map = PLANET_TEXTURES["MOON"]
			return {"map": r_map, "authentic": false}

func _create_planet_node(p_data: Dictionary, index: int, sys_id: int, scaled_dist: float) -> OrbitingEntity:
	var p_entity := OrbitingEntity.new()
	var p_name: String = str(p_data.get("name", "Planet %d" % (index + 1)))
	var p_type: String = str(p_data.get("type", "Rocky"))
	var p_size: float = float(p_data.get("size", 3.8)) * 1.25
	var p_color := _parse_hex_color(String(p_data.get("color", "0x38bdf8")), Color(0.22, 0.74, 0.97))
	var seed_val: int = p_name.hash() + index * 31

	p_entity.name = p_name.validate_node_name()
	p_entity.display_name = "%s [%s]" % [p_name, p_type]
	p_entity.entity_category = "planet"
	p_entity.planet_key = "%d_%s" % [sys_id, p_name]
	p_entity.planet_type = p_type
	p_entity.raw_planet_data = p_data
	p_entity.base_radius = p_size
	p_entity.orbit_radius = scaled_dist
	var default_angle_rad: float = (float(index) * 1.8) + (float(sys_id) * 0.5)
	p_entity.orbit_angle_deg = float(p_data.get("angle", rad_to_deg(default_angle_rad)))
	p_entity.orbit_speed = float(p_data.get("speed", 0.055 / sqrt(max(20.0, scaled_dist))))
	p_entity.is_harvestable = true
	p_entity.dynamic_approach_expansion = true

	var tmpl: Dictionary = _select_planet_template(p_data, seed_val)
	var is_authentic: bool = bool(tmpl.get("authentic", false))

	# 1. Main Textured Sphere
	var mesh_inst := MeshInstance3D.new()
	var sph := SphereMesh.new()
	sph.radius = p_size
	sph.height = p_size * 2.0
	sph.radial_segments = 64
	sph.rings = 32

	var mat := StandardMaterial3D.new()
	var diffuse_tex := _load_tex(str(tmpl.get("map", "")))
	if diffuse_tex:
		mat.albedo_texture = diffuse_tex
	mat.albedo_color = Color.WHITE if is_authentic else p_color.lerp(Color.WHITE, 0.55)
	mat.roughness = 0.42 if p_type == "Gas Giant" else 0.75
	mat.metallic = 0.06

	var norm_tex := _load_tex(str(tmpl.get("normal", "")))
	if norm_tex:
		mat.normal_enabled = true
		mat.normal_texture = norm_tex
		mat.normal_scale = 0.85

	var night_tex := _load_tex(str(tmpl.get("night", "")))
	if night_tex:
		mat.emission_enabled = true
		mat.emission_texture = night_tex
		mat.emission_energy_multiplier = 0.85

	sph.material = mat
	mesh_inst.mesh = sph
	mesh_inst.rotation.z = deg_to_rad(float((abs(seed_val) % 18) + 8))
	p_entity.add_child(mesh_inst)
	p_entity.body_mesh = mesh_inst

	# 2. Cloud Layer (for Habitable / Atmospheric worlds)
	var cloud_tex := _load_tex(str(tmpl.get("cloud", "")))
	if cloud_tex:
		var cloud_inst := MeshInstance3D.new()
		var c_sph := SphereMesh.new()
		c_sph.radius = p_size * 1.022
		c_sph.height = p_size * 2.044
		c_sph.radial_segments = 48
		c_sph.rings = 24
		var c_mat := StandardMaterial3D.new()
		c_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		c_mat.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
		c_mat.albedo_texture = cloud_tex
		c_mat.albedo_color = Color(1.0, 1.0, 1.0, 0.65)
		c_sph.material = c_mat
		cloud_inst.mesh = c_sph
		p_entity.add_child(cloud_inst)
		p_entity.cloud_mesh = cloud_inst

	# 3. Atmospheric Rim Glow Shell
	if p_type in ["Habitable", "Gas Giant", "Ice"]:
		var atmo_inst := MeshInstance3D.new()
		var a_sph := SphereMesh.new()
		a_sph.radius = p_size * 1.08
		a_sph.height = p_size * 2.16
		var a_mat := StandardMaterial3D.new()
		a_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		a_mat.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
		a_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		var atmo_col := Color(0.22, 0.74, 0.98, 0.14) if p_type == "Habitable" else Color(p_color.r, p_color.g, p_color.b, 0.12)
		a_mat.albedo_color = atmo_col
		a_sph.material = a_mat
		atmo_inst.mesh = a_sph
		p_entity.add_child(atmo_inst)

	# 4. Planetary Rings (Saturn / Gas Giants / Ringed Archetypes)
	var has_rings: bool = (str(tmpl.get("ring", "")) != "") or (p_type == "Gas Giant" and (abs(seed_val) % 2 == 0))
	if has_rings:
		var ring_inst := MeshInstance3D.new()
		var r_torus := CylinderMesh.new()
		r_torus.top_radius = p_size * 2.25
		r_torus.bottom_radius = p_size * 2.25
		r_torus.height = 0.02
		var r_mat := StandardMaterial3D.new()
		r_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		r_mat.cull_mode = BaseMaterial3D.CULL_DISABLED
		r_mat.albedo_color = Color(p_color.r, p_color.g, p_color.b, 0.42).lerp(Color(0.9, 0.85, 0.75, 0.42), 0.5)
		r_torus.material = r_mat
		ring_inst.mesh = r_torus
		ring_inst.rotation.z = deg_to_rad(16.0)
		ring_inst.rotation.x = deg_to_rad(8.0)
		p_entity.add_child(ring_inst)

	if not Engine.is_editor_hint() and GameState.is_planet_depleted(p_entity.planet_key):
		p_entity.mark_visual_depleted()

	return p_entity

func _create_moon_node(m_data: Dictionary, parent_planet: OrbitingEntity, m_idx: int) -> OrbitingEntity:
	var m_entity := OrbitingEntity.new()
	var m_name: String = str(m_data.get("name", "%s Mond %d" % [parent_planet.name, m_idx + 1]))
	var m_type: String = str(m_data.get("type", "Kratermond"))
	var m_size: float = float(m_data.get("size", 1.0)) * 1.15
	# Spacious moon orbital distance around parent planet (matching Three.js formula)
	var m_dist: float = (parent_planet.base_radius * 2.2) + 6.5 + (float(m_idx) * 5.2)
	var m_color := _parse_hex_color(String(m_data.get("color", "0x94a3b8")), Color(0.7, 0.75, 0.82))

	m_entity.name = m_name.validate_node_name()
	m_entity.display_name = "%s [%s]" % [m_name, m_type]
	m_entity.entity_category = "moon"
	m_entity.planet_key = "%s_moon_%s" % [parent_planet.planet_key, m_name]
	m_entity.planet_type = m_type
	m_entity.raw_planet_data = m_data
	m_entity.parent_body = parent_planet
	m_entity.base_radius = m_size
	m_entity.orbit_radius = m_dist
	m_entity.orbit_angle_deg = float(m_idx * 135 + 40)
	m_entity.orbit_speed = 0.12 + 0.06 / sqrt(max(2.0, m_dist))
	m_entity.is_harvestable = true

	var tmpl: Dictionary = _select_planet_template({"type": m_type, "texture": m_data.get("texture", "")}, m_name.hash())
	var m_inst := MeshInstance3D.new()
	var sph := SphereMesh.new()
	sph.radius = m_size
	sph.height = m_size * 2.0
	var mat := StandardMaterial3D.new()
	var tex := _load_tex(str(tmpl.get("map", "")))
	if tex:
		mat.albedo_texture = tex
	mat.albedo_color = m_color.lerp(Color.WHITE, 0.5)
	mat.roughness = 0.85
	sph.material = mat
	m_inst.mesh = sph
	m_entity.add_child(m_inst)
	m_entity.body_mesh = m_inst

	var m_ring := _create_orbit_ring_mesh(m_dist, Color(m_color.r, m_color.g, m_color.b, 0.16))
	procedural_container.add_child(m_ring)
	m_entity.orbit_ring_mesh = m_ring

	if not Engine.is_editor_hint() and GameState.is_planet_depleted(m_entity.planet_key):
		m_entity.mark_visual_depleted()

	return m_entity

func _create_asteroid_node(ast_data: Dictionary) -> Node3D:
	var a_type: String = str(ast_data.get("type", "silicon"))
	if a_type != "bio" and a_type != "ice" and a_type != "monolith":
		a_type = "silicon"

	var size: float = 1.15 + randf() * 1.15
	if a_type == "monolith":
		size = 3.2 + randf() * 1.35
	elif a_type == "ice":
		size = 1.05 + randf() * 0.95

	var inst := MeshInstance3D.new()
	var sph := SphereMesh.new()
	sph.radius = size
	sph.height = size * (1.45 if a_type == "monolith" else 1.7)
	sph.radial_segments = 8 if a_type == "monolith" else 7
	sph.rings = 5
	var mat := StandardMaterial3D.new()
	var moon_tex: Texture2D = _load_tex(PLANET_TEXTURES["MARS_PHOBOS"])
	if moon_tex and a_type != "ice":
		mat.albedo_texture = moon_tex

	if a_type == "bio":
		mat.albedo_color = Color(0.05, 0.95, 0.52)
		mat.emission_enabled = true
		mat.emission = Color(0.0, 0.45, 0.25)
		mat.emission_energy_multiplier = 0.45
		mat.roughness = 0.72
	elif a_type == "ice":
		mat.albedo_color = Color(0.68, 0.94, 1.0)
		mat.metallic = 0.25
		mat.roughness = 0.16
		mat.emission_enabled = true
		mat.emission = Color(0.28, 0.78, 1.0)
		mat.emission_energy_multiplier = 0.55
	elif a_type == "monolith":
		mat.albedo_color = Color(0.32, 0.29, 0.27)
		mat.metallic = 0.35
		mat.roughness = 0.92
		inst.scale = Vector3(1.25, 0.85, 0.92)
	else:
		mat.albedo_color = Color(0.35, 0.74, 0.96)
		mat.roughness = 0.75
		mat.metallic = 0.62

	sph.material = mat
	inst.mesh = sph
	var world_pos: Vector3
	if ast_data.has("world_x") and ast_data.has("world_z"):
		world_pos = Vector3(float(ast_data.get("world_x", 0.0)), (randf() - 0.5) * 1.4, float(ast_data.get("world_z", 0.0)))
	else:
		world_pos = Vector3(float(ast_data.get("x", 40.0)) * 2.5, (randf() - 0.5) * 1.4, float(ast_data.get("z", 40.0)) * 2.5)
	inst.position = world_pos
	inst.rotation = Vector3(randf() * TAU, randf() * TAU, randf() * 0.4)
	inst.set_meta("asteroid_type", a_type)
	inst.set_meta("rock_radius", size)
	inst.set_meta("spin_speed", randf_range(-0.45, 0.45))
	return inst

func _spawn_asteroid_belt(sys_id: int, planet_nodes: Array[OrbitingEntity]) -> float:
	if not procedural_container:
		return 155.0

	var belt_radius: float = 155.0
	if planet_nodes.size() >= 2:
		belt_radius = (planet_nodes[0].orbit_radius + planet_nodes[1].orbit_radius) * 0.5
	elif planet_nodes.size() == 1:
		belt_radius = planet_nodes[0].orbit_radius + 46.0

	# Subtle dusty belt guide ring so player can see the Asteroid Belt corridor from afar
	var belt_guide := _create_orbit_ring_mesh(belt_radius, Color(0.56, 0.68, 0.82, 0.08))
	procedural_container.add_child(belt_guide)

	var rng := RandomNumberGenerator.new()
	rng.seed = int(sys_id * 7919 + 404)
	var rock_count: int = 34
	for i in range(rock_count):
		# Group slightly into natural belt clusters with wide fly-through lanes
		var base_ang: float = (float(i) / float(rock_count)) * TAU + rng.randf_range(-0.08, 0.08)
		var radial_off: float = rng.randf_range(-16.0, 16.0)
		var r_here: float = max(42.0, belt_radius + radial_off)
		var wx: float = cos(base_ang) * r_here
		var wz: float = sin(base_ang) * r_here

		var roll: float = rng.randf()
		var r_type: String = "silicon"
		if roll < 0.18:
			r_type = "monolith"
		elif roll < 0.44:
			r_type = "ice"
		elif roll < 0.74:
			r_type = "bio"

		var node: Node3D = _create_asteroid_node({
			"type": r_type,
			"world_x": wx,
			"world_z": wz
		})
		procedural_container.add_child(node)
		active_asteroids.append(node)

	return belt_radius

func _spawn_derelict_wrecks(sys_id: int, belt_radius: float) -> void:
	if not procedural_container:
		return

	var rng := RandomNumberGenerator.new()
	rng.seed = int(sys_id * 13337 + 91)
	var wreck_count: int = 1 if (sys_id == 1 or rng.randf() < 0.78) else 2
	var wreck_titles: Array[String] = [
		"Frachter-Wrack 'Al-Qāfila'",
		"Aufgegebenes Prospektoren-Schiff",
		"Zerschmetterte Forschungs-Korvette",
		"Altes Kolonial-Versorgungswrack"
	]

	for w_idx in range(wreck_count):
		var w_key: String = "wreck_%d_%d" % [sys_id, w_idx]
		var already_salvaged: bool = not Engine.is_editor_hint() and GameState.is_wreck_salvaged(w_key)
		var ang: float = deg_to_rad(32.0 + float(w_idx) * 165.0 + float((sys_id * 47) % 120))
		var rad: float = belt_radius + (-8.0 if w_idx == 0 else 14.0)
		if sys_id == 1 and w_idx == 0:
			# Place the starter system wreck reasonably close to the first planet & belt so player spots it early!
			ang = deg_to_rad(62.0)
			rad = max(95.0, belt_radius - 12.0)

		var wreck := OrbitingEntity.new()
		wreck.name = "DerelictWreck_%d" % w_idx
		var base_title: String = wreck_titles[(sys_id + w_idx) % wreck_titles.size()]
		wreck.display_name = ("%s [GEBORGEN]" % base_title) if already_salvaged else ("%s [WRACK]" % base_title)
		wreck.entity_category = "derelict_wreck"
		wreck.use_manual_editor_position = true
		wreck.is_harvestable = false
		wreck.base_radius = 2.2
		wreck.planet_key = w_key
		wreck.position = Vector3(cos(ang) * rad, 0.0, sin(ang) * rad)

		var hull_mat := StandardMaterial3D.new()
		hull_mat.albedo_color = Color(0.28, 0.31, 0.36) if already_salvaged else Color(0.46, 0.50, 0.56)
		hull_mat.metallic = 0.78
		hull_mat.roughness = 0.48

		var scorch_mat := StandardMaterial3D.new()
		scorch_mat.albedo_color = Color(0.16, 0.17, 0.20)
		scorch_mat.metallic = 0.65
		scorch_mat.roughness = 0.62

		var core_mat := StandardMaterial3D.new()
		core_mat.albedo_color = Color(0.25, 0.28, 0.32) if already_salvaged else Color(1.0, 0.62, 0.14)
		core_mat.emission_enabled = not already_salvaged
		core_mat.emission = Color(1.0, 0.55, 0.10)
		core_mat.emission_energy_multiplier = 1.6

		# Tilted broken main hull cylinder
		var hull_inst := MeshInstance3D.new()
		var hull_cyl := CylinderMesh.new()
		hull_cyl.top_radius = 0.52
		hull_cyl.bottom_radius = 0.85
		hull_cyl.height = 3.2
		hull_cyl.radial_segments = 8
		hull_cyl.material = hull_mat
		hull_inst.mesh = hull_cyl
		hull_inst.rotation = Vector3(PI * 0.44, 0.35 + float(w_idx), 0.28)
		wreck.add_child(hull_inst)

		# Snapped wing / solar array panel floating slightly askew
		var panel_inst := MeshInstance3D.new()
		var p_box := BoxMesh.new()
		p_box.size = Vector3(2.5, 0.10, 0.95)
		p_box.material = scorch_mat
		panel_inst.mesh = p_box
		panel_inst.position = Vector3(0.55, 0.15, -0.35)
		panel_inst.rotation = Vector3(0.22, -0.48, 0.42)
		wreck.add_child(panel_inst)

		# Exposed glowing salvage core
		var core_inst := MeshInstance3D.new()
		core_inst.name = "WreckCore"
		var c_sph := SphereMesh.new()
		c_sph.radius = 0.38
		c_sph.height = 0.76
		c_sph.material = core_mat
		core_inst.mesh = c_sph
		core_inst.position = Vector3(-0.2, 0.25, 0.4)
		wreck.add_child(core_inst)

		var beacon := OmniLight3D.new()
		beacon.name = "WreckBeacon"
		beacon.light_color = Color(1.0, 0.62, 0.16)
		beacon.light_energy = 0.0 if already_salvaged else 1.7
		beacon.omni_range = 14.0
		beacon.position = Vector3(0.0, 0.8, 0.0)
		wreck.add_child(beacon)

		procedural_container.add_child(wreck)
		interactable_bodies.append(wreck)

func _create_orbit_ring_mesh(radius: float, color: Color) -> MeshInstance3D:
	var inst := MeshInstance3D.new()
	var torus := TorusMesh.new()
	torus.inner_radius = max(0.1, radius - 0.16)
	torus.outer_radius = radius + 0.16
	torus.rings = 128
	torus.ring_segments = 6
	var mat := StandardMaterial3D.new()
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.albedo_color = color
	torus.material = mat
	inst.mesh = torus
	inst.position = Vector3(0.0, -0.1, 0.0)
	return inst

func _spawn_jamal_shuttle(parent_planet: Node3D, is_real_at_depot: bool) -> void:
	var shuttle := OrbitingEntity.new()
	shuttle.name = "JamalResearchShuttle"
	shuttle.display_name = "Echte 'Ar-Riḥla' [PIER 4 • PARKKRALLE]" if is_real_at_depot else "Dr. Jamals Forschungsschiff [PARKKRALLE]"
	shuttle.entity_category = "jamal_shuttle"
	shuttle.parent_body = parent_planet
	shuttle.base_radius = 0.85
	var p_rad: float = float(parent_planet.get("base_radius")) if parent_planet.get("base_radius") != null else 4.2
	shuttle.orbit_radius = max(24.0, p_rad * 3.4 + 10.0)
	shuttle.orbit_angle_deg = 215.0 if is_real_at_depot else 75.0
	shuttle.orbit_speed = 0.025 if is_real_at_depot else 0.035
	shuttle.is_harvestable = false
	shuttle.emits_radiation = false
	shuttle.dialogue_node_id = "pier4_clamped_inspect" if is_real_at_depot else "jamal_ship_scanned"

	# Detailed Ar-Riḥla Science Shuttle + Industrial Parking Clamp + Towing Drone
	var s_scale := 1.15
	var hull_mat := StandardMaterial3D.new()
	hull_mat.albedo_color = Color(0.88, 0.92, 0.96)
	hull_mat.metallic = 0.7
	hull_mat.roughness = 0.3

	var dark_mat := StandardMaterial3D.new()
	dark_mat.albedo_color = Color(0.12, 0.16, 0.23)
	dark_mat.metallic = 0.85
	dark_mat.roughness = 0.25

	var glass_mat := StandardMaterial3D.new()
	glass_mat.albedo_color = Color(0.96, 0.62, 0.04)
	glass_mat.emission_enabled = true
	glass_mat.emission = Color(0.96, 0.5, 0.05)
	glass_mat.emission_energy_multiplier = 1.1

	var clamp_mat := StandardMaterial3D.new()
	clamp_mat.albedo_color = Color(0.96, 0.62, 0.04)
	clamp_mat.emission_enabled = true
	clamp_mat.emission = Color(0.95, 0.25, 0.15)
	clamp_mat.emission_energy_multiplier = 0.8

	# Fuselage
	var body := MeshInstance3D.new()
	var body_cyl := CylinderMesh.new()
	body_cyl.top_radius = 0.08 * s_scale
	body_cyl.bottom_radius = 0.42 * s_scale
	body_cyl.height = 2.1 * s_scale
	body_cyl.material = hull_mat
	body.mesh = body_cyl
	body.rotation.x = PI * 0.5
	shuttle.add_child(body)

	# Cockpit Canopy
	var cockpit := MeshInstance3D.new()
	var c_sph := SphereMesh.new()
	c_sph.radius = 0.25 * s_scale
	c_sph.height = 0.5 * s_scale
	c_sph.material = glass_mat
	cockpit.mesh = c_sph
	cockpit.scale = Vector3(0.8, 0.55, 1.4)
	cockpit.position = Vector3(0.0, 0.18 * s_scale, -0.35 * s_scale)
	shuttle.add_child(cockpit)

	# Swept Science Wings
	var wings := MeshInstance3D.new()
	var w_box := BoxMesh.new()
	w_box.size = Vector3(2.4 * s_scale, 0.08 * s_scale, 0.85 * s_scale)
	w_box.material = dark_mat
	wings.mesh = w_box
	wings.position = Vector3(0.0, 0.0, 0.15 * s_scale)
	shuttle.add_child(wings)

	# Engine Nacelles + Parking Clamp Ring (Parkkralle)
	var clamp_ring := MeshInstance3D.new()
	clamp_ring.name = "ClampRing"
	var c_torus := TorusMesh.new()
	c_torus.inner_radius = 0.65 * s_scale
	c_torus.outer_radius = 0.82 * s_scale
	c_torus.material = clamp_mat
	clamp_ring.mesh = c_torus
	clamp_ring.rotation.x = PI * 0.5
	clamp_ring.position = Vector3(0.0, 0.0, 0.95 * s_scale)
	shuttle.add_child(clamp_ring)

	# Escort Rogue AI Towing Drone TX-9 floating right next to shuttle
	var drone := MeshInstance3D.new()
	var d_sph := SphereMesh.new()
	d_sph.radius = 0.35 * s_scale
	d_sph.height = 0.7 * s_scale
	d_sph.material = dark_mat
	drone.mesh = d_sph
	drone.position = Vector3(1.6 * s_scale, 0.4 * s_scale, 1.2 * s_scale)
	shuttle.add_child(drone)

	var strobe := OmniLight3D.new()
	strobe.light_color = Color(0.22, 0.74, 0.98)
	strobe.light_energy = 1.8
	strobe.omni_range = 14.0
	shuttle.add_child(strobe)

	procedural_container.add_child(shuttle)
	shuttle.update_orbital_position(0.0)
	interactable_bodies.append(shuttle)

func _spawn_orbital_station(parent_planet: Node3D, station_name: String, is_insan: bool) -> void:
	var station := OrbitingEntity.new()
	station.name = station_name.validate_node_name()
	station.display_name = station_name
	station.entity_category = "space_station"
	station.parent_body = parent_planet
	station.base_radius = 2.8
	var p_rad: float = float(parent_planet.get("base_radius")) if parent_planet.get("base_radius") != null else 4.2
	station.orbit_radius = max(28.0, p_rad * 3.85 * 1.35 + 12.0)
	station.orbit_angle_deg = 120.0 if is_insan else 290.0
	station.orbit_speed = 0.032
	if is_insan:
		station.dialogue_node_id = "insan_station_bureaucracy"

	var col := Color(0.96, 0.62, 0.04) if is_insan else Color(0.22, 0.74, 0.98)
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.82, 0.86, 0.92)
	mat.metallic = 0.8
	mat.roughness = 0.25

	var glow_mat := StandardMaterial3D.new()
	glow_mat.albedo_color = col
	glow_mat.emission_enabled = true
	glow_mat.emission = col
	glow_mat.emission_energy_multiplier = 1.6

	# Outer Habitat Ring
	var ring := MeshInstance3D.new()
	var torus := TorusMesh.new()
	torus.inner_radius = 2.3
	torus.outer_radius = 3.0
	torus.material = mat
	ring.mesh = torus
	station.add_child(ring)

	# Central Spire
	var spire := MeshInstance3D.new()
	var cyl := CylinderMesh.new()
	cyl.top_radius = 0.55
	cyl.bottom_radius = 0.55
	cyl.height = 3.6
	cyl.material = glow_mat
	spire.mesh = cyl
	station.add_child(spire)

	procedural_container.add_child(station)
	station.update_orbital_position(0.0)
	interactable_bodies.append(station)

func _spawn_voyager_probe() -> void:
	var probe := OrbitingEntity.new()
	probe.name = "Voyager2Probe"
	probe.display_name = "Voyager 2 [GEBORGEN]" if GameState.voyager_liberated else "Voyager 2 (Abgeschleppte Raumsonde, 1977)"
	probe.entity_category = "voyager_probe"
	probe.use_manual_editor_position = true
	probe.position = Vector3(-95.0, 0.0, 120.0)
	probe.dialogue_node_id = ""

	var dish := MeshInstance3D.new()
	var cyl := CylinderMesh.new()
	cyl.top_radius = 1.4
	cyl.bottom_radius = 0.3
	cyl.height = 0.5
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.98, 0.82, 0.25)
	mat.metallic = 0.88
	mat.roughness = 0.2
	mat.emission_enabled = true
	mat.emission = Color(0.95, 0.75, 0.15)
	mat.emission_energy_multiplier = 0.5
	cyl.material = mat
	dish.mesh = cyl
	probe.add_child(dish)

	procedural_container.add_child(probe)
	interactable_bodies.append(probe)

func _process(delta: float) -> void:
	if Engine.is_editor_hint():
		return
	if not player_ship:
		return

	var best_node: Node3D = null
	var best_dist: float = INF
	for node in interactable_bodies:
		if is_instance_valid(node):
			var d := player_ship.global_position.distance_to(node.global_position)
			if d < best_dist:
				best_dist = d
				best_node = node
	GameState.nearest_interactable = best_node

	if monolith_bump_cooldown > 0.0:
		monolith_bump_cooldown = max(0.0, monolith_bump_cooldown - delta)

	_update_target_reticle_ring(best_node, best_dist, delta)
	_update_active_channeling(delta)
	_update_environmental_radiation()
	_check_asteroid_collection(delta)
	player_ship.external_gravity_accel = _compute_gravity_acceleration()
	_update_trajectory_prediction()
	_update_combat_system(delta)

func _update_environmental_radiation() -> void:
	if not player_ship:
		return
	var p_pos: Vector3 = player_ship.global_position
	var amb_rad: float = 0.0
	var rad_src: String = ""

	# 1. Solar Corona Radiation near Central Star (0, 0, 0)
	var dist_star: float = p_pos.length()
	var solar_zone: float = current_star_size * 3.6
	if dist_star < solar_zone:
		var s_int: float = clamp((1.0 - (dist_star / solar_zone)) * 0.68, 0.0, 1.0)
		if s_int > amb_rad:
			amb_rad = s_int
			rad_src = "Solare Korona"

	# 2. Planetary Magnetosphere / Thermal Radiation
	var nearest: Node3D = GameState.nearest_interactable
	if nearest and is_instance_valid(nearest):
		var d: float = p_pos.distance_to(nearest.global_position)
		var cat: String = str(nearest.get_meta("entity_category", ""))
		if cat == "jamal_shuttle" and d < 30.0:
			# Ar-Riḥla's sub-quantum field shields Najmafar
			amb_rad = 0.0
			rad_src = ""
		elif cat in ["planet", "moon"] and d < 48.0:
			var p_type: String = str(nearest.get("planet_type")) if nearest.get("planet_type") != null else "Rocky"
			var emits: bool = bool(nearest.get_meta("emits_radiation", false))
			if emits or p_type in ["Gas Giant", "Vulkanmond"]:
				var p_int: float = clamp((1.0 - (d / 48.0)) * 0.48, 0.0, 0.85)
				if p_int > amb_rad:
					amb_rad = p_int
					rad_src = str(nearest.get("display_name"))

	GameState.ambient_radiation = amb_rad
	GameState.radiation_source = rad_src

func _check_asteroid_collection(delta: float = 0.016) -> void:
	if not player_ship or active_asteroids.is_empty():
		return
	var p_pos: Vector3 = player_ship.global_position
	for i in range(active_asteroids.size() - 1, -1, -1):
		var ast: Node3D = active_asteroids[i]
		if not is_instance_valid(ast):
			active_asteroids.remove_at(i)
			continue
		var spin_spd: float = float(ast.get_meta("spin_speed", 0.2))
		ast.rotate_y(spin_spd * delta)

		var a_type: String = str(ast.get_meta("asteroid_type", "silicon"))
		var d_ast: float = p_pos.distance_to(ast.global_position)
		if a_type == "monolith":
			var rock_r: float = float(ast.get_meta("rock_radius", 3.5))
			if d_ast <= rock_r + 1.45:
				var push_away: Vector3 = p_pos - ast.global_position
				push_away.y = 0.0
				var push_n: Vector3 = push_away.normalized() if push_away.length_squared() > 0.01 else Vector3(1.0, 0.0, 0.0)
				player_ship.velocity = push_n * max(11.0, player_ship.velocity.length() * 0.65)
				player_ship.global_position = ast.global_position + push_n * (rock_r + 1.65)
				player_ship.global_position.y = 0.0
				if monolith_bump_cooldown <= 0.0:
					monolith_bump_cooldown = 0.9
					GameState.apply_combat_damage(3.5, "Gesteins-Monolith")
					player_ship.trigger_damage_flash()
					_play_sfx("ship_thrust_ignite.wav", 0.52, -10.5)
					GameState.add_log("GÜRTEL", "🪨 Kollision mit schwerem Monolith! (Tipp: Sprenge große Felsen mit dem Psi-Kegel [X] in Ressourcen-Splitter!)")
			continue

		if d_ast <= 6.4:
			_play_sfx("ship_thrust_ignite.wav", 0.68 + randf() * 0.14, -12.5)
			if a_type == "bio":
				var b_gain: int = int(round(18.0 * GameState.get_bio_harvest_multiplier()))
				GameState.bio_res += b_gain
				GameState.bio_energy = min(GameState.max_bio_energy, GameState.bio_energy + 8.0)
				GameState.add_log("ASTEROID", "☄️ Sporen-Fragment absorbiert: +%d 🌿 Biomasse | +8%% ⚡ Bio-Energie!" % b_gain)
			elif a_type == "ice":
				GameState.add_water(5)
				GameState.add_food(4)
				GameState.mental_energy = min(GameState.max_mental_energy, GameState.mental_energy + 6.0)
				GameState.add_log("KOMET", "❄️ Kometen-Eiskern absorbiert: +5 💧 Wasser | +4 🍖 Kryo-Nährstoffe | +6%% 🧠 Mental!")
			else:
				var s_gain: int = int(round(22.0 * GameState.get_silicon_harvest_multiplier()))
				GameState.silicon_res += s_gain
				GameState.bio_energy = min(GameState.max_bio_energy, GameState.bio_energy + 4.0)
				GameState.health = min(GameState.max_health, GameState.health + 3.0)
				GameState.add_log("ASTEROID", "☄️ Silizium-Erzsplitter absorbiert: +%d 💎 Silizium | +4%% ⚡ Bio-Energie | +3 ❤️ Hülle!" % s_gain)
			GameState.vitals_updated.emit()
			active_asteroids.remove_at(i)
			var tw: Tween = create_tween()
			tw.set_parallel(true)
			tw.tween_property(ast, "global_position", player_ship.global_position, 0.22)
			tw.tween_property(ast, "scale", Vector3(0.02, 0.02, 0.02), 0.22)
			tw.chain().tween_callback(func():
				if is_instance_valid(ast):
					ast.queue_free()
			)

func _ensure_target_reticle_ring() -> void:
	if target_reticle_ring and is_instance_valid(target_reticle_ring):
		return
	target_reticle_ring = MeshInstance3D.new()
	target_reticle_ring.name = "TargetReticleRing"
	var torus := TorusMesh.new()
	torus.inner_radius = 1.98
	torus.outer_radius = 2.02
	torus.rings = 64
	torus.ring_segments = 6
	target_reticle_mat = StandardMaterial3D.new()
	target_reticle_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	target_reticle_mat.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	target_reticle_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	target_reticle_mat.albedo_color = Color(0.22, 0.88, 1.0, 0.34)
	torus.material = target_reticle_mat
	target_reticle_ring.mesh = torus
	target_reticle_ring.visible = false
	add_child(target_reticle_ring)

func _update_target_reticle_ring(target: Node3D, dist: float, delta: float) -> void:
	_ensure_target_reticle_ring()
	if not target or not is_instance_valid(target) or dist > 85.0:
		target_reticle_ring.visible = false
		return

	target_reticle_ring.visible = true
	target_reticle_ring.global_position = Vector3(target.global_position.x, -0.02, target.global_position.z)
	target_reticle_ring.rotate_y(delta * 1.4)

	var base_r: float = float(target.get("base_radius")) if target.get("base_radius") != null else 2.0
	var s_factor: float = max(1.2, base_r * target.scale.x * 0.68)
	var pulse: float = 1.0 + sin(Time.get_ticks_msec() * 0.006) * 0.03
	target_reticle_ring.scale = Vector3(s_factor * pulse, 1.0, s_factor * pulse)

	var cat: String = str(target.get_meta("entity_category", ""))
	if target_reticle_mat:
		if cat == "jamal_shuttle" or cat == "space_station" or cat == "voyager_probe" or cat == "derelict_wreck":
			target_reticle_mat.albedo_color = Color(1.0, 0.68, 0.1, 0.45 if dist <= 36.0 else 0.22)
		else:
			target_reticle_mat.albedo_color = Color(0.0, 1.0, 0.62, 0.36 if dist <= 36.0 else 0.18)

func _sample_gravity_info(sample_pos: Vector3, sample_vel: Vector3 = Vector3.ZERO, future_sec: float = 0.0) -> Dictionary:
	var total_accel := Vector3.ZERO
	var pull_magnitude: float = 0.0
	var is_repelling: bool = false
	var g_const: float = 12.0

	# 1. Central Star Gravity & Damped Surface Cushion at (0, 0, 0) (Celestial Body Only)
	var to_star: Vector3 = Vector3.ZERO - sample_pos
	to_star.y = 0.0
	var star_dist: float = to_star.length()
	var star_safe_r: float = current_star_size + 2.5
	if star_dist > 0.1 and star_dist < 140.0:
		var dir_star: Vector3 = to_star / star_dist
		if star_dist < star_safe_r:
			var push_strength: float = min(14.0, (star_safe_r - star_dist) * 4.5)
			total_accel -= dir_star * push_strength
			var v_in_star: float = sample_vel.dot(dir_star)
			if v_in_star > 0.0:
				total_accel -= dir_star * (v_in_star * 6.5)
			is_repelling = true
		else:
			var soft_edge: float = clamp((star_dist - star_safe_r) / 4.0, 0.0, 1.0)
			var pull: float = clamp((g_const * current_star_mass) / max(80.0, star_dist * star_dist), 0.0, 7.5) * soft_edge
			total_accel += dir_star * pull
			pull_magnitude += pull

	# 2. Celestial Bodies Only (Planets & Moons) — Smoothly tapered gravity + critically damped surface cushion!
	for body in interactable_bodies:
		if not is_instance_valid(body):
			continue
		var cat: String = str(body.get("entity_category"))
		if cat != "planet" and cat != "moon":
			continue
		var b_pos: Vector3 = body.global_position
		if future_sec > 0.0 and body.has_method("predict_position_after"):
			b_pos = body.call("predict_position_after", future_sec)
		var to_body: Vector3 = b_pos - sample_pos
		to_body.y = 0.0
		var d: float = to_body.length()
		var b_rad: float = (float(body.get("base_radius")) if body.get("base_radius") != null else 3.8) * body.scale.x
		var grav_range: float = max(24.0, b_rad * 4.0) if cat == "planet" else (b_rad * 2.8 + 4.0)
		if d > 0.1 and d < grav_range:
			var dir_b: Vector3 = to_body / d
			var safe_surface: float = b_rad + 2.0
			if d < safe_surface:
				var pen: float = safe_surface - d
				total_accel -= dir_b * min(14.0, pen * 4.5)
				var v_in: float = sample_vel.dot(dir_b)
				if v_in > 0.0:
					total_accel -= dir_b * (v_in * 6.5)
				is_repelling = true
			elif cat == "planet":
				# Smoothly taper attraction down to 0 at safe_surface so there is NO harsh snap/bounce oscillation!
				var soft_taper: float = clamp((d - safe_surface) / 3.5, 0.0, 1.0)
				var p_mass: float = b_rad * 4.2
				var p_pull: float = clamp((g_const * p_mass) / max(36.0, d * d), 0.0, 5.5) * soft_taper
				total_accel += dir_b * p_pull
				pull_magnitude += p_pull

	return {
		"accel": total_accel,
		"pull_mag": pull_magnitude,
		"repel": is_repelling
	}

func _compute_gravity_acceleration() -> Vector3:
	if not player_ship:
		return Vector3.ZERO
	var info: Dictionary = _sample_gravity_info(player_ship.global_position, player_ship.velocity, 0.0)
	return info["accel"]

func _create_trajectory_ribbon_node(node_name: String, add_blend: bool = true) -> Array:
	var imm := ImmediateMesh.new()
	var inst := MeshInstance3D.new()
	inst.name = node_name
	inst.mesh = imm
	inst.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	var mat := StandardMaterial3D.new()
	mat.vertex_color_use_as_albedo = true
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	if add_blend:
		mat.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	inst.material_override = mat
	add_child(inst)
	return [inst, imm]

func _ensure_trajectory_visuals() -> void:
	if not trajectory_mesh_inst or not is_instance_valid(trajectory_mesh_inst):
		var pair_main: Array = _create_trajectory_ribbon_node("TrajectoryPredictionRibbon", true)
		trajectory_mesh_inst = pair_main[0] as MeshInstance3D
		trajectory_imm_mesh = pair_main[1] as ImmediateMesh

func _draw_ribbon_strip(inst: MeshInstance3D, imm: ImmediateMesh, points: Array[Vector3], colors: Array[Color], half_width: float) -> void:
	if not inst or not imm:
		return
	if points.size() < 2 or points.size() != colors.size():
		inst.visible = false
		return

	imm.clear_surfaces()
	imm.surface_begin(Mesh.PRIMITIVE_TRIANGLE_STRIP)
	var last_side := Vector3(half_width, 0.0, 0.0)
	var count: int = points.size()
	for i in range(count):
		var dir: Vector3
		if i < count - 1:
			dir = points[i + 1] - points[i]
		else:
			dir = points[i] - points[i - 1]
		dir.y = 0.0
		var side: Vector3 = last_side
		if dir.length_squared() > 0.0001:
			var n_dir: Vector3 = dir.normalized()
			side = Vector3(-n_dir.z, 0.0, n_dir.x) * half_width
			last_side = side
		var col: Color = colors[i]
		imm.surface_set_color(col)
		imm.surface_add_vertex(points[i] - side)
		imm.surface_set_color(col)
		imm.surface_add_vertex(points[i] + side)
	imm.surface_end()
	inst.visible = true

func _update_trajectory_prediction() -> void:
	_ensure_trajectory_visuals()
	if not show_trajectory_line or not player_ship or QuestManager.is_dialogue_open:
		if trajectory_mesh_inst:
			trajectory_mesh_inst.visible = false
		return

	var start_pos: Vector3 = player_ship.global_position
	var cur_vel: Vector3 = player_ship.velocity
	cur_vel.y = 0.0

	# Single sleek Predicted Coast Trajectory with Sub-Stepping (no bounce zigzag near surfaces!)
	var steps: int = max(8, trajectory_steps)
	var step_dt: float = trajectory_duration_sec / float(steps)
	var sub_steps: int = 3
	var sub_dt: float = step_dt / float(sub_steps)
	var grav_mult: float = player_ship.gravity_influence_multiplier
	var ship_max_spd: float = player_ship.max_speed

	var sim_pos: Vector3 = Vector3(start_pos.x, 0.0, start_pos.z)
	var sim_vel: Vector3 = cur_vel
	var sim_time: float = 0.0

	var traj_pts: Array[Vector3] = [Vector3(sim_pos.x, -0.08, sim_pos.z)]
	var traj_cols: Array[Color] = [Color(0.22, 0.92, 1.0, 0.58)]
	var total_path_len: float = 0.0

	for s in range(1, steps + 1):
		var last_pull: float = 0.0
		var any_repel: bool = false
		for _sub in range(sub_steps):
			sim_time += sub_dt
			var g_info: Dictionary = _sample_gravity_info(sim_pos, sim_vel, sim_time)
			var g_accel: Vector3 = g_info["accel"]
			last_pull = float(g_info["pull_mag"])
			if bool(g_info["repel"]):
				any_repel = true

			sim_vel += g_accel * grav_mult * sub_dt
			if sim_vel.length() > ship_max_spd:
				sim_vel = sim_vel.normalized() * ship_max_spd
			sim_vel.y = 0.0

			var next_pos: Vector3 = sim_pos + sim_vel * sub_dt
			total_path_len += sim_pos.distance_to(next_pos)
			sim_pos = next_pos

		var t_norm: float = float(s) / float(steps)
		var alpha: float = (1.0 - t_norm) * (1.0 - t_norm * 0.35) * 0.58
		var seg_col: Color
		if any_repel:
			seg_col = Color(1.0, 0.35, 0.25, alpha)
		elif last_pull > 0.35:
			var blend_w: float = clamp((last_pull - 0.35) / 3.0, 0.0, 1.0)
			seg_col = Color(0.22, 0.92, 1.0, alpha).lerp(Color(1.0, 0.72, 0.12, alpha), blend_w)
		else:
			seg_col = Color(0.22, 0.92, 1.0, alpha)

		traj_pts.append(Vector3(sim_pos.x, -0.08, sim_pos.z))
		traj_cols.append(seg_col)

		if any_repel and sim_vel.length() < 1.2:
			break

	if total_path_len < 0.8:
		if trajectory_mesh_inst:
			trajectory_mesh_inst.visible = false
		return

	_draw_ribbon_strip(trajectory_mesh_inst, trajectory_imm_mesh, traj_pts, traj_cols, 0.08)

func _spawn_energy_beam(from_pos: Vector3, to_pos: Vector3, beam_color: Color, duration: float = 0.55) -> void:
	var diff: Vector3 = to_pos - from_pos
	diff.y = 0.0
	var length: float = diff.length()
	if length < 0.5 or not procedural_container:
		return

	var mid: Vector3 = (from_pos + to_pos) * 0.5 + Vector3(0.0, 0.35, 0.0)
	var beam_node := Node3D.new()
	beam_node.position = mid
	procedural_container.add_child(beam_node)
	beam_node.look_at(to_pos + Vector3(0.0, 0.35, 0.0), Vector3.UP)

	var beam_inst := MeshInstance3D.new()
	var cyl := CylinderMesh.new()
	cyl.top_radius = 0.22
	cyl.bottom_radius = 0.38
	cyl.height = length
	var mat := StandardMaterial3D.new()
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.albedo_color = beam_color
	cyl.material = mat
	beam_inst.mesh = cyl
	beam_inst.rotation.x = PI * 0.5
	beam_node.add_child(beam_inst)

	# Impact Pulse Ring on Target
	var pulse_ring := MeshInstance3D.new()
	var torus := TorusMesh.new()
	torus.inner_radius = 1.2
	torus.outer_radius = 1.65
	torus.material = mat
	pulse_ring.mesh = torus
	pulse_ring.position = Vector3(to_pos.x, 0.2, to_pos.z)
	procedural_container.add_child(pulse_ring)

	var tw: Tween = create_tween()
	tw.set_parallel(true)
	tw.tween_property(mat, "albedo_color:a", 0.0, duration)
	tw.tween_property(pulse_ring, "scale", Vector3(3.4, 1.0, 3.4), duration)
	tw.chain().tween_callback(func():
		if is_instance_valid(beam_node):
			beam_node.queue_free()
		if is_instance_valid(pulse_ring):
			pulse_ring.queue_free()
	)

func _build_psi_arc_mesh(half_angle_rad: float, inner_r: float, outer_r: float, front_col: Color, back_col: Color) -> ImmediateMesh:
	var imm := ImmediateMesh.new()
	var segs: int = 24
	var mid_r: float = (inner_r + outer_r) * 0.5
	var base_half_w: float = (outer_r - inner_r) * 0.5
	imm.surface_begin(Mesh.PRIMITIVE_TRIANGLE_STRIP)
	for i in range(segs + 1):
		var t: float = float(i) / float(segs)
		var angle: float = lerpf(-half_angle_rad, half_angle_rad, t)
		var taper: float = sin(t * PI)
		var w_scale: float = 0.14 + 0.86 * pow(max(0.0, taper), 0.72)
		var r_in: float = mid_r - base_half_w * w_scale
		var r_out: float = mid_r + base_half_w * w_scale
		var dir_local := Vector3(sin(angle), 0.0, -cos(angle))
		var alpha_edge: float = 0.16 + 0.84 * taper

		var c_back := Color(back_col.r, back_col.g, back_col.b, back_col.a * alpha_edge)
		var c_front := Color(front_col.r, front_col.g, front_col.b, front_col.a * alpha_edge)
		imm.surface_set_color(c_back)
		imm.surface_add_vertex(dir_local * r_in)
		imm.surface_set_color(c_front)
		imm.surface_add_vertex(dir_local * r_out)
	imm.surface_end()
	return imm

func _append_cone_quad(imm: ImmediateMesh, p0: Vector3, c0: Color, p1: Vector3, c1: Color, p2: Vector3, c2: Color, p3: Vector3, c3: Color) -> void:
	imm.surface_set_color(c0)
	imm.surface_add_vertex(p0)
	imm.surface_set_color(c1)
	imm.surface_add_vertex(p1)
	imm.surface_set_color(c2)
	imm.surface_add_vertex(p2)

	imm.surface_set_color(c0)
	imm.surface_add_vertex(p0)
	imm.surface_set_color(c2)
	imm.surface_add_vertex(p2)
	imm.surface_set_color(c3)
	imm.surface_add_vertex(p3)

func _spawn_psi_cone_vfx(origin_pos: Vector3, cone_dir: Vector3, cone_range: float, half_angle_rad: float) -> void:
	if not procedural_container:
		return

	var fwd: Vector3 = Vector3(cone_dir.x, 0.0, cone_dir.z).normalized()
	if fwd.length_squared() < 0.0001:
		fwd = Vector3(1.0, 0.0, 0.0)
	var right: Vector3 = Vector3(-fwd.z, 0.0, fwd.x).normalized()

	var cone_root := Node3D.new()
	cone_root.position = Vector3(origin_pos.x, 0.22, origin_pos.z)
	cone_root.basis = Basis(right, Vector3.UP, -fwd)
	procedural_container.add_child(cone_root)

	# Layer A: Volumetric 3D Psionic Cone Body + Sharp Boundary Edge Beams
	var cone_imm := ImmediateMesh.new()
	var segs: int = 20
	var r0: float = 0.04
	var r_mid: float = 0.46
	var r1: float = 1.0
	var y_mid: float = 0.72
	var y_edge: float = 1.55
	var col_apex := Color(0.68, 0.96, 1.0, 0.46)
	var col_mid := Color(0.60, 0.28, 1.0, 0.22)
	var col_outer := Color(0.24, 0.82, 1.0, 0.03)
	var col_mantle_outer := Color(0.54, 0.24, 1.0, 0.02)

	cone_imm.surface_begin(Mesh.PRIMITIVE_TRIANGLES)
	for i in range(segs):
		var t_a: float = float(i) / float(segs)
		var t_b: float = float(i + 1) / float(segs)
		var a_a: float = lerpf(-half_angle_rad, half_angle_rad, t_a)
		var a_b: float = lerpf(-half_angle_rad, half_angle_rad, t_b)
		var d_a := Vector3(sin(a_a), 0.0, -cos(a_a))
		var d_b := Vector3(sin(a_b), 0.0, -cos(a_b))
		var env_a: float = 0.35 + 0.65 * sin(t_a * PI)
		var env_b: float = 0.35 + 0.65 * sin(t_b * PI)

		var ca0 := Color(col_apex.r, col_apex.g, col_apex.b, col_apex.a * env_a)
		var cb0 := Color(col_apex.r, col_apex.g, col_apex.b, col_apex.a * env_b)
		var cam := Color(col_mid.r, col_mid.g, col_mid.b, col_mid.a * env_a)
		var cbm := Color(col_mid.r, col_mid.g, col_mid.b, col_mid.a * env_b)
		var ca1 := Color(col_outer.r, col_outer.g, col_outer.b, col_outer.a * env_a)
		var cb1 := Color(col_outer.r, col_outer.g, col_outer.b, col_outer.a * env_b)

		# Flat central fan (apex -> mid -> rim)
		_append_cone_quad(cone_imm, d_a * r0, ca0, d_b * r0, cb0, d_b * r_mid, cbm, d_a * r_mid, cam)
		_append_cone_quad(cone_imm, d_a * r_mid, cam, d_b * r_mid, cbm, d_b * r1, cb1, d_a * r1, ca1)

		# Upper & lower 3D frustum mantle layers for true 3D conical depth
		var up_apex_a: Vector3 = d_a * r0 + Vector3(0.0, 0.06, 0.0)
		var up_apex_b: Vector3 = d_b * r0 + Vector3(0.0, 0.06, 0.0)
		var up_mid_a: Vector3 = d_a * r_mid + Vector3(0.0, y_mid, 0.0)
		var up_mid_b: Vector3 = d_b * r_mid + Vector3(0.0, y_mid, 0.0)
		var up_out_a: Vector3 = d_a * r1 + Vector3(0.0, y_edge, 0.0)
		var up_out_b: Vector3 = d_b * r1 + Vector3(0.0, y_edge, 0.0)
		var cm0 := Color(col_apex.r, col_apex.g, col_apex.b, 0.16 * env_a)
		var cm1 := Color(col_apex.r, col_apex.g, col_apex.b, 0.16 * env_b)
		var cmm0 := Color(col_mid.r, col_mid.g, col_mid.b, 0.10 * env_a)
		var cmm1 := Color(col_mid.r, col_mid.g, col_mid.b, 0.10 * env_b)
		_append_cone_quad(cone_imm, up_apex_a, cm0, up_apex_b, cm1, up_mid_b, cmm1, up_mid_a, cmm0)
		_append_cone_quad(cone_imm, up_mid_a, cmm0, up_mid_b, cmm1, up_out_b, col_mantle_outer, up_out_a, col_mantle_outer)

		var dn_apex_a: Vector3 = d_a * r0 - Vector3(0.0, 0.06, 0.0)
		var dn_apex_b: Vector3 = d_b * r0 - Vector3(0.0, 0.06, 0.0)
		var dn_mid_a: Vector3 = d_a * r_mid - Vector3(0.0, y_mid, 0.0)
		var dn_mid_b: Vector3 = d_b * r_mid - Vector3(0.0, y_mid, 0.0)
		var dn_out_a: Vector3 = d_a * r1 - Vector3(0.0, y_edge, 0.0)
		var dn_out_b: Vector3 = d_b * r1 - Vector3(0.0, y_edge, 0.0)
		_append_cone_quad(cone_imm, dn_apex_a, cm0, dn_apex_b, cm1, dn_mid_b, cmm1, dn_mid_a, cmm0)
		_append_cone_quad(cone_imm, dn_mid_a, cmm0, dn_mid_b, cmm1, dn_out_b, col_mantle_outer, dn_out_a, col_mantle_outer)

	# Crisp Glowing Cone Side Boundary Edges (-half_angle and +half_angle)
	var edge_angles: Array[float] = [-half_angle_rad, half_angle_rad]
	var col_edge_in := Color(0.55, 0.94, 1.0, 0.68)
	var col_edge_out := Color(0.58, 0.30, 1.0, 0.04)
	for e_angle in edge_angles:
		var e_dir := Vector3(sin(e_angle), 0.0, -cos(e_angle))
		var e_perp := Vector3(cos(e_angle), 0.0, sin(e_angle))
		var p_in_l: Vector3 = e_dir * r0 - e_perp * 0.008
		var p_in_r: Vector3 = e_dir * r0 + e_perp * 0.008
		var p_out_l: Vector3 = e_dir * r1 - e_perp * 0.016
		var p_out_r: Vector3 = e_dir * r1 + e_perp * 0.016
		_append_cone_quad(cone_imm, p_in_l, col_edge_in, p_in_r, col_edge_in, p_out_r, col_edge_out, p_out_l, col_edge_out)
	cone_imm.surface_end()

	var cone_mat := StandardMaterial3D.new()
	cone_mat.vertex_color_use_as_albedo = true
	cone_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	cone_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	cone_mat.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	cone_mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	cone_mat.depth_draw_mode = BaseMaterial3D.DEPTH_DRAW_DISABLED
	cone_mat.albedo_color = Color(1.0, 1.0, 1.0, 1.0)

	var cone_body := MeshInstance3D.new()
	cone_body.mesh = cone_imm
	cone_body.material_override = cone_mat
	cone_body.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	cone_body.scale = Vector3(2.2, 0.35, 2.2)
	cone_root.add_child(cone_body)

	# Layer C: Brief Psionic Muzzle Light Flash at Apex
	var cone_light := OmniLight3D.new()
	cone_light.light_color = Color(0.58, 0.38, 1.0)
	cone_light.light_energy = 4.2
	cone_light.omni_range = 24.0
	cone_light.position = Vector3(0.0, 0.5, -1.0)
	cone_root.add_child(cone_light)

	var tw: Tween = create_tween()
	tw.set_parallel(true)
	tw.tween_property(cone_body, "scale", Vector3(cone_range, 1.0, cone_range), 0.24).set_trans(Tween.TRANS_EXPO).set_ease(Tween.EASE_OUT)
	tw.tween_property(cone_mat, "albedo_color:a", 0.0, 0.48).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	tw.tween_property(cone_light, "light_energy", 0.0, 0.34)

	# Layer B: 3 Staggered Directional Sickle/Crescent Wave Arcs (never a full circle!)
	var arc_front_colors: Array[Color] = [
		Color(0.68, 0.96, 1.0, 0.92),
		Color(0.64, 0.52, 1.0, 0.84),
		Color(0.45, 0.85, 1.0, 0.72)
	]
	var arc_back_colors: Array[Color] = [
		Color(0.55, 0.32, 1.0, 0.25),
		Color(0.42, 0.18, 0.95, 0.20),
		Color(0.32, 0.45, 1.0, 0.15)
	]
	for arc_idx in range(3):
		var delay: float = float(arc_idx) * 0.065
		var front_col: Color = arc_front_colors[arc_idx]
		var back_col: Color = arc_back_colors[arc_idx]
		var arc_mesh: ImmediateMesh = _build_psi_arc_mesh(half_angle_rad, 0.86, 1.0, front_col, back_col)
		var arc_mat := StandardMaterial3D.new()
		arc_mat.vertex_color_use_as_albedo = true
		arc_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		arc_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		arc_mat.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
		arc_mat.cull_mode = BaseMaterial3D.CULL_DISABLED
		arc_mat.depth_draw_mode = BaseMaterial3D.DEPTH_DRAW_DISABLED
		arc_mat.albedo_color = Color(1.0, 1.0, 1.0, 1.0)

		var arc_inst := MeshInstance3D.new()
		arc_inst.mesh = arc_mesh
		arc_inst.material_override = arc_mat
		arc_inst.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		arc_inst.scale = Vector3(2.2, 1.0, 2.2)
		arc_inst.visible = (arc_idx == 0)
		cone_root.add_child(arc_inst)

		if arc_idx > 0:
			tw.tween_callback(func():
				if is_instance_valid(arc_inst):
					arc_inst.visible = true
			).set_delay(delay)
		tw.tween_property(arc_inst, "scale", Vector3(cone_range, 1.0, cone_range), 0.36).set_delay(delay).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
		tw.tween_property(arc_mat, "albedo_color:a", 0.0, 0.36).set_delay(delay).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)

	tw.chain().tween_callback(func():
		if is_instance_valid(cone_root):
			cone_root.queue_free()
	)

func _is_point_in_psi_cone(origin: Vector3, cone_dir: Vector3, target_pos: Vector3, target_radius: float, max_range: float, half_angle_rad: float) -> bool:
	var to_t: Vector3 = Vector3(target_pos.x - origin.x, 0.0, target_pos.z - origin.z)
	var dist: float = to_t.length()
	if dist > max_range + target_radius:
		return false
	if dist <= target_radius + 2.5:
		return to_t.dot(cone_dir) >= -0.4 or dist < 1.2
	var angular_pad: float = asin(clamp(target_radius / max(dist, target_radius + 0.01), 0.0, 0.85))
	var angle: float = acos(clamp((to_t / dist).dot(cone_dir), -1.0, 1.0))
	return angle <= half_angle_rad + angular_pad

func _spawn_impact_flash(pos: Vector3, flash_color: Color, target_scale: float = 2.8, duration: float = 0.28) -> void:
	if not procedural_container:
		return
	var flash_inst := MeshInstance3D.new()
	var sph := SphereMesh.new()
	sph.radius = 0.5
	sph.height = 1.0
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	mat.albedo_color = flash_color
	sph.material = mat
	flash_inst.mesh = sph
	flash_inst.position = Vector3(pos.x, 0.3, pos.z)
	flash_inst.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	procedural_container.add_child(flash_inst)

	var tw: Tween = create_tween()
	tw.set_parallel(true)
	tw.tween_property(flash_inst, "scale", Vector3(target_scale, target_scale * 0.5, target_scale), duration).set_trans(Tween.TRANS_EXPO).set_ease(Tween.EASE_OUT)
	tw.tween_property(mat, "albedo_color:a", 0.0, duration)
	tw.chain().tween_callback(func():
		if is_instance_valid(flash_inst):
			flash_inst.queue_free()
	)

func _unhandled_input(event: InputEvent) -> void:
	if Engine.is_editor_hint() or GameState.is_map_open:
		return
	if event is InputEventKey and event.pressed and not event.echo:
		var key_event: InputEventKey = event as InputEventKey
		if key_event.keycode == KEY_F:
			_handle_f_interaction()
		elif key_event.keycode == KEY_E:
			_handle_e_harvest()
		elif key_event.keycode == KEY_R:
			_handle_r_abduct()
		elif key_event.keycode == KEY_X or key_event.keycode == KEY_SPACE:
			_handle_x_psi_cone()
		elif key_event.keycode == KEY_K:
			_handle_k_spawn_combat_test()
		elif key_event.keycode == KEY_Z:
			GameState.flight_assist = not GameState.flight_assist
			GameState.add_log("SYSTEM", "🛸 Flug-Assistent: %s" % ("AN" if GameState.flight_assist else "AUS"))
		elif key_event.keycode == KEY_V:
			show_trajectory_line = not show_trajectory_line
			GameState.add_log("NAV", "📐 Kurs- & Gravitationslinie: %s" % ("AN" if show_trajectory_line else "AUS"))

func _get_target_planet_key(target: Node3D) -> String:
	var pk: String = str(target.get("planet_key")) if target.get("planet_key") != null else ""
	if pk == "":
		pk = str(target.get_meta("planet_key", ""))
	if pk == "":
		pk = GameState.make_planet_key(target.name)
	return pk

func _handle_f_interaction() -> void:
	if QuestManager.is_dialogue_open or active_channel_mode != "":
		return
	var target: Node3D = GameState.nearest_interactable
	if not target or not is_instance_valid(target):
		return
	var dist: float = player_ship.global_position.distance_to(target.global_position)
	if dist > 40.0:
		GameState.add_log("SENSOR", "Ziel '%s' ist zu weit entfernt (%.1f AE > 40 AE)." % [str(target.get("display_name")), dist])
		return

	var cat: String = str(target.get_meta("entity_category", ""))
	var dlg: String = str(target.get_meta("dialogue_node_id", ""))
	if cat == "voyager_probe":
		_play_sfx("quantum_scan_complete.wav")
		_spawn_energy_beam(player_ship.global_position, target.global_position, Color(1.0, 0.82, 0.25, 0.9), 0.6)
		target.set("display_name", "Voyager 2 [GEBORGEN]")
		target.set_meta("display_name", "Voyager 2 [GEBORGEN]")
		QuestManager.liberate_voyager_on_site()
		return
	if cat == "derelict_wreck":
		var w_key: String = _get_target_planet_key(target)
		if GameState.is_wreck_salvaged(w_key):
			GameState.add_log("WRACK", "🔩 %s wurde bereits vollständig durchsucht." % str(target.get("display_name")))
			return
		_start_channeling("salvage_wreck", target, Color(1.0, 0.68, 0.22, 0.9))
		GameState.add_log("WRACK", "🔧 Untersuche Schiffswrack & öffne Frachtschotten von %s..." % str(target.get("display_name")))
		return
	if cat == "jamal_shuttle" and GameState.jamal_decoy_revealed and GameState.current_system_id == 1:
		_play_sfx("quantum_scan_complete.wav")
		_spawn_energy_beam(player_ship.global_position, target.global_position, Color(0.22, 0.88, 1.0, 0.9), 0.6)
		QuestManager.open_dialogue("hologram_trap_revealed")
		return
	if dlg != "":
		_play_sfx("quantum_scan_complete.wav")
		_spawn_energy_beam(player_ship.global_position, target.global_position, Color(0.22, 0.88, 1.0, 0.9), 0.6)
		QuestManager.open_dialogue(dlg)
		return

	# Planetary / Lunar Spectral Scan
	var p_key: String = _get_target_planet_key(target)
	var raw_data: Dictionary = target.get("raw_planet_data") if target.get("raw_planet_data") != null else {}
	var is_moon: bool = (cat == "moon")
	if GameState.is_planet_scanned(p_key):
		var dossier: Dictionary = GameState.get_or_create_planet_dossier(p_key, raw_data, is_moon)
		GameState.active_dossier_key = p_key
		GameState.dossier_updated.emit(p_key, dossier)
		GameState.add_log("DOSSIER", "📋 Spektral-Dossier aufgerufen: %s (Bereits analysiert)." % str(target.get("display_name")))
		return

	_start_channeling("scan", target, Color(0.22, 0.88, 1.0, 0.88))
	GameState.add_log("SCAN", "🛰️ Spektral-Analyse auf %s gestartet..." % str(target.get("display_name")))

func _handle_e_harvest() -> void:
	if QuestManager.is_dialogue_open or active_channel_mode != "":
		return
	var target: Node3D = GameState.nearest_interactable
	if not target or not is_instance_valid(target):
		return
	var dist: float = player_ship.global_position.distance_to(target.global_position)
	if dist > 40.0:
		GameState.add_log("SENSOR", "Außerhalb der Bio-Siphon-Reichweite (%.1f AE > 40 AE)." % dist)
		return
	if not bool(target.get_meta("is_harvestable", false)):
		GameState.add_log("NAV", "Dieses Objekt ist ein Schiff/Konstrukt — Bio-Siphon nur auf Planeten & Monden möglich! Drücke [F].")
		return

	var p_key: String = _get_target_planet_key(target)
	if not GameState.is_planet_scanned(p_key):
		GameState.add_log("WARNUNG", "⚠️ Scan erforderlich [F]! Vor der Bio-Extraktion muss %s spektralanalysiert werden." % str(target.get("display_name")))
		return

	if GameState.is_planet_depleted(p_key):
		GameState.add_log("WARNUNG", "🔴 Vorkommen erschöpft! %s wurde bereits abgeerntet — keine weitere Extraktion möglich." % str(target.get("display_name")))
		return

	if GameState.bio_energy < 10.0:
		GameState.add_log("WARNUNG", "⚠️ Unzureichende Bio-Energie (%.0f / 10) für Siphon-Kanalisierung!" % GameState.bio_energy)
		return

	GameState.bio_energy = max(0.0, GameState.bio_energy - 10.0)
	GameState.vitals_updated.emit()
	_start_channeling("harvest", target, Color(0.0, 1.0, 0.55, 0.9))
	GameState.add_log("ERNTE", "🌿 Bio-Siphon aktiviert: Extrahiere Ressourcen von %s... (-10 Bio-Energie)" % str(target.get("display_name")))

func _handle_r_abduct() -> void:
	if QuestManager.is_dialogue_open or active_channel_mode != "":
		return
	var target: Node3D = GameState.nearest_interactable
	if not target or not is_instance_valid(target):
		return
	var dist: float = player_ship.global_position.distance_to(target.global_position)
	if dist > 40.0:
		GameState.add_log("SENSOR", "Zu weit entfernt für psionischen Traktorstrahl (%.1f AE > 40 AE)." % dist)
		return
	if not bool(target.get_meta("is_harvestable", false)):
		GameState.add_log("NAV", "Psionischer Traktorstrahl [R] erfordert einen besiedelten Himmelskörper.")
		return

	var p_key: String = _get_target_planet_key(target)
	if not GameState.is_planet_scanned(p_key):
		GameState.add_log("WARNUNG", "⚠️ Scan erforderlich [F]! Scanne %s zuerst nach Lebenszeichen." % str(target.get("display_name")))
		return

	if GameState.crew.size() >= GameState.max_crew_capacity:
		GameState.add_log("WARNUNG", "⚠️ Kokon-Kammern voll (%d/%d)! Keine weiteren Symbionten aufnehmbar." % [GameState.crew.size(), GameState.max_crew_capacity])
		return

	if GameState.mental_energy < 15.0:
		GameState.add_log("WARNUNG", "⚠️ Unzureichende Mentalkraft (%.0f / 15 🧠) für psionischen Traktorstrahl!" % GameState.mental_energy)
		return

	var raw_data: Dictionary = target.get("raw_planet_data") if target.get("raw_planet_data") != null else {}
	var is_moon: bool = (str(target.get_meta("entity_category", "")) == "moon")
	var dossier: Dictionary = GameState.get_or_create_planet_dossier(p_key, raw_data, is_moon)
	var cands: Array = dossier.get("candidates", [])
	if cands.is_empty():
		GameState.add_log("SENSOR", "Keine vernunftbegabten Individuen (mehr) auf %s für psionische Entführung verfügbar." % str(target.get("display_name")))
		return

	GameState.mental_energy = max(0.0, GameState.mental_energy - 15.0)
	GameState.vitals_updated.emit()
	_start_channeling("abduct", target, Color(0.72, 0.32, 1.0, 0.92))
	GameState.add_log("PSIONIK", "🔮 Psionischer Traktorstrahl aktiviert (-15 🧠 Mentalkraft): Erfasse Bewusstsein auf %s..." % str(target.get("display_name")))

func _start_channeling(mode: String, target: Node3D, beam_color: Color) -> void:
	_cleanup_channel_visuals()
	active_channel_mode = mode
	active_channel_target = target
	active_channel_progress = 0.0
	if mode == "scan" or mode == "salvage_wreck":
		_start_channel_sfx("waves_scanner.wav", 1.0 if mode == "scan" else 0.88, -9.5)
	else:
		var ch_pitch: float = 0.92 if mode == "harvest" else 1.08
		_start_channel_sfx("quantum_scan_stream.wav", ch_pitch, -11.0)

	if procedural_container:
		active_channel_beam = Node3D.new()
		var beam_inst := MeshInstance3D.new()
		beam_inst.name = "BeamMesh"
		var cyl := CylinderMesh.new()
		cyl.top_radius = 0.24
		cyl.bottom_radius = 0.42
		cyl.height = 1.0
		var mat := StandardMaterial3D.new()
		mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		mat.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
		mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		mat.albedo_color = beam_color
		cyl.material = mat
		beam_inst.mesh = cyl
		beam_inst.rotation.x = PI * 0.5
		active_channel_beam.add_child(beam_inst)
		procedural_container.add_child(active_channel_beam)

		active_channel_ring = MeshInstance3D.new()
		var torus := TorusMesh.new()
		torus.inner_radius = 1.4
		torus.outer_radius = 1.75
		torus.material = mat
		active_channel_ring.mesh = torus
		procedural_container.add_child(active_channel_ring)

	var t_name: String = str(target.get("display_name")) if target.get("display_name") != null else target.name
	GameState.channel_progress_updated.emit(active_channel_mode, 0.0, t_name)

func _cleanup_channel_visuals() -> void:
	_stop_channel_sfx()
	if active_channel_beam and is_instance_valid(active_channel_beam):
		active_channel_beam.queue_free()
	active_channel_beam = null
	if active_channel_ring and is_instance_valid(active_channel_ring):
		active_channel_ring.queue_free()
	active_channel_ring = null

func _cancel_channeling(reason: String) -> void:
	var old_mode: String = active_channel_mode
	active_channel_mode = ""
	active_channel_target = null
	active_channel_progress = 0.0
	_cleanup_channel_visuals()
	GameState.channel_progress_updated.emit("", 0.0, "")
	if reason != "":
		GameState.add_log("ABBRUCH", "❌ %s abgebrochen: %s" % [old_mode.to_upper(), reason])

func _update_active_channeling(delta: float) -> void:
	if active_channel_mode == "":
		return
	if not active_channel_target or not is_instance_valid(active_channel_target) or not player_ship:
		_cancel_channeling("Ziel verloren.")
		return

	var p_pos: Vector3 = player_ship.global_position
	var t_pos: Vector3 = active_channel_target.global_position
	var dist: float = p_pos.distance_to(t_pos)
	if dist > 46.0:
		_cancel_channeling("Außerhalb der Orbit-Reichweite (%.1f AE > 46 AE)." % dist)
		return

	# Update live 3D beam geometry between Najmafar and orbiting target
	if active_channel_beam and is_instance_valid(active_channel_beam):
		var mid: Vector3 = (p_pos + t_pos) * 0.5 + Vector3(0.0, 0.35, 0.0)
		active_channel_beam.global_position = mid
		active_channel_beam.look_at(t_pos + Vector3(0.0, 0.35, 0.0), Vector3.UP)
		var bm: MeshInstance3D = active_channel_beam.get_node_or_null("BeamMesh") as MeshInstance3D
		if bm and bm.mesh is CylinderMesh:
			var cyl: CylinderMesh = bm.mesh as CylinderMesh
			cyl.height = max(0.5, dist)
	if active_channel_ring and is_instance_valid(active_channel_ring):
		active_channel_ring.global_position = Vector3(t_pos.x, 0.25, t_pos.z)
		var pulse_s: float = 1.0 + sin(Time.get_ticks_msec() * 0.012) * 0.25
		active_channel_ring.scale = Vector3(pulse_s, 1.0, pulse_s)

	var speed_pct_per_sec: float = 58.0 # ~1.7s for scan
	if active_channel_mode == "harvest":
		speed_pct_per_sec = 42.0 # ~2.4s for harvest
	elif active_channel_mode == "abduct":
		speed_pct_per_sec = 46.0 # ~2.2s for abduction
	elif active_channel_mode == "salvage_wreck":
		speed_pct_per_sec = 62.0 # ~1.6s for wreck salvage

	active_channel_progress = min(100.0, active_channel_progress + speed_pct_per_sec * delta)
	var t_name: String = str(active_channel_target.get("display_name")) if active_channel_target.get("display_name") != null else active_channel_target.name
	GameState.channel_progress_updated.emit(active_channel_mode, active_channel_progress, t_name)

	if active_channel_progress >= 100.0:
		_complete_channeling()

func _complete_channeling() -> void:
	var mode: String = active_channel_mode
	var target: Node3D = active_channel_target
	active_channel_mode = ""
	active_channel_target = null
	active_channel_progress = 0.0
	_cleanup_channel_visuals()
	GameState.channel_progress_updated.emit("", 0.0, "")

	if not target or not is_instance_valid(target):
		return

	_play_sfx("quantum_scan_complete.wav")
	var p_key: String = _get_target_planet_key(target)
	var raw_data: Dictionary = target.get("raw_planet_data") if target.get("raw_planet_data") != null else {}
	var cat: String = str(target.get_meta("entity_category", ""))
	var is_moon: bool = (cat == "moon")
	var p_type: String = str(target.get("planet_type")) if target.get("planet_type") != null else "Rocky"
	var t_name: String = str(target.get("display_name")) if target.get("display_name") != null else target.name

	if mode == "salvage_wreck":
		_complete_wreck_salvage(target)
		return
	elif mode == "scan":
		var dossier: Dictionary = GameState.get_or_create_planet_dossier(p_key, raw_data, is_moon)
		GameState.mark_planet_scanned(p_key, dossier)
		var mental_bonus: float = 10.0
		var ruins_hint: String = ""
		if bool(dossier.get("hasRuins", false)):
			mental_bonus += 8.0
			GameState.tech_res += 3
			ruins_hint = " | 🏛️ %s geortet (+3 ⚙️ Orbital-Tech; Shuttle für Tiefenbergung!)" % str(dossier.get("ruinsName", "Ruinen"))
		GameState.mental_energy = min(GameState.max_mental_energy, GameState.mental_energy + mental_bonus)
		GameState.vitals_updated.emit()
		var cand_count: int = (dossier.get("candidates", []) as Array).size()
		var life_hint: String = " | 🧬 %d Lebenszeichen ([R] Entführen)" % cand_count if cand_count > 0 else ""
		GameState.add_log("SCAN", "✅ Spektral-Scan abgeschlossen: %s (+%.0f 🧠%s%s). [E] zum Ernten." % [t_name, mental_bonus, life_hint, ruins_hint])

	elif mode == "harvest":
		GameState.mark_planet_depleted(p_key)
		if target.has_method("mark_visual_depleted"):
			target.call("mark_visual_depleted")

		var dossier: Dictionary = GameState.get_or_create_planet_dossier(p_key, raw_data, is_moon)
		var bio_mult: float = GameState.get_bio_harvest_multiplier()
		var sil_mult: float = GameState.get_silicon_harvest_multiplier()

		# Orbital Bio-Siphon [E] ONLY harvests raw base matter (Biomass, Silicon, raw Qahwun, Bio-Energy)!
		# Water, Food, Tech and Alloys require a Crew + Shuttle Away Mission on suitable planets!
		var bio_gain: int = 0
		var sil_gain: int = 0
		var spice_gain: int = 0

		if cat == "custom":
			sil_gain = int(round(32.0 * sil_mult))
			bio_gain = int(round(12.0 * bio_mult))
		elif p_type == "Habitable":
			bio_gain = int(round(60.0 * bio_mult))
			sil_gain = int(round(18.0 * sil_mult))
			spice_gain = 6
		elif p_type in ["Ice", "Eismond"]:
			sil_gain = int(round(28.0 * sil_mult))
			bio_gain = int(round(16.0 * bio_mult))
		elif p_type == "Gas Giant":
			# Gas Giants yield ONLY atmospheric Bio-Plankton & Bio-Energy (no Food, no Tech, no Alloys!)
			bio_gain = int(round(42.0 * bio_mult))
			sil_gain = int(round(10.0 * sil_mult))
		elif p_type == "Desert":
			sil_gain = int(round(42.0 * sil_mult))
			spice_gain = 18
			bio_gain = int(round(15.0 * bio_mult))
		else:
			sil_gain = int(round(48.0 * sil_mult))
			bio_gain = int(round(22.0 * bio_mult))

		if t_name.contains("Arrakis"):
			spice_gain += 28

		GameState.bio_res += bio_gain
		GameState.silicon_res += sil_gain
		GameState.melange_res += spice_gain
		GameState.bio_energy = min(GameState.max_bio_energy, GameState.bio_energy + 20.0)
		GameState.health = min(GameState.max_health, GameState.health + 10.0)
		GameState.vitals_updated.emit()

		var parts: Array[String] = []
		if bio_gain > 0: parts.append("+%d 🌿 Bio" % bio_gain)
		if sil_gain > 0: parts.append("+%d 💎 Sil" % sil_gain)
		if spice_gain > 0: parts.append("+%d ☕ Qahwun" % spice_gain)
		parts.append("+20%% ⚡ Bio-Energie")

		var dep_count: int = (dossier.get("deposits", []) as Array).size()
		var away_hint: String = " | 🚀 Oberflächen-Vorkommen per Außenmission [F] bergbar!" if dep_count > 0 else ""
		GameState.add_log("ERNTE", "🌿 Orbital-Siphon von %s abgeschlossen (%s).%s" % [t_name, ", ".join(parts), away_hint])

	elif mode == "abduct":
		var dossier: Dictionary = GameState.get_or_create_planet_dossier(p_key, raw_data, is_moon)
		var cands: Array = dossier.get("candidates", [])
		if not cands.is_empty():
			var cand: Dictionary = cands.pop_front()
			cand["is_abducted"] = true
			dossier["candidates"] = cands
			GameState.planet_dossiers[p_key] = dossier
			GameState.crew.append(cand)
			GameState.loneliness = max(5.0, GameState.loneliness - 20.0)
			GameState.mental_energy = min(GameState.max_mental_energy, GameState.mental_energy + 15.0)
			GameState.vitals_updated.emit()
			GameState.crew_updated.emit()
			GameState.dossier_updated.emit(p_key, dossier)
			GameState.add_log("CREW", "🔮 PSIONISCHE ASSIMILATION: %s (%s — %s) in Kokon-Kammer aufgenommen! (%d/%d Crew)" % [
				str(cand.get("name", "Symbiont")),
				str(cand.get("species", "Spezies")),
				str(cand.get("role", "Rolle")),
				GameState.crew.size(),
				GameState.max_crew_capacity
			])

func _spawn_hostile_drone(variant: String, spawn_pos: Vector3, initial_heading: float = 0.0) -> Node3D:
	if not procedural_container:
		return null
	var drone: Node3D = HostileDroneScript.new() as Node3D
	if not drone:
		return null
	drone.position = Vector3(spawn_pos.x, 0.0, spawn_pos.z)
	procedural_container.add_child(drone)
	drone.call("setup_drone", variant, spawn_pos, initial_heading)
	active_hostiles.append(drone)
	return drone

func _handle_k_spawn_combat_test() -> void:
	if QuestManager.is_dialogue_open or GameState.is_map_open or not player_ship:
		return
	var alive_count: int = 0
	for h in active_hostiles:
		if is_instance_valid(h):
			alive_count += 1
	if alive_count >= 6:
		GameState.add_log("KAMPF", "⚔️ Bereits %d aktive Feind-Drohnen im Sektor (Max. 6 für Kampf-Test)!" % alive_count)
		return

	var fwd: Vector3 = player_ship.get_forward_dir()
	var base_angle: float = atan2(-fwd.z, fwd.x)
	var fan_angles: Array[float] = [-24.0, 0.0, 24.0]
	var fan_dists: Array[float] = [36.0, 40.0, 36.0]
	var fan_variants: Array[String] = ["scout", "enforcer", "scout"]

	var spawned: int = 0
	for idx in range(fan_angles.size()):
		if alive_count + spawned >= 6:
			break
		var ang: float = base_angle + deg_to_rad(fan_angles[idx])
		var offset: Vector3 = Vector3(cos(ang), 0.0, -sin(ang)) * fan_dists[idx]
		var s_pos: Vector3 = player_ship.global_position + offset
		s_pos.y = 0.0
		var face_player: float = ang + PI
		var d: Node3D = _spawn_hostile_drone(fan_variants[idx], s_pos, face_player)
		if d:
			_spawn_impact_flash(s_pos, Color(1.0, 0.25, 0.2, 0.85), 3.4, 0.35)
			spawned += 1

	if spawned > 0:
		_play_sfx("sonar_ping.wav", 0.92, -11.0)
		GameState.add_log("KAMPF-TEST", "⚔️ %d INSAN-Drohnen voraus gespawnt! Ziele mit [A/D] und feuere den Psi-Kegel mit [X] oder [Leertaste]!" % spawned)

func _spawn_enemy_projectile(origin: Vector3, dir: Vector3, spd: float, dmg: float) -> void:
	if not procedural_container:
		return
	var flat_dir: Vector3 = Vector3(dir.x, 0.0, dir.z).normalized()
	if flat_dir.length_squared() < 0.0001:
		return
	var right: Vector3 = Vector3(-flat_dir.z, 0.0, flat_dir.x).normalized()

	var bolt_node := Node3D.new()
	bolt_node.position = Vector3(origin.x, 0.25, origin.z)
	bolt_node.basis = Basis(right, Vector3.UP, -flat_dir)

	var bolt_mesh := MeshInstance3D.new()
	var cap := CapsuleMesh.new()
	cap.radius = 0.14
	cap.height = 1.25
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	mat.albedo_color = Color(1.0, 0.28, 0.16, 0.95)
	cap.material = mat
	bolt_mesh.mesh = cap
	bolt_mesh.rotation.x = PI * 0.5
	bolt_mesh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	bolt_node.add_child(bolt_mesh)
	procedural_container.add_child(bolt_node)

	active_enemy_projectiles.append({
		"node": bolt_node,
		"vel": flat_dir * spd,
		"dmg": dmg,
		"life": 2.4
	})
	_play_sfx("laser_weapon_shot.wav", randf_range(0.93, 1.08), -11.5)

func _update_combat_system(delta: float) -> void:
	if psi_cone_cooldown_timer > 0.0:
		psi_cone_cooldown_timer = max(0.0, psi_cone_cooldown_timer - delta)
	if QuestManager.is_dialogue_open or GameState.is_map_open or not player_ship:
		return

	var p_pos: Vector3 = player_ship.global_position
	var fire_cb: Callable = Callable(self, "_spawn_enemy_projectile")
	for i in range(active_hostiles.size() - 1, -1, -1):
		var d: Node3D = active_hostiles[i]
		if not is_instance_valid(d):
			active_hostiles.remove_at(i)
			continue
		d.call("update_combat_ai", delta, p_pos, fire_cb)

	for i in range(active_enemy_projectiles.size() - 1, -1, -1):
		var proj: Dictionary = active_enemy_projectiles[i]
		var b_node: Node3D = proj.get("node") as Node3D
		if not b_node or not is_instance_valid(b_node):
			active_enemy_projectiles.remove_at(i)
			continue
		var life: float = float(proj.get("life", 0.0)) - delta
		if life <= 0.0:
			b_node.queue_free()
			active_enemy_projectiles.remove_at(i)
			continue
		var vel: Vector3 = proj.get("vel", Vector3.ZERO)
		b_node.global_position += vel * delta
		proj["life"] = life
		active_enemy_projectiles[i] = proj

		var b_flat: Vector3 = Vector3(b_node.global_position.x, 0.0, b_node.global_position.z)
		var p_flat: Vector3 = Vector3(p_pos.x, 0.0, p_pos.z)
		if b_flat.distance_to(p_flat) <= 2.2:
			var dmg: float = float(proj.get("dmg", 6.0))
			GameState.apply_combat_damage(dmg, "INSAN-Plasmafeuer")
			player_ship.trigger_damage_flash()
			_play_sfx("ship_thrust_ignite.wav", 0.58, -10.0)
			_spawn_impact_flash(b_node.global_position, Color(1.0, 0.25, 0.16, 0.95), 2.4, 0.22)
			b_node.queue_free()
			active_enemy_projectiles.remove_at(i)

func _handle_drone_destroyed(drone: Node3D, list_idx: int) -> void:
	var d_pos: Vector3 = drone.global_position
	var d_variant: String = str(drone.get("variant")) if drone.get("variant") != null else "scout"
	var d_name: String = str(drone.get("display_name")) if drone.get("display_name") != null else "Drohne"

	var alloy_gain: int = 11 if d_variant == "enforcer" else 6
	var tech_gain: int = 8 if d_variant == "enforcer" else 4
	var sil_gain: int = 16 if d_variant == "enforcer" else 10
	var energy_gain: float = 18.0 if d_variant == "enforcer" else 12.0
	var mental_gain: float = 8.0 if d_variant == "enforcer" else 4.0

	GameState.alloy_res += alloy_gain
	GameState.tech_res += tech_gain
	GameState.silicon_res += sil_gain
	GameState.bio_energy = min(GameState.max_bio_energy, GameState.bio_energy + energy_gain)
	GameState.mental_energy = min(GameState.max_mental_energy, GameState.mental_energy + mental_gain)
	GameState.combat_kills += 1
	GameState.vitals_updated.emit()

	_play_sfx("ship_thrust_ignite.wav", 1.32, -9.0)
	_spawn_impact_flash(d_pos, Color(1.0, 0.52, 0.25, 0.95), 5.2, 0.35)
	GameState.add_log("BEUTE", "💥 %s zerlegt! Bergung: +%d 🛡️ Leg, +%d ⚙️ Tech, +%d 💎 Sil, +%.0f%% ⚡!" % [
		d_name, alloy_gain, tech_gain, sil_gain, energy_gain
	])
	active_hostiles.remove_at(list_idx)
	drone.queue_free()

func _complete_wreck_salvage(wreck: Node3D) -> void:
	if not wreck or not is_instance_valid(wreck):
		return
	var w_key: String = _get_target_planet_key(wreck)
	if GameState.is_wreck_salvaged(w_key):
		return
	GameState.mark_wreck_salvaged(w_key)

	var h_seed: int = abs(w_key.hash())
	var sil_gain: int = 15 + (h_seed % 9)
	var alloy_gain: int = 5 + (h_seed % 5)
	var water_gain: int = 6 + (h_seed % 4)
	var food_gain: int = 5 + (h_seed % 5)
	var tech_gain: int = 3 if (h_seed % 3 == 0) else 0

	GameState.silicon_res += sil_gain
	GameState.alloy_res += alloy_gain
	GameState.add_water(water_gain)
	GameState.add_food(food_gain)
	GameState.tech_res += tech_gain
	GameState.bio_energy = min(GameState.max_bio_energy, GameState.bio_energy + 16.0)
	GameState.vitals_updated.emit()

	var cur_title: String = str(wreck.get("display_name")) if wreck.get("display_name") != null else "Wrack"
	var clean_title: String = cur_title.replace(" [WRACK]", "") + " [GEBORGEN]"
	wreck.set("display_name", clean_title)
	wreck.set_meta("display_name", clean_title)

	var beacon: OmniLight3D = wreck.get_node_or_null("WreckBeacon") as OmniLight3D
	if beacon:
		beacon.light_energy = 0.0
	var core_mesh: MeshInstance3D = wreck.get_node_or_null("WreckCore") as MeshInstance3D
	if core_mesh and core_mesh.mesh and core_mesh.mesh.surface_get_material(0) is StandardMaterial3D:
		var c_mat: StandardMaterial3D = core_mesh.mesh.surface_get_material(0) as StandardMaterial3D
		c_mat.emission_enabled = false
		c_mat.albedo_color = Color(0.24, 0.26, 0.30)

	_spawn_impact_flash(wreck.global_position, Color(1.0, 0.72, 0.22, 0.9), 3.6, 0.32)
	var log_snippets: Array[String] = [
		"Logbuch: 'INSAN-Drohnen haben unseren Antrieb gesperrt — wir lassen die Vorräte zurück!'",
		"Logbuch: 'Kometen-Eis im Gürtel hat uns gerettet, bevor der Reaktor ausfiel.'",
		"Logbuch: 'Seltsame Gravitations-Echos aus dem inneren Sektor gemessen...'",
		"Logbuch: 'Notkapseln gestartet. Wer diese Fracht findet: haltet euch von den Abschleppern fern!'"
	]
	var snippet: String = log_snippets[h_seed % log_snippets.size()]
	var tech_str: String = (", +%d ⚙️ Tech" % tech_gain) if tech_gain > 0 else ""
	GameState.add_log("WRACK-BERGUNG", "🔩 %s geborgen: +%d 💎 Sil, +%d 🛡️ Leg, +%d 💧 H2O, +%d 🍖 Food%s, +16%% ⚡! (%s)" % [
		clean_title.replace(" [GEBORGEN]", ""), sil_gain, alloy_gain, water_gain, food_gain, tech_str, snippet
	])

func _shatter_monolith_asteroid(ast: Node3D, list_idx: int) -> void:
	if not ast or not is_instance_valid(ast):
		return
	var origin_p: Vector3 = ast.global_position
	active_asteroids.remove_at(list_idx)
	_play_sfx("ship_thrust_ignite.wav", 1.18, -9.5)
	_spawn_impact_flash(origin_p, Color(0.55, 0.88, 1.0, 0.92), 4.4, 0.30)

	var shard_types: Array[String] = ["ice", "bio", "silicon"]
	for s_i in range(shard_types.size()):
		var ang: float = float(s_i) * (TAU / 3.0) + randf() * 0.5
		var target_p: Vector3 = origin_p + Vector3(cos(ang), 0.0, sin(ang)) * randf_range(5.5, 9.0)
		var shard: Node3D = _create_asteroid_node({
			"type": shard_types[s_i],
			"world_x": origin_p.x,
			"world_z": origin_p.z
		})
		if procedural_container:
			procedural_container.add_child(shard)
			active_asteroids.append(shard)
			var tw_s: Tween = create_tween()
			tw_s.tween_property(shard, "global_position", Vector3(target_p.x, 0.0, target_p.z), 0.32).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	ast.queue_free()

func _on_decoy_trap_triggered() -> void:
	for i in range(interactable_bodies.size() - 1, -1, -1):
		var body: Node3D = interactable_bodies[i]
		if is_instance_valid(body) and str(body.get_meta("entity_category", "")) == "jamal_shuttle":
			var trap_pos: Vector3 = body.global_position
			interactable_bodies.remove_at(i)
			body.set_process(false)
			_play_sfx("sonar_ping.wav", 1.35, -8.5)
			_spawn_impact_flash(trap_pos, Color(1.0, 0.28, 0.35, 0.95), 5.5, 0.42)
			var tw: Tween = create_tween()
			tw.tween_property(body, "scale", Vector3(0.02, 2.4, 0.02), 0.38).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_IN)
			tw.chain().tween_callback(func():
				if is_instance_valid(body):
					body.queue_free()
			)
			if not Engine.is_editor_hint() and player_ship:
				var to_p: Vector3 = player_ship.global_position - trap_pos
				var face_ang: float = atan2(-to_p.z, to_p.x)
				_spawn_hostile_drone("scout", trap_pos + Vector3(3.0, 0.0, -3.0), face_ang)
				GameState.add_log("HINTERHALT", "🤖 INSAN-Köderdrohne enttarnt! Bekämpfe sie mit dem Psi-Kegel [X] oder falte den Raum [M]!")
			break

func _on_real_ship_liberated_visual() -> void:
	for i in range(interactable_bodies.size() - 1, -1, -1):
		var body: Node3D = interactable_bodies[i]
		if is_instance_valid(body) and str(body.get_meta("entity_category", "")) == "jamal_shuttle":
			interactable_bodies.remove_at(i)
			body.set_process(false)
			var clamp_node: Node = body.get_node_or_null("ClampRing")
			if clamp_node:
				clamp_node.queue_free()
			_play_sfx("quantum_scan_complete.wav", 1.08, -7.5)
			_spawn_impact_flash(body.global_position, Color(1.0, 0.72, 0.18, 0.95), 5.0, 0.38)
			var dock_pos: Vector3 = player_ship.global_position if player_ship else body.global_position
			var tw: Tween = create_tween()
			tw.set_parallel(true)
			tw.tween_property(body, "global_position", dock_pos, 0.85).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_IN_OUT)
			tw.tween_property(body, "scale", Vector3(0.08, 0.08, 0.08), 0.85).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_IN)
			tw.chain().tween_callback(func():
				if is_instance_valid(body):
					body.queue_free()
			)
			break

func _on_player_emergency_revived() -> void:
	if not player_ship:
		return
	var p_pos: Vector3 = player_ship.global_position
	for h in active_hostiles:
		if is_instance_valid(h):
			var away: Vector3 = Vector3(h.global_position.x - p_pos.x, 0.0, h.global_position.z - p_pos.z)
			var push_dir: Vector3 = away.normalized() if away.length_squared() > 0.01 else Vector3(1.0, 0.0, 0.0)
			h.call("apply_psi_hit", 0.0, 3.0, push_dir * 28.0)
	for proj in active_enemy_projectiles:
		var b_node: Node3D = proj.get("node") as Node3D
		if b_node and is_instance_valid(b_node):
			b_node.queue_free()
	active_enemy_projectiles.clear()

func _handle_x_psi_cone() -> void:
	if QuestManager.is_dialogue_open or GameState.is_map_open or not player_ship:
		return
	if psi_cone_cooldown_timer > 0.0:
		return

	var bio_cost: float = 10.0
	var mental_cost: float = 4.0 if GameState.is_mutation_purchased("telepathic_focus") else 6.0
	if GameState.bio_energy < bio_cost or GameState.mental_energy < mental_cost:
		GameState.add_log("WARNUNG", "⚠️ Psi-Kegel benötigt %.0f ⚡ Bio-Energie & %.0f 🧠 Mentalkraft (Vorhanden: %.0f ⚡ / %.0f 🧠)!" % [
			bio_cost, mental_cost, GameState.bio_energy, GameState.mental_energy
		])
		return

	GameState.bio_energy = max(0.0, GameState.bio_energy - bio_cost)
	GameState.mental_energy = max(0.0, GameState.mental_energy - mental_cost)
	psi_cone_cooldown_timer = psi_cone_cooldown
	GameState.vitals_updated.emit()

	var p_pos: Vector3 = player_ship.global_position
	var cone_dir: Vector3 = player_ship.get_forward_dir()
	var vfx_origin: Vector3 = p_pos + cone_dir * 0.9
	var half_rad: float = deg_to_rad(psi_cone_half_angle_deg)

	player_ship.trigger_psi_cone_flare(cone_dir)
	_play_sfx("psi_cone_blast.wav", randf_range(0.96, 1.04), -6.5)
	_spawn_psi_cone_vfx(vfx_origin, cone_dir, psi_cone_range, half_rad)

	var eff_dmg: float = psi_cone_base_damage * GameState.get_psi_damage_multiplier()
	var eff_stun: float = psi_cone_stun_sec + (1.0 if GameState.is_mutation_purchased("telepathic_focus") else 0.0)
	var hit_count: int = 0
	var kill_count: int = 0

	# 1. Hit Hostile Drones inside Psi Cone
	for i in range(active_hostiles.size() - 1, -1, -1):
		var d: Node3D = active_hostiles[i]
		if not is_instance_valid(d):
			active_hostiles.remove_at(i)
			continue
		var hit_r: float = float(d.get("hit_radius")) if d.get("hit_radius") != null else 1.8
		if _is_point_in_psi_cone(p_pos, cone_dir, d.global_position, hit_r, psi_cone_range, half_rad):
			hit_count += 1
			var away: Vector3 = Vector3(d.global_position.x - p_pos.x, 0.0, d.global_position.z - p_pos.z)
			var away_n: Vector3 = away.normalized() if away.length_squared() > 0.01 else cone_dir
			var kb_vel: Vector3 = (away_n * 0.65 + cone_dir * 0.35).normalized() * 24.0
			_spawn_impact_flash(d.global_position, Color(0.62, 0.42, 1.0, 0.95), 2.8, 0.25)
			var destroyed: bool = bool(d.call("apply_psi_hit", eff_dmg, eff_stun, kb_vel))
			if destroyed:
				kill_count += 1
				_handle_drone_destroyed(d, i)

	# 2. Psionically Dissolve Incoming Enemy Plasma Bolts in Cone
	var vaporized_bolts: int = 0
	for i in range(active_enemy_projectiles.size() - 1, -1, -1):
		var proj: Dictionary = active_enemy_projectiles[i]
		var b_node: Node3D = proj.get("node") as Node3D
		if not b_node or not is_instance_valid(b_node):
			active_enemy_projectiles.remove_at(i)
			continue
		if _is_point_in_psi_cone(p_pos, cone_dir, b_node.global_position, 1.4, psi_cone_range, half_rad):
			_spawn_impact_flash(b_node.global_position, Color(0.45, 0.92, 1.0, 0.9), 1.6, 0.18)
			b_node.queue_free()
			active_enemy_projectiles.remove_at(i)
			vaporized_bolts += 1

	# 3. Shatter Heavy Monolith Boulders into Collectible Shards & Push Small Asteroids
	var shattered_rocks: int = 0
	for a_idx in range(active_asteroids.size() - 1, -1, -1):
		var ast: Node3D = active_asteroids[a_idx]
		if not is_instance_valid(ast):
			active_asteroids.remove_at(a_idx)
			continue
		var a_type: String = str(ast.get_meta("asteroid_type", "silicon"))
		var r_rad: float = float(ast.get_meta("rock_radius", 1.5))
		if _is_point_in_psi_cone(p_pos, cone_dir, ast.global_position, r_rad, psi_cone_range, half_rad):
			if a_type == "monolith":
				_shatter_monolith_asteroid(ast, a_idx)
				shattered_rocks += 1
			else:
				var push_target: Vector3 = ast.global_position + cone_dir * 4.5
				var tw_ast: Tween = create_tween()
				tw_ast.tween_property(ast, "global_position", push_target, 0.25).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)

	# 4. Crack Open Derelict Wrecks + Quest Shuttle Clamp Interactions
	var cracked_wrecks: int = 0
	var sys: Dictionary = GameState.get_current_system()
	var in_depot: bool = bool(sys.get("isInsanDepot", false)) or String(sys.get("name", "")).contains("INSAN")
	for body in interactable_bodies:
		if not is_instance_valid(body):
			continue
		var b_cat: String = str(body.get_meta("entity_category", ""))
		if b_cat == "derelict_wreck":
			var w_key: String = _get_target_planet_key(body)
			if not GameState.is_wreck_salvaged(w_key) and _is_point_in_psi_cone(p_pos, cone_dir, body.global_position, 2.8, psi_cone_range, half_rad):
				_complete_wreck_salvage(body)
				cracked_wrecks += 1
		elif b_cat == "jamal_shuttle":
			if GameState.current_system_id == 1 and not GameState.jamal_decoy_revealed:
				if _is_point_in_psi_cone(p_pos, cone_dir, body.global_position, 3.2, psi_cone_range, half_rad):
					QuestManager.trigger_decoy_trap_sequence()
					return
			elif in_depot and not GameState.jamal_ship_liberated:
				if _is_point_in_psi_cone(p_pos, cone_dir, body.global_position, 3.5, psi_cone_range, half_rad):
					QuestManager.liberate_real_ship()
					return
				elif p_pos.distance_to(body.global_position) <= psi_cone_range + 6.0:
					GameState.add_log("SENSOR", "🎯 Richte Najmafars Nase direkt auf die Ar-Riḥla aus, um ihre Parkkralle mit dem Psi-Kegel [X] zu sprengen!")

	if hit_count > 0 or vaporized_bolts > 0 or shattered_rocks > 0 or cracked_wrecks > 0:
		var parts_log: Array[String] = []
		if hit_count > 0:
			parts_log.append("%d Drohne(n) getroffen (%.0f Dmg)" % [hit_count, eff_dmg])
		if kill_count > 0:
			parts_log.append("💥 %d zerstört" % kill_count)
		if vaporized_bolts > 0:
			parts_log.append("%d Geschoss(e) aufgelöst" % vaporized_bolts)
		if shattered_rocks > 0:
			parts_log.append("🪨 %d Monolith(en) in Ressourcen-Splitter gesprengt" % shattered_rocks)
		if cracked_wrecks > 0:
			parts_log.append("🔩 %d Wrack aufgebrochen" % cracked_wrecks)
		GameState.add_log("PSI-KEGEL", "🔮 %s!" % " | ".join(parts_log))
	else:
		GameState.add_log("PSI", "🔮 Gerichteter Psi-Kegel ausgelöst (-%.0f ⚡ / -%.0f 🧠)." % [bio_cost, mental_cost])

func _parse_hex_color(hex_str: String, fallback: Color) -> Color:
	var clean := hex_str.replace("0x", "#")
	if Color.html_is_valid(clean):
		return Color.html(clean)
	return fallback
