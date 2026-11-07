const classLabels={'5A':'Grade 5 · 5A','6A':'Grade 6 · 6A','6B':'Grade 6 · 6B'};
const arabicRosterSeed={
'5A':[
'أسامة قيس إياد المصري',
'إبراهيم محمد طه حسن',
'احمد تركي عسيري',
'بدر أحمد عبدالرحمن العباد',
'تميم فهد ال منجم',
'حامد سعد حامد الشمراني',
'خالد سعد خالد الهاجري',
'خالد عبدالعزيز خالد الذياب',
'خالد عبدالله خالد الخالدي',
'رواف سليمان محمد الدغيم',
'ريان محمد سلمان',
'سعود فارس حسين النعمي',
'سلمان فيصل سعد الدوسري',
'صالح منذر صالح السعيد',
'عبدالرحمن عبيدة دمشقية',
'عبدالله فهد عبدالله القحطاني',
'فهد بدر جاسم الخليوي',
'فهد طلال عبدالله حسن الخشرمي',
'محمد خالد المناع',
'مروان معتز محمد حميد محمد',
'مشاري ضويان محمد الضويان',
'نايف فهد محمد القحطاني',
'يزيد حاتم حماد الشمري',
'يوسف صالح سالم العنزي',
'يوسف عبدالله السلطان'
],
'6A':[
'أسامة جابر أحمد السهيمي',
'إياد حسن عبدالحميد سليمان',
'تميم خالد علي الحربي',
'حسين عبدالله محمد العليو',
'سعود بدر الخليوي',
'سلطان فيصل عبدالحميد الدبيكل',
'سليمان محمد صالح المعيلي',
'عاصم عمر محمد القحطاني',
'عامر سالم بكر فلاته',
'عبدالله أحمد عبدالله الغامدي',
'عزام محمد خميس الخثعمي',
'علي حامد علي الرشيدان',
'عماد وائل رياض مصري',
'محمد أحمد زكريا عطار',
'محمد عماد محمد القصيبي',
'محمود بيان أباظة',
'ناصر شاهين ناصر الشريف',
'وسام عبدالرحمن علي البلوي',
'يوسف فيصل يوسف الدوسري'
],
'6B':[
'ابراهيم ضياء عصام خضر',
'تركي عبدالله عبداللطيف ال محمد',
'خالد عبدالله حسن القحطاني',
'خالد ناصر خالد علي الرميحي',
'رياض علي رياض الذيب',
'سامي صالح سامي الفريان',
'سلطان عبدالله محمد الهاجري',
'طلال سعد جعلان الخالدي',
'عبدالعزيز فيصل عبدالعزيز الملحم',
'عبداللطيف عبدالله عبداللطيف الأحمدي',
'عبدالله عبدالعزيز حسن القحطاني',
'عبدالله عبدالعزيز عبدالله الشهراني',
'عبدالله يوسف سعد الشمري',
'عزام عبدالواحد عوض الزهراني',
'علي محمد علي الدرويش',
'عمر معتز شبيب دسوقي',
'فارس أمجد نوري المزين',
'محمد عبدالعزيز محمد الملحم',
'يزن نزار عدنان الخضراء',
'يوسف رائد ابراهيم الشعيبي'
]};
const normalizeName=s=>String(s).normalize('NFKC').replace(/[\u064B-\u065F\u0670\u0640]/g,'').replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/\s+/g,'').toLowerCase();
const rosterSeed={
  "5A": [
    "Osama Qais Iyad Al-Masri",
    "Ibrahim Mohammed Taha Hassan",
    "Ahmed Turki Asiri",
    "Badr Ahmed Abdulrahman Al-Abbad",
    "Tamim Fahad Al Munajjim",
    "Hamed Saad Hamed Al-Shamrani",
    "Khalid Saad Khalid Al-Hajri",
    "Khalid Abdulaziz Khalid Al-Dhiyab",
    "Khalid Abdullah Khalid Al-Khaldi",
    "Rawaf Sulaiman Mohammed Al-Dughaim",
    "Rayan Mohammed Salman",
    "Saud Faris Hussein Al-Naami",
    "Salman Faisal Saad Al-Dosari",
    "Saleh Munther Saleh Al-Saeed",
    "Abdulrahman Obaida Dimashqiya",
    "Abdullah Fahad Abdullah Al-Qahtani",
    "Fahad Badr Jassim Al-Khulaiwi",
    "Fahad Talal Abdullah Hassan Al-Khashrami",
    "Mohammed Khalid Al-Mannaa",
    "Marwan Moataz Mohammed Hameed Mohammed",
    "Mishari Dhuwayan Mohammed Al-Dhuwayan",
    "Nayef Fahad Mohammed Al-Qahtani",
    "Yazid Hatem Hammad Al-Shammari",
    "Yousef Saleh Salem Al-Anazi",
    "Yousef Abdullah Al-Sultan"
  ],
  "6A": [
    "Osama Jaber Ahmed Al-Suhaimi",
    "Iyad Hassan Abdulhamid Sulaiman",
    "Tamim Khalid Ali Al-Harbi",
    "Hussein Abdullah Mohammed Al-Alyou",
    "Saud Badr Al-Khulaiwi",
    "Sultan Faisal Abdulhamid Al-Dubaikel",
    "Sulaiman Mohammed Saleh Al-Muaili",
    "Asim Omar Mohammed Al-Qahtani",
    "Amer Salem Bakr Fallatah",
    "Abdullah Ahmed Abdullah Al-Ghamdi",
    "Azzam Mohammed Khamis Al-Khathami",
    "Ali Hamed Ali Al-Rushaidan",
    "Imad Wael Riyad Masri",
    "Mohammed Ahmed Zakaria Attar",
    "Mohammed Imad Mohammed Al-Qusaibi",
    "Mahmoud Bayan Abaza",
    "Nasser Shaheen Nasser Al-Sharif",
    "Wisam Abdulrahman Ali Al-Balawi",
    "Yousef Faisal Yousef Al-Dosari"
  ],
  "6B": [
    "Ibrahim Diaa Essam Khadr",
    "Turki Abdullah Abdullatif Al Mohammed",
    "Khalid Abdullah Hassan Al-Qahtani",
    "Khalid Nasser Khalid Ali Al-Rumaihi",
    "Riyad Ali Riyad Al-Dheeb",
    "Sami Saleh Sami Al-Furayyan",
    "Sultan Abdullah Mohammed Al-Hajri",
    "Talal Saad Jalaan Al-Khaldi",
    "Abdulaziz Faisal Abdulaziz Al-Mulhim",
    "Abdullatif Abdullah Abdullatif Al-Ahmadi",
    "Abdullah Abdulaziz Hassan Al-Qahtani",
    "Abdullah Abdulaziz Abdullah Al-Shahrani",
    "Abdullah Yousef Saad Al-Shammari",
    "Azzam Abdulwahid Awad Al-Zahrani",
    "Ali Mohammed Ali Al-Darwish",
    "Omar Moataz Shabib Desouki",
    "Faris Amjad Nouri Al-Muzayyin",
    "Mohammed Abdulaziz Mohammed Al-Mulhim",
    "Yazan Nizar Adnan Al-Khadraa",
    "Yousef Raed Ibrahim Al-Shuaibi"
  ]
};
function mergeSchoolRosters(data){
 if(data.schoolRosterVersion===2)return false;
 for(const [c,names] of Object.entries(rosterSeed)){
  if(!Object.hasOwn(data.classes,c))data.classes[c]=[];
  names.forEach((name,index)=>{
   const id=`ajyal-${c}-${index+1}`,arabic=arabicRosterSeed[c][index];
   const existing=data.classes[c].find(s=>s.id===id)||data.classes[c].find(s=>normalizeName(s.name)===normalizeName(arabic)||normalizeName(s.name)===normalizeName(name));
   if(existing)existing.name=name;
   else data.classes[c].push({id,name});
  });
 }
 data.schoolRosterVersion=2;return true;
}
