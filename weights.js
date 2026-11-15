/* Lock In: exam weighting per unit, counted from real past papers (saved 15 Nov 2026).
   Sources: his "exam-weights" docs (Maths 2022/2024/2025 Pure+Applied, Chemistry Paper II 2022 Part A + 2025 Parts B/C)
   and papers read here (Physics 2026 Paper I, Chemistry Paper I MCQs via qbank.js).
   Chemistry Paper I shares are not stored here: weightChemMCQ() counts them live from window.QBANK. */
window.WEIGHTS={
  phy:{
    src:'2026 Paper I only (50 MCQs). One paper: weak evidence. Paper II not read yet.',
    years:['2026'],
    /* share of Paper I; q = 2026 Paper I question numbers */
    units:{
      mech:{pct:20,q:[3,9,14,17,19,22,23,26,30,32]},
      therm:{pct:12,q:[18,24,28,31,42,48]},
      wave:{pct:14,q:[4,5,7,15,21,41,47]},
      cur:{pct:8,q:[8,20,38,49]},
      light:{pct:8,q:[11,12,16,25]},
      mag:{pct:8,q:[34,35,45,50]},
      estat:{pct:6,q:[10,43,44]},
      elec:{pct:6,q:[29,37,39]},
      matter:{pct:6,q:[6,13,40]},
      mprop:{pct:6,q:[27,36,46]},
      meas:{pct:4,q:[1,2]},
      grav:{pct:2,q:[33]}
    }
  },
  maths:{
    src:'Paper structure from 2022, 2024, 2025 Pure and Applied (same every year). Each paper 1000 marks: Part A 10×25, Part B 5 of 7 ×150.',
    /* blueprint topic (Sinhala, as in BP) -> exam question; mk = blueprint marks */
    q:{
      'මාපාංක ශ්‍රිත':['Pure A2',25],'ගෝල ගැටුම්':['Applied A1',25],'ද්විපද ප්‍රසාරණය':['Pure A4',25],'ප්‍රක්ෂිප්ත':['Applied A2',25],
      'ගණිත අභ්‍යුහන මූලධර්මය':['Pure A1',25],'චලිත ප්‍රස්තාර':['Applied B11a',60],'සාපේක්ෂ ප්‍රවේගය':['Applied B11b',90],
      'වර්ගජ සමීකරණ':['Pure B11',90],'බහුපද ශ්‍රිත':['Pure B11',60],'කාර්යය සහ ශක්තිය':['Applied A4',25],'ජවය':['Applied A4',25],
      'බල සමතුලිතතාවය':['Applied A7',25],'ඝර්ෂණය':['Applied A8',25],'සංකරණ සහ සංයෝජන':['Pure B12a',60],'ශ්‍රේණි':['Pure B12b',90],
      'දෛශික':['Applied A6 + B14a',85],'ඒකතල බල පද්ධති':['Applied B14b',90],'න්‍යාස':['Pure B13a',60],'සංකීර්ණ සංඛ්‍යා':['Pure A3 + B13',115],
      'ත්‍රිකෝණමිතිය':['Pure A10 + B17',175],'සීමාව':['Pure A5',25],'අවකලනය':['Pure A7',25],'අවකලනයේ භාවිත':['Pure B14',150],
      'ස්කන්ධ කේන්ද්‍රය':['Applied B16',150],'තිරස් වෘත්ත චලිතය':['Applied A5',25],'සිරස් වෘත්ත චලිතය':['Applied B12b',60],
      'සාපේක්ෂ ත්වරණය':['Applied A3 + B12a',115],'අනුකලනය':['Pure B15',150],'අනුකලනයේ භාවිත':['Pure A6',25],
      'සම්භාවිතාව':['Applied A9 + B17a',85],'සංඛ්‍යානය':['Applied A10 + B17b',115],'සරල රේඛාව':['Pure A8 + B16',100],'වෘත්තය':['Pure A9 + B16',100],
      'සන්ධි කළ දඬු':['Applied B15a',80],'රාමු සැකිලි':['Applied B15b',70],'සරල අනුවර්තීය චලිතය':['Applied B13',150]
    },
    safeB:['Applied B13 SHM','Applied B15 Rods/Frameworks','Applied B16 Centre of mass','Applied B17 Probability/Statistics','Pure B15 Integration']
  },
  chem:{
    src:'Paper II from 2022 Part A and 2025 Parts B, C. Paper I counted from qbank.js.',
    /* Paper I analysis (15 Nov 2026), 7 complete years 2019-2023, 2025, 2026 (2024 left out: only 26/50 readable).
       g = units grouped where single-unit tags are noisy; y = MCQs per year in order 2019,2020,2021,2022,2023,2025,2026;
       mean, sd = MCQs per year; days = class days in the plan; perDay = mean MCQs per class day (yield).
       Test: predicting 2026 from the 2019-2025 average missed by 1.05 MCQs per unit (blind guess: 2.17). */
    p1:{
      echem:{g:['echem'],y:[1,3,2,2,2,3,3],mean:2.3,sd:0.7,days:2,perDay:1.14},
      ener:{g:['ener','enerx'],y:[6,3,2,2,3,5,5],mean:3.7,sd:1.5,days:4,perDay:0.93},
      equil:{g:['equil','equilx'],y:[8,9,7,10,9,10,8],mean:8.7,sd:1.0,days:13,perDay:0.67},
      ind:{g:['ind'],y:[5,4,6,6,6,5,5],mean:5.3,sd:0.7,days:9,perDay:0.59},
      kin:{g:['kin'],y:[2,3,4,3,3,2,3],mean:2.9,sd:0.6,days:5,perDay:0.57},
      org:{g:['org','isom','guna','orgx'],y:[10,9,11,10,9,10,11],mean:10.0,sd:0.8,days:18,perDay:0.56},
      gas:{g:['gas','gasx'],y:[3,3,3,2,3,0,1],mean:2.1,sd:1.1,days:4,perDay:0.54},
      inorg:{g:['atom','bond','period','sblock','pblock','dblock','dblockx'],y:[12,13,10,12,12,12,11],mean:11.7,sd:0.9,days:28,perDay:0.42},
      calc:{g:['calc','calcx','redox'],y:[3,3,5,3,3,3,3],mean:3.3,sd:0.7,days:8,perDay:0.41}
    },
    p1Note:'Paper I only. Inorganic has a compulsory 100 marks in Paper II Q2, so low Paper I yield is not a reason to cut it. Single-unit splits inside a group (e.g. bond vs pblock) are noisy; trust the groups.',
    /* Paper II: question -> marks, compulsory?, units */
    p2:{
      Q1:[100,1,['atom','bond','period']],Q2:[100,1,['sblock','pblock','dblock']],Q3:[100,1,['gas','kin']],Q4:[100,1,['org','isom']],
      Q5:[150,0,['equil','ener']],Q6:[150,0,['kin','gas','equil']],Q7:[150,0,['echem','dblock']],
      Q8:[150,0,['org','guna']],Q9:[150,0,['sblock','pblock','dblock','calc','redox']],Q10:[150,0,['ind']]
    }
  }
};
/* Chemistry Paper I: share of MCQs per unit across every tagged year in qbank.js */
function weightChemMCQ(){const Q=(window.QBANK||{}).chem||{},n={};let t=0;
  for(const y in Q)for(const k in Q[y]){const u=Q[y][k];n[u]=(n[u]||0)+1;t++}
  const out={};for(const u in n)out[u]={n:n[u],pct:Math.round(n[u]/t*1000)/10};return {total:t,years:Object.keys(Q).sort(),units:out}}
