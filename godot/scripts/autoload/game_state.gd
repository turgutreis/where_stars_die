extends Node

## Central Game State, Survival Metabolism & Universe Registry for Project Najmafar (Godot 4.6)
## Holds all 7 resources, player vitals, real-time life-support consumption, radiation, crew, and mutations.

signal system_changed(system_id: int, system_data: Dictionary)
signal vitals_updated()
signal log_added(category: String, message: String)
signal target_locked_changed(target_node: Node3D)
signal scan_completed(target_node: Node3D)
signal channel_progress_updated(mode: String, progress: float, target_name: String)
signal dossier_updated(planet_key: String, dossier: Dictionary)
signal crew_updated()
signal mutations_updated()
signal away_mission_updated(mission: Dictionary)
signal player_emergency_revived()

# --- Player Vitals & Environmental Survival ---
var health: float = 100.0
var max_health: float = 100.0
var bio_energy: float = 100.0
var max_bio_energy: float = 100.0
var mental_energy: float = 100.0
var max_mental_energy: float = 100.0
var loneliness: float = 45.0

var ambient_radiation: float = 0.0
var effective_radiation: float = 0.0
var radiation_resistance: float = 0.0
var radiation_source: String = ""

# --- All 7 Core Resources (matching Three.js prototype) ---
var bio_res: int = 0
var silicon_res: int = 0
var water_res: int = 35
var food_res: int = 40
var alloy_res: int = 10
var tech_res: int = 0
var melange_res: int = 0

# --- Bio-Shuttle & Away Missions (Unlocked by liberating Dr. Tariq Jamal's Ar-Riḥla!) ---
var shuttle_unlocked: bool = false
var shuttle_ready: bool = true
var shuttle_hull: float = 100.0
var shuttle_max_hull: float = 100.0
var shuttle_name: String = "Forschungsschiff 'Ar-Riḥla'"
var active_away_mission: Dictionary = {}

# Internal fractional accumulators for smooth per-second life support drain
var _water_accum: float = 35.0
var _food_accum: float = 40.0
var _hud_tick_timer: float = 0.0
var _warn_cooldown_water: float = 0.0
var _warn_cooldown_food: float = 0.0
var _warn_cooldown_rad: float = 0.0
var _warn_cooldown_energy: float = 0.0

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
var combat_kills: int = 0

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

# --- Mutations & Evolution Tree ---
var mutations: Dictionary = {
	"organic_siphon": {
		"purchased": false,
		"bioCost": 120,
		"siliconCost": 60,
		"techCost": 0,
		"name": "Organischer Siphon",
		"desc": "+35% Ernte-Ertrag & +25% Strahlungsschutz"
	},
	"chitin_armor": {
		"purchased": false,
		"bioCost": 220,
		"siliconCost": 130,
		"techCost": 0,
		"name": "Chitin-Panzer",
		"desc": "+40 Max-Hülle & +35% Strahlungs-Zellschutz"
	},
	"telepathic_focus": {
		"purchased": false,
		"bioCost": 140,
		"siliconCost": 80,
		"techCost": 0,
		"name": "Telepathischer Fokus",
		"desc": "-35% Mental-Drain & +30 Max-Mentalkraft"
	},
	"vector_tentacles": {
		"purchased": false,
		"bioCost": 360,
		"siliconCost": 240,
		"techCost": 10,
		"name": "Vektor-Tentakel",
		"desc": "+25% Schwimm-Schub & -30% Bio-Energieverbrauch"
	},
	"hivemind": {
		"purchased": false,
		"bioCost": 500,
		"siliconCost": 320,
		"techCost": 15,
		"name": "Schwarm-Synapse (6 Kokons)",
		"desc": "Erweitert Crew-Kapazität auf 6 & verstärkt Crew-Synergien"
	}
}

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
		"roleKey": "scientist",
		"is_abducted": false,
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
	{"role": "navigator", "roleName": "🧭 Kosmischer Navigator", "buffDesc": "-20% Schub-Energieverbrauch & stabile Orbits"},
	{"role": "biologist", "roleName": "🧬 Xenobiologe", "buffDesc": "+25% Biomasse-, Wasser- & Nahrungs-Ertrag"},
	{"role": "psion", "roleName": "🔮 Psionischer Resonator", "buffDesc": "-25% Einsamkeit & +0.6/s Mentalkraft-Fokus"},
	{"role": "engineer", "roleName": "⚙️ Chitin-Ingenieur", "buffDesc": "+25% Silizium/Legierungen & langsame Hüllen-Selbstheilung"}
]

func _ready() -> void:
	_water_accum = float(water_res)
	_food_accum = float(food_res)
	load_universe_data()
	load_ising_data()

func _process(delta: float) -> void:
	if Engine.is_editor_hint():
		return
	if QuestManager.is_dialogue_open:
		return
	_process_survival_metabolism(delta)
	_process_away_mission(delta)

