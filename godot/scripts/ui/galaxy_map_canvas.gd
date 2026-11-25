extends Control
class_name GalaxyMapCanvas

## Interactive 2D Galactic Star Map Canvas for Project Najmafar (Godot 4.6)
## Renders all 1,000 star systems on their real (x, z) coordinates from Outer Rim to Sagittarius A*,
## with zoom-to-cursor, drag panning, sector rings, fold vector line, hover telemetry & double-click warp.

signal system_selected(sys_id: int)
signal system_activated(sys_id: int)

var star_entries: Array[Dictionary] = []
var entry_by_id: Dictionary = {}
var visible_ids_map: Dictionary = {}

var current_sys_id: int = 1
var selected_sys_id: int = 1
var hovered_sys_id: int = -1

var cam_center: Vector2 = Vector2.ZERO
var zoom_level: float = 1.0
var is_panning: bool = false
var drag_moved_px: float = 0.0
var pulse_time: float = 0.0

func _ready() -> void:
	clip_contents = true
	mouse_filter = Control.MOUSE_FILTER_STOP
	focus_mode = Control.FOCUS_CLICK

func _process(delta: float) -> void:
	if is_visible_in_tree():
		pulse_time += delta
		queue_redraw()

func setup_entries(entries: Array[Dictionary]) -> void:
	star_entries = entries
	entry_by_id.clear()
	for e in star_entries:
		var sid: int = int(e.get("id", -1))
		entry_by_id[sid] = e
	queue_redraw()

func set_filtered_ids(ids: Dictionary) -> void:
	visible_ids_map = ids
	queue_redraw()

func set_current_and_selected(cur_id: int, sel_id: int) -> void:
	current_sys_id = cur_id
	selected_sys_id = sel_id
	queue_redraw()

func set_selected_system(sys_id: int, pan_to: bool = false) -> void:
	selected_sys_id = sys_id
	if pan_to and entry_by_id.has(sys_id):
		var e: Dictionary = entry_by_id[sys_id]
		cam_center = Vector2(float(e.get("x", 0.0)), float(e.get("z", 0.0)))
		if zoom_level < 1.35:
			zoom_level = 1.65
	queue_redraw()

func center_on_system(sys_id: int, target_zoom: float = -1.0) -> void:
	if entry_by_id.has(sys_id):
		var e: Dictionary = entry_by_id[sys_id]
		cam_center = Vector2(float(e.get("x", 0.0)), float(e.get("z", 0.0)))
		if target_zoom > 0.0:
			zoom_level = clamp(target_zoom, 0.58, 9.0)
		queue_redraw()

func reset_full_galaxy_view() -> void:
	cam_center = Vector2.ZERO
	zoom_level = 1.0
	queue_redraw()

func get_scale_px() -> float:
	var min_dim: float = max(240.0, min(size.x, size.y))
	return (min_dim / 1010.0) * zoom_level

func world_to_screen(wx: float, wz: float) -> Vector2:
	var half_sz: Vector2 = size * 0.5
	return half_sz + (Vector2(wx, wz) - cam_center) * get_scale_px()

func screen_to_world(sp: Vector2) -> Vector2:
	var half_sz: Vector2 = size * 0.5
	var sc: float = max(0.001, get_scale_px())
	return cam_center + (sp - half_sz) / sc

func _zoom_at_point(factor: float, pivot_screen: Vector2) -> void:
	var world_before: Vector2 = screen_to_world(pivot_screen)
	zoom_level = clamp(zoom_level * factor, 0.58, 9.0)
	var world_after: Vector2 = screen_to_world(pivot_screen)
	cam_center += (world_before - world_after)
	cam_center.x = clamp(cam_center.x, -520.0, 520.0)
	cam_center.y = clamp(cam_center.y, -520.0, 520.0)
	queue_redraw()

func _pick_star_at(screen_pos: Vector2) -> int:
	var best_match_id: int = -1
	var best_match_dist: float = 14.0
	var best_dim_id: int = -1
	var best_dim_dist: float = 9.0

	for e in star_entries:
		var sid: int = int(e.get("id", -1))
		var sp: Vector2 = world_to_screen(float(e.get("x", 0.0)), float(e.get("z", 0.0)))
		if sp.x < -16.0 or sp.y < -16.0 or sp.x > size.x + 16.0 or sp.y > size.y + 16.0:
			continue
		var d: float = sp.distance_to(screen_pos)
		var is_vis: bool = visible_ids_map.is_empty() or visible_ids_map.has(sid)
		if is_vis:
			if d < best_match_dist:
				best_match_dist = d
				best_match_id = sid
		else:
			if d < best_dim_dist:
				best_dim_dist = d
				best_dim_id = sid

	if best_match_id != -1:
		return best_match_id
	return best_dim_id

