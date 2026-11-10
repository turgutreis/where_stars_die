extends Node

## Central Game State & Universe Registry for Project Najmafar (Godot 4.6)
## Holds player stats, resources, crew, scan/depletion registries, active star system, and universe_data.json.

signal system_changed(system_id: int, system_data: Dictionary)
signal vitals_updated()
signal log_added(category: String, message: String)
signal target_locked_changed(target_node: Node3D)
signal scan_completed(target_node: Node3D)
signal channel_progress_updated(mode: String, progress: float, target_name: String)
signal dossier_updated(planet_key: String, dossier: Dictionary)
signal crew_updated()

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

# --- Core Loop Registries (Scan, Depletion & Dossiers) ---
var scanned_planets: Dictionary = {}   # planet_key -> bool
var depleted_planets: Dictionary = {}  # planet_key -> bool
var planet_dossiers: Dictionary = {}   # planet_key -> Dictionary
var active_dossier_key: String = ""

# --- Quantum Ising Chronicle ---
var galactic_cycle: int = 1
var galactic_year: float = 2242.0
var ising_dataset: Dictionary = {}

# --- Crew Roster ---
var max_crew_capacity: int = 4
var crew: Array[Dictionary] = [
	{
		"id": 101,
		"name": "Dr. Tariq Jamal",
		"species": "Mensch (Sol-Terraner)",
		"role": "Chef-Quantenphysiker & Co-Pilot",
		"buffDesc": "+25% Spektral-Scan & Quanten-Navigation",
		"station": "Traum-Kern",
		"stress": 15.0,
		"thought": "Die Vollbremsung an Sagittarius A* ist real. Wir müssen mein Forschungsschiff Ar-Riḥla finden!"
	}
]

