import type { AuthoredQuestionSpec } from "./authored-types";

/**
 * Biology — 50 original ParikshaVerse authored questions.
 * All topics reference the canonical seeded NEET taxonomy; no topic is invented.
 */
export const AUTHORED_BIOLOGY_SPECS: AuthoredQuestionSpec[] = [
  // ---------------------------------------------------------------------------
  // Diversity in Living World -> Living World and Taxonomy (2)
  // ---------------------------------------------------------------------------
  {
    id: "001",
    topicId: "exam_neet_biology_diversity-in-living-world_living-world-and-taxonomy",
    text: "The system of binomial nomenclature, in which every organism is given a two-word scientific name, was developed by:",
    difficulty: "easy",
    explanation:
      "Carolus Linnaeus introduced binomial nomenclature (e.g. Mangifera indica), combining the generic name and a specific epithet, in his work Species Plantarum (1753).",
    options: ["Carolus Linnaeus", "Charles Darwin", "Robert Hooke", "Aristotle"],
    correctIndex: 0,
  },
  {
    id: "002",
    topicId: "exam_neet_biology_diversity-in-living-world_living-world-and-taxonomy",
    text: "In the taxonomic hierarchy, which category contains one or more related species that are distinct from species of other categories?",
    difficulty: "medium",
    explanation:
      "A genus is a group of related species aggregated on the basis of similar vegetative and reproductive characters, e.g. Panthera contains the lion, leopard and tiger.",
    options: ["Genus", "Family", "Order", "Class"],
    correctIndex: 0,
  },
  // ---------------------------------------------------------------------------
  // Diversity in Living World -> Five Kingdom Classification (2)
  // ---------------------------------------------------------------------------
  {
    id: "003",
    topicId: "exam_neet_biology_diversity-in-living-world_five-kingdom-classification",
    text: "In Whittaker's five kingdom classification, bacteria and blue-green algae (cyanobacteria) are placed in the kingdom:",
    difficulty: "medium",
    explanation:
      "Prokaryotes without a membrane-bound nucleus — bacteria and cyanobacteria — belong to Kingdom Monera in the five kingdom system.",
    options: ["Monera", "Protista", "Fungi", "Plantae"],
    correctIndex: 0,
  },
  {
    id: "004",
    topicId: "exam_neet_biology_diversity-in-living-world_five-kingdom-classification",
    text: "The cell walls of which group of organisms are characteristically made of chitin?",
    difficulty: "medium",
    explanation:
      "Fungal cell walls are composed of chitin (a nitrogen-containing polysaccharide), whereas plant cell walls contain cellulose and most bacterial walls contain peptidoglycan.",
    options: ["Fungi", "Plantae", "Monera (typical bacteria)", "Chlorophyceae (green algae)"],
    correctIndex: 0,
  },
  // ---------------------------------------------------------------------------
  // Diversity in Living World -> Plant Kingdom (1)
  // ---------------------------------------------------------------------------
  {
    id: "005",
    topicId: "exam_neet_biology_diversity-in-living-world_plant-kingdom",
    text: "Bryophytes are often called the 'amphibians of the plant kingdom' because:",
    difficulty: "easy",
    explanation:
      "Although bryophytes live on land, they depend on water for the transfer of male gametes (antherozoids) to the archegonium during fertilization — just as amphibians need water to reproduce.",
    options: [
      "They live on land but require water for fertilization",
      "They can live both in fresh water and in sea water",
      "Their body is partly green and partly brown",
      "They lack vascular tissue entirely",
    ],
    correctIndex: 0,
  },
  // ---------------------------------------------------------------------------
  // Diversity in Living World -> Animal Kingdom (1)
  // ---------------------------------------------------------------------------
  {
    id: "006",
    topicId: "exam_neet_biology_diversity-in-living-world_animal-kingdom",
    text: "A water vascular system used for locomotion, feeding and respiration is the distinguishing feature of which phylum?",
    difficulty: "medium",
    explanation:
      "Echinoderms (starfish, sea urchins) possess a unique water vascular system ending in tube feet that operate by hydraulic pressure.",
    options: ["Echinodermata", "Mollusca", "Annelida", "Arthropoda"],
    correctIndex: 0,
  },
  // ---------------------------------------------------------------------------
  // Structural Organisation -> Morphology of Flowering Plants (2)
  // ---------------------------------------------------------------------------
  {
    id: "007",
    topicId:
      "exam_neet_biology_structural-organisation-in-animals-and-plants_morphology-of-flowering-plants",
    text: "The mode of arrangement of sepals or petals in a floral bud with respect to the other members of the same whorl is called:",
    difficulty: "medium",
    explanation:
      "Aestivation is the arrangement of floral parts within the bud (valvate, twisted, imbricate, vexillary). Phyllotaxy, in contrast, describes leaf arrangement on the stem.",
    options: ["Aestivation", "Phyllotaxy", "Placentation", "Venation"],
    correctIndex: 0,
  },
  {
    id: "008",
    topicId:
      "exam_neet_biology_structural-organisation-in-animals-and-plants_morphology-of-flowering-plants",
    text: "Ginger and turmeric possess a swollen underground structure that stores food and bears buds. This modified organ is a:",
    difficulty: "easy",
    explanation:
      "A rhizome is an underground, horizontally growing stem with nodes, internodes and scaly leaves — not a root, which would lack buds and nodes.",
    options: ["Rhizome (underground stem)", "Tap root", "Tuberous root", "Tendril"],
    correctIndex: 0,
  },
  // ---------------------------------------------------------------------------
  // Cell Structure and Function -> Biomolecules in Cell (3)
  // ---------------------------------------------------------------------------
  {
    id: "009",
    topicId: "exam_neet_biology_cell-structure-and-function_biomolecules-in-cell",
    text: "Proteins are polymers whose monomer building blocks are:",
    difficulty: "easy",
    explanation:
      "Proteins are chains of amino acids joined by peptide bonds; the sequence of amino acids determines the protein's structure and function.",
    options: ["Amino acids", "Monosaccharides", "Nucleotides", "Fatty acids"],
    correctIndex: 0,
  },
  {
    id: "010",
    topicId: "exam_neet_biology_cell-structure-and-function_biomolecules-in-cell",
    text: "The molecule described as the major energy currency of the cell, releasing usable energy on hydrolysis of its terminal phosphate bond, is:",
    difficulty: "easy",
    explanation:
      "ATP (adenosine triphosphate) stores energy in its terminal phosphoanhydride bond; its hydrolysis to ADP + Pi powers most cellular work.",
    options: ["ATP", "Glucose", "DNA", "Cellulose"],
    correctIndex: 0,
  },
  {
    id: "011",
    topicId: "exam_neet_biology_cell-structure-and-function_biomolecules-in-cell",
    text: "An enzyme accelerates a biochemical reaction by:",
    difficulty: "easy",
    explanation:
      "Enzymes lower the activation energy of the reaction, allowing more substrate molecules to reach the transition state. They never change the equilibrium position or the ΔG of the reaction.",
    options: [
      "Lowering the activation energy of the reaction",
      "Changing the equilibrium constant of the reaction",
      "Supplying the energy required by the reaction",
      "Raising the temperature inside the cell",
    ],
    correctIndex: 0,
  },
  // ---------------------------------------------------------------------------
  // Plant Physiology -> Photosynthesis in Higher Plants (3)
  // ---------------------------------------------------------------------------
  {
    id: "012",
    topicId: "exam_neet_biology_plant-physiology_photosynthesis-in-higher-plants",
    text: "In C₄ plants such as maize, the primary CO₂ acceptor in mesophyll cells is:",
    difficulty: "medium",
    explanation:
      "C₄ plants fix CO₂ in mesophyll cells using PEP (phosphoenolpyruvate) via PEP carboxylase, forming the 4-carbon oxaloacetic acid before shuttling malate to the bundle-sheath cells.",
    options: [
      "Phosphoenolpyruvate (PEP)",
      "Ribulose-1,5-bisphosphate (RuBP)",
      "Oxaloacetic acid (OAA)",
      "Phosphoglyceric acid (PGA)",
    ],
    correctIndex: 0,
  },
  {
    id: "013",
    topicId: "exam_neet_biology_plant-physiology_photosynthesis-in-higher-plants",
    text: "The light reactions of photosynthesis in green plants take place in the:",
    difficulty: "easy",
    explanation:
      "Photosystems, the electron-transport chain and ATP synthase are embedded in the thylakoid membranes of the chloroplast, where the light reactions occur; the Calvin cycle operates in the stroma.",
    options: [
      "Thylakoid membranes of the chloroplast",
      "Stroma of the chloroplast",
      "Mitochondrial matrix",
      "Cytoplasm",
    ],
    correctIndex: 0,
  },
  {
    id: "014",
    topicId: "exam_neet_biology_plant-physiology_photosynthesis-in-higher-plants",
    text: "Photorespiration occurs in C₃ plants because the enzyme RuBisCO can also catalyse the reaction of RuBP with:",
    difficulty: "hard",
    explanation:
      "RuBisCO has oxygenase activity: when it binds O₂ instead of CO₂, RuBP is converted to phosphoglycolate and 3-PGA, releasing CO₂ and consuming energy with no ATP or sugar gain — a costly wasteful pathway unique to conditions of low CO₂/high O₂.",
    options: [
      "O₂, forming phosphoglycolate with no gain of ATP or sugar",
      "CO₂, forming two molecules of 3-PGA with a net energy gain",
      "N₂, releasing ammonia into the stroma",
      "H₂O, splitting it to release oxygen",
    ],
    correctIndex: 0,
  },
  // ---------------------------------------------------------------------------
  // Plant Physiology -> Respiration in Plants (2)
  // ---------------------------------------------------------------------------
  {
    id: "015",
    topicId: "exam_neet_biology_plant-physiology_respiration-in-plants",
    text: "The net gain of ATP molecules per glucose during glycolysis (excluding the later stages) is:",
    difficulty: "medium",
    explanation:
      "Glycolysis produces 4 ATP but consumes 2 ATP in the preparatory steps, giving a net gain of 2 ATP (plus 2 NADH) per glucose.",
    options: ["2", "4", "8", "36"],
    correctIndex: 0,
  },
  {
    id: "016",
    topicId: "exam_neet_biology_plant-physiology_respiration-in-plants",
    text: "The common oxidative pathway through which the breakdown products of carbohydrates, fats and proteins are finally oxidized is:",
    difficulty: "medium",
    explanation:
      "Acetyl-CoA from all three food classes enters the citric acid (Krebs/TCA) cycle in the mitochondrial matrix, making it the common terminal oxidative pathway of respiration.",
    options: [
      "The tricarboxylic acid (Krebs) cycle",
      "Glycolysis",
      "The Calvin cycle",
      "Lactic acid fermentation",
    ],
    correctIndex: 0,
  },
  // ---------------------------------------------------------------------------
  // Plant Physiology -> Plant Growth and Development (2)
  // ---------------------------------------------------------------------------
  {
    id: "017",
    topicId: "exam_neet_biology_plant-physiology_plant-growth-and-development",
    text: "The growth-promoting substance 'auxin' was first isolated from coleoptile tips of oat seedlings by:",
    difficulty: "medium",
    explanation:
      "F. W. Went (1928) isolated auxin from oat (Avena) coleoptile tips using his agar-block experiment, building on Darwin's earlier phototropism observations.",
    options: ["F. W. Went", "Charles Darwin", "Gregor Mendel", "Robert Hooke"],
    correctIndex: 0,
  },
  {
    id: "018",
    topicId: "exam_neet_biology_plant-physiology_plant-growth-and-development",
    text: "Which plant hormone is best known for promoting fruit ripening?",
    difficulty: "medium",
    explanation:
      "Ethylene is a gaseous hormone that triggers fruit ripening (softening, colour change), which is why ripening fruit releases the 'ripe smell' used commercially to ripen harvested fruit.",
    options: ["Ethylene", "Auxin", "Gibberellin", "Cytokinin"],
    correctIndex: 0,
  },
  // ---------------------------------------------------------------------------
  // Human Physiology -> Breathing and Exchange of Gases (2)
  // ---------------------------------------------------------------------------
  {
    id: "019",
    topicId: "exam_neet_biology_human-physiology_breathing-and-exchange-of-gases",
    text: "In human blood, the largest fraction of carbon dioxide is transported:",
    difficulty: "medium",
    explanation:
      "About 70% of CO₂ travels as bicarbonate ions (HCO₃⁻) formed via carbonic anhydrase in RBCs; roughly 20–25% is carried as carbaminohaemoglobin and only about 7% is dissolved in plasma.",
    options: [
      "As bicarbonate ions (HCO₃⁻) in the plasma",
      "Dissolved directly in the blood plasma",
      "Bound to the globin part of haemoglobin as carbaminohaemoglobin",
      "As carbon monoxide complexes",
    ],
    correctIndex: 0,
  },
  {
    id: "020",
    topicId: "exam_neet_biology_human-physiology_breathing-and-exchange-of-gases",
    text: "The oxygen–haemoglobin dissociation curve shifts to the RIGHT (unloading O₂ more readily) when:",
    difficulty: "hard",
    explanation:
      "High PCO₂, low pH, higher temperature and high BPG — the conditions of actively metabolizing tissue (the Bohr effect) — reduce haemoglobin's affinity for oxygen, shifting the curve rightward and promoting O₂ delivery.",
    options: [
      "PCO₂ rises and pH falls, as in actively respiring tissues",
      "PCO₂ falls and pH rises, as in freshly oxygenated alveolar blood",
      "Body temperature drops below normal",
      "The partial pressure of oxygen increases sharply",
    ],
    correctIndex: 0,
  },
  // ---------------------------------------------------------------------------
  // Human Physiology -> Body Fluids and Circulation (3)
  // ---------------------------------------------------------------------------
  {
    id: "021",
    topicId: "exam_neet_biology_human-physiology_body-fluids-and-circulation",
    text: "The 'pacemaker' of the human heart, which initiates each cardiac cycle, is the:",
    difficulty: "easy",
    explanation:
      "The sino-atrial (SA) node in the right atrial wall generates impulses fastest and sets the heart's rhythm; damage requires an artificial pacemaker.",
    options: [
      "Sino-atrial (SA) node",
      "Atrio-ventricular (AV) node",
      "Bundle of His",
      "Purkinje fibres",
    ],
    correctIndex: 0,
  },
  {
    id: "022",
    topicId: "exam_neet_biology_human-physiology_body-fluids-and-circulation",
    text: "In mammals, the mature blood cells that lack a nucleus are:",
    difficulty: "easy",
    explanation:
      "Mammalian erythrocytes (RBCs) extrude their nucleus before entering circulation, maximizing haemoglobin capacity; WBCs and platelets do not follow this pattern (platelets are cell fragments).",
    options: ["Erythrocytes (red blood cells)", "Neutrophils", "Lymphocytes", "Monocytes"],
    correctIndex: 0,
  },
  {
    id: "023",
    topicId: "exam_neet_biology_human-physiology_body-fluids-and-circulation",
    text: "A person has a stroke volume of 70 mL and a heart rate of 72 beats per minute. The cardiac output is approximately:",
    difficulty: "hard",
    explanation:
      "Cardiac output = stroke volume × heart rate = 70 mL × 72/min = 5040 mL/min ≈ 5 L/min, the healthy adult value quoted in textbooks.",
    options: [
      "≈ 5 litres per minute",
      "≈ 1 litre per minute",
      "≈ 2 litres per minute",
      "≈ 10 litres per minute",
    ],
    correctIndex: 0,
  },
  // ---------------------------------------------------------------------------
  // Human Physiology -> Excretory Products and Elimination (2)
  // ---------------------------------------------------------------------------
  {
    id: "024",
    topicId: "exam_neet_biology_human-physiology_excretory-products-and-elimination",
    text: "The structural and functional unit of the human kidney is the:",
    difficulty: "easy",
    explanation:
      "Each kidney contains about a million nephrons — glomerulus, Bowman's capsule, tubular segments and collecting duct — which perform filtration, reabsorption and secretion.",
    options: ["Nephron", "Neuron", "Alveolus", "Nephridia"],
    correctIndex: 0,
  },
  {
    id: "025",
    topicId: "exam_neet_biology_human-physiology_excretory-products-and-elimination",
    text: "The counter-current multiplier mechanism that concentrates urine in the loop of Henle depends on the fact that the ascending limb:",
    difficulty: "hard",
    explanation:
      "The ascending limb actively transports NaCl out but is impermeable to water, making the surrounding medullary fluid hypertonic; the water-permeable descending limb then equilibrates passively — together they multiply the osmotic gradient from cortex to inner medulla.",
    options: [
      "Actively transports NaCl out and is impermeable to water",
      "Actively transports water out and is impermeable to NaCl",
      "Passively reabsorbs both water and NaCl equally",
      "Secrets urea into the filtrate",
    ],
    correctIndex: 0,
  },
  // ---------------------------------------------------------------------------
  // Human Physiology -> Neural Control and Coordination (2)
  // ---------------------------------------------------------------------------
  {
    id: "026",
    topicId: "exam_neet_biology_human-physiology_neural-control-and-coordination",
    text: "The neurotransmitter released at the neuromuscular junction of vertebrates to stimulate a skeletal muscle fibre is:",
    difficulty: "easy",
    explanation:
      "Acetylcholine is released into the synaptic cleft at the neuromuscular junction and binds receptors on the sarcolemma, generating an action potential in the muscle fibre.",
    options: ["Acetylcholine", "Dopamine", "Oxytocin", "Haemoglobin"],
    correctIndex: 0,
  },
  {
    id: "027",
    topicId: "exam_neet_biology_human-physiology_neural-control-and-coordination",
    text: "The resting membrane potential of a neuron is maintained chiefly by:",
    difficulty: "medium",
    explanation:
      "The Na⁺/K⁺ ATPase pump actively transports 3 Na⁺ out for every 2 K⁺ in, and K⁺ leaks out through channels; this unequal ion distribution sustains the resting potential of about −70 mV.",
    options: [
      "The sodium–potassium pump (Na⁺/K⁺ ATPase) working against leak channels",
      "The passive diffusion of sodium ions into the cell only",
      "Myelin sheath conduction of electrical signals",
      "Calcium influx through voltage-gated channels",
    ],
    correctIndex: 0,
  },
  // ---------------------------------------------------------------------------
  // Human Physiology -> Chemical Coordination and Integration (1)
  // ---------------------------------------------------------------------------
  {
    id: "028",
    topicId: "exam_neet_biology_human-physiology_chemical-coordination-and-integration",
    text: "Insulin, the hormone that lowers blood glucose, is secreted by:",
    difficulty: "easy",
    explanation:
      "Beta (β) cells of the islets of Langerhans in the pancreas secrete insulin; the α cells secrete glucagon, its antagonist.",
    options: [
      "Beta (β) cells of the islets of Langerhans in the pancreas",
      "Alpha (α) cells of the islets of Langerhans",
      "The adrenal medulla",
      "The thyroid follicular cells",
    ],
    correctIndex: 0,
  },
  // ---------------------------------------------------------------------------
  // Sexual Reproduction in Flowering Plants -> Flower Structure and Pollination (2)
  // ---------------------------------------------------------------------------
  {
    id: "029",
    topicId:
      "exam_neet_biology_sexual-reproduction-in-flowering-plants_flower-structure-and-pollination",
    text: "Wind-pollinated (anemophilous) flowers are typically characterized by:",
    difficulty: "medium",
    explanation:
      "Because wind is a non-directional carrier, anemophilous flowers are small, inconspicuous and scentless, with light, dry, abundant pollen and often feathery stigmas to trap airborne grains.",
    options: [
      "Light, dry, abundant pollen and often feathery stigmas",
      "Large, brightly coloured petals with strong fragrance",
      "Sticky, spiny pollen carried on insect bodies",
      "Nectar guides that attract specific pollinators",
    ],
    correctIndex: 0,
  },
  {
    id: "030",
    topicId:
      "exam_neet_biology_sexual-reproduction-in-flowering-plants_flower-structure-and-pollination",
    text: "In cleistogamy, as seen in Commelina and certain grasses:",
    difficulty: "medium",
    explanation:
      "Cleistogamous flowers never open, so the anthers and stigma are enclosed together, guaranteeing self-pollination (but producing no genetic variation); chasmogamous flowers, by contrast, open and may cross-pollinate.",
    options: [
      "The flowers never open, ensuring assured self-pollination",
      "The flowers open only at night for moth pollination",
      "Pollination is always performed by water currents",
      "The plant reproduces asexually by runners",
    ],
    correctIndex: 0,
  },
  // ---------------------------------------------------------------------------
  // Sexual Reproduction in Flowering Plants -> Fertilisation and Seed Development (1)
  // ---------------------------------------------------------------------------
  {
    id: "031",
    topicId:
      "exam_neet_biology_sexual-reproduction-in-flowering-plants_fertilisation-and-seed-development",
    text: "During double fertilization in angiosperms, the endosperm mother cell that develops into the nutritive endosperm tissue is:",
    difficulty: "hard",
    explanation:
      "One sperm nucleus fuses with the egg (forming the 2n zygote), while the other sperm fuses with the two polar nuclei of the central cell, creating the triploid (3n) primary endosperm cell that nourishes the embryo.",
    options: [
      "Triploid (3n), formed by fusion of one sperm with two polar nuclei",
      "Diploid (2n), formed by fusion of one sperm with the egg",
      "Haploid (n), formed from the unfertilized central cell",
      "Tetraploid (4n), formed by fusion of two sperm nuclei",
    ],
    correctIndex: 0,
  },
  // ---------------------------------------------------------------------------
  // Human Reproduction -> Menstrual Cycle (1)
  // ---------------------------------------------------------------------------
  {
    id: "032",
    topicId: "exam_neet_biology_human-reproduction_menstrual-cycle",
    text: "Ovulation from a mature Graafian follicle in a typical 28-day human menstrual cycle is triggered by a sudden surge of:",
    difficulty: "medium",
    explanation:
      "A sharp mid-cycle surge of LH (around day 14) induced by peak oestrogen causes rupture of the Graafian follicle and release of the secondary oocyte.",
    options: [
      "Luteinizing hormone (LH)",
      "Follicle-stimulating hormone (FSH)",
      "Progesterone",
      "Prolactin",
    ],
    correctIndex: 0,
  },
  // ---------------------------------------------------------------------------
  // Genetics and Evolution -> Principles of Inheritance (3)
  // ---------------------------------------------------------------------------
  {
    id: "033",
    topicId: "exam_neet_biology_genetics-and-evolution_principles-of-inheritance",
    text: "Mendel's law of segregation states that during gamete formation:",
    difficulty: "easy",
    explanation:
      "The two alleles of a gene pair segregate (separate) from each other so that each gamete carries only one allele; this is the basis of the 3:1 monohybrid F₂ ratio.",
    options: [
      "The two alleles of a pair separate, so each gamete receives only one",
      "Two genes for different traits always travel together",
      "Dominant alleles are always transmitted to all offspring",
      "Recessive alleles are eliminated from the population",
    ],
    correctIndex: 0,
  },
  {
    id: "034",
    topicId: "exam_neet_biology_genetics-and-evolution_principles-of-inheritance",
    text: "A heterozygous tall pea plant (Tt) is crossed with a homozygous dwarf plant (tt). The expected ratio of tall to dwarf offspring is:",
    difficulty: "medium",
    explanation:
      "The Tt parent produces T and t gametes equally; the tt parent produces only t. Offspring are ½ Tt (tall) and ½ tt (dwarf) — a 1:1 ratio, the classic test-cross result.",
    options: ["1 tall : 1 dwarf", "3 tall : 1 dwarf", "All tall", "9 tall : 7 dwarf"],
    correctIndex: 0,
  },
  {
    id: "035",
    topicId: "exam_neet_biology_genetics-and-evolution_principles-of-inheritance",
    text: "Colour blindness is an X-linked recessive trait. A carrier mother (X^C X^c) and a normal father (X^C Y) have children. What fraction of their SONS is expected to be colour-blind?",
    difficulty: "hard",
    explanation:
      "Sons receive their single X chromosome from the mother: half get X^C (normal vision) and half get X^c (colour-blind). So 50% of sons are affected, while no daughters are (they all receive the father's normal X^C).",
    options: [
      "50% of the sons",
      "100% of the sons",
      "0% of the sons, but 50% of the daughters",
      "25% of both sons and daughters",
    ],
    correctIndex: 0,
  },
  // ---------------------------------------------------------------------------
  // Genetics and Evolution -> Molecular Basis of Inheritance (2)
  // ---------------------------------------------------------------------------
  {
    id: "036",
    topicId: "exam_neet_biology_genetics-and-evolution_molecular-basis-of-inheritance",
    text: "The central dogma of molecular biology describes the flow of genetic information as:",
    difficulty: "medium",
    explanation:
      "Information flows from DNA to RNA by transcription and from RNA to protein by translation, with DNA replication propagating information between generations.",
    options: [
      "DNA → RNA → protein",
      "Protein → RNA → DNA",
      "RNA → DNA → protein",
      "DNA → protein → RNA",
    ],
    correctIndex: 0,
  },
  {
    id: "037",
    topicId: "exam_neet_biology_genetics-and-evolution_molecular-basis-of-inheritance",
    text: "The genetic code is described as 'degenerate', which means:",
    difficulty: "hard",
    explanation:
      "Because there are 64 codons but only 20 amino acids, several codons specify the same amino acid (e.g. UUU and UUC both code for phenylalanine) — the code is degenerate, though it is never ambiguous.",
    options: [
      "Some amino acids are specified by more than one codon",
      "One codon can specify several different amino acids",
      "The code differs from species to species",
      "Only 20 of the 64 codons actually specify amino acids",
    ],
    correctIndex: 0,
  },
  // ---------------------------------------------------------------------------
  // Genetics and Evolution -> Evolutionary Biology (2)
  // ---------------------------------------------------------------------------
  {
    id: "038",
    topicId: "exam_neet_biology_genetics-and-evolution_evolutionary-biology",
    text: "In a population obeying Hardy–Weinberg equilibrium, the frequency of allele A is p = 0.8 and that of allele a is q = 0.2. The frequency of heterozygous individuals (Aa) is:",
    difficulty: "hard",
    explanation: "Heterozygote frequency = 2pq = 2 × 0.8 × 0.2 = 0.32, i.e. 32% of the population.",
    options: ["0.32", "0.16", "0.64", "0.04"],
    correctIndex: 0,
  },
  {
    id: "039",
    topicId: "exam_neet_biology_genetics-and-evolution_evolutionary-biology",
    text: "The wings of a butterfly and the wings of a bird are functionally similar but structurally different. Such organs are called analogous, and their existence indicates:",
    difficulty: "medium",
    explanation:
      "Analogous organs solve the same problem (flight) from different structural origins in unrelated lineages — the signature of convergent evolution. Homologous organs, in contrast, indicate divergent evolution.",
    options: [
      "Convergent evolution of unrelated groups under similar selection pressures",
      "Divergent evolution from a common winged ancestor",
      "A close common ancestry between butterflies and birds",
      "Neutral accumulation of random mutations",
    ],
    correctIndex: 0,
  },
  // ---------------------------------------------------------------------------
  // Biology and Human Welfare -> Human Health and Disease (2)
  // ---------------------------------------------------------------------------
  {
    id: "040",
    topicId: "exam_neet_biology_biology-and-human-welfare_human-health-and-disease",
    text: "Malaria in humans is caused by a:",
    difficulty: "easy",
    explanation:
      "Malaria is caused by protozoan parasites of the genus Plasmodium (e.g. P. vivax, P. falciparum), transmitted by the female Anopheles mosquito — it is not caused by a virus or bacterium.",
    options: [
      "Protozoan parasite (Plasmodium) transmitted by the female Anopheles mosquito",
      "Virus transmitted by the Aedes mosquito",
      "Bacterium transmitted through contaminated water",
      "Fungus spread by airborne spores",
    ],
    correctIndex: 0,
  },
  {
    id: "041",
    topicId: "exam_neet_biology_biology-and-human-welfare_human-health-and-disease",
    text: "The HIV virus, which causes AIDS, primarily attacks and destroys:",
    difficulty: "medium",
    explanation:
      "HIV infects helper T-lymphocytes (CD4⁺ cells) and macrophages. As helper T cells decline, the immune system loses coordination, leaving the patient vulnerable to opportunistic infections.",
    options: [
      "Helper T-lymphocytes (CD4⁺ cells)",
      "Red blood cells",
      "Platelets",
      "Hepatocytes of the liver",
    ],
    correctIndex: 0,
  },
  // ---------------------------------------------------------------------------
  // Biology and Human Welfare -> Microbes in Human Welfare (1)
  // ---------------------------------------------------------------------------
  {
    id: "042",
    topicId: "exam_neet_biology_biology-and-human-welfare_microbes-in-human-welfare",
    text: "Curd is formed from milk because Lactobacillus bacteria:",
    difficulty: "easy",
    explanation:
      "Lactic acid bacteria convert milk sugar (lactose) into lactic acid; the accumulating acid coagulates the milk protein casein, converting milk into curd.",
    options: [
      "Convert lactose (milk sugar) into lactic acid, which coagulates milk protein",
      "Convert milk fat into carbon dioxide and water",
      "Synthesize vitamin K directly into the milk",
      "Add starch granules that thicken the milk",
    ],
    correctIndex: 0,
  },
  // ---------------------------------------------------------------------------
  // Biotechnology -> Principles and Processes (2)
  // ---------------------------------------------------------------------------
  {
    id: "043",
    topicId:
      "exam_neet_biology_biotechnology-and-its-applications_biotechnology-principles-and-processes",
    text: "The 'molecular scissors' used in recombinant DNA technology to cut DNA at specific recognition sequences are:",
    difficulty: "easy",
    explanation:
      "Restriction endonucleases (e.g. EcoRI) recognize specific palindromic sequences and cut the DNA, producing sticky ends that allow insertion of foreign DNA.",
    options: ["Restriction endonucleases", "DNA ligases", "Taq polymerases", "Amylases"],
    correctIndex: 0,
  },
  {
    id: "044",
    topicId:
      "exam_neet_biology_biotechnology-and-its-applications_biotechnology-principles-and-processes",
    text: "During the polymerase chain reaction (PCR), the step carried out at approximately 72°C, in which the DNA polymerase synthesizes new strands, is called:",
    difficulty: "medium",
    explanation:
      "PCR cycles through denaturation (~94–95°C), primer annealing (~50–60°C) and extension (~72°C), the optimum temperature of Taq DNA polymerase.",
    options: ["Extension (primer elongation)", "Denaturation", "Annealing", "Ligation"],
    correctIndex: 0,
  },
  // ---------------------------------------------------------------------------
  // Biotechnology -> Applications (1)
  // ---------------------------------------------------------------------------
  {
    id: "045",
    topicId: "exam_neet_biology_biotechnology-and-its-applications_biotechnology-applications",
    text: "Bt cotton is a genetically modified crop that resists certain insect pests because it produces:",
    difficulty: "medium",
    explanation:
      "Bt cotton carries cry genes from the soil bacterium Bacillus thuringiensis. The expressed Bt toxin (Cry protein) becomes activated in the alkaline gut of insect larvae, killing pests like bollworms without harming other organisms.",
    options: [
      "Insecticidal Cry proteins derived from Bacillus thuringiensis",
      "Antibiotic penicillin produced in its leaves",
      "Extra-thick bark that blocks chewing insects",
      "A symbiotic fungus that poisons caterpillars",
    ],
    correctIndex: 0,
  },
  // ---------------------------------------------------------------------------
  // Ecology and Environment -> Organisms and Populations (2)
  // ---------------------------------------------------------------------------
  {
    id: "046",
    topicId: "exam_neet_biology_ecology-and-environment_organisms-and-populations",
    text: "Organisms that can tolerate only a narrow range of temperature conditions are called:",
    difficulty: "easy",
    explanation:
      "Stenothermal organisms tolerate a narrow temperature range (e.g. penguins, palm trees); eurythermal organisms tolerate a wide range. The analogous water-salinity terms are stenohaline and euryhaline.",
    options: ["Stenothermal", "Eurythermal", "Euryhaline", "Stenohaline"],
    correctIndex: 0,
  },
  {
    id: "047",
    topicId: "exam_neet_biology_ecology-and-environment_organisms-and-populations",
    text: "A population of 100 bacteria grows exponentially with intrinsic rate of natural increase r = 0.1 per day, following Nₜ = N₀·e^(rt). After 10 days the population is closest to:",
    difficulty: "hard",
    explanation:
      "Nₜ = 100 × e^(0.1×10) = 100 × e¹ ≈ 100 × 2.718 ≈ 272 individuals — the characteristic accelerating J-shaped curve of exponential growth.",
    options: ["≈ 272 individuals", "≈ 200 individuals", "≈ 100 individuals", "≈ 1000 individuals"],
    correctIndex: 0,
  },
  // ---------------------------------------------------------------------------
  // Ecology and Environment -> Ecosystem Structure and Energy Flow (2)
  // ---------------------------------------------------------------------------
  {
    id: "048",
    topicId: "exam_neet_biology_ecology-and-environment_ecosystem-structure-and-energy-flow",
    text: "The '10 per cent law', which describes the fraction of energy transferred from one trophic level to the next, was proposed by:",
    difficulty: "medium",
    explanation:
      "Lindeman (1942) formulated the 10% law: only about one-tenth of the energy available at a trophic level passes to the next, limiting food chains to 3–4 levels.",
    options: ["Lindeman", "Odum", "Tansley", "Elton"],
    correctIndex: 0,
  },
  {
    id: "049",
    topicId: "exam_neet_biology_ecology-and-environment_ecosystem-structure-and-energy-flow",
    text: "Organisms such as fungi and soil bacteria that break down dead organic matter and return nutrients to the ecosystem are called:",
    difficulty: "easy",
    explanation:
      "Decomposers (saprotrophs) secrete enzymes that fragment dead plants and animals, releasing inorganic nutrients back into the cycle — an essential step in energy flow and nutrient cycling.",
    options: ["Decomposers (saprotrophs)", "Primary producers", "Herbivores", "Top carnivores"],
    correctIndex: 0,
  },
  // ---------------------------------------------------------------------------
  // Ecology and Environment -> Biodiversity and Conservation (1)
  // ---------------------------------------------------------------------------
  {
    id: "050",
    topicId: "exam_neet_biology_ecology-and-environment_biodiversity-and-conservation",
    text: "A region qualifies as a biodiversity hotspot when it shows:",
    difficulty: "medium",
    explanation:
      "Hotspots are defined by two criteria: exceptionally high species endemism (species found nowhere else) and severe habitat loss (typically >70% of original vegetation destroyed), which is why they become conservation priorities.",
    options: [
      "High species endemism combined with severe habitat loss",
      "The largest total land area within a continent",
      "The highest number of migratory birds each year",
      "Only the presence of endangered mammal species",
    ],
    correctIndex: 0,
  },
];
