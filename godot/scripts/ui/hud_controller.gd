extends CanvasLayer

## Main HUD, Scanner Dossier, Channeling Progress Bar, Crew Roster, Story Dialogue & Star Map [M] (Godot 4.6)

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
var radar_canvas: Control = null

# Dynamic UI Widgets for Core Loop (Channeling Bar, Planet Dossier & Crew Roster)
var channel_panel: PanelContainer = null
var channel_title_label: Label = null
var channel_bar: ProgressBar = null

var dossier_panel: PanelContainer = null
var dossier_title_label: Label = null
var dossier_body_label: RichTextLabel = null
var dossier_harvest_btn: Button = null
var dossier_abduct_btn: Button = null
var showing_crew_tab: bool = false

func _ready() -> void:
	dialogue_panel.visible = false
	galaxy_map_panel.visible = false
	_setup_minimap_radar()
	_setup_channel_progress_bar()
	_setup_dossier_and_crew_panel()

	GameState.vitals_updated.connect(_refresh_hud)
	GameState.system_changed.connect(func(_id, _sys):
		if dossier_panel:
			dossier_panel.visible = false
		_refresh_hud()
	)
	GameState.log_added.connect(_on_log_added)
	GameState.channel_progress_updated.connect(_on_channel_progress_updated)
	GameState.dossier_updated.connect(_on_dossier_updated)
	GameState.crew_updated.connect(_on_crew_updated)
	QuestManager.dialogue_opened.connect(_on_dialogue_opened)
	QuestManager.dialogue_closed.connect(_on_dialogue_closed)
	QuestManager.quest_updated.connect(func(_q, _s): _refresh_hud())

	_refresh_hud()

func _setup_channel_progress_bar() -> void:
	channel_panel = PanelContainer.new()
	channel_panel.name = "ChannelProgressPanel"
	channel_panel.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	channel_panel.offset_left = -220.0
	channel_panel.offset_top = -108.0
	channel_panel.offset_right = 220.0
	channel_panel.offset_bottom = -56.0
	channel_panel.visible = false

	var vbox := VBoxContainer.new()
	channel_panel.add_child(vbox)

	channel_title_label = Label.new()
	channel_title_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	channel_title_label.text = "🛰️ Spektral-Analyse läuft..."
	vbox.add_child(channel_title_label)

	channel_bar = ProgressBar.new()
	channel_bar.min_value = 0.0
	channel_bar.max_value = 100.0
	channel_bar.value = 0.0
	channel_bar.custom_minimum_size = Vector2(400.0, 18.0)
	vbox.add_child(channel_bar)

	add_child(channel_panel)

func _setup_dossier_and_crew_panel() -> void:
	dossier_panel = PanelContainer.new()
	dossier_panel.name = "PlanetDossierPanel"
	dossier_panel.set_anchors_preset(Control.PRESET_TOP_LEFT)
	dossier_panel.offset_left = 16.0
	dossier_panel.offset_top = 88.0
	dossier_panel.offset_right = 460.0
	dossier_panel.offset_bottom = 395.0
	dossier_panel.visible = false

	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 8)
	dossier_panel.add_child(vbox)

	var header_row := HBoxContainer.new()
	vbox.add_child(header_row)

	dossier_title_label = Label.new()
	dossier_title_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	dossier_title_label.add_theme_color_override("font_color", Color(0.22, 0.88, 1.0))
	dossier_title_label.text = "📋 SPEKTRAL-DOSSIER"
	header_row.add_child(dossier_title_label)

	var crew_tab_btn := Button.new()
	crew_tab_btn.text = "👥 Crew [Tab]"
	crew_tab_btn.pressed.connect(_toggle_crew_roster_view)
	header_row.add_child(crew_tab_btn)

	var close_btn := Button.new()
	close_btn.text = "✕"
	close_btn.pressed.connect(func(): dossier_panel.visible = false)
	header_row.add_child(close_btn)

	dossier_body_label = RichTextLabel.new()
	dossier_body_label.bbcode_enabled = true
	dossier_body_label.size_flags_vertical = Control.SIZE_EXPAND_FILL
	dossier_body_label.custom_minimum_size = Vector2(410.0, 195.0)
	vbox.add_child(dossier_body_label)

	var action_row := HBoxContainer.new()
	action_row.add_theme_constant_override("separation", 8)
	vbox.add_child(action_row)

	dossier_harvest_btn = Button.new()
	dossier_harvest_btn.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	dossier_harvest_btn.text = "🌿 [E] Bio-Siphon Ernten"
	dossier_harvest_btn.pressed.connect(func():
		var world_mgr: Node = get_tree().current_scene
		if world_mgr and world_mgr.has_method("_handle_e_harvest"):
			world_mgr.call("_handle_e_harvest")
	)
	action_row.add_child(dossier_harvest_btn)

	dossier_abduct_btn = Button.new()
	dossier_abduct_btn.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	dossier_abduct_btn.text = "🔮 [R] Bewusstsein Entführen"
	dossier_abduct_btn.pressed.connect(func():
		var world_mgr: Node = get_tree().current_scene
		if world_mgr and world_mgr.has_method("_handle_r_abduct"):
			world_mgr.call("_handle_r_abduct")
	)
	action_row.add_child(dossier_abduct_btn)

	add_child(dossier_panel)

