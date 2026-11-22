extends CanvasLayer

## Main HUD, 7-Resource Survival Bar, Scanner Dossier, Shuttle Away Missions, Crew Deck [Tab], Evolution [U] & Star Map [M] (Godot 4.6)

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

# Dynamic UI Widgets
var channel_panel: PanelContainer = null
var channel_title_label: Label = null
var channel_bar: ProgressBar = null

var away_panel: PanelContainer = null
var away_title_label: Label = null
var away_bar: ProgressBar = null

var dossier_panel: PanelContainer = null
var dossier_title_label: Label = null
var dossier_body_label: RichTextLabel = null
var dossier_action_box: VBoxContainer = null
var active_deck_tab: String = "dossier" # "dossier", "crew", "evolution", "expedition"
var planning_dossier: Dictionary = {}
var planning_deposit: Dictionary = {}
var selected_team_ids: Array[int] = []

func _ready() -> void:
	dialogue_panel.visible = false
	galaxy_map_panel.visible = false
	_setup_minimap_radar()
	_setup_channel_progress_bar()
	_setup_away_mission_banner()
	_setup_dossier_and_crew_panel()

	GameState.vitals_updated.connect(_refresh_hud)
	GameState.system_changed.connect(func(_id, _sys):
		if dossier_panel and active_deck_tab in ["dossier", "expedition"]:
			dossier_panel.visible = false
		_refresh_hud()
	)
	GameState.log_added.connect(_on_log_added)
	GameState.channel_progress_updated.connect(_on_channel_progress_updated)
	GameState.away_mission_updated.connect(_on_away_mission_updated)
	GameState.dossier_updated.connect(_on_dossier_updated)
	GameState.crew_updated.connect(_on_crew_updated)
	GameState.mutations_updated.connect(_on_mutations_updated)
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

func _setup_away_mission_banner() -> void:
	away_panel = PanelContainer.new()
	away_panel.name = "AwayMissionPanel"
	away_panel.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	away_panel.offset_left = -410.0
	away_panel.offset_top = 88.0
	away_panel.offset_right = -16.0
	away_panel.offset_bottom = 148.0
	away_panel.visible = false

	var vbox := VBoxContainer.new()
	away_panel.add_child(vbox)

	away_title_label = Label.new()
	away_title_label.add_theme_color_override("font_color", Color(0.98, 0.72, 0.22))
	away_title_label.text = "🚀 Ar-Riḥla Außenmission..."
	vbox.add_child(away_title_label)

	away_bar = ProgressBar.new()
	away_bar.min_value = 0.0
	away_bar.max_value = 100.0
	away_bar.value = 0.0
	away_bar.custom_minimum_size = Vector2(360.0, 16.0)
	vbox.add_child(away_bar)

	add_child(away_panel)

func _on_away_mission_updated(mission: Dictionary) -> void:
	if not away_panel:
		return
	if mission.is_empty():
		away_panel.visible = false
		return
	away_panel.visible = true
	var pct: float = float(mission.get("progress", 0.0)) * 100.0
	away_bar.value = pct
	var st_idx: int = int(mission.get("stage", 0))
	var phase_name: String = "Abstieg"
	if st_idx == 1:
		phase_name = "Erkundung & Scan"
	elif st_idx == 2:
		phase_name = "Ressourcen-Bergung"
	elif st_idx >= 3:
		phase_name = "Rückkehr zu Najmafar"
	away_title_label.text = "🚀 Ar-Riḥla auf %s — %s (%.0f%%)" % [
		str(mission.get("planetName", "Planet")),
		phase_name,
		pct
	]