func _process_survival_metabolism(delta: float) -> void:
	var crew_count: int = crew.size()

	# 1. Gentle early-game Water & Food Life-Support Consumption so player can survive on Biomass/Asteroids while liberating Ar-Riḥla
	var water_drain_per_sec: float = 0.025 + float(crew_count) * 0.022
	var food_drain_per_sec: float = 0.028 + float(crew_count) * 0.025

	_water_accum = max(0.0, _water_accum - water_drain_per_sec * delta)
	_food_accum = max(0.0, _food_accum - food_drain_per_sec * delta)
	water_res = int(ceil(_water_accum))
	food_res = int(ceil(_food_accum))

	var is_dehydrated: bool = (water_res <= 0)
	var is_starving: bool = (food_res <= 0)

	if is_dehydrated:
		_warn_cooldown_water -= delta
		if _warn_cooldown_water <= 0.0:
			_warn_cooldown_water = 14.0
			add_log("ÜBERLEBEN", "⚠️ DEHYDRIERUNG: Wasservorräte (💧 0) erschöpft! Ernte Eis-/Habitable Welten oder Monde!")
	else:
		_warn_cooldown_water = max(0.0, _warn_cooldown_water - delta)

	if is_starving:
		_warn_cooldown_food -= delta
		if _warn_cooldown_food <= 0.0:
			_warn_cooldown_food = 14.0
			add_log("ÜBERLEBEN", "⚠️ HUNGER-KRISE: Nährstoff-Gel (🍖 0) aufgebraucht! Bio-Energie regeneriert nicht mehr!")
	else:
		_warn_cooldown_food = max(0.0, _warn_cooldown_food - delta)

	# 2. Loneliness & Mental Energy Drain (Dream Matrix Maintenance)
	var target_loneliness: float = 65.0
	if crew_count == 1:
		target_loneliness = 45.0
	elif crew_count == 2:
		target_loneliness = 25.0
	elif crew_count >= 3:
		target_loneliness = 8.0

	for c in crew:
		if str(c.get("roleKey", "")) == "psion":
			target_loneliness = max(0.0, target_loneliness - 15.0)

	if is_dehydrated or is_starving:
		target_loneliness = min(100.0, target_loneliness + 25.0)

	loneliness = move_toward(loneliness, target_loneliness, delta * 2.5)

	var focus_mult: float = 0.65 if is_mutation_purchased("telepathic_focus") else 1.0
	var mental_drain: float = (0.18 + (loneliness / 100.0) * 0.32) * focus_mult
	if is_dehydrated:
		mental_drain += 0.45

	var mental_regen: float = 0.0
	for c in crew:
		if str(c.get("roleKey", "")) == "psion":
			mental_regen += 0.45
	if crew_count >= 3 and not is_dehydrated and not is_starving:
		mental_regen += 0.25

	mental_energy = clamp(mental_energy + (mental_regen - mental_drain) * delta, 0.0, max_mental_energy)

	# 3. Engineer Chitin Auto-Repair & Starvation/Dehydration Hull Decay
	var eng_count: int = 0
	for c in crew:
		if str(c.get("roleKey", "")) == "engineer":
			eng_count += 1
	if eng_count > 0 and health < max_health and silicon_res > 0 and not is_starving:
		health = min(max_health, health + float(eng_count) * 0.35 * delta)

	if is_dehydrated and is_starving:
		health = max(1.0, health - 0.85 * delta)

	# 4. Cosmic & Solar Radiation Hull Erosion
	var rad_res: float = 0.0
	if is_mutation_purchased("organic_siphon"):
		rad_res += 0.25
	if is_mutation_purchased("chitin_armor"):
		rad_res += 0.35
	radiation_resistance = min(0.85, rad_res)
	effective_radiation = max(0.0, ambient_radiation * (1.0 - radiation_resistance))

	if effective_radiation > 0.15:
		var rad_dmg: float = (effective_radiation - 0.15) * 3.2 * delta
		health = max(1.0, health - rad_dmg)
		_warn_cooldown_rad -= delta
		if _warn_cooldown_rad <= 0.0:
			_warn_cooldown_rad = 10.0
			add_log("STRAHLUNG", "☢️ STRAHLUNGS-EROSION (%s): Hülle nimmt Schaden (%.0f%% Belastung)! Halte Abstand oder mutiere Chitin-Panzer [U]!" % [
				radiation_source,
				effective_radiation * 100.0
			])
	else:
		_warn_cooldown_rad = max(0.0, _warn_cooldown_rad - delta)

	# 5. Periodic HUD refresh (every 0.25s) so resource/vital counters stay live
	_hud_tick_timer += delta
	if _hud_tick_timer >= 0.25:
		_hud_tick_timer = 0.0
		vitals_updated.emit()

func add_water(amount: int) -> void:
	_water_accum = min(999.0, _water_accum + float(amount))
	water_res = int(ceil(_water_accum))

func add_food(amount: int) -> void:
	_food_accum = min(999.0, _food_accum + float(amount))
	food_res = int(ceil(_food_accum))

func consume_water(amount: int) -> bool:
	if water_res < amount:
		return false
	_water_accum = max(0.0, _water_accum - float(amount))
	water_res = int(ceil(_water_accum))
	return true

