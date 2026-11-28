# Singapore cars: reference for the kampung's vehicles

Short research note behind the owner's ask "make the cars look more like real Singapore cars". Everything in the game stays generic and unbranded: no makes, badges, model names, operator names or liveries.

## What the sources say

| Topic | Source says | Source |
| --- | --- | --- |
| Driving side | Only right-hand-drive cars may be registered for use in Singapore (vintage cars excepted); traffic keeps left. | LTA car importation guide, [onemotoring.lta.gov.sg/.../Car.pdf](https://onemotoring.lta.gov.sg/content/dam/onemotoring/pdf_2017/Car.pdf); [Driving in Singapore (Wikipedia)](https://en.wikipedia.org/wiki/Driving_in_Singapore) |
| Plate format | Private cars: prefix starting with **S**, then series letters, then a number 1-9999 (no leading zeros), then a check letter. "I" and "O" are not used in the series. Taxis use an **SH** prefix. | [Vehicle registration plates of Singapore (Wikipedia)](https://en.wikipedia.org/wiki/Vehicle_registration_plates_of_Singapore) |
| Plate colours | Standard: white (silver) characters on black, front and rear. Owner's alternative: black on white at the front and black on yellow at the rear. | same Wikipedia article; LTA [standard registration](https://onemotoring.lta.gov.sg/content/onemotoring/home/buying/vehicle-types-and-registrations/car/standard_registration.html) |
| What is on the road | LTA publishes the car population by make (data.gov.sg / DataMall). End-2024: 657,744 cars and station wagons out of 1,007,094 motor vehicles. In 2024 new registrations, the top brands were BYD, Toyota, BMW, Mercedes-Benz and Tesla. | [data.gov.sg: annual car population by make](https://data.gov.sg/dataset/annual-car-population-by-make), [LTA statistics](https://www.lta.gov.sg/content/ltagov/en/who_we_are/statistics_and_publications/statistics.html), [motorist.sg 2024 sales](https://motorist.sg/article/4150/byd-was-singapore-s-best-selling-passenger-car-brand-in-2024-with-6-191-units-registered) |
| Colours | No Singapore-specific survey found. For Southeast Asia, AkzoNobel (2020) found black, white and grey were the top choices for new car owners. Globally, white has led for years, with silver strong in Asia. | [paultan.org on AkzoNobel 2020](https://paultan.org/2020/10/13/over-60-of-new-car-owners-prefer-black-white-grey/), [Car colour popularity (Wikipedia)](https://en.wikipedia.org/wiki/Car_colour_popularity) |
| Taxis | There are several taxi operators, each with its own fleet livery, and every taxi has a "Taxi" sign on the roof. Historically, taxis were two-tone with a lit "Taxi" roof sign. | [LTA taxi operators](https://www.lta.gov.sg/content/ltagov/en/getting_around/taxis_private_hire_cars/taxi_operators.html), [Taxis of Singapore (Wikipedia)](https://en.wikipedia.org/wiki/Taxicabs_of_Singapore) |

## Inference (not stated by the sources)

- **Body types.** The top brands sell mostly compact and mid-size sedans and compact crossovers / SUVs, plus MPVs and some hatchbacks. That is the mix used. The LTA make data does not break down by body type, so this is an inference.
- **Colours.** Mostly white, silver, grey and black, with a few dark colours (blue, deep red). This comes from the regional surveys, not from Singapore data.
- **Plates.** Both plate schemes are common on the street, so the kampung uses both: black plates on the sedans, taxis and MPV; Euro white-front / yellow-rear plates on the hatch and SUVs. Characters are drawn as plain bars in the S-series pattern (3 letters, 4 digits, 1 check letter). No real number is shown.
- **Taxis.** A plain two-tone livery (teal lower body, white upper body, which matches no operator's colours) and a roof sign reading "TAXI".
- **Look.** Tidy, modern proportions: flat bonnet, crisp shoulder line, raked windscreen, bumper lip, alloy-style wheels.

## What the game does with it

- Kampung car looks (`js/game/vehicle-spots.js`, `KAMPUNG_LOOKS`): 4 sedans, 2 SUVs, 1 MPV, 1 hatchback and 2 taxis, in white, silver, grey, black, one dark blue and one deep red.
- Plates and taxi livery are in `js/figures/vehicle-car-geo.js` (`PLATES`, `SG_PLATE`, `TAXI_LIVERY`, the "TAXI" sign letters).
- Right-hand drive in the kampung (the driver sits on the right). Makkah and Madinah keep left-hand drive and get a plain white plate, not a Singapore one.
- No photos are committed. Nothing copies a specific manufacturer's design.
