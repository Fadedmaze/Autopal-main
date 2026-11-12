// The vehicle catalog: every brand, make and model (trim) a car can be saved as.
// Add/Edit Vehicle only offers these, and the database checks new cars against the same
// list (supabase/migrations/20261111_vehicle_catalog.sql is generated from this file by
// scripts/build-vehicle-catalog-sql.mjs, so edit here and re-run the script).
//
// One line per make:  Make | body | first model year | last model year | trims
//   body: s = sedan, h = hatchback / wagon, c = coupe / convertible / sports car,
//         u = SUV / crossover, t = pickup truck, v = van / minivan
//   last model year is blank while the make is still sold (2027 models on sale now).
//   trims are the common US trim levels across the years, not every package.
// US-market cars sold new from 2000 on (start years go back further for long-running
// names). Last reviewed November 2026.

export const CATALOG_DATA = {
  "Acura": `
ADX | u | 2025 | | Base, A-Spec, A-Spec Advance
ILX | s | 2013 | 2022 | Base, Premium, Technology, A-Spec
Integra | h | 2023 | | Base, A-Spec, A-Spec Technology, Type S
MDX | u | 2001 | | Base, Technology, A-Spec, Advance, Type S
NSX | c | 1991 | 2022 | Base, Type S
RDX | u | 2007 | | Base, Technology, A-Spec, Advance
RL | s | 1996 | 2012 | Base, Technology
RLX | s | 2014 | 2020 | Base, Technology, Advance, Sport Hybrid
RSX | c | 2002 | 2006 | Base, Type-S
TL | s | 1996 | 2014 | Base, Technology, Type-S, SH-AWD
TLX | s | 2015 | | Base, Technology, A-Spec, Advance, Type S
TSX | s | 2004 | 2014 | Base, Technology, Sport Wagon, V6
ZDX | u | 2010 | | Base, A-Spec, Type S`,

  "Alfa Romeo": `
4C | c | 2015 | 2020 | Coupe, Spider
Giulia | s | 2017 | | Sprint, Ti, Veloce, Quadrifoglio
Stelvio | u | 2018 | | Sprint, Ti, Veloce, Quadrifoglio
Tonale | u | 2023 | | Sprint, Ti, Veloce`,

  "Aston Martin": `
DB11 | c | 2017 | 2023 | V8, V12, AMR
DB12 | c | 2024 | | Coupe, Volante
DBS | c | 2019 | 2024 | Superleggera, Volante, 770 Ultimate
DBX | u | 2021 | | V8, 707
Vanquish | c | 2025 | | Base
Vantage | c | 2006 | | Base, Roadster, F1 Edition`,

  "Audi": `
A3 | s | 2006 | | Premium, Premium Plus, Prestige
A4 | s | 1996 | | Premium, Premium Plus, Prestige
A4 allroad | h | 2013 | 2024 | Premium, Premium Plus, Prestige
A5 | c | 2008 | | Premium, Premium Plus, Prestige
A5 Sportback | h | 2018 | | Premium, Premium Plus, Prestige
A6 | s | 1995 | | Premium, Premium Plus, Prestige
A6 allroad | h | 2020 | | Premium Plus, Prestige
A6 e-tron | s | 2025 | | Premium, Premium Plus, Prestige
A7 | h | 2012 | | Premium, Premium Plus, Prestige
A8 | s | 1997 | | Base, L
e-tron | u | 2019 | 2023 | Premium, Premium Plus, Prestige
e-tron GT | s | 2022 | | Premium Plus, Prestige, RS, S
Q3 | u | 2015 | | Premium, Premium Plus, Prestige
Q4 e-tron | u | 2022 | | Premium, Premium Plus, Prestige
Q5 | u | 2009 | | Premium, Premium Plus, Prestige
Q6 e-tron | u | 2025 | | Premium, Premium Plus, Prestige
Q7 | u | 2007 | | Premium, Premium Plus, Prestige
Q8 | u | 2019 | | Premium, Premium Plus, Prestige
R8 | c | 2008 | 2024 | V10, V10 Performance, GT
RS 3 | s | 2017 | | Base
RS 5 | c | 2013 | | Base, Sportback
RS 6 Avant | h | 2021 | | Base, Performance
RS 7 | h | 2014 | | Base, Performance
S3 | s | 2015 | | Premium, Premium Plus, Prestige
S4 | s | 2000 | | Premium, Premium Plus, Prestige
S5 | c | 2008 | | Premium, Premium Plus, Prestige
SQ5 | u | 2014 | | Premium, Premium Plus, Prestige
TT | c | 2000 | 2023 | Base, S, RS`,

  "Bentley": `
Bentayga | u | 2017 | | V8, Azure, S, Speed, EWB
Continental GT | c | 2004 | | V8, Azure, S, Speed, Mulliner
Flying Spur | s | 2006 | | V8, Azure, S, Speed, Mulliner`,

  "BMW": `
1 Series | c | 2008 | 2013 | 128i, 135i, 135is
2 Series | c | 2014 | | 228i, 230i, M235i, M240i
2 Series Gran Coupe | s | 2020 | | 228i, M235i
3 Series | s | 1977 | | 320i, 328i, 330i, 330e, 335i, 340i, M340i
4 Series | c | 2014 | | 428i, 430i, 435i, 440i, M440i
4 Series Gran Coupe | h | 2015 | | 430i, 440i, M440i
5 Series | s | 1982 | | 528i, 530i, 530e, 535i, 540i, 550i, M550i
6 Series | c | 2004 | 2019 | 640i, 650i, Gran Turismo
7 Series | s | 1978 | | 740i, 750i, 760i, i7
8 Series | c | 2019 | 2025 | 840i, M850i, Gran Coupe
i3 | h | 2014 | 2021 | Base, REx, s
i4 | s | 2022 | | eDrive35, eDrive40, xDrive40, M50
i5 | s | 2024 | | eDrive40, xDrive40, M60
i7 | s | 2023 | | eDrive50, xDrive60, M70
i8 | c | 2014 | 2020 | Coupe, Roadster
iX | u | 2022 | | xDrive45, xDrive50, xDrive60, M60
M2 | c | 2016 | | Base, Competition
M3 | s | 1988 | | Base, Competition, CS
M4 | c | 2015 | | Base, Competition, CS, CSL
M5 | s | 1988 | | Base, Competition, CS
M8 | c | 2020 | 2025 | Competition, Gran Coupe
X1 | u | 2013 | | sDrive28i, xDrive28i, M35i
X2 | u | 2018 | | sDrive28i, xDrive28i, M35i
X3 | u | 2004 | | sDrive30i, xDrive30i, 30 xDrive, M40i, M50, X3 M
X4 | u | 2015 | | xDrive30i, M40i, X4 M
X5 | u | 2000 | | sDrive40i, xDrive40i, xDrive45e, xDrive50e, M60i, X5 M
X6 | u | 2008 | | sDrive40i, xDrive40i, M60i, X6 M
X7 | u | 2019 | | xDrive40i, M60i, Alpina XB7
XM | u | 2023 | | Base, Label
Z4 | c | 2003 | | sDrive30i, M40i`,

  "Buick": `
Cascada | c | 2016 | 2019 | 1SV, Premium, Sport Touring
Enclave | u | 2008 | | Preferred, Essence, Sport Touring, Avenir
Encore | u | 2013 | 2022 | Preferred, Essence, Sport Touring
Encore GX | u | 2020 | | Preferred, Sport Touring, Avenir
Envision | u | 2016 | | Preferred, Sport Touring, Avenir
Envista | u | 2024 | | Preferred, Sport Touring, Avenir
LaCrosse | s | 2005 | 2019 | Base, Preferred, Essence, Premium
LeSabre | s | 1959 | 2005 | Custom, Limited
Lucerne | s | 2006 | 2011 | CX, CXL, Super
Rainier | u | 2004 | 2007 | CXL
Regal | s | 1973 | 2020 | Preferred, Essence, Sportback, TourX, GS
Rendezvous | u | 2002 | 2007 | CX, CXL, Ultra
Verano | s | 2012 | 2017 | Base, Convenience, Leather, Sport Touring`,

  "Cadillac": `
ATS | s | 2013 | 2019 | Base, Luxury, Premium Luxury, V
CT4 | s | 2020 | 2025 | Luxury, Premium Luxury, Sport, V-Series, Blackwing
CT5 | s | 2020 | | Luxury, Premium Luxury, Sport, V-Series, Blackwing
CT6 | s | 2016 | 2020 | Luxury, Premium Luxury, Platinum, Sport, V-Series
CTS | s | 2003 | 2019 | Base, Luxury, Premium, V-Sport, V
DTS | s | 2006 | 2011 | Base, Luxury, Premium, Platinum
ELR | c | 2014 | 2016 | Base, Sport
Escalade | u | 1999 | | Luxury, Premium Luxury, Sport, Platinum, V-Series
Escalade ESV | u | 2003 | | Luxury, Premium Luxury, Sport, Platinum, V-Series
Escalade IQ | u | 2025 | | Luxury, Sport, Premium Luxury, Sport Platinum
Lyriq | u | 2023 | | Tech, Luxury, Sport, V
Optiq | u | 2025 | | Luxury, Sport, V
SRX | u | 2004 | 2016 | Base, Luxury, Performance, Premium
STS | s | 2005 | 2011 | V6, V8, V
Vistiq | u | 2026 | | Luxury, Sport, Platinum
XLR | c | 2004 | 2009 | Base, V
XT4 | u | 2019 | 2025 | Luxury, Premium Luxury, Sport
XT5 | u | 2017 | 2025 | Luxury, Premium Luxury, Sport
XT6 | u | 2020 | 2025 | Luxury, Premium Luxury, Sport
XTS | s | 2013 | 2019 | Base, Luxury, Premium Luxury, Platinum`,

  "Chevrolet": `
Avalanche | t | 2002 | 2013 | LS, LT, LTZ, Z71
Aveo | s | 2004 | 2011 | LS, LT, Special Value
Blazer | u | 2019 | | 2LT, 3LT, RS, Premier
Blazer EV | u | 2024 | | LT, RS, SS
Bolt | h | 2017 | | LT, Premier, 1LT, 2LT
Bolt EUV | u | 2022 | 2023 | LT, Premier
Camaro | c | 1967 | 2024 | LS, LT, SS, ZL1
Captiva Sport | u | 2012 | 2015 | LS, LT, LTZ
Cobalt | s | 2005 | 2010 | LS, LT, SS
Colorado | t | 2004 | | WT, LT, Trail Boss, Z71, ZR2
Corvette | c | 1953 | | Stingray, Grand Sport, Z06, E-Ray, ZR1
Cruze | s | 2011 | 2019 | L, LS, LT, Premier, Diesel
Equinox | u | 2005 | | LS, LT, RS, Premier, ACTIV
Equinox EV | u | 2024 | | LT, RS
Express | v | 1996 | | Cargo, Passenger, LS, LT
HHR | h | 2006 | 2011 | LS, LT, SS
Impala | s | 2000 | 2020 | LS, LT, LTZ, Premier
Malibu | s | 1997 | 2025 | LS, RS, LT, Premier, 2LT
Silverado 1500 | t | 1999 | | WT, Custom, LT, RST, LTZ, Trail Boss, ZR2, High Country
Silverado 2500HD | t | 2001 | | WT, Custom, LT, LTZ, ZR2, High Country
Silverado 3500HD | t | 2001 | | WT, LT, LTZ, High Country
Silverado EV | t | 2024 | | WT, LT, RST, Trail Boss
Sonic | s | 2012 | 2020 | LS, LT, Premier, RS
Spark | h | 2013 | 2022 | LS, 1LT, 2LT, ACTIV
SS | s | 2014 | 2017 | Base
Suburban | u | 1935 | | LS, LT, RST, Z71, Premier, High Country
Tahoe | u | 1995 | | LS, LT, RST, Z71, Premier, High Country
Trailblazer | u | 2002 | | LS, LT, ACTIV, RS
Traverse | u | 2009 | | LS, LT, Z71, RS, Premier, High Country
Trax | u | 2015 | | LS, 1RS, LT, 2RS, ACTIV
Uplander | v | 2005 | 2008 | LS, LT
Volt | h | 2011 | 2019 | Base, LT, Premier`,

  "Chrysler": `
200 | s | 2011 | 2017 | LX, Limited, S, C
300 | s | 1999 | 2023 | Touring, Limited, S, C, 300C
Aspen | u | 2007 | 2009 | Limited
Crossfire | c | 2004 | 2008 | Base, Limited, SRT-6
Pacifica | v | 2017 | | Touring, Touring L, Limited, Pinnacle, Hybrid
PT Cruiser | h | 2001 | 2010 | Base, Touring, Limited, GT
Sebring | s | 2001 | 2010 | LX, Touring, Limited
Town & Country | v | 1990 | 2016 | Touring, Touring-L, Limited
Voyager | v | 2020 | | LX`,

  "Dodge": `
Avenger | s | 2008 | 2014 | SE, SXT, R/T
Caliber | h | 2007 | 2012 | SE, SXT, R/T, SRT4
Challenger | c | 2008 | 2023 | SXT, GT, R/T, Scat Pack, SRT Hellcat, SRT Demon
Charger | s | 2006 | | SXT, GT, R/T, Scat Pack, SRT Hellcat, Daytona, Sixpack
Dart | s | 2013 | 2016 | SE, SXT, Limited, GT
Durango | u | 1998 | | SXT, GT, R/T, Citadel, SRT 392, SRT Hellcat
Grand Caravan | v | 1987 | 2020 | SE, SXT, GT
Hornet | u | 2023 | | GT, R/T
Journey | u | 2009 | 2020 | SE, SXT, Crossroad, GT
Magnum | h | 2005 | 2008 | SE, SXT, R/T, SRT8
Neon | s | 1995 | 2005 | SE, SXT, SRT-4
Nitro | u | 2007 | 2011 | SE, SXT, R/T, Heat
Viper | c | 1992 | 2017 | SRT-10, GTS, ACR`,

  "Ferrari": `
12Cilindri | c | 2025 | | Coupe, Spider
296 GTB | c | 2022 | | GTB, GTS
812 Superfast | c | 2018 | 2024 | Superfast, GTS, Competizione
F8 Tributo | c | 2020 | 2023 | Tributo, Spider
Purosangue | u | 2023 | | Base
Roma | c | 2021 | | Coupe, Spider
SF90 Stradale | c | 2021 | | Stradale, Spider, XX`,

  "Fiat": `
124 Spider | c | 2017 | 2020 | Classica, Lusso, Abarth
500 | h | 2012 | 2019 | Pop, Lounge, Sport, Abarth
500e | h | 2013 | | Base, Inspired by, Abarth
500L | h | 2014 | 2020 | Pop, Easy, Trekking, Lounge
500X | u | 2016 | 2023 | Pop, Trekking, Lounge, Sport`,

  "Fisker": `
Karma | s | 2012 | 2012 | EcoStandard, EcoSport, EcoChic
Ocean | u | 2023 | 2024 | Sport, Ultra, Extreme`,

  "Ford": `
Bronco | u | 2021 | | Base, Big Bend, Black Diamond, Outer Banks, Badlands, Wildtrak, Raptor
Bronco Sport | u | 2021 | | Big Bend, Outer Banks, Badlands
C-Max | h | 2013 | 2018 | SE, SEL, Titanium, Energi
Crown Victoria | s | 1992 | 2011 | Standard, LX, Police Interceptor
E-Series | v | 1992 | | Cargo, Passenger, Cutaway
EcoSport | u | 2018 | 2022 | S, SE, SES, Titanium
Edge | u | 2007 | 2024 | SE, SEL, ST-Line, Titanium, ST
Escape | u | 2001 | | S, Active, SE, ST-Line, SEL, Platinum, Hybrid
Excursion | u | 2000 | 2005 | XLS, XLT, Eddie Bauer, Limited
Expedition | u | 1997 | | XL, XLT, Active, Tremor, Limited, King Ranch, Platinum
Explorer | u | 1991 | | Base, Active, XLT, ST-Line, Limited, Timberline, ST, Platinum
F-150 | t | 1975 | | XL, STX, XLT, Lariat, Tremor, King Ranch, Platinum, Limited, Raptor
F-150 Lightning | t | 2022 | | Pro, XLT, Flash, Lariat, Platinum
F-250 Super Duty | t | 1999 | | XL, XLT, Lariat, King Ranch, Platinum, Limited, Tremor
F-350 Super Duty | t | 1999 | | XL, XLT, Lariat, King Ranch, Platinum, Limited
F-450 Super Duty | t | 1999 | | XL, XLT, Lariat, King Ranch, Platinum, Limited
Fiesta | h | 2011 | 2019 | S, SE, Titanium, ST
Five Hundred | s | 2005 | 2007 | SE, SEL, Limited
Flex | u | 2009 | 2019 | SE, SEL, Limited
Focus | s | 2000 | 2018 | S, SE, SEL, Titanium, ST, RS, Electric
Freestyle | u | 2005 | 2007 | SE, SEL, Limited
Fusion | s | 2006 | 2020 | S, SE, SEL, Titanium, Sport, Hybrid, Energi
GT | c | 2005 | 2022 | Base, Carbon Series, Heritage Edition
Maverick | t | 2022 | | XL, XLT, Lariat, Tremor, Lobo
Mustang | c | 1965 | | EcoBoost, GT, Dark Horse, Mach 1, Shelby GT500
Mustang Mach-E | u | 2021 | | Select, Premium, California Route 1, GT, Rally
Ranger | t | 1983 | | XL, XLT, Lariat, Raptor
Taurus | s | 1986 | 2019 | SE, SEL, Limited, SHO
Taurus X | u | 2008 | 2009 | SEL, Eddie Bauer, Limited
Transit | v | 2015 | | Cargo, Crew, Passenger, Trail
Transit Connect | v | 2010 | 2023 | XL, XLT, Titanium`,

  "Genesis": `
G70 | s | 2019 | | 2.5T, 3.3T, Sport Prestige
G80 | s | 2017 | | 2.5T, 3.5T, Sport Prestige, Electrified
G90 | s | 2017 | | 3.5T, 3.5T E-Supercharger
GV60 | u | 2023 | | Standard, Advanced, Performance
GV70 | u | 2022 | | 2.5T, 3.5T, Sport Prestige, Electrified
GV80 | u | 2021 | | 2.5T, 3.5T, Prestige
GV80 Coupe | u | 2025 | | 3.5T, 3.5T E-Supercharger`,

  "GMC": `
Acadia | u | 2007 | | SLE, SLT, AT4, Denali
Canyon | t | 2004 | | Elevation, AT4, AT4X, Denali
Envoy | u | 1998 | 2009 | SLE, SLT, Denali
Hummer EV | t | 2022 | | 2X, 3X, Edition 1
Hummer EV SUV | u | 2024 | | 2X, 3X, Edition 1
Savana | v | 1996 | | Cargo, Passenger, LS, LT
Sierra 1500 | t | 1999 | | Pro, SLE, Elevation, SLT, AT4, AT4X, Denali
Sierra 2500HD | t | 2001 | | Pro, SLE, SLT, AT4, Denali
Sierra 3500HD | t | 2001 | | Pro, SLE, SLT, AT4, Denali
Sierra EV | t | 2025 | | Elevation, AT4, Denali
Terrain | u | 2010 | | SLE, SLT, AT4, Elevation, Denali
Yukon | u | 1992 | | SLE, SLT, AT4, Denali, Denali Ultimate
Yukon XL | u | 2000 | | SLE, SLT, AT4, Denali, Denali Ultimate`,

  "Honda": `
Accord | s | 1976 | | LX, Sport, SE, EX, EX-L, Touring, Hybrid
Civic | s | 1973 | | LX, Sport, EX, EX-L, Touring, Si, Hybrid
Civic Hatchback | h | 2017 | | LX, Sport, EX-L, Sport Touring, Hybrid
Civic Type R | h | 2017 | | Base
Clarity | s | 2017 | 2021 | Plug-In Hybrid, Touring, Fuel Cell
CR-V | u | 1997 | | LX, EX, EX-L, Sport, Sport-L, Touring, TrailSport, Hybrid
CR-Z | h | 2011 | 2016 | Base, EX
Crosstour | h | 2010 | 2015 | EX, EX-L
Element | u | 2003 | 2011 | LX, EX, SC
Fit | h | 2007 | 2020 | LX, Sport, EX, EX-L
HR-V | u | 2016 | | LX, Sport, EX-L
Insight | s | 2000 | 2022 | Base, EX, Touring
Odyssey | v | 1995 | | LX, EX, EX-L, Sport, Touring, Elite
Passport | u | 1994 | | EX-L, TrailSport, Black Edition
Pilot | u | 2003 | | LX, Sport, EX-L, Touring, TrailSport, Elite, Black Edition
Prelude | c | 1979 | | Base
Prologue | u | 2024 | | EX, Touring, Elite
Ridgeline | t | 2006 | | Sport, RTL, TrailSport, Black Edition
S2000 | c | 2000 | 2009 | Base, CR`,

  "Hummer": `
H1 | u | 1992 | 2006 | Base, Alpha
H2 | u | 2003 | 2009 | Base, SUT, Luxury
H3 | u | 2006 | 2010 | Base, Adventure, Luxury, Alpha
H3T | t | 2009 | 2010 | Base, Adventure, Luxury, Alpha`,

  "Hyundai": `
Accent | s | 1995 | 2022 | SE, SEL, Limited
Azera | s | 2006 | 2017 | Base, Limited
Elantra | s | 1991 | | SE, SEL, Limited, N Line, N, Hybrid
Elantra GT | h | 2001 | 2020 | Base, Sport, N Line
Entourage | v | 2007 | 2009 | GLS, SE, Limited
Equus | s | 2011 | 2016 | Signature, Ultimate
Genesis | s | 2009 | 2016 | 3.8, 5.0
Genesis Coupe | c | 2010 | 2016 | 2.0T, 3.8, R-Spec, Ultimate
Ioniq | h | 2017 | 2022 | Blue, SE, SEL, Limited, Electric, Plug-In Hybrid
Ioniq 5 | u | 2022 | | SE, SEL, Limited, XRT, N
Ioniq 6 | s | 2023 | | SE, SEL, Limited, N
Ioniq 9 | u | 2026 | | S, SE, SEL, Performance Calligraphy
Kona | u | 2018 | | SE, SEL, N Line, Limited
Kona Electric | u | 2019 | | SE, SEL, Limited
Nexo | u | 2019 | | Blue, Limited
Palisade | u | 2020 | | SE, SEL, XRT, Limited, Calligraphy
Santa Cruz | t | 2022 | | SE, SEL, XRT, Limited
Santa Fe | u | 2001 | | SE, SEL, XRT, Limited, Calligraphy, Hybrid
Sonata | s | 1989 | | SE, SEL, N Line, Limited, Hybrid
Tiburon | c | 1997 | 2008 | GS, GT, SE
Tucson | u | 2005 | | SE, SEL, XRT, N Line, Limited, Hybrid, Plug-In Hybrid
Veloster | h | 2012 | 2022 | Base, Turbo, N
Venue | u | 2020 | | SE, SEL, Limited
Veracruz | u | 2007 | 2012 | GLS, SE, Limited`,

  "Infiniti": `
EX35 | u | 2008 | 2012 | Base, Journey
FX35 | u | 2003 | 2012 | Base, Sport
G35 | s | 2003 | 2008 | Base, Journey, Sport, x
G37 | s | 2008 | 2013 | Base, Journey, Sport, x
M37 | s | 2011 | 2013 | Base, x
Q50 | s | 2014 | 2024 | Pure, Luxe, Sport, Red Sport 400
Q60 | c | 2017 | 2022 | Pure, Luxe, Red Sport 400
Q70 | s | 2014 | 2019 | 3.7, 5.6, Hybrid
QX30 | u | 2017 | 2019 | Base, Luxury, Sport
QX50 | u | 2014 | 2025 | Pure, Luxe, Sport, Autograph
QX55 | u | 2022 | 2025 | Luxe, Essential, Sensory
QX56 | u | 2004 | 2013 | Base
QX60 | u | 2014 | | Pure, Luxe, Sensory, Autograph
QX70 | u | 2014 | 2017 | Base, Sport
QX80 | u | 2014 | | Pure, Luxe, Sensory, Autograph`,

  "Jaguar": `
E-Pace | u | 2018 | 2024 | S, SE, R-Dynamic
F-Pace | u | 2017 | | Prestige, R-Dynamic, SVR
F-Type | c | 2014 | 2024 | Base, R-Dynamic, R, 75
I-Pace | u | 2019 | 2024 | S, SE, HSE
S-Type | s | 2000 | 2008 | 3.0, 4.2, R
XE | s | 2017 | 2020 | Base, Premium, Prestige, R-Sport
XF | s | 2009 | 2024 | Premium, Prestige, R-Dynamic, R
XJ | s | 1986 | 2019 | Base, L, R-Sport, Supercharged
XK | c | 1997 | 2015 | Base, Portfolio, R, R-S`,

  "Jeep": `
Cherokee | u | 2014 | | Latitude, Limited, Trailhawk, Overland, Base
Commander | u | 2006 | 2010 | Sport, Limited, Overland
Compass | u | 2007 | | Sport, Latitude, Limited, Trailhawk
Gladiator | t | 2020 | | Sport, Willys, Rubicon, Mojave
Grand Cherokee | u | 1993 | | Laredo, Altitude, Limited, Trailhawk, Overland, Summit, 4xe, SRT, Trackhawk
Grand Cherokee L | u | 2021 | | Laredo, Altitude, Limited, Overland, Summit
Grand Wagoneer | u | 2022 | | Series I, Series II, Series III, Obsidian
Liberty | u | 2002 | 2012 | Sport, Limited, Renegade
Patriot | u | 2007 | 2017 | Sport, Latitude, Limited
Recon | u | 2026 | | Base, Moab
Renegade | u | 2015 | 2023 | Sport, Latitude, Limited, Trailhawk
Wagoneer | u | 2022 | | Series I, Series II, Series III
Wagoneer S | u | 2024 | | Launch Edition, Limited
Wrangler | u | 1987 | | Sport, Willys, Sahara, Rubicon, Rubicon 392, 4xe`,

  "Kia": `
Borrego | u | 2009 | 2009 | LX, EX
Cadenza | s | 2014 | 2020 | Premium, Technology, Limited
Carnival | v | 2022 | | LX, EX, SX, SX-Prestige, Hybrid
EV6 | u | 2022 | | Light, Wind, GT-Line, GT
EV9 | u | 2024 | | Light, Wind, Land, GT-Line
Forte | s | 2010 | 2024 | FE, LXS, GT-Line, GT
K4 | s | 2025 | | LX, LXS, EX, GT-Line
K5 | s | 2021 | | LX, LXS, GT-Line, EX, GT
K900 | s | 2015 | 2020 | Luxury, Elite
Niro | u | 2017 | | LX, EX, SX, Plug-In Hybrid, EV
Optima | s | 2001 | 2020 | LX, S, EX, SX
Rio | s | 2001 | 2023 | LX, S, EX
Sedona | v | 2002 | 2021 | L, LX, EX, SX
Seltos | u | 2021 | | LX, S, EX, SX
Sorento | u | 2003 | | LX, S, EX, SX, X-Line, Hybrid, Plug-In Hybrid
Soul | h | 2010 | | LX, S, GT-Line, EX
Spectra | s | 2000 | 2009 | LX, EX, SX
Sportage | u | 1995 | | LX, EX, SX, X-Line, X-Pro, Hybrid
Stinger | h | 2018 | 2023 | GT-Line, GT, GT1, GT2
Telluride | u | 2020 | | LX, S, EX, SX, X-Line, X-Pro`,

  "Lamborghini": `
Aventador | c | 2012 | 2022 | LP 700-4, S, SVJ, Ultimae
Gallardo | c | 2004 | 2014 | LP 550-2, LP 560-4, Spyder
Huracán | c | 2015 | 2024 | EVO, STO, Tecnica, Sterrato
Revuelto | c | 2024 | | Base
Temerario | c | 2025 | | Base
Urus | u | 2019 | | S, Performante, SE`,

  "Land Rover": `
Defender | u | 2020 | | 90, 110, 130, S, X-Dynamic, X, V8, Octa
Discovery | u | 2017 | | S, Dynamic SE, Dynamic HSE
Discovery Sport | u | 2015 | | S, Dynamic SE
LR2 | u | 2008 | 2015 | Base, HSE
LR3 | u | 2005 | 2009 | SE, HSE
LR4 | u | 2010 | 2016 | Base, HSE, HSE LUX
Range Rover | u | 1987 | | SE, HSE, Autobiography, SV
Range Rover Evoque | u | 2012 | | S, Dynamic SE, Dynamic HSE
Range Rover Sport | u | 2006 | | SE, Dynamic SE, Autobiography, SV
Range Rover Velar | u | 2018 | | S, Dynamic SE, Dynamic HSE`,

  "Lexus": `
CT | h | 2011 | 2017 | 200h, F Sport
ES | s | 1990 | | 250, 300h, 350, F Sport
GS | s | 1993 | 2020 | 300, 350, 450h, F Sport, GS F
GX | u | 2003 | | 460, 550, Premium, Overtrail, Luxury
HS | s | 2010 | 2012 | 250h, Premium
IS | s | 2001 | | 300, 350, 500, F Sport
LC | c | 2018 | | 500, 500h, Convertible
LFA | c | 2012 | 2012 | Base
LS | s | 1990 | | 460, 500, 500h, F Sport
LX | u | 1996 | | 570, 600, 700h, Premium, Luxury, F Sport
NX | u | 2015 | | 250, 350, 350h, 450h+, F Sport
RC | c | 2015 | 2025 | 300, 350, F Sport, RC F
RX | u | 1999 | | 350, 350h, 450h+, 500h, F Sport
RZ | u | 2023 | | 300e, 450e
SC | c | 2002 | 2010 | 430
TX | u | 2024 | | 350, 500h, 550h+, Premium, Luxury
UX | u | 2019 | | 200, 250h, 300h, F Sport`,

  "Lincoln": `
Aviator | u | 2003 | | Base, Reserve, Black Label, Grand Touring
Continental | s | 2017 | 2020 | Premiere, Select, Reserve, Black Label
Corsair | u | 2020 | | Base, Premiere, Reserve, Grand Touring
LS | s | 2000 | 2006 | V6, V8
MKC | u | 2015 | 2019 | Premiere, Select, Reserve, Black Label
MKS | s | 2009 | 2016 | Base, EcoBoost
MKT | u | 2010 | 2019 | Base, EcoBoost
MKX | u | 2007 | 2018 | Premiere, Select, Reserve, Black Label
MKZ | s | 2007 | 2020 | Base, Select, Reserve, Black Label, Hybrid
Nautilus | u | 2019 | | Premiere, Reserve, Black Label
Navigator | u | 1998 | | Base, Premiere, Reserve, Black Label
Town Car | s | 1981 | 2011 | Signature, Signature Limited, Executive`,

  "Lotus": `
Eletre | u | 2025 | | Base, S, R
Elise | c | 2005 | 2011 | Base, SC
Emira | c | 2023 | | 2.0, V6
Evora | c | 2010 | 2021 | Base, S, 400, GT
Exige | c | 2006 | 2011 | S, S 260`,

  "Lucid": `
Air | s | 2022 | | Pure, Touring, Grand Touring, Sapphire
Gravity | u | 2025 | | Touring, Grand Touring`,

  "Maserati": `
Ghibli | s | 2014 | 2024 | Base, GT, Modena, Trofeo
GranTurismo | c | 2008 | | Modena, Trofeo, Folgore
Grecale | u | 2023 | | GT, Modena, Trofeo, Folgore
Levante | u | 2017 | 2024 | Base, GT, Modena, Trofeo
MC20 | c | 2022 | | Coupe, Cielo
Quattroporte | s | 2004 | 2023 | S, GT, Modena, Trofeo`,

  "Mazda": `
CX-3 | u | 2016 | 2021 | Sport, Touring, Grand Touring
CX-30 | u | 2020 | | 2.5 S, Select, Preferred, Premium, Turbo
CX-5 | u | 2013 | | 2.5 S, Select, Preferred, Carbon Edition, Premium, Turbo Signature
CX-50 | u | 2023 | | 2.5 S, Select, Preferred, Meridian, Premium, Turbo, Hybrid
CX-7 | u | 2007 | 2012 | Sport, Touring, Grand Touring
CX-70 | u | 2025 | | 3.3 Turbo, Premium, PHEV
CX-9 | u | 2007 | 2023 | Sport, Touring, Grand Touring, Signature
CX-90 | u | 2024 | | Select, Preferred, Premium, Turbo S, PHEV
Mazda2 | h | 2011 | 2014 | Sport, Touring
Mazda3 | s | 2004 | | 2.5 S, Select, Preferred, Premium, Turbo
Mazda3 Hatchback | h | 2004 | | 2.5 S, Select, Preferred, Premium, Turbo
Mazda5 | v | 2006 | 2015 | Sport, Touring, Grand Touring
Mazda6 | s | 2003 | 2021 | Sport, Touring, Grand Touring, Signature
MX-30 | u | 2022 | 2023 | Base, Premium Plus
MX-5 Miata | c | 1990 | | Sport, Club, Grand Touring, RF
RX-8 | c | 2004 | 2011 | Base, Sport, Grand Touring, R3
Tribute | u | 2001 | 2011 | i, s, Touring, Grand Touring`,

  "McLaren": `
570S | c | 2016 | 2021 | Coupe, Spider, GT
720S | c | 2018 | 2023 | Coupe, Spider
750S | c | 2024 | | Coupe, Spider
Artura | c | 2023 | | Coupe, Spider
GT | c | 2020 | 2024 | Base
GTS | c | 2025 | | Base`,

  "Mercedes-Benz": `
A-Class | s | 2019 | 2022 | A 220, AMG A 35
AMG GT | c | 2016 | | 43, 55, 63, R, Black Series
C-Class | s | 1994 | | C 230, C 250, C 300, C 350, AMG C 43, AMG C 63
CLA | s | 2014 | | CLA 250, AMG CLA 35, AMG CLA 45
CLE | c | 2024 | | CLE 300, CLE 450, AMG CLE 53
CLS | s | 2006 | 2023 | CLS 450, CLS 550, AMG CLS 53, AMG CLS 63
E-Class | s | 1986 | | E 300, E 350, E 450, AMG E 53, AMG E 63
EQB | u | 2022 | 2025 | EQB 250+, EQB 300, EQB 350
EQE | s | 2023 | 2025 | EQE 350+, EQE 350, EQE 500, AMG EQE
EQE SUV | u | 2023 | 2025 | EQE 350+, EQE 350, EQE 500, AMG EQE
EQS | s | 2022 | | EQS 450+, EQS 450, EQS 580, AMG EQS
EQS SUV | u | 2023 | | EQS 450+, EQS 450, EQS 580, Maybach
G-Class | u | 2002 | | G 550, AMG G 63, G 580 EQ
GL | u | 2007 | 2016 | GL 350, GL 450, GL 550, AMG GL 63
GLA | u | 2015 | | GLA 250, AMG GLA 35, AMG GLA 45
GLB | u | 2020 | | GLB 250, AMG GLB 35
GLC | u | 2016 | | GLC 300, GLC 350e, AMG GLC 43, AMG GLC 63
GLC Coupe | u | 2017 | | GLC 300, AMG GLC 43, AMG GLC 63
GLE | u | 2016 | | GLE 350, GLE 450, GLE 580, AMG GLE 53, AMG GLE 63
GLK | u | 2010 | 2015 | GLK 250, GLK 350
GLS | u | 2017 | | GLS 450, GLS 580, AMG GLS 63, Maybach GLS 600
M-Class | u | 1998 | 2015 | ML 350, ML 550, ML 63 AMG
Metris | v | 2016 | 2023 | Cargo, Passenger
S-Class | s | 1991 | | S 450, S 500, S 550, S 580, AMG S 63, Maybach
SL | c | 1990 | | SL 55, SL 63, SL 43
SLC | c | 2017 | 2020 | SLC 300, AMG SLC 43
SLK | c | 1998 | 2016 | SLK 250, SLK 300, SLK 350, SLK 55 AMG
Sprinter | v | 2003 | | Cargo, Crew, Passenger`,

  "Mercury": `
Grand Marquis | s | 1983 | 2011 | GS, LS
Mariner | u | 2005 | 2011 | Base, Premier, Hybrid
Milan | s | 2006 | 2011 | Base, Premier, Hybrid
Montego | s | 2005 | 2007 | Luxury, Premier
Mountaineer | u | 1997 | 2010 | Base, Premier
Sable | s | 1986 | 2009 | GS, LS, Premier`,

  "Mini": `
Clubman | h | 2008 | 2024 | Cooper, Cooper S, JCW
Convertible | c | 2005 | | Cooper, Cooper S, JCW
Cooper | h | 2002 | | Classic, Signature, Iconic, Cooper S, JCW, SE
Countryman | u | 2011 | | Cooper S, JCW, SE
Paceman | h | 2013 | 2016 | Cooper, Cooper S, JCW`,

  "Mitsubishi": `
Eclipse | c | 1990 | 2012 | GS, GT, Spyder
Eclipse Cross | u | 2018 | | ES, LE, SE, SEL
Endeavor | u | 2004 | 2011 | LS, SE
Galant | s | 1985 | 2012 | DE, ES, SE, GTS, Ralliart
Lancer | s | 2002 | 2017 | ES, SE, GTS, Ralliart, Evolution
Mirage | h | 2014 | 2024 | ES, LE, SE
Mirage G4 | s | 2017 | 2024 | ES, LE, SE
Montero | u | 1983 | 2006 | XLS, Limited
Outlander | u | 2003 | | ES, SE, SEL, Ralliart
Outlander PHEV | u | 2018 | | ES, SE, SEL
Outlander Sport | u | 2011 | 2024 | S, ES, LE, SE`,

  "Nissan": `
350Z | c | 2003 | 2009 | Base, Enthusiast, Touring, Grand Touring, NISMO
370Z | c | 2009 | 2020 | Base, Sport, Touring, NISMO
Altima | s | 1993 | | S, SV, SR, SL, Platinum
Ariya | u | 2023 | | Engage, Venture+, Evolve+, Platinum+
Armada | u | 2004 | | S, SV, SL, Platinum, PRO-4X
Cube | h | 2009 | 2014 | Base, S, SL, Krom
Frontier | t | 1998 | | S, SV, PRO-X, PRO-4X
GT-R | c | 2009 | 2024 | Premium, T-spec, NISMO
Juke | u | 2011 | 2017 | S, SV, SL, NISMO
Kicks | u | 2018 | | S, SV, SR
Leaf | h | 2011 | | S, SV, SV Plus, Platinum+
Maxima | s | 1981 | 2023 | S, SV, SR, Platinum
Murano | u | 2003 | | SV, SL, Platinum
NV | v | 2012 | 2021 | Cargo, Passenger
NV200 | v | 2013 | 2021 | S, SV
Pathfinder | u | 1987 | | S, SV, SL, Platinum, Rock Creek
Quest | v | 1993 | 2017 | S, SV, SL, Platinum
Rogue | u | 2008 | | S, SV, SL, Platinum, Rock Creek
Rogue Sport | u | 2017 | 2022 | S, SV, SL
Sentra | s | 1982 | | S, SV, SR, SL
Titan | t | 2004 | 2024 | S, SV, PRO-4X, Platinum Reserve, XD
Versa | s | 2007 | | S, SV, SR
Xterra | u | 2000 | 2015 | S, X, Off-Road, PRO-4X
Z | c | 2023 | | Sport, Performance, NISMO`,

  "Polestar": `
Polestar 2 | h | 2021 | | Long Range Single Motor, Long Range Dual Motor, Performance
Polestar 3 | u | 2025 | | Long Range Dual Motor, Performance
Polestar 4 | u | 2025 | | Long Range Single Motor, Long Range Dual Motor`,

  "Pontiac": `
Aztek | u | 2001 | 2005 | Base, GT
Firebird | c | 1967 | 2002 | Base, Formula, Trans Am
G5 | s | 2007 | 2009 | Base, GT
G6 | s | 2005 | 2010 | Base, GT, GTP
G8 | s | 2008 | 2009 | Base, GT, GXP
Grand Am | s | 1973 | 2005 | SE, GT
Grand Prix | s | 1962 | 2008 | Base, GT, GXP
Montana | v | 1999 | 2006 | Base, SV6
Solstice | c | 2006 | 2009 | Base, GXP
Torrent | u | 2006 | 2009 | Base, GXP
Vibe | h | 2003 | 2010 | Base, AWD, GT`,

  "Porsche": `
718 Boxster | c | 1997 | | Base, S, GTS 4.0, Spyder
718 Cayman | c | 2006 | | Base, S, GTS 4.0, GT4
911 | c | 1965 | | Carrera, Carrera S, Carrera 4S, GTS, Targa, Turbo, Turbo S, GT3
Cayenne | u | 2003 | | Base, E-Hybrid, S, GTS, Turbo, Turbo GT
Cayenne Coupe | u | 2020 | | Base, E-Hybrid, S, GTS, Turbo GT
Macan | u | 2015 | | Base, T, S, GTS
Macan Electric | u | 2024 | | Base, 4, 4S, Turbo
Panamera | h | 2010 | | Base, 4, 4 E-Hybrid, GTS, Turbo, Turbo S
Taycan | s | 2020 | | Base, 4, 4S, GTS, Turbo, Turbo S, Cross Turismo`,

  "Ram": `
1500 | t | 2011 | | Tradesman, Big Horn, Laramie, Rebel, Limited, Longhorn, TRX, RHO
2500 | t | 2011 | | Tradesman, Big Horn, Laramie, Power Wagon, Limited
3500 | t | 2011 | | Tradesman, Big Horn, Laramie, Limited
Dakota | t | 1987 | 2011 | ST, SLT, Laramie, TRX4
ProMaster | v | 2014 | | Cargo, Window, Cutaway, EV
ProMaster City | v | 2015 | 2022 | Tradesman, SLT, Wagon`,

  "Rivian": `
R1S | u | 2022 | | Adventure, Dual, Tri, Quad
R1T | t | 2022 | | Adventure, Dual, Tri, Quad
R2 | u | 2026 | | Dual, Launch Edition
R3 | u | 2027 | | Base`,

  "Rolls-Royce": `
Cullinan | u | 2019 | | Base, Black Badge
Dawn | c | 2016 | 2023 | Base, Black Badge
Ghost | s | 2010 | | Base, Extended, Black Badge
Phantom | s | 2004 | | Base, Extended
Spectre | c | 2024 | | Base, Black Badge
Wraith | c | 2014 | 2023 | Base, Black Badge`,

  "Saab": `
9-2X | h | 2005 | 2006 | Linear, Aero
9-3 | s | 1999 | 2011 | Linear, Arc, Aero, 2.0T
9-5 | s | 1999 | 2011 | Linear, Arc, Aero, Turbo4, Turbo6
9-7X | u | 2005 | 2009 | 4.2i, 5.3i, Aero`,

  "Saturn": `
Astra | h | 2008 | 2009 | XE, XR
Aura | s | 2007 | 2009 | XE, XR, Green Line
Ion | s | 2003 | 2007 | 1, 2, 3, Red Line
Outlook | u | 2007 | 2010 | XE, XR
Relay | v | 2005 | 2007 | 1, 2, 3
Sky | c | 2007 | 2009 | Base, Red Line
Vue | u | 2002 | 2010 | Base, XE, XR, Red Line, Green Line`,

  "Scion": `
FR-S | c | 2013 | 2016 | Base, Release Series
iA | s | 2016 | 2016 | Base
iM | h | 2016 | 2016 | Base
iQ | h | 2012 | 2015 | Base
tC | c | 2005 | 2016 | Base, Release Series
xA | h | 2004 | 2006 | Base
xB | h | 2004 | 2015 | Base, Release Series
xD | h | 2008 | 2014 | Base, Release Series`,

  "Scout": `
Terra | t | 2027 | | Base, Harvester
Traveler | u | 2027 | | Base, Harvester`,

  "Slate": `
Truck | t | 2027 | | Base`,

  "Smart": `
Fortwo | h | 2008 | 2019 | Pure, Passion, Prime, Electric Drive`,

  "Subaru": `
Ascent | u | 2019 | | Base, Premium, Onyx Edition, Limited, Touring
Baja | t | 2003 | 2006 | Base, Sport, Turbo
BRZ | c | 2013 | | Premium, Limited, tS
Crosstrek | u | 2013 | | Base, Premium, Sport, Limited, Wilderness, Hybrid
Forester | u | 1998 | | Base, Premium, Sport, Limited, Touring, Wilderness, Hybrid
Impreza | s | 1993 | | Base, Premium, Sport, RS
Legacy | s | 1990 | 2025 | Base, Premium, Sport, Limited, Touring XT
Outback | u | 1995 | | Base, Premium, Limited, Onyx Edition, Touring, Wilderness
Solterra | u | 2023 | | Premium, Limited, Touring
Trailseeker | u | 2026 | | Premium, Limited, Touring
Tribeca | u | 2006 | 2014 | Base, Limited, Touring
Uncharted | u | 2026 | | Premium, Sport, Limited
WRX | s | 2002 | | Base, Premium, Limited, GT, TR, STI`,

  "Suzuki": `
Aerio | s | 2002 | 2007 | S, GS, SX
Forenza | s | 2004 | 2008 | Base, S, LX
Grand Vitara | u | 1999 | 2013 | Base, Premium, Limited
Kizashi | s | 2010 | 2013 | S, SE, GTS, SLS
SX4 | h | 2007 | 2013 | Base, Crossover, Sport, Technology
XL7 | u | 2002 | 2009 | Base, Luxury, Limited`,

  "Tesla": `
Cybertruck | t | 2024 | | Long Range, All-Wheel Drive, Cyberbeast
Model 3 | s | 2017 | | Standard, Rear-Wheel Drive, Long Range, Performance
Model S | s | 2012 | | Long Range, Plaid, 75D, 85, P100D
Model X | u | 2016 | | Long Range, Plaid, 75D, 100D, P100D
Model Y | u | 2020 | | Standard, Rear-Wheel Drive, Long Range, Performance
Roadster | c | 2008 | 2012 | Base, Sport`,

  "Toyota": `
4Runner | u | 1984 | | SR5, TRD Sport, TRD Off-Road, Limited, Platinum, TRD Pro, Trailhunter
86 | c | 2017 | 2020 | Base, GT, Hakone Edition
Avalon | s | 1995 | 2022 | XLE, XSE, Touring, Limited, Hybrid
bZ | u | 2026 | | XLE, Limited, Woodland
bZ Woodland | u | 2026 | | Premium
bZ4X | u | 2023 | 2025 | XLE, Limited
C-HR | u | 2018 | | LE, XLE, Limited, SE, XSE
Camry | s | 1983 | | LE, SE, XLE, XSE, TRD, Nightshade, Hybrid
Celica | c | 1971 | 2005 | GT, GT-S
Corolla | s | 1968 | | L, LE, SE, XSE, XLE, Hybrid
Corolla Cross | u | 2022 | | L, LE, S, XLE, Hybrid
Corolla Hatchback | h | 2019 | | SE, XSE, Nightshade
Crown | s | 2023 | | XLE, Limited, Platinum, Nightshade
Crown Signia | u | 2025 | | XLE, Limited
Echo | s | 2000 | 2005 | Base
FJ Cruiser | u | 2007 | 2014 | Base, Trail Teams
GR Corolla | h | 2023 | | Core, Premium, Circuit Edition, MORIZO Edition
GR Supra | c | 2020 | 2026 | 2.0, 3.0, 3.0 Premium, A91, MkV Final Edition
GR86 | c | 2022 | | Base, Premium, Hakone Edition
Grand Highlander | u | 2024 | | XLE, Limited, Platinum, Hybrid MAX
Highlander | u | 2001 | | LE, XLE, XSE, Limited, Platinum, Hybrid
Land Cruiser | u | 1958 | | 1958, Land Cruiser, First Edition
Matrix | h | 2003 | 2013 | Base, S, XR, XRS
Mirai | s | 2016 | | XLE, Limited
MR2 Spyder | c | 2000 | 2005 | Base
Prius | h | 2001 | | LE, XLE, Limited, Nightshade
Prius Prime | h | 2017 | | SE, XSE, XSE Premium
Prius v | h | 2012 | 2017 | Two, Three, Four, Five
RAV4 | u | 1996 | | LE, XLE, XLE Premium, Adventure, TRD Off-Road, Limited, Woodland, Hybrid, Prime
Sequoia | u | 2001 | | SR5, Limited, Platinum, TRD Pro, Capstone, 1794 Edition
Sienna | v | 1998 | | LE, XLE, XSE, Woodland, Limited, Platinum
Solara | c | 1999 | 2008 | SE, SLE, Sport
Tacoma | t | 1995 | | SR, SR5, TRD Sport, TRD Off-Road, Limited, Trailhunter, TRD Pro
Tundra | t | 2000 | | SR, SR5, Limited, Platinum, 1794 Edition, TRD Pro, Capstone
Venza | u | 2009 | 2024 | LE, XLE, Limited, Nightshade
Yaris | h | 2007 | 2020 | L, LE, XLE, SE`,

  "VinFast": `
VF 8 | u | 2023 | | Eco, Plus
VF 9 | u | 2024 | | Eco, Plus`,

  "Volkswagen": `
Arteon | s | 2019 | 2023 | SE, SEL, SEL R-Line, SEL Premium R-Line
Atlas | u | 2018 | | SE, SE with Technology, Peak Edition, SEL, SEL Premium R-Line
Atlas Cross Sport | u | 2020 | | SE, SE with Technology, SEL, SEL R-Line, SEL Premium R-Line
Beetle | h | 1998 | 2019 | S, SE, SEL, Turbo, Dune, Convertible
CC | s | 2009 | 2017 | Sport, R-Line, Executive, VR6
e-Golf | h | 2015 | 2019 | SE, SEL Premium
Eos | c | 2007 | 2016 | Komfort, Lux, Executive
Golf | h | 1985 | 2021 | S, SE, TSI, TDI, Alltrack, SportWagen
Golf GTI | h | 1985 | | S, SE, Autobahn, 380
Golf R | h | 2012 | | Base, 20th Anniversary
ID. Buzz | v | 2025 | | Pro S, Pro S Plus, 1st Edition
ID.4 | u | 2021 | | Standard, Pro, Pro S, Pro S Plus
Jetta | s | 1980 | | S, Sport, SE, SEL, GLI, TDI
Passat | s | 1990 | 2022 | S, SE, R-Line, SEL, TDI
Routan | v | 2009 | 2014 | S, SE, SEL
Taos | u | 2022 | | S, SE, SEL
Tiguan | u | 2009 | | S, SE, SE R-Line, SEL R-Line
Touareg | u | 2004 | 2017 | Sport, Lux, Executive, TDI, Hybrid`,

  "Volvo": `
C30 | h | 2008 | 2013 | T5, R-Design
C40 Recharge | u | 2022 | 2024 | Core, Plus, Ultimate
C70 | c | 1998 | 2013 | T5
ES90 | s | 2026 | | Plus, Ultra
EX30 | u | 2025 | | Core, Plus, Ultra, Cross Country
EX40 | u | 2025 | | Core, Plus, Ultra
EX90 | u | 2025 | | Plus, Ultra
S40 | s | 2000 | 2011 | 2.4i, T5
S60 | s | 2001 | 2025 | Core, Plus, Ultimate, T5, T6, T8, Polestar
S80 | s | 1999 | 2016 | 3.2, T6
S90 | s | 2017 | 2025 | Core, Plus, Ultimate, T8
V50 | h | 2005 | 2011 | 2.4i, T5
V60 | h | 2015 | 2025 | Core, Plus, Ultimate, Cross Country, Polestar
V70 | h | 1998 | 2010 | 2.4, 3.2, T5, XC
V90 | h | 2017 | 2025 | Cross Country, Ultimate
XC40 | u | 2019 | | Core, Plus, Ultimate
XC60 | u | 2010 | | Core, Plus, Ultimate, T8 Polestar Engineered
XC70 | u | 2001 | 2016 | 3.2, T6
XC90 | u | 2003 | | Core, Plus, Ultimate, T8`,
};
