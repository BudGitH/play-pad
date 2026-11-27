/* ============================================================================
 * FILE: ritual-text.js
 * PURPOSE: The words of the rituals, one standard text per item: Arabic, a Malay/English-friendly
 *          transliteration, an English meaning and where the words come from (surah:ayah or hadith).
 *          Used by the Umrah / Hajj / Ziarah steppers, the wudu, prayer and eating steppers.
 * BUSINESS CONTEXT: features/kampung-quest-haramain/requirements.md (AC-H3, H4, H5, H8). Sunni,
 *   Shafi'i practice as in Singapore. Only well-known standard texts are used. This is religious
 *   content for children: change a word only against a reliable source, then run the data tests.
 * SHAPE: KQ.RITUAL_TEXT[id] = { title, ref, lines: [{ ar, tr, en }] }.
 *   Each line's Arabic words and transliteration tokens line up ONE TO ONE (space separated), so a
 *   recitation can be shown word by word. tests/kampung-quest/ritual-text.test.mjs checks that.
 * DEPENDENCIES: none (data only, loads before js/sim).
 * ========================================================================== */
(function (KQ) {
  "use strict";
  /** One line: Arabic words, the same number of transliteration tokens, and the English meaning. */
  const L = (ar, tr, en) => Object.freeze({ ar, tr, en });
  const T = (title, ref, lines) => Object.freeze({ title, ref, lines: Object.freeze(lines) });

  const TEXT = {
    /* ------------------------------ the five daily prayers ------------------------------ */
    takbir: T("Takbir", "Opening of the prayer", [
      L("ٱللَّٰهُ أَكْبَرُ", "Allahu akbar", "Allah is the Greatest."),
    ]),
    fatihah: T("Al-Fatihah", "Al-Fatihah 1:1-7", [
      L(
        "بِسْمِ ٱللَّٰهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ",
        "Bismi llahi ar-rahmani ar-rahim",
        "In the name of Allah, the Most Kind, the Most Merciful.",
      ),
      L(
        "ٱلْحَمْدُ لِلَّٰهِ رَبِّ ٱلْعَالَمِينَ",
        "Alhamdu lillahi rabbi al-'alamin",
        "All praise is for Allah, Lord of all the worlds.",
      ),
      L("ٱلرَّحْمَٰنِ ٱلرَّحِيمِ", "Ar-rahmani ar-rahim", "The Most Kind, the Most Merciful."),
      L("مَالِكِ يَوْمِ ٱلدِّينِ", "Maliki yawmi ad-din", "Master of the Day of Judgement."),
      L(
        "إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ",
        "Iyyaka na'budu wa-iyyaka nasta'in",
        "You alone we worship, and You alone we ask for help.",
      ),
      L(
        "ٱهْدِنَا ٱلصِّرَاطَ ٱلْمُسْتَقِيمَ",
        "Ihdina as-sirata al-mustaqim",
        "Guide us to the straight path,",
      ),
      L(
        "صِرَاطَ ٱلَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ ٱلْمَغْضُوبِ عَلَيْهِمْ وَلَا ٱلضَّالِّينَ",
        "Sirata alladhina an'amta 'alayhim ghayri al-maghdubi 'alayhim wa-la ad-dallin",
        "the path of those You have blessed, not of those who earned anger, nor of those who went astray.",
      ),
    ]),
    ikhlas: T("Al-Ikhlas", "Al-Ikhlas 112:1-4", [
      L("قُلْ هُوَ ٱللَّٰهُ أَحَدٌ", "Qul huwa Allahu ahad", "Say: He is Allah, the One."),
      L("ٱللَّٰهُ ٱلصَّمَدُ", "Allahu as-samad", "Allah, the One everyone needs."),
      L(
        "لَمْ يَلِدْ وَلَمْ يُولَدْ",
        "Lam yalid wa-lam yulad",
        "He has no child, and He was not born.",
      ),
      L(
        "وَلَمْ يَكُنْ لَهُ كُفُوًا أَحَدٌ",
        "Wa-lam yakun lahu kufuwan ahad",
        "And there is nothing like Him.",
      ),
    ]),
    kafirun: T("Al-Kafirun", "Al-Kafirun 109:1-6", [
      L(
        "قُلْ يَا أَيُّهَا ٱلْكَافِرُونَ",
        "Qul ya ayyuha al-kafirun",
        "Say: O you who disbelieve,",
      ),
      L(
        "لَا أَعْبُدُ مَا تَعْبُدُونَ",
        "La a'budu ma ta'budun",
        "I do not worship what you worship,",
      ),
      L(
        "وَلَا أَنْتُمْ عَابِدُونَ مَا أَعْبُدُ",
        "Wa-la antum 'abidun ma a'bud",
        "and you do not worship what I worship.",
      ),
      L(
        "وَلَا أَنَا عَابِدٌ مَا عَبَدْتُمْ",
        "Wa-la ana 'abidun ma 'abattum",
        "And I will not worship what you worship,",
      ),
      L(
        "وَلَا أَنْتُمْ عَابِدُونَ مَا أَعْبُدُ",
        "Wa-la antum 'abidun ma a'bud",
        "and you will not worship what I worship.",
      ),
      L(
        "لَكُمْ دِينُكُمْ وَلِيَ دِينِ",
        "Lakum dinukum wa-liya din",
        "You have your religion, and I have mine.",
      ),
    ]),
    falaq: T("Al-Falaq", "Al-Falaq 113:1-5", [
      L(
        "قُلْ أَعُوذُ بِرَبِّ ٱلْفَلَقِ",
        "Qul a'udhu bi-rabbi al-falaq",
        "Say: I seek refuge with the Lord of the daybreak,",
      ),
      L("مِنْ شَرِّ مَا خَلَقَ", "Min sharri ma khalaq", "from the harm of what He created,"),
      L(
        "وَمِنْ شَرِّ غَاسِقٍ إِذَا وَقَبَ",
        "Wa-min sharri ghasiqin idha waqab",
        "and from the harm of the darkness when it settles,",
      ),
      L(
        "وَمِنْ شَرِّ ٱلنَّفَّاثَاتِ فِي ٱلْعُقَدِ",
        "Wa-min sharri an-naffathati fi al-'uqad",
        "and from the harm of those who blow on knots,",
      ),
      L(
        "وَمِنْ شَرِّ حَاسِدٍ إِذَا حَسَدَ",
        "Wa-min sharri hasidin idha hasad",
        "and from the harm of an envier when he envies.",
      ),
    ]),
    nas: T("An-Nas", "An-Nas 114:1-6", [
      L(
        "قُلْ أَعُوذُ بِرَبِّ ٱلنَّاسِ",
        "Qul a'udhu bi-rabbi an-nas",
        "Say: I seek refuge with the Lord of people,",
      ),
      L("مَلِكِ ٱلنَّاسِ", "Maliki an-nas", "the King of people,"),
      L("إِلَٰهِ ٱلنَّاسِ", "Ilahi an-nas", "the God of people,"),
      L(
        "مِنْ شَرِّ ٱلْوَسْوَاسِ ٱلْخَنَّاسِ",
        "Min sharri al-waswasi al-khannas",
        "from the harm of the sneaky whisperer,",
      ),
      L(
        "ٱلَّذِي يُوَسْوِسُ فِي صُدُورِ ٱلنَّاسِ",
        "Alladhi yuwaswisu fi suduri an-nas",
        "who whispers in people's hearts,",
      ),
      L("مِنَ ٱلْجِنَّةِ وَٱلنَّاسِ", "Mina al-jinnati wa-an-nas", "from among jinn and people."),
    ]),
    kawthar: T("Al-Kawthar", "Al-Kawthar 108:1-3", [
      L(
        "إِنَّا أَعْطَيْنَاكَ ٱلْكَوْثَرَ",
        "Inna a'taynaka al-kawthar",
        "We have truly given you abundant good.",
      ),
      L(
        "فَصَلِّ لِرَبِّكَ وَٱنْحَرْ",
        "Fa-salli li-rabbika wa-nhar",
        "So pray to your Lord and give an offering.",
      ),
      L(
        "إِنَّ شَانِئَكَ هُوَ ٱلْأَبْتَرُ",
        "Inna shani'aka huwa al-abtar",
        "Truly, the one who hates you is the one cut off.",
      ),
    ]),
    ruku: T("Ruku' (bowing)", "Dhikr of ruku'", [
      L(
        "سُبْحَانَ رَبِّيَ ٱلْعَظِيمِ وَبِحَمْدِهِ",
        "Subhana rabbiya al-'azimi wa-bihamdih",
        "Glory be to my Lord, the Most Great, and praise be to Him. (3 times)",
      ),
    ]),
    itidal: T("I'tidal (standing up)", "Dhikr of i'tidal", [
      L(
        "سَمِعَ ٱللَّٰهُ لِمَنْ حَمِدَهُ",
        "Sami'a Allahu liman hamidah",
        "Allah hears whoever praises Him.",
      ),
      L("رَبَّنَا لَكَ ٱلْحَمْدُ", "Rabbana laka al-hamd", "Our Lord, all praise is for You."),
    ]),
    qunut: T("Doa qunut (Subuh)", "Doa qunut, Shafi'i practice for Subuh", [
      L(
        "ٱللَّٰهُمَّ ٱهْدِنِي فِيمَنْ هَدَيْتَ",
        "Allahumma hdini fiman hadayt",
        "O Allah, guide me among those You have guided,",
      ),
      L(
        "وَعَافِنِي فِيمَنْ عَافَيْتَ",
        "Wa-'afini fiman 'afayt",
        "keep me well among those You have kept well,",
      ),
      L(
        "وَتَوَلَّنِي فِيمَنْ تَوَلَّيْتَ",
        "Wa-tawallani fiman tawallayt",
        "look after me among those You look after,",
      ),
      L(
        "وَبَارِكْ لِي فِيمَا أَعْطَيْتَ",
        "Wa-barik li fima a'tayt",
        "bless me in what You have given,",
      ),
      L(
        "وَقِنِي شَرَّ مَا قَضَيْتَ",
        "Wa-qini sharra ma qadayt",
        "and protect me from the harm of what You decreed.",
      ),
      L(
        "فَإِنَّكَ تَقْضِي وَلَا يُقْضَىٰ عَلَيْكَ",
        "Fa-innaka taqdi wa-la yuqda 'alayk",
        "You decide, and nothing is decided over You.",
      ),
      L(
        "وَإِنَّهُ لَا يَذِلُّ مَنْ وَالَيْتَ",
        "Wa-innahu la yadhillu man walayt",
        "The one You support is never put down,",
      ),
      L(
        "وَلَا يَعِزُّ مَنْ عَادَيْتَ",
        "Wa-la ya'izzu man 'adayt",
        "and the one You oppose is never mighty.",
      ),
      L(
        "تَبَارَكْتَ رَبَّنَا وَتَعَالَيْتَ",
        "Tabarakta rabbana wa-ta'alayt",
        "Blessed and exalted are You, our Lord.",
      ),
    ]),
    sujud: T("Sujud (prostration)", "Dhikr of sujud", [
      L(
        "سُبْحَانَ رَبِّيَ ٱلْأَعْلَىٰ وَبِحَمْدِهِ",
        "Subhana rabbiya al-a'la wa-bihamdih",
        "Glory be to my Lord, the Most High, and praise be to Him. (3 times)",
      ),
    ]),
    julus: T("Sitting between the two sujud", "Dua between the two prostrations", [
      L(
        "رَبِّ ٱغْفِرْ لِي وَٱرْحَمْنِي وَٱجْبُرْنِي وَٱرْفَعْنِي وَٱرْزُقْنِي وَٱهْدِنِي وَعَافِنِي وَٱعْفُ عَنِّي",
        "Rabbi ghfir li wa-rhamni wa-jburni wa-rfa'ni wa-rzuqni wa-hdini wa-'afini wa-'fu 'anni",
        "My Lord, forgive me, have mercy on me, mend me, raise me, provide for me, guide me, keep me well and pardon me.",
      ),
    ]),
    tashahhud: T("Tasyahud (tashahhud)", "At-tashahhud, from Ibn 'Abbas (Sahih Muslim)", [
      L(
        "ٱلتَّحِيَّاتُ ٱلْمُبَارَكَاتُ ٱلصَّلَوَاتُ ٱلطَّيِّبَاتُ لِلَّٰهِ",
        "At-tahiyyatu al-mubarakatu as-salawatu at-tayyibatu lillah",
        "All blessed greetings, prayers and good things are for Allah.",
      ),
      L(
        "ٱلسَّلَامُ عَلَيْكَ أَيُّهَا ٱلنَّبِيُّ وَرَحْمَةُ ٱللَّٰهِ وَبَرَكَاتُهُ",
        "As-salamu 'alayka ayyuha an-nabiyyu wa-rahmatu llahi wa-barakatuh",
        "Peace be upon you, O Prophet, and Allah's mercy and blessings.",
      ),
      L(
        "ٱلسَّلَامُ عَلَيْنَا وَعَلَىٰ عِبَادِ ٱللَّٰهِ ٱلصَّالِحِينَ",
        "As-salamu 'alayna wa-'ala 'ibadi llahi as-salihin",
        "Peace be upon us and upon Allah's righteous servants.",
      ),
      L(
        "أَشْهَدُ أَنْ لَا إِلَٰهَ إِلَّا ٱللَّٰهُ",
        "Ashhadu an la ilaha illa llah",
        "I bear witness that there is no god but Allah,",
      ),
      L(
        "وَأَشْهَدُ أَنَّ مُحَمَّدًا رَسُولُ ٱللَّٰهِ",
        "Wa-ashhadu anna Muhammadan rasulu llah",
        "and I bear witness that Muhammad is the Messenger of Allah.",
      ),
    ]),
    salawat: T("Salawat on the Prophet", "As-salawat al-Ibrahimiyyah (Sahih al-Bukhari)", [
      L(
        "ٱللَّٰهُمَّ صَلِّ عَلَىٰ مُحَمَّدٍ وَعَلَىٰ آلِ مُحَمَّدٍ",
        "Allahumma salli 'ala Muhammadin wa-'ala ali Muhammad",
        "O Allah, send blessings upon Muhammad and upon his family,",
      ),
      L(
        "كَمَا صَلَّيْتَ عَلَىٰ إِبْرَاهِيمَ وَعَلَىٰ آلِ إِبْرَاهِيمَ",
        "Kama sallayta 'ala Ibrahima wa-'ala ali Ibrahim",
        "as You sent blessings upon Ibrahim and upon the family of Ibrahim.",
      ),
      L(
        "وَبَارِكْ عَلَىٰ مُحَمَّدٍ وَعَلَىٰ آلِ مُحَمَّدٍ",
        "Wa-barik 'ala Muhammadin wa-'ala ali Muhammad",
        "And bless Muhammad and the family of Muhammad,",
      ),
      L(
        "كَمَا بَارَكْتَ عَلَىٰ إِبْرَاهِيمَ وَعَلَىٰ آلِ إِبْرَاهِيمَ",
        "Kama barakta 'ala Ibrahima wa-'ala ali Ibrahim",
        "as You blessed Ibrahim and the family of Ibrahim.",
      ),
      L(
        "فِي ٱلْعَالَمِينَ إِنَّكَ حَمِيدٌ مَجِيدٌ",
        "Fi al-'alamina innaka hamidun majid",
        "In all the worlds, You are Praiseworthy and Glorious.",
      ),
    ]),
    salam: T("Salam", "The salam that ends the prayer", [
      L(
        "ٱلسَّلَامُ عَلَيْكُمْ وَرَحْمَةُ ٱللَّٰهِ",
        "As-salamu 'alaykum wa-rahmatu llah",
        "Peace and Allah's mercy be upon you.",
      ),
    ]),

    /* ------------------------------ wudu and eating ------------------------------ */
    wuduNiyyah: T("Niat for wudu", "Niat of wudu (said in the heart, Shafi'i)", [
      L(
        "نَوَيْتُ ٱلْوُضُوءَ لِرَفْعِ ٱلْحَدَثِ ٱلْأَصْغَرِ فَرْضًا لِلَّٰهِ تَعَالَىٰ",
        "Nawaytu al-wudu'a li-raf'i al-hadathi al-asghari fardan lillahi ta'ala",
        "I intend to do wudu to remove the small impurity, as a duty to Allah the Most High.",
      ),
    ]),
    bismillah: T("Bismillah", "Before starting, and before eating", [
      L("بِسْمِ ٱللَّٰهِ", "Bismi llah", "In the name of Allah."),
    ]),
    wuduDoa: T("Doa after wudu", "Said after wudu (Sahih Muslim)", [
      L(
        "أَشْهَدُ أَنْ لَا إِلَٰهَ إِلَّا ٱللَّٰهُ وَحْدَهُ لَا شَرِيكَ لَهُ",
        "Ashhadu an la ilaha illa llah wahdahu la syarika lah",
        "I bear witness that there is no god but Allah alone, who has no partner,",
      ),
      L(
        "وَأَشْهَدُ أَنَّ مُحَمَّدًا عَبْدُهُ وَرَسُولُهُ",
        "Wa-ashhadu anna Muhammadan 'abduhu wa-rasuluh",
        "and I bear witness that Muhammad is His servant and His Messenger.",
      ),
    ]),
    eatForgot: T("If you forgot Bismillah", "Abu Dawud and at-Tirmidhi", [
      L(
        "بِسْمِ ٱللَّٰهِ أَوَّلَهُ وَآخِرَهُ",
        "Bismi llahi awwalahu wa-akhirah",
        "In the name of Allah, at its beginning and at its end.",
      ),
    ]),
    eatAfter: T("Alhamdulillah after eating", "Abu Dawud and at-Tirmidhi", [
      L(
        "ٱلْحَمْدُ لِلَّٰهِ ٱلَّذِي أَطْعَمَنَا وَسَقَانَا وَجَعَلَنَا مُسْلِمِينَ",
        "Alhamdu lillahi alladhi at'amana wa-saqana wa-ja'alana muslimin",
        "All praise is for Allah, who fed us, gave us drink and made us Muslims.",
      ),
    ]),

    /* ------------------------------ Umrah and Hajj ------------------------------ */
    niyyahUmrah: T("Niyyah for Umrah", "Niyyah of ihram for Umrah", [
      L(
        "نَوَيْتُ ٱلْعُمْرَةَ وَأَحْرَمْتُ بِهَا لِلَّٰهِ تَعَالَىٰ",
        "Nawaytu al-'umrata wa-ahramtu biha lillahi ta'ala",
        "I intend Umrah and I enter ihram for it, for Allah the Most High.",
      ),
      L(
        "لَبَّيْكَ ٱللَّٰهُمَّ عُمْرَةً",
        "Labbayka Allahumma 'umrah",
        "Here I am, O Allah, for Umrah.",
      ),
    ]),
    niyyahHajj: T("Niyyah for Hajj", "Niyyah of ihram for Hajj", [
      L(
        "نَوَيْتُ ٱلْحَجَّ وَأَحْرَمْتُ بِهِ لِلَّٰهِ تَعَالَىٰ",
        "Nawaytu al-hajja wa-ahramtu bihi lillahi ta'ala",
        "I intend Hajj and I enter ihram for it, for Allah the Most High.",
      ),
      L(
        "لَبَّيْكَ ٱللَّٰهُمَّ حَجًّا",
        "Labbayka Allahumma hajjan",
        "Here I am, O Allah, for Hajj.",
      ),
    ]),
    talbiyah: T("Talbiyah", "The talbiyah of the Prophet (Sahih al-Bukhari and Muslim)", [
      L(
        "لَبَّيْكَ ٱللَّٰهُمَّ لَبَّيْكَ",
        "Labbayka Allahumma labbayk",
        "Here I am, O Allah, here I am.",
      ),
      L(
        "لَبَّيْكَ لَا شَرِيكَ لَكَ لَبَّيْكَ",
        "Labbayka la sharika laka labbayk",
        "Here I am, You have no partner, here I am.",
      ),
      L(
        "إِنَّ ٱلْحَمْدَ وَٱلنِّعْمَةَ لَكَ وَٱلْمُلْكَ",
        "Inna al-hamda wa-an-ni'mata laka wa-al-mulk",
        "Truly all praise, all favour and all kingdom are Yours.",
      ),
      L("لَا شَرِيكَ لَكَ", "La sharika lak", "You have no partner."),
    ]),
    enterHaram: T("Dua entering the mosque", "Dua for entering a mosque (Muslim, Abu Dawud)", [
      L(
        "بِسْمِ ٱللَّٰهِ وَٱلصَّلَاةُ وَٱلسَّلَامُ عَلَىٰ رَسُولِ ٱللَّٰهِ",
        "Bismi llahi wa-as-salatu wa-as-salamu 'ala rasuli llah",
        "In the name of Allah, and blessings and peace on the Messenger of Allah.",
      ),
      L(
        "ٱللَّٰهُمَّ ٱفْتَحْ لِي أَبْوَابَ رَحْمَتِكَ",
        "Allahumma ftah li abwaba rahmatik",
        "O Allah, open for me the doors of Your mercy.",
      ),
    ]),
    istilam: T("At the Black Stone", "Takbir at the Black Stone (Sahih al-Bukhari)", [
      L(
        "بِسْمِ ٱللَّٰهِ ٱللَّٰهُ أَكْبَرُ",
        "Bismi llahi Allahu akbar",
        "In the name of Allah, Allah is the Greatest.",
      ),
    ]),
    yemeni: T("Between the Yemeni corner and the Black Stone", "Al-Baqarah 2:201", [
      L(
        "رَبَّنَا آتِنَا فِي ٱلدُّنْيَا حَسَنَةً وَفِي ٱلْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ ٱلنَّارِ",
        "Rabbana atina fi ad-dunya hasanatan wa-fi al-akhirati hasanatan wa-qina 'adhaba an-nar",
        "Our Lord, give us good in this world and good in the next, and protect us from the Fire.",
      ),
    ]),
    maqam: T("At Maqam Ibrahim", "Al-Baqarah 2:125", [
      L(
        "وَٱتَّخِذُوا مِنْ مَقَامِ إِبْرَاهِيمَ مُصَلًّى",
        "Wa-ttakhidhu min maqami Ibrahima musalla",
        "And take the standing-place of Ibrahim as a place of prayer.",
      ),
    ]),
    zamzam: T("Dua with Zamzam", "A popular dua when drinking Zamzam", [
      L(
        "ٱللَّٰهُمَّ إِنِّي أَسْأَلُكَ عِلْمًا نَافِعًا وَرِزْقًا وَاسِعًا وَشِفَاءً مِنْ كُلِّ دَاءٍ",
        "Allahumma inni as'aluka 'ilman nafi'an wa-rizqan wasi'an wa-shifa'an min kulli da'",
        "O Allah, I ask You for useful knowledge, wide provision and healing from every illness.",
      ),
    ]),
    safa: T("Going up Safa", "Al-Baqarah 2:158 (Sahih Muslim, Jabir)", [
      L(
        "إِنَّ ٱلصَّفَا وَٱلْمَرْوَةَ مِنْ شَعَائِرِ ٱللَّٰهِ",
        "Inna as-safa wa-al-marwata min sha'a'iri llah",
        "Truly Safa and Marwa are among the signs of Allah.",
      ),
      L(
        "أَبْدَأُ بِمَا بَدَأَ ٱللَّٰهُ بِهِ",
        "Abda'u bima bada'a llahu bih",
        "I begin with what Allah began with.",
      ),
    ]),
    tahlil: T("Dua on Safa and Marwa", "The tahlil of the Prophet (Sahih Muslim)", [
      L(
        "لَا إِلَٰهَ إِلَّا ٱللَّٰهُ وَحْدَهُ لَا شَرِيكَ لَهُ",
        "La ilaha illa llahu wahdahu la sharika lah",
        "There is no god but Allah alone, who has no partner.",
      ),
      L(
        "لَهُ ٱلْمُلْكُ وَلَهُ ٱلْحَمْدُ وَهُوَ عَلَىٰ كُلِّ شَيْءٍ قَدِيرٌ",
        "Lahu al-mulku wa-lahu al-hamdu wa-huwa 'ala kulli shay'in qadir",
        "His is the kingdom, His is the praise, and He has power over everything.",
      ),
      L(
        "لَا إِلَٰهَ إِلَّا ٱللَّٰهُ وَحْدَهُ",
        "La ilaha illa llahu wahdah",
        "There is no god but Allah alone.",
      ),
      L(
        "أَنْجَزَ وَعْدَهُ وَنَصَرَ عَبْدَهُ وَهَزَمَ ٱلْأَحْزَابَ وَحْدَهُ",
        "Anjaza wa'dahu wa-nasara 'abdahu wa-hazama al-ahzaba wahdah",
        "He kept His promise, helped His servant and defeated the armies by Himself.",
      ),
    ]),
    arafah: T("Dua on the Day of Arafah", "The best dua (at-Tirmidhi)", [
      L(
        "لَا إِلَٰهَ إِلَّا ٱللَّٰهُ وَحْدَهُ لَا شَرِيكَ لَهُ",
        "La ilaha illa llahu wahdahu la sharika lah",
        "There is no god but Allah alone, who has no partner.",
      ),
      L(
        "لَهُ ٱلْمُلْكُ وَلَهُ ٱلْحَمْدُ وَهُوَ عَلَىٰ كُلِّ شَيْءٍ قَدِيرٌ",
        "Lahu al-mulku wa-lahu al-hamdu wa-huwa 'ala kulli shay'in qadir",
        "His is the kingdom, His is the praise, and He has power over everything.",
      ),
    ]),

    /* ------------------------------ Ziarah (visiting Madinah) ------------------------------ */
    salamProphet: T("Salam to the Prophet", "Greeting the Prophet (peace be upon him)", [
      L(
        "ٱلسَّلَامُ عَلَيْكَ يَا رَسُولَ ٱللَّٰهِ",
        "As-salamu 'alayka ya rasula llah",
        "Peace be upon you, O Messenger of Allah.",
      ),
    ]),
    graveyard: T("Salam to those who passed away", "Greeting the graveyard (Sahih Muslim)", [
      L(
        "ٱلسَّلَامُ عَلَيْكُمْ أَهْلَ ٱلدِّيَارِ مِنَ ٱلْمُؤْمِنِينَ وَٱلْمُسْلِمِينَ",
        "As-salamu 'alaykum ahla ad-diyari mina al-mu'minina wa-al-muslimin",
        "Peace be upon you, people of these homes, believers and Muslims.",
      ),
      L(
        "وَإِنَّا إِنْ شَاءَ ٱللَّٰهُ بِكُمْ لَلَاحِقُونَ",
        "Wa-inna in sha'a llahu bikum lalahiqun",
        "And, if Allah wills, we will join you.",
      ),
      L(
        "نَسْأَلُ ٱللَّٰهَ لَنَا وَلَكُمُ ٱلْعَافِيَةَ",
        "Nas'alu llaha lana wa-lakumu al-'afiyah",
        "We ask Allah for well-being for us and for you.",
      ),
    ]),
  };

  KQ.RITUAL_TEXT = Object.freeze(TEXT);
})(
  ((typeof window !== "undefined" ? window : globalThis).KQ =
    (typeof window !== "undefined" ? window : globalThis).KQ || {}),
);
