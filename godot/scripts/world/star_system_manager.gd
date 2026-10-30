extends Node3D

## Star System World Manager for Project Najmafar (Godot 4.6)
## High-End PBR Planetary Graphics (8K NASA/ESA Textures, Normal/Specular, Clouds, Rings, Atmosphere Rim),
## Moons, Orbit Rings, Asteroids, Detailed Space Stations, Jamal's Ar-Riḥla & Towing Drone, plus Background Music!

@onready var procedural_container: Node3D = $ProceduralSystemContainer
@onready var player_ship: PlayerBioShip = $PlayerBioShip
@onready var world_env: WorldEnvironment = $WorldEnvironment

var interactable_bodies: Array[Node3D] = []
var texture_cache: Dictionary = {}
var bgm_player: AudioStreamPlayer = null
var sfx_player: AudioStreamPlayer = null

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
	_setup_audio()
	GameState.system_changed.connect(_on_system_changed)
	build_star_system(GameState.get_current_system())
	# Trigger Dr. Tariq Jamal's initial telepathic greeting shortly after arrival
	get_tree().create_timer(0.8).timeout.connect(func():
		if not QuestManager.is_dialogue_open and GameState.current_system_id == 1:
			QuestManager.open_dialogue("jamal_orbit_intro")
	)

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

func _setup_audio() -> void:
	bgm_player = AudioStreamPlayer.new()
	bgm_player.volume_db = -10.0
	add_child(bgm_player)
	var track_path := "res://assets/music/outer_rim_solitude.wav"
	if ResourceLoader.exists(track_path):
		bgm_player.stream = load(track_path)
		bgm_player.play()

	sfx_player = AudioStreamPlayer.new()
	sfx_player.volume_db = -8.0
	add_child(sfx_player)

func _play_sfx(sfx_name: String) -> void:
	if not sfx_player:
		return
	var path := "res://assets/sfx/" + sfx_name
	if ResourceLoader.exists(path):
		sfx_player.stream = load(path)
		sfx_player.play()

func _on_system_changed(_sys_id: int, sys_data: Dictionary) -> void:
	build_star_system(sys_data)
	if player_ship:
		player_ship.global_position = Vector3(0.0, 0.0, 150.0)
		player_ship.velocity = Vector3(1.5, 0.0, 0.0)

	var is_depot: bool = sys_data.get("isInsanDepot", false) or String(sys_data.get("name", "")).contains("INSAN")
	if is_depot and not GameState.jamal_ship_liberated:
		QuestManager.advance_quest("prologue_jamal_ship", 3)
		QuestManager.open_dialogue("insan_depot_arrival")

