import type { ExamScoringConfig, ExamMetadata } from "@/types/exam-config";

export interface SeedTopic {
  slug: string;
  name: string;
  displayOrder: number;
}

export interface SeedChapter {
  slug: string;
  name: string;
  displayOrder: number;
  topics: SeedTopic[];
}

export interface SeedSubject {
  slug: string;
  name: string;
  displayOrder: number;
  chapters: SeedChapter[];
}

export interface SeedExamData {
  exam: {
    id: string;
    slug: string;
    name: string;
    shortName: string;
    description: string;
    category: string;
    status: "active" | "draft" | "archived";
    metadata: ExamMetadata;
  };
  attempt: {
    id: string;
    slug: string;
    label: string;
    examDate: Date | null;
    status: "upcoming" | "active" | "completed" | "archived";
    scoringConfig: ExamScoringConfig;
    metadata: Record<string, unknown>;
  };
  subjects: SeedSubject[];
}

/**
 * Canonical NEET (UG) Syllabus Dataset.
 *
 * Baseline Source: National Medical Commission (NMC) - Undergraduate Medical Education Board
 * Public Notice No. U.14023/19/2023-UGMEB dated 6th October 2023 (finalizing NEET-UG 2024 syllabus).
 *
 * Provenance Note:
 * As of September 2026, an official NEET-UG 2027 syllabus has NOT been issued by NTA or NMC.
 * The seeded hierarchy for NEET 2027 is provisional, derived from the official NMC NEET-UG 2024 baseline.
 * The breakdown into chapters and topics is an application-level taxonomy designed for study
 * tracking and spaced repetition, rather than an official NMC/NTA chapter structure.
 */
export const neetExam = {
  id: "exam_neet",
  slug: "neet",
  name: "National Eligibility cum Entrance Test (Undergraduate)",
  shortName: "NEET",
  description:
    "All-India pre-medical entrance test for admission to MBBS, BDS, AYUSH and related medical programs.",
  category: "medical",
  status: "active" as const,
  metadata: {
    officialConductingBody: "National Testing Agency (NTA) / NMC",
    officialWebsite: "https://exams.nta.ac.in/NEET/",
    eligibilityNotes: "Physics, Chemistry, Biology/Biotechnology with English.",
    syllabusSource: "NMC Public Notice No. U.14023/19/2023-UGMEB",
    sourceDate: "2023-10-06",
    sourceScope: "Official NMC NEET-UG 2024 Syllabus",
    verifiedDate: "2026-09-23",
    taxonomyType: "ParikshaVerse Application Taxonomy (units decomposed into chapters and tracking topics)",
  },
};

export const neetAttempt = {
  id: "attempt_neet_2027",
  slug: "neet-2027",
  label: "NEET 2027",
  examDate: new Date("2027-05-02T08:30:00.000Z"),
  status: "upcoming" as const,
  scoringConfig: {
    totalMarks: 720,
    defaultRule: {
      correctMarks: 4,
      incorrectMarks: -1,
      unattemptedMarks: 0,
    },
    durationMinutes: 200,
    totalQuestions: 180,
    negativeMarking: true,
    syllabusVersion: "NMC-2024-baseline",
    sections: [
      {
        name: "Physics",
        subjectSlug: "physics",
        totalQuestions: 45,
        scoringRule: { correctMarks: 4, incorrectMarks: -1, unattemptedMarks: 0 },
      },
      {
        name: "Chemistry",
        subjectSlug: "chemistry",
        totalQuestions: 45,
        scoringRule: { correctMarks: 4, incorrectMarks: -1, unattemptedMarks: 0 },
      },
      {
        name: "Biology",
        subjectSlug: "biology",
        totalQuestions: 90,
        scoringRule: { correctMarks: 4, incorrectMarks: -1, unattemptedMarks: 0 },
      },
    ],
  },
  metadata: {
    cycleYear: 2027,
    syllabusStatus: "provisional",
    provisionalNotice:
      "Official NEET-UG 2027 syllabus has not been published by NTA/NMC as of September 2026. This hierarchy is provisionally mapped from the official NMC NEET-UG 2024 baseline (Notice U.14023/19/2023-UGMEB).",
    baselineSource: "NMC Public Notice No. U.14023/19/2023-UGMEB dated 06-10-2023 (NEET-UG 2024)",
  },
};

