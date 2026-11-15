/* Lock In: past-paper question bank. Each Paper I MCQ tagged with the Library unit it tests (CLASSES unit keys).
   Read question by question from the papers in "App files/<Subject>/Past papers" (16 Nov 2026).
   A question that tests two units is tagged with the main one. Untagged numbers were unreadable in the copy we have. */
window.QBANK={
  chem:{
    /* 2026 Paper I, all 50 */
    '2026':{1:'atom',2:'atom',3:'atom',4:'pblock',5:'kin',6:'sblock',7:'org',8:'equil',9:'org',10:'equil',
            11:'calc',12:'pblock',13:'ener',14:'equil',15:'org',16:'ener',17:'kin',18:'ener',19:'pblock',20:'org',
            21:'ener',22:'echem',23:'org',24:'kin',25:'equil',26:'equil',27:'isom',28:'equil',29:'calc',30:'calc',
            31:'echem',32:'org',33:'ind',34:'pblock',35:'echem',36:'org',37:'ind',38:'gas',39:'ind',40:'pblock',
            41:'org',42:'org',43:'ener',44:'ind',45:'bond',46:'equil',47:'equil',48:'isom',49:'ind',50:'pblock'},
    /* 2025 Paper I, all 50 */
    '2025':{1:'atom',2:'atom',3:'bond',4:'bond',5:'equil',6:'atom',7:'org',8:'calc',9:'org',10:'kin',
            11:'bond',12:'calc',13:'ener',14:'equil',15:'org',16:'kin',17:'equil',18:'ener',19:'dblock',20:'org',
            21:'ener',22:'echem',23:'org',24:'equil',25:'echem',26:'echem',27:'org',28:'calc',29:'equil',30:'equil',
            31:'org',32:'equil',33:'ind',34:'sblock',35:'org',36:'equil',37:'ind',38:'ener',39:'pblock',40:'ind',
            41:'atom',42:'org',43:'equil',44:'bond',45:'ind',46:'ener',47:'org',48:'equil',49:'ind',50:'pblock'},
    /* 2023 Paper I (sat 2024), all 50 */
    '2023':{1:'atom',2:'atom',3:'sblock',4:'bond',5:'org',6:'equil',7:'period',8:'bond',9:'org',10:'kin',
            11:'pblock',12:'equil',13:'org',14:'calc',15:'gas',16:'equil',17:'equil',18:'ener',19:'ener',20:'org',
            21:'equil',22:'org',23:'ener',24:'gas',25:'kin',26:'redox',27:'org',28:'echem',29:'calc',30:'equil',
            31:'kin',32:'org',33:'equil',34:'pblock',35:'org',36:'dblock',37:'ind',38:'equil',39:'ind',40:'ind',
            41:'pblock',42:'bond',43:'gas',44:'dblock',45:'org',46:'echem',47:'ind',48:'equil',49:'ind',50:'ind'},
    /* 2022 Paper I (sat 2023), all 50 */
    '2022':{1:'atom',2:'atom',3:'period',4:'bond',5:'org',6:'equil',7:'period',8:'isom',9:'bond',10:'org',
            11:'equil',12:'kin',13:'calc',14:'equil',15:'equil',16:'pblock',17:'equil',18:'ener',19:'echem',20:'org',
            21:'gas',22:'gas',23:'ener',24:'org',25:'equil',26:'calc',27:'calc',28:'echem',29:'org',30:'equil',
            31:'kin',32:'org',33:'equil',34:'dblock',35:'org',36:'pblock',37:'ind',38:'equil',39:'ind',40:'ind',
            41:'pblock',42:'pblock',43:'pblock',44:'org',45:'org',46:'equil',47:'ind',48:'kin',49:'ind',50:'ind'},
    /* 2021 Paper I (sat 2022), all 50 */
    '2021':{1:'atom',2:'atom',3:'period',4:'bond',5:'org',6:'bond',7:'equil',8:'bond',9:'org',10:'kin',
            11:'org',12:'calc',13:'kin',14:'kin',15:'equil',16:'org',17:'equil',18:'calc',19:'ener',20:'org',
            21:'gas',22:'calc',23:'gas',24:'equil',25:'ind',26:'sblock',27:'redox',28:'equil',29:'dblock',30:'org',
            31:'org',32:'ind',33:'echem',34:'org',35:'echem',36:'ind',37:'bond',38:'gas',39:'equil',40:'ind',
            41:'redox',42:'ener',43:'pblock',44:'kin',45:'org',46:'org',47:'ind',48:'org',49:'equil',50:'ind'},
    /* 2020 Paper I, all 50 */
    '2020':{1:'atom',2:'atom',3:'atom',4:'bond',5:'org',6:'period',7:'gas',8:'redox',9:'org',10:'equil',
            11:'bond',12:'bond',13:'ener',14:'calc',15:'equil',16:'org',17:'ener',18:'atom',19:'echem',20:'org',
            21:'ener',22:'period',23:'equil',24:'calc',25:'equil',26:'echem',27:'equil',28:'kin',29:'kin',30:'org',
            31:'dblock',32:'bond',33:'equil',34:'org',35:'equil',36:'ind',37:'pblock',38:'echem',39:'gas',40:'ind',
            41:'dblock',42:'equil',43:'equil',44:'gas',45:'isom',46:'org',47:'ind',48:'org',49:'kin',50:'ind'},
    /* 2019 Paper I, all 50 */
    '2019':{1:'atom',2:'atom',3:'bond',4:'org',5:'period',6:'bond',7:'org',8:'calc',9:'gas',10:'equil',
            11:'bond',12:'equil',13:'org',14:'pblock',15:'echem',16:'ener',17:'org',18:'gas',19:'kin',20:'org',
            21:'equil',22:'equil',23:'pblock',24:'calc',25:'calc',26:'ener',27:'kin',28:'equil',29:'ind',30:'ener',
            31:'pblock',32:'org',33:'ener',34:'equil',35:'org',36:'ind',37:'dblock',38:'equil',39:'equil',40:'isom',
            41:'pblock',42:'ener',43:'ind',44:'ener',45:'org',46:'org',47:'ind',48:'bond',49:'gas',50:'ind'},
    /* 2024 Paper I: the copy is a watermarked scan; Q9-12, 25, 31, 32 and 34-50 could not be read reliably, so they are left out */
    '2024':{1:'bond',2:'atom',3:'atom',4:'atom',5:'org',6:'equil',7:'bond',8:'bond',13:'equil',14:'org',
            15:'redox',16:'kin',17:'ener',18:'ener',19:'equil',20:'ener',21:'org',22:'kin',23:'org',24:'gas',
            26:'equil',27:'calc',28:'org',29:'calc',30:'equil',33:'org'}
  },
  phy:{
    /* 2026 Paper I, all 50 (Q1, Q2 Measurement: no Library card). All 50 checked. */
    '2026':{1:'meas',2:'meas',3:'mech',4:'wave',5:'wave',6:'matter',7:'wave',8:'cur',9:'mech',10:'estat',
            11:'light',12:'light',13:'matter',14:'mech',15:'wave',16:'light',17:'mech',18:'therm',19:'mech',20:'cur',
            21:'wave',22:'mech',23:'mech',24:'therm',25:'light',26:'mech',27:'mprop',28:'therm',29:'elec',30:'mech',
            31:'therm',32:'mech',33:'grav',34:'mag',35:'mag',36:'mprop',37:'elec',38:'cur',39:'elec',40:'matter',
            41:'wave',42:'therm',43:'estat',44:'estat',45:'mag',46:'mprop',47:'wave',48:'therm',49:'cur',50:'mag'}
  },
  src:'Chemistry 2019-2023, 2025, 2026: all 50 read question by question. 2024: watermarked scan, 26 of 50. Physics 2026: all 50. A question that tests two units is tagged with the main one.'
};