func consume_food(amount: int) -> bool:
	if food_res < amount:
		return false
	_food_accum = max(0.0, _food_accum - float(amount))
	food_res = int(ceil(_food_accum))
	return true

func is_mutation_purchased(mut_id: String) -> bool:
	if mutations.has(mut_id):
		var m: Dictionary = mutations[mut_id]
		return bool(m.get("purchased", false))
	return false

func buy_mutation(mut_id: String) -> bool:
	if not mutations.has(mut_id):
		return false
	var m: Dictionary = mutations[mut_id]
	if bool(m.get("purchased", false)):
		return false

	var b_cost: int = int(m.get("bioCost", 0))
	var s_cost: int = int(m.get("siliconCost", 0))
	var t_cost: int = int(m.get("techCost", 0))

	if bio_res < b_cost or silicon_res < s_cost or tech_res < t_cost:
		add_log("EVOLUTION", "⚠️ Nicht genug Ressourcen für %s (Benötigt: %d Bio, %d Sil%s)!" % [
			str(m.get("name", mut_id)),
			b_cost,
			s_cost,
			(", %d Tech" % t_cost) if t_cost > 0 else ""
		])
		return false

	bio_res -= b_cost
	silicon_res -= s_cost
	tech_res -= t_cost
	m["purchased"] = true
	mutations[mut_id] = m

	if mut_id == "chitin_armor":
		max_health = 140.0
		health = min(max_health, health + 40.0)
	elif mut_id == "telepathic_focus":
		max_mental_energy = 130.0
		mental_energy = min(max_mental_energy, mental_energy + 30.0)
	elif mut_id == "hivemind":
		max_crew_capacity = 6

	add_log("EVOLUTION", "🧬 MUTATION AKTIVIERT: [%s] — %s!" % [str(m.get("name", mut_id)), str(m.get("desc", ""))])
	vitals_updated.emit()
	mutations_updated.emit()
	return true

func repair_hull_with_alloys() -> bool:
	if health >= max_health:
		add_log("HÜLLE", "Biologische Hülle ist bereits vollständig intakt (%.0f%%)." % health)
		return false
	if alloy_res < 5:
		add_log("WARNUNG", "⚠️ 5 🛡️ Legierungen benötigt für Chitin-Hüllenreparatur (Aktuell: %d)!" % alloy_res)
		return false
	alloy_res -= 5
	health = min(max_health, health + 30.0)
	vitals_updated.emit()
	add_log("HÜLLE", "🛡️ Chitin-Legierungs-Matrix appliziert: +30% Hülle regeneriert (-5 Legierungen)!")
	return true

func synthesize_bio_energy_from_food() -> bool:
	if bio_energy >= max_bio_energy:
		add_log("METABOLISMUS", "⚡ Bio-Energie ist bereits auf Maximum (%.0f%%)." % bio_energy)
		return false
	if food_res < 8:
		add_log("WARNUNG", "⚠️ 8 🍖 Nahrung benötigt für schnelle Bio-Verdauung (Aktuell: %d)!" % food_res)
		return false
	consume_food(8)
	bio_energy = min(max_bio_energy, bio_energy + 40.0)
	vitals_updated.emit()
	add_log("METABOLISMUS", "⚡ Nährstoff-Gel verstoffwechselt: +40% Bio-Energie wiederhergestellt (-8 Nahrung)!")
	return true

func perform_psionic_catharsis() -> bool:
	if mental_energy >= max_mental_energy and loneliness <= 15.0:
		add_log("PSIONIK", "🧠 Geisteszustand ist bereits harmonisiert (Koffeinspiegel stabil).")
		return false
	if melange_res >= 5:
		melange_res -= 5
		mental_energy = max_mental_energy
		bio_energy = min(max_bio_energy, bio_energy + 20.0)
		loneliness = max(0.0, loneliness - 35.0)
		vitals_updated.emit()
		add_log("QAHWUN", "☕ Qahwun-Röstung aufgebrüht: Kosmisches Qahwa-Bunn-Elixier durchströmt Najmafars Synapsen! (100% 🧠 Mental, +20% ⚡ Bio, -35% Einsamkeit)!")
		return true
	if water_res < 6 or bio_res < 10:
		add_log("WARNUNG", "⚠️ Für Psionische Katharsis werden 5 ☕ Qahwun (oder 6 💧 Wasser & 10 🌿 Biomasse) benötigt!")
		return false
	consume_water(6)
	bio_res -= 10
	mental_energy = min(max_mental_energy, mental_energy + 38.0)
	loneliness = max(5.0, loneliness - 20.0)
	vitals_updated.emit()
	add_log("PSIONIK", "🧠 Psionische Katharsis: +38% Mentalkraft & Einsamkeit gesenkt (-6 Wasser, -10 Biomasse)!")
	return true