func _on_channel_progress_updated(mode: String, progress: float, target_name: String) -> void:
	if not channel_panel:
		return
	if mode == "" or progress <= 0.0:
		channel_panel.visible = false
		return

	channel_panel.visible = true
	channel_bar.value = progress
	if mode == "scan":
		channel_title_label.text = "🛰️ Spektral-Scan: %s (%.0f%%)" % [target_name, progress]
		channel_title_label.add_theme_color_override("font_color", Color(0.22, 0.88, 1.0))
	elif mode == "harvest":
		channel_title_label.text = "🌿 Bio-Siphon Extraktion: %s (%.0f%%)" % [target_name, progress]
		channel_title_label.add_theme_color_override("font_color", Color(0.0, 1.0, 0.55))
	elif mode == "abduct":
		channel_title_label.text = "🔮 Psionischer Traktorstrahl: %s (%.0f%%)" % [target_name, progress]
		channel_title_label.add_theme_color_override("font_color", Color(0.75, 0.42, 1.0))

func _on_dossier_updated(planet_key: String, dossier: Dictionary) -> void:
	showing_crew_tab = false
	GameState.active_dossier_key = planet_key
	_render_dossier_panel(dossier)

func _on_crew_updated() -> void:
	_refresh_hud()
	if dossier_panel and dossier_panel.visible and showing_crew_tab:
		_render_crew_panel()

func _toggle_crew_roster_view() -> void:
	if not dossier_panel:
		return
	if not dossier_panel.visible:
		dossier_panel.visible = true
		showing_crew_tab = true
		_render_crew_panel()
		return
	showing_crew_tab = not showing_crew_tab
	if showing_crew_tab:
		_render_crew_panel()
	elif GameState.active_dossier_key != "" and GameState.planet_dossiers.has(GameState.active_dossier_key):
		_render_dossier_panel(GameState.planet_dossiers[GameState.active_dossier_key])
	else:
		_render_crew_panel()

func _render_dossier_panel(dossier: Dictionary) -> void:
	if not dossier_panel:
		return
	dossier_panel.visible = true
	var p_name: String = str(dossier.get("name", "Planet"))
	var p_type: String = str(dossier.get("type", "Rocky"))
	var is_depleted: bool = bool(dossier.get("depleted", false))
	var cands: Array = dossier.get("candidates", [])

	dossier_title_label.text = "📋 %s [%s]" % [p_name, p_type]
	var status_badge: String = "[color=#ef4444][b]🔴 VORKOMMEN ERSCHÖPFT (Bereits abgeerntet)[/b][/color]" if is_depleted else "[color=#10b981][b]🟢 RESSOURCEN VERFÜGBAR ([E] Bio-Siphon)[/b][/color]"

	var text_lines: Array[String] = [
		"• [b]Status:[/b] %s" % status_badge,
		"• [b]Atmosphäre:[/b] %s" % str(dossier.get("atmos", "-")),
		"• [b]Temperatur:[/b] %s" % str(dossier.get("temp", "-")),
		"• [b]Biosphäre:[/b] %s" % str(dossier.get("bio", "-")),
		"• [b]Vorkommen:[/b] %s" % str(dossier.get("res", "-")),
		""
	]

	if cands.size() > 0:
		text_lines.append("[color=#c084fc][b]🧬 Vernunftbegabte Lebenszeichen (%d verfügbar):[/b][/color]" % cands.size())
		for c in cands:
			if typeof(c) == TYPE_DICTIONARY:
				text_lines.append("  • [b]%s[/b] (%s) — %s\n    [i]%s[/i]" % [
					str(c.get("name", "Unbekannt")),
					str(c.get("species", "Xeno")),
					str(c.get("role", "Symbiont")),
					str(c.get("buffDesc", ""))
				])
	elif p_type == "Habitable" or str(dossier.get("bio", "")).contains("Kuppel") or str(dossier.get("bio", "")).contains("Forschungsstation"):
		text_lines.append("[color=#94a3b8]🧬 Keine weiteren vernunftbegabten Individuen verfügbar (Bereits assimiliert).[/color]")
	else:
		text_lines.append("[color=#94a3b8]🧬 Keine Lebenszeichen (Unbewohnbares Klima / Keine Oberflächen-Habitate).[/color]")

	dossier_body_label.text = "\n".join(text_lines)

	dossier_harvest_btn.visible = true
	dossier_harvest_btn.disabled = is_depleted
	dossier_harvest_btn.text = "🔴 Bereits abgeerntet" if is_depleted else "🌿 [E] Bio-Siphon Ernten"

	dossier_abduct_btn.visible = true
	var can_abduct: bool = (cands.size() > 0 and GameState.crew.size() < GameState.max_crew_capacity)
	dossier_abduct_btn.disabled = not can_abduct
	if GameState.crew.size() >= GameState.max_crew_capacity:
		dossier_abduct_btn.text = "🔮 Kokons voll (%d/%d)" % [GameState.crew.size(), GameState.max_crew_capacity]
	elif cands.is_empty():
		dossier_abduct_btn.text = "🔮 Keine Wirte (0)"
	else:
		dossier_abduct_btn.text = "🔮 [R] Entführen (%d)" % cands.size()

