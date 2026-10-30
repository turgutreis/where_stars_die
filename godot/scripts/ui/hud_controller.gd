extends CanvasLayer

## Main HUD, Story Dialogue Overlay & Interactive Star Map [M] for Project Najmafar (Godot 4.6)

@onready var vitals_label: Label = $TopBar/VitalsLabel
@onready var directive_label: Label = $TopBar/DirectiveLabel
@onready var target_prompt_label: Label = $BottomBar/TargetPromptLabel
@onready var log_label: RichTextLabel = $LogPanel/LogLabel

@onready var dialogue_panel: PanelContainer = $DialogueOverlay
@onready var dlg_speaker_label: Label = $DialogueOverlay/VBox/SpeakerLabel
@onready var dlg_main_label: Label = $DialogueOverlay/VBox/MainTextLabel
@onready var dlg_sub_label: Label = $DialogueOverlay/VBox/SubTextLabel
@onready var dlg_options_box: VBoxContainer = $DialogueOverlay/VBox/OptionsBox

@onready var galaxy_map_panel: PanelContainer = $GalaxyMapModal
@onready var map_systems_list: VBoxContainer = $GalaxyMapModal/VBox/Scroll/SystemsList

var log_lines: Array[String] = []

func _ready() -> void:
	dialogue_panel.visible = false
	galaxy_map_panel.visible = false

	GameState.vitals_updated.connect(_refresh_hud)
	GameState.system_changed.connect(func(_id, _sys): _refresh_hud())
	GameState.log_added.connect(_on_log_added)
	QuestManager.dialogue_opened.connect(_on_dialogue_opened)
	QuestManager.dialogue_closed.connect(_on_dialogue_closed)
	QuestManager.quest_updated.connect(func(_q, _s): _refresh_hud())

	_refresh_hud()

func _process(_delta: float) -> void:
	_update_proximity_prompt()

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		if event.keycode == KEY_M:
			_toggle_galaxy_map()
		elif event.keycode == KEY_J:
			if QuestManager.is_dialogue_open:
				QuestManager.close_dialogue()
			else:
				QuestManager.open_dialogue("jamal_orbit_intro")
		elif QuestManager.is_dialogue_open:
			var num := event.keycode - KEY_1
			if num >= 0 and num <= 8:
				QuestManager.select_dialogue_option(num)

func _refresh_hud() -> void:
	var sys := GameState.get_current_system()
	vitals_label.text = "🪐 %s  |  ❤️ %.0f%%  ⚡ %.0f%%  🧠 %.0f%%  |  🌿 %d Bio  💎 %d Sil  🌶️ %d Melange" % [
		sys.get("name", "Perseus-Rand"),
		GameState.health,
		GameState.bio_energy,
		GameState.mental_energy,
		GameState.bio_res,
		GameState.silicon_res,
		GameState.melange_res
	]
	directive_label.text = QuestManager.get_active_quest_directive_text()

func _update_proximity_prompt() -> void:
	if QuestManager.is_dialogue_open:
		target_prompt_label.text = "💬 Dialog aktiv (Tasten [1]-[3] oder Mausklick)"
		return

	var player := get_tree().get_first_node_in_group("player_ship") as Node3D
	var nearest := GameState.nearest_interactable
	if player and nearest and is_instance_valid(nearest):
		var dist := player.global_position.distance_to(nearest.global_position)
		var d_name: String = nearest.get("display_name") if nearest.get("display_name") != null else nearest.name
		if dist <= 32.0:
			var is_harv: bool = nearest.get_meta("is_harvestable", false)
			var action_hint := "[F] Scannen  |  [E] Ernten" if is_harv else "[F] Untersuchen / Kommunizieren  |  [X] Bio-EMP"
			target_prompt_label.text = "🎯 %s (%.1f AE)  —  %s" % [d_name, dist, action_hint]
		else:
			target_prompt_label.text = "🧭 Nächstes Objekt: %s (%.1f AE)  |  [WASD] Fliegen  [M] Sternenkarte  [J] Tariq Funk" % [d_name, dist]
	else:
		target_prompt_label.text = "[WASD] Schub & Steuerung  |  [M] Galaktische Sternenkarte  |  [J] Dr. Tariq Jamal"

func _on_log_added(category: String, message: String) -> void:
	log_lines.push_front("[b][%s][/b] %s" % [category, message])
	if log_lines.size() > 6:
		log_lines.resize(6)
	log_label.text = "\n".join(log_lines)

func _on_dialogue_opened(node_data: Dictionary) -> void:
	dialogue_panel.visible = true
	dlg_speaker_label.text = "%s  •  %s" % [node_data.get("eyebrow", "INTERAKTION"), node_data.get("speakerName", "NPC")]
	dlg_main_label.text = String(node_data.get("mainText", ""))
	dlg_sub_label.text = String(node_data.get("subText", ""))

	for child in dlg_options_box.get_children():
		child.queue_free()

	var options: Array = node_data.get("options", [])
	for i in range(options.size()):
		var opt: Dictionary = options[i]
		var btn := Button.new()
		btn.text = "[%d] %s" % [i + 1, opt.get("label", "Weiter")]
		btn.alignment = HORIZONTAL_ALIGNMENT_LEFT
		var idx := i
		btn.pressed.connect(func(): QuestManager.select_dialogue_option(idx))
		dlg_options_box.add_child(btn)

func _on_dialogue_closed() -> void:
	dialogue_panel.visible = false
	_refresh_hud()

func _toggle_galaxy_map() -> void:
	galaxy_map_panel.visible = not galaxy_map_panel.visible
	if not galaxy_map_panel.visible:
		return

	for child in map_systems_list.get_children():
		child.queue_free()

	for sys in GameState.systems:
		var sys_id: int = int(sys.get("id", 0))
		var sys_name: String = String(sys.get("name", "System"))
		var is_depot: bool = sys.get("isInsanDepot", false) or sys_name.contains("INSAN")
		var is_cur: bool = (sys_id == GameState.current_system_id)

		var btn := Button.new()
		var quest_badge := " 🔶 [QUEST-ZIEL: AR-RIḤLA]" if is_depot else ""
		var cur_badge := " 📍 [AKTUELLES SYSTEM]" if is_cur else ""
		btn.text = "#%d  %s (%s)%s%s" % [sys_id, sys_name, sys.get("sectorName", "Sektor"), quest_badge, cur_badge]
		btn.disabled = is_cur
		btn.alignment = HORIZONTAL_ALIGNMENT_LEFT
		btn.pressed.connect(func():
			galaxy_map_panel.visible = false
			GameState.warp_to_system(sys_id)
		)
		map_systems_list.add_child(btn)