func build_star_system(sys_data: Dictionary) -> void:
	interactable_bodies.clear()
	for child in procedural_container.get_children():
		child.queue_free()

	# 1. Central Star with 8K Solar Photosphere & Volumetric Corona Halo
	var star_info: Dictionary = sys_data.get("star", {"type": "Yellow Sun", "size": 11.0, "color": "0xffd700"})
	var star_size: float = float(star_info.get("size", 11.0))
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
	corona_sphere.radius = star_size * 1.28
	corona_sphere.height = star_size * 2.56
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
	star_light.light_energy = 4.2
	star_light.omni_range = 900.0
	star_light.omni_attenuation = 0.15
	star_light.shadow_enabled = true
	star_light.position = Vector3(0.0, 6.0, 0.0)
	procedural_container.add_child(star_light)

	# 2. Planets, Orbit Lines & Moons
	var planets_list: Array = sys_data.get("planets", [])
	var planet_nodes: Array[OrbitingEntity] = []

	for i in range(planets_list.size()):
		var p_data: Dictionary = planets_list[i]
		var p_dist: float = float(p_data.get("distance", 55.0 + i * 38.0))
		var p_color := _parse_hex_color(String(p_data.get("color", "0x38bdf8")), Color(0.22, 0.74, 0.97))

		# Create visible Planetary Orbit Trajectory Ring around Star (0, 0, 0)
		var orbit_line := _create_orbit_ring_mesh(p_dist, Color(p_color.r, p_color.g, p_color.b, 0.16))
		procedural_container.add_child(orbit_line)

		var p_node := _create_planet_node(p_data, i)
		procedural_container.add_child(p_node)
		planet_nodes.append(p_node)
		interactable_bodies.append(p_node)

		# Spawn Moons for this planet
		var moons_list: Array = p_data.get("moons", [])
		for m_idx in range(moons_list.size()):
			var m_data: Dictionary = moons_list[m_idx]
			var m_node := _create_moon_node(m_data, p_node, m_idx)
			procedural_container.add_child(m_node)
			interactable_bodies.append(m_node)

	# 3. Asteroid Field
	var asteroids_list: Array = sys_data.get("asteroids", [])
	for ast in asteroids_list:
		if typeof(ast) == TYPE_DICTIONARY:
			var ast_node := _create_asteroid_node(ast)
			procedural_container.add_child(ast_node)

	# 4. Space Stations for Spacefaring Planets & Quest Entities
	for p_idx in range(planet_nodes.size()):
		var p_data: Dictionary = planets_list[p_idx]
		var spec = p_data.get("species", null)
		if typeof(spec) == TYPE_DICTIONARY and spec.get("techLevel", "") in ["Spacefaring", "Hyper-Advanced", "Industrial"]:
			_spawn_orbital_station(planet_nodes[p_idx], "%s Orbital-Habitat" % p_data.get("name", "Station"), false)

	var first_planet: Node3D = planet_nodes[0] if planet_nodes.size() > 0 else null
	var is_depot: bool = sys_data.get("isInsanDepot", false) or String(sys_data.get("name", "")).contains("INSAN")

	if GameState.current_system_id == 1 and first_planet:
		_spawn_jamal_shuttle(first_planet, false)
	elif is_depot and first_planet:
		_spawn_orbital_station(first_planet, "INSAN-Hauptverwaltung Zeta-9 (Schalter 7B)", true)
		_spawn_jamal_shuttle(first_planet, true)
		_spawn_voyager_probe()

	# Include any hand-placed OrbitingEntity nodes from the Editor scene tree!
	for node in get_tree().get_nodes_in_group("editor_placed_entities"):
		if node is Node3D and not interactable_bodies.has(node):
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

func _create_planet_node(p_data: Dictionary, index: int) -> OrbitingEntity:
	var p_entity := OrbitingEntity.new()
	var p_name: String = str(p_data.get("name", "Planet %d" % (index + 1)))
	var p_type: String = str(p_data.get("type", "Rocky"))
	var p_size: float = float(p_data.get("size", 3.5))
	var p_dist: float = float(p_data.get("distance", 55.0 + index * 38.0))
	var p_color := _parse_hex_color(String(p_data.get("color", "0x38bdf8")), Color(0.22, 0.74, 0.97))
	var seed_val: int = p_name.hash() + index * 31

	p_entity.name = p_name.validate_node_name()
	p_entity.display_name = "%s [%s]" % [p_name, p_type]
	p_entity.entity_category = "planet"
	p_entity.base_radius = p_size
	p_entity.orbit_radius = p_dist
	p_entity.orbit_angle_deg = float(p_data.get("angle", float(index * 72 + 25)))
	p_entity.orbit_speed = float(p_data.get("speed", 0.045 / sqrt(max(10.0, p_dist)) * 2.5))
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
	# Lightly tint procedural worlds while preserving high-detail photo textures
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

	return p_entity

