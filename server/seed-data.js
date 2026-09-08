/* Content recovered from the live site. Everything here is editable through
   the MCP tools once seeded — this file only bootstraps the database. */

const IMG = '/assets/img/'

export const products = [
  {
    slug: 'soya-lecithin', name: 'Soya Lecithin', category: 'Agro', featured: true, sort_order: 1,
    image: IMG + 'img-20260802-wa0011.jpg',
    summary: 'High-quality soya lecithin extracted from premium non-GMO soybeans.',
    description: `High-quality soya lecithin extracted from premium non-GMO soybeans. Available in granular and liquid forms, our soya lecithin is widely used as a natural emulsifier in food manufacturing, pharmaceuticals, and cosmetics. Characterized by a minimum 65% phosphatide content, it delivers excellent emulsification, dispersion, and stabilization properties.`,
    origin: 'Nigeria (Processed from Nigerian & Imported Soybeans)',
    processing: 'Cold-pressed soybean oil extraction, degumming, drying, and granulation',
    packaging: '25kg paper bags (granular) / 200kg drums (liquid) or buyer-specified',
    moq: '10 Metric Tonnes', grade: 'Granular & Liquid, Non-GMO, Min 65% Phosphatides', hs_code: '2923.20.00',
    applications: ['Food Emulsifier', 'Bakery & Confectionery', 'Animal Feed', 'Pharmaceuticals', 'Cosmetics', 'Infant Formula'],
    certifications: ['Non-GMO Certificate', 'NAFDAC', 'SGS', 'Halal (Available)'],
  },
  {
    slug: 'corn-powder', name: 'Corn Powder', category: 'Agro', sort_order: 2,
    image: IMG + 'img-20260802-wa0021.jpg',
    summary: 'Premium finely milled corn powder from high-quality yellow maize.',
    description: `Premium finely milled corn powder produced from high-quality yellow maize sourced from Nigeria's fertile northern belt. Our corn powder is processed under strict hygiene standards to deliver consistent particle size, bright colour, and excellent cooking properties. Ideal for food manufacturers, industrial users, and export.`,
    origin: 'Kaduna, Kano & Niger States, Nigeria',
    processing: 'Cleaning, drying, de-germing, milling, sieving, and quality testing',
    packaging: '25kg & 50kg PP woven bags or buyer-specified',
    moq: '20 Metric Tonnes', grade: 'Fine Milled, 14% Moisture Max, 98% Purity', hs_code: '1102.20.00',
    applications: ['Flour & Baking', 'Porridge & Gruel', 'Snack Manufacturing', 'Animal Feed', 'Starch Production', 'Beverages'],
    certifications: ['NAFDAC', 'SGS', 'Phytosanitary Certificate'],
  },
  {
    slug: 'palm-oil', name: 'Palm Oil', category: 'Agro', sort_order: 3,
    image: IMG + 'img-20260802-wa0014.jpg',
    summary: 'Premium Nigerian palm oil from sustainable estates in Edo and Delta States.',
    description: `Premium Nigerian palm oil sourced from sustainable estates in Edo and Delta States. Our palm oil undergoes strict quality control to ensure low free fatty acid content, brilliant color, and long shelf life. Available in both crude and refined bleached deodorized (RBD) grades.`,
    origin: 'Edo & Delta States, Nigeria',
    processing: 'Sterilization, threshing, digestion, pressing, clarification, and refining (for RBD)',
    packaging: 'Flexi-tanks, ISO tanks, 20L Jerry cans, or buyer-specified',
    moq: '20 Metric Tonnes (1 x 20ft container)', grade: 'CP10 / CP8, RBD & Crude, 0.1% FFA Max', hs_code: '1511.10.00',
    applications: ['Cooking Oil', 'Biodiesel', 'Cosmetics', 'Soap Manufacturing', 'Food Processing'],
    certifications: ['NAFDAC', 'SGS', 'ISO 22000'],
  },
  {
    slug: 'maize', name: 'Maize', category: 'Agro', sort_order: 4,
    image: IMG + 'kling_c61222b5-079f-40bd-be44-7df0bd614a22.jpg',
    summary: 'White and yellow maize from the fertile savannah belts of Northern Nigeria.',
    description: `High-quality white and yellow maize sourced from the fertile savannah belts of Northern Nigeria. Our maize is carefully dried to safe moisture levels, cleaned to remove foreign matter, and graded for export-standard purity. Ideal for animal feed, flour milling, and human consumption.`,
    origin: 'Kaduna, Kano & Niger States, Nigeria',
    processing: 'Sun-drying or mechanical drying, cleaning, grading, and bagging',
    packaging: '50kg PP woven bags, bulk in containers, or buyer-specified',
    moq: '50 Metric Tonnes', grade: 'White & Yellow, 14% Moisture Max, 98% Purity', hs_code: '1005.90.00',
    applications: ['Animal Feed', 'Flour Milling', 'Brewing', 'Snack Production', 'Starch Manufacturing'],
    certifications: ['NAFDAC', 'SGS', 'Phytosanitary Certificate'],
  },
  {
    slug: 'soybeans', name: 'Soybeans', category: 'Agro', sort_order: 5,
    image: IMG + 'kling_e4bbbb6d-91a9-429c-a25c-ca20f298f224.jpg',
    summary: 'Non-GMO yellow soybeans grown in the rich agricultural plains of Nigeria.',
    description: `Non-GMO yellow soybeans grown in the rich agricultural plains of Nigeria. Carefully selected for high protein content and excellent oil yield. Fully traceable from farm to port with complete documentation.`,
    origin: 'Benue & Taraba States, Nigeria',
    processing: 'Cleaning, sorting, drying, and quality testing for protein and oil content',
    packaging: '50kg PP woven bags or bulk in containers',
    moq: '50 Metric Tonnes', grade: 'Non-GMO, 38% Protein Min, 13% Moisture Max', hs_code: '1201.90.00',
    applications: ['Soybean Meal', 'Soybean Oil', 'Tofu', 'Soy Milk', 'Animal Feed'],
    certifications: ['Non-GMO Certificate', 'SGS', 'Phytosanitary Certificate'],
  },
  {
    slug: 'cocoa', name: 'Cocoa Beans', category: 'Agro', sort_order: 6,
    image: IMG + 'single-origin-chocolate-bar-cocoa-heart-1024x1024.jpg',
    summary: 'Premium Nigerian cocoa beans from the renowned cocoa belt.',
    description: `Premium Nigerian cocoa beans from the renowned cocoa belt of Ondo, Ogun, and Cross River States. Expertly fermented for optimal flavor development and sun-dried to perfection. Known for their rich chocolatey notes and fine flavor profile favored by premium chocolate makers.`,
    origin: 'Ondo, Ogun & Cross River States, Nigeria',
    processing: 'Harvesting, pod breaking, fermentation (5-7 days), sun-drying, and grading',
    packaging: '60kg jute bags or buyer-specified',
    moq: '18 Metric Tonnes (1 x 20ft container)', grade: 'Grade 1, Fermented & Sun-Dried, 7-8% Moisture', hs_code: '1801.00.00',
    applications: ['Premium Chocolate', 'Cocoa Butter', 'Cocoa Powder', 'Confectionery', 'Beverages'],
    certifications: ['Organic (Available)', 'UTZ (Available)', 'SGS', 'Export Permit'],
  },
  {
    slug: 'sesame-seeds', name: 'Sesame Seeds', category: 'Agro', sort_order: 7,
    image: IMG + 'kling_c4e5afb4-a066-4bbb-9846-2c814c6b0746.jpg',
    summary: 'White and brown sesame seeds with high oil content and 99.95% purity.',
    description: `Premium Nigerian sesame seeds — both white and brown varieties — renowned for their high oil content (48-52%) and excellent flavor. Meticulously cleaned and sorted to achieve 99.95% purity with minimal admixture. A top export commodity to Middle Eastern, Asian, and European markets.`,
    origin: 'Jigawa, Benue & Borno States, Nigeria',
    processing: 'Harvesting, threshing, winnowing, washing, drying, and mechanical cleaning/sorting',
    packaging: '50kg PP woven bags or buyer-specified',
    moq: '18 Metric Tonnes (1 x 20ft container)', grade: 'White & Brown, 99.95% Purity, 6% Moisture Max', hs_code: '1207.40.00',
    applications: ['Oil Extraction', 'Bakery', 'Confectionery', 'Tahini', 'Cosmetics', 'Animal Feed'],
    certifications: ['Organic (Available)', 'SGS', 'Phytosanitary Certificate', 'Export Permit'],
  },
  {
    slug: 'cashew-nuts', name: 'Cashew Nuts', category: 'Agro', sort_order: 8,
    image: IMG + 'kling_4e019845-d9da-4ffe-8d40-67a1f7203c5c.jpg',
    summary: 'Large, well-formed cashew kernels from the northern cashew belt.',
    description: `Premium Nigerian cashew nuts from the northern cashew belt. Large, well-formed kernels with excellent taste and crunch. Available raw in shell for processing or as processed kernels in W320, W240, and LBW grades. Strictly inspected for moisture, oil content, and absence of defects.`,
    origin: 'Kogi, Enugu & Oyo States, Nigeria',
    processing: 'Sun-drying (to 8-10% moisture), storage, steaming (for kernel), shelling, and grading',
    packaging: '80kg jute bags (raw in shell) or 22.68kg (50 lbs) tins (kernels)',
    moq: '15 Metric Tonnes (kernels) / 40ft container (raw in shell)', grade: 'Raw in Shell, W320 / W240, 48-52 lbs/80kg', hs_code: '0801.32.00',
    applications: ['Snack Food', 'Confectionery', 'Bakery', 'Cashew Butter', 'Dairy Alternatives'],
    certifications: ['SGS', 'Phytosanitary Certificate', 'Export Permit'],
  },
  {
    slug: 'ginger', name: 'Ginger', category: 'Agro', sort_order: 9,
    image: IMG + 'kling_072ceb3f-c35d-403b-b25c-7b988abbf178.jpg',
    summary: 'Nigerian ginger with strong aroma and high essential oil content.',
    description: `Premium Nigerian ginger known worldwide for its strong aroma, high essential oil content, and intense spiciness. Our ginger is carefully dried to optimal moisture levels and processed as whole rhizomes, splits, or slices depending on buyer requirements.`,
    origin: 'Kaduna, Nasarawa & Gombe States, Nigeria',
    processing: 'Harvesting, washing, sun-drying (to 8-10% moisture), splitting/slicing, and grading',
    packaging: '30-50kg PP woven bags or buyer-specified',
    moq: '15 Metric Tonnes', grade: 'Air-Dried & Split, 2-3% Moisture, High Oil Content', hs_code: '0910.11.00',
    applications: ['Spice & Seasoning', 'Ginger Oil Extraction', 'Pharmaceuticals', 'Beverages', 'Confectionery'],
    certifications: ['Organic (Available)', 'SGS', 'Phytosanitary Certificate', 'Export Permit'],
  },
  {
    slug: 'hibiscus', name: 'Hibiscus (Zobo)', category: 'Agro', sort_order: 10,
    image: IMG + 'kling_cdecc239-4e68-4547-853d-eb598d7b7520.jpg',
    summary: 'Dried hibiscus calyces with deep red colour and tart flavour.',
    description: `Premium dried hibiscus calyces (Hibiscus sabdariffa) with deep red color and tart flavor. Harvested at peak maturity from Nigerian farms and carefully dried to preserve color, aroma, and nutritional value. Highly sought after for tea, beverages, and natural food coloring.`,
    origin: 'Jigawa, Kano & Katsina States, Nigeria',
    processing: 'Hand-picking of mature calyces, cleaning, sun-drying, and sieving for uniform particle size',
    packaging: '25-50kg PP woven bags or buyer-specified',
    moq: '10 Metric Tonnes', grade: 'Whole & Sifted, Deep Red, 12% Moisture Max', hs_code: '1211.90.00',
    applications: ['Herbal Tea', 'Natural Food Coloring', 'Beverages', 'Cosmetics', 'Pharmaceuticals'],
    certifications: ['Organic (Available)', 'SGS', 'Phytosanitary Certificate'],
  },
  {
    slug: 'plantains', name: 'Plantains', category: 'Agro', sort_order: 11,
    image: IMG + 'vertocagro-plantain.jpg',
    summary: 'Fresh, A-grade Nigerian plantains harvested at peak maturity.',
    description: `Fresh, A-grade Nigerian plantains harvested at peak maturity for optimal texture and flavor. Carefully handled to minimize bruising and shipped under controlled conditions to maintain freshness. Available in both green (for chips/flour) and ripe varieties.`,
    origin: 'Oyo, Ogun & Edo States, Nigeria',
    processing: 'Hand-harvested at optimal maturity, washed, graded by size, and packed with ventilation',
    packaging: 'Ventilated cartons (10-15kg) or mesh bags',
    moq: '1 x 40ft Reefer Container', grade: 'Green & Ripe, A-Grade, 18-25cm Length', hs_code: '0803.10.00',
    applications: ['Fresh Consumption', 'Plantain Chips', 'Plantain Flour', 'Food Processing'],
    certifications: ['Phytosanitary Certificate', 'SGS', 'GlobalGAP (Available)'],
  },
  {
    slug: 'cassava', name: 'Cassava', category: 'Agro', sort_order: 12,
    image: IMG + 'cassava.jpg',
    summary: 'High-starch cassava tubers and chips from smallholder cooperatives.',
    description: `High-starch Nigerian cassava tubers and chips sourced directly from smallholder cooperatives. Our cassava is carefully handled to prevent bruising and promptly processed to maintain quality. Available as fresh tubers, dried chips, or garri (processed flour).`,
    origin: 'Ogun, Ondo & Delta States, Nigeria',
    processing: 'Harvesting, washing, peeling (optional), chipping (for chips), and sun-drying',
    packaging: '50kg bags (chips) or loose in containers (fresh tubers)',
    moq: '25 Metric Tonnes', grade: 'Fresh Tubers & Dried Chips, 25-40cm Length', hs_code: '0714.10.00',
    applications: ['Garri Production', 'Flour (Fufu)', 'Animal Feed', 'Starch Extraction', 'Bioethanol'],
    certifications: ['NAFDAC', 'SGS', 'Phytosanitary Certificate'],
  },
  {
    slug: 'vegetable-oil', name: 'Vegetable Oil', category: 'Agro', sort_order: 13,
    image: IMG + 'img-20260802-wa0010.jpg',
    summary: 'Refined, bleached and deodorized vegetable oil processed in Nigeria.',
    description: `High-quality refined vegetable oil sourced and processed in Nigeria. Our vegetable oil undergoes a rigorous refining, bleaching, and deodorizing (RBD) process to produce a light, neutral-tasting oil with excellent stability and a long shelf life. Suitable for cooking, frying, food manufacturing, and industrial applications.`,
    origin: 'Nigeria',
    processing: 'Seed extraction, crude oil pressing, refining, bleaching, and deodorization',
    packaging: 'Flexi-tanks, ISO tanks, 20L jerry cans, or buyer-specified',
    moq: '20 Metric Tonnes', grade: 'Refined, Bleached & Deodorized (RBD), 0.1% FFA Max', hs_code: '1515.90.00',
    applications: ['Cooking & Frying', 'Food Manufacturing', 'Margarine Production', 'Soap & Cosmetics', 'Biodiesel'],
    certifications: ['NAFDAC', 'SGS', 'ISO 22000', 'Halal (Available)'],
  },
]

