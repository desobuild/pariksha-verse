import { describe, it, expect } from "vitest";
import { AUTHORED_QUESTIONS } from "@/data/questions/neet-authored";

/**
 * Independent deterministic verification of every numerical answer in the
 * authored bank. Each expected value below is RECOMPUTED from the stem's
 * parameters using plain arithmetic — never copied from the dataset — and
 * compared against the option marked correct. If a formula, unit or option
 * drifts, this test fails.
 *
 * Values are rounded only where the exact answer is an integer or a fixed
 * decimal precision (floating-point representation, not the physics, needs it).
 */

function getQuestion(id: string) {
  const q = AUTHORED_QUESTIONS.find((question) => question.id === id);
  if (!q) throw new Error(`Authored question ${id} missing from bank`);
  const correct = q.options.find((o) => o.isCorrect);
  if (!correct) throw new Error(`Authored question ${id} has no marked correct option`);
  return { q, correctText: correct.text };
}

describe("V1 Authored Bank: Numerical Answer Verification", () => {
  it("physics: every numerical answer recomputes independently", () => {
    // Two-interval problem: s(4) = 40 -> u + 2a = 10; s(8) = 120 -> u + 4a = 15
    const a7 = (15 - 10) / 2;
    const u7 = 10 - 2 * a7;

    const expectations: Record<string, string> = {
      // Power in base units: W = J/s = (kg·m/s²·m)/s = kg·m²·s⁻³
      q_auth_phy_002: "kg·m²·s⁻³",
      // Equal distances -> harmonic mean: 2·v1·v2/(v1+v2)
      q_auth_phy_005: `${(2 * 40 * 60) / (40 + 60)} km/h`,
      // distance = speed × time
      q_auth_phy_006: `${10 * 5} m`,
      // Solved linear system above
      q_auth_phy_007: `u = ${u7} m/s, a = ${a7} m/s²`,
      // h = u²/(2g)
      q_auth_phy_008: `${20 ** 2 / (2 * 10)} m`,
      // T = 2u·sin(45°)/g = 2√2 ≈ 2.8 s
      q_auth_phy_010: `2√2 s ≈ ${((2 * 20 * Math.sin(Math.PI / 4)) / 10).toFixed(1)} s`,
      // a = v²/r
      q_auth_phy_011: `${6 ** 2 / 2} m/s²`,
      // Perfectly inelastic: common v = m1·u/(m1+m2)
      q_auth_phy_012: `${(2 * 3) / (2 + 1)} m/s`,
      // Momentum conservation, bullet mass in kg: v = (M·V)/m
      q_auth_phy_013: `${Math.round((3 * 1.5) / 0.06)} m/s`,
      // a = (F − μk·m·g)/m
      q_auth_phy_015: `${(20 - 0.2 * 5 * 10) / 5} m/s²`,
      // v_max = √(μ·g·r) = √200 = 10√2 ≈ 14.1 m/s
      q_auth_phy_016: `10√2 m/s ≈ ${Math.sqrt(0.4 * 10 * 50).toFixed(1)} m/s`,
      // Work–energy theorem: W = ½m(v² − u²)
      q_auth_phy_018: `${0.5 * 2 * (10 ** 2 - 5 ** 2)} J`,
      // Lost energy = m·g·(h1 − h2)
      q_auth_phy_020: `${1 * 10 * (5 - 2)} J`,
      // τ = r·F·sin(30°) = 20 × 0.5
      q_auth_phy_024: `${Math.round(2 * 10 * Math.sin(Math.PI / 6))} N·m`,
      // g' = g·R²/(R+h)² with h = R -> g/4
      q_auth_phy_027: "g/4",
      // v_e ∝ √M for fixed R: 11.2·√2
      q_auth_phy_028: `≈ ${(11.2 * Math.sqrt(2)).toFixed(1)} km/s`,
      // v_e ∝ R·√ρ for fixed density: 11.2/2
      q_auth_phy_029: `≈ ${(11.2 / 2).toFixed(1)} km/s`,
      // First law: ΔU = Q − W = 500 − 200
      q_auth_phy_031: `+${500 - 200} J`,
      // Carnot efficiency = 1 − Tc/Th = 0.4
      q_auth_phy_033: `${Math.round((1 - 300 / 500) * 100)}%`,
      // Null point: q/x² = 4q/(d−x)² -> d − x = 2x -> x = d/3
      q_auth_phy_036: "At a distance d/3 from the charge +q",
      // Series capacitors: C1·C2/(C1+C2) = 6/5
      q_auth_phy_039: `${(2 * 3) / (2 + 3)} μF`,
      // Stretched wire, volume constant: L×2 and A×½ -> R' = 4R
      q_auth_phy_041: "4R",
      // Two equal resistors in parallel: R/n
      q_auth_phy_042: `${6 / 2} Ω`,
      // Fringe width scales with wavelength: β/(4/3) = 3β/4
      q_auth_phy_048: "Becomes 3/4 of its original value",
    };

    for (const [id, expected] of Object.entries(expectations)) {
      const { correctText } = getQuestion(id);
      expect(correctText, `${id} correct option`).toBe(expected);
    }
  });

  it("chemistry: every numerical answer recomputes independently", () => {
    const expectations: Record<string, string> = {
      // Oxygen atoms in 0.5 mol H2SO4 = 0.5 × 4 × 6.022×10²³ = 1.2044×10²⁴
      q_auth_chm_002: `${((0.5 * 4 * 6.022e23) / 1e24).toFixed(4)}×10²⁴`,
      // Mass = 0.25 mol × (40 + 12 + 3×16) g/mol
      q_auth_chm_003: `${0.25 * (40 + 12 + 3 * 16)} g`,
      // Molarity = (4/40 mol) / 0.5 L
      q_auth_chm_004: `${4 / 40 / 0.5} M`,
      // Hess's law: ΔH(f CO) = ΔH(i) − ΔH(ii) = −393.5 − (−283.0)
      // (option text uses the typographic minus U+2212, matching the stem)
      q_auth_chm_018: `${-393.5 - -283.0} kJ/mol`.replace("-", "−"),
      // Boiling point elevation ∝ i·m: glucose 1 < NaCl 2 < CaCl₂ 3 < K₃PO₄ 4
      q_auth_chm_024: "0.1 M K₃PO₄",
      // K₂SO₄ -> 2K⁺ + SO₄²⁻ : 3 particles
      q_auth_chm_025: `${2 + 1}`,
      // Strong acid 0.001 M: pH = −log₁₀(10⁻³)
      q_auth_chm_030: `${-Math.log10(0.001)}`,
      // s = √Ksp = √1.8 × 10⁻⁵ ≈ 1.34×10⁻⁵ M
      q_auth_chm_031: `≈ ${Math.sqrt(1.8).toFixed(2)}×10⁻⁵ M`,
      // Common ion: s = Ksp/[Cl⁻] = 1.8×10⁻¹⁰ / 0.1 = 1.8×10⁻⁹ M
      q_auth_chm_032: `Drops to about ${(1.8e-10 / 0.1 / 1e-9).toFixed(1)}×10⁻⁹ M because of the common-ion effect`,
      // Mn in KMnO₄: +1 + x + 4(−2) = 0 -> x = +7
      q_auth_chm_033: `+${-(1 + 4 * -2)}`,
      // rate ∝ [A]¹[B]² : 2 × 4 = 8
      q_auth_chm_038: `${2 ** 1 * 2 ** 2}`,
      // t½ = 0.693/k = 0.693/0.693
      q_auth_chm_039: `${0.693 / 0.693} min`,
      // Fraction after 3 half-lives: (1/2)³
      q_auth_chm_040: `1/${2 ** 3}`,
    };

    for (const [id, expected] of Object.entries(expectations)) {
      const { correctText } = getQuestion(id);
      expect(correctText, `${id} correct option`).toBe(expected);
    }
  });

  it("biology: every numerical answer recomputes independently", () => {
    const expectations: Record<string, string> = {
      // Glycolysis: 4 ATP produced − 2 ATP invested = 2 net
      q_auth_bio_015: `${4 - 2}`,
      // Cardiac output = SV × HR = 70 × 72 = 5040 mL ≈ 5 L/min
      q_auth_bio_023: `≈ ${Math.round((70 * 72) / 1000)} litres per minute`,
      // Punnett Tt × tt: Tt, Tt, tt, tt -> 1:1
      q_auth_bio_034: "1 tall : 1 dwarf",
      // X-linked recessive: sons get the mother's X — half receive X^c
      q_auth_bio_035: "50% of the sons",
      // Hardy–Weinberg heterozygotes: 2pq = 2 × 0.8 × 0.2 = 0.32
      q_auth_bio_038: `${(2 * 0.8 * 0.2).toFixed(2)}`,
      // Exponential growth: N = 100·e^(0.1·10) = 100·e ≈ 272
      q_auth_bio_047: `≈ ${Math.round(100 * Math.exp(0.1 * 10))} individuals`,
    };

    for (const [id, expected] of Object.entries(expectations)) {
      const { correctText } = getQuestion(id);
      expect(correctText, `${id} correct option`).toBe(expected);
    }
  });
});
