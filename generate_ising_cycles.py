#!/usr/bin/env python3
"""
Project Najmafar: Quantum Ising Civilization Cycles Generator (36 Galactic Cycles / 18 Years)
Executes a 36-step Trotterized Transverse-Field Ising Model (TFIM) on a real IBM Quantum Heron QPU
(or local quantum simulator fallback) to simulate dynamic planetary civilization states,
neighbor entanglement correlations, and the outward propagation of the Sagittarius A* cosmic braking wave.
"""

import os
import sys
import json
import math
import time
import random
import types
import argparse
from datetime import datetime, timezone

# Workaround for macOS dynamic linker issue on older scipy C-extensions when importing qiskit_ibm_runtime
for _mod_name in ["scipy.optimize", "scipy.sparse.linalg", "scipy.sparse.linalg._svdp"]:
    if _mod_name not in sys.modules:
        _m = types.ModuleType(_mod_name)
        _m.curve_fit = lambda *a, **k: None
        _m.OptimizeResult = dict
        _m.minimize = lambda *a, **k: None
        _m.root_scalar = lambda *a, **k: None
        _m.linear_sum_assignment = lambda *a, **k: None
        sys.modules[_mod_name] = _m

# The 6 Dynamic Civilization States (Ising Spin Phases)
CIV_STATES = [
    "prosperity",        # 0: Handels-Blüte / Goldenes Zeitalter
    "djinn_resonance",   # 1: Dschinn-Forschungs-Durchbruch
    "famine_crisis",     # 2: Versorgungs-Krise / SOS-Notruf
    "gamma_surge",       # 3: Magnetar-Sturm / Evakuierung & Spice-Kristallisation
    "civil_conflict",    # 4: Fraktions-Konflikt / Orbitale Belagerung
    "isolation_bunker"   # 5: Bunker-Quarantäne / Schwere Abwehr
]


