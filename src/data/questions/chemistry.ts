import type { AuthoredQuestionSpec } from "./authored-types";

/**
 * Chemistry — 50 original ParikshaVerse authored questions.
 * All topics reference the canonical seeded NEET taxonomy; no topic is invented.
 * Numerical answers were verified independently (see tests/unit/authored-questions-numerical.test.ts).
 */
export const AUTHORED_CHEMISTRY_SPECS: AuthoredQuestionSpec[] = [
  // ---------------------------------------------------------------------------
  // Some Basic Concepts in Chemistry -> Matter and Mole Concept (3)
  // ---------------------------------------------------------------------------
  {
    id: "001",
    topicId: "exam_neet_chemistry_basic-concepts-of-chemistry_matter-and-mole-concept",
    text: "One mole of carbon dioxide (CO₂) contains molecules equal to:",
    difficulty: "easy",
    explanation:
      "A mole of any substance contains Avogadro's number of particles: 6.022×10²³. One mole of CO₂ therefore has 6.022×10²³ molecules.",
    options: ["6.022×10²³", "6.022×10²²", "3.011×10²³", "22.4×10²³"],
    correctIndex: 0,
  },
  {
    id: "002",
    topicId: "exam_neet_chemistry_basic-concepts-of-chemistry_matter-and-mole-concept",
    text: "The number of oxygen atoms present in 0.5 mol of H₂SO₄ is:",
    difficulty: "medium",
    explanation:
      "Each H₂SO₄ molecule has 4 oxygen atoms. Atoms of O = 0.5 × 4 × 6.022×10²³ = 2 × 6.022×10²³ = 1.2044×10²⁴.",
    options: ["1.2044×10²⁴", "6.022×10²³", "3.011×10²³", "2.4088×10²⁴"],
    correctIndex: 0,
  },
  {
    id: "003",
    topicId: "exam_neet_chemistry_basic-concepts-of-chemistry_matter-and-mole-concept",
    text: "The mass of 0.25 mol of calcium carbonate, CaCO₃ (Ca = 40, C = 12, O = 16), is:",
    difficulty: "medium",
    explanation: "Molar mass of CaCO₃ = 40 + 12 + (3×16) = 100 g/mol. Mass = 0.25 × 100 = 25 g.",
    options: ["25 g", "40 g", "100 g", "2.5 g"],
    correctIndex: 0,
  },
  // ---------------------------------------------------------------------------
  // Some Basic Concepts in Chemistry -> Stoichiometry and Concentration (2)
  // ---------------------------------------------------------------------------
  {
    id: "004",
    topicId: "exam_neet_chemistry_basic-concepts-of-chemistry_stoichiometry-and-concentration",
    text: "4 g of NaOH (molar mass 40 g/mol) is dissolved in water to make 500 mL of solution. The molarity of the solution is:",
    difficulty: "medium",
    explanation: "Moles of NaOH = 4/40 = 0.1 mol. Volume = 0.5 L. Molarity = 0.1/0.5 = 0.2 M.",
    options: ["0.2 M", "0.4 M", "2.0 M", "0.1 M"],
    correctIndex: 0,
  },
  {
    id: "005",
    topicId: "exam_neet_chemistry_basic-concepts-of-chemistry_stoichiometry-and-concentration",
    text: "For the reaction 2H₂(g) + O₂(g) → 2H₂O(g), 4 mol of H₂ is mixed with 3 mol of O₂. Which statement is correct?",
    difficulty: "hard",
    explanation:
      "The stoichiometric ratio is H₂ : O₂ = 2 : 1. Four moles of H₂ require only 2 mol of O₂, so H₂ is the limiting reagent. Product formed = moles of H₂ (1:1 with H₂O) = 4 mol H₂O, leaving 1 mol O₂ unreacted.",
    options: [
      "H₂ is the limiting reagent and 4 mol of H₂O are formed",
      "O₂ is the limiting reagent and 6 mol of H₂O are formed",
      "H₂ is the limiting reagent and 2 mol of H₂O are formed",
      "O₂ is the limiting reagent and 3 mol of H₂O are formed",
    ],
    correctIndex: 0,
  },
  // ---------------------------------------------------------------------------
  // Atomic Structure -> Bohr Model and Quantum Mechanics (3)
  // ---------------------------------------------------------------------------
  {
    id: "006",
    topicId: "exam_neet_chemistry_atomic-structure_bohr-model-and-quantum-mechanics",
    text: "In the Bohr model of the hydrogen atom, the energy of an electron in a stationary state depends on:",
    difficulty: "easy",
    explanation:
      "For hydrogen, E_n = −13.6/n² eV, so the energy depends only on the principal quantum number n. (l and m do not appear in the Bohr picture.)",
    options: [
      "Only the principal quantum number n",
      "The azimuthal quantum number l only",
      "The magnetic quantum number m only",
      "All four quantum numbers",
    ],
    correctIndex: 0,
  },
  {
    id: "007",
    topicId: "exam_neet_chemistry_atomic-structure_bohr-model-and-quantum-mechanics",
    text: "According to de Broglie's hypothesis, a particle of momentum p is associated with a wavelength λ equal to:",
    difficulty: "easy",
    explanation:
      "De Broglie relation: λ = h/p, where h is Planck's constant. Matter behaves as a wave with wavelength inversely proportional to momentum.",
    options: ["h/p", "hp", "p/h", "h²/p"],
    correctIndex: 0,
  },
  {
    id: "008",
    topicId: "exam_neet_chemistry_atomic-structure_bohr-model-and-quantum-mechanics",
    text: "According to the Heisenberg uncertainty principle, if the position of an electron is determined with very high precision (Δx → 0), then:",
    difficulty: "medium",
    explanation:
      "Δx·Δp ≥ h/4π. As Δx approaches zero, Δp must grow without limit — the momentum becomes completely uncertain.",
    options: [
      "The uncertainty in its momentum becomes extremely large",
      "The uncertainty in its momentum becomes extremely small",
      "Its momentum becomes exactly zero",
      "The electron is no longer described by quantum mechanics",
    ],
    correctIndex: 0,
  },
  // ---------------------------------------------------------------------------
  // Atomic Structure -> Quantum Numbers and Orbitals (3)
  // ---------------------------------------------------------------------------
  {
    id: "009",
    topicId: "exam_neet_chemistry_atomic-structure_quantum-numbers-and-orbitals",
    text: "The maximum number of electrons that can occupy a single atomic orbital is:",
    difficulty: "easy",
    explanation:
      "An orbital holds at most two electrons, with opposite spins (Pauli exclusion principle).",
    options: ["2", "1", "6", "8"],
    correctIndex: 0,
  },
  {
    id: "010",
    topicId: "exam_neet_chemistry_atomic-structure_quantum-numbers-and-orbitals",
    text: "The total number of orbitals in the shell with principal quantum number n = 3 is:",
    difficulty: "medium",
    explanation:
      "The number of orbitals in a shell is n². For n = 3, there are 9 orbitals: one 3s, three 3p and five 3d orbitals.",
    options: ["9", "3", "6", "18"],
    correctIndex: 0,
  },
  {
    id: "011",
    topicId: "exam_neet_chemistry_atomic-structure_quantum-numbers-and-orbitals",
    text: "Which of the following sets of quantum numbers is NOT permissible for an electron?",
    difficulty: "hard",
    explanation:
      "The azimuthal quantum number l can take values 0 to n−1. For n = 2, l can only be 0 or 1, so n = 2, l = 2 is impossible. All other listed sets are valid.",
    options: [
      "n = 2, l = 2, m = 0, s = +½",
      "n = 3, l = 2, m = −2, s = +½",
      "n = 2, l = 1, m = −1, s = −½",
      "n = 4, l = 0, m = 0, s = −½",
    ],
    correctIndex: 0,
  },
  // ---------------------------------------------------------------------------
  // Chemical Bonding -> Ionic and Covalent Bonding (3)
  // ---------------------------------------------------------------------------
  {
    id: "012",
    topicId: "exam_neet_chemistry_chemical-bonding_ionic-and-covalent-bonding",
    text: "A chemical bond formed by the complete transfer of one or more electrons from one atom to another is called:",
    difficulty: "easy",
    explanation:
      "Electron transfer produces oppositely charged ions held together by electrostatic attraction — an ionic (electrovalent) bond, as in NaCl.",
    options: ["Ionic bond", "Covalent bond", "Metallic bond", "Hydrogen bond"],
    correctIndex: 0,
  },
  {
    id: "013",
    topicId: "exam_neet_chemistry_chemical-bonding_ionic-and-covalent-bonding",
    text: "Which of the following species contains a coordinate (dative) covalent bond in which both electrons of the shared pair come from the same atom?",
    difficulty: "medium",
    explanation:
      "In NH₄⁺, the nitrogen of NH₃ donates its lone pair to a proton (H⁺), forming a coordinate N→H bond in addition to the three normal N–H bonds.",
    options: ["NH₄⁺", "CH₄", "NaCl", "Cl₂"],
    correctIndex: 0,
  },
  {
    id: "014",
    topicId: "exam_neet_chemistry_chemical-bonding_ionic-and-covalent-bonding",
    text: "The lattice enthalpy of an ionic compound is largest when the constituent ions are:",
    difficulty: "medium",
    explanation:
      "Lattice enthalpy ∝ (q₁·q₂)/r. Small, highly charged ions pack close together and attract strongly, so small radii and high charges maximize lattice enthalpy (e.g. MgO vs NaCl).",
    options: [
      "Small and highly charged",
      "Large and highly charged",
      "Small and singly charged only",
      "Large and singly charged",
    ],
    correctIndex: 0,
  },
  // ---------------------------------------------------------------------------
  // Chemical Bonding -> Molecular Orbital Theory (2)
  // ---------------------------------------------------------------------------
  {
    id: "015",
    topicId: "exam_neet_chemistry_chemical-bonding_molecular-orbital-theory",
    text: "According to molecular orbital theory, the bond order of the O₂ molecule is:",
    difficulty: "easy",
    explanation:
      "O₂ has 10 electrons in bonding MOs and 6 in antibonding MOs. Bond order = (10 − 6)/2 = 2, consistent with the O=O double bond picture.",
    options: ["2", "1", "2.5", "3"],
    correctIndex: 0,
  },
  {
    id: "016",
    topicId: "exam_neet_chemistry_chemical-bonding_molecular-orbital-theory",
    text: "Which of the following species is paramagnetic (contains unpaired electrons)?",
    difficulty: "hard",
    explanation:
      "O₂⁻ (superoxide) has one unpaired antibonding electron, so it is paramagnetic. O₂²⁻ (peroxide), NO⁺ and CN⁻ all have closed-shell configurations and are diamagnetic.",
    options: ["O₂⁻", "O₂²⁻", "NO⁺", "CN⁻"],
    correctIndex: 0,
  },
  // ---------------------------------------------------------------------------
  // Chemical Thermodynamics -> Thermochemistry and Hess's Law (2)
  // ---------------------------------------------------------------------------
  {
    id: "017",
    topicId: "exam_neet_chemistry_chemical-thermodynamics_thermochemistry-hess-law",
    text: "Hess's law of constant heat summation states that the total enthalpy change of a reaction depends on:",
    difficulty: "easy",
    explanation:
      "Enthalpy is a state function, so the overall ΔH depends only on the initial and final states of the system, not on the particular steps or path taken.",
    options: [
      "Only the initial and final states, not the path followed",
      "The number of intermediate steps in the mechanism",
      "The speed at which the reaction is carried out",
      "Whether the reaction is performed in an open or closed vessel",
    ],
    correctIndex: 0,
  },
  {
    id: "018",
    topicId: "exam_neet_chemistry_chemical-thermodynamics_thermochemistry-hess-law",
    text: "Given: (i) C(s) + O₂(g) → CO₂(g), ΔH = −393.5 kJ/mol and (ii) CO(g) + ½O₂(g) → CO₂(g), ΔH = −283.0 kJ/mol. The enthalpy of formation of CO(g) from C(s) and ½O₂(g) is:",
    difficulty: "hard",
    explanation:
      "By Hess's law, reaction (i) = desired reaction + (ii). ΔH(desired) = ΔH(i) − ΔH(ii) = −393.5 − (−283.0) = −110.5 kJ/mol.",
    options: ["−110.5 kJ/mol", "−676.5 kJ/mol", "+110.5 kJ/mol", "−393.5 kJ/mol"],
    correctIndex: 0,
  },
  // ---------------------------------------------------------------------------
  // Chemical Thermodynamics -> Spontaneity, Entropy and Gibbs Energy (2)
  // ---------------------------------------------------------------------------
  {
    id: "019",
    topicId: "exam_neet_chemistry_chemical-thermodynamics_spontaneity-entropy-gibbs-energy",
    text: "A process is spontaneous at ALL temperatures when:",
    difficulty: "medium",
    explanation:
      "ΔG = ΔH − TΔS. If ΔH < 0 and ΔS > 0, then ΔG is negative at every temperature, so the process is spontaneous at all temperatures.",
    options: ["ΔH < 0 and ΔS > 0", "ΔH > 0 and ΔS > 0", "ΔH < 0 and ΔS < 0", "ΔH > 0 and ΔS < 0"],
    correctIndex: 0,
  },
  {
    id: "020",
    topicId: "exam_neet_chemistry_chemical-thermodynamics_spontaneity-entropy-gibbs-energy",
    text: "At constant temperature and pressure, a process is spontaneous when the change in Gibbs energy (ΔG) is:",
    difficulty: "easy",
    explanation:
      "The criterion for spontaneity at constant T and P is ΔG < 0. ΔG = 0 means equilibrium, and ΔG > 0 means the process is non-spontaneous in the forward direction.",
    options: ["Negative (ΔG < 0)", "Positive (ΔG > 0)", "Exactly zero", "Positive or zero"],
    correctIndex: 0,
  },
  // ---------------------------------------------------------------------------
  // Solutions -> Types of Solutions and Raoult's Law (2)
  // ---------------------------------------------------------------------------
  {
    id: "021",
    topicId: "exam_neet_chemistry_solutions_types-of-solutions-and-raoults-law",
    text: "For a binary solution to be truly ideal, it must obey Raoult's law over the entire concentration range and have:",
    difficulty: "medium",
    explanation:
      "Ideal solutions form when unlike interactions match like interactions exactly: ΔH_mix = 0 and ΔV_mix = 0 (e.g. benzene + toluene, approximately).",
    options: [
      "ΔH_mix = 0 and ΔV_mix = 0",
      "ΔH_mix > 0 and ΔV_mix > 0",
      "ΔH_mix < 0 and ΔV_mix < 0",
      "ΔH_mix = 0 but ΔV_mix ≠ 0",
    ],
    correctIndex: 0,
  },
  {
    id: "022",
    topicId: "exam_neet_chemistry_solutions_types-of-solutions-and-raoults-law",
    text: "A liquid pair shows positive deviation from Raoult's law when:",
    difficulty: "medium",
    explanation:
      "Positive deviation occurs when A–B interactions are weaker than A–A and B–B interactions, so molecules escape more easily and the vapour pressure exceeds the Raoult's-law prediction (e.g. ethanol + acetone).",
    options: [
      "A–B interactions are weaker than A–A and B–B interactions, raising the vapour pressure above the predicted value",
      "A–B interactions are stronger than A–A and B–B interactions, lowering the vapour pressure below the predicted value",
      "The solution obeys Raoult's law at all concentrations",
      "The vapour pressure is exactly equal to the pure-component vapour pressures",
    ],
    correctIndex: 0,
  },
  // ---------------------------------------------------------------------------
  // Solutions -> Colligative Properties and Van 't Hoff Factor (3)
  // ---------------------------------------------------------------------------
  {
    id: "023",
    topicId: "exam_neet_chemistry_solutions_colligative-properties-and-van-t-hoff",
    text: "Which of the following is a colligative property?",
    difficulty: "easy",
    explanation:
      "Colligative properties depend only on the number of solute particles, not their identity. Osmotic pressure, boiling-point elevation, freezing-point depression and vapour-pressure lowering are the four colligative properties; viscosity and surface tension are not.",
    options: ["Osmotic pressure", "Viscosity", "Surface tension", "Refractive index"],
    correctIndex: 0,
  },
  {
    id: "024",
    topicId: "exam_neet_chemistry_solutions_colligative-properties-and-van-t-hoff",
    text: "Assuming complete dissociation and ideal behaviour, which 0.1 M aqueous solution has the HIGHEST boiling point?",
    difficulty: "hard",
    explanation:
      "Boiling-point elevation ∝ i·m, where i is the number of ions per formula unit: glucose i = 1, NaCl i = 2, CaCl₂ i = 3, K₃PO₄ i = 4. K₃PO₄ releases the most particles and hence shows the largest elevation.",
    options: ["0.1 M K₃PO₄", "0.1 M CaCl₂", "0.1 M NaCl", "0.1 M glucose"],
    correctIndex: 0,
  },
  {
    id: "025",
    topicId: "exam_neet_chemistry_solutions_colligative-properties-and-van-t-hoff",
    text: "Assuming complete dissociation, the van 't Hoff factor (i) for potassium sulphate, K₂SO₄, in water is:",
    difficulty: "medium",
    explanation:
      "K₂SO₄ dissociates into 2K⁺ + SO₄²⁻, giving 3 particles per formula unit, so i = 3.",
    options: ["3", "2", "4", "1"],
    correctIndex: 0,
  },
  // ---------------------------------------------------------------------------
  // Equilibrium -> Chemical Equilibrium and Le Chatelier (3)
  // ---------------------------------------------------------------------------
  {
    id: "026",
    topicId: "exam_neet_chemistry_equilibrium_chemical-equilibrium-le-chatelier",
    text: "For the exothermic industrial synthesis N₂(g) + 3H₂(g) ⇌ 2NH₃(g), the yield of ammonia is increased by:",
    difficulty: "medium",
    explanation:
      "The forward reaction reduces the number of gas moles (4 → 2) and releases heat. By Le Chatelier's principle, high pressure favours the forward reaction, and lower temperature favours the exothermic direction.",
    options: [
      "Increasing pressure and lowering the temperature",
      "Increasing temperature and decreasing pressure",
      "Decreasing the pressure over the mixture",
      "Continuously removing N₂ from the vessel",
    ],
    correctIndex: 0,
  },
  {
    id: "027",
    topicId: "exam_neet_chemistry_equilibrium_chemical-equilibrium-le-chatelier",
    text: "When a catalyst is added to a system already at equilibrium:",
    difficulty: "medium",
    explanation:
      "A catalyst lowers the activation energy of the forward and reverse reactions equally, so equilibrium is reached faster but its position (and K) is unchanged.",
    options: [
      "Equilibrium is reached faster, but the composition at equilibrium is unchanged",
      "The forward reaction is favoured and the yield increases",
      "The reverse reaction is favoured and the yield decreases",
      "The equilibrium constant increases",
    ],
    correctIndex: 0,
  },
  {
    id: "028",
    topicId: "exam_neet_chemistry_equilibrium_chemical-equilibrium-le-chatelier",
    text: "For the equilibrium PCl₅(g) ⇌ PCl₃(g) + Cl₂(g), the volume of the vessel is suddenly decreased at constant temperature. What happens?",
    difficulty: "hard",
    explanation:
      "Compressing the mixture raises the pressure, so the equilibrium shifts toward the side with fewer gas moles (PCl₅, backward). However, Kc depends only on temperature, so its value is unchanged.",
    options: [
      "The equilibrium shifts backward (more PCl₅) but Kc remains unchanged",
      "The equilibrium shifts forward (more PCl₃ and Cl₂) but Kc remains unchanged",
      "The equilibrium shifts backward and Kc decreases",
      "There is no shift and Kc increases",
    ],
    correctIndex: 0,
  },
  // ---------------------------------------------------------------------------
  // Equilibrium -> Ionic Equilibrium and pH (2)
  // ---------------------------------------------------------------------------
  {
    id: "029",
    topicId: "exam_neet_chemistry_equilibrium_ionic-equilibrium-and-ph",
    text: "The pH of a neutral aqueous solution at 25°C is:",
    difficulty: "easy",
    explanation: "At 25°C, [H⁺] = [OH⁻] = 10⁻⁷ M in pure water, so pH = −log(10⁻⁷) = 7.",
    options: ["7", "0", "14", "1"],
    correctIndex: 0,
  },
  {
    id: "030",
    topicId: "exam_neet_chemistry_equilibrium_ionic-equilibrium-and-ph",
    text: "The pH of a 0.001 M solution of HCl, a strong acid that ionizes completely, is:",
    difficulty: "medium",
    explanation: "Complete ionization gives [H⁺] = 10⁻³ M, so pH = −log(10⁻³) = 3.",
    options: ["3", "11", "2", "1"],
    correctIndex: 0,
  },
  // ---------------------------------------------------------------------------
  // Equilibrium -> Solubility Product (2)
  // ---------------------------------------------------------------------------
  {
    id: "031",
    topicId: "exam_neet_chemistry_equilibrium_solubility-product",
    text: "The solubility product of AgCl at 25°C is 1.8×10⁻¹⁰. Its molar solubility in pure water is:",
    difficulty: "hard",
    explanation: "For AgCl ⇌ Ag⁺ + Cl⁻, Ksp = s². So s = √(1.8×10⁻¹⁰) = √1.8 × 10⁻⁵ ≈ 1.34×10⁻⁵ M.",
    options: ["≈ 1.34×10⁻⁵ M", "1.8×10⁻¹⁰ M", "≈ 1.34×10⁻¹⁰ M", "≈ 3.6×10⁻⁵ M"],
    correctIndex: 0,
  },
  {
    id: "032",
    topicId: "exam_neet_chemistry_equilibrium_solubility-product",
    text: "When AgCl (Ksp = 1.8×10⁻¹⁰) is placed in 0.1 M NaCl solution instead of pure water, its molar solubility:",
    difficulty: "hard",
    explanation:
      "The common ion Cl⁻ suppresses dissolution: s = Ksp/[Cl⁻] = 1.8×10⁻¹⁰/0.1 = 1.8×10⁻⁹ M — far below the pure-water value of ≈1.34×10⁻⁵ M (the common-ion effect).",
    options: [
      "Drops to about 1.8×10⁻⁹ M because of the common-ion effect",
      "Increases because Na⁺ helps dissolve AgCl",
      "Stays the same as in pure water",
      "Becomes exactly zero because AgCl is insoluble",
    ],
    correctIndex: 0,
  },
  // ---------------------------------------------------------------------------
  // Redox and Electrochemistry -> Redox Reactions and Oxidation Number (2)
  // ---------------------------------------------------------------------------
  {
    id: "033",
    topicId:
      "exam_neet_chemistry_redox-reactions-and-electrochemistry_redox-reactions-and-oxidation-number",
    text: "The oxidation state of manganese in KMnO₄ is:",
    difficulty: "easy",
    explanation: "K is +1 and each O is −2: (+1) + x + 4(−2) = 0, giving x = +7.",
    options: ["+7", "+6", "+4", "+2"],
    correctIndex: 0,
  },
  {
    id: "034",
    topicId:
      "exam_neet_chemistry_redox-reactions-and-electrochemistry_redox-reactions-and-oxidation-number",
    text: "In the spontaneous reaction Zn(s) + Cu²⁺(aq) → Zn²⁺(aq) + Cu(s):",
    difficulty: "easy",
    explanation:
      "Zn loses electrons (oxidation number 0 → +2), so Zn is oxidised and acts as the reducing agent. Cu²⁺ gains electrons (+2 → 0), so it is reduced and acts as the oxidising agent.",
    options: [
      "Zn is oxidised and Cu²⁺ is reduced",
      "Zn is reduced and Cu²⁺ is oxidised",
      "Both Zn and Cu²⁺ are oxidised",
      "Neither species changes its oxidation state",
    ],
    correctIndex: 0,
  },
  // ---------------------------------------------------------------------------
  // Redox and Electrochemistry -> Galvanic Cells and Nernst Equation (2)
  // ---------------------------------------------------------------------------
  {
    id: "035",
    topicId:
      "exam_neet_chemistry_redox-reactions-and-electrochemistry_galvanic-cells-and-nernst-equation",
    text: "In a galvanic (voltaic) cell, oxidation takes place at the:",
    difficulty: "easy",
    explanation:
      "Oxidation (loss of electrons) always occurs at the anode, reduction at the cathode; in a galvanic cell the anode is the negative terminal.",
    options: ["Anode", "Cathode", "Salt bridge", "Voltmeter"],
    correctIndex: 0,
  },
  {
    id: "036",
    topicId:
      "exam_neet_chemistry_redox-reactions-and-electrochemistry_galvanic-cells-and-nernst-equation",
    text: "For the cell Zn(s) | Zn²⁺(aq) || Cu²⁺(aq) | Cu(s) with E°cell = 1.10 V, increasing the concentration of Cu²⁺ (while [Zn²⁺] is held constant) will:",
    difficulty: "hard",
    explanation:
      "E = E° − (0.059/2)·log([Zn²⁺]/[Cu²⁺]). Raising [Cu²⁺] decreases the reaction quotient Q, so the logarithmic term shrinks and the cell EMF rises above its standard value.",
    options: [
      "Increase the cell EMF above 1.10 V",
      "Decrease the cell EMF below 1.10 V",
      "Leave the EMF unchanged at 1.10 V",
      "Reverse the direction of the cell reaction",
    ],
    correctIndex: 0,
  },
  // ---------------------------------------------------------------------------
  // Chemical Kinetics -> Rate of Reaction and Order (2)
  // ---------------------------------------------------------------------------
  {
    id: "037",
    topicId: "exam_neet_chemistry_chemical-kinetics_rate-of-reaction-and-order",
    text: "For a zero-order reaction, the rate of the reaction:",
    difficulty: "easy",
    explanation:
      "By definition, a zero-order rate is independent of reactant concentration: rate = k[A]⁰ = k, constant until the reactant is exhausted.",
    options: [
      "Is independent of the concentration of the reactant",
      "Doubles when the reactant concentration doubles",
      "Is proportional to the square of the reactant concentration",
      "Increases exponentially with time",
    ],
    correctIndex: 0,
  },
  {
    id: "038",
    topicId: "exam_neet_chemistry_chemical-kinetics_rate-of-reaction-and-order",
    text: "A reaction follows the rate law rate = k[A][B]². If [A] is doubled and [B] is also doubled, the rate increases by a factor of:",
    difficulty: "medium",
    explanation:
      "Rate ∝ [A]¹[B]². Doubling [A] contributes a factor of 2, doubling [B] contributes 2² = 4, so the total factor is 2 × 4 = 8.",
    options: ["8", "4", "6", "2"],
    correctIndex: 0,
  },
  // ---------------------------------------------------------------------------
  // Chemical Kinetics -> Integrated Rate Equations (2)
  // ---------------------------------------------------------------------------
  {
    id: "039",
    topicId: "exam_neet_chemistry_chemical-kinetics_integrated-rate-equations",
    text: "For a first-order reaction with rate constant k = 0.693 min⁻¹, the half-life of the reaction is:",
    difficulty: "medium",
    explanation:
      "For a first-order reaction, t½ = 0.693/k = 0.693/0.693 = 1 min. The half-life is independent of the initial concentration.",
    options: ["1 min", "0.693 min", "2 min", "10 min"],
    correctIndex: 0,
  },
  {
    id: "040",
    topicId: "exam_neet_chemistry_chemical-kinetics_integrated-rate-equations",
    text: "For a first-order reaction, the fraction of the initial reactant remaining after three half-lives is:",
    difficulty: "medium",
    explanation:
      "Each half-life halves the remaining amount: after 1 half-life 1/2 remains, after 2 half-lives 1/4, and after 3 half-lives 1/8 (≈ 12.5%).",
    options: ["1/8", "1/3", "1/6", "1/9"],
    correctIndex: 0,
  },
  // ---------------------------------------------------------------------------
  // Classification of Elements -> Periodic Table and Trends (2)
  // ---------------------------------------------------------------------------
  {
    id: "041",
    topicId: "exam_neet_chemistry_classification-of-elements_periodic-table-and-trends",
    text: "Which of the following correctly represents the decrease in atomic radius across Period 3?",
    difficulty: "easy",
    explanation:
      "Across a period, nuclear charge increases while electrons enter the same shell, pulling them closer. Atomic radius therefore decreases from Na to Mg to Al.",
    options: ["Na > Mg > Al", "Al > Mg > Na", "Mg > Na > Al", "Na > Al > Mg"],
    correctIndex: 0,
  },
  {
    id: "042",
    topicId: "exam_neet_chemistry_classification-of-elements_periodic-table-and-trends",
    text: "Boron has a lower first ionization enthalpy than beryllium, although its nuclear charge is higher, because:",
    difficulty: "hard",
    explanation:
      "Be loses a 2s electron, while B loses a 2p electron. The 2p electron is higher in energy and more shielded than the penetrating 2s electron, so it is easier to remove — an exception to the general period trend.",
    options: [
      "Boron's outermost electron is a 2p electron, which is higher in energy and more shielded than beryllium's 2s electron",
      "Boron atoms are larger than beryllium atoms",
      "Beryllium has a half-filled subshell, which is extra stable",
      "Boron has a lower effective nuclear charge than beryllium",
    ],
    correctIndex: 0,
  },
  // ---------------------------------------------------------------------------
  // Organic Chemistry Principles -> IUPAC Nomenclature and Isomerism (2)
  // ---------------------------------------------------------------------------
  {
    id: "043",
    topicId:
      "exam_neet_chemistry_basic-principles-of-organic-chemistry_iupac-nomenclature-and-isomerism",
    text: "The IUPAC name of CH₃–CH(OH)–CH₃ is:",
    difficulty: "medium",
    explanation:
      "The three-carbon chain is propane with an –OH group on carbon 2 (numbering from the end nearest the functional group), giving propan-2-ol (isopropyl alcohol).",
    options: ["Propan-2-ol", "Propan-1-ol", "Propane-1,2-diol", "2-methylethan-1-ol"],
    correctIndex: 0,
  },
  {
    id: "044",
    topicId:
      "exam_neet_chemistry_basic-principles-of-organic-chemistry_iupac-nomenclature-and-isomerism",
    text: "n-Butane and isobutane (2-methylpropane), both having the formula C₄H₁₀, are examples of:",
    difficulty: "medium",
    explanation:
      "They differ in the carbon skeleton (straight chain vs branched chain) with the same molecular formula — chain (skeletal) isomerism, a type of structural isomerism.",
    options: [
      "Chain (skeletal) isomerism",
      "Position isomerism",
      "Functional isomerism",
      "Geometrical isomerism",
    ],
    correctIndex: 0,
  },
  // ---------------------------------------------------------------------------
  // Organic Chemistry Principles -> Electronic Displacements and Intermediates (2)
  // ---------------------------------------------------------------------------
  {
    id: "045",
    topicId:
      "exam_neet_chemistry_basic-principles-of-organic-chemistry_electronic-displacements-and-intermediates",
    text: "Which of the following substituents exerts a strong −I (electron-withdrawing inductive) effect?",
    difficulty: "medium",
    explanation:
      "The nitro group pulls electron density through sigma bonds because of its positively charged nitrogen. Alkyl groups (–CH₃, tert-butyl) and –O⁻ push electron density and show +I effects.",
    options: ["–NO₂", "–CH₃", "–O⁻", "–C(CH₃)₃"],
    correctIndex: 0,
  },
  {
    id: "046",
    topicId:
      "exam_neet_chemistry_basic-principles-of-organic-chemistry_electronic-displacements-and-intermediates",
    text: "Which of the following carbocations is the most stable?",
    difficulty: "medium",
    explanation:
      "Carbocation stability increases with the number of electron-donating alkyl groups: tertiary (CH₃)₃C⁺ > secondary > primary > CH₃⁺, due to hyperconjugation and inductive donation.",
    options: [
      "(CH₃)₃C⁺ (tertiary)",
      "CH₃CH₂C⁺H(CH₃) (secondary)",
      "CH₃CH₂C⁺H₂ (primary)",
      "CH₃⁺ (methyl)",
    ],
    correctIndex: 0,
  },
  // ---------------------------------------------------------------------------
  // Hydrocarbons -> Alkanes, Alkenes, Alkynes (2)
  // ---------------------------------------------------------------------------
  {
    id: "047",
    topicId: "exam_neet_chemistry_hydrocarbons_alkanes-alkenes-alkynes",
    text: "Addition of HBr to propene (CH₃–CH=CH₂) gives as the major product:",
    difficulty: "medium",
    explanation:
      "By Markovnikov's rule, H adds to the carbon with more hydrogens (terminal CH₂), so Br attaches to the more substituted middle carbon, forming 2-bromopropane via the more stable secondary carbocation.",
    options: ["2-bromopropane", "1-bromopropane", "1,2-dibromopropane", "Propane"],
    correctIndex: 0,
  },
  {
    id: "048",
    topicId: "exam_neet_chemistry_hydrocarbons_alkanes-alkenes-alkynes",
    text: "Which of the following hydrocarbons rapidly decolourizes bromine water, indicating unsaturation?",
    difficulty: "medium",
    explanation:
      "Alkenes add bromine across the double bond, decolourizing the red-brown bromine water. Saturated alkanes (methane, ethane, propane) do not react under these conditions.",
    options: ["Ethene", "Ethane", "Propane", "Methane"],
    correctIndex: 0,
  },
  // ---------------------------------------------------------------------------
  // Hydrocarbons -> Aromatic Hydrocarbons (2)
  // ---------------------------------------------------------------------------
  {
    id: "049",
    topicId: "exam_neet_chemistry_hydrocarbons_aromatic-hydrocarbons",
    text: "Benzene characteristically reacts by:",
    difficulty: "medium",
    explanation:
      "Benzene's delocalized π system is exceptionally stable (aromatic). Substitution preserves this stability, so electrophilic substitution dominates over addition reactions.",
    options: [
      "Electrophilic substitution, preserving its aromatic π system",
      "Electrophilic addition across the ring",
      "Free-radical addition across the ring",
      "Nucleophilic substitution at the ring hydrogens",
    ],
    correctIndex: 0,
  },
  {
    id: "050",
    topicId: "exam_neet_chemistry_hydrocarbons_aromatic-hydrocarbons",
    text: "The electrophile responsible for the nitration of benzene in the nitrating mixture (conc. HNO₃ + conc. H₂SO₄) is:",
    difficulty: "medium",
    explanation:
      "Sulphuric acid protonates nitric acid, generating the nitronium ion NO₂⁺, the strong electrophile that attacks the benzene ring.",
    options: [
      "The nitronium ion, NO₂⁺",
      "The nitrite ion, NO₂⁻",
      "Neutral nitric acid, HNO₃",
      "The hydrogen sulphate ion, HSO₄⁻",
    ],
    correctIndex: 0,
  },
];
