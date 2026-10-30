extends Node3D

## Star System World Manager for Project Najmafar (Godot 4.6)
## Spawns procedural star, planets, moons, space stations, Jamal's research ship, and Voyager 2
## AND supports any hand-placed nodes / custom .glb models you add directly in the Godot 3D Editor!

@onready var procedural_container: Node3D = $ProceduralSystemContainer
@onready var player_ship: PlayerBioShip = $PlayerBioShip

var interactable_bodies: Array[Node3D] = []

func _ready() -> void:
	GameState.system_changed.connect(_on_system_changed)
	build_star_system(GameState.get_current_system())
	# Trigger Dr. Tariq Jamal's initial telepathic greeting shortly after arrival
	get_tree().create_timer(0.8).timeout.connect(func():
		if not QuestManager.is_dialogue_open and GameState.current_system_id == 1:
			QuestManager.open_dialogue("jamal_orbit_intro")
	)

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

	# 1. Central Star
	var star_info: Dictionary = sys_data.get("star", {"type": "Yellow Sun", "size": 11.0, "color": "0xffd700"})
	var star_size: float = float(star_info.get("size", 11.0))
	var star_color := _parse_hex_color(String(star_info.get("color", "0xffd700")), Color(1.0, 0.84, 0.2))

	var star_mesh := MeshInstance3D.new()
	star_mesh.name = "CentralStar"
	var sphere := SphereMesh.new()
	sphere.radius = star_size
	sphere.height = star_size * 2.0
	var star_mat := StandardMaterial3D.new()
	star_mat.albedo_color = star_color
	star_mat.emission_enabled = true
	star_mat.emission = star_color
	star_mat.emission_energy_multiplier = 2.6
	sphere.material = star_mat
	star_mesh.mesh = sphere
	procedural_container.add_child(star_mesh)

	var star_light := OmniLight3D.new()
	star_light.light_color = star_color.lerp(Color.WHITE, 0.35)
	star_light.light_energy = 3.5
	star_light.omni_range = 600.0
	star_light.omni_attenuation = 0.2
	star_Light_pos(star_light)
	procedural_container.add_child(star_light)

	# 2. Planets
	var planets_list: Array = sys_data.get("planets", [])
	var planet_nodes: Array[OrbitingEntity] = []

	for i in range(planets_list.size()):
		var p_data: Dictionary = planets_list[i]
		var p_node := _create_planet_node(p_data, i)
		procedural_container.add_child(p_node)
		planet_nodes.append(p_node)
		interactable_bodies.append(p_node)

	# 3. Quest Entities (Jamal's Research Ship, Towing Drone, INSAN Station, Voyager 2)
	var first_planet: Node3D = planet_nodes[0] if planet_nodes.size() > 0 else null
	var is_depot: bool = sys_data.get("isInsanDepot", false) or String(sys_data.get("name", "")).contains("INSAN")

	if GameState.current_system_id == 1 and first_planet:
		_spawn_jamal_shuttle(first_planet, false)
	elif is_depot and first_planet:
		_spawn_insan_station(first_planet)
		_spawn_jamal_shuttle(first_planet, true)
		_spawn_voyager_probe()

	# Also include any hand-placed OrbitingEntity nodes from the Editor scene tree!
	for node in get_tree().get_nodes_in_group("editor_placed_entities"):
		if node is Node3D and not interactable_bodies.has(node):
			interactable_bodies.append(node)

func star_Light_pos(light: OmniLight3D) -> void:
	light.position = Vector3(0.0, 8.0, 0.0)

func _create_planet_node(p_data: Dictionary, index: int) -> OrbitingEntity:
	var p_entity := OrbitingEntity.new()
	var p_name: String = p_data.get("name", "Planet %d" % (index + 1))
	var p_size: float = float(p_data.get("size", 3.5))
	var p_dist: float = float(p_data.get("distance", 55.0 + index * 38.0))
	var p_color := _parse_hex_color(String(p_data.get("color", "0x38bdf8")), Color(0.22, 0.74, 0.97))

	p_entity.name = p_name.validate_node_name()
	p_entity.display_name = "%s [%s]" % [p_name, p_data.get("type", "Terrestrial")]
	p_entity.entity_category = "planet"
	p_entity.base_radius = p_size
	p_entity.orbit_radius = p_dist
	p_entity.orbit_angle_deg = float(index * 72 + 25)
	p_entity.orbit_speed = float(p_data.get("speed", 0.015))
	p_entity.is_harvestable = true
	p_entity.dynamic_approach_expansion = true

	var mesh_inst := MeshInstance3D.new()
	var sph := SphereMesh.new()
	sph.radius = p_size
	sph.height = p_size * 2.0
	var mat := StandardMaterial3D.new()
	mat.albedo_color = p_color
	mat.roughness = 0.75
	mat.metallic = 0.1
	sph.material = mat
	mesh_inst.mesh = sph
	p_entity.add_child(mesh_inst)

	# Position around star (0,0,0)
	var angle_rad := deg_to_rad(p_entity.orbit_angle_deg)
	p_entity.position = Vector3(cos(angle_rad) * p_dist, 0.0, sin(angle_rad) * p_dist)
	return p_entity