func _render_crew_panel() -> void:
	if not dossier_panel:
		return
	dossier_panel.visible = true
	dossier_title_label.text = "👥 SYMBIONTEN-KOKONS (%d / %d)  •  😌 Einsamkeit: %.0f%%" % [
		GameState.crew.size(),
		GameState.max_crew_capacity,
		GameState.loneliness
	]
	var lines: Array[String] = []
	for i in range(GameState.crew.size()):
		var c: Dictionary = GameState.crew[i]
		lines.append("[b]%d. %s[/b] (%s)" % [i + 1, str(c.get("name", "Crew")), str(c.get("species", "Spezies"))])
		lines.append("   Rolle: [color=#38bdf8]%s[/color]" % str(c.get("role", "Offizier")))
		if str(c.get("buffDesc", "")) != "":
			lines.append("   Synergie: [color=#34d399]%s[/color]" % str(c.get("buffDesc", "")))
		lines.append("")
	dossier_body_label.text = "\n".join(lines)
	dossier_harvest_btn.visible = false
	dossier_abduct_btn.visible = false

func _setup_minimap_radar() -> void:
	radar_canvas = Control.new()
	radar_canvas.name = "SystemRadar"
	radar_canvas.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
	radar_canvas.offset_left = -210.0
	radar_canvas.offset_top = -250.0
	radar_canvas.offset_right = -20.0
	radar_canvas.offset_bottom = -60.0
	radar_canvas.mouse_filter = Control.MOUSE_FILTER_IGNORE
	radar_canvas.draw.connect(_on_radar_draw)
	add_child(radar_canvas)

func _on_radar_draw() -> void:
	if not radar_canvas:
		return
	var center := Vector2(95.0, 95.0)
	var radius: float = 88.0
	var world_range: float = 420.0

	# Radar Background & Rings
	radar_canvas.draw_circle(center, radius, Color(0.02, 0.06, 0.12, 0.78))
	radar_canvas.draw_arc(center, radius, 0.0, TAU, 64, Color(0.22, 0.74, 0.98, 0.45), 1.8)
	radar_canvas.draw_arc(center, radius * 0.66, 0.0, TAU, 48, Color(0.22, 0.74, 0.98, 0.16), 1.0)
	radar_canvas.draw_arc(center, radius * 0.33, 0.0, TAU, 32, Color(0.22, 0.74, 0.98, 0.16), 1.0)

	# Central Sun at (0, 0, 0)
	radar_canvas.draw_circle(center, 5.5, Color(1.0, 0.84, 0.2, 0.95))

	# Draw Orbiting Planets, Moons, Stations & Quest Ships
	var world_mgr: Node = get_tree().current_scene
	if world_mgr and world_mgr.get("interactable_bodies") != null:
		var bodies: Array = world_mgr.get("interactable_bodies")
		for b in bodies:
			if is_instance_valid(b) and b is Node3D:
				var b_node: Node3D = b as Node3D
				var pos_2d := Vector2(b_node.global_position.x, b_node.global_position.z) / world_range * radius
				if pos_2d.length() > radius - 4.0:
					pos_2d = pos_2d.normalized() * (radius - 4.0)
				var cat: String = str(b_node.get("entity_category"))
				var p_key: String = str(b_node.get("planet_key")) if b_node.get("planet_key") != null else ""
				var dep: bool = GameState.is_planet_depleted(p_key) if p_key != "" else false
				if cat == "planet":
					var p_col := Color(0.45, 0.5, 0.58, 0.65) if dep else Color(0.22, 0.74, 0.98, 0.95)
					radar_canvas.draw_circle(center + pos_2d, 3.6, p_col)
				elif cat == "jamal_shuttle":
					radar_canvas.draw_circle(center + pos_2d, 4.2, Color(1.0, 0.65, 0.0, 1.0))
					radar_canvas.draw_arc(center + pos_2d, 6.8, 0.0, TAU, 16, Color(1.0, 0.65, 0.0, 0.85), 1.5)
				elif cat == "space_station":
					radar_canvas.draw_rect(Rect2(center + pos_2d - Vector2(3.0, 3.0), Vector2(6.0, 6.0)), Color(0.75, 0.45, 0.98, 0.95))
				elif cat == "moon":
					radar_canvas.draw_circle(center + pos_2d, 1.8, Color(0.7, 0.78, 0.88, 0.75))

	# Draw Player Bio-Ship (Najmafar)
	var player: Node3D = get_tree().get_first_node_in_group("player_ship") as Node3D
	if player:
		var p_pos := Vector2(player.global_position.x, player.global_position.z) / world_range * radius
		if p_pos.length() > radius - 4.0:
			p_pos = p_pos.normalized() * (radius - 4.0)
		radar_canvas.draw_circle(center + p_pos, 4.0, Color(0.0, 1.0, 0.55, 1.0))