func _create_moon_node(m_data: Dictionary, parent_planet: OrbitingEntity, m_idx: int) -> OrbitingEntity:
	var m_entity := OrbitingEntity.new()
	var m_name: String = str(m_data.get("name", "%s Mond %d" % [parent_planet.name, m_idx + 1]))
	var m_type: String = str(m_data.get("type", "Kratermond"))
	var m_size: float = float(m_data.get("size", 0.9))
	var m_dist: float = float(m_data.get("distance", parent_planet.base_radius * 2.6 + 6.0 + float(m_idx) * 4.5))
	var m_color := _parse_hex_color(String(m_data.get("color", "0x94a3b8")), Color(0.7, 0.75, 0.82))

	m_entity.name = m_name.validate_node_name()
	m_entity.display_name = "%s [%s]" % [m_name, m_type]
	m_entity.entity_category = "moon"
	m_entity.parent_body = parent_planet
	m_entity.base_radius = m_size
	m_entity.orbit_radius = m_dist
	m_entity.orbit_angle_deg = float(m_idx * 135 + 40)
	m_entity.orbit_speed = 0.14 + 0.06 / sqrt(max(2.0, m_dist))
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

	var m_ring := _create_orbit_ring_mesh(m_dist, Color(m_color.r, m_color.g, m_color.b, 0.14))
	procedural_container.add_child(m_ring)
	m_entity.orbit_ring_mesh = m_ring

	return m_entity

func _create_asteroid_node(ast_data: Dictionary) -> Node3D:
	var is_bio: bool = str(ast_data.get("type", "")) == "bio"
	var size: float = 0.9 + randf() * 1.1
	var inst := MeshInstance3D.new()
	var sph := SphereMesh.new()
	sph.radius = size
	sph.height = size * 1.7
	sph.radial_segments = 7
	sph.rings = 5
	var mat := StandardMaterial3D.new()
	var moon_tex := _load_tex(PLANET_TEXTURES["MARS_PHOBOS"])
	if moon_tex:
		mat.albedo_texture = moon_tex
	mat.albedo_color = Color(0.0, 1.0, 0.53) if is_bio else Color(0.22, 0.74, 0.97)
	mat.roughness = 0.85
	mat.metallic = 0.5
	sph.material = mat
	inst.mesh = sph
	inst.position = Vector3(float(ast_data.get("x", 40.0)) * 2.2, (randf() - 0.5) * 1.5, float(ast_data.get("z", 40.0)) * 2.2)
	return inst

func _create_orbit_ring_mesh(radius: float, color: Color) -> MeshInstance3D:
	var inst := MeshInstance3D.new()
	var torus := TorusMesh.new()
	torus.inner_radius = max(0.1, radius - 0.12)
	torus.outer_radius = radius + 0.12
	torus.rings = 96
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
	shuttle.display_name = "Echte 'Ar-Riḥla' [PIER 4]" if is_real_at_depot else "Dr. Tariq Jamals Forschungsschiff [FALSPARKER]"
	shuttle.entity_category = "jamal_shuttle"
	shuttle.parent_body = parent_planet
	shuttle.base_radius = 0.65
	var p_rad: float = float(parent_planet.get("base_radius")) if parent_planet.get("base_radius") != null else 3.5
	shuttle.orbit_radius = max(24.0, p_rad * 3.85 * 1.35 + 8.0)
	shuttle.orbit_angle_deg = 205.0 if is_real_at_depot else 60.0
	shuttle.orbit_speed = 0.035
	shuttle.is_harvestable = false
	shuttle.emits_radiation = false
	shuttle.dialogue_node_id = "insan_station_bypass_plan" if is_real_at_depot else "jamal_ship_scanned"

	# Detailed Ar-Riḥla Science Shuttle + Industrial Parking Clamp + Towing Drone
	var s_scale := 0.85
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
	strobe.omni_range = 12.0
	shuttle.add_child(strobe)

	procedural_container.add_child(shuttle)
	interactable_bodies.append(shuttle)

func _spawn_orbital_station(parent_planet: Node3D, station_name: String, is_insan: bool) -> void:
	var station := OrbitingEntity.new()
	station.name = station_name.validate_node_name()
	station.display_name = station_name
	station.entity_category = "space_station"
	station.parent_body = parent_planet
	station.base_radius = 2.8
	var p_rad: float = float(parent_planet.get("base_radius")) if parent_planet.get("base_radius") != null else 3.5
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
	interactable_bodies.append(station)