func repair_shuttle_with_alloys() -> bool:
	if not shuttle_unlocked:
		add_log("WARNUNG", "🔒 Noch kein Shuttle an Bord! Befreie zuerst Dr. Tariq Jamals 'Ar-Riḥla' im INSAN-Depot Zeta-9.")
		return false
	if shuttle_hull >= shuttle_max_hull:
		add_log("SHUTTLE", "🚀 %s ist bereits makellos (100%% Hülle)." % shuttle_name)
		return false
	if alloy_res < 8:
		add_log("WARNUNG", "⚠️ 8 🛡️ Legierungen benötigt für Shuttle-Überholung (Aktuell: %d)!" % alloy_res)
		return false
	alloy_res -= 8
	shuttle_hull = shuttle_max_hull
	vitals_updated.emit()
	add_log("SHUTTLE", "🚀 %s generalüberholt: Hülle auf 100%% wiederhergestellt (-8 🛡️ Legierungen)!" % shuttle_name)
	return true

func get_abducted_crew_count() -> int:
	var count: int = 0
	for c in crew:
		if bool(c.get("is_abducted", false)):
			count += 1
	return count

func unlock_jamal_shuttle() -> void:
	shuttle_unlocked = true
	shuttle_ready = true
	shuttle_hull = shuttle_max_hull
	vitals_updated.emit()
	add_log("SHUTTLE", "🚀 AUSSENMISSIONEN FREIGESCHALTET: Die 'Ar-Riḥla' dient jetzt als Najmafars Lande-Shuttle! Entführte Crew [R] kann auf geeigneten Planeten nach 💧 Wasser, 🍖 Nahrung, 🛡️ Legierungen & ⚙️ Tech suchen!")

func start_away_mission(planet_key: String, deposit_id: String, selected_crew_ids: Array[int]) -> bool:
	if not shuttle_unlocked:
		add_log("WARNUNG", "🔒 Außenmission blockiert: Du hast noch kein Shuttle! Befreie zuerst Jamals 'Ar-Riḥla' in der INSAN-Verwahrstelle Zeta-9!")
		return false
	if not shuttle_ready or not active_away_mission.is_empty():
		add_log("WARNUNG", "🚀 Die 'Ar-Riḥla' befindet sich bereits auf einer Außenmission!")
		return false
	if get_abducted_crew_count() <= 0:
		add_log("WARNUNG", "⚠️ Außenteam benötigt: Entführe zuerst mindestens 1 Lebensform auf einem bewohnbaren Planeten [R], damit du sie steuern und auf Mission schicken kannst!")
		return false
	if not planet_dossiers.has(planet_key):
		return false

	var dossier: Dictionary = planet_dossiers[planet_key]
	var deposits: Array = dossier.get("deposits", [])
	var target_dep: Dictionary = {}
	for d in deposits:
		if typeof(d) == TYPE_DICTIONARY and str(d.get("id", "")) == deposit_id:
			target_dep = d
			break
	if target_dep.is_empty():
		add_log("WARNUNG", "Vorkommen nicht gefunden.")
		return false
	if bool(target_dep.get("depleted", false)):
		add_log("WARNUNG", "🔴 Vorkommen '%s' ist bereits vollständig abgebaut!" % str(target_dep.get("name", "Lagerstätte")))
		return false

	var team: Array[Dictionary] = []
	var has_abducted_in_team: bool = false
	for cid in selected_crew_ids:
		for c in crew:
			if int(c.get("id", -1)) == cid:
				team.append(c)
				if bool(c.get("is_abducted", false)):
					has_abducted_in_team = true
				break
		if team.size() >= 3:
			break

	if team.is_empty():
		add_log("WARNUNG", "⚠️ Wähle mindestens 1 Crew-Mitglied für das Außenteam aus!")
		return false
	if not has_abducted_in_team:
		add_log("WARNUNG", "⚠️ Mindestens 1 entführter Symbiont muss am Außeneinsatz teilnehmen!")
		return false

	shuttle_ready = false
	active_away_mission = {
		"planetKey": planet_key,
		"planetName": str(dossier.get("name", "Planet")),
		"depositId": deposit_id,
		"depositName": str(target_dep.get("name", "Oberflächen-Vorkommen")),
		"depositType": str(target_dep.get("type", "")),
		"yieldResource": str(target_dep.get("yieldResource", "alloys")),
		"yieldAmount": int(target_dep.get("yieldAmount", 25)),
		"hazardType": str(target_dep.get("hazardType", "none")),
		"hazardSeverity": str(target_dep.get("hazardSeverity", "none")),
		"team": team,
		"progress": 0.0,
		"duration": 14.0,
		"timer": 14.0,
		"stage": 0
	}

	var t_names: Array[String] = []
	for m in team:
		t_names.append(str(m.get("name", "Crew")))
	add_log("EXPEDITION", "🚀 AUSSENMISSION GESTARTET: 'Ar-Riḥla' dockt mit [%s] ab — Ziel: %s (%s)!" % [
		", ".join(t_names),
		active_away_mission["depositName"],
		active_away_mission["planetName"]
	])
	away_mission_updated.emit(active_away_mission)
	return true