func _spawn_jamal_shuttle(parent_planet: Node3D, is_real_at_depot: bool) -> void:
	var shuttle := OrbitingEntity.new()
	shuttle.name = "JamalResearchShuttle"
	shuttle.display_name = "Echte 'Ar-Riḥla' [PIER 4]" if is_real_at_depot else "Dr. Tariq Jamals Forschungsschiff [FALSPARKER]"
	shuttle.entity_category = "jamal_shuttle"
	shuttle.parent_body = parent_planet
	shuttle.base_radius = 0.65
	shuttle.orbit_radius = max(24.0, parent_planet.get("base_radius") * 3.4 + 12.0)
	shuttle.orbit_angle_deg = 205.0 if is_real_at_depot else 60.0
	shuttle.orbit_speed = 0.035
	shuttle.is_harvestable = false
	shuttle.emits_radiation = false
	shuttle.dialogue_node_id = "insan_station_bypass_plan" if is_real_at_depot else "jamal_ship_scanned"

	# Realistic compact research shuttle mesh (0.65 scale)
	var hull := MeshInstance3D.new()
	var box := BoxMesh.new()
	box.size = Vector3(0.9, 0.45, 1.5)
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.88, 0.92, 0.98)
	mat.emission_enabled = true
	mat.emission = Color(0.22, 0.74, 0.98)
	mat.emission_energy_multiplier = 0.8
	box.material = mat
	hull.mesh = box
	shuttle.add_child(hull)

	procedural_container.add_child(shuttle)
	interactable_bodies.append(shuttle)

func _spawn_insan_station(parent_planet: Node3D) -> void:
	var station := OrbitingEntity.new()
	station.name = "InsanStationZeta9"
	station.display_name = "INSAN-Hauptverwaltung Zeta-9 (Schalter 7B)"
	station.entity_category = "space_station"
	station.parent_body = parent_planet
	station.base_radius = 2.8
	station.orbit_radius = max(28.0, parent_planet.get("base_radius") * 4.5 + 16.0)
	station.orbit_angle_deg = 120.0
	station.orbit_speed = 0.035
	station.dialogue_node_id = "insan_station_bureaucracy"

	var ring := MeshInstance3D.new()
	var torus := TorusMesh.new()
	torus.inner_radius = 2.2
	torus.outer_radius = 3.2
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.96, 0.62, 0.04)
	mat.emission_enabled = true
	mat.emission = Color(0.96, 0.5, 0.05)
	mat.emission_energy_multiplier = 1.2
	torus.material = mat
	ring.mesh = torus
	station.add_child(ring)

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
	cyl.top_radius = 1.2
	cyl.bottom_radius = 0.4
	cyl.height = 0.6
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.98, 0.82, 0.25)
	mat.metallic = 0.85
	cyl.material = mat
	dish.mesh = cyl
	probe.add_child(dish)

	procedural_container.add_child(probe)
	interactable_bodies.append(probe)

func _process(_delta: float) -> void:
	if not player_ship:
		return

	# Find nearest interactable body
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
		if event.keycode == KEY_F:
			_handle_f_interaction()
		elif event.keycode == KEY_E:
			_handle_e_harvest()
		elif event.keycode == KEY_X:
			_handle_x_bio_emp()
		elif event.keycode == KEY_Z:
			GameState.flight_assist = not GameState.flight_assist
			GameState.add_log("SYSTEM", "🛸 Flug-Assistent: %s" % ("AN" if GameState.flight_assist else "AUS"))

func _handle_f_interaction() -> void:
	if QuestManager.is_dialogue_open:
		return
	var target := GameState.nearest_interactable
	if not target or not is_instance_valid(target):
		return
	var dist := player_ship.global_position.distance_to(target.global_position)
	if dist > 32.0:
		GameState.add_log("SENSOR", "Ziel '%s' ist zu weit entfernt (%.1f AE > 32 AE)." % [target.get("display_name"), dist])
		return

	var cat: String = target.get_meta("entity_category", "")
	var dlg: String = target.get_meta("dialogue_node_id", "")
	if cat == "jamal_shuttle" and GameState.jamal_decoy_revealed and GameState.current_system_id == 1:
		QuestManager.open_dialogue("hologram_trap_revealed")
		return
	if dlg != "":
		QuestManager.open_dialogue(dlg)
	else:
		GameState.add_log("SCAN", "✅ Spektral-Scan abgeschlossen: %s (+15 Bio, +10 Silizium)" % target.get("display_name"))
		GameState.bio_res += 15
		GameState.silicon_res += 10
		GameState.vitals_updated.emit()

func _handle_e_harvest() -> void:
	if QuestManager.is_dialogue_open:
		return
	var target := GameState.nearest_interactable
	if not target or not is_instance_valid(target):
		return
	var dist := player_ship.global_position.distance_to(target.global_position)
	if dist > 30.0:
		return
	if not target.get_meta("is_harvestable", false):
		GameState.add_log("NAV", "Dieses Objekt ist ein Schiff/Station. Drücke [F] zum Untersuchen!")
		return
	GameState.bio_res += 25
	GameState.silicon_res += 15
	GameState.vitals_updated.emit()
	GameState.add_log("ERNTE", "🌿 Bio-Siphon erfolgreich auf %s (+25 Bio, +15 Silizium)." % target.get("display_name"))

func _handle_x_bio_emp() -> void:
	var target := GameState.nearest_interactable
	if target and is_instance_valid(target):
		var dist := player_ship.global_position.distance_to(target.global_position)
		if dist <= 32.0 and target.get_meta("entity_category", "") == "jamal_shuttle":
			var sys := GameState.get_current_system()
			if sys.get("isInsanDepot", false) or String(sys.get("name", "")).contains("INSAN"):
				QuestManager.liberate_real_ship()
				return
	GameState.add_log("EMP", "⚡ Psionische Bio-EMP Schockwelle ausgelöst!")

func _parse_hex_color(hex_str: String, fallback: Color) -> Color:
	var clean := hex_str.replace("0x", "#")
	if Color.html_is_valid(clean):
		return Color.html(clean)
	return fallback