const PROCEDURAL_FIRST_NAMES: Array[String] = [
	"Kaelen", "Lyra", "Vael", "Nyx", "Zoran", "Sora", "Tarek", "Aeliana", "Orin", "Sylph", "Dax", "Elara"
]
const PROCEDURAL_LAST_NAMES: Array[String] = [
	"Vex", "Solis", "Korr", "Maris", "Thane", "Zul", "Aethel", "Noor", "Vane", "Drak", "Seren", "Valen"
]
const PROCEDURAL_SPECIES: Array[String] = [
	"Olyndar-Psioniker", "Vega-Kybernetiker", "Lithoid-Kristallwesen", "Nautiloid-Tiefseewanderer", "Aethelgard-Archivar"
]
const PROCEDURAL_ROLES: Array[Dictionary] = [
	{"role": "navigator", "roleName": "🧭 Kosmischer Navigator", "buffDesc": "+15% Schub-Effizienz & Orbit-Stabilität"},
	{"role": "biologist", "roleName": "🧬 Xenobiologe", "buffDesc": "+25% Biomasse-Ertrag beim Bio-Siphon"},
	{"role": "psion", "roleName": "🔮 Psionischer Resonator", "buffDesc": "-20% Einsamkeit & +15% Mentalkraft-Fokus"},
	{"role": "engineer", "roleName": "⚙️ Chitin-Ingenieur", "buffDesc": "+20% Silizium-Synthese & Hüllen-Regeneration"}
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

func make_planet_key(body_name: String) -> String:
	return "%d_%s" % [current_system_id, body_name]

func is_planet_scanned(planet_key: String) -> bool:
	return bool(scanned_planets.get(planet_key, false))

func is_planet_depleted(planet_key: String) -> bool:
	return bool(depleted_planets.get(planet_key, false))

func mark_planet_scanned(planet_key: String, dossier: Dictionary) -> void:
	scanned_planets[planet_key] = true
	planet_dossiers[planet_key] = dossier
	active_dossier_key = planet_key
	dossier_updated.emit(planet_key, dossier)

func mark_planet_depleted(planet_key: String) -> void:
	depleted_planets[planet_key] = true
	if planet_dossiers.has(planet_key):
		var d: Dictionary = planet_dossiers[planet_key]
		d["depleted"] = true
		planet_dossiers[planet_key] = d
		if active_dossier_key == planet_key:
			dossier_updated.emit(planet_key, d)

func get_or_create_planet_dossier(planet_key: String, p_data: Dictionary, is_moon: bool = false) -> Dictionary:
	if planet_dossiers.has(planet_key):
		var existing: Dictionary = planet_dossiers[planet_key]
		existing["depleted"] = is_planet_depleted(planet_key)
		return existing

	var p_name: String = str(p_data.get("name", "Unbekannter Himmelskörper"))
	var p_type: String = str(p_data.get("type", "Kratermond" if is_moon else "Rocky"))
	var h: int = abs(planet_key.hash())

	var atmos: String = str(p_data.get("atmos", ""))
	var temp: String = str(p_data.get("temp", ""))
	var bio: String = str(p_data.get("bio", ""))
	var res: String = str(p_data.get("res", ""))

	if atmos == "":
		if p_type == "Habitable":
			atmos = "Stickstoff & Sauerstoff (Klasse M)" if (h % 2 == 0) else "Dichte Bio-Aerosole & Wasserdampf"
		elif p_type == "Gas Giant":
			atmos = "Superdichtes Wasserstoff- & Helium-band"
		elif p_type in ["Ice", "Eismond"]:
			atmos = "Dünner Kryo-Stickstoff & Methandunst"
		else:
			atmos = "Dünnes CO2-Vakuum" if (h % 2 == 0) else "Schwefeldioxid & Argon"

	if temp == "":
		if p_type == "Habitable":
			temp = "+%d°C (Gemäßigt)" % (14 + (h % 14))
		elif p_type == "Gas Giant":
			temp = "-%d°C" % (125 + (h % 50))
		elif p_type in ["Ice", "Eismond"]:
			temp = "-%d°C (Kryogen)" % (160 + (h % 60))
		else:
			temp = "%s%d°C" % [("+" if (h % 2 == 0) else "-"), 45 + (h % 180)]

	if bio == "":
		if p_type == "Habitable":
			bio = "Biolumineszierendes Xeno-Ökosystem & intelligente Signale"
		elif p_type == "Gas Giant":
			bio = "Schwebende Aero-Plankton-Kolonien" if (h % 3 == 0) else "Keine festen Bio-Signaturen"
		else:
			bio = "Extremophile Kristall-Flechten" if (h % 2 == 0) else "Steriles Mineralgestein"

	if res == "":
		if p_type == "Habitable":
			res = "Reich an Biomasse (+65 Bio, +20 Silizium)"
		elif p_type == "Gas Giant":
			res = "Deuterium & Aero-Biomasse (+35 Bio, +20 Silizium)"
		else:
			res = "Reine Silikat-Adern & Schwermetalle (+25 Bio, +50 Silizium)"

	var candidates: Array = []
	var raw_species = p_data.get("species", null)
	if typeof(raw_species) == TYPE_DICTIONARY and raw_species.has("candidates"):
		var raw_cands: Array = raw_species.get("candidates", [])
		for c in raw_cands:
			if typeof(c) == TYPE_DICTIONARY:
				candidates.append(c.duplicate())

	# Guarantee sentient candidates on Habitable worlds or selected outposts so abduction [R] is deeply playable!
	if candidates.is_empty() and (p_type == "Habitable" or (not is_moon and (h % 2 == 0))):
		var count: int = 2 if p_type == "Habitable" else 1
		for c_i in range(count):
			var ch: int = abs((h + c_i * 97) * 31)
			var f_name: String = PROCEDURAL_FIRST_NAMES[ch % PROCEDURAL_FIRST_NAMES.size()]
			var l_name: String = PROCEDURAL_LAST_NAMES[(ch / 7) % PROCEDURAL_LAST_NAMES.size()]
			var sp_name: String = PROCEDURAL_SPECIES[(ch / 13) % PROCEDURAL_SPECIES.size()]
			var role_dict: Dictionary = PROCEDURAL_ROLES[(ch / 19) % PROCEDURAL_ROLES.size()]
			candidates.append({
				"id": 200 + (ch % 8000),
				"name": "%s %s" % [f_name, l_name],
				"species": sp_name,
				"role": role_dict["roleName"],
				"roleKey": role_dict["role"],
				"buffDesc": role_dict["buffDesc"],
				"station": "Synapsen-Deck",
				"stress": 10.0
			})

	var dossier := {
		"key": planet_key,
		"name": p_name,
		"type": p_type,
		"isMoon": is_moon,
		"atmos": atmos,
		"temp": temp,
		"bio": bio,
		"res": res,
		"candidates": candidates,
		"depleted": is_planet_depleted(planet_key)
	}
	planet_dossiers[planet_key] = dossier
	return dossier

func get_bio_harvest_multiplier() -> float:
	var mult: float = 1.0
	for c in crew:
		if str(c.get("roleKey", "")) == "biologist":
			mult += 0.25
	return mult

func get_silicon_harvest_multiplier() -> float:
	var mult: float = 1.0
	for c in crew:
		if str(c.get("roleKey", "")) == "engineer":
			mult += 0.20
	return mult

func warp_to_system(target_id: int) -> void:
	current_system_id = target_id
	if not visited_system_ids.has(target_id):
		visited_system_ids.append(target_id)
	locked_target = null
	nearest_interactable = null
	active_dossier_key = ""
	var sys := get_current_system()
	add_log("NAV", "🌀 Quantenfeld gefaltet: Ankunft im System %s." % sys.get("name", "Unbekannt"))
	system_changed.emit(current_system_id, sys)

func reset_to_new_game() -> void:
	health = max_health
	bio_energy = max_bio_energy
	mental_energy = max_mental_energy
	current_system_id = 1
	visited_system_ids = [1]
	scanned_planets.clear()
	depleted_planets.clear()
	planet_dossiers.clear()
	active_dossier_key = ""
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