func _setup_dossier_and_crew_panel() -> void:
	dossier_panel = PanelContainer.new()
	dossier_panel.name = "PlanetDossierPanel"
	dossier_panel.set_anchors_preset(Control.PRESET_TOP_LEFT)
	dossier_panel.offset_left = 16.0
	dossier_panel.offset_top = 88.0
	dossier_panel.offset_right = 530.0
	dossier_panel.offset_bottom = 490.0
	dossier_panel.visible = false

	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 8)
	dossier_panel.add_child(vbox)

	var header_row := HBoxContainer.new()
	header_row.add_theme_constant_override("separation", 6)
	vbox.add_child(header_row)

	dossier_title_label = Label.new()
	dossier_title_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	dossier_title_label.add_theme_color_override("font_color", Color(0.22, 0.88, 1.0))
	dossier_title_label.text = "📋 SPEKTRAL-DOSSIER"
	header_row.add_child(dossier_title_label)

	var dos_tab_btn := Button.new()
	dos_tab_btn.text = "📋 Scan"
	dos_tab_btn.pressed.connect(func(): _switch_deck_tab("dossier"))
	header_row.add_child(dos_tab_btn)

	var crew_tab_btn := Button.new()
	crew_tab_btn.text = "👥 Crew [Tab]"
	crew_tab_btn.pressed.connect(func(): _switch_deck_tab("crew"))
	header_row.add_child(crew_tab_btn)

	var evo_tab_btn := Button.new()
	evo_tab_btn.text = "🧬 Evolution [U]"
	evo_tab_btn.pressed.connect(func(): _switch_deck_tab("evolution"))
	header_row.add_child(evo_tab_btn)

	var close_btn := Button.new()
	close_btn.text = "✕"
	close_btn.pressed.connect(func(): dossier_panel.visible = false)
	header_row.add_child(close_btn)

	dossier_body_label = RichTextLabel.new()
	dossier_body_label.bbcode_enabled = true
	dossier_body_label.size_flags_vertical = Control.SIZE_EXPAND_FILL
	dossier_body_label.custom_minimum_size = Vector2(480.0, 175.0)
	vbox.add_child(dossier_body_label)

	dossier_action_box = VBoxContainer.new()
	dossier_action_box.add_theme_constant_override("separation", 6)
	vbox.add_child(dossier_action_box)

	add_child(dossier_panel)

func _switch_deck_tab(tab_name: String) -> void:
	if not dossier_panel:
		return
	if dossier_panel.visible and active_deck_tab == tab_name and tab_name != "dossier":
		dossier_panel.visible = false
		return
	active_deck_tab = tab_name
	dossier_panel.visible = true
	_refresh_active_deck_tab()

func _refresh_active_deck_tab() -> void:
	if not dossier_panel or not dossier_panel.visible:
		return
	if active_deck_tab == "crew":
		_render_crew_panel()
	elif active_deck_tab == "evolution":
		_render_evolution_panel()
	elif active_deck_tab == "expedition":
		_render_expedition_planner(planning_dossier, planning_deposit)
	else:
		if GameState.active_dossier_key != "" and GameState.planet_dossiers.has(GameState.active_dossier_key):
			_render_dossier_panel(GameState.planet_dossiers[GameState.active_dossier_key])
		else:
			_render_crew_panel()

func _clear_action_box() -> void:
	if not dossier_action_box:
		return
	for c in dossier_action_box.get_children():
		c.queue_free()

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
	active_deck_tab = "dossier"
	GameState.active_dossier_key = planet_key
	_render_dossier_panel(dossier)

func _on_crew_updated() -> void:
	_refresh_hud()
	if dossier_panel and dossier_panel.visible and active_deck_tab == "crew":
		_render_crew_panel()

func _on_mutations_updated() -> void:
	_refresh_hud()
	if dossier_panel and dossier_panel.visible and active_deck_tab == "evolution":
		_render_evolution_panel()

func _resource_icon(res_key: String) -> String:
	match res_key:
		"water": return "💧 Wasser"
		"food": return "🍖 Nahrung"
		"alloys": return "🛡️ Legierungen"
		"tech": return "⚙️ Tech"
		_: return "🌿 Biomasse"