func _process_away_mission(delta: float) -> void:
	if active_away_mission.is_empty():
		return

	var dur: float = max(1.0, float(active_away_mission.get("duration", 14.0)))
	var timer: float = float(active_away_mission.get("timer", dur)) - delta
	active_away_mission["timer"] = timer
	var prog: float = clamp(1.0 - (timer / dur), 0.0, 1.0)
	active_away_mission["progress"] = prog

	var stage: int = int(active_away_mission.get("stage", 0))
	var team: Array = active_away_mission.get("team", [])
	var has_eng: bool = false
	var has_sci: bool = false
	var has_bio: bool = false
	for m in team:
		var rk: String = str(m.get("roleKey", ""))
		if rk == "engineer": has_eng = true
		elif rk == "scientist": has_sci = true
		elif rk == "biologist": has_bio = true

	if prog >= 0.25 and stage == 0:
		active_away_mission["stage"] = 1
		var h_type: String = str(active_away_mission.get("hazardType", "none"))
		var h_sev: String = str(active_away_mission.get("hazardSeverity", "none"))
		if h_type == "thermal" and h_sev != "none":
			if has_eng:
				add_log("EXPEDITION", "🔧 Ingenieur im Außenteam kalibriert Thermal-Schilde — kein Hitzeschaden an Ar-Riḥla!")
			else:
				shuttle_hull = max(15.0, shuttle_hull - 7.0)
				add_log("WARNUNG", "⚠️ Extreme Hitze/Kälte auf %s! Ar-Riḥla Shuttle-Hülle leicht beschädigt (%.0f%%)." % [str(active_away_mission["planetName"]), shuttle_hull])
		elif h_type == "atmosphere" and h_sev != "none":
			if has_bio:
				add_log("EXPEDITION", "🧬 Xenobiologe filtert toxische Sporen — Außenteam sicher!")
			else:
				shuttle_hull = max(15.0, shuttle_hull - 6.0)
				add_log("WARNUNG", "⚠️ Korrosive Atmosphäre greift Landungsstützen an (%.0f%% Shuttle-Hülle)." % shuttle_hull)
		elif h_type == "radiation" and has_sci:
			add_log("EXPEDITION", "🔬 Wissenschaftler dekodiert Quanten-Strahlungsmuster (+50% Tech-Ausbeute)!")
	elif prog >= 0.65 and stage == 1:
		active_away_mission["stage"] = 2
		add_log("EXPEDITION", "⛏️ Außenteam baut '%s' ab und belädt Frachtraum der Ar-Riḥla..." % str(active_away_mission["depositName"]))
	elif prog >= 0.90 and stage == 2:
		active_away_mission["stage"] = 3
		add_log("EXPEDITION", "🚀 Bergung abgeschlossen — Ar-Riḥla zündet Rückkehrtriebwerke zur Najmafar!")

	away_mission_updated.emit(active_away_mission)

	if prog >= 1.0:
		_complete_away_mission()

func _complete_away_mission() -> void:
	var mission: Dictionary = active_away_mission.duplicate(true)
	active_away_mission.clear()
	shuttle_ready = true

	var p_key: String = str(mission.get("planetKey", ""))
	var dep_id: String = str(mission.get("depositId", ""))
	if planet_dossiers.has(p_key):
		var d_dict: Dictionary = planet_dossiers[p_key]
		var deps: Array = d_dict.get("deposits", [])
		for i in range(deps.size()):
			if typeof(deps[i]) == TYPE_DICTIONARY and str(deps[i].get("id", "")) == dep_id:
				deps[i]["depleted"] = true
				break
		d_dict["deposits"] = deps
		planet_dossiers[p_key] = d_dict
		if active_dossier_key == p_key:
			dossier_updated.emit(p_key, d_dict)

	var team: Array = mission.get("team", [])
	var y_res: String = str(mission.get("yieldResource", "alloys"))
	var base_amt: float = float(mission.get("yieldAmount", 25))
	var mult: float = 1.0
	for m in team:
		var rk: String = str(m.get("roleKey", ""))
		if rk == "engineer": mult += 0.35
		elif rk == "biologist" and y_res in ["food", "water"]: mult += 0.35
		elif rk == "scientist" and y_res == "tech": mult += 0.50

	var final_amt: int = int(round(base_amt * mult))
	var p_name: String = str(mission.get("planetName", "Planet"))

	match y_res:
		"water":
			add_water(final_amt)
			add_log("EXPEDITION", "💧 AUSSENMISSION ERFOLGREICH: +%d 💧 Frischwasser von %s durch Ar-Riḥla geborgen!" % [final_amt, p_name])
		"food":
			add_food(final_amt)
			add_log("EXPEDITION", "🍖 AUSSENMISSION ERFOLGREICH: +%d 🍖 Nahrung & Biomaterie von %s eingelagert!" % [final_amt, p_name])
		"alloys":
			alloy_res += final_amt
			add_log("EXPEDITION", "🛡️ AUSSENMISSION ERFOLGREICH: +%d 🛡️ Titan-Legierungen von %s geborgen!" % [final_amt, p_name])
		"tech":
			tech_res += final_amt
			add_log("EXPEDITION", "⚙️ AUSSENMISSION ERFOLGREICH: +%d ⚙️ Hoch-Technologie & Datenkerne von %s geborgen!" % [final_amt, p_name])
		_:
			bio_res += final_amt
			add_log("EXPEDITION", "🌿 AUSSENMISSION ERFOLGREICH: +%d 🌿 Biomasse geborgen!" % final_amt)

	loneliness = max(0.0, loneliness - 8.0)
	vitals_updated.emit()
	away_mission_updated.emit({})

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
	for i in range(systems.size()):
		var sys: Dictionary = systems[i]
		var sid: int = int(sys.get("id", -1))
		if sid == 1:
			sys["name"] = "Perseus-Rand"
			sys["sectorName"] = "Äußerer Spiralarm"
		elif sid == 77:
			sys["name"] = "INSAN-Verwahrstelle Zeta-9"
			sys["sectorName"] = "INSAN-Pfand- & Schrottwerft"
			sys["isInsanDepot"] = true
			var pls: Array = sys.get("planets", [])
			if pls.is_empty():
				pls.append({
					"name": "Schrott-Gürtel Alpha-9",
					"type": "Rocky",
					"size": 3.4,
					"distance": 24.0,
					"color": "0x64748b",
					"temp": "+14°C (Abgeschirmte Schrottwerft)",
					"atmos": "Industrielle Werksluft & Subraum-Störfelder",
					"bio": "Keine (Autonome INSAN-Werft)",
					"species": {"hasSentient": false, "techLevel": "Spacefaring", "name": "INSAN-Bürokratie"}
				})
				sys["planets"] = pls
			has_insan_depot = true
		if sys.get("isInsanDepot", false) or String(sys.get("name", "")).contains("INSAN"):
			has_insan_depot = true

	if not has_insan_depot and systems.size() > 6:
		var depot_sys: Dictionary = systems[min(6, systems.size() - 1)]
		depot_sys["name"] = "INSAN-Verwahrstelle Zeta-9"
		depot_sys["sectorName"] = "INSAN-Pfand- & Schrottwerft"
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