func _process(_delta: float) -> void:
	_update_proximity_prompt()
	if radar_canvas:
		radar_canvas.queue_redraw()

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		var key_event: InputEventKey = event as InputEventKey
		if key_event.keycode == KEY_M:
			_toggle_galaxy_map()
		elif key_event.keycode == KEY_TAB:
			_toggle_crew_roster_view()
		elif key_event.keycode == KEY_J:
			if QuestManager.is_dialogue_open:
				QuestManager.close_dialogue()
			else:
				QuestManager.open_dialogue("jamal_orbit_intro")
		elif QuestManager.is_dialogue_open:
			var num: int = int(key_event.keycode) - int(KEY_1)
			if num >= 0 and num <= 8:
				QuestManager.select_dialogue_option(num)

func _refresh_hud() -> void:
	var sys: Dictionary = GameState.get_current_system()
	vitals_label.text = "🪐 %s  |  ❤️ %.0f%%  ⚡ %.0f%%  🧠 %.0f%%  |  🌿 %d Bio  💎 %d Sil  🌶️ %d Melange  |  👥 %d/%d Crew" % [
		sys.get("name", "Perseus-Rand"),
		GameState.health,
		GameState.bio_energy,
		GameState.mental_energy,
		GameState.bio_res,
		GameState.silicon_res,
		GameState.melange_res,
		GameState.crew.size(),
		GameState.max_crew_capacity
	]
	directive_label.text = QuestManager.get_active_quest_directive_text()

func _update_proximity_prompt() -> void:
	if QuestManager.is_dialogue_open:
		target_prompt_label.text = "💬 Dialog aktiv (Tasten [1]-[3] oder Mausklick)"
		return

	var player: Node3D = get_tree().get_first_node_in_group("player_ship") as Node3D
	var nearest: Node3D = GameState.nearest_interactable
	if player and nearest and is_instance_valid(nearest):
		var dist: float = player.global_position.distance_to(nearest.global_position)
		var d_name: String = str(nearest.get("display_name")) if nearest.get("display_name") != null else nearest.name
		if dist <= 40.0:
			var is_harv: bool = bool(nearest.get_meta("is_harvestable", false))
			if is_harv:
				var p_key: String = str(nearest.get("planet_key")) if nearest.get("planet_key") != null else GameState.make_planet_key(nearest.name)
				var scanned: bool = GameState.is_planet_scanned(p_key)
				var depleted: bool = GameState.is_planet_depleted(p_key)
				if not scanned:
					target_prompt_label.text = "🎯 %s (%.1f AE)  —  🛰️ [F] Spektral-Scan starten (Erforderlich vor Ernte/Entführung)" % [d_name, dist]
				else:
					var harv_str: String = "🔴 [Bereits abgeerntet]" if depleted else "🌿 [E] Bio-Siphon Ernten"
					var cand_cnt: int = 0
					if GameState.planet_dossiers.has(p_key):
						cand_cnt = (GameState.planet_dossiers[p_key].get("candidates", []) as Array).size()
					var abd_str: String = ("  |  🔮 [R] Entführen (%d)" % cand_cnt) if cand_cnt > 0 else ""
					target_prompt_label.text = "🎯 %s (%.1f AE)  —  %s%s  |  📋 [F] Dossier" % [d_name, dist, harv_str, abd_str]
			else:
				target_prompt_label.text = "🎯 %s (%.1f AE)  —  [F] Untersuchen / Kommunizieren  |  [X] Bio-EMP" % [d_name, dist]
		else:
			target_prompt_label.text = "🧭 Nächstes Objekt: %s (%.1f AE)  |  [WASD] Fliegen  [M] Sternenkarte  [Tab] Crew  [J] Tariq Funk" % [d_name, dist]
	else:
		target_prompt_label.text = "[WASD] Steuerung  |  [F] Scannen  [E] Ernten  [R] Entführen  |  [M] Karte  [Tab] Crew"

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