func _render_dossier_panel(dossier: Dictionary) -> void:
	if not dossier_panel:
		return
	dossier_panel.visible = true
	_clear_action_box()

	var p_name: String = str(dossier.get("name", "Planet"))
	var p_type: String = str(dossier.get("type", "Rocky"))
	var is_depleted: bool = bool(dossier.get("depleted", false))
	var cands: Array = dossier.get("candidates", [])
	var deposits: Array = dossier.get("deposits", [])

	dossier_title_label.text = "📋 %s [%s]" % [p_name, p_type]
	var status_badge: String = "[color=#ef4444][b]🔴 ORBITAL-MATTER ERSCHÖPFT[/b][/color]" if is_depleted else "[color=#10b981][b]🟢 BASIS-MATERIE VERFÜGBAR ([E] Orbital-Siphon)[/b][/color]"

	var text_lines: Array[String] = [
		"• [b]Status:[/b] %s" % status_badge,
		"• [b]Atmosphäre:[/b] %s" % str(dossier.get("atmos", "-")),
		"• [b]Temperatur:[/b] %s" % str(dossier.get("temp", "-")),
		"• [b]Biosphäre:[/b] %s" % str(dossier.get("bio", "-")),
		"• [b]Profil:[/b] %s" % str(dossier.get("res", "-")),
		""
	]

	if cands.size() > 0:
		text_lines.append("[color=#c084fc][b]🧬 Vernunftbegabte Lebenszeichen (%d verfügbar — [R] Entführen):[/b][/color]" % cands.size())
		for c in cands:
			if typeof(c) == TYPE_DICTIONARY:
				text_lines.append("  • [b]%s[/b] (%s) — %s" % [
					str(c.get("name", "Unbekannt")),
					str(c.get("species", "Xeno")),
					str(c.get("role", "Symbiont"))
				])
	elif p_type == "Habitable" or str(dossier.get("bio", "")).contains("Kuppel") or str(dossier.get("bio", "")).contains("Forschungsstation"):
		text_lines.append("[color=#94a3b8]🧬 Keine weiteren vernunftbegabten Individuen verfügbar.[/color]")
	else:
		text_lines.append("[color=#94a3b8]🧬 Keine Lebenszeichen (Unbewohnbares Klima / Keine Oberflächen-Habitate).[/color]")

	text_lines.append("")
	if deposits.is_empty():
		text_lines.append("[color=#94a3b8]🚀 [b]Oberflächen-Vorkommen:[/b] Keine landefähigen Lagerstätten (z.B. Gasriese — keine Nahrung, Tech oder Legierungen).[/color]")
	else:
		text_lines.append("[color=#fbbf24][b]🚀 Oberflächen-Vorkommen (Nur per Shuttle & entführter Crew):[/b][/color]")
		for dep in deposits:
			if typeof(dep) == TYPE_DICTIONARY:
				var dep_done: bool = bool(dep.get("depleted", false))
				var y_str: String = _resource_icon(str(dep.get("yieldResource", "alloys")))
				var y_amt: int = int(dep.get("yieldAmount", 25))
				var dep_status: String = "[color=#ef4444][ERSCHÖPFT][/color]" if dep_done else "[color=#34d399]+%d %s[/color]" % [y_amt, y_str]
				text_lines.append("  • [b]%s[/b]: %s" % [str(dep.get("name", "Vorkommen")), dep_status])

	dossier_body_label.text = "\n".join(text_lines)

	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	dossier_action_box.add_child(row)

	var harv_btn := Button.new()
	harv_btn.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	harv_btn.disabled = is_depleted
	harv_btn.text = "🔴 Orbital erschöpft" if is_depleted else "🌿 [E] Orbital-Siphon (-10 ⚡)"
	harv_btn.pressed.connect(func():
		var world_mgr: Node = get_tree().current_scene
		if world_mgr and world_mgr.has_method("_handle_e_harvest"):
			world_mgr.call("_handle_e_harvest")
	)
	row.add_child(harv_btn)

	var abd_btn := Button.new()
	abd_btn.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var can_abduct: bool = (cands.size() > 0 and GameState.crew.size() < GameState.max_crew_capacity)
	abd_btn.disabled = not can_abduct
	if GameState.crew.size() >= GameState.max_crew_capacity:
		abd_btn.text = "🔮 Kokons voll (%d/%d)" % [GameState.crew.size(), GameState.max_crew_capacity]
	elif cands.is_empty():
		abd_btn.text = "🔮 Keine Wirte (0)"
	else:
		abd_btn.text = "🔮 [R] Entführen (%d) (-15 🧠)" % cands.size()
	abd_btn.pressed.connect(func():
		var world_mgr: Node = get_tree().current_scene
		if world_mgr and world_mgr.has_method("_handle_r_abduct"):
			world_mgr.call("_handle_r_abduct")
	)
	row.add_child(abd_btn)

	# Surface Expedition Launch Buttons
	for dep in deposits:
		if typeof(dep) != TYPE_DICTIONARY or bool(dep.get("depleted", false)):
			continue
		var dep_btn := Button.new()
		var y_label: String = _resource_icon(str(dep.get("yieldResource", "alloys")))
		var dep_name: String = str(dep.get("name", "Lagerstätte"))
		if not GameState.shuttle_unlocked:
			dep_btn.disabled = true
			dep_btn.text = "🔒 %s (%s) — Befreie erst Tariqs 'Ar-Riḥla' (#77 INSAN-Depot)!" % [dep_name, y_label]
		elif GameState.get_abducted_crew_count() <= 0:
			dep_btn.disabled = true
			dep_btn.text = "🔒 %s (%s) — Entführe erst Crew [R] für Außenteam!" % [dep_name, y_label]
		elif not GameState.shuttle_ready:
			dep_btn.disabled = true
			dep_btn.text = "⏳ Ar-Riḥla bereits im Einsatz (%s)" % dep_name
		else:
			dep_btn.text = "🚀 Außenmission planen: %s (%s)" % [dep_name, y_label]
			var dep_copy: Dictionary = dep.duplicate(true)
			var dos_copy: Dictionary = dossier.duplicate(true)
			dep_btn.pressed.connect(func():
				_open_expedition_planner(dos_copy, dep_copy)
			)
		dossier_action_box.add_child(dep_btn)