export const neetSeedData: SeedExamData = {
  exam: neetExam,
  attempt: neetAttempt,
  subjects: [
    {
      slug: "physics",
      name: "Physics",
      displayOrder: 1,
      chapters: [
        {
          slug: "physics-and-measurement",
          name: "Physics and Measurement",
          displayOrder: 1,
          topics: [
            { slug: "units-and-measurements", name: "Units of Measurement, SI Units & Derived Units", displayOrder: 1 },
            { slug: "errors-and-significant-figures", name: "Least Count, Significant Figures & Errors in Measurement", displayOrder: 2 },
            { slug: "dimensional-analysis", name: "Dimensions of Physical Quantities & Dimensional Analysis", displayOrder: 3 },
          ],
        },
        {
          slug: "kinematics",
          name: "Kinematics",
          displayOrder: 2,
          topics: [
            { slug: "motion-in-straight-line", name: "Frame of Reference, Uniform & Non-Uniform Motion", displayOrder: 1 },
            { slug: "uniformly-accelerated-motion", name: "Relations & Graphs for Uniformly Accelerated Motion", displayOrder: 2 },
            { slug: "vectors-and-scalars", name: "Vectors, Vector Products & Relative Velocity", displayOrder: 3 },
            { slug: "projectile-and-circular-motion", name: "Projectile Motion & Uniform Circular Motion", displayOrder: 4 },
          ],
        },
        {
          slug: "laws-of-motion",
          name: "Laws of Motion",
          displayOrder: 3,
          topics: [
            { slug: "newtons-laws-and-inertia", name: "Force, Inertia, Newton's Laws & Impulse", displayOrder: 1 },
            { slug: "conservation-of-momentum", name: "Linear Momentum Conservation & Equilibrium of Forces", displayOrder: 2 },
            { slug: "friction", name: "Static, Kinetic & Rolling Friction", displayOrder: 3 },
            { slug: "circular-motion-dynamics", name: "Centripetal Force & Dynamics of Circular Motion", displayOrder: 4 },
          ],
        },
        {
          slug: "work-energy-and-power",
          name: "Work, Energy and Power",
          displayOrder: 4,
          topics: [
            { slug: "work-energy-theorem", name: "Work Done by Constant & Variable Forces, Work-Energy Theorem", displayOrder: 1 },
            { slug: "conservation-of-energy", name: "Potential Energy, Conservative Forces & Energy Conservation", displayOrder: 2 },
            { slug: "collisions", name: "Elastic & Inelastic Collisions in 1D and 2D", displayOrder: 3 },
          ],
        },
        {
          slug: "rotational-motion",
          name: "Rotational Motion",
          displayOrder: 5,
          topics: [
            { slug: "centre-of-mass", name: "Centre of Mass of Two-Particle & Rigid Systems", displayOrder: 1 },
            { slug: "torque-and-angular-momentum", name: "Torque, Angular Momentum & Conservation", displayOrder: 2 },
            { slug: "moment-of-inertia", name: "Moment of Inertia, Parallel & Perpendicular Axes Theorems", displayOrder: 3 },
          ],
        },
        {
          slug: "gravitation",
          name: "Gravitation",
          displayOrder: 6,
          topics: [
            { slug: "universal-law-of-gravitation", name: "Universal Law of Gravitation & Acceleration Due to Gravity", displayOrder: 1 },
            { slug: "keplers-laws", name: "Kepler's Laws of Planetary Motion", displayOrder: 2 },
            { slug: "gravitational-potential-and-escape-velocity", name: "Gravitational Potential Energy & Escape Velocity", displayOrder: 3 },
            { slug: "satellites", name: "Motion, Orbital Velocity & Energy of Satellites", displayOrder: 4 },
          ],
        },
        {
          slug: "properties-of-solids-and-liquids",
          name: "Properties of Solids and Liquids",
          displayOrder: 7,
          topics: [
            { slug: "elastic-behaviour", name: "Elasticity, Stress-Strain Relationship & Hooke's Law", displayOrder: 1 },
            { slug: "fluid-pressure-and-pascal-law", name: "Pressure in Fluid Column & Pascal's Law", displayOrder: 2 },
            { slug: "viscosity-and-bernoulli", name: "Viscosity, Stokes' Law, Terminal Velocity & Bernoulli's Principle", displayOrder: 3 },
            { slug: "surface-tension", name: "Surface Energy, Surface Tension & Capillary Rise", displayOrder: 4 },
            { slug: "heat-and-calorimetry", name: "Thermal Expansion, Specific Heat Capacity & Heat Transfer", displayOrder: 5 },
          ],
        },
        {
          slug: "thermodynamics",
          name: "Thermodynamics",
          displayOrder: 8,
          topics: [
            { slug: "zeroth-and-first-law", name: "Thermal Equilibrium, Zeroth Law & First Law of Thermodynamics", displayOrder: 1 },
            { slug: "thermodynamic-processes", name: "Isothermal, Adiabatic, Reversible & Irreversible Processes", displayOrder: 2 },
            { slug: "second-law", name: "Second Law of Thermodynamics & Heat Engines", displayOrder: 3 },
          ],
        },
        {
          slug: "kinetic-theory-of-gases",
          name: "Kinetic Theory of Gases",
          displayOrder: 9,
          topics: [
            { slug: "gas-laws-and-equation-of-state", name: "Equation of State of Perfect Gas & Kinetic Theory Assumptions", displayOrder: 1 },
            { slug: "equipartition-and-specific-heat", name: "RMS Speed, Degrees of Freedom & Law of Equipartition of Energy", displayOrder: 2 },
          ],
        },
        {
          slug: "oscillations-and-waves",
          name: "Oscillations and Waves",
          displayOrder: 10,
          topics: [
            { slug: "simple-harmonic-motion", name: "Periodic Motion, S.H.M. Equations & Energy in S.H.M.", displayOrder: 1 },
            { slug: "pendulum-and-spring-oscillations", name: "Spring-Mass Systems & Simple Pendulum", displayOrder: 2 },
            { slug: "wave-motion-and-superposition", name: "Transverse & Longitudinal Waves, Superposition Principle", displayOrder: 3 },
            { slug: "standing-waves-and-beats", name: "Standing Waves, Organ Pipes & Beats", displayOrder: 4 },
          ],
        },
        {
          slug: "electrostatics",
          name: "Electrostatics",
          displayOrder: 11,
          topics: [
            { slug: "coulombs-law-and-electric-field", name: "Electric Charge, Coulomb's Law & Electric Field Lines", displayOrder: 1 },
            { slug: "gauss-law-and-applications", name: "Electric Flux & Gauss's Law Applications", displayOrder: 2 },
            { slug: "electric-potential-and-dipole", name: "Electric Potential, Equipotential Surfaces & Dipoles", displayOrder: 3 },
            { slug: "capacitance", name: "Capacitors, Dielectrics & Energy Stored in Capacitors", displayOrder: 4 },
          ],
        },
        {
          slug: "current-electricity",
          name: "Current Electricity",
          displayOrder: 12,
          topics: [
            { slug: "electric-current-and-ohms-law", name: "Drift Velocity, Ohm's Law & Resistance", displayOrder: 1 },
            { slug: "kirchhoffs-laws", name: "Kirchhoff's Laws & Circuit Applications", displayOrder: 2 },
            { slug: "measuring-instruments", name: "Wheatstone Bridge & Metre Bridge", displayOrder: 3 },
          ],
        },
        {
          slug: "magnetic-effects-of-current",
          name: "Magnetic Effects of Current and Magnetism",
          displayOrder: 13,
          topics: [
            { slug: "biot-savart-and-amperes-law", name: "Biot-Savart Law, Ampere's Law & Solenoids", displayOrder: 1 },
            { slug: "magnetic-forces-and-galvanometer", name: "Lorentz Force, Moving Coil Galvanometer & Conversions", displayOrder: 2 },
            { slug: "magnetic-properties-of-matter", name: "Magnetic Dipoles, Para-, Dia- and Ferromagnetic Materials", displayOrder: 3 },
          ],
        },
        {
          slug: "electromagnetic-induction-and-ac",
          name: "Electromagnetic Induction and Alternating Currents",
          displayOrder: 14,
          topics: [
            { slug: "faradays-and-lenzs-laws", name: "Faraday's Laws, Induced EMF & Lenz's Law", displayOrder: 1 },
            { slug: "inductance", name: "Self & Mutual Inductance, Eddy Currents", displayOrder: 2 },
            { slug: "ac-circuits-and-transformers", name: "AC Circuits, LCR Series Resonance & Transformers", displayOrder: 3 },
          ],
        },
        {
          slug: "electromagnetic-waves",
          name: "Electromagnetic Waves",
          displayOrder: 15,
          topics: [
            { slug: "em-wave-characteristics", name: "Displacement Current & Transverse Nature of EM Waves", displayOrder: 1 },
            { slug: "electromagnetic-spectrum", name: "Electromagnetic Spectrum & Applications", displayOrder: 2 },
          ],
        },
        {
          slug: "optics",
          name: "Optics",
          displayOrder: 16,
          topics: [
            { slug: "reflection-and-refraction", name: "Spherical Mirrors, Thin Lenses & Total Internal Reflection", displayOrder: 1 },
            { slug: "optical-instruments", name: "Prisms, Microscopes & Astronomical Telescopes", displayOrder: 2 },
            { slug: "wave-optics-interference-diffraction", name: "Huygens' Principle, Interference (YDSE) & Diffraction", displayOrder: 3 },
          ],
        },
        {
          slug: "dual-nature-of-matter-and-radiation",
          name: "Dual Nature of Matter and Radiation",
          displayOrder: 17,
          topics: [
            { slug: "photoelectric-effect", name: "Photoelectric Effect & Einstein's Equation", displayOrder: 1 },
            { slug: "matter-waves", name: "De Broglie Relation & Matter Waves", displayOrder: 2 },
          ],
        },
        {
          slug: "atoms-and-nuclei",
          name: "Atoms and Nuclei",
          displayOrder: 18,
          topics: [
            { slug: "rutherford-and-bohr-models", name: "Rutherford Model, Bohr Atom & Hydrogen Spectrum", displayOrder: 1 },
            { slug: "nuclear-structure-and-reactions", name: "Mass Defect, Binding Energy, Nuclear Fission & Fusion", displayOrder: 2 },
          ],
        },
        {
          slug: "electronic-devices",
          name: "Electronic Devices",
          displayOrder: 19,
          topics: [
            { slug: "semiconductor-diodes", name: "p-n Junction Diodes, I-V Characteristics & Rectifiers", displayOrder: 1 },
            { slug: "logic-gates", name: "Basic Logic Gates (OR, AND, NOT, NAND, NOR)", displayOrder: 2 },
          ],
        },
        {
          slug: "experimental-skills",
          name: "Experimental Skills",
          displayOrder: 20,
          topics: [
            { slug: "vernier-screw-gauge-pendulum", name: "Vernier Callipers, Screw Gauge & Simple Pendulum Experiments", displayOrder: 1 },
            { slug: "optical-and-electrical-experiments", name: "Prism Refraction, Metre Bridge & Diode Characteristics", displayOrder: 2 },
          ],
        },
      ],
    },
    {
      slug: "chemistry",
      name: "Chemistry",
      displayOrder: 2,
      chapters: [
        {
          slug: "basic-concepts-of-chemistry",
          name: "Some Basic Concepts in Chemistry",
          displayOrder: 1,
          topics: [
            { slug: "matter-and-mole-concept", name: "Matter, Laws of Chemical Combination & Mole Concept", displayOrder: 1 },
            { slug: "stoichiometry-and-concentration", name: "Percentage Composition, Empirical Formula & Stoichiometry", displayOrder: 2 },
          ],
        },
        {
          slug: "atomic-structure",
          name: "Atomic Structure",
          displayOrder: 2,
          topics: [
            { slug: "bohr-model-and-quantum-mechanics", name: "Bohr's Atomic Model, De Broglie Relation & Heisenberg Uncertainty", displayOrder: 1 },
            { slug: "quantum-numbers-and-orbitals", name: "Quantum Numbers, Shapes of Orbitals & Electronic Configuration", displayOrder: 2 },
          ],
        },
        {
          slug: "chemical-bonding",
          name: "Chemical Bonding and Molecular Structure",
          displayOrder: 3,
          topics: [
            { slug: "ionic-and-covalent-bonding", name: "Ionic, Covalent & Coordinate Bonds, Octet Rule", displayOrder: 1 },
            { slug: "vsepr-and-hybridisation", name: "VSEPR Theory, Valence Bond Theory & Hybridisation", displayOrder: 2 },
            { slug: "molecular-orbital-theory", name: "Molecular Orbital Theory & Hydrogen Bonding", displayOrder: 3 },
          ],
        },
        {
          slug: "chemical-thermodynamics",
          name: "Chemical Thermodynamics",
          displayOrder: 4,
          topics: [
            { slug: "first-law-and-enthalpy", name: "State Functions, First Law of Thermodynamics, Enthalpy", displayOrder: 1 },
            { slug: "thermochemistry-hess-law", name: "Hess's Law of Constant Heat Summation & Bond Dissociation Enthalpy", displayOrder: 2 },
            { slug: "spontaneity-entropy-gibbs-energy", name: "Entropy, Second Law & Gibbs Energy Change", displayOrder: 3 },
          ],
        },
        {
          slug: "solutions",
          name: "Solutions",
          displayOrder: 5,
          topics: [
            { slug: "types-of-solutions-and-raoults-law", name: "Vapour Pressure, Raoult's Law & Ideal Solutions", displayOrder: 1 },
            { slug: "colligative-properties-and-van-t-hoff", name: "Colligative Properties & Van 't Hoff Factor", displayOrder: 2 },
          ],
        },
        {
          slug: "equilibrium",
          name: "Equilibrium",
          displayOrder: 6,
          topics: [
            { slug: "chemical-equilibrium-le-chatelier", name: "Law of Mass Action, Equilibrium Constant & Le Chatelier's Principle", displayOrder: 1 },
            { slug: "ionic-equilibrium-and-ph", name: "Ionization of Acids/Bases, pH Scale & Buffer Solutions", displayOrder: 2 },
            { slug: "solubility-product", name: "Solubility Product & Common Ion Effect", displayOrder: 3 },
          ],
        },
        {
          slug: "redox-reactions-and-electrochemistry",
          name: "Redox Reactions and Electrochemistry",
          displayOrder: 7,
          topics: [
            { slug: "redox-reactions-and-oxidation-number", name: "Oxidation Numbers & Balancing Redox Equations", displayOrder: 1 },
            { slug: "galvanic-cells-and-nernst-equation", name: "Electrochemical Cells, EMF & Nernst Equation", displayOrder: 2 },
            { slug: "conductance-and-kohlrausch-law", name: "Electrolytic Conductance & Kohlrausch's Law", displayOrder: 3 },
          ],
        },
        {
          slug: "chemical-kinetics",
          name: "Chemical Kinetics",
          displayOrder: 8,
          topics: [
            { slug: "rate-of-reaction-and-order", name: "Rate Laws, Order & Molecularity of Reactions", displayOrder: 1 },
            { slug: "integrated-rate-equations", name: "Integrated Rate Equations for Zero and First Order Reactions", displayOrder: 2 },
            { slug: "collision-theory-and-arrhenius", name: "Arrhenius Equation & Activation Energy", displayOrder: 3 },
          ],
        },
        {
          slug: "classification-of-elements",
          name: "Classification of Elements and Periodicity",
          displayOrder: 9,
          topics: [
            { slug: "periodic-table-and-trends", name: "Modern Periodic Law & Periodic Trends in Properties", displayOrder: 1 },
          ],
        },
        {
          slug: "p-block-elements",
          name: "p-Block Elements",
          displayOrder: 10,
          topics: [
            { slug: "p-block-general-trends", name: "General Trends & Electronic Configurations of Groups 13 to 18", displayOrder: 1 },
          ],
        },
        {
          slug: "d-and-f-block-elements",
          name: "d- and f-Block Elements",
          displayOrder: 11,
          topics: [
            { slug: "transition-elements-trends", name: "Transition Elements (3d series) Characteristics & Trends", displayOrder: 1 },
            { slug: "lanthanoids-and-actinoids", name: "Lanthanoid Contraction, Oxidation States & Actinoids", displayOrder: 2 },
          ],
        },
        {
          slug: "coordination-compounds",
          name: "Coordination Compounds",
          displayOrder: 12,
          topics: [
            { slug: "werner-theory-and-iupac", name: "Werner's Theory, Ligands, Coordination Number & IUPAC Nomenclature", displayOrder: 1 },
            { slug: "bonding-in-coordination-compounds", name: "Isomerism, Valence Bond Theory & Crystal Field Theory", displayOrder: 2 },
          ],
        },
        {
          slug: "purification-of-organic-compounds",
          name: "Purification and Characterisation of Organic Compounds",
          displayOrder: 13,
          topics: [
            { slug: "purification-methods", name: "Crystallization, Distillation, Chromatography & Qualitative Analysis", displayOrder: 1 },
          ],
        },
        {
          slug: "basic-principles-of-organic-chemistry",
          name: "Some Basic Principles of Organic Chemistry",
          displayOrder: 14,
          topics: [
            { slug: "iupac-nomenclature-and-isomerism", name: "IUPAC Nomenclature & Structural/Stereo Isomerism", displayOrder: 1 },
            { slug: "electronic-displacements-and-intermediates", name: "Inductive, Electromeric, Resonance Effects & Reactive Intermediates", displayOrder: 2 },
          ],
        },
        {
          slug: "hydrocarbons",
          name: "Hydrocarbons",
          displayOrder: 15,
          topics: [
            { slug: "alkanes-alkenes-alkynes", name: "Alkanes, Alkenes, Alkynes Preparation & Properties", displayOrder: 1 },
            { slug: "aromatic-hydrocarbons", name: "Benzene, Aromaticity & Electrophilic Substitution", displayOrder: 2 },
          ],
        },
        {
          slug: "organic-compounds-containing-halogens",
          name: "Organic Compounds Containing Halogens",
          displayOrder: 16,
          topics: [
            { slug: "haloalkanes-and-haloarenes", name: "Haloalkanes, Haloarenes, SN1 and SN2 Mechanisms", displayOrder: 1 },
          ],
        },
        {
          slug: "organic-compounds-containing-oxygen",
          name: "Organic Compounds Containing Oxygen",
          displayOrder: 17,
          topics: [
            { slug: "alcohols-phenols-ethers", name: "Alcohols, Phenols & Ethers Reactions and Mechanism", displayOrder: 1 },
            { slug: "aldehydes-and-ketones", name: "Aldehydes and Ketones Nucleophilic Addition Reactions", displayOrder: 2 },
            { slug: "carboxylic-acids", name: "Carboxylic Acids Acidity & Derivatives", displayOrder: 3 },
          ],
        },
        {
          slug: "organic-compounds-containing-nitrogen",
          name: "Organic Compounds Containing Nitrogen",
          displayOrder: 18,
          topics: [
            { slug: "amines-and-diazonium-salts", name: "Amines Basicity, Reactions & Diazonium Salts", displayOrder: 1 },
          ],
        },
        {
          slug: "biomolecules",
          name: "Biomolecules",
          displayOrder: 19,
          topics: [
            { slug: "carbohydrates-proteins-enzymes", name: "Carbohydrates, Amino Acids, Proteins & Enzymes", displayOrder: 1 },
            { slug: "nucleic-acids-and-vitamins", name: "DNA, RNA & Vitamins Classification and Biological Functions", displayOrder: 2 },
          ],
        },
        {
          slug: "principles-related-to-practical-chemistry",
          name: "Principles Related to Practical Chemistry",
          displayOrder: 20,
          topics: [
            { slug: "qualitative-and-volumetric-analysis", name: "Detection of Functional Groups, Titration & Salt Analysis", displayOrder: 1 },
          ],
        },
      ],
    },
    {
      slug: "biology",
      name: "Biology",
      displayOrder: 3,
      chapters: [
        {
          slug: "diversity-in-living-world",
          name: "Diversity in Living World",
          displayOrder: 1,
          topics: [
            { slug: "living-world-and-taxonomy", name: "What is Living, Biodiversity & Binomial Nomenclature", displayOrder: 1 },
            { slug: "five-kingdom-classification", name: "Five Kingdom Classification: Monera, Protista, Fungi, Viruses", displayOrder: 2 },
            { slug: "plant-kingdom", name: "Plant Kingdom: Algae, Bryophytes, Pteridophytes, Gymnosperms", displayOrder: 3 },
            { slug: "animal-kingdom", name: "Animal Kingdom: Non-chordates up to phyla, Chordates to classes", displayOrder: 4 },
          ],
        },
        {
          slug: "structural-organisation-in-animals-and-plants",
          name: "Structural Organisation in Animals and Plants",
          displayOrder: 2,
          topics: [
            { slug: "morphology-of-flowering-plants", name: "Morphology & Modifications of Flowering Plants and Selected Families", displayOrder: 1 },
            { slug: "animal-tissues-and-anatomy", name: "Animal Tissues & Organ Systems of Frog / Cockroach", displayOrder: 2 },
          ],
        },
        {
          slug: "cell-structure-and-function",
          name: "Cell Structure and Function",
          displayOrder: 3,
          topics: [
            { slug: "cell-theory-and-organelles", name: "Cell Theory, Prokaryotic & Eukaryotic Cell Organelles", displayOrder: 1 },
            { slug: "biomolecules-in-cell", name: "Chemical Constituents, Proteins, Lipids, Nucleic Acids & Enzymes", displayOrder: 2 },
            { slug: "cell-cycle-and-cell-division", name: "Cell Cycle, Mitosis, Meiosis and Their Significance", displayOrder: 3 },
          ],
        },
        {
          slug: "plant-physiology",
          name: "Plant Physiology",
          displayOrder: 4,
          topics: [
            { slug: "photosynthesis-in-higher-plants", name: "Photosynthetic Pigments, Light Reaction, C3, C4 Pathways", displayOrder: 1 },
            { slug: "respiration-in-plants", name: "Glycolysis, Fermentation, TCA Cycle & Electron Transport System", displayOrder: 2 },
            { slug: "plant-growth-and-development", name: "Phases of Growth, Differentiation & Plant Growth Regulators", displayOrder: 3 },
          ],
        },
        {
          slug: "human-physiology",
          name: "Human Physiology",
          displayOrder: 5,
          topics: [
            { slug: "breathing-and-exchange-of-gases", name: "Respiratory System, Mechanism of Breathing & Disorders", displayOrder: 1 },
            { slug: "body-fluids-and-circulation", name: "Blood, Lymph, Cardiac Cycle, ECG & Circulatory Disorders", displayOrder: 2 },
            { slug: "excretory-products-and-elimination", name: "Human Excretory System, Urine Formation & Kidney Regulation", displayOrder: 3 },
            { slug: "locomotion-and-movement", name: "Muscular Contraction Mechanism, Skeletal System & Joints", displayOrder: 4 },
            { slug: "neural-control-and-coordination", name: "Nervous System, Nerve Impulse Generation & Conduction", displayOrder: 5 },
            { slug: "chemical-coordination-and-integration", name: "Endocrine Glands, Hormone Action & Endocrine Disorders", displayOrder: 6 },
          ],
        },
        {
          slug: "sexual-reproduction-in-flowering-plants",
          name: "Sexual Reproduction in Flowering Plants",
          displayOrder: 6,
          topics: [
            { slug: "flower-structure-and-pollination", name: "Flower Structure, Gametophyte Development & Pollination", displayOrder: 1 },
            { slug: "fertilisation-and-seed-development", name: "Double Fertilisation, Embryo, Seed and Fruit Formation", displayOrder: 2 },
          ],
        },
        {
          slug: "human-reproduction",
          name: "Human Reproduction",
          displayOrder: 7,
          topics: [
            { slug: "male-and-female-reproductive-systems", name: "Male and Female Reproductive Systems Anatomy", displayOrder: 1 },
            { slug: "microscopic-anatomy-testis-ovary", name: "Microscopic Anatomy of Testis and Ovary", displayOrder: 2 },
            { slug: "gametogenesis", name: "Gametogenesis: Spermatogenesis and Oogenesis", displayOrder: 3 },
            { slug: "menstrual-cycle", name: "Menstrual Cycle Phases and Hormonal Regulation", displayOrder: 4 },
            { slug: "fertilisation-and-implantation", name: "Fertilisation, Blastocyst Formation and Implantation", displayOrder: 5 },
            { slug: "pregnancy-and-parturition", name: "Pregnancy, Placenta Formation, Parturition and Lactation", displayOrder: 6 },
          ],
        },
        {
          slug: "reproductive-health",
          name: "Reproductive Health",
          displayOrder: 8,
          topics: [
            { slug: "contraception-and-population-control", name: "Need for Reproductive Health, STDs & Contraceptive Methods", displayOrder: 1 },
            { slug: "mtp-and-assisted-reproductive-tech", name: "Medical Termination of Pregnancy, Amniocentesis & ART (IVF/ZIFT/GIFT)", displayOrder: 2 },
          ],
        },
        {
          slug: "genetics-and-evolution",
          name: "Genetics and Evolution",
          displayOrder: 9,
          topics: [
            { slug: "principles-of-inheritance", name: "Mendelian Inheritance, Deviations, Linkage & Genetic Disorders", displayOrder: 1 },
            { slug: "molecular-basis-of-inheritance", name: "DNA Structure, Replication, Transcription, Genetic Code & Operon", displayOrder: 2 },
            { slug: "evolutionary-biology", name: "Origin of Life, Biological Evidences, Natural Selection & Human Evolution", displayOrder: 3 },
          ],
        },
        {
          slug: "biology-and-human-welfare",
          name: "Biology and Human Welfare",
          displayOrder: 10,
          topics: [
            { slug: "human-health-and-disease", name: "Common Human Diseases, Immunology, Cancer, AIDS & Drug Abuse", displayOrder: 1 },
            { slug: "microbes-in-human-welfare", name: "Microbes in Household, Industry, Sewage & Biocontrol", displayOrder: 2 },
          ],
        },
        {
          slug: "biotechnology-and-its-applications",
          name: "Biotechnology and Its Applications",
          displayOrder: 11,
          topics: [
            { slug: "biotechnology-principles-and-processes", name: "Recombinant DNA Technology Tools & Processes", displayOrder: 1 },
            { slug: "biotechnology-applications", name: "Applications in Medicine, GM Crops, Transgenic Animals & Biosafety", displayOrder: 2 },
          ],
        },
        {
          slug: "ecology-and-environment",
          name: "Ecology and Environment",
          displayOrder: 12,
          topics: [
            { slug: "organisms-and-populations", name: "Organism & Environment, Population Attributes & Interactions", displayOrder: 1 },
            { slug: "ecosystem-structure-and-energy-flow", name: "Ecosystem Components, Energy Flow, Decomposition & Pyramids", displayOrder: 2 },
            { slug: "biodiversity-and-conservation", name: "Biodiversity Patterns, Loss, Red Data Book & In-Situ/Ex-Situ Conservation", displayOrder: 3 },
          ],
        },
      ],
    },
  ],
};