func _spawn_voyager_probe() -> void:
	var probe := OrbitingEntity.new()
	probe.name = "Voyager2Probe"
	probe.display_name = "Voyager 2 (Archaische Raumsonde, 1977)"
	probe.entity_category = "voyager_probe"
	probe.position = Vector3(-95.0, 0.0, 120.0)
	probe.dialogue_node_id = "insan_voyager_liberated"

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

func _process(_delta: float) -> void:
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

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		var key_event: InputEventKey = event as InputEventKey
		if key_event.keycode == KEY_F:
			_handle_f_interaction()
		elif key_event.keycode == KEY_E:
			_handle_e_harvest()
		elif key_event.keycode == KEY_X:
			_handle_x_bio_emp()
		elif key_event.keycode == KEY_Z:
			GameState.flight_assist = not GameState.flight_assist
			GameState.add_log("SYSTEM", "🛸 Flug-Assistent: %s" % ("AN" if GameState.flight_assist else "AUS"))

func _handle_f_interaction() -> void:
	if QuestManager.is_dialogue_open:
		return
	var target: Node3D = GameState.nearest_interactable
	if not target or not is_instance_valid(target):
		return
	var dist: float = player_ship.global_position.distance_to(target.global_position)
	if dist > 32.0:
		GameState.add_log("SENSOR", "Ziel '%s' ist zu weit entfernt (%.1f AE > 32 AE)." % [str(target.get("display_name")), dist])
		return

	_play_sfx("quantum_scan_complete.wav")
	var cat: String = str(target.get_meta("entity_category", ""))
	var dlg: String = str(target.get_meta("dialogue_node_id", ""))
	if cat == "jamal_shuttle" and GameState.jamal_decoy_revealed and GameState.current_system_id == 1:
		QuestManager.open_dialogue("hologram_trap_revealed")
		return
	if dlg != "":
		QuestManager.open_dialogue(dlg)
	else:
		GameState.add_log("SCAN", "✅ Spektral-Scan abgeschlossen: %s (+15 Bio, +10 Silizium)" % str(target.get("display_name")))
		GameState.bio_res += 15
		GameState.silicon_res += 10
		GameState.vitals_updated.emit()

func _handle_e_harvest() -> void:
	if QuestManager.is_dialogue_open:
		return
	var target: Node3D = GameState.nearest_interactable
	if not target or not is_instance_valid(target):
		return
	var dist: float = player_ship.global_position.distance_to(target.global_position)
	if dist > 30.0:
		return
	if not bool(target.get_meta("is_harvestable", false)):
		GameState.add_log("NAV", "Dieses Objekt ist ein Schiff/Station. Drücke [F] zum Untersuchen!")
		return
	_play_sfx("sonar_ping.wav")
	GameState.bio_res += 25
	GameState.silicon_res += 15
	GameState.vitals_updated.emit()
	GameState.add_log("ERNTE", "🌿 Bio-Siphon erfolgreich auf %s (+25 Bio, +15 Silizium)." % str(target.get("display_name")))

func _handle_x_bio_emp() -> void:
	_play_sfx("sonar_ping.wav")
	var target: Node3D = GameState.nearest_interactable
	if target and is_instance_valid(target):
		var dist: float = player_ship.global_position.distance_to(target.global_position)
		if dist <= 32.0 and str(target.get_meta("entity_category", "")) == "jamal_shuttle":
			var sys: Dictionary = GameState.get_current_system()
			if sys.get("isInsanDepot", false) or String(sys.get("name", "")).contains("INSAN"):
				QuestManager.liberate_real_ship()
				return
	GameState.add_log("EMP", "⚡ Psionische Bio-EMP Schockwelle ausgelöst!")

func _parse_hex_color(hex_str: String, fallback: Color) -> Color:
	var clean := hex_str.replace("0x", "#")
	if Color.html_is_valid(clean):
		return Color.html(clean)
	return fallback