func _open_expedition_planner(dossier: Dictionary, deposit: Dictionary) -> void:
	planning_dossier = dossier
	planning_deposit = deposit
	selected_team_ids.clear()
	# Pre-select up to 3 abducted crew members automatically
	for c in GameState.crew:
		if bool(c.get("is_abducted", false)):
			selected_team_ids.append(int(c.get("id", -1)))
			if selected_team_ids.size() >= 3:
				break
	active_deck_tab = "expedition"
	_render_expedition_planner(planning_dossier, planning_deposit)

func _render_expedition_planner(dossier: Dictionary, deposit: Dictionary) -> void:
	if not dossier_panel:
		return
	dossier_panel.visible = true
	_clear_action_box()

	var p_name: String = str(dossier.get("name", "Planet"))
	var dep_name: String = str(deposit.get("name", "Vorkommen"))
	var y_res: String = _resource_icon(str(deposit.get("yieldResource", "alloys")))
	var y_amt: int = int(deposit.get("yieldAmount", 25))

	dossier_title_label.text = "🚀 AUSSENTEAM-PLANER • Ar-Riḥla"
	var lines: Array[String] = [
		"[b]Ziel:[/b] %s (%s)" % [dep_name, p_name],
		"[b]Erwarteter Ertrag:[/b] +%d %s (+ Spezialisten-Bonus)" % [y_amt, y_res],
		"[b]Beschreibung:[/b] %s" % str(deposit.get("desc", "")),
		"[b]Gefahren-Profil:[/b] %s (%s)" % [str(deposit.get("hazardType", "none")).to_upper(), str(deposit.get("hazardSeverity", "none"))],
		"",
		"[color=#38bdf8]Wähle 1–3 Crew-Mitglieder für das Shuttle (mind. 1 entführter Symbiont):[/color]"
	]
	dossier_body_label.text = "\n".join(lines)

	for c in GameState.crew:
		var cid: int = int(c.get("id", -1))
		var is_abd: bool = bool(c.get("is_abducted", false))
		var cb := CheckBox.new()
		var tag: String = "[Entführt]" if is_abd else "[Traum-Kern]"
		cb.text = "%s %s — %s (%s)" % [tag, str(c.get("name", "Crew")), str(c.get("role", "Offizier")), str(c.get("buffDesc", ""))]
		cb.button_pressed = selected_team_ids.has(cid)
		cb.toggled.connect(func(pressed: bool):
			if pressed:
				if not selected_team_ids.has(cid):
					if selected_team_ids.size() >= 3:
						cb.set_pressed_no_signal(false)
						GameState.add_log("SHUTTLE", "Maximal 3 Plätze im Lande-Shuttle verfügbar!")
						return
					selected_team_ids.append(cid)
			else:
				selected_team_ids.erase(cid)
		)
		dossier_action_box.add_child(cb)

	var btn_row := HBoxContainer.new()
	btn_row.add_theme_constant_override("separation", 8)
	dossier_action_box.add_child(btn_row)

	var back_btn := Button.new()
	back_btn.text = "← Zurück zum Dossier"
	back_btn.pressed.connect(func(): _switch_deck_tab("dossier"))
	btn_row.add_child(back_btn)

	var launch_btn := Button.new()
	launch_btn.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	launch_btn.text = "🚀 Ar-Riḥla jetzt starten!"
	launch_btn.pressed.connect(func():
		var p_key: String = str(dossier.get("key", ""))
		var dep_id: String = str(deposit.get("id", ""))
		if GameState.start_away_mission(p_key, dep_id, selected_team_ids):
			dossier_panel.visible = false
	)
	btn_row.add_child(launch_btn)