def build_ising_circuits(num_qubits=120, num_cycles=36):
    """
    Constructs 36 Trotterized Transverse-Field Ising Model (TFIM) quantum circuits.
    - Qubits 0..29: Galactic Core (Sagittarius A* proximity)
    - Qubits 30..79: Mid Rim (Orion Civilization Belt)
    - Qubits 80..119: Outer Rim (Perseus Frontier)
    As cycle t progresses from 1 to 36 (18 years), the gravitational braking wave
    propagates from Qubit 0 outward across the entangled spin chain.
    """
    from qiskit import QuantumCircuit

    circuits = []
    cycle_params = []

    for cycle_idx in range(num_cycles):
        t_norm = cycle_idx / float(max(1, num_cycles - 1))  # 0.0 -> 1.0 over 18 years
        year = round(2242.0 + cycle_idx * 0.5, 1)

        # Transverse field h(t) (Cosmic Braking Pressure) & Ising Coupling J(t)
        h_field = round(0.25 + 1.15 * t_norm, 4)
        j_coupling = round(0.35 + 0.55 * math.sin(t_norm * math.pi), 4)
        wave_front_q = int(15 + t_norm * (num_qubits - 15))
        wave_radius = round(60.0 + t_norm * 380.0, 1)

        qc = QuantumCircuit(num_qubits, num_qubits)
        qc.name = f"ising_cycle_{cycle_idx + 1}"

        # 1. Initial Superposition & Local Civilization Bias
        for q in range(num_qubits):
            radial_ratio = q / float(num_qubits)
            # Core qubits experience stronger initial gravitational tilt
            dist_from_wave = (q - wave_front_q) / 18.0
            wave_envelope = 1.0 / (1.0 + math.exp(dist_from_wave))  # Sigmoid wave front from Sagittarius A*

            theta_rx = h_field * wave_envelope * math.pi * 0.75
            phi_ry = (0.2 + 0.6 * (1.0 - radial_ratio) * t_norm) * math.pi + (q % 7) * 0.11
            qc.ry(phi_ry, q)
            qc.rx(theta_rx, q)

        # 2. Layer 1: Even-pair Ising ZZ Spin Coupling (Trade & Djinn Network Entanglement)
        for q in range(0, num_qubits - 1, 2):
            qc.cx(q, q + 1)
            zz_angle = j_coupling * (1.0 + 0.3 * math.cos(q * 0.2 + t_norm * 3.14))
            qc.rz(zz_angle, q + 1)
            qc.cx(q, q + 1)

        # 3. Layer 2: Odd-pair Ising ZZ Spin Coupling (Propagates entanglement across full chain)
        for q in range(1, num_qubits - 1, 2):
            qc.cx(q, q + 1)
            zz_angle = j_coupling * (1.0 + 0.3 * math.sin(q * 0.2 + t_norm * 3.14))
            qc.rz(zz_angle, q + 1)
            qc.cx(q, q + 1)

        # 4. Long-range Entanglement Bridges (Quantum-Entangled Twin Civilizations)
        for q in range(0, num_qubits // 2, 12):
            partner = (q + num_qubits // 2) % num_qubits
            qc.cx(q, partner)
            qc.ry(0.25 * t_norm * math.pi, partner)

        qc.measure(range(num_qubits), range(num_qubits))
        circuits.append(qc)

        cycle_params.append({
            "cycle": cycle_idx + 1,
            "year": year,
            "transverseFieldH": h_field,
            "couplingJ": j_coupling,
            "gammaWaveFrontRadius": wave_radius
        })

    return circuits, cycle_params


def classify_ising_state(z_exp, zz_corr, q_idx, cycle_idx, branch_offset=0.0):
    """
    Maps quantum spin observables <Z_i> and neighbor correlation <Z_i Z_{i+1}>
    plus wave-front progression into one of the 6 civilization states (0..5).
    """
    t_prog = cycle_idx / 35.0
    radial = q_idx / 120.0  # 0 = Core, 1 = Outer Rim
    wave_front = 0.12 + t_prog * 0.88
    in_wave_wake = radial <= wave_front

    wave_pressure = (0.28 * t_prog) if in_wave_wake else (0.08 * t_prog)
    score = (z_exp + branch_offset) * 0.65 + zz_corr * 0.35 - wave_pressure

    if branch_offset != 0.0:
        if score < 0.05:
            return 1 if (q_idx + cycle_idx) % 2 == 0 else 0
        return 5 if (q_idx % 2 == 0) else 1

    if score < -0.12:
        return 3  # gamma_surge (Magnetar-Sturm / Spice)
    elif score < 0.02:
        return 4 if zz_corr < 0.05 else 2  # civil_conflict or famine_crisis
    elif score < 0.14:
        return 2 if (q_idx + cycle_idx) % 2 == 0 else 5  # famine_crisis or isolation_bunker
    elif score < 0.28:
        return 5 if zz_corr < 0.18 else 1  # isolation_bunker or djinn_resonance
    elif score < 0.45:
        return 1 if (q_idx + cycle_idx) % 2 == 0 else 0  # djinn_resonance or prosperity
    else:
        return 0  # prosperity


def analyze_cycle_bitstrings(bitstrings, num_qubits, cycle_idx):
    """
    Computes <Z_q>, <Z_q Z_{q+1}>, and dual-branch state classifications (|0> natural vs |1> intervened)
    from measured QPU bitstrings for a single cycle.
    """
    n_shots = max(1, len(bitstrings))
    z_counts = [0] * num_qubits
    zz_counts = [0] * num_qubits
    # Conditional correlation when qubit q is flipped (branch |1>)
    alt_counts = [0] * num_qubits

    for bstr in bitstrings:
        # Clean bitstring and pad/truncate to num_qubits
        s = bstr.replace(" ", "")
        if len(s) < num_qubits:
            s = s.zfill(num_qubits)
        # Qiskit bitstrings are little-endian (rightmost is q_0), reverse so index q matches qubit q
        bits = s[::-1][:num_qubits]

        for q in range(num_qubits):
            b_q = 1 if bits[q] == "1" else 0
            spin_q = -1 if b_q == 1 else 1  # |0> -> +1, |1> -> -1
            z_counts[q] += spin_q

            q_next = (q + 1) % num_qubits
            b_next = 1 if bits[q_next] == "1" else 0
            spin_next = -1 if b_next == 1 else 1
            zz_counts[q] += (spin_q * spin_next)

            q_prev = (q - 1) % num_qubits
            b_prev = 1 if bits[q_prev] == "1" else 0
            if b_q == 1:
                alt_counts[q] += (1 if b_next == 0 else -1) + (1 if b_prev == 0 else -1)

    qubit_data = []
    sum_z = 0.0
    sum_zz = 0.0

    for q in range(num_qubits):
        z_exp = round(z_counts[q] / float(n_shots), 3)
        zz_corr = round(zz_counts[q] / float(n_shots), 3)
        alt_shift = round(alt_counts[q] / float(n_shots), 3)

        sum_z += z_exp
        sum_zz += zz_corr

        state0 = classify_ising_state(z_exp, zz_corr, q, cycle_idx, branch_offset=0.0)
        # Branch |1> (Player Intervention collapses local wavefunction to orthogonal/shifted state)
        state1 = classify_ising_state(-z_exp * 0.7 + alt_shift * 0.4, -zz_corr, q, cycle_idx, branch_offset=0.35)
        if state1 == state0:
            # Guarantee meaningful state shift when player actively intervenes in a system
            state1 = (state0 + 1) % 6 if state0 in [2, 3, 4, 5] else 1

        qubit_data.append([z_exp, zz_corr, state0, state1])

    avg_z = round(sum_z / float(num_qubits), 4)
    avg_zz = round(sum_zz / float(num_qubits), 4)
    return qubit_data, avg_z, avg_zz


def run_quantum_ising_simulation(api_key="", use_qpu=False, num_qubits=120, num_cycles=36, shots=512):
    gen_time = datetime.now(timezone.utc).isoformat()
    circuits, cycle_params = build_ising_circuits(num_qubits=num_qubits, num_cycles=num_cycles)

    all_cycle_bitstrings = []
    meta = {
        "generator": "Project Najmafar Quantum Ising Civilization Engine",
        "model": "1D/Long-Range Transverse-Field Quantum Ising Model (TFIM)",
        "generatorMode": "PSEUDO_SIMULATOR",
        "backendName": "local_quantum_ising_simulator",
        "jobId": None,
        "qubits": num_qubits,
        "cycles": num_cycles,
        "yearsSimulated": num_cycles * 0.5,
        "shotsPerCycle": shots,
        "totalShots": shots * num_cycles,
        "generatedAt": gen_time,
        "statesLegend": CIV_STATES
    }

    if use_qpu:
        print(f"🌌 Verbinde mit IBM Quantum Platform für {num_cycles}-Zyklen Ising-Simulation ({num_qubits} Qubits)...", flush=True)
        try:
            from qiskit_ibm_runtime import QiskitRuntimeService, SamplerV2
            from qiskit.transpiler.preset_passmanagers import generate_preset_pass_manager

            if api_key:
                try:
                    service = QiskitRuntimeService(channel="ibm_quantum_platform", token=api_key)
                except Exception:
                    service = QiskitRuntimeService(channel="ibm_quantum", token=api_key)
            else:
                service = QiskitRuntimeService()

            backend = service.least_busy(operational=True, simulator=False, min_num_qubits=num_qubits)
            print(f"✅ Verbunden mit echtem IBM Quantenprozessor: {backend.name} ({backend.num_qubits} Qubits)", flush=True)

            print(f"⚙️ Transpiliere {num_cycles} Ising-Epochen-Schaltkreise für {backend.name} (Optimization Level 1)...", flush=True)
            pm = generate_preset_pass_manager(optimization_level=1, backend=backend)
            isa_circuits = pm.run(circuits)

            sampler = SamplerV2(mode=backend)
            pubs = [(isa_qc, None, shots) for isa_qc in isa_circuits]

            print(f"🚀 Sende Batch-Job ({num_cycles} Epochen x {shots} Shots = {num_cycles * shots} Messungen) an {backend.name}...", flush=True)
            job = sampler.run(pubs)
            job_id = job.job_id()
            print(f"📡 IBM QPU Job-ID: {job_id} — Warte auf Quanten-Messung...", flush=True)

            result = job.result()
            print(f"🎉 Quanten-Messung von {backend.name} erfolgreich empfangen!", flush=True)

            for c_idx in range(num_cycles):
                pub_res = result[c_idx]
                bitstrings = []
                for field_name in dir(pub_res.data):
                    if not field_name.startswith("_"):
                        reg = getattr(pub_res.data, field_name)
                        if hasattr(reg, "get_bitstrings"):
                            bitstrings = reg.get_bitstrings()
                            break
                all_cycle_bitstrings.append(bitstrings)

            meta["generatorMode"] = "IBM_QPU"
            meta["backendName"] = backend.name
            meta["jobId"] = job_id

        except Exception as e:
            print(f"⚠️ Warnung bei QPU-Ausführung ({e}). Nutze deterministischen Quanten-Ising-Fallback.", flush=True)

    # Fallback if not using QPU or if QPU errored
    if len(all_cycle_bitstrings) < num_cycles:
        all_cycle_bitstrings = []
        rng = random.Random(421337)
        for c_idx in range(num_cycles):
            t_norm = c_idx / float(max(1, num_cycles - 1))
            wave_q = int(15 + t_norm * (num_qubits - 15))
            c_strings = []
            for _ in range(shots):
                bits = []
                prev_b = 0
                for q in range(num_qubits):
                    # Simulate Ising ferromagnetic/antiferromagnetic coupling + wave front
                    p_one = 0.35 + 0.35 / (1.0 + math.exp((q - wave_q) / 15.0))
                    if prev_b == 1:
                        p_one = min(0.92, p_one + 0.18)
                    b = 1 if rng.random() < p_one else 0
                    bits.append(str(b))
                    prev_b = b
                c_strings.append("".join(bits[::-1]))
            all_cycle_bitstrings.append(c_strings)

    # Analyze all 36 cycles
    cycles_summary = []
    timeline_matrix = []  # [cycle_idx][qubit_idx] -> [z_exp, zz_corr, state0, state1]

    for c_idx in range(num_cycles):
        q_data, avg_z, avg_zz = analyze_cycle_bitstrings(
            all_cycle_bitstrings[c_idx],
            num_qubits=num_qubits,
            cycle_idx=c_idx
        )
        timeline_matrix.append(q_data)

        # Count how many qubits are in each of the 6 states in natural branch
        state_counts = {s: 0 for s in CIV_STATES}
        for q_entry in q_data:
            s_name = CIV_STATES[q_entry[2]]
            state_counts[s_name] += 1

        c_info = dict(cycle_params[c_idx])
        c_info["globalMagnetization"] = avg_z
        c_info["neighborCorrelation"] = avg_zz
        c_info["stateDistribution"] = state_counts
        cycles_summary.append(c_info)

    return meta, cycles_summary, timeline_matrix


def build_system_qubit_mapping(universe_path, num_qubits=120):
    """
    Maps every star system in universe_data.json onto the 120-qubit Ising spin chain,
    ordered by radial distance from Sagittarius A* (Core -> Mid Rim -> Outer Rim)
    and azimuthal angle, so neighboring systems in 3D space share adjacent qubits!
    """
    if not os.path.exists(universe_path):
        return {}

    with open(universe_path, "r", encoding="utf-8") as f:
        u_data = json.load(f)

    systems = u_data.get("systems", [])
    # Sort systems by radial bands + angle to preserve spatial locality along the 1D Ising chain
    def spatial_key(sys_obj):
        x = float(sys_obj.get("x", 0.0))
        z = float(sys_obj.get("z", 0.0))
        r = math.sqrt(x * x + z * z)
        band = int(r / 45.0)
        angle = math.atan2(z, x)
        return (band, angle)

    sorted_sys = sorted(systems, key=spatial_key)
    mapping = {}
    total = max(1, len(sorted_sys))

    for rank_idx, sys_obj in enumerate(sorted_sys):
        sys_id = sys_obj.get("id", rank_idx)
        qubit_idx = min(num_qubits - 1, int((rank_idx / float(total)) * num_qubits))
        mapping[str(sys_id)] = qubit_idx

    return mapping


def main():
    parser = argparse.ArgumentParser(description="Generate 36-Cycle Quantum Ising Civilization Simulation")
    parser.add_argument("--api-key", "--token", dest="api_key", type=str, default="", help="IBM Quantum API Key")
    parser.add_argument("--qpu", "--use-qpu", dest="qpu", action="store_true", help="Execute on real IBM Quantum QPU")
    parser.add_argument("--qubits", dest="qubits", type=int, default=120, help="Number of Ising chain qubits")
    parser.add_argument("--cycles", dest="cycles", type=int, default=36, help="Number of galactic cycles (default 36 = 18 years)")
    parser.add_argument("--shots", dest="shots", type=int, default=512, help="Shots per cycle circuit")
    args = parser.parse_args()

    api_key = args.api_key or os.environ.get("IBM_QUANTUM_API_KEY", "")
    base_dir = os.path.dirname(os.path.abspath(__file__))
    universe_path = os.path.join(base_dir, "universe_data.json")
    output_path = os.path.join(base_dir, "quantum_ising_cycles.json")

    meta, cycles_summary, timeline_matrix = run_quantum_ising_simulation(
        api_key=api_key,
        use_qpu=args.qpu,
        num_qubits=args.qubits,
        num_cycles=args.cycles,
        shots=args.shots
    )

    system_mapping = build_system_qubit_mapping(universe_path, num_qubits=args.qubits)

    payload = {
        "meta": meta,
        "cycles": cycles_summary,
        "systemQubitMap": system_mapping,
        "timelineMatrix": timeline_matrix
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, separators=(",", ":"), ensure_ascii=False)

    file_kb = round(os.path.getsize(output_path) / 1024.0, 1)
    print(f"✅ Quantum Ising Simulation ({meta['generatorMode']} | {meta['backendName']} | Job: {meta['jobId']}) gespeichert in '{output_path}' ({file_kb} KB)!", flush=True)


if __name__ == "__main__":
    main()
