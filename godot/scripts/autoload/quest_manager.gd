extends Node

## Data-Driven Quest & Story Dialogue Manager for Project Najmafar (Godot 4.6)
## Reads directly from res://data/quests.json and res://data/dialogues.json

signal dialogue_opened(node_data: Dictionary)
signal dialogue_closed()
signal quest_updated(quest_id: String, stage: int)

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
			return "🛰️ DIREKTIVE: Fliege zu Dr. Tariq Jamals Forschungsschiff im Orbit des ersten Planeten und scanne es mit [F]."
		else:
			var depot := GameState.get_insan_depot_system()
			var depot_name: String = depot.get("name", "INSAN-Verwahrstelle Zeta-9")
			if GameState.current_system_id != int(depot.get("id", -1)):
				return "🌌 DIREKTIVE: Öffne die Sternenkarte [M] und falte den Raum zur %s (🔶 QUEST-ZIEL)!" % depot_name
			else:
				return "🛰️ DIREKTIVE: Fliege zur INSAN-Station (Schalter 7B) [F] oder befreie die echte Ar-Riḥla an Pier 4 mit Bio-EMP [X]!"
	return "🧬 DIREKTIVE: Erkunde die Galaxie [M], scanne Welten [F] und suche nach der Anomalie von 2035."

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
	elif action == "trigger_decoy_trap":
		GameState.jamal_decoy_revealed = true
		advance_quest("prologue_jamal_ship", 2)
		var depot := GameState.get_insan_depot_system()
		GameState.add_log("ALARM", "🚨 HOLOGRAPHISCHE KÖDERFALLE! Die echte Ar-Riḥla liegt in: %s!" % depot.get("name", "INSAN-Verwahrstelle Zeta-9"))
		open_dialogue("hologram_trap_revealed")
		return
	elif action == "liberate_real_ship_at_station":
		liberate_real_ship()
		return
	elif action == "liberate_voyager_probe":
		GameState.voyager_liberated = true
		GameState.voyager_scanned = true
		GameState.mental_energy = min(GameState.max_mental_energy, GameState.mental_energy + 30.0)
		GameState.loneliness = max(10.0, GameState.loneliness - 25.0)
		GameState.vitals_updated.emit()
		open_dialogue("insan_voyager_liberated")
		return

	if target_node != "":
		open_dialogue(target_node)
	else:
		close_dialogue()

func liberate_real_ship() -> void:
	GameState.jamal_ship_liberated = true
	GameState.melange_res += 50
	GameState.silicon_res += 60
	complete_quest("prologue_jamal_ship")
	GameState.vitals_updated.emit()
	GameState.add_log("QUEST", "🎉 Forschungsschiff 'Ar-Riḥla' an Pier 4 geborgen! (+50 Melange, +60 Silizium)")
	open_dialogue("real_ship_liberated")