func _render_crew_panel() -> void:
	if not dossier_panel:
		return
	dossier_panel.visible = true
	_clear_action_box()

	dossier_title_label.text = "👥 CREW & LEBENSERHALTUNG (%d/%d)  •  😌 Einsamkeit: %.0f%%" % [
		GameState.crew.size(),
		GameState.max_crew_capacity,
		GameState.loneliness
	]
	var shuttle_status: String = "[color=#ef4444]🔒 Noch kein Shuttle (Befreie Dr. Jamals 'Ar-Riḥla' im INSAN-Depot #77)[/color]"
	if GameState.shuttle_unlocked:
		var state_txt: String = "Einsatzbereit" if GameState.shuttle_ready else "Auf Außenmission!"
		shuttle_status = "[color=#34d399]🚀 %s (%s • Hülle %.0f%%)[/color]" % [GameState.shuttle_name, state_txt, GameState.shuttle_hull]

	var lines: Array[String] = [
		"[b]Lande-Shuttle:[/b] %s" % shuttle_status,
		"[color=#94a3b8]Lebenserhaltung verbraucht laufend 💧 Wasser & 🍖 Nahrung pro Crew-Mitglied.[/color]",
		""
	]
	for i in range(GameState.crew.size()):
		var c: Dictionary = GameState.crew[i]
		var origin_tag: String = "[color=#c084fc][Entführt • Außenteam][/color]" if bool(c.get("is_abducted", false)) else "[color=#fbbf24][Co-Pilot][/color]"
		lines.append("[b]%d. %s[/b] (%s) %s" % [i + 1, str(c.get("name", "Crew")), str(c.get("species", "Spezies")), origin_tag])
		lines.append("   Rolle: [color=#38bdf8]%s[/color]" % str(c.get("role", "Offizier")))
		if str(c.get("buffDesc", "")) != "":
			lines.append("   Synergie: [color=#34d399]%s[/color]" % str(c.get("buffDesc", "")))
		lines.append("")
	dossier_body_label.text = "\n".join(lines)

	var btn_repair := Button.new()
	btn_repair.text = "🛡️ Chitin-Hülle reparieren (+30% ❤️ Hülle  —  Kosten: 5 🛡️ Legierungen)"
	btn_repair.pressed.connect(func():
		GameState.repair_hull_with_alloys()
		_render_crew_panel()
	)
	dossier_action_box.add_child(btn_repair)

	if GameState.shuttle_unlocked and GameState.shuttle_hull < GameState.shuttle_max_hull:
		var btn_shuttle_rep := Button.new()
		btn_shuttle_rep.text = "🚀 Ar-Riḥla Shuttle reparieren (100% Hülle  —  Kosten: 8 🛡️ Legierungen)"
		btn_shuttle_rep.pressed.connect(func():
			GameState.repair_shuttle_with_alloys()
			_render_crew_panel()
		)
		dossier_action_box.add_child(btn_shuttle_rep)

	var btn_food := Button.new()
	btn_food.text = "⚡ Nährstoff-Schub (+40% ⚡ Bio-Energie  —  Kosten: 8 🍖 Nahrung)"
	btn_food.pressed.connect(func():
		GameState.synthesize_bio_energy_from_food()
		_render_crew_panel()
	)
	dossier_action_box.add_child(btn_food)

	var btn_psi := Button.new()
	btn_psi.text = "☕ Qahwun-Aufguss & Katharsis (+ 🧠 Mental & - Einsamkeit  —  5 ☕ Qahwun oder 6 💧 + 10 🌿)"
	btn_psi.pressed.connect(func():
		GameState.perform_psionic_catharsis()
		_render_crew_panel()
	)
	dossier_action_box.add_child(btn_psi)

