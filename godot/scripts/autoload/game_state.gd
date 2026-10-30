extends Node

## Central Game State & Universe Registry for Project Najmafar (Godot 4.6)
## Holds player stats, resources, crew, active star system, and universe_data.json.

signal system_changed(system_id: int, system_data: Dictionary)
signal vitals_updated()
signal log_added(category: String, message: String)
signal target_locked_changed(target_node: Node3D)
signal scan_completed(target_node: Node3D)

# --- Player Vitals & Resources ---
var health: float = 100.0
var max_health: float = 100.0
var bio_energy: float = 100.0
var max_bio_energy: float = 100.0
var mental_energy: float = 100.0
var max_mental_energy: float = 100.0
var loneliness: float = 45.0

var bio_res: int = 0
var silicon_res: int = 0
var water_res: int = 25
var alloy_res: int = 10
var tech_res: int = 0
var food_res: int = 30
var melange_res: int = 0

# --- Flight & Modes ---
var flight_assist: bool = true
var telepathy_active: bool = false
var stealth_active: bool = false
var prologue_completed: bool = false
var prologue_active: bool = false

# --- Jamal & Quest Flags ---
var jamal_recruited: bool = true
var jamal_decoy_revealed: bool = false
var jamal_ship_liberated: bool = false
var voyager_scanned: bool = false
var voyager_liberated: bool = false
var ftue_step: int = 1

# --- Navigation & Universe ---
var universe_data: Dictionary = {}
var systems: Array = []
var current_system_id: int = 1 # Guaranteed start in Perseus-Rand (System 1)
var visited_system_ids: Array[int] = [1]
var locked_target: Node3D = null
var nearest_interactable: Node3D = null

# --- Quantum Ising Chronicle ---
var galactic_cycle: int = 1
var galactic_year: float = 2242.0
var ising_dataset: Dictionary = {}

# --- Crew Roster ---
var crew: Array[Dictionary] = [
	{
		"id": 101,
		"name": "Dr. Tariq Jamal",
		"species": "Mensch (Sol-Terraner)",
		"role": "Chef-Quantenphysiker & Co-Pilot",
		"station": "Traum-Kern",
		"stress": 15.0,
		"thought": "Die Vollbremsung an Sagittarius A* ist real. Wir müssen mein Forschungsschiff Ar-Riḥla finden!"
	}
]

func _ready() -> void:
	load_universe_data()
	load_ising_data()

func load_universe_data() -> void:
	var path := "res://data/universe_data.json"
	if not FileAccess.file_exists(path):
		push_warning("[GameState] universe_data.json not found at " + path)
		return
	var file := FileAccess.open(path, FileAccess.READ)
	if file:
		var parsed = JSON.parse_string(file.get_as_text())
		if typeof(parsed) == TYPE_DICTIONARY:
			universe_data = parsed
			systems = parsed.get("systems", [])
			ensure_lore_systems()
			print("[GameState] Loaded universe with %d star systems." % systems.size())

func load_ising_data() -> void:
	var path := "res://data/quantum_ising_cycles.json"
	if FileAccess.file_exists(path):
		var file := FileAccess.open(path, FileAccess.READ)
		if file:
			var parsed = JSON.parse_string(file.get_as_text())
			if typeof(parsed) == TYPE_DICTIONARY:
				ising_dataset = parsed

func ensure_lore_systems() -> void:
	# Ensure System 1 is Perseus-Rand and an INSAN Depot exists two jumps away
	var has_insan_depot := false
	for sys in systems:
		if sys.get("id", -1) == 1:
			sys["name"] = "Perseus-Rand"
			sys["sectorName"] = "Äußerer Spiralarm"
		if sys.get("isInsanDepot", false) or String(sys.get("name", "")).contains("INSAN"):
			has_insan_depot = true

	if not has_insan_depot and systems.size() > 3:
		var depot_sys: Dictionary = systems[min(3, systems.size() - 1)]
		depot_sys["name"] = "INSAN-Verwahrstelle Zeta-9"
		depot_sys["sectorName"] = "Bürokratischer Sperrsektor"
		depot_sys["isInsanDepot"] = true

func get_current_system() -> Dictionary:
	for sys in systems:
		if int(sys.get("id", -1)) == current_system_id:
			return sys
	if systems.size() > current_system_id and current_system_id >= 0:
		return systems[current_system_id]
	if systems.size() > 0:
		return systems[0]
	return {
		"id": 1,
		"name": "Perseus-Rand",
		"star": {"type": "Red Dwarf", "size": 10.0, "color": "0xff6b6b"},
		"planets": []
	}

func get_insan_depot_system() -> Dictionary:
	for sys in systems:
		if sys.get("isInsanDepot", false) or String(sys.get("name", "")).contains("INSAN"):
			return sys
	return {}

func warp_to_system(target_id: int) -> void:
	current_system_id = target_id
	if not visited_system_ids.has(target_id):
		visited_system_ids.append(target_id)
	locked_target = null
	nearest_interactable = null
	var sys := get_current_system()
	add_log("NAV", "🌀 Quantenfeld gefaltet: Ankunft im System %s." % sys.get("name", "Unbekannt"))
	system_changed.emit(current_system_id, sys)

func reset_to_new_game() -> void:
	health = max_health
	bio_energy = max_bio_energy
	mental_energy = max_mental_energy
	current_system_id = 1
	visited_system_ids = [1]
	jamal_decoy_revealed = false
	jamal_ship_liberated = false
	voyager_scanned = false
	voyager_liberated = false
	locked_target = null
	nearest_interactable = null
	vitals_updated.emit()
	system_changed.emit(current_system_id, get_current_system())

func add_log(category: String, message: String) -> void:
	print("[%s] %s" % [category, message])
	log_added.emit(category, message)

func set_locked_target(target: Node3D) -> void:
	locked_target = target
	if target:
		add_log("SENSOR", "🎯 Ziel erfasst: %s" % target.get_meta("display_name", target.name))
	target_locked_changed.emit(locked_target)