func _gui_input(event: InputEvent) -> void:
	if event is InputEventMouseButton:
		var mb: InputEventMouseButton = event as InputEventMouseButton
		if mb.button_index == MOUSE_BUTTON_WHEEL_UP and mb.pressed:
			_zoom_at_point(1.16, mb.position)
			accept_event()
			return
		elif mb.button_index == MOUSE_BUTTON_WHEEL_DOWN and mb.pressed:
			_zoom_at_point(1.0 / 1.16, mb.position)
			accept_event()
			return
		elif mb.button_index in [MOUSE_BUTTON_LEFT, MOUSE_BUTTON_RIGHT, MOUSE_BUTTON_MIDDLE]:
			if mb.pressed:
				is_panning = true
				drag_moved_px = 0.0
				if mb.button_index == MOUSE_BUTTON_LEFT and mb.double_click:
					var hit_dbl: int = _pick_star_at(mb.position)
					if hit_dbl != -1:
						selected_sys_id = hit_dbl
						system_selected.emit(hit_dbl)
						system_activated.emit(hit_dbl)
						is_panning = false
				accept_event()
				return
			else:
				var was_click: bool = is_panning and drag_moved_px < 6.0 and mb.button_index == MOUSE_BUTTON_LEFT
				is_panning = false
				if was_click:
					var hit_id: int = _pick_star_at(mb.position)
					if hit_id != -1:
						selected_sys_id = hit_id
						system_selected.emit(hit_id)
						queue_redraw()
				accept_event()
				return

	elif event is InputEventMagnifyGesture:
		var mag: InputEventMagnifyGesture = event as InputEventMagnifyGesture
		_zoom_at_point(clamp(mag.factor, 0.75, 1.35), mag.position)
		accept_event()
		return

	elif event is InputEventPanGesture:
		var pan: InputEventPanGesture = event as InputEventPanGesture
		var sc: float = max(0.001, get_scale_px())
		cam_center += pan.delta * (14.0 / sc)
		cam_center.x = clamp(cam_center.x, -520.0, 520.0)
		cam_center.y = clamp(cam_center.y, -520.0, 520.0)
		queue_redraw()
		accept_event()
		return

	elif event is InputEventMouseMotion:
		var mm: InputEventMouseMotion = event as InputEventMouseMotion
		if is_panning:
			drag_moved_px += mm.relative.length()
			var sc_pan: float = max(0.001, get_scale_px())
			cam_center -= mm.relative / sc_pan
			cam_center.x = clamp(cam_center.x, -520.0, 520.0)
			cam_center.y = clamp(cam_center.y, -520.0, 520.0)
			queue_redraw()
		else:
			var new_hover: int = _pick_star_at(mm.position)
			if new_hover != hovered_sys_id:
				hovered_sys_id = new_hover
				queue_redraw()
		accept_event()

