extends Node

## Data-Driven Quest & Story Dialogue Manager for Project Najmafar (Godot 4.6)
## Reads directly from res://data/quests.json and res://data/dialogues.json

signal dialogue_opened(node_data: Dictionary)
signal dialogue_closed()
signal quest_updated(quest_id: String, stage: int)
signal decoy_trap_triggered()
signal real_ship_liberated_visual()

var quests_db: Dictionary = {}
var dialogues_db: Dictionary = {}
var active_quests: Dictionary = {}
var current_dialogue_id: String = ""
var is_dialogue_open: bool = false

func _ready() -> void:
	load_quests()
	load_dialogues()
	start_quest("prologue_jamal_ship")

func load_quests() -> void:
	var path := "res://data/quests.json"
	if FileAccess.file_exists(path):
		var file := FileAccess.open(path, FileAccess.READ)
		if file:
			var parsed = JSON.parse_string(file.get_as_text())
			if typeof(parsed) == TYPE_DICTIONARY:
				quests_db = parsed

func load_dialogues() -> void:
	var path := "res://data/dialogues.json"
	if FileAccess.file_exists(path):
		var file := FileAccess.open(path, FileAccess.READ)
		if file:
			var parsed = JSON.parse_string(file.get_as_text())
			if typeof(parsed) == TYPE_DICTIONARY:
				dialogues_db = parsed
				print("[QuestManager] Loaded %d branching dialogue nodes." % dialogues_db.size())

func start_quest(quest_id: String) -> void:
	if not quests_db.has(quest_id):
		return
	active_quests[quest_id] = {
		"id": quest_id,
		"stage": 1,
		"completed": false
	}
	quest_updated.emit(quest_id, 1)

func advance_quest(quest_id: String, new_stage: int) -> void:
	if not active_quests.has(quest_id):
		start_quest(quest_id)
	var cur_stage: int = active_quests[quest_id].get("stage", 1)
	if new_stage > cur_stage:
		active_quests[quest_id]["stage"] = new_stage
		quest_updated.emit(quest_id, new_stage)

func complete_quest(quest_id: String) -> void:
	if active_quests.has(quest_id):
		active_quests[quest_id]["completed"] = true
		quest_updated.emit(quest_id, 99)

func get_active_quest_directive_text() -> String:
	if not GameState.jamal_ship_liberated:
		if not GameState.jamal_decoy_revealed:
			return "🛰️ PHASE 1: Fliege zu Dr. Jamals Schiff im Orbit des ersten Planeten und untersuche es mit [F] (Sammle unterwegs Asteroiden & Wracks)."
		else:
			var depot: Dictionary = GameState.get_insan_depot_system()
			var depot_name: String = str(depot.get("name", "INSAN-Verwahrstelle Zeta-9"))
			if GameState.current_system_id != int(depot.get("id", -1)):
				return "🌌 PHASE 1: Reise über Zwischensysteme im grünen Sprungkreis [M] zur %s (🔶) — tanke an Asteroidengürteln & Wracks auf!" % depot_name
			else:
				return "🎯 PIER 4: Fliege im Orbit direkt zur echten 'Ar-Riḥla' [PIER 4] und sprenge ihre Parkkralle mit dem Psi-Kegel [X] / [Leertaste]!"
	return "🚀 ÜBERLEBEN & AUSBAU: Erkunde Systeme [M], birg Wracks [F], nimm Crew auf [R] und schicke die Ar-Riḥla in Planeten-Ruinen!"

func open_dialogue(node_id: String) -> void:
	if not dialogues_db.has(node_id):
		push_warning("[QuestManager] Dialogue node not found: " + node_id)
		return
	current_dialogue_id = node_id
	is_dialogue_open = true
	var node_data: Dictionary = dialogues_db[node_id]
	dialogue_opened.emit(node_data)

func close_dialogue() -> void:
	is_dialogue_open = false
	current_dialogue_id = ""
	dialogue_closed.emit()

func select_dialogue_option(option_index: int) -> void:
	if not is_dialogue_open or not dialogues_db.has(current_dialogue_id):
		return
	var node_data: Dictionary = dialogues_db[current_dialogue_id]
	var options: Array = node_data.get("options", [])
	if option_index < 0 or option_index >= options.size():
		return

	var opt: Dictionary = options[option_index]
	var action: String = opt.get("action", "")
	var target_node: String = opt.get("targetNodeId", "")

	if action == "close":
		close_dialogue()
		return
	elif action in ["trigger_decoy_trap", "hack_clamp_attempt", "smash_clamp_attempt"]:
		trigger_decoy_trap_sequence()
		return
	elif action == "liberate_real_ship_at_station":
		liberate_real_ship()
		return
	elif action == "liberate_voyager_probe":
		liberate_voyager_on_site()
		return

	if target_node != "":
		open_dialogue(target_node)
	else:
		close_dialogue()

func trigger_decoy_trap_sequence() -> void:
	if GameState.jamal_decoy_revealed:
		open_dialogue("hologram_trap_revealed")
		return
	GameState.jamal_decoy_revealed = true
	advance_quest("prologue_jamal_ship", 2)
	var depot: Dictionary = GameState.get_insan_depot_system()
	GameState.add_log("ALARM", "🚨 HOLOGRAPHISCHE KÖDERFALLE! Die Projektion zerfällt — die echte Ar-Riḥla liegt 2 Sprünge weiter in: %s!" % str(depot.get("name", "INSAN-Verwahrstelle Zeta-9")))
	decoy_trap_triggered.emit()
	open_dialogue("hologram_trap_revealed")

func liberate_voyager_on_site() -> void:
	if not GameState.voyager_liberated:
		GameState.voyager_liberated = true
		GameState.voyager_scanned = true
		GameState.mental_energy = min(GameState.max_mental_energy, GameState.mental_energy + 30.0)
		GameState.loneliness = max(10.0, GameState.loneliness - 25.0)
		GameState.tech_res += 5
		GameState.vitals_updated.emit()
		GameState.add_log("RELIKT", "🛰️ Voyager 2 geborgen: +30% 🧠 Mentalkraft, -25% Einsamkeit, +5 ⚙️ Tech-Telemetrie!")
	open_dialogue("insan_voyager_liberated")

func liberate_real_ship() -> void:
	if GameState.jamal_ship_liberated:
		return
	GameState.jamal_ship_liberated = true
	GameState.melange_res += 50
	GameState.silicon_res += 60
	GameState.unlock_jamal_shuttle()
	complete_quest("prologue_jamal_ship")
	GameState.vitals_updated.emit()
	GameState.add_log("QUEST", "🎉 Forschungsschiff 'Ar-Riḥla' an Pier 4 befreit & angedockt! (+50 ☕ Qahwun, +60 💎 Silizium, +45 Lj Sprungreichweite)!")
	real_ship_liberated_visual.emit()
	open_dialogue("real_ship_liberated")
