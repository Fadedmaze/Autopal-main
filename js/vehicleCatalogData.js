// The vehicle catalog: every brand, make and model (trim) a car can be saved as.
// Add/Edit Vehicle only offers these, and the database checks new cars against the same
// list (supabase/migrations/20261111_vehicle_catalog.sql is generated from this file by
// scripts/build-vehicle-catalog-sql.mjs, so edit here and re-run the script).
//
// One line per make:  Make | body | first model year | last model year | trims
//   body: s = sedan, h = hatchback / wagon, c = coupe / convertible / sports car,
//         u = SUV / crossover, t = pickup truck, v = van / minivan
//   last model year is blank while the make is still sold (2027 models on sale now).
//   A name that took a break lists its runs in the first-year column, e.g. Bronco
//   "1990-1996, 2021" (the last run ends at the last-year column, or today).
//   trims are the common US trim levels across the years, not every package. A trim
//   can list the model years it was offered, e.g. "Hybrid [2003-2015, 2025-]" (open
//   end = still sold); Add/Edit Vehicle then offers it only for those years. Trims
//   without years are offered for every year (most models; popular ones have years).
// US-market cars sold new from 1990 on, including brands that have since closed
// (start years go back further for long-running names). Last reviewed November 2026.

export const CATALOG_DATA = {
  "Acura": `
ADX | u | 2025 | | Base, A-Spec, A-Spec Advance
CL | c | 1997 | 2003 | 2.2, 2.3, 3.0, Type-S
ILX | s | 2013 | 2022 | Base, Premium, Technology, A-Spec
Integra | h | 1990-2001, 2023 |  | Base [2023-], A-Spec [2023-], A-Spec Technology [2023-], Type S [2024-], RS [1990-1999], LS [1990-2001], GS [1990-2001], GS-R [1992-2001], Type R [1997-2001]
Legend | s | 1986 | 1995 | L, LS, GS
MDX | u | 2001 | | Base, Technology, A-Spec, Advance, Type S
NSX | c | 1991-2005, 2017 | 2022 | Base, Type S
RDX | u | 2007 | | Base, Technology, A-Spec, Advance
RL | s | 1996 | 2012 | Base, Technology
RLX | s | 2014 | 2020 | Base, Technology, Advance, Sport Hybrid
RSX | c | 2002 | 2006 | Base, Type-S
SLX | u | 1996 | 1999 | Base
TL | s | 1996 | 2014 | Base, Technology, Type-S, SH-AWD
TLX | s | 2015 | | Base, Technology, A-Spec, Advance, Type S
TSX | s | 2004 | 2014 | Base, Technology, Sport Wagon, V6
Vigor | s | 1992 | 1994 | GS, LS
ZDX | u | 2010 | | Base, A-Spec, Type S`,

  "Alfa Romeo": `
164 | s | 1991 | 1995 | L, S, LS
4C | c | 2015 | 2020 | Coupe, Spider
Giulia | s | 2017 | | Sprint, Ti, Veloce, Quadrifoglio
Spider | c | 1966 | 1994 | Base, Veloce, Graduate
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
100 | s | 1989 | 1994 | Base, CS, Quattro
80 | s | 1988 | 1992 | Base, Quattro
90 | s | 1988 | 1995 | CS, CS Quattro Sport
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
Cabriolet | c | 1994 | 1998 | Base
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
TT | c | 2000 | 2023 | Base, S, RS
V8 | s | 1990 | 1994 | Quattro`,

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
8 Series | c | 1991-1997, 2019 | 2025 | 840i [2019-], M850i [2019-], Gran Coupe [2020-], 850i [1991-1995], 850Ci [1996-1997], 840Ci [1994-1997], 850CSi [1994-1995]
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
Z3 | c | 1996 | 2002 | 1.9, 2.3, 2.8, 3.0i, M Roadster, M Coupe
Z4 | c | 2003 | | sDrive30i, M40i`,

  "Buick": `
Cascada | c | 2016 | 2019 | 1SV, Premium, Sport Touring
Century | s | 1973 | 2005 | Custom, Special, Limited
Enclave | u | 2008 | | Preferred, Essence, Sport Touring, Avenir
Encore | u | 2013 | 2022 | Preferred, Essence, Sport Touring
Encore GX | u | 2020 | | Preferred, Sport Touring, Avenir
Envision | u | 2016 | | Preferred, Sport Touring, Avenir
Envista | u | 2024 | | Preferred, Sport Touring, Avenir
LaCrosse | s | 2005 | 2019 | Base, Preferred, Essence, Premium
LeSabre | s | 1959 | 2005 | Custom, Limited
Lucerne | s | 2006 | 2011 | CX, CXL, Super
Park Avenue | s | 1991 | 2005 | Base, Ultra
Rainier | u | 2004 | 2007 | CXL
Reatta | c | 1988 | 1991 | Base, Convertible
Regal | s | 1973 | 2020 | Preferred, Essence, Sportback, TourX, GS
Rendezvous | u | 2002 | 2007 | CX, CXL, Ultra
Riviera | c | 1963 | 1999 | Base, Supercharged
Roadmaster | s | 1991 | 1996 | Base, Limited, Estate Wagon
Skylark | s | 1975 | 1998 | Custom, Limited, Gran Sport
Terraza | v | 2005 | 2007 | CX, CXL
Verano | s | 2012 | 2017 | Base, Convenience, Leather, Sport Touring`,

  "Cadillac": `
Allanté | c | 1987 | 1993 | Base
ATS | s | 2013 | 2019 | Base, Luxury, Premium Luxury, V
Brougham | s | 1987 | 1992 | Base
Catera | s | 1997 | 2001 | Base, Sport
CT4 | s | 2020 | 2025 | Luxury, Premium Luxury, Sport, V-Series, Blackwing
CT5 | s | 2020 | | Luxury, Premium Luxury, Sport, V-Series, Blackwing
CT6 | s | 2016 | 2020 | Luxury, Premium Luxury, Platinum, Sport, V-Series
CTS | s | 2003 | 2019 | Base, Luxury, Premium, V-Sport, V
DeVille | s | 1959 | 2005 | Base, DHS, DTS, Concours
DTS | s | 2006 | 2011 | Base, Luxury, Premium, Platinum
Eldorado | c | 1967 | 2002 | Base, ETC, ESC, Touring Coupe
ELR | c | 2014 | 2016 | Base, Sport
Escalade | u | 1999 | | Luxury, Premium Luxury, Sport, Platinum, V-Series
Escalade ESV | u | 2003 | | Luxury, Premium Luxury, Sport, Platinum, V-Series
Escalade IQ | u | 2025 | | Luxury, Sport, Premium Luxury, Sport Platinum
Fleetwood | s | 1985 | 1996 | Base, Brougham
Lyriq | u | 2023 | | Tech, Luxury, Sport, V
Optiq | u | 2025 | | Luxury, Sport, V
Seville | s | 1976 | 2004 | SLS, STS
SRX | u | 2004 | 2016 | Base, Luxury, Performance, Premium
STS | s | 2005 | 2011 | V6, V8, V
Vistiq | u | 2026 | | Luxury, Sport, Platinum
XLR | c | 2004 | 2009 | Base, V
XT4 | u | 2019 | 2025 | Luxury, Premium Luxury, Sport
XT5 | u | 2017 | 2025 | Luxury, Premium Luxury, Sport
XT6 | u | 2020 | 2025 | Luxury, Premium Luxury, Sport
XTS | s | 2013 | 2019 | Base, Luxury, Premium Luxury, Platinum`,

  "Chevrolet": `
Astro | v | 1985 | 2005 | Base, LS, LT
Avalanche | t | 2002 | 2013 | LS, LT, LTZ, Z71
Aveo | s | 2004 | 2011 | LS, LT, Special Value
Beretta | c | 1987 | 1996 | Base, GT, GTZ, Z26
Blazer | u | 1995-2005, 2019 |  | 2LT [2019-], 3LT [2019-], RS [2019-], Premier [2019-], LS [1995-2005], LT [1995-2005], Xtreme [2001-2005], TrailBlazer [1999-2001]
Blazer EV | u | 2024 | | LT, RS, SS
Bolt | h | 2017 | | LT, Premier, 1LT, 2LT
Bolt EUV | u | 2022 | 2023 | LT, Premier
C/K 1500 | t | 1988 | 1999 | Cheyenne, Scottsdale, Silverado, WT
C/K 2500 | t | 1988 | 2000 | Cheyenne, Scottsdale, Silverado
Camaro | c | 1967 | 2024 | LS, LT, SS, ZL1 [2012-2015, 2017-2024]
Caprice | s | 1965 | 1996 | Base, Classic, LS
Captiva Sport | u | 2012 | 2015 | LS, LT, LTZ
Cavalier | s | 1982 | 2005 | VL, RS, LS, Z24
Cobalt | s | 2005 | 2010 | LS, LT, SS
Colorado | t | 2004 | | WT, LT, Trail Boss [2023-], Z71, ZR2 [2017-]
Corsica | s | 1987 | 1996 | LT
Corvette | c | 1953 | | Stingray, Grand Sport, Z06, E-Ray, ZR1
Cruze | s | 2011 | 2019 | L, LS, LT, Premier, Diesel
Equinox | u | 2005 | | LS, LT, RS [2022-], Premier [2016-], ACTIV [2025-]
Equinox EV | u | 2024 | | LT, RS
Express | v | 1996 | | Cargo, Passenger, LS, LT
HHR | h | 2006 | 2011 | LS, LT, SS
Impala | s | 1994-1996, 2000 | 2020 | LS, LT, LTZ, Premier [2016-2020], SS [1994-1996, 2004-2009]
Lumina | s | 1990 | 2001 | Base, Euro, LS, LTZ, Z34
Lumina APV | v | 1990 | 1996 | Base, CL, LS
Malibu | s | 1997 | 2025 | LS, RS [2019-2025], LT, Premier [2016-2022], 2LT
Malibu Maxx | h | 2004 | 2007 | LS, LT, SS
Metro | h | 1998 | 2001 | Base, LSi
Monte Carlo | c | 1970 | 2007 | LS, Z34, SS
Prizm | s | 1998 | 2002 | Base, LSi
S-10 | t | 1982 | 2004 | Base, LS, ZR2, Xtreme
Silverado 1500 | t | 1999 | | WT, Custom [2016-], LT, RST [2019-], LTZ, Trail Boss [2019-], ZR2 [2022-], High Country [2014-]
Silverado 2500HD | t | 2001 | | WT, Custom, LT, LTZ, ZR2, High Country
Silverado 3500HD | t | 2001 | | WT, LT, LTZ, High Country
Silverado EV | t | 2024 | | WT, LT, RST, Trail Boss
Sonic | s | 2012 | 2020 | LS, LT, Premier, RS
Spark | h | 2013 | 2022 | LS, 1LT, 2LT, ACTIV
SS | s | 2014 | 2017 | Base
SSR | t | 2003 | 2006 | Base
Suburban | u | 1935 | | LS, LT, RST, Z71, Premier, High Country
Tahoe | u | 1995 | | LS, LT, RST [2019-], Z71, Premier [2016-], High Country [2018-]
Tracker | u | 1999 | 2004 | Base, LT, ZR2
Trailblazer | u | 2002-2009, 2021 |  | LS, LT, ACTIV [2021-], RS [2021-], EXT [2002-2006], SS [2006-2009]
Traverse | u | 2009 | | LS, LT, Z71 [2024-], RS [2018-], Premier [2014-], High Country [2018-]
Trax | u | 2015 | | LS, 1RS [2024-], LT, 2RS [2024-], ACTIV [2024-]
Uplander | v | 2005 | 2008 | LS, LT
Venture | v | 1997 | 2005 | Base, LS, LT, Warner Bros. Edition
Volt | h | 2011 | 2019 | Base, LT, Premier`,

  "Chrysler": `
200 | s | 2011 | 2017 | LX, Limited, S, C
300 | s | 1999 | 2023 | Touring, Limited, S, C, 300C
300M | s | 1999 | 2004 | Base, Special
Aspen | u | 2007 | 2009 | Limited
Cirrus | s | 1995 | 2000 | LX, LXi
Concorde | s | 1993 | 2004 | LX, LXi, Limited
Crossfire | c | 2004 | 2008 | Base, Limited, SRT-6
Imperial | s | 1990 | 1993 | Base
LeBaron | c | 1982 | 1995 | Base, GTC, LX, Landau
LHS | s | 1994 | 2001 | Base
New Yorker | s | 1983 | 1996 | Salon, Fifth Avenue
Pacifica | v | 2004-2008, 2017 | | Base [2004-2008], Touring, Touring L [2017-], Limited, Pinnacle [2020-], Hybrid [2017-]
Prowler | c | 2001 | 2002 | Base
PT Cruiser | h | 2001 | 2010 | Base, Touring, Limited, GT
Sebring | s | 1995 | 2010 | LX, Touring, Limited, JX [1996-2000], JXi [1996-2000], LXi [1995-2000]
Town & Country | v | 1990 | 2016 | Touring, Touring-L, Limited
Voyager | v | 2020 | | LX`,

  "Daewoo": `
Lanos | h | 1999 | 2002 | S, SE, SX
Leganza | s | 1999 | 2002 | SE, SX, CDX
Nubira | s | 1999 | 2002 | SE, SX, CDX`,

  "Dodge": `
Avenger | s | 1995-2000, 2008 | 2014 | SE [2008-2014], SXT [2008-2014], R/T [2008-2014], Base [1995-2000], ES [1995-2000]
Caliber | h | 2007 | 2012 | SE, SXT, R/T, SRT4
Caravan | v | 1984 | 2007 | Base, SE, LE, ES, SXT
Challenger | c | 2008 | 2023 | SXT, GT, R/T, Scat Pack [2015-2023], SRT Hellcat [2015-2023], SRT Demon [2018, 2023]
Charger | s | 2006 | | SXT, GT, R/T, Scat Pack [2015-2023, 2025-], SRT Hellcat [2015-2023], Daytona, Sixpack [2025-]
Colt | h | 1979 | 1994 | Base, GL
Dakota | t | 1987 | 2010 | Base, ST, SXT, SLT, Sport, R/T, Laramie, TRX4
Dart | s | 2013 | 2016 | SE, SXT, Limited, GT
Daytona | c | 1984 | 1993 | Base, ES, IROC, Shelby
Durango | u | 1998-2009, 2011 |  | SXT, GT, R/T, Citadel [2011-], SRT 392 [2018-], SRT Hellcat [2021, 2023-], SLT [1998-2009]
Dynasty | s | 1988 | 1993 | Base, LE
Grand Caravan | v | 1987 | 2020 | SE, SXT, GT
Hornet | u | 2023 | | GT, R/T
Intrepid | s | 1993 | 2004 | Base, ES, R/T, SXT
Journey | u | 2009 | 2020 | SE, SXT, Crossroad, GT
Magnum | h | 2005 | 2008 | SE, SXT, R/T, SRT8
Neon | s | 1995 | 2005 | SE, SXT, SRT-4
Nitro | u | 2007 | 2011 | SE, SXT, R/T, Heat
Ram 1500 | t | 1994 | 2010 | ST, SLT, Laramie, Sport, TRX4, SRT-10
Ram 2500 | t | 1994 | 2010 | ST, SLT, Laramie, Power Wagon
Ram 3500 | t | 1994 | 2010 | ST, SLT, Laramie
Ram Van | v | 1971 | 2003 | 1500, 2500, 3500
Ramcharger | u | 1974 | 1993 | Base, LE
Shadow | h | 1987 | 1994 | Base, ES, America
Spirit | s | 1989 | 1995 | Base, LE, ES, R/T
Sprinter | v | 2003 | 2009 | 2500, 3500
Stealth | c | 1991 | 1996 | Base, ES, R/T, R/T Turbo
Stratus | s | 1995 | 2006 | Base, SE, ES, SXT, R/T
Viper | c | 1992 | 2017 | SRT-10, GTS, ACR`,

  "Eagle": `
Premier | s | 1988 | 1992 | LX, ES
Summit | s | 1989 | 1996 | DL, LX, ES
Talon | c | 1990 | 1998 | Base, ESi, TSi, TSi AWD
Vision | s | 1993 | 1997 | ESi, TSi`,

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
Aerostar | v | 1986 | 1997 | XL, XLT, Eddie Bauer
Aspire | h | 1994 | 1997 | Base, SE
Bronco | u | 1990-1996, 2021 | | Base [2021-], Big Bend [2021-], Black Diamond [2021-], Outer Banks [2021-], Badlands [2021-], Wildtrak [2021-], Raptor [2022-], XL [1990-1996], XLT [1990-1996], Eddie Bauer [1990-1996]
Bronco II | u | 1984 | 1990 | XL, XLT, Eddie Bauer
Bronco Sport | u | 2021 | | Big Bend, Outer Banks, Badlands
C-Max | h | 2013 | 2018 | SE, SEL, Titanium, Energi
Contour | s | 1995 | 2000 | GL, LX, SE, SVT
Crown Victoria | s | 1992 | 2011 | Standard, LX, Police Interceptor
E-Series | v | 1992 | | Cargo, Passenger, Cutaway
EcoSport | u | 2018 | 2022 | S, SE, SES, Titanium
Edge | u | 2007 | 2024 | SE, SEL, ST-Line [2021-2024], Titanium, ST [2019-2023]
Escape | u | 2001 | | S, Active [2023-], SE, ST-Line [2023-], SEL, Platinum [2023-], Hybrid [2005-2012, 2020-]
Escort | s | 1981 | 2003 | Base, LX, SE, GT, ZX2
Excursion | u | 2000 | 2005 | XLS, XLT, Eddie Bauer, Limited
Expedition | u | 1997 | | XL, XLT, Active, Tremor, Limited, King Ranch, Platinum
Explorer | u | 1991 | | Base, Active [2025-], XLT, ST-Line [2025-], Limited, Timberline [2021-], ST [2020-], Platinum [2016-]
Explorer Sport | u | 2001 | 2003 | Value, Choice, Premium
Explorer Sport Trac | t | 2001 | 2010 | XLS, XLT, Adrenalin, Limited
F-150 | t | 1975 | | XL, STX, XLT, Lariat, Tremor [2021-], King Ranch [2001-], Platinum [2009-], Limited [2013-], Raptor [2010-2014, 2017-]
F-150 Lightning | t | 2022 | | Pro, XLT, Flash, Lariat, Platinum
F-250 | t | 1953 | 1999 | XL, XLT, Lariat
F-250 Super Duty | t | 1999 | | XL, XLT, Lariat, King Ranch, Platinum, Limited, Tremor
F-350 | t | 1953 | 1997 | XL, XLT, Lariat
F-350 Super Duty | t | 1999 | | XL, XLT, Lariat, King Ranch, Platinum, Limited
F-450 Super Duty | t | 1999 | | XL, XLT, Lariat, King Ranch, Platinum, Limited
Festiva | h | 1988 | 1993 | L, LX
Fiesta | h | 2011 | 2019 | S, SE, Titanium, ST
Five Hundred | s | 2005 | 2007 | SE, SEL, Limited
Flex | u | 2009 | 2019 | SE, SEL, Limited
Focus | s | 2000 | 2018 | S, SE, SEL, Titanium [2012-2018], ST [2013-2018], RS [2016-2018], Electric [2012-2018]
Freestar | v | 2004 | 2007 | S, SE, SES, SEL, Limited
Freestyle | u | 2005 | 2007 | SE, SEL, Limited
Fusion | s | 2006 | 2020 | S, SE, SEL, Titanium [2013-2020], Sport [2010-2012, 2017-2019], Hybrid [2010-2020], Energi [2013-2020]
GT | c | 2005 | 2022 | Base, Carbon Series, Heritage Edition
Maverick | t | 2022 | | XL, XLT, Lariat, Tremor, Lobo
Mustang | c | 1965 | | EcoBoost [2015-], GT, Dark Horse [2024-], Mach 1 [1969-1978, 2003-2004, 2021-2023], Shelby GT500 [2007-2014, 2020-2022]
Mustang Mach-E | u | 2021 | | Select, Premium, California Route 1, GT, Rally
Probe | c | 1989 | 1997 | Base, LX, GT, SE
Ranger | t | 1983-2011, 2019 |  | XL, XLT, Lariat [2019-], Raptor [2024-], Sport [1993-2011], Edge [1999-2003], FX4 [2002-2011]
Taurus | s | 1986 | 2019 | SE, SEL, Limited, SHO
Taurus X | u | 2008 | 2009 | SEL, Eddie Bauer, Limited
Tempo | s | 1984 | 1994 | GL, GLS, LX
Thunderbird | c | 1955-1997, 2002 | 2005 | Base, LX, Super Coupe [1989-1995], Sport [1990-1997], Deluxe [2002-2005], Premium [2002-2005]
Transit | v | 2015 | | Cargo, Crew, Passenger, Trail
Transit Connect | v | 2010 | 2023 | XL, XLT, Titanium
Windstar | v | 1995 | 2003 | Base, GL, LX, SE, SEL, Limited`,

  "Genesis": `
G70 | s | 2019 | | 2.5T, 3.3T, Sport Prestige
G80 | s | 2017 | | 2.5T, 3.5T, Sport Prestige, Electrified
G90 | s | 2017 | | 3.5T, 3.5T E-Supercharger
GV60 | u | 2023 | | Standard, Advanced, Performance
GV70 | u | 2022 | | 2.5T, 3.5T, Sport Prestige, Electrified
GV80 | u | 2021 | | 2.5T, 3.5T, Prestige
GV80 Coupe | u | 2025 | | 3.5T, 3.5T E-Supercharger`,

  "Geo": `
Metro | h | 1989 | 1997 | Base, XFi, LSi
Prizm | s | 1989 | 1997 | Base, LSi, GSi
Storm | c | 1990 | 1993 | Base, GSi
Tracker | u | 1989 | 1998 | Base, LSi`,

  "GMC": `
Acadia | u | 2007 | | SLE, SLT, AT4, Denali
Canyon | t | 2004 | | Elevation, AT4, AT4X, Denali
Envoy | u | 1998 | 2009 | SLE, SLT, Denali
Hummer EV | t | 2022 | | 2X, 3X, Edition 1
Hummer EV SUV | u | 2024 | | 2X, 3X, Edition 1
Jimmy | u | 1970 | 2005 | SL, SLS, SLE, SLT
Safari | v | 1985 | 2005 | SL, SLE, SLT
Savana | v | 1996 | | Cargo, Passenger, LS, LT
Sierra 1500 | t | 1999 | | Pro [2019-], SLE, Elevation [2016-], SLT, AT4 [2019-], AT4X [2022-], Denali [2002-]
Sierra 2500HD | t | 2001 | | Pro, SLE, SLT, AT4, Denali
Sierra 3500HD | t | 2001 | | Pro, SLE, SLT, AT4, Denali
Sierra C/K 1500 | t | 1988 | 1999 | SL, SLE, SLT
Sierra C/K 2500 | t | 1988 | 2000 | SL, SLE, SLT
Sierra EV | t | 2025 | | Elevation, AT4, Denali
Sonoma | t | 1991 | 2004 | SL, SLS, SLE, Highrider
Suburban | u | 1937 | 1999 | SL, SLE, SLT
Syclone | t | 1991 | 1991 | Base
Terrain | u | 2010 | | SLE, SLT, AT4, Elevation, Denali
Typhoon | u | 1992 | 1993 | Base
Yukon | u | 1992 | | SLE, SLT, AT4, Denali, Denali Ultimate
Yukon XL | u | 2000 | | SLE, SLT, AT4, Denali, Denali Ultimate`,

  "Honda": `
Accord | s | 1976 | | LX, Sport [2013-], SE, EX, EX-L, Touring, Hybrid [2005-2007, 2014-2015, 2017-]
Civic | s | 1973 | | LX [1986-], Sport [2017-], EX [1992-], EX-L [2006-2021], Touring [2016-], Si [1985-1991, 1999-2000, 2002-2015, 2017-2020, 2022-], Hybrid [2003-2015, 2025-]
Civic Hatchback | h | 2017 | | LX, Sport, EX-L, Sport Touring, Hybrid
Civic Type R | h | 2017 | | Base
Clarity | s | 2017 | 2021 | Plug-In Hybrid, Touring, Fuel Cell
CR-V | u | 1997 | | LX, EX, EX-L [2005-], Sport [2023-], Sport-L [2023-], Touring, TrailSport [2026-], Hybrid [2020-]
CR-Z | h | 2011 | 2016 | Base, EX
Crosstour | h | 2010 | 2015 | EX, EX-L
del Sol | c | 1993 | 1997 | S, Si, VTEC
Element | u | 2003 | 2011 | LX, EX, SC
Fit | h | 2007 | 2020 | LX, Sport, EX, EX-L
HR-V | u | 2016 | | LX, Sport [2019-], EX-L
Insight | s | 2000-2006, 2010-2014, 2019 | 2022 | Base, EX, Touring
Odyssey | v | 1995 | | LX, EX, EX-L, Sport [2021-], Touring [2005-], Elite [2018-]
Passport | u | 1994-2002, 2019 |  | EX-L [2000-2002, 2019-], TrailSport [2022-], Black Edition [2022-], LX [1994-2002], EX [1994-2002]
Pilot | u | 2003 | | LX, Sport [2023-], EX-L, Touring, TrailSport [2022-], Elite [2016-], Black Edition [2019-]
Prelude | c | 1990-2001, 2026 |  | Base, S [1992-1996], Si [1990-2001], SH [1997-2001], Type SH [1997-2001]
Prologue | u | 2024 | | EX, Touring, Elite
Ridgeline | t | 2006 | | Sport [2017-], RTL, TrailSport [2024-], Black Edition [2017-]
S2000 | c | 2000 | 2009 | Base, CR`,

  "Hummer": `
H1 | u | 1992 | 2006 | Base, Alpha
H2 | u | 2003 | 2009 | Base, SUT, Luxury
H3 | u | 2006 | 2010 | Base, Adventure, Luxury, Alpha
H3T | t | 2009 | 2010 | Base, Adventure, Luxury, Alpha`,

  "Hyundai": `
Accent | s | 1995 | 2022 | SE, SEL, Limited
Azera | s | 2006 | 2017 | Base, Limited
Elantra | s | 1991 | | SE, SEL [2017-], Limited [2007-], N Line [2021-], N [2022-], Hybrid [2021-]
Elantra GT | h | 2001 | 2020 | Base, Sport, N Line
Entourage | v | 2007 | 2009 | GLS, SE, Limited
Equus | s | 2011 | 2016 | Signature, Ultimate
Excel | h | 1986 | 1994 | Base, GL, GLS
Genesis | s | 2009 | 2016 | 3.8, 5.0
Genesis Coupe | c | 2010 | 2016 | 2.0T, 3.8, R-Spec, Ultimate
Ioniq | h | 2017 | 2022 | Blue, SE, SEL, Limited, Electric, Plug-In Hybrid
Ioniq 5 | u | 2022 | | SE, SEL, Limited, XRT, N
Ioniq 6 | s | 2023 | | SE, SEL, Limited, N
Ioniq 9 | u | 2026 | | S, SE, SEL, Performance Calligraphy
Kona | u | 2018 | | SE, SEL, N Line [2022-], Limited
Kona Electric | u | 2019 | | SE, SEL, Limited
Nexo | u | 2019 | | Blue, Limited
Palisade | u | 2020 | | SE, SEL, XRT [2023-], Limited, Calligraphy [2021-]
Santa Cruz | t | 2022 | | SE, SEL, XRT, Limited
Santa Fe | u | 2001 | | SE, SEL, XRT [2022-], Limited, Calligraphy [2021-], Hybrid [2021-]
Scoupe | c | 1991 | 1995 | Base, LS, Turbo
Sonata | s | 1989 | | SE, SEL [2018-], N Line [2021-], Limited, Hybrid [2011-]
Tiburon | c | 1997 | 2008 | GS, GT, SE
Tucson | u | 2005 | | SE, SEL [2016-], XRT [2022-], N Line [2022-], Limited, Hybrid [2022-], Plug-In Hybrid [2022-]
Veloster | h | 2012 | 2022 | Base, Turbo, N
Venue | u | 2020 | | SE, SEL, Limited
Veracruz | u | 2007 | 2012 | GLS, SE, Limited
XG300 | s | 2001 | 2001 | Base, L
XG350 | s | 2002 | 2005 | Base, L`,

  "Infiniti": `
EX35 | u | 2008 | 2012 | Base, Journey
FX35 | u | 2003 | 2012 | Base, Sport
FX45 | u | 2003 | 2008 | Base, Sport
G20 | s | 1991 | 2002 | Base, Touring
G25 | s | 2011 | 2012 | Base, Journey, x
G35 | s | 2003 | 2008 | Base, Journey, Sport, x
G37 | s | 2008 | 2013 | Base, Journey, Sport, x
I30 | s | 1996 | 2001 | Base, Touring
I35 | s | 2002 | 2004 | Base
J30 | s | 1993 | 1997 | Base, Touring
JX35 | u | 2013 | 2013 | Base
M30 | c | 1990 | 1992 | Base, Convertible
M35 | s | 2006 | 2010 | Base, Sport, x
M37 | s | 2011 | 2013 | Base, x
M45 | s | 2003 | 2010 | Base, Sport, x
M56 | s | 2011 | 2013 | Base, Sport, x
Q45 | s | 1990 | 2006 | Base, Touring
Q50 | s | 2014 | 2024 | Pure, Luxe, Sport, Red Sport 400
Q60 | c | 2017 | 2022 | Pure, Luxe, Red Sport 400
Q70 | s | 2014 | 2019 | 3.7, 5.6, Hybrid
QX30 | u | 2017 | 2019 | Base, Luxury, Sport
QX4 | u | 1997 | 2003 | Base
QX50 | u | 2014 | 2025 | Pure, Luxe, Sport, Autograph
QX55 | u | 2022 | 2025 | Luxe, Essential, Sensory
QX56 | u | 2004 | 2013 | Base
QX60 | u | 2014 | | Pure, Luxe, Sensory, Autograph
QX70 | u | 2014 | 2017 | Base, Sport
QX80 | u | 2014 | | Pure, Luxe, Sensory, Autograph`,

  "Isuzu": `
Amigo | u | 1989 | 2000 | S, XS
Ascender | u | 2003 | 2008 | S, LS, Limited
Axiom | u | 2002 | 2004 | Base, XS
Hombre | t | 1996 | 2000 | S, XS
i-Series | t | 2006 | 2008 | i-280, i-290, i-350, i-370
Impulse | c | 1983 | 1992 | XS, RS
Oasis | v | 1996 | 1999 | S, LS
Pickup | t | 1981 | 1995 | S, LS
Rodeo | u | 1991 | 2004 | S, LS
Rodeo Sport | u | 2001 | 2003 | S
Stylus | s | 1991 | 1993 | S, XS, RS
Trooper | u | 1984 | 2002 | S, LS, Limited
VehiCROSS | u | 1999 | 2001 | Base`,

  "Jaguar": `
E-Pace | u | 2018 | 2024 | S, SE, R-Dynamic
F-Pace | u | 2017 | | Prestige, R-Dynamic, SVR
F-Type | c | 2014 | 2024 | Base, R-Dynamic, R, 75
I-Pace | u | 2019 | 2024 | S, SE, HSE
S-Type | s | 2000 | 2008 | 3.0, 4.2, R
X-Type | s | 2002 | 2008 | 2.5, 3.0, Sport, Wagon
XE | s | 2017 | 2020 | Base, Premium, Prestige, R-Sport
XF | s | 2009 | 2024 | Premium, Prestige, R-Dynamic, R
XJ | s | 1986 | 2019 | Base, L, R-Sport, Supercharged
XJS | c | 1976 | 1996 | Coupe, Convertible
XK | c | 1997 | 2015 | Base, Portfolio, R, R-S`,

  "Jeep": `
Cherokee | u | 1990-2001, 2014 |  | Latitude [2014-], Limited, Trailhawk [2014-], Overland [2016-], Base, SE [1990-2001], Sport [1990-2001], Classic [1996-2001], Country [1993-1997]
Comanche | t | 1986 | 1992 | Base, Pioneer, Eliminator
Commander | u | 2006 | 2010 | Sport, Limited, Overland
Compass | u | 2007 | | Sport, Latitude, Limited, Trailhawk [2017-]
Gladiator | t | 2020 | | Sport, Willys [2021-], Rubicon, Mojave
Grand Cherokee | u | 1993 | | Laredo, Altitude [2012-], Limited, Trailhawk [2014-], Overland [2002-], Summit [2014-], 4xe [2022-], SRT [2006-2010, 2012-2021], Trackhawk [2018-2021]
Grand Cherokee L | u | 2021 | | Laredo, Altitude, Limited, Overland, Summit
Grand Wagoneer | u | 1990-1991, 2022 |  | Series I [2022-], Series II [2022-], Series III [2022-], Obsidian [2022-], Base [1990-1991]
Liberty | u | 2002 | 2012 | Sport, Limited, Renegade
Patriot | u | 2007 | 2017 | Sport, Latitude, Limited
Recon | u | 2026 | | Base, Moab
Renegade | u | 2015 | 2023 | Sport, Latitude, Limited, Trailhawk
Wagoneer | u | 1990, 2022 |  | Series I [2022-], Series II [2022-], Series III [2022-], Limited [1990]
Wagoneer S | u | 2024 | | Launch Edition, Limited
Wrangler | u | 1987 | | Sport, Willys [2012-], Sahara, Rubicon [2003-], Rubicon 392 [2021-], 4xe [2021-]`,

  "Kia": `
Amanti | s | 2004 | 2009 | Base
Borrego | u | 2009 | 2009 | LX, EX
Cadenza | s | 2014 | 2020 | Premium, Technology, Limited
Carnival | v | 2022 | | LX, EX, SX, SX-Prestige, Hybrid
EV6 | u | 2022 | | Light, Wind, GT-Line, GT
EV9 | u | 2024 | | Light, Wind, Land, GT-Line
Forte | s | 2010 | 2024 | FE [2019-], LXS, GT-Line [2019-], GT [2020-]
K4 | s | 2025 | | LX, LXS, EX, GT-Line
K5 | s | 2021 | | LX, LXS, GT-Line, EX, GT
K900 | s | 2015 | 2020 | Luxury, Elite
Niro | u | 2017 | | LX, EX, SX, Plug-In Hybrid, EV
Optima | s | 2001 | 2020 | LX, S, EX, SX
Rio | s | 2001 | 2023 | LX, S, EX
Rondo | h | 2007 | 2010 | LX, EX
Sedona | v | 2002 | 2021 | L, LX, EX, SX
Seltos | u | 2021 | | LX, S, EX, SX
Sephia | s | 1994 | 2001 | Base, LS, RS
Sorento | u | 2003 | | LX, S, EX, SX, X-Line [2021-], Hybrid [2021-], Plug-In Hybrid [2022-]
Soul | h | 2010 | | LX, S, GT-Line [2020-], EX
Spectra | s | 2000 | 2009 | LX, EX, SX
Sportage | u | 1995-2002, 2005 |  | LX, EX, SX [2011-], X-Line [2023-], X-Pro [2023-], Hybrid [2023-]
Stinger | h | 2018 | 2023 | GT-Line, GT, GT1, GT2
Telluride | u | 2020 | | LX, S, EX, SX, X-Line [2023-], X-Pro [2023-]`,

  "Lamborghini": `
Aventador | c | 2012 | 2022 | LP 700-4, S, SVJ, Ultimae
Gallardo | c | 2004 | 2014 | LP 550-2, LP 560-4, Spyder
Huracán | c | 2015 | 2024 | EVO, STO, Tecnica, Sterrato
Revuelto | c | 2024 | | Base
Temerario | c | 2025 | | Base
Urus | u | 2019 | | S, Performante, SE`,

  "Land Rover": `
Defender | u | 1993-1997, 2020 |  | 90, 110, 130 [2023-], S [2020-], X-Dynamic [2020-], X [2020-], V8 [2022-], Octa [2025-]
Discovery | u | 1994-2004, 2017 |  | S [2017-], Dynamic SE [2021-], Dynamic HSE [2021-], SD [1994-2004], LE [1994-2004], SE [1994-2004]
Discovery Sport | u | 2015 | | S, Dynamic SE
Freelander | u | 2002 | 2005 | S, SE, HSE
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
SC | c | 1992-2000, 2002 | 2010 | 430 [2002-2010], 300 [1992-2000], 400 [1992-2000]
TX | u | 2024 | | 350, 500h, 550h+, Premium, Luxury
UX | u | 2019 | | 200, 250h, 300h, F Sport`,

  "Lincoln": `
Aviator | u | 2003 | | Base, Reserve, Black Label, Grand Touring
Blackwood | t | 2002 | 2002 | Base
Continental | s | 1990-2002, 2017 | 2020 | Premiere [2017-2020], Select [2017-2020], Reserve [2017-2020], Black Label [2017-2020], Base [1990-2002]
Corsair | u | 2020 | | Base, Premiere, Reserve, Grand Touring
LS | s | 2000 | 2006 | V6, V8
Mark LT | t | 2006 | 2008 | Base
Mark VII | c | 1984 | 1992 | LSC, Bill Blass
Mark VIII | c | 1993 | 1998 | Base, LSC
MKC | u | 2015 | 2019 | Premiere, Select, Reserve, Black Label
MKS | s | 2009 | 2016 | Base, EcoBoost
MKT | u | 2010 | 2019 | Base, EcoBoost
MKX | u | 2007 | 2018 | Premiere, Select, Reserve, Black Label
MKZ | s | 2007 | 2020 | Base, Select, Reserve, Black Label, Hybrid
Nautilus | u | 2019 | | Premiere, Reserve, Black Label
Navigator | u | 1998 | | Base, Premiere, Reserve, Black Label
Town Car | s | 1981 | 2011 | Signature, Signature Limited, Executive
Zephyr | s | 2006 | 2006 | Base, Ultimate`,

  "Lotus": `
Eletre | u | 2025 | | Base, S, R
Elise | c | 2005 | 2011 | Base, SC
Emira | c | 2023 | | 2.0, V6
Esprit | c | 1976 | 2004 | S4, V8, GT
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
323 | h | 1986 | 1994 | Base, SE
626 | s | 1979 | 2002 | DX, LX, ES
929 | s | 1988 | 1995 | Base, S
B-Series | t | 1972 | 2009 | SE, SX, Cab Plus, Troy Lee
CX-3 | u | 2016 | 2021 | Sport, Touring, Grand Touring
CX-30 | u | 2020 | | 2.5 S, Select, Preferred, Premium, Turbo
CX-5 | u | 2013 | | 2.5 S, Select, Preferred, Carbon Edition [2021-], Premium, Turbo Signature [2019-]
CX-50 | u | 2023 | | 2.5 S, Select, Preferred, Meridian [2024-], Premium, Turbo, Hybrid [2025-]
CX-7 | u | 2007 | 2012 | Sport, Touring, Grand Touring
CX-70 | u | 2025 | | 3.3 Turbo, Premium, PHEV
CX-9 | u | 2007 | 2023 | Sport, Touring, Grand Touring, Signature
CX-90 | u | 2024 | | Select, Preferred, Premium, Turbo S, PHEV
Mazda2 | h | 2011 | 2014 | Sport, Touring
Mazda3 | s | 2004 | | 2.5 S, Select, Preferred, Premium, Turbo
Mazda3 Hatchback | h | 2004 | | 2.5 S, Select, Preferred, Premium, Turbo
Mazda5 | v | 2006 | 2015 | Sport, Touring, Grand Touring
Mazda6 | s | 2003 | 2021 | Sport, Touring, Grand Touring, Signature
Mazdaspeed3 | h | 2007 | 2013 | Sport, Touring, Grand Touring
Millenia | s | 1995 | 2002 | Base, L, S
MPV | v | 1989 | 2006 | DX, LX, ES
MX-3 | c | 1992 | 1995 | Base, GS
MX-30 | u | 2022 | 2023 | Base, Premium Plus
MX-5 Miata | c | 1990 | | Sport, Club, Grand Touring, RF
MX-6 | c | 1988 | 1997 | Base, LS
Navajo | u | 1991 | 1994 | DX, LX
Protegé | s | 1990 | 2003 | DX, LX, ES, MP3
Protegé5 | h | 2002 | 2003 | Base
RX-7 | c | 1979 | 1995 | Base, Touring, R1, R2
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
190 | s | 1984 | 1993 | 190E 2.3, 190E 2.6
A-Class | s | 2019 | 2022 | A 220, AMG A 35
AMG GT | c | 2016 | | 43, 55, 63, R, Black Series
C-Class | s | 1994 | | C 230, C 250, C 300, C 350, AMG C 43, AMG C 63
CL | c | 1998 | 2014 | CL500, CL550, CL600, CL63 AMG, CL65 AMG
CLA | s | 2014 | | CLA 250, AMG CLA 35, AMG CLA 45
CLE | c | 2024 | | CLE 300, CLE 450, AMG CLE 53
CLK | c | 1998 | 2009 | CLK320, CLK350, CLK430, CLK500, CLK550, CLK55 AMG, CLK63 AMG
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
R-Class | u | 2006 | 2013 | R320, R350, R500, R63 AMG
S-Class | s | 1991 | | S 450, S 500, S 550, S 580, AMG S 63, Maybach
SL | c | 1990 | | SL 55, SL 63, SL 43
SLC | c | 2017 | 2020 | SLC 300, AMG SLC 43
SLK | c | 1998 | 2016 | SLK 250, SLK 300, SLK 350, SLK 55 AMG
Sprinter | v | 2003 | | Cargo, Crew, Passenger`,

  "Mercury": `
Capri | c | 1991 | 1994 | Base, XR2
Cougar | c | 1967 | 2002 | XR7, LS, V6, C2, Zn
Grand Marquis | s | 1983 | 2011 | GS, LS
Marauder | s | 2003 | 2004 | Base
Mariner | u | 2005 | 2011 | Base, Premier, Hybrid
Milan | s | 2006 | 2011 | Base, Premier, Hybrid
Montego | s | 2005 | 2007 | Luxury, Premier
Monterey | v | 2004 | 2007 | Convenience, Luxury, Premier
Mountaineer | u | 1997 | 2010 | Base, Premier
Mystique | s | 1995 | 2000 | GS, LS
Sable | s | 1986 | 2009 | GS, LS, Premier
Topaz | s | 1984 | 1994 | GS, LS, XR5
Tracer | s | 1988 | 1999 | Base, LS, LTS, Trio
Villager | v | 1993 | 2002 | GS, LS, Nautica, Sport, Estate`,

  "Mini": `
Clubman | h | 2008 | 2024 | Cooper, Cooper S, JCW
Convertible | c | 2005 | | Cooper, Cooper S, JCW
Cooper | h | 2002 | | Classic, Signature, Iconic, Cooper S, JCW, SE
Countryman | u | 2011 | | Cooper S, JCW, SE
Paceman | h | 2013 | 2016 | Cooper, Cooper S, JCW`,

  "Mitsubishi": `
3000GT | c | 1991 | 1999 | Base, SL, VR-4
Diamante | s | 1992 | 2004 | ES, LS, VR-X
Eclipse | c | 1990 | 2012 | GS, GT, Spyder
Eclipse Cross | u | 2018 | | ES, LE, SE, SEL
Endeavor | u | 2004 | 2011 | LS, SE
Expo | h | 1992 | 1994 | Base, SP, LRV
Galant | s | 1985 | 2012 | DE, ES, SE, GTS, Ralliart
Lancer | s | 2002 | 2017 | ES, SE, GTS, Ralliart, Evolution
Mighty Max | t | 1983 | 1996 | Base, SPX
Mirage | h | 1990-1993, 1997-2002, 2014 | 2024 | ES [2014-], LE [2014-], SE [2014-], DE [1997-2002], LS [1997-2002]
Mirage G4 | s | 2017 | 2024 | ES, LE, SE
Montero | u | 1983 | 2006 | XLS, Limited
Montero Sport | u | 1997 | 2004 | ES, LS, XLS, Limited
Outlander | u | 2003 | | ES, SE, SEL, Ralliart
Outlander PHEV | u | 2018 | | ES, SE, SEL
Outlander Sport | u | 2011 | 2024 | S, ES, LE, SE
Precis | h | 1987 | 1994 | Base
Raider | t | 2006 | 2009 | LS, Duro Cross, XLS`,

  "Nissan": `
200SX | c | 1995 | 1998 | Base, SE, SE-R
240SX | c | 1989 | 1998 | Base, SE, LE
300ZX | c | 1984 | 1996 | Base, 2+2, Turbo
350Z | c | 2003 | 2009 | Base, Enthusiast, Touring, Grand Touring, NISMO
370Z | c | 2009 | 2020 | Base, Sport, Touring, NISMO
Altima | s | 1993 | | S, SV, SR [2013-], SL, Platinum [2019-]
Ariya | u | 2023 | | Engage, Venture+, Evolve+, Platinum+
Armada | u | 2004 | | S, SV, SL, Platinum, PRO-4X
Cube | h | 2009 | 2014 | Base, S, SL, Krom
Frontier | t | 1998 | | S, SV, PRO-X, PRO-4X
GT-R | c | 2009 | 2024 | Premium, T-spec, NISMO
Hardbody | t | 1986 | 1997 | Base, XE, SE
Juke | u | 2011 | 2017 | S, SV, SL, NISMO
Kicks | u | 2018 | | S, SV, SR
Leaf | h | 2011 | | S, SV, SV Plus, Platinum+
Maxima | s | 1981 | 2023 | S, SV, SR, Platinum
Murano | u | 2003 | | SV, SL, Platinum
NV | v | 2012 | 2021 | Cargo, Passenger
NV200 | v | 2013 | 2021 | S, SV
NX | c | 1991 | 1993 | 1600, 2000
Pathfinder | u | 1987 | | S, SV, SL, Platinum [2013-], Rock Creek [2022-]
Pulsar | c | 1983 | 1990 | NX, XE, SE
Quest | v | 1993 | 2017 | S, SV, SL, Platinum
Rogue | u | 2008 | | S, SV, SL, Platinum [2021-], Rock Creek [2023-]
Rogue Sport | u | 2017 | 2022 | S, SV, SL
Sentra | s | 1982 | | S, SV, SR, SL
Stanza | s | 1982 | 1992 | XE, GXE
Titan | t | 2004 | 2024 | S, SV, PRO-4X, Platinum Reserve, XD
Versa | s | 2007 | | S, SV, SR
Xterra | u | 2000 | 2015 | S, X, Off-Road, PRO-4X
Z | c | 2023 | | Sport, Performance, NISMO`,

  "Oldsmobile": `
Achieva | s | 1992 | 1998 | S, SC, SL
Alero | s | 1999 | 2004 | GX, GL, GLS
Aurora | s | 1995 | 2003 | Base, 4.0
Bravada | u | 1991 | 2004 | Base
Cutlass | s | 1997 | 1999 | Base, GL, GLS
Cutlass Ciera | s | 1982 | 1996 | S, SL
Cutlass Supreme | s | 1988 | 1997 | S, SL, International
Eighty-Eight | s | 1949 | 1999 | Royale, LS, LSS
Intrigue | s | 1998 | 2002 | GX, GL, GLS
Ninety-Eight | s | 1941 | 1996 | Regency, Elite, Touring
Silhouette | v | 1990 | 2004 | GL, GLS, Premiere
Toronado | c | 1966 | 1992 | Base, Trofeo`,

  "Plymouth": `
Acclaim | s | 1989 | 1995 | Base, LE, LX
Breeze | s | 1996 | 2000 | Base, Expresso
Colt | h | 1971 | 1994 | Base, GL, Vista
Grand Voyager | v | 1987 | 2000 | Base, SE, LE
Laser | c | 1990 | 1994 | Base, RS, RS Turbo
Neon | s | 1995 | 2001 | Highline, Sport, Expresso, LX
Prowler | c | 1997 | 2001 | Base
Sundance | h | 1987 | 1994 | America, Duster
Voyager | v | 1974 | 2000 | Base, SE, LE, Expresso`,

  "Polestar": `
Polestar 2 | h | 2021 | | Long Range Single Motor, Long Range Dual Motor, Performance
Polestar 3 | u | 2025 | | Long Range Dual Motor, Performance
Polestar 4 | u | 2025 | | Long Range Single Motor, Long Range Dual Motor`,

  "Pontiac": `
6000 | s | 1982 | 1991 | LE, S/E, STE
Aztek | u | 2001 | 2005 | Base, GT
Bonneville | s | 1957 | 2005 | SE, SLE, SSE, SSEi, GXP
Firebird | c | 1967 | 2002 | Base, Formula, Trans Am
G5 | s | 2007 | 2009 | Base, GT
G6 | s | 2005 | 2010 | Base, GT, GTP
G8 | s | 2008 | 2009 | Base, GT, GXP
Grand Am | s | 1973 | 2005 | SE, GT
Grand Prix | s | 1962 | 2008 | Base, GT, GXP
LeMans | h | 1988 | 1993 | Value Leader, SE, GSE
Montana | v | 1999 | 2006 | Base, SV6
Solstice | c | 2006 | 2009 | Base, GXP
Sunbird | s | 1976 | 1994 | LE, SE, GT
Sunfire | c | 1995 | 2005 | SE, GT
Torrent | u | 2006 | 2009 | Base, GXP
Trans Sport | v | 1990 | 1998 | Base, SE, Montana
Vibe | h | 2003 | 2010 | Base, AWD, GT`,

  "Porsche": `
718 Boxster | c | 1997 | | Base, S, GTS 4.0, Spyder
718 Cayman | c | 2006 | | Base, S, GTS 4.0, GT4
911 | c | 1965 | | Carrera, Carrera S, Carrera 4S, GTS, Targa, Turbo, Turbo S, GT3
928 | c | 1978 | 1995 | S4, GT, GTS
944 | c | 1983 | 1991 | S2, Turbo
968 | c | 1992 | 1995 | Base, Cabriolet
Cayenne | u | 2003 | | Base, E-Hybrid, S, GTS, Turbo, Turbo GT
Cayenne Coupe | u | 2020 | | Base, E-Hybrid, S, GTS, Turbo GT
Macan | u | 2015 | | Base, T, S, GTS
Macan Electric | u | 2024 | | Base, 4, 4S, Turbo
Panamera | h | 2010 | | Base, 4, 4 E-Hybrid, GTS, Turbo, Turbo S
Taycan | s | 2020 | | Base, 4, 4S, GTS, Turbo, Turbo S, Cross Turismo`,

  "Ram": `
1500 | t | 2011 | | Tradesman, Big Horn, Laramie, Rebel [2015-], Limited [2016-], Longhorn [2013-], TRX [2021-2024], RHO [2025-]
2500 | t | 2011 | | Tradesman, Big Horn, Laramie, Power Wagon, Limited
3500 | t | 2011 | | Tradesman, Big Horn, Laramie, Limited
Dakota | t | 2011 | 2011 | ST, Big Horn, Laramie, Lone Star
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
9-7X | u | 2005 | 2009 | 4.2i, 5.3i, Aero
900 | h | 1979 | 1998 | S, SE, Turbo
9000 | h | 1986 | 1998 | CS, CSE, Aero`,

  "Saturn": `
Astra | h | 2008 | 2009 | XE, XR
Aura | s | 2007 | 2009 | XE, XR, Green Line
Ion | s | 2003 | 2007 | 1, 2, 3, Red Line
L-Series | s | 2000 | 2005 | L100, L200, L300, LW200, LW300
Outlook | u | 2007 | 2010 | XE, XR
Relay | v | 2005 | 2007 | 1, 2, 3
S-Series | s | 1991 | 2002 | SL, SL1, SL2, SC1, SC2, SW1, SW2
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
Ascent | u | 2019 | | Base, Premium, Onyx Edition [2020-], Limited, Touring
Baja | t | 2003 | 2006 | Base, Sport, Turbo
BRZ | c | 2013 | | Premium, Limited, tS
Crosstrek | u | 2013 | | Base, Premium, Sport [2018-], Limited, Wilderness [2024-], Hybrid [2014-2016, 2019-2023]
Forester | u | 1998 | | Base, Premium, Sport [2019-], Limited, Touring [2014-], Wilderness [2022-], Hybrid [2025-]
Impreza | s | 1993 | | Base, Premium, Sport, RS [2024-]
Justy | h | 1987 | 1994 | DL, GL
Legacy | s | 1990 | 2025 | Base, Premium, Sport, Limited, Touring XT
Loyale | s | 1990 | 1994 | Base
Outback | u | 1995 | | Base, Premium, Limited, Onyx Edition [2020-], Touring [2013-], Wilderness [2022-]
Solterra | u | 2023 | | Premium, Limited, Touring
SVX | c | 1992 | 1997 | L, LS, LSi
Trailseeker | u | 2026 | | Premium, Limited, Touring
Tribeca | u | 2006 | 2014 | Base, Limited, Touring
Uncharted | u | 2026 | | Premium, Sport, Limited
WRX | s | 2002 | | Base, Premium, Limited, GT [2022-], TR [2024-], STI [2004-2021]`,

  "Suzuki": `
Aerio | s | 2002 | 2007 | S, GS, SX
Equator | t | 2009 | 2012 | Base, Sport, RMZ-4
Esteem | s | 1995 | 2002 | GL, GLX
Forenza | s | 2004 | 2008 | Base, S, LX
Grand Vitara | u | 1999 | 2013 | Base, Premium, Limited
Kizashi | s | 2010 | 2013 | S, SE, GTS, SLS
Reno | h | 2005 | 2008 | Base, S, LX
Samurai | u | 1986 | 1995 | JA, JL, JX
Sidekick | u | 1989 | 1998 | JS, JX, JLX, Sport
Swift | h | 1989 | 2001 | GA, GS, GT
SX4 | h | 2007 | 2013 | Base, Crossover, Sport, Technology
Verona | s | 2004 | 2006 | S, LX, EX
Vitara | u | 1999 | 2004 | JS, JLS
X-90 | u | 1996 | 1998 | Base
XL7 | u | 2002 | 2009 | Base, Luxury, Limited`,

  "Tesla": `
Cybertruck | t | 2024 | | Long Range, All-Wheel Drive, Cyberbeast
Model 3 | s | 2017 | | Standard, Rear-Wheel Drive [2022-], Long Range, Performance [2018-]
Model S | s | 2012 | | Long Range [2019-], Plaid [2021-], 75D [2016-2019], 85 [2012-2015], P100D [2016-2019]
Model X | u | 2016 | | Long Range [2019-], Plaid [2021-], 75D [2016-2019], 100D [2017-2019], P100D [2016-2019]
Model Y | u | 2020 | | Standard, Rear-Wheel Drive [2023-], Long Range, Performance [2020-]
Roadster | c | 2008 | 2012 | Base, Sport`,

  "Toyota": `
4Runner | u | 1984 | | SR5, TRD Sport [2025-], TRD Off-Road [2014-], Limited, Platinum [2025-], TRD Pro [2015-], Trailhunter [2025-]
86 | c | 2017 | 2020 | Base, GT, Hakone Edition
Avalon | s | 1995 | 2022 | XLE, XSE, Touring, Limited, Hybrid
bZ | u | 2026 | | XLE, Limited, Woodland
bZ Woodland | u | 2026 | | Premium
bZ4X | u | 2023 | 2025 | XLE, Limited
C-HR | u | 2018 | | LE, XLE, Limited, SE, XSE
Camry | s | 1983 | | LE, SE [2007-], XLE, XSE [2018-], TRD [2020-2024], Nightshade [2019-2024], Hybrid [2007-]
Celica | c | 1971 | 2005 | GT, GT-S
Corolla | s | 1968 | | L, LE, SE, XSE [2017-], XLE [2014-2022], Hybrid [2020-]
Corolla Cross | u | 2022 | | L, LE, S, XLE, Hybrid
Corolla Hatchback | h | 2019 | | SE, XSE, Nightshade
Cressida | s | 1978 | 1992 | Base, Luxury
Crown | s | 2023 | | XLE, Limited, Platinum, Nightshade
Crown Signia | u | 2025 | | XLE, Limited
Echo | s | 2000 | 2005 | Base
FJ Cruiser | u | 2007 | 2014 | Base, Trail Teams
GR Corolla | h | 2023 | | Core, Premium, Circuit Edition, MORIZO Edition
GR Supra | c | 2020 | 2026 | 2.0, 3.0, 3.0 Premium, A91, MkV Final Edition
GR86 | c | 2022 | | Base, Premium, Hakone Edition
Grand Highlander | u | 2024 | | XLE, Limited, Platinum, Hybrid MAX
Highlander | u | 2001 | | LE, XLE, XSE [2021-], Limited, Platinum [2017-], Hybrid [2006-]
Land Cruiser | u | 1958-2021, 2024 |  | 1958 [2024-], Land Cruiser [2024-], First Edition [2024-2025], Base [1958-2021], Heritage Edition [2020-2021]
Matrix | h | 2003 | 2013 | Base, S, XR, XRS
Mirai | s | 2016 | | XLE, Limited
MR2 | c | 1985 | 1995 | Base, Turbo
MR2 Spyder | c | 2000 | 2005 | Base
Paseo | c | 1992 | 1997 | Base, Convertible
Pickup | t | 1964 | 1995 | Base, Deluxe, SR5
Previa | v | 1991 | 1997 | DX, LE, SE
Prius | h | 2001 | | LE, XLE, Limited [2016-], Nightshade [2021-]
Prius Prime | h | 2017 | | SE, XSE, XSE Premium
Prius v | h | 2012 | 2017 | Two, Three, Four, Five
RAV4 | u | 1996 | | LE, XLE, XLE Premium [2017-], Adventure [2018-], TRD Off-Road [2020-], Limited [2006-], Woodland [2024-], Hybrid [2016-], Prime [2021-]
Sequoia | u | 2001 | | SR5, Limited, Platinum, TRD Pro, Capstone, 1794 Edition
Sienna | v | 1998 | | LE, XLE, XSE [2015-], Woodland [2021-], Limited, Platinum [2021-]
Solara | c | 1999 | 2008 | SE, SLE, Sport
Supra | c | 1979 | 1998 | Base, Turbo
T100 | t | 1993 | 1998 | Base, DX, SR5
Tacoma | t | 1995 | | SR [2016-], SR5, TRD Sport [2016-], TRD Off-Road [2016-], Limited [2012-], Trailhunter [2024-], TRD Pro [2015-]
Tercel | s | 1980 | 1999 | Base, DX, CE
Tundra | t | 2000 | | SR, SR5, Limited, Platinum [2010-], 1794 Edition [2014-], TRD Pro [2015-], Capstone [2022-]
Venza | u | 2009 | 2024 | LE, XLE, Limited, Nightshade
Yaris | h | 2007 | 2020 | L, LE, XLE, SE`,

  "VinFast": `
VF 8 | u | 2023 | | Eco, Plus
VF 9 | u | 2024 | | Eco, Plus`,

  "Volkswagen": `
Arteon | s | 2019 | 2023 | SE, SEL, SEL R-Line, SEL Premium R-Line
Atlas | u | 2018 | | SE, SE with Technology, Peak Edition [2024-], SEL, SEL Premium R-Line
Atlas Cross Sport | u | 2020 | | SE, SE with Technology, SEL, SEL R-Line, SEL Premium R-Line
Beetle | h | 1998 | 2019 | S, SE, SEL, Turbo, Dune, Convertible
Cabrio | c | 1995 | 2002 | Base, GL, GLS, GLX
Cabriolet | c | 1985 | 1993 | Base, Boutique, Carat
CC | s | 2009 | 2017 | Sport, R-Line, Executive, VR6
Corrado | c | 1990 | 1994 | G60, SLC
e-Golf | h | 2015 | 2019 | SE, SEL Premium
Eos | c | 2007 | 2016 | Komfort, Lux, Executive
EuroVan | v | 1993 | 2003 | CL, GL, GLS, MV, Camper
Fox | s | 1987 | 1993 | Base, GL
Golf | h | 1985 | 2021 | S, SE, TSI, TDI, Alltrack, SportWagen
Golf GTI | h | 1985 | | S, SE, Autobahn, 380
Golf R | h | 2012 | | Base, 20th Anniversary
ID. Buzz | v | 2025 | | Pro S, Pro S Plus, 1st Edition
ID.4 | u | 2021 | | Standard, Pro, Pro S, Pro S Plus
Jetta | s | 1980 | | S, Sport [2019-], SE, SEL, GLI, TDI
Passat | s | 1990 | 2022 | S, SE, R-Line, SEL, TDI
Phaeton | s | 2004 | 2006 | V8, W12
Rabbit | h | 2007 | 2009 | S
Routan | v | 2009 | 2014 | S, SE, SEL
Taos | u | 2022 | | S, SE, SEL
Tiguan | u | 2009 | | S, SE, SE R-Line, SEL R-Line
Touareg | u | 2004 | 2017 | Sport, Lux, Executive, TDI, Hybrid`,

  "Volvo": `
240 | s | 1975 | 1993 | Base, DL, GL
740 | s | 1985 | 1992 | Base, GL, GLE, Turbo
850 | s | 1993 | 1997 | Base, GLT, T-5, R
940 | s | 1991 | 1995 | Base, GL, Turbo
960 | s | 1992 | 1997 | Base
C30 | h | 2008 | 2013 | T5, R-Design
C40 Recharge | u | 2022 | 2024 | Core, Plus, Ultimate
C70 | c | 1998 | 2013 | T5
ES90 | s | 2026 | | Plus, Ultra
EX30 | u | 2025 | | Core, Plus, Ultra, Cross Country
EX40 | u | 2025 | | Core, Plus, Ultra
EX90 | u | 2025 | | Plus, Ultra
S40 | s | 2000 | 2011 | 2.4i, T5
S60 | s | 2001 | 2025 | Core, Plus, Ultimate, T5, T6, T8, Polestar
S70 | s | 1998 | 2000 | Base, GLT, T5, AWD
S80 | s | 1999 | 2016 | 3.2, T6
S90 | s | 1997-1998, 2017 | 2025 | Core [2017-], Plus [2017-], Ultimate [2017-], T8 [2017-], Base [1997-1998]
V50 | h | 2005 | 2011 | 2.4i, T5
V60 | h | 2015 | 2025 | Core, Plus, Ultimate, Cross Country, Polestar
V70 | h | 1998 | 2010 | 2.4, 3.2, T5, XC
V90 | h | 1997-1998, 2017 | 2025 | Cross Country [2017-], Ultimate [2017-], Base [1997-1998]
XC40 | u | 2019 | | Core, Plus, Ultimate
XC60 | u | 2010 | | Core, Plus, Ultimate, T8 Polestar Engineered
XC70 | u | 2001 | 2016 | 3.2, T6
XC90 | u | 2003 | | Core, Plus, Ultimate, T8`,
};
