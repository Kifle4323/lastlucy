import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
const prisma = new PrismaClient();

async function main() {
  const adminPw = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({ where:{email:'admin@lucy.edu'}, update:{}, create:{email:'admin@lucy.edu',passwordHash:adminPw,fullName:'System Admin',role:'ADMIN',isApproved:true,isProfileComplete:true} });
  const teacherPw = await bcrypt.hash('teacher123', 10);
  const teacher = await prisma.user.upsert({ where:{email:'teacher@lucy.edu'}, update:{}, create:{email:'teacher@lucy.edu',passwordHash:teacherPw,fullName:'Alemayehu Gebremeskel',role:'TEACHER',isApproved:true,isProfileComplete:true} });
  const studentPw = await bcrypt.hash('student123', 10);
  await prisma.user.upsert({ where:{email:'student@lucy.edu'}, update:{}, create:{email:'student@lucy.edu',passwordHash:studentPw,fullName:'Abebe Kebede Tadesse',phone:'+251911001001',role:'STUDENT',isApproved:true,isProfileComplete:true} });
  console.log('Created admin, teacher, student');

  // 100 Ethiopian students
  const N = [['Abebe','Kebede','Tadesse','አበበ','ከበደ','ታደሰ','MALE','Addis Ababa'],['Tigist','Haile','Gebre','ትግስት','ሃይሌ','ገብረ','FEMALE','Addis Ababa'],['Dawit','Assefa','Mekonnen','ዳዊት','አሰፋ','መኮንን','MALE','Dire Dawa'],['Helen','Bekele','Ayele','ሄለን','በቀሌ','አየለ','FEMALE','Bahir Dar'],['Yonas','Demeke','Wolde','ዮናስ','ደመቀ','ወልደ','MALE','Hawassa'],['Sara','Tafesse','Kassa','ሳራ','ታፈሰ','ካሳ','FEMALE','Mekelle'],['Solomon','Gebremedhin','Berhe','ሰሎሞን','ገብረመድኅን','በርሀ','MALE','Gondar'],['Meron','Fikadu','Teshome','ሜሮን','ፍቃዱ','ተሾመ','FEMALE','Jimma'],['Bereket','Amare','Gebeyehu','በረከት','አማረ','ገበየሁ','MALE','Adama'],['Hiwot','Worku','Alemu','ሕወት','ወርቁ','አለሙ','FEMALE','Dessie'],['Natnael','Tesfaye','Girma','ናትናኤል','ተስፋዬ','ግርማ','MALE','Harar'],['Feven','Hailu','Mengistu','ፌቬን','ሃይሉ','መንግስት','FEMALE','Addis Ababa'],['Abel','Moges','Abebe','አቤል','ሞገስ','አበበ','MALE','Nekemte'],['Betty','Shiferaw','Negash','ቤቲ','ሽፈራው','ነጋሽ','FEMALE','Arba Minch'],['Eyob','Tadesse','Kebede','ኢዮብ','ታደሰ','ከበደ','MALE','Debre Berhan'],['Selamawit','Gebre','Selassie','ሰላማዊት','ገብረ','ስላሴ','FEMALE','Axum'],['Samuel','Alemu','Dinku','ሳሙኤል','አለሙ','ዲንቁ','MALE','Wolkite'],['Hana','Wolde','Mariam','ሃና','ወልደ','ማርያም','FEMALE','Debre Markos'],['Yared','Mulugeta','Ayalew','ያሬድ','ሙሉጌታ','አያለው','MALE','Ambo'],['Lidya','Girma','Abebe','ሊድያ','ግርማ','አበበ','FEMALE','Shashamane'],['Binyam','Tessema','Worku','ብንያም','ተሠማ','ወርቁ','MALE','Woldia'],['Mekdes','Asfaw','Demissie','መቅደስ','አስፋው','ደሚሴ','FEMALE','Asella'],['Ephrem','Gebregziabher','Hailu','ኤፍሬም','ገብረጽዮን','ሃይሉ','MALE','Adigrat'],['Tsehay','Belete','Gebre','ፀሐይ','በሌተ','ገብረ','FEMALE','Debre Zeit'],['Mikias','Admassu','Yohannes','ሚኪያስ','አድማሱ','ዮሃንስ','MALE','Gambela'],['Rehobot','Fisseha','Gebrekidan','ርሑቦት','ፍሥሐ','ገብረኪዳን','FEMALE','Assosa'],['Yohannes','Mengistu','Lemma','ዮሃንስ','መንግስት','ለማ','MALE','Jijiga'],['Abigail','Tadesse','Kebede','አቢጌል','ታደሰ','ከበደ','FEMALE','Wolayta Sodo'],['Isaias','Woldegebriel','Andargachew','ኢሳይያስ','ወልደገብርኤል','አንዳርጋቸው','MALE','Bale Robe'],['Nardos','Gebremichael','Hagos','ናርዶስ','ገብረሚካኤል','ሃጎስ','FEMALE','Mekele'],['Tewodros','Asmare','Gebremeskel','ቴዎድሮስ','አስማረ','ገብረመስቀል','MALE','Wukro'],['Kidist','Mekonnen','Hailemariam','ቅድስት','መኮንን','ሃይለማርያም','FEMALE','Dilla'],['Abraham','Gebreyesus','Mehari','አብርሃም','ገብረየሱስ','መሃሪ','MALE','Kombolcha'],['Rediet','Alemayehu','Dagne','ረድዮት','አለማየሁ','ዳኘ','FEMALE','Addis Ababa'],['Berehanu','Dibaba','Wolde','በረሃኑ','ዲባባ','ወልደ','MALE','Ambo'],['Elshaday','Teshome','Fikre','ኤልሻዳይ','ተሾመ','ፍቅር','FEMALE','Hosaena'],['Muluken','Gebre','Ezgi','ሙሉቀን','ገብረ','እዝጊ','MALE','Wolkite'],['Tigist','Mengiste','Worku','ትግስት','መንግስተ','ወርቁ','FEMALE','Gondar'],['Amanuel','Hailu','Tafesse','አማኑኤል','ሃይሉ','ታፈሰ','MALE','Debre Tabor'],['Saron','Girma','Ayele','ሳሮን','ግርማ','አየለ','FEMALE','Shashamane'],['Henok','Kebede','Assefa','ሄኖክ','ከበደ','አሰፋ','MALE','Dire Dawa'],['Aster','Wolde','Gebre','አስተር','ወልደ','ገብረ','FEMALE','Bahir Dar'],['Girma','Abebe','Tadesse','ግርማ','አበበ','ታደሰ','MALE','Hawassa'],['Wubit','Demeke','Kassa','ውብት','ደመቀ','ካሳ','FEMALE','Jimma'],['Fikadu','Mekonnen','Berhe','ፍቃዱ','መኮንን','በርሀ','MALE','Mekelle'],['Mastewal','Amare','Gebeyehu','ማስተዋል','አማረ','ገበየሁ','FEMALE','Adama'],['Teshome','Worku','Alemu','ተሾመ','ወርቁ','አለሙ','MALE','Nekemte'],['Helen','Tesfaye','Girma','ሄለን','ተስፋዬ','ግርማ','FEMALE','Harar'],['Asfaw','Moges','Abebe','አስፋው','ሞገስ','አበበ','MALE','Arba Minch'],['Beza','Shiferaw','Negash','ቤዛ','ሽፈራው','ነጋሽ','FEMALE','Debre Berhan'],['Dinku','Alemu','Dinku','ዲንቁ','አለሙ','ዲንቁ','MALE','Axum'],['Eden','Gebre','Selassie','ጤና','ገብረ','ስላሴ','FEMALE','Woldia'],['Moges','Wolde','Mariam','ሞገስ','ወልደ','ማርያም','MALE','Debre Markos'],['Tsion','Mulugeta','Ayalew','ፅዮን','ሙሉጌታ','አያለው','FEMALE','Ambo'],['Asmare','Girma','Abebe','አስማረ','ግርማ','አበበ','MALE','Shashamane'],['Mihret','Tessema','Worku','ምህረት','ተሠማ','ወርቁ','FEMALE','Woldia'],['Zerihun','Asfaw','Demissie','ዘርኣሁን','አስፋው','ደሚሴ','MALE','Asella'],['Alem','Gebregziabher','Hailu','ዓለም','ገብረጽዮን','ሃይሉ','FEMALE','Adigrat'],['Mengistu','Belete','Gebre','መንግስት','በሌተ','ገብረ','MALE','Debre Zeit'],['Frehiwot','Admassu','Yohannes','ፍርሃይወት','አድማሱ','ዮሃንስ','FEMALE','Gambela'],['Lemma','Fisseha','Gebrekidan','ለማ','ፍሥሐ','ገብረኪዳን','MALE','Assosa'],['Marta','Mengistu','Lemma','ማርታ','መንግስት','ለማ','FEMALE','Jijiga'],['Kebede','Tadesse','Kebede','ከበደ','ታደሰ','ከበደ','MALE','Wolayta Sodo'],['Haregwoin','Woldegebriel','Andargachew','ሃረግወይን','ወልደገብርኤል','አንዳርጋቸው','FEMALE','Bale Robe'],['Hagos','Asmare','Gebremeskel','ሃጎስ','አስማረ','ገብረመስቀል','MALE','Wukro'],['Aster','Mekonnen','Hailemariam','አስተር','መኮንን','ሃይለማርያም','FEMALE','Dilla'],['Mehari','Gebreyesus','Mehari','መሃሪ','ገብረየሱስ','መሃሪ','MALE','Kombolcha'],['Dagne','Alemayehu','Dagne','ዳኘ','አለማየሁ','ዳኘ','MALE','Addis Ababa'],['Eleni','Dibaba','Wolde','ኤለኒ','ዲባባ','ወልደ','FEMALE','Ambo'],['Ezgi','Teshome','Fikre','እዝጊ','ተሾመ','ፍቅር','MALE','Hosaena'],['Wubalem','Gebre','Ezgi','ውባለም','ገብረ','እዝጊ','FEMALE','Wolkite'],['Mengiste','Mengiste','Worku','መንግስተ','መንግስተ','ወርቁ','MALE','Gondar'],['Hiwot','Hailu','Tafesse','ሕወት','ሃይሉ','ታፈሰ','FEMALE','Debre Tabor'],['Gebre','Girma','Ayele','ገብረ','ግርማ','አየለ','MALE','Shashamane'],['Tirunesh','Kebede','Assefa','ጥሩነሽ','ከበደ','አሰፋ','FEMALE','Dire Dawa'],['Assefa','Abebe','Tadesse','አሰፋ','አበበ','ታደሰ','MALE','Bahir Dar'],['Ayele','Demeke','Kassa','አየለ','ደመቀ','ካሳ','MALE','Hawassa'],['Worku','Mekonnen','Berhe','ወርቁ','መኮንን','በርሀ','MALE','Jimma'],['Kassa','Amare','Gebeyehu','ካሳ','አማረ','ገበየሁ','MALE','Mekelle'],['Amare','Worku','Alemu','አማረ','ወርቁ','አለሙ','MALE','Adama'],['Gebeyehu','Tesfaye','Girma','ገበየሁ','ተስፋዬ','ግርማ','MALE','Nekemte'],['Alemu','Moges','Abebe','አለሙ','ሞገስ','አበበ','MALE','Harar'],['Shiferaw','Shiferaw','Negash','ሽፈራው','ሽፈራው','ነጋሽ','MALE','Arba Minch'],['Negash','Alemu','Dinku','ነጋሽ','አለሙ','ዲንቁ','MALE','Debre Berhan'],['Selassie','Gebre','Selassie','ስላሴ','ገብረ','ስላሴ','MALE','Axum'],['Wolde','Wolde','Mariam','ወልደ','ወልደ','ማርያም','MALE','Woldia'],['Mariam','Mulugeta','Ayalew','ማርያም','ሙሉጌታ','አያለው','FEMALE','Debre Markos'],['Ayalew','Girma','Abebe','አያለው','ግርማ','አበበ','MALE','Ambo'],['Mulugeta','Tessema','Worku','ሙሉጌታ','ተሠማ','ወርቁ','MALE','Shashamane'],['Tessema','Asfaw','Demissie','ተሠማ','አስፋው','ደሚሴ','MALE','Woldia'],['Demissie','Gebregziabher','Hailu','ደሚሴ','ገብረጽዮን','ሃይሉ','MALE','Asella'],['Gebregziabher','Belete','Gebre','ገብረጽዮን','በሌተ','ገብረ','MALE','Adigrat'],['Belete','Admassu','Yohannes','በሌተ','አድማሱ','ዮሃንስ','MALE','Debre Zeit'],['Admassu','Fisseha','Gebrekidan','አድማሱ','ፍሥሐ','ገብረኪዳን','MALE','Gambela'],['Yohannes','Mengistu','Lemma','ዮሃንስ','መንግስት','ለማ','MALE','Assosa'],['Fisseha','Tadesse','Kebede','ፍሥሐ','ታደሰ','ከበደ','MALE','Jijiga'],['Gebrekidan','Woldegebriel','Andargachew','ገብረኪዳን','ወልደገብርኤል','አንዳርጋቸው','MALE','Wolayta Sodo'],['Andargachew','Asmare','Gebremeskel','አንዳርጋቸው','አስማረ','ገብረመስቀል','MALE','Bale Robe'],['Gebremeskel','Mekonnen','Hailemariam','ገብረመስቀል','መኮንን','ሃይለማርያም','MALE','Wukro'],['Hailemariam','Gebreyesus','Mehari','ሃይለማርያም','ገብረየሱስ','መሃሪ','MALE','Dilla'],['Gebreyesus','Alemayehu','Dagne','ገብረየሱስ','አለማየሁ','ዳኘ','MALE','Kombolcha'],['Alemayehu','Dibaba','Wolde','አለማየሁ','ዲባባ','ወልደ','MALE','Addis Ababa'],['Dibaba','Teshome','Fikre','ዲባባ','ተሾመ','ፍቅር','MALE','Ambo']];

  for (let i = 0; i < N.length; i++) {
    const [fn,fa,fg,lf,la,lg,g,city] = N[i];
    const email = `${fn.toLowerCase()}.${fa.toLowerCase()}${i+1}@lucy.edu`;
    const fullName = `${fn} ${fa} ${fg}`;
    const phone = `+2519${String(1000100+i+1).padStart(7,'0').slice(1)}`;
    const u = await prisma.user.upsert({ where:{email}, update:{}, create:{email,passwordHash:studentPw,fullName,phone,role:'STUDENT',isApproved:true,isProfileComplete:true} });
    await prisma.studentProfile.upsert({ where:{userId:u.id}, update:{}, create:{
      userId:u.id,status:'APPROVED',firstName:fn,fatherName:fa,grandFatherName:fg,
      firstNameLocal:lf,fatherNameLocal:la,grandFatherNameLocal:lg,gender:g,
      dateOfBirthGC:new Date(2002+Math.floor(Math.random()*4),Math.floor(Math.random()*12),1+Math.floor(Math.random()*28)),
      placeOfBirth:city,citizenship:'Ethiopian',country:'Ethiopia',city,phone,email,
      maritalStatus:'Single',healthStatus:'Normal',economicalStatus:'Medium',areaType:'Non Pastoral',
      stream:i%3===0?'Social Science':'Natural Science',entryYear:2020,sponsorCategory:'Govt',
      nationalExamYearEC:2015,examinationId:`ETH-${String(i+1).padStart(4,'0')}`,admissionDate:new Date('2020-09-01'),
      nationalExamResultTotal:350+Math.floor(Math.random()*150),examEnglish:60+Math.floor(Math.random()*40),
      examPhysics:50+Math.floor(Math.random()*50),examCivics:55+Math.floor(Math.random()*45),
      examNaturalMath:50+Math.floor(Math.random()*50),examChemistry:45+Math.floor(Math.random()*55),
      examBiology:50+Math.floor(Math.random()*50),examAptitude:55+Math.floor(Math.random()*45),
    }});
  }
  console.log(`Created ${N.length} students`);

  // Departments & Classes
  const csDept = await prisma.department.upsert({ where:{code:'CS'}, update:{}, create:{name:'Computer Science',code:'CS',description:'Dept of CS',pricePerCreditHour:500,totalCreditHours:140,minCreditHoursToGraduate:140,minGradeToGraduate:2.0,durationYears:5} });
  const itDept = await prisma.department.upsert({ where:{code:'IT'}, update:{}, create:{name:'Information Technology',code:'IT',description:'Dept of IT',pricePerCreditHour:500,totalCreditHours:135,minCreditHoursToGraduate:135,minGradeToGraduate:2.0,durationYears:5} });
  const csClass = await prisma.class.upsert({ where:{code:'CS-Y1-SEC1'}, update:{}, create:{name:'CS Year 1 Sec 1',code:'CS-Y1-SEC1',year:1,section:'1',departmentId:csDept.id} });
  const itClass = await prisma.class.upsert({ where:{code:'IT-Y1-SEC1'}, update:{}, create:{name:'IT Year 1 Sec 1',code:'IT-Y1-SEC1',year:1,section:'1',departmentId:itDept.id} });

  const allS = await prisma.user.findMany({where:{role:'STUDENT'},orderBy:{createdAt:'asc'},select:{id:true}});
  const eIds = allS.slice(1);
  for (const s of eIds.slice(0,50)) await prisma.classStudent.upsert({where:{classId_studentId:{classId:csClass.id,studentId:s.id}},update:{},create:{classId:csClass.id,studentId:s.id}});
  for (const s of eIds.slice(50,100)) await prisma.classStudent.upsert({where:{classId_studentId:{classId:itClass.id,studentId:s.id}},update:{},create:{classId:itClass.id,studentId:s.id}});
  await prisma.classTeacher.upsert({where:{classId_teacherId:{classId:csClass.id,teacherId:teacher.id}},update:{},create:{classId:csClass.id,teacherId:teacher.id}});
  await prisma.classTeacher.upsert({where:{classId_teacherId:{classId:itClass.id,teacherId:teacher.id}},update:{},create:{classId:itClass.id,teacherId:teacher.id}});
  console.log('Assigned 50 students to each class');

  // Academic years per year of study
  const ays = {};
  const ayN = ['2020-2021','2021-2022','2022-2023','2023-2024','2024-2025'];
  for (let i=0;i<ayN.length;i++) ays[i+1] = await prisma.academicYear.upsert({where:{name:ayN[i]},update:{},create:{name:ayN[i],startDate:new Date(`${2020+i}-09-01`),endDate:new Date(`${2021+i}-08-31`),isActive:i===ayN.length-1}});

  // 5-year curricula (CS=140cr, IT=135cr)
  const csCur=[
    {y:1,s:'FALL',n:'Fall 2020',st:'2020-09-01',en:'2021-01-15',c:[{code:'CS101',t:'Intro to CS',cr:3},{code:'CS102',t:'Programming Fundamentals',cr:3},{code:'CS103',t:'Discrete Math',cr:3},{code:'CS104',t:'Digital Logic',cr:3},{code:'CS105',t:'Algorithms',cr:3},{code:'CS106',t:'Computer Org',cr:3},{code:'ENG101',t:'English I',cr:3}]},
    {y:1,s:'SPRING',n:'Spring 2021',st:'2021-02-01',en:'2021-06-15',c:[{code:'CS111',t:'OOP',cr:3},{code:'CS112',t:'Data Structures',cr:3},{code:'CS113',t:'Linear Algebra',cr:3},{code:'CS114',t:'Prob & Stat',cr:3},{code:'CS115',t:'Systems Analysis',cr:3},{code:'ENG102',t:'English II',cr:3}]},
    {y:2,s:'FALL',n:'Fall 2021',st:'2021-09-01',en:'2022-01-15',c:[{code:'CS201',t:'Database Systems',cr:3},{code:'CS202',t:'Operating Systems',cr:3},{code:'CS203',t:'Networks',cr:3},{code:'CS204',t:'Software Eng',cr:3},{code:'CS205',t:'Theory of Computation',cr:3},{code:'CS206',t:'Web Programming',cr:3},{code:'MATH201',t:'Calculus I',cr:3}]},
    {y:2,s:'SPRING',n:'Spring 2022',st:'2022-02-01',en:'2022-06-15',c:[{code:'CS211',t:'Advanced DB',cr:3},{code:'CS212',t:'Computer Arch',cr:3},{code:'CS213',t:'Network Admin',cr:3},{code:'CS214',t:'Mobile Dev',cr:3},{code:'CS215',t:'Numerical Methods',cr:3},{code:'MATH202',t:'Calculus II',cr:3}]},
    {y:3,s:'FALL',n:'Fall 2022',st:'2022-09-01',en:'2023-01-15',c:[{code:'CS301',t:'AI',cr:3},{code:'CS302',t:'Compiler Design',cr:3},{code:'CS303',t:'Info Security',cr:3},{code:'CS304',t:'Distributed Systems',cr:3},{code:'CS305',t:'HCI',cr:3},{code:'CS306',t:'Data Comm',cr:3}]},
    {y:3,s:'SPRING',n:'Spring 2023',st:'2023-02-01',en:'2023-06-15',c:[{code:'CS311',t:'ML',cr:3},{code:'CS312',t:'Cloud Computing',cr:3},{code:'CS313',t:'Network Security',cr:3},{code:'CS314',t:'Software Testing',cr:3},{code:'CS315',t:'Data Mining',cr:3},{code:'CS316',t:'Embedded Systems',cr:3}]},
    {y:4,s:'FALL',n:'Fall 2023',st:'2023-09-01',en:'2024-01-15',c:[{code:'CS401',t:'Deep Learning',cr:3},{code:'CS402',t:'Big Data',cr:3},{code:'CS403',t:'IoT',cr:3},{code:'CS404',t:'Blockchain',cr:3},{code:'CS405',t:'Project Mgmt',cr:3},{code:'CS406',t:'Senior Project I',cr:3}]},
    {y:4,s:'SPRING',n:'Spring 2024',st:'2024-02-01',en:'2024-06-15',c:[{code:'CS411',t:'NLP',cr:3},{code:'CS412',t:'Computer Vision',cr:3},{code:'CS413',t:'DevOps',cr:3},{code:'CS414',t:'Ethics',cr:3},{code:'CS415',t:'Senior Project II',cr:3}]},
    {y:5,s:'FALL',n:'Fall 2024',st:'2024-09-01',en:'2025-01-15',c:[{code:'CS501',t:'Advanced Algorithms',cr:3},{code:'CS502',t:'Research Methods',cr:3},{code:'CS503',t:'Thesis I',cr:6}]},
    {y:5,s:'SPRING',n:'Spring 2025',st:'2025-02-01',en:'2025-06-15',c:[{code:'CS511',t:'Professional Practice',cr:3},{code:'CS512',t:'Thesis II',cr:6}]},
  ];
  const itCur=[
    {y:1,s:'FALL',n:'Fall 2020',st:'2020-09-01',en:'2021-01-15',c:[{code:'IT101',t:'Intro to IT',cr:3},{code:'IT102',t:'Web Tech',cr:3},{code:'IT103',t:'DB Fundamentals',cr:3},{code:'IT104',t:'OS Concepts',cr:3},{code:'IT105',t:'Networking',cr:3},{code:'IT106',t:'Math for IT',cr:3},{code:'ENG101',t:'English I',cr:3}]},
    {y:1,s:'SPRING',n:'Spring 2021',st:'2021-02-01',en:'2021-06-15',c:[{code:'IT111',t:'Python',cr:3},{code:'IT112',t:'Advanced Web',cr:3},{code:'IT113',t:'Statistics',cr:3},{code:'IT114',t:'Sys Admin',cr:3},{code:'IT115',t:'Multimedia',cr:3},{code:'ENG102',t:'English II',cr:3}]},
    {y:2,s:'FALL',n:'Fall 2021',st:'2021-09-01',en:'2022-01-15',c:[{code:'IT201',t:'Network Design',cr:3},{code:'IT202',t:'DB Admin',cr:3},{code:'IT203',t:'OOP',cr:3},{code:'IT204',t:'Info Systems',cr:3},{code:'IT205',t:'Data Structures',cr:3},{code:'MATH201',t:'Calculus I',cr:3}]},
    {y:2,s:'SPRING',n:'Spring 2022',st:'2022-02-01',en:'2022-06-15',c:[{code:'IT211',t:'Network Security',cr:3},{code:'IT212',t:'Mobile App',cr:3},{code:'IT213',t:'Cloud Infra',cr:3},{code:'IT214',t:'SW Project Mgmt',cr:3},{code:'IT215',t:'E-Commerce',cr:3},{code:'MATH202',t:'Calculus II',cr:3}]},
    {y:3,s:'FALL',n:'Fall 2022',st:'2022-09-01',en:'2023-01-15',c:[{code:'IT301',t:'Info Security Mgmt',cr:3},{code:'IT302',t:'Enterprise Arch',cr:3},{code:'IT303',t:'Data Warehouse',cr:3},{code:'IT304',t:'IT Service Mgmt',cr:3},{code:'IT305',t:'HCI',cr:3},{code:'IT306',t:'Wireless Networks',cr:3}]},
    {y:3,s:'SPRING',n:'Spring 2023',st:'2023-02-01',en:'2023-06-15',c:[{code:'IT311',t:'Cybersecurity',cr:3},{code:'IT312',t:'Big Data',cr:3},{code:'IT313',t:'DevOps',cr:3},{code:'IT314',t:'IoT Apps',cr:3},{code:'IT315',t:'Business Intel',cr:3},{code:'IT316',t:'Digital Forensics',cr:3}]},
    {y:4,s:'FALL',n:'Fall 2023',st:'2023-09-01',en:'2024-01-15',c:[{code:'IT401',t:'ML for IT',cr:3},{code:'IT402',t:'Blockchain',cr:3},{code:'IT403',t:'IT Governance',cr:3},{code:'IT404',t:'Disaster Recovery',cr:3},{code:'IT405',t:'Senior Project I',cr:3}]},
    {y:4,s:'SPRING',n:'Spring 2024',st:'2024-02-01',en:'2024-06-15',c:[{code:'IT411',t:'AI in Business',cr:3},{code:'IT412',t:'ERP',cr:3},{code:'IT413',t:'Ethics',cr:3},{code:'IT414',t:'Senior Project II',cr:3}]},
    {y:5,s:'FALL',n:'Fall 2024',st:'2024-09-01',en:'2025-01-15',c:[{code:'IT501',t:'Research Methods',cr:3},{code:'IT502',t:'Thesis I',cr:6}]},
    {y:5,s:'SPRING',n:'Spring 2025',st:'2025-02-01',en:'2025-06-15',c:[{code:'IT511',t:'Professional Practice',cr:3},{code:'IT512',t:'Thesis II',cr:6}]},
  ];

  const csT = csCur.reduce((s,sem)=>s+sem.c.reduce((a,co)=>a+co.cr,0),0);
  const itT = itCur.reduce((s,sem)=>s+sem.c.reduce((a,co)=>a+co.cr,0),0);
  console.log(`CS: ${csT} cr | IT: ${itT} cr`);

  // Create courses
  const cMap = new Map();
  for (const sem of [...csCur,...itCur]) for (const co of sem.c) if(!cMap.has(co.code)) cMap.set(co.code,co);
  const cC = {};
  for (const [,co] of cMap) cC[co.code] = await prisma.course.upsert({where:{code:co.code},update:{},create:{code:co.code,title:co.t,description:co.t,creditHours:co.cr,ectsCredits:Math.round(co.cr*5/3),stream:co.code.startsWith('ENG')||co.code.startsWith('MATH')?null:'Natural Science'}});
  console.log(`Created ${cMap.size} courses`);

  // Semesters
  const sMap = {};
  const allSn = [...new Set([...csCur,...itCur].map(s=>s.n))];
  for (const sn of allSn) {
    const sd = csCur.find(s=>s.n===sn)||itCur.find(s=>s.n===sn);
    const isLast = sn==='Spring 2025';
    const tp = sd.s==='FALL'?'FALL':'SPRING';
    sMap[sn] = await prisma.semester.upsert({where:{academicYearId_type:{academicYearId:ays[sd.y].id,type:tp}},update:{},create:{academicYearId:ays[sd.y].id,type:tp,name:sn,startDate:new Date(sd.st),endDate:new Date(sd.en),registrationStart:new Date(new Date(sd.st).getTime()-15*86400000),registrationEnd:new Date(new Date(sd.st).getTime()-86400000),status:isLast?'IN_PROGRESS':'COMPLETED',isCurrent:isLast}});
  }
  console.log(`Created ${allSn.length} semesters`);

  // Grade helper
  function gG(t){if(t>=90)return{l:'A_PLUS',p:4};if(t>=85)return{l:'A',p:4};if(t>=80)return{l:'A_MINUS',p:3.75};if(t>=75)return{l:'B_PLUS',p:3.5};if(t>=70)return{l:'B',p:3};if(t>=65)return{l:'B_MINUS',p:2.75};if(t>=60)return{l:'C_PLUS',p:2.5};if(t>=50)return{l:'C',p:2};if(t>=45)return{l:'C_MINUS',p:1.75};if(t>=40)return{l:'D',p:1};return{l:'F',p:0}}

  const csS = await prisma.classStudent.findMany({where:{classId:csClass.id},select:{studentId:true}});
  const itS = await prisma.classStudent.findMany({where:{classId:itClass.id},select:{studentId:true}});
  let tg = 0;

  const csCode = csClass.id;
  async function proc(cur,cid,sts){
    const deptPrefix = cid===csCode?'CS':'IT';
    for(const sem of cur){
      const semObj = sMap[sem.n];
      for(const co of sem.c){
        const sc = `${co.code}-${deptPrefix}-A`;
        await prisma.courseSection.upsert({where:{courseId_semesterId_sectionCode:{courseId:cC[co.code].id,semesterId:semObj.id,sectionCode:sc}},update:{},create:{courseId:cC[co.code].id,semesterId:semObj.id,teacherId:teacher.id,classId:cid,sectionCode:sc,deliveryMode:'ONLINE',isPublished:true}});
        await prisma.courseClass.upsert({where:{courseId_classId:{courseId:cC[co.code].id,classId:cid}},update:{},create:{courseId:cC[co.code].id,classId:cid,teacherId:teacher.id}});
        const sec = await prisma.courseSection.findFirst({where:{courseId:cC[co.code].id,semesterId:semObj.id,classId:cid}});
        for(const s of sts){
          const enr = await prisma.studentEnrollment.upsert({where:{courseSectionId_studentId:{courseSectionId:sec.id,studentId:s.studentId}},update:{},create:{courseSectionId:sec.id,studentId:s.studentId,status:'ENROLLED'}});
          const q=10+Math.floor(Math.random()*15),a=10+Math.floor(Math.random()*15),m=15+Math.floor(Math.random()*25),f=15+Math.floor(Math.random()*35),at=3+Math.floor(Math.random()*7);
          const tot=q+a+m+f+at; const gr=gG(tot);
          await prisma.studentGrade.upsert({where:{enrollmentId:enr.id},update:{},create:{enrollmentId:enr.id,quizScore:q,assignmentScore:a,midtermScore:m,finalScore:f,attendanceScore:at,totalScore:tot,gradeLetter:gr.l,gradePoint:gr.p,isSubmitted:true,isPublished:true,submittedAt:new Date(sem.en),publishedAt:new Date(sem.en)}});
          tg++;
        }
      }
      console.log(`${sem.n}: ${sem.c.length} courses, ${sem.c.reduce((s,c)=>s+c.cr,0)} cr`);
    }
  }

  await proc(csCur,csClass.id,csS);
  await proc(itCur,itClass.id,itS);
  console.log(`\nTotal grades: ${tg}`);

  // Create sample notifications for students
  const allStudents = await prisma.user.findMany({ where: { role: 'STUDENT' }, select: { id: true } });
  const currentSem = await prisma.semester.findFirst({ where: { isCurrent: true } });
  const notifTypes = [
    { type: 'GRADE_PUBLISHED', title: 'Grades Published', message: `Your grades for ${currentSem?.name || 'this semester'} have been published. Check your results now.` },
    { type: 'NEW_ASSESSMENT', title: 'New Assessment', message: 'A new assessment has been created for your course. Check your classes for details.' },
    { type: 'ASSESSMENT_OPENED', title: 'Assessment Now Available', message: 'An assessment has been unlocked. You can start your exam now.' },
    { type: 'REGISTRATION_OPEN', title: 'Registration Open', message: 'Course registration is now open for the upcoming semester. Register now to secure your spot.' },
    { type: 'ASSESSMENT_CREATED', title: 'Assessment Created', message: 'A new online exam has been scheduled. Check your course page for details.' },
  ];
  let notifCount = 0;
  for (const student of allStudents) {
    // Give each student 1-3 random notifications
    const numNotifs = 1 + Math.floor(Math.random() * 3);
    const selected = notifTypes.sort(() => Math.random() - 0.5).slice(0, numNotifs);
    for (const notif of selected) {
      await prisma.notification.create({
        data: {
          userId: student.id,
          type: notif.type,
          title: notif.title,
          message: notif.message,
          isRead: Math.random() < 0.3, // 30% chance already read
        },
      });
      notifCount++;
    }
  }
  console.log(`Created ${notifCount} student notifications`);

  console.log('\n=== Seed Complete ===');
  console.log('Admin: admin@lucy.edu / admin123');
  console.log('Teacher: teacher@lucy.edu / teacher123');
  console.log('Student: student@lucy.edu / student123');
  console.log('CS: 140 cr hrs | IT: 135 cr hrs | Full 5-year degree');
}

main().catch(e=>{console.error(e);process.exit(1)}).finally(async()=>{await prisma.$disconnect()});