func _render_evolution_panel() -> void:
	if not dossier_panel:
		return
	dossier_panel.visible = true
	_clear_action_box()

	dossier_title_label.text = "🧬 BIO-EVOLUTION & MUTATIONEN [U]  •  ☢️ Schutz: %.0f%%" % (GameState.radiation_resistance * 100.0)
	var lines: Array[String] = [
		"Verstärke Najmafars Organismus dauerhaft mit [b]🌿 Biomasse[/b], [b]💎 Silizium[/b] & [b]⚙️ Tech[/b]:",
		""
	]

	for mut_id in GameState.mutations.keys():
		var m: Dictionary = GameState.mutations[mut_id]
		var bought: bool = bool(m.get("purchased", false))
		var m_name: String = str(m.get("name", mut_id))
		var m_desc: String = str(m.get("desc", ""))
		var b_cost: int = int(m.get("bioCost", 0))
		var s_cost: int = int(m.get("siliconCost", 0))
		var t_cost: int = int(m.get("techCost", 0))
		var cost_str: String = "%d 🌿 Bio, %d 💎 Sil%s" % [b_cost, s_cost, (", %d ⚙️ Tech" % t_cost) if t_cost > 0 else ""]

		if bought:
			lines.append("✅ [color=#34d399][b]%s[/b] (AKTIVIERT)[/color]\n   %s" % [m_name, m_desc])
		else:
			lines.append("🧬 [b]%s[/b]  —  [color=#fbbf24]Kosten: %s[/color]\n   %s" % [m_name, cost_str, m_desc])
			var btn := Button.new()
			var can_afford: bool = (GameState.bio_res >= b_cost and GameState.silicon_res >= s_cost and GameState.tech_res >= t_cost)
			btn.disabled = not can_afford
			btn.text = "Mutieren: %s (%s)" % [m_name, cost_str]
			var id_copy: String = str(mut_id)
			btn.pressed.connect(func():
				if GameState.buy_mutation(id_copy):
					_render_evolution_panel()
			)
			dossier_action_box.add_child(btn)

	dossier_body_label.text = "\n".join(lines)

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

	radar_canvas.draw_circle(center, radius, Color(0.02, 0.06, 0.12, 0.78))
	radar_canvas.draw_arc(center, radius, 0.0, TAU, 64, Color(0.22, 0.74, 0.98, 0.45), 1.8)
	radar_canvas.draw_arc(center, radius * 0.66, 0.0, TAU, 48, Color(0.22, 0.74, 0.98, 0.16), 1.0)
	radar_canvas.draw_arc(center, radius * 0.33, 0.0, TAU, 32, Color(0.22, 0.74, 0.98, 0.16), 1.0)

	radar_canvas.draw_circle(center, 5.5, Color(1.0, 0.84, 0.2, 0.95))

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

	if world_mgr and world_mgr.get("active_hostiles") != null:
		var hostiles: Array = world_mgr.get("active_hostiles")
		for h in hostiles:
			if is_instance_valid(h) and h is Node3D:
				var h_node: Node3D = h as Node3D
				var h_2d := Vector2(h_node.global_position.x, h_node.global_position.z) / world_range * radius
				if h_2d.length() > radius - 4.0:
					h_2d = h_2d.normalized() * (radius - 4.0)
				var stunned: bool = bool(h_node.call("is_stunned")) if h_node.has_method("is_stunned") else false
				var h_col := Color(0.55, 0.72, 1.0, 0.95) if stunned else Color(1.0, 0.22, 0.22, 0.95)
				radar_canvas.draw_circle(center + h_2d, 3.2, h_col)
				radar_canvas.draw_arc(center + h_2d, 5.4, 0.0, TAU, 16, Color(h_col.r, h_col.g, h_col.b, 0.7), 1.3)

	var player: Node3D = get_tree().get_first_node_in_group("player_ship") as Node3D
	if player:
		var p_pos := Vector2(player.global_position.x, player.global_position.z) / world_range * radius
		if p_pos.length() > radius - 4.0:
			p_pos = p_pos.normalized() * (radius - 4.0)
		radar_canvas.draw_circle(center + p_pos, 4.0, Color(0.0, 1.0, 0.55, 1.0))
		if player.has_method("get_forward_dir"):
			var fwd_3d: Vector3 = player.call("get_forward_dir")
			var fwd_2d := Vector2(fwd_3d.x, fwd_3d.z).normalized() * 8.5
			radar_canvas.draw_line(center + p_pos, center + p_pos + fwd_2d, Color(0.45, 1.0, 0.8, 0.9), 1.6)

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
			_switch_deck_tab("crew")
		elif key_event.keycode == KEY_U:
			_switch_deck_tab("evolution")
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
	var rad_badge: String = ("  |  ☢️ %.0f%%" % (GameState.effective_radiation * 100.0)) if GameState.effective_radiation > 0.05 else ""
	var shuttle_badge: String = "  |  🚀 Ar-Riḥla ✓" if GameState.shuttle_unlocked else "  |  🔒 Kein Shuttle"
	vitals_label.text = "🪐 %s  |  ❤️ %.0f/%.0f  ⚡ %.0f%%  🧠 %.0f%%  😌 %.0f%%%s  |  🌿 %d Bio  💎 %d Sil  💧 %d H2O  🍖 %d Food  🛡️ %d Leg  ⚙️ %d Tech  ☕ %d Qahwun  |  👥 %d/%d%s" % [
		sys.get("name", "Perseus-Rand"),
		GameState.health,
		GameState.max_health,
		GameState.bio_energy,
		GameState.mental_energy,
		GameState.loneliness,
		rad_badge,
		GameState.bio_res,
		GameState.silicon_res,
		GameState.water_res,
		GameState.food_res,
		GameState.alloy_res,
		GameState.tech_res,
		GameState.melange_res,
		GameState.crew.size(),
		GameState.max_crew_capacity,
		shuttle_badge
	]
	directive_label.text = QuestManager.get_active_quest_directive_text()

