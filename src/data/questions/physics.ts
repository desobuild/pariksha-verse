import type { AuthoredQuestionSpec } from "./authored-types";

/**
 * Physics — 50 original ParikshaVerse authored questions.
 * All topics reference the canonical seeded NEET taxonomy; no topic is invented.
 * Numerical answers were verified independently (see tests/unit/authored-questions-numerical.test.ts).
 */
export const AUTHORED_PHYSICS_SPECS: AuthoredQuestionSpec[] = [
  // ---------------------------------------------------------------------------
  // Physics and Measurement -> Units of Measurement (2)
  // ---------------------------------------------------------------------------
  {
    id: "001",
    topicId: "exam_neet_physics_physics-and-measurement_units-and-measurements",
    text: "Which of the following SI base units is used to measure luminous intensity?",
    difficulty: "easy",
    explanation:
      "The SI base unit of luminous intensity is the candela (cd). Mole measures amount of substance, kelvin measures temperature, and ampere measures electric current.",
    options: ["Candela", "Mole", "Kelvin", "Ampere"],
    correctIndex: 0,
  },
  {
    id: "002",
    topicId: "exam_neet_physics_physics-and-measurement_units-and-measurements",
    text: "The watt is the SI unit of power. Expressed purely in SI base units, 1 watt equals:",
    difficulty: "medium",
    explanation:
      "Power = energy/time, and 1 J = 1 N·m = 1 kg·m²·s⁻². Dividing by seconds gives 1 W = 1 kg·m²·s⁻³.",
    options: ["kg·m²·s⁻³", "kg·m·s⁻²", "kg·m²·s⁻²", "kg·m⁻¹·s⁻³"],
    correctIndex: 0,
  },
  // ---------------------------------------------------------------------------
  // Physics and Measurement -> Dimensional Analysis (2)
  // ---------------------------------------------------------------------------
  {
    id: "003",
    topicId: "exam_neet_physics_physics-and-measurement_dimensional-analysis",
    text: "Which physical quantity has the same dimensional formula as impulse?",
    difficulty: "easy",
    explanation:
      "Impulse = force × time = (MLT⁻²)(T) = MLT⁻¹, which is exactly the dimensional formula of momentum — consistent with the impulse–momentum theorem.",
    options: ["Momentum", "Force", "Energy", "Power"],
    correctIndex: 0,
  },
  {
    id: "004",
    topicId: "exam_neet_physics_physics-and-measurement_dimensional-analysis",
    text: "For the viscous force F = η·A·(dv/dx) acting between fluid layers, the dimensional formula of the coefficient of viscosity η is:",
    difficulty: "medium",
    explanation:
      "Rearranging, η = F·x/(A·v). Substituting dimensions: (MLT⁻²·L)/(L²·LT⁻¹) = ML⁻¹T⁻¹, the standard dimension of viscosity (SI unit: pascal-second).",
    options: ["[ML⁻¹T⁻¹]", "[MLT⁻¹]", "[ML⁻²T⁻¹]", "[ML⁻¹T⁻²]"],
    correctIndex: 0,
  },
  // ---------------------------------------------------------------------------
  // Kinematics -> Motion in a Straight Line (2)
  // ---------------------------------------------------------------------------
  {
    id: "005",
    topicId: "exam_neet_physics_kinematics_motion-in-straight-line",
    text: "A car covers the first half of the distance between two towns at 40 km/h and the second half at 60 km/h. Its average speed for the whole journey is:",
    difficulty: "hard",
    explanation:
      "For equal distances, average speed is the harmonic mean: 2v₁v₂/(v₁+v₂) = 2×40×60/100 = 48 km/h. The naive arithmetic mean (50 km/h) is incorrect because more time is spent at the slower speed.",
    options: ["48 km/h", "50 km/h", "45 km/h", "52 km/h"],
    correctIndex: 0,
  },
  {
    id: "006",
    topicId: "exam_neet_physics_kinematics_motion-in-straight-line",
    text: "A cyclist rides along a straight road at a constant speed of 10 m/s. How far does she travel in 5 s?",
    difficulty: "easy",
    explanation: "For constant speed, distance = speed × time = 10 × 5 = 50 m.",
    options: ["50 m", "25 m", "2 m", "100 m"],
    correctIndex: 0,
  },
  // ---------------------------------------------------------------------------
  // Kinematics -> Uniformly Accelerated Motion (2)
  // ---------------------------------------------------------------------------
  {
    id: "007",
    topicId: "exam_neet_physics_kinematics_uniformly-accelerated-motion",
    text: "A body moving with uniform acceleration covers 40 m in the first 4 s and 80 m in the next 4 s. Its initial velocity and acceleration are:",
    difficulty: "hard",
    explanation:
      "First interval: s = 4u + 8a = 40 → u + 2a = 10. Total in 8 s: 8u + 32a = 120 → u + 4a = 15. Subtracting gives a = 2.5 m/s² and u = 5 m/s.",
    options: [
      "u = 5 m/s, a = 2.5 m/s²",
      "u = 10 m/s, a = 2.5 m/s²",
      "u = 5 m/s, a = 5 m/s²",
      "u = 2.5 m/s, a = 5 m/s²",
    ],
    correctIndex: 0,
  },
  {
    id: "008",
    topicId: "exam_neet_physics_kinematics_uniformly-accelerated-motion",
    text: "A ball is thrown vertically upward with a speed of 20 m/s (g = 10 m/s²). The maximum height it reaches is:",
    difficulty: "easy",
    explanation: "At the highest point v = 0, so h = u²/(2g) = 20²/(2×10) = 400/20 = 20 m.",
    options: ["20 m", "40 m", "10 m", "200 m"],
    correctIndex: 0,
  },
  // ---------------------------------------------------------------------------
  // Kinematics -> Projectile and Circular Motion (3)
  // ---------------------------------------------------------------------------
  {
    id: "009",
    topicId: "exam_neet_physics_kinematics_projectile-and-circular-motion",
    text: "For a projectile launched from and landing on the same horizontal level, its velocity at the highest point of the trajectory is:",
    difficulty: "easy",
    explanation:
      "At the highest point the vertical component of velocity is momentarily zero, but the horizontal component (u cosθ) remains unchanged, so the velocity is entirely horizontal.",
    options: [
      "Entirely horizontal",
      "Zero",
      "Entirely vertical",
      "Directed at 45° to the horizontal",
    ],
    correctIndex: 0,
  },
  {
    id: "010",
    topicId: "exam_neet_physics_kinematics_projectile-and-circular-motion",
    text: "A projectile is launched at 45° to the horizontal with speed 20 m/s (g = 10 m/s²). Its time of flight is:",
    difficulty: "medium",
    explanation: "T = 2u·sinθ/g = 2×20×sin45°/10 = 4×(√2/2) = 2√2 ≈ 2.8 s.",
    options: ["2√2 s ≈ 2.8 s", "2.0 s", "4.0 s", "√2 s ≈ 1.4 s"],
    correctIndex: 0,
  },
  {
    id: "011",
    topicId: "exam_neet_physics_kinematics_projectile-and-circular-motion",
    text: "A particle moves with a constant speed of 6 m/s in a circle of radius 2 m. The magnitude of its centripetal acceleration is:",
    difficulty: "medium",
    explanation:
      "Centripetal acceleration a = v²/r = 6²/2 = 36/2 = 18 m/s², directed toward the centre of the circle.",
    options: ["18 m/s²", "12 m/s²", "9 m/s²", "36 m/s²"],
    correctIndex: 0,
  },
  // ---------------------------------------------------------------------------
  // Laws of Motion -> Conservation of Momentum (2)
  // ---------------------------------------------------------------------------
  {
    id: "012",
    topicId: "exam_neet_physics_laws-of-motion_conservation-of-momentum",
    text: "A 2 kg trolley moving at 3 m/s collides with and sticks to a stationary 1 kg trolley. Their common velocity immediately after the collision is:",
    difficulty: "medium",
    explanation:
      "Momentum is conserved in the absence of external forces: 2×3 = (2+1)v, so v = 6/3 = 2 m/s.",
    options: ["2 m/s", "1.5 m/s", "3 m/s", "1 m/s"],
    correctIndex: 0,
  },
  {
    id: "013",
    topicId: "exam_neet_physics_laws-of-motion_conservation-of-momentum",
    text: "A rifle of mass 3 kg fires a bullet of mass 60 g and recoils at 1.5 m/s. The speed of the bullet as it leaves the rifle is:",
    difficulty: "hard",
    explanation:
      "By momentum conservation, 0.060 kg × v = 3 kg × 1.5 m/s = 4.5 kg·m/s, so v = 4.5/0.060 = 75 m/s. The bullet's mass must be converted from grams to kilograms before dividing.",
    options: ["75 m/s", "45 m/s", "150 m/s", "7.5 m/s"],
    correctIndex: 0,
  },
  // ---------------------------------------------------------------------------
  // Laws of Motion -> Friction (2)
  // ---------------------------------------------------------------------------
  {
    id: "014",
    topicId: "exam_neet_physics_laws-of-motion_friction",
    text: "The maximum value of static friction between two surfaces, reached just before sliding begins, is called:",
    difficulty: "easy",
    explanation:
      "Static friction adjusts up to a maximum called limiting friction; beyond this the surfaces begin to slide and kinetic friction takes over (usually slightly smaller).",
    options: ["Limiting friction", "Rolling friction", "Kinetic friction", "Normal reaction"],
    correctIndex: 0,
  },
  {
    id: "015",
    topicId: "exam_neet_physics_laws-of-motion_friction",
    text: "A 5 kg block on a horizontal floor (μk = 0.2) is pulled by a horizontal force of 20 N. Its acceleration is (g = 10 m/s²):",
    difficulty: "hard",
    explanation:
      "Normal reaction N = mg = 50 N, so kinetic friction f = μk·N = 0.2×50 = 10 N opposing the motion. Net force = 20 − 10 = 10 N, giving a = 10/5 = 2 m/s².",
    options: ["2 m/s²", "4 m/s²", "1 m/s²", "0 m/s²"],
    correctIndex: 0,
  },
  // ---------------------------------------------------------------------------
  // Laws of Motion -> Dynamics of Circular Motion (2)
  // ---------------------------------------------------------------------------
  {
    id: "016",
    topicId: "exam_neet_physics_laws-of-motion_circular-motion-dynamics",
    text: "A car takes a flat (unbanked) circular turn of radius 50 m. If the coefficient of static friction is 0.4, the maximum speed at which it can take the turn without skidding is (g = 10 m/s²):",
    difficulty: "medium",
    explanation:
      "Friction provides the centripetal force: μmg ≥ mv²/r, so v_max = √(μgr) = √(0.4×10×50) = √200 = 10√2 ≈ 14.1 m/s.",
    options: ["10√2 m/s ≈ 14.1 m/s", "20 m/s", "25 m/s", "5√2 m/s ≈ 7.1 m/s"],
    correctIndex: 0,
  },
  {
    id: "017",
    topicId: "exam_neet_physics_laws-of-motion_circular-motion-dynamics",
    text: "A car moves at constant speed around a flat circular track. The net force on the car points:",
    difficulty: "easy",
    explanation:
      "Uniform circular motion requires a centripetal net force directed toward the centre of the circle; the speed stays constant because this force is perpendicular to the velocity.",
    options: [
      "Toward the centre of the circle",
      "Along the direction of motion (tangent)",
      "Away from the centre of the circle",
      "There is no net force",
    ],
    correctIndex: 0,
  },
  // ---------------------------------------------------------------------------
  // Work, Energy and Power -> Work-Energy Theorem (2)
  // ---------------------------------------------------------------------------
  {
    id: "018",
    topicId: "exam_neet_physics_work-energy-and-power_work-energy-theorem",
    text: "A 2 kg body is accelerated from 5 m/s to 10 m/s on a frictionless horizontal surface. The net work done on it is:",
    difficulty: "medium",
    explanation: "By the work–energy theorem, W_net = ΔKE = ½m(v² − u²) = ½×2×(100 − 25) = 75 J.",
    options: ["75 J", "50 J", "100 J", "25 J"],
    correctIndex: 0,
  },
  {
    id: "019",
    topicId: "exam_neet_physics_work-energy-and-power_work-energy-theorem",
    text: "The work done by the centripetal force on a particle completing one full circle in uniform circular motion is:",
    difficulty: "easy",
    explanation:
      "The centripetal force is always perpendicular to the instantaneous displacement, so W = F·s·cos90° = 0 at every point of the path.",
    options: [
      "Zero",
      "Equal to the kinetic energy of the particle",
      "Positive and constant",
      "Negative and constant",
    ],
    correctIndex: 0,
  },
  // ---------------------------------------------------------------------------
  // Work, Energy and Power -> Conservation of Energy (2)
  // ---------------------------------------------------------------------------
  {
    id: "020",
    topicId: "exam_neet_physics_work-energy-and-power_conservation-of-energy",
    text: "A 1 kg ball dropped from a height of 5 m rebounds to a height of 2 m (g = 10 m/s²). The mechanical energy lost during the bounce is:",
    difficulty: "medium",
    explanation:
      "Initial PE = mgh₁ = 1×10×5 = 50 J; rebound PE = mgh₂ = 1×10×2 = 20 J. The difference, 30 J, is converted to heat, sound and deformation.",
    options: ["30 J", "20 J", "50 J", "10 J"],
    correctIndex: 0,
  },
  {
    id: "021",
    topicId: "exam_neet_physics_work-energy-and-power_conservation-of-energy",
    text: "A spring of stiffness k compressed by a distance x stores elastic energy ½kx². If the compression is doubled, the stored energy becomes:",
    difficulty: "medium",
    explanation:
      "E ∝ x². Doubling x gives E' = ½k(2x)² = 4×(½kx²), i.e. four times the original energy.",
    options: [
      "Four times the original energy",
      "Twice the original energy",
      "Half the original energy",
      "Unchanged",
    ],
    correctIndex: 0,
  },
  // ---------------------------------------------------------------------------
  // Work, Energy and Power -> Collisions (2)
  // ---------------------------------------------------------------------------
  {
    id: "022",
    topicId: "exam_neet_physics_work-energy-and-power_collisions",
    text: "A ball moving at speed u undergoes a head-on elastic collision with an identical ball at rest on a frictionless surface. After the collision:",
    difficulty: "medium",
    explanation:
      "For equal masses in a 1-D elastic collision, the velocities are simply exchanged: the first ball comes to rest and the second moves off with speed u (both momentum and kinetic energy are conserved).",
    options: [
      "The first ball stops and the second moves off with speed u",
      "Both balls move together with speed u/2",
      "The first ball rebounds with speed u and the second stays at rest",
      "Both balls move forward, each with speed u/2",
    ],
    correctIndex: 0,
  },
  {
    id: "023",
    topicId: "exam_neet_physics_work-energy-and-power_collisions",
    text: "A ball of mass m strikes a rigid wall at speed v and rebounds elastically along its original path at the same speed. The magnitude of the impulse imparted to the ball is:",
    difficulty: "medium",
    explanation:
      "Impulse = change in momentum = mv − (−mv) = 2mv, since the velocity reverses direction while keeping its magnitude.",
    options: ["2mv", "mv", "Zero", "mv/2"],
    correctIndex: 0,
  },
  // ---------------------------------------------------------------------------
  // Rotational Motion -> Torque and Angular Momentum (1)
  // ---------------------------------------------------------------------------
  {
    id: "024",
    topicId: "exam_neet_physics_rotational-motion_torque-and-angular-momentum",
    text: "A force of 10 N is applied at a point 2 m from a pivot, with the force making an angle of 30° with the position vector. The magnitude of the torque about the pivot is:",
    difficulty: "medium",
    explanation:
      "Torque τ = r·F·sinθ = 2×10×sin30° = 20×0.5 = 10 N·m. Only the component of force perpendicular to the position vector contributes.",
    options: ["10 N·m", "20 N·m", "17.3 N·m", "5 N·m"],
    correctIndex: 0,
  },
  // ---------------------------------------------------------------------------
  // Rotational Motion -> Moment of Inertia (1)
  // ---------------------------------------------------------------------------
  {
    id: "025",
    topicId: "exam_neet_physics_rotational-motion_moment-of-inertia",
    text: "The moment of inertia of a uniform rod of mass M and length L about an axis through its centre and perpendicular to its length is:",
    difficulty: "medium",
    explanation:
      "For a uniform rod about its centre, I = ML²/12. About an axis through one end it is ML²/3, obtained from the parallel-axis theorem.",
    options: ["ML²/12", "ML²/3", "ML²/4", "ML²/2"],
    correctIndex: 0,
  },
  // ---------------------------------------------------------------------------
  // Gravitation -> Universal Law of Gravitation (2)
  // ---------------------------------------------------------------------------
  {
    id: "026",
    topicId: "exam_neet_physics_gravitation_universal-law-of-gravitation",
    text: "If the distance between two point masses is doubled, the gravitational force between them becomes:",
    difficulty: "easy",
    explanation:
      "F ∝ 1/r². Doubling r reduces the force by a factor of 2² = 4, so the new force is F/4.",
    options: [
      "One-fourth of the original force",
      "Half the original force",
      "Twice the original force",
      "Four times the original force",
    ],
    correctIndex: 0,
  },
  {
    id: "027",
    topicId: "exam_neet_physics_gravitation_universal-law-of-gravitation",
    text: "The acceleration due to gravity at a height equal to the Earth's radius R above the surface is (g = value at the surface):",
    difficulty: "medium",
    explanation: "g' = g·R²/(R+h)². With h = R, g' = g·R²/(2R)² = g/4.",
    options: ["g/4", "g/2", "g/9", "g/16"],
    correctIndex: 0,
  },
  // ---------------------------------------------------------------------------
  // Gravitation -> Gravitational Potential and Escape Velocity (2)
  // ---------------------------------------------------------------------------
  {
    id: "028",
    topicId: "exam_neet_physics_gravitation_gravitational-potential-and-escape-velocity",
    text: "The escape velocity from Earth's surface is about 11.2 km/s. For a planet with twice Earth's mass and the same radius, the escape velocity is:",
    difficulty: "hard",
    explanation:
      "v_e = √(2GM/R), so v_e ∝ √M for fixed R. Doubling M multiplies v_e by √2: 11.2×√2 ≈ 15.8 km/s.",
    options: ["≈ 15.8 km/s", "≈ 22.4 km/s", "≈ 11.2 km/s", "≈ 7.9 km/s"],
    correctIndex: 0,
  },
  {
    id: "029",
    topicId: "exam_neet_physics_gravitation_gravitational-potential-and-escape-velocity",
    text: "A planet has the same average density as Earth but half Earth's radius. The escape velocity from its surface is:",
    difficulty: "hard",
    explanation:
      "With M = (4/3)πR³ρ, v_e = R√(8πGρ/3), so for fixed density v_e ∝ R. Half the radius gives half Earth's escape velocity: 11.2/2 = 5.6 km/s.",
    options: ["≈ 5.6 km/s", "≈ 11.2 km/s", "≈ 15.8 km/s", "≈ 2.8 km/s"],
    correctIndex: 0,
  },
  // ---------------------------------------------------------------------------
  // Thermodynamics -> Zeroth and First Law (2)
  // ---------------------------------------------------------------------------
  {
    id: "030",
    topicId: "exam_neet_physics_thermodynamics_zeroth-and-first-law",
    text: "The Zeroth Law of Thermodynamics, which deals with systems in thermal equilibrium, provides the basis for the concept of:",
    difficulty: "easy",
    explanation:
      "If two systems are each in thermal equilibrium with a third, they are in equilibrium with each other — this allows the definition of a common property called temperature.",
    options: ["Temperature", "Heat", "Entropy", "Pressure"],
    correctIndex: 0,
  },
  {
    id: "031",
    topicId: "exam_neet_physics_thermodynamics_zeroth-and-first-law",
    text: "A gas absorbs 500 J of heat while doing 200 J of work on its surroundings. The change in its internal energy is:",
    difficulty: "medium",
    explanation: "First law: ΔU = Q − W (work done by the gas). ΔU = 500 − 200 = +300 J.",
    options: ["+300 J", "+700 J", "−300 J", "+200 J"],
    correctIndex: 0,
  },
  // ---------------------------------------------------------------------------
  // Thermodynamics -> Thermodynamic Processes (1)
  // ---------------------------------------------------------------------------
  {
    id: "032",
    topicId: "exam_neet_physics_thermodynamics_thermodynamic-processes",
    text: "During the isothermal expansion of an ideal gas:",
    difficulty: "medium",
    explanation:
      "Isothermal means ΔT = 0, so for an ideal gas ΔU = 0. The first law then gives Q = W: all the heat absorbed is converted into work done by the gas.",
    options: [
      "Its internal energy is unchanged and the heat absorbed equals the work done by the gas",
      "Its temperature rises steadily",
      "It does no work on the surroundings",
      "Its internal energy increases because heat is supplied",
    ],
    correctIndex: 0,
  },
  // ---------------------------------------------------------------------------
  // Thermodynamics -> Second Law (1)
  // ---------------------------------------------------------------------------
  {
    id: "033",
    topicId: "exam_neet_physics_thermodynamics_second-law",
    text: "A heat engine operates between a hot reservoir at 500 K and a cold reservoir at 300 K. Its maximum possible efficiency is:",
    difficulty: "medium",
    explanation:
      "For a Carnot engine, η = 1 − T_c/T_h = 1 − 300/500 = 0.40 = 40%. No engine between these reservoirs can do better.",
    options: ["40%", "60%", "25%", "75%"],
    correctIndex: 0,
  },
  // ---------------------------------------------------------------------------
  // Kinetic Theory of Gases -> Equipartition and Specific Heat (2)
  // ---------------------------------------------------------------------------
  {
    id: "034",
    topicId: "exam_neet_physics_kinetic-theory-of-gases_equipartition-and-specific-heat",
    text: "For a monatomic ideal gas, the ratio of specific heats γ = C_p/C_v equals:",
    difficulty: "medium",
    explanation:
      "A monatomic gas has 3 translational degrees of freedom: C_v = (3/2)R and C_p = (5/2)R, so γ = 5/3 ≈ 1.67.",
    options: ["5/3", "7/5", "4/3", "3/2"],
    correctIndex: 0,
  },
  {
    id: "035",
    topicId: "exam_neet_physics_kinetic-theory-of-gases_equipartition-and-specific-heat",
    text: "The total internal energy of one mole of a monatomic ideal gas at temperature T is:",
    difficulty: "medium",
    explanation:
      "Each of the 3 translational degrees of freedom carries (1/2)kT per molecule, giving U = (3/2)RT per mole by the law of equipartition.",
    options: ["(3/2)RT", "(5/2)RT", "3RT", "RT"],
    correctIndex: 0,
  },
  // ---------------------------------------------------------------------------
  // Electrostatics -> Coulomb's Law and Electric Field (2)
  // ---------------------------------------------------------------------------
  {
    id: "036",
    topicId: "exam_neet_physics_electrostatics_coulombs-law-and-electric-field",
    text: "Two point charges +q and +4q are fixed a distance d apart. The point on the line joining them where the net electric field is zero is located:",
    difficulty: "hard",
    explanation:
      "Setting kq/x² = k·4q/(d−x)² gives (d−x)² = 4x², so d − x = 2x and x = d/3. The null point lies d/3 from +q, closer to the smaller charge.",
    options: [
      "At a distance d/3 from the charge +q",
      "Exactly midway between the charges",
      "At a distance 2d/3 from the charge +q",
      "At a distance d/4 from the charge +q",
    ],
    correctIndex: 0,
  },
  {
    id: "037",
    topicId: "exam_neet_physics_electrostatics_coulombs-law-and-electric-field",
    text: "Two electric field lines can never cross each other because:",
    difficulty: "easy",
    explanation:
      "At any point the electric field has a single unique direction. If two lines crossed, there would be two directions for the field at the same point, which is impossible.",
    options: [
      "The field has a unique direction at every point",
      "Field lines always repel each other like charges",
      "The field strength would become infinite where they cross",
      "Field lines exist only inside conductors",
    ],
    correctIndex: 0,
  },
  // ---------------------------------------------------------------------------
  // Electrostatics -> Electric Potential and Dipole (1)
  // ---------------------------------------------------------------------------
  {
    id: "038",
    topicId: "exam_neet_physics_electrostatics_electric-potential-and-dipole",
    text: "The work done in moving a test charge between two points lying on the same equipotential surface is:",
    difficulty: "easy",
    explanation:
      "Work = q·ΔV. Since both points are at the same potential, ΔV = 0 and hence no net work is done (the path may still require force, but the net work is zero).",
    options: ["Zero", "Equal to q times the distance moved", "Always positive", "Always negative"],
    correctIndex: 0,
  },
  // ---------------------------------------------------------------------------
  // Electrostatics -> Capacitance (2)
  // ---------------------------------------------------------------------------
  {
    id: "039",
    topicId: "exam_neet_physics_electrostatics_capacitance",
    text: "A 2 μF and a 3 μF capacitor are connected in series. Their equivalent capacitance is:",
    difficulty: "medium",
    explanation:
      "For capacitors in series, 1/C = 1/C₁ + 1/C₂, so C = C₁C₂/(C₁+C₂) = 6/5 = 1.2 μF. Series capacitance is always smaller than either capacitor.",
    options: ["1.2 μF", "5 μF", "2.5 μF", "6 μF"],
    correctIndex: 0,
  },
  {
    id: "040",
    topicId: "exam_neet_physics_electrostatics_capacitance",
    text: "A parallel-plate capacitor is charged and then disconnected from the battery. If the plate separation is then doubled, the energy stored in the capacitor:",
    difficulty: "hard",
    explanation:
      "With the battery disconnected, the charge Q is fixed. Doubling the separation halves C, and U = Q²/(2C) therefore doubles — the external work done pulling the plates apart is stored as extra field energy.",
    options: ["Doubles", "Halves", "Remains unchanged", "Becomes four times as large"],
    correctIndex: 0,
  },
  // ---------------------------------------------------------------------------
  // Current Electricity -> Current and Ohm's Law (2)
  // ---------------------------------------------------------------------------
  {
    id: "041",
    topicId: "exam_neet_physics_current-electricity_electric-current-and-ohms-law",
    text: "A wire of resistance R is uniformly stretched to double its length, keeping its volume constant. Its new resistance is:",
    difficulty: "hard",
    explanation:
      "Volume constant means L doubles and the cross-sectional area halves. R' = ρ(2L)/(A/2) = 4ρL/A = 4R.",
    options: ["4R", "2R", "R/2", "R/4"],
    correctIndex: 0,
  },
  {
    id: "042",
    topicId: "exam_neet_physics_current-electricity_electric-current-and-ohms-law",
    text: "Two resistors of 6 Ω each are connected in parallel. Their equivalent resistance is:",
    difficulty: "easy",
    explanation: "For equal resistors in parallel, R_eq = R/n = 6/2 = 3 Ω.",
    options: ["3 Ω", "12 Ω", "6 Ω", "1.5 Ω"],
    correctIndex: 0,
  },
  // ---------------------------------------------------------------------------
  // Magnetic Effects of Current -> Biot-Savart and Ampere's Law (1)
  // ---------------------------------------------------------------------------
  {
    id: "043",
    topicId: "exam_neet_physics_magnetic-effects-of-current_biot-savart-and-amperes-law",
    text: "The magnitude of the magnetic field at the centre of a circular loop of radius R carrying current I is:",
    difficulty: "medium",
    explanation:
      "By the Biot–Savart law, B = μ₀I/(2R) at the centre of a full circular loop — π times the field of a single straight wire at the same distance.",
    options: ["μ₀I/(2R)", "μ₀I/(2πR)", "μ₀I/(4πR)", "μ₀I/(πR)"],
    correctIndex: 0,
  },
  // ---------------------------------------------------------------------------
  // Magnetic Effects of Current -> Magnetic Forces and Galvanometer (2)
  // ---------------------------------------------------------------------------
  {
    id: "044",
    topicId: "exam_neet_physics_magnetic-effects-of-current_magnetic-forces-and-galvanometer",
    text: "A charged particle moving parallel to a uniform magnetic field experiences a magnetic force of magnitude:",
    difficulty: "easy",
    explanation:
      "F = qvB·sinθ. For motion parallel (or antiparallel) to the field, θ = 0° or 180°, so sinθ = 0 and the magnetic force is zero.",
    options: ["Zero", "qvB", "qvB/2", "qB/v"],
    correctIndex: 0,
  },
  {
    id: "045",
    topicId: "exam_neet_physics_magnetic-effects-of-current_magnetic-forces-and-galvanometer",
    text: "To convert a galvanometer into an ammeter that can measure larger currents, one connects:",
    difficulty: "medium",
    explanation:
      "A low-resistance shunt is connected in parallel with the galvanometer so that most of the current bypasses the sensitive coil while the instrument reads the total current. (A voltmeter, in contrast, uses a high resistance in series.)",
    options: [
      "A low-resistance shunt in parallel with the galvanometer",
      "A high resistance in series with the galvanometer",
      "A capacitor in series with the galvanometer",
      "A second identical coil in series with the galvanometer",
    ],
    correctIndex: 0,
  },
  // ---------------------------------------------------------------------------
  // Optics -> Reflection and Refraction (2)
  // ---------------------------------------------------------------------------
  {
    id: "046",
    topicId: "exam_neet_physics_optics_reflection-and-refraction",
    text: "An object is placed at the centre of curvature of a concave mirror. The image formed is:",
    difficulty: "medium",
    explanation:
      "For an object at C (u = 2f), the image forms at C itself: real, inverted and of the same size as the object.",
    options: [
      "Real, inverted and the same size, at the centre of curvature",
      "Virtual, erect and magnified",
      "Real, inverted and highly diminished, at the focus",
      "At infinity",
    ],
    correctIndex: 0,
  },
  {
    id: "047",
    topicId: "exam_neet_physics_optics_reflection-and-refraction",
    text: "A light ray passes from air into water (refractive index 1.33). Which property of the light remains unchanged?",
    difficulty: "easy",
    explanation:
      "On entering a new medium, the speed and wavelength change but the frequency is fixed by the source and remains constant.",
    options: ["Frequency", "Wavelength", "Speed", "Direction of travel"],
    correctIndex: 0,
  },
  // ---------------------------------------------------------------------------
  // Optics -> Wave Optics: Interference and Diffraction (1)
  // ---------------------------------------------------------------------------
  {
    id: "048",
    topicId: "exam_neet_physics_optics_wave-optics-interference-diffraction",
    text: "In a Young's double-slit experiment, the entire apparatus is immersed in water (refractive index 4/3). The fringe width:",
    difficulty: "hard",
    explanation:
      "Fringe width β = λD/d. In water the wavelength shrinks to λ/n = 3λ/4, so β becomes 3/4 of its air value. (Slit separation d and screen distance D are unchanged.)",
    options: [
      "Becomes 3/4 of its original value",
      "Becomes 4/3 of its original value",
      "Remains unchanged",
      "Doubles",
    ],
    correctIndex: 0,
  },
  // ---------------------------------------------------------------------------
  // Dual Nature of Matter and Radiation -> Photoelectric Effect (1)
  // ---------------------------------------------------------------------------
  {
    id: "049",
    topicId: "exam_neet_physics_dual-nature-of-matter-and-radiation_photoelectric-effect",
    text: "In a photoelectric experiment using monochromatic light of fixed frequency above the threshold, the intensity of the light is increased. What happens?",
    difficulty: "medium",
    explanation:
      "Intensity determines the number of photons per second, so the photocurrent (number of emitted electrons) increases. Each photon still has the same energy hf, so the maximum kinetic energy of the electrons is unchanged.",
    options: [
      "The saturation current increases but the maximum kinetic energy of photoelectrons is unchanged",
      "Both the saturation current and the maximum kinetic energy increase",
      "Only the maximum kinetic energy increases",
      "Neither the current nor the kinetic energy changes",
    ],
    correctIndex: 0,
  },
  // ---------------------------------------------------------------------------
  // Atoms and Nuclei -> Nuclear Structure and Reactions (1)
  // ---------------------------------------------------------------------------
  {
    id: "050",
    topicId: "exam_neet_physics_atoms-and-nuclei_nuclear-structure-and-reactions",
    text: "The enormous energy released in nuclear fission is fundamentally due to:",
    difficulty: "easy",
    explanation:
      "The total mass of the fission products is slightly less than the mass of the original nucleus. This mass defect Δm is converted to energy according to Einstein's relation E = Δmc².",
    options: [
      "Conversion of the mass defect into energy (E = Δmc²)",
      "Chemical combustion of the nuclear fuel",
      "The large kinetic energy of the incoming neutron",
      "Friction between nuclear fragments",
    ],
    correctIndex: 0,
  },
];