func _extract_temp_celsius(temp_str: String) -> float:
	var regex := RegEx.new()
	regex.compile("([+-]?\\d+)")
	var m: RegExMatch = regex.search(temp_str)
	if m:
		return float(m.get_string(1))
	return 20.0

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
			atmos = "Superdichtes Wasserstoff- & Helium-Band"
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
			if h % 4 == 0:
				temp = "%s%d°C (Tolerierbar mit Schutzanzug)" % [("+" if (h % 2 == 0) else "-"), 18 + (h % 28)]
			else:
				temp = "%s%d°C (Extrem)" % [("+" if (h % 2 == 0) else "-"), 110 + (h % 380)]

	var temp_c: float = _extract_temp_celsius(temp)
	var is_extreme_temp: bool = (temp_c > 58.0 or temp_c < -75.0) and p_type != "Vorläufer-Konstrukt"
	var can_support_outpost: bool = (not is_moon) and (p_type in ["Rocky", "Desert"]) and (not is_extreme_temp) and (h % 4 == 0)

	if bio == "":
		if p_type == "Habitable":
			bio = "Biolumineszierendes Xeno-Ökosystem & intelligente Signale"
		elif can_support_outpost:
			bio = "Abgeschirmte Oberflächen-Forschungsstation (Kuppelsiedlung)"
		elif p_type == "Gas Giant":
			bio = "Schwebende Aero-Plankton-Kolonien" if (h % 3 == 0) else "Keine festen Bio-Signaturen"
		else:
			bio = "Extremophile Kristall-Flechten" if (h % 2 == 0) else "Steriles Mineralgestein"

	var tech_level: String = ""
	var raw_sp = p_data.get("species", null)
	if typeof(raw_sp) == TYPE_DICTIONARY:
		tech_level = str(raw_sp.get("techLevel", ""))

	# Strict orbital Bio-Siphon [E] preview (NEVER grants Food/Water/Tech/Alloys from orbit!)
	if p_type == "Habitable":
		res = "Orbital-Siphon [E]: 🌿 Biomasse & 💎 Silizium  •  Oberfläche (Shuttle): 🍖 Nahrung, 💧 Wasser" + (", ⚙️ Tech" if tech_level in ["Industrial", "Spacefaring", "Hyper-Advanced", "Automated Bureaucracy"] else "")
	elif p_type in ["Ice", "Eismond"]:
		res = "Orbital-Siphon [E]: 💎 Silizium & 🌿 Biomasse  •  Oberfläche (Shuttle): 💧 Eiskern-Wasser"
	elif p_type == "Gas Giant":
		res = "Orbital-Siphon [E]: 🌿 Aero-Plankton (Biomasse)  •  ⚠️ Keine Landezone für Nahrung/Tech/Legierungen"
	elif p_type == "Desert":
		res = "Orbital-Siphon [E]: 💎 Silizium & ☕ Qahwun-Bohnen  •  Oberfläche (Shuttle): 🛡️ Legierungen"
	elif p_type == "Vorläufer-Konstrukt" or p_type == "custom":
		res = "Orbital-Siphon [E]: 💎 Silizium  •  Oberfläche (Shuttle): ⚙️ Tech & 🛡️ Legierungen"
	else:
		res = "Orbital-Siphon [E]: 💎 Silizium & 🌿 Biomasse  •  Oberfläche (Shuttle): 🛡️ Titan-Legierungen"

	var candidates: Array = []
	var is_habitable_or_construct: bool = (p_type == "Habitable" or p_type == "Vorläufer-Konstrukt")

	if is_habitable_or_construct or can_support_outpost:
		if typeof(raw_sp) == TYPE_DICTIONARY and raw_sp.has("candidates"):
			var raw_cands: Array = raw_sp.get("candidates", [])
			for c in raw_cands:
				if typeof(c) == TYPE_DICTIONARY:
					candidates.append(c.duplicate())
					candidates[candidates.size() - 1]["is_abducted"] = true

		if candidates.is_empty():
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
					"is_abducted": true,
					"buffDesc": role_dict["buffDesc"],
					"station": "Synapsen-Deck",
					"stress": 10.0
				})
		if can_support_outpost and not bio.contains("Forschungsstation") and not bio.contains("Kuppel") and not bio.contains("Siedlung"):
			bio = "%s (Abgeschirmte Forschungs-Kuppel aktiv)" % bio
	else:
		candidates.clear()

	# Build Planet-Specific Surface Deposits (ONLY obtainable via Shuttle + Crew Away Missions!)
	var deposits: Array = []
	if p_type == "Gas Giant" or p_type == "Gefangener Stern" or p_type == "Plasma-Wirbel":
		# Strictly NO food, NO tech, NO alloys, NO solid surface landings on Gas Giants!
		deposits.clear()
	elif p_type == "Habitable":
		deposits.append({
			"id": "dep_%d_food" % h,
			"name": "Biolumineszenter Xeno-Hain",
			"type": "xeno_grove",
			"desc": "Dichte organische Früchte & nährstoffreiche Flora.",
			"yieldResource": "food",
			"yieldAmount": 48 + (h % 22),
			"hazardType": "atmosphere",
			"hazardSeverity": "low",
			"depleted": false
		})
		deposits.append({
			"id": "dep_%d_water" % h,
			"name": "Tiefes Grundwasser-Reservoir",
			"type": "subsurface_water",
			"desc": "Kristallklare Süßwasser-Kavernen unter der Oberfläche.",
			"yieldResource": "water",
			"yieldAmount": 52 + (h % 26),
			"hazardType": "none",
			"hazardSeverity": "none",
			"depleted": false
		})
		if tech_level in ["Industrial", "Spacefaring", "Hyper-Advanced", "Automated Bureaucracy"] or candidates.size() > 0:
			deposits.append({
				"id": "dep_%d_tech" % h,
				"name": "Hoch-Technologie Forschungsanlage / Raumhafen",
				"type": "ruins",
				"desc": "Hochentwickelte Quanten-Schaltkreise & isolierte Datenkerne.",
				"yieldResource": "tech",
				"yieldAmount": 22 + (h % 14),
				"hazardType": "radiation",
				"hazardSeverity": "moderate",
				"depleted": false
			})
	elif p_type in ["Ice", "Eismond"]:
		deposits.append({
			"id": "dep_%d_ice" % h,
			"name": "Subglazialer Eiskern-Ozean",
			"type": "subsurface_water",
			"desc": "Reines gefrorenes Trinkwasser tief unter der Eiskruste.",
			"yieldResource": "water",
			"yieldAmount": 55 + (h % 30),
			"hazardType": "thermal",
			"hazardSeverity": "moderate",
			"depleted": false
		})
	elif p_type == "Vorläufer-Konstrukt" or p_type == "custom":
		deposits.append({
			"id": "dep_%d_tech" % h,
			"name": "Antiker Datenkern / Frachtsektion",
			"type": "derelict_cache",
			"desc": "Intakte Hyper-Technologie & Quantenprozessoren.",
			"yieldResource": "tech",
			"yieldAmount": 26 + (h % 14),
			"hazardType": "radiation",
			"hazardSeverity": "moderate",
			"depleted": false
		})
		deposits.append({
			"id": "dep_%d_alloy" % h,
			"name": "Verstärkte Struktur-Platten",
			"type": "geothermal_vent",
			"desc": "Bergungsfähige Titan-Chitin-Legierungen.",
			"yieldResource": "alloys",
			"yieldAmount": 22 + (h % 12),
			"hazardType": "thermal",
			"hazardSeverity": "low",
			"depleted": false
		})
	else:
		# Rocky, Desert, Vulkanmond, Kratermond -> Alloys (and Tech ONLY if technologically advanced/outpost!)
		deposits.append({
			"id": "dep_%d_alloy" % h,
			"name": "Geothermisches Titan- & Erzfeld" if temp_c > 80.0 else "Schwere Titan-Erzader",
			"type": "geothermal_vent",
			"desc": "Hochfeste Metall-Legierungen für Hülle & Shuttle-Panzerung.",
			"yieldResource": "alloys",
			"yieldAmount": 24 + (h % 18),
			"hazardType": "thermal" if (temp_c > 80.0 or temp_c < -80.0) else "none",
			"hazardSeverity": "moderate" if (temp_c > 80.0 or temp_c < -80.0) else "none",
			"depleted": false
		})
		if can_support_outpost or tech_level in ["Industrial", "Spacefaring", "Hyper-Advanced", "Automated Bureaucracy"]:
			deposits.append({
				"id": "dep_%d_tech" % h,
				"name": "Abgeschirmtes Orbital-/Kuppel-Datenzentrum",
				"type": "ruins",
				"desc": "Fortschrittliche Elektronik & Archivkerne der Stations-Betreiber.",
				"yieldResource": "tech",
				"yieldAmount": 18 + (h % 12),
				"hazardType": "radiation",
				"hazardSeverity": "low",
				"depleted": false
			})

	var dossier := {
		"key": planet_key,
		"name": p_name,
		"type": p_type,
		"isMoon": is_moon,
		"atmos": atmos,
		"temp": temp,
		"tempC": temp_c,
		"bio": bio,
		"res": res,
		"techLevel": tech_level,
		"candidates": candidates,
		"deposits": deposits,
		"depleted": is_planet_depleted(planet_key)
	}
	planet_dossiers[planet_key] = dossier
	return dossier