func _draw() -> void:
	var rect := Rect2(Vector2.ZERO, size)
	draw_rect(rect, Color(0.015, 0.032, 0.075, 0.98), true)

	var font: Font = get_theme_default_font()
	var sc: float = get_scale_px()
	var origin_sp: Vector2 = world_to_screen(0.0, 0.0)
	var pulse: float = 0.5 + 0.5 * sin(pulse_time * 4.2)

	# 1. Subtle coordinate axes & 3 Concentric Galactic Sector Rings around Sagittarius A* (0, 0)
	draw_line(Vector2(0.0, origin_sp.y), Vector2(size.x, origin_sp.y), Color(0.22, 0.45, 0.68, 0.10), 1.0)
	draw_line(Vector2(origin_sp.x, 0.0), Vector2(origin_sp.x, size.y), Color(0.22, 0.45, 0.68, 0.10), 1.0)

	var r_core: float = 110.0 * sc
	var r_mid: float = 265.0 * sc
	var r_outer: float = 475.0 * sc
	draw_circle(origin_sp, r_core, Color(0.45, 0.18, 0.85, 0.045))
	draw_arc(origin_sp, r_core, 0.0, TAU, 96, Color(0.68, 0.36, 1.0, 0.30), 1.4)
	draw_arc(origin_sp, r_mid, 0.0, TAU, 128, Color(0.22, 0.74, 0.98, 0.22), 1.3)
	draw_arc(origin_sp, r_outer, 0.0, TAU, 160, Color(0.32, 0.58, 0.78, 0.20), 1.3)

	if font:
		draw_string(font, origin_sp + Vector2(-58.0, -r_core + 14.0), "Galaktischer Kern", HORIZONTAL_ALIGNMENT_LEFT, -1.0, 11, Color(0.76, 0.54, 1.0, 0.55))
		draw_string(font, origin_sp + Vector2(-52.0, -r_mid + 14.0), "Mittlerer Gürtel", HORIZONTAL_ALIGNMENT_LEFT, -1.0, 11, Color(0.38, 0.82, 1.0, 0.48))
		draw_string(font, origin_sp + Vector2(-56.0, -r_outer + 14.0), "Äußerer Spiralarm", HORIZONTAL_ALIGNMENT_LEFT, -1.0, 11, Color(0.55, 0.75, 0.92, 0.45))

	# 2. Fold Vector Line between Current System and Selected Target System
	var cur_wx: float = 0.0
	var cur_wz: float = 0.0
	var has_cur: bool = entry_by_id.has(current_sys_id)
	if has_cur:
		var ce: Dictionary = entry_by_id[current_sys_id]
		cur_wx = float(ce.get("x", 0.0))
		cur_wz = float(ce.get("z", 0.0))

	if has_cur and selected_sys_id != current_sys_id and entry_by_id.has(selected_sys_id):
		var se: Dictionary = entry_by_id[selected_sys_id]
		var sel_wx: float = float(se.get("x", 0.0))
		var sel_wz: float = float(se.get("z", 0.0))
		var p_from: Vector2 = world_to_screen(cur_wx, cur_wz)
		var p_to: Vector2 = world_to_screen(sel_wx, sel_wz)
		draw_line(p_from, p_to, Color(0.28, 0.88, 1.0, 0.22), 4.0)
		draw_dashed_line(p_from, p_to, Color(0.45, 0.95, 1.0, 0.85), 1.8, 7.0)
		if font:
			var dist_ly: float = Vector2(cur_wx, cur_wz).distance_to(Vector2(sel_wx, sel_wz))
			var mid_pt: Vector2 = (p_from + p_to) * 0.5
			draw_rect(Rect2(mid_pt + Vector2(-34.0, -18.0), Vector2(68.0, 18.0)), Color(0.02, 0.06, 0.14, 0.88), true)
			draw_string(font, mid_pt + Vector2(-28.0, -5.0), "%.0f Lj" % dist_ly, HORIZONTAL_ALIGNMENT_LEFT, -1.0, 11, Color(0.55, 0.95, 1.0, 0.98))

	# 3. Render all 1,000 Star Systems
	var base_dot_r: float = clamp(1.75 + zoom_level * 0.42, 1.9, 5.2)
	var filter_empty: bool = visible_ids_map.is_empty()

	for e in star_entries:
		var sid: int = int(e.get("id", -1))
		var wx: float = float(e.get("x", 0.0))
		var wz: float = float(e.get("z", 0.0))
		var sp: Vector2 = world_to_screen(wx, wz)
		if sp.x < -20.0 or sp.y < -20.0 or sp.x > size.x + 20.0 or sp.y > size.y + 20.0:
			continue

		var matched: bool = filter_empty or visible_ids_map.has(sid)
		var scol: Color = e.get("color", Color(0.75, 0.85, 1.0)) as Color
		var alpha: float = 0.90 if matched else 0.12
		var r: float = base_dot_r if matched else (base_dot_r * 0.78)

		var is_visited: bool = GameState.visited_system_ids.has(sid)
		var is_depot: bool = bool(e.get("is_depot", false))
		var is_lore: bool = bool(e.get("is_lore", false))
		var is_core_anchor: bool = bool(e.get("is_core_anchor", false))

		if is_core_anchor:
			draw_circle(sp, r * 2.5, Color(0.58, 0.22, 1.0, 0.35 * alpha))
			draw_circle(sp, r * 1.45, Color(0.88, 0.65, 1.0, alpha))
			draw_arc(sp, r * 2.9 + pulse * 2.0, 0.0, TAU, 24, Color(0.75, 0.42, 1.0, 0.85 * alpha), 1.6)
		else:
			if matched and zoom_level >= 1.6:
				draw_circle(sp, r * 1.9, Color(scol.r, scol.g, scol.b, 0.16))
			draw_circle(sp, r, Color(scol.r, scol.g, scol.b, alpha))

		if is_visited and sid != current_sys_id:
			draw_arc(sp, r + 2.6, 0.0, TAU, 16, Color(0.2, 0.95, 0.65, 0.72 if matched else 0.25), 1.3)

		if is_depot:
			var dep_r: float = r + 4.5 + pulse * 2.5
			draw_arc(sp, dep_r, 0.0, TAU, 20, Color(1.0, 0.68, 0.12, 0.95), 2.0)
			if font:
				draw_string(font, sp + Vector2(dep_r + 4.0, 4.0), "🔶 INSAN-Depot", HORIZONTAL_ALIGNMENT_LEFT, -1.0, 11, Color(1.0, 0.76, 0.22, 0.96))
		elif is_lore and matched and (zoom_level >= 0.95 or sid == 0):
			draw_arc(sp, r + 3.0, 0.0, TAU, 16, Color(0.45, 0.85, 1.0, 0.65), 1.2)
			if font and zoom_level >= 1.15:
				var short_name: String = str(e.get("short_label", e.get("name", "")))
				draw_string(font, sp + Vector2(r + 5.0, 4.0), short_name, HORIZONTAL_ALIGNMENT_LEFT, -1.0, 11, Color(0.78, 0.90, 1.0, 0.82))
		elif matched and zoom_level >= 3.2 and font:
			draw_string(font, sp + Vector2(r + 4.0, 3.0), "#%d %s" % [sid, str(e.get("name", ""))], HORIZONTAL_ALIGNMENT_LEFT, -1.0, 10, Color(0.75, 0.84, 0.95, 0.72))

	# 4. Highlight Hovered, Selected, and Current Player System on top
	if hovered_sys_id != -1 and entry_by_id.has(hovered_sys_id):
		var he: Dictionary = entry_by_id[hovered_sys_id]
		var hsp: Vector2 = world_to_screen(float(he.get("x", 0.0)), float(he.get("z", 0.0)))
		draw_arc(hsp, base_dot_r + 5.5, 0.0, TAU, 20, Color(1.0, 1.0, 1.0, 0.85), 1.5)

	if entry_by_id.has(selected_sys_id):
		var se2: Dictionary = entry_by_id[selected_sys_id]
		var ssp: Vector2 = world_to_screen(float(se2.get("x", 0.0)), float(se2.get("z", 0.0)))
		var sel_r: float = base_dot_r + 6.5 + pulse * 1.8
		draw_arc(ssp, sel_r, 0.0, TAU, 24, Color(0.25, 0.92, 1.0, 0.98), 2.0)
		draw_line(ssp + Vector2(-sel_r - 4.0, 0.0), ssp + Vector2(-sel_r + 2.0, 0.0), Color(0.25, 0.92, 1.0, 0.95), 1.6)
		draw_line(ssp + Vector2(sel_r - 2.0, 0.0), ssp + Vector2(sel_r + 4.0, 0.0), Color(0.25, 0.92, 1.0, 0.95), 1.6)

	if has_cur:
		var csp: Vector2 = world_to_screen(cur_wx, cur_wz)
		var cur_r: float = base_dot_r + 4.2 + pulse * 2.2
		draw_circle(csp, base_dot_r + 1.5, Color(0.0, 1.0, 0.58, 1.0))
		draw_arc(csp, cur_r, 0.0, TAU, 24, Color(0.0, 1.0, 0.58, 0.95), 2.2)
		if font:
			draw_string(font, csp + Vector2(cur_r + 5.0, 4.0), "📍 Najmafar", HORIZONTAL_ALIGNMENT_LEFT, -1.0, 12, Color(0.25, 1.0, 0.68, 1.0))

	# 5. Hover Telemetry Banner (top-left) & Controls Hint (bottom-left)
	if font and hovered_sys_id != -1 and entry_by_id.has(hovered_sys_id):
		var h_info: Dictionary = entry_by_id[hovered_sys_id]
		var h_dist: float = Vector2(cur_wx, cur_wz).distance_to(Vector2(float(h_info.get("x", 0.0)), float(h_info.get("z", 0.0))))
		var h_text: String = "#%d  %s  •  %s  •  %.0f Lj  (%d Planeten)" % [
			hovered_sys_id,
			str(h_info.get("name", "System")),
			str(h_info.get("sector_name", "Sektor")),
			h_dist,
			int(h_info.get("planets_count", 0))
		]
		var box_w: float = min(size.x - 20.0, float(h_text.length()) * 6.8 + 22.0)
		draw_rect(Rect2(Vector2(10.0, 10.0), Vector2(box_w, 26.0)), Color(0.03, 0.08, 0.16, 0.92), true)
		draw_rect(Rect2(Vector2(10.0, 10.0), Vector2(box_w, 26.0)), Color(0.25, 0.82, 1.0, 0.55), false, 1.2)
		draw_string(font, Vector2(18.0, 27.0), h_text, HORIZONTAL_ALIGNMENT_LEFT, box_w - 14.0, 12, Color(0.92, 0.97, 1.0, 1.0))

	if font:
		var hint_rect := Rect2(Vector2(10.0, size.y - 30.0), Vector2(size.x - 20.0, 22.0))
		draw_rect(hint_rect, Color(0.02, 0.05, 0.11, 0.80), true)
		var zoom_txt: String = "🖱️ Scroll/Pinch: Zoom (%.1fx)  •  Ziehen: Verschieben  •  Klick: Auswahl  •  Doppelklick: Raumfalten" % zoom_level
		draw_string(font, Vector2(16.0, size.y - 14.0), zoom_txt, HORIZONTAL_ALIGNMENT_LEFT, size.x - 32.0, 11, Color(0.68, 0.80, 0.94, 0.90))

	draw_rect(rect, Color(0.28, 0.62, 0.92, 0.42), false, 1.5)