func _update_proximity_prompt() -> void:
	if QuestManager.is_dialogue_open:
		target_prompt_label.text = "💬 Dialog aktiv (Tasten [1]-[3] oder Mausklick)"
		return

	var player: Node3D = get_tree().get_first_node_in_group("player_ship") as Node3D
	var world_mgr: Node = get_tree().current_scene
	if player and world_mgr and world_mgr.get("active_hostiles") != null:
		var hostiles: Array = world_mgr.get("active_hostiles")
		var hostile_count: int = 0
		var nearest_h_dist: float = INF
		var nearest_h_stunned: bool = false
		for h in hostiles:
			if is_instance_valid(h) and h is Node3D:
				hostile_count += 1
				var hd: float = player.global_position.distance_to((h as Node3D).global_position)
				if hd < nearest_h_dist:
					nearest_h_dist = hd
					nearest_h_stunned = bool((h as Node3D).call("is_stunned")) if (h as Node3D).has_method("is_stunned") else false
		if hostile_count > 0 and nearest_h_dist <= 100.0:
			var stun_tag: String = " • ⚡ BETÄUBT" if nearest_h_stunned else ""
			target_prompt_label.text = "⚔️ %d FEIND-DROHNE(N) (Nächste: %.1f AE%s)  |  🔮 [X]/[Leertaste] Psi-Kegel (-10⚡ -6🧠)  |  [K] +Test-Drohnen" % [hostile_count, nearest_h_dist, stun_tag]
			return

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
					target_prompt_label.text = "🎯 %s (%.1f AE)  —  🛰️ [F] Spektral-Scan  |  🔮 [X] Psi-Kegel  [K] Kampf-Test" % [d_name, dist]
				else:
					var harv_str: String = "🔴 [Orbital erschöpft]" if depleted else "🌿 [E] Orbital-Siphon (-10⚡)"
					var cand_cnt: int = 0
					if GameState.planet_dossiers.has(p_key):
						cand_cnt = (GameState.planet_dossiers[p_key].get("candidates", []) as Array).size()
					var abd_str: String = ("  |  🔮 [R] Entführen (%d)" % cand_cnt) if cand_cnt > 0 else ""
					target_prompt_label.text = "🎯 %s (%.1f AE)  —  %s%s  |  📋 [F] Dossier  [X] Psi-Kegel  [U] Evolution" % [d_name, dist, harv_str, abd_str]
			else:
				target_prompt_label.text = "🎯 %s (%.1f AE)  —  [F] Untersuchen / Kommunizieren  |  🔮 [X]/[Leertaste] Psi-Kegel (-10⚡ -6🧠)" % [d_name, dist]
		else:
			target_prompt_label.text = "🧭 %s (%.1f AE)  |  [WASD] Fliegen  [X]/[Space] Psi-Kegel  [K] Kampf-Test  [V] Kurslinie  [M] Karte" % [d_name, dist]
	else:
		target_prompt_label.text = "[WASD] Fliegen  |  [X]/[Leertaste] Psi-Kegel  [K] Kampf-Test  |  [F] Scannen  [E] Ernten  [R] Entführen  [M] Karte"

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

	# Prioritize Quest Target (INSAN Depot #77), Current System, and Key Lore Systems at top of list
	var featured_list: Array[Dictionary] = []
	var other_list: Array[Dictionary] = []
	for sys in GameState.systems:
		if typeof(sys) != TYPE_DICTIONARY:
			continue
		var sid: int = int(sys.get("id", -1))
		var sname: String = str(sys.get("name", ""))
		var is_dep: bool = bool(sys.get("isInsanDepot", false)) or sname.contains("INSAN")
		if is_dep or sid in [1, 2, 3, 4, 0, GameState.current_system_id]:
			featured_list.append(sys)
		elif other_list.size() < 30:
			other_list.append(sys)

	var display_list: Array[Dictionary] = []
	for s in featured_list:
		display_list.append(s)
	for s in other_list:
		display_list.append(s)

	for sys in display_list:
		var sys_id: int = int(sys.get("id", 0))
		var sys_name: String = String(sys.get("name", "System"))
		var is_depot: bool = bool(sys.get("isInsanDepot", false)) or sys_name.contains("INSAN")
		var is_cur: bool = (sys_id == GameState.current_system_id)

		var btn := Button.new()
		var quest_badge := " 🔶 [QUEST-ZIEL: AR-RIḤLA]" if is_depot else ""
		var cur_badge := " 📍 [AKTUELLES SYSTEM]" if is_cur else " (Kosten: 20⚡, 15🧠)"
		btn.text = "#%d  %s (%s)%s%s" % [sys_id, sys_name, sys.get("sectorName", "Sektor"), quest_badge, cur_badge]
		btn.disabled = is_cur
		btn.alignment = HORIZONTAL_ALIGNMENT_LEFT
		btn.pressed.connect(func():
			galaxy_map_panel.visible = false
			GameState.warp_to_system(sys_id)
		)
		map_systems_list.add_child(btn)