func get_bio_harvest_multiplier() -> float:
	var mult: float = 1.35 if is_mutation_purchased("organic_siphon") else 1.0
	for c in crew:
		if str(c.get("roleKey", "")) == "biologist":
			mult += 0.25
	return mult

func get_silicon_harvest_multiplier() -> float:
	var mult: float = 1.35 if is_mutation_purchased("organic_siphon") else 1.0
	for c in crew:
		if str(c.get("roleKey", "")) == "engineer":
			mult += 0.25
	return mult

func get_thrust_energy_multiplier() -> float:
	var mult: float = 0.7 if is_mutation_purchased("vector_tentacles") else 1.0
	for c in crew:
		if str(c.get("roleKey", "")) == "navigator":
			mult *= 0.8
	return mult

func get_psi_damage_multiplier() -> float:
	var mult: float = 1.0
	if is_mutation_purchased("telepathic_focus"):
		mult += 0.35
	for c in crew:
		if str(c.get("roleKey", "")) == "psion":
			mult += 0.20
	return mult

func apply_combat_damage(raw_amount: float, source_label: String = "Feindfeuer") -> void:
	var armor_mult: float = 0.75 if is_mutation_purchased("chitin_armor") else 1.0
	var dmg: float = max(1.0, raw_amount * armor_mult)
	health -= dmg
	if health <= 0.0:
		health = max_health * 0.45
		bio_energy = max(15.0, bio_energy - 12.0)
		mental_energy = max(15.0, mental_energy - 8.0)
		add_log("NOTFALL", "🚨 CHITIN-NOTSTASIS: Hülle gegen %s kollabiert — Notfall-Regeneration aktiviert (45%% ❤️ Hülle)!" % source_label)
		player_emergency_revived.emit()
	vitals_updated.emit()