export const posts = [
  {
    slug: 'nigerian-maize-market-outlook-2025',
    title: 'Understanding the 2025 Nigerian Maize Market Outlook',
    category: 'Market Analysis', published_at: '2025-06-15', read_time: '6 min read',
    author: 'Vertoc Editorial Team', image: IMG + 'stock-1551754655-cd27e38d2076-1200.jpg',
    excerpt: 'A comprehensive analysis of the supply dynamics, pricing forecasts and export opportunities shaping Nigerian maize in 2025.',
    body: `The Nigerian maize market is poised for significant growth in 2025, driven by increasing domestic demand and expanding export opportunities. This comprehensive analysis examines the key factors shaping the market landscape.

## Supply Dynamics

Nigeria remains one of Africa's largest maize producers, with annual output exceeding 20 million metric tonnes. However, climate variability and input costs continue to challenge consistent production levels. The 2025 season shows promising signs with improved seed distribution programs and increased fertilizer subsidies.

## Pricing Forecasts

Maize prices are expected to remain stable in the first half of 2025, with potential upward pressure in Q3 due to seasonal demand from poultry and livestock feed manufacturers. Export parity pricing will be influenced by global corn market trends and regional competition.

## Export Opportunities

With the African Continental Free Trade Area (AfCFTA) gaining momentum, Nigerian maize exporters have unprecedented access to regional markets. Key destinations include Ghana, Senegal, and Cote d'Ivoire, with growing interest from European buyers seeking non-GMO alternatives.

## Recommendations for Buyers

Early contract commitments are advisable to secure favorable pricing. Vertoc Agro offers forward contracts and bulk supply agreements with guaranteed quality standards and flexible delivery schedules.`,
  },
  {
    slug: 'sustainable-sourcing-african-agriculture',
    title: 'Sustainable Sourcing Practices in African Agriculture',
    category: 'Sustainability', published_at: '2025-05-28', read_time: '5 min read',
    author: 'Vertoc Editorial Team', image: IMG + 'stock-1625246333195-78d9c38ad449-1200.jpg',
    excerpt: 'How farmer partnerships, environmental stewardship and community investment create lasting value across the supply chain.',
    body: `Sustainability is no longer optional in modern agriculture. At Vertoc Agro, we believe that responsible sourcing practices create lasting value for farmers, communities, and the environment.

## Farmer Partnership Programs

Our approach begins with direct relationships with farming cooperatives. We provide training on best agronomic practices, soil health management, and post-harvest handling. This investment in farmer education yields higher quality produce and improved livelihoods.

## Environmental Stewardship

We actively promote reduced pesticide use through integrated pest management programs. Our warehousing facilities employ energy-efficient cooling systems, and we prioritize local sourcing to minimize transportation emissions.

## Community Impact

Beyond commercial transactions, Vertoc invests in rural community infrastructure. From borehole drilling to school support programs, we aim to create shared prosperity in the farming communities that power our business.

## Certifications and Compliance

We are working toward organic certification for select product lines and maintain full compliance with Nigerian agricultural standards as well as international sustainability frameworks relevant to our export markets.`,
  },
  {
    slug: 'export-documentation-guide-agro-commodities',
    title: 'Export Documentation Guide for Agro Commodities',
    category: 'Export Guide', published_at: '2025-05-10', read_time: '8 min read',
    author: 'Vertoc Editorial Team', image: IMG + 'stock-1596040033229-a9821ebd058d-1200.jpg',
    excerpt: 'The essential paperwork for moving agricultural commodities out of Nigeria without costly delays.',
    body: `Exporting agricultural commodities from Nigeria requires meticulous documentation and compliance with both local regulations and destination country requirements. This guide covers the essential paperwork for a smooth export process.

## Nigerian Export Requirements

All agricultural exports require registration with the Nigerian Export Promotion Council (NEPC). Key documents include the Nigerian Export Proceeds (NXP) form, phytosanitary certificates from the Plant Quarantine Service, and quality assurance certificates from relevant agencies.

## Destination Market Documentation

European Union imports require compliance with EU Regulation 2017/625 on official controls. This includes health certificates, traceability documentation, and proof of residue compliance within Maximum Residue Limits (MRLs).

## Certifications Needed

Depending on the commodity and destination, you may need: Phytosanitary Certificate, Certificate of Origin, Fumigation Certificate, Quality/Grade Certificate, Bill of Lading, Commercial Invoice and Packing List, and a Certificate of Analysis for processed goods.

## Common Pitfalls

Incomplete documentation is the leading cause of export delays. Working with experienced logistics partners who understand both Nigerian and international requirements can prevent costly shipment rejections and demurrage charges.

Vertoc Agro provides end-to-end export management, handling all documentation and compliance requirements on behalf of our clients.`,
  },
  {
    slug: 'palm-oil-processing-fruit-to-refined-oil',
    title: 'Palm Oil Processing: From Fruit to Refined Oil',
    category: 'Processing', published_at: '2025-04-22', read_time: '7 min read',
    author: 'Vertoc Editorial Team', image: IMG + 'stock-1596040033229-a9821ebd058d-1200.jpg',
    excerpt: 'The processing journey behind premium palm oil, and the quality benchmarks buyers should look for.',
    body: `Palm oil is one of Nigeria's most valuable agricultural exports. Understanding the processing journey helps buyers appreciate the quality benchmarks that distinguish premium products.

## Harvesting and Collection

Fresh fruit bunches (FFBs) are harvested when approximately 10% of the fruits have detached naturally. Timely processing within 24 hours of harvest is critical to prevent free fatty acid (FFA) development, which degrades oil quality.

## Sterilization and Digestion

FFBs are sterilized with steam to deactivate enzymes and prepare fruits for oil extraction. The digestion stage separates the palm oil from the fibrous mesocarp using mechanical pressing or solvent extraction methods.

## Clarification and Refining

Crude palm oil undergoes clarification to remove moisture and impurities. For refined products, additional steps include degumming, neutralization, bleaching, and deodorization to meet food-grade standards.

## Quality Indicators

Key quality parameters include Free Fatty Acid (FFA) content, moisture and impurities (M&I), iodine value, and color. Premium export-grade palm oil typically has FFA below 5% and M&I below 0.5%.`,
  },
  {
    slug: 'cocoa-quality-standards-international-buyers',
    title: 'Cocoa Quality Standards for International Buyers',
    category: 'Quality Standards', published_at: '2025-04-05', read_time: '6 min read',
    author: 'Vertoc Editorial Team', image: IMG + 'stock-1511381939415-e44015466834-1200.jpg',
    excerpt: 'Fermentation, drying, ICCO grading and the certifications international cocoa buyers increasingly expect.',
    body: `Nigerian cocoa is prized for its fine flavor profile, but meeting international quality standards requires careful attention throughout the value chain.

## Fermentation Protocols

Proper fermentation is essential for developing cocoa flavor precursors. Beans should be fermented for 5-7 days with regular turning to ensure uniform fermentation. Under-fermented beans produce astringent flavors, while over-fermentation leads to off-notes.

## Drying and Sorting

Sun drying to 7-8% moisture content is the traditional and preferred method. Mechanical dryers are acceptable when properly calibrated. Hand sorting removes flat, moldy, and defective beans that would otherwise downgrade the lot.

## ICCO Grading

The International Cocoa Organization establishes grading standards based on bean count per 100g, cut test results (percentage of defective beans), and moisture content. Nigerian cocoa typically grades as Grade 1 when properly handled.

## Sustainability Certifications

Increasingly, buyers demand Rainforest Alliance, Fairtrade, or UTZ certification. Vertoc Agro is actively working with farmer cooperatives to achieve these certifications for select cocoa lots.`,
  },
  {
    slug: 'navigating-currency-fluctuations-agro-trade',
    title: 'Navigating Currency Fluctuations in Agro Trade',
    category: 'Finance', published_at: '2025-03-18', read_time: '5 min read',
    author: 'Vertoc Editorial Team', image: IMG + 'stock-1579621970563-ebec7560ff3e-1200.jpg',
    excerpt: 'Practical approaches to managing exchange rate risk between Nigerian and international commodity markets.',
    body: `Currency volatility poses one of the biggest challenges for agricultural commodity traders operating between Nigeria and international markets. Understanding and managing exchange rate risk is essential for sustainable trade.

## The Naira Challenge

The Nigerian Naira has experienced significant volatility against major currencies, creating uncertainty in pricing and profitability. Exporters face the risk of receivables losing value, while importers contend with rising input costs.

## Hedging Strategies

Forward contracts in foreign exchange markets can lock in exchange rates for future transactions. While not universally accessible, working with banks that offer hedging products can provide stability.

## Pricing in Hard Currency

Many agro commodity transactions are denominated in USD to eliminate currency risk for international buyers. Local sourcing and domestic sales may remain in Naira, creating natural hedges for businesses with both import and export operations.

## Vertoc's Approach

We offer flexible pricing structures including Naira-based domestic contracts and USD-denominated export agreements. Our financial team monitors currency trends to advise clients on optimal timing for contract execution.`,
  },
]