func warp_to_system(target_id: int) -> void:
	var warp_bio_cost: float = 20.0
	var warp_mental_cost: float = 15.0
	if bio_energy < warp_bio_cost or mental_energy < warp_mental_cost:
		add_log("WARNUNG", "⚠️ Raumfaltung blockiert! Benötigt %.0f ⚡ Bio-Energie & %.0f 🧠 Mentalkraft (Ernte Planeten oder nutze Versorgung [Tab]!)" % [warp_bio_cost, warp_mental_cost])
		return

	bio_energy = max(0.0, bio_energy - warp_bio_cost)
	mental_energy = max(0.0, mental_energy - warp_mental_cost)
	current_system_id = target_id
	if not visited_system_ids.has(target_id):
		visited_system_ids.append(target_id)
	locked_target = null
	nearest_interactable = null
	active_dossier_key = ""
	var sys := get_current_system()
	vitals_updated.emit()
	add_log("NAV", "🌀 Quantenfeld gefaltet (-20 ⚡ Bio, -15 🧠 Mental): Ankunft im System %s." % sys.get("name", "Unbekannt"))
	system_changed.emit(current_system_id, sys)

func reset_to_new_game() -> void:
	max_health = 100.0
	health = max_health
	max_bio_energy = 100.0
	bio_energy = max_bio_energy
	max_mental_energy = 100.0
	mental_energy = max_mental_energy
	loneliness = 45.0
	bio_res = 0
	silicon_res = 0
	water_res = 35
	food_res = 40
	alloy_res = 10
	tech_res = 0
	melange_res = 0
	_water_accum = 35.0
	_food_accum = 40.0
	shuttle_unlocked = false
	shuttle_ready = true
	shuttle_hull = shuttle_max_hull
	active_away_mission.clear()
	for k in mutations.keys():
		mutations[k]["purchased"] = false
	max_crew_capacity = 4
	crew = [crew[0]] if crew.size() > 0 else []
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
	combat_kills = 0
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
